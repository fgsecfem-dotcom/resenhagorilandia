// Room-scoped local DM history and contacts; never part of a public snapshot.
export function createDMStorage({ LS, dmRooms, dmStorageKey }) {
function dmHistory() { const key=dmStorageKey(); if (!dmRooms.has(key)) dmRooms.set(key,LS.get(key,{})); return dmRooms.get(key); }
function rememberContact(u) { const key = dmStorageKey() + '.contacts', contacts = LS.get(key, {}); contacts[u.id] = { id: u.id, name: u.name, color: u.color, avatar: u.avatar }; LS.set(key, contacts); }
  return { dmHistory, rememberContact };
}
