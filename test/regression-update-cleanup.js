// 2.1.5: a pasta .resenha-update-* não fica para trás no computador de quem atualiza.
// - Apagar usa original-fs: com o fs do Electron, o default_app.asar da versão nova travava a remoção.
// - Pasta de atualização concluída some na hora (antes esperava 1 hora); backup antigo também.
// - Pastas de atualização são criadas ocultas.
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const ofs = (() => { try { return process.versions.electron ? require('original-fs') : fs; } catch { return fs; } })();
const { UpdateManager } = require('../update-manager');
if (process.platform !== 'win32') { console.log('SKIP: limpeza do atualizador é só no Windows'); process.exit(0); }
const base = fs.mkdtempSync(path.resolve(__dirname, '../../../work/update-cleanup-'));
const id = () => crypto.randomUUID(), old = new Date(Date.now() - 2 * 60 * 60 * 1000);
const app = path.join(base, 'Resenha'); fs.mkdirSync(path.join(app, 'resources', 'app'), { recursive: true });
function fakeApp(dir) { fs.mkdirSync(path.join(dir, 'resources', 'app'), { recursive: true }); fs.writeFileSync(path.join(dir, 'resources', 'app', 'package.json'), '{"name":"resenha"}'); ofs.writeFileSync(path.join(dir, 'resources', 'default_app.asar'), 'asar do Electron'); }
try {
  // Atualização concluída agora há pouco, com a versão nova (e o .asar) dentro de staging.
  const done = path.join(base, '.resenha-update-' + id()); fakeApp(path.join(done, 'staging')); fs.writeFileSync(path.join(done, 'result.json'), '{"state":"success"}');
  // Atualização em andamento (aplicando, sem resultado): não pode ser tocada.
  const running = path.join(base, '.resenha-update-' + id()); fs.mkdirSync(running); fs.writeFileSync(path.join(running, 'applying.json'), '{}');
  // Backup antigo esquecido e backup recente (atualização em curso).
  const oldBackup = path.join(base, '.resenha-backup-' + id()); fakeApp(oldBackup); fs.utimesSync(oldBackup, old, old);
  const newBackup = path.join(base, '.resenha-backup-' + id()); fakeApp(newBackup);
  // Pasta com nome parecido mas que não é do Resenha: nunca é apagada.
  const other = path.join(base, '.resenha-backup-' + id()); fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'meu-arquivo.txt'), 'x'); fs.utimesSync(other, old, old);

  new UpdateManager({ userData: path.join(base, 'data'), appDir: app, version: '2.1.5', platform: 'win32' });
  assert(!fs.existsSync(done), 'atualização concluída é apagada na hora, mesmo com default_app.asar');
  assert(fs.existsSync(running), 'atualização em andamento fica');
  assert(!fs.existsSync(oldBackup), 'backup antigo é apagado');
  assert(fs.existsSync(newBackup), 'backup recente fica');
  assert(fs.existsSync(path.join(other, 'meu-arquivo.txt')), 'pasta que não é do Resenha fica');

  // A pasta de atualização nasce oculta.
  const src = fs.readFileSync(path.join(__dirname, '..', 'update-manager.js'), 'utf8');
  assert(/fs\.mkdirSync\(root\);createdRoot=root;hide\(root\);/.test(src), 'prepare() esconde a pasta');
  const probe = path.join(base, '.resenha-update-' + id()); fs.mkdirSync(probe);
  spawnSync(path.join(process.env.SystemRoot, 'System32', 'attrib.exe'), ['+h', probe], { windowsHide: true });
  const attr = spawnSync(path.join(process.env.SystemRoot, 'System32', 'attrib.exe'), [probe], { encoding: 'utf8', windowsHide: true }).stdout;
  assert(/^\s*\S*H/.test(attr.split(probe)[0]), 'attrib +h deixa a pasta oculta: ' + attr);
  console.log('PASS: pasta de atualização concluída some na hora (com .asar), backup antigo apagado, em andamento e pastas alheias preservadas, pasta nasce oculta');
} finally { ofs.rmSync(base, { recursive: true, force: true }); }
