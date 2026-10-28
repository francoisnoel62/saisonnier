import { ExternalLinkIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function ExternalApplicationBadge() {
  return (
    <Badge className="border-0 bg-[var(--offer-glacier-bg)] text-[var(--offer-glacier)]">
      <ExternalLinkIcon aria-hidden />
      Candidature externe
    </Badge>
  )
}
export function ExternalApplicationNotice() {
  return (
    <div className="flex flex-col items-start gap-2">
      <ExternalApplicationBadge />
      <p className="text-sm text-muted-foreground">
        La candidature se fait sur le formulaire officiel de l&apos;employeur.
      </p>
    </div>
  )
}
