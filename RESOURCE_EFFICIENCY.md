# Ressourcen- und Token-Effizienz

## Entwicklungsprinzipien

- Große Aufgaben werden in abgrenzbare Pakete mit eigenen Akzeptanztests zerlegt.
- Nur betroffene Dateien, Regeln und gezielt erforderlicher Projektkontext werden
  geladen. Geprüfte Fakten und unveränderte Analysen werden referenziert, nicht
  wiederholt erzeugt.
- Deterministische Tests, Lint-/Statische Prüfungen und lokale Analyse gehen
  unnötigen Modellaufrufen vor. Pflichtprüfungen bleiben vollständig.
- Wiederverwendbare Zusammenfassungen tragen Quelle, Projekt-ID, Commit/Version
  und Aktualitätsdatum. Veraltete Zusammenfassungen werden nicht still genutzt.
- Ressourcen werden anhand erfolgreicher, sicherer Aufgaben bewertet; Tokenzahl
  allein ist kein Erfolgsmaß.

## Laufzeitmetriken

- Tatsächliche Prompt-/Completion-Tokens werden nur erfasst, wenn die integrierte
  Schnittstelle diese Nutzungswerte liefert und ihre Bedeutung dokumentiert ist.
- Fehlen Tokenmetriken, zeigt das Dashboard `nicht verfügbar` und stattdessen
  gemessene Laufzeit, Modellaufrufe, Wiederholungen und echte Check-Ergebnisse.
- Schätzungen müssen als Schätzungen markiert sein und werden nicht als
  Einsparungen dargestellt.
- Jobqualität wird über tatsächlich ausgeführte Pflichtchecks, CI-Ergebnisse und
  verifizierte Ergebnisse gemessen, nicht durch KI-Selbsteinschätzung.
- Keine Kosten über 0 € zusätzliche laufende Dienste. Quoten- oder Kostenunklarheit
  pausiert Jobs; kein automatischer Tarifwechsel.
- Executor-Starts, tatsächliche Prompt-Designer-Provider-Anfragen, Modellaufrufe
  und Laufzeit sind getrennte Messgrößen. Ein gestarteter Prozess wird nicht als
  erfolgreicher Modellaufruf gezählt.
- Tokenwerte aus nur einem Teil der Aufrufe werden als `teilweise gemessen`
  angezeigt. Fehlende Anbietertelemetrie wird weder als null noch als Schätzung
  behandelt.

## Implementierte Kontext- und Cache-Grenzen

- `src/designer/context-selector.mjs` wählt README-, Projektregel- und Issue-
  Auszüge anhand des aktuellen Wunsches. Sicherheits-, Berechtigungs-, Test-,
  CI-, Migrations-, Backup- und Datenschutzregeln werden unabhängig von der
  Themenrelevanz bevorzugt aufgenommen.
- Jede Projektanalyse erhält Schema-Version, GitHub-Blob-SHAs der erfassten
  Dateien und eine SHA-256-Snapshot-Version aus Quellen, Issues, Workflows und
  letzten CI-Ergebnissen. Bei geänderten Fakten ändert sich die Version.
- Die ausgewählten Regel-Auszüge sind nicht vertrauenswürdige Referenz und
  ersetzen nie das vollständige Lesen aktueller Projektregeln vor Änderungen.
- Nur ein ausdrücklich als kostenfrei verifizierter Provider darf die KI-
  Analyse nutzen. Identische gleichzeitige und kurz darauf wiederholte Requests
  teilen höchstens den Analyseaufruf; die Deduplizierung verwendet einen Hash
  über Wunsch, Anhänge, Lieferform, Hinweise und Snapshot-Version. Der Cache
  bleibt höchstens fünf Minuten und 32 Einträge im Prozessspeicher. Prompttexte
  und Providerresultate werden nicht in Cache-Logs geschrieben.
- Cache-Treffer erzeugen keinen zweiten Provider- oder Token-Messdatensatz.
  Nutzerantworten, generierte Prompt-Versionen, Freigaben und Pflichtprüfungen
  werden niemals aus dem Cache übernommen oder übersprungen.
- Prozessübergreifend ist dieser Cache nicht dauerhaft; nach Neustart oder in
  einer anderen Serverless-Instanz gibt es keine behauptete Cache-Trefferrate.
- Das Dashboard bündelt gleichzeitige Messabfragen und hält die zuletzt
  erhobenen aggregierten Werte 15 Sekunden im Prozessspeicher. Der Datenstand
  und die Art der Abfrage (`live`, gemeinsam oder Kurzcache) werden angezeigt;
  nur `live` löst eine neue GitHub-Abfrage aus. Job-Metriken stammen im
  GitHub-Control-Plane-Modus aus höchstens 100 Issues pro Abruf; bei erreichter
  Grenze kennzeichnet das Dashboard die mögliche Unvollständigkeit. Prompt-
  Designer-Metriken werden aus höchstens 50 gespeicherten Entwürfen je
  verbundenem Projekt berechnet. Die Anzeige nennt diese Erfassungsbasis und
  behauptet keine vollständige Langzeithistorie.

- Die Cache-/Deduplizierungszahl wird aus den noch gespeicherten Entwürfen
  abgeleitet und ist durch die Aufbewahrungsgrenze von 50 Entwürfen je Projekt
  begrenzt. Sie ist keine dauerhafte oder prozessübergreifende Cache-Trefferrate.
- `/healthz` meldet `runner_status: not_observed`; eine konfigurierte
  Executable-Angabe wird separat als `runner_configured` ausgewiesen. Das
  Vorhandensein einer Konfiguration gilt nicht als Nachweis eines laufenden
  Runners.

## Interview und Kontextauswahl

Pro Nachricht wird höchstens eine neue, nicht bereits beantwortete Frage
gestellt. Das Interview endet automatisch, sobald das erkannte Ziel, der
Projektkontext, der Umfang, die Risiken und die überprüfbaren Kriterien
ausreichend bestimmt sind. Der Nutzer kann jederzeit überspringen oder beenden.
