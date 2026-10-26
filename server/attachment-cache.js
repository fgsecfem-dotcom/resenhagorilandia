const fs = require('fs');
const path = require('path');
function createAttachmentCache({ getUserData }) {
const CACHE_MAX = 50 * 1024 * 1024;
const cacheRoot = () => path.join(getUserData(), 'anexos-cache');
const codeKey = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'sem-codigo';
const safeName = (s) => String(s || 'arquivo').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'arquivo';
const cacheQueue = []; let cacheBusy = 0;
function pumpCache() {
  while (cacheBusy < 2 && cacheQueue.length) {
    const job = cacheQueue.shift(); cacheBusy++;
    downloadToFile(job.url, job.dest).catch(() => {}).finally(() => { cacheBusy--; pumpCache(); });
  }
}
function downloadToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => { try { fs.renameSync(tmp, dest); resolve(); } catch (e) { reject(e); } });
      out.on('error', reject); res.on('error', reject);
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}
const cacheFile = (e, f) => {
  if (!f || !f.url || !f.id || !/^http:\/\//.test(f.url) || !(f.size > 0) || f.size > CACHE_MAX) return false;
  const dest = path.join(cacheRoot(), codeKey(f.code), safeName(f.id), safeName(f.name));
  if (fs.existsSync(dest) || cacheQueue.some((j) => j.dest === dest)) return true;
  cacheQueue.push({ url: f.url, dest }); pumpCache();
  return true;
};
function restoreCachedFiles(code, restore, dataDir) {
  try {
    for (const list of Object.values(restore.history || {})) for (const m of list || []) for (const a of m.attachments || []) {
      if (!a || !a.id || !a.name) continue;
      const src = path.join(cacheRoot(), codeKey(code), safeName(a.id), safeName(a.name));
      const dst = path.join(dataDir, 'files', safeName(a.id), safeName(a.name));
      if (fs.existsSync(src) && !fs.existsSync(dst)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
    }
  } catch (err) { console.log('[cache] restaurar falhou', err.message); }
}

  return { cacheFile, restoreCachedFiles };
}
module.exports = { createAttachmentCache };
