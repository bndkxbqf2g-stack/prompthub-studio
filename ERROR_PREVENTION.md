# PromptHub Studio – Fehlerprävention und Ergebnislernen

## Zweck und Grenzen

Die Engine hält projektbezogene Fehlerbelege und nutzt sie zur Vorbereitung
künftiger Prompts. Sie erfasst Symptome, Hypothesen und bestätigte Ursachen als
getrennte Zustände. Sie schaltet keine Prüfung ab, unterdrückt keine Fehler,
ändert keine geschützten Regeln und startet keine unbegrenzte Optimierung.

## Belegstufen

1. **Symptom:** Ein tatsächliches fehlgeschlagenes PromptHub-Abschlussereignis,
   ein begrenzter GitHub-CI-Befund oder ein ausdrücklich gespeicherter
   Nutzerbericht. CI-Metadaten und Nutzerberichte belegen keine Ursache.
2. **Hypothese:** Eine benannte mögliche Ursache mit optionalen, projektintern
   verifizierten Jobbelegen. Sie bleibt im Dashboard und Prompt als Hypothese
   gekennzeichnet.
3. **Menschlich bestätigte Ursache:** Eine angemeldete Person bestätigt die
   konkrete Hypothese durch eine exakte Bestätigungsphrase, verknüpft einen
   fehlgeschlagenen Pflichtcheck und einen später bestandenen Lauf desselben
   Checks und bestätigt ausdrücklich, dass der spätere Job dieselbe Korrektur
   prüft. Der Akteur, beide Job-IDs, Checknamen und Zeitstempel bleiben erhalten.
   Diese Bestätigung ist keine automatisch erteilte Aktions- oder Mergefreigabe.

## Erfassung und Speicherung

- `ErrorLearningEngine` erhält Runner-Abschlüsse über denselben
  verifizierenden `ProjectService`, der Control-Plane-Ereignis, Status und
  Pflichtchecks gegenprüft. Speichern der Lernnotiz ändert den Jobstatus nicht.
- Check-/Executor-Ausgaben werden nur im Speicher anhand fester, deterministischer
  Fehlermuster klassifiziert (Assertion, Syntax, Abhängigkeit, Berechtigung,
  Timeout, Netzwerk, Typfehler und Testprozess). Rohes stdout/stderr wird nie in
  Vorfall, Job-Ereignis, PWA oder Lernkontext übernommen.
- Fehler werden je Projekt anhand Fehlerklasse, Runnerphase und sortierter
  Checknamen gruppiert. Wiederholte Beobachtungen sind idempotent und über
  konkrete Job- und Abschlussereignis-IDs nachvollziehbar.
- PWA-Nutzerberichte speichern nur validierten Symptomtext und relative
  Repository-Pfade. Häufige Zugangsdatenmuster werden vor dem Speichern
  abgewiesen. Prompt, Anhänge, Prozessausgaben und Quellcode werden nicht in
  Fehlerwissen kopiert.
- Hypothesen und Berichte bleiben im CAS-geschützten, projektbezogenen
  Datenobjekt des privaten Control-Repositories. Der SHA-256-Digest erkennt
  unbeabsichtigte oder nicht konsistente Änderungen; er ist keine Signatur gegen
  einen Angreifer mit Schreibzugriff auf das Control-Repository.
- Belege werden beim Lesen gegen die gespeicherten verifizierten Ergebnisse
  geprüft. Ältere Ergebnisse können nach Erreichen des aktiven 200-Ergebnis-
  Limits aus der aktiven Belegmenge fallen. Dann bleiben Quellen-IDs sichtbar,
  aber Ursachen zählen nicht als aktuell belegte Regression und Prompts weisen
  zur erneuten GitHub-Prüfung an.
- Begrenzungen: höchstens 200 aktive verifizierte Runner-Ergebnisse, 500
  Fehlerdatensätze je Projekt, 200 gespeicherte Ergebnisverweise pro Fehler,
  20 Hypothesen je Fehler, 40 Historieneinträge und fünf Diagnosehinweise im
  Promptkontext. Die PWA/CI-Diagnose liest höchstens die letzten fünf Workflows
  und untersucht höchstens zwei fehlgeschlagene Runs mit je höchstens 100 Jobs.
  Sie speichert Job-/Schrittnamen, keine vollständigen GitHub-Logs.
- Trendwerte vergleichen Fehlerbeobachtungen der letzten sieben Tage mit den
  vorherigen sieben Tagen. Pro Vorfall bleiben höchstens 40 Historieneinträge;
  wenn eine Kürzung möglich ist, kennzeichnet das Dashboard Werte als Untergrenze.

## Arbeitsablauf

### Vor einer Änderung

- Ausgewählte Projektregeln und aufgabenbezogene Fehler-/Ergebnisbelege lesen.
- Verifizierte Ursachen, nachweislich ungeeignete Ansätze, CI-Symptome und
  Nutzerberichte getrennt bewerten.
- Passende Pflicht- und Regressionstests sowie Risiko bestimmen.

### Während einer Änderung

- In kleinen, nachvollziehbaren Schritten arbeiten.
- Frühe deterministische Prüfungen ausführen und nur relevante Diagnosebelege
  speichern.

### Nach einer Änderung

- Pflichtprüfungen ausführen und reale Resultate erfassen.
- Wiederholbare Fehler mit Regressionstests absichern.
- Nur nachgewiesene Ergebnisse als verifiziert speichern. Ein bestandener Test
  allein belegt nicht, dass eine Hypothese die frühere Ursache war.
- Für wiederholte Runnerfehler oder menschlich bestätigte Ursachen mit aktuell
  verfügbaren Belegen kann die PWA einen projektbezogenen Regressionstest-Auftrag
  vorbereiten. Er enthält nur begrenzte strukturierte Metadaten und verlangt
  Reproduktion, gezielten Test, erforderliche Prüfungen und einen klaren Bericht.
  Der Button erzeugt weder Code noch einen Entwicklungsjob. Der Job entsteht erst
  nach Prompt-QA und ausdrücklicher Nutzerfreigabe; nicht reproduzierbare Fehler
  werden als solche dokumentiert.

## Wiederverwendung und Isolation

- Der Prompt-Designer fragt ausschließlich die Fehlerhistorie des ausgewählten,
  verbundenen Projekts ab. Fehlerberichte, CI-Metadaten und Hypothesen werden
  als nicht vertrauenswürdiger Diagnosekontext eingezäunt.
- Projektübergreifender Wissenstransfer erfolgt nicht automatisch. Eine Strategie
  darf erst nach Architektur-, Berechtigungs- und Kompatibilitätsprüfung als
  Vorschlag übertragen werden; Projektdaten, Repositories und Jobrechte werden
  nie übernommen.
- Die Engine bewertet Praxisqualität aus tatsächlichen Terminalstatus,
  Pflichtcheck-Ergebnissen, wiederkehrenden Fehlern und menschlich bestätigten
  Belegpaaren. Fehlerrate wird nur für die geladene Jobstichprobe angegeben;
  sie ist keine globale Qualitätsprognose.
- Eine bestätigte Regression zählt nur, wenn beide aktuellen Ergebnisbelege
  verfügbar sind, ein gleichnamiger Pflichtcheck erst fehlschlug und später
  bestand und die Person die Prüfung derselben Korrektur bestätigte.
- Fehlende Tokenmessung bleibt unbekannt. Aufrufe, Laufzeit und Wiederholungen
  sind nur Ersatzmetriken. Keine zusätzliche kostenpflichtige KI oder Cloud-
  Ressource wird verwendet.

## API und PWA

- `GET /api/projects/:project/incidents`: projektbezogene Fehlerhistorie.
- `POST /api/projects/:project/incidents`: authentifizierten Symptombericht
  speichern.
- `POST /api/projects/:project/incidents/:id/hypotheses`: Hypothese mit
  optionalen verifizierten Job-IDs dokumentieren.
- `POST /api/projects/:project/incidents/:id/confirm`: Ursachenbestätigung nur
  mit exakter Phrase, gültigem Fehl-/Erfolgsbeleg und expliziter Bestätigung
  derselben Korrektur.
- `/api/metrics` liefert Fehler-, Wiederholungs-, bestätigte
  Regression-, CI-Signal- und Jobstichprobenwerte mit Datenquelle. CI-Signale
  werden ausdrücklich nicht als bestätigte Ursachen angezeigt.

## Tests

`test/error-learning.test.mjs`, `test/projects.test.mjs`,
`test/prompt-designer.test.mjs`, `test/regression-test-request.test.mjs`,
`test/api-projects.test.mjs` und
`test/research-metrics.test.mjs` prüfen Runner-Ingestion, Gruppierung,
Bericht-/Hypothesenstatus, exakte menschliche Bestätigung, Belegpaare,
Projekttrennung, Digestfehler, CI-Schrittbegrenzung, Promptkontext und
Dashboard-Kennzahlen. Fehlende Belege, falsche Reihenfolge, nicht passende
Checks, Geheimnisinhalte und nicht verbundene Projekte müssen sicher scheitern.
