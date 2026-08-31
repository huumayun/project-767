import { app, BrowserWindow } from 'electron';
import path from 'path';
import { setupSecurityPolicies } from './security';
import { getDb } from './db';
import { registerIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;

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
    icon: path.join(__dirname, '../build/icon.ico'), // App Icon
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

  // Initialize SQLite database
  getDb();

  // Register IPC handlers
  registerIpcHandlers();

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
