# Job-board saisonnier — Cahier des charges V1

**Statut : cadrage fonctionnel validé par le fondateur le 21 octobre 2026.**

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
| Sources exclues | Indeed, France Travail, LinkedIn et autres job-boards ou agrégateurs |

La provenance directe n’est pas une promesse d’exclusivité : une annonce officielle reste admissible même si l’employeur la diffuse également ailleurs.

Un portail externe officiellement utilisé par l’employeur peut servir de destination de candidature. Il doit mener au recrutement de l’entreprise, sans détour par un autre job-board.

## 3. Informations et règles de publication

### Minimum nécessaire

Une annonce doit comporter :

- une entreprise identifiable ; pour une prestation autorisant l’anonymat public, son identité reste connue du gestionnaire du service ;
- un contrat explicitement saisonnier ;
- un lieu précis ;
- une période ou une durée ;
- un moyen de candidature utilisable, directement auprès de l’employeur ou auprès du chargé de recrutement identifié lorsque le recrutement lui est confié.

Les annonces qui satisfont ce minimum peuvent être publiées même si d’autres informations manquent. Elles restent susceptibles d’être enrichies.

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

Pour un recrutement confié au service, le destinataire peut être le chargé de recrutement, clairement identifié comme tel.

### Sauvegarde et suivi

Prévoir une liste d’offres sauvegardées et un suivi simple, avec la possibilité de déclarer « J’ai postulé ». Un clic sur un contact ne constitue pas la preuve d’une candidature envoyée.

Ne pas ajouter de pipeline détaillé, de relances automatiques, de recherches enregistrées ou d’alertes de nouvelles offres au lancement.

## 6. Dépôts employeurs et exploitation

### Dépôt

Le dépôt utilise un formulaire structuré complété par une description libre. Le premier déposant et son lien avec l’entreprise sont vérifiés avant publication.

La publication de base est gratuite avec un contact direct par téléphone ou email. Les offres collectées peuvent aussi utiliser le lien officiel permettant de candidater auprès de l’entreprise.

### Annonces collectées

Une collecte nocturne sur les sources employeurs est prévue. La découverte des entreprises, la sélection des sources et les modalités techniques du scan sont explicitement reportées à une discussion ultérieure.

**Un employeur qui souhaite compléter, corriger ou retirer une annonce collectée doit contacter le fondateur.** Le fondateur vérifie la demande et effectue la modification. Aucun mécanisme autonome de revendication d’annonce n’est prévu dans cette V1.

### Actualité des annonces

- Une annonce déposée reste active tant que le déposant la maintient en ligne, sous réserve des échéances explicites.
- Une notification tous les trente jours demande au déposant si son annonce est toujours valable. L’absence de réponse n’a pas été retenue comme motif de retrait automatique.
- Une annonce collectée est suivie à sa source ; son maintien en ligne ne doit pas être présenté comme une confirmation personnelle du recruteur.
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
| Détails techniques du scan nocturne | Discussion différée |
| Nom du service, identité visuelle, architecture, hébergement et choix techniques | Non décidés par ce cadrage fonctionnel |
| Moyens, calendrier et évaluation du product-market fit | Pilotés par le fondateur |

Les pistes d’acquisition évoquées sont le réseau du fondateur, les communautés de saisonniers, le référencement et Instagram. Elles ne modifient pas le périmètre fonctionnel ci-dessus.

## 9. Points de contrôle pour la réalisation

La réalisation devra notamment permettre de vérifier que :

- aucun parcours de candidature ordinaire ne redirige vers un job-board exclu ;
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
