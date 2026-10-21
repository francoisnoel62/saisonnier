// Rattachement d'un employeur à son entreprise, vérifié par l'admin avant toute publication (H2).
export const membershipStatuses = ["pending", "verified", "rejected"] as const
export type MembershipStatus = (typeof membershipStatuses)[number]
