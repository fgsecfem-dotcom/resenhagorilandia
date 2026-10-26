# Resenha para Windows x64: ZIP com prefixo Resenha/ e SHA256SUMS.txt.
# Precisa do win-unpacked já assinado pelo EVS (Resenha.exe.sig), senão o Spotify não toca.
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import zipfile, hashlib, json

src = WIN / 'win-unpacked'
OUT.mkdir(parents=True, exist_ok=True)
z = OUT / f'Resenha-{V}-Windows-x64.zip'
assert not z.exists(), z
assert json.loads((src / 'resources/app/package.json').read_text(encoding='utf-8'))['version'] == V
assert (src / 'Resenha.exe.sig').exists(), 'Falta a assinatura EVS (Resenha.exe.sig)'
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for p in sorted(src.rglob('*')):
        if p.is_file():
            zf.write(p, 'Resenha/' + p.relative_to(src).as_posix())
with zipfile.ZipFile(z) as zf:
    n = zf.namelist()
    assert 'Resenha/Resenha.exe' in n and 'Resenha/Resenha.exe.sig' in n
    assert not any(x.startswith('Resenha/resources/app/test/') for x in n)
h = hashlib.sha256(z.read_bytes()).hexdigest()
(OUT / 'SHA256SUMS.txt').write_text(f'{h}  {z.name}\n', encoding='utf-8')
print(z.name, z.stat().st_size, 'bytes', h)
