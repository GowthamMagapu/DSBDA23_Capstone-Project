import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { createJwtAssertion, notifyGoogleIndexing, readServiceAccount } from '@/lib/google-indexing'
import { configuredChannels, postToChannel } from '@/lib/job-channels'

const envKeys = ['GOOGLE_INDEXING_CREDENTIALS', 'DISCORD_WEBHOOK_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const originalFetch = globalThis.fetch

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
  globalThis.fetch = originalFetch
})

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const account = { client_email: 'indexer@project.iam.gserviceaccount.com', private_key: privatePem }

/** Replaces fetch, recording each call and answering with the given responses in order. */
function mockFetch(...responses: Response[]) {
  const calls: { url: string; body: string }[] = []
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') })
    return responses.shift() ?? new Response('unexpected call', { status: 500 })
  }) as typeof fetch
  return calls
}

describe('readServiceAccount', () => {
  test('parses the JSON key and restores newlines flattened by env UIs', () => {
    const flattened = JSON.stringify({ ...account, private_key: privatePem.replace(/\n/g, '\\n') })
    assert.deepEqual(readServiceAccount(flattened), account)
  })

  test('returns null for missing, malformed, or incomplete credentials', () => {
    assert.equal(readServiceAccount(undefined), null)
    assert.equal(readServiceAccount('{not json'), null)
    assert.equal(readServiceAccount(JSON.stringify({ client_email: 'x' })), null)
  })
})

describe('createJwtAssertion — service-account auth', () => {
  test('produces an RS256 JWT with the indexing scope, verifiable with the public key', () => {
    const jwt = createJwtAssertion(account, 1_700_000_000)
    const [header, payload, signature] = jwt.split('.')
    assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), { alg: 'RS256', typ: 'JWT' })
    assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    })
    const valid = crypto.createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, 'base64url'))
    assert.equal(valid, true)
  })
})

describe('notifyGoogleIndexing', () => {
  test('is skipped without credentials and makes no request', async () => {
    delete process.env.GOOGLE_INDEXING_CREDENTIALS
    const calls = mockFetch()
    assert.equal((await notifyGoogleIndexing('https://x.test/careers/a', 'URL_UPDATED')).status, 'skipped')
    assert.equal(calls.length, 0)
  })

  test('exchanges the JWT for a token, then publishes the URL notification', async () => {
    process.env.GOOGLE_INDEXING_CREDENTIALS = JSON.stringify(account)
    const calls = mockFetch(Response.json({ access_token: 'tok' }), Response.json({}))
    const result = await notifyGoogleIndexing('https://x.test/careers/a', 'URL_DELETED')
    assert.equal(result.status, 'notified')
    assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token')
    assert.equal(calls[1].url, 'https://indexing.googleapis.com/v3/urlNotifications:publish')
    assert.deepEqual(JSON.parse(calls[1].body), { url: 'https://x.test/careers/a', type: 'URL_DELETED' })
  })

  test('explains a 403 as a missing Search Console ownership', async () => {
    process.env.GOOGLE_INDEXING_CREDENTIALS = JSON.stringify(account)
    mockFetch(Response.json({ access_token: 'tok' }), new Response('Permission denied', { status: 403 }))
    const result = await notifyGoogleIndexing('https://x.test/careers/a', 'URL_UPDATED')
    assert.equal(result.status, 'failed')
    assert.match(result.message, /Owner of the site in Google Search Console/)
  })
})

describe('job channels — Discord and Telegram', () => {
  test('only lists fully configured channels', () => {
    delete process.env.DISCORD_WEBHOOK_URL
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
    delete process.env.TELEGRAM_CHAT_ID
    assert.deepEqual(configuredChannels(), [])
    process.env.TELEGRAM_CHAT_ID = '@agentu_jobs'
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/secret'
    assert.deepEqual(configuredChannels(), ['discord', 'telegram'])
  })

  test('posts to Discord within its 2000-character limit', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/secret'
    const calls = mockFetch(new Response(null, { status: 204 }))
    const result = await postToChannel('discord', 'x'.repeat(2500))
    assert.equal(result.status, 'posted')
    assert.equal(JSON.parse(calls[0].body).content.length, 2000)
  })

  test('posts to the configured Telegram chat', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
    process.env.TELEGRAM_CHAT_ID = '@agentu_jobs'
    const calls = mockFetch(Response.json({ ok: true }))
    assert.equal((await postToChannel('telegram', 'We are hiring')).status, 'posted')
    assert.equal(calls[0].url, 'https://api.telegram.org/botbot-token/sendMessage')
    assert.deepEqual(JSON.parse(calls[0].body), { chat_id: '@agentu_jobs', text: 'We are hiring' })
  })

  test('never leaks the secret token into failure messages', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'super-secret-token'
    process.env.TELEGRAM_CHAT_ID = '@agentu_jobs'
    globalThis.fetch = (async () => { throw new Error('network down') }) as typeof fetch
    const result = await postToChannel('telegram', 'We are hiring')
    assert.equal(result.status, 'failed')
    assert.equal(result.message.includes('super-secret-token'), false)
  })
})
