import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedResumeFile, resumeMimeTypeFor, sanitizeFileName } from '@/lib/resume-file'

describe('resume-file — upload allowlist and filename safety', () => {
  test('accepts the documented resume formats, case-insensitively', () => {
    for (const name of ['cv.pdf', 'cv.PDF', 'cv.doc', 'cv.docx', 'cv.rtf', 'cv.txt']) {
      assert.equal(isAllowedResumeFile(name), true, `${name} should be allowed`)
    }
  })

  test('rejects executables, scripts and extensionless files', () => {
    for (const name of ['payload.exe', 'shell.sh', 'page.html', 'script.js', 'resume', 'archive.zip']) {
      assert.equal(isAllowedResumeFile(name), false, `${name} should be rejected`)
    }
  })

  test('derives the MIME type from the extension, never from the client', () => {
    // The browser-supplied File.type is attacker-controlled on the public endpoint,
    // so a served Content-Type must come from the extension instead.
    assert.equal(resumeMimeTypeFor('cv.pdf'), 'application/pdf')
    assert.equal(resumeMimeTypeFor('cv.txt'), 'text/plain')
    assert.equal(
      resumeMimeTypeFor('cv.docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  })

  test('falls back to octet-stream for unknown extensions', () => {
    assert.equal(resumeMimeTypeFor('page.html'), 'application/octet-stream')
    assert.equal(resumeMimeTypeFor('noext'), 'application/octet-stream')
  })

  test('strips directory traversal from filenames', () => {
    assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd')
    assert.equal(sanitizeFileName(String.raw`C:\Users\me\cv.pdf`), 'cv.pdf')
  })

  test('strips quotes and control characters that would break Content-Disposition', () => {
    assert.equal(sanitizeFileName('cv".pdf'), 'cv.pdf')
    assert.equal(sanitizeFileName('cv\r\n.pdf'), 'cv.pdf')
    assert.ok(!sanitizeFileName('a\u0000b.pdf').includes('\u0000'))
  })

  test('caps length and never returns an empty name', () => {
    assert.equal(sanitizeFileName(`${'a'.repeat(400)}.pdf`).length, 200)
    assert.equal(sanitizeFileName(''), 'resume')
    assert.equal(sanitizeFileName('"'), 'resume')
  })
})
