import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password"

// Messages français des codes d'erreur de Better Auth, côté serveur comme côté navigateur.
const messages: Record<string, string> = {
  INVALID_EMAIL: "Saisissez une adresse email valide.",
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  EMAIL_NOT_VERIFIED:
    "Votre adresse email n'est pas encore vérifiée. Ouvrez le lien reçu par email, ou demandez-en un nouveau.",
  PASSWORD_TOO_SHORT: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  PASSWORD_TOO_LONG: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
  INVALID_TOKEN: "Ce lien n'est plus valide. Demandez-en un nouveau.",
  TOKEN_EXPIRED: "Ce lien a expiré. Demandez-en un nouveau.",
}

export function authErrorMessage({
  code,
  status,
}: {
  code?: string
  status?: number
}) {
  if (status === 429) {
    return "Trop de tentatives. Patientez une minute avant de réessayer."
  }
  return (
    (code && messages[code]) ||
    "Une erreur est survenue. Réessayez dans quelques instants."
  )
}
