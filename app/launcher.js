(() => {
  const native = window.launcherNative, $ = id => document.getElementById(id);
  // Mesmo visual do app (2.1.5): fundo e cores do tema escolhido e o ícone do Pipoquinha escolhido.
  // Só lê as preferências; o launcher nunca grava perfil ou configuração (a única exceção é "Abrir direto", abaixo).
  let settings = {}; try { settings = JSON.parse(localStorage.getItem('resenha.settings') || '{}') || {}; } catch {}
  try {
    const v = window.themePreview?.(settings.theme || 'system') || {}, root = document.documentElement.style;
    const map = { 'bg-rail': '--bg', 'text-hi': '--fg', muted: '--muted', link: '--accent', 'g-edge': '--edge', 'g-fill': '--fill', 'g-fill-2': '--fill-2', blurple: '--blurple' };
    for (const [k, css] of Object.entries(map)) if (v[k]) root.setProperty(css, v[k]);
    if (v.wall) root.setProperty('--wall', v.wall);
    const light = window.THEMES?.[settings.theme]?.light || (settings.theme === 'system' && !matchMedia('(prefers-color-scheme: dark)').matches) || settings.theme === 'arcLight';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
  } catch {}
  try { $('mascot').innerHTML = window.PIPOCA.pipocaSVG(settings.appIcon || 'quentinha', 76); } catch {}
  const descriptions = {
    checking: ['Verificando atualizações…', 'Buscando as novidades do Resenha'],
    opening: ['Tudo pronto. Entrando na resenha…', 'Abrindo o Resenha'],
    downloading: ['Baixando atualização', 'Preparando as novidades para você'],
    verifying: ['Conferindo atualização…', 'Conferindo a integridade do arquivo'],
    extracting: ['Preparando atualização…', 'Extraindo os arquivos da nova versão'],
    applying: ['Atualizando o Resenha…', 'Aguarde um instante para concluir.'],
    unavailable: ['Não foi possível verificar agora', 'Você pode abrir a versão instalada e tentar depois.'],
    error: ['Não conseguimos atualizar agora', 'Tente novamente ou baixe a nova versão pelo site.'],
    recovery: ['A atualização anterior não foi concluída', 'Abra a versão instalada para continuar.'],
    manual: ['Nova versão disponível', 'Baixe a nova versão pelo site para continuar.']
  };
  // Animações: o texto troca com um deslize quando a fase muda e a porcentagem conta até o valor novo.
  let lastPhase = null, shownPercent = 0, tween = 0;
  function swapText() { const c = document.querySelector?.('.status-copy'); if (!c) return; c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap'); }
  const raf = globalThis.requestAnimationFrame, caf = globalThis.cancelAnimationFrame || (() => {});
  function countTo(target) {
    caf(tween); if (!raf) { shownPercent = target; $('percent').textContent = target + '%'; return; } const from = shownPercent, t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 450), v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))); shownPercent = v; $('percent').textContent = v + '%'; if (k < 1) tween = raf(step); };
    tween = raf(step);
  }
  // ---------- Hub: tela inicial depois da verificação de atualização ----------
  // Lê as mesmas preferências do app (perfil, sala favorita e última sala). O único registro do launcher é "abrir direto".
  const pref = (key, fallback) => { try { const v = localStorage.getItem('resenha.' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
  const ROOM_IDLE_DAYS = 7;
  let hubShown = false;
  const norm = code => String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  function greeting() {
    const h = new Date().getHours(), hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite', name = String((pref('profile', {}) || {}).name || '').trim();
    return name ? hello + ', ' + name : hello;
  }
  function when(ms) {
    if (!ms) return ''; const d = new Date(ms), now = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff <= 0) return 'Hoje, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return diff === 1 ? 'Ontem' : 'Há ' + diff + ' dias';
  }
  // Mesmas regras de "Minhas salas" no app: ocultas e paradas há mais de 7 dias saem, menos favorita e última sala.
  function pickRooms(list) {
    const fav = norm(pref('favoriteRoom', '')), last = norm(pref('lastRoom', null)?.code), hidden = new Set([].concat(pref('hiddenRooms', [])).map(norm)), cutoff = Date.now() - ROOM_IDLE_DAYS * 864e5;
    const rank = r => norm(r.code) === fav ? 0 : norm(r.code) === last ? 1 : 2;
    return list.filter(r => rank(r) < 2 || (!hidden.has(norm(r.code)) && r.updatedAt >= cutoff)).sort((a, b) => rank(a) - rank(b) || b.updatedAt - a.updatedAt).slice(0, 8)
      .map(r => ({ ...r, pinned: norm(r.code) === fav }));
  }
  function roomCard(room, featured) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'room' + (featured ? ' featured' : '');
    const art = document.createElement('span'); art.className = 'room-art'; art.style.setProperty('--room', room.color || '#4a4f5c');
    if (room.cover) art.style.backgroundImage = 'url("' + room.cover + '")';
    if (room.icon) { const img = document.createElement('img'); img.src = room.icon; img.alt = ''; art.append(img); }
    else { const t = document.createElement('i'); t.textContent = (room.name || '?').trim().split(/\s+/).filter((w, i, all) => all.length < 3 || !/^(d[aeo]s?|e)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase(); art.append(t); }
    if (room.pinned) { const pin = document.createElement('em'); pin.textContent = 'Abre ao iniciar'; art.append(pin); }
    const name = document.createElement('b'); name.textContent = room.name || 'Sala sem nome';
    const meta = document.createElement('small'); meta.textContent = when(room.updatedAt) || room.code;
    b.append(art, name, meta); b.onclick = () => native.action('open', { type: 'room', code: room.code });
    return b;
  }
  function showHub(state) {
    if (pref('skipHub', false) === true && !hubShown) { hubShown = true; native.action('open'); return; }
    hubShown = true;
    $('hello').textContent = greeting();
    try { $('hub-mascot').innerHTML = window.PIPOCA.pipocaSVG(settings.appIcon || 'quentinha', 52); } catch {}
    $('version').textContent = state.version ? 'Versão instalada ' + state.version : '';
    $('channel').textContent = state.channel === 'preview' ? 'Canal de previews' : 'Canal estável';
    // Um aviso por vez, com prioridade (hoje só as novidades chegam aqui: atualização obrigatória ocupa a janela inteira).
    const seen = pref('whatsNewSeen', null), news = !!seen && seen !== state.version;
    $('notice').hidden = !news; $('notice-text').textContent = news ? 'Novidades da versão ' + state.version : '';
    $('skip').checked = pref('skipHub', false) === true;
    native.rooms().then(list => {
      const rooms = pickRooms(list), box = $('rooms'); box.replaceChildren(...rooms.map((r, i) => roomCard(r, i === 0)));
      $('rooms-title').hidden = $('rooms').hidden = !rooms.length; $('empty').hidden = !!rooms.length;
    }).catch(() => { $('rooms-title').hidden = $('rooms').hidden = true; $('empty').hidden = false; });
  }
  $('code').addEventListener('input', () => {
    const c = norm($('code').value).slice(0, 8); $('code').value = c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c; $('hub-error').textContent = '';
  });
  $('join-form').addEventListener('submit', event => {
    event.preventDefault(); const c = norm($('code').value);
    if (c.length !== 8) { $('hub-error').textContent = 'O código tem 8 letras ou números, tipo K7P4-QX9M.'; return; }
    native.action('open', { type: 'join', code: c });
  });
  $('host-go').onclick = () => native.action('open', { type: 'host' });
  $('hub-open').onclick = $('notice-open').onclick = () => native.action('open');
  $('skip').onchange = () => { try { localStorage.setItem('resenha.skipHub', JSON.stringify($('skip').checked)); } catch {} };

  function render(state) {
    const phase = state.phase || 'checking', message = descriptions[phase] || descriptions.checking;
    if (phase !== lastPhase) { if (lastPhase) swapText(); lastPhase = phase; }
    const error = ['unavailable', 'error', 'recovery', 'manual'].includes(phase);
    document.body.dataset.phase = phase; document.body.dataset.error = String(error);
    $('hub').hidden = phase !== 'hub'; $('status').hidden = phase === 'hub';
    if (phase === 'hub') return showHub(state);
    $('launcher-status').textContent = message[0]; $('description').textContent = phase === 'downloading' && state.info?.version ? 'Transferindo o pacote ' + state.info.version : message[1];
    if (phase === 'unavailable' && state.required) $('description').textContent = 'Uma atualização já foi encontrada. Tente novamente para continuar.';
    if (phase === 'unavailable' && state.skipped) { $('launcher-status').textContent = 'Não foi possível atualizar agora'; $('description').textContent = 'Você pode continuar usando esta versão' + (state.offerDownload ? ' ou baixar a nova pelo site.' : '.'); }
    $('version').textContent = state.version ? 'Versão instalada ' + state.version : '';
    $('channel').textContent = state.info?.version ? 'Nova versão: ' + state.info.version : state.channel === 'preview' ? 'Canal de previews' : 'Canal estável';
    const determined = phase === 'downloading' && Number(state.totalBytes) > 0;
    const percent = Math.max(0, Math.min(100, Number(state.percent) || 0));
    $('progress').hidden = error || phase === 'opening'; $('progress').classList.toggle('indeterminate', !determined);
    $('progress').setAttribute('aria-label', phase === 'downloading' ? 'Download da atualização' : message[0]);
    if (determined) { $('progress').setAttribute('aria-valuemin', '0'); $('progress').setAttribute('aria-valuemax', '100'); $('progress').setAttribute('aria-valuenow', String(percent)); }
    else $('progress').removeAttribute('aria-valuenow');
    $('fill').style.width = determined ? percent + '%' : '';
    const mb = bytes => (bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    $('bytes').textContent = phase === 'downloading' && Number(state.downloadedBytes) >= 0 ? mb(state.downloadedBytes) + ' MB' + (determined ? ' de ' + mb(state.totalBytes) + ' MB' : '') : '';
    if (determined) countTo(percent); else { caf(tween); shownPercent = 0; $('percent').textContent = ''; }
    $('open').hidden = !state.canOpen || phase === 'opening'; $('open').textContent = 'Abrir Resenha';
    $('download').hidden = !(state.required && ['error', 'manual'].includes(phase)) && !(phase === 'unavailable' && state.offerDownload);
    $('retry').hidden = !['unavailable', 'error', 'recovery'].includes(phase);
    $('close').disabled = phase === 'applying'; $('close').title = phase === 'applying' ? 'Aguarde a conclusão desta etapa' : 'Fechar janela';
    $('details').hidden = !error || !state.error; $('error').textContent = state.error || '';
  }
  $('open').onclick = () => native.action('open'); $('retry').onclick = () => native.action('retry'); $('close').onclick = () => native.action('close');
  $('download').onclick = () => native.action('download');
  const unsubscribe = native.onState(render); window.addEventListener('beforeunload', unsubscribe, { once: true });
  native.ready().then(state => { if (state) render(state); }).catch(error => render({ phase: 'error', error: error.message }));
})();
