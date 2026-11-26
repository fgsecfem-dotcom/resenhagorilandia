// Tema Apê — maquete, bichos e adaptação ao hospedeiro de salas.
(() => {
  'use strict';

  // Motor isométrico do tema Apê: caixas em coordenadas de mundo (x,y,z), ordenadas por separação real
  // (pintor topológico), decalques desenhados no plano de cada face, luz feita com gradientes estáticos.
  const iso = (() => {
    const s = 30, K = 0.8660254;
    const P = (x, y, z) => [(x - y) * K * s, (x + y) * 0.5 * s - z * s];
    const pp = (a) => a.map((q) => P(...q).map((n) => n.toFixed(1)).join(',')).join(' ');
    const sh = (hex, k) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
    // grupos no plano de cada superfície (unidades locais = unidades de mundo)
    const mat = (o, a, b, c, d) => `matrix(${a},${b},${c},${d},${o[0].toFixed(1)},${o[1].toFixed(1)})`;
    const onX = (x, yMax, zTop, inner) => `<g transform="${mat(P(x, yMax, zTop), K * s, -0.5 * s, 0, s)}">${inner}</g>`; // parede esquerda / face voltada para +x
    const onY = (y, xMin, zTop, inner) => `<g transform="${mat(P(xMin, y, zTop), K * s, 0.5 * s, 0, s)}">${inner}</g>`; // parede direita / face voltada para +y
    const onZ = (z, x0, y0, inner) => `<g transform="${mat(P(x0, y0, z), K * s, 0.5 * s, -K * s, 0.5 * s)}">${inner}</g>`; // piso / tampo
    let uid = 0;

    function Scene() {
      const items = [], flats = [], post = [], defs = [];
      const box = (x, y, z, w, d, h, c, o = {}) => { items.push({ x, y, z, w, d, h, c, ...o }); };
      const draw = (b) => {
        const { x, y, z, w, d, h, c } = b;
        const st = (f) => `fill="${f}" stroke="${f}" stroke-width="0.7" stroke-linejoin="round"`;
        let o = '';
        if (!b.noL) o += `<polygon points="${pp([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])}" ${st(b.l || sh(c, 0.78))}/>`;
        if (!b.noR) o += `<polygon points="${pp([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])}" ${st(b.r || sh(c, 0.62))}/>`;
        if (!b.noT) o += `<polygon points="${pp([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])}" ${st(b.t || c)}/>`;
        if (b.fx) o += b.fx(b);
        return o;
      };
      const order = () => {
        const bounds = items.map(({ x, y, z, w, d, h }) => [x - y - d, x + w - y, (x + y) * 0.5 - z - h, (x + w + y + d) * 0.5 - z]);
        const e = 1e-6, n = items.length, sep = (A, B) => A.x + A.w <= B.x + e || A.y + A.d <= B.y + e || A.z + A.h <= B.z + e;
        const indeg = new Array(n).fill(0), adj = items.map(() => []);
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const A = bounds[i], B = bounds[j];
          if (A[1] < B[0] || B[1] < A[0] || A[3] < B[2] || B[3] < A[2]) continue;
          const a = sep(items[i], items[j]), b = sep(items[j], items[i]);
          if (a && !b) { adj[i].push(j); indeg[j]++; }
          if (b && !a) { adj[j].push(i); indeg[i]++; }
        }
        const key = (b) => b.x + b.w / 2 + b.y + b.d / 2 + b.z * 0.01, out = [], done = new Array(n).fill(false);
        for (let k = 0; k < n; k++) {
          let best = -1;
          for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (best < 0 || key(items[i]) < key(items[best]))) best = i;
          if (best < 0) for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || key(items[i]) < key(items[best]))) best = i; // ciclo: cai no mais ao fundo
          done[best] = true; out.push(items[best]); adj[best].forEach((j) => indeg[j]--);
        }
        return out;
      };
      const self = { box, flats, post, defs, items, ordered: [], render: (wrap) => { const o = order(); self.ordered = o; return o.map((b) => wrap ? `<g class="ap-piece">${draw(b)}</g>` : draw(b)).join(''); } };
      return self;
    }

    // ---------- peças ----------
    const voxels = (S, x0, y0, z0, cells, cols, v = 0.42) => cells.forEach(([i, j, k], n) => S.box(x0 + i * v, y0 + j * v, z0 + k * v, v, v, v, cols[(((i * 7 + j * 3 + k * 5 + n) % cols.length) + cols.length) % cols.length]));
    function plant(S, x, y, z, size = 1, seed = 1) { // folhagem em voxels, sem sobreposição
      const cells = [], R = (a) => { const t = Math.sin(a * 91.3 + seed * 17.7) * 43758.5; return t - Math.floor(t); };
      const H = Math.round(4 + size * 3);
      for (let k = 0; k < H; k++) { const r = k < 1 ? 0 : Math.max(0, Math.round((size + 1) * Math.sin(Math.PI * (k + 0.5) / H))); for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { if (i * i + j * j > r * r + 0.5) continue; if (k > 0 && R(i * 13 + j * 7 + k) < 0.28 && (i || j)) continue; cells.push([i, j, k]); } }
      voxels(S, x, y, z, cells, ['#3f9d4f', '#2f7f43', '#58b85f', '#2a6b3c', '#6cc46a'], 0.34);
    }
    const pot = (S, x, y, w, h, c = '#c86a3c', z = 0) => { S.box(x, y, z, w, w, h, c); S.box(x - 0.06, y - 0.06, z + h, w + 0.12, w + 0.12, 0.12, sh(c, 1.12)); };
    function sofa(S, x, y, len, c, pillow) { // encostado na parede esquerda, de frente para +x
      S.box(x, y, 0.12, 2.0, len, 0.68, c); // base
      for (const fy of [y + 0.1, y + len - 0.25]) for (const fx of [x + 0.1, x + 1.75]) S.box(fx, fy, 0, 0.15, 0.15, 0.12, '#1a1230');
      S.box(x, y, 0.8, 0.55, len, 1.55, sh(c, 0.92)); // encosto
      S.box(x + 0.55, y, 0.8, 1.45, 0.42, 0.7, sh(c, 0.95)); S.box(x + 0.55, y + len - 0.42, 0.8, 1.45, 0.42, 0.7, sh(c, 0.95)); // braços
      const inner = len - 0.84, n = 3, cw = inner / n;
      for (let i = 0; i < n; i++) {
        S.box(x + 0.6, y + 0.42 + i * cw + 0.03, 0.8, 1.35, cw - 0.06, 0.32, sh(c, 1.15)); // assento
        S.box(x + 0.55, y + 0.42 + i * cw + 0.05, 1.12, 0.38, cw - 0.1, 1.0, sh(c, 1.08)); // almofada de encosto
      }
      if (pillow) S.box(x + 0.95, y + 0.5, 1.12, 0.3, 0.7, 0.62, pillow);
      return [0, 1, 2].map((i) => [x + 1.25, y + 0.42 + (i + 0.5) * cw, 1.12]);
    }
    function popcorn(S, x, y, z) {
      S.box(x, y, z, 0.55, 0.55, 0.7, '#f4efe6', { fx: (b) => onY(b.y + b.d, b.x, b.z + b.h, [0.06, 0.24, 0.42].map((u) => `<rect x="${u}" y="0" width="0.09" height="0.7" fill="#d93a32"/>`).join(''))
        + onX(b.x + b.w, b.y + b.d, b.z + b.h, [0.06, 0.24, 0.42].map((u) => `<rect x="${u}" y="0" width="0.09" height="0.7" fill="#b02c26"/>`).join('')) });
      voxels(S, x + 0.02, y + 0.02, z + 0.7, [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1]], ['#ffe08a', '#ffd25e', '#fff1c2'], 0.25);
    }
    function tv(S, x0, x1, zb, bezel = '#0b0a1f') {
      const w = x1 - x0, h = w * 9 / 16, id = 'scr' + uid++;
      S.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d1b4a"/><stop offset="1" stop-color="#0d0c25"/></linearGradient>`);
      S.box(x0, 0, zb, w, 0.22, h, bezel, { fx: (b) => onY(0.22, x0, zb + h, `<rect x="0.1" y="0.1" width="${w - 0.2}" height="${h - 0.2}" fill="url(#${id})"/>`
        + `<path d="M${w * 0.55} 0.1 L${w * 0.75} 0.1 L${w * 0.35} ${h - 0.1} L${w * 0.15} ${h - 0.1}Z" fill="#fff" opacity=".05"/>`) });
    }
    function framePic(S, wall, a0, a1, z0, z1, inner, frame = '#f2e6d0') { // quadro na parede (wall 'L' => plano x=0, 'R' => y=0)
      if (wall === 'R') S.box(a0, 0, z0, a1 - a0, 0.1, z1 - z0, frame, { fx: (b) => onY(0.1, a0, z1, `<g transform="translate(0.1 0.1)">${inner(a1 - a0 - 0.2, z1 - z0 - 0.2)}</g>`) });
      else S.box(0, a0, z0, 0.1, a1 - a0, z1 - z0, frame, { fx: (b) => onX(0.1, a1, z1, `<g transform="translate(0.1 0.1)">${inner(a1 - a0 - 0.2, z1 - z0 - 0.2)}</g>`) });
    }
    function lights(S, from, to, n, sag) { // varal de luzinhas
      let o = '';
      const cols = ['#ffd479', '#7fe7ff', '#ff8ad8', '#b4ff8a'];
      let path = '';
      for (let i = 0; i <= n; i++) {
        const t = i / n, q = from.map((v, k) => v + (to[k] - v) * t); q[2] -= sag * 4 * t * (1 - t);
        const [X, Y] = P(...q); path += (i ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1);
        if (i > 0 && i < n) {
          const colorIndex = i % cols.length;
          o += `<circle cx="${X}" cy="${Y}" r="16" fill="url(#glow-${colorIndex})"/><circle cx="${X}" cy="${Y + 3}" r="3.2" fill="${cols[colorIndex]}" class="ap-bulb"/>`;
        }
      }
      S.post.push(`<path d="${path}" fill="none" stroke="#151238" stroke-width="1.4"/>` + o);
    }
    const glowDefs = () => ['#ffd479', '#7fe7ff', '#ff8ad8', '#b4ff8a'].map((c, i) => `<radialGradient id="glow-${i}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')
      + `<radialGradient id="warm"><stop offset="0" stop-color="#ffc77a" stop-opacity=".42"/><stop offset=".6" stop-color="#ff9a52" stop-opacity=".12"/><stop offset="1" stop-color="#ff9a52" stop-opacity="0"/></radialGradient>`
      + `<linearGradient id="aoV" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#05031a" stop-opacity=".45"/><stop offset="1" stop-color="#05031a" stop-opacity="0"/></linearGradient>`
      + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16104f"/><stop offset="1" stop-color="#4b2a7a"/></linearGradient>`
      + `<linearGradient id="rgb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff4fd8"/><stop offset=".5" stop-color="#5ad1ff"/><stop offset="1" stop-color="#7dff9a"/></linearGradient>`;

    // ---------- cômodos ----------
    const N = 12, H = 8.6, T = 0.4, SL = 0.7;
    const PAL = { wallL: '#2a2867', wallR: '#353384', cap: '#6d6bbd', floor: '#463d82', plank: '#3d3474', slabL: '#1c1a4b', slabR: '#25235e' };
    function shell(S, pal) {
      let o = '';
      o += `<polygon points="${pp([[-T, N, 0], [N, N, 0], [N, N, -SL], [-T, N, -SL]])}" fill="${pal.slabL}"/>`;
      o += `<polygon points="${pp([[N, -T, 0], [N, N, 0], [N, N, -SL], [N, -T, -SL]])}" fill="${pal.slabR}"/>`;
      o += `<polygon points="${pp([[0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0]])}" fill="${pal.floor}"/>`;
      // tábuas do piso, com emendas desencontradas
      o += onZ(0, 0, 0, Array.from({ length: N - 1 }, (_, i) => `<line x1="0" y1="${i + 1}" x2="${N}" y2="${i + 1}" stroke="${pal.plank}" stroke-width="0.05"/>`).join('')
        + Array.from({ length: N }, (_, j) => [2.5, 6.2, 9.4].map((u) => `<line x1="${(u + j * 1.7) % N}" y1="${j}" x2="${(u + j * 1.7) % N}" y2="${j + 1}" stroke="${pal.plank}" stroke-width="0.05"/>`).join('')).join(''));
      o += `<polygon points="${pp([[0, 0, 0], [0, N, 0], [0, N, H], [0, 0, H]])}" fill="${pal.wallL}"/>`;
      o += `<polygon points="${pp([[0, 0, 0], [N, 0, 0], [N, 0, H], [0, 0, H]])}" fill="${pal.wallR}"/>`;
      o += onX(0, N, H, `<rect x="0" y="${H - 1.6}" width="${N}" height="1.6" fill="url(#aoV)"/>`) + onY(0, 0, H, `<rect x="0" y="${H - 1.6}" width="${N}" height="1.6" fill="url(#aoV)"/>`);
      o += `<polygon points="${pp([[-T, -T, H], [N, -T, H], [N, 0, H], [0, 0, H], [0, N, H], [-T, N, H]])}" fill="${pal.cap}"/>`;
      o += `<polygon points="${pp([[-T, N, 0], [0, N, 0], [0, N, H], [-T, N, H]])}" fill="${sh(pal.cap, 0.72)}"/>`;
      o += `<polygon points="${pp([[N, -T, 0], [N, 0, 0], [N, 0, H], [N, -T, H]])}" fill="${sh(pal.cap, 0.86)}"/>`;
      // rodapé
      S.box(0, 0.12, 0, 0.12, N - 0.12, 0.32, sh(pal.wallL, 1.5));
      S.box(0.12, 0, 0, N - 0.12, 0.12, 0.32, sh(pal.wallR, 1.4));
      return o;
    }
    const silhouette = () => [[-T, -T, H], [N, -T, H], [N, -T, -SL], [N, N, -SL], [-T, N, -SL], [-T, N, H]];

    function furnish(S, kind, o) {
      const rc = o.color || '#c2185b', seats = [];
      let streamSeat = null;
      if (kind === 'lounge') {
        // parede esquerda: janela com noite, flâmula da sala, estante cheia
        S.box(0, 1.6, 3.6, 0.22, 3.6, 3.0, '#e9dcc4', { fx: (b) => onX(0.22, 5.2, 6.6, `<rect x="0.18" y="0.18" width="3.24" height="2.64" fill="url(#sky)"/><circle cx="2.55" cy="0.85" r="0.38" fill="#fff3d6"/><circle cx="2.42" cy="0.78" r="0.34" fill="#2a1d63"/>`
          + [[0.5, 0.5], [1.1, 1.3], [0.7, 2.1], [1.8, 0.6], [2.9, 1.9], [2.2, 2.4]].map(([u, v]) => `<rect x="${u}" y="${v}" width="0.07" height="0.07" fill="#fff" opacity=".8"/>`).join('')
          + `<path d="M0.2 2.82 L0.9 2.3 L1.4 2.6 L2.1 2.0 L2.8 2.5 L3.42 2.2 L3.42 2.82Z" fill="#120c3d"/><rect x="1.76" y="0.18" width="0.08" height="2.64" fill="#e9dcc4"/><rect x="0.18" y="1.46" width="3.24" height="0.08" fill="#e9dcc4"/>`) });
        S.box(0.22, 1.45, 3.45, 1.1, 3.9, 0.15, '#e9dcc4'); // peitoril (fundo: a Amora senta aqui)
        // flâmula
        S.box(0, 7.5, 5.6, 0.06, 3.2, 1.6, rc, { noT: true, noR: true, fx: () => onX(0.06, 10.7, 7.2, `<path d="M0 0 H3.2 L0 1.6Z" fill="${rc}"/><path d="M0 0 H3.2 L2.6 0.3 H0Z" fill="${sh(rc, 1.25)}"/><text x="0.35" y="0.78" font-family="Rubik" font-weight="800" font-size="0.62" fill="${o.ink}">${o.ini}</text>`) });
        // estante
        const shx = 0.12, shw = 1.1, sy0 = 7.3, sy1 = 10.5, sz = 4.6, wood = '#5a3a5e';
        S.box(shx, sy0, 0, shw, sy1 - sy0, sz, wood, { fx: (b) => onX(shx + shw, sy1, sz, (() => {
          let g = ''; const rows = 4, rh = (sz - 0.5) / rows, bc = ['#e85d75', '#f2c14e', '#4fb3a9', '#8f7ae5', '#f08a4b', '#e9e3d5', '#5fa8e8', '#c94f7c'];
          for (let r = 0; r < rows; r++) {
            const vy = 0.25 + r * rh; g += `<rect x="0.12" y="${vy}" width="${sy1 - sy0 - 0.24}" height="${rh - 0.12}" fill="#2a1834"/>`;
            let u = 0.2, k = r * 3;
            while (u < sy1 - sy0 - 0.5) {
              const bw = 0.16 + ((k * 37) % 5) * 0.04, bh = rh - 0.3 - ((k * 13) % 4) * 0.1;
              if ((k + r) % 9 === 4) { g += `<rect x="${u}" y="${vy + rh - 0.12 - 0.5}" width="0.5" height="0.5" fill="#c86a3c"/><rect x="${u + 0.1}" y="${vy + rh - 0.12 - 0.9}" width="0.3" height="0.4" fill="#4fae5a"/>`; u += 0.65; k++; continue; }
              if ((k + r) % 11 === 7) { g += `<rect x="${u + 0.05}" y="${vy + rh - 0.12 - bh}" width="${bh}" height="0.2" fill="${bc[k % 8]}" transform="rotate(-62 ${u + 0.05} ${vy + rh - 0.12})"/>`; u += 0.5; k++; continue; }
              g += `<rect x="${u}" y="${vy + rh - 0.12 - bh}" width="${bw}" height="${bh}" fill="${bc[k % 8]}"/><rect x="${u}" y="${vy + rh - 0.12 - bh + 0.1}" width="${bw}" height="0.05" fill="#fff" opacity=".35"/>`;
              u += bw + 0.02; k++;
            }
          }
          return g;
        })()) });
        // abajur de chão no canto
        S.box(0.5, 0.45, 0, 0.6, 0.6, 0.1, '#1a1230'); S.box(0.73, 0.68, 0.1, 0.14, 0.14, 3.9, '#8d89d6');
        S.box(0.35, 0.3, 4.0, 0.9, 0.9, 0.85, '#ffcf8a', { t: '#fff0cf' });
        S.post.unshift(`<circle cx="${P(0.8, 0.75, 4.4)[0]}" cy="${P(0.8, 0.75, 4.4)[1]}" r="165" fill="url(#warm)" pointer-events="none"/>`);
        // sofá sob a janela, com almofada da cor da sala
        seats.push(...sofa(S, 0.35, 1.7, 5.2, '#d4a03c', rc));
        // mesinha de centro com pipoca, controle e canecas
        S.box(3.1, 2.8, 0.75, 1.7, 2.9, 0.15, '#7a4b3a'); for (const [a, b2] of [[3.2, 2.9], [4.6, 2.9], [3.2, 5.5], [4.6, 5.5]]) S.box(a, b2, 0, 0.12, 0.12, 0.75, '#5c3528');
        popcorn(S, 3.35, 3.05, 0.9); S.box(3.9, 4.3, 0.9, 0.6, 0.38, 0.1, '#1b1b2e', { t: '#2c2c48' }); S.box(4.1, 3.2, 0.9, 0.28, 0.28, 0.34, '#f2c14e'); S.box(3.5, 5.0, 0.9, 0.28, 0.28, 0.34, '#e9e3d5');
        // console, caixa de som, telão
        S.box(3.4, 0.12, 0, 4.6, 1.15, 1.0, '#5c3a55', { fx: (b) => onY(b.y + b.d, b.x, 1.0, `<rect x="0.15" y="0.15" width="2.1" height="0.7" fill="none" stroke="#3d2539" stroke-width="0.05"/><rect x="2.35" y="0.15" width="2.1" height="0.7" fill="none" stroke="#3d2539" stroke-width="0.05"/><rect x="1.1" y="0.45" width="0.3" height="0.06" fill="#d9b48f"/><rect x="3.3" y="0.45" width="0.3" height="0.06" fill="#d9b48f"/>`) });
        S.box(4.0, 0.3, 1.0, 1.1, 0.75, 0.26, '#eae7f2', { fx: (b) => onY(b.y + b.d, b.x, 1.26, `<rect x="0.1" y="0.12" width="0.5" height="0.04" fill="#5ad1ff"/>`) });
        pot(S, 7.1, 0.35, 0.5, 0.4, '#e9e3d5', 1.0); plant(S, 7.18, 0.43, 1.52, 0.2, 3);
        S.box(2.15, 0.15, 0, 0.75, 0.7, 2.5, '#22203f', { fx: (b) => onY(b.y + b.d, b.x, 2.5, `<circle cx="0.37" cy="0.6" r="0.24" fill="#14122b"/><circle cx="0.37" cy="0.6" r="0.09" fill="#3a3766"/><circle cx="0.37" cy="1.55" r="0.3" fill="#14122b"/><circle cx="0.37" cy="1.55" r="0.12" fill="#3a3766"/>`) });
        tv(S, 3.0, 8.3, 2.55);
        // discos na parede (o do DJ tocando agora em destaque)
        S.box(1.0, 0, 4.25, 1.95, 0.45, 0.1, '#7a4b3a');
        [['#f2c14e', 1.05], ['#8f7ae5', 1.7], ['#e85d75', 2.35]].forEach(([c, xx], i) => S.box(xx - 0.05, 0.05 + i * 0.001, 4.35, 0.6, 0.08, 0.6, c, { fx: (b) => onY(b.y + b.d, b.x, 4.95, `<circle cx="0.3" cy="0.3" r="0.18" fill="#111" opacity=".55"/><circle cx="0.3" cy="0.3" r="0.04" fill="${c}"/>`) }));
        // canto gamer de quem transmite
        S.box(8.75, 0.12, 1.85, 3.0, 1.45, 0.15, '#2a2140'); for (const [a, b2] of [[8.8, 0.15], [11.55, 0.15], [8.8, 1.4], [11.55, 1.4]]) S.box(a, b2, 0, 0.12, 0.12, 1.85, '#1a1230');
        S.box(11.0, 0.25, 0, 0.45, 1.0, 1.55, '#1b1a30', { fx: (b) => onY(b.y + b.d, b.x, 1.55, `<rect x="0.06" y="0.1" width="0.05" height="1.35" fill="url(#rgb)"/>`) + onX(b.x + b.w, b.y + b.d, 1.55, `<rect x="0.1" y="0.1" width="0.8" height="1.35" fill="#0d0c1d"/><rect x="0.2" y="0.25" width="0.6" height="0.08" fill="url(#rgb)"/><circle cx="0.5" cy="0.8" r="0.22" fill="none" stroke="#5ad1ff" stroke-width="0.04"/>`) });
        S.box(9.95, 0.4, 2.0, 0.35, 0.3, 0.45, '#1a1230');
        S.box(9.0, 0.3, 2.45, 2.3, 0.15, 1.35, '#121026', { fx: (b) => onY(b.y + b.d, b.x, 3.8, `<rect x="0.08" y="0.08" width="2.14" height="1.19" fill="#111"/>`) });
        S.box(9.3, 0.75, 2.0, 1.5, 0.42, 0.08, '#1b1a30', { t: '#24223f', fx: (b) => onZ(2.081, 9.35, 0.8, `<rect x="0" y="0" width="1.4" height="0.32" fill="url(#rgb)" opacity=".35"/>`) });
        S.box(11.0, 0.85, 2.0, 0.2, 0.3, 0.08, '#e9e3d5');
        pot(S, 8.95, 0.35, 0.32, 0.3, '#5ad1ff', 2.0); voxels(S, 9.0, 0.4, 2.37, [[0, 0, 0], [0, 0, 1], [0, 0, 2]], ['#4fae5a', '#3f9d4f'], 0.22);
        // cadeira gamer (de costas para nós)
        S.box(9.7, 2.0, 0, 1.2, 1.2, 0.18, '#1a1230'); S.box(10.22, 2.52, 0.18, 0.16, 0.16, 0.8, '#3a3766');
        S.box(9.7, 2.0, 0.98, 1.2, 1.05, 0.34, '#d93a32', { t: '#e8524a' });
        S.box(9.7, 2.85, 1.32, 1.2, 0.3, 2.0, '#1d1b36', { fx: (b) => onY(b.y + b.d, b.x, b.z + b.h, `<rect x="0.42" y="0.12" width="0.36" height="1.76" fill="#d93a32"/><rect x="0.3" y="0.3" width="0.6" height="0.22" rx="0.05" fill="#e9e3d5"/>`) });
        streamSeat = [10.3, 2.3, 3.15];
        // pôster acima da mesa
        framePic(S, 'R', 9.0, 11.4, 4.6, 6.9, (w, h) => `<rect width="${w}" height="${h}" fill="#ff8a5c"/><rect y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="#e0352b"/><circle cx="${w * 0.5}" cy="${h * 0.55}" r="${w * 0.24}" fill="#ffd479"/>` + [0.2, 0.32, 0.44].map((t) => `<rect y="${h * (0.55 + t * 0.5)}" width="${w}" height="0.08" fill="#ff8a5c"/>`).join('') + `<text x="${w / 2}" y="${h * 0.3}" text-anchor="middle" font-family="Rubik" font-weight="800" font-size="0.5" fill="#1a0c05">GG</text>`, '#1d1b36');
        // tapete com padrão
        S.flats.push(onZ(0.004, 2.5, 1.6, `<rect width="6.0" height="7.4" fill="${sh(rc, 0.5)}"/><rect x="0.25" y="0.25" width="5.5" height="6.9" fill="none" stroke="#f2e6d0" stroke-width="0.08"/><rect x="0.45" y="0.45" width="5.1" height="6.5" fill="none" stroke="${sh(rc, 0.8)}" stroke-width="0.25"/>`
          + `<rect x="1.4" y="1.4" width="3.2" height="4.6" fill="none" stroke="#f2c14e" stroke-width="0.07"/><path d="M3 2.3 L4.1 3.7 L3 5.1 L1.9 3.7Z" fill="${sh(rc, 0.75)}" stroke="#f2c14e" stroke-width="0.07"/><path d="M3 3.2 L3.4 3.7 L3 4.2 L2.6 3.7Z" fill="#f2c14e"/>` + Array.from({ length: 12 }, (_, i) => `<line x1="${0.3 + i * 0.49}" y1="7.4" x2="${0.3 + i * 0.49}" y2="7.7" stroke="#f2e6d0" stroke-width="0.06"/>`).join('')));
        // luz da janela no chão
        S.flats.push(onZ(0.006, 0.3, 1.8, `<path d="M0 0 L0 3.3 L3.2 5.0 L3.2 1.7Z" fill="#b9c4ff" opacity=".07"/>`));
        // pufe e saco de feijão
        S.box(4.5, 7.6, 0, 0.95, 0.95, 0.75, '#e6c36a', { t: '#f0d488', fx: (b) => onZ(0.751, 4.5, 7.6, `<circle cx="0.47" cy="0.47" r="0.06" fill="#b8913c"/>`) });
        seats.push([4.97, 8.07, 0.75]);
        S.box(6.6, 4.7, 0, 1.7, 1.6, 0.55, '#8c6bd6'); S.box(6.75, 4.85, 0.55, 1.4, 1.3, 0.35, '#9d7fe0'); S.box(6.75, 5.85, 0.9, 1.4, 0.5, 0.65, '#8c6bd6');
        seats.push([7.4, 5.3, 0.9]);
        // controle esquecido no tapete, planta grande no canto da frente
        S.box(5.6, 6.9, 0, 0.55, 0.32, 0.1, '#e9e3d5');
        pot(S, 10.6, 10.6, 0.9, 1.0); plant(S, 10.7, 10.7, 1.12, 1.2, 7);
        // --- cesto de vime da Amora (com o carregador esquecido em cima, como na foto)
        const weave = (w, h, c1, c2) => Array.from({ length: Math.ceil(h / 0.16) }, (_, r) => Array.from({ length: Math.ceil(w / 0.3) + 1 }, (_, k) => `<rect x="${k * 0.3 - (r % 2) * 0.15}" y="${r * 0.16 + 0.02}" width="0.24" height="0.11" rx="0.04" fill="${(k + r) % 2 ? c1 : c2}"/>`).join('')).join('');
        S.box(0.15, 10.5, 0, 1.9, 1.3, 1.0, '#33231c', { t: '#4a3329', fx: (b) => onY(b.y + b.d, b.x, 1.0, `<clipPath id="wv1"><rect width="1.9" height="1"/></clipPath><g clip-path="url(#wv1)">` + weave(1.9, 1.0, '#5a4034', '#4a3329') + `</g><rect x="0" y="0" width="1.9" height="0.1" fill="#6a4d3e"/>`)
          + onX(b.x + b.w, b.y + b.d, 1.0, `<clipPath id="wv2"><rect width="1.3" height="1"/></clipPath><g clip-path="url(#wv2)">` + weave(1.3, 1.0, '#47322a', '#3a2920') + `</g><rect x="0" y="0" width="1.3" height="0.1" fill="#57402f"/>`)
          + onZ(1.001, 0.15, 10.5, Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${0.1 + i * 0.16}" x2="1.9" y2="${0.1 + i * 0.16}" stroke="#2a1c16" stroke-width="0.035"/>`).join('') + `<path d="M0.12 1.2 C0.4 0.75 0.2 0.45 0.5 0.3 S1.1 0.75 1.4 1.18" fill="none" stroke="#f2efe8" stroke-width="0.035"/>`) });
        S.box(1.5, 11.62, 1.0, 0.16, 0.16, 0.13, '#f4f4f2');
        S.box(2.45, 11.25, 0, 0.42, 0.42, 0.14, '#ff8ad8', { t: '#ffb3e6', fx: (b) => onZ(0.141, b.x, b.y, `<path d="M0.1 0.21 Q0.21 0.12 0.3 0.21 Q0.21 0.3 0.1 0.21Z M0.3 0.21 L0.36 0.15 L0.36 0.27Z" fill="#c2185b"/>`) });
        const bx = 6.3, by = 9.4, bw = 2.2, bd = 1.55;
        S.box(bx, by, 0, bw, bd, 0.2, '#d24b45', { t: '#f0d9b5', fx: (b) => onY(b.y + b.d, b.x, 0.2, `<text x="${bw / 2 + 0.1}" y="0.155" text-anchor="middle" font-family="Rubik" font-weight="800" font-size="0.15" letter-spacing="0.04" fill="#fff3e3">PIPOCA</text>`) + onZ(0.201, bx, by, Array.from({ length: 5 }, (_, i) => `<circle cx="${0.5 + i * 0.36}" cy="${0.45 + (i % 2) * 0.6}" r="0.06" fill="#e6c08a"/>`).join('')) });
        S.box(bx, by, 0.2, 0.22, bd, 0.32, '#b83c37', { t: '#e05a53' });
        S.box(bx + 0.22, by, 0.2, bw - 0.22, 0.22, 0.32, '#c2443f', { t: '#e05a53' });
        S.box(5.4, 10.45, 0, 0.5, 0.5, 0.22, '#5ad1ff', { t: '#2d9fd6', fx: (b) => onZ(0.221, b.x, b.y, `<rect x="0.07" y="0.07" width="0.36" height="0.36" rx="0.06" fill="#a8ecff"/>`) });
        S.box(3.9, 9.4, 0, 0.5, 0.1, 0.1, '#f4efe6'); S.box(3.78, 9.33, 0, 0.12, 0.24, 0.13, '#f4efe6'); S.box(4.4, 9.33, 0, 0.12, 0.24, 0.13, '#f4efe6');
        const manta = (w, h) => `<rect width="${w}" height="${h}" fill="#3f9b98"/>` + Array.from({ length: Math.ceil(w / 0.42) }, (_, i) => `<ellipse cx="${0.2 + i * 0.42}" cy="${h * 0.3}" rx="0.13" ry="0.17" fill="#fff3e3"/><ellipse cx="${0.2 + i * 0.42}" cy="${h * 0.3}" rx="0.09" ry="0.12" fill="#f0794a"/><ellipse cx="${0.41 + i * 0.42}" cy="${h * 0.72}" rx="0.1" ry="0.13" fill="none" stroke="#24356b" stroke-width="0.04"/>`).join('') + `<path d="${Array.from({ length: Math.ceil(w / 0.1) }, (_, i) => `${i ? 'L' : 'M'}${(i * 0.1).toFixed(2)} ${(h * 0.52 + (i % 2) * 0.07).toFixed(2)}`).join(' ')}" fill="none" stroke="#f0794a" stroke-width="0.035"/>`;
        S.box(0.9, 6.46, 1.5, 1.47, 0.46, 0.05, '#3f9b98');
        S.box(0.9, 6.92, 0.42, 1.47, 0.05, 1.13, '#3f9b98', { fx: (b) => onY(b.y + b.d, b.x, 1.55, manta(1.47, 1.13) + `<path d="M0 1.13 ${Array.from({ length: 8 }, (_, i) => `L${((i + 0.5) * 0.184).toFixed(3)} 1.21 L${((i + 1) * 0.184).toFixed(3)} 1.13`).join(' ')}" fill="#3f9b98"/>`) });
        framePic(S, 'R', 4.75, 6.55, 5.85, 7.3, (w, h) => `<rect width="${w}" height="${h}" fill="#ffe9c7"/>`
          + `<g transform="translate(0.18 0.2)"><rect x="-0.08" y="0.12" width="0.18" height="0.42" rx="0.06" fill="#ecd3bb"/><rect x="0.5" y="0.12" width="0.18" height="0.42" rx="0.06" fill="#ecd3bb"/><rect x="0" y="0" width="0.6" height="0.66" rx="0.2" fill="#fbf8f2"/><circle cx="0.18" cy="0.3" r="0.05" fill="#1a1210"/><circle cx="0.42" cy="0.3" r="0.05" fill="#1a1210"/><ellipse cx="0.3" cy="0.43" rx="0.07" ry="0.05" fill="#5a3029"/><rect x="0.25" y="0.5" width="0.1" height="0.1" rx="0.04" fill="#ef7d95"/></g>`
          + `<g transform="translate(0.92 0.22)"><path d="M0.02 0.2 L0.08 -0.04 L0.24 0.12Z M0.58 0.2 L0.52 -0.04 L0.36 0.12Z" fill="#1d1b24"/><rect x="0" y="0.06" width="0.6" height="0.58" rx="0.24" fill="#1d1b24"/><ellipse cx="0.18" cy="0.32" rx="0.07" ry="0.06" fill="#e8b93a"/><ellipse cx="0.42" cy="0.32" rx="0.07" ry="0.06" fill="#e8b93a"/><rect x="0.165" y="0.27" width="0.03" height="0.1" fill="#1d1b24"/><rect x="0.405" y="0.27" width="0.03" height="0.1" fill="#1d1b24"/></g>`
          + `<text x="${w / 2}" y="${h - 0.1}" text-anchor="middle" font-family="Rubik" font-weight="600" font-size="0.12" fill="#7a4b3a">pipoca &amp; amora</text>`, '#f4efe6');
        S.flats.push(onZ(0.003, 5.0, 3.25, [[0.1, 0.1], [0.32, 0.22], [0.15, 0.4], [0.5, 0.05]].map(([u, v]) => `<circle cx="${u}" cy="${v}" r="0.06" fill="#ffe08a"/><circle cx="${u + 0.03}" cy="${v - 0.02}" r="0.035" fill="#fff6d6"/>`).join('')));
        lights(S, [0.05, 0.3, H - 0.4], [0.05, N - 0.3, H - 0.4], 16, 0.55);
        lights(S, [0.3, 0.05, H - 0.4], [N - 0.3, 0.05, H - 0.4], 16, 0.55);
      } else if (kind === 'gamer') {
        for (let i = 0; i < 3; i++) {
          const x = 0.8 + i * 3.7; S.box(x, 0.12, 1.85, 3.0, 1.4, 0.15, '#2a2140'); S.box(x + 0.1, 0.2, 0, 0.15, 0.15, 1.85, '#1a1230'); S.box(x + 2.75, 0.2, 0, 0.15, 0.15, 1.85, '#1a1230');
          const screen = ['#3767ad', '#8241ad', '#27899c'][i];
          S.box(x + 1.3, 0.32, 2.0, 0.35, 0.40, 0.3, '#19142e');
          S.box(x + 0.4, 0.3, 2.3, 2.2, 0.15, 1.25, '#121026', { fx: (b) => onY(b.y + b.d, b.x, 3.55, `<rect x="0.08" y="0.08" width="2.04" height="1.09" fill="${screen}"/><path d="M.29 .82L.66 .44l.33 .21.35-.30.58 .45" stroke="#eddbff" stroke-opacity=".55" stroke-width=".04" fill="none"/>`) });
          S.box(x + 0.57, 0.95, 2, 1.4, 0.37, 0.07, '#343054', { t: '#7669b0' });
          S.box(x + 2.18, 0.97, 2, 0.23, 0.34, 0.09, '#b4a7d8');
          S.box(x + 2.48, 0.24, 0, 0.36, 0.9, 1.44, '#242038', { fx: (b) => onY(b.y + b.d, b.x, 1.44, '<rect x=".08" y=".13" width=".05" height="1.11" fill="url(#rgb)"/>') });
          S.box(x + 0.9, 2.0, 0, 1.1, 1.1, 0.18, '#1a1230'); S.box(x + 0.9, 2.0, 0.98, 1.1, 1.0, 0.32, '#3a62d9'); S.box(x + 0.9, 2.8, 1.3, 1.1, 0.3, 1.8, '#1d1b36');
          seats.push([x + 1.45, 2.4, 3.1]);
        }
        S.flats.push(onZ(0.004, 1, 4.5, `<rect width="10" height="6" fill="${sh(rc, 0.55)}"/>`));
        framePic(S, 'L', 2, 6, 4.2, 6.6, (w, h) => `<rect width="${w}" height="${h}" fill="#5ad1ff"/><text x="${w / 2}" y="${h * 0.65}" text-anchor="middle" font-family="Rubik" font-weight="800" font-size="1.1" fill="#0b0638">GG</text>`);
        S.box(0.12, 7.5, 0, 1.0, 3, 3.2, '#3a2f60'); pot(S, 10.6, 10.6, 0.9, 1.0); plant(S, 10.7, 10.7, 1.12, 1, 4);
        lights(S, [0.05, 0.3, H - 0.4], [0.05, N - 0.3, H - 0.4], 12, 0.5);
      } else if (kind === 'cinema') {
        tv(S, 1.0, 11.2, 2.3);
        for (let r = 0; r < 2; r++) { const y = 5 + r * 3; S.box(1.5, y, 0, 8.5, 1.8, 0.8, '#8e2b2b'); S.box(1.5, y + 1.3, 0.8, 8.5, 0.5, 1.2, '#7a2222'); for (let i = 0; i < 4; i++) seats.push([2.5 + i * 2.1, y + 0.6, 0.8]); }
        popcorn(S, 0.6, 3.5, 0); popcorn(S, 10.8, 4.0, 0);
      } else if (kind === 'study') {
        for (const y of [1.0, 6.5]) { S.box(0.12, y, 1.85, 1.6, 3.5, 0.15, '#c99a6b'); S.box(0.2, y + 0.1, 0, 0.15, 0.15, 1.85, '#8a6440'); S.box(0.2, y + 3.25, 0, 0.15, 0.15, 1.85, '#8a6440'); S.box(0.3, y + 1.2, 2.0, 0.9, 1.2, 0.08, '#e9e3d5'); S.box(2.1, y + 1.1, 0, 1, 1, 1.0, '#4fb3a9'); seats.push([2.6, y + 1.6, 1.0]); }
        for (const x of [2, 5.2, 8.4]) S.box(x, 0.12, 0, 2.8, 0.9, 5.2, '#7a5236', { fx: (b) => onY(b.y + b.d, b.x, 5.2, Array.from({ length: 4 }, (_, r) => `<rect x="0.12" y="${0.2 + r * 1.25}" width="2.56" height="1.05" fill="#3a2418"/>` + Array.from({ length: 10 }, (_, k) => `<rect x="${0.2 + k * 0.24}" y="${0.4 + r * 1.25}" width="0.2" height="0.85" fill="${['#e85d75', '#f2c14e', '#4fb3a9', '#8f7ae5', '#e9e3d5'][(k + r) % 5]}"/>`).join('')).join('')) });
        pot(S, 10.6, 10.6, 0.9, 1.0); plant(S, 10.7, 10.7, 1.12, 1, 5);
      } else if (kind === 'family') {
        S.box(3.5, 3.5, 1.4, 4.5, 3.0, 0.18, '#a0673f'); for (const [a, b2] of [[3.6, 3.6], [7.8, 3.6], [3.6, 6.3], [7.8, 6.3]]) S.box(a, b2, 0, 0.15, 0.15, 1.4, '#7a4b2e');
        for (let i = 0; i < 3; i++) { S.box(4 + i * 1.4, 2.2, 0, 0.9, 0.9, 0.9, '#e6c36a'); S.box(4 + i * 1.4, 6.9, 0, 0.9, 0.9, 0.9, '#e6c36a'); seats.push([4.45 + i * 1.4, 2.65, 0.9], [4.45 + i * 1.4, 7.35, 0.9]); }
        popcorn(S, 5.2, 4.6, 1.58); S.box(0.12, 2, 0, 1.0, 5, 2.4, '#6b4a6e'); pot(S, 10.6, 10.6, 0.9, 1.0); plant(S, 10.7, 10.7, 1.12, 1, 6);
        lights(S, [0.3, 0.05, H - 0.4], [N - 0.3, 0.05, H - 0.4], 12, 0.5);
      }
      if (kind === 'lounge') { const [a, b, c] = seats.splice(0, 3); seats.unshift(a, c); seats.push(b); }
      return { seats, streamSeat };
    }


    function room(kind, o, detailed = true) {
      const S = Scene(), base = shell(S, PAL);
      const { seats, streamSeat } = furnish(S, kind, o);
      const sil = silhouette().map((q) => P(...q));
      const xs = sil.map((q) => q[0]), ys = sil.map((q) => q[1]);
      const pad = detailed ? 18 : 8;
      const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2];
      // IDs únicos: a miniatura e a maquete podem ter luzes e decalques diferentes.
      const prefix = 'ap-' + uid++ + '-';
      const svg = (`<defs>${glowDefs()}${S.defs.join('')}</defs>${base}${S.flats.join('')}${S.render(detailed && kind === 'lounge')}<g class="ap-post">${S.post.join('')}</g>`)
        .replace(/id="([\w-]+)"|url\(#([\w-]+)\)/g, (_, id, ref) => id ? `id="${prefix}${id}"` : `url(#${prefix}${ref})`);
      return { svg, vb: vb.map((n) => n.toFixed(1)).join(' '), items: S.ordered, seats, streamSeat };
    }

    function audience(count) {
      const S = Scene(), w = count * 72, colors = ['#4d9c9b', '#d6a242', '#8c6bd6', '#d9534f'];
      S.flats.push(`<path d="M10 5H${w - 10}L${w - 2} 30H2Z" fill="#782c63"/><path d="M17 9H${w - 17}L${w - 12} 26H12Z" stroke="#e7bf89" stroke-width="1" fill="none"/>`);
      for (let i = 0; i < count; i++) {
        const x = (36 + 72 * i) / (K * s * 2), c = colors[i % colors.length];
        S.box(x - 0.53, -x - 0.53, -0.82, 1.06, 1.06, 0.82, c, { t: sh(c, 1.12) });
      }
      return '<g class="ap-audience-art">' + S.flats.join('') + S.render() + '</g>';
    }
    // Miniaturas usam as mesmas proporções e materiais, sem replicar centenas de polígonos decorativos.
    function miniature(kind, c) {
      const S = Scene();
      const base = shell(S, PAL).replaceAll('url(#aoV)', '#252150');
      const box = (...args) => S.box(...args);
      if (kind === 'lounge') {
        sofa(S, 0.35, 1.7, 5.2, '#d4a03c', c);
        box(0, 1.6, 3.65, 0.2, 3.6, 3, '#e9dcc4', { fx: () => onX(0.2, 5.2, 6.65, '<rect x=".2" y=".2" width="3.2" height="2.6" fill="#201c61"/><circle cx="2.6" cy=".9" r=".38" fill="#fff1c8"/>') });
        box(0.2, 7.5, 0, 1, 2.8, 4.6, '#865775');
        box(3, .15, 2.65, 5.3, .3, 2.85, '#171437');
        box(3.1, 2.8, .3, 1.7, 2.9, .5, '#ab704e');
        box(6.5, 9.4, 0, 2.2, 1.55, .3, '#e46f69');
        S.flats.push(onZ(0, 2.5, 1.55, `<rect width="6" height="7.4" fill="${c}"/><rect x=".4" y=".4" width="5.2" height="6.6" fill="none" stroke="#d6ab83" stroke-width=".13"/>`));
      } else if (kind === 'gamer') {
        for (const x of [1, 4.6, 8.2]) {
          box(x, .3, 0, 2.8, 1.55, 1.8, '#45385c');
          box(x + .32, .38, 2.2, 2.15, .3, 1.4, '#6293e4');
          box(x + .7, 2.5, 0, 1.2, 1.25, 1.2, '#597bda'); box(x + .7, 3.3, 1.2, 1.2, .35, 1.8, '#35488b');
        }
      } else if (kind === 'cinema') {
        box(1, .1, 2.75, 10.2, .35, 5.1, '#131027');
        for (const y of [5, 8]) { box(1.5, y, 0, 8.5, 1.8, .8, '#a34352'); box(1.5, y + 1.3, .8, 8.5, .5, 1.2, '#bd4e5c'); }
      } else if (kind === 'study') {
        for (const y of [1.1, 6.6]) { box(.2, y, 0, 1.6, 3.4, 1.85, '#c99a6b'); box(2.1, y + 1, 0, 1, 1, 1, '#4fb3a9'); }
        for (const x of [2, 5.2, 8.4]) box(x, .2, 0, 2.8, .9, 5.1, '#9c7458', { fx: () => onY(1.1, x, 5.1, '<path d="M.2 1.2h2.4M.2 2.5h2.4M.2 3.8h2.4" stroke="#48324c" stroke-width=".45"/>') });
      } else {
        box(3.5, 3.5, 0, 4.5, 3, 1.6, '#ba855a');
        for (const x of [4, 5.4, 6.8]) for (const y of [2.2, 6.9]) box(x, y, 0, .9, .9, .9, '#e6c36a');
        box(.15, 2, 0, 1, 5, 2.4, '#83629a');
      }
      const sil = silhouette().map(q => P(...q));
      return { svg: base + S.flats.join('') + S.render(), vb: '-332 -278 664 677', sil: sil.map(q => q.join(',')).join(' ') };
    }
    return { room, miniature, audience, P, Scene };
  })();

  // Pipoca (cachorrinha branca, pelo enrolado, orelha creme, nariz marrom, língua de fora)
  // e Amora (gata preta, olho âmbar, bigode comprido, rabo peludo, dorme esticada no cesto de vime).
  // Modelos em caixas no mesmo motor isométrico da sala; andam por um grafo de caminhos livres
  // e entram na ordem de desenho certa (passam atrás do sofá, na frente da mesa etc.).
  const petArt = (() => {
    const { Scene, P } = iso;
    const DOG = { c: '#f8f4ec', l: '#e6e0d4', r: '#cdc5b7' }, EAR = { c: '#f0dcc6', l: '#dfc6ad', r: '#c9ad93' };
    const CAT = { c: '#3a3648', l: '#22202b', r: '#16151c' };
    const B = (x0, x1, y0, y1, z0, z1, m, extra = {}) => ({ x0, x1, y0, y1, z0, z1, ...(typeof m === 'string' ? { c: m } : m), ...extra });
    const sym = (x0, x1, a, b, z0, z1, m) => [B(x0, x1, a, b, z0, z1, m), B(x0, x1, -b, -a, z0, z1, m)];

    const M = {
      dog: {
        walk: ({ f = 0, w = 0, t = 0 }) => {
          const lift = (front, side) => ((front ^ side) === f ? 0.07 : 0);
          const legs = [[0, 0], [0, 1], [1, 0], [1, 1]].flatMap(([fr, sd]) => {
            const x0 = fr ? 0.19 : -0.43, y0 = sd ? 0.07 : -0.25, z = lift(fr, sd);
            return [B(x0 - 0.02, x0 + 0.2, y0 - 0.02, y0 + 0.2, z, z + 0.08, DOG), B(x0, x0 + 0.16, y0, y0 + 0.16, z + 0.08, 0.3, DOG)]; // pata peluda + perna
          });
          return [
            ...legs,
            B(-0.48, 0.3, -0.27, 0.27, 0.3, 0.7, DOG),
            // cachinhos: calombos no lombo e nos lados
            ...[[-0.38, -0.16], [-0.12, 0.08], [0.1, 0.26]].map(([a, b]) => B(a, b, -0.15, 0.15, 0.7, 0.77, DOG)),
            ...[[-0.4, -0.22], [-0.08, 0.1]].flatMap(([a, b]) => sym(a, b, 0.27, 0.31, 0.42, 0.6, DOG)),
            B(0.3, 0.5, -0.22, 0.22, 0.38, 0.72, DOG),
            B(0.5, 0.54, -0.14, 0.14, 0.46, 0.66, DOG),
            B(0.34, 0.78, -0.25, 0.25, 0.72, 1.13, DOG),
            B(0.42, 0.7, -0.17, 0.17, 1.13, 1.21, DOG),
            ...sym(0.42, 0.62, 0.25, 0.37, 0.64, 1.1, EAR),
            B(0.78, 0.93, -0.11, 0.11, 0.77, 0.93, DOG),
            B(0.93, 0.98, -0.055, 0.055, 0.86, 0.93, '#4a2c26'),
            ...sym(0.78, 0.8, 0.07, 0.15, 0.97, 1.05, '#17110f'),
            ...(t ? [B(0.84, 0.9, -0.04, 0.04, 0.71, 0.77, '#ef7d95')] : []),
            // rabo: pompom enrolado por cima das costas, como nas fotos
            B(-0.58, -0.48, -0.06, 0.06, 0.62, 0.9, DOG),
            B(-0.64, -0.34, -0.13 + w * 0.07, 0.13 + w * 0.07, 0.9, 1.12, DOG),
            B(-0.34, -0.22, -0.09 + w * 0.07, 0.09 + w * 0.07, 0.94, 1.06, DOG),
          ];
        },
        sit: ({ w = 0, t = 1 }) => [
          B(-0.4, 0.05, -0.27, 0.27, 0, 0.44, DOG),
          ...sym(0.05, 0.25, 0.17, 0.29, 0, 0.1, DOG),
          B(0.05, 0.38, -0.22, 0.22, 0.3, 0.78, DOG),
          ...sym(0.2, 0.36, 0.04, 0.16, 0, 0.3, DOG),
          B(0.12, 0.56, -0.25, 0.25, 0.78, 1.19, DOG),
          B(0.2, 0.48, -0.17, 0.17, 1.19, 1.27, DOG),
          ...sym(0.2, 0.4, 0.25, 0.37, 0.7, 1.16, EAR),
          B(0.56, 0.71, -0.11, 0.11, 0.83, 0.99, DOG),
          B(0.71, 0.76, -0.055, 0.055, 0.92, 0.99, '#4a2c26'),
          ...sym(0.56, 0.58, 0.07, 0.15, 1.03, 1.11, '#17110f'),
          ...(t ? [B(0.62, 0.68, -0.04, 0.04, 0.76, 0.83, '#ef7d95')] : []),
          B(-0.66, -0.4, -0.13 + w * 0.1, 0.13 + w * 0.1, 0, 0.22, DOG),
          ...sym(-0.32, -0.12, 0.27, 0.31, 0.12, 0.32, DOG),
        ],
        sleep: () => [
          B(-0.45, 0.3, -0.32, 0.32, 0, 0.36, DOG),
          B(0.3, 0.66, -0.3, 0.1, 0, 0.32, DOG),
          B(0.36, 0.52, 0.1, 0.18, 0.06, 0.28, EAR),
          B(0.66, 0.78, -0.18, 0.0, 0.02, 0.15, DOG),
          B(0.78, 0.82, -0.12, -0.06, 0.08, 0.14, '#4a2c26'),
          B(0.66, 0.67, -0.27, -0.2, 0.21, 0.23, '#17110f'), B(0.66, 0.67, -0.06, 0.0, 0.21, 0.23, '#17110f'),
          B(0.3, 0.5, 0.12, 0.32, 0, 0.18, DOG),
        ],
      },
      cat: {
        walk: ({ f = 0, w = 0 }) => {
          const lift = (front, side) => ((front ^ side) === f ? 0.06 : 0);
          const s = w * 0.07;
          return [
            ...[[0, 0], [0, 1], [1, 0], [1, 1]].map(([fr, sd]) => B(fr ? 0.22 : -0.42, fr ? 0.33 : -0.31, sd ? 0.06 : -0.17, sd ? 0.17 : -0.06, lift(fr, sd), 0.32, CAT)),
            B(-0.48, 0.35, -0.19, 0.19, 0.32, 0.62, CAT),
            B(0.35, 0.7, -0.2, 0.2, 0.52, 0.86, CAT),
            ...sym(0.42, 0.56, 0.07, 0.19, 0.86, 0.97, CAT), ...sym(0.45, 0.53, 0.1, 0.16, 0.97, 1.04, CAT),
            B(0.7, 0.76, -0.08, 0.08, 0.56, 0.67, CAT),
            ...sym(0.7, 0.712, 0.05, 0.14, 0.7, 0.77, '#e8b93a'),
            ...sym(0.735, 0.745, 0.08, 0.34, 0.62, 0.63, '#b9b6c8'), ...sym(0.735, 0.745, 0.08, 0.32, 0.655, 0.665, '#b9b6c8'),
            B(-0.76, -0.48, -0.05, 0.05, 0.52, 0.6, CAT),
            B(-0.84, -0.76, -0.055 + s, 0.055 + s, 0.52, 0.98, CAT),
            B(-0.76, -0.64, -0.05 + s * 1.6, 0.05 + s * 1.6, 0.92, 1.0, CAT),
          ];
        },
        sit: ({ w = 0, out = 0 }) => [
          B(-0.3, 0.1, -0.24, 0.24, 0, 0.36, CAT),
          B(0.1, 0.34, -0.17, 0.17, 0.08, 0.72, CAT),
          ...sym(0.34, 0.44, 0.03, 0.13, 0, 0.08, CAT),
          B(0.02, 0.4, -0.2, 0.2, 0.72, 1.04, CAT),
          ...sym(0.1, 0.24, 0.07, 0.19, 1.04, 1.15, CAT), ...sym(0.13, 0.21, 0.1, 0.16, 1.15, 1.22, CAT),
          B(0.4, 0.46, -0.08, 0.08, 0.76, 0.87, CAT),
          ...sym(0.4, 0.412, 0.05, 0.14, 0.9, 0.97, '#e8b93a'),
          ...sym(0.435, 0.445, 0.08, 0.34, 0.81, 0.82, '#b9b6c8'), ...sym(0.435, 0.445, 0.08, 0.32, 0.845, 0.855, '#b9b6c8'),
          ...(out
            ? [B(-0.42, -0.3, -0.05 + w * 0.08, 0.05 + w * 0.08, -0.62, 0.06, CAT)]
            : [B(-0.3, 0.34, 0.24, 0.33, 0, 0.09, CAT), B(0.34, 0.48, 0.13 + w * 0.04, 0.33, 0, 0.09 + (w > 0 ? 0.07 : 0), CAT)]),
        ],
        stretch: () => [
          ...sym(-0.85, -0.55, 0.1, 0.2, 0, 0.1, CAT),
          B(-0.9, -0.55, -0.045, 0.045, 0, 0.08, CAT),
          B(-0.55, 0.32, -0.22, 0.22, 0, 0.26, CAT),
          B(0.32, 0.66, -0.2, 0.2, 0, 0.3, CAT),
          ...sym(0.38, 0.5, 0.07, 0.19, 0.3, 0.41, CAT),
          B(0.66, 0.72, -0.08, 0.08, 0.04, 0.14, CAT),
          ...sym(0.66, 0.672, 0.05, 0.13, 0.17, 0.2, '#e8b93a'),
          ...sym(0.695, 0.705, 0.08, 0.3, 0.09, 0.1, '#b9b6c8'),
          ...sym(0.66, 0.77, 0.21, 0.31, -0.42, 0.06, CAT),
        ],
        curl: () => [
          B(-0.35, 0.3, -0.28, 0.22, 0, 0.28, CAT),
          B(0.3, 0.6, -0.28, 0.02, 0, 0.26, CAT),
          B(0.36, 0.48, -0.26, -0.14, 0.26, 0.36, CAT), B(0.36, 0.48, -0.1, 0.02, 0.26, 0.36, CAT),
          B(0.6, 0.61, -0.24, -0.17, 0.14, 0.16, '#e8b93a'), B(0.6, 0.61, -0.09, -0.02, 0.14, 0.16, '#e8b93a'),
          B(-0.35, 0.55, 0.22, 0.3, 0, 0.08, CAT),
        ],
      },
    };

    const rot = (b, d) => {
      const c = [[b.x0, b.y0], [b.x1, b.y1]].map(([x, y]) => (d === 0 ? [x, y] : d === 1 ? [-y, x] : d === 2 ? [-x, -y] : [y, -x]));
      return { ...b, x0: Math.min(c[0][0], c[1][0]), x1: Math.max(c[0][0], c[1][0]), y0: Math.min(c[0][1], c[1][1]), y1: Math.max(c[0][1], c[1][1]) };
    };
    const SC = 1.4; // um pouco maiores que a escala real, para lerem bem na maquete
    const into = (S, boxes, d, ox = 0, oy = 0, oz = 0) => {
      const bb = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
      for (const b00 of boxes) {
        const b0 = { ...b00 }; for (const k of ['x0', 'x1', 'y0', 'y1', 'z0', 'z1']) b0[k] *= SC;
        const b = rot(b0, d);
        S.box(ox + b.x0, oy + b.y0, oz + b.z0, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0, b.c, { l: b.l, r: b.r });
        for (const k of ['x0', 'y0', 'z0']) bb[k] = Math.min(bb[k], b[k]);
        for (const k of ['x1', 'y1', 'z1']) bb[k] = Math.max(bb[k], b[k]);
      }
      return bb;
    };
    const cache = new Map();
    const build = (kind, pose, d, o) => {
      const key = `${kind}|${pose}|${d}|${o.f || 0}|${o.w || 0}|${o.t || 0}|${o.out || 0}`;
      if (!cache.has(key)) {
        const S = Scene(), bb = into(S, M[kind][pose](o), d);
        const x = Math.floor(P(bb.x0, bb.y1, 0)[0]) - 1;
        const y = Math.floor(P(bb.x0, bb.y0, bb.z1)[1]) - 1;
        const width = Math.ceil(P(bb.x1, bb.y0, 0)[0]) + 1 - x;
        const height = Math.ceil(P(bb.x1, bb.y1, bb.z0)[1]) + 1 - y;
        // Uma imagem local por pose; alternar o href não recria dezenas de faces no DOM.
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${S.render()}</svg>`;
        const href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        cache.set(key, { x, y, width, height, href, bb });
      }
      return cache.get(key);
    };
    return build;
  })();

  // As rotas da Pipoca usam corredores no piso, inclusive as duas pontas do sofá.
  const DOG_WAY = {
    bed: [7.19, 10.3, 0.2], edge: [9.12, 10.3], q: [9.12, 8.65], p: [6.05, 8.15],
    n2: [6.1, 7.0], b: [5.8, 5.3], milhos: [6.1, 3.65], n5: [5.6, 2.25],
    pc: [8.65, 2.95], n7: [9.35, 7.55], n3: [2.75, 7.15],
    sofaSul: [2.6, 7.95], meio: [2.74, 4.3], sofaNorte: [2.76, 2.24], saco: [7.28, 7.0],
  };
  const DOG_LINKS = [
    ['bed', 'edge'], ['edge', 'q'], ['q', 'p'], ['q', 'n7'], ['p', 'n2'], ['n2', 'b'],
    ['b', 'milhos'], ['milhos', 'n5'], ['n5', 'pc'], ['pc', 'n7'], ['n7', 'saco'], ['saco', 'n2'],
    ['n2', 'n3'], ['n3', 'sofaSul'], ['sofaSul', 'meio'], ['meio', 'sofaNorte'], ['sofaNorte', 'n5'],
  ].reduce((a, [x, y]) => { (a[x] ||= []).push(y); (a[y] ||= []).push(x); return a; }, {});
  const DOG_VISITS = ['sofaNorte', 'sofaSul', 'p', 'saco', 'meio', 'pc', 'n7', 'q', 'n2'];
  function dogRoute(from, to) {
    const previous = new Map([[from, null]]), queue = [from];
    for (let i = 0; i < queue.length && !previous.has(to); i++) {
      for (const next of DOG_LINKS[queue[i]]) if (!previous.has(next)) {
        previous.set(next, queue[i]); queue.push(next);
      }
    }
    const path = [];
    for (let n = to; n !== from; n = previous.get(n)) {
      const [x, y, z = 0] = DOG_WAY[n];
      path.push({ type: 'walk', x, y, z, node: n, speed: 4.5 });
    }
    return path.reverse();
  }
  const still = (pose, ms, opts = {}) => ({ type: 'rest', pose, ms, ...opts });
  const walk = (x, y, z, speed) => ({ type: 'walk', x, y, z, speed });
  const jump = (x, y, z, dir) => ({ type: 'jump', x, y, z, dir, ms: 420 });
  const catCycle = () => [
    still('stretch', 4700, { sleep: true, dir: 0 }), jump(2.9, 10.1, 0, 0),
    walk(2.8, 7.6, 0, 1.7), jump(1.62, 6.69, 1.55, 3), still('sit', 1200, { dir: 1 }),
    jump(0.62, 6.0, 2.35, 2), walk(0.62, 3.9, 2.35, 1.2), jump(0.88, 3.42, 3.60, 2),
    still('sit', 6000, { tail: true, out: 1, dir: 2 }), // lua, no peitoril
    jump(0.62, 4.1, 2.35, 1), walk(0.62, 6.0, 2.35, 1.2),
    jump(1.62, 6.69, 1.55, 0), still('sit', 600, { dir: 0 }), jump(2.8, 7.6, 0, 1),
    walk(2.9, 10.1, 0, 1.7), jump(1.2, 11.13, 1.0, 2),
  ];
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const [key, val] of Object.entries(attrs)) n.setAttribute(key, val);
    return n;
  };
  const facing = (dx, dy) => Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 2) : (dy >= 0 ? 1 : 3);

  function petReaction(target, fx, kind) {
    let timer;
    const clear = () => { clearTimeout(timer); fx.replaceChildren(); };
    const react = () => {
      clear();
      const pop = svgEl('text', { y: kind === 'dog' ? -57 : -47, class: 'ap-pop', 'text-anchor': 'middle' });
      pop.textContent = kind === 'dog' ? '♥' : 'mrr.';
      fx.append(pop);
      timer = setTimeout(clear, 850);
    };
    target.addEventListener('click', react);
    target.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); react(); }
    });
    return clear;
  }

  function animatePets(svg, art, tokens) {
    const pieces = Array.from(svg.children).filter(el => el.classList.contains('ap-piece'));
    const post = svg.querySelector('.ap-post');
    function make(kind, name) {
      const g = svgEl('g', { class: `ap-pet ap-pet-${kind}`, role: 'button', tabindex: 0, 'aria-label': `Fazer carinho em ${name}` });
      const body = svgEl('image'), fx = svgEl('g', { 'aria-hidden': true, 'pointer-events': 'none' });
      g.append(body, fx);
      const clear = petReaction(g, fx, kind);
      return { kind, g, body, fx, clear, time: 0, route: [] };
    }
    const dog = make('dog', 'Pipoca'), cat = make('cat', 'Amora'), pets = [dog, cat];
    const PET_FRAME = 1000 / 15;
    let raf = 0, nextFrame = 0, last = 0, depthAt = 0, listenAt = 0, reduced = false, started = false;
    let routine = 0, speaker = '', heardAt = -6000;

    function place(pet) {
      // Procura a lacuna que viola menos relações do pintor, sem reordenar os móveis.
      const { x, y, z, bb } = pet, eps = 0.02;
      const relation = art.items.map((b) => {
        const behind = b.x + b.w <= x + bb.x0 + eps || b.y + b.d <= y + bb.y0 + eps || b.z + b.h <= z + eps;
        const ahead = x + bb.x1 <= b.x + eps || y + bb.y1 <= b.y + eps || z + bb.z1 <= b.z + eps;
        return behind === ahead ? 0 : behind ? -1 : 1;
      });
      let cost = relation.filter(v => v < 0).length, best = cost, pos = 0;
      relation.forEach((r, i) => { cost += r; if (cost <= best) { best = cost; pos = i + 1; } });
      const ref = pieces[pos] || post;
      if (pet.anchor !== ref || !pet.g.parentNode) { svg.insertBefore(pet.g, ref); pet.anchor = ref; }
    }
    function paint(pet) {
      const { pose, dir, f, w, t, out } = pet;
      const key = `${pose}|${dir}|${f}|${w}|${t}|${out}`;
      if (key !== pet.key) {
        const model = petArt(pet.kind, pose, dir, pet);
        pet.body.innerHTML = model.svg; pet.bb = model.bb; pet.key = key;
        pet.g.dataset.apPose = pose;
      }
      const [x, y] = iso.P(pet.x, pet.y, pet.z), xy = `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
      if (xy !== pet.xy) { pet.g.setAttribute('transform', xy); pet.xy = xy; }
      if (pet.sleep !== pet.wasSleeping) {
        pet.zz?.remove(); pet.zz = null;
        if (pet.sleep) {
          pet.zz = svgEl('text', { x: 13, y: -26, class: 'ap-zz', 'aria-hidden': true, 'pointer-events': 'none' });
          pet.zz.textContent = 'z z'; pet.g.append(pet.zz);
        }
        pet.wasSleeping = pet.sleep;
      }
    }
    function reset() {
      for (const p of pets) {
        const [x, y, z] = p === dog ? DOG_WAY.bed : [1.2, 11.13, 1.0];
        Object.assign(p, { x, y, z, dir: 0, pose: p === dog ? 'sleep' : 'stretch', f: 0, w: 0, t: 0, out: 0, sleep: true, time: 0, node: 'bed' });
        p.route = p === dog ? [still('sleep', 4200, { sleep: true, dir: 0 })] : catCycle();
        paint(p); place(p);
      }
      speaker = ''; heardAt = -6000; routine = 0;
    }
    function aim(node, stop, interrupt = false) {
      const current = interrupt && dog.route[0]?.from ? dog.route[0] : null;
      dog.route = [ ...(current ? [current] : []), ...dogRoute(current?.node || dog.node, node), stop ];
    }
    function dogPlan() {
      const next = routine++ % 3;
      if (next === 0) aim('milhos', still('walk', 2800, { dir: 2 }));
      else if (next === 1) aim('sofaSul', still('sit', 3400, { dir: 0, tail: true, tongue: true }));
      else aim('bed', still('sleep', 7400, { dir: 0, sleep: true }));
    }
    function listen() {
      const ids = tokens();
      const talking = ids.find((token) => token.classList.contains('ap-is-speaking') && !token.classList.contains('ap-is-bot'));
      if (!talking) { speaker = ''; return; }
      if (speaker === talking.dataset.uid || dog.time - heardAt < 5100) return;
      const seat = Number(talking.dataset.seat);
      if (!Number.isInteger(seat)) return;
      speaker = talking.dataset.uid; heardAt = dog.time;
      const node = seat === -1 ? 'pc' : DOG_VISITS[seat] || 'n7';
      // Ao sentar, vira para a frente da maquete, não para dentro da mesa.
      aim(node, still('sit', 5500, { dir: node === 'sofaNorte' ? 1 : 0, tail: true, tongue: true }), true);
      routine = 2;
    }
    function step(p, dt) {
      p.time += dt;
      if (!p.route.length) { if (p === dog) dogPlan(); else p.route = catCycle(); }
      const action = p.route[0];
      if (action.type === 'rest') {
        p.pose = action.pose; p.dir = action.dir ?? p.dir; p.sleep = !!action.sleep;
        p.f = 0; p.w = action.tail ? [0, 1, 0, -1][Math.floor(p.time / (p === dog ? 140 : 390)) % 4] : 0;
        p.t = action.tongue ? 1 : 0; p.out = action.out || 0;
        action.el = (action.el || 0) + dt;
        if (action.el >= action.ms) p.route.shift();
        return;
      }
      if (!action.from) {
        action.from = [p.x, p.y, p.z];
        action.dir ??= facing(action.x - p.x, action.y - p.y);
        action.ms ??= 1000 * Math.hypot(action.x - p.x, action.y - p.y) / action.speed;
        action.el = 0;
      }
      action.el += dt;
      const [x, y, z] = action.from, k = Math.min(1, action.el / Math.max(1, action.ms));
      p.pose = 'walk'; p.dir = action.dir; p.f = Math.floor(p.time / (p === dog ? 110 : 160)) % 2;
      p.w = 0; p.t = p === dog ? 1 : 0; p.out = 0; p.sleep = false;
      p.x = x + (action.x - x) * k; p.y = y + (action.y - y) * k;
      p.z = z + (action.z - z) * k + (action.type === 'jump' ? 2.8 * k * (1 - k) : 0);
      if (k === 1) { p.node = action.node; p.route.shift(); }
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now < nextFrame) return;
      // Guarda a fase para respeitar o limite também em monitores de 120/144 Hz.
      nextFrame = nextFrame ? Math.max(now, nextFrame + PET_FRAME) : now + PET_FRAME;
      const dt = last ? Math.min(2 * PET_FRAME, now - last) : 0;
      last = now;
      if (now >= listenAt) { listen(); listenAt = now + 160; }
      for (const pet of pets) { step(pet, dt); paint(pet); }
      if (now >= depthAt) { pets.forEach(place); depthAt = now + 75; }
    }
    reset();
    return {
      motion(sleep, halt) {
        if (sleep && !reduced && started) reset();
        reduced = sleep; started = true;
        if (sleep || halt) { cancelAnimationFrame(raf); raf = 0; last = nextFrame = 0; pets.forEach(p => p.clear()); }
        else if (!raf) raf = requestAnimationFrame(tick);
      },
      stop() { cancelAnimationFrame(raf); pets.forEach(p => p.clear()); },
    };
  }

  const I = (name, size = 18) => icon(name, size);
  const e = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const color = (value, fallback = '#ad607b') => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const ink = (c) => {
    const [r, g, b] = c.slice(1).match(/../g).map(k => {
      const s = parseInt(k, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.192 ? '#170c2d' : '#ffffff';
  };
  const image = (v) => typeof v === 'string' && /^(?:data:image\/(?:png|jpe?g|gif|webp|avif);base64,|blob:)/i.test(v) ? v : '';
  const first = (s, n) => Array.from(s || '').slice(0, n).join('');
  const initial = (s) => first(String(s || '?').trim(), 1).toLocaleUpperCase('pt-BR') || '?';
  const initials = (s) => String(s || 'Apê').trim().split(/\s+/).filter(w => !/^(da|de|do|das|dos|e)$/i.test(w)).slice(0, 2).map(initial).join('') || 'A';
  const short = (s, n) => Array.from(s || '').length > n ? first(s, n - 1) + '…' : s || '';
  const countPeople = (n) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;
  const setText = (el, content) => { if (el.textContent !== content) el.textContent = content; };
  const setAttr = (el, key, val) => { if (el.getAttribute(key) !== String(val)) el.setAttribute(key, val); };
  // Compara os campos, não serializa fotos em base64 a cada retrato do hospedeiro.
  const sameFields = (a, b) => a?.length === b.length && a.every((v, i) => v === b[i]);
  const reducedSystem = matchMedia('(prefers-reduced-motion: reduce)');
  const KIND = {
    lounge: { name: 'Estar', color: '#a43870' }, gamer: { name: 'Gamer', color: '#4a59ba' },
    cinema: { name: 'Cinema', color: '#b34e54' }, study: { name: 'Estudos', color: '#389b8a' }, family: { name: 'Família', color: '#b47244' },
  };
  function roomKind(name) {
    const n = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\b(lol|gg|rift)\b|gam|jog|valorant|rank|minecraft|fortnite/.test(n)) return 'gamer';
    if (/cinema|cine\b|filme|sessao|serie|tel[ao]+o/.test(n)) return 'cinema';
    if (/estud|foco|livro|leitura|aula|biblioteca|trabalho/.test(n)) return 'study';
    if (/familia|jantar|cozinha|refeitorio/.test(n)) return 'family';
    return 'lounge';
  }
  const avatar = (user) => {
    const c = color(user?.color, '#7266bd'), img = image(user?.avatar);
    return `<span class="ap-avatar" aria-hidden="true" style="--ap-avatar:${c};--ap-ink:${ink(c)}"><span>${e(initial(user?.name))}</span>${img ? `<img src="${e(img)}" alt="">` : ''}</span>`;
  };
  const button = (action, title, glyph, cls = '', caption = '') => `<button type="button" class="ap-button ${cls}" data-ap-${action} title="${title}" aria-label="${title}">${I(glyph)}${caption ? `<span>${caption}</span>` : ''}</button>`;
  let faceId = 0;
  function newToken(person, live = false) {
    const id = 'ap-face-' + ++faceId, r = live ? 21 : 23;
    const g = svgEl('g', { class: 'ap-tok', tabindex: 0, role: 'button', 'data-uid': person.id });
    g.innerHTML = `<ellipse class="ap-footprint" cy="1" rx="${r * 0.72}" ry="${r * 0.27}" fill="#080522" opacity=".36"/>
      <g transform="translate(0 -${live ? 28 : 41})"><g class="rings"><circle r="${r + 4}" fill="none" stroke="#ffc278" stroke-width="2.5"/><circle class="ap-ring" r="${r + 4}" fill="none" stroke="#ea5b1a" stroke-width="2.5"/></g>
      <circle class="ap-face-bg" r="${r}" stroke="#21154b" stroke-width="2.5"/>
      <text class="ap-face-initial" y="${r * .34}" text-anchor="middle" font-size="${r}"></text>
      <clipPath id="${id}"><circle r="${r - 1.4}"/></clipPath><image class="ap-face-image" x="-${r}" y="-${r}" width="${2 * r}" height="${2 * r}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>
      <g class="ap-face-silence" transform="translate(${r * .73} ${r * .62})"><circle r="9" fill="#fff3e3" stroke="#171035" stroke-width="1.6"/><g transform="translate(-6 -6) scale(.5)" fill="none" stroke="#8a2834" stroke-width="2.8" stroke-linecap="round"><g class="ap-face-muted">${I('micOff', 24).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g><g class="ap-face-deaf">${I('headphonesOff', 24).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></g></g></g>
      <g class="ap-nameplate" transform="translate(0 -${live ? 8 : 17})"><rect height="19" y="0" rx="9.5"/><text x="0" y="13.4" text-anchor="middle"></text></g>
      <g class="ap-face-live" transform="translate(${r * .82} -${live ? 50 : 65})"><circle r="7" fill="#ff8278" stroke="#260b24" stroke-width="2"/><path d="M-1.5 -3L3 0l-4.5 3z" fill="#360c23"/></g><title></title>`;
    const q = (s) => g.querySelector(s);
    return { g, background: q('.ap-face-bg'), initial: q('.ap-face-initial'), photo: q('image'), label: q('.ap-nameplate text'), pill: q('.ap-nameplate rect'), title: q('title'), short: live ? 9 : 16 };
  }
  function patchToken(t, p, compact) {
    const c = color(p.color, '#7266bd'), a = image(p.avatar), name = p.name || 'Sem nome';
    const attrs = [name, c, a, !!p.me, !!p.muted, !!p.deafened, !!p.sharing, !!p.bot, !!p.host, compact];
    if (!sameFields(t.attrs, attrs)) {
      t.attrs = attrs;
      setAttr(t.background, 'fill', c); setAttr(t.initial, 'fill', ink(c)); setText(t.initial, initial(name));
      if (a) setAttr(t.photo, 'href', a); else t.photo.removeAttribute('href');
      const label = short(name, compact ? 8 : t.short);
      setText(t.label, label);
      const w = Math.max(30, 16 + Array.from(label).reduce((total, l) => total + (/[MW@#]/.test(l) ? 9 : /[il.! ]/.test(l) ? 3.4 : 6.7), 0));
      setAttr(t.pill, 'width', w); setAttr(t.pill, 'x', -w / 2);
      const status = [p.me && 'você', p.bot && 'DJ', p.host && 'anfitrião', p.deafened ? 'sem áudio' : p.muted && 'microfone desligado', p.sharing && 'ao vivo'].filter(Boolean);
      const full = status.length ? `${name} · ${status.join(' · ')}` : name;
      setText(t.title, full); setAttr(t.g, 'aria-label', `Opções de ${full}`);
      t.g.classList.toggle('ap-is-muted', !!p.muted || !!p.deafened);
      t.g.classList.toggle('ap-is-deaf', !!p.deafened);
      t.g.classList.toggle('ap-is-streaming', !!p.sharing);
      t.g.classList.toggle('ap-is-bot', !!p.bot);
    }
    if (t.speaking !== !!p.speaking) { t.speaking = !!p.speaking; t.g.classList.toggle('ap-is-speaking', t.speaking); }
  }
  const EXTRA_SEATS = [[7.3, 7.65, 0], [9.5, 5.25, 0], [3.15, 10.15, 0], [9.6, 8.9, 0], [1.6, 8.5, 0], [6.5, 10.6, 0]];
  const STANDING = {
    gamer: [[2.75, 5, 0], [6, 5.3, 0], [9.35, 5.7, 0], [4.3, 9.6, 0], [8.2, 9.6, 0]],
    study: [[5.1, 4.3, 0], [8.5, 4.1, 0], [10.25, 6, 0], [3.45, 10.3, 0], [6.4, 9.9, 0], [8.7, 8.1, 0]],
    family: [[2.15, 6.35, 0], [9.2, 6.0, 0]],
  };
  const theaterCat = `<svg class="ap-tv-cat" viewBox="-14 0 161 61" role="button" tabindex="0" aria-label="Fazer carinho em Amora">
    <path class="ap-tail" d="M123 43q16 1 16 18l2 18q1 9-6 9-6 0-5-9l-3-22-9-6" fill="#282534" stroke="#645c7b" stroke-width="1.5"/>
    <path d="M19 48C14 33 36 27 68 28c33 1 60 4 61 17v7H19Z" fill="#282534" stroke="#645c7b" stroke-width="1.5"/>
    <path d="M42 36c23-6 52-5 72 1" stroke="#464056" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M6 51C2 39 7 28 20 25L25 13l8 11h9l9-11 3 14c6 7 6 16 1 24Z" fill="#282534" stroke="#645c7b" stroke-width="1.5"/>
    <path d="M18 39q4 3 8 0m10 0q4 3 8 0" stroke="#e8b93a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M5 44l-16-2m16 5-16 2m65-5 13-2m-13 5 13 2" stroke="#b9b6c8" fill="none" stroke-linecap="round"/>
    <path d="M16 48h8v8h-8zm20 0h8v8h-8z" fill="#282534"/><g class="ap-tv-cat-fx" transform="translate(31 44)" pointer-events="none"/>
  </svg>`;

  function mount(root, actions) {
    const view = document.createElement('div'); view.className = 'ap';
    view.innerHTML = `<aside class="ap-rail" aria-label="Navegação da sala">
      <header class="ap-rail-head">
        <button type="button" class="ap-room-button" data-room-menu title="Menu da sala" aria-haspopup="menu"><span class="ap-room-mark"></span><span class="ap-room-label"><strong></strong><small></small></span>${I('chevronDown', 14)}</button>
      </header>
      <div class="ap-rail-scroll">
        <section aria-labelledby="ap-rooms-title"><h2 class="ap-label" id="ap-rooms-title">Cômodos</h2><div class="ap-rooms"></div></section>
        <section class="ap-wall-wrap" aria-labelledby="ap-walls-title"><h2 class="ap-label" id="ap-walls-title">Murais</h2><div class="ap-walls"></div></section>
        <section class="ap-lobby" aria-labelledby="ap-lobby-title" hidden><h2 class="ap-label" id="ap-lobby-title">Fora da call</h2><div class="ap-lobby-people"></div></section>
      </div>
      <footer class="ap-account"><button type="button" class="ap-profile" data-ap-profile title="Meu perfil"><span class="ap-profile-face"></span><span class="ap-profile-copy"><strong></strong><small></small></span></button>${button('settings', 'Configurações', 'settings', 'ap-square')}</footer>
    </aside>
    <div class="ap-content">
      <header class="ap-heading">
        <div class="ap-heading-copy"><h1></h1><p></p></div>
        <div class="ap-heading-actions">${button('home', 'Início', 'home', 'ap-square ap-quiet')}${button('invite', 'Convidar pessoas', 'userPlus', 'ap-quiet', 'Convidar')}${button('chat', 'Abrir mural', 'chat', 'ap-quiet', 'Mural')}</div>
      </header>
      <div class="ap-workarea">
        <section class="ap-center" aria-label="Maquete e transmissão">
          <div class="ap-display">
            <div class="ap-roomstage"><div class="ap-scene-holder"></div></div>
            <div class="ap-livestage" hidden>
              <div class="ap-screen-space"><div class="ap-screen">
                <div class="ap-picture"><video autoplay playsinline muted aria-label="Transmissão de tela"></video><div class="ap-connect" role="status">Conectando à transmissão…</div></div>${theaterCat}
              </div></div>
              <div class="ap-live-info"><div class="ap-live-line"><span class="ap-live-flag">Ao vivo</span><strong></strong></div><div class="ap-live-controls">${button('full', 'Tela cheia', 'maximize', 'ap-square')}${button('close-live', 'Parar de assistir', 'x', 'ap-square')}</div></div>
              <div class="ap-audience"></div>
            </div>
          </div>
          <div class="ap-watch" aria-label="Telas disponíveis" hidden></div>
          <div class="ap-tray">
            <button type="button" class="ap-join ap-button" data-ap-join>${I('volume', 19)}<span></span></button>
            <div class="ap-dock" aria-label="Controles da call" hidden>
              ${button('mute', 'Desligar microfone', 'mic', 'ap-hex-button')}${button('deafen', 'Desligar áudio', 'headphones', 'ap-hex-button')}${button('share', 'Transmitir tela', 'screen', 'ap-hex-button ap-share')}${button('dj', 'Abrir DJ', 'music', 'ap-hex-button')}${button('leave', 'Sair da call', 'phoneOff', 'ap-hex-button ap-leave')}
            </div>
          </div>
        </section>
        <aside class="ap-chat" id="ap-chat-panel" aria-label="Mural de mensagens" hidden>
          <header><div><span class="ap-label">Mural</span><h2></h2></div>${button('close-chat', 'Fechar mural', 'x', 'ap-square')}</header>
          <div class="ap-messages" role="log" aria-label="Mensagens recentes" aria-live="polite"></div>
          <form class="ap-composer"><input type="text" aria-label="Mensagem" placeholder="Escreva uma mensagem" autocomplete="off" enterkeyhint="send" maxlength="4000"><button type="submit" class="ap-button ap-submit" title="Enviar mensagem" aria-label="Enviar mensagem">${I('send', 18)}</button></form>
        </aside>
      </div>
    </div>`;
    root.append(view);
    const $ = (q) => view.querySelector(q);
    const ui = Object.fromEntries([
      'room-button', 'room-mark', 'room-label', 'rooms', 'walls', 'lobby', 'lobby-people', 'profile-face', 'profile-copy', 'heading', 'heading-copy',
      'roomstage', 'scene-holder', 'livestage', 'screen', 'picture', 'connect', 'tv-cat', 'watch', 'audience', 'live-info', 'tray', 'join', 'dock', 'chat', 'messages', 'composer',
    ].map(k => [k, $(`.ap-${k}`)]));
    const btn = Object.fromEntries(['chat', 'mute', 'deafen', 'share', 'dj', 'full', 'close-live'].map(k => [k, $(`[data-ap-${k}]`)]));
    const video = $('video'), input = $('.ap-composer input');
    video.muted = true;
    let model, currentRoom, currentLive, selectedLive = '', chatOpen = false, art, scene, pets, tokenLayer, audienceSVG, tvTarget;
    let artKey, watchKey, lobbyKey, profileKey, roomBadgeKey, chatKey, chatChannel, motionKey, streamState, audienceCount;
    let bulbs = [], lit = -1, lightTimer = 0;
    const clearLight = () => { clearTimeout(lightTimer); lightTimer = 0; bulbs[lit]?.classList.remove('ap-bulb-lit'); };
    function twinkle() {
      bulbs[lit]?.classList.remove('ap-bulb-lit');
      lit = (lit + 7) % bulbs.length;
      bulbs[lit].classList.add('ap-bulb-lit');
      lightTimer = setTimeout(twinkle, 950);
    }
    const roomNodes = new Map(), textNodes = new Map(), roomTokens = new Map(), liveTokens = new Map(), poll = new AbortController();
    const { signal } = poll;
    const on = (el, event, fn) => el.addEventListener(event, fn, { signal });
    const catClear = petReaction(ui['tv-cat'], $('.ap-tv-cat-fx'), 'cat');

    function changeChat(open, focus = false) {
      chatOpen = open;
      ui.chat.hidden = !open;
      btn.chat.setAttribute('aria-expanded', String(open));
      btn.chat.setAttribute('aria-controls', 'ap-chat-panel');
      btn.chat.setAttribute('aria-label', open ? 'Fechar mural' : 'Abrir mural');
      btn.chat.title = open ? 'Fechar mural' : 'Abrir mural';
      view.classList.toggle('ap-chat-open', open);
      if (open) { updateChat(); if (focus && !input.disabled) input.focus(); }
      else if (focus) btn.chat.focus();
    }
    function activate(type, el, ev) {
      switch (type) {
        case 'room-menu': actions.roomMenu(el); break;
        case 'home': actions.home(); break;
        case 'profile': actions.profile(); break;
        case 'settings': actions.settings(); break;
        case 'invite': actions.invite(); break;
        case 'voice': actions.joinVoice(el.dataset.apVoice); break;
        case 'join': if (currentRoom) actions.joinVoice(currentRoom.id); break;
        case 'leave': actions.leaveVoice(); break;
        case 'mute': actions.toggleMute(); break;
        case 'deafen': actions.toggleDeafen(); break;
        case 'share': actions.toggleShare(); break;
        case 'dj': actions.openDJ(); break;
        case 'chat': changeChat(!chatOpen, true); break;
        case 'close-chat': changeChat(false, true); break;
        case 'text': changeChat(true); actions.selectText(el.dataset.apText); break;
        case 'uid': {
          const r = el.getBoundingClientRect();
          const anchor = ev.type === 'keydown' || (ev.type === 'click' && ev.detail === 0) ? {
            clientX: r.left + r.width / 2, clientY: r.bottom,
            preventDefault: () => ev.preventDefault(), stopPropagation: () => ev.stopPropagation(),
          } : ev;
          actions.userMenu(anchor, el.dataset.uid); break;
        }
        case 'watch': {
          const uid = el.dataset.apWatch, item = model.live.find(l => String(l.uid) === uid);
          if (!item) break;
          selectedLive = uid;
          if (!item.me && !item.watching) actions.watch(item.uid, true);
          else updateLive();
          break;
        }
        case 'close-live':
          if (currentLive?.me) { selectedLive = ''; actions.toggleShare(); }
          else if (currentLive) { selectedLive = ''; actions.watch(currentLive.uid, false); }
          break;
        case 'full': if (video.videoWidth) actions.fullscreen(video); break;
      }
    }
    const controls = '[data-room-menu],[data-uid],[data-ap-home],[data-ap-profile],[data-ap-settings],[data-ap-invite],[data-ap-voice],[data-ap-join],[data-ap-leave],[data-ap-mute],[data-ap-deafen],[data-ap-share],[data-ap-dj],[data-ap-chat],[data-ap-close-chat],[data-ap-text],[data-ap-watch],[data-ap-close-live],[data-ap-full]';
    function click(ev) {
      const el = ev.target.closest(controls);
      if (!el || el.disabled) return;
      const attr = el.getAttributeNames().find(k => k === 'data-room-menu' || k === 'data-uid' || (k.startsWith('data-ap-') && controls.includes(`[${k}]`)));
      activate(attr === 'data-room-menu' ? 'room-menu' : attr === 'data-uid' ? 'uid' : attr.slice(8), el, ev);
    }
    on(view, 'click', click);
    on(view, 'contextmenu', (ev) => { if (ev.target.closest('[data-uid]')) { ev.preventDefault(); click(ev); } });
    on(view, 'keydown', (ev) => {
      if (ev.defaultPrevented) return;
      if (ev.key === 'Escape' && ui.chat.contains(ev.target)) { ev.preventDefault(); changeChat(false, true); }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target instanceof SVGElement && ev.target.matches('[data-uid],[data-ap-watch]')) { ev.preventDefault(); click(ev); }
    });
    on(ui.composer, 'submit', (ev) => {
      ev.preventDefault(); const value = input.value.trim();
      if (value && !input.disabled && actions.send(value)) input.value = '';
    });

    function toggleButton(el, active, label, iconName) {
      setAttr(el, 'aria-pressed', active);
      if (el.title !== label) { el.title = label; setAttr(el, 'aria-label', label); el.innerHTML = I(iconName, 20); }
    }
    function updateRail() {
      const { room, me, lobby, voice, text, call } = model;
      const badge = [room.name, room.color, room.icon, room.code, room.about];
      if (!sameFields(roomBadgeKey, badge)) {
        roomBadgeKey = badge;
        ui['room-mark'].innerHTML = avatar({ name: room.name, color: room.color, avatar: room.icon }).replace(`<span>${e(initial(room.name))}</span>`, `<span>${e(initials(room.name))}</span>`);
        setText(ui['room-label'].firstElementChild, room.name || 'Sala');
        setText(ui['room-label'].lastElementChild, room.code || 'Menu da sala');
        ui['room-button'].title = room.about || 'Menu da sala';
      }
      const keep = new Set();
      let index = 0;
      for (const ch of voice) {
        const id = String(ch.id), kind = roomKind(ch.name), theme = KIND[kind]; keep.add(id);
        let item = roomNodes.get(id);
        if (!item) {
          const el = document.createElement('button'); el.type = 'button'; el.dataset.apVoice = id; el.className = 'ap-room-tile';
          el.innerHTML = '<svg class="ap-mini" aria-hidden="true"></svg><strong></strong><small></small>';
          roomNodes.set(id, item = { el, mini: el.firstElementChild, name: el.children[1], status: el.lastElementChild });
        }
        const { el, mini } = item;
        if (item.kind !== kind) {
          const tiny = iso.miniature(kind, theme.color);
          mini.setAttribute('viewBox', tiny.vb);
          mini.innerHTML = `${tiny.svg}<polygon class="ap-mini-outline" points="${tiny.sil}" fill="none" stroke-width="7" stroke-linejoin="round"/>`;
          item.kind = kind;
        }
        const here = !!ch.here || !!(call.joined && ch.id === call.channel);
        const active = ch === currentRoom;
        el.classList.toggle('ap-room-active', active); setAttr(el, 'aria-current', active ? 'location' : 'false');
        const status = here ? `${ch.users.length} na call` : ch.users.length ? countPeople(ch.users.length) : 'Vazio';
        el.classList.toggle('ap-room-occupied', !!ch.users.length);
        setText(item.name, ch.name); setText(item.status, status);
        setAttr(el, 'aria-label', `Canal de voz ${ch.name}, ${countPeople(ch.users.length)}${here ? ', você está nele' : ''}`);
        if (ui.rooms.children[index] !== el) ui.rooms.insertBefore(el, ui.rooms.children[index] || null);
        index++;
      }
      for (const [id, item] of roomNodes) if (!keep.has(id)) { item.el.remove(); roomNodes.delete(id); }
      keep.clear(); index = 0;
      for (const ch of text) {
        const id = String(ch.id); keep.add(id);
        let el = textNodes.get(id);
        if (!el) {
          el = document.createElement('button'); el.className = 'ap-wall'; el.type = 'button'; el.dataset.apText = id;
          el.innerHTML = `${I('hash', 15)}<span></span><i></i>`; textNodes.set(id, el);
        }
        setText(el.children[1], ch.name); el.classList.toggle('ap-wall-active', !!ch.active);
        setAttr(el, 'aria-current', ch.active ? 'true' : 'false');
        el.classList.toggle('ap-unread', !!ch.unread); setAttr(el, 'aria-label', `Canal de texto ${ch.name}${ch.unread ? ', mensagens novas' : ''}`);
        if (ui.walls.children[index] !== el) ui.walls.insertBefore(el, ui.walls.children[index] || null);
        index++;
      }
      for (const [id, el] of textNodes) if (!keep.has(id)) { el.remove(); textNodes.delete(id); }
      btn.chat.classList.toggle('ap-unread', text.some(ch => ch.unread));
      const waiting = lobby.flatMap(u => [u.id, u.name, u.color, u.nameColor, u.avatar]);
      if (!sameFields(lobbyKey, waiting)) {
        lobbyKey = waiting; ui.lobby.hidden = !lobby.length;
        ui['lobby-people'].innerHTML = lobby.map(u => `<button type="button" class="ap-lobby-user" data-uid="${e(u.id)}" title="${e(u.name)}" aria-label="Opções de ${e(u.name)}">${avatar(u)}<span style="color:${e(window.readableColor?.(u.nameColor || u.color, ['#0b0638', '#33256a']) || '')}">${e(u.name)}</span></button>`).join('');
      }
      const pf = [me?.name, me?.color, me?.avatar];
      if (!sameFields(profileKey, pf)) { profileKey = pf; ui['profile-face'].innerHTML = avatar(me); }
      setText(ui['profile-copy'].firstElementChild, me?.name || 'Meu perfil');
      setText(ui['profile-copy'].lastElementChild, call.joined ? 'Na call' : 'Disponível');
    }

    function updateTokens(layer, pool, occupants, locate, liveRow = false) {
      const present = new Set(), compact = !liveRow && occupants.length > 4;
      occupants.forEach((p, i) => {
        const uid = String(p.id); present.add(uid);
        let t = pool.get(uid);
        if (!t) { t = newToken(p, liveRow); pool.set(uid, t); layer.append(t.g); }
        patchToken(t, p, compact);
        const [x, y, seat] = locate(p, i);
        setAttr(t.g, 'transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})${compact ? ' scale(.87)' : ''}`);
        if (!liveRow) setAttr(t.g, 'data-seat', seat);
      });
      for (const [uid, t] of pool) if (!present.has(uid)) { t.g.remove(); pool.delete(uid); }
    }
    function updateScene(kind, people) {
      const c = color(model.room.color, KIND[kind].color), ini = initials(model.room.name), key = `${kind}|${c}|${ini}`;
      if (key !== artKey) {
        artKey = key; pets?.stop(); pets = null; roomTokens.clear();
        art = iso.room(kind, { color: c, ini: e(ini), ink: ink(c) });
        scene = svgEl('svg', { class: 'ap-scene', viewBox: art.vb, 'aria-label': `Maquete: ${KIND[kind].name}` });
        scene.innerHTML = art.svg;
        tvTarget = null;
        if (kind === 'lounge' || kind === 'cinema') {
          const [x, y] = iso.P(kind === 'lounge' ? 5.65 : 6.1, 0.23, kind === 'lounge' ? 4.05 : 5.17);
          tvTarget = svgEl('g', { class: 'ap-tv-watch', transform: `translate(${x} ${y})`, role: 'button', tabindex: 0, hidden: '' });
          tvTarget.innerHTML = '<rect x="-39" y="-12" width="78" height="24" rx="8"/><path d="M-29 -4l7 4-7 4z"/><text x="-17" y="4">Assistir</text>';
          scene.append(tvTarget);
        }
        tokenLayer = svgEl('g', { class: 'ap-people' }); scene.append(tokenLayer);
        clearLight();
        ui['scene-holder'].replaceChildren(scene);
        bulbs = Array.from(scene.querySelectorAll('.ap-bulb')); lit = -1;
        if (kind === 'lounge') pets = animatePets(scene, art, () => [...roomTokens.values()].map(t => t.g));
        motionKey = '';
      }
      const streamer = art.streamSeat && people.find(p => p.sharing);
      let nextSeat = 0;
      updateTokens(tokenLayer, roomTokens, people, (person) => {
        const i = person === streamer ? -1 : nextSeat++;
        const area = STANDING[kind] || EXTRA_SEATS;
        const pos = i === -1 ? art.streamSeat : art.seats[i] || area[i - art.seats.length] || [3 + ((i - art.seats.length) % 5) * 1.48, 10.4, 0];
        return [...iso.P(...pos), i];
      });
    }

    function resizeVideo() {
      const ready = !!(video.videoWidth && video.videoHeight && currentLive?.stream && video.srcObject === currentLive.stream);
      if (ready) ui.screen.style.setProperty('--ap-ratio', video.videoWidth / video.videoHeight);
      ui.picture.classList.toggle('ap-video-ready', ready);
      btn.full.disabled = !ready;
    }
    on(video, 'resize', resizeVideo);
    on(video, 'loadedmetadata', resizeVideo);
    on(video, 'emptied', resizeVideo);
    function updateLive() {
      const entries = model.live, available = entries.filter(l => l.watching);
      if (!entries.some(l => String(l.uid) === selectedLive)) selectedLive = '';
      currentLive = available.find(l => String(l.uid) === selectedLive) || available.find(l => !l.me) || available[0];
      ui.livestage.hidden = !currentLive; ui.roomstage.hidden = !!currentLive;
      const stream = currentLive?.stream || null;
      if (stream !== streamState) {
        streamState = stream;
        video.srcObject = stream;
        ui.picture.classList.remove('ap-video-ready');
        btn.full.disabled = true;
      }
      if (currentLive) {
        setText(ui['live-info'].querySelector('strong'), currentLive.me ? 'Sua tela' : currentLive.name);
        const label = currentLive.me ? 'Parar transmissão' : 'Parar de assistir';
        setAttr(btn['close-live'], 'aria-label', label); btn['close-live'].title = label;
      }
      const visible = entries.filter(l => l !== currentLive);
      if (tvTarget) {
        const invitation = !currentLive && visible[0];
        tvTarget.toggleAttribute('hidden', !invitation);
        if (invitation) {
          setAttr(tvTarget, 'data-ap-watch', invitation.uid);
          setAttr(tvTarget, 'aria-label', `Assistir à tela de ${invitation.name}`);
        }
      }
      const k = JSON.stringify(visible.map(l => [l.uid, l.name, l.me, l.watching]));
      if (k !== watchKey) {
        watchKey = k; ui.watch.hidden = !visible.length;
        ui.watch.innerHTML = visible.map(l => {
          const who = l.me ? 'Sua tela' : l.name;
          return `<button type="button" class="ap-button" data-ap-watch="${e(l.uid)}" title="${e(l.watching ? 'Exibir ' + who : 'Assistir à tela de ' + who)}">${I(l.watching ? 'screen' : 'play', 16)}<span>${l.watching ? 'Exibir' : 'Assistir'} <strong>${e(who)}</strong></span></button>`;
        }).join('');
      }
      syncMotion();
    }
    function updateAudience(occupants) {
      if (ui.livestage.hidden) return;
      const n = occupants.length;
      ui.audience.hidden = !n;
      if (n !== audienceCount) {
        audienceCount = n; liveTokens.clear();
        audienceSVG = svgEl('svg', { viewBox: `0 -62 ${Math.max(n, 1) * 72} 94`, 'aria-label': 'Pessoas na call' });
        if (n) audienceSVG.innerHTML = iso.audience(n);
        ui.audience.style.setProperty('--ap-audience-width', `${n * 76}px`);
        ui.audience.replaceChildren(audienceSVG);
      }
      updateTokens(audienceSVG, liveTokens, occupants, (_, i) => [36 + 72 * i, 0], true);
    }

    function updateChat() {
      if (!model || !chatOpen) return;
      const { channel, messages } = model.chat;
      const recent = messages.slice(-9);
      const next = JSON.stringify([channel?.id, recent.map(m => [m.id, m.name, m.text, m.me, m.bot, m.system, m.files])]);
      setText(ui.chat.querySelector('h2'), channel ? `#${channel.name}` : 'Sem canal de texto');
      input.disabled = !channel; ui.composer.lastElementChild.disabled = !channel;
      if (next !== chatKey) {
        const change = chatChannel !== channel?.id;
        const follow = change || ui.messages.scrollHeight - ui.messages.clientHeight - ui.messages.scrollTop < 32;
        chatChannel = channel?.id; chatKey = next;
        if (change) input.value = '';
        const nodes = recent.map(m => {
          const el = document.createElement('article'); el.className = `ap-message${m.system ? ' ap-system' : m.me ? ' ap-mine' : ''}`;
          el.innerHTML = '<strong></strong><div class="ap-message-text"></div>';
          setText(el.firstElementChild, m.system ? 'Sala' : m.me ? 'Você' : m.name || (m.bot ? 'DJ' : 'Alguém'));
           if (!m.system) el.firstElementChild.style.color = window.readableColor?.(m.nameColor || m.color, ['#282053', '#352867']) || '';
          setText(el.lastElementChild, [m.text, m.files ? `📎 ${m.files} ${m.files === 1 ? 'anexo' : 'anexos'}` : ''].filter(Boolean).join('\n'));
          return el;
        });
        if (!nodes.length) { const empty = document.createElement('p'); empty.className = 'ap-chat-empty'; empty.textContent = channel ? 'Nenhuma mensagem por aqui ainda.' : 'Selecione um mural para conversar.'; nodes.push(empty); }
        ui.messages.replaceChildren(...nodes);
        if (follow) ui.messages.scrollTop = ui.messages.scrollHeight;
      }
    }
    function syncMotion() {
      const reduced = !!model?.reduceMotion;
      const paused = document.hidden || document.documentElement.classList.contains('bg-paused');
      const halt = paused || !ui.livestage.hidden;
      const next = `${reduced}|${paused}|${halt}`;
      if (motionKey === next) return;
      motionKey = next;
      view.classList.toggle('ap-no-motion', reduced || paused);
      if (paused) catClear();
      // Um ponto por vez, em vez de dezenas de animações repintando o SVG em paralelo.
      if (reduced || halt) clearLight();
      else if (bulbs.length && !lightTimer) lightTimer = setTimeout(twinkle, 650);
      pets?.motion(reduced, halt);
    }
    const observer = new MutationObserver(syncMotion);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    on(document, 'visibilitychange', syncMotion);
    on(reducedSystem, 'change', syncMotion);

    return {
      update(next) {
        model = next;
        const { call, voice } = model;
        currentRoom = voice.find(ch => ch.here || (call.joined && ch.id === call.channel)) || voice[0];
        const people = currentRoom?.users || [], kind = roomKind(currentRoom?.name);
        const title = currentRoom?.name || 'Sala de estar';
        setText(ui['heading-copy'].firstElementChild, title);
        setText(ui['heading-copy'].lastElementChild, call.joined ? `${countPeople(people.length)} na call` : currentRoom ? (people.length ? `${countPeople(people.length)} na call · você está fora` : 'Você está fora da call') : 'Nenhum canal de voz nesta sala');
        ui.join.hidden = !!call.joined || !currentRoom;
        setText(ui.join.lastElementChild, `Entrar em ${title}`);
        ui.dock.hidden = !call.joined;
        toggleButton(btn.mute, !!call.muted, call.muted ? 'Ligar microfone' : 'Desligar microfone', call.muted ? 'micOff' : 'mic');
        toggleButton(btn.deafen, !!call.deafened, call.deafened ? 'Ligar áudio' : 'Desligar áudio', call.deafened ? 'headphonesOff' : 'headphones');
        toggleButton(btn.share, !!call.sharing, call.sharing ? 'Parar transmissão' : 'Transmitir tela', call.sharing ? 'screenOff' : 'screen');
        if (btn.share.disabled !== !call.canShare) btn.share.disabled = !call.canShare;
        setAttr(btn.dj, 'aria-pressed', !!call.dj); if (btn.dj.disabled !== !call.djAvailable) btn.dj.disabled = !call.djAvailable;
        updateScene(kind, people);
        updateRail(); updateLive();
        const liveRoom = !call.joined && currentLive && voice.find(ch => ch.users.some(u => u.id === currentLive.uid));
        updateAudience(liveRoom ? liveRoom.users : people);
        updateChat();
      },
      shortcut(a) { if (a === 'chat') changeChat(!chatOpen, true); if (a === 'liveFull' && video.videoWidth) actions.fullscreen(video)?.catch?.(() => {}); },
      speaking(ids) {
        for (const pool of [roomTokens, liveTokens]) for (const [id, token] of pool) token.g.classList.toggle('ap-is-speaking', ids.has(id));
      },
      stop() {
        poll.abort(); observer.disconnect(); pets?.stop(); clearLight(); catClear(); video.srcObject = null;
        roomTokens.clear(); liveTokens.clear(); view.remove();
      },
    };
  }

  let apartment;
  window.ResenhaSkins.register('ape', {
    mount(root, actions) { apartment = mount(root, actions); },
    update(model) { apartment?.update(model); },
    speaking(ids) { apartment?.speaking(ids); },
    shortcut(a) { apartment?.shortcut(a); },
    unmount() { apartment?.stop(); apartment = null; },
  });
})();
