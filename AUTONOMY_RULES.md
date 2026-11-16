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

## Nutzeraktionen und Remote-Unterstützung

Bevor eine Mitwirkung angefordert wird, werden vorhandene Connectoren, APIs,
CLIs, Browserzugriff, bereits autorisierte Sitzungen und sichere Alternativen
geprüft. Wenn möglich wird die Aufgabe autonom abgeschlossen. Erforderliche
Freigaben und persönliche Entscheidungen bleiben ausdrücklich beim Nutzer.

Verbindliche Reihenfolge:

1. Selbstständige Ausführung mit tatsächlich verfügbaren Berechtigungen.
2. Codex Remote auf dem iPhone für Start, Steuerung, Rückfragen, native
   Freigaben und Review eines mit dem Telefon verbundenen Codex-Hosts.
3. iPhone-Browser für Anbieteranmeldungen und Schritte, die der Nutzer selbst
   in einer Website ausführen muss.
4. Laptop nur, wenn lokale Dateien, Desktop-only-Werkzeuge oder ein verbundener
   Rechner technisch erforderlich und die vorherigen Wege nicht ausreichend
   sind. Den konkreten Grund nennen.

Codex Remote steuert einen verbundenen Rechner; es verschiebt dessen lokale
Ausführung nicht auf das iPhone. Der Host muss online, wach, angemeldet und mit
dem passenden Workspace verbunden sein. Bei Schlaf oder Ausfall gibt es keine
vorgegebene Aktivität. Eine mögliche Freigabe über Codex Remote umgeht keine
native Codex-Prüfung, OAuth-Bestätigung oder Anbieterfreigabe.

Wenn eine Aktion auf den Nutzer wartet, wird sie unmittelbar im laufenden Chat
mit folgendem Inhalt beschrieben:

- **Aktion erforderlich:** kurzer Titel.
- **Warum?** höchstens zwei Sätze zur konkreten Grenze.
- **Empfohlene Lösung:** einfachster sicherer Weg.
- **Gerät:** iPhone, iPhone-Browser oder Laptop.
- **Was muss ich tun?** verifizierte Schritte und Bedienelemente.
- **Dauer:** nur bei begründbarer Schätzung.
- **Danach:** wie der Abschluss geprüft oder zurückgemeldet wird.
- **Alternative:** soweit vorhanden.

Keine Passwörter, Einmalcodes oder Zugangsschlüssel im Chat anfordern. Secrets
werden nur in der geschützten Oberfläche des jeweiligen Anbieters gespeichert.
Eine Push-Benachrichtigung wird nur behauptet, wenn ein tatsächlich
konfigurierter Push-Kanal sie versendet hat; andernfalls bleibt eine
abrufbare Aufgabenliste sichtbar. Während eine Antwort aussteht, wird mit
unabhängigen sicheren Arbeiten fortgefahren. Nach der Antwort wird derselbe
Auftrag fortgesetzt, soweit die Laufzeit dies unterstützt.

Die tatsächliche Funktionsverfügbarkeit pro Sitzung wird geprüft und
dokumentiert. Eine allgemeine Produktfunktion gilt nicht als in dieser Sitzung
verbunden, und eine Chat-Rückfrage gilt nicht als native Codex-Freigabe.

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
