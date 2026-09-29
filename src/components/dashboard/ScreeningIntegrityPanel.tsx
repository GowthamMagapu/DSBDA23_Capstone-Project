'use client'

import { AlertTriangle, ShieldCheck, ShieldAlert, BarChart3 } from 'lucide-react'
import type { ScreeningAnalysis, FailureCode } from '@/lib/screening-analysis'

const BAND_STYLES: Record<string, { label: string; bar: string; text: string }> = {
  selected: { label: 'Selected', bar: 'bg-emerald-400/70', text: 'text-emerald-300' },
  review: { label: 'Review', bar: 'bg-amber-300/70', text: 'text-amber-300' },
  rejected: { label: 'Rejected', bar: 'bg-white/30', text: 'text-white/60' },
}

const FAILURE_LABELS: Record<FailureCode, string> = {
  'fallback-scored': 'Not scored by AI',
  'thin-extraction': 'Unreadable resume',
  'possible-injection': 'Possible injection',
  'keyword-stuffing': 'Possible padding',
}

const percent = (value: number) => `${Math.round(value * 100)}%`

export default function ScreeningIntegrityPanel({ screening }: { screening: ScreeningAnalysis }) {
  const { statistics, bands, confidence, scoreSpreadNote, failureSummary, flagged, trustworthyCount, integrityNote } = screening

  if (statistics.n === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.15em] text-white/40">Screening analysis</p>
        <p className="mt-3 text-sm text-white/45">{confidence.caveat}</p>
      </div>
    )
  }

  const hasErrors = flagged.some((item) => item.flags.some((flag) => flag.severity === 'error'))

  return (
    <div className="space-y-5">
      {/* ---- Distribution ---- */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-white/60" />
          <p className="text-xs uppercase tracking-[0.15em] text-white/40">Score distribution</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Stat label="Median" value={`${statistics.median}%`} />
          <Stat label="Mean" value={`${statistics.mean}%`} />
          <Stat label="Std. dev." value={`${statistics.sd}`} />
          <Stat label="Range" value={`${statistics.min}–${statistics.max}%`} />
        </div>

        <p className="mt-4 text-sm leading-6 text-white/70">{scoreSpreadNote}</p>

        <div className="mt-4 space-y-2">
          {bands.map((band) => {
            const style = BAND_STYLES[band.band]
            return (
              <div key={band.band} className="flex items-center gap-3">
                <span className={`w-20 shrink-0 text-xs ${style.text}`}>{style.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${style.bar}`} style={{ width: `${Math.max(band.share * 100, band.count > 0 ? 2 : 0)}%` }} />
                </div>
                <span className="w-32 shrink-0 text-right text-xs tabular-nums text-white/45">
                  {band.count} · {percent(band.share)}
                  <span className="text-white/30"> ({percent(band.ciLow)}–{percent(band.ciHigh)})</span>
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-xs leading-5 text-white/35">
          Ranges in brackets are 95% confidence intervals on each share. {confidence.caveat}
        </p>
      </div>

      {/* ---- Screening integrity ---- */}
      <div className={`rounded-xl border p-4 ${hasErrors ? 'border-red-400/30 bg-red-400/5' : 'border-white/10 bg-white/5'}`}>
        <div className="flex items-center gap-2">
          {flagged.length === 0
            ? <ShieldCheck className="h-4 w-4 text-emerald-300" />
            : <ShieldAlert className={`h-4 w-4 ${hasErrors ? 'text-red-300' : 'text-amber-300'}`} />}
          <p className="text-xs uppercase tracking-[0.15em] text-white/40">Screening integrity</p>
        </div>

        <p className="mt-3 text-sm leading-6 text-white/70">{integrityNote}</p>

        {failureSummary.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {failureSummary.map((item) => (
              <span
                key={item.code}
                className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200"
              >
                {FAILURE_LABELS[item.code]} ({item.count})
              </span>
            ))}
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
              Clean ({trustworthyCount})
            </span>
          </div>
        )}

        {flagged.length > 0 && (
          <div className="mt-4 space-y-3">
            {flagged.map((item) => (
              <div key={item.applicationId} className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{item.candidateName}</p>
                  <span className="text-sm tabular-nums text-white/60">{item.score}%</span>
                </div>
                <ul className="mt-2 space-y-2">
                  {item.flags.map((flag) => (
                    <li key={flag.code} className="flex gap-2 text-xs leading-5">
                      <AlertTriangle
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${flag.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}
                      />
                      <span>
                        <span className={flag.severity === 'error' ? 'text-red-200' : 'text-amber-200'}>{flag.title}.</span>{' '}
                        <span className="text-white/55">{flag.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  )
}
