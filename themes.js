// Temas do Resenha. Cada tema define as variáveis CSS; o resto do visual segue sozinho.
const BASE = {
  'bg-rail': '#1e1f22', 'bg-side': '#2b2d31', 'bg-main': '#313338', 'bg-panel': '#232428', 'bg-input': '#383a40', 'bg-float': '#111214',
  hover: '#35373c', active: '#404249', line: '#3f4147', line2: '#26272b', line3: '#1f2023', 'msg-hover': '#2e3035', scroll: '#1a1b1e',
  text: '#dbdee1', 'text-hi': '#f2f3f5', muted: '#949ba4', muted2: '#80848e', icon: '#b5bac1', link: '#00a8fc',
  btn: '#4e5058', 'btn-h': '#6d6f78', blurple: '#5865f2', 'blurple-h': '#4752c4', 'accent-soft': '#5865f233',
  green: '#23a55a', red: '#f23f43', yellow: '#f0b232', 'call-bg': '#000000',
};

window.THEMES = {
  discord: { name: 'Escuro (padrão)', vars: {} },
  meianoite: { name: 'Meia-noite', vars: {
    'bg-rail': '#000000', 'bg-side': '#0b0b0d', 'bg-main': '#111114', 'bg-panel': '#08080a', 'bg-input': '#1a1a1f', 'bg-float': '#000000',
    hover: '#18181c', active: '#222228', line: '#26262c', line2: '#1a1a1f', line3: '#101013', 'msg-hover': '#16161a', scroll: '#222228', 'call-bg': '#000000',
  } },
  claro: { name: 'Claro', light: true, vars: {
    'bg-rail': '#e3e5e8', 'bg-side': '#f2f3f5', 'bg-main': '#ffffff', 'bg-panel': '#ebedef', 'bg-input': '#ebedef', 'bg-float': '#ffffff',
    hover: '#e3e5e8', active: '#d4d7dc', line: '#d4d7dc', line2: '#e3e5e8', line3: '#dcdee1', 'msg-hover': '#f5f6f7', scroll: '#c4c9ce',
    text: '#313338', 'text-hi': '#060607', muted: '#5c5e66', muted2: '#6d6f78', icon: '#4e5058', link: '#006ce7',
    btn: '#6d6f78', 'btn-h': '#4e5058', 'call-bg': '#dfe1e5', 'accent-soft': '#5865f222',
  } },
  roxo: { name: 'Roxo Neon', vars: {
    'bg-rail': '#120a1f', 'bg-side': '#1b1030', 'bg-main': '#22143b', 'bg-panel': '#150c26', 'bg-input': '#2d1b4d', 'bg-float': '#0d0717',
    hover: '#2a1a47', active: '#3a2463', line: '#3a2463', line2: '#241540', line3: '#170d29', 'msg-hover': '#28183f', scroll: '#3a2463',
    text: '#e7dcff', 'text-hi': '#ffffff', muted: '#a592c9', muted2: '#8c79b3', icon: '#c7b5ec', link: '#6ee7ff',
    blurple: '#b24bf3', 'blurple-h': '#9333ea', 'accent-soft': '#b24bf333', btn: '#4a2f7a', 'btn-h': '#5d3b99', 'call-bg': '#0a0513',
  } },
  oceano: { name: 'Oceano', vars: {
    'bg-rail': '#0a1622', 'bg-side': '#0f1f2e', 'bg-main': '#13283a', 'bg-panel': '#0c1a27', 'bg-input': '#1a3449', 'bg-float': '#07111b',
    hover: '#173045', active: '#1f3f5a', line: '#21425e', line2: '#142a3c', line3: '#0e1d2b', 'msg-hover': '#162d41', scroll: '#21425e',
    text: '#d6e7f5', 'text-hi': '#f2f9ff', muted: '#8aa6bf', muted2: '#7792aa', icon: '#a9c4db', link: '#4fd1ff',
    blurple: '#1e9bd7', 'blurple-h': '#1680b3', 'accent-soft': '#1e9bd733', btn: '#2a4d6b', 'btn-h': '#355f84', 'call-bg': '#050d15',
  } },
  floresta: { name: 'Floresta', vars: {
    'bg-rail': '#0e1a12', 'bg-side': '#142319', 'bg-main': '#192c20', 'bg-panel': '#102015', 'bg-input': '#213829', 'bg-float': '#09130c',
    hover: '#1e3326', active: '#28452f', line: '#2a4632', line2: '#18291d', line3: '#101c14', 'msg-hover': '#1c3024', scroll: '#2a4632',
    text: '#dcebdd', 'text-hi': '#f3fbf3', muted: '#93ad97', muted2: '#7f9983', icon: '#b3cbb6', link: '#7ee0a0',
    blurple: '#3aa35b', 'blurple-h': '#2e8549', 'accent-soft': '#3aa35b33', btn: '#355440', 'btn-h': '#41674e', 'call-bg': '#060d08',
  } },
  sangue: { name: 'Vermelho Gamer', vars: {
    'bg-rail': '#140909', 'bg-side': '#1c0d0d', 'bg-main': '#231111', 'bg-panel': '#170b0b', 'bg-input': '#301818', 'bg-float': '#0e0606',
    hover: '#2b1515', active: '#3d1c1c', line: '#3d1c1c', line2: '#241212', line3: '#180a0a', 'msg-hover': '#291414', scroll: '#3d1c1c',
    text: '#f1dcdc', 'text-hi': '#fff5f5', muted: '#b99393', muted2: '#a17c7c', icon: '#d6b5b5', link: '#ff8a8a',
    blurple: '#e5383b', 'blurple-h': '#ba181b', 'accent-soft': '#e5383b33', btn: '#5a2828', 'btn-h': '#703333', 'call-bg': '#0a0303',
  } },
  pastel: { name: 'Pôr do sol', vars: {
    'bg-rail': '#1f1420', 'bg-side': '#2a1b2b', 'bg-main': '#332135', 'bg-panel': '#241725', 'bg-input': '#3f2a41', 'bg-float': '#170e18',
    hover: '#3a263c', active: '#4b3150', line: '#4b3150', line2: '#2e1f30', line3: '#1f1420', 'msg-hover': '#382539', scroll: '#4b3150',
    text: '#f5e2ec', 'text-hi': '#fff7fb', muted: '#c49db2', muted2: '#ab879b', icon: '#e0bfd0', link: '#ffb86b',
    blurple: '#ff7a59', 'blurple-h': '#e85d3c', 'accent-soft': '#ff7a5933', btn: '#5c3d5f', 'btn-h': '#704b74', 'call-bg': '#120a13',
  } },
  creme: { name: 'Café', vars: {
    'bg-rail': '#111010', 'bg-side': '#1a1817', 'bg-main': '#211e1c', 'bg-panel': '#161413', 'bg-input': '#2c2826', 'bg-float': '#0c0b0a',
    hover: '#28241f', active: '#352f29', line: '#383128', line2: '#221f1c', line3: '#171513', 'msg-hover': '#262220', scroll: '#383128',
    text: '#eadfcf', 'text-hi': '#fff8ec', muted: '#ab9d8a', muted2: '#948674', icon: '#cdbfa9', link: '#f0b86b',
    blurple: '#d4943c', 'blurple-h': '#b67a26', 'accent-soft': '#d4943c33', btn: '#4a4035', 'btn-h': '#5c5042', 'call-bg': '#080707',
  } },
};


// Resenha 1.6 design tokens (graphite neutrals, Figtree, one accent per palette).
// Persisted theme identifiers stay the same; palettes below override only the accent keys.
// Identidade do Resenha (2.1.5): grafite neutro fosco, vidro esfumaçado e laranja só em pequenos detalhes.
const ARC_DARK = {
  "bg-rail": "#121213",
  "bg-side": "#171718",
  "bg-main": "#171718",
  "bg-panel": "#1e1e20",
  "bg-input": "#1e1e20",
  "bg-float": "#202022",
  "hover": "#252527",
  "active": "#2a2a2d",
  "line": "#2a2a2c",
  "line2": "#2a2a2c",
  "line3": "#1e1e20",
  "msg-hover": "#1a1a1b",
  "scroll": "#333336",
  "text": "#ededee",
  "text-hi": "#ffffff",
  "muted": "#a1a1a6",
  "muted2": "#94949a",
  "icon": "#c4c4c8",
  "link": "#ff9a57",
  "blurple": "#3d3d41",
  "blurple-h": "#4a4a4f",
  "accent-soft": "rgba(255,255,255,.08)",
  "btn": "#18181a",
  "btn-h": "#232325",
  "green": "#3ecf7a",
  "red": "#ef4444",
  "yellow": "#fbbf24",
  "call-bg": "#0a0a0b",
  "tone-lilac": "#2a2a2d",
  "tone-peach": "#2a2522",
  "tone-mint": "#1c2622",
  "tone-butter": "#2a2720",
  "wall": "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\") 0 0 / 180px 180px repeat, radial-gradient(70% 60% at 50% -10%, rgba(255,255,255,.07) 0, transparent 70%), radial-gradient(60% 50% at 100% 100%, rgba(255,255,255,.035) 0, transparent 70%), linear-gradient(180deg, #1b1b1d 0%, #121213 100%)",
  "g-fill": "rgba(255,255,255,.045)",
  "g-fill-2": "rgba(255,255,255,.065)",
  "g-fill-h": "rgba(255,255,255,.10)",
  "g-edge": "rgba(255,255,255,.09)"
};
const ARC_LIGHT = {
  "bg-rail": "#f4f3f7",
  "bg-side": "#ffffff",
  "bg-main": "#ffffff",
  "bg-panel": "#f8f7fb",
  "bg-input": "#f8f7fb",
  "bg-float": "#ffffff",
  "hover": "#efeef4",
  "active": "#ececef",
  "line": "#e4e2ea",
  "line2": "#e4e2ea",
  "line3": "#ecebf1",
  "msg-hover": "#f8f7fb",
  "scroll": "#c9c6d3",
  "text": "#1a1a22",
  "text-hi": "#0d0d12",
  "muted": "#5c5c6b",
  "muted2": "#62626f",
  "icon": "#4a4a57",
  "link": "#a8360a",
  "blurple": "#2b2b2e",
  "blurple-h": "#3a3a3e",
  "accent-soft": "rgba(0,0,0,.06)",
  "btn": "#ecebf1",
  "btn-h": "#e1dfe8",
  "green": "#15803d",
  "red": "#dc2626",
  "yellow": "#946200",
  "call-bg": "#ffffff",
  "tone-lilac": "#ececef",
  "tone-peach": "#fff1e8",
  "tone-mint": "#eaf8f2",
  "tone-butter": "#fff7dc"
};
window.THEMES = { system: { name: 'Sistema · automático', fixed: true, vars: ARC_DARK }, ...window.THEMES,
  arcDark: { name: 'Resenha · escuro', fixed: true, vars: ARC_DARK }, arcLight: { name: 'Resenha · claro', light: true, fixed: true, vars: ARC_LIGHT } };
window.PALETTES = {
  "lavanda": {
    "name": "Lavanda",
    "swatch": "#c6b0e2",
    "light": {},
    "dark": {}
  },
  "hortela": {
    "name": "Hortel\u00e3",
    "swatch": "#b7d7c1",
    "dark": {
      "active": "#132c28",
      "blurple": "#047857",
      "blurple-h": "#047857",
      "accent-soft": "#10b98118",
      "link": "#80e1bc",
      "tone-lilac": "#132c28"
    },
    "light": {
      "active": "#eaf8f2",
      "blurple": "#047857",
      "blurple-h": "#047857",
      "accent-soft": "#10b9810c",
      "link": "#047857",
      "tone-lilac": "#eaf8f2"
    }
  },
  "pessego": {
    "name": "P\u00eassego",
    "swatch": "#edbd9e",
    "dark": {
      "active": "#302119",
      "blurple": "#c2410c",
      "blurple-h": "#c2410c",
      "accent-soft": "#ea580c18",
      "link": "#ffc09b",
      "tone-lilac": "#302119"
    },
    "light": {
      "active": "#fff1e8",
      "blurple": "#b45309",
      "blurple-h": "#b45309",
      "accent-soft": "#ea580c0c",
      "link": "#b45309",
      "tone-lilac": "#fff1e8"
    }
  },
  "rosa": {
    "name": "Rosa suave",
    "swatch": "#e3b7c9",
    "dark": {
      "active": "#301d2a",
      "blurple": "#be185d",
      "blurple-h": "#be185d",
      "accent-soft": "#ec489918",
      "link": "#f5b1d4",
      "tone-lilac": "#301d2a"
    },
    "light": {
      "active": "#fcecf4",
      "blurple": "#be185d",
      "blurple-h": "#be185d",
      "accent-soft": "#ec48990c",
      "link": "#be185d",
      "tone-lilac": "#fcecf4"
    }
  },
  "ceu": {
    "name": "C\u00e9u",
    "swatch": "#afc8e2",
    "dark": {
      "active": "#162a3b",
      "blurple": "#0369a1",
      "blurple-h": "#0369a1",
      "accent-soft": "#0ea5e918",
      "link": "#a4d9ff",
      "tone-lilac": "#162a3b"
    },
    "light": {
      "active": "#eaf4fc",
      "blurple": "#0369a1",
      "blurple-h": "#0369a1",
      "accent-soft": "#0ea5e90c",
      "link": "#0369a1",
      "tone-lilac": "#eaf4fc"
    }
  }
};
// Resenha 2.1 · temas completos inspirados em referências conhecidas (cada um com fundo, texto e destaque próprios).
// "link" é a cor de destaque em textos; "blurple" é a cor dos botões preenchidos (mais escura, para o texto branco ler bem).
const FULL_THEMES = {
  midnight: { name: 'Midnight', hint: 'inspirado no Linear', vars: {
    wall: 'radial-gradient(60% 45% at 50% -8%, #5e6ad266 0, #5e6ad21a 45%, transparent 75%), linear-gradient(180deg, transparent 60%, #5e6ad20d), #050609',
    'g-fill': 'rgba(16,17,24,.82)', 'g-fill-2': 'rgba(22,24,34,.9)', 'g-fill-h': 'rgba(94,106,210,.16)', 'g-edge': 'rgba(130,143,255,.16)',
    'r-panel': '10px', 'r-tile': '12px',
    'bg-rail': '#08090c', 'bg-side': '#101116', 'bg-main': '#101116', 'bg-panel': '#17181f', 'bg-input': '#17181f', 'bg-float': '#17181f',
    hover: '#1d1f28', active: '#1c1f3a', line: '#22242e', line2: '#22242e', line3: '#17181f', 'msg-hover': '#13141a', scroll: '#2c2f3b',
    text: '#e4e5ea', 'text-hi': '#ffffff', muted: '#9a9eab', muted2: '#8d91a0', icon: '#c2c5d2', link: '#9aa3ff',
    blurple: '#5e6ad2', 'blurple-h': '#5059c4', 'accent-soft': '#5e6ad233', btn: '#17181f', 'btn-h': '#22242e',
    green: '#4cc38a', red: '#e5484d', yellow: '#f5b740', 'call-bg': '#08090c',
    'tone-lilac': '#1c1f3a', 'tone-peach': '#2a1f24', 'tone-mint': '#14282a', 'tone-butter': '#2a2618' } },
  ember: { name: 'Ember', hint: 'inspirado no Raycast', vars: {
    wall: 'linear-gradient(118deg, transparent 0 46%, #ff636322 46% 52%, transparent 52% 56%, #ff8a4a1a 56% 61%, transparent 61%), radial-gradient(70% 60% at 0% 100%, #ff636330 0, transparent 70%), radial-gradient(50% 40% at 100% 0%, #ffbc3314 0, transparent 70%), #07080a',
    'g-fill': 'rgba(255,120,100,.045)', 'g-fill-2': 'rgba(255,140,120,.06)', 'g-fill-h': 'rgba(255,150,130,.1)', 'g-edge': 'rgba(255,140,120,.12)',
    'r-panel': '14px', 'r-tile': '16px',
    'bg-rail': '#07080a', 'bg-side': '#0f1013', 'bg-main': '#0f1013', 'bg-panel': '#17181c', 'bg-input': '#17181c', 'bg-float': '#17181c',
    hover: '#1e1f24', active: '#2e1517', line: '#232429', line2: '#232429', line3: '#17181c', 'msg-hover': '#131418', scroll: '#2e3036',
    text: '#e7e7ea', 'text-hi': '#ffffff', muted: '#a0a1a8', muted2: '#93949c', icon: '#c8c9cf', link: '#ff8a8a',
    blurple: '#d43a40', 'blurple-h': '#c13238', 'accent-soft': '#ff636329', btn: '#17181c', 'btn-h': '#232429',
    green: '#5fc992', red: '#ff6363', yellow: '#ffbc33', 'call-bg': '#07080a',
    'tone-lilac': '#2e1517', 'tone-peach': '#2e1d16', 'tone-mint': '#132a20', 'tone-butter': '#2e2614' } },
  nord: { name: 'Nord', hint: 'paleta Nord', vars: {
    wall: 'radial-gradient(90% 60% at 20% -10%, #88c0d038 0, transparent 65%), radial-gradient(70% 50% at 90% 10%, #81a1c12e 0, transparent 65%), radial-gradient(80% 60% at 50% 120%, #5e81ac2a 0, transparent 70%), #2e3440',
    'g-fill': 'rgba(236,239,244,.07)', 'g-fill-2': 'rgba(236,239,244,.09)', 'g-fill-h': 'rgba(236,239,244,.14)', 'g-edge': 'rgba(236,239,244,.14)',
    'r-panel': '16px', 'r-tile': '18px',
    'bg-rail': '#2e3440', 'bg-side': '#353c4a', 'bg-main': '#353c4a', 'bg-panel': '#3b4252', 'bg-input': '#3b4252', 'bg-float': '#3b4252',
    hover: '#434c5e', active: '#344052', line: '#434c5e', line2: '#434c5e', line3: '#3b4252', 'msg-hover': '#39404e', scroll: '#4c566a',
    text: '#e5e9f0', 'text-hi': '#eceff4', muted: '#c0c7d4', muted2: '#b3bccb', icon: '#d8dee9', link: '#88c0d0',
    blurple: '#4c6f9c', 'blurple-h': '#44638c', 'accent-soft': '#88c0d033', btn: '#3b4252', 'btn-h': '#434c5e',
    green: '#a3be8c', red: '#bf616a', yellow: '#ebcb8b', 'call-bg': '#2e3440',
    'tone-lilac': '#344052', 'tone-peach': '#4a3f45', 'tone-mint': '#3c4d4a', 'tone-butter': '#4a4638' } },
  mocha: { name: 'Mocha', hint: 'paleta Catppuccin', vars: {
    wall: 'radial-gradient(45% 45% at 6% 8%, #cba6f766 0, transparent 70%), radial-gradient(40% 40% at 96% 14%, #fab38755 0, transparent 70%), radial-gradient(50% 45% at 62% 108%, #94e2d550 0, transparent 70%), radial-gradient(32% 32% at 18% 96%, #f5c2e74a 0, transparent 70%), radial-gradient(30% 30% at 50% 45%, #89b4fa26 0, transparent 70%), #11111b',
    'g-fill': 'rgba(203,166,247,.07)', 'g-fill-2': 'rgba(203,166,247,.10)', 'g-fill-h': 'rgba(245,194,231,.16)', 'g-edge': 'rgba(203,166,247,.20)',
    'r-panel': '24px', 'r-tile': '28px',
    'bg-rail': '#11111b', 'bg-side': '#181825', 'bg-main': '#1e1e2e', 'bg-panel': '#1e1e2e', 'bg-input': '#313244', 'bg-float': '#1e1e2e',
    hover: '#313244', active: '#3b3252', line: '#313244', line2: '#313244', line3: '#1e1e2e', 'msg-hover': '#232334', scroll: '#45475a',
    text: '#cdd6f4', 'text-hi': '#f2f4ff', muted: '#a6adc8', muted2: '#9399b2', icon: '#bac2de', link: '#cba6f7',
    blurple: '#7a56c9', 'blurple-h': '#6c49b8', 'accent-soft': '#cba6f72e', btn: '#313244', 'btn-h': '#45475a',
    green: '#a6e3a1', red: '#f38ba8', yellow: '#f9e2af', 'call-bg': '#11111b',
    'tone-lilac': '#3b3252', 'tone-peach': '#3e2f33', 'tone-mint': '#283b3a', 'tone-butter': '#3d3a30' } },
  rose: { name: 'Rosé', hint: 'paleta Rosé Pine', vars: {
    wall: 'radial-gradient(60% 55% at 100% 100%, #ebbcba5c 0, transparent 70%), radial-gradient(42% 40% at 78% 82%, #f6c17742 0, transparent 70%), radial-gradient(55% 50% at 0% 0%, #c4a7e74d 0, transparent 70%), radial-gradient(40% 35% at 20% 80%, #eb6f9224 0, transparent 70%), #191724',
    'g-fill': 'rgba(235,188,186,.07)', 'g-fill-2': 'rgba(196,167,231,.09)', 'g-fill-h': 'rgba(235,188,186,.16)', 'g-edge': 'rgba(235,188,186,.2)',
    'r-panel': '18px', 'r-tile': '22px',
    'bg-rail': '#191724', 'bg-side': '#1f1d2e', 'bg-main': '#1f1d2e', 'bg-panel': '#26233a', 'bg-input': '#26233a', 'bg-float': '#26233a',
    hover: '#2d2a42', active: '#3a2c3c', line: '#2f2b44', line2: '#2f2b44', line3: '#26233a', 'msg-hover': '#232134', scroll: '#403d52',
    text: '#e0def4', 'text-hi': '#f4f2ff', muted: '#a9a5c4', muted2: '#9c98b8', icon: '#c8c5e0', link: '#ebbcba',
    blurple: '#a4546c', 'blurple-h': '#93485f', 'accent-soft': '#ebbcba29', btn: '#26233a', 'btn-h': '#2f2b44',
    green: '#9ccfd8', red: '#eb6f92', yellow: '#f6c177', 'call-bg': '#191724',
    'tone-lilac': '#3a2c3c', 'tone-peach': '#3d2e30', 'tone-mint': '#24363d', 'tone-butter': '#3b3528' } },
  // 2.1.2: os temas que aparecem na escolha (os de cima ficam só para quem já tinha escolhido).
  titanio: { name: "Titânio", hint: "Pinterest · Amplify", vars: {"bg-rail": "#0e0f12", "bg-side": "#16181c", "bg-main": "#16181c", "bg-panel": "#1d2026", "bg-input": "#1d2026", "bg-float": "#1d2026", "hover": "#292c32", "active": "#2c2f37", "line": "#2f3238", "line2": "#2f3238", "line3": "#1d2026", "msg-hover": "#1c1e22", "scroll": "#3d4046", "text": "#e7e9ee", "text-hi": "#ffffff", "muted": "#a8adb7", "muted2": "#979ca6", "icon": "#ced1d8", "link": "#ff8fb5", "blurple": "#5d6570", "blurple-h": "#4b525c", "accent-soft": "#ff8fb52e", "btn": "#1d2026", "btn-h": "#2f3238", "green": "#4ade80", "red": "#ff6b6b", "yellow": "#fbbf24", "call-bg": "#0e0f12", "tone-lilac": "#2c2f37", "tone-peach": "#362d30", "tone-mint": "#203534", "tone-butter": "#333124", "wall": "radial-gradient(70% 60% at 30% 0%, #c7ccd645 0, transparent 70%), radial-gradient(50% 50% at 100% 100%, #9aa3b028 0, transparent 70%), linear-gradient(180deg, #1b1d22, #0e0f12)", "g-fill": "rgba(255,255,255,.05)", "g-fill-2": "rgba(255,255,255,.075)", "g-fill-h": "rgba(255,255,255,.13)", "g-edge": "rgba(255,255,255,.15)", "r-panel": "16px", "r-tile": "18px"} },
  noturno: { name: "Noturno", hint: "Pinterest · G.Take", vars: {"bg-rail": "#070b1a", "bg-side": "#0b1226", "bg-main": "#0b1226", "bg-panel": "#111b36", "bg-input": "#111b36", "bg-float": "#111b36", "hover": "#1e2842", "active": "#17264d", "line": "#242e48", "line2": "#242e48", "line3": "#111b36", "msg-hover": "#12192d", "scroll": "#333c56", "text": "#e6ecff", "text-hi": "#ffffff", "muted": "#9aa6c8", "muted2": "#8a95b6", "icon": "#c8d0e9", "link": "#6ea8ff", "blurple": "#2f5bea", "blurple-h": "#2449c4", "accent-soft": "#6ea8ff2e", "btn": "#111b36", "btn-h": "#242e48", "green": "#4ade80", "red": "#f87171", "yellow": "#fbbf24", "call-bg": "#070b1a", "tone-lilac": "#17264d", "tone-peach": "#2c283e", "tone-mint": "#153142", "tone-butter": "#282d33", "wall": "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'%3E%3Cdefs%3E %3ClinearGradient id='sky' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23050816'/%3E%3Cstop offset='0.45' stop-color='%230a1433'/%3E%3Cstop offset='0.72' stop-color='%231a2a5c'/%3E%3Cstop offset='0.86' stop-color='%233a3f6e'/%3E%3Cstop offset='1' stop-color='%231b1c33'/%3E%3C/linearGradient%3E %3CradialGradient id='dusk' cx='0.62' cy='0.92' r='0.55'%3E%3Cstop offset='0' stop-color='%23f0a46a' stop-opacity='0.38'/%3E%3Cstop offset='0.45' stop-color='%237b6bb8' stop-opacity='0.16'/%3E%3Cstop offset='1' stop-color='%23000' stop-opacity='0'/%3E%3C/radialGradient%3E %3CradialGradient id='milk' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%239fb4ff' stop-opacity='0.16'/%3E%3Cstop offset='1' stop-color='%239fb4ff' stop-opacity='0'/%3E%3C/radialGradient%3E %3CradialGradient id='gl' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%23fff' stop-opacity='0.9'/%3E%3Cstop offset='0.3' stop-color='%23cfe0ff' stop-opacity='0.35'/%3E%3Cstop offset='1' stop-color='%23cfe0ff' stop-opacity='0'/%3E%3C/radialGradient%3E %3ClinearGradient id='m1' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23171c38'/%3E%3Cstop offset='1' stop-color='%230b0e1f'/%3E%3C/linearGradient%3E %3ClinearGradient id='m2' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%230d1126'/%3E%3Cstop offset='1' stop-color='%2305060f'/%3E%3C/linearGradient%3E%3C/defs%3E %3Crect width='1600' height='1000' fill='url(%23sky)'/%3E%3Crect width='1600' height='1000' fill='url(%23dusk)'/%3E %3Cellipse cx='900' cy='300' rx='900' ry='140' fill='url(%23milk)' transform='rotate(-18 900 300)'/%3E %3Ccircle cx='501' cy='492' r='2.2' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='758' cy='516' r='0.7' fill='%23fff' opacity='0.31'/%3E%3Ccircle cx='1058' cy='484' r='1.0' fill='%23fff' opacity='0.13'/%3E%3Ccircle cx='298' cy='485' r='0.7' fill='%23fff' opacity='0.22'/%3E%3Ccircle cx='103' cy='530' r='0.9' fill='%23fff' opacity='0.2'/%3E%3Ccircle cx='1261' cy='356' r='1.0' fill='%23fff' opacity='0.21'/%3E%3Ccircle cx='656' cy='510' r='1.2' fill='%23fff' opacity='0.39'/%3E%3Ccircle cx='521' cy='540' r='0.9' fill='%23fff' opacity='0.17'/%3E%3Ccircle cx='122' cy='582' r='1.0' fill='%23fff' opacity='0.16'/%3E%3Ccircle cx='461' cy='57' r='0.8' fill='%23fff' opacity='0.7'/%3E%3Ccircle cx='994' cy='199' r='1.5' fill='%23fff' opacity='0.56'/%3E%3Ccircle cx='1084' cy='362' r='1.2' fill='%23fff' opacity='0.36'/%3E%3Ccircle cx='248' cy='219' r='0.9' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='433' cy='558' r='1.2' fill='%23fff' opacity='0.32'/%3E%3Ccircle cx='1008' cy='219' r='0.7' fill='%23fff' opacity='0.2'/%3E%3Ccircle cx='1495' cy='476' r='0.9' fill='%23fff' opacity='0.15'/%3E%3Ccircle cx='766' cy='180' r='1.5' fill='%23fff' opacity='0.28'/%3E%3Ccircle cx='274' cy='581' r='1.0' fill='%23fff' opacity='0.26'/%3E%3Ccircle cx='213' cy='175' r='1.0' fill='%23fff' opacity='0.57'/%3E%3Ccircle cx='349' cy='40' r='0.9' fill='%23fff' opacity='0.51'/%3E%3Ccircle cx='273' cy='580' r='0.9' fill='%23fff' opacity='0.31'/%3E%3Ccircle cx='770' cy='93' r='1.2' fill='%23fff' opacity='0.77'/%3E%3Ccircle cx='857' cy='187' r='0.7' fill='%23fff' opacity='0.55'/%3E%3Ccircle cx='1168' cy='603' r='2.2' fill='%23fff' opacity='0.2'/%3E%3Ccircle cx='274' cy='249' r='0.8' fill='%23fff' opacity='0.54'/%3E%3Ccircle cx='224' cy='20' r='1.5' fill='%23fff' opacity='0.76'/%3E%3Ccircle cx='897' cy='184' r='0.6' fill='%23fff' opacity='0.26'/%3E%3Ccircle cx='59' cy='130' r='1.2' fill='%23fff' opacity='0.79'/%3E%3Ccircle cx='1404' cy='107' r='1.2' fill='%23fff' opacity='0.62'/%3E%3Ccircle cx='1087' cy='552' r='1.5' fill='%23fff' opacity='0.33'/%3E%3Ccircle cx='1294' cy='564' r='1.2' fill='%23fff' opacity='0.32'/%3E%3Ccircle cx='1343' cy='50' r='0.9' fill='%23fff' opacity='0.69'/%3E%3Ccircle cx='602' cy='352' r='0.9' fill='%23fff' opacity='0.52'/%3E%3Ccircle cx='1010' cy='541' r='0.7' fill='%23fff' opacity='0.25'/%3E%3Ccircle cx='554' cy='383' r='0.9' fill='%23fff' opacity='0.31'/%3E%3Ccircle cx='929' cy='118' r='1.0' fill='%23fff' opacity='0.25'/%3E%3Ccircle cx='1163' cy='449' r='0.8' fill='%23fff' opacity='0.14'/%3E%3Ccircle cx='865' cy='607' r='0.8' fill='%23fff' opacity='0.22'/%3E%3Ccircle cx='529' cy='438' r='0.7' fill='%23fff' opacity='0.47'/%3E%3Ccircle cx='771' cy='421' r='0.8' fill='%23fff' opacity='0.4'/%3E%3Ccircle cx='1005' cy='40' r='0.9' fill='%23fff' opacity='0.46'/%3E%3Ccircle cx='600' cy='376' r='0.6' fill='%23fff' opacity='0.53'/%3E%3Ccircle cx='579' cy='326' r='0.6' fill='%23fff' opacity='0.59'/%3E%3Ccircle cx='881' cy='624' r='1.2' fill='%23fff' opacity='0.25'/%3E%3Ccircle cx='291' cy='279' r='0.7' fill='%23fff' opacity='0.53'/%3E%3Ccircle cx='221' cy='593' r='1.0' fill='%23fff' opacity='0.22'/%3E%3Ccircle cx='492' cy='305' r='2.2' fill='%23fff' opacity='0.47'/%3E%3Ccircle cx='177' cy='4' r='0.6' fill='%23fff' opacity='0.92'/%3E%3Ccircle cx='154' cy='279' r='0.9' fill='%23fff' opacity='0.65'/%3E%3Ccircle cx='589' cy='494' r='0.6' fill='%23fff' opacity='0.23'/%3E%3Ccircle cx='347' cy='201' r='0.9' fill='%23fff' opacity='0.64'/%3E%3Ccircle cx='884' cy='139' r='0.7' fill='%23fff' opacity='0.29'/%3E%3Ccircle cx='1156' cy='378' r='1.5' fill='%23fff' opacity='0.31'/%3E%3Ccircle cx='1139' cy='277' r='0.7' fill='%23fff' opacity='0.37'/%3E%3Ccircle cx='1020' cy='194' r='0.8' fill='%23fff' opacity='0.23'/%3E%3Ccircle cx='1570' cy='634' r='1.5' fill='%23fff' opacity='0.23'/%3E%3Ccircle cx='666' cy='477' r='1.5' fill='%23fff' opacity='0.32'/%3E%3Ccircle cx='1320' cy='315' r='0.8' fill='%23fff' opacity='0.54'/%3E%3Ccircle cx='166' cy='84' r='0.9' fill='%23fff' opacity='0.85'/%3E%3Ccircle cx='198' cy='436' r='0.8' fill='%23fff' opacity='0.35'/%3E%3Ccircle cx='1192' cy='286' r='0.6' fill='%23fff' opacity='0.55'/%3E%3Ccircle cx='1128' cy='5' r='0.9' fill='%23fff' opacity='0.89'/%3E%3Ccircle cx='875' cy='593' r='0.7' fill='%23fff' opacity='0.22'/%3E%3Ccircle cx='979' cy='262' r='0.6' fill='%23fff' opacity='0.36'/%3E%3Ccircle cx='722' cy='589' r='0.6' fill='%23fff' opacity='0.11'/%3E%3Ccircle cx='397' cy='12' r='1.5' fill='%23fff' opacity='0.34'/%3E%3Ccircle cx='729' cy='214' r='0.7' fill='%23fff' opacity='0.67'/%3E%3Ccircle cx='536' cy='111' r='1.5' fill='%23fff' opacity='0.7'/%3E%3Ccircle cx='70' cy='622' r='0.9' fill='%23fff' opacity='0.09'/%3E%3Ccircle cx='1230' cy='116' r='2.2' fill='%23fff' opacity='0.24'/%3E%3Ccircle cx='829' cy='358' r='0.7' fill='%23fff' opacity='0.24'/%3E%3Ccircle cx='1298' cy='565' r='0.8' fill='%23fff' opacity='0.1'/%3E%3Ccircle cx='1450' cy='628' r='0.9' fill='%23fff' opacity='0.18'/%3E%3Ccircle cx='382' cy='345' r='0.6' fill='%23fff' opacity='0.57'/%3E%3Ccircle cx='864' cy='310' r='1.5' fill='%23fff' opacity='0.62'/%3E%3Ccircle cx='124' cy='241' r='1.2' fill='%23fff' opacity='0.38'/%3E%3Ccircle cx='1077' cy='436' r='0.8' fill='%23fff' opacity='0.2'/%3E%3Ccircle cx='860' cy='563' r='1.5' fill='%23fff' opacity='0.22'/%3E%3Ccircle cx='1146' cy='331' r='1.2' fill='%23fff' opacity='0.24'/%3E%3Ccircle cx='1003' cy='457' r='0.7' fill='%23fff' opacity='0.41'/%3E%3Ccircle cx='1445' cy='225' r='0.7' fill='%23fff' opacity='0.4'/%3E%3Ccircle cx='704' cy='66' r='0.6' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='279' cy='630' r='0.6' fill='%23fff' opacity='0.09'/%3E%3Ccircle cx='1247' cy='611' r='0.6' fill='%23fff' opacity='0.15'/%3E%3Ccircle cx='733' cy='233' r='0.7' fill='%23fff' opacity='0.43'/%3E%3Ccircle cx='1416' cy='162' r='0.7' fill='%23fff' opacity='0.73'/%3E%3Ccircle cx='1469' cy='144' r='1.0' fill='%23fff' opacity='0.48'/%3E%3Ccircle cx='1296' cy='457' r='1.2' fill='%23fff' opacity='0.17'/%3E%3Ccircle cx='781' cy='99' r='0.6' fill='%23fff' opacity='0.51'/%3E%3Ccircle cx='517' cy='244' r='1.2' fill='%23fff' opacity='0.5'/%3E%3Ccircle cx='1254' cy='299' r='0.7' fill='%23fff' opacity='0.45'/%3E%3Ccircle cx='868' cy='60' r='0.7' fill='%23fff' opacity='0.57'/%3E%3Ccircle cx='37' cy='163' r='2.2' fill='%23fff' opacity='0.31'/%3E%3Ccircle cx='1372' cy='307' r='0.9' fill='%23fff' opacity='0.22'/%3E%3Ccircle cx='538' cy='210' r='1.5' fill='%23fff' opacity='0.23'/%3E%3Ccircle cx='329' cy='1' r='1.0' fill='%23fff' opacity='0.35'/%3E%3Ccircle cx='723' cy='319' r='1.2' fill='%23fff' opacity='0.61'/%3E%3Ccircle cx='601' cy='413' r='0.6' fill='%23fff' opacity='0.31'/%3E%3Ccircle cx='1334' cy='182' r='0.7' fill='%23fff' opacity='0.43'/%3E%3Ccircle cx='83' cy='638' r='0.6' fill='%23fff' opacity='0.19'/%3E%3Ccircle cx='660' cy='401' r='1.0' fill='%23fff' opacity='0.24'/%3E%3Ccircle cx='1477' cy='423' r='1.5' fill='%23fff' opacity='0.46'/%3E%3Ccircle cx='602' cy='154' r='1.5' fill='%23fff' opacity='0.34'/%3E%3Ccircle cx='129' cy='486' r='0.9' fill='%23fff' opacity='0.23'/%3E%3Ccircle cx='1046' cy='482' r='1.2' fill='%23fff' opacity='0.13'/%3E%3Ccircle cx='322' cy='10' r='1.0' fill='%23fff' opacity='0.88'/%3E%3Ccircle cx='255' cy='570' r='0.9' fill='%23fff' opacity='0.2'/%3E%3Ccircle cx='1162' cy='175' r='1.0' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='390' cy='172' r='1.2' fill='%23fff' opacity='0.53'/%3E%3Ccircle cx='1078' cy='486' r='1.0' fill='%23fff' opacity='0.35'/%3E%3Ccircle cx='407' cy='184' r='1.2' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='1456' cy='210' r='1.5' fill='%23fff' opacity='0.54'/%3E%3Ccircle cx='775' cy='188' r='1.2' fill='%23fff' opacity='0.71'/%3E%3Ccircle cx='1015' cy='162' r='1.0' fill='%23fff' opacity='0.37'/%3E%3Ccircle cx='527' cy='23' r='1.2' fill='%23fff' opacity='0.5'/%3E%3Ccircle cx='1304' cy='316' r='2.2' fill='%23fff' opacity='0.46'/%3E%3Ccircle cx='1532' cy='585' r='0.7' fill='%23fff' opacity='0.32'/%3E%3Ccircle cx='1503' cy='246' r='0.6' fill='%23fff' opacity='0.33'/%3E%3Ccircle cx='1386' cy='281' r='0.7' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='1392' cy='411' r='0.8' fill='%23fff' opacity='0.47'/%3E%3Ccircle cx='300' cy='429' r='1.0' fill='%23fff' opacity='0.19'/%3E%3Ccircle cx='250' cy='181' r='0.6' fill='%23fff' opacity='0.32'/%3E%3Ccircle cx='1493' cy='6' r='1.0' fill='%23fff' opacity='0.54'/%3E%3Ccircle cx='773' cy='626' r='1.2' fill='%23fff' opacity='0.1'/%3E%3Ccircle cx='776' cy='227' r='1.5' fill='%23fff' opacity='0.61'/%3E%3Ccircle cx='479' cy='188' r='0.8' fill='%23fff' opacity='0.24'/%3E%3Ccircle cx='658' cy='10' r='1.2' fill='%23fff' opacity='0.79'/%3E%3Ccircle cx='1319' cy='417' r='1.2' fill='%23fff' opacity='0.25'/%3E%3Ccircle cx='65' cy='32' r='1.0' fill='%23fff' opacity='0.79'/%3E%3Ccircle cx='1418' cy='396' r='0.7' fill='%23fff' opacity='0.33'/%3E%3Ccircle cx='837' cy='334' r='1.0' fill='%23fff' opacity='0.58'/%3E%3Ccircle cx='160' cy='194' r='0.7' fill='%23fff' opacity='0.28'/%3E%3Ccircle cx='793' cy='136' r='0.6' fill='%23fff' opacity='0.42'/%3E%3Ccircle cx='213' cy='224' r='0.8' fill='%23fff' opacity='0.48'/%3E%3Ccircle cx='18' cy='278' r='0.6' fill='%23fff' opacity='0.18'/%3E%3Ccircle cx='1554' cy='36' r='1.5' fill='%23fff' opacity='0.74'/%3E%3Ccircle cx='527' cy='33' r='1.0' fill='%23fff' opacity='0.76'/%3E%3Ccircle cx='1312' cy='104' r='0.9' fill='%23fff' opacity='0.32'/%3E%3Ccircle cx='1339' cy='92' r='2.2' fill='%23fff' opacity='0.53'/%3E%3Ccircle cx='366' cy='242' r='0.8' fill='%23fff' opacity='0.28'/%3E%3Ccircle cx='436' cy='394' r='0.9' fill='%23fff' opacity='0.49'/%3E%3Ccircle cx='570' cy='297' r='1.0' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='1233' cy='377' r='0.7' fill='%23fff' opacity='0.45'/%3E%3Ccircle cx='1427' cy='117' r='1.0' fill='%23fff' opacity='0.74'/%3E%3Ccircle cx='1217' cy='170' r='0.8' fill='%23fff' opacity='0.59'/%3E%3Ccircle cx='1183' cy='124' r='0.6' fill='%23fff' opacity='0.26'/%3E%3Ccircle cx='589' cy='206' r='0.6' fill='%23fff' opacity='0.49'/%3E%3Ccircle cx='238' cy='343' r='1.2' fill='%23fff' opacity='0.29'/%3E%3Ccircle cx='5' cy='277' r='1.5' fill='%23fff' opacity='0.53'/%3E%3Ccircle cx='291' cy='299' r='0.8' fill='%23fff' opacity='0.34'/%3E%3Ccircle cx='236' cy='630' r='1.5' fill='%23fff' opacity='0.19'/%3E%3Ccircle cx='1356' cy='522' r='0.8' fill='%23fff' opacity='0.28'/%3E%3Ccircle cx='928' cy='430' r='0.8' fill='%23fff' opacity='0.49'/%3E%3Ccircle cx='1567' cy='176' r='1.0' fill='%23fff' opacity='0.43'/%3E%3Ccircle cx='1069' cy='290' r='1.0' fill='%23fff' opacity='0.38'/%3E%3Ccircle cx='839' cy='356' r='0.7' fill='%23fff' opacity='0.37'/%3E%3Ccircle cx='1354' cy='622' r='0.8' fill='%23fff' opacity='0.08'/%3E%3Ccircle cx='814' cy='134' r='0.8' fill='%23fff' opacity='0.52'/%3E%3Ccircle cx='430' cy='358' r='0.7' fill='%23fff' opacity='0.44'/%3E%3Ccircle cx='1313' cy='603' r='1.2' fill='%23fff' opacity='0.13'/%3E%3Ccircle cx='261' cy='330' r='1.2' fill='%23fff' opacity='0.21'/%3E%3Ccircle cx='480' cy='408' r='2.2' fill='%23fff' opacity='0.43'/%3E%3Ccircle cx='1482' cy='61' r='1.0' fill='%23fff' opacity='0.37'/%3E%3Ccircle cx='731' cy='196' r='0.8' fill='%23fff' opacity='0.71'/%3E%3Ccircle cx='1197' cy='64' r='0.7' fill='%23fff' opacity='0.45'/%3E%3Ccircle cx='1064' cy='42' r='0.6' fill='%23fff' opacity='0.59'/%3E%3Ccircle cx='704' cy='425' r='1.0' fill='%23fff' opacity='0.39'/%3E%3Ccircle cx='427' cy='586' r='1.0' fill='%23fff' opacity='0.29'/%3E%3Ccircle cx='1035' cy='87' r='0.6' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='110' cy='110' r='0.6' fill='%23fff' opacity='0.24'/%3E%3Ccircle cx='210' cy='120' r='7' fill='url(%23gl)'/%3E%3Ccircle cx='1180' cy='90' r='7' fill='url(%23gl)'/%3E%3Ccircle cx='920' cy='260' r='7' fill='url(%23gl)'/%3E%3Ccircle cx='1460' cy='300' r='7' fill='url(%23gl)'/%3E%3Ccircle cx='520' cy='330' r='7' fill='url(%23gl)'/%3E %3Cpath d='M0 1000 L0 800 L0 785 L40 756 L80 769 L120 733 L160 736 L200 724 L240 687 L280 688 L320 680 L360 680 L400 680 L440 680 L480 680 L520 707 L560 680 L600 680 L640 691 L680 728 L720 735 L760 726 L800 766 L840 728 L880 758 L920 740 L960 711 L1000 680 L1040 680 L1080 707 L1120 680 L1160 687 L1200 699 L1240 688 L1280 692 L1320 680 L1360 680 L1400 680 L1440 695 L1480 689 L1520 680 L1560 687 L1600 683 L1640 680 L1600 1000 Z' fill='url(%23m1)'/%3E%3Cpath d='M0 1000 L0 880 L0 877 L32 881 L64 907 L96 905 L128 906 L160 911 L192 891 L224 892 L256 900 L288 916 L320 890 L352 878 L384 852 L416 872 L448 884 L480 855 L512 885 L544 915 L576 916 L608 916 L640 894 L672 864 L704 866 L736 838 L768 818 L800 802 L832 790 L864 790 L896 790 L928 812 L960 813 L992 822 L1024 822 L1056 832 L1088 829 L1120 815 L1152 847 L1184 878 L1216 899 L1248 912 L1280 901 L1312 884 L1344 870 L1376 843 L1408 860 L1440 854 L1472 876 L1504 868 L1536 897 L1568 916 L1600 885 L1632 866 L1600 1000 Z' fill='url(%23m2)'/%3E%3C/svg%3E\") center bottom / cover no-repeat, #070b1a", "g-fill": "rgba(120,160,255,.06)", "g-fill-2": "rgba(120,160,255,.09)", "g-fill-h": "rgba(120,160,255,.15)", "g-edge": "rgba(120,160,255,.18)", "r-panel": "26px", "r-tile": "24px"} },
  ametista: { name: "Ametista", hint: "Referência · ChatGPT glass", vars: {"bg-rail": "#0b0820", "bg-side": "#120d2a", "bg-main": "#120d2a", "bg-panel": "#1a1438", "bg-input": "#1a1438", "bg-float": "#1a1438", "hover": "#272144", "active": "#2a1f5a", "line": "#2d274a", "line2": "#2d274a", "line3": "#1a1438", "msg-hover": "#191430", "scroll": "#3c3658", "text": "#ece8ff", "text-hi": "#ffffff", "muted": "#aaa2d0", "muted2": "#9991be", "icon": "#d2ccec", "link": "#b9a3ff", "blurple": "#7c3aed", "blurple-h": "#6d28d9", "accent-soft": "#b9a3ff2e", "btn": "#1a1438", "btn-h": "#2d274a", "green": "#4ade80", "red": "#fb7185", "yellow": "#fcd34d", "call-bg": "#0b0820", "tone-lilac": "#2a1f5a", "tone-peach": "#342240", "tone-mint": "#1d2b44", "tone-butter": "#302634", "wall": "radial-gradient(70% 55% at 50% -12%, rgba(167,139,250,.30) 0, rgba(124,58,237,.10) 45%, transparent 72%), radial-gradient(40% 50% at 100% 30%, rgba(99,102,241,.22) 0, transparent 70%), radial-gradient(45% 50% at 0% 85%, rgba(168,85,247,.18) 0, transparent 70%), linear-gradient(180deg, #120c2b 0%, #0b0820 60%, #07051a 100%)", "g-fill": "rgba(196,181,253,.055)", "g-fill-2": "rgba(196,181,253,.085)", "g-fill-h": "rgba(196,181,253,.14)", "g-edge": "rgba(196,181,253,.16)", "r-panel": "28px", "r-tile": "26px"} },
  fucsia: { name: "Fúcsia", hint: "Referência · Meet AI", vars: {"bg-rail": "#08060a", "bg-side": "#0f0b12", "bg-main": "#0f0b12", "bg-panel": "#18131c", "bg-input": "#18131c", "bg-float": "#18131c", "hover": "#252029", "active": "#3a1233", "line": "#2c2730", "line2": "#2c2730", "line3": "#18131c", "msg-hover": "#161219", "scroll": "#3c363f", "text": "#f6ecf6", "text-hi": "#ffffff", "muted": "#b6a6b8", "muted2": "#a394a5", "icon": "#dcd0dd", "link": "#ff6ad5", "blurple": "#c0127e", "blurple-h": "#a10f69", "accent-soft": "#ff6ad52e", "btn": "#18131c", "btn-h": "#2c2730", "green": "#4ade80", "red": "#fb7185", "yellow": "#fcd34d", "call-bg": "#08060a", "tone-lilac": "#3a1233", "tone-peach": "#322127", "tone-mint": "#1b2a2b", "tone-butter": "#2f261b", "wall": "radial-gradient(42% 52% at -4% -6%, rgba(236,72,180,.30) 0, rgba(160,40,150,.10) 40%, transparent 70%), radial-gradient(30% 30% at 100% 100%, rgba(255,62,200,.10) 0, transparent 70%), linear-gradient(160deg, #110a14 0%, #08060a 55%, #050406 100%)", "g-fill": "rgba(255,106,213,.055)", "g-fill-2": "rgba(255,106,213,.085)", "g-fill-h": "rgba(255,106,213,.14)", "g-edge": "rgba(255,106,213,.16)", "r-panel": "20px", "r-tile": "22px"} },
  horizonte: { name: "Horizonte", hint: "Referência · painel azul e laranja", vars: {"bg-rail": "#05070d", "bg-side": "#090d17", "bg-main": "#090d17", "bg-panel": "#0f1522", "bg-input": "#0f1522", "bg-float": "#0f1522", "hover": "#1c222f", "active": "#13254a", "line": "#232936", "line2": "#232936", "line3": "#0f1522", "msg-hover": "#10141e", "scroll": "#323845", "text": "#e8eefb", "text-hi": "#ffffff", "muted": "#9aa7bf", "muted2": "#8995ac", "icon": "#c9d2e3", "link": "#60a5fa", "blurple": "#2563eb", "blurple-h": "#1d4ed8", "accent-soft": "#60a5fa2e", "btn": "#0f1522", "btn-h": "#232936", "green": "#4ade80", "red": "#f87171", "yellow": "#fbbf24", "call-bg": "#05070d", "tone-lilac": "#13254a", "tone-peach": "#2a232d", "tone-mint": "#132c30", "tone-butter": "#262721", "wall": "radial-gradient(40% 45% at 104% 4%, rgba(37,99,235,.38) 0, transparent 70%), radial-gradient(34% 42% at 102% 70%, rgba(234,88,12,.26) 0, transparent 70%), radial-gradient(30% 35% at 0% 100%, rgba(37,99,235,.16) 0, transparent 70%), repeating-linear-gradient(0deg, rgba(148,163,184,.045) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, rgba(148,163,184,.045) 0 1px, transparent 1px 48px), #05070d", "g-fill": "rgba(96,165,250,.055)", "g-fill-2": "rgba(96,165,250,.085)", "g-fill-h": "rgba(96,165,250,.14)", "g-edge": "rgba(96,165,250,.16)", "r-panel": "24px", "r-tile": "24px"} },
  ambar: { name: "Âmbar", hint: "Referência · Savance", vars: {"bg-rail": "#0e0c0b", "bg-side": "#15120f", "bg-main": "#15120f", "bg-panel": "#1d1916", "bg-input": "#1d1916", "bg-float": "#1d1916", "hover": "#2a2622", "active": "#3a2c1f", "line": "#302c29", "line2": "#302c29", "line3": "#1d1916", "msg-hover": "#1c1915", "scroll": "#3f3b37", "text": "#f3ede6", "text-hi": "#ffffff", "muted": "#b5aa9e", "muted2": "#a3998e", "icon": "#dad2c9", "link": "#f2c48f", "blurple": "#7a5230", "blurple-h": "#664426", "accent-soft": "#f2c48f2e", "btn": "#1d1916", "btn-h": "#302c29", "green": "#86d6a0", "red": "#f39b8a", "yellow": "#f2c48f", "call-bg": "#0e0c0b", "tone-lilac": "#3a2c1f", "tone-peach": "#362722", "tone-mint": "#202f26", "tone-butter": "#332b16", "wall": "radial-gradient(60% 55% at 88% -4%, rgba(232,160,80,.50) 0, transparent 70%), radial-gradient(55% 50% at -4% 104%, rgba(130,96,118,.34) 0, transparent 70%), radial-gradient(45% 40% at 55% 45%, rgba(200,140,90,.10) 0, transparent 70%), linear-gradient(160deg, #3a2a1f 0%, #1c1612 45%, #121012 100%)", "g-fill": "rgba(14,12,11,.50)", "g-fill-2": "rgba(22,18,15,.58)", "g-fill-h": "rgba(255,238,220,.08)", "g-edge": "rgba(255,232,210,.10)", "r-panel": "26px", "r-tile": "24px"} },
};
for (const [key, t] of Object.entries(FULL_THEMES)) window.THEMES[key] = { ...t, fixed: true };
window.VISIBLE_THEMES = ['system','arcLight','arcDark','noturno','ametista','fucsia','horizonte','ambar','titanio'];
window.paletteCards = (selected) => Object.entries(window.PALETTES).map(([key,p]) => `<button class="palette-card ${key===selected?'sel':''}" data-palette="${key}"><i style="background:${p.swatch}"></i><span>${p.name}</span></button>`).join('');
let activePalette='lavanda';
const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
let activeTheme = 'system';
// Temas retirados na 2.1.5 (ficaram poucos, mas caprichados): quem usava passa para o mais parecido.
window.RETIRED_THEMES = { esmeralda: 'noturno', echo: 'ametista', sunset: 'fucsia', holografico: 'ametista', menta: 'horizonte', twinkle: 'noturno', aurora: 'horizonte', cromo: 'titanio', grafite: 'titanio', terminal: 'titanio', neon: 'fucsia', cafe: 'horizonte', onix: 'titanio', abissal: 'noturno' };
function themeFor(key) { key = window.RETIRED_THEMES[key] || key; return key === 'system' ? { vars: systemAppearance.matches ? ARC_DARK : ARC_LIGHT, light: !systemAppearance.matches, fixed: true } : window.THEMES[key] || window.THEMES.system; }
window.applyTheme = function (key,palette=activePalette) {
  activePalette = window.PALETTES[palette] ? palette : 'lavanda';
  activeTheme = key;
  // Temas completos (Midnight, Ember, Nord, Mocha, Rosé) já trazem a própria cor de destaque: a paleta não se aplica.
  const t = themeFor(key), vars = { ...BASE, ...t.vars, ...(t.fixed ? {} : window.PALETTES[activePalette][t.light?'light':'dark']) }, root = document.documentElement;
  for (const k of ['wall', 'g-fill', 'g-fill-2', 'g-fill-h', 'g-edge', 'r-panel', 'r-tile']) root.style.removeProperty?.('--' + k);
  root.classList.toggle('theme-fixed', !!t.fixed);
  if (root.dataset) root.dataset.tk = (window.RETIRED_THEMES?.[key] || key) === 'system' ? 'system' : (window.RETIRED_THEMES?.[key] || key); // tema ativo, para detalhes exclusivos (ex.: Noturno)
  for (const [k, v] of Object.entries(vars)) root.style.setProperty('--' + k, v);
  root.classList.toggle('light', !!t.light);
  root.classList.toggle('glass', true); // estilo vidro nos dois temas (claro e escuro)
  root.style.colorScheme = t.light ? 'light' : 'dark';
  window.resenhaNative?.setWindowColors?.(vars['bg-rail'], vars['icon']); // same color as #titlebar, so the window buttons blend in
  return vars;
};
systemAppearance.addEventListener('change', () => { if (activeTheme === 'system') window.applyTheme('system'); });
window.themePreview = (key) => ({ ...BASE, ...themeFor(key).vars });
