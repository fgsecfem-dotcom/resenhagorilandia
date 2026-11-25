// Temas do Resenha (2.6). Seis temas, cada um com material, arranjo e movimento próprios (docs/DESIGN.md):
// Resenha (principal, com paletas 60/30/10), Vidro (visionOS claro sobre o fundo vivo), Sintonia, Apê, Caderno e Mergulho.
// As cores saem de 3 entradas (60 fundo · 30 parceira · 10 impacto), calculadas em OKLCH para manter o contraste em qualquer paleta.

// ---------- cor: hex <-> OKLCH (Björn Ottosson) ----------
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function oklch(hex) {
  const [r, g, b] = hex2rgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
function fromOklch({ L, C, H }) {
  const f = (c) => { const a = c * Math.cos((H * Math.PI) / 180), b = c * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]; };
  let c = C, rgb = f(c); while (c > 0 && rgb.some((v) => v < -0.0005 || v > 1.0005)) { c -= 0.002; rgb = f(c); } // reduz o croma até caber no sRGB
  return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t) { // t = quanto de b; interpolação em OKLab, sem passar por matizes intermediários
  const A = oklch(a), B = oklch(b), r = Math.PI / 180;
  const aa = A.C * Math.cos(A.H * r) * (1 - t) + B.C * Math.cos(B.H * r) * t, bb = A.C * Math.sin(A.H * r) * (1 - t) + B.C * Math.sin(B.H * r) * t;
  return fromOklch({ L: A.L + (B.L - A.L) * t, C: Math.hypot(aa, bb), H: Math.atan2(bb, aa) / r });
}
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgba = (h, a) => `rgba(${hex2rgb(h).map((v) => Math.round(v * 255)).join(',')},${a})`;
// aproxima fg de toward até passar do contraste mínimo contra todos os fundos dados
const readable = (fg, bgs, min, toward) => { bgs = [].concat(bgs); let c = fg, i = 0; while (Math.min(...bgs.map((b) => contrast(c, b))) < min && i++ < 40) c = mix(c, toward, 0.06); return c; };

// ---------- paletas do Resenha: 60 fundo · 30 parceira · 10 impacto ----------
window.RESENHA_PALETTES = {
  pipoca:   { name: 'Pipoca',   dark: true,  c: ['#17161a', '#d9d2c8', '#ff7a2f'], n: ['Grafite', 'Pipoca estourada', 'Laranja quentinha'] },
  musgo:    { name: 'Musgo',    dark: true,  c: ['#1e2119', '#d8c6a6', '#ff2d8f'], n: ['Musgo negro', 'Aveia com leite', 'Fúcsia faísca'] },
  petroleo: { name: 'Petróleo', dark: true,  c: ['#11303a', '#d6c4a4', '#ff6a4d'], n: ['Petróleo', 'Areia molhada', 'Coral'] },
  vinho:    { name: 'Vinho',    dark: true,  c: ['#2b1412', '#e2b1a6', '#3ee0a8'], n: ['Vinho seco', 'Rosa antigo', 'Menta'] },
  marinho:  { name: 'Marinho',  dark: true,  c: ['#131c40', '#eadfb4', '#ff8a1e'], n: ['Azul marinho', 'Manteiga', 'Mandarina'] },
  cacau:    { name: 'Cacau',    dark: true,  c: ['#2a1e17', '#b4cadf', '#ffc21a'], n: ['Cacau', 'Céu lavado', 'Gema'] },
  lona:     { name: 'Lona',     dark: false, c: ['#f3eee6', '#3a1e3f', '#ff6420'], n: ['Lona de algodão', 'Tinta berinjela', 'Laranja papaia'] },
  marmore:  { name: 'Mármore',  dark: false, c: ['#efe7d8', '#3b251d', '#1fd15a'], n: ['Creme mármore', 'Marrom ganache', 'Verde kelly'] },
  gelo:     { name: 'Gelo',     dark: false, c: ['#eef1f4', '#1d2b4f', '#ff4632'], n: ['Papel gelo', 'Azul da Prússia', 'Tomate'] },
};
// "Automático" segue o Windows: Pipoca no escuro, Lona no claro.
const AUTO_PALETTE = { dark: 'pipoca', light: 'lona' };

// Tokens de interface a partir das 3 cores. Todo texto passa pelo contraste mínimo (4,5:1) antes de sair.
function paletteTokens([c60, c30, c10], dark) {
  const s = (t) => mix(c60, c30, t), v = {};
  if (dark) {
    const o = oklch(c60), rail = fromOklch({ L: o.L * 0.8, C: o.C * 1.25, H: o.H });
    Object.assign(v, { 'bg-rail': rail, 'bg-side': rail, 'bg-main': c60, 'bg-panel': s(0.07), 'bg-input': s(0.05), 'bg-float': s(0.1),
      hover: s(0.08), active: s(0.14), line: s(0.14), line2: s(0.14), line3: s(0.08), 'msg-hover': s(0.05), scroll: s(0.22), btn: s(0.08), 'btn-h': s(0.14), 'call-bg': c60,
      text: c30, 'text-hi': mix(c30, '#ffffff', 0.55), icon: mix(c30, c60, 0.12) });
    const bgs = [c60, v['bg-panel'], v['bg-input'], v['bg-float'], v.active];
    v.muted = readable(s(0.6), bgs, 4.8, c30); v.muted2 = readable(s(0.5), bgs, 4.5, c30);
    v.link = readable(c10, bgs, 4.5, '#ffffff');
  } else {
    Object.assign(v, { 'bg-rail': s(0.07), 'bg-side': s(0.04), 'bg-main': c60, 'bg-panel': mix(c60, '#ffffff', 0.5), 'bg-input': mix(c60, '#ffffff', 0.65), 'bg-float': mix(c60, '#ffffff', 0.75),
      hover: s(0.06), active: s(0.1), line: s(0.13), line2: s(0.13), line3: s(0.08), 'msg-hover': s(0.04), scroll: s(0.25), btn: s(0.06), 'btn-h': s(0.1), 'call-bg': c60,
      text: c30, 'text-hi': mix(c30, '#000000', 0.3), icon: mix(c30, c60, 0.15) });
    const bgs = [c60, v['bg-panel'], v['bg-input'], v['bg-float'], v.active];
    v.muted = readable(s(0.7), bgs, 4.8, c30); v.muted2 = readable(s(0.62), bgs, 4.5, c30);
    v.link = readable(c10, bgs, 4.5, c30);
    // no claro a barra lateral fica na cor 30 (nav.css): tokens próprios para o texto dela
    v['side-text'] = c60; v['side-muted'] = readable(mix(c30, c60, 0.62), c30, 4.5, c60); v['side-hover'] = mix(c30, c60, 0.1); v['side-active'] = mix(c30, c60, 0.18);
  }
  v.c60 = c60; v.c30 = c30; v.ink30 = c60; v.accent = c10; v.blurple = c10; v['blurple-h'] = mix(c10, dark ? '#ffffff' : '#000000', 0.1);
  v['on-accent'] = contrast(c10, '#ffffff') >= 4.5 ? '#ffffff' : readable(mix(c10, c60, 0.85), c10, 4.5, '#000000');
  v['accent-soft'] = rgba(c10, 0.16);
  v.green = dark ? '#3ecf7a' : '#15803d'; v.red = dark ? '#ff5d55' : '#d92d20'; v.yellow = dark ? '#fbbf24' : '#946200';
  v['g-fill'] = rgba(c30, 0.05); v['g-fill-2'] = rgba(c30, 0.07); v['g-fill-h'] = rgba(c30, 0.1); v['g-edge'] = rgba(c30, 0.1);
  v['tone-lilac'] = v.active; v['tone-peach'] = v.hover; v['tone-mint'] = v.hover; v['tone-butter'] = v.hover;
  return v;
}
window.resenhaTokens = (key) => { const p = window.RESENHA_PALETTES[key] || window.RESENHA_PALETTES.pipoca; return paletteTokens(p.c, p.dark); };
window.colorContrast = contrast;

// Vidro: o Líquido 2.6 (themes-pro.css). A maior parte do visual vem do vidro e do fundo vivo.
const VIDRO = { 'bg-rail': '#0a0a0b', 'bg-side': '#0e0e10', 'bg-main': '#0e0e10', 'bg-panel': '#151517', 'bg-input': '#151517', 'bg-float': '#18181a',
  hover: '#1c1c1f', active: '#232326', line: '#232326', line2: '#232326', line3: '#151517', 'msg-hover': '#1c1c1f', scroll: '#232326',
  text: '#ededee', 'text-hi': '#ffffff', muted: '#a1a1a6', muted2: '#a1a1a6', icon: '#c6c6cb', link: '#ff9a57', accent: '#ffffff', 'on-accent': '#111111',
  c60: '#0e0e10', c30: '#ededee', ink30: '#0e0e10',
  blurple: '#3d3d41', 'blurple-h': '#4a4a4f', 'accent-soft': 'rgba(255,255,255,.08)', btn: '#151517', 'btn-h': '#232326',
  green: '#3ecf7a', red: '#ef4444', yellow: '#fbbf24', 'call-bg': '#0a0a0b', 'tone-lilac': '#232326', 'tone-peach': '#1c1c1f', 'tone-mint': '#1c1c1f', 'tone-butter': '#1c1c1f',
  'g-fill': 'rgba(255,255,255,.045)', 'g-fill-2': 'rgba(255,255,255,.065)', 'g-fill-h': 'rgba(255,255,255,.10)', 'g-edge': 'rgba(255,255,255,.09)' };

// Os temas alternativos usam o mesmo gerador para o que continua comum (menus, Configurações, avisos);
// a sala de cada um é desenhada pelo próprio tema (app/skins/<tema>.js, via window.ResenhaSkins).
window.THEMES = {
  resenha:  { name: 'Resenha',  hint: 'Sóbrio e denso. As cores você escolhe abaixo.', palettes: true },
  vidro:    { name: 'Vidro',    hint: 'Vidro claro com a luz da própria call.', vars: VIDRO },
  sintonia: { name: 'Sintonia', hint: 'Guia de TV: a sala vira programação.', skin: true, c: ['#2c2b31', '#f2f3e1', '#67b9a0'], dark: true },
  ape:      { name: 'Apê',      hint: 'Cada canal é um cômodo em maquete.', skin: true, c: ['#0b0638', '#fff3e3', '#ea5b1a'], dark: true },
  caderno:  { name: 'Caderno',  hint: 'A call é um livro manuscrito aberto.', skin: true, c: ['#efe6d2', '#2b211b', '#a82a1e'], dark: false },
  mergulho: { name: 'Mergulho', hint: 'Menu debaixo d\'água, em cascata.', skin: true, c: ['#0b2a9e', '#ffffff', '#ff2e2e'], dark: true },
};
window.VISIBLE_THEMES = ['resenha', 'vidro', 'sintonia', 'ape', 'caderno', 'mergulho'];
// Temas retirados: quem usava passa para o mais parecido; a paleta do Resenha também vem do tema antigo (RETIRED_PALETTES).
window.RETIRED_THEMES = { system: 'resenha', arcDark: 'resenha', arcLight: 'resenha', discord: 'resenha', meianoite: 'resenha', claro: 'resenha', roxo: 'resenha', oceano: 'resenha',
  floresta: 'resenha', sangue: 'resenha', pastel: 'resenha', creme: 'resenha', midnight: 'resenha', ember: 'resenha', nord: 'resenha', mocha: 'resenha', rose: 'resenha',
  vision: 'vidro', visionNoite: 'vidro', holofoil: 'vidro', cosmos: 'resenha', neon: 'resenha', brasa: 'resenha', bento: 'resenha', cinema: 'resenha',
  esmeralda: 'resenha', echo: 'resenha', sunset: 'resenha', holografico: 'vidro', menta: 'vidro', twinkle: 'resenha', aurora: 'vidro', cromo: 'resenha', grafite: 'resenha',
  terminal: 'resenha', cafe: 'vidro', onix: 'resenha', abissal: 'resenha', noturno: 'resenha', ametista: 'resenha', fucsia: 'resenha', horizonte: 'vidro', ambar: 'resenha', titanio: 'resenha' };
window.RETIRED_PALETTES = { arcLight: 'lona', claro: 'gelo', bento: 'marmore', titanio: 'marmore', grafite: 'marmore', cromo: 'marmore', terminal: 'marmore',
  brasa: 'cacau', ambar: 'cacau', creme: 'cacau', cinema: 'vinho', fucsia: 'vinho', sangue: 'vinho', sunset: 'vinho', pastel: 'vinho',
  cosmos: 'marinho', noturno: 'marinho', abissal: 'marinho', twinkle: 'marinho', esmeralda: 'petroleo', oceano: 'petroleo', nord: 'petroleo',
  neon: 'musgo', echo: 'musgo', ametista: 'musgo', roxo: 'musgo', floresta: 'musgo' };

const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
let activeTheme = 'resenha', activePalette = 'auto';
const resolveKey = (key) => (window.THEMES[key] ? key : window.RETIRED_THEMES[key] || 'resenha');
const resolvePalette = (p) => (p && window.RESENHA_PALETTES[p] ? p : AUTO_PALETTE[systemAppearance.matches ? 'dark' : 'light']);
function themeFor(key, palette) {
  key = resolveKey(key); const t = window.THEMES[key];
  if (t.palettes) { const p = window.RESENHA_PALETTES[resolvePalette(palette)]; return { key, light: !p.dark, vars: paletteTokens(p.c, p.dark) }; }
  if (t.c) return { key, light: !t.dark, vars: paletteTokens(t.c, t.dark) };
  return { key, light: !!t.light, vars: t.vars };
}
window.applyTheme = function (key, palette = activePalette) {
  activeTheme = resolveKey(key); activePalette = palette || 'auto';
  const t = themeFor(activeTheme, activePalette), root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty('--' + k, v);
  if (root.dataset) { root.dataset.tk = t.key; root.dataset.palette = t.key === 'resenha' ? resolvePalette(activePalette) : ''; }
  root.classList.toggle('light', !!t.light);
  root.classList.toggle('glass', true); // base de vidro (glass.css) comum a todos os temas
  root.style.colorScheme = t.light ? 'light' : 'dark';
  window.resenhaNative?.setWindowColors?.(t.vars['bg-rail'], t.vars.icon); // a mesma cor do #titlebar, para os botões da janela sumirem nele
  try { window.dispatchEvent?.(new Event('resenha-theme')); } catch {}
  return t.vars;
};
// Automático acompanha o Windows ao vivo; uma paleta escolhida fica fixa.
systemAppearance.addEventListener('change', () => { if (activeTheme === 'resenha' && !window.RESENHA_PALETTES[activePalette]) window.applyTheme('resenha', activePalette); });
window.themePreview = (key, palette) => themeFor(key, palette).vars;
window.themeLight = (key, palette) => !!themeFor(key, palette).light;
window.themeKey = resolveKey; // tema salvo (inclusive os retirados) -> tema atual
// Preferência salva -> { theme, color } atual. Tema retirado leva junto a paleta mais parecida; paleta que não existe vira Automático.
window.savedTheme = (theme, color) => {
  const key = resolveKey(theme), retired = !window.THEMES[theme];
  const palette = retired ? window.RETIRED_PALETTES[theme] || 'auto' : window.RESENHA_PALETTES[color] ? color : 'auto';
  return { theme: key, color: palette };
};
