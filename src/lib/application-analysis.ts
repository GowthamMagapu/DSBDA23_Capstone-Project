import { generateJson } from '@/lib/gemini'

export type ApplicationAnalysis = {
  score: number
  status: 'selected' | 'review' | 'rejected'
  aiSummary: string
  matchedSkills: string[]
  missingSkills: string[]
}

const SYSTEM_INSTRUCTION = `You are an expert technical recruiter screening resumes for a job opening.
You evaluate how well a candidate's resume matches the role's requirements.
Judge skills, relevant experience, seniority, and domain fit — not keyword stuffing alone.
Respond ONLY with valid JSON matching this exact shape:
{
  "score": <integer 0-100 overall match strength>,
  "aiSummary": "<2-3 sentence professional evaluation of the candidate for this role>",
  "matchedSkills": ["<requirement or skill clearly demonstrated by the candidate>"],
  "missingSkills": ["<requirement or skill not evidenced in the resume>"]
}`

function statusFor(score: number): ApplicationAnalysis['status'] {
  return score >= 70 ? 'selected' : score >= 40 ? 'review' : 'rejected'
}

export async function analyzeApplication(
  resumeText: string,
  jobTitle: string,
  requirements: string
): Promise<ApplicationAnalysis> {
  try {
    const prompt = [
      `Job title: ${jobTitle}`,
      `Job requirements:\n${requirements}`,
      `\nCandidate resume:\n${resumeText.slice(0, 12000)}`,
    ].join('\n\n')

    const result = await generateJson<Omit<ApplicationAnalysis, 'status'>>(
      SYSTEM_INSTRUCTION,
      prompt
    )

    const score = Math.max(0, Math.min(100, Math.round(result.score)))
    return {
      score,
      status: statusFor(score),
      aiSummary: String(result.aiSummary || '').slice(0, 2000),
      matchedSkills: (result.matchedSkills || []).slice(0, 12).map(String),
      missingSkills: (result.missingSkills || []).slice(0, 12).map(String),
    }
  } catch {
    return { ...keywordFallback(resumeText, requirements), aiSummary: '', matchedSkills: [], missingSkills: [] }
  }
}

function keywordFallback(resumeText: string, requirements: string) {
  const terms = requirements
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .filter((term) => term.length >= 3)
  const uniqueTerms = [...new Set(terms)]
  const resume = resumeText.toLowerCase()
  const matchedTerms = uniqueTerms.filter((term) => resume.includes(term))
  const score = uniqueTerms.length === 0
    ? 0
    : Math.round((matchedTerms.length / uniqueTerms.length) * 100)
  return { score, status: statusFor(score) }
}
