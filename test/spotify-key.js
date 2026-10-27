// Issue 10: cada pessoa pode usar a própria chave (Client ID) do Spotify. Simula o Electron e a rede.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-spotify-'));
let handlers = {}, win = null;
class FakeWindow {
  constructor() { win = this; this.ev = {}; this.dead = false; this.webContents = { on: (n, f) => { this.ev[n] = f; }, setWindowOpenHandler() {} }; }
  on(n, f) { this.ev[n] = f; } loadURL(u) { this.url = u; } isDestroyed() { return this.dead; } close() { this.dead = true; } focus() {}
}
const fakeElectron = {
  app: { getPath: () => dir }, BrowserWindow: FakeWindow,
  safeStorage: { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() },
  ipcMain: { handle: (n, f) => { handlers[n] = f; } },
};
const load = Module._load;
Module._load = function (req, ...rest) { return req === 'electron' ? fakeElectron : load.call(this, req, ...rest); };
const { createSpotify, validClientId, DEFAULT_CLIENT_ID } = require('../spotify');
const file = path.join(dir, 'spotify.json');
const OWN = 'ABCDEF0123456789abcdef0123456789';

// Faz um login completo: abre a janela, devolve o código e responde a rede com o que o teste mandar.
async function login(meStatus = 200, tokenBody = { access_token: 'a', refresh_token: 'r', expires_in: 3600 }) {
  global.fetch = async (url) => url.includes('/api/token')
    ? { ok: !tokenBody.error, status: tokenBody.error ? 400 : 200, json: async () => tokenBody }
    : { ok: meStatus === 200, status: meStatus, json: async () => (meStatus === 200 ? { id: 'eu', product: 'premium' } : JSON.parse('nao e json')) };
  const p = handlers['spotify:login']();
  const q = new URL(win.url).searchParams;
  win.ev['will-redirect']({ preventDefault() {} }, `http://127.0.0.1:8888/callback?code=c&state=${q.get('state')}`);
  return { r: await p, clientId: q.get('client_id') };
}

(async () => {
  assert.ok(validClientId(OWN)); assert.ok(validClientId(DEFAULT_CLIENT_ID));
  for (const bad of ['', 'abc', OWN + '0', OWN.slice(1) + 'g', ' ' + OWN, null]) assert.ok(!validClientId(bad), 'inválido: ' + bad);

  createSpotify({ getWindow: () => null });
  let st = await handlers['spotify:status']();
  assert.equal(st.ownKey, false);
  assert.equal((await login()).clientId, DEFAULT_CLIENT_ID, 'sem chave própria usa a padrão');

  assert.equal((await handlers['spotify:set-client-id']({}, 'abc')).ok, false, 'recusa formato errado');
  assert.equal((await handlers['spotify:set-client-id']({}, OWN)).ok, true);
  st = await handlers['spotify:status']();
  assert.equal(st.ownKey, true); assert.equal(st.connected, false, 'trocar a chave desconecta');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).clientId, OWN.toLowerCase(), 'a chave fica salva');

  const ok = await login();
  assert.equal(ok.clientId, OWN.toLowerCase(), 'o login usa a chave da pessoa'); assert.equal(ok.r.ok, true);

  // Ao abrir de novo, a chave continua lá.
  handlers = {}; createSpotify({ getWindow: () => null });
  st = await handlers['spotify:status']();
  assert.equal(st.ownKey, true); assert.equal(st.connected, true);

  // Conta não cadastrada na chave: o Spotify responde 403 com texto. Mensagem clara e nada fica conectado.
  await handlers['spotify:set-client-id']({}, '');
  const denied = await login(403);
  assert.equal(denied.r.ok, false); assert.match(denied.r.error, /não está liberada/); assert.match(denied.r.error, /Minha chave/);
  assert.equal((await handlers['spotify:status']()).connected, false);

  const wrong = await login(200, { error: 'invalid_client', error_description: 'Invalid client' });
  assert.match(wrong.r.error, /não reconheceu essa chave/);

  assert.equal((await handlers['spotify:status']()).ownKey, false, 'vazio volta para a chave padrão');
  assert.ok(!fs.existsSync(file), 'sem login e sem chave própria, nada fica no disco');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: chave própria do Spotify (formato, troca, login, 403 e chave inválida)');
})().catch((e) => { console.error(e); process.exitCode = 1; });
