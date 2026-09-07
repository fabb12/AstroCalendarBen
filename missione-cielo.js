// =====================================================================
// MISSIONE CIELO — la serata come percorso, non come elenco
//
// La dashboard sa già dire *cosa* vale la pena guardare stanotte: i
// migliori bersagli, ordinati per merito, ognuno con la sua riga di
// motivi. È la risposta giusta a «cosa c'è», e non è la risposta a
// un'altra domanda che uno si fa in cortile con la giacca addosso:
// **ho venti minuti, da dove comincio?**
//
// Un elenco non risponde perché non ha un ordine di esecuzione. Dice che
// M13 vale 82 e Giove 79, e lascia a chi legge tre lavori: scegliere,
// mettere in fila e trovare. Il primo si fa male al buio, il secondo non
// si fa affatto, il terzo è quello che fa rientrare in casa.
//
// Qui c'è la stessa materia prima — le stesse funzioni di `pianifica.js`,
// gli stessi conti — impaginata come una **sequenza**: tre domande in
// entrata (quanto tempo, con cosa, che serata vuoi), da tre a sei tappe
// in uscita, una per volta, ognuna con l'ora, la direzione, un
// riferimento da cui partire e un aiuto che si allarga se non si trova.
//
// Le tre cose che questo file non fa, e sono scelte:
//
//   NON RICALCOLA NIENTE. Le posizioni, il buio, la Luna, le nuvole e il
//   terreno li sanno già `app.js`, `pianifica.js`, `meteo-astro.js` e
//   `terreno.js`. Qui si sceglie e si ordina, e basta: una seconda
//   effemeride sarebbe una seconda verità da tenere d'accordo con la
//   prima.
//
//   NON PROMETTE QUELLO CHE NON SA. Senza posizione non si genera niente
//   e lo si dice; senza meteo la missione si fa lo stesso e lo dichiara;
//   senza terreno gli ostacoli sono solo quelli dichiarati a mano. Una
//   missione che finge di sapere manda qualcuno a cercare una galassia
//   dietro a un condominio.
//
//   NON COLPEVOLIZZA. «Non lo trovo» non è un errore da segnare: è
//   l'inizio di tre gradini di aiuto, e il terzo propone di cambiare
//   bersaglio. Il diario registra *trovato / saltato / non trovato*, che
//   sono tre fatti, non tre voti.
//
// Ordine di caricamento: dopo app.js, catalogo.js, corpi-minori.js,
// pianifica.js, terreno.js, meteo-astro.js ed eventi-extra.js; prima di
// ui-nuova.js, che ne disegna la scheda dentro a Stasera.
// =====================================================================


// =====================================================================
// 1. LE TRE DOMANDE, E COSA SI RICORDA
//
//     Tre e non sette. Ogni domanda in più è una persona in meno che
//     arriva in fondo, e le altre quattro che verrebbero in mente — il
//     livello, la latitudine, il tipo di oggetti preferiti, la pazienza —
//     si deducono tutte da queste tre o non cambiano il risultato.
//
//     In particolare **non si chiede il livello**: «principiante o
//     esperto» è una domanda a cui nessuno risponde onestamente, e la
//     risposta utile è già dentro a «che esperienza vuoi». Chi sceglie
//     «Fammi una sfida» ha detto di essere esperto senza doverlo
//     dichiarare.
// =====================================================================

const MISS_VERSIONE = 2;

const CHIAVE_MISS_SCELTE = 'astrocalendario_missione_scelte';
const CHIAVE_MISS_ATTIVA = 'astrocalendario_missione_attiva';

const MISS_DURATE = [10, 30, 60, 120];
const MISS_STRUMENTI = ['occhio', 'binocolo', 'telescopio'];
const MISS_ESPERIENZE = ['stupore', 'imparare', 'sfida', 'bambini'];
const MISS_DIREZIONI = [0, 45, 90, 135, 180, 225, 270, 315];

// Il livello di ogni strumento: un bersaglio si propone solo se il suo
// minimo sta dentro a quello che si ha in mano.
const MISS_LIVELLO_STRUMENTO = { occhio: 0, binocolo: 1, telescopio: 2 };

// Quante tappe stanno in una serata. Sono due numeri e non uno: il primo
// è quello sotto cui la missione non è più un percorso, il secondo quello
// oltre cui diventa una lista della spesa. Il conto è grossolano di
// proposito — cinque minuti a tappa per i primi bersagli, di più per il
// cielo profondo — perché il tempo vero se lo prende chi guarda.
const MISS_TAPPE_PER_DURATA = {
  10:  { min: 2, max: 3 },
  30:  { min: 3, max: 4 },
  60:  { min: 4, max: 5 },
  120: { min: 5, max: 6 }
};

// Quanto in alto deve stare un bersaglio perché valga la pena mandarci
// qualcuno. Non è l'orizzonte matematico: sotto i dieci gradi c'è sempre
// qualcosa — foschia, un tetto, un albero — e chi non trova per colpa
// dell'aria crede di non saper cercare.
const MISS_ALTEZZA_MINIMA = {
  stupore: 15, imparare: 15, sfida: 10, bambini: 20
};

// La finestra di sorveglianza di un evento a orario preciso: quanto
// tempo prima lo si annuncia. Meno di così non si fa in tempo a uscire e
// a girarsi dalla parte giusta.
const MISS_PREAVVISO_MIN = 2;

// Una missione salvata scade: riprendere alle sette di sera quella di
// ieri notte vuol dire riprendere un cielo che non c'è più.
const MISS_SCADENZA_MS = 16 * 3600 * 1000;

// Quanto lontano possono stare due tappe consecutive senza che sembri di
// star girando su sé stessi. Oltre, si paga una penale di continuità.
const MISS_SALTO_COMODO_GRADI = 70;

// Le misure a braccio teso, che è l'unico goniometro che tutti hanno
// addosso. Dal più fine al più grosso: sotto il primo non si dice niente
// («è lì accanto»), sopra l'ultimo si torna ai punti cardinali.
const MISS_MISURE_A_MANO = [
  { gradi: 2,  chiave: 'missione.mano.dito' },
  { gradi: 5,  chiave: 'missione.mano.treDita' },
  { gradi: 10, chiave: 'missione.mano.pugno' },
  { gradi: 20, chiave: 'missione.mano.manoAperta' },
  { gradi: 40, chiave: 'missione.mano.duePugni' }
];

// Lo stato del modulo. Vive quanto l'app; quello che deve sopravvivere a
// una ricarica sta in `attiva` e si salva (§7).
const miss = {
  // Le tre scelte, ricordate fra una sera e l'altra
  scelte: { durata: 30, strumento: 'occhio', esperienza: 'stupore', cielo: 'tutto', cieloDa: 135, cieloA: 180, voce: false },
  // La missione appena generata e non ancora avviata
  anteprima: null,
  // Quella in corso o conclusa e non ancora archiviata
  attiva: null,
  // Il pannello: quale dei cinque stati è a schermo
  vista: 'configurazione',
  aperto: false,
  // Il messaggio in cima al pannello: {chiave, dati, tono}
  avviso: null,
  // Chi aveva il fuoco quando il pannello si è aperto, per restituirglielo
  fuocoPrima: null,
  // Il primo estremo acquisito con la bussola, finche' si prende il secondo.
  rilievoSettore: null,
  // Le funzioni da staccare alla chiusura (tastiera, cambio lingua)
  staccare: []
};


// =====================================================================
// 2. IL MOTORE, IN FUNZIONI PURE
//
//     Tutto quello che decide *quali* tappe e *in che ordine* sta qui, e
//     non tocca né il documento né l'orologio né la rete: riceve uno
//     «scenario» — l'istante, la finestra di buio, i candidati già
//     misurati, le tre scelte, le condizioni — e restituisce una
//     missione. È la parte che si può provare senza browser, ed è la
//     ragione per cui è separata: il difetto tipico di questo genere di
//     codice non è un pixel storto, è una tappa impossibile che sullo
//     schermo sembra ragionevole.
// =====================================================================

// La distanza angolare fra due direzioni sull'orizzonte, sul giro: fra
// nord-ovest e nord-est ci sono novanta gradi, non duecentosettanta.
function missScartoAzimut(a, b) {
  // La differenza riportata dentro a [-180, +180] e poi presa in valore
  // assoluto: e' il conto di sempre, e va scritto in questo ordine. Con il
  // valore assoluto fatto prima, la meta' del giro che passa per il nord
  // viene misurata dalla parte lunga — fra 350 e 10 gradi risponderebbe
  // centosessanta invece di venti, e ogni riferimento a nord verrebbe
  // scartato per «troppo lontano».
  return Math.abs(((a - b) % 360 + 540) % 360 - 180);
}

// Una terrazza raramente vede tutto il giro. I due estremi delimitano
// sempre l'arco piu' corto: «S–SE» e «SE–S» descrivono quindi la stessa
// finestra e non, per errore, gli altri 315 gradi di cielo.
function missAzimutNelSettore(azimut, da, a) {
  if (![azimut, da, a].every(Number.isFinite)) return true;
  const ampiezza = missScartoAzimut(da, a);
  return missScartoAzimut(azimut, da) + missScartoAzimut(azimut, a) <= ampiezza + 1e-7;
}

// Un bersaglio si può guardare con quello che ho in mano?
function missStrumentoBasta(minimo, scelto) {
  const m = MISS_LIVELLO_STRUMENTO[minimo] ?? 0;
  const s = MISS_LIVELLO_STRUMENTO[scelto] ?? 0;
  return m <= s;
}

// La fascia di cielo in cui sta, detta come la direbbe una persona.
function missFasciaAltezza(alt) {
  if (alt < 20) return 'basso';
  if (alt < 55) return 'mezzo';
  return 'alto';
}

// La misura a braccio teso più vicina a un certo angolo.
function missMisuraAMano(gradi) {
  const g = Math.abs(gradi);
  let scelta = MISS_MISURE_A_MANO[0];
  for (const m of MISS_MISURE_A_MANO) {
    if (Math.abs(m.gradi - g) < Math.abs(scelta.gradi - g)) scelta = m;
  }
  return scelta;
}

/* Il punteggio di un candidato per *questa* serata.
 *
 * Non è un voto di bellezza — quello lo dà già `migliorDiStanotte` — ma
 * la risposta a «quanto è adatto a chi ha chiesto questa cosa qui». Le
 * quattro esperienze pesano le stesse grandezze in modo diverso, e la
 * differenza fra loro non è cosmetica: «Fammi stupire» premia la
 * luminosità e punisce la difficoltà, «Fammi una sfida» fa quasi il
 * contrario, e «Sono con bambini» punisce la difficoltà il doppio di
 * tutti gli altri perché una tappa fallita, lì, chiude la serata. */
function missPunteggio(c, scelte, condizioni) {
  const esperienza = scelte.esperienza;
  let punti = c.puntiBase !== undefined ? c.puntiBase : 50;

  // --- quanto sale ---
  // Un oggetto alto si vede attraverso meno aria e non sta dietro a
  // niente: vale in tutte e quattro le esperienze.
  punti += Math.min(30, Math.max(0, (c.altezza - 10)) * 0.45);

  // --- la difficoltà, pesata dall'esperienza ---
  const pesoDifficolta = { stupore: -9, imparare: -5, sfida: +4, bambini: -14 }[esperienza] || -8;
  punti += pesoDifficolta * (c.difficolta - 1);

  // --- la luminosità apparente ---
  // `evidenza` è da 0 a 1: quanto un oggetto salta all'occhio a chi non
  // sa dove guardare. La Luna vale uno, una galassia di undicesima zero.
  const pesoEvidenza = { stupore: 26, imparare: 14, sfida: 4, bambini: 30 }[esperienza] || 20;
  punti += pesoEvidenza * c.evidenza;

  // --- il valore didattico ---
  const pesoDidattica = { stupore: 4, imparare: 24, sfida: 8, bambini: 10 }[esperienza] || 6;
  punti += pesoDidattica * (c.didattica || 0);

  // --- per quanto resta guardabile dentro alla missione ---
  // Un bersaglio che tramonta a metà serata non è sbagliato: è una tappa
  // da mettere per prima, e chi la mette per ultima la perde.
  if (c.minutiUtili < 10) punti -= 22;
  else if (c.minutiUtili < 25) punti -= 8;

  // --- la Luna, che non disturba tutti allo stesso modo ---
  // Su un pianeta non conta niente; su una nebulosa debole conta più di
  // ogni altra cosa. È la stessa regola di `migliorDiStanotte`, applicata
  // qui perché il candidato può venire da altre famiglie.
  if (condizioni && condizioni.luna > 0.1 && c.soffreLaLuna) {
    punti -= Math.round(condizioni.luna * (c.difficolta >= 4 ? 42 : 22));
  }

  // --- un evento a orario preciso vale di più: non si ripete ---
  if (c.aOrarioPreciso) punti += 14;

  return Math.round(punti);
}

/* Quante tappe stanno in questa serata.
 *
 * Il numero dichiarato è un tetto, non una promessa: «è meglio proporre
 * due tappe realistiche che cinque tappe impossibili» è la regola, e per
 * rispettarla il conto guarda anche **quanti candidati buoni ci sono**.
 * Un cielo coperto a metà, o un balcone che guarda un muro, danno tre
 * bersagli in croce: allungare la missione con il quarto e il quinto
 * peggiori vorrebbe dire mandare qualcuno a cercare, al buio, roba che
 * non si vede. */
function missQuanteTappe(durata, candidatiBuoni) {
  const q = MISS_TAPPE_PER_DURATA[durata] || MISS_TAPPE_PER_DURATA[30];
  return Math.max(1, Math.min(q.max, candidatiBuoni));
}

/* La cernita: chi può stare in una missione, e chi no.
 *
 * È il primo dei due filtri, ed è quello secco — qui non si pesa niente,
 * si esclude. Le quattro ragioni per cui un bersaglio non entra sono
 * tutte fatti e non giudizi: sta sotto l'orizzonte, sta dietro a qualcosa
 * di dichiarato, vuole uno strumento che non c'è, oppure dentro alla
 * finestra della missione non c'è affatto. */
function missAmmissibile(c, scelte) {
  if (!c || !c.nome) return false;
  if (!missStrumentoBasta(c.strumentoMinimo, scelte.strumento)) return false;
  if (scelte.cielo === 'settore' && !missAzimutNelSettore(c.azimut, Number(scelte.cieloDa), Number(scelte.cieloA))) return false;
  // L'altezza è quella del momento consigliato, che è già il migliore
  // dentro alla finestra: se non basta lì, non basta mai.
  const minima = MISS_ALTEZZA_MINIMA[scelte.esperienza] ?? 15;
  if (!(c.altezza > minima)) return false;
  // Sopra l'ostacolo dichiarato o misurato: `sopraOstacoli` è già la
  // differenza, quindi zero vuol dire «esattamente sul crinale», che a
  // occhio vuol dire non visibile.
  if (typeof c.sopraOstacoli === 'number' && c.sopraOstacoli <= 1) return false;
  // Un evento a orario preciso già passato non è una tappa: è una cosa
  // che è successa.
  if (c.aOrarioPreciso && c.quando == null) return false;
  return true;
}

/* La varietà: non tutta la missione della stessa famiglia.
 *
 * Cinque galassie sono una missione onesta e una serata noiosa, e
 * soprattutto sono una serata che non insegna niente — il cielo non è
 * fatto di una cosa sola. Il tetto è per **famiglia** (`gruppo`) e non
 * per tipo: la Luna e i pianeti sono due tipi ma una sola famiglia agli
 * occhi di chi guarda, cioè «le cose luminose del Sistema Solare». */
const MISS_TETTO_FAMIGLIA = 2;

/* Due tappe che sono la stessa cosa detta in due modi.
 *
 * «Trova Vega» e «trova la Lira» in una missione da cinque sono due tappe
 * su cinque per lo stesso pezzo di cielo — Vega *è* la stella più
 * luminosa della Lira, quindi trovata la prima la seconda è già lì. Non
 * lo prende nessuna delle altre regole: sono due famiglie diverse per il
 * tetto della varietà (una figura e una stella), stanno a pochi gradi
 * quindi la continuità le premia, e i punteggi sono alti tutti e due. È
 * il caso in cui il selettore, lasciato a sé, sceglie due volte la stessa
 * cosa perché le somiglianze le misura in gradi e non in significato. */
function missDoppione(c, scelti) {
  return scelti.some(g => {
    if (c.tipo === 'costellazione' && g.tipo === 'stella') return c.capofila === g.nome;
    if (g.tipo === 'costellazione' && c.tipo === 'stella') return g.capofila === c.nome;
    return false;
  });
}

function missFamigliaDi(c) {
  if (c.tipo === 'luna' || c.tipo === 'pianeta') return 'sistemaSolare';
  if (c.tipo === 'stella' || c.tipo === 'costellazione') return 'figure';
  if (c.tipo === 'profondo') return 'profondo';
  if (c.tipo === 'stazione' || c.tipo === 'evento') return 'appuntamenti';
  return 'altro';
}

/* La progressione: il primo successo dev'essere facile.
 *
 * È la regola che vale più di tutte le altre messe insieme, e viene da
 * come funziona una serata vera: chi trova la prima cosa in venti secondi
 * cerca la seconda con pazienza; chi non trova la prima, in venti secondi
 * ha già deciso che l'app non funziona. Quindi la prima tappa non è la
 * migliore: è **la più facile fra le buone**. */
function missOrdinaPerProgressione(scelti, scelte) {
  const liberi = scelti.filter(c => !c.aOrarioPreciso);
  const fissi = scelti.filter(c => c.aOrarioPreciso);

  // La prima è la più facile, e a pari difficoltà la più evidente.
  liberi.sort((a, b) => a.difficolta - b.difficolta || b.evidenza - a.evidenza);
  const fila = [];
  if (liberi.length) fila.push(liberi.shift());

  // Da lì in poi si cammina: fra i rimasti si prende quello che costa
  // meno da raggiungere — poca difficoltà in più e poco cielo da
  // attraversare. La continuità non è un vezzo: girarsi di
  // centottanta gradi al buio vuol dire perdere l'adattamento e il
  // riferimento da cui si era partiti.
  while (liberi.length) {
    const ultimo = fila[fila.length - 1];
    let migliore = 0, costoMigliore = Infinity;
    liberi.forEach((c, i) => {
      const salto = missScartoAzimut(c.azimut, ultimo.azimut);
      const costo = (c.difficolta - ultimo.difficolta) * 12
                  + Math.max(0, salto - MISS_SALTO_COMODO_GRADI) * 0.22
                  - c.punti * 0.10;
      if (costo < costoMigliore) { costoMigliore = costo; migliore = i; }
    });
    fila.push(liberi.splice(migliore, 1)[0]);
  }

  // «Fammi una sfida» vuole il pezzo grosso in fondo, e la fila costruita
  // per continuità non lo garantisce: si porta in coda il più difficile,
  // che è la chiusura che quella scelta promette.
  if (scelte.esperienza === 'sfida' && fila.length > 2) {
    let piuDuro = 0;
    fila.forEach((c, i) => { if (c.difficolta > fila[piuDuro].difficolta) piuDuro = i; });
    if (piuDuro !== fila.length - 1) fila.push(fila.splice(piuDuro, 1)[0]);
  }

  return { fila, fissi };
}

/* Gli orari: chi si guarda quando.
 *
 * Due nature diverse nella stessa sequenza. Un pianeta è disponibile per
 * un **intervallo** e lo si guarda quando fa comodo; un passaggio della
 * ISS avviene a un **istante** e non aspetta nessuno. Il secondo si
 * incastra nella fila al suo posto nel tempo, e gli altri gli si aprono
 * attorno.
 *
 * La riga che conta è l'ultima: un evento che cade prima del preavviso
 * minimo non si mette affatto. Annunciare un passaggio fra quaranta
 * secondi, a chi sta ancora leggendo la prima tappa, è peggio che non
 * annunciarlo — è una cosa persa mentre la si leggeva. */
function missMettiInOrario(fila, fissi, partenzaMs, durataMin, scelte) {
  const perTappaMs = (durataMin * 60000) / Math.max(1, fila.length + fissi.length);
  // Coi bambini le tappe sono più corte: l'attenzione dura quello che
  // dura, e una tappa lunga si trasforma in «quando andiamo dentro?».
  const passo = scelte.esperienza === 'bambini'
    ? Math.min(perTappaMs, 5 * 60000) : perTappaMs;

  const conOrario = fila.map((c, i) => Object.assign({}, c, {
    quando: partenzaMs + Math.round(i * passo)
  }));

  const fineMissione = partenzaMs + durataMin * 60000;
  fissi
    .filter(f => f.quando >= partenzaMs + MISS_PREAVVISO_MIN * 60000 && f.quando <= fineMissione)
    .forEach(f => {
      let dove = conOrario.findIndex(t => t.quando > f.quando);
      if (dove < 0) dove = conOrario.length;
      conOrario.splice(dove, 0, Object.assign({}, f));
    });

  return conOrario;
}

/* Il riferimento da cui partire.
 *
 * «Cerca M31» è un'istruzione che presuppone di sapere già dov'è. Quello
 * che serve è un punto di partenza che si veda a occhio da qualunque
 * cortile, e un verso: la tappa di prima se è abbastanza vicina e
 * abbastanza luminosa, se no il candidato più evidente entro un braccio
 * teso. Se non c'è nessuno dei due, il riferimento è la direzione
 * cardinale, che c'è sempre. */
function missAttaccaRiferimenti(tappe, candidati) {
  return tappe.map((t, i) => {
    const precedente = i > 0 ? tappe[i - 1] : null;
    let rif = null;

    if (precedente && precedente.evidenza >= 0.5 &&
        !missDoppione(t, [precedente]) &&
        missScartoAzimut(precedente.azimut, t.azimut) < 45) {
      rif = precedente;
    } else {
      let migliore = null;
      for (const c of candidati) {
        if (c.id === t.id || c.evidenza < 0.6) continue;
        if (missDoppione(t, [c])) continue;
        const salto = missScartoAzimut(c.azimut, t.azimut);
        if (salto > 40) continue;
        if (!migliore || c.evidenza > migliore.evidenza) migliore = c;
      }
      rif = migliore;
    }

    return Object.assign({}, t, {
      riferimento: rif ? {
        nome: rif.nome,
        tipo: rif.tipo,
        sigla: rif.sigla || null,
        gradi: Math.round(missScartoAzimut(rif.azimut, t.azimut)),
        // Da che parte: in cielo, guardando verso l'orizzonte, gli
        // azimut crescono verso destra.
        verso: (((t.azimut - rif.azimut) % 360) + 360) % 360 < 180 ? 'destra' : 'sinistra',
        piuAlto: t.altezza > rif.altezza
      } : null
    });
  });
}

/* Il motore, tutto insieme.
 *
 * `scenario` è quello che il mondo esterno ha già misurato:
 *   { adesso, partenza, candidati, scelte, condizioni }
 * e non contiene niente che questa funzione debba andare a chiedere a
 * qualcuno. In uscita c'è la missione, o `null` con il motivo scritto. */
function missGeneraMissione(scenario) {
  const scelte = Object.assign({ durata: 30, strumento: 'occhio', esperienza: 'stupore', cielo: 'tutto', cieloDa: 135, cieloA: 180, voce: false },
    scenario && scenario.scelte);
  const condizioni = (scenario && scenario.condizioni) || {};
  const adesso = (scenario && scenario.adesso) || Date.now();
  const partenza = (scenario && scenario.partenza) || adesso;
  const tutti = (scenario && scenario.candidati) || [];
  const evitare = new Set((scenario && scenario.evitare) || []);

  const ammessi = tutti.filter(c => missAmmissibile(c, scelte));
  if (!ammessi.length) {
    return { vuota: true, motivo: 'nienteInVista', scelte, condizioni, tappe: [] };
  }

  const votati = ammessi
    .map(c => Object.assign({}, c, { punti: missPunteggio(c, scelte, condizioni) }))
    .sort((a, b) => b.punti - a.punti);

  // Chi va evitato (la rigenerazione, e le tappe già sostituite) scende in
  // fondo invece di sparire: se le alternative finiscono, meglio ripetersi
  // che restituire una missione vuota.
  votati.sort((a, b) => (evitare.has(a.id) ? 1 : 0) - (evitare.has(b.id) ? 1 : 0));

  const quante = missQuanteTappe(scelte.durata, votati.length);
  const perFamiglia = {};
  const scelti = [];
  for (const c of votati) {
    if (scelti.length >= quante) break;
    if (missDoppione(c, scelti)) continue;
    const f = missFamigliaDi(c);
    if ((perFamiglia[f] || 0) >= MISS_TETTO_FAMIGLIA) continue;
    perFamiglia[f] = (perFamiglia[f] || 0) + 1;
    scelti.push(c);
  }
  // Se il tetto per famiglia ha lasciato la missione più corta del
  // dovuto, si riempie: la varietà è una preferenza, avere delle tappe è
  // un requisito.
  for (const c of votati) {
    if (scelti.length >= quante) break;
    if (!scelti.includes(c) && !missDoppione(c, scelti)) scelti.push(c);
  }

  const { fila, fissi } = missOrdinaPerProgressione(scelti, scelte);
  const inOrario = missMettiInOrario(fila, fissi, partenza, scelte.durata, scelte);
  // Il racconto resta uguale mentre si apre, si chiude o si riprende la
  // missione, ma cambia davvero quando se ne genera un'altra. Affidarsi a
  // Math.random durante il rendering farebbe invece cambiare storia a ogni
  // clic su «non lo trovo».
  const idMissione = 'miss-' + partenza + '-' + Math.random().toString(36).slice(2, 8);
  const tappe = missAttaccaRiferimenti(inOrario, votati).map((t, i) => Object.assign({}, t, {
    indice: i,
    esito: null,
    aiuto: 0,
    raccontoVariante: missHashTesto(idMissione + ':' + t.id) % 3
  }));

  return {
    id: idMissione,
    versione: MISS_VERSIONE,
    creata: adesso,
    partenza,
    scelte,
    condizioni,
    tappe,
    scartati: votati.filter(c => !scelti.includes(c)).map(c => c.id),
    // Quanto dura davvero: l'ultima tappa più il tempo per guardarla.
    durataStimataMin: scelte.durata
  };
}


// =====================================================================
// 3. I CANDIDATI — da dove vengono, e come si misurano
//
//     Qui si esce dalla parte pura e si va a chiedere al resto dell'app.
//     Niente di quello che c'è qui sotto calcola una posizione da sé:
//     `altAzCorpo`, `altAzCoordinate`, `finestraBuio`, `orizzonteAltezza`
//     e `terrenoAltezza` esistono già, e una seconda effemeride sarebbe
//     una seconda verità da tenere d'accordo con la prima.
//
//     La sola cosa che si fa in proprio è **campionare la finestra della
//     missione** invece della notte intera. `pianCurvaNotturna` prende
//     novantasei campioni dal tramonto all'alba, che è la domanda giusta
//     per la dashboard («stanotte quando è più alto?») e quella sbagliata
//     per qui («nella mezz'ora che ho, si vede?»). Con centocinquanta
//     candidati la differenza è fra quattordicimila conti e mille.
// =====================================================================

// Quanti campioni dentro alla finestra: uno ogni otto minuti circa, e mai
// meno di tre. Un oggetto non cambia altezza abbastanza in otto minuti da
// far cambiare idea a nessuno — tranne le stazioni spaziali, che infatti
// non passano di qui (§3-ter).
function missCampioni(partenzaMs, durataMin) {
  const passo = Math.max(3 * 60000, Math.round(durataMin * 60000 / 12));
  const campioni = [];
  for (let ms = partenzaMs; ms <= partenzaMs + durataMin * 60000; ms += passo) {
    campioni.push(ms);
  }
  if (campioni.length < 3) {
    campioni.length = 0;
    for (let k = 0; k <= 2; k++) campioni.push(partenzaMs + k * durataMin * 30000);
  }
  return campioni;
}

/* L'ostacolo in una direzione: il terreno vero se c'è, se no quello che
 * è stato dichiarato a mano.
 *
 * Non si passa da `skyAltezzaOrizzonte`, ed è una scelta: quella, senza
 * terreno, ci mette sopra il profilo *inventato* di `SKY_PROFILO` — che
 * per disegnare un cielo credibile va benissimo e per decidere se
 * mandare qualcuno a cercare una nebulosa no. Qui una collina che non è
 * stata misurata non esiste. */
function missOstacolo(az) {
  let vero = null;
  if (typeof terrenoDisponibile === 'function' && terrenoDisponibile() &&
      typeof terrenoAltezza === 'function') {
    try { vero = terrenoAltezza(az); } catch (e) { vero = null; }
  }
  const dichiarato = typeof orizzonteAltezza === 'function' ? orizzonteAltezza(az) : 0;
  return Math.max(typeof vero === 'number' ? vero : 0, dichiarato);
}

/* Dove sta un bersaglio dentro alla finestra della missione.
 *
 * Restituisce il momento migliore — il più alto *e* sopra l'ostacolo — e
 * per quanti minuti resta guardabile. Chi non è mai guardabile risponde
 * `null`, e non entra nemmeno in classifica. */
function missVisibilitaNellaFinestra(bersaglio, obs, campioni) {
  let migliore = null;
  let buoni = 0;
  for (const ms of campioni) {
    const data = new Date(ms);
    let p;
    try {
      p = bersaglio.ra !== undefined
        ? altAzCoordinate(bersaglio.ra, bersaglio.dec, data, obs)
        : altAzCorpo(bersaglio.id, data, obs);
    } catch (e) { continue; }
    if (!p || typeof p.alt !== 'number') continue;
    const sopra = p.alt - missOstacolo(p.az);
    if (sopra > 1) buoni++;
    if (sopra > 1 && (!migliore || p.alt > migliore.alt)) {
      migliore = { ms, alt: p.alt, az: p.az, sopraOstacoli: sopra };
    }
  }
  if (!migliore) return null;
  const passo = campioni.length > 1 ? (campioni[1] - campioni[0]) / 60000 : 5;
  return { migliore, minutiUtili: Math.round(buoni * passo) };
}

/* Dalla figura del planetario alla sua sigla IAU.
 *
 * Il confronto è sul nome italiano perché è quello che le due tabelle
 * hanno in comune: `SKY_COSTELLAZIONI` (app.js) e `COSTELLAZIONI_IAU`
 * (dati-costellazioni.js) vengono dalla stessa fonte e lo scrivono
 * uguale. Senza catalogo si risponde `null`, e chi chiede il nome si
 * tiene l'italiano — che è come si comportava tutta l'app prima che le
 * figure entrassero nel dizionario.
 *
 * La tabella si costruisce una volta sola e si butta quando il catalogo
 * cambia: sono ottantotto voci, e rifarla a ogni candidato vorrebbe dire
 * ottantotto scansioni per ognuna delle ventitré figure del planetario. */
let missSigleCostellazioni = null;

function missSiglaCostellazione(nomeItaliano) {
  if (typeof COSTELLAZIONI_IAU === 'undefined') return null;
  if (!missSigleCostellazioni || missSigleCostellazioni.size === 0) {
    missSigleCostellazioni = new Map();
    COSTELLAZIONI_IAU.forEach(c => {
      if (!missSigleCostellazioni.has(c.nome)) missSigleCostellazioni.set(c.nome, c.sigla);
    });
  }
  return missSigleCostellazioni.get(nomeItaliano) || null;
}

// Il nome di una tappa nella lingua di adesso. Per tutto tranne le
// costellazioni è quello che c'è scritto: i pianeti e le stelle il loro
// nome ce l'hanno già tradotto da `nomeCorpo`, e «M31 — Galassia di
// Andromeda» è anche l'identificativo con cui l'app lo ritrova (vedi il
// residuo dichiarato in `scripts/i18n-tetto.json`).
function missNomeTappa(t) {
  if (!t) return '';
  if (t.tipo === 'costellazione' && t.sigla && typeof costNomeFigura === 'function') {
    return costNomeFigura(t.sigla, t.nome);
  }
  return t.nome;
}

// Quanto un oggetto salta all'occhio a chi non sa dove guardare. Zero è
// «bisogna sapere dov'è», uno è «lo vedi uscendo di casa». Si ricava
// dalla magnitudine, che è l'unica misura che tutti questi oggetti hanno
// in comune, con la Luna fuori scala per conto suo.
function missEvidenzaDaMagnitudine(mag) {
  if (typeof mag !== 'number' || !isFinite(mag)) return 0.2;
  if (mag <= -3) return 1;
  if (mag >= 9) return 0;
  return Math.max(0, Math.min(1, (5.5 - mag) / 8));
}

// Quanto è difficile trovarlo, da 1 (impossibile sbagliare) a 5 (serve
// saper cercare). La magnitudine da sola non basta: M57 è brillante e
// largo un primo, cioè indistinguibile da una stella per chi non sa già
// dov'è — la misura apparente conta quanto la luce.
function missDifficolta(mag, strumento, assePrimi) {
  let d = 1;
  if (typeof mag === 'number') {
    if (mag > 8) d = 4;
    else if (mag > 5.5) d = 3;
    else if (mag > 2.5) d = 2;
  }
  if (strumento === 'binocolo') d = Math.max(d, 2);
  if (strumento === 'telescopio') d = Math.max(d, 3);
  if (typeof assePrimi === 'number' && assePrimi > 0 && assePrimi < 3) d += 1;
  return Math.max(1, Math.min(5, d));
}

/* I candidati del Sistema Solare, delle stelle e del cielo profondo.
 *
 * La materia prima è `pianBersagli()` — la stessa di `migliorDiStanotte`,
 * di proposito: due elenchi di bersagli diventerebbero due cataloghi da
 * tenere d'accordo. Qui si aggiungono le due famiglie che alla dashboard
 * non servono e a una missione sì: le **stelle luminose**, che sono i
 * riferimenti da cui parte ogni istruzione, e le **costellazioni**, che
 * sono la cosa che si impara. */
function missCandidatiDelCielo(obs, campioni, scelte) {
  const fuori = [];
  const bortle = typeof cieloDiCasa === 'function' ? cieloDiCasa() : 5;

  const base = typeof pianBersagli === 'function' ? pianBersagli() : [];
  for (const b of base) {
    const v = missVisibilitaNellaFinestra(
      b.ra !== undefined ? { ra: b.ra, dec: b.dec } : { id: b.id }, obs, campioni);
    if (!v) continue;

    let strumentoMinimo = 'occhio';
    let mag = typeof b.mag === 'number' ? b.mag : null;
    let assePrimi = null;
    let didattica = 0;
    let soffreLaLuna = false;

    if (b.tipo === 'profondo' && b.dato) {
      mag = b.dato.mag;
      assePrimi = b.dato.assePrimi;
      soffreLaLuna = true;
      didattica = 0.6;
      strumentoMinimo = typeof profondoStrumento === 'function'
        ? profondoStrumento(b.dato, bortle) : 'binocolo';
    } else if (b.tipo === 'corpoMinore') {
      soffreLaLuna = true;
      didattica = 0.5;
      strumentoMinimo = mag <= 6 ? 'occhio' : mag <= 9 ? 'binocolo' : 'telescopio';
    } else if (b.tipo === 'luna') {
      mag = -12;
      didattica = 0.8;
    } else if (b.tipo === 'pianeta') {
      // La magnitudine vera di un pianeta cambia molto: la si chiede alla
      // libreria, che la sa, invece di inventarne una media.
      try {
        mag = Astronomy.Illumination(b.id, Astronomy.MakeTime(new Date(v.migliore.ms))).mag;
      } catch (e) { mag = 1; }
      didattica = 0.5;
      // Urano e Nettuno restano puntini: senza almeno un binocolo non si
      // distinguono da una stellina qualunque, e proporli a occhio nudo
      // vuol dire mandare qualcuno a guardare il nulla.
      if (b.id === 'Uranus' || b.id === 'Neptune') strumentoMinimo = 'telescopio';
      else if (mag > 3) strumentoMinimo = 'binocolo';
    }

    fuori.push({
      id: b.tipo + ':' + (b.id || b.nome),
      nome: b.nome,
      tipo: b.tipo,
      idCielo: typeof pianIdCielo === 'function' ? pianIdCielo(b) : (b.id || null),
      quando: v.migliore.ms,
      altezza: v.migliore.alt,
      azimut: v.migliore.az,
      sopraOstacoli: v.migliore.sopraOstacoli,
      minutiUtili: v.minutiUtili,
      strumentoMinimo,
      mag,
      difficolta: b.tipo === 'luna' ? 1 : missDifficolta(mag, strumentoMinimo, assePrimi),
      evidenza: b.tipo === 'luna' ? 1 : missEvidenzaDaMagnitudine(mag),
      didattica,
      soffreLaLuna,
      aOrarioPreciso: false,
      puntiBase: 50
    });
  }

  // Le stelle luminose: sono gli otto slot che il planetario conosce già
  // per nome (`Star1…Star8`), quindi il tasto «Guidami» funziona senza
  // che il catalogo grande sia stato scaricato.
  if (typeof SKY_STELLE !== 'undefined') {
    SKY_STELLE.forEach((s, i) => {
      const v = missVisibilitaNellaFinestra({ ra: s.ra, dec: s.dec }, obs, campioni);
      if (!v) return;
      fuori.push({
        id: 'stella:Star' + (i + 1),
        nome: s.nome,
        tipo: 'stella',
        idCielo: 'Star' + (i + 1),
        quando: v.migliore.ms,
        altezza: v.migliore.alt,
        azimut: v.migliore.az,
        sopraOstacoli: v.migliore.sopraOstacoli,
        minutiUtili: v.minutiUtili,
        strumentoMinimo: 'occhio',
        mag: s.mag,
        difficolta: s.mag < 1 ? 1 : 2,
        evidenza: missEvidenzaDaMagnitudine(s.mag),
        didattica: 0.7,
        soffreLaLuna: false,
        aOrarioPreciso: false,
        puntiBase: 46
      });
    });
  }

  // Le costellazioni: il bersaglio è il baricentro delle loro stelle, e
  // la stella più luminosa fa da maniglia. Non hanno un identificativo
  // per il planetario — non sono un oggetto — ma hanno un **punto**, e
  // il ponte del §10 sa centrarci la vista.
  if (typeof SKY_COSTELLAZIONI !== 'undefined') {
    for (const cost of SKY_COSTELLAZIONI) {
      if (!cost.stelle || !cost.stelle.length) continue;
      // La sigla IAU, quando il catalogo è arrivato: è l'unico modo di
      // scrivere «Boötes» a chi legge in inglese. `SKY_COSTELLAZIONI` porta
      // il nome italiano e nient'altro, e il dizionario le figure le tiene
      // per sigla (`cost.nome.Boo`).
      const sigla = missSiglaCostellazione(cost.nome);
      const capofila = cost.stelle.reduce((a, b) => (b[2] < a[2] ? b : a));
      const raMedia = cost.stelle.reduce((s, st) => s + st[0], 0) / cost.stelle.length;
      const decMedia = cost.stelle.reduce((s, st) => s + st[1], 0) / cost.stelle.length;
      const v = missVisibilitaNellaFinestra({ ra: raMedia, dec: decMedia }, obs, campioni);
      if (!v) continue;
      fuori.push({
        id: 'costellazione:' + cost.nome,
        nome: cost.nome,
        sigla,
        tipo: 'costellazione',
        idCielo: null,
        mira: { ra: raMedia, dec: decMedia },
        capofila: capofila[3],
        quando: v.migliore.ms,
        altezza: v.migliore.alt,
        azimut: v.migliore.az,
        sopraOstacoli: v.migliore.sopraOstacoli,
        minutiUtili: v.minutiUtili,
        strumentoMinimo: 'occhio',
        mag: capofila[2],
        difficolta: capofila[2] < 1.6 ? 1 : capofila[2] < 2.5 ? 2 : 3,
        evidenza: missEvidenzaDaMagnitudine(capofila[2]) * 0.9,
        didattica: 1,
        soffreLaLuna: false,
        aOrarioPreciso: false,
        puntiBase: 44
      });
    }
  }

  return fuori;
}

/* I candidati che non aspettano: i passaggi delle stazioni spaziali e gli
 * eventi del calendario che cadono dentro alla finestra.
 *
 * Sono l'unica famiglia con un `quando` che non si può spostare, ed è
 * quella che rende una missione una serata invece di una lista. La
 * geometria non la calcola questo file: i passaggi li ha già calcolati
 * `app.js` (SGP4), e gli eventi sono `eventiCalcolati`. */
function missCandidatiAOrarioPreciso(partenzaMs, durataMin) {
  const fuori = [];
  const fine = partenzaMs + durataMin * 60000;

  if (typeof passaggiVisibiliOrdinati === 'function') {
    try {
      for (const p of passaggiVisibiliOrdinati()) {
        // Il culmine e non l'inizio: un passaggio comincia sull'orizzonte,
        // dove non lo vede nessuno, e il punto piu' alto e' quello a cui
        // vale la pena arrivare in tempo.
        const culmine = p.culmine instanceof Date ? p.culmine.getTime() : Number(p.culmine);
        if (!isFinite(culmine) || culmine < partenzaMs || culmine > fine) continue;
        const alt = typeof p.elevazioneMax === 'number' ? p.elevazioneMax : 40;
        const az = typeof p.azCulmine === 'number' ? p.azCulmine : 180;
        if (alt - missOstacolo(az) <= 1) continue;
        const sat = typeof satelliteDaId === 'function' ? satelliteDaId(p.satId) : null;
        fuori.push({
          id: 'stazione:' + p.satId + ':' + culmine,
          nome: sat ? sat.nome : p.satId,
          tipo: 'stazione',
          satId: p.satId,
          idCielo: 'sat-' + p.satId,
          quando: culmine,
          altezza: alt,
          azimut: az,
          sopraOstacoli: alt - missOstacolo(az),
          minutiUtili: Math.max(2, p.durataMin || 4),
          strumentoMinimo: 'occhio',
          mag: sat ? sat.magTipica : -2,
          difficolta: 1,
          evidenza: 0.95,
          didattica: 0.8,
          soffreLaLuna: false,
          aOrarioPreciso: true,
          puntiBase: 58
        });
      }
    } catch (e) { /* dati orbitali non ancora arrivati */ }
  }

  if (typeof eventiCalcolati !== 'undefined' && Array.isArray(eventiCalcolati)) {
    for (const ev of eventiCalcolati) {
      if (!ev || !ev.dataObj) continue;
      const ms = ev.dataObj.getTime();
      if (ms < partenzaMs || ms > fine) continue;
      // Un equinozio o una fase lunare non sono cose «da guardare a
      // quell'ora»: cadono a un istante che non ha niente di speciale in
      // cielo. Entrano solo gli eventi con un protagonista da puntare.
      if (!ev.corpoCielo) continue;
      let pos = null;
      try {
        const obs = osservatoreCorrente();
        pos = obs && typeof altAzCorpoQualunque === 'function'
          ? altAzCorpoQualunque(ev.corpoCielo, ev.dataObj, obs) : null;
      } catch (e) { pos = null; }
      if (!pos || typeof pos.alt !== 'number') continue;
      const sopra = pos.alt - missOstacolo(pos.az);
      if (sopra <= 1) continue;
      fuori.push({
        id: 'evento:' + ev.id,
        nome: ev.titolo,
        tipo: 'evento',
        eventoId: ev.id,
        idCielo: ev.corpoCielo,
        quando: ms,
        altezza: pos.alt,
        azimut: pos.az,
        sopraOstacoli: sopra,
        minutiUtili: 10,
        strumentoMinimo: typeof strumentoEvento === 'function' ? strumentoEvento(ev) : 'occhio',
        mag: null,
        difficolta: 2,
        evidenza: 0.8,
        didattica: 0.9,
        soffreLaLuna: false,
        aOrarioPreciso: true,
        puntiBase: 60
      });
    }
  }

  return fuori;
}

/* Lo scenario completo: quello che il motore puro riceve in pasto.
 *
 * Qui si raccoglie tutto e si dichiara **cosa manca**. Le tre assenze
 * possibili non sono uguali fra loro: senza posizione non si fa niente
 * (e si dice), senza meteo si fa tutto tranne il giudizio sulle nuvole,
 * senza terreno gli ostacoli sono solo quelli dichiarati a mano. Una
 * missione che non distingue i tre casi finisce col promettere quello
 * che non sa. */
function missScenario(scelte, partenzaMs) {
  const obs = typeof osservatoreCorrente === 'function' ? osservatoreCorrente() : null;
  if (!obs) return { errore: 'senzaPosizione' };
  if (typeof Astronomy === 'undefined') return { errore: 'senzaLibreria' };

  const adesso = Date.now();
  const partenza = partenzaMs || adesso;
  const buio = typeof finestraBuio === 'function' ? finestraBuio(new Date(partenza)) : null;
  const campioni = missCampioni(partenza, scelte.durata);

  const luna = typeof pianDisturboLunare === 'function'
    ? pianDisturboLunare(new Date(partenza)) : { fattore: 0 };
  const nuvole = (typeof pianNuvoleStanotte === 'function' && buio)
    ? pianNuvoleStanotte(buio) : null;
  const bortle = typeof cieloDiCasa === 'function' ? cieloDiCasa() : 5;

  const candidati = missCandidatiDelCielo(obs, campioni, scelte)
    .concat(missCandidatiAOrarioPreciso(partenza, scelte.durata));

  return {
    adesso, partenza, scelte, candidati,
    condizioni: {
      luna: luna ? luna.fattore : 0,
      nuvole,
      bortle,
      // Le tre dichiarazioni di ignoranza, esplicite: le legge il
      // pannello e ne fa una riga di avviso, invece di tacere.
      meteoAssente: nuvole === null,
      terrenoAssente: !(typeof terrenoDisponibile === 'function' && terrenoDisponibile()),
      buio: buio ? {
        tramonto: buio.tramonto ? buio.tramonto.getTime() : null,
        buioInizio: buio.buioInizio ? buio.buioInizio.getTime() : null,
        buioFine: buio.buioFine ? buio.buioFine.getTime() : null,
        alba: buio.alba ? buio.alba.getTime() : null
      } : null
    }
  };
}

/* L'ora consigliata per cominciare.
 *
 * Se il Sole è ancora alto, una missione «adesso» è una missione a vuoto:
 * si propone allora il momento in cui il cielo comincia davvero a essere
 * cielo — la fine del crepuscolo civile, che è quando le prime stelle
 * compaiono — e chi ha fretta può cominciare lo stesso. */
function missOraConsigliata() {
  const buio = typeof finestraBuio === 'function' ? finestraBuio(new Date()) : null;
  if (!buio || !buio.tramonto) return null;
  const inizio = (buio.nautico || buio.buioInizio || buio.tramonto).getTime();
  return inizio > Date.now() + 5 * 60000 ? inizio : null;
}


// =====================================================================
// 4. LA PERSISTENZA — riprendere quello che si stava facendo
//
//     Una missione si interrompe sempre: si rientra a prendere la
//     giacca, il telefono si blocca, la pagina si ricarica. Quello che
//     non deve succedere è ritrovarsi davanti alla configurazione con
//     tre tappe già trovate buttate via.
//
//     Il salvataggio è **numerato** (`versione`), e chi legge un formato
//     che non conosce non prova a indovinarlo: lo scarta e ricomincia.
//     Una migrazione inventata su un formato futuro è il modo in cui si
//     rompono le app che si aggiornano da sole.
// =====================================================================

/* Tre risposte e non due, ed è la differenza che conta: `undefined` vuol
 * dire «non c'è niente salvato», `null` vuol dire «c'è qualcosa e non si
 * legge». La seconda va **buttata**, se no resta lì a farsi rileggere e
 * riscartare a ogni apertura per sempre; la prima non c'è niente da
 * buttare. Con una risposta sola per tutti e due i casi un salvataggio
 * rotto diventa immortale. */
function missLeggiSalvato(chiave) {
  let grezzo = null;
  try {
    grezzo = localStorage.getItem(chiave);
  } catch (e) {
    return undefined;                      // storage negato: non c'è niente
  }
  if (grezzo === null || grezzo === '') return undefined;
  try {
    const dato = JSON.parse(grezzo);
    return (dato && typeof dato === 'object') ? dato : null;
  } catch (e) {
    return null;                            // c'è, ed è illeggibile
  }
}

function missScrivi(chiave, valore) {
  try {
    if (valore === null) localStorage.removeItem(chiave);
    else localStorage.setItem(chiave, JSON.stringify(valore));
    return true;
  } catch (e) {
    return false;
  }
}

function missCaricaScelte() {
  const s = missLeggiSalvato(CHIAVE_MISS_SCELTE);
  if (!s || typeof s !== 'object') return;
  if (MISS_DURATE.includes(s.durata)) miss.scelte.durata = s.durata;
  if (MISS_STRUMENTI.includes(s.strumento)) miss.scelte.strumento = s.strumento;
  if (MISS_ESPERIENZE.includes(s.esperienza)) miss.scelte.esperienza = s.esperienza;
  if (s.cielo === 'tutto' || s.cielo === 'settore') miss.scelte.cielo = s.cielo;
  if (MISS_DIREZIONI.includes(Number(s.cieloDa))) miss.scelte.cieloDa = Number(s.cieloDa);
  if (MISS_DIREZIONI.includes(Number(s.cieloA))) miss.scelte.cieloA = Number(s.cieloA);
  if (typeof s.voce === 'boolean') miss.scelte.voce = s.voce;
}

function missSalvaScelte() {
  missScrivi(CHIAVE_MISS_SCELTE, miss.scelte);
}

// Una missione salvata è buona se è del formato che conosciamo, ha delle
// tappe, e non è di ieri notte.
function missSalvataggioBuono(m) {
  if (!m || typeof m !== 'object') return false;
  if (m.versione !== MISS_VERSIONE) return false;
  if (!Array.isArray(m.tappe) || !m.tappe.length) return false;
  if (!m.tappe.every(t => t && typeof t.nome === 'string')) return false;
  const quando = Number(m.avviata || m.partenza || m.creata);
  if (!isFinite(quando)) return false;
  return Date.now() - quando < MISS_SCADENZA_MS;
}

function missCaricaAttiva() {
  const m = missLeggiSalvato(CHIAVE_MISS_ATTIVA);
  miss.attiva = missSalvataggioBuono(m) ? m : null;
  // Quello che c'era e non serve più — illeggibile, di un formato che non
  // conosciamo, o di ieri notte — si butta subito: tenerlo vuol dire
  // rileggerlo e riscartarlo a ogni apertura, per sempre.
  if (m !== undefined && !miss.attiva) missScrivi(CHIAVE_MISS_ATTIVA, null);
  return miss.attiva;
}

function missSalvaAttiva() {
  if (!miss.attiva) { missScrivi(CHIAVE_MISS_ATTIVA, null); return; }
  missScrivi(CHIAVE_MISS_ATTIVA, miss.attiva);
}

// Il cielo di una missione ripresa può non essere più quello: se gli
// eventi a orario preciso sono passati, o se è passata più di mezz'ora,
// conviene rigenerarla invece di riprenderla com'è.
function missDaAggiornare(m) {
  if (!m) return false;
  const adesso = Date.now();
  const scadute = m.tappe.some(t => t.aOrarioPreciso && !t.esito && t.quando < adesso);
  const finita = m.avviata && adesso - m.avviata > (m.scelte.durata + 45) * 60000;
  return scadute || finita;
}


// =====================================================================
// 5. IL PONTE COL PLANETARIO
//
//     «Guidami» non apre una seconda mappa del cielo: apre **quella**,
//     con l'orologio sull'istante della tappa e la vista sul bersaglio.
//     Tutto quello che serve esiste già (`mostraVista`, `skyImpostaTarget`,
//     `skyImpostaOffsetTempo`, `skyCentraSu`), e la sola cosa che questo
//     file aggiunge è la **striscia della missione**: chi arriva nel
//     planetario da qui deve sapere perché ci è arrivato e come tornare
//     indietro, se no il cielo è bellissimo e la missione è persa.
// =====================================================================

// Una tappa si può puntare nel planetario? Le costellazioni non hanno un
// identificativo — non sono un oggetto — ma hanno un punto, e quello
// basta a centrare la vista. Chi non ha né l'uno né l'altro non deve
// mostrare un tasto che non può funzionare.
function missTappaPuntabile(t) {
  return !!(t && (t.idCielo || (t.mira && typeof t.mira.ra === 'number')));
}

function missGuidami(indice) {
  const m = miss.attiva;
  if (!m) return;
  const t = m.tappe[indice];
  if (!t || !missTappaPuntabile(t)) return;

  m.corrente = indice;
  m.nelPlanetario = true;
  missSalvaAttiva();
  missChiudiPannello({ tieniMissione: true });

  if (typeof mostraVista === 'function') mostraVista('cielo');
  if (typeof skyMostraGruppo === 'function') skyMostraGruppo('');

  // Il tempo prima di tutto il resto — che da lui dipende — e dopo aver
  // aperto la vista, che lo azzera arrivando da un'altra parte. È lo
  // stesso ordine di `skyPuntaStazione`, e per la stessa ragione.
  if (typeof skyFermaPlayback === 'function') skyFermaPlayback();
  if (typeof skyImpostaOffsetTempo === 'function') {
    const scarto = (t.quando - Date.now()) / 1000;
    // Sotto il paio di minuti non si sposta niente: il cielo di adesso è
    // quello giusto, e un orologio spostato di novanta secondi si legge
    // come «non sto guardando adesso» senza esserlo.
    skyImpostaOffsetTempo(Math.abs(scarto) < 120 ? 0 : scarto,
      Math.abs(scarto) < 120 ? { reale: true } : {});
  }
  if (typeof skyAggiornaOggetti === 'function') skyAggiornaOggetti(true);

  // Con la bussola accesa la direzione la decide il telefono e nessun
  // centraggio vale: ci si sgancia, come fa il ponte delle stazioni.
  if (typeof skyUsaSensori === 'function' && skyUsaSensori() &&
      typeof skyAlternaSeguiTelefono === 'function') skyAlternaSeguiTelefono();

  if (t.idCielo && typeof skyImpostaTarget === 'function') {
    if (String(t.idCielo).startsWith('min:') && typeof corpiMinoriCarica === 'function') {
      sky.mostraCorpiMinori = true;
      corpiMinoriCarica();
    }
    if (String(t.idCielo).startsWith('dso:')) sky.mostraProfondo = true;
    if (String(t.idCielo).startsWith('sat-')) sky.mostraSatelliti = true;
    skyImpostaTarget(t.idCielo, { mantieni: true });
    const o = typeof skyVoceDiId === 'function' ? skyVoceDiId(t.idCielo) : null;
    if (typeof skyAssicuraVisibile === 'function') skyAssicuraVisibile(o);
    if (o && typeof skyCentraSu === 'function' &&
        !(typeof skyUsaSensori === 'function' && skyUsaSensori())) {
      if (typeof skyFermaMovimenti === 'function') skyFermaMovimenti();
      skyCentraSu(o, { subito: true });
    }
  } else if (t.mira && typeof altAzCoordinate === 'function') {
    // Una costellazione: si centra il suo baricentro, ricalcolato per
    // l'istante mostrato — quello salvato nella tappa è di quando la
    // missione è nata, e in un'ora il cielo gira di quindici gradi.
    try {
      // L'osservatore del planetario, che puo' essere un luogo di sola
      // visita, e non quello dell'app: se no la costellazione si centra
      // dove sarebbe da casa mentre il cielo disegnato e' di un'altra citta'.
      const obs = (typeof sky === 'object' && sky.observer) ? sky.observer : osservatoreCorrente();
      const p = altAzCoordinate(t.mira.ra, t.mira.dec,
        typeof skyAdesso === 'function' ? skyAdesso() : new Date(), obs);
      if (typeof skyFermaMovimenti === 'function') skyFermaMovimenti();
      if (typeof skyCentraSu === 'function') skyCentraSu({ nome: t.nome, az: p.az, alt: p.alt });
    } catch (e) { /* senza posizione non si centra niente */ }
  }

  if (typeof skyAggiornaTastiFiltri === 'function') skyAggiornaTastiFiltri();
  missMostraStrisciaCielo();
}

/* La striscia appoggiata sul cielo.
 *
 * Tre cose e non una di più: che missione è, a che tappa si è, e i due
 * tasti che servono lì — «Trovato» e «Torna alla missione». I comandi
 * del planetario non si toccano: chi arriva qui vuole anche zumare,
 * girare e leggere la scheda dell'oggetto, e nascondergli la barra del
 * tempo per metterci la nostra sarebbe scambiare la missione per l'app. */
function missMostraStrisciaCielo() {
  const striscia = document.getElementById('missione-striscia');
  if (!striscia) return;
  const m = miss.attiva;
  if (!m || !m.nelPlanetario || m.stato === 'conclusa') {
    striscia.classList.add('hidden');
    striscia.classList.remove('visibile');
    return;
  }
  const t = m.tappe[m.corrente];
  if (!t) { striscia.classList.add('hidden'); return; }

  const T = (k, d) => astroI18n.t('missione.' + k, d);
  striscia.innerHTML =
    `<div class="missione-striscia-testo">
       <span class="missione-striscia-titolo">${missIcona('bersaglio', 15)} ${T('titoloBreve')}</span>
       <span class="missione-striscia-tappa">${missTesto(T('tappaDiSu', {
          n: m.corrente + 1, tot: m.tappe.length, nome: missNomeTappa(t) }))}</span>
     </div>
     <div class="missione-striscia-tasti">
       <button type="button" class="missione-tasto missione-tasto-si" data-missione-striscia="trovato">${T('trovato')}</button>
       <button type="button" class="missione-tasto" data-missione-striscia="torna">${T('tornaAllaMissione')}</button>
     </div>`;
  striscia.classList.remove('hidden');
  striscia.classList.add('visibile');
  striscia.querySelectorAll('[data-missione-striscia]').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.missioneStriscia === 'trovato') missSegnaEsito(m.corrente, 'trovato');
      missTornaDalPlanetario();
    });
  });
}

// Si torna alla missione senza perdere niente: la missione è nello stato,
// non nel documento, e il pannello la ridisegna da lei.
function missTornaDalPlanetario() {
  if (miss.attiva) { miss.attiva.nelPlanetario = false; missSalvaAttiva(); }
  missMostraStrisciaCielo();
  if (typeof mostraVista === 'function') mostraVista('stasera');
  missApriPannello();
}


// =====================================================================
// 6. LA MISSIONE IN CORSO — avanzare, aiutare, sostituire, concludere
//
//     Tre esiti e non due: **trovato**, **saltato**, **non trovato**.
//     Sono tre fatti diversi e vanno tenuti distinti fino al diario:
//     saltare è una scelta (era nuvoloso, era dietro al tetto), non
//     trovare è un tentativo andato male, e chi li mette nello stesso
//     mucchio scrive un diario che non racconta niente.
// =====================================================================

/* Quanto ci si può allontanare dall'ora per cui la missione è stata
 * pensata prima che le sue tappe smettano di parlare del cielo giusto.
 * Venti minuti di cielo sono cinque gradi di rotazione, che non spostano
 * niente; sei ore sono un'altra notte. */
const MISS_SCARTO_RIGENERA_MS = 20 * 60000;

function missAvvia(missione, quando) {
  if (!missione) return;
  const partenza = quando || Date.now();

  /* Chi prepara la missione alle due del pomeriggio e la avvia subito.
   *
   * L'anteprima si costruisce per l'ora consigliata — il crepuscolo — e
   * «Inizia adesso» vuol dire adesso: fra le due può esserci mezza
   * giornata. Spostare gli orari e basta darebbe una missione che parla
   * di un cielo che non c'è, con Vega a ottantatré gradi in pieno
   * pomeriggio. Le tappe si scelgono allora da capo per l'istante vero
   * di partenza, che è la sola domanda onesta: «adesso, cosa si vede?». */
  if (Math.abs(partenza - missione.partenza) > MISS_SCARTO_RIGENERA_MS) {
    const scenario = missScenario(missione.scelte, partenza);
    if (!scenario.errore) {
      const rifatta = missGeneraMissione(scenario);
      if (!rifatta.vuota && rifatta.tappe.length) {
        missione = rifatta;
        missAvvisa('riprogrammata', {}, 'informa');
      }
    }
  }

  miss.attiva = Object.assign({}, missione, {
    stato: 'inCorso',
    avviata: partenza,
    corrente: 0,
    nelPlanetario: false
  });
  // Chi comincia dopo l'ora consigliata trova gli orari già rifatti: è la
  // stessa riga di `missRiprogramma`, chiamata qui invece che aspettare
  // il primo «non lo trovo».
  missRiprogramma(partenza);
  miss.anteprima = null;
  missSalvaAttiva();
  missMostraVista('inCorso');
  missRaccontaTappa(miss.attiva.tappe[0]);
}

/* Gli orari rifatti sul cielo di adesso.
 *
 * Chi genera una missione alle nove e la avvia alle dieci e mezza non ha
 * sbagliato niente: è andato a cena. Le tappe libere si ridistribuiscono
 * dall'istante vero di partenza, quelle a orario preciso già passate si
 * tolgono — e la sola cosa che non si fa è dirglielo come se fosse colpa
 * sua. */
function missRiprogramma(partenzaMs) {
  const m = miss.attiva;
  if (!m) return;
  const adesso = partenzaMs || Date.now();

  const restano = m.tappe.filter(t =>
    t.esito || !t.aOrarioPreciso || t.quando >= adesso + MISS_PREAVVISO_MIN * 60000);
  const perse = m.tappe.length - restano.length;
  m.tappe = restano.map((t, i) => Object.assign({}, t, { indice: i }));

  const daFare = m.tappe.filter(t => !t.esito && !t.aOrarioPreciso);
  const restaMs = Math.max(5 * 60000, m.scelte.durata * 60000 - (adesso - (m.avviata || adesso)));
  const passo = restaMs / Math.max(1, daFare.length);
  daFare.forEach((t, i) => { t.quando = adesso + Math.round(i * passo); });

  if (m.corrente >= m.tappe.length) m.corrente = Math.max(0, m.tappe.length - 1);
  if (perse > 0) missAvvisa('riprogrammata', {}, 'informa');
  missSalvaAttiva();
}

function missSegnaEsito(indice, esito) {
  const m = miss.attiva;
  if (!m || !m.tappe[indice]) return;
  m.tappe[indice].esito = esito;
  m.tappe[indice].quandoEsito = Date.now();
  missAvanza();
}

function missAvanza() {
  const m = miss.attiva;
  if (!m) return;
  const prossima = m.tappe.findIndex(t => !t.esito);
  if (prossima < 0) { missConcludi(); return; }
  m.corrente = prossima;
  m.tappe[prossima].aiuto = m.tappe[prossima].aiuto || 0;
  missSalvaAttiva();
  missMostraVista('inCorso');
  missRaccontaTappa(m.tappe[prossima]);
}

/* L'aiuto progressivo.
 *
 * «Non lo trovo» non segna niente: fa un gradino. Il primo ripete la
 * direzione con parole più semplici e nomina un riferimento; il secondo
 * dà il percorso dal riferimento al bersaglio, misurato in dita e pugni
 * a braccio teso, che è il solo goniometro che tutti hanno addosso; il
 * terzo dice la cosa che nessuna app dice mai — **forse è dietro a
 * qualcosa** — e propone di spostarsi, di aprire il planetario o di
 * cambiare bersaglio.
 *
 * Il terzo gradino è quello che conta: dopo due tentativi il problema di
 * solito non è la mira, è il palazzo di fronte. */
function missChiediAiuto() {
  const m = miss.attiva;
  if (!m) return;
  const t = m.tappe[m.corrente];
  if (!t) return;
  t.aiuto = Math.min(3, (t.aiuto || 0) + 1);
  missSalvaAttiva();
  missMostraVista('inCorso');
}

/* Sostituire una tappa.
 *
 * Si prende il migliore fra gli scartati che sia compatibile con lo
 * strumento e ancora in cielo, e gli si dà **l'orario della tappa che
 * sostituisce**: la durata complessiva della serata non cambia, che è
 * la promessa. Se un'alternativa non c'è, il tasto non compare affatto —
 * offrire una sostituzione che non si può fare è peggio di non offrirla.
 */
function missAlternativePerTappa() {
  const m = miss.attiva;
  if (!m) return [];
  const scenario = missScenario(m.scelte, Date.now());
  if (scenario.errore) return [];
  const gia = new Set(m.tappe.map(t => t.id));
  return scenario.candidati
    .filter(c => !gia.has(c.id) && missAmmissibile(c, m.scelte) && !c.aOrarioPreciso)
    .map(c => Object.assign({}, c, { punti: missPunteggio(c, m.scelte, scenario.condizioni) }))
    .sort((a, b) => b.punti - a.punti);
}

function missSostituisci(indice) {
  const m = miss.attiva;
  if (!m || !m.tappe[indice]) return false;
  const alternative = missAlternativePerTappa();
  if (!alternative.length) { missAvvisa('nienteDaSostituire', {}, 'informa'); return false; }
  const vecchia = m.tappe[indice];
  const nuova = missAttaccaRiferimenti(
    [Object.assign({}, alternative[0], {
      quando: vecchia.quando, indice, esito: null, aiuto: 0
    })], alternative)[0];
  m.tappe[indice] = nuova;
  m.sostituzioni = (m.sostituzioni || []).concat([{ da: vecchia.id, a: nuova.id }]);
  missSalvaAttiva();
  missAvvisa('sostituita', { nome: nuova.nome }, 'bene');
  missMostraVista('inCorso');
  return true;
}

function missConcludi() {
  const m = miss.attiva;
  if (!m) return;
  m.stato = 'conclusa';
  m.conclusa = Date.now();
  m.durataRealeMin = Math.max(1, Math.round((m.conclusa - (m.avviata || m.conclusa)) / 60000));
  m.nelPlanetario = false;
  // Chi conclude a metà lascia delle tappe senza esito: non sono «non
  // trovate», sono tappe a cui non si è arrivati, e il diario le conta
  // come saltate — che è quello che è successo.
  m.tappe.forEach(t => { if (!t.esito) t.esito = 'saltato'; });
  missSalvaAttiva();
  missMostraStrisciaCielo();
  missMostraVista('conclusa');
}

function missAbbandona() {
  miss.attiva = null;
  miss.anteprima = null;
  missSalvaAttiva();
  missMostraStrisciaCielo();
  missMostraVista('configurazione');
  missAggiornaScheda();
}

function missConto(m) {
  const conto = { trovato: 0, saltato: 0, nonTrovato: 0 };
  (m ? m.tappe : []).forEach(t => {
    if (t.esito === 'trovato') conto.trovato++;
    else if (t.esito === 'nonTrovato') conto.nonTrovato++;
    else conto.saltato++;
  });
  return conto;
}


// =====================================================================
// 7. IL DIARIO — una sessione, non cinque osservazioni scollegate
//
//     Il diario esiste già ed è un oggetto `{ id: voce }` in
//     `localStorage`. Una missione ci entra come **una voce sola**, con
//     dentro le sue tappe: cinque voci separate direbbero di aver visto
//     cinque cose in una notte senza dire che erano un percorso, e
//     soprattutto riempirebbero il diario di righe che nessuno ha
//     scritto.
//
//     La retrocompatibilità è in una riga: la voce nuova porta i campi
//     che il diario già legge (`titolo`, `dataEvento`, `nota`, `stelle`,
//     `strumento`, `categoria`) e in più un campo `missione` che le
//     vecchie non hanno. Chi disegna il diario guarda quel campo per
//     decidere se mostrare le tappe, e chi non ce l'ha si disegna come
//     sempre.
// =====================================================================

function missSalvaNelDiario(dettagli) {
  const m = miss.attiva;
  if (!m || typeof diario !== 'object' || typeof salvaDiario !== 'function') return null;

  const conto = missConto(m);
  const id = 'missione-' + m.id;
  diario[id] = {
    // I campi che il diario legge da sempre
    titolo: astroI18n.t('missione.diarioTitolo', { n: conto.trovato }),
    chiave: 'missione.diarioTitolo',
    dataEvento: new Date(m.avviata || m.creata).toISOString(),
    quando: new Date().toISOString(),
    // «Personali» e non «Pianeti»: una missione e' una serata di chi la
    // fa, non un evento del calendario, e infilarla in una categoria
    // astronomica gonfierebbe il traguardo «Collezionista» con una
    // categoria che nessuno ha davvero osservato.
    categoria: 'personali',
    nota: (dettagli && dettagli.nota) || '',
    stelle: (dettagli && dettagli.stelle) || 0,
    strumento: m.scelte.strumento,
    // …e il campo che le voci vecchie non hanno: la sessione.
    missione: {
      versione: MISS_VERSIONE,
      id: m.id,
      avviata: m.avviata || m.creata,
      conclusa: m.conclusa || Date.now(),
      durataPrevistaMin: m.scelte.durata,
      durataRealeMin: m.durataRealeMin || m.scelte.durata,
      strumento: m.scelte.strumento,
      esperienza: m.scelte.esperienza,
      luogo: typeof etichettaLuogo === 'function' ? (etichettaLuogo() || null) : null,
      lat: typeof luogoCorrente === 'function' && luogoCorrente() ? luogoCorrente().lat : null,
      lon: typeof luogoCorrente === 'function' && luogoCorrente() ? luogoCorrente().lon : null,
      condizioni: {
        luna: m.condizioni ? m.condizioni.luna : null,
        nuvole: m.condizioni ? m.condizioni.nuvole : null,
        bortle: m.condizioni ? m.condizioni.bortle : null
      },
      preferita: (dettagli && dettagli.preferita) || null,
      // La `sigla` viaggia col nome, e non e' un di piu': senza, la
      // figura salvata in una serata italiana resta «Boote» per sempre
      // anche a chi apre il diario in inglese.
      tappe: m.tappe.map(t => ({
        id: t.id, nome: t.nome, tipo: t.tipo, sigla: t.sigla || null,
        quando: t.quando, esito: t.esito || 'saltato'
      }))
    }
  };
  salvaDiario();
  if (typeof costruisciDiario === 'function' &&
      typeof vistaAttuale !== 'undefined' && vistaAttuale === 'diario') costruisciDiario();
  return id;
}


/* Come una missione si legge nel Diario.
 *
 * Il diario disegna le sue voci in `costruisciDiario` (app.js §15), e
 * una voce di missione ha bisogno di due cose che le altre non hanno: un
 * titolo che segua la lingua di adesso — quello congelato nel
 * salvataggio resta nella lingua di quella sera — e le sue tappe, che
 * sono la sessione. Non si tocca nient'altro: le voci senza il campo
 * `missione` passano di qui e ne escono identiche a prima. */
function missVoceDiario(v) {
  if (!v || !v.missione || typeof v.missione !== 'object') return null;
  const s = v.missione;
  const tappe = Array.isArray(s.tappe) ? s.tappe : [];
  const trovate = tappe.filter(t => t.esito === 'trovato').length;

  const righe = tappe.map(t => `<li data-esito="${missTesto(t.esito || 'saltato')}">
      <span class="missione-esito-segno" aria-hidden="true">${
        t.esito === 'trovato' ? '\u2713' : t.esito === 'nonTrovato' ? '\u2013' : '\u00b7'}</span>
      ${missTesto(missNomeTappa(t))}
      <span class="missione-esito-che">${missT('esito.' + (t.esito || 'saltato'))}</span>
    </li>`).join('');

  return {
    titolo: missT('diarioTitolo', { n: trovate }),
    sommario: missT('diarioSommario', {
      n: tappe.length,
      minuti: s.durataRealeMin || s.durataPrevistaMin || 0,
      luogo: missTesto(s.luogo || missT('luogoIgnoto'))
    }),
    html: `<details class="missione-diario-tappe">
        <summary>${missT('diarioVediTappe', { n: tappe.length })}</summary>
        <ul class="missione-diario-elenco">${righe}</ul>
      </details>`
  };
}


// =====================================================================
// 8. IL PANNELLO — cinque stati in una finestra sola
//
//     configurazione → anteprima → in corso → conclusa, più lo stato
//     vuoto per quando manca qualcosa. Sono cinque *stati* e non cinque
//     finestre: la testata resta ferma, cambia il corpo, e chiudere non
//     butta via niente — la missione vive nello stato del modulo, non
//     nel documento.
//
//     Il markup di partenza sta in `index.html` ed è un guscio: il corpo
//     lo scrive qui, perché dipende da quello che c'è in cielo stanotte.
// =====================================================================

// Le due scorciatoie di servizio. `missTesto` esiste perché in una tappa
// finisce anche il nome di una cometa scritto dall'utente: un `<` in
// mezzo a un `innerHTML` è un tag, e va tolto sempre, non quando ci si
// ricorda.
function missTesto(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function missIcona(nome, misura) {
  return typeof icona === 'function' ? icona(nome, misura || 16) : '';
}

function missT(chiave, dati) {
  return typeof astroI18n === 'object' ? astroI18n.t('missione.' + chiave, dati) : chiave;
}

function missOra(ms) {
  return typeof oraBreve === 'function' ? oraBreve(new Date(ms)) : '';
}

function missAvvisa(chiave, dati, tono) {
  miss.avviso = { chiave, dati: dati || {}, tono: tono || 'informa' };
}

function missMostraVista(vista) {
  miss.vista = vista;
  if (miss.aperto) missDisegnaPannello();
  missAggiornaScheda();
}

// --- la scheda dentro a Stasera -------------------------------------
//
// Compatta quando non succede niente: un titolo, una riga e un tasto.
// Il riquadro sta fra «Stanotte» e il meteo perché è lì che nasce la
// domanda — si è appena letto a che ora fa buio e quanta Luna c'è.

function missAggiornaScheda() {
  const box = document.getElementById('missione-scheda');
  if (!box) return;

  const senzaPosizione = typeof osservatoreCorrente === 'function' && !osservatoreCorrente();
  if (senzaPosizione) {
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('servePosizione')}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" onclick="apriPosizione(true)">` +
      `${missT('dimmiDoveSono')}</button>`;
    return;
  }

  const m = miss.attiva;
  if (m && m.stato === 'inCorso') {
    const fatte = m.tappe.filter(t => t.esito).length;
    const t = m.tappe[m.corrente];
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('inCorsoSintesi', {
        fatte, tot: m.tappe.length, nome: missTesto(t ? missNomeTappa(t) : '') })}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" data-missione="riprendi">` +
      `${missT('riprendi')}</button>`;
  } else if (m && m.stato === 'conclusa') {
    const conto = missConto(m);
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('conclusaSintesi', { n: conto.trovato })}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" data-missione="riprendi">` +
      `${missT('vediRisultato')}</button>`;
  } else {
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('invito')}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" data-missione="apri">` +
      `${missIcona('bersaglio', 16)} ${missT('preparami')}</button>`;
  }

  box.querySelectorAll('[data-missione]').forEach(b =>
    b.addEventListener('click', () => missApriPannello()));
}

// --- l'apertura e la chiusura ---------------------------------------

function missApriPannello() {
  const modale = document.getElementById('modale-missione');
  if (!modale) return;

  miss.fuocoPrima = document.activeElement;
  miss.aperto = true;

  // Dove si riapre: chi ha una missione in corso la ritrova al punto in
  // cui era, chi ne ha una conclusa vede il risultato, gli altri le tre
  // domande. Riportare tutti alla configurazione vorrebbe dire chiedere
  // di ricominciare a chi voleva soltanto rileggere la tappa.
  if (miss.attiva && miss.attiva.stato === 'inCorso') {
    if (missDaAggiornare(miss.attiva)) missAvvisa('daAggiornare', {}, 'informa');
    miss.vista = 'inCorso';
  } else if (miss.attiva && miss.attiva.stato === 'conclusa') {
    miss.vista = 'conclusa';
  } else if (miss.anteprima) {
    miss.vista = 'anteprima';
  } else {
    miss.vista = 'configurazione';
  }

  modale.classList.remove('hidden');
  missDisegnaPannello();
  missAggancia();
  // Il fuoco al primo comando: chi naviga da tastiera deve trovarsi
  // dentro alla finestra, non dietro di lei.
  const primo = modale.querySelector('.missione-corpo button, .missione-corpo input, .tasto-chiudi');
  if (primo) primo.focus();
}

function missChiudiPannello(opzioni) {
  const modale = document.getElementById('modale-missione');
  if (modale) modale.classList.add('hidden');
  miss.aperto = false;
  miss.avviso = null;
  missStacca();
  if (!(opzioni && opzioni.tieniMissione) && miss.fuocoPrima && miss.fuocoPrima.focus) {
    try { miss.fuocoPrima.focus(); } catch (e) { /* nodo sparito nel frattempo */ }
  }
  miss.fuocoPrima = null;
  missAggiornaScheda();
}

/* Il fuoco intrappolato, e l'Escape.
 *
 * Non si delega a `inizializzaChiusuraSchedeConEsc`: quella chiude
 * l'ultima finestra aperta, e va benissimo, ma qui il primo Escape deve
 * poter chiudere *un foglio interno* (la sostituzione di una tappa)
 * lasciando aperta la finestra. La trappola del fuoco invece non esiste
 * altrove nell'app e serve: una finestra modale da cui il tabulatore
 * esce non è una finestra modale. */
function missAggancia() {
  const modale = document.getElementById('modale-missione');
  if (!modale) return;

  const tastiera = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      missChiudiPannello();
      return;
    }
    if (e.key !== 'Tab') return;
    const fuocabili = Array.from(modale.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(n => n.offsetParent !== null);
    if (!fuocabili.length) return;
    const primo = fuocabili[0], ultimo = fuocabili[fuocabili.length - 1];
    if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  };
  modale.addEventListener('keydown', tastiera, true);
  miss.staccare.push(() => modale.removeEventListener('keydown', tastiera, true));

  // Il cambio lingua: il pannello si compone tutto in JavaScript, quindi
  // non ha nessuna chiave nel documento da riscrivere — si ridisegna.
  if (typeof astroI18n === 'object' && astroI18n.alCambio) {
    const stacca = astroI18n.alCambio(() => { if (miss.aperto) missDisegnaPannello(); });
    if (typeof stacca === 'function') miss.staccare.push(stacca);
  }
}

function missStacca() {
  miss.staccare.forEach(f => { try { f(); } catch (e) { /* già staccato */ } });
  miss.staccare = [];
}

// --- il disegno -----------------------------------------------------

function missDisegnaPannello() {
  const corpo = document.getElementById('missione-corpo');
  if (!corpo) return;

  let html = '';
  if (miss.avviso) {
    html += `<p class="missione-avviso" data-tono="${miss.avviso.tono}" role="status">` +
      missT(miss.avviso.chiave, miss.avviso.dati) + '</p>';
  }

  if (miss.vista === 'anteprima' && miss.anteprima) html += missHtmlAnteprima(miss.anteprima);
  else if (miss.vista === 'inCorso' && miss.attiva) html += missHtmlInCorso(miss.attiva);
  else if (miss.vista === 'conclusa' && miss.attiva) html += missHtmlConclusa(miss.attiva);
  else if (miss.vista === 'vuoto') html += missHtmlVuoto();
  else html += missHtmlConfigurazione();

  corpo.innerHTML = html;
  missCollegaPannello(corpo);
}

function missGruppoScelte(nome, voci, attuale, etichetta) {
  const pillole = voci.map(v => {
    const scelto = v.valore === attuale;
    return `<button type="button" class="missione-scelta${scelto ? ' attiva' : ''}"
      role="radio" aria-checked="${scelto}" data-miss-scelta="${nome}" data-miss-valore="${v.valore}">
      ${v.icona ? missIcona(v.icona, 18) : ''}<span>${v.nome}</span></button>`;
  }).join('');
  return `<fieldset class="missione-gruppo">
    <legend class="missione-domanda">${etichetta}</legend>
    <div class="missione-scelte" role="radiogroup" aria-label="${etichetta}">${pillole}</div>
  </fieldset>`;
}

function missHtmlConfigurazione() {
  const durate = MISS_DURATE.map(d => ({ valore: d, nome: missT('durata.' + d) }));
  const strumenti = MISS_STRUMENTI.map(s => ({
    valore: s, icona: (typeof STRUMENTI !== 'undefined' && STRUMENTI[s]) ? STRUMENTI[s].disegno : null,
    nome: (typeof STRUMENTI !== 'undefined' && STRUMENTI[s]) ? STRUMENTI[s].nome : s
  }));
  const esperienze = MISS_ESPERIENZE.map(e => ({ valore: e, nome: missT('esperienza.' + e) }));
  const direzione = gradi => typeof astroI18n === 'object' && astroI18n.nomePunto
    ? astroI18n.nomePunto(gradi) : String(gradi) + '°';
  const opzioniDirezione = selezionata => ([...MISS_DIREZIONI,
    ...(MISS_DIREZIONI.includes(selezionata) ? [] : [selezionata])].sort((a, b) => a - b)).map(g =>
    `<option value="${g}"${g === selezionata ? ' selected' : ''}>${missTesto(direzione(g))} · ${g}°</option>`).join('');

  return `<div class="missione-configurazione">
    ${missGruppoScelte('durata', durate, miss.scelte.durata, missT('quantoTempo'))}
    ${missGruppoScelte('strumento', strumenti, miss.scelte.strumento, missT('conCosa'))}
    ${missGruppoScelte('esperienza', esperienze, miss.scelte.esperienza, missT('cheEsperienza'))}
    ${missGruppoScelte('cielo', [
      { valore: 'tutto', nome: missT('cieloTutto') }, { valore: 'settore', nome: missT('cieloSettore') }
    ], miss.scelte.cielo, missT('qualeCielo'))}
    ${miss.scelte.cielo === 'settore' ? `<div class="missione-settore">
      <label class="missione-campo"><span>${missT('daDirezione')}</span><select class="missione-select" data-miss-limite="cieloDa">${opzioniDirezione(miss.scelte.cieloDa)}</select></label>
      <label class="missione-campo"><span>${missT('aDirezione')}</span><select class="missione-select" data-miss-limite="cieloA">${opzioniDirezione(miss.scelte.cieloA)}</select></label>
      <div class="missione-rilievo">
        <button type="button" class="missione-tasto" data-miss-rileva>
          ${missIcona('bussola', 16)} ${missT(miss.rilievoSettore ? 'settoreRilevaSecondo' : 'settoreRilevaPrimo')}
        </button>
        <span class="missione-rilievo-stato" role="status">${miss.rilievoSettore
          ? missT('settorePrimoPreso', { gradi: miss.rilievoSettore.primo }) : missT('settoreRilevaIstruzioni')}</span>
      </div>
      <p>${missT('settoreSpiega')}</p></div>` : ''}
    ${missGruppoScelte('voce', [
      { valore: 'si', nome: missT('voceSi') }, { valore: 'no', nome: missT('voceNo') }
    ], miss.scelte.voce ? 'si' : 'no', missT('vuoiVoce'))}
    <div class="missione-azioni">
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="genera">
        ${missIcona('bersaglio', 16)} ${missT('preparami')}</button>
    </div>
  </div>`;
}

function missHtmlVuoto() {
  return `<div class="missione-vuoto">
    <p class="missione-scheda-testo">${missT('nienteInVista')}</p>
    <div class="missione-azioni">
      <button type="button" class="missione-tasto" data-miss-azione="configura">${missT('cambiaScelte')}</button>
    </div>
  </div>`;
}

// Le condizioni della notte in una riga, e le assenze dichiarate.
/* Com'è la notte, in una frase che si regge da sola.
 *
 * Le due metà non sono intercambiabili, ed è la ragione per cui la Luna
 * ha due versioni. Attaccata alle nuvole è una subordinata («Il cielo
 * sarà sereno, e non c'è Luna a dare fastidio»); da sola, quando il meteo
 * non è arrivato, quella stessa subordinata comincia con una «e» dopo un
 * punto — che è esattamente com'era, e si legge come una frase tagliata a
 * metà. */
function missRigaCondizioni(c) {
  const nuvole = (c.nuvole !== null && c.nuvole !== undefined)
    ? missT(c.nuvole <= 20 ? 'cielo.sereno' : c.nuvole <= 50 ? 'cielo.aTratti'
      : c.nuvole <= 80 ? 'cielo.nuvoloso' : 'cielo.coperto')
    : null;
  const conNuvole = !!nuvole;
  let luna = null;
  if (c.luna > 0.35) luna = missT(conNuvole ? 'cielo.conLuna' : 'cielo.conLunaSola');
  else if (c.luna < 0.1) luna = missT(conNuvole ? 'cielo.senzaLuna' : 'cielo.senzaLunaSola');
  if (nuvole && luna) return nuvole + ', ' + luna;
  return nuvole || luna || '';
}

function missHtmlAnteprima(m) {
  const c = m.condizioni || {};
  const avvisi = [];
  if (c.meteoAssente) avvisi.push(missT('senzaMeteo'));
  if (c.terrenoAssente) avvisi.push(missT('senzaTerreno'));

  const consigliata = missOraConsigliata();
  const righe = m.tappe.map((t, i) => `<li class="missione-anteprima-riga">
      <span class="missione-anteprima-ora">${missOra(t.quando)}</span>
      <span class="missione-anteprima-nome">${missTesto(missNomeTappa(t))}</span>
      <span class="missione-anteprima-che">${missT('difficolta.' + t.difficolta)}</span>
    </li>`).join('');

  return `<div class="missione-anteprima">
    <h3 class="missione-titolone">${missT('titoloAnteprima', {
      n: m.tappe.length, minuti: m.scelte.durata })}</h3>
    <p class="missione-sommario">${missT('sommarioAnteprima', {
      ora: missOra(m.partenza),
      condizioni: missRigaCondizioni(c) || missT('cielo.nonSoDire')
    })}</p>
    ${avvisi.length ? `<p class="missione-avviso" data-tono="informa">${avvisi.join(' ')}</p>` : ''}
    <ul class="missione-anteprima-elenco">${righe}</ul>
    <div class="missione-azioni">
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="avvia">
        ${missT('iniziaAdesso')}</button>
      ${consigliata ? `<button type="button" class="missione-tasto" data-miss-azione="avviaDopo">
        ${missT('iniziaAlle', { ora: missOra(consigliata) })}</button>` : ''}
      <button type="button" class="missione-tasto" data-miss-azione="rigenera">${missT('unaltra')}</button>
      <button type="button" class="missione-tasto" data-miss-azione="configura">${missT('cambiaScelte')}</button>
    </div>
  </div>`;
}

/* La tappa in corso: una alla volta, e detta come la direbbe una persona.
 *
 * Ascensione retta e declinazione qui non compaiono affatto, e non è
 * pigrizia: sono le coordinate giuste per una montatura e quelle
 * sbagliate per un paio d'occhi. Quello che serve è la direzione
 * cardinale, la fascia di cielo («basso», «a metà cielo», «molto in
 * alto») e un riferimento luminoso da cui partire. I gradi restano, ma
 * come informazione di seconda riga. */
function missHtmlInCorso(m) {
  const t = m.tappe[m.corrente];
  if (!t) return missHtmlConclusa(m);

  const fatte = m.tappe.filter(x => x.esito).length;
  const dove = typeof astroI18n === 'object' && astroI18n.nomePunto
    ? astroI18n.nomePunto(t.azimut) : '';
  const prossima = m.tappe.slice(m.corrente + 1).find(x => !x.esito);

  return `<div class="missione-corso">
    <div class="missione-avanzamento">
      <div class="missione-barra" role="progressbar" aria-valuemin="0"
           aria-valuemax="${m.tappe.length}" aria-valuenow="${fatte}"
           aria-label="${missT('avanzamento')}">
        <span style="width:${Math.round(fatte / m.tappe.length * 100)}%"></span>
      </div>
      <p class="missione-passo">${missT('tappaDi', { n: m.corrente + 1, tot: m.tappe.length })}</p>
    </div>

    <h3 class="missione-titolone">${missT('trova', { nome: missTesto(missNomeTappa(t)) })}</h3>
    <p class="missione-coordinate">
      <span>${missOra(t.quando)}</span>
      <span>${missTesto(dove)}</span>
      <span>${missT('altezza.' + missFasciaAltezza(t.altezza))}</span>
      <span class="missione-gradi">${missT('gradiSopra', { gradi: Math.round(t.altezza) })}</span>
    </p>
    <p class="missione-etichette">
      <span class="missione-etichetta">${missT('difficolta.' + t.difficolta)}</span>
      <span class="missione-etichetta">${(typeof STRUMENTI !== 'undefined' && STRUMENTI[t.strumentoMinimo])
        ? missIcona(STRUMENTI[t.strumentoMinimo].disegno, 14) + ' ' + STRUMENTI[t.strumentoMinimo].nome
        : ''}</span>
    </p>

    <p class="missione-guida">${missGuidaTesto(t)}</p>
    <section class="missione-racconto" aria-labelledby="missione-racconto-titolo">
      <div><h4 id="missione-racconto-titolo">${missT('curiositaTitolo')}</h4><p>${missT(missCuriositaChiave(t))}</p></div>
      ${m.scelte.voce ? `<button type="button" class="missione-tasto" data-miss-azione="ascolta">${missT('ascolta')}</button>` : ''}
    </section>
    ${missHtmlAiuto(t)}

    <div class="missione-azioni">
      ${missTappaPuntabile(t)
        ? `<button type="button" class="missione-tasto" data-miss-azione="guidami">
             ${missIcona('bersaglio', 16)} ${missT('guidami')}</button>` : ''}
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="trovato">${missT('trovato')}</button>
      <button type="button" class="missione-tasto" data-miss-azione="aiuto">${missT('nonLoTrovo')}</button>
      <button type="button" class="missione-tasto missione-tasto-lieve" data-miss-azione="salta">${missT('salta')}</button>
    </div>

    <div class="missione-piede">
      ${prossima ? `<p class="missione-prossima">${missT('poi', { nome: missTesto(missNomeTappa(prossima)) })}</p>` : ''}
      <button type="button" class="missione-tasto missione-tasto-lieve" data-miss-azione="concludi">${missT('concludi')}</button>
    </div>
  </div>`;
}

/* Il testo guida: dove guardare, detto a partire da qualcosa che si vede.
 *
 * Senza riferimento resta la direzione, che è già una risposta; con il
 * riferimento diventa un percorso, che è la risposta vera. La misura è
 * in dita e pugni a braccio teso perché un grado non lo sa stimare
 * nessuno e un pugno sì — e perché è così che si insegna a cercare in
 * cielo da prima che esistessero le app. */
function missGuidaTesto(t) {
  const dove = typeof astroI18n === 'object' && astroI18n.nomePunto
    ? astroI18n.nomePunto(t.azimut) : '';
  if (!t.riferimento) {
    return missT('guidaSemplice', {
      dove: missTesto(dove), altezza: missT('altezza.' + missFasciaAltezza(t.altezza))
    });
  }
  const misura = missMisuraAMano(t.riferimento.gradi);
  return missT('guidaConRiferimento', {
    da: missTesto(missNomeTappa(t.riferimento)),
    verso: missT('verso.' + t.riferimento.verso),
    misura: missT(misura.chiave.replace('missione.', ''))
  });
}

function missHashTesto(testo) {
  let h = 2166136261;
  for (const c of String(testo || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/* Non una curiosità intercambiabile, ma un piccolo repertorio legato al
 * bersaglio. Prima si riconoscono i nomi propri (anche inglesi e sigle di
 * catalogo), poi si ripiega sulla famiglia. Ogni voce ha tre racconti:
 * osservazione, storia umana e mito si alternano senza cambiare durante la
 * stessa missione. */
function missCuriositaChiave(tappa) {
  const nome = String((tappa && (tappa.sigla || tappa.nome)) || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lungo = (nome + ' ' + String(tappa && tappa.nome || '').toLowerCase()).replace(/\s+/g, ' ');
  const riconosci = [
    ['luna', /moon|luna/], ['mercurio', /mercur|mercury/], ['venere', /venus|venere/],
    ['marte', /mars|marte/], ['giove', /jupiter|giove/], ['saturno', /saturn|saturno/],
    ['urano', /uranus|urano/], ['nettuno', /neptune|nettuno/], ['sirio', /sirius|sirio/],
    ['vega', /\bvega\b/], ['polare', /polaris|polare/], ['betelgeuse', /betelgeuse/],
    ['pleiadi', /m\s*45|pleiad/], ['andromeda', /m\s*31|andromed/],
    ['orione', /m\s*42|orion/], ['ercole', /m\s*13|hercules|ercole/],
    ['cassiopea', /cassiopeia|cassiopea/], ['orsa', /ursa major|orsa.*maggiore/],
    ['lira', /\blyr\b|\blira\b|\blyra\b/], ['cigno', /cygnus|cigno/],
    ['scorpione', /scorpius|scorpione/]
  ];
  const proprio = riconosci.find(([, prova]) => prova.test(lungo));
  const base = proprio ? proprio[0] :
    (tappa && tappa.tipo === 'stazione' ? 'stazione' :
      tappa && ['profondo', 'costellazione', 'stella', 'pianeta'].includes(tappa.tipo) ? tappa.tipo : 'generica');
  const variante = Number.isInteger(tappa && tappa.raccontoVariante)
    ? tappa.raccontoVariante % 3 : missHashTesto(lungo) % 3;
  return `curiosita.${base}.${variante + 1}`;
}

let missAudioVoce = null;
let missRichiestaVoce = null;

function missFermaVoce() {
  if (missRichiestaVoce) missRichiestaVoce.abort();
  missRichiestaVoce = null;
  if (missAudioVoce) {
    missAudioVoce.pause();
    if (missAudioVoce.src && missAudioVoce.src.startsWith('blob:')) URL.revokeObjectURL(missAudioVoce.src);
  }
  missAudioVoce = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/* Il servizio e' un proxy Edge-TTS configurato dall'installazione e parla il
 * formato ormai comune di `/v1/audio/speech`: la chiave del provider rimane
 * sul server, mentre al browser arrivano soltanto MP3. Non leghiamo Missione
 * Cielo a una singola implementazione del proxy: bastano POST JSON, CORS e una
 * risposta audio. */
async function missVoceEdge(testo, lingua) {
  const endpoint = typeof window !== 'undefined' ? String(window.EDGE_TTS_API_URL || '').trim() : '';
  if (!endpoint || typeof fetch !== 'function' || typeof Audio === 'undefined') return false;

  const controllo = new AbortController();
  missRichiestaVoce = controllo;
  const risposta = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg, audio/*' },
    body: JSON.stringify({
      model: 'edge-tts',
      input: testo,
      voice: lingua === 'en' ? 'en-US-AvaNeural' : 'it-IT-IsabellaNeural',
      response_format: 'mp3',
      speed: 0.96
    }),
    signal: controllo.signal
  });
  if (!risposta.ok) throw new Error('Edge-TTS HTTP ' + risposta.status);
  const tipo = risposta.headers.get('content-type') || '';
  if (!tipo.startsWith('audio/')) throw new Error('EDGE_TTS_INVALID_CONTENT_TYPE');
  const audio = new Audio(URL.createObjectURL(await risposta.blob()));
  missRichiestaVoce = null;
  missAudioVoce = audio;
  audio.addEventListener('ended', () => {
    if (missAudioVoce !== audio) return;
    URL.revokeObjectURL(audio.src);
    missAudioVoce = null;
  }, { once: true });
  await audio.play();
  return true;
}

function missVoceDispositivo(testo, lingua) {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const frase = new SpeechSynthesisUtterance(testo);
  frase.lang = lingua === 'en' ? 'en-US' : 'it-IT';
  const voci = speechSynthesis.getVoices();
  const locali = voci.filter(v => v.lang.toLowerCase().startsWith(lingua));
  frase.voice = locali.find(v => /microsoft|natural|isabella|elsa|ava/i.test(v.name)) ||
    locali.find(v => v.localService) || locali[0] || null;
  frase.rate = 0.93; frase.pitch = 0.98;
  speechSynthesis.speak(frase);
  return true;
}

async function missRaccontaTappa(tappa, forza) {
  if (!tappa || (!forza && !(miss.attiva && miss.attiva.scelte.voce))) return false;
  missFermaVoce();
  const testo = missT('raccontoVoce', { nome: missNomeTappa(tappa), curiosita: missT(missCuriositaChiave(tappa)) });
  const lingua = typeof astroI18n === 'object' && astroI18n.lingua ? astroI18n.lingua : 'it';
  try {
    if (await missVoceEdge(testo, lingua)) return true;
  } catch (errore) {
    // Un racconto al buio deve funzionare anche con rete assente o quota API
    // esaurita: il ripiego e' intenzionale e non interrompe la missione.
    if (errore && errore.name === 'AbortError') return false;
    console.warn('Edge-TTS:', errore);
  }
  return missVoceDispositivo(testo, lingua);
}

/* I tre gradini dell'aiuto.
 *
 * Il terzo è quello che vale: dopo due tentativi il problema quasi mai è
 * la mira — è che davanti c'è un albero. Nessuna app lo dice, e chi non
 * lo sente pensa di aver sbagliato lui. */
function missHtmlAiuto(t) {
  const livello = t.aiuto || 0;
  if (!livello) return '';
  const pezzi = [];

  const dove = typeof astroI18n === 'object' && astroI18n.nomePunto
    ? astroI18n.nomePunto(t.azimut) : '';
  pezzi.push(`<p>${missT('aiuto1', {
    dove: missTesto(dove),
    altezza: missT('altezza.' + missFasciaAltezza(t.altezza)),
    gradi: Math.round(t.altezza)
  })}</p>`);

  if (livello >= 2) {
    if (t.riferimento) {
      const misura = missMisuraAMano(t.riferimento.gradi);
      pezzi.push(`<p>${missT('aiuto2', {
        da: missTesto(missNomeTappa(t.riferimento)),
        verso: missT('verso.' + t.riferimento.verso),
        misura: missT(misura.chiave.replace('missione.', '')),
        su: missT(t.riferimento.piuAlto ? 'verso.piuInAlto' : 'verso.piuInBasso')
      })}</p>`);
    } else {
      pezzi.push(`<p>${missT('aiuto2senzaRiferimento')}</p>`);
    }
  }

  if (livello >= 3) {
    pezzi.push(`<p>${missT('aiuto3')}</p>`);
    const alternative = missAlternativePerTappa();
    pezzi.push(`<div class="missione-azioni missione-azioni-aiuto">
      ${alternative.length
        ? `<button type="button" class="missione-tasto" data-miss-azione="sostituisci">${missT('sostituisci')}</button>`
        : ''}
      <button type="button" class="missione-tasto missione-tasto-lieve" data-miss-azione="nonTrovato">${missT('segnaNonTrovato')}</button>
    </div>`);
  }

  return `<div class="missione-aiuto" role="status">${pezzi.join('')}</div>`;
}

function missHtmlConclusa(m) {
  const conto = missConto(m);
  const trovate = m.tappe.filter(t => t.esito === 'trovato');
  const righe = m.tappe.map(t => `<li class="missione-esito-riga" data-esito="${t.esito || 'saltato'}">
      <span class="missione-esito-segno" aria-hidden="true">${
        t.esito === 'trovato' ? '✓' : t.esito === 'nonTrovato' ? '–' : '·'}</span>
      <span class="missione-anteprima-nome">${missTesto(missNomeTappa(t))}</span>
      <span class="missione-esito-che">${missT('esito.' + (t.esito || 'saltato'))}</span>
    </li>`).join('');

  const preferite = trovate.map(t =>
    `<option value="${missTesto(t.id)}">${missTesto(missNomeTappa(t))}</option>`).join('');

  return `<div class="missione-conclusa">
    <h3 class="missione-titolone">${missT('conclusaTitolo.' + (
      conto.trovato === 0 ? 'niente' : conto.trovato < m.tappe.length ? 'parziale' : 'tutto'),
      { n: conto.trovato, tot: m.tappe.length })}</h3>
    <p class="missione-sommario">${missT('conclusaSommario', {
      n: m.durataRealeMin || m.scelte.durata,
      luogo: missTesto((typeof etichettaLuogo === 'function' && etichettaLuogo()) || missT('luogoIgnoto')),
      // Non `STRUMENTI[…].nome`: quello è un'etichetta da tasto («A occhio
      // nudo», «With the naked eye») e dentro a una frase ci finisce con la
      // maiuscola in mezzo. Qui serve la forma da frase, che è un'altra
      // voce del dizionario.
      strumento: missT('strumento.' + m.scelte.strumento)
    })}</p>
    <ul class="missione-esiti">${righe}</ul>

    <div class="missione-modulo">
      ${trovate.length ? `<label class="missione-campo">
        <span>${missT('preferito')}</span>
        <select id="missione-preferita" class="missione-select">
          <option value="">${missT('nessunPreferito')}</option>${preferite}
        </select></label>` : ''}
      <label class="missione-campo">
        <span>${missT('votoSerata')}</span>
        <div id="missione-stelle" class="missione-stelle" role="radiogroup" aria-label="${missT('votoSerata')}">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="missione-stella"
             role="radio" aria-checked="false" data-miss-stelle="${n}"
             aria-label="${missT('stelleSu5', { n })}">★</button>`).join('')}
        </div></label>
      <label class="missione-campo">
        <span>${missT('nota')}</span>
        <textarea id="missione-nota" class="missione-nota" rows="2"
          placeholder="${missT('notaSegnaposto')}"></textarea></label>
    </div>

    <div class="missione-azioni">
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="salvaDiario">
        ${missIcona('quaderno', 16)} ${missT('salvaNelDiario')}</button>
      <button type="button" class="missione-tasto" data-miss-azione="configura">${missT('unaltraMissione')}</button>
      <button type="button" class="missione-tasto missione-tasto-lieve" data-miss-azione="butta">${missT('butta')}</button>
    </div>
  </div>`;
}

// --- i comandi ------------------------------------------------------

function missCollegaPannello(corpo) {
  corpo.querySelectorAll('[data-miss-scelta]').forEach(b => {
    b.addEventListener('click', () => {
      const nome = b.dataset.missScelta;
      let valore = nome === 'durata' ? Number(b.dataset.missValore) : b.dataset.missValore;
      if (nome === 'voce') valore = valore === 'si';
      miss.scelte[nome] = valore;
      if (nome === 'cielo') miss.rilievoSettore = null;
      missSalvaScelte();
      missDisegnaPannello();
    });
  });
  corpo.querySelectorAll('[data-miss-limite]').forEach(s => s.addEventListener('change', () => {
    miss.scelte[s.dataset.missLimite] = Number(s.value);
    miss.rilievoSettore = null;
    missSalvaScelte();
  }));
  const rileva = corpo.querySelector('[data-miss-rileva]');
  if (rileva) rileva.addEventListener('click', () => missRilevaEstremo(rileva));

  // Le cinque stelle: si accendono fino a quella toccata, come ovunque.
  let stelle = 0;
  corpo.querySelectorAll('[data-miss-stelle]').forEach(b => {
    b.addEventListener('click', () => {
      stelle = Number(b.dataset.missStelle);
      corpo.querySelectorAll('[data-miss-stelle]').forEach(x => {
        const acceso = Number(x.dataset.missStelle) <= stelle;
        x.classList.toggle('accesa', acceso);
        x.setAttribute('aria-checked', String(Number(x.dataset.missStelle) === stelle));
      });
      corpo.dataset.stelle = String(stelle);
    });
  });

  corpo.querySelectorAll('[data-miss-azione]').forEach(b => {
    b.addEventListener('click', () => missAzione(b.dataset.missAzione, corpo));
  });
}

async function missRilevaEstremo(tasto) {
  tasto.disabled = true;
  const stato = tasto.parentElement.querySelector('.missione-rilievo-stato');
  if (stato) stato.textContent = missT('settoreRilevaAttesa');

  const avviato = typeof skyRichiediSensori === 'function' && await skyRichiediSensori();
  let azimut = null;
  if (avviato && typeof skyLeggiAzimutBussola === 'function') {
    // La prima lettura puo' arrivare qualche istante dopo il consenso del
    // sistema. Si aspetta qui, senza costringere a premere una seconda volta.
    const scadenza = Date.now() + 2500;
    while (azimut === null && Date.now() < scadenza) {
      azimut = skyLeggiAzimutBussola();
      if (azimut === null) await new Promise(resolve => setTimeout(resolve, 80));
    }
  }
  if (azimut === null) {
    if (stato) stato.textContent = missT('settoreRilevaNonDisponibile');
    tasto.disabled = false;
    return;
  }

  const gradi = Math.round(azimut) % 360;
  if (!miss.rilievoSettore) {
    miss.scelte.cieloDa = gradi;
    miss.rilievoSettore = { primo: gradi };
  } else {
    miss.scelte.cieloA = gradi;
    miss.rilievoSettore = null;
  }
  missSalvaScelte();
  missDisegnaPannello();
}

function missAzione(azione, corpo) {
  miss.avviso = null;
  switch (azione) {
    case 'genera':
    case 'rigenera': {
      const evitare = (azione === 'rigenera' && miss.anteprima)
        ? miss.anteprima.tappe.map(t => t.id) : [];
      missPreparaAnteprima(evitare);
      break;
    }
    case 'configura':
      miss.anteprima = null;
      // Una missione conclusa e non salvata si archivia qui: chi chiede
      // un'altra missione ha finito con quella, e tenersela in giro
      // farebbe riaprire il pannello sul risultato di ieri.
      if (miss.attiva && miss.attiva.stato === 'conclusa') { miss.attiva = null; missSalvaAttiva(); }
      missMostraVista('configurazione');
      break;
    case 'avvia':
      missAvvia(miss.anteprima);
      break;
    case 'avviaDopo': {
      const quando = missOraConsigliata();
      missAvvia(miss.anteprima, quando || Date.now());
      break;
    }
    case 'guidami':
      missGuidami(miss.attiva ? miss.attiva.corrente : 0);
      break;
    case 'ascolta':
      if (miss.attiva) missRaccontaTappa(miss.attiva.tappe[miss.attiva.corrente], true);
      break;
    case 'trovato':
      missSegnaEsito(miss.attiva.corrente, 'trovato');
      break;
    case 'nonTrovato':
      missSegnaEsito(miss.attiva.corrente, 'nonTrovato');
      break;
    case 'salta':
      missSegnaEsito(miss.attiva.corrente, 'saltato');
      break;
    case 'aiuto':
      missChiediAiuto();
      break;
    case 'sostituisci':
      missSostituisci(miss.attiva.corrente);
      break;
    case 'concludi':
      missConcludi();
      break;
    case 'salvaDiario': {
      const nota = corpo.querySelector('#missione-nota');
      const preferita = corpo.querySelector('#missione-preferita');
      const salvato = missSalvaNelDiario({
        nota: nota ? nota.value.trim() : '',
        stelle: Number(corpo.dataset.stelle || 0),
        preferita: preferita ? (preferita.value || null) : null
      });
      miss.attiva = null;
      missSalvaAttiva();
      missAvvisa(salvato ? 'salvataNelDiario' : 'diarioNonDisponibile', {}, salvato ? 'bene' : 'informa');
      missMostraVista('configurazione');
      break;
    }
    case 'butta':
      missAbbandona();
      break;
  }
}

/* Preparare l'anteprima, e dire perché quando non si può.
 *
 * I tre esiti sono tre, non due: la missione c'è, la missione non c'è
 * perché manca qualcosa (posizione, libreria), oppure la missione non c'è
 * perché **il cielo non offre niente** — che è un'informazione vera e non
 * un guasto, e va detta con altre parole. */
function missPreparaAnteprima(evitare) {
  const partenza = Math.max(Date.now(), missOraConsigliata() || 0);
  const scenario = missScenario(miss.scelte, partenza);
  if (scenario.errore) {
    missAvvisa(scenario.errore, {}, 'informa');
    missMostraVista('vuoto');
    return null;
  }
  scenario.evitare = evitare || [];
  const generata = missGeneraMissione(scenario);
  if (generata.vuota) {
    missMostraVista('vuoto');
    return null;
  }
  if (generata.tappe.length < (MISS_TAPPE_PER_DURATA[miss.scelte.durata] || {}).min) {
    missAvvisa('missioneCorta', {}, 'informa');
  }
  miss.anteprima = generata;
  missMostraVista('anteprima');
  return generata;
}


// =====================================================================
// 9. L'AVVIO E I GANCI
//
//     Tutto quello che questo file mette nel mondo di fuori sta qui, ed
//     è poco di proposito: la scheda di Stasera la disegna
//     `missAggiornaScheda` (che chiama `ui-nuova.js`), la finestra si
//     apre da `missApriPannello`, e la striscia sul cielo si accende da
//     sé quando serve. Niente timer permanenti: a pannello chiuso questo
//     modulo non gira.
// =====================================================================

function missInizializza() {
  missCaricaScelte();
  missCaricaAttiva();

  const chiudi = document.getElementById('btn-chiudi-missione');
  if (chiudi) chiudi.addEventListener('click', () => missChiudiPannello());

  const modale = document.getElementById('modale-missione');
  if (modale) {
    modale.addEventListener('click', e => { if (e.target === modale) missChiudiPannello(); });
  }

  missAggiornaScheda();
  // Chi ricarica la pagina mentre era nel planetario ritrova la striscia:
  // la missione non è finita solo perché la pagina si è riaperta.
  missMostraStrisciaCielo();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', missInizializza, { once: true });
  } else {
    missInizializza();
  }
}

// Le sole funzioni che il resto dell'app chiama per nome.
if (typeof window !== 'undefined') {
  window.missApriPannello = missApriPannello;
  window.missAggiornaScheda = missAggiornaScheda;
  window.missTornaDalPlanetario = missTornaDalPlanetario;
  window.missMostraStrisciaCielo = missMostraStrisciaCielo;
  window.missVoceDiario = missVoceDiario;
}


// =====================================================================
// 10. LE PROVE
//
//     Il motore è fatto di funzioni pure apposta perché si possa
//     provare senza aprire un browser: `scripts/prova-missione.js` legge
//     questo file, gli dà uno scenario finto e guarda che missione ne
//     esce. Si espone un oggetto solo — è la stessa forma che usa
//     `didattica.js` con `window.didProve` — invece di rendere globale
//     mezza dozzina di nomi.
// =====================================================================

const missProve = {
  genera: missGeneraMissione,
  punteggio: missPunteggio,
  ammissibile: missAmmissibile,
  quanteTappe: missQuanteTappe,
  famiglia: missFamigliaDi,
  ordina: missOrdinaPerProgressione,
  inOrario: missMettiInOrario,
  riferimenti: missAttaccaRiferimenti,
  scartoAzimut: missScartoAzimut,
  azimutNelSettore: missAzimutNelSettore,
  strumentoBasta: missStrumentoBasta,
  fasciaAltezza: missFasciaAltezza,
  misuraAMano: missMisuraAMano,
  curiositaChiave: missCuriositaChiave,
  evidenza: missEvidenzaDaMagnitudine,
  difficolta: missDifficolta,
  salvataggioBuono: missSalvataggioBuono,
  daAggiornare: missDaAggiornare,
  conto: missConto,
  campioni: missCampioni,
  costanti: {
    MISS_VERSIONE, MISS_DURATE, MISS_STRUMENTI, MISS_ESPERIENZE, MISS_DIREZIONI,
    MISS_TAPPE_PER_DURATA, MISS_ALTEZZA_MINIMA, MISS_PREAVVISO_MIN,
    MISS_SCADENZA_MS, MISS_TETTO_FAMIGLIA, MISS_LIVELLO_STRUMENTO,
    CHIAVE_MISS_SCELTE, CHIAVE_MISS_ATTIVA
  }
};
if (typeof window !== 'undefined') window.missProve = missProve;
if (typeof module !== 'undefined' && module.exports) module.exports = missProve;
