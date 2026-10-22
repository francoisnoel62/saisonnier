import type { Metadata } from "next"

import {
  ContactMessagesTable,
  type ContactMessageRow,
} from "@/components/admin/contact-messages-table"
import {
  ServiceRequestsTable,
  type ServiceRequestRow,
} from "@/components/admin/service-requests-table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listContactMessages } from "@/server/contact/messages"
import { listServiceRequestsForAdmin } from "@/server/services/requests"

export const metadata: Metadata = { title: "Demandes & messages" }

const tabs = ["messages", "prestations"] as const

// Nombre d'éléments à traiter, à côté du nom de l'onglet.
function Pending({ count, label }: { count: number; label: string }) {
  if (count === 0) return null
  return (
    <Badge variant="secondary" className="ml-1">
      {count}
      <span className="sr-only"> {label}</span>
    </Badge>
  )
}

export default async function RequestsPage({
  searchParams,
}: PageProps<"/admin/demandes">) {
  const { onglet } = await searchParams
  const tab = tabs.find((value) => value === onglet) ?? "messages"

  const [messages, requests] = await Promise.all([
    listContactMessages(),
    listServiceRequestsForAdmin(),
  ])
  const messageRows: ContactMessageRow[] = messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
    handledAt: message.handledAt?.toISOString() ?? null,
  }))
  const requestRows: ServiceRequestRow[] = requests.map((request) => ({
    id: request.id,
    createdAt: request.createdAt.toISOString(),
    status: request.status,
    companyName: request.companyDisplayName ?? request.companyLegalName,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail,
    services: request.services,
    scope: request.scope,
    scopeDetails: request.scopeDetails,
    purchaseFormat: request.purchaseFormat,
    message: request.message,
    adminNote: request.adminNote,
    offerId: request.offerId,
    offerTitle: request.offerTitle,
    offerChannel: request.offerApplicationChannel,
    offerHidesCompany: request.offerHidesCompany,
  }))

  return (
    <Tabs defaultValue={tab} className="gap-4">
      <TabsList>
        <TabsTrigger value="messages">
          Messages
          <Pending
            count={
              messages.filter((message) => message.status === "new").length
            }
            label="non traités"
          />
        </TabsTrigger>
        <TabsTrigger value="prestations">
          Prestations
          <Pending
            count={
              requests.filter((request) => request.status === "new").length
            }
            label="nouvelles"
          />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="messages">
        <ContactMessagesTable messages={messageRows} />
      </TabsContent>
      <TabsContent value="prestations">
        <ServiceRequestsTable rows={requestRows} />
      </TabsContent>
    </Tabs>
  )
}
