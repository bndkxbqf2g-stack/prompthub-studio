# PromptHub Studio – verbindliche Abnahmematrix

Eine KI-Selbsteinschätzung ist kein Nachweis. Für jedes Kriterium werden
ausführbare Tests, Logs oder GitHub-API-Antworten mit Zeit und Commit referenziert.

| ID | Kriterium | Nachweis / Test | Gate | Status |
|---|---|---|---|---|
| A01 | PWA, API und Control-Plane-Datenfluss | test/api.test.mjs; lokaler HTTP-Smoke; Pages-Deployment und Live-Browser-Smoke | Pflicht | teilweise: Netlify-Production-Deploy `6afb604fa30e844824f72af5` für Main `1cd6204556de6d63b627c2f0cd2879c712b2e717` ist `ready`; die öffentliche HTTPS-Root lädt die PWA. Live-`/healthz` antwortet ehrlich `production_api_disabled`. OAuth, Control-Plane-Datenfluss und GitHub-persistente Jobs fehlen live. Deploy-Previews bleiben privat. |
| A02 | Sichere Authentifizierung | `test/auth.test.mjs`, `test/config.test.mjs`, `test/netlify-blob-stores.test.mjs`; OAuth-Allowlist, verschlüsselte serverseitige Sitzungen, Session-Ablauf und atomarer einmaliger OAuth-State | Pflicht | lokal bestanden; unabhängige Sicherheitsprüfung fand keine Auth-/Session-Sicherheitsbefunde. Live-OAuth-Callback und Provider-Secrets sind nicht eingerichtet. |
| A03 | Keine Geheimnisse im Browser/GitHub/Log | `scripts/check.mjs`, OAuth-/Payload-Assertions | Pflicht | lokal bestanden |
| A04 | Zuverlässige Auftragsverarbeitung | `test/runner.test.mjs`, `npm run demo`, echter Executor-Smoke in isoliertem Git-Fixture | Pflicht | lokal bestanden: Am 2026-11-16 führte `PromptHubRunner` mit `ProcessExecutor`, echtem Codex CLI, `MemoryControlPlane` und `GitWorktreeManager` einen Fixture-Auftrag aus. Die Datei wurde von 41 auf 42 geändert, der echte Node-Pflichtcheck bestand, der Job erreichte `succeeded`, der Executor beendete sich mit Exitcode 0, vier Checkpoints wurden aufgezeichnet und danach blieb kein aktiver Lease zurück. Das belegt keine GitHub-Control-Plane-Persistenz oder MacBook-Ausführung |
| A05 | Global maximal zwei aktive Jobs | `test/lease-store.test.mjs`, Control-Plane-Cap-Test, Parallel-Claim und korrupter/überfüllter Lease-Zustand | Pflicht | lokal bestanden im aktuellen, noch nicht integrierten Arbeitsbaum; der unveränderliche Höchstwert wird auch bei direkter Store-Konfiguration auf zwei begrenzt. Produktionsnachweis bleibt offen. |
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false`, echte macOS-CI und lokaler Mac-Runner | Pflicht | Windows-Smoke bestätigte `runner_inbound_port=false`; Port 18787 war nach dem Stopp geschlossen. PR #21 verifizierte auf Head `a873695153a6bb24e61b149d5ee0fc64108e33a4` mit Actions-Run 80 (`43770627889`) erfolgreiche vollständige Tests und Static-Checks auf `macos-latest` (Apple Silicon) und `macos-15-intel`; Main-Run 84 (`43771264550`) bestätigte beide Lanes und `test` erneut. Am 2026-11-16 bestand zusätzlich ein echter Codex-CLI-/PromptHubRunner-Smoke auf Windows in einem temporären Fixture. Ein echter lokaler MacBook-Runner, dessen Start nach Mac-Neustart und seine GitHub-gebundene Ausführung sind weiterhin nicht nachgewiesen. |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | .github/workflows/ci.yml; PR-, Main-CI- und Branch-Schutz-Readback | Pflicht | teilweise: PR #46, Head bcaf8d1522044e553459fe1faef8d261285195a8, bestand Actions-Run 43901291322 mit test, macos-latest und macos-15-intel; Auto-Merge führte zu Main-Commit 4d4904a1764105fa8ca97412d6160e8488dfa4d4. Main-CI 43901746256 bestand alle drei Jobs. Aktueller Branch-Schutz ist nicht unabhängig verifiziert: GitHub-API-Readback antwortete 403 Resource not accessible by integration; die Browser-Sitzung war abgemeldet. PR- und Testpfad ist belegt, direkte Push-Sperre bleibt unbekannt. |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | 0-€-Zusatzbudget, begrenzte Job-/Retry-/Polling-Werte; frischer Netlify-Free-Kontingentreadback; Fail-Closed-Gate | Pflicht | teilweise: Netlify bestätigt Free mit 300 Credits/Monat und harter Grenze ohne Gebühren bei Erschöpfung. Zwei Production-Deploys zu je 15 Credits sind nachgewiesen; weitere Teamnutzung und der tatsächliche Kontostand sind nicht lesbar. Ein maschinenlesbarer Team-Readback und eine automatische Vorabpause bei 75 % sind nicht angebunden; Job- und externe Aktionsgates bleiben geschlossen. Kein bezahlter Tarif oder Auto-Recharge wurde aktiviert. |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates und Projektwechsel-Regressionen bestanden; allgemeine PR-/CI-Runs sind vorhanden, ersetzen aber keinen echten A14-Übernahmevorgang mit passender unabhängiger Review, authentifizierter Freigabe und produktiver Control-API-Verbindung. Dieser Live-Nachweis fehlt weiterhin |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Kostenfreies serverloses Control Plane, unabhängig vom statischen PWA-Host | HOSTING_OPTIONS.md; Functions-/OAuth-/Speicher-/Quota-Tests; HTTPS-Live-Smoke und Kosten-/Kontingent-Readback | Pflicht | teilweise, Control API produktiv No-Go: Netlify ist mit GitHub `bndkxbqf2g-stack/prompthub-studio` verbunden. Main-Commit `1cd6204` steht auf Deploy `6afb604fa30e844824f72af5` auf `ready`; öffentliche HTTPS-Root liefert die PWA und `/healthz` meldet `production_api_disabled`. Deploy-Previews bleiben SSO-geschützt. Runtime-Secrets, OAuth-App und Quota-Readback fehlen; Job-Gate bleibt geschlossen. Das private Control-Repository `bndkxbqf2g-stack/prompthub-studio-control` wurde separat bestätigt. |
| A17 | PWA-Installationssymbol und iPhone-Installation | test/api.test.mjs, test/cloudflare-pages.test.mjs, test/pwa-updates.test.mjs, test/pwa-availability.test.mjs; Manifest, Icon, HTTPS, Offline- und Update-Smoke | Pflicht | teilweise: Die öffentliche Netlify-HTTPS-Root lädt die PWA. Manifest, Icon und Service Worker sind implementiert. Echte iPhone-Installation, Offline-Verhalten und Update-Smoke auf dem iPhone bleiben offen. |
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
| A30 | Serverless Hosting, Preview-Isolation und Credit-Gate | test/netlify-function.test.mjs, test/netlify-quota-gate.test.mjs, test/pwa-quota-presentation.test.mjs; Fail-Closed und gemessene Usage-Darstellung | Pflicht | lokal bestanden, live unvollständig: Netlify Function ist deployed, doch `/healthz` meldet wegen fehlender Production-Konfiguration `production_api_disabled`. Unbekannte/veraltete/zu hohe Quota sperrt lokal Jobanlage, Freigabe und Prompt-Übergabe. Der maschinenlesbare Team-Credit-Readback fehlt; Cloud-Aufträge werden nicht angenommen. |
| A31 | Automatische Diensterkennung und mobile Remote-Freigaben | `test/prompt-designer.test.mjs`, `test/pwa-availability.test.mjs`, `test/api-approvals.test.mjs`, `test/project-store.test.mjs`; deterministische Diensterkennung, authentifizierte Nutzerbindung, Ablauf, Idempotenz, Projektisolierung, 0-€-/Quota-/Berechtigungs-Gates, Abbruch, Resume, Lease-Recovery, Belegbindung, unabhängige Verifikation; echte iPhone-/Provider-Live-Abnahme | Pflicht | lokal umgesetzt und mit 175 Tests geprüft; unabhängiger Review des Handoff-Races: keine kritischen, hohen oder mittleren Befunde. PR #49 wurde gemergt; GitHub-CI `43940256313` bestand `test`, `macos-latest` und `macos-15-intel`. Die PWA ist live öffentlich. Produktionsbetrieb bleibt fail-closed: keine Runtime-Secrets/OAuth, kein Netlify-Credit-Readback und kein Provider-Adapter. `/healthz` meldet `production_api_disabled`; externe Aktionen und iPhone-Freigaben sind nicht abgenommen. |
| A32 | CAS-Statusledger und Runner-Fencing | `test/github-control-plane.test.mjs`, `test/lease-store.test.mjs`, `test/strategy-learning.test.mjs`: konkurrierender Claim/Pause/Resume, Ablauf → Stale → Resume → neue Generation, verspäteter Completion, fehlender Lease-Index, fehlendes initialisiertes Job-State-Verzeichnis, verwaiste Zustände, Contents-1.000-Einträge-Grenze mit Tree-Fallback und commitgebundenem Readback, gekürzte Tree-Antwort, nichtleere Legacy-Leases ohne Fencing, Projektion-Reparatur und idempotenter Abschluss; unabhängige Sicherheitsprüfung plus GitHub-CI | Pflicht | Code- und Branch-Nachweis bestanden: 206 lokale Tests, statische Prüfung und unabhängiger Read-only-Review ohne kritische/hohe Befunde. GitHub Actions für Commit `88118344af1e0cb3d4bae0b14845117ba7946fb8`, Run `44004250028`: `test`, `macos-latest` und `macos-15-intel` erfolgreich. Issue-Projektionen bleiben nicht atomar und Kommentare können dupliziert werden, sind aber nicht maßgeblich. Nicht in `main` oder Produktion; Live-Control-API bleibt geschlossen. |
| A33 | Cloudflare-D1-Authspeicher | `test/cloudflare-d1-session-store.test.mjs`, `test/cloudflare-worker.test.mjs`, Migration `migrations/0001_auth_store.sql`; verschlüsselte Sessions, begrenzte Eingaben, gehashter/verschlüsselter OAuth-State, atomarer bedingter Single-use-Verbrauch, Tamper-/Expiry-/Quota-Fehler, kein KV-Fallback; unabhängiger Review, Live-D1-Smoke und Quota-Readback | Pflicht | Branch-Commit `97000bf9f047d0df49a35cdf4d5d88e48854d511`: 216 lokale Tests, statische Prüfung, Patch-Whitespace-Prüfung, SQLite-Migration-/SQL-Smoke, unabhängiger Read-only-Review ohne offene Sicherheitsbefunde und GitHub Actions Run `44010358173` mit `test`, `macos-latest` und `macos-15-intel` bestanden. SQLite ist kein Live-D1-Nachweis. D1-Ressource, Binding, Secrets und Provider-Quota-Readback fehlen; Produktions-API bleibt geschlossen. |

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
- Historischer Readback: Die damalige Netlify-Browserregisterkarte zeigte die
  Anmeldeseite. Spätere Anmeldung, Repository-Verknüpfung und erstes Deployment
  sind unter dem aktuellen Status unten dokumentiert.
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

Stand 2026-11-17. Die Auditbasis `b6d95e53de15fbd8fd7e929ccd09677586fa4019` hat denselben Dateibaum wie `origin/main` `1cd6204556de6d63b627c2f0cd2879c712b2e717` (PR #50); damit galten die Auditbefunde am Main. Der CAS-Fix liegt inzwischen auf `codex/control-plane-integrity` als Commit `88118344af1e0cb3d4bae0b14845117ba7946fb8`; dessen lokale Prüfungen, unabhängige Prüfung und drei GitHub-CI-Lanes sind erfolgreich. Der Fix ist weder gemergt noch produktiv. Die technische Erstabnahme ist weiterhin nicht bestanden.

Externe Nachweise:
- PR #47 wurde mit geprüftem Head `291112319032882734aa909806841f36978c0bac`
  gemergt. Actions-Run `43906291678` bestand `test`,
  `macos-latest` und `macos-15-intel`.
- PR #46/Main- und Pages-Läufe sowie der Live-PWA-Smoke sind oben dokumentiert.
  Der Live-Smoke lud die statische PWA unter `/src/pwa/`, zeigte aber
  „Control API nicht verfügbar“.
- PR #49 wurde nach erfolgreichem Actions-Run `43940256313` automatisch gemergt.
  `test`, `macos-latest` und `macos-15-intel` bestanden; Merge-Commit ist
  `432010421a15956dbe3495c70a7be3df6a7ece2b`.
- CAS-Branch `codex/control-plane-integrity`, Commit
  `88118344af1e0cb3d4bae0b14845117ba7946fb8`: Actions-Run `44004250028`
  bestand `test`, `macos-latest` und `macos-15-intel`. Kein Pull Request,
  Merge oder Deployment wurde angelegt.
- Netlify-Connector-Readback vom 2026-11-16: Free-Team `Booolio`, Projekt
  `prompthub-studio` (`834e2ac8-5324-4b2c-bcb0-9c65a228e43b`), GitHub-Integration
  für `bndkxbqf2g-stack/prompthub-studio`; Production-Deploy
  `6afb604fa30e844824f72af5` ist `ready` auf Main
  `1cd6204556de6d63b627c2f0cd2879c712b2e717`. Die PWA lädt über
  `https://prompthub-studio.netlify.app/`; `/healthz` meldet
  `production_api_disabled`. Produktionszugriff ist öffentlich; Previews bleiben
  privat. Netlify-Readback meldet SSO nur für Nicht-Production. Der tatsächliche
  Credit-Stand und Production-Secrets wurden nicht gelesen/gesetzt.
- Netlify veröffentlicht folgende Credit-Raten: 15 je Produktions-Deployment,
  10 je GB-Stunde Compute, 20 je GB Bandbreite und 2 je 10.000 Requests.
  Diese Metriken teilen denselben Credit-Pool. Bei Erschöpfung pausieren alle
  Team-Sites; der Free-Tarif hat ein Hard Limit. Das Job-Gate bleibt geschlossen,
  bis ein frischer maschinenlesbarer Team-Readback live eingebunden ist.
- Netlify-Repository-Verbindung, erfolgreicher Production-Deploy, öffentliche
  HTTPS-PWA und private Deploy-Previews sind nachgewiesen. Runtime-Secrets,
  OAuth und Live-Control-API fehlen.
- GitHub-Connector-Readback bestätigt das private Control-Repository
  `bndkxbqf2g-stack/prompthub-studio-control`; `.prompthub/active-jobs.json`
  enthält noch das leere Legacy-Schema `version: 1` und keine aktiven Leases.
  Die Implementierung für Lease-Schema 2 und per Job gespeicherte
  CAS-Statusdateien liegt auf dem Feature-Branch; am privaten Control-Repository
  wurde weder migriert noch geschrieben.

Offene Betriebsnachweise:
- Runtime-Secrets, OAuth-Login und eng begrenzter Zugriff auf das private
  Control-Repository; sichere Bestätigung dafür bleibt beim Nutzer.
- Funktionsfähige HTTPS-Control-API und automatischer Credit-Readback.
- Verlässliche automatische Jobpause bei Netlify-Nutzung ab 75 %.
- GitHub branch protection und Sperre direkter Pushes unabhängig auslesen.
- GitHub-persistente autonome Ausführung, echter MacBook-Runner und
  Cloud-Runner.
- iPhone-Installation, Offlinebetrieb und Updateverhalten nach Live-Deploy.
- Gepaarte projektübergreifende Commit-/CI-Experimente für Lernstrategien.

Kein kostenpflichtiger Dienst wurde in dieser Einrichtung aktiviert. Cloudflare
bleibt pausiert. Angebotsküche bleibt bis zur bestandenen PromptHub-Abnahme
unangetastet.
