// Pastas com link/junção são recusadas; pastas normais e do OneDrive são aceitas.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os'),assert=require('node:assert/strict');const {noLinks}=require('../update-helper');
if(process.platform!=='win32'){console.log('SKIP: Windows reparse guard');process.exit(0);}
const scratch=path.resolve(__dirname,'../../../work/update-cloud-'+crypto.randomUUID().slice(0,8));fs.mkdirSync(scratch,{recursive:true});
try{
 const target=path.join(scratch,'target'),link=path.join(scratch,'junction');fs.mkdirSync(path.join(target,'inner'),{recursive:true});noLinks(path.join(target,'inner'));
 let physical=true;try{fs.symlinkSync(target,link,'junction');}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;physical=false;console.log('SKIP junction: sem permissão');}
 if(physical){assert.throws(()=>noLinks(link),/link/);assert.throws(()=>noLinks(path.join(link,'inner')),/link/);}
 const cloud=path.join(os.homedir(),'OneDrive','Área de Trabalho');if(fs.existsSync(cloud))noLinks(cloud);
 console.log('PASS: junção recusada (também como pasta acima); pasta normal e OneDrive aceitas'+(fs.existsSync(cloud)?' (OneDrive real conferido)':''));
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
