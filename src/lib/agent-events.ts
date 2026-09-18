import { prisma } from '@/lib/prisma'

export type AgentEventLevel = 'info' | 'success' | 'warning' | 'error'

export type AgentEventInput = {
  ownerId: string
  jobId?: string | null
  type: string
  level?: AgentEventLevel
  message: string
}

/**
 * Records a step the HR agent took so the recruiter's live activity feed can show it.
 * Logging must never break the workflow it describes, so failures are swallowed.
 */
export async function logAgentEvent({ ownerId, jobId, type, level = 'info', message }: AgentEventInput) {
  try {
    await prisma.agentEvent.create({
      data: { ownerId, jobId: jobId ?? null, type, level, message: message.slice(0, 2000) },
    })
  } catch (error) {
    console.error('Failed to record agent event', type, error)
  }
}
