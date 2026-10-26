# Resenha preview.10 — celular na rede local

## Instalação no Windows
Extraia a pasta inteira do ZIP. Feche a versão anterior pelo ícone da bandeja > Sair. Abra o novo Resenha.exe. Não copie somente o executável para uma instalação antiga.

## Entrar pelo celular
1. O anfitrião abre a sala na preview.10 e clica em Convidar.
2. O celular deve estar no mesmo Wi-Fi/rede do anfitrião. Escaneie o QR code de celular.
3. A página explica como baixar e confiar no certificado local daquele anfitrião. No iPhone, instalar o perfil e habilitar confiança SSL são etapas separadas. No Android, os menus variam por aparelho.
4. Abra o link HTTPS da página, escolha seu nome e entre na sala. Para falar, entre no canal de voz e autorize o microfone. Use fone.
5. Se não quiser instalar o certificado, o link HTTP continua disponível para chat, DMs e assistir, sem microfone.

Confie apenas no certificado do anfitrião conhecido. Essa confiança permite validar certificados assinados por ele. A chave privada fica no perfil local do PC; o app oferece somente o certificado público ao celular. A página explica como remover a confiança. Aceitar somente um aviso do navegador não garante microfone.

## Implementado
- HTTPS/WSS local conectado à mesma sala HTTP/WebSocket existente; QR code e instruções no convite.
- Cliente web entra como participante no canal, com microfone do navegador, mute/deafen, seleção de entrada quando disponível e curva de volume por pessoa igual à do desktop.
- Navegação existente Sala/Ao vivo/Chat reaproveitada. Adaptações responsivas também para paisagem, áreas seguras, tamanhos de toque, teclado via Visual Viewport e botão Enviar.
- Entrada/saída voluntária da live preservada; controles web para volume, fullscreen com alternativa de vídeo no Safari e tentativa de PiP quando exposto pelo navegador.
- Botão explícito para ativar/retomar áudio e aviso de possíveis interrupções em segundo plano. Wake Lock solicitado quando há suporte e página está visível.
- Diagnóstico web exportável: amostras de conexão, RTT, áudio/vídeo recebido, perda de pacotes, jitter e FPS quando disponíveis. Não determina automaticamente a causa de travamento.
- Chat público passa a aguardar confirmação do servidor antes de limpar o texto, como já ocorria com DMs. Texto novo digitado durante a espera é preservado. Desktop mantém envio legado para anfitrião antigo sem confirmação.

## Testado e limites
Suíte existente e novos testes passaram. Teste de protocolo com 4 clientes HTTP/HTTPS na mesma sala, TLS validado por CA do teste sem desabilitar a validação, chat/DM, entrada/saída e reconexão. Testes de lógica de mute/deafen e confirmação de mensagem. Comparação com preview.9 confirmou preservação do código de captura e reprodução/volume da live desktop.

A auditoria visual e a emulação mobile NÃO foram concluídas: o navegador de automação não alcança o servidor local neste ambiente. Não houve ensaio em iPhone, Android ou Xbox. Layout, teclado, áudio, vídeo, fullscreen, PiP, certificado, Bluetooth, chamadas recebidas, Wake Lock e desempenho real continuam a validar. 4 clientes no teste de protocolo não equivalem a 4 chamadas WebRTC simultâneas nem a um limite de capacidade.

O celular não assume anfitrião. Se outro PC assumir a sala e mudar o endereço, pode ser necessário novo link/QR e certificado daquele PC. Chamadas em segundo plano não são garantidas.

Mac continua preview.7. Nenhuma release publicada no GitHub. Nome, App ID e asar:false preservados. Captura e áudio da live desktop não foram reformulados nesta rodada.

Veja ROTEIRO-mobile-preview-10.md e RELATORIO-mobile-preview-10.md para validação e propostas futuras.
