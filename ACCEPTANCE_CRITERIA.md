# PromptHub Studio – verbindliche Abnahmematrix

Eine KI-Selbsteinschätzung ist kein Nachweis. Für jedes Kriterium werden
ausführbare Tests, Logs oder GitHub-API-Antworten mit Zeit und Commit referenziert.

| ID | Kriterium | Nachweis / Test | Gate | Status |
|---|---|---|---|---|
| A01 | PWA, API und Control-Plane-Datenfluss | `test/api.test.mjs`, Health-/PWA-Laufzeitprüfung | Pflicht | lokal bestanden |
| A02 | Sichere Authentifizierung | `test/auth.test.mjs`, `test/config.test.mjs` | Pflicht | lokal bestanden |
| A03 | Keine Geheimnisse im Browser/GitHub/Log | `scripts/check.mjs`, OAuth-/Payload-Assertions | Pflicht | lokal bestanden |
| A04 | Zuverlässige Auftragsverarbeitung | `test/runner.test.mjs`, `npm run demo` | Pflicht | lokal bestanden |
| A05 | Global maximal zwei aktive Jobs | `test/lease-store.test.mjs`, Control-Plane-Cap-Test | Pflicht | lokal bestanden |
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false` | Pflicht | lokal bestanden; Mac offen |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | `.github/workflows/ci.yml`; erfolgreicher GitHub-Actions-Lauf; GitHub-Branch-API muss `main` als geschützt mit erforderlichem Check `test` ausweisen | Pflicht | teilweise: Run 9 (`43727273718`, Commit `8f0fdc25e90f0ba32d0ed79c724ff136aed14881`) Job `test` erfolgreich; Regeln-API antwortet 403 „Upgrade to GitHub Pro or make this repository public“; `main` bleibt ungeschützt. Pages baut `npm test` und `npm run check` vor Veröffentlichung, blockiert damit fehlerhafte Deployments, aber nicht Merges |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | keine Runtime-Dependencies, harte Cap-/Retry-/Polling-Limits | Pflicht | lokal bestanden |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates, projektbezogene Erfassung/Anzeige und Projektwechsel-Regressionen bestanden; echte GitHub-Review-/Actions-Nachweise und produktive Control-API-Verbindung sind wegen fehlender Laufzeitkonfiguration noch nicht live abgenommen |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Cloud-first Control Plane auf Cloudflare Pages ohne kostenpflichtigen Dauer-Server | `test/cloudflare-worker.test.mjs`, `test/cloudflare-pages.test.mjs`, `src/cloudflare/worker.mjs`, `functions/[[path]].js`, `src/pwa/_routes.json`, `wrangler.toml`; Free-Quota-Limits und Fail-Closed in `CLOUDFLARE_OPERATIONS.md` | Pflicht | teilweise: Pages live unter `https://prompthub-studio.pages.dev`, statische Assets HTTP 200, Fail closed verifiziert; `/api/me` und `/healthz` geben ohne Runtime-Konfiguration 503; OAuth/KV/Secrets, Quoten-/Ausfalltest und Kontobilling ungeprüft |
| A17 | PWA-Installationssymbol und iPhone-Installation | `test/api.test.mjs`, `test/cloudflare-pages.test.mjs`, `test/pwa-updates.test.mjs`: Manifest, Apple-Touch-Icon, PNG-Antwort, Offline-Fallback, Cache-Isolation, freigegebener Update-Flow und MIME | Pflicht | teilweise: Manifest, Icon und statische Assets live mit HTTP 200 geprüft; Offline-/Update-Flow lokal regressionstested; Installation und Aktualisierung auf echtem iPhone offen |
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
A27/A28 sind durch reproduzierbare Tests belegt. GitHub Actions Run 9 und der
Pages-Produktionsbuild für `504477dc35dab908c8b3755550866bca071c72db` sind
erfolgreich; die PWA-Assets sind über HTTPS erreichbar. `main` erzwingt den
freigegebenen Check `test` nicht: die Rulesets-API antwortet mit HTTP 403 und
verlangt GitHub Pro für private Repositories oder eine öffentliche Sichtbarkeit.
Der Pages-Build führt die Pflichtprüfungen unabhängig vor jeder Veröffentlichung
aus, verhindert aber keinen Merge. Die Control API ist
noch nicht konfiguriert (503); OAuth/KV, ein echter Mac-/Cloud-Runner,
iPhone-Installation und Kontobilling sind nicht nachgewiesen. Die vollständige
technische Erstabnahme ist daher nicht bestanden.
