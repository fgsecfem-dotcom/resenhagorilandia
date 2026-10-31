const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const props = {}, classes = {};
const appearance = { matches: false, addEventListener: (_, fn) => { appearance.change = fn; } };
const ctx = vm.createContext({ window: {}, matchMedia: () => appearance, document: { documentElement: { style: { setProperty: (k,v) => props[k]=v }, classList: { toggle: (k,v) => classes[k]=v } } } });
vm.runInContext(fs.readFileSync(require.resolve('../app/themes.js'),'utf8'),ctx);
ctx.window.applyTheme('system'); assert.equal(classes.light, true); assert.equal(props['--bg-main'], '#ffffff');
appearance.matches=true;appearance.change();assert.equal(classes.light,false);assert.equal(props['--bg-main'],'#0e0e10');
ctx.window.applyTheme('arcLight');appearance.change();assert.equal(classes.light,true,'manual override stays light');
for(const key of Object.keys(ctx.window.PALETTES)) {
 ctx.window.applyTheme('system',key);const lightAccent=props['--blurple'];
 appearance.matches=true;appearance.change();assert.equal(classes.light,false);assert.ok(props['--tone-lilac']);
 appearance.matches=false;appearance.change();assert.equal(classes.light,true);assert.ok(props['--blurple']);
}
console.log('PASS: system theme reacts live and preserves manual override');

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
