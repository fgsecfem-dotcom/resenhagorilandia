const fs = require('fs'), path = require('path'), crypto = require('crypto');
const forge = require('node-forge');
// O certificado instalado no celular só vale para a rede local (Name Constraints, RFC 5280 4.2.1.10).
// Sem isso, quem tivesse a chave do anfitrião poderia se passar por qualquer site HTTPS naquele celular.
// Não crítica de propósito: celular que entende aplica o limite; um verificador antigo que não entende não recusa a sala.
// (O Node do Electron recusa limite por IP; por isso o teste confere a corrente à mão.)
const LOCAL_V4 = [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['127.0.0.0', 8], ['169.254.0.0', 16]];
const NAME_CONSTRAINTS = '2.5.29.30';
const v4 = (ip) => ip.split('.').map(Number);
const maskOf = (bits) => [0, 1, 2, 3].map((i) => (bits >= (i + 1) * 8 ? 255 : bits <= i * 8 ? 0 : (0xff << (8 - (bits - i * 8))) & 255));
const isLocalV4 = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) && LOCAL_V4.some(([net, bits]) => { const a = v4(ip), n = v4(net), m = maskOf(bits); return a.every((x, i) => (x & m[i]) === n[i]); });
function nameConstraints() {
 const A = forge.asn1, C = A.Class, T = A.Type;
 const subtree = (gn) => A.create(C.UNIVERSAL, T.SEQUENCE, true, [gn]);
 const ips = LOCAL_V4.map(([net, bits]) => subtree(A.create(C.CONTEXT_SPECIFIC, 7, false, String.fromCharCode(...v4(net), ...maskOf(bits)))));
 const dns = subtree(A.create(C.CONTEXT_SPECIFIC, 2, false, 'localhost'));
 return A.toDer(A.create(C.UNIVERSAL, T.SEQUENCE, true, [A.create(C.CONTEXT_SPECIFIC, 0, true, [dns, ...ips])])).getBytes();
}
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
 // Certificado antigo, sem limite de rede: guarda uma cópia e cria um novo (o celular precisa instalar de novo uma vez).
 if(ca&&!ca.extensions.some(e=>e.id===NAME_CONSTRAINTS)){const old=path.join(dir,'antigo-'+Date.now());fs.mkdirSync(old,{recursive:true});fs.renameSync(caFile,path.join(old,'ca.pem'));fs.renameSync(keyFile,path.join(old,'ca-key.pem'));ca=null;key=null;}
 if(!ca){const keys=await keypair();key=keys.privateKey;ca=baseCert(keys,'Resenha local '+crypto.randomBytes(4).toString('hex'),3650);ca.setIssuer(ca.subject.attributes);ca.setExtensions([{name:'basicConstraints',cA:true,pathLenConstraint:0,critical:true},{name:'keyUsage',keyCertSign:true,cRLSign:true,critical:true},{id:NAME_CONSTRAINTS,critical:false,value:nameConstraints()}]);ca.sign(key,forge.md.sha256.create());fs.writeFileSync(keyFile,forge.pki.privateKeyToPem(key),{mode:0o600});fs.writeFileSync(caFile,forge.pki.certificateToPem(ca));}
 const local=[...new Set(['127.0.0.1',...ips])].filter(isLocalV4); // IP fora da rede local deixaria o certificado inválido
 const keys=await keypair(), cert=baseCert(keys,'Resenha na rede local',365);cert.setIssuer(ca.subject.attributes);cert.setExtensions([{name:'basicConstraints',cA:false,critical:true},{name:'keyUsage',digitalSignature:true,keyEncipherment:true,critical:true},{name:'extKeyUsage',serverAuth:true},{name:'subjectAltName',altNames:[{type:2,value:'localhost'},...local.map(ip=>({type:7,ip}))]}]);cert.sign(key,forge.md.sha256.create());
 const publicCA=Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(ca)).getBytes(),'binary');
 return {key:forge.pki.privateKeyToPem(keys.privateKey),cert:forge.pki.certificateToPem(cert),caPem:forge.pki.certificateToPem(ca),publicCA,fingerprint:crypto.createHash('sha256').update(publicCA).digest('hex')};
}
module.exports={mobileTLS,isLocalV4};
