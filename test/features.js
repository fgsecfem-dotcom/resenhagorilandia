const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const { createServer } = require('../server');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { const result = fn(); if (result) return result; await sleep(20); }
  throw new Error('Timeout: ' + label);
}
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-features-'));
  let pendingResolve;
  const dj = {
    ensure: async () => {}, forget: () => {},
    resolve: async (input) => [{ id: input, title: input, duration: 600, source: 'teste' }],
    fetchAudio: async (item) => { if (item.id === 'missing') throw new Error('indisponível'); if (item.id === 'slow') await new Promise(r => { pendingResolve = r; }); },
  };
  const server = createServer({ port: 17892, dataDir, dj, log: () => {} });
  const peers = [];
  try {
    await server.listen();
    async function peer(name) {
      const ws = new WebSocket('ws://127.0.0.1:17892'); ws.messages = []; peers.push(ws);
      ws.on('message', raw => ws.messages.push(JSON.parse(raw)));
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name })));
      const welcome = await until(() => ws.messages.find(m => m.t === 'welcome'), 'welcome');
      ws.id = welcome.id; ws.welcome = welcome; ws.sendJSON = m => ws.send(JSON.stringify(m)); return ws;
    }
    const a = await peer('Ana'), b = await peer('Beto'), c = await peer('Caio');
    assert.ok(a.welcome.features.includes('dm-ack'));
    a.sendJSON({ t: 'dm', requestId: 'dm-1', to: b.id, text: 'Só nós dois' });
    await until(() => b.messages.find(m => m.t === 'dm'), 'DM');
    assert.equal(a.messages.filter(m => m.t === 'dm').length, 1);
    assert.equal(c.messages.filter(m => m.t === 'dm').length, 0);
    assert.equal(b.messages.find(m => m.t === 'dm').msg.from, a.id);
    assert.equal((await until(()=>a.messages.find(m=>m.t==='command-result' && m.requestId==='dm-1'),'dm acknowledgement')).ok,true);
    a.sendJSON({t:'dm',requestId:'missing-dm',to:'offline',text:'cannot deliver'});
    assert.equal((await until(()=>a.messages.find(m=>m.requestId==='missing-dm'),'offline error')).ok,false);
    a.sendJSON({ t: 'signal', to: b.id, data: { watch: true, streamId: 'screen-1' } });
    const signal = await until(() => b.messages.find(m => m.t === 'signal'), 'subscription signal');
    assert.equal(signal.data.watch, true);
    for (const ws of [a, b]) ws.sendJSON({ t: 'state', voiceChannel: 'lobby' });
    a.sendJSON({ t: 'dj-summon', textChannel: 'geral' });
    await until(() => a.messages.find(m => m.t === 'dj' && m.dj.active), 'summon');
    const latestDJ = () => a.messages.filter(m => m.t === 'dj').at(-1)?.dj;
    a.sendJSON({ t: 'dj-add', input: 'first' });
    await until(() => latestDJ()?.current?.id === 'first', 'first song');
    a.sendJSON({ t: 'dj-add', input: 'second' });
    await until(() => latestDJ()?.queue.some(it => it.id === 'second'), 'queue');
    b.sendJSON({ t: 'dj-skip', requestId: 'skip-1' });
    await until(() => latestDJ()?.current?.id === 'second', 'skip without vote');
    assert.equal((await until(()=>b.messages.find(m=>m.requestId==='skip-1'),'skip acknowledgement')).ok,true);
    c.sendJSON({t:'dj-kick',requestId:'wrong-channel'});
    assert.equal((await until(()=>c.messages.find(m=>m.requestId==='wrong-channel'),'wrong channel error')).ok,false);
    a.sendJSON({ t: 'dj-add', input: 'remove-me' });
    await until(() => latestDJ()?.queue.some(it => it.id === 'remove-me'), 'queue remove');
    b.sendJSON({ t: 'dj-remove', id: 'remove-me' });
    await until(() => !latestDJ()?.queue.some(it => it.id === 'remove-me'), 'remove by friend');
    a.sendJSON({ t: 'dj-add', input: 'missing' });
    await until(() => latestDJ()?.queue.some(it => it.id === 'missing'), 'missing queued');
    b.sendJSON({ t: 'dj-skip' });
    await until(() => latestDJ()?.failed.some(it => it.id === 'missing'), 'failed retained');
    b.sendJSON({ t: 'dj-retry', id: 'missing' });
    await until(() => latestDJ()?.failed.some(it => it.id === 'missing') && !latestDJ().loading, 'retry result');
    a.sendJSON({ t: 'dj-add', input: 'slow' });
    await until(() => pendingResolve, 'slow download');
    b.sendJSON({ t: 'dj-kick' });
    await until(() => latestDJ()?.active === false, 'kick without vote');
    a.sendJSON({ t: 'dj-summon', textChannel: 'geral' });
    await until(() => latestDJ()?.active === true, 'summon again');
    pendingResolve(); await sleep(60);
    assert.equal(latestDJ().current, null, 'old download must not restart playback');
    const html = await (await fetch('http://127.0.0.1:17892/')).text();
    assert.match(html, /<base href="\/app\/">/);
    assert.match(html, /styles-stitch.css/);
    const clientAsset = await fetch('http://127.0.0.1:17892/app/client.js');
    assert.equal(clientAsset.status, 200);
    assert.equal(clientAsset.headers.get('cache-control'), 'no-cache', 'refresh web client after a host update');
    assert.equal((await fetch('http://127.0.0.1:17892/app/vendor/ns/rnnoise.wasm')).headers.get('content-type'), 'application/wasm');
    console.log('PASS: private routing, subscriptions, direct DJ controls, failed/retry, DJ race, web assets');
  } finally {
    for (const ws of peers) ws.terminate(); await server.close();
    // Leave test data in the OS temporary directory for inspection.
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
