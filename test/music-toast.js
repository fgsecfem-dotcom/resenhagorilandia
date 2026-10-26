// Issue 7: os avisos da música apareciam só com o título "Música", sem dizer o que deu errado.
// O toast do app é (mensagem, tipo, tempo); o music.js precisa juntar título e texto na mensagem.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require.resolve('../app/music.js'), 'utf8').replace('export function createMusic', 'function createMusic');
const ctx = vm.createContext({ performance, setTimeout, clearTimeout, setInterval: () => 0,cancelAnimationFrame: () => {}, requestAnimationFrame: () => 0 });
vm.runInContext(src + '\nthis.createMusic = createMusic;', ctx);
const calls = [];
const music = ctx.createMusic({ settings: {}, saveSettings() {}, icon: () => '', toast: (...a) => calls.push(a), roomUI: null, native: null, esc: (s) => s, room: null });
music._debug.st.jam = { ...music._debug.st.jam, role: 'guest', host: 'u1' };
music.userLeft('u1');
assert.equal(calls.length, 1);
assert.equal(calls[0][0], 'Ouvir junto: Quem chamou saiu da sala; a sessão acabou.', 'o texto do aviso aparece junto do título');
assert.equal(calls[0][1], '', 'o texto não vira classe CSS');
assert.equal(calls[0][2], 3000);
assert.match(src, /toast\('Música', msg, 5000, 'err'\)/, 'erros de música usam o estilo de erro');
console.log('PASS: avisos da música mostram o texto do erro');
