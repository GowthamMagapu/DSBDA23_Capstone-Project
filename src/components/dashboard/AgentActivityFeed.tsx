'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity } from 'lucide-react'

export type AgentEvent = {
  id: string
  type: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  jobId: string | null
  createdAt: string
}

const POLL_INTERVAL_MS = 5000

const levelDot: Record<AgentEvent['level'], string> = {
  info: 'bg-white/50',
  success: 'bg-emerald-400',
  warning: 'bg-amber-300',
  error: 'bg-red-400',
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

/** Live feed of what the HR agent is doing. Polls for new events and reports them upward. */
export function AgentActivityFeed({ onNewEvents }: { onNewEvents?: (events: AgentEvent[]) => void }) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [, forceTick] = useState(0)
  const newestRef = useRef<string | null>(null)
  const onNewEventsRef = useRef(onNewEvents)
  onNewEventsRef.current = onNewEvents

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const since = newestRef.current
      const response = await fetch(`/api/agent/events${since ? `?since=${encodeURIComponent(since)}` : ''}`).catch(() => null)
      if (!response?.ok || cancelled) return
      const incoming: AgentEvent[] = await response.json()
      if (incoming.length === 0) return

      newestRef.current = incoming[0].createdAt
      setEvents((current) => [...incoming, ...current].slice(0, 40))
      // The first load is history, not news.
      if (since) onNewEventsRef.current?.(incoming)
    }

    poll()
    const pollTimer = setInterval(poll, POLL_INTERVAL_MS)
    const clockTimer = setInterval(() => forceTick((tick) => tick + 1), 30000)
    return () => {
      cancelled = true
      clearInterval(pollTimer)
      clearInterval(clockTimer)
    }
  }, [])

  return (
    <section className="border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40"><Activity className="h-3.5 w-3.5" /> Agent activity</p>
        <span className="flex items-center gap-2 text-xs text-white/40"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">The HR agent&apos;s actions — listings, LinkedIn posts, applicant scoring, and emails — will stream here.</p>
      ) : (
        <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot[event.level] ?? levelDot.info}`} />
              <div className="min-w-0">
                <p className="break-words leading-6 text-white/75">{event.message}</p>
                <p className="text-xs text-white/35">{timeAgo(event.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
