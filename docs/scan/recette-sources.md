# Recette des sources du scan — plan V2-01, lot G

> **État : menée en production le 28 octobre 2026** (déploiement `c6d7a91`, `https://saisonnier.vercel.app`), avec le compte admin du fondateur, qui a pris chaque décision ; les écritures ont été faites depuis l'application. Chaque décision est consignée **dans l'application** (décision de reprise, motif d'écart, historique de la source), datée et attribuée ; ce document en garde le compte rendu. Aucun passage n'a encore eu lieu : ils relèvent du plan scan 09.

## Décisions du fondateur (§19 du plan)

| # | Décision | Recommandation | Décision du fondateur | Date |
|---|---|---|---|---|
| 2 | France Travail en remplissage initial de production | oui (la décision du 23/10 ne vise que les passages programmés) | oui | 28/10/2026 |
| 3 | France Travail en passages quotidiens | demander l'accès à l'API officielle ; justification à saisir dans la qualification | oui, sans attendre l'API : justification consignée dans la qualification (« lecture quotidienne de la recherche publique, une requête toutes les 2 s, robots.txt respecté, sans API partenaire, en attendant l'accès à l'API officielle ») | 28/10/2026 |
| 4 | Reprise Belambra, VVF, MS Vacances | demander l'autorisation écrite | MS Vacances : reprise acceptée. Belambra et VVF : reprise d'abord acceptée, puis décision retirée quand les conditions relevées au §5 ont été rappelées (mentions légales de Belambra : autorisation écrite préalable ; CGU du site principal de VVF restrictives) : demande d'autorisation à envoyer | 28/10/2026 |
| 5 | Indeed, LinkedIn | écarter (pistes V3) | écarter les deux | 28/10/2026 |
| 6 | SeasonJobs, JobAnim | demander un flux ou un partenariat ; brouillons d'ici là ; `jobanim.com` exclu | conforme ; le fondateur rédige lui-même la demande de flux ou de partenariat | 28/10/2026 |
| 7 | Club Med | connecteur générique si la détection le permet | connecteur générique, reprise acceptée | 28/10/2026 |
| 8 | Seuils | 3 passages bloqués, 20 sources activées, 20 tests gardés, 180 jours | conservés | 28/10/2026 |
| 11 | Seuil de couverture | 75 %, à ajuster après trois mois | conservé | 28/10/2026 |
| — | Activation | — | France Travail seule activée (remplissage initial et passages quotidiens) ; les sources prêtes restent désactivées | 28/10/2026 |
| — | Chronométrage de l'ajout d'un portail Teamtailor ou Factorial | moins de 10 minutes | abandonné : aucun nouveau portail Teamtailor ou Factorial officiel d'un employeur du tourisme n'a été trouvé (les pages Teamtailor d'Azureva et de Villages Clubs du Soleil ne sont pas celles que leurs sites officiels désignent) | 28/10/2026 |

## Compte rendu

| Source | Statut | Connecteur | Motif ou décision | Mesures (déploiement, date, résultat) |
|---|---|---|---|---|
| France Travail | Prête, activée (initial et quotidien) | france-travail@3 | reprise acceptée (décisions 2 et 3), justification des passages quotidiens consignée ; jamais de publication automatique (découverte) | échantillon réussi, production, 28/10/2026 05:05 |
| Belambra | Brouillon | teamtailor@2 | décision de reprise « À décider » : les mentions légales exigent une autorisation écrite préalable ; demande à envoyer (« Préparer la demande d'autorisation ») | échantillon réussi, production, 28/10/2026 05:05 |
| VVF | Brouillon | factorial@1 | décision de reprise « À décider » : CGU du site principal restrictives ; demande à envoyer | échantillon réussi, production, 28/10/2026 05:06 |
| MS Vacances | Prête | teamtailor@2 | reprise acceptée par le fondateur (décision 4) | première sonde depuis un déploiement : échantillon réussi, production, 28/10/2026 05:14 ; champs établis : contrat 3/10, période 0/10, lieu 9/10, candidature 10/10, salaire 0/10 |
| Club Med | Prête | career-page@1 | reprise acceptée (décision 7). Rattachement : le lien « Club Med Jobs » de clubmed.fr mène à `clubmedjobs.com/fr` ; portail exploité par Club Med SAS (SIREN 572185684, 55.20Z). Liste : `https://www.clubmedjobs.com/fr/sitemap.xml` ; motif `https://www.clubmedjobs.com/fr/emploi/france/{slug}/2745/{id}` (16 offres en France sur 355) ; JSON-LD `JobPosting` exigé | détection de l'accueil : HTTP 200, robots.txt autorisé, motif proposé trop large (131 pages institutionnelles) ; robots.txt n'interdit que les pages de recherche ; aucune CGU ni mention légale sur le portail. Échantillon réussi, production, 28/10/2026 05:28 : intitulé et employeur lus, contrat 1/10, période, lieu, candidature et salaire 0/10 (à compléter en revue) |
| SeasonJobs | Brouillon (découverte) | — | en attente d'un flux ou d'un partenariat ; `seasonjobs.com` déjà exclu | détection : HTTP 200, robots.txt autorisé, liste construite par JavaScript (aucun connecteur sans navigateur, V4) |
| JobAnim | Brouillon (découverte) | — | en attente d'un flux ou d'un partenariat ; `jobanim.com` ajouté aux domaines exclus depuis la qualification | détection : HTTP 200, robots.txt autorisé ; plateforme non reconnue, type « Découverte » choisi à la main |
| Indeed | Écartée | — | aucun accès de collecte autorisé : le Publisher JavaScript Plugin est réservé aux partenaires ; piste V3 via un moteur de recherche | site non lu (`shouldSkipRead`) |
| LinkedIn | Écartée | — | les intégrations Talent passent par des programmes partenaires ; aucune recherche générale d'offres | site non lu (`shouldSkipRead`) |
| Accor, Pierre & Vacances – Center Parcs, Sandaya | Écartées (migrées) | — | inchangé (plan scan 01) | — |

Chronométrage de l'ajout d'un portail : abandonné par le fondateur (voir les décisions).

## Écarts constatés pendant la recette

À reprendre dans un prochain plan ; aucun ne bloque la recette.

1. **Détection d'un plan de site** : sur `https://www.clubmedjobs.com/fr/sitemap.xml`, l'assistant répond « aucun signal d'un format connu », alors que le connecteur `career-page` lit les plans de site. La détection ne compte que les liens d'une page HTML : le connecteur a été choisi à la main dans le formulaire.
2. **JobAnim inconnu des plateformes** : `knownPlatforms` ne le décrit pas ; la détection propose une page carrière employeur au lieu d'une découverte.
3. **Demande d'autorisation des job-boards** : « Préparer la demande d'autorisation » n'existe que pour une source employeur, et son texte vise un portail carrière. La demande de flux ou de partenariat de SeasonJobs et JobAnim est rédigée par le fondateur.
4. **Extraction Club Med** : le JSON-LD donne l'intitulé, mais ni lieu, ni période, ni canal de candidature établis sur l'échantillon. Les dossiers passeront par la revue humaine ; un réglage de l'extraction (`jobLocation`, description structurée « Job location / Contract type ») est à étudier avec des fixtures.
5. **Fiches entreprise** : MS Vacances et Club Med signalent « Aucune fiche entreprise pour ce SIREN » (alerte non bloquante, SH15) ; « Créer la fiche entreprise » reste à faire avant la revue de leurs premiers dossiers.

## Critères d'acceptation du lot G

- [x] Chaque source citée par le fondateur existe, avec son statut et son motif.
- [x] Au moins une nouvelle source employeur est prête si un format lisible existe ; sinon la raison est consignée. (Club Med)
- [x] Les décisions du fondateur sont datées dans l'application.
