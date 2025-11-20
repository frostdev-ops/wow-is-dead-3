/**
 * Secure storage utilities with HMAC integrity verification
 */

import { generateIntegrityHash, verifyIntegrity } from './security';

interface StorageEnvelope<T> {
  data: T;
  hash: string;
  version: number;
}

const STORAGE_VERSION = 1;

/**
 * Safely store data in localStorage with integrity hash
 * @param key Storage key
 * @param value Data to store
 */
export async function setSecureItem<T>(key: string, value: T): Promise<void> {
  try {
    const dataStr = JSON.stringify(value);
    const hash = await generateIntegrityHash(dataStr);
    
    const envelope: StorageEnvelope<T> = {
      data: value,
      hash,
      version: STORAGE_VERSION,
    };
    
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    console.error('[SecureStorage] Failed to store item:', key, error);
    throw new Error('Failed to store data securely');
  }
}

/**
 * Safely retrieve data from localStorage with integrity verification
 * @param key Storage key
 * @returns Data if valid, null if not found or tampered
 */
export async function getSecureItem<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const envelope = JSON.parse(raw) as StorageEnvelope<T>;
    
    // Check version
    if (envelope.version !== STORAGE_VERSION) {
      console.warn('[SecureStorage] Version mismatch for key:', key);
      localStorage.removeItem(key);
      return null;
    }

    // Verify integrity
    const dataStr = JSON.stringify(envelope.data);
    const isValid = await verifyIntegrity(dataStr, envelope.hash);
    
    if (!isValid) {
      console.warn('[SecureStorage] Integrity check failed for key:', key);
      localStorage.removeItem(key);
      return null;
    }

    return envelope.data;
  } catch (error) {
    console.error('[SecureStorage] Failed to retrieve item:', key, error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Remove item from secure storage
 * @param key Storage key
 */
export function removeSecureItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Check if an item exists in storage
 * @param key Storage key
 */
export function hasSecureItem(key: string): boolean {
  return localStorage.getItem(key) !== null;
}

/**
 * Clear all items from storage
 */
export function clearSecureStorage(): void {
  localStorage.clear();
}
