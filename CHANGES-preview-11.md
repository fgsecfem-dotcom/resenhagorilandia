# Resenha preview.11 — salas que podem ser retomadas

## Instalar
Extraia a pasta inteira do ZIP. Feche a versão anterior pelo ícone da bandeja > Sair. Abra Resenha.exe. Não copie apenas o executável para uma pasta antiga. Windows 10/11 x64; execução real desta rodada foi no ambiente Windows 11 de build/teste. Mac continua preview.7.

## Usar
1. Atualizem A, B e C para preview.11 antes de testar. A abre a sala existente com o código original; B e C entram enquanto ela está online e recebem cópias públicas.
2. Depois que todos fecharem o Resenha, B abre Minhas salas na tela inicial e clica Abrir sala. O app consulta a descoberta; se já houver anfitrião, oferece Entrar. Se não, reivindica a sala e usa o mesmo código.
3. Ao tentar entrar pelo código sem anfitrião, um PC que tenha cópia local pode oferecer abrir a sala ali. Sem cópia, continua a mensagem explicativa.
4. Se houver senha, use a original. Versões antigas não a gravavam no disco; na primeira retomada de sala migrada o app pergunta se havia senha. O novo snapshot guarda verificador, sem senha em texto.
5. A opção Manter a sala online em segundo plano ao fechar a janela vem desligada. Com ela desligada, X no anfitrião sai do app e permite a troca automática. Ligada, X esconde na bandeja e a sala continua enquanto o PC e o app estiverem funcionando. Sair pela bandeja encerra mesmo com opção ligada. Nos convidados, X continua escondendo a janela; para todos ficarem offline, use Sair do Resenha em cada PC.

## O que é copiado
Nome, código, roomId, revisão, canais/ordem, configuração de senha e histórico público recente. Máximo 256 KiB, 1.000 mensagens no total, 200 por canal e 100 canais. Mensagens mais antigas são removidas da cópia para caber. O histórico de disco do anfitrião mantém a regra anterior de até 2.000 mensagens por canal; não foi expandido para histórico ilimitado.

DMs e favoritos ficam no perfil local e nunca entram no snapshot. Arquivos não são replicados por padrão. A referência permanece no histórico; se o novo anfitrião não tem o arquivo, aparece indisponível e será necessário reenviar. Arquivos que já existem/cópias em cache de versões antigas podem continuar disponíveis.

## Proteção dos dados
Na pasta de perfil do Resenha (normalmente %APPDATA%\Resenha):
- salas\<nome antigo>\history.json, channels.json, files.json e files\: dados legados preservados; sem mover/apagar a pasta.
- salas\<roomId>\: pasta de uma sala retomada quando não existe pasta legada compatível.
- salas\...\room.json: identidade e revisão da sala.
- minhas-salas\<CODIGO>.json: cópia recente recebida pelo membro.
- minhas-salas\conflitos\: cópias preservadas na mudança de anfitrião/ramo ou conflito de revisão.
- backups\salas\<timestamp-identificador-pasta>\: backup completo antes de migração/restauração ou ao ceder após conflito. BACKUP.txt explica a origem. Inclui arquivos daquela pasta e pode ocupar espaço proporcional a eles.
- room-folders.json: associação local entre código e pasta física, inclusive após renomear a sala.

O caminho real dos backups aparece em Minhas salas. Perfis de teste/nomes de perfil podem usar outro caminho. Backups e cópias históricas não são apagados automaticamente nesta entrega.

## Concorrência e limites
Consulta inicial de aproximadamente 6 segundos, depois janela de reivindicação de 5 segundos. Vence maior revisão; em empate, menor identificador do candidato (inclui token de instância para distinguir perfis clonados). O perdedor entra no vencedor. Durante a reivindicação o cliente está na tela inicial e não pode enviar chat para uma sala nova.

Isso não é consenso distribuído infalível. Partições, mensagens perdidas no MQTT ou atrasos podem produzir dois anfitriões temporários. Ao se detectarem, os novos anfitriões usam a mesma regra para convergir. Mensagens de um ramo perdedor não são mescladas: ficam na cópia/pasta/backup dele e podem exigir reenvio. Misturar anfitriões antigos limita essa regra.

Sem conseguir consultar MQTT, o estado é desconhecido e o app não assume automaticamente que está offline. Só mostra offline quando não encontra anúncio após consultar a descoberta. Se um anfitrião reabre com cópia antiga, mensagens recentes podem faltar; o aviso é explícito. Uma cópia local com revisão maior não é substituída pela recebida mais antiga. Revisões crescem na sequência de alterações públicas; não há garantia de ordenação global perfeita entre ramos desconectados.

O celular continua participante, sem assumir anfitrião. Esta retomada usa os PCs com snapshot local. É necessário ter recebido uma cópia enquanto um anfitrião atualizado estava online. Não é um sistema de chat offline nem de amigos globais.

## Verificação
Suíte existente e testes novos passaram: limite do snapshot, revisão, retomada B com mesmo código/roomId/histórico, backup legado, cópia antiga não sobrescrevendo nova, DMs excluídas, desempate simulado, perdedor entrando no vencedor, descoberta desconhecida e fechamento da janela. Captura/áudio de live desktop e handlers do DJ preservados.

Os testes não comprovam o funcionamento entre computadores reais, MQTT público, NAT, firewall, quedas ou suspensão do Windows. Siga ROTEIRO-salas-preview-11.md. Auditoria visual de Minhas salas e chamada real não foram realizadas no navegador de automação. Não publicado no GitHub.

Leia RELATORIO-salas-preview-11.md para a auditoria e a proposta opcional de anfitrião sempre ligado, que não foi implementada.
