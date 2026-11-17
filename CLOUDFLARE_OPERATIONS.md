# PromptHub Studio – Cloudflare Pages Betrieb

## Letzter Cloudflare-Readback – 2026-11-15; Arbeitsstatus – 2026-11-17

- Der letzte Dashboard-Readback zeigte das Pages-Projekt `prompthub-studio`
  ist pausiert, bleibt mit `bndkxbqf2g-stack/prompthub-studio` verbunden und
  wurde nicht gelöscht. Die letzte im Dashboard beobachtete erfolgreiche
  Veröffentlichung hatte die Deployment-ID
  `7f73f6ff-0294-4c4e-800c-d9509b48709c` und den Commit
  `8f0fdc25e90f0ba32d0ed79c724ff136aed14881`; sie bleibt unter
  https://prompthub-studio.pages.dev erreichbar.
- Automatische Production-Deployments sind pausiert. Preview-Deployments wurden
  auf `None` gesetzt; diese Einstellung konnte nach dem Browserausfall nicht
  erneut ausgelesen werden. Es wurden bei der letzten Prüfung keine
  Cloudflare-Einstellungen verändert.
- Die neuere Nutzeranweisung vom 2026-11-17 priorisiert Cloudflare erneut,
  sofern es sicher und innerhalb des 0-€-Budgets geeignet ist. Das gilt für
  Prüfung und Vorbereitung; es autorisiert weder Deployment-Wiederaufnahme,
  D1-Anlage, Secret-Änderung noch sonstige Cloudflare-Mutationen. Der aktuelle
  Konto-/Projektzustand wurde seit dem Readback vom 2026-11-15 nicht erneut
  ausgelesen.
- Netlify ist der zuletzt verifizierte öffentliche PWA-Host. Der Readback vom
  2026-11-16 zeigte Production `ready`; `/healthz` meldete
  `production_api_disabled`. GitHub Pages liefert ebenfalls nur statische
  Dateien, keine Control API.
- Der frühere Cloudflare-Worker war nicht konfiguriert. Der Feature-Branch
  verwendet jetzt D1 `AUTH_DB` und verschlüsselte Sitzungen. D1-Datenbank,
  Binding und Secrets fehlen weiterhin; ein aktueller Live-API-Status ist nicht
  geprüft. Produktiver Control-Plane-Betrieb ist nicht nachgewiesen.
- Eine schreibgeschützte Dashboard-Prüfung zeigte `Workers Free`. Die
  Abrechnungsansicht lieferte keinen vollständigen accountweiten Kosten- oder
  Verbrauchsnachweis; daher wird keine vollständige 0-€-Abrechnung behauptet.
  Ein kostenpflichtiger Tarif wurde in der letzten Prüfung nicht aktiviert.
- Auto-Merge zukünftiger PRs nach bestandenen Pflichtchecks ist vom Nutzer
  autorisiert. Der letzte erfolgreiche Branch-Regel-Readback bestätigte für
  `main` den Check `test`, `strict=true` und Admin-Enforcement; eine aktuelle
  erneute Abfrage liegt nicht vor.

## Historische Cloudflare-Konfiguration

Die folgenden Abschnitte dokumentieren die frühere Pages-Einrichtung und den
vorbereiteten D1-Code. Sie beschreiben keinen aktiven Host und erteilen keine
Freigabe, Deployments wiederaufzunehmen, Ressourcen anzulegen oder das Projekt
zu löschen.

## Historische Pages-Konfiguration

| Einstellung | Wert |
|---|---|
| Projektname | prompthub-studio |
| Produktionsadresse | https://prompthub-studio.pages.dev |
| Zuletzt im Dashboard beobachtete Deployment-ID | 7f73f6ff-0294-4c4e-800c-d9509b48709c |
| GitHub-Repository | bndkxbqf2g-stack/prompthub-studio (öffentlich, Nutzerentscheidung vom 2026-11-15) |
| Produktionsbranch | main |
| Root-Verzeichnis | Repository-Root |
| Build-Befehl | npm ci --ignore-scripts --no-audit --no-fund && npm test && npm run check |
| Build-Ausgabe | src/pwa |
| Node.js im Build | NODE_VERSION=22 |
| Pages Functions | functions/[[path]].js |
| Funktionsrouten | /api/*, /auth/*, /healthz |

Die statischen Dateien benötigen keinen Bundler. Pages bündelt die Functions
aus dem functions/-Verzeichnis. Der Build-Befehl muss vor dem Upload erfolgreich
enden; Cloudflare bewertet ihn anhand seines Exitcodes. `wrangler.toml` enthält
keine Tokens, D1-Datenbank-ID oder `AUTH_DB`-Binding. Der Feature-Branch enthält
`migrations/0001_auth_store.sql` und `CloudflareD1SessionStore`: GitHub-Sitzungen
werden mit AES-256-GCM verschlüsselt; OAuth-States werden gehasht und
verschlüsselt und durch genau ein bedingtes `DELETE … RETURNING` konsumiert.
Das frühere `SESSIONS`-KV-Verfahren wurde entfernt und darf nicht wieder
gebunden werden. Vor Live-Betrieb sind freigegebene D1-Anlage/Binding und
Secret-Konfiguration, Migration, Quoten-Readback und Deployment-Abnahme
erforderlich. Der unabhängige Read-only-Review des aktuellen Feature-Branch-
Authcodes wurde ohne offene Sicherheitsbefunde abgeschlossen; das ersetzt
keinen Live-D1-Test oder die Prüfung späterer Konfigurationsänderungen. Laut
Wrangler-Dokumentation wird eine fehlgeschlagene Migration zurückgerollt und
nach erfolgreicher Anwendung ein Backup erfasst. Wrangler war nicht verfügbar;
die Migration wurde nicht ausgeführt.

## Deployment-Wege und Berechtigungen

Die GitHub-Git-Integration ist noch verbunden, aber Branch-Control pausiert
automatische Deployments auf `main`; Preview-Deployments stehen auf `None`.
Die letzte Produktion bleibt unter `https://prompthub-studio.pages.dev`
erreichbar. Historische Builds wurden von Cloudflare Pages auf `main` erstellt
und in `src/pwa` veröffentlicht. Der erste
Build schlug bei Commit `d7fc44f` wegen des von Pages nicht unterstützten JSON-
Import-Attributes fehl. Commit `504477d` erzeugt stattdessen ein geprüftes
ES-Modul aus der versionierten JSON-Quelle; danach bestanden der Pages-Build
und GitHub Actions Run 6. Der Build führt `npm test` und `npm run check` aus.

Die Pages-Git-Integration ist nicht die Anmeldung der Nutzer in PromptHub. Für
die Control API fehlen weiterhin das D1-Binding `AUTH_DB` und die folgenden
Production-Secrets/-Variablen. Secrets ausschließlich in Cloudflare Pages
Production Settings setzen, niemals in Git, Frontend oder Logs:

- `GITHUB_REPOSITORY`: privates Control-Repository in owner/name-Form.
- `GITHUB_BRANCH`: `main`.
- `GITHUB_ALLOWED_LOGINS`: explizite GitHub-Login-Allowlist.
- `GITHUB_TOKEN`: serverseitiges, eng begrenztes Token nur für benötigte private
  Repositories.
- `GITHUB_CLIENT_ID` und `GITHUB_CLIENT_SECRET`: GitHub-OAuth-App zur
  PromptHub-Anmeldung.
- `SESSION_SECRET`: kryptografisch zufälliger Wert mit mindestens 32 Zeichen;
  daraus werden Cookie-HMAC- und getrennte AES-GCM-Schlüssel abgeleitet.
- `AUTH_DB`: D1-Binding, kein Text-Secret. Vor Aktivierung muss
  `migrations/0001_auth_store.sql` auf der zugeordneten Datenbank angewendet sein.

Die OAuth-Callback-URL lautet
`https://prompthub-studio.pages.dev/auth/github/callback`. Vor der Aktivierung
OAuth-Scopes, Allowlist, Tokenumfang und D1-/Workers-Free-Kontingente müssen geprüft
werden. Ohne diese Konfiguration bleiben `/api/*`, `/auth/*` und `/healthz`
geschlossen (`503`); kein eingeloggter Verwaltungsbereich wird vorgetäuscht.
Der Branch-Control-Dialog bestätigt `None` für Preview-Builds und deaktivierte
automatische Production-Deployments. Falls Preview-Builds später aktiviert
werden, ist Cloudflare Access erforderlich, weil Preview-Adressen sonst
öffentlich sind.

GitHub-Branch-Schutz: Der Nutzer hat den erforderlichen Check `test`
ausdrücklich freigegeben. GitHub Free erlaubt Branch Protection für öffentliche
Repositories. Nach der ausdrücklich autorisierten Veröffentlichung des
Quell-Repositories wurde `main` per GitHub-API mit `test`, `strict=true` und
Admin-Enforcement geschützt; der GET-Readback bestätigte diese Werte.
GitHub Actions Run 14 (`43746180556`) für den aktuellen PR-Head
`d45d1514656ce120da54e97de5e02f7ee68db288` bestand. Die Regel blockiert PR-Merges,
wenn `test` fehlt oder fehlschlägt. Sie verlangt keinen PR und beschränkt direkte
Pushes nicht; solche zusätzlichen Branch-Regeln wurden nicht freigegeben oder
gesetzt. Es wurde kein bezahlter Plan aktiviert. Quellen:
[GitHub-Verfügbarkeit geschützter Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) und [Branch-Protection-API](https://docs.github.com/en/rest/branches/branch-protection).

Die Pages-Git-Integration bleibt verbunden, löst wegen der pausierten
Branch-Deployments derzeit keine Builds aus. Ein zusätzlicher GitHub-Actions-
Deploy ist nicht eingerichtet. Eine Wiederaufnahme benötigt eine ausdrückliche
Nutzerentscheidung.

## Schreibzugriff und Wiederherstellungswege

Fehler beim Schreiben werden nach Ursache getrennt, weil Sandbox-, Netzwerk-,
Anmelde- und Tarifgrenzen verschiedene Lösungen benötigen:

| Fehlerbild | Sichere Lösung |
|---|---|
| Lokale Dateien beschreibbar, `.git` aber schreibgeschützt | Git-Metadatenoperationen gezielt mit dem autorisierten Schreibmodus ausführen. `safe.directory` und Autoridentität nur pro Git-Befehl setzen; keine globale Sicherheitskonfiguration ändern. |
| `git push` scheitert mit Netzwerkfehler | Den Push zuerst als Dry-Run prüfen und bei isoliertem Netzwerkzugriff für genau diesen Befehl erweiterten Netzwerkzugriff verwenden. Zugangsdaten im Credential Manager belassen, nie in Remote-URL, Kommandozeile oder Logs schreiben. Das wurde für den Feature-Branch erfolgreich angewendet. |
| GitHub antwortet mit 401/403 | Authentifizierungsfehler von fehlender Repository-Rolle, Token-Scope und Tarifbeschränkung unterscheiden. Für Branch-Schutz braucht ein Fine-Grained Token `Administration: write` nur auf dieses Repository und der Nutzer muss Admin/Owner sein. Ein 403 wegen GitHub-Free-Sichtbarkeit wird durch mehr Tokenrechte nicht behoben. |
| GitHub Free blockiert Branch-Schutz im privaten Repo | Kostenfreier Weg: öffentliches Quell-Repository, sofern der Nutzer das ausdrücklich entscheidet. Alternativ wäre ein passender bezahlter GitHub-Plan erforderlich; dieser bleibt wegen des 0-€-Budgets deaktiviert. Die Sichtbarkeitsänderung und `test`-Regel sind inzwischen umgesetzt. |
| Cloudflare-Schreibzugriff fehlt | Bevorzugt die angemeldete Cloudflare-Dashboard-Sitzung nutzen. Alternativ wäre ein API-Token mit `Pages Write` nötig; dies ist kontoweit und kann Pages-Projekte erstellen, ändern und löschen. Für KV-Anlage wäre zusätzlich `Workers KV Storage Write` nötig. Vor jeder API-Mutation Zielprojekt auslesen und ausschließlich gezielte Update-/Create-Methoden verwenden. Keine Ressource löschen. |
| Wrangler OAuth scheint einfacher | `wrangler login` hat keine granularen Rechteauswahl. Für automatisierte Nutzung nur ein eng begrenztes API-Token verwenden; Token nie im Chat übermitteln. Wrangler Direct Upload ist für das bereits mit GitHub verbundene Pages-Projekt kein geeigneter Weg. |

Für diese Sitzung gibt es kein `gh` und kein `wrangler`, keine Cloudflare-Token-
Umgebungsvariable und keinen geöffneten Cloud-Browser. Daher sind derzeit nur
Git/GitHub-Schreibzugriffe nachgewiesen. Die Cloudflare-Berechtigung muss über
eine wieder verfügbare, angemeldete Dashboard-Sitzung oder einen sicher
bereitgestellten API-Token hergestellt werden. GitHub- und Cloudflare-Token
werden niemals im Chat angefordert oder ausgegeben. Cloudflare-Permissions:
[Pages API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/create/), [Tokenrechte](https://developers.cloudflare.com/workers/authorization/workers/) und [Wrangler-Rechte](https://developers.cloudflare.com/workers/authorization/).

Die vollständige Control-Plane setzt OAuth, privates Control-Repository,
begrenzten GitHub-Token, Production-D1-Binding `AUTH_DB` und vollständige
Secrets voraus. Das Binding ist kein Secret; `SESSION_SECRET`, GitHub-Token
und OAuth-Secret sind es. Ohne diese Werte liefert `/api/me` 503; Frontend und
Administrationsbereich bleiben verborgen. Dieser sichere Fail-Closed-Zustand
ersetzt keinen funktionsfähigen Control-Plane-Betrieb.

Die GitHub-Control-Plane benötigt Schreibzugriff auf ihr privates Control-
Repository. Der aktuelle Runtime-Client verwendet denselben serverseitigen
GitHub-Token für angeschlossene Projekte. Beschränke das Token deshalb auf die
konkret benötigten privaten Repositories und gib keine organisationsweiten
Rechte. OAuth-Login und API-Zugriff sind zusätzlich an GITHUB_ALLOWED_LOGINS,
die private-Repository-Prüfung und serverseitige Session-Authentifizierung
gebunden.

## Kosten- und Kontingentgrenzen

- Reine Pages-Static-Asset-Anfragen sind laut Cloudflare kostenlos und
  unbegrenzt. _routes.json hält Bilder, CSS, JavaScript, Manifest und PWA-
  Navigation außerhalb der Functions.
- Pages Functions zählen gegen das Workers-Free-Kontingent von 100.000
  Requests pro Tag für das Konto. Bei ausgeschöpftem Kontingent muss Pages
  Fail closed liefern; kein Upgrade oder Fallback-Dienst ist zulässig.
- Pages Free erlaubt laut Limits-Seite 500 Builds pro Monat, einen gleichzeitigen
  Build und 20 Minuten Laufzeit je Build. Build Watch Paths vermeiden unnötige
  Builds.
- Free-Pages-Assets sind auf 20.000 Dateien je Site und 25 MiB pro Datei
  begrenzt. Das PWA-Icon liegt unter dem Dateilimit.
- D1 Free: bis zu 5 Mio. gelesene und 100.000 geschriebene Zeilen pro Tag,
  500 MB je Datenbank und 5 GB je Account. D1-/Workers-Nutzung wird nicht live
  überwacht; Speicherfehler führen im Worker zu 503. Es gibt keinen bezahlten
  Fallback und keine automatische Aufrüstung.
- Diese Limits sind Produktlimits, kein Nachweis über den Tarif oder die
  Abrechnungseinstellungen des konkreten Nutzerkontos.

## PWA, Betrieb und Wiederherstellung

- HTTPS und `https://prompthub-studio.pages.dev` sind veröffentlicht und die
  PWA-Assets wurden per HTTP geprüft. Eine tatsächliche Installation und
  Bedienprüfung auf einem iPhone steht noch aus: Safari → Teilen → Zum
  Home-Bildschirm.
- manifest.webmanifest, PNG-App-Icon und Sicherheitsheader liegen in src/pwa.
  Der Service Worker lädt die App-Shell netzwerkbasiert und verwendet den Cache
  bei Offline-Ausfall. API-Aufrufe werden nie aus dem Cache beantwortet; ohne
  Netzwerk sind Anmeldung und Control API nicht verfügbar.
- Der Service Worker entfernt ältere Caches nach Aktivierung einer neuen
  Version. Die PWA zeigt bei fehlender API eine Fehlermeldung statt
  Fortschritt oder Erfolg zu erfinden.
- Produktionsupdates erfolgen derzeit nicht automatisch: Production- und
  Preview-Deployments sind pausiert. Die letzte veröffentlichte Version bleibt
  erreichbar; ein Update erfordert eine ausdrückliche Entscheidung zur
  Wiederaufnahme der Deployments.
- Rollback: den fehlerhaften Quellcommit per neuem Revert auf main zurücksetzen
  und den nachfolgenden Pages-Build abwarten. Keine Cloudflare-Ressource oder
  GitHub-Historie löschen.

## Quellen

- [Pages Functions Routing, Free-Kontingent und Fail-Closed](https://developers.cloudflare.com/pages/functions/routing/)
- [Pages Functions Pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Pages Git Integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [GitHub-App-Zugriff einschränken](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- [Pages Build Watch Paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/)
- [Pages Wrangler Configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [D1-Migrationen und Fehler-Rollback](https://developers.cloudflare.com/d1/reference/migrations/)

