import mammoth from 'mammoth'

// pdf-parse pulls in pdfjs-dist, which loads the native @napi-rs/canvas polyfill through a
// runtime require that bundlers cannot trace. Imported at the top of this module, a failure to
// load it crashed the whole application route on Vercel, so every submission returned a 500.
// Loading it on the first PDF confines any such failure to PDF text extraction, which callers
// already treat as optional. The worker module goes first, as pdf-parse documents for
// serverless hosts: it installs the DOMMatrix polyfill pdfjs needs outside a browser.
async function loadPdfParse() {
  const { CanvasFactory } = await import('pdf-parse/worker')
  const { PDFParse } = await import('pdf-parse')
  return { PDFParse, CanvasFactory }
}

export async function extractResumeText(file: File, data: Buffer) {
  const extension = file.name.toLowerCase().split('.').pop()

  if (file.type.startsWith('text/') || extension === 'txt' || extension === 'rtf') {
    return data.toString('utf8')
  }

  if (file.type === 'application/pdf' || extension === 'pdf') {
    const { PDFParse, CanvasFactory } = await loadPdfParse()
    const parser = new PDFParse({ data, CanvasFactory })
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
