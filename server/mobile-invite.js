async function createMobileInvite({ ips, httpsPort, fingerprint, port, QRCode }) {
  return {httpsPort,fingerprint,links:await Promise.all(ips.map(async ip=>{const url=`https://${ip}:${httpsPort}/`;return {url,certificate:`http://${ip}:${port}/resenha-local.cer`,setup:`http://${ip}:${port}/mobile-setup`,qr:await QRCode.toDataURL(`http://${ip}:${port}/mobile-setup`,{width:240,margin:2})}}))};
}
module.exports = { createMobileInvite };
