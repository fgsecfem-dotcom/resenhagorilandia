# Resenha

Versão **2.1.2**. Veja [o que mudou](CHANGES-2.1.2.md). Execute `npm test` antes de empacotar.

Um app estilo Discord pra você e seus amigos: call de voz, compartilhamento de tela e chat com anexos. Não tem servidor central: quem abre a sala vira o servidor, igual no Radmin, só que sem o Radmin.

## Como usar

1. Baixe o `Resenha-<versão>-Windows-x64.zip` da página de releases, extraia a pasta inteira e abra `Resenha.exe`. Não precisa instalar.
2. **Quem hospeda:** coloque nome e foto, clique em **Abrir sala**. Aparece o **código da sala** (tipo `K7P4-QX9M`). Mande pra galera.
3. **Quem entra:** cole o código em **Entrar numa sala**. Não precisa abrir porta, nem Radmin, nem IP.

4. Clique num canal de voz pra entrar na call.

O código é sempre o mesmo pra uma sala com o mesmo nome.

Na primeira vez o Windows pergunta sobre o Firewall: clique em **Permitir**.

## Funções

| Função | Onde |
|---|---|
| Mutar microfone | Botão do microfone. **Clique direito** escolhe o microfone e o volume dele |
| Mutar som e microfone | Botão do fone. **Clique direito** escolhe o fone/caixa |
| Atalhos globais (dentro do jogo) | Configurações > Atalhos (desligados até você escolher) |
| Volume de cada amigo (0 a 200%) | Clique direito no nome ou no quadrado da pessoa |
| Compartilhar tela | Botão da tela. Vai o som do PC, mas **sem** a voz dos amigos, o DJ e os sons do Resenha |
| Ver a tela de alguém | Clique em **Entrar na transmissão**. Você pode ampliar ou sair quando quiser; o áudio da call continua |
| Sua própria prévia | Começa pausada. **Mostrar prévia** / **Ocultar prévia** controla apenas sua visualização. Minimizar pausa a prévia, mantendo o envio aos amigos |
| Jogos | Novo perfil **720p60** com limite de 3,5 Mbps por espectador |
| Privado e favoritos | Clique no amigo ou na lista **Amigos e conversas**. Privado de texto disponível na mesma sala; histórico local e sem entrega offline |
| Assistir no celular | O anfitrião copia o link **Assistir no celular** em Convidar. Comece no mesmo Wi-Fi, sem precisar de microfone |
| Supressão de ruído com IA | Ligada por padrão. Tira barulho de fundo e deixa mudo quando você não está falando |
| Filtros de voz | Configurações > Filtros de voz: grave, monstro, agudo, esquilo, robô, demônio ou tom personalizado (-12 a +12). Dá pra se ouvir no botão de teste |
| Mensagens | Passe o mouse (ou clique direito) na mensagem: responder, mencionar, editar, excluir. Seta pra cima edita a última |
| Marcar alguém | Digite `@` e escolha. `@todos` avisa todo mundo. Menções a você ficam destacadas e tocam um som |
| Canais | `+` ao lado de "Canais de texto/voz" cria. Engrenagem ao passar o mouse (ou clique direito) edita ou exclui |
| DJ Resenha | Botão **Chamar DJ** no canto da call. Cole link do YouTube, Spotify (música, álbum, playlist) ou o nome da música |
| DJ: pular / remover | Clique no DJ: controle direto por qualquer participante da call do DJ. Músicas que falharem aparecem com **Tentar novamente** |
| Segundo plano | O X esconde o Resenha na bandeja (perto do relógio). Pra sair: clique direito no ícone > Sair |
| Atualizações | No Windows, a janela da Pipoca confere o GitHub ao abrir, baixa, confere o SHA-256 e instala sozinha. Se a instalação automática não funcionar neste PC, o app abre a versão atual e oferece **Baixar pelo site** |
| Anexos | Botão `+`, arrastar arquivo ou `Ctrl+V`. Imagem e vídeo aparecem no chat (até 2 GB) |

## Como o código funciona (igual Radmin)

O app usa servidores públicos só pra os dois PCs se acharem (mensagens criptografadas com o código). Depois disso liga os PCs direto, furando o NAT, e passa tudo (chat, anexos, voz e tela) por essa ligação direta. Nenhum dado da conversa fica em servidor de ninguém.

Se aparecer "Achei a sala, mas não consegui ligar os dois PCs", a rede de um dos dois bloqueia conexão direta (comum em 4G, faculdade, empresa). Troque quem abre a sala ou use o jeito por IP abaixo.

## Rede por IP (plano B)

Só a porta da sala (padrão **7777**) precisa estar aberta no PC de quem hospeda, **TCP e UDP**.

- **O app tenta abrir sozinho** via UPnP. Se o roteador aceitar, não precisa fazer nada.
- **Se não abrir:** entre no roteador (geralmente `192.168.1.1` ou `192.168.0.1`), procure "Redirecionamento de portas / Port forwarding / NAT / Servidor virtual" e redirecione **TCP e UDP 7777** pro IP local do PC (a janela Convidar mostra qual é).
- **CGNAT:** algumas operadoras dividem o mesmo IP entre vários clientes. O app avisa quando detecta isso. Aí:
  - tente o endereço **IPv6** que aparece no convite (muita fibra tem), ou
  - peça à operadora "IP público" / "sair do CGNAT" (várias fazem de graça), ou
  - deixe outro amigo, que não tem CGNAT, abrir a sala.
- **Mesma casa:** use o endereço "Mesma rede".
- Ainda tem Radmin/ZeroTier? O endereço dele aparece também e funciona.

A voz e a tela tentam ir direto entre os amigos. Quando não dá, passam pelo PC de quem hospeda (relay embutido). Por isso, quem tiver a melhor internet deve abrir a sala.

## Onde ficam as coisas

- Histórico do chat e anexos: `%APPDATA%\Resenha\salas\<nome da sala>\` no PC de quem hospeda.
- Quando o anfitrião fecha o app, a sala fecha. Ao reabrir com o mesmo nome, o histórico volta.

## DJ Resenha

- Roda no PC de quem abriu a sala. Na primeira vez ele baixa o yt-dlp sozinho (uns 18 MB).
- Spotify não deixa tocar a música direto: o DJ lê o nome da faixa e toca a mesma música do YouTube.
- Todo mundo na call ouve sincronizado. Sai sozinho se a call ficar vazia por 2 minutos.

## Publicar versão nova (atualização automática)

As releases ficam em `fgsecfem-dotcom/resenhagorilandia` (definido em `update-source.json`). O atualizador exige exatamente dois arquivos por release:

- `Resenha-<versão>-Windows-x64.zip` com a pasta `Resenha/` (gerada com `electron-builder --win dir`, `asar: false`);
- `SHA256SUMS.txt` com o hash desse ZIP.

Crie a release como **rascunho**, envie os dois arquivos e só então publique; assim ninguém vê uma versão sem hash. Tags com sufixo (`-preview.N`) e releases marcadas como pre-release só chegam a quem escolheu o canal de previews. O workflow do GitHub Actions não gera esse pacote e não publica releases.

## Para desenvolver

```
npm install
npm start                 # abre o app
npx electron-builder --win dir   # gera dist/win-unpacked (base do ZIP distribuído)
node test/smoke.js        # testa o servidor
node test/server2.js      # canais, mensagens e DJ (baixa música de verdade)
node test/e2e2.js         # abre 2 instâncias e testa tudo (voz, chat, tela, DJ)
```

Testar 2 instâncias no mesmo PC: `Resenha.exe --profile=teste`.

Estrutura: `main.js` (janela, sala, relay TURN, UPnP), `server/index.js` (chat, anexos, sinalização), `app/` (interface), `net-tools.js` (IPs, UPnP, CGNAT).
