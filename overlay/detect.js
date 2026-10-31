// Ilha do Resenha: regras puras (sem Electron) para saber se o programa em primeiro plano é um jogo,
// qual é a tecla do atalho e como o atalho de "segurar" se comporta. Testado em test/overlay.js.

// Programas que nunca contam como jogo (a pessoa só os usa se pôr na própria lista).
const BLOCK = new Set(['explorer.exe', 'chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe', 'vivaldi.exe', 'discord.exe',
  'steam.exe', 'steamwebhelper.exe', 'epicgameslauncher.exe', 'galaxyclient.exe', 'battle.net.exe', 'riotclientservices.exe', 'riotclientux.exe',
  'code.exe', 'devenv.exe', 'powerpnt.exe', 'winword.exe', 'excel.exe', 'outlook.exe', 'spotify.exe', 'obs64.exe', 'obs32.exe', 'zoom.exe',
  'teams.exe', 'ms-teams.exe', 'slack.exe', 'notepad.exe', 'cmd.exe', 'windowsterminal.exe', 'powershell.exe', 'taskmgr.exe',
  'applicationframehost.exe', 'searchhost.exe', 'startmenuexperiencehost.exe', 'shellexperiencehost.exe', 'vlc.exe', 'mpc-hc64.exe',
  'potplayermini64.exe', 'whatsapp.exe', 'telegram.exe', 'claude.exe', 'resenha.exe', 'electron.exe', 'lockapp.exe', 'dwm.exe']);

// Pastas de lojas e lançadores onde os jogos ficam instalados.
const GAME_DIRS = [/\\steamapps\\common\\/, /\\epic games\\(?!launcher\\)/, /\\gog galaxy\\games\\/, /\\gog games\\/, /\\riot games\\(?!riot client\\)/,
  /\\xboxgames\\/, /\\ea games\\/, /\\origin games\\/, /\\ubisoft game launcher\\games\\/, /\\rockstar games\\/];
// Programas auxiliares que moram nessas pastas, mas não são o jogo.
const HELPER = /(crash|launcher|setup|unins|redist|dxsetup|webhelper|easyanticheat|beservice|cefprocess|ue4prereq|installer|updater|bootstrap)/i;
const UNREAL = /-win(64|32)-shipping\.exe$/i; // jogos feitos na Unreal Engine

// Lista feita de memória (não verificada com os jogos instalados): nome errado só não casa, não causa dano.
const KNOWN = new Set(`cs2.exe csgo.exe dota2.exe league of legends.exe rocketleague.exe gta5.exe eldenring.exe overwatch.exe r5apex.exe rainbowsix.exe
rainbowsix_vulkan.exe destiny2.exe cyberpunk2077.exe witcher3.exe stardew valley.exe terraria.exe factorio.exe rustclient.exe tslgame.exe
warframe.x64.exe pathofexile.exe pathofexile_x64.exe pathofexilesteam.exe diablo iv.exe hl2.exe left4dead2.exe among us.exe helldivers2.exe bg3.exe
bg3_dx11.exe starfield.exe skyrimse.exe fallout4.exe rdr2.exe eurotrucks2.exe americantrucks.exe forzahorizon5.exe forzahorizon4.exe
hollow knight.exe celeste.exe lethal company.exe phasmophobia.exe valheim.exe sotgame.exe arma3_x64.exe sekiro.exe darksoulsiii.exe
monsterhunterworld.exe monsterhunterrise.exe fc24.exe fc25.exe fifa23.exe genshinimpact.exe starrail.exe zenlesszonezero.exe
minecraft.windows.exe robloxplayerbeta.exe wow.exe hearthstone.exe escapefromtarkov.exe tf_win64.exe bf1.exe bf4.exe bfv.exe bf2042.exe cod.exe
modernwarfare.exe payday2_win32_release.exe aoe2de_s.exe civilizationvi.exe civilizationvi_dx12.exe stellaris.exe hoi4.exe eu4.exe ck3.exe
cities.exe rimworldwin64.exe subnautica.exe beamng.drive.x64.exe assettocorsa.exe acs.exe iracingsim64dx11.exe dirtrally2.exe streetfighter6.exe
mk11.exe shootergame.exe 7daystodie.exe projectzomboid64.exe brawlhalla.exe fallguys_client_game.exe cuphead.exe hades.exe hadesii.exe teardown.exe
undertale.exe deltarune.exe osu!.exe risk of rain 2.exe gmod.exe portal2.exe theforest.exe sonsoftheforest.exe raft.exe gtfo.exe barotrauma.exe
ksp_x64.exe vrchat.exe unturned.exe paladins.exe smite.exe`.split(/\n|(?<=\.exe) /).map((s) => s.trim().toLowerCase()).filter((s) => s.endsWith('.exe')));

const norm = (s) => String(s || '').toLowerCase();
const baseName = (exe) => norm(exe).split(/[\\/]/).pop();

// info: { exe: caminho completo, fs: tela cheia sem bordas }. cfg: { mode, fullscreen, games }.
function isGame(info, cfg = {}) {
  if (!info || !info.exe) return false;
  const path = norm(info.exe).replace(/\//g, '\\'), name = baseName(info.exe), mine = (cfg.games || []).map(norm);
  if (mine.includes(name)) return true;
  if (BLOCK.has(name)) return false;
  if (cfg.mode === 'sempre') return true;
  if (HELPER.test(name)) return false;
  if (KNOWN.has(name) || UNREAL.test(name)) return true;
  if (GAME_DIRS.some((r) => r.test(path))) return true;
  return !!(cfg.fullscreen && info.fs);
}

// Tecla do atalho -> código virtual do Windows (para saber quando foi solta).
const VK = { "'": 0xDE, '`': 0xC0, ',': 0xBC, '.': 0xBE, '-': 0xBD, '=': 0xBB, ';': 0xBA, '/': 0xBF, '[': 0xDB, ']': 0xDD, '\\': 0xDC,
  Space: 0x20, Insert: 0x2D, Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22, Pause: 0x13, ScrollLock: 0x91, Tab: 0x09, Capslock: 0x14 };
function vkFor(key) {
  const k = String(key || '');
  if (VK[k] != null) return VK[k];
  if (/^[A-Za-z]$/.test(k)) return k.toUpperCase().charCodeAt(0);
  if (/^[0-9]$/.test(k)) return k.charCodeAt(0);
  const f = /^F(\d{1,2})$/.exec(k);
  if (f && +f[1] >= 1 && +f[1] <= 24) return 0x6F + +f[1];
  return null;
}
// Teclas que ficam fora (modificadoras, Esc, Enter etc.): atalho é uma tecla só.
const validKey = (key) => vkFor(key) != null && key !== 'Tab' && key !== 'Capslock';

// Cantos onde a ilha pode ficar.
const ANCHORS = ['tl', 'tc', 'tr', 'bl', 'br'];
function place(anchor, size, area, margin = 14) {
  const a = ANCHORS.includes(anchor) ? anchor : 'tc';
  const x = a === 'tc' ? area.x + Math.round((area.width - size.w) / 2) : a.endsWith('l') ? area.x + margin : area.x + area.width - size.w - margin;
  const y = a.startsWith('t') ? area.y + margin : area.y + area.height - size.h - margin;
  return { x, y, width: size.w, height: size.h };
}
function snap(point, area) {
  const best = ANCHORS.map((a) => { const p = place(a, { w: 0, h: 0 }, area, 0); return [a, Math.hypot(p.x - point.x, p.y - point.y)]; }).sort((x, y) => x[1] - y[1]);
  return best[0][0];
}

// "Segurar": o Electron avisa só o apertar. Quem chama diz como esperar o soltar (watch) e o que fazer em cada etapa.
// Soltar fecha após `tolerance` ms, e apertar de novo nesse intervalo cancela o fechamento.
function createHold({ watch, onHold, onRelease, tolerance = 300, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let holding = false, watching = false, timer = null;
  return {
    get holding() { return holding; },
    press() {
      if (timer) { clearTimer(timer); timer = null; }
      if (!holding) { holding = true; onHold(); }
      if (!watching) { watching = true; watch(); }
    },
    released() {
      watching = false;
      if (!holding) return;
      timer = setTimer(() => { timer = null; holding = false; onRelease(); }, tolerance);
    },
    cancel() { if (timer) { clearTimer(timer); timer = null; } watching = false; if (holding) { holding = false; onRelease(); } },
  };
}

module.exports = { isGame, vkFor, validKey, place, snap, createHold, ANCHORS, KNOWN, BLOCK };
