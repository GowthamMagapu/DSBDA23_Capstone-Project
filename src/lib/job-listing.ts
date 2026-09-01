import { generateJson } from '@/lib/gemini'

export type GeneratedListing = {
  headline: string
  listing: string
  tags: string[]
}

const SYSTEM_INSTRUCTION = `You are an employer-branding copywriter who writes job postings that perform well on public job boards.
Rewrite the provided raw role description and requirements into a single polished, scannable job posting.
Use short paragraphs, clear sections with headings like "About the role", "What you'll do", "What we're looking for".
Keep all factual details from the input; never invent salary, benefits, or company claims.
Respond ONLY with valid JSON matching this exact shape:
{
  "headline": "<punchy 6-10 word public title, e.g. 'Senior Frontend Engineer (React & TypeScript)'>",
  "listing": "<the full formatted job posting text>",
  "tags": ["<3-6 short searchable keywords like 'React', 'Remote', 'Senior'>"]
}`

export async function generateJobListing(
  title: string,
  description: string,
  requirements: string
): Promise<GeneratedListing> {
  const prompt = [
    `Raw job title: ${title}`,
    `Raw description:\n${description}`,
    `Raw requirements:\n${requirements}`,
  ].join('\n\n')

  try {
    const result = await generateJson<GeneratedListing>(SYSTEM_INSTRUCTION, prompt)
    return {
      headline: String(result.headline || title).slice(0, 120),
      listing: String(result.listing || description).slice(0, 20000),
      tags: (result.tags || []).slice(0, 8).map(String),
    }
  } catch {
    return { headline: title, listing: description, tags: [] }
  }
}

export function createSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'role'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}
