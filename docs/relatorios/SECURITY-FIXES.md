# Correções de entrada, anexos e identidade

Este patch corrige três problemas identificados na 2.2.2:

- JSON `null`, arrays e valores primitivos no WebSocket são ignorados antes de acessar campos do comando, antes e depois da autenticação.
- O nome de upload é decodificado apenas pelo `URLSearchParams`. Um nome como `100%.txt` não lança exceção, e `literal%20name.txt` mantém o `%20` literal.
- O servidor deixa de aceitar `cid` como prova de identidade. Um participante não pode assumir o ID de alguém que saiu para editar/excluir mensagens ou receber novas DMs destinadas a essa pessoa.

## Identidade e compatibilidade

O cliente gera uma credencial aleatória de 32 bytes com `crypto.getRandomValues`, guarda em `localStorage` e a envia somente no `hello` ao anfitrião. Não precisa de `SubtleCrypto`, portanto também funciona no visualizador HTTP local.

O servidor deriva o ID público como os primeiros 40 caracteres hexadecimais de `SHA-256("resenha-client-v1:" + credencial)`. Esse tamanho cabe no campo `userId` dos snapshots. Saber o ID não basta para reproduzir a credencial. O mesmo cliente mantém o ID após reconexão, reinício do servidor e transferência de anfitrião, sem copiar segredos nos snapshots. A conexão antiga não pode continuar enviando comandos depois de ser substituída.

A credencial é um segredo de acesso ao portador, não uma assinatura nem proteção contra um anfitrião malicioso. O anfitrião já é parte confiável do protocolo e pode observar/modificar o tráfego da sala. A conexão direta por HTTP/WS continua sem criptografia de transporte; esta mudança não substitui HTTPS ou o túnel WebRTC.

Regras de migração que devem ser consideradas ao publicar:

1. Atualizar os anfitriões é necessário para aplicar a proteção. Clientes novos conectados a servidores antigos continuam sujeitos às regras antigas desses servidores.
2. Na primeira conexão a um anfitrião atualizado, a identidade autenticada é nova. IDs antigos não são reivindicados automaticamente porque não tinham comprovação de propriedade. O histórico permanece, mas mensagens antigas não passam a pertencer ao novo ID; contatos/favoritos e DMs associados aos IDs antigos não são migrados automaticamente. A exclusão de mensagens pelo anfitrião permanece disponível.
3. Clientes antigos ainda podem entrar, com um ID gerado pelo servidor. Só retomam uma conexão ainda ativa com seu `resume` privado. Depois de sair/reiniciar/trocar anfitrião, recebem novo ID. Para preservar identidade e continuidade de chamadas, atualizar todos os participantes.
4. Abas que compartilham a mesma credencial representam a mesma identidade; a conexão mais recente substitui a anterior. Perfis/dispositivos com armazenamento separado têm identidades separadas. Apagar o armazenamento perde essa identidade.
5. Não incluir `identitySecret` em logs, diagnósticos, usuários públicos, mensagens ou snapshots.

## Testes

`node test/security-boundaries.js` usa conexões HTTP/WebSocket locais e cobre payloads inválidos antes/depois do login, round-trip de anexos com `%`/Unicode, tentativa de assumir identidade ativa/desconectada, edição/exclusão indevida, entrega de DM ao titular, reconexão legítima, reinício, transferência por snapshot e proteção de IDs legados.

O teste também verifica a persistência da credencial no cliente, geração sem `SubtleCrypto` e ausência do segredo em mensagens públicas/snapshots. Ele faz parte de `npm test`. `test/regression-1.5.3.js` continua verificando que um cliente legado precisa do `resume` para substituir uma sessão ativa.
