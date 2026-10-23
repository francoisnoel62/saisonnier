# Plan scan 02 — Règles métier du scan

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| — | 03, 05 | M | cahier §3 (fenêtres, dates), §5 (minimum, compléments, contradictions), §6 (contacts, annonces regroupées), §7 (dates, doublons) ; plan technique §3, §4 (comptage), lot 2 ; exploration §3 |

## Objectif

Écrire en règles pures et testées (`src/domain/scan/`) tout ce que le scan décide : fenêtre de découverte, dates de la source, contrat, période, saison, canal de candidature, conditions, admission dans la file, points à vérifier, publication automatique, identité d'un recrutement.

Ces règles n'accèdent ni au réseau ni à la base. Les adaptateurs (plan 05) leur fournissent des observations prouvées ; elles rendent une décision motivée. Aucune règle ne produit une valeur sans preuve : une information absente reste `absent`, deux valeurs incompatibles restent `contradictory`.

## Étapes

1. **Vocabulaire** `src/domain/scan/vocabulary.ts`. Les valeurs des enums sont définies ici, une seule fois ; les libellés français sont à côté.
   - `scanModes` : `bootstrap`, `daily`.
   - `scanRunStatuses` : `queued`, `running`, `stopping`, `stopped`, `completed`, `partial`, `failed`.
   - `scanRunSourceStatuses` : `pending`, `listing`, `processing`, `done`, `failed`, `blocked`, `skipped`.
   - `scanCandidateStatuses` : `discovered`, `excluded`, `failed`, `to_review`, `published`, `rejected`.
   - `exclusionReasons` : `no_content`, `out_of_scope`, `closed`, `outside_window`, `already_known`, `not_french`, `outside_france`, `test_data`.
   - `rejectionReasons` (décision de l'admin) : `out_of_scope`, `closed`, `duplicate`, `no_content`, `missing_minimum`, `employer_unreachable`, `other`. `isAdmissionRejection(reason)` est vrai pour les quatre premiers : ils servent au « seuil confirmé » (SH5).
   - `scanReviewKinds` : `duplicate`, `divergence`, `incident`, `occupation` ; `scanReviewStatuses` : `open`, `resolved`, `dismissed`.
   - `publicationKinds` : `human`, `automatic`.
   - `scanIssueCodes`, chacun avec un libellé et `blocking` :
     - bloquants : `company`, `seasonal_contract`, `location`, `period`, `application`, `official_source`, `activity`, `blocked_domain`, `duplicate`, `contract_contradiction`, `period_contradiction`, `season_contradiction`, `multiple_positions`, `year_inferred`, `reused_identity`, `detail_unreadable` ;
     - alertes : `publication_date_unknown`, `optional_contradiction`, `occupation_unknown`, `form_only`, `general_contact_only`, `text_truncated`.
2. **Observations** `src/domain/scan/observation.ts`.
   - `Evidence` : `{ kind: "jsonld" | "rss" | "html_label" | "text" | "api" | "listing", scope: "posting" | "site", locator, excerpt }`. L'extrait fait 300 caractères au plus ; `scope: "site"` marque un texte général du site (pied de page, page « nos métiers »), qui ne prouve jamais une condition du poste.
   - `Observation<T>` : `{ field, value, evidence, extractorVersion, observedAt }`.
   - `ExtractedPosting` : intitulé, URL de découverte et URL officielle, identifiant externe, date de la source, texte utile, observations, contacts relevés, informations de liste.
   - `boundObservations()` et `boundText()` appliquent les plafonds de SH13.
3. **Dates de la source** `src/domain/scan/source-date.ts` : `parseSourceDate(raw, { timeZone })` renvoie `{ precision: "instant", at }`, `{ precision: "day", date, timeZone }` ou `null`.
   - Un ISO 8601 avec fuseau, ou une date RSS (RFC 822, `Thu, 22 Oct 2026 10:14:35 +0200`), est un instant.
   - Un `AAAA-MM-JJ` ou « 16 octobre 2026 » est un jour ; aucune heure n'est inventée.
   - Sans fuseau connu, la date est lue dans `Europe/Paris` (cahier §3).
4. **Fenêtre** `src/domain/scan/window.ts`.
   - `discoveryWindow(mode, startedAt)` : en quotidien, de `startedAt − 72 h` à `startedAt`, borne de début incluse ; en mode initial, aucune fenêtre.
   - `windowDecision(sourceDate, window)` renvoie `inside`, `outside` ou `unknown`. Un instant est dedans s'il est postérieur ou égal au début. Un jour est dedans si ce jour civil, dans son fuseau, recoupe la fenêtre. Sans date : `unknown`, admis avec l'alerte `publication_date_unknown` (« découverte le … »).
   - La fenêtre ne dépend que du début du passage : une reprise après cinq jours d'arrêt ne cherche pas au-delà de 72 h.
5. **Contrat** `src/domain/scan/contract.ts` : `seasonalContractEvidence(observations)` renvoie `explicit`, `ambiguous` ou `not_seasonal`, avec ses preuves.
   - **Explicite** : une mention attachée au poste (champ de contrat, intitulé ou description du poste) : « CDD saisonnier », « contrat saisonnier », « CDD saison », « emploi saisonnier », « poste saisonnier », « saisonnier (H/F) » dans l'intitulé.
   - **Ambigu** : « CDD » seul, des dates d'été ou d'hiver, « saison d'hiver » sans mention de contrat.
   - **Non saisonnier** : « CDI », « à l'année », alternance ou stage explicites, sans mention saisonnière.
   - Une négation (« ce n'est pas un contrat saisonnier ») n'établit rien. Une mention saisonnière et un CDI explicite à la fois : `contract_contradiction`. Une preuve de portée `site` ne compte jamais.
6. **Période** `src/domain/scan/period.ts` : `extractPeriod(observations, { referenceDate })`.
   - Dates complètes : « du 1er février au 23 mars 2027 », « 1er février au 23 mars 2027 », « du 15/12/2026 au 15/04/2027 ». Une année écrite une seule fois, en fin d'expression, vaut pour les deux dates si l'ordre est cohérent.
   - Dates sans année (« du 15 décembre au 15 avril ») : proposées d'après la date de référence, mais `to_verify` avec `year_inferred`.
   - Durée : « 4 mois », « 6 semaines », « contrat de 5 mois ». Une date de début peut l'accompagner (« à partir du 20 décembre 2026 »). Une date de début seule laisse `period` à vérifier.
   - Mois sans jour (« de décembre à avril ») : `to_verify`, extrait conservé, aucune date proposée.
   - Plusieurs périodes différentes, ou des dates incompatibles avec la durée annoncée : `period_contradiction`, bloquant.
   - `validThrough` est l'échéance de l'annonce (`applicationDeadline`), jamais la fin du contrat.
7. **Saison** `src/domain/scan/season.ts`.
   - Mots explicites : hiver, été, estival, hivernal, « saison d'hiver », « Hiver 26-27 ».
   - À défaut, une période établie située entièrement de novembre à avril vaut hiver, de mai à octobre vaut été. Une période à cheval reste à vérifier.
   - Un mot et des dates contradictoires : `season_contradiction`.
8. **Candidature** `src/domain/scan/application.ts`.
   - Un email ou un téléphone relevé dans une rubrique de candidature (« Postuler », « Candidature », « Comment postuler », « Envoyez votre CV ») est un canal établi.
   - Ailleurs (pied de page, accueil, réception), il devient un contact général avec son rôle : il ne sert jamais de canal (SH9).
   - Le formulaire officiel désigné par l'adaptateur est `formUrl`. `applicationContact` seul ne suffit pas (exploration §3).
   - `applicationChannelState` renvoie `direct`, `form_only`, `none` ou `blocked` (destination sur un domaine exclu, via `findBlockedTargets`).
9. **Conditions** `src/domain/scan/conditions.ts`. Seules comptent les mentions attachées au poste ; un avantage général du groupe n'est pas une condition du poste.
   - **Logement** : « logement fourni », « logé·e », « logement assuré » → `yes` ; « logement possible », « possibilité de logement », « possibilité d'être logé » → `unknown`, avec la précision « Logement possible, à confirmer auprès de l'employeur » ; « non logé », « logement non fourni » → `no`.
   - **Repas** : même logique (« nourri·e », « repas fournis »).
   - **Expérience** : « débutant accepté », « première expérience » → `no` ; « expérience exigée », « X ans d'expérience exigés » → `yes`.
   - **Permis** : « permis B exigé » ou « obligatoire » → `yes` ; « permis apprécié » → `unknown`, avec la précision.
   - **Temps de travail** : « temps plein », « temps partiel » ; heures hebdomadaires (« 35 h », « 39 heures »).
   - **Couples et animaux** : mentions explicites seulement.
   - Deux mentions incompatibles pour un même champ : valeur neutre, champ listé « à confirmer » (SH7), alerte `optional_contradiction`.
10. **Salaire** `src/domain/scan/salary-text.ts`.
    - Montants aux formats français et anglais : « 1 867 € », « 1867,50 € », « 1,867.5 € ». Fourchettes : « de 1 800 à 2 000 € ». Unités : mois ou mensuel, heure ou horaire, jour, semaine, saison, forfait (`salaryUnits`).
    - Le net ou le brut n'est retenu que s'il est écrit. Sans base explicite, aucun salaire structuré : la précision conserve le texte exact (« 1 867 € par mois, base non précisée par la source »).
    - « SMIC hôtelier » sans montant : précision seulement.
    - Deux montants établis différents pour une même base et une même unité : « à confirmer ».
11. **Langue et lieu** `src/domain/scan/locale.ts`.
    - `isFrenchText(text)` : heuristique sur la proportion de mots outils français, testée sur des extraits français, anglais et allemands.
    - `departmentFromPostalCode(code)` : deux chiffres en métropole, trois pour l'outre-mer ; « 20 » (Corse) reste à résoudre par la commune.
    - `isFrance(place)` : pays explicite.
12. **Admission dans la file** `src/domain/scan/admission.ts` : `admitPosting(posting, context)` renvoie une exclusion motivée, ou une admission avec ses points à vérifier, ses alertes et ses indices de pertinence. Contexte : mode, fenêtre, aujourd'hui (Paris), source.
    - **Écartée** (ne compte pas) :
      - `no_content` : ni intitulé, ni texte utile (moins de 200 caractères et moins de trois champs structurés) ;
      - `closed` : clôture explicite (« poste pourvu », « offre clôturée », « n'est plus disponible ») ou échéance, date de fin ou `validThrough` dépassée ;
      - `out_of_scope` : contrat non saisonnier explicite ;
      - `not_french`, `outside_france` ;
      - `outside_window` : passage quotidien et date de la source avant la fenêtre ;
      - `test_data` : source de test ou domaine `.example` hors mode test.
    - **Admise** (elle compte) : intitulé, URL précise de découverte, date de collecte, texte utile ou données extraites, au moins un indice documenté de pertinence (mention saisonnière, même ambiguë ; saison ; source employeur du tourisme du registre) et la liste des points à vérifier. Une période, un canal ou la source officielle manquants ne l'empêchent pas (plan technique §4).
    - `already_known` (piste déjà présente, doublon connu) est décidé par la persistance (plans 03 et 04), pas par cette règle.
    - L'absence de preuve de clôture ne prouve pas l'activité de l'offre : le point `activity` reste affiché à la revue.
13. **Préparation à la publication** `src/domain/scan/readiness.ts`.
    - `publicationReadiness(proposal, context)` renvoie `{ blocking, alerts }`.
    - **Bloquant** : entreprise non identifiée ; contrat saisonnier non explicite ; lieu non résolu ; période absente ; aucun canal ou canal exclu ; URL officielle hors des `officialHosts` de la source ; signal de clôture ; doublon potentiel ouvert ; contradiction sur un champ obligatoire ; postes multiples mal associés ; année déduite ; identifiant réutilisé.
    - **Alerte** : métier inconnu, champ facultatif « à confirmer », date de publication inconnue, formulaire seul, contact général seul.
    - `canAutoPublish({ mode, sourceAutoPublish, readiness })` : toujours faux en mode initial ; sinon vrai seulement si la source l'autorise et qu'aucun point n'est bloquant (SH4).
14. **Identité d'un recrutement** `src/domain/scan/identity.ts`.
    - `canonicalUrl(url)` : hôte en minuscules, sans fragment ni paramètres de suivi (`utm_*`, `gclid`…), sans barre finale.
    - `recruitmentIdentity({ adapter, host, externalId, url, index })` : `<adapter>:<host>:<externalId>` si l'identifiant existe, sinon l'URL canonique, suivie de `#<index>` pour un poste parmi plusieurs sur une page.
    - `compareRecruitment(known, observed)` : `same` si les périodes se recoupent ou si l'une est inconnue ; `other_period` si deux périodes établies sont disjointes (nouveau recrutement, `reused_identity` à vérifier) ; `uncertain` si l'intitulé normalisé a changé.
15. **Proposition** `src/domain/scan/proposal.ts`.
    - `ScanProposal` : chaque champ de l'annonce est `{ status: "established" | "to_verify" | "contradictory" | "absent", value?, values?, evidence }`.
    - Champs : intitulé, entreprise proposée (nom, SIREN), description, missions, contrat, saison, période, échéance, lieux, salaire et précision, conditions, profil, organisation, vie pratique, canal (email, téléphone, formulaire, contacts généraux), URL officielle, date de la source, « Divers ».
    - `buildProposal(posting, rules)` assemble les règles ci-dessus ; `proposalIssues(proposal)` en déduit les points à vérifier et les alertes.
16. **Intitulé normalisé** `src/domain/scan/title.ts` : `normalizeJobTitle("Serveur H/F - Hiver 26-27")` donne `"serveur"`. Sont retirés : marques de genre (H/F, F/H), suffixes de saison, mots de contrat, ponctuation ; accents et casse sont neutralisés. Il sert aux suggestions de métiers et aux doublons.

## Tests

**Unitaires**, en tableaux de cas aux noms tirés du §10 du cahier, avec des extraits fictifs :

- « une offre horodatée exactement 72 h avant le début du passage est dans la fenêtre » ; une seconde plus tôt, elle n'y est plus ;
- « une date sans heure dont le jour recoupe la fenêtre est admise » ;
- « reprise après cinq jours : la fenêtre reste de 72 h » ;
- « remplissage initial : une offre ancienne non close est admise » ;
- « annonce sans date : admise, « découverte le … » » ;
- « CDD seul : caractère saisonnier à vérifier » ; « CDD saison : explicite » ; « CDI explicite : hors périmètre » ; « CDI et saisonnier : contradiction » ;
- « avantage général du groupe : aucune condition établie pour le poste » ;
- « logement possible : non précisé, jamais oui » ;
- « deux salaires différents : à confirmer » ; « montant sans net ni brut : précision seulement » ;
- « validThrough est une échéance, jamais une fin de contrat » ;
- « dates incompatibles avec la durée : bloquant » ; « dates sans année : année déduite à vérifier » ;
- « formulaire officiel seul : candidature externe » ; « téléphone d'accueil : contact général, jamais canal » ; « formulaire sur un job-board : canal exclu » ;
- « même identifiant, autre période : autre recrutement » ;
- « mode initial : jamais de publication automatique, même pour un dossier complet » ;
- « passage quotidien, source autorisée, dossier sans point bloquant : publication automatique possible ».

## Critères d'acceptation

- [x] Toutes les règles sont pures (aucun import de `src/server` ni de `src/lib/db`) et testées par des cas nommés d'après le §10 du cahier.
- [x] Aucune règle ne produit une valeur sans preuve ; l'absence et la contradiction restent distinctes.
- [x] `canAutoPublish` est faux pour tout dossier du remplissage initial.
- [x] Les valeurs des enums du scan n'existent qu'à un seul endroit.

Réalisation et contrat pour les plans suivants : [règles V1](../../scan/rules-v1.md). Validation locale : lint, typecheck, 836 tests unitaires (dont 251 cas ajoutés), 218 tests d'intégration, 170 E2E réussis et un cas ordinateur ignoré sur mobile.

## Hors périmètre

- Tables et écritures (plan 03), lecture du HTML (plan 05), affichage (plans 06 et 07).
- Toute règle de maintenance des annonces publiées (cron de contrôle séparé).
