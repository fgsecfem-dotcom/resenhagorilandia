# Resenha: guia para quem programa (inclusive o Claude)

App de call, tela e chat estilo Discord, sem servidor central: quem abre a sala vira o servidor. Feito em Electron, com cliente web e PWA. Escreva em pt-BR simples, nos textos e nos commits.

**Antes de mexer em qualquer coisa visual, leia [docs/DESIGN.md](docs/DESIGN.md)**: como o app é e o que o Felipe aprova ou rejeita.

## Como trabalhamos (roadmap + milestones)
- O plano fica no [ROADMAP.md](ROADMAP.md). As tarefas são issues no GitHub, agrupadas por milestone e marcadas com o módulo.
- **Uma issue = uma sessão = uma branch = um PR.** Branch `tipo/assunto` (ex.: `fix/credencial-por-sala`). O PR cita a issue (`Closes #N`).
- Comece lendo a issue e só os arquivos do módulo dela, pelo mapa abaixo. O `app/client.js` tem mais de 3 mil linhas: procure a função com grep em vez de ler o arquivo inteiro.
- Mude só o que a issue pede. Ideias novas viram issues novas, sem milestone.
- Antes do PR: `npm test` (ou `sh tools/test.sh`) com tudo passando, e um teste novo quando corrigir um bug.
- Ao fechar o PR, use `/clear` e comece a próxima issue numa sessão limpa.

## Mapa de módulos (label da issue → arquivos)
| Label | Arquivos | O que faz |
|---|---|---|
| `cliente` | `app/client.js`, `app/room-ui.js`, `app/command-controller.js`, `app/client-identity.js`, `app/dm-storage.js` | interface, voz/tela WebRTC, chat, conexão com a sala |
| `visual` | `app/themes.js`, `app/*.css`, `app/motion.js`, `app/icons.js`, `app/pipoca.js` | temas, animações e ícones |
| `musica` | `app/music.js`, `spotify.js`, `server/dj.js` | player do Spotify (só Windows) e DJ |
| `servidor` | `server/index.js`, `server/text-commands.js`, `server/file-http.js`, `room-state.js`, `server/profile-extras.js` | servidor da sala: WebSocket, canais, anexos, snapshot |
| `descoberta` | `tunnel-main.js`, `app/tunnel.js`, `signal-worker/` | achar a sala pelo código (Worker Cloudflare e MQTT) e túnel P2P |
| `desktop` | `main.js`, `preload.js`, `net-tools.js`, `capture-policy.js`, `app/launcher.js` | janela, bandeja, UPnP/CGNAT, captura de tela |
| `atualizador` | `updater.js`, `update-manager.js`, `update-helper.js`, `update-mac.js`, `server/startup-launcher.js` | atualização automática no Windows e no Mac |
| `pwa` | `pwa/`, `app/mobile.js` | versão para navegador e celular |
| `release` | `tools/release/`, [docs/RELEASE.md](docs/RELEASE.md), `docs/changes/` | build, assinatura e publicação |

Os testes ficam em `test/`. A lista oficial é a do script `test` do `package.json`.

## Regras fixas
- Para testar o app, use um perfil separado (`Resenha.exe --profile=teste`) e apague o perfil no final. Nunca use o `%APPDATA%\Resenha` real.
- Nunca imprima nem salve tokens do Spotify, a `identitySecret` ou senhas de sala em logs e mensagens.
- O build do Windows usa o Electron castLabs ECS e a assinatura EVS, sem os quais o Spotify não toca. Os detalhes estão em `docs/RELEASE.md`.
- Publicar release, PWA ou Worker só com o ok do Felipe.
- O repositório é público: nada de dados pessoais, caminhos da máquina ou segredos nos commits.
- Os nomes `resenha.exe.sig` e os outros da lista `roots` em `update-manager.js` precisam bater com o pacote. Se mudar o pacote, atualize essa lista.

## Armadilhas (o código não deixa óbvio)
- Temas: a escolha usa `VISIBLE_THEMES` (12). `THEMES` inclui os antigos e `RETIRED_THEMES` converte nome antigo em novo. Nunca conte nem teste temas por `THEMES`.
- Testes: só os do script `test` do `package.json` são oficiais. Há dezenas de outros arquivos em `test/` fora da lista (antigos ou manuais): não rode todos e não trate falha neles como regressão.
- Sem Node na máquina: rode `sh tools/test.sh`. Ele usa o Electron como Node (`ELECTRON_RUN_AS_NODE`; escolha qual com `RESENHA_NODE`). Apague essa variável antes de abrir o app.
- O Electron do npm não tem Widevine: sem o runtime ECS (ver `docs/RELEASE.md`), o Spotify aparece como indisponível. Isso não é bug.
- `--profile=X` liga o `TEST_MODE`: várias instâncias, sem bandeja, fechar sai de verdade, atualização desligada (religue com `RESENHA_TEST_UPDATE=1`).
- O perfil de teste cria duas pastas: `Resenha-X` no AppData e `.resenha-X` na pasta do usuário. Apague as duas no fim.
- `RESENHA_LAUNCHER=1` mostra o launcher sem empacotar (só Windows). `RESENHA_UPDATE_COPY` é só para testes do atualizador.
- `RESENHA_PWA` é um objeto global do navegador, não variável de ambiente.
- `localStorage` usa o prefixo `resenha.`. A `identitySecret` fica ali: nunca imprima.
- No `userData`, `spotify.json` (login criptografado) e `minhas-salas/` (com verificador de senha) têm dados sensíveis. Não leia nem copie do perfil real.
- `dist/` tem uma cópia antiga do código: exclua `dist/` e `node_modules/` das buscas.
- Arquivo novo na pasta do app precisa entrar na lista `roots` do `update-manager.js` (também aceita `RELATORIO-*.md` e `ROTEIRO-*.md`); qualquer outro bloqueia a atualização automática.
- `mobile-setup.css` é servido pelo servidor (rota `/mobile-setup`): não é código morto.
