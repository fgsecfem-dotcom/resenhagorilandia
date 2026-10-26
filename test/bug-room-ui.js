const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {declaration}=require('./helpers/characterization-client');
const ui=fs.readFileSync(require.resolve('../app/room-ui.js'),'utf8'),client=fs.readFileSync(require.resolve('../app/client.js'),'utf8');
const bounds=vm.createContext({});vm.runInContext(declaration(ui,'boundedPosition'),bounds);
assert.deepEqual(JSON.parse(JSON.stringify(bounds.boundedPosition(-20,-50,400,300,1200,800))),{x:12,y:12});
assert.deepEqual(JSON.parse(JSON.stringify(bounds.boundedPosition(1500,900,400,300,1200,800))),{x:788,y:488});
for(const visible of [false,true]){
 const history={},ctx=vm.createContext({S:{myId:'me',users:new Map()},dmPeer:'friend',dmPanel:{},roomUI:{isDMVisible:()=>visible},dmUnread:new Set(),dmHistory:()=>history,dmStorageKey:()=>'',LS:{set:()=>true},renderDM(){},renderFriends(){},rememberContact(){},traceCommand(){},toast(){throw Error('DM must not create a toast')},sfx(){throw Error('DM must not create a sound')}});
 vm.runInContext(declaration(client,'receiveDM'),ctx);
 ctx.receiveDM({id:'one',from:'friend',to:'me',name:'Friend',text:'Private'});
 assert.equal(ctx.dmUnread.has('friend'),!visible);assert.equal(history.friend.length,1);
 ctx.receiveDM({id:'one',from:'friend',to:'me',text:'Duplicate'});assert.equal(history.friend.length,1);
 ctx.receiveDM({id:'other',from:'third',to:'fourth',text:'Not ours'});assert.equal(history.third,undefined);
}
const signals=[],V={watching:new Map(),focus:null,relayVia:new Map(),relayOut:new Map()};
const watchCtx=vm.createContext({V,S:{users:new Map([['peer',{sharing:true,screenStreamId:'stream'}]])},sig:(id,m)=>signals.push([id,m]),applyUserVolume(){},renderCall(){}});
vm.runInContext(['canRelay','watchMsg','setWatching'].map(n=>declaration(client,n)).join('\n'),watchCtx);
watchCtx.setWatching('peer',true);assert.equal(V.focus,'screen:peer');assert.equal(V.watching.get('peer'),'stream');
watchCtx.setWatching('peer',false);assert.equal(V.focus,null);assert.equal(V.watching.has('peer'),false);assert.equal(signals[1][1].watch,false);
console.log('PASS: bounded DJ placement, private DM unread/visibility/no interruption/isolation, explicit live focus; renderer integration tested separately');
