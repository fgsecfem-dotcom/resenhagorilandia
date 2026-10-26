// Monta o PWA em <saída> a partir de app/ (mesmo código do app de PC, no modo celular).
// Uso: electron.exe pwa/build-pwa.js <saída>   (roda como app Electron para desenhar os ícones)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), src = path.join(root, 'app');
const out = path.resolve(process.argv[process.argv.length - 1]);
const version = require(path.join(root, 'package.json')).version;

// Só o necessário para o navegador (nada de instalador, ícones de Windows/Mac ou janela de inicialização).
const SKIP = /^(launcher[.-]|pipoca-.*-master\.png$|brand-pipoca\.png$|.*\.ico$|.*\.icns$|icon256\.png$)/;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.test(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
const list = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? list(path.join(dir, e.name), base + e.name + '/') : [base + e.name]);

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  copyDir(src, out);
  for (const f of ['pwa.js', 'pwa-boot.js']) fs.copyFileSync(path.join(__dirname, f), path.join(out, f));
  fs.copyFileSync(path.join(root, 'node_modules/mqtt/dist/mqtt.min.js'), path.join(out, 'mqtt.min.js'));

  // index.html: manifesto, ícone do iPhone e os scripts do PWA antes do app.
  let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  html = html.replace('<link rel="icon" type="image/png" href="icon.png">',
    '<link rel="icon" type="image/png" href="icon.png">\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#0e0f13">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Resenha">\n<link rel="apple-touch-icon" href="pwa-icon-180.png">');
  html = html.replace('<script src="tunnel.js"></script>', '<script src="tunnel.js"></script>\n<script src="mqtt.min.js"></script>\n<script src="pwa.js"></script>\n<script src="pwa-boot.js"></script>');
  if (!html.includes('pwa.js')) throw new Error('não achei onde pôr os scripts do PWA no index.html');
  fs.writeFileSync(path.join(out, 'index.html'), html);

  // Ícones da Pipoquinha (padrão) para a tela inicial do celular.
  const pipoca = fs.readFileSync(path.join(src, 'pipoca.js'), 'utf8');
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<body></body>');
  const pngs = await win.webContents.executeJavaScript(`(async()=>{${pipoca};
    const draw=async(svg,s)=>{const i=new Image();i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await i.decode();const c=document.createElement('canvas');c.width=c.height=s;c.getContext('2d').drawImage(i,0,0,s,s);return c.toDataURL('image/png').split(',')[1];};
    const full=PIPOCA.pipocaSVG('quentinha',1024);
    // "maskable": o sistema corta em círculo ou gota; a pipoca fica no centro com folga.
    const mask=full.replace('<rect width="84" height="84" rx="20"','<rect width="84" height="84" rx="0"').replace('<g fill="#fff8ee">','<g transform="translate(8.4 8.4) scale(.8)"><g fill="#fff8ee">').replace('</svg>','</g></svg>');
    return {p180:await draw(full,180),p192:await draw(full,192),p512:await draw(full,512),m512:await draw(mask,512)};})()`);
  for (const [k, f] of [['p180', 'pwa-icon-180.png'], ['p192', 'pwa-icon-192.png'], ['p512', 'pwa-icon-512.png'], ['m512', 'pwa-maskable-512.png']]) fs.writeFileSync(path.join(out, f), Buffer.from(pngs[k], 'base64'));

  fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
    name: 'Resenha', short_name: 'Resenha', description: 'Call, live e chat com a galera. Entre pelo código da sala.',
    start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: '#0e0f13', theme_color: '#0e0f13', lang: 'pt-BR',
    icons: [{ src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
  }, null, 2));

  // Service worker com a lista de arquivos e uma versão que muda sempre que algum arquivo muda.
  const files = list(out).filter((f) => f !== 'sw.js');
  const hash = crypto.createHash('sha256'); for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(out, f)));
  const tag = version + '-' + hash.digest('hex').slice(0, 10);
  const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8').replace("'__VERSION__'", JSON.stringify(tag)).replace('__FILES__', JSON.stringify(['', ...files]));
  fs.writeFileSync(path.join(out, 'sw.js'), sw);
  fs.writeFileSync(path.join(out, '.nojekyll'), ''); // GitHub Pages: servir arquivos como estão
  console.log('PWA pronto em', out, '·', files.length, 'arquivos · versão', tag);
  app.quit();
}).catch((e) => { console.error(e); app.exit(1); });
