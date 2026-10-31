// Ilha do Resenha: detecção de jogo, tecla, posição e o comportamento de "segurar".
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isGame, vkFor, validKey, place, snap, createHold, ANCHORS, KNOWN } = require('../overlay/detect');

// --- detecção (caminhos com "/" também valem) ---
const game = (exe, cfg, tela) => isGame({ exe, fs: !!tela }, cfg);
assert.ok(game('C:/Program Files (x86)/Steam/steamapps/common/Foo/x64/Foo.exe'), 'pasta da Steam');
assert.ok(game('D:/Games/Valorant/ShooterGame/Binaries/Win64/VALORANT-Win64-Shipping.exe'), 'Unreal Engine');
assert.ok(game('C:/jogos/cs2.exe'), 'lista conhecida');
assert.ok(game('C:/Riot Games/League of Legends/Game/League of Legends.exe'), 'LoL');
assert.ok(!game('C:/Program Files/Google/Chrome/Application/chrome.exe', {}, true), 'navegador em tela cheia não é jogo');
assert.ok(!game('C:/Windows/explorer.exe', { mode: 'sempre' }), 'bloqueados nunca, nem no modo sempre');
assert.ok(!game('C:/Steam/steamapps/common/Foo/UnityCrashHandler64.exe'), 'auxiliar de jogo não conta');
assert.ok(!game('C:/Epic Games/Launcher/Portal/Binaries/Win64/EpicGamesLauncher.exe'), 'lançador não conta');
assert.ok(!game('C:/Tools/algo.exe', {}, true), 'tela cheia sozinha não basta por padrão');
assert.ok(game('C:/Tools/algo.exe', { fullscreen: true }, true), 'tela cheia vale se a pessoa ligar');
assert.ok(game('C:/Tools/MeuJogo.exe', { games: ['meujogo.exe'] }), 'lista da pessoa');
assert.ok(game('C:/Tools/chrome.exe', { games: ['chrome.exe'] }), 'lista da pessoa vence o bloqueio');
assert.ok(game('C:/qualquer/coisa.exe', { mode: 'sempre' }), 'modo sempre');
assert.ok(!isGame(null) && !isGame({}), 'sem programa');
assert.ok(KNOWN.has('league of legends.exe') && KNOWN.has('stardew valley.exe') && KNOWN.size >= 100, 'lista com nomes que têm espaço, ~100');

// --- tecla ---
assert.equal(vkFor("'"), 0xDE); assert.equal(vkFor('`'), 0xC0); assert.equal(vkFor('F9'), 0x78); assert.equal(vkFor('Q'), 0x51); assert.equal(vkFor('Insert'), 0x2D);
assert.equal(vkFor('Ctrl+X'), null); assert.ok(validKey('F12') && !validKey('Ctrl+X') && !validKey(''));

// --- posição ---
const area = { x: 0, y: 0, width: 1920, height: 1080 };
assert.deepEqual(place('tr', { w: 200, h: 40 }, area), { x: 1706, y: 14, width: 200, height: 40 });
assert.deepEqual(place('tc', { w: 200, h: 40 }, area), { x: 860, y: 14, width: 200, height: 40 });
assert.deepEqual(place('bl', { w: 200, h: 40 }, area), { x: 14, y: 1026, width: 200, height: 40 });
assert.equal(place('xx', { w: 200, h: 40 }, area).x, 860, 'canto inválido volta ao topo no centro');
assert.equal(snap({ x: 1800, y: 30 }, area), 'tr'); assert.equal(snap({ x: 960, y: 20 }, area), 'tc'); assert.equal(snap({ x: 100, y: 1000 }, area), 'bl');
assert.deepEqual([...ANCHORS], ['tl', 'tc', 'tr', 'bl', 'br']);

// --- segurar / soltar ---
{
  const log = []; let timer = null;
  const hold = createHold({ tolerance: 300, watch: () => log.push('watch'), onHold: () => log.push('hold'), onRelease: () => log.push('release'),
    setTimer: (f) => { timer = f; return 1; }, clearTimer: () => { timer = null; } });
  hold.press(); hold.press(); hold.press();
  assert.deepEqual(log, ['hold', 'watch'], 'repetições da tecla segurada são ignoradas');
  hold.released(); assert.equal(hold.holding, true, 'só fecha depois da tolerância'); timer(); assert.deepEqual(log.slice(2), ['release']); assert.equal(hold.holding, false);
  log.length = 0; hold.press(); hold.released(); hold.press(); // aperta de novo dentro da tolerância
  assert.equal(timer, null, 'apertar de novo cancela o fechamento'); assert.deepEqual(log, ['hold', 'watch', 'watch']);
  hold.released(); timer(); hold.cancel(); assert.equal(hold.holding, false);
}

// --- ilha e módulos carregam; o ajudante só lê ---
for (const f of ['overlay/island.js', 'overlay/main.js', 'overlay/preload.js']) new vm.Script(fs.readFileSync(require.resolve('../' + f), 'utf8'), { filename: f });
new vm.Script(fs.readFileSync(require.resolve('../app/overlay-client.js'), 'utf8').replace('export function', 'function'), { filename: 'overlay-client.js' });
const ps = fs.readFileSync(require.resolve('../overlay/helper.ps1'), 'utf8');
assert.ok(!/SetWindowsHookEx|SendInput|keybd_event|WriteProcessMemory|CreateRemoteThread/.test(ps), 'o ajudante só lê: sem gancho, sem injeção');
assert.ok(/GetWindowLong/.test(ps) && /0x00C00000/.test(ps), 'tela cheia exige janela sem barra de título (maximizada comum não conta)');
assert.ok(/\\p\{C\}/.test(ps), 'título da janela sem caracteres de controle (não quebra o protocolo)');
assert.ok(/-lt 1500/.test(ps), 'esperar o soltar tem limite de tempo');
const island = fs.readFileSync(require.resolve('../overlay/island.js'), 'utf8');
assert.ok(/data:image\\\/\(png\|jpeg\|webp\|gif\);base64/.test(island), 'avatar só aceita imagem embutida (não busca URL de fora)');
const ovm = fs.readFileSync(require.resolve('../overlay/main.js'), 'utf8');
assert.ok(/helper !== p/.test(ovm) && /fromIsland/.test(ovm) && /fromMain/.test(ovm), 'ajudante por processo e IPC conferindo o remetente');
assert.equal(vkFor('`'), 0xC0, 'tecla abaixo do Esc (posição física) é a VK_OEM_3');
console.log('PASS: ilha (detecção de jogo, tecla, posição, segurar e soltar)');
