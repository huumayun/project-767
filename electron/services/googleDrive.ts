import { google } from 'googleapis';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db';
import { shell } from 'electron';
import { getGoogleCredentials, GOOGLE_NOT_CONFIGURED } from './googleCredentials';
import { encryptSecret, decryptSecret } from './safeStore';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export const GDRIVE_TOKEN_KEY = 'gdrive_refresh_token';

function getShopNameForFolder(): string {
  try {
    const { getDb } = require('../db');
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_name');
    const name = row && row.value ? String(row.value).trim().replace(/[^a-zA-Z0-9 -]/g, '') : '';
    return name ? `${name} Backups` : 'POS Backups';
  } catch(e) {
    return 'POS Backups';
  }
}


export function getOAuth2Client() {
  const creds = getGoogleCredentials();
  if (!creds) throw new Error(GOOGLE_NOT_CONFIGURED);
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
}

/*
 * PKCE. The verifier is made when the URL is built and spent when the code
 * comes back, so an authorization code intercepted on its way through the
 * browser cannot be exchanged by anyone who does not also hold the verifier -
 * which never leaves this process.
 *
 * Held in a module variable because the two halves of the flow are two IPC
 * calls in one run of the app: the owner clicks Connect, and pastes the code
 * back into the same window.
 */
let pendingVerifier: string | null = null;

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();

  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pendingVerifier = verifier;

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    code_challenge_method: 'S256' as any,
    code_challenge: challenge,
  });
}

export async function authorizeWithCode(input: string): Promise<boolean> {
  let code = input.trim();
  // If user pasted the full localhost URL instead of just the code
  if (code.startsWith('http://localhost') || code.startsWith('http://127.0.0.1')) {
    try {
      const url = new URL(code);
      const urlCode = url.searchParams.get('code');
      if (urlCode) {
        code = urlCode;
      }
    } catch(e) {}
  }

  const oauth2Client = getOAuth2Client();
  try {
    const verifier = pendingVerifier;
    // Spent whatever the outcome: a verifier that survived a failed exchange
    // could be replayed against a second code.
    pendingVerifier = null;

    const { tokens } = await oauth2Client.getToken(
      verifier ? ({ code, codeVerifier: verifier } as any) : code
    );
    if (tokens.refresh_token) {
      const db = getDb();
      const now = new Date().toISOString();
      /*
       * Stored encrypted, like the Supabase key beside it.
       *
       * It was written as it came back from Google, so a refresh token granting
       * standing access to the shop's Drive sat in plain text in shop.db - and
       * shop.db is itself uploaded to that same Drive, so every backup carried
       * the credential for the account holding it.
       */
      const stored = encryptSecret(tokens.refresh_token);
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(GDRIVE_TOKEN_KEY, stored, now);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error exchanging auth code:', error);
    throw error;
  }
}

export function getRefreshToken(): string | null {
  const db = getDb();
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(GDRIVE_TOKEN_KEY) as any;
  if (!setting?.value) return null;

  // Tokens written before they were encrypted decrypt to nothing; such a value
  // is the token itself. Migration 011 converts them, so this is only a guard
  // for a row that arrived some other way.
  const decrypted = decryptSecret(setting.value);
  return decrypted || setting.value;
}

export function isDriveConnected(): boolean {
  return getRefreshToken() !== null;
}

export async function disconnectDrive() {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run('gdrive_refresh_token');
}

async function getOrCreateFolder(drive: any, folderName: string, parentId?: string): Promise<string> {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false${parentQuery}`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  } else {
    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      fileMetadata.parents = [parentId];
    }
    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
    return folder.data.id;
  }
}

export async function uploadToDrive(filePath: string, mimeType: string = 'application/x-sqlite3', subFolder?: string): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.log('Google Drive is not connected. Skipping upload.');
    return;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const fileName = path.basename(filePath);

  try {
    console.log(`Starting upload to Google Drive: ${fileName}`);
    const folderName = getShopNameForFolder();
    let folderId = await getOrCreateFolder(drive, folderName);
    if (subFolder) {
      folderId = await getOrCreateFolder(drive, subFolder, folderId);
    }

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    console.log(`Successfully uploaded to Google Drive. File ID: ${file.data.id}`);
  } catch (error) {
    console.error('Failed to upload file to Google Drive:', error);
  }
}

export async function findAndDownloadLatestBackup(targetPath: string): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Google Drive is not connected.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const folderName = getShopNameForFolder();
    const folderRes = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    
    let folderQuery = "";
    if (folderRes.data.files && folderRes.data.files.length > 0) {
      folderQuery = ` and '${folderRes.data.files[0].id}' in parents`;
    }

    const res = await drive.files.list({
      q: `name contains 'shop-backup' and mimeType='application/x-sqlite3' and trashed=false${folderQuery}`,
      orderBy: 'createdTime desc',
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id, name, createdTime)',
    });

    const files = res.data.files;
    if (!files || files.length === 0) {
      throw new Error('No backup files found in your Google Drive.');
    }

    const latestFile = files[0];
    console.log(`Found latest backup: ${latestFile.name} (${latestFile.createdTime})`);

    const dest = fs.createWriteStream(targetPath);
    const response = await drive.files.get(
      { fileId: latestFile.id!, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          console.log('Download complete.');
          resolve(true);
        })
        .on('error', (err: any) => {
          console.error('Error downloading file.');
          reject(err);
        })
        .pipe(dest);
    });
  } catch (error: any) {
    console.error('Failed to find/download backup:', error);
    throw error;
  }
}
