import { logAgentEvent } from '@/lib/agent-events'
import { notifyGoogleIndexing } from '@/lib/google-indexing'
import { configuredChannels, postToChannel } from '@/lib/job-channels'
import { createJobAnnouncementText } from '@/lib/job-sharing'

// The approval-free distribution the agent runs after a job goes live: Google for Jobs via the
// Indexing API, plus any configured community channels. Each step reports to the activity feed
// and never throws, so one broken channel can't block the others or the recruiter's email.

export async function distributeJob(input: {
  ownerId: string
  jobId: string
  title: string
  companyName: string
  location: string | null
  tags: string[]
  publicUrl: string
}) {
  const text = createJobAnnouncementText({
    title: input.title,
    companyName: input.companyName,
    location: input.location,
    tags: input.tags,
    url: input.publicUrl,
  })

  const [google, ...channels] = await Promise.all([
    notifyGoogleIndexing(input.publicUrl, 'URL_UPDATED'),
    ...configuredChannels().map((channel) => postToChannel(channel, text)),
  ])

  if (google.status !== 'skipped') {
    await logAgentEvent({
      ownerId: input.ownerId,
      jobId: input.jobId,
      type: `distribution.google.${google.status}`,
      level: google.status === 'notified' ? 'success' : 'error',
      message: `"${input.title}": ${google.message}`,
    })
  }
  for (const result of channels) {
    await logAgentEvent({
      ownerId: input.ownerId,
      jobId: input.jobId,
      type: `distribution.${result.channel}.${result.status}`,
      level: result.status === 'posted' ? 'success' : 'error',
      message: `"${input.title}": ${result.message}`,
    })
  }
}

/** Tells Google a deleted role is gone so it drops out of Google for Jobs promptly. */
export async function withdrawJob(input: { ownerId: string; title: string; publicUrl: string }) {
  const google = await notifyGoogleIndexing(input.publicUrl, 'URL_DELETED')
  if (google.status === 'skipped') return
  await logAgentEvent({
    ownerId: input.ownerId,
    type: `distribution.google.${google.status}`,
    level: google.status === 'notified' ? 'success' : 'error',
    message: `"${input.title}" removed: ${google.message}`,
  })
}
