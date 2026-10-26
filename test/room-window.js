const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const main=fs.readFileSync(require.resolve('../main.js'),'utf8');
const a=main.indexOf("  win.on('close', (e) => {"),b=main.indexOf('\n  tunnel =',a);
for(const keep of [false,true]){let close,quit=0,hide=0,prevent=0;const ctx=vm.createContext({win:{on:(e,f)=>close=f,hide:()=>hide++},host:{},keepHostOnline:keep,quitting:false,TEST_MODE:false,app:{quit:()=>quit++},Notification:{isSupported:()=>false}});vm.runInContext(main.slice(a,b),ctx);close({preventDefault:()=>prevent++});assert.equal(quit,keep?0:1);assert.equal(hide,keep?1:0);assert.equal(prevent,keep?1:0);}
console.log('PASS: host window close quits by default and hides only with explicit background option');
