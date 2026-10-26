const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const vm = require('vm');
const WS = require('ws');
const { createServer } = require('../server');
const { declaration } = require('./helpers/characterization-client');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  for (let i = 0; i < 200; i++) { const value = fn(); if (value) return value; await sleep(10); }
  throw new Error('Protocol test timed out');
}

(async () => {
  // getRandomValues works in the HTTP mobile viewer too (no SubtleCrypto needed).
  const storage = new Map();
  const LS = { get: (key, fallback) => storage.get(key) ?? fallback, set: (key, value) => storage.set(key, value) };
  const ctx = vm.createContext({ LS, crypto: { getRandomValues: array => crypto.webcrypto.getRandomValues(array) } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/client-identity.js'), 'utf8').replace(/^export /gm, ''), ctx);
  const identitySecret = ctx.clientIdentitySecret(LS, ctx.crypto);
  assert.match(identitySecret, /^[a-f0-9]{64}$/);
  assert.equal(ctx.clientIdentitySecret(LS, ctx.crypto), identitySecret, 'identity survives reload');
  storage.set('identitySecret', 'invalid');
  assert.notEqual(ctx.clientIdentitySecret(LS, ctx.crypto), identitySecret, 'invalid storage is replaced');
  assert.match(ctx.clientIdentitySecret({ get: () => null, set: () => false }, ctx.crypto), /^[a-f0-9]{64}$/, 'storage failure still allows a session');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-security-'));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  let server;
  const sockets = [];
  async function start(dataDir, restore) {
    server = createServer({ port, dataDir, restore, code: 'FIX12345', password: 'test-password', log() {} });
    await server.listen();
  }
  async function connect() {
    const ws = new WS(`ws://127.0.0.1:${port}`);
    sockets.push(ws);
    ws.messages = [];
    ws.on('message', raw => ws.messages.push(JSON.parse(raw)));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    ws.sendJSON = msg => ws.send(JSON.stringify(msg));
    return ws;
  }
  async function hello(ws, extra = {}) {
    ws.sendJSON({ t: 'hello', name: 'Test', password: 'test-password', ...extra });
    ws.welcome = await until(() => ws.messages.find(m => m.t === 'welcome'));
    return ws;
  }
  const join = async extra => hello(await connect(), extra);
  async function fence(ws) {
    const ts = crypto.randomBytes(8).toString('hex');
    ws.sendJSON({ t: 'ping', ts });
    await until(() => ws.messages.find(m => m.t === 'pong' && m.ts === ts));
  }
  async function disconnect(ws) {
    const closed = new Promise(resolve => ws.once('close', resolve));
    ws.close(); await closed;
  }
  async function stop() {
    for (const ws of sockets) if (ws.readyState !== WS.CLOSED) ws.terminate();
    if (server) { await server.close(); server = null; }
  }
  try {
    await start(path.join(root, 'original'));
    const a = await connect();
    const malformed = ['{', 'null', '[]', '1', 'true', '"text"', '{}', '{"t":null}', '{"t":[]}'];
    for (const raw of malformed) a.send(raw);
    // Reaching welcome proves malformed pre-auth messages did not terminate the server.
    await hello(a, { identitySecret });
    for (const raw of malformed) a.send(raw);
    await fence(a);
    assert.equal((await fetch(base + '/api/info')).status, 200);
    assert.equal((await fetch(base + '/app/client-identity.js')).status, 200, 'HTTP clients can load the new module');

    // Exercise the actual desktop/browser/PWA connect() hello path, not a copied payload.
    const browserState = {};
    const received = [];
    const browserSecret = crypto.randomBytes(32).toString('hex');
    const browser = vm.createContext({ S: browserState, PWA_ADDR: {}, WEB_VIEWER: false,
      WebSocket: WS, CID: 'legacy-client', IDENTITY_SECRET: browserSecret, sessionResume: () => undefined,
      me: { name: 'Browser' }, profileExtras: () => ({}), native: null, handle: m => received.push(m) });
    vm.runInContext(declaration(fs.readFileSync(path.join(__dirname, '../app/client.js'), 'utf8'), 'connect'), browser);
    browser.connect({ text: `127.0.0.1:${port}` }, 'test-password', true);
    sockets.push(browserState.ws);
    const browserWelcome = await until(() => received.find(m => m.t === 'welcome'));
    assert.equal(browserWelcome.id, crypto.createHash('sha256').update('resenha-client-v1:' + browserSecret).digest('hex').slice(0, 40));
    browserState.closing = true;
    await disconnect(browserState.ws);

    for (const name of ['100%.txt', 'literal%20name.txt', 'ação com espaço.txt', '%E0%A4%A.txt']) {
      const response = await fetch(`${base}/upload?t=${a.welcome.token}&name=${encodeURIComponent(name)}`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'upload fixture',
      });
      assert.equal(response.status, 200);
      const meta = await response.json();
      assert.equal(meta.name, name, 'filename must be decoded exactly once');
      const download = await fetch(`${base}${meta.url}?t=${a.welcome.token}`);
      assert.equal(download.status, 200);
      assert.equal(await download.text(), 'upload fixture');
    }
    await fence(a);

    const ownerId = a.welcome.id;
    assert.equal(ownerId.length, 40, 'authenticated id fits the snapshot format');
    const b = await join();
    const liveIntruder = await join({ cid: ownerId });
    assert.notEqual(liveIntruder.welcome.id, ownerId);
    assert.equal(a.readyState, WS.OPEN);
    a.sendJSON({ t: 'chat', text: 'owner message' });
    const message = (await until(() => b.messages.find(m => m.t === 'chat'))).msg;
    await disconnect(a);
    await until(() => b.messages.find(m => m.t === 'user-leave' && m.id === ownerId));

    async function rejectImpersonation() {
      const attacker = await join({ cid: ownerId, resume: 'guessed', identitySecret: crypto.randomBytes(32).toString('hex') });
      assert.notEqual(attacker.welcome.id, ownerId);
      const legacyAttacker = await join({ cid: ownerId });
      assert.notEqual(legacyAttacker.welcome.id, ownerId, 'legacy hello cannot claim an offline id');
      for (const peer of [attacker, legacyAttacker]) {
        peer.sendJSON({ t: 'edit', id: message.id, text: 'forged' });
        peer.sendJSON({ t: 'delete', id: message.id });
        await fence(peer);
      }
      assert.equal(server.snapshot().history.geral.find(m => m.id === message.id).text, 'owner message');
      return [attacker, legacyAttacker];
    }
    const attackers = await rejectImpersonation();
    const back = await join({ identitySecret });
    assert.equal(back.welcome.id, ownerId, 'legitimate reconnect keeps identity');
    b.sendJSON({ t: 'dm', to: ownerId, text: 'only the real owner' });
    await until(() => back.messages.find(m => m.t === 'dm'));
    for (const peer of attackers) { await fence(peer); assert(!peer.messages.some(m => m.t === 'dm')); }
    const closed = new Promise(resolve => back.once('close', resolve));
    const replacement = await join({ identitySecret });
    await closed;
    assert.equal(replacement.welcome.id, ownerId, 'credential proves ownership of a live session too');
    const snapshot = server.snapshot();
    assert(!JSON.stringify(snapshot).includes(identitySecret));
    assert(!JSON.stringify(b.messages).includes(identitySecret), 'credential never enters broadcasts');

    // Neither a disk restart nor a public snapshot on a different host grants ownership.
    await stop();
    await start(path.join(root, 'original'));
    await rejectImpersonation();
    assert.equal((await join({ identitySecret })).welcome.id, ownerId);
    await stop();
    await start(path.join(root, 'successor'), snapshot);
    await rejectImpersonation();
    const successorOwner = await join({ identitySecret });
    assert.equal(successorOwner.welcome.id, ownerId);
    successorOwner.sendJSON({ t: 'edit', id: message.id, text: 'legitimate edit' });
    await fence(successorOwner);
    assert.equal(server.snapshot().history.geral.find(m => m.id === message.id).text, 'legitimate edit');

    // Old snapshots contain unauthenticated ids: never allow claiming those either.
    await stop();
    const legacySnapshot = { ...snapshot, history: { geral: [{ ...message, userId: 'aaaaaaaaaaaa' }] } };
    await start(path.join(root, 'legacy'), legacySnapshot);
    const legacy = await join({ cid: 'aaaaaaaaaaaa' });
    assert.notEqual(legacy.welcome.id, 'aaaaaaaaaaaa');
    legacy.sendJSON({ t: 'delete', id: message.id });
    await fence(legacy);
    assert(server.snapshot().history.geral.some(m => m.id === message.id));
    console.log('PASS: malformed WebSocket payloads, literal percent/Unicode uploads, private persistent identity, offline/live impersonation, DM routing, restart and host transfer');
  } finally {
    await stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
