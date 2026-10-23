# Sources du scan V1 — dossier du 23 octobre 2026

## État de la décision

Implémentation du plan 01 sur `plan/scan-01-sources-client-http`. **France Travail est la découverte prioritaire**, sur la recherche choisie par le fondateur. Belambra, VVF et MS Vacances restent des portails de réserve. L'API SmartRecruiters a été écartée après refus de robots.txt. Le registre ne lance aucun passage et ne publie aucune offre.

**Décisions du fondateur, 23/10/2026 :** la proposition Belambra / VVF principales a été refusée ; le fondateur a ensuite demandé explicitement d'ajouter France Travail comme source prioritaire et fourni l'URL et ses filtres. Cette instruction fonde SH17. Les portails précédents sont conservés en réserve technique, sans activation. Une lecture autorisée par robots.txt ne constitue pas une autorisation de republier les annonces.

## Accès depuis la preview

**Sonde authentifiée exécutée par le fondateur**, diagnostics du panneau transmis dans la session le 23/10/2026. Déploiement exact : <https://saisonnier-4s3w7njrs-francois-noels-projects.vercel.app>. Les heures affichées sont celles d'Europe/Paris. La [PR #32](https://github.com/francoisnoel62/saisonnier/pull/32) expose aussi son [alias de preview](https://saisonnier-git-plan-scan-01-sour-2b72fa-francois-noels-projects.vercel.app/admin/scan). L'accès anonyme répond 302 vers le SSO Vercel ; le fondateur a utilisé son accès admin, sans contournement des protections.

Parcours : ouvrir `/admin/scan` avec un compte admin ; pour chaque source principale, « Tester l’accès depuis ce déploiement ». Conserver le résultat du panneau et le journal `[scan sonde]`, avec URL exacte du déploiement, date, HTTP, URL finale, durée, octets, décisions robots, JSON-LD, RSS et pagination. La sonde lit la première liste et jusqu'à trois fiches, et s'arrête au premier échec. Aucun contenu d'annonce n'est envoyé au navigateur ou journalisé.

| Source | Déploiement | Date | Liste | Trois fiches | Preuve |
|---|---|---|---|---|---|
| Belambra | `saisonnier-4s3w7njrs-francois-noels-projects.vercel.app` | 23/10/2026 14:44 Paris | HTTP 200 | Trois HTTP 200 | Diagnostics transmis par le fondateur |
| VVF | Même déploiement | 23/10/2026 14:45 Paris | HTTP 200 | Trois HTTP 200 | Diagnostics transmis par le fondateur |
| France Travail, nouvelle priorité | À redéployer après l'ajout SH17 | En attente | — | — | Sonde à exécuter après déploiement |

Toutes les URL finales sont identiques aux URL demandées. Pour les huit requêtes : robots.txt HTTP 200, lecture autorisée, Crawl-delay 0 ms ; aucune pagination détectée. Détail fidèle des diagnostics :

| Source / requête | URL demandée et finale | HTTP | Durée | Octets | JobPosting JSON-LD | Éléments RSS / liens de fiche |
|---|---|---|---|---|---|---|
| Belambra liste | <https://recrute.belambra.fr/jobs.rss> | 200 | 2046 ms | 373281 | absent | 94 / 94 |
| Belambra fiche 1 | <https://recrute.belambra.fr/jobs/8588693-second-de-cuisine-h-f> | 200 | 1813 ms | 52668 | présent, valide | 0 / 1 |
| Belambra fiche 2 | <https://recrute.belambra.fr/jobs/8585963-responsable-restauration-h-f> | 200 | 1943 ms | 54629 | présent, valide | 0 / 1 |
| Belambra fiche 3 | <https://recrute.belambra.fr/jobs/8584535-chef-de-cuisine-h-f> | 200 | 1964 ms | 56374 | présent, JSON invalide | 0 / 1 |
| VVF liste | <https://vvfrecrute.factorial.fr/> | 200 | 2056 ms | 74914 | absent | 0 / 27 |
| VVF fiche 1 | <https://vvfrecrute.factorial.fr/job_posting/assistant-e-commercial-grands-comptes-h-f-327834> | 200 | 2107 ms | 33556 | absent | 0 / 0 |
| VVF fiche 2 | <https://vvfrecrute.factorial.fr/job_posting/responsable-de-maintenance-h-f-326869> | 200 | 1944 ms | 32736 | absent | 0 / 0 |
| VVF fiche 3 | <https://vvfrecrute.factorial.fr/job_posting/responsable-de-maintenance-h-f-326866> | 200 | 2054 ms | 32826 | absent | 0 / 0 |

## France Travail — découverte prioritaire (SH17)

### Recherche et provenance

Le fondateur a fourni cette [recherche exacte](https://candidat.francetravail.fr/offres/recherche?domaine=G&emission=3&lieux=99100&offresPartenaires=false&range=0-19&rayon=10&tri=1&typeContrat=SAI) : France (`99100`), domaine G, contrat saisonnier (`SAI`), filtre « Date de création : Trois jours » (`emission=3`), offres partenaires désactivées, tri par date (`tri=1`), premier lot `0-19`. Le générateur de pagination change uniquement `range`, sur 20 pages au maximum. Les tests figent tous les paramètres fournis. Le critère de trois jours concerne la création des offres ; aucune durée de contrat minimale de trois jours n'est déduite.

Le service est celui de France Travail, décrit par ses [CGU officielles](https://www.francetravail.fr/informations/informations-legales-et-conditio/conditions-generales-dutilisatio.html). Il s'agit d'un **diffuseur de découverte**, pas de l'employeur des recrutements : le registre impose `kind="discovery"`, `employer=null`, `employerWebsite=null`. Le filtre sans partenaires n'établit pas que chaque annonce vient directement de son employeur final : des agences d'intérim apparaissent dans la liste.

### Accès et conditions

La liste HTML est lisible sans compte ni JavaScript. Le HTML de détail n'expose que le cadre et les métadonnées ; la description utile vient du composant officiel `descriptif-offre`. Sa configuration publique indique le chemin **sur le même hôte**, `/api-descriptifoffre/offre/<id>`. La sonde lit ce JSON et conserve la fiche publique `/offres/recherche/detail/<id>` dans son résultat. Aucun navigateur automatisé, rendu JavaScript, cookie de session ou jeton n'est utilisé. Les tests utilisent les captures HTML et JSON, sans accès réel.

Ce service public du composant est distinct de l'[API partenaire Offres d'emploi](https://www.data.gouv.fr/dataservices/api-offres-demploi), toujours indiquée comme restreinte. Les CGU évoquent la réutilisation par des partenaires adhérant à une licence, hors données de contact ; l'autorisation de republication du contenu lu par cette voie n'est pas établie ici. Le choix du fondateur porte sur la découverte prioritaire. La publication conserve l'exigence d'une source et d'un canal officiels employeur ; aucune licence, adhésion ou autorisation commerciale n'est présumée.

Le [robots.txt](https://candidat.francetravail.fr/robots.txt), HTTP 200, permet la recherche, les fiches et ce JSON public ; pas de Crawl-delay. Il interdit notamment les espaces de compte, les sélections, les recherches enregistrées et les URL contenant `t:ac=`. La sonde ne suit pas ces actions ni les liens de candidature de ce type.

### Mesures depuis le poste

- Première liste le 23/10/2026 à 12:51:33 UTC : HTTP 200, 136 141 octets, 20 liens de fiche uniques. Pagination « Afficher les 20 offres suivantes » détectée.
- Dix cadres de fiche HTML et leurs dix JSON publics lus en HTTP 200 entre 12:51 et 12:59 UTC. Les JSON font de 2 229 à 29 395 octets. Pas de JSON-LD `JobPosting` : le détail est un document JSON propre au site.
- Inventaire borné de dix pages entre 13:01:09 et 13:01:27 UTC : neuf pages contenant respectivement `20, 20, 20, 20, 20, 20, 20, 20, 10` liens, puis une page vide. **170 URL distinctes réellement lues**, après déduplication des URL ; aucun volume n'est déduit du compteur affiché par le site. L'[inventaire daté](france-travail-inventory-2026-10-23.json) conserve les URL et les mesures de chaque page, sans données de contact.

### Échantillon réparti de dix fiches

Pour éviter le biais des seules premières offres, lecture de dix JSON aux rangs `0, 17, 34, 51, 68, 85, 102, 119, 136, 153` de l'inventaire. Captures HTTP 200 du 23/10/2026 de 13:03:56 à 13:04:14 UTC. Le canal de découverte est France Travail ; le canal officiel employeur reste à établir pour tous les dossiers. `dateDerniereModification` n'est pas assimilée à une date de création.

| Rang / fiche | Lieu / secteur | Contrat et période observés | Décision pour l'estimation |
|---|---|---|---|
| [0 / 215PYPJ — Accueil réservation](https://candidat.francetravail.fr/offres/recherche/detail/215PYPJ) | Aussois (73), domaine skiable et hébergements | Saisonnier, durée seule de 4 mois | Exploitable en revue ; dates à préciser |
| [17 / 215PSSB — Cuisinier](https://candidat.francetravail.fr/offres/recherche/detail/215PSSB) | Marseille (13), agence IZIWORK | Saisonnier 31 jours ; préconisations médicales | Hors tourisme de loisirs établi, non compté |
| [34 / 215PNYM — Chef de rang](https://candidat.francetravail.fr/offres/recherche/detail/215PNYM) | La Toussuire (73), restauration en station | Saison hiver 2026/2027, mi-décembre–fin mars, nourri/logé | Exploitable en revue |
| [51 / 215NXXQ — Polyvalent collectivité](https://candidat.francetravail.fr/offres/recherche/detail/215NXXQ) | Saint-Jean-Saint-Nicolas (05), centres de vacances | Métadonnée saisonnier, début 02/01/2027 ; CDD 3, 6 ou 9 mois | Exploitable en revue ; durée à confirmer |
| [68 / 215NMHF — Cuisinier](https://candidat.francetravail.fr/offres/recherche/detail/215NMHF) | Tignes (73), restaurant de station | CDD saisonnier, décembre–mars, logement partagé | Exploitable en revue |
| [85 / 215MSYG — Serveur](https://candidat.francetravail.fr/offres/recherche/detail/215MSYG) | Val Cenis (73), centre de vacances | Saison hiver, 9 décembre–17 avril, nourri/logé | Exploitable en revue ; années à préciser |
| [102 / 215MCPD — Assistant manager](https://candidat.francetravail.fr/offres/recherche/detail/215MCPD) | Megève (74), La Folie Douce | CDD saisonnier, durée de 4 mois, logement fourni | Exploitable en revue ; dates à préciser |
| [119 / 215LPWJ — Réceptionniste](https://candidat.francetravail.fr/offres/recherche/detail/215LPWJ) | Mandelieu (06), hôtel | Saison 2027, juin–octobre | Exploitable en revue ; présentation entreprise avec ancien forum 2025 à signaler |
| [136 / 215LJND — Plongeur](https://candidat.francetravail.fr/offres/recherche/detail/215LJND) | Auron (06), restaurant en station | Saisonnier, décembre–mars, nourri/logé | Exploitable en revue ; années à préciser |
| [153 / 215LDDQ — Chef de cuisine](https://candidat.francetravail.fr/offres/recherche/detail/215LDDQ) | Portbail (50), hôtel de station balnéaire | Métadonnée saisonnier 8 mois, texte CDD ou CDI | Contrat contradictoire, non compté par prudence |

**Réservoir exploratoire de France Travail : `170 × 8/10 = 136 dossiers potentiels de revue`**, avant déduplication métier et recherche des sources officielles. Il dépasse la marge de 70 dossiers visée par le plan. Cet échantillon systématique reste petit, non aléatoire et sensible aux annonces publiées/retirées pendant le relevé ; ce n'est ni un stock confirmé ni une promesse de publication. Les sources employeurs de réserve ne sont pas additionnées automatiquement : elles peuvent recouper France Travail.

Décision du fondateur consignée : France Travail prioritaire sur la recherche fournie, le 23/10/2026. Son accès doit encore être sondé depuis la nouvelle preview ; aucun champ métier n'est extrait ou enregistré par ce plan.

## Belambra — Teamtailor, réserve (relevé de la proposition initiale)

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

## VVF — Factorial, réserve (relevé de la proposition initiale)

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

**Sélection mise à jour selon SH17 :** France Travail `primary`, priorité 0 ; Belambra, VVF et MS Vacances `reserve`, sans activation automatique. L'ancienne estimation Belambra/VVF ci-dessus documente seulement les réserves et ne remplace pas l'estimation de la source prioritaire. Aucun extracteur n'est ajouté dans ce plan. L'[API SmartRecruiters](https://api.smartrecruiters.com/v1/companies/Accor/postings?country=fr) est **écartée** : à 12:33 UTC, le client renvoie `robots_disallowed`. Le [robots.txt](https://api.smartrecruiters.com/robots.txt) répond HTTP 200, autorise seulement `LinkedInBot` sur `/v1/companies/` et contient `User-agent: *`, `Disallow: /`. Notre bot ne prend pas une autre identité ; aucune liste ni fiche n'a été lue. Le fait que l'API réponde sans clé, observé dans le plan, ne remplace pas cette vérification d'accès.

Sandaya et PVCP restent des pistes écartées du registre V1 tant qu'une liste accessible sans JavaScript n'est pas établie. Aucun navigateur automatisé, contournement de refus ni rendu JavaScript n'est ajouté.

## Fixtures et limites de la couverture

Les [fixtures France Travail](../../src/server/scan/sources/fixtures/france-travail/README.md), [Belambra](../../src/server/scan/sources/fixtures/belambra/README.md), [VVF](../../src/server/scan/sources/fixtures/vvf/README.md) et [MS Vacances](../../src/server/scan/sources/fixtures/ms-vacances/README.md) conservent les listes réelles et six fiches maximum par source. France Travail comprend aussi son cadre HTML, sans confondre les recommandations annexes avec la description du poste. Scripts exécutables, images, suivis et jetons CSRF/Tapestry retirés ; contacts fictifs `.example` et tranches de fiction. Les tests contrôlent l'anonymisation et les diagnostics sur ces captures, sans appeler les sites.

Cas capturés : contrat saisonnier, CDD de remplacement seul, CDI, contrat contradictoire, période libre, période partielle, durée seule (France Travail : 4 mois), salaire sans base, logement possible, formulaire seul, plusieurs recrutements et clôture explicite. L'[ancienne fiche VVF 318954](https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-318954), capturée à 12:17:39 UTC, répond HTTP 200 mais annonce que l'offre n'existe plus : un succès HTTP ne prouve pas qu'un recrutement est actif.

## Validation à consigner

- [x] Résultats de la sonde de la proposition initiale depuis une preview Vercel : liste et trois fiches de chaque source principale.
- [x] Décision du fondateur du 23/10/2026 consignée : France Travail prioritaire sur sa recherche fournie ; ancienne proposition principale refusée. Conditions et restrictions documentées, aucune activation ou autorisation de publication présumée.
- [x] Réserve ajoutée sans extrapoler son volume.
- [x] Quatre échantillons de dix fiches examinées et captures anonymisées disponibles pour les prochains tests.
