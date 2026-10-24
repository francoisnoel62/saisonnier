import { z } from "zod"
import type { CheerioAPI } from "cheerio"

// Réparer uniquement les contrôles bruts dans les chaînes, jamais la structure JSON.
export function parseLenientJson(text: string): unknown {
  let quoted = false,
    escaped = false,
    result = ""
  for (const char of text) {
    if (quoted && char.charCodeAt(0) < 32) {
      result += `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
      escaped = false
      continue
    }
    result += char
    if (escaped) escaped = false
    else if (quoted && char === "\\") escaped = true
    else if (char === '"') quoted = !quoted
  }
  return JSON.parse(result)
}
const textNumber = z.union([z.string(), z.number()])
const address = z.object({
  streetAddress: z.string().optional(),
  addressLocality: z.string().optional(),
  postalCode: textNumber.optional(),
  addressRegion: z.string().optional(),
  addressCountry: z
    .union([z.string(), z.object({ name: z.string().optional() })])
    .optional(),
})
const location = z.object({ address })
export const jobPostingSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  identifier: z
    .union([z.string(), z.object({ value: textNumber.optional() })])
    .optional(),
  datePosted: z.string().optional(),
  validThrough: z.string().optional(),
  employmentType: z.union([z.string(), z.array(z.string())]).optional(),
  hiringOrganization: z
    .object({ name: z.string().optional(), sameAs: z.string().optional() })
    .optional(),
  jobLocation: z.union([location, z.array(location)]).optional(),
  baseSalary: z
    .object({
      currency: z.string().optional(),
      value: z
        .object({
          value: textNumber.optional(),
          minValue: textNumber.optional(),
          maxValue: textNumber.optional(),
          unitText: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  directApply: z.boolean().optional(),
  applicationContact: z
    .union([
      z.string(),
      z.object({
        email: z.string().optional(),
        telephone: z.string().optional(),
      }),
    ])
    .optional(),
})
export type JobPosting = z.infer<typeof jobPostingSchema>
export function jobPostings($: CheerioAPI): JobPosting[] {
  const postings: JobPosting[] = []
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== "object") return
    const object = value as Record<string, unknown>
    if (object["@graph"]) visit(object["@graph"])
    if (
      object["@type"] !== "JobPosting" &&
      !(
        Array.isArray(object["@type"]) && object["@type"].includes("JobPosting")
      )
    )
      return
    const result = jobPostingSchema.safeParse(value)
    if (result.success) postings.push(result.data)
  }
  $('script[type="application/ld+json"]').each((_i, node) => {
    try {
      visit(parseLenientJson($(node).text()))
    } catch {
      /* Un bloc illisible ne devient pas une preuve. */
    }
  })
  return postings
}
