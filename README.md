# PromptHub Studio

PromptHub Studio ist eine cloud-first Control API, iPhone-PWA und austauschbare
Runner für Entwicklungsaufträge in mehreren GitHub-Projekten. Das verbindliche
Budget für zusätzliche laufende Dienste beträgt 0 €.

## Status

Die Implementierung befindet sich in der technischen Erstabnahme. Der lokale
Memory-Modus ist für reproduzierbare Tests und die vertikale Demo gedacht. Das
private GitHub-Repository [`bndkxbqf2g-stack/prompthub-studio`](https://github.com/bndkxbqf2g-stack/prompthub-studio)
enthält den lokalen Quellstand `ec8dc42` auf `main` (Remote-Snapshot-Commit
`ca6210a`). Der Snapshot wurde über die verbundene GitHub-API importiert, weil
für Git-Transport hier keine Anmeldung eingerichtet ist; die ursprüngliche
lokale Commit-Abstammung wurde dabei nicht übernommen.

Die GitHub-CI-Konfiguration ist enthalten. Für den Snapshot lieferte die
Commit-Statusabfrage keine Status-Einträge; ein erfolgreicher GitHub-Actions-Lauf
ist daher noch nicht belegt. Der GitHub-Betrieb der Anwendung benötigt weiterhin
ein separat konfiguriertes privates Control-Repository, Token und OAuth-
Zugangsdaten. Ein Deployment wurde nicht erstellt.

Ein Cloudflare-Pages-Profil liegt in `wrangler.toml`; die API-Routen nutzen den
vorhandenen Worker-Handler und schlagen ohne sichere Production-Bindings mit
`503` fehl. Im Cloud-Dashboard wurden keine vorhandenen Projekte gefunden und
0/100.000 Requests für den Tag angezeigt. Ein Pages-Projekt wurde noch nicht
angelegt oder veröffentlicht: Die Cloudflare-GitHub-App verlangt weitreichende
Schreibrechte auf das verbundene Repository. Abrechnung blieb ungeprüft, da die
Billing-Seite nicht lud. Details und der Wrangler-Alternativweg stehen in
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
stehen in `CLOUDFLARE_OPERATIONS.md`. Sie ist vorbereitet, aber nicht deployed;
ohne privates Control-Repository, OAuth-Secrets und KV-Binding bleibt die
Control API absichtlich nicht verfügbar. Ein Codex-Cloud-Runner ist nicht
konfiguriert.

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

