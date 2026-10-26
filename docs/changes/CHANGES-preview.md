# Resenha 1.4.0-preview.1

Prévia local para o grupo de amigos. Base: commit 2954bc0f08963e714e6e6078fc3429e7dc82e07d (v1.3.0). Não publicada no GitHub.

## Experiência

- Visual inspirado na organização do Arc: superfícies discretas, barra lateral integrada, painéis arredondados e novo símbolo de conversa.
- Tema do sistema por padrão, com atualização ao vivo e opção de tema manual. A primeira abertura desta prévia migra o tema anterior para Sistema.
- Transmissão com **Entrar na transmissão** e **Sair da transmissão**. Vídeo e áudio da tela são enviados apenas aos espectadores inscritos. A voz da call continua independente.
- Prévia própria pausada por padrão. **Mostrar prévia** e **Ocultar prévia** controlam apenas a reprodução local. Ao minimizar ou ocultar a janela, a prévia própria é desconectada do vídeo; a captura e o envio aos amigos continuam.
- Novo perfil 720p60 (limite de 3,5 Mbps por espectador). A captura respeita limites de resolução e frames, e os parâmetros de envio são reaplicados depois da negociação WebRTC.
- Privado de texto entre participantes da mesma sala. A entrega passa pelo anfitrião, sem ser exibida aos demais participantes. Histórico de até 300 mensagens por contato/sala salvo neste dispositivo; sem entrega offline.
- Favoritos salvos por identificador do dispositivo; não há conta nem sincronização entre dispositivos.
- Cliente web responsivo de espectador, sem microfone, com abas Sala / Ao vivo / Chat. No convite do anfitrião há links para celular no mesmo Wi-Fi. O modo web pode conversar no chat e no privado.

## Música

- Pular, retirar da fila e remover o DJ sem votação, disponíveis aos participantes do canal do DJ.
- Um processo de yt-dlp por vez, sem pré-download paralelo das próximas duas músicas.
- Busca até três candidatos no YouTube, ordenando por proximidade de duração quando conhecida. Tenta o próximo candidato se o áudio não puder ser baixado.
- Preferência por áudio de até 160 kbps, sem solicitar vídeo. Sem transcodificação adicionada.
- Duração atualizada com a do áudio obtido, evitando temporizador baseado apenas na duração informada pelo Spotify.
- Músicas indisponíveis ficam no painel com o erro e **Tentar novamente**.
- Uma operação antiga de download não reinicia o DJ depois de sua remoção.

O player ainda baixa o áudio antes de reproduzir. Não foi substituído por streaming progressivo. A extração de Spotify/YouTube depende desses serviços e pode falhar; a playlist real do usuário não foi fornecida nem testada. O embed público do Spotify continua limitado ao que ele disponibiliza (no máximo 200 itens no código).

## Como experimentar

Todos os participantes devem usar esta prévia para testar os novos comandos e a transmissão por inscrição. Não há compatibilidade completa desses recursos com clientes v1.3.0.

No computador, abra a versão de teste e crie/entre numa sala. Entre na call, compartilhe a tela e peça a outro amigo para clicar em **Entrar na transmissão**. Minimize a janela do transmissor: o amigo deve continuar recebendo a tela, sem a prévia local em reprodução.

No celular, inicialmente use o mesmo Wi-Fi: em **Convidar**, copie o link **Assistir no celular** e abra no navegador. Entre na sala, depois na call e escolha a transmissão. O acesso por código do desktop depende de um túnel nativo e não foi portado para o navegador. Acesso externo exige um endereço alcançável e configuração de HTTPS/reverse proxy e WebSocket; isso não foi hospedado nesta entrega. Ao mudar o anfitrião, reabra o endereço do novo anfitrião no celular.

## Validação e limites

- `npm ci` e `npm test` para instalar as dependências e rodar os testes novos. O workflow de publicação executa esses testes antes do empacotamento de Windows e Mac.
- Testes de servidor com três clientes: mensagens privadas não são transmitidas ao terceiro cliente; comandos do DJ; erros/retry; corrida entre remoção e conclusão do download; entrega dos arquivos web.
- Testes da lógica de mídia com RTCPeerConnection simulado: inscrição, identificador de live antigo, saída e parâmetros corretos do remetente. Testes de tema e seleção/cache/concor­rência de músicas.
- Conferência visual no navegador: desktop e viewport de 390×844; entrada no canal sem microfone; conversa privada com resposta simulada e favoritos.
- Sem medição de CPU/FPS em jogos, sem transmissão real entre dois PCs ou telefone físico, sem teste de playlists reais e sem build/teste de Mac. 720p60 reduz a quantidade de pixels em relação a 1080p60, mas não garante melhora de FPS em todo computador.

O aplicativo não foi publicado nem enviado aos amigos. Os arquivos entregues são uma prévia para validação do grupo.
