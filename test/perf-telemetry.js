// Desempenho anônimo: o resumo só leva números (sem nome, sala, IP ou driver), o Worker valida e grava,
// e o app coleta durante a call com a opção ligada por padrão.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const ctx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(require.resolve('../app/performance.js'), 'utf8'), ctx);
const P = ctx.window.ResenhaPerf;

const proc = (cpu) => ({ processes: [{ type: 'Browser', cpuElectronPercent: 1, workingSetKB: 102400 }, { type: 'Tab', cpuElectronPercent: cpu, workingSetKB: 204800 }] });
const media = [
  { peer: 0, type: 'outbound-rtp', codec: 'video/H264', framesPerSecond: 30, frameHeight: 720, encoderImplementation: 'NVIDIA', qualityLimitationReason: 'bandwidth' },
  { peer: 0, type: 'inbound-rtp', framesPerSecond: 24, frameHeight: 540, framesDecoded: 90, framesDropped: 10, decoderImplementation: 'D3D11' },
  { peer: 0, type: 'connection', rtt: 0.04 },
  { peer: 0, type: 'source', framesPerSecond: 12 },
];
const call = { peers: 2, sharing: true, quality: '720p30', viewers: 1, watching: 0, host: true, viaRelay: 1, directOnly: 0, relaying: 2 };

(() => {
  assert.equal(P.summarize([], {}), null);
  assert.equal(P.summarize([P.sample(proc(5), [], call)], {}), null, 'a 1ª leitura (antes da call) não conta');
  const samples = [P.sample(proc(90), media, call), P.sample(proc(4), media, call), P.sample(proc(8), media, call)];
  const r = P.summarize(samples, { install: 'a'.repeat(32) });
  assert.equal(r.schema, 1);
  assert.equal(r.samples, 2);
  assert.equal(r.cpu.avg, 7, 'média sem a 1ª leitura: (5 + 9) / 2');
  assert.equal(r.cpu.max, 9);
  assert.equal(r.cpu.by.Tab, 6);
  assert.equal(r.ramMB.avg, 300);
  assert.equal(r.sent.encoder, 'NVIDIA');
  assert.deepEqual({ ...r.sent.limited }, { bandwidth: 2 });
  assert.equal(r.received.droppedPct, 10);
  assert.equal(r.rttMs.avg, 40);
  assert.deepEqual({ ...r.ramMB.by }, { Browser: 100, Tab: 200 }, 'memória por processo');
  assert.equal(r.sent.sourceFps, 12, 'FPS da captura separa tela parada de falta de banda');
  assert.equal(r.hostPct, 100);
  assert.deepEqual({ ...r.relay }, { viaRelayMax: 1, directOnlyMax: 0, relayingMax: 2 });
  assert.ok(JSON.stringify(r).length < 2048, 'resumo pequeno');
  console.log('PASS: resumo de desempenho descarta a 1ª leitura e fica pequeno');
})();

(() => {
  const sys = { version: '2.4.0', platform: 'win32', release: '10.0.26200', arch: 'x64', cpu: 'CPU X', logicalProcessors: 12, totalMemoryBytes: 16 * 1073741824, compatibility: false,
    gpu: { gpuDevice: [{ active: true, vendorId: 4318, deviceId: 9876, driverVersion: '555.1', deviceString: 'Placa do Fulano' }], auxAttributes: { machineModelName: 'PC-DO-FULANO' } } };
  const s = P.system(sys);
  assert.deepEqual({ ...s.gpu }, { vendor: 4318, device: 9876 });
  assert.equal(s.ramGB, 16);
  const text = JSON.stringify(s);
  for (const bad of ['555.1', 'Fulano', 'FULANO']) assert.ok(!text.includes(bad), 'não envia ' + bad);
  console.log('PASS: dados do PC vão sem driver nem nome da máquina');
})();

(() => {
  const src = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
  assert.match(src, /perfTelemetry: true/, 'ligado por padrão');
  assert.match(src, /renderAll\(\);\r?\n  perfStart\(\);\r?\n\}\r?\nfunction leaveVoice/, 'começa ao entrar na voz');
  assert.match(src, /function teardownVoice\(\) \{\r?\n  if \(perf\.timer\) perfStop\(\);/, 'envia ao sair da voz');
  assert.match(src, /id="st-perf"/, 'opção para desligar');
  assert.match(src, /LS\.get\('perfNotice', false\)/, 'aviso uma vez só');
  assert.match(src, /quality: V\.screen \? V\.screenQName \|\| null/, 'qualidade vai como nome (ex.: 720p30), não como objeto');
  assert.match(src, /observe\(\{ type: 'longtask' \}\)/, 'conta as travadinhas da call');
  assert.match(src, /longTasks: jank/, 'manda as travadinhas no resumo');
  console.log('PASS: app coleta na call, avisa uma vez e deixa desligar');
})();

(async () => {
  const { savePerf } = await import(pathToFileURL(path.join(__dirname, '..', 'signal-worker', 'src', 'index.js')).href);
  const rows = [];
  const PERF = { prepare: (sql) => ({ bind: (...a) => ({ run: async () => rows.push({ sql, a }) }) }) };
  const req = (body, method = 'POST') => new Request('https://x/perf', { method, body: method === 'POST' ? body : undefined, headers: { 'CF-Connecting-IP': '203.0.113.9' } });
  const good = JSON.stringify({ schema: 1, install: 'b'.repeat(32), version: '2.4.0', platform: 'win32', cpu: { avg: 3 } });
  assert.equal((await savePerf(req(good), {})).status, 204, 'sem banco: descarta');
  assert.equal((await savePerf(req(good, 'GET'), { PERF })).status, 405);
  assert.equal((await savePerf(req('{'), { PERF })).status, 400);
  assert.equal((await savePerf(req(JSON.stringify({ schema: 1, install: 'x', version: '2.4.0' })), { PERF })).status, 400);
  assert.equal((await savePerf(req('x'.repeat(9000)), { PERF })).status, 413);
  assert.equal((await savePerf(req(good), { PERF }, 1000)).status, 204);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].a.slice(0, 4), [1000, 'b'.repeat(32), '2.4.0', 'win32']);
  assert.ok(!JSON.stringify(rows).includes('203.0.113.9'), 'IP não é gravado');
  console.log('PASS: Worker valida o resumo, grava sem IP e aguenta sem banco');
})().catch((e) => { console.error(e); process.exit(1); });
