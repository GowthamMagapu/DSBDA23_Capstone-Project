const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export function isAiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY)
}

export async function generateJson<T>(systemInstruction: string, prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const response = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned an empty response')
  return JSON.parse(text) as T
}
