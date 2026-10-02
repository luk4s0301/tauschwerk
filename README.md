# Tauschwerk

Geräte vergleichen und Tauschangebote bewerten: als lokale Windows-App oder mit gemeinsamer Datenbank auf einem Home-Assistant-Server.

- Eigener Gerätekatalog für Handys, Konsolen, PC-Hardware, Uhren und weitere Kategorien.
- Bis zu vier Geräte vergleichen; eigene Geräte und technische Merkmale bearbeiten.
- Online-Recherche mit Geräteart, passenden Fachquellen, Herstellerseiten und Websuche.
- NanoReview, CPU-Monkey, GPU-Monkey und LaptopMedia; weitere Quellen gezielt auswählbar.
- Übersichtliche Suche mit Quellenkarten und Vorschau vor dem Speichern.
- Tauschrechner mit eigenen Gebrauchtwerten, Zubehör, Mängeln und Zuzahlung.
- Home-Assistant-Anmeldung, gemeinsamer Katalog und gemerkte Vergleiche.
- JSON-Backups und CSV-Export.

Der Quellcode liegt in [`Tauschwerk`](Tauschwerk). Start mit Node.js 24:

```powershell
cd Tauschwerk
npm start
```

Die ausgegebene lokale URL im Browser öffnen. Prüfungen: `npm test`.

Die [Anleitung](Tauschwerk/README.md) beschreibt Windows-Starter, Home-Assistant-Installation und Grenzen der Online-Recherche. Persönliche Daten, Zugangsdaten, Backups und die lokale Server-Konfiguration sind vom Repository ausgeschlossen.
