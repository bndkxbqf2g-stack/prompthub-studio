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
| Vercel Hobby | GitHub-Deployments, serverlose Functions, private Vercel Blob-Speicherung; Blob unterstützt bedingte `ifMatch`-Schreibvorgänge. Die CLI dokumentiert maschinenlesbare Nutzungsdaten via `vercel billing usage --json`. | 0 USD für Hobby; keine zusätzlichen Nutzungskäufe im Hobby-Tarif. Bei ausgeschöpften Kontingenten kann die betroffene Funktion bis zur Quotenrücksetzung nicht genutzt werden. Private Blob-Nutzung ist innerhalb der Hobby-Limits kostenlos und danach gesperrt. Nutzung laut Vercel nur persönlich und nicht-kommerziell. | Derzeit stärkster technische Kandidat, falls der Einsatz nachweislich persönlich und nicht-kommerziell bleibt. Kontoplan, Nutzungsreadback und End-to-End-Betrieb sind ungeprüft; keine Aktivierung erfolgt. |
| Netlify Free | Git-Deployments, Node-Functions, Netlify Blobs; öffentliches oder privates persönliches GitHub-Repository wird unterstützt | 0 USD/Monat, 300 Credits/Monat mit Hard Limit und ohne Auto-Recharge. Bei aufgebrauchtem Team-Kontingent pausiert Netlify alle Sites bis zum nächsten Abrechnungszyklus; keine automatische kostenpflichtige Überschreitung im Free-Tarif | Weiterer Kandidat. Teamweite Hinweise sind dokumentiert, aber ein nutzbarer maschinenlesbarer Usage-Readback ist nicht nachgewiesen. |
| Render Free | Serverlose Alternative steht hier nicht bereit; Free-Webservice mit dynamischem API-Server und kostenlosem Datenspeicher | Free-Webservices schlafen nach 15 Minuten Inaktivität ein; lokales Dateisystem ist flüchtig, Free-Postgres läuft nach 30 Tagen ab, und Bandbreite/Builds können bei vorhandenem Zahlungsmittel kostenpflichtig werden | Für die dauerhafte Control API und geschützte Sitzungsdaten ungeeignet. |
| Deno Deploy Free | Edge-Anwendungen mit monatlichen Free-Kontingenten | Free-Anwendungen pausieren bei Quotenüberschreitung; Deno Deploy soll im April 2027 eingestellt werden | Wegen angekündigtem Produktende keine tragfähige Plattformgrundlage. |

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
- Die Blobs-API bietet bedingte Einzel-Key-Schreibvorgänge (`onlyIfNew`,
  `onlyIfMatch`); sie ersetzen keine Transaktion über mehrere Keys. Der aktuelle
  OAuth-State-Store führt `take()` als Lesen plus Löschen aus und ist deshalb
  kein bereits geprüfter atomarer Consume-Adapter. Netlify müsste dafür einen
  gezielten Compare-and-set-Adapter mit Race-Regressionstest erhalten. Sitzungs-
  `expiresAt`-Werte müssen serverseitig erzwungen und abgelaufene Blobs begrenzt
  bereinigt werden, da site-weite Stores keine automatische TTL haben.
- Eine GitHub-Integration benötigt die Verknüpfung des Netlify-Kontos mit dem
  persönlichen GitHub-Repository. Die Repository-API weist den Eigentümer als
  persönlichen Account aus; Netlify dokumentiert persönliche öffentliche und
  private Repositories als unterstützt.
- Netlify dokumentiert teamweite Credit-Warnungen bei 50 %, 75 % und 100 % per
  E-Mail und In-App-Mitteilung. Die öffentliche Netlify-API-Referenz wurde nach
  einer maschinenlesbaren Team-Credit-/Usage-API durchsucht; ein solcher
  Endpunkt wurde dort nicht gefunden. Das ist ein Recherchebefund, kein Beweis,
  dass Netlify intern oder künftig keinen unterstützten Endpunkt anbietet.
  Solange kein autoritativer maschinenlesbarer Verbrauch vorliegt, kann PromptHub
  die erforderliche automatische 75-%-Jobpause nicht nachweisen und muss neue
  Cloud-Jobs bei unbekanntem Verbrauch geschlossen halten.

## Ergebnis der Hosting-Sicherheitsprüfung

Der dokumentierte Betriebsstatus ist **No-Go für produktive Aktivierung**.
Vercel Hobby ist der stärkste Kandidat für eine persönliche, nicht-kommerzielle
Nutzung: die offiziellen Unterlagen dokumentieren harte Hobby-Limits, JSON-Ausgabe
der aktuellen Nutzung sowie private Blob-Speicher mit bedingten
Compare-and-Swap-Schreibvorgängen. Diese Produktfunktionen wurden weder im
Nutzerkonto noch in PromptHub erprobt. Die Hobby-Nutzungsbedingungen, das
Hobby-Kontingent, der Usage-Readback im konkreten Konto, die neue
Blob-SDK-Abhängigkeit, OAuth-/Session-Adapter, Production-/Preview-Isolation und
Live-Smoke brauchen noch Prüfung und ausdrückliche Provider-/Deployment-Freigabe.
Netlify bleibt eine Alternative zur weiteren Prüfung; seine Bedingungen für
kommerzielle Nutzung und eine maschinenlesbare Team-Usage-Abfrage müssen vor
einer Auswahl separat bestätigt werden. Daher ist der vollständige autonome
Cloud-Betrieb noch nicht abnahmefähig.

## Vercel-Hobby-Kandidat: sichere Einsatzgrenzen

- Das Quell-Repository ist öffentlich und gehört einem persönlichen GitHub-
  Account. Vercel dokumentiert GitHub-Deployments; bei einem Hobby-Team müssen
  Deployments jedoch dem Inhaber zugeordnet sein. Die konkrete Integration ist
  nicht eingerichtet.
- Vercel Hobby ist nur für persönliche, nicht-kommerzielle Nutzung. Falls
  PromptHub oder das damit entwickelte Angebotsküche-Projekt kommerziell
  eingesetzt wird, ist Hobby nicht zulässig und dieser Kandidat scheidet aus.
- Hobby-Nutzung ist kostenlos, kann keine zusätzlichen Usage-Käufe aktivieren und
  sperrt Funktionen nach überschrittenen Free-Limits bis zur Rücksetzung. Keine
  Pro-Testphase starten, keinen kostenpflichtigen Tarif wählen und keine
  Zusatzcredits kaufen.
- Vercel Blob bietet für Hobby dokumentierte Freikontingente von 1 GB Speicher,
  10.000 einfachen Operationen, 2.000 erweiterten Operationen und 10 GB
  Blob-Transfer pro Monat. Bei Überschreitung wird Blob-Zugriff gesperrt, statt
  im Hobby-Tarif kostenpflichtig erweitert. Ein privater Blob-Store kann
  serverseitige OAuth-Sitzungen und einmalige OAuth-State-Daten speichern;
  `ifMatch` unterstützt bedingte Schreibvorgänge, die einen CAS-geschützten
  einmaligen State-Consume ermöglichen können. Diese Semantik muss im Adapter
  mit gezielten Konkurrenztests verifiziert werden.
- Die Vercel CLI dokumentiert `vercel billing usage --json`, einschließlich
  Serviceverbrauch, Kosten und optionalem Credit-Stand. Die Abfrage kann nach
  Projekt gruppiert werden. Sie liefert keinen bestätigten Nutzungswert des
  PromptHub-Kontos, bis Plan, Berechtigung, Aktualität und JSON-Antwort dort
  unabhängig geprüft wurden. Ohne aktuellen, vollständigen Readback bleiben
  Cloud-Jobs gesperrt.
- Für private Blob-Speicherung dokumentiert Vercel die neue Abhängigkeit
  `@vercel/blob` ab Version 2.3.0. Das widerspricht der Built-in-only-MVP-Regel
  und verlangt vor Installation eine ausdrücklich begründete Ausnahme. Tokens
  und Runtime-Secrets bleiben ausschließlich im Production-Environment;
  Preview-Deployments erhalten keinerlei Zugangsdaten.
- PWA und API müssten im Vercel-Projekt auf demselben `*.vercel.app`-Origin
  laufen, damit die vorhandenen `HttpOnly`-/`SameSite=Lax`-Cookies first-party
  bleiben. GitHub Pages könnte eine statische Spiegelung behalten, wäre aber
  nicht die angemeldete Laufzeit. Diese Änderung der aktiven PWA-Adresse braucht
  eine ausdrückliche Deployment-Freigabe.

## Vor Implementierung erforderliche Freigaben

1. **Hosting-Anbieter und Nutzungszweck:** Vercel würde PromptHub-Quellcode,
   Funktionsausführung und private Auth-/Sitzungsmetadaten verarbeiten. Der
   Nutzer muss die Vercel-Hobby-Verknüpfung für genau dieses öffentliche
   Repository sowie die persönliche, nicht-kommerzielle Nutzung ausdrücklich
   freigeben und den Hobby-Tarif ohne Pro-Testphase bestätigen. Netlify bleibt
   die Alternative, falls Vercels Nutzungsbedingung nicht passt.
2. **Auth-/Sitzungsänderung:** Die gewählte Function braucht persistente
   serverseitige OAuth-Sitzungen und einmalige OAuth-State-Daten. Eine
   Vercel-Blob- oder Netlify-Blobs-SessionStore-Implementierung verändert den
   vorhandenen Authentifizierungspfad und ist nach `AGENTS.md`/`SECURITY_RULES.md`
   eine kritische Änderung: zuerst ausdrückliche Freigabe, anschließend
   unabhängige Sicherheitsprüfung und Regressionstests. Bestehende
   Berechtigungs- und Session-Invarianten bleiben unverändert.
3. **Abhängigkeit:** Vercel dokumentiert `@vercel/blob` als SDK. Das wäre eine
   neue Runtime-Abhängigkeit und weicht von der Built-in-only-MVP-Konvention ab.
   Vor Installation ist eine ausdrückliche, begründete Ausnahme erforderlich;
   das Paket wird auf eine geprüfte Version gepinnt und nicht in den Browserbund
   aufgenommen. Für eine Netlify-Implementierung gilt dieselbe Ausnahmeprüfung
   für `@netlify/blobs`.
4. **Fail-closed-Konfiguration:** Nur Production bekommt OAuth-/Control-Secrets.
   Deploy Previews bleiben deaktiviert oder isoliert. Vercel Blob verwendet
   Private Access und geprüfte `ifMatch`-Schreibvorgänge; Netlify Blobs verwendet
   nur den getesteten starken Konsistenzmodus. Ablaufzeiten werden serverseitig
   geprüft, abgelaufene Einträge werden entfernt, Storage-/Quota-Fehler beenden
   Auth-/Job-Schreibvorgänge mit `503`.
5. **Kosten-Gate:** Nur Vercel Hobby mit den dokumentierten harten
   Free-Kontingenten; keine Pro-Testphase, kein Upgrade, kein Credit-Kauf und
   keine kostenpflichtige Domain. Die Implementierung muss betroffene Jobs
   spätestens bei 75 % des frisch gemessenen Projekt-/Teamkontingents pausieren;
   fehlt ein verlässlicher Nutzungsstand, werden keine neuen Jobs gestartet.
   Für Netlify gilt alternativ das 300-Credit-Hard-Limit ohne Auto-Recharge.
   Diese Kontrolle ist noch nicht implementiert oder live nachgewiesen.
6. **Verbrauchsmessung:** Vor Jobfreigabe `vercel billing usage --json` im
   autorisierten Hobby-Konto ausführen und Schema, Vollständigkeit, Projekt-
   Gruppierung und Aktualität prüfen. Eine dokumentierte CLI-Funktion ist noch
   kein erfolgreicher Readback. Ohne aktuelle verifizierte Messung bleibt die
   Cloud-Ausführung gesperrt. Netlify-Dashboard-Warnungen allein belegen keine
   automatische Jobpause in PromptHub.

Bis Provider-/Deployment-Freigabe und die nötige Konto-/GitHub-Verknüpfung für
eine der Optionen vorliegen, bleibt GitHub Pages der statische PWA-Einstieg. Es
wird keine produktive Control API auf GitHub Pages behauptet und Cloudflare
bleibt unverändert pausiert.

## Quellen (Netlify-Angaben abgerufen 2026-11-15; Vercel-, Render- und Deno-Angaben abgerufen 2026-11-16)

- [GitHub Pages unterstützt keine serverseitigen Sprachen](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site?apiVersion=2022-11-28)
- [Netlify Free und Credit-Hard-Limit](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [Netlify Free-Pause bei Kontingentgrenze](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/)
- [Netlify-Function-Handler](https://docs.netlify.com/build/functions/get-started/)
- [Netlify Blobs: Konsistenz, TTL-Metadaten und Laufzeitlimits](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- [Netlify: teamweite Credit-Nutzung und 50/75/100-%-Benachrichtigungen](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/monitor-usage-for-credit-based-plans/)
- [Netlify öffentliche API-Referenz](https://open-api.netlify.com/)
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
- [Deno Deploy wird im April 2027 eingestellt](https://docs.deno.com/deploy/usage/)
- [Render Free-Webservice-Limits und Kosten-/Speicherverhalten](https://render.com/docs/free)
