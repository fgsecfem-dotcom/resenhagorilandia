const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {capturePolicy} = require('../capture-policy');
assert.equal(capturePolicy({platform:'win32',release:'10.0.19045'}).audioSupported,true);
assert.equal(capturePolicy({platform:'win32',release:'10.0.22631'}).audioSupported,true);
assert.equal(capturePolicy({platform:'win32',release:'10.0.26200',compatibility:true}).audioSupported,false);
assert.equal(capturePolicy({platform:'linux',release:'6.8.0'}).audioSupported,false);
assert.equal(capturePolicy({platform:'darwin',release:'22.6.0'}).audioSupported,false);
assert.equal(capturePolicy({platform:'darwin',release:'23.1.0'}).audioSupported,false);
assert.equal(capturePolicy({platform:'darwin',release:'23.2.0'}).audioSupported,true);
assert.equal(capturePolicy({platform:'darwin',release:'24.0.0'}).audioSupported,true);
assert.equal(capturePolicy({platform:'darwin',release:'23.2.0',compatibility:true}).audioSupported,false);
for (const [build, supported] of [[18363,false],[19040,false],[19041,true],[19044,true],[19045,true],[20348,true]]) {
 assert.equal(capturePolicy({platform:'win32',release:'10.0.'+build}).audioSupported,supported);
 assert.equal(capturePolicy({platform:'win32',release:'10.0.'+build,compatibility:true}).audioSupported,false);
}
const source=fs.readFileSync(require.resolve('../main.js'),'utf8');
const startupCode=source.slice(source.indexOf('const capturePrefsFile ='),source.indexOf('let captureActive ='));
for(const [previous,flag,expected] of [[false,false,false],[true,false,true],[false,true,true]]) {
 const calls=[];
 const ctx=vm.createContext({DATA_DIR:'.',path:require('node:path'),os:{release:()=> '10.0.22631'},process:{platform:'win32',argv:flag?['resenha','--compatibility']:['resenha']},capturePolicy,
  fs:{readFileSync:(file)=>file.endsWith('capture-state.json')?JSON.stringify({active:previous}):'{}'},
  app:{getPath:()=>'.',disableHardwareAcceleration:()=>calls.push('gpu-off'),commandLine:{appendSwitch:name=>calls.push(name)}}});
 vm.runInContext(startupCode,ctx);
 assert.equal(calls.includes('gpu-off'),expected,'recovery/flag decides compatibility before app ready');
 assert.equal(calls.includes('disable-accelerated-video-encode'),expected);
}
const client=fs.readFileSync(require.resolve('../app/client.js'),'utf8');
const audioCtx=vm.createContext({});
vm.runInContext(client.slice(client.indexOf('function stripUnisolatedAudio('), client.indexOf('async function toggleShare(')),audioCtx);
for (const restriction of [true,false,undefined]) {
 const track={getSettings:()=>({restrictOwnAudio:restriction}),stop(){this.stopped=true;}};
 const video={kind:'video'},stream={tracks:[video,track],getAudioTracks:()=>[track],removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t);}};
 assert.equal(audioCtx.stripUnisolatedAudio(stream),restriction!==true);
 assert.equal(stream.tracks.includes(video),true,'video survives audio fallback');
 assert.equal(stream.tracks.includes(track),restriction===true,'only confirmed isolated audio survives');
}
const start=source.indexOf('  ses.setDisplayMediaRequestHandler(async (request, callback) => {');
const end=source.indexOf('  // Downloads de anexos:',start);
async function handlerTest(audioSupported, requested=true) {
 let handler, options;
 const state={pendingShare:{id:'window:123:0',audio:requested}};
 const ctx=vm.createContext({
   ses:{setDisplayMediaRequestHandler:fn=>handler=fn},
   desktopCapturer:{getSources:async opts=>{options=opts;return [{id:'window:123:0'}];}},
   captureConfig:{audioSupported},compatibility:!audioSupported,recordCapture:()=>{},setCaptureState:()=>{},
   ...state,
 });
 vm.runInContext(source.slice(start,end),ctx);
 let result; await handler({},r=>result=r);
 assert.equal(options.types[0],'window');assert.equal(options.thumbnailSize.width,0);
 assert.equal(ctx.pendingShare,null,'selection is consumed');
 assert.equal(!!result.audio,audioSupported&&requested);
 if(result.audio) assert.equal(result.audio,'loopbackWithoutChrome');
 let second;await handler({},r=>second=r);assert.equal(second.video,undefined,'repeated request is rejected');
}
(async()=>{
 await handlerTest(true);await handlerTest(false);await handlerTest(true,false);
 console.log('PASS: capture OS policy, compatibility blocks loopback, no thumbnails during capture, one-shot selection');
})().catch(e=>{console.error(e);process.exitCode=1;});
