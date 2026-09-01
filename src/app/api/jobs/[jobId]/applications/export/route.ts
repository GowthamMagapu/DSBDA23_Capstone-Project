import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function parseSkillList(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((skill): skill is string => typeof skill === 'string') : []
  } catch {
    return []
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params
  const job = await prisma.job.findFirst({ where: { id: jobId, ownerId: session.user.id } })
  if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 })

  const applications = await prisma.application.findMany({
    where: { jobId },
    orderBy: { score: 'desc' },
  })

  const totalApplications = applications.length
  const averageScore = totalApplications
    ? Math.round(applications.reduce((sum, application) => sum + application.score, 0) / totalApplications)
    : 0
  const selectedCount = applications.filter((application) => application.status === 'selected').length
  const reviewCount = applications.filter((application) => application.status === 'review').length
  const rejectedCount = applications.filter((application) => application.status === 'rejected').length

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

  const strongSkills = [...strongSkillMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const weakSkills = [...weakSkillMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const recommendations = [
    selectedCount === 0
      ? 'No candidate currently clears the target bar.'
      : `${selectedCount} candidate(s) are strong fits and should be advanced quickly.`,
    weakSkills.length > 0 ? `Common gaps: ${weakSkills.map(([skill]) => skill).join(', ')}.` : 'No recurring skill gaps detected yet.',
    averageScore >= 70 ? 'The pipeline is above target. Keep the current screening criteria.' : 'Average quality is below target and may require better sourcing or stronger screening.',
  ]

  const bottlenecks = [
    totalApplications === 0 ? 'No applications yet. Increase sourcing reach.' : `${reviewCount} candidate(s) are in review and may slow down the hiring cycle.`,
    weakSkills.length > 0 ? `The main constraints are ${weakSkills.slice(0, 3).map(([skill]) => skill).join(', ')}.` : 'No obvious hiring bottleneck is visible yet.',
  ]

  const rankingRows = applications
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((application) => {
      const matched = parseSkillList(application.matchedSkills).slice(0, 3)
      const missing = parseSkillList(application.missingSkills).slice(0, 2)
      const reason = matched.length > 0 && missing.length > 0
        ? `${application.candidateName}: strong match on ${matched.join(', ')}; still needs ${missing.join(', ')}.`
        : `${application.candidateName}: score ${application.score}% with status ${application.status}.`
      return [application.candidateName, application.score, application.status, reason]
    })

  const rows = [
    ['Report', 'Value'],
    ['Job Title', job.title],
    ['Total Applications', totalApplications],
    ['Average Score', averageScore],
    ['Selected', selectedCount],
    ['Review', reviewCount],
    ['Rejected', rejectedCount],
    [],
    ['Summary', 'Recommendations'],
    ...recommendations.map((item) => ['Recommendation', item]),
    [],
    ['Summary', 'Bottlenecks'],
    ...bottlenecks.map((item) => ['Bottleneck', item]),
    [],
    ['Summary', 'Strong Signals'],
    ...strongSkills.map(([skill, count]) => ['Skill', `${skill} (${count})`]),
    [],
    ['Summary', 'Missing Skills'],
    ...weakSkills.map(([skill, count]) => ['Gap', `${skill} (${count})`]),
    [],
    ['Top Candidates', 'Score', 'Status', 'Reason'],
    ...rankingRows,
  ]

  const csv = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${job.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.csv"`,
    },
  })
}
