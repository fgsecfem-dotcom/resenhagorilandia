const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),WS=require('ws');
const {RoomStore,makeSnapshot,roomIdFor,compareClaims,MAX_BYTES}=require('../room-state');const {createServer}=require('../server');const {Tunnel}=require('../tunnel-main');
const wait=async fn=>{for(let i=0;i<100;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,20));}throw Error('timeout')};
const channels=[{id:'geral',type:'text',name:'geral'},{id:'lobby',type:'voice',name:'Lobby'}];
const input={code:'TEST-1234',name:'Same room',revision:3,channels,history:{geral:[{id:'public',text:'public',ts:1,channelId:'geral'},{id:'private',text:'secret',t:'dm',to:'B',ts:2}]},dmHistory:['secret2'],favorites:['secret3'],configuration:{needsPassword:false,otherSecret:'excluded'}};
(async()=>{
 const dir=fs.mkdtempSync(path.join(path.resolve(__dirname,'../../'),'resenha-rooms-'));const aStore=new RoomStore(path.join(dir,'A')),bStore=new RoomStore(path.join(dir,'B'));
 const snap=makeSnapshot(input);assert.equal(snap.roomId,roomIdFor('TEST1234'));assert(!JSON.stringify(snap).includes('secret'));assert.equal(snap.history.geral.length,1);
 const legacyArray=makeSnapshot({...input,history:[{id:'old-array',text:'old format',ts:1}]});assert.equal(legacyArray.history.geral[0].text,'old format');
 const large=makeSnapshot({...input,history:{geral:Array.from({length:1000},(_,i)=>({id:''+i,ts:i,text:'x'.repeat(4000)}))}});assert(Buffer.byteLength(JSON.stringify(large))<=MAX_BYTES);assert(large.history.geral.length<=200);
 aStore.save(snap);bStore.save(snap);assert.equal(bStore.get('TEST-1234').code,'TEST1234');assert.equal(bStore.get('TEST1234').roomId,snap.roomId);
 bStore.save({...snap,revision:4});const stale=bStore.save({...snap,revision:2});assert(stale.newerLocal);assert.equal(bStore.get(snap.code).revision,4);
 // Legacy format is backed up before room metadata is written.
 const roomDir=path.join(dir,'legacy');fs.mkdirSync(roomDir);fs.writeFileSync(path.join(roomDir,'channels.json'),JSON.stringify(channels));fs.writeFileSync(path.join(roomDir,'history.json'),JSON.stringify({geral:[{id:'old',text:'legacy',ts:1}]}));
 const liveStoreA=new RoomStore(path.join(dir,'A-online')),liveStoreB=new RoomStore(path.join(dir,'B-online'));
 let server=createServer({port:17961,dataDir:roomDir,code:snap.code,backupRoot:path.join(dir,'backups'),onSnapshot:s=>liveStoreA.save(s),log:()=>{}});let ws,privatePeer;
 try{await server.listen();assert(server.roomInfo().migrationBackup);assert(fs.existsSync(path.join(server.roomInfo().migrationBackup,'history.json')));
  ws=new WS('ws://127.0.0.1:17961');const messages=[];ws.on('message',d=>messages.push(JSON.parse(d)));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',name:'A',cid:'A'}));await wait(()=>messages.find(m=>m.t==='room-snapshot'));
  const welcome=messages.find(m=>m.t==='welcome');
  privatePeer=new WS('ws://127.0.0.1:17961');const privateMsgs=[];privatePeer.on('message',d=>privateMsgs.push(JSON.parse(d)));await new Promise(r=>privatePeer.on('open',r));privatePeer.send(JSON.stringify({t:'hello',name:'Private B',cid:'private-B'}));const pw=await wait(()=>privateMsgs.find(m=>m.t==='welcome'));
  ws.send(JSON.stringify({t:'dm',to:pw.id,text:'private-sentinel-never-replicate',requestId:'dm-sentinel'}));await wait(()=>privateMsgs.find(m=>m.t==='dm'));
  ws.send(JSON.stringify({t:'chat',channelId:'geral',text:'new public',requestId:'new'}));const newer=await wait(()=>messages.find(m=>m.t==='room-snapshot'&&m.snapshot.revision>0));assert(!JSON.stringify(newer.snapshot).includes('private-sentinel-never-replicate'));liveStoreB.save(newer.snapshot);
 }finally{privatePeer?.terminate();ws?.terminate();await server.close();}
 const bSnap=liveStoreB.get(snap.code);const bDir=path.join(dir,'B','salas','same');server=createServer({port:17962,dataDir:bDir,code:bSnap.code,restore:bSnap,onSnapshot:s=>liveStoreB.save(s),log:()=>{}});
 try{await server.listen();assert.equal(server.roomInfo().code,'TEST1234');assert.equal(server.roomInfo().roomId,snap.roomId);assert.equal(server.snapshot().revision,1);assert(server.snapshot().history.geral.some(m=>m.text==='new public'));}
 finally{await server.close();}
 // A receives newer revision and retains it; local newer server data beats older restore.
 liveStoreA.save(bSnap);assert.equal(liveStoreA.get(snap.code).revision,1);
 server=createServer({port:17963,dataDir:bDir,code:snap.code,restore:{...snap,revision:0},log:()=>{}});assert.equal(server.snapshot().revision,1);assert(server.snapshot().history.geral.some(m=>m.text==='new public'));await server.close();
 const bus=new Set();const factory=(code,onMessage)=>{const s={connected:()=>true,send:m=>{for(const listener of [...bus])queueMicrotask(()=>listener(m));},close:()=>bus.delete(onMessage)};bus.add(onMessage);return s;};
 const a=new Tunnel(null,()=>{},{signalFactory:factory}),b=new Tunnel(null,()=>{},{signalFactory:factory});
 const [ca,cb]=await Promise.all([a.inspect('TEST1234',{claim:{id:'A',revision:4},timeoutMs:30,claimMs:30}),b.inspect('TEST1234',{claim:{id:'B',revision:5},timeoutMs:30,claimMs:30})]);assert.equal(ca.state,'lost');assert.equal(cb.state,'won');assert.equal(ca.winner.id,'B');
 const branch=new RoomStore(path.join(dir,'branch'));branch.save({...snap,lineage:'older-host'});branch.save({...snap,revision:6,lineage:'new-host'});assert(fs.readdirSync(path.join(branch.root,'conflitos')).length>0,'previous host copy survives new lineage');
 assert(compareClaims({id:'A',revision:5},{id:'B',revision:5})>0);
 const unknown=new Tunnel(null,()=>{},{signalFactory:()=>({connected:()=>false,send(){},close(){}})});assert.equal((await unknown.inspect('TEST1234',{timeoutMs:1,connectMs:1})).state,'unknown');
 const host=new Tunnel(null,()=>{},{signalFactory:factory});host.hostStart('TEST1234',17962,[0,0,'host'],()=>1,()=>4);
 assert.equal((await a.inspect('TEST1234',{timeoutMs:30})).state,'online');host.stop();
 console.log('PASS: bounded public-only snapshot, revision selection, member B restores same identity/code, legacy backup, stale restore protection, deterministic concurrent claims, active host and unknown discovery');
 console.log('LIMIT: MQTT bus and clients simulated; no cross-PC/NAT proof.');
})().catch(e=>{console.error(e);process.exitCode=1});

