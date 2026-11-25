const assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
const code = source.slice(source.indexOf('async function openStoredRoom('), source.indexOf('// ---------------- Servidores:', source.indexOf('async function openStoredRoom(')));
const room = { code: 'TEST1234', name: 'Sala de teste', revision: 7, configuration: {} };
function fixture({ state, online = false, hold = false } = {}) {
  let resolveClaim;
  const count = { claim: 0, host: 0, join: 0, connect: 0 };
  const fields = { '#join-pass': { value: '' }, '#host-pass': { value: '' }, '#btn-join': {} };
  const timers = new Map(); let id = 0, status;
  const ctx = vm.createContext({
    native: { rooms: { claim: () => { count.claim++; return hold ? new Promise(r => { resolveClaim = r; }) : Promise.resolve({ state, snapshot: room }); } },
      startHost: async o => { count.host++; assert.equal(o.code, room.code); assert.equal(o.restore.revision, 7); assert(o.resume); return { ok: true, port: 7777, hostKey: 'key' }; } },
    S: {}, CID: 'B', checkName: () => true, $: s => fields[s], fmtCode: c => c, normCode: c => c,
    pendingRoomOpen: null, AbortController, endBoot() {},
    presenceCache: new Map(online ? [[room.code, { at: Date.now(), state: 'online' }]] : []), PRESENCE_TTL: 20000,
    setHomeStatus: (text, opts = {}) => { status = { text, ...opts }; },
    joinByCode: async c => { count.join++; assert.equal(c, room.code); }, connect: () => count.connect++, parseAddr: s => s, toast() {},
    setTimeout(fn, ms) { if (ms === 8000) timers.set(++id, fn); else queueMicrotask(fn); return id; },
    clearTimeout(timer) { timers.delete(timer); },
  });
  vm.runInContext(code, ctx);
  return { count, ctx, go: () => ctx.openStoredRoom(room), status: () => status,
    expire: () => { for (const run of [...timers.values()]) run(); }, resolve: state => resolveClaim({ state, snapshot: room }) };
}
(async () => {
  for (const state of ['won', 'lost', 'online', 'unknown', 'missing']) {
    const f = fixture({ state }); await f.go();
    assert.equal(f.count.host, state === 'won' ? 1 : 0);
    assert.equal(f.count.join, ['lost', 'online'].includes(state) ? 1 : 0);
    assert.equal(f.count.connect, state === 'won' ? 1 : 0);
    if (state === 'won') assert.equal(f.ctx.S.code, room.code);
    if (state === 'unknown') assert(f.status().note, 'incerteza não é falha confirmada');
    if (state === 'missing') assert(!f.status().note, 'cópia ausente é falha confirmada');
  }
  const online = fixture({ online: true }); await online.go();
  assert.equal(online.count.claim, 0); assert.equal(online.count.join, 1);
  const timed = fixture({ hold: true }); const first = timed.go();
  assert(timed.status().busy); timed.expire(); await first;
  assert.deepEqual(Array.from(timed.status().actions, a => a.label), ['Tentar de novo', 'Cancelar']);
  timed.resolve('won'); await Promise.resolve(); assert.equal(timed.count.host, 0);
  const retry = timed.status().actions[0].fn(); assert.equal(timed.count.claim, 2); timed.resolve('online'); await retry;
  assert.equal(timed.count.join, 1);
  const cancel = fixture({ hold: true }); const opening = cancel.go();
  cancel.status().actions.find(a => a.label === 'Cancelar').fn(); await opening;
  cancel.resolve('won'); await Promise.resolve(); assert.equal(cancel.count.host, 0);
  assert.equal(cancel.status().text, '');
  console.log('PASS: abertura rápida, retomada, incerteza, falha confirmada, limite, nova tentativa e cancelamento sem abrir tarde');
})().catch(e => { console.error(e); process.exitCode = 1; });
