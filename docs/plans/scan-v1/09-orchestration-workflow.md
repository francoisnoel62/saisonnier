# Plan scan 09 — Orchestration durable : Workflow, lancement, cron quotidien et reprise

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 03, 05, 06 (et 04) | 10 | L | plan technique §4 (six premières heures), §5 (pile et exécution ; collecte et revue indépendantes ; exécution, reprises et limites), §6 (recette de livraison progressive), lot 7 ; cahier §2, §3, §9 |

## Objectif

Exécuter les passages en arrière-plan avec Vercel Workflow :

- lancement immédiat du premier remplissage par l'admin, qui reçoit l'identifiant du passage sans attendre la collecte ;
- passage quotidien vers 3 h à Paris, déclenché par Vercel Cron ;
- lots bornés, livraison dossier par dossier, politesse par domaine ;
- reprise sans double comptage, arrêt propre, source défaillante isolée, bilan.

Fermer l'onglet n'arrête rien : la collecte ne dépend ni du navigateur ni de la présence de l'admin.

## Étapes

1. **Installation et vérification préalable.** Lire d'abord [le guide Next.js du SDK](https://workflow-sdk.dev/docs/getting-started/next), [Workflows et étapes](https://workflow-sdk.dev/docs/foundations/workflows-and-steps), [erreurs et réessais](https://workflow-sdk.dev/docs/foundations/errors-and-retries) et les guides Next installés.
   - `npm i workflow@5.2.x` ; `npm i -D @workflow/vitest@5.0.x`, de la même version majeure (versions relevées le 23/10/2026).
   - `next.config.ts` : `export default withWorkflow(nextConfig)`, importé de `workflow/next`, en conservant `distDir` et `turbopack`.
   - **Proxy** : le `matcher` de `src/proxy.ts` est une liste blanche qui n'inclut pas `/.well-known/workflow/` ; aucune modification. Un test le garantit (étape 11).
   - **Fichiers locaux** : `/.workflow-data*` et `/.workflow-vitest` dans `.gitignore`. Les fichiers éventuellement générés par `withWorkflow` dans `src/app/` sont ignorés par git, Prettier et ESLint.
   - **Vercel** : vérifier que le projet expose les variables système (« Enable access to System Environment Variables »), sans quoi chaque run échoue.
   - **Fumée** : un workflow minimal `scanSmokeWorkflow` (deux étapes et un `sleep("5s")`), lancé depuis `/admin/scan` (« Tester l'orchestration ») et suivi par `getRun(runId).status`. Il doit réussir en preview avant tout le reste ; il reste ensuite comme diagnostic de l'installation.
   - Vérifier comment les étapes importent les modules serveur (`pg`, `node:https`). Si l'empaquetage du corps du workflow les refuse, les importer dans le corps des étapes.
2. **Tâche planifiée `scan`** (`src/domain/scheduled-job.ts`, `src/server/jobs/settings.ts`).
   - `scheduledJobDefinitions.scan` : libellé « Scan quotidien des offres », description, horaire « Chaque nuit vers 3 h, heure de Paris », et `enabledByDefault: false`.
   - L'état par défaut d'une tâche sans ligne vient de sa définition (`enabledByDefault ?? true`) : la tâche `daily` reste active par défaut, le scan démarre désactivé (plan technique §5).
   - `ScheduledJobSummaries.scan = { date, outcome: "started" | "already_started" | "run_in_progress" | "resumed" | "start_failed", runId }`, avec son `summaryLabel`. La carte « Tâches planifiées » de `/admin` l'affiche sans autre changement.
3. **Workflow** `src/workflows/scan.ts`. Le corps ne fait qu'orchestrer : aucun accès au réseau ni à la base (le `fetch` global n'y existe pas), et `Date` y est une horloge logique.

   ```ts
   export async function scanWorkflow(runId: string, token: string) {
     "use workflow"
     const claim = await claimRunStep(runId, token)
     if (!claim.ok) return { runId, outcome: claim.reason }
     // Trois domaines à la fois au plus ; une requête à la fois par domaine.
     for (const group of claim.domainGroups) {
       await Promise.all(group.map((domain) => scanDomain(runId, token, domain)))
     }
     return await finishRunStep(runId, token)
   }
   ```

   `scanDomain`, fonction ordinaire appelée par le workflow, traite les sources du domaine l'une après l'autre :
   - **liste** : `listPageStep` en boucle tant qu'il y a une page suivante, dans la limite de pages, sauf arrêt demandé ou jeton remplacé ;
   - **fiches** : `processBatchStep` en boucle jusqu'à épuisement des pistes, sauf arrêt ou plafond ;
   - `retryAfterMs` renvoyé par une étape : `await sleep(...)` (durée convertie au format du SDK, par exemple `"120s"`), puis même page ou même lot ; l'attente ne consomme rien ;
   - une source bloquée ou indisponible s'arrête seule : les autres continuent (plan technique §5).
4. **Étapes** `src/workflows/scan-steps.ts` (`"use step"`).
   - Entrées et sorties minuscules : identifiants, curseurs, compteurs. Le HTML ne transite jamais par le Workflow (données facturées au-delà de 1 Go par mois en Hobby).
   - Chaque étape revérifie le jeton du passage (`claim_token`) et s'arrête sans écrire s'il a été remplacé.

   **`claimRunStep(runId, token)`** :
   - `claimRun` (plan 03), avec l'identifiant Workflow ;
   - `initRunSources` pour les sources activées. À la reprise, les sources `done` sont sautées, les sources `blocked` restent bloquées pour ce passage, les autres reprennent leur curseur ;
   - renvoie les groupes de domaines (`planDomains`, pur).

   **`listPageStep(runId, token, sourceKey, cursor)`** :
   - une page de liste par l'adaptateur ;
   - `recordListedPosting` pour chaque élément ; une annonce hors périmètre dès la liste est écartée sans lecture de sa fiche ;
   - curseur et compteurs enregistrés dans `scan_run_sources` ;
   - renvoie `{ next, listed, stop, retryAfterMs }`.

   **`processBatchStep(runId, token, sourceKey)`**, budget de **120 s**. Tant que le budget et les pistes le permettent :
   1. vérifier la demande d'arrêt ;
   2. respecter l'intervalle de politesse (`waitBeforeNextRequest`) ;
   3. lire la fiche (`readPosting`) ;
   4. extraction réussie :
      - `compareRecruitment` avec le dossier connu : même recrutement (rien de nouveau ; divergence s'il est déjà décidé), ou autre période (nouvelle génération) ;
      - `buildProposal`, entreprise proposée par le SIREN du registre (SH15), `admitPosting` ;
      - `findDuplicateSuspects` (plan 04) ;
      - puis, en une transaction courte : écarter (`excludeCandidate`) ; publier si `canAutoPublish` (`publishCandidate`, acteur `scan`) ; sinon livrer (`deliverCandidate`), y compris quand la publication est refusée dans sa transaction ;
      - enfin, rattachement de métier ou suggestion (`attachOccupation`, plan 06) ;
   5. fiche disparue (`gone`) : piste `failed` (« fiche introuvable »), non relue dans ce passage ;
   6. fiche illisible ou délai dépassé : `recordFailure`, réessai en fin de file, trois essais au plus ;
   7. refus d'accès (401, 403) ou robots.txt : la source passe `blocked`, une revue `incident` est ouverte ou réutilisée, l'étape s'arrête pour cette source ;
   8. `rate_limited` : l'étape s'arrête et renvoie `retryAfterMs`, sans toucher à la piste.

   L'étape renvoie `{ processed, delivered, remaining, done, stop, retryAfterMs }`. Une exception (base indisponible) laisse le SDK réessayer l'étape (3 réessais par défaut) : les écritures conditionnées par statut la rendent idempotente.

   **`finishRunStep(runId, token)`** :
   - statut final par `finalRunStatus` (`completed`, `partial`, `stopped`) et `finishedAt` ;
   - incidents regroupés par source et par nature (`scan_reviews`, `kind: "incident"`) ;
   - en passage quotidien, purge à 90 jours du texte et des observations des dossiers écartés, échoués ou rejetés (SH13) ;
   - email de bilan au fondateur (SH16), envoyé une seule fois : `reportSentAt` (plan 03) est posé par une mise à jour conditionnelle avant l'envoi, puis `scanRunReportEmail` (`src/lib/email/templates.ts`) part vers `ADMIN_NOTIFICATION_EMAIL`. Un échec d'envoi est journalisé, jamais réessayé en boucle. Le bilan du remplissage initial dit si la cible est atteinte ; sinon, il invite à activer une source de réserve et à reprendre le passage.
5. **Déclenchement par l'admin** `src/server/scan/run-actions.ts` (`requireRole("admin")`, `revalidatePath("/admin/scan")`).
   - **`launchBootstrapScan()`** :
     - au moins une source activée ;
     - `createBootstrapRun` ;
     - si le passage est créé : `start(scanWorkflow, [run.id, run.claimToken])` (`workflow/api`), puis `workflowRunId` enregistré ; l'action renvoie l'identifiant du passage dès que `start` l'a pris en charge, sans attendre la collecte (plan technique §5) ;
     - si `start` échoue : le passage reste `queued`, sans orchestration, et l'écran propose « Relancer » ;
     - passage déjà existant : message et lien vers lui ; jamais un second remplissage (SH3).
   - **`resumeScanRun(runId)`**, autorisée pour un passage `stopped`, `partial` ou `failed`, ou pour un passage actif dont l'orchestration est perdue : `getRun(workflowRunId).status` n'est plus actif, ou aucune progression depuis 15 minutes. Elle appelle `renewClaim` (nouveau jeton), puis `start`. L'ancien run, s'il vit encore, est écarté par son jeton. Échéance, compteur et décisions sont conservés.
   - **`stopScanRun(runId)`** : `requestStop`. Les étapes s'arrêtent à la fin de la piste en cours, le passage devient `stopped`, le travail restant est gardé pour « Reprendre ».
6. **Cron quotidien** `src/app/api/cron/scan/route.ts`, `GET`.
   - Secret vérifié comme pour `/api/cron/quotidien` (`safeEqual`, `Authorization: Bearer ${CRON_SECRET}`).
   - **Garde de créneau** `isDailyScanSlot(now)` (`src/domain/scan/schedule.ts`) : vrai s'il est 3 h à Paris. Hors créneau, réponse `{ skipped: "outside_slot" }`, sans rien enregistrer.
   - Puis `runScheduledJob("scan", …)` :
     - tâche désactivée : `{ skipped: "disabled" }` ;
     - passage actif : `run_in_progress` (SH2) ;
     - `createDailyRun(todayInParis(now))` : passage du jour déjà existant → `already_started`, ou `resumed` s'il est `queued` sans orchestration depuis plus de 10 minutes ;
     - sinon `start(...)` → `started` ; un échec de `start` → `start_failed`, et le passage reste visible pour une relance.
   - **`vercel.json`** : deux entrées, `{ "path": "/api/cron/scan", "schedule": "0 1 * * *" }` et `{ "path": "/api/cron/scan", "schedule": "0 2 * * *" }` (SH11). En Hobby, chacune part n'importe quand dans son heure ; la garde ne laisse passer que celle qui tombe à 3 h à Paris : 1 h UTC en été, 2 h UTC en hiver. Si Vercel refuse deux entrées pour un même chemin, deux chemins dédiés (`/api/cron/scan/creneau-1`, `/creneau-2`) appellent le même gestionnaire.
   - Le cron `/api/cron/quotidien` existant n'est pas modifié. Les crons ne s'exécutent que sur la production : en preview, la route s'appelle à la main avec le secret.
7. **Écran `/admin/scan`**, qui complète les plans 01 et 06.
   - Bouton « Lancer le premier remplissage » : désactivé sans source activée ; remplacé par le passage une fois lancé.
   - **Carte du passage**, actualisée par l'API d'état (plan 06) :
     - mode, statut, début ;
     - échéance T+6 h et temps restant ;
     - « Dossiers livrés pour vérification : n / 50 » ;
     - « Seuil atteint à … (T+… ) » ;
     - premier dossier livré à … ;
     - stock à vérifier et annonces publiées, affichés à part.
   - Avancement par source : listées, lues, livrées, écartées, échecs, requêtes ; état bloqué avec sa raison.
   - Boutons « Arrêter » et « Reprendre », selon le statut ; « Relancer » pour un passage sans orchestration.
   - Historique `/admin/scan/passages` ; bilan `/admin/scan/passages/[id]` (`getRunReport`, plan 03) : livrés avant T+6 h, `targetReachedAt`, seuil confirmé, délai du premier dossier, exclusions et rejets par motif, doublons, échecs par source, requêtes et octets, étapes exécutées, publications humaines et automatiques séparées.
8. **Variables de test.**
   - `SCAN_TEST_SOURCE_URL` (plan 01) active la source `fixture`.
   - `e2e/helpers/env.ts` transmet au serveur de test `SCAN_TEST_SOURCE_URL=http://localhost:3199` et les variables lues par `@workflow/world-local` 5.1.2, à revérifier : `WORKFLOW_LOCAL_DATA_DIR=.workflow-data-e2e` (stockage séparé de celui de `npm run dev`), `WORKFLOW_LOCAL_BASE_URL=http://localhost:3100` et `WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS=0`.
   - Aucune nouvelle variable de production.
9. **Source de test pour l'E2E** `e2e/scan-source-server.mjs`, serveur Node minimal sur le port 3199 :
   - `GET /health` ;
   - `GET /offres` : liste de deux fiches ;
   - `GET /offres/1` : dossier complet, données fictives (`.example`) ;
   - `GET /offres/2` : réponse suspendue jusqu'à `POST /controle/liberer/2`, au plus 60 s ;
   - `POST /controle/reinitialiser`.

   Il devient un second `webServer` de `playwright.config.ts`, démarré avant `next dev`.
10. **Vitest** : un projet `workflow` (`src/**/*.wf.test.ts`, plugin `workflow()` de `@workflow/vitest`, migrations du `globalSetup` d'intégration, fichiers en série). `npm run test:int` exécute `--project integration --project workflow`, et la CI ne change pas. Vérifier la compatibilité de `@workflow/vitest` avec Vitest 5.
11. **`CLAUDE.md`** : orchestration (workflow, étapes, jeton), commandes (`npx workflow web`, `npx workflow inspect runs` pour suivre les runs en local), cron du scan et sa garde, source de test.

## Repli si Workflow ne convient pas

Si l'étape 1 échoue (compatibilité, limites du compte), les étapes restent des fonctions ordinaires : hors d'un workflow, la directive `"use step"` n'a pas d'effet. Le repli enchaîne `listPageStep` et `processBatchStep` dans une route bornée (moins de 300 s), relancée par l'admin, avec la même progression en base. Comme il fait dépendre la collecte d'une relance, il doit repasser la recette des six heures avant d'être tenu pour équivalent (plan technique §5). Ne jamais le remplacer par une promesse laissée en cours après la réponse HTTP.

## Tests

**Unitaires** :

- `isDailyScanSlot`, autour des changements d'heure :

  | Instant (UTC) | Heure à Paris | Créneau |
  |---|---|---|
  | 2026-07-01 01:30 | 3 h 30 (été) | oui |
  | 2026-07-01 02:30 | 4 h 30 | non |
  | 2026-12-01 01:30 | 2 h 30 (hiver) | non |
  | 2026-12-01 02:30 | 3 h 30 | oui |
  | 2026-10-25 01:30 | 2 h 30 (passage à l'heure d'hiver) | non |
  | 2026-10-25 02:30 | 3 h 30 | oui |
  | 2027-03-28 01:30 | 3 h 30 (passage à l'heure d'été) | oui |
  | 2027-03-28 02:30 | 4 h 30 | non |

- `planDomains`, budget d'un lot, `finalRunStatus` ;
- proxy (`unstable_doesMiddlewareMatch` de `next/experimental/testing/server`) : `/.well-known/workflow/v1/flow` et `/.well-known/workflow/v1/step` ne passent pas par le proxy ; `/admin/scan` y passe.

**Intégration** (gestionnaire de la route appelé directement, horloge simulée, `start` simulé) :

- secret absent ou faux : 401 ;
- hors créneau : rien n'est enregistré ;
- tâche désactivée par défaut : rien ne démarre ;
- premier créneau du jour : un passage et un run ; second créneau, ou appel répété le même jour : `already_started` ;
- passage actif : `run_in_progress` ;
- `launchBootstrapScan` appelé deux fois en même temps : un seul passage, un seul `start` ;
- reprise après un échec : nouveau jeton, ancien jeton refusé.

**Workflow** (`src/workflows/scan.wf.test.ts`, `@workflow/vitest`, base de test, serveur de fixtures démarré par le test) :

- « livraison progressive : le premier dossier est en base avant la fin du passage » ;
- « étape interrompue puis réessayée : compteur inchangé, décision de l'admin préservée » (espion qui lève une fois après la première livraison) ;
- « une source bloquée (403) : passage partiel, l'autre source livre ses dossiers » ;
- « arrêt demandé : passage arrêté ; la reprise ne relivre rien » ;
- « remplissage initial : aucun dossier publié automatiquement » ;
- « passage quotidien, source autorisée : le dossier conforme est publié « Sourcée sur internet », le dossier douteux va en revue » ;
- « jeton remplacé : l'ancien workflow s'arrête sans écrire ».

**E2E** dans `e2e/scan-orchestration.spec.ts` :

- « Scan §6 — recette de livraison progressive » :
  1. l'admin lance le premier remplissage ;
  2. le dossier 1 apparaît pendant que la fiche 2 est suspendue ; il se valide ;
  3. l'admin ouvre un autre dossier et y saisit du texte ; la fiche 2 est libérée ; le dossier 2 arrive, la saisie est intacte ;
  4. après fermeture et réouverture de l'écran, le passage a continué, les dossiers et la décision sont retrouvés, et le compteur indique 2 / 50 ;
- « Scan §3 — la route du scan refuse tout appel sans le secret ».

## Critères d'acceptation

- [ ] Le workflow minimal et le scan fonctionnent en preview ; les runs sont visibles dans l'observabilité Vercel.
- [ ] Le lancement répond avec l'identifiant du passage sans attendre la collecte ; fermer l'écran n'arrête rien.
- [ ] Un double déclenchement ne crée ni second passage ni double publication ; une étape rejouée ne double aucun compte.
- [ ] Une source en échec n'empêche pas les autres ; arrêt et reprise conservent l'avancement et les décisions.
- [ ] Le cron ne démarre qu'un passage par jour, entre 3 h et 3 h 59 à Paris, et seulement si l'admin a activé la tâche.

## Hors périmètre

- Curseurs persistants d'un passage à l'autre, pagination exhaustive, cadence configurable par source (V2, V5).
- Service temps réel payant, notifications push.
