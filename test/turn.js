// Repasse (TURN): o Worker gera só entradas de repasse sem a porta 53, sem segredo responde vazio;
// o app soma o repasse ao STUN no mesmo pedido (sem segunda tentativa) e espera o candidato do repasse antes de mandar a oferta.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
(async () => {
  const W = await import(pathToFileURL(path.join(__dirname, '../turn-worker/src/index.js')).href);
  const get = (env, f) => W.turnServers(new Request('https://x/turn'), env, f).then(async (r) => ({ status: r.status, cors: r.headers.get('access-control-allow-origin'), body: await r.json() }));
  let r = await get({}); assert.deepEqual(r.body.iceServers, []); assert.equal(r.status, 200, 'sem chave: lista vazia, o app segue só com STUN');
  let sent;
  const cf = async (url, opt) => { sent = { url, opt }; return new Response(JSON.stringify({ iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turn:turn.cloudflare.com:3478?transport=tcp', 'turns:turn.cloudflare.com:5349?transport=tcp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' }] }), { status: 201 }); };
  r = await get({ TURN_KEY_ID: 'k1', TURN_KEY_API_TOKEN: 'tok' }, cf);
  assert.match(sent.url, /\/v1\/turn\/keys\/k1\/credentials\/generate-ice-servers$/); assert.equal(sent.opt.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(sent.opt.body).ttl, W.TURN_TTL); assert(W.TURN_TTL >= 6 * 3600, 'credencial dura uma call longa');
  assert.equal(r.cors, '*', 'o PWA do celular também busca');
  assert.deepEqual(r.body.iceServers, [{ urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:3478?transport=tcp', 'turns:turn.cloudflare.com:5349?transport=tcp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' }]);
  r = await get({ TURN_KEY_ID: 'k', TURN_KEY_API_TOKEN: 't' }, async () => new Response('x', { status: 401 })); assert.equal(r.status, 502); assert.deepEqual(r.body.iceServers, []);
  r = await get({ TURN_KEY_ID: 'k', TURN_KEY_API_TOKEN: 't', LIMIT: { limit: async () => ({ success: false }) } }, cf); assert.equal(r.status, 429, 'freio por IP contra abuso');
  // App: STUN + repasse no mesmo RTCPeerConnection, sem trocar a ordem de preferência; a oferta só sai com o candidato do repasse.
  const tun = fs.readFileSync(path.join(__dirname, '../app/tunnel.js'), 'utf8'), client = fs.readFileSync(path.join(__dirname, '../app/client.js'), 'utf8');
  assert.match(tun, /iceServers: \[\.\.\.TUN_ICE, \.\.\.turn\]/); assert.match(tun, /iceTransportPolicy: relayOnly \? 'relay' : 'all'/);
  assert.match(tun, /gatherDone\(pc, \{ relay: ice\.turn, relayOnly: ice\.relayOnly \}\)/g); assert.equal((tun.match(/gatherDone\(pc, \{ relay: ice\.turn/g) || []).length, 2, 'anfitrião e convidado');
  assert.match(client, /return \[\.\.\.list, \.\.\.\(window\.ResenhaTurn\?\.servers\(\) \|\| \[\]\)\];/, 'voz e live também têm o repasse');
  assert.match(fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8'), /<script src="turn\.js"><\/script>\s*<script src="tunnel\.js">/);
  // turn.js: credencial em cache, filtra o que não é repasse, falha de rede vira lista vazia
  const vm = require('node:vm'); let calls = 0, fail = false;
  const ctx = vm.createContext({ window: {}, AbortController, setTimeout, clearTimeout, localStorage: { getItem: () => null },
    fetch: async () => { calls++; if (fail) throw new Error('offline'); return new Response(JSON.stringify({ iceServers: [{ urls: 'stun:x' }, { urls: ['turn:t:3478'], username: 'u', credential: 'c' }] })); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/turn.js'), 'utf8'), ctx);
  const T = ctx.window.ResenhaTurn; const l1 = await T.load(); assert.equal(l1.length, 1); await T.load(); assert.equal(calls, 1, 'uma busca só (a do início do app)');
  assert.deepEqual(JSON.parse(JSON.stringify(T.servers())), [{ urls: ['turn:t:3478'], username: 'u', credential: 'c' }]);
  const ctx2 = vm.createContext({ window: {}, AbortController, setTimeout, clearTimeout, localStorage: { getItem: () => null }, fetch: async () => { throw new Error('offline'); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/turn.js'), 'utf8'), ctx2); assert.deepEqual([...await ctx2.window.ResenhaTurn.load()], []);
  console.log('PASS: repasse da Cloudflare junto com a ligação direta (Worker, túnel, voz, PWA) e sem quebrar quando falta');
})().catch((e) => { console.error(e); process.exit(1); });
