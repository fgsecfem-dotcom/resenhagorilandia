// Sintonia: o guia de TV, o monitor e o letreiro usam o retrato da sala do Resenha.
(() => {
  const I = (name, size = 20, cls) => window.icon(name, size, cls);
  const guideIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"/></svg>';
  const tvIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="m7 2 5 5 5-5"/></svg>';
  const hour = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const text = (el, value = '') => { if (el.textContent !== String(value)) el.textContent = value; };
  const attr = (el, key, value) => { if (el.getAttribute(key) !== String(value)) el.setAttribute(key, value); };
  const hide = (el, value) => el.toggleAttribute('hidden', !!value);
  const prop = (el, key, value) => { if (el[key] !== value) el[key] = value; };
  const css = (el, name, value) => { if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value); };
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
  const time = (ts) => Number.isFinite(ts) && Math.abs(ts) <= 8.64e15 ? hour.format(ts) : '';
  const color = (value) => /^#[\da-f]{6}$/i.test(value || '') ? value : '#67b9a0';
  const liveChip = '<span class="sn-live-chip">Ao vivo</span>';
  let state;

  function railButton(action, label, graphic, extra = '') {
    return `<button type="button" class="sn-rb" data-sn="${action}" title="${label}" aria-label="${label}" ${extra}>${graphic}</button>`;
  }

  const avatar = (cls = '') => `<span class="sn-av ${cls}" aria-hidden="true"><span></span><img alt="" hidden></span>`;
  function avatarImage(src) {
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;
    try {
      const url = new URL(src, document.baseURI);
      if (url.protocol === 'blob:' && url.origin === location.origin) return url.href;
      if (/^https?:$/.test(url.protocol) && url.origin === location.origin) return url.href;
      if (location.protocol === 'file:' && url.protocol === 'file:' && !url.host && url.href.startsWith(new URL('./', document.baseURI).href)) return url.href;
    } catch { /* O monograma continua disponível para uma imagem inválida. */ }
    return '';
  }

  function paintAvatar(el, name, tint, src, letters = 1) {
    text(el.firstElementChild, (name || '?').trim().split(/\s+/).slice(0, letters).map(word => Array.from(word)[0] || '?').join('').toLocaleUpperCase('pt-BR'));
    const tintHex = color(tint);
    if (el.style.getPropertyValue('--sn-avatar') !== tintHex) {
      const [r, g, b] = tintHex.slice(1).match(/../g).map((c) => {
        const srgb = parseInt(c, 16) / 255;
        return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
      });
      // Branco ou preto, conforme o contraste WCAG com a cor real de cada perfil.
      css(el, '--sn-avatar-fg', .2126 * r + .7152 * g + .0722 * b > .179 ? '#000' : '#fff');
      css(el, '--sn-avatar', tintHex);
    }
    if (el.imageSource === src) return;
    el.imageSource = src;
    const img = el.lastElementChild, url = avatarImage(src);
    hide(img, true);
    if (url) img.src = url;
    else img.removeAttribute('src');
  }

  function staticMarkup() {
    return `<div class="sn">
      <nav class="sn-rail" aria-label="Controles da Sintonia">
        <button type="button" class="sn-room" data-sn="room" data-room-menu aria-haspopup="menu">${avatar()}</button>
        ${railButton('guide', 'Guia de canais', guideIcon)}
        ${railButton('monitor', 'Monitor', tvIcon)}
        ${railButton('home', 'Início', I('home'))}
        <span class="sn-rail-spacer"></span>
        <div class="sn-voice-controls" hidden>
          ${railButton('mute', 'Microfone', I('mic'), 'aria-pressed="false"')}
          ${railButton('deafen', 'Áudio', I('headphones'), 'aria-pressed="false"')}
          ${railButton('share', 'Compartilhar tela', I('screen'), 'aria-pressed="false"')}
          ${railButton('dj', 'DJ', I('music'), 'aria-pressed="false"')}
          ${railButton('leave', 'Sair da call', I('phoneOff'))}
        </div>
        <hr>
        ${railButton('settings', 'Configurações', I('settings'))}
        ${railButton('profile', 'Meu perfil', avatar())}
      </nav>
      <header class="sn-top">
        <div class="sn-brand">SINTONIA<span aria-hidden="true">${I('signal', 16)}</span></div>
        <span class="sn-top-room sn-ellipsis"></span>
        <button type="button" class="sn-btn sn-invite" data-sn="invite">${I('userPlus', 17)}<span>Convidar</span></button>
      </header>
      <div class="sn-stage">
        <section class="sn-guide" aria-label="Guia de canais">
          <header class="sn-gh">
            <div class="sn-guide-intro">
              <div class="sn-bar"><span class="sn-ellipsis"></span></div>
              <h2>Guia de canais</h2>
              <p class="sn-about"></p>
              <div class="sn-guide-meta"><span class="sn-guide-total"></span><span class="sn-code" hidden></span></div>
            </div>
            <button type="button" class="sn-prev" data-sn="monitor">
              <span class="sn-prev-screen"><span class="sn-prev-tag">MONITOR</span><span class="sn-prev-roster"></span></span>
              <span class="sn-prev-strip"><span class="sn-ellipsis"></span>${I('chevronRight', 17)}</span>
            </button>
          </header>
          <div class="sn-rows">
            <div class="sn-cols" aria-hidden="true"><span>Canal</span><span>No ar agora</span><span>Atividade</span><span>Selecionar</span></div>
            <section aria-label="Canais de voz"><h3>Voz</h3><div class="sn-voice-rows"></div><p class="sn-no-voice" hidden>Não há canais de voz.</p></section>
            <section aria-label="Canais de texto"><h3>Texto</h3><div class="sn-text-rows"></div><p class="sn-no-text" hidden>Não há canais de texto.</p></section>
          </div>
          <div class="sn-guide-foot"><span>${I('signal', 16)} Programação da sala</span><span class="sn-guide-count"></span></div>
        </section>
        <section class="sn-center" aria-label="Monitor" hidden>
          <div class="sn-mon sn-people-monitor">
            <header class="sn-bug"><div><h2></h2><span class="sn-ellipsis"></span></div><div class="sn-monitor-count"><b></b><span></span></div></header>
            <div class="sn-tune" hidden></div>
            <div class="sn-studio">
              <div class="sn-roda" aria-label="Pessoas no monitor"></div>
              <p class="sn-nobody" hidden>Ninguém neste monitor ainda.</p>
            </div>
            <div class="sn-lower">
              <div class="sn-lt">
                <div class="face">${avatar()}</div>
                <div class="main"><h3 class="sn-ellipsis"></h3><h4></h4></div>
                <div class="side"><b class="sn-ellipsis"></b><span></span></div>
                <div class="strip"><span class="sn-ellipsis sn-station-status"></span><button type="button" data-sn="guide">Ver guia ${I('chevronRight', 15)}</button></div>
              </div>
              <div class="sn-speaker-stack"></div>
            </div>
          </div>
          <div class="sn-reception" role="status" hidden>
            <div>${tvIcon}<p></p><button type="button" class="sn-btn" data-sn="stop-view">Voltar ao monitor</button></div>
          </div>
          <div class="sn-mon is-live" hidden></div>
          <div class="sn-lt sn-live-details" hidden>
            <div class="face">${avatar()}</div>
            <div class="main"><h3 class="sn-ellipsis"></h3><h4>${liveChip}<span></span></h4></div>
            <div class="side"><b class="sn-ellipsis"></b><div class="sn-live-roster" aria-label="Pessoas no canal"></div></div>
            <div class="strip"><span class="sn-video-size sn-ellipsis"></span><div class="sn-live-actions">
              <select aria-label="Escolher transmissão" hidden></select>
              <button type="button" data-sn="stop-view"><span></span>${I('x', 15)}</button>
              <button type="button" data-sn="fullscreen" title="Tela cheia" aria-label="Tela cheia">${I('maximize', 17)}</button>
            </div></div>
          </div>
        </section>
      </div>
      <footer class="sn-footer">
        <div class="sn-footer-status"><span aria-hidden="true"></span><b class="sn-ellipsis"></b></div>
        <button type="button" class="sn-chat-toggle" data-sn="chat" aria-controls="sn-chat" aria-expanded="false">
          <span class="sn-chat-label">${I('chat', 17)}<b>Chat</b></span>
          <span class="sn-footer-channel sn-ellipsis"></span><span class="sn-footer-last sn-ellipsis"></span>
          <span class="sn-chat-unread" hidden></span>${I('chevronDown', 17, 'sn-chat-chevron')}
        </button>
      </footer>
      <aside class="sn-chat" id="sn-chat" aria-label="Chat da sala" hidden>
        <header><h2 class="sn-ellipsis"></h2><button type="button" data-sn="chat-channels" title="Escolher canal no guia" aria-label="Escolher canal no guia">${guideIcon}</button>
          <button type="button" data-sn="chat-close" title="Fechar chat" aria-label="Fechar chat">${I('x', 18)}</button></header>
        <div class="sn-msgs" tabindex="0" role="log" aria-live="polite" aria-label="Mensagens recentes"><div class="sn-msg-list"></div><p class="sn-chat-empty">Nenhuma mensagem neste canal.</p></div>
        <form class="sn-compose"><input type="text" autocomplete="off" aria-label="Mensagem"><button type="submit" title="Enviar mensagem" aria-label="Enviar mensagem">${I('send', 19)}</button></form>
      </aside>
    </div>`;
  }

  function element(tag, cls, markup) {
    const el = document.createElement(tag);
    el.className = cls;
    if (markup) el.innerHTML = markup; // Só trechos estáticos; dados da sala entram como texto e atributos.
    return el;
  }

  // Cada chave conserva seu nó, inclusive foco, rolagem e imagens já carregadas.
  function list(parent, items, key, create, paint) {
    const cache = parent.snNodes ??= new Map();
    const keep = new Set();
    items.forEach((item, i) => {
      const id = key(item);
      keep.add(id);
      let el = cache.get(id);
      if (!el) { el = create(); cache.set(id, el); }
      paint(el, item, i);
      if (parent.children[i] !== el) parent.insertBefore(el, parent.children[i] || null);
    });
    for (const [id, el] of cache) {
      if (!keep.has(id)) { el.remove(); cache.delete(id); }
    }
  }

  function faceList(parent, users, interactive = false) {
    list(parent, users, u => u.id, () => {
      const el = element(interactive ? 'button' : 'span', 'sn-mini-face', avatar());
      if (interactive) { el.type = 'button'; el.dataset.sn = 'user'; }
      return el;
    }, (el, u) => {
      paintAvatar(el.firstElementChild, u.name, u.color, u.avatar);
      prop(el, 'title', u.name);
      if (interactive) { attr(el, 'aria-label', `Opções de ${u.name}`); el.snUid = u.id; }
    });
  }

  function control(el, label, graphic, active, off = false) {
    if (el.snIcon !== graphic) { el.innerHTML = I(graphic); el.snIcon = graphic; }
    attr(el, 'title', label);
    attr(el, 'aria-pressed', !!active);
    el.classList.toggle('is-off', off);
  }

  function paintRail({ room, me, call }) {
    const { b, q } = state;
    paintAvatar(b.room.firstElementChild, room.name, room.color, room.icon, 2);
    attr(b.room, 'aria-label', `Menu da sala: ${room.name}`);
    prop(b.room, 'title', `Menu da sala: ${room.name}`);
    paintAvatar(b.profile.firstElementChild, me.name, me.color, me.avatar);
    prop(b.profile, 'title', `Meu perfil: ${me.name}`);
    hide(q('.sn-voice-controls'), !call.joined);
    control(b.mute, call.muted ? 'Ativar microfone' : 'Silenciar microfone', call.muted ? 'micOff' : 'mic', call.muted, call.muted);
    control(b.deafen, call.deafened ? 'Ativar áudio' : 'Desativar áudio', call.deafened ? 'headphonesOff' : 'headphones', call.deafened, call.deafened);
    control(b.share, call.sharing ? 'Alterar ou parar transmissão' : 'Compartilhar tela', 'screen', call.sharing);
    control(b.dj, call.dj ? 'Abrir DJ Resenha' : 'Chamar DJ Resenha', 'music', call.dj);
    prop(b.share, 'disabled', !call.canShare);
    hide(b.dj, !call.djAvailable);
    text(q('.sn-top-room'), room.name);
    prop(q('.sn-top-room'), 'title', room.name);
  }

  function channelRows(parent, channels, type, model, last) {
    const voice = type === 'voice';
    list(parent, channels, c => c.id, () => {
      const el = element('button', 'sn-row', `<span class="sn-cell-name">${I(voice ? 'volume' : 'hash', 16)}<b class="sn-ellipsis"></b></span>
        <span class="sn-cell-program">${liveChip}<span class="sn-row-desc sn-ellipsis"></span></span>
        <span class="sn-cell-activity"><span class="sn-row-faces"></span><span class="sn-ellipsis"></span></span>
        <span class="sn-cell-action"><span></span>${I('chevronRight', 16)}</span>`);
      el.type = 'button';
      el.dataset.sn = type;
      el.snParts = { name: el.querySelector('b'), live: el.querySelector('.sn-live-chip'), desc: el.querySelector('.sn-row-desc'), activity: el.querySelector('.sn-cell-activity').lastElementChild, faces: el.querySelector('.sn-row-faces'), action: el.querySelector('.sn-cell-action span') };
      return el;
    }, (el, c) => {
      const here = voice ? c.here : c.active;
      const users = voice ? c.users : [];
      const live = voice && users.find(u => u.sharing || model.live.some(l => l.uid === u.id));
      const desc = voice ? (live ? live.name : users.length ? users.map(u => u.name).join(', ') : 'Canal livre')
        : (c.active && last ? describe(last) : 'Conversa da sala');
      const activity = voice ? count(users.length, 'pessoa', 'pessoas') : c.unread ? 'Não lidas' : c.active && last ? time(last.ts) : '—';
      const p = el.snParts;
      el.snId = c.id;
      el.classList.toggle('is-tuned', !!here);
      el.classList.toggle('is-unread', !!c.unread);
      attr(el, 'aria-current', !!here);
      attr(el, 'aria-label', `Canal de ${voice ? 'voz' : 'texto'} ${c.name}${voice ? ', ' + activity : c.unread ? ', mensagens novas' : ''}`);
      text(p.name, c.name);
      text(p.desc, desc);
      prop(p.desc, 'title', desc);
      text(p.activity, activity);
      text(p.action, here ? (voice ? 'Sintonizado' : 'Atual') : voice ? 'Entrar' : 'Abrir');
      hide(p.live, !live);
      hide(p.faces, !users.length);
      if (voice) faceList(p.faces, users.slice(0, 3));
    });
  }

  function paintGuide(model, people, channel, online, last) {
    const { q } = state;
    const { room, voice, text: channels, call } = model;
    const intro = room.about || (call.joined ? 'Troque de canal sem perder a programação da sala.' : 'Escolha um canal de voz para entrar na conversa.');
    text(q('.sn-bar span'), room.name);
    text(q('.sn-about'), intro);
    prop(q('.sn-about'), 'title', intro);
    text(q('.sn-guide-total'), count(online, 'pessoa na sala', 'pessoas na sala'));
    text(q('.sn-guide-count'), `${voice.length} de voz · ${channels.length} de texto`);
    text(q('.sn-code'), room.code);
    hide(q('.sn-code'), !room.code);
    text(q('.sn-prev-strip span'), channel ? `Sintonizado em: ${channel.name}` : 'Ver pessoas na sala');
    faceList(q('.sn-prev-roster'), people.slice(0, 5));
    channelRows(q('.sn-voice-rows'), voice, 'voice', model, last);
    channelRows(q('.sn-text-rows'), channels, 'text', model, last);
    hide(q('.sn-no-voice'), voice.length > 0);
    hide(q('.sn-no-text'), channels.length > 0);
  }

  function paintPeople(model, people, channel) {
    const { q } = state;
    const name = channel?.name || 'Fora da call';
    const { room, call } = model;
    text(q('.sn-bug h2'), name);
    text(q('.sn-bug .sn-ellipsis'), room.name);
    text(q('.sn-monitor-count b'), people.length);
    text(q('.sn-monitor-count span'), call.joined ? 'na call' : 'fora da voz');
    hide(q('.sn-nobody'), people.length > 0);
    const roster = q('.sn-roda');
    attr(roster, 'data-size', Math.min(people.length, 5));
    list(roster, people, u => u.id, () => {
      const el = element('button', 'sn-seat', `${avatar()}<span class="sn-seat-name">${I('micOff', 15, 'sn-seat-muted')}${I('headphonesOff', 15, 'sn-seat-deaf')}${I('music', 15, 'sn-seat-bot')}<b class="sn-ellipsis"></b></span><span class="sn-seat-status">${liveChip}<span></span></span>`);
      el.type = 'button'; el.dataset.sn = 'user';
      return el;
    }, (el, u) => {
      el.snUid = u.id;
      const sharing = u.sharing || model.live.some(l => l.uid === u.id);
      paintAvatar(el.firstElementChild, u.name, u.color, u.avatar);
      text(el.querySelector('b'), u.name);
      el.querySelector('b').style.color = window.readableColor?.(u.nameColor || u.color, '#00477e') || '';
      hide(el.querySelector('.sn-seat-muted'), !u.muted || u.deafened);
      hide(el.querySelector('.sn-seat-deaf'), !u.deafened);
      hide(el.querySelector('.sn-seat-bot'), !u.bot);
      hide(el.querySelector('.sn-live-chip'), !sharing);
      text(el.querySelector('.sn-seat-status > span:last-child'), sharing ? '' : u.me ? 'Você' : u.deafened ? 'Áudio desligado' : u.muted ? 'Microfone mudo' : u.bot ? 'DJ' : '');
      attr(el, 'aria-label', `Opções de ${u.name}${sharing ? ', ao vivo' : ''}${u.deafened ? ', áudio desligado' : u.muted ? ', microfone mudo' : ''}`);
      prop(el, 'title', u.name);
    });
    const lower = q('.sn-lower');
    const active = model.live.length;
    const status = active ? count(active, 'transmissão disponível', 'transmissões disponíveis')
      : call.joined ? 'Sem transmissão no monitor' : 'Escolha um canal de voz no guia';
    paintAvatar(lower.querySelector('.face .sn-av'), room.name, room.color, room.icon, 2);
    text(lower.querySelector('.sn-lt > .main h3'), call.joined ? 'Na escuta' : 'Sala sintonizada');
    text(lower.querySelector('.sn-lt > .main h4'), call.joined ? 'CANAL DE VOZ' : 'VOCÊ ESTÁ FORA DA CALL');
    text(lower.querySelector('.sn-lt > .side b'), 'SINTONIA');
    text(lower.querySelector('.sn-lt > .side span'), channel ? name : 'Guia de programação');
    text(q('.sn-station-status'), `${call.joined ? 'VOZ' : 'SALA'}  ·  ${status}`);
    list(q('.sn-speaker-stack'), call.joined ? people : [], u => u.id,
      () => element('div', 'sn-lt sn-speaker', `<div class="face">${avatar()}</div><div class="main"><h3 class="sn-ellipsis"></h3><h4>FALANDO AGORA</h4></div>`),
      (el, u) => {
        paintAvatar(el.querySelector('.sn-av'), u.name, u.color, u.avatar);
        text(el.querySelector('h3'), u.name);
      });
  }

  function paintTune(lives, model) {
    const tune = state.q('.sn-tune');
    const invites = lives.filter(l => !l.watching || l.me);
    hide(tune, !invites.length);
    list(tune, invites, l => l.uid, () => {
      const el = element('button', 'sn-tune-button', `${liveChip}<span class="sn-ellipsis"></span><b></b>${I('play', 14)}`);
      el.type = 'button'; el.dataset.sn = 'watch';
      return el;
    }, (el, live) => {
      el.snUid = live.uid;
      text(el.children[1], live.me ? 'Sua transmissão' : live.name);
      text(el.children[2], live.me ? 'Ver prévia' : 'Assistir');
      attr(el, 'aria-label', live.me ? 'Ver prévia da sua transmissão' : `Assistir à transmissão de ${live.name}${model.call.joined ? '' : ' (entra no canal de voz)'}`);
    });
  }

  function resizeVideo() {
    const { video, q } = state;
    const { videoWidth: w, videoHeight: h } = video;
    if (!video.srcObject || !w || !h) return;
    css(q('.sn-center'), '--ar', String(w / h));
    text(q('.sn-video-size'), `TELA  ·  ${w} × ${h}`);
    state.videoReady = true;
    showSurface();
  }

  function paintLive(live, choices, people, channel, model) {
    const { q, video } = state;
    const stream = live?.stream ?? null;
    if (video.srcObject !== stream) {
      state.videoReady = false;
      q('.sn-center').style.removeProperty('--ar');
      text(q('.sn-video-size'), 'TELA');
      video.srcObject = stream;
    }
    if (!live) return;
    const lower = q('.sn-live-details');
    const user = state.users.get(live.uid);
    const liveChannel = channel || model.voice.find(c => c.id === user?.voice);
    paintAvatar(lower.querySelector('.face .sn-av'), live.name, user?.color, user?.avatar);
    text(lower.querySelector('h3'), live.name);
    text(lower.querySelector('h4 > span:last-child'), live.me ? 'Você está transmitindo' : 'Compartilhando tela');
    text(lower.querySelector('.side b'), liveChannel?.name || model.room.name);
    faceList(q('.sn-live-roster'), (liveChannel?.users || people).slice(0, 5), true);
    text(q('.sn-reception p'), live.me ? 'Abrindo a prévia da sua tela…' : `Conectando à transmissão de ${live.name}…`);
    attr(lower.querySelector('[data-sn="stop-view"]'), 'aria-label', live.me ? 'Ocultar prévia da sua transmissão' : 'Sair da transmissão');
    text(lower.querySelector('[data-sn="stop-view"] span'), live.me ? 'Pessoas' : 'Sair da live');
    const select = lower.querySelector('select');
    hide(select, choices.length < 2);
    list(select, choices, l => l.uid, () => document.createElement('option'), (el, l, i) => {
      prop(el, 'value', String(i));
      text(el, l.me ? `${l.name} (você)` : l.name);
    });
    prop(select, 'value', String(choices.indexOf(live)));
  }

  function describe(msg) {
    return msg.text.trim() ? `${msg.system ? '' : `${msg.name || 'Participante'}: `}${msg.text}` : count(msg.files || 0, 'anexo', 'anexos');
  }

  function paintChat(model, recent) {
    const { q, drafts } = state;
    const channel = model.chat.channel;
    const input = q('.sn-compose input'), scroller = q('.sn-msgs');
    const switched = state.channelId !== channel?.id;
    if (switched) {
      if (state.channelId != null) drafts.set(state.channelId, input.value);
      state.channelId = channel?.id;
      input.value = drafts.get(channel?.id) || '';
    }
    text(q('.sn-chat h2'), channel ? `#${channel.name}` : 'Chat');
    text(q('.sn-footer-channel'), channel ? `#${channel.name}` : 'Sem canal');
    prop(input, 'placeholder', channel ? `Conversar em #${channel.name}` : 'Nenhum canal de texto');
    prop(input, 'disabled', !channel);
    prop(q('.sn-compose button'), 'disabled', !channel);
    const last = recent.at(-1);
    text(q('.sn-footer-last'), last ? describe(last) : 'Nenhuma mensagem recente');
    const unread = model.text.filter(c => c.unread).length;
    text(q('.sn-chat-unread'), count(unread, 'canal não lido', 'canais não lidos'));
    hide(q('.sn-chat-unread'), !unread);
    hide(q('.sn-chat-empty'), recent.length > 0);
    const scrollToEnd = state.chatOpen && (switched || (state.lastMessage !== last?.id && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 28));
    list(q('.sn-msg-list'), recent, (m) => m.id, () => element('div', 'sn-msg', `${avatar()}<div><b class="sn-ellipsis"></b><time></time></div><p></p><span class="sn-attachments" hidden></span>`), (el, m) => {
      el.classList.toggle('is-mine', !!m.me);
      el.classList.toggle('is-system', !!m.system);
      const user = state.users.get(m.uid);
      paintAvatar(el.firstElementChild, m.name, m.color || user?.color, user?.avatar);
      text(el.querySelector('b'), m.system ? 'Sala' : m.name || 'Participante');
      el.querySelector('b').style.color = m.system ? '' : window.readableColor?.(m.nameColor || m.color, m.me ? '#cdd9f7' : '#17151a') || '';
      text(el.querySelector('time'), time(m.ts));
      hide(el.querySelector('p'), !m.text);
      text(el.querySelector('p'), m.text);
      text(el.querySelector('.sn-attachments'), count(m.files || 0, 'anexo', 'anexos'));
      hide(el.querySelector('.sn-attachments'), !m.files);
    });
    if (scrollToEnd) scroller.scrollTop = scroller.scrollHeight;
    state.lastMessage = last?.id;
  }

  function showSurface() {
    const { q, b, mode, activeLive, videoReady } = state;
    const center = q('.sn-center'), guide = mode === 'guide';
    hide(q('.sn-guide'), !guide);
    hide(center, guide);
    hide(q('.sn-people-monitor'), !!activeLive);
    hide(q('.sn-reception'), !activeLive || videoReady);
    hide(q('.sn-mon.is-live'), !activeLive || !videoReady);
    hide(q('.sn-live-details'), !activeLive || !videoReady);
    center.classList.toggle('is-live', !!activeLive && videoReady);
    attr(b.guide, 'aria-pressed', guide);
    attr(b.monitor, 'aria-pressed', !guide);
  }

  function setMode(mode) {
    state.mode = mode;
    showSurface();
  }

  function setChat(open, focus = true) {
    const { q } = state;
    state.chatOpen = open;
    hide(q('.sn-chat'), !open);
    attr(q('.sn-chat-toggle'), 'aria-expanded', open);
    if (open) {
      const messages = q('.sn-msgs');
      messages.scrollTop = messages.scrollHeight;
      if (focus) (q('.sn-compose input').disabled ? q('[data-sn="chat-close"]') : q('.sn-compose input')).focus();
    } else if (focus) q('.sn-chat-toggle').focus();
  }

  function watch(uid) {
    const { actions, model, lives, users } = state;
    const live = lives.find(l => l.uid === uid);
    if (!live) return;
    state.selectedLive = uid;
    state.hiddenPreview = null;
    state.mode = 'monitor';
    if (live.me || live.watching) update(model);
    else if (model.call.joined) actions.watch(uid, true);
    else {
      const target = model.voice.find(c => c.id === users.get(uid)?.voice || c.users.some(u => u.id === uid));
      if (target) {
        const pending = { uid, channel: target.id };
        state.pendingWatch = pending;
        const clearPending = () => { if (state?.pendingWatch === pending) state.pendingWatch = null; };
        Promise.resolve(actions.joinVoice(target.id)).then(clearPending, clearPending);
      } else actions.watch(uid, true);
    }
  }

  function userMenu(e, el) {
    if (e.type === 'contextmenu' || e.detail) state.actions.userMenu(e, el.snUid);
    else {
      const r = el.getBoundingClientRect();
      state.actions.userMenu(new MouseEvent('contextmenu', { clientX: r.left + r.width / 2, clientY: r.bottom }), el.snUid);
      e.stopPropagation();
    }
  }

  function onClick(e) {
    const el = e.target.closest('[data-sn]');
    if (!el) return;
    const { actions, model, activeLive, q } = state;
    switch (el.dataset.sn) {
      case 'room': actions.roomMenu(el); break;
      case 'home': actions.home(); break;
      case 'invite': actions.invite(); break;
      case 'settings': actions.settings(); break;
      case 'profile': actions.profile(); break;
      case 'guide': setMode('guide'); if (el.closest('.sn-stage')) state.b.guide.focus(); break;
      case 'monitor': setMode('monitor'); if (el.closest('.sn-stage')) state.b.monitor.focus(); break;
      case 'mute': actions.toggleMute(); break;
      case 'deafen': actions.toggleDeafen(); break;
      case 'share': actions.toggleShare(); break;
      case 'dj': actions.openDJ(); break;
      case 'leave': actions.leaveVoice(); break;
      case 'voice':
        state.pendingWatch = null;
        if (model.call.joined && model.call.channel === el.snId) { setMode('monitor'); state.b.monitor.focus(); }
        else actions.joinVoice(el.snId);
        break;
      case 'text': actions.selectText(el.snId); setChat(true); break;
      case 'chat': setChat(!state.chatOpen); break;
      case 'chat-close': setChat(false); break;
      case 'chat-channels': {
        setChat(false, false);
        setMode('guide');
        const rows = q('.sn-text-rows');
        (rows.querySelector('.is-tuned') || rows.firstElementChild || state.b.guide).focus();
        break;
      }
      case 'watch': watch(el.snUid); break;
      case 'stop-view':
        if (!activeLive) break;
        state.selectedLive = null;
        if (activeLive.me) { state.hiddenPreview = activeLive.uid; update(model); }
        else actions.watch(activeLive.uid, false);
        state.b.monitor.focus();
        break;
      case 'fullscreen': actions.fullscreen(state.video); break;
      case 'user': userMenu(e, el); break;
    }
  }

  function mount(root, actions) {
    root.innerHTML = staticMarkup();
    const shell = root.firstElementChild, nodes = new Map();
    const q = (selector) => {
      if (!nodes.has(selector)) nodes.set(selector, shell.querySelector(selector));
      return nodes.get(selector);
    };
    const b = Object.fromEntries([...q('.sn-rail').querySelectorAll('button')].map(el => [el.dataset.sn, el]));
    const video = element('video', 'sn-video');
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    q('.sn-mon.is-live').append(video);
    const listeners = new AbortController(), { signal } = listeners;
    state = { actions, q, b, video, shell, listeners, watches: new Set(), drafts: new Map(), mode: 'guide', chatOpen: false };
    shell.addEventListener('click', onClick, { signal });
    shell.addEventListener('contextmenu', (e) => {
      const el = e.target.closest('[data-sn="user"]');
      if (el) userMenu(e, el);
    }, { signal });
    shell.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.chatOpen && !e.defaultPrevented) {
        e.preventDefault();
        setChat(false);
      }
    }, { signal });
    shell.addEventListener('load', (e) => { if (e.target.matches('.sn-av img')) hide(e.target, false); }, { signal, capture: true });
    shell.addEventListener('error', (e) => { if (e.target.matches('.sn-av img')) hide(e.target, true); }, { signal, capture: true });
    q('.sn-live-details select').addEventListener('change', (e) => {
      const live = state.lives[Number(e.target.value)];
      if (live) watch(live.uid);
    }, { signal });
    q('.sn-compose').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.currentTarget.querySelector('input'), value = input.value.trim();
      if (value && state.model.chat.channel && state.actions.send(value)) input.value = '';
    }, { signal });
    video.addEventListener('loadedmetadata', resizeVideo, { signal });
    video.addEventListener('resize', resizeVideo, { signal });
    video.addEventListener('dblclick', () => {
      if (document.fullscreenElement === video) document.exitFullscreen();
      else actions.fullscreen(video);
    }, { signal });
  }

  function update(model) {
    const { q } = state;
    state.model = model;
    const { voice, lobby, call, live, chat } = model;
    const channel = call.joined ? voice.find(c => c.id === call.channel || c.here) : null;
    const users = new Map([model.me, ...lobby, ...voice.flatMap(c => c.users)].map(u => [u.id, u]));
    const people = call.joined ? (channel?.users || []) : lobby;
    const recent = chat.messages.slice(-12);
    const readable = recent.findLast(m => m.text.trim() || m.files);
    state.users = users;
    state.lives = live;
    if (state.joined !== call.joined || state.voiceChannel !== call.channel) state.mode = call.joined ? 'monitor' : 'guide';
    state.joined = call.joined;
    state.voiceChannel = call.channel;
    if (!live.some(l => l.uid === state.hiddenPreview)) state.hiddenPreview = null;
    const watching = live.filter(l => l.watching && l.uid !== state.hiddenPreview);
    if (watching.some(l => !state.watches.has(l.uid))) state.mode = 'monitor';
    state.watches = new Set(watching.map(l => l.uid));
    state.activeLive = watching.find(l => l.uid === state.selectedLive) || watching.find(l => !l.me) || watching[0] || null;
    state.shell.classList.toggle('sn-reduced', !!model.reduceMotion);
    state.shell.classList.toggle('sn-joined', !!call.joined);
    paintRail(model);
    paintGuide(model, people, channel, [...users.values()].filter(u => !u.bot).length, readable);
    paintPeople(model, people, channel);
    paintTune(live, model);
    paintLive(state.activeLive, live, people, channel, model);
    paintChat(model, recent);
    text(q('.sn-footer-status b'), call.joined ? `Voz conectada · ${channel?.name || 'Canal de voz'}` : 'Fora da call');
    showSurface();
    speaking(new Set([...users.values()].filter(u => u.speaking).map(u => u.id)));
    const pending = state.pendingWatch;
    if (call.joined && call.channel === pending?.channel && pending) {
      state.pendingWatch = null;
      if (live.some(l => l.uid === pending.uid)) state.actions.watch(pending.uid, true);
    }
  }

  function speaking(ids) {
    const { q } = state;
    const roster = q('.sn-roda').snNodes;
    const minis = q('.sn-live-roster').snNodes;
    const labels = q('.sn-speaker-stack').snNodes;
    let first;
    for (const el of roster?.values() || []) {
      const talking = ids.has(el.snUid);
      if (talking && first === undefined) first = el.snUid;
      el.classList.toggle('is-speaking', talking);
    }
    for (const [id, el] of minis || []) el.classList.toggle('is-speaking', ids.has(id));
    for (const [id, el] of labels || []) el.classList.toggle('is-current', id === first);
  }

  function unmount() {
    state.listeners.abort();
    state.video.pause();
    state.video.srcObject = null;
    state = null;
  }

  window.ResenhaSkins.register('sintonia', { mount, update, speaking, unmount });
})();
