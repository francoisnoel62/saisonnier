"use client"

import {
  Columns2Icon,
  LayoutGridIcon,
  ListIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useRef, useSyncExternalStore, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { type OfferView } from "@/domain/offer-view"
import styles from "./offers.module.css"

const modes = [
  { value: "escales", label: "Escales", Icon: LayoutGridIcon },
  { value: "comparateur", label: "Comparateur", Icon: ListIcon },
  { value: "immersion", label: "Immersion", Icon: Columns2Icon },
] as const

export function OfferViewSelector({ view }: { view: OfferView }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  function choose(value: OfferView) {
    const next = new URLSearchParams(params.toString())
    next.delete("offre")
    if (value === "escales") next.delete("vue")
    else next.set("vue", value)
    startTransition(() =>
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
        scroll: false,
      }),
    )
  }
  return (
    <div
      className={styles.views}
      role="group"
      aria-label="Affichage des offres"
      aria-busy={pending}
    >
      {modes.map(({ value, label, Icon }) => (
        <Button
          key={value}
          variant={view === value ? "default" : "ghost"}
          aria-pressed={view === value}
          disabled={pending}
          onClick={() => choose(value)}
        >
          <Icon aria-hidden />
          <span>{label}</span>
        </Button>
      ))}
      {pending && (
        <span role="status" className="flex items-center px-2">
          <Loader2Icon
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          <span className="sr-only">Changement d’affichage</span>
        </span>
      )}
    </div>
  )
}

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 1023px)")
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}
const mobileSnapshot = () => window.matchMedia("(max-width: 1023px)").matches

// La fiche est rendue sur le serveur avec les mêmes contrôles que /offres/[id].
// Aucun détail de candidature n'est chargé par un fetch client ou dupliqué dans la liste.
export function OfferResultsLayout({
  view,
  list,
  detail,
  selectedId,
  detailId,
}: {
  view: OfferView
  list: React.ReactNode
  detail?: React.ReactNode
  selectedId?: string
  detailId?: string
}) {
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    () => false,
  )
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const opener = useRef<HTMLAnchorElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  function close() {
    // Mémoriser la carte avant que l’URL ne rétablisse la sélection par défaut.
    opener.current ??=
      listRef.current?.querySelector<HTMLAnchorElement>(
        'a[aria-current="true"]',
      ) ?? null
    const next = new URLSearchParams(params.toString())
    next.delete("offre")
    router.replace(`${pathname}?${next}`, { scroll: false })
  }
  if (view !== "immersion") return list
  return (
    <div className={styles.immersion}>
      <div
        ref={listRef}
        onClickCapture={(event) => {
          if (event.target instanceof Element)
            opener.current = event.target.closest("a")
        }}
      >
        {list}
      </div>
      {!mobile && (
        <section
          key={detailId}
          className={styles.immersivePane}
          aria-label="Détail de l’offre sélectionnée"
        >
          {detail}
        </section>
      )}
      {mobile && (
        <Sheet
          open={!!selectedId}
          onOpenChange={(open) => {
            if (!open) close()
          }}
        >
          <SheetContent
            className={styles.mobileSheet}
            showCloseButton={false}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              ;(
                opener.current ??
                listRef.current?.querySelector<HTMLAnchorElement>(
                  'a[aria-current="true"]',
                )
              )?.focus()
            }}
          >
            <SheetHeader className="flex-row items-center justify-between border-b">
              <div>
                <SheetTitle>Détail de l’offre</SheetTitle>
                <SheetDescription>
                  Le poste, la saison et les conditions de vie.
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Fermer la fiche"
                >
                  <XIcon aria-hidden />
                </Button>
              </SheetClose>
            </SheetHeader>
            <div key={detailId} className="p-4">
              {detail}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
