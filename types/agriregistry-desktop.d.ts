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

  interface AgriRegistryDesktopAPI {
    isDesktop: true;
    getAppVersion: () => Promise<string>;
    getUpdateState: () => Promise<AgriRegistryUpdateState>;
    checkForUpdates: () => Promise<AgriRegistryUpdateState>;
    downloadUpdate: () => Promise<AgriRegistryUpdateState>;
    installUpdate: () => void;
    exitApp: () => void;
    onUpdateState: (
      callback: (state: AgriRegistryUpdateState) => void,
    ) => (() => void) | void;
  }

  interface Window {
    agriregistryDesktop?: AgriRegistryDesktopAPI;
  }
}
