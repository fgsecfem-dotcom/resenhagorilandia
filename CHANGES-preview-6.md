# Resenha 1.4.0-preview.6

## Live em tela cheia

O botão de tela cheia abre o cartão da transmissão com controles do Resenha. Inclui microfone, deafen, pausa do vídeo, sair da live e voltar para a janela. Sair da live cancela a assinatura do vídeo e mantém a call de voz; na própria transmissão, apenas oculta a prévia. O botão de microfone fica desativado no espectador web.

## Avisos de atualização

Consulta releases no GitHub ao abrir e a cada 30 minutos. Compara corretamente versões preview, inclusive preview.9 e preview.10. Quem usa uma preview pode receber previews publicadas; versões estáveis procuram versões estáveis. A distribuição em pasta procura um ZIP Windows e abre a página para baixar/extrair o pacote completo, em vez de substituir somente o EXE.

As builds entregues nesta conversa não foram publicadas no GitHub; por isso o serviço ainda não anuncia essas versões. Versões antigas consultam /releases/latest, precisam de release estável com Resenha.exe e comparam apenas os três números principais. Para também avisar as previews 1.4.0 já distribuídas, a release de transição precisa ter versão superior a 1.4.0, por exemplo 1.4.1. Isso exige preparar o executável portable compatível e publicar a release; não foi feito nesta entrega. Não é possível modificar remotamente um executável que não tenha verificação de atualização.

## Fora desta build

Perfis customizáveis: apenas pesquisa de referências, conforme pedido do usuário. Bot de música: permanece o atual, que baixa o áudio completo. Reprodução progressiva e player YouTube sincronizado foram apresentados como alternativas para decisão posterior.

## Abrir e validar

Extraia TODO o ZIP. Encerre o Resenha antigo pelo menu Sair na bandeja e abra Resenha.exe da pasta nova. Mesmo perfil e identidade do aplicativo. O ícone da Pipoca da prévia 5 permanece.

Validação: regressões de áudio, comandos, captura e protocolo; comparação de versões e seleção de pacote; controles de tela cheia com DOM e mídia simulados; arquivos distribuídos comparados com o código; CRC do ZIP. A aparência da tela cheia e integração com o Windows precisam de confirmação no uso real.
