const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('launcherNative', {
  ready: () => ipcRenderer.invoke('launcher:ready'),
  action: action => ipcRenderer.invoke('launcher:action', action),
  onState: callback => { const listener = (event, state) => callback(state); ipcRenderer.on('launcher:state', listener); return () => ipcRenderer.removeListener('launcher:state', listener); }
});
