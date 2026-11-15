# PromptHub Studio – Entwicklungsplan

## Leitlinien

Die Pakete sind klein, testbar und einzeln rücksetzbar. Parallelisierung wird nur
eingesetzt, wenn getrennte Worktrees und eine zuverlässige Schnittstelle
vorhanden sind. Das private Quell-Repository existiert; zwei verifizierte Worker
und getrennte, verlässliche Arbeitsbereiche sind nicht nachgewiesen. Bis dahin
wird sequenziell gearbeitet. Der globale Job-Cap bleibt immer zwei.

## Phasen

### Phase 0 – Inventar und Schutzrahmen (erledigt)

- Arbeitsmappe, Regeln, lokale Tools und GitHub-Berechtigung geprüft.
- Kein passendes vorhandenes PromptHub-Repository gefunden; der Nutzer hat
  anschließend das private Repository `bndkxbqf2g-stack/prompthub-studio`
  erstellt. Es wurde geprüft: `private`, Standardbranch `main`, Schreibzugriff.
- Der lokale Stand `ec8dc42` wurde am 2026-11-15 als Snapshot über die GitHub-API
  nach `main` übertragen (Commit `ca6210a`). Da kein Git-Transportzugang vorlag,
  wurde die lokale Commit-Abstammung nicht übernommen.
- `.github/workflows/ci.yml` ist enthalten. Die Commit-Statusabfrage lieferte
  `statuses: []`; ein erfolgreicher GitHub-Actions-Lauf bleibt unbelegt.
- Angebotsküche ist laut Nutzer das bestehende GitHub-Repository `Einkaufen`.
  Der Inhalt bleibt bis zur bestandenen PromptHub-Abnahme und der einmaligen
  MVP-Umfangsbestätigung unangetastet.
- Aktuelle Codex-Prüfung: `codex-cli 0.167.0-alpha.4.1` ist installiert und
  `codex login status` meldet mit dem vorhandenen `CODEX_HOME` eine ChatGPT-
  Sitzung. Ein begrenzter `codex exec --ephemeral --sandbox read-only`-Test
  scheiterte mit `Zugriff verweigert` beim Schreiben interner temporärer und
  Diagnosezustandsdateien. Das belegt keine ausführbare Runner-Verbindung.
  Umgebung: Windows; `gh` und `wrangler` sind nicht verfügbar. Ein echter
  Mac-Runner und eine kostenlose Cloud-Executor-Freigabe sind nicht verifiziert.
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
- Offene Wissensarbeit: kontrollierte, explizit geprüfte projektübergreifende
  Übertragung und gepaarte Strategieexperimente mit Commit-/CI-Vergleich.
- Web-API-Handler ist zwischen Node-Adapter und Cloudflare Worker geteilt;
  Cloudflare Static Assets, same-origin API-Gate, KV-Sessionstore und
  Free-Quota-Fail-Closed-Tests sind implementiert.
- Cloudflare-Plan, echtes KV-Binding, OAuth-App und privates GitHub-Control-Repo
  sind nicht eingerichtet; keine Aktivierung oder Veröffentlichung erfolgt.
- Ein kostenloser Cloud-Codex-Runner bleibt mangels verifizierter Schnittstelle
  `not_configured`; Queue/Control-Plane und Ausführung bleiben getrennt.

### Phase 2 – GitHub-Betriebsintegration

- GitHub Issues/Labels/Kommentare und Contents-CAS gegen ein ausdrücklich
  konfiguriertes Repository testen.
- Einen tatsächlichen GitHub-Actions-Lauf des `push`-Commits erfassen und
  Pflichtchecks mit erfolgreichem Ergebnis dokumentieren.
- Repository-/Branch-Allowlist und Worktree-Verhalten gegen echte Fixtures prüfen.
- Projektpfade müssen je Runner explizit zugeordnet sein; kein Fallback auf das
  PromptHub-Arbeitsverzeichnis.

### Phase 3 – produktionsnahe Sicherheit

- Externes HTTPS-Hosting der Control API nur nach Nutzerfreigabe.
- OAuth-App, Scopes, Session-/Backup-Verfahren und Rate-Limits prüfen.
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
