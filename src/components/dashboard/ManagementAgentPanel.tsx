'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CalendarClock, Mail, Send, Sparkles, Star } from 'lucide-react'
import {
  CANDIDATE_EMAIL_KINDS,
  EMAIL_KIND_LABELS,
  PIPELINE_STAGES,
  STAGE_LABELS,
  formatInterviewTime,
  pipelineStageOf,
  toDateTimeLocalValue,
  type CandidateEmailKind,
  type PipelineStage,
} from '@/lib/management'

export type ManagedApplication = {
  id: string
  candidateName: string
  email: string
  score: number
  status: string
  stage?: string | null
  interviewAt?: string | null
  interviewLink?: string | null
  feedbackRating?: number | null
  feedbackNotes?: string | null
}

const stageTone: Record<PipelineStage, string> = {
  applied: 'border-white/15',
  shortlisted: 'border-sky-300/40',
  interview: 'border-amber-300/40',
  offer: 'border-violet-300/40',
  hired: 'border-emerald-400/50',
  rejected: 'border-red-400/30',
}

const browserTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return undefined }
}

/**
 * Management agent: moves candidates through the hiring pipeline, schedules interviews,
 * records feedback and drafts candidate emails the recruiter reviews before sending.
 */
export function ManagementAgentPanel({
  job,
  applications,
  onChanged,
}: {
  job: { id: string; title: string } | null
  applications: ManagedApplication[]
  onChanged: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = applications.find((application) => application.id === selectedId) ?? null

  useEffect(() => {
    setSelectedId(null)
  }, [job?.id])

  if (!job) {
    return (
      <p className="mt-6 text-sm text-white/50">Select a job in the HR Agent pipeline above to manage its candidates.</p>
    )
  }

  if (applications.length === 0) {
    return <p className="mt-6 text-sm text-white/50">No candidates for {job.title} yet. They appear here as soon as they apply.</p>
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {PIPELINE_STAGES.map((stage) => {
          const inStage = applications.filter((application) => pipelineStageOf(application.stage) === stage)
          return (
            <div key={stage} className={`min-h-28 border bg-black/30 p-3 ${stageTone[stage]}`}>
              <p className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-white/50">
                {STAGE_LABELS[stage]} <span className="text-white/35">{inStage.length}</span>
              </p>
              <div className="mt-3 space-y-2">
                {inStage.map((application) => (
                  <button
                    key={application.id}
                    onClick={() => setSelectedId(application.id === selectedId ? null : application.id)}
                    className={`w-full border px-3 py-2 text-left text-sm transition-colors ${application.id === selectedId ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 hover:border-white/40'}`}
                  >
                    <span className="block truncate font-medium">{application.candidateName}</span>
                    <span className={`text-xs ${application.id === selectedId ? 'text-black/55' : 'text-white/45'}`}>
                      AI {application.score}%{application.feedbackRating ? ` · ${application.feedbackRating}/5` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {selected
        ? <CandidateManager key={selected.id} jobId={job.id} application={selected} onChanged={onChanged} />
        : <p className="text-sm text-white/45">Select a candidate to move them through the pipeline, schedule an interview, record feedback or email them.</p>}
    </div>
  )
}

function CandidateManager({ jobId, application, onChanged }: { jobId: string; application: ManagedApplication; onChanged: () => void }) {
  const stage = pipelineStageOf(application.stage)
  const [interviewAt, setInterviewAt] = useState(toDateTimeLocalValue(application.interviewAt))
  const [interviewLink, setInterviewLink] = useState(application.interviewLink ?? '')
  const [rating, setRating] = useState<number | null>(application.feedbackRating ?? null)
  const [notes, setNotes] = useState(application.feedbackNotes ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [emailKind, setEmailKind] = useState<CandidateEmailKind>('interview')
  const [emailNote, setEmailNote] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const base = `/api/jobs/${jobId}/applications/${application.id}`

  const update = async (label: string, payload: Record<string, unknown>, success: string) => {
    setBusy(label)
    setNotice('')
    const response = await fetch(base, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timeZone: browserTimeZone() }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) {
      setNotice(data.message || `Could not save (${response.status}).`)
      return false
    }
    setNotice(success)
    onChanged()
    return true
  }

  const draft = async (kind: CandidateEmailKind) => {
    setBusy('draft')
    setNotice('')
    const response = await fetch(`${base}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'draft', kind, note: emailNote || undefined, timeZone: browserTimeZone() }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) {
      setNotice(data.message || `Could not draft the email (${response.status}).`)
      return
    }
    setSubject(data.subject)
    setBody(data.body)
    setNotice(data.aiGenerated
      ? 'Drafted with AI. Review and edit before sending.'
      : `AI drafting was unavailable, so a template was used${data.fallbackReason ? ` (${data.fallbackReason})` : ''}. Review before sending.`)
  }

  const scheduleInterview = async (event: FormEvent) => {
    event.preventDefault()
    if (!interviewAt) return
    const saved = await update(
      'interview',
      {
        interviewAt: new Date(interviewAt).toISOString(),
        interviewLink: interviewLink || null,
        ...(stage === 'applied' || stage === 'shortlisted' ? { stage: 'interview' } : {}),
      },
      'Interview scheduled.',
    )
    if (saved) {
      setEmailKind('interview')
      await draft('interview')
    }
  }

  const sendEmail = async (event: FormEvent) => {
    event.preventDefault()
    if (!window.confirm(`Send this email to ${application.email}?`)) return
    setBusy('send')
    setNotice('')
    const response = await fetch(`${base}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', kind: emailKind, subject, body }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (response.ok && data.sent) {
      setNotice(`Email sent to ${application.email}.`)
      setSubject('')
      setBody('')
      onChanged()
    } else {
      setNotice(`Email not sent: ${data.reason || data.message || response.status}`)
    }
  }

  const input = 'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50'

  return (
    <div className="border border-white/15 bg-black/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-medium">{application.candidateName}</h3>
        <p className="text-xs text-white/45">{application.email} · AI score {application.score}% ({application.status})</p>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.15em] text-white/45">Pipeline stage</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PIPELINE_STAGES.map((option) => (
            <button
              key={option}
              disabled={busy !== null || option === stage}
              onClick={() => update('stage', { stage: option }, `Moved to ${STAGE_LABELS[option]}.`)}
              className={`rounded-full border px-3 py-1.5 text-xs ${option === stage ? 'border-white bg-white text-black' : 'border-white/15 text-white/70 hover:border-white/50 disabled:opacity-50'}`}
            >
              {STAGE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={scheduleInterview} className="space-y-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/45"><CalendarClock className="h-4 w-4" /> Interview</p>
          {application.interviewAt && <p className="text-sm text-white/65">Scheduled: {formatInterviewTime(application.interviewAt, browserTimeZone())}</p>}
          <input required type="datetime-local" value={interviewAt} onChange={(event) => setInterviewAt(event.target.value)} className={input} />
          <input value={interviewLink} onChange={(event) => setInterviewLink(event.target.value)} placeholder="Meeting link or location (optional)" className={input} />
          <button disabled={busy !== null} className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50">
            {busy === 'interview' ? 'Scheduling...' : application.interviewAt ? 'Reschedule & draft invitation' : 'Schedule & draft invitation'}
          </button>
        </form>

        <form
          onSubmit={(event) => { event.preventDefault(); update('feedback', { feedbackRating: rating, feedbackNotes: notes }, 'Feedback saved.') }}
          className="space-y-3"
        >
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/45"><Star className="h-4 w-4" /> Interview feedback</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setRating(rating === value ? null : value)}
                aria-label={`${value} out of 5`}
                className={`h-10 w-10 rounded-xl border text-sm ${rating !== null && value <= rating ? 'border-amber-300 bg-amber-300 text-black' : 'border-white/15 text-white/60 hover:border-white/50'}`}
              >
                {value}
              </button>
            ))}
          </div>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Strengths, concerns, recommendation" rows={3} className={`${input} resize-none`} />
          <button disabled={busy !== null} className="w-full rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50">
            {busy === 'feedback' ? 'Saving...' : 'Save feedback'}
          </button>
        </form>
      </div>

      <form onSubmit={sendEmail} className="mt-6 space-y-3 border-t border-white/10 pt-5">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/45"><Mail className="h-4 w-4" /> Email the candidate</p>
        <div className="flex flex-wrap gap-2">
          {CANDIDATE_EMAIL_KINDS.map((kind) => (
            <button
              type="button"
              key={kind}
              onClick={() => setEmailKind(kind)}
              className={`rounded-full border px-3 py-1.5 text-xs ${kind === emailKind ? 'border-white bg-white text-black' : 'border-white/15 text-white/70 hover:border-white/50'}`}
            >
              {EMAIL_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={emailNote} onChange={(event) => setEmailNote(event.target.value)} placeholder="Optional note for the AI, e.g. mention the team's flexible hours" className={input} />
          <button type="button" disabled={busy !== null} onClick={() => draft(emailKind)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {busy === 'draft' ? 'Drafting...' : 'Draft with AI'}
          </button>
        </div>
        {(subject || body) && (
          <>
            <input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className={input} />
            <textarea required value={body} onChange={(event) => setBody(event.target.value)} rows={9} className={`${input} resize-y`} />
            <button disabled={busy !== null} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50">
              <Send className="h-4 w-4" /> {busy === 'send' ? 'Sending...' : `Send to ${application.email}`}
            </button>
          </>
        )}
      </form>

      {notice && <p className="mt-4 text-sm text-white/70">{notice}</p>}
    </div>
  )
}
