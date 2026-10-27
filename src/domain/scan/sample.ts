export const sampleFields = [
  "contract",
  "period",
  "locations",
  "application",
  "salary",
] as const
export type SampleField = (typeof sampleFields)[number]
export type ExtractionSampleItem = {
  url: string
  title: string
  companyName?: string | null
  readable: boolean
  fields: Record<SampleField, { established: boolean; text: string }>
  issues: string[]
}
export type ExtractionSample = {
  sourceKey: string
  deploymentUrl: string
  sampledAt: string
  extractorVersion: string
  items: ExtractionSampleItem[]
  coverage: Record<SampleField, { established: number; total: number }>
  failure?: string
}
export function sampleCoverage(
  items: ExtractionSampleItem[],
): ExtractionSample["coverage"] {
  return Object.fromEntries(
    sampleFields.map((field) => [
      field,
      {
        established: items.filter(
          (item) => item.readable && item.fields[field].established,
        ).length,
        total: items.length,
      },
    ]),
  ) as ExtractionSample["coverage"]
}
