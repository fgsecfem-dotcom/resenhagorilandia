import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from pathlib import Path
import json,shutil,posixpath
for arch in ['arm64','x64']:
 folder=MAC/arch;manifest=json.loads((folder/'manifest.json').read_text());links=manifest['links']
 def resolve(name):
  for _ in range(20):
   match=next((k for k in links if name==k or name.startswith(k+'/')),None)
   if not match:return folder/name
   name=posixpath.normpath(posixpath.dirname(match)+'/'+links[match])+name[len(match):]
  raise RuntimeError('Link cycle')
 for name,target in links.items():
  src=resolve(name);dest=folder/name
  if src.is_dir():shutil.copytree(src,dest,dirs_exist_ok=True)
  else:shutil.copy2(src,dest)
 print(arch,'temporary copies ready; ZIP link metadata remains intact',flush=True)
