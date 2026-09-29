import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export async function extractResumeText(file: File, data: Buffer) {
  const extension = file.name.toLowerCase().split('.').pop()

  if (file.type.startsWith('text/') || extension === 'txt' || extension === 'rtf') {
    return data.toString('utf8')
  }

  if (file.type === 'application/pdf' || extension === 'pdf') {
    const parser = new PDFParse({ data })
    try {
      const result = await parser.getText()
      return result.text
    } finally {
      await parser.destroy()
    }
  }

  // Only .docx is a zip mammoth can read; legacy binary .doc would make it throw, so it
  // falls through and is scored on the cover letter alone.
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer: data })
    return result.value
  }

  return ''
}
