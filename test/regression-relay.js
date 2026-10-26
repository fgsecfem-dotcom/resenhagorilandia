// 2.0.1: the streamer encodes once. The first desktop viewer gets the live directly and relays it;
// later 2.0.1 viewers are routed through it, older viewers still get it directly, and losing the relay re-routes.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { declaration } = require('./helpers/characterization-client');
const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');

const video = { kind: 'video' }, audio = { kind: 'audio' }, screen = { id: 'live-1', getTracks: () => [video, audio] };
const signals = [];
const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg); // vm objects come from another realm
const pc = () => ({ senders: [], addTrack(track) { const s = { track, getParameters: () => ({ encodings: [{}] }), setParameters: async () => {} }; this.senders.push(s); return s; }, removeTrack(s) { this.senders = this.senders.filter((x) => x !== s); } });
const peers = new Map(['relay', 'newer', 'older'].map((uid) => [uid, { uid, pc: pc(), streams: new Map() }]));
const V = { screen, screenQ: { br: 2500000, fps: 30 }, screenSenders: new Map(), peers, relayId: null, relayed: new Set(), relayVia: new Map(), relayOut: new Map(), watching: new Map() };
const ctx = vm.createContext({ V, native: {}, sig: (to, data) => signals.push({ to, data }), tuneSender: () => {} });
vm.runInContext(['preferH264', 'canRelay', 'watchMsg', 'addScreenTo', 'removeScreenFrom', 'routeViewer', 'dropRelay', 'stopRelayingTo', 'relayTo', 'onRelaySignal'].map((n) => declaration(source, n)).join('\n'), ctx);
const watch = (uid, extra) => { const p = peers.get(uid); p.wantsScreen = true; ctx.routeViewer(p, { watch: true, streamId: 'live-1', ...extra }); };

watch('relay', { acceptsRelay: true, canRelay: true });
assert.equal(V.relayId, 'relay', 'first desktop viewer becomes the relay');
assert.equal(peers.get('relay').pc.senders.length, 2, 'relay receives video and sound directly');
watch('newer', { acceptsRelay: true, canRelay: true });
assert.equal(peers.get('newer').pc.senders.length, 0, 'the streamer does not encode again for a 2.0.1 viewer');
same(signals.pop(), { to: 'newer', data: { relayVia: 'relay', streamId: 'live-1' } });
watch('older', {});
assert.equal(peers.get('older').pc.senders.length, 2, 'a 2.0.0 viewer still gets the live directly');
assert.equal(V.screenSenders.size, 2, 'two encodes instead of three');
watch('newer', { acceptsRelay: true, canRelay: true, noRelay: true });
assert.equal(peers.get('newer').pc.senders.length, 2, 'a viewer whose relay failed falls back to direct');
ctx.removeScreenFrom(peers.get('newer')); V.relayed.add('newer');

ctx.dropRelay();
assert.equal(V.relayId, null); same(signals.pop(), { to: 'newer', data: { relayLost: true, streamId: 'live-1' } }, 'relayed viewers ask again');

// On the relay: forwarding keeps the owner's stream id so the viewer's screen finds it.
const ownerStream = { id: 'live-1', getVideoTracks: () => [video], getTracks: () => [video, audio] };
peers.set('owner', { uid: 'owner', pc: pc(), streams: new Map([['live-1', ownerStream]]) });
const viewer = peers.get('newer'); viewer.pc = pc();
assert.equal(ctx.onRelaySignal('newer', viewer, { relayWatch: true, owner: 'owner', streamId: 'live-1' }), true);
assert.equal(viewer.pc.senders.length, 2, 'relay forwards video and sound'); assert.equal(V.relayOut.get('newer').owner, 'owner');
ctx.onRelaySignal('newer', viewer, { relayWatch: false, owner: 'owner' });
assert.equal(viewer.pc.senders.length, 0); assert.equal(V.relayOut.has('newer'), false, 'stops forwarding when the viewer leaves');
ctx.onRelaySignal('newer', viewer, { relayWatch: true, owner: 'owner', streamId: 'other' });
same(signals.pop(), { to: 'newer', data: { relayFail: true, owner: 'owner' } }, 'relay without that live says so');
console.log('PASS: relay routing — one encode for 2.0.1 viewers, direct for older ones, fallback and re-route when the relay goes');
