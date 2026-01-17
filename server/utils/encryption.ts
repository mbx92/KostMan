import crypto from 'crypto'

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derives a key from the encryption password using PBKDF2
 */
function getKey(salt: Buffer): Buffer {
  const password = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production'
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512')
}

/**
 * Encrypts sensitive data like API keys
 * @param text - The plaintext to encrypt
 * @returns Encrypted string in format: salt:iv:tag:encryptedData
 */
export function encrypt(text: string): string {
  if (!text) return ''
  
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = getKey(salt)
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Return format: salt:iv:tag:encryptedData
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts data encrypted with the encrypt function
 * @param encryptedText - The encrypted string in format: salt:iv:tag:encryptedData
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  
  try {
    const parts = encryptedText.split(':')
    
    // Check if this is encrypted data (should have 4 parts)
    if (parts.length !== 4) {
      // Might be plain text (backward compatibility)
      return encryptedText
    }
    
    const salt = Buffer.from(parts[0], 'hex')
    const iv = Buffer.from(parts[1], 'hex')
    const tag = Buffer.from(parts[2], 'hex')
    const encrypted = parts[3]
    
    const key = getKey(salt)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    // Return empty string on decryption failure for security
    return ''
  }
}

/**
 * Checks if a string is encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false
  const parts = text.split(':')
  return parts.length === 4 && parts.every(part => /^[0-9a-f]+$/.test(part))
}
