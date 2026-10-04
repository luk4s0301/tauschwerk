import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {median,evaluateTrade,validateStore} from '../core.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url),'utf8'));
test('Startkatalog hat gültige, eindeutige Geräte',()=>{assert.equal(validateStore({version:1,devices:catalog,trades:[]}).devices.length,17);});
test('Median ist robust gegen Ausreißer und ignoriert ungültige Preise',()=>{assert.equal(median([600,610,4000,590,NaN,-10]),605);assert.equal(median([100,500,600]),500);assert.equal(median([]),null);});
test('Eigene Zuzahlung wird abgezogen',()=>{const r=evaluateTrade(600,850,200);assert.equal(r.difference,50);assert.equal(r.fairCash,250);assert.equal(r.verdict,'positive');});
test('Erhaltene Zuzahlung wird zum Empfang gerechnet',()=>{const r=evaluateTrade(900,600,-300);assert.equal(r.difference,0);assert.equal(r.fairCash,-300);assert.equal(r.verdict,'balanced');});
test('Zu viel bezahlen ist nachteilig und Toleranz ist explizit',()=>{const r=evaluateTrade(600,850,400);assert.equal(r.difference,-150);assert.equal(r.verdict,'negative');assert.equal(r.tolerance,42.5);assert.equal(evaluateTrade(50,50,0).tolerance,20);});
test('Fehlerhafte Werte, URLs, Duplikate werden abgewiesen',()=>{assert.throws(()=>evaluateTrade(-100,50));assert.throws(()=>evaluateTrade(100,NaN));assert.throws(()=>validateStore({version:2,devices:[],trades:[]}));const s={version:1,devices:structuredClone(catalog),trades:[]};s.devices[0].source='javascript:alert(1)';assert.throws(()=>validateStore(s));s.devices[0].source='';s.devices.push(s.devices[0]);assert.throws(()=>validateStore(s));});
test('Importierte Tausche werden neu berechnet statt Ergebnis ungeprüft zu übernehmen',()=>{const s={version:1,devices:[],trades:[{id:'t',date:'2026-10-02',giveName:'A',receiveName:'B',notes:'',result:{give:500,receive:600,cash:100,difference:99999,verdict:'positive'}}]};validateStore(s);assert.equal(s.trades[0].result.difference,0);assert.equal(s.trades[0].result.verdict,'balanced');});

test('Zuzahlung und Wertdifferenz bleiben auf Cent genau',()=>{
 const result=evaluateTrade(1200.10,1400.30,200.20);assert.equal(result.fairCash,200.20);assert.equal(result.difference,0);
});
