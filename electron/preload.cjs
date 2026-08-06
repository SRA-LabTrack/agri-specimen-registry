const { contextBridge, ipcRenderer } = require("electron");

const UPDATE_STATE_CHANNEL = "agriregistry:update:state";
const WINDOW_STATE_CHANNEL = "agriregistry:window:state";

// AGRIREGISTRY_WINDOW_CONTROLS_V7_PRELOAD
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

  getWindowState: () =>
    ipcRenderer.invoke("agriregistry:window:get-state"),

  enterFullScreen: () =>
    ipcRenderer.invoke("agriregistry:window:enter-fullscreen"),

  exitFullScreen: () =>
    ipcRenderer.invoke("agriregistry:window:exit-fullscreen"),

  toggleFullScreen: () =>
    ipcRenderer.invoke("agriregistry:window:toggle-fullscreen"),

  minimizeApp: () =>
    ipcRenderer.send("agriregistry:window:minimize"),

  closeApp: () =>
    ipcRenderer.send("agriregistry:window:close"),

  exitApp: () =>
    ipcRenderer.send("agriregistry:app:exit"),

  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on(WINDOW_STATE_CHANNEL, listener);

    return () => {
      ipcRenderer.removeListener(WINDOW_STATE_CHANNEL, listener);
    };
  },

  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on(UPDATE_STATE_CHANNEL, listener);

    return () => {
      ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, listener);
    };
  },
});
