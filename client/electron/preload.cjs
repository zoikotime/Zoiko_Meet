/* eslint-disable */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('zoiko', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
  onUpdaterStatus: (cb) => {
    const listener = (_e, data) => cb(data)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
})
