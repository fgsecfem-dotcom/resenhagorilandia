// Regressions from the independent 1.5.2 audit: stale update plans, failed helper starts,
// replicated attachment names, session takeover by cid, deleted-channel backup and DJ restore after close.
const assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), http = require('http');
const WebSocket = require('ws');
const { UpdateManager } = require('../update-manager');
const { makeSnapshot } = require('../room-state');
const { createServer } = require('../server');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-regression-'));

function stage({ name, version = '1.5.3', applying = false, attempted = null, helperStarted = false, result = null, targetName = 'app' }) {
  const parent = path.join(base, name), appDir = path.join(parent, 'app'), userData = path.join(parent, 'data');
  fs.mkdirSync(appDir, { recursive: true });
  const id = crypto.randomUUID(), root = path.join(parent, '.resenha-update-' + id);
  fs.mkdirSync(path.join(root, 'staging'), { recursive: true });
  const plan = { id, root, target: path.join(parent, targetName), staging: path.join(root, 'staging'), version, result: path.join(root, 'result.json'), ready: path.join(root, 'ready.json'), info: { version, page: 'https://github.com/x/releases/tag/v' + version } };
  if (attempted) plan.launchAttemptedAt = attempted;
  fs.writeFileSync(path.join(root, 'plan.json'), JSON.stringify(plan));
  if (applying) fs.writeFileSync(path.join(root, 'applying.json'), '{}');
  if (helperStarted) fs.writeFileSync(path.join(root, 'helper-started.json'), '{}');
  if (result) fs.writeFileSync(plan.result, JSON.stringify({ state: result }));
  fs.mkdirSync(path.join(userData, 'updates'), { recursive: true });
  fs.writeFileSync(path.join(userData, 'updates', 'pending.json'), JSON.stringify({ plan: path.join(root, 'plan.json'), info: plan.info }));
  const make = () => new UpdateManager({ userData, appDir, version: '1.5.2', platform: 'win32', arch: 'x64' });
  return { root, make, pendingFile: path.join(userData, 'updates', 'pending.json') };
}

(async () => {
  // A2: a plan for another folder or for a version already installed must not disable updates.
  let s = stage({ name: 'other-folder', targetName: 'old-copy' }); let m = s.make();
  assert.equal(m.pending(), null); assert(!fs.existsSync(s.pendingFile));
  s = stage({ name: 'same-version', version: '1.5.2' }); m = s.make();
  assert.equal(m.pending(), null); assert(!fs.existsSync(s.root), 'unusable staging is removed');
  // The post-swap confirmation of the new build still works.
  s = stage({ name: 'post-swap', version: '1.5.2', applying: true }); m = s.make();
  assert(m.pending(), 'plan awaiting renderer ACK is kept'); m.acknowledge(); assert(fs.existsSync(path.join(s.root, 'ready.json')));
  // A newer plan that never ran stays ready to install.
  s = stage({ name: 'ready' }); m = s.make(); assert.equal(m.pending()?.version, '1.5.3');

  // A1: a helper that never confirmed its start becomes a recovery, not a permanent gate.
  s = stage({ name: 'helper-missing', attempted: Date.now() - 1000 }); m = s.make();
  assert.equal(m.pending(), null); assert.equal(m.status().phase, 'error'); assert.equal(m.status().recovery, true);
  assert(m.autoBlocked('1.5.3') && m.autoBlocked('v1.5.3') && !m.autoBlocked('1.5.4'));
  // A helper that started and is still working is left alone.
  s = stage({ name: 'helper-running', attempted: Date.now() - 1000, helperStarted: true }); m = s.make(); assert(m.pending());

  // Rollback: the failed version is remembered and the copy of the failed app is cleaned up.
  s = stage({ name: 'rollback', attempted: Date.now() - 1000, helperStarted: true, result: 'rollback' }); m = s.make();
  m.acknowledge(); assert.equal(m.pending(), null); assert.equal(m.status().recovery, true); assert(m.autoBlocked('1.5.3')); assert(!fs.existsSync(s.root));

  // A6: abandoned update folders next to the app disappear after an hour; recent ones stay.
  const sweepParent = path.join(base, 'sweep'), oldRoot = path.join(sweepParent, '.resenha-update-' + crypto.randomUUID()), newRoot = path.join(sweepParent, '.resenha-update-' + crypto.randomUUID());
  fs.mkdirSync(path.join(sweepParent, 'app'), { recursive: true }); fs.mkdirSync(oldRoot); fs.mkdirSync(newRoot); fs.writeFileSync(path.join(oldRoot, 'download.zip'), 'x');
  const past = new Date(Date.now() - 2 * 60 * 60 * 1000); fs.utimesSync(oldRoot, past, past);
  new UpdateManager({ userData: path.join(sweepParent, 'data'), appDir: path.join(sweepParent, 'app'), version: '1.5.2', platform: 'win32' });
  assert(!fs.existsSync(oldRoot) && fs.existsSync(newRoot));

  // S2: replicated attachment names cannot point outside files/<id>/.
  const snap = makeSnapshot({ code: 'ABCD2345', channels: [{ id: 'geral', type: 'text', name: 'geral' }, { id: 'lobby', type: 'voice', name: 'Lobby' }],
    history: { geral: [{ id: 'm1', text: 'x', ts: 1, attachments: [{ id: 'abc123', name: '..\\..\\..\\segredo.txt' }, { id: '../x', name: 'a' }, null] }] } });
  const atts = snap.history.geral[0].attachments; assert.equal(atts.length, 1); assert(!/[\\/]/.test(atts[0].name));

  const data = path.join(base, 'room'), secret = path.join(base, 'segredo.txt'); fs.writeFileSync(secret, 'NÃO PODE SAIR');
  const port = 7900 + Math.floor(Math.random() * 300);
  const evil = { code: 'ABCD2345', revision: 9, channels: [{ id: 'geral', type: 'text', name: 'geral' }, { id: 'lobby', type: 'voice', name: 'Lobby' }],
    history: { geral: [{ id: 'm1', userId: 'x', name: 'x', text: 'olha', ts: 1, attachments: [{ id: 'abc123', name: path.relative(path.join(data, 'files', 'abc123'), secret) }] }] } };
  const server = createServer({ port, dataDir: data, code: 'ABCD2345', restore: evil, log: () => {}, backupRoot: path.join(base, 'backups') });
  await server.listen();
  const join = (cid, resume) => new Promise((resolve, reject) => { const w = new WebSocket('ws://127.0.0.1:' + port); w.msgs = []; w.on('error', reject);
    w.on('message', d => { const msg = JSON.parse(d); w.msgs.push(msg); if (msg.t === 'welcome') { w.welcome = msg; resolve(w); } });
    w.on('open', () => w.send(JSON.stringify({ t: 'hello', name: 'P' + cid.slice(0, 2), cid, resume }))); });
  const a = await join('aaaaaaaaaaaa');
  const get = url => new Promise(resolve => http.get(url, res => { let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, body })); }));
  const leaked = await get(`http://127.0.0.1:${port}/files/abc123/x?t=${a.welcome.token}`);
  assert(!leaked.body.includes('NÃO PODE SAIR'), 'restored attachment must not serve files outside the room');

  // S1: the same cid without the private resume key gets its own id and does not kick the owner.
  const intruder = await join('aaaaaaaaaaaa');
  assert.notEqual(intruder.welcome.id, 'aaaaaaaaaaaa'); assert.equal(a.readyState, WebSocket.OPEN);
  assert(typeof a.welcome.resume === 'string' && !JSON.stringify(intruder.welcome.users).includes(a.welcome.resume), 'resume key is never broadcast');
  // The owner reconnecting with its key replaces the lingering session and keeps its id.
  const closed = new Promise(r => a.once('close', r)); const again = await join('aaaaaaaaaaaa', a.welcome.resume);
  assert.equal(again.welcome.id, 'aaaaaaaaaaaa'); await closed;

  // Deleting a text channel keeps a local copy of its messages on the host.
  again.send(JSON.stringify({ t: 'ch-create', type: 'text', name: 'outro' })); await sleep(150);
  again.send(JSON.stringify({ t: 'ch-delete', id: 'geral' })); await sleep(300);
  assert(fs.readdirSync(path.join(base, 'backups')).some(f => /-canal-geral\.json$/.test(f)));
  intruder.close(); again.close(); await server.close();

  // R2: a DJ restored with the room never starts downloading after the room has closed.
  let fetches = 0; const dj = { ensure: async () => {}, fetchAudio: async () => { fetches++; await sleep(10000); }, forget() {}, cancel() {}, resolve: async () => [] };
  const djRoom = createServer({ port: port + 1, dataDir: path.join(base, 'dj-room'), code: 'ZZZZ2345', log: () => {}, dj,
    restore: { code: 'ZZZZ2345', revision: 1, channels: evil.channels, history: {}, dj: { active: true, channelId: 'lobby', queue: [{ title: 't', src: 'https://youtu.be/x' }] } } });
  await djRoom.listen(); await djRoom.close(); await sleep(3500);
  assert.equal(fetches, 0);

  fs.rmSync(base, { recursive: true, force: true });
  console.log('PASS: stale/other-folder plans, helper-not-started recovery, rollback memory and cleanup, leftover sweep, attachment containment, cid session ownership, deleted-channel backup, DJ restore after close');
})().catch(error => { console.error(error); process.exitCode = 1; });
