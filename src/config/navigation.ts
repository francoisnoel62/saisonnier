import {
  BuildingIcon,
  ClipboardListIcon,
  FilePlusIcon,
  FolderOpenIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  type LucideIcon,
  MegaphoneIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TableIcon,
  UserRoundIcon,
} from "lucide-react"

import { type Role } from "@/domain/roles"

export type NavItem = { title: string; url: string; icon: LucideIcon }

// Navigation principale de chaque rôle ; les pages correspondantes sont gardées par leur layout.
export const navigation: Record<Role, NavItem[]> = {
  candidate: [
    { title: "Rechercher des offres", url: "/offres", icon: SearchIcon },
    { title: "Mes offres", url: "/mes-offres", icon: ListChecksIcon },
    { title: "Mon dossier", url: "/dossier", icon: FolderOpenIcon },
  ],
  employer: [
    {
      title: "Tableau de bord",
      url: "/employeur",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Mes annonces",
      url: "/employeur/annonces",
      icon: MegaphoneIcon,
    },
    {
      title: "Déposer une annonce",
      url: "/employeur/annonces/nouvelle",
      icon: FilePlusIcon,
    },
    {
      title: "Mon entreprise",
      url: "/employeur/entreprise",
      icon: BuildingIcon,
    },
    {
      title: "Prestations",
      url: "/employeur/prestations",
      icon: SparklesIcon,
    },
  ],
  admin: [
    { title: "Tableau de bord", url: "/admin", icon: LayoutDashboardIcon },
    {
      title: "Vérifications",
      url: "/admin/verifications",
      icon: ShieldCheckIcon,
    },
    { title: "Annonces", url: "/admin/annonces", icon: ClipboardListIcon },
    { title: "Demandes & messages", url: "/admin/demandes", icon: InboxIcon },
    { title: "Référentiels", url: "/admin/referentiels", icon: TableIcon },
    { title: "Voir le catalogue", url: "/offres", icon: SearchIcon },
  ],
}

// Entrées communes à tous les rôles, en bas de la barre latérale (le plan 06 y ajoute Contact).
export const secondaryNavigation: NavItem[] = [
  { title: "Mon compte", url: "/compte", icon: UserRoundIcon },
]

// L'entrée la plus spécifique dont l'URL est celle de la page ou l'un de ses parents :
// « /employeur » ne reste pas actif sur « /employeur/annonces ».
export function activeNavItem(items: NavItem[], pathname: string) {
  let active: NavItem | undefined
  for (const item of items) {
    const matches = pathname === item.url || pathname.startsWith(`${item.url}/`)
    if (matches && (!active || item.url.length > active.url.length)) {
      active = item
    }
  }
  return active
}

// Titre affiché dans l'en-tête, déduit de la navigation du rôle.
export function pageTitleFor(role: Role, pathname: string) {
  return activeNavItem([...navigation[role], ...secondaryNavigation], pathname)
    ?.title
}
