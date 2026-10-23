@AGENTS.md

# Saisonnier — job-board saisonnier V1

## Projet

- Besoin : [cahier des charges](docs/cahier-des-charges-job-board-saisonnier-v1.md).
- Réalisation : [plans, hypothèses H1–H20 et glossaire](docs/plans/README.md). Une branche par plan (`plan/NN-slug`), une PR, une preview Vercel vérifiée avant le merge.
- Déploiement : projet Vercel `saisonnier` (équipe `francois-noels-projects`), production sur `main`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` (types des routes) puis `tsc --noEmit` |
| `npm test` | tests unitaires Vitest (`src/**/*.test.ts`) |
| `npm run test:int` | tests d'intégration (`src/**/*.int.test.ts`) sur `saisonnier_test`, migrations appliquées au démarrage ; `server-only` y est neutralisé (`vitest.config.ts`) |
| `npm run format` | Prettier (+ tri des classes Tailwind) |
| `npm run db:up` / `db:down` | Postgres 18 local (Docker) : bases `saisonnier` et `saisonnier_test` |
| `npm run db:generate` | migration SQL depuis `src/lib/db/schema` (`--custom` pour une migration de données) |
| `npm run db:migrate` / `db:check` / `db:studio` | appliquer, vérifier, explorer |
| `npm run admin:grant -- <email>` | passer en `admin` un compte existant et vérifié (autre base : préfixer `DATABASE_URL=…`) |
| `npm run db:seed:demo` | jeu de démonstration dans la base de développement : 8 entreprises fictives et 40 offres datées par rapport à aujourd'hui ; relancer le remet à l'état initial ; refusé si `VERCEL_ENV=production` |
| `npm run e2e` / `e2e:ui` | tests Playwright (`e2e/*.spec.ts`), projets `chromium` et `mobile` (Pixel 7), sur `saisonnier_test` |

- L'E2E lance son propre `next dev -p 3100` (dossier `.next-e2e`) : il tourne en même temps que `npm run dev`.
- Il vide la base de test à chaque exécution, référentiels exceptés : tout nouveau référentiel s'ajoute à `REFERENCE_TABLES` (`e2e/helpers/db.ts`). Il refuse toute base dont le nom ne finit pas par `_test`. Un test qui ajoute un métier ou un domaine exclu le supprime lui-même (`finally`).
- `seedDemoCatalog(db)` (`e2e/helpers/catalog.ts`) remplace toutes les offres par le jeu de démonstration et calcule les compteurs attendus avec l'oracle `matchesCriteria`.
- `newCandidate(label)` crée un candidat connecté, sans dossier, propre au test ; `completeDossier(page, label)` (`e2e/helpers/dossier.ts`) lui ajoute téléphone et CV. `newEmployer(label)` crée un employeur sans entreprise ; `insertMembership(db, email, status)` le rattache à sa propre entreprise ; le compte partagé `asEmployer` est rattaché à une entreprise vérifiée (`e2e/helpers/company.ts`). Les comptes partagés (`asCandidate`…) ne doivent pas être modifiés.
- Dépôt d'annonce (`e2e/helpers/offer-form.ts`) : `openNewOfferForm`, `fillMinimalOffer`, `offerAction(page, intitulé, action)`. `stubCommuneSearch(page)` sert la recherche de communes (geo.api.gouv.fr) : l'E2E ne dépend pas du réseau.
- Route cron : `request.get("/api/cron/quotidien", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })` ; elle traite toute la base de test. `CRON_SECRET` et `VALIDITY_TOKEN_SECRET` viennent de `.env.test.local` (CI : générés à chaque exécution).
- Emails : le serveur de test en dépose une copie dans `.e2e-outbox/` (`EMAIL_OUTBOX_DIR`) ; `expectEmail(to, subject)` (`e2e/helpers/outbox.ts`) attend et renvoie le dernier reçu.
- Chaque plan ajoute son `e2e/<sujet>.spec.ts` ; chaque test porte le nom du point de contrôle qu'il couvre (ex. `§9 — CV privé`). Fixtures `asCandidate`, `asEmployer`, `asAdmin` et `db` dans `e2e/fixtures.ts`.
- La CI (`.github/workflows/ci.yml`) enchaîne lint, typecheck, tests, intégration et E2E.

## Base de données

- Drizzle ORM 0.45 (rester sur la branche stable), `casing: "snake_case"` : propriétés en camelCase, colonnes en snake_case.
- Client unique : `db` de `src/lib/db`. Variables serveur validées par `src/lib/env.ts` ; toute nouvelle variable y est déclarée et ajoutée à `.env.example`.
- Local : `.env.development.local` et `.env.test.local` (non versionnés). Vercel : Neon (Postgres 18) injecte `DATABASE_URL` (poolée) et `DATABASE_URL_UNPOOLED` (migrations).
- Les migrations versionnées dans `drizzle/` s'appliquent au build Vercel (`vercel.json`) ; chaque preview migre sa branche Neon.
- Les référentiels (régions, départements, métiers, domaines exclus) sont insérés par migration SQL en `ON CONFLICT DO NOTHING`, jamais par un script manuel.
- Entreprises et offres : `src/lib/db/schema/companies.ts` et `offers.ts`. Les valeurs des enums sont définies une seule fois, dans `src/domain/` (`offer.ts`, `tri-state.ts`, `salary.ts`, `membership.ts`).
- Les invariants des offres sont des contraintes `CHECK`, commentées dans le schéma. Les schémas zod des formulaires les reprennent toutes, pour qu'aucune erreur SQL n'atteigne l'utilisateur. En particulier :
  - un texte absent s'écrit `NULL`, jamais `''` ;
  - `languages` (codes ISO 639-1) n'est rempli que si `languagesRequired = 'yes'`, et l'est alors toujours ;
  - une offre `published` a un `publishedAt` ; une offre collectée a `sourceUrl` et `sourceCheckedAt` ;
  - une date de début peut accompagner une durée sans date de fin.
- Toute lecture d'offres côté candidat filtre par `activeOfferConditions(today)` (`src/server/offers/queries.ts`), avec `today = todayInParis(new Date())` : c'est la règle `isActive` en SQL.
- Dossier candidat : table `candidate_profiles` (`src/server/candidates/dossier.ts`), complétude `dossierStatus` (H3, `src/domain/candidate-dossier.ts`). Documents dans un stockage privé (`src/server/storage/documents.ts`) : Vercel Blob `saisonnier-documents` (fra1), ou disque `.storage/` avec `STORAGE_DRIVER=local` (E2E). Seul le chemin est en base ; seul le propriétaire télécharge (`/api/dossier/documents/[type]`), ni l'admin ni un employeur (H11).
- Recherche : `searchOffers(criteria, { page, pageSize, today })` (`src/server/search/`), critères validés par `searchCriteriaSchema` (`src/domain/search-criteria.ts`). Toute règle de correspondance s'écrit deux fois, dans `matchesCriteria` (`src/domain/offer-matching.ts`, l'oracle) et dans `build-conditions.ts` : le test d'intégration exige qu'elles retiennent les mêmes offres du jeu de démonstration.
- Suivi candidat : table `offer_tracking` (`savedAt`, `appliedAt`, une ligne vide est supprimée), écritures idempotentes `setMark` (`src/server/candidates/tracking.ts`) derrière `toggleSaved` / `declareApplied` / `undoApplied`. Rien d'autre (§5) : ni statut, ni note, ni rappel ; un clic sur un contact n'est jamais une candidature.
- Entreprise et rattachement (H2) : `companies` (SIREN unique) et `company_members` (un compte = une entreprise, `status` `pending` / `verified` / `rejected`), dans `src/server/companies/membership.ts`. `/employeur` renvoie vers l'onboarding `/employeur/entreprise` tant qu'aucun rattachement n'existe ; un SIREN déjà connu rattache à l'entreprise existante sans la modifier. `decideMembership` applique la décision de l'admin (`/admin/verifications`) et publie ou refuse les annonces `pending_review` du déposant dans la même transaction. Règles : `canPublishDirectly`, `emailMatchesWebsite`, `isValidSiren` (`src/domain/membership.ts`).
- API Recherche d'entreprises : `searchCompanyDirectory` (`src/server/companies/directory.ts`), côté serveur, 5 s au plus ; `{ ok: false }` laisse place à la saisie manuelle. Elle ne donne que le code NAF : les libellés viennent de `tourismNafLabels` (`src/domain/naf.ts`), limité au tourisme et aux loisirs (§2), qui signale aussi le secteur à l'admin.
- Dépôt employeur (plan 14) : un seul schéma, `offerInputSchema(context)` (`src/domain/offer-input.ts`), pour le formulaire (react-hook-form, `zodResolver` en mode `raw`) et les Server Actions (`src/server/offers/employer-actions.ts`), qui le réappliquent avec les domaines exclus, métiers et départements lus en base (`getOfferFormReferentials`). Le formulaire manipule des textes : montants en euros (`eurosToCents`), réponse vide → `unknown`, texte vide → `NULL`. Une règle qui lie plusieurs champs va dans `checkOfferInput` et lit les textes saisis (elle s'exécute même si un champ est invalide).
- Annonces de l'employeur : écritures dans `src/server/offers/employer-offers.ts`, en transaction avec le rattachement verrouillé (`for share`) pour qu'une décision de l'admin ne s'intercale pas. Droits et états : `canViewOffer`, `canEditOffer`, `canUnpublishOffer`, `republishRefusal`, `employerOfferState` (`src/domain/employer-offer.ts`, H17, H18). Une annonce collectée n'y apparaît jamais.
- Back-office (plan 15, H19) : toute annonce collectée s'enregistre par `upsertCollectedOffer(input, actor)` (`src/server/offers/ingest.ts`), que le futur scan appellera : déduplication par `sourceUrl` (index unique partiel), minimum de publication et domaines exclus vérifiés sur la source et les destinations, refus motivé (`missing`, `blocked`). Annonces déposées saisies ou corrigées par l'admin, et statuts : `src/server/offers/admin-offers.ts` ; Server Actions dans `admin-actions.ts`. Fiches entreprise sans compte : `src/server/companies/companies.ts`.
- `OfferForm` a deux espaces : `space="employer"` (`offerInputSchema`) et `space="admin"` (`adminOfferInputSchema` : origine, entreprise, source, canal `recruiter`, anonymat). Les champs de l'admin s'ajoutent à ceux de l'employeur (`AdminOfferFormValues`).
- Référentiels de l'admin (`/admin/referentiels`) : métiers et domaines exclus, `src/server/referentials/`. Le `slug` d'un métier ne change jamais (liens de recherche) ; désactivé, le métier disparaît des formulaires et des filtres, pas des annonces. Un message de contact lié à une annonce mène à son édition admin.
- Cycle de vie (plan 16) : `GET /api/cron/quotidien` (Vercel Cron, `vercel.json`, 3 h UTC, `Authorization: Bearer ${CRON_SECRET}`) exécute `expireOffers(today)` puis `sendValidityReminders(now)` (`src/server/jobs/`). Règles `isReminderDue` et `awaitsValidityAnswer` (`src/domain/validity-reminder.ts`) : une annonce déposée et publiée reçoit un rappel 30 jours après sa publication, sa dernière confirmation ou son dernier rappel ; sans réponse, elle reste en ligne. Le lien `/annonce/confirmer/<jeton>` (HMAC-SHA256, `src/lib/signed-token.ts`, 30 jours) répond sans session et en POST seulement ; l'espace employeur pose la même question (« Toujours valable ? »). Tâches planifiées : registre `scheduledJobDefinitions` (`src/domain/scheduled-job.ts`), table `scheduled_jobs` (une ligne par tâche, active sans ligne), carte « Tâches planifiées » sur `/admin` pour les activer ou les désactiver. Une route de cron vérifie le secret puis exécute sa tâche par `runScheduledJob(name, run)` (`src/server/jobs/run.ts`), qui ne fait rien si elle est désactivée (`{ skipped: "disabled" }`) et enregistre le passage. Nouveau cron : une entrée du registre, une ligne de `vercel.json`, une route. Un test qui désactive une tâche la réactive (`finally`).
- Tableau de bord admin : `getAdminIndicators` et `getDailyActivity` (`src/server/admin/dashboard.ts`), séries par jour à Paris (`src/domain/daily-series.ts`) affichées par `ChartAreaInteractive({ data })`.
- Communes : `CommuneField` interroge geo.api.gouv.fr depuis le navigateur et ne garde que les réponses bien formées d'un département connu ; si le service ne répond pas, la commune se saisit à la main avec son département (sans code INSEE).
- Fiche `/offres/[id]` : `OfferDetails` (`src/components/offers/offer-details.tsx`) est purement présentationnel et ne reçoit que `toOfferDetailsData(offer)`, sans contact ni entreprise. Les coordonnées viennent de `getApplicationDetails` (`src/server/offers/application.ts`) : dossier complet ou admin seulement, domaines exclus masqués et journalisés. Un composant client ne reçoit jamais l'offre entière (anonymat).
- Page `/offres` : l'URL est la seule source de vérité. Parseurs nuqs et clés françaises (`metier`, `dept`, `base`…) dans `src/server/search/search-params.ts`, partagés par la page (`loadSearch`) et les filtres (`useSearch()`, `src/components/search/search-provider.tsx`) ; ce module n'accède pas à la base. Un nouveau critère s'ajoute au schéma, aux parseurs, à `activeCriteriaChips` (`src/domain/search-chips.ts`) et aux contrôles.

## Sources du scan (plan scan 01)

- `/admin/scan` est réservé aux admins : registre des sources et sonde depuis le déploiement (`probeScanSourceAction`, rôle vérifié dans l'action). Diagnostic temporaire en `Sheet`, journal `[scan sonde]`, aucune écriture en base.
- Client réseau `src/server/scan/http.ts` : `createScanHttpClient()` par étape partage robots.txt entre ses lectures ; `scanFetch(url)` pour une lecture isolée. DNS intégralement contrôlé puis épinglé, HTTPS, redirections revalidées, robots respecté, 15 s et 2 Mo après décompression. `HostPacer` sérialise les lectures par hôte (2 s ou Crawl-delay) et respecte Retry-After.
- Registre en code `scanSourceDefinitions` (`src/server/scan/sources/registry.ts`), schéma et validation dans `src/domain/scan/source.ts`, réglages globaux `limits.ts`. Le dossier `docs/scan/sources-v1.md` porte provenance, conditions, échantillon et décisions humaines ; lire ses limites avant activation.
- France Travail est la découverte prioritaire choisie par le fondateur (SH17). `kind="discovery"` interdit d'affecter le diffuseur comme employeur (`employer` / `employerWebsite` nuls). Recherche et pagination bornée dans `src/domain/scan/france-travail.ts` ; la sonde conserve la fiche publique et lit le JSON public du composant officiel sur le même hôte. Aucun rendu JavaScript, aucune API partenaire authentifiée. La publication reste soumise à la source officielle employeur.
- `SCAN_TEST_SOURCE_URL=http://localhost:<port>` autorise cette seule origine locale en développement/test ; `env.ts` refuse toute définition en `NODE_ENV=production` (preview incluse). Playwright lance le serveur de fixtures `scripts/scan-fixture-server.ts` sur `E2E_PORT + 1` et lui seul fournit les tests de sonde.
- Fixtures réelles anonymisées dans `src/server/scan/sources/fixtures/`, avec provenance par source, exclues de Prettier. Les tests ne lisent jamais les sources réelles.

## Authentification

- Better Auth 1.7 (`src/lib/auth.ts`), email + mot de passe, vérification d'email obligatoire. Rôles `candidate` / `employer` / `admin` sur `user.role` (`input: false` : jamais fourni par le client ; contrainte CHECK en base).
- Tables dans `src/lib/db/schema/auth.ts` : régénérées par `npx auth@latest generate`, puis réalignées sur le projet (`casing`, `timestamptz`). Ne pas renommer tables ni propriétés.
- Pages : `getSession` / `requireUser` / `requireRole` de `src/lib/dal.ts`. Accueil de chaque rôle : `homePathFor` (`src/domain/roles.ts`).
- La limitation de débit de Better Auth ne s'applique qu'aux requêtes vers `/api/auth` : connexion, renvois de liens et mots de passe passent par `authClient`. Une Server Action (`auth.api.*`) n'est utilisée que si le serveur doit décider (ex. rôle employeur à l'inscription).
- Sans `RESEND_API_KEY`, les emails s'affichent dans la console du serveur, liens compris.
- Routes d'API : `authorizeRoute(...roles)` (`src/lib/dal.ts`) répond 401 ou 403 au lieu de rediriger.

## Conventions

- Interface, contenus et URL en français ; code, tables et colonnes en anglais, selon le glossaire du README des plans.
- Spécificités de Next 16 (lire `node_modules/next/dist/docs/` en cas de doute) :
  - le proxy vit dans `src/proxy.ts` (il n'y a plus de `middleware.ts`) ;
  - `params`, `searchParams`, `cookies()` et `headers()` sont asynchrones ;
  - pas de `cacheComponents` en V1 : tout est authentifié et dynamique ;
  - appeler `revalidatePath` après chaque mutation.
- shadcn/ui (base Radix, preset Nova, icônes `lucide-react`) :
  - les composants s'ajoutent par la CLI (`npx shadcn@latest add …`) ; ne jamais réécrire `src/components/ui` à la main ;
  - `cn()` vient du package `cn` (réexporté par `src/lib/utils.ts`).
- Tableaux en **TanStack Table v9** : suivre le modèle de `src/components/dashboard/data-table.tsx` (`useTable`, `tableFeatures`, `createSortedRowModel`…). Ne pas utiliser l'API v8 `useReactTable`. `row.getVisibleCells()` exige `columnVisibilityFeature`.
- Formulaire à cases à cocher ou listes Radix : l'envoyer par `onSubmit` + `startTransition(() => formAction(formData))`, pas par `<form action>`, que React 19 réinitialise après chaque envoi (les choix seraient perdus après une erreur).
- Un panneau (`Sheet`) ouvert depuis un menu : `DropdownMenu modal={false}`, et `onCloseAutoFocus` rend le focus au bouton du menu (`employer-offers-table.tsx`). Indicateurs de tableau de bord : `SectionCards({ cards })` (`src/components/dashboard/section-cards.tsx`).
- Répartition du code :
  - règles métier pures dans `src/domain/`, sans accès réseau ni base, et testées ;
  - accès aux données dans `src/server/<module>/` ;
  - chaque Server Action et chaque route vérifie la session et le rôle via `src/lib/dal.ts`. Le proxy ne fait que des redirections optimistes.
- Shell authentifié :
  - le layout `src/app/(app)/layout.tsx` pose la sidebar ; sa navigation vient de `src/config/navigation.ts`, par rôle. Une nouvelle page de menu s'y déclare, avec son titre d'en-tête ;
  - les layouts `employeur/` et `admin/` appellent `requireRole` ; les pages candidat l'appellent elles-mêmes ;
  - `error.tsx` reçoit `retry` (Next 16.3+), plus `reset`.
- Pages publiques (accueil, `/contact`, pages légales) dans `src/app/(public)/`, sans appel à `requireUser` ; elles ne montrent jamais d'offre (H12). Tout nouveau chemin public s'ajoute à `src/app/sitemap.ts`, tout nouveau chemin de l'application à `src/app/robots.ts`.
- Prestations (plan 17, H15, H20) : table `service_requests`, vocabulaire et schémas dans `src/domain/service-request.ts`, données dans `src/server/services/requests.ts`, Server Actions `requestServices` (email au fondateur) et `updateServiceRequestAction`. Boîte de l'admin : onglet « Prestations » de `/admin/demandes` (`?onglet=prestations`). Aucune prestation n'est exigée pour publier ; la note interne n'est jamais montrée à l'employeur.
- Messages au fondateur : table `contact_messages`, Server Action `sendContactMessage` (zod, champ piège, 3 messages par email et par heure), boîte dans `/admin/demandes`. Réutiliser ce formulaire (`/contact?motif=…&offre=<id>`) plutôt que d'en créer un autre.
- Nom du service : uniquement dans `src/config/site.ts` (H14).
- Une information absente vaut « Non précisé » (`unknown`). Ne jamais la convertir en « Non », ne jamais l'inventer.
- Montants stockés en centimes. Jamais de conversion brut ↔ net, ni horaire ↔ mensuel.
- Règles de l'offre, à réutiliser plutôt qu'à réécrire (`src/domain/`) : `triLabel`, `displayedSalary` et `formatSalary`, `isActive` et `expiryReason`, `findBlockedTargets`, `checkPublicationMinimum`, `applicationModeExplanation`, et `publicCompanyName` partout où une entreprise est nommée aux candidats.
- Données de démonstration et de test : contacts fictifs uniquement (domaines `.example`, numéros des tranches réservées à la fiction : 01 99 00, 02 61 91, 03 53 01, 04 65 71, 05 36 49, 06 39 98). Le jeu `demoOffers(today)` (`src/lib/db/seed/demo-data.ts`) sert d'oracle aux tests de la recherche.
- Dates :
  - les dates de contrat sont de type `date` ;
  - « aujourd'hui » s'évalue dans le fuseau `Europe/Paris` ;
  - formats `fr-FR` (`Intl`, `date-fns/locale/fr`).
- Mobile d'abord (375 px). Libellés de formulaire explicites et `aria-live` sur les compteurs de résultats.
- Ne rien introduire de la liste « Hors V1 » du README des plans.
- Aucun secret commité : seul `.env.example` est versionné.

## Définition de « terminé »

Les critères d'acceptation du plan sont cochés, et `npm run lint`, `npm run typecheck`, `npm test` (puis `npm run e2e` à partir du plan 05) passent.
