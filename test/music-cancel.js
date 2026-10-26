const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const child=require('node:child_process');const original=child.spawn;let spawned;
child.spawn=()=>{const p=spawned=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.stdout.setEncoding=p.stderr.setEncoding=()=>{};p.kill=()=>{p.killed=true;setImmediate(()=>p.emit('close',1));};return p;};
const {DJTools}=require('../server/dj');child.spawn=original;
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'resenha-cancel-'));const tools=new DJTools({binDir:path.join(root,'bin'),cacheDir:path.join(root,'cache')});
 const abort=new AbortController();const pending=tools.run([],1000,abort.signal);await new Promise(r=>setImmediate(r));abort.abort();await assert.rejects(pending,/cancelado/);assert.equal(spawned.killed,true);
 const aborted=new AbortController();aborted.abort();await assert.rejects(tools.run([],1000,aborted.signal),/cancelado/);
 console.log('PASS: cancelling a download kills its process and skips queued aborted jobs');
})().catch(e=>{console.error(e);process.exitCode=1;});
