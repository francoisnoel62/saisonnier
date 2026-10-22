import { CircleCheckIcon, FilePlusIcon, InboxIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { MembershipBanner } from "@/components/company/membership-banner"
import { ServiceRequestForm } from "@/components/services/service-request-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  purchaseFormatLabels,
  serviceCommitments,
  serviceKindDetails,
  serviceKinds,
  serviceRequestStatusLabels,
  serviceScopeLabels,
  type ServiceRequestStatus,
} from "@/domain/service-request"
import { requireRole } from "@/lib/dal"
import { formatDate } from "@/lib/format"
import { getMembership } from "@/server/companies/membership"
import { managerOf } from "@/server/offers/employer-offers"
import {
  listEmployerServiceRequests,
  listRequestableOffers,
  type EmployerServiceRequest,
} from "@/server/services/requests"

export const metadata: Metadata = { title: "Prestations" }

const statusVariant: Record<
  ServiceRequestStatus,
  "default" | "secondary" | "outline"
> = {
  new: "secondary",
  in_progress: "default",
  done: "outline",
  cancelled: "outline",
}

function RequestItem({ request }: { request: EmployerServiceRequest }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          Demande du {formatDate(request.createdAt)}
        </span>
        <Badge variant={statusVariant[request.status]}>
          {serviceRequestStatusLabels[request.status]}
        </Badge>
      </div>
      <p className="font-medium">
        {request.services
          .map((service) => serviceKindDetails[service].label)
          .join(" · ")}
      </p>
      <p className="text-sm text-muted-foreground">
        {request.scope === "offer" && request.offerTitle
          ? `${serviceScopeLabels.offer} : « ${request.offerTitle} »`
          : serviceScopeLabels[request.scope]}
        {request.scopeDetails && ` — ${request.scopeDetails}`} ·{" "}
        {purchaseFormatLabels[request.purchaseFormat]}
      </p>
    </li>
  )
}

// Prestations du service (§7, H15) : présentées avec leurs engagements, demandées par formulaire,
// traitées à la main. Aucune n'est nécessaire pour publier une annonce.
export default async function ServicesPage() {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)
  if (!membership) redirect("/employeur/entreprise")

  const { member } = membership
  const manager = managerOf(membership)
  const [offers, requests] = await Promise.all([
    listRequestableOffers(manager),
    listEmployerServiceRequests(manager),
  ])
  const canRequest = member.status !== "rejected"

  return (
    <div className="flex flex-col gap-8">
      <MembershipBanner status={member.status} reviewNote={member.reviewNote} />

      <section className="flex flex-col gap-4" aria-labelledby="prestations">
        <div className="flex flex-col gap-2">
          <h2 id="prestations" className="text-xl font-semibold tracking-tight">
            Être accompagné dans votre recrutement
          </h2>
          <p className="max-w-3xl text-muted-foreground">
            Publier une annonce est gratuit et ne demande aucune prestation. Si
            vous le souhaitez, le service peut aussi prendre en charge une
            partie du recrutement, sur devis.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {serviceKinds.map((kind) => (
            <li key={kind}>
              <Card className="h-full" size="sm">
                <CardHeader>
                  <CardTitle>
                    <h3>{serviceKindDetails[kind].label}</h3>
                  </CardTitle>
                  <CardDescription>
                    {serviceKindDetails[kind].description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="flex flex-col gap-3 rounded-lg border p-4"
        aria-labelledby="engagements"
      >
        <h2 id="engagements" className="text-lg font-semibold">
          Nos engagements
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {serviceCommitments.map((commitment) => (
            <li key={commitment} className="flex items-start gap-2">
              <CircleCheckIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              {commitment}
            </li>
          ))}
        </ul>
        <Button asChild variant="outline" className="self-start">
          <Link href="/employeur/annonces/nouvelle">
            <FilePlusIcon data-icon="inline-start" aria-hidden />
            Déposer une annonce, sans prestation
          </Link>
        </Button>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {canRequest && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Faire une demande</h2>
              </CardTitle>
              <CardDescription>
                Le fondateur vous répond par email avec une proposition.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceRequestForm offers={offers} />
            </CardContent>
          </Card>
        )}

        <section className="flex flex-col gap-3" aria-labelledby="mes-demandes">
          <h2 id="mes-demandes" className="text-lg font-semibold">
            Mes demandes
          </h2>
          {requests.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {requests.map((request) => (
                <RequestItem key={request.id} request={request} />
              ))}
            </ul>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InboxIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Aucune demande</EmptyTitle>
                <EmptyDescription>
                  Vos demandes de prestations et leur suivi apparaîtront ici.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </div>
  )
}
