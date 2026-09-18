import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getAppUrl, buildPublicJobUrl } from '@/lib/app-url'
import { escapeHtml } from '@/lib/email'

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
const originalAuthUrl = process.env.NEXTAUTH_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  process.env.NEXTAUTH_URL = originalAuthUrl
})

describe('app-url — public links shared to LinkedIn and email', () => {
  test('prefers NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://agentu.example.com'
    assert.equal(getAppUrl(), 'https://agentu.example.com')
  })

  test('strips a trailing slash so joined paths never double up', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://agentu.example.com/'
    assert.equal(getAppUrl(), 'https://agentu.example.com')
    assert.equal(buildPublicJobUrl('engineer-ab12cd'), 'https://agentu.example.com/careers/engineer-ab12cd')
  })

  test('falls back to NEXTAUTH_URL, then to localhost', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXTAUTH_URL = 'https://fallback.example.com'
    assert.equal(getAppUrl(), 'https://fallback.example.com')

    delete process.env.NEXTAUTH_URL
    assert.equal(getAppUrl(), 'http://localhost:3000')
  })
})

describe('escapeHtml — recruiter notification emails', () => {
  test('escapes the five characters that break out of HTML context', () => {
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;')
    assert.equal(escapeHtml('a & b'), 'a &amp; b')
    assert.equal(escapeHtml('say "hi"'), 'say &quot;hi&quot;')
    assert.equal(escapeHtml("it's"), 'it&#39;s')
  })

  test('escapes ampersands before other entities, so output is not double-encoded', () => {
    assert.equal(escapeHtml('&lt;'), '&amp;lt;')
  })

  test('neutralises a candidate name carrying markup', () => {
    // Candidate names reach the recruiter's inbox, so they are untrusted input.
    const escaped = escapeHtml('<img src=x onerror=alert(1)>')
    assert.ok(!escaped.includes('<'))
    assert.ok(!escaped.includes('>'))
  })

  test('leaves ordinary text unchanged', () => {
    assert.equal(escapeHtml('Priya Raghavan'), 'Priya Raghavan')
  })
})
