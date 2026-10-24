# Plan scan 04 — Publication protégée, doublons et divergences

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 03 | 06, 07, 09 | M | plan technique §3, §5 (adaptations 1 et 2 ; exécution, reprises et limites), lot 3 ; cahier §5, §7 |

## Objectif

Un service de publication unique, transactionnel et rejouable, qui sert à la fois à la validation par l'admin et à la publication automatique des passages quotidiens. Corriger l'ingestion actuelle, qui republie sur conflit d'URL. Soumettre doublons potentiels et divergences à l'admin, sans fusion ni écrasement.

## Constats de départ

- `upsertCollectedOffer` (`src/server/offers/ingest.ts`) met à jour l'annonce qui a la même `sourceUrl`, la passe à `published` et efface `unpublishedAt` et `expiredAt` : une saisie peut remettre en ligne une annonce retirée par le fondateur.
- Elle fixe `seasonalContractConfirmed: true`. C'est justifié pour la saisie admin, dont le schéma exige la case « contrat saisonnier » ; ce ne l'est pas pour le scan.
- L'index `offers_collected_source_url_unique` interdit deux annonces collectées sur une même page, alors qu'une page peut porter plusieurs recrutements, ou une URL être réutilisée pour une autre saison.

## Étapes

1. **Offres : migration** (`drizzle/0011_scan_offers.sql`, puis une migration `--custom` pour les données).
   - Colonnes :
     - `sourcePublishedDate` (`date`), `sourcePublishedAt` (instant) : date de publication par l'employeur et sa précision ;
     - `firstDiscoveredAt` : première découverte par le scan ;
     - `humanVerifiedAt`, `humanVerifiedByUserId` : validation humaine de publication.
   - Le lien vers le dossier reste du côté du dossier (`scan_candidates.offerId`, unique, plan 03) : aucune référence circulaire entre les deux tables.
   - CHECK : `human_verified_at is null or origin = 'collected'` ; `source_published_at is null or source_published_date is not null`.
   - L'index unique sur `source_url` devient un index simple : la règle « une source, une annonce » passe dans le code (étape 2), avec des messages, sans migration qui fusionne ou supprime des annonces.
   - Données : les annonces collectées existantes ont été saisies par le fondateur ; elles reçoivent `human_verified_at = coalesce(published_at, created_at)`, sans auteur (SH8).
2. **Saisie au back-office** (`src/server/offers/ingest.ts`, `admin-actions.ts`).
   - `IngestActor` ne garde que l'admin : le scan a son propre service (étape 3).
   - **Création** : si une annonce collectée a déjà cette source (URL canonique, `canonicalUrl` du plan 02), refus `source_taken` (« Une annonce collectée a déjà cette source : modifiez-la plutôt »), avec un lien vers elle. Plus d'`onConflictDoUpdate`.
   - **Modification** (`offerId`) : le contenu et `sourceCheckedAt` changent ; `status`, `publishedAt`, `unpublishedAt` et `expiredAt` sont conservés. Une annonce hors ligne reste hors ligne ; « Republier » reste le seul chemin de remise en ligne (H18).
   - Quand plusieurs recrutements partagent déjà légitimement la même page, garder cette URL lors d'une modification reste autorisé. Le refus `source_taken` vise une création ou le déplacement vers la source d'une autre annonce, pas une correction du contenu avec une URL inchangée.
   - **Création par l'admin** : `humanVerifiedAt = now`, `humanVerifiedByUserId = admin`. Une modification ne touche pas ces colonnes.
   - Le commentaire de `seasonalContractConfirmed` dit pourquoi la valeur est vraie ici : la case est exigée par `adminOfferInputSchema`.
   - Mettre à jour `CLAUDE.md` (paragraphe « Back-office ») et les tests du plan 15 qui supposaient l'upsert.
3. **Service de publication** `src/server/scan/publication.ts` : `publishCandidate(request)`.
   - **Acteurs** :
     - `{ kind: "admin", userId, version, input }` : `input` est un `AdminOfferInput` déjà validé par `adminOfferInputSchema` (origine `collected` verrouillée) ;
     - `{ kind: "scan", runId, token }` : publication automatique ; les colonnes viennent de `proposalToOfferInput(proposal)` (pur, plan 02), qui ne reprend que les champs établis.
   - **Transaction** :
     1. verrouiller le dossier (`for update`) ;
     2. s'il est déjà `published`, renvoyer `{ ok: true, offerId, created: false }` : une étape rejouée constate la publication ;
     3. vérifier l'état : `to_review` et `version` identique pour l'admin ; `discovered` ou `failed` avec un jeton valide pour le scan ; sinon `conflict` ;
     4. recalculer `publicationReadiness` avec les valeurs à publier, les domaines exclus lus en base (`getBlockedDomains`) et les revues `duplicate` ouvertes, lues dans la transaction ; tout point bloquant refuse, et la réponse le nomme ;
     5. pour le scan, exiger `canAutoPublish` : mode quotidien, source autorisée, aucun point bloquant ;
     6. contrôles finaux : `checkPublicationMinimum` (origine `collected`), entreprise existante, hôte de `sourceUrl` dans les `officialHosts` d'une source employeur, aucune échéance passée (`expiryReason`). Pour une source de découverte telle que France Travail, seule la revue humaine peut attester une nouvelle URL officielle employeur ; l'hôte de découverte et les domaines exclus restent refusés. Aucun hôte n'est autorisé automatiquement pour une source de découverte ;
     7. insérer l'annonce : `origin = collected`, `status = published`, `publishedAt = now`, `sourceCheckedAt` (dernière lecture de la fiche), `sourcePublished*`, `firstDiscoveredAt = firstSeenAt` ; `humanVerifiedAt` et `humanVerifiedByUserId` pour l'admin ;
     8. passer le dossier à `published` avec `offerId`, `publicationKind`, `decidedAt` et `decidedByUserId`, et la version + 1.
   - **Concurrence** : le verrou `for update` du dossier sérialise deux validations simultanées. La seconde relit le dossier une fois la première validée, le trouve `published` et renvoie l'annonce existante. L'unicité de `scan_candidates.offer_id` garde la base cohérente si une écriture contournait ce chemin.
   - **Résultat** : `{ ok: true, offerId, created }` ou `{ ok: false, reason: "conflict" | "blocked", issues }`.
   - Les pages étant dynamiques, la fraîcheur ne dépend pas d'un cache ; les Server Actions appellent `revalidatePath` comme les autres mutations.
4. **Doublons potentiels** `src/server/scan/duplicates.ts`.
   - `findDuplicateSuspects(candidate, proposal)` cherche :
     - les annonces (tous statuts sauf `rejected`) et les dossiers livrés dont l'intitulé normalisé (`normalizeJobTitle`) et le département sont identiques, dont l'entreprise est la même ou inconnue, et dont la période recoupe la leur ou est inconnue ;
     - les annonces dont l'URL canonique de la source est celle du dossier.
   - Une annonce déjà liée à la même identité (saisie à la main, par exemple) rend la piste `already_known` : elle est écartée, avec le lien vers l'annonce, et ne compte pas.
   - Toute autre ressemblance crée ou réactive une revue `duplicate` ouverte. Son `groupKey` est formé des deux identifiants triés ; une décision déjà prise n'est jamais recréée.
   - `decideDuplicate(reviewId, decision, adminId, note)` :
     - `duplicate` : le dossier passe `rejected` (`rejectionReason = "duplicate"`) ; l'autre annonce ou l'autre dossier n'est pas modifié ;
     - `distinct` : la revue est close, la publication redevient possible.
   - Aucune fusion, aucune copie de champs d'une annonce vers l'autre (cahier §7). Une annonce **déposée** n'est jamais modifiée par le scan.
   - Après le plan 08, la comparaison de lieu prend en compte le lieu principal et les lieux supplémentaires de chaque annonce.
5. **Divergences** `recordDivergence(candidate, field, observed, current)`.
   - Une redécouverte d'un dossier publié, ou d'un dossier déjà décidé, dont une valeur établie a changé crée une revue `divergence` non bloquante : champ, valeur publiée, valeur observée, extrait.
   - Son `groupKey` (dossier, champ, empreinte de la valeur observée) empêche de la recréer chaque jour.
   - L'annonce n'est jamais mise à jour par le scan ; les corrections du fondateur sont préservées (cahier §7).
6. **Retraits.** Un dossier dont l'annonce est `unpublished`, `expired` ou `rejected` ne change pas d'état quand la piste revient. `publishCandidate` refuse tout dossier déjà lié à une annonce, même retirée.

## Tests

**Intégration** (`src/server/scan/publication.int.test.ts`, `duplicates.int.test.ts`, `src/server/offers/ingest.int.test.ts` mis à jour) :

- « deux validations simultanées d'un même dossier : une seule annonce » ;
- « étape rejouée après publication : la publication existante est constatée » ;
- « remplissage initial : publication automatique refusée, même pour un dossier complet » ;
- « passage quotidien, source non autorisée : le dossier reste en revue » ;
- « source hors des hôtes officiels : publication refusée » ;
- « dossier France Travail : publication humaine après établissement de la source employeur, job-boards refusés et aucune publication automatique » ;
- « doublon potentiel ouvert : publication refusée ; décision « distincts » : publication possible » ;
- « doublon confirmé : le dossier est rejeté, l'autre annonce n'est pas modifiée » ;
- « recrutement déjà déposé dans l'application : rapprochement soumis, annonce déposée intacte » ;
- « même employeur et même métier, périodes disjointes : aucun doublon signalé » ;
- « annonce retirée par le fondateur, piste redécouverte : aucune remise en ligne » ;
- « divergence sur une annonce publiée : signalée une fois, annonce inchangée » ;
- « saisie admin d'une source déjà utilisée : refusée, rien n'est modifié » ;
- « modification admin d'une annonce collectée hors ligne : elle reste hors ligne » ;
- « annonce collectée saisie par l'admin : vérifiée par un humain, datée ».

**E2E** : `e2e/back-office.spec.ts` passe toujours, messages mis à jour si besoin.

## Critères d'acceptation

- [x] Un dossier donne au plus une annonce, quelles que soient la concurrence et les reprises.
- [x] Aucune remise en ligne et aucune modification silencieuse d'une annonce existante, déposée ou collectée.
- [x] Les doublons potentiels attendent la décision de l'admin ; aucune fusion automatique.
- [x] La saisie au back-office fonctionne toujours et protège les statuts.

Vérification du 24 octobre 2026 : `lint`, `typecheck`, 852 tests unitaires, 292 tests d'intégration (dont les contrôles SQL ajoutés), `db:check` et les 11 tests E2E du back-office (ordinateur et mobile). Les scénarios de publication, doublons et divergences sont dans `publication.int.test.ts` et `duplicates.int.test.ts` ; les protections de saisie dans `ingest.int.test.ts`.

Audit final des plans 04 à 08 : le test d'un dossier France Travail complété par un admin a d'abord reproduit un blocage systématique de source officielle. Le correctif distingue l'attestation humaine d'une source employeur et les hôtes du registre utilisés automatiquement ; les 19 tests de publication passent, dont quatre scénarios France Travail.

Les tests complémentaires de revue de la PR 37 ont également reproduit puis vérifié deux corrections : modifier une annonce dont la page source est partagée et rapprocher un dossier sur un lieu supplémentaire d'une annonce existante. Les 41 tests ciblés de publication, ingestion, doublons et revue passent ensemble.

## Hors périmètre

- Écrans de décision (plan 06), labels affichés aux candidats (plan 07).
- Fusion assistée de deux annonces, application d'une divergence à l'annonce (cron de contrôle séparé).
