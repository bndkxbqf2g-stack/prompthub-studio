# PromptHub Studio – verbindliche Abnahmematrix

Eine KI-Selbsteinschätzung ist kein Nachweis. Für jedes Kriterium werden
ausführbare Tests, Logs oder GitHub-API-Antworten mit Zeit und Commit referenziert.

| ID | Kriterium | Nachweis / Test | Gate | Status |
|---|---|---|---|---|
| A01 | PWA, API und Control-Plane-Datenfluss | `test/api.test.mjs`; lokaler HTTP-Smoke für UI, Assets, `/healthz` und `/api/me` | Pflicht | lokal bestanden: `npm start` lieferte am 2026-11-16 für `/`, Manifest, PNG-Icon, `sw.js`, `/api/me` und `/healthz` HTTP 200. Listener-Inspektion des Betriebssystems wurde mit Zugriff verweigert; `src/config.mjs` setzt weiterhin `127.0.0.1` als Host-Default. |
| A02 | Sichere Authentifizierung | `test/auth.test.mjs`, `test/config.test.mjs` | Pflicht | lokal bestanden |
| A03 | Keine Geheimnisse im Browser/GitHub/Log | `scripts/check.mjs`, OAuth-/Payload-Assertions | Pflicht | lokal bestanden |
| A04 | Zuverlässige Auftragsverarbeitung | `test/runner.test.mjs`, `npm run demo` | Pflicht | lokal bestanden: Demo-Auftrag `job_4883cfd5-d035-47ef-b9de-d0bcce8095f7` erreichte `succeeded` nach Pflichtcheck und sieben Ereignissen; Executor war ausdrücklich geskriptet |
| A05 | Global maximal zwei aktive Jobs | `test/lease-store.test.mjs`, Control-Plane-Cap-Test | Pflicht | lokal bestanden |
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false`, echte macOS-CI und lokaler Mac-Runner | Pflicht | Windows-Live-Smoke bestätigte `runner_inbound_port=false`; Port 18787 war nach dem Stopp geschlossen. PR #21 verifizierte auf Head `a873695153a6bb24e61b149d5ee0fc64108e33a4` mit Actions-Run 80 (`43770627889`) erfolgreiche vollständige Tests und Static-Checks auf `macos-latest` (Apple Silicon) und `macos-15-intel`; der erforderliche Job `test` bestand ebenfalls. Main-Run 84 (`43771264550`) auf Commit `9c5e4b40adaaccfb6065e177cdad01ab7fd3d816` bestätigte beide macOS-Lanes und `test` erneut. Ein echter lokaler MacBook-Runner und dessen Codex-Ausführung sind weiterhin nicht nachgewiesen. |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | `.github/workflows/ci.yml`; erfolgreicher Actions-Job `test`; Branch-API-Readback | Pflicht | Der jüngste Dokumentations-PR #28, Head `596260a56dbb28c9f917da751debcc9a6eb0e520`, bestand `macos-latest`, `macos-15-intel` und `test` in Runs `43778439577` und `43778467602`; gemergt als `4fe86ec1463152d21f6fda2744166da9470a2e65`. PR #27 bestand dieselben Jobs in `43777050095` und `43777063773`, Merge `a80bab8cb7f15bc1012efde888f106267c47ea03`. Ein Main-Push-Run nach den Merges wurde nicht gelesen. `allow_auto_merge=true`; automatische Merges nach bestandenen Pflichtchecks sind autorisiert. Der letzte Branch-Regel-Readback verlangt keinen PR; direkte Commits auf `main` bleiben möglich. Branch-API-Readback zuletzt HTTP 403; PR-Pflicht nicht bestätigt. Frühere Nachweise: CP-021 bis CP-024 und CP-029 bis CP-036 |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | keine Runtime-Dependencies, harte Cap-/Retry-/Polling-Limits | Pflicht | lokal bestanden |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates, projektbezogene Erfassung/Anzeige und Projektwechsel-Regressionen bestanden; echte GitHub-Review-/Actions-Nachweise und produktive Control-API-Verbindung sind wegen fehlender Laufzeitkonfiguration noch nicht live abgenommen |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Kostenfreies serverloses Control Plane, unabhängig vom statischen PWA-Host | `HOSTING_OPTIONS.md`; Integrationstests für den ausdrücklich ausgewählten Anbieter, OAuth/Sitzungen, Speicherisolation, Quoten-Fail-Closed und HTTPS-Live-Smoke; Kosten-/Kontingent-Readback | Pflicht | teilweise, produktiv No-Go: privates GitHub-Control-Repository und leere Lease-Datei sind eingerichtet. GitHub Pages hostet die statische PWA; Cloudflare bleibt pausiert. Netlify Free ist bevorzugter, aber nicht freigegebener Kandidat; 300 Credits/Monat und Hard Limit sind dokumentiert, doch die öffentliche API-Referenz weist keinen vollständigen teamweiten Credit-Readback aus. Daher sind automatische 75-%-Pause und Free-Konto nicht verifiziert und Cloud-Jobs bleiben gesperrt. Der aktuelle Netlify-Vertrag untersagt KI-Training auf Customer Content ohne Opt-in. Vercel Hobby ist wegen der Hobby-Content-Trainingsklausel und der persönlichen/nicht-kommerziellen Beschränkung für PromptHub-Daten ausgeschlossen, solange kein passender Opt-out belegt ist. Netlify-Function-/Storage-Adapter, OAuth-/Sitzungsadapter, Preview-Isolation, Quoten-Gate und Live-Smoke fehlen. |
| A17 | PWA-Installationssymbol und iPhone-Installation | `test/api.test.mjs`, `test/cloudflare-pages.test.mjs`, `test/pwa-updates.test.mjs`, `test/pwa-availability.test.mjs`: Manifest, Apple-Touch-Icon, PNG-Antwort, Offline-Fallback, Cache-Isolation, freigegebener Update-Flow und ehrlicher API-Ausfall | Pflicht | teilweise: Letzter nachgewiesener Pages-Run 22 (`43771264030`) bestand auf Commit `9c5e4b40adaaccfb6065e177cdad01ab7fd3d816`; für spätere Dokumentations-Merges gibt es keinen Pages-Run-Readback. HTTPS-Smoke vom 2026-11-16 bestätigte PWA, Manifest, PNG-Icon, `sw.js`, `app.js`, `styles.css` und `service-worker-client.mjs` jeweils mit HTTP 200; Manifestfelder `display=standalone`, `start_url=./`, `scope=./` und ein Icon wurden ausgelesen. Der Browser-Viewport-Smoke 390×844 aus der früheren Prüfung zeigte die Erklärung zur fehlenden API; ein erneuter Screenshot scheiterte zweimal am Desktop-Capture-Timeout und wird nicht als aktuell bestätigt gewertet. Echte iPhone-Installation, Offline-Verhalten und Update nach Live-Deployment bleiben offen |
| A18 | Multi-Projekt-Analyse | `test/projects.test.mjs`: Regeln, README, Skripte, Issues, CI, nur lesende API und Snapshot-Version | Pflicht | lokal bestanden |
| A19 | Entfernen/Wiederverbinden/Datenlöschung | `test/projects.test.mjs`, `test/api-projects.test.mjs`: Bestätigung, Pause, laufende/stale Sperre, Wiederverbinden, getrennte Datenlöschung; kein Repo-Delete | Pflicht | lokal bestanden |
| A20 | Prompt-Designer | `test/prompt-designer.test.mjs`, `test/api-projects.test.mjs`, `test/pwa-availability.test.mjs`: Analyse, Einzelfrage, vier Optionen, Skip/Ende, Anforderungen/Annahmen, Version, QA, ausdrückliche Freigabe, begrenzte Textanhänge und Spracheingabe per Betriebssystem-Diktat ohne Browser-Mikrofonzugriff | Pflicht | lokal bestanden; direkte Web-Speech-Erkennung wird nicht verwendet, weil die PWA das Mikrofon absichtlich nicht freigibt; iPhone-Diktat selbst bleibt auf echtem Gerät zu verifizieren |
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

Status zum Abgleich am 2026-11-16: `conditional_local_pass`; die Erstabnahme ist
nicht bestanden. Lokale Pflichtprüfungen ergaben `npm test` 108/108, `npm run
check` erfolgreich für 97 Dateien und `git diff --check` ohne Befund. Ein
HTTP-Smoke des lokalen Servers erhielt für PWA-Startseite, Manifest, Icon,
Service Worker, `/api/me` und `/healthz` jeweils HTTP 200. `npm run demo`
beendete den geskripteten Auftrag `job_356a3002-4b0e-4419-8a04-f113a932da4a`
mit `succeeded` und sieben Ereignissen; dies ist kein Nachweis realer Codex-
Ausführung. Der geprüfte Produktcode-Stand war
`a80bab8cb7f15bc1012efde888f106267c47ea03` aus PR #27. Der anschließende
Dokumentations-PR #28, Head `596260a56dbb28c9f917da751debcc9a6eb0e520`, bestand
in Actions-Runs `43778439577` und `43778467602` jeweils `macos-latest`,
`macos-15-intel` und `test` und wurde als
`4fe86ec1463152d21f6fda2744166da9470a2e65` gemergt. PR #27 bestand dieselben
Jobs in `43777050095` und `43777063773`. Ein Main-Push-Workflow-Readback nach
den Merges liegt nicht vor. Der
letzte separat bestätigte Pages-Lauf bleibt Run 22 auf dem älteren Commit
`9c5e4b40adaaccfb6065e177cdad01ab7fd3d816`; ein aktueller Pages-Readback war
aus der Laufzeit nicht erreichbar.
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
