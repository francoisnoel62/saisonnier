# Plan scan 01 — Sources, client HTTP sûr et sonde depuis la preview

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| — | 05, 09 | M | plan technique §4 (sources, préparation), §5 (exécution, reprises et limites), lot 1 ; cahier §1, §4 |

## Objectif

Établir, depuis **notre code déployé en preview**, que les sources retenues sont lisibles ; documenter leur provenance et leurs conditions de reprise ; estimer leur réservoir de dossiers exploitables. Livrer en même temps les fondations réseau du scan : un client HTTP borné et sûr, le registre des sources et des fixtures anonymisées pour tous les tests suivants.

Ce plan ne lit encore aucun champ d'annonce (plan 05) et n'enregistre rien en base (plan 03).

**Arbitrage du fondateur pendant l'implémentation, 23/10/2026 (SH17) :** ajouter France Travail comme découverte prioritaire, sur l'[URL de recherche fournie](https://candidat.francetravail.fr/offres/recherche?domaine=G&emission=3&lieux=99100&offresPartenaires=false&range=0-19&rayon=10&tri=1&typeContrat=SAI). Les portails employeurs restent en réserve. Le registre distingue `kind="discovery"` / `"employer"` ; France Travail n'est jamais l'employeur attribué aux annonces. Les fiches utilisent le JSON public de leur composant officiel, sans clé ni rendu JavaScript ; la source officielle employeur reste nécessaire avant publication. Le détail de la décision, les captures et les mesures sont dans `docs/scan/sources-v1.md`.

## Ce qui est déjà observé

Relevés du 23 octobre 2026 avec un outil de lecture Web et une requête depuis le poste de travail. Ils orientent les adaptateurs ; ils ne remplacent pas la sonde depuis Vercel.

| Source | Liste | Fiche | Points d'attention |
|---|---|---|---|
| Belambra, `recrute.belambra.fr` (Teamtailor) | Flux `jobs.rss` (RSS 2.0, espace de noms `tt:`), environ 94 offres, aucune pagination visible. Liste HTML de 20 offres, suite par `/jobs/show_more?page=2`. Lien `/jobs/<id>-<slug>` | JSON-LD `JobPosting` présent mais **invalide en JSON strict** (sauts de ligne bruts dans les chaînes). `datePosted` avec fuseau, `baseSalary` mensuel **sans net ni brut**, adresse complète. Libellés HTML « Type de contrat » (« CDD saison »), « Salaire », « Localisation » (nom du club seulement) | Candidature par une boîte de dialogue (formulaire). Avantages généraux de groupe (« possibilité d'être nourri et logé ») : jamais un logement établi. Offres régionales : `tt:city` contient une région |
| VVF, `vvfrecrute.factorial.fr` (Factorial) | Page d'accueil HTML, 27 liens `/job_posting/<slug>-<id>` regroupés sous le nom de l'établissement ; « Candidature spontanée » (`/apply`) n'est pas une offre | **Pas de JSON-LD.** Puces sans libellé (« CDD », « Temps plein », « 1,867.5 € Mensuel », « PRAPOUTEL LES SEPT LAUX, France »). Texte libre : « Dates contrats : 1er février au 23 mars 2027 », « CDD saisonnier », « Logement possible sur place » | Les slugs se répètent : la clé est l'identifiant numérique. Candidature par `/apply/<slug>-<id>`. Le lieu est un nom de station, à résoudre en commune |
| Sandaya, `recrutement.sandaya.jobs` (We Recruit) | Liste construite par JavaScript : aucune offre dans le HTML. Pages `careers.werecruit.io/fr/sandaya/…` non testées | — | Source de réserve, seulement si une liste lisible sans JavaScript est établie |
| PVCP, `groupepvcp.com/talents` | Liste dynamique, inventaire non établi | — | Source de réserve (plan technique §4) |
| SmartRecruiters (API publique des annonces) | `GET https://api.smartrecruiters.com/v1/companies/{id}/postings?country=fr` répond sans clé (ex. 925 annonces pour un groupe hôtelier) | Détail par l'API (`ref`) ; la liste n'a ni description ni URL publique | Champs de contrat incohérents (un intitulé « [CDI] » marqué « Temporary ») ; périmètre tourisme de loisirs à établir employeur par employeur |

## Étapes

1. **Dépendances**, versions relevées sur npm le 23/10/2026, à revérifier (compatibilité Node 24 et Next 16.4, licence) :
   - `cheerio` 1.2.0 (HTML, plans 01 et 05) ;
   - `fast-xml-parser` 5.11.x (RSS) ;
   - `robots-parser` 3.0.1 (robots.txt).

   Aucun client HTTP tiers : `node:https`, `node:dns` et `node:zlib` suffisent.
2. **Garde d'adresse** `src/server/scan/address-guard.ts`.
   - `isPublicAddress(ip)` s'appuie sur `net.BlockList` : boucle locale, `0.0.0.0/8`, réseaux privés (`10/8`, `172.16/12`, `192.168/16`), partage d'opérateur (`100.64/10`), lien local (`169.254/16`, dont `169.254.169.254`), multidiffusion, plages réservées ; en IPv6 : `::1`, `fc00::/7`, `fe80::/10`, adresses IPv4 encapsulées (`::ffff:127.0.0.1`).
   - `checkScanUrl(url, policy)` (pur, dans `src/domain/scan/url-safety.ts`) : `https:` seulement, port 443 implicite, ni identifiant ni mot de passe dans l'URL.
   - La politique est un paramètre : en preview et en production, elle n'autorise aucun hôte local ; en développement et en test, elle autorise en plus le seul `http://localhost:<port>` de `SCAN_TEST_SOURCE_URL`. Les tests d'intégration passent explicitement l'hôte de leur serveur local.
3. **Client HTTP** `src/server/scan/http.ts` (`server-only`) : `scanFetch(url, options)`.
   - **Résolution** : `dns.promises.lookup(host, { all: true })`. Refus si une seule adresse n'est pas publique. La connexion utilise l'adresse validée (option `lookup` de `https.request`) : aucune seconde résolution, donc pas de « DNS rebinding ».
   - **Redirections** : manuelles, 5 au plus. Chaque nouvelle URL repasse `checkScanUrl`, la résolution et robots.txt.
   - **Bornes** : délai total de 15 s (`AbortSignal.timeout`) ; lecture en flux, arrêtée au-delà de 2 Mo après décompression (gzip, deflate, br). Types admis : HTML, XHTML, JSON, JSON-LD, RSS, XML.
   - **En-têtes** : `User-Agent: ${site.name}Bot/1.0 (+${BETTER_AUTH_URL}/contact)` (le nom vient de `src/config/site.ts`, H14), `Accept-Language: fr-FR,fr;q=0.9`.
   - **robots.txt** : lu une fois par hôte et conservé pour l'étape ; règles de notre User-Agent, sinon de `*` ; `Crawl-delay` relevé. Un 404 vaut « tout est permis » ; un 5xx ou un délai dépassé rend l'hôte indisponible, sans lecture des pages.
   - **Politesse** : `HostPacer`, intervalle minimal par hôte (2 s, ou le `Crawl-delay`). Le plan 09 le prolonge entre deux étapes par `lastRequestAt` en base.
   - **Résultat typé**, jamais d'exception pour une réponse HTTP :
     `{ ok: true, status, finalUrl, contentType, body, bytes, elapsedMs, fetchedAt }` ou `{ ok: false, reason, status?, retryAfterMs? }`.
     Motifs : `invalid_url`, `blocked_address`, `robots_disallowed`, `timeout`, `too_large`, `unsupported_type`, `too_many_redirects`, `rate_limited` (429 ou 503 avec `Retry-After`), `access_denied` (401, 403), `not_found` (404), `gone` (410), `http_error`, `network`.
4. **Variable de test** : `SCAN_TEST_SOURCE_URL` (facultative) dans `src/lib/env.ts` et `.env.example`. `env.ts` la refuse si `NODE_ENV=production` : une preview ou la production ne peut jamais lire une adresse locale.
5. **Registre des sources** `src/server/scan/sources/registry.ts` : `scanSourceDefinitions`, indexé par une clé stable (`belambra`, `vvf`…). Type et schéma zod dans `src/domain/scan/source.ts`, avec les limites par défaut (README, « Réglages par défaut »).
   - **Champs** : `label` ; `kind` (`employer` / `discovery`, SH17) ; `employer` (nom, SIREN s'il est établi ; nul pour une découverte) ; `adapter` (`teamtailor`, `factorial`, `smartrecruiters`, `france-travail`, `fixture`) ; `listUrls` ; `postingUrlPattern` (expression des liens de fiche) ; `officialHosts` ; `employerWebsite` (nul pour une découverte) ; `affiliationProof` (URL de la page officielle qui mène au portail, ou provenance du diffuseur, note, date de vérification) ; `reuse` (URL des conditions, extrait utile de robots.txt, note, date) ; `role` (`primary` / `reserve`) ; `priority` ; `limits` (surcharges) ; `placeAliases` (nom d'établissement → commune vérifiée : code INSEE, nom, département).
   - La source `fixture` (tests) n'est déclarée que si `SCAN_TEST_SOURCE_URL` est définie.
   - Un test valide tout le registre : clés uniques, URL `https`, hôtes des listes inclus dans `officialHosts`, SIREN au bon format (`isValidSiren`), alias complets.
6. **Sonde** `src/server/scan/probe.ts` et Server Action `probeScanSourceAction(key)` (`requireRole("admin")`). Pour une source :
   - lire la liste (première page ou flux) ;
   - compter les liens de fiche (`postingUrlPattern`) ;
   - lire jusqu'à trois fiches ;
   - renvoyer, par requête : statut HTTP, URL finale, durée, taille, décision de robots.txt, présence d'un JSON-LD `JobPosting`, nombre d'éléments RSS, pagination détectée.

   Le résultat est renvoyé à l'écran et journalisé (`[scan sonde] …`), sans être enregistré. Le plan 05 y ajoutera l'extraction d'un échantillon.
7. **Page `/admin/scan`**, première version.
   - Navigation admin : entrée « Scan », `/admin/scan`, icône `RadarIcon` (`src/config/navigation.ts`, titre d'en-tête compris).
   - Carte « Sources du scan » : source, rôle, hôtes officiels, date de la dernière vérification documentée, bouton « Tester l'accès depuis ce déploiement ».
   - Le diagnostic s'ouvre dans un `Sheet`. Mobile d'abord (375 px).
8. **Fixtures** `src/server/scan/sources/fixtures/<source>/`.
   - Pour chaque source retenue : la liste (ou le flux) et 3 à 6 fiches qui couvrent les cas rencontrés : saisonnier explicite, CDD seul, dates en texte libre, durée seule, salaire sans base, logement « possible », formulaire seul, plusieurs postes ou plusieurs lieux, offre close.
   - **Anonymisation** (SH14) : structure et balisage conservés ; noms de personnes, emails et téléphones remplacés par des valeurs fictives (`.example`, tranches de fiction du `CLAUDE.md`) ; scripts, images et suivis supprimés.
   - Un `README.md` par dossier : URL d'origine, date de capture, modifications apportées.
   - Les fixtures sont exclues de Prettier (`.prettierignore`) : un reformatage changerait ce que lisent les extracteurs.
9. **Dossier des sources** `docs/scan/sources-v1.md`, rempli pendant la session et validé par le fondateur. Pour chaque source :
   - URL et ATS ;
   - preuve de rattachement à l'employeur (page officielle qui mène au portail) ;
   - conditions de reprise : conditions d'utilisation, robots.txt, mentions légales ;
   - résultats de la sonde depuis la preview (date et URL du déploiement) ;
   - un échantillon de 10 fiches examinées à la main (saisonnier ? secteur ? lieu ? période ? canal ?) ;
   - le réservoir estimé de dossiers exploitables et la décision (`primary`, `reserve`, écartée), avec ses raisons.
10. **Décision de réservoir.** Continuer vers le plan 05 si l'échantillon soutient au moins **70 dossiers exploitables** estimés (marge de 40 % sur 50). Sinon, ajouter des sources de réserve avant d'écrire leurs extracteurs : d'autres employeurs du tourisme sur Teamtailor, Factorial ou SmartRecruiters, ou une source dont la liste est lisible. Le compteur affiché par un site ne vaut jamais estimation.

## Tests

**Unitaires** :

- `address-guard` : adresses privées, réservées et encapsulées refusées ; adresses publiques acceptées ;
- `url-safety` : protocole, port, identifiants ; `http://localhost` refusé hors mode test ;
- registre : validation de toutes les définitions ;
- fixtures : aucun email hors `.example`, aucun numéro hors des tranches de fiction.

**Intégration** (`src/server/scan/http.int.test.ts`, serveur HTTP local démarré par le test, en mode test) :

- une redirection vers une adresse interne est refusée ;
- au-delà de 2 Mo, la lecture s'arrête (`too_large`) ;
- une réponse trop lente renvoie `timeout` ;
- robots.txt interdit le chemin : aucune requête vers la page ;
- 429 avec `Retry-After: 120` : `rate_limited` et `retryAfterMs = 120000` ;
- deux requêtes au même hôte sont espacées de l'intervalle minimal.

**E2E** dans `e2e/scan-sources.spec.ts` :

- « Scan — la page du scan est réservée à l'admin » : un candidat et un employeur sont renvoyés vers leur accueil.

## Critères d'acceptation

- [x] Depuis une preview Vercel, la sonde lit la liste et au moins trois fiches de chaque source principale ; les résultats sont consignés dans `docs/scan/sources-v1.md`. Proposition initiale Belambra/VVF vérifiée le 23/10/2026 ; France Travail, choisie ensuite comme priorité (SH17), vérifiée le même jour à 16:03 Paris sur `saisonnier-h5e9a85b9-francois-noels-projects.vercel.app` : liste et trois fiches HTTP 200.
- [x] Le client refuse toute adresse interne, y compris après redirection ; il respecte robots.txt et plafonne durée et taille.
- [x] Provenance, rattachement et conditions de reprise sont documentés pour chaque source retenue ; la décision du fondateur est notée (France Travail prioritaire, SH17 ; aucune autorisation de publication présumée).
- [x] Le réservoir estimé atteint 70 dossiers exploitables, ou des sources de réserve ont été ajoutées.
- [x] Les fixtures sont anonymisées, et un test le vérifie.

## Hors périmètre

- Extraction des champs (plan 05), enregistrement en base (plan 03), lancement d'un passage (plan 09).
- Contournement d'un refus d'accès, navigateur automatisé, rendu JavaScript.
