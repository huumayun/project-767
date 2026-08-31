import { shell } from 'electron';
import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerShellHandlers() {
  // --- SHELL HANDLERS ---
  // The window-open handler denies every new window (see security.ts), so the
  // renderer cannot reach an external link on its own. This opens one in the
  // user's real browser instead.
  ipcMain.handle('api:shell:openExternal', async (_event, rawUrl) => {
      requireRole(['owner', 'staff']);
      const url = z.string().min(1).max(2048).parse(rawUrl);
  
      // Only ever hand http(s) to the OS. shell.openExternal will happily launch
      // file:, ms-msdt:, and other protocol handlers, which is a well-known
      // remote-code-execution route if a URL ever came from untrusted data.
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('That link is not a valid URL.');
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Refusing to open a ${parsed.protocol} link.`);
      }
  
      await shell.openExternal(parsed.toString());
      return true;
    });

}
