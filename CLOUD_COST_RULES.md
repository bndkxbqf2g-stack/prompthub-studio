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

- GitHub MCP ist mit dem Nutzerkonto verbunden. Das private Quell-Repository
  `bndkxbqf2g-stack/prompthub-studio` ist erstellt; ein separates privates
  Control-Repository und dessen Runtime-Token sind nicht eingerichtet.
- Die Codex-App meldet eine lauffähige Standard-Cloud-Umgebung, aber ohne
  hinterlegte Repositories. Daraus folgt keine nachgewiesene autonome Ausführung
  für dieses Projekt.
- Die offiziellen OpenAI Agents-API-/Hosted-Sandbox-Wege verwenden API- und
  Container-Abrechnung. Sie sind daher nicht als 0-€-Ausführung zugelassen.
- Für eine PWA direkt nutzbare, nachweislich kostenlose Codex-LLM-API ist kein
  verfügbarer Zugang nachgewiesen. Prompt-Designer verwendet deshalb bis zu
  einer belegten Integration einen klar markierten strukturierten Fallback.
- GitHub Actions, Cloudflare Workers oder Pages werden erst nach Prüfung der
  konkreten Kontingente, Kostenstopps und Kontoeinstellungen aktiviert.
- GitHub zeigt den Plan `GitHub Free`, Actions-Billable-Usage von $0 nach
  Included-Usage-Rabatten und ein Actions-Monatsbudget von $0.00 mit Status
  „Usage blocked“. Included-Usage-Alerts sind eingeschaltet. Bei erreichtem
  kostenfreien Kontingent blockiert GitHub Actions statt Mehrverbrauch zu
  berechnen; ein CI-Lauf bleibt deshalb von der verbleibenden Free-Usage abhängig.
- Cloudflare ist im Browser erreichbar. Workers & Pages zeigt keine Projekte
  und 0/100.000 Requests für den heutigen Tag; das stimmt mit dem Free-Kontingent
  überein. Die Billing-Seite lud nicht, daher sind Abrechnung und mögliche
  Zahlungsmittel nicht bestätigt. Es wurden keine Cloudflare-Ressourcen oder
  Bezahloptionen angelegt.
- Cloudflare Pages ist vorbereitet, aber nicht deployed. Die Cloudflare-GitHub-
  OAuth-Verbindung wurde autorisiert; die GitHub-App-Installation wurde nicht
  bestätigt, weil sie selbst für ein einzelnes Repository Schreibzugriff auf
  Administration, Checks, Code, Deployments und Pull Requests verlangt. Kein
  Pages-Projekt, KV-Namespace oder Runtime-Secret ist eingerichtet. Der Pages-
  Handler liefert ohne diese Bindings `503`; `/api/me` öffnet dann keinen
  Adminbereich. Der frühere Workers-Static-Assets-Modus ist in
  `wrangler.worker.toml` erhalten.
- Wrangler Direct Upload wäre eine Alternative ohne GitHub-App, erfordert aber
  `Cloudflare Pages Edit` auf Kontoebene, womit sämtliche Pages-Projekte des
  Kontos erstellt, geändert oder gelöscht werden können. Ein Direct-Upload-
  Projekt kann später nicht auf Git-Integration umgestellt werden. Ein
  Deployment-Workflow über GitHub Actions ist nicht eingerichtet; der
  verifizierte $0-Actions-Budgetstopp blockiert kostenpflichtigen Mehrverbrauch,
  sobald die enthaltene Free-Usage erschöpft ist.
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
  Pfad. Bei erschöpftem Pages-Functions-Kontingent muss Fail-Closed aktiviert
  sein. Der erhaltene Workers-Modus darf `run_worker_first` nicht global
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

