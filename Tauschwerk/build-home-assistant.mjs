import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStore} from './core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const target=path.join(root,'home-assistant','tauschwerk');
fs.mkdirSync(path.join(target,'public'),{recursive:true});
for(const file of ['server.mjs','server-policy.mjs','core.mjs','online.mjs','online-parser.mjs','remote.mjs','device-images.mjs','market-value.mjs','online-search.mjs','online-sources.mjs','online-catalogs.mjs','catalog.json'])fs.copyFileSync(path.join(root,file),path.join(target,file));
for(const file of ['index.html','app.js','styles.css','icons.js','favicon.svg'])fs.copyFileSync(path.join(root,'public',file),path.join(target,'public',file));
const source=path.join(root,'data','tauschwerk.json');
const seed=validateStore(fs.existsSync(source)?JSON.parse(fs.readFileSync(source,'utf8')):{version:1,devices:JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8')),trades:[]});
delete seed.ui;fs.writeFileSync(path.join(target,'initial-store.json'),JSON.stringify(seed,null,2));
fs.writeFileSync(path.join(target,'config.json'),JSON.stringify({name:'Tauschwerk',version:'1.6.1',slug:'tauschwerk',description:'Geräte vergleichen, Tausche bewerten und Vergleiche auf allen Geräten merken.',arch:['amd64','aarch64'],startup:'application',boot:'auto',init:false,ingress:true,ingress_port:8099,panel_icon:'mdi:swap-horizontal',panel_title:'Tauschwerk',options:{},schema:{}},null,2));
fs.writeFileSync(path.join(target,'Dockerfile'),`FROM node:24-alpine
ARG BUILD_VERSION
ARG BUILD_ARCH
LABEL io.hass.version="$BUILD_VERSION" io.hass.type="app" io.hass.arch="$BUILD_ARCH"
WORKDIR /app
COPY . .
ENV TAUSCHWERK_HOME_ASSISTANT=1 TAUSCHWERK_DATA=/data
EXPOSE 8099
CMD ["node", "server.mjs"]
`);
const docs=`# Tauschwerk für Home Assistant

Gemeinsamer Gerätekatalog, Preise, Tauschbewertungen und gemerkte Vergleiche auf PC, Handy und Tablet.

Die Oberfläche öffnest du in der Home-Assistant-Seitenleiste. Die vorhandene Home-Assistant-Anmeldung schützt den Zugang über Ingress. Die App veröffentlicht keinen eigenen Netzwerkport und benötigt keinen Zugriff auf Hausgeräte, Home-Assistant-API oder Zugangsdaten.

## Daten und Zwischenspeicher

Die Datenbank liegt im dauerhaften App-Speicher unter /data/tauschwerk.json. Beim allerersten Start wird der mitgelieferte PC-Datenstand übernommen. Spätere Starts und Updates lassen bestehende Daten erhalten. Änderungen anderer Geräte erscheinen nach ungefähr 15 Sekunden. Gleichzeitige Änderungen werden erkannt; die App lädt den neueren Stand und fordert zum erneuten Speichern auf.

Mit „Vergleich merken“ speicherst du bis zu vier Geräte einschließlich ihrer damaligen technischen Daten. Unter „Gemerkte Vergleiche“ kannst du sie auf jedem Gerät öffnen. Ein Online-Datenblatt bleibt bis zu 24 Stunden im gemeinsamen Zwischenspeicher (höchstens 100 Quellen). Browseransicht, aktuelle Auswahl und Datenmodus bleiben pro Browser getrennt.

„Offline“ bedeutet hier gespeicherter Katalog ohne Internetrecherche. Die Verbindung zum Home-Assistant-Server ist weiterhin notwendig. Für den Online-Modus braucht der Server Internetzugriff. Preise sind eigene Einschätzungen.

Regelmäßig in „Daten & Hilfe“ ein JSON-Backup exportieren. Home-Assistant-Backups der App enthalten auch /data. Alle bestehenden Home-Assistant-Nutzer, die die App öffnen können, verwenden denselben Katalog.

## Installation

Den Ordner tauschwerk in die Samba-Freigabe local_apps kopieren (bei älteren Installationen addons). Im App-Store das Menü öffnen und „Nach Updates suchen“ auswählen. Unter lokalen Apps Tauschwerk installieren, starten und „In der Seitenleiste anzeigen“ einschalten.

Docker lädt das offizielle Node.js-Image node:24-alpine. Unterstützte Server: amd64 und aarch64.
`;
fs.writeFileSync(path.join(target,'DOCS.md'),docs);fs.writeFileSync(path.join(target,'README.md'),docs);
fs.writeFileSync(path.join(target,'CHANGELOG.md'),'# 1.6.1\n\nErweiterte weltweite Suche mit beiden Suchanbietern, deutschen und englischen Abfragen, Herstellerseiten und Geizhals. Ausgeschlossene Quellen werden auch bei Direktlinks, Weiterleitungen und Bildern blockiert.\n\nPassende Produktbilder aus Online-Quellen. Gespeicherte Bilder sind offline, im Backup und auf anderen Geräten verfügbar. Bildsuche für bestehende Katalogeinträge. Online-Suche für alle Gerätearten: passende Fachquellen, NanoReview, CPU-Monkey, GPU-Monkey, LaptopMedia, RTINGS-Verzeichnis sowie Hersteller-/Websuche und Geizhals. Quellenfilter mit 49 Herstellern. Übersichtlichere Suche, Ergebniskarten, Quellenchips und kompakte Datenvorschau. Bessere technische Importe für Handys, Grafikkarten, Konsolen und Uhren.\n');
console.log('Installationspaket erstellt: '+target+' ('+seed.devices.length+' Geräte, '+seed.trades.length+' Tausche)');
