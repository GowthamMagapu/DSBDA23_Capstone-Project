// Canonical MIME type we serve back for each accepted resume extension. We never trust
// the browser-supplied `File.type` for storage/serving — it's fully attacker-controlled
// on the public application endpoint, so a client could otherwise set it to e.g.
// "text/html" and have it replayed as the Content-Type on download.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rtf: 'application/rtf',
  txt: 'text/plain',
}

function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

export function isAllowedResumeFile(fileName: string): boolean {
  const extension = getExtension(fileName)
  return extension in EXTENSION_MIME_TYPES
}

/** Canonical, safe MIME type to store/serve for a resume file, based on its extension. */
export function resumeMimeTypeFor(fileName: string): string {
  return EXTENSION_MIME_TYPES[getExtension(fileName)] ?? 'application/octet-stream'
}

/**
 * Strips path separators, control characters, and quotes from a user-supplied
 * filename so it's safe to store and to embed in a Content-Disposition header.
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'resume'
  const cleaned = base.replace(/[\x00-\x1f\x7f"]/g, '').trim()
  return cleaned.slice(0, 200) || 'resume'
}
