// Temas completos (2.1.2): contraste mínimo, visíveis na escolha e sem paleta por cima. Os da 2.1.1 continuam aceitos.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const properties={},classes={},appearance={matches:false,addEventListener(){}};
const c=vm.createContext({window:{},matchMedia:()=>appearance,document:{documentElement:{style:{setProperty:(k,v)=>properties[k]=v},classList:{toggle:(k,on)=>classes[k]=!!on}}}});
vm.runInContext(fs.readFileSync(require.resolve('../app/themes.js'),'utf8'),c);
const lum=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const list=['vision','cosmos','neon','brasa','bento','cinema'];for(const key of list){
 assert(c.window.VISIBLE_THEMES.includes(key),`${key} aparece na escolha de tema`);
 const theme=c.window.THEMES[key];c.window.applyTheme(key,'rosa');
 assert.equal(properties['--blurple'],theme.vars.blurple,`${key}: a paleta não troca a cor de destaque`);
 assert.equal(classes['theme-fixed'],true,`${key}: marca o tema como completo`);
 for(const bg of ['--bg-main','--bg-panel','--bg-input'])for(const tx of ['--text','--text-hi','--muted'])assert(contrast(properties[tx],properties[bg])>=4.5,`${key}: ${tx} sobre ${bg}`);
 for(const bg of ['--blurple','--blurple-h'])assert(contrast('#ffffff',properties[bg])>=4.5,`${key}: texto branco sobre ${bg}`);
 assert(contrast(properties['--link'],properties['--active'])>=4.5,`${key}: canal ativo`);
}
for(const [old,now] of Object.entries(c.window.RETIRED_THEMES)){assert(!c.window.VISIBLE_THEMES.includes(old),old+' saiu da escolha');c.window.applyTheme(old);assert.equal(properties['--bg-rail'],c.window.THEMES[now].vars['bg-rail'],old+' vira '+now);}
for(const key of ['midnight','ember','nord','mocha','rose'])assert(c.window.THEMES[key],`tema antigo ${key} segue aceito`);
c.window.applyTheme('arcDark','rosa');assert.equal(classes['theme-fixed'],true,'tema padrão tem cor própria (identidade: preto fosco e laranja)');assert.equal(properties['--link'],'#ff9a57','laranja do Resenha nos detalhes');
for(const [old,now] of [['noturno','cosmos'],['ametista','neon'],['fucsia','cinema'],['horizonte','vision'],['ambar','brasa'],['titanio','bento']])assert.equal(c.window.RETIRED_THEMES[old],now,old+' (2.1) vira '+now+' (2.2)');
console.log('PASS: '+list.length+' temas completos com contraste mínimo, visíveis e independentes da paleta; temas da 2.1 migram para os da 2.2');
