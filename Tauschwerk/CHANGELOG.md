# 2.2.0

- Hell-/Dunkel-Schalter im Kopfbereich, auch auf dem Handy und per Tastatur bedienbar.
- Vollständige dunkle Farbwelt für Karten, Vergleiche, Online-Recherche, Tauschrechner, Formulare, Dialoge und Statusmeldungen; passende Text-, Rahmen- und Akzentfarben.
- Ohne eigene Auswahl der Geräte-Einstellung folgen. Manuelle Auswahl im jeweiligen Browser speichern, vor dem ersten Rendern anwenden und zwischen Tabs synchronisieren; andere HA-Nutzer behalten ihre eigene Auswahl.
- Darstellung umschalten, ohne laufende Eingaben, Datenmodus oder Geräteauswahl zurückzusetzen. Auch ohne verfügbaren Browserspeicher benutzbar; Ausdrucke bleiben hell.

# 2.1.0

- Tauschwerk heißt jetzt Swivo: neue Wortmarke mit S-Symbol aus zwei Tauschrouten und dem Claim „Deine Technik. Dein nächster Deal.“
- Neuer Name in Navigation, Browser-Titel, Start-/Fehleranzeigen, Hilfe, Backups, CSV-Export und Home-Assistant-App samt Seitenleistenname.
- Repository-Adresse, HA-App-ID, Datenbankpfade, Schnittstellen und gespeicherte Browserauswahl bleiben kompatibel. Bestehende Installation normal aktualisieren.

# 2.0.0

- Neue helle Gestaltung mit Violett, Korallakzenten, transparenten Glasflächen und schwebender dunkler Navigation.
- Vergleich, Katalog, Online-Recherche, Tauschrechner, Historie, Einstellungen und Dialoge neu gestaltet; mobile Navigation mit kurzen Beschriftungen, Tastaturfokus und reduzierte Bewegung berücksichtigt.
- Nintendo-Datenblätter mit allgemeinen Überschriften, BEM-/wechselnden CSS-Klassen und zugänglichen Grids auslesen; konkrete Produktidentität aus Dokumenttitel, Produktdaten oder Produktname erhalten.
- Bei gesperrten oder nicht auslesbaren Nintendo-Seiten passende offizielle Datenblattseiten zusätzlich prüfen. Switch, Switch 2, OLED und Lite weiter getrennt prüfen; keine technischen Angaben aus Suchbegriffen ableiten.
- Bereits angezeigte Suchtreffer behalten ihren ursprünglichen Modellbezug, wenn das Suchfeld für das nächste Gerät verändert wird.
- Fehler zeigen betroffene URL sowie Abruf-, Parser- oder Modellfehler je geprüfter Seite; denselben Abruf direkt erneut versuchen können.
- Alten Quellen-Zwischenspeicher erneut auslesen; bestehende Kataloge, Tausche und Home-Assistant-Daten erhalten.

# 1.8.0

- Online-Katalogsuche fragt jeden freien Suchbegriff nach kurzer Eingabepause im Web ab; gespeicherte Geräte und Webtreffer getrennt anzeigen.
- Switch 1/Original, Switch 2, OLED und Lite unterscheiden; RTX-Schreibweisen mit oder ohne Leerzeichen erkennen.
- Öffentliche Webquellen direkt im Programm auf Gerätedaten prüfen; keine pauschalen Browser-only-Karten mehr für HTML-Seiten.
- Nintendo-Regionaldomains und div-basierte Hardware-Datenblätter unterstützen; technische Herstellerlinks und passende Alternativquellen bei gesperrten oder unlesbaren Seiten automatisch prüfen. Tatsächlich verwendete Quelle bleibt sichtbar.
- DuckDuckGo und Bing mit Google als Ersatzsuche ergänzen; Sperren und ausgeführte erfolglose Suchen klar melden.
- Fehlende Bilder angezeigter Geräte automatisch suchen; weitere Quellen, responsive Bilder und Produktgalerien berücksichtigen.
- Rasterbilder bis 2 MB laden und im Browser zu kompakten Vorschaubildern verkleinern. Bilder samt Herkunft bleiben offline und in Backups verfügbar.
- Lange Abrufe abbrechen können, veraltete Suchantworten verwerfen und Offlinebetrieb erhalten.

# 1.7.0

- Tauschrechner mit freien Modelleingaben, optionalem Katalog und klar getrennten Online-/Eigenwerten.
- Beide Sets gemeinsam abgleichen, Seiten tauschen und die berechnete faire Zuzahlung übernehmen.
- Mehrere gleiche Geräte sowie bis zu acht Zusatzgeräte mit eigenem Zustand und eigener Variante bewerten.
- Online-bewertete Hauptgeräte mit optionalen eigenen Stückwerten für Zusatzgeräte kombinieren; Wertbasis bleibt sichtbar.
- Eigene Vergleichsangebote ergänzen, wenn Preisquellen gesperrt sind; getrennte Bewertung von privaten, Händler- und selbst erfassten Preisen.
- Gründe für ausgeschlossene Angebote anzeigen, Dubletten vor der Mindestanzahl entfernen, verneinten Lieferumfang erkennen und Händlerbasis nach Ausreißerprüfung erneut prüfen.
- Dezimale Eurobeträge, fehlende Online-Werte, veraltete Antworten und laufende Preisabgleiche klar behandeln; Abbrechen möglich.
- Ergebnisse mit Preisband, Quellen und Eingaben in der Historie speichern; bestehende Daten bleiben erhalten.

# 1.6.4

- Große Hersteller-Datenblätter, einschließlich Samsung, bis 24 MB entpackter Seitengröße einlesen.
- Andere Quellen bleiben auf 6 MB und Produktbilder auf 512 KB begrenzt; Weiterleitungen prüfen die Zielquelle erneut.

# 1.6.3

- Herstellerseiten vor Geizhals und Fachquellen; Samsung-Datenblöcke und GSMArena-Tabellen besser auslesen.
- Notebookcheck, DeviceSpecifications, DisplaySpecifications, PRAD und DPReview als passende Fachquellen; alle Fachquellen werden nach Geräteart gesucht.
- Direkte Katalogsuche mit Websuche derselben Quelle als Ersatz bei Sperren oder leeren Ergebnissen.
- Plus, Ultra, Pro und FE unterscheiden und geladenes Modell erneut prüfen.
- Empfehlungen und fremde JSON-LD-Produkte nicht übernehmen; widersprüchliche Werte auslassen und melden.
- Quelle je technischem Merkmal anzeigen; unbekannte Webtreffer nur zum Öffnen anbieten.
- Ältere Online-Zwischenspeicher werden erneut ausgelesen.

# 1.6.2

- Direkt aus dem Home-Assistant-App-Store über das GitHub-Repository installieren und aktualisieren.
- Dauerhafter App-Speicher bleibt bei Updates erhalten.
- Anleitung zur Übernahme bestehender lokaler Installationen.

# 1.6.1

- Erweiterte Websuche in Deutsch und Englisch mit DuckDuckGo und Bing, Herstellerseiten und Geizhals.
- Wikipedia aus Suche, Datenimport und Bildsuche entfernt.
