export type LinkedInShareResult = {
  success: boolean
  status: 'posted' | 'skipped' | 'failed'
  message: string
  postId?: string
}

export function buildPublicJobUrl(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/$/, '')}/careers/${slug}`
}

export function createLinkedInPostText(title: string, url: string) {
  return [
    'We’re hiring! 🚀',
    '',
    `We’re looking for a ${title} to join our team.`,
    '',
    'If you’re interested or know someone who would be a great fit, apply here:',
    url,
    '',
    '#Hiring #Jobs #CareerOpportunity #TalentAcquisition',
  ].join('\n')
}

export async function publishJobToLinkedIn(title: string, publicUrl: string): Promise<LinkedInShareResult> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
  const organizationUrn = process.env.LINKEDIN_ORGANIZATION_URN

  if (!accessToken || !organizationUrn) {
    return {
      success: false,
      status: 'skipped',
      message: 'LinkedIn auto-post is not configured. Add LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORGANIZATION_URN to enable it.',
    }
  }

  const normalizedOrgUrn = organizationUrn.startsWith('urn:li:organization:')
    ? organizationUrn
    : `urn:li:organization:${organizationUrn}`

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0',
    },
    body: JSON.stringify({
      author: normalizedOrgUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: createLinkedInPostText(title, publicUrl),
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  })

  const text = await response.text()

  if (!response.ok) {
    return {
      success: false,
      status: 'failed',
      message: `LinkedIn post failed (${response.status}): ${text.slice(0, 200)}`,
    }
  }

  return {
    success: true,
    status: 'posted',
    message: 'Job published to LinkedIn successfully.',
    postId: text || undefined,
  }
}
