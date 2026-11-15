# PromptHub Studio – Autonomie- und Freigaberegeln

## Was automatisch entschieden werden darf

- Priorisierung nach expliziter Priorität, Abhängigkeiten, Alter und Risiko.
- Auswahl des nächsten queued Jobs, wenn Lease, Projektpfad und Checks gültig sind.
- Wiederholung transienter Netzwerkoperationen innerhalb der festgelegten Grenze.
- Erstellung von lokalen Worktrees, Checkpoints und datensparsamen Statusereignissen.
- Reparaturen an unkritischen UI-, Test- und Dokumentationskomponenten.

## Was angehalten werden muss

- Unsicherheit über Repository, Branch, Commit, Lease oder Datenintegrität.
- Mehr als zwei aktive Jobs oder ein nicht auflösbarer Lease-Konflikt.
- Fehlende Berechtigung, fehlende Credentials oder nicht konfigurierte Codex-CLI.
- Änderung kritischer Sicherheits-, Auth-, Freigabe- oder Recovery-Komponenten.
- Produktive Migration, Löschung, Deployment oder kostenpflichtige Ressource.

## Entscheidungsprotokoll

Jede automatische Entscheidung wird mit `decision_id`, Input-Referenzen,
Regelversion, Ergebnis, Risiko und Zeitstempel dokumentiert. Das Protokoll darf
keine Geheimnisse enthalten und wird als Version/Issue-Ereignis abgelegt. Eine
Strategie gilt erst als verbessert, wenn Tests und reale Ergebniskennzahlen sie
bestätigen; ein einzelner Erfolg reicht nicht.

## Begrenzung der Selbstoptimierung

Experimente sind isoliert, zeitlich und zahlenmäßig begrenzt. Pro Problem gibt
es höchstens drei unterschiedliche Lösungsstrategien und höchstens zwei weitere
Versuche bei transienten Fehlern. Danach wird gestoppt, der Zustand dokumentiert
und eine menschliche Entscheidung angefordert. Kritische Komponenten erhalten
keine automatische Optimierungsschleife.

## Fehlerlernen

Vor Änderungen werden Fehlerhistorie und CI-Diagnosen des ausgewählten Projekts
geprüft. Währenddessen erfolgen frühe deterministische Prüfungen. Danach werden
nur echte Control-Plane-Ergebnisse und Pflichtchecks gespeichert. Nutzerberichte,
CI-Signale und Hypothesen gelten als unbestätigt. Eine Ursache oder Korrektur darf
nur ein angemeldeter Mensch nach Sichtung passender Job- und Testbelege bestätigen.
Projektübergreifende Nutzung erfordert Architektur-, Berechtigungs- und
Kompatibilitätsprüfung und überträgt weder vertrauliche Daten noch Rechte.
