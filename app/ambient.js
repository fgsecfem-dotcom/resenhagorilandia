// Resenha · "fundo vivo" (2.6): a luz de fundo da sala vem do que está acontecendo na call, como a capa do álbum no Apple Music.
// Ordem: tela transmitida > câmera de quem fala > capa da música tocando > nada (fica o grafite neutro do tema).
// Barato de propósito: desenha a fonte num canvas de 16x9 duas vezes por segundo e o CSS só amplia (sem blur ao vivo).
(() => {
  const W = 16, H = 9, TICK = 500, MIX = 0.22; // MIX: quanto de cada leitura nova entra (a troca de cor leva ~2 s)
  const THEMES = /^vidro$/;
  let canvas = null, ctx = null, timer = 0, lit = false;

  // Quem ilumina a sala agora (o primeiro que tiver imagem pronta).
  function source(doc = document) {
    const ready = (v) => v && v.videoWidth > 0 && !v.paused;
    const screen = doc.querySelector('#call .tile.is-screen video');
    if (ready(screen)) return screen;
    const cam = doc.querySelector('#call .tile.speaking video');
    if (ready(cam)) return cam;
    const cover = doc.querySelector('#music-mini:not(.mm-away) .mu-cover, .right-music .mu-cover');
    if (cover && cover.complete && cover.naturalWidth > 0 && cover.getAttribute('src')) return cover;
    return null;
  }
  const active = () => {
    const root = document.documentElement;
    return THEMES.test(root.dataset?.tk || '') && !root.classList.contains('light') && !document.hidden
      && !document.getElementById('main')?.classList.contains('hidden');
  };
  function ensure() {
    const main = document.getElementById('main'); if (!main) return false;
    if (canvas?.isConnected) return true;
    canvas = document.createElement('canvas'); canvas.id = 'ambient'; canvas.width = W; canvas.height = H; canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    ctx.fillStyle = '#141416'; ctx.fillRect(0, 0, W, H);
    main.prepend(canvas);
    return true;
  }
  function tick() {
    if (!active() || !ensure()) { setLit(false); return; }
    const src = source();
    if (!src) { setLit(false); return; }
    try {
      ctx.globalAlpha = lit ? MIX : 1; // primeira leitura entra inteira; depois mistura aos poucos
      ctx.filter = 'blur(1.5px)';
      ctx.drawImage(src, 0, 0, W, H);
      ctx.filter = 'none'; ctx.globalAlpha = 1;
      setLit(true);
    } catch { setLit(false); }
  }
  function setLit(on) { lit = on; canvas?.classList.toggle('lit', on); }
  function start() {
    clearInterval(timer); timer = setInterval(tick, TICK); tick();
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('resenha-theme', tick);
  }
  window.resenhaAmbient = { source, tick, W, H, TICK };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
