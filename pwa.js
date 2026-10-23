// Resenha PWA: entra numa sala pelo CÓDIGO direto do navegador do celular ou tablet, sem app de PC.
// Usa a mesma descoberta do app (MQTT público, mensagens criptografadas com o código) e o mesmo túnel WebRTC.
// O anfitrião não muda nada: cada canal do túnel vira, no PC dele, uma conexão TCP com o servidor da sala.
// Aqui o navegador "fala" HTTP e WebSocket por dentro desses canais. Fotos e anexos passam pelo service worker (sw.js).
'use strict';
(() => {
  const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081'];
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
  const CHUNK = 16 * 1024, enc = new TextEncoder(), dec = new TextDecoder();
  const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const rnd = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
  const sha = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log('[pwa]', ...a);
  const concat = (parts) => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };

  // ---------- Descoberta: igual ao Signal do tunnel-main.js (AES-256-GCM: iv 12 + tag 16 + texto) ----------
  async function makeSignal(code, onMsg) {
    const key = await crypto.subtle.importKey('raw', await sha('resenha-key:' + norm(code)), 'AES-GCM', false, ['encrypt', 'decrypt']);
    const topic = 'resenha/v1/' + hex(await sha('resenha-topic:' + norm(code))).slice(0, 32);
    const seen = new Set();
    const open = async (buf) => {
      try {
        const b = new Uint8Array(buf), ct = b.subarray(28), joined = new Uint8Array(ct.length + 16);
        joined.set(ct); joined.set(b.subarray(12, 28), ct.length);
        return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, key, joined)));
      } catch { return null; }
    };
    const seal = async (obj) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const out = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
      const b = new Uint8Array(out.length + 12); b.set(iv); b.set(out.subarray(out.length - 16), 12); b.set(out.subarray(0, out.length - 16), 28);
      return b;
    };
    const clients = BROKERS.map((url) => {
      const c = window.mqtt.connect(url, { connectTimeout: 8000, reconnectPeriod: 3000, keepalive: 30, clean: true, clientId: 'rs_' + rnd(6) });
      c.on('connect', () => c.subscribe(topic, { qos: 0 }));
      c.on('message', async (t, payload) => { if (t !== topic) return; const m = await open(payload); if (!m || !m.mid || seen.has(m.mid)) return; seen.add(m.mid); onMsg(m); });
      c.on('error', () => {});
      return c;
    });
    return {
      connected: () => clients.some((c) => c.connected),
      async send(obj) { const buf = await seal({ ...obj, mid: rnd(8) }); for (const c of clients) if (c.connected) c.publish(topic, buf, { qos: 0 }); },
      close() { for (const c of clients) try { c.end(true); } catch {} },
    };
  }
  const gatherDone = (pc, ms = 4000) => new Promise((r) => {
    if (pc.iceGatheringState === 'complete') return r();
    const t = setTimeout(r, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } });
  });

  // ---------- Túnel até o anfitrião ----------
  let tunnel = null; // { pc, ctl, seq, code }
  async function connectTunnel(code, onStatus = () => {}, { attempts = 3, timeoutMs = 20000 } = {}) {
    closeTunnel();
    const peerId = rnd(6); let pending = null;
    const signal = await makeSignal(code, (m) => { if (m.t === 'answer' && m.to === peerId && pending && m.nonce === pending.nonce) { const p = pending; pending = null; p.resolve(m.sdp); } });
    try {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        onStatus(attempt === 1 ? 'Procurando a sala...' : `Tentando de novo (${attempt}/${attempts})...`);
        const pc = new RTCPeerConnection({ iceServers: ICE });
        const ctl = pc.createDataChannel('ctl');
        await pc.setLocalDescription(await pc.createOffer());
        await gatherDone(pc);
        const nonce = rnd(6), t0 = Date.now();
        while (!signal.connected() && Date.now() - t0 < timeoutMs) await sleep(200);
        if (!signal.connected()) { pc.close(); throw new Error('nobroker'); }
        const answer = await new Promise((resolve) => {
          pending = { nonce, resolve };
          const tick = () => {
            if (!pending || pending.nonce !== nonce) return;
            if (Date.now() - t0 > timeoutMs) { pending = null; return resolve(null); }
            signal.send({ t: 'join', from: peerId, nonce, sdp: { type: 'offer', sdp: pc.localDescription.sdp } });
            setTimeout(tick, 1200);
          };
          tick();
        });
        if (!answer) { pc.close(); if (attempt === attempts) throw new Error('notfound'); continue; }
        onStatus('Sala encontrada, conectando...');
        await pc.setRemoteDescription(answer);
        const ok = await new Promise((res) => {
          const t = setTimeout(() => res(false), 15000);
          const chk = () => { if (ctl.readyState === 'open') { clearTimeout(t); res(true); } else if (pc.connectionState === 'failed') { clearTimeout(t); res(false); } };
          ctl.onopen = chk; pc.onconnectionstatechange = chk; chk();
        });
        if (!ok) { pc.close(); if (attempt === attempts) throw new Error('p2p'); continue; }
        tunnel = { pc, ctl, seq: 0, code: norm(code) };
        pc.onconnectionstatechange = () => log('túnel', pc.connectionState);
        log('túnel pronto');
        return tunnel;
      }
    } finally { signal.close(); }
  }
  function closeTunnel() { if (tunnel) { try { tunnel.pc.close(); } catch {} tunnel = null; } }
  const alive = () => !!tunnel && tunnel.ctl.readyState === 'open' && tunnel.pc.connectionState !== 'failed';

  // Um canal = uma conexão TCP com o servidor da sala, no PC do anfitrião.
  function openStream(prefix) {
    if (!alive()) throw new Error('sem túnel');
    const dc = tunnel.pc.createDataChannel(prefix + (++tunnel.seq), { ordered: true });
    dc.binaryType = 'arraybuffer';
    const s = { dc, onData: () => {}, onClose: () => {}, closed: false };
    const opened = new Promise((res, rej) => { dc.onopen = res; dc.onerror = rej; });
    dc.onmessage = (e) => s.onData(new Uint8Array(e.data));
    dc.onclose = () => { if (s.closed) return; s.closed = true; s.onClose(); };
    s.write = async (u8) => { await opened; for (let i = 0; i < u8.length; i += CHUNK) { while (dc.bufferedAmount > 4 * 1024 * 1024) await sleep(20); dc.send(u8.subarray(i, i + CHUNK)); } };
    s.close = () => { s.closed = true; try { dc.close(); } catch {} };
    return s;
  }

  // ---------- HTTP/1.1 por dentro do túnel (fotos, anexos, banner, upload) ----------
  function parseHead(buf) {
    const i = findCRLF2(buf); if (i < 0) return null;
    const lines = dec.decode(buf.subarray(0, i)).split('\r\n');
    const [, status, ...rest] = lines[0].split(' ');
    const headers = []; for (const l of lines.slice(1)) { const k = l.indexOf(':'); if (k > 0) headers.push([l.slice(0, k).trim().toLowerCase(), l.slice(k + 1).trim()]); }
    return { status: +status, statusText: rest.join(' '), headers, bodyStart: i + 4 };
  }
  function findCRLF2(b) { for (let i = 0; i + 3 < b.length; i++) if (b[i] === 13 && b[i + 1] === 10 && b[i + 2] === 13 && b[i + 3] === 10) return i; return -1; }
  function dechunk(b) {
    const out = []; let i = 0;
    while (i < b.length) {
      let j = i; while (j + 1 < b.length && !(b[j] === 13 && b[j + 1] === 10)) j++;
      const size = parseInt(dec.decode(b.subarray(i, j)), 16); if (!size) break;
      out.push(b.subarray(j + 2, j + 2 + size)); i = j + 2 + size + 2;
    }
    return concat(out);
  }
  function http({ method = 'GET', path = '/', headers = [], body = null }) {
    return new Promise((resolve, reject) => {
      let s; try { s = openStream('h'); } catch (e) { return reject(e); }
      const parts = []; let got = 0, head = null, done = false;
      const finish = () => {
        if (done) return; done = true; s.close();
        const all = concat(parts); head = head || parseHead(all);
        if (!head) return reject(new Error('resposta inválida'));
        let b = all.subarray(head.bodyStart);
        if (head.headers.some(([k, v]) => k === 'transfer-encoding' && /chunked/i.test(v))) b = dechunk(b);
        resolve({ status: head.status, statusText: head.statusText, headers: head.headers.filter(([k]) => !['transfer-encoding', 'connection'].includes(k)), body: b });
      };
      s.onData = (d) => {
        parts.push(d); got += d.length;
        if (!head) head = parseHead(concat(parts));
        const len = head && Number(head.headers.find(([k]) => k === 'content-length')?.[1]);
        if (head && Number.isFinite(len) && got - head.bodyStart >= len) finish();
      };
      s.onClose = finish;
      const lines = [`${method} ${path} HTTP/1.1`, 'Host: resenha', 'Connection: close', ...headers.filter(([k]) => !/^(host|connection|content-length)$/i.test(k)).map(([k, v]) => `${k}: ${v}`)];
      if (body) lines.push('Content-Length: ' + body.byteLength);
      s.write(concat([enc.encode(lines.join('\r\n') + '\r\n\r\n'), ...(body ? [new Uint8Array(body)] : [])])).catch(reject);
      setTimeout(() => { if (!done) { done = true; s.close(); reject(new Error('tempo esgotado')); } }, 120000);
    });
  }

  // ---------- WebSocket por dentro do túnel (a conexão da sala) ----------
  class TunnelWebSocket {
    constructor() {
      this.readyState = 0; this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
      this.buf = new Uint8Array(0); this.frag = []; this.handshaken = false; this.closeCode = 1006;
      try { this.s = openStream('w'); } catch { setTimeout(() => this._closed(), 0); return; }
      this.s.onData = (d) => this._data(d);
      this.s.onClose = () => this._closed();
      const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
      this.s.write(enc.encode(`GET / HTTP/1.1\r\nHost: resenha\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`)).catch(() => this._closed());
    }
    _data(d) {
      this.buf = concat([this.buf, d]);
      if (!this.handshaken) {
        const i = findCRLF2(this.buf); if (i < 0) return;
        if (!/^HTTP\/1\.1 101/.test(dec.decode(this.buf.subarray(0, 12)))) { this.s.close(); return this._closed(); }
        this.buf = this.buf.subarray(i + 4); this.handshaken = true; this.readyState = 1; this.onopen?.({});
      }
      for (;;) {
        const b = this.buf; if (b.length < 2) return;
        const fin = b[0] & 0x80, op = b[0] & 0x0f; let len = b[1] & 0x7f, off = 2;
        if (len === 126) { if (b.length < 4) return; len = (b[2] << 8) | b[3]; off = 4; }
        else if (len === 127) { if (b.length < 10) return; len = Number(new DataView(b.buffer, b.byteOffset + 2, 8).getBigUint64(0)); off = 10; }
        if (b.length < off + len) return;
        const payload = b.slice(off, off + len); this.buf = b.subarray(off + len);
        if (op === 8) { this.closeCode = payload.length >= 2 ? (payload[0] << 8) | payload[1] : 1005; this._frame(8, payload.subarray(0, 2)); this.s.close(); return this._closed(); }
        if (op === 9) { this._frame(10, payload); continue; }
        if (op === 10) continue;
        this.frag.push(payload);
        if (fin) { const data = concat(this.frag); this.frag = []; this.onmessage?.({ data: dec.decode(data) }); }
      }
    }
    _frame(op, payload) { // quadros do cliente vão mascarados (RFC 6455)
      const mask = crypto.getRandomValues(new Uint8Array(4)), n = payload.length;
      const head = n < 126 ? [0x80 | op, 0x80 | n] : n < 65536 ? [0x80 | op, 0x80 | 126, n >> 8, n & 255] : [0x80 | op, 0x80 | 127, 0, 0, 0, 0, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
      const out = new Uint8Array(head.length + 4 + n); out.set(head); out.set(mask, head.length);
      for (let i = 0; i < n; i++) out[head.length + 4 + i] = payload[i] ^ mask[i & 3];
      this.s.write(out).catch(() => {});
    }
    send(text) { if (this.readyState !== 1) throw new Error('fechado'); this._frame(1, enc.encode(String(text))); }
    close(code = 1000) { if (this.readyState >= 2) return; this.readyState = 2; try { this._frame(8, new Uint8Array([code >> 8, code & 255])); } catch {} setTimeout(() => { this.s?.close(); this._closed(); }, 200); }
    _closed() { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({ code: this.closeCode }); }
  }

  // ---------- Ponte com o service worker: ele pede, a página busca pelo túnel ----------
  navigator.serviceWorker?.addEventListener('message', async (e) => {
    if (e.data?.t !== 'tun-fetch') return;
    const port = e.ports[0];
    try {
      const r = await http({ method: e.data.method, path: e.data.path, headers: e.data.headers, body: e.data.body });
      const body = r.body.slice().buffer;
      port.postMessage({ status: r.status, statusText: r.statusText, headers: r.headers, body }, [body]);
    } catch (err) { port.postMessage({ error: String(err.message || err) }); }
  });

  const scope = new URL('.', location.href).pathname;
  window.RESENHA_PWA = {
    base: location.origin + scope + 'tun', // o service worker intercepta este caminho
    connect: connectTunnel, close: closeTunnel, alive,
    socket: () => new TunnelWebSocket(),
    http,
  };
})();
