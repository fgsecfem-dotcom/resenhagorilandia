// Repasse (TURN) da Cloudflare: credenciais temporárias para quando a ligação direta entre dois PCs não fura o NAT.
// O app (app/turn.js) pede ao abrir e renova de hora em hora. Sem os segredos, responde lista vazia e o app segue só com STUN.
export const TURN_TTL = 12 * 60 * 60; // uma call longa não pode perder o repasse no meio
// Teto de gasto: a Cloudflare não trava o TURN sozinha (só manda alerta). Então o próprio Worker para de entregar
// credenciais quando o uso chega a 800 GB nos últimos 31 dias (a franquia grátis é 1.000 GB por mês).
// A janela de 31 dias cobre qualquer ciclo de cobrança, e a folga de 200 GB cobre o que já está em uso (até 12 h).
export const CAP_BYTES = 800e9;
const DAY = 864e5;
let usageCache = null; // { bytes, at }
// Soma o que a Cloudflare cobra (egressBytes) na conta. Precisa de ANALYTICS_TOKEN (Account Analytics: Read).
export async function turnUsage(env, fetchImpl = fetch, now = Date.now()) {
  if (usageCache && now - usageCache.at < 10 * 60e3) return usageCache.bytes;
  const from = new Date(now - 31 * DAY).toISOString().slice(0, 10), to = new Date(now + DAY).toISOString().slice(0, 10);
  const query = `query { viewer { accounts(filter: { accountTag: "${env.CF_ACCOUNT_ID}" }) { callsTurnUsageAdaptiveGroups(limit: 1, filter: { date_geq: "${from}", date_leq: "${to}" }) { sum { egressBytes } } } } }`;
  const r = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: `Bearer ${env.ANALYTICS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  const d = r.ok ? await r.json() : null, acc = d?.data?.viewer?.accounts?.[0];
  if (!acc || d.errors?.length) throw new Error('uso indisponível');
  const bytes = (acc.callsTurnUsageAdaptiveGroups || []).reduce((n, g) => n + (Number(g.sum?.egressBytes) || 0), 0);
  usageCache = { bytes, at: now };
  return bytes;
}
export const resetUsageCache = () => { usageCache = null; };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
const empty = (status = 200) => new Response(JSON.stringify({ iceServers: [], ttl: 0 }), { status, headers: CORS });
export async function turnServers(req, env, fetchImpl = fetch) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  if (env.LIMIT) { const { success } = await env.LIMIT.limit({ key: req.headers.get('cf-connecting-ip') || 'x' }); if (!success) return empty(429); }
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return empty();
  // Sem como medir o uso, não entrega: melhor ficar sem repasse do que gerar cobrança sem saber.
  if (!env.ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return empty();
  try { if ((await turnUsage(env, fetchImpl)) >= CAP_BYTES) return empty(); } catch { return empty(503); }
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
