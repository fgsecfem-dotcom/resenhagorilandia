// Celular minimizado: a conexão com a sala pode cair sem aviso. A pessoa continua na call por um prazo e,
// se voltar, ninguém fecha a voz nem a live com ela. Saída de verdade continua imediata.
const assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const WS = require('ws'), { createServer } = require('../server');
const PORT = 17983;
const wait = async (fn, ms = 4000) => { for (let t = 0; t < ms; t += 20) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); } return null; };
const join = async (secret, name) => {
  const ws = new WS(`ws://127.0.0.1:${PORT}`); ws.messages = [];
  ws.on('message', (d) => ws.messages.push(JSON.parse(d)));
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.send(JSON.stringify({ t: 'hello', name, identitySecret: secret }));
  ws.welcome = await wait(() => ws.messages.find((m) => m.t === 'welcome'));
  return ws;
};
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-bg-'));
  const server = createServer({ port: PORT, dataDir: path.join(dir, 'sala'), log: () => {}, resumeGraceMs: 600 });
  const open = [];
  try {
    await server.listen();
    const A = 'a'.repeat(64), B = 'b'.repeat(64);
    const obs = await join(B, 'Observador'); open.push(obs);
    let cel = await join(A, 'Celular'); open.push(cel);
    const celId = cel.welcome.id;
    cel.send(JSON.stringify({ t: 'state', voiceChannel: 'lobby', sharing: false }));
    await wait(() => obs.messages.find((m) => m.t === 'user-update' && m.user.id === celId && m.user.voiceChannel === 'lobby'));

    // 1) Caiu sem aviso e voltou dentro do prazo: continua na call, sem "saiu".
    obs.messages.length = 0;
    cel.terminate();
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(obs.messages.some((m) => m.t === 'user-leave'), false, 'não sai da call enquanto espera');
    cel = await join(A, 'Celular'); open.push(cel);
    assert.equal(cel.welcome.id, celId);
    assert.equal(cel.welcome.users.find((u) => u.id === celId).voiceChannel, 'lobby', 'volta já no canal de voz');
    const upd = await wait(() => obs.messages.find((m) => m.t === 'user-update' && m.user.id === celId));
    assert.equal(upd.user.voiceChannel, 'lobby', 'os outros não veem a pessoa sair da call');
    await new Promise((r) => setTimeout(r, 800));
    assert.equal(obs.messages.some((m) => m.t === 'user-leave'), false, 'o prazo antigo não derruba a conexão nova');

    // 2) Caiu e não voltou: sai depois do prazo.
    obs.messages.length = 0;
    cel.terminate();
    assert(await wait(() => obs.messages.find((m) => m.t === 'user-leave' && m.id === celId), 3000), 'sai depois do prazo');

    // 3) Saída de verdade (fechar a aba): sai na hora.
    const tab = await join('c'.repeat(64), 'Aba'); open.push(tab);
    obs.messages.length = 0;
    tab.close();
    assert(await wait(() => obs.messages.find((m) => m.t === 'user-leave' && m.id === tab.welcome.id), 300), 'saída normal é imediata');

    // 4) Segunda aba aberta não herda a call da primeira.
    const first = await join('d'.repeat(64), 'Primeira'); open.push(first);
    first.send(JSON.stringify({ t: 'state', voiceChannel: 'lobby' }));
    await wait(() => obs.messages.find((m) => m.t === 'user-update' && m.user.id === first.welcome.id && m.user.voiceChannel === 'lobby'));
    const second = await join('d'.repeat(64), 'Primeira'); open.push(second);
    assert.equal(second.welcome.users.find((u) => u.id === first.welcome.id).voiceChannel, null);
    console.log('PASS: queda sem aviso segura a pessoa na call, volta sem fechar a voz, sai depois do prazo; saída normal imediata');
  } finally {
    for (const w of open) try { w.terminate(); } catch {}
    await server.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
