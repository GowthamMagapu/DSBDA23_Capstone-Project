import { ArrowUp, Check, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const navItems = ['Product', 'Use Cases', 'Blog', 'Pricing']

const featureRows = [
  'Create a team of AI agents that handle real work',
  'Automate repetitive tasks — no training needed',
  'Plug into tools you already use',
  'Train AI agents on your existing docs',
]

const chips = [
  { label: 'growth-agent', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'pull', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'PostHog', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'funnels', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'compare them to our', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'ICP notes', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'then', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'create a workflow', tone: 'bg-white/5 text-white border-white/10' },
  { label: 'to win back drop-offs!', tone: 'bg-white/5 text-white border-white/10' },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-5 lg:px-8">
        <div className="flex items-center gap-3 text-[15px] font-medium text-white">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-white/20 bg-white/5 text-[10px]">
            ✦
          </span>
          <span>AI Agent</span>
        </div>

        <nav className="hidden items-center gap-8 text-[14px] text-white/80 md:flex">
          {navItems.map((item) => (
            <button
              key={item}
              className="flex items-center gap-1.5 transition-opacity hover:text-white"
            >
              {item}
              {item === 'Product' && <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button className="hidden text-sm text-white/80 transition-colors hover:text-white sm:inline-flex">
            Talk to sales
          </button>
          <Link href="/auth/signin" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-transform hover:scale-[1.01]">
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[1280px] items-center px-6 pb-12 pt-6 lg:px-8 lg:pb-16 lg:pt-10">
        <div className="grid w-full items-center gap-10 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="max-w-[620px]">
            <p className="mb-5 text-[14px] font-medium tracking-[-0.02em] text-white/80 lg:text-[15px]">
              AI Agents:
            </p>

            <h1 className="text-[3.0rem] font-medium leading-[0.9] tracking-[-0.07em] text-white sm:text-[4.2rem] lg:text-[5.6rem]">
              Get more done
              <span className="block">without doing more.</span>
            </h1>

            <p className="mt-7 max-w-[540px] text-[1.03rem] leading-[1.65] text-white/80 sm:text-[1.18rem]">
              Imagine your best teammates, multiplied.
              <span className="block pt-1">
                Working <span className="font-medium text-white">Smarter,</span>{' '}
                <span className="font-medium text-white">Faster,</span> and{' '}
                <span className="font-medium text-white">Stronger.</span>
              </span>
              <span className="mt-2 block">
                Taking care of the busywork—so you can do your best work.
              </span>
            </p>

            <div className="mt-7 space-y-3.5 text-[1rem] text-white/90">
              {featureRows.map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{row}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white px-6 py-3.5 text-base font-medium text-black transition-opacity hover:opacity-95">
                Launch Your AI Team
              </button>
              <button className="inline-flex items-center justify-center rounded-full border border-white/15 bg-transparent px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/5">
                Contact sales
              </button>
            </div>
          </div>

          <div className="flex justify-center xl:justify-end">
            <div className="relative w-full max-w-[760px] rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(255,255,255,0.04)] backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                {chips.map((chip, index) => (
                  <span
                    key={`${chip.label}-${index}`}
                    className={`inline-flex items-center rounded-full border px-3 py-2 text-[12px] font-medium ${chip.tone}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>

              <button className="absolute bottom-4 right-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.2)] transition-transform hover:scale-[1.02]">
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}