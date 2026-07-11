import crypto from 'crypto'
import { isDryRun } from '@/lib/dev/dry-run'

/**
 * Criptografia AES-256-GCM para access_tokens do Meta antes de salvar no banco.
 * Nunca salvamos tokens em texto puro.
 *
 * TOKEN_ENCRYPTION_KEY precisa ser uma string hex de 64 chars (32 bytes).
 * Gerar com: openssl rand -hex 32
 */

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY ausente ou inválida (precisa ter 64 chars hex / 32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export interface EncryptedToken {
  encrypted: string // ciphertext + authTag, em hex
  iv: string        // IV usado, em hex — precisa ser salvo junto
}

export function encryptToken(plainText: string): EncryptedToken {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96 bits, recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString('hex'),
    iv: iv.toString('hex'),
  }
}

export function decryptToken(encryptedHex: string, ivHex: string): string {
  // Dry-run: os tokens semeados são placeholders (não são ciphertext real).
  if (isDryRun()) return 'dry-run-fake-token'

  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const data = Buffer.from(encryptedHex, 'hex')

  const authTag = data.subarray(data.length - 16)
  const ciphertext = data.subarray(0, data.length - 16)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
