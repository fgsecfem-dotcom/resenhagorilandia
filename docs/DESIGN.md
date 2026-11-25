# Design do Resenha: como o app é e o que o Felipe aprova

Leia antes de mexer em qualquer coisa visual (label `visual`, CSS, temas, animações e ícones).

## O que é o Resenha
É um app para usar com amigos, sem custo, com cara de produto profissional. É um "Discord sem servidor": call de voz, transmissão de tela (muito usada em jogos como LoL), chat, DJ, Spotify e salas por código.
- **Sala:** a call fica em primeiro plano, o chat é uma gaveta à direita e os controles ficam num dock central e unificado.
- **Barra lateral:** salas favoritas numa fileira de bolinhas no topo, com "+" e casa. Nada de coluna larga como a do Discord.
- **Tela inicial:** saudação e "Minhas salas" como fileira de cards.
- **Sala personalizada:** capa, ícone, nome, descrição e cor, definidos pelo anfitrião.
- **Perfis:** status, recado, cor e efeito do nome, banner em foto ou GIF.
- **Ícone:** a "Pipoquinha" (floco de pipoca com carinha), na variação "Quentinha" laranja. As outras variações ficam em Configurações > Aparência.
- **Fonte:** Figtree, local.

## Direção visual
- **Elegância e sutileza.** O Felipe rejeita o que chama de "amador" ou "goofy": brilho que segue o mouse, pílula que persegue o cursor, neon, pulsar, degradê saturado e efeitos fortes.
- **Referência de movimento: Apple TV / tvOS.**
  - Molas curtas e troca de layout fluida (FLIP em `app/motion.js`).
  - Conteúdo que entra em etapas.
  - Hover discreto: escurecer de leve em cerca de 0,2 s mais um contorno fino, sem zoom nem inclinação.
- **Padrão de movimento (2.6, `app/motion.js`):** uma curva só (`--ease-out`, ease-out forte) e durações curtas (`--dur-*`):
  - Clique 120 ms (afunda para 97%), menus 150 ms, saídas 200 ms, janelas 250 ms, layout e gaveta ~350 ms.
  - Anime só o que explica algo (de onde veio, para onde foi). O que se usa o dia todo (menus, chat, entrar na sala) é rápido e sem sequência longa.
  - Nada cresce do zero (mínimo 94–96%), nada quica, nada de `ease-in`. Sair é mais rápido do que entrar.
  - Os temas não mudam o tempo das animações. As referências vêm da biblioteca de movimento do Screenrove.
- **Fluidez:** no mínimo 60 fps. Blur só onde é barato (dock e rótulos) e desligado durante a live.
- **Respeitar "Reduzir animações"** (`settings.reduceMotion` e `html.reduce-motion`).
- **Material:** vidro fumê no estilo visionOS ("Líquido"). A identidade padrão é grafite neutro mais vidro esfumaçado, com laranja **só** em pequenos detalhes.
- **Líquido 2.6 (padrão escuro, `themes-pro.css`):** vidro **claro** do visionOS sobre o "fundo vivo". Regras do HIG (Materials, Ornaments, Windows):
  - Vidro escuro separa seções (barra lateral, chat). Vidro claro só no que é interativo ou selecionado, nunca claro sobre claro.
  - Janelas soltas com raio de 24–28 px, filete de luz no topo e sombra. Texto branco em três níveis (100%, 62%, 42%).
  - Barra da call como ornamento: cápsula de vidro, botões redondos sem borda, encerrar em vermelho. É o único blur ao vivo.
  - Ação principal em branco (Convidar, enviar).
- **Fundo vivo (`app/ambient.js`):** a luz de fundo vem da call: tela transmitida > câmera de quem fala > capa da música > grafite com luz de cima. Canvas de 16x9 lido 2 vezes por segundo, sem blur ao vivo.
- **O Felipe rejeitou:** paletas copiadas de referência sem contexto, "assinaturas" inventadas (grão, brilho de horizonte, etiquetas), visual chapado de app corporativo (Whereby: botões quadrados com rótulo, cor sólida no fundo) e fotos de paisagem como fundo.

## Temas
- **Poucos e caprichados.** Cada tema muda material, movimento, arranjo e detalhes (`app/themes.js` e `app/themes-pro.css` via `html[data-tk]`), e não só a cor.
- **Atuais (2.6), seis:**
  - **Resenha** (padrão): sóbrio e denso, com cores escolhidas pela pessoa. Cada paleta tem 3 cores na regra 60/30/10 (fundo, texto/barra, destaque) e o resto sai do gerador OKLCH de `app/themes.js`, que garante contraste de 4,5:1 nos textos. São nove paletas (Pipoca, Musgo, Petróleo, Vinho, Marinho, Cacau, Lona, Mármore e Gelo) e o Automático, que segue o Windows. No claro, a barra lateral fica na cor 30.
  - **Vidro**: vidro claro do visionOS sobre o fundo vivo (`app/ambient.js`).
  - **Sintonia** (guia de TV, Blippo+), **Apê** (cômodos em maquete isométrica, com a Pipoca e a Amora), **Caderno** (livro manuscrito, Pentiment) e **Mergulho** (menus do Persona 3 Reload). Esses quatro desenham a sala inteira em `app/skins/<tema>.js`, ligados pelo hospedeiro `app/skins/skins.js`. O client entrega só o retrato da sala (`skinModel`) e as ações (`skinActions`); o tema nunca mexe no estado nem no DOM do app.
- **Live**: sempre na proporção real do vídeo (`--live-ar`/`--live-arn`, motion.js), sem barras e sem corte, em todos os temas.
- **Chat não rouba a live**: em tema com sala própria, o chat é secundário (bilhete, faixa, cantinho). A área da live fora da tela cheia não diminui por causa dele.
- **Temas retirados** migram sozinhos para um dos atuais (`window.RETIRED_THEMES`). Nunca quebre a escolha salva de quem usa um tema retirado.

## Como entregar mudança visual
- **Mostre prints reais do app** (CSS de verdade, perfil de teste), nunca desenhos ou mockups inventados.
  - Antes de entregar, compare o print com o que foi pedido. "Ficou só cor" já foi motivo de retrabalho.
- **Ofereça de 2 a 3 opções** quando a direção estiver em aberto e deixe o Felipe escolher. Depois de aprovada, mantenha a opção como está e mude só o que ele pedir.
- **Trabalhe em lotes pequenos, uma tela por vez,** com aprovação antes do próximo.
- **Ícones:** use os do `app/icons.js` (estilo Lucide). Ícones de marca (Spotify etc.) seguem a referência oficial, sem adaptar.
