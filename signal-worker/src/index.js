// Descoberta do Resenha (Cloudflare Worker + Durable Object): um "MQTT mínimo" por WebSocket.
// Só repassa bytes entre quem assina o mesmo tópico. Não guarda nada, não lê nada: as mensagens já vêm
// criptografadas com o código da sala (AES-256-GCM), igual faziam nos brokers MQTT públicos.
// Protocolo: texto {"s":topico} assina, {"u":topico} cancela; binário = [tam do tópico][tópico utf8][carga] publica.
export class Hub {
  constructor(state) { this.state = state; }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Resenha signal ok', { status: 200 });
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ t: [] });
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, msg) {
    if (typeof msg === 'string') {
      let m; try { m = JSON.parse(msg); } catch { return; }
      const a = ws.deserializeAttachment() || { t: [] };
      if (typeof m.s === 'string' && m.s.length <= 120 && a.t.length < 20 && !a.t.includes(m.s)) a.t.push(m.s);
      if (typeof m.u === 'string') a.t = a.t.filter((x) => x !== m.u);
      if (m.p === 1) ws.send('{"p":1}'); // ping de vida
      ws.serializeAttachment(a);
      return;
    }
    const b = new Uint8Array(msg);
    if (b.length < 2 || b.length > 64 * 1024) return;
    const n = b[0], topic = new TextDecoder().decode(b.subarray(1, 1 + n));
    for (const o of this.state.getWebSockets()) {
      // como no MQTT, quem publica também recebe (o app ignora as próprias mensagens; duas salas no mesmo app dividem a conexão)
      const a = o.deserializeAttachment();
      if (a && a.t.includes(topic)) try { o.send(b); } catch {}
    }
  }
  webSocketClose(ws) { try { ws.close(); } catch {} }
  webSocketError(ws) { try { ws.close(); } catch {} }
}
// Desempenho anônimo (POST /perf): o app manda um resumo de números no fim da call. Só grava o resumo e a hora;
// nunca lê nem guarda o IP. Sem o banco PERF configurado, só responde e descarta.
export async function savePerf(req, env, now = Date.now()) {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (!env.PERF) return new Response(null, { status: 204 });
  const text = await req.text();
  if (text.length > 8192) return new Response(null, { status: 413 });
  let r; try { r = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  if (!r || r.schema !== 1 || !/^[0-9a-f]{32}$/.test(r.install) || !/^\d+\.\d+\.\d+/.test(String(r.version || ''))) return new Response(null, { status: 400 });
  await env.PERF.prepare('INSERT INTO perf (at, install, version, platform, data) VALUES (?, ?, ?, ?, ?)')
    .bind(now, r.install, String(r.version).slice(0, 20), String(r.platform || '').slice(0, 10), text).run();
  return new Response(null, { status: 204 });
}
// Repasse (TURN) da Cloudflare: credenciais temporárias para quando a ligação direta entre dois PCs falha.
// Configurar uma vez: crie a chave em Realtime > TURN Server no painel e rode
// `npx wrangler secret put TURN_KEY_ID` e `npx wrangler secret put TURN_KEY_API_TOKEN`. Sem os dois, responde lista vazia.
export const TURN_TTL = 12 * 60 * 60; // uma call longa não pode perder o repasse no meio (o app renova de hora em hora)
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
export async function turnServers(req, env, fetchImpl = fetch) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  const empty = (status = 200) => new Response(JSON.stringify({ iceServers: [], ttl: 0 }), { status, headers: CORS });
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return empty();
  const r = await fetchImpl(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: TURN_TTL }),
  });
  if (!r.ok) return empty(502);
  const d = await r.json();
  // Só as entradas de repasse (STUN o app já tem) e sem a porta 53, que os navegadores bloqueiam (recomendação da Cloudflare).
  const list = [].concat(d.iceServers || []).map((s) => ({ ...s, urls: [].concat(s.urls || []).filter((u) => /^turns?:/.test(u) && !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length && s.username && s.credential);
  return new Response(JSON.stringify({ iceServers: list, ttl: TURN_TTL }), { status: 200, headers: CORS });
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/perf') return savePerf(req, env).catch(() => new Response(null, { status: 500 }));
    if (url.pathname === '/turn') return turnServers(req, env).catch(() => new Response(JSON.stringify({ iceServers: [], ttl: 0 }), { status: 502, headers: CORS }));
    if (url.pathname !== '/ws') return new Response('Resenha signal', { status: 200 });
    return env.HUB.get(env.HUB.idFromName('hub')).fetch(req);
  },
};
