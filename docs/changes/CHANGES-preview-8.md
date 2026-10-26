# Resenha 1.4.0-preview.8 — Windows

Extraia a pasta inteira, feche a versão anterior pelo ícone da bandeja > Sair e execute Resenha.exe. Não substitua somente o executável.

- Tela cheia usa toda a área disponível. Controles e nome desaparecem após 2,5 segundos sem atividade e reaparecem ao mover o cursor ou usar o teclado. Permanecem acessíveis sobre os botões.
- Cliques em microfone, deafen e pausa não propagam para o layout da live. Atualizações não movem o elemento em fullscreen.
- A captura nativa solicita explicitamente o dispositivo que exclui o áudio do próprio Resenha, com a proteção de remover áudio sem isolamento confirmado. Requer teste em chamada real; não confundir com eco acústico de alto-falantes.
- Transmissões a 30 fps também podem reduzir resolução para preservar fluidez em condições limitadas. Isso não confirma nem resolve necessariamente a causa de travamento de um espectador específico.
- Mensagem de sala não encontrada explica que é necessário um anfitrião. Após todos fecharem o app, reabra pelo mesmo nome no computador que hospedava antes para reutilizar código e dados salvos.

Os testes automatizados passaram. Eco e desempenho precisam ser verificados nos computadores afetados.
Para investigar travamento: gere o relatório Desempenho no espectador durante o problema, com a live aberta. Se possível, gere simultaneamente no transmissor e compare Wi-Fi/cabo. O relatório anterior sem espectadores não mede essa situação.

Esta entrega é Windows. A versão Mac anterior permanece preview.7.
