// Resenha PWA · instala o service worker e avisa quando há versão nova ("toque para atualizar").
'use strict';
(() => {
  if (!('serviceWorker' in navigator)) return;
  const showUpdate = (reg) => {
    if (document.getElementById('pwa-update')) return;
    const b = document.createElement('button');
    b.id = 'pwa-update'; b.textContent = 'Nova versão do Resenha · toque para atualizar';
    b.onclick = () => { b.disabled = true; b.textContent = 'Atualizando…'; reg.waiting?.postMessage('atualizar'); };
    document.body.appendChild(b);
  };
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
  navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(reg); });
    });
    // Procura versão nova ao voltar para o app e a cada 30 minutos.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    // Primeira visita: a página só passa pelo service worker depois de recarregar uma vez (fotos e anexos dependem dele).
    if (!navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(() => { if (!navigator.serviceWorker.controller && !sessionStorage.getItem('pwa-reloaded')) { sessionStorage.setItem('pwa-reloaded', '1'); location.reload(); } });
  }).catch((e) => console.warn('[pwa] service worker', e));
})();
