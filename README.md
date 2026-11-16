# PromptHub Studio

PromptHub Studio ist eine cloud-first Control API, iPhone-PWA und austauschbare
Runner für Entwicklungsaufträge in mehreren GitHub-Projekten. Das verbindliche
Budget für zusätzliche laufende Dienste beträgt 0 €.

[PromptHub Studio App direkt öffnen](https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/)

## Status

Die technische Erstabnahme ist noch offen. Das auf ausdrücklichen Nutzerwunsch
öffentliche GitHub-Repository
[`bndkxbqf2g-stack/prompthub-studio`](https://github.com/bndkxbqf2g-stack/prompthub-studio)
ist die dauerhafte Quelle für den Quellcode. Lokales `main` steht auf
`bb06cd93872860cfd88f89ec555bac0d2bdf1e83`; PR #34 war ein Dokumentations-PR,
bestand `test`, `macos-latest` und `macos-15-intel` in Runs `43784925947` und
`43784944320` und wurde automatisch gemergt. Auto-Merge nach bestandenen
Pflichtchecks ist ausdrücklich autorisiert. Der bestätigte Branch-Readback
verlangt `test`, aber keine PR-Pflicht oder Review; direkte Pushes bleiben
möglich.

GitHub Pages ist unter
[bndkxbqf2g-stack.github.io/prompthub-studio](https://bndkxbqf2g-stack.github.io/prompthub-studio/)
als statischer Host eingerichtet; die PWA-Dateien liegen unter
[`/src/pwa/`](https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/).
GitHub Pages liefert keine serverseitige Control API. Der letzte dokumentierte
Pages-Run 33 (`43783986387`) war erfolgreich auf Produktcode-Commit
`792c96e3e8be2db849143b8420baea9c241f8eb2`; ein Main-/Pages-Post-Merge-Run nach
PR #34 und ein direkter aktueller HTTP-Smoke wurden nicht unabhängig
ausgelesen. Ein früherer HTTPS-Smoke bestätigte Startseite, Manifest,
PNG-App-Icon, Service Worker und Assets mit HTTP 200. Eine echte iPhone-
Installation sowie Offline- und Updateverhalten sind nicht abgenommen.

Am 2026-11-16 bestand ein echter Codex-CLI-/PromptHubRunner-Smoke auf Windows in
einem temporären Git-Fixture. Er nutzte eine `MemoryControlPlane` und beweist
weder GitHub-Persistenz noch einen lokalen MacBook-Runner.

Cloudflare wird nicht mehr als Host verwendet. Das Pages-Projekt bleibt
pausiert; die alte Veröffentlichung und `*.pages.dev`-Adresse sind noch
vorhanden, und die GitHub-Verknüpfung besteht weiter. Die Control API ist dort
nicht eingerichtet: `/api/me` und `/healthz` antworten mit HTTP 503
(`cloud_control_plane_not_configured`). OAuth, KV-Binding und Runtime-Secrets
fehlen. GitHub Pages liefert nur die statische PWA und keine Control API.

Ein separates privates GitHub-Control-Repository wurde angelegt und mit einer
leeren Lease-Datei initialisiert. Es ist noch nicht mit einer PromptHub-Laufzeit
verbunden; OAuth-App, Runtime-Secrets und ein freigegebener serverloser API-Host
fehlen. Die Control API ist daher nicht verfügbar. Es wurde kein kostenpflichtiger
Plan aktiviert. Eine spätere schreibgeschützte Dashboard-Prüfung zeigte den
Workers-Free-Tarif; die Abrechnungsansicht lieferte keinen vollständigen
accountweiten Kostenbeleg. Die Abnahmematrix, Kostenregeln und aktuellen
Betriebseinschränkungen stehen in
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

Die frühere Cloudflare-Variante und ihr pausierter Status sind in
`CLOUDFLARE_OPERATIONS.md` dokumentiert. Cloudflare-Deployments bleiben pausiert.
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

