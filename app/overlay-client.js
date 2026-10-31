// Ilha do Resenha, lado do app: manda para a ilha quem está na call, quem fala, volumes e música,
// e aplica o que a pessoa faz nela. Convite, treino guiado e a aba "Ilha" das configurações também moram aqui.
// Opcional: tudo fica desligado até a pessoa ativar. Só existe no app de PC (Windows).
const DEFAULTS = { enabled: false, key: null, mode: 'jogos', fullscreen: false, games: [], corner: 'tc', perGame: {}, opacity: 85, musicRest: 'sempre', reduceMotion: false, duck: false, hintsLeft: 3, seenInvite: false, trained: false };
const CORNERS = [['tc', 'Topo, no centro'], ['tl', 'Topo, à esquerda'], ['tr', 'Topo, à direita'], ['bl', 'Embaixo, à esquerda'], ['br', 'Embaixo, à direita']];
const KEY_NAMES = { Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Pause: 'Pause', ScrollLock: 'ScrollLock' };
// Teclas de pontuação pela posição física (igual nos teclados ABNT2 e americano): código -> acelerador.
const PUNCT = { Backquote: '`', Quote: "'", Comma: ',', Period: '.', Minus: '-', Equal: '=', Semicolon: ';', Slash: '/', BracketLeft: '[', BracketRight: ']', Backslash: '\\' };
const CODE_OF = Object.fromEntries(Object.entries(PUNCT).map(([c, a]) => [a, c]));

export function createOverlayClient(d) {
  const { native, settings, saveSettings, S, V, DJ_ID, isSpeaking, setMuted, setDeafened, applyUserVolume, renderAll, music, initials, openModal, icon, esc, $, $$, toast } = d;
  const supported = !!native?.overlay && native.platform === 'win32';
  const cfg = settings.overlay = Object.assign({}, DEFAULTS, settings.overlay || {});
  let last = {}, training = null, usedThisHold = false, layout = null, duckNow = null;
  const defaultKey = '`'; // a tecla abaixo do Esc em qualquer layout (no ABNT2 ela escreve ')
  const note = (t, body, ms) => toast(t + ': ' + body, '', ms);
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const send = (msg) => { if (supported) native.overlay.push(msg); };
  const save = () => { saveSettings(); pushConfig(); };
  function pushConfig() { if (supported) native.overlay.config({ ...cfg, key: cfg.key || defaultKey }).catch?.(() => {}); }
  const live = () => supported && (cfg.enabled || !!training);

  // O atalho vale pela posição da tecla; o que aparece na tela é o caractere que ela escreve no layout da pessoa.
  async function detectKey() {
    try { layout = await navigator.keyboard.getLayoutMap(); } catch { layout = null; }
    if (!cfg.key || cfg.key === "'") cfg.key = defaultKey; // "'" era o padrão antigo (tecla errada no ABNT2)
  }

  // ---- estado enviado à ilha (só quando muda) ----
  const roster = () => (V.joined ? [...S.users.values()].filter((u) => u.id !== S.myId && u.id !== DJ_ID && !u.bot && u.voiceChannel === V.channel) : []);
  function sync(force) {
    if (!live() || training) return;
    const users = roster();
    const rk = users.map((u) => [u.id, u.name, u.color, (u.avatar || '').length].join(':')).join('|');
    if (force || rk !== last.roster) { last.roster = rk; send({ k: 'roster', users: users.map((u) => ({ id: u.id, name: u.name, color: u.color, avatar: u.avatar || '', initials: initials(u.name) })) }); }
    const vols = {}; users.forEach((u) => { vols[u.id] = { v: settings.userVolumes[u.name] ?? 100, m: !!settings.userMuted[u.name] }; });
    const mix = JSON.stringify([vols, !!(V.muted || V.deafened), !!V.deafened]);
    if (force || mix !== last.mix) { last.mix = mix; send({ k: 'mix', vols, mic: !!(V.muted || V.deafened), deaf: !!V.deafened }); }
    syncSpeaking(force);
  }
  function syncSpeaking(force) {
    if (!live() || training) return;
    const ids = roster().filter((u) => isSpeaking(u.id)).map((u) => u.id), k = ids.join();
    if (force || k !== last.speaking) { last.speaking = k; send({ k: 'speaking', ids }); }
    if (cfg.duck && duckNow !== ids.length > 0) { duckNow = ids.length > 0; music.control?.('duck', duckNow); }
  }
  music.watch?.((m) => { if (live() && !training) send({ k: 'music', m }); });

  // ---- ações vindas da ilha ----
  if (supported) {
    native.overlay.onAction((a) => {
      if (!a || typeof a.k !== 'string') return;
      const u = typeof a.id === 'string' ? S.users.get(a.id) : null;
      if (a.k === 'vol' && u && Number.isFinite(a.v)) { settings.userVolumes[u.name] = clampN(Math.round(a.v), 0, 200); applyUserVolume(u.id); saveSettings(); }
      else if (a.k === 'mute' && u) { settings.userMuted[u.name] = !!a.m; applyUserVolume(u.id); saveSettings(); renderAll(); }
      else if (a.k === 'mic') setMuted(!(V.muted || V.deafened));
      else if (a.k === 'deaf') setDeafened(!V.deafened);
      else if (a.k === 'music') music.control?.(a.a, a.v);
      else if (a.k === 'event') { usedThisHold = true; training?.event(a.type); }
    });
    native.overlay.onEvent((ev) => {
      if (ev.type === 'hold') { usedThisHold = false; training?.event('hold'); }
      else if (ev.type === 'release') {
        if (usedThisHold && cfg.hintsLeft > 0 && !training) { cfg.hintsLeft--; save(); }
        training?.event('release');
      } else if (ev.type === 'moved') {
        if (ev.game) cfg.perGame = { ...cfg.perGame, [ev.game]: ev.corner }; else cfg.corner = ev.corner;
        save();
      } else if (ev.type === 'demo-end') training?.end();
    });
  }

  // ---- demonstração (treino e "testar agora") ----
  const demoUsers = [{ id: 'd1', name: 'Ana', color: '#6b5bd6', initials: 'AN' }, { id: 'd2', name: 'Gui', color: '#d9703f', initials: 'GU' }, { id: 'd3', name: 'Luca', color: '#2e9e82', initials: 'LU' }];
  const demoCover = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#8a5fd0"/></svg>');
  function demoState() {
    send({ k: 'roster', users: demoUsers }); send({ k: 'speaking', ids: ['d1'] });
    send({ k: 'mix', vols: { d1: { v: 100, m: false }, d2: { v: 100, m: false }, d3: { v: 100, m: false } }, mic: false, deaf: false });
    send({ k: 'music', m: { title: 'Midnight City', artist: 'M83', cover: demoCover, paused: false, pos: 84000, dur: 243000, vol: 60, at: Date.now() } });
  }
  async function startDemo(onEvent) {
    clearTimeout(stopDemo.t);
    training = { event: onEvent || (() => {}), end() { stopDemo(); } };
    await native.overlay.demo(true); demoState();
  }
  async function stopDemo() { const t = training; training = null; clearTimeout(stopDemo.t); if (t) await native.overlay.demo(false); last = {}; sync(true); music.watch && send({ k: 'music', m: music.overlayInfo?.() || null }); }
  function testNow() { startDemo().then(() => { stopDemo.t = setTimeout(stopDemo, 10000); }); }

  // ---- convite e treino guiado ----
  const keyLabel = () => { const k = cfg.key || defaultKey, c = CODE_OF[k]; return (c && layout?.get(c)) || k; };
  function trainingModal() {
    const steps = [['hold', `Segure a tecla <kbd>${esc(keyLabel())}</kbd>`], ['music-open', 'Clique na música para abrir os controles'], ['people-open', 'Clique nas pessoas para ver o volume de cada uma'], ['release', 'Solte a tecla: a ilha fecha sozinha']];
    const done = new Set();
    const m = openModal(`<div class="ov-train"><h2>Treino da ilha</h2>
      <p class="muted">Aparece no canto da sua tela, por cima de qualquer coisa. Experimente agora, com dados de mentira.</p>
      <ol>${steps.map(([k, t]) => `<li data-k="${k}"><span class="ov-ck"></span>${t}</li>`).join('')}</ol>
      <p class="muted small ov-ok hidden">Pronto! Dentro do jogo é igual. Para a ilha não cobrir nada importante, segure a tecla e arraste a alça para outro canto: cada jogo lembra o seu.</p>
      <footer><button class="btn" data-close>Fechar</button><button class="btn primary ov-on hidden">Ativar a ilha</button></footer></div>`, { onClose: () => stopDemo() });
    const mark = (k) => { done.add(k); $(`li[data-k="${k}"]`, m.el)?.classList.add('done'); };
    const finish = () => { $('.ov-ok', m.el).classList.remove('hidden'); $('.ov-on', m.el).classList.remove('hidden'); };
    startDemo((t) => {
      if (t === 'release') { if (done.has('hold')) mark('release'); } else mark(t);
      if (steps.every(([k]) => done.has(k))) finish();
    });
    $('.ov-on', m.el).onclick = () => { cfg.enabled = true; cfg.trained = true; cfg.seenInvite = true; save(); m.close(); note('Ilha ativada', 'ela aparece quando um jogo estiver em primeiro plano.', 4000); };
  }
  function maybeInvite() {
    if (!supported || cfg.seenInvite || cfg.enabled) return;
    setTimeout(() => {
      if (!$('#main') || $('#main').classList.contains('hidden') || cfg.seenInvite) return;
      const m = openModal(`<div class="ov-train"><h2>Novo: a ilha do Resenha</h2>
        <p>Uma cápsula pequena no canto do jogo mostra quem está falando e qual música toca. Segurando uma tecla, ela fica clicável: você muda a música e o volume de cada pessoa sem sair do jogo.</p>
        <p class="muted small">É opcional e vem desligada. Não mexe no jogo nem injeta nada: é só uma janela por cima, então não deve incomodar o anti-cheat. Você desliga quando quiser.</p>
        <footer><button class="btn" data-close>Agora não</button><button class="btn" id="ov-more">Saber mais</button><button class="btn primary" id="ov-try">Experimentar</button></footer></div>`);
      cfg.seenInvite = true; save();
      $('#ov-try', m.el).onclick = () => { m.close(); trainingModal(); };
      $('#ov-more', m.el).onclick = () => { m.close(); d.openSettings('ilha'); };
    }, 6000);
  }

  // ---- aba "Ilha" nas configurações ----
  const tabHTML = () => (supported ? '<div class="tab" data-t="ilha">Ilha</div>' : '');
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  function panelHTML() {
    if (!supported) return '';
    return `<div class="tp hidden" data-p="ilha"><div class="settings-grid">
      <div class="field"><label class="check"><input type="checkbox" id="ov-en" ${cfg.enabled ? 'checked' : ''}> Mostrar a ilha por cima dos jogos</label>
        <p class="muted small">Desligada por padrão. Uma cápsula pequena com quem fala e a música. Não mexe no jogo e não usa nada que o anti-cheat costume bloquear.</p></div>
      <div class="field"><label>Tecla da ilha (segure para clicar)</label><div class="kbd" id="ov-key">${esc(keyLabel())}</div>
        <p class="muted small">Padrão: a tecla abaixo do Esc. Ela só vale dentro do jogo; fora dele você digita normalmente. Se o seu jogo usa essa tecla (console, chat), troque aqui.</p><p class="muted small" id="ov-mode"></p></div>
      <div class="field"><label>Mostrar em</label>${sel('ov-mode-sel', [['jogos', 'Só nos jogos'], ['sempre', 'Sempre, em qualquer programa']], cfg.mode)}<p class="muted small">No modo "Sempre" a tecla fica reservada para a ilha em todos os programas (menos navegadores e similares). Prefira uma tecla F ou Insert.</p></div>
      <div class="field"><label class="check"><input type="checkbox" id="ov-fs" ${cfg.fullscreen ? 'checked' : ''}> Também em qualquer programa em tela cheia</label><p class="muted small">Pode aparecer em filmes e apresentações.</p></div>
      <div class="field"><label>Música quando a ilha está parada</label>${sel('ov-music', [['sempre', 'Sempre (capa e título)'], ['mudar', 'Só quando a música muda'], ['nunca', 'Nunca']], cfg.musicRest)}</div>
      <div class="field"><label>Canto padrão</label>${sel('ov-corner', CORNERS, cfg.corner)}<p class="muted small">Cada jogo lembra o seu canto: segure a tecla e arraste a alça da ilha.</p></div>
      <div class="field"><label>Transparência da ilha parada <span id="ov-op-v">${cfg.opacity}%</span></label><input type="range" id="ov-op" min="30" max="100" value="${cfg.opacity}"></div>
      <div class="field"><label class="check"><input type="checkbox" id="ov-rm" ${cfg.reduceMotion ? 'checked' : ''}> Reduzir animações da ilha</label></div>
      <div class="field"><label class="check"><input type="checkbox" id="ov-duck" ${cfg.duck ? 'checked' : ''}> Abaixar a música quando alguém fala</label></div>
      <div class="field"><label>Meus jogos</label><div id="ov-games"></div><button class="btn" id="ov-add">Adicionar um programa aberto</button><p class="muted small">O Resenha reconhece sozinho jogos da Steam, Epic, GOG, Riot e outros. Aqui você acrescenta o que ele não pegar.</p></div>
      <div class="field"><button class="btn" id="ov-train">Treino guiado</button> <button class="btn" id="ov-test">Testar agora (10 s)</button> <button class="btn" id="ov-fb">Dar opinião</button></div>
    </div></div>`;
  }
  function renderGames(el) {
    const box = $('#ov-games', el);
    box.innerHTML = cfg.games.length ? cfg.games.map((g, i) => `<div class="ov-game"><span>${esc(g)}</span><button class="btn small-btn" data-i="${i}">Tirar</button></div>`).join('') : '<p class="muted small">Nenhum ainda.</p>';
    $$('button', box).forEach((b) => b.onclick = () => { cfg.games.splice(+b.dataset.i, 1); save(); renderGames(el); });
  }
  async function pickProgram(el) {
    const list = (await native.overlay.procs()).filter((p) => !cfg.games.includes(p.name.toLowerCase()));
    const m = openModal(`<div class="ov-train"><h2>Adicionar programa</h2><p class="muted small">Abra o jogo, volte ao Resenha e escolha na lista.</p>
      <div class="ov-procs">${list.length ? list.map((p, i) => `<button class="mb-row" data-i="${i}"><b>${esc(p.name)}</b><span class="muted small">${esc(p.title || '')}</span></button>`).join('') : '<p class="muted">Não achei programas abertos.</p>'}</div>
      <footer><button class="btn" data-close>Cancelar</button></footer></div>`);
    $$('.ov-procs button', m.el).forEach((b) => b.onclick = () => { cfg.games.push(list[+b.dataset.i].name.toLowerCase()); save(); renderGames(el); m.close(); });
  }
  function bindPanel(el) {
    if (!supported) return;
    const p = $('.tp[data-p="ilha"]', el); if (!p) return;
    native.overlay.state().then((s) => { $('#ov-mode', el).textContent = s.helper ? 'Segurar a tecla funciona neste computador.' : 'O ajudante do Windows (PowerShell) não iniciou aqui, então a ilha não vai aparecer nos jogos.'; });
    $('#ov-en', el).onchange = (e) => { cfg.enabled = e.target.checked; save(); if (cfg.enabled && !cfg.trained) note('Dica', 'faça o treino guiado para aprender a usar a ilha.', 5000); sync(true); };
    $('#ov-mode-sel', el).onchange = (e) => { cfg.mode = e.target.value; save(); };
    $('#ov-fs', el).onchange = (e) => { cfg.fullscreen = e.target.checked; save(); };
    $('#ov-music', el).onchange = (e) => { cfg.musicRest = e.target.value; save(); };
    $('#ov-corner', el).onchange = (e) => { cfg.corner = e.target.value; save(); };
    $('#ov-op', el).oninput = (e) => { cfg.opacity = +e.target.value; $('#ov-op-v', el).textContent = cfg.opacity + '%'; save(); };
    $('#ov-rm', el).onchange = (e) => { cfg.reduceMotion = e.target.checked; save(); };
    $('#ov-duck', el).onchange = (e) => { cfg.duck = e.target.checked; if (!cfg.duck) duckNow = null; music.control?.('duck', false); save(); };
    $('#ov-add', el).onclick = () => pickProgram(el);
    $('#ov-train', el).onclick = trainingModal; $('#ov-test', el).onclick = testNow;
    $('#ov-fb', el).onclick = () => native.openExternal('https://github.com/fgsecfem-dotcom/resenhagorilandia/issues/new');
    renderGames(el);
    const k = $('#ov-key', el);
    k.onclick = () => {
      k.classList.add('rec'); k.textContent = 'Aperte uma tecla...';
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        document.removeEventListener('keydown', onKey, true); k.classList.remove('rec');
        const letter = /^Key([A-Z])$/.exec(e.code), digit = /^Digit(\d)$/.exec(e.code);
        let key = e.key === 'Escape' ? null : /^F\d{1,2}$/.test(e.key) ? e.key : KEY_NAMES[e.code] || PUNCT[e.code] || (letter && letter[1]) || (digit && digit[1]) || null;
        if (key && /^[A-Z0-9]$/.test(key)) note('Tecla de letra ou número', 'ela deixa de funcionar no jogo enquanto a ilha está ativa. Prefira uma tecla F, Insert ou a abaixo do Esc.', 6000);
        if (key) { cfg.key = key; save(); }
        k.textContent = keyLabel();
      };
      document.addEventListener('keydown', onKey, true);
    };
  }

  // A ilha acompanha o tema escolhido: cor de destaque (barra, contorno) e a cor de "falando".
  function pushTheme() {
    const cs = getComputedStyle(document.documentElement), v = (n, f) => (cs.getPropertyValue(n).trim() || f);
    send({ k: 'theme', acc: v('--blurple', '#5865f2'), ring: v('--green', '#7ee0a8') });
  }
  function start() {
    if (!supported) return;
    let tt; new MutationObserver(() => { clearTimeout(tt); tt = setTimeout(pushTheme, 300); }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
    pushTheme();
    detectKey().then(() => { pushConfig(); sync(true); maybeInvite(); });
    music.watch && send({ k: 'music', m: music.overlayInfo?.() || null });
  }
  return { supported, tabHTML, panelHTML, bindPanel, sync, syncSpeaking, start, trainingModal, get cfg() { return cfg; } };
}
