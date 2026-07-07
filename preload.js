const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('mdboxAPI', {
    // Convert files
    convert: (params) => ipcRenderer.invoke('app:convert', params),
    selectDirectory: () => ipcRenderer.invoke('app:select-directory'),

    // Settings
    getSettings: () => ipcRenderer.invoke('app:get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('app:save-settings', settings),

    // Queue
    getQueue: () => ipcRenderer.invoke('app:get-queue'),
    cancelAll: () => ipcRenderer.invoke('app:cancel-all'),

    // Config
    getConfig: () => ipcRenderer.invoke('app:get-config'),

    // File path helper
    getPathForFile: (file) => webUtils.getPathForFile(file),

    // Queue events
    onQueueEvent: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('queue:event', listener);
        return () => ipcRenderer.removeListener('queue:event', listener);
    },
});
