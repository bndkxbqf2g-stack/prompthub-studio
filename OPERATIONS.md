# PromptHub Studio – Betrieb

## Lokaler Start

```powershell
Copy-Item .env.example .env
npm test
npm run check
npm start
```

Die lokale API bindet standardmäßig an `127.0.0.1:8787`. Der Runner läuft in
einem separaten Prozess:

```powershell
npm run runner
```

Er benötigt für echte Arbeit ein konfiguriertes Control-Repository, Token,
Projekt-Allowlist und `CODEX_EXECUTABLE`. Ohne diese Werte bleibt er in einem
expliziten `not_configured`-Zustand. Der Testmodus verwendet nur den
Memory-Control-Plane-Adapter.

### Codex CLI unter Windows

Wenn `codex login status` mit `Could not find home directory` endet, kann
`CODEX_HOME` nur für den einzelnen CLI-Aufruf auf das bestehende
`%USERPROFILE%\.codex` zeigen. Das folgende Beispiel stellt einen bereits
gesetzten Wert wieder her und legt weder Zugangsdaten noch eine dauerhafte
Umgebungsvariable an:

```powershell
$codexHomePath = Join-Path $env:USERPROFILE '.codex'
if (-not (Test-Path -LiteralPath $codexHomePath -PathType Container)) {
  throw 'The Codex state directory does not exist.'
}
$hadCodexHome = Test-Path Env:CODEX_HOME
$previousCodexHome = $env:CODEX_HOME
try {
  $env:CODEX_HOME = $codexHomePath
  codex login status
}
finally {
  if ($hadCodexHome) {
    $env:CODEX_HOME = $previousCodexHome
  }
  else {
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
  }
}
```

`CODEX_HOME` ist eine unterstützte Codex-Variable und muss auf ein vorhandenes
Verzeichnis zeigen ([Umgebungsvariablen](https://learn.chatgpt.com/docs/config-file/environment-variables),
[Authentifizierung](https://learn.chatgpt.com/docs/auth?surface=cli)). Diese
Prüfung bestätigt nur den CLI-Login des aktuellen Hosts. Sie konfiguriert weder
den PromptHub-Runner noch einen Cloud-Executor. Zugangsdaten aus `auth.json`
werden weder kopiert noch in PromptHub gespeichert.

### Codex-Tokenmessung

Die Standardargumente verwenden `codex exec --json`. `ProcessExecutor` verarbeitet
aus dem JSONL-Strom ausschließlich nichtnegative Ganzzahlen aus
`turn.completed.usage`: Input-, Output-, Cache- und Reasoning-Tokens. Sonstige
JSONL-Rohinhalte werden verworfen; für `error`/`turn.failed` bleibt nur ein
generischer Diagnosehinweis; ein solches Fehlerereignis lässt den Executor auch
bei Prozess-Exitcode 0 fehlschlagen. Es wird genau ein gültiges Abschlussereignis als
Messung akzeptiert. Duplikate, fehlerhafte Zeilen oder Überschreiten von 4 MB,
10.000 Ereignissen beziehungsweise 1.000.000 Zeichen je Zeile machen die
Messung vollständig unbekannt. Nicht unterstützte Usage-Felder machen die
Messung ebenfalls unbekannt. Die Werte stammen aus der Ausgabe des lokal
konfigurierten Codex-CLI-Prozesses und sind nicht separat signiert. Cache- und
Reasoning-Werte werden nur angezeigt, wenn alle
einbezogenen Tokenmessungen diese Teilwerte enthalten. Summen außerhalb sicherer
Ganzzahlen bleiben unbekannt. Modellaufrufe bleiben unbekannt, weil dieses
Ereignis keine verlässliche Aufrufzahl enthält. Bei einem manuell gesetzten
`CODEX_ARGS_JSON` muss `--json` enthalten sein, damit der Executor Tokenwerte
messen kann. Fehlende oder ungültige Telemetrie bleibt `unbekannt`.

Die JSONL-Ausgabe und das `turn.completed.usage`-Beispiel sind in der
[offiziellen Codex-Dokumentation zum nicht-interaktiven Modus](https://learn.chatgpt.com/docs/non-interactive-mode#make-output-machine-readable)
dokumentiert. Der Parser folgt nur diesem dokumentierten Usage-Ereignis.

## Verifizierter Codex-Executor-Smoke

Am 2026-11-16 meldete `codex login status` nach einem prozesslokalen
`CODEX_HOME`-Override eine aktive ChatGPT-Sitzung. Ein echter Auftrag lief
anschließend über `ProcessExecutor` und `PromptHubRunner` in einem neu erzeugten
Git-Fixture: Codex änderte eine Quelldatei, der Node-Pflichtcheck bestand, der
Job wurde `succeeded`, vier Checkpoints wurden erfasst und der Lease danach
freigegeben. Der Test verwendete eine `MemoryControlPlane`, keinen
GitHub-Control-Plane-Adapter.

Die verwaltete Windows-Sandbox verweigerte zunächst den Zugriff auf die Codex-
SQLite-/App-Server-Zustandsdateien. Für den einmaligen Smoke wurde
`CODEX_SQLITE_HOME` auf das automatisch entfernte Temp-Verzeichnis gesetzt;
`CODEX_HOME` blieb der vorhandene Anmeldeordner. Der Prozess lief mit
`--ephemeral` und `--sandbox workspace-write`; eine äußere Prozessfreigabe war
für den Zugriff auf den vorhandenen CLI-Zustand nötig. Es wurden weder
Anmeldedaten kopiert noch dauerhafte Umgebungswerte oder Codex-Einstellungen
geändert. `CODEX_SQLITE_HOME` ist eine von Codex dokumentierte Variable für
SQLite-Zustand ([offizielle Umgebungsvariablen](https://learn.chatgpt.com/docs/config-file/environment-variables)).

Dieser einmalige Windows-Fixture-Smoke richtete keinen dauerhaften Runner ein
und belegt weder GitHub-Persistenz noch den Betrieb auf dem MacBook. Er lief vor
der JSONL-Telemetrieänderung; für diesen Auftrag bleiben Tokenwerte unbekannt.
Automatische JSONL-Erfassung und Speicherung sind durch deterministische Tests
abgedeckt. Ein erneuter echter Codex-Auftrag zur Beobachtung gelieferter
Tokenwerte ist noch nicht erfolgt. Modellaufrufzahlen bleiben auch dann
unbekannt, wenn Tokenwerte geliefert werden.

## PWA-Veröffentlichung

GitHub Pages ist der aktive statische PWA-Host:

https://bndkxbqf2g-stack.github.io/prompthub-studio/

Die PWA-Dateien liegen unter `/src/pwa/`; GitHub Pages bietet dort nur
statische Assets, keine Control API oder serverseitige Anmeldung. PR #2 wurde
mit dem Unterpfad-Fix gemergt. Nach Pages-Run 18 antworteten Startseite,
Manifest, App-Icon, Service Worker, App-Skript und Stylesheet live mit HTTP 200
und passenden Inhaltstypen; die PWA meldet weiterhin, dass die Control API nicht
erreichbar ist.

Main-Commit `bf5a15c1b8a4fc0f832e55aefcdc84bfa440c5a5` bestand Main-CI-Run 81
(`43770701922`) und GitHub-Pages-Run 21 (`43770701589`). PR #21 bestand PR-CI-
Run 80 (`43770627889`) auf beiden macOS-Architekturen und für `test`; GitHub
führte den Merge automatisch aus. Ein Browser-Smoke bei 390×844 zeigte die
Erklärung zur fehlenden Control API; ein Klick auf Aktualisieren erhielt den
Fehlerzustand, ohne Erfolg zu melden. Eine echte iPhone-Prüfung ist das nicht.
PR #30, Head `8581fdfd19c73b034702834f287e5a0af696b887`, bestand in Actions-
Runs `43780749466` und `43780772252` jeweils `macos-latest`, `macos-15-intel`
und `test`; GitHub Auto-Merge integrierte den PR als
`7058c1c10721ff661f30ccb26891bfca7d3d0982`. Dokumentations-PR #33, Head
`b7eee065c1ff259cab82324abc5c76bd888807b2`, bestand die Jobs `test`,
`macos-latest` und `macos-15-intel` in Runs `43783867866` und `43783879946` und
wurde als `792c96e3e8be2db849143b8420baea9c241f8eb2` gemergt. Main-CI-Run 117
(`43783987471`) und GitHub-Pages-Run 33 (`43783986387`) endeten erfolgreich auf
diesem Produktcode-Stand. Ein direkter HTTP-Smoke nach diesem Deployment war
nicht verfügbar; der Run bestätigt die erfolgreiche Pages-Veröffentlichung,
nicht iPhone-Installation oder Offline-/Update-Bedienung.
Dokumentations-PR #34, Head `8ba96a8fcbac80f722208914535dfff39460cc1c`, bestand
`test`, `macos-latest` und `macos-15-intel` in Runs `43784925947` und
`43784944320` und wurde automatisch als
`bb06cd93872860cfd88f89ec555bac0d2bdf1e83` gemergt. Ein Main-/Pages-Run und ein
direkter HTTPS-Smoke nach diesem Merge wurden in der aktuellen Prüfung nicht
unabhängig ausgelesen.

Cloudflare wird nicht mehr als Host verwendet. Das Pages-Projekt ist weiterhin
mit dem öffentlichen Quell-Repository verbunden, aber pausiert; die letzte
veröffentlichte Version unter https://prompthub-studio.pages.dev bleibt
erreichbar. Das Projekt ist nicht gelöscht. Der Nutzer hat seine Entfernung
angefragt; die gesonderte Bestätigung für die irreversible Projektlöschung
steht noch aus. `wrangler.toml` enthält weiterhin historische Pages-
Konfiguration; das Workers-Static-Assets-Profil liegt in
`wrangler.worker.toml`.

Die statische PWA-Hülle ist erreichbar. Die Control API antwortet mit HTTP 503,
bis ein Production-KV-Binding `SESSIONS`, die GitHub-OAuth-App, eine Login-
Allowlist und die dokumentierten serverseitigen Variablen/Secrets eingerichtet
sind. Der Pages-Runtime-Schalter `Fail closed` ist gespeichert und verifiziert.
Preview-Bereitstellungen wurden im Dashboard auf `None` gesetzt; nach dem
Browserausfall konnte diese Einstellung nicht erneut ausgelesen werden. Bei
einer späteren Aktivierung wären Preview-Adressen öffentlich; dafür keine
Preview-Secrets setzen und zuvor Cloudflare Access konfigurieren.

Der authentifizierte Branch-Schutz-Readback vom 2026-11-16 bestätigt für `main`
den erforderlichen Check `test` von GitHub Actions (`app_id=15368`) mit
`strict=true` und `enforce_admins=true`; Force-Pushes und Löschen sind
deaktiviert. Die Regel verlangt keinen Pull Request und keine Review, daher sind
PR-freie Schreibwege nicht ausgeschlossen. Auto-Merge wurde für PR #30 bis #34
nach bestandenen Pflichtchecks ausgeführt. Historische Cloudflare-
Konfiguration und aktuelle Einschränkungen stehen in
`CLOUDFLARE_OPERATIONS.md`. Ein Cloud-Codex-Runner bleibt mangels verifizierter
Laufzeitschnittstelle `not_configured`; der bestandene lokale Windows-Smoke ist
kein Mac- oder Cloud-Runner-Nachweis.

## Pull Requests und Auto-Merge

Der Nutzer hat am 2026-11-15 Auto-Merge für zukünftige Pull Requests
ausdrücklich autorisiert; GitHub weist `allow_auto_merge=true` aus. PromptHub
kann Auto-Merge für einen PR aktivieren, sobald er eröffnet ist. GitHub darf
ihn erst integrieren, wenn `test` und alle weiteren geltenden Schutzregeln
bestanden sind. Keine Prüfung und keine erforderliche unabhängige Prüfung wird
dadurch übersprungen. Änderungen an Authentifizierung, Berechtigungen, Runnern,
Freigaben oder produktiven Daten benötigen weiterhin die jeweils erforderliche
menschliche Freigabe und unabhängige Prüfung.

Die aktuelle `main`-Regel verlangt keinen PR und beschränkt direkte Pushes
nicht. Auto-Merge schützt daher nur PRs und wird nicht als vollständige Sperre
für Änderungen an `main` dargestellt.

## Konfiguration

Alle Variablen sind in `.env.example` dokumentiert. Secrets werden nur über die
Umgebung eingespeist. Wichtige Variablen: `GITHUB_TOKEN`, `GITHUB_REPOSITORY`,
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`,
`PROMPTHUB_PROJECT_ROOT`, `CODEX_EXECUTABLE`, `PROMPTHUB_PUBLIC_ORIGIN` und
`PROMPTHUB_MODE`.

Das separate private GitHub-Control-Repository ist angelegt. Auf seinem
`main`-Branch liegt `.prompthub/active-jobs.json` mit dem leeren Schema
`{"version":1,"leases":[]}`. Es ist noch nicht mit der Anwendung verbunden:
GitHub-OAuth-App, Runtime-Token/-Secrets und serverloser API-Host fehlen.

## Netlify-Free-Deployment (vorbereitet, nicht live verbunden)

`netlify.toml` konfiguriert `main` als Produktionsquelle, `src/pwa` als
statisches Veröffentlichungsverzeichnis und `netlify/functions` als
Functions-Verzeichnis. Jeder Netlify-Build führt zuerst `npm test` und
`npm run check` aus. Die PWA und die API nutzen danach dieselbe HTTPS-Origin.

Das Netlify-Dashboard bestätigte den Free-Tarif. Der kontobezogene
Credit-Stand wird nicht in diesem öffentlichen Repository gespeichert. Zum
Zeitpunkt der Prüfung existierte noch kein Netlify-Projekt, deshalb ist kein
PromptHub-App-Verbrauch bekannt. Netlify Free hat ein Hard Limit und pausiert
bei Erschöpfung alle Team-Sites; das ersetzt PromptHubs eigenes Job-Gate nicht.
Aktuelle öffentliche Raten: 15 Credits je Produktions-Deployment, 10 je
GB-Stunde Compute, 20 je GB Bandbreite und 2 je 10.000 Requests. Alle Meter
teilen denselben Pool. Keine Zusatzcredits, kostenpflichtige Domain,
Tarifänderung oder kostenpflichtige Funktion aktivieren.

Netlify Production-Context erhält die folgenden Variablen ausschließlich über
die verschlüsselte Environment-Variable-Verwaltung des Anbieters:

- `NODE_ENV=production`, `PROMPTHUB_MODE=github`, `AUTH_MODE=github`
- `PROMPTHUB_PUBLIC_ORIGIN=https://<production-host>` ohne Pfad
- `SESSION_SECRET` mit mindestens 32 zufälligen Zeichen
- `GITHUB_TOKEN` mit minimal nötigen Rechten auf das private Control-Repository
- `GITHUB_REPOSITORY=<owner>/<private-control-repository>` und
  `GITHUB_BRANCH=main`, `GITHUB_REQUIRE_PRIVATE=true`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
  `GITHUB_ALLOWED_LOGINS=<freigegebener-login>` und
  `GITHUB_OAUTH_SCOPES=read:user`

Die OAuth-App benötigt als Callback
`https://<production-host>/auth/github/callback`. Die Anwendung prüft die
Allowlist, bindet schreibende API-Anfragen an denselben Origin und setzt in
Production `Secure`, `HttpOnly` und `SameSite=Lax` Cookies. GitHub-Sitzungen
werden serverseitig in Netlify Blobs mit AES-256-GCM verschlüsselt. OAuth-State
wird per stark konsistentem ETag-CAS einmalig konsumiert. Vorschau- und
Branch-Deployments liefern für API-, OAuth- und Health-Routen `404` und öffnen
keinen Produktions-Blobs-Store; Produktions-Secrets dürfen deshalb nur dem
Production-Context zugewiesen werden.

Das Netlify-Free-Credit-Readback ist nicht in PromptHub angebunden.
Der öffentliche Zustand `/healthz` und `/api/metrics` weist die Jobannahme
deshalb als `unknown` aus; `POST /api/jobs`, Jobfreigaben und Prompt-Übergaben
antworten mit `503 job_admission_paused`. Es gibt keinen manuellen
Environment-Override, der diese Sperre öffnen kann. Die öffentliche
Netlify-API-Referenz dokumentiert keinen vollständigen teamweiten
Credit-Readback. Erst ein frischer, maschinenlesbarer Readback des richtigen
Free-Teams unter 75 % des 300-Credit-Monatslimits kann die Prüfung bestehen.

Nach einer erfolgreichen Konto- und Integrationsprüfung löst jeder erfolgreiche
Push/Merge auf `main` einen Netlify-Build aus. Ein fehlgeschlagener Test oder
Check verhindert den Build. Der veröffentlichte Zustand muss anschließend mit
`GET /healthz`, `GET /api/me`, OAuth-Login und einem durch das Job-Gate
abgelehnten Auftrag geprüft werden. In diesem Workspace fehlen Netlify-CLI, Netlify-Konto-Token und die nötigen Netlify/GitHub-Runtime-Secrets; es wurde
deshalb weder ein Projekt angelegt noch ein Deployment ausgelöst. Ein
aufrufbares Netlify-Connector-Tool steht in der aktuellen Codex-Sitzung nicht
zur Verfügung; Projektimport und Deployment bleiben offen.

## Monitoring

Überwacht werden letzter Heartbeat, Lease-Alter, GitHub-Sync, Prozess-Exit-Code,
Checkpoint-Phase und Pflichtcheck-Ergebnis. Es werden keine Token- oder Prompt-
Inhalte gesammelt. Ein fehlender Heartbeat ist ein Zustand, kein Fortschritt.

## Update und Rollback

Updates laufen über einen eigenen Branch/Worktree und die Pflichtprüfungen. Vor
dem Aktivieren wird ein Commit-/Manifest-Checkpoint angelegt. Rollback erfolgt
auf einen bekannten Commit in einem neuen Restore-Schritt. Kritische Runner-,
Auth- und Freigabecodeänderungen benötigen eine unabhängige Prüfung.

Der Service Worker fragt bei einer bereitstehenden neuen Version zuerst nach
Nutzeraktion („Neue Version laden“) und lädt sie erst danach; der erste
Service-Worker-Einsatz löst keinen automatischen Reload aus. Offline-Fallback
gilt nur für statische GET-Assets. API-, OAuth- und Health-Anfragen bleiben
netzwerkgebunden. Beim Aktivieren werden ausschließlich ältere
`prompthub-static-*`-Caches gelöscht. Der Ablauf ist in `test/pwa-updates.test.mjs`
lokal regressionstested. Eine Live-Abnahme auf einem iPhone, einschließlich
Offline- und Updateverhalten, steht noch aus.

## Ressourcen und Kosten

Keine kostenpflichtigen oder KI-Dienste. Die einzige neue serverseitige
Hosting-Abhängigkeit `@netlify/blobs@10.7.13` ist gepinnt, kostenlos nutzbar und
wird nicht in den Browser gebündelt. Das Budget zusätzlicher laufender Dienste
bleibt 0 €. Polling,
Retry-Anzahl, Payload-Größen und Jobzahl sind konfiguriert und
begrenzt. Rate-Limit- oder Kostenwarnungen führen zu `paused`, nicht zu einer
stillen Erhöhung von Limits.

## Projektverbindungen und Prompt-Freigabe

Verbinden analysiert das ausgewählte GitHub-Repository nur lesend. Vor dem
Erstellen eines Jobs muss eine konkrete Prompt-Version ausdrücklich freigegeben
werden. **Aus PromptHub entfernen** pausiert wartende Jobs und trennt nur den
Katalogeintrag; laufende oder unklare Jobs blockieren die Trennung. Wiederverbinden
nutzt dieselbe Repository-Identität. Projektbezogene Datenlöschung ist eine
separate Aktion mit eigener Bestätigung. Das endgültige Löschen des GitHub-Repo-
sitorys wird nicht unterstützt.

## KI-Nutzung und Messwerte

Der Prompt-Designer verwendet nur einen belegten kostenfreien KI-Zugang. Solange
kein solcher Aufrufweg zur PWA verfügbar ist, weist er den strukturierten
Fallback aus. Das Dashboard zeigt Tokenwerte nur bei Messdaten vom Provider;
ansonsten werden tatsächliche Provider-Anfragen, Executor-Starts, Laufzeit,
Wiederholungen und echte Check-Ergebnisse getrennt benannt. Unvollständige
Tokentelemetrie wird als teilweise gemessen gekennzeichnet; fehlende Daten sind
nicht null.

Gleichlautende Analysen werden nur für einen identischen Projekt-Snapshot,
Wunsch, Anhang, Lieferform und Wissenshinweis dedupliziert. Der flüchtige
Prozesscache enthält höchstens 32 Einträge für fünf Minuten. Ein Cache-Treffer
überspringt weder Nutzerfreigaben noch Prompt-Versionierung oder Pflichtchecks.
Cache-Hit-Zähler sind lokal zum laufenden Prozess und keine dauerhaften
Einsparungs- oder Tokenangaben.
