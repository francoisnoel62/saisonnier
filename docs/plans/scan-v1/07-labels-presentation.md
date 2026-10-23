# Plan scan 07 — Labels, candidature externe, dates et champs « à confirmer »

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 04 | 08, 10 | M | cahier §3 (dates), §5 (compléments, contradictions, « Divers »), §6 (canal, badge), §7 (labels, dates) ; plan technique §3, §5 (adaptation 3), lot 6 |

## Objectif

Présenter honnêtement, sur la carte comme sur la fiche :

- la **provenance** et la validation de l'annonce ;
- le **mode de candidature** (« Candidature externe ») ;
- la **nouveauté** (publication par l'employeur, ou découverte) ;
- la **certitude** des informations facultatives (« À confirmer »).

Les filtres restent justes : une information à confirmer ne satisfait aucun critère. Aucune coordonnée ne quitte le serveur hors des règles actuelles (H3).

## Étapes

1. **Règles** `src/domain/offer-labels.ts`, pures et testées.
   - `provenanceOf(offer)` renvoie `human_verified`, `sourced`, `verified_recruiter` ou `deposited` (SH8) :
     - collectée, avec `humanVerifiedAt` : « Vérifiée par un humain » ;
     - collectée, sans : « Sourcée sur internet » ;
     - déposée depuis un compte employeur : « Recruteur vérifié » ;
     - déposée autrement (saisie du fondateur, compte supprimé) : « Déposée par l'employeur ».
   - `isExternalApplication(offer)` : canal `employer`, ni email ni téléphone, un lien officiel.
   - `newnessOf(offer)` : `{ kind: "employer", date, precision }` si la source a donné sa date de publication, sinon `{ kind: "discovered", date }` pour une annonce issue du scan, sinon `{ kind: "platform", date: publishedAt }`.
   - Les libellés vivent avec les règles (`provenanceLabels`), à la place de `originLabels` sur la carte.
2. **Données transmises au navigateur.**
   - `OfferListItem` (`src/server/search/search-offers.ts`) gagne `provenance`, `externalApplication` (booléen) et `newness`.
   - Le serveur lit les colonnes utiles (canal, présence d'un email, d'un téléphone, d'un lien ; rôle du déposant par jointure sur `user`) et ne transmet que ces valeurs dérivées, jamais les coordonnées. Mêmes ajouts pour `toOfferDetailsData` (fiche) et pour « Mes offres », qui réutilise `offerListColumns`.
3. **Carte** `OfferCard`.
   - Badge de provenance (contour) ; « Candidature externe », badge coloré avec l'icône `ExternalLinkIcon`, visible avant toute ouverture du formulaire (cahier §6).
   - Ligne de date : « Publiée par l'employeur le … », « Découverte le … » ou « Publiée le … ».
4. **Fiche** `/offres/[id]`.
   - `OfferProvenance`, réécrite pour les quatre cas :
     - « Annonce reprise du site officiel de X, vérifiée par l'équipe le … » ;
     - « Annonce sourcée sur internet depuis le site officiel de X, sans vérification humaine » ;
     - « Annonce déposée par un recruteur vérifié » ;
     - « Annonce déposée par l'employeur ».

     Puis la date de nouveauté et « source consultée le … ». Le lien « Vous êtes l'employeur ? » est conservé pour les annonces collectées.
   - **« Candidature externe »** : badge en tête de fiche et dans `ApplicationPanel`, avec l'explication « La candidature se fait sur le formulaire officiel de l'employeur ». Les coordonnées restent réservées au dossier complet (`getApplicationDetails`).
   - Le badge est indépendant des labels de provenance (cahier §6) : une annonce peut être « Vérifiée par un humain » et « Candidature externe ».
5. **Tri par nouveauté** (`searchOffers`).
   - Ordre : `coalesce(source_published_date, (published_at at time zone 'Europe/Paris')::date) desc`, puis `coalesce(source_published_at, published_at) desc`, puis `id`.
   - Le jour d'abord, sans heure inventée ; une offre ancienne reprise au remplissage initial ne passe pas devant les annonces du jour (cahier §3).
   - L'ordre des annonces déposées est inchangé (H18).
6. **« À confirmer »** (SH7).
   - Migration : `fields_to_confirm text[] not null default '{}'`.
   - CHECK : valeurs prises dans la liste des champs confirmables. Un champ listé a sa valeur neutre :
     - `salary` : les six colonnes de salaire vides ;
     - `housing`, `meals`, `experience`, `driving_license`, `couples`, `pets` : `unknown` ;
     - `languages` : `languages_required = 'unknown'` ;
     - `work_time` : `unknown`.
   - Règles `src/domain/field-certainty.ts` : `confirmableFields` (et libellés), `isToConfirm(offer, field)`, `establishFields(input, flags)`, qui retire la mention d'un champ qui a reçu une valeur.
   - **Affichage** : `InfoValue` reçoit `toConfirm`, qui affiche « À confirmer » (atténué, avec icône) au lieu de « Non précisé » ; la ligne de salaire devient « Salaire à confirmer », suivie de la précision.
   - **Filtres** : rien ne change dans `build-conditions.ts` ni dans `matchesCriteria` ; la valeur neutre ne satisfait déjà aucun critère. Des cas de démonstration le prouvent (étape 9).
   - **Formulaire admin** : une rubrique « À confirmer » liste les mentions en cours, chacune décochable ; le schéma admin valide la liste et applique `establishFields`. Le formulaire employeur n'en a pas.
   - **Scan** : les champs facultatifs contradictoires d'une proposition deviennent des mentions « à confirmer » (préremplissage du plan 06, publication automatique du plan 04).
7. **« Divers »** (SH10) : colonne `additional_info` (1 000 caractères, `notBlank`).
   - Formulaire admin : champ « Divers (facultatif) » dans « Vie pratique » ; préremplissage depuis la proposition.
   - Fiche : bloc « Divers » s'il est renseigné. Le formulaire employeur n'en a pas.
8. **Back-office** `/admin/annonces` : colonne et filtre de provenance (« Vérifiée par un humain », « Sourcée sur internet », déposées).
9. **Démonstration** (`demoOffers`) : ajouter une annonce collectée vérifiée dont la date source est ancienne, une annonce sourcée automatiquement avec un logement « à confirmer », et une annonce à formulaire seul. L'oracle et la requête doivent retenir les mêmes offres ; `seedDemoCatalog` recalcule les compteurs ; le nombre d'offres du jeu se met à jour dans `CLAUDE.md`.

## Tests

**Unitaires** : `provenanceOf` (quatre cas, compte supprimé), `isExternalApplication`, `newnessOf`, `establishFields`, `isToConfirm`.

**Intégration** :

- parité de la recherche avec les nouvelles annonces de démonstration (`search-offers.int.test.ts`) ;
- ordre : une annonce reprise au remplissage initial, publiée sur la plateforme aujourd'hui mais datée d'il y a trois semaines à la source, se range à sa date source ;
- CHECK : un champ « à confirmer » avec une valeur établie est refusé.

**E2E** dans `e2e/scan-presentation.spec.ts` :

- « Scan §7 — labels de provenance sur la carte et la fiche » (les quatre cas) ;
- « Scan §6 — formulaire seul : badge « Candidature externe » sur la carte et la fiche, avant l'ouverture du formulaire » ;
- « Scan §6 — validée par l'admin et à formulaire seul : label humain et badge » ;
- « Scan §5 — logement à confirmer : « À confirmer », absent des résultats du filtre logement » ;
- « Scan §7 — annonce sans date source : « Découverte le … » » ;
- « Scan §7 — employeur inscrit : « Recruteur vérifié » ».

## Critères d'acceptation

- [ ] Carte et fiche affichent la même provenance, la même date de nouveauté et le même badge.
- [ ] Une information « à confirmer » s'affiche comme telle et ne satisfait aucun filtre ; l'oracle et la requête restent d'accord.
- [ ] Aucune coordonnée supplémentaire n'est transmise au navigateur.

## Hors périmètre

- Mise en avant payante (badges « Urgent », priorité de résultats) : chantier séparé.
- Lieux multiples (plan 08).
