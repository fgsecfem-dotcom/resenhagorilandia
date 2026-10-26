const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const client = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
const code = client.slice(client.indexOf('function stripUnisolatedAudio('), client.indexOf('async function toggleShare('));
async function scenario({failure, restriction=true, ended=false, audio=true, missing=false}) {
 const selections=[], requests=[], notices=[], logs=[];
 const track={readyState:ended?'ended':'live',getSettings:()=>({restrictOwnAudio:restriction}),stop(){this.stopped=true}};
 const video={kind:'video'};
 const stream={tracks:[video,...(missing?[]:[track])],getAudioTracks(){return this.tracks.filter(x=>x!==video)},removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t)}};
 const ctx=vm.createContext({native:{selectScreen:async x=>selections.push(x),captureStatus:async x=>logs.push(x)},navigator:{mediaDevices:{getDisplayMedia:async opts=>{requests.push(opts);if(requests.length===1&&failure)throw Object.assign(new Error(failure),{name:failure});if(!opts.audio)stream.tracks=[video];return stream}}},toast:msg=>notices.push(msg)});
 vm.runInContext(code,ctx);
 const run=()=>ctx.captureNativeScreen('screen:0',{w:1280,h:720,fps:30},audio);
 if (failure && (!audio || !['NotReadableError','NotSupportedError','AbortError'].includes(failure))) {
  await assert.rejects(run,{name:failure});assert.equal(requests.length,1);return;
 }
 const result=await run();assert(result.tracks.includes(video));
 if(failure){assert.equal(requests.length,2);assert.equal(selections[1].audio,false);assert.equal(requests[1].audio,false);assert.equal(logs[0].audioError,failure)}
 else assert.equal(requests.length,1);
 if(audio)assert.equal(requests[0].audio.restrictOwnAudio,true);
 const expected=audio&&!failure&&!ended&&!missing&&restriction===true;
 assert.equal(result.getAudioTracks().length,expected?1:0);
 assert.equal(notices.length,audio&&!expected?1:0);
}
(async()=>{
 await scenario({});
 for(const failure of ['NotReadableError','NotSupportedError','AbortError','NotAllowedError','NotFoundError'])await scenario({failure});
 await scenario({failure:'NotReadableError',audio:false});
 await scenario({restriction:false});await scenario({restriction:null});await scenario({ended:true});await scenario({missing:true});await scenario({audio:false});
 console.log('PASS: isolated capture, video-only recovery, no retry on denial, ended/missing/unisolated audio and disabled audio');
})().catch(e=>{console.error(e);process.exitCode=1});
