const assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm'), path = require('path'), { EventEmitter } = require('events');
const { createStartupController, createStartupWindow } = require('../server/startup-launcher');
const defer = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function fixture(options = {}) {
  const events = [], counts = { open: 0, apply: 0, check: 0, ack: 0, prepare: 0 };
  let pending = options.pending || null, status = options.status || { phase: 'idle' };
  const manager = { info: { version: '1.5.2' }, channel: () => 'stable', status: () => status,
    pending: () => pending, acknowledge() { counts.ack++; if (options.status?.phase === 'error') pending = null; },
    async check(force) { counts.check++; counts.force = force; return options.check ? options.check() : { update: false }; },
    autoBlocked: version => !!options.blocked && version === options.blocked,
    async prepare() { counts.prepare++; return options.prepare ? options.prepare() : { ready: true }; } };
  const controller = createStartupController({ manager, version: '1.5.1', emit: s => events.push(s),
    open: () => counts.open++, apply: async () => { counts.apply++; if (options.apply) await options.apply(); }, timeoutMs: options.timeoutMs || 1000 });
  return { controller, manager, counts, events };
}
(async () => {
  let f = fixture(); await f.controller.start(); assert.equal(f.counts.open, 1); assert.equal(f.counts.apply, 0); await f.controller.start(); assert.equal(f.counts.open, 1);
  for (const response of [{ error: 'offline' }, { rateLimited: true, retryAt: 1 }, { retryAt: 1, reason: '503' }]) {
    f = fixture({ check: () => response }); await f.controller.start(); assert.equal(f.controller.current().phase, 'unavailable'); assert.equal(f.counts.open, 0); f.controller.openCurrent(); assert.equal(f.counts.open, 1);
  }
  f = fixture({ check: () => ({ update: true }) }); await f.controller.start(); assert.equal(f.counts.prepare, 1); assert.equal(f.counts.apply, 1); assert.equal(f.controller.canClose(), false); assert.equal(f.controller.openCurrent(), false);
  // Release without SHA256SUMS (still being published): never keep the person out of the app.
  f = fixture({ check: () => ({ update: true, manual: true, version: '1.5.2', page: 'https://github.com/x/releases/tag/v1.5.2' }) }); await f.controller.start(); assert.equal(f.controller.current().phase, 'unavailable'); assert(f.controller.current().canOpen && f.controller.current().offerDownload); assert.equal(f.counts.prepare, 0);
  f = fixture({ check: () => ({ update: true }), prepare: () => ({ ready: false, error: 'hash errado' }) }); await f.controller.start(); assert.equal(f.controller.current().phase, 'error'); assert.equal(f.counts.apply, 0);
  // Folder/permission/disk problems repeat on every attempt: open the installed version instead.
  f = fixture({ check: () => ({ update: true }), prepare: () => ({ ready: false, persistent: true, error: 'pasta protegida' }) }); await f.controller.start(); assert.equal(f.controller.current().phase, 'unavailable'); assert(f.controller.current().canOpen); assert.equal(f.controller.openCurrent(), true);
  // A version that already failed to install on this PC is not downloaded again at startup.
  f = fixture({ check: () => ({ update: true, version: '1.5.2' }), blocked: '1.5.2' }); await f.controller.start(); assert.equal(f.counts.prepare, 0); assert(f.controller.current().canOpen);
  // Helper failure: the prepared update cannot start; the installed version stays usable.
  f = fixture({ pending: { version: '1.5.2' }, apply: () => { throw Error('helper falhou'); } }); await f.controller.start(); assert.equal(f.controller.current().phase, 'unavailable'); assert(f.controller.canClose()); assert.equal(f.counts.check, 0); assert.equal(f.controller.openCurrent(), true);
  f = fixture({ pending: { version: '1.5.1' } }); await f.controller.start(); assert.equal(f.counts.open, 1); assert.equal(f.counts.ack, 0, 'new version must be acknowledged by main renderer, not splash');
  f = fixture({ pending: { version: '1.5.2' }, status: { phase: 'error', recovery: true, error: 'rollback' } }); await f.controller.start(); assert.equal(f.controller.current().phase, 'recovery'); assert.equal(f.counts.apply, 0); await f.controller.start(); assert.equal(f.counts.open, 1, 'retry may proceed after recovery notice');
  // A failed download leaves the manager in "error", but that is not a recovery screen: retry checks again.
  f = fixture({ status: { phase: 'error', error: 'download falhou' } }); await f.controller.start(); assert.notEqual(f.controller.current().phase, 'recovery'); assert.equal(f.counts.check, 1);
  for (const stage of ['check', 'prepare']) {
    const held = defer(); f = fixture({ check: () => stage === 'check' ? held.promise : { update: true }, prepare: () => stage === 'prepare' ? held.promise : { ready: true } });
    const run = f.controller.start(); await new Promise(r => setImmediate(r));
    assert.equal(f.controller.openCurrent(), false, 'cannot bypass checking or confirmed update through IPC');
    held.resolve(stage === 'check' ? { update: true } : { ready: true }); await run;
    assert.equal(f.counts.open, 0); assert.equal(f.counts.apply, 1);
  }
  let attempt = 0;
  f = fixture({ check: () => ++attempt === 1 ? { update: true } : { error: 'offline' }, prepare: () => ({ ready: false, error: 'hash errado' }) });
  await f.controller.start(); assert(f.controller.current().required); assert.equal(f.controller.openCurrent(), false);
  await f.controller.start(); assert.equal(f.controller.current().phase, 'unavailable'); assert.equal(f.controller.openCurrent(), false, 'network failure after known update cannot bypass gate');
  const held = defer(); f = fixture({ check: () => held.promise, timeoutMs: 10 }); await f.controller.start(); assert.equal(f.controller.current().phase, 'unavailable'); held.resolve({ update: true }); await new Promise(r => setImmediate(r)); assert.equal(f.counts.apply, 0);
  // "Tentar novamente" must reach the network even inside the 30-minute automatic backoff.
  f = fixture({ check: () => ({ error: 'offline' }) }); await f.controller.start({ force: true }); assert.equal(f.counts.force, true);
  f = fixture(); f.controller.progress({ phase: 'downloading', percent: 10, downloadedBytes: 10, totalBytes: 100 }); assert.equal(f.controller.current().downloadedBytes, 10); f.controller.dispose(); f.controller.progress({ phase: 'error' }); assert.equal(f.controller.current().phase, 'downloading');

  // Window close must block user closure during apply, but never veto app.quit after helper ACK.
  class Window extends EventEmitter { constructor(options) { super(); this.options = options; this.webContents = new EventEmitter(); Object.assign(this.webContents, { send() {}, setWindowOpenHandler() {} }); } isDestroyed() { return false; } loadFile() { return Promise.resolve(); } show() {} }
  const handlers = new Map(); let quitting = false, quitCalls = 0, downloads = []; f = fixture({ pending: { version: '1.5.2' } });
  const boot = createStartupWindow({ BrowserWindow: Window, ipcMain: { handle: (k, v) => handlers.set(k, v), removeHandler: k => handlers.delete(k) }, manager: f.manager, version: '1.5.1', open() {}, apply: async () => {}, download: page => downloads.push(page), quit: () => quitCalls++, isQuitting: () => quitting });
  const own = { sender: boot.window.webContents };
  f.manager.info.page = 'https://github.com/fgsecfem-dotcom/resenhagorilandia/releases/tag/v1.5.3';
  assert.equal(handlers.get('launcher:action')(own, 'download'), true); assert.equal(downloads.length, 1);
  for (const page of ['https://example.com/', 'https://github.com/fgsecfem-dotcom/resenhagorilandia/releases.evil/path']) {
    f.manager.info.page = page; assert.equal(handlers.get('launcher:action')(own, 'download'), false);
  }
  assert.equal(boot.window.options.width, 420); assert.equal(boot.window.options.height, 460); assert.equal(boot.window.options.webPreferences.sandbox, true);
  handlers.get('launcher:action')({ sender: {} }, 'open'); assert.equal(f.counts.open, 0); await boot.controller.start(); let prevented = false; boot.window.emit('close', { preventDefault: () => prevented = true }); assert(prevented); assert.equal(quitCalls, 0);
  quitting = true; prevented = false; boot.window.emit('close', { preventDefault: () => prevented = true }); assert.equal(prevented, false); boot.window.emit('closed'); assert.equal(handlers.size, 0);

  // Carrega o launcher.js num DOM falso; `store` simula o localStorage e `rooms` a lista que vem do main.
  const load = async (store = {}, rooms = []) => {
    const elements = new Map(), actions = [];
    const element = id => elements.get(id) || elements.set(id, { textContent: '', value: '', hidden: false, style: {}, attrs: {}, handlers: {}, classList: { toggle() {} }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
      addEventListener(type, fn) { this.handlers[type] = fn; }, append() {}, replaceChildren(...nodes) { this.children = nodes; } }).get(id);
    let render; const context = { document: { getElementById: element, createElement: () => ({ style: { setProperty() {} }, append() {} }), documentElement: { dataset: {} }, body: { dataset: {} } },
      window: { addEventListener() {}, launcherNative: { onState: fn => { render = fn; return () => {}; }, ready: async () => ({ phase: 'checking' }), action: (action, payload) => actions.push([action, payload]), rooms: async () => rooms } },
      localStorage: { getItem: key => key === 'resenha.settings' ? '{"theme":"arcLight"}' : (store[key] ?? null), setItem: (key, value) => { store[key] = value; } } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/launcher.js'), 'utf8'), context); await new Promise(r => setImmediate(r));
    return { element, context, actions, render };
  };
  const base = await load(), { element, context } = base, render = base.render;
  render({ phase: 'downloading', percent: 11, downloadedBytes: 18 * 1048576, totalBytes: 160 * 1048576, info: { version: '<test>' } }); assert.equal(element('percent').textContent, '11%'); assert.equal(element('bytes').textContent, '18 MB de 160 MB'); assert.equal(element('description').textContent, 'Transferindo o pacote <test>'); assert.equal(context.document.documentElement.dataset.theme, 'light');
  render({ phase: 'downloading', percent: 25, downloadedBytes: 10, totalBytes: null }); assert.equal(element('percent').textContent, ''); assert.equal(element('progress').attrs['aria-valuenow'], undefined);
  render({ phase: 'applying' }); assert(element('close').disabled && element('open').hidden); render({ phase: 'error', required: true, canOpen: false, error: 'hash incorreto' }); assert(element('open').hidden && !element('retry').hidden && !element('download').hidden); assert.equal(element('error').textContent, 'hash incorreto');
  render({ phase: 'checking' }); assert(element('open').hidden); render({ phase: 'unavailable', canOpen: true }); assert(!element('open').hidden && element('download').hidden);
  render({ phase: 'unavailable', canOpen: true, skipped: true, offerDownload: true }); assert(!element('open').hidden && !element('download').hidden); assert.equal(element('launcher-status').textContent, 'Não foi possível atualizar agora');
  // Hub: sem atualização, a fase "hub" mostra as salas (favorita primeiro, antigas fora) e passa a escolha ao main.
  const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
  const day = 864e5, nowMs = Date.now(), hubRooms = [{ code: 'AAAA1111', name: 'Velha', updatedAt: nowMs - 30 * day }, { code: 'BBBB2222', name: 'Favorita antiga', updatedAt: nowMs - 20 * day }, { code: 'CCCC3333', name: 'Nova', updatedAt: nowMs - 3600e3 }];
  let hub = await load({ 'resenha.favoriteRoom': '"BBBB2222"', 'resenha.whatsNewSeen': '"1.0.0"', 'resenha.profile': '{"name":"Felipe"}' }, hubRooms);
  hub.render({ phase: 'hub', version: '1.5.1', channel: 'stable', canOpen: true }); await new Promise(r => setImmediate(r));
  assert(!hub.element('hub').hidden && hub.element('status').hidden && hub.actions.length === 0);
  assert(/^(Bom dia|Boa tarde|Boa noite), Felipe$/.test(hub.element('hello').textContent));
  assert(!hub.element('notice').hidden && hub.element('notice-text').textContent === 'Novidades da versão 1.5.1');
  assert.equal(hub.element('rooms').children.length, 2); // a parada há 30 dias sai; a favorita fica mesmo antiga
  hub.element('rooms').children[0].onclick(); same(hub.actions.pop(), ['open', { type: 'room', code: 'BBBB2222' }]);
  hub.element('code').value = 'k7p4qx9m'; hub.element('code').handlers.input(); assert.equal(hub.element('code').value, 'K7P4-QX9M');
  hub.element('join-form').handlers.submit({ preventDefault() {} }); same(hub.actions.pop(), ['open', { type: 'join', code: 'K7P4QX9M' }]);
  hub.element('code').value = 'abc'; hub.element('join-form').handlers.submit({ preventDefault() {} }); assert.equal(hub.actions.length, 0); assert(hub.element('hub-error').textContent.includes('8 letras'));
  hub.element('host-go').onclick(); same(hub.actions.pop(), ['open', { type: 'host' }]);
  // "Abrir direto": entra sem mostrar o Hub; sem novidades pendentes não há aviso
  hub = await load({ 'resenha.skipHub': 'true', 'resenha.whatsNewSeen': '"1.5.1"' }); hub.render({ phase: 'hub', version: '1.5.1', channel: 'stable', canOpen: true });
  same(hub.actions, [['open', null]]);
  hub = await load({ 'resenha.whatsNewSeen': '"1.5.1"', 'resenha.hiddenRooms': 'lixo' }); hub.render({ phase: 'hub', version: '1.5.1', channel: 'stable', canOpen: true }); await new Promise(r => setImmediate(r)); assert(hub.element('notice').hidden); // valores salvos inválidos não quebram
  // Controlador: com hub ligado, "sem atualização" para no Hub e só abre quando a pessoa escolhe; a intenção chega ao open()
  const intents = []; let hubEvents = []; const hubManager = { info: {}, channel: () => 'stable', status: () => ({ phase: 'idle' }), pending: () => null, acknowledge() {}, check: async () => ({ update: false }) };
  const hubController = createStartupController({ manager: hubManager, version: '1.5.1', hub: true, emit: s => hubEvents.push(s), open: intent => intents.push(intent), apply: async () => {} });
  await hubController.start(); assert.equal(hubController.current().phase, 'hub'); assert.equal(hubController.current().canOpen, true); assert.equal(intents.length, 0);
  assert.equal(hubController.openCurrent({ type: 'join', code: 'K7P4QX9M' }), true); assert.deepEqual(intents, [{ type: 'join', code: 'K7P4QX9M' }]);
  const { sanitizeIntent, publicRooms } = require('../server/startup-launcher');
  assert.deepEqual(sanitizeIntent({ type: 'join', code: ' k7p4-qx9m ' }), { type: 'join', code: 'K7P4QX9M' }); assert.deepEqual(sanitizeIntent({ type: 'host', extra: 1 }), { type: 'host' });
  for (const bad of [null, 'x', { type: 'join' }, { type: 'join', code: 'curto' }, { type: 'join', code: '../../etc' }, { type: 'run', code: 'K7P4QX9M' }]) assert.equal(sanitizeIntent(bad), null);
  const listed = publicRooms([{ code: 'AAAA1111', name: 'X', updatedAt: 1, look: { color: '#abc' }, icon: 'data:image/png;base64,AA==', identitySecret: 'segredo', password: 'senha' }, { code: 'BBBB2222', name: 'Y', updatedAt: 2, look: { cover: 'https://exemplo.com/a.png', color: 'red;x' }, icon: 'http://x/y.png' }]);
  assert.deepEqual(listed.map(r => r.code), ['BBBB2222', 'AAAA1111']); assert.equal(listed[1].color, '#abc'); assert.equal(listed[0].color, ''); assert.equal(listed[0].cover, ''); assert.equal(listed[0].icon, ''); assert(!JSON.stringify(listed).includes('segredo') && !JSON.stringify(listed).includes('senha'));
  console.log('PASS: hub phase and intents, startup no-update, outage/rate-limit, preparation/hash failure, manual fallback, pending update, renderer-only ACK, recovery/retry, timeout/late replies, explicit open without restart, critical close guard, IPC isolation, real-byte rendering and unknown total');
})().catch(error => { console.error(error); process.exitCode = 1; });
