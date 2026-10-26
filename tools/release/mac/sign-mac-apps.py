import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from pathlib import Path
import json,subprocess,shutil,posixpath
signer=Path('work/tooling/rcodesign/apple-codesign-0.29.0-x86_64-pc-windows-msvc/rcodesign.exe')
for arch in ['arm64','x64']:
 folder=MAC/arch;app=folder/'Resenha.app'
 targets=list((app/'Contents/Frameworks').glob('Resenha Helper*.app'))+list((app/'Contents/Frameworks').glob('*.framework/Versions/A'))
 for target in targets:
  p=subprocess.run([str(signer),'sign','--timestamp-url','none','--entitlements-xml-file','main:'+str(MAC/'entitlements.plist'),str(target)],capture_output=True,text=True)
  log=folder/('sign-'+target.name.replace(' ','_')+'-'+target.parent.parent.name.replace(' ','_')+'.log');log.write_text(p.stdout+p.stderr,encoding='utf-8')
  if p.returncode:raise RuntimeError(str(target)+'\n'+(p.stdout+p.stderr)[-1500:])
  print(arch,'signed',target.name,flush=True)
 links=json.loads((folder/'manifest.json').read_text())['links']
 def resolve(name):
  for _ in range(20):
   match=next((k for k in links if name==k or name.startswith(k+'/')),None)
   if not match:return folder/name
   name=posixpath.normpath(posixpath.dirname(match)+'/'+links[match])+name[len(match):]
  raise RuntimeError('Link cycle')
 for name in links:
  src=resolve(name);dest=folder/name
  if src.is_dir():shutil.copytree(src,dest,dirs_exist_ok=True)
  else:shutil.copy2(src,dest)
 p=subprocess.run([str(signer),'sign','--shallow','--timestamp-url','none','--entitlements-xml-file','main:'+str(MAC/'entitlements.plist'),str(app)],capture_output=True,text=True)
 (folder/'sign-main.log').write_text(p.stdout+p.stderr,encoding='utf-8')
 if p.returncode:raise RuntimeError('Main signing failed '+arch+'\n'+(p.stdout+p.stderr)[-1800:])
 print(arch,'main app signed',flush=True)
