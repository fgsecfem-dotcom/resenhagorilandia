const { applyProfileExtras } = require('./profile-extras');

function createTextCommands({ clients, send, broadcast, cleanText, clean, validAvatar, rid, textIds, files, history, findMsg, saveSoon }) {
  return function handleTextCommand({ id, u, m, ws }) {
      switch (m.t) {
        case 'dm': {
          const target = clients.get(m.to), text = cleanText(m.text, 4000);
          if (!target || target.ws.readyState !== 1 || m.to === id || !text) { send(ws, { t: 'command-result', requestId: m.requestId, ok: false, error: 'Essa pessoa não está disponível para conversar.' }); break; }
          const msg = { id: rid(), requestId: m.requestId || null, from: id, to: m.to, name: u.name, text, ts: Date.now() };
          send(target.ws, { t: 'dm', msg }); send(ws, { t: 'dm', msg });
          if (m.requestId) send(ws, { t: 'command-result', requestId: m.requestId, ok: true });
          break;
        }
        case 'profile': {
          if (m.name) u.name = clean(m.name, 32) || u.name;
          if (/^#[0-9a-f]{6}$/i.test(m.color || '')) u.color = m.color;
          if ('avatar' in m) u.avatar = validAvatar(m.avatar);
          applyProfileExtras(u, m);
          broadcast({ t: 'user-update', user: u });
          break;
        }
        case 'chat': {
          const cid = textIds().includes(m.channelId) ? m.channelId : textIds()[0];
          const text = cleanText(m.text, 4000);
          const atts = (Array.isArray(m.attachments) ? m.attachments : []).slice(0, 10).map((a) => files[a && a.id]).filter(Boolean);
          if (!text && !atts.length) { if(m.requestId) send(ws,{t:'command-result',requestId:m.requestId,ok:false,error:'Mensagem vazia.'}); return; }
          let replyTo = null;
          if (m.replyTo) { const f = findMsg(String(m.replyTo)); if (f) replyTo = { id: f.msg.id, name: f.msg.name, color: f.msg.color, text: (f.msg.text || (f.msg.attachments.length ? '📎 Anexo' : '')).slice(0, 140) }; }
          const mentions = (Array.isArray(m.mentions) ? m.mentions : []).slice(0, 20).map((x) => clean(x, 32)).filter(Boolean);
          const msg = { id: rid(8), channelId: cid, userId: id, name: u.name, color: u.color, text, attachments: atts, ts: Date.now(), replyTo, mentions };
          (history[cid] = history[cid] || []).push(msg);
          saveSoon();
          broadcast({ t: 'chat', msg });
          if(m.requestId) send(ws,{t:'command-result',requestId:m.requestId,ok:true});
          break;
        }
        case 'edit': {
          const f = findMsg(String(m.id)); if (!f || f.msg.userId !== id) return;
          const text = cleanText(m.text, 4000);
          if (!text && !f.msg.attachments.length) return;
          f.msg.text = text; f.msg.editedAt = Date.now();
          if (Array.isArray(m.mentions)) f.msg.mentions = m.mentions.slice(0, 20).map((x) => clean(x, 32)).filter(Boolean);
          saveSoon();
          broadcast({ t: 'msg-edit', id: f.msg.id, channelId: f.cid, text, editedAt: f.msg.editedAt, mentions: f.msg.mentions });
          break;
        }
        case 'delete': {
          const f = findMsg(String(m.id)); if (!f || (f.msg.userId !== id && !u.isHost)) return;
          f.list.splice(f.i, 1); saveSoon();
          broadcast({ t: 'msg-delete', id: f.msg.id, channelId: f.cid });
          break;
        }
      }
  };
}
module.exports = { createTextCommands };
