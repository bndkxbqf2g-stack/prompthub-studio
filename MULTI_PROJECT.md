# Multi-Projektverwaltung

## Repository-Modell

- Ein verbundenes Projekt wird durch den normalisierten `owner/repository`-
  Slug identifiziert. Der Projektkatalog liegt im privaten GitHub-Control-Repo.
- Verbinden führt ausschließlich Lesezugriffe aus: Repository-Metadaten,
  `AGENTS.md`, `README.md`, `package.json`, Workflow-Namen, offene Issues und
  letzte CI-Läufe. Es wird kein Quellrepository verändert.
- Regeln, Architekturhinweise, Analyse, Prompt-Sitzungen und Entscheidungen
  bleiben unter `.prompthub/project-data/<project-id>.json` projektspezifisch.
- Berechtigungen oder Wissen eines Projekts werden nicht auf andere Projekte
  übertragen. Externe Repository-Inhalte gelten als nicht vertrauenswürdig.

## Entfernen, Wiederverbinden und Datenlöschung

- Standardaktion: **Aus PromptHub entfernen**. Sie markiert nur den Katalogeintrag
  als getrennt; das GitHub-Repository wird nicht geändert oder gelöscht.
- Vor dem Trennen werden Jobs des Projekts geprüft. Wartende Jobs werden
  nachvollziehbar pausiert. Laufende oder unklare (`stale`) Jobs blockieren das
  Trennen, bis sie abgeschlossen oder nach Prüfung pausiert wurden.
- Nutzerbestätigung ist serverseitig an den exakten Projektslug gebunden.
- Wiederverbinden derselben Repository-Identität reaktiviert Eintrag und
  Projektwissen, sofern diese nicht separat gelöscht wurden.
- Projektbezogene Daten können separat mit einer zweiten expliziten Bestätigung
  gelöscht werden. Die Löschung entfernt aktuelle aktive Daten und Einstellungen;
  GitHub-Versionshistorie kann frühere Commits weiterhin enthalten.
- Endgültiges GitHub-Repository-Löschen ist nicht implementiert. Eine spätere
  Umsetzung müsste ein separates Berechtigungs- und Bestätigungsgate besitzen;
  eine KI darf sie nie auslösen.

## Ausführungsschutz

- Projektjob entsteht erst nach ausdrücklicher Freigabe der finalen Prompt-Version.
- Runner benötigt eine explizite, projektbezogene lokale Pfadzuordnung oder einen
  später unabhängig geprüften Cloud-Runner. Fehlende Zuordnung darf nie auf das
  PromptHub-Arbeitsverzeichnis zurückfallen.
- Globale GitHub-CAS-Lease-Grenze bleibt zwei aktive Jobs.
