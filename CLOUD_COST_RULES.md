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

- GitHub MCP ist mit dem Nutzerkonto verbunden; ein PromptHub-Remote und ein
  privates Control-Repository wurden nicht eingerichtet.
- Die Codex-App meldet eine lauffähige Standard-Cloud-Umgebung, aber ohne
  hinterlegte Repositories. Daraus folgt keine nachgewiesene autonome Ausführung
  für dieses Projekt.
- Die offiziellen OpenAI Agents-API-/Hosted-Sandbox-Wege verwenden API- und
  Container-Abrechnung. Sie sind daher nicht als 0-€-Ausführung zugelassen.
- Für eine PWA direkt nutzbare, nachweislich kostenlose Codex-LLM-API ist kein
  verfügbarer Zugang nachgewiesen. Prompt-Designer verwendet deshalb bis zu
  einer belegten Integration einen klar markierten strukturierten Fallback.
- GitHub Actions, Cloudflare Workers oder Pages werden erst nach Prüfung der
  konkreten Kontingente, Kostenstopps und Kontoeinstellungen aktiviert. Keine
  Cloud-Ressource wird in diesem Repository ohne Kontozugriff verifiziert.
- Eine deploybare Cloudflare-Worker-Variante ist im Repository vorbereitet, aber
  nicht aktiviert. Es gibt weder eine verifizierte Cloudflare-Konto-Planstufe,
  eine KV-Namespace-ID noch ein PromptHub-Control-Repository. Der Worker liefert
  deshalb ohne erforderliche Secrets und das KV-Binding API-seitig `503`; die
  statischen PWA-Dateien können davon getrennt bereitgestellt werden.
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
- Der Cloudflare Worker führt nur `/api/*`, `/auth/*` und `/healthz` durch den
  Worker aus. PWA-Dateien gehen direkt über Static Assets; `run_worker_first`
  darf nicht global aktiviert werden. Der kostenfreie Static-Asset-Pfad bleibt
  dadurch von Worker-API-Limits getrennt.
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
