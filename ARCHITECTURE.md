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
  Token bleibt serverseitig.
- `src/control/github-control-plane.mjs`: Issues als durable Job-Datensätze,
  Kommentare als Append-only-Ereignisse, Contents API als Lease-/Checkpoint-
  Speicher mit Compare-and-Swap.
- `src/control/memory-control-plane.mjs`: deterministischer Testadapter; er darf
  nie als Produktionsmodus laufen.
- `src/auth/github-oauth.mjs`: OAuth-State, kurzlebige serverseitige Session,
  HttpOnly-Cookie und Allowlist.
- `src/api/server.mjs`: PWA-Auslieferung, JSON-API, Fehler- und Security-Header.
- `src/api/handler.mjs`: gemeinsame Web-Request-/Response-API für den lokalen
  Node-Adapter und den Cloudflare Worker; Same-Origin-Schutz kann serverlos
  verpflichtend aktiviert werden.
- `src/cloudflare/worker.mjs`: GitHub-Control-Plane, OAuth und API-Routen als
  Serverless-Worker. `src/cloudflare/kv-session-store.mjs` speichert kurzlebige
  Sessions und OAuth-State in einem begrenzten Workers-KV-Binding.
- `functions/[[path]].js`: Cloudflare-Pages-Adapter für den bestehenden Worker-
  Handler. `src/pwa/_routes.json` lässt nur API-, Auth- und Health-Routen durch
  Functions laufen; statische PWA-Anfragen bleiben auf dem kostenlosen Asset-Pfad.
- `wrangler.toml`: Pages-Build-Ausgabe `src/pwa`; das vorherige Workers-Static-
  Assets-Profil bleibt in `wrangler.worker.toml` verfügbar.
- `src/runner/runner.mjs`: Polling, Claim, Lease, Heartbeats, Checkpoints,
  Resume, sauberes Stoppen und nicht-blockierende Erfassung verifizierter
  Abschlussbelege.
- `src/runner/executor.mjs`: enger Adapter für ein explizit konfiguriertes
  Codex-Binary; keine Shell und keine aus dem Job übernommene Kommandozeile.
- `src/runner/worktree.mjs`: validierte Git-Worktrees je Auftrag.
- `src/pwa/`: statische PWA ohne Geheimnisse.
- `src/projects/`: read-only Repository-Inventar, private Control-Repo-Registry,
  getrennte Projektablage, reversible Verknüpfung, CAS-Read-modify-write und
  Datenlösch-Gate. Verifizierte Job-Ergebnisse bleiben projektbezogen.
- `src/knowledge/error-learning.mjs`: projektbezogene Symptome, Hypothesen und
  menschlich bestätigte Ursachen. Runner-Belege werden gegen terminale
  Control-Plane-Ergebnisse geprüft; Speicherung ist versioniert, begrenzt und
  CAS-geschützt.
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

Ein Auftrag ist ein GitHub Issue im konfigurierten Control-Repository. Das Issue
enthält nur Titel, Beschreibung und nicht-sensitive Metadaten. Labels sind
`prompthub:queued`, `prompthub:running`, `prompthub:awaiting-approval`,
`prompthub:succeeded`, `prompthub:failed`, `prompthub:paused` und
`prompthub:stale`. Kommentare tragen strukturierte, geheimnisfreie Ereignisse.

Die Datei `.prompthub/active-jobs.json` wird über die GitHub Contents API mit
dem zuletzt gelesenen Blob-SHA aktualisiert. Ein konkurrierendes Update mit
demselben SHA muss von GitHub abgelehnt und neu bewertet werden. Damit gilt die
Grenze von zwei aktiven Jobs unabhängig von einer einzelnen KI-Entscheidung.
Lease-Ablauf macht einen Runner-Ausfall sichtbar und erlaubt kontrollierte
Wiederaufnahme.

## Job- und Runner-Fluss

1. PWA sendet eine Aufgabe an `POST /api/jobs`.
2. API validiert Session, Eingabegröße und erlaubtes Projekt und legt das Issue
   mit `prompthub:queued` an.
3. Runner listet nur queued Issues, versucht atomar eine Lease zu erwerben und
   markiert den Job running.
4. Runner erstellt einen isolierten Worktree, schreibt `started` und sendet
   Heartbeats. Der tatsächliche Executor ist explizit konfiguriert.
5. Checkpoints enthalten nur Phase, Commit/Worktree-Referenz, Zeit und Ergebnis-
   Zusammenfassung. Secrets und vollständige Prozessumgebungen bleiben lokal.
6. Pflichtprüfungen müssen erfolgreich sein. Erst danach wird `succeeded`
   gesetzt; sonst `failed` oder `awaiting_approval`.
7. Bei Prozessabbruch bleibt der letzte Checkpoint erhalten. Ein neuer Runner
   darf nach Lease-Ablauf genau ab diesem Zustand fortsetzen.

## Zustandsinvarianten

- `succeeded` ist nur mit `required_checks.passed = true` gültig.
- `running` braucht einen aktiven Lease und frischen Heartbeat.
- Ein Job kann nur aus `queued`, abgelaufenen `running`-Leases oder einem
  dokumentierten Resume-Zustand gestartet werden.
- Ein unklarer Lease-/Commit-Zustand wird `stale` und wartet auf Freigabe.
- Kein Status enthält einen Prozentfortschritt, wenn dafür kein Messwert existiert.

## Abhängigkeiten und Grenzen

Der MVP verwendet Node-Built-ins. GitHub ist ein erforderlicher externer Dienst
für den Produktions-Control-Plane-Modus. Eine konkrete Codex-CLI, ein HTTPS-Host
und GitHub-OAuth-Credentials sind Betriebs-Konfiguration, keine hart codierten
Abhängigkeiten. Fehlen sie, meldet das System `not_configured` statt Erfolg.

