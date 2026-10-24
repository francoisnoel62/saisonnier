# Plan scan 03 — Données du scan : sources, passages et dossiers

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 02 | 04, 06, 09 | M | plan technique §5 (données à ajouter ; exécution, reprises et limites), lot 2 ; cahier §3, §7, §9 |

## Objectif

Créer les tables du scan et les écritures dont dépendent la revue et l'orchestration :

- un remplissage initial unique, un passage quotidien par jour, un seul passage actif ;
- un bail (jeton) qui écarte un ancien workflow après une reprise ;
- l'enregistrement des pistes et la livraison d'un dossier par une transaction courte ;
- un compteur cumulé idempotent et un seuil horodaté une seule fois.

Les invariants sont des contraintes en base, commentées dans le schéma, comme pour les offres.

## Étapes

1. **Schéma** `src/lib/db/schema/scan.ts`, exporté par `schema/index.ts`. Valeurs des enums : `src/domain/scan/vocabulary.ts` (plan 02).

   **`scan_sources`** : état des sources du registre, une ligne par clé, créée au premier changement. Sans ligne, la source est désactivée (SH1).
   - `key` (clé primaire, clé du registre), `enabled` (faux par défaut), `autoPublish` (faux par défaut), `updatedByUserId`, `timestamps`.

   **`scan_runs`** : un passage.
   - `id`, `mode`, `runKey` (unique : `bootstrap` ou `daily:AAAA-MM-JJ`, jour de Paris), `status` (`queued` par défaut), `trigger` (`admin` / `cron`), `requestedByUserId`.
   - `claimToken` (uuid) : seul le workflow porteur de ce jeton écrit dans le passage. `workflowRunId` : identifiant du run Workflow, pour l'observabilité.
   - `startedAt` (T0), `deadlineAt` (T0 + 6 h, mode initial), `windowStart` (T0 − 72 h, quotidien), `targetCount` (50, mode initial).
   - `deliveredCount` (0), `firstDeliveredAt`, `targetReachedAt`, `stopRequestedAt`, `lastProgressAt`, `finishedAt`, `reportSentAt` (email de bilan, envoyé une fois, plan 09), `timestamps`.
   - **CHECK** :
     - `mode = 'bootstrap'` si et seulement si `deadlineAt` et `targetCount` sont renseignés, `runKey = 'bootstrap'` et `windowStart` vide ;
     - `mode = 'daily'` si et seulement si `windowStart` est renseigné et `runKey` commence par `daily:` ;
     - `finishedAt` renseigné si et seulement si le statut est terminal (`stopped`, `completed`, `partial`, `failed`) ;
     - `targetReachedAt` vide sans `targetCount` ; `deliveredCount ≥ 0`.
   - **Index unique partiel** `scan_runs_single_active` sur une expression constante, `where status in ('queued', 'running', 'stopping')` : un seul passage actif (SH2).

   **`scan_run_sources`** : avancement d'une source dans un passage.
   - Clé primaire (`runId`, `sourceKey`), `status`, `cursor` (jsonb : page de liste suivante).
   - Compteurs : `listedCount`, `fetchedCount`, `deliveredCount`, `excludedCount`, `failedCount`, `requestCount`, `bytesDownloaded`.
   - `lastRequestAt` (politesse entre deux étapes), `lastError`, `startedAt`, `finishedAt`.

   **`scan_candidates`** : piste, puis dossier.
   - Identité : `id`, `sourceKey`, `identityKey`, `generation` (1 par défaut) ; **unique** (`sourceKey`, `identityKey`, `generation`). `externalId`, `discoveryUrl`, `officialUrl`.
   - État : `status` (`discovered` par défaut), `exclusionReason`, `exclusionDetail`, `rejectionReason`, `reviewNote`, `attempts`, `lastError`, `version` (1 par défaut).
   - Dates : `firstSeenAt`, `lastSeenAt`, `lastFetchedAt`, `sourcePublishedDate` (`date`), `sourcePublishedAt` (instant, seulement si la source donne l'heure).
   - Passages : `firstRunId`, `deliveredRunId`, `readyForReviewAt`.
   - Contenu : `title`, `pageText` (texte brut, jamais de HTML), `observations`, `proposal`, `issues`, `signals` (jsonb), `listingHash`, `contentHash`, `extractorVersion`.
   - Décision : `offerId` (unique), `publicationKind`, `occupationReviewId`, `decidedAt`, `decidedByUserId`, `timestamps`.
   - **CHECK** :
     - `(status = 'excluded') = (exclusionReason is not null)` ; `(status = 'rejected') = (rejectionReason is not null)` ;
     - `status <> 'to_review' or readyForReviewAt is not null` ; un dossier livré a un `title` ;
     - `(status = 'published') = (offerId is not null)` ; `(offerId is null) = (publicationKind is null)` ;
     - `sourcePublishedAt is null or sourcePublishedDate is not null` ;
     - `char_length(pageText) <= 20000` ; `jsonb_array_length(observations) <= 200` ; `generation >= 1` ; `version >= 1`.
   - **Index** : (`status`, `readyForReviewAt`, `id`) pour la file ; `deliveredRunId` ; (`sourceKey`, `status`).
   - `offerId` référence `offers` en `on delete restrict` : une annonce issue du scan ne disparaît pas sans son dossier.

   **`scan_reviews`** : élément de revue autre que le dossier lui-même.
   - `id`, `kind`, `groupKey` ; **unique** (`kind`, `groupKey`) : une même suggestion, un même doublon ou une même panne n'apparaissent qu'une fois.
   - `status` (`open` par défaut), `candidateId`, `otherCandidateId`, `offerId`, `sourceKey`.
   - `details` (jsonb : intitulé source, champ, valeurs observées, extraits, erreur), `decision` (jsonb), `decidedAt`, `decidedByUserId`, `occurrences` (1), `lastSeenAt`, `timestamps`.
   - **CHECK** :
     - `(status = 'open') = (decidedAt is null)` ;
     - `duplicate` : `candidateId` et (`otherCandidateId` ou `offerId`) ;
     - `divergence` : `candidateId` ;
     - `incident` : `sourceKey`.
2. **Migration** : `npm run db:generate` → `drizzle/0010_scan.sql`. Aucune donnée insérée : les sources ne sont pas un référentiel (`REFERENCE_TABLES` inchangé).
3. **État des sources** `src/server/scan/sources/state.ts`.
   - `listScanSources()` : registre et état fusionnés, désactivée sans ligne.
   - `setScanSourceEnabled(key, enabled, adminId)`, `setScanSourceAutoPublish(key, enabled, adminId)` : clé inconnue du registre refusée.
   - Server Actions dans `src/server/scan/actions.ts` (`requireRole("admin")`, `revalidatePath("/admin/scan")`).
   - Deux interrupteurs par ligne dans la carte « Sources du scan » du plan 01 : « Activée » et « Publication automatique (passages quotidiens) ». Le second rappelle que le remplissage initial ne publie jamais.
4. **Passages** `src/server/scan/runs.ts`.
   - `createBootstrapRun({ requestedBy, now })` : `runKey = "bootstrap"`, `deadlineAt = now + 6 h`, `targetCount = 50`, nouveau jeton. Renvoie `{ created: true, run }`, `{ created: false, run }` si le remplissage initial existe déjà, ou `{ ok: false, reason: "run_in_progress" }` sur l'index du passage actif.
   - `createDailyRun({ date, now, trigger })` : `runKey = "daily:" + date`, `windowStart = now − 72 h`. Mêmes résultats.
   - `claimRun(runId, token, workflowRunId, now)` : `update … set status = 'running', workflow_run_id = …, last_progress_at = now where id = … and claim_token = … and status in ('queued', 'running')`. Sans ligne modifiée : `superseded`.
   - `renewClaim(runId, now)` (reprise, plan 09) : nouveau jeton, `status = 'queued'`, `stopRequestedAt` effacé ; autorisé depuis `stopped`, `partial`, `failed`, ou depuis un passage actif dont l'orchestration est perdue. L'échéance, le compteur et `targetReachedAt` ne bougent pas.
   - `requestStop(runId, now)`, `markProgress(runId, token, now)`, `finishRun(runId, token, status, now)`.
   - Règle pure `finalRunStatus(sources, { stopRequested })` dans `src/domain/scan/run.ts` : `stopped` si un arrêt a été demandé ; `partial` si une source a échoué, a été bloquée ou n'a pas été couverte ; `completed` sinon.
5. **Avancement par source** `src/server/scan/run-sources.ts` : `initRunSources(runId, keys)` ; `updateRunSource(runId, key, token, patch)`, où les compteurs s'incrémentent en SQL (`count = count + n`) ; `waitBeforeNextRequest(runId, key, interval)`, qui calcule l'attente depuis `lastRequestAt`.
6. **Pistes et dossiers** `src/server/scan/candidates.ts`. Toutes les écritures portent sur des statuts précis : rejouées, elles ne font rien.
   - `recordListedPosting(runId, token, sourceKey, listed)` : insertion en `discovered` (`firstRunId`, `listingHash`), ou mise à jour de `lastSeenAt` seul pour une piste connue. Renvoie `new`, `rediscovered`, `listing_changed` ou `skip_excluded` : une piste écartée ou échouée définitivement n'est pas relue tant que son élément de liste ne change pas.
   - `nextPistesToProcess(runId, sourceKey, limit)` : pistes `discovered`, et `failed` sous le plafond d'essais, par `firstSeenAt`.
   - `deliverCandidate({ candidateId, runId, token, extraction, admission, proposal, now })`, en une transaction courte :
     1. `select … from scan_runs where id = $run and claim_token = $token for update` ; sans ligne, le jeton est remplacé : rien n'est écrit ;
     2. `update scan_candidates set status = 'to_review', ready_for_review_at = now, delivered_run_id = $run, title, page_text, observations, proposal, issues, signals, source_published_*, content_hash, extractor_version, last_fetched_at where id = $c and status in ('discovered', 'failed') returning id` ;
     3. si une ligne est modifiée : `delivered_count + 1`, `first_delivered_at = coalesce(first_delivered_at, now)`, `target_reached_at` posé si le nouveau cumul atteint `target_count` et qu'il était vide, `last_progress_at = now`, compteur de la source + 1. Sinon (étape rejouée), rien.
   - `excludeCandidate(...)` (depuis `discovered` ou `failed`), `recordFailure(candidateId, error)` (`attempts + 1`, `failed` au plafond).
   - `newGeneration(candidateId, …)` : quand `compareRecruitment` répond `other_period`, une nouvelle génération du même `identityKey`, livrée avec le point `reused_identity`.
   - Plafonds de SH13 appliqués à l'écriture (`boundText`, `boundObservations`).
7. **Lectures pour l'admin** `src/server/scan/queries.ts`.
   - `getActiveRun()`, `listRuns(limit)`, `getRunState(runId)` (passage et avancement par source).
   - `getRunReport(runId)` :
     - nombre de dossiers par statut, exclusions et rejets par motif ;
     - dossiers livrés avant l'échéance, `targetReachedAt` ;
     - **seuil confirmé** : instant de la 50e livraison dont le dossier n'a pas été rejeté pour un motif d'admission (SH5) ;
     - premier dossier livré et délai depuis T0 ;
     - par source : listées, lues, livrées, écartées, échecs, requêtes, octets ;
     - publications issues du passage, humaines et automatiques séparées.
8. **E2E** `e2e/helpers/scan.ts` :
   - `resetScan(db)` : suppression des lignes des tables `scan_*` (revues, avancement, dossiers, passages, état des sources). Pas de `truncate … cascade` : à partir du plan 04, les dossiers référencent des offres, qui seraient vidées aussi. Les annonces publiées par un test restent, avec leur intitulé propre au test ;
   - `insertScanRun(db, values)`, `insertScanCandidate(db, values)` (données fictives), `enableScanSource(db, key, { autoPublish })`.
9. **`CLAUDE.md`** : section « Scan » : tables, écritures idempotentes par statut, jeton de passage, compteur, nettoyage E2E.

## Tests

**Intégration** (`src/server/scan/runs.int.test.ts`, `candidates.int.test.ts`) :

- « un seul remplissage initial : un second lancement renvoie le passage existant » ;
- « un seul passage actif : un passage quotidien pendant le remplissage initial est refusé » ;
- « un passage quotidien par jour de Paris » ;
- « reprise : l'ancien jeton n'écrit plus rien ; échéance et compteur conservés » ;
- « livraison rejouée : compteur inchangé » ;
- « 50e livraison : seuil horodaté une fois ; la 51e ne le modifie pas » ;
- « 60 livraisons concurrentes (`Promise.all`) : compteur exact, seuil posé une fois » ;
- « redécouverte : même dossier, `lastSeenAt` à jour, aucune livraison nouvelle » ;
- « piste écartée : non relue tant que son élément de liste ne change pas » ;
- « même identifiant, autre période : nouvelle génération, point `reused_identity` » ;
- « dossier rejeté pour un motif d'admission : toujours compté ; le seuil confirmé l'exclut » ;
- les contraintes CHECK refusent les combinaisons incohérentes (statut et motif, mode et échéance).

## Critères d'acceptation

- [x] Un seul remplissage initial, un seul passage actif, un passage quotidien par jour : la base les garantit.
- [x] Une livraison est une transaction courte et idempotente ; le compteur ne double jamais ; `targetReachedAt` n'est posé qu'une fois.
- [x] Un workflow dont le jeton a été remplacé n'écrit plus rien.
- [x] Les volumes stockés par dossier sont bornés.

## Hors périmètre

- Publication et doublons (plan 04), écrans de revue (plan 06), orchestration (plan 09).
- Historique d'activation des sources, gestion des sources dans l'admin (V2).
