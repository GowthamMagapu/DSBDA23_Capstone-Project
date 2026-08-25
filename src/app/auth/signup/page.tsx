import Link from 'next/link'
import { ArrowRight, Check, Rocket, Sparkles } from 'lucide-react'
import { SignUpForm } from '@/components/auth/SignUpForm'
import { GoogleButton } from '@/components/auth/GoogleButton'

export const dynamic = 'force-dynamic'

const benefits = [
  'Build your first AI workflow in minutes',
  'Bring every hiring task into one workspace',
  'Start free with no credit card required',
]

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-[15px] font-medium">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm text-black">✦</span>
          <span>AI Agent</span>
        </Link>
        <p className="text-sm text-white/55">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:text-white/70">
            Sign in
          </Link>
        </p>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-81px)] w-full max-w-[1280px] items-center gap-16 px-6 py-12 lg:grid-cols-[1fr_460px] lg:px-8 lg:py-16">
        <div className="max-w-xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-white" />
            Make room for better work
          </div>
          <h1 className="max-w-lg text-5xl font-medium leading-[0.96] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
            Create your <span className="text-white/60">AI team.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-white/60">
            Turn repetitive hiring work into intelligent workflows that run alongside your team.
          </p>
          <div className="mt-10 space-y-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm text-white/75">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 text-white">
                  <Check className="h-3 w-3" />
                </span>
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/15 bg-[#111111] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="mb-7">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black">
              <Rocket className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-medium tracking-tight">Create an account</h2>
            <p className="mt-2 text-sm text-white/50">Set up your workspace and meet your AI teammates.</p>
          </div>

          <GoogleButton className="h-12 w-full border-white/15 bg-white/5 hover:bg-white/10">
            Continue with Google
          </GoogleButton>

          <div className="my-6 flex items-center gap-3 text-xs text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            OR SIGN UP WITH EMAIL
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <SignUpForm />

          <Link href="/auth/signin" className="mt-6 flex items-center justify-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
            Back to sign in <ArrowRight className="h-4 w-4 rotate-180" />
          </Link>
        </div>
      </section>
    </main>
  )
}
