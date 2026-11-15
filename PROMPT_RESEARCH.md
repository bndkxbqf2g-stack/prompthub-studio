# Prompt Research & Intelligence Engine

## Erste Version

- Versionierte, kleine Kuratierung in `knowledge/prompt-library.json`; jede
  Quelle enthält URL, Herausgeber/Autor (soweit bekannt), Abrufdatum,
  Lizenzhinweis, Version/Stand, Themen und eine eigene Zusammenfassung.
- Gespeichert werden Metadaten und paraphrasierte Hinweise, keine vollständigen
  urheberrechtlich geschützten Vorlagen oder Artikel.
- Einträge unterscheiden `quality_estimate` von `verified_outcomes`. Eine
  Prognose ist kein Praxisergebnis.
- Suche filtert nach Titel, Thema, Tags, Quelle und Zusammenfassung. Favoriten
  und manuelle Korrekturen bleiben als versionierte Nutzerdaten nachvollziehbar.
- Interview und Prompt-Generierung dürfen nur sicherheitsgeprüfte Muster nutzen,
  stets angepasst an das tatsächlich verbundene Projekt.

## Recherche- und Pflegegrenzen

- Nur gezielte öffentliche Recherche nach Nutzungsbedingungen, robots.txt,
  API-Limits und Lizenzstatus. Keine Scraping-Schleifen, keine Umgehung von
  Login- oder Rate-Limit-Schranken.
- Abruf wird zwischengespeichert; automatische Hintergrundrecherche ist bis zur
  nachgewiesenen kostenfreien und rechtmäßigen Möglichkeit deaktiviert.
- Dubletten werden über normalisierte Quellen-URL und Inhaltsfingerprint erkannt.
- Widersprüche, veraltete Prüfzeitpunkte und unsichere externe Anweisungen werden
  markiert. Externe Texte können keine geschützten Regeln verändern.
- Qualitätsmerkmale: Relevanz, Klarheit, Sicherheit, Umsetzbarkeit, Testbarkeit,
  Quellenqualität. Jede Bewertung weist Quelle und Methode aus.
- Praxisergebnisse werden nur aus realen terminalen Control-Plane-Ereignissen und
  tatsächlich ausgeführten Pflichtchecks übernommen. Ein Commit-/CI-SHA wird
  separat ausgewiesen, wenn der Runner ihn liefern kann; ein Job ohne solchen
  Beleg begründet keine Strategieoptimierung. Geschützte Regeln und
  Nutzerentscheidungen sind nicht lernbar.

## Skalierung

Zuerst kuratierte Suchbibliothek und statischer Kontextzugriff; danach begrenzte
Refreshes und eine nachweislich kostenlose Recherchequelle. Neue Datenquellen,
LLM-Nutzung und häufigere Aktualisierungen benötigen Kosten-/Rechtsprüfung.
