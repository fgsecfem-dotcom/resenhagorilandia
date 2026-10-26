const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require.resolve('../app/client.js'),'utf8');
const part=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
(async()=>{
 for(const web of [false,true]){
  let mic=0,peer=0;const track={enabled:true},V={joined:false,muted:false,deafened:false,raw:{getAudioTracks:()=>[track]},gate:{gain:{value:0}},peers:new Map()};
  const ctx=vm.createContext({WEB_VIEWER:web,WEB_VOICE:web,V,S:{myId:'me'},DJ_ID:'dj',LS:{set(){}},ensureAudio:async()=>{},openMic:async()=>{mic++},voiceChannels:()=>[{id:'lobby'}],usersIn:()=>[{id:'peer'}],getPeer:()=>peer++,wsSend:()=>{},sfx:()=>{},setConnStatus:()=>{},syncDJ:()=>{},renderAll:()=>{},toast:()=>{},stopShare:()=>{},tileCache:new Map(),stopDJAudio:()=>{},closePeer:()=>{}});
  vm.runInContext(part('async function joinVoice(','// Laço: portão'),ctx);
  await ctx.joinVoice('lobby');assert.equal(mic,1);assert.equal(peer,1);assert(V.joined);
  ctx.setMuted(true);assert(V.muted);if(web)assert.equal(track.enabled,false);
  ctx.setMuted(false);ctx.setDeafened(true);assert(V.muted&&V.deafened);if(web)assert.equal(track.enabled,false);
  ctx.setDeafened(false);assert(!V.muted&&!V.deafened);if(web)assert.equal(track.enabled,true);
  V.raw={getTracks:()=>[{stop(){}}]};V.speaking=new Set();ctx.leaveVoice();assert(!V.joined);assert.equal(V.channel,null);
 }
 for(const fail of [false,true]){
  const input={value:'mensagem'},pending=[];let resolveAck,called=0;
  const ctx=vm.createContext({sending:false,input,pending,S:{ws:{readyState:1},textChannel:'geral'},WEB_VIEWER:true,sendCommand:()=>{called++;return new Promise((res,rej)=>resolveAck=()=>fail?rej(Error('offline')):res())},extractMentions:()=>[],toast:()=>{},$:()=>({innerHTML:''}),autosize:()=>{},cancelReply:()=>{},hideMentionPop:()=>{},URL});
  vm.runInContext(part('async function sendMessage()','let dragDepth'),ctx);
  const task=ctx.sendMessage();assert.equal(called,1);assert.equal(input.value,'mensagem','must retain until ACK');resolveAck();await task;assert.equal(input.value,fail?'mensagem':'');assert.equal(ctx.sending,false);
 }
 console.log('PASS: same channel flow for desktop/web, mute/deafen restores mic state, leave cleanup, chat retains text until ACK and on error');
})().catch(e=>{console.error(e);process.exitCode=1});
