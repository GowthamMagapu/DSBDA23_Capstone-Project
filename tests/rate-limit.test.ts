import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Buckets are module-level and shared, so every test uses a unique key.
let counter = 0
const freshKey = () => `test-key-${counter++}-${Math.random()}`

describe('rate-limit — public application endpoint throttle', () => {
  test('allows requests up to the limit and blocks the one after', () => {
    const key = freshKey()
    for (let i = 1; i <= 5; i += 1) {
      assert.equal(checkRateLimit(key, 5, 60_000), true, `request ${i} should be allowed`)
    }
    assert.equal(checkRateLimit(key, 5, 60_000), false, 'the 6th request must be blocked')
  })

  test('keeps blocking once the limit is reached', () => {
    const key = freshKey()
    checkRateLimit(key, 1, 60_000)
    assert.equal(checkRateLimit(key, 1, 60_000), false)
    assert.equal(checkRateLimit(key, 1, 60_000), false)
  })

  test('tracks each key independently', () => {
    const a = freshKey()
    const b = freshKey()
    assert.equal(checkRateLimit(a, 1, 60_000), true)
    assert.equal(checkRateLimit(a, 1, 60_000), false)
    assert.equal(checkRateLimit(b, 1, 60_000), true, 'one IP must not throttle another')
  })

  test('resets after the window expires', async () => {
    const key = freshKey()
    assert.equal(checkRateLimit(key, 1, 20), true)
    assert.equal(checkRateLimit(key, 1, 20), false)
    await new Promise((resolve) => setTimeout(resolve, 40))
    assert.equal(checkRateLimit(key, 1, 20), true, 'a new window must admit requests again')
  })
})

describe('rate-limit — client IP extraction', () => {
  const withHeaders = (headers: Record<string, string>) => ({ headers: new Headers(headers) })

  test('takes the first entry of x-forwarded-for', () => {
    assert.equal(getClientIp(withHeaders({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' })), '203.0.113.5')
  })

  test('trims whitespace around the forwarded value', () => {
    assert.equal(getClientIp(withHeaders({ 'x-forwarded-for': '  203.0.113.5  ' })), '203.0.113.5')
  })

  test('falls back to x-real-ip, then to "unknown"', () => {
    assert.equal(getClientIp(withHeaders({ 'x-real-ip': '198.51.100.7' })), '198.51.100.7')
    assert.equal(getClientIp(withHeaders({})), 'unknown')
  })

  test('does not throw on a null or undefined request', () => {
    assert.equal(getClientIp(null), 'unknown')
    assert.equal(getClientIp(undefined), 'unknown')
  })
})
