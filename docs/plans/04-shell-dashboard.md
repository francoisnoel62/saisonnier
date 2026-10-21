# Plan 04 — Shell applicatif : dashboard-01 adapté par rôle

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 03 | 05, 06 | S | — (ergonomie demandée : dashboard avec menu latéral) |

## Objectif

Transformer le bloc `dashboard-01` en layout authentifié commun (sidebar + header), dont la navigation dépend du rôle.
Plus aucune donnée de démonstration ne doit rester.

## Étapes

1. **Layout** `src/app/(app)/layout.tsx`.
   - Appeler `requireUser()`.
   - Imbriquer `SidebarProvider` → `AppSidebar` → `SidebarInset` → `SiteHeader` + contenu.
   - `AppSidebar` reçoit `user` et `role`.
   - Garder les variables CSS du bloc (`--sidebar-width`, `--header-height`).
2. **Navigation** dans `src/config/navigation.ts` : titres en français, URL et icônes Tabler.

   | Rôle | Entrées |
   |---|---|
   | `candidate` | Rechercher des offres `/offres` · Mes offres `/mes-offres` · Mon dossier `/dossier` |
   | `employer` | Tableau de bord `/employeur` · Mes annonces `/employeur/annonces` · Déposer une annonce `/employeur/annonces/nouvelle` · Mon entreprise `/employeur/entreprise` · Prestations `/employeur/prestations` |
   | `admin` | Tableau de bord `/admin` · Vérifications `/admin/verifications` · Annonces `/admin/annonces` · Demandes & messages `/admin/demandes` · Référentiels `/admin/referentiels` · Voir le catalogue `/offres` |
   | tous (secondaire) | Mon compte `/compte` (le plan 06 ajoute Contact) |

3. **Composants du bloc.**
   - `app-sidebar.tsx` : nom provisoire (`site.name`), entrées selon le rôle, état actif via `usePathname`.
   - `nav-user.tsx` : nom et email réels ; menu « Mon compte » et « Se déconnecter » (`authClient.signOut`, puis redirection vers `/connexion`).
   - `site-header.tsx` : titre de page dérivé de la navigation, et `SidebarTrigger` sur mobile.
   - Supprimer `nav-documents.tsx`, le dossier `src/app/dashboard/` et `data.json`.
   - Déplacer `section-cards.tsx`, `chart-area-interactive.tsx` et `data-table.tsx` dans `src/components/dashboard/`. Ils servent de modèles aux plans 14 et 15 : cartes KPI, graphique, tableau TanStack v9.
4. **Gardes par espace.**
   - `src/app/(app)/employeur/layout.tsx` appelle `requireRole("employer")`.
   - `src/app/(app)/admin/layout.tsx` appelle `requireRole("admin")`.
   - Les pages candidat appellent `requireRole("candidate", "admin")`.
5. **Pages squelettes** pour chaque entrée de menu : un titre et le composant shadcn `Empty` « Bientôt disponible ». Les plans 08 à 17 les remplacent.
6. **`/compte`** : nom, email en lecture seule, changement de mot de passe (`authClient.changePassword`).
7. **Nettoyage.**
   - Retirer `/dashboard` de la liste des routes du proxy.
   - Ajouter dans `(app)` des fichiers `not-found.tsx` et `error.tsx` en français.
8. **Mobile.** Vérifier l'affichage à 375 px :
   - la sidebar devient un panneau `Sheet` ;
   - ni le header ni le contenu ne défilent horizontalement.

## Critères d'acceptation

- [ ] Chaque rôle ne voit que sa navigation, et l'accès direct à l'URL d'un autre espace est refusé côté serveur.
- [ ] `nav-user` affiche l'utilisateur connecté, et la déconnexion fonctionne.
- [ ] Il ne reste aucune donnée de démonstration du bloc, et l'affichage mobile est correct.

## Hors périmètre

- Contenu des pages (plans suivants).
- Thème sombre et notifications dans l'application.
