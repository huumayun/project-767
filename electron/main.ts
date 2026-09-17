import { app, BrowserWindow, dialog, Tray, Menu , powerSaveBlocker} from 'electron';
import path from 'path';
import fs from 'fs';
import { setupSecurityPolicies } from './security';
import { getDb } from './db';
import { registerIpcHandlers } from './ipc/handlers';
import { startSyncEngine, stopSyncEngine } from './services/syncEngine';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

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
    title: 'Fatema Electronics POS',
    backgroundColor: '#0b0f19',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b0f19', // Matches dark background
      symbolColor: '#f59e0b', // amber-500
      height: 30
    },
    icon: appIconPath(), // App Icon
    autoHideMenuBar: true, // This hides the File/Edit/View menu
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

  /*
   * Initialize SQLite database. Failing here used to leave the window blank
   * because loadURL below never ran, so surface the error instead - and quit,
   * rather than leave a window with no database and no handlers behind it.
   *
   * The usual cause on a fresh clone is better-sqlite3 built for Node rather
   * than for Electron, so the message says how to rebuild it.
   */
  try {
    getDb();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    dialog.showErrorBox(
      'Database Error',
      `The database could not be opened or migrated.

${err instanceof Error ? err.message : String(err)}

If this is a fresh clone, the SQLite module may need rebuilding for Electron:
npx electron-builder install-app-deps`
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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Prevent the screen from sleeping while the app is running
    powerSaveBlocker.start('prevent-display-sleep');
    
    createWindow();
    
    // Create Tray Icon
    const iconPath = appIconPath() || path.join(__dirname, '../build/icon.png');
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Fatema Electronics POS', click: () => mainWindow?.show() },
        { type: 'separator' },
        { 
          label: 'Quit', 
          click: () => {
            isQuitting = true;
            app.quit();
          } 
        }
      ]);
      tray.setToolTip('Fatema Electronics POS');
      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            if (mainWindow.isFocused()) mainWindow.hide();
            else mainWindow.focus();
          } else {
            mainWindow.show();
          }
        }
      });
    }

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
}
