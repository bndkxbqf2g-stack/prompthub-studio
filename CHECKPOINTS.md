# Checkpoints

## CP-000 – Inventar und Schutzrahmen

- Datum: 2026-11-15
- Status: abgeschlossen
- Nachweis: Arbeitsmappe war leer; kein lokales Repository, keine `AGENTS.md`,
  keine PromptHub-Artefakte vorhanden.
- Fähigkeiten: Git, Node.js/npm, pnpm und Docker lokal vorhanden; `gh` nicht
  vorhanden; GitHub-MCP authentifiziert als `bndkxbqf2g-stack` mit Schreibrechten
  in den eigenen Repositories.
- Entscheidungen: kein Remote-Repository erstellt; lokale Git-Historie begonnen;
  dependency-freier Node-MVP; GitHub als durable Control Plane.
- Restriktionen: echter Mac, OAuth-App, HTTPS-Hosting und Codex-Binary sind in
  dieser Windows-Umgebung nicht als Betriebsnachweis verifiziert.
- Prüfung: `git diff --check` erfolgreich.

## CP-001 – Core-Verträge

- Datum: 2026-11-15
- Status: abgeschlossen
- Implementiert: dependency-freier Node-Kern, Memory- und GitHub-Control-Plane,
  GitHub OAuth, mobile PWA, CAS-Leases, Job-Cap 2, Recovery/Resume-Gate,
  Heartbeats, Checkpoints, Pflichtchecks, isolierte Branches/Worktrees,
  outbound-only Runner, versioniertes Wissen mit Evidenz-Gates und
  checksum-verifizierte Backups mit expliziter Restore-Freigabe sowie
  Dependency-/Risiko-Gates für die Jobpriorisierung. Produktionshärtung erzwingt
  HTTPS, private Control-Repositories und eine GitHub-Login-Allowlist.
- Tests: `npm test` erfolgreich, 19/19; `npm ci --ignore-scripts --no-audit --no-fund`
  erfolgreich; `npm run check` erfolgreich; Syntaxprüfung für 30 `.mjs`-Dateien
  erfolgreich; `git diff --check` erfolgreich.
- Vertikalschnitt: `npm run demo` erfolgreich; Job `queued → running →
  succeeded`, sieben Ereignisse und keine aktive Lease nach Abschluss.
- Laufzeitprüfung: lokale API auf `127.0.0.1:8787` gestartet; `/healthz` meldete
  `runner_inbound_port=false`; PWA-HTML lieferte CSP und HTTP 200. Nachweis-
  listener wurde beendet; kein Listener blieb auf Port 8787.
- Abnahmebezug: A01, A02, A03, A04, A05, A06, A07, A08, A10, A11, A12, A13
  und A15 sind lokal durch Tests/Checks belegt. A09 ist als Workflow versioniert,
  aber noch nicht in GitHub ausgeführt. A14 ist dokumentiert und durch die
  kritische Strategie-Freigabe markiert, aber noch nicht vollständig als
  Betriebsnachweis abgenommen.
- Offene externe Nachweise: echter Mac-Runner, GitHub-Workflow-Run, private
  GitHub-Control-Repository-Sichtbarkeit, OAuth-App und freigegebener HTTPS-Host.
- Versionierung: Git-Repository wurde initialisiert und `git status` ist lesbar;
  ein lokaler Commit konnte wegen der vom Ausführungsrahmen schreibgeschützten
  `.git`-Indexdatei nicht angelegt werden (`index.lock: Permission denied`).

## CP-002 – Multi-Projekt, Prompt-Intelligence und Effizienz

- Datum: 2026-11-15
- Status: lokal implementiert und geprüft; externe Abnahme bleibt offen.
- Implementiert: serverlose Cloudflare-Worker-Adapterstruktur mit KV-Session-
  Store und fail-closed Quotenfehlern; Multi-Projekt-Verwaltung mit getrennter
  Projektdatenhaltung, sicherem Entfernen/Wiederverbinden und gesonderter
  Datenlöschung; Prompt-Designer mit Interview, Risiko-/Qualitätsprüfung,
  ausdrücklicher Freigabe und deterministischem Fallback; quellenbelegte
  Prompt-Bibliothek mit Suche, Reviews und Sicherheits-/Aktualitäts-Audit;
  taskbezogene Kontextwahl, versionierte Snapshots, Cache-Deduplizierung und
  Dashboard für gemessene Tokens, Anbieter-/Executor-Aufrufe, Laufzeit,
  Wiederholungen, Pflichtchecks und Datenerfassungsgrenzen.
- Prüfungen: `npm test` 52/52; `npm run check` 76 Dateien; `npm run demo`
  erfolgreich mit sieben Statusereignissen; `git diff --check` ohne
  Whitespace-Fehler (Git meldet nur LF/CRLF-Konvertierungshinweise).
- Effizienznachweis: Tokenwerte erscheinen nur aus Anbietertelemetrie;
  unbekannte und teilweise Messungen bleiben unterscheidbar. Das Dashboard
  markiert die GitHub-Abfragegrenze von 100 Issues sowie höchstens 50
  aufbewahrte Prompt-Entwürfe je Projekt. `/healthz` behauptet keinen laufenden
  Runner, sondern meldet `not_observed` und eine etwaige Konfiguration separat.
- Offene externe Abnahme: kein Remote-Control-Repository, kein verifiziertes
  Cloudflare-Konto/KV-Binding/Live-Deployment, kein echter GitHub-CI-Lauf,
  keine OAuth-App/HTTPS-Freigabe und kein verfügbarer Mac- oder Cloud-Codex-
  Executor. Keine kostenpflichtige Funktion wurde aktiviert.
- Angebotsküche: noch nicht analysiert; bleibt bis zur vollständigen
  PromptHub-Abnahme und der verlangten MVP-Umfangsbestätigung gesperrt.

## CP-003 – Fehlerprävention und verifiziertes Ergebnislernen

- Datum: 2026-11-15
- Status: lokal implementiert und geprüft; technische Gesamt-Abnahme bleibt
  wegen externer Betriebsnachweise offen.
- Implementiert: `ErrorLearningEngine` für projektbezogene Runnerfehler,
  Wiederholungsmuster, Nutzerberichte, Ursachenhypothesen und explizit
  menschlich bestätigte Ursachen; Digest-, Schema- und vorhandene
  Control-Plane-Belege werden geprüft. Menschliche Ursachenbestätigung verlangt
  eine exakte Incident-Phrase, fehlgeschlagenen plus später bestandenen
  gleichnamigen Pflichtcheck und die Bestätigung, dass der Erfolgsjob dieselbe
  Korrektur prüft.
- Runner-/Check-Ausgaben werden nur in-memory mit einer festen Liste
  deterministischer Fehlerklassen analysiert. Rohe Logs gelangen nicht in
  Projektdaten, Jobereignisse, Prompts oder Dashboard. GitHub-CI-Analyse ist auf
  fünf jüngste Runs, zwei Fehlerdetails und je 100 Jobs begrenzt; keine
  vollständigen Actions-Logs werden gespeichert.
- PWA/API: projektbezogene Fehlerliste und -meldung, Hypothesenformular,
  menschlicher Bestätigungsdialog, Fehlerquote aus der geladenen Jobstichprobe,
  7-Tage-Fehlerbeobachtungstrend, wiederkehrende Muster, verfügbare bestätigte
  Regressionen, CI-Signale und Belegstatus.
- Wissen bleibt im ausgewählten Projekt. Prompts trennen bestätigte
  Anforderungen, Diagnosehinweise und Hypothesen. Gealterte Belege zählen nicht
  als aktuell verifizierte Regression. Aufbewahrung ist auf 200 Ergebnisse,
  500 Vorfälle je Projekt, 20 Hypothesen je Vorfall und 40 Historieneinträge je
  Vorfall begrenzt.
- Tests: `npm test` erfolgreich, 68/68; umfasst Runner-Ingestion,
  Wiederholungsgruppierung, datensparsame Fehlerklassifikation,
  exakte Bestätigung mit verknüpften Belegen, Projekttrennung, Manipulations-
  und Schemafehler, CI-Schrittbegrenzung, Promptkontext und Dashboard.
- Statische Analyse: `npm run check` erfolgreich, 81 Dateien;
  `node --check src/pwa/app.js` erfolgreich; `npm run demo` erfolgreich mit
  `queued → running → succeeded` und sieben Ereignissen.
- `git diff --check` erfolgreich; Git meldet lediglich die konfigurierte
  LF/CRLF-Konvertierung für Arbeitsdateien.
- Abnahmereferenz: A27 und A28 lokal bestanden. A23 bleibt für kontrollierte
  gepaarte Commit-/CI-Experimente teilweise offen. Echte GitHub-CI-Läufe,
  private Remote-Control-Repository-Konfiguration, HTTPS/OAuth, Cloud-Binding
  und Mac-/Cloud-Runner wurden nicht ausgeführt oder vorgetäuscht.
- Implementierungscommit: `2e747ad` (`Implement error prevention learning engine`).
- Kosten: keine kostenpflichtigen Ressourcen oder Dienste aktiviert.

## CP-005 – GitHub-Zuordnung und Laufzeitinventar

- Datum: 2026-11-15
- Nutzerentscheidung: Das bestehende Angebotsküche-Projekt heißt auf GitHub
  `Einkaufen`. Sein Inhalt bleibt bis zur bestandenen technischen PromptHub-
  Abnahme und anschließenden einmaligen MVP-Umfangsbestätigung unangetastet.
- PromptHub-Remote: Der Nutzer hat `prompthub-studio` ausdrücklich zur Anlage
  auf GitHub freigegeben. GitHub-Connector und lokaler Credential-Manager stellen
  derzeit keinen Repository-Erstellungszugang bereit; die GitHub-Weboberfläche
  konnte mit der verfügbaren UI-Automation nicht sicher bedient werden. Das
  Formular blieb ungesendet und mit Standard-Sichtbarkeit Public geöffnet.
  Repository-Erstellung, Push und GitHub-CI sind daher noch nicht erfolgt. Der
  Nutzer richtet einen Erstellungszugang ein.
- Laufzeitinventar: Windows (`win32`); `codex-cli 0.167.0-alpha.4.1` installiert.
  `codex login status` meldete mit gesetztem vorhandenem `CODEX_HOME` eine
  ChatGPT-Sitzung. Der nichtinteraktive Smoke-Test mit `--ephemeral` und
  `--sandbox read-only` endete mit Exitcode 1: Zugriff verweigert beim Erzeugen
  temporärer CLI-Dateien und beim Schreiben der lokalen Diagnose-Datenbank.
  Daher gilt tatsächliche Codex-Ausführung in dieser gesperrten Umgebung als
  nicht nachgewiesen; es wurde kein weiterer Modellauftrag gestartet.
  `gh`- und `wrangler`-Kommandos sind nicht installiert.
- Lokalprüfung in diesem Durchlauf: `npm test` 70/70, `npm run check` 83 Dateien;
  keine Quelldatei wurde nach diesen Prüfungen geändert.
- Abnahmestatus bleibt `conditional_local_pass`. Remote-Control-Repository,
  OAuth/HTTPS, echtes GitHub-CI, kostenloser Cloud-Runner und Mac-Runner fehlen.
- Kosten: keine kostenpflichtige Ressource aktiviert.
- Angebotsküche bleibt bis zur vollständigen PromptHub-Abnahme gesperrt.

## CP-004 – Beleggestützte Regressionstest-Aufträge

- Datum: 2026-11-15
- Ergänzung: Bei wiederholten Runnerfehlern oder menschlich bestätigten
  Ursachen mit aktuell verfügbaren Belegen kann die PWA einen begrenzten
  Regressionstest-Auftrag aus den strukturierten Incident-Feldern vorbereiten.
  Der Auftrag verlangt Reproduktion und einen gezielten Vorher-/Nachher-Test,
  behandelt Diagnosefelder als Hinweise und wird erst nach Prompt-QA und
  ausdrücklicher Nutzerfreigabe als Entwicklungsjob erstellt.
- Einmalige und unbestätigte Berichte oder gealterte Belege zeigen keinen
  Regressionstest-Auftrag an. Die Funktion erzeugt keinen Code, speichert keine
  vollständigen Runnerlogs und verändert kein verbundenes Repository selbst.
- Tests: `npm test` 70/70; `npm run check` erfolgreich für 83 Dateien;
  `npm run demo` erfolgreich mit `queued → running → succeeded` und sieben
  Ereignissen; PWA-JavaScript-Syntax und `git diff --check` erfolgreich.
- Abnahmereferenz: A29 lokal bestanden. Ausführung in einem verbundenen
  Nutzerprojekt bleibt mangels Remote und Runner offen.
- Implementierungscommit: `30a94ed` (`Add evidence-based regression task preparation`).
- Kosten: keine kostenpflichtigen Ressourcen oder Dienste aktiviert.
## CP-006 – Privates GitHub-Repository verbunden

- Datum: 2026-11-15
- Der Nutzer hat `bndkxbqf2g-stack/prompthub-studio` erstellt. Die GitHub-API
  bestätigt `visibility=private`, Standardbranch `main` und Schreibberechtigung.
- Der saubere lokale Stand `ec8dc42` wurde als Snapshot in den Remote-Branch
  importiert. Der Import-Commit lautet `ca6210a7681f82aa7a9535806e804f938349c444`;
  der Branch wurde mit erwartetem Vorgänger aktualisiert, ohne Force-Push.
  Enthalten sind 90 versionierte Dateien mit zusammen 1.895.896 Bytes, darunter
  das PWA-Icon. Eine `.env`-Datei war nicht versioniert und wurde nicht übertragen.
- Mangels Git-Transportanmeldung erfolgte der Import über die verbundene GitHub-
  API. Die ursprüngliche lokale Commit-Abstammung wurde nicht reproduziert; der
  Remote-Commit enthält den Quellbaum aus `ec8dc42`.
- `.github/workflows/ci.yml` liegt im Remote. Die kombinierte Commit-Statusabfrage
  lieferte `statuses: []`; damit ist kein erfolgreicher GitHub-Actions-Lauf
  nachgewiesen. Lokale Prüfungen aus CP-005 bleiben `npm test` 70/70 und
  `npm run check` 83 Dateien.
- Abnahmestatus bleibt `conditional_local_pass`; A09 und externe Betriebsnachweise
  sind offen. Angebotsküche (`Einkaufen`) bleibt bis zum Abnahmegatter gesperrt.
- Es wurden keine kostenpflichtigen Dienste oder Tarife aktiviert.

## CP-007 – Cloudflare-Pages-Bereitstellung vorbereitet

- Datum: 2026-11-15
- Cloudflare Pages ist in `wrangler.toml` konfiguriert. Das vorherige Workers-
  Static-Assets-Profil bleibt in `wrangler.worker.toml`. `functions/[[path]].js`
  verwendet den vorhandenen gehärteten Handler; `_routes.json` begrenzt Functions
  auf API-, Auth- und Health-Routen. Ohne Production-Secrets oder KV-Binding
  bleibt `/api/me` bei 503 und der PWA-Adminbereich verborgen.
- Lokale Nachweise: `npm test` 75/75; `npm run check` 86 Dateien;
  `git diff --check` Exit 0; `npm run demo` meldet einen `succeeded`-Job und
  sieben Ereignisse.
- Der Pages-Vorbereitungscommit `3e92f9c2919fe7026eb3eddd4421d46a7358d903`
  wurde auf `main` synchronisiert. GitHub Actions Run
  [43720677933](https://github.com/bndkxbqf2g-stack/prompthub-studio/actions/runs/43720677933)
  endete mit `success`; Test-, statische Analyse- und Whitespace-Schritte waren
  erfolgreich. Die GitHub-API bestätigte anschließend weiter `visibility=private`.
- Cloudflare-Dashboard: keine vorhandenen Workers-/Pages-Projekte; 0/100.000
  Requests am heutigen UTC-Tag. Billing-Seite blieb beim Laden, daher ist der
  konkrete Abrechnungsstatus nicht bestätigt.
- GitHub-Billing: Plan Free, Actions-Billable-Usage $0 nach Rabatten,
  Actions-Budget $0.00 mit „Usage blocked“ und Included-Usage-Alerts aktiviert.
- Die Cloudflare-GitHub-OAuth-Verbindung wurde autorisiert. Die GitHub-App-
  Installation wurde nicht bestätigt: sie fordert Schreibzugriff auf
  Administration, Checks, Code, Deployments und Pull Requests. Kein Pages-
  Projekt, KV-Namespace oder Runtime-Secret wurde angelegt; kein Deployment
  wurde gestartet. Das Repository blieb privat.
- Abnahme A09 ist für diesen Commit bestanden. A16 bleibt offen:
  Berechtigungsfreigabe, Cloudflare-Abrechnung,
  Runtime-Bindings, produktiver HTTPS-Deploy sowie Live- und Quotenprüfungen.
  Die Dashboard- und Berechtigungsnachweise stehen in
  `CLOUDFLARE_OPERATIONS.md` und `CLOUD_COST_RULES.md`.
- Es wurden keine kostenpflichtigen Ressourcen oder Dienste aktiviert.

## CP-008 – Abnahmestatus und Laufzeit erneut verifiziert

- Datum: 2026-11-15, 13:58 UTC
- Lokaler Stand: `0b740002d430b099f9c736a86b5597b6705d2cb3`, Arbeitsbaum vor
  dieser Dokumentationsänderung sauber.
- Reproduzierbare Prüfungen: `npm test` 75/75 bestanden; `npm run check`
  erfolgreich für 86 Dateien; `git diff --check` erfolgreich; `npm run demo`
  beendete einen Auftrag mit Status `succeeded` und sieben Ereignissen.
- Lokaler Laufzeittest auf einem separaten Port: `/healthz` meldete
  `control_plane=memory`, `auth_mode=local`, `runner_inbound_port=false` und
  `runner_configured=false`; PWA und Manifest antworteten mit HTTP 200. Der
  sichtbare lokale Modus meldet korrekt, dass die GitHub-Control-Plane fehlt.
  Der bereits belegte Port 8787 wurde nicht verändert.
- Remote: GitHub bestätigt `bndkxbqf2g-stack/prompthub-studio` weiterhin als
  privat, Standardbranch `main`, Kopf `076af3c5d33dbba5fb7290a1b6d6a9df6734399b`.
  Actions-Run 4 (`43720935247`) für diesen Commit und Job `test` sind
  erfolgreich.
- Kritischer offener Gate-Nachweis: GitHub-Branch-API meldet
  `protected=false`, `required_status_checks.enforcement_level=off` und keine
  erforderlichen Checks. A09 wurde deshalb präzisiert und auf `teilweise`
  gesetzt. Ein Merge-Gate für `test` ist nötig; die Repository-Sicherheitsregel
  wird ohne ausdrückliche Nutzerfreigabe nicht geändert.
- Browser-Prüfung: Cloud-Browser blieb auf der Installation der Cloudflare-
  GitHub-App; nur das PromptHub-Repository ist ausgewählt, die weitreichenden
  App-Schreibrechte wurden nicht autorisiert. Es gibt kein Pages-Projekt und
  keine HTTPS-Veröffentlichung.
- Kosten: in diesem Durchlauf wurden keine Cloud-Ressourcen, kostenpflichtigen
  Tarife oder neuen Dienste aktiviert.

## CP-009 – Pages-PWA veröffentlicht und live geprüft

- Datum: 2026-11-15, 14:50 UTC
- Cloudflare Pages `prompthub-studio` ist mit dem privaten GitHub-Repository
  verbunden. Production `https://prompthub-studio.pages.dev` steht auf Branch
  `main`; Deployment `10eb0d77-7b19-4edc-9adc-548518e098f7` für Commit
  `504477dc35dab908c8b3755550866bca071c72db` meldet `success`.
- GitHub Actions Run 6 (`43724681369`), Job `test`, bestand. Der Build-Fix
  erzeugt das Prompt-Library-ES-Modul aus der versionierten JSON-Quelle.
- HTTPS-Prüfung: `/`, `/manifest.webmanifest`, `/app-icon-source.png`,
  `/sw.js`, `/app.js` und `/styles.css` antworteten mit HTTP 200. `/api/me`
  und `/healthz` antworteten mit HTTP 503 und
  `cloud_control_plane_not_configured`; OAuth, Runtime-Secrets und KV-Binding
  sind nicht eingerichtet. Damit ist die PWA-Hülle veröffentlicht, nicht die
  funktionsfähige Control API.
- Cloudflare Runtime `Fail closed` wurde gespeichert und erneut ausgelesen.
  Preview-Branches wurden auf `None` gestellt und gespeichert; nachfolgende
  erneute Kontrolle war wegen geschlossenem Cloud-Browser-Transport nicht
  möglich. Preview-Access wurde nicht eingerichtet; Preview-Secrets sind nicht
  gesetzt.
- GitHub blieb privat. Der Nutzer hat den erforderlichen CI-Check `test`
  freigegeben. Der Branch-Protection-Dialog meldete, dass das private
  Repository einen geeigneten bezahlten Plan braucht; die spätere Rulesets-API-
  Prüfung für das persönliche Repository dokumentiert CP-010 präziser. Kein
  Upgrade und keine Sichtbarkeitsänderung wurden vorgenommen; Merge-Gate fehlt.
- Cloudflare-Billing-Seite konnte nicht verifiziert werden. In diesem
  Arbeitsgang wurde kein kostenpflichtiger Tarif oder Dienst aktiviert.
- Echtes iPhone-Installations-/E2E-Testing und unabhängiger Quoten-/Ausfalltest
  stehen aus. Vollständige Abnahme bleibt offen; Details in
  `ACCEPTANCE_CRITERIA.md` und `CLOUDFLARE_OPERATIONS.md`.

## CP-010 – Branch-Gate unter GitHub Free geprüft

- Datum: 2026-11-15, 15:14 UTC
- Repository `bndkxbqf2g-stack/prompthub-studio` wurde per GitHub-API erneut als
  privat, persönliches Konto und Default-Branch `main` bestätigt.
- Nutzerfreigabe für den Pflichtcheck `test` liegt vor. Ein GET auf die
  Rulesets-API liefert HTTP 403 mit `Upgrade to GitHub Pro or make this
  repository public to enable this feature.` Die Branch-Protection-GET ist für
  die verbundene Integration nicht zugänglich (403). GitHub-Dokumentation
  bestätigt: Free schützt öffentliche Repositories; private Repositories
  benötigen Pro für persönliche Konten oder Team/Enterprise für Organisationen.
- Unter den verbindlichen Vorgaben „privat“ und „0 €“ gibt es keine kostenlose
  serverseitige GitHub-Branch-Regel. Es wurde kein Plan aktiviert und das Repo
  blieb privat. CI Run 9 (`43727273718`) für `8f0fdc2` bestand. Pages führt
  `npm test` und `npm run check` erneut vor Veröffentlichung aus; das blockiert
  fehlerhafte Deployments, aber kein Merge. A09 bleibt offen.
- In der verwalteten Windows-Shell ist `codex-cli 0.167.0-alpha.4.1` installiert,
  aber `codex login status` schlägt mit `Could not find home directory` fehl.
  Damit ist hier kein authentifizierter lokaler Codex-Executor belegt; ein
  Mac-Runner wurde nicht getestet.
- Lokale Prüfungen nach den Dokumentationsänderungen: `npm test` 75/75;
  `npm run check` erfolgreich (88 Dateien, Prompt-Library synchron);
  `git diff --check` erfolgreich.

## CP-011 – Codex-Ausführungszugänge erneut geprüft

- Datum: 2026-11-15, 15:22 UTC
- `codex-cli 0.167.0-alpha.4.1` ist installiert. `codex login status` endet
  mit Exitcode 1 und `Could not find home directory`. Die Präsenzprüfung zeigte
  `USERPROFILE` vorhanden, `HOME` und `CODEX_HOME` nicht; diese Variablen wurden
  nicht gesetzt oder verändert. GitHub- und Cloudflare-Token waren in dieser
  Shell nicht vorhanden.
- Die Codex-Cloud-Umgebungsabfrage meldet `asenvcfg_base` als `ready` und
  `runnable`, jedoch ohne verknüpfte Repositories (`repositories: []`). Die
  Antwort enthielt denselben Environment-Eintrag doppelt. Es wurde kein Task
  gestartet; damit ist kein autonomer Cloud-Runner für das private PromptHub-
  Repository nachgewiesen.
- Nach dieser Bestandsaufnahme: `npm test` 75/75 bestanden; `npm run check`
  erfolgreich für 88 Dateien und Prompt-Library-Synchronität;
  `git diff --check` erfolgreich. Keine produktiven Einstellungen, Secrets,
  Kostenoptionen oder Repository-Sichtbarkeit geändert.

## CP-012 – OAuth-Rücksprung gegen externe Weiterleitung gehärtet

- Datum: 2026-11-15, 15:36 UTC
- Eine unabhängige Prüfung bestätigte einen ausnutzbaren Open Redirect:
  `returnTo=//example.org/...` wurde beim OAuth-Start gespeichert und nach
  erfolgreichem Callback unverändert als `Location` ausgegeben. Die Reproduktion
  erfolgte lokal mit einem Mock-GitHub-Transport; es gab keinen externen Login.
- `safeLocalRedirectPath` akzeptiert nur normalisierte relative Same-Origin-
  Pfade. Die Prüfung erfolgt beim Start, erneut beim Callback und nochmals vor
  dem `Location`-Header im HTTP-Handler. Ungültige Werte fallen auf `/` zurück.
- Regressionstests decken protokollrelative und absolute Ziele, Backslashes,
  URL-normalisierte `%2e%2e`-Pfade, rohe CR/LF-Zeichen, gültige interne Ziele,
  manipulierten OAuth-State, bösartige Auth-Adapter-Antworten sowie encodierte
  Slash-/Backslash-Sequenzen ab. Eine zweite unabhängige Prüfung gab den Fix
  frei; es wurden keine Dateien durch Reviewer-Agenten verändert.
- Nachweis: `npm test` 79/79 bestanden; `npm run check` erfolgreich für 88
  Dateien und synchronisierte Prompt-Library; `npm run demo` beendete einen
  Mock-Auftrag mit `succeeded` und sieben Ereignissen; `git diff --check`
  erfolgreich.
- Der Stand liegt auf dem lokalen Branch `codex/oauth-returnto-hardening` und ist
  noch nicht auf GitHub veröffentlicht. Für diesen Fix wurde kein GitHub-CI-
  Lauf und kein Produktionsdeployment ausgeführt. OAuth-Secrets,
  Cloudflare-Runtime und Repository-Einstellungen blieben unverändert.

## CP-013 – PWA-Update nach Nutzerentscheidung

- Datum: 2026-11-15, 16:10 UTC; Arbeitsbasis `6123cf79120f97f73dd11fb56ecf64def385b2ab`.
- Der Service Worker verwendet `prompthub-static-v4`, löscht nur ältere
  PromptHub-Caches, beansprucht Clients nach Aktivierung und umgeht API-,
  OAuth-, Health- sowie Nicht-GET-Anfragen. Statische GET-Assets bleiben bei
  Netzwerkausfall aus dem Cache verfügbar.
- Ein sichtbarer Update-Button erscheint erst, wenn eine neue Worker-Version
  installiert ist. Sie aktiviert sich nach Antippen und löst genau einen Reload
  aus; die erste Installation lädt nicht automatisch neu. Das neue
  `service-worker-client.mjs` wird für Offline-Start mitgecacht und erhält
  `text/javascript` im lokalen Server.
- Regressionstests prüfen Update-Race, einmaligen Reload, Erstinstallation,
  Offline-Fallback, Cache-Isolation, No-Cache-Header sowie den Ausschluss von
  API-, OAuth-, Health-, Cross-Origin- und Nicht-GET-Anfragen.
- Nachweis: `npm test` 82/82 bestanden; `npm run check` erfolgreich für 90
  Dateien; `git diff --check` erfolgreich; `npm run demo` endete mit
  `succeeded` und sieben Ereignissen.
- A17 bleibt teilweise offen, bis Installation und Aktualisierung auf einem
  echten iPhone geprüft wurden. Das Paket ist lokal als Commit `a1649e6` auf dem
  Branch `codex/oauth-returnto-hardening` gesichert, aber nicht gepusht oder
  nach Cloudflare Pages deployed. GitHub-PR #2 und
  Repository-Einstellungen wurden nicht verändert.

## CP-014 – Production- und Arbeitsstand getrennt dokumentiert

- Datum: 2026-11-15, 16:21 UTC.
- GitHub-Leseabfrage bestätigt weiterhin privates Repository, PR #2 offen auf
  Head `6123cf79120f97f73dd11fb56ecf64def385b2ab` und CI Run 11 erfolgreich
  ausschließlich für diesen Head. Die lokalen Commits `a1649e6` und `bc84f65`
  sind nicht auf GitHub.
- Der letzte dokumentierte Production-Commit `504477dc35dab908c8b3755550866bca071c72db`
  wurde direkt aus dem lokalen Git-Objekt geprüft: `src/pwa/sw.js` enthält
  Cache v3 und `index.html` kein Update-Steuerelement. Die PWA-Änderung aus CP-013
  ist nur lokal vorhanden.
- Eine erneute HTTP-Prüfung von `prompthub-studio.pages.dev` war in dieser
  Shell wegen eines Netzwerkfehlers nicht möglich. Der aktuelle Live-Zustand
  wird daher nicht neu behauptet. Sichtbarkeit, Deployment und Branch-Regeln
  wurden nicht verändert.
- Nachweis für den aktuellen Workspace: `npm test` 82/82 bestanden;
  `npm run check` erfolgreich für 90 Dateien; `git diff --check` erfolgreich.
