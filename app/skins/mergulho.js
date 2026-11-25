// Mergulho: faixas de status e menus submersos, a partir do protótipo inspirado em Persona 3 Reload.
(() => {
  const menuIcon = '<svg width="22" height="18" viewBox="0 0 22 18" fill="currentColor"><path d="M4 1h17l-1 3H3zM2.5 7.5h17l-1 3h-17zM1 14h17l-1 3H0z"/></svg>';
  const glyph = (id, size = 20) => id === 'cascade' ? menuIcon : window.icon(id, size);
  const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const text = (el, value) => { const s = String(value ?? ''); if (el.textContent !== s) el.textContent = s; };
  const attr = (el, name, value) => {
    const s = value == null ? null : String(value);
    if (el.getAttribute(name) === s) return;
    if (s === null) el.removeAttribute(name); else el.setAttribute(name, s);
  };
  const show = (el, on) => { if (el.hidden === !!on) el.hidden = !on; };
  const disable = (el, off) => { if (el.disabled !== !!off) el.disabled = !!off; };
  const node = (tag, cls) => Object.assign(document.createElement(tag), { className: cls });
  const label = (el, name) => { attr(el, 'title', name); attr(el, 'aria-label', name); };
  const avatarMarkup = '<span></span><img alt="" hidden>';
  function avatarErrors(el) { el.querySelector('img').onerror = (e) => { e.currentTarget.hidden = true; }; }
  function safeImage(src) {
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;
    try {
      const base = new URL('.', document.baseURI), url = new URL(src, base);
      if (url.protocol === 'blob:' && url.origin === base.origin) return url.href;
      if (base.protocol === 'file:' ? url.href.startsWith(base.href) : url.origin === base.origin && /^https?:$/.test(url.protocol)) return url.href;
    } catch { /* Um avatar inválido mantém a inicial. */ }
    return '';
  }
  function avatar(el, name, color, src) {
    const [letter, img] = el.children;
    text(letter, Array.from((name || '').trim())[0]?.toLocaleUpperCase('pt-BR') || '?');
    const tone = /^#[\da-f]{3}([\da-f]{3})?$/i.test(color || '') ? color : '#204BC9';
    if (el.style.getPropertyValue('--mg-person') !== tone) el.style.setProperty('--mg-person', tone);
    const url = safeImage(src);
    if ((img.getAttribute('src') || '') !== url) { show(img, url); attr(img, 'src', url || null); }
  }
  // Reconcilia por identidade: o mesmo retrato não move nós, não perde foco e não toca no vídeo.
  function keyed(parent, map, items, keyOf, make, patch, remove) {
    const keys = new Set(items.map(keyOf));
    for (const [key, record] of map) if (!keys.has(key)) {
      remove?.(record); record.el.remove(); map.delete(key);
    }
    let cursor = parent.firstElementChild;
    for (const item of items) {
      const key = keyOf(item);
      let record = map.get(key);
      if (!record) { record = make(item); map.set(key, record); }
      patch(record, item);
      if (record.el === cursor) cursor = cursor.nextElementSibling;
      else parent.insertBefore(record.el, cursor);
    }
  }
  function waterTexture() {
    // A textura é rasterizada uma vez; anima-se apenas o deslocamento da camada.
    let seed = 7, paths = '';
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 43; i++) {
      const x = Math.round(rand() * 1200), y = Math.round(rand() * 700);
      const w = Math.round(38 + rand() * 132), h = Math.round(8 + rand() * 29);
      paths += `<path transform="translate(${x} ${y}) rotate(${Math.round(rand() * 24 - 12)})" d="M0 0Q${w * .36} ${-h} ${w} ${-h * .16}Q${w * .52} ${h * .56} 0 0Z" opacity="${(.07 + rand() * .16).toFixed(2)}"/>`;
    }
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" fill="#a9e9ff">${paths}</svg>`)}")`;
  }
  function mount(root, actions) {
    const abort = new AbortController(), opts = { signal: abort.signal };
    const people = new Map(), faces = new Map(), channels = new Map(), lives = new Map(), liveTabs = new Map();
    const chatTabs = new Map(), messages = new Map(), menuRows = new Map(), previewRows = new Map(), usersById = new Map();
    let model, activeLive, activeMenu, menuOpen = false, chatOpen = false, big = false;
    let speakingIds = new Set(), chatReturn, menuReturn, chatChannel, lastMessage, previewKey;
    let menuOrder = [];
    function meAction(e, id) {
      if (id === model.me?.id) return actions.profile();
      if (e.type !== 'click' || e.detail) return actions.userMenu(e, id);
      const anchor = e.currentTarget.getBoundingClientRect();
      // O clique pelo teclado não tem coordenadas. Ancora o menu na faixa focada.
      return actions.userMenu(new MouseEvent('click', { clientX: anchor.left + 22, clientY: anchor.bottom, cancelable: true }), id);
    }
    const btn = (name, icon, cls) => `<button type="button" class="${cls}" title="${name}" aria-label="${name}">${glyph(icon)}</button>`;
    root.innerHTML = `<div class="mg" tabindex="-1">
      <div class="mg-water" aria-hidden="true"></div><div class="mg-rays" aria-hidden="true"></div>
      <div class="mg-room-view">
        <div class="mg-white" aria-hidden="true"><span class="mg-giant">Lobby</span></div>
        <header class="mg-room-head">
          <button class="mg-room-button" type="button" data-room-menu aria-haspopup="menu"><span class="mg-room-icon">${avatarMarkup}</span><span class="mg-room-label"><small>Sala</small><strong></strong></span>${glyph('chevronDown', 16)}</button>
          <span class="mg-room-code"></span>
          <div class="mg-head-tools">${btn('Convidar pessoas', 'userPlus', 'mg-invite')}${btn('Seu perfil', 'user', 'mg-profile')}</div>
        </header>
        <main class="mg-layout">
          <section class="mg-roster" aria-label="Participantes">
            <div class="mg-roster-heading"><h1></h1><span></span></div>
            <div class="mg-people-scroll"><div class="mg-people"></div><p class="mg-empty mg-empty-people" hidden>Ninguém aguardando fora da call.</p></div>
            <button type="button" class="mg-dj"><span class="mg-dj-cover">${glyph('music', 22)}<b>DJ</b></span><span class="mg-dj-title"><small>DJ DA CALL</small><b></b></span><span class="mg-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${glyph('chevronRight', 17)}</button>
          </section>
          <div class="mg-faces" role="group" aria-label="Participantes"></div>
          <section class="mg-stage" aria-label="Palco da sala">
            <div class="mg-stage-idle"><div class="mg-stage-label"><small>VOZ / SALA</small><h2>Canais de voz</h2></div><div class="mg-voice-list"></div><p class="mg-empty mg-empty-voice" hidden>Nenhum canal de voz disponível.</p><p class="mg-about" hidden></p></div>
            <div class="mg-live-list" role="group" aria-label="Transmissões disponíveis" hidden></div><div class="mg-live-panels" hidden></div>
          </section>
        </main>
        <footer class="mg-footer">
          <div class="mg-dock" role="group" aria-label="Controles da sala">
            ${btn('Menu da sala (Tab)', 'cascade', 'mg-cmd mg-open-menu')}${btn('Silenciar microfone', 'mic', 'mg-cmd mg-mute')}${btn('Desativar áudio', 'headphones', 'mg-cmd mg-deafen')}${btn('Transmitir tela', 'screen', 'mg-cmd mg-share')}${btn('Abrir DJ', 'music', 'mg-cmd mg-music')}${btn('Sair da call', 'phoneOff', 'mg-cmd mg-leave')}
          </div>
          <button type="button" class="mg-strip" aria-expanded="false" aria-controls="mg-chat" title="Conversa (C)">${glyph('chat', 17)}<b></b><span></span><em hidden></em></button>
          <div class="mg-guide" aria-label="Atalhos"><b>Guia de atalhos</b><span class="mg-shortcuts"><span><kbd>Tab</kbd> Menu</span><span><kbd>C</kbd> Conversa</span><span class="mg-live-key" hidden><kbd>F</kbd> <span>Ver grande</span></span></span></div>
        </footer>
      </div>
      <aside class="mg-chat" id="mg-chat" aria-labelledby="mg-chat-title" hidden>
        <div class="mg-chat-head"><div><small>CANAIS DE TEXTO</small><h2 id="mg-chat-title">Conversa</h2></div>${btn('Fechar conversa (Esc)', 'x', 'mg-chat-close')}</div>
        <div class="mg-chat-tabs" role="group" aria-label="Canais de texto"></div>
        <div class="mg-chat-scroll" role="log" aria-label="Mensagens" tabindex="0"><div class="mg-messages"></div><p class="mg-empty mg-empty-chat"></p></div>
        <form class="mg-composer"><textarea rows="1" aria-label="Mensagem" maxlength="8000"></textarea><button type="submit" aria-label="Enviar mensagem" title="Enviar mensagem">${glyph('send', 19)}</button></form>
        <small class="mg-chat-error" role="status" hidden>Não foi possível enviar a mensagem.</small>
      </aside>
      <section class="mg-menu" role="dialog" aria-modal="true" aria-label="Menu Mergulho" hidden>
        <div class="mg-menu-water" aria-hidden="true"></div><div class="mg-menu-wing" aria-hidden="true"><span>Resenha</span></div>
        <header class="mg-menu-head"><div class="mg-menu-code"><small>CÓDIGO DA SALA</small><strong></strong><span></span></div>${btn('Fechar menu (Esc)', 'x', 'mg-menu-close')}</header>
        <div class="mg-menu-grid"><nav class="mg-menu-scroll" aria-label="Comandos da sala"><div class="mg-casc"></div></nav>
          <section class="mg-preview" aria-label="Prévia"><div class="mg-preview-head"><small></small><h2></h2></div><div class="mg-preview-content"><p></p><div class="mg-preview-rows"></div></div></section></div>
        <div class="mg-guide mg-menu-guide"><b>Guia de comandos</b><span class="mg-shortcuts"><span><kbd>↑ ↓</kbd> Navegar</span><span><kbd>Enter</kbd> Escolher</span><span><kbd>Esc</kbd> Fechar</span></span></div>
      </section>
    </div>`;
    const $ = (q) => root.querySelector(q);
    const shell = $('.mg'), roomView = $('.mg-room-view'), chat = $('.mg-chat'), menu = $('.mg-menu');
    const peopleEl = $('.mg-people'), facesEl = $('.mg-faces'), livePanels = $('.mg-live-panels');
    const chatScroll = $('.mg-chat-scroll'), messageEl = $('.mg-messages'), input = $('.mg-composer textarea'), send = $('.mg-composer button');
    const cascade = $('.mg-casc'), previewEl = $('.mg-preview-rows'), menuButton = $('.mg-open-menu'), strip = $('.mg-strip');
    shell.style.setProperty('--mg-caustic', waterTexture());
    avatarErrors($('.mg-room-icon'));
    attr(menuButton, 'aria-haspopup', 'dialog'); attr(menuButton, 'aria-expanded', 'false');

    function person(item, variant = 'bar') {
      const isPreview = variant === 'preview', face = variant === 'face';
      const el = node(isPreview ? 'div' : 'button', face ? 'mg-face' : 'mg-bar');
      if (!isPreview) el.type = 'button';
      el.innerHTML = face ? `<span class="mg-avatar">${avatarMarkup}</span>` : `<span class="mg-seal"></span><span class="mg-avatar">${avatarMarkup}</span><strong class="mg-person-name"></strong><span class="mg-telemetry"><span class="mg-voice"><small>VOZ</small><b class="mg-meter" aria-hidden="true"><i></i><i></i><i></i><i></i></b></span><span class="mg-ping"><small>PING</small><b></b></span></span>`;
      const av = el.querySelector('.mg-avatar'); avatarErrors(av);
      if (!isPreview) {
        el.onclick = (e) => meAction(e, item.id);
        el.oncontextmenu = (e) => { e.preventDefault(); meAction(e, item.id); };
      }
      return { el, av, face, seal: el.querySelector('.mg-seal'), name: el.querySelector('.mg-person-name'), ping: el.querySelector('.mg-ping b') };
    }
    function patchPerson({ el, av, face, seal, name, ping }, user) {
      const status = user.sharing ? 'Ao vivo' : user.deafened ? 'Sem áudio' : user.muted ? 'Mudo' : user.me ? 'Você' : user.bot ? 'DJ' : user.host ? 'Anfitrião' : user.voice ? 'Na call' : 'Na sala';
      const hasPing = Number.isFinite(user.ping) && user.ping >= 0;
      avatar(av, user.name, user.color, user.avatar);
      label(el, `${user.name} · ${status}${face ? '' : hasPing ? ` · ${Math.round(user.ping)} ms` : ' · Latência indisponível'}`);
      if (!face) { text(seal, status); text(name, user.name); text(ping, hasPing ? `${Math.round(user.ping)} ms` : '—'); }
      el.classList.toggle('is-live', !!user.sharing);
      el.classList.toggle('is-muted', !!(user.muted || user.deafened));
      el.classList.toggle('is-speaking', speakingIds.has(user.id));
    }
    function setBig(on) {
      const panel = lives.get(activeLive);
      if (big === on || (on && !panel?.ready)) return;
      const moveFocus = $('.mg-roster').contains(document.activeElement) || facesEl.contains(document.activeElement);
      big = on; shell.classList.toggle('is-big', on);
      for (const record of lives.values()) syncLiveControls(record);
      text($('.mg-live-key span'), on ? 'Tela cheia' : 'Ver grande');
      if (moveFocus && panel?.ready) panel.size.focus({ preventScroll: true });
    }
    function showChat(on, focus = true) {
      if (on && menuOpen) showMenu(false);
      if (chatOpen === on) return;
      chatOpen = on; shell.classList.toggle('is-chat-open', on); attr(strip, 'aria-expanded', on);
      if (on) {
        chatReturn = document.activeElement;
        show(chat, true); renderChat(true);
        if (focus) (input.disabled ? $('.mg-chat-close') : input).focus({ preventScroll: true });
      } else {
        show(chat, false);
        if (focus) (chatReturn?.isConnected && roomView.contains(chatReturn) ? chatReturn : strip).focus({ preventScroll: true });
      }
    }
    function showMenu(on) {
      if (menuOpen === on) return;
      if (on) { menuReturn = document.activeElement; if (chatOpen) showChat(false, false); }
      menuOpen = on; attr(menuButton, 'aria-expanded', on);
      roomView.inert = on; show(menu, on);
      if (on) renderMenu(true);
      else (menuReturn?.isConnected && roomView.contains(menuReturn) ? menuReturn : menuButton).focus({ preventScroll: true });
    }
    function mountLive(item) {
      const el = node('div', 'mg-live-panel');
      el.innerHTML = `<div class="mg-onair"><b>Ao vivo</b><strong></strong><span></span></div>
        <div class="mg-live-fit"><div class="mg-frame" hidden><video autoplay playsinline muted></video></div>
        <div class="mg-live-invite"><span class="mg-live-emblem">${glyph('screen', 35)}</span><div><h2></h2><p></p></div><button type="button" class="mg-watch">${glyph('play', 15)} Assistir</button></div>
        <div class="mg-live-tools"><button type="button" class="mg-size">${glyph('expand', 17)}<span></span></button>${btn('Tela cheia', 'maximize', 'mg-full')}<button type="button" class="mg-stop">${glyph('x', 17)}<span>Parar de assistir</span></button></div></div>`;
      const get = (s) => el.querySelector(s), video = get('video');
      video.muted = true;
      const record = { el, video, uid: item.uid, ready: false, stream: null, frame: get('.mg-frame'), size: get('.mg-size'), full: get('.mg-full'), stop: get('.mg-stop'), watch: get('.mg-watch'), invite: get('.mg-live-invite'), status: get('.mg-onair span'), title: get('.mg-onair strong'), heading: get('h2'), note: get('p') };
      const dimensions = () => {
        if (!record.stream || !video.videoWidth || !video.videoHeight) return;
        const ratio = String(video.videoWidth / video.videoHeight);
        if (record.frame.style.getPropertyValue('--mg-ratio') !== ratio) record.frame.style.setProperty('--mg-ratio', ratio);
        record.ready = true;
        renderLiveState(record);
        if (record.uid === activeLive) show($('.mg-live-key'), true);
      };
      video.onresize = video.onloadedmetadata = dimensions;
      video.onclick = () => { if (document.fullscreenElement === record.frame) document.exitFullscreen().catch(() => {}); else setBig(true); };
      record.watch.onclick = () => actions.watch(item.uid, true);
      record.stop.onclick = () => actions.watch(item.uid, false);
      record.size.onclick = () => setBig(!big);
      record.full.onclick = () => requestFull(record);
      return record;
    }
    function requestFull(record) { if (record?.ready) actions.fullscreen(record.frame)?.catch?.(() => {}); }
    function syncLiveControls(record) {
      text(record.size.querySelector('span'), big ? 'Voltar à sala' : 'Ver grande');
      attr(record.size, 'title', big ? 'Voltar à sala (Esc)' : 'Ver grande (F)');
      show(record.size, record.ready); show(record.full, record.ready);
      show(record.stop, !record.me && record.watching);
    }
    function renderLiveState(record) {
      show(record.frame, record.ready); show(record.invite, !record.ready);
      show(record.watch, !record.me && !record.watching);
      text(record.status, record.me ? 'Sua transmissão' : record.ready ? 'Assistindo' : record.watching ? 'Conectando' : 'Transmissão de tela');
      text(record.heading, record.me ? 'Preparando sua transmissão' : record.watching ? 'Conectando à transmissão' : 'Tela compartilhada');
      text(record.note, record.me || record.watching ? 'A imagem aparece assim que o vídeo estiver disponível.' : `Assista à tela de ${record.name} sem sair da sala.`);
      syncLiveControls(record);
    }
    function releaseLive({ video }) {
      video.onresize = video.onloadedmetadata = video.onclick = null;
      video.srcObject = null;
    }
    function patchLive(record, item) {
      record.me = !!item.me; record.watching = !!item.watching; record.name = item.name;
      text(record.title, item.name);
      const stream = item.stream || null;
      if (record.stream !== stream) {
        record.stream = stream; record.ready = false; record.video.srcObject = stream;
      }
      renderLiveState(record);
    }
    function selectLive(uid) {
      activeLive = uid;
      for (const [id, record] of lives) show(record.el, id === uid);
      for (const [id, record] of liveTabs) attr(record.el, 'aria-pressed', id === uid);
      const ready = !!lives.get(uid)?.ready;
      show($('.mg-live-key'), ready);
      if (!ready && big && !lives.get(uid)?.stream) setBig(false);
    }
    function addMessage(record, msg) {
      const user = usersById.get(msg.uid);
      avatar(record.av, msg.name, msg.color || user?.color, user?.avatar);
      const ts = msg.ts ? new Date(msg.ts) : null;
      text(record.author, msg.system ? 'Sistema' : msg.name);
      text(record.stamp, ts && Number.isFinite(ts.getTime()) ? clock.format(ts) : '');
      text(record.badge, msg.bot ? 'DJ' : msg.me ? 'Você' : '');
      show(record.badge, msg.bot || msg.me);
      record.el.classList.toggle('is-system', !!msg.system);
      const content = msg.text || '', myName = model.me?.name;
      if (record.content !== content || record.myName !== myName) {
        record.content = content; record.myName = myName;
        const mention = myName ? `@${myName}` : '', i = mention ? content.indexOf(mention) : -1;
        if (i < 0) text(record.body, content);
        else { const mark = node('mark', 'mg-mention'); text(mark, mention); record.body.replaceChildren(content.slice(0, i), mark, content.slice(i + mention.length)); }
        show(record.body, content);
      }
      const attachments = Array.isArray(msg.files) ? msg.files.length : Number(msg.files) || 0;
      text(record.files, attachments ? count(attachments, 'anexo', 'anexos') : ''); show(record.files, attachments > 0);
    }
    function makeMessage() {
      const el = node('article', 'mg-line');
      el.innerHTML = `<span class="mg-avatar">${avatarMarkup}</span><header><b></b><small></small><time></time></header><p></p><span class="mg-files"></span>`;
      const get = (s) => el.querySelector(s), av = get('.mg-avatar'); avatarErrors(av);
      return { el, av, author: get('b'), stamp: get('time'), body: get('p'), files: get('.mg-files'), badge: get('small') };
    }
    function renderChat(opened = false) {
      const { channel, messages: lines } = model.chat;
      const id = channel?.id;
      keyed($('.mg-chat-tabs'), chatTabs, model.text, (c) => c.id, (c) => {
        const el = node('button', 'mg-text-tab'); el.type = 'button'; el.onclick = () => actions.selectText(c.id); return { el };
      }, ({ el }, c) => {
        text(el, `#${c.name}`); attr(el, 'aria-pressed', !!c.active); attr(el, 'title', c.unread ? `#${c.name} · Não lido` : `#${c.name}`);
        el.classList.toggle('is-unread', !!c.unread);
      });
      const changed = chatChannel !== id, latest = lines.at(-1)?.id;
      const follow = opened || changed || (latest !== lastMessage && (chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight < 36 || lines.at(-1)?.me));
      chatChannel = id; lastMessage = latest;
      keyed(messageEl, messages, lines, (m) => m.id, makeMessage, addMessage);
      show($('.mg-empty-chat'), !lines.length);
      text($('.mg-empty-chat'), channel ? 'Ainda não há mensagens neste canal.' : 'Não há canal de texto disponível.');
      disable(input, !channel); disable(send, !channel);
      attr(input, 'placeholder', channel ? `Mensagem em #${channel.name}` : 'Sem canal de texto');
      if (follow) chatScroll.scrollTop = chatScroll.scrollHeight;
      if (opened || changed) chatTabs.get(id)?.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function menuItems() {
      const { voice, text: texts, call, room } = model;
      return [
        ...voice.map((c) => ({ key: `v:${c.id}`, group: 'Voz', name: c.name, badge: c.here ? 'AQUI' : c.users.length || '', note: c.here ? 'Você está neste canal.' : c.users.length ? 'Entre para conversar com quem já está aqui.' : 'Canal de voz vazio. Entre para começar a conversa.', people: c.users, run: () => { if (!c.here) actions.joinVoice(c.id); } })),
        ...texts.map((c) => ({ key: `t:${c.id}`, group: 'Texto', name: `#${c.name}`, badge: c.unread ? 'NOVO' : '', note: c.active ? 'Últimas mensagens deste canal.' : 'Abra este canal na conversa.', lines: c.active ? model.chat.messages.slice(-3) : [], run: () => { actions.selectText(c.id); showChat(true); } })),
        ...(call.joined && call.canShare ? [{ key: 'share', group: 'Comandos', name: call.sharing ? 'Parar transmissão' : 'Transmitir', note: call.sharing ? 'Encerre o seu compartilhamento de tela.' : 'Escolha uma tela ou janela para compartilhar.', run: actions.toggleShare }] : []),
        ...(call.joined && call.djAvailable ? [{ key: 'dj', group: 'Comandos', name: 'DJ', note: call.dj ? 'O DJ está tocando nesta call. Abra a fila de músicas.' : 'Abra o DJ da call para escolher músicas.', run: actions.openDJ }] : []),
        { key: 'invite', group: 'Comandos', name: 'Convidar', note: room.code ? 'Compartilhe o código ou o link desta sala.' : 'Abra o convite da sala.', run: actions.invite },
        { key: 'settings', group: 'Comandos', name: 'Ajustes', note: 'Abra as configurações de voz, aparência e atalhos do Resenha.', run: () => actions.settings() },
        call.joined ? { key: 'leave', group: 'Comandos', name: 'Sair da call', note: 'Você volta ao lobby, mas continua na sala e na conversa.', run: actions.leaveVoice } : { key: 'home', group: 'Comandos', name: 'Voltar ao início', note: 'Saia desta sala e volte à tela inicial do Resenha.', run: actions.home },
      ];
    }
    function chooseMenu(key, focus) {
      const record = menuRows.get(key);
      if (!record) return;
      activeMenu = key;
      for (const [id, { el }] of menuRows) { const selected = id === key; el.classList.toggle('is-selected', selected); if (el.tabIndex !== (selected ? 0 : -1)) el.tabIndex = selected ? 0 : -1; }
      if (focus) { record.el.focus({ preventScroll: true }); record.el.scrollIntoView({ block: 'nearest' }); }
      const { item } = record, head = $('.mg-preview-head'), note = $('.mg-preview-content > p');
      text(head.querySelector('small'), `Prévia / ${item.group}`); text(head.querySelector('h2'), item.name);
      text(note, item.note); show(note, !item.people?.length);
      const users = item.people || [], entries = users.length ? users : item.lines || [];
      keyed(previewEl, previewRows, entries, (m) => `${item.group}:${m.id}`,
        (m) => users.length ? person(m, 'preview') : makeMessage(), users.length ? patchPerson : addMessage);
      if (previewKey !== item.key) { previewKey = item.key; $('.mg-preview-content').scrollTop = 0; }
    }
    function renderMenu(focus = false) {
      const items = menuItems(), code = $('.mg-menu-code');
      menuOrder = items.map((item) => item.key);
      cascade.classList.toggle('is-dense', items.length > 11);
      text(code.querySelector('strong'), model.room.code || 'Sala local'); text(code.querySelector('span'), model.room.name);
      keyed(cascade, menuRows, items, (item) => item.key, () => {
        const el = node('a', 'mg-menu-link'); el.href = '#'; el.setAttribute('role', 'button');
        el.innerHTML = '<span class="mg-menu-word"></span><small></small>';
        const record = { el };
        el.onclick = (e) => { e.preventDefault(); showMenu(false); record.item.run(); };
        return record;
      }, (record, item) => {
        record.item = item;
        text(record.el.firstElementChild, item.name); text(record.el.lastElementChild, item.badge);
        show(record.el.lastElementChild, item.badge); attr(record.el, 'title', `${item.group}: ${item.name}`);
        record.el.classList.toggle('is-exit', item.key === 'leave' || item.key === 'home');
      });
      const start = items.find((item) => item.key === `v:${model.call.channel}`) || items[0];
            const lostSelection = !menuRows.has(activeMenu);
            chooseMenu(focus || lostSelection ? start.key : activeMenu, focus || (lostSelection && !menu.contains(document.activeElement)));
    }
    function toggleControl(el, on, normal, off, name, other) {
      on = !!on;
      if (el.getAttribute('aria-pressed') !== String(on)) { el.innerHTML = glyph(on ? off : normal); attr(el, 'aria-pressed', on); label(el, on ? other : name); }
    }
    function update(next) {
      model = next;
      const { room, me, voice, call, lobby, live } = model;
      const current = voice.find((c) => c.here) || (call.joined && voice.find((c) => c.id === call.channel));
      const roster = call.joined ? current?.users || [] : lobby;
      usersById.clear();
      for (const user of lobby) usersById.set(user.id, user);
      for (const channel of voice) for (const user of channel.users) usersById.set(user.id, user);
      if (me?.id != null && !usersById.has(me.id)) usersById.set(me.id, me);
      speakingIds = new Set([...usersById.values()].filter((u) => u.speaking).map((u) => u.id));
      shell.classList.toggle('is-reduced', !!model.reduceMotion);
      text($('.mg-room-label strong'), room.name); attr($('.mg-room-button'), 'aria-label', `Opções da sala: ${room.name}`);
      avatar($('.mg-room-icon'), room.name, room.color, room.icon);
      text($('.mg-room-code'), room.code); show($('.mg-room-code'), room.code);
      text($('.mg-roster-heading h1'), current?.name || 'Lobby');
      text($('.mg-roster-heading > span'), call.joined ? `${count(roster.length, 'pessoa', 'pessoas')} na call` : 'Fora da call');
      text($('.mg-giant'), current?.name || 'Lobby');
      peopleEl.classList.toggle('is-dense', roster.length > 6);
      keyed(peopleEl, people, roster, (u) => u.id, person, patchPerson);
      keyed(facesEl, faces, roster, (u) => u.id, (u) => person(u, 'face'), patchPerson);
      show($('.mg-empty-people'), !roster.length);
      text($('.mg-empty-people'), call.joined ? 'Ninguém neste canal de voz.' : 'Ninguém aguardando fora da call.');
      const dj = $('.mg-dj'); show(dj, call.joined && call.djAvailable);
      dj.classList.toggle('is-playing', !!call.dj); text($('.mg-dj-title b'), call.dj ? 'Tocando agora' : 'Escolher música');
      for (const [sel, on] of [['.mg-mute', call.joined], ['.mg-deafen', call.joined], ['.mg-share', call.joined && call.canShare], ['.mg-music', call.joined && call.djAvailable], ['.mg-leave', call.joined]]) show($(sel), on);
      toggleControl($('.mg-mute'), call.muted, 'mic', 'micOff', 'Silenciar microfone', 'Reativar microfone');
      toggleControl($('.mg-deafen'), call.deafened, 'headphones', 'headphonesOff', 'Desativar áudio', 'Reativar áudio');
      toggleControl($('.mg-share'), call.sharing, 'screen', 'screenOff', 'Transmitir tela', 'Parar transmissão');
      disable($('.mg-mute'), call.deafened); $('.mg-music').classList.toggle('is-on', !!call.dj);
      keyed($('.mg-voice-list'), channels, voice, (c) => c.id, (c) => {
        const el = node('button', 'mg-voice-row'); el.type = 'button';
        el.innerHTML = `${glyph('volume', 17)}<strong></strong><small></small>${glyph('chevronRight', 17)}`;
        el.onclick = () => actions.joinVoice(c.id);
        return { el, name: el.querySelector('strong'), info: el.querySelector('small') };
      }, ({ el, name, info }, c) => {
        text(name, c.name); text(info, c.here ? 'Você está aqui' : c.users.length ? count(c.users.length, 'pessoa', 'pessoas') : 'Vazio');
        attr(el, 'aria-label', c.here ? `${c.name}, você está aqui` : `Entrar em ${c.name}`); disable(el, c.here);
      });
      show($('.mg-empty-voice'), !voice.length); text($('.mg-about'), room.about); show($('.mg-about'), room.about);
      keyed(livePanels, lives, live, (l) => l.uid, mountLive, patchLive, releaseLive);
      keyed($('.mg-live-list'), liveTabs, live, (l) => l.uid, (item) => {
        const el = node('button', 'mg-live-tab'); el.type = 'button'; el.onclick = () => selectLive(item.uid); return { el };
      }, ({ el }, item) => { text(el, item.name); attr(el, 'title', `Ver a live de ${item.name}`); });
      show($('.mg-stage-idle'), !live.length); show(livePanels, live.length); show($('.mg-live-list'), live.length > 1);
      const best = live.find((l) => l.stream) || live.find((l) => l.watching) || live[0];
      if (!lives.has(activeLive)) setBig(false);
      selectLive(lives.has(activeLive) ? activeLive : best?.uid);
      const latest = model.chat.messages.at(-1), unread = model.text.filter((c) => c.unread).length;
      text(strip.querySelector('b'), latest?.system ? 'Sistema' : latest?.name || 'Conversa');
      text(strip.querySelector(':scope > span'), latest?.text || (latest?.files ? 'Enviou um anexo' : model.chat.channel ? `#${model.chat.channel.name}` : 'Canais de texto'));
      text(strip.querySelector('em'), unread); show(strip.querySelector('em'), unread > 0);
      attr(strip, 'aria-label', unread ? `Abrir conversa (${count(unread, 'canal não lido', 'canais não lidos')})` : 'Abrir conversa (C)');
      if (chatOpen) renderChat();
      if (menuOpen) renderMenu();
    }
    $('.mg-room-button').onclick = (e) => actions.roomMenu(e.currentTarget);
    for (const [selector, action] of [['.mg-invite', 'invite'], ['.mg-profile', 'profile'], ['.mg-mute', 'toggleMute'], ['.mg-deafen', 'toggleDeafen'], ['.mg-share', 'toggleShare'], ['.mg-leave', 'leaveVoice'], ['.mg-music', 'openDJ'], ['.mg-dj', 'openDJ']]) $(selector).onclick = () => actions[action]();
    $('.mg-menu-close').onclick = () => showMenu(false); $('.mg-chat-close').onclick = () => showChat(false);
    menuButton.onclick = () => showMenu(true); strip.onclick = () => showChat(!chatOpen);
    cascade.addEventListener('pointerover', (e) => {
      const link = e.target.closest('.mg-menu-link');
      if (!link || menuRows.get(activeMenu)?.el === link) return;
      for (const [key, { el }] of menuRows) if (el === link) { chooseMenu(key, false); break; }
    }, opts);
    input.oninput = () => show($('.mg-chat-error'), false);
    $('.mg-composer').onsubmit = (e) => {
      e.preventDefault();
      const value = input.value.trim(); if (!value) return;
      const sent = actions.send(value); show($('.mg-chat-error'), !sent);
      if (sent) input.value = '';
      input.focus();
    };
    input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); input.form.requestSubmit(); } };
    // Tab abre a cascata a partir do palco; em controles e campos, preserva a navegação nativa.
    function hostOverlay() {
      return !!document.querySelector('#modal-root > *, #room-menu:not(.hidden), #ctx-menu:not(.hidden), .lightbox, .floating-dj');
    }
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.altKey || e.metaKey || hostOverlay() || document.fullscreenElement) return;
      const target = e.target;
      if (target instanceof Element && !shell.contains(target) && target !== document.body && target !== document.documentElement) return;
      if (menuOpen) {
        if (e.key === 'Escape') { e.preventDefault(); showMenu(false); return; }
        const keys = menuOrder;
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const i = keys.indexOf(activeMenu), next = e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : (i + (e.key === 'ArrowUp' ? -1 : 1) + keys.length) % keys.length;
          chooseMenu(keys[next], true);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (target === $('.mg-menu-close')) chooseMenu(activeMenu, true); else $('.mg-menu-close').focus();
        } else if ((e.key === 'Enter' || e.key === ' ') && target !== $('.mg-menu-close')) {
          e.preventDefault(); (target.closest?.('.mg-menu-link') || menuRows.get(activeMenu)?.el)?.click();
        }
        return;
      }
      if (e.key === 'Escape' && chatOpen) { e.preventDefault(); showChat(false); return; }
      if (target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || e.shiftKey || e.repeat) return;
      if (e.key === 'Tab' && !chatOpen && !target.closest?.('button, a, [tabindex="0"]')) { e.preventDefault(); showMenu(true); }
      else if (e.key.toLowerCase() === 'c') { e.preventDefault(); showChat(!chatOpen); }
      else if (e.key === 'Escape' && big) { e.preventDefault(); setBig(false); }
      else if (e.key.toLowerCase() === 'f' && !chatOpen && lives.get(activeLive)?.ready) { e.preventDefault(); if (big) requestFull(lives.get(activeLive)); else setBig(true); }
    }, opts);
    shell.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('button, a, input, textarea, [tabindex="0"], video') && !menuOpen && !chat.contains(e.target)) shell.focus({ preventScroll: true });
    }, opts);
    return {
      update,
      shortcut(a) { if (a === 'chat') showChat(!chatOpen); if (a === 'liveFull') requestFull(lives.get(activeLive)); },
      speaking(ids) {
        speakingIds = ids;
        for (const records of [people, faces]) for (const [id, { el }] of records) el.classList.toggle('is-speaking', ids.has(id));
        if (menuOpen) for (const user of menuRows.get(activeMenu)?.item.people || []) previewRows.get(`Voz:${user.id}`)?.el.classList.toggle('is-speaking', ids.has(user.id));
      },
      unmount() {
        abort.abort();
        for (const record of lives.values()) releaseLive(record);
        root.replaceChildren();
      },
    };
  }
  let room;
  window.ResenhaSkins.register('mergulho', {
    mount(root, actions) { room = mount(root, actions); },
    update(model) { room?.update(model); },
    speaking(ids) { room?.speaking(ids); },
    shortcut(a) { room?.shortcut(a); },
    unmount() { room?.unmount(); room = null; },
  });
})();
