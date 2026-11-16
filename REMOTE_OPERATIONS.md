# Remote Operations & Approval Manager

## Capability audit

Stand: 2026-11-16. Diese Matrix unterscheidet Codex-Funktionen der aktuellen
Entwicklungssitzung von Funktionen, die einer späteren PromptHub-Laufzeit zur
Verfügung stehen.

| Fähigkeit | Nachgewiesener Zustand | Konsequenz |
|---|---|---|
| ChatGPT/Codex Remote am Mobilgerät | Native Codex-Funktion; sie ist vom Codex-Cloud-Runner getrennt. | Native Fragen und Berechtigungen bleiben in Codex Remote. PromptHub leitet sie nicht weiter und simuliert sie nicht. |
| Codex Cloud | `Default environment` (`asenvcfg_base`) ist `ready` und `runnable`, hat aber `repositories: []`. | Kein PromptHub-Repository-Cloud-Job kann damit gestartet werden. Die Cloud-Einrichtung muss zuerst ein Repository enthalten. |
| Computer Use im Codex-Desktop | In dieser Sitzung sind Codex und Chrome sichtbar; es gibt keinen verbundenen In-App-/Cloud-Browser-Tab. | Desktop-UI-Steuerung ist keine dauerhafte PromptHub-Browser-API und kein iPhone-Test. Keine Browseraktionen werden als PWA-Backend angeboten. |
| GitHub | PromptHub-Repository und Actions sind vorhanden; GitHub-Connector und lokaler Git-Zugriff sind in der Sitzung verfügbar. | GitHub bleibt Quellcode-, CI- und Datenbasis. Providerzugriff in Codex stellt der veröffentlichten Function keine Zugangsdaten bereit. |
| Netlify Connector | Free-Team `Booolio` (`bndkxbqf2g-stack`). Projekt `prompthub-studio` (`834e2ac8-5324-4b2c-bcb0-9c65a228e43b`) ist mit `bndkxbqf2g-stack/prompthub-studio` auf `main` verknüpft. Deploy `6afb55fca23ea397af718ef7` (Commit `3eca5bb`) steht auf `ready`; `requiresSSOTeamLogin=true` für alle Deploys. | HTTPS-Root liefert die PWA. `/healthz` liefert `production_api_disabled`, weil keine Production-Secrets/-Konfiguration existieren. Das Projekt bleibt privat/SSO-geschützt; der genaue Credit-Kontostand wurde nicht gelesen. |
| Cloudflare | Vom Nutzer abgewählt und pausiert. | Wird nicht als Ersatzweg reaktiviert. |
| PWA-Push | Kein Push-Abonnement, Push-Service oder Background-Service konfiguriert. | Die PWA nutzt eine abrufbare Inbox; der Aktualisierungsbutton holt den aktuellen Zustand. |

### Offizielle Codex-Referenzen

- [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)
- [Using Codex Cloud](https://help.openai.com/en/articles/20001545-using-codex-cloud)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)

Die dokumentierten Codex-Remote- und Cloud-Funktionen sind keine von PromptHub
aufrufbare API. Cloud-Umgebungen werden über Codex bereitgestellt; die aktuelle
Umgebung ist nicht mit einem Repository verbunden. Die offizielle Computer-Use-
API ist kein vorhandener, kostenloser und dauerhafter PWA-Runner und setzt eine
von der Anwendung bereitgestellte Laufzeitintegration voraus.

## Implementierter Umfang

- Projektbezogene Anfragen werden mit `ApprovalManager` atomar im vorhandenen
  GitHub-Control-Repository gespeichert. Die Speicherschemata bleiben mit
  bestehenden Projektdateien kompatibel.
- Eine Anfrage enthält Projekt, Dienst, Aktion, Grund, Berechtigungen,
  Auswirkungen, Sicherheitsrisiken, serverseitige Kosten-/Kontingentprüfung,
  Ablaufdatum, Status, Idempotenzschlüssel und Auditverlauf.
- Entscheidende Benutzeraktionen benötigen eine serverseitig authentifizierte
  GitHub-Sitzung. Der handelnde Nutzer wird aus der Session entnommen, nie aus
  dem Request-Body. Inbox, Einzelansicht, Entscheidung, Resume und Abbruch sind
  an den ursprünglichen Antragssteller gebunden; lokale Sitzungen dürfen nicht
  entscheiden oder abbrechen.
- Eine Freigabe gilt nur für den einen gespeicherten Aktionstyp. Native Codex-
  Freigaben werden abgewiesen und müssen in Codex Remote beantwortet werden.
- Der Prompt-Designer erkennt genannte Dienste und generische Hosting-/Datenbank-
  Hinweise deterministisch aus Wunsch und Anhängen. Ein begrenzter README-/Regel-/
  Workflow-Snapshot kann einen ungeprüften Repository-Verweis zeigen. Die PWA kann
  daraus ein Freigabeformular vorausfüllen; es wird dabei weder ein Anbieter
  verbunden noch eine Aktion ausgelöst. Nicht genannte Anbieter bleiben
  unausgewählt.
- Laufzeitkosten werden nur als `verified_zero` akzeptiert, wenn sowohl einmalige
  als auch laufende Kosten 0 € sind und ein frischer Provider-Kontingentreadback
  die benötigten Credits abdeckt. Kosten-, Kontingent- und Berechtigungsreadbacks
  müssen Dienst, Projekt und Aktion exakt binden und höchstens eine Stunde alt
  sein. Unbekannte, veraltete, bezahlte oder erschöpfte Nutzung sperrt die Aktion.
- Providerberechtigungen müssen bei Anforderung und unmittelbar vor Ausführung
  serverseitig bestätigt sein. Die im Browser angeforderten Scopes sind kein
  Berechtigungsnachweis.
- Die API unterstützt `GET /api/automation/status`, `GET/POST
  /api/automation/approvals`, sowie an den Antragssteller gebundene Einzelansicht,
  Entscheidung, Abbruch und Resume-Routen unter `/api/automation/approvals/:id`.
- Derselbe Request-/Entscheidungs-Idempotenzschlüssel erzeugt keine zweite
  Freigabe oder Ausführung. Ein abgelaufener oder nicht sicher auflösbarer
  Ausführungslease wird zu `execution_unknown`; er wird nicht automatisch erneut
  abgesendet.
- Eine Ausführung braucht einen serverseitig registrierten Adapter, der
  providerseitig garantierte Idempotenz ausdrücklich deklariert. Der stabile
  Idempotenzschlüssel wird dem Adapter übergeben und muss exakt im Rückgabebeleg
  erscheinen. Die persistierte Statusänderung verhindert parallele Starts über
  Managerinstanzen; Provideradapter müssen den Schlüssel zusätzlich wirksam
  erzwingen und das übergebene AbortSignal bei Leaseverlust beachten.
  Lease-Erneuerungsfehler brechen den Adapter mit einem Signal ab und führen zu
  `execution_unknown`; ein unklarer Providerzustand wird nie erneut gesendet.
  Der Adapter muss einen Rückgabebeleg liefern, der an den stabilen
  Idempotenzschlüssel gebunden ist, und ein
  separat registriertes Provider-Readback-Verifier-Modul bereitstellen, damit
  dessen Nachweis denselben eingereichten Beleg referenziert, bevor `succeeded`
  gesetzt wird. Ohne Adapter bleibt die Anfrage
  `awaiting_executor`; ohne getrennt registrierte Verifikation bleibt sie
  `awaiting_verification`. Nicht verifizierte Providerbelege werden nach 24
  Stunden zu `execution_unknown` und erfordern manuelle Abstimmung.
- Anfragezahl und Auditverlauf sind begrenzt; Logs enthalten keine Anmeldedaten,
  Providerfehlertexte oder vollständigen Requests.

## Aktuelle Betriebsgrenzen

Der Produktions-Standard hat absichtlich keine `costPolicy`, keine
`permissionPolicy` und keinen Provider-Ausführungsadapter. Daher gilt:

- Kosten-/Kontingentstatus: `unknown`; Aktionen sind gesperrt.
- Providerberechtigungen: `not_configured`; Aktionen sind gesperrt.
- Provider-Ausführung: `not_configured`; nichts wird an Netlify, GitHub oder
  andere Dienste gesendet.
- Codex Cloud und PWA-Browsersteuerung: nicht mit der PromptHub-Laufzeit
  verbunden.
- Push: nicht verfügbar; Inbox-Polling ist aktiv.
- Netlify-Projekt: mit GitHub verbunden und erfolgreich auf Free deployed;
  PWA-Root ist unter `https://prompthub-studio.netlify.app/` mit SSO geladen.
  `/healthz` meldet `production_api_disabled`. Es bestehen keine Production-
  Secrets, kein OAuth-Livebetrieb und kein automatischer Kontingent-Readback.
- Eine echte iPhone-Installation, Live-OAuth-, Control-API- und Provider-
  Ausführungsprüfung ist offen. Lokale HTTP-Integrationstests gelten nicht als
  Live- oder iPhone-Abnahme.

## Freigabestatus und Bedienung

Die PWA zeigt eigene Freigabeanfragen aus verbundenen Projekten in der
abrufbaren Inbox an.
Der Nutzer kann genehmigen, ablehnen, Informationen anfordern, zurückstellen
oder eine noch nicht laufende eigene Anfrage abbrechen. Genehmigen ist in der
Oberfläche und API gesperrt, bis Kosten, Freikontingent und Berechtigungen
serverseitig nachgewiesen sind. Der Server führt dieselben Prüfungen unabhängig
von der UI aus.

Empfohlene Statusdeutung:

- `pending`, `deferred`, `info_requested`: wartet auf menschliche Entscheidung.
- `blocked_cost`, `blocked_permissions`: bleibt gesperrt; erst ein frischer
  Providerreadback kann diese Sperre ändern.
- `approved`, `awaiting_executor`: Entscheidung ist gespeichert, aber es gibt
  noch keine Ausführung. Diese Freigaben laufen mit ihrem beantragten Ablaufdatum
  ab.
- `executing`: idempotente Ausführung mit kurzlebigem Lease.
- `awaiting_verification`: Provider lieferte einen Beleg; Abschluss ist noch
  nicht unabhängig bestätigt. Nach Ablauf der 24-Stunden-Verifikationsfrist wird
  manuelle Abstimmung verlangt.
- `execution_unknown`: Ergebnis unklar; manuelle Abstimmung erforderlich,
  kein automatischer Retry.
- `succeeded`: nur nach bestätigtem Provider-Readback.

## Noch nötige Integrationen vor Live-Abnahme

1. Netlify-GitHub-Deployment ist auf `main` eingerichtet; der echte PWA-Zugriff
   bleibt hinter Team-SSO. Vor einer Freischaltung für alle braucht es die
   gesonderte Entscheidung des Nutzers.
2. Production-Context-Secrets, GitHub OAuth-App und privates Control-Repository
   müssen im Provider eingerichtet und serverseitig geprüft sein.
3. Ein maschinenlesbarer, frischer Netlify-Teamkontingent-Readback muss als
   `costPolicy` angebunden werden. Fehlt der Readback, muss die Aktion gesperrt
   bleiben.
4. Provider OAuth-Berechtigungen müssen als `permissionPolicy` gelesen werden.
5. Nur einzeln freigegebene Adapter dürfen feste Aktionen ausführen. Jeder
   Adapter braucht stabile Idempotenz, sichere Resume-Behandlung und ein separat
   registriertes Provider-Readback-Verifier-Modul.
6. Unabhängige Sicherheitsprüfung der Auth-/Freigabecodes, CI und echte
   Smartphone-Tests müssen vor der Erstabnahme nachgewiesen werden.

Keine dieser offenen Integrationen darf durch ein Chat- oder PWA-Approval eine
native OAuth-Zustimmung, Netlify-SSO-Anmeldung, Codex-Berechtigungsabfrage,
Budgetprüfung oder externe Providerbestätigung ersetzen.
