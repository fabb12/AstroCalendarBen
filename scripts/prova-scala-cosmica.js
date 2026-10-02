// La scala cosmica (scala-cosmica.js): oltre i pianeti, fino all'universo
// osservabile, con le due Voyager al loro posto.
//
//   node scripts/prova-scala-cosmica.js --solo-motore   # i conti, mezzo secondo
//   node scripts/prova-scala-cosmica.js                 # e poi l'interfaccia, in un Chromium
//
// È la famiglia di cose che a occhio si giudica peggio di tutte: una bolla
// azzurra attorno al Sole è bella comunque, anche se la Voyager 1 di oggi le
// sta ancora dentro quando l'ha lasciata nel 2012; una spirale è una spirale
// anche col Sole nel braccio sbagliato; e un «due miliardi di anni» scritto
// in una scheda è convincente anche se il conto dietro dice duecento
// milioni. Il giudice è quindi l'aritmetica, contro numeri pubblicati.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

const radice = path.resolve(__dirname, '..');
let verifiche = 0;
function ok(c, m) { assert.ok(c, m); verifiche++; console.log('  ok  ' + m); }

// Le sonde vere di app.js: la tabella si legge dal file, non si ricopia —
// una copia scritta qui divergerebbe al primo aggiornamento delle distanze
const app = fs.readFileSync(path.join(radice, 'app.js'), 'utf8');
const tabella = app.match(/const SOL_SONDE = (\[[\s\S]*?\n\]);/);
const epoca = app.match(/const SOL_SONDE_EPOCA_MS = Date\.UTC\((\d+), (\d+), (\d+)\);/);
assert.ok(tabella && epoca, 'SOL_SONDE in app.js');
global.SOL_SONDE = eval(tabella[1]);
global.SOL_SONDE_EPOCA_MS = Date.UTC(+epoca[1], +epoca[2], +epoca[3]);
const C = require(path.join(radice, 'scala-cosmica.js'));

const gradi = v => {
  const r = Math.hypot(v.x, v.y, v.z);
  return { l: (Math.atan2(v.y, v.x) * 180 / Math.PI + 360) % 360, b: Math.asin(v.z / r) * 180 / Math.PI };
};
const versoreEcl = (lon, lat) => C.cosmEclAGal({
  x: Math.cos(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180),
  y: Math.cos(lat * Math.PI / 180) * Math.sin(lon * Math.PI / 180), z: Math.sin(lat * Math.PI / 180)
});

console.log('1. I piani e le coordinate');
{
  // Andromeda, la Vergine e il centro galattico: coordinate galattiche pubblicate
  const m31 = gradi(C.cosmDaRaDec(10.6847, 41.2690, 1));
  ok(Math.abs(m31.l - 121.17) < 0.1 && Math.abs(m31.b + 21.57) < 0.1, `M31 a l = ${m31.l.toFixed(2)}°, b = ${m31.b.toFixed(2)}°`);
  const vir = gradi(C.cosmDaRaDec(187.7059, 12.3911, 1));
  ok(Math.abs(vir.l - 283.78) < 0.1 && Math.abs(vir.b - 74.49) < 0.1, `M87 a l = ${vir.l.toFixed(2)}°, b = ${vir.b.toFixed(2)}°`);
  const polo = gradi(C.cosmEclAGal({ x: 0, y: 0, z: 1 }));
  ok(Math.abs(polo.l - 96.38) < 0.1 && Math.abs(polo.b - 29.81) < 0.1, `Il polo dell'eclittica a l = ${polo.l.toFixed(2)}°, b = ${polo.b.toFixed(2)}°`);
  const naso = gradi(C.COSM_NASO);
  ok(Math.abs(naso.l - 3.5) < 2 && Math.abs(naso.b - 15.3) < 2, `Il vento interstellare arriva da l = ${naso.l.toFixed(1)}°, b = ${naso.b.toFixed(1)}°`);
  // Andata e ritorno fra eclittica e galattico
  const v = { x: 0.3, y: -0.7, z: 0.648 };
  const w = C.cosmGalAEcl(C.cosmEclAGal(v));
  ok(Math.hypot(w.x - v.x, w.y - v.y, w.z - v.z) < 1e-9, 'Eclittica → galattico → eclittica torna al punto di partenza');
}

console.log('2. Il piano delle due Voyager');
{
  // Il contro-esempio: viste dall'alto sui pianeti le loro distanze sono
  // accorciate (la 1 sale di 35°, la 2 scende di 48°). Sul loro piano no.
  const piano = C.cosmPesiPiano(2.4), eclittica = C.cosmPesiPiano(1.0);
  for (const s of SOL_SONDE) {
    const d = versoreEcl(s.lon, s.lat);
    const sul = C.cosmSullaCarta(d, piano), giu = C.cosmSullaCarta(d, eclittica);
    ok(Math.abs(Math.hypot(sul.x, sul.y) - 1) < 1e-9, `${s.nome}: sul piano delle sonde la distanza è vera`);
    ok(Math.hypot(giu.x, giu.y) < 0.85, `${s.nome}: vista sul piano dei pianeti sarebbe accorciata al ${Math.round(Math.hypot(giu.x, giu.y) * 100)}%`);
    ok(sul.y < 0, `${s.nome}: punta in basso sullo schermo, verso il naso dell'eliosfera`);
  }
}

console.log('3. L\'eliosfera passa dove le sonde l\'hanno attraversata');
{
  const passaggi = { pausa: C.COSM_ELIO.pausa.passaggi, shock: C.COSM_ELIO.shock.passaggi };
  for (const quale of ['pausa', 'shock']) {
    for (const id of ['voyager1', 'voyager2']) {
      const [ms, ua] = passaggi[quale][id];
      const p = C.cosmPosizioneSonda(id, ms);
      const g = C.cosmEclAGal(p), l = Math.hypot(g.x, g.y, g.z);
      // la superficie in quella direzione, letta dalla funzione che la disegna
      const raggio = C.cosmRaggioElio(quale, { x: g.x / l, y: g.y / l, z: g.z / l });
      ok(Math.abs(raggio - ua) < 0.5, `${quale === 'pausa' ? 'Eliopausa' : 'Shock di terminazione'}: in direzione di ${id} vale ${raggio.toFixed(1)} UA (misurato ${ua})`);
    }
  }
}

console.log('4. Le Voyager e le tappe');
{
  const m = C.cosmMisuraSonda('voyager1', Date.UTC(2026, 9, 1));
  ok(m.dalSole > 169 && m.dalSole < 175, `Il 1° ottobre 2026 Voyager 1 è a ${m.dalSole.toFixed(1)} UA`);
  const tappe = C.cosmTappe();
  const anno = id => 1970 + tappe.find(t => t.id === id).quando / (365.25 * 86400000);
  ok(anno('oortDentro') > 2230 && anno('oortDentro') < 2300, `Entra nella nube di Oort verso il ${Math.round(anno('oortDentro'))} (la NASA dice «fra circa trecento anni»)`);
  ok(anno('annoLuce') > 19000 && anno('annoLuce') < 20500, `A un anno luce dal Sole verso l'anno ${Math.round(anno('annoLuce'))}`);
  ok(anno('oortFuori') - 2026 > 25000 && anno('oortFuori') - 2026 < 32000, `Esce dalla nube dopo ${Math.round(anno('oortFuori') - 2026)} anni (la NASA: «circa trentamila»)`);
  const lontana = C.cosmMisuraSonda('voyager1', Date.UTC(2026, 0, 1) + 42000 * 365.25 * 86400000);
  ok(lontana.dalSole / C.COSM_UA_AL > 2 && lontana.dalSole / C.COSM_UA_AL < 3, `Fra 42.000 anni è a ${(lontana.dalSole / C.COSM_UA_AL).toFixed(2)} anni luce: ancora accanto a casa`);
  ok(tappe.every((t, i) => i === 0 || t.quando >= tappe[i - 1].quando), 'Le tappe sono in ordine di tempo');
}

console.log('5. Le misure e la camera');
{
  const ss = C.cosmStrutture();
  ok(ss.length === 11, 'Undici strutture');
  ok(ss.every((s, i) => i === 0 || s.L > ss[i - 1].L), 'Le scale crescono dalla fascia di Kuiper all\'universo');
  ok(ss.every(s => Math.pow(10, s.L) >= s.r), 'Ogni inquadratura contiene la sua struttura');
  const universo = ss.find(s => s.id === 'universo');
  ok(Math.abs(universo.r / C.COSM_UA_AL / 1e9 - 46.5) < 0.01, 'L\'universo osservabile: 46,5 miliardi di anni luce di raggio');
  // La camera non salta mai: fra due scale vicine il centro si sposta di una
  // frazione piccola della vista
  let peggio = 0;
  for (let L = 0.3; L < 15.8; L += 0.005) {
    const a = C.cosmCentro(L), b = C.cosmCentro(L + 0.005);
    peggio = Math.max(peggio, Math.hypot(a.x - b.x, a.y - b.y) / Math.pow(10, L));
  }
  ok(peggio < 0.03, `Il centro scivola senza salti (al peggio ${(peggio * 100).toFixed(2)}% della vista per passo)`);
  ok(C.cosmVisibilita(0.5, 400) === 0 && C.cosmVisibilita(200, 400) === 1 && C.cosmVisibilita(1e7, 400) === 0,
    'Una struttura si vede alla sua scala, e né troppo piccola né troppo grande');
  // Il conto che toglie ogni illusione: Voyager 1 attraverserebbe la Via
  // Lattea in quasi due miliardi di anni
  const v1 = SOL_SONDE.find(s => s.id === 'voyager1');
  const uaAnno = v1.kms * 365.25 * 86400 / 149597870.7;
  const anni = 100000 * C.COSM_UA_AL / uaAnno;
  ok(anni > 1.6e9 && anni < 1.9e9, `Voyager 1 attraverserebbe la Via Lattea in ${(anni / 1e9).toFixed(2)} miliardi di anni`);
  ok(Math.abs(C.cosmLDi('heliopause') - C.cosmLDi('eliopausa')) < 1e-12, 'Gli id delle demo e quelli interni indicano la stessa struttura');
}

console.log(`Motore: ${verifiche} verifiche superate`);
if (process.argv.includes('--solo-motore')) process.exit(0);

// --------------------------------------------------------------------------
// L'interfaccia, in un Chromium vero
// --------------------------------------------------------------------------
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

async function pagina(browser, origine, L, H) {
  const p = await browser.newPage({ viewport: { width: L, height: H }, serviceWorkers: 'block' });
  const errori = [];
  p.on('pageerror', e => errori.push(e.message));
  await p.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origine)) return route.continue();
    if (url.includes('astronomy.browser.min.js'))
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
    if (url.includes('satellite.min.js'))
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(path.dirname(require.resolve('satellite.js/package.json')), 'dist/satellite.min.js')) });
    return route.abort();
  });
  await p.addInitScript(() => {
    localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
  });
  await p.goto(origine, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof sky !== 'undefined' && sky.observer && typeof cosmEntra === 'function', null, { timeout: 30000 });
  return { p, errori };
}

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    const eseguibile = ['/opt/pw-browsers/chromium'].find(f => fs.existsSync(f));
    browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {}).catch(() => chromium.launch());
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });

    for (const [L, H, nome] of [[1280, 800, 'computer'], [390, 760, 'telefono']]) {
      console.log(`6. L'interfaccia su ${nome} (${L}×${H})`);
      const { p, errori } = await pagina(browser, origine, L, H);
      const foto = n => p.screenshot({ path: path.join(radice, `work/cosmo-${nome}-${n}.png`) });
      const fotogrammi = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
      const finito = () => p.waitForFunction(() => !cosm.volo, null, { timeout: 15000 });

      await p.evaluate(() => apriSistemaSolare({ senzaVolo: true }));
      await p.waitForFunction(() => sol.aperto && sol.ctx, null, { timeout: 15000 });
      await p.click('[data-sol-quadro="cosmo"]');
      await finito(); await fotogrammi();
      const ingresso = await p.evaluate(() => ({
        attivo: cosmAttivo(), premuto: document.querySelector('[data-sol-quadro="cosmo"]').getAttribute('aria-pressed'),
        tasti: document.querySelectorAll('#cosm-fila .cosm-tasto').length,
        ricerca: getComputedStyle(document.getElementById('sol-ricerca')).display,
        L: cosm.L, sonde: cosm.schermo.sonde.length, W: sol.L, H: sol.H,
        dentro: cosm.schermo.sonde.every(s => s.x > 0 && s.y > 0 && s.x < sol.L && s.y < sol.H)
      }));
      ok(ingresso.attivo && ingresso.premuto === 'true', 'Il tondo «Scala cosmica» accende il quarto quadro');
      ok(ingresso.tasti === 11, 'La fila: le undici strutture, e niente «Voyager oggi»');
      ok(ingresso.ricerca === 'none', 'La ricerca dei corpi lascia il posto');
      ok(ingresso.sonde === 2 && ingresso.dentro, 'Si entra sulle Voyager di oggi, tutte e due nel quadro');
      await foto('00-voyager');

      // Ogni struttura: un tocco nella fila, il volo, la scheda col suo nome
      const strutture = await p.evaluate(() => cosmStrutture().map(s => s.id));
      for (const [i, id] of strutture.entries()) {
        await p.evaluate(id => document.querySelector(`#cosm-fila [data-cosm-vai="${id}"]`).click(), id);
        await finito(); await fotogrammi();
        const st = await p.evaluate(id => ({
          vicina: (cosmStrutturaDellaScala(cosm.L) || {}).id,
          scheda: !document.getElementById('cosm-scheda').hidden,
          titolo: document.querySelector('#cosm-scheda h3') ? document.querySelector('#cosm-scheda h3').textContent : '',
          nome: astroI18n.t(`cosmo.${id}.nome`),
          attivo: document.querySelector(`#cosm-fila [data-cosm-vai="${id}"]`).classList.contains('attiva')
        }), id);
        ok(st.vicina === id && st.attivo, `${st.nome}: il volo arriva alla sua scala, e il suo tasto si accende`);
        ok(st.scheda && st.titolo === st.nome, `${st.nome}: la scheda col suo nome`);
        await foto(String(i + 1).padStart(2, '0') + '-' + id);
      }

      // La scheda della Via Lattea dice il tempo vero di Voyager 1
      await p.evaluate(() => document.querySelector('#cosm-fila [data-cosm-vai="viaLattea"]').click());
      await finito();
      const lattea = await p.evaluate(() => document.getElementById('cosm-scheda').textContent);
      ok(/miliardi di anni/.test(lattea), 'Via Lattea: Voyager 1 ci metterebbe miliardi di anni ad attraversarla');

      // Le Voyager (v401): solo il posto di oggi. La scheda si apre toccandole,
      // dice dove sono, e le tappe sono un elenco da leggere — niente manopola
      await p.evaluate(() => cosmVolaA(cosmLDi('voyager'), { immediato: true }));
      await fotogrammi();
      await p.evaluate(() => cosmApriSchedaSonde());
      const sonde = await p.evaluate(() => ({
        righe: document.querySelectorAll('#cosm-scheda .cosm-sonda').length,
        tappe: document.querySelectorAll('#cosm-scheda .cosm-tappe li').length,
        manopola: !!document.getElementById('cosm-futuro'),
        testo: document.getElementById('cosm-scheda').textContent
      }));
      ok(sonde.righe === 2 && sonde.tappe >= 10, 'Le Voyager: due righe e le tappe del viaggio');
      ok(!sonde.manopola, 'Le Voyager: nessuna manopola del futuro, si vedono solo oggi');
      ok(/dalla Terra/.test(sonde.testo) && /h \d+ min/.test(sonde.testo), 'Le Voyager: la distanza dalla Terra e il tempo della luce');
      // Il nome delle sonde si scrive alla scala dell'eliosfera e non a ogni
      // scala: a quella della Via Lattea la riga e la carta tacciono
      const nomi = await p.evaluate(() => {
        const scritte = L => {
          cosm.regia = true; cosm.L = cosm.Lvoluto = L;
          const ctx = sol.ctx, f = ctx.fillText, testi = [];
          ctx.fillText = function (t, ...r) { testi.push(String(t)); return f.call(this, t, ...r); };
          try { cosmDisegna(ctx); } finally { ctx.fillText = f; cosm.regia = false; }
          return testi.filter(t => /Voyager/.test(t)).length;
        };
        return { elio: scritte(cosmLDi('voyager')), galassia: scritte(Math.log10(62000 * 63241)) };
      });
      ok(nomi.elio >= 2 && nomi.galassia === 0, `I nomi delle Voyager solo alla scala dell'eliosfera (${nomi.elio} → ${nomi.galassia})`);

      // Il ✕ chiude la scheda
      await p.evaluate(() => document.querySelector('#cosm-scheda [data-cosm-azione="chiudi"]').click());
      ok(await p.evaluate(() => document.getElementById('cosm-scheda').hidden), 'Il ✕ chiude la scheda');
      // La rotella: avvicina e allontana attorno al puntatore (sopra alla
      // tela, non sopra a un comando)
      const prima = await p.evaluate(() => cosm.Lvoluto);
      const punto = await p.evaluate(() => { const r = sol.canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 }; });
      await p.mouse.move(Math.round(punto.x), Math.round(punto.y));
      await p.mouse.wheel(0, 300);
      ok(await p.evaluate(v => cosm.Lvoluto > v, prima), 'La rotella allontana');

      // La camera si gira col dito, come nella vista 3D (v401)
      await p.mouse.move(Math.round(punto.x), Math.round(punto.y));
      await p.mouse.down();
      await p.mouse.move(Math.round(punto.x + 60), Math.round(punto.y - 80), { steps: 8 });
      await p.mouse.up();
      const giro = await p.evaluate(() => ({ az: cosm.az, elev: cosm.elev }));
      ok(Math.abs(giro.az) > 0.2 && giro.elev < 70, `Un dito gira la scena (az ${giro.az.toFixed(2)}, elev ${giro.elev.toFixed(0)}°)`);
      await fotogrammi();
      await foto('21-girata');
      await p.click('#sol-reset');
      await p.waitForFunction(() => Math.abs(cosm.elev - 90) < 0.5 && Math.abs(cosm.az) < 0.01, null, { timeout: 5000 });
      ok(true, 'Il ⟲ rimette la scena vista dall\'alto');

      // Avvicinandosi oltre Kuiper si torna fra i pianeti, e allontanandosi
      // dai pianeti si torna qui (v401)
      await p.evaluate(() => cosmVolaA(1.45, { immediato: true }));
      await p.mouse.move(Math.round(punto.x), Math.round(punto.y));
      for (let i = 0; i < 6 && await p.evaluate(() => cosmAttivo()); i++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(60); }
      ok(await p.evaluate(() => !cosmAttivo() && sol.quadro === 'tutto'), 'Avvicinandosi oltre Kuiper si torna alla vista 3D dei pianeti');
      await p.waitForTimeout(400);
      for (let i = 0; i < 40 && !(await p.evaluate(() => cosmAttivo())); i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(40); }
      ok(await p.evaluate(() => cosmAttivo()), 'Allontanandosi dal Sistema Solare si entra nella scala cosmica');
      for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(40); }
      await p.waitForTimeout(400);
      ok(await p.evaluate(() => cosm.L > Math.log10(150)), 'E continuando si va verso l\'eliopausa');

      // Uscire: «Tutto» torna alla vista 3D di prima
      await p.click('[data-sol-quadro="tutto"]');
      await fotogrammi();
      ok(await p.evaluate(() => !cosmAttivo() && document.getElementById('cosm-interfaccia').hidden), '«Tutto» esce dalla scala cosmica');

      // La ricerca della 3D trova anche le strutture
      await p.fill('#sol-cerca', 'nube di Oort');
      await p.press('#sol-cerca', 'Enter');
      await finito();
      ok(await p.evaluate(() => cosmAttivo() && (cosmStrutturaDellaScala(cosm.L) || {}).id === 'oort'), 'Cercando «nube di Oort» si arriva lì');

      // In inglese
      await p.evaluate(() => astroI18n.impostaLingua('en'));
      await p.evaluate(() => document.querySelector('#cosm-fila [data-cosm-vai="laniakea"]').click());
      await finito(); await fotogrammi();
      const inglese = await p.evaluate(() => ({
        fila: document.getElementById('cosm-fila').textContent, scheda: document.getElementById('cosm-scheda').textContent }));
      ok(/Oort Cloud/.test(inglese.fila) && /Milky Way/.test(inglese.fila), 'In inglese la fila è in inglese');
      ok(/light-years/.test(inglese.scheda) && !/anni luce/.test(inglese.scheda), 'In inglese le misure sono in inglese');
      await p.evaluate(() => astroI18n.impostaLingua('it'));

      // Chiudendo la finestra la scala cosmica si spegne
      await p.evaluate(() => chiudiSistemaSolare());
      ok(await p.evaluate(() => !cosmAttivo()), 'Chiudendo la vista 3D la scala cosmica si spegne');

      // Dal planetario, il tasto del pannello Astri
      await p.evaluate(() => apriScalaCosmica('viaLattea'));
      await p.waitForFunction(() => sol.aperto && cosmAttivo(), null, { timeout: 15000 });
      await finito();
      ok(await p.evaluate(() => (cosmStrutturaDellaScala(cosm.L) || {}).id === 'viaLattea'), 'Dal planetario si apre direttamente sulla Via Lattea');

      // Il costo di un fotogramma, a tutte le scale. Non è un cronometro —
      // un banco senza scheda grafica disegna in software — ma un tetto
      // largo, che prende un disegno che si è messo a fare il triplo. Si
      // misura la **media** su tutti i fotogrammi, che si fanno uno dopo
      // l'altro dentro alla pagina: il canvas registra i comandi e li stende
      // tutti insieme ogni tanto, quindi il tempo del singolo fotogramma in
      // un ciclo stretto non vuol dire niente (l'ha detto una prova: picchi
      // da mezzo secondo a scale sempre diverse, e zero picchi forzando la
      // stesura dopo ogni fotogramma).
      const media = await p.evaluate(() => {
        cosm.regia = true;
        for (let L = 0.5; L <= 15.6; L += 0.25) { cosm.L = cosm.Lvoluto = L; cosmDisegna(sol.ctx); }
        let n = 0;
        const t0 = performance.now();
        for (let giro = 0; giro < 2; giro++) for (let L = 0.5; L <= 15.6; L += 0.05) { cosm.L = cosm.Lvoluto = L; cosmDisegna(sol.ctx); n++; }
        sol.ctx.getImageData(0, 0, 1, 1);
        cosm.regia = false;
        return (performance.now() - t0) / n;
      });
      ok(media < 25, `Un fotogramma della scala cosmica costa in media ${media.toFixed(1)} ms, su tutte le scale`);
      ok(!errori.length, 'Nessun errore di pagina: ' + errori.join(' | '));
      await p.close();
    }
    console.log(`Scala cosmica: ${verifiche} verifiche superate`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
