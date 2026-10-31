// Ilha do Resenha (processo principal): janela transparente por cima do jogo, atalho de segurar e detecção do jogo.
// Tudo opcional: só roda com a ilha ligada nas configurações. Só Windows (o ajudante usa a API do sistema).
const path = require('path');
const { spawn } = require('child_process');
const { isGame, vkFor, validKey, place, snap, createHold } = require('./detect');

const POLL_MS = 1500, SHRINK_DELAY = 360, IDLE_DESTROY_MS = 20000;

function createOverlay({ app, BrowserWindow, globalShortcut, screen, ipcMain, getMain, isTest }) {
  const enabledPlatform = process.platform === 'win32';
  let cfg = { enabled: false, key: '`', mode: 'jogos', fullscreen: false, games: [], corner: 'tc', perGame: {}, opacity: 85, musicRest: 'sempre', reduceMotion: false, hintsLeft: 3 };
  let helper = null, helperReady = false, waiters = [], holdTimer = null, lastToggle = 0, ctlDuck = null;
  let win = null, fg = null, active = false, demo = false, demoTimer = null, registered = '', idleTimer = null, pollTimer = null, shrinkTimer = null;
  let size = { w: 0, h: 0 }, cache = {}, dragBase = null;

  // ---- ajudante do Windows ----
  function startHelper() {
    if (helper || !enabledPlatform) return;
    let p;
    try {
      p = helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'helper.ps1')], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch { helper = null; return; }
    let buf = ''; // cada processo tem o seu: o "exit" de um ajudante antigo não pode mexer no novo
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (d) => { if (helper !== p) return; buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); onLine(line); } });
    const gone = () => { if (helper !== p) return; helper = null; helperReady = false; waiters.splice(0).forEach((w) => w.fn(null)); hold.cancel(); };
    p.on('exit', gone); p.on('error', gone);
    ask('ping', (l) => { if (helper === p) helperReady = l === 'pong'; });
  }
  function stopHelper() { const p = helper; helper = null; helperReady = false; waiters.splice(0).forEach((w) => w.fn(null)); try { p?.stdin.end(); p?.kill(); } catch {} }
  function onLine(line) {
    const i = waiters.findIndex((w) => w.test(line));
    if (i >= 0) waiters.splice(i, 1)[0].fn(line);
  }
  function ask(cmd, fn, expect) {
    if (!helper) return fn(null);
    const prefix = expect || cmd.split(' ')[0];
    const test = prefix === 'w' ? (l) => l === 'up' : prefix === 'ping' ? (l) => l === 'pong' : (l) => l.startsWith(prefix + '|');
    const w = { test, fn }; waiters.push(w);
    try { helper.stdin.write(cmd + '\n'); } catch { waiters.splice(waiters.indexOf(w), 1); fn(null); }
  }

  // ---- atalho de segurar ----
  const hold = createHold({
    tolerance: 300,
    watch: () => {
      const vk = vkFor(cfg.key);
      if (!helperReady || vk == null) return; // sem o ajudante: alternar (ver press)
      ask('w ' + vk, () => hold.released());
    },
    onHold: () => { setInteractive(true); clearTimeout(holdTimer); holdTimer = setTimeout(() => hold.cancel(), 35000); toWin({ k: 'hold' }); emit({ type: 'hold' }); }, // 35 s: rede de segurança contra tecla presa
    onRelease: () => { clearTimeout(holdTimer); setInteractive(false); toWin({ k: 'release' }); emit({ type: 'release' }); },
  });
  let toggleTimer = null;
  function onKey() {
    if (!win) return;
    if (!helperReady) { // plano B (demo sem ajudante): aperta uma vez abre, aperta de novo fecha; ignora a repetição da tecla segurada
      const now = Date.now(); if (now - lastToggle < 250) { lastToggle = now; return; } lastToggle = now;
      clearTimeout(toggleTimer);
      if (hold.holding) return hold.cancel();
      hold.press(); toggleTimer = setTimeout(() => hold.cancel(), 8000); return;
    }
    hold.press();
  }

  // ---- janela ----
  function emit(ev) { const m = getMain(); if (m && !m.isDestroyed()) m.webContents.send('overlay:event', ev); }
  function toWin(msg) { if (msg.k !== 'hold' && msg.k !== 'release') cache[msg.k] = msg; if (win && !win.isDestroyed()) win.webContents.send('overlay:msg', msg); }
  function setInteractive(on) {
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(!on, { forward: false });
  }
  function displayArea() {
    const rect = fg && fg.rect;
    try {
      if (rect && !demo) { const d = screen.screenToDipRect(null, { x: rect.l, y: rect.t, width: rect.r - rect.l, height: rect.b - rect.t }); return screen.getDisplayMatching(d).bounds; }
      const m = getMain(); if (m && !m.isDestroyed()) return screen.getDisplayMatching(m.getBounds()).bounds;
    } catch {}
    return screen.getPrimaryDisplay().bounds;
  }
  const gameKey = () => (fg && fg.name) || '';
  const anchorNow = () => (cfg.perGame && cfg.perGame[gameKey()]) || cfg.corner || 'tc';
  function reposition(immediate) {
    if (!win || win.isDestroyed()) return;
    if (size.w < 2 || size.h < 2) { if (win.isVisible()) win.hide(); return; }
    const b = place(anchorNow(), size, displayArea());
    clearTimeout(shrinkTimer);
    const cur = win.getBounds(), grows = b.width >= cur.width && b.height >= cur.height;
    const apply = () => { if (win && !win.isDestroyed()) win.setBounds(b, false); };
    if (immediate || grows || !win.isVisible()) apply(); else shrinkTimer = setTimeout(apply, SHRINK_DELAY);
    if (!win.isVisible()) win.showInactive();
  }
  function ensureWindow() {
    clearTimeout(idleTimer); idleTimer = null;
    if (win && !win.isDestroyed()) return;
    win = new BrowserWindow({
      width: 10, height: 10, x: -100, y: -100, show: false, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
      focusable: false, hasShadow: false, alwaysOnTop: true, fullscreenable: false, backgroundColor: '#00000000',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true, { forward: false });
    win.loadFile(path.join(__dirname, 'index.html'));
    win.webContents.on('did-finish-load', () => {
      toWin({ k: 'cfg', cfg: publicCfg() }); toWin({ k: 'anchor', a: anchorNow() });
      for (const m of Object.values(cache)) if (m.k !== 'cfg') win.webContents.send('overlay:msg', m);
    });
    win.on('closed', () => { win = null; size = { w: 0, h: 0 }; });
  }
  function destroyWindow() { clearTimeout(idleTimer); idleTimer = null; hold.cancel(); if (win && !win.isDestroyed()) win.destroy(); win = null; size = { w: 0, h: 0 }; }
  const publicCfg = () => ({ musicRest: cfg.musicRest, opacity: cfg.opacity, reduceMotion: cfg.reduceMotion, hintsLeft: cfg.hintsLeft, demo });

  // ---- decisão: mostrar ou não ----
  function register(on) {
    const want = on && validKey(cfg.key) ? cfg.key : '';
    if (registered === want) return;
    if (registered) { try { globalShortcut.unregister(registered); } catch {} registered = ''; }
    if (want) { try { if (globalShortcut.register(want, onKey)) registered = want; } catch {} }
  }
  function decide() {
    const prev = active;
    const self = !!(fg && (fg.self || /^(resenha|electron)\.exe$/.test(fg.name || '')));
    active = demo || (cfg.enabled && !!fg && !self && isGame({ exe: fg.exe, fs: fg.fs }, cfg));
    // O atalho só existe enquanto a ilha está ativa: fora do jogo, a tecla volta a funcionar normalmente (digitar ' etc.).
    register(active);
    if (active) { ensureWindow(); reposition(); }
    else if (prev && !idleTimer) { hold.cancel(); if (win && !win.isDestroyed()) win.hide(); idleTimer = setTimeout(destroyWindow, IDLE_DESTROY_MS); }
    if (prev !== active) emit({ type: 'active', active, game: gameKey() });
  }
  function poll() {
    if (!cfg.enabled && !demo) return;
    if (!helper) startHelper(); // se o ajudante morreu, sobe de novo; enquanto isso a ilha fica inativa (e a tecla livre)
    ask('fg', (l) => {
      if (!l) fg = null;
      else {
        const p = l.slice(3).split('|'); // pid|fs|l|t|r|b|exe|title
        const exe = p[6] || '';
        fg = { pid: +p[0], fs: p[1] === '1', rect: { l: +p[2], t: +p[3], r: +p[4], b: +p[5] }, exe, name: exe.split('\\').pop().toLowerCase(), title: p.slice(7).join('|'), self: +p[0] === process.pid };
      }
      decide();
    });
  }
  function startPolling() { if (pollTimer || !enabledPlatform) return; startHelper(); poll(); pollTimer = setInterval(poll, POLL_MS); }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }
  function applyEnabled() {
    if (cfg.enabled && enabledPlatform && !isTest) startPolling();
    else if (!demo) { stopPolling(); register(false); active = false; destroyWindow(); stopHelper(); }
  }

  // ---- IPC ---- (cada canal só aceita quem deve: a janela do app ou a própria ilha)
  const fromMain = (e) => { const m = getMain(); return !!m && !m.isDestroyed() && e.sender === m.webContents; };
  const fromIsland = (e) => !!win && !win.isDestroyed() && e.sender === win.webContents;
  ipcMain.handle('overlay:config', (e, next) => {
    const wasKey = cfg.key;
    if (!fromMain(e)) return { supported: false };
    cfg = { ...cfg, ...(next || {}) };
    cfg.games = (Array.isArray(cfg.games) ? cfg.games : []).map((g) => String(g).toLowerCase()).slice(0, 200);
    if (!validKey(cfg.key)) cfg.key = wasKey;
    if (!enabledPlatform) return { supported: false };
    toWin({ k: 'cfg', cfg: publicCfg() });
    applyEnabled(); register(active); if (active) reposition(true);
    return { supported: true, helper: helperReady };
  });
  ipcMain.handle('overlay:state', (e) => !fromMain(e) ? {} : ({ supported: enabledPlatform, helper: helperReady, active, game: gameKey(), registered: !!registered }));
  ipcMain.handle('overlay:procs', (e) => new Promise((res) => {
    if (!fromMain(e)) return res([]);
    const was = !!helper; if (!was) startHelper();
    ask('procs', (l) => { if (!was && !cfg.enabled) stopHelper(); res(l ? l.slice(6).split('\u0002').filter(Boolean).map((r) => { const [name, exe, title] = r.split('\u0001'); return { name, exe, title }; })
      .filter((r) => !/^(resenha|electron)\.exe$/i.test(r.name)) : []); });
  }));
  ipcMain.handle('overlay:demo', (e, on) => {
    if (!fromMain(e)) return false;
    clearTimeout(demoTimer);
    demo = !!on;
    if (demo) { startHelper(); demoTimer = setTimeout(() => { demo = false; applyEnabled(); decide(); emit({ type: 'demo-end' }); }, 5 * 60 * 1000); ensureWindow(); decide(); }
    else { hold.cancel(); decide(); applyEnabled(); }
    toWin({ k: 'cfg', cfg: publicCfg() });
    return true;
  });
  ipcMain.on('overlay:push', (e, msg) => { if (fromMain(e) && msg && typeof msg.k === 'string') toWin(msg); });
  ipcMain.on('overlay:size', (e, s) => {
    if (!s || !fromIsland(e)) return; size = { w: Math.ceil(Math.max(0, Math.min(+s.w || 0, 600))), h: Math.ceil(Math.max(0, Math.min(+s.h || 0, 800))) };
    if (win && !win.isDestroyed() && (active || demo) && !dragBase) reposition(); // durante o arrasto quem manda é o mouse
  });
  ipcMain.on('overlay:action', (e, a) => { if (!fromIsland(e) || (demo && (!a || a.k !== 'event'))) return; const m = getMain(); if (m && !m.isDestroyed()) m.webContents.send('overlay:action', a); });
  ipcMain.on('overlay:drag', (e, d) => {
    if (!win || win.isDestroyed() || !d || !fromIsland(e)) return;
    const area = displayArea();
    if (d.phase === 'start') { dragBase = win.getBounds(); return; }
    if (!dragBase) return;
    if (d.phase === 'move') { win.setPosition(Math.round(dragBase.x + d.dx), Math.round(dragBase.y + d.dy), false); return; }
    if (d.phase === 'end') {
      const b = win.getBounds(), a = snap({ x: b.x + b.width / 2, y: b.y + (b.y > area.y + area.height / 2 ? b.height : 0) }, { x: area.x, y: area.y, width: area.width, height: area.height });
      dragBase = null;
      const key = gameKey();
      if (key && !demo) cfg.perGame = { ...cfg.perGame, [key]: a }; else cfg.corner = a;
      toWin({ k: 'anchor', a }); reposition(true);
      emit({ type: 'moved', game: demo ? '' : key, corner: a });
    }
  });

  return { syncHotkey: () => { registered = ''; register(active); }, dispose: () => { stopPolling(); register(false); [demoTimer, toggleTimer, shrinkTimer, holdTimer, idleTimer].forEach(clearTimeout); destroyWindow(); stopHelper(); }, isActive: () => active };
}

module.exports = { createOverlay };
