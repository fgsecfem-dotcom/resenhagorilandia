const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),https=require('https'),crypto=require('crypto');
const WS=require('ws'),{createServer}=require('../server'),{mobileTLS}=require('../mobile-tls');
const wait=async(fn)=>{for(let i=0;i<150;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,20));}throw Error('timeout')};
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'resenha-mobile-'));const tls=await mobileTLS(path.join(dir,'tls'),['192.168.0.2']);
 const again=await mobileTLS(path.join(dir,'tls'),['192.168.0.3']);assert.equal(tls.fingerprint,again.fingerprint);
 const ca=new crypto.X509Certificate(tls.publicCA),leaf=new crypto.X509Certificate(tls.cert);assert(leaf.verify(ca.publicKey));assert.equal(leaf.checkIP('127.0.0.1'),'127.0.0.1');
 const server=createServer({port:17952,dataDir:path.join(dir,'room'),log:()=>{}});let clients=[];
 try{await server.listen();const port=await server.listenSecure(tls);
 const body=await new Promise((resolve,reject)=>https.get({hostname:'127.0.0.1',port,path:'/api/info',ca:ca.toString()},r=>{let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve(b));}).on('error',reject));assert.equal(JSON.parse(body).app,'resenha');
 const join=async(i,secure)=>{const ws=new WS(`${secure?'wss':'ws'}://127.0.0.1:${secure?port:17952}`,secure?{ca:ca.toString()}:{});ws.messages=[];ws.on('message',d=>ws.messages.push(JSON.parse(d)));await new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej)});ws.send(JSON.stringify({t:'hello',name:'Test '+i,cid:'mobile-test-'+i}));const welcome=await wait(()=>ws.messages.find(x=>x.t==='welcome'));ws.uid=welcome.id;ws.sendJSON=x=>ws.send(JSON.stringify(x));clients.push(ws);return ws;};
 const a=await join(1,false),b=await join(2,true),c=await join(3,true),d=await join(4,false);
 assert(b.messages.find(x=>x.t==='welcome').features.includes('chat-ack'));
 b.sendJSON({t:'chat',channelId:'geral',text:'mobile chat',requestId:'chat-test'});
 assert((await wait(()=>b.messages.find(x=>x.requestId==='chat-test'))).ok);await wait(()=>a.messages.find(x=>x.t==='chat'&&x.msg.text==='mobile chat'));
 b.sendJSON({t:'dm',to:a.uid,text:'private',requestId:'dm-test'});assert((await wait(()=>b.messages.find(x=>x.requestId==='dm-test'))).ok);await wait(()=>a.messages.find(x=>x.t==='dm'));assert(!c.messages.some(x=>x.t==='dm'));
 b.sendJSON({t:'state',voiceChannel:'lobby',muted:false,deafened:false});await wait(()=>a.messages.find(x=>x.t==='user-update'&&x.user?.id===b.uid&&x.user.voiceChannel==='lobby'));
 b.sendJSON({t:'state',voiceChannel:null});await wait(()=>a.messages.find(x=>x.t==='user-update'&&x.user?.id===b.uid&&x.user.voiceChannel===null));
 b.close();await wait(()=>server.clientCount()===3);const back=await join(2,true);assert(back.uid);
 console.log('PASS: trusted TLS/SAN and persistent CA, 4 mixed HTTP/HTTPS clients, shared chat ACK, private routing, channel join/leave and reconnect');
 }finally{clients.forEach(c=>c.terminate());await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
