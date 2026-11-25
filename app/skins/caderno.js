// Caderno: sala própria inspirada nos manuscritos de Pentiment.
(() => {
  const I = (n, s = 20) => window.icon(n, s);
  const INK = "#2B211B", RED = "#A82A1E", BLUE = "#2F4C8F", GOLD = "#C9962B", PG = "#EFE6D2";
  // ---------- peças desenhadas ----------
  const hand = (w = 40) => `<svg class="cd-hand" width="${w}" height="${w / 2}" viewBox="0 0 40 20" fill="${PG}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"><rect x="1" y="5" width="7" height="10" rx="1"/><path d="M3 5v10M5.5 5v10" stroke-width=".7"/><path d="M8 6h8.5q3 0 3 3v3q0 3-3 3H8z"/><rect x="17" y="6.2" width="21" height="4.2" rx="2.1"/><path d="M11 6q2-3.6 6.5-2.2" fill="none"/><path d="M12 10.6h6M12 13h6" stroke-width=".7"/></svg>`;
  const seal = (icon, size = 62) => {
    const pts = Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2, r = 29 + (i % 2 ? 1.6 : -0.4) + Math.sin(i * 2.7) * 1.1; return `${(32 + r * Math.cos(a)).toFixed(1)},${(32 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><polygon points="${pts}" fill="${RED}"/><circle cx="32" cy="32" r="21" fill="none" stroke="#7d1b13" stroke-width="2.4"/><circle cx="32" cy="32" r="21" fill="none" stroke="#c9483a" stroke-width=".8" transform="translate(-.8 -.8)"/><path d="M14 20q4-6 10-8" stroke="#d65a4b" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/><g transform="translate(22 22)" color="#fbe9dc">${icon}</g></svg>`;
  };
  const quill = `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 23 L13 13"/><path d="M8 18 C6 10 12 2 24 2 C23 12 16 19 8 18Z" fill="${PG}"/><path d="M10 16 C13 12 17 8 21 5" stroke-width=".8"/><path d="M12 11l-3-1M15 8l-3-1.2M14 13l3 .8M17 10l3 .8" stroke-width=".7"/></svg>`;
  // roseta de flor e ramos de acanto (margens)
  const flower = (x, y, c, r = 4) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(r * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(r * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="${r * 0.62}" fill="${c}" stroke="${INK}" stroke-width=".7"/>`).join('')}<circle r="${r * 0.5}" fill="${GOLD}" stroke="${INK}" stroke-width=".7"/></g>`;
  const leaf = (x, y, a, c, L = 16) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 0 C${L * 0.3} ${-L * 0.42} ${L * 0.8} ${-L * 0.36} ${L} 0 C${L * 0.8} ${L * 0.22} ${L * 0.3} ${L * 0.3} 0 0Z" fill="${c}" stroke="${INK}" stroke-width=".8"/><path transform="translate(${x} ${y}) rotate(${a})" d="M2 0 L${L * 0.85} 0" stroke="${INK}" stroke-width=".5"/>`;
  function vine(d, leaves, cols = ['#3f7d5e', RED, BLUE, GOLD]) {
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.1"/>` + leaves.map(([x, y, a, k, t], i) => t === 'f' ? flower(x, y, cols[k % cols.length]) : leaf(x, y, a, cols[k % cols.length])).join('');
  }
  // Pipoca deitada (pelo de cachinhos: círculos com contorno por baixo e sem contorno por cima)
  function pipoca(sleep = false) {
    const cx = 54, cy = 56, rx = 38, ry = 20, n = 10, A0 = Math.PI * 1.02, A1 = Math.PI * 1.86;
    const pt = (a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    let d = `M16 68 C12 62 14 ${cy} ${pt(A0)[0].toFixed(1)} ${pt(A0)[1].toFixed(1)}`;
    for (let i = 0; i < n; i++) { const a = A0 + (A1 - A0) * (i + 0.5) / n, b = A0 + (A1 - A0) * (i + 1) / n, [mx, my] = pt(a), [bx, by] = pt(b), k = 1.16; d += ` Q${(cx + (mx - cx) * k).toFixed(1)} ${(cy + (my - cy) * k).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`; }
    d += ' C96 44 100 56 98 68 Z';
    const W = '#fbf8f2', E = '#efd8bd';
    return `<svg viewBox="0 0 150 84" class="cd-pipoca">
      <path d="M20 52 C8 50 4 38 10 32 C15 28 21 33 18 38" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M20 52 C8 50 4 38 10 32 C15 28 21 33 18 38" fill="none" stroke="${W}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="${d}" fill="${W}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M30 66 C26 56 34 48 44 52" fill="none" stroke="${INK}" stroke-width="1.1"/><path d="M50 44 q4 -3 8 0 M62 42 q4 -3 8 0 M40 46 q4 -3 8 0" fill="none" stroke="#cfc3ad" stroke-width="1"/>
      <rect x="84" y="60" width="38" height="9" rx="4.5" fill="${W}" stroke="${INK}" stroke-width="1.4"/><rect x="80" y="65" width="40" height="9" rx="4.5" fill="${W}" stroke="${INK}" stroke-width="1.4"/>
      <path d="M115 65v3.5M118.5 65v3.5M113 70v3.5M116.5 70v3.5" stroke="${INK}" stroke-width=".9"/>
      <g transform="translate(${sleep ? 106 : 104} ${sleep ? 50 : 40})">
        <circle cx="-2" cy="-12" r="5" fill="${W}" stroke="${INK}" stroke-width="1.3"/><circle cx="5" cy="-13" r="4.5" fill="${W}" stroke="${INK}" stroke-width="1.3"/>
        <ellipse cx="0" cy="0" rx="13" ry="12" fill="${W}" stroke="${INK}" stroke-width="1.5"/><circle cx="1" cy="-8" r="6" fill="${W}"/>
        <path d="M10 -4 C18 -6 26 -4 27 2 C27 7 20 9 11 8Z" fill="${W}" stroke="${INK}" stroke-width="1.4"/>
        <ellipse cx="26" cy="0" rx="3.4" ry="2.8" fill="#4a2c26"/><path d="M18 7 q2 1 5 0" stroke="${INK}" stroke-width="1" fill="none"/>
        ${sleep ? `<path d="M3 -3 q4 3 8 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : `<circle cx="7" cy="-3" r="2.8" fill="#17110f"/><circle cx="8" cy="-4" r=".9" fill="#fff"/><path d="M19 8 q1 7 5 5 q2 -3 -1 -5" fill="#ef7d95" stroke="${INK}" stroke-width="1"/>`}
        <path d="M-6 -9 C-14 -6 -15 8 -9 15 C-5 14 -3 6 -2 -4Z" fill="${E}" stroke="${INK}" stroke-width="1.3"/>
      </g>${sleep ? `<text x="128" y="26" class="cd-z">z</text><text x="136" y="16" class="cd-z" style="animation-delay:-1.2s">z</text>` : ''}</svg>`;
  }
  // Amora sentada de perfil, rabo enrolado na pata
  const amora = () => `<svg viewBox="0 0 70 96" class="cd-amora">
    <path d="M18 92 C8 90 6 72 10 58 C13 47 20 42 22 36 C17 32 16 24 18 16 L17 3 L26 11 C30 10 34 10 38 11 L46 3 L45 17 C47 25 45 32 40 36 C46 44 54 56 54 70 C54 84 48 92 38 92Z" fill="#1d1b24" stroke="${INK}" stroke-width="1.2"/>
    <g class="cd-amora-tail" style="transform-origin:46px 88px"><path d="M44 88 C58 90 66 84 64 72 C63 64 57 62 54 66" fill="none" stroke="#1d1b24" stroke-width="7.5" stroke-linecap="round"/></g>
    <path d="M20 14 L19 6 L25 11Z M44 14 L45 6 L39 11Z" fill="#4a3a48"/>
    <ellipse cx="25" cy="22" rx="3.4" ry="2.9" fill="#e8b93a"/><ellipse cx="38" cy="22" rx="3.4" ry="2.9" fill="#e8b93a"/>
    <rect x="24.3" y="19.6" width="1.4" height="4.8" rx=".7" fill="#141217"/><rect x="37.3" y="19.6" width="1.4" height="4.8" rx=".7" fill="#141217"/>
    <path d="M30 28 l2 2 l2 -2Z" fill="#3a2a30"/>
    <path d="M28 31 L4 28 M28 33 L5 35 M35 31 L60 28 M35 33 L59 35" stroke="#b9b6c8" stroke-width=".8" stroke-linecap="round"/>
    <path d="M24 92 v-14 M33 92 v-14" stroke="#38353f" stroke-width="1"/></svg>`;
  // capitular lombarda com filigrana de pena (vermelho e azul se alternam, como nos manuscritos)
  const initial = (ch, col, size = 66) => {
    const alt = col === RED ? BLUE : RED;
    return `<span class="cd-ini" style="--s:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 66 66"><rect x="5" y="5" width="56" height="56" fill="none" stroke="${alt}" stroke-width=".9"/>
      ${[0, 1, 2, 3].map((k) => `<path d="M${5 + k * 14} 5 q7 -6 14 0 M${5 + k * 14} 61 q7 6 14 0 M5 ${5 + k * 14} q-6 7 0 14 M61 ${5 + k * 14} q6 7 0 14" fill="none" stroke="${alt}" stroke-width=".9"/>`).join('')}
      <path d="M12 12 c6 3 4 10 10 12 M54 54 c-6 -3 -4 -10 -10 -12" fill="none" stroke="${alt}" stroke-width=".9"/><circle cx="12" cy="12" r="1.6" fill="${alt}"/><circle cx="54" cy="54" r="1.6" fill="${alt}"/>
      <text x="33" y="52" text-anchor="middle" font-family="Pirata One" font-size="54" fill="${col}"></text></svg></span>`;
  };

  const wave = `<svg class="cd-wave" width="64" height="14" viewBox="0 0 64 14"><path d="M2 7 q3-6 6 0 t6 0 q3-5 6 0 t6 0 q3-7 6 0 t6 0 q3-4 6 0 t6 0 q2-3 4 0" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/><path d="M60 3l3 3m0-3l-3 3" stroke="${RED}" stroke-width="1.2"/></svg>`;
  const margins = () => `<div class="cd-beasts"><svg class="cd-marg" viewBox="0 0 560 120" preserveAspectRatio="xMidYMax meet">
      ${vine('M10 104 C70 80 120 112 190 98 S310 70 380 92 S500 110 550 84', [[40, 92, -30, 0], [96, 98, 25, 1], [150, 104, -15, 2], [230, 90, -25, 0], [280, 80, 15, 3], [330, 82, -20, 1], [420, 98, 20, 0], [470, 100, -10, 2], [10, 104, 0, 1, 'f'], [550, 84, 0, 2, 'f'], [380, 92, 0, 3, 'f']])}
      <g class="cd-pip" transform="translate(70 20) scale(.98)">${pipoca(true).replace('<svg viewBox="0 0 150 84" class="cd-pipoca">', '<g class="cd-breath">').replace(/<\/svg>$/, '</g>')}</g>
      <g transform="translate(400 -2) scale(1.0)">${amora().replace('<svg viewBox="0 0 70 96" class="cd-amora">', '<g>').replace(/<\/svg>$/, '</g>')}</g></svg></div>`;

  const ease = 'cubic-bezier(.23,1,.32,1)';
  const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const letters = new Intl.Segmenter('pt-BR');
  const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = [BLUE,'#3f6b52','#6b4a2e','#4a3550','#6a532b','#6e393b'];
  let s;
  const txt = (e, v) => { if (e.textContent !== v) e.textContent = v; };
  const attr = (e, k, v) => { if (e.getAttribute(k) !== v) e.setAttribute(k, v); };
  const hide = (e, v) => { if (e.hidden !== v) e.hidden = v; };
  const label = (e, v) => { attr(e, 'aria-label', v); if (e.title !== v) e.title = v; };
  const first = (name) => letters.segment(name).containing(0)?.segment || '?';
  const node = (tag, cls, content = '') => {
    const e = document.createElement(tag); e.className = cls; e.textContent = content;
    if (tag === 'button') e.type = 'button';
    return e;
  };
  const glyph = (e, name, size) => { if (e.dataset.glyph !== name) { e.dataset.glyph = name; e.innerHTML = I(name, size); } };
  const button = (cls, name, art, extra = '', type = 'button') => `<button type="${type}" class="cd-${cls}" aria-label="${name}" title="${name}" ${extra}>${art}</button>`;
  const link = (cls, name = '', w = 29) => `<button type="button" class="cd-link cd-${cls}">${hand(w)}<span>${name}</span></button>`;
  function image(e, value) {
    if (e.dataset.source === (value || '')) return;
    e.dataset.source = value || '';
    let src = '';
    if (/^data:image\/(?:png|jpeg|gif|webp|avif|bmp|svg\+xml|x-icon)[;,]/i.test(value)) src = value;
    else if (value) try {
      const u = new URL(value, location.href);
      if (u.origin === location.origin && /^(https?:|blob:)$/.test(u.protocol)) src = u.href;
      if (location.protocol === 'file:' && (u.href.startsWith(new URL('./', location.href).href) || u.href.startsWith('blob:null/'))) src = u.href;
    } catch { /* Fonte inválida: mantém a inicial. */ }
    hide(e, !src);
    if (src) { e.onerror = () => hide(e, true); e.src = src; } else e.removeAttribute('src');
  }
  const engraving = `<svg class="cd-engraving" viewBox="0 0 320 176" aria-hidden="true"><g fill="none" stroke="#6d5a4b" stroke-width="1.15"><path d="M74 157V79a86 70 0 0 1 172 0v78M82 157V80a78 62 0 0 1 156 0v77M92 157V81a68 53 0 0 1 136 0v76M60 157h200M100 151h120M111 141h98M122 131h76M133 121h54M160 54v57m-28-29h56m-48-20 40 40m0-40-40 40"/><circle cx="160" cy="82" r="21"/><circle cx="160" cy="82" r="17"/></g><path d="m160 64 4 14 14 4-14 4-4 14-4-14-14-4 14-4Z" fill="${GOLD}" stroke="${INK}" stroke-width=".8"/>${vine('M5 154Q39 142 55 158Q64 168 78 157M242 157Q256 168 265 158Q281 142 315 154',[[10,153,0,1,'f'],[29,150,-36,0],[55,158,-58,2],[265,158,-127,2],[291,149,-146,0],[310,153,0,1,'f']])}</svg>`;

  function mount(root, actions) {
    root.innerHTML = `<div class="cd">
      <div class="cd-book"><section class="cd-page cd-left" aria-label="Canal de voz">
        <header class="cd-run"><span class="cd-room-line"></span><i class="cd-date"></i></header>
        <h1 class="cd-title">${initial('', RED)}<span class="cd-title-rest"></span></h1><p class="cd-sub"></p>${link('enter')}
        <div class="cd-seats-wrap"><div class="cd-seats"></div></div>${margins()}<small class="cd-folio">fl. I</small>
      </section><section class="cd-page cd-right" aria-label="Iluminuras e ações da sala">
        <header class="cd-run"><span class="cd-right-heading"></span><div class="cd-tools">
          ${button('room-menu','Menu da sala',`<img alt="" hidden>${I('chevronDown',15)}`,'data-room-menu aria-haspopup="menu"')}
          ${button('invite','Convidar pessoas',I('userPlus',17))}${button('profile','Meu perfil',I('user',17))}${button('settings','Configurações',I('settings',17))}
        </div></header><div class="cd-empty"><div class="cd-empty-content">${engraving}<h2>Iluminuras</h2><p>Nenhuma tela ao vivo por enquanto.</p>${link('empty-action')}</div></div><small class="cd-folio">fl. II</small>
      </section><nav class="cd-ribbons cd-voice" aria-label="Canais de voz">${button('rib cd-home','Sumário',`${hand(16)}<span>Sumário</span>`)}</nav><nav class="cd-ribbons cd-text" aria-label="Canais de texto"></nav></div>
      <section class="cd-exhibit" aria-label="Transmissões da sala" hidden><div class="cd-mat">${amora()}<div class="cd-frame"><div class="cd-picture">
        <video autoplay playsinline muted hidden></video><div class="cd-await">${engraving}${link('watch','Assistir à transmissão',32)}</div>
        <span class="cd-tag">${seal('',16)}<span>Ao vivo</span></span>${button('full','Tela cheia',I('maximize',18),'hidden')}
      </div></div><div class="cd-caption"><div class="cd-live-meta"><strong></strong><i></i><select class="cd-live-list" aria-label="Escolher transmissão" hidden></select></div>
        ${link('view','Ver grande',30)}${link('back','Voltar ao caderno',28)}${button('stop','Parar de assistir','Parar de assistir')}<span class="cd-live-dock"></span>
      </div></div></section>
      <div class="cd-room-dock"><div class="cd-ctl" role="group" aria-label="Controles da call" hidden>
        ${button('b cd-mic','Silenciar microfone',I('mic',19))}${button('b cd-audio','Silenciar áudio',I('headphones',19))}${button('b cd-share','Transmitir tela',I('screen',19))}${button('b cd-dj','Abrir DJ',I('music',19))}${button('seal cd-leave','Sair da call',seal(I('phoneOff',20),58))}
      </div></div><aside class="cd-slip" aria-label="Bilhete da conversa">
        <button class="cd-slip-tab" type="button" aria-controls="cd-note" aria-expanded="false"><span class="cd-fold" aria-hidden="true"></span><span class="cd-slip-title"></span><span class="cd-ln"><span class="cd-preview-hand" hidden>${hand(22)}</span><b></b><span class="cd-preview"></span></span><span class="cd-wax" hidden></span></button>
        <section class="cd-note-p" id="cd-note" aria-label="Conversa da sala" hidden inert><header class="cd-note-head"><span>Conversa da sala</span>${button('close','Dobrar bilhete (Esc)','×')}<nav class="cd-tabs" aria-label="Canais de texto no bilhete"></nav></header>
        <div class="cd-msgs" role="log" aria-label="Mensagens" tabindex="0"><div class="cd-entries"></div></div><form class="cd-comp">${quill}<textarea rows="1" maxlength="4000" aria-label="Mensagem"></textarea>${button('send','Enviar mensagem',I('send',17),'disabled','submit')}</form></section>
      </aside></div>`;
    s = { ui: root.firstElementChild, actions, model: null, open: false, enlarged: false, animations: new Map(), seatsById: new Map(), voices: new Map(), texts: new Map(), tabsById: new Map(), opts: new Map(), messages: new Map(), channels: new Map() };
    s.$ = (q) => s.ui.querySelector(q);
    s.e = {};
    for (const key of ['book','room-line','date','title','title-rest','sub','enter','seats','right-heading','room-menu','invite','profile','settings','empty','empty-action','voice','home','text','exhibit','mat','picture','await','watch','full','live-meta','live-list','view','back','stop','live-dock','room-dock','ctl','mic','audio','share','dj','leave','slip','slip-tab','slip-title','preview-hand','ln','preview','wax','note-p','close','tabs','msgs','entries','comp','send']) s.e[key] = s.$(`.cd-${key}`);
    s.video = s.$('video'); s.video.muted = true;
    s.input = s.$('textarea');
    const e = s.e;
    for (const [k,f] of Object.entries({ 'room-menu': () => actions.roomMenu(e['room-menu']), invite: () => actions.invite(), profile: () => actions.profile(), settings: () => actions.settings(), home: () => actions.home(), enter: () => actions.joinVoice(s.suggested.id), 'empty-action': () => s.model.call.joined && s.model.call.canShare ? actions.toggleShare() : actions.invite(), mic: () => actions.toggleMute(), audio: () => actions.toggleDeafen(), share: () => actions.toggleShare(), dj: () => actions.openDJ(), leave: () => actions.leaveVoice(), watch: () => actions.watch(s.live.uid, true), stop: () => actions.watch(s.live.uid, false), view: () => enlarge(true), back: () => { s.dismissed = s.liveUid; enlarge(false); }, full: fullscreen, 'slip-tab': () => slip(true), close: () => slip(false) })) e[k].onclick = f;
    e['live-list'].onchange = () => { s.liveUid = e['live-list'].value; live(s.model.live); };
    s.video.addEventListener('resize', videoSize);
    s.video.addEventListener('loadedmetadata', videoSize);
    s.video.ondblclick = () => s.enlarged ? fullscreen() : enlarge(true);
    e.comp.onsubmit = (ev) => { ev.preventDefault(); if (s.input.value.trim() && actions.send(s.input.value)) { s.input.value = ''; e.send.disabled = true; } s.input.focus(); };
    s.input.oninput = () => { e.send.disabled = !s.input.value.trim(); };
    s.input.onkeydown = (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); e.comp.requestSubmit(); } };
    s.ui.onkeydown = (ev) => { if (ev.key !== 'Escape' || document.fullscreenElement) return; if (s.open || s.enlarged) { ev.stopPropagation(); if (s.open) slip(false); else enlarge(false); } };
    s.observer = new MutationObserver(motionState);
    s.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    osMotion.addEventListener('change', motionState);
    document.addEventListener('fullscreenchange', fullscreenLabel);
    motionState();
  }

  // A folha e o bilhete podem ser interrompidos sem deixar animações ou temporizadores órfãos.
  function cancel(el) {
    const a = s.animations.get(el);
    if (a) { s.animations.delete(el); a.run.cancel(); a.done?.(); }
  }
  function motionState() {
    if (!s) return;
    const c = document.documentElement.classList;
    const disabled = !!s.model?.reduceMotion || osMotion.matches || c.contains('bg-paused') || c.contains('reduce-motion');
    s.ui.classList.toggle('cd-static', disabled);
    if (disabled) {
      for (const el of s.animations.keys()) cancel(el);
      for (const body of s.ui.querySelectorAll('.cd-ink-text:has(.cd-ink)')) body.textContent = body.textContent;
    }
  }
  function motion(el, frames, duration, done) {
    cancel(el);
    if (s.ui.classList.contains('cd-static')) { done?.(); return; }
    const run = el.animate(frames, { duration, easing: ease });
    s.animations.set(el, { run, done });
    run.onfinish = () => { if (s?.animations.get(el)?.run === run) cancel(el); };
  }
  function turn(right) {
    if (s.enlarged || s.ui.classList.contains('cd-static')) return;
    if (s.leaf) cancel(s.leaf);
    const e = s.e, scene = node('div','cd-turn-scene'), leaf = node('div', `cd-leaf${right ? ' cd-leaf-right' : ''}`);
    const front = node('div','cd-leaf-front'), back = node('div','cd-leaf-back'), head = node('div','cd-leaf-heading');
    if (right) {
      head.append(node('span','','Conversa da sala'), node('p','cd-sub', e['slip-title'].textContent));
    } else head.append(e['room-line'].cloneNode(true), e.title.cloneNode(true), e.sub.cloneNode(true), e.seats.cloneNode(true));
    const shadow = node('span','cd-leaf-shadow');
    front.append(head,shadow); leaf.append(front,back); scene.append(leaf);
    scene.inert = true; attr(scene,'aria-hidden','true'); s.ui.append(scene); s.leaf = leaf;
    motion(shadow,[{ opacity:0 },{ opacity:1,offset:.45 },{ opacity:1 }],380);
    motion(back,[{ opacity:1 },{ opacity:1,offset:.94 },{ opacity:0 }],380);
    motion(leaf,[{ transform:'rotateY(0deg)' },{ transform:`rotateY(${right ? -180 : 180}deg)` }],380,() => { cancel(shadow); cancel(back); scene.remove(); s.leaf = null; });
  }

  // Diferença por chave: retratos, fitas, mensagens e seleção mantêm identidade entre retratos do host.
  function reconcile(parent, cache, items, make, render) {
    const keep = new Set(); let at = parent.firstElementChild;
    items.forEach((item,i) => {
      const id = item.id, fresh = !cache.has(id), r = fresh ? make(item) : cache.get(id);
      if (fresh) cache.set(id,r);
      keep.add(id);
      if (r.el !== at) parent.insertBefore(r.el,at);
      at = r.el.nextElementSibling;
      render(r,item,i,fresh);
    });
    for (const [id,r] of cache) if (!keep.has(id)) { r.el.remove(); cache.delete(id); }
  }
  function ribbon(c, voice, tab = false) {
    const el = node('button',tab ? 'cd-text-tab' : 'cd-rib');
    el.innerHTML = tab ? '<span aria-hidden="true">#</span>' : I(voice ? 'volume' : 'hash',14);
    const name = node('span','cd-rib-name'), badge = node('span','cd-rib-unread'); el.append(name,badge);
    el.onclick = () => voice ? s.actions.joinVoice(c.id) : s.actions.selectText(c.id);
    return { el,name,badge };
  }
  function unread(c) { return Math.max(Number(c.unread) || 0,s.channels.get(c.id)?.unread || 0); }
  function paintRibbon(r,c,i,voice) {
    const current = !!(voice ? c.here : c.active), n = voice ? c.users.length : unread(c), col = colors[i % colors.length];
    txt(r.name,c.name); txt(r.badge,!voice && c.unread === true ? '•' : String(n)); hide(r.badge,!n);
    if (r.col !== col) { r.col = col; r.el.style.setProperty('--cd-ribbon',col); }
    r.el.classList.toggle('cd-current',current); attr(r.el,'aria-current',String(current));
    label(r.el,`Canal de ${voice ? 'voz' : 'texto'} ${c.name}${voice ? `, ${n} ${n === 1 ? 'pessoa' : 'pessoas'}` : n ? ', mensagens novas' : ''}`);
  }
  const dots = Array.from({ length:16 },(_,i) => { const a = i * Math.PI / 8; return `<circle cx="${54 + 47.5*Math.cos(a)}" cy="${54 + 47.5*Math.sin(a)}" r="1.7" fill="${GOLD}"/>`; }).join('');
  function medal(u) {
    const el = node('button','cd-seat');
    el.innerHTML = `<span class="cd-say" aria-hidden="true"><span class="cd-say-card"><span class="cd-say-name"></span>${wave}</span></span><span class="cd-roundel" aria-hidden="true"><svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="52.5" fill="none" stroke="${INK}" stroke-width="1.4"/><circle cx="54" cy="54" r="47.5" fill="none" stroke="var(--cd-person)" stroke-width="8"/>${dots}<circle cx="54" cy="54" r="43" fill="#f7f0e0" stroke="${INK}" stroke-width="1.2"/><text x="54" y="72" text-anchor="middle" font-family="Pirata One" font-size="52" fill="var(--cd-person-ink)"></text><path d="M30 76q24 10 48 0" fill="none" stroke="var(--cd-person-ink)" opacity=".5"/></svg><img alt="" hidden><span class="cd-seat-state" hidden></span></span><b></b><small class="cd-seat-role"></small><small class="cd-talking" aria-hidden="true">falando</small>`;
    el.onclick = el.oncontextmenu = (ev) => {
      if (ev.type === 'click' && !ev.detail) { const r = el.getBoundingClientRect(); s.actions.userMenu({ clientX:r.left+r.width/2, clientY:r.bottom, preventDefault(){}, stopPropagation(){} },u.id); }
      else s.actions.userMenu(ev,u.id);
    };
    return { el, name:el.querySelector('b'), say:el.querySelector('.cd-say-name'), letter:el.querySelector('text'), img:el.querySelector('img'), state:el.querySelector('.cd-seat-state'), role:el.querySelector('.cd-seat-role') };
  }
  function paintMedal(r,u,i,fresh) {
    const role = u.deafened ? 'sem áudio' : u.muted ? 'mudo' : u.sharing ? 'transmitindo' : u.me ? 'você' : u.bot ? 'DJ' : u.voice ? 'ouvindo' : u.host ? 'anfitrião' : 'na sala';
    const color = CSS.supports('color',u.color || '') ? u.color : BLUE;
    if (r.color !== color) { r.color = color; r.el.style.setProperty('--cd-person',color); }
    r.name.style.color = window.readableColor?.(u.nameColor || u.color, ['#efe6d2', '#d5c5ad']) || '';
    r.el.style.setProperty('--cd-person-ink', window.readableColor?.(color, '#f7f0e0') || '#2b211b');
    txt(r.name,u.name); txt(r.say,u.name); txt(r.letter,first(u.name).toLocaleUpperCase('pt-BR')); txt(r.role,role); image(r.img,u.avatar);
    const state = u.deafened ? 'headphonesOff' : u.muted ? 'micOff' : u.sharing ? 'screen' : u.host ? 'crown' : '';
    hide(r.state,!state); if (state) glyph(r.state,state,14);
    label(r.el,`${u.name} · ${role} · abrir perfil e opções`); r.el.classList.toggle('cd-speaking',!!u.speaking);
    if (fresh && s.hadPeople) motion(r.el.querySelector('.cd-roundel'),[{ opacity:.45,transform:'scale(.96)' },{ opacity:1,transform:'none' }],250);
  }
  function speaking(ids) { if (s) for (const [id,r] of s.seatsById) r.el.classList.toggle('cd-speaking',ids.has(id)); }
  function call(state) {
    const e = s.e;
    hide(e.ctl,!state.joined);
    for (const [k,on,name,icon] of [
      ['mic',state.muted,state.muted ? 'Ativar microfone' : 'Silenciar microfone',state.muted ? 'micOff' : 'mic'],
      ['audio',state.deafened,state.deafened ? 'Ativar áudio' : 'Silenciar áudio',state.deafened ? 'headphonesOff' : 'headphones'],
      ['share',state.sharing,state.sharing ? 'Parar transmissão' : 'Transmitir tela',state.sharing ? 'screenOff' : 'screen'],
      ['dj',state.dj,state.djAvailable ? 'Abrir DJ' : 'DJ indisponível','music'],
    ]) { label(e[k],name); attr(e[k],'aria-pressed',String(!!on)); e[k].classList.toggle('cd-on',!!on); glyph(e[k],icon,19); }
    if (e.share.disabled !== (state.canShare === false)) e.share.disabled = state.canShare === false;
    if (e.dj.disabled !== !state.djAvailable) e.dj.disabled = !state.djAvailable;
  }

  // O palco muda de tamanho, nunca de nó. O áudio da live é responsabilidade do app.
  function videoSize() {
    if (!s || !s.live) return;
    const e = s.e, { videoWidth:w,videoHeight:h,srcObject } = s.video, ratio = srcObject && w && h ? w/h : 0;
    if (ratio && ratio !== s.ratio) { s.ratio = ratio; e.mat.style.setProperty('--cd-ratio',ratio); }
    // Live de outra pessoa abre grande (o pedido: não sacrificar o tamanho da live); "Voltar ao caderno" vale até essa live acabar.
    if (ratio && s.pendingBig) { s.pendingBig = false; return enlarge(true,!s.model?.reduceMotion,false); }
    hide(s.video,!ratio); hide(e.await,!!ratio); hide(e.full,!ratio);
    hide(e.view,!ratio || s.enlarged); hide(e.back,!s.enlarged);
    if (ratio) txt(e['live-meta'].querySelector('i'),`${s.live.me ? 'Prévia local · ' : ''}${w} × ${h}`);
  }
  function fullscreen() {
    if (document.fullscreenElement === s.e.picture) document.exitFullscreen().catch(() => {});
    else s.actions.fullscreen(s.e.picture)?.catch?.(() => {});
  }
  function fullscreenLabel() { if (s) label(s.e.full,document.fullscreenElement === s.e.picture ? 'Sair da tela cheia' : 'Tela cheia'); }
  function enlarge(on,animate = true,focus = animate) { // automático não rouba o foco de quem está digitando
    if (s.enlarged === on || (on && !s.ratio)) return;
    if (s.leaf) cancel(s.leaf);
    const e = s.e; s.enlarged = on; s.ui.classList.toggle('cd-live',on); e.book.inert = on;
    (on ? e['live-dock'] : e['room-dock']).append(e.ctl);
    videoSize();
    if (animate) {
      motion(on ? e.mat : e.book,[{ opacity:.65,transform:'translateY(8px) scale(.988)' },{ opacity:1,transform:'none' }],250);
    }
    if (focus) (on ? e.back : e.view).focus({ preventScroll:true });
  }
  function live(items) {
    const e = s.e, list = e['live-list'];
    const next = items.find(l => String(l.uid) === s.liveUid) || items.find(l => l.stream) || items.find(l => l.watching) || items[0];
    s.live = next; s.liveUid = next ? String(next.uid) : '';
    hide(e.exhibit,!next); hide(e.empty,!!next); hide(list,items.length < 2);
    reconcile(list,s.opts,items.map(l => ({ ...l,id:l.uid })),() => ({ el:node('option','') }),({el},l) => {
      if (el.value !== String(l.uid)) el.value = String(l.uid);
      txt(el,l.me ? 'Você' : l.name);
    });
    if (list.value !== s.liveUid) list.value = s.liveUid;
    if (s.video.srcObject !== (next?.stream || null)) {
      s.video.pause(); s.video.srcObject = next?.stream || null; s.ratio = 0; e.mat.style.removeProperty('--cd-ratio');
      hide(s.video,true); hide(e.await,false); hide(e.full,true); hide(e.view,true);
      s.pendingBig = !!next?.stream && !next.me && s.dismissed !== s.liveUid;
      if (!next) s.dismissed = '';
      if (next?.stream) s.video.play().catch(() => {});
      else if (document.fullscreenElement === e.picture) document.exitFullscreen().catch(() => {});
    }
    if (!next) { enlarge(false,false); return; }
    txt(e['live-meta'].querySelector('strong'),next.me ? 'Você está transmitindo' : `${next.name} está transmitindo`);
    const waiting = next.me || next.watching || !!next.stream;
    txt(e.watch.lastElementChild,waiting ? 'Preparando a transmissão…' : 'Assistir à transmissão');
    if (e.watch.disabled !== waiting) e.watch.disabled = waiting;
    hide(e.stop,next.me || !next.watching);
    if (!next.stream) txt(e['live-meta'].querySelector('i'),waiting ? 'Conectando…' : 'Iluminura disponível');
    if (!next.stream && (!waiting || next.me)) enlarge(false,false);
    if (s.ratio || !next.stream) videoSize();
  }

  const fileLabel = n => n === 1 ? '1 anexo' : `${n} anexos`;
  const mention = (m,me) => !!(m && !m.me && me?.name && m.text.toLocaleLowerCase('pt-BR').includes(`@${me.name.toLocaleLowerCase('pt-BR')}`));
  function message() {
    const el = node('article','cd-p');
    el.innerHTML = `<time class="cd-time"></time><span class="cd-mention-hand" hidden>${hand(27)}</span><span class="cd-par" aria-hidden="true">¶</span><b class="cd-author"></b><span class="cd-ink-text"></span><span class="cd-attachment" hidden></span>`;
    const [time,handEl,par,who,body,file] = el.children; return {el,time,handEl,par,who,body,file};
  }
  function ink(body,value,fresh) {
    if (body.dataset.value === value) return;
    body.dataset.value = value;
    if (!fresh || !value || s.ui.classList.contains('cd-static')) { txt(body,value); return; }
    // Revela grupos de grafemas; 325 ms entre o primeiro e o último, mais 120 ms de tinta.
    const chars = Array.from(letters.segment(value),p => p.segment), chunk = Math.max(1,Math.ceil(chars.length/32)), n = Math.ceil(chars.length/chunk);
    for (let i = 0; i < n; i++) {
      const span = node('span','cd-ink',chars.slice(i*chunk,(i+1)*chunk).join(''));
      span.style.animationDelay = `${Math.round(325*i/Math.max(1,n-1))}ms`; body.append(span);
    }
  }
  function chat(model, scroll = false) {
    const e = s.e, { messages,channel } = model.chat, id = channel?.id ?? null, switched = s.chatId !== id;
    const atBottom = scroll || switched || (s.open && e.msgs.scrollHeight-e.msgs.clientHeight-e.msgs.scrollTop < 36);
    let state = s.channels.get(id);
    if (!state) { state = { ids:[],unread:0 }; s.channels.set(id,state); }
    if (switched && s.open) state.unread = 0;
    const ids = messages.map(m => m.id), seen = new Set(state.ids), anchor = ids.findLastIndex(mid => seen.has(mid));
    // Ao entrar em outro canal, o histórico é exibido sem animação de chegada.
    const arrivals = !switched && (anchor >= 0 || !state.ids.length) ? messages.slice(anchor+1) : [];
    const freshIds = new Set(arrivals.map(m => m.id)); state.ids = ids;
    if (!s.open) state.unread += arrivals.filter(m => !m.me).length;
    if (switched) { s.chatId = id; e.entries.replaceChildren(); s.messages.clear(); s.input.value = ''; e.send.disabled = true; }
    if (s.input.disabled !== !channel) s.input.disabled = !channel;
    attr(s.input,'placeholder',channel ? `Escreva em #${channel.name}…` : 'Selecione um canal de texto');
    const last = messages.at(-1);
    txt(e['slip-title'],channel ? `Recados · #${channel.name}` : 'Recados');
    txt(e.ln.querySelector('b'),last && !last.system ? `${last.name}:` : '');
    txt(e.preview,last ? [last.text.replace(/\s+/g,' ').trim(),last.files ? fileLabel(last.files) : ''].filter(Boolean).join(' · ') : 'Ainda não há recados.');
    hide(e['preview-hand'],!mention(last,model.me));
    const entries = !last && s.open ? [{ id:Symbol.for('cd-empty'),text:'Ainda não há recados neste canal.',system:true }] : messages;
    let previous, paragraph = 0;
    reconcile(e.entries,s.messages,entries,message,(r,m,i,fresh) => {
      const starts = !m.system && (!previous || previous.system || previous.uid !== m.uid || m.ts-previous.ts > 300000), marked = mention(m,model.me);
      r.el.classList.toggle('cd-system',!!m.system); r.el.classList.toggle('cd-mine',!!m.me);
      hide(r.handEl,!marked); hide(r.par,!starts); hide(r.who,!starts); hide(r.time,!!m.system || marked);
      if (starts) r.par.classList.toggle('cd-blue',++paragraph%2 === 0);
      const t = new Date(m.ts), valid = Number.isFinite(t.getTime());
      txt(r.time,valid ? hour.format(t) : ''); if (valid) attr(r.time,'datetime',t.toISOString());
      if (marked && valid && r.handEl.title !== r.time.textContent) r.handEl.title = r.time.textContent;
      r.who.style.color = m.system ? '' : window.readableColor?.(m.nameColor || m.color, ['#f8f1e1', '#ecdcc6']) || '';
      txt(r.who,m.name || ''); ink(r.body,m.text,fresh && s.open && freshIds.has(m.id) && !m.system);
      hide(r.file,!m.files); txt(r.file,m.files ? `◇ ${fileLabel(m.files)}` : ''); previous = m;
    });
    if (s.open && (atBottom || arrivals.some(m => m.me))) e.msgs.scrollTop = e.msgs.scrollHeight;
    if (!s.open && arrivals.some(m => !m.me)) motion(e['slip-tab'],[{ transform:'rotate(-1.4deg)' },{ transform:'translateY(-7px) rotate(.25deg)',offset:.36 },{ transform:'rotate(-1.4deg)' }],330);
    const n = model.text.reduce((sum,c) => sum+unread(c),0);
    const lowerBound = model.text.some(c => c.unread === true);
    hide(e.wax,!n); txt(e.wax,n > 99 ? '99+' : `${n}${lowerBound ? '+' : ''}`);
    attr(e['slip-tab'],'aria-label',`${e['slip-title'].textContent} · abrir bilhete${n ? ` · ${lowerBound ? 'pelo menos ' : ''}${n} ${n === 1 ? 'não lida' : 'não lidas'}` : ''}`);
    for (const [parent,cache,tab] of [[e.text,s.texts,false],[e.tabs,s.tabsById,true]]) reconcile(parent,cache,model.text,c => ribbon(c,false,tab),(r,c,i) => paintRibbon(r,c,i,false));
  }
  function slip(open) {
    if (open === s.open) return;
    const e = s.e, note = e['note-p'], tab = e['slip-tab'];
    cancel(note); cancel(tab); s.open = open; e.slip.classList.toggle('cd-open',open); attr(tab,'aria-expanded',String(open)); note.inert = !open;
    if (open) {
      const state = s.channels.get(s.chatId); if (state) state.unread = 0;
      hide(note,false); hide(tab,true); chat(s.model,true);
      motion(note,[{ transform:'perspective(900px) rotateX(50deg)',opacity:.35 },{ transform:'none',opacity:1 }],250);
      (s.input.disabled ? e.close : s.input).focus({ preventScroll:true });
    } else {
      hide(tab,false); motion(note,[{ transform:'none',opacity:1 },{ transform:'perspective(900px) rotateX(50deg)',opacity:0 }],200,() => hide(note,true));
      tab.focus({ preventScroll:true });
    }
  }

  function update(model) {
    const old = s.model, e = s.e; s.model = model; motionState();
    const channel = model.voice.find(c => c.id === model.call.channel) || model.voice.find(c => c.here);
    s.suggested = channel || model.voice[0];
    const joined = model.call.joined, title = joined && channel ? channel.name : 'Sala de entrada';
    if (old && (s.callChannel !== model.call.channel || s.joined !== joined)) turn(false);
    else if (old && s.chatId !== (model.chat.channel?.id ?? null) && !s.open) turn(true);
    s.callChannel = model.call.channel; s.joined = joined;
    txt(e['room-line'],`${model.room.name} · ${joined ? 'Canal de voz' : 'Sala aberta'}`); txt(e.date,day.format(new Date()));
    attr(e.title,'aria-label',title); const initialLetter = first(title); txt(e.title.querySelector('svg text'),initialLetter); txt(e['title-rest'],title.slice(initialLetter.length));
    e.title.classList.toggle('cd-title-blue',!joined || model.voice.indexOf(channel)%2 === 1);
    const users = joined ? channel?.users || [] : model.lobby;
    txt(e.sub,joined ? `${users.length} ${users.length === 1 ? 'pessoa na call' : 'pessoas na call'}` : model.room.about || 'Escolha um canal de voz para entrar na call.');
    hide(e.enter,joined || !s.suggested); txt(e.enter.lastElementChild,s.suggested ? `Entrar em ${s.suggested.name}` : '');
    txt(e['right-heading'],model.live.length ? 'A transmissão' : 'Caderno da sala');
    label(e['room-menu'],`Menu da sala · ${model.room.name}${model.room.code ? ` · ${model.room.code}` : ''}`); image(e['room-menu'].querySelector('img'),model.room.icon);
    txt(e['empty-action'].lastElementChild,joined && model.call.canShare ? 'Transmitir tela' : 'Convidar pessoas');
    attr(e.seats,'data-count',String(users.length)); reconcile(e.seats,s.seatsById,users,medal,paintMedal); s.hadPeople = true;
    reconcile(e.voice,s.voices,[{ id:null },...model.voice],c => c.id === null ? { el:e.home } : ribbon(c,true),(r,c,i) => { if (c.id !== null) paintRibbon(r,c,i-1,true); });
    call(model.call); live(model.live); chat(model);
  }
  function unmount() {
    if (!s) return;
    s.observer.disconnect(); osMotion.removeEventListener('change',motionState); document.removeEventListener('fullscreenchange',fullscreenLabel);
    s.video.removeEventListener('resize',videoSize); s.video.removeEventListener('loadedmetadata',videoSize);
    if (document.fullscreenElement === s.e.picture) document.exitFullscreen().catch(() => {});
    for (const el of s.animations.keys()) cancel(el);
    s.video.pause(); s.video.srcObject = null; s = null;
  }
  window.ResenhaSkins.register('caderno',{ mount,update,speaking,unmount });
})();
