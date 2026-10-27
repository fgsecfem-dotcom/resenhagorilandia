// Spotify no Resenha (processo principal): login OAuth com PKCE (sem segredo no app), token renovado sozinho
// e guardado criptografado pelo sistema (safeStorage). A reprodução acontece no renderer pelo SDK oficial,
// que precisa do Widevine do Electron da Castlabs (ECS) com assinatura EVS. Sem ECS, o recurso fica indisponível.
const { app, BrowserWindow, safeStorage, ipcMain } = require('electron');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
let components = null; try { ({ components } = require('electron')); } catch {}

// Chave padrão: app "Resenha" no painel do Spotify (Client ID é público). No modo de desenvolvimento ela só aceita
// poucas contas cadastradas, então cada pessoa pode usar a própria chave (Client ID do app que ela cria no painel).
const DEFAULT_CLIENT_ID = 'f8b4e1025b6f44768afe291360c00301';
const validClientId = (s) => typeof s === 'string' && /^[0-9a-f]{32}$/i.test(s);
const REDIRECT = 'http://127.0.0.1:8888/callback';     // só serve de marcador: a janela de login intercepta antes de carregar
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative';
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function createSpotify({ getWindow }) {
  const file = () => path.join(app.getPath('userData'), 'spotify.json');
  let access = null, refresh = null, user = null, scope = '', cdm = null, loginWin = null, clientId = null;
  const available = () => !!(components && typeof components.whenReady === 'function');
  const cid = () => clientId || DEFAULT_CLIENT_ID;
  function load() {
    try {
      const j = JSON.parse(fs.readFileSync(file(), 'utf8')); user = j.user || null; scope = j.scope || '';
      if (validClientId(j.clientId)) clientId = j.clientId;
      if (j.refresh && safeStorage.isEncryptionAvailable()) refresh = safeStorage.decryptString(Buffer.from(j.refresh, 'base64'));
    } catch {}
  }
  function save() {
    try {
      if (!refresh && !clientId) return fs.rmSync(file(), { force: true });
      // sem criptografia do sistema o login não vai para o disco (a chave é pública e pode ir)
      const enc = refresh && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(refresh).toString('base64') : null;
      fs.writeFileSync(file(), JSON.stringify({ ...(enc ? { refresh: enc, user, scope } : {}), ...(clientId ? { clientId } : {}) }));
    } catch {}
  }
  // Troca a chave. O login fica preso à chave, então trocar desconecta. Vazio volta para a chave padrão.
  function setClientId(id) {
    const v = String(id || '').trim();
    if (v && !validClientId(v)) throw Error('Isso não parece um Client ID. Ele tem 32 letras e números, sem espaços.');
    clientId = v ? v.toLowerCase() : null;
    access = null; refresh = null; user = null; scope = ''; save();
  }
  async function tokenRequest(params) {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cid(), ...params }) });
    const j = await r.json().catch(() => ({}));
    if (j.error === 'invalid_client') { const e = Error('O Spotify não reconheceu essa chave. Confira o Client ID.'); e.code = j.error; throw e; }
    if (!r.ok) { const e = Error(j.error_description || j.error || 'HTTP ' + r.status); e.code = j.error; throw e; }
    access = { token: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
    if (j.refresh_token) refresh = j.refresh_token;
    if (typeof j.scope === 'string') scope = j.scope; // permissões concedidas (quem conectou antes da 2.2 não tem as de playlists)
    return access;
  }
  async function me() {
    const r = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: 'Bearer ' + access.token } });
    // No modo de desenvolvimento, conta não cadastrada na chave recebe 403 (com texto, não JSON).
    if (r.status === 403) throw Error(clientId ? 'Sua conta não está liberada nesta chave. Entre no Spotify com a mesma conta que criou a chave.'
      : 'Sua conta não está liberada na chave padrão do Resenha. Toque em "Minha chave" para criar a sua (grátis, uns 5 minutos).');
    if (!r.ok) throw Error('O Spotify respondeu ' + r.status + ' ao buscar sua conta.');
    const j = await r.json(); user = { name: j.display_name || j.id, product: j.product }; save(); return user;
  }
  function login() {
    if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return Promise.reject(Error('login já aberto')); }
    const verifier = b64url(crypto.randomBytes(48)), state = b64url(crypto.randomBytes(16));
    const q = new URLSearchParams({ client_id: cid(), response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) });
    return new Promise((resolve, reject) => {
      const parent = getWindow();
      loginWin = new BrowserWindow({ width: 520, height: 760, parent: parent || undefined, title: 'Entrar no Spotify', autoHideMenuBar: true, backgroundColor: '#121212',
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'persist:spotify-login' } });
      let done = false;
      const finish = (err, val) => { if (done) return; done = true; if (loginWin && !loginWin.isDestroyed()) loginWin.close(); loginWin = null; err ? reject(err) : resolve(val); };
      const intercept = (e, url) => {
        if (!url.startsWith(REDIRECT)) return;
        e.preventDefault();
        const u = new URL(url);
        if (u.searchParams.get('state') !== state) return finish(Error('Resposta de login inválida.'));
        if (u.searchParams.get('error')) return finish(Error(u.searchParams.get('error') === 'access_denied' ? 'Você cancelou o login.' : u.searchParams.get('error')));
        tokenRequest({ grant_type: 'authorization_code', code: u.searchParams.get('code'), redirect_uri: REDIRECT, code_verifier: verifier })
          .then(() => me()).then((usr) => finish(null, usr), (e) => { access = null; refresh = null; user = null; save(); finish(e); });
      };
      loginWin.webContents.on('will-redirect', intercept);
      loginWin.webContents.on('will-navigate', intercept);
      loginWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      loginWin.on('closed', () => finish(Error('Login fechado.')));
      loginWin.loadURL('https://accounts.spotify.com/authorize?' + q);
    });
  }
  async function token() {
    if (access && access.expires > Date.now()) return { token: access.token };
    if (!refresh) throw Error('Não conectado');
    try { await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh }); save(); return { token: access.token }; }
    catch (e) { if (e.code === 'invalid_grant') { refresh = null; access = null; save(); } throw e; }
  }
  function logout() { access = null; refresh = null; user = null; scope = ''; save(); }
  async function status() {
    if (available() && !cdm) cdm = components.whenReady().then(() => true, () => false);
    const drm = available() ? await cdm : false;
    return { available: available(), drm, connected: !!refresh, user, scopes: scope, ownKey: !!clientId };
  }
  load();
  function cdmReady(ms) {
    if (!available()) return Promise.resolve(false);
    if (!cdm) cdm = components.whenReady().then(() => true, () => false);
    return Promise.race([cdm, new Promise((r) => setTimeout(() => r(false), ms))]);
  }
  ipcMain.handle('spotify:status', () => status());
  ipcMain.handle('spotify:login', () => login().then((u) => ({ ok: true, user: u }), (e) => ({ ok: false, error: e.message })));
  ipcMain.handle('spotify:token', () => token().then((t) => t, (e) => ({ error: e.message })));
  ipcMain.handle('spotify:logout', () => { logout(); return true; });
  ipcMain.handle('spotify:set-client-id', (e, id) => { try { setClientId(id); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; } });
  return { status, cdmReady, token, setClientId };
}
module.exports = { createSpotify, validClientId, DEFAULT_CLIENT_ID };
