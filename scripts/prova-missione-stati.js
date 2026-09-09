#!/usr/bin/env node
'use strict';
// State integration with real astronomical coordinates, no browser required.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Astronomy = require('astronomy-engine');
const root=path.resolve(__dirname,'..');
let now=Date.UTC(2026,8,7,21), offset=0;
const feedback=[];
class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
const saved=new Map(), elements=new Map();
function element(){ const classes=new Set(); return {innerHTML:'',textContent:'',value:'',classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle:(n,v)=>v?classes.add(n):classes.delete(n)},querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}}; }
const doc={readyState:'loading',body:element(),addEventListener(){},getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
const obs=new Astronomy.Observer(45.81,9.08,0);
const ctx=vm.createContext({console,Date:Clock,Astronomy,window:{},document:doc,
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
  osservatoreCorrente:()=>obs, sky:{observer:obs,sensori:false,assoluto:false,seguiTelefono:false,oggetti:[]},
  skyAdesso:()=>new Clock(now+offset),skyAssettoDisponibile:()=>true,skyEUnTelefonoConSensoriProtetti:()=>false,
  skyAvviso:(chiave,testo)=>feedback.push({chiave,testo}),
  skyAvviaSensori(){},skyAlternaSeguiTelefono(){ctx.sky.seguiTelefono=!ctx.sky.seguiTelefono;},
  skyVettore:(az,alt)=>[Math.cos(alt*Math.PI/180)*Math.sin(az*Math.PI/180),Math.cos(alt*Math.PI/180)*Math.cos(az*Math.PI/180),Math.sin(alt*Math.PI/180)],
  skyUsaSensori:()=>ctx.sky.sensori&&ctx.sky.seguiTelefono,
  orizzonteAltezza:()=>0, oraBreve:()=>'', setTimeout,clearTimeout,
});
const run=s=>vm.runInContext(s,ctx);
for(const lang of ['it','en'])run(fs.readFileSync(path.join(root,'lingue/'+lang+'.js'),'utf8'));
const missing=[];
ctx.astroI18n={lingua:'it',nomePunto:()=>ctx.astroI18n.lingua==='it'?'sud':'south',
 esiste:k=>k in ctx.window.ASTRO_DIZIONARI[ctx.astroI18n.lingua].messaggi,
 t(k,vars={}){const v=ctx.window.ASTRO_DIZIONARI[this.lingua].messaggi[k];if(v==null){missing.push(k);return k;}return String(v).replace(/\{(\w+)\}/g,(_,n)=>vars[n]??'{'+n+'}');}};
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
for(const name of ['altAzCorpo','altAzCoordinate','skyNomiVisibili'])run(app.match(new RegExp('^function '+name+'\\([\\s\\S]*?^\\}', 'm'))[0]);
run(app.match(/^const SKY_STELLE = \[[\s\S]*?^\];/m)[0]);
run(fs.readFileSync(path.join(root,'missione-cielo.js'),'utf8'));
assert.deepEqual(Array.from(run('MISS_ESPERIENZE')),['sfida','bambini']);
run(`miss.attiva={id:'test',versione:MISS_VERSIONE,stato:'inCorso',nelPlanetario:true,corrente:0,
  partenza:Date.now(),avviata:Date.now(),scelte:{esperienza:'sfida',strumento:'occhio',durata:30},
  tappe:[{id:'stella:Star3',idCielo:'Star3',nome:'Vega',tipo:'stella',mira:{ra:18.6156,dec:38.7837},mag:.03,
    strumentoMinimo:'occhio',difficolta:1,fase:'ricerca',esito:null,aiuto:0,raccontoVariante:1,domandaVariante:0}]};`);
ctx.sky.mostraNomi=true;
assert.equal(run('missRicercaAttiva()'),true);
assert.equal(run('skyNomiVisibili()'),false);
assert.equal(run('missAmmissibile(missTappaAdesso(miss.attiva.tappe[0]),miss.attiva.scelte)'),true);
run('missMostraStrisciaCielo()');assert(!elements.get('missione-striscia').innerHTML.includes('Vega'));
run('missAggiornaScheda()');assert(!elements.get('missione-scheda').innerHTML.includes('Vega'));
assert(!run('missHtmlAnteprima(miss.attiva)').includes('Vega'));
run("missSegnaEsito(0,'trovato')");assert.equal(run('miss.attiva.tappe[0].esito'),null);
run("missSelezionaCielo({categoria:'astro',id:'Star2'})");
assert.equal(run('miss.attiva.tappe[0].esito'),null);assert.equal(run('miss.attiva.tappe[0].aiuto'),0);
assert(feedback.at(-1).testo.includes('Non è questo'));
assert(!elements.get('missione-striscia').innerHTML.includes('Vega'));
run("sky.oggetti=[Object.assign({id:'Star2'},missTappaNelPlanetario(miss.attiva.tappe[0]))];missSelezionaCielo({categoria:'astro',id:'Star2'})");
assert(feedback.at(-1).testo.includes('sei vicino'));
const clues=[];for(let i=0;i<3;i++){clues.push(run('missIndizio(miss.attiva.tappe[0])'));run('missChiediAiuto()');}
assert.equal(new Set(clues).size,3);assert.equal(run('!!miss.attiva.tappe[0].rivelata'),false);
// A correct identifier in a simulated time or another location is not an observation.
offset=3600000;run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);offset=0;
// Se la missione e' stata avviata esplicitamente all'ora consigliata, invece,
// il cielo simulato e' la scena valida e un altro oggetto resta un tentativo.
offset=3600000;run("miss.attiva.simulazione=true;miss.attiva.tappe[0].feedback=null;missSelezionaCielo({categoria:'astro',id:'Star2'})");
assert.equal(run('miss.attiva.tappe[0].feedback'),null);assert.equal(run('miss.attiva.tappe[0].aiuto'),3);run('miss.attiva.simulazione=false');offset=0;
ctx.sky.observer=new Astronomy.Observer(0,0,0);run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);ctx.sky.observer=obs;
run("missAzione('rivela',document.body)");assert.equal(run('miss.attiva.tappe[0].esito'),null);assert(elements.get('missione-striscia').innerHTML.includes('Vega'));
run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].fase'),'scoperta');assert.equal(run('miss.attiva.corrente'),0);
assert(elements.get('missione-striscia').innerHTML.includes('missione-osservazione'));
assert.equal(run('skyNomiVisibili()'),true);
// Reload retains discovery and must not silently advance it.
run('missSalvaAttiva();miss.attiva=null;missCaricaAttiva()');assert.equal(run('miss.attiva.tappe[0].fase'),'scoperta');
run("miss.attiva.tappe[0].osservazione='<script>alert(1)</script>';missMostraStrisciaCielo()");
assert(!elements.get('missione-striscia').innerHTML.includes('<script>'));
// All dynamic keys and children/adult variants resolve in both dictionaries.
for(const lang of ['it','en']){ctx.astroI18n.lingua=lang;
 for(const mode of ['sfida','bambini'])for(const type of ['luna','pianeta','stella','costellazione','profondo'])for(let v=0;v<3;v++) {
  run(`miss.attiva.scelte.esperienza='${mode}';Object.assign(miss.attiva.tappe[0],{tipo:'${type}',raccontoVariante:${v},domandaVariante:${v},indizioVariante:${v}});missIntroduzione(miss.attiva.tappe[0]);missCuriositaTesto(miss.attiva.tappe[0]);missDomanda(miss.attiva.tappe[0]);`);
 }}
assert.deepEqual(missing,[]);
// North crossing and sensor activation / manual opt out.
run("Object.assign(miss.attiva.tappe[0],{tipo:'stella',fase:'ricerca',esito:null});miss.telefonoProvato=false");
ctx.sky.sensori=true;ctx.sky.assoluto=true;run('missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,true);
ctx.sky.seguiTelefono=false;run('missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,false);
ctx.sky.seguiTelefono=true;run('miss.attiva.simulazione=true;miss.telefonoProvato=false;missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,false);run('miss.attiva.simulazione=false');
ctx.sky.sensori=false;run('miss.telefonoProvato=false;missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,false);
const guidance=run("missGuidaMirino({f:skyVettore(0,40),r:skyVettore(90,0),u:skyVettore(180,50)},{azimut:359,altezza:40})");assert(!guidance.includes('Vega'));
// A daylight target or one behind the local obstacle cannot complete.
now=Date.UTC(2026,8,8,12);run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);
now=Date.UTC(2026,8,7,21);ctx.orizzonteAltezza=()=>85;run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);
run('missPausaCielo()');assert.equal(run('miss.attiva.stato'),'inCorso');assert.equal(run('miss.attiva.nelPlanetario'),false);
run('missAbbandona()');assert.equal(run('missRicercaAttiva()'),false);assert.equal(run('skyNomiVisibili()'),true);
console.log('PASS: actual ephemerides, two modes, stable clue after wrong/correct selections, live time/location/terrain checks, discovery persistence, age-appropriate stories, sensors, cleanup');
