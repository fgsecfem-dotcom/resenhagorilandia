// Release discovery: credentials are never needed for this public repository.
const https=require('https'), http=require('http');
const source=require('./update-source.json');
const REPO=source.owner+'/'+source.repo;
function request(url,redirects=8,{allowLocal=false}={}) {
 const u=new URL(url);
 if(u.protocol!=='https:' && !(allowLocal && u.protocol==='http:' && ['127.0.0.1','localhost'].includes(u.hostname))) return Promise.reject(new Error('Endereço de atualização inválido.'));
 return new Promise((resolve,reject)=>{
 const req=(u.protocol==='https:'?https:http).get(u,{headers:{'User-Agent':'Resenha-Updater',Accept:'application/vnd.github+json'},timeout:30000},res=>{
 if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location&&redirects>0){res.resume();resolve(request(new URL(res.headers.location,u).href,redirects-1,{allowLocal}));}else resolve(res);
 });req.on('timeout',()=>req.destroy(new Error('Tempo esgotado.')));req.on('error',reject);
 });
}
async function body(res,limit=2*1024*1024){let s='';for await(const c of res){s+=c.toString('utf8');if(Buffer.byteLength(s)>limit)throw new Error('Resposta muito grande.');}return s;}
function parseVersion(value) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value || ''));
  return m ? { core: m.slice(1, 4).map(Number), pre: m[4] ? m[4].split('.') : [] } : null;
}
function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] > y.core[i] ? 1 : -1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    if (x.pre[i] === undefined) return -1;
    if (y.pre[i] === undefined) return 1;
    if (x.pre[i] === y.pre[i]) continue;
    const xn = /^\d+$/.test(x.pre[i]), yn = /^\d+$/.test(y.pre[i]);
    if (xn && yn) return Number(x.pre[i]) > Number(y.pre[i]) ? 1 : -1;
    if (xn !== yn) return xn ? -1 : 1;
    return x.pre[i] > y.pre[i] ? 1 : -1;
  }
  return 0;
}
function newer(a, b) { return compareVersions(a, b) > 0; }

function selectRelease(releases,current,{platform=process.platform,arch=process.arch,channel=parseVersion(current)?.pre.length?'preview':'stable'}={}) {
 const candidates=(Array.isArray(releases)?releases:[]).filter(r=>!r.draft&&parseVersion(r.tag_name)&&(channel==='preview'||!r.prerelease&&!parseVersion(r.tag_name).pre.length)&&newer(r.tag_name,current)).sort((a,b)=>compareVersions(b.tag_name,a.tag_name));
 for(const r of candidates){
 const a=r.assets||[];
 const pattern=platform==='darwin'?new RegExp('mac-'+(arch==='arm64'?'apple':'intel')+'\\.zip$','i'):platform==='win32'?new RegExp('Windows-'+arch+'\\.zip$','i'):null;
 if(!pattern)continue;
 const asset=a.find(x=>pattern.test(x.name)),sums=a.find(x=>x.name===(platform==='darwin'?'SHA256SUMS-mac.txt':'SHA256SUMS.txt'));
 if(!asset)continue;
 return {update:true,manual:!['win32','darwin'].includes(platform)||!sums,version:r.tag_name.replace(/^v/,''),current,notes:String(r.body||'').slice(0,4000),url:asset.browser_download_url,name:asset.name,size:asset.size,hashUrl:sums?.browser_download_url,page:r.html_url};
 }return {update:false,reason:'Nenhuma versão nova neste canal.'};
}
async function check(current,options={}){
 try{
 const res=await request(options.api||`https://api.github.com/repos/${REPO}/releases?per_page=100`,8,options);
 if(res.statusCode!==200){const status=res.statusCode;const reset=Number(res.headers['x-ratelimit-reset'])*1000;res.resume();return {update:false,rateLimited:[403,429].includes(status),retryAt:Number.isFinite(reset)&&reset>Date.now()?reset:Date.now()+30*60*1000,reason:status===404?'Ainda não há releases disponíveis.':`Verificação adiada (HTTP ${status}).`};}
 return selectRelease(JSON.parse(await body(res)),current,options);
 }catch(e){return {update:false,retryAt:Date.now()+30*60*1000,reason:'Sem conexão com as releases. Tentaremos mais tarde.',error:e.message};}
}
module.exports={check,request,body,parseVersion,newer,compareVersions,selectRelease,REPO};
