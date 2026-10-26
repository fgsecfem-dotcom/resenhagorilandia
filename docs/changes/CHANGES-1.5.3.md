# Resenha 1.5.3 — menos dor de cabeça

Correções da auditoria independente da 1.5.2. Sem mudança de visual, captura, áudio ou formato dos dados.

## Atualização e abertura (Windows)
- Uma atualização que não consegue ser instalada neste PC não impede mais de abrir o Resenha. Isso vale para helper bloqueado pelo antivírus, pasta protegida, falta de espaço ou release ainda sem `SHA256SUMS.txt`: o app oferece "Abrir Resenha" e "Baixar pelo site".
- Uma versão que já falhou neste PC (helper que não iniciou ou rollback) não é baixada de novo a cada abertura. O app tenta outra vez quando sair uma versão mais nova, ou quando a pessoa pede pela barra de atualização.
- Depois de instalar manualmente a versão nova, o atualizador volta a funcionar: planos antigos da mesma versão ou de outra pasta são descartados.
- "Tentar novamente" consulta a internet de verdade, mesmo logo depois de uma falha de conexão.
- Uma falha de download não mostra mais a tela de recuperação de rollback; a nova tentativa baixa de novo.
- Pastas `.resenha-update-*` abandonadas ao lado do app são limpas automaticamente após uma hora.
- Falhas de download e de hash continuam com "Tentar novamente" ou "Baixar pelo site", como na 1.5.2.

## Sala
- Cada conexão recebe uma chave privada de retomada. Outra pessoa, ou outra aba do navegador, com o mesmo id ganha um id próprio: não derruba mais ninguém nem recebe DMs alheias. Clientes antigos continuam entrando normalmente.
- Os nomes de anexos vindos de cópias replicadas são saneados, e o servidor só serve arquivos de dentro da pasta da sala.
- Ao excluir um canal de texto, o anfitrião guarda uma cópia das mensagens em `backups`.
- O DJ restaurado não começa a baixar música se a sala fechar nos primeiros segundos.
- Um link adicionado ao DJ depois que ele saiu da call mostra um erro, em vez de criar uma fila fantasma.

## Call e interface
- Sair da sala enquanto o microfone ainda está abrindo não deixa o microfone ligado.
- Os controles da live (volume, microfone, tela cheia) não são recriados quando outra pessoa muda de estado: arrastar o volume e a navegação por teclado não se perdem.
- O áudio de uma transmissão reclassificada libera o elemento anterior.
- Os ids vindos do anfitrião são escapados no HTML.

## Compatibilidade
- Mesmo App ID, `asar: false` e dados em `%APPDATA%\Resenha`.
- O protocolo é compatível nos dois sentidos com as versões anteriores: o campo `resume` é opcional.
