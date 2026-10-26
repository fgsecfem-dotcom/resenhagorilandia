const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../app/client.js'),'utf8');const code=source.slice(source.indexOf('async function openStoredRoom('),source.indexOf('// ---------------- Tela inicial',source.indexOf('async function openStoredRoom(')));
(async()=>{
 for(const state of ['won','lost','online','unknown']){
  let started=0,joined=0,connected=0;const fields={'#home-error':{},'#join-pass':{value:''},'#host-pass':{value:''}};
  const room={code:'TEST1234',name:'Our room',revision:7,configuration:{}};
  const ctx=vm.createContext({native:{rooms:{claim:async()=>({state,snapshot:room,error:'offline discovery'})},startHost:async o=>{started++;assert.equal(o.code,room.code);assert.equal(o.restore.revision,7);assert(o.resume);return {ok:true,port:7777,hostKey:'key'}}},S:{},CID:'B',checkName:()=>true,$:s=>fields[s],fmtCode:c=>c,confirmModal:async()=>true,joinByCode:async c=>{joined++;assert.equal(c,room.code)},connect:()=>connected++,parseAddr:s=>s,toast:()=>{},setTimeout:fn=>queueMicrotask(fn)});
  vm.runInContext(code,ctx);await ctx.openStoredRoom(room);
  assert.equal(started,state==='won'?1:0);assert.equal(joined,['lost','online'].includes(state)?1:0);assert.equal(connected,state==='won'?1:0);
  if(state==='won')assert.equal(ctx.S.code,room.code);if(state==='unknown')assert.equal(fields['#home-error'].textContent,'offline discovery');
 }
 console.log('PASS: resume winner keeps code/snapshot, loser and existing-host join instead of hosting, unknown discovery does not start host');
})().catch(e=>{console.error(e);process.exitCode=1});
