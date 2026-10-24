import type { Evidence } from "./observation"
import type { ScanIssue } from "./vocabulary"

export type ProposalField<T> =
  | { status: "absent"; evidence: Evidence[] }
  | { status: "established"; value: T; evidence: Evidence[] }
  | { status: "to_verify"; value?: T; evidence: Evidence[] }
  | { status: "contradictory"; values: T[]; evidence: Evidence[] }
export type RuleResult<T> = { field: ProposalField<T>; issues: ScanIssue[] }
export const absent = <T = never>(): Extract<
  ProposalField<T>,
  { status: "absent" }
> => ({ status: "absent", evidence: [] })
export function established<T>(
  value: T,
  evidence: Evidence[],
): ProposalField<T> {
  return evidence.length ? { status: "established", value, evidence } : absent()
}
export function valueOf<T>(field: ProposalField<T>): T | undefined {
  return field.status === "established" ? field.value : undefined
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    )
  return JSON.stringify(value)
}
export function resolveFacts<T>(
  facts: { value: T; evidence: Evidence }[],
): ProposalField<T> {
  const values = facts
    .map((fact) => fact.value)
    .filter(
      (value, index, all) =>
        all.findIndex((other) => stable(other) === stable(value)) === index,
    )
  const evidence = facts.map((fact) => fact.evidence)
  if (!values.length) return absent()
  return values.length === 1
    ? established(values[0], evidence)
    : { status: "contradictory", values, evidence }
}
