// 2.1.1: transferir anfitrião. Só o anfitrião pede, só para quem usa o app de PC, e todos recebem o aviso.
const assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const { createServer } = require('../server');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-transfer-'));
  const port = 8600 + Math.floor(Math.random() * 300);
  const server = createServer({ port, dataDir: path.join(dir, 'room'), code: 'GORI2345', hostKey: 'chave-do-anfitriao', log: () => {} });
  await server.listen();
  const join = (cid, extra = {}) => new Promise((resolve, reject) => {
    const w = new WebSocket('ws://127.0.0.1:' + port); w.msgs = []; w.on('error', reject);
    w.on('message', (d) => { const m = JSON.parse(d); w.msgs.push(m); if (m.t === 'welcome') { w.welcome = m; resolve(w); } });
    w.on('open', () => w.send(JSON.stringify({ t: 'hello', name: 'P' + cid.slice(0, 2), cid, ...extra })));
  });
  const host = await join('aaaaaaaaaaaa', { hostKey: 'chave-do-anfitriao', canHost: true });
  const pc = await join('bbbbbbbbbbbb', { canHost: true });
  const web = await join('cccccccccccc');
  const wait = () => new Promise((r) => setTimeout(r, 250));
  const transfers = (w) => w.msgs.filter((m) => m.t === 'host-transfer');
  assert.ok(!('canHost' in web.welcome.users.find((u) => u.id === web.welcome.id)), 'cliente antigo/navegador não ganha campo novo');
  pc.send(JSON.stringify({ t: 'transfer-host', to: pc.welcome.id })); await wait();
  assert.equal(transfers(web).length, 0, 'quem não é anfitrião não consegue transferir');
  host.send(JSON.stringify({ t: 'transfer-host', to: web.welcome.id })); await wait();
  assert.equal(transfers(web).length, 0, 'não transfere para quem está no navegador');
  host.send(JSON.stringify({ t: 'transfer-host', to: host.welcome.id })); await wait();
  assert.equal(transfers(web).length, 0, 'não transfere para si mesmo');
  host.send(JSON.stringify({ t: 'transfer-host', to: pc.welcome.id })); await wait();
  for (const w of [host, pc, web]) assert.deepEqual(transfers(w).map((m) => [m.to, m.by]), [[pc.welcome.id, host.welcome.id]], 'todos sabem quem assume');
  host.close(); pc.close(); web.close(); await server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: transferir anfitrião só pelo anfitrião, só para o app de PC, aviso para todos');
})().catch((e) => { console.error(e); process.exit(1); });
