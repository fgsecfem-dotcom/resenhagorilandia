// 2.5: o filtro de ruído (DeepFilterNet3) carrega ao entrar na sala, não ao entrar na voz, porque carregar na
// hora travava a tela por ~0,5 s. Entrar na voz no meio do pré-carregamento não pode montar o áudio pela metade.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { declaration } = require('./helpers/characterization-client');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');

function setup() {
  let contexts = 0, timers = [];
  const node = () => ({ connect() { return this; }, disconnect() {}, gain: { value: 1 }, fftSize: 0, port: {} });
  class AudioContext {
    constructor() { contexts++; this.state = 'running'; this.destination = node(); this.audioWorklet = { addModule: () => new Promise((r) => setTimeout(r, 20)) }; }
    createGain() { return node(); } createAnalyser() { return node(); } createMediaStreamDestination() { return { ...node(), stream: {} }; }
    async resume() { this.state = 'running'; } async suspend() { this.state = 'suspended'; }
  }
  const V = { ctx: null, deafened: false, joined: false, testing: false, voiceAttempt: 0 };
  const ctx = vm.createContext({ V, settings: { micGain: 100 }, WEB_VIEWER: false, WEB_VOICE: false, AudioContext, AudioWorkletNode: function () { return node(); },
    RnnoiseWorkletNode: function () { return node(); }, rnBinary: null, fetch: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }),
    applyNoiseMode() {}, loadDeepFilterNet() {}, applyVoiceFx() {}, applyOutputDevice() {}, refreshSpeaking() {}, console,
    setTimeout: (fn, ms) => (ms >= 1000 ? timers.push(fn) : setTimeout(fn, ms)), window: { requestIdleCallback: (fn) => timers.push(fn) } });
  vm.runInContext(['ensureAudio', 'initAudioGraph', 'prewarmVoice'].map((n) => declaration(source, n)).join('\n') + '\nvar voiceWarm = false;', ctx);
  return { ctx, V, contexts: () => contexts, fire: async () => { const t = timers.splice(0); for (const f of t) await f(); } };
}

(async () => {
  // Duas chamadas ao mesmo tempo (pré-carregamento e entrar na voz): um contexto só, e as duas esperam o áudio pronto.
  const a = setup();
  const p1 = a.ctx.ensureAudio(), p2 = a.ctx.ensureAudio();
  assert.notEqual(a.V.rnReady, true, 'ainda montando');
  await p2; assert.ok(a.V.rnReady && a.V.fx && a.V.gate, 'a segunda chamada só volta com o áudio montado');
  await p1; assert.equal(a.contexts(), 1, 'um AudioContext só');

  // Pré-carregamento: monta o áudio e deixa pausado enquanto a pessoa não entra na voz.
  const b = setup();
  b.ctx.prewarmVoice(); await b.fire(); await b.fire();
  assert.equal(b.contexts(), 1); assert.equal(b.V.ctx.state, 'suspended', 'fica pausado fora da voz');
  b.ctx.prewarmVoice(); await b.fire(); assert.equal(b.contexts(), 1, 'pré-carrega uma vez só');
  await b.ctx.ensureAudio(); assert.equal(b.V.ctx.state, 'running', 'entrar na voz despausa');

  // Entrou na voz durante o pré-carregamento: não pausa.
  const c = setup();
  c.ctx.prewarmVoice(); await c.fire();
  const pending = c.fire(); c.V.voiceAttempt++; await c.ctx.ensureAudio(); await pending;
  assert.equal(c.V.ctx.state, 'running', 'quem entrou na voz no meio continua com áudio');

  assert.match(source, /syncDJ\(\);\r?\n      prewarmVoice\(\);/, 'pré-carrega ao entrar na sala');
  // Vigiar troca de dispositivo na abertura deixava os serviços de captura de vídeo e de áudio abertos (~157 MB).
  assert.equal((source.match(/addEventListener\?\.\('devicechange'/g) || []).length, 1, 'um registro só');
  assert.match(declaration(source, 'watchDevices'), /devicechange/, 'registrado dentro de watchDevices');
  assert.match(declaration(source, 'joinVoice'), /watchDevices\(\)/, 'só ao entrar na voz');
  console.log('PASS: filtro pré-carrega na sala, pausado; entrar na voz no meio não deixa o áudio pela metade nem mudo; troca de dispositivo só é vigiada na voz');
})().catch((e) => { console.error(e); process.exitCode = 1; });
