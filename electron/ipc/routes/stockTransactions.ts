import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerStockTransactionsHandlers() {
  ipcMain.handle('api:stockTransactions:list', async (_event, rawProductId) => {
      requireRole(['owner', 'staff']);
      const productId = z.string().min(1).parse(rawProductId);
      const db = getDb();
      return db.prepare(`
        SELECT st.*, u.name as user_name 
        FROM stock_transactions st 
        LEFT JOIN users u ON st.user_id = u.id 
        WHERE st.product_id = ? 
        ORDER BY st.created_at DESC
      `).all(productId);
    });

}
