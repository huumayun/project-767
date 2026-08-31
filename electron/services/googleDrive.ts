import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db';
import { shell } from 'electron';

const CLIENT_ID = '933362428054-k7j37j1spon8p7aimqa33vm29gp5eofj.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost'; // User configured this in console

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
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
    const { tokens } = await oauth2Client.getToken(code);
    if (tokens.refresh_token) {
      const db = getDb();
      const now = new Date().toISOString();
      const check = db.prepare('SELECT value FROM settings WHERE key = ?').get('gdrive_refresh_token');
      if (check) {
        db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(tokens.refresh_token, now, 'gdrive_refresh_token');
      } else {
        db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('gdrive_refresh_token', tokens.refresh_token, now);
      }
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
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('gdrive_refresh_token') as any;
  return setting ? setting.value : null;
}

export function isDriveConnected(): boolean {
  return getRefreshToken() !== null;
}

export async function disconnectDrive() {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run('gdrive_refresh_token');
}

async function getOrCreateFolder(drive: any, folderName: string): Promise<string> {
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  } else {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
    return folder.data.id;
  }
}

export async function uploadToDrive(filePath: string): Promise<void> {
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
    const folderId = await getOrCreateFolder(drive, 'MS POS Backups');

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };
    const media = {
      mimeType: 'application/x-sqlite3',
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
    const res = await drive.files.list({
      q: "name contains 'shop-backup' and mimeType='application/x-sqlite3' and trashed=false",
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
