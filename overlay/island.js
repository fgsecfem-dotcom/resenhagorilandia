// Ilha do Resenha (janela transparente). Recebe o estado do app por mensagens e manda de volta só ações e o tamanho.
const $ = (id) => document.getElementById(id);
const ICON = {
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  micOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M9 5a3 3 0 0 1 6 0v5M15 14a3 3 0 0 1-5.1 1.4M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3"/></svg>',
  head: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
  headOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M4 15v-3a8 8 0 0 1 12-6.9M20 14v-2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M19 5v14L8 12zM5 5v14"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 5v14l11-7zM19 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6"/></svg>',
  grip: '<svg viewBox="0 0 24 24"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>',
};
const S = { users: [], speaking: new Set(), vols: {}, mic: false, deaf: false, music: null, cfg: { musicRest: 'sempre', opacity: 85, reduceMotion: false, hintsLeft: 3, demo: false }, hold: false, m: false, p: false, big: false, anchor: 'tc' };
const isl = $('isl'), topRow = $('top');
let bigTimer = null, tick = null, lastKey = '';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const act = (a) => window.ilha.action(a);
const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
topRow.style.width = 'max-content';
$('grip').innerHTML = ICON.grip;
for (const [id, k] of [['prev', 'prev'], ['next', 'next']]) $(id).innerHTML = ICON[k];

function avatar(u, extra = '') {
  const img = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u.avatar || ''), col = /^#[0-9a-f]{3,8}$/i.test(u.color || '') ? u.color : '#5865f2';
  const bg = img ? `background-image:url('${u.avatar}')` : `background-color:${col}`; // só imagem embutida: nada de buscar URL de fora
  return `<span class="av ${extra}" style="${bg}">${img ? '' : esc(u.initials || '?')}</span>`;
}
function musicVisible() {
  if (!S.music) return false;
  if (S.hold) return true;
  if (S.cfg.musicRest === 'nunca') return false;
  return S.cfg.musicRest === 'sempre' || S.big;
}
function render() {
  const showP = S.users.length > 0, showM = musicVisible();
  $('zp').classList.toggle('none', !showP); $('zm').classList.toggle('none', !showM);
  const shown = S.users.slice(0, 5), more = S.users.length - shown.length;
  $('avs').innerHTML = shown.map((u) => avatar(u, S.speaking.has(u.id) ? 'sp' : '')).join('') + (more > 0 ? `<span class="more">+${more}</span>` : '');
  if (S.music) {
    $('cv').src = S.music.cover || ''; $('cv').style.visibility = S.music.cover ? 'visible' : 'hidden';
    $('ti').textContent = S.music.title || ''; $('ar').textContent = S.music.artist || '';
  }
  $('mic').innerHTML = S.mic ? ICON.micOff : ICON.mic; $('mic').classList.toggle('off', S.mic);
  $('deaf').innerHTML = S.deaf ? ICON.headOff : ICON.head; $('deaf').classList.toggle('off', S.deaf);
  isl.classList.toggle('empty', !showP && !showM && !(S.hold && (S.music || S.users.length)));
  isl.classList.toggle('hold', S.hold); isl.classList.toggle('big', S.big);
  isl.classList.toggle('hinting', S.hold && S.cfg.hintsLeft > 0);
  isl.classList.toggle('m', S.hold && S.m && !!S.music); isl.classList.toggle('p', S.hold && S.p && showP);
  $('zm').classList.toggle('on', isl.classList.contains('m')); $('zp').classList.toggle('on', isl.classList.contains('p'));
  document.documentElement.style.setProperty('--rest', String(Math.max(0.3, Math.min(1, S.cfg.opacity / 100))));
  document.body.classList.toggle('reduce', !!S.cfg.reduceMotion);
  $('wrap').className = 'a-' + S.anchor;
  renderMusicPanel(); renderPeople(); report();
}
function renderMusicPanel() {
  const m = S.music; if (!m) return;
  $('play').innerHTML = m.paused ? ICON.play : ICON.pause;
  $('vic').innerHTML = m.vol === 0 ? ICON.mute : ICON.vol;
  if (document.activeElement !== $('mvol')) { $('mvol').value = m.vol; setFill($('mvol')); }
  $('mvv').textContent = Math.round(m.vol) + '%'; $('dur').textContent = fmt(m.dur);
  progress();
  clearInterval(tick); tick = isl.classList.contains('m') && !m.paused ? setInterval(progress, 500) : null;
}
function progress() {
  const m = S.music; if (!m) return;
  const pos = Math.min(m.dur, m.pos + (m.paused ? 0 : Date.now() - m.at));
  $('pos').textContent = fmt(pos); $('pf').style.width = (m.dur ? (pos / m.dur) * 100 : 0) + '%';
}
function setFill(el) { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%'); }
function renderPeople() {
  const box = $('plist');
  if (!S.users.length) { box.innerHTML = '<div class="empty-msg">Ninguém na call.</div>'; return; }
  const key = S.users.map((u) => u.id + u.name).join();
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.innerHTML = S.users.map((u) => `<div class="pr" data-id="${esc(u.id)}">${avatar(u)}<span class="nm">${esc(u.name)}</span><input type="range" min="0" max="200" step="1" aria-label="Volume de ${esc(u.name)}"><button class="mt" aria-label="Silenciar ${esc(u.name)}"></button></div>`).join('');
    box.querySelectorAll('.pr').forEach((row) => {
      const id = row.dataset.id, inp = row.querySelector('input');
      inp.oninput = () => { setFill(inp); const v = +inp.value; (S.vols[id] ||= { v: 100, m: false }).v = v; clearTimeout(inp.t); inp.t = setTimeout(() => act({ k: 'vol', id, v }), 40); };
      row.querySelector('.mt').onclick = () => { if (!S.hold) return; const o = (S.vols[id] ||= { v: 100, m: false }); o.m = !o.m; act({ k: 'mute', id, m: o.m }); renderPeople(); };
    });
  }
  box.querySelectorAll('.pr').forEach((row) => {
    const id = row.dataset.id, o = S.vols[id] || { v: 100, m: false }, inp = row.querySelector('input');
    if (document.activeElement !== inp) { inp.value = o.v; setFill(inp); }
    row.classList.toggle('off', !!o.m); row.querySelector('.mt').innerHTML = o.m ? ICON.mute : ICON.vol;
    row.querySelector('.av').classList.toggle('sp', S.speaking.has(id));
  });
}
let lastSize = '';
function report() {
  requestAnimationFrame(() => {
    if (isl.classList.contains('empty')) { if (lastSize !== '0') { lastSize = '0'; window.ilha.size(0, 0); } return; }
    const open = isl.classList.contains('m') || isl.classList.contains('p');
    const w = Math.max(topRow.offsetWidth + 10, open ? 274 : 0);
    let h = 38;
    if (S.hold && S.cfg.hintsLeft > 0) h += $('hint').offsetHeight || 30;
    if (isl.classList.contains('m')) h += $('pm').querySelector('.in').scrollHeight;
    if (isl.classList.contains('p')) h += $('pp').querySelector('.in').scrollHeight;
    isl.style.width = w + 'px';
    const k = w + 'x' + h; if (k !== lastSize) { lastSize = k; window.ilha.size(w, h); }
  });
}
new ResizeObserver(report).observe(topRow);

// ---- interação (só quando o atalho está sendo segurado; fora disso a janela deixa o mouse passar) ----
$('zp').onclick = () => { if (!S.hold) return; S.p = !S.p; if (S.p) act({ k: 'event', type: 'people-open' }); render(); };
$('zm').onclick = () => { if (!S.hold) return; S.m = !S.m; if (S.m) act({ k: 'event', type: 'music-open' }); render(); };
$('mic').onclick = () => S.hold && act({ k: 'mic' });
$('deaf').onclick = () => S.hold && act({ k: 'deaf' });
$('play').onclick = () => act({ k: 'music', a: 'toggle' });
$('prev').onclick = () => act({ k: 'music', a: 'prev' });
$('next').onclick = () => act({ k: 'music', a: 'next' });
$('mvol').oninput = () => { const v = +$('mvol').value; setFill($('mvol')); $('mvv').textContent = v + '%'; if (S.music) S.music.vol = v; clearTimeout($('mvol').t); $('mvol').t = setTimeout(() => act({ k: 'music', a: 'vol', v }), 40); };
let dragFrom = null;
$('grip').onpointerdown = (e) => { if (!S.hold) return; $('grip').setPointerCapture(e.pointerId); dragFrom = { x: e.screenX, y: e.screenY }; window.ilha.drag({ phase: 'start' }); };
$('grip').onpointermove = (e) => { if (dragFrom) window.ilha.drag({ phase: 'move', dx: e.screenX - dragFrom.x, dy: e.screenY - dragFrom.y }); };
$('grip').onpointerup = () => { if (dragFrom) { dragFrom = null; window.ilha.drag({ phase: 'end' }); } };

function setMusic(m) {
  const prev = S.music; S.music = m;
  const changed = prev && m && (prev.title !== m.title || prev.artist !== m.artist);
  if (changed) { S.big = true; clearTimeout(bigTimer); bigTimer = setTimeout(() => { S.big = false; render(); }, 4000); }
  if (!m) { S.big = false; S.m = false; }
}
window.ilha.onMsg((msg) => {
  switch (msg.k) {
    case 'cfg': Object.assign(S.cfg, msg.cfg); break;
    case 'theme': { const r = document.documentElement.style; if (/^#[0-9a-f]{3,8}$/i.test(msg.acc)) r.setProperty('--acc', msg.acc); if (/^#[0-9a-f]{3,8}$/i.test(msg.ring)) r.setProperty('--ring', msg.ring); break; }
    case 'anchor': S.anchor = msg.a; break;
    case 'roster': S.users = msg.users || []; break;
    case 'speaking': S.speaking = new Set(msg.ids || []); break;
    case 'mix': S.vols = msg.vols || {}; S.mic = !!msg.mic; S.deaf = !!msg.deaf; break;
    case 'music': setMusic(msg.m || null); break;
    case 'hold': S.hold = true; break;
    case 'release': S.hold = false; S.m = false; S.p = false; break;
  }
  render();
});
render();
