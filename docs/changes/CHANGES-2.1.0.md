# Resenha 2.1.0 — vidro e movimento

Visual novo inspirado na Apple TV, com animações fluidas (medidas acima de 60 fps).

## Visual
- Fundo colorido suave e painéis translúcidos de vidro na sala, na tela inicial, nas janelas e no tema claro.
- Dock da call unificado: uma barra de vidro com os ícones soltos. Mudo fica vermelho; transmitindo ganha cor e um pontinho.
- Tela inicial: "Minhas salas" no topo, como uma fileira de cards com a cor ou o ícone da sala.

## Animações
- Clicar num participante amplia o quadro dele; os outros vão para a fileira de baixo, com movimento de mola.
- Card do perfil e janelas nascem de onde você clicou e voltam para lá ao fechar.
- Conteúdo entra em etapas ao abrir a sala, a tela inicial, as janelas e o card do perfil.
- Clicar numa sala salva: o card pulsa enquanto abre e cresce até virar a sala.
- Live em tela cheia cresce da miniatura e encolhe de volta ao sair; os controles deslizam ao aparecer e sumir.
- Chat: a gaveta abre com mola, a call se reajusta e as mensagens novas entram deslizando.
- Abas (Chat/DMs e configurações) com destaque deslizante.

## Mais arrumado
- Salas sem uso há mais de 7 dias ficam ocultas nas listas (nada é apagado; "Mostrar salas ocultas" traz de volta). O X no card oculta uma sala.
- O convite só abre sozinho na primeira vez que a sala é aberta.
- Live em miniatura com a proporção da tela transmitida (sem barras pretas) e controles pequenos.
- Barra lateral recolhida organizada em uma coluna de ícones.
- Tela de carregamento no visual novo; cor do perfil como bolinha de cor; fundo mais sutil.

## Desempenho
- As animações só movem camadas prontas (posição, escala e opacidade), sem recalcular a tela a cada quadro.
- O desfoque do vidro fica só no dock e é desligado sozinho quando há live na sala.

## Configurações
- Nova opção em Aparência: "Reduzir animações" (tudo muda na hora).
- As animações do app rodam mesmo com "Efeitos de animação" desligado no Windows; use a opção acima para desligá-las.

## Validação
- 41 scripts verdes. Testado em cópias do app no Windows 11 com 5 pessoas simuladas na call.
- Ainda não testado numa partida de verdade entre PCs diferentes.
