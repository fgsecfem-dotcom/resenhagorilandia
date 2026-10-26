import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from pathlib import Path
import struct,hashlib,plistlib,json

def signature(path):
 data=path.read_bytes();assert data[:4]==b'\xcf\xfa\xed\xfe',str(path)
 cpu=struct.unpack_from('<I',data,4)[0];off=32;sig=None
 for _ in range(struct.unpack_from('<I',data,16)[0]):
  cmd,size=struct.unpack_from('<II',data,off)
  if cmd==29:
   start,length=struct.unpack_from('<II',data,off+8);sig=data[start:start+length]
  off+=size
 assert sig is not None,str(path)
 count=struct.unpack_from('>I',sig,8)[0];blobs={}
 for i in range(count):
  kind,offset=struct.unpack_from('>II',sig,12+8*i);length=struct.unpack_from('>I',sig,offset+4)[0];blobs[kind]=sig[offset:offset+length]
 cd=blobs[0];fields=struct.unpack_from('>9I',cd);_,_,_,flags,hashOffset,identOffset,special,ncodes,limit=fields;hsize,htype,_,pageexp=struct.unpack_from('>4B',cd,36)
 assert flags&2,'Expected ad-hoc signature';algorithm={1:hashlib.sha1,2:hashlib.sha256,3:hashlib.sha256}[htype]
 for index in range(ncodes):
  page=data[index*(1<<pageexp):min(limit,(index+1)*(1<<pageexp))];actual=algorithm(page).digest()[:hsize];assert actual==cd[hashOffset+index*hsize:hashOffset+(index+1)*hsize],str(path)+' code page '+str(index)
 return {'cpu':cpu,'cdhash':algorithm(cd).digest()[:20],'blobs':blobs,'cd':cd,'hashOffset':hashOffset,'hsize':hsize,'algorithm':algorithm}

def special(result,index,data,path):
 actual=result['algorithm'](data).digest()[:result['hsize']];off=result['hashOffset']-index*result['hsize'];assert actual==result['cd'][off:off+result['hsize']],str(path)+' special slot '+str(index)

for arch in ['arm64','x64']:
 folder=MAC/arch;app=folder/'Resenha.app';expected=0x100000c if arch=='arm64' else 0x1000007;checked=0
 bundles=[(app/'Contents',app/'Contents/Info.plist',app/'Contents/MacOS/Resenha')]
 for helper in (app/'Contents/Frameworks').glob('Resenha Helper*.app'):
  info=helper/'Contents/Info.plist';j=plistlib.loads(info.read_bytes());bundles.append((helper/'Contents',info,helper/'Contents/MacOS'/j['CFBundleExecutable']))
 for framework in (app/'Contents/Frameworks').glob('*.framework'):
  base=framework/'Versions/A';info=base/'Resources/Info.plist';j=plistlib.loads(info.read_bytes());bundles.append((base,info,base/j['CFBundleExecutable']))
 for base,info,exe in bundles:
  result=signature(exe);assert result['cpu']==expected;checked+=1
  special(result,1,info.read_bytes(),exe);res=base/'_CodeSignature/CodeResources';special(result,3,res.read_bytes(),exe)
  if '.app' in base.parent.name:
   assert 5 in result['blobs'],str(exe)+' missing JIT entitlements';ent=plistlib.loads(result['blobs'][5][8:]);assert ent['com.apple.security.cs.allow-jit'];special(result,5,result['blobs'][5],exe)
  refs=plistlib.loads(res.read_bytes()).get('files2',{})
  for name,value in refs.items():
   if 'hash2' in value:assert hashlib.sha256((base/name).read_bytes()).digest()==value['hash2'],str(base/name)
   if 'cdhash' in value:
    p=base/name
    if p.is_dir():
     if p.suffix=='.app':j=plistlib.loads((p/'Contents/Info.plist').read_bytes());p=p/'Contents/MacOS'/j['CFBundleExecutable']
     elif p.suffix=='.framework':j=plistlib.loads((p/'Versions/A/Resources/Info.plist').read_bytes());p=p/'Versions/A'/j['CFBundleExecutable']
    nested=signature(p);assert nested['cdhash']==value['cdhash'],str(p)+' nested cdhash';checked+=1
 main=plistlib.loads((app/'Contents/Info.plist').read_bytes());assert main['LSMinimumSystemVersion']=='13.0';assert main['CFBundleIdentifier']=='com.lucas.resenha'
 r=Path('work/resenhaapp');dest=app/'Contents/Resources/app'
 for f in ['main.js','preload.js','capture-policy.js','updater.js']:
  assert (r/f).read_bytes()==(dest/f).read_bytes()
 for tree in ['app','server']:
  for f in (r/tree).rglob('*'):
   if f.is_file():assert f.read_bytes()==(dest/f.relative_to(r)).read_bytes(),str(f)
 assert json.loads((dest/'package.json').read_text())['version']==V
 print(arch,'PASS:',checked,'Mach-O checks; code pages, JIT, plist/resource digests, nested signatures and current app source',flush=True)
