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

}
