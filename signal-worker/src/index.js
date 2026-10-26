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
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/ws') return new Response('Resenha signal', { status: 200 });
    return env.HUB.get(env.HUB.idFromName('hub')).fetch(req);
  },
};
