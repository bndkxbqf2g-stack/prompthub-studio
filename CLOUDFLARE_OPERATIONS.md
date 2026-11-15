# PromptHub Studio – Cloudflare Pages Betrieb

## Verifizierter Stand

- Pages-Konfiguration und Pages-Function-Adapter sind lokal vorbereitet. Es
  wurde noch kein Cloudflare-Projekt erstellt oder veröffentlicht.
- wrangler.toml beschreibt Cloudflare Pages; der bisherige Workers Static
  Assets-Modus bleibt in wrangler.worker.toml erhalten.
- functions/[[path]].js leitet ausschließlich über _routes.json ausgewählte
  API-, Auth- und Health-Anfragen an denselben gehärteten Worker weiter. Statische
  PWA-Dateien werden direkt ausgeliefert.
- Fehlende Runtime-Secrets oder das KV-Binding führen auf API-Routen zu 503.
  Es gibt keine lokale Mock-Authentifizierung im Cloudflare-Modus. Ohne
  Konfiguration bleibt die PWA-Hülle sichtbar, die Control API aber nicht
  verfügbar.
- Das GitHub-Repository
  `bndkxbqf2g-stack/prompthub-studio` ist weiterhin privat. Der Cloud-Browser
  ist erreichbar. Workers & Pages zeigt „No projects found“ und 0/100.000
  Requests für den heutigen UTC-Tag. Das passt zum dokumentierten Free-Limit;
  die Billing-Seite blieb jedoch im Ladezustand, daher ist die Abrechnung nicht
  vollständig geprüft.
- Die Cloudflare-GitHub-OAuth-Verbindung wurde autorisiert. Die anschließende
  GitHub-App-Installation wurde nicht bestätigt: standardmäßig war „All
  repositories“ ausgewählt; die App fordert Schreibzugriff auf Administration,
  Checks, Code, Deployments und Pull Requests. Auch nach Auswahl nur des
  PromptHub-Repositories bliebe dieser Umfang weitreichend. Es wurde kein
  Repositoryzugriff installiert und kein Cloudflare-Projekt angelegt.
- Wrangler, Cloudflare-API-Token, Pages-Projekt, KV-Namespace, GitHub-OAuth-App
  und Runtime-Secrets fehlen weiterhin. Es wurden keine Ressourcen erstellt,
  keine Abrechnungsoptionen geändert und kein Deployment gestartet.
- GitHub steht auf Free; der Actions-Budgetwert beträgt $0.00 und zeigt
  „Usage blocked“. Actions-Billable-Usage nach Rabatten ist $0; die enthaltene
  Free-Nutzung bleibt begrenzt und ein Lauf kann nach Erschöpfung blockieren.
- Es wurden keine Cloudflare-Ressourcen, kostenpflichtigen Tarife oder
  Abrechnungsfunktionen aktiviert.

## Pages-Konfiguration

| Einstellung | Wert |
|---|---|
| Projektname | prompthub-studio (vor Erstellung im Konto auf Kollision prüfen) |
| GitHub-Repository | bndkxbqf2g-stack/prompthub-studio (privat) |
| Produktionsbranch | main |
| Root-Verzeichnis | Repository-Root |
| Build-Befehl | npm ci && npm test && npm run check |
| Build-Ausgabe | src/pwa |
| Node.js im Build | NODE_VERSION=22 |
| Pages Functions | functions/[[path]].js |
| Funktionsrouten | /api/*, /auth/*, /healthz |

Die statischen Dateien benötigen keinen Bundler. Pages bündelt die Functions
aus dem functions/-Verzeichnis. Der Build-Befehl muss vor dem Upload erfolgreich
enden; Cloudflare bewertet ihn anhand seines Exitcodes. wrangler.toml enthält
keine Tokens oder namespace-IDs. Das KV-Binding SESSIONS wird nach Prüfung des
Free-Kontos im Pages-Projekt angelegt und ausschließlich an Production gebunden.

## Deployment-Wege und Berechtigungen

Der empfohlene Pages-Git-Workflow benötigt die Cloudflare-GitHub-App. Der
Installationsdialog fordert für jedes ausgewählte Repository Lese- und
Schreibzugriff auf Administration, Checks, Code, Deployments und Pull Requests.
Das ist ein weiter Berechtigungsumfang. Vor der Installation ist eine separate
Nutzerfreigabe erforderlich. Falls freigegeben:

1. Unter „Only select repositories“ ausschließlich
   `prompthub-studio` auswählen. „All repositories“ niemals auswählen.
2. Projekt `prompthub-studio` mit Git-Integration erstellen. Das Repository
   bleibt privat.
3. Produktionsbranch auf `main` setzen. Preview-Branch auf `None` stellen,
   bis Preview-Zugriff und Secrets separat geprüft wurden.
4. Build-Befehl, Ausgabeordner und `NODE_VERSION=22` gemäß obiger Tabelle
   eintragen. Build Watch Paths auf * setzen und `.prompthub/*` ausschließen,
   falls das Control-Repository dasselbe Repository ist.
5. Für Pages Functions unter Settings → Runtime `Fail closed` einstellen.
6. Ein Workers-KV-Free-Namespace-Binding `SESSIONS` ausschließlich in der
   Production-Umgebung hinzufügen. Nicht auf einen bezahlten Plan upgraden,
   falls ein Kontingent erschöpft ist.
7. Produktionsvariablen und -Secrets im Cloudflare-Projekt setzen. Werte niemals
   ins GitHub-Repository, in Chat-Nachrichten, Build-Logs oder Frontend schreiben:

   - GITHUB_REPOSITORY: privates Control-Repository in owner/name-Form.
   - GITHUB_BRANCH: main.
   - GITHUB_ALLOWED_LOGINS: explizite GitHub-Login-Allowlist.
   - GITHUB_TOKEN: serverseitiges, fein begrenztes Token für das Control-
     Repository und die ausdrücklich verbundenen Projekt-Repositories.
   - GITHUB_CLIENT_ID und GITHUB_CLIENT_SECRET: GitHub-OAuth-App.
   - SESSION_SECRET: kryptografisch zufälliger Wert mit mindestens 32 Zeichen.
   - SESSIONS: KV-Binding, kein Text-Secret.

   Die OAuth-Callback-URL ist
   https://<tatsächliche-pages-Adresse>/auth/github/callback; sie muss mit der
   tatsächlich angelegten .pages.dev-Adresse übereinstimmen. Secrets für
   Preview-Deployments werden nicht angelegt.
8. Erst nach dem Speichern aller Production-Bindings einen Pages-Build ausführen.
   Build-Logs, Deployment-Commit, Function-Routen, Free-Tarif und Fail-Closed-
   Einstellung kontrollieren. Kein erfolgreicher Status wird aus einer
   fehlenden oder leeren Check-Antwort abgeleitet.

Alternative Wrangler Direct Upload: Sie vermeidet eine Cloudflare-App mit
Schreibzugriff auf GitHub, erfordert aber einen Cloudflare-API-Token mit
`Cloudflare Pages Edit`. Diese Account-Berechtigung kann Pages-Projekte im
gesamten Cloudflare-Konto erstellen, ändern und löschen. Außerdem lässt sich
ein Direct-Upload-Projekt später nicht auf Git-Integration umstellen. Deshalb
wurde auch dieser Weg nicht begonnen. Ein GitHub-Actions-Workflow würde den
Token als Repository-Secret benötigen. Der GitHub-Free-Account hat ein
Actions-Budget von $0 mit Ausgabenblockierung; nach Erschöpfung der enthaltenen
Usage werden Läufe blockiert. Der Actions-Deployment-Workflow ist nicht
eingerichtet. Kein Weg wird aktiviert, bevor der jeweilige Berechtigungsumfang
freigegeben ist.

Beide Deployment-Wege setzen vor produktiver Freigabe OAuth, privates Control-
Repository, begrenzten GitHub-Token, Production-KV-Binding und vollständige
Secrets voraus. Ohne diese Werte liefert `/api/me` 503; Frontend und
Administrationsbereich bleiben verborgen. Dieser sichere Fail-Closed-Zustand
ersetzt keinen funktionsfähigen Produktionsstart.

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

- HTTPS und die endgültige *.pages.dev-Adresse sind erst nach einem
  erfolgreichen Deployment verifiziert. Safari auf dem iPhone: veröffentlichte
  Adresse öffnen → Teilen → Zum Home-Bildschirm.
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

