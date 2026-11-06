/* Gli account con approvazione (`accessi.js`, Supabase).
 *
 *   npm install playwright-core
 *   node scripts/prova-accessi.js
 *
 * Non si tocca il progetto Supabase vero: crearci utenti di prova vorrebbe
 * dire sporcarlo (e con la conferma email accesa mandare posta a indirizzi
 * finti, cosa che Supabase punisce bloccando l'invio). Al posto della
 * libreria dal CDN si serve un Supabase finto, in memoria nel browser, che
 * imita le API usate da `accessi.js` **e** le regole di `supabase/accessi.sql`:
 * il profilo nasce in attesa, l'email dell'amministratore nasce approvata, un
 * utente legge solo il suo profilo e non lo cambia, l'amministratore li legge
 * e cambia tutti. Lo stato del finto sta in `localStorage`, così sopravvive
 * ai ricaricamenti come la sessione vera.
 *
 * Il giro: iscrizione dell'amministratore → app aperta → iscrizione di un
 * utente → pagina «in attesa» → l'amministratore lo vede nel pannello, lo
 * approva e gli toglie il Planetario e la Demo → l'utente entra e non le
 * vede, e il planetario non si apre → sospeso → pagina «sospeso». Più errori
 * di password, email doppia, e le schermate a computer e telefono in
 * SCHERMATE=<cartella>. */

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const SCHERMATE = process.env.SCHERMATE || '';
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };

let falliti = 0;
function ok(nome, condizione, extra) {
  console.log(`  ${condizione ? 'ok      ' : 'FALLITA '} ${nome}${extra ? '   — ' + extra : ''}`);
  if (!condizione) falliti++;
}

// Il Supabase finto: gira nella pagina, al posto di supabase-js
const FINTO = `(() => {
  const EMAIL_ADMIN = 'admin@prova.it';
  const DB = 'finto_supabase', SES = 'finto_supabase_sessione';
  const leggi = () => JSON.parse(localStorage.getItem(DB) || '{"utenti":[],"profili":[]}');
  const scrivi = d => localStorage.setItem(DB, JSON.stringify(d));
  const sessione = () => JSON.parse(localStorage.getItem(SES) || 'null');
  const ascolta = new Set();
  const avvisa = (ev, s) => ascolta.forEach(f => f(ev, s));
  const pausa = () => new Promise(r => setTimeout(r, 20));
  const uuid = () => 'u' + Math.random().toString(36).slice(2, 10);
  function apri(utente) {
    const s = { access_token: 'tok', user: { id: utente.id, email: utente.email } };
    localStorage.setItem(SES, JSON.stringify(s));
    avvisa('SIGNED_IN', s);
    return s;
  }
  const auth = {
    async getSession() { await pausa(); return { data: { session: sessione() }, error: null }; },
    onAuthStateChange(f) { ascolta.add(f); setTimeout(() => f('INITIAL_SESSION', sessione()), 0); return { data: { subscription: { unsubscribe() { ascolta.delete(f); } } } }; },
    async signUp({ email, password, options }) {
      await pausa();
      const d = leggi();
      if (d.utenti.some(u => u.email === email)) return { data: {}, error: { code: 'user_already_exists', message: 'User already registered' } };
      if (password.length < 6) return { data: {}, error: { code: 'weak_password', message: 'Password should be at least 6 characters' } };
      const u = { id: uuid(), email, password };
      d.utenti.push(u);
      const admin = email === EMAIL_ADMIN;
      d.profili.push({ id: u.id, email, nome: (options && options.data && options.data.nome) || null,
        stato: admin ? 'approvato' : 'in_attesa', ruolo: admin ? 'admin' : 'utente',
        sezioni: ['stasera', 'calendario', 'cielo', 'telescopio', 'didattica', 'demo'],
        creato: new Date(Date.now() - d.profili.length * 86400000).toISOString() });
      scrivi(d);
      const s = apri(u);
      return { data: { user: s.user, session: s }, error: null };
    },
    async signInWithPassword({ email, password }) {
      await pausa();
      const u = leggi().utenti.find(x => x.email === email && x.password === password);
      if (!u) return { data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } };
      const s = apri(u);
      return { data: { session: s, user: s.user }, error: null };
    },
    async signOut() { localStorage.removeItem(SES); avvisa('SIGNED_OUT', null); return { error: null }; },
    async updateUser({ password }) {
      const s = sessione(); const d = leggi(); const u = d.utenti.find(x => s && x.id === s.user.id);
      if (!u) return { error: { message: 'not logged in' } };
      if (u.password === password) return { error: { code: 'same_password', message: 'New password should be different' } };
      u.password = password; scrivi(d); avvisa('USER_UPDATED', s); return { data: { user: s.user }, error: null };
    },
    async resetPasswordForEmail() { await pausa(); return { data: {}, error: null }; }
  };
  function io() { const s = sessione(); return s ? leggi().profili.find(p => p.id === s.user.id) : null; }
  const eAdmin = () => { const p = io(); return !!(p && p.ruolo === 'admin' && p.stato === 'approvato'); };
  function from() {
    const q = { filtri: [], cambi: null, uno: false, ordine: null };
    const esegui = async () => {
      await pausa();
      const s = sessione();
      if (!s) return { data: q.uno ? null : [], error: null };
      const d = leggi();
      let righe = d.profili.filter(p => p.id === s.user.id || eAdmin());   // regola «leggere»
      for (const [c, v] of q.filtri) righe = righe.filter(r => r[c] === v);
      if (q.cambi) {
        if (!eAdmin()) righe = [];                                          // regola «cambiare»
        righe.forEach(r => Object.assign(r, q.cambi));
        scrivi(d);
      }
      if (q.ordine) righe.sort((a, b) => (a[q.ordine] < b[q.ordine] ? 1 : -1));
      righe = JSON.parse(JSON.stringify(righe));
      return { data: q.uno ? (righe[0] || null) : righe, error: null };
    };
    const b = {
      select() { return b; }, eq(c, v) { q.filtri.push([c, v]); return b; },
      order(c) { q.ordine = c; return b; }, update(o) { q.cambi = o; return b; },
      maybeSingle() { q.uno = true; return esegui(); },
      then(a, r) { return esegui().then(a, r); }
    };
    return b;
  }
  async function rpc(nome, { utente }) {
    await pausa();
    if (nome !== 'elimina_account' || !eAdmin()) return { error: { message: 'permesso' } };
    const d = leggi(); d.utenti = d.utenti.filter(u => u.id !== utente); d.profili = d.profili.filter(p => p.id !== utente); scrivi(d);
    return { data: null, error: null };
  }
  window.supabase = { createClient: () => ({ auth, from, rpc }) };
})();`;

(async () => {
  const server = http.createServer((rq, rs) => {
    const file = path.join(RADICE, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(rs);
  }).listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: 'it-IT', deviceScaleFactor: SCHERMATE ? 2 : 1 });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('astrocal_lingua')) localStorage.setItem('astrocal_lingua', 'it'); } catch (_) {} });
  // Playwright prova per prima l'ultima rotta registrata: la rete esterna
  // spenta va per prima, le due sostituzioni dopo
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 200, body: '' }));
  await ctx.route(/supabase-js@[^/]+\/dist\/umd\/supabase\.js/, r => r.fulfill({ contentType: 'text/javascript', body: FINTO }));
  await ctx.route(/\/accessi-config\.js$/, r => r.fulfill({ contentType: 'text/javascript',
    body: "window.ASTROCAL_ACCESSI = { url: 'https://finto.supabase.co', chiave: 'sb_publishable_finto', forza: true };" }));
  const p = await ctx.newPage();
  const errori = [];
  p.on('pageerror', e => errori.push(e.message));
  const foto = async nome => { if (SCHERMATE) await p.screenshot({ path: path.join(SCHERMATE, nome + '.png') }); };
  const modo = () => p.$eval('#accessi-velo', v => v.dataset.modo).catch(() => null);
  const messaggio = m => p.textContent(`#accessi-velo [data-modo="${m}"] .acc-messaggio`);
  const attendiFine = m => p.waitForFunction(m => { const b = document.querySelector(`#accessi-velo [data-modo="${m}"] .acc-primario`); return !b || !b.disabled; }, m);
  const accedi = async (email, password) => {
    await p.fill('#acc-email', email); await p.fill('#acc-password', password);
    await p.click('#accessi-velo form[data-modo="accedi"] .acc-primario');
    await p.waitForTimeout(250); await attendiFine('accedi');
  };
  const iscrivi = async (nome, email, pw, conferma = pw) => {
    await p.fill('#acc-nuovo-nome', nome); await p.fill('#acc-nuova-email', email);
    await p.fill('#acc-nuova-password', pw); await p.fill('#acc-conferma', conferma);
    await p.click('#accessi-velo form[data-modo="registra"] .acc-primario');
    await p.waitForTimeout(250); await attendiFine('registra');
  };
  const esci = async () => { await p.evaluate(() => astroAccessi.esci()); await p.waitForSelector('#accessi-velo'); };
  const sbloccata = () => p.evaluate(() => !document.documentElement.classList.contains('accessi-bloccato') && !document.getElementById('accessi-velo'));

  console.log('Gli account con approvazione');
  await p.goto(base + '/index.html');
  await p.waitForSelector('#accessi-velo');
  ok('all\'avvio il velo chiede l\'accesso', await modo() === 'accedi');
  ok('l\'app sotto è nascosta', await p.evaluate(() => getComputedStyle(document.querySelector('main')).visibility === 'hidden'));
  await foto('1-accedi');

  await p.click('#accessi-velo [data-vai="registra"]');
  ok('«Crea un account» porta al modulo d\'iscrizione', await modo() === 'registra');
  await iscrivi('Ben', 'admin@prova.it', 'corta1');
  ok('password corta rifiutata', (await messaggio('registra')).includes('8 caratteri'));
  await iscrivi('Ben', 'non-una-email', 'carpeDiem12');
  ok('email non valida rifiutata', (await messaggio('registra')).includes('email valido'));
  await iscrivi('Ben', 'admin@prova.it', 'carpeDiem12', 'carpeDiem13');
  ok('conferma diversa rifiutata', (await messaggio('registra')).includes('non coincidono'));
  await p.fill('#acc-nuova-password', 'carpeDiem12');
  ok('indicatore di forza della password', Number(await p.$eval('.acc-forza', f => f.dataset.forza)) >= 2);
  await foto('2-registra');
  await iscrivi('Ben Amministratore', 'admin@prova.it', 'carpeDiem12');
  await p.waitForSelector('#accessi-velo', { state: 'detached' });
  ok('l\'amministratore entra subito', await sbloccata() && await p.evaluate(() => astroAccessi.eAdmin()));
  ok('tasto Account in testata', await p.isVisible('#btn-account'));

  await esci();
  await p.click('#accessi-velo [data-vai="registra"]');
  await iscrivi('Luna Rossi', 'luna@prova.it', 'pianeti99');
  ok('il nuovo utente vede «in attesa di approvazione»', await modo() === 'stato' && (await p.textContent('#accessi-velo')).includes('in attesa di approvazione'));
  ok('…e non l\'app', !(await sbloccata()));
  await foto('3-in-attesa');
  await p.click('#accessi-velo [data-azione="ricontrolla"]');
  await p.waitForTimeout(300);
  ok('«Controlla di nuovo» dice che è ancora in attesa', (await messaggio('stato')).includes('Ancora in attesa'));
  ok('un utente non può approvarsi da solo', (await p.evaluate(() => astroAccessi.aggiornaUtente(astroAccessi.utente.id, { stato: 'approvato' }))).errore === 'accessi.err.permesso');

  await p.click('#accessi-velo [data-azione="esci"]');
  await p.waitForFunction(() => document.querySelector('#accessi-velo') && document.querySelector('#accessi-velo').dataset.modo === 'accedi');
  await p.click('#accessi-velo [data-vai="registra"]');
  await iscrivi('Altro', 'luna@prova.it', 'pianeti99');
  ok('email già iscritta rifiutata', (await messaggio('registra')).includes('Esiste già'));
  await p.click('#accessi-velo form[data-modo="registra"] [data-vai="accedi"]');
  await accedi('admin@prova.it', 'sbagliata1');
  ok('password sbagliata: messaggio chiaro', (await messaggio('accedi')).includes('non corretti'));

  await accedi('admin@prova.it', 'carpeDiem12');
  await p.waitForSelector('#accessi-velo', { state: 'detached' });
  await p.waitForFunction(() => document.querySelector('#btn-account .acc-bollo'));
  ok('il tasto Account segna 1 iscrizione in attesa', (await p.textContent('#btn-account .acc-bollo')) === '1');
  await p.click('#btn-account');
  await p.waitForSelector('#accessi-account');
  await foto('4-account-admin');
  await p.click('#accessi-account [data-azione="gestisci"]');
  await p.waitForSelector('#accessi-gestione .acc-utente');
  ok('il pannello apre sulle iscrizioni in attesa', (await p.$$eval('#accessi-gestione .acc-utente', r => r.length)) === 1 &&
    (await p.textContent('#accessi-gestione .acc-utente')).includes('luna@prova.it'));
  await foto('5-gestione-attesa');
  await p.click('#accessi-gestione .acc-utente [data-azione="approva"]');
  await p.waitForTimeout(250);
  await p.click('#accessi-gestione .acc-filtro[data-filtro="tutti"]');
  ok('dopo l\'approvazione nessuno è in attesa', !(await p.$('#btn-account .acc-bollo')));
  const rigaLuna = '#accessi-gestione .acc-utente:has-text("luna@prova.it")';
  await p.click(`${rigaLuna} [data-azione="apri"]`);
  await p.click(`${rigaLuna} label:has([data-sezione="cielo"])`); await p.waitForTimeout(250);
  await p.click(`${rigaLuna} label:has([data-sezione="demo"])`); await p.waitForTimeout(250);
  await foto('6-gestione-sezioni');
  const sezioni = await p.evaluate(async () => (await astroAccessi.elencoUtenti()).utenti.find(u => u.email === 'luna@prova.it').sezioni);
  ok('le sezioni si salvano subito', JSON.stringify(sezioni) === JSON.stringify(['stasera', 'calendario', 'telescopio', 'didattica']), JSON.stringify(sezioni));
  ok('l\'amministratore non può sospendere se stesso', (await p.evaluate(() => astroAccessi.aggiornaUtente(astroAccessi.utente.id, { stato: 'sospeso' }))).errore === 'accessi.err.se-stesso');
  await p.keyboard.press('Escape');

  await esci();
  await accedi('luna@prova.it', 'pianeti99');
  await p.waitForSelector('#accessi-velo', { state: 'detached' });
  ok('approvata, Luna entra', await sbloccata());
  ok('Planetario e Demo non sono nel menu', await p.evaluate(() =>
    getComputedStyle(document.getElementById('btn-vista-skymap')).display === 'none' &&
    getComputedStyle(document.getElementById('btn-vista-demo')).display === 'none' &&
    getComputedStyle(document.getElementById('btn-vista-telescopio')).display !== 'none'));
  ok('il planetario non si apre neanche chiamandolo', await p.evaluate(() => { mostraVista('cielo'); return vistaAttuale !== 'cielo'; }));
  ok('Luna non vede «Gestisci utenti»', await p.evaluate(() => { astroAccessi.apriAccount(); const s = !document.querySelector('#accessi-account [data-azione="gestisci"]'); document.getElementById('accessi-account').remove(); return s; }));

  await p.reload();
  await p.waitForTimeout(800);
  ok('ricaricando la sessione resta', await sbloccata());

  await esci();
  await accedi('admin@prova.it', 'carpeDiem12');
  await p.waitForSelector('#accessi-velo', { state: 'detached' });
  await p.evaluate(async () => { const u = (await astroAccessi.elencoUtenti()).utenti.find(x => x.email === 'luna@prova.it'); await astroAccessi.aggiornaUtente(u.id, { stato: 'sospeso' }); });
  await esci();
  await accedi('luna@prova.it', 'pianeti99');
  ok('sospesa, Luna vede «Account sospeso»', await modo() === 'stato' && (await p.textContent('#accessi-velo')).includes('Account sospeso'));

  await p.click('#accessi-velo [data-azione="esci"]');
  await p.waitForFunction(() => document.querySelector('#accessi-velo') && document.querySelector('#accessi-velo').dataset.modo === 'accedi');
  await p.click('#accessi-velo [data-vai="recupera"]');
  await p.fill('#acc-recupera-email', 'luna@prova.it');
  await p.click('#accessi-velo form[data-modo="recupera"] .acc-primario');
  await p.waitForTimeout(250);
  ok('«Password dimenticata?» manda il link', (await messaggio('recupera')).includes('link'));

  await p.setViewportSize({ width: 390, height: 844 });
  await p.click('#accessi-velo form[data-modo="recupera"] [data-vai="accedi"]');
  ok('al telefono la scheda sta nello schermo', await p.$eval('.acc-scheda', s => { const r = s.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  ok('al telefono la vetrina si nasconde', await p.$eval('.acc-vetrina', v => getComputedStyle(v).display === 'none'));
  await foto('7-telefono');
  await accedi('admin@prova.it', 'carpeDiem12');
  await p.waitForSelector('#accessi-velo', { state: 'detached' });
  await p.evaluate(() => astroAccessi.apriGestione());
  await p.waitForSelector('#accessi-gestione .acc-utente');
  ok('al telefono il pannello sta nello schermo', await p.$eval('.acc-finestra-gestione', f => { const r = f.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  await foto('8-telefono-gestione');

  ok('nessun errore della pagina dagli accessi', !errori.some(e => /accessi|acc-/i.test(e)), errori.join(' | '));
  await browser.close();
  server.close();
  console.log(falliti ? `\n${falliti} FALLITE` : '\nTutto verde.');
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
