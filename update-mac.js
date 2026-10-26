// Atualização automática no Mac: baixa o ZIP da release, confere o SHA-256 (SHA256SUMS-mac.txt), descompacta com o
// ditto do sistema (mantém links e permissões do .app), e na saída um script troca o Resenha.app pelo novo e reabre.
// Se a troca falhar, o script devolve o app antigo. O app novo confirma ao abrir; aí o backup é apagado.
// Baixado pelo próprio app (não pelo navegador), o ZIP não recebe a marca de quarentena; mesmo assim ela é removida.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawn, spawnSync } = require('child_process'), { pipeline } = require('stream/promises');
const discovery = require('./updater');
const MAX_ZIP = 600 * 1024 * 1024;
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const atomic = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d)); fs.renameSync(f + '.tmp', f); };
const hashFile = (f) => new Promise((res, rej) => { const h = crypto.createHash('sha256'), s = fs.createReadStream(f); s.on('data', (c) => h.update(c)); s.on('error', rej); s.on('end', () => res(h.digest('hex'))); });
const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

class MacUpdater {
  constructor(mgr) { this.m = mgr; this.bundle = path.resolve(mgr.appDir, '..', '..'); this.file = path.join(mgr.cache, 'mac-pending.json'); }
  // O app precisa estar num Resenha.app de verdade, numa pasta em que dá para gravar (ex.: /Applications de um admin).
  validate() {
    const b = this.bundle;
    if (!/\.app$/i.test(b) || !fs.existsSync(path.join(b, 'Contents', 'Info.plist'))) throw new Error('Pasta do app não reconhecida. Use a atualização manual.');
    if (read(path.join(b, 'Contents', 'Resources', 'app', 'package.json'))?.name !== 'resenha') throw new Error('Pasta do app não reconhecida. Use a atualização manual.');
    if (/^\/Volumes\//.test(b) || b.includes('/AppTranslocation/')) throw new Error('Abra o Resenha a partir da pasta Aplicativos para atualizar automaticamente.');
    const probe = path.join(path.dirname(b), '.resenha-write-' + crypto.randomBytes(4).toString('hex'));
    fs.mkdirSync(probe); fs.rmdirSync(probe);
  }
  pending() { return read(this.file); }
  async prepare(info) {
    this.validate();
    const id = crypto.randomUUID(), root = path.join(this.m.cache, 'mac-' + id), zip = path.join(root, 'download.zip'), staging = path.join(root, 'staging');
    fs.mkdirSync(staging, { recursive: true });
    try {
      const hr = await discovery.request(info.hashUrl, 8, this.m.options); if (hr.statusCode !== 200) { hr.resume(); throw new Error('Não foi possível baixar o SHA256SUMS-mac.txt.'); }
      const sums = await discovery.body(hr, 64 * 1024), line = sums.split(/\r?\n/).map((l) => /^([a-f0-9]{64})\s+\*?(.+?)\s*$/i.exec(l)).filter((x) => x && x[2] === info.name);
      if (line.length !== 1) throw new Error('SHA256SUMS-mac.txt não contém um hash único para este arquivo.');
      const expected = line[0][1].toLowerCase();
      this.m.emit({ phase: 'downloading', info, percent: 0 });
      const res = await discovery.request(info.url, 8, this.m.options); if (res.statusCode !== 200) { res.resume(); throw new Error('Download falhou (HTTP ' + res.statusCode + ').'); }
      const total = Number(res.headers['content-length']) || info.size; let got = 0, last = -1;
      if (total > MAX_ZIP) { res.destroy(); throw new Error('Pacote acima do limite de 600 MiB.'); }
      res.on('data', (c) => { got += c.length; const p = total ? Math.min(100, Math.floor(got / total * 100)) : 0; if (p !== last) { last = p; this.m.emit({ phase: 'downloading', info, percent: p, downloadedBytes: got, totalBytes: total || null }); } });
      await pipeline(res, fs.createWriteStream(zip)); if (total && got !== total) throw new Error('Download incompleto.');
      this.m.emit({ phase: 'verifying', info });
      if (await hashFile(zip) !== expected) throw new Error('Hash SHA-256 incorreto. A atualização foi recusada.');
      this.m.emit({ phase: 'extracting', info });
      const x = spawnSync('/usr/bin/ditto', ['-x', '-k', zip, staging], { stdio: 'ignore', timeout: 5 * 60 * 1000 });
      if (x.status !== 0) throw new Error('Não foi possível descompactar o pacote.');
      const app = path.join(staging, 'Resenha.app'), pkg = read(path.join(app, 'Contents', 'Resources', 'app', 'package.json'));
      if (pkg?.name !== 'resenha' || pkg?.version !== info.version) throw new Error('Versão ou identidade do pacote inválida.');
      spawnSync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', app], { stdio: 'ignore' });
      try { fs.unlinkSync(zip); } catch {}
      atomic(this.file, { id, root, app, target: this.bundle, version: info.version, info });
      this.m.log('update-staged', { version: info.version, root, platform: 'darwin' }); this.m.emit({ phase: 'ready', info });
      return { ok: true, ready: true };
    } catch (e) { fs.rmSync(root, { recursive: true, force: true }); throw e; }
  }
  // Script que espera o app fechar, troca o bundle (com volta em caso de erro) e reabre o Resenha.
  launch() {
    const p = this.pending(); if (!p || !fs.existsSync(p.app) || p.target !== this.bundle) return false;
    this.validate();
    const backup = path.join(path.dirname(this.bundle), '.Resenha-backup-' + p.id + '.app'), log = path.join(p.root, 'swap.log'), script = path.join(p.root, 'swap.sh');
    fs.writeFileSync(script, [
      '#!/bin/sh',
      `PID=${process.pid}; T=${q(p.target)}; N=${q(p.app)}; B=${q(backup)}`,
      'i=0; while kill -0 "$PID" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.2; i=$((i+1)); done',
      'if mv "$T" "$B" && mv "$N" "$T"; then echo ok; else echo falhou; [ -d "$B" ] && [ ! -d "$T" ] && mv "$B" "$T"; fi',
      'open "$T"',
    ].join('\n') + '\n', { mode: 0o755 });
    atomic(this.file, { ...p, backup, launchedAt: Date.now() });
    const out = fs.openSync(log, 'a');
    const child = spawn('/bin/sh', [script], { detached: true, stdio: ['ignore', out, out] }); fs.closeSync(out);
    child.on('error', (e) => { this.m.log('update-helper-error', { error: e.message, platform: 'darwin' }); try { fs.unlinkSync(this.file); } catch {} });
    child.unref();
    this.m.log('update-applying', { version: p.version, platform: 'darwin' });
    return true;
  }
  // Na abertura: se já é a versão nova, apaga backup e arquivos temporários; se a troca falhou, avisa e limpa.
  acknowledge() {
    const p = this.pending(); if (!p) return;
    if (p.version === this.m.version) {
      try { fs.unlinkSync(this.file); } catch {}
      if (p.backup) fs.rmSync(p.backup, { recursive: true, force: true });
      fs.rmSync(p.root, { recursive: true, force: true });
      this.m.log('update-startup-confirmed', { version: this.m.version, platform: 'darwin' });
    } else if (p.launchedAt) {
      try { fs.unlinkSync(this.file); } catch {}
      fs.rmSync(p.root, { recursive: true, force: true });
      this.m.recordFailure(p.version, 'mac-swap');
      this.m.emit({ phase: 'error', recovery: true, info: p.info, error: 'A atualização não foi concluída e a versão anterior foi preservada. Você pode baixar a nova versão pelo site.' });
    } else if (fs.existsSync(p.app)) { this.m.info = p.info; this.m.emit({ phase: 'ready', info: p.info }); }
  }
}
module.exports = { MacUpdater };
