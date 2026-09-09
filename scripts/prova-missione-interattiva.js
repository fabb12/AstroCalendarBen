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
  await page.evaluate(()=> { mostraVista('stasera'); missApriPannello(); miss.scelte.esperienza='sfida'; missPreparaAnteprima(); });
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
  search.name=await page.evaluate(()=>miss.attiva.tappe[0].nome);
  search.text=await page.textContent('#missione-striscia');
  assert.equal(search.target,null); assert.equal(search.labels,false); assert(!search.text.includes(search.name));
  assert(!search.buttons.some(s=>/trovato/i.test(s)));
  await page.screenshot({path:path.join(root,'../missione-ricerca.png')});
  await page.click('#missione-striscia [data-miss-azione="aiuto"]');
  const before=await page.evaluate(()=>({clue:missIndizio(miss.attiva.tappe[0]), hint:miss.attiva.tappe[0].aiuto}));
  assert.equal(before.hint,1);
  // Verify a real pointer hit goes through the canvas, not a completion button.
  async function tapObject(correct) {
    const point=await page.evaluate(correct=> {
      const t=miss.attiva.tappe[miss.attiva.corrente];
      // Use a point target for this integration check; constellation matching is checked separately.
      if (!t.idCielo) {
        const candidate=missCandidatiDelCielo(osservatoreCorrente(),[Date.now()],miss.attiva.scelte)
          .find(c=>c.tipo==='stella' && missAmmissibile(c,miss.attiva.scelte));
        Object.assign(t,candidate,{fase:'ricerca',esito:null});
      }
      const o=correct ? skyVoceDiId(t.idCielo) : sky.oggetti.find(o=>o.id!==t.idCielo && o.alt>25);
      sky.seguiTelefono=false; skyFermaMovimenti(); skyCentraSu(o,{subito:true});
      sky.manuale.alt = Math.min(85, sky.manuale.alt + 22); skyDisegna();
      const p=skyProietta(skyVettore(o.az,o.alt),sky.ultimaBase,sky.ultimaFocale);
      const canvas=sky.ctx.canvas, box=canvas.getBoundingClientRect();
      return {x:box.left+p.px,y:box.top+p.py,id:o.id,selection:skyOggettoNelPunto(p.px,p.py)};
    },correct);
    await page.mouse.click(point.x,point.y);
    return point;
  }
  await tapObject(false);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[0].esito),null);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[0].tentativi),1);
  const point=await tapObject(true);
  const found=await page.evaluate(()=>({phase:miss.attiva.tappe[0].fase,result:miss.attiva.tappe[0].esito,index:miss.attiva.corrente,html:document.getElementById('missione-striscia').innerHTML}));
  assert.equal(found.phase,'scoperta',JSON.stringify(point)); assert.equal(found.result,'trovato');assert.equal(found.index,0);
  assert(found.html.includes('missione-osservazione'));
  await page.fill('#missione-osservazione','Una luce bianca, più ferma delle altre.');
  await page.screenshot({path:path.join(root,'../missione-scoperta.png')});
  await page.click('#missione-striscia [data-miss-azione="continua"]');
  assert.equal(await page.evaluate(()=>miss.attiva.corrente),1);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[0].osservazione),'Una luce bianca, più ferma delle altre.');
  assert.equal(await page.evaluate(()=>sky.target),null);
  // Advanced help reveals only on explicit request and cannot complete the mission.
  await page.evaluate(()=> { for(let i=0;i<3;i++) missChiediAiuto(); });
  assert.equal(await page.evaluate(()=>!!miss.attiva.tappe[1].rivelata),false);
  await page.click('#missione-striscia [data-miss-azione="rivela"]');
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[1].esito),null);
  assert.equal(await page.evaluate(()=>miss.attiva.tappe[1].rivelata),true);
  await page.evaluate(()=>astroI18n.impostaLingua('en'));
  assert((await page.textContent('#missione-striscia')).includes('Search') || (await page.textContent('#missione-striscia')).includes('Skip'));
  // Every dynamic content key resolves, in every mode and both languages.
  const missing=await page.evaluate(()=> {
    const failures=[];
    for (const lang of ['it','en']) { astroI18n.impostaLingua(lang);
      for (const mode of ['imparare','sfida','bambini','stupore']) {miss.attiva.scelte.esperienza=mode;
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
  console.log('PASS: mobile UI, anonymous preview, hints, wrong/correct canvas taps, discovery, notes, next stop, explicit reveal, both locales, cleanup');
  if(errors.length) console.log('Unrelated page errors with external services stubbed:',errors);
 } finally {if(browser) await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
