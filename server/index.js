const { persistRoomFiles } = require('./room-persistence');
const { createTextCommands } = require('./text-commands');
const { createFileHTTP } = require('./file-http');
// Servidor da sala: WebSocket (chat, canais, presença, sinalização WebRTC, DJ) + HTTP (anexos e músicas do DJ).
// Roda embutido no app de quem cria a sala, ou sozinho com: node server/index.js --port 7777
const http = require('http');
const roomState = require('../room-state');
const {safeIcon, safeLook} = require('./room-icon');
const { applyProfileExtras, createBannerHTTP } = require('./profile-extras');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.opus': 'audio/ogg',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.zip': 'application/zip',
};
const mimeOf = (name) => MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const cleanText = (s, max) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').slice(0, max).trim();
const validAvatar = (a) => (typeof a === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(a) && a.length < 120000 ? a : null);
const safeFileName = (s) => (clean(s, 180).replace(/[\\/:*?"<>|]/g, '_') || 'arquivo');
const safeAttachment = (a) => (a && /^[A-Za-z0-9_-]{1,40}$/.test(String(a.id)) ? { ...a, name: ['.', '..'].includes(safeFileName(a.name)) ? 'arquivo' : safeFileName(a.name) } : null);
const chanName = (s, type) => {
  let n = clean(s, 32);
  if (type === 'text') n = n.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
  return n;
};
const DJ_ID = 'dj-resenha';
const SERVER_VERSION = require('../package.json').version;
const FEATURES = ['room-snapshot', 'chat-ack', 'dm-ack', 'dj-ack', 'watch', 'client-identity'];
const DISK_HISTORY_LIMIT = 2000, WELCOME_HISTORY_LIMIT = 500, CHANNEL_CREATION_LIMIT = 60;

function createServer(opts = {}) {
  const port = Number(opts.port) || 7777;
  const password = opts.password || '';
  let roomName = clean(opts.roomName, 40) || 'Minha sala';
  const dataDir = opts.dataDir || path.join(process.cwd(), 'resenha-data');
  const maxUpload = opts.maxUpload || 2 * 1024 * 1024 * 1024; // 2 GB por arquivo
  const log = opts.log || ((...a) => console.log('[sala]', ...a));
  const djTools = opts.dj || null;
  const identityFile = path.join(dataDir,'room.json');
  let identity = null;try{identity=JSON.parse(fs.readFileSync(identityFile,'utf8'))}catch{}
  const roomCode = roomState.norm(opts.code || identity?.code) || null;
  if(identity && roomCode && identity.code!==roomCode)throw new Error('Esta pasta pertence a outro código de sala. Os dados foram preservados.');
  let migrationBackup=null;
  if(roomCode && !identity && ['history.json','channels.json','files.json'].some(f=>fs.existsSync(path.join(dataDir,f))))migrationBackup=roomState.backup(dataDir,opts.backupRoot||path.join(path.dirname(dataDir),'backups'),'Antes de adicionar identidade/revisão da sala.');
  const roomId=roomCode ? roomState.roomIdFor(roomCode) : null;
  let revision=Number(identity?.revision)||0;
  const snapshotLineage=rid(8);
  if(identity?.name)roomName=identity.name;
  let roomIcon=safeIcon(identity?.icon);
  let roomLook=safeLook(identity?.look); // capa, descrição e cor da sala
  const epoch = Number(opts.epoch) || 0; // aumenta a cada troca de anfitrião

  const filesDir = path.join(dataDir, 'files');
  fs.mkdirSync(filesDir, { recursive: true });
  const historyFile = path.join(dataDir, 'history.json');
  const filesIndex = path.join(dataDir, 'files.json');
  const channelsFile = path.join(dataDir, 'channels.json');
  let channels = null;
  let history = {}; // channelId -> [msg]
  let files = {};
  try { channels = JSON.parse(fs.readFileSync(channelsFile, 'utf8')); } catch {}
  if (!Array.isArray(channels) || !channels.length) channels = [{ id: 'geral', type: 'text', name: 'geral' }, { id: 'lobby', type: 'voice', name: 'Lobby' }];
  try {
    const h = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    history = Array.isArray(h) ? { [channels.find((c) => c.type === 'text').id]: h } : h; // migra formato antigo
  } catch {}
  try { files = JSON.parse(fs.readFileSync(filesIndex, 'utf8')); } catch {}
  // Troca de anfitrião: o novo anfitrião traz a cópia que tinha da sala
  const R = opts.restore || null;
  if(R?.code && roomState.norm(R.code)!==roomCode)throw new Error('Snapshot pertence a outro código.');
  const configGuard = identity && revision>Number(R?.revision||0) ? identity.configuration : R?.configuration || identity?.configuration;
  if(configGuard?.needsPassword && configGuard.passwordVerifier!==roomState.passwordVerifier(roomId,password))throw new Error('Use a senha original da sala para retomar esta cópia.');
  if(R?.name && (!identity || Number(R.revision||0)>=revision)){roomName=clean(R.name,40);if('icon' in R)roomIcon=safeIcon(R.icon);if('look' in R)roomLook=safeLook(R.look);}
  if (R && (!identity || Number(R.revision||0)>revision)) {
    if(!migrationBackup && ['history.json','channels.json'].some(f=>fs.existsSync(path.join(dataDir,f))))migrationBackup=roomState.backup(dataDir,opts.backupRoot||path.join(path.dirname(dataDir),'backups'),'Antes de restaurar snapshot mais novo.');
    if (Array.isArray(R.channels) && R.channels.some((c) => c.type === 'text') && R.channels.some((c) => c.type === 'voice')) {
      channels = R.channels.filter((c) => c && c.id && (c.type === 'text' || c.type === 'voice')).map((c) => ({ id: clean(c.id, 20), type: c.type, name: chanName(c.name, c.type) || 'canal' }));
    }
    if (R.history && typeof R.history === 'object') {
      history = {};
      for (const c of channels) if (c.type === 'text' && Array.isArray(R.history[c.id])) history[c.id] = R.history[c.id].slice(-DISK_HISTORY_LIMIT);
    }
    for (const list of Object.values(history)) for (const m of list) for (const a of m.attachments || []) if (a && a.id && !files[a.id]) files[a.id] = a;
  }
  // Restored copies come from other members: attachment ids and names must stay inside files/.
  for (const list of Object.values(history)) for (const m of list) if (m && Array.isArray(m.attachments)) m.attachments = m.attachments.map(safeAttachment).filter(Boolean);
  for (const [id, meta] of Object.entries(files)) { const safe = safeAttachment({ ...meta, id }); if (safe) files[id] = { ...meta, name: safe.name }; else delete files[id]; }
  for(const list of Object.values(history))for(const m of list)for(const a of m.attachments||[]){a.url=`/files/${a.id}/${encodeURIComponent(a.name)}`;a.unavailable=!fs.existsSync(path.join(filesDir,a.id,a.name));}
  revision=Math.max(revision,Number(R?.revision)||0);
  const textIds = () => channels.filter((c) => c.type === 'text').map((c) => c.id);
  const findMsg = (id) => { for (const [cid, list] of Object.entries(history)) { const i = list.findIndex((m) => m.id === id); if (i > -1) return { cid, list, i, msg: list[i] }; } return null; };

  const token = opts.token || rid(16); // token de acesso aos anexos (muda a cada vez que a sala abre)
  let saveTimer = null;
  const snapshotNow = () => roomCode ? roomState.makeSnapshot({code:roomCode,name:roomName,icon:roomIcon,look:roomLook,revision,updatedAt:Date.now(),lineage:snapshotLineage,channels,history,configuration:{needsPassword:!!password,passwordVerifier:password?roomState.passwordVerifier(roomId,password):''}}) : null;
  const saveNow = () => {
    persistRoomFiles({ history, files, channels, roomCode, roomState, historyFile, filesIndex, channelsFile, identityFile, roomId, roomName, roomIcon, roomLook, revision, snapshotLineage, snapshotNow, log, DISK_HISTORY_LIMIT });
    if(roomCode){const snap=snapshotNow();try{opts.onSnapshot?.(snap)}catch(e){log('erro na cópia local',e.message)}broadcast({t:'room-snapshot',snapshot:snap});}
  };
  const saveSoon = () => { revision++; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); };

  const clients = new Map(); // id -> { ws, user }
  const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
  const broadcast = (obj, exceptId) => {
    const data = JSON.stringify(obj);
    for (const [id, c] of clients) if (id !== exceptId && c.ws.readyState === 1) c.ws.send(data);
  };
  const systemMsg = (channelId, text) => {
    const cid = channelId && textIds().includes(channelId) ? channelId : textIds()[0];
    const msg = { id: rid(8), channelId: cid, userId: DJ_ID, name: 'DJ Resenha', color: '#f47b67', bot: true, text, attachments: [], ts: Date.now() };
    (history[cid] = history[cid] || []).push(msg); saveSoon();
    broadcast({ t: 'chat', msg });
  };

  // ---------------- DJ Resenha ----------------
  const dj = { active: false, channelId: null, queue: [], failed: [], generation: 0, current: null, loading: false, skipVotes: new Set(), kickVotes: new Set(), timer: null, idleTimer: null, textChannel: null, since: null };
  const djUser = () => ({ id: DJ_ID, name: 'DJ Resenha', color: '#f47b67', bot: true, avatar: null, voiceChannel: dj.channelId, muted: false, deafened: false, sharing: false, voiceSince: dj.since });
  const publicUsers = () => { const l = [...clients.values()].map((c) => c.user); if (dj.active) l.push(djUser()); return l; };
  const listeners = () => [...clients.values()].filter((c) => c.user.voiceChannel && c.user.voiceChannel === dj.channelId).map((c) => c.user.id);
  const needed = () => Math.floor(listeners().length / 2) + 1; // maioria (mais da metade)
  const pubItem = (it) => it && ({ id: it.id, title: it.title, duration: it.duration || 0, addedBy: it.addedBy, source: it.source, src: it.url || it.query, ready: !!it._file });
  const djState = () => ({
    active: dj.active, channelId: dj.channelId, loading: dj.loading, textChannel: dj.textChannel,
    current: dj.current && { ...pubItem(dj.current.item), url: `/dj/${dj.current.item.id}`, startedAt: dj.current.startedAt, pausedAt: dj.current.pausedAt || null },
    queue: dj.queue.map(pubItem), failed: dj.failed.map((it) => ({ ...pubItem(it), error: it.error })), skipVotes: [...dj.skipVotes], kickVotes: [...dj.kickVotes], needed: needed(),
  });
  const djBroadcast = () => broadcast({ t: 'dj', dj: djState() });

  function djPrefetch() {
    if (!djTools) return;
    // Download on demand: avoid overlapping yt-dlp jobs while gaming.
  }
  async function djNext() {
    const generation = ++dj.generation;
    if(dj.loadingItem)djTools?.cancel?.(dj.loadingItem);
    dj.loadingItem=null;
    clearTimeout(dj.timer);
    if (dj.current) { const old = dj.current.item; setTimeout(() => djTools && djTools.forget(old), 30000); }
    dj.current = null; dj.skipVotes.clear();
    if (!dj.active) return djBroadcast();
    const item = dj.queue.shift();
    if (!item) { dj.loading = false; djBroadcast(); return; }
    dj.loadingItem = item;
    dj.loading = true; djBroadcast();
    try {
      await djTools.fetchAudio(item);
    } catch (e) {
      if (generation !== dj.generation || !dj.active) return;
      item.error = e.message; dj.failed.push(item); if (dj.failed.length > 50) dj.failed.shift();
      dj.loading = false;
      systemMsg(dj.textChannel, `Não consegui tocar **${item.title}**: ${e.message}`);
      return djNext();
    }
    if (!dj.active || generation !== dj.generation) { djTools.forget(item); return; }
    dj.loading = false; dj.loadingItem=null;
    dj.current = { item, startedAt: Date.now() + 1200, pausedAt: null };
    scheduleEnd();
    djPrefetch();
    djBroadcast();
  }
  function scheduleEnd() {
    clearTimeout(dj.timer);
    const c = dj.current; if (!c || c.pausedAt || !c.item.duration) return;
    const left = c.startedAt + c.item.duration * 1000 - Date.now() + 1500;
    dj.timer = setTimeout(() => { if (dj.current === c) djNext(); }, Math.max(1000, left));
  }
  function djLeave(reason) {
    if (!dj.active) return;
    ++dj.generation;
    if(dj.loadingItem)djTools?.cancel?.(dj.loadingItem);
    dj.loadingItem=null;
    clearTimeout(dj.timer); clearTimeout(dj.idleTimer);
    if (dj.current && djTools) djTools.forget(dj.current.item);
    for (const it of dj.queue) if (djTools) djTools.forget(it);
    Object.assign(dj, { active: false, channelId: null, queue: [], failed: [], current: null, loading: false, since: null });
    dj.skipVotes.clear(); dj.kickVotes.clear();
    broadcast({ t: 'user-leave', id: DJ_ID });
    djBroadcast();
    if (reason) systemMsg(dj.textChannel, reason);
  }
  function djCheckIdle() {
    clearTimeout(dj.idleTimer);
    if (dj.active && !listeners().length) dj.idleTimer = setTimeout(() => { if (!listeners().length) djLeave('Saí da call porque ficou vazia. 👋'); }, 120000);
  }
  function djVoteCheck() {
    const L = new Set(listeners());
    for (const v of [...dj.skipVotes]) if (!L.has(v)) dj.skipVotes.delete(v);
    for (const v of [...dj.kickVotes]) if (!L.has(v)) dj.kickVotes.delete(v);
    if (dj.current && dj.skipVotes.size && dj.skipVotes.size >= needed()) { systemMsg(dj.textChannel, `⏭️ Votação aprovada: pulei **${dj.current.item.title}**.`); djNext(); return; }
    if (dj.kickVotes.size && dj.kickVotes.size >= needed()) { djLeave('Fui removido da call por votação. Até a próxima! 🎧'); return; }
    djBroadcast();
  }

  async function handleDJ(u, m) {
    const ws = clients.get(u.id) && clients.get(u.id).ws;
    const inDJChan = !!u.voiceChannel && u.voiceChannel === dj.channelId;
    if (['dj-skip', 'dj-kick', 'dj-remove', 'dj-retry', 'dj-pause'].includes(m.t) && !inDJChan) throw new Error('Entre no canal de voz do DJ para usar esse controle.');
    switch (m.t) {
      case 'dj-summon': {
        if (!djTools) return send(ws, { t: 'error', msg: 'O DJ não está disponível nesta sala.' });
        if (!u.voiceChannel) return send(ws, { t: 'error', msg: 'Entre numa call primeiro.' });
        if (dj.active) {
          if (dj.channelId !== u.voiceChannel) { dj.channelId = u.voiceChannel; dj.skipVotes.clear(); dj.kickVotes.clear(); broadcast({ t: 'user-update', user: djUser() }); djBroadcast(); djCheckIdle(); }
          return;
        }
        Object.assign(dj, { active: true, channelId: u.voiceChannel, since: Date.now(), textChannel: m.textChannel || null });
        broadcast({ t: 'user-join', user: djUser() });
        djBroadcast();
        systemMsg(dj.textChannel, `🎧 Cheguei! Cola um link do YouTube ou Spotify (ou o nome da música) no meu painel. Chamado por **${u.name}**.`);
        djTools.ensure().catch((e) => systemMsg(dj.textChannel, 'Não consegui preparar o player: ' + e.message));
        break;
      }
      case 'dj-add': {
        if (!dj.active) return;
        send(ws, { t: 'dj-busy', busy: true });
        const session = dj.since;
        try {
          const items = await djTools.resolve(clean(m.input, 500));
          // The DJ may have left or been summoned again while the link was resolved.
          if (!dj.active || dj.since !== session) throw new Error('O DJ saiu da call antes de adicionar a música.');
          for (const it of items) it.addedBy = u.name;
          dj.queue.push(...items);
          if (dj.queue.length > 500) dj.queue.length = 500;
          systemMsg(dj.textChannel, items.length === 1 ? `➕ **${u.name}** adicionou **${items[0].title}**` : `➕ **${u.name}** adicionou ${items.length} músicas`);
          if (!dj.current && !dj.loading) djNext(); else { djPrefetch(); djBroadcast(); }
        } catch (e) {
          if (m.requestId) throw new Error('DJ: ' + e.message);
          send(ws, { t: 'error', msg: 'DJ: ' + e.message });
        } finally { send(ws, { t: 'dj-busy', busy: false }); }
        break;
      }
      case 'dj-retry': {
        if (!inDJChan) break;
        const index = dj.failed.findIndex((it) => it.id === m.id);
        if (index < 0) throw new Error('Essa música não está mais na lista de falhas.');
        const [item] = dj.failed.splice(index, 1); delete item.error; dj.queue.unshift(item);
        if (!dj.current && !dj.loading) djNext(); else djBroadcast();
        break;
      }
      case 'dj-skip':
        if (!dj.active || (!dj.current && !dj.loading)) throw new Error('Não há música para pular.');
        djNext(); break;
      case 'dj-kick':
        if (!dj.active) throw new Error('O DJ já saiu da call.');
        djLeave('DJ removido da call.'); break;
      case 'dj-vote-skip': if (inDJChan && dj.current) { if (dj.skipVotes.has(u.id)) dj.skipVotes.delete(u.id); else dj.skipVotes.add(u.id); djVoteCheck(); } break;
      case 'dj-vote-kick': if (inDJChan) { if (dj.kickVotes.has(u.id)) dj.kickVotes.delete(u.id); else dj.kickVotes.add(u.id); djVoteCheck(); } break;
      case 'dj-remove': {
        const i = dj.queue.findIndex((x) => x.id === m.id);
        if (i < 0) throw new Error('Essa música não está mais na fila.');
        if (i > -1 && inDJChan) { djTools.forget(dj.queue[i]); dj.queue.splice(i, 1); djBroadcast(); }
        break;
      }
      case 'dj-pause': {
        const c = dj.current; if (!c) throw new Error('Não há música para pausar.');
        if (c.pausedAt) { c.startedAt += Date.now() - c.pausedAt; c.pausedAt = null; scheduleEnd(); }
        else { c.pausedAt = Date.now(); clearTimeout(dj.timer); }
        djBroadcast();
        break;
      }
      case 'dj-ended': { // aviso do cliente quando a duração era desconhecida
        const c = dj.current;
        if (c && c.item.id === m.id && !c.pausedAt && Date.now() - c.startedAt > 5000) djNext();
        break;
      }
    }
  }

  // ---------------- HTTP ----------------
  // DJ que estava tocando na sala antiga: volta com a fila (a música atual é pulada)
  let djRestoreTimer = null;
  if (R && R.dj && R.dj.active && djTools) {
    const queue = (Array.isArray(R.dj.queue) ? R.dj.queue : []).filter((q) => q && q.src).slice(0, 500).map((q) => ({
      id: rid(6), title: clean(q.title, 200), duration: Number(q.duration) || 0, addedBy: clean(q.addedBy, 32), source: clean(q.source, 20),
      ...(String(q.src).startsWith('ytsearch') ? { query: String(q.src) } : { url: String(q.src) }),
    }));
    djRestoreTimer = setTimeout(() => {
      djRestoreTimer = null;
      Object.assign(dj, { active: true, channelId: R.dj.channelId, since: Date.now(), textChannel: R.dj.textChannel || null, queue });
      if (!channels.some((c) => c.id === dj.channelId && c.type === 'voice')) dj.channelId = channels.find((c) => c.type === 'voice').id;
      broadcast({ t: 'user-join', user: djUser() });
      djCheckIdle();
      if (queue.length) djNext(); else djBroadcast();
    }, 3000);
  }

  // ---------------- HTTP ----------------
  const cors = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, Range');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  };
  const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  const { handleUpload, serveFile } = createFileHTTP({ token, maxUpload, filesDir, files, saveSoon, json, safeFileName, rid, mimeOf });
  const banners = createBannerHTTP({ dataDir, clients, token, json, broadcast: (msg) => broadcast(msg), rid });

  let secureServer = null, publicCA = null;
  const requestHandler = (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
    const p = url.pathname;

    if(p === '/mobile-setup') {
      const ip=String(req.headers.host||'').split(':')[0];
      if(!require('net').isIP(ip)) { res.writeHead(400);return res.end('Abra pelo IP local do anfitrião.'); }
      const secureURL=secureServer ? `https://${ip}:${secureServer.address().port}/` : '';
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      return res.end(`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resenha no celular</title><link rel="stylesheet" href="/app/mobile-setup.css"><main><img width="90" src="/app/brand-pipoca.png" alt="Pipoca"><h1>Seu Resenha no celular</h1><p>Use o mesmo Wi-Fi do anfitrião. Para falar na call, configure o certificado deste computador uma vez.</p><ol><li><a href="/resenha-local.cer">Baixar certificado local</a>. Instale somente se você confia no anfitrião.</li><li><b>iPhone:</b> Ajustes → Geral → VPN e Gerenciamento de Dispositivo → perfil baixado → Instalar. Depois Geral → Sobre → Ajustes de Confiança de Certificados → ativar confiança total no certificado Resenha.</li><li><b>Android:</b> Configurações → Segurança → Criptografia e credenciais (ou Mais configurações de segurança) → Instalar certificado → Certificado CA. Escolha o arquivo baixado. O nome dos menus varia por aparelho.</li><li><a href="${secureURL}">Abrir Resenha com voz</a> e permitir o microfone quando entrar no canal.</li></ol><p>Se surgir “Sua conexão não é particular” ou “Esta conexão não é privada”, a confiança ainda não foi estabelecida. Volte à configuração do certificado; apenas ignorar o aviso não garante voz.</p><p>Essa confiança permite validar certificados assinados pelo anfitrião. Você pode removê-la nas configurações de certificados/perfis do aparelho. Não compartilhe chaves privadas.</p><p>Sem instalar: <a href="/">entrar por HTTP para chat e assistir</a>, sem microfone. Use fone. Chamadas em segundo plano não são garantidas.</p></main></html>`);
    }
    if (p === '/resenha-local.cer' && publicCA) { res.writeHead(200, {'Content-Type':'application/pkix-cert','Content-Disposition':'attachment; filename=Resenha-local.cer'}); return res.end(publicCA); }
    if (p === '/api/info') return json(res, 200, { app: 'resenha', name: roomName, needsPassword: !!password, users: clients.size });
    if (p === '/upload' && req.method === 'POST') return handleUpload(req, res, url);
    if (p === '/banner' && req.method === 'POST') return banners.handleBannerUpload(req, res, url);
    if (p.startsWith('/banner/')) {
      if (url.searchParams.get('t') !== token) { res.writeHead(403); return res.end('sem permissão'); }
      const b = banners.bannerFile(p.split('/')[2] || '');
      if (!b) { res.writeHead(404); return res.end('não encontrado'); }
      return serveFile(req, res, b.file, b.type, false, '');
    }
    if (p.startsWith('/files/')) {
      if (url.searchParams.get('t') !== token) { res.writeHead(403); return res.end('sem permissão'); }
      const [, , id] = p.split('/');
      const meta = files[id];
      if (!meta) { res.writeHead(404); return res.end('não encontrado'); }
      const filePath = path.resolve(filesDir, id, meta.name);
      if (!filePath.startsWith(path.resolve(filesDir) + path.sep)) { res.writeHead(403); return res.end('sem permissão'); }
      return serveFile(req, res, filePath, meta.type || mimeOf(meta.name), url.searchParams.has('dl'), meta.name);
    }
    if (p.startsWith('/dj/')) {
      if (url.searchParams.get('t') !== token) { res.writeHead(403); return res.end(); }
      const id = p.split('/')[2];
      const it = (dj.current && dj.current.item.id === id && dj.current.item) || dj.queue.find((x) => x.id === id);
      if (!it || !it._file) { res.writeHead(404); return res.end(); }
      return serveFile(req, res, it._file, mimeOf(it._file), false, '');
    }
    // Same-origin web viewer; can also run behind an HTTPS reverse proxy.
    if (req.method === 'GET' && (p === '/' || p.startsWith('/app/'))) {
      const appDir = path.resolve(__dirname, '../app');
      let relative;
      try { relative = p === '/' ? 'index.html' : decodeURIComponent(p.slice(5)); } catch { res.writeHead(400); return res.end(); }
      const file = path.resolve(appDir, relative);
      if (!file.startsWith(appDir + path.sep)) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
      res.setHeader('Cache-Control', 'no-cache');
      if (p === '/') {
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        return res.end(fs.readFileSync(file, 'utf8').replace('<head>', '<head><base href="/app/">'));
      }
      return serveFile(req, res, file, path.extname(file) === '.wasm' ? 'application/wasm' : mimeOf(file), false, '');
    }
    res.writeHead(404); res.end();
  };
  const httpServer = http.createServer(requestHandler);

  const handleTextCommand = createTextCommands({ clients, send, broadcast, cleanText, clean, validAvatar, rid, textIds, files, history, findMsg, saveSoon });

  // ---------------- WebSocket ----------------
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 256 * 1024 });
  wss.on('error', () => {}); // erros do servidor HTTP (porta ocupada etc.) são tratados no listen()

  wss.on('connection', (ws) => {
    let id = null;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const helloTimer = setTimeout(() => { if (!id) ws.close(4000, 'sem hello'); }, 15000);

    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string') return;
      if (!id) {
        if (m.t !== 'hello') return;
        if (password && m.password !== password) { send(ws, { t: 'error', code: 'password', msg: 'Senha incorreta' }); return ws.close(4001, 'senha'); }
        clearTimeout(helloTimer);
        // The public id is derived from a private 256-bit bearer credential, never from
        // a caller-supplied cid. It remains verifiable after restart/host transfer without
        // placing a secret in the public room snapshot. 40 hex chars fit snapshot userId.
        let old = null;
        if (typeof m.identitySecret === 'string' && /^[a-f0-9]{64}$/.test(m.identitySecret)) {
          id = crypto.createHash('sha256').update('resenha-client-v1:' + m.identitySecret).digest('hex').slice(0, 40);
          old = clients.get(id);
        } else {
          // Legacy clients can resume a live connection with its private key, but may
          // never claim an offline/historical identity by supplying its public id.
          if (typeof m.resume === 'string') old = [...clients.values()].find(c => c.resume === m.resume);
          id = old ? old.user.id : rid(6);
        }
        if (old) { clients.delete(id); try { old.ws.terminate(); } catch {} }
        const user = {
          id, name: clean(m.name, 32) || 'Anônimo', color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#5865f2',
          avatar: validAvatar(m.avatar), voiceChannel: null, muted: false, deafened: false, sharing: false, screenStreamId: null, voiceSince: null,
          isHost: !!m.hostKey && m.hostKey === opts.hostKey,
          ...(m.canHost === true ? { canHost: true } : {}), // app de PC (o navegador do celular não hospeda); ausente nos clientes antigos
          joinedAt: Number(m.joinedAt) > 0 ? Number(m.joinedAt) : Date.now(),
        };
        applyProfileExtras(user, m);
        const resume = rid(16); // private to this connection; never broadcast
        clients.set(id, { ws, user, resume });
        const hist = {};
        for (const cid of textIds()) hist[cid] = (history[cid] || []).slice(-WELCOME_HISTORY_LIMIT);
        send(ws, { t: 'welcome', id, resume, token, code: roomCode ? roomCode.slice(0,4)+'-'+roomCode.slice(4) : null, epoch, turn: opts.turn || null, room: { name: roomName, icon: roomIcon, look: roomLook }, version: SERVER_VERSION, features: FEATURES, serverTime: Date.now(), users: publicUsers(), channels, history: hist, dj: djState(), djAvailable: !!djTools });
        if (old) broadcast({ t: 'user-update', user }, id); else broadcast({ t: 'user-join', user }, id);
        if(roomCode)send(ws,{t:'room-snapshot',snapshot:snapshotNow()});
        log(`${user.name} entrou (${clients.size} na sala)`);
        return;
      }
      const c = clients.get(id); if (!c || c.ws !== ws) return;
      const u = c.user;
      if (typeof m.t === 'string' && m.t.startsWith('dj-')) {
        Promise.resolve(handleDJ(u, m)).then(() => {
          if (m.requestId) send(ws, { t: 'command-result', requestId: m.requestId, ok: true });
        }).catch((error) => send(ws, { t: 'command-result', requestId: m.requestId, ok: false, error: error.message }));
        return;
      }
      if (['dm', 'profile', 'chat', 'edit', 'delete'].includes(m.t)) { handleTextCommand({ id, u, m, ws }); return; }
      switch (m.t) {
        case 'state': {
          if ('voiceChannel' in m) {
            const vc = m.voiceChannel && channels.some((x) => x.id === m.voiceChannel && x.type === 'voice') ? m.voiceChannel : null;
            if (vc !== u.voiceChannel) {
              u.voiceSince = vc ? Date.now() : null;
              if (!vc) { u.sharing = false; u.screenStreamId = null; }
              u.voiceChannel = vc;
              setTimeout(() => { djCheckIdle(); if (dj.active) djVoteCheck(); }, 0);
            }
          }
          if (typeof m.muted === 'boolean') u.muted = m.muted;
          if (typeof m.deafened === 'boolean') u.deafened = m.deafened;
          if (typeof m.sharing === 'boolean') u.sharing = m.sharing && !!u.voiceChannel;
          if ('screenStreamId' in m) u.screenStreamId = u.sharing ? clean(m.screenStreamId, 80) : null;
          broadcast({ t: 'user-update', user: u });
          break;
        }
        case 'ch-create': {
          const type = m.type === 'voice' ? 'voice' : 'text';
          const name = chanName(m.name, type);
          if (!name || channels.length >= CHANNEL_CREATION_LIMIT) return;
          channels.push({ id: rid(5), type, name }); saveSoon();
          broadcast({ t: 'channels', channels });
          break;
        }
        case 'ch-rename': {
          const ch = channels.find((x) => x.id === m.id); if (!ch) return;
          const name = chanName(m.name, ch.type); if (!name) return;
          ch.name = name; saveSoon();
          broadcast({ t: 'channels', channels });
          break;
        }
        case 'ch-delete': {
          const ch = channels.find((x) => x.id === m.id); if (!ch) return;
          if (channels.filter((x) => x.type === ch.type).length <= 1) return send(ws, { t: 'error', msg: `Precisa ter pelo menos um canal de ${ch.type === 'text' ? 'texto' : 'voz'}.` });
          if (ch.type === 'text' && history[ch.id]?.length) {
            // Keep a local copy of the deleted conversation on the host before it disappears for everyone.
            try { roomState.atomic(path.join(opts.backupRoot || path.join(path.dirname(dataDir), 'backups'), `${Date.now()}-canal-${safeFileName(ch.name)}.json`), { reason: 'Canal de texto excluído por ' + u.name, roomCode, channel: ch, messages: history[ch.id] }); } catch (e) { log('backup do canal falhou', e.message); }
          }
          channels = channels.filter((x) => x.id !== ch.id);
          if (ch.type === 'text') delete history[ch.id];
          else {
            for (const cl of clients.values()) if (cl.user.voiceChannel === ch.id) { cl.user.voiceChannel = null; cl.user.sharing = false; cl.user.voiceSince = null; broadcast({ t: 'user-update', user: cl.user }); }
            if (dj.channelId === ch.id) djLeave();
          }
          saveSoon();
          broadcast({ t: 'channels', channels });
          break;
        }
        case 'ch-order': {
          if (!Array.isArray(m.ids)) return;
          const map = new Map(channels.map((x) => [x.id, x]));
          const next = [...new Set(m.ids)].map((i) => map.get(i)).filter(Boolean);
          if (next.length !== channels.length) return;
          channels = next; saveSoon();
          broadcast({ t: 'channels', channels });
          break;
        }
        case 'typing': broadcast({ t: 'typing', id, channelId: m.channelId }, id); break;
        case 'signal': {
          const target = clients.get(m.to);
          if (target) send(target.ws, { t: 'signal', from: id, data: m.data });
          break;
        }
        case 'room': if (u.isHost && (m.name || typeof m.icon === 'string' || (m.look && typeof m.look === 'object'))) {
          if (m.name) roomName = clean(m.name, 40) || roomName;
          if (typeof m.icon === 'string') roomIcon = safeIcon(m.icon); // '' removes the icon
          if (m.look && typeof m.look === 'object') roomLook = safeLook(m.look); // {} limpa tudo
          saveSoon(); broadcast({ t: 'room', room: { name: roomName, icon: roomIcon, look: roomLook } });
        } break;
        // Transferir anfitrião: só o anfitrião pede; todos ficam sabendo quem assume e a troca automática faz o resto.
        case 'transfer-host': {
          const target = clients.get(m.to);
          if (u.isHost && target && target.user.id !== id && target.user.canHost) broadcast({ t: 'host-transfer', to: target.user.id, by: id });
          break;
        }
        case 'ping': send(ws, { t: 'pong', ts: m.ts, serverTime: Date.now() }); break;
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (id && clients.has(id) && clients.get(id).ws === ws) {
        const name = clients.get(id).user.name;
        clients.delete(id);
        broadcast({ t: 'user-leave', id });
        log(`${name} saiu (${clients.size} na sala)`);
        djCheckIdle(); if (dj.active) djVoteCheck();
      }
    });
    ws.on('error', () => {});
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false; try { ws.ping(); } catch {}
    }
  }, 20000);

  if(roomCode)saveNow();
  return {
    port,
    roomInfo: () => ({roomId,code:roomCode,revision,migrationBackup}),
    snapshot: snapshotNow,
    clientCount: () => clients.size,
    async listenSecure(tls, securePort = 0) {
      publicCA = tls.publicCA;
      const srv = require('https').createServer({key:tls.key,cert:tls.cert},requestHandler);
      srv.on('upgrade',(req,socket,head)=>httpServer.emit('upgrade',req,socket,head));
      await new Promise((resolve,reject)=>{srv.once('error',reject);srv.listen(securePort,'0.0.0.0',resolve)});
      secureServer=srv;return srv.address().port;
    },
    listen() {
      return new Promise((resolve, reject) => {
        // '::' escuta IPv4 e IPv6 ao mesmo tempo
        const done = () => { log(`sala "${roomName}" aberta na porta ${port}`); resolve(port); };
        const onErr = (e) => {
          if (e.code === 'EAFNOSUPPORT' || e.code === 'EADDRNOTAVAIL') { httpServer.once('error', reject); httpServer.listen(port, '0.0.0.0', done); }
          else reject(e);
        };
        httpServer.once('error', onErr);
        httpServer.listen({ port, host: '::', ipv6Only: false }, done);
      });
    },
    // code: 4002 = sala encerrada pra todos; 4003 = anfitrião saiu, outro assume; 4004 = já existe outro anfitrião
    close(code = 4002) {
      if(secureServer) { secureServer.close(); secureServer.closeAllConnections(); }
      clearInterval(heartbeat);
      clearTimeout(saveTimer);
      clearTimeout(djRestoreTimer); djRestoreTimer = null; // do not start downloads for a closed room
      if (dj.active) djLeave();
      saveNow();
      for (const ws of wss.clients) { try { ws.close(code, 'sala'); } catch {} }
      return new Promise((r) => { wss.close(); httpServer.close(() => r()); setTimeout(r, 1500); });
    },
  };
}

module.exports = { createServer, DJ_ID };

if (require.main === module) {
  const { DJTools } = require('./dj');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
  const dataDir = arg('data', path.join(process.cwd(), 'resenha-data'));
  const dj = new DJTools({ binDir: path.join(dataDir, 'bin'), cacheDir: path.join(dataDir, 'dj-cache'), nodePath: process.execPath });
  const s = createServer({ port: arg('port', 7777), password: arg('password', ''), roomName: arg('name', 'Sala'), dataDir, dj });
  s.listen().catch((e) => { console.error(e.message); process.exit(1); });
}
