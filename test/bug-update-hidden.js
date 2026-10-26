// 2.1.3: o atualizador não usa PowerShell (o Kaspersky bloqueava o PowerShell escondido).
// O ajudante é o Resenha.exe da pasta preparada, em modo Node, aberto sem janela e independente do app.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{EventEmitter}=require('events');
const root=fs.mkdtempSync(path.resolve(__dirname,'../../../work/resenha-hidden-test-')),calls=[];
for(const f of ['update-manager.js','update-helper.js'])assert(!/powershell|EncodedCommand|ExecutionPolicy/i.test(fs.readFileSync(path.join(__dirname,'..',f),'utf8')),f+' não pode usar PowerShell');
const moduleDouble={exports:{}};
const spawn=(file,args,options)=>{calls.push({file,args,options});const child=new EventEmitter();child.pid=123;child.exitCode=null;child.unref=()=>{};child.kill=()=>{};
 fs.writeFileSync(path.join(root,'helper-started.json'),JSON.stringify({id:'test',parentPid:process.pid}));return child;};
const context=vm.createContext({module:moduleDouble,require:name=>name==='child_process'?{spawn}:require(path.isAbsolute(name)||!name.startsWith('.')?name:path.resolve(__dirname,'..',name)),process,Buffer,console,setTimeout,clearTimeout,__dirname:path.resolve(__dirname,'..')});
vm.runInContext(fs.readFileSync(require.resolve('../update-manager'),'utf8'),context);
(async()=>{try{
 const {UpdateManager}=moduleDouble.exports;
 const m=new UpdateManager({userData:path.join(root,'profile'),appDir:path.join(root,'app'),version:'1.4.0-preview.18',platform:'win32'});
 fs.mkdirSync(m.cache,{recursive:true});fs.mkdirSync(path.join(root,'staging'));
 const plan=path.join(root,'plan.json'),helper=path.join(root,'update-helper.js');
 fs.writeFileSync(plan,JSON.stringify({id:'test',root,target:m.appDir,staging:path.join(root,'staging'),version:'next'}));
 fs.writeFileSync(m.pendingFile,JSON.stringify({plan,helper}));m.validateTarget=()=>{};
 assert.equal(await m.launch(),true);assert.equal(calls.length,1);const c=calls[0];
 assert.equal(c.file,path.join(root,'staging','Resenha.exe'));assert.deepEqual([...c.args],[helper,'--plan',plan]);
 assert.equal(c.options.detached,true);assert.equal(c.options.windowsHide,true);assert.equal(c.options.env.ELECTRON_RUN_AS_NODE,'1');assert.equal(c.options.cwd,root);
 // Plano antigo (feito por uma versão com ajudante .ps1) é descartado, não executado.
 const m2=new UpdateManager({userData:path.join(root,'profile2'),appDir:path.join(root,'app'),version:'1.4.0-preview.18',platform:'win32'});fs.mkdirSync(m2.cache,{recursive:true});
 fs.writeFileSync(m2.pendingFile,JSON.stringify({plan,helper:path.join(root,'update-helper.ps1')}));m2.validateTarget=()=>{};assert.equal(await m2.launch(),false);assert(!fs.existsSync(m2.pendingFile));assert.equal(calls.length,1);
 console.log('PASS: sem PowerShell; ajudante = Resenha.exe novo em modo Node, sem janela e independente; plano antigo .ps1 descartado');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
