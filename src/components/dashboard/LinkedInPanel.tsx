'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'

type LinkedInStatus = {
  configured: boolean
  redirectUri: string
  connection: {
    memberName: string | null
    expiresAt: string
    expired: boolean
    organizationUrn: string | null
    postAsOrganization: boolean
  } | null
}

const RESULT_MESSAGES: Record<string, string> = {
  connected: 'LinkedIn connected. New jobs will be posted automatically.',
  denied: 'LinkedIn access was declined.',
  'invalid-state': 'The LinkedIn sign-in expired or was tampered with. Please try again.',
  'not-configured': 'LinkedIn is not configured on the server yet.',
  error: 'LinkedIn connection failed. Check the activity feed for details.',
}

export function LinkedInPanel({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<LinkedInStatus | null>(null)
  const [organizationId, setOrganizationId] = useState('')
  const [postAsOrganization, setPostAsOrganization] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch('/api/linkedin')
    if (!response.ok) return
    const data: LinkedInStatus = await response.json()
    setStatus(data)
    setOrganizationId(data.connection?.organizationUrn?.replace('urn:li:organization:', '') ?? '')
    setPostAsOrganization(data.connection?.postAsOrganization ?? false)
  }, [])

  useEffect(() => {
    load()
    const result = new URLSearchParams(window.location.search).get('linkedin')
    if (result) {
      setMessage(RESULT_MESSAGES[result] ?? '')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [load])

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const response = await fetch('/api/linkedin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationUrn: organizationId, postAsOrganization }),
    })
    const data = await response.json().catch(() => ({}))
    setMessage(response.ok ? 'Posting preferences saved.' : data.message || 'Could not save LinkedIn settings.')
    setBusy(false)
    if (response.ok) load()
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect LinkedIn? New jobs will no longer be posted automatically.')) return
    setBusy(true)
    await fetch('/api/linkedin', { method: 'DELETE' })
    setBusy(false)
    setMessage('LinkedIn disconnected.')
    load()
    onChange?.()
  }

  const connection = status?.connection

  return (
    <section className="border border-white/10 bg-white/5 p-6">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40"><Share2 className="h-3.5 w-3.5" /> LinkedIn</p>

      {!status ? (
        <p className="mt-4 text-sm text-white/45">Checking connection…</p>
      ) : !status.configured ? (
        <div className="mt-3 text-sm leading-6 text-white/55">
          <h3 className="text-lg font-medium text-white">Share jobs in one click</h3>
          <p className="mt-1">Use <span className="text-white/80">Share on LinkedIn</span> on any job card. It opens LinkedIn&apos;s post composer with the job link attached and copies a ready-made post to your clipboard. No LinkedIn app or approval needed.</p>
          <p className="mt-2">Published roles are also marked up for Google for Jobs, so they can appear in Google&apos;s job search automatically.</p>
          <p className="mt-3 text-xs text-white/40">Optional fully-automatic posting needs an approved LinkedIn developer app: set <code className="text-white/60">LINKEDIN_CLIENT_ID</code> and <code className="text-white/60">LINKEDIN_CLIENT_SECRET</code>, with redirect URL <span className="break-all text-white/60">{status.redirectUri}</span>.</p>
        </div>
      ) : !connection ? (
        <div className="mt-3">
          <h3 className="text-lg font-medium">Connect your LinkedIn account</h3>
          <p className="mt-1 text-sm leading-6 text-white/50">Every job you publish will be shared automatically with its public application link.</p>
          <a href="/api/linkedin/connect" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-white/85"><Share2 className="h-4 w-4" /> Connect LinkedIn</a>
        </div>
      ) : (
        <div className="mt-3">
          <h3 className="text-lg font-medium">{connection.memberName ? `Connected as ${connection.memberName}` : 'LinkedIn connected'}</h3>
          <p className={`mt-1 text-xs ${connection.expired ? 'text-red-300' : 'text-white/45'}`}>
            {connection.expired ? 'Access expired — reconnect to keep posting.' : `Access valid until ${new Date(connection.expiresAt).toLocaleDateString()}`}
          </p>

          <form onSubmit={saveSettings} className="mt-4 space-y-3">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={!postAsOrganization} onChange={() => setPostAsOrganization(false)} /> Post as me</label>
              <label className="flex items-center gap-2"><input type="radio" checked={postAsOrganization} onChange={() => setPostAsOrganization(true)} /> Post as company page</label>
            </div>
            {postAsOrganization && (
              <input value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="Company page ID, e.g. 12345678" className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/35 focus:border-white/50" />
            )}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className="border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50">Save preference</button>
              <a href="/api/linkedin/connect" className="border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10">Reconnect</a>
              <button type="button" onClick={disconnect} disabled={busy} className="border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50">Disconnect</button>
            </div>
          </form>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-white/65">{message}</p>}
    </section>
  )
}
