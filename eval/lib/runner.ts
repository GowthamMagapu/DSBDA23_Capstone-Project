import { createHash } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { analyzeApplication, keywordFallback, type ApplicationAnalysis } from '@/lib/application-analysis'

// Wraps the production scorer with the three things an experiment needs and the app doesn't:
// a request throttle (Gemini's free tier allows ~10 requests/minute), latency capture, and a
// disk cache so re-running a report doesn't re-spend the daily quota.

const CACHE_DIR = join(process.cwd(), 'eval', 'results', '.cache')
const REQUESTS_PER_MINUTE = Number(process.env.EVAL_RPM ?? 10)
const MIN_INTERVAL_MS = Math.ceil(60_000 / Math.max(1, REQUESTS_PER_MINUTE))

export type Condition = 'gemini' | 'keyword'

export type ScoreResult = ApplicationAnalysis & {
  latencyMs: number
  /** True when the AI call failed and the production code silently fell back to keyword scoring. */
  degraded: boolean
  cached: boolean
}

// `analyzeApplication` swallows every AI error and returns keyword scores instead. That is
// correct for production — a recruiter should still get a ranked pipeline when Gemini is down —
// but it is silent, so an experiment can keep recording numbers long after the AI stopped
// running and report fallback behaviour as model behaviour. This happened on the first run of
// this harness: a free-tier daily quota of 20 requests was exhausted six calls in, and the
// remaining 42 observations were keyword scores wearing an AI label.
//
// The breaker below makes that failure loud instead of silent.
const MAX_CONSECUTIVE_DEGRADED = Number(process.env.EVAL_MAX_DEGRADED ?? 3)

let lastRequestAt = 0
let apiCallCount = 0
let consecutiveDegraded = 0

export class DegradationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DegradationError'
  }
}

export function apiCallsUsed() {
  return apiCallCount
}

export function resetBreaker() {
  consecutiveDegraded = 0
}

/**
 * Asks the API directly why it is failing. Used only when the breaker trips, because
 * `analyzeApplication` has already discarded the underlying error by then.
 */
async function diagnose(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return 'GEMINI_API_KEY is not set.'

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }),
        signal: AbortSignal.timeout(20000),
      }
    )
    if (response.ok) return 'A direct probe succeeded, so the failure is intermittent rather than a hard block.'

    const body = (await response.json()) as {
      error?: { message?: string; details?: { '@type'?: string; violations?: { quotaId?: string; quotaValue?: string }[] }[] }
    }
    const violation = body.error?.details
      ?.find((detail) => detail['@type']?.includes('QuotaFailure'))
      ?.violations?.[0]

    if (violation) {
      return `HTTP ${response.status}: quota ${violation.quotaId} limit ${violation.quotaValue} for model ${model}.`
    }
    return `HTTP ${response.status}: ${(body.error?.message ?? '').slice(0, 300)}`
  } catch (error) {
    return `probe threw: ${error instanceof Error ? error.message : String(error)}`
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Serialises calls so we never exceed the configured requests-per-minute ceiling. */
async function throttle() {
  const waitFor = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (waitFor > 0) await sleep(waitFor)
  lastRequestAt = Date.now()
}

function cacheKey(parts: unknown[]) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)
}

function readCache(key: string): ScoreResult | null {
  const file = join(CACHE_DIR, `${key}.json`)
  if (!existsSync(file)) return null
  try {
    return { ...(JSON.parse(readFileSync(file, 'utf8')) as ScoreResult), cached: true }
  } catch {
    return null
  }
}

function writeCache(key: string, result: ScoreResult) {
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(result, null, 2))
}

export type ScoreRequest = {
  resumeText: string
  jobTitle: string
  requirements: string
  condition: Condition
  /** Distinguishes repeated trials of the same pair so each gets its own cache entry. */
  trial?: number
  /** Set for the determinism study, where a cache hit would defeat the measurement. */
  noCache?: boolean
}

/**
 * Scores one (job, resume) pair under one condition.
 *
 * The `gemini` condition calls `analyzeApplication` — the exact function the app runs in
 * production — so the measurement reflects shipped behaviour including its fallback path.
 * The `keyword` condition calls the same `keywordFallback` the app degrades to, which gives
 * a baseline that needs no network and is perfectly deterministic.
 */
export async function score(request: ScoreRequest): Promise<ScoreResult> {
  const { resumeText, jobTitle, requirements, condition, trial = 0, noCache = false } = request

  if (condition === 'keyword') {
    const startedAt = performance.now()
    const fallback = keywordFallback(resumeText, requirements)
    return {
      score: fallback.score,
      status: fallback.status,
      aiSummary: '',
      matchedSkills: [],
      missingSkills: [],
      latencyMs: performance.now() - startedAt,
      degraded: false,
      cached: false,
    }
  }

  // The model is part of the key: results are not interchangeable across models, and a run
  // that switches model must not be served another model's cached scores.
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const key = cacheKey([model, jobTitle, requirements, resumeText, condition, trial])
  if (!noCache) {
    const hit = readCache(key)
    if (hit) return hit
  }

  await throttle()
  apiCallCount += 1

  const startedAt = performance.now()
  const analysis = await analyzeApplication(resumeText, jobTitle, requirements)
  const latencyMs = performance.now() - startedAt

  // `analyzeApplication` swallows AI errors and returns keyword scores with an empty summary.
  // That empty summary is the only signal available that the AI path did not run.
  const result: ScoreResult = {
    ...analysis,
    latencyMs,
    degraded: analysis.aiSummary === '',
    cached: false,
  }

  if (result.degraded) {
    consecutiveDegraded += 1
    if (consecutiveDegraded >= MAX_CONSECUTIVE_DEGRADED) {
      throw new DegradationError(
        `${consecutiveDegraded} consecutive AI calls fell back to keyword scoring, so every ` +
        `further observation would measure the fallback rather than the model.\n` +
        `  Reason: ${await diagnose()}\n` +
        `  Observations already cached are kept; re-run once the cause is resolved.`
      )
    }
  } else {
    consecutiveDegraded = 0
  }

  // Degraded observations are never cached. Caching them would make an invalid result
  // permanent and invisible on every later run.
  if (!noCache && !result.degraded) writeCache(key, result)
  return result
}

/**
 * Probes the API once before an experiment spends its quota, so a missing key or an
 * exhausted daily limit surfaces as one clear message instead of N silent degradations.
 */
export async function preflight(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, detail: 'GEMINI_API_KEY is not set — every AI condition would silently degrade to keyword scoring.' }
  }
  const probe = await score({
    resumeText: 'Software engineer with 5 years of TypeScript and React experience.',
    jobTitle: 'Frontend Engineer',
    requirements: 'TypeScript, React',
    condition: 'gemini',
    noCache: true,
  })
  return probe.degraded
    ? { ok: false, detail: 'The AI call failed (quota, network, or key). Results would measure the fallback, not the model.' }
    : { ok: true, detail: `AI path healthy (${Math.round(probe.latencyMs)}ms on the probe call).` }
}
