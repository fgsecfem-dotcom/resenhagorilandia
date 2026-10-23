// Resenha 2.1 · ícone "Pipoquinha": um floco de pipoca com carinha. A variação muda só a cor do fundo.
// Usado no logo da interface e para gerar o ícone da janela, da barra de tarefas e dos atalhos (Configurações > Aparência).
(() => {
  const VARIANTS = {
    quentinha: { name: 'Quentinha', top: '#ffb36b', bottom: '#e0533a' },
    noturna: { name: 'Noturna', top: '#7c5cc4', bottom: '#2a1d52' },
    menta: { name: 'Menta', top: '#5eead4', bottom: '#0f766e' },
    ceu: { name: 'Céu', top: '#7dd3fc', bottom: '#1d4ed8' },
    chiclete: { name: 'Chiclete', top: '#f9a8d4', bottom: '#be185d' },
    grafite: { name: 'Grafite', top: '#4b4b55', bottom: '#111216' },
  };
  function pipocaSVG(key = 'quentinha', size = 84) {
    const v = VARIANTS[key] || VARIANTS.quentinha, id = 'pq-' + key;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84" width="${size}" height="${size}">`
      + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${v.top}"/><stop offset="1" stop-color="${v.bottom}"/></linearGradient></defs>`
      + `<rect width="84" height="84" rx="20" fill="url(#${id})"/>`
      + '<g fill="#fff8ee"><circle cx="31" cy="38" r="11"/><circle cx="44" cy="30" r="13"/><circle cx="55" cy="40" r="11"/><circle cx="42" cy="46" r="12"/></g>'
      + '<circle cx="40" cy="36" r="2.2" fill="#2b1a12"/><circle cx="49" cy="36" r="2.2" fill="#2b1a12"/>'
      + '<path d="M41 42q3.5 3 7 0" stroke="#2b1a12" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  }
  const dataURL = (key, size) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pipocaSVG(key, size));

  // PNGs nos tamanhos que o Windows e o Mac usam (gerados no próprio app, sem arquivos extras).
  async function rasterize(key, sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512]) {
    const img = new Image(); img.src = dataURL(key, 1024); await img.decode();
    const out = {};
    for (const s of sizes) {
      const c = document.createElement('canvas'); c.width = c.height = s;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, s, s);
      out[s] = c.toDataURL('image/png');
    }
    return out;
  }

  // Troca os logos da interface (barra lateral, tela inicial, carregamento, favicon).
  function applyLogo(key) {
    const url = dataURL(key, 128);
    document.querySelectorAll('.side-brand > img, .home-logo img, .home-tip img, #boot img, #rail-home img').forEach((img) => { img.src = url; });
    const fav = document.querySelector('link[rel=icon]'); if (fav) fav.href = url;
  }

  window.PIPOCA = { VARIANTS, pipocaSVG, dataURL, rasterize, applyLogo };
})();
