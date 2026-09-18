/* Le curiosità delle schede.
 * ==========================
 *
 *     node scripts/prova-curiosita.js --solo-motore   # mezzo secondo
 *     node scripts/prova-curiosita.js                 # e poi in un Chromium
 *
 * La domanda che questo banco esiste per fare è una sola, ed è quella che
 * guardando lo schermo non si può fare: **una curiosità che non compare non
 * fallisce**. Se lo slug di una stella non corrisponde al nome con cui il
 * catalogo la chiama, il riquadro semplicemente non c'è — e un riquadro che
 * non c'è è identico a «di questo oggetto non c'è niente da dire», che è
 * una risposta legittima e frequente. Si può quindi scrivere una pagina di
 * storia su Rasalhague, sbagliare una lettera, e non accorgersene mai.
 *
 * Il giudice non è l'occhio ma il confronto fra due elenchi che devono
 * combaciare: gli slug scritti nel dizionario e i nomi veri dei cataloghi
 * (`dati-stelle.js`, `dati-profondo.js`, `dati-costellazioni.js`,
 * `dati-corpi-minori.js`), più le tabelle che stanno dentro ad `app.js` per
 * i nove corpi del Sistema Solare e per le tre stazioni.
 *
 * In mezzo le prove della macchina — lo slug, la catena di ripiego, le
 * varianti contigue — e quelle sul **testo**, che sono di un'altra natura:
 * una frase vuota, un segnaposto dimenticato o un pezzo di marcatura
 * finito in una voce non si vedono leggendo il dizionario, e sullo schermo
 * si leggono benissimo.
 *
 * E in coda la seconda metà, in un Chromium vero, perché tre cose un
 * documento lo vogliono: che il riquadro finisca davvero nella scheda del
 * planetario e nella pagina dell'atlante, che il testo ci arrivi come testo
 * e non come marcatura, e che «raccontamene un'altra» **sopravviva al
 * battito**. Quest'ultima è la prova che tiene in piedi tutto il §1 del
 * modulo: la scheda del cielo si riscrive da capo una volta al secondo, e
 * uno stato appoggiato a un nodo verrebbe buttato via — il tasto sembrerebbe
 * funzionare e un secondo dopo la storia tornerebbe quella di prima.
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..');
const cur = require(path.join(RADICE, 'curiosita.js'));

// --- I dati, letti come li legge il browser -------------------------------
//
// I `dati-*.js` sono file di dati con le costanti dichiarate in `const`, e in
// un `vm` una `const` di primo livello **non** finisce sull'oggetto del
// contesto: va riesportata a mano in coda allo script.
function leggiDati(file, nomi) {
  const contesto = {};
  vm.createContext(contesto);
  const coda = nomi.map(n => `try{ __out.${n} = ${n}; }catch(e){}`).join('\n');
  vm.runInContext('var __out = {};\n' + fs.readFileSync(path.join(RADICE, file), 'utf8') +
    '\n' + coda + '\n__esporta = __out;', contesto);
  return contesto.__esporta;
}

const dizionari = {};
for (const lingua of ['it', 'en']) {
  const contesto = { window: {} };
  vm.createContext(contesto);
  vm.runInContext(fs.readFileSync(path.join(RADICE, 'lingue', lingua + '.js'), 'utf8'), contesto);
  dizionari[lingua] = contesto.window.ASTRO_DIZIONARI[lingua].messaggi;
}
const IT = dizionari.it;

// Le chiavi di questo file, divise per famiglia e senza il numero della
// variante: `curiosita.stella.vega.2` → famiglia `stella`, slug `vega`.
function voci(famiglia) {
  const dentro = new Set();
  for (const chiave of Object.keys(IT)) {
    const pezzi = chiave.split('.');
    if (pezzi[0] !== 'curiosita' || pezzi[1] !== famiglia) continue;
    dentro.add(pezzi.slice(2, pezzi.length - 1).join('.'));
  }
  return dentro;
}

let ko = 0;
function prova(nome, corpo) {
  try { corpo(); console.log('  ok        ' + nome); }
  catch (errore) { console.log('  FALLITO   ' + nome + '\n              ' + errore.message); ko++; }
}

// =========================================================================
console.log('\n— lo slug: da un nome a una chiave —');

prova('gli accenti e gli spazi se ne vanno', () => {
  assert.strictEqual(cur.curSlug('Stella Polare'), 'stella-polare');
  assert.strictEqual(cur.curSlug('Cuore di Carlo'), 'cuore-di-carlo');
});

prova('quello che sta fra parentesi si butta', () => {
  // Nel catalogo la prima stella del Centauro si chiama «Rigil Kentaurus
  // (α Centauri)»: la parentesi è un chiarimento per chi legge, non parte
  // del nome, e tenerla vorrebbe dire una chiave che non esiste.
  assert.strictEqual(cur.curSlug('Rigil Kentaurus (α Centauri)'), 'rigil-kentaurus');
});

prova('«M31» e «M 31» danno la stessa chiave', () => {
  // Nel catalogo grande sono due voci della stessa cosa (§catPreparaProfondo),
  // e devono raccontare la stessa storia: senza la chiusura del trattino fra
  // una lettera e una cifra, metà dei tocchi su M31 non troverebbe niente.
  assert.strictEqual(cur.curSlug('M31'), cur.curSlug('M 31'));
  assert.strictEqual(cur.curSlug('NGC 2264'), 'ngc2264');
});

prova('le lettere greche si traslitterano invece di sparire', () => {
  // Togliendo tutto ciò che non è una lettera latina, «ω Cen» e «χ Cen»
  // darebbero lo stesso slug: due oggetti diversi, una storia sola.
  assert.strictEqual(cur.curSlug('ω Cen'), 'omega-cen');
  assert.notStrictEqual(cur.curSlug('ω Cen'), cur.curSlug('χ Cen'));
});

prova('un nome vuoto non solleva e non inventa niente', () => {
  assert.strictEqual(cur.curSlug(null), '');
  assert.strictEqual(cur.curSlug(undefined), '');
  assert.strictEqual(cur.curSlug('   '), '');
});

// =========================================================================
console.log('\n— la catena: da un oggetto del planetario alle sue chiavi —');

prova('i nove del Sistema Solare passano dall’identificativo, non dal nome', () => {
  // Un nome è una parola che cambia con la lingua: una tabella che leggesse
  // «Mars» smetterebbe di riconoscere Marte appena si passa all'inglese, e il
  // sintomo sarebbe un riquadro che sparisce — cioè niente di visibile.
  assert.deepStrictEqual(cur.curCatena({ id: 'Mars', tipo: 'pianeta', nome: 'Mars' }), ['astro.marte']);
  assert.deepStrictEqual(cur.curCatena({ id: 'Sun', tipo: 'sole', nome: 'Sun' }), ['astro.sole']);
});

prova('una costellazione si riconosce dalla sigla IAU', () => {
  assert.deepStrictEqual(cur.curCatena({ categoria: 'costellazione', sigla: 'Oph' }), ['figura.oph']);
});

prova('il cielo profondo ripiega sulla specie', () => {
  assert.deepStrictEqual(
    cur.curCatena({ categoria: 'profondo', sigla: 'NGC 6633', tipo: 'ammasso' }),
    ['profondo.ngc6633', 'specie.ammasso']);
});

prova('e la sigla di un oggetto scritto a mano si ricava dal nome', () => {
  // I quattordici di `SKY_PROFONDO` la sigla non ce l'hanno scritta: è la
  // prima parola del nome, «M31 — Galassia di Andromeda».
  assert.deepStrictEqual(
    cur.curCatena({ categoria: 'profondo', nome: 'M31 — Galassia di Andromeda', tipo: 'galassia' }),
    ['profondo.m31', 'specie.galassia']);
});

prova('una stella senza nome proprio non produce nessuna chiave', () => {
  // «Stella CAT 4211 di magnitudine 4,2 — Lira» è una descrizione, non un
  // nome: slugarla darebbe una chiave che non esiste, cioè lavoro buttato.
  assert.deepStrictEqual(
    cur.curCatena({ categoria: 'stellaCatalogo', senzaNome: true, nome: 'Stella CAT 4211 di magnitudine 4,2' }),
    []);
});

prova('le tre porte da cui arriva una stella danno la stessa chiave', () => {
  const atteso = ['stella.vega'];
  assert.deepStrictEqual(cur.curCatena({ tipo: 'stella', nome: 'Vega' }), atteso);
  assert.deepStrictEqual(cur.curCatena({ categoria: 'figura', nome: 'Vega' }), atteso);
  assert.deepStrictEqual(cur.curCatena({ categoria: 'stellaCatalogo', nome: 'Vega' }), atteso);
});

prova('una cometa senza nome proprio ripiega sulla specie', () => {
  assert.deepStrictEqual(
    cur.curCatena({ categoria: 'corpoMinore', tipo: 'cometa', nome: '88P/Howell (2026)' }),
    ['minore.88p-howell', 'specieMinore.cometa']);
});

prova('un oggetto che non si sa cos’è non produce chiavi invece di indovinarne', () => {
  assert.deepStrictEqual(cur.curCatena(null), []);
  assert.deepStrictEqual(cur.curCatena({ categoria: 'aereo', nome: 'AZ1234' }), []);
});

// =========================================================================
console.log('\n— gli slug scritti e i nomi veri dei cataloghi —');

const STELLE = leggiDati('dati-stelle.js', ['STELLE_NOMI']);
const PROFONDO = leggiDati('dati-profondo.js', ['CATALOGO_PROFONDO']);
const FIGURE = leggiDati('dati-costellazioni.js', ['COSTELLAZIONI_IAU']);
const MINORI = leggiDati('dati-corpi-minori.js', ['CORPI_MINORI']);

prova('ogni curiosità di una stella parla di una stella che esiste', () => {
  // È la prova che questo file esiste per fare. Una lettera sbagliata nel
  // nome, e quella curiosità non comparirà mai: non fallisce, non lascia
  // traccia, e sullo schermo è indistinguibile da «niente da dire».
  const veri = new Set(STELLE.STELLE_NOMI.map(([, nome]) => cur.curSlug(nome)));
  const orfani = [...voci('stella')].filter(s => !veri.has(s));
  assert.deepStrictEqual(orfani, [], `${orfani.length} slug senza riscontro: ${orfani.slice(0, 8).join(', ')}`);
});

prova('ogni curiosità del cielo profondo parla di un oggetto che esiste', () => {
  const veri = new Set(PROFONDO.CATALOGO_PROFONDO.map(o => cur.curSlug(o.sigla)));
  const orfani = [...voci('profondo')].filter(s => !veri.has(s));
  assert.deepStrictEqual(orfani, [], `${orfani.length} slug senza riscontro: ${orfani.slice(0, 8).join(', ')}`);
});

prova('e tutti e centotrentadue gli oggetti del catalogo ne hanno una', () => {
  const scritti = voci('profondo');
  const mancano = [...new Set(PROFONDO.CATALOGO_PROFONDO.map(o => cur.curSlug(o.sigla)))]
    .filter(s => !scritti.has(s));
  assert.deepStrictEqual(mancano, [], `${mancano.length} senza curiosità: ${mancano.slice(0, 8).join(', ')}`);
});

prova('tutte e ottantotto le figure ne hanno una, e nessuna di più', () => {
  const sigle = new Set(FIGURE.COSTELLAZIONI_IAU.map(c => c.sigla.toLowerCase()));
  const scritte = voci('figura');
  assert.strictEqual(sigle.size, 88);
  assert.deepStrictEqual([...sigle].filter(s => !scritte.has(s)), []);
  assert.deepStrictEqual([...scritte].filter(s => !sigle.has(s)), []);
});

prova('ogni curiosità di un corpo minore parla di un corpo del file', () => {
  const veri = new Set(MINORI.CORPI_MINORI.map(c => cur.curSlug(c.nome)));
  const orfani = [...voci('minore')].filter(s => !veri.has(s));
  assert.deepStrictEqual(orfani, [], orfani.join(', '));
});

prova('i nove del Sistema Solare e le tre stazioni hanno tutti la loro', () => {
  // Gli identificativi stanno in `app.js` (`SKY_CORPI`, `SATELLITI`) e non in
  // un file di dati: si leggono da lì, se no questa prova racconta di una
  // tabella che nessuno usa.
  const app = fs.readFileSync(path.join(RADICE, 'app.js'), 'utf8');
  const scritti = voci('astro');
  for (const slug of Object.values(cur.CUR_CORPI)) {
    assert.ok(scritti.has(slug), 'manca la curiosità di ' + slug);
  }
  const satelliti = [...app.matchAll(/^\s{4}id: '(iss|css|hubble)',$/gm)].map(m => m[1]);
  assert.deepStrictEqual(satelliti.sort(), ['css', 'hubble', 'iss']);
  for (const id of satelliti) assert.ok(scritti.has(id), 'manca la curiosità della stazione ' + id);
});

prova('le cinque specie del cielo profondo hanno il loro ripiego', () => {
  for (const specie of cur.CUR_SPECIE) {
    assert.ok(IT['curiosita.specie.' + specie + '.1'], 'manca il ripiego di ' + specie);
  }
});

// =========================================================================
console.log('\n— le varianti —');

prova('le varianti sono contigue: nessun buco fra la prima e l’ultima', () => {
  // `curQuante` si ferma alla prima che manca. Una voce con la `.1` e la
  // `.3` ma senza la `.2` non è un errore visibile: semplicemente la terza
  // storia non si legge mai, e chi l'ha scritta non lo scopre.
  const per = new Map();
  for (const chiave of Object.keys(IT)) {
    if (!chiave.startsWith('curiosita.')) continue;
    const m = chiave.match(/^(curiosita\..+)\.(\d+)$/);
    if (!m) continue;
    if (!per.has(m[1])) per.set(m[1], new Set());
    per.get(m[1]).add(Number(m[2]));
  }
  const rotte = [];
  for (const [base, numeri] of per) {
    for (let n = 1; n <= Math.max(...numeri); n++) if (!numeri.has(n)) rotte.push(base + '.' + n);
  }
  assert.deepStrictEqual(rotte, [], rotte.join(', '));
});

prova('nessuna voce supera il tetto che il motore va a cercare', () => {
  const oltre = Object.keys(IT).filter(c => {
    const m = c.match(/^curiosita\..+\.(\d+)$/);
    return m && Number(m[1]) > cur.CUR_VARIANTI_MAX;
  });
  assert.deepStrictEqual(oltre, [], oltre.join(', '));
});

// =========================================================================
console.log('\n— il testo —');

prova('le due lingue hanno esattamente le stesse chiavi', () => {
  // Una chiave che manca in inglese non lascia un buco: `astroI18n` ripiega
  // sull'italiano, e sullo schermo compare una frase perfettamente leggibile
  // nella lingua sbagliata. È il difetto di traduzione più silenzioso che ci sia.
  const soloIt = Object.keys(IT).filter(c => c.startsWith('curiosita.') && dizionari.en[c] === undefined);
  const soloEn = Object.keys(dizionari.en).filter(c => c.startsWith('curiosita.') && IT[c] === undefined);
  assert.deepStrictEqual(soloIt, [], 'senza inglese: ' + soloIt.slice(0, 6).join(', '));
  assert.deepStrictEqual(soloEn, [], 'senza italiano: ' + soloEn.slice(0, 6).join(', '));
});

prova('nessuna voce è vuota o troppo corta per dire qualcosa', () => {
  const corte = [];
  for (const lingua of ['it', 'en']) {
    for (const [chiave, testo] of Object.entries(dizionari[lingua])) {
      if (!chiave.startsWith('curiosita.') || !/\.\d+$/.test(chiave)) continue;
      if (typeof testo !== 'string' || testo.trim().length < 60) corte.push(lingua + ':' + chiave);
    }
  }
  assert.deepStrictEqual(corte, [], corte.join(', '));
});

prova('nessuna voce porta segnaposto o marcatura', () => {
  // Il testo finisce in `textContent` (§5 di `curiosita.js`), quindi un tag
  // non verrebbe interpretato: si leggerebbe alla lettera, sullo schermo.
  // E un `{n}` senza nessuno che lo riempia resta scritto com'è.
  const sporche = [];
  for (const lingua of ['it', 'en']) {
    for (const [chiave, testo] of Object.entries(dizionari[lingua])) {
      if (!chiave.startsWith('curiosita.') || typeof testo !== 'string') continue;
      if (/[<>]|\{\w/.test(testo)) sporche.push(lingua + ':' + chiave);
    }
  }
  assert.deepStrictEqual(sporche, [], sporche.join(', '));
});

prova('il titolo e il tasto ci sono in tutt’e due le lingue', () => {
  for (const lingua of ['it', 'en']) {
    assert.ok(dizionari[lingua]['curiosita.titolo'], 'manca il titolo in ' + lingua);
    assert.ok(dizionari[lingua]['curiosita.altra'], 'manca il tasto in ' + lingua);
  }
});

// =========================================================================
// La seconda metà: in un browser vero.
// =========================================================================

function chiudi(codice) {
  console.log(codice === 0 ? '\n✓ tutte le prove passate' : `\n✗ ${codice} prove fallite`);
  process.exit(codice === 0 ? 0 : 1);
}

if (process.argv.includes('--solo-motore')) chiudi(ko);

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.log('\n(niente browser: `npm install playwright-core astronomy-engine` per la seconda metà)');
  chiudi(ko);
}

const http = require('http');
const PORTA = 8127;
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(RADICE, nome === '/' ? 'index.html' : nome);
  if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

(async () => {
  const libreria = path.join(RADICE, 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js');
  if (!fs.existsSync(libreria)) {
    console.log('\n(manca astronomy-engine: `npm install astronomy-engine`)');
    chiudi(ko);
  }
  await new Promise(r => server.listen(PORTA, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const pagina = await contesto.newPage();

  /* Le rotte generiche vanno **prima** di quella specifica.
   * Quando più rotte di Playwright combaciano vince l'ultima registrata, e
   * `**cdn.jsdelivr.net**` contiene anche l'indirizzo di Astronomy Engine:
   * messa dopo, se lo mangia, il cielo resta senza effemeridi e la prova
   * fallisce per un motivo che col codice non c'entra niente. */
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**unpkg.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**astronomy-engine**', r =>
    r.fulfill({ body: fs.readFileSync(libreria, 'utf8'), contentType: 'text/javascript' }));

  // Le prove che non parlano di lingua la lingua la fissano: le attese sono
  // in italiano, e su una macchina qualunque il browser può dire un'altra cosa.
  await pagina.addInitScript(() => {
    try {
      localStorage.setItem('astrocal_lingua', 'it');
      localStorage.setItem('astrocalendario_posizione',
        JSON.stringify({ lat: 45.81, lon: 9.08, nome: 'Como', fonte: 'manuale' }));
    } catch (e) { /* finestra privata */ }
  });

  await pagina.goto(`http://127.0.0.1:${PORTA}/index.html`, { waitUntil: 'load' });
  await pagina.waitForFunction(() => typeof window.curBloccoHtml === 'function', null, { timeout: 30000 });
  await pagina.evaluate(() => mostraVista('cielo'));
  await pagina.waitForFunction(() => sky && sky.oggetti && sky.oggetti.length > 0, null, { timeout: 30000 });

  // Una prova che gira nella pagina: si esegue là dentro e si verifica qui.
  // Un'eccezione dentro al browser è un fallimento come gli altri, non una
  // corsa interrotta — se no una prova rotta si porta via tutte quelle dopo.
  const dentro = async (nome, funzione, verifica) => {
    let esito;
    try { esito = await pagina.evaluate(funzione); }
    catch (e) { console.log('  FALLITO   ' + nome + '\n              ' + e.message); ko++; return; }
    prova(nome, () => verifica(esito));
  };

  console.log('\n— nella scheda del planetario —');

  await dentro('la scheda di un pianeta porta il suo riquadro', () => {
    sky.selezione = { categoria: 'astro', id: 'Saturn' };
    skyApriFumetto(); skyApriSchedaCompleta();
    const corpo = document.getElementById('skymap-dettaglio-corpo');
    const testo = corpo.querySelector('.curiosita-testo');
    return {
      titolo: (corpo.querySelector('.curiosita-titolo') || {}).textContent || '',
      testo: testo ? testo.textContent : '',
      tasto: !!corpo.querySelector('.tasto-curiosita')
    };
  }, r => {
    assert.ok(r.titolo.includes('Curiosità'), 'titolo: ' + r.titolo);
    assert.ok(r.testo.length > 80, 'testo troppo corto: ' + r.testo);
    assert.ok(!r.testo.includes('<'), 'nel testo è finita della marcatura');
    assert.ok(r.tasto, 'manca il tasto: Saturno ha tre storie');
  });

  await dentro('«un’altra» cambia storia e il battito non la rimette indietro', () => {
    const corpo = () => document.getElementById('skymap-dettaglio-corpo');
    const prima = corpo().querySelector('.curiosita-testo').textContent;
    corpo().querySelector('.tasto-curiosita').click();
    const dopo = corpo().querySelector('.curiosita-testo').textContent;
    // Il battito della scheda: rifà l'HTML da capo, e deve ricomporre la
    // variante che sta in `cur.varianti` invece di ripartire dalla prima.
    skyAggiornaScheda();
    return { prima, dopo, dopoIlBattito: corpo().querySelector('.curiosita-testo').textContent };
  }, r => {
    assert.notStrictEqual(r.prima, r.dopo, 'il tasto non ha cambiato niente');
    assert.strictEqual(r.dopo, r.dopoIlBattito, 'il battito ha rimesso la storia di prima');
  });

  await dentro('una stella del catalogo dice la sua etimologia', () => {
    const voce = [...cat.nomiPerIndice].find(([, n]) => n === 'Rasalhague');
    const dati = catSchedaStella(voce[0]);
    sky.selezione = { categoria: 'stellaCatalogo', dati };
    skyApriFumetto(); skyApriSchedaCompleta();
    const n = document.getElementById('skymap-dettaglio-corpo').querySelector('.curiosita-testo');
    return { nome: dati.nome, testo: n ? n.textContent : '' };
  }, r => {
    assert.strictEqual(r.nome, 'Rasalhague');
    assert.ok(/incantatore di serpenti/.test(r.testo), 'testo inatteso: ' + r.testo.slice(0, 60));
  });

  await dentro('una stella senza nome non porta nessun riquadro', () => {
    // È la promessa del modulo: o si ha qualcosa di vero da dire di *quell*
    // oggetto, o il riquadro non compare. Una frase generica appiccicata a
    // cinquemila puntini è peggio di nessuna frase.
    const indice = [...cat.nomiPerIndice.keys()];
    let anonima = null;
    for (let i = 0; i < cat.quante && !anonima; i++) {
      if (!indice.includes(i) && cat.magnitudini[i] < 90) anonima = catSchedaStella(i);
    }
    sky.selezione = { categoria: 'stellaCatalogo', dati: anonima };
    skyApriFumetto(); skyApriSchedaCompleta();
    return {
      senzaNome: !!(anonima && anonima.senzaNome),
      riquadro: !!document.getElementById('skymap-dettaglio-corpo').querySelector('.curiosita-testo')
    };
  }, r => {
    assert.ok(r.senzaNome, 'non si è trovata una stella senza nome nel catalogo');
    assert.strictEqual(r.riquadro, false, 'una stella anonima ha ricevuto una curiosità generica');
  });

  console.log('\n— nell’atlante delle costellazioni —');

  await dentro('la pagina di una figura porta il suo riquadro', () => {
    apriAtlanteCostellazioni('Ori');
    const n = document.querySelector('#cost-scheda .curiosita-testo');
    return n ? n.textContent : '';
  }, r => {
    assert.ok(r.length > 80, 'niente riquadro nella pagina di Orione');
    assert.ok(!r.includes('<'), 'nel testo è finita della marcatura');
  });

  await dentro('e cambiando lingua parla inglese', () => {
    astroI18n.setLanguage('en');
    apriAtlanteCostellazioni('Oph');
    const titolo = document.querySelector('#cost-scheda .curiosita-titolo');
    const testo = document.querySelector('#cost-scheda .curiosita-testo');
    astroI18n.setLanguage('it');
    return { titolo: titolo ? titolo.textContent.trim() : '', testo: testo ? testo.textContent : '' };
  }, r => {
    assert.ok(/Worth knowing/.test(r.titolo), 'titolo: ' + r.titolo);
    assert.ok(/thirteenth constellation/.test(r.testo), 'testo: ' + r.testo.slice(0, 60));
  });

  await browser.close();
  server.close();
  chiudi(ko);
})();
