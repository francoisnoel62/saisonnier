# Sources du scan V1 — dossier du 23 octobre 2026

## État de la décision

Implémentation du plan 01 sur `plan/scan-01-sources-client-http`. Belambra et VVF sont proposées comme sources principales ; Accor/SmartRecruiters est ajouté comme réserve à qualifier. Le registre ne lance aucun passage et ne publie aucune offre.

**Validation du fondateur : en attente.** Il reste à confirmer le choix des sources et leurs conditions de reprise. Une lecture autorisée par robots.txt ne constitue pas une autorisation de republier les annonces. Aucune décision du fondateur n'est déduite de l'instruction d'implémenter le plan.

## Accès depuis la preview

**À réaliser après le déploiement de la PR.** Les relevés ci-dessous proviennent du poste de développement et ne prouvent pas un accès depuis Vercel.

Parcours : ouvrir `/admin/scan` avec un compte admin ; pour chaque source principale, « Tester l’accès depuis ce déploiement ». Conserver le résultat du panneau et le journal `[scan sonde]`, avec URL exacte du déploiement, date, HTTP, URL finale, durée, octets, décisions robots, JSON-LD, RSS et pagination. La sonde lit la première liste et jusqu'à trois fiches, et s'arrête au premier échec. Aucun contenu d'annonce n'est envoyé au navigateur ou journalisé.

| Source | Déploiement | Date | Liste | Trois fiches | Preuve |
|---|---|---|---|---|---|
| Belambra | En attente | — | — | — | — |
| VVF | En attente | — | — | — | — |

## Belambra — Teamtailor

- Site employeur : <https://www.belambra.fr/>. Liste : <https://recrute.belambra.fr/jobs.rss> ; fiches `/jobs/<id>-<slug>`.
- Rattachement : la [FAQ officielle](https://www.belambra.fr/faq-foire-aux-questions) renvoie les candidatures vers `recrute.belambra.fr`. Les [mentions légales](https://www.belambra.fr/mentions-legales) établissent Belambra Clubs, SIREN `322706136`. Le groupe du registre n'impose pas une entité juridique à toutes ses offres.
- Reprise : les mentions du site principal prévoient une autorisation écrite préalable de reproduction hors copie privée. Leur portée sur le portail ATS et l'autorisation de reprise doivent être validées avant activation. La [politique du portail](https://recrute.belambra.fr/privacy-policy) doit être examinée avec les mentions du site principal ; elle concerne notamment les données des candidats, qui ne sont jamais collectées.
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
- Reprise : les [conditions générales d'utilisation du site](https://www.vvf.fr/article/conditions-generales-utilisation-site-internet) interdisent la reproduction hors usage privé et non commercial. Examiner leur portée sur Factorial, les mentions et la politique de confidentialité liée depuis le portail. Aucune autorisation de republication explicite n'a été établie dans cette session ; décision du fondateur attendue.
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

## Réservoir et réserve

L'objectif porte sur des dossiers exploitables en revue, pas sur des annonces déjà publiables. Extrapolation exploratoire à partir des lectures, **avant déduplication métier** : Belambra `94 × 9/10 ≈ 84` ; VVF `27 × 7/10 ≈ 18`, soit environ **102 dossiers potentiels**. Ce calcul applique des taux observés à des URL uniques réellement lues dans les listes ; il ne reprend pas un compteur commercial. Les vingt fiches ne sont pas un échantillon aléatoire : le regroupement par date et établissement limite la confiance dans l'extrapolation. Les dates absentes de Belambra, l'identité des lieux, les contradictions et les doublons peuvent réduire le résultat. Le seuil de 70 n'est pas encore confirmé en preview ni par extraction.

**Décision technique proposée :** conserver Belambra et VVF en `primary` pour la qualification, et ajouter **Accor / API SmartRecruiters** en `reserve` avant le plan 05. Cette réserve ne contribue pas au total estimé et ne reçoit aucun extracteur dans ce plan. Le [portail officiel Accor](https://careers.accor.com/) doit encore être relié à [l'API de liste](https://api.smartrecruiters.com/v1/companies/Accor/postings?country=fr) avec preuve, conditions et échantillon de dix fiches ; le tourisme de loisirs doit être établi employeur par employeur. Ne pas attribuer un même SIREN à tous les hôtels du groupe.

Sandaya et PVCP restent des pistes écartées du registre V1 tant qu'une liste accessible sans JavaScript n'est pas établie. Aucun navigateur automatisé, contournement de refus ni rendu JavaScript n'est ajouté.

## Fixtures et limites de la couverture

Les [fixtures Belambra](../../src/server/scan/sources/fixtures/belambra/README.md) et [VVF](../../src/server/scan/sources/fixtures/vvf/README.md) conservent les listes réelles et six fiches maximum par source. Scripts exécutables, images et suivis retirés ; contacts fictifs `.example` et tranches de fiction. Les tests contrôlent l'anonymisation et les diagnostics sur ces captures, sans appeler les sites.

Cas capturés : contrat saisonnier, CDD de remplacement seul, CDI, contrat contradictoire, période libre, période partielle, salaire sans base, logement possible, formulaire seul, plusieurs recrutements et clôture explicite. L'[ancienne fiche VVF 318954](https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-318954), capturée à 12:17:39 UTC, répond HTTP 200 mais annonce que l'offre n'existe plus : un succès HTTP ne prouve pas qu'un recrutement est actif. Une durée contractuelle seule n'a pas été rencontrée ; conserver cette limite pour les tests d'extraction du plan 05, sans fabriquer une capture prétendument réelle.

## Validation à consigner

- [ ] Résultats de la sonde depuis une preview Vercel : liste et trois fiches de chaque source principale.
- [ ] Choix `primary` / `reserve`, conditions de reprise et restriction Belambra validés par le fondateur (date et décision).
- [x] Réserve ajoutée sans extrapoler son volume.
- [x] Vingt fiches examinées et captures anonymisées disponibles pour les prochains tests.
