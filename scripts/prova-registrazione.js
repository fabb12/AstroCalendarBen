// La firma del filmato e la fotografia del riquadro informativo, in un
// browser vero.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-registrazione.js
//
// Sono due famiglie di difetti e hanno in comune il modo di non farsi vedere.
// Un filmato di stelle è bello comunque: nessuno, guardandolo, dice «qui il
// nome del luogo è stato accorciato a un carattere» o «questo riquadro porta
// l'icona dell'immagine rotta al posto della fotografia» — e chi lo ha
// registrato lo scopre quando lo manda a qualcuno. Il giudice non può essere
// l'occhio, perché la registrazione avviene su una tela fuori schermo che
// nessuno guarda mentre si forma: si registra allora **cosa** viene scritto
// e con che geometria (il contesto del canvas è finto e annota le scritte
// invece di dipingerle, come fa `prova-abitati.js`) e **cosa** finisce nella
// fotografia SVG del riquadro, che si può rileggere perché è un data URL.
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORTA = 8104;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]);
  // Un indirizzo che non risponde mai: serve alla prova della scadenza, ed è
  // il caso vero — una rete che c'è, accetta la connessione e poi tace.
  if (nome.indexOf('/mai-risponde') === 0) return;
  const file = path.join(RADICE, nome === '/' ? 'index.html' : nome);
  if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'text/plain' });
  res.end(fs.readFileSync(file));
});

let falliti = 0;
function prova(nome, condizione, dettaglio) {
  const ok = !!condizione;
  if (!ok) falliti += 1;
  console.log(`${ok ? 'ok' : 'FALLITO'} — ${nome}`, dettaglio === undefined ? '' : dettaglio);
}

(async () => {
  await new Promise(resolve => server.listen(PORTA, resolve));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const contesto = await browser.newContext({ serviceWorkers: 'block' });
    const pagina = await contesto.newPage();
    await pagina.route('**/*', rotta => {
      const url = rotta.request().url();
      if (url.startsWith(`http://localhost:${PORTA}/`)) return rotta.continue();
      return rotta.abort();
    });
    await pagina.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'domcontentloaded' });

    // --- La firma -----------------------------------------------------------
    const firma = await pagina.evaluate(() => {
      // Un contesto che annota invece di dipingere. Le misure però devono
      // essere quelle vere, se no la prova non giudica niente: `measureText`
      // passa a un contesto autentico, che tiene anche il carattere.
      function ctxFinto() {
        const vero = document.createElement('canvas').getContext('2d');
        const scritte = [];
        return {
          scritte,
          get font() { return vero.font; },
          set font(v) { vero.font = v; },
          fillStyle: '', textAlign: 'left', textBaseline: '',
          shadowColor: '', shadowBlur: 0,
          save() {}, restore() {},
          measureText(t) { return vero.measureText(t); },
          fillText(t, x, y) { scritte.push({ testo: t, x, y, allineamento: this.textAlign, font: vero.font }); }
        };
      }

      const LUOGO = 'Sasso Marconi, Bologna, Emilia-Romagna';
      skyLuogoDelCielo = () => ({ lat: 44.4, lon: 11.25, nome: LUOGO });
      skyAdesso = () => new Date(2026, 8, 19, 22, 14);

      const raccogli = (L, H) => {
        const ctx = ctxFinto();
        skyRegFirma(ctx, L, H);
        const misura = Math.max(11, Math.round(H / 34));
        const margine = Math.round(misura * 1.1);
        const vero = document.createElement('canvas').getContext('2d');
        return {
          L, H, margine,
          righe: ctx.scritte.map(s => {
            vero.font = s.font;
            return { ...s, largo: vero.measureText(s.testo).width };
          })
        };
      };

      // Il contro-esempio, cioè il conto di prima: una riga sola, la data
      // intera e il luogo accorciato con quello che resta.
      const vero = document.createElement('canvas').getContext('2d');
      const misuraV = Math.max(11, Math.round(1080 / 34));
      const margineV = Math.round(misuraV * 1.1);
      vero.font = `600 ${misuraV}px system-ui, sans-serif`;
      const data = new Date(2026, 8, 19, 22, 14).toLocaleString('it-IT', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const restava = Math.max(0, (526 - margineV * 2) - vero.measureText(`${data} · `).width);
      return {
        orizzontale: raccogli(1080, 608),
        verticale: raccogli(526, 1080),
        senzaLuogo: (() => { skyLuogoDelCielo = () => null; return raccogli(526, 1080); })(),
        luogo: LUOGO,
        comeEraPrima: skyRegTestoEntro(vero, LUOGO, restava)
      };
    });

    const testoDi = esito => esito.righe.map(r => r.testo);
    const orizzontali = testoDi(firma.orizzontale);
    const verticali = testoDi(firma.verticale);

    // Su un fotogramma largo niente cambia: data e luogo stanno in una riga
    // sola, che è la forma più compatta e va preferita quando ci sta.
    const rigaSola = orizzontali.filter(t => t.includes(firma.luogo)).length === 1 &&
      orizzontali.some(t => t.includes('·') && t.includes(firma.luogo) && t.includes('settembre'));
    prova('su un fotogramma largo data e luogo restano in una riga sola', rigaSola, orizzontali);

    // Il difetto: verticale, la data si prende quasi tutta la riga e del
    // luogo restava un carattere e i puntini.
    const primaEraTagliato = firma.comeEraPrima.length < firma.luogo.length / 3;
    prova('col conto di prima, in verticale, del luogo non restava niente',
      primaEraTagliato, `«${firma.comeEraPrima}» invece di «${firma.luogo}»`);

    // Il luogo si legge per intero: a capo, e su due righe se una non basta.
    // La prova è la riunione delle sue righe, non una riga sola, perché è la
    // spezzatura che fa la differenza fra un nome leggibile e un carattere
    // seguito dai puntini.
    const luogoRicomposto = verticali.filter(t => firma.luogo.indexOf(t.replace(/…$/, '')) !== -1)
      .join(' ').replace(/\s+/g, ' ').trim();
    prova('in verticale il luogo va a capo e si legge per intero',
      luogoRicomposto === firma.luogo, { luogoRicomposto, righe: verticali });

    const dataIntera = verticali.some(t => t.includes('2026') && t.includes('22:14'));
    prova('e la data resta con lui, intera', dataIntera, verticali);

    const dentroIlBordo = firma.verticale.righe.every(r =>
      r.allineamento === 'right'
        ? r.x - r.largo >= -0.5
        : r.x + r.largo <= firma.verticale.L - firma.verticale.margine + 0.5);
    prova('nessuna riga della firma esce dal fotogramma', dentroIlBordo,
      firma.verticale.righe.map(r => `${r.testo}: ${Math.round(r.x)}+${Math.round(r.largo)}`));

    // Due scritte alla stessa altezza sono due scritte sovrapposte, e in un
    // filmato non si possono separare dopo.
    const quote = {};
    let sovrapposte = false;
    firma.verticale.righe.forEach(r => {
      const q = Math.round(r.y);
      if (quote[q] && (quote[q].allineamento === r.allineamento)) sovrapposte = true;
      quote[q] = r;
    });
    prova('e non ce ne sono due alla stessa altezza dallo stesso lato', !sovrapposte,
      firma.verticale.righe.map(r => `${Math.round(r.y)}: ${r.testo}`));

    const marchio = firma.verticale.righe.some(r => r.testo === 'AstroCalendario di Ben');
    prova('il marchio c’è comunque', marchio, verticali);

    // Senza luogo — il cielo di un punto senza nome, o la posizione non
    // ancora arrivata — la firma torna a essere quella di sempre.
    const senzaLuogo = testoDi(firma.senzaLuogo);
    prova('senza luogo resta la sola data, senza righe vuote',
      senzaLuogo.length === 2 && senzaLuogo.some(t => t.includes('2026')), senzaLuogo);

    // --- La fotografia del riquadro ----------------------------------------
    const foto = await pagina.evaluate(async () => {
      const facciaRiquadro = () => {
        const p = document.createElement('div');
        p.style.cssText = 'position:fixed;left:0;top:0;width:280px;background:#0b1220';
        p.innerHTML = '<div id="aereo-foto-prova">' +
          '<img class="aereo-foto" src="" alt="Foto dell’aereo UAE3Q" width="240" height="140">' +
          '<p class="aereo-foto-credito">Foto: Tristan Gruber</p></div>' +
          '<ul><li>Partenza: Dubai (DXB)</li><li>Quota: 12.192 m</li></ul>';
        document.body.appendChild(p);
        return p;
      };
      const svgDi = pannello => {
        const voce = sky.reg.riquadri.get(pannello);
        const src = voce && voce.immagine && voce.immagine.src;
        if (!src || src.indexOf('data:image/svg+xml') !== 0) return '';
        return decodeURIComponent(src.slice(src.indexOf(',') + 1));
      };

      const esito = {};
      const fetchVero = window.fetch;

      // 1. La fotografia si prende con la `fetch`, che è la strada breve.
      sky.reg.foto.clear(); sky.reg.riquadri.clear();
      let uno = facciaRiquadro();
      uno.querySelector('img').src = location.origin + '/icon-192.png';
      await skyRegFotografaRiquadro(uno, 'a');
      const svgUno = svgDi(uno);
      esito.conFetch = {
        incorporata: /src="data:image\/png/.test(svgUno),
        creditoResta: svgUno.indexOf('Tristan Gruber') !== -1,
        senzaIndirizzi: !/src="http/.test(svgUno)
      };
      uno.remove();

      // 2. La `fetch` non arriva (il service worker in mezzo, una regola
      //    `connect-src`, una voce di cache opaca): la seconda strada carica
      //    la stessa immagine chiedendo il CORS e la ricopia su una tela.
      sky.reg.foto.clear(); sky.reg.riquadri.clear();
      window.fetch = () => Promise.reject(new Error('niente fetch'));
      let due = facciaRiquadro();
      due.querySelector('img').src = location.origin + '/icon-192.png';
      await skyRegFotografaRiquadro(due, 'b');
      const svgDue = svgDi(due);
      esito.conTela = {
        incorporata: /src="data:image\/jpeg/.test(svgDue),
        creditoResta: svgDue.indexOf('Tristan Gruber') !== -1
      };
      due.remove();
      window.fetch = fetchVero;

      // 3. Non si può in nessun modo: la fotografia se ne va, e con lei la
      //    firma del fotografo di una fotografia che non c'è.
      sky.reg.foto.clear(); sky.reg.riquadri.clear();
      let tre = facciaRiquadro();
      tre.querySelector('img').src = 'https://t.plnspttrs.net/non-esiste.jpg';
      await skyRegFotografaRiquadro(tre, 'c');
      const svgTre = svgDi(tre);
      esito.senzaFoto = {
        nessunaImmagine: !/<img/.test(svgTre),
        nessunCredito: svgTre.indexOf('Tristan Gruber') === -1,
        nessunTestoAlternativo: svgTre.indexOf('UAE3Q') === -1,
        restaIlResto: svgTre.indexOf('Dubai (DXB)') !== -1
      };
      tre.remove();

      // 4. Una risposta che arriva e non è un'immagine — il `504` sintetico
      //    del service worker, una pagina d'errore HTML — non è una
      //    fotografia: si scarta qui, dove si sa ancora cos'è.
      sky.reg.foto.clear();
      window.fetch = () => Promise.resolve(new Response('<html>ops</html>', {
        status: 200, headers: { 'Content-Type': 'text/html' }
      }));
      esito.paginaDErrore = await skyRegFotoDaFetch(location.origin + '/icon-192.png');
      window.fetch = () => Promise.resolve(new Response('', { status: 504 }));
      esito.cinqueZeroQuattro = await skyRegFotoDaFetch(location.origin + '/icon-192.png');
      window.fetch = fetchVero;

      // 5. L'esito si tiene per indirizzo: l'impronta del riquadro cambia a
      //    ogni battito (i numeri di un aereo si riscrivono una volta al
      //    secondo), quindi senza memoria la stessa fotografia si andrebbe a
      //    richiedere per tutta la durata della registrazione.
      sky.reg.foto.clear();
      let richieste = 0;
      window.fetch = (...a) => { richieste += 1; return fetchVero.apply(window, a); };
      const indirizzo = location.origin + '/icon-512.png';
      await Promise.all([skyRegFotoIncorporata(indirizzo), skyRegFotoIncorporata(indirizzo)]);
      await skyRegFotoIncorporata(indirizzo);
      window.fetch = fetchVero;
      esito.richieste = richieste;

      // 6. Il fumetto: lì se ne va tutta la `<figure>`, come fa `satFotoTogli`
      //    quando la fotografia di una stazione non arriva.
      const fumetto = document.createElement('div');
      fumetto.innerHTML = '<figure class="fumetto-foto"><img alt="x">' +
        '<figcaption>Foto: Tizio</figcaption></figure><p class="fumetto-riga">A 12 km</p>';
      skyRegNascondiFoto(fumetto.querySelector('img'));
      esito.fumetto = {
        cornice: !fumetto.querySelector('.fumetto-foto'),
        restaIlResto: fumetto.textContent.indexOf('12 km') !== -1
      };
      return esito;
    });

    prova('la fotografia del riquadro finisce nel filmato',
      foto.conFetch.incorporata && foto.conFetch.creditoResta && foto.conFetch.senzaIndirizzi,
      foto.conFetch);
    prova('e ci finisce anche quando la fetch non arriva a destinazione',
      foto.conTela.incorporata && foto.conTela.creditoResta, foto.conTela);
    prova('una fotografia che non si può incorporare se ne va insieme al suo credito',
      foto.senzaFoto.nessunaImmagine && foto.senzaFoto.nessunCredito &&
      foto.senzaFoto.nessunTestoAlternativo && foto.senzaFoto.restaIlResto, foto.senzaFoto);
    prova('una pagina d’errore servita al posto della fotografia non è una fotografia',
      foto.paginaDErrore === null && foto.cinqueZeroQuattro === null,
      { html: foto.paginaDErrore, errore: foto.cinqueZeroQuattro });
    prova('la stessa fotografia si chiede una volta sola', foto.richieste === 1, foto.richieste);
    prova('nel fumetto se ne va tutta la cornice, didascalia compresa',
      foto.fumetto.cornice && foto.fumetto.restaIlResto, foto.fumetto);

    // E la registrazione parte comunque. Aspettare che la scheda sia pronta
    // serve — se no nei filmati da cinque secondi la fotografia arrivava a
    // registrazione già finita — ma è una promessa che con la rete in mezzo
    // non si può fare senza limite: una richiesta che non torna terrebbe il
    // dito premuto sul tasto per sempre, cioè un filmato che non comincia.
    const scadenza = await pagina.evaluate(async () => {
      const fetchVero = window.fetch;
      window.fetch = () => new Promise(() => {});   // accetta e tace
      const vero = document.getElementById('skymap-dettaglio');
      vero.id = 'skymap-dettaglio-vero';
      const finto = document.createElement('div');
      finto.id = 'skymap-dettaglio';
      finto.className = 'visibile';
      finto.style.cssText = 'position:fixed;left:0;top:0;width:280px;height:200px;background:#0b1220';
      finto.innerHTML = '<div id="skymap-dettaglio-corpo"><div id="aereo-foto-muto">' +
        '<img src="/mai-risponde.jpg" alt="Foto dell’aereo"></div><p>Quota: 12.192 m</p></div>';
      document.body.appendChild(finto);
      sky.reg.foto.clear(); sky.reg.riquadri.clear();
      const t0 = performance.now();
      await skyRegPreparaSchedeVisibili();
      const durata = performance.now() - t0;
      finto.remove();
      vero.id = 'skymap-dettaglio';
      window.fetch = fetchVero;
      return { durata: Math.round(durata), tetto: SKY_REG_PREPARA_MAX_MS };
    });
    prova('con una rete che tace la registrazione parte comunque, entro la scadenza',
      scadenza.durata >= scadenza.tetto - 50 && scadenza.durata < scadenza.tetto + 800, scadenza);

    await contesto.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (falliti) process.exitCode = 1;
  console.log(falliti ? `\n✗ ${falliti} prove fallite` : '\n✓ tutte le prove passate');
})().catch(errore => {
  console.error(errore);
  server.close();
  process.exitCode = 1;
});
