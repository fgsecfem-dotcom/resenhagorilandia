// Resenha · animações no estilo Apple TV: molas e troca de layout fluida (FLIP).
// Roda mesmo com "Efeitos de animação" desligado no Windows: são curtas e só movem camadas.
// Só anima translate/scale/rotate/opacity, que a placa de vídeo compõe sem repintar a tela.
// Padrão de movimento (2.6): uma curva só (ease-out forte) e durações curtas por tipo de ação.
// Anima só o que explica algo (de onde veio, para onde foi); o que se usa o dia todo é rápido.
(() => {
  // Mola amortecida (resposta em segundos, fração de amortecimento < 1 dá um leve "passar do ponto").
  function spring(response = 0.42, damping = 0.8) {
    const w0 = (2 * Math.PI) / response, z = damping, wd = w0 * Math.sqrt(1 - z * z);
    const at = (t) => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    let dur = 0.1; while (dur < 3 && (Math.abs(1 - at(dur)) > 0.001 || Math.abs(1 - at(dur + 0.05)) > 0.001)) dur += 1 / 60;
    const samples = []; for (let t = 0; t <= dur; t += 1 / 60) samples.push(at(t)); samples.push(1);
    return { at, dur: dur * 1000, samples, css: `linear(${samples.map((v) => +v.toFixed(4)).join(', ')})` };
  }
  // Curva padrão para tudo que entra ou sai: começa rápido, então a tela reage na hora.
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const DUR = { click: 120, menu: 150, exit: 200, window: 250, layout: 350 };
  Object.assign(DUR, { press: DUR.click, modal: DUR.window, enter: DUR.window });
  // Mudança de layout (quadros da call, gaveta do chat, tela cheia): mola sem quique, ~350 ms.
  const LAYOUT = spring(0.3, 0.95);
  // "Reduzir animações": a opção do app (Configurações > Aparência) ou a do sistema. Tudo muda na hora.
  const osCalm = matchMedia('(prefers-reduced-motion: reduce)');
  let preference = 'auto';
  const calm = () => preference === true || (preference !== false && osCalm.matches);
  function setPreference(mode) {
    preference = typeof mode === 'boolean' ? mode : 'auto';
    const classes = document.documentElement.classList;
    classes.toggle('reduce-motion', calm());
    classes.toggle('motion-full', preference === false);
    window.dispatchEvent?.(new Event('resenha-reduce-motion'));
  }
  osCalm.addEventListener('change', () => { if (preference === 'auto') setPreference('auto'); });
  const root = document.documentElement.style;
  root.setProperty('--ease-out', EASE);
  for (const [k, v] of Object.entries(DUR)) root.setProperty('--dur-' + k, v + 'ms');
  root.setProperty('--spring-press', EASE); root.setProperty('--spring-press-dur', DUR.press + 'ms');

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
      if (!F || !F.width) { // quadrado novo: surge crescendo de leve (nunca do zero)
        t.animate([{ opacity: 0, scale: '0.94' }, { opacity: 1, scale: '1' }], { duration: DUR.enter, easing: EASE });
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

  // ---------- Janelas e menus: crescem de leve a partir do ponto clicado e somem rápido ----------
  let origin = null;
  addEventListener('pointerdown', (e) => { origin = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
  const fresh = () => (origin && performance.now() - origin.t < 900 ? origin : null);
  // Ponto de origem da escala: onde a pessoa clicou, preso dentro do próprio elemento.
  function originOf(el) {
    const o = fresh(), r = el.getBoundingClientRect();
    if (!o || !r.width) return '50% 50%';
    const x = Math.max(0, Math.min(r.width, o.x - r.left)), y = Math.max(0, Math.min(r.height, o.y - r.top));
    return `${Math.round(x)}px ${Math.round(y)}px`;
  }
  // Entra de 96% (nunca do zero) com opacidade; sai para 98% mais rápido do que entrou.
  function popEnter(el, duration, from = 0.96) {
    if (calm()) return;
    el.getAnimations().forEach((a) => a.cancel());
    const transformOrigin = originOf(el);
    el.animate([{ opacity: 0, scale: String(from), transformOrigin }, { opacity: 1, scale: '1', transformOrigin }], { duration, easing: EASE });
  }
  function popExit(el, duration, done) {
    if (calm()) return done();
    el.getAnimations().forEach((a) => a.cancel());
    const a = el.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.98' }], { duration, easing: EASE, fill: 'forwards' });
    a.onfinish = done; a.oncancel = done;
  }

  // Janelas (#modal-root): o fundo escurece e a janela cresce de leve a partir do clique.
  function watchModals() {
    const rootEl = document.getElementById('modal-root'); if (!rootEl) return;
    new MutationObserver((list) => {
      for (const m of list) for (const ov of m.addedNodes) {
        if (!ov.classList?.contains('overlay')) continue;
        const modal = ov.querySelector(':scope > .modal'); if (!modal) continue;
        if (!calm()) ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.modal, easing: EASE });
        popEnter(modal, DUR.modal);
      }
    }).observe(rootEl, { childList: true });
  }
  function closeOverlay(ov) {
    if (ov.__closing) return; ov.__closing = true;
    const modal = ov.querySelector(':scope > .modal');
    if (!modal || !ov.isConnected || calm()) return ov.remove();
    ov.style.pointerEvents = 'none';
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.exit, easing: EASE, fill: 'forwards' });
    const end = () => ov.remove();
    popExit(modal, DUR.exit, end); setTimeout(end, DUR.exit + 150);
  }

  // Card do perfil e menus (#ctx-menu): usados o tempo todo, então são rápidos e sem etapas.
  function popIn(menu) { popEnter(menu, DUR.menu); }
  function popOut(menu, done) {
    if (menu.classList.contains('hidden')) return done();
    popExit(menu, DUR.exit, done);
  }

  // ---------- Conteúdo entrando em etapas (como a página do Apple TV: imagem, título, depois botões) ----------
  // Sequência curta: no máximo 6 itens visíveis, 40 ms entre eles (a sequência toda fica perto de 400 ms).
  function stagger(els, { start = 0, step = 40, dy = 8, max = 6, duration = DUR.enter } = {}) {
    if (calm()) return;
    els.filter((el) => el && el.isConnected && el.offsetParent !== null).slice(0, max).forEach((el, i) => {
      el.animate([{ opacity: 0, translate: `0 ${dy}px` }, { opacity: 1, translate: '0 0' }],
        { duration, delay: start + i * step, easing: EASE, fill: 'backwards' });
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
    setTimeout(() => d.remove(), DUR.layout + DUR.menu + 800);
    return DUR.layout - 100; // as colunas da sala aparecem enquanto a camada some
  }
  function grow(d, r, sx, sy) {
    const a = d.animate([{ translate: `${r.left}px ${r.top}px`, scale: `${sx} ${sy}`, borderRadius: '20px' }, { translate: '0px 0px', scale: '1 1', borderRadius: '0px' }], { duration: DUR.layout, easing: EASE, fill: 'forwards' });
    a.onfinish = () => { const b = d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.menu, easing: EASE, fill: 'forwards' }); b.onfinish = () => d.remove(); };
  }
  function enterRoom() {
    const q = (s) => document.querySelector(s), base = expandFromCard();
    // Três colunas, da esquerda para a direita (sem item por item: entrar na sala é coisa de todo dia).
    stagger([q('#sidebar'), q('#call'), q('#chat')], { start: base });
  }
  function enterHome() {
    const h = document.getElementById('home');
    stagger([...kids(h, '.home-brand, .home-main > .card, .home-main > section, .home-side > *')]);
  }
  function watchScreens() {
    for (const [id, fn] of [['main', enterRoom], ['home', enterHome]]) {
      const el = document.getElementById(id); if (!el) continue;
      let hidden = el.classList.contains('hidden');
      new MutationObserver(() => { const h = el.classList.contains('hidden'); if (hidden && !h) requestAnimationFrame(fn); hidden = h; }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // ---------- Destaque deslizante (dock e abas): uma pílula que corre até o item, com mola ----------
  root.setProperty('--spring-move', EASE); root.setProperty('--spring-move-dur', DUR.modal + 'ms');
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
        if (open === 'true' && chat) chat.animate([{ translate: '48px 0', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: DUR.layout, easing: EASE });
      });
    }).observe(main, { attributes: true, attributeFilter: ['data-right-open'] });
    const list = document.getElementById('msg-list'); if (!list) return;
    new MutationObserver((muts) => {
      if (calm() || open !== 'true') return;
      const added = muts.flatMap((m) => [...m.addedNodes]).filter((n) => n.nodeType === 1);
      if (!added.length || added.length > 3) return; // histórico carregando: entra direto
      stagger(added, { step: 40, dy: 4, duration: DUR.menu }); // mensagem nova: surge em 150 ms, sem quicar
    }).observe(list, { childList: true });
  }

  // ---------- Live em miniatura: o quadro segue a proporção da tela transmitida (sem barras pretas) ----------
  function liveRatio(e) {
    const v = e.target; if (v?.tagName !== 'VIDEO' || !v.videoWidth || !v.videoHeight) return;
    const t = v.closest('.tile.is-screen'); if (!t) return;
    t.style.setProperty('--live-ar', `${v.videoWidth} / ${v.videoHeight}`); t.style.setProperty('--live-arn', String(v.videoWidth / v.videoHeight)); // a forma numérica entra em calc()
  }
  document.addEventListener('loadedmetadata', liveRatio, true); document.addEventListener('resize', liveRatio, true);

  window.resenhaMotion = { spring, capture, closeOverlay, popIn, popOut, stagger, EASE, DUR, calm, setPreference };

  // Cada parte liga sozinha: se uma falhar, as outras animações continuam (o erro fica em window.__motionErrors).
  const safe = (name, fn) => { try { fn(); } catch (e) { (window.__motionErrors ||= []).push(name + ': ' + e.message); console.error('[motion]', name, e); } };
  function start() {
    safe('janelas', watchModals); safe('telas', watchScreens); safe('destaque', watchSliders); safe('chat', watchChat);
    safe('inicio', () => { if (!document.getElementById('home')?.classList.contains('hidden')) requestAnimationFrame(enterHome); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
