import { z } from 'zod'

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null)

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters.').max(120),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => value || null)
    .refine((value) => !value || /^https?:\/\/\S+\.\S+/i.test(value), 'Website must start with http:// or https://'),
  industry: optionalText(120),
  location: optionalText(160),
  size: optionalText(60),
  about: z.string().trim().min(30, 'Tell candidates about the company in at least 30 characters.').max(5000),
  culture: optionalText(3000),
  notificationEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || null)
    .refine((value) => !value || z.string().email().safeParse(value).success, 'Notification email is invalid.'),
  notifyOnApplication: z.boolean().default(true),
})

export type CompanyInput = z.infer<typeof companySchema>

export type CompanyContext = {
  name: string
  website: string | null
  industry: string | null
  location: string | null
  size: string | null
  about: string
  culture: string | null
}

/** Plain-text company brief used to ground AI-generated listings and posts. */
export function describeCompany(company: CompanyContext) {
  return [
    `Company name: ${company.name}`,
    company.industry && `Industry: ${company.industry}`,
    company.location && `Location: ${company.location}`,
    company.size && `Company size: ${company.size}`,
    company.website && `Website: ${company.website}`,
    `About the company:\n${company.about}`,
    company.culture && `Culture and benefits (only mention what is stated here):\n${company.culture}`,
  ]
    .filter(Boolean)
    .join('\n')
}
