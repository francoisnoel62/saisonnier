import { triLabel, type TriState } from "@/domain/tri-state"
import { cn } from "@/lib/utils"

// « Oui », « Non » ou « Non précisé », ce dernier atténué. Une information inconnue est toujours
// affichée : jamais masquée, jamais convertie en « Non » (§3, §9).
export function InfoValue({
  value,
  className,
}: {
  value: TriState
  className?: string
}) {
  return (
    <span
      data-value={value}
      className={cn(value === "unknown" && "text-muted-foreground", className)}
    >
      {triLabel(value)}
    </span>
  )
}
