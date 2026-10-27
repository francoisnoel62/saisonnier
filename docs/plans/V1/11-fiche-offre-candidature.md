# Plan 11 — Fiche offre & parcours de candidature

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 06, 09, 10 | 12, 14 | M | §2 (destination officielle), §3 (affichage), §5 (candidature), §6 (provenance), §7 (confidentialité), §9 |

## Objectif

Construire une fiche d'offre qui affiche toute l'information **sans rien inventer** et qui explique comment candidater.
Les coordonnées de candidature ne sont révélées qu'à un candidat dont le dossier est complet. Le candidat transmet lui-même son dossier.

## Étapes

1. **Route** `src/app/(app)/offres/[id]/page.tsx`, ouverte aux rôles candidat et admin.
   - Si l'offre n'est plus active (§6), la page affiche « Cette offre n'est plus active », avec le titre et l'entreprise publique, sans aucune coordonnée.
2. **`OfferDetails`** dans `src/components/offers/offer-details.tsx`.
   - Le composant est purement présentationnel. L'aperçu du plan 14 et le back-office le réutilisent.
   - Ses sections :

     | Section | Contenu |
     |---|---|
     | Poste | métier, description, missions |
     | Contrat | saison, dates ou durée, date limite |
     | Lieu | commune, département, précisions |
     | Rémunération | `displayedSalary`, l'autre déclaration éventuelle, les précisions |
     | Conditions | logement et repas, avec leurs conditions |
     | Profil | expérience, langues, permis |
     | Organisation | temps de travail, heures, horaires |
     | Vie pratique | couples, animaux, autres contraintes |

   - Le composant `InfoValue` affiche « Oui », « Non » ou « **Non précisé** », ce dernier en style atténué. Un champ inconnu est **toujours affiché**, jamais masqué ni converti.
3. **Provenance.**
   - **Annonce déposée** : « Annonce déposée par l'employeur », plus « Validité confirmée le … » si la date existe.
   - **Annonce collectée** :
     - la mention « Annonce publiée sur le site officiel de {entreprise} — source consultée le {sourceCheckedAt} » ;
     - aucune formulation laissant croire que le recruteur a confirmé l'annonce ;
     - le lien « Vous êtes l'employeur ? Pour compléter, corriger ou retirer cette annonce, contactez-nous », vers `/contact?motif=annonce-collectee&offre=<id>`.
4. **Bloc « Comment postuler »**, toujours visible.
   - Il reprend `applicationModeExplanation(offer)`.
   - Il ajoute : « Vous transmettez vous-même votre dossier ; {site} n'envoie aucun document. »
5. **Panneau de candidature**, alimenté côté serveur par `getApplicationDetails(offerId, userId)`.
   - **Dossier incomplet** :
     - le panneau liste ce qui manque et propose « Compléter mon dossier », vers `/dossier?retour=/offres/<id>` ;
     - **les coordonnées ne sont pas envoyées au navigateur**.
   - **Dossier complet** :
     - email : un lien `mailto:` avec l'objet « Candidature – {intitulé} – {nom} » et, comme corps, le message d'accompagnement ;
     - téléphone : un lien `tel:` ;
     - lien officiel : ouvert dans un nouvel onglet, avec `rel="noopener noreferrer"` et le domaine affiché ;
     - un bouton « Télécharger mon CV », pour que le candidat le joigne lui-même.
   - **Admin** : il voit toujours les coordonnées, pour la modération.
   - **Canal `recruiter`** : « {recruiterName}, chargé·e de recrutement de {site} pour le compte de {entreprise ou « une entreprise qui souhaite rester confidentielle »} ».
   - **Contrôle au rendu** : un lien ou un email dont le domaine est (ou est devenu) exclu n'est jamais affiché. Le panneau indique « lien indisponible » et l'incident est journalisé.
   - Un clic sur un contact **n'est pas** une candidature. Le bouton « J'ai postulé » arrive au plan 12.
6. **Anonymat.** Utiliser `publicCompanyName` partout : fiche, carte, `<title>`, métadonnées.

## Tests

**E2E** dans `e2e/fiche-offre.spec.ts` :

- sans CV, le HTML de la page ne contient ni l'email ni le téléphone de l'offre ;
- après l'envoi du CV, les liens `mailto:` et `tel:` apparaissent ;
- une offre au logement inconnu affiche « Non précisé » ;
- une offre au salaire brut horaire affiche « € brut / heure » ;
- une offre collectée affiche la mention de provenance et le lien de contact ;
- une offre dont la date limite est passée n'affiche plus aucune coordonnée ;
- le nom d'une entreprise anonyme n'apparaît nulle part dans le HTML.

## Critères d'acceptation

- [x] §9 : aucun parcours de candidature ordinaire ne mène à un job-board exclu.
- [x] §9 : les inconnues ne sont jamais converties ; net, brut et unités restent distingués.
- [x] §9 : un dossier complet est exigé pour candidater, et aucun document n'est envoyé automatiquement.
- [x] §7 : le mode de candidature est expliqué sur chaque annonce.
- [x] §7 : l'anonymat est réservé au canal chargé de recrutement.

## Hors périmètre

- Formulaire de candidature intégré.
- Envoi du CV par la plateforme.
- Statistiques de clics.
