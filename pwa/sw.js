// Resenha PWA · service worker.
// 1) Guarda os arquivos do app para abrir rápido (e atualiza quando sai versão nova: a página pergunta antes de trocar).
// 2) Pedidos para ".../tun/..." (fotos, anexos, banner, upload) vão para a página, que busca pelo túnel até o anfitrião.
const VERSION = '__VERSION__';
const CACHE = 'resenha-pwa-' + VERSION;
const FILES = __FILES__;
const BASE = new URL('./', self.location).pathname;

self.addEventListener('install', (e) => {
  // Guardar para abrir offline é "melhor esforço": se falhar, a ponte com o túnel continua funcionando.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => BASE + f))).catch((err) => console.warn('[sw] cache', err)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('resenha-pwa-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'atualizar') self.skipWaiting(); });

async function viaTunnel(event) {
  const req = event.request, url = new URL(req.url);
  const client = (event.clientId && await self.clients.get(event.clientId)) || (await self.clients.matchAll({ type: 'window' }))[0];
  if (!client) return new Response('', { status: 503 });
  const body = ['GET', 'HEAD'].includes(req.method) ? null : await req.arrayBuffer();
  const headers = [...req.headers].filter(([k]) => /^(range|content-type|if-none-match|if-modified-since)$/i.test(k));
  const ch = new MessageChannel();
  // O corpo chega aos pedaços (stream): anexos grandes tocam sem ficar inteiros na memória do celular.
  let ctrl = null; const early = [];
  const push = (d) => {
    if (!ctrl) return early.push(d);
    try {
      if (d.t === 'chunk') ctrl.enqueue(new Uint8Array(d.body));
      else if (d.t === 'end') ctrl.close();
      else if (d.t === 'abort') ctrl.error(new Error(d.error || 'interrompido'));
    } catch {}
  };
  const stream = new ReadableStream({ start(c) { ctrl = c; for (const d of early.splice(0)) push(d); }, cancel() { try { ch.port1.close(); } catch {} } });
  const reply = new Promise((res) => {
    const t = setTimeout(() => res({ error: 'tempo' }), 130000);
    ch.port1.onmessage = (m) => {
      const d = m.data || {};
      if (d.t === 'head' || d.t === 'error' || !d.t) { clearTimeout(t); res(d); } // sem "t": página antiga, resposta inteira
      else push(d);
    };
  });
  client.postMessage({ t: 'tun-fetch', stream: true, method: req.method, path: url.pathname.slice((BASE + 'tun').length) + url.search, headers, body }, [ch.port2, ...(body ? [body] : [])]);
  const r = await reply;
  if (r.error) return new Response('', { status: 502, statusText: r.error });
  const empty = [101, 204, 205, 304].includes(r.status) || req.method === 'HEAD';
  const out = empty ? null : r.t === 'head' ? stream : r.body;
  return new Response(out, { status: r.status, statusText: r.statusText, headers: r.headers });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(BASE + 'tun/')) return event.respondWith(viaTunnel(event));
  // App: primeiro o que está guardado; páginas caem no index.html.
  event.respondWith((async () => {
    const hit = await caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }).catch(() => null);
    if (hit) return hit;
    try { return await fetch(event.request); }
    catch { if (event.request.mode === 'navigate') return caches.match(BASE + 'index.html'); throw new Error('offline'); }
  })());
});
