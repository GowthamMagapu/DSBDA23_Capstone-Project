import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { LABELS, type ConfusionMatrix, type ClassMetrics, type Distribution } from './metrics'

// Emits Markdown tables ready to paste into the paper, plus the raw JSON behind every
// number so any table in the report can be traced back to the run that produced it.

const RESULTS_DIR = join(process.cwd(), 'eval', 'results')

const lines: string[] = []

export function heading(text: string, level = 2) {
  lines.push('', `${'#'.repeat(level)} ${text}`, '')
}

export function paragraph(text: string) {
  lines.push(text, '')
}

export function bullet(text: string) {
  lines.push(`- ${text}`)
}

export function table(headers: string[], rows: (string | number)[][]) {
  lines.push(`| ${headers.join(' | ')} |`)
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`)
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`)
  lines.push('')
}

export function num(value: number, places = 3) {
  return Number.isFinite(value) ? value.toFixed(places) : 'n/a'
}

export function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function confusionTable(matrix: ConfusionMatrix) {
  table(
    ['human vs predicted', ...LABELS],
    LABELS.map((truth) => [truth, ...LABELS.map((predicted) => matrix[truth][predicted])])
  )
}

export function classTable(metrics: ClassMetrics[]) {
  table(
    ['class', 'support', 'precision', 'recall', 'F1'],
    metrics.map((m) => [m.label, m.support, num(m.precision), num(m.recall), num(m.f1)])
  )
}

export function distributionRow(label: string, d: Distribution, places = 1) {
  return [label, d.n, num(d.mean, places), num(d.sd, places), num(d.min, places), num(d.max, places), num(d.p50, places), num(d.p95, places)]
}

export const DISTRIBUTION_HEADERS = ['series', 'n', 'mean', 'SD', 'min', 'max', 'p50', 'p95']

export function save(reportName: string, rawData: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(join(RESULTS_DIR, `${reportName}.md`), lines.join('\n'))
  writeFileSync(join(RESULTS_DIR, `${reportName}.json`), JSON.stringify(rawData, null, 2))
  lines.length = 0
  return join('eval', 'results', `${reportName}.md`)
}

export function preamble(title: string, meta: Record<string, string | number>) {
  lines.push(`# ${title}`, '')
  for (const [key, value] of Object.entries(meta)) lines.push(`- **${key}:** ${value}`)
  lines.push('')
}
