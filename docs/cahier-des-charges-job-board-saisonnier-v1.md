# Job-board saisonnier — Cahier des charges V1

**Statut : cadrage fonctionnel validé par le fondateur le 21 octobre 2026, complété le 23 octobre 2026 par les arbitrages sur le scan, les labels et la mise en avant.**

Ce document rassemble les décisions issues de l’entretien. Il décrit la première version à réaliser ; il ne signifie pas que le site est développé, publié ou exploitable en production.

## 1. Intention et positionnement

Créer un job-board gratuit consacré exclusivement aux contrats explicitement saisonniers dans le tourisme et l’hôtellerie de loisirs en France, pour les saisons d’été et d’hiver.

Le service doit apporter deux améliorations prioritaires par rapport à la référence SeasonJobs :

- des annonces provenant directement des employeurs et permettant de candidater sans passer par un autre job-board ;
- des filtres dynamiques combinables, permettant de trouver rapidement des offres réellement compatibles avec les contraintes du candidat.

Le fondateur apporte vingt ans d’expérience comme saisonnier GO au Club Med. L’objectif économique indicatif évoqué est de 1 000 € de chiffre d’affaires mensuel ; il ne constitue pas un critère de validation fonctionnelle de la V1.

## 2. Périmètre du catalogue

| Dimension | Décision |
|---|---|
| Territoire | France, avec recherche par région et département |
| Secteurs | Tourisme et hôtellerie de loisirs |
| Contrats | Contrats explicitement saisonniers uniquement |
| Saisons | Été et hiver |
| Contenu initial | Offres d’emploi ; pas d’annuaire d’employeurs sans offre ouverte |
| Origine | Annonces déposées par les employeurs et annonces collectées sur leurs sites ou portails officiels |
| Sources et destinations publiques exclues | Indeed, France Travail, LinkedIn et autres job-boards ou agrégateurs ; leur utilisation pour découvrir des annonces est autorisée, avant vérification sur une source officielle de l’employeur |

La provenance directe n’est pas une promesse d’exclusivité : une annonce officielle reste admissible même si l’employeur la diffuse également ailleurs.

Un portail externe officiellement utilisé par l’employeur peut servir de destination de candidature. Il doit mener au recrutement de l’entreprise, sans détour par un autre job-board. Pour les annonces collectées, le téléphone ou l’email de candidature est privilégié ; une offre proposant uniquement un formulaire officiel reste admissible avec le badge coloré « Candidature externe ».

## 3. Informations et règles de publication

### Minimum nécessaire

Une annonce doit comporter :

- une entreprise identifiable ; pour une prestation autorisant l’anonymat public, son identité reste connue du gestionnaire du service ;
- un contrat explicitement saisonnier ;
- un lieu précis ;
- une période ou une durée ;
- un moyen de candidature utilisable, directement auprès de l’employeur ou auprès du chargé de recrutement identifié lorsque le recrutement lui est confié.

Les annonces qui satisfont ce minimum peuvent être publiées même si d’autres informations manquent. Elles restent susceptibles d’être enrichies.

Pour les annonces collectées, une information obligatoire incertaine impose une prévalidation admin, sans publication préalable. Une information facultative absente est affichée « non précisé » sans intervention obligatoire. Une information facultative contradictoire permet la publication des éléments fiables, avec la mention « à confirmer », un signalement admin non bloquant et l’exclusion de la valeur incertaine des filtres exigeant une information établie.

### Informations complémentaires

Les fiches présentent, lorsqu’ils sont renseignés :

- métier, description et missions ;
- salaire, qualification net/brut et unité de rémunération ;
- logement proposé ou non, avec ses conditions ;
- repas fournis ou non, avec leurs conditions ;
- expérience, langues, horaires, permis ;
- accueil des couples et des animaux ;
- autres contraintes pratiques effectivement documentées par l’employeur.

**Une information absente est affichée « non précisé ». Elle n’est jamais transformée en réponse négative ni inventée.**

### Rémunération

Afficher le salaire net mensuel avant impôt lorsqu’il est fourni par l’employeur ; sinon afficher le brut disponible. Conserver la qualification et l’unité de la source. Ne pas convertir silencieusement un salaire brut en net ni présenter un montant horaire comme un montant mensuel.

Le salaire et les conditions pratiques ne sont plus des motifs de blocage systématique : l’exigence initiale de salaire net obligatoire a été assouplie pendant le cadrage.

## 4. Recherche et filtres

Les filtres sont combinables. Leur modification actualise les résultats et leur nombre. Les critères actifs restent visibles et peuvent être retirés individuellement.

Critères retenus : métier, région/département, dates, rémunération, logement, repas, expérience, langues, horaires, permis, accueil des couples et des animaux.

Règles particulières :

- **Dates :** afficher par défaut les contrats entièrement compatibles avec la disponibilité indiquée ; proposer une option explicite de dates flexibles.
- **Salaire :** choisir net ou brut, puis un minimum mensuel. Ne pas comparer directement un montant brut à un seuil net.
- **Données inconnues :** une information inconnue ne satisfait pas un filtre exigeant cette information. Une compatibilité qui ne peut pas être établie ne doit pas être présentée comme confirmée.

## 5. Parcours candidat

### Compte et dossier

Le compte est obligatoire avant de rechercher ou consulter les offres.

Le dossier comporte :

- nom et coordonnées ;
- CV obligatoire avant la première candidature, mais pas pour commencer la recherche après inscription ;
- lettre de motivation facultative ;
- message d’accompagnement facultatif.

Le CV reste privé. Il n’existe pas de CVthèque employeur dans cette V1 et aucun document n’est transmis automatiquement.

### Candidature

Le candidat utilise le téléphone, l’email ou le lien de candidature indiqué et transmet lui-même son dossier.

Une annonce collectée proposant uniquement un formulaire officiel affiche le badge coloré « Candidature externe » sur sa carte de résultat et sa fiche avant l’ouverture du formulaire. Un téléphone général d’accueil ne devient pas un contact de candidature sans indication explicite de cet usage.

Pour un recrutement confié au service, le destinataire peut être le chargé de recrutement, clairement identifié comme tel.

### Sauvegarde et suivi

Prévoir une liste d’offres sauvegardées et un suivi simple, avec la possibilité de déclarer « J’ai postulé ». Un clic sur un contact ne constitue pas la preuve d’une candidature envoyée.

Ne pas ajouter de pipeline détaillé, de relances automatiques, de recherches enregistrées ou d’alertes de nouvelles offres au lancement.

## 6. Dépôts employeurs et exploitation

### Dépôt

Le dépôt utilise un formulaire structuré complété par une description libre. Le premier déposant et son lien avec l’entreprise sont vérifiés avant publication.

La publication de base est gratuite avec un contact direct par téléphone ou email. Pour les offres collectées, un formulaire officiel seul est également admis avec le badge « Candidature externe » ; ce badge est gratuit.

### Annonces collectées

Une collecte nocturne est prévue selon le [cahier des charges du scan V1](./cahier-des-charges-scan-saisonnier-v1.md). La découverte peut utiliser des job-boards ou agrégateurs, mais la publication s’appuie sur une source officielle de l’employeur. Les doublons sont traités manuellement par l’admin. Le scan propose aussi à l’admin les métiers et familles absents du référentiel, sans les créer automatiquement. Une offre autrement admissible peut être publiée en attendant son classement. Le [plan technique du scan V1–V5](./plan-technique-scan-v1-v5.md) prépare sa réalisation : la première version doit livrer au moins 50 nouvelles annonces distinctes et exploitables pour vérification par l’admin en moins de six heures après installation et lancement, sans frais supplémentaires hors Vercel. La vérification humaine et la publication interviennent séparément ; les dossiers initiaux restent invisibles jusqu’à validation. Pour ce seul premier remplissage, les annonces plus anciennes que 72 heures sont admissibles en file en l’absence de signal explicite de clôture ; les passages quotidiens conservent ensuite la fenêtre de 72 heures. Les critères minimums restent requis avant publication.

La collecte s’exécute en arrière-plan et livre les dossiers au fil de l’eau. L’admin peut les vérifier dès leur arrivée, avec actualisation automatique du fil sans perte de saisie, pendant que le scan continue. L’objectif de six heures porte sur le volume livré ; il ne retarde pas l’accès à la première annonce. Les corrections et décisions humaines sont préservées lors des reprises de collecte.

**Un employeur qui souhaite compléter, corriger ou retirer une annonce collectée doit contacter le fondateur.** Le fondateur vérifie la demande et effectue la modification. Aucun mécanisme autonome de revendication d’annonce n’est prévu dans cette V1.

### Labels de provenance et de validation

- « Sourcée sur internet » : annonce collectée publiée automatiquement par le scan.
- « Vérifiée par un humain » : annonce en attente dans la file de vérification que l’admin valide explicitement pour publication, même sans modifier son contenu. La validation est datée ; l’origine collectée reste conservée.
- « Recruteur vérifié » : label attribué à tous les employeurs inscrits sur l’application, selon le choix du fondateur, et présenté avec leurs annonces déposées. Il ne dispense pas de vérifier le déposant et son lien avec l’entreprise avant publication.

Une validation de suggestion de métier ou une simple modification de texte n’attribue pas à elle seule le label « Vérifiée par un humain ». Le badge « Candidature externe » décrit le canal de candidature et peut accompagner les labels de provenance ou de validation.

### Actualité des annonces

- Une annonce déposée reste active tant que le déposant la maintient en ligne, sous réserve des échéances explicites.
- Une notification tous les trente jours demande au déposant si son annonce est toujours valable. L’absence de réponse n’a pas été retenue comme motif de retrait automatique.
- Une annonce collectée est suivie à sa source ; son maintien en ligne ne doit pas être présenté comme une confirmation personnelle du recruteur.
- Le contrôle des annonces collectées déjà publiées relève entièrement d’un cron séparé du scan de découverte. Sa fréquence et sa date de mise en service seront définies dans son propre chantier.
- Le scan de découverte ne republie pas automatiquement une annonce retirée et n’écrase pas les corrections confirmées par le fondateur.
- Une date limite de candidature ou une date de fin de contrat dépassée entraîne le retrait des résultats actifs.
- Une date de début dépassée ne suffit pas à retirer une annonce : un remplacement peut encore être recherché.

## 7. Modèle économique et services employeurs

L’accès candidat au catalogue et aux fonctionnalités V1 est gratuit. Le dépôt employeur avec contact direct est gratuit.

Les employeurs peuvent demander des prestations supplémentaires :

- questionnaire préalable ;
- tri selon les critères du poste ;
- sélection humaine ;
- prise de contact et confirmation de l’intérêt des candidats ;
- recherche proactive et sourcing de candidats.

L’achat peut porter sur une annonce, une campagne ou un établissement. Il peut se faire à l’unité ou sous forme de package. Aucun achat de service n’est obligatoire pour déposer une annonce gratuite conforme.

Les prestations sont proposées sur demande et traitées manuellement au lancement. Leurs tarifs et modalités commerciales détaillés ne sont pas encore fixés.

### Mise en avant payante — chantier séparé

Le principe retenu comprend des badges visuels supplémentaires, par exemple « Urgent », une présence sur la landing page et une priorité dans les résultats de recherche parmi les offres satisfaisant les filtres et les règles de visibilité. Ce chantier est consigné séparément et n’entre pas dans le prochain plan technique du scan. Ses tarifs, sa durée, son paiement et ses modalités d’affichage restent à définir. Les labels de provenance, de validation et de canal de candidature ne nécessitent pas l’achat d’une mise en avant.

### Confidentialité et engagements

- Distinguer le masquage des coordonnées et celui de l’identité de l’entreprise.
- Réserver l’anonymat complet aux prestations où le service assure effectivement l’intermédiation.
- Expliquer le mode de candidature sur chaque annonce.
- Signaler les incompatibilités issues du questionnaire sans rejet automatique au départ.
- Vendre des prestations définies, sans garantie d’embauche.
- Ne pas considérer les CV privés des inscrits comme une base librement consultable pour le sourcing.

## 8. Éléments reportés ou hors périmètre

| Sujet | Statut |
|---|---|
| Coaching, suivi personnalisé et gestion de carrière candidats | V2 |
| Tarifs, temps de visioconférence et contenu des abonnements candidats | Hypothèses V2 à réexaminer |
| Qualification juridique des prestations candidates, notamment placement et représentation | À examiner avant leur éventuelle commercialisation |
| Annuaire d’employeurs sans offres, CVthèque, guides et fonctionnalités avancées | Hors V1 |
| Alertes et recherches enregistrées | Hors V1 |
| Détails techniques du scan nocturne | Plan à rédiger à partir du cahier des charges dédié, révisé le 23 octobre 2026 |
| Contrôle des annonces collectées déjà publiées | Cron et plan distincts du scan de découverte |
| Mise en avant payante | Chantier séparé du prochain plan technique du scan |
| Nom du service, identité visuelle, architecture, hébergement et choix techniques | Non décidés par ce cadrage fonctionnel |
| Moyens, calendrier et évaluation du product-market fit | Pilotés par le fondateur |

Les pistes d’acquisition évoquées sont le réseau du fondateur, les communautés de saisonniers, le référencement et Instagram. Elles ne modifient pas le périmètre fonctionnel ci-dessus.

## 9. Points de contrôle pour la réalisation

La réalisation devra notamment permettre de vérifier que :

- aucun parcours de candidature ordinaire ne redirige vers un job-board exclu ;
- les annonces collectées avec formulaire officiel seul restent publiables avec le badge « Candidature externe » ;
- les suggestions de métiers et de familles sont validées par l’admin avant toute création dans le référentiel ;
- les filtres se combinent et mettent à jour immédiatement les résultats ;
- les mentions inconnues ne deviennent ni des réponses négatives ni des critères confirmés ;
- les montants nets, bruts et leurs unités restent distingués ;
- un inscrit peut rechercher sans CV, mais doit compléter son dossier avant d’utiliser le parcours de candidature ;
- les CV restent privés et ne sont pas envoyés automatiquement ;
- les fonctionnalités de sauvegarde et de suivi restent simples ;
- les échéances dépassées sont prises en compte ;
- les modifications des annonces collectées passent par le fondateur ;
- les fonctionnalités reportées en V2 ne sont pas introduites implicitement dans la V1.

Ces points décrivent la conformité du produit au cadrage. Ils ne remplacent pas les critères de product-market fit que le fondateur choisira lui-même.
