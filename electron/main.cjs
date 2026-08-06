const { app, BrowserWindow, session, shell, screen, ipcMain } = require("electron");
const path = require("path");
// AGRIREGISTRY_AUTO_UPDATE_V9_IMPORT
const electronUpdater = require("electron-updater");
const { autoUpdater } = electronUpdater;

const APP_URL =
  process.env.AGRISPECIMEN_APP_URL ||
  "https://agri-specimen-registry.vercel.app";

const APP_ORIGIN = new URL(APP_URL).origin;
const PARTITION = "persist:agrispecimen-registry";
const APP_ID = "com.luntian.agrispecimen";
const ICON_PATH = path.join(__dirname, "assets", "agriregistry-icon.ico");
const SPLASH_PATH = path.join(__dirname, "splash.html");
// AGRIREGISTRY_AUTO_UPDATE_V9_CONSTANTS
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MINIMUM_SPLASH_TIME_MS = 1800;

let mainWindow = null;
let splashWindow = null;
let loadingFallback = false;
let splashStartedAt = 0;

// AGRIREGISTRY_WINDOW_CONTROLS_V7_CORE
const WINDOW_STATE_CHANNEL = "agriregistry:window:state";

function currentWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      isFullScreen: false,
      isMaximized: false,
      isMinimized: false,
    };
  }

  return {
    isFullScreen: mainWindow.isFullScreen(),
    isMaximized: mainWindow.isMaximized(),
    isMinimized: mainWindow.isMinimized(),
  };
}

function broadcastWindowState() {
  const state = currentWindowState();

  if (
    mainWindow
    && !mainWindow.isDestroyed()
    && !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send(
      WINDOW_STATE_CHANNEL,
      state,
    );
  }

  return state;
}

function enterMainWindowFullScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return currentWindowState();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.setFullScreen(true);
  mainWindow.show();
  mainWindow.focus();

  setTimeout(broadcastWindowState, 50);
  return currentWindowState();
}

function exitMainWindowFullScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return currentWindowState();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.setFullScreen(false);
  mainWindow.show();
  mainWindow.focus();

  setTimeout(broadcastWindowState, 50);
  return currentWindowState();
}

function toggleMainWindowFullScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return currentWindowState();
  }

  return mainWindow.isFullScreen()
    ? exitMainWindowFullScreen()
    : enterMainWindowFullScreen();
}

// AGRIREGISTRY_AUTO_UPDATE_V9_CORE
let lastUpdateCheckWasManual = false;
let updateDownloadStarted = false;
let updateState = {
  status: "idle",
  currentVersion: app.getVersion(),
  showBanner: false,
};

function broadcastUpdateState(patch = {}) {
  updateState = {
    ...updateState,
    ...patch,
    currentVersion: app.getVersion(),
  };

  if (
    mainWindow
    && !mainWindow.isDestroyed()
    && !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send(
      "agriregistry:update:state",
      updateState,
    );
  }

  return updateState;
}

function updaterRawError(error) {
  return (
    error && typeof error.message === "string"
      ? error.message
      : String(error || "Unknown update error")
  );
}

function isMissingReleaseError(error) {
  const message = updaterRawError(error).toLowerCase();

  return (
    message.includes("unable to find latest version on github")
    || message.includes("cannot parse releases feed")
    || message.includes("status code: 406")
    || message.includes("httperror: 406")
    || (
      message.includes("406")
      && message.includes("latest version")
    )
  );
}

function updaterErrorMessage(error) {
  const message = updaterRawError(error).toLowerCase();

  if (
    message.includes("enotfound")
    || message.includes("econnreset")
    || message.includes("econnrefused")
    || message.includes("network")
    || message.includes("net::")
    || message.includes("timed out")
  ) {
    return "AgriRegistry could not reach the update server. Check your connection and try again.";
  }

  return "The desktop update service could not complete the request. Please try again later.";
}

async function checkForDesktopUpdates(manual = false) {
  lastUpdateCheckWasManual = manual;

  if (!app.isPackaged) {
    return broadcastUpdateState({
      status: "disabled",
      message: "Updates are checked in the installed application.",
      showBanner: manual,
    });
  }

  broadcastUpdateState({
    status: "checking",
    message: "Checking for a newer AgriRegistry version...",
    showBanner: manual,
  });

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    if (isMissingReleaseError(error)) {
      broadcastUpdateState({
        status: "up-to-date",
        availableVersion: undefined,
        percent: 100,
        message: "No newer desktop release is available yet.",
        showBanner: manual,
      });
    } else {
      broadcastUpdateState({
        status: manual ? "error" : "idle",
        message: manual ? updaterErrorMessage(error) : "",
        showBanner: manual,
      });
    }
  }

  return updateState;
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    broadcastUpdateState({
      status: "checking",
      message: "Checking for a newer AgriRegistry version...",
      showBanner: lastUpdateCheckWasManual,
    });
  });

  autoUpdater.on("update-available", (info) => {
    updateDownloadStarted = false;
    broadcastUpdateState({
      status: "available",
      availableVersion: info.version,
      percent: 0,
      message: `AgriRegistry ${info.version} is ready to download.`,
      showBanner: true,
    });
  });

  autoUpdater.on("update-not-available", () => {
    broadcastUpdateState({
      status: "up-to-date",
      availableVersion: undefined,
      percent: 100,
      message: `AgriRegistry ${app.getVersion()} is up to date.`,
      showBanner: lastUpdateCheckWasManual,
    });

    lastUpdateCheckWasManual = false;
  });

  autoUpdater.on("download-progress", (progress) => {
    updateDownloadStarted = true;
    broadcastUpdateState({
      status: "downloading",
      percent: Math.max(0, Math.min(100, progress.percent || 0)),
      message: "Downloading the update...",
      showBanner: true,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateDownloadStarted = false;
    broadcastUpdateState({
      status: "downloaded",
      availableVersion: info.version,
      percent: 100,
      message: `AgriRegistry ${info.version} is ready to install.`,
      showBanner: true,
    });
  });

  autoUpdater.on("error", (error) => {
    if (isMissingReleaseError(error)) {
      broadcastUpdateState({
        status: "up-to-date",
        availableVersion: undefined,
        percent: 100,
        message: "No newer desktop release is available yet.",
        showBanner: lastUpdateCheckWasManual,
      });

      updateDownloadStarted = false;
      lastUpdateCheckWasManual = false;
      return;
    }

    const shouldShow =
      lastUpdateCheckWasManual || updateDownloadStarted;

    broadcastUpdateState({
      status: shouldShow ? "error" : "idle",
      message: shouldShow ? updaterErrorMessage(error) : "",
      showBanner: shouldShow,
    });

    updateDownloadStarted = false;
    lastUpdateCheckWasManual = false;
  });

  ipcMain.handle(
    "agriregistry:update:get-version",
    () => app.getVersion(),
  );

  ipcMain.handle(
    "agriregistry:update:get-state",
    () => updateState,
  );

  ipcMain.handle(
    "agriregistry:update:check",
    async () => checkForDesktopUpdates(true),
  );

  ipcMain.handle(
    "agriregistry:update:download",
    async () => {
      if (!app.isPackaged) {
        return broadcastUpdateState({
          status: "disabled",
          message: "Install AgriRegistry before testing updates.",
          showBanner: true,
        });
      }

      updateDownloadStarted = true;
      broadcastUpdateState({
        status: "downloading",
        percent: 0,
        message: "Starting the update download...",
        showBanner: true,
      });

      try {
        await autoUpdater.downloadUpdate();
      } catch (error) {
        broadcastUpdateState({
          status: "error",
          message: updaterErrorMessage(error),
          showBanner: true,
        });
        updateDownloadStarted = false;
      }

      return updateState;
    },
  );

  ipcMain.on("agriregistry:update:install", () => {
    if (updateState.status === "downloaded") {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  ipcMain.on("agriregistry:app:exit", () => {
    app.quit();
  });

  // AGRIREGISTRY_WINDOW_CONTROLS_V7_IPC
  ipcMain.handle(
    "agriregistry:window:get-state",
    () => currentWindowState(),
  );

  ipcMain.handle(
    "agriregistry:window:enter-fullscreen",
    () => enterMainWindowFullScreen(),
  );

  ipcMain.handle(
    "agriregistry:window:exit-fullscreen",
    () => exitMainWindowFullScreen(),
  );

  ipcMain.handle(
    "agriregistry:window:toggle-fullscreen",
    () => toggleMainWindowFullScreen(),
  );

  ipcMain.on("agriregistry:window:minimize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
      setTimeout(broadcastWindowState, 50);
    }
  });

  ipcMain.on("agriregistry:window:close", () => {
    app.quit();
  });

  if (app.isPackaged) {
    setTimeout(() => {
      void checkForDesktopUpdates(false);
    }, 5000);

    setInterval(() => {
      void checkForDesktopUpdates(false);
    }, UPDATE_CHECK_INTERVAL_MS);
  }
}

app.setName("AgriRegistry");
app.setAppUserModelId(APP_ID);

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function isTrustedAppUrl(value) {
  try {
    return new URL(value).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function getPrimaryDisplaySize() {
  const display = screen.getPrimaryDisplay();
  return {
    width: Math.max(360, display.bounds.width),
    height: Math.max(520, display.bounds.height),
  };
}

function createSplashWindow() {
  splashStartedAt = Date.now();
  const { width, height } = getPrimaryDisplaySize();

  splashWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    fullscreen: true,
    fullscreenable: true,
    transparent: false,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: ICON_PATH,
    backgroundColor: "#dcefd6",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  splashWindow.setIgnoreMouseEvents(true);

  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.setFullScreen(true);
      splashWindow.show();
    }
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  void splashWindow.loadFile(SPLASH_PATH);
}

function revealMainWindow() {
  const elapsed = Date.now() - splashStartedAt;
  const remaining = Math.max(0, MINIMUM_SPLASH_TIME_MS - elapsed);

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
      mainWindow.show();
      mainWindow.focus();
    }
  }, remaining);
}

async function showOfflineFallback(window) {
  if (loadingFallback || window.isDestroyed()) return;

  loadingFallback = true;

  try {
    await window.loadFile(path.join(__dirname, "offline.html"), {
      query: { url: APP_URL },
    });
  } finally {
    loadingFallback = false;
  }
}

async function loadRegistry(window) {
  if (window.isDestroyed()) return;

  try {
    await window.loadURL(APP_URL);
  } catch {
    await showOfflineFallback(window);
  }
}

function createWindow() {
  const { width, height } = getPrimaryDisplaySize();

  const persistentSession = session.fromPartition(PARTITION, {
    cache: true,
  });

  persistentSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || webContents.getURL();
      const trusted = isTrustedAppUrl(requestingUrl);
      const allowedPermissions = new Set([
        "media",
        "notifications",
        "geolocation",
        "clipboard-read",
      ]);

      callback(trusted && allowedPermissions.has(permission));
    },
  );

  mainWindow = new BrowserWindow({
    title: "AgriRegistry",
    width,
    height,
    minWidth: 360,
    minHeight: 520,
    fullscreen: true,
    fullscreenable: true,
    show: false,
    icon: ICON_PATH,
    backgroundColor: "#dcefd6",
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      partition: PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // AGRIREGISTRY_EXIT_PROTOCOL_V7_OPEN
    if (url.startsWith("agriregistry://exit")) {
      app.quit();
      return { action: "deny" };
    }
    if (isTrustedAppUrl(url)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    // AGRIREGISTRY_EXIT_PROTOCOL_V7_NAVIGATE
    if (url.startsWith("agriregistry://exit")) {
      event.preventDefault();
      app.quit();
      return;
    }
    if (isTrustedAppUrl(url) || url.startsWith("file:")) return;

    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      event.preventDefault();
      toggleMainWindowFullScreen();
    }
  });

  // AGRIREGISTRY_WINDOW_CONTROLS_V7_EVENTS
  [
    "enter-full-screen",
    "leave-full-screen",
    "maximize",
    "unmaximize",
    "minimize",
    "restore",
    "show",
  ].forEach((eventName) => {
    mainWindow.on(eventName, () => {
      setTimeout(broadcastWindowState, 40);
    });
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, _description, validatedUrl, isMainFrame) => {
      if (
        !isMainFrame ||
        errorCode === -3 ||
        !isTrustedAppUrl(validatedUrl)
      ) {
        return;
      }

      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          void showOfflineFallback(mainWindow);
        }
      }, 350);
    },
  );

  // AGRIREGISTRY_AUTO_UPDATE_V9_FINISH_LOAD
  mainWindow.webContents.on("did-finish-load", () => {
    broadcastUpdateState();
    broadcastWindowState();
  });

  mainWindow.once("ready-to-show", revealMainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void loadRegistry(mainWindow);
}

app.on("second-instance", () => {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.setFullScreen(true);
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(() => {
  // AGRIREGISTRY_AUTO_UPDATE_V9_READY
  configureAutoUpdater();
  createSplashWindow();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});