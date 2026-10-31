// Pure helpers for the Management agent: the candidate pipeline, interview times, and the
// template emails used when the AI drafter is unavailable. Kept free of server imports so the
// dashboard (a client component) can use them too.

export const PIPELINE_STAGES = ['applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === 'string' && (PIPELINE_STAGES as readonly string[]).includes(value)
}

/** Unknown or legacy values (rows created before the pipeline existed) read as "applied". */
export function pipelineStageOf(value: unknown): PipelineStage {
  return isPipelineStage(value) ? value : 'applied'
}

export const CANDIDATE_EMAIL_KINDS = ['interview', 'rejection', 'offer'] as const
export type CandidateEmailKind = (typeof CANDIDATE_EMAIL_KINDS)[number]

export const EMAIL_KIND_LABELS: Record<CandidateEmailKind, string> = {
  interview: 'Interview invitation',
  rejection: 'Rejection',
  offer: 'Offer',
}

export function isCandidateEmailKind(value: unknown): value is CandidateEmailKind {
  return typeof value === 'string' && (CANDIDATE_EMAIL_KINDS as readonly string[]).includes(value)
}

/**
 * "Tuesday, 3 November 2026 at 10:30 (Asia/Kolkata)". The server runs in UTC, so the recruiter's
 * browser time zone is passed in; an unknown zone falls back to UTC rather than throwing.
 */
export function formatInterviewTime(iso: string | Date, timeZone?: string | null) {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }
  try {
    const zone = timeZone || 'UTC'
    return `${new Intl.DateTimeFormat('en-GB', { ...options, timeZone: zone }).format(date)} (${zone})`
  } catch {
    return `${new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(date)} (UTC)`
  }
}

export type CandidateEmailInput = {
  kind: CandidateEmailKind
  candidateName: string
  jobTitle: string
  companyName: string
  interviewAt?: string | null
  interviewLink?: string | null
  timeZone?: string | null
}

/** Plain, complete emails the recruiter can send as-is when the AI drafter cannot run. */
export function fallbackCandidateEmail(input: CandidateEmailInput): { subject: string; body: string } {
  const greeting = `Dear ${input.candidateName},`
  const signOff = `Best regards,\nThe ${input.companyName} hiring team`

  if (input.kind === 'interview') {
    const when = input.interviewAt
      ? formatInterviewTime(input.interviewAt, input.timeZone)
      : 'a time we will confirm with you shortly'
    const where = input.interviewLink ? `\nJoin here: ${input.interviewLink}` : ''
    return {
      subject: `Interview invitation: ${input.jobTitle} at ${input.companyName}`,
      body: [
        greeting,
        '',
        `Thank you for applying for the ${input.jobTitle} role at ${input.companyName}. We were impressed by your application and would like to invite you to an interview.`,
        '',
        `When: ${when}${where}`,
        '',
        'Please reply to confirm this time works for you, or suggest an alternative.',
        '',
        signOff,
      ].join('\n'),
    }
  }

  if (input.kind === 'offer') {
    return {
      subject: `Offer: ${input.jobTitle} at ${input.companyName}`,
      body: [
        greeting,
        '',
        `We are delighted to offer you the ${input.jobTitle} role at ${input.companyName}. Thank you for the time you spent with us during the process.`,
        '',
        'We will follow up with the formal offer details. In the meantime, please reply with any questions.',
        '',
        signOff,
      ].join('\n'),
    }
  }

  return {
    subject: `Your application: ${input.jobTitle} at ${input.companyName}`,
    body: [
      greeting,
      '',
      `Thank you for your interest in the ${input.jobTitle} role at ${input.companyName} and for the time you put into your application.`,
      '',
      'After careful consideration, we have decided not to move forward with your application for this role. We will keep your details on file and may contact you about future openings.',
      '',
      'We wish you every success in your search.',
      '',
      signOff,
    ].join('\n'),
  }
}

/** "2026-11-03T10:30" for a datetime-local input, in the browser's own time zone. */
export function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
