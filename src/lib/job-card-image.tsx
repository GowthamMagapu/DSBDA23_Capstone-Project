import { ImageResponse } from 'next/og'

// The 1200×630 card link unfurlers (LinkedIn, WhatsApp, X, Slack) show for a shared job.
// Kept separate from the route file so it can be rendered with sample data outside Next.js.

export const JOB_CARD_SIZE = { width: 1200, height: 630 }

export type JobCardData = {
  title: string
  companyName: string
  location: string | null
  tags: string[]
  /** False for a missing/unpublished job: shows a generic careers card instead. */
  found: boolean
}

export function renderJobCardImage({ title, companyName, location, tags, found }: JobCardData) {
  // Longer titles step down so the card keeps breathing room at two or three lines.
  const titleSize = title.length <= 22 ? 84 : title.length <= 44 ? 66 : title.length <= 70 ? 56 : 48

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#000', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, background: '#000', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>AgentU</div>
          <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.35)' }}>/ Careers</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            {found ? `${companyName} is hiring` : companyName}
          </div>
          <div style={{ fontSize: titleSize, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {tags.slice(0, 4).map((tag) => (
                <div key={tag} style={{ fontSize: 24, padding: '8px 18px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999, color: 'rgba(255,255,255,0.75)' }}>{tag}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 28 }}>
          <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.65)' }}>{location ?? 'Apply online'}</div>
          <div style={{ fontSize: 28, fontWeight: 600, background: '#fff', color: '#000', padding: '12px 28px', borderRadius: 12 }}>Apply now →</div>
        </div>
      </div>
    ),
    JOB_CARD_SIZE
  )
}
