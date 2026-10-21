// Un compte = un rôle (H1) : candidat ou employeur à l'inscription, admin par script.
export const roles = ["candidate", "employer", "admin"] as const

export type Role = (typeof roles)[number]

export function isRole(value: unknown): value is Role {
  return roles.includes(value as Role)
}

const homePaths: Record<Role, string> = {
  candidate: "/offres",
  employer: "/employeur",
  admin: "/admin",
}

// Accueil de chaque rôle : cible après connexion et repli d'un accès refusé.
export function homePathFor(role: Role) {
  return homePaths[role]
}
