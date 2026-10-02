# Tauschwerk 1.2

Lokale Windows-App zum Vergleichen von Geräten und Bewerten von Tauschangeboten. Zwei Datenmodi: eigene Offline-Datenbank oder Online-Recherche mit anschließendem Offline-Import.

## Home Assistant: gemeinsame Server-Datenbank

Zusätzlich gibt es eine Home-Assistant-App für PC, Handy und Tablet. Sie nutzt die bestehende Home-Assistant-Anmeldung über Ingress und speichert den Katalog und deine Tausche gemeinsam auf deinem Server. „Vergleich merken“ speichert eine Auswahl einschließlich Gerätedaten für später; „Gemerkte Vergleiche“ öffnet sie auf anderen Geräten. Online-Datenblätter werden bis zu 24 Stunden zentral zwischengespeichert.

Das Installationspaket liegt in `home-assistant/tauschwerk`. Es enthält beim Erstellen eine Kopie des aktuellen PC-Katalogs samt Tauschen; der Server übernimmt diese nur beim allerersten Start. Der lokale PC-Datenbestand bleibt erhalten. Zum erneuten Erstellen: `runtime/node.exe build-home-assistant.mjs`. Den Ordner `tauschwerk` in die bereits vorhandene Samba-Freigabe `local_apps` des Home-Assistant-Servers kopieren. Im App-Store „Nach Updates suchen“, Tauschwerk unter lokalen Apps installieren und starten; anschließend in der Seitenleiste anzeigen. Die ausführliche Anleitung liegt im Paket in `DOCS.md`.

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
2. Deutsch, Englisch oder beide Sprachen wählen und „Online suchen“ klicken.
3. Bei einer passenden öffentlichen Wikipedia-Seite „Daten laden“ klicken. Die App liest deren Infobox automatisch aus, zeigt Quelle, Abrufdatum und verfügbare Merkmale.
4. „Online vergleichen“ übernimmt das Gerät in den aktuellen Vergleich, ohne den Offline-Katalog zu ändern.
   Für jedes weitere Vergleichsgerät öffnet „Geräte online auswählen“ wieder die Online-Suche. Die Auswahl der bisherigen Geräte bleibt sichtbar und erhalten; du kannst bis zu vier Geräte nacheinander online auswählen.
5. „Offline speichern & bearbeiten“ öffnet die vorausgefüllten Daten zur Prüfung und zum Speichern. Die gespeicherte Fassung steht danach auch offline zur Verfügung.

Alternativ einen öffentlichen Hersteller- oder Datenblatt-Link in das zweite Feld eintragen und „Daten einlesen“ klicken. Unterstützt werden Produktdaten in JSON-LD, zweispaltige Datentabellen und bekannte Merkmalsabschnitte von Herstellerseiten. Beispielsweise lässt sich `https://support.apple.com/en-us/122209` einlesen.

### Grenzen der Online-Daten

Die Recherche sucht aktuell in deutscher und englischer Wikipedia. Der Link-Import kann zusätzliche öffentlich zugängliche Hersteller- und Produktseiten lesen. Manche Seiten blockieren automatische Zugriffe, benötigen JavaScript oder liefern keine strukturierten technischen Daten; dann zeigt die App den Grund und verändert den lokalen Katalog nicht. PDF-Datenblätter werden in diesem Modus nicht verarbeitet.

Wikipedia-Seiten können ganze Modellfamilien und mehrere Varianten gemeinsam beschreiben. Der ausgewählte Seitentitel und die Quelle bleiben sichtbar. Kontrolliere, welche Daten zum konkreten Gerät gehören. Die App erfindet fehlende Werte nicht und wählt aus mehrspaltigen Vergleichstabellen keine beliebige Variante aus.

Ein Abrufdatum bezeichnet den Zeitpunkt des Imports, nicht das Datum einer unabhängigen fachlichen Prüfung. Wikipedia-Daten tragen einen Hinweis auf Wikipedia-Mitwirkende und CC BY-SA; die verlinkte Seite enthält Versionsgeschichte und Lizenzdetails. Händler-Neupreise und historische Einführungspreise werden nicht als aktueller Gebrauchtwert behandelt. Gebrauchtpreise pflegst du weiter selbst über deine Preisbeispiele.

## Tauschrechnung

Gerätewert = Gebrauchtwert im beschriebenen Zustand + zusätzliches Zubehör − noch nicht eingepreiste Mängel.

Wertdifferenz aus deiner Sicht = Empfangswert − Abgabewert − eigene Zuzahlung. Eine erhaltene Zuzahlung wird negativ eingesetzt. Beispiel: Abgabe 600 €, Empfang 850 €, eigene Zuzahlung 200 € → +50 € aus deiner Sicht. 250 € Zuzahlung würde die eingegebenen Werte exakt ausgleichen.

„Rechnerisch ausgeglichen“ gilt innerhalb von 5 % des höheren Gerätewerts, mindestens 20 €. Das ist eine offengelegte Rechenregel, keine empirische Marktspanne. Zustand wird dokumentiert; seine Preiswirkung setzt du selbst ein. Bereits berücksichtigte Defekte nicht doppelt abziehen.

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
