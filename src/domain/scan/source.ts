import { z } from "zod"

import { isValidSiren } from "@/domain/membership"

import { scanLimits } from "./limits"
import { checkScanUrl, isTestSourceUrl, type ScanUrlPolicy } from "./url-safety"

const noteSchema = z.object({
  url: z.url(),
  note: z.string().min(1),
  checkedAt: z.iso.date(),
})
export const scanSourceSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1),
  employer: z.object({
    name: z.string().min(1),
    siren: z.string().refine(isValidSiren).optional(),
  }),
  adapter: z.enum(["teamtailor", "factorial", "smartrecruiters", "fixture"]),
  listUrls: z.array(z.url()).min(1),
  postingUrlPattern: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        new RegExp(value)
        return true
      } catch {
        return false
      }
    }),
  officialHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1),
  employerWebsite: z.url(),
  affiliationProof: noteSchema,
  reuse: noteSchema.extend({ robotsExcerpt: z.string().min(1) }),
  role: z.enum(["primary", "reserve"]),
  priority: z.number().int().nonnegative(),
  limits: z.object({
    minIntervalMs: z.number().int().min(scanLimits.minIntervalMs).optional(),
    timeoutMs: z.number().int().positive().max(scanLimits.timeoutMs).optional(),
    maxBytes: z.number().int().positive().max(scanLimits.maxBytes).optional(),
    maxListPages: z
      .number()
      .int()
      .positive()
      .max(scanLimits.maxListPages)
      .optional(),
    maxPostings: z
      .number()
      .int()
      .positive()
      .max(scanLimits.maxPostings)
      .optional(),
  }),
  placeAliases: z.record(
    z.string().min(1),
    z.object({
      inseeCode: z.string().regex(/^(?:\d{5}|2[AB]\d{3})$/),
      name: z.string().min(1),
      departmentCode: z.string().regex(/^(?:\d{2,3}|2[AB])$/),
    }),
  ),
})
export type ScanSourceDefinition = z.infer<typeof scanSourceSchema>

export function validateScanSourceRegistry(
  registry: Record<string, ScanSourceDefinition>,
  policy: ScanUrlPolicy,
) {
  const errors: string[] = []
  const keys = new Set<string>()
  for (const [key, value] of Object.entries(registry)) {
    const parsed = scanSourceSchema.safeParse(value)
    if (!parsed.success) {
      errors.push(`${key}: ${z.prettifyError(parsed.error)}`)
      continue
    }
    const source = parsed.data
    if (source.key !== key || keys.has(source.key))
      errors.push(`${key}: clé incohérente ou dupliquée`)
    keys.add(source.key)
    for (const value of [
      ...source.listUrls,
      source.employerWebsite,
      source.affiliationProof.url,
      source.reuse.url,
    ]) {
      const url = checkScanUrl(value, policy)
      if (
        !url ||
        (url.protocol !== "https:" &&
          !(source.adapter === "fixture" && isTestSourceUrl(url, policy)))
      )
        errors.push(`${key}: URL interdite ${value}`)
    }
    for (const value of source.listUrls) {
      if (!source.officialHosts.includes(new URL(value).hostname))
        errors.push(`${key}: hôte non officiel ${value}`)
    }
  }
  return errors
}
