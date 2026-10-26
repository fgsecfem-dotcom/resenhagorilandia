// Load actual client functions without relying on adjacent comments or line breaks.
// DOM/media are doubles. WebSocket and the server are real local instances.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function declaration(source, name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(source);
  if (!match) throw Error('Missing client declaration: ' + name);
  for (let end = source.indexOf('}', match.index); end >= 0; end = source.indexOf('}', end + 1)) {
    const candidate = source.slice(match.index, end + 1);
    try { new vm.Script(candidate); return candidate; } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  throw Error('Incomplete client declaration: ' + name);
}

function installBrowserModule(root, relative, context) {
  const file = path.join(root, relative);
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^export /gm, ''), context);
}

function client(root, WebSocket, address, name) {
  const source = fs.readFileSync(path.join(root, 'app/client.js'), 'utf8');
  const local = new Map(), received = [], errors = [], input = { value: '' };
  const noop = () => {};
  const S = { users: new Map(), history: {}, channels: [], typing: new Map(), unread: new Set(), textChannel: 'geral', isHost: false };
  const V = { peers: new Map(), watching: new Map(), joined: false };
  const context = vm.createContext({
    S, V, crypto, input, sending: false, pending: [], native: null, WEB_VIEWER: false,
    DJ_ID: 'dj-resenha', staleRoomWarned: false, savingRoomFailed: false,
    setTimeout: (fn, ms) => { const timer = setTimeout(fn, ms); timer.unref(); return timer; }, clearTimeout,
    document: { hasFocus: () => true, hidden: false }, URL,
    LS: { get: (key, fallback) => local.has(key) ? JSON.parse(local.get(key)) : fallback, set: (key, value) => { local.set(key, JSON.stringify(value)); return true; } },
    toast: (...args) => errors.push(args), fmtCode: code => code.replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.+)$/, '$1-$2'),
    chanById: id => S.channels.find(c => c.id === id), textChannels: () => S.channels.filter(c => c.type === 'text'), voiceChannels: () => S.channels.filter(c => c.type === 'voice'),
    mentionsMe: () => false, extractMentions: () => [], $: () => ({ innerHTML: '' }),
  });
  for (const name of ['hideBanner','closePeer','cacheAttachments','showMain','renderMessages','renderAll','syncDJ','renderTyping','reclassifyStreams','applyUserVolume','renderChatHeader','renderChannels','appendMessage','rerenderMsg','onSignal','renderHeader','updatePing','renderDJPanel','renderCall','openInvite','setConnStatus','sfx','renderFriends','renderDM','autosize','cancelReply','hideMentionPop']) context[name] = noop;
  const begin = source.indexOf('const commandRequests =');
  const end = source.indexOf('// ---------------- Troca automática', begin);
  if (begin < 0 || end < 0) throw Error('Missing request characterization seam');
  // Match function-declaration hoisting in the real browser module.
  vm.runInContext(declaration(source, 'wsSend'), context);
  installBrowserModule(root, 'app/command-controller.js', context);
  vm.runInContext(source.slice(begin, end), context);
  vm.runInContext("const dmUnread=new Set();let dmPanel=null,dmPeer=null;const dmRooms=new Map();const dmStorageKey=()=> 'dm.'+(S.code||S.addr?.text||'sala');", context);
  installBrowserModule(root, 'app/dm-storage.js', context);
  if (fs.existsSync(path.join(root, 'app/dm-storage.js'))) vm.runInContext('const dmStore = createDMStorage({LS, dmRooms, dmStorageKey});', context);
  for (const name of ['dmHistory','rememberContact','receiveDM','handle','sendMessage']) vm.runInContext(declaration(source, name), context);
  const ws = new WebSocket(address); S.ws = ws;
  const faults = [];
  ws.on('message', raw => { const message = JSON.parse(raw); received.push(message); try { context.handle(message); } catch (error) { faults.push(error); } });
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name })));
  return { S, V, ws, received, errors, faults, input, local, command: (type, payload) => context.sendCommand(type, payload), sendMessage: () => context.sendMessage(), send: message => context.wsSend(message) };
}
module.exports = { declaration, client, installBrowserModule };
