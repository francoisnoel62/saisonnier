import type { Metadata } from "next"

import {
  ContactMessagesTable,
  type ContactMessageRow,
} from "@/components/admin/contact-messages-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listContactMessages } from "@/server/contact/messages"

export const metadata: Metadata = { title: "Demandes & messages" }

export default async function RequestsPage() {
  const messages = await listContactMessages()
  const rows: ContactMessageRow[] = messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
    handledAt: message.handledAt?.toISOString() ?? null,
  }))

  // L'onglet « Prestations » arrive au plan 17.
  return (
    <Tabs defaultValue="messages" className="gap-4">
      <TabsList>
        <TabsTrigger value="messages">Messages</TabsTrigger>
      </TabsList>
      <TabsContent value="messages">
        <ContactMessagesTable messages={rows} />
      </TabsContent>
    </Tabs>
  )
}
