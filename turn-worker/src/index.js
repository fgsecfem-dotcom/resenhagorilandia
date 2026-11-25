// Repasse (TURN) da Cloudflare: credenciais temporárias para quando a ligação direta entre dois PCs não fura o NAT.
// O app (app/turn.js) pede ao abrir e renova de hora em hora. Sem os segredos, responde lista vazia e o app segue só com STUN.
export const TURN_TTL = 12 * 60 * 60; // uma call longa não pode perder o repasse no meio
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
const empty = (status = 200) => new Response(JSON.stringify({ iceServers: [], ttl: 0 }), { status, headers: CORS });
export async function turnServers(req, env, fetchImpl = fetch) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  if (env.LIMIT) { const { success } = await env.LIMIT.limit({ key: req.headers.get('cf-connecting-ip') || 'x' }); if (!success) return empty(429); }
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
    if (new URL(req.url).pathname !== '/turn') return new Response('Resenha turn', { status: 200 });
    return turnServers(req, env).catch(() => empty(502));
  },
};
