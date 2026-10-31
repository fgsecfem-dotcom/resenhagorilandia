const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ilha', {
  onMsg: (fn) => ipcRenderer.on('overlay:msg', (e, m) => fn(m)),
  size: (w, h) => ipcRenderer.send('overlay:size', { w, h }),
  action: (a) => ipcRenderer.send('overlay:action', a),
  drag: (d) => ipcRenderer.send('overlay:drag', d),
});
