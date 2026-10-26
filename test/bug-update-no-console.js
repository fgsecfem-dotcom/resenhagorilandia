// O ajudante de atualização roda sem console (nenhum conhost.exe filho) e continua vivo depois que o app fecha.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');const {runPS}=require('./helpers/ps');
if(process.platform!=='win32'){console.log('SKIP Windows native console lifecycle probe');process.exit(0)}
const root=path.resolve(__dirname,'../../../work/update-console-probe-'+crypto.randomUUID());fs.mkdirSync(root);
const probe=path.join(root,'probe.js'),planFile=path.join(root,'plan.json'),profile=path.join(root,'profile'),target=path.join(root,'app'),staging=path.join(root,'staging');fs.mkdirSync(staging);fs.mkdirSync(path.join(profile,'updates'),{recursive:true});
fs.writeFileSync(probe,`const fs=require('fs'),path=require('path');const p=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--plan')+1],'utf8'));
setTimeout(()=>fs.writeFileSync(path.join(p.root,'helper-started.json'),JSON.stringify({id:p.id,parentPid:p.parentPid,helperPid:process.pid})),800);
setTimeout(()=>{let alive=true;try{process.kill(p.parentPid,0)}catch{alive=false}fs.writeFileSync(path.join(p.root,'probe-result.json'),JSON.stringify({pid:process.pid,parentAlive:alive,tty:!!process.stdout.isTTY}))},3000);
setTimeout(()=>{},7000);`);
fs.writeFileSync(planFile,JSON.stringify({id:'console-test',root,target,staging,version:'next'}));fs.writeFileSync(path.join(profile,'updates','pending.json'),JSON.stringify({plan:planFile,helper:probe}));
const parent=path.join(root,'parent.js');fs.writeFileSync(parent,`const {UpdateManager}=require(${JSON.stringify(require.resolve('../update-manager'))});const m=new UpdateManager(${JSON.stringify({userData:profile,appDir:target,version:'1.5.1',platform:'win32',options:{helperRunner:process.execPath}})});m.validateTarget=()=>{};m.launch().then(ok=>process.exit(ok?0:2)).catch(e=>{console.error(e);process.exit(1)});`);
(async()=>{
 await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[parent],{windowsHide:true,stdio:['ignore','pipe','pipe']});let err='';p.stdout.resume();p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('launcher failed '+code+' '+err)));});
 const result=path.join(root,'probe-result.json');for(let n=0;n<100&&!fs.existsSync(result);n++)await new Promise(r=>setTimeout(r,100));assert(fs.existsSync(result),'independent helper survived parent exit');
 const r=JSON.parse(fs.readFileSync(result,'utf8'));assert.equal(r.parentAlive,false,'parent has exited');assert.equal(r.tty,false,'no terminal attached');
 const q=path.join(root,'q.ps1'),out=path.join(root,'children.txt');fs.writeFileSync(q,`$c=@(Get-CimInstance Win32_Process -Filter "ParentProcessId=${r.pid}" | Where-Object { $_.Name -eq 'conhost.exe' }).Count\nSet-Content -LiteralPath '${out}' -Value $c`);await runPS(q,[]);
 assert.equal(fs.readFileSync(out,'utf8').trim(),'0','no console host attached to the helper');
 console.log('PASS: helper (Electron em modo Node) sem console, confirma depois que o app sai e sobrevive a ele; '+root);
})().catch(e=>{console.error(e);process.exitCode=1});
