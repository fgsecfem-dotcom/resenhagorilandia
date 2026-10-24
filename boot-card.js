// Tela de carregamento com o card da sala que vai abrir (igual ao de "Minhas salas", com a capa do grupo).
// Roda logo depois do #boot no HTML, antes da primeira pintura. Os dados vêm de client.js (rememberRoomCard).
(function () {
  try {
    if (!document.documentElement.classList.contains('booting')) return;
    const get = (k) => { try { return JSON.parse(localStorage.getItem('resenha.' + k)); } catch { return null; } };
    const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = norm(get('favoriteRoom') || get('lastRoom')?.code);
    const card = code && get('card.' + code);
    const boot = document.getElementById('boot');
    if (!card || !boot) return;
    const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const safeImg = (v) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(v || '')) ? v : '';
    const cover = safeImg(card.cover), iconImg = safeImg(card.icon), color = /^#[0-9a-f]{6}$/i.test(card.color) ? card.color : '#6a4bb3';
    const initials = String(card.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    boot.classList.add('with-card');
    boot.innerHTML = `<div class="boot-card${cover ? ' has-cover' : ''}" style="--room-color:${color}${cover ? `;--room-cover:url('${cover}')` : ''}">
      <div class="boot-art">${iconImg ? `<img src="${iconImg}" alt="">` : `<span>${esc(initials)}</span>`}</div>
      <div class="boot-info"><h2 id="boot-name">Entrando no ${esc(card.name)}…</h2><p id="boot-status">${esc(card.about || '')}</p>
      <span class="boot-dots" aria-hidden="true"><i></i><i></i><i></i></span></div></div>`;
  } catch {}
})();
