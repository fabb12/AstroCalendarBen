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

// Quanti posti si tengono da parte. Uno solo non basta più da quando il
// planetario può andare a guardare il cielo di un'altra città: si va a
// vedere Bolzano, si torna a casa, e casa andrebbe riscaricata da capo —
// sei richieste per delle colline che non si sono mosse. Quattro coprono
// casa, il posto delle osservazioni e le due città guardate per curiosità.
const TERRENO_POSTI_SALVATI = 4;

// Quanto sotto si scende prima di dire «qui è acqua». I modelli del suolo
// non dicono dov'è il mare: ci mettono uno zero e via. Ma uno zero ripetuto
// per dieci campioni in fila, a dieci, venti, quaranta chilometri, non è una
// pianura: le pianure vere non sono piatte al centimetro. Mezzo metro di
// tolleranza copre le maree e gli errori del modello senza prendersi la
// pianura padana per l'Adriatico.
const TERRENO_MARE_QUOTA = 0.5;
const TERRENO_MARE_FRAZIONE = 0.75;   // quanta parte dei campioni lontani
const TERRENO_MARE_DA_KM = 1.5;       // sotto questa distanza non conta

// Le soglie fra un paesaggio e l'altro. Sono due misure diverse e servono
// tutt'e due: l'angolo dice quanto quella cosa **copre** (è la domanda
// dell'astronomo), il dislivello dice che cos'**è** (è la domanda di chi
// guarda fuori dalla finestra). Una montagna a cinquanta chilometri copre
// due gradi scarsi ma resta una montagna, e va detto.
const TERRENO_SOGLIA_MONTAGNA_GRADI = 2.0;
const TERRENO_SOGLIA_MONTAGNA_M = 600;
const TERRENO_SOGLIA_COLLINA_GRADI = 0.5;
const TERRENO_SOGLIA_COLLINA_M = 120;

// I quattro paesaggi. L'ordine è quello dei codici salvati: non
// riordinarli, o un profilo salvato ieri racconta un posto diverso.
const TERRENO_TIPI = ['mare', 'pianura', 'collina', 'montagna'];

// Di quanti gradi si sfuma il passaggio da un paesaggio all'altro.
//
// I settori campionati sono larghi 7°30′, e presi così come sono danno
// confini netti: il mare finisce e comincia la montagna dentro un grado,
// con uno spigolo che si vede da lontano ed è l'unica cosa che l'occhio
// guarda. Ma un confine netto sull'orizzonte non esiste — nemmeno la costa
// è netta, perché la costa è dove finisce l'acqua, non dove finisce il
// colore. Nove gradi di sfumatura (poco più di un settore) bastano a far
// sparire lo spigolo senza impastare tutto — e la larghezza conta anche
// per un'altra ragione: la velatura del disegno cambia di un pezzo a ogni
// grado, e il pezzo è tanto più piccolo quanto la campana è larga. A nove
// gradi il salto era del dieci per cento per grado, abbastanza da vedersi
// come una scaletta di bande verticali; a dodici scende sotto l'otto, e a
// quel punto la scaletta sparisce sotto al rumore del gradiente.
const TERRENO_SFUMA_GRADI = 12;
const TERRENO_MARE = 0, TERRENO_PIANURA = 1, TERRENO_COLLINA = 2, TERRENO_MONTAGNA = 3;


// =====================================================================
// 2. LO STATO
// =====================================================================

const terreno = {
  stato: 'niente',        // niente | in-corso | pronto | fallito | spento
  lat: null,
  lon: null,
  quota: null,            // quota del suolo sotto l'osservatore, in metri
  profilo: null,          // Float32Array(361): l'altezza dell'orizzonte, grado per grado
  tipi: null,             // Uint8Array(361): che paesaggio c'è in quella direzione
  miscela: null,          // Float32Array(361×4): gli stessi tipi, ma sfumati fra loro
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

// Che paesaggio c'è in quella direzione. Non è un dato che si scarica: si
// legge nei campioni che abbiamo già in mano, ed è la differenza fra un
// orizzonte «alto 3,4°» e un orizzonte che uno riconosce — la montagna a
// nord, il mare a ponente, la pianura per il resto.
//
// L'ordine dei controlli conta: il mare per primo, perché il mare è
// perfettamente piatto e senza questo controllo finirebbe classificato
// pianura — e la pianura si disegna col prato e con gli alberi.
function terrenoTipoDiDirezione(quote, i, quotaCasa, cresta) {
  const n = TERRENO_DISTANZE.length;
  let qmax = -Infinity, lontani = 0, piatti = 0;
  for (let k = 0; k < n; k++) {
    const q = quote[i * n + k];
    if (typeof q !== 'number') continue;
    if (q > qmax) qmax = q;
    if (TERRENO_DISTANZE[k] >= TERRENO_MARE_DA_KM) {
      lontani++;
      if (q <= TERRENO_MARE_QUOTA) piatti++;
    }
  }
  if (lontani && piatti / lontani >= TERRENO_MARE_FRAZIONE) return TERRENO_MARE;
  if (qmax === -Infinity) return TERRENO_PIANURA;

  const dislivello = qmax - (typeof quotaCasa === 'number' ? quotaCasa : 0);
  if (cresta >= TERRENO_SOGLIA_MONTAGNA_GRADI || dislivello >= TERRENO_SOGLIA_MONTAGNA_M) return TERRENO_MONTAGNA;
  if (cresta >= TERRENO_SOGLIA_COLLINA_GRADI || dislivello >= TERRENO_SOGLIA_COLLINA_M) return TERRENO_COLLINA;
  return TERRENO_PIANURA;
}

// I tipi non si interpolano: fra il mare e la montagna non c'è una via di
// mezzo, c'è la costa. Si prende il settore più vicino, e il confine cade
// a metà strada fra due direzioni campionate. Questa è la risposta secca —
// «lì c'è il mare» — e serve a chi deve decidere qualcosa: per esempio che
// sull'acqua non si disegnano alberi.
function terrenoTipiPerGrado(tipi) {
  const p = new Uint8Array(361);
  const n = tipi.length;
  for (let g = 0; g <= 360; g++) {
    p[g] = tipi[Math.round((g % 360) / TERRENO_PASSO_AZ) % n];
  }
  return p;
}

// La stessa cosa, ma sfumata: per ogni grado, quanta parte di mare, di
// pianura, di collina e di montagna c'è lì attorno. Serve al disegno, che
// una risposta secca non la può usare — dipingere un settore di un colore
// e quello accanto di un altro fa comparire dei bordi netti che non sono
// nel paesaggio, sono nel modo in cui l'abbiamo campionato.
//
// È una media pesata con una campana (finestra di Hann) larga
// TERRENO_SFUMA_GRADI da una parte e dall'altra. I pesi si sommano a uno,
// quindi le quattro frazioni si sommano a uno: il colore che ne esce è una
// media vera, non una sovrapposizione.
function terrenoMiscelaPerGrado(tipiPerGrado) {
  const n = TERRENO_TIPI.length;
  const W = TERRENO_SFUMA_GRADI;
  const m = new Float32Array(361 * n);
  const pesi = [];
  let somma = 0;
  for (let d = -W; d <= W; d++) {
    const w = 0.5 * (1 + Math.cos(Math.PI * d / (W + 1)));
    pesi.push(w);
    somma += w;
  }
  for (let g = 0; g < 360; g++) {
    for (let k = 0, d = -W; d <= W; d++, k++) {
      const gg = (((g + d) % 360) + 360) % 360;
      m[g * n + tipiPerGrado[gg]] += pesi[k] / somma;
    }
  }
  // Il 360 è il 359+1, cioè lo 0: il giro si chiude
  for (let t = 0; t < n; t++) m[360 * n + t] = m[t];
  return m;
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
  const tipi = new Array(TERRENO_DIREZIONI).fill(TERRENO_PIANURA);
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
    tipi[i] = terrenoTipoDiDirezione(quote, i, quotaCasa, creste[i]);
  }

  return { quota: quotaCasa, creste, tipi };
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

function terrenoArchivio() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_TERRENO) || 'null');
    // I salvataggi vecchi tenevano un posto solo, scritto in piano, e non
    // avevano i paesaggi: si buttano e si riscaricano. Sono sei richieste,
    // e senza i tipi il mare si disegnerebbe col prato.
    if (v && Array.isArray(v.posti)) return v.posti;
  } catch (e) { /* niente storage, o roba illeggibile */ }
  return [];
}

function terrenoPostoValido(v) {
  return !!v && typeof v.lat === 'number' &&
    Array.isArray(v.creste) && v.creste.length === TERRENO_DIREZIONI &&
    Array.isArray(v.tipi) && v.tipi.length === TERRENO_DIREZIONI;
}

function terrenoLeggiSalvato(lat, lon) {
  return terrenoArchivio().find(v => terrenoPostoValido(v) &&
    terrenoDistanzaKm(lat, lon, v.lat, v.lon) <= TERRENO_RAGGIO_VALIDO_KM) || null;
}

function terrenoSalva(lat, lon, dati) {
  try {
    // Il posto nuovo va in cima, e quello che occupava lo stesso pezzo di
    // mondo se ne va: se no dopo dieci aperture l'archivio è pieno di copie
    // della stessa collina.
    const posti = terrenoArchivio().filter(v => terrenoPostoValido(v) &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > TERRENO_RAGGIO_VALIDO_KM);
    posti.unshift({ lat, lon, quota: dati.quota, creste: dati.creste, tipi: dati.tipi, quando: Date.now() });
    localStorage.setItem(CHIAVE_TERRENO, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

// Butta via quello che c'è in memoria. Serve al ripristino di un backup,
// che scrive direttamente in localStorage.
function terrenoDimentica() {
  terreno.stato = 'niente';
  terreno.profilo = null;
  terreno.tipi = null;
  terreno.miscela = null;
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
  terreno.tipi = terrenoTipiPerGrado(dati.tipi);
  terreno.miscela = terrenoMiscelaPerGrado(terreno.tipi);
  terreno.stato = 'pronto';
  terreno.motivo = '';
  terreno.quando = Date.now();
  terreno.sorgente = sorgente;
  // Non serve chiedere un ridisegno: il planetario ridisegna a ogni
  // fotogramma, e al primo utile la collina nuova è già lì.
  terrenoAggiornaPannello();
}

// Da che punto si sta guardando il cielo, che non è sempre casa: nel
// pannello «Tempo e luogo» del planetario si può andare a vedere il cielo
// di un'altra città, e da lì in poi il terreno è il suo. Prima non lo era,
// e si finiva a guardare il cielo di Bolzano con davanti le colline di
// Genova — che è peggio che non averne nessuna, perché sembra vero.
function terrenoLuogo() {
  const vista = typeof skyLuogoDelCielo === 'function' ? skyLuogoDelCielo() : null;
  if (vista && typeof vista.lat === 'number' && typeof vista.lon === 'number') return vista;
  const casa = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
  return (casa && typeof casa.lat === 'number' && typeof casa.lon === 'number') ? casa : null;
}

// Si chiama ogni volta che il luogo può essere cambiato: all'apertura del
// planetario, dopo `skyImpostaPosizione` e a ogni cambio del luogo di
// visita. Se il profilo che c'è vale ancora per dove siamo, non fa niente.
function terrenoCarica(forza) {
  if (!terreno.acceso) return Promise.resolve(false);

  const luogo = terrenoLuogo();
  if (!luogo) return Promise.resolve(false);
  const lat = luogo.lat, lon = luogo.lon;

  if (!forza && terreno.stato === 'pronto' && terreno.lat !== null &&
      terrenoDistanzaKm(lat, lon, terreno.lat, terreno.lon) <= TERRENO_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  // C'è già una richiesta in volo. Se è per questo stesso posto, si aspetta
  // quella; se nel frattempo il luogo è cambiato di nuovo (due città scelte
  // in fretta), la si lascia finire e si riparte dopo — nel `finally`.
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
    .finally(() => {
      terreno.promessa = null;
      // Il luogo è cambiato mentre scaricavamo? Allora quello che è appena
      // arrivato è il terreno di un posto che non si sta più guardando.
      const ora = terrenoLuogo();
      if (ora && terrenoDistanzaKm(ora.lat, ora.lon, lat, lon) > TERRENO_RAGGIO_VALIDO_KM) {
        terrenoCarica();
      }
    });

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

// Che paesaggio c'è guardando da quella parte: 'mare', 'pianura',
// 'collina', 'montagna' — oppure `null` se il terreno vero non c'è, e
// allora nessuno può dirlo.
function terrenoTipo(az) {
  if (!terrenoDisponibile() || !terreno.tipi) return null;
  const x = (((az % 360) + 360) % 360);
  return TERRENO_TIPI[terreno.tipi[Math.round(x) % 360]] || null;
}

// Quanta parte di ogni paesaggio c'è guardando da quella parte: quattro
// frazioni che si sommano a uno. È la versione da disegno di `terrenoTipo`,
// e le due rispondono a domande diverse — questa dice «tre quarti mare e un
// quarto collina», che è quello che serve per scegliere un colore che non
// faccia lo scalino con quello del grado accanto.
function terrenoMiscela(az) {
  if (!terrenoDisponibile() || !terreno.miscela) return null;
  const n = TERRENO_TIPI.length;
  const i = (Math.round((((az % 360) + 360) % 360)) % 360) * n;
  return {
    mare: terreno.miscela[i], pianura: terreno.miscela[i + 1],
    collina: terreno.miscela[i + 2], montagna: terreno.miscela[i + 3]
  };
}

// Il punto più alto e quello più basso del giro, e quanta parte
// dell'orizzonte occupa ciascun paesaggio: è il modo più corto di dire
// com'è fatto il posto in cui sei.
function terrenoRiassunto() {
  if (!terrenoDisponibile()) return null;
  let alto = -1, altoAz = 0, basso = 999;
  const gradi = [0, 0, 0, 0];
  // La direzione centrale di ogni paesaggio: si somma il versore di ogni
  // grado e si guarda dove punta la somma. Sommare gli azimut e dividerli
  // no: fra 350° e 10° la media aritmetica dà sud.
  const sx = [0, 0, 0, 0], sy = [0, 0, 0, 0];
  for (let g = 0; g < 360; g++) {
    if (terreno.profilo[g] > alto) { alto = terreno.profilo[g]; altoAz = g; }
    if (terreno.profilo[g] < basso) basso = terreno.profilo[g];
    const t = terreno.tipi ? terreno.tipi[g] : TERRENO_PIANURA;
    gradi[t]++;
    sx[t] += Math.sin(g * Math.PI / 180);
    sy[t] += Math.cos(g * Math.PI / 180);
  }
  const verso = t => (Math.atan2(sx[t], sy[t]) * 180 / Math.PI + 360) % 360;
  const nome = a => (typeof skyNomeDirezione === 'function' ? skyNomeDirezione(a) : '');

  const paesaggi = TERRENO_TIPI
    .map((n, t) => ({ tipo: n, gradi: gradi[t], quota: gradi[t] / 360, direzione: nome(verso(t)) }))
    .filter(p => p.gradi > 0)
    .sort((a, b) => b.gradi - a.gradi);

  return {
    alto, altoAz, basso,
    quota: terreno.quota,
    tipoPiuAlto: terrenoTipo(altoAz),
    paesaggi,
    direzione: nome(altoAz)
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

  // Com'è fatto il giro. Non «l'orizzonte è alto 3,4°» — che è vero e non
  // dice niente — ma le parole con cui uno descriverebbe il posto in cui
  // vive: il mare da una parte, la montagna dall'altra, la pianura in mezzo.
  const parole = {
    mare: 'il mare', pianura: 'pianura', collina: 'colline', montagna: 'montagne'
  };
  const pezzi = r.paesaggi
    .filter(p => p.quota >= 0.08)
    .map(p => {
      const q = p.quota >= 0.75 ? 'quasi tutt\'intorno'
        : p.quota >= 0.45 ? 'per metà orizzonte'
        : p.quota >= 0.22 ? `verso ${p.direzione}`
        : `un tratto verso ${p.direzione}`;
      return `${parole[p.tipo] || p.tipo} ${q}`;
    });
  const paesaggio = pezzi.length ? `Attorno a te: ${pezzi.join(', ')}. ` : '';

  if (r.alto < 0.35) {
    return quota + paesaggio + 'L\'orizzonte è libero in tutte le direzioni: non c\'è niente che copra.';
  }
  const cosa = r.tipoPiuAlto && r.tipoPiuAlto !== 'pianura' && r.tipoPiuAlto !== 'mare'
    ? ` (${r.tipoPiuAlto === 'montagna' ? 'la montagna' : 'la collina'})` : '';
  return quota + paesaggio +
    `Il punto più alto è a ${r.alto.toFixed(1)}° verso ${r.direzione}${cosa}. ` +
    (r.basso < 0.35
      ? 'Da qualche parte l\'orizzonte è invece completamente libero.'
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
  if (nota) nota.textContent = terrenoTesto() + ' ' + cittaTesto();
  cittaAggiornaTasto();
}


// =====================================================================
// 10. LE CITTÀ VERE
//
//     Un orizzonte notturno non è nero. Da qualunque posto abitato, sopra
//     il crinale ci sono delle cupole di luce: arancioni quelle vecchie al
//     sodio, bianche quelle nuove a LED. E non sono un disturbo da
//     nascondere — sono l'informazione più utile che ci sia sull'orizzonte
//     di casa, perché dicono da che parte NON puntare il telescopio.
//
//     Fin qui il planetario faceva l'opposto: cielo uniformemente scuro
//     fino a terra, come se ogni posto fosse un deserto. Uno guardava la
//     mappa, sceglieva una galassia bassa a sud, usciva — e a sud c'era il
//     capoluogo.
//
//     I paesi e le città vengono da OpenStreetMap (Overpass, senza chiave e
//     senza account). Se non risponde restano le città dell'elenco interno,
//     quello delle eclissi: sono i capoluoghi, cioè proprio quelli che si
//     vedono da lontano. Se non c'è né l'uno né l'altro, l'orizzonte torna
//     nero com'era e non se ne parla più.
// =====================================================================

const CHIAVE_CITTA = 'astrocalendario_citta';

// Novanta chilometri: oltre, l'alone di una città grande c'è ancora, ma è
// più basso della foschia e non vale la richiesta.
const CITTA_RAGGIO_KM = 90;
// I paesi piccoli si prendono solo da vicino: a venti chilometri un paese
// di duemila anime non illumina niente, e ce ne sono a centinaia.
const CITTA_RAGGIO_PAESI_KM = 20;
const CITTA_MAX = 60;
const CITTA_RAGGIO_VALIDO_KM = 5;
const CITTA_ATTESA_MS = 15000;

// Quando OpenStreetMap non dice quanti abitanti ha, si va per categoria.
// Sono numeri all'ingrosso, e vanno benissimo: la differenza fra una città
// e un paese si vede, quella fra 40.000 e 55.000 abitanti no.
const CITTA_ABITANTI = { city: 150000, town: 18000, village: 2200, suburb: 25000, borough: 60000 };

const citta = {
  stato: 'niente',        // niente | in-corso | pronto | fallito
  lat: null, lon: null,
  elenco: [],             // { nome, az, km, abitanti, forza, alto, mezzo, alfa }
  fonte: '',
  motivo: '',
  acceso: true
};


// --- Dove sta, e quanto è lontana ------------------------------------

function cittaAzimut(la1, lo1, la2, lo2) {
  const D2R = Math.PI / 180;
  const f1 = la1 * D2R, f2 = la2 * D2R, dl = (lo2 - lo1) * D2R;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Quanto illumina il cielo. La legge di Walker dice che il chiarore sopra
// una città cala come la distanza alla due e mezzo, ed è quella che usano
// gli atlanti dell'inquinamento luminoso. Qui basta la forma: gli abitanti
// contano più che linearmente (una città grande è anche più illuminata
// per abitante) e la distanza li smorza in fretta.
//
// I due numeri che ne escono sono quelli del disegno: quanto sale la
// cupola e quanto è larga. Vengono da come si vedono davvero — Milano da
// trenta chilometri occupa un quarto dell'orizzonte e arriva a venti gradi
// d'altezza, un paese a tre chilometri fa una gobba bassa e stretta.
function cittaForza(abitanti, km) {
  const d = Math.max(1.2, km);
  return Math.pow(Math.max(200, abitanti), 1.2) / (d * d + 4);
}

function cittaPrepara(grezze, lat, lon) {
  return grezze.map(c => {
    const km = terrenoDistanzaKm(lat, lon, c.lat, c.lon);
    const az = cittaAzimut(lat, lon, c.lat, c.lon);
    const forza = cittaForza(c.abitanti, km);
    // Il raggio dell'abitato, in chilometri: una città di un milione di
    // abitanti è larga una decina di chilometri, un paese di duemila
    // qualche centinaio di metri. Da lì quanto la si vede larga.
    const raggioKm = 0.5 * Math.sqrt(Math.max(200, c.abitanti) / 10000);
    const largoVero = Math.atan2(raggioKm, Math.max(0.4, km)) * 180 / Math.PI;
    const alto = Math.max(0.5, Math.min(22, 0.9 * Math.pow(forza, 0.30)));
    return {
      nome: c.nome,
      abitanti: c.abitanti,
      lat: c.lat, lon: c.lon,
      az, km, forza, alto,
      // L'alone è sempre più largo dell'abitato: la luce si sparge nell'aria
      mezzo: Math.max(4, Math.min(55, largoVero + 3.5 + alto * 0.6)),
      alfa: Math.max(0.03, Math.min(0.30, 0.03 * Math.pow(forza, 0.22)))
    };
  })
    .filter(c => c.km <= CITTA_RAGGIO_KM + 5 && c.forza > 12)
    .sort((a, b) => b.forza - a.forza)
    .slice(0, CITTA_MAX);
}


// --- Prenderle da OpenStreetMap --------------------------------------

function cittaQueryOverpass(lat, lon) {
  const la = lat.toFixed(4), lo = lon.toFixed(4);
  return '[out:json][timeout:20];(' +
    `node["place"~"^(city|town)$"](around:${Math.round(CITTA_RAGGIO_KM * 1000)},${la},${lo});` +
    `node["place"~"^(village|suburb|borough)$"](around:${Math.round(CITTA_RAGGIO_PAESI_KM * 1000)},${la},${lo});` +
    ');out body 400;';
}

async function cittaDaOverpass(lat, lon) {
  const controllo = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controllo ? setTimeout(() => controllo.abort(), CITTA_ATTESA_MS) : null;
  try {
    const risposta = await fetch('https://overpass-api.de/api/interpreter?data=' +
      encodeURIComponent(cittaQueryOverpass(lat, lon)), controllo ? { signal: controllo.signal } : undefined);
    if (!risposta.ok) throw new Error('OpenStreetMap non risponde (' + risposta.status + ')');
    const dati = await risposta.json();
    if (!dati || !Array.isArray(dati.elements)) throw new Error('risposta senza luoghi');
    return dati.elements
      .filter(n => n && n.tags && n.tags.name && typeof n.lat === 'number')
      .map(n => {
        // La popolazione, quando c'è, arriva come stringa e ogni tanto con
        // i punti delle migliaia dentro
        const grezza = parseInt(String(n.tags.population || '').replace(/[^\d]/g, ''), 10);
        return {
          nome: n.tags.name,
          lat: n.lat, lon: n.lon,
          abitanti: isFinite(grezza) && grezza > 0 ? grezza : (CITTA_ABITANTI[n.tags.place] || 3000)
        };
      });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Il ripiego: l'elenco dei capoluoghi che l'app si porta dietro per le
// eclissi. Non ha i paesi, ma le città che si vedono da lontano ci sono
// tutte — ed è quello che serve a un orizzonte.
function cittaDaElencoInterno(lat, lon) {
  if (typeof ECL_CITTA === 'undefined') return [];
  return ECL_CITTA
    .map(([nome, paese, cLat, cLon]) => ({ nome, lat: cLat, lon: cLon, abitanti: 250000 }))
    .filter(c => terrenoDistanzaKm(lat, lon, c.lat, c.lon) <= CITTA_RAGGIO_KM);
}


// --- Tenersele --------------------------------------------------------

function cittaArchivio() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_CITTA) || 'null');
    if (v && Array.isArray(v.posti)) return v.posti;
  } catch (e) { /* niente storage, o roba illeggibile */ }
  return [];
}

function cittaLeggiSalvate(lat, lon) {
  return cittaArchivio().find(v => v && Array.isArray(v.elenco) && typeof v.lat === 'number' &&
    terrenoDistanzaKm(lat, lon, v.lat, v.lon) <= CITTA_RAGGIO_VALIDO_KM) || null;
}

function cittaSalva(lat, lon, grezze, fonte) {
  try {
    const posti = cittaArchivio().filter(v => v && typeof v.lat === 'number' &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > CITTA_RAGGIO_VALIDO_KM);
    posti.unshift({
      lat, lon, fonte, quando: Date.now(),
      // Nomi corti e coordinate a quattro decimali: un centinaio di paesi
      // stanno in una decina di kilobyte
      elenco: grezze.map(c => ({ n: c.nome, a: +c.lat.toFixed(4), o: +c.lon.toFixed(4), p: c.abitanti }))
    });
    localStorage.setItem(CHIAVE_CITTA, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

function cittaDalSalvato(v) {
  return v.elenco.map(c => ({ nome: c.n, lat: c.a, lon: c.o, abitanti: c.p }));
}

function cittaDimentica() {
  citta.stato = 'niente';
  citta.elenco = [];
  citta.lat = citta.lon = null;
}


// --- L'innesco --------------------------------------------------------

function cittaApplica(lat, lon, grezze, fonte) {
  citta.lat = lat;
  citta.lon = lon;
  citta.elenco = cittaPrepara(grezze, lat, lon);
  citta.fonte = fonte;
  citta.stato = 'pronto';
  citta.motivo = '';
  terrenoAggiornaPannello();
}

function cittaCarica(forza) {
  const luogo = terrenoLuogo();
  if (!luogo) return Promise.resolve(false);
  const lat = luogo.lat, lon = luogo.lon;

  if (!forza && citta.stato === 'pronto' && citta.lat !== null &&
      terrenoDistanzaKm(lat, lon, citta.lat, citta.lon) <= CITTA_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  if (citta.stato === 'in-corso') return citta.promessa || Promise.resolve(false);

  if (!forza) {
    const salvate = cittaLeggiSalvate(lat, lon);
    if (salvate) {
      cittaApplica(salvate.lat, salvate.lon, cittaDalSalvato(salvate), salvate.fonte || 'salvato');
      return Promise.resolve(true);
    }
  }

  citta.stato = 'in-corso';
  citta.motivo = '';
  terrenoAggiornaPannello();

  citta.promessa = cittaDaOverpass(lat, lon)
    .then(elenco => {
      if (!elenco.length) throw new Error('nessun luogo abitato qui attorno');
      cittaApplica(lat, lon, elenco, 'osm');
      // Si salva quello che è rimasto dopo la potatura, non i quattrocento
      // nodi grezzi: in una provincia densa Overpass risponde con ogni
      // frazione, e in localStorage ci vanno solo quelle che illuminano.
      if (!citta.elenco.length) throw new Error('nessun luogo abbastanza illuminato');
      cittaSalva(lat, lon, citta.elenco, 'osm');
      return true;
    })
    .catch(e => {
      console.warn('Città da OpenStreetMap non disponibili:', e);
      // Il ripiego non si salva: è una supplenza, e alla prossima apertura
      // con la rete vera vale la pena riprovare con i paesi veri.
      const interne = cittaDaElencoInterno(lat, lon);
      if (interne.length) {
        cittaApplica(lat, lon, interne, 'interno');
        return true;
      }
      citta.stato = 'fallito';
      citta.motivo = 'Non conosco i paesi qui attorno: l\'orizzonte resta senza luci.';
      terrenoAggiornaPannello();
      return false;
    })
    .finally(() => {
      citta.promessa = null;
      const ora = terrenoLuogo();
      if (ora && terrenoDistanzaKm(ora.lat, ora.lon, lat, lon) > CITTA_RAGGIO_VALIDO_KM) {
        cittaCarica();
      }
    });

  return citta.promessa;
}


// --- Quello che serve al planetario -----------------------------------

// Le città che vale la pena disegnare, dalla più luminosa in giù. Il
// planetario le proietta da sé: qui si sa dove stanno e quanto illuminano,
// non come finiscono sullo schermo.
function cittaVicine() {
  if (!citta.acceso || citta.stato !== 'pronto') return [];
  return citta.elenco;
}

function cittaAlterna() {
  citta.acceso = !citta.acceso;
  if (citta.acceso && citta.stato !== 'pronto') cittaCarica();
  terrenoAggiornaPannello();
}

function cittaTesto() {
  if (!citta.acceso) return 'Luci delle città spente: orizzonte nero, come da un deserto.';
  if (citta.stato === 'in-corso') return 'Sto cercando i paesi qui attorno…';
  if (citta.stato === 'fallito') return citta.motivo;
  if (citta.stato !== 'pronto' || !citta.elenco.length) return '';

  const prima = citta.elenco[0];
  const dove = typeof skyNomeDirezione === 'function' ? skyNomeDirezione(prima.az) : '';
  return `Sull'orizzonte ci sono le luci di ${citta.elenco.length} centri abitati: ` +
    `il chiarore più forte è quello di ${prima.nome}, a ${prima.km.toFixed(0)} km verso ${dove}. ` +
    'È la direzione in cui conviene NON cercare le cose deboli.';
}

function cittaAggiornaTasto() {
  const tasto = document.getElementById('skymap-btn-citta');
  if (!tasto) return;
  tasto.classList.toggle('attiva', citta.acceso);
  tasto.setAttribute('aria-pressed', citta.acceso ? 'true' : 'false');
  tasto.textContent = citta.stato === 'in-corso' ? 'Luci delle città…' : 'Luci delle città';
}
