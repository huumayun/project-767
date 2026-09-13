import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupSecurityPolicies } from './security';
import { getDb } from './db';
import { registerIpcHandlers } from './ipc/handlers';
import { startSyncEngine, stopSyncEngine } from './services/syncEngine';

let mainWindow: BrowserWindow | null = null;

/**
 * The icon sits beside the build output in development and inside the asar once
 * packaged, so the path is resolved rather than assumed. Returning undefined
 * lets Windows fall back to the icon compiled into the exe, which is the same
 * artwork.
 */
function appIconPath(): string | undefined {
  for (const candidate of [
    path.join(__dirname, '../build/icon.ico'),
    path.join(process.resourcesPath || '', 'build/icon.ico'),
  ]) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createWindow() {
  // Configure auto-start on boot (Task Manager Startup)
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe'),
      args: [
        '--processStart', `"${app.getName()}"`,
        '--process-start-args', `"--hidden"`
      ]
    });
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Mechanical Shop POS',
    backgroundColor: '#0b0f19',
    icon: appIconPath(), // App Icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Apply Security Hardening
  setupSecurityPolicies(mainWindow);

  // Initialize SQLite database. Failing here used to leave the window blank
  // because loadURL below never ran, so surface the error instead.
  try {
    getDb();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    dialog.showErrorBox(
      'Database Error',
      `The database could not be opened or migrated.

${err instanceof Error ? err.message : String(err)}`
    );
    app.quit();
    return;
  }

  // Register IPC handlers
  registerIpcHandlers();

  /*
   * Start the background push to the cloud.
   *
   * The engine was written, the interval was written, and nothing ever called
   * it - so a shop that had filled in its Supabase details in Settings was
   * shown a sync badge and a pending count that only ever moved when someone
   * pressed "Sync now" by hand. The rest of the time the counter sat there
   * climbing, and the copy the owner believed was in the cloud was not.
   *
   * Unconditional: executeDeltaSync returns immediately when no cloud is
   * configured, so an offline-only shop pays for one settings read a minute.
   */
  startSyncEngine();

  // Load URL
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// A timer holding the loop open would keep the process alive after the window
// has gone, leaving a till that looks closed still running in the background.
app.on('before-quit', () => {
  stopSyncEngine();
});
