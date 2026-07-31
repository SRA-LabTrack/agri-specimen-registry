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

function getResponsiveWindowMetrics() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  return {
    splashWidth: Math.max(340, Math.min(820, Math.floor(width * 0.72))),
    splashHeight: Math.max(280, Math.min(540, Math.floor(height * 0.62))),
    mainWidth: Math.max(360, Math.min(1600, Math.floor(width * 0.96))),
    mainHeight: Math.max(520, Math.min(1100, Math.floor(height * 0.94))),
  };
}
function createSplashWindow() {
  splashStartedAt = Date.now();
  const { splashWidth, splashHeight } = getResponsiveWindowMetrics();

  splashWindow = new BrowserWindow({
    width: splashWidth,
    height: splashHeight,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    icon: ICON_PATH,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  splashWindow.setIgnoreMouseEvents(true);

  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
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
      mainWindow.maximize();
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
  const { mainWidth, mainHeight } = getResponsiveWindowMetrics();
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
    width: mainWidth,
    height: mainHeight,
    minWidth: 360,
    minHeight: 520,
    show: false,
    icon: ICON_PATH,
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
  mainWindow.maximize();
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