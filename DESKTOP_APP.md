# AgriRegistry Desktop

The Electron desktop application securely loads the production registry from:

`https://agri-specimen-registry.vercel.app`

## Login and offline behavior

1. Launch the app while online.
2. Sign in normally.
3. Keep the app online long enough to load the registry and cache its shell,
   records, and photographs.
4. Future launches reuse the persistent Electron session.
5. Offline additions, edits, deletions, and photographs are stored locally.
6. Pending changes synchronize when the connection returns.

An Appwrite session can still expire or be revoked, so another login may
occasionally be required.

## Commands

Run the desktop app during development:

```powershell
npm.cmd run desktop
```

Build a Windows installer:

```powershell
npm.cmd run desktop:build
```

The installer is created in `dist-electron`.