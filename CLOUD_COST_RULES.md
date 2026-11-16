# PromptHub Studio – Cloud- und Kostenregeln

## Geschütztes Budget

- Zusätzliche laufende Cloud-, KI-, Hosting-, Monitoring- und Entwicklungsdienste:
  **0 € pro Monat**.
- Kein kostenpflichtiger Tarif, Abrechnungsmodus, kostenpflichtige Ressource,
  API-Aufruf oder Upgrade ohne ausdrückliche Zustimmung des Nutzers.
- Bei fehlender oder nicht verifizierbarer Kostenkontrolle werden neue Cloud-Jobs
  pausiert. Sicherheit und Datenintegrität haben Vorrang vor Verfügbarkeit.
- Die PWA und Control API sollen statisch/serverlos betreibbar sein. Ein
  dauerhaft laufender Server ist keine Voraussetzung. Runner können offline sein.
- GitHub bleibt dauerhafte Quelle für Quellcode, Jobs, CI und dokumentierte
  Zustände. Zugangsdaten liegen ausschließlich in serverseitigen Secrets.

## Verifizierter Stand

- GitHub MCP ist mit dem Nutzerkonto verbunden. Das Quell-Repository
  `bndkxbqf2g-stack/prompthub-studio` wurde am 2026-11-15 auf ausdrückliche
  Nutzeranweisung öffentlich gestellt. Ein separates privates Control-
  Repository wurde am 2026-11-15 erstellt; auf `main` liegt die verifizierte
  Initialdatei `.prompthub/active-jobs.json` mit Schema-Version 1 und leerer
  Lease-Liste. Ein Runtime-Token und die Verbindung zur Laufzeit sind noch nicht
  eingerichtet.
- Die Codex-App meldet eine lauffähige Standard-Cloud-Umgebung, aber ohne
  hinterlegte Repositories. Daraus folgt keine nachgewiesene autonome Ausführung
  für dieses Projekt.
- Die offiziellen OpenAI Agents-API-/Hosted-Sandbox-Wege verwenden API- und
  Container-Abrechnung. Sie sind daher nicht als 0-€-Ausführung zugelassen.
- Für eine PWA direkt nutzbare, nachweislich kostenlose Codex-LLM-API ist kein
  verfügbarer Zugang nachgewiesen. Prompt-Designer verwendet deshalb bis zu
  einer belegten Integration einen klar markierten strukturierten Fallback.
- Netlify Free ist laut aktueller offizieller Dokumentation ein möglicher
  0-€-Serverless-Kandidat mit 300 Credits je Abrechnungszeitraum, Hard Limit
  und ohne Auto-Recharge. Bei Erschöpfung pausiert Netlify alle Team-Sites.
  Der Free-Tarif wurde im Dashboard bestätigt; kontobezogene Salden werden
  nicht in diesem öffentlichen Repository gespeichert. Es existierte zum
  Dashboard-Readback noch kein Netlify-Projekt, also kein App-Verbrauchsnachweis.
  Aktuelle Raten: 15 Credits je Produktions-Deploy, 10 je GB-Stunde Compute,
  20 je GB Bandbreite und 2 je 10.000 Requests; alle Meter teilen den
  Guthabenpool. Kein dokumentierter öffentlicher API-Endpunkt liefert den
  vollständigen Team-Credit-Readback. Cloud-Jobs bleiben bei unbekanntem
  Verbrauch gesperrt.
- Ein aufrufbares Netlify-Connector-Tool ist in der aktuellen Codex-Tool-Sitzung
  nicht verfügbar. Netlify-Projekt, Runtime-Secrets und Deployment sind deshalb
  nicht eingerichtet; die vorhandene Job-Sperre bleibt aktiv.
- Vercel Hobby wird für PromptHub-Daten nicht als Kandidat geführt: die aktuellen
  Terms beschränken Hobby auf persönliche, nicht-kommerzielle Nutzung und
  erlauben Training/Weitergabe von Hobby-Customer-Content für KI-/ML-Modelle.
  Es wurde kein Opt-out nachgewiesen. Vercel ist nicht verbunden oder deployed.
- GitHub Actions ist für CI aktiviert. GitHub Pages ist für das öffentliche
  Repository aktiv und stellt statische Dateien bereit; die PWA liegt unter
  `/src/pwa/`. GitHub Pages hostet keine serverseitige Control API.
- GitHub zeigt den Plan `GitHub Free`, Actions-Billable-Usage von $0 nach
  Included-Usage-Rabatten und ein Actions-Monatsbudget von $0.00 mit Status
  „Usage blocked“. Included-Usage-Alerts sind eingeschaltet. Bei erreichtem
  kostenfreien Kontingent blockiert GitHub Actions statt Mehrverbrauch zu
  berechnen; ein CI-Lauf bleibt deshalb von der verbleibenden Free-Usage abhängig.
- Für das öffentliche Quell-Repository verwendet die CI nur Standard-
  GitHub-Runner, darunter `macos-latest` und `macos-15-intel`. GitHub dokumentiert
  Standard-Runner in öffentlichen Repositories als kostenlos und unbegrenzt.
  Der macOS-Job läuft nur bei öffentlich sichtbarem Repository; der erforderliche
  Check `test` schlägt fehl, wenn der macOS-Job übersprungen wird oder fehlschlägt.
  So wird bei einem später privaten Repository kein macOS-Free-Runner gestartet
  und kein Merge ohne diese Prüfung freigegeben. Größere Runner werden nicht
  verwendet.
- GitHub Pages ist der aktive statische PWA-Host unter
  `https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/`; es gibt dort
  keine Control API. Cloudflare ist abgewählt. Das Pages-Projekt
  `prompthub-studio` ist pausiert und noch mit dem öffentlichen Quell-Repository
  verbunden. Das zuletzt im Dashboard beobachtete erfolgreiche Deployment war
  `7f73f6ff-0294-4c4e-800c-d9509b48709c` für Commit
  `8f0fdc25e90f0ba32d0ed79c724ff136aed14881`; die alte Veröffentlichung unter
  `https://prompthub-studio.pages.dev` bleibt erreichbar. Deployments sind
  pausiert; Preview-Builds wurden auf `None` gesetzt, konnten nach dem
  Browserausfall aber nicht erneut ausgelesen werden. Das Projekt wurde nicht
  gelöscht; die endgültige Löschung wartet auf eine gesonderte Bestätigung.
- Die Control-Plane-Runtime ist nicht eingerichtet: kein `SESSIONS`-KV-Binding,
  keine PromptHub-GitHub-OAuth-App und keine Runtime-Secrets. Deshalb geben
  `/api/me` und `/healthz` HTTP 503; es gibt keine funktionsfähige Anmeldung,
  Auftragsverwaltung oder Cloud-Ausführung. Das Quell-Repository ist öffentlich;
  das separate private Control-Repository ist vorhanden, aber nicht mit einer
  Laufzeit verbunden.
- Der Cloudflare-Account zeigte bei einer späteren schreibgeschützten Prüfung
  den Tarif `Workers Free`. Die Seite für abrechnungsrelevante Nutzung zeigte
  nur für Spectrum „No data“ und weist auf tägliche Aktualisierung hin; das ist
  kein vollständiger accountweiter Kosten- oder Verbrauchsnachweis. Es wird
  daher keine accountweite Aussage „0 € abgerechnet“ getroffen.
- In der letzten Prüfung wurde kein kostenpflichtiger Tarif aktiviert. Die
  beobachtete Workers-Free-Einstellung und die unvollständige Nutzungsansicht
  belegen jedoch weder vollständige Abrechnungsdaten noch Kontostand oder
  Zahlungsmittel. Cloudflare wird nicht weiter als Host eingerichtet.
- Das Projekt ist weiterhin mit GitHub verbunden, aber pausiert. Es wurden in
  der letzten Prüfung keine Cloudflare-Einstellungen geändert. Ein zusätzlicher
  GitHub-Actions-Deployment-Workflow ist nicht eingerichtet; der GitHub-
  Actions-Budgetstopp blockiert Mehrverbrauch nach erschöpfter inkludierter
  Free-Usage.
- Der Cloudflare-Tarifstand wurde am 2026-11-15 ausschließlich anhand der
  offiziellen Dokumentation recherchiert: Free Workers bis 100.000 Worker-
  Requests/Tag und 10 ms CPU je Aufruf; statische Assets sind kostenfrei und
  unbegrenzt. Workers KV Free umfasst 100.000 Reads, 1.000 Writes/Deletes pro
  Tag und 1 GB Speicher; bei überschrittenen Free-Kontingenten schlagen weitere
  Operationen fehl. Workers Paid kostet mindestens 5 USD/Monat und ist explizit
  ausgeschlossen. Das sind dokumentierte Tariflimits, kein Nachweis über das
  Konto oder dessen Abrechnungseinstellungen.
- Die API-KV-Fehlerbehandlung stoppt mit `503`; der Worker-Code enthält keinen
  Tarifwechsel und keinen Cloud-Codex-Executor. Ist kein Runner vorhanden, zeigt
  `/healthz` `runner_status: not_configured`. Die Cloud-PWA-Ausführung ist daher
  vorbereitet, aber erst nach Einrichtung und externem Funktionstest abnehmbar.
- Der Nutzer hat `test` als erforderlichen GitHub-Check ausdrücklich
  freigegeben, das Quell-Repository öffentlich gestellt und automatische Merges
  nach bestandenen Pflichtchecks ausdrücklich autorisiert. Der letzte
  erfolgreiche Branch-Protection-Readback bestätigte für `main` den Check
  `test`, `strict=true` und Admin-Enforcement; ein aktueller Readback ist über
  die verbundene Schnittstelle nicht verfügbar. Der Readback zeigte außerdem,
  dass die Regel keinen PR verlangt und direkte Pushes nicht beschränkt.
  GitHub meldete `allow_auto_merge=true`. Quellen:
  [GitHub-Verfügbarkeit geschützter Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [Branch-Protection-API](https://docs.github.com/en/rest/branches/branch-protection).

## Laufzeitregeln

- Hard-Limits und Quotenanbieter-Fehler stoppen betroffene Aufträge; sie lösen
  niemals automatisch ein Upgrade oder eine alternative kostenpflichtige API aus.
- Lokale Limits sind zusätzlich zu Anbieterlimits einzuhalten. Wenn gemeinsamer
  Verbrauch nicht zuverlässig messbar ist, wird der Runner deaktiviert.
- UI-Verfügbarkeit und Ausführungsverfügbarkeit sind getrennte Zustände:
  `control_plane_online`, `runner_online`, `quota_paused` oder `not_configured`.
- Vor einer Aktivierung sind Budget, Abrechnungsstatus, Benachrichtigungen,
  Schwellenwert und Verhalten bei Überschreitung zu dokumentieren.
- Cloudflare Pages führt Functions nur für `/api/*`, `/auth/*` und `/healthz`
  aus; `src/pwa/_routes.json` hält PWA-Dateien auf dem unbegrenzten Static-Asset-
  Pfad. `Fail closed` ist im Pages-Runtime-Dashboard gespeichert und verifiziert;
  diese Einstellung muss bei erschöpftem Pages-Functions-Kontingent erhalten
  bleiben. Der getrennte Workers-Modus darf `run_worker_first` nicht global
  aktivieren.
- Jede Kosten-/Kontingententscheidung erhält Datum, Quelle und tatsächlichen
  Nachweis. Annahmen werden nicht als verifizierte Tarife ausgegeben.

## Quellen

- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
  (abgerufen am 2026-11-15).
- [Cloudflare Static Assets: Billing and Limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
  (abgerufen am 2026-11-15).
- [Cloudflare Workers KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
  (abgerufen am 2026-11-15).
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
  (abgerufen am 2026-11-15).
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
  (abgerufen am 2026-11-15; Projektmodus ist nicht auf Git-Integration umstellbar).
- [Cloudflare Pages Functions und Direct Upload](https://developers.cloudflare.com/pages/functions/get-started/)
  (abgerufen am 2026-11-15; Functions-Ordner muss über Wrangler bereitgestellt werden).
- [Cloudflare API-Token-Berechtigungen](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
  (abgerufen am 2026-11-15; Cloudflare Pages Edit erstellt, ändert und löscht Pages-Projekte).
- [GitHub Actions Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
  (abgerufen am 2026-11-15; private Runner verbrauchen enthaltene Free-Usage und werden ohne Mehrkostenkontingent blockiert).
- [GitHub: Choose a runner for a job](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)
  (abgerufen am 2026-11-15; Standard-GitHub-Runner sind für öffentliche Repositories kostenlos und unbegrenzt).
- [GitHub Free Plan enthaltene Nutzung](https://docs.github.com/en/billing/reference/product-usage-included)
  (abgerufen am 2026-11-15).
- [Netlify Free Hard Limit und 300 Credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
  (abgerufen am 2026-11-16).
- [Netlify Self-Serve-Vertrag: Customer Content und KI-Training](https://www.netlify.com/pdf/self-serve-subscription-agreement.pdf)
  (abgerufen am 2026-11-16; § 6.2).
- [Netlify API-Referenz mit Build-Status-Endpunkt](https://open-api.netlify.com/)
  (abgerufen am 2026-11-16; kein vollständiger teamweiter Credit-Endpunkt in der öffentlichen Referenz gefunden).
- [Netlify Credit-Verbrauch und Hard Limit](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
  (abgerufen am 2026-11-16; Produktions-Deploy, Compute, Bandbreite, Requests und Pause bei erschöpftem Guthaben).
- [Netlify Functions: Usage and Billing](https://docs.netlify.com/build/functions/usage-and-billing/)
  (abgerufen am 2026-11-16; Default-RAM und GB-Stunden-Abrechnung).
- [Netlify Credit-Raten aktualisiert im April 2026](https://www.netlify.com/changelog/2026-04-14-pricing-updates-april-2026/)
  (abgerufen am 2026-11-16).
- [Vercel Terms of Service: Hobby und Customer Content/AI-Training](https://vercel.com/legal/terms)
  (abgerufen am 2026-11-16; Terms zuletzt geändert am 2026-10-19).
- [Vercel Hobby Plan, Limits und Überschreitungsverhalten](https://vercel.com/docs/plans/hobby)
  (abgerufen am 2026-11-16; konkretes Konto nicht geprüft).
- [Vercel Usage CLI, JSON und Projektgruppierung](https://vercel.com/docs/cli/usage)
  (abgerufen am 2026-11-16; tatsächlicher Account-Readback nicht durchgeführt).
- [Vercel Blob Hobby-Kontingente](https://vercel.com/docs/vercel-blob/usage-and-pricing)
  und [private Blob-Speicherung](https://vercel.com/docs/vercel-blob/private-storage)
  (abgerufen am 2026-11-16).
