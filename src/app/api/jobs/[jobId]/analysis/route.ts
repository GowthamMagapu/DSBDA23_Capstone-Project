import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

function parseSkillList(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((skill): skill is string => typeof skill === 'string') : []
  } catch {
    return []
  }
}

function rankedReason(application: { score: number; status: string; matchedSkills: string | null; missingSkills: string | null }) {
  const matched = parseSkillList(application.matchedSkills).slice(0, 3)
  const missing = parseSkillList(application.missingSkills).slice(0, 2)

  if (matched.length > 0 && missing.length > 0) {
    return `Score ${application.score}% because the candidate demonstrates ${matched.join(', ')} but still needs work on ${missing.join(', ')}.`
  }

  if (matched.length > 0) {
    return `Score ${application.score}% because the candidate strongly matches the core requirements in ${matched.join(', ')}.`
  }

  if (missing.length > 0) {
    return `Score ${application.score}% because the profile is still missing key signals such as ${missing.join(', ')}.`
  }

  return `Score ${application.score}% with status ${application.status}. The profile is borderline and would benefit from a more detailed review.`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await params
  const job = await prisma.job.findFirst({
    where: { id: jobId, ownerId: session.user.id },
    include: { applications: true },
  })

  if (!job) {
    return NextResponse.json({ message: 'Job not found' }, { status: 404 })
  }

  const applications = job.applications
  const totalApplications = applications.length
  const averageScore = totalApplications
    ? Math.round(applications.reduce((sum, application) => sum + application.score, 0) / totalApplications)
    : 0

  const selectedCount = applications.filter((item) => item.status === 'selected').length
  const reviewCount = applications.filter((item) => item.status === 'review').length
  const rejectedCount = applications.filter((item) => item.status === 'rejected').length

  const strongSkillMap = new Map<string, number>()
  const weakSkillMap = new Map<string, number>()

  applications.forEach((application) => {
    parseSkillList(application.matchedSkills).forEach((skill) => {
      strongSkillMap.set(skill, (strongSkillMap.get(skill) ?? 0) + 1)
    })

    parseSkillList(application.missingSkills).forEach((skill) => {
      weakSkillMap.set(skill, (weakSkillMap.get(skill) ?? 0) + 1)
    })
  })

  const strongSkills = [...strongSkillMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([skill, count]) => ({ skill, count }))

  const weakSkills = [...weakSkillMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([skill, count]) => ({ skill, count }))

  const topCandidates = [...applications]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((application) => ({
      name: application.candidateName,
      score: application.score,
      status: application.status,
      explanation: rankedReason(application),
    }))

  const recommendationList: string[] = []
  if (selectedCount === 0) {
    recommendationList.push('No candidate currently clears the target bar. Consider widening sourcing or tightening the role definition before the next round.')
  } else if (selectedCount < 2) {
    recommendationList.push('Only a small set of candidates are strong fits. Prioritize outreach to the top-ranked profiles and schedule interviews quickly.')
  } else {
    recommendationList.push('The short list is healthy. Move the strongest candidates quickly and keep the next-best profiles warm for backup interviews.')
  }

  if (weakSkills.length > 0) {
    recommendationList.push(`Focus interview calibration on the biggest skill gaps: ${weakSkills.slice(0, 3).map((item) => item.skill).join(', ')}.`)
  }

  if (averageScore >= 70) {
    recommendationList.push('The pipeline is performing well overall. Maintain the current screening criteria and keep evaluating high-signal profiles.')
  } else {
    recommendationList.push('Average match strength is below target. Rework the screening rubric or refine the job brief to improve early-fit quality.')
  }

  const bottleneckList: string[] = []
  if (totalApplications === 0) {
    bottleneckList.push('No applicants have been received yet. Sharing the public job link and improving sourcing channels should accelerate the funnel.')
  }

  if (reviewCount > selectedCount) {
    bottleneckList.push('The review queue is larger than the shortlist. This often means the team needs a stricter first-pass screen or a stronger job brief.')
  }

  if (weakSkills.length >= 3) {
    bottleneckList.push(`Most applicants are missing the same capabilities: ${weakSkills.slice(0, 3).map((item) => item.skill).join(', ')}.`)
  }

  if (selectedCount > 0 && reviewCount === 0 && rejectedCount === 0) {
    bottleneckList.push('The pipeline is narrow and highly concentrated. Consider opening the funnel to keep backup candidates available.')
  }

  const narrative = totalApplications === 0
    ? `No applications have been received for ${job.title} yet.`
    : `This role has ${totalApplications} applicants with an average score of ${averageScore}%. ${selectedCount} are strong fits, ${reviewCount} need a closer look, and ${rejectedCount} are currently below the target profile.`

  return NextResponse.json({
    jobTitle: job.title,
    totalApplications,
    averageScore,
    selectedCount,
    reviewCount,
    rejectedCount,
    strongSkills,
    weakSkills,
    topCandidates,
    narrative,
    recommendations: recommendationList,
    bottlenecks: bottleneckList.length > 0 ? bottleneckList : ['No major bottlenecks detected yet. Continue monitoring the pipeline as more applications arrive.'],
  })
}
