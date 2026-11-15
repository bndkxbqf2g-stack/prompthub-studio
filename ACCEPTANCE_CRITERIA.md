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
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false`, echte macOS-CI und lokaler Mac-Runner | Pflicht | Windows-Live-Smoke bestätigte `runner_inbound_port=false`; Port 18787 war nach dem Stopp geschlossen. PR #21 verifizierte auf Head `a873695153a6bb24e61b149d5ee0fc64108e33a4` mit Actions-Run 80 (`43770627889`) erfolgreiche vollständige Tests und Static-Checks auf `macos-latest` (Apple Silicon) und `macos-15-intel`; der erforderliche Job `test` bestand ebenfalls. Main-Run 84 (`43771264550`) auf Commit `9c5e4b40adaaccfb6065e177cdad01ab7fd3d816` bestätigte beide macOS-Lanes und `test` erneut. Ein echter lokaler MacBook-Runner und dessen Codex-Ausführung sind weiterhin nicht nachgewiesen. |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | `.github/workflows/ci.yml`; erfolgreicher Actions-Job `test`; Branch-API-Readback | Pflicht | Main-Commit `9c5e4b40adaaccfb6065e177cdad01ab7fd3d816`: Main-CI-Run 84 (`43771264550`) bestand `macos-latest`, `macos-15-intel` und `test`; Pages-Run 22 (`43771264030`) bestand `build`, `deploy` und `report-build-status`. PR #22 wurde nach erfolgreichen Prüfungen automatisch gemergt. `allow_auto_merge=true`; automatische Merges nach bestandenen Pflichtchecks sind vom Nutzer ausdrücklich autorisiert. Die letzte Prüfung in den GitHub-Settings bestätigte `test`, `strict=true` und Admin-Enforcement, aber keine PR-Pflicht; direkte Commits auf `main` sind damit weiterhin möglich. Der API-Readback ist mit HTTP 403 nicht verfügbar. Die zusätzliche PR-Pflicht ist angefragt, aber nicht aktiviert. Frühere Nachweise: CP-021 bis CP-024 und CP-029 bis CP-036 |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | keine Runtime-Dependencies, harte Cap-/Retry-/Polling-Limits | Pflicht | lokal bestanden |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates, projektbezogene Erfassung/Anzeige und Projektwechsel-Regressionen bestanden; echte GitHub-Review-/Actions-Nachweise und produktive Control-API-Verbindung sind wegen fehlender Laufzeitkonfiguration noch nicht live abgenommen |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Kostenfreies serverloses Control Plane, unabhängig vom statischen PWA-Host | `HOSTING_OPTIONS.md`; Integrationstests für den ausdrücklich ausgewählten Anbieter, OAuth/Sitzungen, Speicherisolation, Quoten-Fail-Closed und HTTPS-Live-Smoke; Kosten-/Kontingent-Readback | Pflicht | teilweise, produktiv No-Go: das separate private GitHub-Control-Repository und die leere Lease-Datei sind eingerichtet und verifiziert. GitHub Pages hostet nur die PWA-Hülle. Cloudflare bleibt pausiert und wird nicht reaktiviert. Netlify Free ist nur ein Kandidat; unabhängige Prüfung fand fehlende Function-/Session-Implementierung, Production-/Preview-Isolation, Kosten-Readback und Live-Nachweise. Die dokumentierten Team-Warnungen reichen nicht als automatische PromptHub-Jobpause; eine unterstützte API für aktuellen Team-Credit-Verbrauch ist nicht nachgewiesen. OAuth-App, Runtime-Secrets, Anbieter-Verknüpfung, Auth-/Sitzungsadapter und Runtime-Abhängigkeit fehlen. Bei unbekannter Quote müssen Cloud-Jobs gesperrt bleiben. |
| A17 | PWA-Installationssymbol und iPhone-Installation | `test/api.test.mjs`, `test/cloudflare-pages.test.mjs`, `test/pwa-updates.test.mjs`, `test/pwa-availability.test.mjs`: Manifest, Apple-Touch-Icon, PNG-Antwort, Offline-Fallback, Cache-Isolation, freigegebener Update-Flow und ehrlicher API-Ausfall | Pflicht | teilweise: Pages-Run 22 (`43771264030`) auf dem aktuellen Main-Commit bestand; der vorherige Pages-Run 21 (`43770701589`) veröffentlichte die geprüfte PWA-Änderung. HTTPS-Smoke bestätigte Startseite, Manifest, App-Icon, Service Worker, App-Skript und Stylesheet mit HTTP 200. Im Browser-Viewport 390×844 zeigt die PWA Titel, Aktualisieren-Schalter und eine Erklärung, dass Anmelden, Projekte, Aufträge und Freigaben eine serverseitige API benötigen. Ein Klick auf Aktualisieren wiederholt den Bootstrap und erhält bei weiterhin fehlender API den Fehlerzustand statt Erfolg zu melden. Das Manifest enthält relative `start_url`, `scope`, Standalone-Modus und Icon. Echte iPhone-Installation, Offline-Verhalten und Update nach Live-Deployment bleiben offen |
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
A27/A28 sind durch reproduzierbare Tests belegt. Der verifizierte Main-Commit
`9c5e4b40adaaccfb6065e177cdad01ab7fd3d816` bestand Main-CI-Run 84
(`43771264550`) einschließlich beider macOS-Lanes und `test`, sowie Pages-Run
22 (`43771264030`). PR #22 wurde nach bestandenen Prüfungen durch GitHub
Auto-Merge integriert. Der vorherige Produktänderungs-Commit `bf5a15c1b8a4fc0f832e55aefcdc84bfa440c5a5` und PR #21 bleiben als Nachweis der PWA-Ausfallbehandlung dokumentiert.
Das Quell-Repository ist auf ausdrückliche Nutzeranweisung öffentlich; kein
kostenpflichtiger Plan wurde aktiviert. Cloudflare bleibt pausiert; die
Projektlöschung wartet auf die gesonderte Bestätigung des Nutzers.
GitHub Pages stellt keine Control API
bereit, und es ist noch kein alternativer API-Host freigegeben oder konfiguriert.
Die GitHub-Branch-Einstellungsseite wurde am 2026-11-15 erneut geprüft: `test`,
`strict=true` und Admin-Enforcement sind aktiv; die Regel verlangt keinen PR,
direkte Commits auf `main` sind somit weiterhin möglich. `allow_auto_merge=true`
ist aktiv. Die verbundene GitHub-API verweigert den Branch-Schutz-Readback mit
HTTP 403. OAuth-/Sitzungsbetrieb, echter Mac-/Cloud-Runner,
iPhone-Installation, Kontobilling und externe Lernexperimente sind nicht
nachgewiesen. Die vollständige technische Erstabnahme ist daher nicht bestanden.
