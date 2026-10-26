# Como publicar uma versão

Publicar sempre precisa do ok do Felipe. Os passos 1 a 3 não publicam nada.

## Onde fica cada coisa
O repositório fica em `<ws>/work/resenhaapp`. As ferramentas ficam ao lado, em `<ws>/work/`, fora do Git:
- `electron-runtime/`: Electron comum, usado como Node e pelo electron-builder;
- `ecs-probe-20261024/runtime/`: Electron castLabs ECS 44.9.3, usado no build do Windows porque o Spotify precisa de Widevine;
- `mac-runtimes/`: Electron 44.4.5 oficial para Mac (arm64 e x64);
- `tooling/rcodesign/`: assinatura ad hoc do Mac, feita no Windows;
- `tooling/shims/`: atalho do npm.

Os builds vão para `work/build-release<N>`, `work/build-linux<N>` e `work/mac-build-<N>`. Os pacotes finais vão para `<ws>/outputs/releases-<versão>/`. `<N>` é a versão sem pontos (2.3.0 → 230).

## 1. Preparar
- Subir a versão em `package.json` e `package-lock.json` (linhas 3 e 9).
- Escrever `docs/changes/CHANGES-<versão>.md`, curto, em português, para quem usa o app.
- Testar com `sh tools/test.sh`: todos os testes têm que passar.
- Se a versão mexe no "o que mudou" do app, conferir `maybeWhatsNew` em `app/client.js`.

## 2. Gerar os pacotes
```sh
sh work/resenhaapp/tools/release/build.sh
```
O script faz, nesta ordem:
- build do Windows (ECS) e do Linux;
- assinatura EVS do Windows (`Resenha.exe.sig`);
- ZIP do Windows;
- os 7 passos do Mac (preparar, renomear helpers, assinar e verificar);
- tar.gz do Linux.

Ao final devem existir 8 arquivos:
- `Resenha-<v>-Windows-x64.zip` e `SHA256SUMS.txt`;
- `Resenha-<v>-mac-apple.zip`, `Resenha-<v>-mac-intel.zip` e `SHA256SUMS-mac.txt`;
- `Resenha-<v>-linux-x64.tar.gz`, `SHA256SUMS-linux.txt` e `LEIA-ME-linux.md`.

O atualizador automático depende dos `SHA256SUMS*`. Sem eles, o app manda a pessoa baixar a versão manualmente.

## 3. Conferir o Windows de verdade
- Abrir `work/build-release<N>/win-unpacked/Resenha.exe --profile=teste<N>`.
- Ver a versão e se o Spotify conecta.
- Fechar e apagar o perfil de teste (`%APPDATA%\Resenha-teste<N>` e `~\.resenha-teste<N>`).
- Nunca usar o `%APPDATA%\Resenha` real.

## 4. Rascunho da release (com ok do Felipe)
```sh
cd outputs/releases-<v>
gh release create v<v> -R fgsecfem-dotcom/resenhagorilandia --draft --title "Resenha <v>" \
  --notes-file ../../work/resenhaapp/docs/changes/CHANGES-<v>.md \
  Resenha-<v>-Windows-x64.zip SHA256SUMS.txt Resenha-<v>-mac-apple.zip Resenha-<v>-mac-intel.zip \
  SHA256SUMS-mac.txt Resenha-<v>-linux-x64.tar.gz SHA256SUMS-linux.txt LEIA-ME-linux.md
```
Conferir que os 8 arquivos subiram com o mesmo SHA-256. O comando `gh release view v<v> --json assets` mostra o `digest` de cada um.

## 5. Publicar (com ok do Felipe)
```sh
gh release edit v<v> -R fgsecfem-dotcom/resenhagorilandia --draft=false --latest
```

## 6. PWA (versão para navegador e celular)
```sh
work/electron-runtime/electron.exe work/resenhaapp/pwa/build-pwa.js work/pwa-dist
```
Copiar `work/pwa-dist/` para um clone da branch `gh-pages`, fazer o commit "Resenha PWA <v>" e o push.

## Serviço de descoberta (Cloudflare)
O código fica em `signal-worker/`. Para publicar, usar `sh tools/wrangler.sh deploy`, que precisa de `wrangler login` na conta Cloudflare do Felipe. Só mexer quando a issue pedir.

## Avisos conhecidos
- O Windows mostra o aviso do SmartScreen porque o app não tem certificado pago. Isso é esperado.
- O Mac é assinado ad hoc e não é notarizado. Na primeira abertura, a pessoa precisa clicar em "Abrir Mesmo Assim".
- O Mac e o Linux são montados no Windows e ainda não foram abertos numa máquina real.
