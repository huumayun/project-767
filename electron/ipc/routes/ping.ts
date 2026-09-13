import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerPingHandlers() {
  // Demo Ping IPC call
  ipcMain.handle('api:ping', async () => {
      return { status: 'OK', timestamp: new Date().toISOString() };
    });

  /**
   * What build this is. Unauthenticated, because the setup wizard asks before
   * anyone can log in - and it says nothing a shop's own installer does not.
   *
   * `sampleDataAvailable` is how the screens decide whether to offer sample
   * data at all. It is false in the installed app: fake parts, customers and
   * suppliers have no place in a real shop's books.
   */
  ipcMain.handle('api:app:info', async () => {
      return {
        version: app.getVersion(),
        isPackaged: app.isPackaged,
        sampleDataAvailable: !app.isPackaged,
      };
    });

}
