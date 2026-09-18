import { prisma } from '@/lib/prisma'
import { getAppUrl } from '@/lib/app-url'
import { escapeHtml, sendEmail } from '@/lib/email'
import { logAgentEvent } from '@/lib/agent-events'
import type { LinkedInShareResult } from '@/lib/linkedin'

// Recruiter email updates. Every send is mirrored into the agent activity feed so the recruiter
// can see in the dashboard whether mail went out (or why it didn't).

async function getRecipient(ownerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { email: true, name: true, company: { select: { name: true, notificationEmail: true, notifyOnApplication: true } } },
  })
  if (!user) return null
  return {
    to: user.company?.notificationEmail || user.email,
    recruiterName: user.name,
    companyName: user.company?.name ?? 'your company',
    notifyOnApplication: user.company?.notifyOnApplication ?? true,
  }
}

function layout(heading: string, bodyHtml: string) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 620px; margin: 0 auto; color: #111827;">
      <p style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #6b7280; margin: 0 0 8px;">AgentU · HR Agent</p>
      <h2 style="margin: 0 0 20px; font-size: 22px;">${heading}</h2>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">
        You're receiving this because you publish jobs with AgentU.
        Manage notifications in your <a href="${escapeHtml(getAppUrl())}/dashboard" style="color: #6b7280;">company settings</a>.
      </p>
    </div>
  `
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; margin: 4px 8px 4px 0;">${escapeHtml(label)}</a>`
}

async function deliver(ownerId: string, jobId: string | null, subject: string, html: string, text: string, to: string) {
  const result = await sendEmail({ to, subject, html, text })
  await logAgentEvent({
    ownerId,
    jobId,
    type: result.sent ? 'email.sent' : 'email.skipped',
    level: result.sent ? 'info' : 'warning',
    message: result.sent ? `Emailed ${to}: ${subject}` : `Email not sent (${result.reason}): ${subject}`,
  })
  return result
}

export async function notifyJobPublished(input: {
  ownerId: string
  jobId: string
  title: string
  publicUrl: string
  linkedin: LinkedInShareResult
}) {
  const recipient = await getRecipient(input.ownerId)
  if (!recipient) return

  const linkedinLine = input.linkedin.status === 'posted'
    ? `Shared on LinkedIn. ${input.linkedin.postUrl ? 'View the post using the button below.' : ''}`
    : input.linkedin.status === 'skipped'
      ? `Not shared on LinkedIn: ${input.linkedin.message}`
      : `LinkedIn post failed: ${input.linkedin.message} You can retry from the dashboard.`

  const subject = `Published: ${input.title} at ${recipient.companyName}`
  const html = layout(
    `Your ${escapeHtml(input.title)} role is live`,
    `
      <p>The HR agent generated the public listing and published it for ${escapeHtml(recipient.companyName)}.</p>
      <p><strong>Public link:</strong><br /><a href="${escapeHtml(input.publicUrl)}">${escapeHtml(input.publicUrl)}</a></p>
      <p><strong>LinkedIn:</strong> ${escapeHtml(linkedinLine)}</p>
      <p style="margin-top: 20px;">
        ${button(input.publicUrl, 'Open job page')}
        ${input.linkedin.postUrl ? button(input.linkedin.postUrl, 'View LinkedIn post') : ''}
        ${button(`${getAppUrl()}/dashboard`, 'Open dashboard')}
      </p>
      <p style="color: #6b7280; font-size: 14px;">We'll email you as candidates apply and get scored.</p>
    `
  )
  const text = [
    `Your ${input.title} role is live.`,
    `Public link: ${input.publicUrl}`,
    `LinkedIn: ${linkedinLine}`,
    input.linkedin.postUrl ? `LinkedIn post: ${input.linkedin.postUrl}` : '',
    `Dashboard: ${getAppUrl()}/dashboard`,
  ].filter(Boolean).join('\n')

  await deliver(input.ownerId, input.jobId, subject, html, text, recipient.to)
}

export async function notifyNewApplication(input: {
  ownerId: string
  jobId: string
  jobTitle: string
  candidateName: string
  candidateEmail: string
  score: number
  status: string
  aiSummary: string
  matchedSkills: string[]
  missingSkills: string[]
}) {
  const recipient = await getRecipient(input.ownerId)
  if (!recipient || !recipient.notifyOnApplication) return

  const [totalApplications, selectedCount] = await Promise.all([
    prisma.application.count({ where: { jobId: input.jobId } }),
    prisma.application.count({ where: { jobId: input.jobId, status: 'selected' } }),
  ])

  const statusColor = input.status === 'selected' ? '#059669' : input.status === 'review' ? '#d97706' : '#dc2626'
  const chips = (skills: string[], color: string, prefix: string) =>
    skills.map((skill) => `<span style="display: inline-block; border: 1px solid ${color}; color: ${color}; border-radius: 999px; padding: 2px 10px; font-size: 12px; margin: 2px;">${prefix} ${escapeHtml(skill)}</span>`).join('')

  const subject = `New applicant for ${input.jobTitle}: ${input.candidateName} (${input.score}%)`
  const html = layout(
    `${escapeHtml(input.candidateName)} applied for ${escapeHtml(input.jobTitle)}`,
    `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb;"><div style="font-size: 12px; color: #6b7280;">AI match score</div><div style="font-size: 24px; font-weight: bold;">${input.score}%</div></td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;"><div style="font-size: 12px; color: #6b7280;">Status</div><div style="font-size: 18px; font-weight: bold; color: ${statusColor}; text-transform: uppercase;">${escapeHtml(input.status)}</div></td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;"><div style="font-size: 12px; color: #6b7280;">Pipeline</div><div style="font-size: 14px;">${totalApplications} applicant${totalApplications === 1 ? '' : 's'} · ${selectedCount} selected</div></td>
        </tr>
      </table>
      <p style="margin: 0 0 4px;"><strong>Candidate email:</strong> ${escapeHtml(input.candidateEmail)}</p>
      ${input.aiSummary ? `<p><strong>AI recruiter evaluation:</strong><br />${escapeHtml(input.aiSummary)}</p>` : '<p style="color: #6b7280;">AI evaluation unavailable — scored by keyword match.</p>'}
      ${input.matchedSkills.length ? `<p style="margin-bottom: 4px;"><strong>Matched</strong></p><div>${chips(input.matchedSkills, '#059669', '+')}</div>` : ''}
      ${input.missingSkills.length ? `<p style="margin-bottom: 4px;"><strong>Missing</strong></p><div>${chips(input.missingSkills, '#dc2626', '−')}</div>` : ''}
      <p style="margin-top: 20px;">${button(`${getAppUrl()}/dashboard`, 'Review in dashboard')}</p>
    `
  )
  const text = [
    `${input.candidateName} (${input.candidateEmail}) applied for ${input.jobTitle}.`,
    `AI match score: ${input.score}% — ${input.status}`,
    input.aiSummary && `Evaluation: ${input.aiSummary}`,
    input.matchedSkills.length && `Matched: ${input.matchedSkills.join(', ')}`,
    input.missingSkills.length && `Missing: ${input.missingSkills.join(', ')}`,
    `Pipeline: ${totalApplications} applicants, ${selectedCount} selected`,
    `Dashboard: ${getAppUrl()}/dashboard`,
  ].filter(Boolean).join('\n')

  await deliver(input.ownerId, input.jobId, subject, html, text, recipient.to)
}

export async function notifyCandidatePoolScored(input: {
  ownerId: string
  jobId: string
  jobTitle: string
  scored: { name: string; score: number; status: string }[]
}) {
  const recipient = await getRecipient(input.ownerId)
  if (!recipient || input.scored.length === 0) return

  const top = [...input.scored].sort((a, b) => b.score - a.score).slice(0, 5)
  const selected = input.scored.filter((candidate) => candidate.status === 'selected').length

  const subject = `${input.scored.length} existing candidate${input.scored.length === 1 ? '' : 's'} scored for ${input.jobTitle}`
  const html = layout(
    `Your candidate pool was matched to ${escapeHtml(input.jobTitle)}`,
    `
      <p>The HR agent re-evaluated ${input.scored.length} existing candidate${input.scored.length === 1 ? '' : 's'}; ${selected} cleared the selection bar.</p>
      <table style="width: 100%; border-collapse: collapse;">
        ${top.map((candidate) => `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(candidate.name)}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${candidate.score}% · ${escapeHtml(candidate.status)}</td></tr>`).join('')}
      </table>
      <p style="margin-top: 20px;">${button(`${getAppUrl()}/dashboard`, 'Review in dashboard')}</p>
    `
  )
  const text = [
    `${input.scored.length} existing candidate(s) were scored for ${input.jobTitle}; ${selected} selected.`,
    ...top.map((candidate) => `- ${candidate.name}: ${candidate.score}% (${candidate.status})`),
    `Dashboard: ${getAppUrl()}/dashboard`,
  ].join('\n')

  await deliver(input.ownerId, input.jobId, subject, html, text, recipient.to)
}
