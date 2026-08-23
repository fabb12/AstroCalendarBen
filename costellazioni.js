// =====================================================================
// LE COSTELLAZIONI: I DISEGNI, I NOMI, IL CIELO DI SOTTO
//
// Il planetario le figure le aveva già: ottantotto spezzate di linee che
// uniscono le stelle. Ma una spezzata non è una costellazione — è la sua
// ossatura. Nessuno, guardando quattro segmenti in croce, ha mai visto un
// cigno; e il salto fra «ecco le stelle» e «ecco il cigno» è tutto il
// motivo per cui le costellazioni esistono da cinquemila anni.
//
// Qui ci sono tre cose, e sono tre risposte a tre domande diverse.
//
//   1. IL DISEGNO. Sopra le linee ci va la figura: il cacciatore, il
//      leone, la nave. Non è un'immagine: sono curve tirate in un sistema
//      di coordinate ancorato a due stelle vere della figura stessa.
//      Perciò il disegno gira col cielo, si stringe con lo zoom e resta
//      incollato alle sue stelle a qualunque ora e da qualunque luogo —
//      cosa che un'immagine appiccicata sopra non farebbe mai.
//
//   2. I NOMI. «Orione» è il nome che gli ha dato una cultura sola.
//      Gli arabi ci vedevano un gigante, i cinesi la settima dimora
//      della Tigre Bianca, gli Yolŋu del Nord Australia una canoa con
//      tre fratelli dentro. Sono le stesse stelle: cambia chi guarda.
//      Questo modulo tiene quei nomi, con il loro significato e con la
//      cultura che li ha detti.
//
//   3. IL CIELO AUSTRALE. Dall'Italia metà della volta celeste non si
//      vede mai: sta sotto l'orizzonte per definizione, non per l'ora.
//      La Croce del Sud, le Nubi di Magellano, Canopo, Omega Centauri
//      non sorgono e non sorgeranno. Il planetario sapeva già guardare
//      da un altro luogo (il pannello «Tempo e luogo»), ma nessuno ci
//      arrivava: qui c'è il tasto che ci porta, e ci porta nella notte
//      giusta e con la figura già centrata.
//
// Ordine di caricamento: dopo app.js e catalogo.js (usa `sky`,
// `skyProietta`, `COSTELLAZIONI_IAU`, `cat.figure`). Tutto quello che
// prende da loro è protetto: senza catalogo.js questo file non fa nulla e
// il planetario resta quello di prima.
//
// Prefisso: `cost`.
// =====================================================================


// =====================================================================
// 1. IL TELAIO DI UNA FIGURA
//
//     Un disegno appoggiato sul cielo ha un problema che un disegno su
//     un foglio non ha: il cielo si muove. Orione sorge coricato, culmina
//     dritto e tramonta rovesciato; ingrandendo diventa dieci volte più
//     grande; da Sydney sta a testa in giù. Un'immagine con delle
//     coordinate fisse sarebbe giusta un minuto all'anno.
//
//     La soluzione è vecchia quanto la cartografia: non si fissano le
//     coordinate del disegno, si fissa il TELAIO. Per ogni figura si
//     scelgono due punti del cielo — due stelle sue, lontane fra loro —
//     e si dichiara che il primo vale (0,0) e il secondo (1,0). Tutto il
//     disegno è scritto in quelle coordinate lì.
//
//     Al momento di disegnare si proiettano le due ancore sullo schermo,
//     e da lì escono un'origine, una direzione e una misura: il disegno
//     ci si appoggia sopra. Se il cielo ruota, ruotano le ancore e ruota
//     con loro; se si ingrandisce, si allontanano e il disegno cresce
//     della stessa quantità. Non c'è niente da aggiornare, perché non
//     c'è niente di assoluto.
//
//     UNA NOTA SULL'ORIENTAMENTO, che è la cosa che si sbaglia. In cielo
//     l'ascensione retta cresce verso EST, cioè verso SINISTRA per chi
//     guarda: la volta celeste la vediamo da dentro, non da fuori come
//     un mappamondo. Rispetto alla carta vista da fuori, quindi, lo
//     schermo è girato di mezzo giro — e mezzo giro è una rotazione, non
//     uno specchio. Per questo la perpendicolare si costruisce con la
//     stessa identica formula in tutti e due i posti, e le figure non
//     escono mai ribaltate. Se un giorno qualcuno cambia `skyProietta` in
//     qualcosa che specchia, questo sarà il primo posto a lamentarsi: si
//     vedranno tutti i disegni riflessi come allo specchio.
// =====================================================================

// Da (ascensione retta in ore, declinazione in gradi) al versore
// equatoriale J2000, la stessa convenzione di catalogo.js.
function costVersore(raOre, dec) {
  const D2R = Math.PI / 180;
  const ra = raOre * 15 * D2R, d = dec * D2R, cd = Math.cos(d);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(d)];
}

// Il versore portato nel cielo di adesso (Est, Nord, Alto), con la stessa
// matrice che catalogo.js usa per le stelle: le due cose devono muoversi
// insieme, o il disegno si stacca dalle sue stelle.
function costAllOra(v, M) {
  const x = v[0], y = v[1], z = v[2];
  return [
    -(M[0][1] * x + M[1][1] * y + M[2][1] * z),
      M[0][0] * x + M[1][0] * y + M[2][0] * z,
      M[0][2] * x + M[1][2] * y + M[2][2] * z
  ];
}


// =====================================================================
// 2. I DISEGNI
//
//     Ogni figura è un pugno di curve scritte nel telaio delle sue due
//     ancore. Le coordinate non sono inventate: sono state ricavate
//     mettendo le stelle vere della figura in quel telaio e disegnandoci
//     sopra — per questo la clava di Orione finisce dove ci sono le
//     stelle della clava, e non dove sarebbe stato comodo.
//
//     `tratti` sono curve morbide (una spline passa per i punti dati),
//     `rette` sono spezzate dritte, `cerchi` sono [x, y, raggio]. Una
//     curva il cui ultimo punto coincide col primo si chiude da sé.
//
//     I numeri sono coppie x,y di fila in un array piatto: scritti come
//     coppie annidate, queste tabelle sarebbero il doppio e si
//     leggerebbero la metà.
// =====================================================================

const COST_ARTE = {

  // --- Boreali e equatoriali ---

  // Il busto passa per le quattro stelle del rettangolo — Bellatrix e
  // Betelgeuse sono le spalle, le due della cintura i fianchi — e le
  // gambe finiscono esattamente su Rigel e su Saiph. Non è una scelta di
  // stile: se il disegno non tocca le stelle, non serve a riconoscerle.
  Ori: {                                    // il cacciatore, con clava e scudo
    ancore: [[5.2423, -8.2016], [6.0653, 20.1385]],   // Rigel → la punta della clava
    cerchi: [[0.618, 0.062, 0.044]],                  // la testa (Meissa)
    tratti: [
      [0.294, -0.030, 0.469, 0.102, 0.582, 0.040, 0.592, -0.103, 0.272, -0.115, 0.294, -0.030],
      [0.294, -0.030, 0.180, 0.006, 0.060, 0.014, 0.000, 0.000],       // gamba su Rigel
      [0.272, -0.115, 0.190, -0.170, 0.110, -0.230, 0.056, -0.269],    // gamba su Saiph
      [0.592, -0.103, 0.640, -0.120, 0.681, -0.127],                   // il braccio della clava
      [0.681, -0.127, 0.780, -0.142, 0.848, -0.137, 0.850, -0.098,
       0.940, -0.030, 1.000, 0.000, 0.972, 0.069],                     // la clava
      [0.469, 0.102, 0.482, 0.230, 0.491, 0.368],                      // il braccio dello scudo
      // Lo scudo (o l'arco: le due letture convivono da duemila anni e
      // nessuna delle due è sbagliata) è l'arco di stelle vero, con una
      // seconda corda dentro
      [0.252, 0.241, 0.260, 0.282, 0.345, 0.342, 0.442, 0.385, 0.596, 0.397, 0.675, 0.360, 0.696, 0.325],
      [0.252, 0.241, 0.360, 0.300, 0.480, 0.332, 0.600, 0.342, 0.696, 0.325]
    ],
    rette: [
      [0.281, -0.072, 0.240, -0.140, 0.210, -0.190]   // la spada, appesa alla cintura
    ]
  },

  UMa: {                                    // l'orsa, col carro sulla schiena
    ancore: [[8.9868, 48.0418], [13.7923, 49.3133]],  // la zampa davanti → Alkaid
    tratti: [
      // Il corpo dell'orsa, chiuso: dal collo lungo il dorso fino
      // all'attacco della coda, e indietro lungo la pancia
      [0.230, 0.130, 0.330, 0.222, 0.450, 0.172, 0.560, 0.112, 0.642, 0.068,
       0.620, -0.020, 0.500, -0.108, 0.390, -0.145, 0.300, -0.120, 0.248, -0.055,
       0.230, 0.130],
      [0.230, 0.130, 0.140, 0.172, 0.060, 0.140, 0.002, 0.062, 0.012, -0.010,
       0.090, -0.030, 0.180, 0.018, 0.235, 0.070, 0.230, 0.130],      // la testa
      [0.160, 0.168, 0.150, 0.212, 0.192, 0.204],     // l'orecchio
      [0.268, -0.090, 0.258, -0.170, 0.246, -0.240],  // zampa davanti
      [0.500, -0.115, 0.480, -0.240, 0.462, -0.355, 0.456, -0.460],  // zampa dietro
      [0.566, -0.070, 0.566, -0.142],
      [0.642, 0.068, 0.760, 0.070, 0.862, 0.078, 0.995, 0.004]       // la coda lunga
    ]
  },

  UMi: {                                    // l'orsetto, con la Polare in cima
    ancore: [[15.3455, 71.834], [2.5303, 89.2641]],   // Pherkad → Polaris
    tratti: [
      // Il corpo dell'orsetto: quattro stelle del mestolo piccolo fanno
      // il tronco, e la coda lunghissima arriva alla Polare
      [0.129, 0.109, 0.250, 0.062, 0.330, -0.028, 0.290, -0.120, 0.180, -0.146,
       0.100, -0.100, 0.096, -0.010, 0.129, 0.109],
      [0.129, 0.109, 0.050, 0.128, -0.014, 0.078, -0.018, 0.006,
       0.048, -0.036, 0.112, -0.006, 0.134, 0.052, 0.129, 0.109],     // la testa
      [0.132, -0.130, 0.122, -0.196, 0.128, -0.240],
      [0.276, -0.136, 0.298, -0.204, 0.310, -0.252],                  // le zampe
      [0.330, -0.028, 0.450, -0.112, 0.572, -0.150, 0.720, -0.140, 0.862, -0.078, 0.996, 0.002]
    ]
  },

  // La regina seduta, con la W come corpo: la testa accanto a Caph, il
  // busto che scende su Schedar, le gambe distese verso Segin. Il primo
  // tentativo la disegnava sotto alla W, su un trono tutto suo, e sembrava
  // che le stelle e il disegno parlassero di due cose diverse.
  Cas: {                                    // la regina sul trono
    ancore: [[0.153, 59.1498], [1.9066, 63.6701]],    // Caph → Segin
    cerchi: [[0.075, 0.058, 0.052]],                  // la testa
    tratti: [
      [0.088, 0.008, 0.150, -0.090, 0.205, -0.200, 0.212, -0.300],     // il busto, giù su Schedar
      [0.150, -0.070, 0.260, -0.030, 0.370, -0.030, 0.450, -0.080],    // il braccio teso
      [0.212, -0.300, 0.350, -0.250, 0.470, -0.150, 0.610, -0.170, 0.700, -0.205],
      [0.700, -0.205, 0.830, -0.150, 0.930, -0.070, 0.996, -0.004],    // le gambe distese
      [0.020, 0.070, -0.040, -0.050, -0.020, -0.200, 0.080, -0.300, 0.190, -0.336],
      [0.190, -0.336, 0.400, -0.330, 0.600, -0.300, 0.716, -0.262]     // il trono
    ],
    rette: [
      [0.230, -0.334, 0.246, -0.440],       // le gambe del trono
      [0.690, -0.272, 0.716, -0.380]
    ]
  },

  // ATTENZIONE alle due ancore: sono le PUNTE DELLE ALI (kappa e zeta),
  // non testa e coda. Il cigno vola di traverso rispetto al telaio: il
  // collo scende verso −y fino ad Albireo, la coda sale verso Deneb. La
  // prima versione l'aveva ruotato di novanta gradi, e veniva fuori un
  // uccello che volava di fianco con le ali al posto del collo.
  Cyg: {                                    // il cigno in volo, ali spalancate
    ancore: [[19.285, 53.3685], [21.2156, 30.2269]],  // kappa → zeta, le due ali
    cerchi: [[0.578, -0.612, 0.036]],                 // la testa (Albireo)
    tratti: [
      [0.545, -0.100, 0.548, -0.293, 0.562, -0.440, 0.574, -0.578],   // il collo lungo
      [0.505, -0.060, 0.560, -0.090, 0.600, -0.020, 0.590, 0.070, 0.540, 0.130,
       0.480, 0.140, 0.450, 0.080, 0.460, 0.000, 0.505, -0.060],       // il corpo
      [0.492, 0.140, 0.482, 0.200, 0.498, 0.252],                      // la coda (Deneb)
      [0.500, -0.060, 0.380, -0.090, 0.283, -0.111, 0.160, -0.080, 0.030, -0.010],
      [0.030, -0.010, 0.140, 0.040, 0.280, 0.030, 0.400, 0.010, 0.482, 0.000],
      [0.600, -0.050, 0.700, -0.080, 0.790, -0.077, 0.900, -0.050, 0.990, -0.005],
      [0.990, -0.005, 0.900, 0.048, 0.790, 0.052, 0.680, 0.032, 0.598, 0.012]
    ],
    rette: [[0.578, -0.650, 0.582, -0.706]]  // il becco
  },

  Leo: {                                    // il leone accovacciato
    ancore: [[9.7642, 23.7743], [11.8177, 14.5721]],  // ε → Denebola
    cerchi: [[1.008, 0.002, 0.028]],                  // il fiocco della coda
    tratti: [
      // Il corpo è una sagoma sola e chiusa — dorso, groppa, pancia,
      // petto — e passa per Zosma e Chort: chiusa si riempie, e un leone
      // pieno si riconosce da lontano meglio di due righe parallele
      [0.270, -0.050, 0.420, 0.020, 0.550, 0.060, 0.663, 0.082, 0.722, 0.044,
       0.700, -0.080, 0.580, -0.120, 0.430, -0.140, 0.290, -0.150, 0.258, -0.104,
       0.270, -0.050],
      [0.663, 0.082, 0.790, 0.055, 0.900, 0.025, 0.985, 0.002],       // la coda
      [0.265, -0.120, 0.262, -0.230, 0.259, -0.331],                  // la zampa davanti, su Regolo
      [0.700, -0.090, 0.714, -0.180, 0.724, -0.262],                  // la zampa dietro (Chort)
      [0.270, -0.050, 0.250, 0.030, 0.180, 0.086, 0.090, 0.100, 0.020, 0.070,
       -0.010, 0.000, 0.020, -0.080, 0.100, -0.130, 0.190, -0.130, 0.250, -0.090,
       0.270, -0.050],                                                // la criniera
      [0.018, 0.014, -0.042, 0.000, -0.066, -0.038]                   // il muso
    ]
  },

  // La V delle Iadi è la faccia, e le due punte della V sono le radici
  // delle corna: quella che va a Elnath e quella che va a zeta. Il muso
  // esce dalla parte opposta, dove il disegno si assottiglia verso il
  // collo e la spalla.
  Tau: {                                    // il toro: testa, corna e spalla
    ancore: [[3.6146, 0.4017], [5.4382, 28.6075]],    // ξ → Elnath
    cerchi: [[0.556, -0.008, 0.022]],                 // l'occhio (Aldebaran)
    tratti: [
      [0.330, 0.080, 0.420, 0.100, 0.500, 0.078, 0.566, 0.062, 0.566, -0.014,
       0.500, -0.024, 0.420, 0.008, 0.340, 0.030, 0.330, 0.080],       // la faccia
      [0.566, 0.062, 0.700, 0.056, 0.850, 0.030, 0.986, 0.002],        // il corno di Elnath
      [0.560, -0.020, 0.680, -0.072, 0.820, -0.142, 0.906, -0.190],    // il corno di zeta
      [0.330, 0.080, 0.250, 0.132, 0.152, 0.198],                      // il collo
      [0.340, 0.030, 0.260, 0.006, 0.180, -0.014],                     // la giogaia
      [0.152, 0.198, 0.060, 0.190, 0.010, 0.130, 0.000, 0.040]         // la spalla
    ]
  },

  Gem: {                                    // i gemelli che si tengono per mano
    ancore: [[6.7548, 12.8956], [7.5766, 31.8883]],   // Alhena → Castore
    cerchi: [[0.995, 0.004, 0.046], [0.912, -0.188, 0.046]],
    tratti: [
      [0.968, 0.026, 0.888, 0.092, 0.813, 0.152],
      [0.813, 0.152, 0.640, 0.212, 0.482, 0.272],
      [0.482, 0.272, 0.382, 0.342, 0.278, 0.412],
      [0.482, 0.272, 0.360, 0.400, 0.242, 0.488],
      [0.856, 0.118, 0.836, 0.238],
      [0.898, -0.148, 0.858, -0.142, 0.818, -0.136],
      [0.818, -0.136, 0.680, -0.128, 0.544, -0.118],
      [0.544, -0.118, 0.472, -0.062, 0.404, -0.008],
      [0.544, -0.118, 0.436, -0.172, 0.324, -0.228],
      [0.842, -0.126, 0.836, -0.020, 0.836, 0.106]    // le braccia unite
    ]
  },

  // L'aquilone di Boote è il corpo: la testa sta su Nekkar, in cima, e la
  // punta in basso — Arturo — è il piede. Il bastone è l'unica cosa
  // inventata, ed è quello che rende la figura un pastore invece di un
  // rombo.
  Boo: {                                    // il bifolco col bastone
    ancore: [[14.2244, 51.7879], [14.6858, 13.7283]],
    cerchi: [[0.318, 0.212, 0.050]],                  // la testa (Nekkar)
    tratti: [
      [0.334, 0.164, 0.400, 0.108, 0.480, 0.052, 0.562, -0.001],       // il busto, giù su Izar
      [0.386, 0.118, 0.450, 0.190, 0.508, 0.239],                      // il braccio verso Seginus
      [0.376, 0.112, 0.368, 0.070, 0.365, 0.027],                      // l'altro, verso delta
      [0.562, -0.001, 0.700, -0.070, 0.831, -0.136],                   // la gamba su Arturo
      [0.831, -0.136, 0.920, -0.084, 0.998, -0.006],                   // il piede
      [0.562, -0.001, 0.640, 0.048, 0.700, 0.020, 0.790, -0.130, 0.844, -0.300]
    ],
    rette: [
      [0.196, 0.300, 0.252, 0.336, 0.296, 0.306, 0.286, 0.262],        // l'uncino del bastone
      [0.286, 0.262, 0.420, -0.020, 0.540, -0.270]
    ]
  },

  Lyr: {                                    // la lira di Orfeo
    ancore: [[18.6156, 38.7837], [18.9824, 32.6896]], // Vega → γ
    tratti: [
      [0.248, 0.068, 0.360, 0.150, 0.474, 0.220, 0.700, 0.126, 0.930, 0.026,
       1.010, -0.010, 0.900, -0.096, 0.785, -0.149, 0.520, -0.056, 0.280, 0.026,
       0.248, 0.068],                                                 // la cassa
      [0.248, 0.068, 0.160, 0.050, 0.070, 0.024, 0.004, 0.002],       // il braccio verso Vega
      [0.474, 0.220, 0.330, 0.240, 0.170, 0.240, 0.040, 0.222]        // l'altro braccio
    ],
    rette: [
      [0.010, 0.008, 0.036, 0.214],         // la traversa
      [0.330, 0.100, 0.842, -0.092],        // le corde
      [0.390, 0.140, 0.902, -0.056],
      [0.448, 0.180, 0.958, -0.024]
    ]
  },

  // Altair è la testa (con Tarazed e Alshain, le due stelline che la
  // affiancano: da qui il nome arabo, «l'aquila in volo» con le ali
  // aperte). Il corpo scende su delta, le ali si aprono verso zeta da una
  // parte e verso theta dall'altra, la coda finisce su lambda.
  Aql: {                                    // l'aquila che scende
    ancore: [[19.0902, 13.8635], [20.1884, -0.8215]],
    cerchi: [[0.531, 0.206, 0.042]],                  // la testa (Altair)
    tratti: [
      [0.505, -0.100, 0.520, 0.050, 0.528, 0.164],                     // il collo
      [0.470, -0.060, 0.530, -0.060, 0.548, -0.180, 0.520, -0.280, 0.468, -0.270,
       0.452, -0.150, 0.470, -0.060],                                  // il corpo
      [0.470, -0.120, 0.350, -0.100, 0.200, -0.060, 0.020, 0.000],
      [0.020, 0.000, 0.180, -0.150, 0.330, -0.200, 0.452, -0.196],     // l'ala su zeta
      [0.548, -0.150, 0.680, -0.130, 0.800, -0.086, 0.990, -0.010],
      [0.990, -0.010, 0.850, -0.190, 0.720, -0.230, 0.560, -0.226],    // l'ala su theta
      [0.520, -0.290, 0.545, -0.450, 0.577, -0.638, 0.618, -0.470, 0.606, -0.316]
    ],
    rette: [[0.516, 0.244, 0.494, 0.290]]   // il becco
  },

  Peg: {                                    // il cavallo alato, a testa in giù
    ancore: [[21.7364, 9.875], [0.1398, 29.0904]],    // Enif → Alpheratz
    tratti: [
      [0.552, -0.062, 0.680, 0.080, 0.860, 0.060, 0.960, -0.080, 0.900, -0.240,
       0.720, -0.282, 0.582, -0.202, 0.552, -0.062],                  // il corpo (il Quadrato)
      [0.520, -0.142, 0.400, -0.152, 0.280, -0.162, 0.160, -0.170, 0.052, -0.142],
      [0.052, -0.142, -0.010, -0.100, -0.030, -0.030, 0.020, 0.010, 0.090, 0.000,
       0.112, -0.060, 0.080, -0.120],                                 // il muso (Enif)
      [0.140, -0.100, 0.220, -0.062, 0.320, -0.060, 0.440, -0.092],   // la criniera
      [0.620, 0.062, 0.580, 0.160, 0.500, 0.240, 0.400, 0.300, 0.282, 0.330],
      [0.282, 0.330, 0.360, 0.222, 0.462, 0.140, 0.560, 0.082],       // l'ala
      [0.562, -0.180, 0.522, -0.300, 0.500, -0.420],
      [0.622, -0.222, 0.602, -0.342, 0.582, -0.460]
    ]
  },

  // Mirfak sta alla vita, il braccio alzato regge la spada (le tre
  // stelline verso Cassiopea), l'altro tiene Algol — che è la testa di
  // Medusa, e il piccolo anello di stelle attorno ad Algol c'era già nei
  // dati: quello lo disegna la figura ufficiale, non noi.
  Per: {                                    // Perseo, con la spada e la testa di Medusa
    ancore: [[1.7277, 50.6887], [3.9022, 31.8836]],
    cerchi: [[0.498, 0.338, 0.048], [0.578, 0.000, 0.044]],
    tratti: [
      [0.498, 0.290, 0.478, 0.272, 0.454, 0.230, 0.442, 0.186],       // collo e busto
      [0.482, 0.294, 0.530, 0.302, 0.570, 0.295],                     // il braccio alzato
      [0.460, 0.244, 0.520, 0.130, 0.568, 0.036],                     // il braccio che regge Medusa
      [0.442, 0.186, 0.400, 0.213, 0.306, 0.123, 0.160, 0.062, 0.020, 0.006],
      [0.442, 0.186, 0.380, 0.246, 0.302, 0.295, 0.230, 0.312],       // le due gambe
      [0.588, -0.040, 0.622, -0.076, 0.646, -0.046],                  // le serpi
      [0.552, -0.040, 0.520, -0.080, 0.548, -0.112]
    ],
    rette: [[0.570, 0.295, 0.606, 0.402, 0.648, 0.442, 0.690, 0.436]] // la spada
  },

  Dra: {                                    // il drago che si avvolge fra le due orse
    ancore: [[11.5234, 69.3311], [17.9434, 51.4889]], // la coda → la testa
    tratti: [
      [0.930, 0.030, 0.840, 0.170, 0.740, 0.300, 0.630, 0.250, 0.640, 0.100,
       0.630, -0.060, 0.620, -0.170, 0.540, -0.240, 0.380, -0.230, 0.220, -0.150,
       0.100, -0.060, 0.000, -0.020],
      [0.950, -0.030, 0.880, 0.110, 0.780, 0.260, 0.690, 0.220, 0.700, 0.100,
       0.690, -0.050, 0.680, -0.150, 0.580, -0.180, 0.420, -0.170, 0.260, -0.090,
       0.140, -0.020, 0.020, 0.030],
      [0.884, 0.048, 0.944, 0.062, 1.022, 0.020, 1.000, -0.052, 0.930, -0.070,
       0.872, -0.030, 0.884, 0.048]                                   // la testa
    ],
    rette: [[1.022, 0.000, 1.074, 0.010, 1.050, 0.034]]               // la lingua
  },

  // --- Australi ---

  Cru: {                                    // la Croce del Sud
    ancore: [[12.4433, -63.0991], [12.5194, -57.1132]],   // Acrux → Gacrux
    // Qui il disegno non aggiunge una figura che non si vede: la Croce
    // si vede benissimo da sé. Aggiunge il fatto che è una croce con un
    // braccio molto più lungo dell'altro, ed è quel braccio lungo — non
    // la croce in sé — che indica il polo sud.
    rette: [
      [-0.030, 0.055, 0.560, 0.055, 0.560, 0.310, 0.716, 0.310, 0.716, 0.055,
        1.040, 0.055, 1.040, -0.055, 0.716, -0.055, 0.716, -0.386, 0.560, -0.386,
        0.560, -0.055, -0.030, -0.055, -0.030, 0.055]
    ]
  },

  // Il corpo di cavallo sta fra la coda (a sinistra) e epsilon, da cui
  // scendono le due zampe davanti che finiscono su Alfa e Beta Centauri —
  // i Puntatori. Da epsilon in poi comincia il busto umano, con Menkent
  // sulla spalla.
  Cen: {                                    // il centauro, con Alfa e Beta come zoccoli
    ancore: [[11.3501, -54.491], [14.986, -42.1042]],
    cerchi: [[0.716, 0.300, 0.048]],
    tratti: [
      [0.150, 0.084, 0.288, 0.096, 0.420, 0.096, 0.520, 0.020, 0.560, -0.050],
      [0.190, -0.006, 0.320, -0.010, 0.440, -0.040, 0.532, -0.070],   // dorso e pancia
      [0.548, -0.062, 0.580, -0.190, 0.626, -0.347],                  // la zampa su Alfa
      [0.516, -0.060, 0.520, -0.170, 0.534, -0.271],                  // e quella su Beta
      [0.196, 0.040, 0.150, -0.010, 0.098, -0.078, 0.047, -0.133],
      [0.212, 0.051, 0.146, 0.060, 0.086, 0.038],                     // le zampe dietro
      [0.150, 0.084, 0.080, 0.062, 0.024, 0.024, 0.002, 0.000],       // la coda
      [0.580, -0.030, 0.660, 0.048, 0.698, 0.172, 0.708, 0.250],      // il busto umano
      [0.706, 0.238, 0.780, 0.268, 0.853, 0.279],
      [0.700, 0.234, 0.664, 0.312, 0.624, 0.371]
    ],
    rette: [[0.600, 0.420, 0.760, 0.290, 0.900, 0.140, 0.996, 0.010]] // la lancia
  },

  Car: {                                    // la carena della nave Argo
    ancore: [[6.6294, -43.1959], [11.21, -60.3176]],
    tratti: [
      [0.050, 0.020, 0.280, 0.058, 0.500, 0.058, 0.700, 0.020, 0.880, -0.020, 0.990, -0.030],
      [0.050, 0.020, 0.140, -0.160, 0.350, -0.238, 0.600, -0.250, 0.800, -0.210,
       0.920, -0.120, 0.990, -0.030],                                 // la chiglia
      [0.050, 0.020, 0.018, 0.100, 0.030, 0.164],                     // la prua
      [0.990, -0.030, 1.030, 0.030, 1.020, 0.090],                    // la poppa
      [0.120, -0.052, 0.360, -0.108, 0.620, -0.118, 0.850, -0.086]    // il fasciame
    ],
    rette: [[0.402, 0.036, 0.379, 0.157]]   // l'albero
  },

  Vel: {                                    // le vele, gonfie di vento
    ancore: [[8.1589, -47.3366], [10.7795, -49.4203]],
    tratti: [
      [0.050, 0.020, 0.200, 0.130, 0.352, 0.238, 0.501, 0.368],       // il pennone
      [0.050, 0.020, 0.100, -0.100, 0.220, -0.190, 0.400, -0.212, 0.550, -0.192, 0.683, -0.165],
      [0.501, 0.368, 0.600, 0.280, 0.680, 0.140, 0.700, -0.020, 0.683, -0.165],
      [0.501, 0.368, 0.680, 0.340, 0.819, 0.306],
      [0.819, 0.306, 0.920, 0.200, 0.995, 0.020],
      [0.700, -0.020, 0.850, 0.050, 0.995, 0.020],
      [0.200, -0.090, 0.320, 0.040, 0.440, 0.180],                    // le pieghe
      [0.360, -0.150, 0.470, -0.010, 0.570, 0.130]
    ]
  },

  Pup: {                                    // la poppa, col castello e il timone
    ancore: [[6.6294, -43.1959], [8.1257, -24.3043]],
    tratti: [
      [0.000, 0.020, 0.200, 0.016, 0.420, 0.034, 0.620, 0.072, 0.800, 0.112, 0.980, 0.104],
      [0.000, 0.020, 0.110, -0.090, 0.320, -0.160, 0.560, -0.170, 0.780, -0.120,
       0.900, -0.030, 0.980, 0.104],                                  // lo scafo
      [0.740, 0.096, 0.760, 0.200, 0.890, 0.216, 0.994, 0.150, 1.000, 0.086],
      [0.420, -0.150, 0.500, -0.270, 0.522, -0.342],                  // il timone
      [0.522, -0.342, 0.430, -0.450, 0.330, -0.546]
    ]
  },

  Sco: {                                    // lo scorpione, dalle chele al pungiglione
    ancore: [[16.0906, -19.8055], [17.622, -42.9978]],
    tratti: [
      // Il torace è una sagoma chiusa (dalla testa fino a dove comincia
      // la coda), la coda resta una linea che si arriccia: riempirla
      // l'avrebbe fatta sembrare un tubo invece di un pungiglione
      [0.050, -0.050, 0.160, -0.030, 0.280, 0.020, 0.400, 0.020, 0.560, -0.010,
       0.560, -0.086, 0.400, -0.070, 0.270, -0.076, 0.150, -0.104, 0.050, -0.050],
      [0.560, -0.010, 0.700, -0.090, 0.800, -0.172, 0.900, -0.110, 0.992, 0.000,
       0.972, 0.108, 0.900, 0.130, 0.848, 0.124],                     // la coda
      [0.080, -0.020, 0.020, 0.040, -0.060, 0.060, -0.020, 0.000, 0.040, -0.030],
      [0.100, -0.080, 0.040, -0.130, -0.020, -0.180, 0.030, -0.192, 0.090, -0.162],
      [0.848, 0.124, 0.792, 0.162, 0.740, 0.152]                      // il pungiglione
    ],
    rette: [
      [0.220, -0.020, 0.204, -0.120],       // le zampe
      [0.320, 0.000, 0.312, -0.104],
      [0.440, 0.000, 0.440, -0.104],
      [0.552, -0.030, 0.560, -0.132]
    ]
  },

  // Del Sagittario si disegna solo l'arco e la freccia. Il centauro
  // l'abbiamo tolto due volte: la prima perché non ci stava nella Teiera,
  // la seconda perché anche il solo arciere riempiva di linee la zona più
  // fitta di tutto il cielo — che è proprio quella verso il centro della
  // Galassia, dove uno guarda per vedere le nubi, non i nostri tratti.
  // La punta della freccia è Alnasl, e punta davvero là.
  Sgr: {                                    // l'arciere, con l'arco già teso
    ancore: [[18.2294, -21.0588], [19.921, -41.8683]],
    tratti: [
      [0.184, -0.012, 0.238, -0.078, 0.260, -0.146, 0.332, -0.198, 0.389, -0.228],
      [0.160, 0.020, 0.196, -0.020],                                  // le due punte dell'arco
      [0.404, -0.256, 0.376, -0.212]
    ],
    rette: [
      [0.184, -0.012, 0.288, -0.126, 0.389, -0.228],  // la corda
      [0.372, -0.030, 0.288, -0.138, 0.204, -0.245],  // la freccia
      [0.204, -0.245, 0.256, -0.238],
      [0.204, -0.245, 0.216, -0.192]
    ]
  },

  Gru: {                                    // la gru, collo teso in volo
    ancore: [[21.8988, -37.3649], [23.0147, -52.7541]],
    tratti: [
      [0.620, 0.090, 0.480, 0.100, 0.320, 0.070, 0.170, 0.044, 0.040, 0.010],
      [0.040, 0.010, -0.020, 0.032, -0.052, 0.000, -0.020, -0.030, 0.032, -0.020],
      [0.620, 0.090, 0.700, 0.140, 0.800, 0.100, 0.860, 0.020, 0.820, -0.060,
       0.720, -0.062, 0.640, 0.018, 0.620, 0.090],                    // il corpo
      [0.860, 0.020, 0.950, 0.040, 1.020, 0.000],                     // la coda
      [0.700, -0.052, 0.600, -0.100, 0.496, -0.152],                  // le zampe
      [0.762, -0.046, 0.700, -0.126, 0.642, -0.200],
      [0.664, 0.104, 0.744, 0.180, 0.844, 0.196]                      // l'ala
    ],
    rette: [[-0.052, 0.000, -0.124, -0.012]]          // il becco
  },

  Pav: {                                    // il pavone con la ruota aperta
    ancore: [[17.7622, -64.7239], [21.4407, -65.3662]],
    cerchi: [[0.800, 0.452, 0.040],
             [0.300, 0.160, 0.020], [0.160, 0.048, 0.020],
             [0.360, -0.132, 0.020], [0.520, 0.100, 0.020]],
    tratti: [
      [0.800, 0.412, 0.800, 0.300, 0.800, 0.180],                     // il collo
      [0.800, 0.164, 0.880, 0.100, 0.900, 0.020, 0.840, -0.050, 0.740, -0.040,
       0.700, 0.040, 0.740, 0.130, 0.800, 0.164],                     // il corpo
      [0.720, 0.060, 0.550, 0.160, 0.350, 0.212, 0.150, 0.212, 0.020, 0.142],
      [0.740, -0.020, 0.620, -0.160, 0.450, -0.232, 0.300, -0.210, 0.180, -0.120],
      [0.020, 0.142, -0.020, 0.060, 0.050, 0.000, 0.120, -0.060, 0.180, -0.120],
      [0.720, 0.040, 0.450, 0.140, 0.140, 0.160],                     // le nervature
      [0.720, 0.020, 0.450, 0.020, 0.100, 0.020],
      [0.730, -0.010, 0.500, -0.120, 0.240, -0.160]
    ],
    rette: [
      [0.800, 0.492, 0.792, 0.548],         // il ciuffo
      [0.780, -0.048, 0.762, -0.124],
      [0.840, -0.048, 0.832, -0.124]
    ]
  },

  Tuc: {                                    // il tucano, tutto becco
    ancore: [[22.3084, -60.2596], [0.5257, -62.9582]],
    cerchi: [[0.930, -0.010, 0.062]],
    tratti: [
      [0.340, -0.120, 0.400, 0.000, 0.550, 0.040, 0.700, 0.000, 0.800, -0.100,
       0.740, -0.200, 0.580, -0.240, 0.440, -0.220, 0.340, -0.120],   // il corpo
      [0.984, 0.030, 1.100, 0.038, 1.160, -0.010, 1.060, -0.056, 0.978, -0.052],
      [0.480, 0.020, 0.440, 0.140, 0.418, 0.262],
      [0.418, 0.262, 0.300, 0.180, 0.160, 0.100, 0.020, 0.020],
      [0.020, 0.020, 0.160, -0.020, 0.320, -0.020, 0.460, 0.000],     // l'ala
      [0.360, -0.100, 0.240, -0.150, 0.120, -0.210, 0.030, -0.246]    // la coda
    ],
    rette: [
      [0.600, -0.226, 0.590, -0.302],
      [0.700, -0.202, 0.700, -0.280]
    ]
  },

  Phe: {                                    // la fenice che rinasce
    ancore: [[0.4381, -42.306], [1.1397, -55.2458]],
    cerchi: [[0.030, 0.000, 0.044]],
    tratti: [
      [0.430, 0.230, 0.520, 0.250, 0.580, 0.190, 0.560, 0.110, 0.480, 0.090,
       0.420, 0.150, 0.430, 0.230],                                   // il corpo
      [0.440, 0.250, 0.300, 0.160, 0.150, 0.070, 0.040, 0.008],       // il collo
      // Le ali sono un tratto solo per parte: il bordo di ritorno le
      // faceva sembrare due foglie appiccicate al corpo
      [0.470, 0.240, 0.452, 0.420, 0.447, 0.638],
      [0.556, 0.196, 0.668, 0.290, 0.785, 0.435],
      [0.560, 0.110, 0.700, 0.062, 0.860, 0.020, 0.996, 0.002],
      [0.510, 0.078, 0.660, 0.010, 0.830, -0.020, 0.996, 0.002],      // la coda
      [0.440, 0.100, 0.330, 0.000, 0.230, -0.140, 0.136, -0.283]      // la zampa
    ],
    rette: [[-0.028, -0.028, -0.092, -0.052]]         // il becco
  },

  Dor: {                                    // il pesce dorato, che porta la Grande Nube
    ancore: [[4.2671, -51.4866], [5.7462, -65.7355]],
    cerchi: [[0.880, 0.030, 0.018]],
    tratti: [
      [0.100, 0.020, 0.320, 0.100, 0.580, 0.130, 0.800, 0.110, 0.950, 0.040,
       0.820, -0.030, 0.600, -0.060, 0.340, -0.060, 0.100, -0.020, 0.100, 0.020],
      [0.100, 0.020, 0.000, 0.100, -0.040, 0.020, -0.020, -0.060, 0.100, -0.020],
      [0.300, 0.090, 0.420, 0.180, 0.600, 0.200, 0.780, 0.150, 0.900, 0.090],
      [0.500, -0.060, 0.520, -0.140, 0.600, -0.100]
    ]
  },

  // Due catene quasi parallele: quella di sopra è il dorso, quella di
  // sotto la pancia. Il muso sta all'estremità dove le due si chiudono, e
  // le zampe escono dalla pancia — non dal dorso, che è l'errore che
  // faceva sembrare il lupo un ragno.
  Lup: {                                    // il lupo, che il centauro porta all'altare
    ancore: [[15.2047, -52.0992], [15.8493, -33.6272]],
    tratti: [
      [0.101, 0.331, 0.280, 0.300, 0.450, 0.200, 0.600, 0.080, 0.720, -0.030,
       0.740, -0.110, 0.588, 0.026, 0.382, 0.068, 0.219, 0.040, 0.120, 0.150,
       0.101, 0.331],
      [0.720, -0.030, 0.800, -0.100, 0.880, -0.130, 0.950, -0.180, 0.890, -0.240,
       0.810, -0.212, 0.760, -0.150, 0.740, -0.110],                  // il muso
      [0.790, -0.086, 0.830, -0.030, 0.868, -0.078],                  // l'orecchio
      [0.101, 0.331, 0.010, 0.350, -0.040, 0.280, -0.006, 0.208]      // la coda
    ],
    rette: [
      [0.220, 0.044, 0.276, -0.086],        // le zampe
      [0.380, 0.064, 0.428, -0.070],
      [0.560, 0.030, 0.606, -0.100]
    ]
  },

  PsA: {                                    // il pesce australe, che beve l'acqua dell'Acquario
    ancore: [[21.7491, -33.0258], [22.9608, -29.6222]],
    cerchi: [[0.880, 0.010, 0.020]],
    tratti: [
      [0.100, 0.060, 0.300, 0.100, 0.550, 0.080, 0.780, 0.040, 0.950, 0.000,
       0.780, -0.100, 0.560, -0.120, 0.320, -0.100, 0.100, -0.040, 0.100, 0.060],
      [0.100, 0.060, 0.000, 0.140, -0.060, 0.060, -0.050, -0.040, 0.020, -0.100, 0.100, -0.040],
      [0.420, 0.090, 0.550, 0.180, 0.720, 0.200, 0.818, 0.130],
      [0.500, -0.110, 0.580, -0.200, 0.720, -0.200, 0.870, -0.150]
    ],
    rette: [[0.950, 0.020, 1.010, 0.000, 0.950, -0.020]]              // la bocca
  },

  Col: {                                    // la colomba, col ramoscello nel becco
    ancore: [[5.5202, -35.4705], [6.3686, -33.4364]],
    cerchi: [[0.030, 0.090, 0.044]],
    tratti: [
      [0.240, 0.020, 0.340, 0.040, 0.460, -0.020, 0.520, -0.120, 0.440, -0.200,
       0.300, -0.180, 0.220, -0.100, 0.240, 0.020],                   // il corpo
      [0.240, 0.000, 0.160, 0.060, 0.078, 0.084],                     // il collo
      [0.340, -0.040, 0.360, -0.240, 0.380, -0.480, 0.389, -0.720],
      [0.389, -0.720, 0.460, -0.500, 0.500, -0.280, 0.480, -0.100],   // l'ala
      [0.500, -0.080, 0.680, -0.040, 0.850, -0.020, 1.000, 0.000],
      [0.500, -0.140, 0.680, -0.100, 0.860, -0.060, 1.000, 0.000]     // la coda
    ],
    rette: [
      [-0.014, 0.080, -0.140, 0.044],       // il ramoscello
      [-0.080, 0.062, -0.100, 0.110],
      [-0.120, 0.052, -0.146, 0.096]
    ]
  }
};


// =====================================================================
// 3. DA CHE COSA NASCE UNA FIGURA
//
//     Le ottantotto costellazioni non sono ottantotto cose dello stesso
//     tipo. Quarantotto vengono dall'Almagesto di Tolomeo e sono storie
//     con tremila anni di anzianità; dodici le hanno inventate dei
//     marinai olandesi che nel 1596 si trovarono sotto un cielo che
//     nessuno in Europa aveva mai visto; quattordici sono strumenti da
//     laboratorio messi in cielo da un astronomo illuminista rimasto due
//     anni al Capo di Buona Speranza.
//
//     Sapere da quale delle tre viene una figura spiega quasi tutto:
//     perché il cielo australe è pieno di uccelli esotici, perché fra le
//     stelle c'è una macchina pneumatica, e perché nessuno riesce a
//     vedere un leone dove c'è scritto Leone Minore.
// =====================================================================

const COST_GRUPPI = {
  tolomeo: {
    titolo: 'Le quarantotto di Tolomeo',
    testo: 'Una delle quarantotto figure elencate da Claudio Tolomeo nell\'Almagesto, ' +
      'intorno al 150 d.C. Tolomeo non le inventò: raccolse un uso greco già antico, ' +
      'che a sua volta veniva dalla Mesopotamia. Alcune di queste figure hanno più di ' +
      'tremila anni, e sono la cosa più vecchia che continuiamo a usare tutti i giorni.'
  },
  olandesi: {
    titolo: 'Il cielo dei navigatori olandesi',
    testo: 'Una delle dodici figure rilevate da Pieter Dirkszoon Keyser e Frederick de ' +
      'Houtman durante il primo viaggio olandese verso le Indie Orientali (1595–1597). ' +
      'Sotto l\'equatore trovarono mezza volta celeste senza un nome: la riempirono con ' +
      'gli animali che avevano visto per strada — il tucano, il pavone, il camaleonte, ' +
      'il pesce volante. Le pubblicò Johann Bayer nell\'Uranometria del 1603.'
  },
  lacaille: {
    titolo: 'Gli strumenti di Lacaille',
    testo: 'Una delle quattordici figure aggiunte da Nicolas-Louis de Lacaille dopo due ' +
      'anni di osservazioni al Capo di Buona Speranza (1751–1752). Dove non c\'era nessun ' +
      'mito da mettere, mise gli strumenti del suo mestiere: il telescopio, l\'orologio, ' +
      'la macchina pneumatica, il bulino dell\'incisore, il microscopio. È l\'Illuminismo, ' +
      'messo in cielo con la faccia seria.'
  },
  argo: {
    titolo: 'I pezzi della Nave Argo',
    testo: 'Un pezzo della Nave Argo, la nave di Giasone e degli Argonauti: la ' +
      'costellazione più grande del cielo antico, così grande che Lacaille la fece a ' +
      'pezzi — la Carena, la Poppa, le Vele e la Bussola. Le lettere greche di Bayer non ' +
      'sono state rifatte, e per questo in Carena c\'è una alfa (Canopo) ma non una beta: ' +
      'quella è finita in Centauro… no, in Poppa. Il cielo porta ancora le cicatrici.'
  },
  hevelius: {
    titolo: 'Le figure di Hevelius',
    testo: 'Una delle figure disegnate da Johannes Hevelius nel suo atlante postumo ' +
      '(1687), per riempire i vuoti fra le costellazioni antiche. Hevelius era un ' +
      'birraio di Danzica e l\'ultimo grande osservatore a occhio nudo: rifiutò il ' +
      'telescopio per misurare le posizioni, e le sue misure restano le migliori mai ' +
      'fatte senza lenti.'
  },
  plancius: {
    titolo: 'Le figure di Plancius',
    testo: 'Una delle figure introdotte dal cartografo e teologo olandese Petrus ' +
      'Plancius fra il 1592 e il 1613, sui globi celesti che preparava per i naviganti.'
  }
};

// Chi sta in quale gruppo. Chi non è in questa tabella è di Tolomeo.
const COST_DI_GRUPPO = {
  olandesi: ['Aps', 'Cha', 'Dor', 'Gru', 'Hyi', 'Ind', 'Mus', 'Pav', 'Phe', 'TrA', 'Tuc', 'Vol'],
  lacaille: ['Ant', 'Cae', 'Cir', 'For', 'Hor', 'Men', 'Mic', 'Nor', 'Oct', 'Pic', 'Pyx', 'Ret', 'Scl', 'Tel'],
  argo:     ['Car', 'Pup', 'Vel'],
  hevelius: ['CVn', 'Lac', 'LMi', 'Lyn', 'Sct', 'Sex', 'Vul'],
  plancius: ['Cam', 'Col', 'Mon']
};

function costGruppoDi(sigla) {
  for (const chiave in COST_DI_GRUPPO) {
    if (COST_DI_GRUPPO[chiave].indexOf(sigla) >= 0) return chiave;
  }
  return 'tolomeo';
}


// =====================================================================
// 4. LO STESSO CIELO, NOMI DIVERSI
//
//     Questa è la parte che vale il modulo intero. Le stelle di Orione
//     sono le stesse per tutti da quando esiste qualcuno che le guarda:
//     cambia soltanto chi le guarda, e cosa si porta dietro. I greci ci
//     hanno visto un cacciatore, gli arabi un gigante, i cinesi la
//     settima dimora della Tigre Bianca d'Occidente, gli Yolŋu del Nord
//     Australia tre fratelli in canoa. Nessuna di queste letture è più
//     giusta delle altre: sono tutte descrizioni esatte della stessa
//     disposizione di puntini.
//
//     Le voci qui sotto sono solo quelle documentate. Dove una tradizione
//     è viva ma varia da nazione a nazione — è il caso di quelle
//     aborigene australiane, che sono centinaia e non una — è scritto a
//     chi appartiene la versione riportata, invece di dire «gli
//     aborigeni» come se fossero un popolo solo.
// =====================================================================

const COST_CULTURE = {
  greca:      { nome: 'Greca e latina',      nota: 'I nomi che usiamo per iscritto, arrivati per il tramite di Tolomeo e dei traduttori latini.' },
  araba:      { nome: 'Araba',               nota: 'Fra il IX e il XIII secolo l\'astronomia si scriveva in arabo: per questo i due terzi delle stelle con un nome proprio hanno un nome arabo, spesso storpiato da chi lo copiava senza capirlo.' },
  cinese:     { nome: 'Cinese',              nota: 'Un cielo diviso in ventotto “dimore lunari” raccolte in quattro grandi animali — il Drago Azzurro a oriente, l\'Uccello Vermiglio a sud, la Tigre Bianca a occidente, la Tartaruga Nera a nord.' },
  indiana:    { nome: 'Indiana',             nota: 'I ventisette nakshatra, le case che la Luna attraversa in un mese.' },
  egizia:     { nome: 'Egizia',              nota: 'Un cielo legato al Nilo e ai suoi tempi: la piena, la semina, la morte e il ritorno.' },
  maori:      { nome: 'Māori (Aotearoa)',    nota: 'In Nuova Zelanda il cielo è la grande canoa di Tama-rereti, e le stelle sono i suoi pezzi: l\'ancora, la prua, la rete.' },
  polinesiana:{ nome: 'Polinesiana e hawaiiana', nota: 'Il cielo con cui si è attraversato il Pacifico senza strumenti: ogni stella è una rotta, e sorgendo indica un\'isola.' },
  aborigena:  { nome: 'Aborigena australiana', nota: 'La tradizione astronomica continua più antica che si conosca. Non è una sola: le nazioni aborigene sono centinaia, e ognuna ha il suo cielo. Qui è sempre indicato di quale si parla.' },
  andina:     { nome: 'Andina (inca, quechua)', nota: 'Nelle Ande si guardano anche — e soprattutto — le macchie scure della Via Lattea: costellazioni fatte di buio, non di stelle.' },
  inuit:      { nome: 'Inuit',               nota: 'Un cielo di pochissime figure ma utilissime, in un posto dove per mesi il Sole non sorge e la stella giusta è l\'unica cosa che dice dove sei.' },
  giapponese: { nome: 'Giapponese',          nota: 'Molto viene dalla Cina, ma con nomi e feste proprie: il Tanabata di luglio è ancora oggi la festa di due stelle.' },
  norrena:    { nome: 'Norrena',             nota: 'Il cielo dei popoli scandinavi prima della cristianizzazione, arrivato a noi in frammenti.' },
  popolare:   { nome: 'Italiana popolare',   nota: 'I nomi che si usavano nei campi, che quasi sempre parlano di lavoro e di stagioni invece che di eroi.' },
  inglese:    { nome: 'Inglese',             nota: 'Gli asterismi che nel mondo anglosassone hanno scalzato il nome ufficiale.' },
  navigatori: { nome: 'Navigatori europei',  nota: 'Quello che vedevano i portoghesi, gli spagnoli e gli olandesi scendendo verso sud fra il Quattrocento e il Seicento.' },
  nativa:     { nome: 'Nativa nordamericana', nota: 'Molte nazioni, molti cieli: qui sono indicati i popoli a cui appartiene ciascuna versione.' }
};

// nome = come la chiamano; senso = cosa vuol dire; nota = perché conta
const COST_NOMI = {

  Ori: {
    racconto: 'Orione è la figura più facile del cielo e la più antica di cui si abbia una ' +
      'testimonianza: una tavoletta d\'avorio di mammut trovata in Germania, vecchia di ' +
      'trentaduemila anni, porta incisa una figura umana con le stesse proporzioni. Che sia ' +
      'davvero lui non si può dimostrare — ma tre stelle uguali e in fila, in mezzo a un ' +
      'rettangolo di stelle luminose, sono la cosa che chiunque nota per prima alzando gli occhi.',
    nomi: [
      { cultura: 'greca', nome: 'Ὠρίων (Oríon)', senso: 'il gigante cacciatore', nota: 'Ucciso dallo scorpione che Gaia gli mandò contro: per questo in cielo i due non compaiono mai insieme — quando lo Scorpione sorge, Orione è già tramontato.' },
      { cultura: 'araba', nome: 'al-Jabbār (الجبار)', senso: 'il gigante' },
      { cultura: 'araba', nome: 'an-Niṭāq (النطاق)', senso: 'la cintura', nota: 'Le tre stelle in fila. Da qui vengono i nomi di due di loro: Alnitak e Mintaka, che vogliono dire tutt\'e due “la cintura”.' },
      { cultura: 'egizia', nome: 'Sah', senso: 'il padre degli dèi', nota: 'L\'anima di Osiride. La sua compagna in cielo è Sopdet (Sirio), l\'anima di Iside: quando Sopdet tornava a vedersi all\'alba, il Nilo cominciava a crescere.' },
      { cultura: 'cinese', nome: '參 (Shēn)', senso: 'le tre', nota: 'La settima dimora della Tigre Bianca d\'Occidente. Shēn e Shāng (Antares) non si vedono mai insieme: in cinese “come Shēn e Shāng” si dice di due persone destinate a non incontrarsi mai.' },
      { cultura: 'aborigena', nome: 'Djulpan (Yolŋu, Terra di Arnhem)', senso: 'la canoa', nota: 'La cintura sono tre fratelli pescatori in canoa; la spada è il pesce che hanno preso, e la Nebulosa di Orione il fuoco a bordo. Furono portati in cielo per aver mangiato un pesce proibito.' },
      { cultura: 'maori', nome: 'Tautoru', senso: 'i tre in fila', nota: 'La cintura di Orione. Il suo sorgere segna una parte dell\'anno agricolo.' },
      { cultura: 'popolare', nome: 'i Tre Re, il Bastone di Giacobbe, il Rastrello', senso: 'la cintura', nota: 'Nelle campagne italiane le tre stelle in fila non erano una cintura, ma un attrezzo o i tre magi.' },
      { cultura: 'navigatori', nome: 'Las Tres Marías', senso: 'le tre Marie', nota: 'In tutto il mondo di lingua spagnola e portoghese la cintura si chiama ancora così.' }
    ],
    stelle: [
      { nome: 'Betelgeuse', senso: 'da Yad al-Jauzā’, “la mano della gigantessa”', nota: 'Storpiato in latino medievale: la ya araba scambiata per una ba. È una supergigante rossa così larga che, messa al posto del Sole, arriverebbe oltre l\'orbita di Marte.' },
      { nome: 'Rigel', senso: 'da Rijl al-Jauzā’, “il piede della gigantessa”' },
      { nome: 'Saiph', senso: 'da Sayf al-Jabbār, “la spada del gigante”' }
    ]
  },

  UMa: {
    racconto: 'Il Grande Carro non è una costellazione: è la parte luminosa dell\'Orsa ' +
      'Maggiore, che è molto più grande. Ma è l\'asterismo più utile del cielo boreale, ' +
      'perché le due stelle in fondo al carro puntano alla Polare, e da lì si trova il ' +
      'nord senza bussola. La cosa curiosa è che l\'orsa la vedono in tanti popoli che non ' +
      'si sono mai parlati — in Grecia, in Siberia e in Nord America — e che tutti le ' +
      'attaccano una coda che nessun orso ha.',
    nomi: [
      { cultura: 'greca', nome: 'Ἄρκτος (Árktos)', senso: 'l\'orsa', nota: 'Callisto, trasformata in orsa da Era e messa in cielo da Zeus. La coda lunga sarebbe il segno di quando la prese per la coda per lanciarla lassù.' },
      { cultura: 'araba', nome: 'ad-Dubb al-Akbar (الدب الأكبر)', senso: 'l\'orsa maggiore' },
      { cultura: 'araba', nome: 'Banāt Naʿsh (بنات نعش)', senso: 'le figlie della bara', nota: 'Il rettangolo del carro era una bara e le tre stelle del timone le piangenti che la seguono. È un corteo funebre, non un carro.' },
      { cultura: 'cinese', nome: '北斗 (Běidǒu)', senso: 'il Mestolo del Nord', nota: 'Il suo manico gira intorno alla Polare come una lancetta: in che direzione punta a inizio notte diceva la stagione.' },
      { cultura: 'indiana', nome: 'सप्तर्षि (Saptarishi)', senso: 'i sette saggi', nota: 'I sette veggenti che compilarono i Veda.' },
      { cultura: 'inglese', nome: 'the Plough / the Big Dipper', senso: 'l\'aratro / il grande mestolo', nota: 'Aratro in Inghilterra, mestolo negli Stati Uniti. Nella fuga degli schiavi verso il nord, “follow the drinking gourd” — segui la zucca da bere — voleva dire seguire questo.' },
      { cultura: 'nativa', nome: 'l\'orsa e i cacciatori (Mi\'kmaq, Irochesi)', senso: 'una caccia lunga un anno', nota: 'Il rettangolo è l\'orsa, le tre stelle del timone i cacciatori che la inseguono. In autunno la raggiungono, e il suo sangue tinge le foglie.' },
      { cultura: 'popolare', nome: 'il Gran Carro', senso: 'il carro grande' }
    ],
    stelle: [
      { nome: 'Mizar e Alcor', senso: 'da Mi’zar, “il perizoma”, e al-Khawwār, “la debole”', nota: 'La coppia che si separa a occhio nudo: era la prova della vista per gli arcieri arabi e per la fanteria romana.' },
      { nome: 'Dubhe', senso: 'da Ẓahr ad-Dubb, “il dorso dell\'orsa”' },
      { nome: 'Alkaid', senso: 'da al-Qā’id, “il capo (delle piangenti)”' }
    ]
  },

  UMi: {
    racconto: 'L\'unica costellazione che tutti sanno usare senza saperla riconoscere: ' +
      'in cima al manico c\'è la Polare, e la Polare sta ferma. Non perché sia speciale — ' +
      'è una supergigante gialla qualunque, la quarantottesima per luminosità — ma perché ' +
      'in questo momento della storia le capita di stare quasi esattamente sull\'asse ' +
      'della Terra. Fra dodicimila anni la stella del nord sarà Vega.',
    nomi: [
      { cultura: 'greca', nome: 'Κυνόσουρα (Kynósoura)', senso: 'la coda del cane', nota: 'I Fenici la usavano per navigare, e i greci la chiamavano anche “Phoinike”, la fenicia: era il loro segreto professionale.' },
      { cultura: 'araba', nome: 'al-Judayy (الجدي)', senso: 'il capretto', nota: 'La Polare. È ancora il nome con cui la conoscono i beduini.' },
      { cultura: 'cinese', nome: '北極 (Běijí)', senso: 'il polo nord celeste', nota: 'Il palazzo dell\'imperatore celeste: tutto il resto del cielo gli gira intorno, e questa era la giustificazione astronomica del potere imperiale.' },
      { cultura: 'inuit', nome: 'Nuutuittuq', senso: 'quella che non si muove mai', nota: 'La Polare. Ad alte latitudini sta quasi allo zenit e serve poco a orientarsi: è più un riferimento di stagione.' },
      { cultura: 'indiana', nome: 'ध्रुव (Dhruva)', senso: 'l\'immobile', nota: 'Il principe bambino che meditò così a lungo da meritare il posto fisso attorno a cui gira tutto.' }
    ]
  },

  Cas: {
    racconto: 'Una W di cinque stelle luminose, dalla parte opposta della Polare rispetto ' +
      'al Grande Carro: quando uno è basso, l\'altra è alta, e insieme fanno da orologio ' +
      'della notte tutto l\'anno. Cassiopea era una regina che si vantò di essere più bella ' +
      'delle Nereidi, e per punizione fu legata al trono e messa a girare intorno al polo: ' +
      'per mezza notte, ogni notte, sta a testa in giù.',
    nomi: [
      { cultura: 'greca', nome: 'Κασσιέπεια', senso: 'la regina d\'Etiopia', nota: 'Madre di Andromeda, moglie di Cefeo: la famiglia al completo sta in cielo, con il mostro Ceto poco più in là.' },
      { cultura: 'araba', nome: 'al-Kaff al-Khaḍīb (الكف الخضيب)', senso: 'la mano tinta di henné', nota: 'Le cinque stelle erano le dita di una mano femminile, tinta per la festa.' },
      { cultura: 'cinese', nome: '王良 (Wáng Liáng)', senso: 'il grande auriga', nota: 'Un famoso conduttore di carri, con accanto 閣道 (Gédào), la strada sopraelevata che porta al palazzo.' },
      { cultura: 'popolare', nome: 'la sedia, la W, la M', senso: 'quello che si vede davvero', nota: 'Il nome dipende dall\'ora: la stessa figura è una W a inizio notte e una M poche ore dopo.' }
    ]
  },

  Cyg: {
    racconto: 'Il Cigno vola lungo la Via Lattea con le ali spalancate, e la sua coda — ' +
      'Deneb — è uno dei tre vertici del Triangolo Estivo. Deneb è la stella più lontana ' +
      'fra quelle davvero luminose del cielo: circa milleseicento anni luce. Che si veda ' +
      'così bene da così lontano vuol dire che emette come duecentomila Soli.',
    nomi: [
      { cultura: 'greca', nome: 'Κύκνος (Kýknos)', senso: 'il cigno', nota: 'Zeus travestito, in una delle sue imprese meno raccomandabili.' },
      { cultura: 'araba', nome: 'ad-Dajājah (الدجاجة)', senso: 'la gallina', nota: 'Da qui Deneb, che è la contrazione di Dhanab ad-Dajājah, “la coda della gallina”.' },
      { cultura: 'cinese', nome: '天津 (Tiānjīn)', senso: 'il guado celeste', nota: 'Il punto in cui si attraversa il Fiume Argenteo (la Via Lattea). Alla festa del Qixi le gazze fanno un ponte proprio qui, perché la Tessitrice (Vega) e il Bovaro (Altair) possano incontrarsi una notte all\'anno.' },
      { cultura: 'popolare', nome: 'la Croce del Nord', senso: 'una croce, e si vede', nota: 'A dicembre, poco dopo il tramonto, la croce sta dritta sull\'orizzonte di nord-ovest.' }
    ]
  },

  Lyr: {
    racconto: 'Quattro stelle deboli in parallelogramma e, di fianco, la quinta stella più ' +
      'luminosa del cielo. Vega è stata la stella polare dodicimila anni fa e lo sarà di ' +
      'nuovo fra dodicimila: la precessione dell\'asse terrestre è un giro lungo ' +
      'ventiseimila anni, e lei sta sull\'orlo di quel giro.',
    nomi: [
      { cultura: 'greca', nome: 'Λύρα', senso: 'la lira di Orfeo', nota: 'Quella con cui commosse perfino il traghettatore dei morti — e con cui fallì, girandosi un attimo troppo presto.' },
      { cultura: 'araba', nome: 'an-Nasr al-Wāqiʿ (النسر الواقع)', senso: 'l\'aquila che si abbassa', nota: 'Da qui “Vega”. L\'aquila che chiude le ali per scendere, contrapposta a quella che vola (Altair).' },
      { cultura: 'cinese', nome: '織女 (Zhīnǚ)', senso: 'la tessitrice', nota: 'La figlia del Re Celeste, separata dal marito bovaro (Altair) dalle due rive del Fiume Argenteo.' },
      { cultura: 'giapponese', nome: 'Orihime (織姫)', senso: 'la principessa tessitrice', nota: 'Il Tanabata, il 7 luglio, è ancora la festa del loro unico incontro dell\'anno: si scrivono i desideri su strisce di carta appese al bambù.' }
    ]
  },

  Aql: {
    racconto: 'L\'aquila di Zeus, che scende lungo la Via Lattea. Altair è una delle stelle ' +
      'vicine (sedici anni luce) e gira su sé stessa in nove ore: così in fretta che è ' +
      'visibilmente schiacciata ai poli — non è una sfera, è un ellissoide.',
    nomi: [
      { cultura: 'araba', nome: 'an-Nasr aṭ-Ṭā’ir (النسر الطائر)', senso: 'l\'aquila in volo', nota: 'Da qui “Altair”. Le due stelline ai suoi lati sono le ali aperte.' },
      { cultura: 'cinese', nome: '牛郎 (Niúláng) / 河鼓 (Hégǔ)', senso: 'il bovaro / il tamburo del fiume', nota: 'Le due stelline accanto ad Altair sono i suoi due figli, che si porta dietro sulle spalle mentre insegue la moglie.' },
      { cultura: 'giapponese', nome: 'Hikoboshi (彦星)', senso: 'la stella del pastore' },
      { cultura: 'polinesiana', nome: 'Humu (Hawai\'i)', senso: '', nota: 'Una delle stelle-guida delle rotte oceaniche.' }
    ]
  },

  Leo: {
    racconto: 'Uno dei rari casi in cui la figura si vede davvero: un leone accovacciato, ' +
      'con la testa fatta da un punto interrogativo rovesciato (la Falce) e la coda a ' +
      'punta. In agosto lo attraversa lo sciame delle Leonidi, che ogni trentatré anni — ' +
      'quando torna la cometa Tempel-Tuttle — smette di essere uno sciame e diventa una ' +
      'tempesta: nel 1833 si contarono centomila meteore all\'ora.',
    nomi: [
      { cultura: 'greca', nome: 'Λέων', senso: 'il leone di Nemea', nota: 'La prima fatica di Eracle: aveva la pelle che nessuna arma scalfiva, e dovette strozzarlo.' },
      { cultura: 'araba', nome: 'al-Asad (الأسد)', senso: 'il leone', nota: 'Per gli arabi preislamici il Leone era enorme e occupava un quarto di cielo, dai Gemelli alla Bilancia.' },
      { cultura: 'cinese', nome: '軒轅 (Xuānyuán)', senso: 'l\'Imperatore Giallo', nota: 'Il progenitore mitico dei cinesi, disteso lungo la falce.' },
      { cultura: 'egizia', nome: 'il leone della piena', senso: '', nota: 'Il Sole entrava nel Leone quando il Nilo cominciava a straripare: per questo le bocche delle fontane egizie, e poi di quelle romane, hanno la forma di una testa di leone.' },
      { cultura: 'inglese', nome: 'the Sickle', senso: 'la falce', nota: 'La testa e la criniera.' }
    ],
    stelle: [
      { nome: 'Regolo', senso: '“il piccolo re”, dal latino; in arabo Qalb al-Asad, “il cuore del leone”', nota: 'Sta a meno di mezzo grado dall\'eclittica: la Luna gli passa davanti regolarmente, e ogni tanto lo copre.' },
      { nome: 'Denebola', senso: 'da Dhanab al-Asad, “la coda del leone”' }
    ]
  },

  Tau: {
    racconto: 'Il Toro si vede solo per metà: testa, corna e spalla, perché il resto è ' +
      'immerso nell\'acqua (è Zeus travestito che rapisce Europa a nuoto). Dentro ci sono ' +
      'i due ammassi aperti più belli del cielo: le Iadi, che fanno la V della faccia, e le ' +
      'Pleiadi, che non fanno parte della faccia e sono la cosa più guardata del cielo dopo ' +
      'la Luna. Aldebaran, l\'occhio rosso, sembra parte delle Iadi ma non lo è: sta a metà ' +
      'strada fra noi e loro, allineato per caso.',
    nomi: [
      { cultura: 'greca', nome: 'Ταῦρος', senso: 'il toro' },
      { cultura: 'araba', nome: 'ath-Thurayyā (الثريا)', senso: 'la piccola abbondante', nota: 'Le Pleiadi. È rimasto un nome proprio femminile diffusissimo in tutto il mondo arabo.' },
      { cultura: 'giapponese', nome: 'Subaru (すばる)', senso: 'l\'unione, il gruppo', nota: 'Le Pleiadi. Sono nel marchio dell\'azienda che porta quel nome: sei stelle, come quelle che si vedono a occhio nudo.' },
      { cultura: 'maori', nome: 'Matariki', senso: 'gli occhi piccoli (o gli occhi del dio)', nota: 'Le Pleiadi. Il loro ritorno all\'alba, a fine giugno, è il capodanno māori: dal 2022 è festa nazionale in Nuova Zelanda.' },
      { cultura: 'aborigena', nome: 'le sette sorelle', senso: '', nota: 'In moltissime nazioni aborigene le Pleiadi sono sorelle inseguite da un uomo (spesso identificato con le stelle di Orione). La stessa storia — sette sorelle e un inseguitore — si ritrova in Grecia, in Siberia e in Nord America: c\'è chi pensa sia il racconto più antico che l\'umanità si tramandi.' },
      { cultura: 'cinese', nome: '昴 (Mǎo) / 畢 (Bì)', senso: 'le Pleiadi / la rete da caccia', nota: 'Le Iadi sono una rete a manico, e la V si presta bene.' },
      { cultura: 'popolare', nome: 'le Gallinelle, le Sette Sorelle', senso: 'le Pleiadi', nota: 'E le Iadi erano “le Piovose”: sorgevano insieme al Sole all\'inizio della stagione delle piogge.' }
    ],
    stelle: [
      { nome: 'Aldebaran', senso: 'da ad-Dabarān, “quello che segue”', nota: 'Segue le Pleiadi attraverso il cielo, e non le raggiunge mai.' },
      { nome: 'Elnath', senso: 'da an-Nāṭiḥ, “l\'incornante”', nota: 'La punta del corno. È condivisa con l\'Auriga, che la usa come piede.' }
    ]
  },

  Gem: {
    racconto: 'Due file parallele di stelle con due teste in cima: Castore e Polluce, i ' +
      'gemelli, uno mortale e uno no. Quando Castore morì, Polluce chiese di dividere con ' +
      'lui la propria immortalità: da allora passano metà del tempo nell\'Ade e metà in ' +
      'cielo. Castore, con il telescopio, si rivela essere sei stelle in tre coppie.',
    nomi: [
      { cultura: 'greca', nome: 'Δίδυμοι', senso: 'i gemelli', nota: 'I Dioscuri, protettori dei naviganti: il fuoco di Sant\'Elmo sugli alberi delle navi era la loro presenza.' },
      { cultura: 'araba', nome: 'at-Taw’amān (التوأمان)', senso: 'i due gemelli' },
      { cultura: 'cinese', nome: '井 (Jǐng)', senso: 'il pozzo', nota: 'Il rettangolo di stelle è la bocca quadrata di un pozzo.' },
      { cultura: 'aborigena', nome: 'due giovani cacciatori (Boorong, Victoria)', senso: '', nota: 'Yurree e Wanjel, che inseguono il canguro Purra: nella loro versione la caccia finisce, e l\'arrosto è il calore d\'estate.' }
    ]
  },

  Boo: {
    racconto: 'Un aquilone di stelle con in fondo Arturo, la stella più luminosa ' +
      'dell\'emisfero nord. Arturo si muove nel cielo più in fretta di quasi ogni altra ' +
      'stella luminosa — due secondi d\'arco all\'anno — perché non appartiene al disco ' +
      'della Galassia: è di passaggio, arriva dall\'alone e sta attraversando il nostro ' +
      'piano. Fra cinquantamila anni non sarà più qui.',
    nomi: [
      { cultura: 'greca', nome: 'Βοώτης (Boótes)', senso: 'il bifolco, il guardiano dei buoi', nota: 'Il nome di Arturo, Arktouros, vuol dire “guardiano dell\'orsa”: sta dietro all\'Orsa Maggiore e la spinge in giro per il polo.' },
      { cultura: 'araba', nome: 'as-Simāk ar-Rāmiḥ (السماك الرامح)', senso: 'il sostegno armato di lancia', nota: 'Arturo. L\'altro “sostegno” è Spica, disarmata.' },
      { cultura: 'cinese', nome: '大角 (Dàjiǎo)', senso: 'il grande corno', nota: 'Arturo: uno dei due corni del Drago Azzurro d\'Oriente.' },
      { cultura: 'inuit', nome: 'Sivulliik', senso: 'i primi', nota: 'Arturo insieme a un\'altra stella: i due che vanno avanti.' }
    ]
  },

  Peg: {
    racconto: 'Il Quadrato di Pegaso è un rettangolo grande quanto una mano aperta a ' +
      'braccio teso, e dentro non c\'è quasi niente: contare quante stelle si vedono ' +
      'dentro al quadrato è il modo classico per misurare a occhio quanto è buio il cielo ' +
      'sopra di noi. Da una città se ne vede una, dalla montagna una trentina. Il cavallo ' +
      'è disegnato per metà e a testa in giù.',
    nomi: [
      { cultura: 'greca', nome: 'Πήγασος', senso: 'il cavallo alato', nota: 'Nato dal sangue di Medusa, che sta lì accanto in mano a Perseo.' },
      { cultura: 'araba', nome: 'al-Faras al-Aʿẓam (الفرس الأعظم)', senso: 'il grande cavallo', nota: 'Da qui i nomi delle stelle del quadrato: Markab, “la sella”; Scheat, “lo stinco”; Algenib, “il fianco”. Alpheratz, l\'ombelico del cavallo, è stata poi assegnata ad Andromeda: le due figure litigavano su quella stella da secoli, e l\'Unione Astronomica Internazionale ha dovuto scegliere.' },
      { cultura: 'cinese', nome: '室 (Shì) e 壁 (Bì)', senso: 'la casa e il muro', nota: 'Le due dimore lunari dell\'autunno.' }
    ]
  },

  Per: {
    racconto: 'Perseo torna con la testa di Medusa in mano, e la testa è Algol: una stella ' +
      'che ogni due giorni e ventun ore si spegne di un terzo per qualche ora e poi torna ' +
      'come prima. È un sistema doppio in cui una stella passa davanti all\'altra. Che il ' +
      'nome arabo voglia dire “il demonio” e l\'ebraico “la testa di Satana” fa pensare che ' +
      'qualcuno se ne fosse accorto molto prima del 1667, quando fu misurata la prima volta.',
    nomi: [
      { cultura: 'greca', nome: 'Περσεύς', senso: 'l\'eroe che uccise Medusa' },
      { cultura: 'araba', nome: 'Ra’s al-Ghūl (رأس الغول)', senso: 'la testa dell\'orco', nota: 'Da qui “Algol”. Il ghūl è il mostro dei deserti che cambia forma — ed è la stessa parola da cui viene il nostro “ghoul”.' },
      { cultura: 'cinese', nome: '大陵五 (Dàlíng wǔ)', senso: 'la quinta della Grande Tomba', nota: 'Anche qui, un posto di morti.' },
      { cultura: 'inglese', nome: 'the Demon Star', senso: 'la stella del demonio' }
    ]
  },

  Dra: {
    racconto: 'Un serpente lungo che si avvolge fra le due Orse. La sua stella Thuban era ' +
      'la stella polare quando furono costruite le piramidi: il corridoio d\'ingresso della ' +
      'piramide di Cheope punta esattamente dove stava Thuban nel 2600 a.C. Non è una ' +
      'coincidenza, ed è la prova più solida che gli egizi orientassero i monumenti sulle ' +
      'stelle.',
    nomi: [
      { cultura: 'greca', nome: 'Δράκων', senso: 'il drago Ladone', nota: 'Guardiano delle mele d\'oro delle Esperidi, ucciso da Eracle — che infatti è qui accanto, con un piede sulla testa del drago.' },
      { cultura: 'araba', nome: 'at-Tinnīn (التنين)', senso: 'il serpente marino' },
      { cultura: 'cinese', nome: '紫微垣 (Zǐwēi Yuán)', senso: 'il recinto del Palazzo Purpureo', nota: 'Le stelle del Dragone fanno il muro di cinta del palazzo imperiale celeste.' },
      { cultura: 'norrena', nome: 'Níðhöggr', senso: 'il serpente che rode la radice del mondo', nota: 'Attribuzione incerta: del cielo norreno restano pochissimi nomi sicuri.' }
    ]
  },

  Cru: {
    racconto: 'Quattro stelle, la costellazione più piccola del cielo, e la più carica di ' +
      'significato dell\'emisfero australe: sta su quattro bandiere nazionali. La barra ' +
      'lunga, prolungata di quattro volte e mezzo, indica il polo sud celeste — che, a ' +
      'differenza del nord, non ha nessuna stella a segnarlo. Dall\'Italia non si vede, ma ' +
      'non è sempre stato così: per la precessione, cinquemila anni fa era visibile dal ' +
      'Mediterraneo, e Dante ne parla nel Purgatorio come delle quattro stelle "non viste ' +
      'mai fuor ch\'alla prima gente".',
    nomi: [
      { cultura: 'navigatori', nome: 'Cruzeiro do Sul / Cruz del Sur', senso: 'la croce del sud', nota: 'I portoghesi la staccarono dal Centauro nel Quattrocento, scendendo lungo l\'Africa: era il segnale che si era passato l\'equatore.' },
      { cultura: 'maori', nome: 'Te Punga', senso: 'l\'ancora', nota: 'L\'ancora della canoa di Tama-rereti, che è tutto il cielo. Un altro nome è Māhutonga.' },
      { cultura: 'aborigena', nome: 'la testa dell\'Emù (Kamilaroi e molte altre nazioni)', senso: '', nota: 'Il Sacco di Carbone — la macchia nera accanto alla croce — è la testa dell\'emù celeste, il cui corpo è la striscia scura della Via Lattea che arriva fino allo Scorpione. Per i Wardaman invece la croce è l\'artiglio di un\'aquila.' },
      { cultura: 'andina', nome: 'Chakana', senso: 'la scala, il ponte', nota: 'La croce andina a gradini, incisa ovunque nelle Ande, è legata a queste stelle: il ponte fra il mondo di sopra e quello di sotto.' },
      { cultura: 'cinese', nome: '十字架 (Shízìjià)', senso: 'la croce', nota: 'Visibile dalle province meridionali della Cina, appena sopra l\'orizzonte.' },
      { cultura: 'polinesiana', nome: 'Newe (Hawai\'i)', senso: 'il triangolo del pesce', nota: 'Nella navigazione polinesiana la sua posizione, sorgendo e tramontando, faceva da bussola nel quadrante sud.' }
    ],
    stelle: [
      { nome: 'Acrux (α Crucis)', senso: 'una contrazione moderna di “alfa” e “Crux”', nota: 'Non ha un nome antico: quando la Croce diventò costellazione, i nomi si erano smesso di darli.' },
      { nome: 'Gacrux (γ Crucis)', senso: 'gamma Crucis', nota: 'La gigante rossa in cima: è la stella rossa più vicina a noi, ottantotto anni luce.' }
    ]
  },

  Cen: {
    racconto: 'Il Centauro è enorme e tiene la Croce del Sud fra le zampe. Le sue due ' +
      'stelle più luminose, alfa e beta, si chiamano “i Puntatori” perché una riga tirata ' +
      'fra loro incrocia la croce e aiuta a distinguerla dalla Falsa Croce. Alfa Centauri è ' +
      'il sistema stellare più vicino al Sole: quattro anni e mezzo luce, tre stelle, e ' +
      'attorno alla più piccola — Proxima — c\'è un pianeta di massa terrestre nella fascia ' +
      'giusta. È il posto più vicino in cui abbia senso guardare.',
    nomi: [
      { cultura: 'greca', nome: 'Κένταυρος', senso: 'il centauro Chirone', nota: 'Il saggio che insegnò a Achille e a Asclepio: ferito per sbaglio da una freccia avvelenata di Eracle, e immortale, rinunciò all\'immortalità per smettere di soffrire.' },
      { cultura: 'araba', nome: 'Rijl Qanṭūris (رجل قنطورس)', senso: 'il piede del centauro', nota: 'Da qui “Rigil Kentaurus”, il nome ufficiale di Alfa Centauri.' },
      { cultura: 'cinese', nome: '南門 (Nánmén)', senso: 'la porta del sud', nota: 'Alfa e beta sono i due battenti di una porta.' },
      { cultura: 'aborigena', nome: 'due fratelli (varie nazioni)', senso: '', nota: 'Alfa e beta Centauri sono spesso due uomini, o due pinne di squalo, o gli occhi di un animale nell\'oscurità.' }
    ],
    stelle: [
      { nome: 'Omega Centauri', senso: 'il più grande ammasso globulare del cielo', nota: 'Dieci milioni di stelle in una palla larga quanto la Luna piena. A occhio nudo sembra una stella sfocata, e infatti fu catalogata come stella — da qui la lettera greca. Probabilmente è il nucleo di una galassia nana che la Via Lattea si è mangiata.' }
    ]
  },

  Car: {
    racconto: 'La carena della nave, e sopra di lei Canopo: la seconda stella più luminosa ' +
      'del cielo dopo Sirio, che dall\'Italia non si vede quasi mai (dalla Sicilia si ' +
      'affaccia di un paio di gradi, in inverno, e ci vuole un orizzonte marino perfetto). ' +
      'Dentro la Carena c\'è Eta Carinae, una stella mostruosa che nel 1843 ebbe una ' +
      'esplosione che la rese la seconda del cielo, e poi si spense: quello che le esplose ' +
      'attorno si vede ancora, ed è la Nebulosa Omuncolo.',
    nomi: [
      { cultura: 'araba', nome: 'Suhayl (سهيل)', senso: 'un nome proprio maschile', nota: 'Canopo. Nella poesia araba è la stella del sud per eccellenza, quella che matura i datteri; “Suhayl” è ancora un nome comune.' },
      { cultura: 'maori', nome: 'Atutahi (o Autahi)', senso: 'quella che sta da sola', nota: 'Canopo. Tama-rereti, nel tessere la sua rete, la lasciò fuori: per questo sta al bordo della Via Lattea, isolata. È la stella che apre l\'anno.' },
      { cultura: 'cinese', nome: '老人星 (Lǎorénxīng)', senso: 'la stella del vecchio', nota: 'Canopo, stella della longevità: vederla sorgere era di ottimo auspicio, e gli imperatori mandavano funzionari a controllare che ci fosse ancora.' },
      { cultura: 'egizia', nome: '', senso: '', nota: 'Canopo dà il nome a una città del delta del Nilo — o forse è il contrario: la questione è aperta da duemila anni.' }
    ]
  },

  Vel: {
    racconto: 'Le vele della nave Argo. Insieme a due stelle della Carena formano la ' +
      '“Falsa Croce”, che è più grande e meno luminosa della vera e ha ingannato ' +
      'generazioni di naviganti: chi ci si orienta sbaglia il sud di parecchi gradi. ' +
      'Il modo per non sbagliare è il Centauro, che punta solo su quella vera.',
    nomi: [
      { cultura: 'greca', nome: 'Argo Navis', senso: 'la nave degli Argonauti', nota: 'La nave che portò Giasone a prendere il vello d\'oro. Era una costellazione sola, e immensa: Lacaille la fece a pezzi nel 1752.' },
      { cultura: 'navigatori', nome: 'la Falsa Croce', senso: '', nota: 'Non è un complimento.' }
    ]
  },

  Pup: {
    racconto: 'La poppa della nave, la parte più a nord del relitto: dall\'Italia meridionale ' +
      'qualcosa se ne affaccia sull\'orizzonte d\'inverno. Le lettere greche delle sue stelle ' +
      'cominciano da zeta, perché alfa, beta, gamma, delta ed epsilon della vecchia Argo ' +
      'sono finite negli altri pezzi.',
    nomi: [
      { cultura: 'greca', nome: 'Argo Navis', senso: 'la nave degli Argonauti' }
    ]
  },

  Sco: {
    racconto: 'Una delle pochissime figure che somigliano davvero a quello che dicono di ' +
      'essere: c\'è la testa, ci sono le chele, e c\'è la coda che si arriccia con il ' +
      'pungiglione in punta. Al centro Antares, una supergigante rossa il cui nome vuol ' +
      'dire “rivale di Marte” — perché è dello stesso colore, e quando Marte le passa ' +
      'accanto si fa fatica a dire quale sia quale.',
    nomi: [
      { cultura: 'greca', nome: 'Σκορπίος', senso: 'lo scorpione', nota: 'Quello mandato a uccidere Orione. In cielo sono tenuti alle due estremità opposte, e non si incontrano mai.' },
      { cultura: 'araba', nome: 'al-ʿAqrab (العقرب)', senso: 'lo scorpione', nota: 'Antares è Qalb al-ʿAqrab, “il cuore dello scorpione”: da lì il latino Cor Scorpii.' },
      { cultura: 'cinese', nome: '心 (Xīn)', senso: 'il cuore', nota: 'La dimora del cuore del Drago Azzurro d\'Oriente. Antares è 心宿二, e il suo apparire segnava l\'inizio dell\'estate.' },
      { cultura: 'maori', nome: 'Te Matau a Māui', senso: 'l\'amo di Māui', nota: 'La coda arricciata è l\'amo con cui il semidio Māui pescò dal fondo del mare l\'Isola del Nord della Nuova Zelanda. La stessa figura, con lo stesso significato, si ritrova alle Hawai\'i (Ka Makau Nui o Māui).' },
      { cultura: 'polinesiana', nome: 'Manaiakalani (Hawai\'i)', senso: 'l\'amo del capo', nota: '' },
      { cultura: 'aborigena', nome: 'la coda dell\'Emù (Kamilaroi)', senso: '', nota: 'La grande macchia scura vicino ad Antares è il corpo dell\'emù celeste, che comincia col Sacco di Carbone nella Croce del Sud.' }
    ],
    stelle: [
      { nome: 'Antares', senso: 'dal greco “rivale di Ares”, cioè di Marte' },
      { nome: 'Shaula', senso: 'da ash-Shawlā’, “il pungiglione alzato”' }
    ]
  },

  Sgr: {
    racconto: 'Il Sagittario punta la freccia verso lo Scorpione, e la punta della freccia ' +
      'indica il centro della Via Lattea: proprio lì, a ventisettemila anni luce, c\'è il ' +
      'buco nero da quattro milioni di masse solari attorno a cui gira tutta la Galassia. ' +
      'Guardare in questa direzione vuol dire guardare verso casa dal bordo. Nel mondo ' +
      'anglosassone l\'arciere nessuno lo vede: si vede una teiera, con tanto di manico, ' +
      'beccuccio e vapore (la Via Lattea che esce).',
    nomi: [
      { cultura: 'greca', nome: 'Τοξότης', senso: 'l\'arciere', nota: 'Di solito identificato con Crotone, o con un centauro che non è Chirone — Chirone è il Centauro, qui accanto.' },
      { cultura: 'araba', nome: 'al-Qaws (القوس)', senso: 'l\'arco' },
      { cultura: 'cinese', nome: '斗 (Dǒu) e 箕 (Jī)', senso: 'il mestolo e il vaglio', nota: 'Il Mestolo del Sud, da non confondere col Mestolo del Nord (l\'Orsa Maggiore).' },
      { cultura: 'inglese', nome: 'the Teapot', senso: 'la teiera', nota: 'Una volta vista non si torna indietro.' }
    ]
  },

  Gru: {
    racconto: 'Un uccello dal collo lungo che vola verso sud, disegnato dai navigatori ' +
      'olandesi. Alcune delle sue stelle, prima, erano la coda del Pesce Australe: gli ' +
      'astronomi arabi le contavano lì.',
    nomi: [
      { cultura: 'navigatori', nome: 'Grus', senso: 'la gru', nota: 'In Inghilterra per un po\' si provò a chiamarla Phoenicopterus, il fenicottero. Non attaccò.' }
    ]
  },

  Pav: {
    racconto: 'Il pavone, uno degli uccelli esotici del cielo olandese. La sua stella ' +
      'principale è una delle cinquantasette “stelle di navigazione” usate per il punto ' +
      'astronomico: la battezzarono “Peacock” gli inglesi negli anni Trenta del Novecento, ' +
      'perché per le tavole nautiche della RAF serviva un nome pronunciabile e lei non ' +
      'ne aveva nessuno.',
    nomi: [
      { cultura: 'navigatori', nome: 'Pavo', senso: 'il pavone', nota: 'Nella mitologia greca il pavone era l\'uccello di Era, con gli occhi di Argo sulla coda: Keyser e de Houtman probabilmente pensavano al pavone verde di Giava, che avevano appena visto.' }
    ]
  },

  Tuc: {
    racconto: 'Il tucano, e dentro di lui due gioielli: la Piccola Nube di Magellano — una ' +
      'galassia satellite a duecentomila anni luce — e 47 Tucanae, il secondo ammasso ' +
      'globulare del cielo per bellezza, che a occhio nudo sembra una stella sfocata ' +
      'accanto alla Nube ma è cinquecento volte più lontano.',
    nomi: [
      { cultura: 'navigatori', nome: 'Toucan', senso: 'il tucano', nota: 'Il primo uccello del Nuovo Mondo a diventare una costellazione.' },
      { cultura: 'araba', nome: 'al-Baqar (البقر)', senso: 'il bue bianco', nota: 'Con questo nome ʿAbd al-Raḥmān al-Ṣūfī, nel X secolo, descriveva la Grande Nube di Magellano — visibile dallo Yemen. In Europa nessuno la conosceva fino a Magellano, ma nel mondo arabo era in catalogo da seicento anni.' }
    ]
  },

  Phe: {
    racconto: 'L\'uccello che rinasce dalle proprie ceneri, messo in cielo dai navigatori ' +
      'olandesi. Le sue stelle, per gli astronomi arabi, facevano parte di una barca.',
    nomi: [
      { cultura: 'navigatori', nome: 'Phoenix', senso: 'la fenice' },
      { cultura: 'cinese', nome: '火鳥 (Huǒniǎo)', senso: 'l\'uccello di fuoco', nota: 'Nome moderno, tradotto dall\'occidentale.' }
    ]
  },

  Dor: {
    racconto: 'Il pesce dorato — che non è il pesce rosso da acquario ma la lampuga, il ' +
      'pesce che i marinai vedevano inseguire i pesci volanti. Dentro c\'è la Grande Nube ' +
      'di Magellano, una galassia intera a centosessantamila anni luce: a occhio nudo è una ' +
      'nuvola staccata dalla Via Lattea che non si sposta mai. Lì dentro, nel 1987, esplose ' +
      'la supernova più vicina degli ultimi quattro secoli.',
    nomi: [
      { cultura: 'navigatori', nome: 'Dorado', senso: 'la lampuga' },
      { cultura: 'aborigena', nome: 'i fuochi degli anziani (varie nazioni)', senso: '', nota: 'Le due Nubi di Magellano sono spesso i fuochi da campo di una vecchia coppia, o due accampamenti.' },
      { cultura: 'navigatori', nome: 'Nubi del Capo', senso: '', nota: 'I portoghesi le chiamavano così molto prima del viaggio di Magellano: “o Cabo” era il Capo di Buona Speranza.' }
    ]
  },

  Lup: {
    racconto: 'Il lupo che il Centauro porta all\'Altare, per il sacrificio. Per i greci ' +
      'era una bestia generica — “Θηρίον”, la fiera — e sono i latini ad averne fatto un ' +
      'lupo. È una zona ricchissima di stelle azzurre giovani: fa parte dell\'associazione ' +
      'Scorpione-Centauro, il gruppo di stelle appena nate più vicino a noi.',
    nomi: [
      { cultura: 'greca', nome: 'Θηρίον (Therion)', senso: 'la fiera' },
      { cultura: 'araba', nome: 'as-Sabuʿ (السبع)', senso: 'la belva' }
    ]
  },

  PsA: {
    racconto: 'Il pesce che beve l\'acqua che l\'Acquario versa: nelle carte antiche sta ' +
      'a bocca aperta sotto la brocca. La sua unica stella luminosa, Fomalhaut, è ' +
      'circondata da un anello di polvere fotografato dal telescopio Hubble — uno dei ' +
      'primi dischi di detriti mai visti attorno a un\'altra stella.',
    nomi: [
      { cultura: 'araba', nome: 'Fam al-Ḥūt (فم الحوت)', senso: 'la bocca del pesce', nota: 'Da qui “Fomalhaut”. È esattamente il punto in cui l\'acqua entra.' },
      { cultura: 'popolare', nome: 'la Stella Solitaria d\'autunno', senso: '', nota: 'In autunno, guardando a sud, è l\'unica stella luminosa in un pezzo di cielo altrimenti vuoto: non si può sbagliare.' },
      { cultura: 'cinese', nome: '北落師門 (Běiluòshīmén)', senso: 'la porta della guarnigione del nord' }
    ]
  },

  Col: {
    racconto: 'La colomba di Noè, che torna con il ramoscello d\'ulivo — messa in cielo ' +
      'accanto alla nave Argo, che nell\'interpretazione cristiana del cielo era l\'arca. ' +
      'La sua stella Phact è il nome arabo del piccione.',
    nomi: [
      { cultura: 'navigatori', nome: 'Columba Noachi', senso: 'la colomba di Noè' },
      { cultura: 'araba', nome: 'al-Fākhitah (الفاختة)', senso: 'la tortora', nota: 'Da qui “Phact”.' }
    ]
  }
};

// Le costellazioni fatte di buio: non stelle, ma le macchie scure della
// Via Lattea. Sono la cosa che più spiazza chi ha imparato il cielo in
// Europa — eppure sono il modo di guardare più diffuso nell'emisfero sud,
// dove la Via Lattea è molto più densa e le sue nubi di polvere si
// stagliano davvero.
const COST_BUIO = [
  {
    id: 'emu',
    nome: 'L\'Emù nel cielo',
    cultura: 'aborigena',
    dove: 'Dal Sacco di Carbone (nella Croce del Sud) lungo la Via Lattea fino allo Scorpione',
    quando: 'Da aprile a giugno sta alto e disteso: è il momento in cui gli emù depongono le uova',
    testo: 'Non si guardano le stelle: si guarda il buio fra le stelle. La testa è il Sacco ' +
      'di Carbone, la macchia nera accanto alla Croce del Sud; il collo e il corpo sono le ' +
      'strisce di polvere che corrono lungo il Centauro fino allo Scorpione. È un animale ' +
      'lungo un quarto di cielo. Per i Kamilaroi si chiama Gawarrgay, e la sua posizione ' +
      'nel corso dell\'anno dice quando gli emù fanno il nido, quando ci sono le uova e ' +
      'quando si può raccoglierle: è un calendario, non un disegno. Ne esiste un\'incisione ' +
      'su roccia a Kuring-gai, vicino a Sydney, orientata in modo da combaciare con la ' +
      'figura in cielo nel mese giusto.',
    centro: { ra: 13.5, dec: -55 }
  },
  {
    id: 'yacana',
    nome: 'Yacana, la lama',
    cultura: 'andina',
    dove: 'Le nubi scure fra la Croce del Sud e lo Scorpione; gli occhi sono Alfa e Beta Centauri',
    quando: 'Culmina a mezzanotte fra aprile e maggio',
    testo: 'Nella tradizione andina la Via Lattea è un fiume, e nelle sue macchie scure ' +
      'vivono gli animali: Yacana la lama con il suo puledro, Atoq la volpe, Mach\'acuay il ' +
      'serpente, Yutu la pernice (il Sacco di Carbone), Hanp\'atu il rospo. Alfa e Beta ' +
      'Centauri — che per noi sono i Puntatori — sono gli occhi della lama. Si racconta che ' +
      'a mezzanotte Yacana scenda a bere l\'acqua del mare, e che se non lo facesse il mondo ' +
      'sarebbe sommerso.',
    centro: { ra: 14.0, dec: -58 }
  },
  {
    id: 'sacco',
    nome: 'Il Sacco di Carbone',
    cultura: 'navigatori',
    dove: 'Accanto ad Acrux, nella Croce del Sud',
    quando: 'Con la Croce del Sud, tutto l\'anno dall\'emisfero australe',
    testo: 'È una nube di polvere a seicento anni luce che copre le stelle dietro di sé: ' +
      'la nebulosa oscura più evidente del cielo, larga come sette Lune piene. I navigatori ' +
      'europei del Cinquecento la chiamarono così perché sembra un buco nella Via Lattea. ' +
      'Per gli Inca è Yutu, la pernice; per molte nazioni aborigene australiane è la testa ' +
      'dell\'Emù. È una delle poche cose del cielo che si vede meglio quanto più il cielo ' +
      'attorno è luminoso.',
    centro: { ra: 12.87, dec: -63.0 }
  }
];


// =====================================================================
// 5. IL DISEGNO SUL CIELO
//
//     Le figure di catalogo.js sono già lì e non si toccano: il disegno
//     è uno strato in più, sopra le linee e sotto tutto il resto. Va
//     tenuto leggero — è un velo, non un'illustrazione — perché il punto
//     non è guardare il disegno, è riconoscere le stelle grazie a lui e
//     poi dimenticarsene.
// =====================================================================

const cost = {
  arte: false,            // i disegni si accendono solo quando vengono richiesti
  quando: 0,              // per quale aggiornamento del catalogo sono buoni i telai
  telai: null,            // sigla → { a, b, c } versori delle ancore nel cielo di adesso
  terze: null,            // sigla → la terza ancora scelta da sé, con le sue coordinate nel telaio
  sigle: null,            // l'elenco delle figure che hanno un disegno (curve o immagine)
  ancoreAuto: null,       // sigla → le due ancore scelte da sé, per chi ha solo l'immagine
  immagini: {},           // sigla → { stato, tela, larghezza, altezza } (§5-bis)
  piani: null,            // sigla → la carta locale della figura (piano tangente, andata e ritorno)
  riquadri: null,         // sigla → il rettangolo delle stelle su quella carta, per le immagini
  centri: null,           // sigla → { ra, dec } del baricentro della figura
  scelta: null,           // la sigla aperta nell'atlante
  filtro: 'tutte',
  cerca: '',
  atlante: false,
  distanze: 'niente',     // 'niente' | 'in-corso' | 'pronto' | 'fallito'
  promessaDistanze: null
};

// Quanto si vede il disegno. A campo largo è appena accennato (a 180°
// ci sono ottantotto figure in croce e riempirle di tratti sarebbe una
// ragnatela), al campo di un binocolo è al suo massimo, ingrandendo
// ancora sparisce da sé: a due gradi di campo si sta guardando una
// stella, non una figura.
function costOpacitaArte() {
  const fov = sky.fov || 55;
  if (fov > 140) return 0.20;
  if (fov > 60) return 0.20 + (140 - fov) * 0.0028;   // fino a 0,42
  if (fov > 12) return 0.42;
  if (fov > 4) return 0.42 * (fov - 4) / 8;
  return 0;
}

// --- LA TERZA ANCORA ---
//
// Con due ancore il disegno può ruotare e cambiare misura, ma non
// deformarsi: la trasformazione è una similitudine, e tiene per forza gli
// angoli. Con TRE il telaio diventa affine — può anche stirarsi e
// inclinarsi — e questo conta, perché la proiezione del cielo su uno
// schermo piatto una figura larga venti gradi la stira davvero, tanto più
// quanto più sta lontano dal centro della vista. Con due sole ancore, a
// campo largo, il disegno restava rigido mentre le sue stelle si
// allargavano sotto di lui.
//
// È anche quello che fa Stellarium con le sue illustrazioni: tre punti
// dell'immagine, tre stelle, e l'immagine ci si adatta sopra.
//
// Il piano tangente al baricentro della figura, con dentro i suoi vertici.
// È la carta locale su cui poggia tutto il resto: le curve ci sono state
// autorate sopra, le immagini ci si appoggiano, la scheda dell'atlante la
// disegna. `piano(ra, dec)` dà [est, nord] in unità di tangente.
function costPianoFigura(sigla) {
  if (!cost.piani) cost.piani = {};
  if (sigla in cost.piani) return cost.piani[sigla];

  const pezzi = (typeof COSTELLAZIONI_IAU === 'undefined' ? [] : COSTELLAZIONI_IAU)
    .filter(c => c.sigla === sigla);
  if (!pezzi.length) { cost.piani[sigla] = null; return null; }

  const punti = [];
  pezzi.forEach(c => c.spezzate.forEach(l => l.forEach(p => punti.push(p))));

  let cx = 0, cy = 0, cz = 0;
  punti.forEach(p => { const v = costVersore(p[0], p[1]); cx += v[0]; cy += v[1]; cz += v[2]; });
  const norma = Math.hypot(cx, cy, cz) || 1;
  cx /= norma; cy /= norma; cz /= norma;
  const dec0 = Math.asin(Math.max(-1, Math.min(1, cz))), ra0 = Math.atan2(cy, cx);
  const D2R = Math.PI / 180;

  const piano = (raOre, dec) => {
    const a = raOre * 15 * D2R, d = dec * D2R;
    const cosc = Math.sin(dec0) * Math.sin(d) + Math.cos(dec0) * Math.cos(d) * Math.cos(a - ra0);
    if (cosc <= 0.05) return null;
    return [Math.cos(d) * Math.sin(a - ra0) / cosc,
      (Math.cos(dec0) * Math.sin(d) - Math.sin(dec0) * Math.cos(d) * Math.cos(a - ra0)) / cosc];
  };

  // La strada di ritorno: da un punto della carta alla stella che ci sta.
  // Serve alle immagini (§5-bis), che dichiarano i loro angoli sulla carta
  // e hanno bisogno di sapere che pezzo di cielo sono.
  const cielo = (est, nord) => {
    const rho = Math.hypot(est, nord);
    if (rho < 1e-12) return [((ra0 / D2R / 15) + 24) % 24, dec0 / D2R];
    const c = Math.atan(rho), sc = Math.sin(c), cc = Math.cos(c);
    const dec = Math.asin(cc * Math.sin(dec0) + nord * sc * Math.cos(dec0) / rho);
    const ra = ra0 + Math.atan2(est * sc,
      rho * Math.cos(dec0) * cc - nord * Math.sin(dec0) * sc);
    return [(((ra / D2R / 15) % 24) + 24) % 24, dec / D2R];
  };

  const fatto = { ra0: ((ra0 / D2R / 15) + 24) % 24, dec0: dec0 / D2R, punti, piano, cielo };
  cost.piani[sigla] = fatto;
  return fatto;
}

// I vertici della figura, scritti nel telaio delle sue ancore: la prima
// ancora vale (0,0), la seconda (1,0). È la stessa proiezione con cui i
// disegni della §2 sono stati autorati, per questo i numeri che escono di
// qui si possono dare in pasto a `costPunto()` senza altre conversioni.
function costPuntiNelTelaio(sigla, ancore) {
  const carta = costPianoFigura(sigla);
  if (!carta || !ancore) return null;
  const { punti, piano } = carta;

  const A = piano(ancore[0][0], ancore[0][1]), B = piano(ancore[1][0], ancore[1][1]);
  if (!A || !B) return null;
  const dx = B[0] - A[0], dy = B[1] - A[1], len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return null;

  const fuori = [];
  punti.forEach(p => {
    const q = piano(p[0], p[1]);
    if (!q) return;
    const ux = q[0] - A[0], uy = q[1] - A[1];
    fuori.push({
      ra: p[0], dec: p[1],
      x: (ux * dx + uy * dy) / len2,
      y: (ux * -dy + uy * dx) / len2
    });
  });
  return fuori.length ? fuori : null;
}

// La terza ancora non sta scritta nei dati: si sceglie da sé, ed è la
// stella della figura più lontana dalla retta fra le prime due — quella
// che dà il telaio più stabile. Le sue coordinate nel telaio si ricavano
// dalla stessa geometria con cui il disegno è stato scritto.
function costTerzaAncora(sigla, ancore) {
  const punti = costPuntiNelTelaio(sigla, ancore);
  if (!punti) return null;

  let scelto = null;
  punti.forEach(p => {
    if (!scelto || Math.abs(p.y) > Math.abs(scelto.y)) scelto = p;
  });
  // Una stella troppo vicina alla retta delle prime due non fa da terza
  // ancora: dividendo per la sua `y` si moltiplicherebbe il rumore
  return scelto && Math.abs(scelto.y) > 0.08 ? scelto : null;
}

// Le due ancore di una figura. Se ha un disegno a curve sono quelle
// scritte in `COST_ARTE`, e restano quelle: i numeri delle curve sono
// scritti in quel telaio lì e cambiarlo vorrebbe dire riscriverle tutte.
//
// Se invece la figura ha solo un'immagine (§5-bis) le ancore non le ha
// dichiarate nessuno, e si scelgono da sé: le due stelle più lontane fra
// loro della figura. È la coppia che dà il telaio più lungo, cioè quella
// su cui mezzo pixel di errore pesa meno — ed è deterministica, quindi il
// disegno non balla da una sessione all'altra.
function costAncoreDi(sigla) {
  if (COST_ARTE[sigla]) return COST_ARTE[sigla].ancore;
  if (!cost.ancoreAuto) cost.ancoreAuto = {};
  if (sigla in cost.ancoreAuto) return cost.ancoreAuto[sigla];

  let scelte = null;
  const pezzi = (typeof COSTELLAZIONI_IAU === 'undefined' ? [] : COSTELLAZIONI_IAU)
    .filter(c => c.sigla === sigla);
  const punti = [];
  pezzi.forEach(c => c.spezzate.forEach(l => l.forEach(p => punti.push(p))));
  if (punti.length >= 2) {
    const versori = punti.map(p => costVersore(p[0], p[1]));
    let peggiore = 2;   // il coseno più piccolo, cioè l'angolo più grande
    for (let i = 0; i < punti.length; i++) {
      for (let j = i + 1; j < punti.length; j++) {
        const a = versori[i], b = versori[j];
        const cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        if (cos < peggiore) { peggiore = cos; scelte = [punti[i], punti[j]]; }
      }
    }
  }
  cost.ancoreAuto[sigla] = scelte;
  return scelte;
}

// Tutte le sigle che qualcosa da disegnare ce l'hanno: le curve, le
// immagini, o tutt'e due. È l'elenco su cui girano i telai e il disegno.
function costSigleArte() {
  if (cost.sigle) return cost.sigle;
  const viste = new Set(Object.keys(COST_ARTE));
  for (const sigla in COST_IMMAGINI) viste.add(sigla);
  cost.sigle = Array.from(viste).filter(s => costAncoreDi(s));
  return cost.sigle;
}

// I telai si rifanno quando il catalogo rifà le posizioni delle stelle,
// e per la stessa ragione: se le due cose si aggiornassero in momenti
// diversi il disegno si staccherebbe dalle sue stelle di qualche pixel a
// ogni fotogramma, e si vedrebbe tremare.
function costSincronizza() {
  if (!catPronto() || !cat.matrice) return false;
  if (cost.telai && cost.quando === cat.quandoAggiornato) return true;

  const M = cat.matrice;
  const sigle = costSigleArte();
  // Le terze ancore non cambiano mai (dipendono solo dal catalogo delle
  // figure): si scelgono una volta e si tengono
  if (!cost.terze) {
    cost.terze = {};
    sigle.forEach(sigla => {
      cost.terze[sigla] = costTerzaAncora(sigla, costAncoreDi(sigla));
    });
  }

  cost.telai = {};
  for (const sigla of sigle) {
    const anc = costAncoreDi(sigla);
    const terza = cost.terze[sigla];
    cost.telai[sigla] = {
      a: costAllOra(costVersore(anc[0][0], anc[0][1]), M),
      b: costAllOra(costVersore(anc[1][0], anc[1][1]), M),
      c: terza ? costAllOra(costVersore(terza.ra, terza.dec), M) : null,
      cx: terza ? terza.x : 0,
      cy: terza ? terza.y : 0
    };
  }
  cost.quando = cat.quandoAggiornato;
  return true;
}

// Il telaio sullo schermo: origine, asse x (dall'ancora A alla B) e asse
// y perpendicolare. Vedi il commento lungo della sezione 1 per il perché
// la perpendicolare si costruisce proprio così.
function costTelaioSchermo(sigla, base, focale) {
  const t = cost.telai && cost.telai[sigla];
  if (!t) return null;
  const A = skyProietta(t.a, base, focale);
  if (!A.davanti) return null;
  const B = skyProietta(t.b, base, focale);
  if (!B.davanti) return null;
  const dx = B.px - A.px, dy = B.py - A.py;
  const lungo = Math.hypot(dx, dy);
  // Troppo piccola per dire qualcosa, o così grande che è per metà fuori
  // schermo e l'altra metà è deformata: in tutt'e due i casi il disegno
  // non aiuta nessuno.
  if (lungo < 26 || lungo > (sky.larghezza + sky.altezza) * 3) return null;

  // Con la terza ancora l'asse y non è più la perpendicolare all'asse x:
  // è quello che serve perché la terza stella finisca dove il disegno se
  // l'aspetta. Se la terza ancora manca o è finita dietro all'osservatore
  // si torna alla perpendicolare, che è il telaio di prima.
  let px = -dy, py = dx;
  if (t.c) {
    const C = skyProietta(t.c, base, focale);
    if (C.davanti) {
      const vx = (C.px - A.px - t.cx * dx) / t.cy;
      const vy = (C.py - A.py - t.cx * dy) / t.cy;
      // Un telaio quasi degenere (i tre punti quasi in fila) stira il
      // disegno all'infinito: meglio la similitudine, che è sempre sana
      const area = Math.abs(dx * vy - dy * vx);
      if (area > lungo * lungo * 0.02) { px = vx; py = vy; }
    }
  }
  // La misura media del telaio: serve ai cerchi, che restano cerchi anche
  // quando il telaio stira (una testa schiacciata non è una testa)
  const scala = Math.sqrt(lungo * Math.hypot(px, py)) || lungo;
  return { ox: A.px, oy: A.py, dx, dy, px, py, lungo, scala };
}

function costPunto(telaio, x, y) {
  return [
    telaio.ox + x * telaio.dx + y * telaio.px,
    telaio.oy + x * telaio.dy + y * telaio.py
  ];
}

// Una spline che passa per i punti dati (Catmull-Rom scritta come curve
// di Bézier cubiche). Serve perché una figura fatta di segmenti dritti
// sembra un poligono, e un animale non è un poligono. Se l'ultimo punto
// coincide col primo, la curva si chiude su sé stessa senza spigolo.
function costCurva(ctx, punti) {
  const n = punti.length / 2;
  if (n < 2) return;
  const chiusa = Math.abs(punti[0] - punti[(n - 1) * 2]) < 1e-9 &&
                 Math.abs(punti[1] - punti[(n - 1) * 2 + 1]) < 1e-9;
  const px = i => {
    if (chiusa) return punti[(((i % (n - 1)) + (n - 1)) % (n - 1)) * 2];
    return punti[Math.max(0, Math.min(n - 1, i)) * 2];
  };
  const py = i => {
    if (chiusa) return punti[(((i % (n - 1)) + (n - 1)) % (n - 1)) * 2 + 1];
    return punti[Math.max(0, Math.min(n - 1, i)) * 2 + 1];
  };

  ctx.moveTo(px(0), py(0));
  const fine = chiusa ? n - 1 : n - 1;
  for (let i = 0; i < fine; i++) {
    const x0 = px(i - 1), y0 = py(i - 1);
    const x1 = px(i),     y1 = py(i);
    const x2 = px(i + 1), y2 = py(i + 1);
    const x3 = px(i + 2), y3 = py(i + 2);
    ctx.bezierCurveTo(
      x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6,
      x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6,
      x2, y2
    );
  }
  if (chiusa) ctx.closePath();
}

// Scrive nel tracciato tutte le curve di una figura, già portate sullo
// schermo. Torna false se non c'è finito niente.
//
// `pieni`, se c'è, raccoglie a parte le curve CHIUSE — quelle che
// finiscono dove sono cominciate, cioè le sagome: il corpo del leone, il
// torso di Orione, la faccia del toro. Riempite con un velo leggerissimo
// smettono di essere un groviglio di linee e diventano un animale. Le
// altre curve (le zampe, la coda, le corna) restano linee, perché una
// zampa riempita sarebbe una macchia.
function costTracciaFigura(ctx, sigla, telaio, pieni) {
  const arte = COST_ARTE[sigla];
  let qualcosa = false;

  (arte.tratti || []).forEach(t => {
    const s = new Array(t.length);
    for (let i = 0; i < t.length; i += 2) {
      const p = costPunto(telaio, t[i], t[i + 1]);
      s[i] = p[0]; s[i + 1] = p[1];
    }
    costCurva(ctx, s);
    const chiusa = Math.abs(t[0] - t[t.length - 2]) < 1e-9 &&
                   Math.abs(t[1] - t[t.length - 1]) < 1e-9;
    if (pieni && chiusa) costCurva(pieni, s);
    qualcosa = true;
  });

  (arte.rette || []).forEach(t => {
    for (let i = 0; i < t.length; i += 2) {
      const p = costPunto(telaio, t[i], t[i + 1]);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    qualcosa = true;
  });

  (arte.cerchi || []).forEach(c => {
    const p = costPunto(telaio, c[0], c[1]);
    // Il raggio è nella scala del telaio: cresce e cala con la figura
    const r = c[2] * (telaio.scala || telaio.lungo);
    if (r < 0.6) return;
    ctx.moveTo(p[0] + r, p[1]);
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    // Anche le teste sono sagome: riempite, una figura ha una faccia
    if (pieni) { pieni.moveTo(p[0] + r, p[1]); pieni.arc(p[0], p[1], r, 0, Math.PI * 2); }
    qualcosa = true;
  });

  return qualcosa;
}

// Lo strato dei disegni. Un tracciato solo per tutte le figure: sono
// venticinque curve per figura e un ctx.stroke() per fotogramma, che è
// quello che il ciclo del planetario può permettersi.
function costDisegnaArte(ctx, base, focale) {
  if (!cost.arte || !sky.mostraCostellazioni) return;
  const velo = typeof skyVelo === 'function' ? skyVelo() : 1;
  if (velo < 0.06) return;
  const opacita = costOpacitaArte() * velo;
  if (opacita < 0.02) return;
  if (!costSincronizza()) return;

  // Dalle coordinate di catalogo al punto sullo schermo: serve alle
  // immagini agganciate a tre stelle (§5-bis), che le loro ancore se le
  // proiettano da sé invece di passare dal telaio
  const proietta = (ra, dec) => {
    const p = skyProietta(costAllOra(costVersore(ra, dec), cat.matrice), base, focale);
    return p.davanti ? [p.px, p.py] : null;
  };

  const tracciato = new Path2D();
  const pieni = new Path2D();
  let qualcosa = false;
  for (const sigla of costSigleArte()) {
    const telaio = costTelaioSchermo(sigla, base, focale);
    if (!telaio) continue;
    // Fuori schermo del tutto: le ancore stanno lontanissime da tutti e
    // due i bordi e non c'è verso che il disegno rientri
    const fuori = (telaio.ox < -telaio.lungo * 1.6 && telaio.ox + telaio.dx < -telaio.lungo * 1.6) ||
                  (telaio.ox > sky.larghezza + telaio.lungo * 1.6 && telaio.ox + telaio.dx > sky.larghezza + telaio.lungo * 1.6) ||
                  (telaio.oy < -telaio.lungo * 1.6 && telaio.oy + telaio.dy < -telaio.lungo * 1.6) ||
                  (telaio.oy > sky.altezza + telaio.lungo * 1.6 && telaio.oy + telaio.dy > sky.altezza + telaio.lungo * 1.6);
    if (fuori) continue;
    // L'immagine, se questa figura ce l'ha e se è già arrivata, prende il
    // posto delle curve: sono due disegni della stessa cosa, e messi uno
    // sopra l'altro fanno solo confusione. Finché non arriva (o se il file
    // non c'è) restano le curve, che è il ripiego giusto — un disegno c'è
    // comunque.
    if (costDisegnaImmagine(ctx, sigla, opacita, proietta)) { qualcosa = true; continue; }
    if (COST_ARTE[sigla] && costTracciaFigura(tracciato, sigla, telaio, pieni)) qualcosa = true;
  }
  if (!qualcosa) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Prima il velo dentro alle sagome, poi le linee sopra. Il velo è un
  // sesto del tratto: deve dire «qui c'è un corpo» e nient'altro — più
  // scuro di così diventa una macchia che copre le stelle, che sono la
  // ragione per cui uno sta guardando lì.
  ctx.globalAlpha = opacita * 0.17;
  ctx.fillStyle = 'rgb(178, 160, 250)';
  ctx.fill(pieni, 'nonzero');
  ctx.globalAlpha = opacita;
  ctx.lineWidth = sky.fov < 30 ? 1.3 : 1;
  ctx.strokeStyle = 'rgb(196, 181, 253)';     // lo stesso viola del cielo profondo
  ctx.stroke(tracciato);
  ctx.restore();
}


// =====================================================================
// 5-bis. I DISEGNI FATTI A MANO (le immagini)
//
//     Le curve della §2 sono precise ma sono anche un lavoro da certosino:
//     per ogni figura bisogna proiettare le sue stelle nel telaio, tirare
//     le curve una per una e controllare che non escano dal gruppo. Trenta
//     figure sono venute così; le altre cinquantotto, di questo passo, non
//     verranno mai.
//
//     Un disegno fatto a mano — su carta, o su una tavoletta grafica sopra
//     a una schermata del planetario — è un'altra strada, e per chi disegna
//     è l'unica sensata. Qui c'è quello che serve per appoggiarlo sul cielo
//     invece che sulle curve.
//
//     COME SI AGGIUNGE UN DISEGNO NUOVO. Due passi, e nessuno dei due è
//     scrivere codice difficile:
//
//       1. si mette il file dentro `arte-costellazioni/`;
//       2. si aggiunge una riga a `COST_IMMAGINI` qui sotto:
//
//              Leo: 'leone.png',
//
//     e basta. Il disegno si appoggia da solo sul rettangolo che contiene
//     le stelle della figura, e da lì in poi ruota, si stira e si ingrandisce
//     con loro come fanno le curve.
//
//     L'INCHIOSTRO E LA CARTA. Un disegno nasce quasi sempre scuro su
//     fondo bianco, e appoggiato così com'è sul cielo sarebbe un francobollo
//     bianco con sopra un toro. Al caricamento l'immagine viene perciò
//     rovesciata una volta sola: quanto più un punto è scuro, tanto più
//     diventa opaco — la carta bianca sparisce, l'inchiostro resta e prende
//     il viola dei disegni. Un PNG che la trasparenza ce l'ha già (fondo
//     ritagliato) viene riconosciuto e lasciato stare.
//
//     QUANDO IL COLPO D'OCCHIO NON BASTA. L'appoggio automatico presume
//     che la figura stia in mezzo all'immagine e la riempia per intero:
//     quasi sempre è vero, perché un disegno si fa proprio così. Se il
//     disegno risulta spostato o troppo grande ci sono tre manopole, in
//     ordine di fatica:
//
//         Tau: { file: 'toro.png', margine: 1.35, sposta: [0.05, -0.1],
//                gira: -6, scala: [1.1, 1] }
//
//     Sono cinque, e si applicano in quest'ordine — conta, perché `gira`
//     gira anche gli assi di `scala`, mentre `sposta` viene dopo tutto e
//     resta sempre nella direzione in cui lo si legge (destra e giù):
//
//         1. il disegno viene portato grande quanto le stelle × `margine`
//         2. × `scala` (un numero, o [orizzontale, verticale])
//         3. specchiato, se `specchio`
//         4. girato di `gira` gradi in senso orario
//         5. scostato di `sposta`, in frazioni del riquadro delle stelle
//
//     Le manopole in due parole:
//
//         margine   quanto deborda dalle stelle (1 = le tocca esattamente)
//         scala     ingrandimento in più; [x, y] per stirarlo su un asse solo
//         gira      gradi in senso orario, come «ruota a destra» di un editor
//         specchio  'x' ribalta destra-sinistra, 'y' sopra-sotto, 'xy' tutt'e due
//         sposta    [destra, giù] in frazioni del riquadro delle stelle
//
//     TROVARE I CINQUE NUMERI SENZA IMPAZZIRE. Cambiarli a mano, ricaricare
//     e guardare è un giro da mezzo minuto per tentativo, e i tentativi sono
//     tanti. Col planetario aperto sulla figura, dalla console del browser:
//
//         costArteRegola('Tau', { gira: -6, scala: 1.1 })   → si vede subito
//         costArteMostra('Tau')                             → la riga da incollare
//
//     `costArteRegola` cambia l'entrata viva e il fotogramma dopo il disegno
//     è già lì; `costArteMostra` stampa l'entrata come va scritta qui, con
//     dentro solo le manopole che sono state davvero toccate.
//
//     E se si vuole la precisione al pixel, le tre ancore —
//     tre stelle vere, e dove stanno nell'immagine:
//
//         Tau: { file: 'toro.png', ancore: [
//                 [5.4382, 28.6075, 190,   35],    // Elnath      → pixel
//                 [5.6274, 21.1425,  68,  218],    // zeta Tauri  → pixel
//                 [3.4528,  9.7327, 1105, 690]     // lambda Tauri→ pixel
//               ] }
//
//     che è esattamente il modo in cui Stellarium ancora le sue
//     illustrazioni, ed è anche il motivo per cui è quello scelto: chi ha
//     già tarato un'immagine per Stellarium può portarsi dietro i numeri.
//
//     Con le tre ancore le cinque manopole non servono più e vengono
//     ignorate: dicono la stessa cosa in un modo più scomodo. Tre punti
//     fissano posizione, misura, rotazione, stiramento e specchio tutti
//     insieme — e li fissano *sulle stelle*, che è meglio che fissarli
//     rispetto a un riquadro.
//
//     SE IL FILE NON C'È, non succede niente di male: la richiesta fallisce
//     una volta sola, non si riprova più, e la figura torna al suo disegno
//     a curve. È voluto — così una riga scritta qui prima di aver caricato
//     l'immagine non rompe il planetario a nessuno.
// =====================================================================

// Dove stanno i file. Cartella a parte e non in mezzo al codice: sono
// disegni, si guardano e si sostituiscono senza aprire un editor di testo.
const COST_ARTE_CARTELLA = 'arte-costellazioni/';

// Il viola dei disegni: lo stesso del tratto delle curve e del cielo
// profondo, perché immagine e curve devono sembrare la stessa cosa.
const COST_IMMAGINE_TINTA = 'rgb(196, 181, 253)';

// Quanto il disegno deborda dalle stelle, quando non lo dice l'entrata.
// Un disegno si fa lasciando un margine attorno alla figura, e 1,2 è
// quello che viene alla mano di quasi tutti.
const COST_IMMAGINE_MARGINE = 1.2;

// ---------------------------------------------------------------------
// L'ELENCO. È l'unica cosa da toccare per aggiungerne uno.
// ---------------------------------------------------------------------
const COST_IMMAGINI = {
  // Il toro disegnato a mano sopra le linee della figura: le corna che
  // escono dalla V delle Iadi, il muso, la groppa. Sotto ci sono ancora
  // le curve della §2, e tornano da sole se il file manca.
  //
  // `sposta` non è un numero di gusto: nel disegno la figura di stelle non
  // sta in mezzo al foglio, perché la groppa dell'animale continua a
  // destra ben oltre l'ultima stella. Misurando dove cadono Elnath, zeta e
  // lambda si vede che l'appoggio automatico le manda tutte e tre un sesto
  // di foglio più a destra del dovuto, sempre della stessa quantità — che
  // è la firma di uno scostamento, non di una scala sbagliata. Se un
  // giorno il disegno venisse rifatto, questi sono i due numeri da girare.
  Tau: { file: 'toro.png', gira: 4, sposta: [0.2, 0.2] },
  Psc: { file: 'pesci.png',  sposta: [0.20,0.2]},
  Ari: { file: 'ariete.png', sposta: [-0.1, 0.3]}
};

// Un'entrata può essere una stringa (il solo nome del file) o un oggetto
// con le manopole. Qui diventano la stessa cosa, così il resto del codice
// non deve più chiederselo.
function costImmagineVoce(sigla) {
  let v = COST_IMMAGINI[sigla];
  if (!v) return null;
  if (typeof v === 'string') v = { file: v };
  if (!v || !v.file) return null;

  // `scala` è un numero se il disegno va solo ingrandito, e una coppia se
  // va anche stirato su un asse solo. Qui diventa sempre una coppia.
  const s = v.scala;
  const scala = Array.isArray(s)
    ? [s[0] > 0 ? s[0] : 1, s[1] > 0 ? s[1] : 1]
    : (s > 0 ? [s, s] : [1, 1]);

  const spec = String(v.specchio === true ? 'x' : (v.specchio || '')).toLowerCase();

  return {
    file: v.file,
    margine: v.margine > 0 ? v.margine : COST_IMMAGINE_MARGINE,
    scala,
    gira: isFinite(v.gira) ? +v.gira : 0,      // gradi, senso orario
    specchio: [spec.includes('x'), spec.includes('y')],
    sposta: v.sposta || [0, 0],
    ancore: (v.ancore && v.ancore.length >= 3) ? v.ancore : null,
    tinta: v.tinta || COST_IMMAGINE_TINTA,     // 'originale' tiene i colori del disegno
    forza: v.forza > 0 ? v.forza : 1,
    sfondo: v.sfondo || 'auto'                 // 'auto' | 'bianco' | 'trasparente'
  };
}

function costColoreRgb(testo) {
  const m = String(testo).match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = String(testo).match(/^#([0-9a-f]{6})$/i);
  if (h) return [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16)];
  return [196, 181, 253];
}

// Da disegno su carta a velo di luce. Si fa una volta sola, al
// caricamento, su una tela fuori schermo: nel ciclo del planetario resta
// un `drawImage` e nient'altro (vedi le convenzioni: niente disegno
// pesante a ogni fotogramma).
function costImmagineVelo(memoria, img, voce) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('immagine vuota');

  const tela = document.createElement('canvas');
  tela.width = w; tela.height = h;
  const c = tela.getContext('2d');
  c.drawImage(img, 0, 0);

  const dati = c.getImageData(0, 0, w, h);
  const p = dati.data;

  // Ha già la trasparenza sua? Si guarda un pixel ogni tanto: se una
  // parte consistente è già completamente trasparente, il fondo qualcuno
  // l'ha già ritagliato e non tocca a noi rifarlo.
  let ritagliata = voce.sfondo === 'trasparente';
  if (voce.sfondo === 'auto') {
    let vuoti = 0, campioni = 0;
    for (let i = 3; i < p.length; i += 4 * 53) { if (p[i] < 16) vuoti++; campioni++; }
    ritagliata = campioni > 0 && vuoti > campioni * 0.08;
  }

  const originale = voce.tinta === 'originale';
  if (!(ritagliata && originale)) {
    const [tr, tg, tb] = costColoreRgb(voce.tinta);
    for (let i = 0; i < p.length; i += 4) {
      const a = p[i + 3] / 255;
      // La carta è bianca: quel che è trasparente conta come bianco, così
      // un JPEG e un PNG ritagliato danno lo stesso risultato
      const r = p[i] * a + 255 * (1 - a);
      const g = p[i + 1] * a + 255 * (1 - a);
      const b = p[i + 2] * a + 255 * (1 - a);
      let inchiostro = ritagliata ? a : 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // I fondi scansionati non sono mai bianchi davvero: senza questa
      // sogliatura il disegno si porta dietro un rettangolo di foschia
      inchiostro = (inchiostro - 0.06) / 0.94;
      if (inchiostro <= 0) { p[i + 3] = 0; continue; }
      if (inchiostro > 1) inchiostro = 1;
      if (!originale) { p[i] = tr; p[i + 1] = tg; p[i + 2] = tb; }
      p[i + 3] = Math.round(inchiostro * 255);
    }
    c.putImageData(dati, 0, 0);
  }

  memoria.tela = tela;
  memoria.larghezza = w;
  memoria.altezza = h;
}

// La chiede la prima volta che la figura passa davanti allo schermo: non
// si scaricano ottantotto disegni per guardarne uno. Torna la memoria
// solo quando è pronta davvero.
function costImmagine(sigla) {
  const voce = costImmagineVoce(sigla);
  if (!voce) return null;

  let memoria = cost.immagini[sigla];
  if (!memoria) memoria = cost.immagini[sigla] = { stato: 'niente' };

  if (memoria.stato === 'niente') {
    memoria.stato = 'in-corso';
    const img = new Image();
    img.onload = () => {
      try {
        costImmagineVelo(memoria, img, voce);
        memoria.stato = 'pronta';
        // L'atlante disegna la sua scheda una volta sola, all'apertura:
        // se l'immagine arriva dopo, la scheda non la vedrebbe mai
        if (cost.atlante && cost.scelta === sigla) costDisegnaScheda(sigla);
      } catch (e) {
        memoria.stato = 'fallita';
      }
    };
    // Un file che non c'è (o un nome sbagliato) non si riprova: la figura
    // torna alle curve e nessuno se ne accorge
    img.onerror = () => { memoria.stato = 'fallita'; };
    img.src = COST_ARTE_CARTELLA + voce.file;
  }

  return memoria.stato === 'pronta' ? memoria : null;
}

// Il rettangolo che contiene le stelle della figura, misurato sulla carta
// locale con il NORD IN ALTO e l'EST A SINISTRA — cioè come si vede il
// cielo, e come è messo il foglio su cui uno disegna.
//
// Non è un dettaglio: è la ragione per cui questo riquadro non si misura
// nel telaio delle due ancore, che pure ci sarebbe già. Il telaio delle
// ancore ha per asse x la congiungente di due stelle, che per il Toro è
// la retta ξ→Elnath, inclinata di cinquanta gradi rispetto al nord.
// Appoggiandoci sopra un'immagine, il disegno verrebbe fuori girato di
// altrettanto: un toro coricato di traverso, agganciato benissimo alle
// stelle sbagliate. Un disegno, a differenza di una curva, ha un suo alto
// e un suo basso, e va appeso a quelli.
function costRiquadroFigura(sigla) {
  if (!cost.riquadri) cost.riquadri = {};
  if (sigla in cost.riquadri) return cost.riquadri[sigla];

  const carta = costPianoFigura(sigla);
  let box = null;
  if (carta) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    carta.punti.forEach(p => {
      const q = carta.piano(p[0], p[1]);
      if (!q) return;
      // Il mezzo giro che porta dalla carta al cielo visto da dentro: la
      // x cresce verso ovest e la y verso sud, che sono il destra e il
      // giù di un'immagine (vedi la nota lunga della §1 e §8)
      const x = -q[0], y = -q[1];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    });
    if (x1 - x0 > 1e-6 && y1 - y0 > 1e-6) box = { x0, y0, x1, y1 };
  }
  cost.riquadri[sigla] = box;
  return box;
}

// Le tre ancore che l'entrata non ha dichiarato: tre angoli dell'immagine
// e il pezzo di cielo su cui vanno a finire. Da qui in poi un'immagine
// appoggiata da sé e una tarata al pixel percorrono la stessa strada.
//
// È anche il posto in cui si applicano le cinque manopole, e l'ordine è
// quello scritto nella testata della sezione: misura, scala, specchio,
// rotazione, scostamento. Il giro viene prima dello scostamento apposta —
// così `sposta` vuol dire sempre «più a destra, più in giù» qualunque sia
// l'inclinazione del disegno, che è l'unico modo di poterlo correggere
// guardando lo schermo invece di rifare i conti.
function costAncoreAutomatiche(sigla, voce, memoria) {
  const box = costRiquadroFigura(sigla);
  const carta = costPianoFigura(sigla);
  if (!box || !carta) return null;

  // Le manopole si leggono con la loro scappatoia: normalmente arrivano
  // già a posto da `costImmagineVoce`, ma questa funzione la chiama anche
  // chi sta tarando un disegno a mano, e una manopola non scritta deve
  // voler dire «lasciala com'è» invece di far esplodere tutto
  const margine = voce.margine > 0 ? voce.margine : COST_IMMAGINE_MARGINE;
  const scala = voce.scala || [1, 1];
  const specchio = voce.specchio || [false, false];
  const sposta = voce.sposta || [0, 0];

  const larga = box.x1 - box.x0, alta = box.y1 - box.y0;
  // Una scala sola per i due assi: il disegno non si deve schiacciare per
  // adattarsi a una figura più larga che alta. Si prende la più grande
  // delle due, così le stelle ci stanno dentro comunque.
  const base = Math.max(larga * margine / memoria.larghezza,
                        alta * margine / memoria.altezza);
  const sx = base * scala[0] * (specchio[0] ? -1 : 1);
  const sy = base * scala[1] * (specchio[1] ? -1 : 1);

  // Sulla carta la x cresce verso destra e la y verso il basso (§5-bis):
  // con la y in giù la matrice di rotazione scritta come si scrive sempre
  // gira in senso ORARIO, che è il verso del «ruota a destra» di un
  // qualunque editor di immagini. Torna comodo, ed è un caso — ma è il
  // caso per cui `gira` positivo vuol dire quello che uno si aspetta.
  const th = (voce.gira || 0) * Math.PI / 180;
  const co = Math.cos(th), si = Math.sin(th);

  const cx = (box.x0 + box.x1) / 2 + (sposta[0] || 0) * larga;
  const cy = (box.y0 + box.y1) / 2 + (sposta[1] || 0) * alta;
  const mx = memoria.larghezza / 2, my = memoria.altezza / 2;

  const angolo = (u, v) => {
    const a = (u - mx) * sx, b = (v - my) * sy;
    const c = carta.cielo(-(cx + a * co - b * si), -(cy + a * si + b * co));
    return [c[0], c[1], u, v];
  };
  return [angolo(0, 0), angolo(memoria.larghezza, 0), angolo(0, memoria.altezza)];
}

// Da tre punti dell'immagine a tre punti dello schermo: la trasformazione
// affine che ci va sopra, nella forma che vuole `ctx.transform`
// (x' = a·u + c·v + e, y' = b·u + d·v + f). Tre punti sono esattamente
// quello che serve: due darebbero una similitudine, che non sa stirare.
function costAffineDaTre(ancore, schermo) {
  const u0 = ancore[0][2], v0 = ancore[0][3];
  const u1 = ancore[1][2], v1 = ancore[1][3];
  const u2 = ancore[2][2], v2 = ancore[2][3];
  const det = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
  // Tre punti in fila (o due coincidenti) non definiscono niente
  if (!isFinite(det) || Math.abs(det) < 1e-6) return null;

  const risolvi = (z0, z1, z2) => [
    (z0 * (v1 - v2) - v0 * (z1 - z2) + (z1 * v2 - z2 * v1)) / det,
    (u0 * (z1 - z2) - z0 * (u1 - u2) + (u1 * z2 - u2 * z1)) / det,
    (u0 * (v1 * z2 - v2 * z1) - v0 * (u1 * z2 - u2 * z1) + z0 * (u1 * v2 - u2 * v1)) / det
  ];
  const [a, c, e] = risolvi(schermo[0][0], schermo[1][0], schermo[2][0]);
  const [b, d, f] = risolvi(schermo[0][1], schermo[1][1], schermo[2][1]);
  return [a, b, c, d, e, f];
}

// L'immagine appoggiata sulla figura. Torna true se ce l'ha fatta: chi
// chiama, in quel caso, salta le curve.
//
// `proietta(ra, dec)` porta una stella sullo schermo di chi sta
// disegnando — il planetario o la scheda dell'atlante. È l'unica cosa che
// serve: le tre ancore, dichiarate o scelte da sé, sono tre punti del
// cielo, e tre punti del cielo bastano a dire dove va l'immagine.
function costDisegnaImmagine(ctx, sigla, opacita, proietta) {
  const voce = costImmagineVoce(sigla);
  if (!voce || !proietta) return false;
  const memoria = costImmagine(sigla);
  if (!memoria) return false;

  const ancore = voce.ancore
    ? voce.ancore.slice(0, 3)
    : costAncoreAutomatiche(sigla, voce, memoria);
  if (!ancore) return false;

  const punti = ancore.map(a => proietta(a[0], a[1]));
  if (punti.some(p => !p)) return false;
  const M = costAffineDaTre(ancore, punti);
  if (!M) return false;

  const alfa = opacita * voce.forza;
  if (!(alfa > 0.01)) return false;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  // Luce che si somma al cielo, non vernice che lo copre: è la stessa
  // ragione per cui l'aurora si ricalca in `lighter`. Le stelle sotto al
  // disegno si devono continuare a vedere — sono loro il motivo per cui
  // uno sta guardando lì.
  ctx.globalCompositeOperation = 'lighter';
  ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  ctx.drawImage(memoria.tela, 0, 0);
  ctx.restore();
  return true;
}


// ---------------------------------------------------------------------
// ALLINEARE UN DISEGNO SENZA RICARICARE OGNI VOLTA
//
// Le manopole sono cinque e nessuna delle cinque si indovina: si guarda
// il disegno sulle stelle e si corregge. Il giro «cambio il numero →
// salvo → ricarico → riapro il planetario → riinquadro la figura» dura
// mezzo minuto, e mezzo minuto per tentativo vuol dire rinunciare al
// terzo tentativo e tenersi un disegno storto.
//
// Queste due funzioni tolgono quel giro. Non hanno interfaccia e non ne
// vogliono una: si chiamano dalla console del browser, col planetario
// aperto sulla figura, e la seconda stampa la riga da incollare qui
// sopra. Sono l'equivalente della matita sul foglio.
// ---------------------------------------------------------------------

// Cambia l'entrata viva. Il ciclo del planetario disegna sessanta volte
// al secondo e la prossima passata è già col numero nuovo: non c'è niente
// da invalidare, perché il riquadro delle stelle non dipende dalle
// manopole e le tre ancore si rifanno a ogni fotogramma.
//
// Le uniche due che fanno eccezione sono `tinta` e `sfondo`: quelle sono
// cotte dentro alla tela del velo, e cambiarle vuol dire ridipingerla.
function costArteRegola(sigla, cambi) {
  const attuale = COST_IMMAGINI[sigla];
  if (!attuale) { console.warn(`[arte] ${sigla} non ha un'immagine registrata`); return null; }

  const base = typeof attuale === 'string' ? { file: attuale } : attuale;
  const nuova = Object.assign({}, base, cambi || {});
  COST_IMMAGINI[sigla] = nuova;

  if (cambi && ('tinta' in cambi || 'sfondo' in cambi)) delete cost.immagini[sigla];
  if (cost.atlante && cost.scelta === sigla) costDisegnaScheda(sigla);

  return costArteMostra(sigla);
}

// La riga da incollare in COST_IMMAGINI, con dentro solo le manopole che
// sono state davvero toccate: una entrata piena di valori di serie si
// legge peggio e invecchia peggio (il giorno che il valore di serie
// cambia, quelli scritti a mano non se ne accorgono).
function costArteMostra(sigla) {
  const v = COST_IMMAGINI[sigla];
  if (!v) return null;
  const o = typeof v === 'string' ? { file: v } : v;

  const num = n => (Math.round(n * 1000) / 1000);
  const pezzi = [`file: '${o.file}'`];
  if (o.margine > 0 && o.margine !== COST_IMMAGINE_MARGINE) pezzi.push(`margine: ${num(o.margine)}`);
  if (o.scala != null) {
    pezzi.push(Array.isArray(o.scala)
      ? `scala: [${num(o.scala[0])}, ${num(o.scala[1])}]`
      : `scala: ${num(o.scala)}`);
  }
  if (o.gira) pezzi.push(`gira: ${num(o.gira)}`);
  if (o.specchio) pezzi.push(`specchio: '${o.specchio === true ? 'x' : o.specchio}'`);
  if (o.sposta && (o.sposta[0] || o.sposta[1])) {
    pezzi.push(`sposta: [${num(o.sposta[0])}, ${num(o.sposta[1])}]`);
  }
  if (o.forza > 0 && o.forza !== 1) pezzi.push(`forza: ${num(o.forza)}`);
  if (o.tinta) pezzi.push(`tinta: '${o.tinta}'`);
  if (o.sfondo && o.sfondo !== 'auto') pezzi.push(`sfondo: '${o.sfondo}'`);

  // Col solo nome del file l'entrata torna alla sua forma breve: è quella
  // che va scritta, e vederla stampata così è anche il modo di scoprire
  // che il disegno andava bene com'era
  const riga = pezzi.length === 1
    ? `  ${sigla}: '${o.file}',`
    : `  ${sigla}: { ${pezzi.join(', ')} },`;
  console.log(riga);
  return riga;
}


// =====================================================================
// 6. TOCCARE UNA FIGURA
//
//     Le stelle si toccano già una per una, e gli oggetti profondi pure.
//     Quello che mancava era poter chiedere «e tutta questa roba qui,
//     come si chiama?» — che è la domanda che uno si fa guardando un
//     pezzo di cielo, non un puntino. Si risponde aprendo l'atlante alla
//     pagina giusta.
//
//     Il tocco cade sulle LINEE della figura, non sul disegno: le linee
//     ci sono sempre, anche per le sessanta figure senza disegno, e sono
//     quello che si sta guardando.
// =====================================================================

function costFiguraNelPunto(px, py, base, focale) {
  if (!catPronto() || !sky.mostraCostellazioni || !cat.figure) return null;
  const L = sky.larghezza, A = sky.altezza;
  const cx = L / 2, cy = A / 2;
  const fr = base.f, br = base.r, bu = base.u;
  const soglia = 26;

  let migliore = null;
  cat.figure.forEach(fig => {
    fig.spezzate.forEach(s => {
      let prec = null;
      for (let k = 0; k < s.quanti; k++) {
        const x = s.ora[k * 3], y = s.ora[k * 3 + 1], z = s.ora[k * 3 + 2];
        const d = x * fr[0] + y * fr[1] + z * fr[2];
        const den = (1 + d) * 0.5;
        const p = (d > SKY_D_MIN && z >= 0)
          ? { px: cx + focale * ((x * br[0] + y * br[1] + z * br[2]) / den),
              py: cy - focale * ((x * bu[0] + y * bu[1] + z * bu[2]) / den) }
          : null;
        if (prec && p) {
          const dist = costDistanzaSegmento(px, py, prec.px, prec.py, p.px, p.py);
          if (dist < soglia && (!migliore || dist < migliore.dist)) {
            migliore = { dist, sigla: fig.sigla };
          }
        }
        prec = p;
      }
    });
  });

  return migliore ? migliore.sigla : null;
}

function costDistanzaSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(px - ax, py - ay);
  // Un segmento lungo mezzo cielo è un artefatto della proiezione, non
  // una linea: succede a chi scavalca il bordo della vista
  if (len2 > (sky.larghezza + sky.altezza) * (sky.larghezza + sky.altezza)) return Infinity;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}


// =====================================================================
// 7. CHE COSTELLAZIONE È, E DA QUI SI VEDE?
//
//     Due domande che sembrano una sola e non lo sono. «Si vede?» per una
//     costellazione non dipende dall'ora ma dalla latitudine: metà del
//     cielo, da un dato posto, non sorge e non sorgerà mai. È la
//     differenza fra «stanotte no» e «da qui mai», e vale la pena dirla
//     con parole diverse.
// =====================================================================

// Il baricentro di ogni figura, in coordinate di catalogo. Si calcola una
// volta sola: è la media dei versori dei suoi vertici, non delle
// coordinate — su una figura a cavallo delle zero ore la media delle
// ascensioni rette darebbe un punto dalla parte opposta del cielo.
function costCentri() {
  if (cost.centri) return cost.centri;
  if (typeof COSTELLAZIONI_IAU === 'undefined') return null;
  cost.centri = {};
  COSTELLAZIONI_IAU.forEach(c => {
    let x = 0, y = 0, z = 0, n = 0;
    c.spezzate.forEach(l => l.forEach(p => {
      const v = costVersore(p[0], p[1]);
      x += v[0]; y += v[1]; z += v[2]; n++;
    }));
    if (!n) return;
    const norma = Math.hypot(x, y, z) || 1;
    x /= norma; y /= norma; z /= norma;
    const dec = Math.asin(Math.max(-1, Math.min(1, z))) * 180 / Math.PI;
    const ra = ((Math.atan2(y, x) * 180 / Math.PI / 15) + 24) % 24;
    // Il Serpente è in due tronconi e compare due volte: vince il primo,
    // che è la testa. Meglio un centro un po' spostato di due voci uguali
    // nell'elenco.
    if (!cost.centri[c.sigla]) cost.centri[c.sigla] = { ra, dec };
  });
  return cost.centri;
}

function costLatitudineDiCasa() {
  try {
    if (typeof skyLuogoDelCielo === 'function') {
      const l = skyLuogoDelCielo();
      if (l && typeof l.lat === 'number') return l.lat;
    }
  } catch (e) { /* planetario non avviato */ }
  try {
    const l = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
    if (l && typeof l.lat === 'number') return l.lat;
  } catch (e) { /* nessuna posizione */ }
  return null;
}

// Quanto in alto arriva, da una certa latitudine, e se ci arriva.
function costVisibilita(sigla, lat) {
  const c = (costCentri() || {})[sigla];
  if (!c || typeof lat !== 'number') return null;
  const altMax = 90 - Math.abs(lat - c.dec);
  const altMin = Math.abs(lat + c.dec) - 90;
  return {
    dec: c.dec, ra: c.ra,
    altMax: Math.max(-90, altMax),
    circumpolare: altMin > 0,
    maiVisibile: altMax <= 0,
    bassa: altMax > 0 && altMax < 20
  };
}

// A che mese culmina a mezzanotte: il modo più semplice di dire «questa
// è una figura d'inverno». Il Sole sta in ascensione retta 0h il 21
// marzo e avanza di due ore al mese: una figura culmina a mezzanotte
// quando il Sole sta dalla parte opposta del cielo, cioè dodici ore più
// in là.
const COST_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function costMeseMigliore(raOre) {
  if (typeof raOre !== 'number') return null;
  const raSole = ((raOre - 12) % 24 + 24) % 24;
  const giorni = raSole / 24 * 365.25;
  const d = new Date(Date.UTC(2001, 2, 21));
  d.setUTCDate(d.getUTCDate() + Math.round(giorni));
  return COST_MESI[d.getUTCMonth()];
}

function costEmisfero(sigla) {
  const c = (costCentri() || {})[sigla];
  if (!c) return 'equatoriale';
  if (c.dec > 20) return 'boreale';
  if (c.dec < -20) return 'australe';
  return 'equatoriale';
}


// =====================================================================
// 8. L'ATLANTE
//
//     Una finestra sola che risponde a tutte e tre le domande: che figura
//     è, come la chiamano gli altri, e da qui si vede. È fatta per il
//     telefono prima che per lo schermo grande, e si vede da come è
//     costruita: una colonna sola, elenco e scheda che si danno il cambio
//     con un tasto «indietro» in cima, niente che vada cercato in
//     orizzontale. Su uno schermo largo le due colonne stanno affiancate
//     e il tasto indietro sparisce — ma è la stessa pagina, non due.
// =====================================================================

const COST_FILTRI = [
  { id: 'tutte',    nome: 'Tutte' },
  { id: 'australi', nome: 'Cielo australe' },
  { id: 'boreali',  nome: 'Cielo boreale' },
  { id: 'disegni',  nome: 'Con disegno' },
  { id: 'qui',      nome: 'Si vedono da qui' },
  { id: 'buio',     nome: 'Del buio' }
];

function costElencoVoci() {
  if (typeof COSTELLAZIONI_IAU === 'undefined') return [];
  const visti = new Set();
  const voci = [];
  COSTELLAZIONI_IAU.forEach(c => {
    if (visti.has(c.sigla)) return;        // il Serpente è in due pezzi
    visti.add(c.sigla);
    voci.push({
      sigla: c.sigla, nome: c.nome, latino: c.latino, rango: c.rango,
      emisfero: costEmisfero(c.sigla),
      // «Ha un disegno» vuol dire che qualcosa da vedere c'è: le curve
      // della §2 o l'immagine della §5-bis, indifferentemente
      disegno: !!(COST_ARTE[c.sigla] || COST_IMMAGINI[c.sigla]),
      nomi: (COST_NOMI[c.sigla] && COST_NOMI[c.sigla].nomi) || []
    });
  });
  voci.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  return voci;
}

function costFiltraVoci() {
  const lat = costLatitudineDiCasa();
  const cerca = typeof normalizzaTesto === 'function'
    ? normalizzaTesto(cost.cerca || '')
    : (cost.cerca || '').toLowerCase();

  return costElencoVoci().filter(v => {
    if (cost.filtro === 'australi' && v.emisfero !== 'australe') return false;
    if (cost.filtro === 'boreali' && v.emisfero !== 'boreale') return false;
    if (cost.filtro === 'disegni' && !v.disegno) return false;
    if (cost.filtro === 'qui') {
      const vis = costVisibilita(v.sigla, lat);
      if (!vis || vis.maiVisibile) return false;
    }
    if (!cerca) return true;
    // La ricerca guarda anche i nomi delle altre culture: chi cerca
    // «Matariki» o «Te Punga» deve trovare qualcosa
    const paglia = [v.nome, v.latino, v.sigla].concat(v.nomi.map(n => n.nome + ' ' + (n.senso || ''))).join(' ');
    const morbido = typeof normalizzaTesto === 'function' ? normalizzaTesto(paglia) : paglia.toLowerCase();
    return morbido.indexOf(cerca) >= 0;
  });
}

function costCostruisciElenco() {
  const cont = document.getElementById('cost-elenco');
  if (!cont) return;

  if (cost.filtro === 'buio') {
    cont.innerHTML = COST_BUIO.map(b => `
      <button type="button" class="cost-riga" data-buio="${b.id}">
        <span class="cost-riga-nome">${b.nome}</span>
        <span class="cost-riga-sotto">${(COST_CULTURE[b.cultura] || {}).nome || ''} · una figura fatta di buio</span>
      </button>`).join('');
    return;
  }

  const lat = costLatitudineDiCasa();
  const voci = costFiltraVoci();
  if (!voci.length) {
    cont.innerHTML = '<p class="cost-vuoto">Nessuna costellazione con questo nome.</p>';
    return;
  }

  cont.innerHTML = voci.map(v => {
    const vis = costVisibilita(v.sigla, lat);
    let dove = '';
    if (vis) {
      if (vis.maiVisibile) dove = '<span class="cost-tag cost-tag-mai">da qui mai</span>';
      else if (vis.circumpolare) dove = '<span class="cost-tag cost-tag-si">non tramonta mai</span>';
      else if (vis.bassa) dove = `<span class="cost-tag">appena ${Math.round(vis.altMax)}° sull'orizzonte</span>`;
    }
    const arte = v.disegno ? '<span class="cost-tag cost-tag-arte">disegno</span>' : '';
    return `
      <button type="button" class="cost-riga" data-sigla="${v.sigla}">
        <span class="cost-riga-nome">${v.nome}</span>
        <span class="cost-riga-sotto">${v.latino}${dove || arte ? ' ' : ''}${dove}${arte}</span>
      </button>`;
  }).join('');
}

// --- La scheda di una costellazione ---

function costSchedaHtml(sigla) {
  const voce = costElencoVoci().find(v => v.sigla === sigla);
  if (!voce) return '<p class="cost-vuoto">Costellazione non trovata.</p>';

  const lat = costLatitudineDiCasa();
  const vis = costVisibilita(sigla, lat);
  const dati = COST_NOMI[sigla];
  const gruppo = COST_GRUPPI[costGruppoDi(sigla)];

  const etichette = [
    `<span class="cost-etichetta">${voce.emisfero === 'australe' ? 'cielo australe'
      : voce.emisfero === 'boreale' ? 'cielo boreale' : 'cielo equatoriale'}</span>`,
    voce.disegno ? '<span class="cost-etichetta cost-etichetta-arte">con disegno</span>' : ''
  ].join('');

  let daQui = '';
  if (vis && typeof lat === 'number') {
    if (vis.maiVisibile) {
      daQui = `<p class="cost-daqui cost-daqui-no"><strong>Da qui non si vede mai.</strong> ` +
        `Alla tua latitudine (${Math.round(lat)}°) resta tutta sotto l'orizzonte, a qualunque ora ` +
        `e in qualunque mese: non è questione di aspettare la notte giusta, è la curvatura della Terra. ` +
        `Il tasto qui sotto ti porta dove si vede.</p>`;
    } else if (vis.circumpolare) {
      daQui = `<p class="cost-daqui"><strong>Da qui non tramonta mai:</strong> gira intorno al polo ` +
        `e resta sopra l'orizzonte tutta la notte, tutto l'anno. Al massimo arriva a ` +
        `${Math.round(vis.altMax)}° di altezza.</p>`;
    } else {
      const mese = costMeseMigliore(vis.ra);
      daQui = `<p class="cost-daqui">Da qui arriva al massimo a <strong>${Math.round(vis.altMax)}°</strong> ` +
        `sopra l'orizzonte${vis.bassa ? ' — bassa, serve un orizzonte libero da quella parte' : ''}. ` +
        (mese ? `Culmina a mezzanotte verso <strong>${mese}</strong>, ed è quello il mese in cui si guarda meglio.` : '') +
        `</p>`;
    }
  }

  const nomi = (dati && dati.nomi || []).map(n => {
    const cultura = COST_CULTURE[n.cultura] || { nome: n.cultura };
    return `<li class="cost-nome">
      <div class="cost-nome-testa"><span class="cost-cultura">${cultura.nome}</span></div>
      <div class="cost-nome-corpo"><strong>${n.nome}</strong>${n.senso ? ` — ${n.senso}` : ''}</div>
      ${n.nota ? `<p class="cost-nome-nota">${n.nota}</p>` : ''}
    </li>`;
  }).join('');

  const stelle = (dati && dati.stelle || []).map(s =>
    `<li><strong>${s.nome}</strong>${s.senso ? ` — ${s.senso}` : ''}${s.nota ? `<br><span class="cost-nome-nota">${s.nota}</span>` : ''}</li>`
  ).join('');

  const azioni = [];
  if (vis && !vis.maiVisibile) {
    azioni.push(`<button type="button" class="tasto-evento-cielo tasto-evento-forte" ` +
      `onclick="costMostraInCielo('${sigla}')">Mostrala in cielo</button>`);
  }
  azioni.push(`<button type="button" class="tasto-evento-cielo" onclick="costPortami('${sigla}')">` +
    `${vis && vis.maiVisibile ? 'Portami dove si vede' : 'Portami sotto il suo cielo'}</button>`);
  // La stessa figura, ma nello spazio vero: è la risposta alla domanda
  // che viene dopo aver letto che ogni cultura ci ha visto una cosa
  // diversa — «ma allora la figura c'è o no?». No.
  if (typeof didCostellazioneNelloSpazio === 'function') {
    azioni.push(`<button type="button" class="tasto-evento-cielo" ` +
      `onclick="didCostellazioneNelloSpazio('${sigla}')" ` +
      `title="Le sue stelle messe nello spazio vero, ognuna alla sua distanza: la figura è ` +
      `un effetto di prospettiva, e da un altro pianeta non c'è">Dove stanno davvero</button>`);
  }

  return `
    <div class="cost-testa">
      <h3>${voce.nome}</h3>
      <p class="cost-latino">${voce.latino} · ${voce.sigla}</p>
      <div class="cost-etichette">${etichette}</div>
    </div>
    <div class="cost-tela-guscio"><canvas id="cost-tela" class="cost-tela"></canvas></div>
    <p class="cost-tela-nota">${voce.disegno
      ? 'Le linee sono la figura ufficiale, il tratto chiaro è il disegno: le stesse curve che il planetario appoggia sul cielo vero.'
      : 'Di questa figura il planetario disegna le linee ufficiali. La sagoma non c\'è: sono le figure che nessuno, nemmeno chi le ha inventate, è mai riuscito a vedere davvero.'}</p>
    ${daQui}
    ${dati && dati.racconto ? `<p class="cost-racconto">${dati.racconto}</p>` : ''}
    <div class="cost-origine">
      <h4>${gruppo.titolo}</h4>
      <p>${gruppo.testo}</p>
    </div>
    ${nomi ? `<h4 class="cost-titolo-sezione">Come la chiamano altrove</h4>
      <ul class="cost-nomi">${nomi}</ul>` : ''}
    ${stelle ? `<h4 class="cost-titolo-sezione">Le sue stelle</h4>
      <ul class="cost-stelle">${stelle}</ul>` : ''}
    <div class="azioni-evento">${azioni.join('')}</div>`;
}

function costSchedaBuioHtml(id) {
  const b = COST_BUIO.find(x => x.id === id);
  if (!b) return '';
  const cultura = COST_CULTURE[b.cultura] || { nome: b.cultura };
  return `
    <div class="cost-testa">
      <h3>${b.nome}</h3>
      <p class="cost-latino">${cultura.nome}</p>
      <div class="cost-etichette"><span class="cost-etichetta cost-etichetta-buio">costellazione del buio</span></div>
    </div>
    <p class="cost-racconto">${b.testo}</p>
    <ul class="cost-stelle">
      <li><strong>Dove</strong> — ${b.dove}</li>
      <li><strong>Quando</strong> — ${b.quando}</li>
    </ul>
    <div class="cost-origine">
      <h4>Perché non ci sono stelle</h4>
      <p>Una costellazione del buio non si disegna unendo puntini: si riconosce dalla forma di una
      nube di polvere che copre le stelle dietro di sé. Per vederle serve un cielo davvero scuro e
      una Via Lattea alta — condizioni che nell'emisfero australe capitano molto più spesso, ed è
      per questo che queste figure vengono quasi tutte da lì.</p>
    </div>
    <div class="azioni-evento">
      <button type="button" class="tasto-evento-cielo tasto-evento-forte"
        onclick="costPortamiAlBuio('${b.id}')">Portami dove si vede</button>
    </div>`;
}

// --- Il disegnino nella scheda ---
//
// Non è il planetario in piccolo: è la figura vista da davanti, come su
// una carta, senza orizzonte e senza ora. Serve a riconoscerla, e per
// questo è orientata come in cielo (l'ascensione retta cresce verso
// sinistra, che è come la si vede da terra) e non come su un mappamondo.

function costMagnitudineVicina(raOre, dec) {
  if (typeof CATALOGO_STELLE === 'undefined') return 3;
  let minimo = Infinity, mag = 4.5;
  const cd = Math.cos(dec * Math.PI / 180);
  for (let i = 0; i < CATALOGO_STELLE_QUANTE; i++) {
    if (CATALOGO_STELLE[i * 4 + 2] > 5.0) break;      // il catalogo è ordinato per magnitudine
    const dRa = (CATALOGO_STELLE[i * 4] - raOre) * 15 * cd;
    const dDec = CATALOGO_STELLE[i * 4 + 1] - dec;
    const d2 = dRa * dRa + dDec * dDec;
    if (d2 < minimo) { minimo = d2; mag = CATALOGO_STELLE[i * 4 + 2]; }
  }
  return minimo < 0.02 ? mag : 4.5;
}

function costDisegnaScheda(sigla) {
  const tela = document.getElementById('cost-tela');
  if (!tela || typeof COSTELLAZIONI_IAU === 'undefined') return;

  const pezzi = COSTELLAZIONI_IAU.filter(c => c.sigla === sigla);
  if (!pezzi.length) return;

  const larghezza = tela.clientWidth || 320;
  const altezza = Math.round(larghezza * 0.72);
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  tela.width = Math.round(larghezza * dpr);
  tela.height = Math.round(altezza * dpr);
  tela.style.height = altezza + 'px';
  const ctx = tela.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, larghezza, altezza);

  // Piano tangente al baricentro: a questa scala è indistinguibile da
  // quello che si vede in cielo, e non ha il polo da nessuna parte
  const punti = [];
  pezzi.forEach(c => c.spezzate.forEach(l => l.forEach(p => punti.push(p))));
  const D2R = Math.PI / 180;
  let cx = 0, cy = 0, cz = 0;
  punti.forEach(p => { const v = costVersore(p[0], p[1]); cx += v[0]; cy += v[1]; cz += v[2]; });
  const norma = Math.hypot(cx, cy, cz) || 1;
  cx /= norma; cy /= norma; cz /= norma;
  const dec0 = Math.asin(Math.max(-1, Math.min(1, cz))), ra0 = Math.atan2(cy, cx);

  const piano = (raOre, dec) => {
    const a = raOre * 15 * D2R, d = dec * D2R;
    const cosc = Math.sin(dec0) * Math.sin(d) + Math.cos(dec0) * Math.cos(d) * Math.cos(a - ra0);
    if (cosc <= 0.05) return null;
    return [
      Math.cos(d) * Math.sin(a - ra0) / cosc,
      (Math.cos(dec0) * Math.sin(d) - Math.sin(dec0) * Math.cos(d) * Math.cos(a - ra0)) / cosc
    ];
  };

  const piani = punti.map(p => piano(p[0], p[1])).filter(Boolean);
  if (!piani.length) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  piani.forEach(p => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  });
  const margine = 26;
  const scala = Math.min(
    (larghezza - margine * 2) / Math.max(0.02, maxX - minX),
    (altezza - margine * 2) / Math.max(0.02, maxY - minY)
  );
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  // Il mezzo giro che porta dalla carta al cielo: l'est va a sinistra e il
  // nord va in alto (vedi la sezione 1). È lo stesso di skyProietta, ed è
  // il motivo per cui il disegno qui e quello in cielo si somigliano.
  //
  // I DUE SEGNI DEVONO ESSERE UGUALI, e non è un dettaglio estetico: un
  // segno solo negato è uno SPECCHIO, e uno specchio ribalta l'asse y del
  // telaio delle ancore. Il risultato non è un disegno storto — è un
  // disegno che sta dalla parte sbagliata delle sue stelle: lo scudo di
  // Orione finiva dove c'è la clava. Due segni negati sono invece mezzo
  // giro, cioè una rotazione, e il telaio ci sopravvive.
  const schermo = p => p ? [larghezza / 2 - (p[0] - mx) * scala, altezza / 2 - (p[1] - my) * scala] : null;

  // Le linee della figura
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(120, 178, 255, 0.75)';
  ctx.beginPath();
  pezzi.forEach(c => c.spezzate.forEach(l => {
    let prec = null;
    l.forEach(p => {
      const s = schermo(piano(p[0], p[1]));
      if (prec && s) { ctx.moveTo(prec[0], prec[1]); ctx.lineTo(s[0], s[1]); }
      prec = s;
    });
  }));
  ctx.stroke();

  // Le stelle, grandi quanto sono luminose
  const visti = new Set();
  punti.forEach(p => {
    const chiave = p[0].toFixed(3) + ',' + p[1].toFixed(3);
    if (visti.has(chiave)) return;
    visti.add(chiave);
    const s = schermo(piano(p[0], p[1]));
    if (!s) return;
    const mag = costMagnitudineVicina(p[0], p[1]);
    const r = Math.max(1.4, 4.4 - mag * 0.62);
    ctx.beginPath();
    ctx.arc(s[0], s[1], r * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.16)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
  });

  // E sopra, il disegno — costruito sullo stesso telaio di due ancore che
  // usa il planetario, così quello che si impara qui si ritrova là
  const ancore = costAncoreDi(sigla);
  if (!ancore) return;
  const A = schermo(piano(ancore[0][0], ancore[0][1]));
  const B = schermo(piano(ancore[1][0], ancore[1][1]));
  if (!A || !B) return;
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const lungo = Math.hypot(dx, dy);
  let px = -dy, py = dx;
  // La stessa terza ancora del planetario: il disegno qui e quello in
  // cielo devono essere lo stesso disegno, anche nel modo in cui si stira
  const terza = costTerzaAncora(sigla, ancore);
  if (terza) {
    const C = schermo(piano(terza.ra, terza.dec));
    if (C) {
      const vx = (C[0] - A[0] - terza.x * dx) / terza.y;
      const vy = (C[1] - A[1] - terza.x * dy) / terza.y;
      if (Math.abs(dx * vy - dy * vx) > lungo * lungo * 0.02) { px = vx; py = vy; }
    }
  }
  const telaio = { ox: A[0], oy: A[1], dx, dy, px, py, lungo,
                   scala: Math.sqrt(lungo * Math.hypot(px, py)) || lungo };

  // Se la figura ha un disegno fatto a mano (§5-bis) è lui che si vede, e
  // qui si vede meglio che in cielo: questa è la pagina in cui uno la
  // guarda apposta, non un velo appoggiato sulle stelle mentre cerca
  // altro. Le curve restano il ripiego, come nel planetario.
  if (costDisegnaImmagine(ctx, sigla, 0.9, (ra, dec) => schermo(piano(ra, dec)))) return;
  if (!COST_ARTE[sigla]) return;

  const tracciato = new Path2D();
  const pieni = new Path2D();
  costTracciaFigura(tracciato, sigla, telaio, pieni);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(178, 160, 250, 0.14)';
  ctx.fill(pieni, 'nonzero');
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(196, 181, 253, 0.85)';
  ctx.stroke(tracciato);
  ctx.restore();
}


// =====================================================================
// 9. PORTAMI SOTTO IL SUO CIELO
//
//     Dall'Italia la Croce del Sud non si vede, e non c'è ora del giorno
//     né mese dell'anno che possa cambiarlo. L'unica risposta onesta è
//     spostarsi — e il planetario sa già guardare da un altro luogo (è il
//     pannello «Tempo e luogo»), solo che nessuno ci arrivava da solo.
//
//     Qui c'è il tasto che ci porta: sceglie un posto vero da cui quella
//     figura passa alta, cerca la notte in cui ci passa e ci mette
//     l'orologio, e gira la vista dalla parte giusta. Tre cose che a
//     mano vorrebbero dire aprire tre pannelli e sapere già la risposta.
//
//     La posizione dell'app NON si tocca: quella resta casa tua, il meteo
//     resta il tuo e il calendario pure. Cambia solo da dove guarda il
//     planetario, e si torna indietro con un tasto.
// =====================================================================

// Posti veri, scelti perché sono posti in cui la gente guarda davvero il
// cielo: si va a quello che ha la latitudine più vicina alla figura.
const COST_METE = [
  { nome: 'Tromsø, Norvegia',            lat:  69.65, lon:   18.96 },
  { nome: 'Osservatorio di Asiago',      lat:  45.87, lon:   11.53 },
  { nome: 'Roque de los Muchachos, La Palma', lat: 28.75, lon: -17.89 },
  { nome: 'Mauna Kea, Hawai\'i',         lat:  19.82, lon: -155.47 },
  { nome: 'Nairobi, Kenya',              lat:  -1.29, lon:   36.82 },
  { nome: 'Deserto di Atacama, Cile',    lat: -24.63, lon:  -70.40 },
  { nome: 'Isola di Pasqua',             lat: -27.11, lon: -109.35 },
  { nome: 'Perth, Australia',            lat: -31.95, lon:  115.86 },
  { nome: 'Città del Capo, Sudafrica',   lat: -33.93, lon:   18.42 },
  { nome: 'Auckland, Nuova Zelanda',     lat: -36.85, lon:  174.76 },
  { nome: 'Hobart, Tasmania',            lat: -42.88, lon:  147.33 },
  { nome: 'Ushuaia, Argentina',          lat: -54.80, lon:  -68.30 }
];

function costMetaPer(dec) {
  let migliore = COST_METE[0], scarto = Infinity;
  COST_METE.forEach(m => {
    // Non basta la latitudine più vicina: si vuole la figura alta, ma
    // anche un posto in cui la notte esista. Tromsø d'estate non ha notte
    // e i primi due gradi di scarto non valgono quel prezzo.
    const s = Math.abs(m.lat - dec) + Math.max(0, Math.abs(m.lat) - 55) * 1.5;
    if (s < scarto) { scarto = s; migliore = m; }
  });
  return migliore;
}

// La notte buona: si scorre l'anno cercando l'istante in cui la figura è
// più alta e il Sole è già ben sotto l'orizzonte. Duecento conti scarsi,
// e si fanno una volta sola quando si preme il tasto.
function costMiglioreIstante(centro, lat, lon, daQuando, giorni, passoGiorni) {
  if (typeof Astronomy === 'undefined') return null;
  const osservatore = new Astronomy.Observer(lat, lon, 0);
  let migliore = null;

  for (let g = 0; g <= giorni; g += (passoGiorni || 1)) {
    for (let h = -6; h <= 6; h += 1) {                 // le ore intorno alla mezzanotte locale
      // Mezzanotte locale calcolata sulla longitudine, non sul fuso: qui
      // non ci interessa che ora segnano gli orologi di là, ci interessa
      // dov'è il Sole.
      const quando = new Date(daQuando.getTime() + g * 86400000 +
        (h - lon / 15) * 3600000);
      try {
        const t = Astronomy.MakeTime(quando);
        const sole = Astronomy.Equator('Sun', t, osservatore, true, true);
        const altSole = Astronomy.Horizon(t, osservatore, sole.ra, sole.dec, 'normal').altitude;
        if (altSole > -14) continue;                   // non è ancora notte fatta
        const oggi = skyJ2000AllaData(centro.ra, centro.dec, t);
        const alt = Astronomy.Horizon(t, osservatore, oggi.ra, oggi.dec, 'normal').altitude;
        if (!migliore || alt > migliore.alt) migliore = { quando, alt };
      } catch (e) { /* una data che non si calcola non ferma la ricerca */ }
    }
    // Appena si trova una notte in cui passa davvero alta si smette: la
    // prima notte buona è più utile della migliore in assoluto, che
    // potrebbe essere fra undici mesi
    if (migliore && migliore.alt > 55) break;
  }
  return migliore;
}

function costCentroDi(sigla) {
  const c = (costCentri() || {})[sigla];
  return c || null;
}

// Sposta l'orologio del planetario su un istante. È lo stesso orologio di
// tutto il resto (sky.offsetTempoSec): la vista 3D e la mappa dell'ombra
// lo seguono da sole.
function costPortaOrologio(quando) {
  if (typeof skyImpostaOffsetTempo !== 'function') return;
  skyImpostaOffsetTempo(Math.round((quando.getTime() - Date.now()) / 1000));
}

function costApriPlanetario() {
  if (typeof mostraVista === 'function' && vistaAttuale !== 'cielo') mostraVista('cielo');
}

// Gira la vista sulla figura, e se serve porta l'orologio alla notte in
// cui passa alta.
window.costMostraInCielo = function (sigla) {
  const centro = costCentroDi(sigla);
  if (!centro) return;
  costChiudiAtlante();
  costApriPlanetario();
  cost.arte = true;
  sky.mostraCostellazioni = true;

  const luogo = (typeof skyLuogoDelCielo === 'function' && skyLuogoDelCielo()) || null;
  if (!luogo || typeof luogo.lat !== 'number') {
    if (typeof skyAvviso === 'function') {
      skyAvviso('costellazione', 'Per dire dove guardare mi serve la tua posizione: aprila dal pannello Tempo e luogo.', 7000);
    }
    return;
  }

  const adesso = typeof skyAdesso === 'function' ? skyAdesso() : new Date();
  let quando = adesso;
  try {
    const t = Astronomy.MakeTime(adesso);
    const oss = new Astronomy.Observer(luogo.lat, luogo.lon, 0);
    const oggi = skyJ2000AllaData(centro.ra, centro.dec, t);
    const alt = Astronomy.Horizon(t, oss, oggi.ra, oggi.dec, 'normal').altitude;
    const sole = Astronomy.Equator('Sun', t, oss, true, true);
    const altSole = Astronomy.Horizon(t, oss, sole.ra, sole.dec, 'normal').altitude;
    // Se adesso è già buio e la figura è su, si resta dov'è l'orologio:
    // spostarlo sarebbe sgarbato con chi stava guardando l'ora vera
    if (alt < 12 || altSole > -12) {
      const meglio = costMiglioreIstante(centro, luogo.lat, luogo.lon, adesso, 200, 2);
      if (meglio) quando = meglio.quando;
    }
  } catch (e) { /* si tenta con l'ora che c'è */ }

  if (quando !== adesso) costPortaOrologio(quando);
  costGuardaVerso(centro, quando);
};

function costGuardaVerso(centro, quando) {
  if (!sky.observer || typeof Astronomy === 'undefined') return;
  try {
    const t = Astronomy.MakeTime(quando || skyAdesso());
    const oggi = skyJ2000AllaData(centro.ra, centro.dec, t);
    const h = Astronomy.Horizon(t, sky.observer, oggi.ra, oggi.dec, 'normal');
    if (typeof skyCentraSu === 'function') {
      skyCentraSu({ az: h.azimuth, alt: h.altitude, nome: 'la costellazione' });
    }
    // Un campo da binocolo largo: una costellazione intera ci sta dentro,
    // e i disegni a questo campo sono al massimo della loro opacità
    if (typeof skyImpostaFov === 'function') skyImpostaFov(70, { morbido: true });
  } catch (e) { /* niente da centrare */ }
}

window.costPortami = function (sigla) {
  const centro = costCentroDi(sigla);
  if (!centro || typeof Astronomy === 'undefined') return;
  costChiudiAtlante();
  costApriPlanetario();
  cost.arte = true;
  sky.mostraCostellazioni = true;

  const meta = costMetaPer(centro.dec);
  const adesso = typeof skyAdesso === 'function' ? skyAdesso() : new Date();
  const meglio = costMiglioreIstante(centro, meta.lat, meta.lon, adesso, 370, 3);

  if (typeof skyImpostaLuogoVista === 'function') {
    skyImpostaLuogoVista(meta.lat, meta.lon, meta.nome);
  }
  if (meglio) costPortaOrologio(meglio.quando);
  costGuardaVerso(centro, meglio ? meglio.quando : adesso);

  if (typeof skyAvviso === 'function') {
    const voce = costElencoVoci().find(v => v.sigla === sigla);
    skyAvviso('costellazione',
      `Sei a ${meta.nome}${meglio ? `, la notte del ${meglio.quando.toLocaleDateString('it-IT')}` : ''}: ` +
      `${voce ? voce.nome : 'la figura'} passa a ${meglio ? Math.round(meglio.alt) : '—'}° di altezza. ` +
      'La tua posizione non è cambiata: torni a casa dal pannello Tempo e luogo.', 11000);
  }
};

window.costPortamiAlBuio = function (id) {
  const b = COST_BUIO.find(x => x.id === id);
  if (!b) return;
  costChiudiAtlante();
  costApriPlanetario();
  sky.mostraViaLattea = true;

  const meta = costMetaPer(b.centro.dec);
  const adesso = typeof skyAdesso === 'function' ? skyAdesso() : new Date();
  const meglio = costMiglioreIstante(b.centro, meta.lat, meta.lon, adesso, 370, 3);
  if (typeof skyImpostaLuogoVista === 'function') skyImpostaLuogoVista(meta.lat, meta.lon, meta.nome);
  if (meglio) costPortaOrologio(meglio.quando);
  costGuardaVerso(b.centro, meglio ? meglio.quando : adesso);
  if (typeof skyAvviso === 'function') {
    skyAvviso('costellazione', `${b.nome}: sei a ${meta.nome}. Cerca il buio, non le stelle — ` +
      'la figura è la macchia scura in mezzo alla Via Lattea.', 11000);
  }
};


// =====================================================================
// 10. APRIRE E CHIUDERE, E TUTTI I FILI
// =====================================================================

window.apriAtlanteCostellazioni = function (sigla) {
  const modale = document.getElementById('modale-costellazioni');
  if (!modale) return;
  modale.classList.remove('hidden');
  cost.atlante = true;

  // I dati delle figure arrivano col catalogo, che si carica da sé solo
  // quando si apre il planetario: chi entra qui dalla Didattica o da un
  // link non l'ha mai aperto, e senza questa riga vedrebbe un elenco vuoto
  if (typeof catCarica === 'function' && !catPronto()) {
    catCarica().then(() => {
      cost.centri = null;
      costCostruisciElenco();
      if (cost.scelta) costMostraScheda(cost.scelta);
    });
  }

  costCostruisciElenco();
  if (sigla && typeof sigla === 'string') costMostraScheda(sigla);
  else costTornaAllElenco();
};

window.chiudiAtlanteCostellazioni = costChiudiAtlante;

function costChiudiAtlante() {
  const modale = document.getElementById('modale-costellazioni');
  if (modale) modale.classList.add('hidden');
  cost.atlante = false;
}

function costMostraScheda(chiave, buio) {
  const corpo = document.getElementById('cost-scheda');
  const guscio = document.getElementById('cost-corpo');
  if (!corpo || !guscio) return;
  cost.scelta = buio ? null : chiave;
  corpo.innerHTML = buio ? costSchedaBuioHtml(chiave) : costSchedaHtml(chiave);
  guscio.dataset.vista = 'scheda';
  corpo.scrollTop = 0;
  if (!buio) requestAnimationFrame(() => costDisegnaScheda(chiave));
}

function costTornaAllElenco() {
  const guscio = document.getElementById('cost-corpo');
  if (guscio) guscio.dataset.vista = 'elenco';
  const corpo = document.getElementById('cost-scheda');
  if (corpo && !cost.scelta) {
    corpo.innerHTML = '<p class="cost-vuoto">Scegli una costellazione dall\'elenco: ' +
      'trovi la figura, il disegno, chi le ha dato il nome e se da casa tua si vede.</p>';
  }
}

// Il tasto dei disegni, nel pannello Filtri del planetario
window.costAlternaArte = function () {
  cost.arte = !cost.arte;
  costAggiornaTastoArte();
  // Il pannello resta aperto per permettere di combinare più filtri; si
  // richiude dalla sua linguetta quando si è finito.
};

function costAggiornaTastoArte() {
  const b = document.getElementById('skymap-btn-arte');
  if (!b) return;
  b.classList.toggle('attiva', cost.arte);
  b.setAttribute('aria-pressed', cost.arte ? 'true' : 'false');
}

function costInizializza() {
  const modale = document.getElementById('modale-costellazioni');
  if (!modale) return;

  const chiudi = document.getElementById('btn-chiudi-costellazioni');
  if (chiudi) chiudi.addEventListener('click', costChiudiAtlante);
  modale.addEventListener('click', e => { if (e.target === modale) costChiudiAtlante(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && cost.atlante) costChiudiAtlante();
  });

  const indietro = document.getElementById('cost-indietro');
  if (indietro) indietro.addEventListener('click', () => { cost.scelta = null; costTornaAllElenco(); });

  const cerca = document.getElementById('cost-cerca');
  if (cerca) {
    cerca.addEventListener('input', () => { cost.cerca = cerca.value; costCostruisciElenco(); });
  }

  const filtri = document.getElementById('cost-filtri');
  if (filtri) {
    filtri.innerHTML = COST_FILTRI.map(f =>
      `<button type="button" class="tasto-cielo${f.id === 'tutte' ? ' attiva' : ''}" data-filtro="${f.id}">${f.nome}</button>`
    ).join('');
    filtri.addEventListener('click', e => {
      const b = e.target.closest('[data-filtro]');
      if (!b) return;
      cost.filtro = b.dataset.filtro;
      filtri.querySelectorAll('[data-filtro]').forEach(x =>
        x.classList.toggle('attiva', x.dataset.filtro === cost.filtro));
      costCostruisciElenco();
    });
  }

  const elenco = document.getElementById('cost-elenco');
  if (elenco) {
    elenco.addEventListener('click', e => {
      const riga = e.target.closest('[data-sigla], [data-buio]');
      if (!riga) return;
      if (riga.dataset.buio) costMostraScheda(riga.dataset.buio, true);
      else costMostraScheda(riga.dataset.sigla);
    });
  }

  // Girando il telefono la tela della scheda va rimisurata: è larga quanto
  // il riquadro, e il riquadro cambia
  window.addEventListener('resize', () => {
    if (cost.atlante && cost.scelta) costDisegnaScheda(cost.scelta);
  });

  const tasto = document.getElementById('skymap-btn-arte');
  if (tasto) tasto.addEventListener('click', costAlternaArte);
  costAggiornaTastoArte();

  const apri = document.getElementById('skymap-btn-atlante');
  if (apri) apri.addEventListener('click', () => apriAtlanteCostellazioni());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', costInizializza);
} else {
  costInizializza();
}


// =====================================================================
// 11. LE STELLE NELLO SPAZIO VERO
//
//     Una costellazione è un effetto di prospettiva. Le sue stelle non
//     hanno niente a che fare l'una con l'altra: sembrano vicine perché
//     stanno quasi nella stessa direzione, e «quasi nella stessa
//     direzione» è una proprietà di CHI GUARDA, non del cielo. Le tre
//     stelle della cintura di Orione, che sembrano gemelle e in fila,
//     stanno a 692, 1.977 e 736 anni luce: la seconda è quasi tre volte
//     più lontana delle altre due.
//
//     Per far vedere questa cosa serve un dato che il planetario non ha
//     mai avuto: la distanza. Sta in `dati-distanze.js` — un vertice per
//     ogni stella delle ottantotto figure, con la sua parallasse tradotta
//     in anni luce — e si carica solo a chi apre il banco che lo usa.
//
//     Qui ci sono il caricamento e la geometria: da (ascensione retta,
//     declinazione, distanza) alle tre coordinate cartesiane, con il Sole
//     nell'origine. Da lì in poi è tutto disegno, e sta in didattica.js.
// =====================================================================

const COST_FILE_DISTANZE = 'dati-distanze.js';

// Le stelle senza parallasse buona sono dieci su settecentosessantasette,
// e sono quasi tutte supergiganti lontanissime. Metterle a zero le
// piazzerebbe addosso al Sole; metterle a mille sarebbe inventare un
// numero. Si mettono alla distanza mediana della loro figura e si dice
// che è una stima — che è quello che si può onestamente dire.
function costDistanzaDiRipiego(voci) {
  const note = voci.map(v => v[2]).filter(d => typeof d === 'number' && d > 0).sort((a, b) => a - b);
  if (!note.length) return 500;
  return note[Math.floor(note.length / 2)];
}

// Servono DUE file, e chi chiama non deve saperlo: le distanze
// (dati-distanze.js) e le figure (dati-costellazioni.js, che se le carica
// il catalogo). Il secondo di solito c'è già — chi ha aperto il
// planetario ce l'ha — ma chi entra dalla Didattica senza essere mai
// passato dal cielo non ce l'ha, e senza figure le distanze sono numeri
// senza linee da unire.
function costCaricaDistanze() {
  if (cost.distanze === 'pronto') return Promise.resolve(true);
  if (cost.promessaDistanze) return cost.promessaDistanze;
  cost.distanze = 'in-corso';

  const soloDistanze = new Promise((risolvi) => {
    const s = document.createElement('script');
    s.src = COST_FILE_DISTANZE;
    s.async = false;
    s.onload = () => risolvi(true);
    s.onerror = () => risolvi(false);
    document.head.appendChild(s);
  });
  const figure = (typeof COSTELLAZIONI_IAU !== 'undefined') ? Promise.resolve(true)
    : (typeof catCarica === 'function' ? catCarica().then(() => true).catch(() => false)
                                       : Promise.resolve(false));

  cost.promessaDistanze = Promise.all([soloDistanze, figure]).then(([a, b]) => {
    const bene = a && typeof DISTANZE_FIGURE !== 'undefined' && typeof COSTELLAZIONI_IAU !== 'undefined';
    cost.distanze = bene ? 'pronto' : 'fallito';
    cost.centri = null;             // adesso le figure ci sono: i baricentri si rifanno
    return bene;
  });
  return cost.promessaDistanze;
}

// Da direzione e distanza al punto nello spazio, in anni luce, con il
// Sole nell'origine e gli assi dell'equatore celeste: x verso il punto
// vernale, z verso il polo nord celeste.
function costPuntoSpazio(raOre, dec, al) {
  const D2R = Math.PI / 180;
  const ra = raOre * 15 * D2R, d = dec * D2R, cd = Math.cos(d);
  return [al * cd * Math.cos(ra), al * cd * Math.sin(ra), al * Math.sin(d)];
}

// Le stelle di una figura, con la loro posizione vera nello spazio e le
// linee che le uniscono. `null` se i dati non sono ancora arrivati.
function costStelle3D(sigla) {
  if (typeof DISTANZE_FIGURE === 'undefined' || typeof COSTELLAZIONI_IAU === 'undefined') return null;
  const voci = DISTANZE_FIGURE[sigla];
  if (!voci || !voci.length) return null;

  const ripiego = costDistanzaDiRipiego(voci);
  const indice = new Map();
  const stelle = voci.map((v, i) => {
    const stimata = !(typeof v[2] === 'number' && v[2] > 0);
    const al = stimata ? ripiego : v[2];
    const p = costPuntoSpazio(v[0], v[1], al);
    indice.set(v[0] + ',' + v[1], i);
    return {
      ra: v[0], dec: v[1], al, stimata,
      mag: typeof v[3] === 'number' ? v[3] : 4.5,
      bv: typeof v[4] === 'number' ? v[4] : 0.6,
      nome: v[5] || '',
      x: p[0], y: p[1], z: p[2]
    };
  });

  // Le linee della figura, tradotte in coppie di indici
  const linee = [];
  COSTELLAZIONI_IAU.filter(c => c.sigla === sigla).forEach(c =>
    c.spezzate.forEach(l => {
      for (let k = 1; k < l.length; k++) {
        const a = indice.get(l[k - 1][0] + ',' + l[k - 1][1]);
        const b = indice.get(l[k][0] + ',' + l[k][1]);
        if (a !== undefined && b !== undefined) linee.push([a, b]);
      }
    }));

  return { sigla, stelle, linee };
}

// Il colore di una stella dal suo indice di colore, come lo fa il
// catalogo: il banco in 3D deve dipingere le stesse stelle dello stesso
// colore del planetario, o sembrano due cieli diversi.
function costColoreStella(bv) {
  if (typeof catColoreDaBV === 'function') return catColoreDaBV(bv);
  const t = Math.max(-0.3, Math.min(2, bv));
  if (t < 0) return '#a8c8ff';
  if (t < 0.3) return '#cfe0ff';
  if (t < 0.6) return '#ffffff';
  if (t < 0.9) return '#ffeab8';
  if (t < 1.4) return '#ffcc8a';
  return '#ff9d6b';
}
