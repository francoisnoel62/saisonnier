import type { Metadata } from "next"
import {
  OfferContent,
  loadCandidateOffer,
} from "@/components/offers/offer-content"
import { publicCompanyName } from "@/domain/application"
import { offersReturnHref } from "@/domain/offer-view"

export async function generateMetadata({
  params,
}: PageProps<"/offres/[id]">): Promise<Metadata> {
  const offer = await loadCandidateOffer((await params).id)
  if (!offer?.publishedAt) return { title: "Offre introuvable" }
  return { title: `${offer.title} – ${publicCompanyName(offer)}` }
}

export default async function OfferPage({
  params,
  searchParams,
}: PageProps<"/offres/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <OfferContent id={id} returnHref={offersReturnHref(query.retour)} />
}
