import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { encryptSecret, decryptSecret } from '@/lib/secret-box'

// secret-box derives its key from AUTH_SECRET on every call rather than at import time,
// so setting it in the module body is sufficient: tests run after the body executes.
process.env.AUTH_SECRET = 'test-secret-for-unit-tests'

describe('secret-box — LinkedIn token encryption at rest', () => {
  test('round-trips a value through encrypt and decrypt', () => {
    const token = 'AQX-linkedin-access-token-value'
    assert.equal(decryptSecret(encryptSecret(token)), token)
  })

  test('produces a different ciphertext each time (random IV)', () => {
    const token = 'same-plaintext'
    const first = encryptSecret(token)
    const second = encryptSecret(token)
    assert.notEqual(first, second, 'a fixed IV would leak that two tokens are identical')
    assert.equal(decryptSecret(first), token)
    assert.equal(decryptSecret(second), token)
  })

  test('emits the documented v1:iv:tag:data envelope', () => {
    const parts = encryptSecret('value').split(':')
    assert.equal(parts.length, 4)
    assert.equal(parts[0], 'v1')
  })

  test('returns null when the ciphertext has been tampered with', () => {
    const [version, iv, tag, data] = encryptSecret('value').split(':')
    const flipped = Buffer.from(data, 'base64')
    flipped[0] ^= 0xff
    const tampered = [version, iv, tag, flipped.toString('base64')].join(':')
    assert.equal(decryptSecret(tampered), null, 'GCM auth tag must reject modified ciphertext')
  })

  test('returns null when decrypted under a different AUTH_SECRET', () => {
    const payload = encryptSecret('value')
    process.env.AUTH_SECRET = 'a-rotated-secret'
    const result = decryptSecret(payload)
    process.env.AUTH_SECRET = 'test-secret-for-unit-tests'
    assert.equal(result, null, 'rotating AUTH_SECRET must invalidate stored tokens, not crash')
  })

  test('returns null for malformed payloads instead of throwing', () => {
    for (const bad of ['', 'not-encrypted', 'v1:only:three', 'v2:a:b:c']) {
      assert.equal(decryptSecret(bad), null, `should reject: ${bad}`)
    }
  })
})
