#!/usr/bin/env node
'use strict';
// I rettangoli verticali del rilievo, guardati nei pixel.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-rilievo-zoom.js
//
// La segnalazione è «ingrandendo, sui pendii compaiono bande verticali, e
// più ingrandisco più si allargano», e non si giudica a occhio per una
// ragione che vale la pena scrivere: **nessun fotogramma è sbagliato**. Il
// terreno sta dove va, il colore è quello giusto, la cresta è al suo posto —
// solo che la superficie è fatta di rettangoli alti mezzo schermo invece che
// di un pendio. Chi guarda non dice «la maglia è campionata solo sui suoi
// nodi»: dice «sembra sgranato», ed è il modo in cui un difetto così resta
// in piedi.
//
// L'aritmetica di quel difetto sta nel §25 di `verifica.html` (quanto è
// larga una colonna, campo per campo). Qui si guarda l'altra metà, quella
// che un conto non può dare: **i pixel**. Si costruisce una maglia finta —
// un fianco liscio, di cui si conosce la forma — la si fa disegnare da
// `rilDisegna` a campo stretto, e sul disegno si misura una cosa sola: il
// profilo di luminosità lungo una riga. Un pendio vero è una rampa; un
// pendio a rettangoli è una scala, con i gradini larghi quanto una colonna
// della maglia e piatti in mezzo.
//
// C'è anche il contro-esempio, ed è servito dalla rotta di Playwright: lo
// stesso file con `RIL_SOTTO_MAX` portato a uno, cioè con la sola cura
// spenta e tutto il resto identico. Su quella pagina le stesse misure devono
// fallire — se no la prova non sta provando niente.

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
// Dove sta Chromium cambia da una macchina all'altra, e `playwright install`
// lo mette in una cartella col numero della versione. Si prova l'elenco, e
// **se non c'è niente non si dichiara un percorso affatto**: lì ci pensa
// Playwright, che il suo browser sa dove tenerlo. È la stessa scelta di
// `prova-missione-interattiva.js`, e senza di lei questa prova in CI
// fallirebbe per un motivo che col codice non c'entra.
const CHROMIUM = process.env.CHROMIUM || [
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].find(p => fs.existsSync(p));
const PORTA = 8103;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function leggiAstronomy() {
  const posti = [
    process.env.ASTRONOMY_JS,
    path.join(RADICE, 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js')
  ].filter(Boolean);
  for (const p of posti) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  throw new Error('npm install astronomy-engine');
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

let passate = 0, fallite = 0;
function prova(nome, ok, dettaglio) {
  if (ok) { passate++; console.log('  ok  ' + nome + (dettaglio ? '   — ' + dettaglio : '')); }
  else { fallite++; console.log('  NO  ' + nome + (dettaglio ? '   — ' + dettaglio : '')); }
}

// Il disegno, misurato. Gira dentro alla pagina.
function misuraNelBrowser({ fov, altVista }) {
  const na = RIL_AZIMUT, nr = RIL_ANELLI;
  const luogo = rilLuogo();
  if (!luogo) return { errore: 'nessun luogo' };

  // --- La maglia finta ---------------------------------------------------
  //
  // Un fianco che sale con la distanza, con delle costole che lo ondulano in
  // azimut: una superficie **liscia**, di cui si conosce la forma. Qualunque
  // gradino compaia sullo schermo l'ha messo il disegno, non il dato — ed è
  // tutta la ragione per cui la maglia qui è finta e non scaricata.
  const occhio = rilOcchioMeta(luogo.lat, luogo.lon);
  const quota = new Float32Array(na * nr);
  const alt = new Float32Array(na * nr);
  for (let i = 0; i < na; i++) {
    const rad = i * RIL_PASSO_AZ * Math.PI / 180;
    // Due onde: una lunga otto gradi e una lunga tre, cioè sedici e sei
    // colonne della maglia. Sono le due scale a cui un fianco vero cambia
    // pendenza, e quella corta è anche il caso difficile — sotto di lei la
    // maglia non saprebbe più niente da interpolare.
    const costola = 0.35 * Math.sin(rad * 45) + 0.12 * Math.sin(rad * 120 + 1.1);
    for (let k = 0; k < nr; k++) {
      const s = RIL_DIST[k];
      // Sotto i piedi la valle, in fondo la cresta: l'angolo sale con la
      // distanza da −30° a +20°, quindi ogni nodo del raggio si vede e la
      // camminata non ha niente da nascondere. È la scena più semplice che
      // metta terreno su tutto il riquadro a qualunque campo visivo.
      const gradi = -30 + 50 * Math.min(1, s / 6000) + costola;
      const q = occhio + s * Math.tan(gradi * Math.PI / 180);
      quota[i * nr + k] = q;
      alt[i * nr + k] = rilAngolo(q, occhio, s);
    }
  }
  const d = rilRicava(alt);
  rilievo.quota = quota; rilievo.alt = alt;
  rilievo.cresta = d.cresta; rilievo.fronte = d.fronte;
  rilievo.minAlt = d.minAlt; rilievo.maxAlt = d.maxAlt;
  rilievo.lat = luogo.lat; rilievo.lon = luogo.lon;
  rilievo.occhio = occhio; rilievo.occhioOra = occhio;
  rilievo.occhioLat = luogo.lat; rilievo.occhioLon = luogo.lon;
  rilievo.occhioQuando = performance.now();
  rilievo.acceso = true;
  rilievo.grigliaQuando = (typeof terreno !== 'undefined' ? (terreno.quando || 0) : 0);

  // --- La tela ----------------------------------------------------------
  const W = 360, H = 640;
  const tela = document.createElement('canvas');
  tela.width = W; tela.height = H;
  const ctx = tela.getContext('2d', { willReadFrequently: true });

  const salva = { w: sky.larghezza, h: sky.altezza, fov: sky.fov,
                  az: sky.manuale.az, al: sky.manuale.alt, luce: sky.luceCielo,
                  segui: sky.seguiTelefono, budget: rilBudgetFattore };
  // Il budget del fotogramma si fissa: è una manopola del **dispositivo**, e
  // un banco headless è lento in modo imprevedibile — misurarla qui vorrebbe
  // dire misurare la macchina di turno invece del disegno. Quello che il
  // budget fa al rimedio lo prova il §25 di `verifica.html`, dove si può
  // chiedere un dispositivo lento senza doverlo avere.
  rilBudgetFattore = 1;
  sky.larghezza = W; sky.altezza = H;
  sky.fov = fov;
  // La vista la si punta a mano, come col dito: `skyBase()` guarda
  // `sky.manuale` solo se i sensori non comandano.
  sky.seguiTelefono = false;
  sky.manuale.az = 20; sky.manuale.alt = altVista;
  // Di giorno, e a un'ora **fissa**: è l'ora in cui il difetto è stato
  // segnalato, ed è anche quella in cui il terreno ha il contrasto per farsi
  // misurare. Fissarla non è pignoleria — da dove viene la luce lo decide il
  // Sole, e due pagine aperte a dieci secondi di distanza dipingerebbero due
  // panorami appena diversi, cioè renderebbero incomparabili le due metà del
  // contro-esempio.
  sky.modalitaTempo = 'simulato';
  sky.istanteSimulatoMs = Date.UTC(2026, 5, 21, 9, 30, 0);
  if (typeof skyAggiornaOggetti === 'function') skyAggiornaOggetti(true);
  sky.luceCielo = 1;
  const aria = skyAria();
  const suolo = skyColoriPaesaggio('suolo', aria);
  const base = skyBase();
  const focale = skyFocale();
  const arco = rilArcoInVista(base, focale);
  const colonne = arco ? rilColonneDaDisegnare(base, focale, arco) : null;
  const fatto = rilDisegna(ctx, base, focale, suolo, aria);

  // --- Il profilo di luminosità lungo una riga --------------------------
  //
  // Si guarda la fascia centrale del riquadro e si tiene, per ogni colonna
  // di pixel, la luminosità media dei soli pixel **pieni** di terreno: dove
  // il terreno non è disegnato l'alfa è zero, e mescolarci dentro il vuoto
  // vorrebbe dire misurare il bordo della sagoma invece del pendio.
  const dati = ctx.getImageData(0, 0, W, H).data;
  const y0 = Math.round(H * 0.55), y1 = Math.round(H * 0.85);
  const prof = new Float64Array(W).fill(NaN);
  let pieni = 0, opachi = 0;
  for (let i = 3; i < dati.length; i += 4) if (dati[i] >= 250) opachi++;
  for (let x = 0; x < W; x++) {
    let somma = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      const o = (y * W + x) * 4;
      if (dati[o + 3] < 250) continue;
      somma += 0.2126 * dati[o] + 0.7152 * dati[o + 1] + 0.0722 * dati[o + 2];
      n++;
    }
    if (n > (y1 - y0) * 0.9) { prof[x] = somma / n; pieni++; }
  }

  let minL = Infinity, maxL = -Infinity, saltoMax = 0, coppie = 0;
  let sommaSalti = 0, piattaMax = 0, piatta = 1, saltiNetti = 0;
  for (let x = 0; x < W; x++) {
    if (Number.isNaN(prof[x])) continue;
    if (prof[x] < minL) minL = prof[x];
    if (prof[x] > maxL) maxL = prof[x];
    if (x + 1 < W && !Number.isNaN(prof[x + 1])) {
      const dl = Math.abs(prof[x + 1] - prof[x]);
      coppie++; sommaSalti += dl;
      if (dl > saltoMax) saltoMax = dl;
      // Un **bordo netto**: quindici livelli su 255 fra due colonne di pixel
      // vicine non è una sfumatura, è una riga. Sono questi a disegnare le
      // bande della segnalazione — il tratto che si ferma e il fondo della
      // fetta che si vede sotto — e il loro numero è il numero delle bande.
      if (dl > 15) saltiNetti++;
      // Quanto è largo il gradino: la corsa di colonne di pixel che dicono
      // tutte la stessa cosa. È **la** misura di questo difetto — un
      // rettangolo largo settantacinque pixel è una corsa piatta lunga
      // settantacinque — e a differenza di un conto di percentuali si legge
      // in pixel, cioè nella stessa unità della larghezza di una colonna.
      if (dl < 0.25) { piatta++; if (piatta > piattaMax) piattaMax = piatta; }
      else piatta = 1;
    }
  }

  sky.larghezza = salva.w; sky.altezza = salva.h; sky.fov = salva.fov;
  sky.manuale.az = salva.az; sky.manuale.alt = salva.al;
  sky.luceCielo = salva.luce; sky.seguiTelefono = salva.segui;
  rilBudgetFattore = salva.budget;

  return {
    fatto, pieni, W, opachi,
    colonne: colonne ? colonne.nCol : 0,
    sotto: colonne ? colonne.sotto : 0,
    larghezzaColonna: colonne ? colonne.larghezza : 0,
    gamma: maxL - minL,
    saltoMax, saltoMedio: coppie ? sommaSalti / coppie : 0,
    piattaMax, saltiNetti
  };
}

(async () => {
  await new Promise(r => server.listen(PORTA, r));
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const contesto = await browser.newContext({ serviceWorkers: 'block' });

  async function apri(spegniLaCura) {
    const pagina = await contesto.newPage();
    const errori = [];
    pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
    // L'ordine conta, ed è al contrario di come sembra: fra due rotte che
    // combaciano vince l'ULTIMA registrata (è la stessa lezione di
    // `prova-fumetto.js`), quindi il catch-all su jsdelivr va per primo.
    await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await pagina.route('**/astronomy.browser.min.js', r =>
      r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
    for (const fuori of ['**open-meteo.com/**', '**overpass**', '**amazonaws**',
      '**celestrak**', '**ipapi**', '**ipwho**', '**geojs**', '**noaa**',
      '**bigdatacloud**', '**nominatim**', '**adsb**']) {
      await pagina.route(fuori, r => r.abort());
    }
    if (spegniLaCura) {
      // Il contro-esempio: lo stesso file con la sola cura spenta. Una
      // colonna torna a essere un nodo della maglia, com'era.
      const sorgente = fs.readFileSync(path.join(RADICE, 'rilievo.js'), 'utf8');
      const rotto = sorgente.replace('const RIL_SOTTO_MAX = 256;', 'const RIL_SOTTO_MAX = 1;');
      if (rotto === sorgente) throw new Error('il contro-esempio non ha trovato RIL_SOTTO_MAX');
      await pagina.route('**/rilievo.js', r => r.fulfill({ body: rotto, contentType: 'text/javascript' }));
    }
    await pagina.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await pagina.evaluate(() => {
      localStorage.setItem('astrocalendario_posizione',
        JSON.stringify({ lat: 45.81, lon: 9.08, nome: 'Villa Guardia', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof rilDisegna === 'function' &&
      typeof skyAria === 'function' && typeof Astronomy === 'object', null, { timeout: 40000 });
    await pagina.waitForTimeout(1200);
    return { pagina, errori };
  }

  // La camera guarda poco sopra l'orizzonte, come la guarda chi ingrandisce
  // su una cresta: alzandola più del semi-campo la riga dell'orizzonte esce
  // dal cono e `rilArcoInVista` non ha più niente da dire — è un'altra
  // faccenda, e non è questa.
  const CAMPI = [{ fov: 60, altVista: 3 }, { fov: 15, altVista: 3 },
                 { fov: 4, altVista: 1 }, { fov: 1, altVista: 0.2 }];

  console.log('\n— il rilievo a campo stretto, nei pixel —');
  const { pagina, errori } = await apri(false);
  const dopo = [];
  for (const caso of CAMPI) dopo.push(await pagina.evaluate(misuraNelBrowser, caso));

  console.log('\n— e con la cura spenta (contro-esempio) —');
  const { pagina: pagina2 } = await apri(true);
  const prima = [];
  for (const caso of CAMPI) prima.push(await pagina2.evaluate(misuraNelBrowser, caso));

  console.log('');
  // Prima di tutto: si sta misurando un pendio e non una tela vuota. È la
  // trappola di famiglia — una prova che non trova niente da guardare è
  // verde e non prova niente.
  for (let i = 0; i < CAMPI.length; i++) {
    const d = dopo[i], p = prima[i], fov = CAMPI[i].fov;
    prova(`a ${fov}° il terreno è davvero disegnato`,
      d.fatto && d.pieni > d.W * 0.8 && d.gamma > 6 &&
      p.fatto && p.pieni > p.W * 0.8,
      `${d.pieni}/${d.W} colonne piene, ${d.gamma.toFixed(1)} livelli di gamma`);
  }

  console.log('');
  // Il metro non è una soglia inventata: è **la stessa vista da sessanta
  // gradi**, cioè quella che c'è sempre stata e di cui nessuno si è mai
  // lamentato. Ingrandendo, il terreno non deve diventare più a gradini di
  // così.
  const rif = dopo[0];
  for (let i = 1; i < CAMPI.length; i++) {
    const d = dopo[i], p = prima[i], fov = CAMPI[i].fov;
    prova(`a ${fov}° il gradino fra due colonne non è peggio che a 60°`,
      d.saltoMax <= rif.saltoMax + 2,
      `${d.saltoMax.toFixed(1)} livelli contro i ${rif.saltoMax.toFixed(1)} di una vista ` +
      `normale (con la cura spenta ${p.saltoMax.toFixed(1)})`);
  }

  console.log('');
  for (let i = 0; i < CAMPI.length; i++) {
    const d = dopo[i], p = prima[i], fov = CAMPI[i].fov;
    // I bordi netti, che sono **le bande**: dove il tratto di una colonna si
    // ferma e sotto si vede il fondo della fetta. Non ce ne deve essere
    // nemmeno uno.
    prova(`a ${fov}° non c'è nessun bordo netto fra una colonna e l'altra`,
      d.saltiNetti === 0,
      `${d.saltiNetti} bordi (con la cura spenta ${p.saltiNetti})`);
  }

  console.log('');
  for (let i = 0; i < CAMPI.length; i++) {
    const d = CAMPI[i], m = dopo[i];
    // E la colonna disegnata resta sotto la misura oltre la quale si legge
    // come un rettangolo, qualunque sia l'ingrandimento.
    prova(`a ${d.fov}° la colonna disegnata resta della misura giusta`,
      m.larghezzaColonna <= 20 + 1e-9,
      `${m.larghezzaColonna.toFixed(1)} px (la maglia da sola ne darebbe ` +
      `${(m.larghezzaColonna * m.sotto).toFixed(0)})`);
  }

  console.log('');
  // Il contro-esempio, scritto in chiaro: a campo stretto la cura spenta
  // **deve** fallire, se no questa prova non sta provando niente.
  const stretti = CAMPI.map((c, i) => ({ c, d: dopo[i], p: prima[i] })).filter(x => x.c.fov <= 4);
  const rotti = stretti.filter(x => x.p.saltiNetti > 0 && x.p.saltoMax > rif.saltoMax + 2);
  prova('con la cura spenta, a campo stretto, le stesse misure falliscono',
    rotti.length === stretti.length && stretti.length >= 2,
    stretti.map(x => `${x.c.fov}°: ${x.p.saltiNetti} bordi netti, salto ${x.p.saltoMax.toFixed(1)}`).join(' · '));
  // E i rettangoli erano larghi davvero, non un pelo: è il numero della
  // segnalazione.
  const piuLargo = Math.max(...stretti.map(x => x.p.piattaMax));
  prova('e i rettangoli di prima erano larghi decine di pixel',
    piuLargo > 40, `il più largo ${piuLargo} px su un riquadro da 360`);

  // A campo largo non deve cambiare **niente**: è la promessa che rende
  // sicuro il rimedio.
  {
    const d = dopo[0], p = prima[0];
    prova('a campo largo la cura non tocca il disegno',
      d.sotto === 1 && p.sotto === 1 && d.colonne === p.colonne &&
      Math.abs(d.saltoMax - p.saltoMax) < 1e-6 && d.saltiNetti === p.saltiNetti &&
      d.piattaMax === p.piattaMax && Math.abs(d.gamma - p.gamma) < 1e-6,
      `${d.colonne} colonne in tutt'e due, salto ${d.saltoMax.toFixed(2)}`);
  }

  console.log('');
  for (let i = 0; i < CAMPI.length; i++) {
    const d = dopo[i], p = prima[i];
    console.log(`  · ${CAMPI[i].fov}°: ${d.colonne} colonne larghe ` +
      `${d.larghezzaColonna.toFixed(1)} px (spezzate ×${d.sotto}), ` +
      `gamma ${d.gamma.toFixed(1)}, gradino ${d.piattaMax} px — prima ` +
      `${p.colonne} colonne larghe ${p.larghezzaColonna.toFixed(1)} px, gradino ${p.piattaMax} px`);
  }

  if (errori.length) {
    console.log('\n  eccezioni nella pagina:');
    for (const e of errori.slice(0, 5)) console.log('   ' + e);
    fallite += errori.length;
  }

  await browser.close();
  server.close();
  console.log(`\n${passate} verdi, ${fallite} rosse`);
  process.exit(fallite ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
