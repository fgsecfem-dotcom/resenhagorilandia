const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const main=fs.readFileSync(require.resolve('../main.js'),'utf8'),client=fs.readFileSync(require.resolve('../app/client.js'),'utf8');
function fixture(platform='win32',supported=true){
 const handlers={},ctx=vm.createContext({ipcMain:{handle:(n,f)=>handlers[n]=f},crypto:{randomUUID:()=> 'one-use-token'},captureConfig:{audioSupported:supported},pendingShare:null,recoveredCapture:false,setCaptureState(){},process:{platform},recordCapture(){},compatibility:!supported});
 const start=main.indexOf("ipcMain.handle('screen:select'");vm.runInContext(main.slice(start,main.indexOf("ipcMain.handle('capture:status'",start)),ctx);
 let handler;ctx.ses={setDisplayMediaRequestHandler:f=>handler=f};ctx.desktopCapturer={getSources:async()=>[{id:'screen:123:0'}]};
 const a=main.indexOf('  ses.setDisplayMediaRequestHandler(async (request, callback) => {');vm.runInContext(main.slice(a,main.indexOf('  // Downloads de anexos:',a)),ctx);
 return {ctx,handlers,display:()=>new Promise(r=>handler({},r))};
}
async function rendererScenario({marker,receipt=true,source='screen:123:0',ended=false,denied=false}){
 const tracks=[],notices=[],status=[];let calls=0;
 const audio={readyState:ended?'ended':'live',getSettings:()=>marker===undefined?{}:{restrictOwnAudio:marker},stop(){this.stopped=true}};
 const video={};tracks.push(video,audio);const stream={getAudioTracks:()=>tracks.filter(t=>t!==video),removeTrack(t){tracks.splice(tracks.indexOf(t),1)}};
 const ctx=vm.createContext({native:{selectScreen:async()=>({captureToken:'token'}),captureInfo:async()=>({isolatedAudioConfirmed:receipt,sourceId:source}),captureStatus:async s=>status.push(s)},navigator:{mediaDevices:{getDisplayMedia:async()=>{calls++;if(denied)throw Object.assign(Error('denied'),{name:'NotAllowedError'});return stream;}}},toast:s=>notices.push(s)});
 vm.runInContext(client.slice(client.indexOf('function stripUnisolatedAudio('),client.indexOf('async function toggleShare(')),ctx);
 if(denied){await assert.rejects(()=>ctx.captureNativeScreen('screen:123:0',{w:1280,h:720,fps:30},true));assert.equal(calls,1);return;}
 await ctx.captureNativeScreen('screen:123:0',{w:1280,h:720,fps:30},true);
 const keep=!ended&&(marker===true||marker===undefined&&receipt&&source==='screen:123:0');
 assert.equal(stream.getAudioTracks().length,keep?1:0);assert.equal(notices.length,keep?0:1);assert(status.some(s=>s.stage==='isolated-audio-validation'));
}
(async()=>{
 for(const [platform,supported,requested,expected]of [['win32',true,true,true],['win32',true,false,false],['win32',false,true,false],['darwin',true,true,false]]){
  const f=fixture(platform,supported),selected=f.handlers['screen:select'](null,{id:'screen:123:0',audio:requested});
  const result=await f.display();assert.equal(result.audio,supported&&requested?'loopbackWithoutChrome':undefined);
  const first=f.handlers['capture:info'](null,selected.captureToken);assert.equal(first.isolatedAudioConfirmed,expected);if(expected)assert.equal(first.sourceId,'screen:123:0');
  assert.equal(f.handlers['capture:info'](null,selected.captureToken).isolatedAudioConfirmed,false,'receipt cannot be reused');
 }
 const bad=fixture();bad.handlers['screen:select'](null,{id:'screen:123:0',audio:true});await bad.display();assert.equal(bad.handlers['capture:info'](null,'wrong-token').isolatedAudioConfirmed,false);
 for(const marker of [undefined,true,false,null])for(const receipt of [true,false])await rendererScenario({marker,receipt});
 await rendererScenario({marker:undefined,source:'screen:other'});await rendererScenario({marker:undefined,ended:true});await rendererScenario({denied:true});
 console.log('PASS: native isolated source confirmation bound to selection, single use, Windows-only; missing flag accepted only with matching receipt; false/ended/foreign/denied remain rejected. No Windows10 hardware proof.');
})().catch(e=>{console.error(e);process.exitCode=1});
