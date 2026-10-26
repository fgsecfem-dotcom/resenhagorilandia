const { createAttachmentCache } = require('./server/attachment-cache');
const { createMobileInvite } = require('./server/mobile-invite');
const { createRoomHandlers } = require('./server/room-handlers');
const { app, BrowserWindow, ipcMain, desktopCapturer, session, shell, globalShortcut, Notification, nativeImage, Menu, Tray, systemPreferences, dialog } = require('electron');
const IS_MAC = process.platform === 'darwin';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createServer } = require('./server');
const { DJTools } = require('./server/dj');
const net = require('./net-tools');
const Turn = require('node-turn');
const { Tunnel } = require('./tunnel-main');
const updater = require('./updater');
const {UpdateManager,busy:updateBusy}=require('./update-manager');
const { createStartupWindow } = require('./server/startup-launcher');
const {RoomStore,makeSnapshot,roomIdFor,atomic,backup,norm}=require('./room-state');
const { mobileTLS } = require('./mobile-tls');
const QRCode = require('qrcode');
const { capturePolicy } = require('./capture-policy');
const os = require('os');
let tunnel = null;

// Perfil separado (útil para testar 2 instâncias no mesmo PC): Resenha.exe --profile=teste
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
if (profileArg) app.setPath('userData', path.join(app.getPath('appData'), 'Resenha-' + profileArg.split('=')[1]));
const TEST_MODE = !!profileArg;
// Pasta de dados do Resenha (salas, configurações, logs): continua no AppData de sempre.
const DATA_DIR = app.getPath('userData');
// No Windows, a pasta interna do navegador (onde o Widevine do Spotify é instalado) fica fora do AppData:
// com o Widevine dentro do AppData o Spotify recusa a licença e a música trava em 10 s (testado em 24/10/2026).
// localStorage, cookies e cache continuam na pasta de sempre (sessionData), então nada se perde.
if (process.platform === 'win32') {
  try {
    const base = path.join(require('os').homedir(), '.resenha' + (profileArg ? '-' + profileArg.split('=')[1] : ''));
    fs.mkdirSync(path.join(base, 'navegador'), { recursive: true });
    try { require('child_process').execFile('attrib', ['+h', base], { windowsHide: true }, () => {}); } catch {}
    app.setPath('userData', path.join(base, 'navegador'));
    app.setPath('sessionData', DATA_DIR);
  } catch { /* sem a pasta nova, tudo continua no AppData (o Spotify pode não tocar) */ }
}
const roomStore=new RoomStore(DATA_DIR);
const roomFoldersFile=path.join(DATA_DIR,'room-folders.json');
let roomFolders={};try{roomFolders=JSON.parse(fs.readFileSync(roomFoldersFile,'utf8'))}catch{}
const windowPrefsFile=path.join(DATA_DIR,'window-preferences.json');
let keepHostOnline=false;try{keepHostOnline=!!JSON.parse(fs.readFileSync(windowPrefsFile,'utf8')).keepHostOnline}catch{}

const capturePrefsFile = path.join(DATA_DIR, 'capture-preferences.json');
const captureStateFile = path.join(DATA_DIR, 'capture-state.json');
let capturePrefs = {}, previousCapture = {};
try { capturePrefs = JSON.parse(fs.readFileSync(capturePrefsFile, 'utf8')); } catch {}
try { previousCapture = JSON.parse(fs.readFileSync(captureStateFile, 'utf8')); } catch {}
const recoveredCapture = !!previousCapture.active;
const compatibility = process.argv.includes('--compatibility') || !!capturePrefs.compatibility || recoveredCapture;
if (compatibility) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-accelerated-video-encode');
  app.commandLine.appendSwitch('disable-accelerated-video-decode');
}
// R6: no Windows a janela é transparente e sem moldura nativa, para os cantos externos acompanharem os painéis.
// Fica de fora no modo compatibilidade (sem aceleração) e com --square-window, como saída de emergência.
const ROUNDED_WIN = process.platform === 'win32' && !compatibility && !process.argv.includes('--square-window');
const captureConfig = capturePolicy({ platform: process.platform, release: os.release(), compatibility });
let captureActive = false, captureFailed = false;
function recordCapture(event, detail = {}) {
  try {
    const dir = DATA_DIR; fs.mkdirSync(dir, { recursive: true });
    const log = path.join(dir, 'capture-diagnostics.jsonl');
    if (fs.existsSync(log) && fs.statSync(log).size > 512 * 1024) fs.renameSync(log, log + '.previous');
    fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), event, ...detail }) + '\n');
  } catch {}
}
function setCaptureState(active, detail = {}) {
  captureActive = !!active;
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(captureStateFile, JSON.stringify({ active: captureActive, ...detail })); } catch {}
  recordCapture(active ? 'capture-active' : 'capture-stopped', detail);
}
app.on('child-process-gone', (event, detail) => {
  recordCapture('child-process-gone', { type: detail.type, reason: detail.reason, exitCode: detail.exitCode });
  if (captureActive && ['GPU', 'Utility'].includes(detail.type) && !['clean-exit', 'killed'].includes(detail.reason)) { captureFailed = true; win?.webContents.send('capture:failure', 'Um processo de captura falhou. A transmissão foi encerrada. Ative o modo de compatibilidade.'); }
});

// Só uma janela do Resenha por vez (abrir de novo traz a que está na bandeja)
if (!TEST_MODE && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

app.commandLine.appendSwitch('enable-features', 'WebRtcAllowInputVolumeAdjustment');
// Mostra os IPs reais nos candidatos WebRTC (senão o Chrome esconde atrás de nomes .local e LAN/Radmin falha)
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
// Identidade do app no Windows (barra de tarefas, atalhos, avisos). Rodando fora do pacote (testes), usa outra: senão o Windows
// cria um atalho "Electron" com a mesma identidade e passa a mostrar o átomo do Electron no Resenha instalado.
const APP_ID = app.isPackaged ? 'com.lucas.resenha' : 'com.lucas.resenha.dev';
app.setAppUserModelId(APP_ID);

let win = null;
let tray = null;
let startupLauncher = null, startupOpenedCurrent = false, launchIntent = null;
// O Hub do launcher guarda o que a pessoa escolheu; o app pega uma vez ao iniciar.
ipcMain.handle('launch:intent', () => { const intent = launchIntent; launchIntent = null; return intent; });
let quitting = false;
let updateVoice={}, updateQuitSafe=true;
const updateManager=new UpdateManager({userData:DATA_DIR,appDir:path.dirname(process.execPath),version:app.getVersion(),log:recordCapture,progress:status=>{win?.webContents.send('update:progress',status);startupLauncher?.progress(status);}});
const updatePendingAtStartup=!!updateManager.pending();
const activeForUpdate=()=>({inVoice:!!updateVoice.inVoice,transmitting:captureActive,hostingWithPeople:!!host&&host.server.clientCount()>1});
let host = null; // { server, mapper, port, hostKey, turn }
let pendingShare = null; // { id, audio }
let djTools = null;
const unpackedIcons = path.join(process.resourcesPath, 'app.asar.unpacked', 'app');
const iconDirectory = app.isPackaged && fs.existsSync(unpackedIcons) ? unpackedIcons : path.join(__dirname, 'app');
const ICON = path.join(iconDirectory, 'icon.png');
// Ícone escolhido em Configurações > Aparência (variações da Pipoquinha). Fica em userData/icone; sem escolha, usa o padrão.
const userIconDir = path.join(DATA_DIR, 'icone');
function currentIcon() {
  try { const c = JSON.parse(fs.readFileSync(path.join(userIconDir, 'escolha.json'), 'utf8')); if (fs.existsSync(c.ico) && fs.existsSync(c.png)) return c; } catch {}
  return { key: 'quentinha', ico: path.join(iconDirectory, 'taskbar-pipoquinha.ico'), png: ICON };
}
const ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
function buildIco(pngs) { // ICO com entradas PNG (aceito desde o Windows Vista)
  const head = Buffer.alloc(6 + 16 * pngs.length); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(([s, b], i) => { const e = 6 + 16 * i; head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(b.length, e + 8); head.writeUInt32LE(offset, e + 12); offset += b.length; });
  return Buffer.concat([head, ...pngs.map(([, b]) => b)]);
}

function showWindow() { if (!win) { const opening=startupLauncher?.window;if(opening&&!opening.isDestroyed()){opening.show();opening.focus();}return; } if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function createWindow() {
  // No Mac sem menu não funciona Cmd+C/V/Q; então deixa um menu mínimo
  if (IS_MAC) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Resenha', submenu: [{ role: 'about', label: 'Sobre o Resenha' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar Resenha' }, { type: 'separator' }, { label: 'Sair do Resenha', accelerator: 'Cmd+Q', click: () => { quitting = true; app.quit(); } }] },
      { label: 'Editar', submenu: [{ role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' }] },
      { label: 'Janela', submenu: [{ role: 'minimize', label: 'Minimizar' }, { role: 'zoom', label: 'Zoom' }, { role: 'close', label: 'Fechar janela' }] },
    ]));
  } else Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1400, height: 860, minWidth: 980, minHeight: 600,
    show: !startupLauncher,
    backgroundColor: ROUNDED_WIN ? '#00000000' : '#f4f0ea', title: 'Resenha', icon: ICON,
    titleBarStyle: 'hidden',
    ...(ROUNDED_WIN ? { frame: false, transparent: true } : {}),
    // Windows/Linux draw their own macOS-style window buttons in #win-controls (index.html).
    ...(IS_MAC ? { trafficLightPosition: { x: 10, y: 8 } } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), ...(ROUNDED_WIN ? { additionalArguments: ['--resenha-round-window'] } : {}), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false },
  });
  if (process.platform === 'win32') {
    win.setIcon(nativeImage.createFromPath(currentIcon().png));
    win.setAppDetails({
      appId: APP_ID,
      // New file name per icon design: Windows caches taskbar icons by path.
      appIconPath: currentIcon().ico,
      appIconIndex: 0,
      ...(app.isPackaged ? { relaunchCommand: '"' + process.execPath + '"', relaunchDisplayName: 'Resenha' } : {}),
    });
  }
  if (IS_MAC) app.dock?.setIcon(currentIcon().png);
  win.once('ready-to-show',()=>{win.show();const splash=startupLauncher?.window;startupLauncher?.controller.dispose();if(splash&&!splash.isDestroyed())splash.destroy();});
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools();
    if (input.type === 'keyDown' && (input.control || input.meta) && input.key.toLowerCase() === 'r') { e.preventDefault(); }
  });
  win.on('focus', () => win.flashFrame(false));
  const sendVisibility = () => win.webContents.send('window:visible', win.isVisible() && !win.isMinimized());
  for (const event of ['minimize', 'restore', 'hide', 'show']) win.on(event, sendVisibility);
  const sendMaximized = () => win.webContents.send('window:maximized', win.isMaximized());
  for (const event of ['maximize', 'unmaximize']) win.on(event, sendMaximized);
  win.webContents.on('did-finish-load', sendVisibility);
  win.webContents.on('render-process-gone', (event, detail) => {
    recordCapture('render-process-gone', { reason: detail.reason, exitCode: detail.exitCode });
    if (captureActive) { captureFailed = true; setCaptureState(true, { interrupted: true }); }
    // Do not automatically restart a capture that may be crashing a driver.
  });
  // X = vai pra bandeja (segundo plano). Sair de verdade: menu da bandeja.
  win.on('close', (e) => {
    if (quitting || TEST_MODE) return;
    if(host && !keepHostOnline){quitting=true;app.quit();return;}
    e.preventDefault();
    win.hide();
    if (!app._trayHintShown && Notification.isSupported()) {
      app._trayHintShown = true;
      new Notification({ title: 'Resenha continua aberto', body: IS_MAC ? 'Ele está no ícone da barra de menus, lá em cima. Pra sair: Cmd+Q ou clique no ícone.' : 'Ele está na bandeja, perto do relógio. Clique direito no ícone pra sair.', silent: true, icon: ICON }).show();
    }
  });
  tunnel = new Tunnel(win);
}

function createTray() {
  if (TEST_MODE) return;
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: IS_MAC ? 18 : 16, height: IS_MAC ? 18 : 16 }));
  tray.setToolTip('Resenha');
  tray.on('click', showWindow);
  updateTrayMenu({});
}
function updateTrayMenu(st) {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Resenha', click: showWindow },
    { type: 'separator' },
    { label: st.muted ? 'Desmutar microfone' : 'Mutar microfone', enabled: !!st.inVoice, click: () => win.webContents.send('shortcut', 'mute') },
    { label: st.deafened ? 'Ativar som' : 'Mutar som e microfone', enabled: !!st.inVoice, click: () => win.webContents.send('shortcut', 'deafen') },
    { label: 'Sair da call', enabled: !!st.inVoice, click: () => win.webContents.send('shortcut', 'leave') },
    { type: 'separator' },
    { label: 'Sair do Resenha', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(st.inVoice ? `Resenha: na call${st.muted ? ' (mutado)' : ''}` : 'Resenha');
}

app.on('second-instance', showWindow);
// Mac: clicar no ícone do Dock traz a janela de volta
app.on('activate', showWindow);

// Windows keeps showing a shortcut's old icon from its cache after the exe changes. Point this app's own
// shortcuts (Start Menu and Desktop) at the current icon file, whose new name has no cache entry.
function refreshShortcutIcons() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const icon = currentIcon().ico, exe = process.execPath.toLowerCase();
  const dirs = [path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'), app.getPath('desktop')];
  for (const dir of dirs) {
    let names = []; try { names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.lnk')); } catch { continue; }
    for (const name of names) {
      try {
        const file = path.join(dir, name), link = shell.readShortcutLink(file);
        if ((link.target || '').toLowerCase() === exe && (link.icon || '').toLowerCase() !== icon.toLowerCase()) shell.writeShortcutLink(file, 'update', { icon, iconIndex: 0 });
      } catch {}
    }
  }
}

app.whenReady().then(async () => {
  const spotify = require('./spotify').createSpotify({ getWindow: () => win }); // música (Spotify): só funciona no Electron da Castlabs
  // O Widevine precisa estar pronto ANTES de abrir a janela (com ele preparado depois, o Spotify recusa a licença).
  // Espera no máximo 8 s para não travar a abertura sem internet; nas aberturas seguintes leva poucos milissegundos.
  await spotify.cdmReady(8000);
  setTimeout(refreshShortcutIcons, 5000);
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'display-capture', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'speaker-selection', 'mediaKeySystem'].includes(perm)));
  ses.setPermissionCheckHandler(() => true);

  // Compartilhar tela: o app escolhe a tela/janela no seletor próprio e aqui entrega pro getDisplayMedia
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const selection = pendingShare; pendingShare = null;
      if (!selection) return callback({});
      const type = selection.id.startsWith('screen:') ? 'screen' : 'window';
      const sources = await desktopCapturer.getSources({ types: [type], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
      const chosen = sources.find((s) => s.id === selection.id);
      if (!chosen) { setCaptureState(false, { reason: 'source-unavailable' }); return callback({}); }
      const res = { video: chosen };
      if (selection.audio && captureConfig.audioSupported) res.audio = 'loopbackWithoutChrome'; // Electron 44 / Chromium: exclude this application's process tree.
      captureConfig._isolatedReceipt = selection.captureToken ? { token: selection.captureToken, sourceId: chosen.id, confirmed: process.platform === 'win32' && res.audio === 'loopbackWithoutChrome' } : null;
      recordCapture('display-media-selected', { sourceType: type, audio: !!res.audio, audioPath: res.audio || 'video-only', compatibility });
      callback(res);
    } catch (e) { setCaptureState(false, { reason: 'source-error', error: e.message }); callback({}); }
  }, { useSystemPicker: false });

  // Downloads de anexos: pergunta onde salvar
  ses.on('will-download', (e, item) => { item.setSaveDialogOptions({ title: 'Salvar arquivo', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) }); });

  djTools = new DJTools({
    binDir: path.join(DATA_DIR, 'bin'),
    cacheDir: path.join(app.getPath('temp'), 'resenha-dj'),
    nodePath: process.execPath, // o próprio Resenha roda como Node (ELECTRON_RUN_AS_NODE) pro yt-dlp
    log: (...a) => console.log('[dj]', ...a),
  });

  if ((app.isPackaged || process.env.RESENHA_LAUNCHER) && process.platform === 'win32') {
    startupLauncher = createStartupWindow({ BrowserWindow, ipcMain, manager:updateManager, hub:true, rooms:()=>roomHandlers.list(),
      version:app.getVersion(), icon:ICON, log:recordCapture, isQuitting:()=>quitting,
      download:page=>shell.openExternal(page),
      check:force=>TEST_MODE&&!process.env.RESENHA_TEST_UPDATE?Promise.resolve({update:false}):updateManager.check(force===true),
      open:intent=>{launchIntent=intent||null;startupOpenedCurrent=true;if(!win)createWindow();},
      apply:async()=>{if(updateBusy(activeForUpdate()))throw new Error('O Resenha está em atividade. Abra a versão atual para continuar.');if(!await updateManager.launch())throw new Error('A atualização ainda não está preparada.');quitting=true;app.quit();},
      quit:()=>{updateQuitSafe=false;quitting=true;app.quit();}
    });
  } else createWindow();
  createTray();
  if (IS_MAC) systemPreferences.askForMediaAccess('microphone').catch(() => {});
});

app.on('before-quit', () => { updateQuitSafe=updateQuitSafe&&!updateBusy(activeForUpdate()); quitting = true; if (!captureFailed) setCaptureState(false, { reason: 'normal-exit' }); });
app.on('window-all-closed', async () => { await stopHost(4003); app.quit(); });
let quitStopped = false;
let updateExitHandled = false;
app.on('before-quit', (e) => {
  // fechar pela bandeja: a sala passa pra outro amigo em vez de acabar
  if (host && !quitStopped) { updateQuitSafe=updateQuitSafe&&!updateBusy(activeForUpdate()); e.preventDefault(); quitStopped = true; stopHost(4003).finally(() => app.quit()); return; }
  if(!updateExitHandled&&updateQuitSafe&&!updateBusy(activeForUpdate())&&updateManager.pending()){e.preventDefault();updateExitHandled=true;updateManager.launch().catch(err=>recordCapture('update-helper-error',{error:err.message})).finally(()=>app.quit());}
});
app.on('will-quit', () => globalShortcut.unregisterAll());

const RELAY_RANGE = 300; // portas UDP locais dos relays TURN (não precisam abrir no roteador)
async function stopHost(code = 4002) {
  if (!host) return;
  const h = host; host = null;
  if(code===4004 && h.dataDir)try{backup(h.dataDir,roomStore.backups,'Cópia do anfitrião que cedeu após conflito. Sem mesclagem automática.');}catch(e){console.log('[backup]',e.message);}
  // Fecha a sala antes do túnel: o aviso de fechamento (4003 = outro assume) precisa chegar a quem entrou pelo código.
  try { await h.server.close(code); } catch {}
  try { if (tunnel && tunnel.role === 'host') tunnel.stop(); } catch {}
  try { if (h.turn) h.turn.stop(); } catch {}
  try { await h.mapper.close(); } catch {}
}

// ---------- IPC ----------
ipcMain.handle('host:start', async (e, opts) => {
  if(opts.resume){const ticket=pendingClaims.get(norm(opts.code));if(!ticket||ticket.until<Date.now())return {ok:false,error:'A reivindicação expirou. Verifique a sala novamente.'};opts.claim=ticket.claim;pendingClaims.delete(norm(opts.code));}
  await stopHost();
  const hostKey = crypto.randomBytes(16).toString('hex');
  const safeRoom = String(opts.roomName || 'sala').replace(/[^\w\- ]/g, '_').slice(0, 40) || 'sala';
  const legacyDir=path.join(DATA_DIR,'salas',safeRoom);
  const code=norm(opts.code);let cached=code?roomStore.get(code):null;
  if(cached && (!opts.restore || cached.revision>Number(opts.restore.revision||0)))opts.restore={...cached,...(opts.restore?.dj?{dj:opts.restore.dj}:{})};
  const canonicalDir=path.join(DATA_DIR,'salas',roomIdFor(code));
  let legacyIdentity=null;try{legacyIdentity=JSON.parse(fs.readFileSync(path.join(legacyDir,'room.json'),'utf8'))}catch{}
  const known=roomFolders[code];const roomRoot=path.resolve(DATA_DIR,'salas')+path.sep;
  const validKnown=typeof known==='string'&&path.resolve(known).startsWith(roomRoot)&&fs.existsSync(known);
  const dataDir=validKnown?known:fs.existsSync(legacyDir)&&(!legacyIdentity||legacyIdentity.code===code)?legacyDir:canonicalDir;
  const backupRoot=roomStore.backups;
  const turnPass = crypto.randomBytes(12).toString('hex');
  if (opts.restore) restoreCachedFiles(opts.code, opts.restore, dataDir);
  let port = Math.max(1024, Math.min(65000, Number(opts.port) || 7777));
  let server = null;
  for (let tries = 0; ; tries++) {
    try { server = createServer({ backupRoot,onSnapshot:snap=>roomStore.save(snap), port, password: opts.password || '', roomName: opts.roomName, hostKey, dj: djTools, code: opts.code, epoch: opts.epoch,
      restore: opts.restore, turn: { port, username: 'resenha', credential: turnPass }, dataDir, log: (...a) => console.log('[sala]', ...a) }); }catch(e){return {ok:false,error:e.message}};
    try { await server.listen(); break; } catch (err) {
      try { await server.close(); } catch {}
      if (err.code === 'EADDRINUSE' && opts.autoPort && tries < 10) { port += 400; continue; }
      return { ok: false, error: err.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Escolha outra.` : err.message };
    }
  }
  roomFolders[code]=dataDir;atomic(roomFoldersFile,roomFolders);
  // Relay TURN embutido: quando dois amigos não conseguem falar direto, a voz/tela passa pelo PC do anfitrião
  let turn = null;
  try {
    const lan = net.localIPs().v4.filter((x) => !x.virtual).map((x) => x.ip);
    turn = new Turn({ relayIps: lan.length ? [lan[0]] : undefined, listeningPort: port, minPort: port + 1, maxPort: port + RELAY_RANGE, authMech: 'long-term',
      realm: 'resenha', credentials: { resenha: turnPass }, debugLevel: 'OFF', log: () => {}, debug: () => {} });
    turn.start();
  } catch (err) { console.log('[turn] falhou', err.message); turn = null; }
  const mapper = new net.PortMapper();
  host = { server, mapper, port, hostKey, dataDir, udpPorts: [port], turn };
  try {
    const ips = net.localIPs().v4.filter(x=>!x.virtual).map(x=>x.ip);
    const tls = await mobileTLS(path.join(DATA_DIR,'mobile-tls'),ips);
    let httpsPort;
    for(let i=0;i<10;i++){try{httpsPort=await server.listenSecure(tls,port+200+i);break;}catch(e){if(e.code!=='EADDRINUSE'||i===9)throw e;}}
    host.mobile = await createMobileInvite({ ips, httpsPort, fingerprint: tls.fingerprint, port, QRCode });
  } catch(e) { host.mobile={error:'HTTPS local indisponível: '+e.message}; }
  if(opts.claim){opts.rank=opts.rank||[0,Date.now(),opts.claim.id];opts.rank.claim=opts.claim;}
  if (opts.code) tunnel.hostStart(opts.code, port, opts.rank, () => server.clientCount(),()=>server.roomInfo().revision);
  return { ok: true, port, hostKey,room:server.roomInfo() };
});

const pendingClaims=new Map();
const roomActor=crypto.randomBytes(12).toString('hex');
const roomHandlers = createRoomHandlers({ roomStore });
ipcMain.handle('rooms:locations',()=>roomHandlers.locations());
ipcMain.handle('rooms:list',()=>roomHandlers.list());
ipcMain.handle('rooms:save',(e,snap)=>roomHandlers.save(snap));
ipcMain.handle('rooms:inspect',(e,code)=>tunnel.inspect(norm(code)));
ipcMain.handle('rooms:claim',async(e,{code,id})=>{
  const snap=roomStore.get(code);if(!snap)return {state:'missing'};
  const claim={id:String(id).slice(0,40)+'-'+roomActor,revision:snap.revision};
  const result=await tunnel.inspect(snap.code,{claim});
  if(result.state==='won')pendingClaims.set(snap.code,{claim,until:Date.now()+30000});
  return {...result,snapshot:snap};
});
ipcMain.handle('rooms:import',(e,codes)=>{
 const imported=[];
 for(const [name,c] of Object.entries(codes||{}).slice(0,200)){
  const code=norm(c);if(code.length!==8||roomStore.get(code))continue;
  const safe=String(name).replace(/[^\w\- ]/g,'_').slice(0,40)||'sala';
  const dir=path.join(DATA_DIR,'salas',safe);
  try{
   const meta=fs.existsSync(path.join(dir,'room.json'))?JSON.parse(fs.readFileSync(path.join(dir,'room.json'),'utf8')):null;
   if(meta?.code&&meta.code!==code)continue;
   const channels=JSON.parse(fs.readFileSync(path.join(dir,'channels.json'),'utf8'));
   const history=JSON.parse(fs.readFileSync(path.join(dir,'history.json'),'utf8'));
   const snap=makeSnapshot({code,name,revision:meta?.revision||0,lineage:meta?.lineage,configuration:meta?.configuration||{legacyPasswordUnknown:true},channels,history});
   let backed=null;if(!meta){backed=backup(dir,roomStore.backups,'Antes de importar identidade antiga para Minhas salas.');atomic(path.join(dir,'room.json'),{schema:1,roomId:snap.roomId,code,name,revision:snap.revision,configuration:snap.configuration});}
   roomFolders[code]=dir;atomic(roomFoldersFile,roomFolders);
   roomStore.save(snap);imported.push({code,backup:backed});
  }catch{}
 }
 return imported;
});
ipcMain.handle('window:host-background',(e,value)=>{if(typeof value==='boolean'){keepHostOnline=value;atomic(windowPrefsFile,{keepHostOnline});}return {keepHostOnline};});

// ---------- Túnel (código da sala) ----------
ipcMain.handle('tun:guest-start', (e, code) => tunnel.guestStart(code));
ipcMain.handle('tun:guest-offer', (e, sdp, ms) => tunnel.guestOffer(sdp, Math.max(3000, Math.min(60000, Number(ms) || 20000))));
ipcMain.handle('tun:host-answer', (e, a) => tunnel.hostAnswer(a.peerId, a.nonce, a.sdp));
ipcMain.handle('tun:stop', () => { if (tunnel.role === 'guest') tunnel.stop(); });
ipcMain.on('tun:ready', (e, v) => tunnel.setReady(!!v));
ipcMain.on('tun:open', (e, key) => tunnel.hostOpen(key));
ipcMain.on('tun:data', (e, key, buf) => tunnel.data(key, buf));
ipcMain.on('tun:close', (e, key) => tunnel.close(key));
ipcMain.on('tun:close-peer', (e, prefix) => tunnel.closePeer(prefix));
ipcMain.on('tun:pause', (e, key) => tunnel.pause(key));
ipcMain.on('tun:resume', (e, key) => tunnel.resume(key));

// ---------- Cópia dos anexos (pra sala sobreviver à troca de anfitrião) ----------
const attachmentCache = createAttachmentCache({ getUserData: () => DATA_DIR });
ipcMain.handle('cache:file', attachmentCache.cacheFile);
function restoreCachedFiles(code, restore, dataDir) { return attachmentCache.restoreCachedFiles(code, restore, dataDir); }

ipcMain.handle('host:stop', async (e, code) => { await stopHost(code); return true; });
// Link e QR do Resenha no celular (PWA no GitHub Pages) já com o código da sala.
const PWA_URL = 'https://fgsecfem-dotcom.github.io/resenhagorilandia/';
ipcMain.handle('pwa:invite', async (e, code) => {
  const c = norm(code); if (c.length !== 8) return null;
  const url = PWA_URL + '#' + c.slice(0, 4) + '-' + c.slice(4);
  return { url, qr: await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#111216', light: '#ffffff' } }) };
});

// Descobre endereços para convidar (pode demorar alguns segundos)
ipcMain.handle('host:mobile', () => host?.mobile || null);
ipcMain.handle('host:network', async () => {
  if (!host) return null;
  const local = net.localIPs();
  const [pub, upnp] = await Promise.all([net.publicIPs(), host.upnp || (host.upnp = host.mapper.open(host.port, host.udpPorts))]);
  let cgnat = false;
  if (upnp.ok && upnp.externalIP && pub.v4 && upnp.externalIP !== pub.v4) cgnat = true;
  if (upnp.ok && upnp.externalIP && net.isPrivateV4(upnp.externalIP)) cgnat = true;
  const v6 = local.v6.find((x) => !x.virtual && pub.v6 && x.ip === pub.v6) || local.v6.find((x) => !x.virtual);
  return { port: host.port, turn: !!host.turn, lan: local.v4.filter((x) => !x.virtual).map((x) => x.ip), vpn: local.v4.filter((x) => x.virtual).map((x) => `${x.ip} (${x.iface})`), publicV4: pub.v4, publicV6: pub.v6 || (v6 && v6.ip) || null, upnp, cgnat };
});

ipcMain.handle('screen:sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true });
  return sources
    .filter((s) => s.id.startsWith('screen') || !/Resenha$/.test(s.name))
    .map((s) => ({ id: s.id, name: s.name, screen: s.id.startsWith('screen'), thumb: s.thumbnail.isEmpty() ? null : s.thumbnail.toDataURL(), icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null }));
});
ipcMain.handle('screen:select', (e, sel) => {
  if (!sel || typeof sel.id !== 'string') throw new Error('Selecione uma tela ou janela.');
  captureConfig._isolatedReceipt = null;
  pendingShare = { id: sel.id, audio: !!sel.audio && captureConfig.audioSupported, captureToken: crypto.randomUUID() };
  setCaptureState(true, { stage: 'starting', audio: pendingShare.audio, compatibility });
  return { selected: true, captureToken: pendingShare.captureToken };
});
ipcMain.handle('capture:info', (e, captureToken) => {
  const {_isolatedReceipt: receipt, ...info} = captureConfig;
  const result = { ...info, recovered: recoveredCapture };
  if (typeof captureToken === 'string') {
    result.isolatedAudioConfirmed = !!(receipt && receipt.token === captureToken && receipt.confirmed);
    if (result.isolatedAudioConfirmed) result.sourceId = receipt.sourceId;
    captureConfig._isolatedReceipt = null; // one capture, one confirmation; never reused after a retry
  }
  return result;
});
ipcMain.handle('capture:status', (e, info) => { setCaptureState(!!info.active, { stage: info.stage, quality: info.quality, audio: !!info.audio, audioError: typeof info.audioError === 'string' ? info.audioError.slice(0, 80) : undefined, audioDetail: typeof info.audioDetail === 'string' ? info.audioDetail.slice(0, 240) : undefined }); return true; });
// Facts for the live-audio test report: no names, paths or addresses.
ipcMain.handle('capture:system', () => ({ platform: process.platform, release: os.release(), arch: process.arch, electron: process.versions.electron }));
ipcMain.handle('capture:diagnostics', async () => {
  let gpu = {}; try { gpu = await app.getGPUInfo('basic'); } catch {}
  recordCapture('system', { platform: process.platform, release: os.release(), electron: process.versions.electron, compatibility, gpu });
  await shell.openPath(path.join(DATA_DIR, 'capture-diagnostics.jsonl'));
});
ipcMain.handle('capture:compatibility', (e, enabled) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(capturePrefsFile, JSON.stringify({ compatibility: !!enabled }));
  setCaptureState(false, { reason: 'compatibility-relaunch' });
  const args = process.argv.slice(1).filter((a) => a !== '--compatibility');
  app.relaunch({ args }); quitting = true; app.quit();
});

ipcMain.handle('shortcuts:set', (e, map) => {
  globalShortcut.unregisterAll();
  const res = {};
  for (const [action, accel] of Object.entries(map || {})) {
    if (!accel) continue;
    try { res[action] = globalShortcut.register(accel, () => win && win.webContents.send('shortcut', action)); } catch { res[action] = false; }
  }
  return res;
});

ipcMain.on('voice-state', (e, st) => {updateVoice=st||{};updateTrayMenu(updateVoice);});

ipcMain.handle('notify', (e, { title, body }) => {
  if (!win || (win.isFocused() && win.isVisible())) return;
  win.flashFrame(true);
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: true, icon: nativeImage.createFromPath(ICON) });
    n.on('click', showWindow);
    n.show();
  }
});
ipcMain.handle('download', (e, url) => { if (/^https?:/.test(url)) win.webContents.downloadURL(url); });
ipcMain.handle('open-external', (e, url) => { if (/^https?:/.test(url)) shell.openExternal(url); });
let gpuReportPromise;
ipcMain.handle('performance:sample', async () => {
  gpuReportPromise = gpuReportPromise || app.getGPUInfo('basic').catch(() => ({}));
  return {
    system: { version: app.getVersion(), platform: process.platform, release: os.release(), arch: process.arch, cpu: os.cpus()[0]?.model, logicalProcessors: os.cpus().length, totalMemoryBytes: os.totalmem(), gpu: await gpuReportPromise, compatibility },
    processes: app.getAppMetrics().map((p) => ({ type: p.type, cpuElectronPercent: p.cpu.percentCPUUsage, workingSetKB: p.memory.workingSetSize, privateKB: p.memory.privateBytes })),
  };
});
ipcMain.handle('performance:save', async (e, report) => {
  const choice = await dialog.showSaveDialog(win, {title:'Salvar diagnóstico de desempenho',defaultPath:path.join(app.getPath('downloads'),'resenha-desempenho.json'),filters:[{name:'JSON',extensions:['json']}]});
  if(choice.canceled || !choice.filePath)return false;
  fs.writeFileSync(choice.filePath,JSON.stringify(report,null,2)); return true;
});
ipcMain.handle('app:version', () => app.getVersion());
// Troca o ícone da janela, da barra de tarefas, do Dock e dos atalhos pela variação escolhida.
ipcMain.handle('app:icon', (e, { key, pngs } = {}) => {
  if (!/^[a-z]{3,16}$/.test(String(key)) || !pngs || typeof pngs !== 'object') return { ok: false };
  const read = (s) => { const u = String(pngs[s] || ''); if (!u.startsWith('data:image/png;base64,') || u.length > 3e6) throw Error('png'); return Buffer.from(u.slice(22), 'base64'); };
  try {
    fs.mkdirSync(userIconDir, { recursive: true });
    const ico = path.join(userIconDir, `taskbar-${key}.ico`), png = path.join(userIconDir, `icon-${key}.png`); // nome por variação: o Windows guarda ícones pelo caminho
    fs.writeFileSync(ico, buildIco(ICON_SIZES.map((s) => [s, read(s)])));
    fs.writeFileSync(png, read(512));
    fs.writeFileSync(path.join(userIconDir, 'escolha.json'), JSON.stringify({ key, ico, png }));
    if (win && !win.isDestroyed()) {
      win.setIcon(nativeImage.createFromPath(png));
      if (process.platform === 'win32') win.setAppDetails({ appId: APP_ID, appIconPath: ico, appIconIndex: 0, ...(app.isPackaged ? { relaunchCommand: '"' + process.execPath + '"', relaunchDisplayName: 'Resenha' } : {}) });
    }
    if (IS_MAC) app.dock?.setIcon(png);
    refreshShortcutIcons();
    return { ok: true };
  } catch { return { ok: false }; }
});
// Janela translúcida (2.1.5): acrílico do Windows 11 22H2+ (build 22621). Em outros sistemas fica opaca.
const ACRYLIC_OK = process.platform === 'win32' && Number(os.release().split('.')[2] || 0) >= 22621;
// Se "Efeitos de transparência" estiver desligado no Windows, o acrílico vira um cinza liso: aí a janela fica opaca.
function windowsTransparencyOn() {
  if (!ACRYLIC_OK) return false;
  try { const out = require('child_process').execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe'), ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'EnableTransparency'], { windowsHide: true, encoding: 'utf8', timeout: 3000 });
    return !/EnableTransparency\s+REG_DWORD\s+0x0\b/i.test(out); } catch { return true; }
}
let acrylicOn = false, lastWindowColor = '#101116';
function applyMaterial(on) {
  if (!win || win.isDestroyed() || ROUNDED_WIN) return false; // janela transparente não combina com o acrílico
  acrylicOn = !!(on && ACRYLIC_OK && win.setBackgroundMaterial && windowsTransparencyOn());
  try { win.setBackgroundColor(acrylicOn ? '#00000000' : lastWindowColor); win.setBackgroundMaterial?.(acrylicOn ? 'acrylic' : 'none'); } catch { acrylicOn = false; }
  return acrylicOn;
}
ipcMain.handle('window:material', (e, on) => ({ supported: ACRYLIC_OK && !ROUNDED_WIN, systemTransparency: windowsTransparencyOn(), on: applyMaterial(on) }));
ipcMain.on('window:colors', (e, background, foreground) => {
  if (!win || !/^#[0-9a-f]{6}$/i.test(background) || !/^#[0-9a-f]{6}$/i.test(foreground)) return;
  lastWindowColor = background;
  if (!acrylicOn && !ROUNDED_WIN) win.setBackgroundColor(background);
});
ipcMain.on('window:control', (e, action) => {
  if (!win || IS_MAC) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close(); // same path as the old X: goes to the tray
});

// ---------- Atualização pelo GitHub ----------
ipcMain.handle('update:check', async (e,force) => {
  if (TEST_MODE && !process.env.RESENHA_TEST_UPDATE) return {update:false};
  const result=await updateManager.check(force===true);
  // Background download only for versions that have not already failed to install on this PC.
  if(result.update&&!result.manual&&!updateManager.pending()&&!updateManager.autoBlocked(result.version))updateManager.prepare().catch(err=>recordCapture('update-error',{error:err.message}));
  return result;
});
ipcMain.handle('update:status',()=>updateManager.status());
ipcMain.handle('update:channel',(e,channel)=>updateManager.channel(channel));
ipcMain.handle('update:ready',async()=>{if(app.isPackaged){updateManager.acknowledge();if(updatePendingAtStartup&&!startupOpenedCurrent&&updateManager.pending()&&!updateBusy(activeForUpdate())){try{if(await updateManager.launch()){quitting=true;app.quit();}}catch(err){recordCapture('update-helper-error',{error:err.message});}}}});
ipcMain.handle('update:install',async()=>{
  if(!updateManager.info)return {ok:false,error:'Verifique as atualizações primeiro.'};
  if(updateManager.info.manual){await shell.openExternal(updateManager.info.page);return {ok:true,manual:true};}
  return updateManager.prepare();
});
ipcMain.handle('update:restart',async()=>{
  if(updateBusy(activeForUpdate())){recordCapture('update-deferred',activeForUpdate());return {ok:false,deferred:true,error:'Você está em call, transmitindo ou hospedando com pessoas conectadas. Saia da atividade para reiniciar.'};}
  try{if(!await updateManager.launch())return {ok:false,error:'A atualização ainda não está preparada.'};updateQuitSafe=true;quitting=true;app.quit();return {ok:true};}catch(err){return {ok:false,error:err.message};}
});
