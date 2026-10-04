# Tauschwerk

Geräte vergleichen und Tauschangebote bewerten: als lokale Windows-App oder mit gemeinsamer Datenbank auf einem Home-Assistant-Server.

- Eigener Gerätekatalog für Handys, Konsolen, PC-Hardware, Uhren und weitere Kategorien.
- Bis zu vier Geräte vergleichen; eigene Geräte und technische Merkmale bearbeiten.
- Freie Online-Gerätesuche auch direkt im Katalog, mit Herstellerseiten, Fachquellen und Websuche.
- NanoReview, CPU-Monkey, GPU-Monkey und LaptopMedia; weitere Quellen gezielt auswählbar.
- Übersichtliche Suche mit Quellenkarten und Vorschau vor dem Speichern.
- Fehlende Produktbilder automatisch aus Online-Quellen ergänzen und kompakt speichern, auch für Offline-Katalog und JSON-Backup.
- Tauschrechner mit freien Modellen, Mengen und Zusatzgeräten; beide Sets online abgleichen, eigene Vergleichsangebote ergänzen, Preisband prüfen und faire Zuzahlung übernehmen.
- Home-Assistant-Anmeldung, gemeinsamer Katalog und gemerkte Vergleiche.
- JSON-Backups und CSV-Export.

Der Quellcode liegt in [`Tauschwerk`](Tauschwerk). Start mit Node.js 24:

```powershell
cd Tauschwerk
npm start
```

Die ausgegebene lokale URL im Browser öffnen. Prüfungen: `npm test`.

Die [Anleitung](Tauschwerk/README.md) beschreibt Windows-Starter, Home-Assistant-Installation und Grenzen der Online-Recherche. Persönliche Daten, Zugangsdaten, Backups und die lokale Server-Konfiguration sind vom Repository ausgeschlossen.

## In Home Assistant installieren

[Repository in Home Assistant hinzufügen](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fluk4s0301%2Ftauschwerk)

Oder unter **Einstellungen → Apps → App-Store → ⋮ → Repositories** diese URL hinzufügen:

```text
https://github.com/luk4s0301/tauschwerk
```

Danach **Tauschwerk → Installieren → Starten → In der Seitenleiste anzeigen**. Neue Versionen werden über **Nach Updates suchen** und **Aktualisieren** eingespielt. Benötigt Home Assistant OS oder Supervised auf amd64/aarch64. Der erste Build läuft auf deinem Server und kann einige Minuten dauern.

Bereits lokal installiert? Vor dem Wechsel das JSON-Backup aus der alten App exportieren und in der GitHub-App importieren: Beide Installationen haben getrennte Speicher. [Installation, Updates und Datenübernahme](Tauschwerk/DOCS.md).
