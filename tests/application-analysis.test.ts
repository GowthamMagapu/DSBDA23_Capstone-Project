import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { keywordFallback } from '@/lib/application-analysis'

// The scorer the app degrades to when Gemini is unavailable, and the baseline condition
// in the evaluation (eval/README.md). Its behaviour is therefore load-bearing twice over.
describe('keywordFallback — degraded scoring path', () => {
  test('scores the fraction of distinct requirement terms present in the resume', () => {
    // Requirement terms of length >= 3: "react", "typescript". One of two present.
    const result = keywordFallback('Experienced with React and Vue.', 'React TypeScript')
    assert.equal(result.score, 50)
  })

  test('scores 100 when every requirement term appears', () => {
    assert.equal(keywordFallback('React and TypeScript daily.', 'React TypeScript').score, 100)
  })

  test('scores 0 when none appear', () => {
    assert.equal(keywordFallback('Accountant, statutory reporting.', 'React TypeScript').score, 0)
  })

  test('is case-insensitive', () => {
    assert.equal(keywordFallback('REACT and TYPESCRIPT', 'react typescript').score, 100)
  })

  test('ignores terms shorter than three characters', () => {
    // "Go" and "R" are dropped, so only "python" counts and it is present.
    assert.equal(keywordFallback('Python developer.', 'Go R Python').score, 100)
  })

  test('counts each distinct term once, so repetition cannot inflate the score', () => {
    const repeated = keywordFallback('React React React React.', 'React TypeScript')
    assert.equal(repeated.score, 50)
  })

  test('returns 0 rather than dividing by zero when requirements have no usable terms', () => {
    const result = keywordFallback('Any resume text.', '!! ?? a b')
    assert.equal(result.score, 0)
    assert.equal(result.status, 'rejected')
  })

  test('maps scores onto the production decision bands', () => {
    // >= 70 selected, >= 40 review, otherwise rejected.
    const bandFor = (present: number, total: number) => {
      const terms = Array.from({ length: total }, (_, i) => `term${String(i).padStart(3, '0')}`)
      const resume = terms.slice(0, present).join(' ')
      return keywordFallback(resume, terms.join(' ')).status
    }
    assert.equal(bandFor(10, 10), 'selected', '100% -> selected')
    assert.equal(bandFor(7, 10), 'selected', '70% is the selected boundary')
    assert.equal(bandFor(6, 10), 'review', '60% -> review')
    assert.equal(bandFor(4, 10), 'review', '40% is the review boundary')
    assert.equal(bandFor(3, 10), 'rejected', '30% -> rejected')
    assert.equal(bandFor(0, 10), 'rejected', '0% -> rejected')
  })

  test('substring matches are accepted by design — a known limitation', () => {
    // "java" is contained in "javascript", so a JavaScript developer scores for Java.
    // Documented here so the behaviour is a recorded decision rather than a surprise.
    assert.equal(keywordFallback('JavaScript developer.', 'Java').score, 100)
  })
})
