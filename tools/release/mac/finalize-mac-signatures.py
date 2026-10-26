import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from pathlib import Path
import subprocess,plistlib
signer=str(Path('work/tooling/rcodesign/apple-codesign-0.29.0-x86_64-pc-windows-msvc/rcodesign.exe').resolve())
def run(args,log):
 p=subprocess.run([signer]+args,capture_output=True,text=True);log.write_text(p.stdout+p.stderr,encoding='utf-8')
 if p.returncode:raise RuntimeError((p.stdout+p.stderr)[-1200:])
def sign_binary(bundle,executable,log):
 ident=plistlib.loads((bundle/'Contents/Info.plist').read_bytes())['CFBundleIdentifier']
 run(['sign','--timestamp-url','none','--binary-identifier',ident,'--entitlements-xml-file',str(MAC/'entitlements.plist'),'--info-plist-file',str(bundle/'Contents/Info.plist'),'--code-resources-file',str(bundle/'Contents/_CodeSignature/CodeResources'),str(executable)],log)
for arch in ['arm64','x64']:
 folder=MAC/arch;app=folder/'Resenha.app'
 bundles=list((app/'Contents/Frameworks').glob('Resenha Helper*.app'))+[app]
 for b in bundles:
  p=b/'Contents/Info.plist';info=plistlib.loads(p.read_bytes());info['CFBundleVersion']=V
  if b==app:info['CFBundleShortVersionString']=V
  p.write_bytes(plistlib.dumps(info))
 for b in bundles[:-1]:
  info=plistlib.loads((b/'Contents/Info.plist').read_bytes());sign_binary(b,b/'Contents/MacOS'/info['CFBundleExecutable'],folder/('final-'+b.name+'.log'))
 run(['sign','--shallow','--timestamp-url','none',str(app)],folder/'final-bundle.log')
 sign_binary(app,app/'Contents/MacOS/Resenha',folder/'final-main.log')
 print(arch,'main and all helpers signed with JIT, Info.plist and resource hashes',flush=True)
