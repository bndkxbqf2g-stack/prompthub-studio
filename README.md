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
Admin-Enforcement. GitHub Actions Run 14 für Commit
`d45d1514656ce120da54e97de5e02f7ee68db288` bestand. Der zugehörige PR #2 ist
offen und nicht gemergt.

GitHub Pages ist unter
[bndkxbqf2g-stack.github.io/prompthub-studio](https://bndkxbqf2g-stack.github.io/prompthub-studio/)
aktiv; die PWA-Dateien liegen unter
[`/src/pwa/`](https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/).
GitHub Pages liefert statische Dateien, aber keine serverseitige Control API.
Die aktuelle Live-Version lädt die PWA-Assets wegen Root-relativer Pfade nicht
korrekt. Ein getesteter Fix ist lokal vorbereitet und noch nicht in PR #2
übertragen oder veröffentlicht.

Das Cloudflare-Pages-Projekt und seine letzte Veröffentlichung unter
[prompthub-studio.pages.dev](https://prompthub-studio.pages.dev) bleiben
vorhanden. Automatische Production-Deployments sind pausiert, Preview-Deployments
stehen auf `None`; die vorhandene Veröffentlichung wurde nicht gelöscht. Ihre
Control API ist nicht eingerichtet: `/api/me` und `/healthz` antworten deshalb
mit HTTP 503 (`cloud_control_plane_not_configured`). OAuth, KV-Binding und
Runtime-Secrets fehlen; keine der beiden Live-Adressen ist derzeit eine
betriebsbereite Auftragssteuerung.

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
stehen in `CLOUDFLARE_OPERATIONS.md`. GitHub Pages dient derzeit als statischer
Host; Cloudflare-Builds sind pausiert. Ohne privates Control-Repository,
OAuth-Secrets und KV-Binding bleibt die Control API absichtlich nicht verfügbar.
Ein Codex-Cloud-Runner ist nicht konfiguriert.

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

