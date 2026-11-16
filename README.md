# PromptHub Studio

PromptHub Studio ist eine cloud-first Control API, iPhone-PWA und austauschbare
Runner für Entwicklungsaufträge in mehreren GitHub-Projekten. Das verbindliche
Budget für zusätzliche laufende Dienste beträgt 0 €.

[PromptHub Studio öffnen (iPhone-PWA)](https://bndkxbqf2g-stack.github.io/prompthub-studio/)

> Die GitHub-Repositoryansicht zeigt diese README. Die App selbst öffnet sich
> über den Pages-Link oben. Sie ist erreichbar; Anmeldung, Projekte, Aufträge
> und Freigaben bleiben bis zur Einrichtung der Control API ausgeblendet.

## Status

Die technische Erstabnahme ist noch offen. Das auf ausdrücklichen Nutzerwunsch
öffentliche GitHub-Repository
[`bndkxbqf2g-stack/prompthub-studio`](https://github.com/bndkxbqf2g-stack/prompthub-studio)
ist die dauerhafte Quelle für den Quellcode. `main` steht auf
`9e34b719ec5cf7e6de128efc4e83b7a01e480c02`. CI-Run `43889567863` bestand
`test`, `macos-latest` und `macos-15-intel`; Pages-Run `43889567107` stellte
diesen Commit erfolgreich bereit.
Auto-Merge nach bestandenen Pflichtchecks ist ausdrücklich autorisiert. Der
Branch-Readback verlangt `test`, aber keine PR-Pflicht oder Review; direkte
Pushes bleiben möglich.

GitHub Pages ist unter
[bndkxbqf2g-stack.github.io/prompthub-studio](https://bndkxbqf2g-stack.github.io/prompthub-studio/)
als statischer Host eingerichtet; die PWA-Dateien liegen unter
[`/src/pwa/`](https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/).
GitHub Pages liefert keine serverseitige Control API. Am 2026-11-16 öffnete ein
Browser-Smoke die Pages-Root-Adresse und landete in der PWA unter `/src/pwa/`.
Die Oberfläche meldet die fehlende Control API korrekt. Eine echte iPhone-
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
Netlify Free und die OAuth-/Sitzungsintegration wurden am 2026-11-16 zur
Umsetzung freigegeben und vorbereitet. Ein Deployment ist noch nicht aktiviert:
Netlify-Konto, Free-Tarif, GitHub-Verknüpfung und Provider-Secrets sind nicht
verbunden. Die unabhängige Prüfung fand keine Auth-/Session-Sicherheitsbefunde;
der teamweite Credit-Readback fehlt, deshalb bleiben Cloud-Jobs fail-closed
gesperrt. Details stehen in `HOSTING_OPTIONS.md`. Ein Codex-Cloud-Runner ist
nicht konfiguriert.

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

