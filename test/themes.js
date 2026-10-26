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
