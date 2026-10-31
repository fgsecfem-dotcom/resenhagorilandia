// Ouvir junto: o convidado pode pausar, pular, voltar, mexer na barra e escolher música sem sair da sessão.
// O pedido vai para o anfitrião ('ctl'); só o anfitrião mexe no player e manda o novo estado.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require.resolve('../app/music.js'), 'utf8').replace('export function createMusic', 'function createMusic');
const ctx = vm.createContext({ performance, setTimeout, clearTimeout, setInterval: () => 0, cancelAnimationFrame: () => {}, requestAnimationFrame: () => 0 });
vm.runInContext(src + '\nthis.createMusic = createMusic;', ctx);
const sent = [], toasts = [];
const room = { send: (to, d) => sent.push([to, d]), users: () => [{ id: 'g', name: 'Gui' }, { id: 'h', name: 'Ana' }], now: () => 0, me: () => 'me' };
const music = ctx.createMusic({ settings: {}, saveSettings() {}, icon: () => '', toast: (...a) => toasts.push(a), roomUI: null, native: null, esc: (s) => s, room });
const d = music._debug, jam = (o) => { d.st.jam = { ...d.st.jam, ...o }; };

// Convidado: pedidos vão para o anfitrião e ele continua convidado.
jam({ role: 'guest', host: 'h' });
assert.equal(d.jamAsk('toggle'), true);
assert.equal(d.jamAsk('seek', { ms: 5000 }), true);
assert.deepEqual(sent.map((s) => [s[0], s[1].k, s[1].a]), [['h', 'ctl', 'toggle'], ['h', 'ctl', 'seek']]);
assert.equal(d.st.jam.role, 'guest', 'mexer nos controles não tira o convidado da sessão');
assert.ok(!sent.some((s) => s[1].k === 'leave'));
d.pick({ uri: 'spotify:track:abc', name: 'X', artists: 'Y', ctx: { uri: 'spotify:playlist:p1', name: 'P' } });
assert.equal(sent.at(-1)[1].a, 'play');
assert.equal(sent.at(-1)[1].track.uri, 'spotify:track:abc');
// Fora da sessão não há pedido.
jam({ role: null, host: null }); assert.equal(d.jamAsk('toggle'), false);

// Anfitrião: aplica o pedido de convidado e ignora quem não está na sessão.
const calls = [];
d.st.player = { togglePlay: () => calls.push('toggle'), seek: (ms) => calls.push('seek:' + ms), pause: () => calls.push('pause'), resume: () => calls.push('resume'), nextTrack: () => calls.push('next'), previousTrack: () => calls.push('prev') };
d.st.state = { paused: false, position: 0, duration: 200000, track_window: { current_track: { uri: 'spotify:track:t', id: 't' } } };
d.st.current = { uri: 'spotify:track:t', ctx: { uri: 'spotify:playlist:p1' } };
jam({ role: 'host', host: null, guests: new Set(['g']) });
let t0 = 1000; ctx.Date = { now: () => (t0 += 400) };
music.onListen('g', { k: 'ctl', a: 'pause' });
music.onListen('g', { k: 'ctl', a: 'seek', ms: 999999999 });
music.onListen('g', { k: 'ctl', a: 'next' });
music.onListen('x', { k: 'ctl', a: 'pause' });
assert.deepEqual(calls, ['pause', 'seek:200000', 'next'], 'só convidado da sessão controla; seek fica dentro da faixa');
music.onListen('g', { k: 'ctl', a: 'pause' }); t0 -= 300; music.onListen('g', { k: 'ctl', a: 'pause' });
assert.equal(calls.length, 4, 'pedidos em enxurrada são ignorados');
t0 += 1000; d.st.state.paused = true; music.onListen('g', { k: 'ctl', a: 'resume' });
assert.equal(calls.at(-1), 'resume', 'play explícito (não inverte se o estado divergir)');
t0 += 1000; music.onListen('g', { k: 'ctl', a: 'prev' }); assert.equal(calls.at(-1), 'prev', 'anterior no começo da faixa volta para a faixa anterior da playlist');
d.st.device = 'dev'; d.st.state.paused = false;
t0 += 1000; music.onListen('g', { k: 'ctl', a: 'play', track: { uri: 'javascript:alert(1)', name: 'x' } });
t0 += 1000; music.onListen('g', { k: 'ctl', a: 'play', track: { uri: 'spotify:track:ok', ctx: { uri: 'https://evil' } } });
assert.equal(d.st.current.uri, 'spotify:track:t', 'pedido com URI inválida é ignorado');
t0 += 1000; music.onListen('g', { k: 'ctl', a: 'play', track: { uri: 'spotify:track:ok1', name: 'Boa', cover: 'javascript:x', img: 'https://i.scdn.co/a.jpg', ctx: { uri: 'spotify:album:al1', name: 'Alb' } } });
assert.equal(d.st.current.uri, 'spotify:track:ok1', 'pedido válido toca no anfitrião');
assert.equal(d.st.current.cover, '', 'URL que não é https é descartada'); assert.equal(d.st.current.img, 'https://i.scdn.co/a.jpg');
assert.equal(d.st.current.ctx.kind, 'album');
// Convidado não executa pedidos de outros convidados.
const before = calls.length; jam({ role: 'guest', host: 'h', guests: new Set() });
music.onListen('g', { k: 'ctl', a: 'toggle' });
assert.equal(calls.length, before);
console.log('PASS: convidado controla o player do ouvir junto sem sair da sessão');

// "+" do convidado: vai para a fila do anfitrião (validado e limitado), não para uma fila local que nunca toca.
{
  const at = sent.length;
  jam({ role: 'guest', host: 'h' });
  d.enqueue({ uri: 'spotify:track:q1', name: 'Q1', artists: 'A' });
  assert.equal(sent.length, at + 1); assert.equal(sent.at(-1)[1].a, 'add');
  assert.equal(d.st.queue.length, 0, 'convidado não enfileira localmente');
  jam({ role: 'host', host: null, guests: new Set(['g']) });
  t0 += 1000; music.onListen('g', { k: 'ctl', a: 'add', track: { uri: 'spotify:track:q1', name: 'Q1' } });
  t0 += 1000; music.onListen('g', { k: 'ctl', a: 'add', track: { uri: 'x:y', name: 'ruim' } });
  t0 += 1000; music.onListen('g', { k: 'ctl', a: 'add', track: { uri: null, ctx: { uri: 'spotify:album:al1' } } });
  assert.deepEqual([...d.st.queue.map((q) => q.uri)], ['spotify:track:q1'], 'só faixa válida entra na fila do anfitrião');
}
// "A seguir": mostra o que o Spotify já tem na sequência (next_tracks), só faixas.
d.st.state = { track_window: { next_tracks: [{ uri: 'spotify:track:n1', name: 'N1', artists: [{ name: 'Z' }] }, { uri: 'spotify:episode:e', name: 'E' }, { uri: 'spotify:track:n2', name: 'N2', artists: [] }] } };
assert.deepEqual([...d.upcoming().map((x) => x.uri)], ['spotify:track:n1', 'spotify:track:n2']);
d.st.state = null; assert.equal(d.upcoming().length, 0);
console.log('PASS: fila do convidado vai ao anfitrião; "A seguir" mostra as próximas do Spotify');
d.st.state = { context: { uri: 'spotify:playlist:pl1', metadata: { context_description: 'Minha lista' } } };
assert.equal(d.playerCtx().uri, 'spotify:playlist:pl1'); assert.equal(d.playerCtx().kind, 'playlist'); assert.equal(d.playerCtx().name, 'Minha lista');
d.st.state = { context: { uri: 'spotify:user:x:collection' } }; assert.equal(d.playerCtx(), null);
d.st.state = null; assert.equal(d.playerCtx(), null);
// limite de 100 na fila do anfitrião
{ jam({ role: 'host', host: null, guests: new Set(['g']) }); d.st.queue.length = 0; for (let i = 0; i < 100; i++) d.st.queue.push({ uri: 'spotify:track:f' + i });
  t0 += 1000; music.onListen('g', { k: 'ctl', a: 'add', track: { uri: 'spotify:track:extra', name: 'e' } }); assert.equal(d.st.queue.length, 100, 'fila cheia recusa'); }
console.log('PASS: contexto real do player e limite da fila');
