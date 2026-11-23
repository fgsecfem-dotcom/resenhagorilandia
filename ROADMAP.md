# Roadmap do Resenha

Cada milestone é uma versão (ou etapa) com objetivo e critério de pronto. As tarefas ficam nas [issues](https://github.com/fgsecfem-dotcom/resenhagorilandia/issues) e são agrupadas nos [milestones](https://github.com/fgsecfem-dotcom/resenhagorilandia/milestones). Ao fechar um milestone, atualize esta página.

**Versão publicada:** 2.2.2

## M0 · Organização (concluído)
Objetivo: deixar o projeto pronto para trabalhar por milestones, a dois.
- [x] Código e releases num único repositório público
- [x] `CLAUDE.md` com mapa de módulos e regras
- [x] Scripts de release no repositório (`tools/release/`) e passo a passo em `docs/RELEASE.md`
- [x] Documentos antigos em `docs/`
- [x] Labels, milestones e issues criados no GitHub (#5)

Concluído em 26/10/2026 (PR #6).

## 2.3 · Segurança e Mac
Objetivo: fechar a brecha de identidade entre salas e confirmar o Mac de verdade.
- Credencial de identidade diferente para cada sala (#1)
- Testar a atualização automática num Mac real (#2, precisa de alguém com Mac)
- Testar a primeira abertura, o microfone, a tela e o som num Mac real (#3)

Pronto quando: as issues fecharem, os testes passarem e a 2.3.0 for publicada.

## Licença
Objetivo: abrir o código com uma licença clara.
- Pedir o ok do Lucas, autor original, e adicionar o `LICENSE` (#4, sugestão: MIT)

## Servidor central (infra)
Objetivo: parar de depender de anfitrião. Uma VM grátis em São Paulo (Oracle Cloud Always Free) roda o servidor das salas 24h. Voz e tela continuam P2P, com um TURN em SP de reserva.
- Criar a conta da Oracle Cloud com a região São Paulo (#32)
- Servidor da sala rodando vários servidores num processo, com SQLite (#33)
- Criar a VM ARM em São Paulo e um script de deploy (#34)
- HTTPS e WSS no servidor central (#35)
- coturn na VM como TURN de reserva (#36)
- Backup diário e página de saúde (#37)
- Medir o ping real dos amigos até a VM (#38)

Pronto quando: o servidor central ficar no ar sozinho, com backup, e as medições mostrarem latência igual ou menor que a de hoje.

## 3.0 · Servidores
Objetivo: servidores persistentes estilo Discord, mais simples e focados em experiência.
- Modelo de dados dos servidores (#39)
- Cliente conecta direto no servidor central (#40)
- Convite por link com prévia (#41)
- Papéis simples: dono, admin e membro (#42)
- Lista de membros e não lidas na barra lateral (#43)
- Importar uma sala atual para um servidor (#44)
- Tempo de guarda do histórico e aviso aos usuários (#45)
- DJ com servidor central: onde roda o yt-dlp (#46)

Pronto quando: as issues fecharem, os testes passarem e a 3.0.0 for publicada.

## 3.1 · Polimento dos servidores
Objetivo: deixar os servidores gostosos de usar.
- Telas de criar servidor e de convite (#47)
- Entrar na call direto da tela inicial (#48)
- Notificações de menção (#49)
- Conectar outro aparelho por QR (#50)
- Avaliar SFU se a malha P2P pesar (#51)

## Backlog
Ideias sem data ficam como issues sem milestone. Quando uma for escolhida, ela entra num milestone aqui.
