import { requirementTerms } from '@/lib/application-analysis'

/**
 * The screening analysis agent.
 *
 * The per-application scorer in `application-analysis.ts` answers "how good is this
 * candidate?". This module answers two different questions over a whole job's pipeline:
 *
 *   1. What does the score distribution actually look like, and how much of it should be
 *      believed at this sample size?
 *   2. Where did the screening itself probably go wrong?
 *
 * The failure detectors are not guesses. Each one corresponds to a failure mode measured
 * in the project's own evaluation (`eval/FINDINGS.md`, paper sections 7.3 to 7.8), and the
 * thresholds are the ones the evaluation used. The scorer degrades silently by design, so
 * without this pass a recruiter cannot tell an AI evaluation from a keyword fallback, or a
 * weak candidate from a resume that never parsed.
 *
 * Everything here is pure and synchronous: no database, no model calls. The route supplies
 * the rows, which keeps all of it directly testable.
 */

export type ScreeningBand = 'selected' | 'review' | 'rejected'

export const BANDS: ScreeningBand[] = ['selected', 'review', 'rejected']

/** The application fields the analysis needs. Deliberately narrow: no resume blobs. */
export type AnalysableApplication = {
  id: string
  candidateName: string
  score: number
  status: string
  aiSummary: string | null
  resumeText: string | null
  coverLetter: string | null
  resumeFileName: string | null
}

export type FailureCode =
  | 'fallback-scored'
  | 'thin-extraction'
  | 'possible-injection'
  | 'keyword-stuffing'

export type FailureFlag = {
  code: FailureCode
  severity: 'warning' | 'error'
  title: string
  detail: string
}

export type FlaggedApplication = {
  applicationId: string
  candidateName: string
  score: number
  flags: FailureFlag[]
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export type ScoreStatistics = {
  n: number
  mean: number
  median: number
  sd: number
  min: number
  max: number
  p25: number
  p75: number
  iqr: number
}

/** Linear-interpolated percentile over an already-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const position = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * Spread, not just the average. A mean of 55 over scores of {54, 55, 56} and over
 * {10, 55, 100} describe very different pipelines, and only the second is worth a
 * recruiter's attention.
 */
export function scoreStatistics(scores: number[]): ScoreStatistics {
  if (scores.length === 0) {
    return { n: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0, p25: 0, p75: 0, iqr: 0 }
  }

  const sorted = [...scores].sort((a, b) => a - b)
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length
  // Sample standard deviation (n-1); a single observation has no spread to report.
  const sd = scores.length < 2
    ? 0
    : Math.sqrt(scores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (scores.length - 1))

  const p25 = percentile(sorted, 25)
  const p75 = percentile(sorted, 75)

  return {
    n: scores.length,
    mean: round1(mean),
    median: round1(percentile(sorted, 50)),
    sd: round1(sd),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25: round1(p25),
    p75: round1(p75),
    iqr: round1(p75 - p25),
  }
}

/**
 * Wilson score interval for a proportion. Used instead of the textbook normal
 * approximation because application counts here are small and often land on 0 or 100 %,
 * where the normal interval produces a zero-width interval or runs outside [0, 1].
 */
export function wilsonInterval(successes: number, total: number, z = 1.96): { low: number; high: number } {
  if (total <= 0) return { low: 0, high: 0 }

  const proportion = successes / total
  const denominator = 1 + (z * z) / total
  const centre = proportion + (z * z) / (2 * total)
  const spread = z * Math.sqrt((proportion * (1 - proportion)) / total + (z * z) / (4 * total * total))

  return {
    low: Math.max(0, (centre - spread) / denominator),
    high: Math.min(1, (centre + spread) / denominator),
  }
}

export type BandShare = {
  band: ScreeningBand
  count: number
  share: number
  ciLow: number
  ciHigh: number
}

/** Band counts with a 95 % interval on each share, so a small pipeline reads as uncertain. */
export function bandBreakdown(statuses: string[]): BandShare[] {
  const total = statuses.length
  return BANDS.map((band) => {
    const count = statuses.filter((status) => status === band).length
    const { low, high } = wilsonInterval(count, total)
    return {
      band,
      count,
      share: total === 0 ? 0 : count / total,
      ciLow: low,
      ciHigh: high,
    }
  })
}

export type ConfidenceLevel = 'insufficient' | 'low' | 'moderate' | 'reasonable'

/**
 * How much weight the numbers above can carry. The project's own evaluation reports
 * intervals rather than significance tests because 48 labelled pairs will not support
 * them; a single job with nine applicants supports far less, and the agent says so
 * rather than presenting a percentage as if it were settled.
 */
export function confidenceFor(n: number): { level: ConfidenceLevel; caveat: string } {
  if (n === 0) {
    return { level: 'insufficient', caveat: 'No applications yet, so there is nothing to analyse.' }
  }
  if (n < 5) {
    return {
      level: 'insufficient',
      caveat: `With ${n} application${n === 1 ? '' : 's'} these figures are descriptive only. Treat any percentage as a count, not a rate.`,
    }
  }
  if (n < 15) {
    return {
      level: 'low',
      caveat: `At ${n} applications the intervals below are wide. One more strong or weak candidate would move them noticeably.`,
    }
  }
  if (n < 40) {
    return {
      level: 'moderate',
      caveat: `At ${n} applications the shape of the pipeline is meaningful, but individual band shares still carry a wide interval.`,
    }
  }
  return {
    level: 'reasonable',
    caveat: `At ${n} applications the distribution is stable enough to act on.`,
  }
}

// ---------------------------------------------------------------------------
// Failure-mode detection
// ---------------------------------------------------------------------------

/** Below this many characters a resume carries no usable signal (evaluation E5). */
export const USABLE_EXTRACTION_CHARS = 200

/**
 * How much text was recovered from the uploaded file alone.
 *
 * The application route stores `resumeText` as the extracted document text, a newline,
 * and then the cover letter. A scanned PDF therefore still produces a long `resumeText`
 * purely from the cover letter, which is exactly what makes this failure invisible.
 */
export function extractedResumeLength(application: Pick<AnalysableApplication, 'resumeText' | 'coverLetter'>): number {
  const resumeText = application.resumeText ?? ''
  const coverLetter = application.coverLetter ?? ''
  if (!coverLetter) return resumeText.length

  const suffix = `\n${coverLetter}`
  if (resumeText.endsWith(suffix)) return resumeText.length - suffix.length

  // The pair is capped at 20 000 characters, so on a long application the cover letter
  // may have been truncated and the suffix will not match exactly.
  return Math.max(0, resumeText.length - coverLetter.length - 1)
}

/**
 * Instruction-like text inside a candidate-supplied document. Evaluation E4 confirmed a
 * single forged system turn can move a score from 0 to 95, so these are reported as
 * errors rather than warnings.
 *
 * Each pattern needs a verb and an object to fire. A resume that merely contains the word
 * "override" (every Java CV does) or "system" must not trip this.
 */
const INJECTION_PATTERNS: { pattern: RegExp; description: string }[] = [
  // A resume skills section legitimately starts lines with "Systems:", so the line must
  // also carry instruction vocabulary before this counts as an impersonated operator turn.
  { pattern: /^\s*systems?\s*:\s*(?=.*\b(?:override|instruct\w*|score|scoring|select\w*|shortlist\w*|approv\w*|ignore|directive|priority)\b)/im, description: 'a line beginning with "SYSTEM:" followed by an instruction, impersonating an operator turn' },
  { pattern: /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+(?:instruction|prompt|direction)/i, description: 'an instruction to ignore previous instructions' },
  { pattern: /(?:assign|give|set|award)\s+(?:a\s+|the\s+)?(?:score|rating)\s+(?:of\s+)?\d{1,3}/i, description: 'an instruction to assign a specific score' },
  { pattern: /(?:screening|evaluation|scoring)\s+override/i, description: 'a claimed screening override' },
  { pattern: /pre-?approved\s+(?:this\s+)?(?:candidate|applicant)/i, description: 'a claim that the candidate is pre-approved' },
  { pattern: /set\s+(?:the\s+)?status\s+(?:to|=)\s*["']?(?:selected|shortlist)/i, description: 'an instruction to set the decision status' },
  { pattern: /you\s+must\s+(?:select|shortlist|approve)\s+(?:this\s+)?(?:candidate|applicant)/i, description: 'a direct instruction to select the candidate' },
]

export function detectInjectionAttempt(text: string): string | null {
  if (!text) return null
  for (const { pattern, description } of INJECTION_PATTERNS) {
    if (pattern.test(text)) return description
  }
  return null
}

/** Date ranges such as "2021-2024" or "2022 - Present", the cheapest evidence of real history. */
const EXPERIENCE_RANGE = /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/i

/**
 * The keyword-stuffing pattern from evaluation E1: a document that matches most of the
 * requirement vocabulary while showing no employment history to back it. The model did not
 * see through this construction, so it is caught structurally instead.
 */
export function detectKeywordStuffing(
  resumeText: string,
  requirements: string
): { coverage: number; reason: string } | null {
  const terms = requirementTerms(requirements)
  if (terms.length === 0 || !resumeText) return null

  const haystack = resumeText.toLowerCase()
  const matched = terms.filter((term) => haystack.includes(term)).length
  const coverage = matched / terms.length
  const wordCount = resumeText.trim().split(/\s+/).filter(Boolean).length

  // High vocabulary coverage packed into a short document with no dated history.
  const dense = coverage >= 0.5 && wordCount > 0 && wordCount < 500
  const undated = !EXPERIENCE_RANGE.test(resumeText)

  if (dense && undated) {
    return {
      coverage,
      reason: `matches ${Math.round(coverage * 100)}% of the requirement vocabulary in ${wordCount} words, with no dated work history`,
    }
  }
  return null
}

/** Every failure detector, applied to one application. */
export function detectFailureModes(
  application: AnalysableApplication,
  requirements: string
): FailureFlag[] {
  const flags: FailureFlag[] = []

  // 1. The model was unavailable and the keyword fallback answered instead. The fallback
  //    returns an empty summary, which is the only signal the row carries.
  if (!application.aiSummary || application.aiSummary.trim() === '') {
    flags.push({
      code: 'fallback-scored',
      severity: 'warning',
      title: 'Not scored by the AI',
      detail:
        'This application carries no AI evaluation, which means the model call failed and the deterministic keyword fallback produced the score. Re-run the screening before treating this number as a judgement.',
    })
  }

  // 2. The uploaded file parsed without error but yielded almost nothing: a scanned,
  //    image-only document. Only meaningful when a file was actually attached.
  if (application.resumeFileName) {
    const extracted = extractedResumeLength(application)
    if (extracted < USABLE_EXTRACTION_CHARS) {
      flags.push({
        code: 'thin-extraction',
        severity: 'warning',
        title: 'Resume text could not be read',
        detail:
          `Only ${extracted} characters were recovered from ${application.resumeFileName}, below the ${USABLE_EXTRACTION_CHARS} needed to be usable. This is typically a scanned or image-only document, so the score reflects an almost empty resume rather than the candidate.`,
      })
    }
  }

  // 3. Candidate-supplied text that reads as an instruction to the screener.
  const injection = detectInjectionAttempt(application.resumeText ?? '')
  if (injection) {
    flags.push({
      code: 'possible-injection',
      severity: 'error',
      title: 'Possible prompt injection',
      detail:
        `The submitted text contains ${injection}. Candidate text is passed to the model on the same channel as the screening instructions, so this score cannot be trusted. Read the resume yourself before acting on it.`,
    })
  }

  // 4. Requirement vocabulary without the history to support it.
  const stuffing = detectKeywordStuffing(application.resumeText ?? '', requirements)
  if (stuffing) {
    flags.push({
      code: 'keyword-stuffing',
      severity: 'warning',
      title: 'Possible keyword stuffing',
      detail:
        `This resume ${stuffing.reason}. Padded documents score higher than they should, so confirm the experience is real before shortlisting.`,
    })
  }

  return flags
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type FailureSummary = {
  code: FailureCode
  count: number
  share: number
}

export type ScreeningAnalysis = {
  statistics: ScoreStatistics
  bands: BandShare[]
  confidence: { level: ConfidenceLevel; caveat: string }
  scoreSpreadNote: string
  failureSummary: FailureSummary[]
  flagged: FlaggedApplication[]
  trustworthyCount: number
  integrityNote: string
}

/** Human-readable reading of the spread, so the recruiter is not left to interpret an SD. */
function describeSpread(statistics: ScoreStatistics): string {
  if (statistics.n === 0) return 'No scores to describe yet.'
  if (statistics.n === 1) return `A single application scoring ${statistics.min}%.`

  if (statistics.iqr <= 5 && statistics.sd <= 8) {
    return `Scores are tightly clustered (middle half within ${statistics.iqr} points), so the ranking separates candidates only weakly. Expect the shortlist to hinge on small differences.`
  }
  if (statistics.iqr >= 30) {
    return `Scores are widely spread (middle half spans ${statistics.iqr} points, full range ${statistics.min}-${statistics.max}), so the pipeline contains genuinely different levels of fit and the ranking is informative.`
  }
  return `The middle half of applicants falls within ${statistics.iqr} points of each other, between ${statistics.p25}% and ${statistics.p75}%.`
}

/**
 * Runs every statistical and failure-mode pass over one job's applications.
 * Pure: the caller supplies the rows.
 */
export function analyseScreening(
  applications: AnalysableApplication[],
  requirements: string
): ScreeningAnalysis {
  const statistics = scoreStatistics(applications.map((application) => application.score))
  const bands = bandBreakdown(applications.map((application) => application.status))
  const confidence = confidenceFor(applications.length)

  const flagged: FlaggedApplication[] = []
  const counts = new Map<FailureCode, number>()

  for (const application of applications) {
    const flags = detectFailureModes(application, requirements)
    if (flags.length === 0) continue
    flagged.push({
      applicationId: application.id,
      candidateName: application.candidateName,
      score: application.score,
      flags,
    })
    for (const flag of flags) counts.set(flag.code, (counts.get(flag.code) ?? 0) + 1)
  }

  // Errors first, then more flags, then lower scores: a flagged rejection is likelier to be
  // a screening failure than a flagged top scorer is.
  flagged.sort((a, b) => {
    const severity = (item: FlaggedApplication) => (item.flags.some((flag) => flag.severity === 'error') ? 0 : 1)
    return severity(a) - severity(b) || b.flags.length - a.flags.length || a.score - b.score
  })

  const failureSummary: FailureSummary[] = [...counts.entries()]
    .map(([code, count]) => ({
      code,
      count,
      share: applications.length === 0 ? 0 : count / applications.length,
    }))
    .sort((a, b) => b.count - a.count)

  const trustworthyCount = applications.length - flagged.length
  const integrityNote = applications.length === 0
    ? 'No applications have been screened yet.'
    : flagged.length === 0
      ? `All ${applications.length} application${applications.length === 1 ? '' : 's'} passed the integrity checks. No fallback scoring, unreadable resumes, injection attempts or padding detected.`
      : `${flagged.length} of ${applications.length} application${applications.length === 1 ? '' : 's'} carry at least one screening-integrity flag. Their scores should be read with the flag in mind rather than at face value.`

  return {
    statistics,
    bands,
    confidence,
    scoreSpreadNote: describeSpread(statistics),
    failureSummary,
    flagged,
    trustworthyCount,
    integrityNote,
  }
}
