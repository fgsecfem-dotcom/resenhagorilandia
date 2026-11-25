// Lista pública para quem possui o código. Não inclui IDs, perfis privados ou dados de conexão.
const COLOR = /^#[0-9a-f]{6}$/i;
const IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
const color = (v, fallback = '') => typeof v === 'string' && COLOR.test(v) ? v : fallback;
const image = (v, limit) => typeof v === 'string' && v.length <= limit && IMAGE.test(v) ? v : '';
const label = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '';
const initial = (name) => Array.from(name.trim())[0]?.toUpperCase() || '?';

function buildPresence(clients, channels) {
  const voices = new Map(channels.filter(c => c.type === 'voice').map(c => [c.id, c.name]));
  const people = [...clients.values()].map(({ user }) => {
    const name = label(user.name, 32) || 'Anônimo', channel = voices.get(user.voiceChannel) || null;
    const avatar = image(user.avatar, 120000);
    return { name, color: color(user.color, '#5865f2'), ...(avatar ? { avatar } : { initial: initial(name) }), channel, live: !!(channel && user.sharing) };
  });
  const rank = p => p.live ? 0 : p.channel ? 1 : 2;
  people.sort((a, b) => rank(a) - rank(b));
  const calls = people.filter(p => p.channel), byChannel = new Map();
  for (const { channel } of calls) byChannel.set(channel, (byChannel.get(channel) || 0) + 1);
  const channel = [...byChannel].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { total: people.length, inCall: calls.length, live: people.filter(p => p.live).length, channel, people };
}

// Também valida o que veio do outro PC. Host antigo (sem presence) não vira uma sala vazia.
function readPresence(raw) {
  const count = (v) => Number.isSafeInteger(v) && v >= 0;
  if (!raw || !count(raw.total) || !count(raw.inCall) || !count(raw.live) || raw.live > raw.inCall || raw.inCall > raw.total || !Array.isArray(raw.people)) return null;
  const people = raw.people.slice(0, Math.min(raw.total, 4)).map(p => {
    const name = label(p?.name, 32) || 'Anônimo';
    return { name, color: color(p?.color, '#5865f2'), avatar: image(p?.avatar, 6000), initial: initial(name), channel: label(p?.channel, 40), live: p?.live === true };
  });
  return { total: raw.total, inCall: raw.inCall, live: raw.live, channel: label(raw.channel, 40), people,
    name: label(raw.name, 60), color: color(raw.color), cover: image(raw.cover, 24000) };
}

// O host busca a fonte de verdade via HTTP local. Só a resposta compacta viaja no canal do código;
// não há socket de participante, renegociação de call nem mudança no estado da sala.
async function fetchPreview(port, code, cover, thumbnail = v => v) {
  const query = new URLSearchParams({ code, ...(cover ? { cover: '1' } : {}) });
  const response = await fetch(`http://127.0.0.1:${port}/api/info?${query}`, { signal: AbortSignal.timeout(900) });
  if (!response.ok) return null;
  const info = await response.json(), p = info.presence;
  if (!p) return null;
  return readPresence({ ...p, name: info.name, color: info.color, cover: info.cover ? thumbnail(info.cover, true) : '',
    people: p.people.slice(0, 4).map(person => ({ ...person, avatar: person.avatar ? thumbnail(person.avatar, false) : '' })) });
}

module.exports = { buildPresence, readPresence, fetchPreview };
