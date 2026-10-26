# Relatório — salas persistentes preview.11

Data: 13/10/2026. Entrega Windows 10/11 x64. Mac segue preview.7. Nenhuma publicação no GitHub.

## Auditoria antes das mudanças

### Criação e disco
O cliente hostRoom lia roomCodes do localStorage do perfil e associava nome literal da sala a um código aleatório de oito caracteres. Sem essa associação, gerava outro código. O processo principal usava app.getPath('userData')/salas/<nome sanitizado, até 40 caracteres>. Ali ficavam history.json, channels.json, files.json e files/<id>/<nome>. O servidor carregava esses arquivos e salvava alterações com debounce de 500 ms, limitando o histórico a 2.000 mensagens por canal.

O código não era identidade persistida junto desses arquivos. Um convidado mantinha S.channels e S.history em memória, mas não uma cópia persistente da sala com revisão. A senha era passada para abrir a sala e não era gravada como configuração recuperável no disco.

### Descoberta
Signal normaliza o código, deriva tópico MQTT e chave para mensagens criptografadas. Reutiliza três brokers públicos. O anfitrião anuncia presença a cada quatro segundos e responde aos pedidos de entrada com SDP; renderer app/tunnel.js cria o WebRTC DataChannel, e tunnel-main.js faz a ponte TCP. MQTT contém sinalização; não é armazenamento permanente de histórico.

Sem anfitrião, guestConnect faz até três tentativas. Se os brokers estão acessíveis mas ninguém responde, retorna notfound; sem broker, nobroker. A resposta não permite concluir problema de NAT quando nem houve anfitrião encontrado. Quando a sala é encontrada mas o P2P falha, existe outro erro.

### Troca automática e janela
failover usa usuários ainda conectados, priorizando quem entrou primeiro. O sucessor abre com o mesmo código e snapshot em memória, incluindo a fila transitória do DJ. Os demais procuram o novo anfitrião. O desempate antigo comparava número de clientes, epoch, horário de entrada e ID. Ao cessarem todas as instâncias, deixa de existir serviço que responda pelo código.

No código anterior, X escondia a janela na bandeja e o Resenha continuava funcionando. Sair pela bandeja encerrava o anfitrião com motivo 4003, permitindo sucessão entre quem sobrava. Isso foi verificado no código; não foi ensaiado em três PCs nesta auditoria.

### Reprodução e limites da evidência
Antes de editar, executei a função real hostRoom em VM com dois perfis simulados: A tinha a associação Nossa sala → código original e a reaproveitou; B, sem associação, gerou novo código ao usar o mesmo nome. O resultado foi observado no teste isolado. O caminho de entrar pelo código sem serviço foi auditado no código (tentativas/notfound), sem reproduzir MQTT/NAT real. Não houve auditoria visual em computadores reais. A causa da troca de código na criação por B é sustentada pela função executada; causas de falhas de rede permanecem desconhecidas.

## Implementação

room-state.js define um roomId determinístico por código normalizado. Nome e perfil não mudam a identidade. room.json guarda identidade, nome, revisão e configuração no diretório da sala. room-folders.json mantém a ligação local código→pasta para preservar diretórios antigos mesmo depois de renomear a sala.

O servidor publica room-snapshot no ingresso do membro e após salvar alterações públicas. O processo principal do anfitrião e os PCs membros gravam em minhas-salas/<CODIGO>.json. As revisões aumentam com alterações públicas; presença, DMs e favoritos não são história pública. O formato é uma whitelist: nenhum dado de DM, favoritos, perfis globais ou senha em texto entra. Uma DM enviada no teste de servidor não apareceu no snapshot.

Limites da cópia: 256 KiB UTF-8, até 1.000 mensagens no total, 200 por canal e 100 canais (mantendo ao menos texto/voz). Conteúdo mais antigo é descartado da cópia para caber. Isto não limita os backups completos nem muda a regra anterior de 2.000 mensagens por canal no disco. O envio é de cópia recente completa, não delta, em geral após o debounce de 500 ms. Pode haver atraso/falha antes de um membro persistir a última atualização; não há garantia de zero perda em desligamento abrupto.

A configuração replicada cobre nome, canais/ordem e proteção de senha por verificador. Preferências pessoais de aparência, volume, perfil e favoritos continuam locais. Na primeira retomada de uma sala antiga sem configuração de senha em disco, pergunta se havia senha. Depois, salas protegidas exigem a original para retomar. A fila transitória do DJ continua no caminho original de sucessão; não faz parte da cópia offline.

Minhas salas lista as cópias no PC. Consulta MQTT para mostrar online/anfitrião encontrado, offline/nenhum encontrado ou desconhecido. Abrir consulta de novo antes de reivindicar. Online oferece entrar. Entrar por código e receber notfound oferece abrir localmente somente se há snapshot. Sem snapshot permanece a explicação. Web/celular não assume anfitrião; o recurso de retomada é dos clientes desktop atualizados.

### Eleição e conflitos
Consulta inicial ~6 s; reivindicação repetida por ~5 s. Maior revisão vence; empate por menor identificador lexicográfico fixo do candidato daquela instância. Um sufixo aleatório de instância distingue perfis clonados. Quem perde espera e tenta entrar pelo código. Sem broker conectado, não assume automaticamente que está offline.

Os novos anfitriões concorrentes anunciam o critério de reivindicação e convergem ao se enxergarem. A sucessão original continua para a queda de anfitrião online. Clientes antigos não implementam a mesma eleição; atualização de A/B/C é necessária para o teste completo.

O app fica na tela inicial durante a reivindicação, sem permitir enviar mensagens para uma sala nova. Em partição/atraso pode existir dupla temporária após a abertura. Não há mesclagem de mensagens: as do perdedor permanecem no seu ramo local/cópia/backup, não aparecem automaticamente na sala vencedora e podem exigir reenvio. Não é consenso distribuído resistente a toda partição. Revisão maior indica avanço naquela sequência, não prova que contém todas as mensagens de ramos desconectados.

Uma cópia recebida mais antiga não substitui a local mais nova. Cópias de igual revisão com conteúdo diferente, ou de outro ramo/anfitrião, são arquivadas em minhas-salas/conflitos. Na retomada, há aviso de que mensagens recentes podem faltar, pois ninguém consegue saber com certeza qual atualização um PC offline não recebeu. Se um PC com revisão mais alta entra em anfitrião desatualizado, preserva sua cópia e recebe aviso; não sobrescreve automaticamente o histórico ativo. É possível parar e retomar pela cópia mais nova, preservando backups.

### Backups e migração
Antes de adicionar identidade a dados legados, a pasta é copiada integralmente para app.getPath('userData')/backups/salas/<timestamp-ID-pasta>. BACKUP.txt descreve o motivo. Também há backup antes de restaurar cópia mais nova sobre dados existentes e ao ceder por conflito. Não move nem apaga os diretórios antigos. Escritas de JSON usam arquivo temporário e rename; cópia inválida preexistente é preservada antes de substituição.

Minhas salas exibe o caminho real dos backups. Caminhos comuns no Windows: %APPDATA%\Resenha\salas, minhas-salas e backups\salas; perfis de teste usam outro caminho. Backups completos incluem arquivos e podem ser grandes. Arquivos e cópias históricas não têm limpeza automática nesta versão.

### Arquivos e fechamento
A cópia leva referências de anexos, sem bytes. Não baixa e replica arquivos por padrão. Se o novo anfitrião não tem o arquivo, o histórico o marca indisponível e pede reenvio. Arquivos já existentes e caches antigos podem ser aproveitados; nada deles foi apagado.

Manter sala online em segundo plano é uma opção persistente, desligada por padrão. Em anfitrião, X com opção desligada sai do app; ligado esconde para a bandeja. Sair pela bandeja encerra. Em convidados, X conserva o comportamento de esconder. O PC deve permanecer ligado/ativo; não foram alteradas configurações de energia nem criados serviços de sistema.

## Verificação
Suíte completa existente passou. Novos testes: snapshot limitado/public-only, histórico legado em array, revisão mais nova, backup antes da migração, B restaura mesmo código/roomId/histórico, snapshot antigo não sobrescreve novo, DM real do teste ausente na cópia, arquivo de ramo anterior preservado, candidatos simultâneos com vencedor determinístico, anfitrião existente e descoberta desconhecida, perdedor entra em vez de hospedar, X padrão e opção de bandeja.

Testes de transporte MQTT foram simulados; sockets HTTP/WS e persistência foram exercitados localmente. Não há prova entre PCs reais, NAT, brokers públicos, firewall, suspensão ou quedas no instante da gravação. Não foi feito teste visual da nova tela nem chamada real nesta rodada. Captura de tela e reprodução/volume de live desktop foram comparados com o código anterior; funções/handlers do DJ preservados. Nome Resenha, App ID com.lucas.resenha e asar:false mantidos.

A primeira tentativa de build na pasta reutilizada falhou por EPERM; a entrega foi produzida em um diretório novo e os arquivos finais foram conferidos. Isso é uma limitação do ambiente de build, não um teste de execução no Windows 10.

## Parte 3 — anfitrião sempre ligado (somente proposta)

Executar server/index.js sozinho hoje fornece HTTP/WebSocket, não a entrada completa por código. tunnel-main.js depende da janela/IPC e de app/tunnel.js para o WebRTC. Portanto, não basta executar os dois arquivos em Node sem adaptação.

| Opção | Esforço relativo | Limites e mudanças |
|---|---|---|
| PC com Resenha atual e opção de bandeja | Baixo, já disponível | Ainda usa o app. PC ligado/sem suspensão e sala aberta; sem serviço/autoinício implementado. Entrada por código segue igual. |
| Electron com worker/janela oculta dedicada | Médio | Reutiliza Chromium/WebRTC e ponte. Precisa bootstrap da sala, modo sem UI, controle/admin e execução como serviço; Linux pode exigir ambiente de display virtual. Consumo deve ser medido antes de escolher Pi. |
| Serviço Node com WebRTC servidor | Alto | Extrair protocolo e adaptar DataChannel/ICE. Uma opção de estudo é Werift; não foi instalada nem testada. Melhor candidato para Linux/Pi/VPS após prova de interoperabilidade. |
| VPS dedicada ao grupo | Médio/alto conforme runtime | Custo de VM/tráfego, IP/portas/UDP/TURN e manutenção. Se ponte compatível estiver ativa, usuários continuam entrando pelo mesmo código; HTTPS público para celular é assunto separado. |

A [documentação do Electron](https://www.electronjs.org/docs/latest/api/browser-window) oferece janela oculta, mas isso não equivale por si só a um serviço operacional sem UI. [Werift](https://github.com/shinyoshiaki/werift-webrtc) oferece WebRTC/DataChannel em Node.js/TypeScript; sua API e interoperabilidade teriam de ser validadas com nosso túnel. Não há benchmark ou garantia de Raspberry Pi nesta tarefa.

Recomendação: validar primeiro a retomada distribuída. Se quiser disponibilidade diária, começar com um PC que já fica ligado e o modo de bandeja. Para headless definitivo, fazer uma prova separada de serviço Node ou worker Electron. Continuaria opcional, por sala/grupo, sem tornar todas as salas dependentes de servidor central permanente.

Riscos/limites: energia/rede/disco do anfitrião, atualizações e supervisão do processo, backup/capacidade, credenciais de administração, portas expostas numa VPS e custo de tráfego quando houver relay. MQTT público continua dependência de descoberta. Se o dedicado cair, a retomada por membros deve continuar como fallback; preferência de eleição para um host dedicado precisa ser desenhada/testada. Não implementar isso sem aprovação.

Nenhuma decisão adicional é necessária para testar preview.11. Para etapa futura, escolher se existe PC sempre ligado ou se prefere investir em Pi/VPS, e se o dedicado deve ter prioridade na eleição.
