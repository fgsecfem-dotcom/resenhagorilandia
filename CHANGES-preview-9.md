# Resenha preview.9 — áudio no Windows 10

Extraia a pasta inteira. Feche a versão anterior pela bandeja > Sair e abra o novo Resenha.exe. Não copie apenas o executável.

A opção Transmitir som do PC passa a ficar disponível no Windows 10 versão 2004 (build 19041) ou posterior, incluindo 21H2 e 22H2, com modo de compatibilidade desligado. A captura solicita exclusão do áudio do Resenha. O limite anterior 20348 bloqueava versões em que a captura por processo pode funcionar.

Se a inicialização com som falhar por indisponibilidade da captura, o app tenta apenas vídeo e avisa. Não tenta capturar todo o som sem exclusão. Áudio encerrado ou sem isolamento confirmado é removido. Cancelamento e permissão negada não são repetidos. Falhas de inicialização do áudio são registradas em Abrir diagnóstico.

Teste no computador Windows 10: marque Transmitir som do PC; reproduza um vídeo ou som do jogo; peça ao espectador para confirmar que escuta esse som sem ouvir sua própria voz de volta. Use fone para não confundir eco acústico com captura da call. Se aparecer aviso de live sem som, envie o conteúdo de Abrir diagnóstico. Windows 10 anterior à versão 2004 continua sem essa opção.

Validação: testes automatizados de política por versão, captura, falhas e regressões. Pacote Windows e arquivos conferidos. Não testado em hardware Windows 10; o funcionamento de áudio e exclusão precisa ser confirmado no PC afetado. A build Mac permanece preview.7.

Referência técnica: OBS habilita captura por processo a partir de 19041 e documenta no código a diferença em relação ao limite 20348 da documentação Microsoft:
https://github.com/obsproject/obs-studio/blob/master/plugins/win-wasapi/plugin-main.cpp
