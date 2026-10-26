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
  const reply = new Promise((res) => { ch.port1.onmessage = (m) => res(m.data); setTimeout(() => res({ error: 'tempo' }), 130000); });
  client.postMessage({ t: 'tun-fetch', method: req.method, path: url.pathname.slice((BASE + 'tun').length) + url.search, headers, body }, [ch.port2, ...(body ? [body] : [])]);
  const r = await reply;
  if (r.error) return new Response('', { status: 502, statusText: r.error });
  const empty = [101, 204, 205, 304].includes(r.status) || req.method === 'HEAD';
  return new Response(empty ? null : r.body, { status: r.status, statusText: r.statusText, headers: r.headers });
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
