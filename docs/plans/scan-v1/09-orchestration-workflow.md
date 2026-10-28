# Plan scan 09 — Orchestration durable : Workflow, lancement, cron quotidien et reprise

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 03, 05, 06 (et 04) ; [V2-01](../scan-v2/01-gestion-des-sources.md) lots A et E | 10 | L | plan technique §4 (six premières heures), §5 (pile et exécution ; collecte et revue indépendantes ; exécution, reprises et limites), §6 (recette de livraison progressive), lot 7 ; cahier §2, §3, §9 ; V2-01 §14.2 (contrat) |

Rédigé le 23/10/2026. **Actualisé le 28/10/2026** après le plan scan V2-01 (PR #43 à #51) : la source est une donnée versionnée en base (SH20), le disjoncteur du lot E attend son déclenchement en fin de passage, et la recette des sources du 28/10 n'a activé que France Travail en production (voir le [compte rendu](../../scan/recette-sources.md)).

## Objectif

Exécuter les passages en arrière-plan avec Vercel Workflow :

- lancement immédiat du premier remplissage par l'admin, qui reçoit l'identifiant du passage sans attendre la collecte ;
- passage quotidien vers 3 h à Paris, déclenché par Vercel Cron ;
- lots bornés, livraison dossier par dossier, politesse par domaine ;
- reprise sans double comptage, arrêt propre, source défaillante isolée, disjoncteur appliqué, bilan.

Fermer l'onglet n'arrête rien : la collecte ne dépend ni du navigateur ni de la présence de l'admin.

## Ce qui a changé depuis la rédaction

| Sujet | Rédaction du 23/10 | Depuis V2-01 |
|---|---|---|
| Définition d'une source | `scanSourceDefinitions[key]` en code | `getScanSourceDefinition(key, { revision })` : version figée par le passage (`scan_run_sources.source_revision`) |
| Sources d'un passage | sources activées | `listRunnableSources(run.mode)` : prête, activée, non suspendue, connecteur disponible et, en quotidien, « Passages quotidiens » activé |
| Interrupteurs pendant le passage | non prévu | relus avant chaque lot (`sourceParticipates`) ; une source qui ne participe plus passe `skipped` |
| Publication automatique | `enabled && autoPublish` | `sourceAutoPublishes`, déjà vérifié par `publishCandidate` ; une découverte (France Travail) ne publie jamais seule |
| Fin de passage | incidents et bilan | et disjoncteur `applyCircuitBreaker(tx, runId)` dans la transaction de fin ; `robotsDigest` enregistré par source |
| Rattachement de métier | étape après la livraison | déjà fait par `deliverCandidate` (`attachOccupationInTransaction`) |
| Source de test de l'E2E | nouveau serveur sur le port 3199 | serveur de fixtures existant `scripts/scan-fixture-server.ts` (port de l'E2E + 1) et source `fixture` |
| France Travail en passage programmé | à vérifier à la main | règle SH24 (`scheduledAccessBasis`) ; décisions du fondateur du 28/10 |
| Versions du SDK | relevées le 23/10 | inchangées le 28/10 : `workflow` 5.2.3, `@workflow/vitest` 5.0.6 (Vitest ≥ 3.1), `@workflow/world-local` 5.1.2 |

## Préconditions relevées par la revue de la PR #37

Toujours ouvertes le 28/10, sauf la dernière, tranchée par le fondateur. À traiter en branchant le Workflow, avant le premier passage réel :

- `findDuplicateSuspects` (`duplicates.ts`) écrit hors du verrou du passage : l'exécuter dans `withRunClaim` (jeton, passage verrouillé avant le dossier). Il relit aussi toutes les annonces et tous les dossiers livrés à chaque appel : filtrer en SQL par département (lieux supplémentaires compris), entreprise et URL canonique avant de comparer les intitulés.
- `deliverCandidate` horodate `readyForReviewAt` avec un `now` reçu avant la prise du verrou : deux livraisons simultanées peuvent valider dans l'ordre inverse, et la file (`use-scan-snapshot.ts`, curseur `readyForReviewAt|id`) ne verrait jamais la plus ancienne. Horodater après la prise du verrou (horloge de la base dans la transaction).
- Les précisions (profil, organisation, informations pratiques, remarques de salaire et des conditions) sont copiées sans être coupées aux limites du formulaire (500 ou 1 000 caractères) : `proposalFormIssues` ne contrôle que l'intitulé, la description, les missions et « Divers ». Tronquer comme la description, avec l'alerte `text_truncated`.
- La page d'un dossier propose le métier d'une suggestion même désactivé depuis, que `validateScanCandidate` refuse ensuite (`getOfferFormReferentials()` sans le métier courant) : lire les référentiels avec le même identifiant de métier dans l'action.
- Le badge « Candidature externe » (`isExternalApplication`) ignore les domaines devenus exclus après la publication, contrairement au panneau de candidature : lui passer les domaines exclus.
- **Décision du fondateur du 28/10/2026** : le formulaire de l'employeur affiche en lecture seule les lieux supplémentaires ajoutés par l'admin, avec « Pour les modifier, contactez-nous » (lien `/contact?motif=…&offre=<id>`). Ses enregistrements continuent de les conserver.

## Étapes

1. **Installation et vérification préalable.** Lire d'abord [le guide Next.js du SDK](https://workflow-sdk.dev/docs/getting-started/next), [Workflows et étapes](https://workflow-sdk.dev/docs/foundations/workflows-and-steps), [erreurs et réessais](https://workflow-sdk.dev/docs/foundations/errors-and-retries) et les guides Next installés.
   - `npm i workflow@5.2.x` ; `npm i -D @workflow/vitest@5.0.x`.
   - `next.config.ts` : `export default withWorkflow(nextConfig)`, importé de `workflow/next`, en conservant `distDir` et `turbopack`.
   - **Proxy** : le `matcher` de `src/proxy.ts` est une liste blanche qui n'inclut pas `/.well-known/workflow/` ; aucune modification. Un test le garantit.
   - **Fichiers locaux** : `/.workflow-data*` et `/.workflow-vitest` dans `.gitignore`. Les fichiers éventuellement générés par `withWorkflow` dans `src/app/` sont ignorés par git, Prettier et ESLint.
   - **Vercel** : vérifier que le projet expose les variables système (« Enable access to System Environment Variables »), sans quoi chaque run échoue.
   - **Fumée** : un workflow minimal `scanSmokeWorkflow` (deux étapes et un `sleep("5s")`), lancé depuis `/admin/scan` (« Tester l'orchestration ») et suivi par `getRun(runId).status`. Il doit réussir en preview avant tout le reste ; il reste ensuite comme diagnostic de l'installation.
   - Vérifier comment les étapes importent les modules serveur (`pg`, `node:https`, `server-only`). Si l'empaquetage du corps du workflow les refuse, les importer dans le corps des étapes.
2. **Tâche planifiée `scan`** (`src/domain/scheduled-job.ts`, `src/server/jobs/settings.ts`).
   - `scheduledJobDefinitions.scan` : libellé « Scan quotidien des offres », description, horaire « Chaque nuit vers 3 h, heure de Paris », et `enabledByDefault: false`.
   - L'état par défaut d'une tâche sans ligne vient de sa définition (`enabledByDefault ?? true`) : la tâche `daily` reste active par défaut, le scan démarre désactivé (plan technique §5).
   - `ScheduledJobSummaries.scan = { date, outcome: "started" | "already_started" | "run_in_progress" | "resumed" | "start_failed" | "no_source", runId }`, avec son `summaryLabel`. La carte « Tâches planifiées » de `/admin` l'affiche sans autre changement.
   - La tâche est l'interrupteur général ; chaque source garde son interrupteur « Passages quotidiens » (`dailyEnabled`). Un passage quotidien ne lit que les sources qui ont les deux.
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
   - **liste** : `listPageStep` en boucle tant qu'il y a une page suivante, dans la limite de pages de la version figée, sauf arrêt demandé, jeton remplacé ou source qui ne participe plus ;
   - **fiches** : `processBatchStep` en boucle jusqu'à épuisement des pistes, sauf arrêt, plafond ou source qui ne participe plus ;
   - `retryAfterMs` renvoyé par une étape : `await sleep(...)` (durée convertie au format du SDK, par exemple `"120s"`), puis même page ou même lot ; l'attente ne consomme rien ;
   - une source bloquée ou indisponible s'arrête seule : les autres continuent (plan technique §5).
4. **Étapes** `src/workflows/scan-steps.ts` (`"use step"`).
   - Entrées et sorties minuscules : identifiants, curseurs, compteurs. Le HTML ne transite jamais par le Workflow (données facturées au-delà de 1 Go par mois en Hobby).
   - Chaque étape revérifie le jeton du passage (`claim_token`) et s'arrête sans écrire s'il a été remplacé.
   - Chaque étape relit la définition de la version figée (`getScanSourceDefinition(key, { revision })`) et, avant de lire le réseau, l'état courant de la source : si `sourceParticipates(état, mode, { adapterAvailable })` est faux, la source passe `skipped` (« désactivée pendant le passage ») et l'étape rend la main sans lecture.

   **`claimRunStep(runId, token)`** :
   - `claimRun` (plan 03), avec l'identifiant Workflow ;
   - `listRunnableSources(run.mode)` puis `initRunSources(runId, keys, token)` : la version courante est figée à l'insertion. À la reprise, les lignes existantes gardent leur version ; une source nouvellement activée rejoint le passage (le plan 10 l'utilise pour une réserve). Les sources `done` sont sautées, les sources `blocked` restent bloquées pour ce passage ; les autres, `skipped` compris si la source participe de nouveau, reprennent leur curseur ;
   - aucune source à lire : le passage se termine aussitôt (`finishRunStep`) ;
   - renvoie les groupes de domaines (`planDomains`, pur) : sources regroupées par hôte de leur première liste (version figée), par vagues de trois domaines au plus.

   **`listPageStep(runId, token, sourceKey, cursor)`** :
   - une page de liste par l'adaptateur (`ListCursor`, recherches France Travail multiples comprises) ;
   - `recordListedPosting` pour chaque élément ; une annonce hors périmètre dès la liste est écartée sans lecture de sa fiche ;
   - curseur, compteurs (listées, requêtes, octets) et `robotsDigest` enregistrés dans `scan_run_sources` (`updateRunSource`) ;
   - renvoie `{ next, listed, stop, retryAfterMs }`.

   **`processBatchStep(runId, token, sourceKey)`**, budget de **120 s**. Tant que le budget et les pistes le permettent (`nextPistesToProcess`) :
   1. vérifier la demande d'arrêt ;
   2. respecter l'intervalle de politesse (`waitBeforeNextRequest`) ;
   3. lire la fiche (`readPosting`) ;
   4. extraction réussie :
      - `compareRecruitment` avec le dossier connu : même recrutement (rien de nouveau ; divergence s'il est déjà décidé, `recordCandidateDivergences`), ou autre période (`newGeneration`) ;
      - `admitPosting` (qui construit la proposition), entreprise proposée par le SIREN de la version figée pour une source employeur (SH15) ;
      - `findDuplicateSuspects` (plan 04), sous le jeton du passage (précondition) ; une source déjà saisie à la main donne `already_known` ;
      - puis, en une transaction courte : écarter (`excludeCandidate`) ; publier si `canAutoPublish` (`publishCandidate`, `kind: "scan"`, qui revérifie `sourceAutoPublishes`) ; sinon livrer (`deliverCandidate`, qui rattache aussi le métier), y compris quand la publication est refusée dans sa transaction ;
   5. fiche disparue (`gone`) : piste `failed` (« fiche introuvable »), non relue dans ce passage ;
   6. fiche illisible ou délai dépassé : `recordFailure`, réessai en fin de file, trois essais au plus ;
   7. refus d'accès (401, 403) ou robots.txt (`stopsSource`) : la source passe `blocked`, une revue `incident` est ouverte ou réutilisée (`groupKey` `source:<clé>:<motif>`), l'étape s'arrête pour cette source ;
   8. `rate_limited` : l'étape s'arrête et renvoie `retryAfterMs`, sans toucher à la piste.

   L'étape renvoie `{ processed, delivered, remaining, done, stop, retryAfterMs }`. Une exception (base indisponible) laisse le SDK réessayer l'étape (3 réessais par défaut) : les écritures conditionnées par statut la rendent idempotente.

   **`finishRunStep(runId, token)`** :
   - statut final par `finalRunStatus` (`completed`, `partial`, `stopped`) et `finishedAt` ;
   - dans la même transaction, **disjoncteur** `applyCircuitBreaker(tx, runId)` (contrat du lot E) : suspension, événement `suspended`, revue `incident` `source:<clé>:suspendue` ; la liste des sources suspendues est renvoyée pour le bilan ;
   - incidents regroupés par source et par nature (`scan_reviews`, `kind: "incident"`) ;
   - en passage quotidien, purge à 90 jours du texte et des observations des dossiers écartés, échoués ou rejetés (SH13) ;
   - email de bilan au fondateur (SH16), envoyé une seule fois : `reportSentAt` (plan 03) est posé par une mise à jour conditionnelle avant l'envoi, puis `scanRunReportEmail` (`src/lib/email/templates.ts`) part vers `ADMIN_NOTIFICATION_EMAIL`. Un passage quotidien sans dossier ni incident nouveau n'envoie rien. Un échec d'envoi est journalisé, jamais réessayé en boucle. Le bilan du remplissage initial dit si la cible est atteinte ; sinon, il invite à activer une source de réserve et à reprendre le passage. Il liste les sources suspendues.
5. **Déclenchement par l'admin** `src/server/scan/run-actions.ts` (`requireRole("admin")`, `revalidatePath("/admin/scan")`).
   - **`launchBootstrapScan()`** :
     - au moins une source à lire (`listRunnableSources("bootstrap")`) ;
     - `createBootstrapRun` ;
     - si le passage est créé : `start(scanWorkflow, [run.id, run.claimToken])` (`workflow/api`), puis `workflowRunId` enregistré ; l'action renvoie l'identifiant du passage dès que `start` l'a pris en charge, sans attendre la collecte (plan technique §5) ;
     - si `start` échoue : le passage reste `queued`, sans orchestration, et l'écran propose « Relancer » ;
     - passage déjà existant : message et lien vers lui ; jamais un second remplissage (SH3).
   - **`resumeScanRun(runId)`**, autorisée pour un passage `stopped`, `partial` ou `failed`, ou pour un passage actif dont l'orchestration est perdue : `getRun(workflowRunId).status` n'est plus actif, ou aucune progression depuis 15 minutes. Elle appelle `renewClaim` (nouveau jeton, `{ lostClaimToken }` pour un passage actif), puis `start`. L'ancien run, s'il vit encore, est écarté par son jeton. Échéance, compteur et décisions sont conservés.
   - **`stopScanRun(runId)`** : `requestStop`. Les étapes s'arrêtent à la fin de la piste en cours, le passage devient `stopped`, le travail restant est gardé pour « Reprendre ».
6. **Cron quotidien** `src/app/api/cron/scan/route.ts`, `GET`.
   - Secret vérifié comme pour `/api/cron/quotidien` (`safeEqual`, `Authorization: Bearer ${CRON_SECRET}`).
   - **Garde de créneau** `isDailyScanSlot(now)` (`src/domain/scan/schedule.ts`) : vrai s'il est 3 h à Paris. Hors créneau, réponse `{ skipped: "outside_slot" }`, sans rien enregistrer.
   - Puis `runScheduledJob("scan", …)` :
     - tâche désactivée : `{ skipped: "disabled" }` ;
     - aucune source à lire en quotidien : `no_source`, sans passage créé ;
     - passage actif : `run_in_progress` (SH2) ;
     - `createDailyRun(todayInParis(now))` : passage du jour déjà existant → `already_started`, ou `resumed` s'il est `queued` sans orchestration depuis plus de 10 minutes ;
     - sinon `start(...)` → `started` ; un échec de `start` → `start_failed`, et le passage reste visible pour une relance.
   - **`vercel.json`** : deux entrées, `{ "path": "/api/cron/scan", "schedule": "0 1 * * *" }` et `{ "path": "/api/cron/scan", "schedule": "0 2 * * *" }` (SH11). En Hobby, chacune part n'importe quand dans son heure ; la garde ne laisse passer que celle qui tombe à 3 h à Paris : 1 h UTC en été, 2 h UTC en hiver. Si Vercel refuse deux entrées pour un même chemin, deux chemins dédiés (`/api/cron/scan/creneau-1`, `/creneau-2`) appellent le même gestionnaire. Revérifier le nombre de crons permis par l'offre du compte.
   - Le cron `/api/cron/quotidien` existant n'est pas modifié. Les crons ne s'exécutent que sur la production : en preview, la route s'appelle à la main avec le secret.
7. **Écran `/admin/scan`**, qui complète la carte des sources (V2-01, lot B) et la file (plan 06).
   - Bouton « Lancer le premier remplissage » : désactivé sans source à lire ; remplacé par le passage une fois lancé.
   - **Carte du passage**, actualisée par l'API d'état (plan 06) :
     - mode, statut, début ;
     - échéance T+6 h et temps restant ;
     - « Dossiers livrés pour vérification : n / 50 » ;
     - « Seuil atteint à … (T+… ) » ;
     - premier dossier livré à … ;
     - stock à vérifier et annonces publiées, affichés à part.
   - Avancement par source : version lue, listées, lues, livrées, écartées, échecs, requêtes ; état bloqué ou « Non couverte » avec sa raison ; lien vers la fiche de la source et vers sa file (`/admin/scan/dossiers?source=<clé>`).
   - Boutons « Arrêter » et « Reprendre », selon le statut ; « Relancer » pour un passage sans orchestration.
   - Historique `/admin/scan/passages` (lien dans la navigation de `/admin/scan`) ; bilan `/admin/scan/passages/[id]` (`getRunReport`, plan 03) : livrés avant T+6 h, `targetReachedAt`, seuil confirmé, délai du premier dossier, exclusions et rejets par motif, doublons, échecs par source, sources suspendues, requêtes et octets, étapes exécutées, publications humaines et automatiques séparées.
8. **Lieux supplémentaires dans le formulaire employeur** (décision du 28/10) : liste en lecture seule et lien de contact, sous le champ du lieu ; aucune écriture nouvelle.
9. **Variables de test.**
   - `SCAN_TEST_SOURCE_URL` est déjà transmise au serveur de l'E2E (`e2e/helpers/env.ts`, port de l'E2E + 1) et active la source `fixture`.
   - `serverEnv()` ajoute les variables lues par `@workflow/world-local` 5.1.2, à revérifier : `WORKFLOW_LOCAL_DATA_DIR=.workflow-data-e2e` (stockage séparé de celui de `npm run dev`), `WORKFLOW_LOCAL_BASE_URL=http://localhost:3100` et `WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS=0`.
   - Aucune nouvelle variable de production.
10. **Source de test de l'E2E** : le serveur `scripts/scan-fixture-server.ts` (déjà lancé par Playwright avant `next dev`) gagne des routes de contrôle :
    - `GET /jobs/2` suspendue jusqu'à `POST /controle/liberer/2`, au plus 60 s, quand la suspension est demandée (`POST /controle/suspendre/2`) ;
    - `POST /controle/refuser` : 403 sur toutes les pages (source bloquée) ;
    - `POST /controle/reinitialiser`.

    Données fictives (`.example`) inchangées.
11. **Vitest** : un projet `workflow` (`src/**/*.wf.test.ts`, plugin `workflow()` de `@workflow/vitest`, migrations et sources du `globalSetup` d'intégration, fichiers en série). `npm run test:int` exécute `--project integration --project workflow`, et la CI ne change pas.
12. **`CLAUDE.md`** : orchestration (workflow, étapes, jeton, version figée, interrupteurs relus), commandes (`npx workflow web`, `npx workflow inspect runs` pour suivre les runs en local), cron du scan et sa garde, routes de contrôle du serveur de fixtures.

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
- proxy (`unstable_doesMiddlewareMatch` de `next/experimental/testing/server`) : `/.well-known/workflow/v1/flow` et `/.well-known/workflow/v1/step` ne passent pas par le proxy ; `/admin/scan` y passe ;
- troncature des précisions (`proposalFormIssues`) ; badge « Candidature externe » avec un domaine exclu.

**Intégration** (gestionnaire de la route appelé directement, horloge simulée, `start` simulé) :

- secret absent ou faux : 401 ;
- hors créneau : rien n'est enregistré ;
- tâche désactivée par défaut : rien ne démarre ;
- aucune source en passages quotidiens : `no_source`, aucun passage ;
- premier créneau du jour : un passage et un run ; second créneau, ou appel répété le même jour : `already_started` ;
- passage actif : `run_in_progress` ;
- `launchBootstrapScan` appelé deux fois en même temps : un seul passage, un seul `start` ;
- reprise après un échec : nouveau jeton, ancien jeton refusé ;
- `findDuplicateSuspects` sous un jeton remplacé : aucune écriture ; deux livraisons concurrentes : `readyForReviewAt` suit l'ordre de validation ;
- métier désactivé après la suggestion : la validation du dossier aboutit.

**Workflow** (`src/workflows/scan.wf.test.ts`, `@workflow/vitest`, base de test, serveur de fixtures démarré par le test) :

- « livraison progressive : le premier dossier est en base avant la fin du passage » ;
- « étape interrompue puis réessayée : compteur inchangé, décision de l'admin préservée » (espion qui lève une fois après la première livraison) ;
- « une source bloquée (403) : passage partiel, l'autre source livre ses dossiers » ;
- « trois passages bloqués : la source est suspendue en fin de passage, une revue incident est ouverte, le bilan la cite » ;
- « source désactivée pendant le passage : elle passe Non couverte à la fin de son lot, les autres continuent » ;
- « source modifiée pendant le passage : le passage garde la version figée » ;
- « arrêt demandé : passage arrêté ; la reprise ne relivre rien » ;
- « remplissage initial : aucun dossier publié automatiquement » ;
- « passage quotidien, source employeur autorisée : le dossier conforme est publié « Sourcée sur internet », le dossier douteux va en revue ; une découverte ne publie rien » ;
- « jeton remplacé : l'ancien workflow s'arrête sans écrire ».

**E2E** dans `e2e/scan-orchestration.spec.ts` :

- « Scan §6 — recette de livraison progressive » :
  1. l'admin lance le premier remplissage ;
  2. le dossier 1 apparaît pendant que la fiche 2 est suspendue ; il se valide ;
  3. l'admin ouvre un autre dossier et y saisit du texte ; la fiche 2 est libérée ; le dossier 2 arrive, la saisie est intacte ;
  4. après fermeture et réouverture de l'écran, le passage a continué, les dossiers et la décision sont retrouvés, et le compteur indique le nombre de dossiers livrés / 50 ;
- « Scan §3 — la route du scan refuse tout appel sans le secret » ;
- « Lieux multiples — l'employeur voit en lecture seule les lieux ajoutés par l'admin ».

## Critères d'acceptation

- [ ] Le workflow minimal et le scan fonctionnent en preview ; les runs sont visibles dans l'observabilité Vercel.
- [ ] Le lancement répond avec l'identifiant du passage sans attendre la collecte ; fermer l'écran n'arrête rien.
- [ ] Un double déclenchement ne crée ni second passage ni double publication ; une étape rejouée ne double aucun compte.
- [ ] Une source en échec n'empêche pas les autres ; arrêt et reprise conservent l'avancement et les décisions.
- [ ] Un passage lit la version figée de chaque source ; désactiver une source l'arrête à la fin de son lot ; le disjoncteur s'applique en fin de passage.
- [ ] Le cron ne démarre qu'un passage par jour, entre 3 h et 3 h 59 à Paris, et seulement si l'admin a activé la tâche.
- [ ] Les préconditions de la revue de la PR #37 sont levées.

## Hors périmètre

- Curseurs persistants d'un passage à l'autre, pagination exhaustive, cadence configurable par source (V2, V5).
- Écarts du lot G du plan V2-01 (détection d'un plan de site, JobAnim, demande de flux des job-boards, extraction Club Med) : plan suivant de la V2.
- Service temps réel payant, notifications push.
