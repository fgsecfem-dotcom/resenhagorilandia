// 2.1.3: live recebida por repasse com qualidade ruim por ~8 s passa a vir direto de quem transmite.
// 2.4.2: tela parada (poucos quadros, pouca taxa, imagem cheia) não é repasse ruim.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { declaration } = require('./helpers/characterization-client');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');

function run(stats) {
  const signals = [], toasts = []; let now = 1_000_000, bytes = 0, frames = 0;
  const track = { kind: 'video' }, stream = { getVideoTracks: () => [track] };
  const relayPc = { getStats: async () => { bytes += stats.kbps * 2000 / 8; frames += Math.round(stats.fps * 2); return new Map([['v', { type: 'inbound-rtp', kind: 'video', bytesReceived: bytes, framesDecoded: frames, frameHeight: stats.height, framesPerSecond: stats.fps }]]); } };
  const V = { relayVia: new Map([['streamer', 'relay']]), watching: new Map([['streamer', 'live-1']]), directOnly: new Set(),
    peers: new Map([['relay', { uid: 'relay', pc: relayPc, streams: new Map([['live-1', stream]]) }]]) };
  const ctx = vm.createContext({ V, S: { users: new Map([['streamer', { name: 'Lukinha' }]]) }, relayHealth: new Map(), Date: { now: () => now },
    sig: (to, data) => signals.push({ to, data }), toast: (t) => toasts.push(t), native: {}, RELAY_VERSION: 2 });
  vm.runInContext(['canRelay', 'watchMsg', 'goDirect', 'checkRelayQuality'].map((n) => declaration(source, n)).join('\n'), ctx);
  return (async () => { for (let i = 0; i < 12; i++) { await ctx.checkRelayQuality(); now += 2000; } return { V, signals: JSON.parse(JSON.stringify(signals)), toasts }; })();
}

(async () => {
  const bad = await run({ kbps: 400, height: 360, fps: 30 });
  assert(bad.V.directOnly.has('streamer'), 'pede direto quando o repasse chega fraco');
  assert.equal(bad.V.relayVia.size, 0);
  assert(bad.signals.some((s) => s.to === 'relay' && s.data.relayWatch === false), 'avisa o repasse para parar');
  assert(bad.signals.some((s) => s.to === 'streamer' && s.data.watch && s.data.noRelay === true), 'pede a live direto');
  assert.match(bad.toasts[0], /Lukinha/);
  const good = await run({ kbps: 4000, height: 1080, fps: 60 });
  assert(!good.V.directOnly.has('streamer') && good.V.relayVia.size === 1 && good.signals.length === 0, 'repasse bom continua');
  const still = await run({ kbps: 120, height: 720, fps: 2 });
  assert(!still.V.directOnly.has('streamer') && still.V.relayVia.size === 1 && still.signals.length === 0, 'tela parada continua no repasse');
  const stalled = await run({ kbps: 0, height: 720, fps: 0 });
  assert(stalled.V.directOnly.has('streamer'), 'quadros parados e nada chegando pede direto');
  console.log('PASS: repasse com imagem rebaixada ou parado volta para o direto; tela parada e repasse bom ficam no repasse');
})().catch((e) => { console.error(e); process.exitCode = 1; });
