// Só para os testes: monta arquivos de exemplo (ZIP, exe de teste) com PowerShell. O app não usa PowerShell.
const {spawn}=require('child_process'),path=require('path');
function runPS(script,args){return new Promise((resolve,reject)=>{const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});p.stdout.resume();let err='';p.stderr.on('data',c=>err+=c);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(err.slice(-1200)||'PowerShell falhou')));});}
// Roda o ajudante de atualização como o app roda: um executável Electron em modo Node.
function runHelper(planPath,extra=[],env={}){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(__dirname,'..','..','update-helper.js'),'--plan',planPath,...extra],{windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',...env},stdio:['ignore','pipe','pipe']});p.stdout.resume();let err='';p.stderr.on('data',c=>err+=c);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(err.slice(-1200)||'Ajudante saiu com código '+code)));});}
module.exports={runPS,runHelper};
