// Bugs relatados em 12/11/2026: amigos sem se ouvir até sair e entrar, Spotify desconectando e live preta pelo repasse.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm'), Module = require('node:module');
const { declaration } = require('./helpers/characterization-client');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');

(async () => {
  // 1) Conexão de voz travada: quem tem o id menor recomeça; quem tem o maior espera; conectada não mexe.
  {
    const signals = [], created = [], closed = [];
    const mk = (state, since) => ({ pc: { connectionState: state }, since, okAt: 0 });
    const V = { joined: true, channel: 'lobby', peers: new Map(), watching: new Map([['b', 'live-b']]) };
    const S = { myId: 'b0', users: new Map([['a', { voiceChannel: 'lobby' }], ['b', { voiceChannel: 'lobby' }], ['c', { voiceChannel: 'lobby' }], ['d', { voiceChannel: 'outro' }]]) };
    const ctx = vm.createContext({ V, S, Date, console, setInterval: () => 0, sig: (to, data) => signals.push({ to, data }), renderCall: () => {},
      closePeer: (uid) => { closed.push(uid); V.peers.delete(uid); V.watching.delete(uid); },
      getPeer: (uid) => { created.push(uid); const p = mk('new', Date.now()); V.peers.set(uid, p); return p; } });
    vm.runInContext('const PEER_STUCK_MS = 15000, PEER_RESET_GAP_MS = 20000;\n' + ['resetPeer', 'checkStuckPeers'].map((n) => declaration(source, n)).join('\n') + '\nthis.checkStuckPeers = checkStuckPeers; this.resetPeer = resetPeer;', ctx);
    const now = Date.now(), old = now - 16000;
    V.peers.set('a', mk('new', old));        // id menor que o meu: eu (b0) sou o maior, espero
    V.peers.set('c', mk('connecting', old)); // id maior: eu recomeço
    V.peers.set('b', mk('connected', old));  // conectada
    V.peers.set('d', mk('new', old));        // em outro canal
    ctx.checkStuckPeers(now);
    assert.deepEqual(closed, ['c'], 'só a conexão travada com id maior é recomeçada por mim');
    assert.deepEqual(JSON.parse(JSON.stringify(signals)), [{ to: 'c', data: { reset: true } }]);
    assert.deepEqual(created, ['c']);
    assert.equal(V.peers.get('b').okAt, now, 'conexão boa marca a hora');
    ctx.checkStuckPeers(now + 1000);
    assert.equal(closed.length, 1, 'não recomeça de novo logo em seguida');
    // Quem recebe o aviso fecha a conexão velha, mas continua querendo assistir a live.
    V.peers.set('b', mk('connected', old)); V.watching.set('b', 'live-b');
    ctx.resetPeer('b', false);
    assert.equal(V.watching.get('b'), 'live-b'); assert.equal(V.peers.has('b'), false); assert.equal(signals.length, 1);
  }

  // 2) Repasse que não entrega a live em 10 s: vai direto para quem transmite.
  {
    const direct = [];
    const V = { relayVia: new Map([['dono', 'repasse']]), watching: new Map([['dono', 'live-1']]), peers: new Map([['repasse', { streams: new Map(), pc: {} }]]) };
    const relayHealth = new Map([['dono', { since: Date.now() - 11000, bad: 0 }]]);
    const ctx = vm.createContext({ V, Date, relayHealth, RELAY_DEAD_MS: 10000, goDirect: (o) => direct.push(o) });
    vm.runInContext(declaration(source, 'checkRelayQuality') + '\nthis.check = checkRelayQuality;', ctx);
    await ctx.check();
    assert.deepEqual(direct, ['dono'], 'tela preta pelo repasse cai para o direto');
    relayHealth.set('dono', { since: Date.now(), bad: 0 }); direct.length = 0;
    await ctx.check();
    assert.deepEqual(direct, [], 'repasse novo ainda tem tempo para começar');
  }

  // 3) Spotify: dois pedidos de token juntos não derrubam o login, e o arquivo nunca fica cortado.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resenha-spotify-race-'));
    const fake = { app: { getPath: () => dir }, BrowserWindow: class {}, ipcMain: { handle() {} },
      safeStorage: { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() } };
    const load = Module._load;
    Module._load = function (req, ...rest) { return req === 'electron' ? fake : load.call(this, req, ...rest); };
    const OWN = 'abcdef0123456789abcdef0123456789';
    fs.writeFileSync(path.join(dir, 'spotify.json'), JSON.stringify({ refresh: Buffer.from('r1').toString('base64'), user: { name: 'eu' }, clientId: OWN }));
    let valid = 'r1', calls = 0;
    global.fetch = async (url, opt) => {
      calls++;
      const used = new URLSearchParams(opt.body).get('refresh_token');
      await new Promise((r) => setTimeout(r, 30));
      if (used !== valid) return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
      valid = 'r' + (Number(valid.slice(1)) + 1); // o Spotify troca o refresh token a cada renovação
      return { ok: true, status: 200, json: async () => ({ access_token: 'a' + valid, refresh_token: valid, expires_in: 3600 }) };
    };
    try {
      const sp = require('../spotify').createSpotify({ getWindow: () => null });
      const [t1, t2] = await Promise.all([sp.token(), sp.token()]);
      assert.equal(calls, 1, 'uma renovação só');
      assert.equal(t1.token, 'ar2'); assert.equal(t2.token, 'ar2');
      assert.equal((await sp.status()).connected, true, 'continua conectado');
      const saved = JSON.parse(fs.readFileSync(path.join(dir, 'spotify.json'), 'utf8'));
      assert.equal(Buffer.from(saved.refresh, 'base64').toString(), 'r2'); assert.equal(saved.clientId, OWN);
      assert.equal(fs.existsSync(path.join(dir, 'spotify.json.tmp')), false);
    } finally { Module._load = load; fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log('PASS: conexão de voz travada recomeça sozinha, repasse preto cai para o direto, Spotify aguenta dois pedidos de token juntos');
})().catch((e) => { console.error(e); process.exit(1); });
