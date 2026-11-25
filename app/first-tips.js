// A primeira sala tem três dicas, sem travar a interface nem tomar o foco de ninguém.
(() => {
  const KEY = 'resenha.firstRoomTips';
  const tips = [
    { title: 'Entre na call', text: 'Abra um canal de voz para falar com a galera.', anchors: '#call [data-join] .btn, [data-ap-join], .cd-enter, .mg-voice button, [data-vch]', done: () => !!window.__resenha?.V?.joined },
    { title: 'Chame a galera', text: 'Use Convidar para mandar o código ou o link da sala.', anchors: '#btn-invite, [data-ap-invite], .sn-invite, .cd-invite, .mg-invite' },
    { title: 'Assista à live', text: 'Escolha a transmissão de quem está ao vivo para ver a tela.', anchors: '#call button.live-join, #call [data-watch], button[data-ap-watch], .sn-watch, .cd-watch, .mg-watch', done: () => (window.__resenha?.V?.watching?.size || 0) > 0 },
  ];
  let step = null, timer = null, box = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null && /^[0-3]$/.test(raw)) step = Number(raw);
  } catch {}
  function save(n) { step = n; try { localStorage.setItem(KEY, String(n)); } catch {} }
  function detach() { box?.remove(); box = null; }
  function stop() { if (timer !== null) { clearInterval(timer); timer = null; } detach(); }
  function place(target) {
    const r = target?.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    let left = innerWidth - w - 16, top = innerHeight - h - 88, side = '';
    if (r && r.width && r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) {
      const cx = r.left + r.width / 2;
      if (r.right + 12 + w <= innerWidth - 8 && cx < innerWidth / 2) { side = 'right'; left = r.right + 12; top = (r.top + r.bottom - h) / 2; }
      else if (r.top - 12 - h > 8) { side = 'top'; left = cx - w / 2; top = r.top - h - 12; }
      else if (r.bottom + 12 + h <= innerHeight - 8) { side = 'bottom'; left = cx - w / 2; top = r.bottom + 12; }
    }
    left = Math.max(8, Math.min(innerWidth - w - 8, left)); top = Math.max(8, Math.min(innerHeight - h - 8, top));
    // Nunca em cima de uma live ou de um vídeo: nesse caso vai para o canto, acima do dock.
    const hit = [...document.querySelectorAll('#call video, #call .tile.screen')].some((v) => { const q = v.getBoundingClientRect(); return q.width && left < q.right && left + w > q.left && top < q.bottom && top + h > q.top; });
    if (hit) { left = innerWidth - w - 16; top = innerHeight - h - 96; side = ''; }
    box.style.left = left + 'px'; box.style.top = top + 'px'; box.dataset.side = side;
    if (r && side) {
      box.style.setProperty('--ft-x', Math.max(16, Math.min(w - 16, (r.left + r.right) / 2 - left)) + 'px');
      box.style.setProperty('--ft-y', Math.max(16, Math.min(h - 16, (r.top + r.bottom) / 2 - top)) + 'px');
    }
  }
  function show(tip, index) {
    box = document.createElement('div'); box.className = 'first-tip';
    box.innerHTML = '<div role="status"><b></b><span></span></div><div class="ft-row"><em></em><button type="button">Entendi</button></div>';
    box.querySelector('b').textContent = tip.title; box.querySelector('span').textContent = tip.text;
    box.querySelector('em').textContent = (index + 1) + ' de ' + tips.length;
    box.querySelector('button').onclick = () => { save(index + 1); detach(); if (step === tips.length) stop(); };
    document.body.append(box);
  }
  function tick() {
    if (document.visibilityState !== 'visible' || !document.querySelector('#main:not(.hidden)') || document.querySelector('.overlay .modal')) {
      if (box) box.hidden = true;
      return;
    }
    let tip = tips[step]; if (!tip) return stop();
    // A dica some sozinha quando a pessoa já fez o que ela ensina (entrou na call, abriu a live).
    while (tip && tip.done?.()) { save(step + 1); detach(); tip = tips[step]; }
    if (!tip) return stop();
    if (!box) show(tip, step);
    box.hidden = false;
    const target = tip.anchors.split(', ').map(sel => [...document.querySelectorAll(sel)].find(el => el.getBoundingClientRect().width > 0)).find(Boolean);
    place(target);
  }
  window.FirstTips = {
    prepare() { if (step === null) save(0); },
    arm() { if (timer === null && step !== null && step < tips.length) timer = setInterval(tick, 400); },
    finish() { if (timer !== null) { save(tips.length); stop(); } },
  };
})();
