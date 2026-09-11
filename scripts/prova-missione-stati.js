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
/* Il finto elemento del documento.
 *
 * Gli attributi ci sono perche' il modulo li usa per davvero — la
 * striscia sul cielo si toglie lo `style` quando si esce dal planetario
 * — e senza di loro la prova moriva a meta' con un TypeError, cioe'
 * smetteva di provare tutto quello che veniva dopo senza dirlo: e' la
 * trappola dello `<script>` unico di `verifica.html`, in un'altra veste.
 * `dataset` per la stessa ragione. */
function element(){
  const classes=new Set(), attrs=new Map();
  return {innerHTML:'',textContent:'',value:'',dataset:{},
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle:(n,v)=>v?classes.add(n):classes.delete(n)},
    setAttribute:(n,v)=>attrs.set(n,String(v)),
    getAttribute:n=>attrs.has(n)?attrs.get(n):null,
    removeAttribute:n=>attrs.delete(n),
    hasAttribute:n=>attrs.has(n),
    querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},removeEventListener(){},
    focus(){},closest:()=>null,appendChild(){},remove(){},
    /* I fuochi d'artificio della scoperta sono pixel, e qui non si
     * guardano pixel: senza `getContext` il modulo toglie la tela e
     * torna indietro da solo, che e' esattamente il comportamento da
     * provare in un documento senza canvas. Senza queste due righe
     * moriva con un TypeError e si portava via tutto il resto. */
    getBoundingClientRect:()=>({width:0,height:0,left:0,top:0,right:0,bottom:0}),
    getContext:()=>null};
}
const doc={readyState:'loading',body:element(),addEventListener(){},createElement:()=>element(),
  getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
const obs=new Astronomy.Observer(45.81,9.08,0);
const ctx=vm.createContext({console,Date:Clock,Astronomy,window:{},document:doc,
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
  osservatoreCorrente:()=>obs, sky:{observer:obs,sensori:false,assoluto:false,seguiTelefono:false,oggetti:[]},
  skyAdesso:()=>new Clock(now+offset),skyAssettoDisponibile:()=>true,skyEUnTelefonoConSensoriProtetti:()=>false,
  skyAvviso:(chiave,testo)=>feedback.push({chiave,testo}),
  skyAvviaSensori(){},skyAlternaSeguiTelefono(){ctx.sky.seguiTelefono=!ctx.sky.seguiTelefono;},
  skyVettore:(az,alt)=>[Math.cos(alt*Math.PI/180)*Math.sin(az*Math.PI/180),Math.cos(alt*Math.PI/180)*Math.cos(az*Math.PI/180),Math.sin(alt*Math.PI/180)],
  skyUsaSensori:()=>ctx.sky.sensori&&ctx.sky.seguiTelefono,
  // Il terzo aiuto rivela il bersaglio e lo porta al centro della mappa:
  // sono due funzioni del planetario, e senza gli stub la progressione
  // degli aiuti si fermava al secondo gradino con un ReferenceError.
  skyVoceDiId:id=>({id,nome:id}), skyCentraSu(){}, skyChiudiDettaglio(){},
  orizzonteAltezza:()=>0, oraBreve:()=>'', setTimeout,clearTimeout,
});
const run=s=>vm.runInContext(s,ctx);
for(const lang of ['it','en'])run(fs.readFileSync(path.join(root,'lingue/'+lang+'.js'),'utf8'));
const missing=[];
ctx.astroI18n={lingua:'it',nomePunto:()=>ctx.astroI18n.lingua==='it'?'sud':'south',
 esiste:k=>k in ctx.window.ASTRO_DIZIONARI[ctx.astroI18n.lingua].messaggi,
 t(k,vars={}){const v=ctx.window.ASTRO_DIZIONARI[this.lingua].messaggi[k];if(v==null){missing.push(k);return k;}return String(v).replace(/\{(\w+)\}/g,(_,n)=>vars[n]??'{'+n+'}');}};
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
for(const name of ['altAzCorpo','altAzCoordinate','skyNomiVisibili','skyNomiCimeVisibili'])run(app.match(new RegExp('^function '+name+'\\([\\s\\S]*?^\\}', 'm'))[0]);
run(app.match(/^const SKY_STELLE = \[[\s\S]*?^\];/m)[0]);
run(fs.readFileSync(path.join(root,'missione-cielo.js'),'utf8'));
assert.deepEqual(Array.from(run('MISS_ESPERIENZE')),['bambini','curiosi','sfida']);
// Quanti aiuti ci sono davvero, letto dal modulo invece che scritto qui:
// le due righe che lo davano per tre sono rimaste indietro un giorno e
// si sono portate dietro tutto il resto del file.
const MISS_INDIZI=run('MISS_INDIZI');
run(`miss.attiva={id:'test',versione:MISS_VERSIONE,stato:'inCorso',nelPlanetario:true,corrente:0,
  partenza:Date.now(),avviata:Date.now(),scelte:{esperienza:'sfida',strumento:'occhio',durata:30},
  tappe:[{id:'stella:Star3',idCielo:'Star3',nome:'Vega',tipo:'stella',mira:{ra:18.6156,dec:38.7837},mag:.03,
    strumentoMinimo:'occhio',difficolta:1,fase:'ricerca',esito:null,aiuto:0,raccontoVariante:1,domandaVariante:0}]};`);
ctx.sky.mostraNomi=true;
ctx.cime={acceso:true};
assert.equal(run('missRicercaAttiva()'),true);
assert.equal(run('missModalitaGiocoCielo()'),true);
assert.equal(run('skyNomiVisibili()'),false);
assert.equal(run('skyNomiCimeVisibili()'),false);
// La scoperta non e' piu' una ricerca, ma e' ancora modalita' gioco nel
// planetario: i nomi dei monti devono restare nascosti fino all'uscita.
run("miss.attiva.tappe[0].fase='scoperta'");
assert.equal(run('missRicercaAttiva()'),false);
assert.equal(run('missModalitaGiocoCielo()'),true);
assert.equal(run('skyNomiCimeVisibili()'),false);
run("miss.attiva.tappe[0].fase='ricerca'");
assert.equal(run('missAmmissibile(missTappaAdesso(miss.attiva.tappe[0]),miss.attiva.scelte)'),true);
run('missMostraStrisciaCielo()');
assert(!elements.get('missione-striscia').innerHTML.includes('Vega'));
// L'introduzione e' il primo dei tre indizi mostrati prima della soluzione.
assert(elements.get('missione-striscia').innerHTML.includes('Indizio 1 di 3'));
assert(elements.get('missione-striscia').innerHTML.includes('data-miss-azione="indizio-successivo"'));
assert(!elements.get('missione-striscia').innerHTML.includes('Rileggi l’indizio'));
assert(elements.get('missione-striscia').innerHTML.includes('Segui il telefono'));
assert(elements.get('missione-striscia').innerHTML.includes('data-miss-azione="termina"'));
assert(!elements.get('missione-striscia').innerHTML.includes('Missione Cielo</button>'));
run('missAggiornaScheda()');assert(!elements.get('missione-scheda').innerHTML.includes('Vega'));
assert(!run('missHtmlAnteprima(miss.attiva)').includes('Vega'));
assert(run('miss.sbircia=true;missHtmlAnteprima(miss.attiva)').includes('Vega'));
run('miss.sbircia=false');
run("missSegnaEsito(0,'trovato')");assert.equal(run('miss.attiva.tappe[0].esito'),null);
run("missSelezionaCielo({categoria:'astro',id:'Star2'})");
assert.equal(run('miss.attiva.tappe[0].esito'),null);assert.equal(run('miss.attiva.tappe[0].aiuto'),0);
assert(feedback.at(-1).testo.includes('Non è questo'));
assert(!elements.get('missione-striscia').innerHTML.includes('Vega'));
// L'identificativo va messo **dopo**: `missTappaNelPlanetario` restituisce
// la tappa intera, `id` compreso, e con l'oggetto letterale davanti quel
// campo tornava a essere quello del bersaglio — la ricerca per id non
// trovava niente e il tocco vicino veniva raccontato come sbagliato.
run("sky.oggetti=[Object.assign({},missTappaNelPlanetario(miss.attiva.tappe[0]),{id:'Star2'})];missSelezionaCielo({categoria:'astro',id:'Star2'})");
assert(feedback.at(-1).testo.includes('sei vicino'));
const clues=[run('missIntroduzione(miss.attiva.tappe[0])')];for(let i=0;i<2;i++){run('missChiediAiuto()');clues.push(run('missIndizio(miss.attiva.tappe[0])'));}
assert.equal(new Set(clues).size,3);
/* I tre indizi sono tre indizi: nessuno rivela.
 *
 * Prima il terzo era insieme indizio e risposta, e chi chiedeva un aiuto
 * si ritrovava la caccia finita senza averlo deciso. Adesso dopo il terzo
 * compare un tasto a parte — e finche' non lo si preme il nome resta
 * coperto e la tappa non e' rivelata. */
assert.equal(run('!!miss.attiva.tappe[0].rivelata'),false);
assert(!elements.get('missione-striscia').innerHTML.includes('Vega'));
assert(elements.get('missione-striscia').innerHTML.includes('Indizio 3 di 3'));
assert(!elements.get('missione-striscia').innerHTML.includes('Indizio 4'));
assert(elements.get('missione-striscia').innerHTML.includes('data-miss-azione="soluzione"'));
// Premuto il tasto: il nome compare, la tappa si segna rivelata (il
// Diario lo riporta) e il tasto sparisce invece di restare li' a non
// fare piu' niente.
run("missAzione('soluzione',document.body)");
assert.equal(run('!!miss.attiva.tappe[0].rivelata'),true);
assert(elements.get('missione-striscia').innerHTML.includes('Vega'));
assert(elements.get('missione-striscia').innerHTML.includes('Soluzione'));
assert(!elements.get('missione-striscia').innerHTML.includes('data-miss-azione="soluzione"'));
// E la soluzione non e' un fallimento: l'esito resta da decidere.
assert.equal(run('miss.attiva.tappe[0].esito'),null);
// Con la voce scelta, anche tornare a un indizio già sbloccato o avanzare di
// nuovo deve leggere il testo che è effettivamente visibile nella striscia.
// La scoperta deve poi far leggere automaticamente il messaggio finale.
const narrazioni=[];
ctx.registraNarrazione=(fase,testo)=>narrazioni.push({fase,testo});
run("miss.attiva.scelte.voce=true;missRaccontaTappa=t=>{registraNarrazione(t.fase, t.fase==='scoperta' ? missNomeTappa(t) : missTestoIndizio(t));return true;}");
// Raccogliere il riquadro in modalita' «solo voce» e' una modifica visiva:
// non deve riavviare da capo cio' che il narratore sta gia' leggendo.
run("missAzione('solo-voce',document.body)");
assert.equal(narrazioni.length,0);
assert.equal(run('miss.strisciaNascosta'),true);
run("missAzione('mostra-guida',document.body)");
/* Gli indici sono `MISS_INDIZI + 1`, cioè tre: l'enigma è lo zero e i
 * due aiuti sono l'uno e il due. Queste due righe chiedevano il tre —
 * erano rimaste indietro dal giorno in cui gli indizi da tre sono
 * diventati due, e una sola riga sbagliata qui dentro **porta via tutto
 * quello che le sta sotto**: questo file è uno script lineare, non una
 * lista di prove, e la prima `assert` che salta lo interrompe. */
run("missAzione('indizio-precedente',document.body)");
assert.equal(run('missIndiceIndizio(miss.attiva.tappe[0])'),MISS_INDIZI-1);
run("missAzione('indizio-successivo',document.body)");
assert.equal(run('missIndiceIndizio(miss.attiva.tappe[0])'),MISS_INDIZI);
assert.equal(narrazioni.length,2);
assert.notEqual(narrazioni[0].testo,narrazioni[1].testo);
// A correct identifier in a simulated time or another location is not an observation.
offset=3600000;run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);offset=0;
// Se la missione e' stata avviata esplicitamente all'ora consigliata, invece,
// il cielo simulato e' la scena valida e un altro oggetto resta un tentativo.
offset=3600000;run("miss.attiva.simulazione=true;miss.attiva.tappe[0].feedback=null;missSelezionaCielo({categoria:'astro',id:'Star2'})");
assert.equal(run('miss.attiva.tappe[0].feedback'),null);assert.equal(run('miss.attiva.tappe[0].aiuto'),MISS_INDIZI);run('miss.attiva.simulazione=false');offset=0;
ctx.sky.observer=new Astronomy.Observer(0,0,0);run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);ctx.sky.observer=obs;
run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].fase'),'scoperta');assert.equal(run('miss.attiva.corrente'),0);
assert.equal(narrazioni.length,3);assert.equal(narrazioni[2].fase,'scoperta');assert.equal(narrazioni[2].testo,'Vega');
// «Un'altra storia» aggiorna soltanto l'aneddoto. La voce non deve
// ripetere esultanza, nome e domanda dell'intero box informativo.
run("missRaccontaCuriosita=t=>{registraNarrazione('curiosita',missCuriositaTesto(t));return true;}");
const primaAltraStoria=narrazioni.length;
run("missAzione('altraStoria',document.body)");
assert.equal(narrazioni.length,primaAltraStoria+1);
assert.equal(narrazioni.at(-1).fase,'curiosita');
assert.equal(narrazioni.at(-1).testo,run('missCuriositaTesto(miss.attiva.tappe[0])'));
assert(!elements.get('missione-striscia').innerHTML.includes('missione-osservazione'));
assert(elements.get('missione-striscia').innerHTML.includes('Vega'));
assert.equal(run('skyNomiVisibili()'),true);
// Reload retains discovery and must not silently advance it.
run('missSalvaAttiva();miss.attiva=null;missCaricaAttiva()');assert.equal(run('miss.attiva.tappe[0].fase'),'scoperta');
// All dynamic keys and children/adult variants resolve in both dictionaries.
for(const lang of ['it','en']){ctx.astroI18n.lingua=lang;
 for(const mode of ['sfida','curiosi','bambini'])for(const type of ['luna','pianeta','stella','costellazione','profondo'])for(let v=0;v<3;v++) {
  run(`miss.attiva.scelte.esperienza='${mode}';Object.assign(miss.attiva.tappe[0],{tipo:'${type}',slug:null,categoria:null,raccontoVariante:${v},domandaVariante:${v},indizioVariante:${v}});missIntroduzione(miss.attiva.tappe[0]);missCuriositaTesto(miss.attiva.tappe[0]);missDomanda(miss.attiva.tappe[0]);missSpecieTappa(miss.attiva.tappe[0]);`);
 }
 // I tre gradini di ripiego: nome proprio, specie di catalogo, famiglia.
 for(const mode of ['sfida','curiosi','bambini'])for(const caso of [
   "{tipo:'profondo',nome:'M13 — Grande Ammasso di Ercole',sigla:'M13',categoria:'globulare'}",
   "{tipo:'profondo',nome:'M85 — galassia ellittica',sigla:'M85',categoria:'galassia'}",
   "{tipo:'profondo',nome:'NGC 1 — galassia a spirale',sigla:'NGC 1',categoria:null}",
   "{tipo:'costellazione',nome:'Orione',sigla:'Ori'}"]) {
  run(`miss.attiva.scelte.esperienza='${mode}';miss.attiva.tappe[0]=Object.assign({id:'x',fase:'ricerca',esito:null,aiuto:0,raccontoVariante:0,domandaVariante:0,indizioVariante:0,mira:{ra:18.6,dec:38.8},azimut:180,altezza:45},${caso});missIntroduzione(miss.attiva.tappe[0]);missCuriositaTesto(miss.attiva.tappe[0]);missDomanda(miss.attiva.tappe[0]);missSpecieTappa(miss.attiva.tappe[0]);missHtmlScoperta(miss.attiva.tappe[0]);`);
 }}
assert.deepEqual(missing,[]);
// North crossing and sensor activation / manual opt out.
run("Object.assign(miss.attiva.tappe[0],{tipo:'stella',fase:'ricerca',esito:null});miss.telefonoProvato=false");
ctx.sky.sensori=true;ctx.sky.assoluto=true;run('missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,true);
ctx.sky.seguiTelefono=false;run('missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,false);
ctx.sky.seguiTelefono=true;run('miss.attiva.simulazione=true;miss.telefonoProvato=false;missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,false);run('miss.attiva.simulazione=false');
ctx.sky.sensori=false;run('miss.telefonoProvato=false;missAttivaTelefono()');assert.equal(ctx.sky.seguiTelefono,false);
run("missAzione('segui-telefono',document.body)");assert.equal(ctx.sky.seguiTelefono,true);
const guidance=run("missGuidaMirino({f:skyVettore(0,40),r:skyVettore(90,0),u:skyVettore(180,50)},{azimut:359,altezza:40})");assert(!guidance.includes('Vega'));
// A daylight target or one behind the local obstacle cannot complete.
now=Date.UTC(2026,8,8,12);run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);
now=Date.UTC(2026,8,7,21);ctx.orizzonteAltezza=()=>85;run("missSelezionaCielo({categoria:'astro',id:'Star3'})");assert.equal(run('miss.attiva.tappe[0].esito'),null);
run('missPausaCielo()');assert.equal(run('miss.attiva.stato'),'inCorso');assert.equal(run('miss.attiva.nelPlanetario'),false);assert.equal(run('missModalitaGiocoCielo()'),false);
run('missAbbandona()');assert.equal(run('missRicercaAttiva()'),false);assert.equal(run('skyNomiVisibili()'),true);assert.equal(run('skyNomiCimeVisibili()'),true);
console.log('PASS: actual ephemerides, three difficulty levels, stable clue after wrong/correct selections, live time/location/terrain checks, discovery persistence, age-appropriate stories, sensors, cleanup');
