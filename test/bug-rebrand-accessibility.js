// Confere os tokens reais de cada paleta e tema (não uma cópia dos valores): texto, secundário e rótulo dos botões com contraste mínimo.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const properties={},appearance={matches:false,addEventListener(){}};
const c=vm.createContext({window:{},matchMedia:()=>appearance,document:{documentElement:{dataset:{},style:{setProperty:(k,v)=>properties[k]=v},classList:{toggle(){}}}}});
vm.runInContext(fs.readFileSync(require.resolve('../app/themes.js'),'utf8'),c);
const W=c.window,contrast=W.colorContrast;
const cases=[...Object.keys(W.RESENHA_PALETTES).map(p=>['resenha',p]),...W.VISIBLE_THEMES.filter(k=>k!=='resenha').map(k=>[k,'auto'])];
for(const [theme,palette] of cases){
 W.applyTheme(theme,palette);
 for(const background of ['--bg-main','--bg-panel','--bg-input'])for(const text of ['--text','--text-hi','--muted'])assert(contrast(properties[text],properties[background])>=4.5,`${theme}/${palette}: ${text} sobre ${background}`);
 if(theme!=='vidro')assert(contrast(properties['--on-accent'],properties['--accent'])>=4.5,`${theme}/${palette}: rótulo do botão principal`);
 assert(contrast(properties['--text-hi'],properties['--active'])>=4.5,`${theme}/${palette}: canal ativo`);
}
for(const key of ['system','arcDark','arcLight','discord','meianoite','claro','roxo','oceano','floresta','sangue','pastel','creme'])assert(W.VISIBLE_THEMES.includes(W.themeKey(key)),`tema salvo ${key} continua abrindo`);
console.log('PASS: '+cases.length+' combinações de tema e paleta com contraste mínimo; temas salvos antigos continuam abrindo');
