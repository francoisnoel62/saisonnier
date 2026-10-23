# Recherche — sources du scan sans IA

**Date de vérification : 23 octobre 2026. Statut : exploration, sans choix fournisseur définitif ni implémentation.**

**Évolution du cadrage :** le [plan V1–V5](./plan-technique-scan-v1-v5.md) propose un lancement V1 par sources ciblées, avec au moins 50 annonces distinctes et exploitables à vérifier par l'admin en moins de six heures après installation/lancement. La publication n'est pas requise dans ce délai. Le fondateur autorise les annonces plus anciennes pour ce seul remplissage initial, sans signal de clôture. Les 72 heures restent la fenêtre quotidienne ; les moteurs de recherche restent proposés en V3. Une source officielle employeur encore manquante bloque la publication, pas l'admission d'un dossier exploitable à la revue. Les recommandations initiales ci-dessous sont à lire avec cette évolution.

Périmètre : découverte quotidienne d'offres saisonnières en France, sans appels LLM ni extraction générative, avec un objectif de 0 € de services supplémentaires hors Vercel. Recherche documentaire exclusivement ; aucun compte créé, aucun identifiant testé, aucun appel API payant effectué. Le rendement réel sur le tourisme et l'hôtellerie de loisirs reste à mesurer.

## Conclusion provisoire

Le programme peut découvrir des URL par une API de recherche classique, lire la source officielle et transmettre les cas incomplets à l'admin. La difficulté principale est l'accès aux sources et la couverture obtenue avec un quota limité. Rien dans les sources consultées ne permet de promettre une collecte gratuite exhaustive d'Indeed, LinkedIn et France Travail.

Le [cahier des charges du scan](./cahier-des-charges-scan-saisonnier-v1.md), §§1, 4 et 6, distingue déjà les pistes de découverte des sources admissibles à la publication : un résultat de moteur ou de job-board ne suffit pas. Il faut établir le site officiel de l'employeur ou son portail de recrutement lié officiellement. Un formulaire officiel seul reste admissible, avec « Candidature externe ».

## Moteurs de recherche programmables

### Tavily Search

L'offre gratuite annonce **1 000 crédits mensuels, sans carte bancaire**. Une recherche `basic` coûte un crédit ; `advanced` en coûte deux. Il s'agit d'un quota, pas d'une gratuité illimitée. [Tarification officielle](https://docs.tavily.com/documentation/api-credits)

L'API HTTP `POST https://api.tavily.com/search` utilise une clé. Pour cette exploration : `search_depth: "basic"`, `include_answer: false`, `include_raw_content: false`, `auto_parameters: false`. La réponse générée par LLM est facultative ; la configuration automatique pourrait autrement sélectionner `advanced`. Les recherches renvoient jusqu'à 20 résultats. Les paramètres `start_date` et `end_date` sont des dates civiles ; `published_date` est une estimation de publication **ou de modification**, et peut être `null`. `filter_by_published_date: true` élimine aussi les résultats sans date. [Référence officielle Search](https://docs.tavily.com/documentation/api-reference/endpoint/search)

**Conséquence pour le projet :** utiliser ces dates pour orienter la découverte, puis établir la date de l'annonce sur la source officielle. Elles ne démontrent pas à elles seules le respect des 72 heures. Proposition d'essai : 20 recherches/jour représentent 620 crédits pour 31 jours, laissant une réserve pour retrouver les employeurs et reprendre les échecs. Ce calcul ne prédit aucun nombre d'offres publiables.

« Sans IA » signifie ici sans génération ni qualification LLM dans notre scan ; cela ne certifie pas l'absence d'apprentissage automatique dans le moteur tiers.

### Brave Web Search

La page actuelle affiche **5 $ par 1 000 requêtes Search**, avec **5 $ de crédits gratuits chaque mois**, soit environ 1 000 recherches à ce tarif. Une carte bancaire est demandée pour prévenir les abus ; le fonctionnement annoncé est prépayé. Le bandeau « jusqu'à 20 $ » ne doit pas être interprété comme 20 $ utilisables pour la seule recherche Web. La conservation des résultats nécessite un plan incluant les droits de stockage, à vérifier lors du choix du compte. [Tarification et FAQ officielles](https://brave.com/search/api/)

`GET https://api.search.brave.com/res/v1/web/search` est documenté avec clé dans `X-Subscription-Token`. Le service propose pays, langue, domaines/opérateurs et plages de dates. L'endpoint Web Search suffit à obtenir des pistes ; aucun besoin d'utiliser Answers. [Documentation officielle Web Search](https://api-dashboard.search.brave.com/documentation/services/web-search)

**Position provisoire :** alternative à comparer sur un même échantillon si la carte et les conditions du plan conviennent. Ne pas inscrire l'ancien quota de « 2 000 recherches gratuites » dans le plan. Prévoir un plafond applicatif et aucun achat automatique de crédits.

## Accès aux principaux job-boards

| Source | État vérifié | Conséquence proposée |
|---|---|---|
| France Travail | La fiche officielle indique que l'API n'est actuellement plus exposée, pendant un réexamen des modalités de distribution/réutilisation. L'accès est marqué **restreint** ; une demande via le formulaire de contact est prévue. Les capacités décrites comprennent recherche et détail des offres. [Fiche officielle publiée par France Travail](https://www.data.gouv.fr/dataservices/api-offres-demploi) | Ne pas dépendre de cette API pour lancer la V1. Prévoir un connecteur uniquement après accès accordé et conditions connues. Aucun accès n'a été démontré ici. |
| Indeed | La documentation actuelle décrit des API de création/gestion de postes et, pour afficher des offres aux visiteurs, un **Publisher JavaScript Plugin** côté navigateur. [Présentation des intégrations](https://docs.indeed.com/job-postings) Ce plugin exige le statut de partenaire puis un accès demandé à son interlocuteur Indeed. [Prérequis du plugin](https://docs.indeed.com/indeed-plus/publisher-js-plugin) | Ne pas confondre publication de nos annonces, widget de recherche et export général exploitable par un cron. Aucun accès libre à une API générale de collecte n'est établi par ces documents. Indeed peut rester une piste quand un moteur indexe une annonce. |
| LinkedIn | Les permissions ouvertes couvrent identité/email et partage social ; les intégrations Talent passent par des programmes partenaires. [Accès officiels aux API](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) | Ne pas supposer qu'une clé développeur donne une recherche générale d'offres. Ne pas prévoir ce connecteur sans accès adapté. Les résultats indexés restent des pistes à rapprocher d'une source employeur. |

Ces conclusions portent sur ce qui est documenté et disponible pour concevoir notre démarrage ; elles ne signifient pas qu'aucun partenariat particulier ne serait possible. Un MCP enveloppant une source n'accorde pas à lui seul ses droits d'accès ni son quota. Choisir un protocole ne résout donc pas les restrictions ci-dessus.

## Deux exemples d'ATS lisibles par code

Un ATS est un outil de gestion des recrutements utilisé par un employeur. Les exemples suivants montrent des formats exploitables après identification d'une offre et de l'employeur ; leur adoption réelle par nos établissements cibles n'a pas été mesurée.

| ATS | Accès public documenté | Utilisation limitée à la V1 |
|---|---|---|
| Greenhouse | Les endpoints `GET` de Job Board API ne demandent pas d'authentification. `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}` renvoie le détail d'un poste. Le schéma distingue notamment `first_published` et `updated_at`, avec description et URL. [Documentation officielle](https://docs.greenhouse.io/job-board) | Lire l'offre identifiée, après preuve que ce portail appartient au parcours de recrutement de l'employeur. Ne pas utiliser une date de modification comme date de publication. |
| Lever | La Postings API expose les annonces publiées par site employeur ; `GET /v0/postings/SITE/POSTING-ID` renvoie une offre en JSON, avec description, catégories, `hostedUrl` et `applyUrl`. Elle ne fournit pas de recherche plein texte globale sur les offres. [Dépôt officiel Lever](https://github.com/lever/postings-api) | Lire le détail d'un recrutement déjà identifié et son formulaire officiel. Un texte présent dans du JSON peut rester ambigu et nécessiter l'admin. |

Ces API ne constituent pas un annuaire exhaustif des employeurs français. Le parcours récurrent complet des entreprises reste prévu en V2, tandis que le remplissage initial limité de la V1 bénéficie désormais de l'exception validée par le fondateur. Un domaine d'ATS ou une marque dans une URL ne prouve pas seul l'affiliation à l'employeur.

## Recommandation initiale pour la recherche Web, désormais proposée en V3

1. Évaluer d'abord Tavily Search Basic comme découverte plafonnée, puis Brave seulement si nécessaire ; récupérer les pages officielles et leurs données structurées avec notre code.
2. Conserver les interfaces des sources remplaçables. Les accès Indeed, LinkedIn et France Travail restent optionnels tant qu'ils ne sont pas accordés et adaptés à ce traitement.
3. Réserver une partie des recherches à la remontée vers les sources employeurs. Consigner séparément URL de découverte, URL officielle et preuve du rattachement.
4. Mesurer sur un petit échantillon : pistes distinctes, sources officielles retrouvées, pages lisibles, critères obligatoires établis, cas admin, crédits consommés. Un quota de requêtes ne se traduit pas directement en nombre d'annonces.
5. Pour préserver le budget nul, arrêter proprement les appels au plafond choisi. Une panne, un blocage ou un quota épuisé doit produire un passage partiel traçable ; aucune promesse de collecte complète dans ce cas.

Les choix d'extracteurs HTML, la qualification déterministe, les reprises, l'interface admin et les contraintes d'exécution Vercel relèvent de la suite de l'exploration ; cette note vérifie les sources et ne constitue pas le plan technique.

## Apports de l’étude transmise le 23 octobre

Vérification ciblée de quatre pistes du panorama fourni par le fondateur. **Accès public, coût nul, droit de réutilisation et compatibilité avec notre parcours employeur sont quatre questions distinctes.** Aucun compte ni demande d'accès n'a été créé. La consultation ponctuelle d'un flux public ci-dessous via l'outil Web ne constitue pas un essai de notre futur collecteur depuis Vercel.

| Source | Faits confirmés par la source primaire | Conséquence pour notre périmètre |
|---|---|---|
| **EasyJobs** | Requêtes publiques sans compte ; identification partenaire facultative soumise à validation manuelle. Filtres France, métier, contrat et ancienneté ; plafond documentaire initial de 60 requêtes/minute/IP, susceptible d'évolution. Le détail abrège la description à **600 caractères maximum**, n'expose aucune URL externe de candidature et demande d'afficher `job_url` vers EasyJobs avec son attribution. [Documentation](https://api.easyjobs.fr/public/docs/), [schéma OpenAPI](https://api.easyjobs.fr/public/openapi.json) | L'accès anonyme est confirmé ; aucune garantie de gratuité perpétuelle ni licence ouverte générale de republication n'est établie par ces documents. La diffusion prévue avec lien EasyJobs contredit nos liens publics exclusivement employeur. Une utilisation interne pour découvrir puis retrouver indépendamment l'offre employeur ne doit pas être considérée comme automatiquement autorisée par la description de l'API. À garder comme piste conditionnelle, pas comme connecteur acquis. |
| **Arbeitnow** | L'API générale est annoncée gratuite et sans clé, alimentée notamment par des ATS. [Présentation officielle](https://www.arbeitnow.com/blog/job-board-api) L'origine allemande ne résume plus la couverture : une [déclinaison officielle France](https://www.arbeitnow.fr/) existe et son lien « Jobs API » mène à un [flux JSON français consultable](https://www.arbeitnow.fr/api/job-board-api), avec des postes localisés en France et des URL Arbeitnow. Les conditions API demandent un lien retour vers Arbeitnow.com ; la licence générale du site limite par ailleurs l'usage commercial sans expliciter son articulation avec l'API. [Conditions France, §§2 et 11](https://www.arbeitnow.fr/terms) | Corriger l'idée « Allemagne seulement », mais ne pas en déduire une couverture saisonnière française significative : elle n'a pas été mesurée. Clarifier les droits commerciaux et le lien retour avant adoption ; ils ne sont pas compatibles d'office avec l'absence de lien public vers un agrégateur. Les champs et descriptions observés ne dispensent pas de retrouver la source officielle ni de vérifier la langue française et le caractère saisonnier. |
| **Jobicy** | API publique gratuite sans clé, dédiée au **télétravail**, avec pagination jusqu'à 200 offres/page sur les sept derniers jours. Usage commercial, stockage et redistribution explicitement permis sous conditions d'attribution. Les liens de candidature de l'API gratuite doivent continuer à mener à Jobicy. Les liens ATS originaux nécessitent une clé et un portefeuille : **0,01 $ par offre disposant d'un lien direct, une fois par clé**. [Documentation et conditions officielles](https://jobicy.com/jobs-rss-feed) | La gratuité existe mais son parcours public ne correspond pas au nôtre. La formule avec liens ATS est payante. L'éligibilité remote depuis la France ne démontre ni un poste saisonnier ni son appartenance au tourisme/loisirs ; priorité faible pour cette V1. |
| **Jooble** | La documentation actualisée le 16 août 2026 confirme **500 requêtes gratuites au total à vie par clé**, et une clé propre au pays interrogé. La réponse comporte un extrait, un lien Jooble et une date de mise à jour. [Documentation officielle](https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation) | Quota adapté à un essai limité, sans capacité gratuite renouvelable démontrée pour le cron quotidien. Le lien Jooble ne devient pas un canal public admissible ; `updated` ne prouve pas la publication initiale dans les 72 heures. |

**Conclusion sur ces quatre agrégateurs :** l'étude élargit les pistes, notamment Arbeitnow France, sans en faire des connecteurs acquis pour notre V1. Les conserver comme candidats conditionnels, sans supprimer leurs obligations d'attribution pour les faire entrer artificiellement dans le cahier des charges. Le plan privilégie désormais les sources employeurs ciblées pour le démarrage ; leur accessibilité, leur affiliation et les droits de reprise restent à établir source par source. Aucun volume d'offres saisonnières utilisables n'est démontré par la seule vérification de ces quatre API.
