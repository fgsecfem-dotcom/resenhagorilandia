// Runs in <head>, before the first paint: when the desktop app will open a server on start
// (favourite, else the last one), show the loading screen instead of flashing the home screen.
// client.js removes html.booting once the server opens or the attempt fails.
(function () {
  try {
    if (!window.resenhaNative?.rooms) return;
    const get = (k) => { try { return JSON.parse(localStorage.getItem('resenha.' + k)); } catch { return null; } };
    if (!String(get('profile')?.name || '').trim()) return;
    const fav = get('favoriteRoom'), last = get('lastRoom');
    const name = fav ? get('favoriteRoomName') : last?.code ? last.name : null;
    if (!fav && !last?.code) return;
    document.documentElement.classList.add('booting');
    window.__resenhaBootName = String(name || '');
  } catch {}
})();
