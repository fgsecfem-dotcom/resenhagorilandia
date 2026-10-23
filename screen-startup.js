// Chromium's advisory starting estimate, in kbps. No minimum bitrate is imposed:
// congestion control, frame-rate preference and the existing sender caps remain active.
export function screenStartKbps(quality) {
  if (!Number.isFinite(quality?.br) || quality.br <= 0) return 0;
  return Math.min(4000, Math.floor(quality.br * 0.6 / 1000));
}

export function screenStartupDescription(description, mids, kbps) {
  if (!description?.sdp || !['offer', 'answer'].includes(description.type) || !mids.size || kbps <= 0) return description;
  const newline = description.sdp.includes('\r\n') ? '\r\n' : '\n';
  const sections = description.sdp.split(/(?=^m=)/m);
  let changed = false;
  for (let n = 0; n < sections.length; n++) {
    const lines = sections[n].split(newline);
    if (!/^m=video (?!0(?: |$))/.test(lines[0]) || lines.includes('a=inactive') || lines.includes('a=sendonly')) continue;
    const mid = lines.find(line => line.startsWith('a=mid:'))?.slice(6);
    if (!mids.has(mid)) continue;
    // Respect an explicit remote bandwidth policy rather than replace its estimate.
    if (lines.some(line => /^b=/.test(line))) continue;
    const payloads = new Set(lines[0].split(' ').slice(3));
    for (const line of [...lines]) {
      const codec = /^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i.exec(line);
      if (!codec || !payloads.has(codec[1])) continue;
      const prefix = 'a=fmtp:' + codec[1] + ' ';
      const index = lines.findIndex(value => value.startsWith(prefix));
      if (index >= 0) {
        if (/\bx-google-(?:start|min|max)-bitrate\s*=/i.test(lines[index])) continue;
        lines[index] += ';x-google-start-bitrate=' + kbps;
      } else {
        lines.splice(lines.indexOf(line) + 1, 0, prefix + 'x-google-start-bitrate=' + kbps);
      }
      changed = true;
    }
    sections[n] = lines.join(newline);
  }
  return changed ? { type: description.type, sdp: sections.join('') } : description;
}

export async function setScreenRemoteDescription(peer, description, { stream, senders, quality, enabled }) {
  const pc = peer.pc;
  const sender = enabled && stream && peer.wantsScreen && senders?.find(s => s.track?.kind === 'video' && s.track.readyState !== 'ended');
  let adjusted = description;
  if (sender && peer.screenStartupSender !== sender) {
    const mids = new Set((pc.getTransceivers?.() || [])
      .filter(t => t.sender === sender && t.mid != null).map(t => String(t.mid)));
    adjusted = screenStartupDescription(description, mids, screenStartKbps(quality));
  }
  if (adjusted !== description) {
    try {
      await pc.setRemoteDescription(adjusted);
      peer.screenStartupSender = sender;
      return;
    } catch {
      // Optional Chromium hint must never prevent a peer from connecting.
      console.warn('Estimativa inicial de vídeo indisponível; usando negociação padrão.');
    }
  }
  await pc.setRemoteDescription(description);
  if (sender && adjusted !== description) peer.screenStartupSender = sender;
}
