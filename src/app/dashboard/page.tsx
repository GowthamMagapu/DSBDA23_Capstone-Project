'use client'

import { FormEvent, useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { Check, Copy, Download, ExternalLink, LogOut, Plus, Sparkles, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Job = {
  id: string
  slug: string | null
  title: string
  description: string
  requirements: string
  status: string
  tags: string | null
  _count: { applications: number }
}

type Application = {
  id: string
  candidateName: string
  email: string
  score: number
  status: string
  aiSummary: string | null
  matchedSkills: string | null
  missingSkills: string | null
  resumeFileName: string | null
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [analysis, setAnalysis] = useState<{
    jobTitle: string
    totalApplications: number
    averageScore: number
    selectedCount: number
    reviewCount: number
    rejectedCount: number
    strongSkills: { skill: string; count: number }[]
    weakSkills: { skill: string; count: number }[]
    topCandidates: { name: string; score: number; status: string; explanation: string }[]
    narrative: string
    recommendations: string[]
    bottlenecks: string[]
  } | null>(null)
  const [form, setForm] = useState({ title: '', description: '', requirements: '' })
  const [message, setMessage] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/jobs').then((response) => response.json()).then(setJobs)
  }, [status])

  useEffect(() => {
    if (!selectedJob) return

    fetch(`/api/jobs/${selectedJob.id}/applications`)
      .then((response) => response.json())
      .then(setApplications)

    fetch(`/api/jobs/${selectedJob.id}/analysis`)
      .then((response) => response.json())
      .then(setAnalysis)
  }, [selectedJob])

  if (status === 'loading') return <main className="flex min-h-screen items-center justify-center bg-black text-white">Loading AgentU...</main>
  if (status === 'unauthenticated') return null

  const createJob = async (event: FormEvent) => {
    event.preventDefault()
    setIsCreating(true)
    setMessage('')
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const job = await response.json()
    if (!response.ok) {
      setMessage(job.message || 'Could not publish the job.')
    } else {
      const linkedinStatus = job.linkedinPost?.status
      const linkedinMessage = linkedinStatus === 'posted'
        ? 'Job published and shared to LinkedIn.'
        : linkedinStatus === 'skipped'
          ? 'Job published. LinkedIn auto-post is not configured yet.'
          : linkedinStatus === 'failed'
            ? `Job published, but LinkedIn post failed: ${job.linkedinPost?.message || 'unknown error'}`
            : 'Job published. AI generated an optimized public listing — share it to collect candidates.'

      setJobs((current) => [{ ...job, _count: { applications: 0 } }, ...current])
      setSelectedJob({ ...job, _count: { applications: 0 } })
      setForm({ title: '', description: '', requirements: '' })
      setMessage(linkedinMessage)
    }
    setIsCreating(false)
  }

  const loadApplications = async (job: Job) => {
    setSelectedJob(job)
    const response = await fetch(`/api/jobs/${job.id}/applications`)
    setApplications(await response.json())
  }

  const publicUrl = (slug: string) => `${window.location.origin}/careers/${slug}`

  const copyPublicLink = async (job: Job) => {
    if (!job.slug) return
    await navigator.clipboard.writeText(publicUrl(job.slug))
    setCopiedSlug(job.slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const deleteJob = async (job: Job) => {
    if (!window.confirm(`Delete ${job.title} and all its applications?`)) return
    setDeletingJobId(job.id)
    const response = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
    if (response.ok) {
      setJobs((current) => current.filter((item) => item.id !== job.id))
      if (selectedJob?.id === job.id) {
        setSelectedJob(null)
        setApplications([])
      }
    }
    setDeletingJobId(null)
  }

  const parseSkills = (value: string | null) => {
    try { return value ? (JSON.parse(value) as string[]) : [] } catch { return [] }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3 font-medium">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">✦</span>
            AgentU <span className="text-white/35">/ HR Agent</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-white/60">
            <span>{session?.user?.email}</span>
            <button onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="inline-flex items-center gap-2 text-white hover:text-white/60">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-12 border-b border-white/10 pb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">AgentU workspace</p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Your hiring command center.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">Choose an agent to move work forward. Publish roles with HR Agent, coordinate people with Management, and turn hiring data into decisions with Analysis.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { id: 'hr-agent', number: '01', title: 'HR Agent', text: 'Publish roles, receive applications, and find the strongest matches.', active: true },
              { id: 'management-agent', number: '02', title: 'Management', text: 'Coordinate interviews, feedback, and candidate communication.', active: false },
              { id: 'analysis-agent', number: '03', title: 'Analysis', text: 'Understand your pipeline with hiring insights and reports.', active: false },
            ].map((agent) => (
              <a key={agent.id} href={`#${agent.id}`} className={`border p-5 transition-colors ${agent.active ? 'border-white/50 bg-white text-black' : 'border-white/15 bg-white/5 text-white hover:border-white/40'}`}>
                <p className={`text-xs tracking-[0.2em] ${agent.active ? 'text-black/45' : 'text-white/40'}`}>{agent.number}</p>
                <h2 className="mt-8 text-xl font-medium">{agent.title}</h2>
                <p className={`mt-2 text-sm leading-6 ${agent.active ? 'text-black/60' : 'text-white/50'}`}>{agent.text}</p>
              </a>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <section id="hr-agent">
          <div className="mb-8">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">HR Agent</p>
            <h1 className="text-4xl font-medium tracking-[-0.05em]">Publish a role.<br />Find the right people.</h1>
            <p className="mt-4 text-sm leading-6 text-white/55">Create a job, collect applications, and let AgentU rank the strongest matches.</p>
          </div>

          <form onSubmit={createJob} className="space-y-4 border-t border-white/10 pt-6">
            <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Job title" className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50" />
            <textarea required minLength={20} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Role description" rows={4} className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50" />
            <textarea required value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} placeholder="Requirements, skills, or keywords" rows={4} className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50" />
            <button disabled={isCreating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black disabled:opacity-50">
              <Plus className="h-4 w-4" /> {isCreating ? 'Publishing...' : 'Publish job'}
            </button>
            {message && <p className="text-sm text-white/65">{message}</p>}
          </form>
        </section>

        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-white/10 pb-5">
            <div><p className="text-xs uppercase tracking-[0.2em] text-white/45">Your pipeline</p><h2 className="mt-2 text-2xl font-medium">Published jobs</h2></div>
            <span className="text-sm text-white/45">{jobs.length} roles</span>
          </div>
          {jobs.length === 0 ? <div className="border border-dashed border-white/15 p-10 text-center text-sm text-white/45">Your published jobs will appear here.</div> : jobs.map((job) => (
            <article key={job.id} className={`border p-5 ${selectedJob?.id === job.id ? 'border-white/50 bg-white/10' : 'border-white/10 bg-white/5'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <button onClick={() => loadApplications(job)} className="text-left">
                  <h3 className="text-xl font-medium">{job.title}</h3>
                  <p className="mt-2 text-sm text-white/50">{job._count.applications} application{job._count.applications === 1 ? '' : 's'}</p>
                </button>
                <div className="flex gap-2">
                  {job.slug && (
                    <>
                      <Link href={`/careers/${job.slug}`} target="_blank" className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /> Public page</Link>
                      <button onClick={() => copyPublicLink(job)} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10">{copiedSlug === job.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiedSlug === job.slug ? 'Copied' : 'Share link'}</button>
                    </>
                  )}
                  <a href={`/api/jobs/${job.id}/applications/export`} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><Download className="h-3.5 w-3.5" /> Download CSV</a>
                  <button onClick={() => deleteJob(job)} disabled={deletingJobId === job.id} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> {deletingJobId === job.id ? 'Deleting...' : 'Delete'}</button>
                </div>
              </div>
            </article>
          ))}

          {selectedJob && <div id="analysis-agent" className="border-t border-white/10 pt-6"><div className="mb-4 flex items-center gap-3"><Sparkles className="h-4 w-4 text-white" /><h2 className="text-xl font-medium">AI analysis for {selectedJob.title}</h2></div>
            {analysis ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Applicants</p>
                    <p className="mt-3 text-2xl font-medium">{analysis.totalApplications}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Avg score</p>
                    <p className="mt-3 text-2xl font-medium">{analysis.averageScore}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Selected</p>
                    <p className="mt-3 text-2xl font-medium text-emerald-300">{analysis.selectedCount}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Review</p>
                    <p className="mt-3 text-2xl font-medium text-amber-300">{analysis.reviewCount}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-white/40">Pipeline narrative</p>
                  <p className="mt-3 text-sm leading-6 text-white/70">{analysis.narrative}</p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Strongest signals</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {analysis.strongSkills.length > 0 ? analysis.strongSkills.map((item) => (
                        <span key={item.skill} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">{item.skill} ({item.count})</span>
                      )) : <span className="text-sm text-white/45">No clear signal pattern yet.</span>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Missing skills</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {analysis.weakSkills.length > 0 ? analysis.weakSkills.map((item) => (
                        <span key={item.skill} className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-xs text-red-300">{item.skill} ({item.count})</span>
                      )) : <span className="text-sm text-white/45">No major gaps detected.</span>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Recruiter recommendations</p>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                      {analysis.recommendations.map((item) => (
                        <li key={item} className="flex gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-white/60" /> <span>{item}</span></li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-white/40">Hiring bottleneck insights</p>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                      {analysis.bottlenecks.map((item) => (
                        <li key={item} className="flex gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-amber-300" /> <span>{item}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-white/40">Top candidates</p>
                  <div className="mt-4 space-y-3">
                    {analysis.topCandidates.length > 0 ? analysis.topCandidates.map((candidate) => (
                      <div key={`${candidate.name}-${candidate.score}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{candidate.name}</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-white/45">{candidate.status}</p>
                          </div>
                          <span className="text-lg font-medium">{candidate.score}%</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-white/70">{candidate.explanation}</p>
                      </div>
                    )) : <p className="text-sm text-white/45">No candidates ranked yet.</p>}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <a href={`/api/jobs/${selectedJob.id}/applications/export`} className="inline-flex items-center rounded-xl border border-white/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
                    Export report CSV
                  </a>
                </div>
              </div>
            ) : (
              applications.length === 0 ? <p className="text-sm text-white/45">No applications yet. Share the public link to start receiving candidates.</p> : <p className="text-sm text-white/45">Loading analysis…</p>
            )}

            {applications.length > 0 && analysis && <div className="mt-6 space-y-3">{applications.map((application) => {
              const matched = parseSkills(application.matchedSkills)
              const missing = parseSkills(application.missingSkills)
              return (
                <div key={application.id} className="border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{application.candidateName}</p>
                      <p className="text-sm text-white/45">{application.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium">{application.score}%</p>
                      <p className="text-xs uppercase tracking-wider text-white/45">{application.status}</p>
                    </div>
                  </div>
                  {application.aiSummary && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/45"><Sparkles className="h-3 w-3" /> AI recruiter evaluation</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">{application.aiSummary}</p>
                      {(matched.length > 0 || missing.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {matched.map((skill) => <span key={`m-${skill}`} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">+ {skill}</span>)}
                          {missing.map((skill) => <span key={`x-${skill}`} className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-xs text-red-300">− {skill}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                  {application.resumeFileName && <a href={`/api/jobs/${selectedJob.id}/applications/${application.id}/resume`} className="mt-4 inline-block text-xs text-white/60 underline underline-offset-4 hover:text-white">Download {application.resumeFileName}</a>}
                </div>
              )
            })}</div>}
          </div>}
        </section>
        </div>

        <section id="management-agent" className="mt-8 border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Management</p>
          <h2 className="mt-3 text-2xl font-medium">People operations, next.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Interview scheduling, feedback collection, and candidate coordination will live here.</p>
        </section>
      </div>
    </main>
  )
}
