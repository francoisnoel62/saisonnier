import Link from "next/link"

import { Button } from "@/components/ui/button"
import { OccupationSuggestions } from "@/components/admin/scan/occupation-suggestions"
import { getOfferFormReferentials } from "@/server/offers/employer-offers"
import { listOccupationFamilies } from "@/server/referentials/admin"
import { listOccupationSuggestions } from "@/server/scan/occupations"

export default async function ScanSuggestionsPage() {
  const [reviews, referentials, families] = await Promise.all([
    listOccupationSuggestions(),
    getOfferFormReferentials(),
    listOccupationFamilies(),
  ])
  const suggestions = reviews.map((review) => ({
    id: review.id,
    title:
      typeof review.details.title === "string"
        ? review.details.title
        : "Métier à rattacher",
    context:
      typeof review.details.context === "string" ? review.details.context : "",
    occurrences: review.occurrences,
    candidates: review.candidates,
  }))
  return (
    <div className="grid gap-6">
      <Button
        asChild
        variant="ghost"
        className="h-auto min-h-11 w-fit max-w-full text-left whitespace-normal"
      >
        <Link href="/admin/scan/dossiers">← Retour à la file</Link>
      </Button>
      <h2 className="text-xl font-semibold">Suggestions de métiers</h2>
      <p className="text-sm text-muted-foreground">
        Une décision vaut pour les prochaines occurrences du même intitulé. Elle
        ne modifie pas la validation humaine d’une annonce.
      </p>
      <OccupationSuggestions
        suggestions={suggestions}
        occupations={referentials.occupations}
        families={families}
      />
    </div>
  )
}
