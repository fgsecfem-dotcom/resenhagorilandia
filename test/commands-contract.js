const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
function fixture(){
 const source=fs.readFileSync(path.join(__dirname,'../app/client.js'),'utf8');
 const start=source.indexOf('const commandRequests ='),end=source.indexOf('// ---------------- Troca automática',start);
 assert(start>=0&&end>start);
 const sent=[],timers=new Map();let id=0;
 const context=vm.createContext({S:{ws:{readyState:1},features:['chat-ack','dm-ack','dj-ack']},crypto:{randomUUID:()=> 'request-'+(++id)},setTimeout:(fn,ms)=>{const key={};timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key),wsSend:m=>sent.push(m),toast(){}});
 require('./helpers/characterization-client').installBrowserModule(path.resolve(__dirname,'..'),'app/command-controller.js',context);
 vm.runInContext(source.slice(start,end),context);
 return{context,sent,timers};
}
(async()=>{
 let f=fixture();f.context.S.ws=null;await assert.rejects(f.context.sendCommand('chat'),/Sem conexão/);assert.equal(f.timers.size,0);console.log('ok 1 - offline rejects before allocating timer');
 f=fixture();f.context.S.features=[];await assert.rejects(f.context.sendCommand('chat'),/suporte/);assert.equal(f.sent.length,0);console.log('ok 2 - capability requirement remains unchanged');
 f=fixture();let task=f.context.sendCommand('dm',{to:'B',text:'original'});assert.equal(f.sent[0].requestId,'request-1');assert.equal(f.sent[0].t,'dm');assert.equal([...f.timers.values()][0].ms,8000);f.context.finishCommand({requestId:'request-1',ok:true});await task;assert.equal(f.timers.size,0);console.log('ok 3 - correlated ACK resolves and releases timer');
 f=fixture();task=f.context.sendCommand('chat');f.context.finishCommand({requestId:'request-1',ok:false,error:'visible-error'});await assert.rejects(task,/visible-error/);assert.equal(f.timers.size,0);console.log('ok 4 - correlated failure propagates text unchanged');
 for(const [type,ms]of[['chat',8000],['dj-add',180000]]){f=fixture();task=f.context.sendCommand(type);const timer=[...f.timers.values()][0];assert.equal(timer.ms,ms);timer.fn();await assert.rejects(task,/texto foi mantido/);assert.equal(vm.runInContext('commandRequests.size',f.context),0);}console.log('ok 5 - calibrated deadlines and timeout semantics');
 f=fixture();const first=f.context.sendCommand('chat'),second=f.context.sendCommand('dm');f.context.rejectPendingCommands('disconnected');await assert.rejects(first,/disconnected/);await assert.rejects(second,/disconnected/);assert.equal(f.timers.size,0);for(let i=0;i<85;i++)f.context.traceCommand('chat','sent');assert.equal(vm.runInContext('commandTrace.length',f.context),80);console.log('ok 6 - disconnect rejects all requests; trace stays bounded');console.log('1..6');
})().catch(error=>{console.error(error);process.exitCode=1});
