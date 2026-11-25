const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const props = {}, classes = {};
const appearance = { matches: false, addEventListener: (_, fn) => { appearance.change = fn; } };
const ctx = vm.createContext({ window: {}, matchMedia: () => appearance, document: { documentElement: { dataset: {}, style: { setProperty: (k,v) => props[k]=v }, classList: { toggle: (k,v) => classes[k]=v } } } });
vm.runInContext(fs.readFileSync(require.resolve('../app/themes.js'),'utf8'),ctx);
const W = ctx.window;
// Seis temas, nessa ordem; todo tema antigo cai num deles.
assert.deepEqual([...W.VISIBLE_THEMES], ['resenha','vidro','sintonia','ape','caderno','mergulho']);
for (const k of W.VISIBLE_THEMES) assert.ok(W.THEMES[k], 'tema existe: ' + k);
for (const [old, now] of Object.entries(W.RETIRED_THEMES)) { assert.ok(W.VISIBLE_THEMES.includes(now), old + ' vai para um tema visível'); assert.ok(!W.VISIBLE_THEMES.includes(old)); }
for (const [old, p] of Object.entries(W.RETIRED_PALETTES)) assert.ok(W.RESENHA_PALETTES[p], 'paleta de ' + old + ' existe');
// Automático segue o Windows ao vivo (Lona no claro, Pipoca no escuro); paleta escolhida fica.
W.applyTheme('resenha','auto'); assert.equal(classes.light, true); assert.equal(props['--bg-main'], '#f3eee6');
appearance.matches=true;appearance.change();assert.equal(classes.light,false);assert.equal(props['--bg-main'],'#17161a');
W.applyTheme('resenha','gelo');appearance.matches=false;appearance.change();assert.equal(props['--bg-main'],'#eef1f4','paleta escolhida não muda com o Windows');
W.applyTheme('arcLight','auto'); assert.equal(ctx.document.documentElement.dataset.tk, 'resenha', 'tema antigo vira Resenha');
// Contraste: texto, secundário, texto no destaque e destaque em texto passam de 4,5:1 em todas as paletas e temas.
const C = W.colorContrast;
const all = [...Object.keys(W.RESENHA_PALETTES).map((k) => [k, W.resenhaTokens(k)]), ...W.VISIBLE_THEMES.filter((k) => W.THEMES[k].c).map((k) => [k, W.themePreview(k)])];
for (const [k, v] of all) {
 for (const [fg, bg] of [['text','bg-main'],['muted','bg-main'],['muted2','bg-main'],['on-accent','accent'],['link','bg-main']]) assert.ok(C(v[fg], v[bg]) >= 4.5, `${k}: ${fg} sobre ${bg} = ${C(v[fg], v[bg]).toFixed(2)}`);
 if (v['side-text']) { assert.ok(C(v['side-text'], v.c30) >= 4.5); assert.ok(C(v['side-muted'], v.c30) >= 4.5, k + ' lateral'); }
}
console.log('PASS: seis temas, migração dos antigos, Automático ao vivo e contraste das paletas');

// Janela escondida: as animações decorativas pausam (sem mudar o visual com a janela em uso).
{
 const client = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
 const pro = fs.readFileSync(require.resolve('../app/themes-pro.css'), 'utf8'), glass = fs.readFileSync(require.resolve('../app/glass.css'), 'utf8');
 const sync = client.match(/const syncBgPaused = \(\) => (.+);\r?\n/);
 assert.ok(sync, 'syncBgPaused existe');
 const html = { classList: { set: {}, toggle(name, on) { this.set[name] = !!on; } } };
 const run = (windowVisible, hidden) => { vm.runInNewContext('(' + sync[1].replace(/;$/, '') + ')', { document: { documentElement: html, hidden }, V: { windowVisible } }); return html.classList.set['bg-paused']; };
 assert.equal(run(true, false), false); assert.equal(run(false, false), true); assert.equal(run(true, true), true);
 assert.ok((client.match(/syncBgPaused\(\)/g) || []).length >= 2, 'onWindowVisible e visibilitychange chamam syncBgPaused');
 const paused = (css, sel) => css.split(/\r?\n/).some((l) => l.includes('html.bg-paused') && l.includes(sel) && /animation-play-state: paused/.test(css.slice(css.indexOf(l))));
 for (const sel of [':is(#main, #home)::before', ':is(#main, #call)::after', '#call .tile::before']) assert.ok(paused(pro, sel), 'themes-pro pausa ' + sel);
 assert.ok(/html\.bg-paused \.uname\[class\*="fx-"\][^{]*\{ animation-play-state: paused !important; \}/.test(glass), 'glass pausa efeitos de nome');
 assert.ok(!/html\.bg-paused[^{]*\{[^}]*animation:/.test(pro + glass), 'bg-paused só pausa, não troca a animação');
}
console.log('PASS: animações decorativas pausam com a janela escondida');

// O botão pode escurecer ou clarear no hover; cada superfície tem a própria tinta.
for (const [key, v] of [...all, ['vidro', W.themePreview('vidro')]]) {
  for (const [fg, bg] of [['on-accent', 'accent'], ['on-primary', 'blurple'], ['on-primary-hover', 'blurple-h']])
    assert.ok(C(v[fg] || '#ffffff', v[bg]) >= 4.5 && v[fg], `${key}: ${fg} em ${bg}`);
}
for (const c of ['#67b9a0', '#fee75c', '#ff6420', '#a535f5', '#00868a', '#0e0e10']) {
  assert.ok(C(W.avatarInk(c), c) >= 4.5, `Inicial em ${c}`);
}

// A lateral clara tem fundo de tinta escura, enquanto o chat tem fundo de papel.
for (const [key, v] of [...all, ['vidro', W.themePreview('vidro')]]) {
  W.applyTheme(W.THEMES[key] ? key : 'resenha', key);
  const side = v['side-text'] ? [v.c30, v['side-hover'], v['side-active']] : [v['bg-side'], v.hover, v.active];
  for (const c of ['#fee75c', '#57f287', '#5865f2', '#ff6420', '#321432', '#ffffff', '#000000']) {
    for (const bg of side) assert.ok(C(W.readableColor(c, 'sidebar'), bg) >= 4.5, `${key}: ${c} na lista`);
    for (const bg of [v['bg-main'], v['bg-panel'], v['bg-input'], v['bg-float'], v.active]) assert.ok(C(W.readableColor(c), bg) >= 4.5, `${key}: ${c} no chat`);
  }
  for (const bg of side) assert.ok(C(v['side-speak'], bg) >= 3, `${key}: anel na lista`);
}

for (const [key, v] of all) {
  for (const bg of ['bg-main', 'bg-panel', 'bg-input', 'bg-float']) assert.ok(C(v.focus, v[bg]) >= 3, `${key}: foco em ${bg}`);
  if (v['side-text']) assert.ok(C(v['focus-inv'], v.c30) >= 3, `${key}: foco na lateral escura`);
}
