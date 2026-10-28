# Recette des sources du scan — plan V2-01, lot G

> **État : à mener par le fondateur.** Les lots A à F sont fusionnés et en production (PR #43, #50, #45, #46, #47, #48). La recette se fait depuis le déploiement, avec un compte admin : la preview d'abord, puis la production (SH23 : les tests faits en preview restent dans la base de la preview ; la production se qualifie par un échantillon lancé depuis la production). Chaque décision se consigne **dans l'application** (décision de reprise, motif d'écart, historique de la source), datée et attribuée ; ce document en garde le compte rendu.

## Décisions attendues (§19 du plan)

| # | Décision | Recommandation | Décision du fondateur | Date |
|---|---|---|---|---|
| 2 | France Travail en remplissage initial de production | oui (la décision du 23/10 ne vise que les passages programmés) | | |
| 3 | France Travail en passages quotidiens | demander l'accès à l'API officielle ; justification à saisir dans la qualification | | |
| 4 | Reprise Belambra, VVF, MS Vacances | demander l'autorisation écrite (bouton « Préparer la demande d'autorisation ») | | |
| 5 | Indeed, LinkedIn | écarter (pistes V3) | | |
| 6 | SeasonJobs, JobAnim | demander un flux ou un partenariat ; brouillons d'ici là ; `jobanim.com` exclu | | |
| 7 | Club Med | connecteur générique si la détection le permet | | |
| 8 | Seuils | 3 passages bloqués, 20 sources activées, 20 tests gardés, 180 jours | | |
| 11 | Seuil de couverture | 75 %, à ajuster après trois mois | | |

## Parcours

1. **Sources migrées** (`/admin/scan/sources`) : pour France Travail, Belambra, VVF et MS Vacances, « Extraire un échantillon » depuis le déploiement, puis l'onglet Qualification. Décision de reprise selon le §19 ; « Marquer comme prête » seulement sans point bloquant. MS Vacances : la sonde depuis une preview n'a jamais été faite (dossier V1).
2. **Club Med** : « Ajouter une source », adresse `https://www.clubmedjobs.com/`, « Analyser ». Consigner ci-dessous le rapport (format détecté, robots.txt, plateforme connue). Format connu ou page carrière lisible sans JavaScript : configurer, prouver le rattachement par le site officiel du groupe, échantillonner, décider. Liste construite par JavaScript : brouillon « connecteur à développer » (V4) avec la raison.
3. **SeasonJobs** (`https://www.seasonjobs.com/`) et **JobAnim** (`https://www.jobanim.com/`) : brouillons de découverte ; pour JobAnim, « Ajouter jobanim.com aux domaines exclus » depuis la qualification ; consigner robots.txt et conditions ; préparer la demande de flux ou de partenariat.
4. **Indeed** (`https://fr.indeed.com/`), et LinkedIn si le fondateur le souhaite : l'assistant ne lit pas le site et propose « Enregistrer comme écartée » avec la conclusion documentée.
5. **Chronométrer** l'ajout d'un portail de format connu (Teamtailor ou Factorial) jusqu'à « Prête » : cible, moins de 10 minutes, sans déploiement.

## Compte rendu

| Source | Statut | Connecteur | Motif ou décision | Mesures (déploiement, date, résultat) |
|---|---|---|---|---|
| France Travail | | france-travail@3 | | |
| Belambra | | teamtailor@2 | | |
| VVF | | factorial@1 | | |
| MS Vacances | | teamtailor@2 | | |
| Club Med | | | | |
| SeasonJobs | | | | |
| JobAnim | | | | |
| Indeed | Écartée | — | | |
| LinkedIn | | — | | |

Chronométrage de l'ajout d'un portail : …

## Critères d'acceptation du lot G

- [ ] Chaque source citée par le fondateur existe, avec son statut et son motif.
- [ ] Au moins une nouvelle source employeur est prête si un format lisible existe ; sinon la raison est consignée.
- [ ] Les décisions du fondateur sont datées dans l'application.
