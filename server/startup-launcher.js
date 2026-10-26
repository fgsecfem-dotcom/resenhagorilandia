const path = require('path');
const { newer, REPO } = require('../updater');

// Startup only: reuse the installed updater's channel, SHA, staging and rollback.
// A confirmed update gates entry while it can still succeed. Offline checks, rollback recovery
// and updates that cannot be installed on this PC allow the installed app.
function createStartupController({ manager, version, check = force => manager.check(force), emit, open, apply, timeoutMs = 10000 }) {
  let active = true, running = false, recoveryShown = false, required = false, generation = 0, state = { phase: 'checking' };
  const publish = next => { state = { ...next, version, channel: manager.channel(), required,
    canOpen: !required && ['opening', 'unavailable', 'recovery'].includes(next.phase) }; emit(state); };
  const current = () => state;
  function openCurrent() {
    if (!active || required || !['opening', 'unavailable', 'recovery'].includes(state.phase)) return false;
    active = false; generation++; publish({ phase: 'opening' }); open(); return true;
  }
  const fail = error => publish({ phase: 'error', error: String(error?.message || error), info: manager.info });
  // The update cannot be installed automatically here; never keep the person out of the app for it.
  const skip = (error, info = manager.info) => { required = false; publish({ phase: 'unavailable', skipped: true, offerDownload: !!info?.page, error, info }); };
  async function applyPrepared() {
    if (!active) return;
    const info = manager.pending()?.info || manager.info;
    publish({ phase: 'applying', info });
    try { await apply(); } catch (error) { if (active) skip(String(error?.message || error), info); }
  }
  async function start({ force = false } = {}) {
    if (!active || running) return;
    running = true; const token = ++generation;
    try {
      const pending = manager.pending();
      // Let the main renderer acknowledge the new build after its five-second health check.
      if (pending?.version === version) { publish({ phase: 'opening' }); openCurrent(); return; }
      manager.acknowledge();
      const previous = manager.status();
      // Only a failed install reported by the helper is a recovery; a failed download is retried.
      if (previous.phase === 'error' && previous.recovery && !recoveryShown) { recoveryShown = true; publish({ phase: 'recovery', error: previous.error }); return; }
      const prepared = manager.pending();
      if (prepared && newer(prepared.version, version)) { required = true; await applyPrepared(); return; }
      publish({ phase: 'checking' });
      let timer;
      const result = await Promise.race([
        Promise.resolve().then(() => check(force)).finally(() => clearTimeout(timer)),
        new Promise(resolve => { timer = setTimeout(() => resolve({ update: false, error: 'A verificação demorou mais que o esperado.' }), timeoutMs); })
      ]);
      clearTimeout(timer);
      if (!active || token !== generation) return;
      if (!result.update) {
        if (result.error || result.rateLimited || result.retryAt) publish({ phase: 'unavailable', error: result.reason || result.error });
        else { required = false; publish({ phase: 'opening' }); openCurrent(); }
        return;
      }
      // A release still being published (no SHA256SUMS yet) or one that already failed on this PC.
      if (result.manual) { skip('A nova versão ainda não está pronta para atualização automática.', result); return; }
      if (manager.autoBlocked?.(result.version)) { skip('A atualização automática não funcionou neste computador.', result); return; }
      required = true;
      const outcome = await manager.prepare();
      if (!active || token !== generation) return;
      if (outcome.ready) await applyPrepared();
      else if (outcome.persistent) skip(outcome.error, manager.info || result);
      else fail(outcome.error || 'Não foi possível preparar a atualização.');
    } catch (error) { if (active && token === generation) fail(error); }
    finally { running = false; }
  }
  function progress(next) {
    if (active && state.phase !== 'applying' && ['downloading', 'verifying', 'extracting', 'error'].includes(next.phase)) {
      if (['downloading', 'verifying', 'extracting'].includes(next.phase)) required = true;
      publish(next);
    }
  }
  function dispose() { active = false; generation++; }
  return { start, current, openCurrent, progress, dispose, canClose: () => state.phase !== 'applying' };
}

function createStartupWindow({ BrowserWindow, ipcMain, manager, version, icon, open, apply, quit, check, download = () => {}, isQuitting = () => false, log = () => {} }) {
  const window = new BrowserWindow({ width: 420, height: 460, useContentSize: true, resizable: false,
    maximizable: false, fullscreenable: false, frame: false, show: false, title: 'Resenha', icon,
    transparent: true, backgroundColor: '#00000000', // cantos arredondados de verdade: só o cartão aparece
    webPreferences: { preload: path.join(__dirname, '../app/launcher-preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  const controller = createStartupController({ manager, version, check,
    emit: state => { if (!window.isDestroyed()) window.webContents.send('launcher:state', state); log('launcher-state', { phase: state.phase }); },
    open, apply });
  const fromLauncher = event => event.sender === window.webContents && !window.isDestroyed();
  ipcMain.handle('launcher:ready', event => { if (!fromLauncher(event)) return; controller.start(); return { ...controller.current(), version, channel: manager.channel() }; });
  ipcMain.handle('launcher:action', (event, action) => {
    if (!fromLauncher(event)) return;
    if (action === 'open') return controller.openCurrent();
    if (action === 'download') { const page = controller.current().info?.page || manager.info?.page;
      if (page === 'https://github.com/' + REPO + '/releases' || page?.startsWith('https://github.com/' + REPO + '/releases/')) { download(page); return true; } return false; }
    if (action === 'retry') { controller.start({ force: true }); return true; }
    if (action === 'close') { if (controller.canClose()) { controller.dispose(); quit(); } return controller.canClose(); }
  });
  window.on('close', event => { if (isQuitting()) return; event.preventDefault(); if (controller.canClose()) { controller.dispose(); quit(); } });
  window.on('closed', () => { controller.dispose(); for (const name of ['launcher:ready', 'launcher:action']) ipcMain.removeHandler(name); });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('render-process-gone', () => { log('launcher-renderer-error'); if (!controller.openCurrent()) quit(); });
  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, '../app/launcher.html')).catch(error => { log('launcher-load-error', { error: error.message }); if (!controller.openCurrent()) quit(); });
  return { window, controller, progress: controller.progress };
}
module.exports = { createStartupController, createStartupWindow };
