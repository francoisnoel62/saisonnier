# Plan scan 05 — Extracteurs des sources retenues

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 01, 02 | 09 | L | plan technique §4, §5 (pile, modules à créer), lot 4 ; exploration §3 ; cahier §4, §5, §6 |

## Objectif

Transformer les listes et les fiches des sources retenues au plan 01 en `ExtractedPosting` prouvés, puis en `ScanProposal`, par un adaptateur par format, sans LLM. Mesurer depuis la preview la qualité du préremplissage, source par source.

Un adaptateur observe : il ne décide ni de l'admission ni de la publication, n'écrit rien en base et ne connaît pas les entreprises enregistrées.

## Étapes

1. **Contrat des adaptateurs** `src/server/scan/sources/adapter.ts`.

   ```ts
   type ScanAdapter = {
     kind: AdapterKind
     extractorVersion: string // "teamtailor@1"
     listPage(ctx: AdapterContext, cursor: ListCursor | null): Promise<ListPageResult>
     readPosting(ctx: AdapterContext, listed: ListedPosting): Promise<ReadResult>
   }
   ```

   - `AdapterContext` : définition de la source, `scanFetch` lié à ses limites, à robots.txt et à la politesse, instant courant, journal.
   - `ListPageResult` : `{ postings, next }`, ou un échec de source (`blocked`, `rate_limited` avec délai, `unavailable`).
   - `ListedPosting` : URL, identifiant externe, intitulé, date et données de liste, empreinte de l'élément (`listingHash`).
   - `ReadResult` : `{ kind: "extracted", posting }`, `{ kind: "gone" }` (404 ou 410 après une liste qui la citait), ou `{ kind: "unreadable", reason }`.
   - Une erreur réseau d'une fiche n'est jamais levée : elle devient un résultat, que le plan 09 compte comme un essai.
2. **Outils d'extraction** `src/server/scan/extract/`.
   - `html.ts` : chargement Cheerio ; `usefulText($, root)` retire `script`, `style`, `nav`, `header`, `footer` et `form`, sépare les blocs, réduit les espaces, plafonne à 20 000 caractères ; `sectionTexts($)` regroupe le texte sous ses intertitres ; `labeledValues($)` lit les paires libellé–valeur (« Type de contrat », « Salaire », « Localisation »). Le texte rangé sous un en-tête ou un pied de page du site reçoit `scope: "site"`.
   - `jsonld.ts` :
     - trouver les blocs `application/ld+json` ;
     - `parseLenientJson` : un petit automate échappe les caractères de contrôle bruts **à l'intérieur des chaînes** seulement, défaut observé sur les pages Teamtailor ;
     - schéma zod d'un sous-ensemble de `JobPosting` : `title`, `description`, `identifier.value`, `datePosted`, `validThrough`, `employmentType`, `hiringOrganization` (`name`, `sameAs`), `jobLocation[].address` (`streetAddress`, `addressLocality`, `postalCode`, `addressRegion`, `addressCountry`), `baseSalary` (`currency`, `value.value`, `minValue`, `maxValue`, `unitText`), `directApply`, `applicationContact` ;
     - description : entités HTML décodées, puis HTML, puis texte.
   - `rss.ts` : `fast-xml-parser`, espaces de noms conservés (`tt:`), descriptions décodées ; chaque `item` devient un `ListedPosting`.
   - `contacts.ts` : emails et téléphones français, chacun avec sa rubrique (`application` ou `other`) et son rôle (accueil, réception) ; les adresses masquées (« [at] ») ne sont pas devinées.
   - `evidence.ts` : création des preuves (type, portée, emplacement, extrait de 300 caractères au plus).
3. **Adaptateur Teamtailor** `src/server/scan/sources/teamtailor.ts` (Belambra et tout employeur sur Teamtailor).
   - **Liste** : `<portail>/jobs.rss`. Par élément : `title`, `link` (`/jobs/<id>-<slug>`), `guid`, `pubDate`, `description`, `tt:locations/tt:location` (`tt:name`, `tt:address`, `tt:zip`, `tt:city`, `tt:country`), `tt:department`, `tt:role`. Sans flux : liste HTML `/jobs`, puis `/jobs/show_more?page=N`, dans la limite de pages.
   - **Identité** : `teamtailor:<hôte>:<id numérique>`.
   - **Fiche** : JSON-LD (lu avec `parseLenientJson`), libellés HTML (« Type de contrat », « Salaire », « Localisation »), texte de description.
   - **Canal** : la candidature se fait sur le portail (boîte de dialogue) ; `formUrl` vaut l'URL de la fiche, sauf email ou téléphone dans une rubrique de candidature.
   - **Pièges observés** :
     - `baseSalary` mensuel sans net ni brut : précision seulement ;
     - avantages généraux (« possibilité d'être nourri et logé ») : portée `site`, aucun logement établi ;
     - offres régionales (`tt:city` est une région) : lieu à vérifier ;
     - suffixe de saison dans l'intitulé (« Hiver 26-27 ») absent de `tt:role` : indice de saison.
4. **Adaptateur Factorial** `src/server/scan/sources/factorial.ts` (VVF et tout employeur sur Factorial).
   - **Liste** : page d'accueil du portail ; liens `/job_posting/<slug>-<id>`, regroupés sous l'intertitre de l'établissement ; `/apply` (candidature spontanée) ignoré.
   - **Identité** : `factorial:<hôte>:<id numérique>` (les slugs se répètent).
   - **Fiche**, sans JSON-LD :
     - puces sans libellé : contrat (« CDD »), temps de travail (« Temps plein »), montant (« 1,867.5 € Mensuel », sans base), lieu (« <ÉTABLISSEMENT>, France ») ;
     - texte libre : « Dates contrats : … », « CDD saisonnier », « Logement possible sur place ».
   - **Canal** : lien `/apply/<slug>-<id>`, donc `formUrl`.
   - **Lieu** : nom d'établissement → `placeAliases` du registre (commune vérifiée au plan 01), sinon à vérifier.
5. **Adaptateur SmartRecruiters** `src/server/scan/sources/smartrecruiters.ts`, seulement si le plan 01 retient un employeur sur cet ATS.
   - **Liste** : `GET /v1/companies/{id}/postings?country=fr&offset=…&limit=100`, API publique, sans clé.
   - **Tri dès la liste** : une annonce sans indice saisonnier dans l'intitulé ni dans les champs personnalisés (« Job Type ») est écartée `out_of_scope` sans lecture de sa fiche ; son `listingHash` évite de la reconsidérer.
   - **Fiche** : `ref` de l'API (sections de l'annonce) ; URL publique et URL de candidature lues dans la réponse, à vérifier sur un exemple.
   - **Pièges observés** : `typeOfEmployment` contredit parfois l'intitulé, donc le contrat se lit d'après l'intitulé et le texte (règles du plan 02) ; `releasedDate` est un instant.
6. **Adaptateur de test** `src/server/scan/sources/fixture.ts` : liste HTML simple et fiches JSON-LD, pour les tests de workflow et l'E2E (plan 09). Il n'existe que si `SCAN_TEST_SOURCE_URL` est définie.
7. **Autres formats** (We Recruit, PVCP) : seulement si le plan 01 a établi une liste lisible sans JavaScript ; sinon, la source reste « réserve » dans `docs/scan/sources-v1.md`, avec la raison.
8. **Lieux** `src/server/scan/places.ts`, dans cet ordre :
   1. alias du registre ;
   2. code postal et commune de la source → `https://geo.api.gouv.fr/communes?codePostal=…&nom=…&fields=nom,code,codesPostaux,codeDepartement`, par `scanFetch` (hôte public autorisé, 5 s, résultat gardé pour le passage) ;
   3. un seul résultat, dans un département du référentiel : lieu établi (nom, code INSEE, code postal, département) ;
   4. plusieurs ou aucun : `to_verify`, avec les candidats.

   Un code INSEE commence par son département (contrainte `offers_commune_in_department`).
9. **Plusieurs postes sur une page** `src/server/scan/extract/multi.ts`.
   - Une page n'est séparée en postes que si elle associe explicitement poste, lieu et période (lignes d'un tableau, blocs répétés). Chaque poste reçoit son `index` dans l'identité.
   - Sinon, un seul dossier, avec le point `multiple_positions`.
   - Un même poste dans plusieurs lieux clairement listés reste **un** dossier à plusieurs lieux (plan 08).
10. **Proposition** : la sortie de l'adaptateur passe par `buildProposal` (plan 02). L'entreprise proposée est celle du registre (nom, SIREN) ; sa correspondance avec `companies` est faite à l'enregistrement (plan 09, SH15).
11. **Mesure depuis la preview** : la sonde du plan 01 reçoit « Extraire un échantillon » (10 fiches par source, rien n'est enregistré).
    - Par fiche : intitulé, contrat, période, lieu, canal, salaire, points à vérifier.
    - Par source : part des champs établis.

    Les résultats complètent `docs/scan/sources-v1.md` (« qualité du préremplissage ») et confirment ou corrigent l'estimation du réservoir.
12. **Versions** : chaque adaptateur a sa `extractorVersion`, enregistrée sur le dossier. Une règle modifiée change la version et repasse les tests de référence ci-dessous.

## Tests

**Unitaires**, sur les fixtures anonymisées du plan 01 (`*.test.ts` par adaptateur) :

- « Teamtailor — CDD saison : contrat explicite ; salaire sans base en précision » ;
- « Teamtailor — JSON-LD avec caractères de contrôle bruts : lu » ;
- « Teamtailor — offre régionale : lieu à vérifier » ;
- « Teamtailor — avantages du groupe : aucun logement établi » ;
- « Factorial — dates en texte libre : période établie » ;
- « Factorial — lien de candidature : formulaire seul » ;
- « Factorial — logement possible : non précisé, précision conservée » ;
- « liste Factorial : candidature spontanée ignorée, identifiants uniques malgré les slugs répétés » ;
- « liste Teamtailor : flux absent, liste HTML et « show_more » lues dans la limite de pages » ;
- « fiche disparue (404 ou 410) : `gone`, jamais un dossier vide » ;
- « source lente ou en erreur 5xx : `unreadable`, compté comme un essai » ;
- « robots.txt interdit la fiche : rien n'est lu » ;
- « plusieurs postes explicitement associés : un dossier par poste ; associations ambiguës : un dossier `multiple_positions` » ;
- **propriété**, sur toutes les fixtures : tout champ `established` a au moins une preuve de portée `posting` ; aucun texte stocké ne contient de balise HTML.

## Critères d'acceptation

- [x] Chaque source retenue a son adaptateur, ses fixtures et ses tests de référence.
- [ ] La qualité du préremplissage, mesurée depuis la preview, est consignée par source ; le réservoir estimé est confirmé ou des sources de réserve sont ajoutées.
- [x] Aucune valeur sans preuve ; aucun HTML stocké ni affiché.

## Hors périmètre

- Navigateur automatisé, rendu JavaScript, PDF (V4) ; recherche Web et job-boards (V3).
- Décision d'admission et de publication (plans 02, 04), enregistrement (plans 03, 09).
