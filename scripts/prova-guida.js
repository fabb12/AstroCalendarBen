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
 * linguette delle impostazioni sono diventate quattro, e la finestra su un
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
    ok('le linguette sono quattro', linguette === 4, String(linguette));
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
    ok('ci sono le scorciatoie alle sezioni', promesse.length === 5, String(promesse.length));

    // Nessun tasto deve sbordare: la riga va a capo, non fuori.
    const fuori = await pannello.evaluate(el => {
      const suo = el.getBoundingClientRect();
      return [...el.querySelectorAll('a')].filter(a => {
        const r = a.getBoundingClientRect();
        return r.right > suo.right + 1 || r.left < suo.left - 1;
      }).length;
    });
    ok('nessun tasto sborda dal pannello', fuori === 0, fuori + ' fuori');

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

    await pagina.close();
  }

  await browser.close();
  console.log(falliti === 0 ? '\n✓ tutte le prove passate' : `\n✗ ${falliti} prove fallite`);
  process.exit(falliti === 0 ? 0 : 1);
})();
