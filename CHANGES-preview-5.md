# Resenha 1.4.0-preview.5

Correção direcionada ao ícone da barra de tarefas do Windows. Mantém o desenho da Pipoca e as funcionalidades anteriores.

A janela usa o PNG da Pipoca e configura explicitamente o ícone e o comando de reabertura do botão da barra de tarefas (setAppDetails). O AppUserModelID e o nome do perfil continuam com os mesmos valores, preservando a identidade do aplicativo. O executável da prévia 4 já continha o ícone correto; cache ou um atalho antigo também podem influenciar o que o Windows exibe.

Extraia TODO o ZIP. Encerre o aplicativo antigo pelo menu Sair na bandeja, depois abra Resenha.exe da pasta nova. Caso continue aparecendo o ícone antigo, desafixe o atalho antigo e fixe o executável novo. Não é necessário apagar a sala ou o perfil.

Validação: comparação do ícone incorporado no executável com o ICO da Pipoca; comparação dos arquivos distribuídos com o código-fonte; integridade CRC do ZIP. O efeito sobre o ícone em cache da máquina do usuário precisa ser confirmado após abrir a build.

Entrega local, não publicada no GitHub. Abrir-Compativel.cmd permanece disponível.
