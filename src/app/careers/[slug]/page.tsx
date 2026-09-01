'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

type PublicJob = {
  title: string
  description: string
  requirements: string
  listing: string | null
  tags: string | null
}

export default function CareersPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState('')
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [form, setForm] = useState({ candidateName: '', email: '', coverLetter: '' })
  const [resume, setResume] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadJob = (value: string) => {
    setLoadError(false)
    fetch(`/api/careers/${value}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        setJob(await response.json())
      })
      .catch(() => setLoadError(true))
  }

  useEffect(() => {
    params.then(({ slug: value }) => {
      setSlug(value)
      loadJob(value)
    })
  }, [params])

  const submitApplication = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    if (!resume) {
      setError('Please attach your resume.')
      setSubmitting(false)
      return
    }
    const body = new FormData()
    body.append('candidateName', form.candidateName)
    body.append('email', form.email)
    body.append('coverLetter', form.coverLetter)
    body.append('resume', resume)
    const response = await fetch(`/api/jobs/${slug}/applications`, { method: 'POST', body })
    const data = await response.json()
    if (!response.ok) setError(data.message || 'Unable to submit application.')
    else setSubmitted(true)
    setSubmitting(false)
  }

  if (loadError) return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md border border-white/15 bg-white/5 p-8 text-center">
        <h1 className="text-2xl font-medium">Could not load this role</h1>
        <p className="mt-3 text-sm text-white/55">The job may have been unpublished or the connection failed.</p>
        <button onClick={() => slug && loadJob(slug)} className="mt-6 border border-white/20 px-5 py-2.5 text-sm hover:bg-white/10">Try again</button>
      </div>
    </main>
  )

  if (!job) return <main className="flex min-h-screen items-center justify-center bg-black text-white">Loading role...</main>

  const tags: string[] = job.tags ? JSON.parse(job.tags) : []
  const body = job.listing || `${job.description}\n\n${job.requirements}`

  if (submitted) return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-lg border border-white/15 bg-white/5 p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">✓</div>
        <h1 className="text-3xl font-medium">Application received</h1>
        <p className="mt-3 text-white/55">Thank you for applying. The hiring team will review your application.</p>
        <Link href="/" className="mt-8 inline-block text-sm text-white/60 underline underline-offset-4 hover:text-white">Visit AgentU</Link>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6"><Link href="/" className="font-medium">✦ AgentU</Link><span className="text-xs uppercase tracking-[0.2em] text-white/40">We are hiring</span></header>
      <section className="mx-auto grid max-w-4xl gap-10 px-6 py-12 lg:grid-cols-[1fr_1fr]">
        <div>
          {tags.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">{tag}</span>)}</div>
          )}
          <h1 className="text-5xl font-medium tracking-[-0.05em]">{job.title}</h1>
          <div className="mt-8 whitespace-pre-wrap border-t border-white/10 pt-8 text-sm leading-7 text-white/60">{body}</div>
        </div>
        <form onSubmit={submitApplication} className="h-fit border border-white/15 bg-white/5 p-6 sm:p-8 lg:sticky lg:top-8">
          <h2 className="text-2xl font-medium">Apply for this role</h2>
            <p className="mt-2 text-sm text-white/50">Submit your resume and cover letter for review.</p>
          <div className="mt-7 space-y-4">
            <input required value={form.candidateName} onChange={(event) => setForm({ ...form, candidateName: event.target.value })} placeholder="Full name" className="w-full border border-white/15 bg-black px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50" />
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email address" className="w-full border border-white/15 bg-black px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50" />
            <label className="block border border-dashed border-white/20 bg-black px-4 py-4 text-sm text-white/55">Resume attachment<input required type="file" accept=".pdf,.doc,.docx,.txt,.rtf" onChange={(event) => setResume(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs text-white/60 file:mr-3 file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-black" /></label>
            <textarea required minLength={30} value={form.coverLetter} onChange={(event) => setForm({ ...form, coverLetter: event.target.value })} placeholder="Cover letter" rows={8} className="w-full resize-none border border-white/15 bg-black px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50" />
            <button disabled={submitting} className="w-full bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/80 disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit application'}</button>
            {error && <p className="text-sm text-white/70">{error}</p>}
          </div>
        </form>
      </section>
    </main>
  )
}
