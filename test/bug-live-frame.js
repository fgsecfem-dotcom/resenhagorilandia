const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {declaration}=require('./helpers/characterization-client');
const source=fs.readFileSync(require.resolve('../app/room-ui.js'),'utf8'),ctx=vm.createContext({});vm.runInContext(declaration(source,'fitLiveFrame'),ctx);
for(const [w,h] of [[1920,1080],[1024,768],[2560,1080],[1080,1920]])for(const [aw,ah] of [[1600,630],[900,700],[350,240]]){
 const f=ctx.fitLiveFrame(w,h,aw,ah);assert(f.width<=aw+1e-8&&f.height<=ah+1e-8);assert(Math.abs(f.width/f.height-w/h)<1e-8);assert(Math.abs(f.width-aw)<1e-8||Math.abs(f.height-ah)<1e-8);
}
assert.equal(ctx.fitLiveFrame(1920,1080,0,500),null);assert.equal(ctx.fitLiveFrame(1,1,Infinity,500),null);
assert.equal(ctx.fitLiveFrame(0,0,1600,900).width,1600);
// The real controller must follow video replacement, resolution changes, stage resize and disposal.
const listeners=new Map(),docListeners=new Map(),styles={};let video={videoWidth:1024,videoHeight:768,addEventListener:(e,f)=>listeners.set(e,f),removeEventListener:e=>listeners.delete(e)};
const parent={clientWidth:1200,clientHeight:600,classList:{contains:()=>true}},tile={parentElement:parent,style:styles,querySelector:()=>video};let disconnected=0;
Object.assign(ctx,{document:{fullscreenElement:null,addEventListener:(e,f)=>docListeners.set(e,f),removeEventListener:e=>docListeners.delete(e)},getComputedStyle:()=>({borderLeftWidth:'1',borderRightWidth:'1',borderTopWidth:'1',borderBottomWidth:'1'}),ResizeObserver:class{constructor(f){this.callback=f}observe(){}disconnect(){disconnected++}}});
vm.runInContext(declaration(source,'installLiveFrame'),ctx);ctx.installLiveFrame(tile);
assert(Math.abs(parseFloat(styles.width)-(598*4/3+2))<.01);
video.videoWidth=1920;video.videoHeight=1080;listeners.get('resize')();assert(Math.abs((parseFloat(styles.width)-2)/598-16/9)<1e-8);
ctx.document.fullscreenElement=tile;const previous=styles.width;parent.clientWidth=600;tile.refreshFrame();assert.equal(styles.width,previous);ctx.document.fullscreenElement=null;docListeners.get('fullscreenchange')();assert.equal(parseFloat(styles.width),600);
tile.parentElement=null;tile.refreshFrame();assert.equal(styles.width,'');tile.disposeFrame();assert.equal(listeners.size,0);assert.equal(docListeners.size,0);assert(disconnected>0);assert.equal(tile.refreshFrame,undefined);
console.log('PASS: source proportions, bounded layout, 4:3, ultrawide, portrait, metadata, resolution changes, fullscreen return and observer disposal');
