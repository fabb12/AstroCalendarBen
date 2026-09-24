/* La guida all'uso, e la porta che la apre.
 *
 *   npm install playwright-core astronomy-engine
 *   node scripts/prova-guida.js
 *
 * Perché serve una prova per un link. Un `<a href>` sbagliato non fallisce:
 * porta a una pagina che non c'è, e in una PWA installata quella è una
 * schermata bianca senza nemmeno il 404 del browser a spiegarlo. Lo stesso
 * vale per le cinque scorciatoie, che puntano agli **ancoraggi** delle sezioni
 * della guida (`#primi`, `#viste`, `#missione`, `#guai`, `#glossario`): il
 * giorno che qualcuno rinomina una sezione là dentro, quei tasti smettono di
 * portare da qualche parte e continuano a sembrare tasti. Qui si controlla che
 * ogni ancoraggio linkato esista davvero nel documento che dice di aprire.
 *
 * E poi la geometria, che è l'altra cosa che a occhio si giudica male: le
 * linguette delle impostazioni sono diventate cinque, e la finestra su un
 * telefono da 360 è stretta. Una pillola che sborda dal pannello non si vede
 * finché non la si va a cercare proprio a quella larghezza — le prove degli
 * altri banchi girano a 900, dove tutto ci sta. */

const { chromium } = require('playwright-core');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const MISURE = [
  { nome: 'telefono', width: 360, height: 640 },
  { nome: 'computer', width: 1280, height: 900 }
];

let falliti = 0;
function ok(nome, condizione, extra) {
  console.log(`  ${condizione ? 'ok      ' : 'FALLITA '} ${nome}${extra ? '   — ' + extra : ''}`);
  if (!condizione) falliti++;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium'
  });

  for (const misura of MISURE) {
    const pagina = await browser.newPage({ viewport: { width: misura.width, height: misura.height } });
    // Le prove che non parlano di lingua la lingua la fissano: le attese qui
    // sotto sono in italiano, e su una macchina di CI arriverebbe l'inglese.
    await pagina.addInitScript(() => { try { localStorage.astrocal_lingua = 'it'; } catch (e) {} });
    await pagina.goto('file://' + path.join(RADICE, 'index.html'));
    await pagina.waitForTimeout(1800);
    console.log(`\n— ${misura.nome} (${misura.width}×${misura.height}) —`);

    await pagina.click('#btn-impostazioni');
    await pagina.waitForTimeout(400);
    ok('la finestra delle impostazioni si apre',
      !(await pagina.locator('#modale-impostazioni').getAttribute('class')).includes('hidden'));

    const linguette = await pagina.locator('[data-imp-tab]').count();
    ok('le linguette sono cinque (con Demo e Guida)', linguette === 5, String(linguette));
    ok('il profilo manuale degli ostacoli non compare più nelle impostazioni',
      await pagina.locator('#imp-orizzonte').count() === 0);

    // La barra delle linguette ha `overflow-x: auto`: su un telefono la quarta
    // sta fuori dallo schermo e va raggiunta, non data per visibile.
    await pagina.locator('#imp-tab-btn-guida').scrollIntoViewIfNeeded();
    await pagina.click('#imp-tab-btn-guida');
    await pagina.waitForTimeout(250);

    const pannello = pagina.locator('#imp-tab-guida');
    ok('il pannello Guida compare', await pannello.isVisible());
    ok('gli altri tre si chiudono',
      !(await pagina.locator('#imp-tab-dati').isVisible())
      && !(await pagina.locator('#imp-tab-osservazione').isVisible())
      && !(await pagina.locator('#imp-tab-planetario').isVisible()));
    ok('la linguetta si segna attiva per chi legge con lo schermo',
      (await pagina.locator('#imp-tab-btn-guida').getAttribute('aria-selected')) === 'true');

    const href = await pagina.locator('#imp-btn-guida').getAttribute('href');
    ok('il tasto punta a guida.html', href === 'guida.html', String(href));
    ok('si apre in una scheda nuova, senza prestare la finestra',
      (await pagina.locator('#imp-btn-guida').getAttribute('target')) === '_blank'
      && (await pagina.locator('#imp-btn-guida').getAttribute('rel')) === 'noopener');

    // Gli ancoraggi che le scorciatoie promettono di raggiungere.
    const promesse = await pagina.locator('#imp-tab-guida a[href^="guida.html#"]')
      .evaluateAll(nodi => nodi.map(a => a.getAttribute('href').split('#')[1]));
    ok('ci sono le scorciatoie alle sezioni, demo comprese', promesse.length === 6 && promesse.includes('demo'),
      promesse.join(', '));

    // Nessun tasto deve sbordare: la riga va a capo, non fuori.
    const fuori = await pannello.evaluate(el => {
      const suo = el.getBoundingClientRect();
      return [...el.querySelectorAll('a')].filter(a => {
        const r = a.getBoundingClientRect();
        return r.right > suo.right + 1 || r.left < suo.left - 1;
      }).length;
    });
    ok('nessun tasto sborda dal pannello', fuori === 0, fuori + ' fuori');

    // In inglese le stesse porte aprono la guida inglese, allo stesso capitolo.
    await pagina.evaluate(() => astroI18n.impostaLingua('en'));
    await pagina.waitForTimeout(200);
    const inglesi = await pagina.locator('#imp-tab-guida a[href^="guida"]')
      .evaluateAll(nodi => nodi.map(a => a.getAttribute('href')));
    ok('in inglese i link aprono guida-en.html',
      inglesi.length === 7 && inglesi.every(h => h.startsWith('guida-en.html')), inglesi.join(', '));
    ok('gli ancoraggi restano gli stessi',
      inglesi.filter(h => h.includes('#')).map(h => h.split('#')[1]).join() === promesse.join());
    await pagina.evaluate(() => astroI18n.impostaLingua('it'));
    await pagina.waitForTimeout(200);
    ok('tornando all\'italiano i link tornano a guida.html',
      (await pagina.locator('#imp-btn-guida').getAttribute('href')) === 'guida.html');

    // E adesso la guida vera e propria.
    await pagina.goto('file://' + path.join(RADICE, 'guida.html'));
    await pagina.waitForTimeout(700);
    ok('la guida si apre', (await pagina.title()).includes('Guida'), await pagina.title());
    ok('la guida non propone più di dichiarare gli ostacoli',
      !(await pagina.locator('body').innerText()).includes('Dichiara cosa hai davanti'));

    const testoGuida = await pagina.locator('body').innerText();
    const riferimentiInterni = ['Nel codice', 'localStorage', 'service worker'];
    const riferimentiPresenti = riferimentiInterni.filter(testo => testoGuida.includes(testo));
    ok('la guida parla all\'utente senza nomi interni del codice',
      riferimentiPresenti.length === 0, riferimentiPresenti.join(', ') || 'nessuno');

    const mancanti = await pagina.evaluate(
      ids => ids.filter(id => !document.getElementById(id)), promesse);
    ok('ogni ancoraggio linkato dalle impostazioni esiste davvero',
      mancanti.length === 0, mancanti.join(', ') || 'nessuno mancante');

    ok('il ritorno all\'app c\'è',
      (await pagina.locator('a.tasto-ritorno').getAttribute('href')) === 'index.html');

    const sborda = await pagina.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    ok('la pagina non scorre di lato', !sborda);

    // L'indice è l'unico modo di muoversi in un documento lungo: se una sua
    // voce punta a un ancoraggio che non c'è, il tasto non fa niente e sembra
    // un difetto del telefono.
    const rotte = await pagina.evaluate(() =>
      [...document.querySelectorAll('.indice a[href^="#"]')]
        .map(a => a.getAttribute('href').slice(1))
        .filter(id => !document.getElementById(id)));
    ok('nessuna voce dell\'indice punta nel vuoto', rotte.length === 0, rotte.join(', ') || 'tutte buone');

    ok('la guida italiana porta a quella inglese',
      (await pagina.locator('.barra-ritorno a[href="guida-en.html"]').count()) === 1);
    const idItaliani = await pagina.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id));
    ok('il capitolo sulle demo c\'è', idItaliani.includes('demo'));

    // La guida inglese: stessi capitoli, nessun testo italiano rimasto.
    await pagina.goto('file://' + path.join(RADICE, 'guida-en.html'));
    await pagina.waitForTimeout(500);
    ok('la guida inglese si apre', (await pagina.title()).includes('User guide'), await pagina.title());
    ok('la guida inglese dichiara la sua lingua',
      (await pagina.evaluate(() => document.documentElement.lang)) === 'en');
    const idInglesi = await pagina.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id));
    ok('stessi ancoraggi nelle due lingue', idInglesi.join() === idItaliani.join(),
      idInglesi.filter(i => !idItaliani.includes(i)).concat(idItaliani.filter(i => !idInglesi.includes(i))).join(', ') || 'uguali');
    ok('ogni ancoraggio delle impostazioni esiste anche in inglese',
      promesse.every(id => idInglesi.includes(id)));
    // Le parole funzionali italiane non compaiono per caso in un testo
    // inglese: se ce n'è una, è una frase rimasta indietro. Il codice degli
    // esempi (nomi di demo, identificatori) e il nome dell'app non contano.
    const residui = await pagina.evaluate(() => {
      const copia = document.body.cloneNode(true);
      copia.querySelectorAll('code, pre, [lang="it"]').forEach(n => n.remove());
      const testo = copia.innerText.replace(/AstroCalendario di Ben/g, '');
      const spia = ['il', 'lo', 'gli', 'della', 'delle', 'degli', 'che', 'con', 'una', 'sono',
        'nel', 'nella', 'sul', 'alla', 'anche', 'quando', 'dove', 'perché', 'questo', 'questa', 'ogni',
        'cielo', 'stelle', 'tutto', 'oppure', 'fra', 'sotto', 'sopra', 'viene', 'tasto', 'scheda',
        'capitolo', 'pianeti', 'notte', 'sera', 'qui', 'già', 'poi', 'così', 'è', 'più'];
      const parole = testo.split(/[^A-Za-zÀ-ÿ']+/);
      return [...new Set(parole.filter(p => spia.includes(p.toLowerCase())))];
    });
    ok('nessuna parola italiana rimasta nella guida inglese', residui.length === 0, residui.join(', ') || 'nessuna');
    const rotteEn = await pagina.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map(a => a.getAttribute('href').slice(1))
        .filter(id => id && !document.getElementById(id)));
    ok('nessun link interno della guida inglese punta nel vuoto', rotteEn.length === 0, rotteEn.join(', ') || 'tutti buoni');
    ok('la guida inglese non scorre di lato', !(await pagina.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)));
    ok('la guida inglese porta a quella italiana',
      (await pagina.locator('.barra-ritorno a[href="guida.html"]').count()) === 1);

    await pagina.close();
  }

  await browser.close();
  console.log(falliti === 0 ? '\n✓ tutte le prove passate' : `\n✗ ${falliti} prove fallite`);
  process.exit(falliti === 0 ? 0 : 1);
})();
