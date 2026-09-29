// Announces new jobs in community channels. Unlike LinkedIn, Discord webhooks and Telegram bots
// need no platform review, so these posts are fully automatic. Channels are configured once for
// the whole deployment (e.g. an "AgentU Jobs" channel) through environment variables.

export type ChannelName = 'discord' | 'telegram'
export type ChannelResult = { channel: ChannelName; status: 'posted' | 'failed'; message: string }

const DISCORD_MAX_LENGTH = 2000
const TELEGRAM_MAX_LENGTH = 4096

export function configuredChannels(): ChannelName[] {
  const channels: ChannelName[] = []
  if (process.env.DISCORD_WEBHOOK_URL) channels.push('discord')
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) channels.push('telegram')
  return channels
}

export async function postToChannel(channel: ChannelName, text: string): Promise<ChannelResult> {
  const request = channel === 'discord'
    ? {
        url: process.env.DISCORD_WEBHOOK_URL ?? '',
        body: { content: text.slice(0, DISCORD_MAX_LENGTH), username: 'AgentU Jobs' },
      }
    : {
        url: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        body: { chat_id: process.env.TELEGRAM_CHAT_ID, text: text.slice(0, TELEGRAM_MAX_LENGTH) },
      }
  const label = channel === 'discord' ? 'Discord' : 'Telegram'

  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      // Never echo the request URL: both carry the channel's secret token.
      const detail = await response.text().catch(() => '')
      return { channel, status: 'failed', message: `${label} post failed (${response.status}). ${detail.slice(0, 200)}`.trim() }
    }
    return { channel, status: 'posted', message: `Announced on ${label}.` }
  } catch (error) {
    return { channel, status: 'failed', message: `${label} unreachable: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
}
