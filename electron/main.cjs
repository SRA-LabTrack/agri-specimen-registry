const { app, BrowserWindow, session, shell, screen } = require("electron");
const path = require("path");

const APP_URL =
  process.env.AGRISPECIMEN_APP_URL ||
  "https://agri-specimen-registry.vercel.app";

const APP_ORIGIN = new URL(APP_URL).origin;
const PARTITION = "persist:agrispecimen-registry";
const APP_ID = "com.luntian.agrispecimen";
const ICON_PATH = path.join(__dirname, "assets", "agriregistry-icon.ico");
const SPLASH_PATH = path.join(__dirname, "splash.html");
const MINIMUM_SPLASH_TIME_MS = 1800;

let mainWindow = null;
let splashWindow = null;
let loadingFallback = false;
let splashStartedAt = 0;

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

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
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