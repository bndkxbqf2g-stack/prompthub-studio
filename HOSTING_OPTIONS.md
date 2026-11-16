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
| Netlify Free | Git-Deployments, Node-Functions und Blob-Storage; öffentliche und private Repository-Deployments sind dokumentiert. Der aktuelle Self-Serve-Vertrag untersagt Training auf Customer Content, sofern der Kunde nicht ausdrücklich optiert. | 0 USD/Monat, 300 Credits/Monat mit hartem Limit und ohne Auto-Recharge. Free-Nutzung wird laut Vertrag nicht berechnet; beim Limit pausiert Netlify alle Sites des Teams. | Die Implementierung wurde vom Nutzer am 2026-11-16 freigegeben. Konto, Plan, Repository-Verknüpfung, Datenpfad, Storage und automatischer Quoten-Readback sind live ungeprüft. |
| Vercel Hobby | Git-Deployments, Functions, Blob und dokumentierte Usage-CLI | 0 USD, aber Hobby nur persönlich/nicht-kommerziell. Die aktuellen Terms gestatten für Hobby die Nutzung von Customer Content zum KI-/ML-Training und zur Weitergabe an Dritte für Modellverbesserung. | Für PromptHub-Daten ausgeschlossen, solange kein ausdrücklich anwendbarer Opt-out die Nutzung sicher ausschließt. Keine Verbindung oder Aktivierung erfolgt. |
| Render Free | Serverlose Alternative steht hier nicht bereit; Free-Webservice mit dynamischem API-Server und kostenlosem Datenspeicher | Free-Webservices schlafen nach 15 Minuten Inaktivität ein; lokales Dateisystem ist flüchtig, Free-Postgres läuft nach 30 Tagen ab, und Bandbreite/Builds können bei vorhandenem Zahlungsmittel kostenpflichtig werden | Für die dauerhafte Control API und geschützte Sitzungsdaten ungeeignet. |
| Deno Deploy Free | Edge-Anwendungen mit monatlichen Free-Kontingenten | Free-Anwendungen pausieren bei Quotenüberschreitung; Deno Deploy soll im April 2027 eingestellt werden | Wegen angekündigtem Produktende keine tragfähige Plattformgrundlage. |

## Netlify-Kandidat: Kosten- und Betriebsgrenzen

- Free ist laut Netlify `0 USD/Monat`, umfasst 300 Credits pro Monat und hat ein
  hartes Limit ohne Auto-Recharge-Option. Die monatlichen Limits werden nicht
  kostenpflichtig überschritten. Bei Erreichen des Limits pausieren alle Sites
  des Teams bis zum nächsten Zyklus. Usage-Benachrichtigungen erfolgen laut
  Pricing bei 50 %, 75 % und 100 %.
- Der aktuelle Netlify-Self-Serve-Vertrag (§ 6.2) gestattet die Verarbeitung von
  Customer Content zur Bereitstellung, Absicherung und Unterstützung der Dienste
  und untersagt Training oder Fine-Tuning von KI-/ML-Modellen mit diesem Inhalt,
  solange der Kunde nicht ausdrücklich zustimmt. Das ist eine Anbieterzusage,
  kein technischer Schutz gegen Fehlkonfiguration oder unberechtigten Zugriff.
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
- Die Blobs-API bietet bedingte Einzel-Key-Schreibvorgänge (`onlyIfNew`,
  `onlyIfMatch`); sie ersetzen keine Transaktion über mehrere Keys. Der
  implementierte OAuth-State-Store konsumiert States mit einem bedingten
  ETag-Update; gleichzeitige Rückrufe können denselben State nicht beide
  verbrauchen. Sitzungen werden anwendungsseitig verschlüsselt, Ablaufzeiten
  serverseitig geprüft und abgelaufene Blobs begrenzt opportunistisch bereinigt,
  da site-weite Stores keine automatische TTL haben.
- Eine GitHub-Integration benötigt die Verknüpfung des Netlify-Kontos mit dem
  persönlichen GitHub-Repository. Die Repository-API weist den Eigentümer als
  persönlichen Account aus; Netlify dokumentiert persönliche öffentliche und
  private Repositories als unterstützt.
- Netlify dokumentiert teamweite Credit-Warnungen bei 50 %, 75 % und 100 % per
  E-Mail und In-App-Mitteilung. Die öffentliche API-Referenz dokumentiert einen
  Build-Status-Endpunkt mit Build-Minuten, aber keinen vollständigen teamweiten
  Credit-Verbrauch. Das ist ein Recherchebefund, kein Beweis, dass Netlify
  intern oder künftig keinen unterstützten Endpunkt anbietet. Solange kein
  autoritativer, aktueller Gesamtverbrauch maschinenlesbar vorliegt, kann
  PromptHub die automatische 75-%-Jobpause nicht nachweisen und muss neue
  Cloud-Jobs bei unbekanntem Verbrauch geschlossen halten. Dieses fail-closed
Job-Gate ist jetzt in API-Annahme und Freigabewegen verdrahtet.

## Ergebnis der Hosting-Sicherheitsprüfung

Der dokumentierte Betriebsstatus ist **No-Go für produktive Aktivierung**.
Netlify Free ist freigegeben und die Repository-Konfiguration ist vorbereitet.
Konto, Free-Tarif, Repository-Verknüpfung, Production-/Preview-Isolation im
Dashboard, OAuth-/Sitzungs-Livezugriff und HTTPS-Smoke sind noch nicht geprüft.
Ein maschinenlesbarer Credit-Gesamtverbrauch ist nicht verfügbar; die
implementierte API hält Cloud-Jobs deshalb gesperrt. Vercel Hobby ist für
PromptHub-Daten ausgeschlossen, solange seine aktuellen Terms Hobby-Content für
Modelltraining freigeben; zusätzlich ist Hobby nur für persönliche,
nicht-kommerzielle Nutzung erlaubt. Der vollständige autonome Cloud-Betrieb ist
damit noch nicht abnahmefähig.

## Vercel Hobby: Ausschlussgründe für PromptHub-Daten

- Die aktuellen Terms (zuletzt geändert 2026-10-19) beschränken Hobby auf
  persönliche, nicht-kommerzielle Nutzung. Für Hobby werden Customer Content und
  Eingaben außerdem für KI-/ML-Training und zur Weitergabe an Dritte für diesen
  Zweck lizenziert. Das ist mit vertraulichen Projekt- und Sitzungsdaten nicht
  vereinbar, solange kein ausdrücklich anwendbarer Opt-out nachgewiesen wird.
- Die CLI dokumentiert zwar `vercel billing usage --json`; ein maschinenlesbarer
  Usage-Endpunkt beseitigt diese Daten- und Nutzungsbedingungen nicht.
- Vercel ist weder verbunden noch aktiviert. Der Kandidat wird nicht weiter
  vorbereitet, bis eine aktuelle Vertragsänderung oder ein verifizierter Opt-out
  die Bedingungen für PromptHub-Daten sicher ändert.

## Freigabe und verbleibende Betriebsschritte

1. **Hosting-Anbieter:** Der Nutzer hat Netlify Free für dieses Repository und
   die serverseitige Verarbeitung am 2026-11-16 freigegeben. Diese Freigabe
   schließt Tarifwechsel, Zusatzcredits, kostenpflichtige Domains und
   Auto-Recharge aus. Netlify-Konto und Free-Tarif müssen vor dem Deployment
   read-only im Dashboard verifiziert werden.
2. **Auth-/Sitzungsänderung:** `src/auth/netlify-blob-stores.mjs` nutzt
   AES-256-GCM für Sessiondaten und stark konsistente `onlyIfMatch`-Schreibvorgänge
   für OAuth-State-Consume. Pflicht-Regressionstests sind implementiert; die unabhängige Sicherheitsprüfung ist abgeschlossen und fand keine Auth-/Session-Sicherheitsbefunde. Der fehlende Credit-Readback bleibt der offene operative Befund. Bestehende Session- und Freigabe-Invarianten bleiben aktiv.
3. **Abhängigkeit:** `@netlify/blobs@10.7.13` ist exakt gepinnt, unterstützt die
   vorhandene Node-20-Runtime und wird nur serverseitig gebündelt.
4. **Fail-closed-Konfiguration:** Die Netlify Function ist auf den Production-
   Context und die konfigurierte HTTPS-Origin beschränkt. Same-Origin-Schutz ist
   aktiviert; Produktions-Secrets müssen im Netlify-Dashboard ausschließlich
   dem Production-Context zugeordnet werden. Preview-Requests erreichen keinen
   Blob-Store. Ablaufzeiten werden geprüft; Storagefehler blockieren
   Schreibvorgänge.
5. **Kosten-Gate:** Netlify Free muss 300 Credits, ein hartes Limit und
   deaktivierte Auto-Recharge aufweisen. Keine kostenpflichtige Domain,
   Zusatzcredits oder Tarifwechsel. Bei mindestens 75 % pausiert PromptHub neue
   Jobs und Freigaben. Ohne frischen, autoritativen Readback bleibt das
   implementierte Gate `unknown` und geschlossen.
6. **Verbrauchsmessung:** Teamweite Netlify-Warnungen im Dashboard ersetzen keinen
   API-Readback in PromptHub. Vor Jobfreigabe muss ein verlässlicher, aktueller
   Gesamtverbrauch für das konkrete Team nachgewiesen werden; der dokumentierte
   Build-Status-Endpunkt mit Build-Minuten genügt nicht.

Bis das Netlify-Konto read-only geprüft, das GitHub-Repository verbunden, die
Production-Secrets sicher gesetzt und ein Free-Plan-Deployment tatsächlich
verifiziert ist, bleibt GitHub Pages der statische PWA-Einstieg. Es wird keine
produktive Control API auf GitHub Pages behauptet und Cloudflare bleibt
unverändert pausiert.

## Quellen (abgerufen am 2026-11-16)

- [GitHub Pages unterstützt keine serverseitigen Sprachen](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site?apiVersion=2022-11-28)
- [Netlify Free und Credit-Hard-Limit](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [Netlify Free-Pause bei Kontingentgrenze](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/)
- [Netlify-Function-Handler](https://docs.netlify.com/build/functions/get-started/)
- [Netlify Blobs: Konsistenz, TTL-Metadaten und Laufzeitlimits](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- [Netlify: teamweite Credit-Nutzung und 50/75/100-%-Benachrichtigungen](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/monitor-usage-for-credit-based-plans/)
- [Netlify: Credits und Hard-Limit](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- [Netlify OpenAPI-Referenz mit Build-Status-Endpunkt (Build-Minuten)](https://open-api.netlify.com/)
- [Netlify Self-Serve-Vertrag, insbesondere § 6.2 Customer Content/AI-Training](https://www.netlify.com/pdf/self-serve-subscription-agreement.pdf)
- [Netlify Data Processing Agreement](https://www.netlify.com/pdf/netlify-dpa.pdf)
- [Netlify Functions Usage/Billing](https://docs.netlify.com/build/functions/usage-and-billing/)
- [Netlify-GitHub-Repository-Unterstützung](https://docs.netlify.com/build/git-workflows/overview/)
- [Vercel-Hobby-Nutzung nur persönlich/nicht-kommerziell und Git-Provider-Limits](https://vercel.com/docs/limits)
- [Vercel Hobby: Free-Kontingente und Nutzungspause](https://vercel.com/docs/plans/hobby)
- [Vercel Usage CLI mit JSON-Ausgabe und Projektgruppierung](https://vercel.com/docs/cli/usage)
- [Vercel Billing Usage JSON-Schema](https://vercel.com/docs/cli/usage#json)
- [Vercel Blob Hobby-Kontingente und Fail-Closed bei Limitüberschreitung](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Vercel Private Blob und serverseitige Zugriffskontrolle](https://vercel.com/docs/vercel-blob/private-storage)
- [Vercel Blob bedingte Schreibvorgänge via `ifMatch`](https://vercel.com/docs/vercel-blob)
- [Vercel-Hobby-Repositories und Deployment-Eigentümer](https://vercel.com/docs/git/vercel-for-github)
- [Vercel Hobby ist persönlich und nicht-kommerziell](https://vercel.com/legal/terms)
- [Vercel Terms of Service: Hobby und Customer Content/AI-Training](https://vercel.com/legal/terms)
- [Deno Deploy wird im April 2027 eingestellt](https://docs.deno.com/deploy/usage/)
- [Render Free-Webservice-Limits und Kosten-/Speicherverhalten](https://render.com/docs/free)
