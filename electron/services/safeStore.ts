import { app, safeStorage } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let cachedFallbackKey: Buffer | null = null;

function getFallbackKey(): Buffer {
  if (cachedFallbackKey) {
    return cachedFallbackKey;
  }

  try {
    const userDataPath = app?.getPath ? app.getPath('userData') : process.cwd();
    const keyFilePath = path.join(userDataPath, '.secret_fallback_key');

    if (fs.existsSync(keyFilePath)) {
      const existingKey = fs.readFileSync(keyFilePath, 'utf8').trim();
      if (existingKey && existingKey.length >= 32) {
        cachedFallbackKey = crypto.scryptSync(existingKey, 'salt_msp_storage', 32);
        return cachedFallbackKey;
      }
    }

    // Generate fresh per-install cryptographically secure random key
    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyFilePath, newSecret, { mode: 0o600, encoding: 'utf8' });
    cachedFallbackKey = crypto.scryptSync(newSecret, 'salt_msp_storage', 32);
    return cachedFallbackKey;
  } catch (err) {
    console.warn('Failed to access or persist fallback encryption key file, using ephemeral key:', err);
    if (!cachedFallbackKey) {
      cachedFallbackKey = crypto.randomBytes(32);
    }
    return cachedFallbackKey;
  }
}

export function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  try {
    if (isSafeStorageAvailable()) {
      const buffer = safeStorage.encryptString(plainText);
      return buffer.toString('base64');
    }
  } catch (err) {
    console.warn('safeStorage encryptString failed, falling back to AES:', err);
  }

  // Fallback AES-256-GCM using per-install key
  const iv = crypto.randomBytes(12);
  const key = getFallbackKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `aes:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(encryptedStr: string): string {
  if (!encryptedStr) return '';
  if (encryptedStr.startsWith('aes:')) {
    const parts = encryptedStr.split(':');
    if (parts.length === 4) {
      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const ciphertext = parts[3];
      const key = getFallbackKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  }

  try {
    if (isSafeStorageAvailable()) {
      const buffer = Buffer.from(encryptedStr, 'base64');
      return safeStorage.decryptString(buffer);
    }
  } catch (err) {
    console.error('safeStorage decryptString failed:', err);
  }

  return '';
}

