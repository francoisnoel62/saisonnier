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
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | tests unitaires Vitest (`src/**/*.test.ts`) |
| `npm run format` | Prettier (+ tri des classes Tailwind) |

Le plan 02 ajoute les scripts `db:*` ; le plan 05 ajoute `e2e`.

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
