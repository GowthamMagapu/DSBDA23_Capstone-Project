'use client'

export const dynamic = 'force-dynamic'

import { motion } from 'framer-motion'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { Logo } from '@/components/auth/Logo'
import { AnimatedBackground } from '@/components/auth/AnimatedBackground'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { LogOut, LayoutDashboard, Bot, Users, BarChart3, Settings, Sparkles, ArrowRight } from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '#', disabled: true },
  { icon: Bot, label: 'HR Agent', href: '#', disabled: true },
  { icon: Users, label: 'Management Agent', href: '#', disabled: true },
  { icon: BarChart3, label: 'Analysis Agent', href: '#', disabled: true },
  { icon: Settings, label: 'Settings', href: '#', disabled: true },
]

export default function DashboardPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <AnimatedBackground />
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/50 border-t-transparent" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const user = session?.user

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <div className="relative min-h-screen bg-slate-950">
      <AnimatedBackground />

      <motion.div
        className="relative z-10 min-h-screen flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Logo size="md" className="shrink-0" />
                <nav className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => (
                    <button
                      key={item.label}
                      disabled={item.disabled}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                        item.disabled
                          ? 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                          : 'text-white hover:bg-white/10'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:block flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <Avatar
                    src={user?.image || undefined}
                    fallback={user?.name || 'U'}
                    size="sm"
                  />
                  <div className="text-left">
                    <p className="text-sm font-medium text-white truncate max-w-xs">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-slate-400 truncate max-w-xs">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl">
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <motion.div
                className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-8"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #06B6D4 100%)',
                }}
                animate={{ rotate: [0, 0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="h-12 w-12 text-white" />
              </motion.div>

              <motion.h1
                className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Multi-Agent HR Automation System
              </motion.h1>

              <motion.p
                className="text-xl lg:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                Dashboard Coming Soon
              </motion.p>

              <motion.div
                className="inline-flex items-center gap-4 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Avatar
                  src={user?.image || undefined}
                  fallback={user?.name || 'U'}
                  size="lg"
                />
                <div className="text-left">
                  <p className="text-sm text-slate-400">Signed in as</p>
                  <p className="text-lg font-semibold text-white">{user?.name}</p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="mt-16 grid sm:grid-cols-3 gap-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {[
                { icon: Bot, title: 'HR Agent', desc: 'Automated candidate sourcing, screening & outreach', color: 'from-white to-white/60' },
                { icon: Users, title: 'Management Agent', desc: 'Interview scheduling, feedback collection & coordination', color: 'from-white/80 to-white/40' },
                { icon: BarChart3, title: 'Analysis Agent', desc: 'Predictive analytics, hiring insights & reporting', color: 'from-white/70 to-white/30' },
              ].map((agent, index) => (
                <motion.div
                  key={agent.title}
                  className="group p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:border-white/40 hover:bg-white/10 transition-all duration-300"
                  whileHover={{ y: -8, scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                >
                  <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center" style={{
                    background: `linear-gradient(135deg, ${agent.color})`,
                  }}>
                    <agent.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{agent.title}</h3>
                  <p className="text-slate-400 mb-6">{agent.desc}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled
                  >
                    Coming Soon
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              className="mt-16 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <h3 className="text-xl font-semibold text-white mb-3">Ready to Get Started?</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                The dashboard is under active development. Check back soon for the full multi-agent HR automation experience.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button variant="default" size="lg" disabled>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Notify Me When Ready
                </Button>
                <Button variant="secondary" size="lg" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            </motion.div>
          </div>
        </main>
      </motion.div>
    </div>
  )
}