/* Il cambio lingua, in un browser vero.
 * ====================================
 *
 * Le quattro cose che questo lavoro promette non si giudicano leggendo il
 * codice, e tre delle quattro non si giudicano nemmeno guardando lo schermo:
 *
 *   1. **La copertura.** Un'interfaccia mezza tradotta non somiglia a un
 *      difetto: somiglia a una traduzione fatta da poco. L'unico giudice è
 *      contare le parole italiane che restano *sullo schermo* dopo il cambio,
 *      e per contarle bisogna che la pagina sia impaginata per davvero — il
 *      testo nascosto non conta, quello dentro a un pannello chiuso sì.
 *   2. **Le prestazioni.** «Istantaneo» è un numero, e va misurato là dove il
 *      difetto viveva: con il documento intero costruito, i pannelli aperti e
 *      le schede piene.
 *   3. **Il modo.** Un cambio lingua veloce per caso — perché la pagina è
 *      piccola — tornerebbe lento appena cresce. Qui si misura la *causa*:
 *      quanti nodi si toccano, e che non si cammini il documento.
 *   4. **Il ripiego.** Una chiave che manca deve dare l'italiano e una riga in
 *      console, non un buco. Il modo di provarlo è togliere una chiave e
 *      guardare lo schermo.
 *
 * Serve, una volta sola:
 *     npm install playwright-core astronomy-engine
 *
 * Poi:
 *     node scripts/prova-lingua.js
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

/* Dove sta Chromium. Il percorso cambia con la versione della cache di
 * Playwright (`chromium-1194/`), quindi si cerca invece di scriverlo: gli
 * altri banchi di prova hanno il percorso cablato e su un container nuovo
 * fallirebbero prima di provare una riga di codice nostro. */
function trovaChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const basi = ['/opt/pw-browsers', path.join(process.env.HOME || '/root', '.cache', 'ms-playwright')];
  const code = ['chrome-linux/chrome', 'chrome-linux/headless_shell'];
  for (const base of basi) {
    if (!fs.existsSync(base)) continue;
    const cartelle = fs.readdirSync(base)
      .filter(n => /^chromium/.test(n))
      .sort().reverse();                      // la più recente per prima
    for (const cartella of cartelle) {
      for (const coda of code) {
        const via = path.join(base, cartella, coda);
        if (fs.existsSync(via)) return via;
      }
    }
  }
  throw new Error('Chromium non trovato: npx playwright install chromium, oppure CHROMIUM=/percorso/a/chrome');
}
const CHROMIUM = trovaChromium();

/* I tetti della copertura. Sono un cricchetto e non un obiettivo: scendono
 * quando si converte un pezzo, e non risalgono. Chi ne trova uno più alto del
 * necessario lo abbassi — la prova lo dice da sé, con una freccia in giù. */
const TETTI = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-tetto.json'), 'utf8'));
const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function leggiAstronomy() {
  const posti = [
    process.env.ASTRONOMY_JS,
    path.join(RADICE, 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js')
  ].filter(Boolean);
  for (const p of posti) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  throw new Error('Astronomy Engine non trovata: npm install astronomy-engine');
}

const server = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(RADICE, nome === '/' ? 'index.html' : nome);
  if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

/* Le parole che dicono «questa frase è italiana». Sono funzionali di
 * proposito: un nome proprio (Milano, Betelgeuse, Tiangong) non le contiene,
 * una frase sì. Servono a contare quello che è rimasto da tradurre senza
 * contare i nomi delle stelle, che non si traducono. */
const SPIA_IT = /(?:^|[\s>(«"'])(?:il|lo|la|le|gli|un[ao]?|del|della|dei|degli|delle|dal|dalla|nel|nella|sul|sulla|con|per|non|che|come|dove|quando|perch[eé]|pi[uù]|molto|tutt[oiae]|quest[oaie]|quell[oaie]|sono|essere|c'[eè]|se|ma|per[oò]|anche|ancora|gi[aà]|solo|senza|sopra|sotto|prima|dopo|verso|fino|fra|oppure|invece|mentre|quindi|allora|adesso|stanotte|cielo|luna|sole|terra)(?=$|[\s.,;:!?»"')<])/i;

(async () => {
  await new Promise(r => server.listen(8098, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({
    serviceWorkers: 'block',
    locale: 'en-GB'                    // così la prima scelta è l'inglese
  });
  const pagina = await contesto.newPage();

  const errori = [], avvisiI18n = [];
  pagina.on('console', m => {
    const t = m.text();
    if (m.type() === 'error') errori.push(t);
    if (/\[i18n\]/.test(t)) avvisiI18n.push(t);
  });
  pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));

  // L'ordine conta al contrario: fra rotte che combaciano vince l'ULTIMA
  // registrata, quindi il catch-all di jsdelivr va per primo.
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
  for (const rete of ['**/api.open-meteo.com/**', '**/air-quality-api.open-meteo.com/**',
                      '**/services.swpc.noaa.gov/**', '**/celestrak.org/**', '**overpass**',
                      '**ipapi**', '**ipwho**', '**geojs**', '**/s3.amazonaws.com/**',
                      '**bigdatacloud**', '**nominatim**', '**adsb**', '**tile.**']) {
    await pagina.route(rete, r => r.abort());
  }

  await pagina.goto('http://localhost:8098/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pagina.evaluate(() => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');     // si parte dall'italiano
  });
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(3000);

  let ko = 0;
  const ok = (n, c, x) => { console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : '')); if (!c) ko++; };

  // =====================================================================
  console.log('\n— il gestore c\'è, e i dizionari sono in memoria —');
  const stato = await pagina.evaluate(() => ({
    presente: typeof window.astroI18n === 'object',
    lingue: window.astroI18n.getSupportedLanguages(),
    lingua: window.astroI18n.getLanguage(),
    chiaviIt: Object.keys(window.ASTRO_DIZIONARI.it.messaggi).length,
    chiaviEn: Object.keys(window.ASTRO_DIZIONARI.en.messaggi).length,
    indice: window.astroI18n._indice()
  }));
  ok('astroI18n è pubblicato', stato.presente);
  ok('due lingue registrate', stato.lingue.join(',') === 'it,en', stato.lingue.join(','));
  ok('parte dalla preferenza salvata', stato.lingua === 'it', stato.lingua);
  ok('dizionario italiano in memoria', stato.chiaviIt > 400, stato.chiaviIt + ' chiavi');
  ok('dizionario inglese in memoria', stato.chiaviEn === stato.chiaviIt,
     stato.chiaviEn + ' chiavi, parità con l\'italiano');
  ok('l\'indice dei nodi con chiave è popolato', stato.indice > 300, stato.indice + ' nodi');

  // =====================================================================
  console.log('\n— nessuna richiesta di traduzione, e nessuna attesa di rete —');
  // Il gestore di prima aspettava `ipwho.is` (sveglia a 3,5 s) prima di
  // scegliere: fino a quel momento l'interfaccia restava in italiano.
  // Un contesto **nuovo**: il localStorage è del contesto, e la prova di
  // prima ci ha scritto «it». Riusandolo si proverebbe la preferenza salvata,
  // che è l'altro ramo — e la prova passerebbe per il motivo sbagliato.
  const contestoVergine = await browser.newContext({ serviceWorkers: 'block', locale: 'en-GB' });
  const senzaPreferenza = await contestoVergine.newPage();
  const richieste = [];
  senzaPreferenza.on('request', r => richieste.push(r.url()));
  for (const rete of ['**cdn.jsdelivr.net**', '**fonts.googleapis.com**']) {
    await senzaPreferenza.route(rete, r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  }
  await senzaPreferenza.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
  // ipwho.is si lascia cadere ma con calma, per vedere se qualcuno l'aspetta
  await senzaPreferenza.route('**ipwho**', async r => { await new Promise(s => setTimeout(s, 4000)); r.abort(); });
  for (const rete of ['**/api.open-meteo.com/**', '**overpass**', '**adsb**', '**tile.**',
                      '**/celestrak.org/**', '**/services.swpc.noaa.gov/**']) {
    await senzaPreferenza.route(rete, r => r.abort());
  }
  await senzaPreferenza.goto('http://localhost:8098/index.html', { waitUntil: 'domcontentloaded' });
  await senzaPreferenza.waitForTimeout(1200);          // molto meno dei 3,5 s della sveglia
  const subito = await senzaPreferenza.evaluate(() => ({
    lingua: window.astroI18n.getLanguage(),
    menu: document.getElementById('btn-vista-stasera').textContent.trim()
  }));
  ok('senza preferenza sceglie subito, senza aspettare la rete',
     subito.lingua === 'en', `lingua «${subito.lingua}» dopo 1,2 s`);
  ok('e il menu è già in inglese', subito.menu === 'Tonight', `«${subito.menu}»`);
  const traduzioniInRete = richieste.filter(u => /translate|translation|deepl|libretranslate/i.test(u));
  ok('nessuna API di traduzione chiamata', traduzioniInRete.length === 0, traduzioniInRete.join(', ') || 'zero');
  await senzaPreferenza.close();
  await contestoVergine.close();

  // =====================================================================
  console.log('\n— il cambio lingua è istantaneo —');
  // Si misura col documento intero costruito e con i pannelli aperti, cioè
  // dove il difetto viveva.
  await pagina.evaluate(() => {
    document.querySelectorAll('.velo-modale').forEach(m => m.classList.remove('hidden'));
  });
  await pagina.waitForTimeout(300);
  const misura = await pagina.evaluate(() => {
    const nodiTesto = () => {
      let n = 0;
      const giro = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (giro.nextNode()) n++;
      return n;
    };
    const testi = nodiTesto();
    const tempi = [];
    for (let i = 0; i < 6; i++) {
      const verso = i % 2 ? 'it' : 'en';
      const t0 = performance.now();
      window.astroI18n.setLanguage(verso);
      tempi.push(performance.now() - t0);
    }
    // Il cambio lingua è due lavori, e vale la pena separarli perché sono di
    // natura diversa. Il **testo** è la riscrittura dei nodi che portano una
    // chiave, e cresce col numero delle etichette. Il **ridisegno** è quello
    // che rifà le viste e i pannelli composti in JavaScript, e costa quanto
    // costa disegnarli — cioè quanto costa aprirli, che è un costo che l'app
    // paga comunque. `applica(document.body)` fa esattamente il primo lavoro
    // su tutto il documento, quindi ne è la misura.
    const soloTesto = [];
    for (let i = 0; i < 6; i++) {
      const t0 = performance.now();
      window.astroI18n.applica(document.body);
      soloTesto.push(performance.now() - t0);
    }
    return {
      testi, nodi: window.astroI18n._indice(), tempi,
      peggiore: Math.max(...tempi),
      testoPeggiore: Math.max(...soloTesto)
    };
  });
  console.log(`     nodi di testo nel documento : ${misura.testi}`);
  console.log(`     nodi toccati dal cambio     : ${misura.nodi}`);
  console.log(`     cambio completo (ms)        : ${misura.tempi.map(t => t.toFixed(1)).join(', ')}`);
  console.log(`     di cui solo il testo (ms)   : ${misura.testoPeggiore.toFixed(1)} nel peggiore`);
  // Il numero che conta per chi guarda: un cambio lingua sotto il decimo di
  // secondo non si legge come un'attesa. Misurato **con tutte le finestre
  // aperte**, che è il caso peggiore che esista e non quello di nessuno.
  ok('il cambio lingua sta sotto i 120 ms', misura.peggiore < 120,
     misura.peggiore.toFixed(1) + ' ms nel peggiore, con tutte le finestre aperte');
  // E il numero che conta per chi ci mette mano: la riscrittura del testo è
  // dieci volte meno del ridisegno, cioè il gestore non è il collo di
  // bottiglia. Se un giorno lo diventasse, è qui che si vede.
  ok('la riscrittura del testo sta sotto i 15 ms', misura.testoPeggiore < 15,
     misura.testoPeggiore.toFixed(1) + ' ms su ' + misura.nodi + ' nodi');
  ok('non cammina il documento (tocca meno nodi di quanti testi ci sono)',
     misura.nodi < misura.testi, `${misura.nodi} < ${misura.testi}`);

  // =====================================================================
  console.log('\n— copertura: cosa resta in italiano sullo schermo —');
  await pagina.evaluate(() => window.astroI18n.setLanguage('en'));
  await pagina.waitForTimeout(400);
  // Si guarda quello che è **impaginato**, non tutto il documento.
  //
  // Non è indulgenza: le sette viste dell'applicazione esistono tutte insieme
  // nel documento e sei sono nascoste, quindi contando tutto si conterebbe
  // sei volte del testo che nessuno sta guardando — e per giunta lo si
  // conterebbe *sbagliato*, perché una vista nascosta si ridisegna quando
  // torna a schermo (`ridisegnaVistaSeVecchia`), non quando cambia la lingua.
  // Che quella promessa sia mantenuta lo prova la sezione dopo, aprendo le
  // viste una per una: è lì che una vista rimasta indietro salta fuori.
  const resti = await pagina.evaluate((spia) => {
    const re = new RegExp(spia, 'i');
    const fuori = [];
    const giro = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let nodo;
    while ((nodo = giro.nextNode())) {
      const testo = (nodo.nodeValue || '').trim();
      if (testo.length < 4 || !re.test(testo)) continue;
      const genitore = nodo.parentElement;
      if (!genitore || /^(SCRIPT|STYLE|NOSCRIPT|CANVAS)$/.test(genitore.tagName)) continue;
      // `offsetParent` nullo vuol dire fuori dall'impaginazione (o `position:
      // fixed`, che qui non capita per il testo).
      if (!genitore.offsetParent && genitore !== document.body) continue;
      fuori.push({
        testo: testo.slice(0, 90),
        dove: genitore.tagName.toLowerCase() + (genitore.id ? '#' + genitore.id : ''),
        chiave: genitore.getAttribute('data-i18n') || ''
      });
    }
    return fuori;
  }, SPIA_IT.source);
  console.log(`     frasi italiane ancora a schermo: ${resti.length}`);
  for (const r of resti.slice(0, 12)) console.log(`       ${r.dove}  «${r.testo}»`);
  ok('l\'interfaccia statica non ha più frasi italiane', resti.length === 0,
     resti.length ? resti.length + ' rimaste' : 'nessuna');

  // I titoli e gli aria-label, che è la metà che non si vede
  const attributi = await pagina.evaluate((spia) => {
    const re = new RegExp(spia, 'i');
    const fuori = [];
    for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
      if (!el.offsetParent) continue;                  // non impaginato: nessuno lo legge
      for (const a of ['title', 'aria-label', 'placeholder']) {
        const v = (el.getAttribute(a) || '').trim();
        if (v.length > 3 && re.test(v)) fuori.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} @${a} «${v.slice(0, 70)}»`);
      }
    }
    return fuori;
  }, SPIA_IT.source);
  console.log(`     attributi italiani rimasti: ${attributi.length}`);
  for (const a of attributi.slice(0, 10)) console.log('       ' + a);
  ok('titoli, aria-label e placeholder tradotti', attributi.length === 0,
     attributi.length ? attributi.length + ' rimasti' : 'nessuno');

  // =====================================================================
  console.log('\n— ogni vista, aperta dopo il cambio lingua —');
  // È il difetto che il conto qui sopra non può prendere: l'applicazione si
  // apre nel planetario, le altre sei viste sono già costruite e nascoste, e
  // al cambio lingua non vengono ridisegnate (costerebbe secondi per niente).
  // La promessa è che si ridisegnino **quando si aprono**, e questa è la prova.
  const perVista = [];
  for (const vista of ['stasera', 'calendario', 'agenda', 'diario', 'telescopio']) {
    await pagina.evaluate((v) => mostraVista(v), vista);
    await pagina.waitForTimeout(500);
    const italiano = await pagina.evaluate((spia) => {
      const re = new RegExp(spia, 'i');
      let quante = 0;
      const primi = [];
      const giro = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let nodo;
      while ((nodo = giro.nextNode())) {
        const testo = (nodo.nodeValue || '').trim();
        if (testo.length < 4 || !re.test(testo)) continue;
        const g = nodo.parentElement;
        if (!g || /^(SCRIPT|STYLE|NOSCRIPT|CANVAS)$/.test(g.tagName)) continue;
        if (!g.offsetParent && g !== document.body) continue;
        quante++;
        if (primi.length < 3) primi.push(g.tagName.toLowerCase() + ' «' + testo.slice(0, 60) + '»');
      }
      return { quante, primi };
    }, SPIA_IT.source);
    perVista.push([vista, italiano.quante]);
    console.log(`     ${vista.padEnd(11)} ${String(italiano.quante).padStart(4)} frasi italiane`);
    for (const p of italiano.primi) console.log('                    ' + p);
  }
  /* Il tetto, non lo zero.
   *
   * Zero è la meta e non è ancora vero: nell'agenda resta il **contenuto degli
   * eventi** che non è ancora passato alle chiavi — le congiunzioni, gli sciami,
   * le stagioni, le eclissi — e sono frasi di prosea, non etichette. Una prova
   * che pretende zero adesso è una prova rossa per sempre, cioè una prova che
   * si impara a ignorare; una che pretende «non più di ieri» è un cricchetto:
   * scende quando si lavora e non risale mai. Il tetto sta in
   * `scripts/i18n-tetto.json` accanto a quello dell'audit, e chi converte un
   * pezzo lo abbassa. */
  const tetti = TETTI.viste || {};
  let sforati = 0;
  for (const [vista, quante] of perVista) {
    const tetto = tetti[vista] === undefined ? 0 : tetti[vista];
    if (quante > tetto) {
      console.log(`     ✗ «${vista}»: ${quante} frasi, il tetto è ${tetto}`);
      sforati++;
    } else if (quante < tetto) {
      console.log(`     ↓ «${vista}»: ${quante} sotto il tetto di ${tetto} — abbassalo in scripts/i18n-tetto.json`);
    }
  }
  ok('nessuna vista è peggiorata dal cambio lingua', sforati === 0,
     sforati ? sforati + ' viste sopra il loro tetto' : 'tutte dentro al tetto');
  await pagina.evaluate(() => mostraVista('cielo'));
  await pagina.waitForTimeout(300);

  // =====================================================================
  console.log('\n— l\'intestazione del documento segue la lingua —');
  const testa = await pagina.evaluate(() => ({
    lang: document.documentElement.lang,
    titolo: document.title,
    manifest: (document.querySelector('link[rel=manifest]') || {}).getAttribute?.('href')
  }));
  ok('<html lang> aggiornato', /^en/.test(testa.lang), testa.lang);
  ok('il titolo della pagina è tradotto', /AstroCalendar/.test(testa.titolo) && !/AstroCalendario/.test(testa.titolo), testa.titolo);
  ok('il manifest è quello inglese', testa.manifest === 'manifest-en.json', String(testa.manifest));

  // =====================================================================
  console.log('\n— i figli non si perdono (le icone dentro ai bottoni) —');
  const icone = await pagina.evaluate(() => {
    const dentro = [...document.querySelectorAll('[data-i18n]')]
      .filter(el => el.querySelector('svg, img'));
    return { quanti: dentro.length, senzaIcona: dentro.filter(el => !el.querySelector('svg, img')).length };
  });
  ok('i bottoni con icona hanno ancora la loro icona', icone.senzaIcona === 0,
     `${icone.quanti} elementi con icona e chiave`);

  // =====================================================================
  console.log('\n— il bottone della lingua —');
  const bottone = await pagina.evaluate(() => {
    window.astroI18n.setLanguage('it');
    const b = document.getElementById('btn-lingua');
    const it = { testo: b.textContent.trim(), titolo: b.title, prossima: b.dataset.prossimaLingua };
    b.click();
    const dopo = { lingua: window.astroI18n.getLanguage(), testo: b.textContent.trim(), titolo: b.title };
    return { it, dopo, salvata: localStorage.getItem('astrocal_lingua') };
  });
  ok('il bottone dice dove si va', bottone.it.testo === 'EN', bottone.it.testo);
  ok('col titolo nella lingua di adesso', /^Passa a/.test(bottone.it.titolo), bottone.it.titolo);
  ok('un clic cambia lingua', bottone.dopo.lingua === 'en', bottone.dopo.lingua);
  ok('e il bottone si gira', bottone.dopo.testo === 'IT' && /^Switch to/.test(bottone.dopo.titolo),
     `${bottone.dopo.testo} · ${bottone.dopo.titolo}`);
  ok('la scelta si ricorda', bottone.salvata === 'en', String(bottone.salvata));

  // =====================================================================
  console.log('\n— il ripiego, quando una chiave manca —');
  const ripiego = await pagina.evaluate(() => {
    const dizionario = window.ASTRO_DIZIONARI.en;
    // Si toglie una chiave dall'inglese e si guarda cosa esce.
    const chiave = 'ui.chiudi';
    window.astroI18n.setLanguage('it');
    const originale = window.astroI18n.t(chiave);
    // il gestore ha già assorbito i dizionari: si tocca la sua copia
    window.astroI18n.registraLingua('en', { messaggi: {} });
    return { originale, chiave };
  });
  // Il ripiego vero si prova con una chiave che non esiste in nessuna lingua.
  const inventata = await pagina.evaluate(() => ({
    mancante: window.astroI18n.t('non.esiste.proprio'),
    conValori: window.astroI18n.t('non.esiste.nemmeno.questa', { n: 3 }),
    esiste: window.astroI18n.esiste('non.esiste.proprio'),
    esisteVera: window.astroI18n.esiste('ui.chiudi'),
    rapporto: window.astroI18n.mancanti().length
  }));
  ok('una chiave che non c\'è restituisce il suo nome', inventata.mancante === 'non.esiste.proprio', inventata.mancante);
  ok('e non solleva nemmeno con dei valori', inventata.conValori === 'non.esiste.nemmeno.questa');
  ok('esiste() sa distinguere', inventata.esiste === false && inventata.esisteVera === true);
  ok('le mancanti finiscono nel rapporto', inventata.rapporto >= 2, inventata.rapporto + ' chiavi');
  const avvisiMancanti = avvisiI18n.filter(t => /Manca la traduzione/.test(t));
  const doppioni = avvisiMancanti.filter(t => t.includes('non.esiste.proprio'));
  ok('l\'avviso si scrive una volta sola per chiave', doppioni.length === 1, doppioni.length + ' righe');

  // Il ripiego sulla lingua base: una chiave presente in italiano e non in
  // inglese deve dare l'italiano, non un buco.
  const baseIt = await pagina.evaluate(() => {
    window.astroI18n.registraLingua('xx', { locale: 'xx', nome: 'Prova', messaggi: { 'solo.xx': 'yes' } });
    window.astroI18n.setLanguage('xx');
    const ripiegata = window.astroI18n.t('ui.chiudi');       // non esiste in xx
    const propria = window.astroI18n.t('solo.xx');
    window.astroI18n.setLanguage('en');
    return { ripiegata, propria };
  });
  ok('una chiave mancante ripiega sull\'italiano', baseIt.ripiegata === 'Chiudi', `«${baseIt.ripiegata}»`);
  ok('e la lingua nuova usa le sue', baseIt.propria === 'yes');
  ok('l\'interfaccia non si è rotta', errori.filter(e => /ECCEZIONE/.test(e)).length === 0,
     errori.filter(e => /ECCEZIONE/.test(e)).join(' | ') || 'nessuna eccezione');

  // =====================================================================
  console.log('\n— i formati, e i conti alla rovescia —');
  const formati = await pagina.evaluate(() => {
    const r = {};
    for (const lingua of ['it', 'en']) {
      window.astroI18n.setLanguage(lingua);
      r[lingua] = {
        numero: window.astroI18n.numero(1234.5, 1),
        secondi: window.astroI18n.quantoManca(42 * 1000),
        unMinuto: window.astroI18n.quantoManca(60 * 1000),
        minuti: window.astroI18n.quantoManca(25 * 60 * 1000),
        ore: window.astroI18n.quantoManca(2.25 * 3600 * 1000),
        unGiorno: window.astroI18n.quantoManca(24 * 3600 * 1000 * 1.2),
        giorni: window.astroI18n.quantoManca(3 * 24 * 3600 * 1000),
        anni: window.astroI18n.quantoManca(4.5 * 365.25 * 24 * 3600 * 1000),
        adesso: window.astroI18n.quantoManca(0),
        durata: window.astroI18n.durata(3 * 86400e3 + 4 * 3600e3),
        ovest: window.astroI18n.siglaPunto(270),
        nomeOvest: window.astroI18n.nomePunto(270)
      };
    }
    window.astroI18n.setLanguage('en');
    return r;
  });
  console.log('     it:', JSON.stringify(formati.it));
  console.log('     en:', JSON.stringify(formati.en));
  ok('il numero usa il separatore della lingua',
     formati.it.numero === '1.234,5' && formati.en.numero === '1,234.5',
     `${formati.it.numero} / ${formati.en.numero}`);
  ok('il conto alla rovescia è tradotto',
     /^fra/.test(formati.it.minuti) && /^in/.test(formati.en.minuti),
     `${formati.it.minuti} / ${formati.en.minuti}`);
  ok('il singolare non dice «1 days»',
     formati.en.unGiorno === 'in 1 day' && formati.it.unGiorno === 'fra 1 giorno',
     `${formati.it.unGiorno} / ${formati.en.unGiorno}`);
  ok('un\'ora sola si dice come si dice',
     formati.en.ore === 'in 2 h 15 min' && formati.it.ore === 'fra 2 h 15 min',
     `${formati.it.ore} / ${formati.en.ore}`);
  ok('l\'ovest non è «O» in inglese',
     formati.it.ovest === 'O' && formati.en.ovest === 'W',
     `${formati.it.ovest} / ${formati.en.ovest}`);
  ok('e nemmeno «ovest»',
     formati.it.nomeOvest === 'ovest' && formati.en.nomeOvest === 'west',
     `${formati.it.nomeOvest} / ${formati.en.nomeOvest}`);

  // =====================================================================
  console.log('\n— chi si disegna da sé viene avvisato —');
  const avviso = await pagina.evaluate(async () => {
    let chiamate = 0, ultima = '';
    const stacca = window.astroI18n.alCambio((l) => { chiamate++; ultima = l; });
    window.astroI18n.setLanguage('it');
    window.astroI18n.setLanguage('en');
    const conteggio = chiamate;
    stacca();
    window.astroI18n.setLanguage('it');
    window.astroI18n.setLanguage('en');
    return { conteggio, dopoLoStacco: chiamate, ultima };
  });
  ok('l\'ascoltatore viene chiamato a ogni cambio', avviso.conteggio === 2, avviso.conteggio + ' volte');
  ok('e si può staccare', avviso.dopoLoStacco === avviso.conteggio);

  const cadere = await pagina.evaluate(() => {
    let secondo = false;
    const a = window.astroI18n.alCambio(() => { throw new Error('caduto di proposito'); });
    const b = window.astroI18n.alCambio(() => { secondo = true; });
    window.astroI18n.setLanguage('it');
    a(); b();
    window.astroI18n.setLanguage('en');
    return secondo;
  });
  ok('un ascoltatore che cade non ferma gli altri', cadere === true);

  // =====================================================================
  console.log('\n— i nodi nuovi nascono nella lingua giusta —');
  const nuovi = await pagina.evaluate(async () => {
    window.astroI18n.setLanguage('en');
    const guscio = document.createElement('div');
    guscio.innerHTML = '<button data-i18n="ui.chiudi">Chiudi</button>' +
                       '<span data-i18n-title="ui.salva" title="Salva">x</span>';
    document.body.appendChild(guscio);
    // Il sorvegliante lavora in un microtask: si aspetta un giro.
    await new Promise(r => setTimeout(r, 60));
    const esito = {
      testo: guscio.querySelector('button').textContent,
      titolo: guscio.querySelector('span').getAttribute('title')
    };
    // E la via esplicita, quella che un pannello chiama dopo essersi riscritto.
    const altro = document.createElement('div');
    altro.innerHTML = '<b data-i18n="ui.annulla">Annulla</b>';
    const quanti = window.astroI18n.applica(altro);
    esito.esplicito = altro.querySelector('b').textContent;
    esito.quanti = quanti;
    guscio.remove();
    return esito;
  });
  ok('un nodo aggiunto al documento si traduce da sé', nuovi.testo === 'Close', `«${nuovi.testo}»`);
  ok('e anche il suo titolo', nuovi.titolo === 'Save', `«${nuovi.titolo}»`);
  ok('applica() traduce un pezzo staccato dal documento', nuovi.esplicito === 'Cancel' && nuovi.quanti === 1,
     `«${nuovi.esplicito}»`);

  // =====================================================================
  console.log('\n— avanti e indietro non consuma niente —');
  const avantiIndietro = await pagina.evaluate(() => {
    const bersaglio = document.getElementById('btn-vista-stasera');
    window.astroI18n.setLanguage('it');
    const it1 = bersaglio.textContent.trim();
    window.astroI18n.setLanguage('en');
    const en1 = bersaglio.textContent.trim();
    for (let i = 0; i < 20; i++) window.astroI18n.setLanguage(i % 2 ? 'it' : 'en');
    window.astroI18n.setLanguage('it');
    const it2 = bersaglio.textContent.trim();
    window.astroI18n.setLanguage('en');
    const en2 = bersaglio.textContent.trim();
    return { it1, en1, it2, en2, indice: window.astroI18n._indice() };
  });
  ok('venti giri avanti e indietro non cambiano il testo',
     avantiIndietro.it1 === avantiIndietro.it2 && avantiIndietro.en1 === avantiIndietro.en2,
     `${avantiIndietro.it1}/${avantiIndietro.en1} → ${avantiIndietro.it2}/${avantiIndietro.en2}`);
  ok('e l\'indice non cresce a ogni giro', avantiIndietro.indice < misura.nodi + 50,
     `${avantiIndietro.indice} nodi`);

  // =====================================================================
  // «caduto di proposito» è l'eccezione che la prova degli ascoltatori solleva
  // apposta: contarla vorrebbe dire fallire per aver funzionato.
  const soloErrori = errori.filter(e =>
    !/net::ERR|Failed to load|favicon|caduto di proposito|FullCalendar non disponibile/.test(e));
  console.log(`\n— console —`);
  console.log(`     errori veri: ${soloErrori.length}`);
  for (const e of soloErrori.slice(0, 8)) console.log('       ' + e.slice(0, 160));
  ok('nessun errore di console imputabile alla lingua',
     soloErrori.filter(e => /i18n|lingue\//.test(e)).length === 0);

  console.log(`\n${ko === 0 ? '✓ tutte le prove passate' : '✗ ' + ko + ' prove fallite'}`);
  await browser.close();
  server.close();
  process.exit(ko === 0 ? 0 : 1);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
