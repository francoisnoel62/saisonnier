@AGENTS.md

# Saisonnier — job-board saisonnier V1

## Projet

- Besoin : [cahier des charges](docs/cahier-des-charges-job-board-saisonnier-v1.md).
- Réalisation : [plans, hypothèses H1–H16 et glossaire](docs/plans/README.md). Une branche par plan (`plan/NN-slug`), une PR, une preview Vercel vérifiée avant le merge.
- Déploiement : projet Vercel `saisonnier` (équipe `francois-noels-projects`), production sur `main`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` (types des routes) puis `tsc --noEmit` |
| `npm test` | tests unitaires Vitest (`src/**/*.test.ts`) |
| `npm run test:int` | tests d'intégration (`src/**/*.int.test.ts`) sur `saisonnier_test`, migrations appliquées au démarrage |
| `npm run format` | Prettier (+ tri des classes Tailwind) |
| `npm run db:up` / `db:down` | Postgres 18 local (Docker) : bases `saisonnier` et `saisonnier_test` |
| `npm run db:generate` | migration SQL depuis `src/lib/db/schema` (`--custom` pour une migration de données) |
| `npm run db:migrate` / `db:check` / `db:studio` | appliquer, vérifier, explorer |
| `npm run admin:grant -- <email>` | passer en `admin` un compte existant et vérifié (autre base : préfixer `DATABASE_URL=…`) |
| `npm run db:seed:demo` | jeu de démonstration dans la base de développement : 8 entreprises fictives et 40 offres datées par rapport à aujourd'hui ; relancer le remet à l'état initial ; refusé si `VERCEL_ENV=production` |
| `npm run e2e` / `e2e:ui` | tests Playwright (`e2e/*.spec.ts`), projets `chromium` et `mobile` (Pixel 7), sur `saisonnier_test` |

- L'E2E lance son propre `next dev -p 3100` (dossier `.next-e2e`) : il tourne en même temps que `npm run dev`.
- Il vide la base de test à chaque exécution, référentiels exceptés : tout nouveau référentiel s'ajoute à `REFERENCE_TABLES` (`e2e/helpers/db.ts`). Il refuse toute base dont le nom ne finit pas par `_test`.
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
- Recherche : `searchOffers(criteria, { page, pageSize, today })` (`src/server/search/`), critères validés par `searchCriteriaSchema` (`src/domain/search-criteria.ts`). Toute règle de correspondance s'écrit deux fois, dans `matchesCriteria` (`src/domain/offer-matching.ts`, l'oracle) et dans `build-conditions.ts` : le test d'intégration exige qu'elles retiennent les mêmes offres du jeu de démonstration.

## Authentification

- Better Auth 1.7 (`src/lib/auth.ts`), email + mot de passe, vérification d'email obligatoire. Rôles `candidate` / `employer` / `admin` sur `user.role` (`input: false` : jamais fourni par le client ; contrainte CHECK en base).
- Tables dans `src/lib/db/schema/auth.ts` : régénérées par `npx auth@latest generate`, puis réalignées sur le projet (`casing`, `timestamptz`). Ne pas renommer tables ni propriétés.
- Pages : `getSession` / `requireUser` / `requireRole` de `src/lib/dal.ts`. Accueil de chaque rôle : `homePathFor` (`src/domain/roles.ts`).
- La limitation de débit de Better Auth ne s'applique qu'aux requêtes vers `/api/auth` : connexion, renvois de liens et mots de passe passent par `authClient`. Une Server Action (`auth.api.*`) n'est utilisée que si le serveur doit décider (ex. rôle employeur à l'inscription).
- Sans `RESEND_API_KEY`, les emails s'affichent dans la console du serveur, liens compris.

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
- Tableaux en **TanStack Table v9** : suivre le modèle de `src/components/dashboard/data-table.tsx` (`useTable`, `tableFeatures`, `createSortedRowModel`…). Ne pas utiliser l'API v8 `useReactTable`.
- Répartition du code :
  - règles métier pures dans `src/domain/`, sans accès réseau ni base, et testées ;
  - accès aux données dans `src/server/<module>/` ;
  - chaque Server Action et chaque route vérifie la session et le rôle via `src/lib/dal.ts`. Le proxy ne fait que des redirections optimistes.
- Shell authentifié :
  - le layout `src/app/(app)/layout.tsx` pose la sidebar ; sa navigation vient de `src/config/navigation.ts`, par rôle. Une nouvelle page de menu s'y déclare, avec son titre d'en-tête ;
  - les layouts `employeur/` et `admin/` appellent `requireRole` ; les pages candidat l'appellent elles-mêmes ;
  - `error.tsx` reçoit `retry` (Next 16.3+), plus `reset`.
- Pages publiques (accueil, `/contact`, pages légales) dans `src/app/(public)/`, sans appel à `requireUser` ; elles ne montrent jamais d'offre (H12). Tout nouveau chemin public s'ajoute à `src/app/sitemap.ts`, tout nouveau chemin de l'application à `src/app/robots.ts`.
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
