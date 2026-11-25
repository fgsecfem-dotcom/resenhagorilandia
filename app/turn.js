'use strict';
// Repasse pela Cloudflare (TURN) para quando a ligação direta entre dois PCs não fura o NAT.
// Ele entra JUNTO com a tentativa direta, no mesmo pedido de conexão: o WebRTC testa tudo em paralelo,
// prefere sempre o caminho direto e só usa o repasse se o direto não responder. Ninguém vê "tentando de novo".
// As credenciais são temporárias (12 h), geradas pelo Worker de descoberta (signal-worker, rota /turn).
// Sem rede ou sem Worker, a lista fica vazia e tudo continua como antes (só STUN).
window.ResenhaTurn = (() => {
  const URL_TURN = 'https://resenha-signal.resenha-signal.workers.dev/turn';
  const REFRESH = 60 * 60e3, MAX_AGE = 11 * 60 * 60e3; // renova de hora em hora; nunca usa credencial perto de vencer
  let list = [], at = 0, pending = null;
  const usable = () => list.length && Date.now() - at < MAX_AGE;
  function load(timeoutMs = 2500) {
    if (usable() && Date.now() - at < REFRESH) return Promise.resolve(list);
    if (!pending) pending = (async () => {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetch(URL_TURN, { signal: ctl.signal, cache: 'no-store' });
        const d = r.ok ? await r.json() : null;
        const got = (Array.isArray(d?.iceServers) ? d.iceServers : []).filter((s) => s && s.username && s.credential && [].concat(s.urls).some((u) => /^turns?:/.test(u)));
        if (got.length) { list = got; at = Date.now(); }
      } catch {} finally { clearTimeout(t); pending = null; }
      return usable() ? list : [];
    })();
    // credencial ainda válida: usa já e renova por trás, sem atrasar a conexão
    return usable() ? Promise.resolve(list) : pending;
  }
  load(); // busca ao abrir o app: a primeira entrada numa sala já encontra a credencial pronta
  // Teste: localStorage resenha.forceRelay = true obriga a usar só o repasse (prova que o caminho reserva funciona).
  const forced = () => { try { return localStorage.getItem('resenha.forceRelay') === 'true'; } catch { return false; } };
  return { load, servers: () => { if (!usable() || Date.now() - at >= REFRESH) load(); return usable() ? list : []; }, forced };
})();
