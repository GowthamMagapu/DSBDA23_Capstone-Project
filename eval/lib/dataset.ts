import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'
import { extractResumeText } from '@/lib/resume-text'
import type { Label } from './metrics'

// Loads the two-tier dataset. The synthetic tier carries ground-truth labels and drives the
// accuracy experiment; the real tier is one candidate's own resume in several tailorings,
// which supports robustness measurements but cannot support an accuracy claim.

const DATASET_DIR = join(process.cwd(), 'eval', 'dataset')

export type Job = {
  id: string
  title: string
  description: string
  requirements: string
}

export type Resume = {
  id: string
  file: string
  format: string
  text: string
  chars: number
}

export type LabelledPair = {
  jobId: string
  resumeId: string
  humanLabel: Label
  humanFit: number
  note: string
}

export function loadJobs(): Job[] {
  return JSON.parse(readFileSync(join(DATASET_DIR, 'jobs.json'), 'utf8')) as Job[]
}

/**
 * Minimal CSV reader for our own fixed-shape label file. Notes are the last column and may
 * contain no commas — enforced here rather than pulling in a CSV dependency.
 */
export function loadLabels(): LabelledPair[] {
  const raw = readFileSync(join(DATASET_DIR, 'labels.csv'), 'utf8').trim()
  const [, ...rows] = raw.split(/\r?\n/)

  return rows.map((row, index) => {
    const columns = row.split(',')
    if (columns.length < 5) {
      throw new Error(`labels.csv row ${index + 2} has ${columns.length} columns, expected 5`)
    }
    const [jobId, resumeId, humanLabel, humanFit, ...note] = columns
    return {
      jobId: jobId.trim(),
      resumeId: resumeId.trim(),
      humanLabel: humanLabel.trim() as Label,
      humanFit: Number(humanFit),
      note: note.join(',').trim(),
    }
  })
}

/** Reads every resume in a tier, running the app's own extractor so the parse path is exercised. */
export async function loadResumes(tier: 'synthetic' | 'real'): Promise<Resume[]> {
  const dir = join(DATASET_DIR, 'resumes', tier)
  if (!existsSync(dir)) return []

  const files = readdirSync(dir).filter((file) => !file.startsWith('.'))
  const resumes: Resume[] = []

  for (const file of files) {
    const path = join(dir, file)
    const buffer = readFileSync(path)
    const format = extname(file).toLowerCase().replace('.', '') || 'unknown'

    // extractResumeText takes the same File shape the upload route hands it, so the
    // harness measures the production extraction path rather than a parallel one.
    const fileLike = { name: file, type: mimeFor(format) } as File
    let text = ''
    try {
      text = await extractResumeText(fileLike, buffer)
    } catch (error) {
      text = ''
      console.error(`  ! extraction threw for ${file}: ${error instanceof Error ? error.message : error}`)
    }

    resumes.push({
      id: basename(file, extname(file)),
      file,
      format,
      text: text.trim(),
      chars: text.trim().length,
    })
  }

  return resumes.sort((a, b) => a.id.localeCompare(b.id))
}

function mimeFor(format: string): string {
  if (format === 'pdf') return 'application/pdf'
  if (format === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (format === 'txt') return 'text/plain'
  return 'application/octet-stream'
}
