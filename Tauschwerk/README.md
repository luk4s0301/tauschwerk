# Tauschwerk 1.6

Lokale Windows-App zum Vergleichen von Geräten und Bewerten von Tauschangeboten. Zwei Datenmodi: eigene Offline-Datenbank oder Online-Recherche mit anschließendem Offline-Import.

## Tauschrechner und Online-Gebrauchtwertabgleich

1. Unter **Tauschrechner** auf beiden Seiten das Modell frei eingeben oder optional aus dem Katalog übernehmen. Variante/Speicher und Zustand auswählen. Die Anzahl gilt für gleiche Hauptgeräte.
2. **Lieferumfang, Mängel & Zusatzgeräte** nur bei Bedarf öffnen. Jedes Zusatzgerät hat eigenen Modellnamen, Zustand, Variante und Anzahl. Bis zu acht verschiedene Extras pro Seite, jeweils bis zu acht Stück. Ein optionaler **eigener Stückwert** ersetzt nur die Bewertung dieses Zusatzgeräts und wird deutlich als eigene Angabe gekennzeichnet. So kann ein online bewertetes Hauptgerät mit einem selbst eingeschätzten Extra kombiniert werden. Standardzubehör nur im Lieferumfang nennen und nicht doppelt als Extra bewerten.
3. **Beide Sets online abgleichen** oder eine Seite einzeln prüfen. Die App liest öffentliche Preise von Kleinanzeigen, reBuy und idealo; eBay-Suchlinks zeigen aktive und verkaufte Angebote im Browser. Ein laufender Abgleich lässt sich abbrechen.
4. Die angezeigten Setwerte, Preisbänder und Quellen prüfen. Jede Anzeige zeigt, ob sie verwendet wurde und weshalb sie gegebenenfalls ausgeschlossen wurde. Es müssen mindestens drei unterschiedliche, passende Angebote für dieselbe Preisbasis vorliegen. Private Angebotspreise werden bevorzugt; Händlerpreise bleiben getrennt. idealo-Ab- und Neupreise sind nur Kontext. Angebotspreise sind keine bestätigten Verkaufspreise.
5. Bei gesperrten Quellen über **Preisabgleich ergänzen: eigene Vergleichsangebote** Modell, Preis, Link, Zustand und Lieferumfang aus dem Browser erfassen. Ab drei passenden Einträgen kann die App einen eigenen Vergleichswert berechnen. Diese Angaben werden nicht unabhängig bestätigt und nicht mit automatisch gelesenen Preisen gemischt.
6. Alternativ **Eigene Einschätzung** wählen und den Gesamtwert des kompletten Sets eintragen. Auf-/Abschläge nur ergänzen, wenn nicht schon enthalten. Alle Beträge akzeptieren deutsche Dezimalwerte wie `450,50` oder `1.400,50`.
7. Zuzahlung auswählen: keine, von dir oder an dich. Das Ergebnis rechnet **Empfang − Abgabe − eigene Zuzahlung**; eine erhaltene Zuzahlung erhöht den Empfang. **Diese Zuzahlung übernehmen** setzt den rechnerischen Wertausgleich ein. **Seiten tauschen** dreht Sets und Zahlungsrichtung zusammen um.
8. **Tausch speichern** sichert die damaligen Werte, Quellen, Extras, Eingaben und Notizen in der Historie. Änderungen im Katalog oder später abweichende Marktpreise verändern diesen gespeicherten Stand nicht.

Fehlende Preise bleiben offen; unvollständige Sets werden nicht als vollständig bewertet. Mengen zählen jeden Bestandteil genau einmal. Änderungen an Modell, Variante, Zustand oder Lieferumfang machen die bisherige Online-Antwort ungültig. Defekte, Akku und Rechnung werden nur durch passende Vergleichsbeschreibungen berücksichtigt; die App erfindet keine prozentualen Abschläge.

## Produktbilder

Beim Laden eines Online-Datenblatts übernimmt die App ein passendes Produktbild aus strukturierten Produktdaten, Modellbildern oder den Bildmetadaten der Seite. Modellgenerationen und Zusätze wie Pro, Max, Ultra und Plus werden geprüft; die Farbe ist für die Suche nicht ausschlaggebend. Logos und fremde Modellbilder werden ausgelassen. Manche Quellen sperren Bilder oder liefern kein passendes Foto; dann bleibt das Kategorie-Symbol sichtbar.

Die Bilder erscheinen in der Vorschau, im Vergleich, im Katalog und in der Geräteauswahl. „Offline speichern & bearbeiten“ speichert das Bild zusammen mit dem Gerät. Bilddaten werden im Geräteeintrag gespeichert, sind dadurch auch im JSON-Backup enthalten und auf allen Geräten des Home-Assistant-Katalogs verfügbar. Der Browser lädt keine Bilder direkt von fremden Webseiten. Unterstützt sind PNG, JPEG, WebP und AVIF bis 2 MB. Größere Rasterbilder werden im Browser auf maximal 320 Pixel Kantenlänge verkleinert und als WebP gespeichert; SVG-Dateien werden nicht übernommen. Die Bildquelle bleibt im Editor und Vergleich verlinkt.

Bestehende Geräte: Im Online-Modus sucht die App fehlende Bilder angezeigter Geräte im Vergleich und Katalog automatisch (bis 24 Katalogkarten pro Ansicht). „Produktbilder ergänzen“ prüft zusätzlich den ganzen Katalog. Bleibt ein Bild auf der Datenquelle aus, wird beim Online-Import nach weiteren passenden Quellen gesucht. Einzelne Bilder lassen sich im Geräte-Editor mit „Produktbild suchen“ oder „Bild aktualisieren“ laden und mit „Bild entfernen“ entfernen. Änderungen im Editor werden erst durch „Speichern“ übernommen. Bei einem geänderten Modellnamen wird ein bisheriges Bild nicht ungeprüft weiterverwendet.

## Home Assistant: gemeinsame Server-Datenbank

Zusätzlich gibt es eine Home-Assistant-App für PC, Handy und Tablet. Sie nutzt die bestehende Home-Assistant-Anmeldung über Ingress und speichert den Katalog und deine Tausche gemeinsam auf deinem Server. „Vergleich merken“ speichert eine Auswahl einschließlich Gerätedaten für später; „Gemerkte Vergleiche“ öffnet sie auf anderen Geräten. Online-Datenblätter werden bis zu 24 Stunden zentral zwischengespeichert.

Die App lässt sich direkt über das GitHub-Repository installieren und aktualisieren. Unter **Einstellungen → Apps → App-Store → ⋮ → Repositories** `https://github.com/luk4s0301/tauschwerk` hinzufügen, Tauschwerk installieren und starten. Updates erscheinen nach „Nach Updates suchen“. Die [Home-Assistant-Anleitung](DOCS.md) erklärt Installation und Übernahme einer bisherigen lokalen App per JSON-Backup. Bei einer GitHub-Neuinstallation wird ausschließlich der allgemeine Startkatalog mitgeliefert.

Das lokale Installationspaket kann weiterhin mit `node build-home-assistant.mjs` erstellt werden. Es bleibt außerhalb von Git und übernimmt den lokalen PC-Katalog nur beim ersten Start einer neuen lokalen App.

Die Server-Version öffnet keinen separaten Port ins Heimnetz und benötigt weder Home-Assistant-Zugangsdaten noch Zugriff auf Smart-Home-Geräte. Alle berechtigten Home-Assistant-Nutzer teilen den Katalog. Änderungen anderer Geräte erscheinen nach etwa 15 Sekunden. Gleichzeitige Änderungen werden erkannt; unveränderte Gerätefelder bleiben beim erneuten Speichern erhalten. Die eigene Ansicht und der Offline-/Online-Modus sind pro Browser getrennt. Der Offline-Modus braucht auf dem Server weiterhin die Verbindung zu Home Assistant, führt aber keine Internetrecherche durch.

## Starten und aktualisieren

Mit einer lokalen `server-url.json` öffnet **Tauschwerk.exe** die gemeinsame Server-Version. Als Vorlage dient `server-url.example.json`; die Home-Assistant-Adresse muss auf den eigenen Server zeigen. Die Anmeldung erfolgt über Home Assistant im vorhandenen Browserprofil. Im Heimnetz können Handy und Tablet dieselbe Adresse öffnen. Die Server-Version benötigt eine Verbindung zu Home Assistant; die gespeicherte Datenbank funktioniert ohne Internetrecherche. Die lokale Konfiguration wird nicht in Git gespeichert.

**Tauschwerk Offline.cmd** öffnet die weiterhin vorhandene, vollständig lokale PC-Version ohne Serververbindung. Alternativ `Tauschwerk.exe --local`. Beide Datenbanken sind getrennt; die Server-Version wurde mit einer Kopie des PC-Datenstands gestartet. `server-url.json` enthält nur die Adresse, keine Zugangsdaten. Ohne diese Datei startet die EXE wie bisher lokal.

Die lokale Version öffnet ein eigenes Fenster des installierten Chrome oder Edge. Keine zusätzliche Installation, kein Konto und kein API-Schlüssel erforderlich. Die enthaltene Node-Laufzeit startet einen Dienst ausschließlich auf 127.0.0.1. Zwei Minuten nach dem letzten Kontakt endet er automatisch. Tauschwerk.exe immer im vollständigen App-Ordner lassen.

Nach einem Update alte Appfenster schließen und Tauschwerk.exe erneut starten. Der Launcher erkennt einen noch laufenden Dienst der alten Version und startet nur den zu diesem App-Ordner gehörenden Dienst neu. Die Daten bleiben erhalten.

## Offline-Modus

Der Umschalter oben rechts steht auf „Offline“. Der Katalog, Vergleich, Tauschrechner, gespeicherte Bewertungen und Backups funktionieren ohne Internet. Der Offline-Modus startet keine Online-Recherche.

- Bis zu vier Geräte vergleichen und Unterschiede filtern.
- 17 vorbereitete Modelle aus Handys, Konsolen, Grafikkarten, Prozessoren, Uhren, Laptops und Audio; Quellen am Gerät, Datenstand 02.10.2026.
- Beliebige eigene Geräte, Varianten, Kategorien und Merkmale hinzufügen, bearbeiten oder entfernen.
- Zum Anlegen reichen Gerätename und Kategorie. Alle sonstigen Felder sind optional. Unausgefüllte Vorlagenfelder werden ausgelassen. Ein Wert ohne Merkmalsnamen wird mit einer sichtbaren Fehlermeldung im Dialog beanstandet.
- Preisfelder im Geräteeditor akzeptieren deutsche Zahlen wie `1.500,50`, `1500,50` und `1500.50`.
- Preisbeispiele mit Link, Datum und Zustand sammeln, Median verwenden oder einen eigenen Wert einschätzen.
- Vergleich als CSV exportieren; Katalog und Bewertungen als JSON sichern und wiederherstellen.

## Online-Modus

Oben rechts „Online“ wählen. Es öffnet sich „Online-Recherche“. Der Moduswechsel allein sendet keine Suchanfrage.

1. Gerätenamen eingeben, z. B. `iPhone 17 Pro` oder `Steam Deck`.
2. Geräteart automatisch erkennen lassen oder auswählen und „Online suchen“ klicken. Unter „Suche verfeinern“ lassen sich Suchquelle, Hersteller und Sprache einstellen.
3. Bei einer passenden öffentlichen Geräteseite „Daten & Bild laden“ klicken. Die App liest die verfügbaren technischen Daten automatisch aus, zeigt Quelle, Abrufdatum und verfügbare Merkmale.
4. „Online vergleichen“ übernimmt das Gerät in den aktuellen Vergleich, ohne den Offline-Katalog zu ändern.
   Für jedes weitere Vergleichsgerät öffnet „Geräte online auswählen“ wieder die Online-Suche. Die Auswahl der bisherigen Geräte bleibt sichtbar und erhalten; du kannst bis zu vier Geräte nacheinander online auswählen.
5. „Offline speichern & bearbeiten“ öffnet die vorausgefüllten Daten zur Prüfung und zum Speichern. Die gespeicherte Fassung steht danach auch offline zur Verfügung.

Die Ergebniskarten zeigen die Quelle und lassen sich nach Quelle filtern. Die Vorschau zeigt zuerst zentrale Merkmale; „Alle technischen Merkmale ansehen“ öffnet das ganze Datenblatt. Die ersten drei Schritte werden direkt in der Oberfläche erklärt.

Alternativ „Du hast schon einen Produktlink?“ öffnen, einen öffentlichen Hersteller- oder Datenblatt-Link eintragen und „Daten einlesen“ klicken. Unterstützt werden Produktdaten in JSON-LD, zweispaltige HTML- und zugängliche div-Datentabellen, Definitionenlisten und bekannte Merkmalsabschnitte von Herstellerseiten. Beispielsweise lässt sich `https://support.apple.com/en-us/122209` einlesen.

### Gerätearten und Fachquellen

Die Geräteart kann automatisch aus dem Namen erkannt oder selbst gewählt werden. Unterstützt sind Handys/Tablets, Computer/Laptops, CPUs, GPUs, Konsolen, Uhren/Wearables, TV/Monitore, Audio, Kameras/Drohnen, PC-Zubehör/Speicher, Haushalt/Smart Home und andere Geräte. Freie Kategorien und Merkmale bleiben möglich.

| Quelle | Suche und Nutzung |
| --- | --- |
| Herstellerseiten | Offizielle Domains von 49 Herstellern; allgemeine Websuche und zusätzlich öffentliche Apple-/PlayStation-Produktverzeichnisse |
| NanoReview | Direkte Smartphone-Suche und Import technischer Tabellen; Display-/Kamera-Abschnitte bleiben getrennt |
| CPU-Monkey | Direkte Prozessor-Suche und Datenblätter |
| GPU-Monkey | Direkte Suche nach Grafikkarten und konkreten Hersteller-Varianten; technische Definitionenlisten |
| LaptopMedia | Direkte Laptop-Suche und verlinkte Konfigurationen |
| GSMArena | Öffentliches Handy-Suchformular; Verfügbarkeit hängt von dessen Abruflimits ab |
| TechPowerUp | Gezielte Websuche auf der Fachquelle; öffentliche Datenblätter per Link |
| RTINGS | Produktverzeichnis für u. a. TV, Monitore, Audio, Kameras, PC-Zubehör und Haushaltsgeräte; Testberichte auf auslesbare technische Angaben prüfen |
| Geizhals | Technische Produktdaten und Modellvarianten |
| Websuche | Weitere öffentliche Produktseiten, Datenblätter und Tests |

„Alle passenden Quellen“ fragt passende direkte Kataloge anhand der Geräteart ab und ergänzt weltweite Websuche in Deutsch und Englisch, gezielte Herstellerabfragen und Geizhals. Jede Fachquelle lässt sich unabhängig davon gezielt wählen. Die Websuche führt DuckDuckGo- und Bing-Treffer zusammen, verwendet bei fehlenden Treffern Google als Ersatz und ist unabhängig vom gespeicherten Katalog. Im Online-Modus fragt auch das Katalog-Suchfeld nach 600 ms Eingabepause jeden Begriff mit mindestens zwei Zeichen im Web ab. Schreibweisen wie „Switch 1“, „RTX4060“ und „RTX 40 60“ werden vereinheitlicht, ohne die Generationen zu vermischen. Wikipedia, Wikimedia und Wikidata sind für Suche, Direktimport, Weiterleitungen und Bilder ausgeschlossen. Technische Daten stammen aus der ausgewählten Seite; die App mischt verschiedene Quellen oder Varianten nicht automatisch zu einem erfundenen Gerät. Die Geräteart dient der Quellenwahl, nicht als Garantie, dass jedes existierende Produkt im Internet gefunden wird.

### Grenzen der Online-Daten

Die Websuche nutzt öffentliche Treffer von DuckDuckGo und Bing mit Google als Ersatz. Unpassende Modelltreffer werden aussortiert. Fällt eine Quelle aus, bleiben die übrigen Ergebnisse sichtbar; Hinweise lassen sich aufklappen. Suchanbieter können automatische Abrufe blockieren oder unpassende Treffer liefern. Dann helfen die Browser-Suchlinks und der direkte Link-Import. Manche Seiten benötigen JavaScript, haben Abruflimits oder liefern keine strukturierten technischen Daten; dann zeigt die App den Grund und verändert den Katalog nicht. Auch Testberichte und weitere öffentliche HTML-Seiten können direkt geladen werden. Liefert eine Suchquelle kein lesbares Datenblatt, prüft die App technische Links derselben Herstellerseite und alternative Quellen für das gesuchte Modell. Die tatsächlich geladene Quelle wird angezeigt. PDF-Dateien werden weiterhin nicht importiert. LaptopMedia-Konfigurationen können unterschiedliche Generationen oder Varianten betreffen; vor dem Speichern prüfen. Allgemeine Produktseiten liefern unter Umständen weniger Angaben als echte Datenblätter. Herstellerverzeichnisse führen überwiegend aktuelle Geräte; ältere Modelle können über andere Quellen gefunden werden.

Produktseiten können ganze Modellfamilien und mehrere Varianten gemeinsam beschreiben. Der ausgewählte Seitentitel und die Quelle bleiben sichtbar. Kontrolliere, welche Daten zum konkreten Gerät gehören. Die App erfindet fehlende Werte nicht und wählt aus mehrspaltigen Vergleichstabellen keine beliebige Variante aus.

Ein Abrufdatum bezeichnet den Zeitpunkt des Imports, nicht das Datum einer unabhängigen fachlichen Prüfung. Händler-Neupreise und historische Einführungspreise werden nicht als aktueller Gebrauchtwert behandelt. Online-Setwerte werden separat im Tauschrechner ermittelt; eigene Preisbeispiele bleiben zusätzlich verfügbar.

## Tauschrechnung

Online-Setwert = geprüfter Gerätevergleichswert + separat bewertete Extras mit ihrer Anzahl. Eigene Einschätzung: Gebrauchtwert + zusätzliches Zubehör − noch nicht eingepreiste Mängel.

Wertdifferenz aus deiner Sicht = Empfangswert − Abgabewert − eigene Zuzahlung. Eine erhaltene Zuzahlung wird negativ eingesetzt. Beispiel: Abgabe 600 €, Empfang 850 €, eigene Zuzahlung 200 € → +50 € aus deiner Sicht. 250 € Zuzahlung würde die eingegebenen Werte exakt ausgleichen.

„Rechnerisch ausgeglichen“ gilt innerhalb von 5 % des höheren Gerätewerts, mindestens 20 €. Das ist eine offengelegte Rechenregel, keine empirische Marktspanne. Die Online-Bewertung verwendet passende Zustandsangebote und zeigt deren beobachtete Spanne separat. Bei eigener Einschätzung setzt du die Preiswirkung selbst ein. Bereits berücksichtigte Defekte nicht doppelt abziehen.

## Lokale Daten

- `data/tauschwerk.json`: Katalog, Preisbeispiele, Bewertungen und Einstellungen.
- `data/tauschwerk.json.bak`: vorherige gespeicherte Fassung.
- `data/tauschwerk-vor-update-1.1-*.json`: zusätzliche Sicherung des vorhandenen Datenbestands vor diesem Update.
- `catalog.json`: Startkatalog, nur bei erstmaligem Start ohne eigene Datenbank verwendet.
- `runtime/node.exe` und `runtime/NODE-LICENSE.txt`: enthaltene Laufzeit und Lizenzinformationen.

Online-Vorschauen werden erst durch Speichern im Editor Teil der Offline-Datenbank. Exportierte JSON-Backups enthalten gespeicherte Webquellen und Attribution. Nicht gespeicherte Online-Vorschauen werden nach einem App-Neustart nicht wiederhergestellt.

Bei einer beschädigten Datenbank bricht der Start ab und erhält die Datei. App schließen, beschädigte Datei separat sichern und ein intaktes Backup als `data/tauschwerk.json` wiederherstellen.

## Entwicklung und Prüfung

Das Repository enthält den Quellcode. Persönliche Datenbanken, Backups, Server-Adressen, Bildschirmfotos, fertige EXE und Node-Laufzeit sind ausgeschlossen. Nach dem Klonen im Ordner `Tauschwerk` mit Node.js 24 `npm start` ausführen und die ausgegebene lokale Adresse öffnen. `npm test` führt die automatisierten Tests aus.

Unter Windows erstellt `build-windows.ps1` den Starter mit dem vorhandenen .NET-Framework-Compiler. Für den EXE-Start anschließend die Windows-Version von Node.js 24 von der offiziellen Node.js-Seite herunterladen und `node.exe` samt Lizenz in `runtime` ablegen. Für Home Assistant `node build-home-assistant.mjs` ausführen; das erzeugte Paket enthält den lokalen Datenstand, falls vorhanden, und sollte deshalb nicht unverändert veröffentlicht werden.

Keine npm-Abhängigkeiten. Start: `node server.mjs`; die ausgegebene lokale URL öffnet die authentifizierte Oberfläche. Tests: `node --test tests/*.test.mjs`. Browser-Tests benötigen Playwright und `TAUSCHWERK_PLAYWRIGHT` mit dem Pfad zu dessen `index.mjs`. `tests/browser-smoke.mjs` prüft die Basis; `tests/browser-online.mjs` prüft die neuen Abläufe mit kontrollierten Antworten aus echten Online-Ergebnissen. `tests/online-live.mjs` prüft die tatsächlichen externen Quellen und benötigt Internet.

Der Dienst prüft Host und Origin und authentifiziert die Oberfläche mit einem zufälligen Sitzungstoken. Online-Quellen sind auf öffentliche HTTPS-Adressen beschränkt; interne Adressen und Weiterleitungen dorthin werden abgewiesen. DNS-Adressen werden für den jeweiligen Abruf festgelegt. Seitenskripte werden nicht ausgeführt. Importtexte werden vor der Darstellung escaped und CSV-Formeln entschärft.

## Quellenqualität und Modellvarianten

Die Suche bevorzugt offizielle Herstellerseiten, danach Geizhals und passende Fachquellen. Zusätzlich sind Notebookcheck, DeviceSpecifications, DisplaySpecifications, PRAD und DPReview auswählbar. Fachquellen werden passend zur Geräteart automatisch berücksichtigt. Wenn die direkte Katalogsuche gesperrt ist oder leer bleibt, sucht die App über Suchanbieter auf den Domains derselben Quelle. PRAD, DPReview und unbekannte Webtreffer lassen sich direkt auf auslesbare technische Angaben prüfen. Ihre Daten sind mit der tatsächlichen Quelle gekennzeichnet und werden nicht als Herstellerangaben ausgegeben.

Samsung-Datenblöcke und GSMArena-Tabellen werden getrennt nach technischen Merkmalen eingelesen. Ultra, Plus, Pro und FE sind eigenständige Varianten. Nach dem Abruf wird das Modell nochmals gegen den Suchbegriff geprüft. Empfohlene Fremdprodukte in strukturierten Daten und Empfehlungsbereichen werden ausgelassen. Widersprüchliche Angaben für dasselbe Merkmal bleiben offen und erscheinen als Warnung. Jede importierte Angabe enthält ihren Quelllink; die Vorschau zeigt ihn je Zeile. Fehlende Daten werden nicht ergänzt oder erfunden.

Quellennamen kennzeichnen Herkunft, keine unabhängige Verifikation. Automatische Imports bleiben prüfpflichtig. Erreichbarkeit und Seitenaufbau können sich ändern; bei gesperrten oder ausschließlich per JavaScript geladenen Daten bleibt der Originalseiten-Link verfügbar.
