// Prova dell'app per computer (desktop/, DESKTOP.md) e del custode delle
// chiavi (custode-chiavi.js).
//
//   node scripts/prova-desktop.js --solo-node   server, custode, dizionari (mezzo secondo, niente browser)
//   node scripts/prova-desktop.js               + le Impostazioni nel browser (vuole playwright)
//   node scripts/prova-desktop.js --electron    + il programma vero (vuole `npm install` in desktop/;
//                                                 su Linux senza schermo: xvfb-run -a node …)
//
// Il caso da cui nasce il custode: le chiavi di ElevenLabs e GitHub che
// sparivano a ogni pulizia dei dati del sito. La prova col programma vero
// fa proprio quello: salva una chiave, chiude, cancella il Local Storage di
// Chromium, riapre, e la chiave dev'essere tornata.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const RADICE = path.resolve(__dirname, '..');
const SOLO_NODE = process.argv.includes('--solo-node');
const CON_ELECTRON = process.argv.includes('--electron');

let ko = 0, fatte = 0;
const ok = (nome, condizione, dettaglio) => {
  fatte++;
  console.log((condizione ? '  ok        ' : '  FALLITO   ') + nome + (dettaglio ? '   — ' + dettaglio : ''));
  if (!condizione) ko++;
};

// ---------------------------------------------------------------------
// 1. Il server locale
// ---------------------------------------------------------------------
async function provaServer() {
  console.log('\n— server locale —');
  const server = require(path.join(RADICE, 'desktop/server.js'));
  const r = await server.avvia(RADICE, { porta: 0 });
  const base = 'http://127.0.0.1:' + r.porta;
  const chiedi = (u, h, metodo) => fetch(base + u, { headers: h || {}, method: metodo || 'GET' });
  try {
    ok('l\'origine è localhost (il proxy ADS-B la accetta)', /^http:\/\/localhost:\d+$/.test(r.origine), r.origine);
    let x = await chiedi('/');
    ok('/ dà index.html', x.status === 200 && /text\/html/.test(x.headers.get('content-type')) && /<html/i.test(await x.text()));
    x = await chiedi('/sw.js');
    ok('i .js sono JavaScript', x.status === 200 && /javascript/.test(x.headers.get('content-type')));
    ok('niente cache HTTP (un aggiornamento si vede subito)', x.headers.get('cache-control') === 'no-cache');
    for (const fuori of ['/../package.json', '/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc%2fpasswd', '/desktop/../../etc/hosts']) {
      x = await chiedi(fuori);
      ok('non si esce dalla cartella: ' + fuori, x.status === 404 || x.status === 400, String(x.status));
    }
    x = await chiedi('/icon-192.png', { Range: 'bytes=0-9' });
    const corpo = Buffer.from(await x.arrayBuffer());
    ok('Range → 206 con i byte chiesti (l\'audio si sposta)', x.status === 206 && corpo.length === 10 && /^bytes 0-9\//.test(x.headers.get('content-range')));
    x = await chiedi('/icon-192.png', { Range: 'bytes=-4' });
    ok('Range dalla coda', x.status === 206 && Buffer.from(await x.arrayBuffer()).length === 4);
    x = await chiedi('/icon-192.png', { Range: 'bytes=99999999-' });
    ok('Range fuori misura → 416', x.status === 416);
    x = await chiedi('/index.html', {}, 'HEAD');
    ok('HEAD senza corpo', x.status === 200 && Number(x.headers.get('content-length')) > 0);
    x = await chiedi('/index.html', {}, 'POST');
    ok('POST rifiutato', x.status === 405);
    // La porta occupata: si passa alla successiva, e lo si dice
    const r2 = await server.avvia(RADICE, { porta: r.porta, tentativi: 5 });
    ok('porta occupata → la successiva, segnata «cambiata»', r2.porta !== r.porta && r2.cambiata, r.porta + ' → ' + r2.porta);
    await new Promise(f => r2.server.close(f));
  } finally {
    await new Promise(f => r.server.close(f));
  }
}

// ---------------------------------------------------------------------
// 2. Il custode delle chiavi, in una finestra finta
// ---------------------------------------------------------------------
function finestraFinta({ chiavi = {}, cassa = null, persistito = false, persist = true } = {}) {
  const dati = new Map(Object.entries(chiavi));
  const ascoltatori = {};
  const scritte = [];
  const domande = { persist: 0 };
  const localStorage = {
    getItem: k => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    removeItem: k => dati.delete(k),
    clear: () => dati.clear()
  };
  const window = {
    localStorage,
    addEventListener: (n, f) => { (ascoltatori[n] = ascoltatori[n] || []).push(f); }
  };
  if (cassa) {
    window.astroDesktop = {
      desktop: true,
      chiavi: {
        tutte: () => Object.assign({}, cassa),
        scrivi: (k, v) => { scritte.push([k, v]); if (v == null) delete cassa[k]; else cassa[k] = v; }
      }
    };
  }
  const contesto = {
    window, localStorage,
    document: { addEventListener: () => {} },
    navigator: { storage: { persisted: async () => persistito, persist: async () => { domande.persist++; return persist; } } },
    setInterval: () => 0,
    console: { info: () => {}, warn: () => {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(RADICE, 'custode-chiavi.js'), 'utf8'), contesto);
  return { window, dati, scritte, domande, cassa, custode: window.astroCustode };
}

async function provaCustode() {
  console.log('\n— custode delle chiavi —');
  const eleven = JSON.stringify({ chiave: 'sk_prova', modello: 'eleven_v3', stabilita: 0.5 });
  const repo = JSON.stringify({ repo: 'a/b', ramo: 'main', token: 'github_pat_prova' });

  // Il browser ha perso tutto, la cassaforte no
  let f = finestraFinta({ cassa: { astrocal_elevenlabs_v1: eleven, astrocal_storie_repo_v1: repo, altra_chiave: 'x' } });
  ok('dati del sito cancellati → le chiavi tornano prima di app.js', f.dati.get('astrocal_elevenlabs_v1') === eleven && f.dati.get('astrocal_storie_repo_v1') === repo);
  ok('…e il custode dice quali', f.custode.rimesse.length === 2);
  ok('una chiave che il custode non conosce non entra', !f.dati.has('altra_chiave'));

  // Prima apertura del programma: la cassaforte è vuota, il browser no
  f = finestraFinta({ chiavi: { astrocal_youtube_v1: '{"clientId":"x"}' }, cassa: {} });
  ok('chiave già nel browser → copiata in cassaforte', f.cassa.astrocal_youtube_v1 === '{"clientId":"x"}');

  // Una chiave scritta dopo, e una «dimenticata»
  f = finestraFinta({ cassa: {} });
  f.dati.set('astrocal_elevenlabs_v1', eleven);
  f.custode.controlla();
  ok('chiave nuova → in cassaforte al giro dopo', f.cassa.astrocal_elevenlabs_v1 === eleven);
  const dimenticata = JSON.stringify({ chiave: '', modello: 'eleven_v3', stabilita: 0.5 });
  f.dati.set('astrocal_elevenlabs_v1', dimenticata);
  f.custode.controlla();
  ok('«Dimentica» si ricopia (la cassaforte non la fa tornare)', f.cassa.astrocal_elevenlabs_v1 === dimenticata);
  const scritteprima = f.scritte.length;
  f.custode.controlla();
  ok('niente cambiato → niente scritto', f.scritte.length === scritteprima);

  // Dati del sito cancellati a programma aperto
  f.dati.clear();
  f.custode.controlla();
  ok('cancellata a programma aperto → rimessa subito', f.dati.get('astrocal_elevenlabs_v1') === dimenticata);
  ok('…senza svuotare la cassaforte', f.cassa.astrocal_elevenlabs_v1 === dimenticata);

  // Nel browser: la memoria persistente solo a chi ha chiavi
  f = finestraFinta({});
  await new Promise(r => setTimeout(r, 0));
  ok('browser senza chiavi → nessuna domanda di memoria persistente', f.domande.persist === 0);
  f = finestraFinta({ chiavi: { astrocal_storie_repo_v1: repo } });
  await new Promise(r => setTimeout(r, 0));
  ok('browser con un token → chiede la memoria persistente', f.domande.persist === 1);
  ok('…una volta sola', (await f.custode.proteggi()) === true && f.domande.persist === 1);
  f = finestraFinta({ chiavi: { astrocal_storie_repo_v1: repo }, persistito: true });
  await new Promise(r => setTimeout(r, 0));
  ok('già persistente → non chiede di nuovo', f.domande.persist === 0);
  f = finestraFinta({});
  f.dati.set('astrocal_elevenlabs_v1', eleven);
  f.custode.controlla();
  await new Promise(r => setTimeout(r, 0));
  ok('chiave scritta più tardi → chiede allora', f.domande.persist === 1);
  ok('quante() conta solo le chiavi piene', f.custode.quante() === 1);
  // Lo Studio scrive le impostazioni del repository anche senza token
  f = finestraFinta({ chiavi: { astrocal_storie_repo_v1: JSON.stringify({ repo: 'a/b', ramo: 'main', token: '', ultimo: { ok: true } }) } });
  await new Promise(r => setTimeout(r, 0));
  ok('impostazioni senza token → non è un segreto (niente domanda, non si conta)', f.domande.persist === 0 && f.custode.quante() === 0);

  // Le due liste di chiavi devono coincidere (pagina e programma)
  const pagina = /CUSTODE_CHIAVI = \[([\s\S]*?)\]/.exec(fs.readFileSync(path.join(RADICE, 'custode-chiavi.js'), 'utf8'))[1];
  const programma = /CHIAVI_CUSTODITE = new Set\(\[([\s\S]*?)\]\)/.exec(fs.readFileSync(path.join(RADICE, 'desktop/main.js'), 'utf8'))[1];
  const nomi = s => (s.match(/'[^']+'/g) || []).sort().join(',');
  ok('custode-chiavi.js e desktop/main.js custodiscono le stesse chiavi', nomi(pagina) === nomi(programma), nomi(pagina));
  // E le chiavi custodite sono quelle che l'app usa davvero
  const sorgenti = ['storie-studio.js', 'youtube.js', 'voci-filmato.js'].map(n => fs.readFileSync(path.join(RADICE, n), 'utf8')).join('\n');
  for (const k of (pagina.match(/'[^']+'/g) || []).map(s => s.slice(1, -1))) ok('l\'app usa ' + k, sorgenti.includes("'" + k + "'"));
}

// ---------------------------------------------------------------------
// 3. Dizionari, versioni, file
// ---------------------------------------------------------------------
function provaCarte() {
  console.log('\n— dizionari, versione, file —');
  const { DIZIONARI } = require(path.join(RADICE, 'desktop/testi.js'));
  const it = Object.keys(DIZIONARI.it).sort().join(), en = Object.keys(DIZIONARI.en).sort().join();
  ok('le frasi del programma ci sono in italiano e in inglese', it === en);
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(RADICE, 'lingue/it.js'), 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(RADICE, 'lingue/en.js'), 'utf8'), ctx);
  const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
  const ui = fs.readFileSync(path.join(RADICE, 'ui-nuova.js'), 'utf8');
  const chiavi = new Set([
    ...[...html.matchAll(/data-i18n="((?:ui\.(?:app-per-computer|desktop-|scarica-per|tutte-le-v|cartella-dei|chiedi-ogni|apri-la-c|cambia-c|cerca-agg))[^"]*)"/g)].map(m => m[1]),
    ...[...ui.matchAll(/'(desktop\.\w+)'/g)].map(m => m[1])
  ]);
  const mancano = [...chiavi].filter(k => !(k in ctx.window.ASTRO_DIZIONARI.it.messaggi) || !(k in ctx.window.ASTRO_DIZIONARI.en.messaggi));
  ok('le frasi del riquadro «App per computer» sono nei due dizionari', chiavi.size > 15 && !mancano.length, mancano.join(', ') || chiavi.size + ' chiavi');

  const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
  const v = /astrocal-v(\d+)/.exec(sw)[1];
  const cfg = /version: 'v(\d+)'/.exec(fs.readFileSync(path.join(RADICE, 'config.js'), 'utf8'))[1];
  ok('CACHE_NAME e ASTROCAL_BUILD hanno la stessa versione', v === cfg, 'v' + v + ' / v' + cfg);
  const { versionePacchetto, versioneSito, FUORI } = require(path.join(RADICE, 'desktop/prepara.js'));
  ok('la versione del programma viene da sw.js (vN → 1.N.0)', versionePacchetto(versioneSito()) === `1.${v}.0`);
  ok('custode-chiavi.js è fra gli ASSETS del service worker', sw.includes("'./custode-chiavi.js'"));
  ok('…e index.html lo carica prima di app.js', html.indexOf('src="custode-chiavi.js"') > 0 && html.indexOf('src="custode-chiavi.js"') < html.indexOf('src="app.js"'));
  for (const f of ['desktop', 'scripts', 'CLAUDE.md', 'worker-adsb.js']) ok('il programma non porta con sé ' + f, FUORI.has(f));
  const pub = fs.readFileSync(path.join(RADICE, '.github/workflows/pubblica.yml'), 'utf8');
  ok('il sito non pubblica la cartella desktop/', pub.includes("--exclude 'desktop'"));
  const pacchetto = JSON.parse(fs.readFileSync(path.join(RADICE, 'desktop/package.json'), 'utf8'));
  ok('l\'installatore si chiama come il link delle Impostazioni', pacchetto.build.nsis.artifactName === 'AstroCalendario-Setup.${ext}' && html.includes('AstroCalendario-Setup.exe') && ui.includes('AstroCalendario-Setup.exe'));
  ok('diario e chiavi restano alla disinstallazione', pacchetto.build.nsis.deleteAppDataOnUninstall === false);
  for (const f of pacchetto.build.files) ok('il pacchetto contiene ' + f, fs.existsSync(path.join(RADICE, 'desktop', f)));
}

// ---------------------------------------------------------------------
// 4. Le Impostazioni nel browser
// ---------------------------------------------------------------------
function caricaPlaywright() {
  for (const nome of ['playwright', 'playwright-core']) { try { return require(nome); } catch (_) { /* il prossimo */ } }
  return null;
}

async function instradaFuoriRete(pagina) {
  await pagina.route('**/*', r => {
    const u = r.request().url();
    if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(u)) return r.continue();
    if (/astronomy\.browser\.min\.js$/.test(u)) {
      try { return r.fulfill({ body: fs.readFileSync(require.resolve('astronomy-engine/astronomy.browser.min.js', { paths: [RADICE] })), contentType: 'text/javascript' }); }
      catch (_) { /* sotto */ }
    }
    if (/cdn\.jsdelivr\.net|unpkg\.com/.test(u)) return r.fulfill({ body: '', contentType: /\.css/.test(u) ? 'text/css' : 'text/javascript' });
    return r.abort();
  });
}

async function provaBrowser(pw) {
  console.log('\n— le Impostazioni nel browser —');
  const server = require(path.join(RADICE, 'desktop/server.js'));
  const r = await server.avvia(RADICE, { porta: 0 });
  const browser = await pw.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const UA_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const apri = async (opzioni, prima) => {
    const contesto = await browser.newContext(Object.assign({ serviceWorkers: 'block', locale: 'it-IT' }, opzioni));
    const p = await contesto.newPage();
    const errori = [];
    p.on('pageerror', e => errori.push(e.message));
    await instradaFuoriRete(p);
    if (prima) await p.addInitScript(prima);
    await p.addInitScript(() => { try { localStorage.setItem('astrocal_lingua', 'it'); } catch (_) { /* niente */ } });
    await p.goto(r.origine.replace('localhost', '127.0.0.1') + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof costruisciSezioneDesktop === 'function' && document.getElementById('imp-desktop'));
    await p.evaluate(() => costruisciSezioneDesktop());
    await p.waitForTimeout(150);
    return { p, contesto, errori };
  };
  const visibile = (p, id) => p.evaluate(i => { const e = document.getElementById(i); return !!e && !e.classList.contains('hidden') && !e.closest('.hidden'); }, id);
  const visibileSeAperta = (p, id) => p.evaluate(i => { const e = document.getElementById(i); let n = e; while (n && n.id !== 'imp-desktop') { if (n.classList.contains('hidden')) return false; n = n.parentElement; } return !!e && !document.getElementById('imp-desktop').classList.contains('hidden'); }, id);
  try {
    // Windows nel browser: il tasto dell'installatore
    let a = await apri({ userAgent: UA_WIN });
    ok('browser su Windows → «Scarica per Windows»', await visibileSeAperta(a.p, 'imp-desktop-web'));
    const href = await a.p.getAttribute('#imp-desktop-scarica', 'href');
    ok('…che punta all\'ultimo installatore', href === 'https://github.com/fabb12/AstroCalendarBen/releases/latest/download/AstroCalendario-Setup.exe', href);
    ok('…e niente pannello del programma', !(await visibileSeAperta(a.p, 'imp-desktop-app')));
    ok('il custode c\'è anche nel browser', await a.p.evaluate(() => !!window.astroCustode && window.astroCustode.cassaforte === false));
    await a.contesto.close();

    // Telefono: niente
    a = await apri({ userAgent: UA_ANDROID, isMobile: true, hasTouch: true, viewport: { width: 390, height: 800 } });
    ok('telefono → il riquadro non c\'è', await a.p.evaluate(() => document.getElementById('imp-desktop').classList.contains('hidden')));
    await a.contesto.close();

    // Dentro il programma (ponte finto, come lo dà preload.js)
    a = await apri({ userAgent: UA_WIN }, () => {
      const cassa = { astrocal_elevenlabs_v1: '{"chiave":"sk_dalla_cassaforte"}' };
      window.__scritte = [];
      window.__info = { versione: 'v999', versioneProgramma: '1.999.0', electron: '44.9.3', chromium: '140', piattaforma: 'win32',
        cartella: 'C:\\Users\\ben\\Documents\\AstroCalendario', chiedi: true, porta: '47231', cassaforteCifrata: true };
      window.astroDesktop = {
        desktop: true, piattaforma: 'win32',
        info: async () => Object.assign({}, window.__info),
        apriCartella: async () => true,
        scegliCartella: async () => Object.assign(window.__info, { cartella: 'D:\\Cielo' }),
        impostaChiedi: async si => Object.assign(window.__info, { chiedi: si }),
        cercaAggiornamenti: async () => ({ stato: 'nuova', versione: 'v1000', url: 'https://github.com/fabb12/AstroCalendarBen/releases/download/desktop-v1000/AstroCalendario-Setup.exe' }),
        apriAggiornamento: async u => { window.__aperto = u; return true; },
        chiavi: { tutte: () => Object.assign({}, cassa), scrivi: (k, v) => window.__scritte.push([k, v]) }
      };
      try { localStorage.removeItem('astrocal_elevenlabs_v1'); } catch (_) { /* niente */ }
    });
    ok('nel programma → il pannello del programma', await visibileSeAperta(a.p, 'imp-desktop-app'));
    ok('…e non il tasto per scaricarlo', !(await visibileSeAperta(a.p, 'imp-desktop-web')));
    ok('la chiave persa è tornata dalla cassaforte', await a.p.evaluate(() => localStorage.getItem('astrocal_elevenlabs_v1') === '{"chiave":"sk_dalla_cassaforte"}'));
    const stato = await a.p.textContent('#imp-desktop-stato');
    ok('dice versione ed Electron', /v999/.test(stato) && /44\.9\.3/.test(stato), stato);
    ok('dice la cartella', (await a.p.textContent('#imp-desktop-cartella')).includes('AstroCalendario'));
    const chiavi = await a.p.textContent('#imp-desktop-chiavi');
    ok('dice quante chiavi custodisce, e che una è tornata', /1 chiave/.test(chiavi) && /rimesso 1 chiave/.test(chiavi), chiavi);
    ok('la casella «chiedi» rispecchia l\'impostazione', await a.p.isChecked('#imp-desktop-chiedi'));
    await a.p.evaluate(() => document.getElementById('imp-desktop-cambia').click());
    await a.p.waitForTimeout(100);
    ok('«Cambia cartella» aggiorna il percorso', (await a.p.textContent('#imp-desktop-cartella')) === 'D:\\Cielo');
    await a.p.evaluate(() => { const c = document.getElementById('imp-desktop-chiedi'); c.checked = false; c.dispatchEvent(new Event('change')); });
    await a.p.waitForTimeout(100);
    ok('togliere «chiedi» arriva al programma', await a.p.evaluate(() => window.__info.chiedi === false));
    await a.p.evaluate(() => costruisciSezioneDesktop());
    await a.p.evaluate(() => document.getElementById('imp-desktop-aggiorna').click());
    await a.p.waitForTimeout(150);
    ok('«Cerca aggiornamenti» dice la versione nuova', /v1000/.test(await a.p.textContent('#imp-desktop-esito')));
    ok('i tasti si legano una volta sola anche riaprendo', await a.p.evaluate(() => document.querySelectorAll('#imp-desktop-esito button').length === 1));
    await a.p.evaluate(() => document.querySelector('#imp-desktop-esito button').click());
    ok('…e il tasto apre l\'installatore nuovo', /desktop-v1000/.test(await a.p.evaluate(() => window.__aperto || '')));
    await a.p.evaluate(() => astroI18n.imposta ? astroI18n.imposta('en') : null).catch(() => null);
    ok('nessun errore nella pagina', !a.errori.length, a.errori.slice(0, 3).join(' | '));
    await a.contesto.close();
  } finally {
    await browser.close();
    await new Promise(f => r.server.close(f));
  }
}

// ---------------------------------------------------------------------
// 5. Il programma vero (Electron)
// ---------------------------------------------------------------------
async function provaElectron(pw) {
  console.log('\n— il programma vero (Electron) —');
  let eseguibile;
  try { eseguibile = require(require.resolve('electron', { paths: [path.join(RADICE, 'desktop')] })); }
  catch (_) { console.log('  (saltata: manca Electron, lancia `npm install` in desktop/)'); return; }
  if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('  (saltata: niente schermo, usa xvfb-run -a)'); return; }
  const dati = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocal-desktop-'));
  const salvati = path.join(dati, 'salvati');
  fs.writeFileSync(path.join(dati, 'impostazioni-desktop.json'), JSON.stringify({ cartella: salvati, chiedi: false }));
  const env = Object.assign({}, process.env, { ASTROCAL_DATI: dati, ASTROCAL_PORTA: String(48000 + Math.floor(Math.random() * 1000)) });
  const avvia = async () => {
    const app = await pw._electron.launch({ executablePath: eseguibile, args: [path.join(RADICE, 'desktop'), '--no-sandbox'], env });
    const w = await app.firstWindow();
    // Niente `route` qui: dentro Electron ferma anche le pagine di localhost.
    // Senza rete le librerie dal CDN mancano, e l'app va avanti lo stesso.
    await w.waitForFunction(() => !!window.astroDesktop && !!window.astroCustode && typeof costruisciSezioneDesktop === 'function', null, { timeout: 30000 });
    return { app, w };
  };
  try {
    let { app, w } = await avvia();
    ok('la finestra apre l\'app da localhost', /^http:\/\/localhost:\d+\/index\.html$/.test(w.url()), w.url());
    ok('la pagina vede il ponte, non Node', await w.evaluate(() => window.astroDesktop.desktop === true && typeof require === 'undefined' && typeof process === 'undefined'));
    const info = await w.evaluate(() => window.astroDesktop.info());
    ok('il programma dice la sua versione', /^v\d+$/.test(info.versione) && info.cartella === salvati, JSON.stringify(info));
    const ua = await w.evaluate(() => navigator.userAgent);
    ok('l\'user agent non dice «Electron» (Google lascia accedere a YouTube)', !/Electron|astrocalendario/i.test(ua), ua);

    // La chiave salvata va in cassaforte, cifrata se il sistema sa farlo
    await w.evaluate(() => localStorage.setItem('astrocal_elevenlabs_v1', JSON.stringify({ chiave: 'sk_segretissima', modello: 'eleven_v3', stabilita: 0.5 })));
    await w.waitForTimeout(2600);
    const cassa = fs.existsSync(path.join(dati, 'chiavi.json')) ? fs.readFileSync(path.join(dati, 'chiavi.json'), 'utf8') : '';
    ok('la chiave è nella cassaforte del programma', cassa.includes('astrocal_elevenlabs_v1'));
    ok(info.cassaforteCifrata ? '…cifrata (non si legge nel file)' : '…in chiaro (questo sistema non sa cifrare)',
      info.cassaforteCifrata ? !cassa.includes('sk_segretissima') : true);

    // Un file salvato dall'app finisce nella cartella, senza domande
    await w.evaluate(() => scaricaFile(new Blob(['prova'], { type: 'text/plain' }), 'prova-desktop.txt'));
    let trovato = false;
    for (let i = 0; i < 40 && !trovato; i++) { await w.waitForTimeout(100); trovato = fs.existsSync(path.join(salvati, 'prova-desktop.txt')); }
    ok('un file scaricato finisce nella cartella dei salvataggi', trovato);

    // Una finestra verso fuori non si apre dentro il programma
    const prima = app.windows().length;
    await w.evaluate(() => window.open('mailto:nessuno@example.invalid'));
    await w.waitForTimeout(400);
    ok('i collegamenti esterni non aprono finestre nel programma', app.windows().length === prima);
    await app.close();

    // Il caso del difetto: i dati del «browser» spariscono, le chiavi no
    for (const d of ['Local Storage', 'IndexedDB', 'Service Worker']) fs.rmSync(path.join(dati, d), { recursive: true, force: true });
    ({ app, w } = await avvia());
    const tornata = await w.evaluate(() => localStorage.getItem('astrocal_elevenlabs_v1'));
    ok('dati del sito cancellati → al riavvio la chiave di ElevenLabs è tornata', /sk_segretissima/.test(tornata || ''), String(tornata));
    ok('…e il custode lo sa', await w.evaluate(() => window.astroCustode.rimesse.includes('astrocal_elevenlabs_v1')));
    await app.close();
  } catch (e) {
    ok('il programma parte e risponde', false, e && e.message);
  } finally {
    fs.rmSync(dati, { recursive: true, force: true });
  }
}

(async () => {
  const t0 = Date.now();
  await provaServer();
  await provaCustode();
  provaCarte();
  if (!SOLO_NODE) {
    const pw = caricaPlaywright();
    if (!pw) console.log('\n(saltate le prove nel browser: manca playwright)');
    else {
      await provaBrowser(pw);
      if (CON_ELECTRON) await provaElectron(pw);
    }
  }
  console.log(`\n${fatte - ko}/${fatte} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
