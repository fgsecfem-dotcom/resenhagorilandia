// Hospedeiro dos temas com sala própria (2.6): Sintonia, Apê, Caderno e Mergulho.
// Cada tema chama ResenhaSkins.register('nome', { mount(root, actions), update(model), speaking(ids), unmount() }).
// - mount: monta o DOM dentro de root (um <div class="skin-root"> por cima de #main). Guarde actions; é a única saída para o app.
// - update: recebe o retrato da sala (client.js → skinModel) a cada mudança. Atualize só o que mudou (o retrato chega muitas vezes).
// - speaking: Set com os ids de quem fala agora; chamado várias vezes por segundo, então só troca classes.
// - unmount: pare timers, animações e <video> (srcObject = null). O root é removido depois.
// Regras: nada de mexer em S/V nem no DOM fora do root; animações param com "Reduzir animações" (model.reduceMotion)
// e com a janela escondida (html.bg-paused); a live sempre na proporção real do vídeo, sem barras e sem corte.
window.ResenhaSkins = (() => {
  const reg = new Map(); let cur = null, curName = '', root = null;
  const html = document.documentElement;
  function stop() {
    if (!cur) return;
    try { cur.unmount?.(); } catch (e) { console.error('[skin] unmount', curName, e); }
    root?.remove(); root = null; cur = null; curName = ''; delete html.dataset.skin;
  }
  function sync(theme, model, actions) {
    const skin = model && window.THEMES?.[theme]?.skin ? reg.get(theme) : null;
    if (cur && cur !== skin) stop();
    if (!skin) return;
    if (!cur) {
      root = document.createElement('div'); root.className = 'skin-root'; root.id = 'skin-root';
      document.getElementById('main').append(root); html.dataset.skin = theme;
      cur = skin; curName = theme;
      try { skin.mount(root, actions); } catch (e) { console.error('[skin] mount', theme, e); stop(); return; }
    }
    try { cur.update(model); window.ResenhaA11y?.syncSkinChannels(root); } catch (e) { console.error('[skin] update', theme, e); }
  }
  function speaking(ids) { try { cur?.speaking?.(ids); } catch (e) { console.error('[skin] speaking', curName, e); } }
  return { register: (name, skin) => reg.set(name, skin), has: (name) => reg.has(name), sync, speaking, stop, shortcut: (action) => cur?.shortcut?.(action), get active() { return curName; } };
})();
