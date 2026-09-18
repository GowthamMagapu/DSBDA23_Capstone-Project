'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Building2, Pencil } from 'lucide-react'

export type Company = {
  name: string
  website: string | null
  industry: string | null
  location: string | null
  size: string | null
  about: string
  culture: string | null
  notificationEmail: string | null
  notifyOnApplication: boolean
}

type FormState = Omit<Company, 'website' | 'industry' | 'location' | 'size' | 'culture' | 'notificationEmail'> & {
  website: string
  industry: string
  location: string
  size: string
  culture: string
  notificationEmail: string
}

const emptyForm: FormState = {
  name: '',
  website: '',
  industry: '',
  location: '',
  size: '',
  about: '',
  culture: '',
  notificationEmail: '',
  notifyOnApplication: true,
}

function toForm(company: Company | null): FormState {
  if (!company) return emptyForm
  return {
    ...company,
    website: company.website ?? '',
    industry: company.industry ?? '',
    location: company.location ?? '',
    size: company.size ?? '',
    culture: company.culture ?? '',
    notificationEmail: company.notificationEmail ?? '',
  }
}

const inputClass = 'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50'

export function CompanyProfilePanel({
  company,
  accountEmail,
  onSaved,
}: {
  company: Company | null
  accountEmail: string | null
  onSaved: (company: Company) => void
}) {
  const [editing, setEditing] = useState(!company)
  const [form, setForm] = useState<FormState>(toForm(company))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(toForm(company))
    if (!company) setEditing(true)
  }, [company])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const response = await fetch('/api/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setError(data.message || 'Could not save the company profile.')
      return
    }
    onSaved(data.company)
    setEditing(false)
  }

  if (company && !editing) {
    return (
      <section className="border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40"><Building2 className="h-3.5 w-3.5" /> Company profile</p>
            <h2 className="mt-3 text-2xl font-medium">{company.name}</h2>
            <p className="mt-1 text-sm text-white/45">{[company.industry, company.location, company.size && `${company.size} employees`].filter(Boolean).join(' · ') || 'Add industry and location to enrich listings'}</p>
          </div>
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /> Edit</button>
        </div>
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/60">{company.about}</p>
        <p className="mt-4 text-xs text-white/45">
          Email updates go to <span className="text-white/75">{company.notificationEmail || accountEmail}</span>
          {company.notifyOnApplication ? ' for every published job and new applicant.' : ' for published jobs only.'}
        </p>
      </section>
    )
  }

  return (
    <section className="border border-white/15 bg-white/5 p-6">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40"><Building2 className="h-3.5 w-3.5" /> Company profile</p>
      <h2 className="mt-3 text-2xl font-medium">{company ? 'Update your company' : 'Tell the HR agent about your company'}</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">The agent uses this to write every public listing, LinkedIn post, and candidate-facing page. It never invents details you don&apos;t provide.</p>

      <form onSubmit={save} className="mt-6 grid gap-4 md:grid-cols-2">
        <input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Company name *" className={inputClass} />
        <input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="Website (https://…)" className={inputClass} />
        <input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder="Industry, e.g. Fintech" className={inputClass} />
        <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location, e.g. Bengaluru · Hybrid" className={inputClass} />
        <input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="Company size, e.g. 50-200" className={inputClass} />
        <input type="email" value={form.notificationEmail} onChange={(event) => setForm({ ...form, notificationEmail: event.target.value })} placeholder={`Updates email (default: ${accountEmail ?? 'your login email'})`} className={inputClass} />
        <textarea required minLength={30} value={form.about} onChange={(event) => setForm({ ...form, about: event.target.value })} placeholder="About the company * — mission, products, customers, team" rows={4} className={`${inputClass} resize-none md:col-span-2`} />
        <textarea value={form.culture} onChange={(event) => setForm({ ...form, culture: event.target.value })} placeholder="Culture, benefits & perks (optional — only what's true)" rows={3} className={`${inputClass} resize-none md:col-span-2`} />
        <label className="flex items-start gap-3 text-xs leading-5 text-white/55 md:col-span-2">
          <input type="checkbox" checked={form.notifyOnApplication} onChange={(event) => setForm({ ...form, notifyOnApplication: event.target.checked })} className="mt-0.5 h-4 w-4" />
          Email me every time a candidate applies, with their AI score and evaluation.
        </label>
        <div className="flex items-center gap-3 md:col-span-2">
          <button disabled={saving} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save company profile'}</button>
          {company && <button type="button" onClick={() => setEditing(false)} className="text-sm text-white/55 hover:text-white">Cancel</button>}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      </form>
    </section>
  )
}
