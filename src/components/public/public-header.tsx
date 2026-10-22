"use client"

import { ArrowUpRightIcon, MenuIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Brand } from "@/components/public/brand"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { homePathFor, type Role } from "@/domain/roles"
import styles from "./public.module.css"

const navigation = [
  { href: "/#recherche", label: "Trouver ma saison" },
  { href: "/#destinations", label: "Les destinations" },
  { href: "/#notre-conviction", label: "Notre état d’esprit" },
]

export function PublicHeader({ role }: { role?: Role }) {
  const [open, setOpen] = useState(false)
  return (
    <header className={styles.header}>
      <a className={styles.skipLink} href="#contenu">
        Aller au contenu
      </a>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="Accueil" className={styles.brandLink}>
          <Brand />
        </Link>
        <nav className={styles.desktopNav} aria-label="Navigation principale">
          {navigation.map(({ href, label }) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          {role ? (
            <Button asChild className={styles.buttonSmall}>
              <Link href={homePathFor(role)}>
                Accéder à mon espace <ArrowUpRightIcon aria-hidden />
              </Link>
            </Button>
          ) : (
            <>
              <Link className={styles.loginLink} href="/connexion">
                Se connecter
              </Link>
              <Button asChild className={styles.buttonSmall}>
                <Link href="/inscription/employeur">
                  Vous recrutez ? <ArrowUpRightIcon aria-hidden />
                </Link>
              </Button>
            </>
          )}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className={styles.menuButton} aria-label="Ouvrir le menu">
              <MenuIcon aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent className={styles.mobileMenu} showCloseButton={false}>
            <SheetTitle>
              <Brand />
            </SheetTitle>
            <SheetDescription>
              Votre prochaine saison commence ici.
            </SheetDescription>
            <SheetClose
              className={styles.menuClose}
              aria-label="Fermer le menu"
            >
              <XIcon aria-hidden />
            </SheetClose>
            <nav aria-label="Navigation mobile" onClick={() => setOpen(false)}>
              {navigation.map(({ href, label }) => (
                <Link key={href} href={href}>
                  {label}
                  <ArrowUpRightIcon aria-hidden />
                </Link>
              ))}
              {role ? (
                <Link href={homePathFor(role)}>
                  Accéder à mon espace <ArrowUpRightIcon aria-hidden />
                </Link>
              ) : (
                <>
                  <Link href="/connexion">
                    Se connecter <ArrowUpRightIcon aria-hidden />
                  </Link>
                  <Link href="/inscription/candidat">
                    Créer un compte <ArrowUpRightIcon aria-hidden />
                  </Link>
                  <Link href="/inscription/employeur">
                    Vous recrutez ? <ArrowUpRightIcon aria-hidden />
                  </Link>
                </>
              )}
            </nav>
            <p className={styles.mobileMenuNote}>
              0 % IA. 100 % humain.
              <br />
              Et une vraie envie de vous rencontrer.
            </p>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
