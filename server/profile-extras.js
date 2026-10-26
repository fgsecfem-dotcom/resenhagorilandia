// 2.0 profile extras: status, short bio, name colour and a banner (photo or GIF).
// Text fields travel with the user object; the banner image is uploaded once per host over HTTP and
// fetched by viewers on demand, so a multi-MB GIF never goes through the WebSocket.
const fs = require('fs');
const path = require('path');

const MAX_BANNER = 8 * 1024 * 1024;
const BANNER_TYPES = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '');
// 2.1.5: efeito animado do nome (holográfico, neon…). Só nomes da lista; o resto vira ''.
const NAME_FX = ['holo', 'rainbow', 'neon', 'ouro', 'fogo', 'gelo', 'glitch'];
const line = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

// Copies the optional extras from a hello/profile message onto the user (only keys that are present).
function applyProfileExtras(u, m) {
  if ('status' in m) u.status = line(m.status, 40);
  if ('bio' in m) u.bio = line(m.bio, 140);
  if ('nameColor' in m) u.nameColor = hex(m.nameColor);
  if ('bannerColor' in m) u.bannerColor = hex(m.bannerColor);
  if ('nameFx' in m) u.nameFx = NAME_FX.includes(m.nameFx) ? m.nameFx : '';
  if ('banner' in m && !m.banner) u.banner = ''; // removing is allowed; setting needs an upload
}

function createBannerHTTP({ dataDir, clients, token, json, broadcast, rid }) {
  const dir = path.join(dataDir, 'banners');
  const store = new Map(); // uid -> { file, type }
  const fileFor = (uid) => path.join(dir, uid);

  // POST /banner?t=<room token>&u=<uid>&k=<that connection's resume key>
  function handleBannerUpload(req, res, url) {
    const uid = url.searchParams.get('u') || '', c = clients.get(uid);
    if (url.searchParams.get('t') !== token || !c || url.searchParams.get('k') !== c.resume) return json(res, 403, { error: 'Sem permissão' });
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!BANNER_TYPES[type]) return json(res, 415, { error: 'Use foto ou GIF (png, jpg, gif ou webp).' });
    if (Number(req.headers['content-length'] || 0) > MAX_BANNER) return json(res, 413, { error: 'Banner grande demais (máximo 8 MB).' });
    fs.mkdirSync(dir, { recursive: true });
    const tmp = fileFor(uid) + '.tmp', out = fs.createWriteStream(tmp);
    let size = 0, failed = false;
    const fail = (code, error) => { if (failed) return; failed = true; out.destroy(); fs.rm(tmp, { force: true }, () => {}); json(res, code, { error }); };
    req.on('data', (chunk) => { size += chunk.length; if (size > MAX_BANNER) { fail(413, 'Banner grande demais (máximo 8 MB).'); req.destroy(); } });
    req.on('aborted', () => fail(400, 'Envio interrompido.'));
    out.on('error', (e) => fail(500, e.message));
    req.pipe(out);
    out.on('finish', () => {
      if (failed) return;
      fs.renameSync(tmp, fileFor(uid));
      store.set(uid, { file: fileFor(uid), type });
      const now = clients.get(uid);
      if (now) { now.user.banner = rid(6); broadcast({ t: 'user-update', user: now.user }); }
      json(res, 200, { ok: true, banner: now?.user.banner || '' });
    });
  }

  // GET /banner/<uid>?t=<room token>
  function bannerFile(uid) { return store.get(uid) || null; }
  function forget(uid) { store.delete(uid); fs.rm(fileFor(uid), { force: true }, () => {}); }

  return { handleBannerUpload, bannerFile, forget };
}

module.exports = { applyProfileExtras, createBannerHTTP, MAX_BANNER, NAME_FX };
