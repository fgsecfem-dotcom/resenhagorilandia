// Hospedeiro dos temas com sala própria: monta só no tema certo e com sala aberta, atualiza, desmonta ao trocar e sobrevive a erro do tema.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const kids=[],html={dataset:{}};
const el=()=>({className:'',id:'',remove(){const i=kids.indexOf(this);if(i>=0)kids.splice(i,1);}});
const ctx=vm.createContext({window:{THEMES:{resenha:{},sintonia:{skin:true},ape:{skin:true}}},console:{error(){}},
 document:{documentElement:html,createElement:el,getElementById:()=>({append:(n)=>kids.push(n)})}});
vm.runInContext(fs.readFileSync(require.resolve('../app/skins/skins.js'),'utf8'),ctx);
const S=ctx.window.ResenhaSkins,log=[];
const fake=(n)=>({mount:(root,a)=>log.push(n+':mount:'+(root.id)+':'+typeof a.ok),update:(m)=>log.push(n+':update:'+m.v),speaking:(ids)=>log.push(n+':speak:'+ids.size),unmount:()=>log.push(n+':unmount')});
S.register('sintonia',fake('s'));S.register('ape',{...fake('a'),update(){throw new Error('quebrou');}});
const actions={ok(){}};
S.sync('resenha',{v:1},actions);assert.equal(S.active,'');assert.equal(kids.length,0,'tema sem sala própria não monta nada');
S.sync('sintonia',null,actions);assert.equal(S.active,'','sem sala aberta não monta');
S.sync('sintonia',{v:1},actions);S.sync('sintonia',{v:2},actions);S.speaking(new Set(['a','b']));
assert.equal(S.active,'sintonia');assert.equal(html.dataset.skin,'sintonia');assert.equal(kids.length,1);
S.sync('ape',{v:3},actions);assert.equal(S.active,'ape','erro no update não derruba o app nem o tema');assert.equal(kids.length,1);
S.sync('resenha',{v:4},actions);assert.equal(S.active,'');assert.equal(html.dataset.skin,undefined);assert.equal(kids.length,0);
assert.deepEqual(log,['s:mount:skin-root:function','s:update:1','s:update:2','s:speak:2','s:unmount','a:mount:skin-root:function','a:unmount']);
console.log('PASS: temas com sala própria montam, atualizam e desmontam no hospedeiro sem derrubar o app');
