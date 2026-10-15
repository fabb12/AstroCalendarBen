#!/usr/bin/env node
/* Il controllo degli accessi (v504, `accessi.js` + `worker-accessi.js`):
 *
 *   node scripts/prova-accessi.js            (server e app nel browser)
 *   node scripts/prova-accessi.js --server   (solo il server, senza browser)
 *
 * Prima il **server**, chiamato direttamente con l'archivio in memoria e un
 * orologio che si sposta: il primo amministratore dalle variabili, l'ingresso
 * giusto e quelli sbagliati (con la pausa dopo cinque), un utente nuovo con
 * le sue funzioni, la sessione che scorre e quella che scade, le statistiche
 * sommate per giorno, la password cambiata e l'utente spento che escono da
 * tutti i dispositivi, l'ultimo amministratore che non si toglie, il CORS.
 *
 * Poi l'**app vera** in Chromium, con lo stesso server dietro alle rotte di
 * Playwright: spento non cambia niente; acceso c'è la porta, il nome
 * sbagliato si dice, quello giusto fa entrare e mostra solo le sezioni
 * dell'utente; **ricaricando si resta dentro** (anche senza rete); il tempo
 * nelle sezioni arriva al server; una sessione chiusa dall'amministratore fa
 * uscire; «Gestisci utenti» crea un utente con le sue funzioni e legge le
 * statistiche; al telefono la porta e l'elenco si leggono. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const radice = path.resolve(__dirname, '..');
const SOLO_SERVER = process.argv.includes('--server');
const ACCESSI_URL = 'https://accessi.prova.invalid';
const ENV = { ACCESSI_ADMIN_UTENTE: 'ben', ACCESSI_ADMIN_PASSWORD: 'stelle-polari', ACCESSI_MEMORIA: '1' };

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);

(async () => {
  const { creaServizio, archivioMemoria } = await import(pathToFileURL(path.join(radice, 'worker-accessi.js')).href);
  const orologio = { spostamento: 0 };
  const ora = () => Date.now() + orologio.spostamento;
  let servizio = creaServizio({ archivio: archivioMemoria(), ora });

  const chiama = async (via, { metodo = 'GET', corpo, gettone, origine, env = ENV, ip } = {}) => {
    const h = {};
    if (gettone) h.Authorization = 'Bearer ' + gettone;
    if (origine) h.Origin = origine;
    if (ip) h['x-forwarded-for'] = ip;
    const r = await servizio.fetch(new Request('https://accessi.prova' + via, {
      method: metodo, headers: h, body: corpo === undefined ? undefined : JSON.stringify(corpo)
    }), env);
    let dati = null;
    try { dati = await r.json(); } catch (_) { dati = null; }
    return { stato: r.status, dati, intest: r.headers };
  };
  const entra = (utente, password, ip) => chiama('/api/accessi/entra', { metodo: 'POST', corpo: { utente, password, dispositivo: 'prova' }, ip });

  // ---------------------------------------------------------------- server
  let admin = '', luca = '';
  prova('server: senza archivio non fa entrare nessuno, e lo dice', async () => {
    const vuoto = creaServizio({});
    const s = await vuoto.fetch(new Request('https://a/api/accessi/stato'), { ACCESSI_ADMIN_UTENTE: 'ben', ACCESSI_ADMIN_PASSWORD: 'stelle-polari' });
    assert.equal((await s.json()).pronto, false);
    const e = await vuoto.fetch(new Request('https://a/api/accessi/entra', { method: 'POST', body: '{"utente":"ben","password":"stelle-polari"}' }), {});
    assert.equal(e.status, 503);
    const st = await chiama('/api/accessi/stato');
    assert.equal(st.dati.pronto, true);
    assert.equal(st.dati.archivio, 'memoria');
  });

  prova('server: il primo amministratore dalle variabili; password e nome sbagliati costano uguale', async () => {
    const ok = await entra('BEN', 'stelle-polari');
    assert.equal(ok.stato, 200);
    assert.equal(ok.dati.profilo.ruolo, 'admin');
    assert.deepEqual(ok.dati.profilo.funzioni, ['*']);
    assert.ok(ok.dati.gettone.length >= 40);
    admin = ok.dati.gettone;
    assert.equal((await entra('ben', 'sbagliata!')).stato, 401);
    assert.equal((await entra('nessuno', 'sbagliata!')).dati.errore, 'credenziali');
    // la variabile non riscrive una password cambiata: si cambia, si riavvia
    const cambio = await chiama('/api/accessi/password', { metodo: 'POST', gettone: admin, corpo: { vecchia: 'stelle-polari', nuova: 'stelle-polari-2' } });
    assert.equal(cambio.stato, 200);
    assert.equal((await chiama('/api/accessi/sessione', { gettone: admin })).stato, 200, 'la propria sessione resta');
    const ok2 = await entra('ben', 'stelle-polari-2');
    assert.equal(ok2.stato, 200);
    admin = ok2.dati.gettone;
  });

  prova('server: cinque tentativi sbagliati e quell\'utente aspetta un quarto d\'ora', async () => {
    const p = await chiama('/api/accessi/utenti', { metodo: 'POST', gettone: admin, corpo: { utente: 'mira', password: 'giusta-giusta', funzioni: ['*'] } });
    assert.equal(p.stato, 201);
    for (let i = 0; i < 5; i++) assert.equal((await entra('mira', 'no-no-no-no', '10.0.0.' + i)).stato, 401);
    const b = await entra('mira', 'giusta-giusta', '10.0.0.9');
    assert.equal(b.stato, 429);
    assert.equal(b.dati.errore, 'bloccato');
    orologio.spostamento += 16 * 60000;
    assert.equal((await entra('mira', 'giusta-giusta')).stato, 200);
  });

  prova('server: l\'amministratore crea un utente con le sue funzioni; i doppioni e le password corte no', async () => {
    const c = await chiama('/api/accessi/utenti', { metodo: 'POST', gettone: admin,
      corpo: { utente: 'Luca', nome: 'Luca R.', password: 'orione-123', funzioni: ['vista:cielo', 'sistema3d', 'VISTA:CIELO', 'brutto nome!'] } });
    assert.equal(c.stato, 201);
    assert.deepEqual(c.dati.utente.funzioni, ['vista:cielo', 'sistema3d']);
    assert.equal(c.dati.utente.ruolo, 'utente');
    assert.equal((await chiama('/api/accessi/utenti', { metodo: 'POST', gettone: admin, corpo: { utente: 'luca', password: 'orione-123' } })).stato, 409);
    assert.equal((await chiama('/api/accessi/utenti', { metodo: 'POST', gettone: admin, corpo: { utente: 'pia', password: 'corta' } })).dati.errore, 'password');
    assert.equal((await chiama('/api/accessi/utenti', { metodo: 'POST', gettone: admin, corpo: { utente: 'x', password: 'abbastanza' } })).dati.errore, 'utente');
    const e = await entra('luca', 'orione-123');
    assert.equal(e.stato, 200);
    luca = e.dati.gettone;
    assert.deepEqual(e.dati.profilo.funzioni, ['vista:cielo', 'sistema3d']);
    assert.equal((await chiama('/api/accessi/utenti', { gettone: luca })).stato, 403, 'un utente non amministra');
  });

  prova('server: la sessione scorre a ogni verifica e scade dopo trenta giorni fermi', async () => {
    orologio.spostamento += 20 * 86400000;
    const v = await chiama('/api/accessi/sessione', { gettone: luca });
    assert.equal(v.stato, 200);
    assert.ok(v.dati.scade > ora() + 29 * 86400000, 'allungata');
    orologio.spostamento += 25 * 86400000;
    assert.equal((await chiama('/api/accessi/sessione', { gettone: luca })).stato, 200, 'quarantacinque giorni, ma mai fermi trenta');
    const vecchia = (await entra('mira', 'giusta-giusta')).dati.gettone;
    orologio.spostamento += 31 * 86400000;
    assert.equal((await chiama('/api/accessi/sessione', { gettone: vecchia })).stato, 401);
    luca = (await entra('luca', 'orione-123')).dati.gettone;
    admin = (await entra('ben', 'stelle-polari-2')).dati.gettone;
    orologio.spostamento = 0;
  });

  prova('server: le statistiche si sommano per giorno, anche dal gettone nel corpo', async () => {
    const oggi = new Date(ora()).toISOString().slice(0, 10);
    const ieri = new Date(ora() - 86400000).toISOString().slice(0, 10);
    const r = await chiama('/api/accessi/eventi', { metodo: 'POST', gettone: luca, corpo: { eventi: [
      { tipo: 'avvio', giorno: ieri, ora: 21, dispositivo: 'telefono:app', lingua: 'it', versione: 'v504' },
      { tipo: 'vista', giorno: ieri, ora: 21, nome: 'cielo', secondi: 600, apertura: true },
      { tipo: 'vista', giorno: oggi, ora: 22, nome: 'cielo', secondi: 120, apertura: true },
      { tipo: 'azione', giorno: oggi, ora: 22, nome: 'sistema3d' },
      { tipo: 'negato', giorno: oggi, ora: 22, nome: 'youtube' },
      { tipo: 'vista', giorno: '1999-01-01', nome: 'cielo', secondi: 99999 },
      { tipo: 'vista', giorno: oggi, nome: '<script>', secondi: 5 }
    ] } });
    assert.equal(r.stato, 200);
    assert.equal(r.dati.contati, 6, 'il giorno del 1999 non conta');
    // `keepalive`: text/plain e il gettone nel corpo
    const k = await servizio.fetch(new Request('https://accessi.prova/api/accessi/eventi', { method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ gettone: luca, eventi: [{ tipo: 'vista', giorno: oggi, nome: 'cielo', secondi: 30 }] }) }), ENV);
    assert.equal(k.status, 200);
    const s = await chiama('/api/accessi/utenti/luca/statistiche?giorni=7', { gettone: admin });
    assert.equal(s.stato, 200);
    const t = s.dati.statistiche.totale;
    assert.equal(t.viste.cielo.secondi, 750);
    assert.equal(t.viste.cielo.aperture, 2);
    assert.equal(t.secondi, 750);
    assert.equal(t.azioni.sistema3d, 1);
    assert.equal(t.negati.youtube, 1);
    assert.equal(t.dispositivi['telefono:app'], 1);
    assert.equal(t.ore[21], 2);
    assert.ok(!('<script>' in t.viste));
    assert.equal(s.dati.statistiche.giorniAttivi, 2);
    assert.ok(s.dati.sessioni.length >= 1);
    assert.ok(!('hash' in s.dati.utente) && !('sale' in s.dati.utente), 'mai sale e impronta');
    const elenco = await chiama('/api/accessi/utenti?giorni=7', { gettone: admin });
    const riga = elenco.dati.utenti.find(u => u.utente === 'luca');
    assert.equal(riga.riassunto.secondi, 750);
    assert.equal(riga.riassunto.giorniAttivi, 2);
  });

  prova('server: utente spento o password nuova = fuori da tutti i dispositivi', async () => {
    const secondo = (await entra('luca', 'orione-123')).dati.gettone;
    const spento = await chiama('/api/accessi/utenti/luca', { metodo: 'PATCH', gettone: admin, corpo: { attivo: false } });
    assert.equal(spento.stato, 200);
    assert.equal((await chiama('/api/accessi/sessione', { gettone: luca })).stato, 401);
    assert.equal((await chiama('/api/accessi/sessione', { gettone: secondo })).stato, 401);
    assert.equal((await entra('luca', 'orione-123')).dati.errore, 'disattivato');
    await chiama('/api/accessi/utenti/luca', { metodo: 'PATCH', gettone: admin, corpo: { attivo: true, funzioni: ['vista:cielo', 'vista:stasera'] } });
    luca = (await entra('luca', 'orione-123')).dati.gettone;
    assert.deepEqual((await chiama('/api/accessi/sessione', { gettone: luca })).dati.profilo.funzioni, ['vista:cielo', 'vista:stasera']);
    await chiama('/api/accessi/utenti/luca', { metodo: 'PATCH', gettone: admin, corpo: { password: 'orione-456' } });
    assert.equal((await chiama('/api/accessi/sessione', { gettone: luca })).stato, 401);
    assert.equal((await entra('luca', 'orione-123')).stato, 401);
    luca = (await entra('luca', 'orione-456')).dati.gettone;
    const esci = await chiama('/api/accessi/esci', { metodo: 'POST', gettone: luca, corpo: {} });
    assert.equal(esci.stato, 200);
    assert.equal((await chiama('/api/accessi/sessione', { gettone: luca })).stato, 401);
  });

  prova('server: l\'ultimo amministratore non si spegne e non si elimina da sé', async () => {
    assert.equal((await chiama('/api/accessi/utenti/ben', { metodo: 'PATCH', gettone: admin, corpo: { ruolo: 'utente' } })).dati.errore, 'ultimoAdmin');
    assert.equal((await chiama('/api/accessi/utenti/ben', { metodo: 'PATCH', gettone: admin, corpo: { attivo: false } })).dati.errore, 'ultimoAdmin');
    assert.equal((await chiama('/api/accessi/utenti/ben', { metodo: 'DELETE', gettone: admin })).dati.errore, 'sestesso');
    const d = await chiama('/api/accessi/utenti/mira', { metodo: 'DELETE', gettone: admin });
    assert.equal(d.stato, 200);
    assert.equal((await chiama('/api/accessi/utenti/mira/statistiche', { gettone: admin })).stato, 404);
    assert.equal((await entra('mira', 'giusta-giusta')).stato, 401);
  });

  prova('server: CORS solo per i siti ammessi', async () => {
    const no = await chiama('/api/accessi/stato', { origine: 'https://intruso.example' });
    assert.equal(no.stato, 403);
    const si = await chiama('/api/accessi/stato', { origine: 'https://fabb12.github.io' });
    assert.equal(si.intest.get('access-control-allow-origin'), 'https://fabb12.github.io');
    const extra = await chiama('/api/accessi/stato', { origine: 'https://mio.example', env: Object.assign({ ORIGINI_AMMESSE: 'https://mio.example' }, ENV) });
    assert.equal(extra.stato, 200);
    const pre = await servizio.fetch(new Request('https://a/api/accessi/entra', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8000' } }), ENV);
    assert.equal(pre.status, 204);
    assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
  });

  // --------------------------------------------------------------- browser
  if (!SOLO_SERVER) {
    let pw;
    try { pw = require('playwright-core'); } catch (_) { pw = require('playwright'); }
    const server = http.createServer((req, res) => {
      const file = path.resolve(radice, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
      if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(fs.readFileSync(file));
    });
    const chromiumVero = () => {
      if (process.env.CHROMIUM) return process.env.CHROMIUM;
      for (const c of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'])
        if (fs.existsSync(c)) return c;
      return undefined;
    };
    let browser, contesto, pagina, origine;
    const richiesteAccessi = [];
    const rete = { giu: false };
    const errori = [];

    const nuovaPagina = async ({ attivo = true, larghezza = 1200 } = {}) => {
      if (contesto) await contesto.close();
      contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: larghezza, height: 860 } });
      pagina = await contesto.newPage();
      pagina.setDefaultTimeout(Number(process.env.ATTESA) || 25000);
      pagina.on('pageerror', e => errori.push(e.message));
      if (process.env.DEBUG) pagina.on('console', m => console.log('console:', m.text()));
      await pagina.route('**/*', async r => {
        const req = r.request(), url = req.url();
        if (url.startsWith(origine)) {
          // config.js col parametro, come lo scrive il deploy
          if (new URL(url).pathname === '/config.js') {
            const base = fs.readFileSync(path.join(radice, 'config.js'), 'utf8');
            return r.fulfill({ contentType: 'text/javascript', body: base + `\nwindow.ACCESSI_ATTIVO = ${attivo};\nwindow.ACCESSI_URL = ${JSON.stringify(ACCESSI_URL)};\n` });
          }
          return r.continue();
        }
        if (url.includes('astronomy.browser.min.js')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(radice, 'node_modules/astronomy-engine/astronomy.browser.min.js')) });
        if (url.includes('satellite.min.js')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(radice, 'node_modules/satellite.js/dist/satellite.min.js')) });
        if (url.startsWith(ACCESSI_URL)) {
          richiesteAccessi.push({ metodo: req.method(), via: new URL(url).pathname, auth: req.headers().authorization || '' });
          if (rete.giu) return r.abort('internetdisconnected');
          const intest = Object.assign({}, req.headers());
          const risposta = await servizio.fetch(new Request(url, { method: req.method(), headers: intest,
            body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method()) ? undefined : req.postData() || '' }), ENV);
          return r.fulfill({ status: risposta.status, headers: Object.fromEntries(risposta.headers), body: Buffer.from(await risposta.arrayBuffer()) });
        }
        return r.abort();
      });
      await pagina.addInitScript(() => {
        if (!localStorage.getItem('astrocalendario_posizione')) {
          localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
          localStorage.setItem('astrocal_lingua', 'it');
          localStorage.setItem('astrocal_ultima_vista_v1', 'stasera');
        }
      });
      return pagina;
    };
    const apri = async () => {
      await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => window.AstroAccessi && typeof window.mostraVista === 'function' && typeof vistaAttuale !== 'undefined');
    };
    const portaVisibile = () => pagina.evaluate(() => { const n = document.getElementById('acc-porta'); return !!n && !n.classList.contains('hidden'); });
    const visibile = (sel) => pagina.evaluate(s => { const n = document.querySelector(s); return !!n && getComputedStyle(n).display !== 'none'; }, sel);
    const accedi = async (utente, password) => {
      await pagina.fill('#acc-utente', utente);
      await pagina.fill('#acc-password', password);
      await pagina.click('#acc-entra');
    };

    prova('app spenta: nessuna porta, nessuna richiesta al server, tutto permesso', async () => {
      await nuovaPagina({ attivo: false });
      await apri();
      assert.equal(await portaVisibile(), false);
      assert.equal(await pagina.evaluate(() => document.getElementById('acc-porta')), null, 'spento, la porta non c\'è nemmeno');
      assert.equal(await pagina.evaluate(() => AstroAccessi.attivo()), false);
      assert.equal(await pagina.evaluate(() => AstroAccessi.puo('youtube') && accessiUsa('sistema3d')), true);
      assert.equal(await visibile('#btn-vista-stasera'), true);
      assert.equal(await visibile('#imp-account'), false);
      assert.equal(richiesteAccessi.length, 0);
    });

    prova('app accesa: la porta davanti a tutto, il resto non si raggiunge; la password sbagliata si dice', async () => {
      await chiama('/api/accessi/utenti/luca', { metodo: 'PATCH', gettone: admin, corpo: { password: 'orione-789', funzioni: ['vista:cielo', 'vista:telescopio', 'sistema3d'] } });
      await nuovaPagina();
      await apri();
      assert.equal(await portaVisibile(), true);
      assert.equal(await pagina.evaluate(() => document.querySelector('header.testata-app').hasAttribute('inert')), true);
      assert.equal(await pagina.evaluate(() => AstroAccessi.puo('vista:cielo')), false);
      await accedi('luca', 'sbagliata-1');
      await pagina.waitForFunction(() => /sbagliati/.test(document.getElementById('acc-porta-messaggio').textContent));
      assert.equal(await portaVisibile(), true);
      assert.equal(await pagina.inputValue('#acc-password'), '', 'la password sbagliata si cancella');
    });

    prova('entrare: via la porta, solo le sezioni dell\'utente, le altre negate anche nel codice', async () => {
      await accedi('Luca', 'orione-789');
      await pagina.waitForFunction(() => document.getElementById('acc-porta').classList.contains('hidden'));
      assert.equal(await pagina.evaluate(() => document.querySelector('header.testata-app').hasAttribute('inert')), false);
      assert.equal(await visibile('#btn-vista-skymap'), true);
      assert.equal(await visibile('#btn-vista-telescopio'), true);
      assert.equal(await visibile('#btn-vista-stasera'), false);
      assert.equal(await visibile('#btn-vista-demo'), false);
      assert.equal(await visibile('#btn-aggiungi'), false);
      // l'ultima vista era Stasera, che Luca non ha: si apre il planetario
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'cielo');
      assert.equal(await pagina.evaluate(() => { mostraVista('stasera'); return vistaAttuale; }), 'cielo');
      assert.equal(await pagina.evaluate(() => { mostraVista('telescopio'); return vistaAttuale; }), 'telescopio');
      assert.equal(await pagina.evaluate(() => accessiUsa('youtube')), false);
      await pagina.waitForFunction(() => /YouTube/.test((document.getElementById('acc-avviso') || {}).textContent || ''));
      const salvata = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_accessi_sessione_v1')));
      assert.equal(salvata.profilo.utente, 'luca');
      assert.ok(salvata.gettone && !('password' in salvata));
    });

    prova('ricaricando la pagina si resta dentro, e la sessione si verifica', async () => {
      const prima = richiesteAccessi.length;
      await apri();
      assert.equal(await portaVisibile(), false);
      assert.equal(await pagina.evaluate(() => AstroAccessi.stato().sessione.profilo.utente), 'luca');
      for (let i = 0; i < 40 && !richiesteAccessi.slice(prima).some(r => r.via === '/api/accessi/sessione'); i++) await pagina.waitForTimeout(100);
      assert.ok(richiesteAccessi.slice(prima).some(r => r.via === '/api/accessi/sessione' && /^Bearer /.test(r.auth)));
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'telescopio', 'torna l\'ultima vista permessa');
    });

    prova('senza rete si resta dentro lo stesso, e gli eventi aspettano in coda', async () => {
      rete.giu = true;
      await apri();
      assert.equal(await portaVisibile(), false);
      await pagina.waitForTimeout(400);
      assert.equal(await portaVisibile(), false, 'un errore di rete non fa uscire');
      await pagina.evaluate(() => AstroAccessi.invia());
      assert.ok(await pagina.evaluate(() => AstroAccessi.stato().coda) > 0);
      rete.giu = false;
    });

    prova('il tempo nelle sezioni arriva al server', async () => {
      await pagina.evaluate(() => mostraVista('cielo'));
      await pagina.waitForTimeout(2200);
      await pagina.evaluate(() => mostraVista('telescopio'));
      await pagina.evaluate(() => AstroAccessi.invia());
      await pagina.waitForFunction(() => AstroAccessi.stato().coda === 0);
      const s = await chiama('/api/accessi/utenti/luca/statistiche?giorni=7', { gettone: admin });
      const t = s.dati.statistiche.totale;
      assert.ok(t.viste.cielo && t.viste.cielo.secondi >= 2, JSON.stringify(t.viste));
      // Stasera è di serie in `vistaAttuale` prima dell'avvio: Luca non la
      // può aprire, e i secondi dell'avvio non devono finire lì
      assert.ok(!t.viste.stasera, 'tempo contato a una vista negata: ' + JSON.stringify(t.viste));
      assert.ok(t.avvii >= 3, 'un avvio per ogni apertura della pagina: ' + t.avvii);
      // uno dalla prova del server, uno dal tocco qui sopra: e non di più,
      // anche se il pacchetto della pagina che si chiudeva è ripartito
      assert.equal(t.negati.youtube, 2);
      assert.ok(t.negati['vista:stasera'] >= 1);
      assert.ok(Object.keys(t.dispositivi).some(d => d.startsWith('computer')));
    });

    prova('una sessione chiusa dall\'amministratore fa uscire alla verifica', async () => {
      await chiama('/api/accessi/utenti/luca/sessioni', { metodo: 'DELETE', gettone: admin });
      await pagina.evaluate(() => AstroAccessi.verifica());
      await pagina.waitForFunction(() => !document.getElementById('acc-porta').classList.contains('hidden'));
      assert.match(await pagina.textContent('#acc-porta-messaggio'), /scaduta|chiusa/);
      assert.equal(await pagina.evaluate(() => localStorage.getItem('astrocal_accessi_sessione_v1')), null);
    });

    prova('«Gestisci utenti»: l\'elenco, un utente nuovo con le sue funzioni, le statistiche, «Esci»', async () => {
      await accedi('ben', 'stelle-polari-2');
      await pagina.waitForFunction(() => document.getElementById('acc-porta').classList.contains('hidden'));
      assert.equal(await visibile('#btn-vista-stasera'), true, 'l\'amministratore vede tutto');
      await pagina.click('#btn-impostazioni');
      await pagina.click('#imp-tab-btn-dati');
      await pagina.waitForSelector('#acc-btn-gestisci');
      assert.match(await pagina.textContent('#imp-account-corpo'), /Amministratore/);
      await pagina.click('#acc-btn-gestisci');
      await pagina.waitForSelector('#acc-admin-corpo tr[data-utente="luca"]');
      assert.match(await pagina.textContent('#acc-admin-corpo tr[data-utente="luca"]'), /Luca R\./);
      await pagina.click('#acc-btn-nuovo');
      await pagina.fill('#acc-f-utente', 'sara');
      await pagina.fill('#acc-f-nome', 'Sara');
      await pagina.fill('#acc-f-password', 'cassiopea-1');
      await pagina.evaluate(() => document.querySelectorAll('#acc-modulo-utente input[name="funzione"]').forEach(c => { c.checked = c.value === 'vista:stasera' || c.value === 'missione'; }));
      await pagina.click('#acc-btn-salva');
      await pagina.waitForSelector('#acc-admin-corpo tr[data-utente="sara"]');
      if (process.env.FOTO) await pagina.screenshot({ path: path.join(process.env.FOTO, 'admin-1200.png') });
      const sara = (await chiama('/api/accessi/utenti', { gettone: admin })).dati.utenti.find(u => u.utente === 'sara');
      assert.deepEqual(sara.funzioni.sort(), ['missione', 'vista:stasera']);
      // le statistiche di Luca
      await pagina.click('#acc-admin-corpo tr[data-utente="luca"] [data-azione="statistiche"]');
      await pagina.waitForSelector('.acc-statistiche[data-utente="luca"] .acc-cifre');
      const testo = await pagina.textContent('.acc-statistiche');
      assert.match(testo, /Planetario/);
      assert.match(testo, /Tempo per sezione/);
      if (process.env.FOTO) await pagina.screenshot({ path: path.join(process.env.FOTO, 'statistiche-1200.png') });
      // modifica: Luca perde il telescopio
      await pagina.click('.acc-statistiche .acc-barra .tasto-cielo');
      await pagina.click('#acc-admin-corpo tr[data-utente="luca"] [data-azione="modifica"]');
      await pagina.evaluate(() => { document.querySelector('#acc-modulo-utente input[value="vista:telescopio"]').checked = false; });
      await pagina.click('#acc-btn-salva');
      await pagina.waitForFunction(() => /salvato/.test(document.querySelector('#acc-admin-corpo .acc-messaggio').textContent));
      const l = (await chiama('/api/accessi/utenti', { gettone: admin })).dati.utenti.find(u => u.utente === 'luca');
      assert.deepEqual(l.funzioni, ['vista:cielo', 'sistema3d']);
      await pagina.click('#btn-chiudi-accessi');
      assert.equal(await visibile('#modale-accessi'), false);
      await pagina.click('#acc-btn-esci');
      await pagina.waitForFunction(() => !document.getElementById('acc-porta').classList.contains('hidden'));
      assert.equal(await pagina.evaluate(() => localStorage.getItem('astrocal_accessi_sessione_v1')), null);
    });

    prova('Sara: solo Stasera e Missione Cielo; la vista 3D e il planetario no', async () => {
      await accedi('sara', 'cassiopea-1');
      await pagina.waitForFunction(() => document.getElementById('acc-porta').classList.contains('hidden'));
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'stasera');
      assert.equal(await visibile('#btn-vista-skymap'), false);
      assert.equal(await visibile('[data-blocco="missione"]'), true);
      assert.equal(await pagina.evaluate(() => { apriSistemaSolare(); return document.getElementById('modale-sistema').classList.contains('hidden'); }), true);
      await pagina.evaluate(() => AstroAccessi.esci());
      await pagina.waitForFunction(() => !document.getElementById('acc-porta').classList.contains('hidden'));
    });

    prova('al telefono (390 px) la porta e «Gestisci utenti» stanno nello schermo', async () => {
      await nuovaPagina({ larghezza: 390 });
      await apri();
      const scheda = await pagina.evaluate(() => { const r = document.querySelector('.acc-porta-scheda').getBoundingClientRect(); return { l: r.left, r: r.right }; });
      assert.ok(scheda.l >= 0 && scheda.r <= 390, JSON.stringify(scheda));
      if (process.env.FOTO) await pagina.screenshot({ path: path.join(process.env.FOTO, 'porta-390.png') });
      await accedi('ben', 'stelle-polari-2');
      await pagina.waitForFunction(() => document.getElementById('acc-porta').classList.contains('hidden'));
      await pagina.evaluate(() => accApriAdmin());
      await pagina.waitForSelector('#acc-admin-corpo tr[data-utente="sara"]');
      const largo = await pagina.evaluate(() => document.getElementById('acc-admin-corpo').scrollWidth <= document.getElementById('acc-admin-corpo').clientWidth + 1);
      assert.ok(largo, 'nessuno scorrimento orizzontale');
      if (process.env.FOTO) await pagina.screenshot({ path: path.join(process.env.FOTO, 'admin-390.png') });
      await pagina.click('#acc-admin-corpo tr[data-utente="luca"] [data-azione="statistiche"]');
      await pagina.waitForSelector('.acc-statistiche .acc-cifre');
      if (process.env.FOTO) await pagina.screenshot({ path: path.join(process.env.FOTO, 'statistiche-390.png'), fullPage: false });
    });

    prova('in inglese', async () => {
      await pagina.evaluate(() => astroI18n.impostaLingua('en'));
      await pagina.evaluate(() => accApriStatistiche('luca'));
      await pagina.waitForFunction(() => /Time per section/.test((document.querySelector('.acc-statistiche') || {}).textContent || ''));
      await pagina.evaluate(() => AstroAccessi.esci());
      await pagina.waitForFunction(() => /Sign in/.test(document.getElementById('acc-porta-titolo').textContent));
    });

    try {
      await new Promise(r => server.listen(0, '127.0.0.1', r));
      origine = 'http://127.0.0.1:' + server.address().port;
      browser = await pw.chromium.launch({ executablePath: chromiumVero() });
      await esegui();
      // Gli errori della pagina che vengono dall'assenza delle librerie
      // bloccate (Leaflet, FullCalendar) non sono di questo modulo
      const nostri = errori.filter(e => /acc|accessi/i.test(e));
      if (nostri.length) { console.log('  FALLITA   errori nella pagina:\n            ' + nostri.join('\n            ')); process.exitCode = 1; }
    } finally {
      if (browser) await browser.close();
      server.close();
    }
  } else {
    await esegui();
  }

  async function esegui() {
    let ok = 0, ko = 0;
    for (const [nome, fn] of prove) {
      try { await fn(); ok++; console.log('  ok        ' + nome); }
      catch (e) { ko++; console.log('  FALLITA   ' + nome + '\n            ' + String(e && e.stack || e).split('\n').slice(0, 5).join('\n            ')); }
    }
    console.log(`\n${ok} passate, ${ko} fallite (controllo degli accessi)`);
    process.exitCode = ko ? 1 : 0;
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
