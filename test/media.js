const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
function extract(name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
  assert.ok(match, name);
  const start = match.index, rest = source.slice(start + 1);
  const end = /\n(?:async )?function /m.exec(rest);
  return end ? source.slice(start, start + 1 + end.index) : source.slice(start);
}
const audioTrack = { kind: 'audio' }, videoTrack = { kind: 'video' };
const voice = { getAudioTracks: () => [audioTrack] };
const screen = { id: 'live-1', getTracks: () => [videoTrack, audioTrack] };
const signals = [];
class PC {
  constructor() { this.senders = []; this.signalingState = 'stable'; }
  addTrack(track) { const s = { track, getParameters: () => ({ encodings: [{}] }), setParameters: async p => { s.parameters = p; } }; this.senders.push(s); return s; }
  removeTrack(s) { this.senders = this.senders.filter(x => x !== s); }
  getSenders() { return this.senders; }
  async setRemoteDescription() {} async setLocalDescription() {}
  close() {} addTransceiver() {} async addIceCandidate() {}
}
const context = vm.createContext({ console, RTCPeerConnection: PC, WEB_VIEWER: false,
  S: { myId: 'a', isHost: false, users: new Map([['b', { id: 'b', voiceChannel: 'lobby', sharing: true, screenStreamId: 'remote-1' }]]) },
  V: { joined: true, channel: 'lobby', screen, screenQ: { br: 3500000, fps: 60 }, screenSenders: new Map(), watching: new Map(), peers: new Map(), dest: { stream: voice }, relayId: null, relayed: new Set(), relayVia: new Map(), relayOut: new Map() }, native: null,
  sig: (to, data) => signals.push({ to, data }), iceServers: () => [], LS: { get: () => false },
  renderCall: () => {}, applyUserVolume: () => {}, attachRemoteAudio: () => {},
});
vm.runInContext(fs.readFileSync(require.resolve('../app/screen-startup.js'), 'utf8').replace(/^export /gm, ''), context);
vm.runInContext(['getPeer', 'onSignal', 'tuneSender', 'tunePeerSenders', 'addScreenTo', 'removeScreenFrom', 'setWatching', 'preferH264', 'canRelay', 'watchMsg', 'routeViewer', 'dropRelay', 'stopRelayingTo', 'relayTo', 'onRelaySignal'].map(extract).join('\n'), context);
(async () => {
  const p = vm.runInContext("getPeer('b')", context);
  assert.equal(p.pc.senders.length, 1, 'only voice is sent before subscription');
  vm.runInContext("onSignal('b', {watch:true, streamId:'old-live'})", context); await p.queue;
  assert.equal(p.pc.senders.length, 1, 'stale subscription rejected');
  vm.runInContext("onSignal('b', {watch:true, streamId:'live-1'})", context); await p.queue;
  assert.equal(p.pc.senders.length, 3, 'video and screen audio added on opt-in');
  const videoSender = p.pc.senders.find(s => s.track.kind === 'video');
  assert.equal(videoSender.parameters.degradationPreference, 'maintain-framerate');
  assert.equal(videoSender.parameters.encodings[0].maxBitrate, 3500000);
  assert.equal(videoSender.parameters.encodings[0].maxFramerate, 60);
  assert.equal(videoSender.parameters.encodings[0].degradationPreference, undefined);
  vm.runInContext("onSignal('b', {watch:false, streamId:'live-1'})", context); await p.queue;
  assert.equal(p.pc.senders.length, 1, 'unsubscribe removes video and screen audio');
  vm.runInContext("setWatching('b',true)", context);
  assert.equal(signals.at(-1).data.streamId, 'remote-1');
  vm.runInContext("setWatching('b',false)", context);
  assert.equal(context.V.watching.size, 0);
  console.log('PASS: media opt-in, stale subscription, unsubscribe, 720p60 sender parameters');
})().catch(e => { console.error(e); process.exitCode = 1; });
