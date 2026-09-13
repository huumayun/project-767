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
    await shell.openExternal(url);
    return { success: true };
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
