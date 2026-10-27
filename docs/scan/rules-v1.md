# Règles pures du scan V1

Implémentation du [plan 02](../plans/scan-v1/02-regles-scan.md), dans `src/domain/scan/`. Aucun appel réseau, horloge implicite, accès à la base ou écriture. Les dates de référence et les politiques viennent de l'appelant.

**Mise à jour SH19 du 24 octobre 2026, décidée par le fondateur pendant le plan 06 :** la nature saisonnière du contrat reste obligatoire, mais été/hiver devient facultatif. Une saison absente ou contradictoire produit une alerte ; elle n'est pas inventée et ne bloque plus la publication. Les règles de preuve et de dates restent applicables.

## Contrat pour les adaptateurs et les services suivants

- `Observation<T>` associe une valeur à son champ, sa preuve, sa version d'extracteur et sa date de collecte. `Evidence.scope = "site"` ne prouve ni contrat, ni période, ni saison, ni condition du poste. Les adaptateurs doivent retirer le pied de page du `usefulText` et marquer séparément les textes généraux.
- `ExtractedPosting` contient les métadonnées désignées par l'adaptateur (`title`, `discoveryUrl`, `officialUrl`, `collectedAt`, `sourceDate`), le texte utile, les observations et les contacts. `detailReadable` est obligatoire : l'adaptateur doit indiquer si le détail est lisible. `buildProposal` conserve leur provenance et assemble les règles. Une valeur structurée du poste doit porter une preuve de portée `posting`. Le texte utile reste consulté par toutes les règles même si un résumé existe déjà.
- Champs structurés reconnus : `company` (`{ name, siren? }`), `locations` (liste de `{ communeName?, departmentCode?, inseeCode?, postalCode?, country?, countryCode? }`), `period` (`{ startDate?, endDate?, duration?: { value, unit } }`), `startDate`, `endDate`, `duration`, `season`, les conditions et `activity` (`active` / `closed`). Les textes se rangent dans `title`, `description`, `missions`, `contract`, `period`, `season`, `salary`, `conditions`, `profile`, `organization`, `practicalInfo`, `additionalInfo`. `datePosted` et `sourceDate` désignent la publication ; `applicationDeadline` et `validThrough` désignent l'échéance.
- Un contact porte sa rubrique, son rôle, son caractère officiel et sa preuve. Seules les rubriques de candidature explicites établissent un canal direct. Le booléen `formUrl.official` doit être établi par l'adaptateur ; le domaine reste contrôlé contre les exclusions. `applicationContact` seul reste général.
- `ProposalField<T>` distingue `absent`, `established`, `to_verify`, `contradictory`. Un champ contradictoire n'a **pas** de `value` utilisable pour les filtres ; ses alternatives restent dans `values`. Une année déduite peut être proposée dans `to_verify`, jamais établie. Les précisions et preuves restent consultables.
- `proposalIssues` calcule les manques et contradictions intrinsèques ; `publicationReadiness` ajoute les contrôles de contexte (hôtes officiels exacts, domaines exclus, échéances, doublons et identité réutilisée). Les deux renvoient les libellés issus de `vocabulary.ts`.
- La publication utilise les hôtes du registre pour les sources employeur. Pour un dossier issu d'une source de découverte comme France Travail, l'admin doit retrouver et valider une URL officielle employeur dans le formulaire : son hôte est alors attesté pour cette seule publication humaine. L'hôte de découverte et les domaines exclus restent refusés ; aucune source de découverte ne reçoit d'hôte autorisé pour la publication automatique.
- `admitPosting` rend soit une exclusion motivée, soit le dossier, ses blocages, alertes et indices documentés. Une absence de période, de canal ou de source officielle ne retire pas un dossier pertinent de la revue. Sans preuve d'activité, le point `activity` subsiste. `already_known` reste une décision de persistance. Si la source fournit `postingUrlPattern`, l'URL doit le respecter ; une simple racine avec des paramètres de suivi n'est jamais une URL précise. Des dates source contradictoires restent inconnues pour la décision de fenêtre, sans choisir une des valeurs.
- `canAutoPublish` refuse toujours le mode initial. En quotidien, la source doit l'autoriser et la liste des blocages doit être vide. Une alerte facultative ne devient pas un blocage.
- `boundText` et `boundObservations` s'appliquent aussi à l'écriture par le plan 03 : 20 000 caractères Unicode, 200 observations, extraits de 300 caractères. L'assemblage signale une entrée tronquée ; la rétention de 90 jours relève des services ultérieurs.

## Arbitrages explicites (SH18)

Les formulations reconnues sont celles du plan ; une formulation non reconnue reste absente ou à vérifier. Ces choix déterministes complètent les cas non détaillés par le plan :

1. Sans année, on propose la première période dont la fin n'est pas antérieure au jour de référence, y compris une saison déjà commencée. Décembre–avril traverse l'année. Le point `year_inferred` reste bloquant. Un millésime écrit seulement à la fin d'une expression décembre–avril ne suffit pas à établir celui de décembre : aucune date n'est proposée.
2. Une durée calendaire peut finir le jour anniversaire ou la veille si la source compte le dernier jour inclus ; aucun jour supplémentaire n'est accepté. Les mois se calculent au calendrier, avec rabattement au dernier jour du mois. Une durée d'expérience ou de période d'essai n'est pas une durée de contrat.
3. Une heure locale explicitement écrite est interprétée dans le fuseau source, Paris par défaut. Si elle est inexistante ou répétée au changement d'heure, aucun instant n'est choisi sans décalage explicite. Un jour sans heure reste un jour. La fenêtre est fermée à ses deux extrémités ; le jour civil est un intervalle de début inclus et fin exclue.
4. Une date limite civile expire à la fin de sa journée dans son fuseau ; un instant limite est dépassé strictement après cet instant. Une fin de contrat civile expire après le jour indiqué à Paris. Une date de début dépassée ne ferme rien à elle seule ; si une durée explicite prouve que la totalité du contrat est révolue, le recrutement est écarté.
5. Une période établie entièrement hors de la saison écrite, ou débordant sur l'autre saison, crée une contradiction. Le verbe « a été » ne prouve pas l'été. Des horaires de service (« 8 h à 16 h ») ne sont pas des heures hebdomadaires ; un nombre d'heures inférieur ou égal à 24 doit être explicitement hebdomadaire.
6. Une destination de candidature exclue bloque le dossier même si un autre canal est présent. Un hôte officiel autorisé est une correspondance exacte, jamais une simple chaîne contenue dans le nom ou un sous-domaine implicite.
7. Deux périodes établies disjointes prouvent un autre recrutement, même si l'intitulé a aussi changé. Un début et une durée explicites peuvent fournir des bornes internes pour cette comparaison et pour la saison ; la fin calculée n'est jamais ajoutée aux dates proposées comme si elle était écrite par la source. Sinon, le changement d'intitulé normalisé rend la comparaison incertaine. Aucun résultat de comparaison ne fusionne de dossier.

## Couverture du plan

| Étapes | Modules | Tests fictifs |
|---|---|---|
| 1, 2 | `vocabulary`, `observation`, `field` | `decisions-rules`, `dates-rules` |
| 3, 4 | `source-date`, `window` | `dates-rules` : 72 h, jours civils, fuseaux, heures d'été/hiver, calendriers invalides |
| 5 | `contract`, `text` | `extraction-rules` : mentions explicites, négations, contradictions, portée du site |
| 6, 7 | `period`, `season` | `dates-rules` : années, mois, durée, échéance distincte, saisons contradictoires |
| 8 | `application` | `extraction-rules` : recrutement, accueil, formulaire officiel, domaines exclus |
| 9, 10 | `conditions`, `salary-text` | `extraction-rules` : mentions et négations, inconnu, formats, bases, unités, contradictions |
| 11 | `locale` | `extraction-rules` : français/anglais/allemand, pays, départements et Corse non résolue |
| 12, 13 | `admission`, `activity`, `readiness` | `decisions-rules` : exclusions, admissions incomplètes, activité non prouvée, publication initiale interdite |
| 14, 16 | `identity`, `title` | `decisions-rules` : URL canonique, index zéro, périodes disjointes, intitulés normalisés |
| 15 | `proposal` | `decisions-rules` : assemblage sans mutation, preuve requise, alertes facultatives, troncature |

Les tests généraux d'intégration et E2E vérifient les parcours existants. Le plan 02 n'ajoute ni table, ni adaptateur HTML, ni interface, ni cron.
