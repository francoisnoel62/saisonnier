import path from "node:path"

export const roles = ["candidate", "employer", "admin"] as const
export type TestRole = (typeof roles)[number]

export const PASSWORD = "e2e-mot-de-passe-1"

export const accounts: Record<TestRole, { name: string; email: string }> = {
  candidate: { name: "Camille Candidat", email: "candidat@e2e.test" },
  employer: { name: "Émile Employeur", email: "employeur@e2e.test" },
  admin: { name: "Alix Admin", email: "admin@e2e.test" },
}

export const homePaths: Record<TestRole, string> = {
  candidate: "/offres",
  employer: "/employeur",
  admin: "/admin",
}

export function storageStatePath(role: TestRole) {
  return path.join(import.meta.dirname, ".auth", `${role}.json`)
}
