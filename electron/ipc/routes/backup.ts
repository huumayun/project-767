import { listBackups, createDatabaseBackup, restoreDatabase, verifyBackupFile } from '../../services/backupManager';

import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, requireOwnerOrFirstRun, getDeviceId, logAudit } from '../shared';


export function registerBackupHandlers() {
  ipcMain.handle('api:backup:list', async () => {
      requireRole(['owner']);
      return listBackups();
    });

  /*
   * Always into the backups folder, which Settings chooses.
   *
   * This took a file path from the screen and handed it to createDatabaseBackup,
   * which deletes whatever already sits at that path before writing. Nothing on
   * screen ever passed one, but the door let any path through - any file the
   * app's Windows user could reach. The folder is a setting; the name is ours.
   */
  ipcMain.handle('api:backup:createManual', async () => {
      requireRole(['owner']);
      return createDatabaseBackup(undefined, false);
    });

  ipcMain.handle('api:backup:restore', async (_event, rawBackupFilePath) => {
      requireRole(['owner']);
      const backupFilePath = z.string().min(1).parse(rawBackupFilePath);
      restoreDatabase(backupFilePath);
      app.relaunch();
      app.exit(0);
      return { success: true };
    });

  ipcMain.handle('api:backup:selectFolder', async () => {
    requireRole(['owner']);
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Backup Folder'
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('api:backup:selectFile', async () => {
    requireOwnerOrFirstRun();
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Backup File',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite3'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('api:backup:restoreLocalFile', async (_event, rawFilePath) => {
    requireOwnerOrFirstRun();
    const filePath = z.string().min(1).parse(rawFilePath);
    logAudit('RESTORE_FROM_FILE', 'backups', undefined, { filePath });
    restoreDatabase(filePath);
    app.relaunch();
    app.exit(0);
    return { success: true };
  });

  ipcMain.handle('api:backup:getFileInfo', async (_event, filePath: string) => {
    requireOwnerOrFirstRun();
    verifyBackupFile(filePath);
    
    const fs = require('fs');
    const path = require('path');
    const stat = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      size: stat.size,
      date: stat.mtime.toISOString()
    };
  });
}
