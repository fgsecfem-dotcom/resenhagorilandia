// Resenha · animações no estilo Apple TV: molas e troca de layout fluida (FLIP).
// Roda mesmo com "Efeitos de animação" desligado no Windows: são curtas e só movem camadas.
// Só anima translate/scale/rotate/opacity, que a placa de vídeo compõe sem repintar a tela.
(() => {
  // Mola amortecida (resposta em segundos, fração de amortecimento < 1 dá um leve "passar do ponto").
  function spring(response = 0.42, damping = 0.8) {
    const w0 = (2 * Math.PI) / response, z = damping, wd = w0 * Math.sqrt(1 - z * z);
    const at = (t) => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    let dur = 0.1; while (dur < 3 && (Math.abs(1 - at(dur)) > 0.001 || Math.abs(1 - at(dur + 0.05)) > 0.001)) dur += 1 / 60;
    const samples = []; for (let t = 0; t <= dur; t += 1 / 60) samples.push(at(t)); samples.push(1);
    return { at, dur: dur * 1000, samples, css: `linear(${samples.map((v) => +v.toFixed(4)).join(', ')})` };
  }
  const LAYOUT = spring(0.46, 0.86), PRESS = spring(0.24, 0.9);
  // Configurações > Aparência > "Reduzir animações": tudo muda na hora, sem movimento.
  const calm = () => document.documentElement.classList.contains('reduce-motion');
  const root = document.documentElement.style;
  root.setProperty('--spring-press', PRESS.css); root.setProperty('--spring-press-dur', PRESS.dur + 'ms');

  // ---------- FLIP: guarda onde cada quadrado estava e anima até onde ficou ----------
  let lastSig = '', fsAt = -1e9;
  document.addEventListener('fullscreenchange', () => { fsAt = performance.now(); }, true);
  const PARTS = [['.tile-body', '50% 50%', true], ['.label', '0 100%', false], ['.tile-tools', '100% 0', false]];
  function capture(stage, sig) {
    if (!stage || document.fullscreenElement || calm()) { lastSig = sig; return null; }
    const size = stage.clientWidth + 'x' + stage.clientHeight;
    if (sig + size === lastSig) return null; // nada mudou de lugar: não mede nada
    lastSig = sig + size;
    if (performance.now() - fsAt < 200) return null; // a tela cheia tem animação própria

    const first = new Map(), prevMain = stage.querySelector('.focus-main > .tile');
    for (const t of stage.closest('#call')?.querySelectorAll('.tile') || []) {
      if (!t.isConnected) continue;
      first.set(t, t.getBoundingClientRect()); // inclui animação em curso, então interromper fica suave
      t.getAnimations().forEach((a) => a.cancel());
      for (const [sel] of PARTS) t.querySelector(':scope > ' + sel)?.getAnimations().forEach((a) => a.cancel());
    }
    return { play: () => play(stage, first, prevMain) };
  }
  function play(stage, first, prevMain) {
    const frames = LAYOUT.samples, opts = { duration: LAYOUT.dur, easing: 'linear' };
    for (const t of stage.closest('#call')?.querySelectorAll('.tile') || []) {
      const L = t.getBoundingClientRect(); if (!L.width || !L.height) continue;
      const F = first.get(t);
      if (!F || !F.width) { // quadrado novo: surge crescendo
        t.animate(frames.map((p) => ({ opacity: Math.min(1, p * 1.6), scale: String(0.86 + 0.14 * p) })), opts);
        continue;
      }
      // O quadro que entra ou sai da ampliação passa por cima dos outros durante o movimento.
      moveTile(t, F, L, t === prevMain || t.parentElement?.classList.contains('focus-main') ? 4 : 2);
    }
  }
  // Move um quadro de F (onde estava) até L (onde está agora), sem esticar o conteúdo.
  function moveTile(t, F, L, z, curve = LAYOUT) {
    if (calm()) return;
    const frames = curve.samples, opts = { duration: curve.dur, easing: 'linear' };
    const dx = F.left - L.left, dy = F.top - L.top, sx = F.width / L.width, sy = F.height / L.height;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
    const at = (p) => [sx + (1 - sx) * p, sy + (1 - sy) * p];
    const anim = t.animate(frames.map((p) => { const [a, b] = at(p); return { zIndex: z, transformOrigin: '0 0', translate: `${dx * (1 - p)}px ${dy * (1 - p)}px`, scale: `${a} ${b}` }; }), opts);
    if (z >= 4) { t.classList.add('flipping'); const done = () => t.classList.remove('flipping'); anim.onfinish = done; anim.oncancel = done; }
    // Conteúdo sem esticar: avatar e vídeo escalam por igual, nome e botões ficam no tamanho real.
    for (const [sel, origin, uniform] of PARTS) {
      const el = t.querySelector(':scope > ' + sel); if (!el) continue;
      el.animate(frames.map((p) => { const [a, b] = at(p), u = uniform ? Math.min(a, b) : 1; return { transformOrigin: origin, scale: `${u / a} ${u / b}` }; }), opts);
    }
  }

  // ---------- Live em tela cheia: o quadro cresce de onde estava até a tela toda e volta ao sair ----------
  let fullFrom = null, fullEl = null;
  addEventListener('pointerdown', (e) => {
    const t = e.target.closest?.('#call .tile.is-screen'); if (!t || document.fullscreenElement) return;
    fullFrom = { el: t, rect: t.getBoundingClientRect(), W: innerWidth, H: innerHeight, t: performance.now() };
  }, true);
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(() => {
    const el = document.fullscreenElement;
    if (el?.classList?.contains('tile')) { // entrou: cresce a partir do lugar antigo (ajustado ao novo tamanho da janela)
      fullEl = el;
      const f = fullFrom; fullFrom = null;
      if (!f || f.el !== el || performance.now() - f.t > 3000) return;
      const kx = innerWidth / f.W, ky = innerHeight / f.H, r = f.rect;
      moveTile(el, { left: r.left * kx, top: r.top * ky, width: r.width * kx, height: r.height * ky }, el.getBoundingClientRect(), 4);
    } else if (!el && fullEl) { // saiu: encolhe da tela toda de volta ao quadro
      const t = fullEl; fullEl = null;
      if (!t.isConnected) return;
      moveTile(t, { left: 0, top: 0, width: innerWidth, height: innerHeight }, t.getBoundingClientRect(), 6);
    }
  }));

  // ---------- Janelas e card do perfil: nascem de onde você clicou e voltam para lá ao fechar ----------
  const OPEN = spring(0.42, 0.86), CLOSE = spring(0.3, 0.99), POP = spring(0.32, 0.84);
  let origin = null;
  const TARGETS = 'button, [role=button], .channel, .tile, .vu, .ou, .msg .author, .msg .avatar, .server-dot, .ctx-item, .friend-row, .code-chip, .vc-card';
  addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(TARGETS);
    origin = { x: e.clientX, y: e.clientY, rect: el?.getBoundingClientRect(), t: performance.now() };
  }, true);
  const fresh = () => (origin && performance.now() - origin.t < 900 ? origin : null);

  // Quanto deslocar e encolher el para que ele pareça sair do elemento clicado (escala igual nos dois eixos: nada estica).
  function fromOrigin(el, o, minScale) {
    const r = el.getBoundingClientRect();
    if (!o || !r.width) return { dx: 0, dy: 14, s: 0.94 };
    const src = o.rect?.width ? o.rect : { left: o.x - 16, top: o.y - 16, width: 32, height: 32 };
    const s = Math.max(minScale, Math.min(0.92, Math.min(src.width / r.width, src.height / r.height)));
    return { dx: src.left + src.width / 2 - (r.left + r.width / 2), dy: src.top + src.height / 2 - (r.top + r.height / 2), s };
  }
  function zoomIn(el, from, curve) {
    if (calm()) return;
    el.getAnimations().forEach((a) => a.cancel());
    const { dx, dy, s } = from;
    el.animate(curve.samples.map((p) => ({ translate: `${dx * (1 - p)}px ${dy * (1 - p)}px`, scale: String(s + (1 - s) * p), opacity: Math.min(1, p * 2.4) })), { duration: curve.dur, easing: 'linear' });
  }
  function zoomOut(el, from, done) {
    if (calm()) return done();
    const { dx, dy, s } = from || { dx: 0, dy: 14, s: 0.94 };
    const a = el.animate(CLOSE.samples.map((p) => ({ translate: `${dx * p}px ${dy * p}px`, scale: String(1 - (1 - s) * p), opacity: Math.max(0, 1 - p * 1.5) })), { duration: CLOSE.dur, easing: 'linear', fill: 'forwards' });
    a.onfinish = done;
  }

  // Janelas (#modal-root): o fundo escurece em 0,2 s e a janela cresce a partir do botão clicado.
  function watchModals() {
    const rootEl = document.getElementById('modal-root'); if (!rootEl) return;
    new MutationObserver((list) => {
      for (const m of list) for (const ov of m.addedNodes) {
        if (!ov.classList?.contains('overlay')) continue;
        const modal = ov.querySelector(':scope > .modal'); if (!modal) continue;
        ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
        ov.__from = fromOrigin(modal, fresh(), 0.42);
        zoomIn(modal, ov.__from, OPEN);
      }
    }).observe(rootEl, { childList: true });
  }
  function closeOverlay(ov) {
    if (ov.__closing) return; ov.__closing = true;
    const modal = ov.querySelector(':scope > .modal');
    if (!modal || !ov.isConnected) return ov.remove();
    ov.style.pointerEvents = 'none';
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE.dur, easing: 'ease-in', fill: 'forwards' });
    const end = () => ov.remove();
    zoomOut(modal, ov.__from, end); setTimeout(end, CLOSE.dur + 250);
  }

  // Card do perfil e menus (#ctx-menu): saem do nome ou avatar clicado e somem rápido.
  let menuFrom = null;
  function popIn(menu) { menuFrom = fromOrigin(menu, fresh(), 0.3); zoomIn(menu, menuFrom, POP); }
  function popOut(menu, done) {
    if (menu.classList.contains('hidden') || calm()) return done();
    menu.getAnimations().forEach((a) => a.cancel());
    const { dx, dy, s } = menuFrom || { dx: 0, dy: 0, s: 0.94 }, k = 0.35; // volta só um pouco na direção do clique
    const a = menu.animate([{ opacity: 1 }, { opacity: 0, translate: `${dx * k}px ${dy * k}px`, scale: String(1 - (1 - s) * k) }], { duration: 140, easing: 'ease-in' });
    a.onfinish = () => { done(); };
  }

  // ---------- Conteúdo entrando em etapas (como a página do Apple TV: imagem, título, depois botões) ----------
  const RISE = spring(0.5, 0.88);
  function stagger(els, { start = 0, step = 32, dy = 10, max = 14 } = {}) {
    if (calm()) return;
    els.filter((el) => el && el.isConnected && el.offsetParent !== null).slice(0, max).forEach((el, i) => {
      el.animate(RISE.samples.map((p) => ({ opacity: Math.min(1, Math.max(0, p * 1.3)), translate: `0 ${dy * (1 - p)}px` })),
        { duration: RISE.dur, delay: start + i * step, easing: 'linear', fill: 'backwards' });
    });
  }
  const kids = (root, sel) => (root ? [...root.querySelectorAll(sel)] : []);
  // Card que vira a sala: uma camada com a cor da sala cresce do card clicado até a janela e some revelando a sala.
  let cameFrom = null;
  addEventListener('pointerdown', (e) => {
    const c = e.target.closest?.('#home .saved-room, #sidebar .server-dot:not(.ghost)'); if (!c) return;
    const cs = getComputedStyle(c);
    cameFrom = { rect: c.getBoundingClientRect(), color: (cs.getPropertyValue('--room-color') || cs.getPropertyValue('--dot')).trim() || '#6a4bb3', t: performance.now() };
    // Abrir uma sala salva pode levar alguns segundos: o card "respira" até a sala aparecer.
    if (c.classList.contains('saved-room')) { document.querySelectorAll('#home .saved-room.opening').forEach((x) => x.classList.remove('opening')); c.classList.add('opening'); setTimeout(() => c.classList.remove('opening'), 20000); }
  }, true);
  function expandFromCard() {
    const f = cameFrom; cameFrom = null; document.querySelectorAll('#home .saved-room.opening').forEach((x) => x.classList.remove('opening'));
    if (!f || performance.now() - f.t > 20000 || !f.rect.width || calm()) return 0; // abrir a sala pode levar alguns segundos
    const d = document.createElement('div'); d.className = 'm-expand';
    d.style.background = `color-mix(in srgb, ${f.color} 45%, var(--bg-rail))`; document.body.append(d);
    const W = innerWidth, H = innerHeight, r = f.rect, sx = r.width / W, sy = r.height / H;
    // Fica parada sobre o card enquanto o app monta a sala (quadro pesado) e só depois começa a crescer.
    d.style.translate = `${r.left}px ${r.top}px`; d.style.scale = `${sx} ${sy}`;
    requestAnimationFrame(() => requestAnimationFrame(() => grow(d, r, sx, sy)));
    setTimeout(() => d.remove(), LAYOUT.dur + 1100);
    return LAYOUT.dur * 0.7 + 40; // a sala entra em etapas quando a camada começa a sumir
  }
  function grow(d, r, sx, sy) {
    const a = d.animate(LAYOUT.samples.map((p) => ({ translate: `${r.left * (1 - p)}px ${r.top * (1 - p)}px`, scale: `${sx + (1 - sx) * p} ${sy + (1 - sy) * p}`, borderRadius: `${20 * (1 - p)}px` })), { duration: LAYOUT.dur, easing: 'linear', fill: 'forwards' });
    a.onfinish = () => { const b = d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' }); b.onfinish = () => d.remove(); };
  }
  function enterRoom() {
    const q = (s) => document.querySelector(s), base = expandFromCard();
    stagger([q('#sidebar .server-row'), q('#sidebar .side-brand'), q('#sidebar .side-actions'), ...kids(q('#sidebar #channels'), '.cat, .channel'), q('#sidebar #user-panel')], { start: base, step: 26 });
    stagger([q('#call .pane-header'), ...kids(q('#call-stage'), '.tile, .vc-card'), q('#call-controls')], { start: base + 90, step: 40, dy: 14 });
    stagger([q('#chat .right-nav'), q('#chat .pane-header'), q('#chat #composer')], { start: base + 140, step: 40 });
  }
  function enterHome() {
    const h = document.getElementById('home');
    stagger([...kids(h, '.home-brand, .home-main > .card, .home-main > section, .home-side > *')], { step: 45, dy: 14 });
  }
  function watchScreens() {
    for (const [id, fn] of [['main', enterRoom], ['home', enterHome]]) {
      const el = document.getElementById(id); if (!el) continue;
      let hidden = el.classList.contains('hidden');
      new MutationObserver(() => { const h = el.classList.contains('hidden'); if (hidden && !h) requestAnimationFrame(fn); hidden = h; }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
  }
  const modalParts = (modal) => [modal.querySelector(':scope > header'), ...kids(modal, ':scope > .body > *, :scope > nav, :scope > .tabs'), modal.querySelector(':scope > footer')];
  const menuParts = (menu) => [...kids(menu, '.pcard-banner, .pcard-av, .pcard-body > *'), ...kids(menu, ':scope > *:not(.pcard)')];

  // ---------- Destaque deslizante (dock e abas): uma pílula que corre até o item, com mola ----------
  const MOVE = spring(0.38, 0.82);
  root.setProperty('--spring-move', MOVE.css); root.setProperty('--spring-move-dur', MOVE.dur + 'ms');
  function slider(box, { items, active, hover = false, kind }) {
    if (!box || box.__slider) return; box.__slider = true;
    const pill = document.createElement('span'); pill.className = 'm-slider m-slider-' + kind; pill.setAttribute('aria-hidden', 'true');
    box.classList.add('has-slider'); box.prepend(pill);
    let over = null, placed = false;
    const place = () => {
      const el = (hover && over?.isConnected ? over : null) || (active ? box.querySelector(active) : null);
      if (!el || !el.offsetWidth) { pill.style.opacity = '0'; return; }
      if (!placed) pill.style.transition = 'none'; // primeira vez: aparece já no lugar
      pill.style.opacity = '1';
      if (kind === 'tabs') { // abas (2.2): um traço fino que desliza sob a aba ativa, em vez de pílula
        const w = Math.max(16, el.offsetWidth - 24);
        pill.style.width = w + 'px'; pill.style.height = '2px';
        pill.style.transform = `translate(${el.offsetLeft + (el.offsetWidth - w) / 2}px, ${el.offsetTop + el.offsetHeight - 2}px)`;
      } else {
        pill.style.width = el.offsetWidth + 'px'; pill.style.height = el.offsetHeight + 'px';
        pill.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
      }
      if (!placed) { pill.offsetWidth; pill.style.transition = ''; placed = true; }
    };
    if (hover) {
      box.addEventListener('pointerover', (e) => { const it = e.target.closest(items); if (it && box.contains(it) && it !== over) { over = it; place(); } });
      box.addEventListener('pointerleave', () => { over = null; if (!active) placed = false; place(); });
    }
    new MutationObserver(() => requestAnimationFrame(place)).observe(box, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed'], childList: true });
    new ResizeObserver(() => { placed = false; place(); }).observe(box);
    requestAnimationFrame(place);
  }
  function watchSliders() {
    const nav = () => slider(document.querySelector('#chat .right-nav'), { items: 'button:not(.right-close)', active: 'button[aria-pressed=true]:not(.right-close)', kind: 'tabs' });
    nav(); setTimeout(nav, 1500); // a barra do chat é criada pelo room-ui.js
    new MutationObserver((list) => { for (const m of list) for (const ov of m.addedNodes) ov.querySelectorAll?.('.tabs').forEach((t) => slider(t, { items: '.tab', active: '.tab.active', kind: 'tabs' })); })
      .observe(document.getElementById('modal-root'), { childList: true });
  }

  // ---------- Chat: a gaveta entra com mola, a call se reajusta suavemente e mensagens novas deslizam ----------
  let chatFrom = null;
  addEventListener('pointerdown', (e) => {
    if (!e.target.closest?.('#btn-chat-toggle, #call .chat-toggle, #chat .right-close')) return;
    chatFrom = { t: performance.now(), tiles: new Map([...document.querySelectorAll('#call .tile')].map((t) => [t, t.getBoundingClientRect()])) };
  }, true);
  function watchChat() {
    const main = document.getElementById('main'); if (!main) return;
    let open = main.dataset.rightOpen;
    new MutationObserver(() => {
      if (main.dataset.rightOpen === open) return; open = main.dataset.rightOpen;
      const f = chatFrom; chatFrom = null;
      if (calm() || !f || performance.now() - f.t > 1000 || main.classList.contains('hidden')) return;
      requestAnimationFrame(() => {
        for (const [t, F] of f.tiles) if (t.isConnected) moveTile(t, F, t.getBoundingClientRect(), 2);
        const chat = document.getElementById('chat');
        if (open === 'true' && chat) chat.animate(LAYOUT.samples.map((p) => ({ translate: `${48 * (1 - p)}px 0`, opacity: Math.min(1, p * 1.8) })), { duration: LAYOUT.dur, easing: 'linear' });
      });
    }).observe(main, { attributes: true, attributeFilter: ['data-right-open'] });
    const list = document.getElementById('msg-list'); if (!list) return;
    new MutationObserver((muts) => {
      if (calm() || open !== 'true') return;
      const added = muts.flatMap((m) => [...m.addedNodes]).filter((n) => n.nodeType === 1);
      if (!added.length || added.length > 3) return; // histórico carregando: entra direto
      stagger(added, { step: 40, dy: 8 });
    }).observe(list, { childList: true });
  }

  // ---------- Live em miniatura: o quadro segue a proporção da tela transmitida (sem barras pretas) ----------
  function liveRatio(e) {
    const v = e.target; if (v?.tagName !== 'VIDEO' || !v.videoWidth || !v.videoHeight) return;
    v.closest('.tile.is-screen')?.style.setProperty('--live-ar', `${v.videoWidth} / ${v.videoHeight}`);
  }
  document.addEventListener('loadedmetadata', liveRatio, true); document.addEventListener('resize', liveRatio, true);

  const popInMenu = popIn;
  function popInStaged(menu) { popInMenu(menu); stagger(menuParts(menu), { start: 40, step: 26, dy: 8, max: 12 }); }
  window.resenhaMotion = { spring, capture, closeOverlay, popIn: popInStaged, popOut, stagger };

  // Cada parte liga sozinha: se uma falhar, as outras animações continuam (o erro fica em window.__motionErrors).
  const safe = (name, fn) => { try { fn(); } catch (e) { (window.__motionErrors ||= []).push(name + ': ' + e.message); console.error('[motion]', name, e); } };
  function start() {
    safe('janelas', watchModals); safe('telas', watchScreens); safe('destaque', watchSliders); safe('chat', watchChat);
    safe('inicio', () => { if (!document.getElementById('home')?.classList.contains('hidden')) requestAnimationFrame(enterHome); });
    safe('etapas', () => new MutationObserver((list) => { for (const m of list) for (const ov of m.addedNodes) { const md = ov.querySelector?.(':scope > .modal'); if (md) stagger(modalParts(md), { start: 70, step: 30, max: 10 }); } })
      .observe(document.getElementById('modal-root'), { childList: true }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
