# PromptHub Studio – verbindliche Abnahmematrix

Eine KI-Selbsteinschätzung ist kein Nachweis. Für jedes Kriterium werden
ausführbare Tests, Logs oder GitHub-API-Antworten mit Zeit und Commit referenziert.

| ID | Kriterium | Nachweis / Test | Gate | Status |
|---|---|---|---|---|
| A01 | PWA, API und Control-Plane-Datenfluss | `test/api.test.mjs`; lokaler HTTP-Smoke für UI, Assets, `/healthz` und `/api/me` | Pflicht | lokal bestanden: `npm start` lieferte am 2026-11-16 für `/`, Manifest, PNG-Icon, `sw.js`, `/api/me` und `/healthz` HTTP 200. Listener-Inspektion des Betriebssystems wurde mit Zugriff verweigert; `src/config.mjs` setzt weiterhin `127.0.0.1` als Host-Default. |
| A02 | Sichere Authentifizierung | `test/auth.test.mjs`, `test/config.test.mjs` | Pflicht | lokal bestanden |
| A03 | Keine Geheimnisse im Browser/GitHub/Log | `scripts/check.mjs`, OAuth-/Payload-Assertions | Pflicht | lokal bestanden |
| A04 | Zuverlässige Auftragsverarbeitung | `test/runner.test.mjs`, `npm run demo`, echter Executor-Smoke in isoliertem Git-Fixture | Pflicht | lokal bestanden: Am 2026-11-16 führte `PromptHubRunner` mit `ProcessExecutor`, echtem Codex CLI, `MemoryControlPlane` und `GitWorktreeManager` einen Fixture-Auftrag aus. Die Datei wurde von 41 auf 42 geändert, der echte Node-Pflichtcheck bestand, der Job erreichte `succeeded`, der Executor beendete sich mit Exitcode 0, vier Checkpoints wurden aufgezeichnet und danach blieb kein aktiver Lease zurück. Das belegt keine GitHub-Control-Plane-Persistenz oder MacBook-Ausführung |
| A05 | Global maximal zwei aktive Jobs | `test/lease-store.test.mjs`, Control-Plane-Cap-Test | Pflicht | lokal bestanden |
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false`, echte macOS-CI und lokaler Mac-Runner | Pflicht | Windows-Smoke bestätigte `runner_inbound_port=false`; Port 18787 war nach dem Stopp geschlossen. PR #21 verifizierte auf Head `a873695153a6bb24e61b149d5ee0fc64108e33a4` mit Actions-Run 80 (`43770627889`) erfolgreiche vollständige Tests und Static-Checks auf `macos-latest` (Apple Silicon) und `macos-15-intel`; Main-Run 84 (`43771264550`) bestätigte beide Lanes und `test` erneut. Am 2026-11-16 bestand zusätzlich ein echter Codex-CLI-/PromptHubRunner-Smoke auf Windows in einem temporären Fixture. Ein echter lokaler MacBook-Runner, dessen Start nach Mac-Neustart und seine GitHub-gebundene Ausführung sind weiterhin nicht nachgewiesen. |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | `.github/workflows/ci.yml`; erfolgreicher Actions-Job `test`; Branch-API-Readback | Pflicht | PR #34, Head `8ba96a8fcbac80f722208914535dfff39460cc1c`, bestand `test`, `macos-latest` und `macos-15-intel` in Runs `43784925947` und `43784944320` und wurde automatisch als `bb06cd93872860cfd88f89ec555bac0d2bdf1e83` gemergt. Branch-API-Readback vom 2026-11-16: required check `test` von GitHub Actions (`app_id=15368`), `strict=true`, `enforce_admins=true`, Force-Push und Löschen deaktiviert. Die Regel verlangt keinen PR und keine Review; PR-freie Schreibwege sind dadurch nicht ausgeschlossen. Auto-Merge ist vom Nutzer freigegeben. Ein aktueller Main-/Pages-Post-Merge-Run wurde in dieser Prüfung nicht unabhängig ausgelesen. Frühere Nachweise: CP-021 bis CP-024 und CP-029 bis CP-036 |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | keine Runtime-Dependencies, harte Cap-/Retry-/Polling-Limits | Pflicht | lokal bestanden |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates und Projektwechsel-Regressionen bestanden; allgemeine PR-/CI-Runs sind vorhanden, ersetzen aber keinen echten A14-Übernahmevorgang mit passender unabhängiger Review, authentifizierter Freigabe und produktiver Control-API-Verbindung. Dieser Live-Nachweis fehlt weiterhin |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Kostenfreies serverloses Control Plane, unabhängig vom statischen PWA-Host | `HOSTING_OPTIONS.md`; Integrationstests für den ausdrücklich ausgewählten Anbieter, OAuth/Sitzungen, Speicherisolation, Quoten-Fail-Closed und HTTPS-Live-Smoke; Kosten-/Kontingent-Readback | Pflicht | teilweise, produktiv No-Go: privates GitHub-Control-Repository und leere Lease-Datei sind eingerichtet. GitHub Pages hostet die statische PWA; Cloudflare bleibt pausiert. Netlify Free ist bevorzugter, aber nicht freigegebener Kandidat; 300 Credits/Monat und Hard Limit sind dokumentiert, doch die öffentliche API-Referenz weist keinen vollständigen teamweiten Credit-Readback aus. Daher sind automatische 75-%-Pause und Free-Konto nicht verifiziert und Cloud-Jobs bleiben gesperrt. Der aktuelle Netlify-Vertrag untersagt KI-Training auf Customer Content ohne Opt-in. Vercel Hobby ist wegen der Hobby-Content-Trainingsklausel und der persönlichen/nicht-kommerziellen Beschränkung für PromptHub-Daten ausgeschlossen, solange kein passender Opt-out belegt ist. Netlify-Function-/Storage-Adapter, OAuth-/Sitzungsadapter, Preview-Isolation, Quoten-Gate und Live-Smoke fehlen. |
| A17 | PWA-Installationssymbol und iPhone-Installation | `test/api.test.mjs`, `test/cloudflare-pages.test.mjs`, `test/pwa-updates.test.mjs`, `test/pwa-availability.test.mjs`: Manifest, Apple-Touch-Icon, PNG-Antwort, Offline-Fallback, Cache-Isolation, freigegebener Update-Flow und ehrlicher API-Ausfall | Pflicht | teilweise: GitHub-Pages-Run 33 (`43783986387`) endete erfolgreich auf Produktcode-Commit `792c96e3e8be2db849143b8420baea9c241f8eb2`; PR #33 änderte nur Dokumentation. Der frühere HTTPS-Smoke vom 2026-11-16 bestätigte PWA, Manifest, PNG-Icon, `sw.js`, `app.js`, `styles.css` und `service-worker-client.mjs` jeweils mit HTTP 200; Manifestfelder `display=standalone`, `start_url=./`, `scope=./` und ein Icon wurden ausgelesen. Ein HTTP-Smoke nach Run 33 war nicht möglich; der Browser-Viewport-Smoke 390×844 aus der früheren Prüfung zeigte die Erklärung zur fehlenden API. Echte iPhone-Installation, Offline-Verhalten und Update nach Live-Deployment bleiben offen |
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
nicht bestanden. Lokale Pflichtprüfungen für diese Dokumentationsänderung
ergaben `npm test` 109/109, `npm run check` erfolgreich für 97 Dateien und
`git diff --check` ohne Befund. Ein echter Codex-CLI-/PromptHubRunner-Smoke in
einem temporären Windows-Git-Fixture bestand: Executor-Exitcode 0,
Dateiänderung verifiziert,
Node-Pflichtcheck bestanden, Job `succeeded`, vier Checkpoints und null aktive
Leases. Dabei nutzte der Runner eine `MemoryControlPlane`; GitHub-Persistenz,
MacBook-Betrieb und dauerhafte Codex-Sitzung wurden nicht geprüft.

PR #34, Head `8ba96a8fcbac80f722208914535dfff39460cc1c`, bestand `test`,
`macos-latest` und `macos-15-intel` in Runs `43784925947` und `43784944320` und
wurde automatisch als `bb06cd93872860cfd88f89ec555bac0d2bdf1e83` gemergt. Ein
unabhängiger Main-/Pages-Post-Merge-Run und direkter HTTPS-Smoke nach diesem
Merge wurden in dieser Prüfung nicht ausgelesen. Der letzte dokumentierte
GitHub-Pages-Run 33 (`43783986387`) war erfolgreich auf Produktcode-Commit
`792c96e3e8be2db849143b8420baea9c241f8eb2`; er belegt weder iPhone-Installation
noch Offline-/Update-Verhalten.

Das Quell-Repository bleibt auf ausdrückliche Nutzeranweisung öffentlich. Kein
kostenpflichtiger Plan wurde aktiviert. Cloudflare bleibt pausiert und die alte
Veröffentlichung ist nicht gelöscht. GitHub Pages hostet nur die statische PWA;
die Control API hat keinen freigegebenen, konfigurierten Host. Der
Branch-Readback vom 2026-11-16 bestätigt `test`/Actions-App 15368, `strict=true`
und Admin-Enforcement; die Regel verlangt keinen PR und keine Review. Auto-Merge
ist freigegeben und für PR #34 nach bestandenen Checks erfolgt.

OAuth-/Sitzungsbetrieb, GitHub-gebundene Runner-Ausführung, echter MacBook-/Cloud-
Runner, iPhone-Installation, accountweiter Billing-Readback und externe
Lernexperimente sind nicht nachgewiesen. Die vollständige technische Erstabnahme
ist daher nicht bestanden.
