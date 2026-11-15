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

Die GitHub-Branch-Einstellungsseite wurde am 2026-11-15 erneut geprüft: Für
`main` sind der Pflichtcheck `test`, `strict=true` und Admin-Enforcement aktiv.
„Require a pull request before merging“ ist ausgeschaltet; direkte Commits auf
`main` sind somit möglich. `allow_auto_merge=true` ist aktiviert. Die verbundene
GitHub-API verweigert den Branch-Schutz-Readback mit HTTP 403. Historische
Cloudflare-Konfiguration und aktuelle Einschränkungen stehen in
`CLOUDFLARE_OPERATIONS.md`. Der Cloud-Codex-Runner bleibt mangels verifizierter
Laufzeitschnittstelle `not_configured`.

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

Keine Produktions-Dependencies und keine automatisch aktivierten kostenpflichtigen
oder KI-Dienste. Das Budget zusätzlicher laufender Dienste beträgt 0 €. Polling,
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

