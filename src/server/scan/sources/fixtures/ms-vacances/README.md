# Fixtures ms-vacances

Capture réelle du 2026-10-23T12:34:23.767Z. Liste : https://emploi.ms-vacances.com/jobs.rss.

Scripts exécutables, images, styles et suivis supprimés. JSON-LD conservé, y compris le JSON invalide. Liens mailto/tel remplacés par recrutement@employeur.example et +33 1 99 00 00 01. Structure utile, textes des offres, identifiants ATS et URL de provenance conservés. Aucun nom de personne identifié dans les blocs utiles ; les noms de clubs et de communes restent des lieux, pas des personnes.

Les captures brutes ne sont pas versionnées. Ne pas reformater ces fichiers.

| Fichier | URL d'origine | Date de capture |
|---|---|---|
| posting-1.html | https://emploi.ms-vacances.com/jobs/8566962-assistant-e-responsable-service-reservation | 2026-10-23T12:34:26.148Z |
| posting-2.html | https://emploi.ms-vacances.com/jobs/8557942-stage-receptionniste-h-f | 2026-10-23T12:34:28.555Z |
| posting-3.html | https://emploi.ms-vacances.com/jobs/8552923-responsable-agent-d-entretien-h-f | 2026-10-23T12:34:30.179Z |
| posting-5.html | https://emploi.ms-vacances.com/jobs/8544199-responsable-reception-h-f | 2026-10-23T12:34:34.170Z |
| posting-6.html | https://emploi.ms-vacances.com/jobs/8515304-responsable-epicerie-h-f | 2026-10-23T12:34:37.290Z |
| posting-7.html | https://emploi.ms-vacances.com/jobs/8514707-responsable-agent-d-entretien-h-f | 2026-10-23T12:34:39.564Z |

Les métadonnées et champs CSRF éphémères ont également été supprimés.

Correction après revue (23/10/2026) : le remplacement des téléphones avait pris pour un numéro une suite de chiffres du premier `<guid>` de `list.xml`. Ses deux premiers groupes, irrécupérables, sont remplacés par des zéros (`d0000000-0000-4a06-a161-847e34e4bed2`) : le GUID garde la forme d'un UUID et reste unique dans le flux.
