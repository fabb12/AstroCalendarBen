#!/usr/bin/env node
'use strict';
// npm install --no-save astronomy-engine; node scripts/prova-missione-interattiva.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const engine = require('../missione-cielo.js');
const candidates = Array.from({length: 12}, (_, i) => ({ id: 's' + i, idCielo: 's' + i,
  nome: 'Star ' + i, tipo: 'stella', altezza: 50, azimut: i * 20, sopraOstacoli: 50,
  strumentoMinimo: 'occhio', difficolta: 1, evidenza: .8, puntiBase: 50, minutiUtili: 60 }));
const scenario = { adesso: 100000, partenza: 100000, scelte: { durata: 30, esperienza: 'sfida' }, candidati: candidates };
const signatures = new Set(Array.from({length: 20}, (_, i) => engine.genera({...scenario, seme: 'session' + i}).tappe.map(t=>t.id).join(',')));
assert(signatures.size > 5, 'selection and order vary across sessions');
const first = engine.genera({...scenario, seme: 'fixed'});
assert.deepEqual(first, engine.genera({...scenario, seme: 'fixed'}), 'seed is stable');
const second = engine.genera({...scenario, seme: 'fixed', storia: Object.fromEntries(first.tappe.map(t=>[t.id,t.raccontoVariante])), domande: Object.fromEntries(first.tappe.map(t=>[t.id,t.domandaVariante]))});
first.tappe.forEach((t,i)=> { assert.notEqual(t.raccontoVariante, second.tappe[i].raccontoVariante); assert.notEqual(t.domandaVariante, second.tappe[i].domandaVariante); });
assert(engine.genera({...scenario, posizioneA:()=>({altezza:-5})}).vuota, 'scheduled positions are revalidated');
assert(engine.selezioneCorretta({tipo:'profondo',idCielo:'dso:M31'}, {categoria:'profondo',dati:{id:224,nome:'M31'}}));
assert(!engine.selezioneCorretta({tipo:'pianeta',idCielo:'Jupiter'}, {categoria:'astro',id:'Saturn'}));
assert(engine.selezioneCorretta({tipo:'costellazione',sigla:'Cyg'}, {categoria:'costellazione',sigla:'Cyg'}));
assert(engine.distanzaSferica({azimut:359,altezza:30},{azimut:1,altezza:30}) < 2);
console.log('PASS: deterministic diversity, no repeated variants, current visibility, canonical IDs');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server = http.createServer((req,res)=> {
 const f = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
 if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',types[path.extname(f)] || 'text/plain');res.end(fs.readFileSync(f));
});
(async()=> {
 let browser;
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM ? {executablePath:process.env.CHROMIUM} : {})});
  const context = await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  const page = await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const astronomy = fs.readFileSync(path.join(root,'node_modules/astronomy-engine/astronomy.browser.min.js'),'utf8');
  await page.route('**/*',route=> {
    const url=route.request().url();
    if(url.includes('/astronomy.browser.min.js')) return route.fulfill({body:astronomy,contentType:'text/javascript'});
    if(url.startsWith('http://127.0.0.1:')) return route.continue();
    return route.fulfill({body:'',contentType:'text/javascript'});
  });
  await page.addInitScript(()=> {
    const OriginalDate=Date;
    const frozen=OriginalDate.UTC(2026,8,7,21);
    window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[frozen]));} static now(){return frozen;}};
    localStorage.setItem('astrocal_lingua','it');
    localStorage.setItem('astrocalendario_posizione',JSON.stringify({lat:45.81,lon:9.08,nome:'Como',fonte:'manuale',precisione:1000}));
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
  // La missione si prepara per **più tardi**: è la sola condizione in cui
  // compare «Inizia alle…», ed è quella che questa prova vuole — un cielo
  // simulato all'ora della tappa invece dell'orologio vero.
  await page.evaluate(()=> { mostraVista('stasera'); missApriPannello();
    miss.scelte.esperienza='sfida'; miss.scelte.momento='personalizzato';
    miss.scelte.momentoPersonalizzato=Date.now()+90*60000; missPreparaAnteprima(); });
  const preview=await page.evaluate(()=>({names:miss.anteprima.tappe.map(t=>t.nome), text:document.getElementById('missione-corpo').textContent}));
  assert(preview.names.length >= 2); preview.names.forEach(n=>assert(!preview.text.includes(n),'preview hides '+n));
  const planned=await page.evaluate(()=>miss.anteprima.tappe[0].quando);
  await page.click('[data-miss-azione="avviaDopo"]');
  await page.waitForTimeout(500);
  const search=await page.evaluate(()=> ({target:sky.target, labels:skyNomiVisibili(), name:miss.attiva.tappe[0].nome,
    skyTime:skyAdesso().getTime(), timeMode:sky.modalitaTempo,
    text:document.getElementById('missione-striscia').textContent, buttons:[...document.querySelectorAll('#missione-striscia button')].map(b=>b.textContent)}));
  assert.equal(search.skyTime,planned); assert.equal(search.timeMode,'simulato');
  // Continue the interactive search on the real sky, as an «adesso» mission.
  await page.evaluate(()=> {
    missAbbandona();
    miss.scelte.momento='adesso';
    mostraVista('stasera');
    missApriPannello();
    missPreparaAnteprima();
    missAvvia(miss.anteprima);
  });
  const currentTime=await page.evaluate(()=>({skyTime:skyAdesso().getTime(),timeMode:sky.modalitaTempo,now:Date.now()}));
  assert.equal(currentTime.timeMode,'reale'); assert.equal(currentTime.skyTime,currentTime.now);
  /* Questa prova tocca il canvas, e per farlo le serve un bersaglio
   * **puntiforme**: una figura si riconosce toccando una sua linea, ed è
   * provata altrove. Se la prima tappa è una costellazione la si
   * sostituisce qui, *prima* di leggere l'indizio di riferimento —
   * sostituendola dentro al tocco, il confronto «l'indizio non cambia
   * dopo un errore» finirebbe per paragonare due bersagli diversi. */
  await page.evaluate(()=> {
    const t=miss.attiva.tappe[miss.attiva.corrente];
    if (t.idCielo) return;
    const candidate=missCandidatiDelCielo(osservatoreCorrente(),[Date.now()],miss.attiva.scelte)
      .find(c=>c.tipo==='stella' && missAmmissibile(c,miss.attiva.scelte));
    if (candidate) { Object.assign(t,candidate,{fase:'ricerca',esito:null}); missMostraStrisciaCielo(); }
  });
  search.name=await page.evaluate(()=>miss.attiva.tappe[0].nome);
  search.text=await page.textContent('#missione-striscia');
  assert.equal(search.target,null); assert.equal(search.labels,false); assert(!search.text.includes(search.name));
  assert(!search.buttons.some(s=>/trovato/i.test(s)));
  await page.screenshot({path:path.join(root,'../missione-ricerca.png')});
  // L'introduzione conta come primo dei tre indizi.
  assert((await page.textContent('#missione-striscia .missione-numero-indizio')).includes('1 di 3'));
  assert.equal(await page.$('#missione-striscia [data-miss-azione="indizio-principale"]'),null);
  await page.click('#missione-striscia [data-miss-azione="indizio-successivo"]');
  const before=await page.evaluate(()=>({clue:missIndizio(miss.attiva.tappe[0]), hint:miss.attiva.tappe[0].aiuto}));
  assert.equal(before.hint,1);
  assert((await page.textContent('#missione-striscia .missione-numero-indizio')).includes('2 di 3'));
  await page.click('#missione-striscia [data-miss-azione="indizio-precedente"]');
  assert((await page.textContent('#missione-striscia .missione-numero-indizio')).includes('1 di 3'));
  await page.click('#missione-striscia [data-miss-azione="indizio-successivo"]');
  const posizionePrima=await page.locator('#missione-striscia').boundingBox();
  const maniglia=await page.locator('#missione-striscia .missione-trascina').boundingBox();
  await page.mouse.move(maniglia.x+maniglia.width/2,maniglia.y+maniglia.height/2);
  await page.mouse.down(); await page.mouse.move(maniglia.x+50,maniglia.y+80,{steps:4}); await page.mouse.up();
  const posizioneDopo=await page.locator('#missione-striscia').boundingBox();
  assert(posizioneDopo.x !== posizionePrima.x || posizioneDopo.y !== posizionePrima.y,'information panel can be dragged');
  await page.locator('#missione-striscia .missione-trascina').focus();
  await page.keyboard.press('ArrowLeft');
  const posizioneTastiera=await page.locator('#missione-striscia').boundingBox();
  assert(posizioneTastiera.x < posizioneDopo.x,'information panel can be moved with the keyboard');
  /* Il tocco deve arrivare alla **mappa**, non a un tasto.
   *
   * È quello che questa funzione esiste per provare, e per un pezzo si è
   * accontentata di sperarlo: si spostava la vista di ventidue gradi in
   * alto e si toccava dove il bersaglio finiva. Ma poco sopra la striscia
   * della missione è stata trascinata apposta in mezzo al cielo, e se il
   * bersaglio le casca sotto il clic lo prende lei — la tappa resta in
   * ricerca, che è il comportamento **giusto** dell'app e una prova che
   * ha mancato il suo bersaglio. Non falliva quasi mai perché dipende da
   * dove sta il bersaglio di stanotte: con un cielo alto capita, con uno
   * basso no, e una prova che fallisce due volte su nove insegna solo a
   * rilanciarla.
   *
   * Quindi non si spera: si cerca uno scostamento della vista che porti
   * il bersaglio su pixel di cielo scoperti, e lo si dichiara. */
  async function tapObject(correct) {
    const point=await page.evaluate(correct=> {
      const t=miss.attiva.tappe[miss.attiva.corrente];
      const o=correct ? skyVoceDiId(t.idCielo) : sky.oggetti.find(o=>o.id!==t.idCielo && o.alt>25);
      sky.seguiTelefono=false; skyFermaMovimenti();
      const canvas=sky.ctx.canvas;
      let ultimo=null;
      for (const scarto of [22,14,30,8,-12,-20,0]) {
        skyCentraSu(o,{subito:true});
        sky.manuale.alt = Math.max(-20, Math.min(85, sky.manuale.alt + scarto));
        skyDisegna();
        const p=skyProietta(skyVettore(o.az,o.alt),sky.ultimaBase,sky.ultimaFocale);
        const box=canvas.getBoundingClientRect();
        const x=box.left+p.px, y=box.top+p.py;
        const sopra=document.elementFromPoint(x,y);
        ultimo={x,y,scarto,id:o.id,selection:skyOggettoNelPunto(p.px,p.py),
          sotto:sopra?(sopra.id||sopra.className||sopra.tagName):null,
          sullaMappa:!!(sopra&&(sopra===canvas||canvas.contains(sopra)))};
        if (ultimo.sullaMappa) break;
      }
      return ultimo;
    },correct);
    assert(point.sullaMappa,'il tocco cadrebbe su '+point.sotto+', non sulla mappa: '+JSON.stringify(point));
    await page.mouse.click(point.x,point.y);
    return point;
  }
  await tapObject(false);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[0].esito),null);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[0].tentativi),1);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[0].aiuto),1);
  assert.equal(await page.textContent('#missione-striscia .missione-striscia-indizio'),before.clue);
  assert((await page.textContent('#skymap-avviso')).includes('Non è questo'));
  const point=await tapObject(true);
  /* Se il tocco non diventa una scoperta, le cause sono tre e si
   * assomigliano tutte sullo schermo: la selezione non è il bersaglio,
   * oppure lo è ma il tocco viene ignorato dal cancello di
   * `missTocco` — luogo diverso, orologio diverso, o tappa che in
   * questo istante non è più ammissibile. Senza questi numeri la prova
   * dice «phase: ricerca» e non si capisce quale dei tre. */
  const found=await page.evaluate(()=>{
    const t=miss.attiva.tappe[0], ora=missTappaNelPlanetario(t);
    return {phase:t.fase,result:t.esito,index:miss.attiva.corrente,
      html:document.getElementById('missione-striscia').innerHTML,
      perche:{ammissibile:missAmmissibile(ora,miss.attiva.scelte), altezza:ora.altezza,
        sopraOstacoli:ora.sopraOstacoli, strumento:t.strumentoMinimo,
        scelte:{strumento:miss.attiva.scelte.strumento,esperienza:miss.attiva.scelte.esperienza},
        simulazione:!!miss.attiva.simulazione,
        scartoOrologio:skyAdesso().getTime()-Date.now()}};
  });
  assert.equal(found.phase,'scoperta',JSON.stringify({point,perche:found.perche}));
  assert.equal(found.result,'trovato');assert.equal(found.index,0);
  assert(!found.html.includes('missione-osservazione'));
  assert(!found.html.includes('Conserva nella memoria'));
  const altra=await page.$('#missione-striscia [data-miss-azione="altraStoria"]');
  if(altra) {
    const prima=await page.textContent('#missione-striscia .missione-aneddoto');
    await altra.click();
    assert.notEqual(await page.textContent('#missione-striscia .missione-aneddoto'),prima);
  }
  await page.screenshot({path:path.join(root,'../missione-scoperta.png')});
  await page.click('#missione-striscia [data-miss-azione="continua"]');
  assert.equal(await page.evaluate(()=>miss.attiva.corrente),1);
  assert.equal(await page.evaluate(()=>sky.target),null);
  /* I tre indizi non rivelano: dopo il terzo compare un tasto a parte.
   *
   * Finché non lo si preme il nome resta coperto e la tappa non è
   * rivelata — riconoscere l'oggetto sulla mappa tocca ancora a chi
   * guarda, ed è la sola cosa che una caccia abbia da dare. */
  await page.evaluate(()=> { for(let i=0;i<2;i++) missChiediAiuto(); });
  assert.equal(await page.evaluate(()=>!!miss.attiva.tappe[1].rivelata),false);
  assert(!(await page.textContent('#missione-striscia')).includes(
    await page.evaluate(()=>miss.attiva.tappe[1].nome)));
  assert(await page.$('#missione-striscia [data-miss-azione="soluzione"]'));
  // Premuto: il nome compare, la tappa si segna rivelata (il Diario lo
  // riporta) ma non si chiude — arrendersi non è sbagliare.
  await page.click('#missione-striscia [data-miss-azione="soluzione"]');
  assert.equal(await page.evaluate(()=>!!miss.attiva.tappe[1].rivelata),true);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[1].esito),null);
  assert((await page.textContent('#missione-striscia')).includes(
    await page.evaluate(()=>missNomeTappa(miss.attiva.tappe[1]))));
  await page.evaluate(()=>astroI18n.impostaLingua('en'));
  assert((await page.textContent('#missione-striscia')).includes('Search') || (await page.textContent('#missione-striscia')).includes('Skip'));
  // Every dynamic content key resolves, in every mode and both languages.
  const missing=await page.evaluate(()=> {
    const failures=[];
    for (const lang of ['it','en']) { astroI18n.impostaLingua(lang);
      for (const mode of ['sfida','curiosi','bambini']) {miss.attiva.scelte.esperienza=mode;
        for(const type of ['luna','pianeta','stella','costellazione','profondo']) for(let variant=0;variant<3;variant++) {
          const t={...miss.attiva.tappe[1],tipo:type,raccontoVariante:variant,domandaVariante:variant,indizioVariante:variant};
          for(const text of [missIntroduzione(t),missCuriositaTesto(t),missDomanda(t)]) if(text.includes('missione.')) failures.push(text);
        }
      }
    } return failures;
  });
  assert.deepEqual(missing,[]);
  const unexpected = errors.filter(e=>!/FullCalendar|Leaflet|satellite/i.test(e));
  assert.deepEqual(unexpected,[],errors.join('\n'));
  await page.evaluate(()=>missAbbandona());
  assert.equal(await page.evaluate(()=>skyNomiVisibili()),true);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('missione-ricerca')),false);
  console.log('PASS: mobile UI, anonymous preview, hints, wrong/correct canvas taps, discovery, alternate story, next stop, progressive reveal, both locales, cleanup');
  if(errors.length) console.log('Unrelated page errors with external services stubbed:',errors);
 } finally {if(browser) await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
