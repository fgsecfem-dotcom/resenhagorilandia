# Resenha (versão do package.json) for Linux x64: tar.gz with executable bits, plus a short guide and SHA256SUMS-linux.txt.
import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
import tarfile, hashlib, io, json, time
from pathlib import Path

src = LNX/'linux-unpacked'
out = OUT
archive = out / f'Resenha-{V}-linux-x64.tar.gz'
assert not archive.exists(), archive
assert json.loads((src / 'resources/app/package.json').read_text(encoding='utf-8'))['version'] == V
EXEC = {'resenha', 'chrome-sandbox', 'chrome_crashpad_handler'}
guide = f'''# Resenha {V} para Linux (x64)

1. Extraia: tar -xzf Resenha-{V}-linux-x64.tar.gz
2. Abra: ./Resenha/resenha

Se aparecer um erro sobre "SUID sandbox" (comum no Ubuntu 23.10 ou mais novo), rode uma vez:
  sudo chown root:root Resenha/chrome-sandbox && sudo chmod 4755 Resenha/chrome-sandbox
Sem sudo, dá para abrir com ./Resenha/resenha --no-sandbox (menos protegido).

Salas, perfil e configurações ficam em ~/.config/Resenha. No Linux a atualização é manual: baixe a versão nova e substitua a pasta.
O Spotify dentro do Resenha, por enquanto, só funciona no Windows.
Montado no Windows a partir do Electron oficial para Linux e ainda não aberto num Linux de verdade.
'''

def add(tar, path, name):
    info = tar.gettarinfo(str(path), name)
    info.uid = info.gid = 0; info.uname = info.gname = 'root'
    if path.is_dir(): info.mode = 0o755
    else: info.mode = 0o755 if (path.name in EXEC or path.suffix == '.so' or '.so.' in path.name) else 0o644
    if path.is_dir(): tar.addfile(info)
    else:
        with open(path, 'rb') as f: tar.addfile(info, f)

with tarfile.open(archive, 'w:gz', compresslevel=6) as tar:
    for p in sorted(src.rglob('*')):
        add(tar, p, 'Resenha/' + p.relative_to(src).as_posix())
    data = guide.encode('utf-8'); info = tarfile.TarInfo('Resenha/LEIA-ME.md'); info.size = len(data); info.mode = 0o644; info.mtime = int(time.time())
    tar.addfile(info, io.BytesIO(data))

with tarfile.open(archive) as tar:
    m = {i.name: i for i in tar.getmembers()}
    assert m['Resenha/resenha'].mode & 0o111 and m['Resenha/chrome-sandbox'].mode & 0o111
    assert 'Resenha/resources/app/server/profile-extras.js' in m and not any(n.startswith('Resenha/resources/app/test/') for n in m)
(out / 'LEIA-ME-linux.md').write_text(guide, encoding='utf-8')
h = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / 'SHA256SUMS-linux.txt').write_text(f'{h}  {archive.name}\n', encoding='ascii')
print('ok', len(m), 'entries', archive.stat().st_size, 'bytes', h)
