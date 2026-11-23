// Local, on-demand performance report. No SDP, addresses, names or chat content.
window.readMediaStats = async function (peers) {
  const media=[];
  let index=0;
  for (const peer of peers.values()) {
    const peerIndex=index++;
    try {
      const stats=await peer.pc.getStats();
      stats.forEach((s) => {
        if ((s.type==='outbound-rtp' || s.type==='inbound-rtp') && (s.kind==='video' || s.mediaType==='video')) {
          const row={peer:peerIndex,type:s.type,codec:stats.get(s.codecId)?.mimeType || null};
          for (const key of ['frameWidth','frameHeight','framesPerSecond','framesEncoded','framesDecoded','framesDropped','totalEncodeTime','totalDecodeTime','bytesSent','bytesReceived','packetsLost','jitter','qualityLimitationReason','encoderImplementation','decoderImplementation']) if(s[key]!==undefined)row[key]=s[key];
          media.push(row);
        }
        if(s.type==='candidate-pair' && s.state==='succeeded' && s.nominated)media.push({peer:peerIndex,type:'connection',rtt:s.currentRoundTripTime,availableOutgoingBitrate:s.availableOutgoingBitrate});
        // 2.5: quadros que a captura da tela entrega (tela parada manda poucos; não é falta de banda)
        if(s.type==='media-source' && s.kind==='video' && typeof s.framesPerSecond==='number')media.push({peer:peerIndex,type:'source',framesPerSecond:s.framesPerSecond});
      });
    } catch {}
  }
  return media;
};

// Envio anônimo de desempenho (ligado por padrão, desliga em Configurações > Voz).
// Junta as amostras de uma call num resumo pequeno: só números, sem nome, sala, IP, endereço ou mensagens.
window.ResenhaPerf = (() => {
  const r1 = (n) => Math.round(n * 10) / 10;
  const avg = (a) => a.length ? r1(a.reduce((s, x) => s + x, 0) / a.length) : null;
  const max = (a) => a.length ? r1(Math.max(...a)) : null;
  const p95 = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return r1(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]); };
  const most = (a) => { const c = {}; for (const x of a) if (x) c[x] = (c[x] || 0) + 1; return Object.keys(c).sort((x, y) => c[y] - c[x])[0] || null; };
  const count = (a) => { const c = {}; for (const x of a) if (x) c[x] = (c[x] || 0) + 1; return c; };
  const short = (s, n = 80) => (typeof s === 'string' ? s.slice(0, n) : null);

  // Uma amostra a partir do que o app já mede (performance:sample + readMediaStats).
  function sample(native, media, call) {
    const cpu = {}, ramBy = {}; let total = 0, ram = 0;
    for (const p of (native && native.processes) || []) {
      const t = short(p.type, 20) || 'outro'; const c = Number(p.cpuElectronPercent) || 0, kb = Number(p.workingSetKB) || 0;
      cpu[t] = (cpu[t] || 0) + c; total += c; ram += kb; ramBy[t] = (ramBy[t] || 0) + kb / 1024;
    }
    return { cpu: total, cpuBy: cpu, ramMB: ram / 1024, ramBy, media: media || [], ...call };
  }

  function summarize(samples, meta) {
    const s = (samples || []).slice(1); // a 1ª leitura de CPU cobre o tempo antes da call
    if (!s.length) return null;
    const out = s.flatMap((x) => x.media.filter((m) => m.type === 'outbound-rtp'));
    const inb = s.flatMap((x) => x.media.filter((m) => m.type === 'inbound-rtp'));
    const conn = s.flatMap((x) => x.media.filter((m) => m.type === 'connection' && typeof m.rtt === 'number'));
    const types = [...new Set(s.flatMap((x) => Object.keys(x.cpuBy)))];
    const cpuBy = {}, ramBy = {}; for (const t of types) { cpuBy[t] = avg(s.map((x) => x.cpuBy[t] || 0)); ramBy[t] = Math.round(avg(s.map((x) => (x.ramBy || {})[t] || 0))); }
    const src = s.flatMap((x) => x.media.filter((m) => m.type === 'source'));
    const sum = (a, k) => a.reduce((n, m) => n + (Number(m[k]) || 0), 0);
    return {
      schema: 1, ...meta,
      samples: s.length,
      cpu: { avg: avg(s.map((x) => x.cpu)), p95: p95(s.map((x) => x.cpu)), max: max(s.map((x) => x.cpu)), by: cpuBy },
      ramMB: { avg: avg(s.map((x) => x.ramMB)), max: max(s.map((x) => x.ramMB)), by: ramBy },
      hostPct: avg(s.map((x) => (x.host ? 100 : 0))),
      relay: { viaRelayMax: max(s.map((x) => x.viaRelay || 0)), directOnlyMax: max(s.map((x) => x.directOnly || 0)), relayingMax: max(s.map((x) => x.relaying || 0)) },
      peersMax: max(s.map((x) => x.peers || 0)),
      sharingPct: avg(s.map((x) => (x.sharing ? 100 : 0))),
      quality: most(s.map((x) => x.quality)),
      viewersMax: max(s.map((x) => x.viewers || 0)),
      watchingMax: max(s.map((x) => x.watching || 0)),
      sent: out.length ? { sourceFps: src.length ? avg(src.map((m) => m.framesPerSecond || 0)) : null, fps: avg(out.map((m) => m.framesPerSecond || 0)), height: max(out.map((m) => m.frameHeight || 0)), encoder: short(most(out.map((m) => m.encoderImplementation))), codec: short(most(out.map((m) => m.codec)), 20), limited: count(out.map((m) => m.qualityLimitationReason !== 'none' && m.qualityLimitationReason)) } : null,
      received: inb.length ? { fps: avg(inb.map((m) => m.framesPerSecond || 0)), height: max(inb.map((m) => m.frameHeight || 0)), decoder: short(most(inb.map((m) => m.decoderImplementation))), droppedPct: sum(inb, 'framesDecoded') ? r1(sum(inb, 'framesDropped') / (sum(inb, 'framesDecoded') + sum(inb, 'framesDropped')) * 100) : null } : null,
      rttMs: conn.length ? { avg: avg(conn.map((m) => m.rtt * 1000)), max: max(conn.map((m) => m.rtt * 1000)) } : null,
    };
  }

  // Dados do PC: só modelo e quantidade. GPU: só fabricante e modelo (IDs numéricos), sem driver.
  function system(sys) {
    const gpu = ((sys && sys.gpu && sys.gpu.gpuDevice) || []).find((g) => g.active) || ((sys && sys.gpu && sys.gpu.gpuDevice) || [])[0];
    return {
      version: short(sys && sys.version, 20), platform: short(sys && sys.platform, 10), release: short(sys && sys.release, 20), arch: short(sys && sys.arch, 10),
      cpuModel: short(sys && sys.cpu), cores: Number(sys && sys.logicalProcessors) || null,
      ramGB: sys && sys.totalMemoryBytes ? Math.round(sys.totalMemoryBytes / 1073741824) : null,
      gpu: gpu ? { vendor: Number(gpu.vendorId) || null, device: Number(gpu.deviceId) || null } : null,
      compatibility: !!(sys && sys.compatibility),
    };
  }
  return { sample, summarize, system };
})();
