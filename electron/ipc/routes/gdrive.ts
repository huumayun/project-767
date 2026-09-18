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
      const http = require('http');
      
      let resolved = false;
      let server: any = null;
      
      const finish = (result: any) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
          if (server) {
            server.close();
            server = null;
          }
        }
      };

      server = http.createServer(async (req: any, res: any) => {
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const code = reqUrl.searchParams.get('code');
          
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><head><title>Success</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f4f7f6;color:#1a2f24;}</style></head><body><div style="text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);"><h2>Authorization Successful!</h2><p>You can close this window and return to the POS app.</p></div><script>setTimeout(() => window.close(), 2000);</script></body></html>');
            
            try {
              const success = await authorizeWithCode(code);
              finish({ success, autoHandled: true });
            } catch (err: any) {
              finish({ success: false, autoHandled: true, error: err.message });
            }
          } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('No code found in request.');
          }
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      });

      server.on('error', (e: any) => {
        console.warn('Failed to start local auth server on port 80. Falling back to manual copy-paste flow.', e);
        // Fallback to manual flow
        shell.openExternal(url);
        finish({ autoHandled: false });
      });

      // Attempt to listen on port 80 (since redirectUri is http://localhost)
      // If it fails (e.g. EACCES or EADDRINUSE), the error handler above fires.
      server.listen(80, '127.0.0.1', () => {
        console.log('Local auth server listening on port 80');
        shell.openExternal(url);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          if (!resolved) {
            finish({ success: false, autoHandled: true, error: 'Authorization timed out.' });
          }
        }, 5 * 60 * 1000);
      });
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
