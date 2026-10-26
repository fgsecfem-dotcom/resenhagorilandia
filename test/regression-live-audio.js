// Live audio test (1.6): each simulated Windows failure must be reported at the right step,
// the capture must always be stopped and the report must not carry names or addresses.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const client = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
const code = client.slice(client.indexOf('// ---------- Teste do som da live'), client.indexOf('function openLiveAudioTest('));
const main = fs.readFileSync(require.resolve('../main.js'), 'utf8');
assert(/ipcMain\.handle\('capture:system'/.test(main), 'main exposes capture:system');
assert(/captureSystem: \(\) => ipcRenderer\.invoke\('capture:system'\)/.test(fs.readFileSync(require.resolve('../preload.js'), 'utf8')), 'preload exposes captureSystem');

function scenario({ compatibility = false, audioSupported = true, release = '10.0.19045', error = null, track = true, marker, receipt = false, level = 0.2 }) {
  const status = [], stopped = [];
  const audioTrack = { readyState: 'live', getSettings: () => ({ ...(marker === undefined ? {} : { restrictOwnAudio: marker }), sampleRate: 48000, channelCount: 2 }), stop() { stopped.push('audio'); } };
  const videoTrack = { stop() { stopped.push('video'); } };
  const stream = { getAudioTracks: () => track ? [audioTrack] : [], getTracks: () => track ? [videoTrack, audioTrack] : [videoTrack] };
  const ctx = vm.createContext({
    sleep: async () => {}, LS: { get: () => true }, Date, JSON, Math, Number, String, Object, Float32Array,
    MediaStream: class { constructor(t) { this.t = t; } },
    AudioContext: class { createMediaStreamSource() { return { connect() {}, disconnect() {} }; } createAnalyser() { return { fftSize: 0, getFloatTimeDomainData: b => b.fill(level) }; } async close() {} },
    native: { captureSystem: async () => ({ platform: 'win32', release, electron: '44.4.5' }), version: async () => '1.6.0',
      captureInfo: async token => token ? { isolatedAudioConfirmed: receipt, sourceId: 'screen:1:0' } : { compatibility, audioSupported },
      selectScreen: async () => ({ captureToken: 'one' }), captureStatus: async s => { status.push(s); } },
    navigator: { mediaDevices: { getDisplayMedia: async () => { if (error) throw Object.assign(new Error('falhou'), { name: error }); return stream; } } },
  });
  vm.runInContext(code, ctx);
  return { ctx, status, stopped };
}
(async () => {
  const run = async (opts) => { const s = scenario(opts); const r = await s.ctx.runLiveAudioTest('screen:1:0'); return { r, ...s }; };
  let t = await run({ compatibility: true }); assert.equal(t.r.verdict.step, 'compat'); assert.equal(t.status.length, 0, 'no capture when compatibility mode is on');
  t = await run({ audioSupported: false, release: '10.0.18363' }); assert.equal(t.r.verdict.step, 'windows'); assert.match(t.r.verdict.text, /18363/);
  t = await run({ error: 'NotReadableError' }); assert.equal(t.r.verdict.step, 'capture'); assert.equal(t.status.at(-1).stage, 'audio-test');
  t = await run({ track: false }); assert.equal(t.r.verdict.step, 'track'); assert(t.stopped.includes('video'));
  t = await run({ marker: false, receipt: true }); assert.equal(t.r.verdict.step, 'isolation', 'an explicit false is never accepted');
  t = await run({ marker: undefined, receipt: false }); assert.equal(t.r.verdict.step, 'isolation', 'missing flag needs the native receipt');
  t = await run({ marker: undefined, receipt: true, level: 0 }); assert.equal(t.r.verdict.step, 'silent'); assert(t.stopped.includes('audio') && t.stopped.includes('video'));
  t = await run({ marker: true, level: 0.2 }); assert.equal(t.r.verdict.step, 'ok'); assert(t.r.peakDb > -60);
  const text = t.ctx.liveAudioReportText(t.r); assert.match(text, /build 19045/); assert.match(text, /restrictOwnAudio=true/);
  assert(!/\\Users\\|@|\d+\.\d+\.\d+\.\d+:/.test(text), 'report has no paths, emails or addresses');
  assert.equal(t.status.at(-1).active, false, 'capture state is cleared after the test');
  console.log('PASS: live audio test reports compatibility, old Windows, capture refusal, missing track, unconfirmed isolation and silence; always stops the capture; privacy-safe report');
})().catch(e => { console.error(e); process.exitCode = 1; });
