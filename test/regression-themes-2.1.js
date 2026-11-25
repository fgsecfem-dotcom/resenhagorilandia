// Temas antigos (2.1 e 2.2) migram para os seis da 2.6 sem quebrar: o tema abre, a paleta mais parecida vem junto.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const properties={},appearance={matches:true,addEventListener(){}},root={dataset:{},style:{setProperty:(k,v)=>properties[k]=v},classList:{toggle(){}}};
const c=vm.createContext({window:{},matchMedia:()=>appearance,document:{documentElement:root}});
vm.runInContext(fs.readFileSync(require.resolve('../app/themes.js'),'utf8'),c);
const W=c.window;
for(const old of ['vision','visionNoite','cosmos','neon','brasa','bento','cinema','holofoil','noturno','ametista','fucsia','horizonte','ambar','titanio']){
 assert(!W.VISIBLE_THEMES.includes(old),old+' saiu da escolha');
 const now=W.RETIRED_THEMES[old];assert(W.VISIBLE_THEMES.includes(now),old+' vai para um tema atual');
 W.applyTheme(old,W.RETIRED_PALETTES[old]||'auto');assert.equal(root.dataset.tk,now,old+' abre como '+now);
}
assert.equal(W.RETIRED_THEMES.holofoil,'vidro');assert.equal(W.RETIRED_PALETTES.bento,'marmore');assert.equal(W.RETIRED_PALETTES.cinema,'vinho');
console.log('PASS: temas da 2.1 e 2.2 migram para os da 2.6 com a paleta mais parecida');
