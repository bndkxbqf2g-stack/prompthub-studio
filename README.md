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
Admin-Enforcement. PR #2 wurde nach bestandenen Pflichtchecks mit 14 Commits in
`main` gemergt. GitHub Actions Run 19 (`43749169752`) bestand für den PR-Head
`36ba10a4166bb365e6fcc8d06b443a2d77118d35`. GitHub bestätigt
`allow_auto_merge=true`; PR #2 wurde nach den grünen Checks manuell gemergt.

GitHub Pages ist unter
[bndkxbqf2g-stack.github.io/prompthub-studio](https://bndkxbqf2g-stack.github.io/prompthub-studio/)
aktiv; die PWA-Dateien liegen unter
[`/src/pwa/`](https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/).
GitHub Pages liefert statische Dateien, aber keine serverseitige Control API.
Nach dem Merge lädt die Live-PWA ihre relative Stylesheet- und Icon-/Manifest-
Verweise unter diesem Unterpfad. Die Browserprüfung zeigte das gerenderte UI
ohne Konsolenfehler. Die PWA meldet dort weiterhin, dass die Control API nicht
erreichbar ist. iPhone-Installation und Offline-/Updateverhalten sind live noch
nicht abgenommen.

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
`ACCEPTANCE_CRITERIA.md`, `CLOUD_COST_RULES.md`,
`CLOUDFLARE_OPERATIONS.md` und `HOSTING_OPTIONS.md`.

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
stehen in `CLOUDFLARE_OPERATIONS.md`; automatische Deployments bleiben pausiert.
GitHub Pages dient derzeit als statischer Host und stellt keine Control API
bereit. Netlify Free ist als Cloudflare-Alternative geprüft, aber noch nicht
verbunden oder freigegeben; Bedingungen und offene Sicherheitsentscheidungen
stehen in `HOSTING_OPTIONS.md`. Ein Codex-Cloud-Runner ist nicht konfiguriert.

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

