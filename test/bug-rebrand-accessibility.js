// Check the actual runtime theme tokens, not a second copy of the palette values.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const properties={},appearance={matches:false,addEventListener(){}};
const c=vm.createContext({window:{},matchMedia:()=>appearance,document:{documentElement:{style:{setProperty:(k,v)=>properties[k]=v},classList:{toggle(){}}}}});
vm.runInContext(fs.readFileSync(require.resolve('../app/themes.js'),'utf8'),c);
const luminance=hex=>{
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
assert.deepEqual(Object.keys(c.window.PALETTES),['lavanda','hortela','pessego','rosa','ceu']);
for(const theme of ['arcDark','arcLight'])for(const palette of Object.keys(c.window.PALETTES)){
 c.window.applyTheme(theme,palette);
 for(const background of ['--bg-main','--bg-panel','--bg-input'])for(const text of ['--text','--text-hi','--muted'])assert(contrast(properties[text],properties[background])>=4.5,`${theme}/${palette}: ${text} on ${background}`);
 for(const background of ['--blurple','--blurple-h'])assert(contrast('#ffffff',properties[background])>=4.5,`${theme}/${palette}: white action label on ${background}`);
 assert(contrast(properties['--link'],properties['--active'])>=4.5,`${theme}/${palette}: active channel`);
}
for(const key of ['system','arcDark','arcLight','discord','meianoite','claro','roxo','oceano','floresta','sangue','pastel','creme'])assert(c.window.THEMES[key],`persisted legacy theme ${key} remains accepted`);
console.log('PASS: five palettes in light/dark meet text and primary-button contrast; persisted theme identifiers retained');
