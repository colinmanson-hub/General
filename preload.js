const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  savePng: (dataUrl) => ipcRenderer.invoke('save-png', dataUrl),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  requestSystemAudio: () =>
    navigator.mediaDevices.getDisplayMedia({ audio: true, video: true }),
});
