const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pickRegion', {
  onInit: (fn) => {
    ipcRenderer.on('pick-init', (_, data) => fn(data))
  },
  done: (base64Png) => ipcRenderer.send('region-picked', base64Png),
  cancel: () => ipcRenderer.send('region-cancel'),
})
