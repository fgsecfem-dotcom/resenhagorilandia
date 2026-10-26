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
      });
    } catch {}
  }
  return media;
};
