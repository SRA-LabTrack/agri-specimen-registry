const { app, BrowserWindow, session, shell } = require("electron");
const path = require("path");

const APP_URL =
  process.env.AGRISPECIMEN_APP_URL ||
  "https://agri-specimen-registry.vercel.app";

const APP_ORIGIN = new URL(APP_URL).origin;
const PARTITION = "persist:agrispecimen-registry";
const APP_ID = "com.luntian.agrispecimen";

let mainWindow = null;
let loadingFallback = false;

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
    title: "AgriSpecimen Registry",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#edf3ea",
    autoHideMenuBar: true,
    webPreferences: {
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
    if (isTrustedAppUrl(url)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isTrustedAppUrl(url) || url.startsWith("file:")) return;

    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, _description, validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || !isTrustedAppUrl(validatedUrl)) {
        return;
      }

      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          void showOfflineFallback(mainWindow);
        }
      }, 350);
    },
  );

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void loadRegistry(mainWindow);
}

app.on("second-instance", () => {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});