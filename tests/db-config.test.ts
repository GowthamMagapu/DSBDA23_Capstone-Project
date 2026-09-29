import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { buildMariaDbConfig } from '@/lib/db-config'

const envKeys = ['DATABASE_SSL', 'DATABASE_SSL_CA', 'DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL'] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

describe('buildMariaDbConfig — connection settings', () => {
  test('parses credentials, decoding URL-escaped characters', () => {
    const config = buildMariaDbConfig(new URL('mysql://app%40user:p%23ss@db.example.com:4000/talentflow'))
    assert.equal(config.host, 'db.example.com')
    assert.equal(config.port, 4000)
    assert.equal(config.user, 'app@user')
    assert.equal(config.password, 'p#ss')
    assert.equal(config.database, 'talentflow')
  })

  test('allows public key retrieval only for a local database', () => {
    assert.equal(buildMariaDbConfig(new URL('mysql://u:p@localhost:3306/db')).allowPublicKeyRetrieval, true)
    assert.equal(buildMariaDbConfig(new URL('mysql://u:p@db.example.com:3306/db')).allowPublicKeyRetrieval, false)
  })
})

describe('buildMariaDbConfig — TLS for hosted databases', () => {
  test('is off by default so local MySQL keeps working', () => {
    delete process.env.DATABASE_SSL
    assert.equal(buildMariaDbConfig(new URL('mysql://u:p@localhost:3306/db')).ssl, undefined)
  })

  test('is enabled by the Prisma CLI parameter sslaccept=strict', () => {
    const config = buildMariaDbConfig(new URL('mysql://u:p@gateway.tidbcloud.com:4000/db?sslaccept=strict'))
    assert.deepEqual(config.ssl, { rejectUnauthorized: true })
    assert.equal(config.database, 'db', 'query string must not leak into the database name')
  })

  test('is enabled by DATABASE_SSL=true and always verifies the certificate', () => {
    process.env.DATABASE_SSL = 'true'
    assert.deepEqual(buildMariaDbConfig(new URL('mysql://u:p@db.example.com:3306/db')).ssl, { rejectUnauthorized: true })
  })

  test('uses DATABASE_SSL_CA, restoring newlines flattened by env UIs', () => {
    process.env.DATABASE_SSL = 'true'
    process.env.DATABASE_SSL_CA = '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----\\n'
    assert.deepEqual(buildMariaDbConfig(new URL('mysql://u:p@db.example.com:3306/db')).ssl, {
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----',
    })
  })
})
