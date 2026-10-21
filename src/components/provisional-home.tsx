import { SignOutButton } from "@/components/auth/sign-out-button"
import type { Role } from "@/domain/roles"

const roleLabels: Record<Role, string> = {
  candidate: "candidat",
  employer: "employeur",
  admin: "administrateur",
}

// Accueil provisoire d'un espace protégé, remplacé par le shell applicatif (plan 04).
export function ProvisionalHome({
  title,
  user,
}: {
  title: string
  user: { name: string; email: string; role: Role }
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-muted-foreground">
        Connecté en tant que {user.name} ({user.email}), compte{" "}
        {roleLabels[user.role]}. Cet espace arrive bientôt.
      </p>
      <SignOutButton />
    </main>
  )
}
