// Fundo vivo (2.6): a luz de fundo vem da call na ordem tela > câmera de quem fala > capa da música > nada.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require.resolve('../app/ambient.js'), 'utf8');
const pro = fs.readFileSync(require.resolve('../app/themes-pro.css'), 'utf8');
const html = fs.readFileSync(require.resolve('../app/index.html'), 'utf8');

const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} }, setInterval: () => 0, clearInterval() {} };
vm.runInNewContext(code, ctx);
const { source, W, H, TICK } = ctx.window.resenhaAmbient;

// Documento falso: cada seletor devolve o elemento que o teste quiser.
const doc = (map) => ({ querySelector: (sel) => { for (const [k, v] of Object.entries(map)) if (sel.includes(k)) return v; return null; } });
const video = (w) => ({ tagName: 'VIDEO', videoWidth: w, paused: false });
const cover = { tagName: 'IMG', complete: true, naturalWidth: 300, getAttribute: () => 'capa.jpg' };
const screen = video(1920), cam = video(640);

assert.equal(source(doc({ 'is-screen video': screen, 'speaking video': cam, 'mu-cover': cover })), screen, 'tela transmitida vem primeiro');
assert.equal(source(doc({ 'is-screen video': video(0), 'speaking video': cam, 'mu-cover': cover })), cam, 'tela sem imagem ainda: câmera de quem fala');
assert.equal(source(doc({ 'speaking video': { ...cam, paused: true }, 'mu-cover': cover })), cover, 'sem vídeo: capa da música');
assert.equal(source(doc({ 'mu-cover': { ...cover, getAttribute: () => '' } })), null, 'capa vazia não conta');
assert.equal(source(doc({})), null, 'nada acontecendo: fica o grafite');
console.log('PASS: fundo vivo escolhe a fonte na ordem combinada');

assert.ok(W * H <= 16 * 9 && TICK >= 500, 'leitura minúscula e no máximo 2 vezes por segundo');
assert.ok(!/#ambient[^{]*\{[^}]*filter:[^;}]*blur/.test(pro), 'sem blur ao vivo no fundo vivo');
assert.match(pro, /#ambient\.lit \{ opacity: 1; \}/);
assert.match(html, /<script src="ambient\.js"><\/script>/);
assert.match(code, /THEMES = \/\^vidro\$\//, 'só no tema Vidro');
assert.match(code, /document\.hidden/, 'pausa com a janela escondida');
console.log('PASS: fundo vivo é leve, só no padrão e pausa escondido');
