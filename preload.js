const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('companion', {
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),

  dragWindow: (delta) => ipcRenderer.send('drag-window', delta),

  askClaude: (payload) => ipcRenderer.invoke('ask-claude', payload),
  askAi: (payload) => ipcRenderer.invoke('ask-claude', payload),

  pickScreenRegion: () => ipcRenderer.invoke('pick-screen-region'),
})
