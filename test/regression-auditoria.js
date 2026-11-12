// Auditoria da 2.3.3: cada caso aqui já derrubou ou travou a sala, ou abriu brecha de segurança.
const assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const WS = require('ws'), { createServer } = require('../server');
const wait = async (fn) => { for (let i = 0; i < 200; i++) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); } throw Error('timeout'); };
const PORT = 17981;
const req = (p, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers }, (res) => { let b = ''; res.on('data', (x) => (b += x)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b })); });
  r.on('error', reject); r.setTimeout(5000, () => r.destroy(new Error('sem resposta (servidor caiu?)'))); if (body) r.write(body); r.end();
});
const join = async (extra = {}) => {
  const ws = new WS(`ws://127.0.0.1:${PORT}`); ws.messages = [];
  ws.on('message', (d) => ws.messages.push(JSON.parse(d)));
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.send(JSON.stringify({ t: 'hello', name: 'Teste', ...extra }));
  return ws;
};

(async () => {
  // 1) Cliente: link com @ não quebra e anexo inválido não trava o chat (funções copiadas do client.js).
  const src = fs.readFileSync(path.join(__dirname, '../app/client.js'), 'utf8');
  const grab = (name) => { const i = src.indexOf(`function ${name}(`); assert(i > -1, name); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { users: new Map([['1', { name: 'lucas' }]]), base: '', token: 't' }, me = { name: 'eu' };
  const linkify = new Function('esc', 'S', 'me', grab('linkify') + '; return linkify;')(esc, S, me);
  const html = linkify('olha https://youtube.com/@lucas/**x** e @lucas', []);
  assert.match(html, /<a href="#" data-href="https:\/\/youtube\.com\/@lucas\/\*\*x\*\*">https:\/\/youtube\.com\/@lucas\/\*\*x\*\*<\/a>/);
  assert.match(html, / e <span class="mention ">@lucas<\/span>$/);
  const attHTML = new Function('esc', 'S', 'icon', 'fmtSize', 'fileUrl', grab('attHTML') + '; return attHTML;')(esc, S, () => '', () => '', (a) => a.url);
  assert.equal(attHTML(null), ''); assert.equal(attHTML({}), '');
  assert.doesNotMatch(attHTML({ id: 'a', url: '/files/a/x.svg', name: 'x.svg', type: 'image/svg+xml' }), /<img/);

  // 2) Celular: os scripts do PWA continuam válidos.
  new Function(fs.readFileSync(path.join(__dirname, '../pwa/pwa.js'), 'utf8'));
  new Function(fs.readFileSync(path.join(__dirname, '../pwa/sw.js'), 'utf8').replace('__FILES__', '[]'));

  // 3) Servidor.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-auditoria-'));
  const server = createServer({ port: PORT, dataDir: path.join(dir, 'sala'), password: 'certa', log: () => {} });
  const open = [];
  try {
    await server.listen();
    const a = await join({ password: 'certa' }); open.push(a);
    const welcome = await wait(() => a.messages.find((m) => m.t === 'welcome'));
    const t = welcome.token;

    // 3a) /files/__proto__ derrubava o app do anfitrião.
    for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.equal((await req(`/files/${id}/a?t=${t}`)).status, 404, id);
    assert.equal((await req('/api/info')).status, 200);

    // 3b) Anexo falso ia como {} e null para todos e travava o chat.
    a.send(JSON.stringify({ t: 'chat', channelId: 'geral', text: 'oi', attachments: [{ id: '__proto__' }, { id: 'constructor' }] }));
    const chat = await wait(() => a.messages.find((m) => m.t === 'chat' && m.msg.text === 'oi'));
    assert.deepEqual(chat.msg.attachments, []);

    // 3c) HTML/SVG enviados como anexo não podem rodar como página do app.
    const up = async (name, type, body) => JSON.parse((await req(`/upload?t=${t}&name=${name}`, { method: 'POST', headers: { 'content-type': type }, body })).body);
    const page = await up('x.html', 'text/html', '<script>alert(1)</script>');
    assert.equal(page.pendingSince, undefined);
    let r = await req(`${page.url}?t=${t}`);
    assert.equal(r.headers['content-type'], 'application/octet-stream');
    assert.match(r.headers['content-disposition'], /^attachment/);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.match(r.headers['content-security-policy'], /sandbox/);
    const svg = await up('x.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    r = await req(`${svg.url}?t=${t}`); assert.equal(r.headers['content-type'], 'application/octet-stream'); assert.match(r.headers['content-disposition'], /^attachment/);
    const png = await up('x.png', 'image/png', 'png');
    r = await req(`${png.url}?t=${t}`); assert.equal(r.headers['content-type'], 'image/png'); assert.equal(r.headers['content-disposition'], undefined);
    const weird = await up('y.png', 'qualquer<coisa>', 'png'); assert.equal(weird.type, 'image/png');
    // Anexo usado numa mensagem deixa de ser "envio solto" (não é apagado pela limpeza).
    a.send(JSON.stringify({ t: 'chat', channelId: 'geral', text: 'foto', attachments: [{ id: png.id }] }));
    const withFile = await wait(() => a.messages.find((m) => m.t === 'chat' && m.msg.text === 'foto'));
    assert.equal(withFile.msg.attachments.length, 1); assert.equal(withFile.msg.attachments[0].pendingSince, undefined);

    // 3d) /mobile-setup aceita o anfitrião em IPv6.
    assert.equal((await req('/mobile-setup', { headers: { host: '[::1]:' + PORT } })).status, 200);
    assert.equal((await req('/mobile-setup', { headers: { host: 'exemplo.com' } })).status, 400);

    // 3e) Tentativas de senha: depois de muitas erradas, até a certa espera um minuto.
    for (let i = 0; i < 20; i++) { const w = await join({ password: 'errada' + i }); open.push(w); await wait(() => w.messages.find((m) => m.code === 'password')); }
    const late = await join({ password: 'certa' }); open.push(late);
    const blocked = await wait(() => late.messages.find((m) => m.code === 'password' || m.t === 'welcome'));
    assert.equal(blocked.code, 'password'); assert.match(blocked.msg, /Muitas tentativas/);
    console.log('PASS: /files com nome especial, anexo falso, HTML/SVG como download, IPv6 no /mobile-setup, limite de senha, links com @ e anexo inválido no cliente');
  } finally {
    for (const w of open) try { w.terminate(); } catch {}
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
