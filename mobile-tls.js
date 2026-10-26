const fs = require('fs'), path = require('path'), crypto = require('crypto');
const forge = require('node-forge');
async function keypair() {
 const keys = await new Promise((resolve,reject)=>crypto.generateKeyPair('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}},(e,publicKey,privateKey)=>e?reject(e):resolve({publicKey,privateKey})));
 return {publicKey:forge.pki.publicKeyFromPem(keys.publicKey),privateKey:forge.pki.privateKeyFromPem(keys.privateKey)};
}
function baseCert(keys, name, days) {
 const c=forge.pki.createCertificate();c.publicKey=keys.publicKey;c.serialNumber='01'+crypto.randomBytes(15).toString('hex');c.validity.notBefore=new Date(Date.now()-86400000);c.validity.notAfter=new Date(Date.now()+days*86400000);c.setSubject([{name:'commonName',value:name}]);return c;
}
async function mobileTLS(dir, ips) {
 fs.mkdirSync(dir,{recursive:true});const caFile=path.join(dir,'ca.pem'), keyFile=path.join(dir,'ca-key.pem');let ca,key;
 if(fs.existsSync(caFile)&&fs.existsSync(keyFile)){ca=forge.pki.certificateFromPem(fs.readFileSync(caFile,'utf8'));key=forge.pki.privateKeyFromPem(fs.readFileSync(keyFile,'utf8'));}
 else {const keys=await keypair();key=keys.privateKey;ca=baseCert(keys,'Resenha local '+crypto.randomBytes(4).toString('hex'),3650);ca.setIssuer(ca.subject.attributes);ca.setExtensions([{name:'basicConstraints',cA:true,pathLenConstraint:0,critical:true},{name:'keyUsage',keyCertSign:true,cRLSign:true,critical:true}]);ca.sign(key,forge.md.sha256.create());fs.writeFileSync(keyFile,forge.pki.privateKeyToPem(key),{mode:0o600});fs.writeFileSync(caFile,forge.pki.certificateToPem(ca));}
 const keys=await keypair(), cert=baseCert(keys,'Resenha na rede local',365);cert.setIssuer(ca.subject.attributes);cert.setExtensions([{name:'basicConstraints',cA:false,critical:true},{name:'keyUsage',digitalSignature:true,keyEncipherment:true,critical:true},{name:'extKeyUsage',serverAuth:true},{name:'subjectAltName',altNames:[{type:2,value:'localhost'},...new Set(['127.0.0.1',...ips])].map(x=>typeof x==='string'?{type:7,ip:x}:x)}]);cert.sign(key,forge.md.sha256.create());
 const publicCA=Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(ca)).getBytes(),'binary');
 return {key:forge.pki.privateKeyToPem(keys.privateKey),cert:forge.pki.certificateToPem(cert),publicCA,fingerprint:crypto.createHash('sha256').update(publicCA).digest('hex')};
}
module.exports={mobileTLS};
