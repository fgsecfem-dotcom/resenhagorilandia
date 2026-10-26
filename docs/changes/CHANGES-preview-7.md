# Resenha 1.4.0-preview.7 para macOS

## Escolher o pacote

- mac-apple: Apple Silicon (chips M1, M2, M3, M4 e posteriores).
- mac-intel: processadores Intel.

Requer macOS 13 Ventura ou posterior. Confira o chip em menu Apple > Sobre Este Mac.

## Abrir

1. Encerre o Resenha antigo pelo menu Resenha > Sair ou Cmd+Q.
2. Extraia o ZIP no próprio Mac, usando o Finder. O pacote contém Resenha.app.
3. Mova Resenha.app para Aplicativos. Se já houver uma versão antiga, substitua o aplicativo.
4. Abra Resenha.app. O nome e o identificador continuam os mesmos: os dados do perfil não são apagados por trocar o aplicativo. Para entrar na sala dos amigos, use o código habitual.

Esta entrega usa assinatura ad hoc, sem certificado Developer ID e sem notarização pela Apple. O macOS pode pedir autorização na primeira abertura. Para a decisão de abertura, consulte o procedimento oficial da Apple em https://support.apple.com/102445 . Não é necessário desativar o Gatekeeper ou executar comandos que removam as proteções do sistema.

## Microfone e transmissão

Autorize o microfone quando solicitado. Para compartilhar a tela, confira Resenha em Ajustes do Sistema > Privacidade e Segurança > Gravação da Tela (o nome pode incluir áudio do sistema, conforme a versão do macOS). O macOS pode solicitar que você encerre e abra o aplicativo novamente após mudar a permissão.

A call de voz e o compartilhamento de vídeo estão preparados para macOS 13 ou posterior. Nesta build, a opção de áudio do sistema é habilitada apenas no macOS 14.2 Sonoma ou posterior, e fica desabilitada no modo de compatibilidade. Mesmo quando habilitada, depende das permissões e da confirmação de exclusão do áudio da própria call; se essa exclusão não for confirmada, o aplicativo remove o áudio da transmissão e mantém o vídeo para evitar eco.

## Recursos incluídos

Código atualizado com a Pipoca como ícone, temas, DMs na sala, favoritos, volume progressivo, controles de música com confirmação, live por adesão, prévia própria oculta e controles de microfone/deafen/sair da live em tela cheia. O bot ainda baixa o áudio antes de reproduzir; perfis novos e reprodução progressiva não foram implementados.

Compatível com o protocolo das previews recentes de Windows, incluindo a prévia 6. Não exige que os amigos no Windows instalem outra build para você entrar na sala.

## O que foi validado

- Runtimes oficiais Electron 44.4.5 e respectivos SHA256.
- Arquitetura dos executáveis de cada pacote; assinaturas ad hoc, páginas de código, permissões de JIT e hashes de Info.plist/recursos/processos auxiliares.
- Código distribuído comparado com o código-fonte atual.
- Permissões Unix de execução e links simbólicos preservados no ZIP.
- Testes automatizados do protocolo, áudio, captura, atualização e controles da live.

Os aplicativos foram preparados no Windows com assinatura multiplataforma. Não foram executados em um Mac nesta sessão. A aprovação pelo macOS, a captura de tela, o áudio do sistema e o comportamento real da interface precisam ser confirmados no Mac. Assinatura ad hoc não equivale à notarização pela Apple.

Se houver problema, envie a mensagem exibida e a versão do macOS; se o app abrir, o relatório de Desempenho ajuda a registrar o cenário.

Referências: https://www.electronjs.org/blog/electron-44-0 ; https://www.electronjs.org/docs/latest/api/desktop-capturer ; https://support.apple.com/guide/mac-help/mchld6aa7d23/mac
