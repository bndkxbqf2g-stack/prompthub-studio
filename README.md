# PromptHub Studio

PromptHub Studio ist eine cloud-first Control API, iPhone-PWA und austauschbare
Runner für Entwicklungsaufträge in mehreren GitHub-Projekten. Das verbindliche
Budget für zusätzliche laufende Dienste beträgt 0 €.

## Status

Die technische Erstabnahme ist noch offen. Das auf ausdrücklichen Nutzerwunsch
am 2026-11-15 veröffentlichte GitHub-Quell-Repository
[`bndkxbqf2g-stack/prompthub-studio`](https://github.com/bndkxbqf2g-stack/prompthub-studio)
ist die dauerhafte Quelle für den Quellcode. Der letzte dokumentierte Main-Stand
vor dieser Statusaktualisierung war `65f0b8fbee80ede6cd25b3163b962cda3ffee953`;
Main-CI-Run 57 (`43762108744`) und GitHub-Pages-Run 13 (`43762107596`)
bestanden. PR #13 wurde nach erfolgreichem Pflichtcheck automatisch gemergt.
Der letzte erfolgreiche Branch-API-Readback bestätigte den erforderlichen Check `test`,
`strict=true` und Admin-Enforcement; die aktuelle GitHub-Integration kann diese
Regel derzeit nicht erneut auslesen. Direkte Pushes sind nicht eingeschränkt.
GitHub bestätigt `allow_auto_merge=true`.

GitHub Pages ist unter
[bndkxbqf2g-stack.github.io/prompthub-studio](https://bndkxbqf2g-stack.github.io/prompthub-studio/)
aktiv; der Live-Browser lädt die PWA unter
[`/src/pwa/`](https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/).
GitHub Pages liefert statische Dateien, aber keine serverseitige Control API.
Der Live-Browser lud UI, Manifest und das PNG-App-Icon über HTTPS. Die PWA zeigt
„Die Control API ist derzeit nicht erreichbar.“ Die Installation auf einem
echten iPhone sowie Offline- und Updateverhalten sind live noch nicht abgenommen.

Das Cloudflare-Pages-Projekt und seine letzte Veröffentlichung unter
[prompthub-studio.pages.dev](https://prompthub-studio.pages.dev) bleiben
vorhanden. Automatische Production-Deployments sind pausiert, Preview-Deployments
stehen auf `None`; die vorhandene Veröffentlichung wurde nicht gelöscht. Ihre
Control API ist nicht eingerichtet: `/api/me` und `/healthz` antworten deshalb
mit HTTP 503 (`cloud_control_plane_not_configured`). OAuth, KV-Binding und
Runtime-Secrets fehlen; keine der beiden Live-Adressen ist derzeit eine
betriebsbereite Auftragssteuerung.

Ein separates privates GitHub-Control-Repository wurde angelegt und mit einer
leeren Lease-Datei initialisiert. Es ist noch nicht mit einer PromptHub-Laufzeit
verbunden; OAuth-App, Runtime-Secrets und ein freigegebener serverloser API-Host
fehlen. Die Control API ist daher nicht verfügbar. Es wurde kein kostenpflichtiger
Plan aktiviert. Der
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
Netlify Free ist als Alternative geprüft, aber noch nicht verbunden oder
freigegeben. Die unabhängige Prüfung empfiehlt vor produktiver Aktivierung
No-Go: OAuth-/Session-Integration, isolierte Previews und ein verlässlicher
maschineller Quoten-Readback fehlen. Bis die 75-%-Quotenkontrolle verifiziert
ist, bleiben Cloud-Jobs gesperrt. Details stehen in `HOSTING_OPTIONS.md`.
Ein Codex-Cloud-Runner ist nicht konfiguriert.

Das separate private GitHub-Control-Repository existiert und enthält die
verifizierte leere Lease-Datei. Es ist noch nicht mit PromptHub verbunden. Für
den echten GitHub-Betrieb fehlen ein serverseitiger Token, eine OAuth-App mit
Login-Allowlist, ein freigegebener HTTPS-Host und ein explizit konfiguriertes
Codex-Binary. Änderungen an Authentifizierung und Hosting erfordern die
Freigaben aus `AGENTS.md` und `SECURITY_RULES.md` und werden nicht automatisch
vorgenommen.

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

