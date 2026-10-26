const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const current=path.resolve(__dirname,'..'),reference=process.env.RESENHA_REFERENCE_ROOT||path.resolve(__dirname,'../../refactor-reference16/resenhaapp');
function formatters(root){
 const file=path.join(root,'app/format-utils.js'),source=fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/^export /gm,''):fs.readFileSync(path.join(root,'app/client.js'),'utf8').split(/\r?\n/).filter(line=>/^const (esc|clamp|fmtCode) =/.test(line)).join('\n');
 const context=vm.createContext({});vm.runInContext(source+'\nglobalThis.formatters={esc,clamp,fmtCode};',context);return context.formatters;
}
const a=formatters(reference),b=formatters(current);
for(const value of [undefined,null,false,0,NaN,'',"<&\"' café 🐶",'audi-1234',' ab-c!1234 ','123456789']){assert.equal(b.esc(value),a.esc(value));assert.equal(b.fmtCode(value),a.fmtCode(value));}
for(const value of [-100,0,1,50,100,200,999,NaN,undefined])assert.equal(b.clamp(value,0,200),a.clamp(value,0,200));
const old=require(path.join(reference,'room-state')),now=require('../room-state');
for(const count of [2,60,100,120]){
 const channels=Array.from({length:count},(_,i)=>({id:'c'+i,type:i===count-1?'voice':'text',name:'Canal '+i}));
 const input={code:'TEST-1234',name:'Sala café 🐶',updatedAt:123,revision:7,lineage:'fixed',channels,history:{c0:[{id:'public',text:'<&> café',ts:1},{id:'dm',text:'private',t:'dm',to:'peer',ts:2}]},configuration:{needsPassword:false}};
 assert.deepEqual(now.makeSnapshot(input),old.makeSnapshot(input));
}
assert.deepEqual(Object.keys(now),Object.keys(old));
console.log('PASS: formatter edge cases and room snapshot output/export contract equal frozen preview 16');
