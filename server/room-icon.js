// Server icon: a small image chosen in the app (data URL). Anything else is dropped.
const MAX_ICON = 48 * 1024;
const safeIcon = (v) => typeof v === 'string' && v.length <= MAX_ICON && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v) ? v : '';

// Visual da sala (2.1.2): foto de capa do grupo, descrição curta e cor. Tudo opcional; o que for inválido some.
// A capa é reduzida no app (960×320 JPEG) e cabe numa mensagem da sala (limite do WebSocket: 256 KB).
const MAX_COVER = 190 * 1024;
const safeCover = (v) => typeof v === 'string' && v.length <= MAX_COVER && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v) ? v : '';
const safeAbout = (v) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 140) : '';
const safeColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '';
function safeLook(v) {
  if (!v || typeof v !== 'object') return {};
  const out = {}, cover = safeCover(v.cover), about = safeAbout(v.about), color = safeColor(v.color);
  if (cover) out.cover = cover; if (about) out.about = about; if (color) out.color = color;
  return out;
}
const hasLook = (v) => Object.keys(safeLook(v)).length > 0;
module.exports = { safeIcon, MAX_ICON, safeLook, hasLook, MAX_COVER };
