const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('launcherNative', {
  ready: () => ipcRenderer.invoke('launcher:ready'),
  action: (action, payload) => ipcRenderer.invoke('launcher:action', action, payload),
  rooms: () => ipcRenderer.invoke('launcher:rooms'),
  onState: callback => { const listener = (event, state) => callback(state); ipcRenderer.on('launcher:state', listener); return () => ipcRenderer.removeListener('launcher:state', listener); }
});
