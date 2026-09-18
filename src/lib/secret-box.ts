import crypto from 'crypto'

// AES-256-GCM encryption for third-party credentials (e.g. LinkedIn access tokens) at rest.
// The key is derived from AUTH_SECRET, so rotating that secret invalidates stored tokens and
// recruiters simply reconnect.

function getKey() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required to encrypt stored credentials')
  return crypto.createHash('sha256').update(`secret-box:${secret}`).digest()
}

export function encryptSecret(plainText: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

/** Returns null when the value can't be decrypted (tampered, or AUTH_SECRET changed). */
export function decryptSecret(payload: string): string | null {
  const [version, iv, tag, data] = payload.split(':')
  if (version !== 'v1' || !iv || !tag || !data) return null
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
