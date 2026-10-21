# Plan 01 — Socle projet & premier déploiement

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| — | 02 | S | §8 (les choix techniques, laissés ouverts, sont fixés ici) |

## Objectif

Créer un projet Next.js 16 + shadcn/ui (bloc `dashboard-01`), versionné sur GitHub et déployé en production sur Vercel (équipe `francois-noels-projects`).
Le plan installe aussi l'outillage qualité et un `CLAUDE.md` qui fixe les conventions de tous les plans suivants.

## Prérequis

Versions constatées le 21/10/2026 : Node 24.12, npm 11.6, git 2.51, gh 2.81, Vercel CLI 58.4, Docker 29.8.

Vérifier les connexions avec `gh auth status` et `vercel whoami`.

## Étapes

1. **Ranger la racine.** Déplacer `cahier-des-charges-job-board-saisonnier-v1.md` dans `docs/`. create-next-app n'accepte qu'un dossier vide, à l'exception de `docs/`, `.git`, `.claude`, `.vscode`, `LICENSE`, etc. La racine ne doit donc plus contenir que `docs/`.
2. **Créer l'application** dans le dossier courant :
   ```bash
   npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --agents-md --no-agent-feedback
   ```
   - Répondre **non** à React Compiler et à Cache Components.
   - Vérifier que `next.config.ts` ne contient ni `reactCompiler` ni `cacheComponents`.
   - create-next-app initialise git et génère `AGENTS.md`, qui documente Next 16 à jour pour les agents. Le conserver.
3. **Installer shadcn/ui** :
   ```bash
   npx shadcn@latest init --base radix
   npx shadcn@latest add dashboard-01
   ```
   - Choisir la base **Radix** et non Base UI, défaut de la CLI 4 : le bloc `dashboard-01` est publié dans le registre `new-york-v4`, basé sur Radix.
   - Garder le preset proposé et les variables CSS.
   - Vérifier la présence de :
     - la page `src/app/dashboard/page.tsx` ;
     - les composants `app-sidebar`, `nav-main`, `nav-documents`, `nav-secondary`, `nav-user`, `site-header`, `section-cards`, `chart-area-interactive` et `data-table` dans `src/components/` ;
     - les dépendances `@tanstack/react-table` v9, `recharts`, `@dnd-kit/*`, `@tabler/icons-react`, `sonner` et `zod`.
4. **Bases françaises.**
   - Créer `src/config/site.ts` avec `name` (nom provisoire « Saisonnier »), `description` et `locale: "fr-FR"`. C'est le seul endroit à modifier quand le nom sera choisi (H14).
   - Dans `src/app/layout.tsx` :
     - `<html lang="fr">` ;
     - `metadata` avec le gabarit de titre `%s · {site.name}` ;
     - le composant `<Toaster />` de sonner.
5. **Accueil provisoire.** `src/app/page.tsx` affiche un titre et un lien vers `/dashboard`. Il sera remplacé au plan 06.
6. **Qualité.**
   - Prettier avec `prettier-plugin-tailwindcss`, et un script `format`.
   - Scripts `typecheck` (`tsc --noEmit`), `test` (`vitest run`) et `test:watch`.
   - `vitest.config.ts` : environnement `node`, alias `@` → `src`, fichiers `src/**/*.test.ts`.
   - Un test de fumée sur `cn()` dans `src/lib/utils.test.ts`.
7. **`CLAUDE.md`** à la racine. Il commence par `@AGENTS.md` ; son contenu est décrit dans la section suivante.
8. **Fichiers d'environnement.**
   - Créer `.env.example`, vide pour l'instant ; chaque plan le complète.
   - Vérifier que `.gitignore` couvre `.env*.local`, `.vercel`, `/playwright-report`, `/test-results` et `/e2e/.auth`.
9. **GitHub.**
   - Faire le commit initial `chore: socle Next.js 16 + shadcn dashboard-01`.
   - Créer et pousser le dépôt :
     ```bash
     gh repo create saisonnier --private --source . --remote origin --push
     ```
10. **Vercel.**
    - Lier le dossier au projet et connecter le dépôt :
      ```bash
      vercel link --yes --scope francois-noels-projects --project saisonnier
      vercel git connect
      ```
    - Si Vercel le demande, autoriser son application GitHub sur le dépôt.
    - Pousser sur `main` : cela déclenche le déploiement de production.
    - Alternative : importer le dépôt depuis le dashboard Vercel.
    - Ne pas toucher aux autres projets de l'équipe (`hotelix`, `revise`).

## Contenu attendu de `CLAUDE.md`

**Projet.**
Lier `docs/cahier-des-charges-job-board-saisonnier-v1.md` et `docs/plans/README.md`, qui contient les plans, les hypothèses H1–H15 et le glossaire.

**Commandes.**
`dev`, `build`, `lint`, `typecheck` et `test`. Le plan 02 ajoute `db:*` ; le plan 05 ajoute `e2e`.

**Conventions.**

- Interface, contenus et URL en français ; code, tables et colonnes en anglais, selon le glossaire.
- Spécificités de Next 16 :
  - le proxy vit dans `src/proxy.ts` (il n'y a plus de `middleware.ts`) ;
  - `params`, `searchParams`, `cookies()` et `headers()` sont asynchrones ;
  - pas de `cacheComponents` en V1 : tout est authentifié et dynamique ;
  - appeler `revalidatePath` après chaque mutation.
- Les composants shadcn s'ajoutent par la CLI (`npx shadcn@latest add …`). Ne jamais réécrire `src/components/ui` à la main.
- Tableaux en **TanStack Table v9** : suivre le modèle de `data-table.tsx` (`useTable`, `tableFeatures`, `createSortedRowModel`…). Ne pas utiliser l'API v8 `useReactTable`.
- Répartition du code :
  - règles métier pures dans `src/domain/`, sans accès réseau ni base, et testées ;
  - accès aux données dans `src/server/<module>/` ;
  - chaque Server Action et chaque route vérifie la session et le rôle via `src/lib/dal.ts`. Le proxy ne fait que des redirections optimistes.
- Une information absente vaut « Non précisé » (`unknown`). Ne jamais la convertir en « Non », ne jamais l'inventer.
- Montants stockés en centimes. Jamais de conversion brut ↔ net, ni horaire ↔ mensuel.
- Dates :
  - les dates de contrat sont de type `date` ;
  - « aujourd'hui » s'évalue dans le fuseau `Europe/Paris` ;
  - formats `fr-FR` (`Intl`, `date-fns/locale/fr`).
- Mobile d'abord (375 px). Libellés de formulaire explicites et `aria-live` sur les compteurs de résultats.
- Ne rien introduire de la liste « Hors V1 » du README des plans.

**Définition de « terminé ».**
Les critères du plan sont cochés, et `lint`, `typecheck`, `test` (puis `e2e`) passent.

## Critères d'acceptation

- [ ] `npm run dev` affiche le bloc dashboard-01 sur `/dashboard`.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` passent.
- [ ] Le dépôt GitHub privé `saisonnier` est à jour et lié au projet Vercel `saisonnier`.
- [ ] Le déploiement de production est vert, et l'URL `*.vercel.app` affiche `/dashboard`.
- [ ] `CLAUDE.md`, `AGENTS.md` et `.env.example` sont présents, sans aucun secret commité.

## Hors périmètre

- Base de données et authentification.
- Adaptation du dashboard (plan 04).
- Page d'accueil définitive (plan 06).
