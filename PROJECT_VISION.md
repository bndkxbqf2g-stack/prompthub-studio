# PromptHub Studio – Projektvision

## Ziel

PromptHub Studio ist eine eigenständige, sichere, cloud-first Steuerungsplattform
für Entwicklungsarbeit in mehreren GitHub-Projekten. Eine iPhone-optimierte PWA
bleibt unabhängig vom MacBook erreichbar; austauschbare Runner holen freigegebene
Aufträge ab. GitHub speichert Quellcode, Aufgaben, CI, Wissen und nachvollziehbare
Zustände. Zusätzliche laufende Cloud- und Entwicklungsdienste kosten dauerhaft
0 €.

## Nutzerwert

- Aufgaben und Ideen können unterwegs in natürlicher Sprache erfasst werden.
- Ein Prompt-Designer analysiert Wünsche, führt ein angepasstes Interview,
  trennt bestätigte Anforderungen von Annahmen und übergibt nur freigegebene
  Prompt-Versionen.
- Projekte lassen sich verbinden, analysieren, reversibel aus PromptHub entfernen
  und wieder verbinden; das GitHub-Repository bleibt dabei unberührt.
- Eine quellenbelegte Prompt-Bibliothek unterstützt Interview und QA.
- Eine Ressourcenübersicht zeigt gemessene Tokenwerte oder klar ausgewiesene
  Ersatzmetriken.
- Der Nutzer sieht `queued`, `running`, `awaiting_approval`, `succeeded`,
  `failed`, `paused` oder `stale` statt erfundener Prozentwerte.
- Ein ausgeschalteter oder schlafender Mac wird klar als nicht erreichbar
  dargestellt.
- Wiederaufnahme erfolgt aus dokumentiertem Zustand und nicht aus Vermutungen.
- Projekte und Entscheidungen bleiben versioniert und projektübergreifend
  kontrolliert nutzbar.
- Fehlerprävention verwendet echte Runner-/CI-Ergebnisse und Nutzerberichte;
  Ursachen bleiben bis zu passenden Belegen und menschlicher Bestätigung
  ausdrücklich Hypothesen.

## Sicherheitsversprechen

Die Plattform erzwingt die kritischen Grenzen technisch: maximal zwei aktive
Entwicklungsjobs global, kein öffentliches Mac-Listening, keine Secrets in
GitHub-Inhalten, keine Selbstfreigabe kritischer Aktionen und kein Erfolg ohne
nachgewiesene Pflichtprüfungen. KI-Entscheidungen dürfen diese Grenzen nicht
aufheben.

## MVP-Schnitt

Der erste überprüfbare Schnitt umfasst:

1. GitHub-gestützte Jobanlage und Statusereignisse.
2. Server-seitige GitHub-OAuth-Session und sichere Cookie-Behandlung.
3. Mobile PWA mit Jobliste, echter Statusanzeige, Fehlern und Auftragserfassung.
4. Outbound-only Runner mit Lease-CAS, Heartbeat, Checkpoint und Resume-Logik.
5. Sicherheits- und Integrationstests ohne externe Dienste.

Deployment, Cloud-Kontingente, GitHub-OAuth-Credentials und die konkrete Runner-
CLI werden konfigurierbar ausgeliefert, aber nicht ohne Freigabe veröffentlicht
oder gestartet.

## Nicht-Ziele der Erstabnahme

- Keine automatische Erstellung eines öffentlichen GitHub-Repositories.
- Keine kostenpflichtige Hosting-, LLM-, Tunnel- oder Monitoring-Buchung.
- Keine automatische Analyse oder Änderung von Angebotsküche vor bestandener
  PromptHub-Abnahme.
- Keine Energieverwaltung, kein Wake-on-LAN und kein Umgehen von macOS-Sperren.
