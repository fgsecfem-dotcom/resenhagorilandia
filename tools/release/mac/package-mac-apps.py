# Resenha (versão do package.json) for macOS: ZIPs with Unix modes and symlinks preserved, plus a short guide.
import os,sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from pathlib import Path
import zipfile, stat, json, os, hashlib, posixpath

out = OUT
guide = f'''# Resenha {V} para Mac

## Qual baixar
- **mac-apple**: Macs com chip Apple (M1, M2, M3, M4 ou mais novo).
- **mac-intel**: Macs com processador Intel.

Para conferir: menu Apple > Sobre Este Mac. Requer macOS 13 Ventura ou mais novo.

## Instalar ou atualizar
1. Se o Resenha estiver aberto, feche com Cmd+Q.
2. Abra o ZIP no Finder (clique duas vezes). Aparece o Resenha.app.
3. Arraste o Resenha.app para Aplicativos. Se já existir uma versão antiga, escolha substituir.
4. Abra o Resenha. Suas salas, perfil e configurações continuam onde estavam.

## Primeira abertura
O app é gratuito e não tem certificado pago da Apple, então o macOS avisa na primeira vez.
Se aparecer que o app não pode ser aberto, vá em Ajustes do Sistema > Privacidade e Segurança e clique em "Abrir Mesmo Assim" ao lado do aviso do Resenha. Guia oficial da Apple: https://support.apple.com/102445
Não é preciso desligar proteções do sistema nem rodar comandos no Terminal.

## Microfone e tela
- Permita o microfone quando o Mac pedir.
- Para transmitir a tela, ative o Resenha em Ajustes do Sistema > Privacidade e Segurança > Gravação de Tela (e Áudio do Sistema, quando aparecer). Pode ser preciso fechar e abrir o app depois.
- O som do Mac na live funciona no macOS 14.2 Sonoma ou mais novo. Se o Mac não confirmar que separou o som da call, a live segue só com vídeo, para não ecoar a call.

## Atualizações
O Resenha se atualiza sozinho no Mac quando está na pasta Aplicativos: ele baixa a versão nova, confere e troca quando você fecha o app. Versões anteriores à 2.2.2 precisam ser trocadas manualmente uma vez.

## O que vem nesta versão
Veja as novidades na página da release no GitHub.
O Spotify dentro do Resenha, por enquanto, só funciona no Windows.

Preparado no Windows com assinatura ad hoc gratuita, sem notarização da Apple. Não foi aberto num Mac antes da publicação: a primeira abertura, a captura de tela e o som precisam ser confirmados por quem usar.
'''
lines = []
for arch, label in [('arm64', 'apple'), ('x64', 'intel')]:
    folder = MAC / arch; app = folder / 'Resenha.app'
    manifest = json.loads((folder / 'manifest.json').read_text()); links = manifest['links']; modes = manifest['modes']
    archive = out / f'Resenha-{V}-mac-{label}.zip'
    assert not archive.exists(), archive
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=5) as z:
        for base, dirs, files in os.walk(app):
            base = Path(base); relbase = base.relative_to(folder).as_posix()
            dirs[:] = [d for d in dirs if relbase + '/' + d not in links]
            for name in files:
                f = base / name; rel = f.relative_to(folder).as_posix()
                if rel in links: continue
                info = zipfile.ZipInfo(rel); info.create_system = 3; info.external_attr = modes.get(rel, stat.S_IFREG | 0o644) << 16; info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, f.read_bytes())
        for name, target in links.items():
            info = zipfile.ZipInfo(name); info.create_system = 3; info.external_attr = (stat.S_IFLNK | 0o777) << 16; info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, target.encode())
        z.writestr('LEIA-ME.md', guide)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None; names = set(z.namelist())
        for name, target in links.items():
            i = z.getinfo(name); assert stat.S_ISLNK(i.external_attr >> 16); assert z.read(i).decode() == target
            resolved = posixpath.normpath(posixpath.dirname(name) + '/' + target)
            for _ in range(20):
                alias = next((k for k in links if resolved == k or resolved.startswith(k + '/')), None)
                if not alias: break
                resolved = posixpath.normpath(posixpath.dirname(alias) + '/' + links[alias]) + resolved[len(alias):]
            assert resolved in names or any(n.startswith(resolved + '/') for n in names), name
            assert not any(n.startswith(name + '/') for n in names), name + ' duplicated alias contents'
        assert z.getinfo('Resenha.app/Contents/MacOS/Resenha').external_attr >> 16 & 0o111
        for i in z.infolist():
            if '/Contents/MacOS/Resenha Helper' in i.filename: assert i.external_attr >> 16 & 0o111
        pkg = json.loads(z.read('Resenha.app/Contents/Resources/app/package.json')); assert pkg['version'] == V
        assert not any(n.startswith('Resenha.app/Contents/Resources/app/test/') for n in names)
    lines.append(hashlib.sha256(archive.read_bytes()).hexdigest() + '  ' + archive.name)
    print(label, "ZIP ok:", len(links), f"symlinks, exec modes, version {V}; bytes", archive.stat().st_size, flush=True)
(out / 'LEIA-ME-mac.md').write_text(guide, encoding='utf-8')
(out / 'SHA256SUMS-mac.txt').write_text('\n'.join(lines) + '\n', encoding='ascii')
print('\n'.join(lines))
