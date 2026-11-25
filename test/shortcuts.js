const assert = require('node:assert/strict');
const { shortcutKey, SHORTCUT_ACTIONS } = require('../overlay/detect');
assert.deepEqual(SHORTCUT_ACTIONS, ['mute', 'deafen', 'ptt', 'share', 'leave', 'chat', 'liveFull']);
for (const k of ['F9', 'Control+Shift+F9', 'Alt+Insert', 'Command+F12', 'Control+num1']) assert.equal(shortcutKey(k), k);
for (const k of ['', 'Escape', 'Control+Control+F9', 'Control+Shift', {}, 'F25', 'Control+F8\n']) assert.equal(shortcutKey(k), '');
assert.equal(shortcutKey('F9', true), 'F9');
assert.equal(shortcutKey('Control+F9', true), '');
assert.equal(shortcutKey('num1', true), '');
console.log('PASS: ações explícitas e validação das teclas globais e de apertar para falar');

const { EventEmitter } = require('node:events');
const { createTalkKey } = require('../overlay/main');
const timers = new Map(), sent = [], requests = [];
let processStub, id = 0, stops = 0;
const tick = (delay) => {
  const entry = [...timers].find(([, t]) => t.delay === delay);
  assert(entry, `temporizador de ${delay} ms`); timers.delete(entry[0]); entry[1].fn();
};
const talk = createTalkKey((action) => sent.push(action), {
  platform: 'win32',
  setTimer(fn, delay) { timers.set(++id, { fn, delay }); return id; },
  clearTimer(key) { timers.delete(key); },
  startHelper() {
    const stdout = Object.assign(new EventEmitter(), { setEncoding() {} });
    const stdin = Object.assign(new EventEmitter(), { write: (value) => requests.push(value), end() {} });
    return processStub = Object.assign(new EventEmitter(), { stdin, stdout, kill: () => ++stops });
  },
});
const answer = (line) => processStub.stdout.emit('data', line + '\n');
talk.setKey('F9');
assert.deepEqual(requests, ['ping\n']);
talk.press(); assert.deepEqual(sent, [], 'sem confirmação não pode abrir microfone');
answer('pong'); talk.press(); assert.equal(requests.at(-1), 'key 120\n');
answer('down'); assert.deepEqual(sent, ['ptt-down']);
tick(25); answer('up'); assert.deepEqual(sent, ['ptt-down', 'ptt-up']);
talk.press(); answer('down'); tick(25); tick(300);
assert.deepEqual(sent, ['ptt-down', 'ptt-up', 'ptt-down', 'ptt-cancel']);
assert.equal(stops, 1); assert.equal(timers.size, 0);
talk.dispose();
console.log('PASS: apertar para falar aguarda a confirmação, fecha ao soltar e corta o áudio na perda do leitor');
