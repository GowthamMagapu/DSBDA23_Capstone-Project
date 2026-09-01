'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resetUrl, setResetUrl] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')
    setError('')
    setResetUrl('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.message || 'Unable to send the reset link right now.')
        return
      }

      setMessage(result.message)
      if (result.resetUrl) {
        setResetUrl(result.resetUrl)
      }
      setEmail('')
    } catch {
      setError('Something went wrong. Please try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-[24px] border border-white/15 bg-[#111111] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Account access</p>
              <h1 className="mt-1 text-2xl font-medium tracking-tight">Reset password</h1>
            </div>
          </div>

          <p className="mb-6 text-sm leading-6 text-white/60">
            Enter your email to receive a secure reset link for your AgentU account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
              error={error || undefined}
            />

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {isLoading ? 'Sending reset link...' : 'Send reset link'}
            </button>
          </form>

          {message && (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <div>
                  <p>{message}</p>
                  {resetUrl && (
                    <a href={resetUrl} className="mt-2 inline-block text-emerald-100 underline underline-offset-4">
                      Open reset link
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <Link href="/auth/signin" className="mt-6 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
