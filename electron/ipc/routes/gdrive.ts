import { ipcMain, shell, app } from 'electron';
import path from 'path';
import { getAuthUrl, authorizeWithCode, isDriveConnected, disconnectDrive, findAndDownloadLatestBackup } from '../../services/googleDrive';
import { requireRole } from '../shared';

export function registerGDriveHandlers() {
  ipcMain.handle('api:gdrive:status', async () => {
    return { isConnected: isDriveConnected() };
  });

  ipcMain.handle('api:gdrive:getAuthUrl', async () => {
    // Accessible during first run or by owner
    const url = getAuthUrl();
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('api:gdrive:authorize', async (_event, code: string) => {
    // Accessible during first run or by owner
    const success = await authorizeWithCode(code);
    return { success };
  });

  ipcMain.handle('api:gdrive:disconnect', async () => {
    requireRole(['owner']);
    await disconnectDrive();
    return { success: true };
  });

  ipcMain.handle('api:gdrive:restoreLatest', async () => {
    // Doesn't require role because this is run before first run
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
