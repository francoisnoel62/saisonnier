import { SearchXIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { homePathFor } from "@/domain/roles"
import { getSession } from "@/lib/dal"

export default async function AppNotFound() {
  const session = await getSession()

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Page introuvable</EmptyTitle>
        <EmptyDescription>
          Cette page n&rsquo;existe pas ou a été déplacée.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href={session ? homePathFor(session.user.role) : "/"}>
            Retour à l&rsquo;accueil
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
