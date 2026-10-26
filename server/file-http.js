const fs = require('fs');
const path = require('path');

function createFileHTTP({ token, maxUpload, filesDir, files, saveSoon, json, safeFileName, rid, mimeOf }) {
  function handleUpload(req, res, url) {
    if (url.searchParams.get('t') !== token) return json(res, 403, { error: 'Sem permissão' });
    const len = Number(req.headers['content-length'] || 0);
    if (len > maxUpload) return json(res, 413, { error: 'Arquivo grande demais' });
    // URLSearchParams already decodes once; a literal '%' is a valid filename.
    const name = safeFileName(url.searchParams.get('name') || 'arquivo');
    const id = rid(8);
    const dir = path.join(filesDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, name);
    const out = fs.createWriteStream(dest);
    let size = 0; let aborted = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxUpload && !aborted) { aborted = true; req.destroy(); out.destroy(); fs.rm(dir, { recursive: true, force: true }, () => {}); json(res, 413, { error: 'Arquivo grande demais' }); }
    });
    req.pipe(out);
    out.on('finish', () => {
      if (aborted) return;
      const type = (req.headers['content-type'] && req.headers['content-type'] !== 'application/octet-stream') ? req.headers['content-type'] : mimeOf(name);
      const meta = { id, name, size, type, url: `/files/${id}/${encodeURIComponent(name)}` };
      files[id] = meta; saveSoon();
      json(res, 200, meta);
    });
    out.on('error', (e) => { if (!aborted) json(res, 500, { error: e.message }); });
    req.on('aborted', () => { aborted = true; out.destroy(); fs.rm(dir, { recursive: true, force: true }, () => {}); });
  }

  function serveFile(req, res, filePath, type, download, name) {
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end('não encontrado'); }
      const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': res.getHeader('Cache-Control') || 'private, max-age=86400' };
      if (download) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
      const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
      if (range) {
        let start = range[1] === '' ? st.size - Number(range[2]) : Number(range[1]);
        let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : st.size - 1;
        if (start < 0) start = 0; if (end >= st.size) end = st.size - 1;
        if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(filePath).pipe(res);
    });
  }

  return { handleUpload, serveFile };
}
module.exports = { createFileHTTP };
