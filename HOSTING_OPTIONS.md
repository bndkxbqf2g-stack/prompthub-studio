# PromptHub Studio – Hosting-Optionen ohne Zusatzkosten

## Anlass und Ausgangslage

Der Nutzer hat Cloudflare als aktiven Hosting-Weg abgewählt. GitHub Pages ist
unter `https://bndkxbqf2g-stack.github.io/prompthub-studio/` erreichbar; die PWA
lädt dort unter `/src/pwa/` mit den korrigierten Unterpfad-Assets. Der Live-Test
zeigt jedoch `Die Control API ist derzeit nicht erreichbar.` GitHub Pages liefert
statische Dateien und führt keine serverseitige PromptHub-Control-API aus.

Ziel bleibt ein serverseitiger OAuth-/API-Pfad ohne laufende Zusatzkosten. Die
Control-Daten und Jobs bleiben in GitHub. Der Runner bleibt unabhängig vom
Hosting und darf bei Quoten- oder API-Ausfall keine Aktivität vortäuschen.

## Geprüfte Möglichkeiten

| Möglichkeit | Nachweister Umfang | Kosten-/Ausfallverhalten | Eignung |
|---|---|---|---|
| GitHub Pages allein | Statisches HTML/CSS/JS; keine serverseitige OAuth-Callback- oder API-Ausführung | GitHub-Free-Seite ist für das öffentliche Repo verfügbar | Für PWA-Shell und Dokumente geeignet; kein funktionsfähiger API-/Auth-Host |
| Netlify Free | Git-Deployments, Node-Functions, Netlify Blobs; öffentliches oder privates persönliches GitHub-Repository wird unterstützt | 0 USD/Monat, 300 Credits/Monat mit Hard Limit und ohne Auto-Recharge. Bei aufgebrauchtem Team-Kontingent pausiert Netlify alle Sites bis zum nächsten Abrechnungszyklus; keine automatische kostenpflichtige Überschreitung im Free-Tarif | Beste geprüfte Cloudflare-Alternative für den API-Vertikalschnitt, vorbehaltlich der Freigaben unten |
| Vercel Hobby | Serverless Functions; dokumentierte kostenlose Monatskontingente | Bei Überschreitung werden Funktionen üblicherweise bis zur Rücksetzung pausiert; der Tarif ist laut Vercel nur für persönliche, nicht-kommerzielle Nutzung | Technisch möglich, aber weniger passend als Netlify Free für eine verlässliche harte Team-Ausgabengrenze |

## Netlify-Kandidat: Kosten- und Betriebsgrenzen

- Free ist laut Netlify `0 USD/Monat`, umfasst 300 Credits pro Monat und hat ein
  hartes Limit ohne Auto-Recharge-Option. Die monatlichen Limits werden nicht
  kostenpflichtig überschritten. Bei Erreichen des Limits pausieren alle Sites
  des Teams bis zum nächsten Zyklus. Usage-Benachrichtigungen erfolgen laut
  Pricing bei 50 %, 75 % und 100 %.
- Credits werden gemeinsam verbraucht: Production-Deployments kosten 15 Credits;
  Function-Compute kostet 10 Credits je GB-Stunde; Webrequests kosten 2 Credits
  je 10.000 Requests; Bandbreite kostet 20 Credits je GB. Das sind veröffentlichte
  Tarifwerte, keine Prognose des tatsächlichen Projektverbrauchs.
- Netlify Functions akzeptieren Web-`Request` und liefern Web-`Response`; der
  vorhandene gemeinsame API-Handler kann damit voraussichtlich ohne Framework-
  Migration adaptiert werden.
- Netlify Blobs ist im Free-Tarif enthalten. Der SDK-Store kann explizit starke
  Konsistenz verwenden. Standardmäßig sind Updates und Löschungen eventual und
  können bis zu 60 Sekunden benötigen. Site-weite Stores sind über Deployments
  hinweg geteilt und haben keine eingebaute TTL; Preview-Deployments dürfen daher
  keine Produktions-Sitzungen lesen oder verändern.
- Eine GitHub-Integration benötigt die Verknüpfung des Netlify-Kontos mit dem
  persönlichen GitHub-Repository. Die Repository-API weist den Eigentümer als
  persönlichen Account aus; Netlify dokumentiert persönliche öffentliche und
  private Repositories als unterstützt.

## Vor Implementierung erforderliche Freigaben

1. **Hosting-Anbieter:** Netlify würde PromptHub-Quellcode, Funktionsausführung
   und Auth-/Sitzungsmetadaten verarbeiten. Der Nutzer muss die GitHub-App für
   genau dieses Repository verbinden und den Free-Tarif im Dashboard bestätigen.
2. **Auth-/Sitzungsänderung:** Die Netlify-Function braucht persistente
   serverseitige OAuth-Sitzungen und einmalige OAuth-State-Daten. Eine
   Netlify-Blobs-SessionStore-Implementierung verändert den vorhandenen
   Authentifizierungspfad und ist nach `AGENTS.md`/`SECURITY_RULES.md` eine
   kritische Änderung: zuerst ausdrückliche Freigabe, anschließend unabhängige
   Sicherheitsprüfung und Regressionstests. Die bestehenden Berechtigungs- und
   Session-Invarianten bleiben unverändert.
3. **Abhängigkeit:** Netlify dokumentiert `@netlify/blobs` als SDK. Das wäre eine
   neue Runtime-Abhängigkeit und weicht von der Built-in-only-MVP-Konvention ab.
   Vor Installation ist eine ausdrückliche, begründete Ausnahme erforderlich;
   das Paket wird auf eine geprüfte Version gepinnt und nicht in den Browserbund
   aufgenommen.
4. **Fail-closed-Konfiguration:** Nur Production bekommt OAuth-/Control-Secrets.
   Deploy Previews bleiben deaktiviert oder isoliert; `SESSIONS` nutzt starke
   Konsistenz. Ablaufzeiten werden serverseitig geprüft, abgelaufene Einträge
   werden entfernt, Storage-/Quota-Fehler beenden Auth-/Job-Schreibvorgänge mit
   `503`.
5. **Kosten-Gate:** Nur Free mit 300-Credit-Hard-Limit. Kein Upgrade, keine
   Credit-Packs, keine Auto-Recharge und kein Custom-Domain-Kauf. Die spätere
   Implementierung muss betroffene Jobs spätestens bei 75 % des gemessenen
   teamweiten Kontingents pausieren; fehlt ein verlässlicher Nutzungsstand,
   werden keine neuen Jobs gestartet. Diese Kontrolle ist noch nicht
   implementiert oder live nachgewiesen.

Bis diese Freigaben und die Netlify-Kontoverknüpfung vorliegen, bleibt GitHub
Pages der statische PWA-Einstieg. Es wird keine produktive Control API auf
GitHub Pages behauptet und Cloudflare bleibt unverändert pausiert.

## Quellen (abgerufen 2026-11-15)

- [GitHub Pages unterstützt keine serverseitigen Sprachen](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site?apiVersion=2022-11-28)
- [Netlify Free und Credit-Hard-Limit](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [Netlify Free-Pause bei Kontingentgrenze](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/)
- [Netlify-Function-Handler](https://docs.netlify.com/build/functions/get-started/)
- [Netlify Blobs: Konsistenz, TTL-Metadaten und Laufzeitlimits](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- [Netlify-GitHub-Repository-Unterstützung](https://docs.netlify.com/build/git-workflows/overview/)
- [Vercel Hobby-Kontingente und Pause bei Überschreitung](https://vercel.com/docs/plans/hobby)
- [Vercel-Hobby-Nutzung nur persönlich/nicht-kommerziell und Git-Provider-Limits](https://vercel.com/docs/limits)
