# Caminhos e versão usados pelos scripts de release.
# A versão vem do package.json; as pastas de build ficam em work/ (fora do repositório).
# O espaço de trabalho é a pasta que contém work/; pode ser trocado com RESENHA_WS.
import json, os
from pathlib import Path

WS = Path(os.environ.get('RESENHA_WS') or Path(__file__).resolve().parents[4])
os.chdir(WS)
V = json.loads(Path('work/resenhaapp/package.json').read_text(encoding='utf-8'))['version']
N = V.replace('.', '')
WIN = Path(f'work/build-release{N}')
LNX = Path(f'work/build-linux{N}')
MAC = Path(f'work/mac-build-{N}')
OUT = Path(f'outputs/releases-{V}')
