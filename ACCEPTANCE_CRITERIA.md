# PromptHub Studio – verbindliche Abnahmematrix

Eine KI-Selbsteinschätzung ist kein Nachweis. Für jedes Kriterium werden
ausführbare Tests, Logs oder GitHub-API-Antworten mit Zeit und Commit referenziert.

| ID | Kriterium | Nachweis / Test | Gate | Status |
|---|---|---|---|---|
| A01 | PWA, API und Control-Plane-Datenfluss | test/api.test.mjs; lokaler HTTP-Smoke; Pages-Deployment und Live-Browser-Smoke | Pflicht | teilweise: Main-Commit 4d4904a1764105fa8ca97412d6160e8488dfa4d4 wurde erfolgreich gebaut und per Pages-Run 43901742433 ausgerollt. Der Live-Browser vom 2026-11-16 lud die PWA unter /src/pwa/ und zeigte ehrlich Control API nicht verfügbar. Statische PWA und Routing sind verifiziert; API, OAuth und GitHub-persistenter Datenfluss fehlen live. |
| A02 | Sichere Authentifizierung | `test/auth.test.mjs`, `test/config.test.mjs`, `test/netlify-blob-stores.test.mjs`; OAuth-Allowlist, verschlüsselte serverseitige Sitzungen, Session-Ablauf und atomarer einmaliger OAuth-State | Pflicht | lokal bestanden; unabhängige Sicherheitsprüfung fand keine Auth-/Session-Sicherheitsbefunde. Live-OAuth-Callback und Provider-Secrets sind nicht eingerichtet. |
| A03 | Keine Geheimnisse im Browser/GitHub/Log | `scripts/check.mjs`, OAuth-/Payload-Assertions | Pflicht | lokal bestanden |
| A04 | Zuverlässige Auftragsverarbeitung | `test/runner.test.mjs`, `npm run demo`, echter Executor-Smoke in isoliertem Git-Fixture | Pflicht | lokal bestanden: Am 2026-11-16 führte `PromptHubRunner` mit `ProcessExecutor`, echtem Codex CLI, `MemoryControlPlane` und `GitWorktreeManager` einen Fixture-Auftrag aus. Die Datei wurde von 41 auf 42 geändert, der echte Node-Pflichtcheck bestand, der Job erreichte `succeeded`, der Executor beendete sich mit Exitcode 0, vier Checkpoints wurden aufgezeichnet und danach blieb kein aktiver Lease zurück. Das belegt keine GitHub-Control-Plane-Persistenz oder MacBook-Ausführung |
| A05 | Global maximal zwei aktive Jobs | `test/lease-store.test.mjs`, Control-Plane-Cap-Test | Pflicht | lokal bestanden |
| A06 | Outbound-only Mac-Runner | Runner-Quellpfad ohne Listener, `/healthz` mit `runner_inbound_port=false`, echte macOS-CI und lokaler Mac-Runner | Pflicht | Windows-Smoke bestätigte `runner_inbound_port=false`; Port 18787 war nach dem Stopp geschlossen. PR #21 verifizierte auf Head `a873695153a6bb24e61b149d5ee0fc64108e33a4` mit Actions-Run 80 (`43770627889`) erfolgreiche vollständige Tests und Static-Checks auf `macos-latest` (Apple Silicon) und `macos-15-intel`; Main-Run 84 (`43771264550`) bestätigte beide Lanes und `test` erneut. Am 2026-11-16 bestand zusätzlich ein echter Codex-CLI-/PromptHubRunner-Smoke auf Windows in einem temporären Fixture. Ein echter lokaler MacBook-Runner, dessen Start nach Mac-Neustart und seine GitHub-gebundene Ausführung sind weiterhin nicht nachgewiesen. |
| A07 | Heartbeats und Checkpoints | Runner-Ereignisfolge und Checkpoint-Assertions | Pflicht | lokal bestanden |
| A08 | Wiederaufnahme nach Unterbrechung | Lease-Ablauf → `stale` → explizites Resume in `test/control-plane.test.mjs` | Pflicht | lokal bestanden |
| A09 | CI, Pflichtchecks und verpflichtender Merge-Gate | .github/workflows/ci.yml; PR-, Main-CI- und Branch-Schutz-Readback | Pflicht | teilweise: PR #46, Head bcaf8d1522044e553459fe1faef8d261285195a8, bestand Actions-Run 43901291322 mit test, macos-latest und macos-15-intel; Auto-Merge führte zu Main-Commit 4d4904a1764105fa8ca97412d6160e8488dfa4d4. Main-CI 43901746256 bestand alle drei Jobs. Aktueller Branch-Schutz ist nicht unabhängig verifiziert: GitHub-API-Readback antwortete 403 Resource not accessible by integration; die Browser-Sitzung war abgemeldet. PR- und Testpfad ist belegt, direkte Push-Sperre bleibt unbekannt. |
| A10 | Worktrees und Branch-Isolation | echter Git-Fixture-Test in `test/worktree.test.mjs` | Pflicht | lokal bestanden |
| A11 | Fehlerbehandlung | Validierungs-, Executor-, Lease- und Backup-Fehlertests | Pflicht | lokal bestanden |
| A12 | Wissen und Historie | `test/knowledge-recovery.test.mjs`, versioniertes `knowledge/` | Pflicht | lokal bestanden |
| A13 | Kosten-/Ressourcenbegrenzung | 0-€-Zusatzbudget, begrenzte Job-/Retry-/Polling-Werte; exakt gepinnte serverseitige Hosting-Abhängigkeit; fail-closed Netlify-Credit-Gate | Pflicht | lokale Pflichtprüfungen bestanden. Das tatsächliche Netlify-Konto, der Free-Tarif, Teamverbrauch und Auto-Recharge-Status sind live nicht verifiziert; kein kostenpflichtiger Dienst wurde aktiviert. |
| A14 | Kontrollierte Eigenupdates | `test/strategy-learning.test.mjs`, `test/pwa-strategy.test.mjs`, `test/api-projects.test.mjs`, `test/auth.test.mjs`; GitHub-PR-/Actions-Evidenz, unabhängiger Review und authentifizierte Freigabe | Pflicht | teilweise: lokale API-/PWA-Gates und Projektwechsel-Regressionen bestanden; allgemeine PR-/CI-Runs sind vorhanden, ersetzen aber keinen echten A14-Übernahmevorgang mit passender unabhängiger Review, authentifizierter Freigabe und produktiver Control-API-Verbindung. Dieser Live-Nachweis fehlt weiterhin |
| A15 | sichere Wiederherstellung | Backup-Manifest, SHA-256, Approval- und Tamper-Test | Pflicht | lokal bestanden |
| A16 | Kostenfreies serverloses Control Plane, unabhängig vom statischen PWA-Host | HOSTING_OPTIONS.md; Functions-/OAuth-/Speicher-/Quota-Tests; HTTPS-Live-Smoke und Kosten-/Kontingent-Readback | Pflicht | teilweise, produktiv No-Go: Pages liefert die PWA, aber keine API. Netlify Function, Blob-Adapter, OAuth-/Sessionstore, Preview-Isolation und fail-closed Quota-Gate sind lokal getestet. Die Live-PWA zeigte am 2026-11-16 Control API nicht verfügbar. Netlify-Anmeldung ist bis zur Rückkehr des Nutzers an den Desktop verschoben; Konto, Free-Tarif, Runtime-Secrets, OAuth-Callback, Live-API und autoritativer Credit-Readback sind nicht verifiziert. Das Job-Gate bleibt geschlossen. Cloudflare bleibt pausiert; kein bezahlter Dienst wurde aktiviert. |
| A17 | PWA-Installationssymbol und iPhone-Installation | test/api.test.mjs, test/cloudflare-pages.test.mjs, test/pwa-updates.test.mjs, test/pwa-availability.test.mjs; Manifest, Icon, HTTPS, Offline- und Update-Smoke | Pflicht | teilweise: Pages-Run 43901742433 deployte Main-Commit 4d4904a1764105fa8ca97412d6160e8488dfa4d4 erfolgreich. Live-Browser lud die PWA unter /src/pwa/. Service Worker v7 und Statusdarstellung sind implementiert; die API-Fehlermeldung ist sichtbar. Echte iPhone-Installation, Offline-Verhalten und ein Update-Smoke auf dem iPhone bleiben offen. |
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
| A30 | Serverless Hosting, Preview-Isolation und Credit-Gate | test/netlify-function.test.mjs, test/netlify-quota-gate.test.mjs, test/pwa-quota-presentation.test.mjs; Fail-Closed und gemessene Usage-Darstellung | Pflicht | lokal bestanden, live unvollständig: unbekannte/veraltete/zu hohe Quota sperrt Jobanlage, Freigabe und Prompt-Übergabe; PR #46 ergänzt die PWA-Anzeige und wurde mit erfolgreichen Pflichtchecks gemergt. Netlify-Konto, Free-Tarif, OAuth, HTTPS-API und autoritativer Team-Credit-Readback sind nicht nachgewiesen. Kein freigegebener Kontingentwert wird behauptet; das Gate bleibt geschlossen. |

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

Stand 2026-11-16, Main-Commit 4d4904a1764105fa8ca97412d6160e8488dfa4d4:
Status: conditional_local_pass. Die technische Erstabnahme ist nicht bestanden.

Lokale Pflichtprüfungen auf diesem Commit: npm test 143/143 bestanden;
npm run check erfolgreich für 110 Dateien und den Prompt-Library-Abgleich;
git diff --check ohne Befund. Der lokale Checkout ist auf denselben Main-Commit
synchronisiert und sauber.

Externe Nachweise:
- PR #46 wurde nach erfolgreichen Pflichtchecks automatisch gemergt.
  Pull-Request-CI 43901291322 bestand test, macos-latest und macos-15-intel.
- Main-CI 43901746256 bestand test und beide macOS-Lanes.
- GitHub-Pages-Run 43901742433 bestand Build, Deploy und Statusbericht.
- Live-Browser-Smoke am 2026-11-16 lud die veröffentlichte PWA unter
  /src/pwa/. Sie zeigte Control API nicht verfügbar. Das belegt den statischen
  Host und das Routing, aber keine serverseitige Control API.
- PR #46 ergänzte eine sichtbare, fail-closed Quota-Anzeige. Credits werden
  nur bei gültigen Messwerten aus der gekennzeichneten autoritativen Quelle
  dargestellt. Da die Live-API nicht verfügbar ist, ist kein Live-Quota-
  Readback erfolgt; Cloud-Aufträge bleiben gesperrt.

Offene Betriebsnachweise:
- Netlify-Anmeldung und Einrichtung sind vom Nutzer bis zu seiner Rückkehr an
  den Desktop verschoben. Konto, Free-Tarif, Live-OAuth, Runtime-Secrets,
  produktive API und autoritativer Team-Credit-Readback sind nicht verifiziert.
- GitHub branch protection ließ sich aktuell nicht auslesen: GitHub-API
  antwortete 403 Resource not accessible by integration; die Browser-Sitzung
  war abgemeldet. PR #46 demonstriert den bestandenen Auto-Merge-Pfad, aber
  eine direkte Push-Sperre ist derzeit nicht nachgewiesen.
- Der echte CodexRunner-Smoke lief einmalig unter Windows mit
  MemoryControlPlane. GitHub-persistente autonome Ausführung, dauerhafter
  MacBook-Runner und Cloud-Runner sind nicht nachgewiesen.
- iPhone-Installation, iPhone-Offlinebetrieb und Updateverhalten nach einem
  Live-Deploy sind nicht geprüft.
- Gepaarte projektübergreifende Commit-/CI-Experimente für Lernstrategien
  sind offen.

Das Quell-Repository ist öffentlich, wie vom Nutzer ausdrücklich angewiesen.
Cloudflare bleibt pausiert. Kein zusätzlicher kostenpflichtiger Dienst wurde
aktiviert; Kontostände oder Abrechnungsdaten sind nicht unabhängig geprüft.
Angebotsküche bleibt bis zur bestandenen PromptHub-Abnahme unangetastet.