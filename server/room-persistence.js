function persistRoomFiles({ history, files, channels, roomCode, roomState, historyFile, filesIndex, channelsFile, identityFile, roomId, roomName, roomIcon, roomLook, revision, snapshotLineage, snapshotNow, log, DISK_HISTORY_LIMIT }) {
    try {
      for (const k of Object.keys(history)) if (history[k].length > DISK_HISTORY_LIMIT) history[k] = history[k].slice(-DISK_HISTORY_LIMIT);
      roomState.atomic(historyFile,history);roomState.atomic(filesIndex,files);roomState.atomic(channelsFile,channels);
      if(roomCode){const snap=snapshotNow();roomState.atomic(identityFile,{schema:1,roomId,code:roomCode,name:roomName,icon:roomIcon||'',look:roomLook||{},revision,lineage:snapshotLineage,configuration:snap.configuration});}
    } catch (e) { log('erro salvando', e.message); }
}
module.exports = { persistRoomFiles };
