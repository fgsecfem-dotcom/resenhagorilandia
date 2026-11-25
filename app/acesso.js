// Navegação por teclado fora das Configurações.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const visible = (e) => !e.disabled && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  function clickAt(el, type = 'click') {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.bottom, button: type === 'contextmenu' ? 2 : 0 }));
  }

  // ---------- lista de canais e pessoas: um Tab entra, setas andam, Enter abre ----------
  const ITEMS = '#voice-channels .channel, #voice-channels .vu, #text-channels .channel, #online-users .ou';
  let curKey = '', focusKey = '';
  const keyOf = (el) => el?.dataset.vch || el?.dataset.ch || (el?.dataset.uid ? (el.closest('#online-users') ? 'o:' : 'v:') + el.dataset.uid : '');
  const visibleItems = () => $$(ITEMS).filter((el) => el.offsetParent !== null);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function labelOf(el) {
    if (el.classList.contains('channel')) {
      const name = $('.cn', el)?.textContent.trim() || '';
      if (el.dataset.vch !== undefined) {
        const who = el.nextElementSibling?.classList.contains('voice-users') ? el.nextElementSibling.children.length : 0;
        return `Canal de voz ${name}, ${plural(who, 'pessoa', 'pessoas')}` + (el.classList.contains('connected') ? ', você está nele' : '') + (el.classList.contains('is-live') ? ', com transmissão ao vivo' : '');
      }
      return `Canal de texto ${name}` + (el.classList.contains('unread') && !el.classList.contains('active') ? ', mensagens novas' : '');
    }
  }
  function decorate() {
    const nav = $('#channels'); if (nav && !nav.hasAttribute('role')) { nav.setAttribute('role', 'group'); nav.setAttribute('aria-label', 'Canais e pessoas'); }
    for (const row of $$('#channels .vu, #channels .ou')) {
      row.setAttribute('role', 'button');
      const name = ($('.nm', row) || $('span:not(.avatar)', row))?.textContent.replace(/BOT$/, '').trim();
      row.setAttribute('aria-label', `${name}, ${row.classList.contains('vu') ? 'na call' : 'na sala, fora da call'}`);
    }
    const list = $$(ITEMS); if (!list.length) return;
    if (!list.some((el) => keyOf(el) === curKey)) curKey = keyOf(list.find((el) => el.classList.contains('active') || el.classList.contains('connected')) || list[0]);
    for (const el of list) {
      el.setAttribute('role', 'button'); el.tabIndex = keyOf(el) === curKey ? 0 : -1; if (el.classList.contains('channel')) el.setAttribute('aria-label', labelOf(el));
      if (el.classList.contains('channel')) { if (el.classList.contains('active') || el.classList.contains('connected')) el.setAttribute('aria-current', el.dataset.vch !== undefined ? 'true' : 'page'); else el.removeAttribute('aria-current'); }
      const edit = $('.ch-edit', el); if (edit) edit.tabIndex = -1; // editar canal: tecla de menu (ou Shift+F10) no item
    }
    // a lista foi redesenhada com o foco dentro dela: devolve o foco ao mesmo item
    if (focusKey && document.activeElement === document.body) { const again = list.find((el) => keyOf(el) === focusKey); if (again) again.focus({ preventScroll: true }); }
  }
  let decorateQueued = false;
  const decorateSoon = () => { if (decorateQueued) return; decorateQueued = true; requestAnimationFrame(() => { decorateQueued = false; decorate(); }); };
  function setCurrent(el) { curKey = keyOf(el); for (const x of visibleItems()) x.tabIndex = keyOf(x) === curKey ? 0 : -1; }
  function onChannelKey(e) {
    const el = e.target;
    if (e.defaultPrevented || !el.matches?.(`${ITEMS}, #channels .vu, #channels .ou, #cc-mute, #cc-deafen, #call .tile[data-key]`)) return;
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault(); clickAt(el, 'contextmenu'); return;
    }
    if (el.matches('button')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickAt(el); return; }
    if (!el.matches(ITEMS)) return;
    const list = visibleItems(), i = list.indexOf(el); let to = -1;
    if (e.key === 'ArrowDown') to = Math.min(list.length - 1, i + 1);
    else if (e.key === 'ArrowUp') to = Math.max(0, i - 1);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = list.length - 1;
    if (to < 0) return;
    e.preventDefault(); if (to !== i) { setCurrent(list[to]); list[to].focus(); }
  }

  const skinGroups = [
    ['.ap-rooms', '.ap-room-tile'], ['.ap-walls', '.ap-wall'], ['.cd-voice', '.cd-rib:not(.cd-home)'],
    ['.cd-text', '.cd-rib'], ['.sn-rows', '.sn-row'], ['.sn-tune', '.sn-tune-button'],
    ['.mg-voice-list', '.mg-voice-row'], ['.mg-chat-tabs', '.mg-text-tab'],
  ];
  const current = new WeakMap();
  function skinItems(group, selector) {
    const all = $$(selector, group), items = all.filter(el => !el.disabled && !el.hidden);
    const chosen = items.includes(current.get(group)) ? current.get(group) : items.find(el => el.matches('[aria-current]:not([aria-current="false"])')) || items[0];
    for (const el of all) el.tabIndex = el === chosen ? 0 : -1;
    current.set(group, chosen);
    return items;
  }
  function syncSkinChannels(root) {
    for (const [sel, item] of skinGroups) for (const group of $$(sel, root)) skinItems(group, item);
  }
  function skinNav(e) {
    if (e.defaultPrevented || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const pair = skinGroups.find(([sel, item]) => e.target.matches?.(item) && e.target.closest(sel));
    if (!pair) return;
    const group = e.target.closest(pair[0]), items = skinItems(group, pair[1]).filter(visible), at = items.indexOf(e.target);
    if (at < 0) return;
    const delta = ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 1;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (at + delta + items.length) % items.length;
    e.preventDefault(); current.set(group, items[to]); skinItems(group, pair[1]); items[to].focus();
  }

  const controls = (el) => $$('button, a[href], input, textarea, select, [tabindex]', el).filter(visible);
  function cycle(el, e, delta, items = controls(el)) {
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    items[i < 0 ? (delta === 1 ? 0 : items.length - 1) : (i + delta + items.length) % items.length]?.focus();
  }
  const originFor = (el) => el?.closest?.('button, a[href], [role="button"], [tabindex]') || document.activeElement;
  function restore(el) {
    if (!el?.isConnected && keyOf(el)) el = $$(ITEMS).find((item) => keyOf(item) === keyOf(el));
    if (el?.isConnected && visible(el)) el.focus({ preventScroll: true });
  }
  function contextMenu(menu, close) {
    const mixed = !!$('.pcard, input', menu);
    menu.setAttribute('role', mixed ? 'dialog' : 'menu');
    menu.setAttribute('aria-label', $('.pcard', menu) ? 'Opções da pessoa' : $('.ctx-title', menu)?.textContent || 'Opções');
    menu.tabIndex = -1;
    for (const el of $$('.ctx-item:not(label)', menu)) { el.setAttribute('role', mixed ? 'button' : 'menuitem'); el.tabIndex = -1; }
    (controls(menu)[0] || menu).focus({ preventScroll: true });
    menu.onkeydown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'Tab') cycle(menu, e, e.shiftKey ? -1 : 1);
      else if (!mixed && ['ArrowDown', 'ArrowUp'].includes(e.key)) cycle(menu, e, e.key === 'ArrowDown' ? 1 : -1);
      else if (['Enter', ' '].includes(e.key) && e.target.matches('.ctx-item:not(label, button)')) { e.preventDefault(); e.target.click(); }
    };
  }

  let pending = [], announcementTimer;
  function announce(text) {
    if (!text) return;
    pending.push(text); clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => {
      const status = $('#sr-live'), text = pending.join(' '); pending = [];
      status.textContent = '';
      requestAnimationFrame(() => { status.textContent = text; });
    }, 60);
  }
  function replaceLog(log, update) {
    log.setAttribute('aria-live', 'off');
    update();
    requestAnimationFrame(() => requestAnimationFrame(() => log.setAttribute('aria-live', 'polite')));
  }
  function iconLabels(root) {
    const selector = 'button, [role="button"]';
    for (const button of [...(root.matches(selector) ? [root] : []), ...$$(selector, root)]) {
      if (button.closest('.modal:has(#st-ver)') || button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby') || button.textContent.trim()) continue;
      const label = button.title || button.dataset.tip || (button.hasAttribute('data-close') ? 'Fechar' : '');
      if (label) button.setAttribute('aria-label', label);
    }
  }

  function init() {
    iconLabels(document.body);
    const labels = new MutationObserver(records => {
      for (const m of records) for (const el of m.addedNodes) if (el.nodeType === 1) iconLabels(el);
    });
    labels.observe(document.body, { childList: true, subtree: true });
    const observer = new MutationObserver(decorateSoon);
    for (const list of $$('#voice-channels, #text-channels, #online-users')) observer.observe(list, { childList: true });
    decorate();
    document.addEventListener('keydown', onChannelKey);
    document.addEventListener('keydown', skinNav, true);
    document.addEventListener('focusin', (e) => { focusKey = e.target.matches?.(ITEMS) ? keyOf(e.target) : ''; if (focusKey) setCurrent(e.target); });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.(ITEMS)) focusKey = ''; }, true);
  }
  window.ResenhaA11y = { syncSkinChannels, controls, cycle, originFor, restore, contextMenu, announce, replaceLog };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
