# PromptHub Studio – verbindliche Abnahmematrix

Eine KI-Selbsteinschätzung ist kein Nachweis. Für jedes Kriterium werden
ausführbare Tests, Logs oder GitHub-API-Antworten mit Zeit und Commit referenziert.

| ID | Kriterium | Nachweis / Test | Gate | Status |
|---|---|---|---|---|
| A01 | PWA, API und Control-Plane-Datenfluss | `test/api.test.mjs`; lokaler HTTP-Smoke für UI, Assets, `/healthz` und `/api/me` | Pflicht | teilweise: Der lokale HTTP-Smoke lieferte am 2026-11-16 für /, Manifest, PNG-Icon, sw.js, /api/me und /healthz HTTP 200. Nach PR #37 öffnet die veröffentlichte Pages-Root-Adresse live die PWA unter /src/pwa/ (Pages-Deployment 43799473633, Commit cf33e2bf5bb490df66f06ae38a8551366747a222). Die PWA zeigt Control API nicht verfügbar; statische GitHub Pages liefern keine API. Der PWA/API-Datenfluss bleibt offen. Listener-Inspektion des Betriebssystems wurde mit Zugriff verweigert; src/config.mjs setzt weiterhin 127.0.0.1 als Host-Default. Der Pages-Build/Deploy-Run 43802723564 auf Main-Commit cd54c9226067950f775f28c09ef142b1423310e5 ist erfolgreich. Die veröffentlichte Root-Weiterleitung wurde zuvor live im Browser von `/` zur PWA unter `/src/pwa/` geprüft (PR #37); die PWA meldet weiterhin korrekt, dass die Control API nicht verfügbar ist. Der PWA/API-Datenfluss bleibt offen. lokaler HTTP-Smoke im aktuellen Arbeitsstand: `/`, Manifest, dessen `./app-icon-source.png`, `sw.js`, `/api/me`, `/api/jobs` und `/healthz` antworteten mit HTTP 200. `/api/me` meldete `provider=local`; `/healthz` meldete `control_plane=memory`, `runner_status=not_observed` und `runner_inbound_port=false`. Der Prozess lauschte ausschließlich auf `127.0.0.1:8787`; nach dem Stop war der Port geschlossen. Die Pages-Root-Weiterleitung zur PWA wurde zuvor live im Browser geprüft (PR #37); Main Pages-Run 43880598411 für Commit `5c577d80bf67f7475dd5b050a0aabba22e458107` ist erfolgreich. Das belegt lokale Control-API und statisches Deployment, aber keine GitHub-persistente API oder Cloud-API. Listener- und Offline-Smoke für das iPhone bleiben offen. |
| A02 | Sichere Authentifizierung | `test/auth.test.mjs`, `test/config.test.mjs`, `test/netlify-blob-stores.test.mjs`; OAuth-Allowlist, verschlüsselte serverseitige Sitzungen, Session-Ablauf und atomarer einmaliger OAuth-State | Pflicht | lokal bestanden; unabhängige Sicherheitsprüfung fand keine Auth-/Session-Sicherheitsbefunde. Live-OAuth-Callback und Provider-Secrets sind nicht eingerichtet. |
| A03 | Keine Geheimnisse im Browser/GitHub/Log | `scripts/check.mjs`, OAuth-/Payload-Assertions | Pflicht | lokal bestanden |
| A04 | Zuverlässige Auftragsverarbeitung | `test/runner.test.mjs`, `npm run demo`, echter Executor-Smoke in isoliertem Git-Fixture | Pflicht | lokal bestanden: Am 2026-11-16 führte `PromptHubRunner` mit `ProcessExecutor`, echtem Codex CLI, `MemoryControlPlane` und `GitWorktreeManager` einen Fixture-Auftrag aus. Die Datei wurde von 41 auf 42 geändert, der echte Node-Pflichtcheck bestand, der Job erreichte `succeeded`, der Executor beendete sich mit Exitcode 0, vier Checkpoints wurden aufgezeichnet und danach blieb kein aktiver Lease zurück. Das belegt keine GitHub-Control-Plane-Persistenz oder MacBook-Ausführung |
| A05 | Global maximal zwei aktive Jobs | `test/lease-store.test.mjs`, Control-Plane-Cap-Test | Pflicht | lokal bestanden |
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false`, echte macOS-CI und lokaler Mac-Runner | Pflicht | Windows-Smoke bestätigte `runner_inbound_port=false`; Port 18787 war nach dem Stopp geschlossen. PR #21 verifizierte auf Head `a873695153a6bb24e61b149d5ee0fc64108e33a4` mit Actions-Run 80 (`43770627889`) erfolgreiche vollständige Tests und Static-Checks auf `macos-latest` (Apple Silicon) und `macos-15-intel`; Main-Run 84 (`43771264550`) bestätigte beide Lanes und `test` erneut. Am 2026-11-16 bestand zusätzlich ein echter Codex-CLI-/PromptHubRunner-Smoke auf Windows in einem temporären Fixture. Ein echter lokaler MacBook-Runner, dessen Start nach Mac-Neustart und seine GitHub-gebundene Ausführung sind weiterhin nicht nachgewiesen. |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | `.github/workflows/ci.yml`; erfolgreicher Actions-Job `test`; Branch-API-Readback | Pflicht | PR #37, Head bef13024b0f5cec11103198102ec108c8f3208ef, bestand den erforderlichen Check test im PR-Run 43799371583 und wurde automatisch als cf33e2bf5bb490df66f06ae38a8551366747a222 gemergt. Main-CI-Run 43799474276 und Pages-Deployment 43799473633 endeten erfolgreich auf diesem Commit. Branch-API-Readback vom 2026-11-16 bestätigt test, strict=true, enforce_admins=true, Force-Push und Löschen deaktiviert; PR-Pflicht und Review sind nicht verlangt, direkte Pushes bleiben möglich. Auto-Merge nach bestandenen Pflichtchecks ist freigegeben. PR #39, Head `bb97184871fbb2300110c60e6fe0d89dcaaf3882`, bestand `test` und beide macOS-Lanes in Runs 43802529338 und 43802533487 und wurde nach Freigabe automatisch als `cd54c9226067950f775f28c09ef142b1423310e5` gemergt. Main-CI-Run 43802724233 und Pages-Deployment 43802723564 endeten erfolgreich auf diesem Commit. Der Branch-API-Readback vom 2026-11-16 bestätigt `test`, `strict=true`, `enforce_admins=true`, Force-Push und Löschen deaktiviert; PR-Pflicht und Review sind nicht verlangt, direkte Pushes bleiben möglich. Auto-Merge nach bestandenen Pflichtchecks ist freigegeben. Neuester Readback: PR #43 (`43890738802`) und Main-CI `43891014436` bestanden `test`, `macos-latest` und `macos-15-intel`; Pages-Run `43891011644` bestand Build, Deploy und Statusbericht auf Main-Commit `026838b056ad474abfd272596706dfd34622697c`. |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | 0-€-Zusatzbudget, begrenzte Job-/Retry-/Polling-Werte; exakt gepinnte serverseitige Hosting-Abhängigkeit; fail-closed Netlify-Credit-Gate | Pflicht | lokale Pflichtprüfungen bestanden. Das tatsächliche Netlify-Konto, der Free-Tarif, Teamverbrauch und Auto-Recharge-Status sind live nicht verifiziert; kein kostenpflichtiger Dienst wurde aktiviert. |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates und Projektwechsel-Regressionen bestanden; allgemeine PR-/CI-Runs sind vorhanden, ersetzen aber keinen echten A14-Übernahmevorgang mit passender unabhängiger Review, authentifizierter Freigabe und produktiver Control-API-Verbindung. Dieser Live-Nachweis fehlt weiterhin |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Kostenfreies serverloses Control Plane, unabhängig vom statischen PWA-Host | `HOSTING_OPTIONS.md`; Integrationstests für Functions, OAuth/Sitzungen, Speicherisolation und Quoten-Fail-Closed; HTTPS-Live-Smoke und Kosten-/Kontingent-Readback | Pflicht | teilweise, produktiv No-Go: GitHub Pages liefert die PWA; Netlify-Function-/Blob-Adapter, OAuth-/Sitzungsspeicher, Preview-Isolation und fail-closed Job-Gate sind implementiert und lokal getestet. Die unabhängige Prüfung fand keine Sicherheitsbefunde; operativ fehlt ein verifizierter teamweiter Credit-Readback. Das Gate bleibt `unknown`/geschlossen. Netlify-Konto, Free-Tarif und Live-Deployment sind nicht nachgewiesen. teilweise, produktiv No-Go: GitHub Pages hostet die statische PWA. Netlify Function, Blob-Session-/OAuth-State-Adapter, Preview-Isolation und fail-closed Job-Gate wurden mit PR #39 gemergt; PR-/Main-CI und Pages-Build sind erfolgreich. Es gibt kein verifiziertes Netlify-Konto/Free-Tarif, keinen Live-OAuth-Callback und keinen HTTPS-Live-Smoke. Ein maschinenlesbarer teamweiter Credit-Readback fehlt; das Gate bleibt `unknown`/geschlossen. Cloudflare ist pausiert. Die aktuelle öffentliche Netlify-OpenAPI-Referenz enthält keinen dokumentierten Team-Credit-/Balance-Endpunkt; der offizielle Credit-Readback erfolgt laut Netlify-Dokumentation im authentifizierten Team-Dashboard. Das Gate bleibt ohne autoritative automatische Quelle `unknown`/geschlossen. |
| A17 | PWA-Installationssymbol und iPhone-Installation | `test/api.test.mjs`, `test/cloudflare-pages.test.mjs`, `test/pwa-updates.test.mjs`, `test/pwa-availability.test.mjs`: Manifest, Apple-Touch-Icon, PNG-Antwort, Offline-Fallback, Cache-Isolation, freigegebener Update-Flow und ehrlicher API-Ausfall | Pflicht | teilweise: PR #37 fügte die Root-Weiterleitung zur PWA hinzu; Pages-Deployment 43799473633 auf Commit cf33e2bf5bb490df66f06ae38a8551366747a222 war erfolgreich. Live-Browserprüfung öffnete von der Projektwurzel die PWA unter /src/pwa/; die Seite meldete die fehlende Control API korrekt. Der frühere HTTPS-Smoke bestätigte Manifest, PNG-Icon, sw.js und weitere Assets. Echte iPhone-Installation, Offline-Verhalten und Update nach Live-Deployment bleiben offen. teilweise: Pages-Deployment 43802723564 auf Main-Commit `cd54c9226067950f775f28c09ef142b1423310e5` war erfolgreich. Die Root-Weiterleitung zur PWA wurde mit PR #37 live im Browser geprüft. HTTPS-Assets wurden zuvor per Smoke geprüft. Eine erneute HTTP-Prüfung nach dem aktuellen Deployment, echte iPhone-Installation, Offline-Verhalten und Update nach Live-Deployment bleiben offen. |
| A18 | Multi-Projekt-Analyse | `test/projects.test.mjs`: Regeln, README, Skripte, Issues, CI, nur lesende API und Snapshot-Version | Pflicht | lokal bestanden |
| A19 | Entfernen/Wiederverbinden/Datenlöschung | `test/projects.test.mjs`, `test/api-projects.test.mjs`: Bestätigung, Pause, laufende/stale Sperre, Wiederverbinden, getrennte Datenlöschung; kein Repo-Delete | Pflicht | lokal bestanden |
| A20 | Prompt-Designer | `test/prompt-designer.test.mjs`, `test/api-projects.test.mjs`, `test/pwa-availability.test.mjs`: Analyse, Einzelfrage, vier Optionen, Skip/Ende, Anforderungen/Annahmen, Version, QA, ausdrückliche Freigabe, begrenzte Textanhänge und Spracheingabe per Betriebssystem-Diktat ohne Browser-Mikrofonzugriff | Pflicht | lokal bestanden; direkte Web-Speech-Erkennung wird nicht verwendet, weil die PWA das Mikrofon absichtlich nicht freigibt; iPhone-Diktat selbst bleibt auf echtem Gerät zu verifizieren |
| A21 | KI-Zugang bei 0 € | `test/prompt-designer.test.mjs`: ungeprüfter Provider wird nie aufgerufen; deterministischer Fallback wird ausgewiesen | Pflicht | lokal bestanden; kein LLM-Zugang verfügbar |
| A22 | Quellenbibliothek | `test/research-metrics.test.mjs`: Quelle, Autor, Abrufdatum, Lizenz, Version, Suche, Dubletten-, Aktualitäts-, Konflikt- und Sicherheitsmarker | Pflicht | lokal bestanden |
| A23 | Wissensintegration und Ergebnislernen | `test/projects.test.mjs`, `test/project-store.test.mjs`, `test/prompt-designer.test.mjs`, `test/runner.test.mjs`: echte Control-Plane-Abschlussereignisse, bestandene Pflichtchecks, projektisolierte Speicherung/Wiederverwendung, Idempotenz, CAS-Konflikt, Digest-/Manipulationsprüfung; gepaarte Commit-/CI-Experimente bleiben separat offen | Pflicht | lokal teilweise bestanden; kontrollierte projektübergreifende Experimente offen |
| A24 | Token-/Ressourcen-Dashboard | `test/executor.test.mjs`, `test/research-metrics.test.mjs`, `test/runner.test.mjs`, `test/projects.test.mjs`, `test/api-projects.test.mjs`: dokumentiertes Codex-JSONL-Usage-Ereignis, allowlistete Tokenquelle, projektbezogene Speicherung, gemessene/teilweise/unbekannte Tokens, Provider-Aufrufe, Executor-Starts, Laufzeit, Retry und Pflichtchecks | Pflicht | lokal implementiert und deterministisch getestet: genau ein gültiges `turn.completed.usage` wird akzeptiert; Duplikate, unbekannte Felder, ungültige Werte, feste JSONL-Limits und Summenüberlauf ergeben unbekannte Werte. Ressourcen-Zähler benötigen nichtnegative sichere Ganzzahlen. Cache-/Reasoning-Teilsummen erscheinen nur bei vollständigen Quelldaten. Ein Live-Codex-Lauf mit beobachteter Token-Ausgabe steht noch aus; Modellaufrufzahlen bleiben unbekannt |
| A25 | Projektisolierung und Prompt-Freigabe | `test/prompt-designer.test.mjs`, `test/api-projects.test.mjs`: untrusted Projektkontext, versionierte Promptfreigabe und gesperrte Direktanlage | Pflicht | lokal bestanden |
| A26 | Token- und Ressourceneffizienz | `test/prompt-designer.test.mjs`, `test/projects.test.mjs`, `test/research-metrics.test.mjs`: taskbezogene Auswahl, versionierte Snapshots, begrenzte Cache-Deduplizierung, unveränderte Pflichtprüfungen | Pflicht | lokal bestanden |
| A27 | Fehlerprävention und Lernen | `test/error-learning.test.mjs`, `test/projects.test.mjs`, `test/prompt-designer.test.mjs`, `test/api-projects.test.mjs`: Runner-/CI-Symptome, datensparsame Fehlermusterklassifikation, Nutzerberichte, getrennte Hypothesen, projektisolierte Evidenz, menschlich bestätigte Ursachen mit später passendem Check und expliziter Prüfung derselben Korrektur, begrenzte Aufbewahrung, Digest-/Belegprüfung | Pflicht | lokal bestanden; gepaarte externe Commit-/CI-Experimente offen |
| A28 | Qualitäts-/Fehlerdashboard | `test/research-metrics.test.mjs`, `test/api-projects.test.mjs`, `test/error-learning.test.mjs`: echte fehlgeschlagene Jobs und Stichprobenquote, Fehlerbeobachtungstrend mit Historiengrenze, wiederkehrende Fehler, aktuell belegte Regressionen, offene Hypothesen, CI-Signalzahl; CI nicht als Ursache, fehlende Daten nicht als Schätzung | Pflicht | lokal bestanden; externe GitHub-/CI-Live-Daten offen |
| A29 | Regressionstest-Prävention aus Fehlerhistorie | `test/regression-test-request.test.mjs`, `test/api.test.mjs`: nur wiederholte Runnerfehler oder menschlich bestätigte Ursachen mit aktuellen Belegen erstellen einen begrenzten, projektbezogenen Testauftrag; Reproduktion und Vorher/Nachher-Nachweis erforderlich; Auftrag bleibt Entwurf bis regulärer Nutzerfreigabe | Pflicht | lokal bestanden; externe Ausführung in angeschlossenem Projekt offen |
| A30 | Serverless Hosting, Preview-Isolation und Credit-Gate | `test/netlify-function.test.mjs`, `test/netlify-quota-gate.test.mjs`: nicht-produktive Deploy-Kontexte erhalten keine Produktions-Sessions; Originbindung; unbekannte/veraltete/≥75-%-Free-Usage sperrt Jobanlage, Jobfreigabe und Prompt-Übergabe; CI-Build führt Tests und Check aus | Pflicht | lokal bestanden; unabhängige Sicherheitsprüfung abgeschlossen. Konto, Free-Tarif, OAuth-Callback, HTTPS-Live-Smoke und maschinenlesbarer Team-Credit-Readback sind nicht nachgewiesen. Der Job-Gate-Block bleibt aktiv. lokale Netlify-Function-/Quota-Regressionen bestanden; PR #39 und Main-CI bestanden `test` und beide macOS-Lanes; unabhängige Sicherheitsprüfung abgeschlossen ohne Auth-/Session-Sicherheitsbefunde. Netlify-Konto, Free-Tarif, OAuth-Callback, HTTPS-Live-Smoke und maschinenlesbarer Team-Credit-Readback sind nicht nachgewiesen. Das Job-Gate bleibt geschlossen. Die öffentliche Netlify-OpenAPI-Referenz dokumentiert keinen Team-Credit-/Balance-Endpunkt; die Credit-Ansicht liegt im authentifizierten Team-Dashboard. Bis ein frischer autoritativer Readback verfügbar ist, bleibt das Job-Gate geschlossen. |

## Aktuelle Revalidierung – 2026-11-16

- GitHub API bestätigt öffentliches Repository `bndkxbqf2g-stack/prompthub-studio`
  und `main` auf `4be6b8bb0ff73a14a3670423d6de7c3de3fc6ce1`. Actions-Run
  `43882260206` bestand `test`, `macos-latest` und `macos-15-intel`; Pages-Run
  `43882257544` stellte denselben Commit erfolgreich bereit.
- Live-Browserprüfung der Pages-Root-Adresse leitete zur PWA unter `/src/pwa/`
  weiter. Die Oberfläche wurde geladen und zeigte ausdrücklich „Control API
  nicht verfügbar“. Das belegt statische PWA und Routing, nicht Authentifizierung
  oder Auftragssteuerung. Die `github.com/...`-Adresse zeigt die
  Repository-Ansicht mit dieser README; für die App ist die Pages-Adresse zu
  verwenden.
- Die aktuelle Netlify-Browserregisterkarte zeigt die Anmeldeseite. Damit sind
  weder eine angemeldete Sitzung noch Netlify-Konto, Free-Tarif, Quotenstand,
  OAuth-Callback oder Deployment nachgewiesen. Es wurde nichts in Netlify
  verändert.
- Codex-Cloud-Inventar liefert `asenvcfg_base` als `ready/runnable`, aber ohne
  Repository-Zuordnung. Eine autonome PromptHub-Cloud-Ausführung ist damit nicht
  verfügbar.
- `codex login status` meldet ChatGPT-Authentifizierung. Ein schreibgeschützter
  ephemerer `codex exec --json`-Versuch endete vor dem ersten JSONL-Event mit
  Exitcode 1: die CLI konnte ihr temporäres Alias und den lokalen Memories-State
  unter dem schreibgeschützten `CODEX_HOME` nicht öffnen/anlegen. Es wurden
  keine Tokenwerte gemessen.
- Lokale Prüfungen auf `4be6b8b`: `npm test` 138/138 bestanden;
  `npm run check` bestanden (108 Dateien und Prompt-Library-Synchronisierung).
  Live-Control-API, echter MacBook-Runner, iPhone-Installation sowie Offline-
  und Updateverhalten bleiben offen. Kein neuer kostenpflichtiger Dienst wurde
  aktiviert.
- Nach PR #42 ist `main` auf `9e34b719ec5cf7e6de128efc4e83b7a01e480c02`.
  Der PR-Lauf `43888056302`, Main-CI `43889567863` und Pages-Deploy
  `43889567107` bestanden; der Browser-Smoke nach diesem Deploy öffnete die PWA
  über die Root-Adresse und meldete weiterhin korrekt die fehlende Control API.

- Post-Merge-Readback für PR #43: Main-Commit
  `026838b056ad474abfd272596706dfd34622697c`; PR-Run `43890738802` und
  Main-CI `43891014436` bestanden `test`, `macos-latest` und
  `macos-15-intel`; Pages-Run `43891011644` bestand Build, Deploy und
  Statusbericht. PR #43 änderte Dokumentation; die PWA wurde dadurch nicht
  erneut per Browser- oder iPhone-Test abgenommen.
- Die öffentliche Netlify-OpenAPI-Referenz 2.63.1 enthält keinen dokumentierten
  Team-Credit-/Balance-Endpunkt (Suche nach `credit`: kein Treffer). Netlify
  weist Team-Credit-Balance und Credit-Aufschlüsselung im authentifizierten
  Dashboard aus. Ein automatisierter autoritativer Teamverbrauch ist damit
  nicht nachgewiesen; das Netlify-Quoten-Gate bleibt fail-closed.
  Quellen: [Netlify API](https://open-api.netlify.com/),
  [Netlify Usage-Monitoring](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/monitor-usage-for-credit-based-plans/).

## Abnahmeregel

Die technische Erstabnahme ist `bestanden`, wenn alle Pflichtkriterien einen
positiven, reproduzierbaren Nachweis besitzen und kein offener kritischer
Sicherheitsfehler existiert. Nicht implementierte externe Betriebsnachweise
(GitHub-Workflow-Run, OAuth-App, HTTPS-Hosting, echter Mac/Cloud-Runner) werden als `blocked_external_setup`
ausgewiesen und nicht als bestanden markiert.

## Aktueller Status

Status zum Abgleich am 2026-11-16: `conditional_local_pass`; die technische
Erstabnahme ist nicht bestanden. Im lokalen Arbeitsstand, der den Netlify-Code
aus PR #39 enthält, bestanden `npm test` mit 138/138 Tests,
`npm run check` für 108 Dateien samt Prompt-Library-Synchronisierung und
`git diff --check`. Ein echter Codex-CLI-/PromptHubRunner-Smoke in einem
temporären Windows-Git-Fixture bestand mit Dateiänderung, bestandenem
Node-Pflichtcheck, Jobstatus `succeeded`, vier Checkpoints und null aktiven
Leases; er verwendete eine `MemoryControlPlane` und belegt keine GitHub-
Persistenz oder MacBook-Ausführung.

PR #39 wurde nach erfolgreichen `test`- und macOS-Lanes in den Actions-Runs
43802529338 und 43802533487 automatisch gemergt. Main-CI-Run 43802724233
bestätigte `test`, `macos-latest` und `macos-15-intel`; Pages-Deployment
43802723564 endete erfolgreich auf Main-Commit
`cd54c9226067950f775f28c09ef142b1423310e5`. Die Root-Weiterleitung zur PWA
wurde bereits nach PR #37 live geprüft. Der letzte Pages-Run belegt den
Build/Deploy, aber keinen erneuten HTTP-Smoke oder iPhone-Test.

GitHub-Codex-Cloud-Inventar vom 2026-11-16 enthält die Standardumgebung
`asenvcfg_base` als `ready/runnable`, jedoch ohne verknüpfte Repositories.
Damit ist keine ausführbare Cloud-Umgebung für PromptHub nachgewiesen. Lokal
waren `gh`, Wrangler und Netlify-CLI sowie Netlify-/OAuth-Runtime-Secrets
nicht vorhanden. Netlify-Code ist vorbereitet und gemergt, aber kein Netlify-
Konto, Free-Tarif, Deployment oder teamweiter Credit-Readback ist verifiziert.
Das Quoten-Gate hält Cloud-Jobs bei unbekannter Nutzung gesperrt.

Das Quell-Repository ist auf ausdrückliche Nutzeranweisung öffentlich. Kein
kostenpflichtiger Dienst wurde aktiviert; Cloudflare bleibt pausiert und
GitHub Pages hostet nur die statische PWA. Das Branch-API-Readback bestätigt
den Pflichtcheck `test`, `strict=true` und Admin-Enforcement, verlangt aber
weder PR noch Review; direkte Pushes bleiben möglich. Auto-Merge ist vom Nutzer
freigegeben.

OAuth-/Sitzungsbetrieb, GitHub-gebundene Runner-Ausführung, echter MacBook-/
Cloud-Runner, iPhone-Installation, Offline-/Update-Verhalten, Live-Credit-
Readback und externe Lernexperimente sind nicht nachgewiesen. Die vollständige
technische Erstabnahme ist daher nicht bestanden.
