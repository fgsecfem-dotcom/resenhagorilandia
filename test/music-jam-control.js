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
