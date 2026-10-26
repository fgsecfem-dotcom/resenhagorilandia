// Atualizador do Windows feito só com o próprio app (2.1.3).
// extract(): o próprio app descompacta e confere o ZIP baixado.
// apply(): roda num processo à parte (o Resenha.exe novo em modo Node), espera o app fechar,
// troca a pasta, abre a versão nova e, se ela não confirmar, devolve a versão anterior.
// Dentro do Electron o fs normal trata arquivos .asar como pastas e não consegue gravá-los
// (a build traz resources/default_app.asar). O original-fs é o fs sem esse desvio.
const fs = (() => { try { return process.versions.electron ? require('original-fs') : require('fs'); } catch { return require('fs'); } })();
const path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const full = (s) => path.resolve(s).replace(/[\\/]+$/, '');
const same = (a, b) => full(a).toLowerCase() === full(b).toLowerCase();
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const write = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v)); fs.renameSync(f + '.tmp', f); };
function alive(pid) { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

function log(p, event, detail) { try { fs.appendFileSync(p.log, JSON.stringify({ at: new Date().toISOString(), event, detail }) + '\n'); } catch {} }
function result(p, state, detail) { write(p.result, { state, detail }); log(p, 'update-' + state, detail); }

// Recusa links e junções na pasta e em todas as pastas acima dela (pastas do OneDrive não são links).
function noLinks(dir) {
  let q = full(dir);
  for (;;) {
    if (fs.lstatSync(q).isSymbolicLink()) throw new Error('Pasta com link ou redirecionamento não suportada. Use a atualização manual.');
    const up = path.dirname(q); if (up === q) return; q = up;
  }
}
function noLinksInside(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, item.name);
    if (fs.lstatSync(f).isSymbolicLink()) throw new Error('A pasta do app contém links. Use a atualização manual.');
    if (item.isDirectory()) noLinksInside(f);
  }
}
function appFolder(dir) {
  if (!fs.existsSync(path.join(dir, 'Resenha.exe'))) throw new Error('Executável ausente.');
  const meta = read(path.join(dir, 'resources', 'app', 'package.json'));
  if (meta?.name !== 'resenha' || fs.existsSync(path.join(dir, 'resources', 'app.asar'))) throw new Error('Pasta do Resenha inválida.');
  return meta;
}

// Toda mudança fica dentro da pasta do app e de pastas irmãs com o id do plano.
function checkPlan(p, planPath) {
  const target = full(p.target), parent = path.dirname(target);
  if (!/^[0-9a-f-]{36}$/.test(p.id || '') || target === full(path.parse(target).root)) throw new Error('Plano inválido.');
  const root = path.join(parent, '.resenha-update-' + p.id);
  const ok = same(p.root, root) && same(p.backup, path.join(parent, '.resenha-backup-' + p.id)) && same(p.staging, path.join(root, 'staging'))
    && same(planPath, path.join(root, 'plan.json')) && same(p.zip, path.join(root, 'download.zip')) && same(p.ready, path.join(root, 'ready.json')) && same(p.result, path.join(root, 'result.json'));
  if (!ok) throw new Error('Caminhos do plano inválidos.');
}

function hashFile(file) {
  return new Promise((resolve, reject) => { const h = crypto.createHash('sha256'), s = fs.createReadStream(file); s.on('data', (c) => h.update(c)); s.on('error', reject); s.on('end', () => resolve(h.digest('hex'))); });
}

// Leitor de ZIP (sem ZIP64): lê o diretório central e valida cada nome antes de gravar qualquer coisa.
function readEntries(zip) {
  const fd = fs.openSync(zip, 'r');
  try {
    const size = fs.fstatSync(fd).size, tail = Math.min(size, 65557), buf = Buffer.alloc(tail);
    fs.readSync(fd, buf, 0, tail, size - tail);
    const e = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (e < 0) throw new Error('ZIP inválido.');
    const count = buf.readUInt16LE(e + 10), cdSize = buf.readUInt32LE(e + 12), cdOff = buf.readUInt32LE(e + 16);
    if (count === 0xffff || cdOff === 0xffffffff || cdOff + cdSize > size) throw new Error('Formato de ZIP não suportado.');
    const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
    const out = []; let o = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(o) !== 0x02014b50) throw new Error('ZIP corrompido.');
      const flags = cd.readUInt16LE(o + 8), method = cd.readUInt16LE(o + 10), crc = cd.readUInt32LE(o + 16), csize = cd.readUInt32LE(o + 20), usize = cd.readUInt32LE(o + 24);
      const nl = cd.readUInt16LE(o + 28), xl = cd.readUInt16LE(o + 30), cl = cd.readUInt16LE(o + 32), attrs = cd.readUInt32LE(o + 38), local = cd.readUInt32LE(o + 42);
      const name = cd.toString(flags & 0x800 ? 'utf8' : 'latin1', o + 46, o + 46 + nl);
      out.push({ name, method, crc, csize, usize, attrs, local, encrypted: !!(flags & 1) });
      o += 46 + nl + xl + cl;
    }
    return out;
  } finally { fs.closeSync(fd); }
}

async function extract(p) {
  if ((await hashFile(p.zip)) !== p.hash) throw new Error('SHA-256 incorreto.');
  const staging = full(p.staging), entries = readEntries(p.zip), names = new Set(); let sum = 0;
  const plan = [];
  for (const en of entries) {
    sum += en.usize;
    if (entries.length > 50000 || sum > 2 * 1024 ** 3) throw new Error('Pacote muito grande.');
    const n = en.name.replace(/\\/g, '/');
    if (!n.startsWith('Resenha/') || n.includes(':') || ((en.attrs >>> 16) & 0xf000) === 0xa000 || en.encrypted) throw new Error('Estrutura do ZIP inválida.');
    const rel = n.slice(8); if (!rel) continue;
    const parts = rel.split('/');
    if (parts.includes('..') || /[<>|?*"]/.test(rel) || parts.some((x) => /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(x))) throw new Error('Nome de arquivo inválido.');
    const dest = full(path.join(staging, rel));
    if (!dest.toLowerCase().startsWith(staging.toLowerCase() + path.sep) || names.has(dest.toLowerCase())) throw new Error('Caminho do ZIP inválido ou duplicado.');
    names.add(dest.toLowerCase());
    if (![0, 8].includes(en.method)) throw new Error('Compressão do ZIP não suportada.');
    plan.push({ ...en, dest, dir: n.endsWith('/') || !!(en.attrs & 16) });
  }
  fs.mkdirSync(staging, { recursive: true });
  const fd = fs.openSync(p.zip, 'r');
  try {
    for (const en of plan) {
      if (en.dir) { fs.mkdirSync(en.dest, { recursive: true }); continue; }
      fs.mkdirSync(path.dirname(en.dest), { recursive: true });
      const head = Buffer.alloc(30); fs.readSync(fd, head, 0, 30, en.local);
      if (head.readUInt32LE(0) !== 0x04034b50) throw new Error('ZIP corrompido.');
      const start = en.local + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
      let crc = 0, got = 0;
      const check = new Transform({ transform(c, _e, cb) { got += c.length; if (got > en.usize) return cb(new Error('Arquivo maior que o declarado no ZIP.')); crc = zlib.crc32(c, crc); cb(null, c); } });
      const src = en.csize ? fs.createReadStream(p.zip, { start, end: start + en.csize - 1 }) : require('stream').Readable.from([]);
      await pipeline(...(en.method === 8 && en.csize ? [src, zlib.createInflateRaw(), check] : [src, check]), fs.createWriteStream(en.dest));
      if (got !== en.usize || (crc >>> 0) !== en.crc) throw new Error('Arquivo corrompido no ZIP: ' + en.name);
    }
  } finally { fs.closeSync(fd); }
  const meta = appFolder(staging); if (meta.version !== p.version) throw new Error('Versão inválida.');
  log(p, 'update-extracted', p.version);
}

async function moveRetry(from, to) {
  let last = '';
  for (let i = 0; i < 60; i++) { try { fs.renameSync(from, to); return; } catch (e) { last = e.message; await sleep(500); } }
  throw new Error('Arquivo em uso ou sem permissão para trocar a pasta. ' + last);
}
function stopTree(pid) { try { spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {} }
function start(exe, args, cwd) { const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; const c = spawn(exe, args, { cwd, detached: true, stdio: 'ignore', env }); c.on('error', () => {}); c.unref(); return c; }

async function apply(planPath) {
  const p = read(planPath); if (!p) throw new Error('Plano ausente.');
  checkPlan(p, planPath);
  const target = full(p.target), staging = full(p.staging), root = full(p.root), backup = full(p.backup);
  log(p, 'update-helper-started', p.version);
  noLinks(path.dirname(target)); noLinks(root);
  // Quando o ajudante roda do Resenha.exe novo, a pasta nova está em uso: copia em vez de mover.
  const fromStaging = full(process.execPath).toLowerCase().startsWith(staging.toLowerCase() + path.sep) || process.env.RESENHA_UPDATE_COPY === '1'; // a variável só é usada nos testes
  write(path.join(root, 'helper-started.json'), { id: p.id, parentPid: p.parentPid, helperPid: process.pid });
  let started = null, moved = false;
  try {
    for (let i = 0; i < 180 && alive(p.parentPid); i++) await sleep(500);
    if (alive(p.parentPid)) throw new Error('O Resenha ainda está aberto.');
    noLinks(target); noLinks(staging); noLinksInside(staging);
    const meta = appFolder(staging); if (meta.version !== p.version) throw new Error('Versão preparada inválida.'); appFolder(target);
    // Nunca sobrescreve um backup, mesmo se o ajudante for aberto duas vezes.
    if (fs.existsSync(backup)) throw new Error('O backup já existe. Atualização manual necessária.');
    write(path.join(root, 'applying.json'), { id: p.id });
    await moveRetry(target, backup); moved = true;
    try { spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'attrib.exe'), ['+h', backup], { windowsHide: true, stdio: 'ignore', timeout: 5000 }); } catch {} // backup oculto
    if (fromStaging) fs.cpSync(staging, target, { recursive: true, errorOnExist: true, force: false });
    else await moveRetry(staging, target);
    started = start(path.join(target, 'Resenha.exe'), [...(p.args || []), '--updated=' + p.id], target);
    let ready = false;
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      const ack = read(p.ready);
      if (ack && ack.version === p.version && ack.id === p.id && ack.pid === started.pid && alive(started.pid)) { ready = true; break; }
      if (!alive(started.pid)) break;
    }
    if (!ready) throw new Error('A nova versão não confirmou a abertura em até 60 segundos.');
    result(p, 'success', 'Nova versão confirmou janela e renderer ativos.');
    try { noLinks(backup); appFolder(backup); fs.rmSync(backup, { recursive: true, force: true }); log(p, 'update-backup-removed', backup); } catch (e) { log(p, 'update-backup-retained', e.message); }
    try { fs.rmSync(p.zip, { force: true }); } catch {}
    return 0;
  } catch (e) {
    const failure = e.message;
    if (started && alive(started.pid)) { stopTree(started.pid); await sleep(500); }
    try {
      if (moved) {
        // O que estiver na pasta do app agora foi criado por este ajudante: sai para "failed-app".
        if (fs.existsSync(target)) { noLinks(target); await moveRetry(target, path.join(root, 'failed-app')); }
        if (!fs.existsSync(target)) await moveRetry(backup, target);
        result(p, 'rollback', failure);
        start(path.join(target, 'Resenha.exe'), [...(p.args || [])], target); // reabre a versão anterior
      } else result(p, 'error', failure);
    } catch (e2) { result(p, 'error', failure + ' / Restauração pendente: ' + e2.message); }
    return 1;
  }
}

module.exports = { extract, apply, readEntries, noLinks, appFolder, checkPlan };

if (require.main === module) {
  const i = process.argv.indexOf('--plan'), planPath = i > 0 ? process.argv[i + 1] : null;
  (async () => {
    let p = null;
    try { p = read(planPath); if (!planPath || !p) throw new Error('Plano ausente.'); if (process.argv.includes('--extract')) { checkPlan(p, planPath); await extract(p); process.exit(0); } process.exit(await apply(planPath)); }
    catch (e) { try { if (p?.result) result(p, 'error', e.message); } catch {} process.exit(1); }
  })();
}
