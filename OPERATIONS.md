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
mit dem Unterpfad-Fix gemergt. Eine Live-Browserprüfung bestätigte das gerenderte
PWA-UI und geladene Styles sowie relative Icon-/Manifest-Pfade; die Oberfläche
meldet weiterhin, dass die Control API nicht erreichbar ist.

Cloudflare Pages `prompthub-studio` bleibt mit dem GitHub-Quell-Repository
verbunden, wird aber nicht mehr als Veröffentlichungsziel verwendet. Das
Cloudflare-Dashboard zeigte am 2026-11-15 den Projektstatus `Deployments
paused`; Production-Deployments sind pausiert und Preview-Deployments stehen auf
`None`. Die letzte Veröffentlichung unter https://prompthub-studio.pages.dev
bleibt öffentlich erreichbar. Das Projekt wurde nicht gelöscht. `wrangler.toml`
enthält weiterhin die Pages-Konfiguration; das frühere Workers-Static-Assets-
Profil bleibt in `wrangler.worker.toml` erhalten.

Die statische PWA-Hülle ist erreichbar. Die Control API antwortet mit HTTP 503,
bis ein Production-KV-Binding `SESSIONS`, die GitHub-OAuth-App, eine Login-
Allowlist und die dokumentierten serverseitigen Variablen/Secrets eingerichtet
sind. Der Pages-Runtime-Schalter `Fail closed` ist gespeichert und verifiziert.
Die Preview-Bereitstellung steht laut erneutem Dashboard-Readback auf `None`.
Preview-Adressen wären bei Aktivierung öffentlich; daher keine Preview-Secrets
setzen und vor einer Aktivierung Cloudflare Access konfigurieren.

Die Cloudflare-GitHub-Integration ist nicht die GitHub-OAuth-Anmeldung innerhalb
der PWA. `main` verlangt für PR-Merges den Statuscheck `test`; die Regel verlangt
keinen PR und beschränkt direkte Pushes nicht. Details zu Build, Bindings,
Schreibzugriff, HTTPS-Prüfungen, kostenfreien Kontingenten und offenen
Abnahmepunkten stehen in `CLOUDFLARE_OPERATIONS.md`. Der Cloud-Codex-Runner
bleibt mangels verifizierter Laufzeitschnittstelle `not_configured`.

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

## Monitoring

Überwacht werden letzter Heartbeat, Lease-Alter, GitHub-Sync, Prozess-Exit-Code,
Checkpoint-Phase und Pflichtcheck-Ergebnis. Es werden keine Token- oder Prompt-
Inhalte gesammelt. Ein fehlender Heartbeat ist ein Zustand, kein Fortschritt.

## Update und Rollback

Updates laufen über einen eigenen Branch/Worktree und die Pflichtprüfungen. Vor
dem Aktivieren wird ein Commit-/Manifest-Checkpoint angelegt. Rollback erfolgt
auf einen bekannten Commit in einem neuen Restore-Schritt. Kritische Runner-,
Auth- und Freigabecodeänderungen benötigen eine unabhängige Prüfung.

Der lokale Stand auf `codex/oauth-returnto-hardening` enthält den neuen PWA-
Updateablauf: „Neue Version laden“ erscheint, sobald ein aktualisierter Service
Worker bereitsteht. Erst nach Antippen wird er aktiviert und die Seite einmal
neu geladen; der erste Service-Worker-Einsatz löst keinen automatischen Reload
aus. Offline-Fallback gilt nur für statische GET-Assets. API-, OAuth- und Health-
Anfragen bleiben netzwerkgebunden. Beim Aktivieren werden ausschließlich ältere
`prompthub-static-*`-Caches gelöscht. Bei Änderungen an der statischen Assetliste
wird die Cache-Version in `src/pwa/sw.js` erhöht.

Dieser lokale Stand ist noch nicht gepusht. Die zuletzt dokumentierte Production-
Version stammt von Commit `504477dc35dab908c8b3755550866bca071c72db` und verwendet
weiterhin `prompthub-static-v3`; der neue Updateablauf ist deshalb noch nicht
auf `prompthub-studio.pages.dev` verfügbar.

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

