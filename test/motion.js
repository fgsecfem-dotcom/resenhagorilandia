// Padrão de movimento (2.6): uma curva, durações curtas e "Reduzir animações" do sistema respeitado.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const read = (f) => fs.readFileSync(require.resolve('../app/' + f), 'utf8');
const motion = read('motion.js'), glass = read('glass.css'), pro = read('themes-pro.css'), music = read('music.css');

// Roda o motion.js num navegador falso e devolve o que ele expõe.
function load(osReduce) {
  const props = {}, classes = new Set();
  const media = { matches: osReduce, addEventListener: (type, fn) => { media[type] = fn; } };
  const el = () => ({ classList: { contains: (c) => classes.has(c), add() {}, remove() {}, toggle() {} }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
  const document = {
    readyState: 'complete', documentElement: { style: { setProperty: (k, v) => { props[k] = v; } }, classList: { contains: (c) => classes.has(c), toggle: (k, v) => v ? classes.add(k) : classes.delete(k) } },
    addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  };
  const ctx = { window: {}, document, matchMedia: () => media, addEventListener() {},
    MutationObserver: class { observe() {} }, ResizeObserver: class { observe() {} }, requestAnimationFrame: () => 0, performance: { now: () => 0 }, setTimeout, console, el };
  vm.runInNewContext(motion, ctx);
  return { api: ctx.window.resenhaMotion, props, classes, media };
}

{
  const { api, props } = load(false);
  assert.equal(api.EASE, 'cubic-bezier(0.23, 1, 0.32, 1)', 'uma curva ease-out forte para tudo');
  for (const [k, v] of Object.entries(api.DUR)) { assert.ok(v <= 350, `${k} até 350 ms (era até 1,5 s)`); assert.equal(props['--dur-' + k], v + 'ms'); }
  assert.ok(api.DUR.exit < api.DUR.modal, 'sair é mais rápido do que entrar');
  assert.ok(api.DUR.menu <= 150, 'menu (uso do dia todo) em até 150 ms');
  assert.equal(props['--spring-press'], api.EASE); assert.equal(props['--spring-move'], api.EASE);
  const layout = api.spring(0.3, 0.95);
  assert.ok(layout.dur <= 400, 'mola de layout termina em até 400 ms');
  assert.ok(Math.max(...layout.samples) <= 1.001, 'mola de layout sem quique');
}
console.log('PASS: padrão de movimento com durações curtas');

{
  // "Reduzir animações" do sistema: o motion.js e o CSS desligam o movimento sem depender da opção do app.
  assert.match(motion, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(motion, /const calm = \(\) => [^;]*osCalm\.matches/);
  assert.ok(/@media \(prefers-reduced-motion: reduce\) \{[^\n]*\r?\n\s*html:not\(\.motion-full\)[^{]+\{[^}]*animation-duration: \.01ms/.test(glass), 'CSS respeita o sistema');
}
console.log('PASS: "Reduzir animações" do sistema vale no app inteiro');

{
  // Nada de ease-in (demora para reagir), nem de quique nas curvas, nem de zoom ao passar o mouse.
  assert.ok(!/['"]ease-in['"]|\bease-in\b(?!-)/.test(motion), 'motion.js sem ease-in');
  assert.ok(!/ease-in[ ;,]/.test(glass), 'glass.css sem ease-in');
  const bouncy = (css) => [...css.matchAll(/cubic-bezier\(([^)]*)\)/g)].map((m) => m[1].split(',').map(Number)).filter((v) => v[1] > 1.05 || v[3] > 1.05);
  assert.deepEqual(bouncy(glass), [], 'glass.css sem curvas que passam do ponto');
  assert.deepEqual(bouncy(pro), [], 'themes-pro.css sem curvas que passam do ponto');
  assert.deepEqual(bouncy(music), [], 'music.css sem curvas que passam do ponto');
  // Exceção: a bolinha de um controle deslizante cresce para mostrar que dá para arrastar.
  assert.ok(![...glass.matchAll(/:hover([^{]*)\{[^}]*scale:\s*1\.\d/g)].some((m) => !/slider-thumb/.test(m[1])), 'hover sem zoom (glass.css)');
  assert.ok(!/:hover[^{]*\{[^}]*(scale\(1\.\d|translateY\(-)/.test(pro), 'hover sem zoom nem subir (themes-pro.css)');
  assert.ok(!/@keyframes msg-in/.test(glass), 'mensagem do chat com uma animação só (a do motion.js)');
  assert.ok(!/rotate\(-?8deg\)/.test(glass), '"O que há de novo" sem giro');
}
console.log('PASS: sem ease-in, quique ou zoom no hover');

{
  const { api, props, classes, media } = load(false);
  for (const [k, v] of Object.entries({click:120, menu:150, exit:200, window:250, layout:350})) assert.equal(props['--dur-' + k], v + 'ms');
  api.setPreference('auto');
  assert.equal(classes.has('reduce-motion'), false);
  media.matches = true; media.change();
  assert.equal(classes.has('reduce-motion'), true);
  api.setPreference(false);
  assert.equal(classes.has('reduce-motion'), false);
  assert.equal(classes.has('motion-full'), true);
  media.matches = false; media.change();
  assert.equal(classes.has('motion-full'), true);
  api.setPreference(true);
  assert.equal(classes.has('reduce-motion'), true);
}
console.log('PASS: Reduzir animações aceita auto, ligado e desligado, e acompanha o Windows');

// Desfocar não equivale a esconder: só as animações entram em repouso depois de 5 s.
{
  const fs = require('node:fs'), vm = require('node:vm');
  const { declaration } = require('./helpers/characterization-client');
  const src = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
  let next = 0, paused = false; const timers = new Map();
  const V = { windowVisible: true }, settings = { keepAnimatingInBackground: false };
  const classList = { toggle(name, on) { paused = on; return paused; }, contains: () => paused };
  const ctx = vm.createContext({ V, settings, window: {}, document: { hidden: false, documentElement: { classList } }, refreshSpeaking() {},
    setTimeout(fn, ms) { assert.equal(ms, 5000); timers.set(++next, fn); return next; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext('let bgBlurTimer = null;\n' + ['syncBgPaused', 'setBackgroundFocus'].map((n) => declaration(src, n)).join('\n'), ctx);
  const blur = () => ctx.setBackgroundFocus(false), focus = () => ctx.setBackgroundFocus(true);
  function elapsed() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((fn) => fn()); }
  blur(); assert.equal(paused, false); focus(); elapsed(); assert.equal(paused, false, 'foco de volta antes do prazo');
  blur(); elapsed(); assert.equal(paused, true); assert.equal(V.windowVisible, true, 'não esconde a live');
  focus(); assert.equal(paused, false, 'volta na hora');
  settings.keepAnimatingInBackground = true; blur(); elapsed(); assert.equal(paused, false);
  V.windowVisible = false; ctx.syncBgPaused(); assert.equal(paused, true, 'minimizar ainda pausa');
}
