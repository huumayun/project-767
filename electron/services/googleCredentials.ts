import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * The Google OAuth client this build uses for Drive backup.
 *
 * These used to be two string literals in googleDrive.ts, which put the client
 * secret in the repository - and the repository is public, so the credential
 * was readable by anyone who found it and sat in the history of every commit
 * that touched the file. It is loaded from a file that git ignores instead.
 *
 * A desktop app cannot keep a client secret confidential no matter where it is
 * put: the installer ships it and an asar is a zip. Google says as much for
 * "Desktop app" clients. What this changes is narrower and still worth having -
 * the credential is no longer published to the world in source control, and
 * rotating it no longer means rewriting git history.
 *
 * Missing credentials are not an error. Drive backup simply reports itself
 * unconfigured, which is what a build made by someone without the file should
 * do rather than crash at startup.
 */
export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

let cached: GoogleOAuthCredentials | null | undefined;

function readFromFile(): GoogleOAuthCredentials | null {
  const candidates: string[] = [];

  // 1. Electron app path (inside app.asar in production or project root in dev)
  try {
    if (app && typeof app.getAppPath === 'function') {
      candidates.push(path.join(app.getAppPath(), 'google-oauth.json'));
    }
  } catch {
    // app may not be ready or available
  }

  // 2. Extra resources path (unpacked in resources/ alongside app.asar)
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'google-oauth.json'));
  }

  // 3. User data directory (%APPDATA%/Fatema Electronics POS/google-oauth.json)
  try {
    if (app && typeof app.getPath === 'function') {
      candidates.push(path.join(app.getPath('userData'), 'google-oauth.json'));
    }
  } catch {
    // app may not be ready or available
  }

  // 4. Executable directory (next to .exe or inside its resources folder)
  if (process.execPath) {
    const exeDir = path.dirname(process.execPath);
    candidates.push(path.join(exeDir, 'resources', 'google-oauth.json'));
    candidates.push(path.join(exeDir, 'google-oauth.json'));
  }

  // 5. Current working directory
  try {
    candidates.push(path.join(process.cwd(), 'google-oauth.json'));
  } catch {
    // ignore
  }

  // 6. Relative to compiled bundle in dist-electron/services
  candidates.push(path.join(__dirname, '../../google-oauth.json'));
  candidates.push(path.join(__dirname, '../google-oauth.json'));
  candidates.push(path.join(__dirname, 'google-oauth.json'));

  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      const clientId = String(parsed.clientId || '').trim();
      const clientSecret = String(parsed.clientSecret || '').trim();
      if (!clientId || !clientSecret) continue;
      return {
        clientId,
        clientSecret,
        redirectUri: String(parsed.redirectUri || '').trim() || 'http://localhost',
      };
    } catch (err) {
      console.warn(`Could not read Google OAuth credentials from ${candidate}:`, err);
    }
  }
  return null;
}

export function getGoogleCredentials(): GoogleOAuthCredentials | null {
  if (cached !== undefined) return cached;

  // Environment first, so a developer can run without writing the file at all.
  const envId = (process.env.GDRIVE_CLIENT_ID || '').trim();
  const envSecret = (process.env.GDRIVE_CLIENT_SECRET || '').trim();
  if (envId && envSecret) {
    cached = {
      clientId: envId,
      clientSecret: envSecret,
      redirectUri: (process.env.GDRIVE_REDIRECT_URI || '').trim() || 'http://localhost',
    };
    return cached;
  }

  cached = readFromFile();
  if (!cached) {
    console.warn(
      'Google Drive backup is switched off for this build: no google-oauth.json ' +
        'and no GDRIVE_CLIENT_ID/GDRIVE_CLIENT_SECRET. See google-oauth.example.json.'
    );
  }
  return cached;
}

export function isGoogleConfigured(): boolean {
  return getGoogleCredentials() !== null;
}

/** The sentence every Drive handler gives when this build has no credentials. */
export const GOOGLE_NOT_CONFIGURED =
  'Google Drive backup is not set up for this build. Add google-oauth.json with the ' +
  'shop’s OAuth client before using Drive backup.';
