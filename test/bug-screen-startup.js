const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console: { warn() {} } });
vm.runInContext(fs.readFileSync(require.resolve('../app/screen-startup.js'), 'utf8').replace(/^export /gm, ''), context);
const { screenStartKbps: rate, screenStartupDescription: hint, setScreenRemoteDescription: apply } = context;
const audio = 'm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:voice\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n';
const video = 'm=video 9 UDP/TLS/RTP/SAVPF 96 97 98 100\r\na=mid:screen\r\na=recvonly\r\na=fmtp:98 profile-id=0\r\na=rtpmap:96 VP8/90000\r\na=rtpmap:97 rtx/90000\r\na=fmtp:97 apt=96\r\na=rtpmap:98 VP9/90000\r\na=rtpmap:100 unknown/90000\r\n';
const data = 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=mid:data\r\na=sctp-port:5000\r\n';
const desc = { type: 'answer', sdp: 'v=0\r\n' + audio + video + data };
const adjusted = hint(desc, new Set(['screen']), 1500);
assert(adjusted.sdp.includes(audio)); assert(adjusted.sdp.endsWith(data));
assert(adjusted.sdp.includes('a=fmtp:96 x-google-start-bitrate=1500\r\n'));
assert(adjusted.sdp.includes('a=fmtp:98 profile-id=0;x-google-start-bitrate=1500\r\n'));
assert(adjusted.sdp.includes('a=fmtp:97 apt=96\r\n')); assert(!adjusted.sdp.includes('a=fmtp:100'));
assert(!adjusted.sdp.includes('x-google-min-bitrate')); assert(!adjusted.sdp.includes('x-google-max-bitrate'));
assert.equal(hint(adjusted, new Set(['screen']), 2500), adjusted, 'existing remote policy is preserved; idempotent');
assert.equal(hint(desc, new Set(['voice']), 1500), desc);
for (const change of [s => s.replace('m=video 9', 'm=video 0'), s => s.replace('a=recvonly', 'a=inactive'), s => s.replace('a=recvonly', 'a=sendonly'), s => s.replace('a=recvonly', 'b=AS:200\r\na=recvonly')]) {
  const value = { ...desc, sdp: change(desc.sdp) }; assert.equal(hint(value, new Set(['screen']), 1500), value);
}
assert.equal(hint({ type: 'rollback' }, new Set(['screen']), 1500).type, 'rollback');
assert.equal(hint({ ...desc, sdp: desc.sdp.replaceAll('\r\n', '\n') }, new Set(['screen']), 1500).sdp.includes('\r'), false);
for (const br of [2500000,3500000,4500000,7000000,10000000]) assert.equal(rate({ br }), Math.min(4000, br * .6 / 1000));
assert.equal(rate({}), 0); assert.equal(rate({br:NaN}), 0);
(async () => {
  let calls = [], failHint = false;
  const sender = { track: { kind: 'video', readyState: 'live' } };
  const peer = { wantsScreen: true, pc: { getTransceivers: () => [{ mid: 'voice', sender: {} }, { mid: 'screen', sender }], setRemoteDescription: async d => { calls.push(d); if (failHint && d !== desc) throw Error('unsupported'); } } };
  const options = { stream: { id: 'live' }, senders: [sender], quality: { br: 2500000 }, enabled: true };
  await apply(peer, desc, options); assert.notEqual(calls[0], desc); assert.equal(peer.screenStartupSender, sender);
  await apply(peer, desc, options); assert.equal(calls[1], desc, 'no resetting congestion estimate on renegotiation');
  for (const overrides of [{enabled:false}, {stream:null}, {senders:[]}, {quality:null}]) {
    peer.screenStartupSender = null; calls = []; await apply(peer, desc, {...options,...overrides}); assert.equal(calls[0],desc);
  }
  peer.wantsScreen = false; calls=[]; await apply(peer,desc,options); assert.equal(calls[0],desc);
  peer.wantsScreen = true; peer.screenStartupSender=null; failHint=true; calls=[];
  await apply(peer,desc,options); assert.equal(calls.length,2); assert.equal(calls[1],desc); assert.equal(peer.screenStartupSender,sender);
  peer.screenStartupSender=null; failHint=false; calls=[];
  await apply(peer,desc,options); assert.notEqual(calls[0],desc,'new subscription can start again');
  peer.screenStartupSender=null; peer.pc.getTransceivers=()=>[{mid:null,sender}]; calls=[];
  await apply(peer,desc,options); assert.equal(calls[0],desc,'no guessing a media section when mid is unknown');
  peer.pc.setRemoteDescription=async()=>{throw Error('original negotiation failure')};
  await assert.rejects(apply(peer,desc,options),/original negotiation failure/);
  const { declaration } = require('./helpers/characterization-client');
  const source = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
  const received = [], screen = {id:'screen'}, screenSenders = [sender];
  const p = {uid:'b',pc:{signalingState:'stable',setLocalDescription:async()=>{}},queue:Promise.resolve(),polite:false};
  const c = vm.createContext({console,S:{users:new Map([['b',{voiceChannel:'lobby'}]])},
    V:{joined:true,channel:'lobby',screen,screenQ:{br:2500000},screenSenders:new Map([['b',screenSenders]])},WEB_VIEWER:false,
    getPeer:()=>p,setScreenRemoteDescription:async(...args)=>received.push(args),sig(){}});
  vm.runInContext(['onRelaySignal','onSignal'].map(n=>declaration(source,n)).join('\n'),c);
  c.onSignal('b',{desc}); await p.queue;
  assert.equal(received[0][1],desc); assert.equal(received[0][2].stream,screen); assert.equal(received[0][2].senders,screenSenders); assert.equal(received[0][2].enabled,true);
  c.V.screenStartupEnabled=false; c.onSignal('b',{desc}); await p.queue; assert.equal(received[1][2].enabled,false);
  c.V.screenStartupEnabled=true; c.WEB_VIEWER=true; c.onSignal('b',{desc}); await p.queue; assert.equal(received[2][2].enabled,false);
  p.makingOffer=true; c.onSignal('b',{desc:{...desc,type:'offer'}}); await p.queue; assert.equal(received.length,3,'glare handling unchanged');
  vm.runInContext(['preferH264','addScreenTo'].map(n=>declaration(source,n)).join('\n'),c);
  Object.assign(p,{wantsScreen:true,screenStartupSender:sender}); c.V.screenSenders.clear();
  c.V.screen={getTracks:()=>[sender.track]}; p.pc.addTrack=()=>sender; c.tuneSender=()=>{};
  c.addScreenTo(p); assert.equal(p.screenStartupSender,null,'each fresh opt-in resets only its startup guard');
  console.log('PASS: screen-only startup estimate, unchanged audio/data, codec policies, no floor, once per subscription, compatibility opt-out and negotiation fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
