// 2.1.5: efeito do nome viaja com o perfil; o servidor só aceita efeitos conhecidos.
// 3.0: só ouro e gelo; os cinco antigos (holo, rainbow, neon, fogo, glitch) viram Nenhum, no servidor e no app.
const assert = require('node:assert/strict'), fs = require('fs');
const { applyProfileExtras, NAME_FX } = require('../server/profile-extras');
const u = {};
applyProfileExtras(u, { nameFx: 'ouro', nameColor: '#a4d9ff' }); assert.equal(u.nameFx, 'ouro'); assert.equal(u.nameColor, '#a4d9ff');
applyProfileExtras(u, { nameFx: '<script>' }); assert.equal(u.nameFx, '');
applyProfileExtras(u, { nameFx: 'gelo' }); applyProfileExtras(u, { status: 'oi' }); assert.equal(u.nameFx, 'gelo', 'campo ausente não apaga o efeito');
for (const old of ['holo', 'rainbow', 'neon', 'fogo', 'glitch']) { applyProfileExtras(u, { nameFx: old }); assert.equal(u.nameFx, '', 'efeito retirado ' + old + ' vira Nenhum'); }
assert.deepEqual(NAME_FX, ['ouro', 'gelo']);
const src = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
for (const k of NAME_FX) assert(src.includes(k + ": '"), 'efeito ' + k + ' tem nome no app');
assert(/nameFx: cleanNameFx\(me\.nameFx\)/.test(src), 'perfil envia o efeito (já limpo)');
assert(/cleanNameFx\(u\?\.nameFx\)/.test(src), 'o app limpa o efeito de quem vem de fora');
assert(/me\.nameFx && cleanNameFx\(me\.nameFx\) !== me\.nameFx/.test(src), 'perfil salvo com efeito retirado migra para Nenhum');
assert(src.includes('id="st-photo"'), 'a foto tem botão na mesma linha do banner');
const css = fs.readFileSync(require.resolve('../app/glass.css'), 'utf8');
assert(!/\.uname\.fx-(holo|rainbow|neon|fogo|glitch)\s*[{,]/.test(css), 'os cinco efeitos retirados saíram do CSS');
console.log('PASS: efeitos do nome: ' + NAME_FX.join(', ') + '; valores desconhecidos e retirados viram vazio');
