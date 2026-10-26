# Resenha 1.4.0-preview.2

Esta prévia substitui a anterior para os testes do grupo. Referência visual: [Tiimo](https://www.tiimoapp.com/pt-br).

## Visual

Fundo creme, cartões em lilás, amarelo, pêssego e verde, títulos com serifas e botões arredondados. A coluna lateral de ícones foi retirada. A preferência Sistema continua alternando entre versões clara e escura. O botão para entrar na transmissão fica no cartão do amigo; a live só aparece depois de escolher assistir.

## Travamento ao compartilhar

A imagem enviada mostra uma falha de isolamento do áudio do aplicativo. Como o grupo informou que o PC também travava sem compartilhar áudio, esse aviso não permite identificar a causa do travamento. Falha de GPU/driver/captura é uma hipótese, ainda sem confirmação. Esta entrega adiciona alternativas e diagnóstico; não comprova uma correção do travamento no PC do amigo.

- Captura nova começa em 720p30 e sem som do PC. 720p60 e outros perfis continuam disponíveis no modo normal.
- Modo de compatibilidade desativa aceleração gráfica e aceleração de encode/decode de vídeo, limita a captura a 720p30 e não usa loopback de áudio. Pode aumentar uso de CPU; serve para comparar comportamento, não para prometer melhora de desempenho.
- Em Compartilhar tela, **Ativar compatibilidade** reinicia o app após a confirmação do usuário. É preciso entrar novamente na sala.
- Se a captura ficou ativa ao encerrar inesperadamente, a próxima abertura entra em compatibilidade. Encerramentos normais limpam esse marcador. Não há tentativa automática de reabrir a transmissão que falhou.
- **Abrir diagnóstico** abre `capture-diagnostics.jsonl` na pasta de dados do aplicativo. Registra etapas da captura e falhas dos processos; ao abrir o diagnóstico, acrescenta versão do sistema/Electron e informações básicas da GPU. Não registra mensagens, áudio ou vídeo da conversa.
- Ao selecionar a fonte efetiva, a enumeração pede só telas ou só janelas, sem gerar novamente as miniaturas.
- A seleção de captura é consumida uma vez. Áudio separado só é solicitado em sistemas suportados e fora do modo compatível.
- Se a exclusão do áudio do Resenha não for confirmada, a faixa de áudio compartilhado é parada e removida; o vídeo e a voz da call continuam. O aviso “Use fone” foi removido.

Um congelamento de todo o Windows pode impedir que eventos de erro sejam escritos. O último estágio registrado ajuda a investigação, mas o diagnóstico do app não substitui o registro de falhas do sistema.

## Como testar no PC que travava

1. Encerre o Resenha pelo menu **Sair** da bandeja.
2. Coloque `Abrir-Resenha-Compativel.cmd` ao lado de `Resenha-1.4.0-preview-2.exe` e abra esse atalho. Ele inicia a prévia com `--compatibility`.
3. Entre na sala e use Compartilhar tela. A captura estará em 720p30, sem som do PC e sem aceleração gráfica do app.
4. Se ocorrer falha, reabra a prévia e use **Abrir diagnóstico**. Para investigar a causa, precisamos da versão do Windows, modelo da GPU, driver e registros disponíveis do PC afetado. Não foi reproduzido nem verificado um congelamento completo nesta máquina.

O modo normal permanece acelerado. A flag do atalho vale para essa abertura; o botão dentro do aplicativo salva a preferência. Todos os amigos devem usar a prévia atual para testar os novos comandos de transmissão.

## Verificações realizadas

- Sintaxe dos arquivos principais; testes de servidor/privado/DJ; lógica de assinatura WebRTC; tema automático; seleção de músicas.
- Regressões da captura com objetos simulados: políticas de Windows/compatibilidade, recuperação após interrupção, inicialização sem aceleração, seleção única, ausência de miniaturas na enumeração efetiva e remoção de áudio não isolado sem parar o vídeo.
- Conferência visual do cliente web. O travamento do PC do amigo, a captura real nesse hardware e o desempenho em jogos ainda não foram validados.

Para os recursos herdados (privado, favoritos, DJ e web no mesmo Wi-Fi), veja [a documentação da primeira prévia](CHANGES-preview.md).
