import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  fallbackCandidateEmail,
  formatInterviewTime,
  isCandidateEmailKind,
  isPipelineStage,
  pipelineStageOf,
} from '@/lib/management'
import { candidateEmailHtml, draftCandidateEmail } from '@/lib/candidate-email'

const originalFetch = globalThis.fetch
const originalKey = process.env.GEMINI_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = originalKey
})

const base = { candidateName: 'Asha Rao', jobTitle: 'Frontend Engineer', companyName: 'Acme' }

describe('pipeline stages', () => {
  test('accepts only the known stages', () => {
    assert.equal(isPipelineStage('interview'), true)
    assert.equal(isPipelineStage('selected'), false, 'the AI band is not a pipeline stage')
    assert.equal(isPipelineStage(undefined), false)
  })

  test('reads unknown or missing stages as applied', () => {
    assert.equal(pipelineStageOf(null), 'applied')
    assert.equal(pipelineStageOf('offer'), 'offer')
  })

  test('accepts only the known email kinds', () => {
    assert.equal(isCandidateEmailKind('rejection'), true)
    assert.equal(isCandidateEmailKind('spam'), false)
  })
})

describe('formatInterviewTime', () => {
  test('formats in the recruiter time zone and names it', () => {
    // Exact punctuation varies between ICU versions, so check the parts that matter.
    const formatted = formatInterviewTime('2026-11-03T05:00:00Z', 'Asia/Kolkata')
    assert.match(formatted, /Tuesday/)
    assert.match(formatted, /3 November 2026/)
    assert.match(formatted, /10:30/)
    assert.match(formatted, /\(Asia\/Kolkata\)$/)
  })

  test('falls back to UTC for an unknown zone instead of throwing', () => {
    assert.match(formatInterviewTime('2026-11-03T05:00:00Z', 'Mars/Olympus'), /\(UTC\)$/)
  })
})

describe('fallbackCandidateEmail', () => {
  test('an interview invitation carries the time and link', () => {
    const email = fallbackCandidateEmail({ ...base, kind: 'interview', interviewAt: '2026-11-03T05:00:00Z', interviewLink: 'https://meet.example/abc', timeZone: 'Asia/Kolkata' })
    assert.match(email.subject, /Interview invitation: Frontend Engineer at Acme/)
    assert.match(email.body, /Dear Asha Rao,/)
    assert.match(email.body, /10:30 \(Asia\/Kolkata\)/)
    assert.match(email.body, /https:\/\/meet\.example\/abc/)
  })

  test('an interview invitation without a time says it will be confirmed', () => {
    const email = fallbackCandidateEmail({ ...base, kind: 'interview' })
    assert.match(email.body, /a time we will confirm with you shortly/)
    assert.doesNotMatch(email.body, /undefined|null|Join here/)
  })

  test('rejection and offer emails are complete and distinct', () => {
    const rejection = fallbackCandidateEmail({ ...base, kind: 'rejection' })
    const offer = fallbackCandidateEmail({ ...base, kind: 'offer' })
    assert.match(rejection.body, /not to move forward/)
    assert.match(offer.body, /delighted to offer you/)
    assert.notEqual(rejection.subject, offer.subject)
  })
})

describe('draftCandidateEmail', () => {
  test('uses the AI draft when the model answers', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    globalThis.fetch = (async () => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ subject: 'Hello', body: 'Dear Asha, ...' }) }] } }],
    })) as typeof fetch
    const draft = await draftCandidateEmail({ ...base, kind: 'offer' })
    assert.deepEqual(draft, { subject: 'Hello', body: 'Dear Asha, ...', aiGenerated: true })
  })

  test('falls back to the template, with a reason, when the model fails', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    globalThis.fetch = (async () => Response.json({ error: { message: 'quota' } }, { status: 429 })) as typeof fetch
    const draft = await draftCandidateEmail({ ...base, kind: 'rejection' })
    assert.equal(draft.aiGenerated, false)
    assert.match(draft.fallbackReason ?? '', /429/)
    assert.equal(draft.subject, fallbackCandidateEmail({ ...base, kind: 'rejection' }).subject)
  })

  test('falls back without calling the model when no API key is set', async () => {
    delete process.env.GEMINI_API_KEY
    globalThis.fetch = (async () => { throw new Error('should not be called') }) as typeof fetch
    const draft = await draftCandidateEmail({ ...base, kind: 'interview' })
    assert.equal(draft.aiGenerated, false)
    assert.match(draft.fallbackReason ?? '', /not configured/)
  })
})

describe('candidateEmailHtml', () => {
  test('escapes the recruiter text and keeps paragraphs and line breaks', () => {
    const html = candidateEmailHtml('Hi <b>Asha</b>\nLine two\n\nNext', 'Acme & Co')
    assert.match(html, /Hi &lt;b&gt;Asha&lt;\/b&gt;<br>Line two/)
    assert.match(html, /<p[^>]*>Next<\/p>/)
    assert.match(html, /Acme &amp; Co/)
  })
})
