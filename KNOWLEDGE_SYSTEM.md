# PromptHub Studio – Wissenssystem

## Quellen und Ebenen

1. **Geschützte Regeln:** `AGENTS.md`, `SECURITY_RULES.md`,
   `ACCEPTANCE_CRITERIA.md`; nur menschlich änderbar.
2. **Projektwissen:** Architektur, Entscheidungen, Runbooks und Testbelege im
   Repository; versioniert und reviewbar.
3. **Laufzeitwissen:** GitHub-Issue-Metadaten, Ereigniskommentare, Lease- und
   Checkpoint-Dateien; append-only bzw. CAS-aktualisiert.
4. **Experimentwissen:** isolierte Reports mit Hypothese, Eingabe, Ergebnis,
   Nebenwirkungen und Gültigkeitsdatum.

## Minimaler Ereignisdatensatz

```json
{
  "event_id": "evt_...",
  "job_id": "job_...",
  "type": "checkpoint",
  "phase": "tests",
  "status": "running",
  "source": "runner",
  "created_at": "UTC ISO-8601",
  "summary": "geheimnisfrei",
  "refs": ["commit-or-test-id"],
  "rule_version": "git-sha"
}
```

Prompts, Tokens und vollständige Umgebungen gehören nicht in dieses Schema.
Quellen werden über Commit-SHAs, Testnamen, Issue-Nummern oder URLs erhalten.

## Pflege

- Entscheidungen erhalten ID, Datum, Kontext, Alternativen und Konsequenz.
- Veraltetes Wissen wird mit `superseded_by` markiert, nicht gelöscht.
- Projektübergreifende Übertragung braucht eine explizite Quelle, einen
  Geltungsbereich und eine Prüfung auf Berechtigungs-/Datenlecks.
- Sensible Projektberechtigungen bleiben projektspezifisch und werden nie aus
  allgemeinem Wissen abgeleitet.
- Periodische Verdichtung ist begrenzt; geschützte Nutzerentscheidungen werden
  nicht automatisch umformuliert.

## Verifizierte Entwicklungsergebnisse

- Der Runner übergibt nach einem terminalen Control-Plane-Abschluss die Job-ID
  an `ProjectService.recordVerifiedJobOutcome`. Die Daten werden ausschließlich
  im projektbezogenen Datenobjekt des privaten Control-Repositories abgelegt.
- Eine positive Erfahrung wird nur aufgezeichnet, wenn ein echtes
  `prompthub`-Abschlussereignis `succeeded`, bestandene Pflichtchecks und
  mindestens einen tatsächlich ausgeführten Check ausweist. Fehlgeschlagene
  Ausführungen bleiben als Fehler/Checkfehler getrennt klassifiziert.
- Erfasst werden Job-ID, Abschlussereignis, Status, Checknamen und begrenzte
  Laufzeit-/Retry-/Tokenwerte. Prompts, Anhänge, Ausgaben und lokale Pfade werden
  nicht kopiert. Tokenwerte bleiben an echte Anbietermessungen gebunden.
- Schreibvorgänge sind idempotent und nutzen einen CAS-basierten
  Read-modify-write, damit gleichzeitige Entwurfs- und Ergebnisupdates einander
  nicht überschreiben. Je Projekt bleiben höchstens 200 Ergebnisse erhalten.
- Beim Lesen werden Schema, Klassifikation, Prüfnamen und SHA-256-Evidenzdigest
  geprüft. Unklare oder veränderte Einträge werden nicht als Lernkontext benutzt.
- Der Prompt-Designer nutzt höchstens zehn verifizierte Ergebnisse desselben
  verbundenen Projekts als begrenzte, ausdrücklich nicht vertrauenswürdige
  Metadaten. Sie können keine Anforderungen, Tests, Sicherheitsregeln oder
  Freigaben verändern. Projektübergreifende Übertragung bleibt manuell und
  benötigt Quellen- und Berechtigungsprüfung.
- Ein Fehler beim Speichern des Lernbelegs ändert den bereits anhand der
  Pflichtchecks bestimmten Jobstatus nicht; der Runner protokolliert den
  Speicherfehler geheimnisfrei.

## Fehlerprävention und Lernen

- Verbindliche Umsetzung und Datenlimits sind in `ERROR_PREVENTION.md`
  dokumentiert.
- `ErrorLearningEngine` übernimmt Runner-Ergebnisse erst nach Verifikation des
  terminalen Control-Plane-Ereignisses. Fehlgeschlagene gleichartige Jobs werden
  nach Projekt, Phase und Checknamen gruppiert; dieselbe Job-ID wird idempotent
  behandelt.
- Symptome, Nutzerberichte, CI-Signale und Ursachenhypothesen sind keine
  bestätigten Ursachen. CI-Job-/Schrittnamen werden begrenzt gespeichert;
  vollständige Logs werden nicht kopiert.
- Runner-/Check-Ausgaben werden nur im Speicher gegen eine feste Liste
  deterministischer Fehlerklassen geprüft. Im Projektwissen landen ausschließlich
  diese Kategorien und Pflichtcheck-Namen, nie rohe Ausgaben oder Secrets.
- Eine bestätigte Ursache benötigt einen fehlgeschlagenen und später
  bestandenen namensgleichen Pflichtcheck. Ein angemeldeter Mensch bestätigt die
  Hypothese, die exakte Phrase und dass der spätere Job dieselbe Korrektur prüft.
  Die KI kann diesen Zustand nicht über ihre Analyseantwort setzen.
- Der Prompt-Designer erhält höchstens fünf relevante Fehlerhinweise des
  ausgewählten Projekts. Hypothesen, Nutzerberichte, CI-Metadaten und gealterte
  Evidenz werden gekennzeichnet. Verfügbare Jobbelege werden vor der
  Wiederverwendung geprüft.
- Die Aufbewahrung bleibt auf 200 verifizierte Ergebnisse und 500 Vorfälle je
  Projekt begrenzt. Nach dem Ergebnislimit bleiben alte Quell-IDs sichtbar,
  doch nicht mehr verfügbare Belege zählen nicht als aktuelle Regression.
  Fehlerraten beziehen sich auf den geladenen Job-Sample. Der Fehlertrend
  vergleicht die letzten sieben mit den vorherigen sieben Tagen; sobald die
  40-Ereignis-Historie eines Vorfalls gekürzt sein könnte, wird er als
  Untergrenze markiert.
- Projektübergreifende Übertragung erfolgt nicht automatisch. Sie braucht eine
  Architektur-, Berechtigungs- und Kompatibilitätsprüfung; Projektinhalte,
  Prompts und Zugangsdaten werden nicht übertragen.
