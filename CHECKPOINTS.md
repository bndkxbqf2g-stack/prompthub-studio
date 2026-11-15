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

## CP-015 – A14-Freigabe-Gate geprüft und Status korrigiert

- Datum: 2026-11-15, 16:42 UTC.
- Eine unabhängige, ausschließlich lesende Prüfung bestätigte, dass
  `KnowledgeStore.adoptStrategy()` bei kritischen Strategien jeden nichtleeren
  `approvedBy`-Text akzeptiert und `evidenceRefs` nur als freie Strings speichert.
  Die Anzahl von zwei Referenzen belegt keine tatsächlichen Test- oder CI-
  Ergebnisse.
- `KnowledgeStore` wird derzeit nur von `test/knowledge-recovery.test.mjs`
  importiert und ist nicht mit der Produktions-App verbunden. Der Fehler ist
  deshalb eine unsichere vorbereitete Kontrollkomponente, kein nachgewiesener
  Produktionspfad.
- A14 wurde in `ACCEPTANCE_CRITERIA.md` auf `teilweise` gesetzt. Es wurden keine
  Freigabe-Gates oder Sicherheitsregeln verändert; deren Korrektur benötigt die
  vorgeschriebene menschliche Freigabe und unabhängige Prüfung.
- Nachweis: `npm test` 82/82 bestanden; `npm run check` erfolgreich für 90
  Dateien; `git diff --check` erfolgreich.
- GitHub bestätigt weiterhin `private`. Ein Browser-Schreibzugang ist in dieser
  Sitzung nicht verfügbar; Credential Manager und GitHub-Connector stellten
  keinen nutzbaren Einstellungs-Schreibweg bereit. Es gab keine Remoteänderung.

## CP-016 – A14-Freigabe-Gate implementiert und unabhängig geprüft

- Datum: 2026-11-15, 17:20 UTC.
- Die unsicheren freien Strategie-Evidenz- und `approvedBy`-Methoden aus
  `KnowledgeStore` wurden entfernt. `StrategyLearningEngine` ist in Node- und
  Cloudflare-Laufzeit sowie über die authentifizierte Projekt-API eingebunden.
- Die Approver-Identität wird aus der serverseitigen Sitzung gelesen. Kritische
  Freigaben verlangen `provider: "github"`, sind für lokale oder unmarkierte
  Sessions gesperrt und ignorieren vom Client gelieferte Identitäts- und
  Authentifizierungsfelder.
- GitHub-Nachweise sind auf eine gemergte PR desselben Repositories, passenden
  PR-/Workflow-Head, erfolgreich abgeschlossenen Run und erfolgreichen Job
  `test` gebunden. Unvollständige Job-, Datei- oder Review-Seiten werden
  bei der Adoption abgewiesen. Eine Dateiliste muss vollständig, valide und
  nicht leer sein. Nur PWA-Styles und statische PWA-Assets gelten als
  unkritisch; unbekannte und funktionale Pfade lösen das kritische Gate aus.
- Kritische Übernahmen benötigen eine vollständige aktuelle Review-Liste mit
  unabhängigem APPROVED-Review desselben Heads, eine exakte Bestätigungsphrase
  und einen angemeldeten Approver, der weder Strategie-Proposer noch PR-Autor
  ist. Evidenz wird im CAS-Update erneut geprüft; neuere Review-Status,
  Dismissals und veraltete CI-Nachweise zählen nicht als Freigabe.
- Regressionen: `test/strategy-learning.test.mjs`, `test/auth.test.mjs` und
  `test/cloudflare-worker.test.mjs` decken Evidenzbindung, vollständige
  Auflistungen, kritische Pfade, unabhängige Reviews, Dismissals, Provider- und
  Session-Gates ab.
- Unabhängige, ausschließlich lesende Prüfung: keine kritischen, hohen oder
  mittleren Befunde; als niedriger Hinweis bleibt, dass Sessionstores den
  Provider-Wert technisch entgegennehmen. Im Produktionspfad setzt ihn nur
  `GitHubOAuth` nach erfolgreichem OAuth-Callback; die API erzwingt den
  Provider zusätzlich. Die Prüfung bestätigte die Regressionen und änderte
  keine Dateien.
- Nachweis: gezielte A14/Auth-Tests 17/17 bestanden; `npm test` 94/94
  bestanden; `npm run check` erfolgreich für 92 Dateien und synchronisierte
  Prompt-Bibliothek; `git diff --check` bestanden. Implementierungs-Commit:
  `4e71d0e` (lokal, nicht gepusht).
- Abnahme A14 bleibt teilweise: echte GitHub-PR-/Review-/Actions-Nachweise und
  eine PWA-Verwaltung der Strategiebewertungen sind noch nicht live abgenommen.
- Der A14-Fix wurde lokal ausgeführt und geprüft. Es erfolgten kein Push,
  Deployment oder Änderung der GitHub-Repository-Einstellungen.

## CP-017 – A14-PWA-Verwaltung und Projektansichten

- Datum: 2026-11-15, 17:43 UTC.
- Die iPhone-PWA kann Strategiebewertungen projektbezogen erfassen und anzeigen.
  Freigaben kritischer Strategien werden nur bei passender GitHub-Sitzung und
  vollständigen Review-/CI-Nachweisen angeboten; der Server prüft Nachweise
  erneut. Gemessene CI-Ergebnisse werden nicht als kausale Wirksamkeit ausgegeben.
- Job- und Fehlerhistorie-Ansichten laden nur Daten des ausgewählten Projekts.
  Antworten aus inzwischen verlassenen Projekten werden ignoriert. Ladefehler
  und erfolgreich leere Zustände werden getrennt dargestellt. Felder für
  Fehlerursachenbestätigungen haben zugeordnete barrierefreie Beschriftungen.
- Die erste unabhängige UI-Prüfung fand einen mittleren Befund zu verspäteten
  Antworten bei Projektwechseln sowie einen niedrigen Befund zu unbeschrifteten
  Job-ID-Feldern. Beide wurden behoben. Eine erneute unabhängige Prüfung meldete
  keine konkreten Befunde und bestätigte den Projektfilter, die Antwort-Guards,
  die Zustandsanzeigen, die Beschriftungen und das Strategie-Freigabe-Gate.
- Regressionen: `test/pwa-strategy.test.mjs` prüft die PWA-Freigabe und
  Projektwechsel-Guards; `test/api-projects.test.mjs` prüft den API-Projektfilter.
  Die unabhängige Prüfung meldete 24/24 gezielte Tests bestanden.
- Nachweis: `npm test` 103/103 bestanden; `npm run check` erfolgreich für
  94 Dateien und synchronisierte Prompt-Bibliothek; `git diff --check` bestanden.
  Paket-Commit: `46711f0` (lokal, nicht gepusht).
- A14 bleibt teilweise abgenommen, da reale GitHub-PR-/Review-/Actions-Belege
  und produktive Control-API-Konfiguration noch fehlen. Es erfolgten kein Push,
  Deployment oder Änderungen an externen GitHub-/Cloudflare-Einstellungen.

## CP-018 – lokale HTTP- und Runner-Demonstration

- Datum: 2026-11-15, 17:48 UTC.
- `npm run demo` erzeugte im isolierten Memory-Modus den Auftrag
  `job_4883cfd5-d035-47ef-b9de-d0bcce8095f7`. Der geskriptete Executor bestand
  den Demo-Pflichtcheck; der Job endete mit `succeeded` und sieben Ereignissen.
  Dies belegt die lokale Control-Plane-/Runner-Demo, nicht die Codex-CLI oder
  einen echten Mac-/Cloud-Runner.
- `src/server.mjs` wurde auf `127.0.0.1:18787` gestartet. `/`,
  `/manifest.webmanifest`, `/app-icon-source.png`, `/healthz` und `/api/me`
  lieferten HTTP 200. Security-Header einschließlich CSP waren gesetzt; die
  lokale Sitzung gab keinen Token zurück. `/healthz` meldete
  `runner_inbound_port:false`, `runner_status:not_observed` und
  `runner_configured:false`.
- Der Server wurde beendet und danach bestätigt, dass auf Port 18787 kein
  Listener verblieb.
- Nachweis: `npm test` 103/103 bestanden; `npm run check` erfolgreich für
  94 Dateien und synchronisierte Prompt-Bibliothek; `git diff --check` bestanden.
- Die GitHub-Repository-Metadaten wurden schreibgeschützt erneut abgerufen und
  melden weiterhin `visibility: private`. Der Cloud Browser bleibt nicht
  verbunden; die bereits genehmigte Sichtbarkeitsänderung und Branch-Regel
  wurden nicht ausgeführt. Kein Push, Deployment oder Kostenwechsel.

## CP-019 – GitHub-Schreibzugriff und Pflichtcheck wiederhergestellt

- Datum: 2026-11-15, 18:22 UTC.
- Diagnose: lokale Git-Metadaten waren durch die Sandbox blockiert; der erste
  Git-Netzwerkversuch scheiterte ebenfalls in der eingeschränkten Umgebung.
  Mit gezielter Rechteausweitung für die nötigen Git-Befehle, per-Befehl
  `safe.directory` und dem bereits angemeldeten Git Credential Manager gelang
  der Dry-Run und anschließend der normale Push. Die globale Git-Konfiguration
  blieb unverändert. Credential-Ausgaben und Token wurden nicht offengelegt.
- GitHub bestätigte für den vorhandenen Credential-Manager-Zugang
  `admin=true` und `push=true`. Das Quell-Repository
  `bndkxbqf2g-stack/prompthub-studio` wurde auf ausdrückliche Nutzeranweisung
  öffentlich gestellt; die Repository-API bestätigte HTTP 200 und anschließend
  `visibility=public`. Kein bezahlter Plan und kein kostenpflichtiger Dienst
  wurde aktiviert.
- Die zuvor freigegebene Branch-Regel wurde für `main` gesetzt und erneut
  ausgelesen: erforderlicher Check `test`, `strict=true`, Admin-Enforcement.
  GitHub Free konnte die Regel nach der Sichtbarkeitsänderung bereitstellen.
  Die Regel verlangt keinen PR und beschränkt direkte Pushes nicht; weitere
  Branch-Schutzoptionen wurden nicht verändert.
- Feature-Branch `codex/oauth-returnto-hardening` wurde auf Commit
  `0a9e105641a17db91988c6848778b62cafbbcd40` gepusht. PR #2 bleibt offen und
  ungemergt. Run 13 (`43744475969`) war für diesen damaligen Head erfolgreich.
  Nach dem Dokumentations-Commit `d45d1514656ce120da54e97de5e02f7ee68db288`
  bestanden auch GitHub Actions Run 14 (Push, `43746180556`) und Run 15 (PR,
  `43746186693`) vollständig; Job `test` und alle Schritte waren erfolgreich.
- Cloudflare-Schreibzugriff bleibt nicht verfügbar: `gh` und `wrangler` sind
  nicht installiert, Cloudflare-Token-Umgebungsvariablen fehlen und der
  Cloud-Browser ist nicht verbunden. Es wurde keine Cloudflare-Änderung,
  kein Deployment und keine Ressource angelegt. Minimale sichere Optionen,
  Rechteumfang und Wiederherstellungsweg sind in `CLOUDFLARE_OPERATIONS.md`
  dokumentiert. Kontobilling bleibt ungeprüft; es wurde kein Tarif aktiviert.
- Dokumentation aktualisiert: `README.md`, `ACCEPTANCE_CRITERIA.md`,
  `CLOUD_COST_RULES.md`, `CLOUDFLARE_OPERATIONS.md`, `DEVELOPMENT_PLAN.md` und
  `OPERATIONS.md`.
- Pflichtnachweis vor dem Checkpoint: `npm test` 103/103 bestanden;
  `npm run check` bestanden (94 Dateien, Prompt-Library synchron);
  `git diff --check` bestanden.

## CP-020 – GitHub Pages geprüft, Cloudflare-Builds pausiert

- Datum: 2026-11-15 18:50 UTC.
- Auf Nutzerwunsch wurde im Cloudflare-Dashboard die automatische Production-
  Bereitstellung deaktiviert. Preview-Deployments stehen auf `None`; beides
  wurde in den gespeicherten Projekteinstellungen erneut angezeigt. Das letzte
  Deployment und das Cloudflare-Pages-Projekt wurden nicht gelöscht; die alte
  Adresse bleibt erreichbar. Kein kostenpflichtiger Tarif wurde aktiviert.
- GitHub Pages ist für `bndkxbqf2g-stack/prompthub-studio` auf `main`/`/(root)`
  aktiv. Der Repository-Root liefert eine README-Seite; die PWA-HTML ist unter
  `https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/` erreichbar.
  Die Browseransicht zeigte dort nur die ungestaltete HTML-Hülle. Codeprüfung
  bestätigte Root-absolute Pfade, die am Repository-Unterpfad scheitern.
  GitHub Pages stellt statische Dateien, aber keine serverseitige Control API
  bereit.
- Commit `9938c58499eaf0b28362c611e7016b226847d378` auf PR #2 stellt PWA-Assets,
  Manifest-Start-/Scope und Service-Worker-Registrierung auf relative Pfade um,
  erhöht die Cache-Version und ergänzt einen Regressionstest für den
  GitHub-Pages-Unterpfad. PR #2 ist offen und nicht gemergt; der Fix ist noch
  nicht live.
- `npm test`: 104/104 bestanden. Der erste Lauf deckte eine veraltete
  Cacheversions-Assertion im bestehenden PWA-Test auf; der Test wurde auf v6
  aktualisiert und der vollständige zweite Lauf bestand. `npm run check`
  bestand (94 Dateien, Prompt-Library synchron); `git diff --check` bestand.
  GitHub Actions Run 17 (`43748927468`) bestand für den Commit oben: Pflichtjob
  `test` und alle Schritte erfolgreich.
- Die Control API bleibt mangels Backend-Konfiguration nicht betriebsbereit.

## CP-021 – PR #2 gemergt und GitHub-Pages-PWA verifiziert

- Datum: 2026-11-15, 19:08 UTC.
- PR #2 wurde mit 14 Commits in `main` gemergt. GitHub zeigt den PR als
  erfolgreich geschlossen; Merge-Commit: `c3d479a7676a143ebf4c6ad8448651e162bb9ea3`.
  Die zwei PR-Checks waren erfolgreich. GitHub Actions Run 19
  (`43749169752`) bestand für den PR-Head
  `36ba10a4166bb365e6fcc8d06b443a2d77118d35`; der Merge-Commit hat keinen
  separaten Actions-Run.
- GitHub bestätigt das öffentliche Repository und `allow_auto_merge=true`.
  Der Merge von PR #2 erfolgte manuell, nachdem die Pflichtchecks erfolgreich
  waren. Auto-Merge kann für zukünftige geeignete PRs verwendet werden. Die
  bereits verifizierte `main`-Regel verlangt `test`, `strict=true` und erzwingt
  sie auch für Administratoren; sie erzwingt keinen PR und sperrt direkte
  Pushes nicht.
- Nach dem Merge wurde
  `https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/` im Browser
  geladen. Das gerenderte UI verwendet den korrekten Repository-Unterpfad;
  Stylesheet und relative Icon-/Manifest-URLs sind aufgelöst. Es gab keine
  Browser-Konsolenfehler. Die Oberfläche meldet weiterhin, dass die Control
  API nicht erreichbar ist. GitHub Pages hostet nur statische Dateien; dies
  ist kein Nachweis für OAuth, die API, Offline-Start oder iPhone-Installation.
- Cloudflare Pages wurde nicht gelöscht oder neu veröffentlicht; automatische
  Production- und Preview-Deployments bleiben pausiert. Es wurden keine
  kostenpflichtigen Dienste aktiviert. Kontobilling bleibt ungeprüft.
- Dokumentation auf den gemergten und live geprüften Stand gebracht:
  `README.md`, `ACCEPTANCE_CRITERIA.md`, `DEVELOPMENT_PLAN.md` und
  `OPERATIONS.md`. A17 bleibt teilweise offen; die technische Erstabnahme ist
  nicht bestanden, solange Control API/OAuth, Runner, iPhone-Prüfung und weitere
  externe Nachweise fehlen.
- Pflichtprüfungen nach den Statusänderungen: `npm test` 104/104 bestanden;
  `npm run check` erfolgreich (94 Dateien, Prompt-Library synchron);
  `git diff --check` erfolgreich. Es wurden keine Tests oder Regeln geändert.

## CP-022 – kostenfreie Hosting-Alternativen für die Control API geprüft

- Datum: 2026-11-15, 19:29 UTC.
- GitHub Pages ist live als statische PWA-Hülle geprüft; die Control API ist
  nicht erreichbar. Die offizielle GitHub-Dokumentation bestätigt, dass Pages
  keine serverseitigen Sprachen ausführt.
- Netlify Free ist als mögliche Alternative recherchiert, nicht eingerichtet:
  300 Credits/Monat mit hartem Limit, ohne Auto-Recharge; bei Erreichen des
  Teamlimits pausieren die Sites, bis das Kontingent zurückgesetzt wird. Der
  Tarif enthält Functions und Blobs. Functions rechnen Compute mit 10
  Credits/GB-Stunde, Bandbreite mit 20 Credits/GB und Webrequests mit 2
  Credits/10.000 Requests ab. Das sind Anbieterangaben, keine Verbrauchsmessung.
- Netlify Blobs kann starke Konsistenz verwenden, benötigt aber das SDK
  `@netlify/blobs`. Site-weite Stores teilen Daten zwischen Deploy-Kontexten;
  daher müssen Previewzugriffe isoliert/deaktiviert und Sitzungslaufzeiten
  serverseitig begrenzt werden. Diese Auth-/Session-Änderung ist kritisch und
  wurde nicht implementiert.
- Vercel Hobby wurde als zweite Möglichkeit verglichen: kostenlose Limits und
  Pause bei Überschreitung, aber nur für persönliche, nicht-kommerzielle
  Nutzung. Netlify bleibt bloß Kandidat; keine Anbieterentscheidung wurde
  umgesetzt.
- Erforderliche Vorbedingungen: ausdrückliche Nutzerfreigabe für die
  Netlify-Verknüpfung und die kritische Session-Store-Änderung, Ausnahme für die
  neue Runtime-Abhängigkeit sowie unabhängige Sicherheitsprüfung. Keine
  Anbieter-App, Secrets, Kostenressource oder Deployment wurden erstellt.
- Dokumentation ergänzt: `HOSTING_OPTIONS.md`, mit Verweisen in `README.md` und
  `DEVELOPMENT_PLAN.md`. Cloudflare-Builds bleiben pausiert; GitHub Pages bleibt
  statisch; die technische Gesamt-Abnahme ist nicht bestanden.
- Prüfungen: `npm test` 104/104 bestanden; `npm run check` erfolgreich
  (95 Dateien, Prompt-Library synchron); `git diff --check` erfolgreich.
  Keine Laufzeitabhängigkeit und kein Test wurden geändert.

## CP-023 – Auto-Merge-Autorisierung umgesetzt und nachgewiesen

- Datum: 2026-11-15, 19:50 UTC.
- Die ausdrückliche Nutzerautorisierung für Auto-Merge zukünftiger PRs ist in
  `OPERATIONS.md` dokumentiert. Die Regel hält `test`, unabhängige Reviews und
  erforderliche menschliche Freigaben aufrecht und weist darauf hin, dass
  direkte Pushes durch die aktuelle `main`-Regel nicht gesperrt sind.
- PR #5 wurde für Auto-Merge vorgemerkt und nach bestandenem Pflichtjob
  `test` automatisch per Squash integriert. GitHub Actions Run 28
  (`43754476641`) bestand für PR-Head
  `047ab9a5eb2f323706a087ef7b233edad61a68fe`; Merge-Commit:
  `ab508221f681d9700a09b275b627dd309e583de2`. GitHub-Readback bestätigte
  `merged=true` und `auto_merge.merge_method=squash`.
- Pflichtprüfungen lokal: `npm test` 104/104 bestanden; `npm run check`
  erfolgreich (95 Dateien, Prompt-Library synchron); `git diff --check`
  erfolgreich. Die Änderung ist dokumentarisch; Runtime, Tests und Kosten-
  beziehungsweise Deployment-Einstellungen wurden nicht verändert.

## CP-024 – CI prüft den tatsächlichen Patch auf Whitespace

- Datum: 2026-11-15, 19:57 UTC.
- `git diff --check` lief zuvor ohne Vergleichsbereich nach einem sauberen
  Checkout und prüfte dadurch nicht die PR-Änderungen. Der Workflow lädt jetzt
  die vollständige Git-Historie und prüft `base...head` für PRs sowie
  `before...head` für normale Pushes. Ein Regressionstest schützt beide Pfade.
- PR #7, Head `ac0c376e7ee63fc7f02a4de38d8d0e94277f767b`: GitHub Actions Run 34
  (`43755283240`) bestand. Der Job `test` führte den Schritt
  `Check pull request patch whitespace` erfolgreich aus; der Push-spezifische
  Schritt war beim PR-Ereignis erwartungsgemäß übersprungen.
- Pflichtprüfungen lokal: `npm test` 105/105 bestanden; `npm run check`
  erfolgreich (96 Dateien, Prompt-Library synchron); `git diff --check`
  erfolgreich. Keine Pflichtprüfung wurde abgeschwächt; ein Regressionstest
  wurde ergänzt.
