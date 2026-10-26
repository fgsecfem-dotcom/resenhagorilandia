// 2.1.3: live recebida por repasse com qualidade ruim por ~8 s passa a vir direto de quem transmite.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { declaration } = require('./helpers/characterization-client');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');

function run(stats) {
  const signals = [], toasts = []; let now = 1_000_000, bytes = 0;
  const track = { kind: 'video' }, stream = { getVideoTracks: () => [track] };
  const relayPc = { getStats: async () => { bytes += stats.kbps * 2000 / 8; return new Map([['v', { type: 'inbound-rtp', kind: 'video', bytesReceived: bytes, frameHeight: stats.height, framesPerSecond: stats.fps }]]); } };
  const V = { relayVia: new Map([['streamer', 'relay']]), watching: new Map([['streamer', 'live-1']]), directOnly: new Set(),
    peers: new Map([['relay', { uid: 'relay', pc: relayPc, streams: new Map([['live-1', stream]]) }]]) };
  const ctx = vm.createContext({ V, S: { users: new Map([['streamer', { name: 'Lukinha' }]]) }, relayHealth: new Map(), Date: { now: () => now },
    sig: (to, data) => signals.push({ to, data }), toast: (t) => toasts.push(t), native: {} });
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
  const lowFps = await run({ kbps: 3000, height: 1080, fps: 9 });
  assert(lowFps.V.directOnly.has('streamer'), 'poucos quadros também conta');
  console.log('PASS: repasse fraco (imagem baixa, poucos quadros ou pouca taxa) volta para o direto; repasse bom é mantido');
})().catch((e) => { console.error(e); process.exitCode = 1; });
