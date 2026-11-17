# PromptHub Studio – Architektur

## Laufzeitmodell

PromptHub Studio trennt die statische PWA, Control API, versionierte GitHub-
Control-Plane, Projektadapter und austauschbare Runner:

```text
iPhone PWA --HTTPS--> serverless Control API --GitHub API--> privates Control-Repo
       |                       |                                  |
       |                       +--> Projekt-/Prompt-/Wissensdienste  Jobs/CAS/CI
       |                                                          |
       +---- statische Assets                                     v
                                             Runner-Provider (0..2 aktive Jobs)
                                               /                \\
                                      lokaler Runner     späterer Cloud-Runner
```

Control Plane und Codex-Ausführung sind getrennt. Statische/serverlose
Cloud-Auslieferung ist der Zielpfad; ein Runner kann fehlen, während PWA und
Auftragsübersicht verfügbar bleiben. Ein Anbieter wird erst nach Prüfung des
0-€-Kontingents und ausdrücklicher Deployment-Freigabe aktiviert. Der lokale
Runner benötigt keinen eingehenden Port. Für lokale Entwicklung bindet die API
nur an `127.0.0.1`.

## Module

- `src/config.mjs`: validiert Umgebungsvariablen, sichere Defaults und
  Produktionsverbote.
- `src/domain/job.mjs`: Zustandsmaschine, normalisierte Aufträge und
  geheimnisfreie Ereignisse.
- `src/control/github-client.mjs`: minimale GitHub-REST-Transport-Schicht,
  Token bleibt serverseitig; vollständige Job-State-Aufzählung nutzt bei der
  Contents-API-Grenze eine Git-Tree-Pfadabfrage.
- `src/control/github-control-plane.mjs`: GitHub-Issues als Status- und
  Ereignisprojektion; der versionierte CAS-Jobledger ist die maßgebliche Quelle.
- `src/control/github-job-state-store.mjs`: pro Job ein versionierter
  Statusdatensatz in `.prompthub/jobs/`, mit GitHub-Blob-SHA-CAS,
  monotoner Revision und Runner-Fencing-Generation.
- `src/control/github-lease-store.mjs`: globale Lease-Datei mit CAS und fester
  Obergrenze von zwei aktiven Jobs.
- `src/control/memory-control-plane.mjs`: deterministischer Testadapter; er darf
  nie als Produktionsmodus laufen.
- `src/auth/github-oauth.mjs`: OAuth-State, kurzlebige serverseitige Session
  mit expliziter Provider-Kennung, HttpOnly-Cookie und Allowlist.
- `src/auth/netlify-blob-stores.mjs`: serverseitige Netlify-Blobs-Sessions mit
  AES-256-GCM-Anwendungsverschlüsselung, Ablaufprüfung und begrenzter
  Bereinigung; OAuth-States werden per stark konsistentem ETag-CAS einmalig
  konsumiert.
- `src/application.mjs`: gemeinsame Service-Erzeugung für lokale Node- und
  serverlose Netlify-Runtimes.
- `src/api/server.mjs`: PWA-Auslieferung, JSON-API, Fehler- und Security-Header.
- `src/api/handler.mjs`: gemeinsame Web-Request-/Response-API für den lokalen
  Node-Adapter und die Netlify Function; Same-Origin-Schutz kann serverlos
  verpflichtend aktiviert werden.
- `netlify/functions/prompthub.mjs`: Produktions-API für `/api/*`, `/auth/*`
  und `/healthz`; verweigert andere Deploy-Kontexte und prüft den Host gegen
  `PROMPTHUB_PUBLIC_ORIGIN`.
- `src/hosting/netlify-quota-gate.mjs`: Free-Plan- und Credit-Schwellenprüfung.
  Ohne frischen, autoritativen Teamverbrauch bleibt die Jobannahme gesperrt.
- `netlify.toml`: statische PWA aus `src/pwa`, Netlify Functions und ein
  Build-Gate mit `npm test` und `npm run check`.
- `src/cloudflare/worker.mjs`: eigenständige Pages-Functions-Control-Plane mit
  GitHub-OAuth und gemeinsamer API. Sie bleibt fail-closed und ist nicht live
  aktiviert; aktuelle Hosting-Priorität ist Cloudflare, vorbehaltlich aller
  Sicherheits-, Quoten- und Produktionsfreigaben.
- `src/cloudflare/d1-session-store.mjs` und
  `migrations/0001_auth_store.sql`: D1-Authspeicher mit HKDF-getrennten
  AES-256-GCM-Schlüsseln, verschlüsselten GitHub-Sitzungen, gehashten und
  verschlüsselten OAuth-States sowie atomarem bedingtem
  `DELETE … RETURNING`. Der Adapter existiert auf dem Feature-Branch. Wrangler-
  D1-Binding, Datenbank, Secrets und Live-D1-Nachweis fehlen; ein KV-Fallback
  ist absichtlich nicht vorhanden.
- `functions/[[path]].js`: Cloudflare-Pages-Adapter für den bestehenden Worker-
  Handler (historisch; nicht für Netlify-Deployments verwendet).
- `wrangler.toml`: Pages-Build-Ausgabe `src/pwa`; ein `AUTH_DB`-Binding ist
  noch nicht konfiguriert. Das vorherige Workers-Static-
  Assets-Profil bleibt in `wrangler.worker.toml` (historische Konfiguration).
- `src/runner/runner.mjs`: Polling, Claim, Lease, Heartbeats, Checkpoints,
  Resume, sauberes Stoppen und nicht-blockierende Erfassung verifizierter
  Abschlussbelege.
- `src/runner/executor.mjs`: enger Adapter für ein explizit konfiguriertes
  Codex-Binary; keine Shell und keine aus dem Job übernommene Kommandozeile.
  `codex exec --json` ist der Standard. Der Parser liest ausschließlich
  genau ein `turn.completed.usage`, verwirft übrige JSONL-Rohinhalte innerhalb
  fester Byte-, Zeilen- und Eventlimits und leitet nicht gelieferte
  Modellaufrufzahlen nicht ab.
- `src/runner/worktree.mjs`: validierte Git-Worktrees je Auftrag.
- `src/pwa/`: statische PWA ohne Geheimnisse.
- `src/projects/`: read-only Repository-Inventar, private Control-Repo-Registry,
  getrennte Projektablage, reversible Verknüpfung, CAS-Read-modify-write und
  Datenlösch-Gate. Verifizierte Job-Ergebnisse bleiben projektbezogen.
- `src/knowledge/error-learning.mjs`: projektbezogene Symptome, Hypothesen und
  menschlich bestätigte Ursachen. Runner-Belege werden gegen terminale
  Control-Plane-Ergebnisse geprüft; Speicherung ist versioniert, begrenzt und
  CAS-geschützt.
- `src/knowledge/strategy-learning.mjs` und
  `ProjectService.verifyStrategyEvidence`: strategische Lerndatensätze sind an
  zusammengeführte PRs, denselben Workflow-Head, den bestandenen Pflichtjob
  `test` und vollständige geänderte Pfade gebunden. Kritische Übernahmen werden
  nur mit frischer unabhängiger GitHub-Review und authentifizierter menschlicher
  API-Freigabe gespeichert.
- `src/designer/`: mehrstufiger Prompt-Workflow, Versionen, sichere Freigabe und
  austauschbarer `IntelligenceProvider`; kostenfreier Fallback wird ausgewiesen.
- `src/designer/context-selector.mjs`: wählt aufgabenbezogene Projekt-Auszüge,
  behält sicherheitsrelevante Regelthemen bevorzugt bei und referenziert den
  versionierten Projektsnapshot. Der vollständige Projektregeltext muss vor
  Änderungen dennoch gelesen werden.
- `src/research/`: kuratierte Quellenbibliothek, sichere Suche, Dubletten-,
  Aktualitäts- und Konfliktprüfung.
- `src/metrics/`: tatsächliche Tokenwerte, Provider-Requests, Executor-Starts,
  Laufzeit, Wiederholungen und Pflichtcheck-Ergebnisse getrennt; fehlende Werte
  bleiben ausdrücklich nicht verfügbar. Das Fehlerdashboard zeigt die Quelle
  und Stichprobengrenze jeder Qualitätszahl.

## Effizienz und Wiederverwendung

Projektanalysen tragen `summary_schema_version`, Quell-Blob-SHAs und eine
Snapshot-Version. Der Prompt-Designer wählt begrenzte, aufgabenbezogene Auszüge
aus diesem Snapshot. Nur ein separat als kostenfrei verifizierter Anbieter darf
über einen fünfminütigen, auf 32 Einträge begrenzten In-Memory-Cache dedupliziert
werden. Cache-Treffer wiederverwenden ausschließlich Analyseergebnisse; sie
zählen Provider-Aufrufe und Token nicht doppelt. Nach Prozessneustart wird kein
Cachezustand behauptet.

Fehlerkontext ist auf fünf Hinweise je Projekt begrenzt. GitHub-CI prüft bis zu
fünf jüngste Runs und bei höchstens zwei fehlgeschlagenen Runs Job-/Schrittnamen
(je maximal 100 Jobs); vollständige Logs werden nicht kopiert. Eine bestätigte
Regression verlangt einen fehlgeschlagenen und später bestandenen namensgleichen
Pflichtcheck sowie menschliche Bestätigung, dass der Erfolgsjob dieselbe
Korrektur prüft. Gealterte Ergebnisbelege bleiben als Quelle referenziert, zählen
aber nicht als aktuell verifizierte Regression.
Runner-/Check-Ausgaben werden nur in-memory gegen eine feste Fehlerklassenliste
geprüft; persistiert werden Kategorien, Job-IDs und Checknamen, niemals Rohlogs.

## Durable Control Plane

Jeder Auftrag hat ein GitHub Issue im privaten Control-Repository und einen
kanonischen Datensatz `.prompthub/jobs/<job-id>.json`. Das Issue enthält keine
Secrets. Labels und Kommentare sind eine reparierbare Anzeige-/Auditprojektion;
Abfrage, Claim, Pause, Resume, Recovery und Abschluss lesen und ändern den
kanonischen Datensatz. Ein kaputter oder veralteter Issue-Status kann deshalb
keinen Auftrag claimbar machen.

Der Datensatz wird per GitHub Contents API mit dem zuletzt gelesenen Blob-SHA
geschrieben. Konflikte werden gegen den neuen Inhalt neu ausgewertet. Jede
erfolgreiche Änderung erhöht `revision`; Statuswechsel erhöhen zusätzlich
`status_revision`. Claims vergeben eine monotone `generation`, an die Runner-ID,
Leaseablauf, Heartbeat, Checkpoints und Abschluss gebunden sind. Eine ältere
Generation kann nach Lease-Verlust, Recovery und Resume keinen neuen Zustand
überschreiben. Wiederholte Abschlüsse derselben Generation sind idempotent.

`.prompthub/active-jobs.json` bleibt der globale CAS-Lease-Index. Er erzwingt
höchstens zwei aktive Jobs. Ein beschädigter, überfüllter oder fehlender
Lease-Index bei laufenden Ledger-Jobs sperrt Claim und Recovery, statt einen
Zustand zu erraten. Ein Legacy-Issue ohne Ledger wird als `stale` importiert und
benötigt menschliche Prüfung und Resume-Freigabe.

Der Lease-Datensatz enthält außerdem `jobs_initialized`. Vor dem ersten
kanonischen Jobzustand wird dieses Feld per CAS gesetzt. Fehlt das
Job-State-Verzeichnis danach, wird es als Datenverlust/unklarer Zustand behandelt
und Claim sowie Recovery stoppen. Nur ein noch nie initialisiertes, leeres
System darf ein fehlendes Verzeichnis als leer lesen. Nichtleere v1-Leases
werden nicht automatisch mit erfundenen Fencing-Generationen migriert.

Die GitHub-Contents-API begrenzt Verzeichnislisten auf 1.000 Dateien. Bei genau
dieser Antwortgröße wird der vollständige Pfad über die Git-Trees-API
aufgelöst; die gelisteten Statusdateien werden anschließend an derselben
Commit-SHA gelesen. Ungültige oder als `truncated` markierte Trees sperren
Claim und Recovery. Ein Schema-v1-Lease kann keine kanonische laufende
Generation sicher fencen: Heartbeat und Abschluss werden abgelehnt; Recovery
und neue Claims stoppen, bis der Zustand geprüft wurde. Ein leeres v1-Ledger
kann beim ersten neuen Claim sicher nach v2 migrieren.

Issue-Patches und Kommentare unterstützen keine gemeinsame Transaktion mit dem
Ledger. Sie werden nach dem kanonischen Commit geschrieben und im Runner-Recovery-
Zyklus anhand der Ledger-Revision nachgezogen. Bis zur Reparatur zeigt die PWA
den Ledger-Status; Issue-Labels werden nie für Ausführungsentscheidungen
verwendet. GitHub dokumentiert, dass parallele Änderungen an denselben
Contents-Dateien Konflikte liefern, während bedingte `PATCH`-Requests für
Issue-Projektionen nicht unterstützt werden. Ein älterer Projektionsschreiber
kann daher vorübergehend ein neueres Issue-Label überschreiben; Recovery stellt
den kanonischen Status wieder her. Ereigniskommentare können wiederholt
geschrieben werden: identische IDs werden beim Lesen dedupliziert,
gleichzeitige Schreiber können aber doppelte Kommentare hinterlassen. Daher
bleiben Ledger und dessen Completion-Datensatz die maßgebliche Quelle für
Status und Ergebnis.

## Job- und Runner-Fluss

1. PWA sendet eine Aufgabe an `POST /api/jobs`.
2. API validiert Session, Eingabegröße und erlaubtes Projekt und initialisiert
   Issue plus kanonischen Ledger.
3. Runner listet Ledger-Status `queued`, reserviert zuerst eine globale Lease
   per CAS und wechselt dann den Job mit einem fencing-gebundenen CAS auf
   `running`.
4. Runner erstellt einen isolierten Worktree und schreibt Heartbeats sowie
   Checkpoints mit derselben Generation. Der Executor ist explizit konfiguriert.
5. Checkpoints enthalten nur Phase, Commit/Worktree-Referenz, Zeit und Ergebnis-
   Zusammenfassung. Secrets und vollständige Prozessumgebungen bleiben lokal.
6. Pflichtprüfungen müssen erfolgreich sein. Ein CAS schreibt den terminalen
   Ledger-Zustand zuerst; anschließend werden Lease, Issue und Ereignisprojektion
   aktualisiert.
7. Bei Prozessabbruch bleibt der letzte Ledger-Checkpoint erhalten. Recovery
   markiert fehlende oder abgelaufene Leases als `stale`; Weiterarbeit erfordert
   explizite menschliche Resume-Freigabe.

## Zustandsinvarianten

- `succeeded` ist nur mit `required_checks.passed = true` gültig.
- `running` braucht übereinstimmende Runner-ID, Generation und nicht abgelaufene
  Ledger-/Lease-Zeitstempel.
- Statusentscheidungen werden per GitHub-Blob-SHA-CAS geschrieben; Issue-Labels
  und Kommentare sind nie Autorität für Claim oder Abschluss.
- Der Completion-Datensatz bindet Runner-ID, Generation und Pflichtcheckresultat.
- Ein Job kann nur aus `queued`, abgelaufenen `running`-Leases oder einem
  dokumentierten Resume-Zustand gestartet werden.
- Ein unklarer Lease-/Commit-Zustand wird `stale` und wartet auf Freigabe.
- Kein Status enthält einen Prozentfortschritt, wenn dafür kein Messwert existiert.

## Abhängigkeiten und Grenzen

Der MVP verwendet Node-Built-ins; die Netlify-Runtime hat zusätzlich die
serverseitige Abhängigkeit `@netlify/blobs` exakt auf `10.7.13` gepinnt, um die
bestehende Node-20-Kompatibilität zu erhalten. Das Paket wird nicht in die PWA
gebündelt. GitHub ist ein erforderlicher externer Dienst für den
Produktions-Control-Plane-Modus. Eine konkrete Codex-CLI, ein HTTPS-Host und
GitHub-OAuth-Credentials sind Betriebs-Konfiguration, keine hart codierten
Abhängigkeiten. Fehlen sie, meldet das System `not_configured` statt Erfolg.

