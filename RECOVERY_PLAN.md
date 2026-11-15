# PromptHub Studio – Wiederherstellungsplan

## Zustände

- **Runner offline:** kein Heartbeat; nach Lease-TTL `stale`, nicht sofort
  überschreiben. Nach Prüfung darf ein neuer Runner ab Checkpoint fortsetzen.
- **GitHub nicht erreichbar:** lokale Arbeit wird pausiert; höchstens zwei
  zeitbegrenzte Wiederholungen nach dem ersten Fehler. Kein Erfolg ohne Sync.
- **Lease-Konflikt:** CAS neu lesen, aktive Leases prüfen; bei Unklarheit `stale`
  und Freigabe verlangen.
- **Executor abgebrochen:** Exit-Code und letzte Phase speichern, Worktree
  erhalten, Job `failed` oder `paused`; kein behauptetes Ergebnis.
- **Datenkorruption/ungültiges JSON:** Backup/letzten gültigen Blob prüfen und
  nur mit menschlicher Entscheidung wiederherstellen.
- **Ungültige Ergebnis-Evidenz:** betroffene Wissenseinträge nicht in Prompts
  übernehmen; gespeicherten Control-Plane-Abschluss mit dem Ergebnisdigest
  vergleichen und die bestehende Historie nicht automatisch überschreiben.
- **Ungültige Fehlerhistorie:** betroffene Vorfälle, Hypothesen und Ursachen
  fail-closed aus dem Promptkontext nehmen; Projektdatenversion und
  Abschlussereignisse prüfen. Niemals einen Digest neu berechnen, um eine
  unbestätigte Ursache nachträglich als gültig darzustellen.
- **Abgelaufener Ergebnisbeleg:** Incident und Quell-Job-ID erhalten, den Job in
  GitHub erneut prüfen und bis zum neuen Beleg als nicht aktuell verifiziert
  anzeigen. Gealterte Daten nicht stillschweigend überschreiben.
- **Mac schläft/ist aus:** keine Aktivität melden. PWA zeigt letzten bestätigten
  Heartbeat und `offline_or_unknown`.

## Backup- und Restore-Prinzip

Kritische Projektdateien, Dokumente und Lease-/Checkpoint-Manifeste werden über
Git-Historie und exportierbare, versionierte JSON-Daten gesichert. Vor einem
Restore werden SHA-256 und Schema geprüft. Ein Restore schreibt in einen neuen
Restore-Zweig oder eine neue Datei; ein bestehender unklarer Zustand wird nicht
überschrieben.

## Runbook

1. Letzten bestätigten Runner-Heartbeat und Checkpoint lesen.
2. GitHub-/lokale Logs und Lease-TTL prüfen.
3. Keine konkurrierende Arbeit starten, solange Identität/Commit unklar ist.
4. Mit menschlicher Freigabe Lease bereinigen oder Resume durchführen.
5. Pflichtchecks erneut ausführen.
6. Ergebnis, Abweichung und neue Recovery-Referenz dokumentieren.
