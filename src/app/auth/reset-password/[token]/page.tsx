'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'
import { PasswordInput } from '@/components/auth/PasswordInput'

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.message || 'Unable to update the password.')
        return
      }

      setMessage(result.message)
      setPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        router.push('/auth/signin')
      }, 1500)
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
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Security</p>
              <h1 className="mt-1 text-2xl font-medium tracking-tight">Create new password</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordInput
              label="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a strong password"
              error={error || undefined}
            />

            <PasswordInput
              label="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm your password"
              error={error || undefined}
            />

            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Updating password...' : 'Update password'}
            </button>
          </form>

          {message && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <p>{message}</p>
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
