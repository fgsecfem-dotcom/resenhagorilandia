import { createDMStorage } from './dm-storage.js';
import { createCommandController } from './command-controller.js';
import { esc, clamp, fmtCode } from './format-utils.js';
import { setScreenRemoteDescription } from './screen-startup.js';
import { createRoomUI } from './room-ui.js';
import { createMusic } from './music.js';
// Resenha: cliente (UI + voz WebRTC + chat + DJ). Módulo ES.
let RnnoiseWorkletNode;
let roomUI = null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const native = window.resenhaNative || null;
const DJ_ID = 'dj-resenha';
const DJ_NAME = 'DJ Resenha';
const WEB_VIEWER = !native && location.protocol.startsWith('http');
const WEB_VOICE = WEB_VIEWER && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
// The web viewer also works over LAN HTTP, where AudioWorkletNode is unavailable.
if (native && typeof AudioWorkletNode === 'function') ({ RnnoiseWorkletNode } = await import('./vendor/ns/index.js'));

// ---------------- Persistência ----------------
const LS = {
  get(k, d) { try { const v = localStorage.getItem('resenha.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('resenha.' + k, JSON.stringify(v)); return true; } catch (e) { console.warn('Não foi possível salvar preferência local:', k, e.name); return false; } },
};
const COLORS = ['#5865f2', '#eb459e', '#57f287', '#fee75c', '#ed4245', '#f47b67', '#3ba55c', '#faa61a', '#9b59b6', '#1abc9c'];
const me = LS.get('profile', { name: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], avatar: null });
const settings = Object.assign({
  mutedRooms: {},
  inputDevice: 'default', outputDevice: 'default', micGain: 100, autoSens: true, threshold: -55,
  aiNoise: true, vadSens: 60, echoCancellation: true, autoGain: true, sounds: true,
  voiceFx: 'normal', pitchSemis: 0, theme: 'system', themeColor: 'lavanda',
  keyMute: '', keyDeafen: '', chatWidth: 360, sidebarWidth: 264,
  layout: ['sidebar', 'call', 'chat'], tileOrder: [], pipCorner: 'br', fontScale: 100, compact: false, reduceMotion: false, appIcon: 'quentinha', translucent: true,
  userVolumes: {}, userMuted: {}, streamVolumes: {},
}, LS.get('settings', {}));
document.documentElement.classList.toggle('reduce-motion', !!settings.reduceMotion); // Configurações > Aparência > Reduzir animações
globalThis.PIPOCA?.applyLogo(settings.appIcon); // logo da interface na variação escolhida
if ('noiseSuppression' in settings) { settings.aiNoise = settings.noiseSuppression; delete settings.noiseSuppression; }
const saveSettings = () => LS.set('settings', settings);
// 1.6 layout: move untouched old default widths (440/240) to the new ones once; custom widths stay.
if (!LS.get('layout16', false)) { if (settings.chatWidth === 440) settings.chatWidth = 360; if (settings.sidebarWidth === 240) settings.sidebarWidth = 264; saveSettings(); LS.set('layout16', true); }
// id fixo deste app: mantém as ligações de voz vivas quando a sala troca de anfitrião
const CID = LS.get('cid') || (() => { const c = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join(''); LS.set('cid', c); return c; })();
// Private key from the room's welcome: lets this tab replace its own lingering connection,
// and keeps other tabs or people from taking over this id. Per tab, survives reloads.
const sessionResume = () => { if (S.resume) return S.resume; try { return sessionStorage.getItem('resenha.resume') || undefined; } catch { return undefined; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FX = {
  normal: { name: 'Normal', semis: 0, robot: 0 },
  grave: { name: 'Grave', semis: -4, robot: 0 },
  monstro: { name: 'Monstro', semis: -8, robot: 0 },
  agudo: { name: 'Agudo', semis: 4, robot: 0 },
  esquilo: { name: 'Esquilo', semis: 9, robot: 0 },
  robo: { name: 'Robô', semis: 0, robot: 0.85 },
  demonio: { name: 'Demônio', semis: -10, robot: 0.35 },
  custom: { name: 'Personalizado', semis: null, robot: 0 },
};

// ---------------- Estado ----------------
const S = {
  ws: null, addr: null, base: '', token: '', myId: null, turn: null, isHost: false, hostKey: null, password: '',
  users: new Map(), roomName: '', serverOffset: 0, closing: false, reconnectTries: 0, lastPing: null,
  channels: [], history: {}, textChannel: null, unread: new Set(), typing: new Map(),
  replyTo: null, editing: null, dj: null, djAvailable: false,
};
const V = {
  joined: false, channel: null, muted: LS.get('muted', false), deafened: LS.get('deafened', false), mutedBeforeDeafen: false,
  ctx: null, raw: null, src: null, micGain: null, rn: null, rnReady: false, fx: null, analyser: null, gate: null, dest: null,
  gateOpen: false, gateHold: 0, vadOpen: false, vadLevel: 0,
  master: null, screenMaster: null, peers: new Map(), speaking: new Set(), selfLevel: -100,
  screen: null, screenSenders: new Map(), watching: new Map(), previewHidden: true,
  relayId: null, relayed: new Set(), relayVia: new Map(), relayOut: new Map(), directOnly: new Set(), // live relay, see routeViewer()
  windowVisible: true, focus: null, monitor: null,
  djAudio: null, djGain: null, djAnalyser: null, djTrack: null,
};
const semisToRatio = (s) => Math.pow(2, s / 12);

// ---------------- Utilidades de UI ----------------
function toast(msg, type = '', ms = 3500) {
  for (const old of $$('#toasts .toast')) if (old.textContent === msg) old.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function initials(name) { return (name || '?').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'; }
function avatarHTML(u, cls = '') {
  if (u.bot || u.id === DJ_ID) return `<div class="avatar dj-av ${cls}">${icon('music', 18)}</div>`;
  const bg = u.avatar ? `background-image:url(${u.avatar})` : `background-color:${u.color || '#5865f2'}`;
  return `<div class="avatar ${cls}" style="${esc(bg)}">${u.avatar ? '' : esc(initials(u.name))}</div>`;
}
function setAvatarEl(el, u) {
  el.style.backgroundImage = u.avatar ? `url(${u.avatar})` : '';
  el.style.backgroundColor = u.avatar ? '' : (u.color || '#5865f2');
  el.textContent = u.avatar ? '' : initials(u.name);
}
function fmtSize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'; return (b / 1073741824).toFixed(2) + ' GB'; }
function fmtTime(ts) {
  const d = new Date(ts), now = new Date();
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return hm;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ontem às ' + hm;
  return d.toLocaleDateString('pt-BR') + ' ' + hm;
}
function fmtDur(ms) { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
const serverNow = () => Date.now() + S.serverOffset;
function copy(text) { navigator.clipboard.writeText(text).then(() => toast('Copiado!', 'ok', 1500)); }

function openModal(html, { wide = false, onClose, cls = '' } = {}) {
  if (roomUI && cls === 'dm-panel') return roomUI.dmModal(html, {onClose});
  if (roomUI && cls === 'dj-modal') return roomUI.floatingModal(html, {onClose});
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}">${html}</div>`;
  const close = () => { if (globalThis.resenhaMotion?.closeOverlay) globalThis.resenhaMotion.closeOverlay(ov); else ov.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey, true);
  $('#modal-root').appendChild(ov);
  $$('[data-close]', ov).forEach((b) => (b.onclick = close));
  return { el: ov, close };
}
function promptModal(title, { value = '', placeholder = '', ok = 'Salvar', extra = '', inputType='text', maxLength=32 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal(`<header><div><h2>${esc(title)}</h2></div><button class="icon-btn" data-close>${icon('x')}</button></header>
      <div class="body">${extra}<div class="field"><input id="pm-in" type="${inputType==='password'?'password':'text'}" maxlength="${maxLength}" value="${esc(value)}" placeholder="${esc(placeholder)}"></div></div>
      <footer><button class="btn" data-close>Cancelar</button><button class="btn primary" id="pm-ok">${esc(ok)}</button></footer>`, { onClose: () => { if (!done) resolve(null); } });
    const inp = $('#pm-in', m.el); inp.focus(); inp.select();
    const go = () => { done = true; const r = { value: inp.value.trim(), el: m.el }; m.close(); resolve(r); };
    $('#pm-ok', m.el).onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
}
function confirmModal(title, text, ok = 'Confirmar', danger = true) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal(`<header><div><h2>${esc(title)}</h2><p>${text}</p></div></header>
      <footer><button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cm-ok">${esc(ok)}</button></footer>`, { onClose: () => { if (!done) resolve(false); } });
    $('#cm-ok', m.el).onclick = () => { done = true; m.close(); resolve(true); };
  });
}

// Menu de contexto genérico
function showMenu(e, html, bindFn) {
  e.preventDefault(); e.stopPropagation();
  const menu = $('#ctx-menu');
  menu.innerHTML = html;
  menu.classList.toggle('has-card', !!menu.querySelector('.pcard')); // size the profile card before placing it
  menu.classList.remove('hidden');
  const r = menu.getBoundingClientRect();
  menu.style.left = clamp(e.clientX, 4, innerWidth - r.width - 4) + 'px';
  menu.style.top = clamp(e.clientY, 4, innerHeight - r.height - 4) + 'px';
  globalThis.resenhaMotion?.popIn(menu); // nasce do nome ou avatar clicado
  bindFn && bindFn(menu);
}
const hideMenu = () => { const m = $('#ctx-menu'), hide = () => m.classList.add('hidden'); if (globalThis.resenhaMotion?.popOut) globalThis.resenhaMotion.popOut(m, hide); else hide(); };

// ---------------- Sons (sintetizados) ----------------
let sfxCtx = null;
function sfx(kind) {
  if (!settings.sounds) return;
  try {
    if (!sfxCtx) { sfxCtx = new AudioContext(); if (settings.outputDevice !== 'default' && sfxCtx.setSinkId) sfxCtx.setSinkId(settings.outputDevice).catch(() => {}); }
    const seq = { join: [[523, 0], [784, .09]], leave: [[784, 0], [523, .09]], mute: [[440, 0], [330, .07]], unmute: [[330, 0], [440, .07]], msg: [[880, 0], [1175, .06]], mention: [[988, 0], [1319, .07], [1568, .14]], share: [[523, 0], [659, .07], [784, .14]], shareEnd: [[784, 0], [659, .07], [523, .14]] }[kind] || [[600, 0]];
    const t0 = sfxCtx.currentTime + 0.01;
    for (const [f, dt] of seq) {
      const o = sfxCtx.createOscillator(), g = sfxCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + dt); g.gain.linearRampToValueAtTime(0.12, t0 + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.16);
      o.connect(g).connect(sfxCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.18);
    }
  } catch {}
}

let roomsRenderToken=0;
let storedRooms = [], savingRoomFailed = false, staleRoomWarned = false;
async function renderMyRooms(check=false) {
  if(!native?.rooms)return;
  const token=++roomsRenderToken;
  storedRooms=await native.rooms.list();
  const showOld=!!renderMyRooms.showOld,rooms=showOld?storedRooms:visibleRooms(storedRooms),hiddenCount=storedRooms.length-visibleRooms(storedRooms).length;
  const root=$('#my-rooms');if(!root)return;
  root.classList.toggle('hidden',!storedRooms.length);
  // Fileira de cards (estilo Apple TV): arte com a cor ou o ícone da sala, nome, status e botão.
  root.innerHTML='<h2>Minhas salas</h2><div class="shelf-wrap"><button class="shelf-arrow prev" aria-label="Salas anteriores">'+icon('chevronLeft',18)+'</button><div class="room-shelf">'+rooms.map((r,i)=>`<div class="saved-room ${r.look?.cover ? 'has-cover' : ''}" data-room-row="${i}" style="--room-color:${r.look?.color || serverColor(r.code)}${r.look?.cover ? `;--room-cover:url('${esc(r.look.cover)}')` : ''}"><button class="saved-room-hide" data-hide-room="${esc(normCode(r.code))}" title="Ocultar esta sala da lista (não apaga nada)" aria-label="Ocultar sala">${icon('x',13)}</button><div class="saved-room-art">${r.icon?`<img src="${esc(r.icon)}" alt="">`:`<span class="saved-room-badge" aria-hidden="true">${esc(initials(r.name))}</span>`}${normCode(r.code)===favoriteCode()?`<i class="saved-room-fav" title="Abre ao iniciar">${icon('star',11)}</i>`:''}</div><div class="saved-room-info"><b>${esc(r.name)}</b><span class="saved-room-status" data-room-status="${i}">${check?'Verificando…':esc(fmtCode(r.code))}</span></div><button class="btn" data-open-room="${i}">Abrir sala</button></div>`).join('')+'</div><button class="shelf-arrow next" aria-label="Mais salas">'+icon('chevronLeft',18)+'</button></div>'
    +(hiddenCount&&!showOld?`<button class="rooms-old" data-rooms-old>Mostrar ${hiddenCount} ${hiddenCount===1?'sala oculta':'salas ocultas'}</button>`:showOld&&hiddenCount?'<button class="rooms-old" data-rooms-old>Esconder salas antigas</button>':'');
  root.classList.toggle('hidden',!rooms.length&&!hiddenCount);
  $$('[data-hide-room]',root).forEach(b=>b.onclick=(e)=>{e.stopPropagation();const h=new Set(LS.get('hiddenRooms',[]));h.add(b.dataset.hideRoom);LS.set('hiddenRooms',[...h]);renderMyRooms();renderServerRow();});
  $('[data-rooms-old]',root)?.addEventListener('click',()=>{renderMyRooms.showOld=!showOld;if(renderMyRooms.showOld)LS.set('hiddenRooms',[]);renderMyRooms(true);});
  setupShelf($('.shelf-wrap',root));
  $$('[data-open-room]',root).forEach(b=>b.onclick=()=>openStoredRoom(rooms[+b.dataset.openRoom]));
  $$('[data-room-row]',root).forEach(c=>c.onclick=(e)=>{if(!e.target.closest('button'))$('[data-open-room]',c)?.click();}); // o card inteiro abre a sala
  if(check)for(let i=0;i<rooms.length;i++){
    if(token!==roomsRenderToken||$('#home').classList.contains('hidden'))break;
    const result=await native.rooms.inspect(rooms[i].code);
    if(token!==roomsRenderToken)break;const el=$(`[data-room-status="${i}"]`,root);if(!el||!document.body.contains(root))break;
    const code=fmtCode(rooms[i].code);
    el.textContent=result.state==='online'?`Online · ${code}`:result.state==='offline'?`Ninguém hospedando · você pode abrir · ${code}`:`Não deu para verificar agora · ${code}`;
    const row=$(`[data-room-row="${i}"]`,root);if(row)row.dataset.state=result.state;
    const btn=$(`[data-open-room="${i}"]`,root);if(btn){btn.textContent=result.state==='online'?'Entrar':'Abrir sala';btn.classList.toggle('primary',result.state==='online');}
  }
}
async function openStoredRoom(room, opts={}) {
  if(!checkName()||!room||!native)return;
  const status=$('#home-error');status.textContent='Consultando a descoberta e verificando quem hospeda…';
  let password=$('#join-pass').value || $('#host-pass').value;
  if((room.configuration?.needsPassword||room.configuration?.legacyPasswordUnknown)&&!password){password=await promptModal(room.configuration?.legacyPasswordUnknown?'Senha da sala antiga (deixe vazio se não havia)':'Senha original da sala',{placeholder:'Senha que vocês já usam',inputType:'password',maxLength:512});if(password===null)return;}
  try {
    const result=await native.rooms.claim({code:room.code,id:CID});
    if(result.state==='online') { if(opts.auto||await confirmModal('Sala online','Já existe um anfitrião. Entrar na sala que está aberta?','Entrar',false))await joinByCode(room.code,password);return; }
    if(result.state==='lost'){status.textContent='Outro membro ganhou a reivindicação. Aguardando a sala abrir…';await new Promise(r=>setTimeout(r,2000));await joinByCode(room.code,password);return;}
    if(result.state!=='won')throw new Error(result.error||'Não foi possível reivindicar esta sala.');
    status.textContent='Abrindo a cópia local da sala…';
    const snap=result.snapshot;
    const r=await native.startHost({roomName:snap.name,port:7777,autoPort:true,password,code:snap.code,restore:snap,resume:true});
    if(!r.ok)throw new Error(r.error);
    S.code=fmtCode(snap.code);S.isHost=true;S.hostKey=r.hostKey;S.viaCode=null;S.joinedAt=Date.now();S.epoch=0;S.forceGuest=false;
    connect(parseAddr('127.0.0.1:'+r.port),password,true);
    toast('Sala retomada com a revisão '+snap.revision+'. A cópia pode não conter as últimas mensagens do anfitrião anterior.','',8000);
  } catch(e){status.textContent=e.message;}
}

// ---------------- Servidores: fileira de bolinhas, favorito e ícone ----------------
// A "servidor" is a saved room (permanent code). The row lists them; the favourite opens on start.
const SERVER_COLORS=['#d6402b','#0369a1','#047857','#b45309','#be185d','#6a4bb3'];
const normCode=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const serverColor=c=>SERVER_COLORS[[...normCode(c)].reduce((a,ch)=>a+ch.charCodeAt(0),0)%SERVER_COLORS.length];
const favoriteCode=()=>LS.get('favoriteRoom','');
// Salas sem atividade há mais de ROOM_IDLE_DAYS dias somem das listas (nada é apagado; "Mostrar salas ocultas" traz de volta).
// O favorito, a sala atual e a última sala aberta sempre aparecem.
const ROOM_IDLE_DAYS=7;
function visibleRooms(list){
  const hidden=new Set(LS.get('hiddenRooms',[])),keep=new Set([favoriteCode(),normCode(S.code),normCode(LS.get('lastRoom',null)?.code)].filter(Boolean)),cutoff=Date.now()-ROOM_IDLE_DAYS*864e5;
  return list.filter(r=>{const c=normCode(r.code);return keep.has(c)||(!hidden.has(c)&&(Number(r.updatedAt)||0)>=cutoff);});
}
// Setas e pontas esmaecidas da fileira de salas, como as fileiras do Apple TV.
function setupShelf(wrap){
  const shelf=wrap?.querySelector('.room-shelf');if(!shelf)return;
  const prev=wrap.querySelector('.prev'),next=wrap.querySelector('.next');
  const update=()=>{const l=shelf.scrollLeft>4,r=shelf.scrollLeft+shelf.clientWidth<shelf.scrollWidth-4;shelf.classList.toggle('more-l',l);shelf.classList.toggle('more-r',r);prev.classList.toggle('on',l);next.classList.toggle('on',r);};
  const page=(d)=>shelf.scrollBy({left:d*Math.max(230,shelf.clientWidth-120)});
  prev.onclick=()=>page(-1);next.onclick=()=>page(1);
  shelf.addEventListener('scroll',update,{passive:true});
  shelf.addEventListener('wheel',(e)=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&shelf.scrollWidth>shelf.clientWidth){e.preventDefault();shelf.scrollBy({left:e.deltaY});}},{passive:false});
  new ResizeObserver(update).observe(shelf);update();
}
async function renderServerRow(){
  const row=$('#server-row');if(!row)return;
  if(!native?.rooms){row.classList.add('hidden');return;}
  try{storedRooms=await native.rooms.list();}catch{}
  const cur=normCode(S.code),fav=favoriteCode();
  const list=visibleRooms(storedRooms).sort((a,b)=>(normCode(b.code)===fav)-(normCode(a.code)===fav));
  row.innerHTML=list.map(r=>{
    const code=normCode(r.code),isCur=code===cur,img=isCur&&S.roomIcon!==undefined?S.roomIcon:r.icon,name=isCur&&S.roomName?S.roomName:r.name,dotColor=(isCur&&S.roomLook?.color)||r.look?.color||serverColor(code),cover=isCur&&S.roomLook?S.roomLook.cover:r.look?.cover;
    return `<button class="server-dot ${isCur?'active':''}" data-server="${esc(code)}" title="${esc(name)}${code===fav?' · abre ao iniciar':''}" aria-label="${esc(name)}" aria-current="${isCur}" style="--dot:${dotColor}">${img?`<img src="${esc(img)}" alt="">`:cover?`<img class="from-cover" src="${esc(cover)}" alt="">`:`<span>${esc(initials(name))}</span>`}${code===fav?`<i class="server-fav" aria-hidden="true">${icon('star',9)}</i>`:''}</button>`;
  }).join('')+`<button class="server-dot ghost" data-server-add title="Entrar ou criar servidor" aria-label="Entrar ou criar servidor">${icon('add',16)}</button><button class="server-dot ghost home" data-server-home title="Página inicial" aria-label="Página inicial">${icon('home',16)}</button>`;
  row.classList.remove('hidden');
  $$('[data-server]',row).forEach(b=>b.onclick=()=>switchServer(b.dataset.server));
  $('[data-server-add]',row).onclick=()=>goHome('#join-addr');
  $('[data-server-home]',row).onclick=()=>goHome();
}
async function goHome(focus){
  if(V.joined&&!await confirmModal('Voltar à página inicial','Você vai sair da call e do servidor. Continuar?','Sair',false))return;
  forgetLastRoom();
  await leaveRoom();
  if(focus)setTimeout(()=>$(focus)?.focus(),50);
}
async function switchServer(code){
  const room=storedRooms.find(r=>normCode(r.code)===code);
  if(!room||code===normCode(S.code))return;
  if(V.joined&&!await confirmModal('Trocar de servidor',`Você vai sair da call e entrar em ${esc(room.name)}.`,'Trocar',false))return;
  await leaveRoom();
  await openStoredRoom(room,{auto:true});
}
// On start the app opens the favourite, else the last server you were in (left via home or "Sair" clears it).
const rememberRoom=()=>{if(native?.rooms&&S.code)LS.set('lastRoom',{code:normCode(S.code),name:S.roomName||''});};
const forgetLastRoom=()=>LS.set('lastRoom',null);
// Card da sala para a tela de carregamento (boot-card.js): nome, cor, capa, ícone. Guarda só as 6 salas mais recentes.
function rememberRoomCard(){
  if(!native?.rooms||!S.code||!S.roomName)return;
  const code=normCode(S.code),look=S.roomLook||{},card={name:S.roomName,color:look.color||serverColor(code),about:look.about||'',cover:look.cover||'',icon:S.roomIcon||''};
  try{
    const prev=LS.get('card.'+code,null);if(prev&&JSON.stringify(prev)===JSON.stringify(card))return;
    LS.set('card.'+code,card);
    const idx=[code,...LS.get('cardIndex',[]).filter((c)=>c!==code)];
    for(const old of idx.slice(6))localStorage.removeItem('resenha.card.'+old);
    LS.set('cardIndex',idx.slice(0,6));
  }catch{}
}
function endBoot(){document.documentElement.classList.remove('booting');}
let startTried=false;
async function openStartServer(){
  if(startTried)return;startTried=true;
  const booting=document.documentElement.classList.contains('booting');
  if(!native?.rooms||WEB_VIEWER||!me.name.trim())return endBoot();
  const code=favoriteCode()||LS.get('lastRoom',null)?.code;
  const room=code&&(storedRooms.length?storedRooms:await native.rooms.list()).find(r=>normCode(r.code)===code);
  if(!room||$('#home').classList.contains('hidden'))return endBoot();
  if(booting){
    $('#boot-name').textContent=`Entrando no ${room.name}…`;
    // Mirror the progress lines ("Procurando a sala…") on the loading screen.
    const status=$('#home-error'),mirror=new MutationObserver(()=>{$('#boot-status').textContent=status.textContent;});
    mirror.observe(status,{childList:true,characterData:true,subtree:true});
    setTimeout(()=>mirror.disconnect(),30000);
  }
  S.invitedOnce=true; // opening on start should not pop the invite window every time
  await openStoredRoom(room,{auto:true});
  // Give the connection time to say hello; if it never does, show the home screen with the reason.
  for(let i=0;i<30&&$('#main').classList.contains('hidden');i++)await new Promise(r=>setTimeout(r,500));
  endBoot();
}
function toggleFavorite(){
  const code=normCode(S.code);if(!code)return;
  const on=favoriteCode()!==code;LS.set('favoriteRoom',on?code:'');LS.set('favoriteRoomName',on?S.roomName:'');
  toast(on?`${S.roomName} vai abrir quando você iniciar o Resenha.`:'O Resenha volta a abrir na página inicial.');
  renderServerRow();
}
function pickServerIcon(){
  const inp=$('#avatar-input');inp.value='';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=96;const s=Math.min(img.width,img.height);
      c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,96,96);URL.revokeObjectURL(img.src);
      wsSend({t:'room',name:S.roomName,icon:c.toDataURL('image/jpeg',0.85)});};
    img.src=URL.createObjectURL(f);};
  inp.click();
}

// Personalizar sala (só o anfitrião): foto de capa do grupo, ícone, nome, descrição e cor. Todos veem na hora.
const ROOM_COLORS = ['#e0533a', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
function shrinkImage(file, w, h, maxBytes) { // corta no centro para w×h e reduz até caber em maxBytes
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
      c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      for (let q = 0.85; q >= 0.4; q -= 0.08) { const d = c.toDataURL('image/jpeg', q); if (d.length <= maxBytes) return resolve(d); }
      reject(new Error('A imagem ficou grande demais.'));
    };
    img.onerror = () => reject(new Error('Não consegui abrir essa imagem.'));
    img.src = URL.createObjectURL(file);
  });
}
function openRoomLook() {
  if (!S.isHost) return;
  const look = { ...(S.roomLook || {}) }; let name = S.roomName, iconData = S.roomIcon || '';
  const m = openModal(`<header><div><h2>Personalizar sala</h2><p>Todo mundo na sala vê as mudanças na hora.</p></div><button class="icon-btn" data-close>${icon('x')}</button></header>
    <div class="body room-look">
      <div class="rl-preview"><div class="rl-cover"></div><div class="rl-id"><span class="rl-icon"></span><div><b class="rl-name"></b><span class="rl-about muted small"></span></div></div></div>
      <div class="rl-actions"><button class="btn" id="rl-cover">Escolher foto de capa</button><button class="btn" id="rl-nocover">Remover capa</button><button class="btn" id="rl-icon">Escolher ícone</button><button class="btn" id="rl-noicon">Remover ícone</button></div>
      <div class="field"><label>Nome da sala</label><input id="rl-name" maxlength="40"></div>
      <div class="field"><label>Descrição <span class="muted">(até 140 letras)</span></label><input id="rl-about-in" maxlength="140" placeholder="Ex.: Os ranqueados de quinta"></div>
      <div class="field"><label>Cor da sala</label><div class="rl-colors">${ROOM_COLORS.map((c) => `<button class="rl-color" data-color="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join('')}<input type="color" id="rl-custom" title="Outra cor"></div></div>
      <p class="muted small" id="rl-err"></p>
    </div>
    <footer><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rl-save">Salvar</button></footer>`, { wide: true });
  const el = m.el, $e = (q) => $(q, el);
  const pick = (cb) => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => inp.files[0] && cb(inp.files[0]); inp.click(); };
  const paint = () => {
    const color = look.color || serverColor(S.code || S.roomName);
    $e('.rl-cover').style.background = look.cover ? `center/cover no-repeat url("${look.cover}")` : `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))`;
    $e('.rl-icon').innerHTML = iconData ? `<img src="${iconData}" alt="">` : esc(initials(name || 'S'));
    $e('.rl-icon').style.background = color;
    $e('.rl-name').textContent = name || 'Sala'; $e('.rl-about').textContent = look.about || 'Sem descrição';
    $e('#rl-nocover').disabled = !look.cover; $e('#rl-noicon').disabled = !iconData;
    $$('.rl-color', el).forEach((b) => b.classList.toggle('sel', b.dataset.color === look.color));
  };
  $e('#rl-name').value = name; $e('#rl-about-in').value = look.about || ''; $e('#rl-custom').value = look.color || '#8b5cf6';
  $e('#rl-name').oninput = (e) => { name = e.target.value; paint(); };
  $e('#rl-about-in').oninput = (e) => { look.about = e.target.value; paint(); };
  $$('.rl-color', el).forEach((b) => b.onclick = () => { look.color = b.dataset.color; paint(); });
  $e('#rl-custom').oninput = (e) => { look.color = e.target.value; paint(); };
  const err = (t) => { $e('#rl-err').textContent = t || ''; };
  $e('#rl-cover').onclick = () => pick(async (f) => { try { err('Preparando a foto…'); look.cover = await shrinkImage(f, 960, 320, 185 * 1024); err(); paint(); } catch (e) { err(e.message); } });
  $e('#rl-nocover').onclick = () => { delete look.cover; paint(); };
  $e('#rl-icon').onclick = () => pick(async (f) => { try { iconData = await shrinkImage(f, 96, 96, 46 * 1024); err(); paint(); } catch (e) { err(e.message); } });
  $e('#rl-noicon').onclick = () => { iconData = ''; paint(); };
  $e('#rl-save').onclick = () => {
    const clean = {}; if (look.cover) clean.cover = look.cover; if ((look.about || '').trim()) clean.about = look.about.trim(); if (look.color) clean.color = look.color;
    if (!wsSend({ t: 'room', name: (name || '').trim() || S.roomName, icon: iconData, look: clean })) return err('Sem conexão com a sala.');
    m.close(); toast('Sala atualizada.', 'ok', 2500);
  };
  paint();
}

// ---------------- Tela inicial ----------------
function parseAddr(s) {
  s = String(s || '').trim().replace(/^(https?|wss?):\/\//i, '').replace(/\/.*$/, '');
  if (!s) return null;
  let host, port;
  if (s.startsWith('[')) { const m = /^\[([^\]]+)\](?::(\d+))?$/.exec(s); if (!m) return null; host = m[1]; port = m[2]; }
  else if ((s.match(/:/g) || []).length > 1) host = s;
  else [host, port] = s.split(':');
  port = Number(port) || 7777;
  if (!host) return null;
  const hf = host.includes(':') ? `[${host}]` : host;
  return { host, port, hf, text: `${hf}:${port}` };
}
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const r = crypto.getRandomValues(new Uint8Array(8));
  const s = [...r].map((b) => CODE_ABC[b % CODE_ABC.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4);
}
const looksLikeAddr = (s) => /[.:[]/.test(String(s || '').trim());

function initHome() {
  $('#home-name').value = me.name;
  $('#home-color').value = me.color;
  setAvatarEl($('#home-avatar'), me);
  $('#home-avatar').classList.add('avatar');
  const greet = () => { const h = new Date().getHours(), part = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'; const g = $('#home-greeting'); if (g) g.textContent = me.name.trim() ? `${part}, ${me.name.trim()}` : part; };
  greet();
  $('#home-name').oninput = () => { me.name = $('#home-name').value; LS.set('profile', me); setAvatarEl($('#home-avatar'), me); greet(); };
  $('#home-avatar').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#home-avatar').click(); } };
  $('#home-color').oninput = () => { me.color = $('#home-color').value; LS.set('profile', me); setAvatarEl($('#home-avatar'), me); };
  $('#home-avatar').onclick = () => pickAvatar(() => setAvatarEl($('#home-avatar'), me));
  const last = LS.get('lastHost', {});
  $('#host-name').value = last.name || '';
  $('#host-port').value = last.port || 7777;
  $('#btn-host').onclick = hostRoom;
  $('#btn-join').onclick = () => joinRoom($('#join-addr').value, $('#join-pass').value);
  $('#join-addr').onkeydown = $('#join-pass').onkeydown = (e) => { if (e.key === 'Enter') $('#btn-join').click(); };
  if (!native) { $('#btn-host').disabled = true; $('#btn-host').textContent = 'Criar sala só no app'; }
  else native.version().then((v) => { $('#home-version').textContent = 'Resenha v' + v; });
  renderRecent();
  if(native?.rooms){
    native.rooms.import(LS.get('roomCodes',{})).then(()=>{renderMyRooms(true);openStartServer();}).catch(e=>{endBoot();throw e;}).catch(e=>toast('Não consegui ler as cópias de salas: '+e.message,'err'));
    native.hostBackground().then(p=>{$('#host-background').checked=p.keepHostOnline;});
    $('#host-background').onchange=e=>native.hostBackground(e.target.checked);
  } else {$('#my-rooms').classList.add('hidden');$('#host-background').closest('label').classList.add('hidden');}
}
function renderRecent() {
  const list = LS.get('recent', []);
  $('#recent').innerHTML = list.length ? `<div class="field" style="margin:0"><label>Recentes</label></div>` + list.map((r, i) =>
    `<div class="recent-item" data-i="${i}"><span><b>${esc(r.name || 'Sala')}</b> <span class="muted small">${esc(r.addr)}</span></span><span class="x" data-x="${i}">${icon('x', 16)}</span></div>`).join('') : '';
  $$('.recent-item', $('#recent')).forEach((el) => el.onclick = (e) => {
    const i = +el.dataset.i;
    if (e.target.closest('[data-x]')) { list.splice(i, 1); LS.set('recent', list); return renderRecent(); }
    $('#join-addr').value = list[i].addr; joinRoom(list[i].addr, $('#join-pass').value);
  });
}
function addRecent(addr, name) {
  const list = LS.get('recent', []).filter((r) => r.addr !== addr);
  list.unshift({ addr, name }); LS.set('recent', list.slice(0, 6));
}
function pickAvatar(done) {
  const inp = $('#avatar-input');
  inp.value = '';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
      me.avatar = c.toDataURL('image/jpeg', 0.85); LS.set('profile', me);
      URL.revokeObjectURL(img.src); if (done) done(); sendProfile();
    };
    img.src = URL.createObjectURL(f);
  };
  inp.click();
}
function checkName() {
  if (!me.name.trim()) { $('#home-error').textContent = 'Coloca seu nome primeiro.'; $('#home-name').focus(); return false; }
  return true;
}

async function hostRoom() {
  if (!checkName()) return;
  const roomName = $('#host-name').value.trim() || `Sala do ${me.name}`;
  const port = Number($('#host-port').value) || 7777;
  const password = $('#host-pass').value;
  LS.set('lastHost', { name: $('#host-name').value.trim(), port });
  $('#btn-host').disabled = true; $('#home-error').textContent = '';
  const codes = LS.get('roomCodes', {});
  const code = codes[roomName] || (codes[roomName] = newCode());
  const existing = storedRooms.find(r=>fmtCode(r.code)===fmtCode(code));
  if(existing){$('#btn-host').disabled=false;return openStoredRoom(existing);} 
  LS.set('roomCodes', codes);
  const r = await native.startHost({ roomName, port, password, code, rank: [0, Date.now(), CID] });
  $('#btn-host').disabled = false;
  if (!r.ok) { $('#home-error').textContent = r.error; return; }
  S.code = code; S.isHost = true; S.hostKey = r.hostKey; S.viaCode = null; S.joinedAt = Date.now(); S.epoch = 0; S.forceGuest = false;
  connect(parseAddr('127.0.0.1:' + r.port), password, true);
}

async function joinRoom(addrText, password) {
  if (!checkName()) return;
  S.viaCode = null;
  if (addrText && !looksLikeAddr(addrText)) return joinByCode(addrText, password);
  const a = parseAddr(addrText);
  if (!a) { $('#home-error').textContent = 'Código ou endereço inválido. Exemplo: K7P4-QX9M'; return; }
  $('#btn-join').disabled = true; $('#home-error').textContent = 'Conectando...';
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 7000);
    const info = await fetch(`${WEB_VIEWER ? location.origin : 'http://' + a.text}/api/info`, { signal: ctl.signal }).then((r) => r.json());
    clearTimeout(to);
    if (info.app !== 'resenha') throw new Error('não é sala do Resenha');
    if (info.needsPassword && !password) { $('#home-error').textContent = 'Essa sala tem senha.'; $('#join-pass').focus(); $('#btn-join').disabled = false; return; }
    S.isHost = false; S.hostKey = null; S.code = null; S.joinedAt = Date.now(); S.forceGuest = false;
    addRecent(a.text, info.name);
    connect(a, password, true);
  } catch (e) {
    $('#home-error').textContent = `Não consegui chegar na sala ${a.text}.\nConfere se o IP e a porta estão certos, se a sala está aberta e se o anfitrião liberou a porta.`;
  }
  $('#btn-join').disabled = false;
}

async function joinByCode(codeText, password) {
  const code = fmtCode(codeText);
  if (code.replace('-', '').length !== 8) { $('#home-error').textContent = 'O código tem 8 letras/números, tipo K7P4-QX9M.'; return; }
  if (globalThis.RESENHA_PWA) return pwaJoin(code, password);
  if (!window.Tun) { $('#home-error').textContent = 'Entrar por código só funciona no app.'; return; }
  $('#btn-join').disabled = true; $('#home-error').textContent = 'Procurando a sala...';
  try {
    const t = await Tun.guestConnect(code, (s) => ($('#home-error').textContent = s));
    const a = parseAddr(t.addr);
    const info = await fetch(`http://${a.text}/api/info`).then((r) => r.json());
    if (info.needsPassword && !password) { Tun.guestClose(); $('#home-error').textContent = 'Essa sala tem senha.'; $('#join-pass').focus(); $('#btn-join').disabled = false; return; }
    S.isHost = false; S.hostKey = null; S.viaCode = code; S.code = code; S.joinedAt = Date.now(); S.forceGuest = false;
    addRecent(code, info.name);
    connect(a, password, true);
  } catch (e) {
    Tun.guestClose();
    if(e.message==='notfound' && native?.rooms){
      const cached=(await native.rooms.list()).find(r=>fmtCode(r.code)===code);
      if(cached && await confirmModal('Ninguém está hospedando','Este PC tem uma cópia desta sala. Abrir aqui com o mesmo código?','Abrir sala',false)) {$('#btn-join').disabled=false;return openStoredRoom(cached);}
    }
    const msg = {
      notfound: `Não achei a sala ${code}.\nO código só funciona enquanto alguém hospeda a sala. Se todos fecharam o app, o anfitrião deve reabrir a sala com o mesmo nome no computador usado antes; depois os amigos entram pelo código.`,
      nobroker: 'Sem internet, ou algo está bloqueando o app (antivírus/firewall).',
      p2p: 'Achei a sala, mas não consegui ligar os dois PCs.\nA rede de um de vocês bloqueia conexão direta (comum em rede de faculdade/empresa ou 4G). Tente trocar quem abre a sala.',
    }[e.message] || 'Erro: ' + e.message;
    $('#home-error').textContent = msg;
  }
  $('#btn-join').disabled = false;
}
// PWA (celular/tablet pelo navegador): acha a sala pelo código e conecta por dentro do túnel (pwa/pwa.js).
const PWA_ADDR = { text: 'túnel', host: 'tunel', port: 0 };
async function pwaJoin(code, password) {
  const P = globalThis.RESENHA_PWA;
  $('#btn-join').disabled = true; $('#home-error').textContent = 'Procurando a sala...';
  try {
    await P.connect(code, (s) => ($('#home-error').textContent = s));
    const info = await P.http({ path: '/api/info' }).then((r) => JSON.parse(new TextDecoder().decode(r.body))); // direto pelo túnel: não depende do service worker
    if (info.app !== 'resenha') throw new Error('notfound');
    if (info.needsPassword && !password) { P.close(); $('#home-error').textContent = 'Essa sala tem senha.'; $('#join-pass').focus(); $('#btn-join').disabled = false; return; }
    S.isHost = false; S.hostKey = null; S.viaCode = code; S.code = code; S.joinedAt = Date.now(); S.forceGuest = false;
    LS.set('pwaLastCode', code);
    connect(PWA_ADDR, password, true);
  } catch (e) {
    P.close();
    $('#home-error').textContent = {
      notfound: `Não achei a sala ${code}. O código só funciona enquanto alguém está com a sala aberta no app do PC.`,
      nobroker: 'Sem internet, ou a rede está bloqueando a busca da sala.',
      p2p: 'Achei a sala, mas não consegui ligar o celular ao PC de quem hospeda. Tente outra rede (Wi-Fi em vez de 4G, por exemplo).',
    }[e.message] || 'Erro: ' + e.message;
  }
  $('#btn-join').disabled = false;
}
// Conexão caiu no PWA: reconecta pelo túnel; se o anfitrião mudou (4003/4004), procura o código de novo.
function pwaReconnect(code, password, closeCode, wasIn) {
  const P = globalThis.RESENHA_PWA;
  S.rejoinVoice = S.rejoinVoice || wasIn;
  showBanner(closeCode === 4003 || closeCode === 4004 ? 'Trocando de anfitrião...' : 'Reconectando...');
  if (S.reconnectTries++ > 20) { hideBanner(); leaveRoom(); $('#home-error').textContent = 'Perdi a conexão com a sala.'; return; }
  setTimeout(async () => {
    if (S.closing) return;
    try {
      if (!P.alive() || closeCode === 4003 || closeCode === 4004) await P.connect(code, () => {}, { attempts: 2 });
      hideBanner(); connect(PWA_ADDR, password, false);
    } catch { pwaReconnect(code, password, closeCode, wasIn); }
  }, closeCode === 4003 || closeCode === 4004 ? 3000 : 1500);
}
// Tun é declarado como const em tunnel.js (script clássico): fica no escopo global léxico
window.Tun = typeof Tun !== 'undefined' ? Tun : null; // eslint-disable-line no-undef

// ---------------- Conexão com a sala ----------------
function connect(addr, password, first) {
  S.addr = addr; S.password = password; S.closing = false;
  const viaPWA = addr === PWA_ADDR && globalThis.RESENHA_PWA;
  S.base = viaPWA ? viaPWA.base : WEB_VIEWER ? location.origin : `http://${addr.text}`;
  const ws = viaPWA ? viaPWA.socket() : new WebSocket(WEB_VIEWER ? location.origin.replace(/^http/, 'ws') : `ws://${addr.text}`);
  S.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid: CID, resume: sessionResume(), joinedAt: S.joinedAt, name: me.name.trim(), color: me.color, avatar: me.avatar, ...profileExtras(), password, hostKey: S.hostKey, canHost: !!native && !WEB_VIEWER }));
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } handle(m); };
  ws.onclose = (ev) => {
    if (S.ws !== ws || S.closing) return;
    rejectPendingCommands('A conexão com a sala caiu. Tente novamente após reconectar.');
    if (ev.code === 4001) { leaveRoom(); $('#home-error').textContent = 'Senha incorreta.'; return; }
    if (ev.code === 4002) { leaveRoom(); $('#home-error').textContent = 'O anfitrião encerrou a sala.'; return; }
    if (!S.myId && first && ev.code !== 4004) { leaveRoom(); $('#home-error').textContent = 'A conexão caiu antes de entrar.'; return; }
    // Sala com código: se o anfitrião cair, outro amigo assume e todo mundo reconecta sozinho
    if (S.code && window.Tun && native) { failover(ev.code); return; }
    if (S.code && addr === PWA_ADDR && globalThis.RESENHA_PWA) { const wasIn = V.joined ? V.channel : null; teardownVoice(); S.myId = null; setConnStatus('bad', 'Reconectando...'); pwaReconnect(S.code, password, ev.code, wasIn); return; }
    const wasIn = V.joined ? V.channel : null;
    teardownVoice();
    S.myId = null;
    setConnStatus('bad', 'Reconectando...');
    if (S.reconnectTries++ > 30) { leaveRoom(); $('#home-error').textContent = 'Perdi a conexão com a sala.'; return; }
    setTimeout(async () => {
      if (S.closing) return;
      S.rejoinVoice = S.rejoinVoice || wasIn;
      let a = addr;
      if (S.viaCode && !Tun.guestAlive()) {
        try { const t = await Tun.guestConnect(S.viaCode, () => {}); a = parseAddr(t.addr); } catch {}
      }
      connect(a, password, false);
    }, 2000);
  };
}
function wsSend(obj) { if (S.ws && S.ws.readyState === 1) { S.ws.send(JSON.stringify(obj)); return true; } return false; }
const commandRequests = new Map();
const commandTrace = [];
const commandController = createCommandController({ S, crypto, setTimeout, clearTimeout, wsSend, requests: commandRequests, trace: commandTrace });
function traceCommand(type, status) { return commandController.traceCommand(type, status); }
function sendCommand(type, payload = {}) { return commandController.sendCommand(type, payload); }
function finishCommand(result) { return commandController.finishCommand(result); }
function rejectPendingCommands(message) { return commandController.rejectPendingCommands(message); }
function djCommand(type, payload = {}) { return sendCommand(type,payload).catch((e) => toast(e.message,'err',7000)); }

// ---------------- Troca automática de anfitrião ----------------
// Todo mundo guarda uma cópia da sala. Se o anfitrião cair, quem entrou primeiro (entre os que sobraram)
// abre a sala com o MESMO código e a cópia; os outros procuram o código e reconectam.
function successionOrder() {
  return [...S.users.values()]
    .filter((u) => u.id !== DJ_ID && u.joinedAt && !u.isHost)
    .sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
}
function snapshot() {
  return {
    ...(S.latestRoomSnapshot || {}), channels: S.channels, history: S.history,
    dj: S.dj && S.dj.active ? { active: true, channelId: S.dj.channelId, textChannel: S.dj.textChannel, queue: S.dj.queue } : null,
  };
}
function showBanner(text, kind = 'warn') {
  let b = $('#conn-banner');
  if (!b) { b = document.createElement('div'); b.id = 'conn-banner'; $('#main').appendChild(b); }
  b.className = kind; b.innerHTML = `<span class="spinner"></span><span>${text}</span>`;
}
function hideBanner() { $('#conn-banner')?.remove(); }

async function failover(closeCode) {
  if (S.failing) return;
  S.failing = true;
  const code = S.code, myId = S.myId, epoch = (S.epoch || 0) + 1;
  const wasHost = S.isHost;
  S.quietUntil = Date.now() + 20000;
  const picked = S.nextHost && Date.now() - S.nextHost.at < 30000 ? S.nextHost.id : null; S.nextHost = null;
  const order = successionOrder().filter((u) => u.id !== (wasHost ? myId : null)).sort((a, b) => (b.id === picked) - (a.id === picked));
  const snap = snapshot();
  const mine = order.findIndex((u) => u.id === myId);
  S.myId = null; S.ws = null; S.token = S.token || '';
  setConnStatus('bad', 'Reconectando...');
  try {
    if (!wasHost && !S.forceGuest) {
      // Fila de sucessão: o 1º assume já; os outros esperam um pouco pra dar chance a quem vem antes.
      // 4004 = o anfitrião passou a sala pra outro que já existe: só procurar.
      const delay = closeCode === 4004 ? 20000 : mine < 0 ? 12000 : mine * 6000;
      showBanner(picked ? (mine === 0 ? 'Você está assumindo a sala...' : 'Passando a sala para o novo anfitrião...') : mine === 0 ? 'O anfitrião caiu. Você está assumindo a sala...' : 'O anfitrião caiu. Trocando de anfitrião...');
      if (delay) {
        // tenta achar o novo anfitrião enquanto espera a vez
        try {
          const t = await Tun.guestConnect(code, () => {}, { attempts: 1, timeoutMs: delay });
          return reconnectTo(parseAddr(t.addr));
        } catch {}
        if (S.closing) return;
      }
      if (S.closing) return;
      await becomeHost(code, epoch, snap);
      return;
    }
    // Eu era o anfitrião (ou fui mandado ser convidado): procuro a sala como convidado
    showBanner('Procurando a sala...');
    const t = await Tun.guestConnect(code, () => {}, { attempts: 4, timeoutMs: 15000 });
    return reconnectTo(parseAddr(t.addr));
  } catch (e) {
    if (S.closing) return;
    // Ninguém respondeu: tenta assumir (se não fui eu que desisti de hospedar)
    if (!S.forceGuest) { try { await becomeHost(code, epoch, snap); return; } catch {} }
    S.failing = false;
    if (S.reconnectTries++ > 8) { leaveRoom(); $('#home-error').textContent = 'Perdi a conexão com a sala.'; return; }
    setTimeout(() => failover(closeCode), 3000);
  } finally { S.failing = false; }
}
function reconnectTo(addr) {
  S.isHost = false; S.hostKey = null; S.viaCode = S.code;
  connect(addr, S.password, false);
}
async function becomeHost(code, epoch, snap) {
  showBanner('Você virou o anfitrião da sala. Os outros estão reconectando...', 'ok');
  const r = await native.startHost({ roomName: S.roomName, port: (S.addr && S.isHost ? S.addr.port : 7777), autoPort: true, password: S.password, code, epoch, restore: snap, rank: [epoch, S.joinedAt || Date.now(), CID] });
  if (!r.ok) throw new Error(r.error);
  S.isHost = true; S.hostKey = r.hostKey; S.viaCode = null;
  toast('Você agora é o anfitrião da sala.', 'ok', 5000);
  connect(parseAddr('127.0.0.1:' + r.port), S.password, false);
}
// Se aparecer outro anfitrião com prioridade maior pro mesmo código, eu passo a sala pra ele
if (window.Tun) Tun.onYield(async () => {
  if (!S.isHost || S.closing) return;
  S.forceGuest = true;
  await native.stopHost(4004);
});
// cópia dos anexos pequenos (até 50 MB) pra eles sobreviverem à troca de anfitrião
function cacheAttachments(msg) {
  if (!native || !LS.get('replicateFiles',false) || !S.code || S.isHost || !msg.attachments) return;
  for (const a of msg.attachments) if (a.size <= 50 * 1024 * 1024) native.cacheFile({ code: S.code, id: a.id, name: a.name, size: a.size, url: fileUrl(a) });
}
function sendProfile(extra = {}) { wsSend({ t: 'profile', name: me.name, color: me.color, avatar: me.avatar, ...profileExtras(), ...extra }); }

// ---------- 2.0 perfil: status, recado, cor do nome e banner (foto ou GIF) ----------
// Text extras ride on the profile; the banner file lives in this browser's IndexedDB and is uploaded
// to whoever hosts (again after a host change), then viewers load it from /banner/<id>.
const BANNER_COLORS = ['#d6402b', '#0369a1', '#047857', '#b45309', '#6a4bb3', '#be185d', '#26282f'];
const NAME_COLORS = ['', '#fbbf24', '#f5b1d4', '#80e1bc', '#a4d9ff', '#fca5a5'];
const MAX_BANNER = 8 * 1024 * 1024;
const profileExtras = () => ({ status: me.status || '', bio: me.bio || '', nameColor: me.nameColor || '', nameFx: me.nameFx || '', bannerColor: me.bannerColor || '' });
// Nome com cor e efeito do perfil (2.1.5): aparece na lista da esquerda, na call, no chat e no cartão.
const NAME_FX = { '': 'Nenhum', holo: 'Holográfico', rainbow: 'Arco-íris', neon: 'Neon', ouro: 'Ouro', fogo: 'Fogo', gelo: 'Gelo', glitch: 'Glitch' };
function nameHTML(u, text = u?.name) {
  const fx = u?.nameFx && NAME_FX[u.nameFx] ? u.nameFx : '', c = /^#[0-9a-f]{6}$/i.test(u?.nameColor || '') ? u.nameColor : '';
  if (!fx && !c) return esc(text);
  return `<span class="uname${fx ? ' fx-' + fx : ''}"${c ? ` style="--nc:${c}"` : ''} data-text="${esc(text)}">${esc(text)}</span>`;
}
function bannerStore(value) { // undefined = read, null = delete, Blob = save
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('resenha', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('blobs');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const tx = open.result.transaction('blobs', value === undefined ? 'readonly' : 'readwrite'), st = tx.objectStore('blobs');
        const q = value === undefined ? st.get('banner') : value === null ? st.delete('banner') : st.put(value, 'banner');
        q.onsuccess = () => resolve(value === undefined ? q.result || null : value);
        q.onerror = () => resolve(null);
      };
    } catch { resolve(null); }
  });
}
async function uploadBanner() {
  if (!S.myId || !S.resume || !S.base) return;
  const blob = await bannerStore(); if (!blob) return;
  try {
    const r = await fetch(`${S.base}/banner?t=${S.token}&u=${encodeURIComponent(S.myId)}&k=${encodeURIComponent(S.resume)}`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
    if (!r.ok && r.status !== 404) { const e = await r.json().catch(() => ({})); toast(e.error || 'Não deu para enviar o banner.', 'err'); } // 404: host on an older version
  } catch {}
}
const bannerURL = (u) => (u?.banner && S.base ? `${S.base}/banner/${encodeURIComponent(u.id)}?t=${S.token}&v=${encodeURIComponent(u.banner)}` : '');
function profileCardHTML(u) {
  const banner = bannerURL(u), ch = u.voiceChannel && chanById(u.voiceChannel);
  return `<div class="pcard"><div class="pcard-banner" style="background-color:${esc(u.bannerColor || u.color || '#26282f')}">${banner ? `<img src="${esc(banner)}" alt="">` : ''}</div>
    <div class="pcard-av">${avatarHTML(u)}</div>
    <div class="pcard-body"><div class="pcard-name">${nameHTML(u)}</div>
      ${u.status ? `<div class="pcard-status">${esc(u.status)}</div>` : ''}
      ${u.bio ? `<div class="pcard-bio">${esc(u.bio)}</div>` : ''}
      ${ch ? `<div class="pcard-meta">${icon('volume', 14)}<span>Na call em ${esc(ch.name)}</span></div>` : ''}</div></div>`;
}
function bindProfileCard(root) { $$('.pcard-banner img', root).forEach((img) => img.onerror = () => img.remove()); }
async function chooseBanner(done) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/gif,image/webp';
  inp.onchange = async () => {
    let f = inp.files[0]; if (!f) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type)) return toast('Use foto ou GIF (png, jpg, gif ou webp).', 'err');
    if (f.type !== 'image/gif' && f.size > 1.5 * 1024 * 1024) f = await shrinkBanner(f); // photos: 960 px wide is plenty
    if (f.size > MAX_BANNER) return toast('Banner grande demais: o máximo é 8 MB.', 'err');
    await bannerStore(f); me.hasBanner = true; LS.set('profile', me);
    await uploadBanner(); done && done();
  };
  inp.click();
}
function shrinkBanner(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { const w = Math.min(960, img.width), h = Math.round(img.height * w / img.width), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(img.src); c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.86); };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
async function removeBanner(done) { await bannerStore(null); me.hasBanner = false; LS.set('profile', me); sendProfile({ banner: '' }); done && done(); }

const textChannels = () => S.channels.filter((c) => c.type === 'text');
const voiceChannels = () => S.channels.filter((c) => c.type === 'voice');
const chanById = (id) => S.channels.find((c) => c.id === id);
const mentionsMe = (m) => m.userId !== S.myId && ((m.mentions || []).some((n) => n.toLowerCase() === me.name.toLowerCase() || n === 'todos') || (m.text || '').toLowerCase().includes('@' + me.name.toLowerCase()));

function handle(m) {
  switch (m.t) {
    case 'host-transfer': {
      S.nextHost = { id: m.to, at: Date.now() };
      if (m.to === S.myId) toast('Você vai virar o anfitrião da sala.', 'ok', 5000);
      // Quem pediu sai do papel de anfitrião logo depois que todos receberam o aviso.
      if (S.isHost && m.by === S.myId && native) { S.forceGuest = true; setTimeout(() => { if (S.isHost && !S.closing) native.stopHost(4003); }, 500); }
      break;
    }
    case 'welcome': {
      if (!S.isHost) S.forceGuest = false; // voltou como convidado: pode assumir numa próxima troca
      staleRoomWarned=false;
      S.myId = m.id; S.token = m.token; S.turn = m.turn; S.roomName = m.room.name; S.roomIcon = typeof m.room.icon === 'string' ? m.room.icon : undefined; S.roomLook = m.room.look || {}; S.reconnectTries = 0;
      if (typeof m.resume === 'string') { S.resume = m.resume; try { sessionStorage.setItem('resenha.resume', m.resume); } catch {} }
      if (m.code) S.code = fmtCode(m.code);
      if(S.latestRoomSnapshot && fmtCode(S.latestRoomSnapshot.code)!==S.code)S.latestRoomSnapshot=null;
      S.epoch = m.epoch || 0;
      hideBanner();
      S.serverOffset = m.serverTime - Date.now();
      S.users = new Map(m.users.map((u) => [u.id, u]));
      S.channels = m.channels; S.history = m.history || {};
      S.dj = m.dj; S.djAvailable = m.djAvailable;
      S.serverVersion = m.version || 'não informada'; S.features = m.features || [];
      rejectPendingCommands('A sala reconectou. Tente enviar novamente.');
      if (!chanById(S.textChannel)) S.textChannel = textChannels()[0]?.id;
      // ligações de voz com quem sumiu da sala: espera um pouco (na troca de anfitrião a galera volta aos poucos)
      clearTimeout(S.peerSweep);
      S.peerSweep = setTimeout(() => { for (const id of [...V.peers.keys()]) { const u = S.users.get(id); if (!u || u.voiceChannel !== V.channel) closePeer(id); } renderCall(); }, 20000);
      for (const list of Object.values(S.history)) for (const msg of list) cacheAttachments(msg);
      showMain();
      if (LS.get('musicIntro', false)) { LS.set('musicIntro', false); setTimeout(() => roomUI?.open('music'), 700); } // 2.2: primeira sala depois de atualizar
      renderMessages();
      renderAll();
      renderServerRow();
      rememberRoom();
      uploadBanner();
      syncDJ();
      if (V.joined) { // reconectou (troca de anfitrião): a voz continuou, só avisa o novo servidor
        if (!chanById(V.channel)) V.channel = voiceChannels()[0]?.id;
        wsSend({ t: 'state', voiceChannel: V.channel, muted: V.muted, deafened: V.deafened, sharing: !!V.screen, screenStreamId: V.screen ? V.screen.id : null });
        setConnStatus('good', 'Voz conectada');
      } else if (S.rejoinVoice) { const c = S.rejoinVoice; S.rejoinVoice = null; joinVoice(chanById(c) ? c : voiceChannels()[0]?.id); }
      else if (S.isHost && !S.invitedOnce) { S.invitedOnce = true; const seen = new Set(LS.get('invitedRooms', [])), c = normCode(S.code); if (c && !seen.has(c)) { seen.add(c); LS.set('invitedRooms', [...seen]); openInvite(); } }
      break;
    }
    case 'room-snapshot': {
      if(!m.snapshot||fmtCode(m.snapshot.code)!==fmtCode(S.code))break;
      S.latestRoomSnapshot=m.snapshot;
      if(native?.rooms)native.rooms.save(m.snapshot).then(result=>{renderServerRow();if(result.newerLocal&&!staleRoomWarned){staleRoomWarned=true;toast('Sua cópia local tem revisão mais nova que a sala aberta. Ela foi preservada; mensagens recentes podem faltar aqui.','',9000);}}).catch(e=>{if(!savingRoomFailed){savingRoomFailed=true;toast('Não consegui salvar a cópia local da sala: '+e.message,'err',8000);}});
      break;
    }
    case 'command-result': finishCommand(m); break;
    case 'dm': receiveDM(m.msg); break;
    case 'error': toast(m.msg, 'err', 5000); break;
    case 'user-join': S.users.set(m.user.id, m.user); refreshAuthor(m.user.id); if (m.user.id === DJ_ID && V.joined && m.user.voiceChannel === V.channel) sfx('join'); renderAll(); break;
    case 'user-leave': {
      music?.userLeft(m.id);
      const u = S.users.get(m.id);
      if (u && V.joined && u.voiceChannel === V.channel && Date.now() > (S.quietUntil || 0)) sfx('leave');
      S.users.delete(m.id); closePeer(m.id); S.typing.delete(m.id); renderAll(); renderTyping();
      break;
    }
    case 'user-update': {
      const prev = S.users.get(m.user.id) || {};
      S.users.set(m.user.id, m.user);
      if (prev.nameFx !== m.user.nameFx || prev.nameColor !== m.user.nameColor || prev.avatar !== m.user.avatar) refreshAuthor(m.user.id);
      if (m.user.id !== S.myId && V.joined) {
        const wasHere = prev.voiceChannel === V.channel, isHere = m.user.voiceChannel === V.channel;
        const quiet = Date.now() < (S.quietUntil || 0);
        if (!wasHere && isHere && !quiet) { sfx('join'); if (m.user.id !== DJ_ID) { toast(m.user.name + ' entrou na call', '', 2600); if (!roomMuted() && (document.hidden || !document.hasFocus())) native?.notify?.({ title: m.user.name + ' entrou na call', body: (chanById(V.channel)?.name || 'Call') + ' · ' + (S.roomName || 'Resenha') }); } }
        if (wasHere && !isHere) { if (!quiet) sfx('leave'); closePeer(m.user.id); }
        // Som quando um amigo da call começa (sobe) ou encerra (desce) uma live.
        if (wasHere && isHere && !quiet && !prev.sharing && m.user.sharing) sfx('share');
        if (wasHere && isHere && !quiet && prev.sharing && !m.user.sharing) sfx('shareEnd');
        if (prev.screenStreamId !== m.user.screenStreamId || !m.user.sharing) {
          V.watching.delete(m.user.id); V.relayVia.delete(m.user.id);
          for (const [viewer, out] of [...V.relayOut]) if (out.owner === m.user.id) stopRelayingTo(viewer);
          if (V.focus === 'screen:' + m.user.id) V.focus = null;
        }
      }
      reclassifyStreams(); applyUserVolume(m.user.id);
      renderAll();
      break;
    }
    case 'channels': {
      S.channels = m.channels;
      if (!chanById(S.textChannel)) { S.textChannel = textChannels()[0]?.id; renderMessages(); }
      for (const k of Object.keys(S.history)) if (!chanById(k)) delete S.history[k];
      if (V.joined && !chanById(V.channel)) leaveVoice();
      renderAll(); renderChatHeader();
      break;
    }
    case 'chat': {
      const HISTORY_LIMIT = 1000, TRIM_BATCH = 200;
      const msg = m.msg;
      const list = (S.history[msg.channelId] = S.history[msg.channelId] || []);
      list.push(msg); if (list.length > HISTORY_LIMIT) list.splice(0, TRIM_BATCH);
      S.typing.delete(msg.userId); renderTyping();
      cacheAttachments(msg);
      if (msg.channelId === S.textChannel) appendMessage(msg);
      else if (msg.userId !== S.myId) { S.unread.add(msg.channelId); renderChannels(); }
      if (msg.userId !== S.myId) {
        const ment = mentionsMe(msg);
        if (ment && !roomMuted()) sfx('mention');
        if (!roomMuted() && (!document.hasFocus() || document.hidden)) { if (!ment) sfx('msg'); native && native.notify({ title: (ment ? '🔔 ' : '') + msg.name + ' em #' + (chanById(msg.channelId)?.name || ''), body: msg.text || '📎 Anexo' }); }
      }
      break;
    }
    case 'msg-edit': {
      const msg = (S.history[m.channelId] || []).find((x) => x.id === m.id);
      if (msg) { msg.text = m.text; msg.editedAt = m.editedAt; msg.mentions = m.mentions; }
      if (m.channelId === S.textChannel) rerenderMsg(m.id);
      break;
    }
    case 'msg-delete': {
      const list = S.history[m.channelId] || [];
      const i = list.findIndex((x) => x.id === m.id);
      if (i > -1) list.splice(i, 1);
      if (m.channelId === S.textChannel) renderMessages(true);
      break;
    }
    case 'typing': if (m.channelId === S.textChannel) { S.typing.set(m.id, Date.now()); renderTyping(); } break;
    case 'signal': onSignal(m.from, m.data); break;
    case 'room': S.roomName = m.room.name; if (typeof m.room.icon === 'string') S.roomIcon = m.room.icon; if (m.room.look) S.roomLook = m.room.look; renderHeader(); renderServerRow(); rememberRoom(); break;
    case 'pong': {
      const rtt = Date.now() - m.ts; S.lastPing = rtt;
      if (m.serverTime) { const off = m.serverTime + rtt / 2 - Date.now(); S.serverOffset = S.offsetInit ? S.serverOffset * 0.8 + off * 0.2 : off; S.offsetInit = true; }
      updatePing(); break;
    }
    case 'dj': S.dj = m.dj; syncDJ(); renderAll(); renderDJPanel(); break;
    case 'dj-busy': S.djBusy = m.busy; renderDJPanel(); break;
  }
}

function showMain() {
  endBoot();
  $('#home').classList.add('hidden');
  $('#main').classList.remove('hidden');
  $('#home-error').textContent = '';
}

async function leaveRoom(endForAll) {
  S.closing = true;
  if (dmPanel) dmPanel.close();
  dmUnread.clear();
  teardownVoice();
  hideBanner();
  try { if (S.ws) S.ws.close(); } catch {}
  const wasHost = S.isHost;
  S.ws = null; S.myId = null; S.users.clear(); S.history = {}; S.invitedOnce = false; S.rejoinVoice = null; S.dj = null;
  // 4003: a sala continua com outro anfitrião. 4002: encerra pra todo mundo.
  if (wasHost && native) await native.stopHost(endForAll ? 4002 : 4003);
  if (S.viaCode && window.Tun) Tun.guestClose();
  S.isHost = false; S.viaCode = null; S.code = null;
  syncDJ();
  roomUI?.reset();
  $('#main').classList.add('hidden');
  $('#home').classList.remove('hidden');
  $('#web-nav').classList.add('hidden');
  if(native?.rooms)renderMyRooms(false);
  pushTray();
  renderRecent();
}

// ---------------- Render: barra lateral ----------------
const usersIn = (cid) => [...S.users.values()].filter((u) => u.voiceChannel === cid);
const myVoiceUsers = () => (V.joined ? usersIn(V.channel) : []);
function renderHeader() {
  $('#room-name').textContent = S.roomName;
  $('#tb-title').textContent = S.roomName + ' · Resenha';
  $('#rail-room').textContent = initials(S.roomName);
  $('#rail-room').title = S.roomName;
  document.title = S.roomName + ' · Resenha';
  const people = [...S.users.values()].filter((u) => u.id !== DJ_ID).length;
  const sub = $('#room-sub'); if (sub) sub.textContent = S.isHost ? 'Você é o anfitrião' : people === 1 ? '1 pessoa na sala' : `${people} pessoas na sala`;
  const chip = $('#btn-code');
  if (chip) { chip.classList.toggle('hidden', !S.code); if (S.code) chip.innerHTML = `<span>${esc(fmtCode(S.code))}</span>${icon('copy', 14)}`; }
  rememberRoomCard();
  // Visual da sala: foto de capa no topo da barra lateral, descrição e cor (Personalizar sala).
  const look = S.roomLook || {}, side = $('#sidebar');
  if (side) {
    side.classList.toggle('has-cover', !!look.cover);
    if (look.cover) side.style.setProperty('--room-cover', `url("${look.cover}")`); else side.style.removeProperty('--room-cover');
    if (look.color) $('#main').style.setProperty('--room-color', look.color); else $('#main').style.removeProperty('--room-color');
    let about = $('#room-about');
    if (!about && sub) { about = document.createElement('div'); about.id = 'room-about'; sub.after(about); }
    if (about) { about.textContent = look.about || ''; about.classList.toggle('hidden', !look.about); }
    const brand = $('.side-brand');
    if (brand) {
      let ri = $('#room-icon'); if (!ri) { ri = document.createElement('span'); ri.id = 'room-icon'; ri.setAttribute('aria-hidden', 'true'); brand.prepend(ri); }
      const img = S.roomIcon || look.cover || '';
      ri.style.setProperty('--ri-color', look.color || serverColor(S.code || S.roomName));
      ri.innerHTML = img ? `<img src="${esc(img)}" alt="">` : esc(initials(S.roomName || 'S'));
      ri.classList.toggle('has-img', !!img);
    }
  }
}
function statusIcons(u) {
  let h = '';
  if (u.sharing) h += '<span class="live">AO VIVO</span>';
  if (u.id === DJ_ID && S.dj && S.dj.current) h += `<span class="st-note">${icon('music', 14)}</span>`;
  if (u.deafened) h += icon('headphonesOff', 16, 'red');
  else if (u.muted) h += icon('micOff', 16, 'red');
  if (u.id !== S.myId && settings.userMuted[u.name]) h += icon('volume', 16, 'red');
  return h;
}
function renderChannels() {
  $('#text-channels').innerHTML = textChannels().map((c) =>
    `<div class="channel ${c.id === S.textChannel ? 'active' : ''} ${S.unread.has(c.id) ? 'unread' : ''}" draggable="true" data-ch="${esc(c.id)}">${icon('hash', 20)}<span class="cn">${esc(c.name)}</span><button class="ch-edit" data-edit="${esc(c.id)}" title="Editar canal">${icon('settings', 14)}</button></div>`).join('');
  $('#voice-channels').innerHTML = voiceChannels().map((c) => {
    const us = usersIn(c.id);
    const since = us.filter((u) => u.voiceSince).map((u) => u.voiceSince);
    return `<div class="channel voice ${V.joined && V.channel === c.id ? 'connected' : ''}" draggable="true" data-vch="${esc(c.id)}">${icon('volume', 20)}<span class="cn">${esc(c.name)}</span><span class="timer" data-since="${since.length ? Math.min(...since) : ''}"></span><button class="ch-edit" data-edit="${esc(c.id)}" title="Editar canal">${icon('settings', 14)}</button></div>
      <div class="voice-users">${us.map((u) => `<div class="vu ${isSpeaking(u.id) ? 'speaking' : ''} ${u.id === DJ_ID ? 'is-dj' : ''}" data-uid="${esc(u.id)}">${avatarHTML(u)}<span class="nm">${nameHTML(u)}${u.isHost ? '<span class="tag">HOST</span>' : ''}${u.id === DJ_ID ? '<span class="tag bot">BOT</span>' : ''}</span><span class="st">${statusIcons(u)}</span></div>`).join('')}</div>`;
  }).join('');
  tickTimers();
}
function renderSidebar() {
  renderHeader();
  renderChannels();
  const others = [...S.users.values()].filter((u) => !u.voiceChannel);
  $('#online-cat').textContent = `Na sala (fora da call) · ${others.length}`;
  $('#online-cat').classList.toggle('hidden', !others.length);
  $('#online-users').innerHTML = others.map((u) =>
    `<div class="ou" data-uid="${esc(u.id)}">${avatarHTML(u)}<span>${nameHTML(u)}${u.id === S.myId ? ' <span class="muted small">(você)</span>' : ''}${u.isHost ? '<span class="tag">HOST</span>' : ''}</span></div>`).join('');
  setAvatarEl($('#up-avatar'), me);
  $('#up-name').textContent = me.name;
  $('#up-sub').textContent = V.joined ? (WEB_VIEWER && !WEB_VOICE ? 'Ouvindo' : 'Em voz') : 'Online';
  renderFriends();
  const muteOff = V.muted || V.deafened;
  $('#btn-mute').innerHTML = icon(muteOff ? 'micOff' : 'mic');
  $('#btn-mute').classList.toggle('off', muteOff);
  $('#btn-deafen').innerHTML = icon(V.deafened ? 'headphonesOff' : 'headphones');
  $('#btn-deafen').classList.toggle('off', V.deafened);
  $('#voice-panel').classList.toggle('hidden', !V.joined);
  $('#vp-share').classList.toggle('on', !!V.screen);
  $('#vp-share').innerHTML = icon(V.screen ? 'screenOff' : 'screen');
  $('#vp-dj').classList.toggle('on', !!(S.dj && S.dj.active && S.dj.channelId === V.channel));
  $('#vp-sub').textContent = `${chanById(V.channel)?.name || ''} / ${S.roomName}`;
}
function tickTimers() {
  $$('#voice-channels .timer').forEach((t) => { const s = +t.dataset.since; t.textContent = s ? fmtDur(serverNow() - s) : ''; });
}
function isSpeaking(id) {
  if (id === S.myId) return V.joined && !V.muted && !V.deafened && (settings.aiNoise && V.rnReady ? V.vadOpen : V.gateOpen);
  return V.speaking.has(id);
}

// ---------------- Render: call ----------------
const tileCache = new Map();
function installLiveOverlay(tile) {
  let timer;
  const reveal = () => {
    clearTimeout(timer);
    tile.classList.add('controls-visible');
    timer = setTimeout(() => {
      if (tile.querySelector('.tile-tools')?.matches(':hover,:focus-within') || tile.querySelector('.live-meta')?.matches(':hover,:focus-within')) return reveal();
      tile.classList.remove('controls-visible');
    }, 2500);
  };
  tile.addEventListener('pointermove', reveal);
  tile.addEventListener('pointerenter', reveal);
  tile.addEventListener('pointerdown', reveal);
  tile.addEventListener('keydown', reveal);
  tile.addEventListener('focusin', reveal);
  tile.revealControls = reveal;
  tile.disposeOverlay = () => clearTimeout(timer);
  reveal();
}
// Halo "Apple Intelligence": ao passar o mouse, um anel fino sai da borda e some (uma vez por entrada do mouse).
// Capa do álbum: em todos os temas, na cor de cada um. Botão de tocar e botões da call: só no Holofoil.
const AI_HOVER = '.right-music .mu-art, .right-music .mu-play, #call-controls .cc-btn';
function aiHalo(el) {
  const h = document.documentElement;
  if (h.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!el.matches('.mu-cover') && h.dataset.tk !== 'holofoil') return; // capa: todos os temas; o resto só no Holofoil
  if (el._aiAt && performance.now() - el._aiAt < 900) return; el._aiAt = performance.now();
  const r = el.getBoundingClientRect(); if (!r.width) return;
  const o = document.createElement('i'); o.className = 'ai-halo'; o.setAttribute('aria-hidden', 'true');
  o.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${getComputedStyle(el).borderRadius};--s:${(1 + 16 / Math.max(r.width, r.height)).toFixed(3)}`;
  document.body.append(o); o.addEventListener('animationend', () => o.remove(), { once: true }); setTimeout(() => o.remove(), 1500);
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('pointerover', (e) => {
  const el = e.target.closest?.(AI_HOVER); if (!el || el.contains(e.relatedTarget)) return;
  if (el.matches('.mu-art')) { if (!e.target.closest('.mu-vol')) aiHalo(el.querySelector('.mu-cover') || el); } else aiHalo(el);
});
function makeTile(key) {
  const t = document.createElement('div');
  t.className = 'tile'; t.dataset.key = key;
  if (key.startsWith('user:')) t.draggable = true;
  t.innerHTML = `<div class="tile-body"></div><div class="label"></div><div class="tile-tools"></div>`;
  t.onclick = (e) => {
    // Botões dentro do quadro redesenham o quadro: o clique não pode virar "ampliar a pessoa".
    if (!t.contains(e.target) || e.target.closest('.tile-tools, button, a, input') || document.fullscreenElement === t) return;
    if (key === 'user:' + DJ_ID) return openDJPanel();
    if (key.startsWith('screen:') && (key === 'screen:' + S.myId ? !V.previewHidden && V.windowVisible : V.watching.has(key.slice(7)))) { V.focus = V.focus === key ? null : key; renderCall(); }
    // Clicar numa pessoa amplia o quadrado dela; os outros vão para a fileira de baixo.
    else if (key.startsWith('user:') && (V.focus === key || $$('#call-stage .tile').length > 1)) { V.focus = V.focus === key ? null : key; renderCall(); }
  };
  t.oncontextmenu = (e) => { const uid = key.split(':')[1]; if (uid !== DJ_ID) userMenu(e, uid); }; // clique direito no quadro abre o card (também o seu)
  if (key.startsWith('screen:')) installLiveOverlay(t);
  tileCache.set(key, t);
  return t;
}
function updateTile(key, u, isScreen) {
  const t = tileCache.get(key) || makeTile(key);
  t.classList.toggle('is-screen', isScreen);
  t.dataset.tone = String([...u.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 4);
  t.classList.toggle('speaking', !isScreen && isSpeaking(u.id));
  const body = t.firstElementChild;
  if (isScreen) {
    const self = u.id === S.myId;
    const watching = self ? !V.previewHidden && V.windowVisible : V.watching.get(u.id) === u.screenStreamId;
    const stream = watching ? (self ? V.screen : getRemoteScreen(u.id)) : null;
    let v = body.querySelector('video');
    if (stream) {
      if (!v) { body.innerHTML = '<video autoplay playsinline muted></video><span class="live">AO VIVO</span>'; v = body.querySelector('video'); }
      if (v.srcObject !== stream) { v.srcObject = stream; v.play().catch(() => {}); }
    } else {
      if (v) { v.pause(); v.srcObject = null; }
      body.innerHTML = `<div class="stream-invite">${icon('screen', 28)}<strong>${self ? 'Você está transmitindo' : esc(u.name) + ' está ao vivo'}</strong><span class="muted small">${self ? 'A prévia está pausada. Seus amigos continuam assistindo.' : watching ? 'Conectando à transmissão…' : 'Assista quando quiser.'}</span><button class="btn primary" data-watch>${self ? 'Mostrar prévia' : watching ? 'Cancelar' : 'Entrar na transmissão'}</button></div>`;
      $('[data-watch]', body).onclick = (e) => { e.stopPropagation(); if (self) { V.previewHidden = false; renderCall(); } else setWatching(u.id, !watching); };
    }
    const tools = t.querySelector('.tile-tools');
    const full = document.fullscreenElement === t;
    // Rebuild only when the controls change, so a volume drag or keyboard focus survives other people's updates.
    const toolsSig = [watching, V.muted || V.deafened, V.deafened, !!stream, !!v?.paused, full, self, WEB_VIEWER && !WEB_VOICE].join();
    if (tools.dataset.sig !== toolsSig) {
    tools.dataset.sig = toolsSig;
    tools.innerHTML = watching ? `<button class="live-call-control ${V.muted || V.deafened ? 'off' : ''}" title="${V.muted || V.deafened ? 'Ativar microfone' : 'Mutar microfone'}" aria-label="${V.muted || V.deafened ? 'Ativar microfone' : 'Mutar microfone'}" aria-pressed="${V.muted || V.deafened}" data-live-mic ${WEB_VIEWER && !WEB_VOICE ? 'disabled' : ''}>${icon(V.muted || V.deafened ? 'micOff' : 'mic', 22)}</button><button class="live-call-control ${V.deafened ? 'off' : ''}" title="${V.deafened ? 'Ativar áudio' : 'Desativar áudio (deafen)'}" aria-label="${V.deafened ? 'Ativar áudio' : 'Desativar áudio (deafen)'}" aria-pressed="${V.deafened}" data-live-deafen>${icon(V.deafened ? 'headphonesOff' : 'headphones', 22)}</button>${stream ? `<button class="live-call-control" title="${v?.paused ? 'Retomar vídeo' : 'Pausar vídeo'}" aria-label="${v?.paused ? 'Retomar vídeo' : 'Pausar vídeo'}" data-live-pause>${icon(v?.paused ? 'play' : 'pause', 22)}</button>` : ''}<button title="${self ? 'Ocultar prévia' : 'Sair da transmissão'}" aria-label="${self ? 'Ocultar prévia' : 'Sair da transmissão'}" data-stop>${icon('x', 18)}<span class="live-exit-label">${self ? 'Ocultar prévia' : 'Sair da transmissão'}</span></button>${stream ? `<button title="${full ? 'Sair da tela cheia' : 'Tela cheia'}" aria-label="${full ? 'Sair da tela cheia' : 'Tela cheia'}" data-full>${icon(full ? 'minimize' : 'maximize', 18)}</button>` : ''}` : '';
    $('[data-stop]', tools)?.addEventListener('click', async (e) => {
      e?.stopPropagation();
      if (document.fullscreenElement === t) await document.exitFullscreen().catch(() => {});
      if (self) { V.previewHidden = true; V.focus = null; renderCall(); } else setWatching(u.id, false);
    });
    $('[data-live-mic]', tools)?.addEventListener('click', (e) => { e?.stopPropagation(); setMuted(!(V.muted || V.deafened)); });
    $('[data-live-deafen]', tools)?.addEventListener('click', (e) => { e?.stopPropagation(); setDeafened(!V.deafened); });
    $('[data-live-pause]', tools)?.addEventListener('click', (e) => { e?.stopPropagation(); if (v.paused) v.play().catch(() => {}); else v.pause(); renderCall(); });
    $('[data-full]', tools)?.addEventListener('click', (e) => { e?.stopPropagation(); (document.fullscreenElement ? document.exitFullscreen() : WEB_VIEWER && !t.requestFullscreen && v?.webkitEnterFullscreen ? Promise.resolve(v.webkitEnterFullscreen()) : t.requestFullscreen()).catch(() => {}); });
    }
    const via = !self && V.relayVia?.get(u.id); t.querySelector('.label').innerHTML = `<span>${nameHTML(u)}${self ? ' · sua tela' : ''}${via ? ' · via ' + esc(S.users.get(via)?.name || 'repasse') : ''}</span>`;
    t.title = watching ? (V.focus === key ? 'Clique para diminuir' : 'Clique para ampliar') : '';
    if (typeof roomUI !== 'undefined' && roomUI) roomUI.updateLive(t, u, self, watching, myVoiceUsers().filter((x) => x.id !== u.id).slice(0, 6).map((x) => ({ id: x.id, name: x.id === S.myId ? 'Você' : x.name, color: x.color, avatar: x.avatar, muted: x.muted || x.deafened })));
  } else if (u.id === DJ_ID) {
    const cur = S.dj && S.dj.current;
    const sig = 'dj' + (cur ? cur.id : '') + (S.dj && S.dj.loading);
    if (body.dataset.sig !== sig) {
      body.dataset.sig = sig;
      body.innerHTML = `<div class="dj-tile">${avatarHTML(u)}<div class="dj-now">${cur ? esc(cur.title) : S.dj && S.dj.loading ? 'Carregando música...' : 'Fila vazia: clique pra adicionar'}</div></div>`;
    }
    t.querySelector('.label').innerHTML = `<span>${DJ_NAME}</span>`;
  } else {
    const sig = (u.avatar || '') + u.color + u.name;
    if (body.dataset.sig !== sig) { body.dataset.sig = sig; body.innerHTML = avatarHTML(u); }
    t.querySelector('.label').innerHTML = (u.deafened ? icon('headphonesOff', 14) : u.muted ? icon('micOff', 14) : '') + `<span>${nameHTML(u)}</span>`;
    const tools = t.querySelector('.tile-tools');
    const self = u.id === S.myId, live = self ? !!V.screen : u.sharing;
    const watching = self ? !V.previewHidden : V.watching.has(u.id);
    tools.innerHTML = live ? `<button class="live-join" title="${self ? (watching ? 'Ocultar prévia' : 'Mostrar prévia') : (watching ? 'Sair da transmissão' : 'Entrar na transmissão')}">${icon('screen', 14)}<span>${self ? (watching ? 'Ocultar prévia' : 'Mostrar prévia') : (watching ? 'Sair da transmissão' : 'Entrar na transmissão')}</span></button>` : '';
    $('.live-join', tools)?.addEventListener('click', (e) => { e.stopPropagation(); if (self) { V.previewHidden = !V.previewHidden; V.focus = null; renderCall(); } else setWatching(u.id, !watching); });
  }
  return t;
}
function setWatching(uid, active) {
  const u = S.users.get(uid);
  if (!u) return;
  if (active && u.sharing) { V.watching.set(uid, u.screenStreamId); V.focus = 'screen:' + uid; }
  else V.watching.delete(uid);
  if (!active && V.focus === 'screen:' + uid) V.focus = null;
  if (!active) {
    const via = V.relayVia.get(uid); if (via) sig(via, { relayWatch: false, owner: uid });
    V.relayVia.delete(uid);
    for (const [viewer, out] of [...V.relayOut]) if (out.owner === uid) stopRelayingTo(viewer); // the streamer re-routes them
  }
  sig(uid, watchMsg(u.screenStreamId, !!active, V.directOnly?.has(uid) ? { noRelay: true } : {}));
  applyUserVolume(uid);
  renderCall();
}
function detachTile(tile) {
  tile.disposeOverlay?.();
  tile.disposeFrame?.();
  const video = tile.querySelector('video');
  if (video) { video.pause(); video.srcObject = null; }
  tile.remove();
}
function getRemoteScreen(uid) {
  const p = V.peers.get(uid); const u = S.users.get(uid);
  if (!u || !u.screenStreamId) return null;
  const via = V.relayVia.get(uid) && V.peers.get(V.relayVia.get(uid)); // received through a relay
  return p?.streams.get(u.screenStreamId) || via?.streams.get(u.screenStreamId) || null;
}
function renderCall() {
  const stage = $('#call-stage');
  const vcId = V.joined ? V.channel : voiceChannels()[0]?.id;
  const vc = chanById(vcId);
  $('#call-title').textContent = vc ? vc.name : 'Call';
  const vu = V.joined ? myVoiceUsers() : [];
  $('#call-count').textContent = vu.length ? `${vu.length} na call` : V.joined ? '' : 'Escolha um canal para entrar';
  $('#call-controls').classList.toggle('hidden', !V.joined);
  const djHere = S.dj && S.dj.active && S.dj.channelId === V.channel;
  $('#btn-dj').classList.toggle('hidden', !V.joined || !S.djAvailable);
  $('#btn-dj').classList.toggle('on', !!djHere);
  $('#btn-dj').innerHTML = `${icon('music', 20)}<span class="sr-only">${djHere ? 'DJ Resenha' : 'Chamar DJ'}</span>`;
  $('#btn-dj').title = djHere ? 'Abrir o DJ Resenha' : 'Chamar o DJ Resenha';
  if (!V.joined) {
    for (const tile of tileCache.values()) detachTile(tile); tileCache.clear(); $('#pips').innerHTML = '';
    const blocks = voiceChannels().map((c) => {
      const us = usersIn(c.id);
      return `<div class="vc-card" data-join="${esc(c.id)}"><div class="vc-name">${icon('volume', 18)} ${esc(c.name)}</div>
        <div class="avatars">${us.slice(0, 6).map((u) => avatarHTML(u)).join('')}</div>
        <div class="muted small">${us.length ? us.map((u) => esc(u.name)).join(', ') : 'Ninguém aqui ainda'}</div>
        <button class="btn green">Entrar</button></div>`;
    }).join('');
    stage.innerHTML = `<div class="call-empty"><h2>Canais de voz</h2><div class="vc-cards">${blocks}</div></div>`;
    $$('[data-join]', stage).forEach((el) => el.onclick = () => joinVoice(el.dataset.join));
    return;
  }
  // Pessoas (e o DJ) no grid; telas compartilhadas viram miniaturas no canto
  const people = sortByTileOrder(vu).map((u) => ({ key: 'user:' + u.id, u, screen: false }));
  const screens = vu.filter((u) => u.id === S.myId ? V.screen && !V.previewHidden && V.windowVisible : u.sharing && V.watching.has(u.id)).map((u) => ({ key: 'screen:' + u.id, u, screen: true }));
  const keys = new Set([...people, ...screens].map((t) => t.key));
  for (const k of [...tileCache.keys()]) if (!keys.has(k)) { detachTile(tileCache.get(k)); tileCache.delete(k); }
  if (V.focus && !keys.has(V.focus)) V.focus = null;
  const flip = globalThis.resenhaMotion?.capture(stage, (V.focus || '') + '|' + [...keys].join(','));
  const pEls = people.map((x) => updateTile(x.key, x.u, false));
  const sEls = screens.map((x) => updateTile(x.key, x.u, true));
  // Never detach/reparent the fullscreen element during state updates.
  if (document.fullscreenElement && sEls.includes(document.fullscreenElement)) return;
  stage.querySelector('.call-empty')?.remove();
  const pips = $('#pips');
  if (V.focus) {
    let wrap = stage.querySelector('.focus-wrap');
    if (!wrap) { stage.innerHTML = '<div class="focus-wrap"><div class="focus-main"></div><div class="focus-strip"></div></div>'; wrap = stage.firstChild; }
    const main = wrap.firstChild, strip = wrap.lastChild;
    const fEl = tileCache.get(V.focus);
    if (main.firstChild !== fEl) main.replaceChildren(fEl);
    const stripEls = pEls.filter((e) => e !== fEl);
    stripEls.forEach((e, i) => { if (strip.children[i] !== e) strip.insertBefore(e, strip.children[i] || null); });
    while (strip.children.length > stripEls.length) strip.lastChild.remove();
    const rest = sEls.filter((e) => e !== fEl);
    rest.forEach((e, i) => { if (pips.children[i] !== e) pips.insertBefore(e, pips.children[i] || null); });
    while (pips.children.length > rest.length) pips.lastChild.remove();
  } else {
    let grid = stage.querySelector('.grid');
    if (!grid) { stage.innerHTML = '<div class="grid"></div>'; grid = stage.firstChild; }
    pEls.forEach((e, i) => { if (grid.children[i] !== e) grid.insertBefore(e, grid.children[i] || null); });
    while (grid.children.length > pEls.length) grid.lastChild.remove();
    sEls.forEach((e, i) => { if (pips.children[i] !== e) pips.insertBefore(e, pips.children[i] || null); });
    while (pips.children.length > sEls.length) pips.lastChild.remove();
    layoutGrid();
  }
  flip?.play();

  $('#cc-mute').innerHTML = icon(V.muted || V.deafened ? 'micOff' : 'mic', 24);
  $('#cc-mute').classList.toggle('off', V.muted || V.deafened);
  $('#cc-deafen').innerHTML = icon(V.deafened ? 'headphonesOff' : 'headphones', 24);
  $('#cc-deafen').classList.toggle('off', V.deafened);
  // On the desktop app the button edits a running live (change or stop); the browser can only stop it.
  $('#cc-share').innerHTML = icon(V.screen && !native ? 'screenOff' : 'screen', 24);
  $('#cc-share').classList.toggle('on', !!V.screen);
  $('#cc-share').title = !V.screen ? 'Compartilhar tela' : native ? 'Alterar ou parar a transmissão' : 'Parar de compartilhar';
  $('#cc-leave').innerHTML = icon('phoneOff', 18) + '<span>Sair da call</span>';
}
// Arranjo da call por tema (2.2): Bento = quem fala grande à esquerda; Cinema = quem fala no alto e os outros numa faixa.
// O destaque só troca de pessoa depois de 3 s, para a tela não ficar pulando a cada fala.
let stageFocus = null, stageFocusAt = 0;
const stageArrangement = () => ({ bento: 'bento', cinema: 'cinema' })[document.documentElement.dataset?.tk] || null;
function layoutGrid() {
  const grid = $('#call-stage .grid'); if (!grid) return;
  const n = grid.children.length || 1;
  const W = grid.clientWidth, H = grid.clientHeight, gap = 10;
  const mode = stageArrangement(), kids = [...grid.children];
  kids.forEach((el) => el.classList.remove('stage-focus'));
  grid.dataset.arrange = mode && n >= 3 ? mode : '';
  if (mode && n >= 3) {
    const focus = (stageFocus && tileCache.get('user:' + stageFocus)?.parentElement === grid && tileCache.get('user:' + stageFocus)) || kids[0];
    focus.classList.add('stage-focus');
    if (mode === 'bento') {
      const rows = n - 1, big = Math.floor((W - gap) * 0.62), small = W - gap - big;
      grid.style.gridTemplateColumns = `${big}px ${small}px`;
      grid.style.gridTemplateRows = `repeat(${rows}, ${Math.floor((H - gap * (rows - 1)) / rows)}px)`;
    } else {
      const strip = Math.max(72, Math.min(120, Math.floor(H * 0.24))), cols = n - 1;
      grid.style.gridTemplateColumns = `repeat(${cols}, ${Math.floor((W - gap * (cols - 1)) / cols)}px)`;
      grid.style.gridTemplateRows = `${H - gap - strip}px ${strip}px`;
    }
    return;
  }
  let best = { cols: 1, w: 0, h: 0, rows: 1 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    let w = (W - gap * (cols - 1)) / cols; let h = w * 9 / 16;
    if (h * rows + gap * (rows - 1) > H) { h = (H - gap * (rows - 1)) / rows; w = h * 16 / 9; }
    if (w > best.w) best = { cols, w, h, rows };
  }
  grid.style.gridTemplateColumns = `repeat(${best.cols}, ${Math.floor(best.w)}px)`;
  grid.style.gridTemplateRows = `repeat(${best.rows}, ${Math.floor(best.h)}px)`;
}
new ResizeObserver(() => layoutGrid()).observe(document.getElementById('call-stage'));
addEventListener('resenha-theme', () => requestAnimationFrame(layoutGrid));
// Barra de ícones flutuante (só aparece no tema Vision): atalhos práticos para início, call, chat e configurações.
(() => {
  const main = document.getElementById('main'); if (!main || document.getElementById('theme-rail')) return;
  const rail = document.createElement('nav'); rail.id = 'theme-rail'; rail.setAttribute('aria-label', 'Atalhos');
  const items = [['home', 'Início', () => $('#server-row [data-server-home]')?.click()], ['volume', 'Call', () => { roomUI?.close?.(); }],
    ['chat', 'Chat', () => roomUI?.open('chat')], ['settings', 'Configurações', () => openSettings()]];
  rail.innerHTML = items.map(([ic, t], i) => `<button type="button" data-i="${i}" title="${t}" aria-label="${t}">${icon(ic, 17)}</button>`).join('');
  rail.querySelectorAll('button').forEach((b) => b.onclick = () => items[+b.dataset.i][2]());
  main.append(rail);
})();
// Física do Vision (os dois temas Vision): cada bloco se inclina na direção do mouse, sobe e volta com mola, cada um por si.
// Painéis grandes mexem pouco (leitura); cartões pequenos mexem mais. Só roda enquanto há movimento; respeita "reduzir animações".
(() => {
  const SEL = '#main #sidebar, #main #chat, #call .tile:not(.is-screen), #call #call-controls, #music-mini, #theme-rail';
  const BASE = { sidebar: [0, 4], chat: [0, -5] };
  const bodies = new Map(); let raf = 0, px = -1e4, py = -1e4, on = false;
  const root = document.documentElement;
  const active = () => /^(vision|visionNoite)$/.test(root.dataset?.tk || '') && !root.classList.contains('reduce-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function step() {
    raf = 0; if (!on) return; let moving = false;
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      let b = bodies.get(el); if (!b) bodies.set(el, b = { rx: 0, ry: 0, z: 0, vx: 0, vy: 0, vz: 0 });
      const base = BASE[el.id] || [0, 0], dx = (px - (r.left + r.width / 2)) / r.width, dy = (py - (r.top + r.height / 2)) / r.height;
      const inside = Math.abs(dx) < .5 && Math.abs(dy) < .5, near = Math.max(0, 1 - Math.hypot(dx, dy) * .9), big = r.width * r.height > 120000;
      const amp = inside ? (big ? 3.5 : 8) : (big ? 1.5 : 3) * near;
      const ty = base[1] + Math.max(-1, Math.min(1, dx)) * amp, tx = base[0] - Math.max(-1, Math.min(1, dy)) * amp * .8, tz = inside ? (big ? 8 : 22) : 0;
      const k = .09, d = .78;
      b.vx = (b.vx + (tx - b.rx) * k) * d; b.vy = (b.vy + (ty - b.ry) * k) * d; b.vz = (b.vz + (tz - b.z) * k) * d; b.rx += b.vx; b.ry += b.vy; b.z += b.vz;
      if (Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vz) > .01 || Math.abs(tx - b.rx) + Math.abs(ty - b.ry) + Math.abs(tz - b.z) > .02) moving = true;
      el.style.transform = `perspective(1200px) translateZ(${b.z.toFixed(2)}px) rotateX(${b.rx.toFixed(2)}deg) rotateY(${b.ry.toFixed(2)}deg)`;
    }
    if (moving) raf = requestAnimationFrame(step);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
  addEventListener('pointermove', (e) => { if (!on) return; px = e.clientX; py = e.clientY; kick(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { px = py = -1e4; kick(); });
  addEventListener('blur', () => { px = py = -1e4; kick(); });
  const sync = () => { on = active(); if (!on) { for (const el of bodies.keys()) el.style.transform = ''; bodies.clear(); } else kick(); };
  addEventListener('resenha-theme', sync); new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] }); sync();
})();

function renderAll() { renderSidebar(); renderCall(); renderDM(); renderChatOnline(); pushTray(); $('#web-nav').classList.toggle('hidden', $('#main').classList.contains('hidden')); }
function pushTray() { if (native) native.voiceState({ inVoice: V.joined, muted: V.muted || V.deafened, deafened: V.deafened }); }

function refreshSpeaking() {
  if (stageArrangement()) {
    const now = Date.now(), who = [...S.users.keys()].find((id) => isSpeaking(id));
    if (who && who !== stageFocus && now - stageFocusAt > 3000) { stageFocus = who; stageFocusAt = now; layoutGrid(); }
  }
  $$('#voice-channels .vu').forEach((el) => el.classList.toggle('speaking', isSpeaking(el.dataset.uid)));
  for (const [k, t] of tileCache) if (k.startsWith('user:')) t.classList.toggle('speaking', isSpeaking(k.slice(5)));
  $$('.live-person').forEach((el) => el.classList.toggle('speaking', isSpeaking(el.dataset.uid)));
}

// ---------------- Voz: cadeia de áudio ----------------
// mic -> ganho -> RNNoise (IA: tira ruído e corta quando não é voz) -> filtro de voz (tom) -> portão/mute -> envio
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
  if (S.turn && !S.isHost && !S.viaCode) {
    list.unshift({ urls: `stun:${S.addr.hf}:${S.turn.port}` });
    list.push({ urls: `turn:${S.addr.hf}:${S.turn.port}?transport=udp`, username: S.turn.username, credential: S.turn.credential });
  }
  return list;
}

let rnBinary = null;
async function ensureAudio() {
  if (!V.ctx) {
    V.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
    V.master = V.ctx.createGain(); V.master.connect(V.ctx.destination);
    V.dest = V.ctx.createMediaStreamDestination();
    if (WEB_VIEWER) {
      V.micGain = V.ctx.createGain(); V.analyser = V.ctx.createAnalyser(); V.analyser.fftSize=512;
      V.gate = V.ctx.createGain(); V.gate.gain.value=0;
      V.micGain.connect(V.analyser); V.micGain.connect(V.gate); V.gate.connect(V.dest);
      V.master.gain.value=V.deafened?0:1; await V.ctx.resume(); applyOutputDevice(); return;
    }
    V.micGain = V.ctx.createGain();
    V.pre = V.ctx.createGain(); // entrada do filtro de voz
    V.analyser = V.ctx.createAnalyser(); V.analyser.fftSize = 512; V.analyser.smoothingTimeConstant = 0.2;
    V.gate = V.ctx.createGain(); V.gate.gain.value = 0;
    V.post = V.ctx.createGain();
    V.micGain.connect(V.analyser);
    try {
      await V.ctx.audioWorklet.addModule('worklets/voice-fx.js');
      V.fx = new AudioWorkletNode(V.ctx, 'resenha-pitch');
      V.pre.connect(V.fx).connect(V.post);
    } catch (e) { console.warn('fx', e); V.pre.connect(V.post); }
    V.post.connect(V.gate); V.gate.connect(V.dest);
    try {
      rnBinary = rnBinary || await fetch('vendor/ns/rnnoise_simd.wasm').then((r) => r.arrayBuffer()).catch(() => fetch('vendor/ns/rnnoise.wasm').then((r) => r.arrayBuffer()));
      await V.ctx.audioWorklet.addModule('vendor/ns/rnnoiseWorklet.js');
      V.rn = new RnnoiseWorkletNode(V.ctx, { wasmBinary: rnBinary, maxChannels: 1 });
      V.rn.port.onmessage = (e) => {
        const d = e.data; if (!d || typeof d !== 'object') return;
        V.vadLevel = d.vad;
        if (d.open !== V.vadOpen) { V.vadOpen = d.open; refreshSpeaking(); }
      };
      V.rnReady = true;
    } catch (e) { console.warn('rnnoise', e); V.rn = null; }
    applyNoiseMode();
    applyVoiceFx();
    applyOutputDevice();
  }
  if (V.ctx.state === 'suspended') await V.ctx.resume();
  V.master.gain.value = V.deafened ? 0 : 1;
  if (V.micGain) V.micGain.gain.value = settings.micGain / 100;
}
function applyNoiseMode() {
  if (!V.micGain) return;
  try { V.micGain.disconnect(V.pre); } catch {}
  try { V.micGain.disconnect(V.rn); } catch {}
  try { if (V.rn) V.rn.disconnect(); } catch {}
  if (settings.aiNoise && V.rn) {
    V.micGain.connect(V.rn); V.rn.connect(V.pre);
    V.rn.port.postMessage({ gate: true, thr: 1 - settings.vadSens / 100 * 0.9, holdMs: 350 });
  } else V.micGain.connect(V.pre);
}
function currentFx() {
  const f = FX[settings.voiceFx] || FX.normal;
  return { semis: f.semis == null ? settings.pitchSemis : f.semis, robot: f.robot };
}
function applyVoiceFx() {
  if (!V.fx) return;
  const f = currentFx();
  V.fx.parameters.get('pitch').setValueAtTime(clamp(semisToRatio(f.semis), 0.5, 2), V.ctx.currentTime);
  V.fx.parameters.get('robot').setValueAtTime(f.robot, V.ctx.currentTime);
  const active = Math.abs(f.semis) > 0.001 || f.robot > 0;
  if (V.fxActive !== active) {
    V.pre.disconnect(); V.fx.disconnect();
    if (active) V.pre.connect(V.fx).connect(V.post); else V.pre.connect(V.post);
    V.fxActive = active;
  }
}
async function openMic(attempt = V.voiceAttempt) {
  // A supressão do navegador fica ligada junto: ela tira ruído constante e o RNNoise cuida do resto
  const c = { echoCancellation: WEB_VIEWER ? true : settings.echoCancellation, noiseSuppression: true, autoGainControl: WEB_VIEWER ? true : settings.autoGain, channelCount: 1, sampleRate: 48000 };
  if (settings.inputDevice && settings.inputDevice !== 'default') c.deviceId = { exact: settings.inputDevice };
  let raw;
  try { raw = await navigator.mediaDevices.getUserMedia({ audio: c }); }
  catch (e) {
    if (c.deviceId) { delete c.deviceId; raw = await navigator.mediaDevices.getUserMedia({ audio: c }); toast('Microfone escolhido não encontrado, usando o padrão.'); }
    else throw e;
  }
  // A newer join or a teardown happened while the device was opening: release this capture.
  if (attempt !== V.voiceAttempt) { raw.getTracks().forEach((t) => t.stop()); return; }
  if (V.src) try { V.src.disconnect(); } catch {}
  if (V.raw) V.raw.getTracks().forEach((t) => t.stop());
  V.raw = raw;
  V.src = V.ctx.createMediaStreamSource(raw);
  V.src.connect(V.micGain);
}
function applyOutputDevice() {
  const id = settings.outputDevice === 'default' ? '' : settings.outputDevice;
  for (const c of [V.ctx, sfxCtx]) if (c && c.setSinkId) c.setSinkId(id).catch(() => c.setSinkId('').catch(() => {}));
}

async function joinVoice(channelId) {
  channelId = channelId || voiceChannels()[0]?.id;
  if (!channelId) return;
  if (V.joined && V.channel === channelId) return;
  if (V.joined) leaveVoice(true);
  const attempt = V.voiceAttempt = (V.voiceAttempt || 0) + 1;
  try {
    await ensureAudio();
    if (!WEB_VIEWER || WEB_VOICE) await openMic(attempt);
    else V.muted = true;
  } catch (e) {
    if (attempt === V.voiceAttempt) toast('Não consegui acessar o microfone: ' + (e.message || e.name), 'err', 6000);
    return;
  }
  // The person left the room or picked another channel while the microphone was starting.
  if (attempt !== V.voiceAttempt || S.closing) return;
  V.joined = true; V.channel = channelId;
  if (V.deafened) V.muted = true;
  wsSend({ t: 'state', voiceChannel: channelId, muted: V.muted, deafened: V.deafened });
  sfx('join');
  for (const u of usersIn(channelId)) if (u.id !== S.myId && u.id !== DJ_ID) getPeer(u.id);
  setConnStatus('good', 'Voz conectada');
  syncDJ();
  renderAll();
}
function leaveVoice(silentSwitch) {
  if (!V.joined) return;
  if (!silentSwitch) sfx('leave');
  teardownVoice();
  wsSend({ t: 'state', voiceChannel: null, sharing: false, screenStreamId: null });
  syncDJ();
  renderAll();
}
function teardownVoice() {
  V.voiceAttempt = (V.voiceAttempt || 0) + 1; // cancels a joinVoice() still waiting for the microphone
  stopShare(true);
  for (const id of [...V.peers.keys()]) closePeer(id);
  if (V.raw) V.raw.getTracks().forEach((t) => t.stop());
  if (V.src) try { V.src.disconnect(); } catch {}
  V.raw = null; V.src = null; V.joined = false; V.channel = null; V.speaking.clear(); V.focus = null; V.gateOpen = false; V.vadOpen = false;
  if (V.gate) V.gate.gain.value = 0;
  for (const tile of tileCache.values()) detachTile(tile); tileCache.clear();
  stopDJAudio();
}

function setMuted(m, silent) {
  if (WEB_VIEWER && !WEB_VOICE) return;
  if (V.deafened && !m) { setDeafened(false); return; }
  V.muted = m; LS.set('muted', m);
  if(WEB_VIEWER && V.raw) { V.raw.getAudioTracks().forEach(t=>t.enabled=!V.muted&&!V.deafened); if(V.gate)V.gate.gain.value=V.muted||V.deafened?0:1; }
  if (!silent) sfx(m ? 'mute' : 'unmute');
  wsSend({ t: 'state', muted: V.muted, deafened: V.deafened });
  renderAll();
}
function setDeafened(d) {
  if (d) { V.mutedBeforeDeafen = V.muted; V.muted = true; }
  else { V.muted = V.mutedBeforeDeafen; }
  V.deafened = d;
  if(WEB_VIEWER && V.raw) { V.raw.getAudioTracks().forEach(t=>t.enabled=!V.muted&&!d); if(V.gate)V.gate.gain.value=V.muted||d?0:1; }
  LS.set('deafened', d); LS.set('muted', V.muted);
  if (V.master) V.master.gain.value = d ? 0 : 1;
  if (V.screenMaster) V.screenMaster.gain.value = d ? 0 : 1;
  sfx(d ? 'mute' : 'unmute');
  wsSend({ t: 'state', muted: V.muted, deafened: V.deafened });
  renderAll();
}

// Laço: portão de voz, indicadores de fala, ping
let noiseFloor = -60;
const lvlBuf = new Float32Array(512);
const level = (an) => { an.getFloatTimeDomainData(lvlBuf); let s = 0; for (let i = 0; i < lvlBuf.length; i++) s += lvlBuf[i] * lvlBuf[i]; return 20 * Math.log10(Math.sqrt(s / lvlBuf.length) + 1e-9); };
setInterval(() => {
  if (!V.joined && !V.testing) return;
  const now = performance.now();
  if (V.analyser && V.src) {
    const db = level(V.analyser); V.selfLevel = db;
    let open;
    if (settings.aiNoise && V.rnReady) open = true; // RNNoise já corta quando não é voz
    else {
      let thr = settings.threshold;
      if (settings.autoSens) { noiseFloor = db < noiseFloor ? db : noiseFloor + 0.02; noiseFloor = clamp(noiseFloor, -80, -35); thr = Math.max(noiseFloor + 12, -60); V.autoThr = thr; }
      if (db > thr) V.gateHold = now + 300;
      open = now < V.gateHold;
      if (open !== V.gateOpen) { V.gateOpen = open; refreshSpeaking(); }
    }
    const send = (WEB_VIEWER || open) && !V.muted && !V.deafened && V.joined;
    if (V.gate.gain.value > 0.5 !== send) V.gate.gain.setTargetAtTime(send ? 1 : 0, V.ctx.currentTime, send ? 0.005 : 0.03);
  }
  if (!V.windowVisible || document.hidden) return;
  let changed = false;
  for (const [id, p] of V.peers) {
    if (!p.analyser) continue;
    const on = level(p.analyser) > -58 && !settings.userMuted[S.users.get(id)?.name];
    if (on) p.speakUntil = now + 250;
    const sp = now < (p.speakUntil || 0);
    if (sp !== V.speaking.has(id)) { if (sp) V.speaking.add(id); else V.speaking.delete(id); changed = true; }
  }
  if (V.djAnalyser) {
    const sp = level(V.djAnalyser) > -50 && !settings.userMuted[DJ_NAME];
    if (sp !== V.speaking.has(DJ_ID)) { if (sp) V.speaking.add(DJ_ID); else V.speaking.delete(DJ_ID); changed = true; }
  }
  if (changed) refreshSpeaking();
}, WEB_VIEWER ? 80 : 40);
setInterval(() => {
  if (V.windowVisible && !document.hidden) tickTimers();
  wsSend({ t: 'ping', ts: Date.now() });
  let ch = false; for (const [id, t] of S.typing) if (Date.now() - t > 6000) { S.typing.delete(id); ch = true; }
  if (ch) renderTyping();
  if (V.windowVisible && !document.hidden) updateDJProgress();
}, 1000);

function setConnStatus(kind, text) {
  $('#vp-title').className = kind; $('#vp-title').textContent = text;
  $('#vp-signal').className = kind === 'good' ? '' : kind;
}
function updatePing() {
  if (!V.joined) return;
  $('#vp-signal').title = `Ping até o anfitrião: ${S.lastPing} ms`;
  if (S.ws && S.ws.readyState === 1) setConnStatus(S.lastPing > 250 ? 'warn' : 'good', 'Voz conectada');
}

// ---------- WebRTC (malha) ----------
function sig(to, data) { wsSend({ t: 'signal', to, data }); }
function getPeer(uid) {
  let p = V.peers.get(uid);
  if (p) return p;
  const pc = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: 'max-bundle', iceTransportPolicy: LS.get('forceRelay', false) && !S.isHost ? 'relay' : 'all' });
  p = { uid, pc, polite: S.myId > uid, makingOffer: false, ignoreOffer: false, streams: new Map(), queue: Promise.resolve(), audio: null };
  V.peers.set(uid, p);
  pc.onnegotiationneeded = async () => {
    try { p.makingOffer = true; await pc.setLocalDescription(); sig(uid, { desc: pc.localDescription }); }
    catch (e) { console.warn('negotiation', e); }
    finally { p.makingOffer = false; }
  };
  pc.onsignalingstatechange = () => { if (pc.signalingState === 'stable') tunePeerSenders(p); };
  pc.onicecandidate = ({ candidate }) => { if (candidate) sig(uid, { cand: candidate }); };
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') { try { pc.restartIce(); } catch {} }
    if (pc.iceConnectionState === 'disconnected') setTimeout(() => { if (pc.iceConnectionState === 'disconnected') try { pc.restartIce(); } catch {} }, 3000);
  };
  pc.ontrack = (ev) => {
    const stream = ev.streams[0] || new MediaStream([ev.track]);
    p.streams.set(stream.id, stream);
    const u = S.users.get(uid);
    // A relayed live arrives on the relay's connection but belongs to its owner (same stream id).
    const owner = u && u.screenStreamId === stream.id ? u : [...S.users.values()].find((x) => x.screenStreamId === stream.id && x.id !== uid);
    const isScreen = !!owner;
    if (ev.track.kind === 'audio') attachRemoteAudio(owner && owner.id !== uid ? V.peers.get(owner.id) || p : p, stream, isScreen);
    ev.track.onunmute = () => renderCall();
    stream.onremovetrack = () => { if (!stream.getTracks().length) { p.streams.delete(stream.id); renderCall(); } };
    renderCall();
  };
  const voiceTrack = (!WEB_VIEWER || WEB_VOICE) && V.dest.stream.getAudioTracks()[0];
  if (voiceTrack) { const sender = pc.addTrack(voiceTrack, V.dest.stream); tuneSender(sender, { maxBitrate: 96000 }); }
  else pc.addTransceiver('audio', { direction: 'recvonly' });
  const watching = V.watching.get(uid);
  if (watching) sig(uid, watchMsg(watching));
  return p;
}
function closePeer(uid) {
  const p = V.peers.get(uid); if (!p) return;
  V.peers.delete(uid); V.speaking.delete(uid);
  try { p.pc.close(); } catch {}
  for (const a of [p.audio, p.screenAudio]) if (a) { try { a.src.disconnect(); a.gain.disconnect(); } catch {} a.el.srcObject = null; }
  V.screenSenders.delete(uid);
  V.watching.delete(uid);
  V.relayed.delete(uid); V.relayOut.delete(uid);
  if (V.relayId === uid) dropRelay();
  for (const [owner, via] of [...V.relayVia]) if (via === uid || owner === uid) { // my relay left: ask the streamer again
    V.relayVia.delete(owner);
    const sid = V.watching.get(owner); if (sid && owner !== uid) sig(owner, watchMsg(sid));
  }
}
function onSignal(from, data) {
  if (data && data.listen) return music?.onListen(from, data.listen); // Ouvir junto (música), não é voz
  if (!V.joined) return;
  const u = S.users.get(from); if (!u || u.voiceChannel !== V.channel) return;
  const p = getPeer(from);
  p.queue = p.queue.then(async () => {
    const pc = p.pc;
    try {
      if ('watch' in data) {
        p.wantsScreen = !!data.watch && !!V.screen && data.streamId === V.screen.id;
        if (p.wantsScreen) routeViewer(p, data);
        else { removeScreenFrom(p); V.relayed.delete(p.uid); if (V.relayId === p.uid) dropRelay(); }
      } else if (onRelaySignal(from, p, data)) {
        // handled: relay routing between streamer, relay and viewers
      } else if (data.desc) {
        const collision = data.desc.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
        p.ignoreOffer = !p.polite && collision;
        if (p.ignoreOffer) return;
        await setScreenRemoteDescription(p, data.desc, { stream: V.screen, senders: V.screenSenders.get(p.uid), quality: V.screenQ, enabled: !WEB_VIEWER && V.screenStartupEnabled !== false });
        if (data.desc.type === 'offer') { await pc.setLocalDescription(); sig(from, { desc: pc.localDescription }); }
      } else if (data.cand) {
        try { await pc.addIceCandidate(data.cand); } catch (e) { if (!p.ignoreOffer) console.warn('ice', e); }
      }
    } catch (e) { console.warn('signal', e); }
  });
}
async function tuneSender(sender, enc) {
  try {
    const prm = sender.getParameters();
    if (!prm.encodings || !prm.encodings.length) return; // Retry once SDP negotiation is stable.
    const { degradationPreference, ...encoding } = enc;
    Object.assign(prm.encodings[0], encoding);
    if (degradationPreference) prm.degradationPreference = degradationPreference;
    await sender.setParameters(prm);
  } catch (e) { console.warn('Qualidade do envio:', e.message); }
}
function tunePeerSenders(p) {
  for (const sender of p.pc.getSenders()) {
    if (!sender.track) continue;
    const screen = (V.screenSenders.get(p.uid) || []).includes(sender);
    if (screen && sender.track.kind === 'video') tuneSender(sender, { maxBitrate: V.screenQ.br, maxFramerate: V.screenQ.fps, degradationPreference: 'maintain-framerate' });
    else tuneSender(sender, { maxBitrate: screen ? 128000 : 96000 });
  }
}
function attachRemoteAudio(p, stream, isScreen) {
  const key = isScreen ? 'screenAudio' : 'audio';
  if (p[key] && p[key].stream === stream) return;
  if (p[key]) { try { p[key].src.disconnect(); p[key].gain.disconnect(); } catch {} p[key].el.pause(); p[key].el.srcObject = null; }
  const el = new Audio(); el.srcObject = stream; el.muted = true; el.play().catch(() => {});
  const src = V.ctx.createMediaStreamSource(stream);
  const gain = V.ctx.createGain();
  src.connect(gain);
  if (isScreen) {
    if (!V.screenMaster) { V.screenMaster = V.ctx.createGain(); V.screenMaster.connect(V.ctx.destination); V.screenMaster.gain.value = V.deafened ? 0 : 1; }
    gain.connect(V.screenMaster);
  } else {
    const an = V.ctx.createAnalyser(); an.fftSize = 512; src.connect(an); p.analyser = an;
    gain.connect(V.master);
  }
  p[key] = { stream, el, src, gain };
  applyUserVolume(p.uid);
}
function volumeGain(percent) {
  const value = clamp(Number(percent) || 0, 0, 200) / 100;
  return value <= 1 ? value * value : value; // Perceptual control below unity; max boost remains +6 dB.
}
function setUserGain(param, gain) {
  if (V.ctx && param.setTargetAtTime) { param.cancelScheduledValues(V.ctx.currentTime); param.setTargetAtTime(gain,V.ctx.currentTime,0.015); }
  else param.value = gain;
}
function volFor(name) { return settings.userMuted[name] ? 0 : volumeGain(settings.userVolumes[name] ?? 100); }
function applyUserVolume(uid) {
  if (uid === DJ_ID) { if (V.djGain) setUserGain(V.djGain.gain,volFor(DJ_NAME) * 0.6); return; }
  const p = V.peers.get(uid); const u = S.users.get(uid);
  if (!p || !u) return;
  if (p.audio) setUserGain(p.audio.gain.gain,volFor(u.name));
  if (p.screenAudio) setUserGain(p.screenAudio.gain.gain,!V.watching.has(uid) || settings.userMuted[u.name] ? 0 : volumeGain(settings.streamVolumes[u.name] ?? 100));
}
function reclassifyStreams() {
  for (const [uid, p] of V.peers) {
    const u = S.users.get(uid); if (!u) continue;
    for (const [sid, st] of p.streams) {
      if (!st.getAudioTracks().length) continue;
      if (u.screenStreamId === sid && (!p.screenAudio || p.screenAudio.stream !== st)) {
        if (p.audio && p.audio.stream === st) { try { p.audio.src.disconnect(); p.audio.gain.disconnect(); } catch {} p.audio.el.pause(); p.audio.el.srcObject = null; p.audio = null; }
        attachRemoteAudio(p, st, true);
      }
    }
  }
}

// ---------- Compartilhar tela ----------
const QUALITY = {
  '720p60': { w: 1280, h: 720, fps: 60, br: 3500000 },
  '720p30': { w: 1280, h: 720, fps: 30, br: 2500000 },
  '1080p30': { w: 1920, h: 1080, fps: 30, br: 4500000 },
  '1080p60': { w: 1920, h: 1080, fps: 60, br: 7000000 },
  '1440p60': { w: 2560, h: 1440, fps: 60, br: 10000000 },
};
function stripUnisolatedAudio(stream, nativeIsolated = false) {
  let removed = false;
  for (const track of stream.getAudioTracks()) {
    const restriction = track.getSettings().restrictOwnAudio;
    // A missing experimental setting is not a negative result. Only accept it
    // after the native handler confirms this exact request used isolated loopback.
    if (track.readyState === 'ended' || !(restriction === true || nativeIsolated && restriction === undefined)) {
      stream.removeTrack(track); track.stop(); removed = true;
    }
  }
  return removed;
}
async function captureNativeScreen(sourceId, Q, audio) {
  let nativeIsolated = false;
  const capture = async (withAudio) => {
    nativeIsolated = false;
    const selected = await native.selectScreen({ id: sourceId, audio: withAudio });
    const result = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: Q.w, max: Q.w }, height: { ideal: Q.h, max: Q.h }, frameRate: { ideal: Q.fps, max: Q.fps } },
      audio: withAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false, restrictOwnAudio: true } : false,
    });
    if (withAudio && selected?.captureToken && native.captureInfo) {
      try { const receipt = await native.captureInfo(selected.captureToken); nativeIsolated = receipt.isolatedAudioConfirmed === true && receipt.sourceId === sourceId; } catch {}
    }
    return result;
  };
  let stream;
  try { stream = await capture(audio); }
  catch (error) {
    // Do not retry permission denial or cancellation. Never fall back to full loopback.
    if (!audio || !['NotReadableError', 'NotSupportedError', 'AbortError'].includes(error.name)) throw error;
    await native.captureStatus({ active: false, stage: 'isolated-audio-failed', audioError: error.name, audioDetail: error.message });
    stream = await capture(false);
  }
  const markers = stream.getAudioTracks().map(t => t.getSettings().restrictOwnAudio);
  const removed = stripUnisolatedAudio(stream, nativeIsolated);
  if (audio) await native.captureStatus({active:false,stage:'isolated-audio-validation',audio:stream.getAudioTracks().length>0,audioDetail:JSON.stringify({nativeConfirmed:nativeIsolated,restrictions:markers.map(x=>x===undefined?'missing':x),kept:stream.getAudioTracks().length})});
  if (audio && (removed || !stream.getAudioTracks().length)) {
    toast('Não foi possível iniciar o som separado da call neste PC. A live segue com vídeo, sem som.', '', 8000);
  }
  return stream;
}
async function toggleShare() {
  // While live on the desktop app, the button opens the same picker to change the live instead of ending it.
  if (V.screen && !native) return stopShare();
  if (!V.joined) return toast('Entre na call primeiro.');
  if (!native) {
    try { const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { restrictOwnAudio: true } }); if (stripUnisolatedAudio(stream)) toast('Som desativado: não foi possível excluir o áudio da call.'); startShareWithStream(stream, '1080p30'); } catch {}
    return;
  }
  const live = !!V.screen;
  const captureInfo = await native.captureInfo();
  // A janela abre na hora; as miniaturas das telas (que o Windows demora para gerar) chegam logo depois.
  const sourcesReady = native.screenSources();
  let sources = [], sel = null;
  let tab = live && String(V.screenSourceId || '').startsWith('window:') ? 'window' : 'screen';
  const quality = captureInfo.compatibility ? '720p30' : live && V.screenQName ? V.screenQName : LS.get('shareQuality', '720p30');
  const audioOn = live ? V.screen.getAudioTracks().length > 0 : LS.get('shareAudioV2', false);
  const m = openModal(`
    <header><div><h2>${live ? 'Alterar transmissão' : 'Compartilhar tela'}</h2><p>${live ? 'A live continua no ar enquanto você troca' : 'Escolha o que a galera vai ver'}</p></div><button class="icon-btn" data-close>${icon('x')}</button></header>
    <div class="body">
      <div class="tabs"><div class="tab ${tab === 'screen' ? 'active' : ''}" data-tab="screen">Telas</div><div class="tab ${tab === 'window' ? 'active' : ''}" data-tab="window">Janelas / jogos</div></div>
      <div class="sources"></div>
      <div class="opts">
        <div class="field"><label>Qualidade</label><select id="sh-q">${Object.keys(QUALITY).filter((k) => !captureInfo.compatibility || k === '720p30').map((k) => `<option ${k === quality ? 'selected' : ''} value="${k}">${k.replace('p', 'p ').replace(/(\d+)$/, '$1 fps')}</option>`).join('')}</select></div>
        <label class="check"><input type="checkbox" id="sh-audio" ${captureInfo.audioSupported && audioOn ? 'checked' : ''} ${!captureInfo.audioSupported ? 'disabled' : ''}> Transmitir som do PC</label>
      </div>
      <p class="muted small" style="margin:10px 0 0">${captureInfo.compatibility ? 'Modo de compatibilidade ativo: 720p a 30 fps, sem som do PC.' : captureInfo.audioSupported ? 'O som do PC é opcional. Se não for possível excluir o áudio da call, a transmissão segue apenas com vídeo.' : 'Som do PC requer Windows 10 versão 2004 ou posterior, ou macOS 14.2 ou posterior.'}</p>
      ${live ? '<p class="live-encoder" id="sh-enc">Verificando como a live está sendo codificada…</p>' : ''}
      <div class="capture-help"><span>Problema para transmitir?</span>${captureInfo.compatibility ? '<button class="btn" id="sh-compat">Voltar ao modo normal</button>' : ''}<button class="btn" id="sh-log">Abrir diagnóstico</button></div>
    </div>
    <footer>${live ? '<button class="btn danger" id="sh-stop">Parar transmissão</button><span class="grow"></span>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="sh-go">${live ? 'Aplicar' : 'Transmitir'}</button></footer>`, { wide: true });
  const renderSrc = () => {
    if (!sources.length) { $('.sources', m.el).innerHTML = '<div class="src loading"><div class="th"></div><div class="nm">&nbsp;</div></div>'.repeat(tab === 'screen' ? 2 : 4); return; }
    const list = sources.filter((s) => (tab === 'screen') === s.screen);
    if (!list.includes(sel)) sel = list[0];
    $('.sources', m.el).innerHTML = list.map((s) => `<div class="src ${s === sel ? 'sel' : ''}" data-id="${esc(s.id)}"><div class="th" style="${s.thumb ? `background-image:url(${s.thumb})` : ''}"></div><div class="nm">${s.icon ? `<img src="${s.icon}">` : ''}<span>${esc(s.name)}</span></div></div>`).join('') || '<div class="muted">Nada encontrado</div>';
    $$('.src', m.el).forEach((el) => { el.onclick = () => { sel = sources.find((s) => s.id === el.dataset.id); renderSrc(); }; el.ondblclick = () => $('#sh-go').click(); });
  };
  $$('.tab', m.el).forEach((t) => t.onclick = () => { tab = t.dataset.tab; $$('.tab', m.el).forEach((x) => x.classList.toggle('active', x === t)); renderSrc(); });
  renderSrc();
  sourcesReady.then((list) => {
    if (!m.el.isConnected) return;
    sources = list; sel = (live && sources.find((s) => s.id === V.screenSourceId)) || sources.find((s) => (tab === 'screen') === s.screen) || sources[0];
    renderSrc();
  }).catch(() => { if (m.el.isConnected) $('.sources', m.el).innerHTML = '<p class="muted small">Não consegui listar as telas. Feche e tente de novo.</p>'; });
  $('#sh-log', m.el).onclick = () => native.captureDiagnostics();
  // Compatibility mode is only switched on automatically after a capture crash; this is the way back.
  const compat = $('#sh-compat', m.el);
  if (compat) compat.onclick = async () => {
    if (await confirmModal('Reiniciar o Resenha', 'O app vai reiniciar para aplicar o modo de captura. Você precisará entrar na sala novamente.', 'Reiniciar', false)) native.setCaptureCompatibility(false);
  };
  const stop = $('#sh-stop', m.el);
  if (stop) stop.onclick = () => { m.close(); stopShare(); };
  if (live) liveEncoderInfo().then((e) => {
    const el = $('#sh-enc', m.el); if (!el) return;
    const viewers = e.copies + V.relayed.size;
    if (!e.copies) { el.textContent = 'Ninguém assistindo agora: o vídeo só é codificado quando alguém entra na live.'; return; }
    const where = e.impl ? (e.gpu ? 'pela placa de vídeo' : 'pelo processador') : 'ainda medindo';
    const limit = { cpu: ' · limitada pelo processador', bandwidth: ' · limitada pela internet', other: ' · limitada' }[e.limit] || '';
    el.textContent = `${viewers} assistindo · codificando ${e.copies === 1 ? '1 vez' : e.copies + ' vezes'} ${where}${e.fps ? ` · ${e.fps} fps` : ''}${limit}${e.impl ? ` (${e.impl})` : ''}`;
    el.classList.toggle('warn', e.limit === 'cpu' || (e.impl && !e.gpu));
  });
  $('#sh-go').onclick = async () => {
    if (!sel) return;
    const q = $('#sh-q').value, audio = $('#sh-audio').checked;
    LS.set('shareQuality', q); LS.set('shareAudioV2', audio);
    m.close();
    if (live && V.screen && sel.id === V.screenSourceId && q === V.screenQName && audio === audioOn) return;
    const Q = QUALITY[q];
    let captured = null;
    try {
      const stream = captured = await captureNativeScreen(sel.id, Q, audio);
      if (live && V.screen) { swapShareStream(stream, q); toast('Transmissão atualizada.'); }
      else startShareWithStream(stream, q, !captureInfo.compatibility);
      V.screenSourceId = sel.id;
    } catch (e) {
      captured?.getTracks().forEach((t) => t.stop());
      if (live && V.screen) { toast('Não deu pra trocar: ' + e.message + '. A live segue como estava.', 'err'); return; }
      native.captureStatus({ active: false, stage: 'error', audioError: e.name, audioDetail: e.message }); toast('Não deu pra compartilhar: ' + e.message, 'err');
    }
  };
}
// Changes source, quality or sound of a running live without ending it: viewers keep the same stream.
// Video is swapped in place; sound that appears or goes away is added or removed per viewer (renegotiates).
function swapShareStream(next, q) {
  const cur = V.screen, Q = QUALITY[q] || QUALITY['720p30'];
  const nv = next.getVideoTracks()[0], na = next.getAudioTracks()[0];
  const soundChanged = !!na !== cur.getAudioTracks().length > 0;
  for (const [uid, senders] of V.screenSenders) {
    const p = V.peers.get(uid); if (!p) continue;
    const kept = [];
    for (const s of senders) {
      if (s.track?.kind === 'video') { s.replaceTrack(nv || null).catch(() => {}); tuneSender(s, { maxBitrate: Q.br, maxFramerate: Q.fps, degradationPreference: 'maintain-framerate' }); kept.push(s); }
      else if (s.track?.kind === 'audio' && na) { s.replaceTrack(na).catch(() => {}); kept.push(s); }
      else try { p.pc.removeTrack(s); } catch {}
    }
    if (na && !kept.some((s) => s.track?.kind === 'audio' || s.track === na)) { const s = p.pc.addTrack(na, cur); tuneSender(s, { maxBitrate: 128000 }); kept.push(s); }
    V.screenSenders.set(uid, kept);
  }
  // Keep the same MediaStream object (and id) so the local tile and viewers stay attached.
  for (const t of cur.getTracks()) { t.onended = null; cur.removeTrack(t); t.stop(); }
  for (const t of next.getTracks()) cur.addTrack(t);
  if (nv) { nv.contentHint = 'motion'; nv.onended = () => stopShare(); }
  V.screenQ = Q; V.screenQName = q;
  // The relay forwards the tracks it receives; when sound appears or goes, relayed viewers ask again so the
  // relay picks up the new set (the video track itself is swapped in place and keeps flowing).
  if (soundChanged) setTimeout(() => dropRelay(true), 1500);
  native?.captureStatus({ active: true, stage: 'streaming', quality: q, audio: !!na });
  renderAll();
}
function startShareWithStream(stream, q, startupEnabled = true) {
  const Q = QUALITY[q] || QUALITY['720p60'];
  V.screen = stream; V.screenQ = Q; V.screenQName = QUALITY[q] ? q : '720p60'; V.previewHidden = true;
  V.screenStartupEnabled = startupEnabled;
  native?.captureStatus({ active: true, stage: 'streaming', quality: q, audio: stream.getAudioTracks().length > 0 });
  const vt = stream.getVideoTracks()[0];
  if (vt) { vt.contentHint = 'motion'; vt.onended = () => stopShare(); }
  wsSend({ t: 'state', sharing: true, screenStreamId: stream.id });
  // Tracks are sent only after a viewer explicitly subscribes.
  sfx('share');
  renderAll();
}

// ---------- Teste do som da live ----------
// Runs the real capture path (same native selection, same isolation rules) with a tiny video,
// measures the audio for a few seconds and explains the first step that failed.
function liveAudioVerdict(r) {
  if (r.compatibility) return { step: 'compat', text: 'O modo de compatibilidade está ligado e ele desativa o som da live. Em "Compartilhar tela", clique em "Voltar ao modo normal" e teste de novo.' };
  if (!r.audioSupported) return { step: 'windows', text: r.platform === 'win32' ? `Este Windows (build ${r.build || '?'}) não permite capturar só o som do PC. É preciso o Windows 10 versão 2004 (build 19041) ou mais novo.` : 'Este sistema não permite capturar o som do PC pelo Resenha.' };
  if (r.error) return { step: 'capture', text: `O Windows recusou capturar o som (${r.error}). Feche programas que usam o áudio em modo exclusivo (apps de headset, equalizadores), confira a saída de som padrão do Windows e teste de novo.` };
  if (!r.track) return { step: 'track', text: 'O Windows entregou só o vídeo, sem faixa de som. Confira a saída de som padrão do Windows e teste de novo.' };
  if (!r.isolated) return { step: 'isolation', text: 'O Windows entregou o som, mas não confirmou que separou o áudio da call. Para não ecoar a call na live, o Resenha descarta esse som. Mande este relatório para quem cuida do Resenha.' };
  if (!(r.peakDb > -60)) return { step: 'silent', text: 'O som foi capturado, mas veio mudo. Deixe um vídeo ou música tocando durante o teste e confira em Configurações do Windows › Som se a saída padrão é onde você está ouvindo.' };
  return { step: 'ok', text: 'O som da live funciona neste PC.' + (r.rememberedAudio ? '' : ' Ao transmitir, marque "Transmitir som do PC".') + ' Se mesmo assim ninguém ouvir, peça para quem assiste conferir o "Som da live" e o volume da pessoa.' };
}
async function measureAudioLevel(track, ms) {
  const ctx = new AudioContext(), src = ctx.createMediaStreamSource(new MediaStream([track])), an = ctx.createAnalyser();
  an.fftSize = 2048; src.connect(an);
  const buf = new Float32Array(an.fftSize); let peak = -120, sum = 0, n = 0;
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await sleep(100); an.getFloatTimeDomainData(buf);
    let s = 0; for (const v of buf) s += v * v;
    const rms = Math.sqrt(s / buf.length); peak = Math.max(peak, 20 * Math.log10(rms + 1e-9)); sum += rms * rms; n++;
  }
  try { src.disconnect(); await ctx.close(); } catch {}
  // Average energy, not an average of dB values (silent frames would dominate).
  return { peakDb: Math.round(peak), avgDb: Math.max(-120, Math.round(10 * Math.log10((n ? sum / n : 0) + 1e-12))) };
}
async function runLiveAudioTest(sourceId) {
  const sys = (await native.captureSystem?.().catch(() => null)) || {};
  const info = await native.captureInfo();
  const r = { at: new Date().toISOString(), app: await native.version(), platform: sys.platform, release: sys.release, build: Number(String(sys.release || '').split('.')[2]) || 0, electron: sys.electron,
    compatibility: !!info.compatibility, audioSupported: !!info.audioSupported, rememberedAudio: !!LS.get('shareAudioV2', false), source: sourceId ? sourceId.split(':')[0] : 'nenhuma' };
  if (r.compatibility || !r.audioSupported || !sourceId) { if (!sourceId) r.error = 'NoScreen'; return { ...r, verdict: liveAudioVerdict(r) }; }
  let stream = null;
  try {
    const selected = await native.selectScreen({ id: sourceId, audio: true });
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 320, max: 640 }, height: { ideal: 180, max: 360 }, frameRate: { ideal: 5, max: 5 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false, restrictOwnAudio: true } });
    let nativeIsolated = false;
    if (selected?.captureToken) { try { const receipt = await native.captureInfo(selected.captureToken); nativeIsolated = receipt.isolatedAudioConfirmed === true && receipt.sourceId === sourceId; } catch {} }
    const track = stream.getAudioTracks()[0];
    r.track = !!track; r.nativeConfirmed = nativeIsolated;
    if (track) {
      const settings = track.getSettings(); r.restrictOwnAudio = settings.restrictOwnAudio === undefined ? 'ausente' : settings.restrictOwnAudio;
      r.trackState = track.readyState; r.sampleRate = settings.sampleRate; r.channels = settings.channelCount;
      r.isolated = track.readyState !== 'ended' && (settings.restrictOwnAudio === true || nativeIsolated && settings.restrictOwnAudio === undefined);
      Object.assign(r, await measureAudioLevel(track, 4000));
    }
  } catch (e) { r.error = e.name || 'Error'; r.errorDetail = String(e.message || '').slice(0, 160); }
  finally {
    stream?.getTracks().forEach((t) => t.stop());
    await native.captureStatus({ active: false, stage: 'audio-test', audio: !!r.track, audioError: r.error, audioDetail: JSON.stringify({ restrict: r.restrictOwnAudio, native: r.nativeConfirmed, peak: r.peakDb, build: r.build }) }).catch(() => {});
  }
  return { ...r, verdict: liveAudioVerdict(r) };
}
function liveAudioReportText(r) {
  const yes = (v) => v ? 'sim' : 'não';
  return [`Teste do som da live · Resenha ${r.app}`, `Data: ${r.at}`, `Sistema: ${r.platform || '?'} ${r.release || ''} (build ${r.build || '?'}) · Electron ${r.electron || '?'}`,
    `Modo de compatibilidade: ${yes(r.compatibility)} · Som do PC suportado: ${yes(r.audioSupported)} · Caixa "Transmitir som" marcada: ${yes(r.rememberedAudio)}`,
    `Captura: ${r.error ? 'erro ' + r.error + (r.errorDetail ? ' (' + r.errorDetail + ')' : '') : 'ok'} · Faixa de som: ${yes(r.track)} (${r.trackState || '-'})`,
    `Separação da call: restrictOwnAudio=${r.restrictOwnAudio ?? '-'} · confirmação nativa=${yes(r.nativeConfirmed)} · aceito=${yes(r.isolated)}`,
    `Nível: pico ${r.peakDb ?? '-'} dB · média ${r.avgDb ?? '-'} dB · ${r.sampleRate || '-'} Hz · ${r.channels || '-'} canal(is)`,
    `Resultado: ${r.verdict.text}`].join('\n');
}
function openLiveAudioTest(sourceId) {
  if (!native) return;
  if (V.screen) return toast('Pare a sua transmissão antes de testar o som.', '', 5000);
  const m = openModal(`<header><div><h2>Testar som da live</h2><p>Confere, neste PC, cada etapa que o som da transmissão precisa passar.</p></div><button class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></header>
    <div class="body"><ol class="audio-test-steps"><li>Deixe um vídeo ou uma música tocando no PC.</li><li>Clique em <b>Iniciar teste</b>. Leva uns 5 segundos e não transmite nada para ninguém.</li></ol><div id="at-result" aria-live="polite"></div></div>
    <footer><button class="btn" id="at-copy" disabled>Copiar relatório</button><button class="btn primary" id="at-go">Iniciar teste</button></footer>`);
  let report = null;
  $('#at-go', m.el).onclick = async (e) => {
    const go = e.currentTarget; go.disabled = true; go.textContent = 'Testando…';
    $('#at-result', m.el).innerHTML = '<p class="muted">Capturando e medindo o som…</p>';
    report = await runLiveAudioTest(sourceId).catch((err) => ({ app: '?', at: new Date().toISOString(), error: err.name || 'Error', errorDetail: err.message, verdict: { step: 'capture', text: 'O teste não conseguiu rodar: ' + err.message } }));
    const steps = [
      ['Modo de compatibilidade desligado', !report.compatibility],
      ['Windows permite capturar o som', !!report.audioSupported],
      ['Windows aceitou capturar', report.audioSupported && !report.compatibility && !report.error],
      ['Faixa de som recebida', !!report.track],
      ['Som separado da call', !!report.isolated],
      ['Som chegando', report.peakDb > -60],
    ];
    const firstFail = steps.findIndex(([, ok]) => !ok);
    $('#at-result', m.el).innerHTML = `<ul class="audio-test-list">${steps.map(([label, ok], i) => `<li class="${ok ? 'ok' : i === firstFail ? 'fail' : 'skip'}">${icon(ok ? 'check' : i === firstFail ? 'x' : 'more', 16)}<span>${esc(label)}</span></li>`).join('')}</ul>
      <div class="audio-test-verdict ${report.verdict.step === 'ok' ? 'ok' : 'fail'}">${esc(report.verdict.text)}</div>`;
    $('#at-copy', m.el).disabled = false; go.disabled = false; go.textContent = 'Testar de novo';
  };
  $('#at-copy', m.el).onclick = () => report && copy(liveAudioReportText(report));
}
// ---------- Live: H.264 on the GPU and a relay so the streamer encodes once ----------
// H.264 is what Windows and macOS encode on the graphics card; VP8 (WebRTC's default) usually runs on the CPU.
function preferH264(pc, sender) {
  try {
    const tr = pc.getTransceivers().find((t) => t.sender === sender), codecs = RTCRtpSender.getCapabilities?.('video')?.codecs;
    if (!tr?.setCodecPreferences || !codecs) return;
    const h264 = codecs.filter((c) => /h264/i.test(c.mimeType)).sort((a, b) => /packetization-mode=1/.test(b.sdpFmtpLine || '') - /packetization-mode=1/.test(a.sdpFmtpLine || ''));
    if (h264.length) tr.setCodecPreferences([...h264, ...codecs.filter((c) => !/h264/i.test(c.mimeType))]);
  } catch {}
}
// Each viewer used to get its own encoder on the streamer's PC. Now the first desktop-app viewer receives the
// live directly and becomes the relay; later 2.0.1+ viewers receive it from the relay, which re-encodes on its
// own machine. Older viewers and the browser still get it directly.
function canRelay() { return typeof native !== 'undefined' && !!native; }
function watchMsg(streamId, active = true, extra = {}) { return { watch: active, streamId, acceptsRelay: true, canRelay: canRelay(), ...extra }; }
function routeViewer(p, data) {
  const relay = V.relayId && V.relayId !== p.uid && V.screenSenders.has(V.relayId) && V.peers.get(V.relayId);
  if (relay && data.acceptsRelay && !data.noRelay) {
    removeScreenFrom(p); V.relayed.add(p.uid);
    sig(p.uid, { relayVia: relay.uid, streamId: V.screen.id });
    return;
  }
  V.relayed.delete(p.uid); addScreenTo(p);
  if (!V.relayId && data.canRelay) V.relayId = p.uid;
}
function dropRelay(keepRelay = false) { // relayed viewers ask again and get a new route
  if (!keepRelay) V.relayId = null;
  const waiting = [...V.relayed]; V.relayed.clear();
  for (const uid of waiting) sig(uid, { relayLost: true, streamId: V.screen?.id || null });
}
function stopRelayingTo(uid) {
  const out = V.relayOut.get(uid), p = V.peers.get(uid);
  if (out && p) for (const s of out.senders) try { p.pc.removeTrack(s); } catch {}
  V.relayOut.delete(uid);
}
function relayTo(p, owner, streamId) { // runs on the relay: forward the live it is watching to one more viewer
  stopRelayingTo(p.uid);
  const stream = V.peers.get(owner)?.streams.get(streamId);
  if (!canRelay() || !stream?.getVideoTracks().length) return sig(p.uid, { relayFail: true, owner });
  const senders = stream.getTracks().map((t) => p.pc.addTrack(t, stream)); // same stream id, so the viewer's UI finds it
  for (const s of senders) {
    if (s.track.kind === 'video') { preferH264(p.pc, s); tuneSender(s, { maxBitrate: 4500000, degradationPreference: 'maintain-framerate' }); }
    else tuneSender(s, { maxBitrate: 128000 });
  }
  V.relayOut.set(p.uid, { owner, streamId, senders });
}
function onRelaySignal(from, p, data) {
  if ('relayWatch' in data) { if (data.relayWatch) relayTo(p, data.owner, data.streamId); else stopRelayingTo(from); return true; }
  if ('relayVia' in data) { // from the streamer: watch through this relay
    if (V.watching.get(from) !== data.streamId || !V.peers.has(data.relayVia)) return sig(from, watchMsg(data.streamId, true, { noRelay: true })), true;
    V.relayVia.set(from, data.relayVia); sig(data.relayVia, { relayWatch: true, owner: from, streamId: data.streamId });
    return true;
  }
  if ('relayLost' in data) { // from the streamer: the relay went away, ask again
    const via = V.relayVia.get(from); if (via) sig(via, { relayWatch: false, owner: from });
    V.relayVia.delete(from);
    if (V.watching.get(from) && V.watching.get(from) === data.streamId) sig(from, watchMsg(data.streamId, true, V.directOnly?.has(from) ? { noRelay: true } : {}));
    return true;
  }
  if ('relayFail' in data) { // from the relay: it cannot forward, go direct
    V.relayVia.delete(data.owner);
    const sid = V.watching.get(data.owner); if (sid) sig(data.owner, watchMsg(sid, true, { noRelay: true }));
    return true;
  }
  return false;
}
// 2.1.3: a live que chega por repasse depende do upload e do PC de quem repassa. Se ela chegar ruim
// (imagem baixa, poucos quadros ou quase sem dados) por ~8 s seguidos, pede direto para quem transmite.

const relayHealth = new Map();
function goDirect(owner) {
  const via = V.relayVia.get(owner); relayHealth.delete(owner); V.directOnly.add(owner);
  if (via) sig(via, { relayWatch: false, owner });
  V.relayVia.delete(owner);
  const sid = V.watching.get(owner); if (sid) sig(owner, watchMsg(sid, true, { noRelay: true }));
  toast('A live de ' + (S.users.get(owner)?.name || 'quem transmite') + ' chegava fraca pelo repasse. Agora vem direto.', '', 4000);
}
async function checkRelayQuality() {
  for (const [owner, via] of [...V.relayVia]) {
    const p = V.peers.get(via), sid = V.watching.get(owner), track = sid && p?.streams?.get(sid)?.getVideoTracks()[0];
    if (!track) { relayHealth.delete(owner); continue; }
    let r = null; try { (await p.pc.getStats(track)).forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'video') r = x; }); } catch {}
    if (!r) continue;
    const now = Date.now(), h = relayHealth.get(owner) || { since: now, bad: 0 };
    const kbps = h.at ? (r.bytesReceived - h.bytes) * 8 / Math.max(1, now - h.at) : null;
    h.bytes = r.bytesReceived; h.at = now; relayHealth.set(owner, h);
    if (kbps === null || now - h.since < 8000) continue; // deixa a conexão estabilizar
    const low = (r.frameHeight > 0 && r.frameHeight < 600) || (r.framesPerSecond != null && r.framesPerSecond < 15) || kbps < 800;
    h.bad = low ? h.bad + 1 : 0;
    if (h.bad >= 4) goDirect(owner);
  }
}
window.__relayCheck = setInterval(() => { if (V.relayVia.size) checkRelayQuality(); }, 2000);

// Shown in "Alterar transmissão": which encoder runs, what limits it, and how many copies the PC encodes.
async function liveEncoderInfo() {
  const copies = [...V.screenSenders.values()].length;
  for (const senders of V.screenSenders.values()) for (const s of senders) {
    if (s.track?.kind !== 'video') continue;
    try {
      for (const r of (await s.getStats()).values()) if (r.type === 'outbound-rtp' && r.kind === 'video') {
        const impl = String(r.encoderImplementation || ''), gpu = r.powerEfficientEncoder === true || /MediaFoundation|VideoToolbox|NVENC|AMF|QSV|Accelerator|External/i.test(impl);
        return { copies, gpu, impl, limit: r.qualityLimitationReason || 'none', fps: Math.round(r.framesPerSecond || 0) };
      }
    } catch {}
  }
  return { copies };
}

function addScreenTo(p) {
  if (!V.screen || !p.wantsScreen || V.screenSenders.has(p.uid)) return;
  const senders = V.screen.getTracks().map((t) => p.pc.addTrack(t, V.screen));
  V.screenSenders.set(p.uid, senders);
  p.screenStartupSender = null;
  for (const s of senders) {
    if (s.track.kind === 'video') { preferH264(p.pc, s); tuneSender(s, { maxBitrate: V.screenQ.br, maxFramerate: V.screenQ.fps, degradationPreference: 'maintain-framerate' }); }
    else tuneSender(s, { maxBitrate: 128000 });
  }
}
function removeScreenFrom(p) {
  for (const sender of V.screenSenders.get(p.uid) || []) {
    try { p.pc.removeTrack(sender); } catch {}
  }
  V.screenSenders.delete(p.uid);
}
function stopShare(silent) {
  if (!V.screen) return;
  V.screen.getTracks().forEach((t) => t.stop());
  for (const [uid, senders] of V.screenSenders) { const p = V.peers.get(uid); if (p) for (const s of senders) try { p.pc.removeTrack(s); } catch {} }
  V.screenSenders.clear();
  for (const p of V.peers.values()) p.wantsScreen = false;
  V.relayId = null; V.relayed.clear();
  V.screen = null;
  native?.captureStatus({ active: false, stage: 'stopped' });
  if (!silent) { wsSend({ t: 'state', sharing: false, screenStreamId: null }); sfx('leave'); }
  if (V.focus === 'screen:' + S.myId) V.focus = null;
  renderAll();
}

// ---------- Privado e favoritos (na mesma sala) ----------
const friends = LS.get('friends', {});
const dmUnread = new Set();
const dmDrafts = new Map();
let dmPanel = null, dmPeer = null;
const dmStorageKey = () => 'dm.' + (S.code || S.addr?.text || 'sala');
const dmRooms = new Map();
const dmStore = createDMStorage({ LS, dmRooms, dmStorageKey });
function dmHistory() { return dmStore.dmHistory(); }
function rememberContact(u) { return dmStore.rememberContact(u); }
function toggleFriend(u) {
  if (friends[u.id]) delete friends[u.id];
  else friends[u.id] = { id: u.id, name: u.name, color: u.color, avatar: u.avatar };
  LS.set('friends', friends); renderFriends();
}
function renderFriends() {
  const list = $('#friends-list'); if (!list) return;
  const entries = new Map([...Object.values(LS.get(dmStorageKey() + '.contacts', {})), ...Object.values(friends)].map((u) => [u.id, u]));
  for (const u of S.users.values()) if (u.id !== S.myId && u.id !== DJ_ID) entries.set(u.id, u);
  list.innerHTML = [...entries.values()].map((u) => `<button class="friend-row" data-friend="${esc(u.id)}">${avatarHTML(u)}<span>${friends[u.id] ? '☆ ' : ''}${esc(u.name)}<br><small class="muted">${S.users.has(u.id) ? 'Na sala' : 'Fora da sala'}</small></span>${dmUnread.has(u.id) ? '<span class="badge">Novo</span>' : ''}</button>`).join('') || '<div class="muted small">Seus amigos aparecem aqui.</div>';
  $$('[data-friend]', list).forEach((b) => b.onclick = () => openDM(b.dataset.friend));
  roomUI?.updateUnread(dmUnread);
}
function receiveDM(msg) {
  const HISTORY_LIMIT = 300;
  if (!msg || (msg.from !== S.myId && msg.to !== S.myId)) return;
  const uid = msg.from === S.myId ? msg.to : msg.from, history = dmHistory();
  const contact = S.users.get(uid); if (contact) rememberContact(contact);
  const messages = history[uid] || (history[uid] = []);
  if (messages.some((m) => m.id === msg.id)) return;
  messages.push(msg); if (messages.length > HISTORY_LIMIT) messages.shift();
  if (!LS.set(dmStorageKey(), history)) traceCommand('dm-storage','quota-or-unavailable');
  const visible = dmPanel && dmPeer === uid && (!roomUI || roomUI.isDMVisible());
  if (dmPanel && dmPeer === uid) renderDM();
  if (!visible && msg.from !== S.myId) dmUnread.add(uid);
  renderFriends();
}
function openDM(uid) {
  const u = S.users.get(uid) || friends[uid] || LS.get(dmStorageKey()+'.contacts',{})[uid]; if (!u) return;
  rememberContact(u);
  if (dmPanel && dmPeer === uid) { roomUI?.open('dm'); dmUnread.delete(uid); renderDM(); renderFriends(); $('#dm-input', dmPanel.el).focus(); return; }
  if (dmPanel) dmPanel.close();
  dmPeer = uid; dmUnread.delete(uid);
  dmPanel = openModal(`<header><div><h2>${esc(u.name)}</h2><p>Conversa privada · mensagens salvas neste dispositivo</p></div><button class="icon-btn" data-close>${icon('x')}</button></header><div class="body"><p class="muted small">Disponível enquanto vocês estiverem na mesma sala. A mensagem passa pelo anfitrião.</p><button class="btn" id="dm-favorite">${friends[uid] ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</button><div class="dm-messages" id="dm-messages"></div><form class="dm-compose" id="dm-compose"><textarea id="dm-input" aria-label="Mensagem privada" placeholder="Escreva uma mensagem" rows="2" maxlength="4000"></textarea><button class="btn primary" type="submit">Enviar</button></form><p id="dm-status" class="muted small"></p></div>`, { cls: 'dm-panel', onClose: () => { if (dmPanel) dmDrafts.set(uid, $('#dm-input', dmPanel.el)?.value || ''); dmPanel = null; dmPeer = null; } });
  $('#dm-input', dmPanel.el).value = dmDrafts.get(uid) || '';
  $('#dm-input', dmPanel.el).addEventListener('input', e => dmDrafts.set(uid, e.target.value));
  $('#dm-favorite', dmPanel.el).onclick = () => { toggleFriend(u); $('#dm-favorite', dmPanel.el).textContent = friends[uid] ? 'Remover dos favoritos' : 'Adicionar aos favoritos'; };
  const send = (e) => {
    e.preventDefault(); const input = $('#dm-input', dmPanel.el), text = input.value.trim();
    if (!text) return;
    if (!S.users.has(uid) || !S.ws || S.ws.readyState !== 1) return toast('Seu amigo precisa estar na mesma sala.', 'err');
        const button = $('#dm-compose button', dmPanel.el);
    button.disabled = true; $('#dm-status', dmPanel.el).textContent = 'Enviando…';
    sendCommand('dm', { to: uid, text }).then(() => {
      if (dmDrafts.get(uid)?.trim() === text) dmDrafts.set(uid, '');
      if (dmPanel && dmPeer === uid) { const current = $('#dm-input', dmPanel.el); if (current.value.trim() === text) current.value = ''; renderDM(); }
    }).catch((e) => { if (dmPanel && dmPeer === uid) $('#dm-status', dmPanel.el).textContent = e.message; toast(e.message, 'err', 7000); })
      .finally(() => { button.disabled = false; });
  };
  $('#dm-compose', dmPanel.el).onsubmit = send;
  $('#dm-input', dmPanel.el).onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) send(e); };
  renderDM(); renderFriends(); $('#dm-input', dmPanel.el).focus();
}
function renderDM() {
  if (!dmPanel) return;
  const box = $('#dm-messages', dmPanel.el);
  box.innerHTML = (dmHistory()[dmPeer] || []).map((m) => `<div class="dm-bubble ${m.from === S.myId ? 'mine' : ''}"><small>${esc(m.name)} · ${fmtTime(m.ts)}</small>${esc(m.text)}</div>`).join('') || '<div class="muted small">Comece a conversa.</div>';
  box.scrollTop = box.scrollHeight;
  $('#dm-status', dmPanel.el).textContent = S.users.has(dmPeer) ? 'Online nesta sala' : 'Fora da sala — você pode consultar o histórico.';
}

// ---------- Menu de volume do usuário (clique direito) ----------
function userMenu(e, uid) {
  const u = S.users.get(uid); if (!u) return;
  if (uid === S.myId) return showMenu(e, `${profileCardHTML(u)}<div class="ctx-item" id="cedit"><span>Editar perfil</span>${icon('settings', 16)}</div>`, (menu) => {
    bindProfileCard(menu);
    $('#cedit', menu).onclick = () => { hideMenu(); openSettings('perfil'); };
  });
  const isDJ = uid === DJ_ID;
  const vol = settings.userVolumes[u.name] ?? 100, svol = settings.streamVolumes[u.name] ?? 100;
  showMenu(e, `${isDJ ? `<div class="ctx-head">${avatarHTML(u)}<span>${esc(u.name)}</span></div>` : profileCardHTML(u)}
    <div class="ctx-label"><span>${isDJ ? 'Volume do DJ' : 'Volume do usuário'}</span><span id="cv-v">${vol}%</span></div>
    <div class="ctx-row"><input type="range" min="0" max="200" step="1" value="${vol}" id="cv"></div>
    ${u.sharing ? `<div class="ctx-label"><span>Volume da transmissão</span><span id="cs-v">${svol}%</span></div><div class="ctx-row"><input type="range" min="0" max="200" value="${svol}" id="cs"></div>` : ''}
    <label class="ctx-item check"><span>Silenciar pra mim</span><input type="checkbox" id="cm" ${settings.userMuted[u.name] ? 'checked' : ''}></label>
    <div class="ctx-item" id="cr"><span>Voltar volume pra 100%</span></div>
    ${!isDJ ? `${S.isHost && S.code && u.canHost && uid !== S.myId ? `<div class="ctx-item" id="chost"><span>Tornar anfitrião</span>${icon('crown', 16)}</div>` : ''}<div class="ctx-item" id="cdm"><span>Mensagem privada</span>${icon('chat', 16)}</div><div class="ctx-item" id="cfriend"><span>${friends[uid] ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</span></div><div class="ctx-item" id="cmention"><span>Mencionar</span>${icon('at', 16)}</div>` : `<div class="ctx-item" id="cdj"><span>Abrir painel do DJ</span>${icon('music', 16)}</div>`}`, (menu) => {
    if (!isDJ) bindProfileCard(menu);
    $('#cv', menu).oninput = (ev) => { settings.userVolumes[u.name] = +ev.target.value; $('#cv-v', menu).textContent = ev.target.value + '%'; applyUserVolume(uid); saveSettings(); };
    if ($('#cs', menu)) $('#cs', menu).oninput = (ev) => { settings.streamVolumes[u.name] = +ev.target.value; $('#cs-v', menu).textContent = ev.target.value + '%'; applyUserVolume(uid); saveSettings(); };
    $('#cm', menu).onchange = (ev) => { if (ev.target.checked) settings.userMuted[u.name] = true; else delete settings.userMuted[u.name]; applyUserVolume(uid); saveSettings(); renderAll(); };
    $('#cr', menu).onclick = () => { settings.userVolumes[u.name] = 100; $('#cv', menu).value = 100; $('#cv-v', menu).textContent = '100%'; applyUserVolume(uid); saveSettings(); };
    if ($('#cdm', menu)) $('#cdm', menu).onclick = () => { hideMenu(); openDM(uid); };
    if ($('#cfriend', menu)) $('#cfriend', menu).onclick = () => { toggleFriend(u); hideMenu(); };
    if ($('#cmention', menu)) $('#cmention', menu).onclick = () => { hideMenu(); insertMention(u.name); };
    if ($('#cdj', menu)) $('#cdj', menu).onclick = () => { hideMenu(); openDJPanel(); };
    if ($('#chost', menu)) $('#chost', menu).onclick = () => { hideMenu(); transferHost(uid); };
  });
}
// Transferir anfitrião (clique direito > "Tornar anfitrião"): a pessoa passa a hospedar e você continua na sala como convidado.
async function transferHost(uid) {
  const u = S.users.get(uid); if (!u || !S.isHost || !native) return;
  const ok = await confirmModal('Tornar ' + u.name + ' anfitrião?', 'A sala passa a rodar no PC de ' + esc(u.name) + ' e todo mundo reconecta sozinho em alguns segundos. Você continua na sala como convidado. Canais, conversa e DJ vão junto; os arquivos já enviados ficam no seu PC.', 'Transferir', false);
  if (ok && S.isHost) { wsSend({ t: 'transfer-host', to: uid }); toast('Passando a sala para ' + u.name + '…', '', 4000); }
}

// ---------- Escolher microfone / saída (clique direito nos botões) ----------
async function listDevices(kind) {
  if (WEB_VIEWER && !navigator.mediaDevices?.enumerateDevices) return [];
  let devs = [];
  try { devs = await navigator.mediaDevices.enumerateDevices(); } catch {}
  if (!devs.some((d) => d.label)) { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); devs = await navigator.mediaDevices.enumerateDevices(); } catch {} }
  return devs.filter((d) => d.kind === kind && d.deviceId !== 'default' && d.deviceId !== 'communications');
}
async function deviceMenu(e, kind) {
  e.preventDefault();
  const pos = { clientX: e.clientX, clientY: e.clientY, preventDefault() {}, stopPropagation() {} };
  const devs = await listDevices(kind);
  const cur = kind === 'audioinput' ? settings.inputDevice : settings.outputDevice;
  const item = (id, label) => `<div class="ctx-item dev ${id === cur ? 'sel' : ''}" data-dev="${esc(id)}"><span>${esc(label)}</span>${id === cur ? icon('check', 16) : ''}</div>`;
  const extra = kind === 'audioinput'
    ? `<div class="ctx-sep"></div><div class="ctx-label"><span>Volume do microfone</span><span id="dm-v">${settings.micGain}%</span></div><div class="ctx-row"><input type="range" min="0" max="200" value="${settings.micGain}" id="dm-g"></div>`
    : '';
  showMenu(pos, `<div class="ctx-title">${kind === 'audioinput' ? 'Microfone' : 'Saída de áudio'}</div>
    ${item('default', 'Padrão do Windows')}${devs.map((d) => item(d.deviceId, d.label || 'Dispositivo')).join('')}${extra}
    <div class="ctx-sep"></div><div class="ctx-item" id="dm-set"><span>Configurações de voz</span>${icon('settings', 16)}</div>`, (menu) => {
    $$('.dev', menu).forEach((el) => el.onclick = async () => {
      hideMenu();
      if (kind === 'audioinput') { settings.inputDevice = el.dataset.dev; saveSettings(); if (V.src) { try { await openMic(); toast('Microfone trocado', 'ok', 1500); } catch (err) { toast('Microfone: ' + err.message, 'err'); } } }
      else { settings.outputDevice = el.dataset.dev; saveSettings(); applyOutputDevice(); toast('Saída trocada', 'ok', 1500); }
    });
    const g = $('#dm-g', menu);
    if (g) g.oninput = (ev) => { settings.micGain = +ev.target.value; $('#dm-v', menu).textContent = ev.target.value + '%'; if (V.micGain) V.micGain.gain.value = settings.micGain / 100; saveSettings(); };
    $('#dm-set', menu).onclick = () => { hideMenu(); openSettings(); };
  });
}

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#ctx-menu')) hideMenu();
  if (!e.target.closest('#room-menu, #room-header')) $('#room-menu').classList.add('hidden');
  if (!e.target.closest('#mention-pop, #input')) hideMentionPop();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideMenu(); $('.lightbox')?.remove(); } });

// ---------------- Canais ----------------
async function createChannel(type) {
  const r = await promptModal(type === 'text' ? 'Criar canal de texto' : 'Criar canal de voz', { placeholder: type === 'text' ? 'novo-canal' : 'Jogando', ok: 'Criar' });
  if (r && r.value) wsSend({ t: 'ch-create', type, name: r.value });
}
function channelMenu(e, id) {
  const c = chanById(id); if (!c) return;
  showMenu(e, `<div class="ctx-title">${c.type === 'text' ? '#' : ''}${esc(c.name)}</div>
    <div class="ctx-item" data-a="rename"><span>Editar nome</span>${icon('edit', 16)}</div>
    ${c.type === 'text' ? `<div class="ctx-item" data-a="read"><span>Marcar como lido</span>${icon('check', 16)}</div>` : `<div class="ctx-item" data-a="join"><span>Entrar</span>${icon('volume', 16)}</div>`}
    <div class="ctx-sep"></div><div class="ctx-item danger" data-a="del"><span>Excluir canal</span>${icon('trash', 16)}</div>`, (menu) => {
    $$('[data-a]', menu).forEach((el) => el.onclick = async () => {
      hideMenu();
      const a = el.dataset.a;
      if (a === 'rename') { const r = await promptModal('Editar canal', { value: c.name }); if (r && r.value && r.value !== c.name) wsSend({ t: 'ch-rename', id, name: r.value }); }
      if (a === 'read') { S.unread.delete(id); renderChannels(); }
      if (a === 'join') joinVoice(id);
      if (a === 'del' && await confirmModal('Excluir canal', `Excluir <b>${esc(c.name)}</b>?${c.type === 'text' ? ' As mensagens dele somem pra todo mundo.' : ''}`, 'Excluir')) wsSend({ t: 'ch-delete', id });
    });
  });
}
function selectTextChannel(id) {
  roomUI?.open('chat');
  if (S.textChannel === id) { $('#input').focus(); return; }
  S.textChannel = id; S.unread.delete(id); S.typing.clear();
  cancelReply(); S.editing = null;
  renderChannels(); renderMessages(); renderTyping();
  $('#input').focus();
}
// Topo do chat (2.1.5): pilha de avatares de quem está na sala, como no design de referência.
function renderChatOnline() {
  const box = $('#chat-online'); if (!box) return;
  const people = [...S.users.values()].filter((u) => u.id !== DJ_ID), shown = people.slice(0, 4), more = people.length - shown.length;
  box.innerHTML = people.length ? `<span class="co-stack">${shown.map((u) => avatarHTML(u)).join('')}${more > 0 ? `<i class="co-more">+${more}</i>` : ''}</span><span class="co-label">${people.length} na sala</span>` : '';
  box.title = people.map((u) => u.name).join(', ');
}
function renderChatHeader() {
  renderChatOnline();
  const c = chanById(S.textChannel);
  $('#chat-title').textContent = c ? c.name : '';
  $('#input').placeholder = c ? `Conversar em #${c.name}` : '';
  $('#drop-ch').textContent = c ? '#' + c.name : '';
}

// ---------------- Chat ----------------
function linkify(text, mentions) {
  let h = esc(text);
  const blocks = [];
  h = h.replace(/```(?:\w+\n)?([\s\S]*?)```/g, (_, c) => { blocks.push(`<pre>${c.replace(/^\n/, '')}</pre>`); return `\u0000${blocks.length - 1}\u0000`; });
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  h = h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="#" data-href="$1">$1</a>');
  h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  // Menções: nomes conhecidos (podem ter espaço) e @todos
  const names = [...new Set([...(mentions || []), ...[...S.users.values()].map((u) => u.name), 'todos'])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of names) {
    const re = new RegExp('@' + esc(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'giu');
    h = h.replace(re, (mm) => `<span class="mention ${n.toLowerCase() === me.name.toLowerCase() || n === 'todos' ? 'me' : ''}">${mm}</span>`);
  }
  h = h.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
  return h;
}
const fileUrl = (a, dl) => `${S.base}${a.url}?t=${S.token}${dl ? '&dl=1' : ''}`;
function attHTML(a) {
  if(a.unavailable)return `<div class="att-file unavailable">${icon('file',30)}<div class="fi"><div class="fn" title="${esc(a.name)}">${esc(a.name)}</div><p class="muted small">Arquivo não disponível neste anfitrião. Peça para enviar novamente.</p></div></div>`;
  const url = fileUrl(a);
  const t = a.type || '';
  if (t.startsWith('image/')) return `<img class="att-img" src="${url}" data-full="${url}" data-name="${esc(a.name)}" data-dl="${fileUrl(a, 1)}" loading="lazy" alt="${esc(a.name)}">`;
  if (t.startsWith('video/')) return `<video class="att-video" src="${url}" controls preload="metadata"></video>`;
  const audio = t.startsWith('audio/') ? `<audio controls preload="none" src="${url}"></audio>` : '';
  return `<div class="att-file">${icon('file', 30)}<div class="fi"><div class="fn att-dl" data-dl="${fileUrl(a, 1)}" title="${esc(a.name)} · clique para baixar">${esc(a.name)}</div><div class="fs">${fmtSize(a.size)}</div>${audio}</div><span class="icon-btn att-dl" data-dl="${fileUrl(a, 1)}" title="Baixar">${icon('download', 20)}</span></div>`;
}
const curMessages = () => S.history[S.textChannel] || [];
function msgHTML(m, prev) {
  const grouped = !m.replyTo && prev && prev.userId === m.userId && prev.name === m.name && m.ts - prev.ts < 7 * 60000;
  const u = S.users.get(m.userId) || m;
  const mine = m.userId === S.myId;
  const canDel = mine || S.isHost;
  const tools = `<div class="msg-tools">
    <button data-mt="reply" title="Responder">${icon('reply', 18)}</button>
    ${!m.bot && !mine ? `<button data-mt="mention" title="Mencionar">${icon('at', 18)}</button>` : ''}
    ${mine ? `<button data-mt="edit" title="Editar">${icon('edit', 18)}</button>` : ''}
    ${canDel ? `<button data-mt="delete" class="danger" title="Excluir">${icon('trash', 18)}</button>` : ''}</div>`;
  const edited = m.editedAt ? '<span class="edited" title="' + esc(fmtTime(m.editedAt)) + '">(editado)</span>' : '';
  const body = `${m.text ? `<div class="text">${linkify(m.text, m.mentions)}${edited}</div>` : ''}${m.attachments && m.attachments.length ? `<div class="atts">${m.attachments.map(attHTML).join('')}</div>` : ''}`;
  const cls = `msg ${mine ? 'mine' : ''} ${mentionsMe(m) ? 'mentioned' : ''} ${m.bot ? 'bot' : ''}`;
  const reply = m.replyTo ? `<div class="reply-ref" data-jump="${esc(m.replyTo.id)}">${icon('reply', 14)}<b style="color:${esc(m.replyTo.color)}">@${esc(m.replyTo.name)}</b><span>${esc(m.replyTo.text)}</span></div>` : '';
  if (grouped) return `<div class="${cls}" data-id="${esc(m.id)}"><span class="hover-time">${new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>${body}${tools}</div>`;
  return `<div class="${cls} head" data-id="${esc(m.id)}">${reply}${avatarHTML({ id: m.bot ? DJ_ID : m.userId, bot: m.bot, name: m.name, color: m.color, avatar: u.avatar })}<div class="meta"><span class="author" style="color:${esc(m.color)}">${m.bot ? esc(m.name) : nameHTML({ ...(S.users.get(m.userId) || {}), name: m.name })}</span>${m.bot ? '<span class="tag bot">BOT</span>' : ''}<span class="time">${fmtTime(m.ts)}</span></div>${body}${tools}</div>`;
}
function renderMessages(keepScroll) {
  renderChatHeader();
  const box = $('#messages');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const prevTop = box.scrollTop;
  const c = chanById(S.textChannel);
  const list = curMessages();
  let h = `<div class="welcome"><div class="big-hash">${icon('hash', 40)}</div><h1>Bem-vindo(a) a #${esc(c ? c.name : '')}!</h1><div class="muted">Início do canal #${esc(c ? c.name : '')}.</div></div>`;
  list.forEach((m, i) => { h += msgHTML(m, list[i - 1]); });
  $('#msg-list').innerHTML = h;
  if (!keepScroll || atBottom) scrollBottom(true); else box.scrollTop = prevTop;
}
// Redesenha só as mensagens desse autor (efeito/cor/avatar mudou), sem mexer na rolagem.
function refreshAuthor(uid) {
  const list = curMessages(); if (!list.some((m) => m.userId === uid)) return;
  list.forEach((m, i) => { if (m.userId === uid && !m.bot) { const el = $(`#msg-list .msg.head[data-id="${CSS.escape(m.id)}"]`); if (el) el.outerHTML = msgHTML(m, list[i - 1]); } });
}
function rerenderMsg(id) {
  const list = curMessages();
  const i = list.findIndex((m) => m.id === id);
  const el = $(`#msg-list .msg[data-id="${CSS.escape(id)}"]`);
  if (i < 0 || !el) return;
  el.outerHTML = msgHTML(list[i], list[i - 1]);
}
function appendMessage(m) {
  const box = $('#messages');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const list = curMessages();
  $('#msg-list').insertAdjacentHTML('beforeend', msgHTML(m, list[list.length - 2]));
  if (atBottom || m.userId === S.myId) scrollBottom(true);
}
function scrollBottom(force) {
  const box = $('#messages');
  box.scrollTop = box.scrollHeight;
  if (force) $$('img, video', $('#msg-list')).forEach((el) => { if (!el.dataset.sb) { el.dataset.sb = 1; el.addEventListener(el.tagName === 'IMG' ? 'load' : 'loadedmetadata', () => { if (box.scrollHeight - box.scrollTop - box.clientHeight < 500) box.scrollTop = box.scrollHeight; }, { once: true }); } });
}
function findMsg(id) { return curMessages().find((m) => m.id === id); }
function msgAction(action, id) {
  const m = findMsg(id); if (!m) return;
  if (action === 'reply') startReply(m);
  if (action === 'mention') insertMention(m.name);
  if (action === 'edit') startEdit(m);
  if (action === 'delete') deleteMsg(m);
  if (action === 'copy') copy(m.text || '');
}
async function deleteMsg(m) {
  if (await confirmModal('Excluir mensagem', 'Tem certeza? Ela some pra todo mundo.', 'Excluir')) wsSend({ t: 'delete', id: m.id });
}
function startReply(m) {
  S.replyTo = m;
  $('#reply-bar').innerHTML = `<span>Respondendo a <b style="color:${esc(m.color)}">${esc(m.name)}</b></span><button class="icon-btn small" id="reply-x">${icon('x', 16)}</button>`;
  $('#reply-bar').classList.remove('hidden');
  $('#reply-x').onclick = cancelReply;
  $('#input').focus();
}
function cancelReply() { S.replyTo = null; $('#reply-bar').classList.add('hidden'); }
function startEdit(m) {
  const el = $(`#msg-list .msg[data-id="${CSS.escape(m.id)}"]`); if (!el) return;
  S.editing = m.id;
  const textEl = el.querySelector('.text');
  const box = document.createElement('div'); box.className = 'edit-box';
  box.innerHTML = `<textarea rows="1">${esc(m.text || '')}</textarea><div class="muted small">Esc para <a data-e="cancel">cancelar</a> · Enter para <a data-e="save">salvar</a></div>`;
  if (textEl) textEl.replaceWith(box); else el.querySelector('.atts')?.before(box);
  const ta = box.querySelector('textarea');
  const size = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  size(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  const finish = (save) => {
    const v = ta.value.trim();
    S.editing = null;
    if (save && v !== (m.text || '')) wsSend({ t: 'edit', id: m.id, text: v, mentions: extractMentions(v) });
    rerenderMsg(m.id);
  };
  ta.oninput = size;
  ta.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  };
  box.onclick = (e) => { const a = e.target.closest('[data-e]'); if (a) finish(a.dataset.e === 'save'); };
}
function msgMenu(e, id) {
  const m = findMsg(id); if (!m) return;
  const mine = m.userId === S.myId;
  showMenu(e, `<div class="ctx-item" data-a="reply"><span>Responder</span>${icon('reply', 16)}</div>
    ${!m.bot && !mine ? `<div class="ctx-item" data-a="mention"><span>Mencionar ${esc(m.name)}</span>${icon('at', 16)}</div>` : ''}
    ${mine ? `<div class="ctx-item" data-a="edit"><span>Editar mensagem</span>${icon('edit', 16)}</div>` : ''}
    ${m.text ? `<div class="ctx-item" data-a="copy"><span>Copiar texto</span>${icon('copy', 16)}</div>` : ''}
    ${mine || S.isHost ? `<div class="ctx-sep"></div><div class="ctx-item danger" data-a="delete"><span>Excluir mensagem</span>${icon('trash', 16)}</div>` : ''}`, (menu) => {
    $$('[data-a]', menu).forEach((el) => el.onclick = () => { hideMenu(); msgAction(el.dataset.a, id); });
  });
}
$('#msg-list').addEventListener('click', (e) => {
  const mt = e.target.closest('[data-mt]');
  if (mt) { msgAction(mt.dataset.mt, mt.closest('.msg').dataset.id); return; }
  const jump = e.target.closest('[data-jump]');
  if (jump) { const el = $(`#msg-list .msg[data-id="${CSS.escape(jump.dataset.jump)}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); } return; }
  const a = e.target.closest('a[data-href]');
  if (a) { e.preventDefault(); if (native) native.openExternal(a.dataset.href); else window.open(a.dataset.href); return; }
  const dl = e.target.closest('.att-dl');
  if (dl) { if (native) native.download(dl.dataset.dl); else window.open(dl.dataset.dl); return; }
  const img = e.target.closest('.att-img');
  if (img) {
    const lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = `<img src="${img.dataset.full}"><a>Baixar ${esc(img.dataset.name)}</a>`;
    lb.onclick = (ev) => { if (ev.target.tagName === 'A') { if (native) native.download(img.dataset.dl); else window.open(img.dataset.dl); } lb.remove(); };
    document.body.appendChild(lb);
    return;
  }
  const au = e.target.closest('.msg .avatar, .msg .author');
  if (au) { const m = findMsg(au.closest('.msg').dataset.id); if (m && m.bot) return openDJPanel(); if (m && S.users.has(m.userId)) userMenu(e, m.userId); }
});
$('#msg-list').addEventListener('error', (e) => {
  // anexo que falhou durante a troca de anfitrião: tenta de novo com o endereço atual
  const el = e.target; if (!el.matches || !el.matches('.att-img, .att-video')) return;
  const n = +(el.dataset.retry || 0); if (n >= 4) return;
  el.dataset.retry = n + 1;
  setTimeout(() => { const u = new URL(el.src); const cur = new URL(S.base || u.origin); u.host = cur.host; u.searchParams.set('t', S.token); u.searchParams.set('r', n + 1); el.src = u.toString(); }, 1500 * (n + 1));
}, true);
$('#msg-list').addEventListener('contextmenu', (e) => {
  const el = e.target.closest('.msg'); if (!el || e.target.closest('.edit-box')) return;
  if (e.target.closest('a, img, video, audio')) return;
  msgMenu(e, el.dataset.id);
});

function renderTyping() {
  const names = [...S.typing.keys()].map((id) => S.users.get(id)?.name).filter(Boolean);
  $('#typing').innerHTML = !names.length ? '' : names.length === 1 ? `<b>${esc(names[0])}</b> está digitando...` : names.length < 4 ? `<b>${names.map(esc).join(', ')}</b> estão digitando...` : 'Várias pessoas estão digitando...';
}

// ---------- Menções (@) ----------
const input = $('#input');
let mentionState = null; // { start, items, sel }
function mentionCandidates() {
  const names = [...new Set([...S.users.values()].filter((u) => u.id !== DJ_ID).map((u) => u.name))];
  return [...names.map((n) => ({ name: n, u: [...S.users.values()].find((x) => x.name === n) })), { name: 'todos', u: null }];
}
function updateMentionPop() {
  const pos = input.selectionStart;
  const before = input.value.slice(0, pos);
  const m = /(^|\s)@([^\s@]{0,32})$/.exec(before);
  if (!m) return hideMentionPop();
  const q = m[2].toLowerCase();
  const items = mentionCandidates().filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  if (!items.length) return hideMentionPop();
  mentionState = { start: pos - m[2].length - 1, items, sel: mentionState && mentionState.items.length === items.length ? Math.min(mentionState.sel, items.length - 1) : 0 };
  const pop = $('#mention-pop');
  pop.innerHTML = `<div class="mp-title">Membros</div>` + items.map((c, i) => `<div class="mp-item ${i === mentionState.sel ? 'sel' : ''}" data-i="${i}">${c.u ? avatarHTML(c.u) : `<div class="avatar at-all">${icon('at', 16)}</div>`}<span>${esc(c.name)}</span>${c.u ? '' : '<span class="muted small">avisa todo mundo</span>'}</div>`).join('');
  pop.classList.remove('hidden');
  $$('.mp-item', pop).forEach((el) => el.onmousedown = (e) => { e.preventDefault(); pickMention(+el.dataset.i); });
}
function hideMentionPop() { mentionState = null; $('#mention-pop').classList.add('hidden'); }
function pickMention(i) {
  const c = mentionState.items[i];
  const after = input.value.slice(input.selectionStart);
  input.value = input.value.slice(0, mentionState.start) + '@' + c.name + ' ' + after;
  const p = mentionState.start + c.name.length + 2;
  input.setSelectionRange(p, p);
  hideMentionPop(); autosize(); input.focus();
}
function insertMention(name) {
  const v = input.value;
  input.value = (v && !/\s$/.test(v) ? v + ' ' : v) + '@' + name + ' ';
  autosize(); input.focus(); input.setSelectionRange(input.value.length, input.value.length);
}
function extractMentions(text) {
  const out = [];
  for (const c of mentionCandidates()) if (new RegExp('@' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'iu').test(text)) out.push(c.name);
  return out;
}

// ---------- Composer ----------
const pending = [];
let sending = false, lastTyping = 0;
function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, innerHeight * 0.4) + 'px'; }
input.addEventListener('input', () => {
  autosize();
  updateMentionPop();
  if (input.value && Date.now() - lastTyping > 3000) { lastTyping = Date.now(); wsSend({ t: 'typing', channelId: S.textChannel }); }
});
input.addEventListener('click', updateMentionPop);
input.addEventListener('keydown', (e) => {
  if (mentionState) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); mentionState.sel = (mentionState.sel + (e.key === 'ArrowDown' ? 1 : -1) + mentionState.items.length) % mentionState.items.length; updateMentionPop(); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mentionState.sel); return; }
    if (e.key === 'Escape') { e.preventDefault(); hideMentionPop(); return; }
  }
  if (e.key === 'Escape' && S.replyTo) { cancelReply(); return; }
  if (e.key === 'ArrowUp' && !input.value) { // seta pra cima edita a última mensagem, igual Discord
    const last = [...curMessages()].reverse().find((m) => m.userId === S.myId && m.text);
    if (last) { e.preventDefault(); startEdit(last); }
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
});
input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); files.forEach(addPending); }
});
$('#btn-attach').onclick = () => $('#file-input').click();
$('#file-input').onchange = () => { [...$('#file-input').files].forEach(addPending); $('#file-input').value = ''; input.focus(); };
function addPending(file) {
  if (pending.length >= 10) return toast('Máximo de 10 arquivos por mensagem.');
  if (file.size > 2 * 1024 ** 3) return toast(`${file.name} passa de 2 GB.`, 'err');
  const item = { file, url: null };
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) item.url = URL.createObjectURL(file);
  const el = document.createElement('div'); el.className = 'pf';
  const thumb = file.type.startsWith('image/') ? `<div class="thumb" style="background-image:url(${item.url})"></div>` : file.type.startsWith('video/') ? `<div class="thumb"><video src="${item.url}" muted style="max-width:100%;max-height:100%"></video></div>` : `<div class="thumb">${icon('file', 36)}</div>`;
  el.innerHTML = `${thumb}<div class="nm" title="${esc(file.name)}">${esc(file.name)}</div><div class="muted">${fmtSize(file.size)}</div><div class="bar"><div></div></div><button class="rm" title="Remover">${icon('x', 16)}</button>`;
  el.querySelector('.rm').onclick = () => { if (sending) return; pending.splice(pending.indexOf(item), 1); el.remove(); if (item.url) URL.revokeObjectURL(item.url); };
  item.el = el;
  pending.push(item);
  $('#pending-files').appendChild(el);
}
function upload(item) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `${S.base}/upload?t=${S.token}&name=${encodeURIComponent(item.file.name)}`);
    x.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
    x.upload.onprogress = (e) => { if (e.lengthComputable) item.el.querySelector('.bar div').style.width = (e.loaded / e.total * 100) + '%'; };
    x.onload = () => { try { const r = JSON.parse(x.responseText); if (x.status === 200) resolve(r); else reject(new Error(r.error)); } catch (e) { reject(e); } };
    x.onerror = () => reject(new Error('falha de rede'));
    x.send(item.file);
  });
}
async function sendMessage() {
  if (sending) return;
  const text = input.value.trim();
  if (!text && !pending.length) return;
  if (!S.ws || S.ws.readyState !== 1) return toast('Sem conexão com a sala.', 'err');
  sending = true;
  const atts = [];
  try {
    for (const item of pending) atts.push(await upload(item));
  } catch (e) { sending = false; return toast('Falha no envio: ' + e.message, 'err'); }
  try {
    const payload = { channelId: S.textChannel, text, attachments: atts.map((a) => ({ id: a.id })), replyTo: S.replyTo ? S.replyTo.id : null, mentions: extractMentions(text) };
    if(!WEB_VIEWER && !(S.features||[]).includes('chat-ack')) { if(!wsSend({t:'chat',...payload})) throw new Error('Sem conexão com a sala.'); }
    else await sendCommand('chat', payload);
  } catch(e) { sending=false; toast(e.message,'err',7000); return; }
  pending.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  pending.length = 0; $('#pending-files').innerHTML = '';
  if(input.value.trim()===text) input.value = ''; autosize(); cancelReply(); hideMentionPop();
  sending = false;
}
let dragDepth = 0;
const chatEl = $('#chat');
chatEl.addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files')) { dragDepth++; $('#drop-overlay').classList.remove('hidden'); } });
chatEl.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop-overlay').classList.add('hidden'); } });
chatEl.addEventListener('dragover', (e) => e.preventDefault());
chatEl.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; $('#drop-overlay').classList.add('hidden'); [...e.dataTransfer.files].forEach(addPending); input.focus(); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// ---------------- DJ Resenha ----------------
function djHere() { return !!(S.dj && S.dj.active && V.joined && S.dj.channelId === V.channel); }
function ensureDJNodes() {
  if (V.djAudio || !V.ctx) return;
  const a = new Audio(); a.crossOrigin = 'anonymous'; a.preload = 'auto';
  V.djAudio = a;
  const src = V.ctx.createMediaElementSource(a);
  V.djGain = V.ctx.createGain();
  V.djAnalyser = V.ctx.createAnalyser(); V.djAnalyser.fftSize = 512;
  src.connect(V.djGain); V.djGain.connect(V.master); V.djGain.connect(V.djAnalyser);
  applyUserVolume(DJ_ID);
  a.onended = () => { if (S.dj && S.dj.current && !S.dj.current.duration) wsSend({ t: 'dj-ended', id: S.dj.current.id }); };
}
function stopDJAudio() {
  if (V.djAudio) { V.djAudio.pause(); V.djAudio.removeAttribute('src'); V.djAudio.load(); }
  V.djTrack = null; V.speaking.delete(DJ_ID);
}
function syncDJ() {
  const cur = S.dj && S.dj.current;
  if (!djHere() || !cur) { stopDJAudio(); return; }
  ensureDJNodes();
  const a = V.djAudio;
  const url = `${S.base}${cur.url}?t=${S.token}`;
  const pos = () => ((cur.pausedAt || serverNow()) - cur.startedAt) / 1000;
  if (V.djTrack !== cur.id) {
    V.djTrack = cur.id;
    a.src = url;
    const start = () => {
      const p = pos();
      if (p < 0) { a.currentTime = 0; setTimeout(() => { if (V.djTrack === cur.id && !cur.pausedAt) a.play().catch(() => {}); }, -p * 1000); return; }
      a.currentTime = p;
      if (!cur.pausedAt) a.play().catch(() => {});
    };
    if (a.readyState >= 1) start(); else a.addEventListener('loadedmetadata', start, { once: true });
    return;
  }
  if (cur.pausedAt) { a.pause(); return; }
  const p = pos();
  if (a.readyState >= 1 && p >= 0 && Math.abs(a.currentTime - p) > 1.5) a.currentTime = p;
  if (a.paused && p >= 0) a.play().catch(() => {});
}
function summonDJ() {
  if (!V.joined) return toast('Entre numa call primeiro.');
  wsSend({ t: 'dj-summon', textChannel: S.textChannel });
  setTimeout(openDJPanel, 300);
}
let djPanel = null;
function openDJPanel() {
  if (!S.dj || !S.dj.active) return summonDJ();
  if (djPanel) return;
  djPanel = openModal(`<header><div><h2>${icon('music', 20)} DJ Resenha</h2><p>Cole um link do YouTube ou Spotify (música, playlist ou álbum), ou o nome da música.</p></div><button class="icon-btn" data-close>${icon('x')}</button></header>
    <div class="body"><div class="dj-add"><input id="dj-in" placeholder="https://youtube.com/... ou https://open.spotify.com/... ou nome da música" autocomplete="off"><button class="btn primary" id="dj-go">Adicionar</button></div><div id="dj-body"></div></div>`, { wide: true, cls: 'dj-modal', onClose: () => { djPanel = null; } });
  const go = () => { const v = $('#dj-in', djPanel.el).value.trim(); if (!v) return; wsSend({ t: 'dj-add', input: v }); $('#dj-in', djPanel.el).value = ''; };
  $('#dj-go', djPanel.el).onclick = go;
  $('#dj-in', djPanel.el).onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('#dj-in', djPanel.el).focus();
  renderDJPanel();
}
function renderDJPanel() {
  if (!djPanel) return;
  const d = S.dj;
  if (!d || !d.active) { djPanel.close(); return; }
  const here = djHere();
  const cur = d.current;
  const inCh = V.joined && V.channel === d.channelId;

  const q = d.queue;
  $('#dj-body', djPanel.el).innerHTML = `
    ${!here ? `<div class="dj-warn">O DJ está em <b>${esc(chanById(d.channelId)?.name || '')}</b>. ${V.joined ? `<a data-dj="move">Trazer pra minha call</a>` : 'Entre na call pra ouvir.'}</div>` : ''}
    <div class="dj-now-card">
      <div class="dj-disc ${cur && !cur.pausedAt ? 'spin' : ''}">${icon('music', 26)}</div>
      <div class="dj-info">
        <div class="dj-t">${cur ? esc(cur.title) : d.loading ? 'Carregando música...' : 'Nada tocando'}</div>
        <div class="muted small">${cur ? `Adicionada por ${esc(cur.addedBy || '?')}` : q.length ? '' : 'Adicione uma música aí em cima'}</div>
        <div class="dj-prog"><div class="dj-bar"><div id="dj-fill"></div></div><span id="dj-time" class="small muted"></span></div>
      </div>
    </div>
    <div class="dj-actions">
      <button class="btn" data-dj="pause" ${!cur || !inCh ? 'disabled' : ''}>${icon(cur && cur.pausedAt ? 'play' : 'pause', 16)} ${cur && cur.pausedAt ? 'Continuar' : 'Pausar'}</button>
      <button class="btn" data-dj="skip" ${(!cur && !d.loading) || !inCh ? 'disabled' : ''}>${icon('skip', 16)} Pular música</button>
      <button class="btn" data-dj="kick" ${!inCh ? 'disabled' : ''}>${icon('logout', 16)} Remover DJ</button>
    </div>
    <div class="dj-vol"><span class="small muted">Volume do DJ pra você</span><input type="range" min="0" max="200" value="${settings.userVolumes[DJ_NAME] ?? 100}" id="dj-vol"><span class="small" id="dj-vol-v">${settings.userVolumes[DJ_NAME] ?? 100}%</span></div>
    <div class="section-title">Fila (${q.length})</div>
    <div class="dj-queue">${q.length ? q.map((it, i) => `<div class="dj-item"><span class="n">${i + 1}</span><div class="dj-it"><div>${esc(it.title)}</div><div class="muted small">${it.duration ? fmtDur(it.duration * 1000) + ' · ' : ''}${esc(it.addedBy || '')}${it.source === 'spotify' ? ' · Spotify' : ''}</div></div>${inCh ? `<button class="icon-btn small" data-rm="${esc(it.id)}" title="Tirar da fila">${icon('x', 14)}</button>` : ''}</div>`).join('') : '<div class="muted small">Fila vazia</div>'}</div>
    ${(d.failed || []).length ? `<div class="section-title">Não encontradas (${d.failed.length})</div><div class="dj-queue">${d.failed.map((it) => `<div class="dj-item"><div class="dj-it"><div>${esc(it.title)}</div><div class="muted small">${esc(it.error)}</div></div><button class="btn" data-retry="${esc(it.id)}" ${!inCh ? 'disabled' : ''}>Tentar novamente</button></div>`).join('')}</div>` : ''}
    ${S.djBusy ? '<div class="muted small dj-busy">Buscando música...</div>' : ''}`;
  $$('[data-dj]', djPanel.el).forEach((b) => b.onclick = () => {
    const a = b.dataset.dj;
    if (a === 'pause') djCommand('dj-pause');
    if (a === 'skip') djCommand('dj-skip');
    if (a === 'kick') djCommand('dj-kick');
    if (a === 'move') wsSend({ t: 'dj-summon', textChannel: S.textChannel });
  });
  $$('[data-retry]', djPanel.el).forEach((b) => b.onclick = () => djCommand('dj-retry', { id: b.dataset.retry }));
  $$('[data-rm]', djPanel.el).forEach((b) => b.onclick = () => djCommand('dj-remove', { id: b.dataset.rm }));
  $('#dj-vol', djPanel.el).oninput = (e) => { settings.userVolumes[DJ_NAME] = +e.target.value; $('#dj-vol-v', djPanel.el).textContent = e.target.value + '%'; applyUserVolume(DJ_ID); saveSettings(); };
  updateDJProgress();
}
function updateDJProgress() {
  if (!djPanel || !S.dj || !S.dj.current) return;
  const c = S.dj.current;
  const el = serverNow() - c.startedAt, t = Math.max(0, ((c.pausedAt || serverNow()) - c.startedAt) / 1000);
  const f = $('#dj-fill', djPanel.el), tm = $('#dj-time', djPanel.el);
  if (f) f.style.width = c.duration ? clamp(t / c.duration * 100, 0, 100) + '%' : '0';
  if (tm) tm.textContent = el < 0 ? 'começando...' : fmtDur(t * 1000) + (c.duration ? ' / ' + fmtDur(c.duration * 1000) : '');
}

// ---------------- Diagnóstico local de desempenho ----------------
function openPerformance() {
  let timer=null,busy=false,generation=0;
  const report={schema:1,scenario:'call',serverVersion:S.serverVersion || null,features:S.features || [],system:null,samples:[],commands:[]};
  const m=openModal(`<header><div><h2>Desempenho</h2><p>Meça durante a call e durante a transmissão.</p></div><button class="icon-btn" data-close>${icon('x')}</button></header><div class="body"><div class="field"><label>Cenário</label><select id="perf-scenario"><option value="call">Só chamada</option><option value="720p30">Live 720p30</option><option value="720p60">Live 720p60</option><option value="1080p60">Live 1080p60</option><option value="custom">Outro</option></select></div><p class="muted small">Não altera a qualidade da transmissão. Escolha o cenário que você está medindo.</p><div class="perf-summary" id="perf-summary">Coleta parada</div><p class="muted small">Anfitrião: ${esc(S.serverVersion || 'versão não informada')} · ${V.screenSenders.size} espectadores recebendo sua tela</p><div class="row"><button class="btn primary" id="perf-start">Coletar por 60 segundos</button><button class="btn" id="perf-export">Exportar relatório</button></div><p class="muted small">O relatório contém hardware, consumo dos processos, estatísticas de vídeo e status dos comandos. Mensagens, áudio e endereços de rede ficam de fora.</p></div>`,{onClose:()=>{generation++;clearInterval(timer);}});
  const summary=$('#perf-summary',m.el);
  const sample=async()=>{
    if(busy)return;busy=true;const run=generation;
    try{
      const nativeSample=native ? await native.performanceSample() : {system:{platform:'web',userAgent:navigator.userAgent},processes:[]};
      const media=await window.readMediaStats(V.peers);
      if(run!==generation || !document.body.contains(m.el))return;
      report.system=nativeSample.system;
      report.samples.push({at:Date.now(),processes:nativeSample.processes,media,sharing:!!V.screen,quality:V.screenQ || null,viewers:V.screenSenders.size,watched:V.watching.size});
      const memory=nativeSample.processes.reduce((total,p)=>total+(p.workingSetKB || 0),0)/1024;
      summary.textContent=`${report.samples.length}/60 amostras · RAM somada dos processos: ${memory ? Math.round(memory)+' MB' : 'indisponível no navegador'} · ${media.filter(s=>s.type==='outbound-rtp').length} envios de vídeo`;
      if(report.samples.length>=60){clearInterval(timer);timer=null;$('#perf-start',m.el).disabled=false;}
    }catch(e){summary.textContent=e.message;}finally{busy=false;}
  };
  $('#perf-start',m.el).onclick=()=>{if(timer)return;report.samples=[];report.scenario=$('#perf-scenario',m.el).value;$('#perf-start',m.el).disabled=true;sample();timer=setInterval(sample,1000);};
  $('#perf-export',m.el).onclick=async()=>{
    if(!report.samples.length)await sample();report.commands=[...commandTrace];
    if(native)return native.savePerformance(report);
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='resenha-desempenho.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
}

// ---------------- Convite ----------------
async function openInvite() {
  const m = openModal(`<header><div><h2>Convidar amigos para ${esc(S.roomName)}</h2><p>Mande o código pro seu amigo.</p></div><button class="icon-btn" data-close>${icon('x')}</button></header>
    <div class="body"><div class="addr-list" id="inv-list"><div class="muted">Verificando sua rede...</div></div></div>
    <footer><button class="btn primary" data-close>Pronto</button></footer>`, { wide: true });
  const codeHTML = S.code ? `<div class="code-box"><div class="muted small" style="font-weight:700;text-transform:uppercase;margin-bottom:6px">Código da sala</div><div class="code">${esc(S.code)}</div><button class="btn primary" data-copy="${esc(S.code)}">Copiar código</button><div class="note">Seu amigo abre o Resenha, cola esse código em <b>Entrar numa sala</b> e pronto. Funciona pela internet sem abrir porta e sem Radmin. O código é o mesmo sempre que você abrir a sala com esse nome.</div></div><div id="inv-pwa"></div>` : '';
  // Celular ou tablet em qualquer rede: o PWA abre já com o código da sala.
  if (S.code && native?.pwaInvite) native.pwaInvite(S.code).then((p) => { const box = $('#inv-pwa', m.el); if (!p || !box) return; box.innerHTML = `<div class="addr pwa-invite"><h3>Celular ou tablet · qualquer rede</h3><img width="180" height="180" src="${p.qr}" alt="QR code para entrar pelo celular"><p>Aponte a câmera do celular ou mande o link. Abre no navegador, já com o código; dá para adicionar à tela inicial. Dá para falar e assistir às lives.</p><code>${esc(p.url)}</code><button class="btn" data-copy="${esc(p.url)}">Copiar link</button></div>`; bindCopy(box); });
  if (!S.isHost) {
    $('#inv-list', m.el).innerHTML = codeHTML || addrBlock('Endereço da sala', S.addr.text, 'É o mesmo endereço que você usou. Só funciona enquanto o anfitrião estiver com a sala aberta.');
    bindCopy(m.el); return;
  }
  $('#inv-list', m.el).innerHTML = codeHTML + '<div id="inv-web"></div><details class="more"><summary>Outras formas de entrar (IP)</summary><div class="addr-list" id="inv-ip"><div class="muted">Verificando sua rede...</div></div></details>';
  bindCopy(m.el);
  const mobile = await native.mobileAccess();
  if (document.body.contains(m.el)) {
    $('#inv-web',m.el).innerHTML = mobile?.error ? `<p>${esc(mobile.error)}</p>` : (mobile?.links||[]).map(x=>`<div class="addr"><h3>Celular · mesmo Wi-Fi</h3><img width="200" height="200" src="${x.qr}" alt="QR code para configurar o Resenha no celular"><p>Escaneie para configurar o certificado local e entrar. O anfitrião precisa continuar com a sala aberta.</p><code>${esc(x.setup)}</code><button class="btn" data-copy="${esc(x.setup)}">Copiar acesso</button><details><summary>Identidade do certificado</summary><code>${esc(mobile.fingerprint)}</code><p>Confie somente no certificado deste anfitrião. A instalação permite confiar em certificados assinados por ele; remova a confiança quando não usar mais.</p></details></div>`).join('');
    bindCopy($('#inv-web',m.el));
  }
  const n = await native.hostNetwork();
  if (!n || !document.body.contains(m.el)) return;
  const port = n.port;
  let h = '';
  if (n.publicV4) {
    let note, cls;
    if (n.cgnat) { cls = 'bad'; note = 'Sua internet usa CGNAT (IP compartilhado da operadora), então por IP não dá. Use o código.'; }
    else if (n.upnp.ok) { cls = 'ok'; note = 'Porta aberta automaticamente no roteador (UPnP). Deve funcionar direto.'; }
    else { cls = 'warn'; note = `Não consegui abrir a porta sozinho (${esc(n.upnp.error || 'UPnP indisponível')}). Entre no roteador e redirecione <b>TCP e UDP ${port}</b> para <b>${esc(n.lan[0] || 'este PC')}</b>.`; }
    h += addrBlock('Pela internet (IPv4)', `${n.publicV4}:${port}`, note, cls);
  }
  if (n.publicV6) h += addrBlock('Pela internet (IPv6)', `[${n.publicV6}]:${port}`, 'Funciona se o amigo também tiver IPv6. Alguns roteadores bloqueiam entrada IPv6 no firewall.', '');
  for (const ip of n.lan) h += addrBlock('Mesma rede / mesmo Wi-Fi', `${ip}:${port}`, 'Pra quem está na sua casa.', '');
  for (const v of n.vpn) h += addrBlock('Rede virtual (Radmin, ZeroTier, Hamachi...)', `${v.split(' ')[0]}:${port}`, `Se vocês ainda usam essa rede: ${esc(v)}.`, '');
  h += '<p class="muted small" style="margin:4px 0 0">Entrar por IP só é necessário se o código não funcionar.</p>';
  $('#inv-ip', m.el).innerHTML = h;
  bindCopy($('#inv-ip', m.el));
}
function addrBlock(title, value, note, cls = '') {
  return `<div class="addr"><div class="t">${esc(title)}</div><div class="v"><code>${esc(value)}</code><button class="btn primary" data-copy="${esc(value)}">Copiar</button></div>${note ? `<div class="note ${cls}">${note}</div>` : ''}</div>`;
}
function bindCopy(root) { $$('[data-copy]', root).forEach((b) => b.onclick = () => { copy(b.dataset.copy); b.textContent = 'Copiado'; setTimeout(() => (b.textContent = 'Copiar'), 1500); }); }

// ---------------- Configurações ----------------
function bindPaletteCards(el) {
  $$('[data-palette]',el).forEach((b)=>b.onclick=()=>{settings.themeColor=b.dataset.palette;saveSettings();applyTheme(settings.theme,settings.themeColor);$$('[data-palette]',el).forEach((x)=>x.classList.toggle('sel',x===b));});
}
function openViewerSettings() {
  const m = openModal(`<header><div><h2>Seu Resenha</h2><p>Aparência e perfil</p></div><button class="icon-btn" data-close>${icon('x')}</button></header><div class="body"><div class="field"><label>Seu nome</label><input id="web-name" maxlength="32" value="${esc(me.name)}"></div><div class="field"><label>Cor</label><input id="web-color" type="color" value="${esc(me.color)}"></div><div class="section-title">Tema</div><div class="palette-grid">${window.paletteCards(settings.themeColor)}</div><div class="section-title">Aparência</div><div class="theme-grid">${Object.entries(THEMES).filter(([key]) => window.VISIBLE_THEMES.includes(key)).map(([k,t]) => `<button class="theme-card ${settings.theme === k ? 'sel' : ''}" data-web-theme="${k}">${esc(t.name)}</button>`).join('')}</div></div><footer><button class="btn primary" data-close>Pronto</button></footer>`);
  $('#web-name', m.el).onchange = (e) => { const name = e.target.value.trim(); if (name) { me.name = name; LS.set('profile',me); $('#home-name').value = name; sendProfile(); renderAll(); } };
  $('#web-color', m.el).oninput = (e) => { me.color=e.target.value; LS.set('profile',me); sendProfile(); renderAll(); };
  bindPaletteCards(m.el);
  $$('[data-web-theme]',m.el).forEach((b) => b.onclick = () => { settings.theme=b.dataset.webTheme; saveSettings(); applyTheme(settings.theme,settings.themeColor); $$('[data-web-theme]',m.el).forEach((x) => x.classList.toggle('sel',x===b)); });
}
async function openSettings(tab = 'voz') {
  if (WEB_VIEWER) return openViewerSettings();
  const inDevs = await listDevices('audioinput');
  const outDevs = await listDevices('audiooutput');
  const opt = (list, cur) => `<option value="default">Padrão do Windows</option>` + list.map((d) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || 'Dispositivo')}</option>`).join('');
  const fxBtns = Object.entries(FX).map(([k, f]) => `<button class="fx-btn ${settings.voiceFx === k ? 'sel' : ''}" data-fx="${k}">${esc(f.name)}${f.semis ? `<span>${f.semis > 0 ? '+' : ''}${f.semis}</span>` : ''}</button>`).join('');
  const m = openModal(`<header><div><h2>Configurações</h2></div><button class="icon-btn" data-close>${icon('x')}</button></header>
    <div class="body">
      <div class="tabs"><div class="tab" data-t="voz">Voz</div><div class="tab" data-t="filtros">Filtros de voz</div><div class="tab" data-t="aparencia">Aparência</div><div class="tab" data-t="perfil">Perfil</div>${native ? '<div class="tab" data-t="atalhos">Atalhos</div>' : ''}</div>
      <div class="tp" data-p="aparencia">
        <div class="section-title" style="margin-top:0">Tema</div><div class="theme-grid">${Object.entries(THEMES).filter(([key]) => window.VISIBLE_THEMES.includes(key)).map(([k, t]) => { const v = themePreview(k); return `<button class="theme-card ${settings.theme === k ? 'sel' : ''}" data-theme="${k}"><div class="tc-prev" style="background:${v['bg-rail']}"><i style="background:${v['bg-side']}"></i><i style="background:${v['bg-main']}"><b style="background:${v.blurple}"></b><s style="background:${v.muted}"></s><s style="background:${v.muted}"></s></i></div><span>${esc(t.name)}</span></button>`; }).join('')}</div>
        <div class="section-title">Ícone do app</div>
        <div class="icon-grid">${globalThis.PIPOCA ? Object.entries(PIPOCA.VARIANTS).map(([k, v]) => `<button class="icon-card ${settings.appIcon === k ? 'sel' : ''}" data-app-icon="${k}"><img src="${PIPOCA.dataURL(k, 64)}" alt=""><span>${esc(v.name)}</span></button>`).join('') : ''}</div>
        <div class="section-title">Layout</div>
        <div class="settings-grid">
          <div class="field"><label>Tamanho da interface <span id="st-fs-v">${settings.fontScale}%</span></label><input type="range" id="st-fs" min="85" max="125" step="5" value="${settings.fontScale}"></div>
          <div class="field"><label>Densidade</label><label class="check"><input type="checkbox" id="st-compact" ${settings.compact ? 'checked' : ''}> Modo compacto (mais coisa na tela)</label></div>
          ${native?.setWindowMaterial ? `<div class="field"><label>Janela</label><label class="check"><input type="checkbox" id="st-glass" ${settings.translucent !== false ? 'checked' : ''}> Janela translúcida (vidro do Windows 11 sobre o papel de parede)</label></div>` : ''}
          <div class="field"><label>Música</label><label class="check"><input type="checkbox" id="st-music" ${settings.music ? 'checked' : ''}> Player de música do Spotify (desligado, ele nem aparece)</label></div>
          <div class="field"><label>Animações</label><label class="check"><input type="checkbox" id="st-motion" ${settings.reduceMotion ? 'checked' : ''}> Reduzir animações (tudo muda na hora)</label></div>
        </div>
        <p class="muted small" style="margin:4px 0 10px">Dá para <b>segurar e arrastar</b> os canais da lista, os quadrados da call e a miniatura da tela. As bordas entre os painéis mudam a largura.</p>
        <button class="btn" id="st-reset-layout">Voltar layout ao padrão</button>
      </div>
      <div class="tp" data-p="perfil">
        <div class="home-profile" style="margin:0">
          <div class="avatar avatar-edit" id="st-av"></div>
          <div class="field grow"><label>Nome</label><input id="st-name" maxlength="32" value="${esc(me.name)}"></div>
          <div class="field"><label>Cor</label><input type="color" id="st-color" value="${esc(me.color)}"></div>
        </div>
        <div class="profile-editor">
          <div class="profile-fields">
            <div class="field"><label>Banner</label>
              <div class="swatches" id="st-bcolors">${BANNER_COLORS.map((c) => `<button class="swatch ${me.bannerColor === c ? 'sel' : ''}" data-c="${c}" style="background:${c}" aria-label="Cor do banner ${c}"></button>`).join('')}</div>
              <div class="row" style="gap:8px;margin-top:8px"><button class="btn" id="st-banner">Escolher foto ou GIF</button><button class="btn" id="st-banner-x">Remover imagem</button></div>
              <p class="muted small" style="margin:6px 0 0">Até 8 MB. GIFs ficam animados.</p></div>
            <div class="field"><label>Cor do nome</label>
              <div class="swatches" id="st-ncolors">${NAME_COLORS.map((c) => `<button class="swatch ${(me.nameColor || '') === c ? 'sel' : ''} ${c ? '' : 'none'}" data-c="${c}" style="background:${c || 'transparent'}" aria-label="${c ? 'Cor do nome ' + c : 'Cor padrão'}">${c ? '' : 'Aa'}</button>`).join('')}</div></div>
            <div class="field"><label>Efeito do nome</label>
              <div class="nfx-grid" id="st-nfx">${Object.entries(NAME_FX).map(([k, n]) => `<button class="nfx ${(me.nameFx || '') === k ? 'sel' : ''}" data-nfx="${k}" aria-pressed="${(me.nameFx || '') === k}"><span class="uname${k ? ' fx-' + k : ''}" style="--nc:${me.nameColor || 'var(--text-hi)'}" data-text="${esc(n)}">${esc(n)}</span></button>`).join('')}</div>
              <p class="muted small" style="margin:6px 0 0">Aparece na lista de voz, na call, no chat e no seu cartão.</p></div>
            <div class="field"><label for="st-status">Status</label><input id="st-status" maxlength="40" placeholder="🎮 jogando LoL" value="${esc(me.status || '')}"></div>
            <div class="field"><label for="st-bio">Recado</label><textarea id="st-bio" maxlength="140" rows="3" placeholder="Algo que a galera deve saber">${esc(me.bio || '')}</textarea></div>
          </div>
          <div class="profile-preview"><span class="muted small">Como a galera vê</span><div id="st-card"></div></div>
        </div>
      </div>
      <div class="tp" data-p="voz">
        <div class="settings-grid">
          <div class="field"><label>Microfone</label><select id="st-in">${opt(inDevs, settings.inputDevice)}</select></div>
          <div class="field"><label>Saída (fone/caixa)</label><select id="st-out">${opt(outDevs, settings.outputDevice)}</select></div>
          <div class="field"><label>Volume do microfone <span id="st-mg-v">${settings.micGain}%</span></label><input type="range" id="st-mg" min="0" max="200" value="${settings.micGain}"></div>
          <div class="field"><label>Seu microfone agora</label><div class="meter"><div class="lvl"></div><div class="thr"></div></div><div class="small muted" id="st-state"></div></div>
        </div>
        <div class="ns-box">
          <label class="check big"><input type="checkbox" id="st-ai" ${settings.aiNoise ? 'checked' : ''}> <span><b>Supressão de ruído com IA</b><br><span class="muted small">Tira teclado, ventilador, cachorro e barulho de fundo. Quando você não está falando, não sai som nenhum.</span></span></label>
          <div class="field" id="st-vad-box"><label>Exigência pra reconhecer voz <span id="st-vad-v">${settings.vadSens}%</span></label><input type="range" id="st-vad" min="10" max="95" value="${settings.vadSens}"><div class="small muted">Mais alto = só passa voz bem clara. Mais baixo = passa até sussurro.</div></div>
          <div id="st-sens-box">
            <label class="check"><input type="checkbox" id="st-auto" ${settings.autoSens ? 'checked' : ''}> Sensibilidade automática</label>
            <input type="range" id="st-thr" min="-80" max="-10" value="${settings.threshold}" ${settings.autoSens ? 'disabled' : ''}>
          </div>
        </div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px">
          <label class="check"><input type="checkbox" id="st-ec" ${settings.echoCancellation ? 'checked' : ''}> Cancelamento de eco</label>
          <label class="check"><input type="checkbox" id="st-ag" ${settings.autoGain ? 'checked' : ''}> Ganho automático</label>
          <label class="check"><input type="checkbox" id="st-snd" ${settings.sounds ? 'checked' : ''}> Sons de entrar/sair</label>
        </div>
      </div>
      <div class="tp" data-p="filtros">
        <p class="muted small" style="margin-top:0">Muda sua voz pra todo mundo da call. Use o botão de teste pra se ouvir (use fone).</p>
        <div class="fx-grid">${fxBtns}</div>
        <div class="field" id="st-semis-box"><label>Tom personalizado <span id="st-semis-v">${settings.pitchSemis > 0 ? '+' : ''}${settings.pitchSemis}</span> semitons</label><input type="range" id="st-semis" min="-12" max="12" step="1" value="${settings.pitchSemis}"></div>
        <button class="btn" id="st-monitor">${icon('headphones', 16)} Testar: ouvir minha voz</button>
      </div>
      <div class="tp" data-p="atalhos">
        <div class="settings-grid">
          <div class="field"><label>Mutar/desmutar microfone</label><div class="kbd" data-key="keyMute">${esc(settings.keyMute || 'Nenhum')}</div></div>
          <div class="field"><label>Mutar som e microfone</label><div class="kbd" data-key="keyDeafen">${esc(settings.keyDeafen || 'Nenhum')}</div></div>
        </div><p class="muted small" style="margin:0">Funcionam até dentro do jogo. Clique e aperte a combinação. Esc limpa.</p>
      </div>
    </div>
    <footer><span class="muted small" style="margin-right:auto" id="st-ver"></span>${native ? '<button class="btn" id="st-updates">Atualizações</button>' : ''}<button class="btn primary" data-close>Pronto</button></footer>`, { onClose: () => { V.testing = false; setMonitor(false); if (!V.joined && V.src) { V.raw.getTracks().forEach((t) => t.stop()); V.src.disconnect(); V.src = null; V.raw = null; } } });
  const el = m.el;
  const showTab = (t) => { $$('.tab', el).forEach((x) => x.classList.toggle('active', x.dataset.t === t)); $$('.tp', el).forEach((x) => x.classList.toggle('hidden', x.dataset.p !== t)); };
  $$('.tab', el).forEach((x) => x.onclick = () => showTab(x.dataset.t));
  showTab(tab);
  if(native){native.version().then(v=>$('#st-ver',el).textContent='Resenha v'+v);$('#st-updates',el).onclick=openUpdateSettings;}
  setAvatarEl($('#st-av', el), me);
  $('#st-av', el).onclick = () => pickAvatar(() => { setAvatarEl($('#st-av', el), me); renderAll(); });
  $('#st-name', el).onchange = () => { const v = $('#st-name', el).value.trim(); if (v) { me.name = v; LS.set('profile', me); $('#home-name').value = v; sendProfile(); renderAll(); } };
  $('#st-color', el).oninput = () => { me.color = $('#st-color', el).value; LS.set('profile', me); sendProfile(); setAvatarEl($('#st-av', el), me); renderSidebar(); previewCard(); };
  // Profile card preview: the server copy once connected (it knows the banner), otherwise a local one.
  let localBanner = '';
  const previewCard = async () => {
    const live = S.users.get(S.myId);
    const u = { ...(live || { id: 'me', name: me.name, color: me.color, avatar: me.avatar }), ...profileExtras(), name: me.name || 'Você' };
    $('#st-card', el).innerHTML = profileCardHTML({ ...u, banner: live?.banner || '' });
    const blob = !live?.banner && await bannerStore();
    if (blob) { if (localBanner) URL.revokeObjectURL(localBanner); localBanner = URL.createObjectURL(blob); $('#st-card .pcard-banner', el).innerHTML = `<img src="${localBanner}" alt="">`; }
    bindProfileCard($('#st-card', el));
  };
  previewCard();
  const saveExtras = () => { LS.set('profile', me); sendProfile(); previewCard(); };
  $$('#st-bcolors .swatch', el).forEach((b) => b.onclick = () => { me.bannerColor = b.dataset.c; $$('#st-bcolors .swatch', el).forEach((x) => x.classList.toggle('sel', x === b)); saveExtras(); });
  $$('#st-ncolors .swatch', el).forEach((b) => b.onclick = () => { me.nameColor = b.dataset.c; $$('#st-ncolors .swatch', el).forEach((x) => x.classList.toggle('sel', x === b)); $$('#st-nfx .uname', el).forEach((x) => x.style.setProperty('--nc', me.nameColor || 'var(--text-hi)')); saveExtras(); });
  $$('#st-nfx .nfx', el).forEach((b) => b.onclick = () => { me.nameFx = b.dataset.nfx; $$('#st-nfx .nfx', el).forEach((x) => { x.classList.toggle('sel', x === b); x.setAttribute('aria-pressed', String(x === b)); }); saveExtras(); });
  $('#st-status', el).oninput = () => { me.status = $('#st-status', el).value; LS.set('profile', me); previewCard(); };
  $('#st-bio', el).oninput = () => { me.bio = $('#st-bio', el).value; LS.set('profile', me); previewCard(); };
  $('#st-status', el).onchange = $('#st-bio', el).onchange = () => sendProfile();
  $('#st-banner', el).onclick = () => chooseBanner(() => setTimeout(previewCard, 800));
  $('#st-banner-x', el).onclick = () => removeBanner(() => setTimeout(previewCard, 300));
  const remic = async () => { saveSettings(); if (V.src) { try { await openMic(); } catch (e) { toast('Microfone: ' + e.message, 'err'); } } };
  $('#st-in', el).onchange = (e) => { settings.inputDevice = e.target.value; remic(); };
  $('#st-out', el).onchange = (e) => { settings.outputDevice = e.target.value; saveSettings(); applyOutputDevice(); };
  $('#st-mg', el).oninput = (e) => { settings.micGain = +e.target.value; $('#st-mg-v', el).textContent = e.target.value + '%'; if (V.micGain) V.micGain.gain.value = settings.micGain / 100; saveSettings(); };
  const nsUI = () => { $('#st-vad-box', el).classList.toggle('hidden', !settings.aiNoise); $('#st-sens-box', el).classList.toggle('hidden', settings.aiNoise); };
  nsUI();
  $('#st-ai', el).onchange = (e) => { settings.aiNoise = e.target.checked; saveSettings(); applyNoiseMode(); nsUI(); };
  $('#st-vad', el).oninput = (e) => { settings.vadSens = +e.target.value; $('#st-vad-v', el).textContent = e.target.value + '%'; saveSettings(); applyNoiseMode(); };
  $('#st-auto', el).onchange = (e) => { settings.autoSens = e.target.checked; $('#st-thr', el).disabled = e.target.checked; saveSettings(); };
  $('#st-thr', el).oninput = (e) => { settings.threshold = +e.target.value; saveSettings(); };
  for (const [id, k] of [['st-ec', 'echoCancellation'], ['st-ag', 'autoGain']]) $('#' + id, el).onchange = (e) => { settings[k] = e.target.checked; remic(); };
  $('#st-snd', el).onchange = (e) => { settings.sounds = e.target.checked; saveSettings(); };
  $$('[data-app-icon]', el).forEach((b) => b.onclick = async () => {
    settings.appIcon = b.dataset.appIcon; saveSettings(); PIPOCA.applyLogo(settings.appIcon);
    $$('[data-app-icon]', el).forEach((x) => x.classList.toggle('sel', x === b));
    if (native?.setAppIcon) { const r = await native.setAppIcon(settings.appIcon, await PIPOCA.rasterize(settings.appIcon)); toast(r?.ok ? 'Ícone trocado. A barra de tarefas pode levar alguns segundos para atualizar.' : 'Não consegui trocar o ícone da janela.', r?.ok ? 'ok' : '', 3500); }
  });
  if ($('#st-music', el)) $('#st-music', el).onchange = (e) => music?.setEnabled(e.target.checked);
  if ($('#st-glass', el)) $('#st-glass', el).onchange = (e) => { settings.translucent = e.target.checked; saveSettings(); applyWindowMaterial(); };
  $('#st-motion', el).onchange = (e) => { settings.reduceMotion = e.target.checked; saveSettings(); document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion); };
  // Aparência
  bindPaletteCards(el);
  $$('.theme-card', el).forEach((b) => b.onclick = () => { settings.theme = b.dataset.theme; saveSettings(); applyTheme(settings.theme,settings.themeColor); $$('.theme-card', el).forEach((x) => x.classList.toggle('sel', x === b)); });
  $('#st-fs', el).onchange = (e) => { settings.fontScale = +e.target.value; saveSettings(); applyLayout(); };
  $('#st-fs', el).oninput = (e) => { $('#st-fs-v', el).textContent = e.target.value + '%'; };
  $('#st-compact', el).onchange = (e) => { settings.compact = e.target.checked; saveSettings(); applyLayout(); };
  $('#st-reset-layout', el).onclick = () => { resetLayout(); toast('Layout padrão restaurado', 'ok', 1500); };
  // Filtros
  const fxUI = () => { $$('.fx-btn', el).forEach((b) => b.classList.toggle('sel', b.dataset.fx === settings.voiceFx)); $('#st-semis-box', el).classList.toggle('hidden', settings.voiceFx !== 'custom'); };
  fxUI();
  $$('.fx-btn', el).forEach((b) => b.onclick = () => { settings.voiceFx = b.dataset.fx; saveSettings(); applyVoiceFx(); fxUI(); });
  $('#st-semis', el).oninput = (e) => { settings.pitchSemis = +e.target.value; $('#st-semis-v', el).textContent = (settings.pitchSemis > 0 ? '+' : '') + settings.pitchSemis; saveSettings(); applyVoiceFx(); };
  $('#st-monitor', el).onclick = () => { setMonitor(!V.monitor); $('#st-monitor', el).classList.toggle('primary', !!V.monitor); $('#st-monitor', el).innerHTML = `${icon('headphones', 16)} ${V.monitor ? 'Parar teste' : 'Testar: ouvir minha voz'}`; };
  // Atalhos
  $$('.kbd', el).forEach((k) => k.onclick = () => {
    $$('.kbd', el).forEach((x) => x.classList.remove('rec'));
    k.classList.add('rec'); k.textContent = 'Aperte as teclas...';
    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      const parts = []; if (e.ctrlKey) parts.push('Control'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift');
      let key = e.code.replace(/^Key/, '').replace(/^Digit/, '');
      if (!/^F\d+$/.test(key) && key.length > 1 && !/^(Numpad\d|Space|Insert|Home|End|PageUp|PageDown|Pause)$/.test(key)) key = e.key.length === 1 ? e.key.toUpperCase() : key;
      if (key.startsWith('Numpad') && /\d/.test(key)) key = 'num' + key.slice(6);
      const accel = e.key === 'Escape' ? '' : [...parts, key].join('+');
      settings[k.dataset.key] = accel; saveSettings();
      k.textContent = accel || 'Nenhum'; k.classList.remove('rec');
      document.removeEventListener('keydown', onKey, true);
      if (WEB_VIEWER) { import('./mobile.js').then(m=>m.initMobile(window.__resenha)); }
registerShortcuts();
    };
    document.addEventListener('keydown', onKey, true);
  });
  // Medidor
  try {
    await ensureAudio();
    if (!V.src) await openMic();
    V.testing = true;
    const lvl = $('.lvl', el), thr = $('.thr', el), st = $('#st-state', el);
    const pos = (db) => clamp((db + 80) / 70 * 100, 0, 100) + '%';
    const tick = () => {
      if (!document.body.contains(el)) return;
      const ai = settings.aiNoise && V.rnReady;
      const open = ai ? V.vadOpen : V.gateOpen;
      lvl.style.width = pos(V.selfLevel);
      lvl.style.background = open ? 'var(--green)' : '#4e5058';
      thr.style.display = ai ? 'none' : '';
      thr.style.left = pos(settings.autoSens ? (V.autoThr ?? -50) : settings.threshold);
      st.textContent = ai ? (open ? 'Voz detectada: enviando' : 'Sem voz: silêncio') : (open ? 'Enviando' : 'Abaixo da sensibilidade');
      requestAnimationFrame(tick);
    };
    tick();
  } catch {}
}
function setMonitor(on) {
  if (!V.ctx) return;
  if (on && !V.monitor) { V.monitor = V.ctx.createGain(); V.monitor.gain.value = 1; V.post.connect(V.monitor); V.monitor.connect(V.ctx.destination); }
  if (!on && V.monitor) { try { V.post.disconnect(V.monitor); V.monitor.disconnect(); } catch {} V.monitor = null; }
}
async function registerShortcuts() {
  if (!native) return;
  const r = await native.setShortcuts({ mute: settings.keyMute, deafen: settings.keyDeafen });
  for (const [k, ok] of Object.entries(r || {})) if (!ok) toast(`Não consegui registrar o atalho ${k === 'mute' ? settings.keyMute : settings.keyDeafen} (outro programa usa?)`, 'err');
}
if (native) native.onShortcut((a) => {
  if (a === 'mute') setMuted(!(V.muted || V.deafened));
  if (a === 'deafen') setDeafened(!V.deafened);
  if (a === 'leave') leaveVoice();
});

// ---------------- Menu da sala ----------------
// Silenciar sala: sem som e sem aviso de mensagens desta sala (vale só neste PC).
const roomKey = () => normCode(S.code) || S.addr?.text || '';
const roomMuted = () => !!settings.mutedRooms?.[roomKey()];
function toggleRoomMute() { const k = roomKey(); if (!k) return; settings.mutedRooms = { ...(settings.mutedRooms || {}) }; if (settings.mutedRooms[k]) delete settings.mutedRooms[k]; else settings.mutedRooms[k] = true; saveSettings(); toast(roomMuted() ? 'Sala silenciada: sem sons e avisos de mensagens.' : 'Sons e avisos da sala de volta.', 'ok', 2600); }
const roomPeople = () => [...S.users.values()].filter((u) => u.id !== DJ_ID);
// Pessoas na sala: todos podem ver; o anfitrião também passa o posto daqui.
function openMembers(transfer = false) {
  const people = roomPeople().sort((a, b) => (!!b.isHost - !!a.isHost) || (!!b.voiceChannel - !!a.voiceChannel) || String(a.name).localeCompare(String(b.name)));
  const row = (u) => { const ch = u.voiceChannel && chanById(u.voiceChannel); const st = u.sharing ? '<span class="mb-live">ao vivo</span>' : ch ? 'na call ' + esc(ch.name) : 'na sala';
    const act = u.id === S.myId ? '<span class="muted small">você</span>' : transfer ? (u.canHost ? `<button class="btn small-btn" data-host="${esc(u.id)}">Tornar anfitrião</button>` : '<span class="muted small">só no app de PC</span>') : `<button class="btn small-btn" data-dm="${esc(u.id)}">Mensagem</button>`;
    return `<div class="mb-row">${avatarHTML(u)}<div class="mb-info"><b>${nameHTML(u)}${u.isHost ? ' <span class="tag">HOST</span>' : ''}</b><span>${st}</span></div>${act}</div>`; };
  const m = openModal(`<header><div><h2>${transfer ? 'Transferir anfitrião' : 'Pessoas na sala'}</h2><p>${transfer ? 'Escolha quem passa a hospedar. Todo mundo reconecta sozinho.' : people.length + (people.length === 1 ? ' pessoa conectada' : ' pessoas conectadas')}</p></div><button class="icon-btn" data-close>${icon('x')}</button></header><div class="body members-list">${people.map(row).join('')}</div>`);
  $$('[data-host]', m.el).forEach((b) => b.onclick = () => { m.close(); transferHost(b.dataset.host); });
  $$('[data-dm]', m.el).forEach((b) => b.onclick = () => { m.close(); openDM(b.dataset.dm); });
}
function roomMenu() {
  const menu = $('#room-menu');
  if (!menu.classList.contains('hidden')) return menu.classList.add('hidden');
  const look = S.roomLook || {}, people = roomPeople(), host = people.find((u) => u.isHost), live = people.filter((u) => u.sharing && u.id !== S.myId);
  const color = look.color || serverColor(S.code || S.roomName), fav = native?.rooms && S.code ? favoriteCode() === normCode(S.code) : null, muted = roomMuted();
  const item = (a, label, ic, cls = '') => `<div class="dd-item ${cls}" data-a="${a}">${label} ${icon(ic, 16)}</div>`;
  const quick = (a, label, ic, on = false) => `<button class="rm-quick-btn ${on ? 'on' : ''}" data-a="${a}" aria-pressed="${on}">${icon(ic, 18)}<span>${label}</span></button>`;
  menu.classList.add('server-menu');
  menu.innerHTML = `<div class="rm-head" style="--room-color:${esc(color)}${look.cover ? `;--room-cover:url('${esc(look.cover)}')` : ''}"><div class="rm-cover ${look.cover ? 'has-cover' : ''}"></div>
      <div class="rm-id"><span class="rm-icon">${S.roomIcon ? `<img src="${esc(S.roomIcon)}" alt="">` : esc(initials(S.roomName || 'S'))}</span>
      <div class="rm-text"><b>${esc(S.roomName || 'Sala')}</b>${look.about ? `<span>${esc(look.about)}</span>` : ''}<span class="rm-meta">${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'}${host ? ' · anfitrião ' + esc(host.id === S.myId ? 'você' : host.name) : ''}</span></div></div></div>
    <div class="rm-quick">${quick('invite', 'Convidar', 'userPlus')}${quick('mute', muted ? 'Silenciada' : 'Silenciar', muted ? 'headphonesOff' : 'headphones', muted)}${fav !== null ? quick('fav', fav ? 'Favorita' : 'Favoritar', 'star', fav) : ''}</div>
    ${live.length ? `<div class="rm-sec"><div class="rm-label">Ao vivo agora</div>${live.map((u) => `<div class="dd-item rm-live" data-a="watch" data-uid="${esc(u.id)}"><span class="rm-dot"></span>${esc(u.name)}<span class="rm-go">${V.watching?.has(u.id) ? 'Assistindo' : 'Assistir'}</span></div>`).join('')}</div>` : ''}
    <div class="rm-sec">${item('members', 'Pessoas na sala', 'userPlus')}${item('profile', 'Meu perfil', 'edit')}${item('newtext', 'Criar canal de texto', 'hash')}${item('newvoice', 'Criar canal de voz', 'volume')}${item('copy', S.code ? 'Copiar código ' + esc(fmtCode(S.code)) : 'Copiar endereço', 'copy')}</div>
    ${S.isHost ? `<div class="rm-sec"><div class="rm-label">Só o anfitrião</div>${item('look', 'Personalizar sala', 'image')}${S.code && people.some((u) => u.id !== S.myId && u.canHost) ? item('transfer', 'Transferir anfitrião', 'crown') : ''}</div>` : ''}
    <div class="rm-sec">${item('settings', 'Configurações', 'settings')}${item('leave', S.isHost ? 'Fechar sala' : 'Sair da sala', 'logout', 'danger')}</div>`;
  menu.classList.remove('hidden');
  $$('.rm-quick-btn', menu).forEach((b) => b.onclick = () => { menu.classList.add('hidden'); const a = b.dataset.a; if (a === 'invite') openInvite(); if (a === 'mute') toggleRoomMute(); if (a === 'fav') toggleFavorite(); });
  $$('.dd-item', menu).forEach((it) => it.onclick = async () => {
    menu.classList.add('hidden');
    const a = it.dataset.a;
    if (a === 'invite') openInvite();
    if (a === 'settings') openSettings();
    if (a === 'fav') toggleFavorite();
    if (a === 'look') openRoomLook();
    if (a === 'members') openMembers();
    if (a === 'transfer') openMembers(true);
    if (a === 'profile') openSettings('perfil');
    if (a === 'watch') { setWatching(it.dataset.uid, true); }
    if (a === 'icon') pickServerIcon();
    if (a === 'noicon') wsSend({ t: 'room', name: S.roomName, icon: '' });
    if (a === 'newtext') createChannel('text');
    if (a === 'newvoice') createChannel('voice');
    if (a === 'copy') {
      if (S.code) return copy(S.code);
      if (!S.isHost) return copy(S.addr.text);
      const mobile = await native.mobileAccess();
  if (document.body.contains(m.el)) {
    $('#inv-web',m.el).innerHTML = mobile?.error ? `<p>${esc(mobile.error)}</p>` : (mobile?.links||[]).map(x=>`<div class="addr"><h3>Celular · mesmo Wi-Fi</h3><img width="200" height="200" src="${x.qr}" alt="QR code para configurar o Resenha no celular"><p>Escaneie para configurar o certificado local e entrar. O anfitrião precisa continuar com a sala aberta.</p><code>${esc(x.setup)}</code><button class="btn" data-copy="${esc(x.setup)}">Copiar acesso</button><details><summary>Identidade do certificado</summary><code>${esc(mobile.fingerprint)}</code><p>Confie somente no certificado deste anfitrião. A instalação permite confiar em certificados assinados por ele; remova a confiança quando não usar mais.</p></details></div>`).join('');
    bindCopy($('#inv-web',m.el));
  }
  const n = await native.hostNetwork();
      copy(n.publicV4 && !n.cgnat ? `${n.publicV4}:${n.port}` : `${n.lan[0]}:${n.port}`);
    }
    if (a === 'leave') {
      if (S.isHost && S.users.size > 1 && !await confirmModal('Fechar a sala', 'Fechar a sala desconecta todo mundo. Continuar?', 'Fechar sala')) return;
      forgetLastRoom();
      leaveRoom();
    }
  });
}

// ---------------- Atualização ----------------
let updateInfo=null,updateDismissedVersion=null;
function hideUpdateBar(){ updateDismissedVersion=updateInfo?.version||null; const bar=$('#update-bar'); if(bar.classList.contains('hidden'))return; bar.classList.add('up-leave'); setTimeout(()=>{if(!bar.classList.contains('up-leave'))return;bar.classList.add('hidden');bar.classList.remove('up-leave');},document.documentElement?.classList?.contains('glass')?260:0); document.body.classList.remove('has-update'); }
function showUpdateState(state){
 if(!native||!state)return;
 if(state.phase==='idle'&&!state.pending){updateInfo=null;hideUpdateBar();return;}
 const info=state.info||state.pending||updateInfo;if(!info)return;updateInfo=info;if(updateDismissedVersion===info.version&&state.phase!=='error')return;
 const bar=$('#update-bar'),glass=!!document.documentElement?.classList?.contains('glass'),wasHidden=bar.classList.contains('hidden');bar.classList.remove('hidden');if(!glass)document.body.classList.add('has-update');
 const labels={downloading:'Baixando em segundo plano: '+(state.percent||0)+'%',verifying:'Conferindo SHA-256…',extracting:'Preparando atualização…',ready:'Pronta para instalar. “Depois” instala ao sair do app ou na próxima abertura.'};
 const busyPhase=['downloading','verifying','extracting'].includes(state.phase),pct=state.phase==='downloading'?(state.percent||0):100;
 bar.classList.toggle('is-error',state.phase==='error');
 bar.innerHTML=(glass?`<div class="up-ico">${icon(state.phase==='error'?'refresh':'download',20)}</div><div class="up-text"><b>Resenha ${esc(info.version)} chegou</b><span>${esc(state.error||labels[state.phase]||'Uma versão nova está disponível.')}</span></div>${busyPhase?`<div class="up-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${state.phase==='downloading'?pct:100}%" class="${state.phase==='downloading'?'':'indeterminate'}"></i></div>`:''}<div class="up-actions">`:`<span>Nova versão ${esc(info.version)} disponível. ${esc(state.error||labels[state.phase]||'')}</span>`)+`<button class="btn small-btn" id="up-notes">Novidades</button>${['downloading','verifying','extracting'].includes(state.phase)?'':`<button class="btn primary small-btn" id="up-go">${info.manual||state.phase==='error'?'Baixar pelo site':state.phase==='ready'?'Reiniciar e atualizar':'Preparar atualização'}</button>`}<button class="btn small-btn" id="up-later">Depois</button>`+(glass?'</div>':'');
 bar.classList.remove('up-leave');if(glass&&wasHidden){bar.classList.remove('up-enter');void bar.offsetWidth;bar.classList.add('up-enter');}
 $('#up-later').onclick=hideUpdateBar;
 $('#up-notes').onclick=()=>openModal(`<header><h2>Novidades da ${esc(info.version)}</h2><button class="icon-btn" data-close>${icon('x')}</button></header><div class="body"><div class="notes" style="max-height:40vh;overflow:auto;white-space:pre-wrap">${esc(info.notes||'Sem notas publicadas.')}</div></div>`);
 const go=$('#up-go');if(go)go.onclick=async()=>{
  if(info.manual||state.phase==='error'){await native.openExternal(info.page);toast('Baixe o ZIP completo, encerre pela bandeja e extraia em uma pasta nova. Seus dados ficam preservados.');return;}
  go.disabled=true;const result=state.phase==='ready'?await native.restartUpdate():await native.installUpdate();
  if(!result.ok){go.disabled=false;if(result.cancelled){hideUpdateBar();return;}if(result.deferred)toast(result.error);else showUpdateState({phase:'error',info,error:result.error});}
 };
}
async function checkUpdates(manual=false){
 if(!native)return;if(manual)updateDismissedVersion=null;
 const r=await native.checkUpdate(manual);if(r?.update){updateInfo=r;showUpdateState({phase:'available',info:r});const status=await native.updateStatus();showUpdateState(status);}
 else if(manual)toast(r?.reason||'Nenhuma atualização disponível.');
}
async function openUpdateSettings(){
 const status=await native.updateStatus();
 const m=openModal(`<header><h2>Atualizações</h2><button class="icon-btn" data-close>${icon('x')}</button></header><div class="body"><p>Resenha v${esc(status.version)}</p><div class="field"><label>Canal de atualizações</label><select id="update-channel"><option value="stable">Estável</option><option value="preview">Previews</option></select></div><p class="muted small">Trocar de canal não instala versões mais antigas. Downloads completos no Windows; no Mac, download pelo site.</p><button class="btn primary" id="update-check">Verificar atualizações agora</button><p class="muted small">Depois instala ao sair pela bandeja ou na próxima abertura. Fechar só a janela pode manter o app aberto.</p></div>`);
 $('#update-channel',m.el).value=status.channel;$('#update-channel',m.el).onchange=async e=>{await native.updateChannel(e.target.value);await checkUpdates(true);};
 $('#update-check',m.el).onclick=async e=>{e.target.disabled=true;await checkUpdates(true);e.target.disabled=false;};
}
if(native?.onUpdateProgress)native.onUpdateProgress(showUpdateState);

// ---------------- Layout: mover painéis, redimensionar, ordem dos quadrados ----------------
const PANE_NAMES = { sidebar: 'Canais', call: 'Call', chat: 'Chat' };
function applyLayout() {
  const main = $('#main');
  // 1.6: fixed order (channels, call, conversation); only the side widths stay adjustable.
  const order = Object.keys(PANE_NAMES);
  settings.layout = order;
  $$('.splitter', main).forEach((s) => s.remove());
  order.forEach((p, i) => {
    const el = $('#' + p);
    main.appendChild(el);
    el.classList.toggle('first-pane', i === 0);
    if (i < order.length - 1) {
      const sp = document.createElement('div'); sp.className = 'splitter'; sp.dataset.left = p; sp.dataset.right = order[i + 1];
      main.appendChild(sp);
    }
  });
  const r = document.documentElement.style;
  r.setProperty('--chat-w', settings.chatWidth + 'px');
  r.setProperty('--side-w', settings.sidebarWidth + 'px');
  if (native && native.setZoom) native.setZoom(settings.fontScale / 100);
  document.body.classList.toggle('compact', !!settings.compact);
  $('#pips').dataset.corner = settings.pipCorner;
  bindSplitters();
  layoutGrid();
}
function bindSplitters() {
  $$('.splitter').forEach((sp) => {
    const adjacent = [sp.dataset.left, sp.dataset.right].find(p => p !== 'call') || 'chat';
    sp.tabIndex = 0; sp.setAttribute('role','separator'); sp.setAttribute('aria-orientation','vertical'); sp.setAttribute('aria-label',adjacent === 'chat' ? 'Largura do painel de conversa' : 'Largura dos canais');
    sp.onkeydown = e => {
      const step = e.shiftKey ? 40 : 16, sign = adjacent === sp.dataset.left ? 1 : -1;
      if (!['ArrowLeft','ArrowRight','Home'].includes(e.key)) return; e.preventDefault();
      const current = adjacent === 'chat' ? settings.chatWidth : settings.sidebarWidth;
      const width = e.key === 'Home' ? (adjacent === 'chat' ? 360 : 264) : current + (e.key === 'ArrowRight' ? step : -step) * sign;
      if (adjacent === 'chat') settings.chatWidth = clamp(width,300,innerWidth*0.6); else settings.sidebarWidth = clamp(width,200,420);
      document.documentElement.style.setProperty('--chat-w',settings.chatWidth+'px');document.documentElement.style.setProperty('--side-w',settings.sidebarWidth+'px');saveSettings();layoutGrid();
    };
    sp.onmousedown = (e) => {
      e.preventDefault(); sp.classList.add('drag'); document.body.classList.add('resizing');
      const L = sp.dataset.left, Rr = sp.dataset.right;
      // redimensiona o painel de tamanho fixo (canais/chat) que está encostado nesse divisor
      const target = [L, Rr].find((p) => p !== 'call') || 'chat';
      const startX = e.clientX, startW = target === 'chat' ? settings.chatWidth : settings.sidebarWidth;
      const sign = target === L ? 1 : -1;
      const move = (ev) => {
        const w = startW + (ev.clientX - startX) * sign;
        if (target === 'chat') settings.chatWidth = clamp(w, 300, innerWidth * 0.6);
        else settings.sidebarWidth = clamp(w, 200, 420);
        document.documentElement.style.setProperty('--chat-w', settings.chatWidth + 'px');
        document.documentElement.style.setProperty('--side-w', settings.sidebarWidth + 'px');
        layoutGrid();
      };
      const up = () => { sp.classList.remove('drag'); document.body.classList.remove('resizing'); saveSettings(); removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
      addEventListener('mousemove', move); addEventListener('mouseup', up);
    };
    sp.ondblclick = () => { settings.chatWidth = 360; settings.sidebarWidth = 264; saveSettings(); applyLayout(); };
  });
}
function initLayout() {
  applyLayout();
  // Reordenar canais segurando e arrastando (vale pra todo mundo da sala)
  let dragCh = null;
  for (const box of [$('#text-channels'), $('#voice-channels')]) {
    box.addEventListener('dragstart', (e) => {
      const ch = e.target.closest('[data-ch], [data-vch]'); if (!ch) return;
      dragCh = ch.dataset.ch || ch.dataset.vch; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/resenha-ch', dragCh); ch.classList.add('ch-dragging');
    });
    box.addEventListener('dragend', () => { dragCh = null; $$('.ch-dragging, .ch-over-top, .ch-over-bottom').forEach((x) => x.classList.remove('ch-dragging', 'ch-over-top', 'ch-over-bottom')); });
    box.addEventListener('dragover', (e) => {
      const ch = e.target.closest('[data-ch], [data-vch]'); if (!dragCh || !ch) return;
      const id = ch.dataset.ch || ch.dataset.vch; if (id === dragCh || chanById(id)?.type !== chanById(dragCh)?.type) return;
      e.preventDefault();
      const r = ch.getBoundingClientRect(); const top = e.clientY < r.top + r.height / 2;
      $$('.ch-over-top, .ch-over-bottom').forEach((x) => x !== ch && x.classList.remove('ch-over-top', 'ch-over-bottom'));
      ch.classList.toggle('ch-over-top', top); ch.classList.toggle('ch-over-bottom', !top);
    });
    box.addEventListener('drop', (e) => {
      const ch = e.target.closest('[data-ch], [data-vch]'); if (!dragCh || !ch) return;
      const id = ch.dataset.ch || ch.dataset.vch; if (id === dragCh) return;
      e.preventDefault();
      const top = ch.classList.contains('ch-over-top');
      const ids = S.channels.map((c) => c.id).filter((x) => x !== dragCh);
      ids.splice(ids.indexOf(id) + (top ? 0 : 1), 0, dragCh);
      wsSend({ t: 'ch-order', ids });
    });
  }
  // Reordenar quadrados da call arrastando
  $('#call-stage').addEventListener('dragstart', (e) => {
    const t = e.target.closest('.grid > .tile, .focus-strip > .tile'); if (!t) return;
    e.dataTransfer.setData('text/resenha-tile', t.dataset.key); e.dataTransfer.effectAllowed = 'move'; t.classList.add('tile-dragging');
  });
  $('#call-stage').addEventListener('dragend', () => $$('.tile-dragging, .tile-over').forEach((x) => x.classList.remove('tile-dragging', 'tile-over')));
  $('#call-stage').addEventListener('dragover', (e) => { const t = e.target.closest('.tile'); if (t && e.dataTransfer.types.includes('text/resenha-tile')) { e.preventDefault(); $$('.tile-over').forEach((x) => x !== t && x.classList.remove('tile-over')); t.classList.add('tile-over'); } });
  $('#call-stage').addEventListener('drop', (e) => {
    const key = e.dataTransfer.getData('text/resenha-tile'); const t = e.target.closest('.tile');
    if (!key || !t || t.dataset.key === key) return;
    e.preventDefault();
    const keys = [...t.parentElement.children].map((x) => x.dataset.key);
    const order = keys.filter((k) => k !== key); order.splice(order.indexOf(t.dataset.key) + (keys.indexOf(key) < keys.indexOf(t.dataset.key) ? 1 : 0), 0, key);
    const uid = (k) => k.split(':')[1];
    const known = settings.tileOrder.filter((u) => !order.map(uid).includes(u));
    settings.tileOrder = [...order.map(uid), ...known].slice(0, 60); saveSettings();
    renderCall();
  });
  // Mover a miniatura da tela compartilhada pra qualquer canto
  const pips = $('#pips');
  pips.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('.tile-tools')) return;
    const t = e.target.closest('.tile'); if (!t) return;
    const sx = e.clientX, sy = e.clientY, r0 = pips.getBoundingClientRect(), box = $('#call').getBoundingClientRect();
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true; pips.classList.add('moving');
      pips.style.left = clamp(r0.left - box.left + dx, 0, box.width - r0.width) + 'px';
      pips.style.top = clamp(r0.top - box.top + dy, 0, box.height - r0.height) + 'px';
      pips.style.right = pips.style.bottom = 'auto';
    };
    const up = (ev) => {
      removeEventListener('mousemove', move); removeEventListener('mouseup', up);
      if (!moved) return;
      pips.classList.remove('moving');
      const cx = ev.clientX - box.left, cy = ev.clientY - box.top;
      settings.pipCorner = (cy < box.height / 2 ? 't' : 'b') + (cx < box.width / 2 ? 'l' : 'r');
      pips.removeAttribute('style'); pips.dataset.corner = settings.pipCorner; saveSettings();
      pips.addEventListener('click', (ce) => ce.stopPropagation(), { capture: true, once: true });
    };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  });
}
function sortByTileOrder(list) {
  const pos = (u) => { const i = settings.tileOrder.indexOf(u.id); return i < 0 ? 1e6 + (u.joinedAt || 0) : i; };
  return [...list].sort((a, b) => pos(a) - pos(b));
}
function resetLayout() {
  Object.assign(settings, { layout: ['sidebar', 'call', 'chat'], chatWidth: 360, sidebarWidth: 264, tileOrder: [], pipCorner: 'br' });
  saveSettings(); applyLayout(); renderCall();
}

// ---------------- Ligações de UI ----------------
function bind() {
  // Own window buttons on Windows/Linux (macOS keeps its native ones).
  document.querySelectorAll('#win-controls [data-win]').forEach(b => b.onclick = () => window.resenhaNative?.windowControl?.(b.dataset.win));
  window.resenhaNative?.onWindowMaximized?.(max => {
    document.documentElement.classList.toggle('win-max', max);
    const b = $('#win-controls [data-win="maximize"]'); if (b) b.title = b.ariaLabel = max ? 'Restaurar' : 'Maximizar';
  });
  addEventListener('blur', () => document.documentElement.classList.add('win-blur'));
  addEventListener('focus', () => document.documentElement.classList.remove('win-blur'));
  $('#btn-invite').innerHTML = icon('userPlus', 16) + '<span>Convidar</span>';
  $('#btn-attach').innerHTML = icon('plus', 22);
  $('#btn-send').innerHTML = icon('send', 18);
  $('#btn-send').onclick = () => sendMessage();
  $('#btn-code').onclick = () => { if (S.code) copy(fmtCode(S.code)); };
  $('#btn-chat-toggle').innerHTML = icon('chat', 18);
  $('#btn-chat-toggle').onclick = () => { if ($('#main').dataset.rightOpen === 'true') roomUI?.close(); else roomUI?.open('chat'); };
  $('#room-header').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roomMenu(e); } };
  $('#btn-settings').innerHTML = icon('settings');
  $('#vp-leave').innerHTML = icon('phoneOff');
  $('#vp-invite').innerHTML = icon('userPlus');
  $('#vp-dj').innerHTML = icon('music');
  $('#vp-signal').innerHTML = icon('signal', 20);
  $$('.cat-add').forEach((b) => { b.innerHTML = icon('plusSmall', 16); b.onclick = () => createChannel(b.dataset.add); });
  $$('.ico-hash').forEach((e) => (e.outerHTML = icon('hash', 20)));
  $$('.ico-vol').forEach((e) => (e.outerHTML = icon('volume', 20)));
  $('#btn-invite').onclick = (e) => { e.stopPropagation(); openInvite(); };
  $('#room-header').onclick = roomMenu;
  $('#btn-mute').onclick = $('#cc-mute').onclick = () => setMuted(!(V.muted || V.deafened));
  $('#btn-deafen').onclick = $('#cc-deafen').onclick = () => setDeafened(!V.deafened);
  $('#btn-mute').oncontextmenu = $('#cc-mute').oncontextmenu = (e) => deviceMenu(e, 'audioinput');
  $('#btn-deafen').oncontextmenu = $('#cc-deafen').oncontextmenu = (e) => deviceMenu(e, 'audiooutput');
  $('#btn-settings').onclick = () => openSettings();
  $('#up-user').onclick = () => openSettings('perfil');
  $('#vp-leave').onclick = $('#cc-leave').onclick = () => leaveVoice();
  $('#vp-share').onclick = $('#cc-share').onclick = toggleShare;
  $('#vp-invite').onclick = openInvite;
  $('#vp-dj').onclick = $('#btn-dj').onclick = openDJPanel;
  $('#rail-home').onclick = () => toast('Pra sair, use o menu da sala (clique no nome dela).');
  // Canais
  $('#text-channels').onclick = (e) => {
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); return channelMenu(e, ed.dataset.edit); }
    const ch = e.target.closest('[data-ch]'); if (ch) selectTextChannel(ch.dataset.ch);
  };
  $('#voice-channels').onclick = (e) => {
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); return channelMenu(e, ed.dataset.edit); }
    const u = e.target.closest('[data-uid]'); if (u) { if (u.dataset.uid === DJ_ID) return openDJPanel(); return userMenu(e, u.dataset.uid); }
    const ch = e.target.closest('[data-vch]'); if (ch) joinVoice(ch.dataset.vch);
  };
  const chCtx = (e) => {
    const u = e.target.closest('[data-uid]'); if (u) return userMenu(e, u.dataset.uid);
    const ch = e.target.closest('[data-ch], [data-vch]'); if (ch) channelMenu(e, ch.dataset.ch || ch.dataset.vch);
  };
  $('#text-channels').oncontextmenu = chCtx; $('#voice-channels').oncontextmenu = chCtx;
  $('#online-users').oncontextmenu = (e) => { const el = e.target.closest('[data-uid]'); if (el) userMenu(e, el.dataset.uid); };
  $('#online-users').onclick = (e) => { const el = e.target.closest('[data-uid]'); if (el) userMenu(e, el.dataset.uid); };
  initLayout();
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { if (V.joined && settings.inputDevice === 'default') openMic().catch(() => {}); });
}

window.__resenha = { showUpdateState, openWhatsNew, openSettings, WEB_VOICE, ensureAudio, openMic, volumeGain, saveSettings, userMenu, toast, connect, parseAddr, setWatching, openDM, toggleFriend, getPeer, onSignal, renderCall, failover, successionOrder, applyLayout, resetLayout, joinByCode, S, V, settings, joinVoice, leaveVoice, setMuted, setDeafened, sendMessage, hostRoom, joinRoom, toggleShare, startShareWithStream, applyUserVolume, applyVoiceFx, applyNoiseMode, selectTextChannel, openDJPanel, summonDJ, startEdit, msgAction, deviceMenu, wsSend, openSettings, openLiveAudioTest, runLiveAudioTest };
if (!LS.get('arcThemeMigrated', false)) { settings.theme = 'system'; saveSettings(); LS.set('arcThemeMigrated', true); }
if (window.RETIRED_THEMES?.[settings.theme]) { settings.theme = window.RETIRED_THEMES[settings.theme]; saveSettings(); } // temas retirados na 2.1.5
applyTheme(settings.theme,settings.themeColor);
// Janela translúcida: o vidro do sistema aparece atrás do fundo do tema (Windows 11 22H2+).
async function applyWindowMaterial() {
  if (!native?.setWindowMaterial) return;
  try { const r = await native.setWindowMaterial(settings.translucent !== false); document.documentElement.classList.toggle('acrylic', !!r?.on); } catch {}
}
applyWindowMaterial();
// "O que há de novo": aparece uma vez, na primeira abertura de uma versão com novidades, só para quem já usava o app.
const WHATS_NEW = {
  '2.2.0': {
    hero: 'spotify',
    items: [
      ['music', 'Spotify dentro do Resenha', 'Conecte uma vez e toque com a sua conta Premium, sem abrir o app do Spotify. Busca, suas playlists, fila que dá pra arrastar e a música segue sozinha quando a fila acaba. (Windows)'],
      ['userPlus', 'Ouvir junto', 'Chame quem está na sala pra ouvir a mesma música, cada um na própria conta. Sair não tira ninguém da call.'],
      ['image', 'Temas com personalidade', 'Líquido (preto e translúcido), Holofoil (cristal com reflexo de arco-íris), Vision e Vision · noite com física, Cosmos, Neon, Brasa, Bento e Cinema: cada um com material, movimento e arranjo próprios.'],
      ['screen', 'A call se arruma sozinha', 'No Bento e no Cinema, quem está falando ganha o destaque.'],
      ['sparkles', 'Detalhes redesenhados', 'Interruptores em gota, abas com um traço só, campos sem brilho neon e volumes em pílula, com rodinha do mouse.'],
      ['music', 'Ícone do Spotify em cada tema', 'A aba de música troca o desenho do ícone conforme o tema: cromado, iridescente, pintado, globo de discoteca.'],
    ],
  },
  '2.1.6': {
    items: [
      ['screen', 'Janela arredondada', 'No Windows, os cantos da janela acompanham os painéis. Maximizada, fica reta.'],
      ['hash', 'Menu do servidor e chat mais limpos', 'Menu sem misturar com os canais, seletor e campo de mensagem com um contorno só.'],
      ['edit', 'Efeito do nome no chat', 'Quando alguém troca o efeito, o chat atualiza na hora.'],
      ['image', 'Ícone da sala', 'O ícone da sala aparece ao lado do nome dela.'],
    ],
  },
  '2.1.5': {
    items: [
      ['sparkles', 'Identidade nova', 'Grafite fosco, vidro esfumaçado e um laranja só nos detalhes.'],
      ['image', 'Temas caprichados', 'Âmbar, Noturno, Ametista, Fúcsia, Horizonte e Titânio: cada um com fundo, movimento e cores próprios.'],
      ['screen', 'Janela de vidro', 'No Windows 11 com transparência ligada, o papel de parede aparece desfocado atrás do Resenha.'],
      ['hash', 'Menu do servidor e chat novos', 'Menu para todos (silenciar, quem está ao vivo) e chat em bolhas.'],
      ['edit', 'Nome com efeito', 'Holográfico, neon, ouro, fogo… em Configurações > Perfil.'],
      ['download', 'Atualização mais leve', 'O atualizador não usa mais PowerShell e não deixa pasta para trás.'],
    ],
  },
};
const WN_STYLE = '3'; // 1 Cromado · 2 Bolha Aqua · 3 Adesivo holográfico
function openWhatsNew(version) {
  const info = WHATS_NEW[version]; if (!info) return;
  const themes = window.VISIBLE_THEMES.filter((k) => k !== 'arcLight' && k !== 'arcDark');
  const card = (k) => { const v = themePreview(k), t = THEMES[k] || THEMES.system;
    return `<button class="theme-card ${settings.theme === k ? 'sel' : ''}" data-theme="${k}"><div class="tc-prev" style="background:${v['bg-rail']}"><i style="background:${v['bg-side']}"></i><i style="background:${v['bg-main']}"><b style="background:${v.blurple}"></b><s style="background:${v.muted}"></s><s style="background:${v.muted}"></s></i></div><span>${esc(k === 'system' ? 'Resenha' : t.name)}</span></button>`; };
  const pipoca = $('.side-brand > img')?.src || $('#rail-home img')?.src || '';
  // Destaque da 2.2: Resenha + Spotify. Marca do Spotify nas cores oficiais e aviso de que não há afiliação.
  const hero = info.hero === 'spotify' ? `<section class="wn-hero" aria-label="Resenha × Spotify">
      <div class="wn-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <span class="wn-kicker" aria-hidden="true">Resenha × Spotify</span>
      <div class="wn-duo"><span class="wn-logo wn-resenha">${pipoca ? `<img src="${esc(pipoca)}" alt="Resenha">` : 'R'}</span><span class="wn-plus" aria-hidden="true">×</span>
        <span class="wn-logo wn-spotify"><svg viewBox="0 0 24 24" width="46" height="46" aria-label="Spotify"><circle cx="12" cy="12" r="11" fill="#1ed760"/><g fill="none" stroke="#000" stroke-linecap="round" stroke-width="1.8"><path d="M6.4 9.3c3.6-1.1 7.9-.85 11.3 1.2"/><path d="M7 12.4c3-.88 6.6-.64 9.4 1.05"/><path d="M7.6 15.3c2.4-.65 5-.45 7.1.83"/></g></svg></span></div>
      <h3>Agora tem Spotify no Resenha</h3><p>Sua música, na sua call: com a sua conta, sem abrir outro app.</p>
      <div class="wn-chips"><span>${icon('music', 14)}Sua conta Premium</span><span>${icon('music', 14)}Suas playlists</span><span>${icon('userPlus', 14)}Ouvir junto</span></div>
      </section>` : '';
  const m = openModal(`<header><div><span class="wn-tag">Novidades</span><h2>O que há de novo na ${esc(version)}</h2><p>Dá uma olhada e experimenta um tema novo.</p></div><button class="icon-btn" data-close>${icon('x')}</button></header>
    <div class="body whats-new">${hero}
      <ul class="wn-list">${info.items.map(([ic, t, d]) => `<li><span class="wn-ic">${icon(ic, 18)}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></li>`).join('')}</ul>
      <div class="section-title">Experimente os temas</div>
      <div class="theme-grid wn-themes">${themes.map(card).join('')}</div>
    </div>
    <footer><button class="btn" id="wn-more">Mais opções de aparência</button><span class="grow"></span>${info.hero === 'spotify' && native?.spotify ? '<button class="btn wn-spotify-btn" id="wn-spotify">Ir para a música</button>' : ''}<button class="btn primary" data-close>Bora!</button></footer>${info.hero === 'spotify' ? '<p class="wn-legal">O Resenha não é afiliado, patrocinado ou endossado pelo Spotify. Spotify é marca registrada da Spotify AB.</p>' : ''}`,
    { wide: true, cls: 'whats-new-modal wn-y2k', onClose: info.hero === 'spotify' && native?.spotify ? showMusicIntro : undefined });
  $('.whats-new-modal', m.el)?.setAttribute('data-wn', WN_STYLE); // estilo Y2K do destaque (glass.css)
  $('#wn-spotify', m.el)?.addEventListener('click', () => { music?.setEnabled(true); m.close(); });
  $$('.theme-card', m.el).forEach((b) => b.onclick = () => { settings.theme = b.dataset.theme; saveSettings(); applyTheme(settings.theme, settings.themeColor); $$('.theme-card', m.el).forEach((x) => x.classList.toggle('sel', x === b)); });
  $('#wn-more', m.el).onclick = () => { m.close(); openSettings('aparencia'); };
}
// Mostra a aba de música agora, se já estiver numa sala; senão, na próxima vez que entrar numa.
function showMusicIntro() { if (S.myId && $('#main') && !$('#main').classList.contains('hidden')) { LS.set('musicIntro', false); roomUI?.open('music'); } }
async function maybeWhatsNew() {
  if (!native?.version) return;
  let v = ''; try { v = await native.version(); } catch { return; }
  const seen = LS.get('whatsNewSeen', null); LS.set('whatsNewSeen', v);
  if (seen === v) return;
  // 2.2: na primeira abertura o Spotify já vem ligado e a aba de música aparece (quando o app suporta).
  const spotifyIntro = native?.spotify && /^2\.2\./.test(v) && !/^2\.2\./.test(seen || '');
  if (spotifyIntro) { LS.set('musicIntro', true); setTimeout(() => { music.setEnabled(true); if (!WHATS_NEW[v] || (!seen && !me.name)) showMusicIntro(); }, 600); }
  if (!WHATS_NEW[v]) return;
  if (!seen && !me.name) return; // instalação nova: começa sem pop-up
  setTimeout(() => openWhatsNew(v), 900);
}
maybeWhatsNew();
native?.onCaptureFailure?.((message) => { stopShare(); toast(message, 'err', 10000); });
native?.onWindowVisible?.((visible) => { V.windowVisible = visible; if (!visible && V.focus === 'screen:' + S.myId) V.focus = null; renderCall(); });
document.addEventListener('visibilitychange', () => { if (!native) { V.windowVisible = !document.hidden; renderCall(); } });
bind();
roomUI = createRoomUI({icon,openDM,contacts:()=>[...new Map([...Object.values(LS.get(dmStorageKey()+'.contacts',{})),...Object.values(friends),...[...S.users.values()].filter(u=>u.id!==S.myId&&u.id!==DJ_ID)].map(u=>[u.id,u])).values()],onDMVisible:()=>{if(dmPeer){dmUnread.delete(dmPeer);renderFriends();}},onResize:layoutGrid,liveVolume:u=>settings.streamVolumes[u.name]??100,setLiveVolume:(u,value)=>{settings.streamVolumes[u.name]=value;applyUserVolume(u.id);saveSettings();}});
// Volumes em pílula (item 8): mantém --p (preenchimento) em dia e deixa a rodinha do mouse ajustar.
const PILL = '#call .live-volume input[type=range], #ctx-menu .ctx-row input[type=range], .dj-vol input[type=range]';
const pillFill = (el) => el.style.setProperty('--p', ((el.value - el.min) / ((el.max - el.min) || 1) * 100) + '%');
document.addEventListener('input', (e) => { if (e.target.matches?.(PILL)) pillFill(e.target); }, true);
// Só olha onde esses controles nascem (menu do usuário e janelas soltas), não a tela inteira: o vigia anterior travava a animação.
const pillInit = () => document.querySelectorAll(PILL).forEach((el) => { if (!el.dataset.pill) { el.dataset.pill = '1'; pillFill(el); } });
const pillWatch = new MutationObserver(pillInit); pillWatch.observe(document.body, { childList: true }); if ($('#ctx-menu')) pillWatch.observe($('#ctx-menu'), { childList: true, subtree: true });
document.addEventListener('pointerover', (e) => { if (e.target.matches?.(PILL) && !e.target.dataset.pill) pillInit(); }, true);
document.addEventListener('wheel', (e) => {
  const el = e.target.closest?.('.live-volume, #ctx-menu .ctx-row, .dj-vol')?.querySelector('input[type=range]'); if (!el) return;
  e.preventDefault(); const step = (el.max - el.min) / 20; el.value = Math.max(+el.min, Math.min(+el.max, +el.value - Math.sign(e.deltaY) * step));
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}, { passive: false });
const music = createMusic({ settings, saveSettings, icon, toast, roomUI, native, esc,
  room: { users: () => [...S.users.values()].filter((u) => u.id !== DJ_ID), me: () => S.myId, now: serverNow, send: (to, data) => sig(to, { listen: data }) } }); window.__resenha.music = music;
// Wide windows show the conversation next to the call; narrower ones open it on demand.
if (innerWidth >= 1280) roomUI.open('chat');
initHome();
native?.captureInfo().then((info) => { if (info.recovered) toast('A captura anterior foi interrompida. O Resenha abriu em modo de compatibilidade.', '', 10000); });
$('#main').dataset.mobilePane = 'call';
$$('[data-mobile-pane]', $('#web-nav')).forEach((b) => b.onclick = () => {
  $('#main').dataset.mobilePane = b.dataset.mobilePane;
  if (b.dataset.mobilePane === 'chat') roomUI?.open('chat');
  $$('[data-mobile-pane]', $('#web-nav')).forEach((x) => x.classList.toggle('active', x === b));
  layoutGrid();
});
if (WEB_VIEWER) {
  document.body.classList.add('web-viewer');
  $('#btn-host').closest('.card').classList.add('hidden');
  if (globalThis.RESENHA_PWA) { // PWA: entra pelo código (o link do convite já traz o código depois do #)
    const fromLink = fmtCode(decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get('c') || '');
    $('#join-addr').value = fromLink.replace('-', '').length === 8 ? fromLink : LS.get('pwaLastCode', '');
    $('#join-hint').textContent = 'Cole o código que a galera mandou. Funciona enquanto alguém estiver com a sala aberta no PC.';
    $('#btn-join').onclick = () => joinByCode($('#join-addr').value, $('#join-pass').value);
  } else {
  $('#join-addr').value = location.host;
  $('#join-addr').closest('.field').classList.add('hidden');
  $('#join-hint').textContent = 'Você está no endereço da sala. Escolha seu nome e entre.';
  $('#btn-join').onclick = () => joinRoom(location.host, $('#join-pass').value);
  }
  $('#cc-share').classList.add('hidden'); $('#vp-share').classList.add('hidden');
  $('#btn-mute').disabled = !WEB_VOICE; $('#cc-mute').disabled = !WEB_VOICE;
  $('.home-brand p').textContent = 'Acompanhe a resenha pelo navegador.';
}
if (WEB_VIEWER) { import('./mobile.js').then(m=>m.initMobile(window.__resenha)); }
registerShortcuts();
document.addEventListener('fullscreenchange', () => { renderCall(); document.fullscreenElement?.revealControls?.(); });
setTimeout(checkUpdates, 2500);
setInterval(checkUpdates, 30 * 60 * 1000);
window.addEventListener('beforeunload', () => { try { if (S.ws) S.ws.close(); } catch {} });

// Acknowledge only after the client has initialized and remained alive for five seconds.
if(native?.updateReady)setTimeout(()=>native.updateReady(),5000);

