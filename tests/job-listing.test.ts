import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createSlug } from '@/lib/job-listing'

describe('createSlug — public job URLs', () => {
  test('lowercases and hyphenates a title', () => {
    assert.match(createSlug('Senior Frontend Engineer'), /^senior-frontend-engineer-[a-z0-9]+$/)
  })

  test('collapses punctuation and symbols into single hyphens', () => {
    const slug = createSlug('Senior Frontend Engineer (React & TypeScript)')
    assert.match(slug, /^[a-z0-9-]+$/, 'slug must be URL-safe')
    assert.ok(!slug.includes('--'), 'runs of punctuation must not produce empty segments')
  })

  test('never leaves a leading or trailing hyphen on the base', () => {
    const slug = createSlug('!!! Engineer !!!')
    assert.ok(!slug.startsWith('-'))
    assert.match(slug, /^engineer-[a-z0-9]+$/)
  })

  test('appends a random suffix so identical titles do not collide', () => {
    // slug is @unique in the schema, so two identical titles must not produce one value.
    const slugs = new Set(Array.from({ length: 200 }, () => createSlug('Backend Engineer')))
    assert.equal(slugs.size, 200, 'every generated slug should be distinct')
  })

  test('caps the base at 60 characters before the suffix', () => {
    const [base] = createSlug('word '.repeat(60)).split(/-(?=[a-z0-9]+$)/)
    assert.ok(base.length <= 60, `base was ${base.length} characters`)
  })

  test('falls back to "role" when the title has no usable characters', () => {
    assert.match(createSlug('!!!'), /^role-[a-z0-9]+$/)
    assert.match(createSlug(''), /^role-[a-z0-9]+$/)
  })
})
