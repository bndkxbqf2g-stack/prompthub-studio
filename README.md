# PromptHub Studio

PromptHub Studio ist eine cloud-first Control API, iPhone-PWA und austauschbare
Runner für Entwicklungsaufträge in mehreren GitHub-Projekten. Das verbindliche
Budget für zusätzliche laufende Dienste beträgt 0 €.

## Status

Die technische Erstabnahme ist noch offen. Das private GitHub-Repository
[`bndkxbqf2g-stack/prompthub-studio`](https://github.com/bndkxbqf2g-stack/prompthub-studio)
ist die dauerhafte Quelle für den Quellcode. GitHub Actions Run 9 für Commit
`8f0fdc25e90f0ba32d0ed79c724ff136aed14881` bestand mit Job `test` erfolgreich.

Die PWA-Hülle ist unter [prompthub-studio.pages.dev](https://prompthub-studio.pages.dev)
veröffentlicht. Cloudflare Pages ist mit dem privaten Repository verbunden;
Commits auf `main` lösen Production-Builds aus. Startseite, Manifest, Icon,
JavaScript und Service Worker wurden über HTTPS mit HTTP 200 geprüft. Die
Control API ist noch nicht eingerichtet: `/api/me` und `/healthz` antworten
deshalb mit HTTP 503 (`cloud_control_plane_not_configured`). OAuth, KV-Binding
und Runtime-Secrets fehlen; die PWA ist derzeit keine betriebsbereite
Auftragssteuerung.

GitHub Free erzwingt in diesem privaten Repository den freigegebenen Check
`test` nicht. Es wurde weder ein kostenpflichtiger Plan aktiviert noch die
Repository-Sichtbarkeit geändert. Der Cloudflare-Billing-Status konnte wegen
der nicht ladenden Abrechnungsseite nicht unabhängig verifiziert werden. Die
Abnahmematrix, Kostenregeln und aktuellen Betriebseinschränkungen stehen in
`ACCEPTANCE_CRITERIA.md`, `CLOUD_COST_RULES.md` und
`CLOUDFLARE_OPERATIONS.md`.

## Schnellstart

```powershell
Copy-Item .env.example .env
npm test
npm run check
npm start
```

Danach ist die lokale PWA unter `http://127.0.0.1:8787` erreichbar. Dieser
Entwicklungsmodus hat eine lokale Test-Session und darf nicht in Produktion
verwendet werden. Für den Runner siehe `OPERATIONS.md`.

Der reproduzierbare Vertikalschnitt kann ohne externe Schreibzugriffe ausgeführt
werden:

```powershell
npm run demo
```

Die serverlose Cloudflare-Variante und ihre verbindlichen Setup-/Kostenlimits
stehen in `CLOUDFLARE_OPERATIONS.md`. Die statische PWA ist live; ohne privates
Control-Repository, OAuth-Secrets und KV-Binding bleibt die Control API
absichtlich nicht verfügbar. Ein Codex-Cloud-Runner ist nicht konfiguriert.

Für den echten GitHub-Betrieb müssen ein privates Control-Repository, ein
serverseitiger Token, eine OAuth-App mit Login-Allowlist, ein freigegebener
HTTPS-Host und ein explizit konfiguriertes Codex-Binary eingerichtet werden.
Diese externen Änderungen werden nicht automatisch vorgenommen.

Die erste Version analysiert verbundene Repositories read-only. Prompt-Designer,
Wissensbibliothek, Projekttrennung/Wiederverbindung und Ressourcenübersicht
unterliegen `ACCEPTANCE_CRITERIA.md`. Ein Projektjob benötigt eine explizit
zugeordnete Runner-Pfadkonfiguration. Solange kein kostenloser PWA-KI-Zugang
nachgewiesen ist, wird der strukturierte Fallback klar angezeigt.

Token-, Kontext- und Cache-Regeln stehen in `RESOURCE_EFFICIENCY.md`.

## Verbindliche Regeln

Vor Änderungen `AGENTS.md`, `SECURITY_RULES.md` und
`ACCEPTANCE_CRITERIA.md` lesen. Ergebnisse und Einschränkungen werden in
`CHECKPOINTS.md` dokumentiert.

