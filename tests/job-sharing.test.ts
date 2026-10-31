import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJobPostingJsonLd,
  buildLinkedInShareUrl,
  createJobAnnouncementText,
  parseJobTags,
  serializeJsonLd,
} from '@/lib/job-sharing'

const baseJob = {
  title: 'Frontend Engineer',
  listing: 'About Acme\n\nWe build <fast> tools & more.\nLine two.',
  url: 'https://agentu.example.com/careers/frontend-engineer-abc',
  datePosted: new Date('2026-09-01T00:00:00Z'),
  company: { name: 'Acme', website: 'acme.dev', location: 'Hyderabad, Telangana, India' },
}

describe('buildLinkedInShareUrl — approval-free LinkedIn sharing', () => {
  test('targets the share-offsite dialog with the job URL encoded', () => {
    const shareUrl = new URL(buildLinkedInShareUrl('https://agentu.example.com/careers/a?b=1&c=2'))
    assert.equal(shareUrl.origin + shareUrl.pathname, 'https://www.linkedin.com/sharing/share-offsite/')
    assert.equal(shareUrl.searchParams.get('url'), 'https://agentu.example.com/careers/a?b=1&c=2')
  })
})

describe('createJobAnnouncementText', () => {
  test('includes the apply link and sanitised hashtags, capped at six', () => {
    const text = createJobAnnouncementText({
      title: 'Frontend Engineer',
      companyName: 'Acme',
      location: 'Remote',
      tags: ['React.js', 'Type Script', '', 'a', 'b', 'c', 'd'],
      url: baseJob.url,
    })
    assert.ok(text.includes(baseJob.url))
    assert.ok(text.includes('Frontend Engineer (Remote)'))
    const hashtags = text.trim().split('\n').at(-1)!.split(' ')
    assert.deepEqual(hashtags, ['#Hiring', '#Reactjs', '#TypeScript', '#a', '#b', '#c'])
  })
})

describe('parseJobTags', () => {
  test('returns [] for null, malformed JSON, or non-arrays', () => {
    assert.deepEqual(parseJobTags(null), [])
    assert.deepEqual(parseJobTags('{oops'), [])
    assert.deepEqual(parseJobTags('{"a":1}'), [])
    assert.deepEqual(parseJobTags('["react", 3]'), ['react', '3'])
  })
})

describe('buildJobPostingJsonLd — Google for Jobs structured data', () => {
  test('emits the fields Google requires', () => {
    const data = buildJobPostingJsonLd(baseJob)
    assert.equal(data['@type'], 'JobPosting')
    assert.equal(data.title, 'Frontend Engineer')
    assert.equal(data.datePosted, '2026-09-01T00:00:00.000Z')
    assert.equal(data.validThrough, '2026-10-31T00:00:00.000Z')
    assert.deepEqual(data.hiringOrganization, { '@type': 'Organization', name: 'Acme', sameAs: 'https://acme.dev' })
    assert.deepEqual(data.jobLocation, {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'Hyderabad', addressRegion: 'Telangana', addressCountry: 'India' },
    })
  })

  test('renders the listing as escaped HTML paragraphs', () => {
    const data = buildJobPostingJsonLd(baseJob)
    assert.equal(data.description, '<p>About Acme</p><p>We build &lt;fast&gt; tools &amp; more.<br>Line two.</p>')
  })

  test('gives a city-only location the default country, which Google requires', () => {
    const data = buildJobPostingJsonLd({ ...baseJob, company: { ...baseJob.company, location: 'Hyderabad' } })
    assert.deepEqual(data.jobLocation?.address, { '@type': 'PostalAddress', addressLocality: 'Hyderabad', addressCountry: 'IN' })
  })

  test('uses a configured default country instead of IN', () => {
    const data = buildJobPostingJsonLd({ ...baseJob, company: { ...baseJob.company, location: 'Austin' }, defaultCountry: 'US' })
    assert.equal(data.jobLocation?.address.addressCountry, 'US')
  })

  test('marks remote roles as TELECOMMUTE with the country applicants must be in', () => {
    const data = buildJobPostingJsonLd({ ...baseJob, company: { ...baseJob.company, location: 'Remote (India)' } })
    assert.equal(data.jobLocationType, 'TELECOMMUTE')
    assert.deepEqual(data.applicantLocationRequirements, { '@type': 'Country', name: 'India' })
    assert.equal('jobLocation' in data, false)
  })

  test('falls back to the default country for a plain "Remote" location', () => {
    const data = buildJobPostingJsonLd({ ...baseJob, company: { ...baseJob.company, location: 'Remote' } })
    assert.deepEqual(data.applicantLocationRequirements, { '@type': 'Country', name: 'IN' })
  })

  test('still names a country, and omits the website, when the company has neither location nor site', () => {
    const data = buildJobPostingJsonLd({ ...baseJob, company: { name: 'Acme', website: null, location: null } })
    assert.deepEqual(data.jobLocation, { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'IN' } })
    assert.equal('sameAs' in data.hiringOrganization, false)
  })
})

describe('serializeJsonLd', () => {
  test('cannot close the surrounding <script> tag', () => {
    const json = serializeJsonLd({ title: '</script><script>alert(1)</script>' })
    assert.equal(json.includes('</script>'), false)
    assert.deepEqual(JSON.parse(json), { title: '</script><script>alert(1)</script>' })
  })
})
