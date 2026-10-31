// Player de música opcional, com a conta Spotify de cada pessoa. Desligado por padrão: desligado, nada é criado
// na tela, nenhum script do Spotify é carregado e nenhum timer roda. A reprodução usa o SDK oficial do Spotify
// (Electron da Castlabs com Widevine); login e token ficam no processo principal (spotify.js).
// A fila é do Resenha (a API do Spotify não deixa reordenar nem remover). Cada música toca dentro da sua origem
// (playlist ou álbum), então o Spotify segue sozinho quando ela acaba. Se houver fila, o Resenha entra com a
// próxima dela e, quando a fila acaba, volta para onde a origem parou (como a fila do app do Spotify).
// O "autoplay" de recomendações do Spotify não existe na API para apps novos, por isso a origem é o que continua.
export function createMusic({ settings, saveSettings, icon, toast: showToast, roomUI, native, esc, room }) {
  const $ = (s, r = document) => r.querySelector(s);
  // O toast do app é (mensagem, tipo, tempo): aqui juntamos título e texto para a mensagem não sumir.
  const toast = (title, msg, ms, type = '') => showToast(msg ? `${title}: ${msg}` : title, type, ms);
  let sp = native?.spotify;
  const st = { els: null, status: null, player: null, device: null, state: null, prev: null, at: 0, raf: 0, vol: settings.musicVolume ?? 60, sdk: null, busy: false,
    queue: [], history: [], results: [], current: null, advancing: false, resume: null, manual: false, lists: null, view: 'now',
    jam: { role: null, host: null, guests: new Set(), invites: new Set(), last: null, beat: 0 } };
  // Volume com curva perceptual: a metade de baixo do controle ajusta mais fino; 100% continua sendo o máximo do Spotify.
  const gain = (v) => Math.pow(v / 100, 2);
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const skipBack = () => icon('skip', 20).replace('<svg', '<svg style="transform:scaleX(-1)"');
  const blank = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#2a2a2e"/></svg>');
  const track = (t) => ({ uri: t.uri, id: t.id, name: t.name, artists: (t.artists || []).map((a) => a.name).join(', '), img: (t.album?.images || []).at(-1)?.url || '', cover: t.album?.images?.[0]?.url || '', ms: t.duration_ms || 0,
    ctx: t.album?.uri ? { uri: t.album.uri, name: t.album.name || 'álbum', kind: 'album' } : null });

  async function api(p, opt = {}) {
    const t = await sp.token(); if (t.error) throw Error(t.error);
    const r = await fetch('https://api.spotify.com/v1' + p, { ...opt, headers: { Authorization: 'Bearer ' + t.token, 'Content-Type': 'application/json' } });
    if (r.status === 204 || r.status === 202) return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) throw Error(j?.error?.message || 'Spotify respondeu ' + r.status);
    return j;
  }
  function loadSDK() {
    if (st.sdk) return st.sdk;
    st.sdk = new Promise((resolve, reject) => {
      if (window.Spotify) return resolve();
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.onerror = () => { st.sdk = null; reject(Error('Não consegui carregar o player do Spotify.')); };
      document.head.append(s);
    });
    return st.sdk;
  }
  async function startPlayer() {
    if (st.player || !st.status?.connected || !st.status?.drm) return;
    await loadSDK();
    const player = st.player = new window.Spotify.Player({ name: 'Resenha', volume: gain(st.vol), getOAuthToken: (cb) => sp.token().then((t) => t.token ? cb(t.token) : problem(t.error)) });
    player.addListener('ready', ({ device_id }) => { st.device = device_id; render(); });
    player.addListener('not_ready', () => { st.device = null; render(); });
    player.addListener('player_state_changed', onState);
    player.addListener('initialization_error', (e) => problem('O player do Spotify não iniciou: ' + e.message));
    player.addListener('authentication_error', () => { problem('O Spotify pediu para conectar de novo.'); sp.logout().then(refreshStatus); });
    player.addListener('account_error', () => problem('Tocar dentro do Resenha precisa de Spotify Premium.'));
    player.addListener('playback_error', (e) => problem('Não consegui tocar essa música (' + (e.message || 'erro') + ').'));
    await player.connect();
  }
  function onState(s) {
    const prev = st.state; st.state = s; st.at = performance.now();
    // Fim da música: estava tocando perto do fim e voltou parada no começo da mesma faixa → toca a próxima da fila.
    if (s && prev && !prev.paused && s.paused && s.position === 0 && prev.track_window?.current_track?.id === s.track_window?.current_track?.id
        && prev.duration - pos(prev) < 4000 && !st.advancing && st.jam.role !== 'guest') next();
    const raw = s?.track_window?.current_track, pu = prev?.track_window?.current_track?.uri;
    if (raw?.uri && pu && raw.uri !== pu) trackChanged(raw);
    else if (raw?.uri && st.current && !st.current.uri) st.current = { ...track(raw), ctx: st.current.ctx }; // tocou a playlist do começo
    const sig = (x) => (x?.track_window?.next_tracks || []).map((t) => t.uri).join();
    render(); loop(); jamBroadcast(); emitInfo(); if (sig(prev) !== sig(s) && !st.els?.panel.querySelector('.mu-q.lifting')) renderQueue(); // não troca a lista no meio de um arrastar
    if (st.jam.role === 'guest' && st.jam.last) jamFollow(st.jam.last);
  }
  // Ilha do jogo: quem quiser acompanha a música (faixa, pausa, volume) e controla pelos mesmos caminhos dos botões do player.
  const watchers = new Set();
  function overlayInfo() {
    const s = st.state, t = s?.track_window?.current_track; if (!t) return null;
    return { title: t.name, artist: (t.artists || []).map((a) => a.name).join(', '), cover: t.album?.images?.at(-1)?.url || '', paused: !!s.paused, pos: Math.round(pos()), dur: s.duration, vol: st.vol, at: Date.now() };
  }
  function emitInfo() { if (!watchers.size) return; const i = overlayInfo(); watchers.forEach((fn) => fn(i)); }
  function control(a, v) {
    if (a === 'toggle') { if (jamAsk(st.state?.paused ? 'resume' : 'pause')) return; st.player?.togglePlay(); }
    else if (a === 'next') { if (!jamAsk('next')) next(); }
    else if (a === 'prev') { if (!jamAsk('prev')) previous(); }
    else if (a === 'duck') { st.duck = !!v; st.player?.setVolume(gain(st.vol) * (st.duck ? 0.4 : 1)); }
    else if (a === 'vol' && Number.isFinite(v)) { st.vol = Math.round(Math.max(0, Math.min(100, v))); st.player?.setVolume(gain(st.vol) * (st.duck ? 0.4 : 1)); settings.musicVolume = st.vol; saveSettings(); emitInfo(); }
  }
  function stopPlayer() { cancelAnimationFrame(st.raf); st.raf = 0; st.player?.disconnect(); st.player = null; st.device = null; st.state = null; emitInfo(); }
  function problem(msg) { if (st.els) $('.mu-note', st.els.panel).textContent = msg || ''; if (msg) toast('Música', msg, 5000, 'err'); }
  async function refreshStatus() {
    st.status = sp ? await sp.status().catch(() => null) : null;
    if (!st.status?.connected) stopPlayer();
    render(); startPlayer().catch((e) => problem(e.message));
  }
  function pos(s = st.state) { if (!s) return 0; return Math.min(s.duration, s.position + (s.paused || s !== st.state ? 0 : performance.now() - st.at)); }
  function loop() { cancelAnimationFrame(st.raf); const tick = () => { progress(); st.raf = st.state && !st.state.paused && st.els ? requestAnimationFrame(tick) : 0; }; tick(); }

  // ---------- Fila ----------
  // t.ctx = origem (playlist ou álbum): toca a faixa dentro dela para o Spotify continuar sozinho depois.
  // t sem uri e com ctx = tocar a origem inteira do começo.
  async function playNow(t, startMs = 0) {
    if (!st.device) return problem('O player ainda está iniciando, tenta de novo em um segundo.');
    if (st.current?.uri && st.current.uri !== t.uri) st.history.push(st.current);
    st.current = t; st.advancing = true; renderQueue();
    const at = startMs > 0 ? { position_ms: Math.round(startMs) } : {};
    const send = (body) => api('/me/player/play?device_id=' + st.device, { method: 'PUT', body: JSON.stringify({ ...body, ...at }) });
    try {
      st.player.activateElement?.();
      if (t.ctx) { try { await send({ context_uri: t.ctx.uri, ...(t.uri ? { offset: { uri: t.uri } } : {}) }); } catch (e) { if (!t.uri) throw e; await send({ uris: [t.uri] }); } }
      else await send({ uris: [t.uri] });
      problem('');
    } catch (e) { problem(e.message); }
    finally { setTimeout(() => { st.advancing = false; }, 1500); }
  }
  // A faixa mudou sem ser pelo Resenha: o Spotify passou para a próxima da origem (ou foi o próximo/anterior dela).
  function trackChanged(raw) {
    const ctx = st.current?.ctx || null, now = { ...track(raw), ctx };
    if (raw.uri === st.current?.uri) return; // é a música que o próprio Resenha pediu (confirmação atrasada)
    if (st.advancing || st.jam.role === 'guest') { if (st.current && st.current.uri !== raw.uri && !st.manual) st.current = { ...now, ctx: st.current.ctx }; return; }
    if (!st.manual && (st.queue.length || st.resume)) {
      if (!st.resume && ctx) st.resume = now; // guarda onde a origem parou para voltar depois da fila
      return next();
    }
    st.manual = false;
    if (st.current) st.history.push(st.current);
    st.current = now; renderQueue();
  }
  function next() {
    const t = st.queue.shift();
    if (t) playNow(t);
    else if (st.resume) { const r = st.resume; st.resume = null; playNow(r); }
    else if (st.current?.ctx && st.player) { st.manual = true; st.player.nextTrack(); setTimeout(() => { st.manual = false; }, 2500); }
    else st.player?.pause();
    renderQueue();
  }
  function previous() {
    if (pos() > 3000) return st.player?.seek(0);
    if (st.history.length) { const t = st.history.pop(); if (st.current?.uri) st.queue.unshift(st.current); st.current = null; return playNow(t); }
    if (st.current?.ctx && st.player) { st.manual = true; st.player.previousTrack(); setTimeout(() => { st.manual = false; }, 2500); return; }
    st.player?.seek(0);
  }
  function enqueue(t) {
    if (jamAsk('add', { track: wire(t) })) return toast('Na fila', t.name + ' (pedido enviado a ' + uname(st.jam.host) + ')', 2200);
    st.queue.push(t); renderQueue(); toast('Na fila', t.name, 1800);
  }

  function mount() {
    if (st.els) return;
    const nav = $('#chat .right-nav'), chat = $('#chat'), side = $('#sidebar'), vp = $('#voice-panel');
    if (!nav || !chat || !side) return;
    const tab = document.createElement('button'); tab.dataset.right = 'music'; tab.setAttribute('aria-pressed', 'false'); tab.className = 'mu-tab';
    tab.title = 'Música (Spotify)'; tab.setAttribute('aria-label', 'Música (Spotify)');
    // Ícone do Spotify com acabamento de cada tema (music.css): cromado, vidro iridescente, pintura, globo espelhado…
    tab.innerHTML = `<svg class="sp-logo" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <defs>
        <linearGradient id="sp-chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a3f"/><stop offset=".55" stop-color="#0b0b0c"/><stop offset="1" stop-color="#1c1c1f"/></linearGradient>
        <linearGradient id="sp-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#6b6b70"/><stop offset="1" stop-color="#d8d8dc"/></linearGradient>
        <linearGradient id="sp-iri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--sp-i1, #ff5fd2)"/><stop offset=".35" stop-color="var(--sp-i2, #6ad7ff)"/><stop offset=".7" stop-color="var(--sp-i3, #8a6bff)"/><stop offset="1" stop-color="var(--sp-i4, #ffd36a)"/></linearGradient>
        <radialGradient id="sp-glass" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="rgba(255,255,255,.22)"/><stop offset=".6" stop-color="rgba(255,255,255,.04)"/><stop offset="1" stop-color="rgba(255,255,255,.08)"/></radialGradient>
        <linearGradient id="sp-paint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fdc9a"/><stop offset=".3" stop-color="#1f8f5a"/><stop offset=".55" stop-color="#5fc8a6"/><stop offset=".8" stop-color="#0f5c3c"/><stop offset="1" stop-color="#3aa36f"/></linearGradient>
        <filter id="sp-brush"><feTurbulence type="fractalNoise" baseFrequency=".9 .12" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter>
        <pattern id="sp-disco" width="2.2" height="2.2" patternUnits="userSpaceOnUse"><rect width="2.2" height="2.2" fill="#0d7a3a"/><rect x=".15" y=".15" width="1.9" height="1.9" rx=".25" fill="#26c462"/><rect x=".3" y=".3" width=".8" height=".6" fill="#b9ffd2" opacity=".55"/></pattern>
      </defs>
      <circle class="sp-c" cx="12" cy="12" r="10.4"/>
      <g class="sp-a" fill="none" stroke-linecap="round"><path d="M6.6 9.4c3.5-1.05 7.7-.8 11 1.15"/><path d="M7.1 12.4c2.9-.85 6.4-.62 9.1 1"/><path d="M7.7 15.2c2.3-.62 4.8-.43 6.9.8"/></g>
      <path class="sp-spark" d="M19.6 3.2l.45 1.2 1.2.45-1.2.45-.45 1.2-.45-1.2-1.2-.45 1.2-.45z"/></svg>`;
    nav.insertBefore(tab, $('.right-close', nav)); tab.onclick = () => roomUI?.open('music');
    const panel = document.createElement('div'); panel.className = 'right-music';
    panel.innerHTML = `<div class="mu-ambient" aria-hidden="true"></div>
      <form class="mu-searchbox"><span class="mu-search-ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span><input class="mu-search" type="search" placeholder="Buscar no Spotify" aria-label="Buscar música no Spotify"><button type="button" class="icon-btn mu-search-x hidden" aria-label="Fechar busca">${icon('x', 16)}</button></form>
      <div class="mu-results hidden" role="listbox" aria-label="Resultados da busca"></div>
      <div class="mu-views" role="tablist" aria-label="Música"><button role="tab" data-mv="now" class="on" aria-selected="true">Tocando</button><button role="tab" data-mv="lists" aria-selected="false">Playlists</button></div>
      <div class="mu-lists" role="tabpanel" aria-label="Suas playlists"></div>
      <div class="mu-main">
        <div class="mu-now"><div class="mu-art"><img class="mu-cover" alt="">
          <div class="mu-vol" role="slider" tabindex="0" aria-label="Volume da música (só para você)" aria-valuemin="0" aria-valuemax="100"><i class="mu-vol-fill"></i><span class="mu-vol-ic"></span></div></div>
          <div class="mu-meta"><b class="mu-title"></b><span class="mu-artist"></span></div>
          <div class="mu-progress"><div class="mu-bar" role="slider" tabindex="0" aria-label="Posição da música" aria-valuemin="0" aria-valuemax="100"><i class="mu-bar-fill"></i><i class="mu-knob"></i></div>
            <div class="mu-times"><span class="mu-pos">0:00</span><span class="mu-left">-0:00</span></div></div>
          <div class="mu-controls"><button class="icon-btn mu-prev" title="Anterior" aria-label="Anterior">${skipBack()}</button><button class="mu-play" aria-label="Tocar"></button><button class="icon-btn mu-next" title="Próxima" aria-label="Próxima">${icon('skip', 20)}</button></div></div>
        <div class="mu-jam"><button class="btn mu-jam-btn">${icon('userPlus', 16)}<span>Ouvir junto</span></button><div class="mu-jam-info"></div></div>
        <div class="mu-jam-pick hidden" role="listbox" aria-label="Convidar para ouvir junto"></div>
        <div class="mu-queue"><div class="mu-label">A seguir <span class="mu-count"></span></div><div class="mu-list" aria-label="Fila: arraste para reordenar, deslize para remover"></div><p class="mu-after"></p></div>
        <p class="mu-note muted small"></p>
        <div class="mu-connect"><div><b>Spotify</b><span class="mu-connect-text"></span></div><button class="btn mu-key" title="Usar a sua própria chave do Spotify">Minha chave</button><button class="btn mu-login"></button></div>
      </div>
      <div class="mu-guide hidden" role="dialog" aria-label="Criar minha chave do Spotify"></div>`;
    chat.append(panel);
    const mini = document.createElement('div'); mini.id = 'music-mini';
    mini.innerHTML = `<div class="mu-ambient" aria-hidden="true"></div><button class="mm-open" title="Abrir o player"><img class="mu-cover" alt=""><span class="mm-text"><b class="mu-title"></b><span class="mu-artist"></span></span><i class="mm-eq" aria-hidden="true"><b></b><b></b><b></b></i></button>
      <button class="icon-btn mm-play" aria-label="Tocar"></button><button class="icon-btn mu-next" title="Próxima" aria-label="Próxima">${icon('skip', 16)}</button><i class="mm-bar" aria-hidden="true"></i>`;
    side.insertBefore(mini, vp || $('#user-panel'));
    st.els = { tab, panel, mini };
    const toggle = () => { if (jamAsk(st.state?.paused ? 'resume' : 'pause')) return; st.player ? st.player.togglePlay() : roomUI?.open('music'); };
    $('.mu-play', panel).onclick = toggle; $('.mm-play', mini).onclick = toggle;
    [panel, mini].forEach((r) => { $('.mu-next', r).onclick = () => { if (!jamAsk('next')) next(); }; });
    $('.mu-prev', panel).onclick = () => { if (!jamAsk('prev')) previous(); };
    $('.mm-open', mini).onclick = () => openFromMini();
    // O mini player é a aba de música "recolhida": some com a aba aberta e volta (com a capa voando) quando ela fecha.
    st.miniObs = new MutationObserver(syncMini);
    [$('#main'), chat].forEach((el) => el && st.miniObs.observe(el, { attributes: true, attributeFilter: ['data-right-open', 'data-view', 'class'] }));
    syncMini(true);
    bindBar($('.mu-bar', panel)); bindVolume($('.mu-vol', panel));
    $('.mu-jam-btn', panel).onclick = jamButton;
    panel.querySelectorAll('.mu-views button').forEach((b) => b.onclick = () => setView(b.dataset.mv));
    const input = $('.mu-search', panel);
    $('.mu-searchbox', panel).onsubmit = (e) => { e.preventDefault(); search(input.value); };
    $('.mu-search-x', panel).onclick = closeSearch;
    input.onkeydown = (e) => { if (e.key === 'Escape') closeSearch(); };
    input.oninput = () => { clearTimeout(st.typing); const q = input.value; if (!q.trim()) return closeSearch(true); st.typing = setTimeout(() => search(q), 300); };
    $('.mu-login', panel).onclick = async () => {
      if (st.busy) return;
      if (st.status?.connected) { await sp.logout(); stopPlayer(); return refreshStatus(); }
      connect();
    };
    $('.mu-key', panel).onclick = () => openKeyGuide(0);
    refreshStatus();
  }
  async function connect() {
    st.busy = true; render();
    const r = await sp.login(); st.busy = false;
    if (!r.ok && r.error !== 'Login fechado.') problem(r.error);
    await refreshStatus();
    // Conta fora da chave padrão: já abre o passo a passo para a pessoa criar a dela.
    if (!r.ok && !st.status?.ownKey && /não está liberada/.test(r.error || '')) openKeyGuide(0);
  }

  // ---------- Minha chave do Spotify ----------
  // No modo de desenvolvimento, cada chave (Client ID) do Spotify aceita poucas contas. Este passo a passo ensina a
  // pessoa a criar o próprio app no painel do Spotify e colar o Client ID aqui. Uma tela por etapa, frases curtas.
  const DASHBOARD = 'https://developer.spotify.com/dashboard', REDIRECT_URI = 'http://127.0.0.1:8888/callback';
  const KEY_STEPS = [
    { t: 'Por que criar uma chave?', p: ['O Spotify só deixa cada chave ser usada por poucas pessoas. Com a sua própria chave, você toca música no Resenha sem depender de ninguém.', 'É grátis e leva uns 5 minutos. Você só precisa da sua conta Spotify Premium.'] },
    { t: 'Abra o painel do Spotify', p: ['Toque no botão abaixo. O site abre no seu navegador.', 'Entre com a <b>mesma conta</b> que você usa para ouvir música. Se o Spotify pedir, aceite os termos de desenvolvedor.'], act: 'open' },
    { t: 'Crie um app', p: ['No painel, clique em <b>Create app</b>.', 'Em <b>App name</b> e <b>App description</b>, escreva qualquer coisa, por exemplo <i>Meu Resenha</i>. O campo <b>Website</b> pode ficar vazio.'] },
    { t: 'Cole o endereço de retorno', p: ['No campo <b>Redirect URIs</b>, cole o endereço abaixo e clique em <b>Add</b>.', 'Ele precisa ficar igualzinho, sem espaço no fim.'], act: 'copy' },
    { t: 'Marque as opções e salve', p: ['Na pergunta <b>Which API/SDKs are you planning to use?</b>, marque <b>Web API</b> e <b>Web Playback SDK</b>.', 'Marque a caixa que aceita os termos e clique em <b>Save</b>.'] },
    { t: 'Copie o Client ID', p: ['Abra o app que você criou e clique em <b>Settings</b>. Copie o <b>Client ID</b> (32 letras e números) e cole aqui.', 'Não use o <b>Client secret</b>: é outro código e deve ficar só com você.'], act: 'key' },
  ];
  const isClientId = (s) => /^[0-9a-f]{32}$/i.test(s);
  function openKeyGuide(step = 0) { if (!st.els) return; st.keyStep = step; $('.mu-guide', st.els.panel).classList.remove('hidden'); renderKeyGuide(); }
  function closeKeyGuide() { if (st.els) $('.mu-guide', st.els.panel).classList.add('hidden'); }
  function renderKeyGuide() {
    const g = $('.mu-guide', st.els.panel), i = st.keyStep, s = KEY_STEPS[i], last = i === KEY_STEPS.length - 1;
    let extra = '';
    if (s.act === 'open') extra = '<button class="btn primary mu-g-open">Abrir o painel do Spotify</button>';
    if (s.act === 'copy') extra = `<div class="mu-g-code"><code>${REDIRECT_URI}</code><button class="btn mu-g-copy">Copiar</button></div>`;
    if (s.act === 'key') extra = `<form class="mu-g-form"><input class="mu-g-input" placeholder="Cole o Client ID aqui" spellcheck="false" autocomplete="off" aria-label="Client ID">
        <p class="mu-g-msg" role="alert"></p><button class="btn primary">Salvar e conectar</button></form>
      <p class="mu-empty">Se o Spotify mostrar <b>Invalid redirect URI</b>, volte ao passo 4 e confira o endereço.</p>
      ${st.status?.ownKey ? '<button class="btn mu-g-reset">Voltar para a chave padrão</button>' : ''}`;
    g.innerHTML = `<div class="mu-g-head"><span>Passo ${i + 1} de ${KEY_STEPS.length}</span><button class="icon-btn mu-g-x" aria-label="Fechar">${icon('x', 16)}</button></div>
      <div class="mu-g-dots" aria-hidden="true">${KEY_STEPS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <h3>${s.t}</h3>${s.p.map((x) => `<p>${x}</p>`).join('')}${extra}
      <div class="mu-g-nav">${i ? '<button class="btn mu-g-back">Voltar</button>' : '<span></span>'}${last ? '' : '<button class="btn primary mu-g-next">Próximo</button>'}</div>`;
    $('.mu-g-x', g).onclick = closeKeyGuide;
    const go = (d) => { st.keyStep = i + d; renderKeyGuide(); };
    if (i) $('.mu-g-back', g).onclick = () => go(-1);
    if (!last) $('.mu-g-next', g).onclick = () => go(1);
    if (s.act === 'open') $('.mu-g-open', g).onclick = () => native?.openExternal?.(DASHBOARD);
    if (s.act === 'copy') $('.mu-g-copy', g).onclick = (e) => {
      const b = e.currentTarget;
      navigator.clipboard.writeText(REDIRECT_URI).then(() => { b.textContent = 'Copiado!'; }, () => {
        getSelection().selectAllChildren($('.mu-g-code code', g)); // plano B: seleciona e copia do jeito antigo
        b.textContent = document.execCommand('copy') ? 'Copiado!' : 'Use Ctrl+C';
      });
    };
    if (s.act === 'key') {
      const input = $('.mu-g-input', g), msg = $('.mu-g-msg', g);
      $('.mu-g-form', g).onsubmit = async (e) => {
        e.preventDefault();
        const v = input.value.replace(/\s+/g, '');
        if (!isClientId(v)) { msg.textContent = 'Isso não parece um Client ID. Ele tem 32 letras e números, sem espaços.'; return input.focus(); }
        const r = await sp.setClientId(v);
        if (!r?.ok) { msg.textContent = r?.error || 'Não consegui salvar a chave.'; return; }
        stopPlayer(); closeKeyGuide(); await refreshStatus(); connect();
      };
      input.focus();
      if (st.status?.ownKey) $('.mu-g-reset', g).onclick = async () => { await sp.setClientId(''); stopPlayer(); closeKeyGuide(); refreshStatus(); };
    }
  }
  // Barra de progresso no estilo do macOS: fina, engrossa ao passar o mouse e mostra a bolinha; arrastar muda a posição.
  function bindBar(bar) {
    let dragging = false;
    const at = (e) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
    bar.addEventListener('pointerdown', (e) => { if (!st.state) return; bar.setPointerCapture(e.pointerId); dragging = true; bar.classList.add('drag'); preview(at(e)); });
    bar.addEventListener('pointermove', (e) => { if (dragging) preview(at(e)); });
    bar.addEventListener('pointerup', (e) => { if (!dragging) return; dragging = false; bar.classList.remove('drag'); const p = at(e); st.preview = null; if (st.state) { if (jamAsk('seek', { ms: Math.round(p * st.state.duration) })) { progress(); return; } st.state = { ...st.state, position: p * st.state.duration }; st.at = performance.now(); st.player?.seek(Math.round(p * st.state.duration)); } progress(); });
    bar.addEventListener('keydown', (e) => { if (!st.state) return; const d = e.key === 'ArrowRight' ? 5000 : e.key === 'ArrowLeft' ? -5000 : 0; if (d) { e.preventDefault(); const ms = Math.max(0, Math.round(pos() + d)); if (!jamAsk('seek', { ms })) st.player?.seek(ms); } });
    function preview(p) { st.preview = p; progress(); }
  }
  // Volume em pílula vertical ao lado da capa: arrastar, rodinha do mouse e setas; ícone muda as ondas; efeito elástico nos limites.
  function bindVolume(el) {
    const fill = $('.mu-vol-fill', el), ic = $('.mu-vol-ic', el);
    let last = '';
    const draw = (over = 0) => {
      el.style.setProperty('--v', String(st.vol / 100)); el.setAttribute('aria-valuenow', String(st.vol));
      const k = st.vol === 0 ? 'zero' : st.vol < 34 ? 'low' : 'high';
      if (k !== last) { last = k; ic.innerHTML = volumeIcon(k); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      el.classList.toggle('dark-ic', st.vol > 18);
      el.style.transformOrigin = over > 0 ? '50% 100%' : '50% 0%';
      el.style.transform = over ? `scaleY(${1 + Math.min(0.06, Math.abs(over) * 0.2)})` : '';
    };
    const apply = (v, over = 0) => { st.vol = Math.round(Math.max(0, Math.min(100, v))); st.player?.setVolume(gain(st.vol)); draw(over); clearTimeout(apply.t); apply.t = setTimeout(() => { settings.musicVolume = st.vol; saveSettings(); }, 300); };
    const fromY = (e) => { const r = el.getBoundingClientRect(), raw = (r.bottom - e.clientY) / r.height; apply(raw * 100, raw > 1 ? raw - 1 : raw < 0 ? raw : 0); };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.classList.add('drag'); fromY(e); });
    el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture(e.pointerId)) fromY(e); });
    el.addEventListener('pointerup', () => { el.classList.remove('drag'); draw(0); });
    el.addEventListener('wheel', (e) => { e.preventDefault(); apply(st.vol - Math.sign(e.deltaY) * 5); }, { passive: false });
    el.addEventListener('keydown', (e) => { const d = e.key === 'ArrowUp' ? 5 : e.key === 'ArrowDown' ? -5 : 0; if (d) { e.preventDefault(); apply(st.vol + d); } });
    draw();
  }
  function volumeIcon(k) {
    const w1 = '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>', w2 = '<path d="M18.5 7a7 7 0 0 1 0 10"/>', x = '<path d="M16 10l4 4M20 10l-4 4"/>';
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/>${k === 'zero' ? x : k === 'low' ? w1 : w1 + w2}</svg>`;
  }
  async function search(q) {
    q = q.trim(); const box = st.els && $('.mu-results', st.els.panel); if (!q || !box) return;
    const ticket = st.ticket = (st.ticket || 0) + 1;
    try {
      const r = await api('/search?type=track&limit=10&q=' + encodeURIComponent(q));
      if (ticket !== st.ticket) return; // chegou depois de uma busca mais nova
      st.results = (r?.tracks?.items || []).map(track);
      box.innerHTML = st.results.length ? st.results.map((t, i) => `<div class="mu-item mu-result" data-i="${i}"><button class="mu-hit" data-i="${i}" title="Tocar agora"><img src="${esc(t.img || blank)}" alt=""><span><b>${esc(t.name)}</b><span>${esc(t.artists)}</span></span></button><span class="mu-item-dur">${fmt(t.ms)}</span><button class="icon-btn mu-add" data-i="${i}" title="Adicionar à fila" aria-label="Adicionar ${esc(t.name)} à fila">${icon('plus', 16)}</button></div>`).join('') : '<p class="muted small">Nada encontrado.</p>';
      box.querySelectorAll('.mu-hit').forEach((b) => b.onclick = () => { pick(st.results[+b.dataset.i]); closeSearch(); });
      box.querySelectorAll('.mu-add').forEach((b) => b.onclick = () => { enqueue(st.results[+b.dataset.i]); b.classList.add('done'); b.innerHTML = icon('check', 16); });
      openSearch();
    } catch (e) { problem(e.message); }
  }
  function openSearch() { const p = st.els.panel; p.classList.add('searching'); $('.mu-results', p).classList.remove('hidden'); $('.mu-search-x', p).classList.remove('hidden'); }
  function closeSearch(keepText) { if (!st.els) return; st.ticket = (st.ticket || 0) + 1; const p = st.els.panel; p.classList.remove('searching'); $('.mu-results', p).classList.add('hidden'); $('.mu-search-x', p).classList.add('hidden'); if (keepText !== true) $('.mu-search', p).value = ''; }
  // Fila: clicar toca na hora; arrastar (alça) reordena; deslizar para o lado ou × remove.
  // Origem real que o player está tocando (quando a música começou fora do Resenha, st.current não tem ctx).
  function playerCtx() {
    const c = st.state?.context, u = typeof c?.uri === 'string' ? c.uri : '';
    return /^spotify:(playlist|album):/.test(u) ? { uri: u, name: c.metadata?.context_description || c.metadata?.name || '', kind: u.includes(':album:') ? 'album' : 'playlist' } : null;
  }
  const upcoming = () => (st.state?.track_window?.next_tracks || []).filter((t) => typeof t?.uri === 'string' && t.uri.startsWith('spotify:track:')).slice(0, 10).map(track);
  function renderQueue() {
    if (!st.els) return;
    const p = st.els.panel, list = $('.mu-list', p), up = upcoming();
    $('.mu-count', p).textContent = st.queue.length ? String(st.queue.length) : '';
    const c = st.resume?.ctx || st.current?.ctx;
    $('.mu-after', p).textContent = c ? (st.queue.length ? 'Depois da fila, volta ' : 'Continua ') + (c.kind === 'playlist' ? 'na playlist ' : 'no álbum ') + c.name : '';
    list.innerHTML = st.queue.length ? st.queue.map((t, i) => `<div class="mu-item mu-q" data-i="${i}"><span class="mu-grip" aria-hidden="true">⋮⋮</span><button class="mu-hit" data-i="${i}" title="Tocar agora"><img src="${esc(t.img || blank)}" alt=""><span><b>${esc(t.name)}</b><span>${esc(t.artists)}</span></span></button><button class="icon-btn mu-del" data-i="${i}" aria-label="Tirar ${esc(t.name)} da fila">${icon('x', 14)}</button></div>`).join('')
      : (up.length ? '' : `<p class="mu-empty">A fila está vazia. Busque uma música e toque em ${icon('plus', 12)} para adicionar.</p>`);
    // O que o Spotify já tem na sequência (playlist, álbum ou aleatório): só mostra, tocar leva direto para a faixa.
    if (up.length) list.innerHTML += `<div class="mu-up-label">Próximas do Spotify</div>` + up.map((t, i) => `<div class="mu-item mu-up"><button class="mu-up-hit" data-i="${i}" title="Tocar agora"><img src="${esc(t.img || blank)}" alt=""><span><b>${esc(t.name)}</b><span>${esc(t.artists)}</span></span></button></div>`).join('');
    list.querySelectorAll('.mu-up-hit').forEach((b) => b.onclick = () => pick({ ...up[+b.dataset.i], ctx: st.current?.ctx || playerCtx() }, true));
    list.querySelectorAll('.mu-q .mu-hit').forEach((b) => b.onclick = () => { if (b.closest('.mu-q').dataset.moved) return; const [t] = st.queue.splice(+b.dataset.i, 1); renderQueue(); pick(t); });
    list.querySelectorAll('.mu-del').forEach((b) => b.onclick = () => { st.queue.splice(+b.dataset.i, 1); renderQueue(); });
    list.querySelectorAll('.mu-q').forEach(bindRow);
  }
  function bindRow(row) {
    let start = null, mode = null, dy = 0, dx = 0;
    row.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('.mu-del')) return; start = { x: e.clientX, y: e.clientY, h: row.offsetHeight }; mode = null; row.setPointerCapture(e.pointerId); });
    row.addEventListener('pointermove', (e) => {
      if (!start) return; dx = e.clientX - start.x; dy = e.clientY - start.y;
      if (!mode && (Math.abs(dx) > 8 || Math.abs(dy) > 6)) mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'drag';
      if (mode === 'swipe') { row.style.transform = `translateX(${Math.min(0, dx)}px)`; row.style.opacity = String(1 + Math.min(0, dx) / 220); }
      if (mode === 'drag') { row.classList.add('lifting'); row.style.transform = `translateY(${dy}px)`; }
    });
    const end = () => {
      if (!start) return; const i = +row.dataset.i;
      if (mode === 'swipe' && dx < -90) { row.classList.add('gone'); setTimeout(() => { st.queue.splice(i, 1); renderQueue(); }, 160); }
      else if (mode === 'drag') { const to = Math.max(0, Math.min(st.queue.length - 1, i + Math.round(dy / start.h))); const [t] = st.queue.splice(i, 1); st.queue.splice(to, 0, t); row.dataset.moved = '1'; renderQueue(); }
      else { row.style.transform = ''; row.style.opacity = ''; }
      start = null; mode = null;
    };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
  }
  // ---------- Playlists ----------
  function setView(v) {
    if (!st.els) return; st.view = v; const p = st.els.panel;
    p.classList.toggle('view-lists', v === 'lists');
    p.querySelectorAll('.mu-views button').forEach((b) => { const on = b.dataset.mv === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    if (v === 'lists') { closeSearch(); showLists(); }
  }
  const unv1 = (path) => path.replace('https://api.spotify.com/v1', '');
  async function pages(path, max) { const out = []; for (let i = 0; i < max && path; i++) { const r = await api(path); out.push(...(r?.items || []).filter(Boolean)); path = r?.next ? unv1(r.next) : null; } return out; }
  async function needsReconnect() {
    await sp.token().catch(() => null); st.status = await sp.status().catch(() => st.status);
    return !!st.status?.connected && !String(st.status.scopes || '').includes('playlist-read-private');
  }
  async function showLists(force) {
    const box = $('.mu-lists', st.els.panel);
    if (await needsReconnect()) {
      box.innerHTML = `<div class="mu-pl-msg"><b>Falta uma permissão</b><p class="mu-empty">Para mostrar suas playlists, o Spotify precisa que você conecte de novo uma vez.</p><button class="btn primary mu-relogin">Conectar de novo</button></div>`;
      $('.mu-relogin', box).onclick = async () => { await sp.logout(); stopPlayer(); const r = await sp.login(); if (!r.ok && r.error !== 'Login fechado.') problem(r.error); await refreshStatus(); st.lists = null; if (st.view === 'lists') showLists(); };
      return;
    }
    if (!st.lists || force) {
      box.innerHTML = '<p class="mu-empty">Carregando suas playlists…</p>';
      try {
        st.lists = (await pages('/me/playlists?limit=50', 4)).map((pl) => ({ id: pl.id, uri: pl.uri, name: pl.name || 'Sem nome', img: pl.images?.at(-1)?.url || pl.images?.[0]?.url || '', cover: pl.images?.[0]?.url || '',
          total: pl.items?.total ?? pl.tracks?.total ?? null, owner: pl.owner?.display_name || '' }));
      } catch (e) { box.innerHTML = `<p class="mu-empty">Não consegui carregar as playlists (${esc(e.message)}).</p>`; return; }
    }
    if (st.view !== 'lists') return;
    const count = (n) => n == null ? '' : n === 1 ? '1 música' : n + ' músicas';
    box.innerHTML = `<div class="mu-label">Suas playlists <span class="mu-count">${st.lists.length || ''}</span></div>` + (st.lists.length ? st.lists.map((pl, i) => `<div class="mu-item mu-pl"><button class="mu-hit" data-i="${i}" title="Abrir"><img src="${esc(pl.img || blank)}" alt=""><span><b>${esc(pl.name)}</b><span>${esc([count(pl.total), pl.owner].filter(Boolean).join(' · '))}</span></span></button><button class="icon-btn mu-plplay" data-i="${i}" title="Tocar a playlist" aria-label="Tocar ${esc(pl.name)}">${icon('play', 16)}</button></div>`).join('')
      : '<p class="mu-empty">Você ainda não tem playlists no Spotify.</p>');
    box.querySelectorAll('.mu-pl .mu-hit').forEach((b) => b.onclick = () => openPlaylist(st.lists[+b.dataset.i]));
    box.querySelectorAll('.mu-plplay').forEach((b) => b.onclick = () => playList(st.lists[+b.dataset.i]));
  }
  const ctxOf = (pl) => ({ uri: pl.uri, name: pl.name, kind: 'playlist' });
  function playList(pl) { pick({ uri: null, name: pl.name, artists: '', img: pl.img, cover: pl.cover, ms: 0, ctx: ctxOf(pl) }, true); }
  async function openPlaylist(pl) {
    const box = $('.mu-lists', st.els.panel);
    box.innerHTML = `<button class="mu-back">${BACK}<span>Playlists</span></button>
      <div class="mu-pl-head"><img src="${esc(pl.cover || pl.img || blank)}" alt=""><div><b>${esc(pl.name)}</b><span>${esc(pl.owner)}</span><button class="btn primary mu-pl-play">${icon('play', 14)}<span>Tocar</span></button></div></div>
      <div class="mu-pl-tracks"><p class="mu-empty">Carregando…</p></div>`;
    $('.mu-back', box).onclick = () => showLists();
    $('.mu-pl-play', box).onclick = () => playList(pl);
    let items = null;
    try { items = (await pages(`/playlists/${encodeURIComponent(pl.id)}/items?limit=50`, 4)).map((x) => x.item || x.track).filter((t) => t?.uri?.startsWith('spotify:track:')); } catch {}
    const list = $('.mu-pl-tracks', box); if (!list) return; // trocou de tela enquanto carregava
    const ctx = ctxOf(pl);
    if (!items) { list.innerHTML = '<p class="mu-empty">O Spotify só mostra as músicas das playlists que você criou ou em que colabora. Esta dá para tocar inteira no botão acima.</p>'; return; }
    const tracks = items.map((t) => ({ ...track(t), ctx }));
    list.innerHTML = tracks.length ? tracks.map((t, i) => `<div class="mu-item mu-result"><button class="mu-hit" data-i="${i}" title="Tocar agora"><img src="${esc(t.img || blank)}" alt=""><span><b>${esc(t.name)}</b><span>${esc(t.artists)}</span></span></button><span class="mu-item-dur">${fmt(t.ms)}</span><button class="icon-btn mu-add" data-i="${i}" title="Adicionar à fila" aria-label="Adicionar ${esc(t.name)} à fila">${icon('plus', 16)}</button></div>`).join('') : '<p class="mu-empty">Playlist vazia.</p>';
    list.querySelectorAll('.mu-hit').forEach((b) => b.onclick = () => pick(tracks[+b.dataset.i], true));
    list.querySelectorAll('.mu-add').forEach((b) => b.onclick = () => { enqueue(tracks[+b.dataset.i]); b.classList.add('done'); b.innerHTML = icon('check', 16); });
  }
  // ---------- Mini player ↔ aba de música ----------
  const reduced = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tabVisible() { const m = $('#main'); return !!m && !m.classList.contains('hidden') && m.dataset.rightOpen !== 'false' && $('#chat')?.dataset.view === 'music'; }
  function fly(from, to, src, radius) {
    if (!from?.width || !to?.width || reduced()) return null;
    const c = document.createElement('img'); c.className = 'mu-fly'; c.src = src; c.alt = '';
    c.style.cssText = `left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px;border-radius:${radius[1]}`;
    document.body.append(c);
    const a = c.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})`, borderRadius: radius[0] }, { transform: 'none', borderRadius: radius[1] }],
      { duration: 560, easing: 'cubic-bezier(.3,1.15,.4,1)' });
    a.onfinish = a.oncancel = () => c.remove();
    return a;
  }
  function syncMini(first) {
    if (!st.els) return; const { panel, mini } = st.els, show = !tabVisible();
    if (!show) { const r = $('.mu-cover', panel).getBoundingClientRect(); if (r.width) st.coverRect = r; }
    if (first === true || st.miniShown === undefined) { st.miniShown = show; mini.classList.toggle('mm-away', !show); return; }
    if (show === st.miniShown) return; st.miniShown = show;
    if (!show) { mini.classList.add('mm-away'); return; }
    mini.classList.remove('mm-away');
    const cov = $('.mu-cover', mini), from = st.coverRect;
    requestAnimationFrame(() => { const to = cov.getBoundingClientRect(), a = fly(from, to, cov.src, [getComputedStyle($('.mu-cover', panel)).borderRadius, getComputedStyle(cov).borderRadius]); if (a) { cov.style.opacity = '0'; a.finished.catch(() => {}).then(() => { cov.style.opacity = ''; }); } });
  }
  function openFromMini() {
    const { panel, mini } = st.els, cov = $('.mu-cover', mini), from = cov.getBoundingClientRect(), rad = getComputedStyle(cov).borderRadius;
    roomUI?.open('music');
    requestAnimationFrame(() => { const big = $('.mu-cover', panel), to = big.getBoundingClientRect(), a = fly(from, to, cov.src, [rad, getComputedStyle(big).borderRadius]); if (a) { big.style.opacity = '0'; a.finished.catch(() => {}).then(() => { big.style.opacity = ''; }); } });
  }
  function unmount() {
    stopPlayer();
    if (!st.els) return;
    const { tab, panel, mini } = st.els;
    if ($('#chat')?.dataset.view === 'music') roomUI?.open('chat');
    st.miniObs?.disconnect(); st.miniShown = undefined;
    tab.remove(); panel.remove(); mini.remove(); st.els = null;
  }
  function render() {
    if (!st.els) return;
    const { panel, mini } = st.els, s = st.state, t = s?.track_window?.current_track, ok = st.status?.connected;
    const cover = t?.album?.images?.[0]?.url || st.current?.cover || blank, playing = !!s && !s.paused;
    for (const r of [panel, mini]) {
      r.style.setProperty('--mu-cover', t ? `url("${cover}")` : 'none');
      $('.mu-cover', r).src = cover;
      $('.mu-title', r).textContent = t ? t.name : 'Nada tocando';
      $('.mu-artist', r).textContent = t ? t.artists.map((a) => a.name).join(', ') : ok ? 'Busque uma música acima' : 'Conecte seu Spotify';
      r.classList.toggle('playing', playing);
    }
    $('.mu-play', panel).innerHTML = icon(playing ? 'pause' : 'play', 24); $('.mu-play', panel).setAttribute('aria-label', playing ? 'Pausar' : 'Tocar');
    $('.mm-play', mini).innerHTML = icon(playing ? 'pause' : 'play', 16); $('.mm-play', mini).setAttribute('aria-label', playing ? 'Pausar' : 'Tocar');
    $('.mu-searchbox', panel).classList.toggle('hidden', !ok);
    $('.mu-views', panel).classList.toggle('hidden', !ok); if (!ok && st.view !== 'now') setView('now');
    const text = $('.mu-connect-text', panel), btn = $('.mu-login', panel);
    $('.mu-key', panel).classList.toggle('hidden', !st.status?.available);
    if (!st.status?.available) { text.textContent = 'Nesta versão, a música do Spotify funciona só no Resenha para Windows.'; btn.classList.add('hidden'); }
    else if (ok) { text.textContent = 'Conectado como ' + (st.status.user?.name || 'você') + (st.status.ownKey ? ' · chave própria' : '') + (st.device ? '' : ' · iniciando o player…'); btn.textContent = 'Desconectar'; btn.classList.remove('hidden', 'primary'); }
    else { text.textContent = 'Entre uma vez com a sua conta (Premium). O Resenha lembra de você.'; btn.textContent = st.busy ? 'Abrindo…' : 'Conectar Spotify'; btn.classList.remove('hidden'); btn.classList.add('primary'); }
    renderQueue(); renderJam(); progress();
  }
  function progress() {
    if (!st.els) return;
    const s = st.state, dur = s?.duration || 0, cur = st.preview != null ? st.preview * dur : pos(), p = dur ? cur / dur : 0, { panel, mini } = st.els;
    panel.style.setProperty('--p', p); mini.style.setProperty('--p', p);
    $('.mu-bar', panel).setAttribute('aria-valuenow', String(Math.round(p * 100)));
    $('.mu-pos', panel).textContent = fmt(cur); $('.mu-left', panel).textContent = '-' + fmt(dur - cur);
  }
  // ---------- Ouvir junto ----------
  // Cada pessoa toca na própria conta; o Resenha só sincroniza faixa, pausa e posição (mensagens diretas pela sala).
  // O áudio nunca passa pela call. Quem entra pode sair a qualquer momento sem sair da call.
  const jamReset = () => ({ role: null, host: null, guests: new Set(), invites: new Set(), last: null, beat: 0 });
  const jsend = (to, data) => room?.send(to, data);
  const uname = (id) => room?.users().find((u) => u.id === id)?.name || 'Alguém';
  const rnow = () => room?.now() ?? Date.now();
  function jamSnapshot() {
    const s = st.state, t = s?.track_window?.current_track; if (!t) return null;
    return { k: 'state', uri: t.uri, name: t.name, artists: t.artists.map((a) => a.name).join(', '), cover: t.album?.images?.[0]?.url || '', img: t.album?.images?.at(-1)?.url || '', ms: s.duration, pos: Math.round(pos()), paused: s.paused, at: rnow() };
  }
  function jamBroadcast(force) {
    if (st.jam.role !== 'host' || !st.jam.guests.size) return;
    const now = Date.now(); if (!force && now - st.jam.beat < 400) return; st.jam.beat = now;
    const snap = jamSnapshot(); if (snap) st.jam.guests.forEach((g) => jsend(g, snap));
  }
  setInterval(() => { if (st.jam.role === 'host' && st.jam.guests.size) jamBroadcast(true); }, 10000);
  function jamFollow(m) {
    if (!st.player || !st.device) return;
    const expected = m.pos + (m.paused ? 0 : rnow() - m.at);
    const cur = st.state?.track_window?.current_track;
    if (!cur || cur.uri !== m.uri) {
      if (st.jam.switching !== m.uri) { st.jam.switching = m.uri; playNow({ uri: m.uri, name: m.name, artists: m.artists, img: m.img, cover: m.cover, ms: m.ms }, Math.max(0, expected)).then(() => setTimeout(() => { st.jam.switching = null; }, 2500)); }
      return;
    }
    if (!m.paused && expected >= m.ms - 1000) return; // fim da faixa: espera o estado novo do anfitrião, sem reiniciar a velha
    if (m.paused && !st.state.paused) st.player.pause();
    if (!m.paused && st.state.paused) st.player.resume();
    if (Math.abs(pos() - expected) > 1500) st.player.seek(Math.max(0, Math.round(expected)));
  }
  // Convidado também controla: o pedido vai para quem chamou, que toca na própria conta e manda o novo estado para todos.
  function jamAsk(a, extra) {
    if (st.jam.role !== 'guest' || !st.jam.host) return false;
    jsend(st.jam.host, { k: 'ctl', a, ...extra });
    return true;
  }
  // Escolher uma faixa/playlist: o convidado pede ao anfitrião; fora da sessão toca direto.
  const wire = (t) => ({ uri: t.uri || null, name: t.name, artists: t.artists, img: t.img, cover: t.cover, ms: t.ms, ctx: t.ctx ? { uri: t.ctx.uri, name: t.ctx.name } : null });
  function pick(t, resetResume) {
    if (jamAsk('play', { track: wire(t), reset: !!resetResume })) return;
    if (resetResume) st.resume = null;
    playNow(t);
  }
  const ctlTrack = (x) => {
    if (!x || typeof x !== 'object') return null;
    const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
    const uri = x.uri == null ? null : str(x.uri, 80), cu = x.ctx && typeof x.ctx.uri === 'string' ? x.ctx.uri.slice(0, 80) : null;
    if (uri !== null && !/^spotify:track:[A-Za-z0-9]+$/.test(uri)) return null;
    if (cu !== null && !/^spotify:(playlist|album):[A-Za-z0-9]+$/.test(cu)) return null;
    if (uri === null && cu === null) return null;
    const url = (v) => { v = str(v, 300); return /^https:\/\/[A-Za-z0-9.-]+\/[^\s"'()\\]*$/.test(v) ? v : ''; };
    return { uri, name: str(x.name, 200), artists: str(x.artists, 200), img: url(x.img), cover: url(x.cover), ms: Number.isFinite(x.ms) ? x.ms : 0, ...(cu ? { ctx: { uri: cu, name: str(x.ctx.name, 200), kind: cu.startsWith('spotify:album:') ? 'album' : 'playlist' } } : {}) };
  };
  // Anfitrião recebe o pedido de um convidado.
  function jamControl(from, m) {
    if (st.jam.role !== 'host' || !st.jam.guests.has(from) || !st.player) return;
    const now = Date.now(); if (now - (st.jam.ctlAt?.[from] || 0) < 300) return; (st.jam.ctlAt ||= {})[from] = now; // sem enxurrada de pedidos
    const who = uname(from);
    if (m.a === 'pause') { if (st.state && !st.state.paused) st.player.pause(); toast('Ouvir junto', who + ' pausou.', 2000); }
    else if (m.a === 'resume') { if (st.state?.paused) st.player.resume(); toast('Ouvir junto', who + ' deu play.', 2000); }
    else if (m.a === 'next') { next(); toast('Ouvir junto', who + ' pulou a música.', 2000); }
    else if (m.a === 'prev') { previous(); toast('Ouvir junto', who + ' voltou a música.', 2000); }
    else if (m.a === 'seek' && Number.isFinite(m.ms)) st.player.seek(Math.max(0, Math.min(Math.round(m.ms), st.state?.duration || 0)));
    else if (m.a === 'add') { const t = ctlTrack(m.track); if (!t?.uri || st.queue.length >= 100) return; st.queue.push(t); renderQueue(); toast('Ouvir junto', who + ' pôs ' + (t.name || 'uma música') + ' na fila.', 2500); return; }
    else if (m.a === 'play') { const t = ctlTrack(m.track); if (!t) return; if (m.reset) st.resume = null; playNow(t); toast('Ouvir junto', who + ' escolheu ' + (t.name || 'uma música') + '.', 2500); }
    else return;
    setTimeout(() => jamBroadcast(true), 700);
  }
  function jamLeave(quiet) {
    if (st.jam.role === 'guest' && st.jam.host) jsend(st.jam.host, { k: 'leave' });
    if (st.jam.role === 'host') st.jam.guests.forEach((g) => jsend(g, { k: 'end' }));
    st.jam = jamReset();
    if (!quiet) toast('Ouvir junto', 'Sessão encerrada.', 2500);
    render();
  }
  function jamButton() {
    if (st.jam.role === 'guest') return jamLeave();
    const box = $('.mu-jam-pick', st.els.panel); if (!box.classList.contains('hidden')) return box.classList.add('hidden');
    const me = room?.me(), people = (room?.users() || []).filter((u) => u.id !== me && !u.bot && u.id !== 'dj');
    box.innerHTML = people.length ? people.map((u) => `<button class="mu-item mu-jam-person" data-id="${esc(u.id)}"><span class="mu-jam-av" style="background:${esc(u.color || '#555')}">${esc((u.name || '?')[0].toUpperCase())}</span><b>${esc(u.name)}</b><span class="mu-item-dur">${st.jam.guests.has(u.id) ? 'Ouvindo' : st.jam.invites.has(u.id) ? 'Convidado' : 'Convidar'}</span></button>`).join('')
      + (st.jam.role === 'host' ? '<button class="btn mu-jam-end">Encerrar sessão</button>' : '') : '<p class="mu-empty">Ninguém mais na sala agora.</p>';
    box.querySelectorAll('.mu-jam-person').forEach((b) => b.onclick = () => jamInvite(b.dataset.id, b));
    box.querySelector('.mu-jam-end')?.addEventListener('click', () => { jamLeave(); box.classList.add('hidden'); });
    box.classList.remove('hidden');
  }
  function jamInvite(id, btn) {
    const t = st.state?.track_window?.current_track;
    if (!t) return problem('Toque uma música antes de convidar.');
    if (st.jam.guests.has(id)) return;
    st.jam.role = 'host'; st.jam.invites.add(id);
    jsend(id, { k: 'invite', track: t.name + ' · ' + t.artists.map((a) => a.name).join(', ') });
    if (btn) btn.querySelector('.mu-item-dur').textContent = 'Convidado';
    renderJam();
  }
  function jamCard(from, track) {
    document.querySelector('#mu-invite')?.remove();
    const el = document.createElement('div'); el.id = 'mu-invite'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Convite para ouvir junto');
    el.innerHTML = `<div class="mi-ic">${icon('music', 18)}</div><div class="mi-t"><b>${esc(uname(from))} chamou você para ouvir junto</b><span>${esc(track || '')}</span><span class="mi-note">Toca na sua própria conta Spotify (Premium). Sair não tira você da call.</span></div>
      <div class="mi-b"><button class="btn mi-no">Agora não</button><button class="btn primary mi-yes">Entrar</button></div>`;
    document.body.append(el);
    const close = () => el.remove();
    el.querySelector('.mi-no').onclick = () => { jsend(from, { k: 'decline' }); close(); };
    el.querySelector('.mi-yes').onclick = () => {
      close();
      if (!st.els) setEnabled(true);
      roomUI?.open('music');
      if (st.jam.role === 'host') jamLeave(true);
      st.jam = { ...jamReset(), role: 'guest', host: from };
      jsend(from, { k: 'accept' }); render();
      if (!st.status?.connected) problem('Conecte o seu Spotify abaixo para começar a ouvir junto.');
    };
    setTimeout(() => { if (el.isConnected) { jsend(from, { k: 'decline' }); close(); } }, 60000);
  }
  function onListen(from, m) {
    if (!m || typeof m.k !== 'string') return;
    if (m.k === 'ctl') return jamControl(from, m);
    if (m.k === 'invite') return jamCard(from, String(m.track || '').slice(0, 160));
    if (m.k === 'accept' && st.jam.role === 'host' && st.jam.invites.has(from)) { st.jam.invites.delete(from); st.jam.guests.add(from); toast('Ouvir junto', uname(from) + ' entrou.', 2500); jamBroadcast(true); return renderJam(); }
    if (m.k === 'decline') { if (st.jam.invites.delete(from)) toast('Ouvir junto', uname(from) + ' não entrou agora.', 2500); if (st.jam.role === 'host' && !st.jam.guests.size && !st.jam.invites.size) st.jam.role = null; return renderJam(); }
    if (m.k === 'leave' && st.jam.guests.delete(from)) { toast('Ouvir junto', uname(from) + ' saiu.', 2500); if (!st.jam.guests.size && !st.jam.invites.size) st.jam.role = null; return renderJam(); }
    if (m.k === 'end' && st.jam.role === 'guest' && st.jam.host === from) { st.jam = jamReset(); toast('Ouvir junto', uname(from) + ' encerrou a sessão.', 3000); return render(); }
    if (m.k === 'state' && st.jam.role === 'guest' && st.jam.host === from && typeof m.uri === 'string' && m.uri.startsWith('spotify:track:') && Number.isFinite(m.pos) && Number.isFinite(m.at)) { st.jam.last = m; jamFollow(m); }
  }
  function userLeft(id) {
    if (st.jam.guests.delete(id) || st.jam.invites.delete(id)) { if (!st.jam.guests.size && !st.jam.invites.size && st.jam.role === 'host') st.jam.role = null; renderJam(); }
    if (st.jam.role === 'guest' && st.jam.host === id) { st.jam = jamReset(); toast('Ouvir junto', 'Quem chamou saiu da sala; a sessão acabou.', 3000); render(); }
  }
  function renderJam() {
    if (!st.els) return; const p = st.els.panel, info = $('.mu-jam-info', p), btn = $('.mu-jam-btn span', p);
    p.classList.toggle('jam-guest', st.jam.role === 'guest');
    if (st.jam.role === 'guest') { btn.textContent = 'Sair do ouvir junto'; info.textContent = 'Ouvindo junto com ' + uname(st.jam.host); }
    else if (st.jam.role === 'host') { btn.textContent = 'Ouvir junto'; const g = [...st.jam.guests].map(uname); info.textContent = g.length ? 'Ouvindo com você: ' + g.join(', ') : st.jam.invites.size ? 'Convite enviado…' : ''; }
    else { btn.textContent = 'Ouvir junto'; info.textContent = ''; }
    $('.mu-jam', p).classList.toggle('hidden', !st.status?.connected && st.jam.role !== 'guest');
  }
  function setEnabled(on) { settings.music = !!on; saveSettings(); on ? mount() : unmount(); }
  if (settings.music) mount();
  return { setEnabled, onListen, userLeft, overlayInfo, control, watch: (fn) => { watchers.add(fn); return () => watchers.delete(fn); }, get enabled() { return !!st.els; }, _debug: { st, render, renderQueue, onState, jamAsk, pick, upcoming, enqueue, playerCtx, useSpotify: (x) => { sp = x; } } }; // _debug: só para testes automáticos
}
