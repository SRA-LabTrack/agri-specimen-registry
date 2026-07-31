const { contextBridge, ipcRenderer } = require("electron");

const UPDATE_STATE_CHANNEL = "agriregistry:update:state";

contextBridge.exposeInMainWorld("agriregistryDesktop", {
  isDesktop: true,

  getAppVersion: () =>
    ipcRenderer.invoke("agriregistry:update:get-version"),

  getUpdateState: () =>
    ipcRenderer.invoke("agriregistry:update:get-state"),

  checkForUpdates: () =>
    ipcRenderer.invoke("agriregistry:update:check"),

  downloadUpdate: () =>
    ipcRenderer.invoke("agriregistry:update:download"),

  installUpdate: () =>
    ipcRenderer.send("agriregistry:update:install"),

  exitApp: () =>
    ipcRenderer.send("agriregistry:app:exit"),

  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on(UPDATE_STATE_CHANNEL, listener);

    return () => {
      ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, listener);
    };
  },
});
