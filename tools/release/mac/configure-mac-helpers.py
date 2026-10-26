import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from pathlib import Path
import json,plistlib,shutil,zipfile
root=MAC
for arch in ['arm64','x64']:
 folder=root/arch;app=folder/'Resenha.app';manifest=json.loads((folder/'manifest.json').read_text());renames={}
 for helper in (app/'Contents/Frameworks').glob('Electron Helper*.app'):
  old=helper.name;new=old.replace('Electron','Resenha',1);p=helper/'Contents/Info.plist';j=plistlib.loads(p.read_bytes());exe=j.get('CFBundleExecutable',j['CFBundleName']);newexe=exe.replace('Electron','Resenha',1)
  (helper/'Contents/MacOS'/exe).rename(helper/'Contents/MacOS'/newexe)
  suffix=new[new.index('(')+1:new.index(')')] if '(' in new else ''
  j.update(CFBundleDisplayName=new[:-4],CFBundleName=new[:-4],CFBundleExecutable=newexe,CFBundleIdentifier='com.lucas.resenha.helper'+('.'+suffix if suffix else ''),CFBundleVersion=V)
  p.write_bytes(plistlib.dumps(j));helper.rename(helper.with_name(new))
  renames['Resenha.app/Contents/Frameworks/'+old+'/']='Resenha.app/Contents/Frameworks/'+new+'/'
  renames['/Contents/MacOS/'+exe]='/Contents/MacOS/'+newexe
 modes={}
 for name,mode in manifest['modes'].items():
  for a,b in renames.items():name=name.replace(a,b)
  modes[name]=mode
 manifest['modes']=modes;(folder/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
 with zipfile.ZipFile(Path('work/mac-runtimes')/f'electron-v44.4.5-darwin-{arch}.zip') as z:
  for name in ['LICENSE','LICENSES.chromium.html']:
   if name in z.namelist():(app/'Contents/Resources'/name).write_bytes(z.read(name))
shutil.copy2('work/resenhaapp/node_modules/app-builder-lib/templates/entitlements.mac.plist',str(MAC/'entitlements.plist'))
print('Mac helper names, identifiers and versions configured')
