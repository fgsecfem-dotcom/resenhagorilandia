const fs=require('fs'),path=require('path'),crypto=require('crypto');
const MAX_BYTES=256*1024,MAX_MESSAGES=1000,PER_CHANNEL=200;
const MAX_CHANNELS=100;
const norm=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const roomIdFor=c=>'room-'+crypto.createHash('sha256').update('resenha-room:'+norm(c)).digest('hex').slice(0,32);
const hash=x=>crypto.createHash('sha256').update(JSON.stringify({...x,updatedAt:0})).digest('hex');
const clean=(v,n)=>String(v??'').slice(0,n);
// Same rule as uploads (server safeFileName): a replicated name can never leave files/<id>/.
const safeName=v=>{const n=String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,180).replace(/[\\/:*?"<>|]/g,'_');return !n||n==='..'||n==='.'?'arquivo':n;};
const {safeIcon,safeLook,hasLook}=require('./server/room-icon');
function makeSnapshot(input){
 const code=norm(input.code);if(code.length!==8)throw Error('Código de sala inválido.');
 const candidates=(input.channels||[]).filter(c=>c&&['text','voice'].includes(c.type));
 const selected=candidates.slice(0,MAX_CHANNELS);for(const type of ['text','voice'])if(!selected.some(c=>c.type===type)&&candidates.some(c=>c.type===type))selected[selected.length-1]=candidates.find(c=>c.type===type);
 const channels=selected.map(c=>({id:clean(c.id,20),type:c.type,name:clean(c.name,40)}));
 if(!channels.some(c=>c.type==='text')||!channels.some(c=>c.type==='voice'))throw Error('Snapshot sem canais válidos.');
 const out={schema:1,roomId:roomIdFor(code),code,name:clean(input.name||input.roomName,40)||'Minha sala',...(safeIcon(input.icon)?{icon:safeIcon(input.icon)}:{}),...(hasLook(input.look)?{look:safeLook(input.look)}:{}),revision:Math.max(0,Number.isSafeInteger(input.revision)?input.revision:0),updatedAt:Number(input.updatedAt)||Date.now(),lineage:clean(input.lineage,64),channels,configuration:{legacyPasswordUnknown:!!input.configuration?.legacyPasswordUnknown,needsPassword:!!input.configuration?.needsPassword,passwordVerifier:clean(input.configuration?.passwordVerifier,64)},history:{}};
 const sourceHistory=Array.isArray(input.history)?{[channels.find(c=>c.type==='text').id]:input.history}:input.history;
 const all=[];
 for(const c of channels.filter(c=>c.type==='text'))for(const m of (Array.isArray(sourceHistory?.[c.id])?sourceHistory[c.id]:[]).slice(-PER_CHANNEL)){
  if(!m||typeof m!=='object'||m.t==='dm'||m.private||m.to||m.from)continue;
  const msg={id:clean(m.id,32),channelId:c.id,userId:clean(m.userId,40),name:clean(m.name,32),color:clean(m.color,20),text:clean(m.text,4000),ts:Number(m.ts)||0,bot:!!m.bot,attachments:(Array.isArray(m.attachments)?m.attachments:[]).slice(0,10).filter(a=>a&&/^[A-Za-z0-9_-]{1,40}$/.test(String(a.id))).map(a=>({id:String(a.id),name:safeName(a.name),size:Math.max(0,Number(a.size)||0),type:clean(a.type,100),url:'/files/'+encodeURIComponent(String(a.id))+'/'+encodeURIComponent(safeName(a.name)),unavailable:!!a.unavailable}))};
  if(m.editedAt)msg.editedAt=Number(m.editedAt);
  if(m.replyTo)msg.replyTo={id:clean(m.replyTo.id,32),name:clean(m.replyTo.name,32),color:clean(m.replyTo.color,20),text:clean(m.replyTo.text,140)};
  msg.mentions=(m.mentions||[]).slice(0,20).map(x=>clean(x,32));all.push(msg);
 }
 all.sort((a,b)=>a.ts-b.ts||a.id.localeCompare(b.id));const kept=all.slice(-MAX_MESSAGES);
 const rebuild=(offset=0)=>{out.history={};for(const m of kept.slice(offset))(out.history[m.channelId]??=[]).push(m);};
 rebuild();
 if(Buffer.byteLength(JSON.stringify(out))>MAX_BYTES){let lo=0,hi=kept.length;while(lo<hi){const mid=Math.floor((lo+hi)/2);rebuild(mid);if(Buffer.byteLength(JSON.stringify(out))<=MAX_BYTES)hi=mid;else lo=mid+1;}rebuild(lo);}
 if(Buffer.byteLength(JSON.stringify(out))>MAX_BYTES)throw Error('Snapshot grande demais.');
 return out;
}
function passwordVerifier(roomId,password){return crypto.createHash('sha256').update(roomId+':'+String(password)).digest('hex');}
function atomic(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(obj));fs.renameSync(tmp,file);}
function backup(dir,root,reason){if(!fs.existsSync(dir))return null;fs.mkdirSync(root,{recursive:true});const target=path.join(root,Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'-'+path.basename(dir));fs.cpSync(dir,target,{recursive:true});fs.writeFileSync(path.join(target,'BACKUP.txt'),reason);return target;}
class RoomStore{
 constructor(userData){this.root=path.join(userData,'minhas-salas');this.backups=path.join(userData,'backups','salas');fs.mkdirSync(this.root,{recursive:true});}
 file(code){return path.join(this.root,norm(code)+'.json');}
 get(code){try{return makeSnapshot(JSON.parse(fs.readFileSync(this.file(code),'utf8')))}catch{return null}}
 list(){return fs.readdirSync(this.root).filter(f=>/^[A-Z0-9]{8}\.json$/.test(f)).map(f=>this.get(f.slice(0,8))).filter(Boolean);}
 save(raw){const next=makeSnapshot(raw),old=this.get(next.code);if(old&&old.revision>next.revision)return {saved:false,newerLocal:true,revision:old.revision};
  if(old&&((old.revision===next.revision&&hash(old)!==hash(next))||(old.lineage&&next.lineage&&old.lineage!==next.lineage))){const conflict=path.join(this.root,'conflitos',next.code+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json');atomic(conflict,old);}
  if(!old&&fs.existsSync(this.file(next.code)))fs.copyFileSync(this.file(next.code),this.file(next.code)+'.invalid-'+Date.now()+'.bak');
  atomic(this.file(next.code),next);return {saved:true,revision:next.revision};}
}
function compareClaims(a,b){const ar=Number(a.revision)||0,br=Number(b.revision)||0;if(ar!==br)return ar>br?1:-1;const ai=String(a.id),bi=String(b.id);return ai===bi?0:ai<bi?1:-1;}
module.exports={makeSnapshot,roomIdFor,norm,passwordVerifier,atomic,backup,RoomStore,compareClaims,MAX_BYTES,MAX_MESSAGES,PER_CHANNEL};
