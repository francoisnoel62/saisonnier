-- Plan scan V2-01 (SH20) : reprise du registre des sources, rejouable (tout est conditionnel).
-- 1. Ligne d'état antérieure (revision nulle) d'une clé inconnue, jamais citée : supprimée.
delete from scan_sources s
where s.revision is null and s.key not in ('france-travail', 'belambra', 'vvf', 'ms-vacances', 'accor-smartrecruiters', 'sandaya', 'pierre-et-vacances')
  and not exists (select 1 from scan_candidates c where c.source_key = s.key)
  and not exists (select 1 from scan_run_sources r where r.source_key = s.key)
  and not exists (select 1 from scan_reviews v where v.source_key = s.key);
--> statement-breakpoint
-- 2. Interrupteurs antérieurs qui ne restent pas permis : remis à faux (étape 3), avec leur raison.
insert into scan_source_events (source_key, kind, details)
select s.key, 'switched', jsonb_build_object('flag', 'enabled', 'value', false, 'reason', $t$Reprise du registre (migration 0018) : seule une source prête peut être activée (D5).$t$)
from scan_sources s
where s.revision is null and s.enabled and s.key not in ('france-travail');
--> statement-breakpoint
insert into scan_source_events (source_key, kind, details)
select s.key, 'switched', jsonb_build_object('flag', 'autoPublish', 'value', false, 'reason', case when s.key in ('france-travail') then $t$Reprise du registre (migration 0018) : une source de découverte ne publie jamais automatiquement (D6).$t$ else $t$Reprise du registre (migration 0018) : seule une source prête peut publier automatiquement (D5).$t$ end)
from scan_sources s
where s.revision is null and s.auto_publish;
--> statement-breakpoint
-- 3. Les sept sources : insérées, ou complétées une seule fois si une ligne d'état antérieure existe
-- (activation conservée si elle reste permise).
insert into scan_sources (key, label, kind, adapter, status, revision, role, priority, employer_name, employer_siren, employer_website, reuse_decision, reuse_decision_note, reuse_decided_at, rejection_reason, enabled, auto_publish)
values
('france-travail', $t$France Travail$t$, 'discovery', 'france-travail', 'ready', 1, 'primary', 0, null, null, null, 'accepted', $t$Décision du 23/10/2026 consignée dans docs/scan/sources-v1.md (« Décision sur l’accès France Travail »), prise par délégation explicite du fondateur : découverte prioritaire (SH17), acceptée pour la sonde, l’échantillon et le remplissage initial. Passages programmés exclus sans API officielle ou avis juridique écrit. Une lecture autorisée par robots.txt ne vaut pas autorisation de republier.$t$, '2026-10-23T16:03:00+02:00'::timestamptz, null, false, false),
('belambra', $t$Belambra$t$, 'employer', 'teamtailor', 'draft', 1, 'reserve', 10, $t$Belambra Clubs$t$, $t$322706136$t$, $t$https://www.belambra.fr/$t$, 'pending', null, null, null, false, false),
('vvf', $t$VVF$t$, 'employer', 'factorial', 'draft', 1, 'reserve', 20, $t$VVF$t$, $t$775634132$t$, $t$https://www.vvf.fr/$t$, 'pending', null, null, null, false, false),
('ms-vacances', $t$MS Vacances$t$, 'employer', 'teamtailor', 'draft', 1, 'reserve', 30, $t$MS Vacances$t$, null, $t$https://www.ms-vacances.com/$t$, 'pending', null, null, null, false, false),
('accor-smartrecruiters', $t$Accor (API SmartRecruiters)$t$, 'employer', 'smartrecruiters', 'rejected', 1, 'reserve', 100, $t$Accor$t$, null, null, 'pending', null, null, $t$robots.txt de l’API SmartRecruiters : « User-agent: * », « Disallow: / » (23/10/2026). Notre robot ne prend pas une autre identité ; aucune liste ni fiche lue (plan scan 01).$t$, false, false),
('sandaya', $t$Sandaya (WeRecruit)$t$, 'employer', null, 'rejected', 1, 'reserve', 100, $t$Sandaya$t$, null, $t$https://www.sandaya.fr/$t$, 'pending', null, null, $t$Liste construite par JavaScript : aucune offre dans le HTML de recrutement.sandaya.jobs (plan scan 01). À réexaminer si une liste lisible sans JavaScript apparaît.$t$, false, false),
('pierre-et-vacances', $t$Pierre & Vacances – Center Parcs$t$, 'employer', null, 'rejected', 1, 'reserve', 100, $t$Pierre & Vacances – Center Parcs$t$, null, $t$https://www.groupepvcp.com/$t$, 'pending', null, null, $t$Liste dynamique sans inventaire fiable sur groupepvcp.com/talents (plan scan 01). À réexaminer si une liste lisible sans JavaScript apparaît.$t$, false, false)
on conflict (key) do update set
  label = excluded.label,
  kind = excluded.kind,
  adapter = excluded.adapter,
  status = excluded.status,
  revision = excluded.revision,
  role = excluded.role,
  priority = excluded.priority,
  employer_name = excluded.employer_name,
  employer_siren = excluded.employer_siren,
  employer_website = excluded.employer_website,
  reuse_decision = excluded.reuse_decision,
  reuse_decision_note = excluded.reuse_decision_note,
  reuse_decided_at = excluded.reuse_decided_at,
  rejection_reason = excluded.rejection_reason,
  enabled = scan_sources.enabled and excluded.status = 'ready',
  auto_publish = scan_sources.auto_publish and excluded.status = 'ready' and excluded.kind = 'employer'
where scan_sources.revision is null;
--> statement-breakpoint
-- 4. Clé citée par un passage, un dossier ou une revue, absente du registre : source archivée de
-- substitution (libellé = clé, version 1 incomplète).
update scan_sources
set label = key, kind = 'employer', status = 'archived', archived_at = now(), revision = 1,
  enabled = false, daily_enabled = false, auto_publish = false
where revision is null;
--> statement-breakpoint
insert into scan_sources (key, label, kind, status, archived_at, revision)
select cited.key, cited.key, 'employer', 'archived', now(), 1
from (
  select source_key as key from scan_candidates
  union select source_key from scan_run_sources
  union select source_key from scan_reviews where source_key is not null
) cited
where not exists (select 1 from scan_sources s where s.key = cited.key);
--> statement-breakpoint
-- 5. Version 1 des sept sources (copie du registre en code pour les quatre premières).
insert into scan_source_revisions (source_key, revision, definition, complete, config_hash)
values
('france-travail', 1, $j${"label":"France Travail","kind":"discovery","employer":null,"employerWebsite":null,"adapter":"france-travail","listUrls":["https://candidat.francetravail.fr/offres/recherche?domaine=G&emission=3&lieux=99100&offresPartenaires=false&range=0-19&rayon=10&tri=1&typeContrat=SAI"],"postingUrlPattern":"^https://candidat\\.francetravail\\.fr/offres/recherche/detail/[A-Z0-9]+/?$","officialHosts":["candidat.francetravail.fr"],"affiliationProof":{"url":"https://www.francetravail.fr/informations/informations-legales-et-conditio/conditions-generales-dutilisatio.html","note":"Source de découverte France Travail choisie par le fondateur. Les CGU du service officiel décrivent la consultation et la diffusion des offres ; France Travail n'est pas l'employeur des recrutements.","checkedAt":"2026-10-23"},"reuse":{"url":"https://www.francetravail.fr/informations/informations-legales-et-conditio/conditions-generales-dutilisatio.html","robotsExcerpt":"User-agent: * ; les restrictions de /robots.txt ne visent ni /offres/recherche ni /offres/recherche/detail/. Lecture autorisée le 23/10/2026.","note":"Liste HTML publique ; détail JSON public du composant officiel sur /api-descriptifoffre/offre/<id>, sans clé. Ce service est distinct de l'API partenaire restreinte. Les CGU décrivent une licence de réutilisation via partenaires API, sans établir ici une autorisation de republication. La source officielle employeur reste à retrouver avant publication.","checkedAt":"2026-10-23"},"limits":{},"placeAliases":{},"adapterParams":{"searchUrls":["https://candidat.francetravail.fr/offres/recherche?domaine=G&emission=3&lieux=99100&offresPartenaires=false&range=0-19&rayon=10&tri=1&typeContrat=SAI"]}}$j$::jsonb, true, '760558bacc03c83e9f40080d3e041003c0aebe49e7b998f7d89b22732e60c833'),
('belambra', 1, $j${"label":"Belambra","kind":"employer","employer":{"name":"Belambra Clubs","siren":"322706136"},"adapter":"teamtailor","listUrls":["https://recrute.belambra.fr/jobs.rss"],"postingUrlPattern":"^https://recrute\\.belambra\\.fr/jobs/[0-9]+-[^/?#]+/?$","officialHosts":["recrute.belambra.fr"],"employerWebsite":"https://www.belambra.fr/","affiliationProof":{"url":"https://www.belambra.fr/faq-foire-aux-questions","note":"La FAQ officielle renvoie les candidats vers recrute.belambra.fr.","checkedAt":"2026-10-23"},"reuse":{"url":"https://www.belambra.fr/mentions-legales","robotsExcerpt":"User-Agent: * ; Disallow: /app/, /messages/, /messenger/, /facebook/tab/, /jobs/internal/ ; aucun Crawl-delay. /jobs.rss et les fiches publiques autorisés le 23/10/2026.","note":"Les mentions du site principal soumettent la reproduction à autorisation écrite préalable. Portée sur le portail ATS et autorisation de reprise à valider par le fondateur avant activation.","checkedAt":"2026-10-23"},"limits":{},"placeAliases":{},"adapterParams":{"portalUrl":"https://recrute.belambra.fr"}}$j$::jsonb, true, 'af4f0b84fc797f6d647bb3fc8c9aecd2c742444396bf1211641c8d1075676939'),
('vvf', 1, $j${"label":"VVF","kind":"employer","employer":{"name":"VVF","siren":"775634132"},"adapter":"factorial","listUrls":["https://vvfrecrute.factorial.fr/"],"postingUrlPattern":"^https://vvfrecrute\\.factorial\\.fr/job_posting/[^/?#]+-[0-9]+/?$","officialHosts":["vvfrecrute.factorial.fr"],"employerWebsite":"https://www.vvf.fr/","affiliationProof":{"url":"https://www.vvf.fr/article/vvf-recrutement","note":"La page officielle renvoie « Voir les offres » vers vvfrecrute.factorial.fr et distingue la candidature spontanée /apply.","checkedAt":"2026-10-23"},"reuse":{"url":"https://www.vvf.fr/article/conditions-generales-utilisation-site-internet","robotsExcerpt":"User-agent: *\nAllow: /\nAucun Crawl-delay le 23/10/2026.","note":"Les CGU du site principal interdisent la reproduction hors usage privé et non commercial. Portée sur Factorial et autorisation de reprise à valider par le fondateur avant activation.","checkedAt":"2026-10-23"},"limits":{},"placeAliases":{"PRAPOUTEL LES SEPT LAUX":{"inseeCode":"38002","name":"Les Adrets","departmentCode":"38"}},"adapterParams":{"portalUrl":"https://vvfrecrute.factorial.fr"}}$j$::jsonb, true, '111d52110b7d1fe3b5d69eeea1cfdd83d5236bfe39d99834e50e878689affe0c'),
('ms-vacances', 1, $j${"label":"MS Vacances","kind":"employer","employer":{"name":"MS Vacances"},"adapter":"teamtailor","listUrls":["https://emploi.ms-vacances.com/jobs.rss"],"postingUrlPattern":"^https://emploi\\.ms-vacances\\.com/jobs/[0-9]+-[^/?#]+/?$","officialHosts":["emploi.ms-vacances.com"],"employerWebsite":"https://www.ms-vacances.com/","affiliationProof":{"url":"https://www.ms-vacances.com/","note":"Le pied de page officiel, rubrique Entre vous & nous, renvoie Offres d'emploi vers emploi.ms-vacances.com.","checkedAt":"2026-10-23"},"reuse":{"url":"https://www.ms-vacances.com/mentions-legales/","robotsExcerpt":"User-Agent: * ; Disallow: /app/, /messages/, /messenger/, /facebook/tab/, /jobs/internal/ ; aucun Crawl-delay. Flux et fiches publiques autorisés le 23/10/2026.","note":"Page de mentions actuellement sans contenu exploitable ; politique du portail /data-privacy disponible. Aucune autorisation de reprise établie, validation du fondateur attendue avant activation.","checkedAt":"2026-10-23"},"limits":{},"placeAliases":{},"adapterParams":{"portalUrl":"https://emploi.ms-vacances.com"}}$j$::jsonb, true, 'f04838af638712867c380322a847c66aa7002675c13f438e804cee6d426bd361'),
('accor-smartrecruiters', 1, $j${"label":"Accor (API SmartRecruiters)","kind":"employer","employer":{"name":"Accor"},"adapter":"smartrecruiters","adapterParams":{},"listUrls":["https://api.smartrecruiters.com/v1/companies/Accor/postings?country=fr"],"officialHosts":["api.smartrecruiters.com"],"reuse":{"url":"https://api.smartrecruiters.com/robots.txt","robotsExcerpt":"HTTP 200 : « User-agent: * », « Disallow: / » ; seul LinkedInBot est autorisé sur /v1/companies/. Relevé le 23/10/2026.","note":"Le client du scan renvoie robots_disallowed sur la liste de l’API. Notre robot ne prend pas une autre identité : aucune liste ni fiche lue.","checkedAt":"2026-10-23"}}$j$::jsonb, false, 'd5bd7a6963f7c0baef9bbf6c9ecb29f5fd485a869ca54ed0618a5997946f7cb0'),
('sandaya', 1, $j${"label":"Sandaya (WeRecruit)","kind":"employer","employer":{"name":"Sandaya"},"employerWebsite":"https://www.sandaya.fr/","officialHosts":["recrutement.sandaya.jobs"]}$j$::jsonb, false, 'c6ebb7de3b27edf3c7261f2ea107f5118789054f7a8baced981816f10efb509f'),
('pierre-et-vacances', 1, $j${"label":"Pierre & Vacances – Center Parcs","kind":"employer","employer":{"name":"Pierre & Vacances – Center Parcs"},"employerWebsite":"https://www.groupepvcp.com/","listUrls":["https://www.groupepvcp.com/talents/"],"officialHosts":["www.groupepvcp.com"]}$j$::jsonb, false, '477c1c7c5afbc65b8446fa5d3b94f865ec9bdbe8f1e611a6a8822bae5302d412')
on conflict do nothing;
--> statement-breakpoint
insert into scan_source_revisions (source_key, revision, definition, complete, config_hash, note)
select s.key, 1, jsonb_build_object('label', s.key, 'kind', 'employer'), false, '73b41381f894570e1c52ea292d5c2978e8e2ce1db210ccf9d91fb61d595a7b85', $t$Source de substitution : clé citée sans définition au registre.$t$
from scan_sources s
where s.status = 'archived' and s.revision = 1 and s.created_by_user_id is null
  and not exists (select 1 from scan_source_revisions r where r.source_key = s.key);
--> statement-breakpoint
-- 6. Hôtes officiels (D7) des sources reprises, tant qu'elles ne sont ni archivées ni modifiées.
insert into scan_source_hosts (host, source_key)
select h.host, h.source_key
from (values
('candidat.francetravail.fr', 'france-travail'),
('recrute.belambra.fr', 'belambra'),
('vvfrecrute.factorial.fr', 'vvf'),
('emploi.ms-vacances.com', 'ms-vacances'),
('api.smartrecruiters.com', 'accor-smartrecruiters'),
('recrutement.sandaya.jobs', 'sandaya'),
('www.groupepvcp.com', 'pierre-et-vacances')
) as h(host, source_key)
join scan_sources s on s.key = h.source_key and s.revision = 1 and s.status <> 'archived'
on conflict (host) do nothing;
--> statement-breakpoint
-- 7. Un événement « imported » par source reprise (acteur nul : migration).
insert into scan_source_events (source_key, kind, revision, details)
select v.key, 'imported', 1, v.details
from (values
('france-travail', $j${"references":["docs/scan/sources-v1.md"],"note":"Source de découverte prioritaire du registre en code (plans scan 01 à 08, commit ae31948)."}$j$::jsonb),
('belambra', $j${"references":["docs/scan/sources-v1.md"],"note":"Réserve du registre en code (plans scan 01 à 08) : autorisation de reprise à décider avant activation."}$j$::jsonb),
('vvf', $j${"references":["docs/scan/sources-v1.md"],"note":"Réserve du registre en code (plans scan 01 à 08) : autorisation de reprise à décider avant activation."}$j$::jsonb),
('ms-vacances', $j${"references":["docs/scan/sources-v1.md"],"note":"Réserve du registre en code (plans scan 01 à 08) : sonde depuis une preview et décision de reprise à faire avant activation."}$j$::jsonb),
('accor-smartrecruiters', $j${"references":["docs/scan/sources-v1.md"],"note":"Piste écartée au plan scan 01 (docs/scan/sources-v1.md)."}$j$::jsonb),
('sandaya', $j${"references":["docs/scan/sources-v1.md"],"note":"Piste écartée au plan scan 01 (docs/plans/scan-v1/01-sources-client-http.md)."}$j$::jsonb),
('pierre-et-vacances', $j${"references":["docs/scan/sources-v1.md"],"note":"Piste écartée au plan scan 01 (docs/plans/scan-v1/01-sources-client-http.md)."}$j$::jsonb)
) as v(key, details)
where not exists (select 1 from scan_source_events e where e.source_key = v.key and e.kind = 'imported');
--> statement-breakpoint
insert into scan_source_events (source_key, kind, revision, details)
select s.key, 'imported', 1, $j${"references":["drizzle/0018_scan_source_seed.sql"],"note":"Clé citée par un passage, un dossier ou une revue, absente du registre : source archivée de substitution."}$j$::jsonb
from scan_sources s
join scan_source_revisions r on r.source_key = s.key and r.revision = 1 and not r.complete
where s.status = 'archived' and s.created_by_user_id is null and s.key not in ('france-travail', 'belambra', 'vvf', 'ms-vacances', 'accor-smartrecruiters', 'sandaya', 'pierre-et-vacances')
  and not exists (select 1 from scan_source_events e where e.source_key = s.key and e.kind = 'imported');
--> statement-breakpoint
-- 8. Version figée des passages antérieurs : la version courante.
update scan_run_sources rs
set source_revision = s.revision
from scan_sources s
where s.key = rs.source_key and rs.source_revision is null;
