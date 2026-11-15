# PromptHub Studio – Cloudflare-Betrieb

## Status

`src/cloudflare/worker.mjs` und `wrangler.toml` bereiten eine kostenlose
serverlose PWA-Control-Plane vor. Es wurde nichts deployed und kein Cloudflare-
Konto, KV-Namespace oder PromptHub-GitHub-Control-Repository angelegt. Die
Worker-API verweigert Betrieb ohne gültige Secrets, privaten Control-Repo und
KV-Binding. Die PWA-Dateien sind als getrennte statische Assets konfiguriert.

Der Worker startet keinen Codex-Prozess. Solange kein separat eingerichteter
Runner echte Heartbeats liefert, meldet er `runner_status: not_configured`.
Jobs und Zustände liegen weiter in GitHub. Cloudflare wird nicht als autonome
Codex-Cloud-Ausführung dargestellt.

## Vor einem später genehmigten Betrieb

1. Im Cloudflare-Konto die **Free**-Stufe und fehlende Paid-Workers-Aktivierung
   anhand der Konto- und Billing-Einstellungen prüfen. Die Plattform stellt
   Free-Plan-Limits bereit, aber der Worker kann die Kontostufe oder eine
   hinterlegte Zahlungsmethode nicht selbst verifizieren.
2. Ein privates GitHub-Control-Repository auswählen oder nach ausdrücklicher
   Genehmigung erstellen. Für GitHub-Control-Plane und verwaltete Projekte nur
   erforderliche Repository-Berechtigungen vergeben.
3. In einem bestätigten Free-Konto einen Workers-KV-Namespace anlegen und in
   `wrangler.toml` als `SESSIONS` binden. Sessions laufen nach acht Stunden,
   OAuth-State nach zehn Minuten ab.
4. GitHub OAuth-App und den zugelassenen Login konfigurieren. Die Redirect-URL
   lautet `https://<Worker-Domain>/auth/github/callback`.
5. `GITHUB_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` und
   `SESSION_SECRET` ausschließlich als Cloudflare-Secrets setzen.
   `GITHUB_REPOSITORY`, `GITHUB_ALLOWED_LOGINS` und `GITHUB_BRANCH` sind
   Konfiguration, keine Geheimnisse. `SESSION_SECRET` benötigt mindestens 32
   Zeichen.
6. Vor einer Freigabe lokal Tests und Checks ausführen. Deployment und Änderungen
   an Cloud-/Billing-Einstellungen bleiben separate, ausdrücklich genehmigte
   externe Aktionen.

## Fehler- und Quotenverhalten

- PWA-Assets werden direkt über Static Assets ausgeliefert. Nur `/api/*`,
  `/auth/*` und `/healthz` rufen den Worker auf.
- KV-Ausfälle, einschließlich erschöpfter Free-Kontingente, liefern `503` und
  brechen die betroffene Operation ab. Es gibt weder Upgrade noch Ersatzdienst.
- Der Cloudflare-Free-Plan dokumentiert aktuell 100.000 Worker-Requests/Tag,
  10 ms CPU pro Aufruf sowie KV-Kontingente von 100.000 Reads, 1.000 Writes und
  1.000 Deletes pro Tag. Überschrittene KV-Limits lassen Operationen fehlschlagen.
- Cloudflare stellt den Worker-Quellcode nicht mit zuverlässigen Echtzeit-
  Kontoquoten bereit. Dieser MVP kann daher keine proaktive kontoweite
  Quotenwarnung oder einen Worker-weiten automatischen Job-Stop belegen. Bei
  Überschreitung wird fail-closed reagiert; die statische PWA kann erreichbar
  bleiben, während API und Auftragssteuerung pausieren.
- Worker Free Requests sind auf Plattformebene begrenzt; bei Erschöpfung kann
  Cloudflare die API mit einem Plattformfehler (u. a. 1027) ablehnen, bevor
  Anwendungscode ausgeführt wird. Das ist kein erfolgreicher oder aktiver Job.
- Es werden keine Cloudflare-Logs, Analytics, dauerhaften Cronjobs, Queues,
  Container oder kostenpflichtigen Produkte aktiviert.

Diese Einschränkungen halten die Architektur cloudfähig und kostenbewusst, aber
ersetzen keine Kontoprüfung, Live-Deployment-Prüfung oder Cloud-Runner-Abnahme.
