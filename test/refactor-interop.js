// Both directions use distinct physical source trees, not just different versions.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), Module = require('module');
const WS = require('ws');
const { client } = require('./helpers/characterization-client');
const current = path.resolve(__dirname, '..');
const reference = process.env.RESENHA_REFERENCE_ROOT;
if (!reference || path.resolve(reference) === current) throw Error('A separate frozen source tree is required.');
process.env.NODE_PATH = path.join(current, 'node_modules'); Module._initPaths();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, name) { for (let i = 0; i < 150; i++) { const found = fn(); if (found) return found; await sleep(20); } throw Error('Timeout: ' + name); }
async function scenario(hostRoot, clientRoot, label) {
  const dir = fs.mkdtempSync(path.resolve(__dirname, '../../../work/interop-'));
  const dj = { ensure: async () => {}, resolve: async text => [{ id: text, title: text, duration: 600 }], fetchAudio: async item => { item._file = path.join(dir, 'audio.fixture'); fs.writeFileSync(item._file, 'fixture'); }, cancel() {}, forget() {} };
  const { createServer } = require(path.join(hostRoot, 'server'));
  // reserve a port through the same mechanism as the previous characterization
  const portServer = require('net').createServer(); await new Promise(r => portServer.listen(0, '127.0.0.1', r)); const port = portServer.address().port; await new Promise(r => portServer.close(r));
  const server = createServer({ port, dataDir: dir, roomName: 'Audit room', code: 'AUDI1234', dj, log() {} });
  const peers = [];
  try {
    await server.listen();
    const address = 'ws://127.0.0.1:' + port;
    const a = client(clientRoot, WS, address, 'A'), b = client(hostRoot, WS, address, 'B'), c = client(clientRoot, WS, address, 'C'); peers.push(a,b,c);
    await until(() => peers.every(p => p.S.myId), 'actual client welcome');
    assert.deepEqual(Array.from(a.S.features), ['room-snapshot','chat-ack','dm-ack','dj-ack','watch']);
    a.input.value = 'interoperable chat'; await a.sendMessage(); assert.equal(a.input.value, '');
    await until(() => b.S.history.geral?.some(m => m.text === 'interoperable chat'), 'actual receive dispatch');
    await a.command('dm', { to: b.S.myId, text: 'private-interop-sentinel' });
    await until(() => [...b.local.values()].some(value => value.includes('private-interop-sentinel')), 'actual local DM persistence');
    assert(!c.received.some(m => m.t === 'dm'));
    await assert.rejects(a.command('dm', { to: 'offline', text: 'preserve' }), /disponível/);
    a.send({ t: 'ch-create', type: 'text', name: 'characterized-channel' });
    await until(() => b.S.channels.some(c => c.name === 'characterized-channel'), 'channels');
    for (const p of [a,b]) p.send({ t: 'state', voiceChannel: 'lobby' });
    await until(() => a.S.users.get(b.S.myId)?.voiceChannel === 'lobby', 'channel membership');
    await a.command('dj-summon', { textChannel: 'geral' });
    await a.command('dj-add', { input: 'track-one' });
    await until(() => b.S.dj?.current?.id === 'track-one', 'DJ current');
    await a.command('dj-add', { input: 'track-two' });
    await b.command('dj-skip');
    await until(() => a.S.dj?.current?.id === 'track-two', 'DJ skip');
    await b.command('dj-kick'); await until(() => !a.S.dj?.active, 'DJ removal');
    const snapshot = server.snapshot();
    assert(!JSON.stringify(snapshot).includes('private-interop-sentinel'));
    assert.equal(snapshot.code, 'AUDI1234'); assert.equal(snapshot.schema, 1);
    for (const p of peers) assert.equal(p.faults.length, 0, p.faults.map(e => e.stack).join('\n'));
    console.log('PASS: '+label+' actual client functions + local WS; chat/DM/channel/DJ and snapshot privacy');
  } finally { for (const p of peers) p.ws.terminate(); await server.close(); }
}
(async () => { await scenario(current, reference, 'reference-client → current-host'); await scenario(reference, current, 'current-client → reference-host'); })().catch(error => { console.error(error); process.exitCode = 1; });
