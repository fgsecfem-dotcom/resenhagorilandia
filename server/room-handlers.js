function createRoomHandlers({ roomStore }) {
  return {
    locations: () => ({snapshots:roomStore.root,backups:roomStore.backups}),
    list: () => roomStore.list(),
    save: (snap) => {if(JSON.stringify(snap).length>2*1024*1024)throw Error('Cópia excede o limite.');return roomStore.save(snap);},
  };
}
module.exports = { createRoomHandlers };
