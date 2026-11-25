const assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
const code = source.slice(source.indexOf('async function openStoredRoom('), source.indexOf('// ---------------- Servidores:', source.indexOf('async function openStoredRoom(')));
const room = { code: 'TEST1234', name: 'Sala de teste', revision: 7, configuration: {} };
function fixture({ state, online = false, hold = false, savedRoom = room, expectedPassword = "" } = {}) {
  let resolveClaim;
  const count = { claim: 0, host: 0, join: 0, connect: 0, prompts: 0 };
  const fields = { '#join-pass': { value: '' }, '#host-pass': { value: '' }, '#btn-join': {} };
  const timers = new Map(); let id = 0, status;
  const ctx = vm.createContext({
    native: { rooms: { claim: () => { count.claim++; return hold ? new Promise(r => { resolveClaim = r; }) : Promise.resolve({ state, snapshot: savedRoom }); } },
      startHost: async o => { count.host++; assert.equal(o.code, room.code); assert.equal(o.restore.revision, 7); assert(o.resume); assert.equal(o.password, expectedPassword); return { ok: true, port: 7777, hostKey: 'key' }; } },
    S: {}, CID: 'B', checkName: () => true, $: s => fields[s], fmtCode: c => c, normCode: c => c,
    pendingRoomOpen: null, AbortController, endBoot() {}, promptModal: async () => { count.prompts++; return { value: 'senha do teste' }; },
    presenceCache: new Map(online ? [[room.code, { at: Date.now(), state: 'online' }]] : []), PRESENCE_TTL: 20000,
    setHomeStatus: (text, opts = {}) => { status = { text, ...opts }; },
    joinByCode: async c => { count.join++; assert.equal(c, room.code); }, connect: () => count.connect++, parseAddr: s => s, toast() {},
    setTimeout(fn, ms) { if (ms === 8000) timers.set(++id, fn); else queueMicrotask(fn); return id; },
    clearTimeout(timer) { timers.delete(timer); },
  });
  vm.runInContext(code, ctx);
  return { count, ctx, go: () => ctx.openStoredRoom(savedRoom), status: () => status,
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
  const protectedRoom = { ...room, configuration: { needsPassword: true } };
  const protectedOpen = fixture({ state: 'online', savedRoom: protectedRoom }); await protectedOpen.go();
  assert.equal(protectedOpen.count.prompts, 0, 'sala online usa o fluxo normal de senha ao entrar');
  const protectedResume = fixture({ state: 'won', savedRoom: protectedRoom, expectedPassword: 'senha do teste' }); await protectedResume.go();
  assert.equal(protectedResume.count.prompts, 1); assert.equal(protectedResume.count.connect, 1);
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
  const firstTips = fs.readFileSync(require.resolve('../app/first-tips.js'), 'utf8');
  const saved = new Map(), intervals = new Set(), mounted = new Set();
  const rect = { left: 80, top: 180, bottom: 220, right: 120, width: 40, height: 40 };
  const anchor = { getBoundingClientRect: () => rect };
  const ctx = vm.createContext({ window: {}, innerWidth: 800, innerHeight: 600,
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    document: { visibilityState: 'visible', querySelector: sel => sel === '#main:not(.hidden)' ? anchor : null,
      querySelectorAll: sel => ['[data-join]', '#btn-invite', 'button.live-join'].some(token => sel.includes(token)) ? [anchor] : [],
      createElement() { const parts = new Map(); return { offsetWidth: 240, offsetHeight: 120, dataset: {}, style: { setProperty() {} }, setAttribute() {}, remove() { mounted.delete(this); }, querySelector: sel => parts.get(sel) || (parts.set(sel, {}), parts.get(sel)) }; },
      body: { append(el) { mounted.add(el); } } },
    setInterval(fn) { intervals.add(fn); return fn; }, clearInterval(fn) { intervals.delete(fn); },
  });
  vm.runInContext(firstTips, ctx);
  const guide = ctx.window.FirstTips, tick = () => { for (const next of intervals) next(); };
  const tip = () => [...mounted][0];
  guide.arm(); tick(); assert.equal(mounted.size, 0, 'não repete para perfis antigos');
  guide.prepare(); guide.arm(); tick(); assert.equal(mounted.size, 1);
  const titles = [];
  for (let i = 0; i < 3; i++) {
    assert.equal(mounted.size, 1); titles.push(tip().querySelector('b').textContent);
    if (i === 2) assert.equal(tip().dataset.side, 'right', 'a última dica aponta para o botão real da live');
    tip().querySelector('button').onclick(); tick();
  }
  assert.deepEqual(titles, ['Entre na call', 'Chame a galera', 'Assista à live']);
  guide.prepare(); guide.arm(); tick(); assert.equal(mounted.size, 0); assert.equal(intervals.size, 0);
  console.log('PASS: abertura rápida, retomada, incerteza, falha confirmada, limite, nova tentativa e cancelamento sem abrir tarde');
})().catch(e => { console.error(e); process.exitCode = 1; });
