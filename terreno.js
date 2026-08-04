// =====================================================================
// IL TERRENO VERO
//
// L'orizzonte del planetario era inventato. Un profilo bello — onde
// lunghe per le colline, macchie strette per gli alberi — ma sempre lo
// stesso: identico a Milano, a Bolzano e in mezzo al mare. E l'orizzonte
// è esattamente la cosa che *non* è uguale dappertutto: è la prima cosa
// che uno riconosce guardando fuori, ed è quella che decide davvero se
// stanotte quel pianeta basso lo vedrai o no.
//
// Qui il profilo si prende dalla terra vera. Attorno all'osservatore si
// campiona la quota del suolo lungo quarantotto direzioni e dodici
// distanze, dai duecento metri ai sessanta chilometri, e per ogni
// campione si calcola sotto che angolo lo si vede. Il massimo lungo una
// direzione è l'orizzonte in quella direzione: la cresta che nasconde
// tutto quello che le sta dietro.
//
// I dati sono quelli di Open-Meteo (Copernicus DEM, novanta metri di
// passo), lo stesso servizio del meteo: niente chiave, niente account,
// e già escluso dalla cache del service worker.
//
// Tre cose che non fa, e che è giusto sapere:
//
//   - non conosce i palazzi. Il DEM è il **suolo**: la collina c'è, il
//     condominio di fronte no. Per quello resta il profilo a sedici
//     settori di `pianifica.js`, che l'utente riempie a mano, e i due si
//     sommano prendendo il più alto dei due.
//   - non conosce gli alberi. La fila di pioppi in fondo al campo la
//     mette ancora la finzione di `app.js`, come dettaglio sopra alla
//     forma vera del terreno.
//   - novanta metri di passo e quarantotto direzioni non fanno un
//     panorama fotografico. Fanno la **conformazione**: dove il terreno
//     sale, dove sprofonda la valle, da che parte c'è la montagna. Che è
//     poi la domanda a cui serve rispondere.
//
// Ordine di caricamento: dopo app.js (usa `luogoCorrente`, `sky`,
// `skyChiediRidisegno`), prima o dopo pianifica.js indifferentemente.
// =====================================================================


// =====================================================================
// 1. DOVE SI GUARDA E QUANTO LONTANO
// =====================================================================

const CHIAVE_TERRENO = 'astrocalendario_terreno';

// Quarantotto direzioni: una ogni 7°30′, cioè mezzo settore della rosa
// dei venti. Più di così le richieste diventano tante e il DEM non ha
// comunque il dettaglio per meritarsele.
const TERRENO_DIREZIONI = 48;
const TERRENO_PASSO_AZ = 360 / TERRENO_DIREZIONI;

// Le distanze, in chilometri. Fitte da vicino e rade da lontano, perché
// da vicino un metro di dislivello conta gradi e a cinquanta chilometri
// non conta più niente. Oltre i sessanta chilometri la curvatura ha già
// nascosto tutto quello che non è una montagna vera — e le montagne vere
// a quella distanza le prende il campione dei sessanta.
const TERRENO_DISTANZE = [0.2, 0.4, 0.8, 1.5, 2.5, 4, 6.5, 10, 16, 25, 40, 60];

// Open-Meteo accetta cento coordinate per richiesta. Novantasei sono due
// direzioni intere per volta, il che rende le richieste tutte uguali.
const TERRENO_PER_RICHIESTA = 96;

// Raggio terrestre e coefficiente di rifrazione standard. La luce che
// rade il terreno si incurva verso il basso seguendo l'aria che si dirada
// con la quota, e questo fa vedere **più lontano** di quanto la geometria
// pura permetterebbe: il trucco di sempre è far finta che la Terra sia
// più grande di quello che è, di circa un settimo.
const TERRENO_RAGGIO_KM = 6371;
const TERRENO_RIFRAZIONE = 0.13;

// L'occhio non sta per terra.
const TERRENO_ALTEZZA_OCCHIO_M = 1.6;

// Oltre questo, non è più un orizzonte: è una parete, e quasi sempre è un
// dato sbagliato.
const TERRENO_ALT_MAX = 60;

// Quanto ci si può spostare prima che il profilo non valga più. Due
// chilometri: dentro un paese l'orizzonte lontano è lo stesso, e non ha
// senso riscaricarlo perché ci si è spostati di un isolato.
const TERRENO_RAGGIO_VALIDO_KM = 2;


// =====================================================================
// 2. LO STATO
// =====================================================================

const terreno = {
  stato: 'niente',        // niente | in-corso | pronto | fallito | spento
  lat: null,
  lon: null,
  quota: null,            // quota del suolo sotto l'osservatore, in metri
  profilo: null,          // Float32Array(361): l'altezza dell'orizzonte, grado per grado
  quando: 0,
  motivo: '',             // perché non c'è, quando non c'è
  acceso: true
};


// =====================================================================
// 3. GEOMETRIA
// =====================================================================

// Il punto che sta a `km` chilometri in direzione `az` dall'osservatore.
// Formula del cammino diretto sulla sfera: a queste distanze la differenza
// con un ellissoide vero è di qualche metro, cioè niente.
function terrenoPuntoA(lat, lon, az, km) {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const d = km / TERRENO_RAGGIO_KM;
  const la = lat * D2R, a = az * D2R;
  const sinLa = Math.sin(la), cosLa = Math.cos(la);
  const sinD = Math.sin(d), cosD = Math.cos(d);
  const la2 = Math.asin(sinLa * cosD + cosLa * sinD * Math.cos(a));
  const lo2 = lon * D2R + Math.atan2(Math.sin(a) * sinD * cosLa, cosD - sinLa * Math.sin(la2));
  // La longitudine va riportata fra −180 e 180, se no oltre l'antimeridiano
  // il servizio rifiuta la richiesta
  return { lat: la2 * R2D, lon: (((lo2 * R2D + 540) % 360) - 180) };
}

// Sotto che angolo si vede un punto alto `quota` metri a `km` di distanza,
// stando a `occhio` metri di quota.
//
// Due termini. Il dislivello diviso la distanza — la pendenza, che è
// l'unica cosa che conterebbe su una Terra piatta. E l'abbassamento per
// curvatura, che a dieci chilometri vale già sette metri e a sessanta
// duecentocinquanta: è il motivo per cui il mare finisce, e per cui una
// collina lontana si vede più bassa di quanto sarebbe se il mondo fosse
// un tavolo.
function terrenoAngolo(quota, occhio, km) {
  const s = km * 1000;
  const abbassa = (1 - TERRENO_RIFRAZIONE) * s * s / (2 * TERRENO_RAGGIO_KM * 1000);
  return Math.atan2(quota - occhio - abbassa, s) * 180 / Math.PI;
}


// =====================================================================
// 4. PRENDERE LE QUOTE
// =====================================================================

function terrenoUrl(punti) {
  const lat = punti.map(p => p.lat.toFixed(5)).join(',');
  const lon = punti.map(p => p.lon.toFixed(5)).join(',');
  return `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
}

async function terrenoQuote(punti) {
  const risposta = await fetch(terrenoUrl(punti));
  if (!risposta.ok) throw new Error('quote non disponibili (' + risposta.status + ')');
  const dati = await risposta.json();
  if (!dati || !Array.isArray(dati.elevation)) throw new Error('risposta senza quote');
  return dati.elevation;
}


// =====================================================================
// 5. COSTRUIRE IL PROFILO
// =====================================================================

// Da quarantotto creste a trecentosessantuno gradi. Si interpola in modo
// circolare — il settore fra l'ultimo e il primo esiste come tutti gli
// altri — e non a spezzata ma con una media pesata sui due vicini, che
// non fa gli spigoli.
function terrenoInterpola(creste) {
  const p = new Float32Array(361);
  const n = creste.length;
  for (let g = 0; g <= 360; g++) {
    const dove = (g % 360) / TERRENO_PASSO_AZ;
    const i = Math.floor(dove) % n;
    const j = (i + 1) % n;
    const t = dove - Math.floor(dove);
    // Interpolazione con la curva a S invece che dritta: le creste sono
    // punti di massimo, e unirle con dei segmenti fa un profilo a
    // capanna che si vede subito per finto
    const s = t * t * (3 - 2 * t);
    p[g] = creste[i] * (1 - s) + creste[j] * s;
  }
  return p;
}

async function terrenoCostruisci(lat, lon) {
  // Prima la quota di casa: senza sapere da che altezza si guarda, ogni
  // angolo è sbagliato — e sbagliato tanto, perché è il termine che si
  // sottrae a tutti gli altri.
  const [quotaCasa] = await terrenoQuote([{ lat, lon }]);
  const occhio = (typeof quotaCasa === 'number' ? quotaCasa : 0) + TERRENO_ALTEZZA_OCCHIO_M;

  // Tutti i campioni in fila, poi tagliati in richieste da novantasei.
  const punti = [];
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    const az = i * TERRENO_PASSO_AZ;
    TERRENO_DISTANZE.forEach(km => punti.push(terrenoPuntoA(lat, lon, az, km)));
  }

  const quote = [];
  for (let i = 0; i < punti.length; i += TERRENO_PER_RICHIESTA) {
    // Una per volta e non tutte insieme: sono sei richieste allo stesso
    // servizio, e mandarle in parallelo è il modo più veloce di farsi
    // rispondere «troppe richieste».
    /* eslint-disable no-await-in-loop */
    const pezzo = await terrenoQuote(punti.slice(i, i + TERRENO_PER_RICHIESTA));
    quote.push(...pezzo);
  }
  if (quote.length !== punti.length) throw new Error('quote incomplete');

  const creste = new Array(TERRENO_DIREZIONI).fill(0);
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    let massimo = 0;
    for (let k = 0; k < TERRENO_DISTANZE.length; k++) {
      const q = quote[i * TERRENO_DISTANZE.length + k];
      if (typeof q !== 'number') continue;
      const a = terrenoAngolo(q, occhio, TERRENO_DISTANZE[k]);
      if (a > massimo) massimo = a;
    }
    // Sotto zero non si scende: da una cima l'orizzonte vero è **sotto**
    // la linea, ma tutto il resto dell'app dà per scontato che la terra
    // cominci a zero gradi — dal riempimento del terreno alla curva della
    // notte. Meglio un orizzonte piatto che un'app che si contraddice.
    creste[i] = Math.max(0, Math.min(TERRENO_ALT_MAX, massimo));
  }

  return { quota: quotaCasa, creste };
}


// =====================================================================
// 6. TENERSELO
//     Sei richieste per un profilo che non cambia mai — le colline non si
//     spostano — sono sei richieste da fare una volta sola nella vita di
//     quel posto. Il salvato vale finché non ci si allontana di due
//     chilometri.
// =====================================================================

function terrenoDistanzaKm(la1, lo1, la2, lo2) {
  const D2R = Math.PI / 180;
  const dLa = (la2 - la1) * D2R;
  const dLo = (lo2 - lo1) * D2R * Math.cos((la1 + la2) / 2 * D2R);
  return Math.hypot(dLa, dLo) * TERRENO_RAGGIO_KM;
}

function terrenoLeggiSalvato(lat, lon) {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_TERRENO) || 'null');
    if (!v || !Array.isArray(v.creste) || v.creste.length !== TERRENO_DIREZIONI) return null;
    if (terrenoDistanzaKm(lat, lon, v.lat, v.lon) > TERRENO_RAGGIO_VALIDO_KM) return null;
    return v;
  } catch (e) {
    return null;
  }
}

function terrenoSalva(lat, lon, dati) {
  try {
    localStorage.setItem(CHIAVE_TERRENO, JSON.stringify({
      lat, lon, quota: dati.quota, creste: dati.creste, quando: Date.now()
    }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

// Butta via quello che c'è in memoria. Serve al ripristino di un backup,
// che scrive direttamente in localStorage.
function terrenoDimentica() {
  terreno.stato = 'niente';
  terreno.profilo = null;
  terreno.lat = terreno.lon = null;
}


// =====================================================================
// 7. L'INNESCO
// =====================================================================

function terrenoApplica(lat, lon, dati, sorgente) {
  terreno.lat = lat;
  terreno.lon = lon;
  terreno.quota = dati.quota;
  terreno.profilo = terrenoInterpola(dati.creste);
  terreno.stato = 'pronto';
  terreno.motivo = '';
  terreno.quando = Date.now();
  terreno.sorgente = sorgente;
  // Non serve chiedere un ridisegno: il planetario ridisegna a ogni
  // fotogramma, e al primo utile la collina nuova è già lì.
  terrenoAggiornaPannello();
}

// Si chiama ogni volta che la posizione può essere cambiata: all'apertura
// del planetario e dopo `skyImpostaPosizione`. Se il profilo che c'è vale
// ancora per dove siamo, non fa niente.
function terrenoCarica(forza) {
  if (!terreno.acceso) return Promise.resolve(false);

  const luogo = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
  if (!luogo || typeof luogo.lat !== 'number' || typeof luogo.lon !== 'number') {
    return Promise.resolve(false);
  }
  const lat = luogo.lat, lon = luogo.lon;

  if (!forza && terreno.stato === 'pronto' && terreno.lat !== null &&
      terrenoDistanzaKm(lat, lon, terreno.lat, terreno.lon) <= TERRENO_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  if (terreno.stato === 'in-corso') return terreno.promessa || Promise.resolve(false);

  if (!forza) {
    const salvato = terrenoLeggiSalvato(lat, lon);
    if (salvato) {
      terrenoApplica(salvato.lat, salvato.lon, salvato, 'salvato');
      return Promise.resolve(true);
    }
  }

  terreno.stato = 'in-corso';
  terreno.motivo = '';
  terrenoAggiornaPannello();

  terreno.promessa = terrenoCostruisci(lat, lon)
    .then(dati => {
      terrenoSalva(lat, lon, dati);
      terrenoApplica(lat, lon, dati, 'rete');
      return true;
    })
    .catch(e => {
      // Senza rete resta il profilo inventato, che è esattamente com'era
      // prima: l'app non deve accorgersi di niente.
      console.warn('Terreno vero non disponibile:', e);
      terreno.stato = 'fallito';
      terreno.motivo = 'Non sono riuscito a scaricare la forma del terreno: resta l\'orizzonte disegnato.';
      terrenoAggiornaPannello();
      return false;
    })
    .finally(() => { terreno.promessa = null; });

  return terreno.promessa;
}


// =====================================================================
// 8. QUELLO CHE SERVE AL PLANETARIO
//     Una funzione sola, e la chiama `skyAltezzaOrizzonte`: quanto è alta
//     la cresta in quella direzione, o `null` se il terreno vero non c'è
//     e vale ancora il profilo inventato.
// =====================================================================

function terrenoAltezza(az) {
  if (!terreno.acceso || terreno.stato !== 'pronto' || !terreno.profilo) return null;
  const x = (((az % 360) + 360) % 360);
  const i = Math.floor(x);
  const t = x - i;
  return terreno.profilo[i] + (terreno.profilo[i + 1] - terreno.profilo[i]) * t;
}

function terrenoDisponibile() {
  return terreno.acceso && terreno.stato === 'pronto' && !!terreno.profilo;
}

// Il punto più alto e quello più basso del giro: è il modo più corto di
// dire com'è fatto il posto in cui sei.
function terrenoRiassunto() {
  if (!terrenoDisponibile()) return null;
  let alto = -1, altoAz = 0, basso = 999;
  for (let g = 0; g < 360; g++) {
    if (terreno.profilo[g] > alto) { alto = terreno.profilo[g]; altoAz = g; }
    if (terreno.profilo[g] < basso) basso = terreno.profilo[g];
  }
  return {
    alto, altoAz, basso,
    quota: terreno.quota,
    direzione: typeof skyNomeDirezione === 'function' ? skyNomeDirezione(altoAz) : ''
  };
}

function terrenoAlterna() {
  terreno.acceso = !terreno.acceso;
  if (terreno.acceso && terreno.stato !== 'pronto') terrenoCarica();
  // Non serve chiedere un ridisegno: il planetario ridisegna a ogni
  // fotogramma, e al primo utile la collina nuova è già lì.
  terrenoAggiornaPannello();
}


// =====================================================================
// 9. IL TASTO E LA RIGA CHE DICE COM'È ANDATA
//
//     Sta nel pannello Visualizzazione del planetario, accanto a
//     «Atmosfera»: sono la stessa cosa — quanto il disegno somiglia a
//     quello che si vede fuori dalla finestra.
// =====================================================================

function terrenoTesto() {
  if (!terreno.acceso) return 'Orizzonte disegnato: colline finte, uguali dappertutto.';
  if (terreno.stato === 'in-corso') return 'Sto misurando com\'è fatto il terreno attorno a te…';
  if (terreno.stato === 'fallito') return terreno.motivo;

  const r = terrenoRiassunto();
  if (!r) return 'Apri il planetario da un posto con la rete e prendo la forma vera del terreno qui attorno.';

  const quota = typeof r.quota === 'number' ? `Sei a ${Math.round(r.quota)} m. ` : '';
  if (r.alto < 0.35) {
    return quota + 'Attorno a te il terreno è piatto: orizzonte libero in tutte le direzioni.';
  }
  return quota + `Il punto più alto dell'orizzonte è a ${r.alto.toFixed(1)}° verso ${r.direzione}. ` +
    (r.basso < 0.35
      ? 'Dalla parte opposta il terreno non copre niente.'
      : `Il più basso è a ${r.basso.toFixed(1)}°.`);
}

function terrenoAggiornaPannello() {
  const tasto = document.getElementById('skymap-btn-terreno');
  if (tasto) {
    const acceso = terreno.acceso;
    tasto.classList.toggle('attiva', acceso);
    tasto.setAttribute('aria-pressed', acceso ? 'true' : 'false');
    tasto.textContent = terreno.stato === 'in-corso' ? 'Terreno vero…' : 'Terreno vero';
  }
  const nota = document.getElementById('skymap-terreno-nota');
  if (nota) nota.textContent = terrenoTesto();
}
