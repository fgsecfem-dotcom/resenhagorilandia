# Roteiro de teste — preview.10

Alvos: iPhone/Safari e Android/Chrome. Anote modelo, versão do sistema/navegador, número de participantes e se Wi-Fi/cabo no anfitrião. Não usar somente emulação para concluir compatibilidade.

1. No PC anfitrião preview.10, abra Convidar e escaneie o QR com celular no mesmo Wi-Fi. A página de configuração deve abrir. Se não abrir, testar endereço digitado, isolamento de clientes do Wi-Fi e autorização do Resenha no firewall; não presumir causa.
2. Baixe o certificado público. Confira que veio do anfitrião conhecido; o convite mostra fingerprint SHA-256. No iPhone, instale o perfil e depois habilite confiança total em Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados. No Android, procure Instalar certificado CA nas configurações de segurança. Os avisos/menus exatos devem ser registrados no aparelho; não foram observados aqui.
3. Abra HTTPS. Se aparecer aviso de conexão privada, registre o texto: a confiança pode não estar estabelecida. Não contar apenas o contorno do aviso como validação de voz. Entre com nome; microfone deve ficar disponível quando isSecureContext e getUserMedia estiverem disponíveis.
4. Entre no mesmo canal de um desktop. Autorize microfone, fale e escute. Use fone; verifique indicador de fala. Teste mute, unmute, deafen e retorno ao estado anterior. Saia e entre novamente. Tente negar microfone e registre erro visível.
5. Ajuste volume da pessoa em 0%, 25%, 50%, 100% e 150%. Observe se só aquela pessoa muda. Escolha outro microfone quando o navegador apresentar dispositivos.
6. Inicie live no desktop. No celular deve ser possível escolher Entrar na transmissão; sair não deve sair da call. Toque Ativar/retomar áudio se necessário. Ajuste volume da live e verifique separação dos volumes. Não teste mudanças de captura desktop nesta rodada.
7. Teste retrato e paisagem, fullscreen e retorno; no iPhone registrar se abre o player nativo. Verifique PiP: pode não ser exposto ou funcionar com MediaStream. Registre indisponibilidade sem tratar como suporte comprovado. Confira se a tela permanece acesa com página visível; Wake Lock depende de suporte e condições do sistema.
8. Em Chat e DM, abra teclado, escreva/encontre botão Enviar. Campo e status devem continuar acessíveis. Receber/enviar dos dois lados. Durante envio, digitar texto novo não deve apagá-lo ao confirmar. Desligue rede e tente enviar: erro deve aparecer e texto permanecer. Volte à rede.
9. Durante voz, bloqueie tela, troque de app, receba ligação, troque Bluetooth e fone/alto-falante. Não pressupor áudio em segundo plano. Ao voltar, verifique aviso/botão Retomar áudio; teste recuperação e reconexão. Anote quando exigiu toque adicional/reentrada.
10. Abra Diagnóstico, salve resenha-mobile-desempenho.json durante o problema. Verifique perdas/jitter/RTT/estado; sem concluir causa só por uma métrica. Teste primeiro 2 pessoas; depois 3 e 4 e observe bateria, aquecimento e fluidez. Não há limite de chamadas testado nesta entrega.

## Xbox Series S — roteiro de investigação
Nenhuma implementação de Xbox, UWP ou Developer Mode.
1. Mesmo Wi-Fi/LAN, abra no Edge o endereço HTTP mostrado pelo anfitrião (pode copiar o endereço da página de configuração e remover /mobile-setup para entrar sem certificado).
2. Entre na sala, leia e envie chat com controle; se possível compare teclado USB. Teste foco e alvos visíveis.
3. Entre/sai da live, ative som e teste volume/fullscreen. Registre se o navegador reproduz a mídia.
4. HTTP não habilita microfone nesta implementação. Para testar voz, seria necessário HTTPS confiável naquele navegador. Verifique se o Xbox permite estabelecer essa confiança e se a API de microfone é exposta. Se não, registre a limitação; não exigir Developer Mode.
5. Se conseguir contexto seguro, entre no canal e observe se pede microfone e se um desktop ouve. Microfone: A VALIDAR.
6. Abra um jogo, volte ao Edge e anote o que aconteceu com áudio, página e conexão. Segundo plano: A VALIDAR.
7. Registre o que falta para navegação por controle: teclado na tela, foco, rolagem, menus, legibilidade e fullscreen. Foco por teclado foi melhorado; não foi criada navegação espacial completa por gamepad.
