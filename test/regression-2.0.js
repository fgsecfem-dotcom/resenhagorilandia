// 2.0: server icon in the room snapshot, profile extras (status, bio, colours) and banner upload/download.
const assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const WebSocket = require('ws');
const roomState = require('../room-state');
const { safeIcon, MAX_ICON } = require('../server/room-icon');
const { createServer } = require('../server');

const base = { code: 'TEST1234', name: 'Gorilandia', channels: [{ id: 'g', type: 'text', name: 'geral' }, { id: 'l', type: 'voice', name: 'Lobby' }], history: {} };
const icon = 'data:image/jpeg;base64,' + 'A'.repeat(200) + '==';

assert.ok(!('icon' in roomState.makeSnapshot(base)), 'no icon key when the room has no icon (frozen format)');
assert.equal(roomState.makeSnapshot({ ...base, icon }).icon, icon, 'valid icon is kept');
for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,AA"><img', 'data:image/png;base64,' + 'A'.repeat(MAX_ICON)]) {
  assert.equal(safeIcon(bad), '', 'rejects ' + bad.slice(0, 30));
  assert.ok(!('icon' in roomState.makeSnapshot({ ...base, icon: bad })), 'invalid icon is dropped from the snapshot');
}

const request = (url, opts = {}, body) => new Promise((resolve, reject) => {
  const req = http.request(url, opts, (res) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks) })); });
  req.on('error', reject); if (body) req.write(body); req.end();
});

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-2.0-'));
  const port = 8300 + Math.floor(Math.random() * 300);
  const server = createServer({ port, dataDir: path.join(dir, 'room'), code: 'GORI2345', log: () => {} });
  await server.listen();
  const join = (cid, extra = {}) => new Promise((resolve, reject) => {
    const w = new WebSocket('ws://127.0.0.1:' + port); w.msgs = []; w.on('error', reject);
    w.on('message', (d) => { const m = JSON.parse(d); w.msgs.push(m); if (m.t === 'welcome') { w.welcome = m; resolve(w); } });
    w.on('open', () => w.send(JSON.stringify({ t: 'hello', name: 'P' + cid.slice(0, 2), cid, ...extra })));
  });
  const a = await join('aaaaaaaaaaaa', { status: '🎮 jogando\u0007 LoL', bio: 'x'.repeat(300), nameColor: '#fbbf24', bannerColor: 'red' });
  const b = await join('bbbbbbbbbbbb');
  const meA = b.welcome.users.find((u) => u.id === a.welcome.id);
  assert.equal(meA.status, '🎮 jogando  LoL', 'status kept, control character turned into a space');
  assert.equal(meA.bio.length, 140, 'bio limited to 140');
  assert.equal(meA.nameColor, '#fbbf24'); assert.equal(meA.bannerColor, '', 'invalid colour dropped');
  assert.ok(!('status' in b.welcome.users.find((u) => u.id === b.welcome.id)), 'old-style hello keeps the old user shape');

  const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
  const url = (k) => `http://127.0.0.1:${port}/banner?t=${a.welcome.token}&u=${a.welcome.id}&k=${encodeURIComponent(k)}`;
  assert.equal((await request(url('wrong'), { method: 'POST', headers: { 'Content-Type': 'image/gif' } }, gif)).status, 403, 'someone else cannot set my banner');
  assert.equal((await request(url(a.welcome.resume), { method: 'POST', headers: { 'Content-Type': 'image/svg+xml' } }, gif)).status, 415, 'only photos and GIFs');
  const up = await request(url(a.welcome.resume), { method: 'POST', headers: { 'Content-Type': 'image/gif' } }, gif);
  assert.equal(up.status, 200);
  await new Promise((r) => setTimeout(r, 200));
  const upd = b.msgs.filter((m) => m.t === 'user-update' && m.user.id === a.welcome.id).pop();
  assert.ok(upd && upd.user.banner, 'viewers are told about the new banner');
  const got = await request(`http://127.0.0.1:${port}/banner/${a.welcome.id}?t=${a.welcome.token}`);
  assert.equal(got.status, 200); assert.equal(got.type, 'image/gif'); assert.deepEqual(got.body, gif);
  assert.equal((await request(`http://127.0.0.1:${port}/banner/${a.welcome.id}?t=nope`)).status, 403, 'banner needs the room token');

  a.close(); b.close(); await server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: server icon in snapshot; profile extras sanitised; banner upload needs the owner key and serves GIFs to the room');
})().catch((e) => { console.error(e); process.exit(1); });
