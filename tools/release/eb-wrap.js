// Roda o electron-builder (ou o wrangler) com o Electron no papel de Node.
// O yargs trata um Electron empacotado como se argv[1] fosse o primeiro argumento;
// marcar defaultApp faz ele se comportar como um runtime comum.
process.defaultApp = true;
if (require.main === module) {
  const cli = process.argv.splice(2, 1)[0];
  require(cli);
}
