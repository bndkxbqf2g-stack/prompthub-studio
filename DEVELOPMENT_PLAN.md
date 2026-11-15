# PromptHub Studio – Entwicklungsplan

## Leitlinien

Die Pakete sind klein, testbar und einzeln rücksetzbar. Parallelisierung wird nur
eingesetzt, wenn getrennte Worktrees und eine zuverlässige Schnittstelle
vorhanden sind. Das Quell-Repository existiert; zwei verifizierte Worker
und getrennte, verlässliche Arbeitsbereiche sind nicht nachgewiesen. Bis dahin
wird sequenziell gearbeitet. Der globale Job-Cap bleibt immer zwei.

## Phasen

### Phase 0 – Inventar und Schutzrahmen (erledigt)

- Arbeitsmappe, Regeln, lokale Tools und GitHub-Berechtigung geprüft.
- Kein passendes vorhandenes PromptHub-Repository gefunden; der Nutzer hat
  anschließend das private Repository `bndkxbqf2g-stack/prompthub-studio`
  erstellt. Es wurde zunächst als `private`, Standardbranch `main` mit
  Schreibzugriff geprüft. Am 2026-11-15 wurde es auf ausdrückliche
  Nutzeranweisung öffentlich gestellt.
- Der lokale Stand `ec8dc42` wurde am 2026-11-15 als Snapshot über die GitHub-API
  nach `main` übertragen (Commit `ca6210a`). Da kein Git-Transportzugang vorlag,
  wurde die lokale Commit-Abstammung nicht übernommen.
- `.github/workflows/ci.yml` ist enthalten. Der importierte Snapshot hatte
  `statuses: []`; der Pages-Vorbereitungscommit
  `3e92f9c2919fe7026eb3eddd4421d46a7358d903` wurde anschließend im GitHub-Actions-
  Lauf 43720677933 erfolgreich getestet (75 Node-Tests, statische Prüfung und
  Patch-Whitespace-Prüfung).
- Cloudflare-Pages-Profil und Function-Routen sind lokal vorbereitet. Im
  erreichbaren Cloud-Browser wurde kein vorhandenes Pages-Projekt gefunden;
  Workers & Pages zeigt 0/100.000 Requests heute. Die Billing-Seite lädt nicht.
  GitHub Free zeigt $0 Actions-Billable-Usage und ein $0.00 Actions-Budget mit
  Ausgabenblockierung.
  Die Cloudflare-GitHub-App verlangt selbst bei Auswahl eines einzelnen
  Repositories weitreichende Repository-Schreibrechte. Installation, Pages-
  Projekt und Deployment wurden deshalb bis zur separaten Berechtigungsfreigabe
  nicht gestartet.
- Angebotsküche ist laut Nutzer das bestehende GitHub-Repository `Einkaufen`.
  Der Inhalt bleibt bis zur bestandenen PromptHub-Abnahme und der einmaligen
  MVP-Umfangsbestätigung unangetastet.
- Aktueller Codex-Zugriff (2026-11-15): `codex-cli 0.167.0-alpha.4.1` ist in
  der verwalteten Windows-Shell installiert, aber `codex login status` scheitert
  mit `Could not find home directory`; `USERPROFILE` ist gesetzt, `HOME` und
  `CODEX_HOME` nicht. Die Umgebungsvariablen wurden nicht verändert. Die
  Codex-Cloud-Umgebungsabfrage meldet `asenvcfg_base` als bereit/lauffähig, aber
  ohne verknüpfte Repositories. Es wurde kein Cloud-Task gestartet. Somit ist
  weder ein authentifizierter lokaler Executor noch autonome Cloud-Ausführung
  für PromptHub nachgewiesen. `gh` und `wrangler` sind nicht verfügbar; ein
  echter Mac-Runner wurde nicht getestet. GitHub-Schreibzugriff wurde später
  über den vorhandenen Git Credential Manager nachgewiesen (`admin=true`,
  `push=true`); Sandbox-Datei-/Netzwerkgrenzen wurden für die erforderlichen
  Git-Metadaten- und Push-Befehle gezielt überwunden.
- Verbindliche Dokumentation und Abnahmematrix angelegt.

### Phase 1 – vertikaler und projektbezogener Schnitt (aktuell)

- Node-Server liefert API und iPhone-PWA.
- Memory-Control-Plane für deterministische Tests, GitHub-Adapter für Betrieb.
- OAuth-Session, Jobanlage, Status-/Event-Ansicht.
- Runner: Claim, Lease-Cap, Heartbeat, Checkpoint, Resume, sauberer Stopp.
- Mock-Executor und Tests für die vollständige Kette.
- Mehrprojekt-Katalog mit rein lesender GitHub-Analyse, Wiederverbinden,
  bestätigtem Entfernen und separat bestätigter projektbezogener Datenlöschung.
- Prompt-Designer mit getrennten Anforderungen/Annahmen, einem Interviewschritt,
  versioniertem Prompt, QA und explizitem Übergabegate.
- Kuratierte, quellenbelegte Prompt-Bibliothek und präzise Ressourcenmetriken.
- Projekt-Snapshot-Versionen, aufgabenbezogene Kontextauswahl und begrenzte,
  nicht persistente Deduplizierung verifizierter kostenfreier Provider-Analysen.
- Tests für gemessene, teilweise und nicht verfügbare Tokenwerte sowie
  tatsächliche Executor-Starts und Cache-Wiederverwendung.
- Runner-Abschlüsse werden mit tatsächlichen Check-Ergebnissen idempotent und
  CAS-geschützt projektbezogen gespeichert; der Prompt-Designer nutzt nur
  digest-geprüfte, nicht vertrauenswürdige Ergebnisse desselben Projekts.
- Fehlerprävention: echte Runnerfehler werden projektbezogen gruppiert; PWA-
  Symptomberichte und Hypothesen bleiben getrennt; menschliche
  Ursachenbestätigung verlangt echte passende Fehler-/Erfolgschecks und Prüfung
  derselben Korrektur. Promptkontext und Fehlerdashboard weisen Datenquelle,
  Belegstatus und Stichproben-/Aufbewahrungsgrenzen aus. CI speichert keine
  vollständigen Logs.
- A14-Strategiebewertungen sind über API und GitHub-Evidenz-Gate angebunden.
  Die PWA unterstützt projektbezogenes Erfassen, Anzeigen und freigabegesteuerte
  Übernahme. Job- und Fehlerhistorie-Ansichten fragen projektgefiltert ab und
  verwerfen verspätete Antworten nach Projektwechseln.
  Echte Review-/Actions-Nachweise, produktive API-Konfiguration und kontrollierte
  Wirksamkeitsvergleiche bleiben offene Arbeit.
- Offene Wissensarbeit: kontrollierte, explizit geprüfte projektübergreifende
  Übertragung und gepaarte Strategieexperimente mit Commit-/CI-Vergleich.
- Web-API-Handler ist zwischen Node-Adapter und Cloudflare Worker geteilt;
  Cloudflare Static Assets, same-origin API-Gate, KV-Sessionstore und
  Free-Quota-Fail-Closed-Tests sind implementiert.
- Die letzte Cloudflare-Pages-Veröffentlichung unter
  `https://prompthub-studio.pages.dev` bleibt erreichbar; automatische
  Production- und Preview-Deployments sind pausiert. GitHub Pages ist unter
  `https://bndkxbqf2g-stack.github.io/prompthub-studio/` aktiv; die PWA-Dateien
  sind unter `/src/pwa/`. GitHub Pages stellt keine Control API bereit. GitHub
  Actions Run 14
  (`43746180556`) für den offenen PR-Head `d45d1514656ce120da54e97de5e02f7ee68db288`
  ist erfolgreich. Das Control-API-KV-Binding, die OAuth-App und Runtime-Secrets
  sind weiterhin nicht eingerichtet; die API liefert deshalb HTTP 503.
  Cloudflare Fail closed ist verifiziert.
- Ein kostenloser Cloud-Codex-Runner bleibt mangels verifizierter Schnittstelle
  `not_configured`; Queue/Control-Plane und Ausführung bleiben getrennt.

### Phase 2 – GitHub-Betriebsintegration

- GitHub Issues/Labels/Kommentare und Contents-CAS gegen ein ausdrücklich
  konfiguriertes Repository testen.
- Erledigt: GitHub Actions Run 14 (`43746180556`) war für den offenen PR-Head
  `d45d1514656ce120da54e97de5e02f7ee68db288` erfolgreich; Pflichtjob `test`
  und die Schritte `npm test`, `npm run check`, `git diff --check` bestanden.
- Merge-Gate: Nach der ausdrücklichen Freigabe von `test` und der autorisierten
  Veröffentlichung des Quell-Repositories wurde `main` mit erforderlichem
  Check `test`, `strict=true` und Admin-Enforcement geschützt. API-Readback
  bestätigt die Werte. Die Regel verlangt keinen PR und beschränkt direkte
  Pushes nicht. Es wurde kein kostenpflichtiger Plan aktiviert. PR #2 ist offen
  und nicht gemergt; Remote-Control- und Runner-Integrationschecks bleiben offen.
- Repository-/Branch-Allowlist und Worktree-Verhalten gegen echte Fixtures prüfen.
- Projektpfade müssen je Runner explizit zugeordnet sein; kein Fallback auf das
  PromptHub-Arbeitsverzeichnis.

### Phase 3 – produktionsnahe Sicherheit

- Die öffentliche PWA-Ansicht ist über GitHub Pages erreichbar; der
  Unterpfad-Fix ist lokal vorbereitet. Der vorhandene Cloudflare-Deploy bleibt
  erreichbar, wird aber nicht mehr automatisch aktualisiert.
- OAuth-App, KV-Binding, Runtime-Secrets, Session-/Backup-Verfahren und
  Rate-Limits prüfen; bis dahin bleibt die Control API sicher geschlossen.
- Unabhängige Sicherheitsprüfung für Runner, Auth und Freigaben.

### Phase 4 – technische Abnahme

- Alle Kriterien aus `ACCEPTANCE_CRITERIA.md` mit realen Logs/Tests belegen.
- Abnahmebericht und offene Restriktionen versionieren.
- Erst bei bestandenem Gate zu Angebotsküche wechseln.

### Phase 5 – Angebotsküche (gesperrt bis Phase 4)

- Das vom Nutzer zugeordnete Repository `Einkaufen` anhand seiner GitHub-Identität
  verifizieren; Inhalte erst nach Phase 4 lesen.
- Regeln, Funktionen, Tests und Lücken inventarisieren.
- Priorisierten MVP-Plan vorlegen und einmalige Bestätigung einholen.

## Checkpoint-Protokoll

Nach jedem Paket: `npm test`, `npm run check`, `git diff --check`, Ergebnis in
`CHECKPOINTS.md`, Status der Abnahmematrix aktualisieren. Ein Fehlschlag stoppt
die nächste Phase nicht automatisch, aber es darf kein Erfolg behauptet werden.
