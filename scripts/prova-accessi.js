/* Gli account e il velo d'accesso (`accessi.js`).
 *
 *   npm install playwright-core
 *   node scripts/prova-accessi.js
 *
 * Si serve la cartella con un server piccolo (Web Crypto vuole un contesto
 * sicuro, e localhost lo è) e si finge un browser non guidato: sotto
 * `navigator.webdriver` il velo non si mostra, apposta per le altre prove.
 * Il giro è quello di una persona: primo avvio → crea account → ricarica →
 * esci → cinque password sbagliate (blocco) → entra → cambia password →
 * la vecchia non vale più → un nome doppio è rifiutato. Le librerie da CDN si
 * rispondono vuote: il velo non ne ha bisogno. */

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };

let falliti = 0;
function ok(nome, condizione, extra) {
  console.log(`  ${condizione ? 'ok      ' : 'FALLITA '} ${nome}${extra ? '   — ' + extra : ''}`);
  if (!condizione) falliti++;
}

(async () => {
  const server = http.createServer((rq, rs) => {
    const file = path.join(RADICE, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(rs);
  }).listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'it-IT' });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    try { if (!localStorage.getItem('astrocal_lingua')) localStorage.setItem('astrocal_lingua', 'it'); } catch (_) {}
  });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  const errori = [];
  p.on('pageerror', e => errori.push(e.message));
  const errore = modo => p.textContent(`form[data-modo=${modo}] .accessi-errore`);
  const crea = async (nome, pw, conferma = pw) => {
    await p.fill('#accessi-nuovo-nome', nome); await p.fill('#accessi-nuova-password', pw); await p.fill('#accessi-conferma', conferma);
    await p.click('form[data-modo=registra] button[type=submit]');
  };
  const entra = async (nome, pw) => {
    await p.fill('#accessi-nome', nome); await p.fill('#accessi-password', pw);
    await p.click('form[data-modo=accedi] button[type=submit]');
    await p.waitForFunction(() => !document.querySelector('form[data-modo=accedi] button[aria-busy]'));
  };

  console.log('Gli account');
  await p.goto(base + '/index.html');
  await p.waitForSelector('#accessi-velo');
  ok('al primo avvio il velo apre «Crea account»', await p.$eval('#accessi-velo', v => v.dataset.modo) === 'registra');
  ok('l\'app sotto è nascosta', await p.evaluate(() => document.documentElement.classList.contains('accessi-bloccato') &&
    getComputedStyle(document.querySelector('main')).visibility === 'hidden'));
  await crea('ben', 'corta1');
  ok('password corta rifiutata', (await errore('registra')).includes('8 caratteri'));
  await crea('ben', 'stelle2026', 'stelle2027');
  ok('conferma diversa rifiutata', (await errore('registra')).includes('non coincidono'));
  await crea('ben', 'stelle2026');
  await p.waitForSelector('#accessi-velo', { state: 'detached' });
  ok('account creato, primo = amministratore', await p.evaluate(() => astroAccessi.utente.nome === 'ben' && astroAccessi.utente.ruolo === 'admin'));
  ok('la password non è salvata in chiaro', await p.evaluate(() => !localStorage.getItem('astrocal_account_v1').includes('stelle2026')));
  ok('tasto Account in testata', await p.isVisible('#btn-account'));

  await p.reload();
  await p.waitForTimeout(600);
  ok('ricaricando si resta dentro («Ricordami»)', !(await p.$('#accessi-velo')) && await p.evaluate(() => astroAccessi.autenticato()));

  await p.click('#btn-account');
  await p.waitForSelector('#accessi-account');
  await p.click('#accessi-esci');
  await p.waitForSelector('#accessi-velo');
  ok('«Esci» riporta al velo su «Accedi»', await p.$eval('#accessi-velo', v => v.dataset.modo) === 'accedi');

  await entra('nessuno', 'stelle2026');
  const msgIgnoto = await errore('accedi');
  await entra('ben', 'sbagliata1');
  ok('stesso messaggio per nome ignoto e password sbagliata', msgIgnoto === await errore('accedi'), msgIgnoto);
  for (let i = 0; i < 4; i++) await entra('ben', 'sbagliata1');
  await entra('ben', 'stelle2026');
  ok('dopo 5 errori l\'account si blocca', /Riprova fra \d+ secondi/.test(await errore('accedi')), await errore('accedi'));
  await p.evaluate(() => { const a = JSON.parse(localStorage.astrocal_account_v1); a[0].bloccatoFino = 0; localStorage.astrocal_account_v1 = JSON.stringify(a); });
  await entra('BEN', 'stelle2026');
  await p.waitForSelector('#accessi-velo', { state: 'detached' });
  ok('finito il blocco si entra (il nome non bada alle maiuscole)', await p.evaluate(() => astroAccessi.autenticato()));

  ok('cambio password', (await p.evaluate(() => astroAccessi.cambiaPassword('stelle2026', 'galassie42', 'galassie42'))).ok);
  await p.evaluate(() => astroAccessi.esci());
  ok('la vecchia password non vale più', (await p.evaluate(() => astroAccessi.accedi('ben', 'stelle2026', false))).errore === 'accessi.err.credenziali');
  ok('la nuova sì', (await p.evaluate(() => astroAccessi.accedi('ben', 'galassie42', false))).ok);
  ok('senza «Ricordami» la sessione sta in sessionStorage', await p.evaluate(() => !!sessionStorage.getItem('astrocal_sessione_v1') && !localStorage.getItem('astrocal_sessione_v1')));
  await p.evaluate(() => astroAccessi.esci());

  await p.click('.accessi-linguetta[data-modo=registra]');
  await crea('Ben', 'pianeti99');
  ok('un nome già usato è rifiutato', (await errore('registra')).includes('Esiste già'));
  await p.evaluate(() => astroAccessi.registra('luna', 'pianeti99', 'pianeti99', true));
  ok('il secondo account è un utente', await p.evaluate(() => astroAccessi.utente.ruolo === 'utente'));
  ok('una sessione falsificata non vale', await p.evaluate(() => {
    localStorage.setItem('astrocal_sessione_v1', JSON.stringify({ chiave: 'ben', gettone: 'falso', scade: Date.now() + 1e9 }));
    sessionStorage.clear();
    return true;
  }) && await p.reload().then(() => p.waitForSelector('#accessi-velo')).then(() => true));

  await p.setViewportSize({ width: 360, height: 640 });
  ok('al telefono la finestra sta nello schermo', await p.$eval('.accessi-finestra', f => { const r = f.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  ok('nessun errore della pagina dagli accessi', !errori.some(e => /accessi/i.test(e)), errori.join(' | '));

  await browser.close();
  server.close();
  console.log(falliti ? `\n${falliti} FALLITE` : '\nTutto verde.');
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
