# Resenha 1.4.0-preview.3

Atualização local para o grupo. Entrega em ZIP sem empacotador NSIS. Não publicada no GitHub.

## Mensagens e DJ

- DMs agora usam confirmação do anfitrião. O texto só é apagado após a confirmação; em falha ou reconexão, permanece no campo e aparece uma mensagem de erro.
- O histórico privado é mantido em memória durante a sessão, mesmo quando o armazenamento local não consegue gravar. Isso não garante persistência depois de fechar o app se o disco/armazenamento estiver indisponível.
- A sala anuncia sua versão e os recursos aceitos. Comandos que dependem desta confirmação mostram uma orientação de atualização quando o servidor não a oferece.
- Pular, remover o DJ, retirar da fila, pausar e tentar novamente recebem resposta de sucesso/erro. Comando fora do canal do DJ deixa de ser ignorado silenciosamente.
- É possível pular durante o carregamento. Pular/remover cancela o subprocesso da busca/download atual e ignora trabalhos cancelados ainda na fila.

A falha original relatada nas máquinas do grupo não foi reproduzida aqui. Foram reforçados tratamento de falhas e observabilidade e testados envio/resposta de DM e botões do DJ em dois clientes web conectados ao servidor atual. As faixas desse teste eram arquivos locais controlados; a busca de uma playlist real do Spotify/YouTube ainda precisa ser validada com o link que apresenta problema. O player continua baixando o áudio antes de reproduzir.

## Volume

O controle anterior era linear em amplitude, mas isso não equivale à percepção humana de volume. A nova curva é mais progressiva abaixo de 100%: 50% corresponde a ganho 0,25; 1% a 0,0001; 100% continua em 1. Acima de 100%, o ganho máximo continua em 2 (200%). A aplicação é suavizada para reduzir estalos. Voz, transmissão e DJ usam a mesma curva; 0% solicita silêncio. Valores baixos anteriormente salvos terão menor volume nesta versão. Não houve teste de percepção auditiva com o grupo.

## Temas e ícone

Cinco paletas próprias inspiradas na ideia de cores configuráveis do Tiimo: Lavanda, Hortelã, Pêssego, Rosa suave e Céu. A aparência continua separada entre Sistema, Claro e Escuro. As escolhas são salvas no perfil local.

Ícone novo de duas mensagens, em SVG/PNG e ICO com nove resoluções. O ICO foi incorporado ao executável e verificado por leitura dos recursos do arquivo. Os ícones da janela/bandeja ficam em arquivos físicos fora do ASAR para o Windows poder carregá-los. Se um atalho antigo fixado mantiver o ícone anterior, recrie esse atalho apontando para a nova pasta. A exibição real na barra de tarefas do PC de cada usuário não foi verificada aqui.

## Desempenho

- A voz normal contorna o AudioWorklet de efeitos; selecionar um filtro reativa a cadeia de efeitos.
- Indicadores de fala e temporizadores visuais deixam de atualizar em segundo plano. A chamada, o portão de voz e a transmissão continuam ativos.
- A substituição de fluxos desconecta os grafos de áudio anteriores.
- O botão **Desempenho**, na barra superior, coleta até 60 amostras de um segundo. No desktop inclui hardware e consumo por processo; com WebRTC inclui codec, frames, resolução, tempo de codificação/decodificação, perdas e motivo de limitação quando disponíveis.
- A exportação JSON também contém versão do anfitrião e status de comandos, sem texto de mensagens, nomes de participantes, SDP ou endereços de rede. No navegador, métricas de CPU/RAM do Electron não estão disponíveis.

Não há ganho de FPS/CPU quantificado. Para medir, mantenha o mesmo jogo, cena, resolução e número de espectadores e faça três coletas separadas: só chamada, live 720p30 e live 720p60. Escolher o cenário no painel apenas rotula a coleta; não altera a qualidade da live. Exporte cada coleta e informe o jogo e os FPS nos três cenários. Também informe placa de vídeo/driver e, se houver pico, quando ele acontece. O campo CPU é o índice bruto por processo fornecido pelo Electron; não deve ser comparado diretamente com o total percentual do Gerenciador de Tarefas sem considerar a forma de normalização.

## Usar a prévia

1. Todos devem encerrar a versão anterior pelo menu Sair da bandeja, especialmente o anfitrião.
2. Extraia o ZIP inteiro para uma nova pasta. Mantenha Resenha.exe, DLLs, locales e resources juntos.
3. Abra Resenha.exe normalmente. A captura que passou a funcionar não precisa ser colocada em compatibilidade. O atalho de compatibilidade continua disponível para necessidade futura.
4. O anfitrião abre a sala com o mesmo nome. A pasta de dados e o perfil do app foram preservados no código; não foi feita migração com os arquivos reais do grupo.
5. Verifique a versão do anfitrião no painel Desempenho: deve aparecer 1.4.0-preview.3.

## Verificação

`npm test` reúne regressões do servidor, confirmações de entrega/comandos, volume, persistência em memória, cadeia de efeitos, temas, captura, estatísticas de vídeo e cancelamento do downloader. Passaram os testes e a conferência da interface com dois clientes web locais. A entrega foi empacotada para Windows x64; Mac não foi gerado. Não houve teste nativo completo em dois PCs do grupo, transmissão com jogo, playlist problemática ou escuta comparativa dos volumes.

Na conferência web, o painel chegou a 60/60 amostras; o download do relatório não foi confirmado pelo navegador integrado. A exportação do desktop usa diálogo nativo e grava JSON, mas ainda requer confirmação prática no PC do usuário.
