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
  "bg-rail": "#0a0a0b",
  "bg-side": "#0e0e10",
  "bg-main": "#0e0e10",
  "bg-panel": "#151517",
  "bg-input": "#151517",
  "bg-float": "#18181a",
  "hover": "#1c1c1f",
  "active": "#232326",
  "line": "#232326",
  "line2": "#232326",
  "line3": "#151517",
  "msg-hover": "#1c1c1f",
  "scroll": "#232326",
  "text": "#ededee",
  "text-hi": "#ffffff",
  "muted": "#a1a1a6",
  "muted2": "#a1a1a6",
  "icon": "#c6c6cb",
  "link": "#ff9a57",
  "blurple": "#3d3d41",
  "blurple-h": "#4a4a4f",
  "accent-soft": "rgba(255,255,255,.08)",
  "btn": "#151517",
  "btn-h": "#232326",
  "green": "#3ecf7a",
  "red": "#ef4444",
  "yellow": "#fbbf24",
  "call-bg": "#0a0a0b",
  "tone-lilac": "#232326",
  "tone-peach": "#1c1c1f",
  "tone-mint": "#1c1c1f",
  "tone-butter": "#1c1c1f",
  "wall": "linear-gradient(180deg, #0d0d0f 0%, #0a0a0b 100%)",
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
  arcDark: { name: 'Líquido · preto', fixed: true, vars: ARC_DARK }, arcLight: { name: 'Resenha · claro', light: true, fixed: true, vars: ARC_LIGHT } };
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
  vidro: {"name": "Líquido · translúcido", "hint": "vidro fumê sobre cena desfocada", "vars": {"bg-rail": "#2b2b2e", "bg-side": "#323236", "bg-main": "#323236", "bg-panel": "#3a3a3e", "bg-input": "#2a2a2d", "bg-float": "#3a3a3e", "hover": "#3d3d41", "active": "#47474c", "line": "#45454a", "line2": "#45454a", "line3": "#3a3a3e", "msg-hover": "#38383c", "scroll": "#55555a", "text": "#f2f2f3", "text-hi": "#ffffff", "muted": "#c4c4c9", "muted2": "#b4b4ba", "icon": "#dedee2", "link": "#ffb07a", "blurple": "#4a4a50", "blurple-h": "#56565c", "accent-soft": "rgba(255,255,255,.10)", "btn": "#3a3a3e", "btn-h": "#47474c", "green": "#4fdc8c", "red": "#ff6b61", "yellow": "#fbbf24", "call-bg": "#1d1d20", "tone-lilac": "#47474c", "tone-peach": "#3d3d41", "tone-mint": "#3d3d41", "tone-butter": "#3d3d41", "wall": "linear-gradient(180deg, #505054 0%, #3f3f43 100%)", "g-fill": "rgba(255,255,255,.06)", "g-fill-2": "rgba(255,255,255,.09)", "g-fill-h": "rgba(255,255,255,.13)", "g-edge": "rgba(255,255,255,.10)"}},
  vision: {"name": "Vision", "hint": "vidro fosco claro, painéis soltos", "vars": {"bg-rail": "#2c3337", "bg-side": "#384146", "bg-main": "#384146", "bg-panel": "#434d53", "bg-input": "#434d53", "bg-float": "#4a545a", "hover": "#4e585e", "active": "#58636a", "line": "#5a656b", "line2": "#5a656b", "line3": "#434d53", "msg-hover": "#4e585e", "scroll": "#5a656b", "text": "#f4f7f8", "text-hi": "#ffffff", "muted": "#d3dadd", "muted2": "#d3dadd", "icon": "#e6ebee", "link": "#ffffff", "blurple": "#2f63c7", "blurple-h": "#2856b0", "accent-soft": "rgba(255,255,255,.14)", "btn": "#434d53", "btn-h": "#5a656b", "green": "#3ecf7a", "red": "#ef4444", "yellow": "#fbbf24", "call-bg": "#2c3337", "tone-lilac": "#58636a", "tone-peach": "#4e585e", "tone-mint": "#4e585e", "tone-butter": "#4e585e", "wall": "linear-gradient(180deg, #7a8489 0%, #5a6469 100%)", "g-fill": "rgba(255,255,255,.13)", "g-fill-2": "rgba(255,255,255,.18)", "g-fill-h": "rgba(255,255,255,.24)", "g-edge": "rgba(255,255,255,.24)"}},
  visionNoite: {"name": "Vision · noite", "hint": "vidro fosco escuro, painéis soltos", "vars": {"bg-rail": "#14171a", "bg-side": "#1b1f23", "bg-main": "#1b1f23", "bg-panel": "#23282d", "bg-input": "#23282d", "bg-float": "#272c32", "hover": "#2b3137", "active": "#333a41", "line": "#323940", "line2": "#323940", "line3": "#23282d", "msg-hover": "#262b31", "scroll": "#3c444c", "text": "#eef2f5", "text-hi": "#ffffff", "muted": "#aeb8c1", "muted2": "#9ea9b3", "icon": "#d5dde3", "link": "#ffffff", "blurple": "#2f63c7", "blurple-h": "#2856b0", "accent-soft": "rgba(255,255,255,.10)", "btn": "#23282d", "btn-h": "#323940", "green": "#4fdc8c", "red": "#ff6b61", "yellow": "#fbbf24", "call-bg": "#14171a", "tone-lilac": "#333a41", "tone-peach": "#2b3137", "tone-mint": "#2b3137", "tone-butter": "#2b3137", "wall": "linear-gradient(180deg, #23292e 0%, #161a1e 100%)", "g-fill": "rgba(255,255,255,.07)", "g-fill-2": "rgba(255,255,255,.10)", "g-fill-h": "rgba(255,255,255,.14)", "g-edge": "rgba(255,255,255,.14)"}},
  cosmos: {"name": "Cosmos", "hint": "céu estrelado e horizonte de planeta", "vars": {"bg-rail": "#03050d", "bg-side": "#070c1e", "bg-main": "#070c1e", "bg-panel": "#0d1631", "bg-input": "#0d1631", "bg-float": "#101a3a", "hover": "#15204a", "active": "#1a2a5c", "line": "#1c2850", "line2": "#1c2850", "line3": "#0d1631", "msg-hover": "#15204a", "scroll": "#1c2850", "text": "#e6ecff", "text-hi": "#ffffff", "muted": "#a3b3da", "muted2": "#a3b3da", "icon": "#c8d3f2", "link": "#a9c1ff", "blurple": "#3555d6", "blurple-h": "#2d48b8", "accent-soft": "rgba(169,193,255,.12)", "btn": "#0d1631", "btn-h": "#1c2850", "green": "#3ecf7a", "red": "#ef4444", "yellow": "#fbbf24", "call-bg": "#03050d", "tone-lilac": "#1a2a5c", "tone-peach": "#15204a", "tone-mint": "#15204a", "tone-butter": "#15204a", "wall": "linear-gradient(180deg, #060a16 0%, #050913 100%)", "g-fill": "rgba(120,150,255,.06)", "g-fill-2": "rgba(120,150,255,.09)", "g-fill-h": "rgba(120,150,255,.14)", "g-edge": "rgba(169,193,255,.13)"}},
  neon: {"name": "Neon", "hint": "feixe de luz violeta e azul", "vars": {"bg-rail": "#06050b", "bg-side": "#0b0a14", "bg-main": "#0b0a14", "bg-panel": "#13111f", "bg-input": "#13111f", "bg-float": "#171528", "hover": "#1d1a33", "active": "#241f45", "line": "#221f38", "line2": "#221f38", "line3": "#13111f", "msg-hover": "#1d1a33", "scroll": "#221f38", "text": "#ece9ff", "text-hi": "#ffffff", "muted": "#aba5d2", "muted2": "#aba5d2", "icon": "#d0cbef", "link": "#ab9eff", "blurple": "#5f4be8", "blurple-h": "#523fd0", "accent-soft": "rgba(143,125,255,.12)", "btn": "#13111f", "btn-h": "#221f38", "green": "#3ecf7a", "red": "#ef4444", "yellow": "#fbbf24", "call-bg": "#06050b", "tone-lilac": "#241f45", "tone-peach": "#1d1a33", "tone-mint": "#1d1a33", "tone-butter": "#1d1a33", "wall": "linear-gradient(180deg, #09080f 0%, #07060c 100%)", "g-fill": "rgba(143,125,255,.05)", "g-fill-2": "rgba(143,125,255,.08)", "g-fill-h": "rgba(143,125,255,.13)", "g-edge": "rgba(143,125,255,.16)"}},
  brasa: {"name": "Brasa", "hint": "marrom quente com menta", "vars": {"bg-rail": "#120a07", "bg-side": "#1a110c", "bg-main": "#1a110c", "bg-panel": "#241812", "bg-input": "#241812", "bg-float": "#2a1c15", "hover": "#301f17", "active": "#3b2619", "line": "#36251b", "line2": "#36251b", "line3": "#241812", "msg-hover": "#301f17", "scroll": "#36251b", "text": "#f6ece4", "text-hi": "#ffffff", "muted": "#c8b2a2", "muted2": "#c8b2a2", "icon": "#e6d6ca", "link": "#3ef0c3", "blurple": "#9a4a1f", "blurple-h": "#86401b", "accent-soft": "rgba(62,240,195,.10)", "btn": "#241812", "btn-h": "#36251b", "green": "#3ef0c3", "red": "#ef4444", "yellow": "#fbbf24", "call-bg": "#120a07", "tone-lilac": "#3b2619", "tone-peach": "#301f17", "tone-mint": "#301f17", "tone-butter": "#301f17", "wall": "linear-gradient(180deg, #1c120d 0%, #170f0a 100%)", "g-fill": "rgba(255,230,210,.045)", "g-fill-2": "rgba(255,230,210,.065)", "g-fill-h": "rgba(255,230,210,.10)", "g-edge": "rgba(255,230,210,.08)"}},
  bento: {"name": "Bento", "hint": "papel creme e azul-ardósia", "light": true, "vars": {"bg-rail": "#cfc7b9", "bg-side": "#efe9de", "bg-main": "#efe9de", "bg-panel": "#f6f2ea", "bg-input": "#ffffff", "bg-float": "#fbf8f2", "hover": "#e6dfd2", "active": "#e0d8c8", "line": "#d9d1c1", "line2": "#d9d1c1", "line3": "#f6f2ea", "msg-hover": "#e6dfd2", "scroll": "#d9d1c1", "text": "#1d2733", "text-hi": "#0f1720", "muted": "#56606d", "muted2": "#56606d", "icon": "#2b3644", "link": "#1f3a5f", "blurple": "#1f3a5f", "blurple-h": "#182e4c", "accent-soft": "rgba(31,58,95,.08)", "btn": "#f6f2ea", "btn-h": "#d9d1c1", "green": "#2f855a", "red": "#c2410c", "yellow": "#fbbf24", "call-bg": "#cfc7b9", "tone-lilac": "#e0d8c8", "tone-peach": "#e6dfd2", "tone-mint": "#e6dfd2", "tone-butter": "#e6dfd2", "wall": "linear-gradient(180deg, #d4ccbe 0%, #cfc7b9 100%)", "g-fill": "rgba(255,255,255,.55)", "g-fill-2": "rgba(255,255,255,.7)", "g-fill-h": "rgba(255,255,255,.85)", "g-edge": "rgba(29,39,51,.08)"}},
  cinema: {"name": "Cinema", "hint": "sala escura com luz vermelha", "vars": {"bg-rail": "#040303", "bg-side": "#0b0808", "bg-main": "#0b0808", "bg-panel": "#140e0e", "bg-input": "#140e0e", "bg-float": "#191111", "hover": "#1f1515", "active": "#2c1416", "line": "#261a1a", "line2": "#261a1a", "line3": "#140e0e", "msg-hover": "#1f1515", "scroll": "#261a1a", "text": "#f6eded", "text-hi": "#ffffff", "muted": "#bca5a5", "muted2": "#bca5a5", "icon": "#e3d2d2", "link": "#ff707a", "blurple": "#c81e2c", "blurple-h": "#ad1926", "accent-soft": "rgba(255,59,71,.12)", "btn": "#140e0e", "btn-h": "#261a1a", "green": "#3ecf7a", "red": "#ef4444", "yellow": "#fbbf24", "call-bg": "#040303", "tone-lilac": "#2c1416", "tone-peach": "#1f1515", "tone-mint": "#1f1515", "tone-butter": "#1f1515", "wall": "linear-gradient(180deg, #080505 0%, #060404 100%)", "g-fill": "rgba(255,255,255,.04)", "g-fill-2": "rgba(255,255,255,.06)", "g-fill-h": "rgba(255,255,255,.09)", "g-edge": "rgba(255,255,255,.07)"}}
};
for (const [key, t] of Object.entries(FULL_THEMES)) window.THEMES[key] = { ...t, fixed: true };
// 2.2: Holofoil = base do Líquido preto, com petróleo holográfico e vidro de cristal (themes-pro.css)
window.THEMES.holofoil = { name: 'Holofoil', hint: 'cristal com reflexo de arco-íris', fixed: true, vars: { ...ARC_DARK, link: '#6cc6cf' } };
window.VISIBLE_THEMES = ['system','arcLight','arcDark','vidro','holofoil','vision','visionNoite','cosmos','neon','brasa','bento','cinema'];
window.paletteCards = (selected) => Object.entries(window.PALETTES).map(([key,p]) => `<button class="palette-card ${key===selected?'sel':''}" data-palette="${key}"><i style="background:${p.swatch}"></i><span>${p.name}</span></button>`).join('');
let activePalette='lavanda';
const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
let activeTheme = 'system';
// Temas retirados: quem usava passa para o mais parecido (2.2: Noturno→Cosmos, Ametista→Neon, Fúcsia→Cinema, Horizonte→Vision, Âmbar→Brasa, Titânio→Bento).
window.RETIRED_THEMES = { esmeralda: 'cosmos', echo: 'neon', sunset: 'cinema', holografico: 'neon', menta: 'vision', twinkle: 'cosmos', aurora: 'vision', cromo: 'bento', grafite: 'bento', terminal: 'bento', cafe: 'vision', onix: 'bento', abissal: 'cosmos', noturno: 'cosmos', ametista: 'neon', fucsia: 'cinema', horizonte: 'vision', ambar: 'brasa', titanio: 'bento' };
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
  try { window.dispatchEvent?.(new Event('resenha-theme')); } catch {} // a call refaz o arranjo do tema
  return vars;
};
systemAppearance.addEventListener('change', () => { if (activeTheme === 'system') window.applyTheme('system'); });
window.themePreview = (key) => ({ ...BASE, ...themeFor(key).vars });
