import { triLabel, type TriState } from "@/domain/tri-state"
import { CircleHelpIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// « Oui », « Non » ou « Non précisé », ce dernier atténué. Une information inconnue est toujours
// affichée : jamais masquée, jamais convertie en « Non » (§3, §9).
export function InfoValue({
  value,
  className,
  toConfirm = false,
}: {
  value: TriState
  className?: string
  toConfirm?: boolean
}) {
  return (
    <span
      data-value={value}
      className={cn(value === "unknown" && "text-muted-foreground", className)}
    >
      {toConfirm && value === "unknown" ? (
        <span className="inline-flex items-center gap-1">
          <CircleHelpIcon className="size-3.5" aria-hidden />À confirmer
        </span>
      ) : (
        triLabel(value)
      )}
    </span>
  )
}
