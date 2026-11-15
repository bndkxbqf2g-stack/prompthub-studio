# Intelligenter Prompt-Designer

## Ablauf

`Freier Wunsch → Analyse → Interview → Konsolidierung → Prompt-Version → QA →
explizite Nutzerfreigabe → Entwicklungsauftrag`.

- Der Nutzer wählt zuerst ein verbundenes Projekt. Projektregeln, Architektur,
  offene Aufgaben und Test-/CI-Kontext werden als untrusted context beigefügt.
- Pro Schritt wird höchstens eine relevante Frage gezeigt. Geeignete Fragen
  bieten vier Optionen und eine begründete Empfehlung sowie Freitext.
- Überspringen oder Beenden ist jederzeit möglich. Bereits gegebene Antworten
  werden nicht erneut abgefragt.
- Gesicherte Nutzeranforderungen, offene Fragen, KI-Annahmen und Vorschläge sind
  getrennte Felder. Eine Annahme wird nie als Nutzerentscheidung gespeichert.
- Der Prompt wird strukturiert und prüfbar: Ziel, bestätigte Anforderungen,
  Kontext, Annahmen, Vorschläge, Grenzen, Risiken und Abnahmetests.
- QA prüft Mindestvollständigkeit, Widersprüche, Risiken, geheime Daten,
  projektbezogene Umsetzbarkeit und testbare Akzeptanzkriterien.
- Die Übergabe referenziert eine konkrete freigegebene Prompt-Version. Änderungen
  nach Freigabe machen diese Freigabe ungültig.
- Einzelaufträge und größere Entwicklungspakete werden als Markdown-Prompt oder
  versioniertes Paket exportiert. Anhangunterstützung ist auf begrenzte
  Text-/Markdown-Dateien ausgelegt; keine automatische Ausführung von Dateien.

## KI-Zugang und ehrlich ausgewiesene Grenzen

Ein optionaler `IntelligenceProvider` darf nur benutzt werden, wenn er innerhalb
des vorhandenen Budgets nachweislich kostenlos ist. Fehlt ein solcher Zugang,
arbeitet die Plattform im strukturierten Fallback-Modus mit heuristischer
Analyse, Interviewregeln, Vorlagen und statischer QA. UI und Ergebnis weisen
`deterministic_fallback` aus; das wird nicht als KI-Analyse ausgegeben.

Codex-App-Cloud-Umgebung, die keine Projektverknüpfung oder aufrufbare
PWA-Schnittstelle bereitstellt, ist keine API für den Prompt-Designer. OpenAI
API-/Sandbox-Abrechnung ist bei einem 0-€-Budget ausgeschlossen.
