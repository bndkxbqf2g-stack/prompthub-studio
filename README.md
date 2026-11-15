# PromptHub Studio

PromptHub Studio ist eine cloud-first Control API, iPhone-PWA und austauschbare
Runner für Entwicklungsaufträge in mehreren GitHub-Projekten. Das verbindliche
Budget für zusätzliche laufende Dienste beträgt 0 €.

## Status

Die technische Erstabnahme ist noch offen. Das auf ausdrücklichen Nutzerwunsch
am 2026-11-15 veröffentlichte GitHub-Quell-Repository
[`bndkxbqf2g-stack/prompthub-studio`](https://github.com/bndkxbqf2g-stack/prompthub-studio)
ist die dauerhafte Quelle für den Quellcode. `main` verlangt für Merges den
erfolgreichen Check `test`; die Branch-API bestätigte `strict=true` und
Admin-Enforcement. GitHub Actions Run 13 für Commit
`0a9e105641a17db91988c6848778b62cafbbcd40` bestand. Der zugehörige PR #2 ist
offen und nicht gemergt.

Die PWA-Hülle ist unter [prompthub-studio.pages.dev](https://prompthub-studio.pages.dev)
veröffentlicht. Cloudflare Pages ist mit dem öffentlichen Quell-Repository verbunden;
Commits auf `main` lösen Production-Builds aus. Startseite, Manifest, Icon,
JavaScript und Service Worker wurden über HTTPS mit HTTP 200 geprüft. Die
Control API ist noch nicht eingerichtet: `/api/me` und `/healthz` antworten
deshalb mit HTTP 503 (`cloud_control_plane_not_configured`). OAuth, KV-Binding
und Runtime-Secrets fehlen; die PWA ist derzeit keine betriebsbereite
Auftragssteuerung.

GitHub Free konnte den freigegebenen Check `test` nach der vom Nutzer
angeordneten Veröffentlichung des Quell-Repositories als Branch-Regel auf
`main` setzen. Es wurde kein kostenpflichtiger Plan aktiviert. Der
Cloudflare-Billing-Status konnte wegen der nicht ladenden Abrechnungsseite
nicht unabhängig verifiziert werden. Die
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

