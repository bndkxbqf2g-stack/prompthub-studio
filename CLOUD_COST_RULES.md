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
- GitHub Actions ist für CI aktiviert. GitHub Pages ist für das öffentliche
  Repository aktiv und stellt statische Dateien bereit; die PWA liegt unter
  `/src/pwa/`. GitHub Pages hostet keine serverseitige Control API.
- GitHub zeigt den Plan `GitHub Free`, Actions-Billable-Usage von $0 nach
  Included-Usage-Rabatten und ein Actions-Monatsbudget von $0.00 mit Status
  „Usage blocked“. Included-Usage-Alerts sind eingeschaltet. Bei erreichtem
  kostenfreien Kontingent blockiert GitHub Actions statt Mehrverbrauch zu
  berechnen; ein CI-Lauf bleibt deshalb von der verbleibenden Free-Usage abhängig.
- Cloudflare Pages `prompthub-studio` bleibt mit dem öffentlichen Quell-
  Repository verbunden; die letzte Veröffentlichung
  `10eb0d77-7b19-4edc-9adc-548518e098f7` für Commit
  `504477dc35dab908c8b3755550866bca071c72db` ist weiterhin unter
  `https://prompthub-studio.pages.dev` erreichbar. Automatische Production-
  Deployments sind deaktiviert, Preview-Deployments stehen nach Dashboard-
  Readback auf `None`. Es wurde kein Projekt oder Deployment gelöscht.
  `Fail closed` bleibt im Dashboard gespeichert und verifiziert.
- Die Control-Plane-Runtime ist nicht eingerichtet: kein `SESSIONS`-KV-Binding,
  keine PromptHub-GitHub-OAuth-App und keine Runtime-Secrets. Deshalb geben
  `/api/me` und `/healthz` HTTP 503; es gibt keine funktionsfähige Anmeldung,
  Auftragsverwaltung oder Cloud-Ausführung. Das Quell-Repository ist öffentlich;
  das separate private Control-Repository ist vorhanden, aber nicht mit einer
  Laufzeit verbunden.
- Preview-Branches stehen auf `None`; automatische Production-Deployments sind
  ebenfalls deaktiviert. Preview-Adressen wären bei einer späteren Aktivierung
  öffentlich; Cloudflare Access ist nicht eingerichtet und Preview-Secrets
  wurden nicht gesetzt.
- Die Cloudflare-Billing-Seite lud nicht; der Kontotarif und Zahlungsmittel
  sind daher nicht unabhängig verifiziert. In diesem Arbeitsgang wurde kein
  kostenpflichtiger Tarif, keine kostenpflichtige Ressource und keine
  Abrechnungsfunktion aktiviert. Das 0-€-Budget bleibt verbindlich.
- Wrangler Direct Upload wäre eine Alternative ohne GitHub-App, erfordert aber
  `Pages Write` auf Kontoebene. Dieses Recht kann Pages-Projekte des Kontos
  erstellen, ändern und löschen. Das bereits verknüpfte Git-Integrationsprojekt
  wird nicht auf Direct Upload umgestellt. Für diese Sitzung fehlen Wrangler,
  Cloudflare-Token und Cloud-Browser; es fand keine Cloudflare-Schreiboperation
  statt. Ein GitHub-Actions-Deployment-Workflow ist nicht eingerichtet; der
  verifizierte $0-Actions-Budgetstopp blockiert Mehrverbrauch nach erschöpfter
  inkludierter Free-Usage.
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
  freigegeben und anschließend ausdrücklich die Veröffentlichung des
  Quell-Repositories angeordnet. GitHub Free erlaubt Branch Protection für
  öffentliche Repositories. Die Branch-Protection-API bestätigt für `main`
  den erforderlichen Check `test`, `strict=true` und Admin-Enforcement.
  GitHub Actions Run 14 (`43746180556`) bestand für Commit
  `d45d1514656ce120da54e97de5e02f7ee68db288`; `main` verlangt damit `test` für
  PR-Merges. Die Regel verlangt keinen PR und beschränkt direkte Pushes nicht.
  Es wurde kein kostenpflichtiger Plan aktiviert. Quellen:
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
- [GitHub Free Plan enthaltene Nutzung](https://docs.github.com/en/billing/reference/product-usage-included)
  (abgerufen am 2026-11-15).

