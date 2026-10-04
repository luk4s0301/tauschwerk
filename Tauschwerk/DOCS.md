# Swivo für Home Assistant

Geräte vergleichen, Tausche bewerten und denselben Katalog auf PC, Handy und Tablet nutzen. Unterstützt Home Assistant OS und Home Assistant Supervised auf amd64 und aarch64. Home Assistant Container und Core bieten keinen App-Store.

## Installation aus GitHub

1. In Home Assistant **Einstellungen → Apps → App-Store** öffnen (bei älteren Versionen **Add-ons → Add-on-Store**).
2. Im Menü oben rechts **Repositories** wählen und `https://github.com/luk4s0301/tauschwerk` hinzufügen.
3. Den Store bei Bedarf neu laden, **Swivo** auswählen und **Installieren** drücken. Home Assistant baut das Image auf deinem Server; der erste Build kann einige Minuten dauern.
4. Die App starten und **In der Seitenleiste anzeigen** einschalten. Unter **Weboberfläche öffnen** erreichst du Swivo.

[Repository in Home Assistant hinzufügen](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fluk4s0301%2Ftauschwerk)

## Neuer Name: Swivo

Ab Version 2.1.0 heißt Tauschwerk **Swivo**. Die bestehende App einfach aktualisieren. Repository-Adresse, App-ID und Datenspeicher bleiben gleich; eine Neuinstallation ist nicht erforderlich. Die technischen Ordnernamen und der vorhandene Windows-Starter `Tauschwerk.exe` bleiben kompatibel.

## Updates

Im App-Store-Menü **Nach Updates suchen** wählen. Sobald eine höhere Version im Repository veröffentlicht ist, erscheint bei Swivo **Aktualisieren**. Vor dem Update ein Backup erstellen, aktualisieren und anschließend die Oberfläche neu laden. Es müssen keine Dateien über Samba kopiert werden.

Die Datenbank liegt unter `/data/tauschwerk.json` im dauerhaften App-Speicher. Updates und Neustarts erhalten diesen Speicher. Die GitHub-Installation enthält nur den allgemeinen Startkatalog, keine persönlichen Kataloge oder Zugangsdaten. Bestehende Daten werden beim Start zuerst geladen. Online-Datenblätter bleiben bis zu 24 Stunden im gemeinsamen Zwischenspeicher. Browseransicht und aktueller Vergleich sind pro Browser getrennt.

## Wechsel von einer lokalen Installation

Eine unter „Lokale Apps“ installierte Swivo-App und die GitHub-App haben unterschiedliche Speicher. Exportiere in der bisherigen App unter **Daten & Hilfe → Backup exportieren** dein JSON-Backup. Installiere dann die GitHub-App und importiere dort das Backup. Prüfe Geräte, Tausche und gemerkte Vergleiche, bevor du die alte App entfernst. Die alte App erst nach erfolgreicher Übernahme deinstallieren; Deinstallation kann deren App-Speicher löschen.

## Zugang und Sicherungen

Die Home-Assistant-Anmeldung schützt die Oberfläche über Ingress. Die App öffnet keinen eigenen Port im Heimnetz und benötigt keine Home-Assistant-API oder Zugangsdaten. Alle berechtigten Home-Assistant-Nutzer teilen denselben Katalog. Änderungen anderer Geräte erscheinen nach etwa 15 Sekunden.

Home-Assistant-Backups der App enthalten `/data`. Zusätzlich kannst du in Swivo JSON-Backups exportieren. „Offline“ nutzt gespeicherte Daten ohne Internetrecherche; die Verbindung zu deinem HA-Server bleibt notwendig. Online-Suche und Preisrecherche benötigen Internetzugriff des Servers.

## Tauschrechner

Beide Modelle frei eingeben, Variante und Zustand wählen und „Beide Sets online abgleichen“ drücken. Zusatzgeräte haben eigene Varianten und Zustände. Händlerpreise, private Angebote und selbst erfasste Vergleichsangebote werden getrennt ausgewertet. Wenn Preisquellen Abrufe sperren, bieten die Quellenlinks die Suche im Browser; alternativ eigene Vergleichsangebote oder einen eigenen Setwert erfassen. Keine Zuzahlung, eigene Zuzahlung und erhaltene Zuzahlung sind getrennte Optionen. Der Rechner zeigt einen rechnerischen Wertausgleich und speichert die Quellen mit der Bewertung. Angebotspreise bleiben eine Orientierung, keine bestätigten Verkaufspreise.

## Geräte online finden und vergleichen

Im Online-Modus sucht das Katalog-Suchfeld nach kurzer Eingabepause zusätzlich im Internet. Webtreffer erscheinen unter den gespeicherten Geräten. Alternativ unter Online-Recherche einen beliebigen Modellnamen eingeben und „Online suchen“ wählen. „Daten & Bild laden“ liest die Quelle direkt ein; bei einer gesperrten oder unlesbaren Suchquelle werden passende technische Herstellerlinks und andere Quellen geprüft. Die Vorschau zeigt die tatsächlich verwendete Datenquelle. „Switch 1“ bezeichnet die normale Nintendo Switch; Switch 2, OLED und Lite bleiben getrennt. Auch RTX-Schreibweisen ohne Leerzeichen werden erkannt.

Fehlende Bilder angezeigter Geräte werden automatisch gesucht, beim Speichern verkleinert und im dauerhaften Gerätespeicher abgelegt. Bild- und Datenquelle können verschieden sein und sind entsprechend gekennzeichnet. Öffentliche Webseiten können Abrufe sperren oder Daten ausschließlich per JavaScript bereitstellen; wenn keine auslesbare passende Quelle gefunden wird, meldet Swivo dies. Es werden keine Gerätewerte oder technischen Merkmale erfunden.
