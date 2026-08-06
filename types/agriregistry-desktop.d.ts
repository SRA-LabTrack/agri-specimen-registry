export {};

declare global {
  type AgriRegistryUpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "up-to-date"
    | "error"
    | "disabled";

  interface AgriRegistryUpdateState {
    status: AgriRegistryUpdateStatus;
    currentVersion: string;
    availableVersion?: string;
    percent?: number;
    message?: string;
    showBanner?: boolean;
  }

  // AGRIREGISTRY_WINDOW_CONTROLS_V7_TYPES
  interface AgriRegistryWindowState {
    isFullScreen: boolean;
    isMaximized: boolean;
    isMinimized: boolean;
  }

  interface AgriRegistryDesktopAPI {
    isDesktop: true;
    getAppVersion: () => Promise<string>;
    getUpdateState: () => Promise<AgriRegistryUpdateState>;
    checkForUpdates: () => Promise<AgriRegistryUpdateState>;
    downloadUpdate: () => Promise<AgriRegistryUpdateState>;
    installUpdate: () => void;
    getWindowState: () => Promise<AgriRegistryWindowState>;
    enterFullScreen: () => Promise<AgriRegistryWindowState>;
    exitFullScreen: () => Promise<AgriRegistryWindowState>;
    toggleFullScreen: () => Promise<AgriRegistryWindowState>;
    minimizeApp: () => void;
    closeApp: () => void;
    exitApp: () => void;
    onWindowState: (
      callback: (state: AgriRegistryWindowState) => void,
    ) => (() => void) | void;
    onUpdateState: (
      callback: (state: AgriRegistryUpdateState) => void,
    ) => (() => void) | void;
  }

  interface Window {
    agriregistryDesktop?: AgriRegistryDesktopAPI;
  }
}
