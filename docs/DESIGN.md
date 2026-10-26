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
- **Fluidez:** no mínimo 60 fps. Blur só onde é barato (dock e rótulos) e desligado durante a live.
- **Respeitar "Reduzir animações"** (`settings.reduceMotion` e `html.reduce-motion`).
- **Material:** vidro fumê no estilo visionOS ("Líquido"). A identidade padrão é grafite neutro mais vidro esfumaçado, com laranja **só** em pequenos detalhes.

## Temas
- **Poucos e caprichados.** Cada tema muda material, movimento, arranjo e detalhes (`app/themes.js` e `app/themes-pro.css` via `html[data-tk]`), e não só a cor.
- **Atuais (2.2):**
  - Líquido (padrão, com versão preta e translúcida);
  - Holofoil (cristal holográfico, borda fina com brilhos em quem fala);
  - Vision, Vision · noite, Cosmos, Neon, Brasa, Bento e Cinema.
- **Temas retirados** migram sozinhos para um dos atuais (`window.RETIRED_THEMES`). Nunca quebre a escolha salva de quem usa um tema retirado.

## Como entregar mudança visual
- **Mostre prints reais do app** (CSS de verdade, perfil de teste), nunca desenhos ou mockups inventados.
  - Antes de entregar, compare o print com o que foi pedido. "Ficou só cor" já foi motivo de retrabalho.
- **Ofereça de 2 a 3 opções** quando a direção estiver em aberto e deixe o Felipe escolher. Depois de aprovada, mantenha a opção como está e mude só o que ele pedir.
- **Trabalhe em lotes pequenos, uma tela por vez,** com aprovação antes do próximo.
- **Ícones:** use os do `app/icons.js` (estilo Lucide). Ícones de marca (Spotify etc.) seguem a referência oficial, sem adaptar.
