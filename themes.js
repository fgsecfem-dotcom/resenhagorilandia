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
const ARC_DARK = {
  "bg-rail": "#0e0f13",
  "bg-side": "#16171c",
  "bg-main": "#16171c",
  "bg-panel": "#1d1f25",
  "bg-input": "#1d1f25",
  "bg-float": "#1d1f25",
  "hover": "#23252c",
  "active": "#2a2440",
  "line": "#26282f",
  "line2": "#26282f",
  "line3": "#1d1f25",
  "msg-hover": "#1a1b21",
  "scroll": "#33353e",
  "text": "#ecebf2",
  "text-hi": "#ffffff",
  "muted": "#a3a3b2",
  "muted2": "#9696a6",
  "icon": "#c3c3d0",
  "link": "#b9a3e3",
  "blurple": "#7c5cc4",
  "blurple-h": "#6a4bb3",
  "accent-soft": "#7c5cc433",
  "btn": "#1d1f25",
  "btn-h": "#2a2c34",
  "green": "#3ecf7a",
  "red": "#dc2626",
  "yellow": "#fbbf24",
  "call-bg": "#0e0f13",
  "tone-lilac": "#2a2440",
  "tone-peach": "#2b2226",
  "tone-mint": "#172e2b",
  "tone-butter": "#302b1f"
};
const ARC_LIGHT = {
  "bg-rail": "#f4f3f7",
  "bg-side": "#ffffff",
  "bg-main": "#ffffff",
  "bg-panel": "#f8f7fb",
  "bg-input": "#f8f7fb",
  "bg-float": "#ffffff",
  "hover": "#efeef4",
  "active": "#efe9fb",
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
  "link": "#6a4bb3",
  "blurple": "#7c5cc4",
  "blurple-h": "#6a4bb3",
  "accent-soft": "#7c5cc41a",
  "btn": "#ecebf1",
  "btn-h": "#e1dfe8",
  "green": "#15803d",
  "red": "#dc2626",
  "yellow": "#946200",
  "call-bg": "#ffffff",
  "tone-lilac": "#efe9fb",
  "tone-peach": "#fff1e8",
  "tone-mint": "#eaf8f2",
  "tone-butter": "#fff7dc"
};
window.THEMES = { system: { name: 'Sistema · automático', vars: ARC_DARK }, ...window.THEMES,
  arcDark: { name: 'Resenha · escuro', vars: ARC_DARK }, arcLight: { name: 'Resenha · claro', light: true, vars: ARC_LIGHT } };
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
  esmeralda: { name: "Esmeralda", hint: "Figma · Glowing Line Card", vars: {"bg-rail": "#040806", "bg-side": "#0a110d", "bg-main": "#0a110d", "bg-panel": "#101a14", "bg-input": "#101a14", "bg-float": "#101a14", "hover": "#1d2721", "active": "#0f2e22", "line": "#232d27", "line2": "#232d27", "line3": "#101a14", "msg-hover": "#111814", "scroll": "#323d36", "text": "#e3f2ea", "text-hi": "#ffffff", "muted": "#9db8aa", "muted2": "#8ca598", "icon": "#c7dbd0", "link": "#34d399", "blurple": "#047857", "blurple-h": "#065f46", "accent-soft": "#34d3992e", "btn": "#101a14", "btn-h": "#232d27", "green": "#34d399", "red": "#f87171", "yellow": "#fbbf24", "call-bg": "#040806", "tone-lilac": "#0f2e22", "tone-peach": "#2b2720", "tone-mint": "#143024", "tone-butter": "#272c14", "wall": "radial-gradient(60% 70% at 50% 115%, #10b98170 0, transparent 70%), radial-gradient(40% 40% at 8% 0%, #34d39930 0, transparent 70%), #040806", "g-fill": "rgba(52,211,153,.05)", "g-fill-2": "rgba(52,211,153,.075)", "g-fill-h": "rgba(52,211,153,.13)", "g-edge": "rgba(52,211,153,.15)", "r-panel": "12px", "r-tile": "14px"} },
  ambar: { name: "Âmbar", hint: "Figma · Liquid Glass Amber", vars: {"bg-rail": "#0f0a05", "bg-side": "#17100a", "bg-main": "#17100a", "bg-panel": "#1f160d", "bg-input": "#1f160d", "bg-float": "#1f160d", "hover": "#2c2319", "active": "#33220c", "line": "#32291f", "line2": "#32291f", "line3": "#1f160d", "msg-hover": "#1e1710", "scroll": "#41382d", "text": "#f5ead8", "text-hi": "#ffffff", "muted": "#c4b39a", "muted2": "#b0a089", "icon": "#e1d4bf", "link": "#fbbf24", "blurple": "#b45309", "blurple-h": "#92400e", "accent-soft": "#fbbf242e", "btn": "#1f160d", "btn-h": "#32291f", "green": "#a3e635", "red": "#f87171", "yellow": "#fbbf24", "call-bg": "#0f0a05", "tone-lilac": "#33220c", "tone-peach": "#38241a", "tone-mint": "#222d1e", "tone-butter": "#35280e", "wall": "radial-gradient(50% 45% at 85% 18%, #f59e0b5c 0, transparent 70%), radial-gradient(60% 50% at 12% 92%, #b4530950 0, transparent 70%), linear-gradient(160deg, #1a1208, #0a0806)", "g-fill": "rgba(251,191,36,.05)", "g-fill-2": "rgba(251,191,36,.075)", "g-fill-h": "rgba(251,191,36,.13)", "g-edge": "rgba(251,191,36,.15)", "r-panel": "18px", "r-tile": "20px"} },
  echo: { name: "Echo", hint: "Figma · Echo AI", vars: {"bg-rail": "#060a1c", "bg-side": "#0b1126", "bg-main": "#0b1126", "bg-panel": "#121a33", "bg-input": "#121a33", "bg-float": "#121a33", "hover": "#1e263f", "active": "#1c2350", "line": "#252c45", "line2": "#252c45", "line3": "#121a33", "msg-hover": "#11172d", "scroll": "#333b54", "text": "#e0e7ff", "text-hi": "#ffffff", "muted": "#a5b0d6", "muted2": "#939ec2", "icon": "#c8d1ef", "link": "#a5b4fc", "blurple": "#4f46e5", "blurple-h": "#4338ca", "accent-soft": "#a5b4fc2e", "btn": "#121a33", "btn-h": "#252c45", "green": "#34d399", "red": "#f87171", "yellow": "#fbbf24", "call-bg": "#060a1c", "tone-lilac": "#1c2350", "tone-peach": "#2d273c", "tone-mint": "#16303f", "tone-butter": "#292c30", "wall": "radial-gradient(55% 60% at 0% 0%, #3b82f65c 0, transparent 70%), radial-gradient(50% 55% at 100% 100%, #8b5cf65c 0, transparent 70%), #060a1c", "g-fill": "rgba(96,165,250,.05)", "g-fill-2": "rgba(96,165,250,.075)", "g-fill-h": "rgba(96,165,250,.13)", "g-edge": "rgba(96,165,250,.15)", "r-panel": "16px", "r-tile": "18px"} },
  sunset: { name: "Sunset", hint: "Figma · Bento Cards", vars: {"bg-rail": "#0c0710", "bg-side": "#140c1a", "bg-main": "#140c1a", "bg-panel": "#1c1224", "bg-input": "#1c1224", "bg-float": "#1c1224", "hover": "#291f30", "active": "#371628", "line": "#302536", "line2": "#302536", "line3": "#1c1224", "msg-hover": "#1b1320", "scroll": "#3f3445", "text": "#f8e8f0", "text-hi": "#ffffff", "muted": "#c9b0c0", "muted2": "#b49dad", "icon": "#e5d2dd", "link": "#f9a8d4", "blurple": "#be185d", "blurple-h": "#9d174d", "accent-soft": "#f9a8d42e", "btn": "#1c1224", "btn-h": "#302536", "green": "#4ade80", "red": "#fb7185", "yellow": "#facc15", "call-bg": "#0c0710", "tone-lilac": "#371628", "tone-peach": "#35202e", "tone-mint": "#1f2932", "tone-butter": "#322522", "wall": "radial-gradient(40% 45% at 86% 14%, #ec48996e 0, transparent 70%), radial-gradient(45% 45% at 18% 100%, #f973165c 0, transparent 70%), radial-gradient(30% 30% at 55% 50%, #a855f730 0, transparent 70%), #0c0710", "g-fill": "rgba(255,255,255,.05)", "g-fill-2": "rgba(255,255,255,.075)", "g-fill-h": "rgba(255,255,255,.13)", "g-edge": "rgba(255,255,255,.15)", "r-panel": "22px", "r-tile": "26px"} },
  holografico: { name: "Holográfico", hint: "Pinterest · DSGN.HOUSE", vars: {"bg-rail": "#07061a", "bg-side": "#0d0b24", "bg-main": "#0d0b24", "bg-panel": "#15122f", "bg-input": "#15122f", "bg-float": "#15122f", "hover": "#221f3b", "active": "#221d4d", "line": "#282542", "line2": "#282542", "line3": "#15122f", "msg-hover": "#14122b", "scroll": "#373450", "text": "#ece9ff", "text-hi": "#ffffff", "muted": "#b0abd6", "muted2": "#9d99c2", "icon": "#d4d0ef", "link": "#c4b5fd", "blurple": "#3d5afe", "blurple-h": "#2f4ae0", "accent-soft": "#c4b5fd2e", "btn": "#15122f", "btn-h": "#282542", "green": "#34d399", "red": "#ff5c8a", "yellow": "#ffb547", "call-bg": "#07061a", "tone-lilac": "#221d4d", "tone-peach": "#2f2038", "tone-mint": "#19293c", "tone-butter": "#2c252c", "wall": "radial-gradient(45% 50% at 0% 0%, #3d5afe5c 0, transparent 70%), radial-gradient(40% 45% at 100% 30%, #ff2fa352 0, transparent 70%), radial-gradient(45% 45% at 60% 110%, #ff8a1e48 0, transparent 70%), #07061a", "g-fill": "rgba(201,194,255,.05)", "g-fill-2": "rgba(201,194,255,.075)", "g-fill-h": "rgba(201,194,255,.13)", "g-edge": "rgba(201,194,255,.15)", "r-panel": "14px", "r-tile": "16px"} },
  titanio: { name: "Titânio", hint: "Pinterest · Amplify", vars: {"bg-rail": "#0e0f12", "bg-side": "#16181c", "bg-main": "#16181c", "bg-panel": "#1d2026", "bg-input": "#1d2026", "bg-float": "#1d2026", "hover": "#292c32", "active": "#2c2f37", "line": "#2f3238", "line2": "#2f3238", "line3": "#1d2026", "msg-hover": "#1c1e22", "scroll": "#3d4046", "text": "#e7e9ee", "text-hi": "#ffffff", "muted": "#a8adb7", "muted2": "#979ca6", "icon": "#ced1d8", "link": "#ff8fb5", "blurple": "#5d6570", "blurple-h": "#4b525c", "accent-soft": "#ff8fb52e", "btn": "#1d2026", "btn-h": "#2f3238", "green": "#4ade80", "red": "#ff6b6b", "yellow": "#fbbf24", "call-bg": "#0e0f12", "tone-lilac": "#2c2f37", "tone-peach": "#362d30", "tone-mint": "#203534", "tone-butter": "#333124", "wall": "radial-gradient(70% 60% at 30% 0%, #c7ccd645 0, transparent 70%), radial-gradient(50% 50% at 100% 100%, #9aa3b028 0, transparent 70%), linear-gradient(180deg, #1b1d22, #0e0f12)", "g-fill": "rgba(255,255,255,.05)", "g-fill-2": "rgba(255,255,255,.075)", "g-fill-h": "rgba(255,255,255,.13)", "g-edge": "rgba(255,255,255,.15)", "r-panel": "12px", "r-tile": "14px"} },
  menta: { name: "Menta & Areia", hint: "Pinterest · app de clima", vars: {"bg-rail": "#11161a", "bg-side": "#161d22", "bg-main": "#161d22", "bg-panel": "#1c252b", "bg-input": "#1c252b", "bg-float": "#1c252b", "hover": "#283137", "active": "#133a35", "line": "#2e383d", "line2": "#2e383d", "line3": "#1c252b", "msg-hover": "#1c2328", "scroll": "#3c464a", "text": "#e2f3ef", "text-hi": "#ffffff", "muted": "#a3b8b4", "muted2": "#93a6a4", "icon": "#c9dbd7", "link": "#3ff0c8", "blurple": "#0f766e", "blurple-h": "#115e59", "accent-soft": "#3ff0c82e", "btn": "#1c252b", "btn-h": "#2e383d", "green": "#3ff0c8", "red": "#f87171", "yellow": "#f3d9a8", "call-bg": "#11161a", "tone-lilac": "#133a35", "tone-peach": "#353134", "tone-mint": "#1f3a38", "tone-butter": "#323629", "wall": "radial-gradient(55% 55% at 0% 100%, #3ff0c84a 0, transparent 70%), radial-gradient(45% 45% at 100% 0%, #f3d9a838 0, transparent 70%), #11161a", "g-fill": "rgba(63,240,200,.05)", "g-fill-2": "rgba(63,240,200,.075)", "g-fill-h": "rgba(63,240,200,.13)", "g-edge": "rgba(63,240,200,.15)", "r-panel": "18px", "r-tile": "20px"} },
  twinkle: { name: "Twinkle", hint: "Pinterest · twinkle", vars: {"bg-rail": "#1a2130", "bg-side": "#212a3b", "bg-main": "#212a3b", "bg-panel": "#283246", "bg-input": "#283246", "bg-float": "#283246", "hover": "#343d51", "active": "#34425c", "line": "#3a4356", "line2": "#3a4356", "line3": "#283246", "msg-hover": "#273041", "scroll": "#485162", "text": "#eef1f6", "text-hi": "#ffffff", "muted": "#b6bfcd", "muted2": "#a5aebd", "icon": "#d8dde6", "link": "#e6c89a", "blurple": "#8a6a3a", "blurple-h": "#775a2f", "accent-soft": "#e6c89a2e", "btn": "#283246", "btn-h": "#3a4356", "green": "#86efac", "red": "#f08a7a", "yellow": "#e6c89a", "call-bg": "#1a2130", "tone-lilac": "#34425c", "tone-peach": "#403d4c", "tone-mint": "#294550", "tone-butter": "#3d4141", "wall": "radial-gradient(60% 55% at 100% 0%, #e6c89a30 0, transparent 70%), radial-gradient(50% 50% at 0% 100%, #9fb3c824 0, transparent 70%), linear-gradient(160deg, #2b3547, #1a2130)", "g-fill": "rgba(230,200,154,.05)", "g-fill-2": "rgba(230,200,154,.075)", "g-fill-h": "rgba(230,200,154,.13)", "g-edge": "rgba(230,200,154,.15)", "r-panel": "14px", "r-tile": "16px"} },
  aurora: { name: "Aurora", hint: "Pinterest · Prepare/Run/Sleep", vars: {"bg-rail": "#030304", "bg-side": "#0a0a0d", "bg-main": "#0a0a0d", "bg-panel": "#111116", "bg-input": "#111116", "bg-float": "#111116", "hover": "#1e1e23", "active": "#182033", "line": "#25252a", "line2": "#25252a", "line3": "#111116", "msg-hover": "#111114", "scroll": "#343439", "text": "#ececf1", "text-hi": "#ffffff", "muted": "#a3a3ad", "muted2": "#91919b", "icon": "#cfcfd6", "link": "#93c5fd", "blurple": "#2563eb", "blurple-h": "#1d4ed8", "accent-soft": "#93c5fd2e", "btn": "#111116", "btn-h": "#25252a", "green": "#22c55e", "red": "#f87171", "yellow": "#facc15", "call-bg": "#030304", "tone-lilac": "#182033", "tone-peach": "#2c2022", "tone-mint": "#152826", "tone-butter": "#282416", "wall": "radial-gradient(30% 45% at 12% 106%, #f973166a 0, transparent 70%), radial-gradient(30% 45% at 38% 110%, #facc1552 0, transparent 70%), radial-gradient(30% 45% at 64% 110%, #22c55e4e 0, transparent 70%), radial-gradient(30% 45% at 90% 106%, #3b82f66a 0, transparent 70%), #030304", "g-fill": "rgba(255,255,255,.05)", "g-fill-2": "rgba(255,255,255,.075)", "g-fill-h": "rgba(255,255,255,.13)", "g-edge": "rgba(255,255,255,.15)", "r-panel": "14px", "r-tile": "16px"} },
};
for (const [key, t] of Object.entries(FULL_THEMES)) window.THEMES[key] = { ...t, fixed: true };
window.VISIBLE_THEMES = ['system','arcLight','arcDark','esmeralda','ambar','echo','sunset','holografico','titanio','menta','twinkle','aurora'];
window.paletteCards = (selected) => Object.entries(window.PALETTES).map(([key,p]) => `<button class="palette-card ${key===selected?'sel':''}" data-palette="${key}"><i style="background:${p.swatch}"></i><span>${p.name}</span></button>`).join('');
let activePalette='lavanda';
const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
let activeTheme = 'system';
function themeFor(key) { return key === 'system' ? { vars: systemAppearance.matches ? ARC_DARK : ARC_LIGHT, light: !systemAppearance.matches } : window.THEMES[key] || window.THEMES.system; }
window.applyTheme = function (key,palette=activePalette) {
  activePalette = window.PALETTES[palette] ? palette : 'lavanda';
  activeTheme = key;
  // Temas completos (Midnight, Ember, Nord, Mocha, Rosé) já trazem a própria cor de destaque: a paleta não se aplica.
  const t = themeFor(key), vars = { ...BASE, ...t.vars, ...(t.fixed ? {} : window.PALETTES[activePalette][t.light?'light':'dark']) }, root = document.documentElement;
  for (const k of ['wall', 'g-fill', 'g-fill-2', 'g-fill-h', 'g-edge', 'r-panel', 'r-tile']) root.style.removeProperty?.('--' + k);
  root.classList.toggle('theme-fixed', !!t.fixed);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty('--' + k, v);
  root.classList.toggle('light', !!t.light);
  root.classList.toggle('glass', true); // estilo vidro nos dois temas (claro e escuro)
  root.style.colorScheme = t.light ? 'light' : 'dark';
  window.resenhaNative?.setWindowColors?.(vars['bg-rail'], vars['icon']); // same color as #titlebar, so the window buttons blend in
  return vars;
};
systemAppearance.addEventListener('change', () => { if (activeTheme === 'system') window.applyTheme('system'); });
window.themePreview = (key) => ({ ...BASE, ...themeFor(key).vars });
