# PromptHub Studio – verbindliche Abnahmematrix

Eine KI-Selbsteinschätzung ist kein Nachweis. Für jedes Kriterium werden
ausführbare Tests, Logs oder GitHub-API-Antworten mit Zeit und Commit referenziert.

| ID | Kriterium | Nachweis / Test | Gate | Status |
|---|---|---|---|---|
| A01 | PWA, API und Control-Plane-Datenfluss | `test/api.test.mjs`; lokaler HTTP-Smoke auf `127.0.0.1:18787` für `/`, Manifest, PNG-Icon, `/healthz` und `/api/me` | Pflicht | lokal bestanden: alle fünf Antworten HTTP 200; CSP vorhanden; lokale Sitzung ohne Tokenantwort |
| A02 | Sichere Authentifizierung | `test/auth.test.mjs`, `test/config.test.mjs` | Pflicht | lokal bestanden |
| A03 | Keine Geheimnisse im Browser/GitHub/Log | `scripts/check.mjs`, OAuth-/Payload-Assertions | Pflicht | lokal bestanden |
| A04 | Zuverlässige Auftragsverarbeitung | `test/runner.test.mjs`, `npm run demo` | Pflicht | lokal bestanden: Demo-Auftrag `job_4883cfd5-d035-47ef-b9de-d0bcce8095f7` erreichte `succeeded` nach Pflichtcheck und sieben Ereignissen; Executor war ausdrücklich geskriptet |
| A05 | Global maximal zwei aktive Jobs | `test/lease-store.test.mjs`, Control-Plane-Cap-Test | Pflicht | lokal bestanden |
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false` | Pflicht | lokal verifiziert: gestarteter lokaler Server meldete `runner_inbound_port=false`; Port 18787 war nach dem Stopp geschlossen; echter Mac-Runner weiterhin offen |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | `.github/workflows/ci.yml`; PR-/Push-Patchvergleich, erfolgreicher Actions-Job `test`; Branch-API-Readback | Pflicht | Aktueller Main-Commit `cf348e610c381071aa56bb89c0f5aa5753e4cfad`: Main-Run 54 (`43761269714`) bestand mit `test`; Pages-Run 12 (`43761268857`) bestand mit Build und Deployment. PR #12 wurde nach bestandenem PR-Run 53 (`43760996745`) integriert. Auto-Merge war aktiviert, führte den Merge aber nicht aus; nach Prüfung des grünen `test`-Checks und gepinntem Head-SHA wurde der PR über die Merge-API abgeschlossen. PR #11 (Merge-Commit `5c6f93b199127eea0b301b534f8b3e0375c834ce`) war nach erfolgreichem CI automatisch gemergt. `allow_auto_merge=true` ist im Repository bestätigt. Letzter erfolgreicher Branch-API-Readback bestätigte `test`, `strict=true` und Admin-Enforcement; erneutes Lesen ist für die aktuelle GitHub-Integration mit 403 nicht verfügbar. Die Regel verlangt keinen PR und beschränkt direkte Pushes nicht. Details zu früheren Läufen in CP-021 bis CP-024 und CP-029 |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | keine Runtime-Dependencies, harte Cap-/Retry-/Polling-Limits | Pflicht | lokal bestanden |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates, projektbezogene Erfassung/Anzeige und Projektwechsel-Regressionen bestanden; echte GitHub-Review-/Actions-Nachweise und produktive Control-API-Verbindung sind wegen fehlender Laufzeitkonfiguration noch nicht live abgenommen |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Kostenfreies serverloses Control Plane, unabhängig vom statischen PWA-Host | `HOSTING_OPTIONS.md`; Integrationstests für den ausdrücklich ausgewählten Anbieter, OAuth/Sitzungen, Speicherisolation, Quoten-Fail-Closed und HTTPS-Live-Smoke; Kosten-/Kontingent-Readback | Pflicht | teilweise, produktiv No-Go: das separate private GitHub-Control-Repository und die leere Lease-Datei sind eingerichtet und verifiziert. GitHub Pages hostet nur die PWA-Hülle. Cloudflare bleibt pausiert und wird nicht reaktiviert. Netlify Free ist nur ein Kandidat; unabhängige Prüfung fand fehlende Function-/Session-Implementierung, Production-/Preview-Isolation, Kosten-Readback und Live-Nachweise. Die dokumentierten Team-Warnungen reichen nicht als automatische PromptHub-Jobpause; eine unterstützte API für aktuellen Team-Credit-Verbrauch ist nicht nachgewiesen. OAuth-App, Runtime-Secrets, Anbieter-Verknüpfung, Auth-/Sitzungsadapter und Runtime-Abhängigkeit fehlen. Bei unbekannter Quote müssen Cloud-Jobs gesperrt bleiben. |
| A17 | PWA-Installationssymbol und iPhone-Installation | `test/api.test.mjs`, `test/cloudflare-pages.test.mjs`, `test/pwa-updates.test.mjs`: Manifest, Apple-Touch-Icon, PNG-Antwort, Offline-Fallback, Cache-Isolation, freigegebener Update-Flow und MIME | Pflicht | teilweise: nach PR #2 (14 Commits, Merge-Commit `c3d479a7676a143ebf4c6ad8448651e162bb9ea3`) lädt GitHub Pages die PWA unter `/src/pwa/` mit Unterpfad-relativem Stylesheet sowie Icon-/Manifest-URLs; Browserprüfung zeigte gerendertes UI ohne Konsolenfehler. Die Control API ist auf GitHub Pages nicht verfügbar, UI meldet sie nicht erreichbar. Offline-/Update-Flow ist lokal regressionstested; echte iPhone-Installation und Live-Offline-/Updateprüfung bleiben offen |
| A18 | Multi-Projekt-Analyse | `test/projects.test.mjs`: Regeln, README, Skripte, Issues, CI, nur lesende API und Snapshot-Version | Pflicht | lokal bestanden |
| A19 | Entfernen/Wiederverbinden/Datenlöschung | `test/projects.test.mjs`, `test/api-projects.test.mjs`: Bestätigung, Pause, laufende/stale Sperre, Wiederverbinden, getrennte Datenlöschung; kein Repo-Delete | Pflicht | lokal bestanden |
| A20 | Prompt-Designer | `test/prompt-designer.test.mjs`, `test/api-projects.test.mjs`: Analyse, Einzelfrage, vier Optionen, Skip/Ende, Anforderungen/Annahmen, Version, QA und ausdrückliche Freigabe | Pflicht | lokal bestanden |
| A21 | KI-Zugang bei 0 € | `test/prompt-designer.test.mjs`: ungeprüfter Provider wird nie aufgerufen; deterministischer Fallback wird ausgewiesen | Pflicht | lokal bestanden; kein LLM-Zugang verfügbar |
| A22 | Quellenbibliothek | `test/research-metrics.test.mjs`: Quelle, Autor, Abrufdatum, Lizenz, Version, Suche, Dubletten-, Aktualitäts-, Konflikt- und Sicherheitsmarker | Pflicht | lokal bestanden |
| A23 | Wissensintegration und Ergebnislernen | `test/projects.test.mjs`, `test/project-store.test.mjs`, `test/prompt-designer.test.mjs`, `test/runner.test.mjs`: echte Control-Plane-Abschlussereignisse, bestandene Pflichtchecks, projektisolierte Speicherung/Wiederverwendung, Idempotenz, CAS-Konflikt, Digest-/Manipulationsprüfung; gepaarte Commit-/CI-Experimente bleiben separat offen | Pflicht | lokal teilweise bestanden; kontrollierte projektübergreifende Experimente offen |
| A24 | Token-/Ressourcen-Dashboard | `test/research-metrics.test.mjs`, `test/runner.test.mjs`, `test/api-projects.test.mjs`: gemessene/teilweise/unbekannte Tokens, Provider-Aufrufe, Executor-Starts, Laufzeit, Retry und Pflichtchecks | Pflicht | lokal bestanden |
| A25 | Projektisolierung und Prompt-Freigabe | `test/prompt-designer.test.mjs`, `test/api-projects.test.mjs`: untrusted Projektkontext, versionierte Promptfreigabe und gesperrte Direktanlage | Pflicht | lokal bestanden |
| A26 | Token- und Ressourceneffizienz | `test/prompt-designer.test.mjs`, `test/projects.test.mjs`, `test/research-metrics.test.mjs`: taskbezogene Auswahl, versionierte Snapshots, begrenzte Cache-Deduplizierung, unveränderte Pflichtprüfungen | Pflicht | lokal bestanden |
| A27 | Fehlerprävention und Lernen | `test/error-learning.test.mjs`, `test/projects.test.mjs`, `test/prompt-designer.test.mjs`, `test/api-projects.test.mjs`: Runner-/CI-Symptome, datensparsame Fehlermusterklassifikation, Nutzerberichte, getrennte Hypothesen, projektisolierte Evidenz, menschlich bestätigte Ursachen mit später passendem Check und expliziter Prüfung derselben Korrektur, begrenzte Aufbewahrung, Digest-/Belegprüfung | Pflicht | lokal bestanden; gepaarte externe Commit-/CI-Experimente offen |
| A28 | Qualitäts-/Fehlerdashboard | `test/research-metrics.test.mjs`, `test/api-projects.test.mjs`, `test/error-learning.test.mjs`: echte fehlgeschlagene Jobs und Stichprobenquote, Fehlerbeobachtungstrend mit Historiengrenze, wiederkehrende Fehler, aktuell belegte Regressionen, offene Hypothesen, CI-Signalzahl; CI nicht als Ursache, fehlende Daten nicht als Schätzung | Pflicht | lokal bestanden; externe GitHub-/CI-Live-Daten offen |
| A29 | Regressionstest-Prävention aus Fehlerhistorie | `test/regression-test-request.test.mjs`, `test/api.test.mjs`: nur wiederholte Runnerfehler oder menschlich bestätigte Ursachen mit aktuellen Belegen erstellen einen begrenzten, projektbezogenen Testauftrag; Reproduktion und Vorher/Nachher-Nachweis erforderlich; Auftrag bleibt Entwurf bis regulärer Nutzerfreigabe | Pflicht | lokal bestanden; externe Ausführung in angeschlossenem Projekt offen |

## Abnahmeregel

Die technische Erstabnahme ist `bestanden`, wenn alle Pflichtkriterien einen
positiven, reproduzierbaren Nachweis besitzen und kein offener kritischer
Sicherheitsfehler existiert. Nicht implementierte externe Betriebsnachweise
(GitHub-Workflow-Run, OAuth-App, HTTPS-Hosting, echter Mac/Cloud-Runner) werden als `blocked_external_setup`
ausgewiesen und nicht als bestanden markiert.

## Aktueller Status

Aktueller Status: `conditional_local_pass`. Die lokale Implementierung sowie
A27/A28 sind durch reproduzierbare Tests belegt. Der zuletzt
funktionsseitig geprüfte Main-Stand `0670942982a1a68b305229251b99a8e4a28b6662`
bestand in Main-Run 48; Pages-Run 10 bestand mit Build und Deployment. Die
anschließenden PRs #11 und #12 enthielten Dokumentationsänderungen. Das
Quell-Repository ist auf ausdrückliche Nutzeranweisung öffentlich; kein
kostenpflichtiger Plan wurde aktiviert. Aktueller Main-Commit ist
`cf348e610c381071aa56bb89c0f5aa5753e4cfad`; Main-Run 54 und Pages-Run 12
bestanden. Cloudflare bleibt pausiert. GitHub Pages stellt keine Control API
bereit, und es ist noch kein alternativer API-Host freigegeben oder konfiguriert.
Der letzte erfolgreiche Branch-API-Readback bestätigte den erforderlichen Check
`test`, `strict=true` und Admin-Enforcement; direkte Pushes sind weiterhin nicht
eingeschränkt und die aktuelle GitHub-Integration kann den Branch-Schutz nicht
erneut auslesen. OAuth-/Sitzungsbetrieb, echter Mac-/Cloud-Runner,
iPhone-Installation, Kontobilling und externe Lernexperimente sind nicht
nachgewiesen. Die vollständige technische Erstabnahme ist daher nicht bestanden.
