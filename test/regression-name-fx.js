// 2.1.5: efeito do nome viaja com o perfil; o servidor só aceita efeitos conhecidos.
const assert = require('node:assert/strict'), fs = require('fs');
const { applyProfileExtras, NAME_FX } = require('../server/profile-extras');
const u = {};
applyProfileExtras(u, { nameFx: 'holo', nameColor: '#a4d9ff' }); assert.equal(u.nameFx, 'holo'); assert.equal(u.nameColor, '#a4d9ff');
applyProfileExtras(u, { nameFx: '<script>' }); assert.equal(u.nameFx, '');
applyProfileExtras(u, { nameFx: 'neon' }); applyProfileExtras(u, { status: 'oi' }); assert.equal(u.nameFx, 'neon', 'campo ausente não apaga o efeito');
const src = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
for (const k of NAME_FX) assert(src.includes(k + ": '"), 'efeito ' + k + ' tem nome no app');
assert(/nameFx: me\.nameFx/.test(src), 'perfil envia o efeito');
console.log('PASS: efeitos do nome: ' + NAME_FX.join(', ') + '; valores desconhecidos viram vazio');
