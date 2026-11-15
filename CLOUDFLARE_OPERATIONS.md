# PromptHub Studio – Cloudflare Pages Betrieb

## Verifizierter Stand

- Cloudflare-Pages-Projekt `prompthub-studio` ist mit dem privaten GitHub-
  Repository `bndkxbqf2g-stack/prompthub-studio` verbunden. Account-ID:
  `19a163849475274c22cb8a8a130d352b`.
- Die Produktion unter https://prompthub-studio.pages.dev wurde erfolgreich
  veröffentlicht: Deployment `10eb0d77-7b19-4edc-9adc-548518e098f7`, Commit
  `504477dc35dab908c8b3755550866bca071c72db`, Cloudflare-Status `success`.
  Git-Integration deployt Commits auf `main` automatisch.
- GitHub bestätigt das Repository weiterhin als `private`, Default-Branch
  `main`, HEAD `8f0fdc25e90f0ba32d0ed79c724ff136aed14881`. Actions-Run 9
  (`43727273718`) einschließlich Job `test` war erfolgreich.
- `wrangler.toml` beschreibt Pages; der bisherige Workers Static Assets-Modus
  bleibt in `wrangler.worker.toml` erhalten.
- functions/[[path]].js leitet ausschließlich über _routes.json ausgewählte
  API-, Auth- und Health-Anfragen an denselben gehärteten Worker weiter. Statische
  PWA-Dateien werden direkt ausgeliefert.
- Fehlende Runtime-Secrets oder das KV-Binding führen auf API-Routen zu 503.
  Es gibt keine lokale Mock-Authentifizierung im Cloudflare-Modus. Ohne
  Konfiguration bleibt die PWA-Hülle sichtbar, die Control API aber nicht
  verfügbar.
- Echte HTTPS-Prüfung: `/`, `/manifest.webmanifest`, `/app-icon-source.png`,
  `/sw.js`, `/app.js` und `/styles.css` antworteten mit HTTP 200 und passenden
  Inhaltstypen. `/api/me` und `/healthz` antworteten mit HTTP 503 und
  `cloud_control_plane_not_configured`, weil OAuth-/Runtime-Konfiguration und
  KV-Binding nicht vorhanden sind. Die PWA-Hülle ist live; die Control API ist
  bewusst nicht betriebsbereit.
- Pages Runtime ist auf `Fail closed` gestellt; der Zustand wurde im Dashboard
  nach dem Speichern erneut geprüft. Für Branch Control wurde die automatische
  Bereitstellung von Preview-Branches auf „None“ gesetzt und gespeichert. Die
  Einstellung konnte nach dem späteren Browser-Transportabbruch nicht erneut
  ausgelesen werden. Preview-Deployments sind standardmäßig öffentlich; Cloudflare
  Access wurde dafür nicht eingerichtet und Preview-Secrets sind nicht gesetzt.
- Die Cloudflare-GitHub-Integration ist im Projekt aktiv und mit dem
  ausgewählten privaten Repository verbunden. Sie ist von der GitHub-OAuth-App
  für die Anmeldung von PromptHub-Nutzern zu unterscheiden; diese OAuth-App,
  Runtime-Secrets und das KV-Binding sind nicht eingerichtet.
- Der Cloud-Browser bestätigte Projekt und Deployment. Die Billing-Seite blieb
  im Ladezustand; daher sind Konto-Abrechnung und Zahlungsmittel nicht
  unabhängig verifiziert. In diesem Arbeitsgang wurde kein kostenpflichtiger
  Tarif, keine kostenpflichtige Ressource und keine Abrechnungsfunktion aktiviert.
- GitHub steht auf Free; der Actions-Budgetwert beträgt $0.00 und zeigt
  „Usage blocked“. Actions-Billable-Usage nach Rabatten ist $0; die enthaltene
  Free-Nutzung bleibt begrenzt und ein Lauf kann nach Erschöpfung blockieren.
- Es wurde kein kostenpflichtiger Tarif und keine kostenpflichtige Ressource
  aktiviert; der genaue Account-Billing-Status bleibt ungeprüft.

## Pages-Konfiguration

| Einstellung | Wert |
|---|---|
| Projektname | prompthub-studio |
| Produktionsadresse | https://prompthub-studio.pages.dev |
| Letzte Deployment-ID | 10eb0d77-7b19-4edc-9adc-548518e098f7 |
| GitHub-Repository | bndkxbqf2g-stack/prompthub-studio (privat) |
| Produktionsbranch | main |
| Root-Verzeichnis | Repository-Root |
| Build-Befehl | npm ci --ignore-scripts --no-audit --no-fund && npm test && npm run check |
| Build-Ausgabe | src/pwa |
| Node.js im Build | NODE_VERSION=22 |
| Pages Functions | functions/[[path]].js |
| Funktionsrouten | /api/*, /auth/*, /healthz |

Die statischen Dateien benötigen keinen Bundler. Pages bündelt die Functions
aus dem functions/-Verzeichnis. Der Build-Befehl muss vor dem Upload erfolgreich
enden; Cloudflare bewertet ihn anhand seines Exitcodes. wrangler.toml enthält
keine Tokens oder namespace-IDs. Das KV-Binding `SESSIONS` ist noch nicht
angelegt; bei späterer Freigabe darf es ausschließlich an Production gebunden
werden und muss innerhalb des Free-Kontingents betrieben werden.

## Deployment-Wege und Berechtigungen

GitHub-Git-Integration ist bereits aktiv. Produktionsbuilds werden von
Cloudflare Pages auf `main` erstellt und in `src/pwa` veröffentlicht. Der erste
Build schlug bei Commit `d7fc44f` wegen des von Pages nicht unterstützten JSON-
Import-Attributes fehl. Commit `504477d` erzeugt stattdessen ein geprüftes
ES-Modul aus der versionierten JSON-Quelle; danach bestanden der Pages-Build
und GitHub Actions Run 6. Der Build führt `npm test` und `npm run check` aus.

Die Pages-Git-Integration ist nicht die Anmeldung der Nutzer in PromptHub. Für
die Control API fehlen weiterhin das `SESSIONS`-KV-Binding und die folgenden
Production-Secrets/-Variablen. Secrets ausschließlich in Cloudflare Pages
Production Settings setzen, niemals in Git, Frontend oder Logs:

- `GITHUB_REPOSITORY`: privates Control-Repository in owner/name-Form.
- `GITHUB_BRANCH`: `main`.
- `GITHUB_ALLOWED_LOGINS`: explizite GitHub-Login-Allowlist.
- `GITHUB_TOKEN`: serverseitiges, eng begrenztes Token nur für benötigte private
  Repositories.
- `GITHUB_CLIENT_ID` und `GITHUB_CLIENT_SECRET`: GitHub-OAuth-App zur
  PromptHub-Anmeldung.
- `SESSION_SECRET`: kryptografisch zufälliger Wert mit mindestens 32 Zeichen.
- `SESSIONS`: KV-Binding, kein Text-Secret.

Die OAuth-Callback-URL lautet
`https://prompthub-studio.pages.dev/auth/github/callback`. Vor der Aktivierung
müssen OAuth-Scopes, Allowlist, Tokenumfang und KV-Free-Kontingent geprüft
werden. Ohne diese Konfiguration bleiben `/api/*`, `/auth/*` und `/healthz`
geschlossen (`503`); kein eingeloggter Verwaltungsbereich wird vorgetäuscht.
Die automatische Preview-Bereitstellung wurde im Branch-Control-Dialog auf
„None“ gesetzt und gespeichert, konnte nach dem Transportabbruch aber nicht
erneut ausgelesen werden. Behandle die Persistenz daher als unbestätigt. Falls
Preview-Builds aktiv sind oder später aktiviert werden, ist Cloudflare Access
erforderlich, weil Preview-Adressen sonst öffentlich sind.

GitHub branch protection: der Nutzer hat den erforderlichen Check `test`
ausdrücklich freigegeben. Der Repository-Eigentümer ist ein persönliches Konto;
die Rulesets-API antwortet aktuell mit HTTP 403:
`Upgrade to GitHub Pro or make this repository public to enable this feature.`
GitHub Free ermöglicht keine erzwungenen Branch-Regeln für private Repositories.
GitHub dokumentiert Pro für private persönliche Repositories sowie Team/Enterprise
für private Organisations-Repositories. Wegen des verbindlichen 0-€-Budgets und
der privaten Sichtbarkeit wurde weder ein Upgrade noch eine Veröffentlichung
vorgenommen. `test` läuft in CI, ist aber kein serverseitiges Merge-Gate.
Der Cloudflare-Pages-Build führt Tests und statische Prüfung vor dem Deploy aus;
ein fehlgeschlagener Pflichtcheck blockiert dadurch die Veröffentlichung, nicht
den Merge. Bis ein zulässiger Plan aktiviert wird, gilt daher als manueller
Arbeitsablauf: Änderungen nur per PR, `test` für genau den PR-Head erfolgreich
abwarten und vor dem Merge erneut prüfen; kein direkter Push auf `main`. Das ist
eine Prozessregel und keine technische Sperre gegen einen Maintainer. Quellen:
[GitHub-Verfügbarkeit geschützter Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches) und [Verfügbarkeit von Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

Alternative Wrangler Direct Upload: Sie vermeidet eine Cloudflare-App mit
Schreibzugriff auf GitHub, erfordert aber einen Cloudflare-API-Token mit
`Cloudflare Pages Edit`. Diese Account-Berechtigung kann Pages-Projekte im
gesamten Cloudflare-Konto erstellen, ändern und löschen. Außerdem lässt sich
ein Direct-Upload-Projekt später nicht auf Git-Integration umstellen. Deshalb
wurde auch dieser Weg nicht begonnen. Ein GitHub-Actions-Workflow würde den
Token als Repository-Secret benötigen. Der GitHub-Free-Account hat ein
Actions-Budget von $0 mit Ausgabenblockierung; nach Erschöpfung der enthaltenen
Usage werden Läufe blockiert. Der Actions-Deployment-Workflow ist nicht
eingerichtet. Der bestehende GitHub-verbundene Pages-Weg wurde vom Nutzer
bestätigt; Wrangler Direct Upload wird nicht zusätzlich eingerichtet.

Die vollständige Control-Plane setzt OAuth, privates Control-Repository,
begrenzten GitHub-Token, Production-KV-Binding und vollständige Secrets voraus.
Ohne diese Werte liefert `/api/me` 503; Frontend und Administrationsbereich
bleiben verborgen. Dieser sichere Fail-Closed-Zustand ersetzt keinen
funktionsfähigen Control-Plane-Betrieb.

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
- Workers KV Free: 100.000 Reads, 1.000 Writes und 1.000 Deletes pro Tag sowie
  1 GB Speicher. Quotenfehler führen im vorhandenen KV-Sessionstore zu 503.
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
- Produktionsupdates erfolgen nur über erfolgreiche Commits auf main. Pages
  Git-Integration stellt für Commits auf main automatisch bereit; Preview-
  Deployments bleiben deaktiviert.
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

