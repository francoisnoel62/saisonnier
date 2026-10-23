# Sources du scan V1 — dossier du 23 octobre 2026

## État de la décision

Implémentation du plan 01 sur `plan/scan-01-sources-client-http`. Belambra et VVF sont proposées comme sources principales ; MS Vacances est ajouté comme réserve lisible. L'API SmartRecruiters a été écartée après refus de robots.txt. Le registre ne lance aucun passage et ne publie aucune offre.

**Validation du fondateur : en attente.** Il reste à confirmer le choix des sources et leurs conditions de reprise. Une lecture autorisée par robots.txt ne constitue pas une autorisation de republier les annonces. Aucune décision du fondateur n'est déduite de l'instruction d'implémenter le plan.

## Accès depuis la preview

**Sonde authentifiée encore à réaliser.** La [PR #32](https://github.com/francoisnoel62/saisonnier/pull/32) dispose d'une [preview prête](https://saisonnier-git-plan-scan-01-sour-2b72fa-francois-noels-projects.vercel.app/admin/scan). Le [déploiement du commit 5ae696d](https://vercel.com/francois-noels-projects/saisonnier/AcHmodQYEfQqBUYZjU248Z7HamjR) a été construit avec succès le 23/10/2026. À 12:23:48 UTC, l'accès anonyme à `/admin/scan` répond 302 vers le SSO Vercel. Le jeton Vercel CLI local est expiré et aucun navigateur connecté n'est disponible dans la session : aucun accès authentifié n'a été contourné. Les relevés ci-dessous proviennent du poste de développement et ne prouvent pas une lecture des sources depuis Vercel.

Parcours : ouvrir `/admin/scan` avec un compte admin ; pour chaque source principale, « Tester l’accès depuis ce déploiement ». Conserver le résultat du panneau et le journal `[scan sonde]`, avec URL exacte du déploiement, date, HTTP, URL finale, durée, octets, décisions robots, JSON-LD, RSS et pagination. La sonde lit la première liste et jusqu'à trois fiches, et s'arrête au premier échec. Aucun contenu d'annonce n'est envoyé au navigateur ou journalisé.

| Source | Déploiement | Date | Liste | Trois fiches | Preuve |
|---|---|---|---|---|---|
| Belambra | Preview de la PR #32 | En attente d'accès admin | — | — | — |
| VVF | Preview de la PR #32 | En attente d'accès admin | — | — | — |

## Belambra — Teamtailor

- Site employeur : <https://www.belambra.fr/>. Liste : <https://recrute.belambra.fr/jobs.rss> ; fiches `/jobs/<id>-<slug>`.
- Rattachement : la [FAQ officielle](https://www.belambra.fr/faq-foire-aux-questions) renvoie les candidatures vers `recrute.belambra.fr`. Les [mentions légales](https://www.belambra.fr/mentions-legales) établissent Belambra Clubs, SIREN `322706136`. Le groupe du registre n'impose pas une entité juridique à toutes ses offres.
- Reprise : les mentions du site principal prévoient une autorisation écrite préalable de reproduction hors copie privée. Leur portée sur le portail ATS et l'autorisation de reprise doivent être validées avant activation. La [page de données et confidentialité du portail](https://recrute.belambra.fr/data-privacy) mène à sa politique de traitement des candidatures ; ces données ne sont jamais collectées.
- [robots.txt](https://recrute.belambra.fr/robots.txt), HTTP 200 le 23/10/2026 : groupe `*` interdisant `/app/`, `/messages/`, `/messenger/`, `/facebook/tab/`, `/jobs/internal/`. Aucun `Crawl-delay`. `/jobs.rss` et les fiches publiques sont autorisés pour notre bot. Le groupe `aihitdata` interdit tout à cet agent. Le signal de contenu du portail ne dispense pas d'examiner ses conditions.
- Lecture depuis le poste, 11:58–11:59 UTC : flux HTTP 200, 373 281 octets, 94 éléments RSS et 94 URL distinctes ; dix fiches HTTP 200, 52 828 à 56 542 octets. Aucune pagination du flux détectée. Le JSON-LD peut être valide ou invalide selon la fiche : conserver les deux cas. Le HTML contient les libellés de contrat et de salaire.

### Dix fiches examinées

Échantillon déterministe : les dix premières URL uniques du flux, sans sélection selon le contrat. Chaque fiche possède un texte métier utile et un formulaire officiel. « CDD saison » établit le caractère saisonnier quand le texte ne le contredit pas ; le nom du club reste à résoudre en commune. Les neuf premières ne donnent pas de période de contrat explicite : dossiers à compléter en revue, aucune publication automatique.

| Identifiant et fiche | Secteur / lieu | Contrat | Période | Canal / décision |
|---|---|---|---|---|
| [8588693 — Second de cuisine](https://recrute.belambra.fr/jobs/8588693-second-de-cuisine-h-f) | Restauration, Hôtel du Golf | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8585963 — Responsable restauration](https://recrute.belambra.fr/jobs/8585963-responsable-restauration-h-f) | Restauration, Grand Hôtel de la Mer | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8584535 — Chef de cuisine](https://recrute.belambra.fr/jobs/8584535-chef-de-cuisine-h-f) | Restauration, Aiguille Rouge | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8576475 — Magasinier](https://recrute.belambra.fr/jobs/8576475-magasinier-h-f) | Économat d'un club de vacances, Hôtel du Golf | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8576342 — Économe](https://recrute.belambra.fr/jobs/8576342-econome-chef-de-magasin-h-f) | Économat, Hôtel du Golf | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8572835 — Gouvernant](https://recrute.belambra.fr/jobs/8572835-gouvernant-h-f) | Hébergement, Val Claret | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8568162 — Employé de ménage](https://recrute.belambra.fr/jobs/8568162-employe-de-menage-h-f) | Hébergement, Val Claret | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8565468 — Barman](https://recrute.belambra.fr/jobs/8565468-barman-h-f) | Restauration, Hôtel du Golf | CDD saison | Absente | Formulaire ; dossier à revoir |
| [8557979 — Serveur](https://recrute.belambra.fr/jobs/8557979-serveur-h-f) | Restauration, Alisier | CDD saison | Absente | Formulaire ; JSON-LD invalide |
| [8545711 — Responsable maintenance](https://recrute.belambra.fr/jobs/8545711-responsable-maintenance-h-f) | Maintenance d'hôtel, Orée des Pistes | Libellé saisonnier, texte CDI | À l'année | Formulaire ; contrat contradictoire, exclu de l'estimation prudente |

Deux captures complémentaires couvrent [une période en texte libre](https://recrute.belambra.fr/jobs/8467939-responsable-menage-h-f) et [plusieurs recrutements montagne](https://recrute.belambra.fr/jobs/8340139-employes-saison-montagne-h-f). Les avantages généraux de logement ne constituent jamais un logement garanti pour une fiche.

## VVF — Factorial

- Site employeur : <https://www.vvf.fr/>. Liste HTML : <https://vvfrecrute.factorial.fr/> ; fiches `/job_posting/<slug>-<id>`, candidatures `/apply/<slug>-<id>`. L'identifiant numérique est stable ; le slug seul ne l'est pas. `/apply` est une candidature spontanée, exclue de l'inventaire.
- Rattachement : [page officielle VVF recrutement](https://www.vvf.fr/article/vvf-recrutement), liens « Voir les offres » vers le portail Factorial. Les [mentions légales](https://www.vvf.fr/article/les-mentions-legales) donnent le SIREN `775634132` (SIRET de l'association).
- Reprise : les [conditions générales d'utilisation du site](https://www.vvf.fr/article/conditions-generales-utilisation-site-internet) interdisent la reproduction hors usage privé et non commercial. Examiner leur portée sur Factorial, les mentions et la [politique de confidentialité du portail](https://vvfrecrute.factorial.fr/terms). Aucune autorisation de republication explicite n'a été établie dans cette session ; décision du fondateur attendue.
- [robots.txt](https://vvfrecrute.factorial.fr/robots.txt), HTTP 200 le 23/10/2026 : `User-agent: *`, `Allow: /`, sans délai.
- Lecture depuis le poste, 11:59 UTC : liste HTTP 200, 74 914 octets, 27 liens distincts de fiche ; dix fiches HTTP 200, 31 867 à 33 556 octets. Aucun JSON-LD ni pagination détectés. Contrat, temps de travail, rémunération et lieu dans des puces sans libellé.

### Dix fiches examinées

Échantillon : les dix premières URL uniques dans l'ordre de la liste. Sept recrutements saisonniers explicites dans le tourisme de loisirs, avec métier, station, période et formulaire. Les dates de décembre suivies de janvier 2027 demandent une résolution d'année, sans invention ; Prapoutel reste à résoudre en commune. Les sept fiches correspondent à plusieurs métiers et périodes, pas sept URL supposées être des doublons.

| Identifiant et fiche | Secteur / lieu | Contrat | Période documentée | Canal / décision |
|---|---|---|---|---|
| [327834 — Assistant commercial](https://vvfrecrute.factorial.fr/job_posting/assistant-e-commercial-grands-comptes-h-f-327834) | Siège, Clermont-Ferrand | CDD remplacement | Dès que possible | Formulaire ; hors saisonnier |
| [326869 — Responsable maintenance](https://vvfrecrute.factorial.fr/job_posting/responsable-de-maintenance-h-f-326869) | Village, Évian-les-Bains | CDI | Dès 23/11/2026 | Formulaire ; hors saisonnier |
| [326866 — Responsable maintenance](https://vvfrecrute.factorial.fr/job_posting/responsable-de-maintenance-h-f-326866) | Village, Les Estables | CDI | Dès 01/11/2026 | Formulaire ; hors saisonnier |
| [326968 — Ouvrier maintenance](https://vvfrecrute.factorial.fr/job_posting/ouvrier-de-maintenance-h-f-326968) | Village, Prapoutel | CDD saisonnier | 2 février–23 mars 2027 | Formulaire ; dossier exploitable |
| [326967 — Ouvrier maintenance](https://vvfrecrute.factorial.fr/job_posting/ouvrier-de-maintenance-h-f-326967) | Village, Prapoutel | CDD saisonnier | 14 décembre–3 janvier 2027 | Formulaire ; dossier exploitable |
| [326965 — Barman](https://vvfrecrute.factorial.fr/job_posting/barman-h-f-326965) | Village, Prapoutel | CDD saisonnier | 22 janvier–31 mars 2027 | Formulaire ; dossier exploitable |
| [326963 — Barman](https://vvfrecrute.factorial.fr/job_posting/barman-h-f-326963) | Village, Prapoutel | CDD saisonnier | 16 décembre–3 janvier 2027 | Formulaire ; dossier exploitable |
| [326962 — Serveur](https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-326962) | Village, Prapoutel | CDD saisonnier | 1er février–23 mars 2027 | Formulaire ; dossier exploitable |
| [326959 — Serveur](https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-326959) | Village, Prapoutel | CDD saisonnier | 19 décembre–3 janvier 2027 | Formulaire ; dossier exploitable |
| [326957 — Serveur](https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-326957) | Village, Prapoutel | CDD saisonnier | 1er décembre–31 mars 2027 | Formulaire ; dossier exploitable |

## MS Vacances — réserve Teamtailor

- Site employeur : <https://www.ms-vacances.com/>. Son pied de page « Entre vous & nous », lien « Offres d'emploi », mène au [portail officiel](https://emploi.ms-vacances.com/). Flux : <https://emploi.ms-vacances.com/jobs.rss>. Aucun SIREN attribué à tous les campings du groupe.
- Conditions : la [page de mentions légales](https://www.ms-vacances.com/mentions-legales/) est accessible mais ne fournit pas de texte exploitable pendant le relevé (contenu principal absent). La [politique de données du portail](https://emploi.ms-vacances.com/data-privacy) décrit les candidatures. Aucune autorisation de republication établie ; validation du fondateur et clarification des conditions avant activation.
- [robots.txt](https://emploi.ms-vacances.com/robots.txt), HTTP 200 : mêmes restrictions Teamtailor que Belambra (`/app/`, `/messages/`, `/messenger/`, `/facebook/tab/`, `/jobs/internal/`), sans Crawl-delay. Flux et fiches autorisés pour notre bot.
- Sonde depuis le poste le 23/10/2026 à 12:34 UTC : flux HTTP 200, 124 652 octets, 24 éléments RSS et 24 URL uniques ; dix fiches HTTP 200. Secteur des campings établi ; nombreux CDI et stages, et un début de contrat ambigu. La réserve apporte une autre source lisible, sans supposer que ses 24 URL sont exploitables.

### Dix fiches examinées

Les dix premières URL uniques du flux, sans sélection selon le contrat. Toutes ont un formulaire officiel. Les stages suivis de CDD ne sont pas comptés comme offres saisonnières établies dans l'estimation prudente.

| Identifiant et fiche | Secteur / lieu | Contrat et période | Décision |
|---|---|---|---|
| [8566962 — Assistant réservation](https://emploi.ms-vacances.com/jobs/8566962-assistant-e-responsable-service-reservation) | Siège, Longeville-sur-Mer (85) | CDI, novembre 2026 | Hors saisonnier |
| [8557942 — Stage réception](https://emploi.ms-vacances.com/jobs/8557942-stage-receptionniste-h-f) | Camping Les Brunelles (85) | Stage avril–juin, puis CDD juillet–août | Non compté ; stage principal |
| [8552923 — Responsable entretien](https://emploi.ms-vacances.com/jobs/8552923-responsable-agent-d-entretien-h-f) | Camping Médoc Plage (33) | CDD saisonnier, date isolée 11/01/2026 | Période à vérifier, non compté |
| [8549717 — Responsable réception](https://emploi.ms-vacances.com/jobs/8549717-responsable-reception-h-f) | Camping Plage Sud, Biscarrosse (40) | CDI dès 16/11/2026 | Hors saisonnier |
| [8544199 — Responsable réception](https://emploi.ms-vacances.com/jobs/8544199-responsable-reception-h-f) | Camping Navarrosse Plage (40) | CDD saisonnier, janvier–octobre 2027 | Dossier exploitable |
| [8515304 — Responsable épicerie](https://emploi.ms-vacances.com/jobs/8515304-responsable-epicerie-h-f) | Camping Les Brunelles (85) | CDD cadre, début février–mi-octobre sans année | Saisonnier à établir, non compté |
| [8514707 — Responsable entretien](https://emploi.ms-vacances.com/jobs/8514707-responsable-agent-d-entretien-h-f) | Camping Les Tourterelles (40) | CDD saisonnier, 01/03–31/10/2027 | Dossier exploitable |
| [8490042 — Stage réception](https://emploi.ms-vacances.com/jobs/8490042-stage-receptionniste-h-f) | Camping Le Littoral (66) | Stage avril–juin, puis CDD juillet–août | Non compté ; stage principal |
| [8489997 — Stage réception](https://emploi.ms-vacances.com/jobs/8489997-stage-receptionniste-h-f) | Camping Les Tamaris (66) | Stage avril–juin, puis CDD juillet–août | Non compté ; stage principal |
| [8489902 — Stage réception](https://emploi.ms-vacances.com/jobs/8489902-stage-receptionniste-h-f) | Camping Côte des Roses (11) | Stage mai–juin, puis CDD juillet–août | Non compté ; stage principal |

Réservoir exploratoire de réserve : `24 × 2/10`, arrondi vers le bas, soit environ **4 dossiers**, avant déduplication. Le petit échantillon non aléatoire ne démontre pas un rendement stable. Décision proposée : `reserve`, priorité après les deux sources principales, activation et conditions encore soumises au fondateur.

## Réservoir et sources écartées

L'objectif porte sur des dossiers exploitables en revue, pas sur des annonces déjà publiables. Extrapolation exploratoire à partir des lectures, **avant déduplication métier**, arrondie vers le bas par source : Belambra `94 × 9/10 ≈ 84` ; VVF `27 × 7/10 ≈ 18`, soit environ **102 dossiers potentiels**, hors réserve. Ce calcul applique des taux observés à des URL uniques réellement lues dans les listes ; il ne reprend pas un compteur commercial. Les vingt fiches principales ne sont pas un échantillon aléatoire : le regroupement par date et établissement limite la confiance dans l'extrapolation. Les dates absentes de Belambra, l'identité des lieux, les contradictions et les doublons peuvent réduire le résultat. Le seuil de 70 n'est pas encore confirmé en preview ni par extraction.

**Décision technique proposée :** conserver Belambra et VVF en `primary` pour la qualification, et MS Vacances en `reserve`. Aucun extracteur n'est ajouté dans ce plan. L'[API SmartRecruiters](https://api.smartrecruiters.com/v1/companies/Accor/postings?country=fr) est **écartée** : à 12:33 UTC, le client renvoie `robots_disallowed`. Le [robots.txt](https://api.smartrecruiters.com/robots.txt) répond HTTP 200, autorise seulement `LinkedInBot` sur `/v1/companies/` et contient `User-agent: *`, `Disallow: /`. Notre bot ne prend pas une autre identité ; aucune liste ni fiche n'a été lue. Le fait que l'API réponde sans clé, observé dans le plan, ne remplace pas cette vérification d'accès.

Sandaya et PVCP restent des pistes écartées du registre V1 tant qu'une liste accessible sans JavaScript n'est pas établie. Aucun navigateur automatisé, contournement de refus ni rendu JavaScript n'est ajouté.

## Fixtures et limites de la couverture

Les [fixtures Belambra](../../src/server/scan/sources/fixtures/belambra/README.md), [VVF](../../src/server/scan/sources/fixtures/vvf/README.md) et [MS Vacances](../../src/server/scan/sources/fixtures/ms-vacances/README.md) conservent les listes réelles et six fiches maximum par source. Scripts exécutables, images, suivis et jetons CSRF retirés ; contacts fictifs `.example` et tranches de fiction. Les tests contrôlent l'anonymisation et les diagnostics sur ces captures, sans appeler les sites.

Cas capturés : contrat saisonnier, CDD de remplacement seul, CDI, contrat contradictoire, période libre, période partielle, salaire sans base, logement possible, formulaire seul, plusieurs recrutements et clôture explicite. L'[ancienne fiche VVF 318954](https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-318954), capturée à 12:17:39 UTC, répond HTTP 200 mais annonce que l'offre n'existe plus : un succès HTTP ne prouve pas qu'un recrutement est actif. Une durée contractuelle seule n'a pas été rencontrée ; conserver cette limite pour les tests d'extraction du plan 05, sans fabriquer une capture prétendument réelle.

## Validation à consigner

- [ ] Résultats de la sonde depuis une preview Vercel : liste et trois fiches de chaque source principale.
- [ ] Choix `primary` / `reserve`, conditions de reprise et restriction Belambra validés par le fondateur (date et décision).
- [x] Réserve ajoutée sans extrapoler son volume.
- [x] Trente fiches examinées et captures anonymisées disponibles pour les prochains tests.
