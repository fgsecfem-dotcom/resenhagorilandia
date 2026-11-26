const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(require.resolve('../app/performance.js'),'utf8'),ctx);
const stats=new Map([
 ['codec',{type:'codec',mimeType:'video/VP8'}],
 ['video',{type:'outbound-rtp',kind:'video',codecId:'codec',framesEncoded:600,framesPerSecond:30,totalEncodeTime:1.2,frameWidth:1280,frameHeight:720,bytesSent:300000,ssrc:1234}],
 ['connection',{type:'candidate-pair',state:'succeeded',nominated:true,currentRoundTripTime:0.025,localCandidateId:'private-ip'}],
 ['private-ip',{type:'local-candidate',address:'192.168.0.123'}],
]);
const main=fs.readFileSync(require.resolve('../main.js'),'utf8'),hooks={};let saved,choice={canceled:false,filePath:'test-report.json'};
const nativeCtx=vm.createContext({ipcMain:{handle:(key,fn)=>hooks[key]=fn},dialog:{showSaveDialog:async()=>choice},win:{},app:{getPath:()=>'.'},path:require('node:path'),fs:{writeFileSync:(file,data)=>saved={file,data}}});
vm.runInContext(main.slice(main.indexOf("ipcMain.handle('performance:save'"),main.indexOf("ipcMain.handle('app:version'")),nativeCtx);
(async()=>{assert.equal(await hooks['performance:save']({}, {schema:1,samples:[{at:1}]}),true);assert.equal(JSON.parse(saved.data).schema,1);saved=null;choice={canceled:true};assert.equal(await hooks['performance:save']({},{}),false);assert.equal(saved,null);console.log('PASS: native export writes report JSON and honors save cancellation');})().catch(e=>{console.error(e);process.exitCode=1;});
(async()=>{const report=await ctx.window.readMediaStats(new Map([['private-person-id',{pc:{getStats:async()=>stats}}]]));assert.equal(report.length,2);assert.equal(report[0].codec,'video/VP8');assert.equal(report[0].framesPerSecond,30);assert.equal(report[1].rtt,0.025);assert.ok(!JSON.stringify(report).includes('192.168'));assert.ok(!JSON.stringify(report).includes('private-person-id'));console.log('PASS: video stats collected without peer identity or network address');})().catch(e=>{console.error(e);process.exitCode=1;});
// O relógio de cada laço é testado em mobile-client; aqui exercitamos cada leitura.
(() => {
  const src = fs.readFileSync(require.resolve('../app/client.js'), 'utf8');
  const code = src.slice(src.indexOf('// Laço: portão'), src.indexOf('function syncVoiceTimers'));
  const reads = { self: 0, peer: 0 }, gain = { value: 0, setTargetAtTime(v) { this.value = v; } };
  const loud = (key) => ({ getFloatTimeDomainData(buf) { reads[key]++; buf.fill(0.5); } });
  const V = { joined: true, micActive: false, micReadyAt: 0, windowVisible: true, analyser: loud('self'), src: {}, gate: { gain }, ctx: { currentTime: 0 }, peers: new Map([['p1', { analyser: loud('peer') }]]), speaking: new Set() };
  const vctx = vm.createContext({ V, S: { users: new Map() }, settings: { threshold: -50, userMuted: {} }, WEB_VIEWER: false, DJ_NAME: 'DJ', DJ_ID: 'dj', micMuted: () => !V.micActive, wantsDeepFilterNet: () => false, refreshSpeaking() {}, performance, document: { hidden: false } });
  vm.runInContext(code, vctx);
  vctx.tickMic(); assert.equal(reads.self, 0); assert.equal(gain.value, 0);
  V.micActive = true; V.micReadyAt = 0.1;
  vctx.tickMic(); assert.equal(reads.self, 1); assert.equal(reads.peer, 0); assert.equal(gain.value, 0);
  V.ctx.currentTime = 0.1; vctx.tickMic(); assert.equal(gain.value, 1);
  vctx.tickSpeaking(); assert.equal(reads.peer, 1); assert.ok(V.speaking.has('p1'));
  V.windowVisible = false; vctx.tickSpeaking(); assert.equal(reads.peer, 1);
  console.log('PASS: microfone mudo não é medido, abertura aguarda o filtro e só o laço de fala lê os pares');
})();
