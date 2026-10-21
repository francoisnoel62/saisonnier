@AGENTS.md

# Saisonnier — job-board saisonnier V1

## Projet

- Besoin : [cahier des charges](docs/cahier-des-charges-job-board-saisonnier-v1.md).
- Réalisation : [plans, hypothèses H1–H15 et glossaire](docs/plans/README.md). Une branche par plan (`plan/NN-slug`), une PR, une preview Vercel vérifiée avant le merge.
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

Le plan 05 ajoute `e2e`.

## Base de données

- Drizzle ORM 0.45 (rester sur la branche stable), `casing: "snake_case"` : propriétés en camelCase, colonnes en snake_case.
- Client unique : `db` de `src/lib/db`. Variables serveur validées par `src/lib/env.ts` ; toute nouvelle variable y est déclarée et ajoutée à `.env.example`.
- Local : `.env.development.local` et `.env.test.local` (non versionnés). Vercel : Neon (Postgres 18) injecte `DATABASE_URL` (poolée) et `DATABASE_URL_UNPOOLED` (migrations).
- Les migrations versionnées dans `drizzle/` s'appliquent au build Vercel (`vercel.json`) ; chaque preview migre sa branche Neon.
- Les référentiels (régions, départements, métiers, domaines exclus) sont insérés par migration SQL en `ON CONFLICT DO NOTHING`, jamais par un script manuel.

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
- Tableaux en **TanStack Table v9** : suivre le modèle de `src/components/data-table.tsx` (`useTable`, `tableFeatures`, `createSortedRowModel`…). Ne pas utiliser l'API v8 `useReactTable`.
- Répartition du code :
  - règles métier pures dans `src/domain/`, sans accès réseau ni base, et testées ;
  - accès aux données dans `src/server/<module>/` ;
  - chaque Server Action et chaque route vérifie la session et le rôle via `src/lib/dal.ts`. Le proxy ne fait que des redirections optimistes.
- Shell authentifié :
  - le layout `src/app/(app)/layout.tsx` pose la sidebar ; sa navigation vient de `src/config/navigation.ts`, par rôle. Une nouvelle page de menu s'y déclare, avec son titre d'en-tête ;
  - les layouts `employeur/` et `admin/` appellent `requireRole` ; les pages candidat l'appellent elles-mêmes ;
  - `error.tsx` reçoit `retry` (Next 16.3+), plus `reset`.
- Nom du service : uniquement dans `src/config/site.ts` (H14).
- Une information absente vaut « Non précisé » (`unknown`). Ne jamais la convertir en « Non », ne jamais l'inventer.
- Montants stockés en centimes. Jamais de conversion brut ↔ net, ni horaire ↔ mensuel.
- Dates :
  - les dates de contrat sont de type `date` ;
  - « aujourd'hui » s'évalue dans le fuseau `Europe/Paris` ;
  - formats `fr-FR` (`Intl`, `date-fns/locale/fr`).
- Mobile d'abord (375 px). Libellés de formulaire explicites et `aria-live` sur les compteurs de résultats.
- Ne rien introduire de la liste « Hors V1 » du README des plans.
- Aucun secret commité : seul `.env.example` est versionné.

## Définition de « terminé »

Les critères d'acceptation du plan sont cochés, et `npm run lint`, `npm run typecheck`, `npm test` (puis `npm run e2e` à partir du plan 05) passent.
