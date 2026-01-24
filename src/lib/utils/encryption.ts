import crypto from 'crypto';

// Use encryption key from environment variable only
// Must be exactly 32 characters for AES-256
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('VITE_ENCRYPTION_KEY environment variable is not set');
}

// Ensure key is exactly 32 bytes for AES-256
const getEncryptionKey = (): Buffer => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key is not available');
  }
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
  return Buffer.from(key);
};

/**
 * Encrypt data using AES-256-GCM
 * Returns encrypted data with IV and auth tag concatenated
 */
export function encryptData(data: any): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    // Stringify the data
    const plaintext = JSON.stringify(data);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV + encrypted + authTag and return as base64
    const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex'), authTag]);
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypt data encrypted with encryptData
 * Expects base64 encoded data with IV + encrypted + authTag
 */
export function decryptData(encryptedData: string): any {
  try {
    const key = getEncryptionKey();
    
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(-16);
    const encrypted = combined.slice(16, -16);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt - encrypted is already a Buffer, no need to specify input encoding
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse JSON
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}

/**
 * Browser-compatible decryption using SubtleCrypto
 * Call this from client-side code
 */
export async function decryptDataClient(encryptedData: string, encryptionKey: string): Promise<any> {
  try {
    const key = encryptionKey.padEnd(32, '0').slice(0, 32);
    
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract components
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(-16);
    const encrypted = combined.slice(16, -16);
    
    // Import key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      new Uint8Array([...encrypted, ...authTag])
    );
    
    // Parse JSON
    const text = new TextDecoder().decode(decrypted);
    return JSON.parse(text);
  } catch (error) {
    console.error('Client decryption error:', error);
    throw error;
  }
}