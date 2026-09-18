import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { companySchema, describeCompany } from '@/lib/company'

const valid = {
  name: 'Northwind Commerce',
  about: 'We build commerce infrastructure for independent retailers across Europe.',
  notifyOnApplication: true,
}

describe('companySchema — the brief that grounds every AI prompt', () => {
  test('accepts a minimal valid profile and defaults notifyOnApplication', () => {
    const parsed = companySchema.safeParse({ name: valid.name, about: valid.about })
    assert.equal(parsed.success, true)
    assert.equal(parsed.data?.notifyOnApplication, true)
  })

  test('rejects a company name shorter than two characters', () => {
    assert.equal(companySchema.safeParse({ ...valid, name: 'A' }).success, false)
  })

  test('rejects an "about" shorter than 30 characters', () => {
    // Too thin a brief produces a poor listing, so the floor is enforced at the boundary.
    assert.equal(companySchema.safeParse({ ...valid, about: 'We sell things.' }).success, false)
  })

  test('normalises blank optional fields to null rather than empty strings', () => {
    const parsed = companySchema.safeParse({ ...valid, industry: '', location: '   ' })
    assert.equal(parsed.success, true)
    assert.equal(parsed.data?.industry, null)
    assert.equal(parsed.data?.location, null)
  })

  test('requires a website to carry an http(s) scheme when present', () => {
    assert.equal(companySchema.safeParse({ ...valid, website: 'example.com' }).success, false)
    assert.equal(companySchema.safeParse({ ...valid, website: 'https://example.com' }).success, true)
  })

  test('validates the notification email when one is supplied', () => {
    assert.equal(companySchema.safeParse({ ...valid, notificationEmail: 'not-an-email' }).success, false)
    assert.equal(companySchema.safeParse({ ...valid, notificationEmail: 'hr@example.com' }).success, true)
  })

  test('trims surrounding whitespace on the name', () => {
    const parsed = companySchema.safeParse({ ...valid, name: '  Northwind  ' })
    assert.equal(parsed.data?.name, 'Northwind')
  })
})

describe('describeCompany — prompt grounding', () => {
  test('includes the company name and about text in the brief', () => {
    const brief = describeCompany({
      name: 'Northwind Commerce',
      website: null,
      industry: 'Retail technology',
      location: 'Lisbon',
      size: null,
      about: 'We build commerce infrastructure.',
      culture: null,
    })
    assert.match(brief, /Northwind Commerce/)
    assert.match(brief, /We build commerce infrastructure/)
    assert.match(brief, /Lisbon/)
  })
})
