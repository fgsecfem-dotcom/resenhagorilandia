const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app/client.js'),'utf8');
const code=source.slice(source.indexOf('function updateTile('),source.indexOf('function setWatching('));
(async()=>{
 const handlers={},buttons=new Map();let exited=0,watchChange;
 const video={srcObject:null,paused:false,play:async()=>{video.paused=false},pause:()=>{video.paused=true}};
 const tools={innerHTML:'',dataset:{}},label={innerHTML:''},body={querySelector:()=>video};
 const tile={classList:{toggle(){}},dataset:{},firstElementChild:body,querySelector:s=>s==='video'?video:s==='.label'?label:tools,requestFullscreen:async()=>{context.document.fullscreenElement=tile}};
 const V={muted:false,deafened:false,screen:{id:'mine'},previewHidden:false,windowVisible:true,watching:new Map(),focus:null,joined:true};
 const context=vm.createContext({V,S:{myId:'me'},WEB_VIEWER:false,tileCache:new Map([['screen:me',tile],['screen:other',tile]]),makeTile:()=>tile,icon:n=>n,esc:s=>s,nameHTML:u=>u.name,renderCall:()=>{},getRemoteScreen:()=>({id:'remote'}),setMuted:m=>{V.muted=m},setDeafened:d=>{V.deafened=d},setWatching:(id,active)=>{watchChange=[id,active]},document:{fullscreenElement:null,exitFullscreen:async()=>{exited++;context.document.fullscreenElement=null}},$: (selector,parent)=>{if(!buttons.has(selector))buttons.set(selector,{addEventListener:(event,fn)=>{handlers[selector]=fn}});return buttons.get(selector)}});
 vm.runInContext(code,context);context.updateTile('screen:me',{id:'me',name:'Me'},true);
 await handlers['[data-full]']();assert.equal(context.document.fullscreenElement,tile);
 let stopped=0; const event={stopPropagation(){stopped++}};
 handlers['[data-live-mic]'](event);assert(V.muted);handlers['[data-live-deafen]'](event);assert(V.deafened);assert.equal(stopped,2,'controls stop the click before state updates replace the target');assert.equal(context.document.fullscreenElement,tile);
 handlers['[data-live-pause]']();assert(video.paused);handlers['[data-live-pause]']();assert(!video.paused);
 await handlers['[data-stop]']();assert.equal(exited,1);assert(V.previewHidden);assert(V.screen,'Hiding own preview must preserve capture');assert(V.joined);
 V.watching.set('other','stream');context.document.fullscreenElement=tile;context.updateTile('screen:other',{id:'other',name:'Other',screenStreamId:'stream'},true);
 await handlers['[data-stop]']();assert.deepEqual(watchChange,['other',false]);assert(V.joined,'Leaving live must preserve voice call');assert.equal(context.document.fullscreenElement,null);
 console.log('PASS: tile fullscreen, microphone/deafen controls, pause, own-preview preservation and unsubscribe without leaving voice');
})().catch(e=>{console.error(e);process.exitCode=1});

// Idle controls: show on activity, hide after timeout, keep visible over controls.
{
 let pending,hover=false;const listeners={},classes=new Set();
 const tile={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},addEventListener:(e,f)=>listeners[e]=f,querySelector:()=>({matches:()=>hover})};
 const context=vm.createContext({document:{fullscreenElement:tile},clearTimeout:()=>{pending=null},setTimeout:(fn,ms)=>{assert.equal(ms,2500);pending=fn;return 1;}});
 vm.runInContext(source.slice(source.indexOf('function installLiveOverlay('),source.indexOf('function makeTile(')),context);
 context.installLiveOverlay(tile);listeners.pointermove();assert(classes.has('controls-visible'));pending();assert(!classes.has('controls-visible'));
 listeners.keydown();assert(classes.has('controls-visible'));hover=true;pending();assert(classes.has('controls-visible'));hover=false;pending();assert(!classes.has('controls-visible'));
 tile.disposeOverlay();assert.equal(pending,null);
 console.log('PASS: fullscreen overlay idle timer, pointer/keyboard reveal, hover hold and cleanup');
}
