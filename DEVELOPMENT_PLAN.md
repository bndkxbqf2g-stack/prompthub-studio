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
  der verwalteten Windows-Shell installiert. `codex login status` scheiterte
  zunächst mit `Could not find home directory`; mit einem nur für den Aufruf
  gesetzten `CODEX_HOME` auf das vorhandene `%USERPROFILE%\.codex` meldete die
  CLI erfolgreich eine ChatGPT-Sitzung. Der Override wurde entfernt; es wurde
  keine dauerhafte Umgebungs- oder Auth-Konfiguration geändert. Das bestätigt
  den Login dieser CLI-Umgebung, aber weder die Konfiguration des PromptHub-
  Runners noch autonome Cloud-Ausführung. Die Codex-Cloud-Umgebungsabfrage
  meldet `asenvcfg_base` als bereit/lauffähig, aber ohne verknüpfte Repositories;
  es wurde kein Cloud-Task gestartet. `gh` und `wrangler` sind nicht verfügbar;
  ein echter Mac-Runner wurde nicht getestet. GitHub-Schreibzugriff wurde später
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
- Die aktive PWA liegt unter
  `https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/`. Main-Commit
  `bf5a15c1b8a4fc0f832e55aefcdc84bfa440c5a5` bestand Main-CI-Run 81
  (`43770701922`) und GitHub-Pages-Run 21 (`43770701589`). PR #21 bestand Run 80
  auf Apple-Silicon- und Intel-macOS sowie mit Pflichtjob `test` und wurde
  automatisch gemergt. GitHub Pages hostet nur die
  statische PWA, keine Control API. Cloudflare ist als Host abgewählt; das
  Projekt ist pausiert, nicht gelöscht, und die alte Veröffentlichung bleibt
  erreichbar. Die endgültige Löschung wartet auf die gesonderte Bestätigung.
  Für die frühere Cloudflare-Control-API fehlten OAuth-App, Runtime-Secrets und
  KV-Binding; ihr dokumentierter Status war HTTP 503. Ein produktiver
  Cloud-Control-Plane-Betrieb ist nicht nachgewiesen.
- Ein kostenloser Cloud-Codex-Runner bleibt mangels verifizierter Schnittstelle
  `not_configured`; Queue/Control-Plane und Ausführung bleiben getrennt.
- CI prüft jetzt vollständig auf Apple-Silicon- und Intel-macOS-Standard-Runnern.
  Der bestehende Pflichtjob `test` blockiert bei fehlgeschlagenem oder
  übersprungenem macOS-Lauf. PR #21 und Main-Run 81 bestanden diese Lanes. Das
  prüft macOS-Kompatibilität, ersetzt aber keinen Nachweis eines lokalen
  MacBook-Runners.

### Phase 2 – GitHub-Betriebsintegration

- GitHub Issues/Labels/Kommentare und Contents-CAS gegen ein ausdrücklich
  konfiguriertes Repository testen.
- Erledigt: GitHub Actions Run 19 (`43749169752`) war für PR #2 mit Head
  `36ba10a4166bb365e6fcc8d06b443a2d77118d35` erfolgreich; Pflichtjob `test`
  bestand und PR #2 wurde mit Merge-Commit
  `c3d479a7676a143ebf4c6ad8448651e162bb9ea3` in `main` integriert.
- Merge-Gate: Nach der ausdrücklichen Freigabe von `test` und der autorisierten
  Veröffentlichung des Quell-Repositories wurde `main` mit erforderlichem
  Check `test`, `strict=true` und Admin-Enforcement geschützt. API-Readback
  bestätigt die Werte. Eine erneute Prüfung in GitHub Settings am 2026-11-15
  zeigte: Die Regel verlangt keinen PR; direkte Commits auf `main` sind weiterhin
  möglich. `allow_auto_merge=true` ist aktiviert. Der Nutzer hat zukünftige
  automatische Merges autorisiert. Die ausdrückliche Entscheidung, zusätzlich
  eine PR-Pflicht zu setzen, steht aus. Es wurde kein kostenpflichtiger Plan
  aktiviert. Remote-Control- und Runner-Integrationschecks bleiben offen.
- Repository-/Branch-Allowlist und Worktree-Verhalten gegen echte Fixtures prüfen.
- Projektpfade müssen je Runner explizit zugeordnet sein; kein Fallback auf das
  PromptHub-Arbeitsverzeichnis.

### Phase 3 – produktionsnahe Sicherheit

- Die öffentliche PWA-Ansicht ist über GitHub Pages erreichbar; die Live-Prüfung
  lud UI, Styles, Manifest und App-Icon. Die Control API bleibt auf dem
  statischen Host unerreichbar. Der pausierte frühere Cloudflare-Deploy bleibt
  erreichbar, wird aber nicht automatisch aktualisiert. Ein Browser-Smoke im
  Viewport 390×844 zeigt nun eine Erklärung der fehlenden Control API. Die
  Aktualisieren-Aktion wiederholt den Bootstrap und behauptet bei weiterem
  API-Ausfall keinen Erfolg. Ohne API bleiben Projektansicht, Anmeldung und
  Aufträge verborgen. Die echte iPhone-Installation und Live-Offline-/Update-
  prüfung sind noch offen.
- OAuth-App, KV-Binding, Runtime-Secrets, Session-/Backup-Verfahren und
  Rate-Limits prüfen; bis dahin bleibt die Control API sicher geschlossen.
- Hosting-Alternative nach Abwahl Cloudflare prüfen: `HOSTING_OPTIONS.md` bewertet
  Netlify Free als noch nicht aktivierte Option. Auth-/Session-Adapter,
  Runtime-Abhängigkeit und Netlify-Kontoverknüpfung warten auf ausdrückliche
  Freigaben. Die unabhängige, rein lesende Sicherheitsprüfung vom 2026-11-15
  empfiehlt bis zu Tests, Live-Nachweisen und einer verlässlichen teamweiten
  Quotenmessung No-Go für die produktive Aktivierung.
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
