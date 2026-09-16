import { ipcMain, shell, app } from 'electron';
import path from 'path';
import { getAuthUrl, authorizeWithCode, isDriveConnected, disconnectDrive, findAndDownloadLatestBackup } from '../../services/googleDrive';
import { requireRole, requireOwnerOrFirstRun, logAudit } from '../shared';
import { isGoogleConfigured, GOOGLE_NOT_CONFIGURED } from '../../services/googleCredentials';

export function registerGDriveHandlers() {
  // Gated like everything else. It was the one handler in the app that answered
  // anybody, and what it answers - whether this shop has a cloud backup wired
  // up - is not something the login screen needs to know.
  ipcMain.handle('api:gdrive:status', async () => {
    requireRole(['owner', 'staff']);
    return { isConnected: isDriveConnected(), isConfigured: isGoogleConfigured() };
  });

  ipcMain.handle('api:gdrive:getAuthUrl', async () => {
    requireOwnerOrFirstRun();
    if (!isGoogleConfigured()) throw new Error(GOOGLE_NOT_CONFIGURED);
    const url = getAuthUrl();
    
    return new Promise((resolve) => {
      const { BrowserWindow } = require('electron');
      const authWindow = new BrowserWindow({
        width: 600,
        height: 750,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        title: 'Sign in with Google',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });

      const spoofUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      let resolved = false;

      authWindow.webContents.on('will-redirect', async (e: any, newUrl: string) => {
        if (newUrl.startsWith('http://localhost') || newUrl.startsWith('http://127.0.0.1')) {
          e.preventDefault();
          const parsedUrl = new URL(newUrl);
          const code = parsedUrl.searchParams.get('code');
          if (code && !resolved) {
            resolved = true;
            try {
              const success = await authorizeWithCode(code);
              resolve({ success, autoHandled: true });
            } catch (err: any) {
              resolve({ success: false, autoHandled: true, error: err.message });
            }
            authWindow.close();
          } else if (!resolved) {
            resolved = true;
            resolve({ success: false, autoHandled: true, error: 'Authorization rejected or missing code' });
            authWindow.close();
          }
        }
      });

      authWindow.on('closed', () => {
        if (!resolved) {
          resolved = true;
          // If closed without redirect, it is effectively cancelled, return normal autoHandled failure.
          resolve({ success: false, autoHandled: true, error: 'Sign-in window closed by user.' });
        }
      });

      authWindow.loadURL(url, { userAgent: spoofUA }).catch(() => {});
    });
  });

  ipcMain.handle('api:gdrive:authorize', async (_event, code: string) => {
    requireOwnerOrFirstRun();
    if (!isGoogleConfigured()) throw new Error(GOOGLE_NOT_CONFIGURED);
    const success = await authorizeWithCode(code);
    return { success };
  });

  ipcMain.handle('api:gdrive:disconnect', async () => {
    requireRole(['owner']);
    await disconnectDrive();
    return { success: true };
  });

  ipcMain.handle('api:gdrive:restoreLatest', async () => {
    requireOwnerOrFirstRun();
    logAudit('RESTORE_FROM_DRIVE', 'backups');
    const userData = app.getPath('userData');
    const tempBackupPath = path.join(userData, 'backups', 'restored_from_gdrive.db');
    
    // Ensure backups directory exists
    const fs = require('fs');
    if (!fs.existsSync(path.dirname(tempBackupPath))) {
      fs.mkdirSync(path.dirname(tempBackupPath), { recursive: true });
    }

    await findAndDownloadLatestBackup(tempBackupPath);
    
    // Call the backup manager's restoreDatabase to safely replace the current DB
    const { restoreDatabase } = require('../../services/backupManager');
    restoreDatabase(tempBackupPath);
    
    // Relaunch app
    app.relaunch();
    app.exit(0);
    
    return { success: true };
  });
}
