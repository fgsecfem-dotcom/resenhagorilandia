// 2.4: filtro de ruído. No PC o DeepFilterNet3 assume quando fica pronto e o RNNoise fica de reserva;
// o celular continua só com o RNNoise (o PWA não leva os 22 MB do DeepFilterNet3).
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { declaration } = require('./helpers/characterization-client');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/client.js'), 'utf8');

const node = (name) => ({ name, links: new Set(), msgs: [], connect(n) { this.links.add(n.name); return n; }, disconnect(n) { if (n) this.links.delete(n.name); else this.links.clear(); }, port: { postMessage(m) { this.owner.msgs.push(m); } } });
const mk = (name) => { const n = node(name); n.port.owner = n; return n; };
const V = { micGain: mk('mic'), pre: mk('pre'), rn: mk('rn'), dfn: mk('dfn'), dfnReady: false, dfnDispose: () => (V.disposed = true) };
const settings = { aiNoise: true, vadSens: 60 };
const toasts = [];
const ctx = vm.createContext({ V, settings, toast: (m) => toasts.push(m), WEB_VIEWER: false });
vm.runInContext(['applyNoiseMode', 'dropDeepFilterNet'].map((n) => declaration(source, n)).join('\n') + '\nthis.apply = applyNoiseMode; this.drop = dropDeepFilterNet;', ctx);
const route = () => [...V.micGain.links].sort().join(',') + ' | ' + ['rn', 'dfn'].map((k) => V[k] ? k + '>' + [...V[k].links].join('+') : k + ':-').join(' ');

ctx.apply();
assert.equal(route(), 'rn | rn>pre dfn>', 'antes do DeepFilterNet3 ficar pronto, vale o RNNoise');
assert.deepEqual(JSON.parse(JSON.stringify(V.rn.msgs.at(-1))), { gate: true, thr: 1 - 60 / 100 * 0.9, holdMs: 350 });
V.dfnReady = true; ctx.apply();
assert.equal(route(), 'dfn | rn> dfn>pre', 'pronto: o DeepFilterNet3 assume e o RNNoise sai do caminho');
settings.aiNoise = false; ctx.apply();
assert.equal(route(), 'pre | rn> dfn>', 'filtro desligado: microfone direto');
settings.aiNoise = true; ctx.apply();
ctx.drop(true);
assert.equal(V.disposed, true); assert.equal(V.dfn, null); assert.equal(V.dfnReady, false);
assert.equal(route(), 'rn | rn>pre dfn:-', 'PC sobrecarregado: volta para o RNNoise');
assert.equal(toasts.length, 1);
ctx.drop(true); assert.equal(toasts.length, 1, 'avisa uma vez só');

// Arquivos do DeepFilterNet3 no app de PC, fora do PWA.
for (const f of ['deepfilternet.js', 'assets/deepfilternet-worklet-processor.js', 'assets/deepfilternet/df_bg.wasm', 'assets/deepfilternet/DeepFilterNet3_onnx.tar.gz', 'LICENSE']) assert(fs.existsSync(path.join(root, 'app/vendor/dfn3', f)), f);
const pwa = fs.readFileSync(path.join(root, 'pwa/build-pwa.js'), 'utf8');
const skip = new Function('return ' + pwa.match(/const SKIP = (\/.*\/);/)[1])();
assert(skip.test('dfn3') && !skip.test('ns') && !skip.test('client.js'), 'o PWA não leva o DeepFilterNet3');
console.log('PASS: DeepFilterNet3 no PC com RNNoise de reserva (pronto, desligado, sobrecarga) e fora do PWA');
