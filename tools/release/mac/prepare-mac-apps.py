import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
import zipfile,stat,json,plistlib,shutil,posixpath
from pathlib import Path
r=Path('work/resenhaapp'); root=MAC;root.mkdir(parents=True,exist_ok=True)
for arch in ['arm64','x64']:
 folder=root/arch;folder.mkdir(exist_ok=True);manifest={};links={}
 with zipfile.ZipFile(Path('work/mac-runtimes')/f'electron-v44.4.5-darwin-{arch}.zip') as z:
  for i in z.infolist():
   if not i.filename.startswith('Electron.app/'):continue
   name=i.filename.replace('Electron.app/','Resenha.app/',1)
   if name.endswith('/MacOS/Electron'):name=name[:-len('Electron')]+'Resenha'
   mode=i.external_attr>>16;manifest[name]=mode
   if stat.S_ISLNK(mode):links[name]=z.read(i).decode();continue
   p=folder/name
   if i.is_dir():p.mkdir(parents=True,exist_ok=True)
   else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(i))
 app=folder/'Resenha.app';p=app/'Contents/Info.plist';j=plistlib.loads(p.read_bytes());j.update(CFBundleDisplayName='Resenha',CFBundleExecutable='Resenha',CFBundleName='Resenha',CFBundleIdentifier='com.lucas.resenha',CFBundleIconFile='resenha.icns',CFBundleShortVersionString=V,CFBundleVersion=V,LSMinimumSystemVersion='13.0',LSApplicationCategoryType='public.app-category.social-networking');j.update(json.loads((r/'package.json').read_text(encoding='utf-8'))['build']['mac']['extendInfo']);p.write_bytes(plistlib.dumps(j))
 shutil.copy2(r/'app/icon.icns',app/'Contents/Resources/resenha.icns')
 production=WIN/'win-unpacked/resources/app';dest=app/'Contents/Resources/app';shutil.copytree(production,dest,dirs_exist_ok=True)
 for f in ['main.js','preload.js','net-tools.js','tunnel-main.js','updater.js','capture-policy.js']:shutil.copy2(r/f,dest/f)
 shutil.copytree(r/'app',dest/'app',dirs_exist_ok=True);shutil.copytree(r/'server',dest/'server',dirs_exist_ok=True)
 pkg=json.loads((production/'package.json').read_text(encoding='utf-8'));pkg['version']=V;(dest/'package.json').write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (folder/'manifest.json').write_text(json.dumps({'modes':manifest,'links':links}),encoding='utf-8')
 print(arch,'extracted;',len(links),'symlinks retained in archive manifest',flush=True)
