// Request lifecycle; dependencies retain the existing client state and timers.
export function createCommandController({ S, crypto, setTimeout, clearTimeout, wsSend, requests, trace }) {
  const commandRequests = requests, commandTrace = trace;
function traceCommand(type, status) { const TRACE_LIMIT = 80; commandTrace.push({ at: Date.now(), type, status }); if (commandTrace.length > TRACE_LIMIT) commandTrace.shift(); }
function sendCommand(type, payload = {}) {
  const ACK_TIMEOUT_MS = 8000, DJ_ADD_TIMEOUT_MS = 180000;
  if (!S.ws || S.ws.readyState !== 1) return Promise.reject(new Error('Sem conexão com o anfitrião.'));
  const feature = type === 'dm' ? 'dm-ack' : type === 'chat' ? 'chat-ack' : 'dj-ack';
  if (!(S.features || []).includes(feature)) return Promise.reject(new Error('A sala não confirmou suporte a este recurso. O anfitrião precisa encerrar o app antigo e abrir esta versão.'));
  const requestId = crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { commandRequests.delete(requestId); traceCommand(type, 'timeout'); reject(new Error('O anfitrião não confirmou a operação. Seu texto foi mantido; verifique a conexão e tente novamente.')); }, type === 'dj-add' ? DJ_ADD_TIMEOUT_MS : ACK_TIMEOUT_MS);
    commandRequests.set(requestId, { type, resolve, reject, timer }); traceCommand(type, 'sent');
    try { wsSend({ ...payload, t: type, requestId }); } catch (e) { finishCommand({requestId,ok:false,error:e.message}); }
  });
}
function finishCommand(result) {
  const pending = commandRequests.get(result.requestId); if (!pending) return;
  clearTimeout(pending.timer); commandRequests.delete(result.requestId); traceCommand(pending.type, result.ok ? 'confirmed' : 'failed');
  if (result.ok) pending.resolve(); else pending.reject(new Error(result.error || 'Não foi possível executar a operação.'));
}
function rejectPendingCommands(message) { for (const [requestId] of commandRequests) finishCommand({requestId,ok:false,error:message}); }
  return { traceCommand, sendCommand, finishCommand, rejectPendingCommands };
}
