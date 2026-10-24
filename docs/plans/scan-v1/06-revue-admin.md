# Plan scan 06 — Revue admin, préremplissage et suggestions de métiers

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 04 | 09, 10 | L | plan technique §4 (écran `/admin/scan`), §5 (collecte et revue indépendantes, points 3 à 5), lot 5 ; cahier §2, §5 (suggestions), §9 |

## Objectif

Donner à l'admin :

- la file « À vérifier », actualisée toutes les 5 secondes pendant un passage ;
- la revue d'un dossier, avec ses preuves et ses manques, dans le formulaire d'annonce existant prérempli ;
- les décisions : valider et publier, rejeter, trancher un doublon ;
- les suggestions de métiers, traitées une fois pour toutes.

Une nouvelle arrivée ne remplace jamais le dossier ouvert, ne déplace pas la sélection et ne réinitialise pas une saisie en cours.

**Décision du fondateur pendant l'implémentation, le 24 octobre 2026 :** été/hiver devient facultatif pour la publication. La nature explicitement saisonnière du contrat reste obligatoire. Une saison absente ou contradictoire reste une alerte ; `offers.season` accepte `NULL`, sans valeur inventée. La migration `0014_optional_season.sql` applique ce choix au scan et aux formulaires existants. Cette décision remplace l'exigence antérieure d'été/hiver dans le minimum.

## Étapes

1. **Pages**, sous le layout admin (`requireRole("admin")`) :
   - `/admin/scan` : tableau de bord du scan (sources du plan 01 ; passage et compteur, complétés au plan 09) ;
   - `/admin/scan/dossiers` : layout à deux colonnes (file, dossier ouvert) ;
   - `/admin/scan/dossiers/[id]` : revue d'un dossier ;
   - `/admin/scan/suggestions` : suggestions de métiers.

   Les titres d'en-tête se déclarent dans `src/config/navigation.ts`. `src/app/robots.ts` exclut déjà `/admin` et `/api/` : rien à y ajouter.
2. **API d'état** `src/app/api/admin/scan/etat/route.ts`, `GET`.
   - `authorizeRoute("admin")` : 401 ou 403 sans redirection.
   - Paramètres : `apres` (curseur `readyForReviewAt|id`), `limite` (50 au plus).
   - Réponse `ScanSnapshot` :
     - `run` : passage actif, sinon dernier passage (mode, statut, début, échéance, livrés, cible, `targetReachedAt`, avancement par source), ou `null` ;
     - `counts` : à vérifier, publiés, rejetés, écartés, doublons ouverts, suggestions ouvertes ;
     - `items` : dossiers à vérifier, du plus ancien au plus récent (intitulé, entreprise proposée, lieu, source, `readyForReviewAt`, nombre de points bloquants et d'alertes) ;
     - `nextCursor`.
   - Ni coordonnées, ni texte de page. En-tête `Cache-Control: no-store` ; une lecture SQL bornée, sans cache.
3. **File** `src/components/admin/scan/scan-queue.tsx` (client) et hook `useScanSnapshot({ initial })`.
   - **Rythme** : actualisation toutes les **5 s** tant que l'onglet est visible (`document.visibilityState`) et qu'un passage est actif ; actualisation immédiate au retour sur l'écran (`visibilitychange`, `focus`) ; sans passage actif, aucune actualisation périodique.
   - **Requêtes** : `fetch(…, { cache: "no-store" })`, un `AbortController` par requête, jamais deux à la fois.
   - **Échec** : la file et la saisie restent ; le message « Actualisation interrompue — nouvel essai dans N s » s'affiche ; attente de 5, 10, 20, 40 puis 60 s, retour au rythme normal dès qu'une réponse arrive.
   - **Fusion** (`mergeQueueItems`, pure et testée) : les dossiers déjà affichés gardent leur place ; les nouveaux s'ajoutent à la suite ; un dossier traité ailleurs disparaît de la liste, sauf s'il est ouvert : il reste alors affiché avec son nouveau statut.
   - **Annonces** : `aria-live="polite"` sur le compteur (« 2 nouveaux dossiers »). File vide pendant un passage : « Recherche en cours… » ; fin du passage : « Passage terminé le … », présentée à part.
   - La file ne déclenche jamais `router.refresh()` : le formulaire ouvert ne reçoit aucune nouvelle prop.
   - **Mobile** (375 px) : la liste seule sur `/admin/scan/dossiers`, le dossier seul sur `/[id]` (`useSelectedLayoutSegment()`), avec un lien de retour.
4. **Revue d'un dossier** `/admin/scan/dossiers/[id]`. Le serveur charge `getCandidateForReview(id)`, les référentiels (`getOfferFormReferentials`), les entreprises (`listCompanyOptions`) et les revues ouvertes du dossier.
   - **En-tête** : intitulé, source ; liens de découverte et officiel (`target="_blank" rel="noopener noreferrer nofollow"`, `http(s)` seulement) ; dates (« publiée par la source le … » ou « date de publication inconnue », « découverte le … », « fiche consultée le … ») ; passage et statut.
   - **« À vérifier avant publication »** (points bloquants) et **« Alertes »** (non bloquantes), avec les libellés de `scanIssueCodes`.
   - **« Preuves »** : observations groupées par champ (extrait, origine : JSON-LD, libellé, texte, liste), puis le texte utile (`whitespace-pre-line`, jamais de HTML).
   - **« Doublons potentiels »** : annonces ou dossiers rapprochés, avec un lien, et deux boutons : « Ce sont deux recrutements distincts » et « Doublon : rejeter ce dossier ».
   - **Formulaire** : `OfferForm space="admin" mode="review"`, prérempli par `proposalToAdminFormValues` (étape 6). Origine `collected` verrouillée ; `sourceUrl` = URL officielle ; `sourceName` = libellé de la source.
   - **Actions** : « Valider et publier » (envoi du formulaire), « Rejeter » (motif choisi parmi `rejectionReasons`, note facultative, confirmation dans un `Dialog`), « Dossier suivant » (lien, sans décision).
5. **`OfferForm`** reçoit `mode: "review"` : libellé « Valider et publier », toast « Annonce publiée — vérifiée par un humain », puis navigation vers le dossier suivant renvoyé par l'action (ou vers la file). Les autres modes ne changent pas.
6. **Préremplissage** `src/domain/scan/proposal-form.ts` : `proposalToAdminFormValues(proposal, { companyId })`, pur.
   - Un champ `established` donne sa valeur ; `to_verify`, `contradictory` et `absent` laissent le champ vide, ou « Non précisé » pour un tri-état.
   - La case « contrat saisonnier » n'est cochée que si le contrat est explicite ; sinon, l'admin la coche lui-même, en connaissance de cause.
   - Période : dates ou durée selon la proposition ; salaire seulement avec sa base ; précisions (logement, repas, permis…) reprises des règles du plan 02 ; `applyUrl` = formulaire officiel.
   - Textes : intitulé (150 caractères), description (5 000) et missions (3 000) coupés à une fin de phrase, avec l'alerte `text_truncated`. Le texte intégral reste dans les preuves et n'est pas publié (cahier §4).
7. **Server Actions** `src/server/scan/review-actions.ts`, toutes en `requireRole("admin")`.
   - `validateScanCandidate(candidateId, version, values)` :
     - validation par `adminOfferInputSchema(offerInputContext(referentials, today))`, origine `collected` imposée ;
     - puis `publishCandidate({ kind: "admin", … })` (plan 04) ;
     - erreurs par champ, ou message qui nomme les points bloquants ;
     - `revalidatePath("/admin", "layout")` et `revalidatePath("/offres", "layout")` ;
     - renvoie `{ ok, offerId, next }`.
   - `rejectScanCandidate(candidateId, version, reason, note)` : `to_review` → `rejected` en une transaction (`decidedAt`, `decidedByUserId`, version + 1) ; ses revues `duplicate` ouvertes sont closes.
   - `decideDuplicateAction(reviewId, decision, note)` : appelle `decideDuplicate` (plan 04).
   - Version différente (dossier traité ou modifié entre-temps) : « Ce dossier a changé depuis son ouverture : rechargez la page ». Le formulaire garde sa saisie.
8. **Suggestions de métiers.**
   - **Table** `occupation_aliases` : `normalizedLabel` (clé primaire), `occupationId`, `createdByUserId`, `createdAt`. Migration ; ce n'est pas un référentiel inséré par migration (`REFERENCE_TABLES` inchangé).
   - **Rattachement à la livraison** (`attachOccupation`, appelé par le plan 09) : un alias exact de l'intitulé normalisé, ou un métier actif de même libellé normalisé, préremplit `occupationId`. Rien d'autre : aucun rapprochement approximatif (plan technique §5, « Référentiel »).
   - **Suggestion** : sans rattachement, revue `occupation` de `groupKey = "occupation:" + normalizeJobTitle(title)`, créée ou réutilisée (`occurrences + 1`, `lastSeenAt`) et reliée par `scan_candidates.occupationReviewId`. Une suggestion close n'est pas rouverte pour le même intitulé normalisé.
   - **Page** `/admin/scan/suggestions` : suggestions ouvertes (intitulé d'origine, occurrences, contexte, liens vers les dossiers et les annonces concernés).
   - **Décisions** :
     - « Rattacher à un métier existant » : sélecteur des métiers actifs ;
     - « Créer le métier » : formulaire `occupationSchema` (intitulé ; famille existante ou nouvelle), puis `addOccupation` ;
     - « Rejeter ».

     Rattacher ou créer : l'alias est enregistré ; `occupationId` est posé sur les annonces publiées concernées dont le métier est vide, et sur les propositions des dossiers en attente. Un rejet ne revient jamais.
   - Une décision sur une suggestion ne touche ni `humanVerifiedAt`, ni le statut d'une annonce (cahier §5).
9. **Accessibilité** : libellés explicites, focus rendu au déclencheur après un `Dialog`, cibles tactiles suffisantes.

## Tests

**Unitaires** :

- `proposalToAdminFormValues` : aucune valeur sans preuve ; case « contrat saisonnier » non cochée pour un CDD seul ; troncature à une fin de phrase ;
- `mergeQueueItems` : ordre conservé, nouveaux à la suite, dossier ouvert maintenu ;
- calendrier d'attente après échec.

**Intégration** :

- `validateScanCandidate` : minimum manquant (refus, messages par champ) ; hôte non officiel (refus) ; succès (annonce publiée, `humanVerifiedAt` renseigné, dossier `published`) ;
- `rejectScanCandidate` : version périmée refusée ;
- suggestions : créée une fois, réutilisée ensuite ; « rattacher » met à jour les annonces concernées et crée l'alias ; un rejet n'est jamais recréé ; aucune décision ne pose `humanVerifiedAt`.

**E2E** dans `e2e/scan-revue.spec.ts` (dossiers insérés par `e2e/helpers/scan.ts`, passage `running`) :

- « Scan §2 — un dossier livré pendant un passage apparaît au rafraîchissement suivant et se valide aussitôt » ;
- « Scan §2 — une nouvelle arrivée ne remplace pas le dossier ouvert ni la saisie en cours » : saisir dans « Description », insérer un dossier, attendre son apparition, vérifier le texte saisi ;
- « Scan §5 — une information obligatoire absente bloque la validation » ;
- « Scan §5 — un métier inconnu crée une suggestion, sans bloquer la publication » ;
- « Scan §5 — une suggestion rejetée ne revient pas » ;
- « Scan §7 — un doublon potentiel attend la décision de l'admin » ;
- « Scan §7 — valider sans rien modifier : « Vérifiée par un humain » » ;
- « Scan §9 — l'API d'état est réservée à l'admin » (401 sans session, 403 pour un candidat) ;
- « Scan §10 — fermer puis rouvrir la file retrouve les dossiers et leurs décisions ».

## Critères d'acceptation

- [x] Un dossier livré est visible au plus 5 s plus tard (écran visible) et se traite pendant que le passage continue.
- [x] Une arrivée ne déplace ni ne réinitialise le dossier ouvert ; un échec d'actualisation est signalé et ne perd rien.
- [x] Une validation publie par `publishCandidate`, avec le label humain ; une donnée obligatoire absente la bloque ; un métier inconnu ne la bloque pas.
- [x] Une suggestion traitée n'est jamais recréée ; la décision est conservée.

Vérification du 24 octobre 2026 : `lint`, `typecheck`, 902 tests unitaires, 301 tests d'intégration, `db:check`, 23 tests E2E de revue et de back-office (ordinateur et mobile). La cadence de 5 s est mesurée depuis le début de la requête précédente et aucune seconde lecture ne part tant que la première n'est pas terminée. Le cas de saisie mobile vérifie aussi que les champs attendent l'initialisation de React Hook Form avant d'être éditables.

## Hors périmètre

- Brouillon de revue, actions groupées, preuve surlignée dans la page source (V4).
- Lancement, arrêt et reprise d'un passage (plan 09).
