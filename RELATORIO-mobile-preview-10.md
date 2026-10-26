# Relatório — Resenha mobile preview.10

Data: 13/10/2026. Entrega Windows. Mac permanece preview.7. Nada publicado no GitHub.

## Auditoria e evidência
A auditoria visual anterior às mudanças não foi concluída. O navegador de automação retornou timeout para localhost, 127.0.0.1 e IP local; o servidor respondeu a GET interno e nos testes de protocolo. Não foi identificado o motivo desse bloqueio do ambiente. Não é evidência de que o Resenha falhe no celular.

| Item | Classificação | Evidência antes da alteração | Situação |
|---|---|---|---|
| Microfone indisponível no web | Funcionalidade nova | WEB_VIEWER não abria microfone e enviava recvonly; botões desativados no código | Participação habilitada em contexto seguro |
| HTTP pelo IP local sem getUserMedia | Requisito de plataforma / infraestrutura nova | Servidor somente HTTP; exigência de contexto seguro documentada | HTTPS/WSS local, CA por anfitrião e configuração guiada |
| Navegação mobile | Melhoria de UX | Já havia Sala/Ao vivo/Chat e breakpoint 760px | Reaproveitada; retrato/paisagem, alvos, foco e espaços seguros ajustados |
| Campo público limpo antes de confirmação | Bug | sendMessage fazia wsSend e limpava imediatamente | ACK do servidor; erro mantém texto; desktop mantém compatibilidade com servidor antigo |
| Identificador de comandos em HTTP | Bug de compatibilidade potencial | crypto.randomUUID sem alternativa, API restrita a contexto seguro | Alternativa por getRandomValues |
| Fullscreen iPhone | Lacuna de compatibilidade | Uso de requestFullscreen na tile; nenhum caminho de vídeo nativo | Controle web tenta Fullscreen API e fallback webkitEnterFullscreen; comportamento real não confirmado |
| Teclado cobrindo composer/DM | Hipótese de UX | Nenhum problema visual observado nesta sessão | Visual Viewport e CSS de composer/modal ajustados; falta emulação/aparelho |
| Volume/Wake Lock/diagnóstico mobile | Funcionalidades novas | Ausentes como controles/fluxos dedicados | Implementados por detecção de suporte |
| Hover/navegação por controle | Hipótese de UX | Ferramentas com hover e divs clicáveis | Ferramentas web visíveis e foco/teclado; gamepad completo pendente |

Não foram observados overflow, tamanho efetivo de toque, teclado virtual ou player em retrato/paisagem. As regras responsivas foram revisadas no código, sem prova visual. Esses itens precisam de validação antes de considerar o layout aprovado.

## Viabilidade e decisão
HTTP por IP da LAN não é localhost do celular e não atende o contexto seguro do microfone. A solução escolhida é CA local persistente por perfil de anfitrião e certificado HTTPS com SAN para IPs da LAN. HTTP e HTTPS usam a mesma sala, servidor WebSocket, canais, usuários, histórico e sinalização WebRTC. Sem protocolo paralelo, sem anfitrião mobile. Nenhuma chave privada é oferecida pelo servidor web.

O QR abre a página HTTP de configuração. Ela oferece certificado público e instruções iPhone/Android, depois o link HTTPS. A porta HTTPS tenta usar porta da sala + 200, com alternativas se ocupada. Não abre essa porta automaticamente no roteador; Wi-Fi pode isolar clientes e o firewall ainda pode impedir acesso. Outro anfitrião/perfil exige outro certificado; troca de endereço pode exigir novo convite.

iPhone: instalar o perfil não basta; Apple exige confiança SSL manual. Aviso de conexão privada indica que o certificado ainda pode não estar confiável. No Android menus e avisos variam; a sequência específica não foi observada. Não prometer que ignorar um aviso ativa voz. O app verifica contexto seguro e disponibilidade de getUserMedia, depois pede permissão no canal.

Fontes:
- [getUserMedia — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Confiança de certificados — Apple](https://support.apple.com/102390)
- [Wake Lock — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [Políticas de vídeo iOS — WebKit](https://webkit.org/blog/6784/new-video-policies-for-ios/)
- [Fullscreen de vídeo — Apple](https://developer.apple.com/documentation/webkitjs/htmlvideoelement/1633500-webkitenterfullscreen)

## Voz e live
Malha WebRTC: cada participante tem conexão com os demais no canal. Mantidos sinais existentes, regras de negociação e codec negociado pelo navegador (não medido nesta rodada). Áudio de voz tem teto de envio configurado em 96 kbps por peer. Captura mobile usa processamento do navegador (eco/ruído/ganho) e caminho WebAudio leve; RNNoise/efeitos do desktop não são inicializados no web. A curva de volume é quadrática até 100%, linear acima e limitada a 200%.

Telas entram por inscrição voluntária; sair cancela inscrição, mantendo a call. Volume de live usa o ganho existente. Fullscreen/PiP são tentativas por API disponível; vídeo MediaStream e Safari precisam teste. Fullscreen nativo de vídeo no iPhone pode apresentar somente controles nativos, sem overlay HTML da call.

Autoplay: o botão Ativar/retomar áudio retoma AudioContext por toque. Navegadores podem exigir outro toque após interrupção. Wake Lock é solicitado durante participação com página visível e liberado ao sair/ocultar; não garante chamada em segundo plano. Retorno à página tenta retomar contexto, reabrir microfone encerrado e reiniciar ICE quando falhou/desconectou. Troca de dispositivo tenta recuperação; ligação/Bluetooth/Safari são a validar. Use fone; não se declara eco resolvido.

## Diagnóstico
Exportação local resenha-mobile-desempenho.json, sem nomes, mensagens, SDP ou IPs. Guarda até 120 amostras, aproximadamente a cada 3 segundos enquanto em canal e visível: estado da conexão/ICE e AudioContext, mute/deafen, inbound áudio/vídeo, packetsLost, jitter, framesPerSecond/Decoded/Dropped e RTT quando fornecidos. RTT e jitter são segundos no JSON. Perda percentual exibida é diferença de contadores entre amostras, não prova de causa. FPS pode aparecer indisponível. Nenhum limite de desempenho mobile foi validado.

## Verificação realizada
- Suíte completa existente passou, incluindo mídia opt-in, áudio, captura, DMs, música, temas, volume, diagnósticos, atualizações e fullscreen.
- Novos testes de lógica: fluxo de canal desktop/web, mute/deafen/restauração de microfone, saída, chat retido até ACK e após erro.
- Teste real de servidor/TLS com 4 conexões (2 HTTP, 2 HTTPS): confiança CA/SAN validada sem desligar verificação TLS, CA persistente, mesma sala, chat ACK, DM sem vazamento ao terceiro, canal/saída e reconexão.
- Comparação com preview.9: captura nativa, fluxo de captura e reprodução/volume de áudio da live desktop preservados.
- A suíte testa fluxo desktop/desktop por simulação de mídia; não houve chamada real desktop/desktop nem teste de codificação/decodificação mobile nesta rodada.
- 4 clientes de protocolo não equivalem a 4 calls de mídia: não há limite de participantes, bateria ou CPU comprovado.
- Emulação/QA visual bloqueadas; aparelhos reais não testados. Ver ROTEIRO-mobile-preview-10.md.

## Parte 3 — acesso de qualquer lugar (somente proposta)
| Opção | Vantagem | Limites | Esforço estimado |
|---|---|---|---|
| Cliente web HTTPS + MQTT por WebSocket + DataChannel | Reutiliza código e descoberta atuais | Browser não abre TCP bruto; adaptar ponte à aplicação web. Página precisa ser acessível por HTTPS; NAT pode exigir TURN. Anfitrião continua necessário. | Alto |
| PWA instalável | Atalho e experiência mais próxima de app | Não resolve TCP, NAT, certificado nem suspensão em segundo plano. Precisa base web funcionando. | Baixo/médio após web |
| Capacitor | Reutiliza interface e permite APIs nativas | Builds/distribuição iOS/Android, permissões e manutenção; segundo plano precisa implementação própria. iOS exige ambiente adequado. | Alto |
| Gateway/túnel HTTPS externo | Acesso simples à página e sinalização | Dependência/custo externo; publicar página não garante rota WebRTC. Sala segue dependendo do anfitrião. | Médio/alto |

Esforço é estimativa técnica, não prazo prometido. Recomendo validar LAN/voz primeiro; depois PWA para conveniência e investigação WSS/DataChannel/TURN para acesso remoto. Nenhuma dessas opções remotas foi implementada. [Capacitor — requisitos](https://capacitorjs.com/docs/getting-started/environment-setup).

## Xbox Series S — somente investigação
Não houve teste no Xbox, pacote UWP, Developer Mode ou app nativo. O endereço HTTP local é candidato para chat/live. Voz exige contexto seguro e API de microfone; não foi confirmado que o console permita instalar/confiar na CA local. Microfone e execução/áudio ao abrir jogo: A VALIDAR.

O cliente web ganhou foco por teclado, controles explícitos e ferramentas sem depender apenas de hover. Navegação espacial por gamepad, legibilidade real em TV, teclado virtual, fullscreen, certificado e downloads ainda precisam teste. Siga o roteiro Xbox no documento de testes, começando por HTTP. Não transferir capacidades do Edge desktop para o console.

## Decisões futuras
Nenhuma decisão adicional é necessária para usar/testar esta preview. O próximo investimento recomendado é validar primeiro iPhone/Safari e Android/Chrome, e só depois decidir entre PWA de conveniência e acesso remoto WSS/TURN. Escolher domínio/certificado público pode reduzir o trabalho de confiança manual, mas precisa domínio e renovação e não foi implementado.
