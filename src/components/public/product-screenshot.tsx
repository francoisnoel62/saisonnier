"use client"

import { ExpandIcon, XIcon } from "lucide-react"
import Image, { type StaticImageData } from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import styles from "./landing.module.css"

export function ProductScreenshot({
  src,
  title,
  tone = "sage",
  eager = false,
}: {
  src: StaticImageData
  title: string
  tone?: "sage" | "peach"
  eager?: boolean
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={styles.screenshot}
          data-tone={tone}
          aria-label={`Agrandir l’aperçu : ${title}`}
        >
          <span className={styles.browserFrame}>
            <span className={styles.browserBar} aria-hidden="true">
              <span className={styles.browserDots}>
                <i />
                <i />
                <i />
              </span>
              <span>ma-saison.fr</span>
              <span />
            </span>
            <Image
              src={src}
              alt={title}
              sizes="(max-width: 700px) 95vw, 600px"
              loading={eager ? "eager" : "lazy"}
              className={styles.screenImage}
            />
          </span>
          <span className={styles.expandLabel}>
            <ExpandIcon aria-hidden /> Explorer l’aperçu
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[92svh] overflow-auto p-4 sm:max-w-[1200px] sm:p-6"
        showCloseButton={false}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="mt-1">
              Capture réelle de l’application · données de démonstration.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Fermer l’aperçu">
              <XIcon aria-hidden />
            </Button>
          </DialogClose>
        </div>
        <Image
          src={src}
          alt={title}
          sizes="95vw"
          className="h-auto w-full rounded-lg border"
        />
      </DialogContent>
    </Dialog>
  )
}
