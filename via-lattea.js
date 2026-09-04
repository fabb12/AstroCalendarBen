// =====================================================================
// LA VIA LATTEA
//
//   Il piano della nostra Galassia guardato da dentro, disegnato nel
//   planetario. Sta in un file suo per due ragioni: era la sezione più
//   lunga di `app.js` che non parlasse con nessun'altra (tre nomi in
//   tutto, elencati qui sotto), e da qui `verifica.html` può caricarla e
//   metterla alla prova **per davvero** invece di tenersene una copia —
//   che per ottocento righe di formule sarebbe stata la copia peggiore
//   di tutto il progetto.
//
//   Cosa chiede a chi viene prima:
//     · `app.js` — `sky`, `SKY_D2R`, `SKY_R2D`, `SKY_D_MIN`, `skyVelo()`,
//       `skyEstinzione()`, `skySeme()`, `skyCaso()`;
//     · `catalogo.js` — `cieloDiCasa()`, e solo se c'è.
//   Cosa offre a chi viene dopo:
//     · `skyNubiDelCielo()` — i fiocchi, che catalogo.js porta nel cielo
//       di adesso con la stessa matrice delle stelle;
//     · `skyPortaViaLatteaInCielo(t)` — la strada di riserva, per i primi
//       secondi in cui il catalogo non c'è ancora;
//     · `skyDisegnaViaLattea(ctx, base, focale, luna)` — il disegno.
//   Tutt'e tre sono chiamate da `app.js` dietro a un `typeof`: senza
//   questo file l'app è esattamente quella di prima, con un cielo senza
//   Via Lattea.
//
//   L'indice:
//      0. Coordinate galattiche          7. I fiocchi e il bilancio della luce
//      1. Il rumore                      8. Le Nubi di Magellano
//      2. La forma della banda           9. I grumi di idrogeno acceso
//      3. La polvere e la densità       10. Il sorteggio
//      4. Il campo e il sorteggio       11. Nel cielo di adesso
//      5. Il colore e le tele           12. Il disegno
//      6. Le tele dei fiocchi
//
//   Le prove stanno nel §30 di `verifica.html`, che questo file lo carica
//   per davvero.
// =====================================================================
//
// Non è un catalogo: è il piano della nostra Galassia guardato da dentro.
// Per molto tempo qui c'è stata una riga — i punti di latitudine galattica
// zero — ripassata venti volte con tratti sempre più larghi; poi è
// diventata una nuvola di milleseicento fiocchi tondi, che era già
// tutt'altra cosa. Ma chi la Via Lattea l'ha vista davvero da un posto
// buio, quella nuvola la riconosceva ancora per quello che era: una
// campitura sfumata con dentro qualche gobba. Le mancavano le tre cose che
// si vedono per prime, e che in una fotografia sono tutto:
//
//   · **la grana.** Quella banda è fatta di stelle che l'occhio non separa
//     ma nemmeno fonde del tutto: brulica. Una campitura liscia, per
//     quanto ben sfumata, si legge come vernice — ed è il difetto che
//     nessuna quantità di sfumatura può togliere, perché il problema non è
//     il bordo, è l'interno;
//   · **le venature di polvere.** Non solo la Fenditura del Cigno, che è
//     la grande, ma la ragnatela di filamenti scuri che taglia la banda
//     dappertutto — e che ha bordi *frastagliati*, mai tondi. Una nube
//     scura disegnata con una gaussiana è una macchia; la polvere vera è
//     un fiume con degli affluenti;
//   · **le cose che non sono la banda.** Le Nubi di Magellano, che
//     dall'emisfero sud sono la cosa più bella del cielo e qui non
//     c'erano affatto; e i grumi di idrogeno acceso — la Laguna, Nord
//     America, Eta Carinae — che sono i pochi punti in cui quel grigio ha
//     un colore vero.
//
// Quindi: quattro strati di fiocchi al posto di uno, sorteggiati da un
// campo di densità che adesso è **frattale** invece che fatto di gobbe
// gaussiane, e stampati con sprite *granulose* invece che con dischi
// sfumati. La grana non costa niente a fotogramma perché sta dentro
// all'immagine che si ricopia: dipingerla una volta in una tela da
// sessantaquattro pixel, e poi timbrarla duemila volte con centri,
// misure e varianti diverse, dà una trama che non si ripete mai.
//
// I quattro strati:
//   0 il **velo** — duecentosessanta fiocchi larghi, lisci, quasi
//     trasparenti:
//     tengono insieme la banda e le danno il suo alone;
//   1 le **nubi** — millesettecento fiocchi medi e granulosi: sono il
//     corpo, e sono loro a raccontare le nubi stellari e le venature;
//   2 i **grani** — tremiladuecento puntini: le stelle che non si separano.
//     Sono l'unico strato che si spegne ingrandendo, e per una ragione
//     precisa: sotto i quindici gradi di campo il catalogo comincia a
//     mettere lì le stelle *vere*, e due campi di stelle sovrapposti sono
//     una bugia;
//   3 gli **oggetti** — Magellano, i grumi di idrogeno, il Velo. Non si
//     spengono ingrandendo, perché sono cose che uno *va* a guardare.
//
// Tre regole non si toccano, ed è per quelle che questo pezzo può essere
// così ricco senza costare niente:
//   · il sorteggio si fa **una volta sola**, alla prima apertura del
//     planetario e non all'avvio dell'app;
//   · le posizioni si portano nel cielo di adesso con **una matrice
//     sola**, come fa catalogo.js per le stelle (cinquemila e passa
//     chiamate a Horizon() sarebbero il conto più caro della vista);
//   · e il disegno **non passa da `skyProietta`**: la formula è srotolata
//     qui dentro come in catalogo.js, per non costruire cinquemila oggetti
//     a fotogramma. Se un giorno la proiezione cambia, questa copia va
//     cambiata con lei — lo controlla il §30 di `verifica.html`.
const SKY_NGP_RA = 192.85948;    // polo nord galattico, ascensione retta in gradi
const SKY_NGP_DEC = 27.12825;    // ...e declinazione
const SKY_L_NCP = 122.93192;     // longitudine galattica del polo nord celeste

function skyGalatticoAEquatoriale(l, b) {
  const br = b * SKY_D2R;
  const dNGP = SKY_NGP_DEC * SKY_D2R;
  const dl = (SKY_L_NCP - l) * SKY_D2R;
  const sinDec = Math.sin(dNGP) * Math.sin(br) + Math.cos(dNGP) * Math.cos(br) * Math.cos(dl);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = Math.cos(br) * Math.sin(dl);
  const x = Math.cos(dNGP) * Math.sin(br) - Math.sin(dNGP) * Math.cos(br) * Math.cos(dl);
  const ra = ((SKY_NGP_RA + Math.atan2(y, x) * SKY_R2D) % 360 + 360) % 360;
  return { ra: ra / 15, dec: dec * SKY_R2D };
}

// Il versore di una direzione galattica. Serve al rumore: dandogli in
// pasto il punto sulla sfera invece della coppia (l, b), la trama non ha
// nessuna cucitura da ricucire — né a l = 0, né ai poli — perché non c'è
// nessuna carta di mezzo.
function skyVLVersore(l, b) {
  const lr = l * SKY_D2R, br = b * SKY_D2R, cb = Math.cos(br);
  return [cb * Math.cos(lr), cb * Math.sin(lr), Math.sin(br)];
}

// Quanti gradi di longitudine galattica siamo lontani dal centro (che sta
// in Sagittario, a l = 0): il numero da cui dipende quasi tutto il resto.
function skyVLDalCentro(l) {
  const a = ((l % 360) + 360) % 360;
  return Math.min(a, 360 - a);
}

// Distanza fra due punti in coordinate galattiche. Il coseno sulla
// longitudine serve perché a b = 30° un grado di longitudine è mezzo grado
// di cielo: senza, le nubi alte sopra al piano verrebbero stirate.
//
// Il doppio resto non è una ridondanza: il `%` di JavaScript tiene il
// segno del *dividendo*, quindi la scorciatoia `(l1 − l2 + 540) % 360`
// vale solo finché le due longitudini stanno già fra zero e trecentosessanta.
// Basta un giro di troppo — e chi chiama questa funzione da fuori non ha
// nessun motivo di saperlo — perché la differenza esca di centinaia di
// gradi e la nube più vicina risulti dall'altra parte del cielo.
function skyVLDistanza(l1, b1, l2, b2) {
  const dl = ((((l1 - l2) % 360) + 540) % 360 - 180) * Math.cos((b1 + b2) * 0.5 * SKY_D2R);
  return Math.hypot(dl, b1 - b2);
}

// =====================================================================
// 1. IL RUMORE — la trama che nessuna somma di gaussiane sa fare
// =====================================================================
// Rumore a valori sul reticolo intero, interpolato con la solita curva a
// S. Non è una scelta estetica: una banda costruita con sole gaussiane
// somigliava a un fiume di gobbe tutte uguali, e la Via Lattea vera non ha
// una scala sola — ha nubi da venti gradi, chiazze da tre e venature da
// mezzo, tutte insieme. È esattamente quello che una somma di ottave sa
// dire e una somma di gaussiane no.
function skyVLTritura(i, j, k) {
  let h = Math.imul(i | 0, 374761393);
  h = Math.imul(h ^ Math.imul(j | 0, 668265263), 2246822519);
  h = Math.imul(h ^ Math.imul(k | 0, 1274126177), 3266489917);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function skyVLRumore(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const c000 = skyVLTritura(xi, yi, zi),         c100 = skyVLTritura(xi + 1, yi, zi);
  const c010 = skyVLTritura(xi, yi + 1, zi),     c110 = skyVLTritura(xi + 1, yi + 1, zi);
  const c001 = skyVLTritura(xi, yi, zi + 1),     c101 = skyVLTritura(xi + 1, yi, zi + 1);
  const c011 = skyVLTritura(xi, yi + 1, zi + 1), c111 = skyVLTritura(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * ux, x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux, x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy, y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

// Il rumore a valori sul reticolo è **timido**, e non si vede leggendo il
// codice: la formula va da zero a uno, e in pratica non ci arriva mai.
// Interpolare fra numeri a caso stringe già lo scarto (una sola ottava sta
// quasi tutta fra 0,19 e 0,80), e sommare le ottave lo stringe ancora — un
// fbm a quattro ottave sta fra 0,32 e 0,69. Moltiplicare la banda per una
// cosa così vuol dire modularla del dieci per cento, cioè non modularla:
// è il difetto che teneva liscia la prima versione di questa trama.
//
// Si allarga attorno alla media e si tosa. Quello che esce dai bordi non
// è un errore, sono i **vuoti** e i **grumi**: una nube stellare vera ha
// dei posti in cui la densità satura e dei posti in cui non c'è niente, e
// una gaussiana quei due estremi non li fa mai.
function skyVLStira(n, k) {
  const v = 0.5 + (n - 0.5) * k;
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

// La somma di ottave. `ruvido` ripiega ogni ottava su sé stessa
// (`1 − |2n − 1|`): il risultato non è più una collina, è una **cresta**,
// e le creste messe in fila fanno filamenti. È la differenza fra una nube
// di polvere disegnata a macchie e una disegnata a fiumi — e la polvere
// vera è a fiumi.
//
// Il rapporto fra un'ottava e la successiva è 2,17 e non 2: raddoppiando
// esatto i reticoli si incastrano l'uno nell'altro e la trama mostra le
// righe del reticolo più grosso.
function skyVLTrama(x, y, z, ottave, ruvido) {
  let somma = 0, peso = 0, amp = 1, f = 1;
  for (let o = 0; o < ottave; o++) {
    let n = skyVLRumore(x * f, y * f, z * f);
    if (ruvido) n = 1 - Math.abs(n * 2 - 1);
    somma += n * amp;
    peso += amp;
    amp *= 0.52;
    f *= 2.17;
  }
  return somma / peso;
}

// =====================================================================
// 2. LA FORMA DELLA BANDA — dove sta, quant'è larga, e le nubi con un nome
// =====================================================================

// Dove sta il *centro* della banda, in gradi di latitudine galattica. Non
// è zero, e le ragioni sono due, tutt'e due vere.
//
// La prima: il Sole non sta sul piano medio della Galassia, ci sta una
// ventina di parsec sopra. Guardando in giro vediamo quindi il disco un
// filo *sotto* di noi, e tanto più quanto la struttura è vicina — cioè
// tanto più verso l'anticentro, dove quello che si vede è il braccio di
// casa a un migliaio di anni luce, e non il centro a ventiseimila.
//
// La seconda: il disco esterno è **svasato**, si incurva verso l'alto
// dalla parte di l = 90 e verso il basso dalla parte di l = 270. Sono
// frazioni di grado, ma è quello che toglie alla banda l'aria di un
// cerchio tirato col compasso.
function skyVLPiano(l) {
  const d = skyVLDalCentro(l);
  const soleAlto = -0.18 - 0.72 * (d / 180);
  const svaso = 0.85 * Math.sin(l * SKY_D2R) * (d / 180);
  return soleAlto + svaso;
}

// Semispessore della banda, in gradi. Il rigonfiamento centrale è il primo
// termine gaussiano; il secondo è la gobba del Cigno, dove il braccio di
// Orione ci passa accanto e la banda torna a essere larga.
function skyVLSemiSpessore(l) {
  const d = skyVLDalCentro(l);
  return 3.4
    + 8.4 * Math.exp(-Math.pow(d / 38, 2))
    + 1.6 * Math.exp(-Math.pow((d - 82) / 34, 2));
}

// Quanto brilla la banda lungo il giro: verso il centro è una nuvola
// densa, all'anticentro poco più di un quarto di quella luce. L'esponente
// 1,6 (invece del quadrato) tiene la caduta ripida vicino al centro e
// piatta lontano, che è come si comporta davvero.
//
// Il pavimento non è un dettaglio: è quello che tiene in cielo il tratto
// dal Cigno a Cassiopea. Quella parte è tre volte più debole del
// Sagittario, non trenta, e da un cielo buio si vede benissimo — è il
// «ponte» che chiunque riconosce alzando gli occhi d'estate.
function skyVLLuceGiro(l) {
  const d = skyVLDalCentro(l);
  return 0.48 + 0.52 * Math.exp(-Math.pow(d / 72, 1.6));
}

// Le nubi stellari con un nome: chiazze dove la banda si addensa. Sono
// quelle che si vedono a occhio nudo da un cielo buio, e sono il motivo
// per cui la Via Lattea non sembra mai dipinta con un pennello solo. La
// forma tonda che avevano prima adesso non si vede più, perché sopra ci
// passa la trama frattale che le sfrangia.
const SKY_VL_CHIARE = [
  { nome: 'Grande Nube del Sagittario',  l: 6,   b: -3.6, r: 7.5, forza: 0.78 },
  { nome: 'Piccola Nube del Sagittario', l: 13,  b: -1.6, r: 2.6, forza: 0.45 },
  { nome: 'Nube dello Scudo',            l: 27,  b: -0.6, r: 4.4, forza: 0.60 },
  { nome: "Nube dell'Aquila",            l: 45,  b: -1.2, r: 4.0, forza: 0.42 },
  { nome: 'Nube del Cigno',              l: 78,  b: 1.4,  r: 6.5, forza: 0.70 },
  { nome: 'Cassiopea',                   l: 118, b: -1.0, r: 4.5, forza: 0.50 },
  { nome: 'Perseo',                      l: 134, b: -2.0, r: 4.5, forza: 0.48 },
  { nome: 'Auriga',                      l: 174, b: 0.6,  r: 4.0, forza: 0.38 },
  { nome: 'Poppa',                       l: 245, b: -1.4, r: 5.0, forza: 0.34 },
  { nome: 'Vele',                        l: 266, b: -1.6, r: 5.0, forza: 0.46 },
  { nome: 'Carena',                      l: 287, b: -0.8, r: 5.4, forza: 0.62 },
  { nome: 'Croce del Sud',               l: 301, b: 0.4,  r: 4.5, forza: 0.46 },
  { nome: 'Centauro',                    l: 312, b: 0.2,  r: 4.5, forza: 0.44 },
  { nome: 'Regolo',                      l: 330, b: -0.6, r: 4.5, forza: 0.44 },
  { nome: 'Scorpione',                   l: 344, b: 1.2,  r: 4.0, forza: 0.40 }
];

// Le nubi scure che hanno un nome proprio e non stanno sulla Fenditura:
// quelle sì restano macchie, perché macchie sono. Il Sacco di Carbone è
// il buco più netto del cielo australe e si riconosce proprio per il suo
// bordo tondo.
const SKY_VL_SCURE = [
  { nome: 'Sacco di Carbone',      l: 303.2, b: -0.9,  r: 3.0, forza: 0.86 },
  { nome: 'Buco nel Centauro',     l: 316,   b: 0.6,   r: 2.8, forza: 0.46 },
  { nome: 'Polvere nel Regolo',    l: 337,   b: 1.4,   r: 3.0, forza: 0.44 },
  { nome: 'Nebulosa Pipa',         l: 357,   b: 7.0,   r: 3.2, forza: 0.70 },
  { nome: 'Rho Ofiuco',            l: 353.5, b: 16.0,  r: 4.4, forza: 0.44 },
  { nome: 'Polvere nel Cefeo',     l: 104,   b: 2.4,   r: 3.4, forza: 0.34 },
  { nome: 'Sacco di Carbone Nord', l: 78.5,  b: 0.4,   r: 1.7, forza: 0.52 },
  { nome: 'Nubi del Toro',         l: 172,   b: -14,   r: 6.5, forza: 0.26 },
  { nome: 'Fenditura di Perseo',   l: 158,   b: -20,   r: 5.0, forza: 0.18 }
];

// Ogni nube con un nome tocca una decina di gradi di longitudine e basta,
// ma il campo si costruisce chiedendo la densità cinquantamila volte, e
// cercarle tutte ogni volta è quasi tutto il tempo che ci vuole. Si
// dividono una volta sola in spicchi di dieci gradi: per un punto se ne
// guardano tre o quattro invece di trentasei.
const SKY_VL_SPICCHIO = 10;              // gradi di longitudine per spicchio
const SKY_VL_SPICCHI = 360 / SKY_VL_SPICCHIO;

function skyVLPerSpicchi(elenco) {
  const spicchi = [];
  for (let i = 0; i < SKY_VL_SPICCHI; i++) spicchi.push([]);
  elenco.forEach(n => {
    // Fin dove arriva: oltre i 2,6 raggi la gaussiana è sotto lo 0,1% e il
    // conto la salta. Il coseno della latitudine allarga quel raggio in
    // longitudine, e 0,85 è il caso peggiore (una nube sul piano guardata
    // da trenta gradi sopra).
    const arrivo = 2.6 * n.r / 0.85 + SKY_VL_SPICCHIO;
    const da = Math.floor((n.l - arrivo) / SKY_VL_SPICCHIO);
    const a = Math.ceil((n.l + arrivo) / SKY_VL_SPICCHIO);
    for (let k = da; k <= a; k++) spicchi[((k % SKY_VL_SPICCHI) + SKY_VL_SPICCHI) % SKY_VL_SPICCHI].push(n);
  });
  return spicchi;
}

const SKY_VL_CHIARE_SPICCHI = skyVLPerSpicchi(SKY_VL_CHIARE);
const SKY_VL_SCURE_SPICCHI = skyVLPerSpicchi(SKY_VL_SCURE);

// =====================================================================
// 3. LA POLVERE — la Fenditura, le nubi scure, la ragnatela; e la densità
// =====================================================================
// La Grande Fenditura è la cosa che più di ogni altra dice «Via Lattea
// vera» invece di «nastro disegnato»: settanta gradi di seguito in cui la
// banda è tagliata in due, dal Cigno al Sagittario. Prima era una fila di
// ventuno macchie tonde messe a mano, e si vedeva per quello che era —
// una collana.
//
// Adesso è una **spina**: una curva che nel Cigno corre quasi sul piano e
// salendo verso l'Ofiuco se ne stacca di sei gradi e mezzo (quella
// deviazione è il suo aspetto, non un difetto), con la posizione e la
// larghezza spostate dal rumore. Da lì viene la cosa che conta: i bordi
// sono **frastagliati**, e una nube di polvere si riconosce dai bordi.
//
// Larga com'è — quattro gradi di semiampiezza in Aquila — non spegne però
// la banda, che lì è larga il doppio: quello che si vede è esattamente
// quello che si vede in cielo, cioè due strisce chiare con in mezzo il
// nero.
const SKY_VL_FEND_DA = -14;   // gradi di longitudine: il capo in Ofiuco
const SKY_VL_FEND_A = 92;     // ...e quello nel Cigno

function skyVLFenditura(l, b, v) {
  let x = ((l % 360) + 360) % 360;
  if (x > 180) x -= 360;
  if (x < SKY_VL_FEND_DA || x > SKY_VL_FEND_A) return 0;
  const t = (SKY_VL_FEND_A - x) / (SKY_VL_FEND_A - SKY_VL_FEND_DA);   // 0 nel Cigno, 1 in Ofiuco

  const spina = 0.25 + 6.5 * Math.pow(t, 1.3)
    + 2.6 * (skyVLStira(skyVLTrama(v[0] * 7.5 + 11.3, v[1] * 7.5 - 4.7, v[2] * 7.5 + 2.9, 2, false), 2.6) - 0.5);
  const mezzo = 1.5 + 1.6 * Math.min(1, t * 2.2)
    + 2.4 * (skyVLStira(skyVLTrama(v[0] * 12 + 3.1, v[1] * 12 + 8.6, v[2] * 12 - 5.2, 2, false), 2.6) - 0.5);

  const s = (b - spina) / Math.max(0.7, mezzo);
  // I due capi si spengono: la fenditura comincia nel Cigno e si perde in
  // Ofiuco, non finisce di netto — un taglio secco si vedrebbe come tale
  const capi = Math.min(1, t * 6.5) * Math.min(1, (1 - t) * 5.5 + 0.35);
  return Math.max(0, 0.88 * Math.exp(-s * s * 1.35) * capi);
}

// Quanta luce lascia passare la polvere in quel punto: 1 tutta, 0 niente.
// Tre cose moltiplicate, perché tre veli sovrapposti si moltiplicano —
// sommarli darebbe estinzioni sopra al cento per cento, che vuol dire
// niente.
function skyVLPolvere(l, b, v, piano, semi) {
  let passa = 1 - skyVLFenditura(l, b, v);

  const spicchio = ((Math.floor(l / SKY_VL_SPICCHIO) % SKY_VL_SPICCHI) + SKY_VL_SPICCHI) % SKY_VL_SPICCHI;
  const scure = SKY_VL_SCURE_SPICCHI[spicchio];
  for (let i = 0; i < scure.length; i++) {
    const n = scure[i];
    const x = skyVLDistanza(l, b, n.l, n.b) / n.r;
    if (x < 2.6) passa *= 1 - n.forza * Math.exp(-x * x);
  }

  // La ragnatela. La polvere sta in uno strato molto più sottile di quello
  // delle stelle — è per questo che le venature si vedono *sulla* banda e
  // non attorno — e il rumore ruvido le dà la forma a fiume che hanno.
  const vicino = Math.exp(-Math.pow((b - piano) / (0.6 * semi), 2));
  const rete = skyVLTrama(v[0] * 13 + 5.5, v[1] * 13 - 2.2, v[2] * 13 + 9.1, 3, true);
  passa *= 1 - 0.62 * vicino * Math.max(0, rete - 0.52) / 0.48;

  return Math.max(0, passa);
}

// Quanta luce c'è in quel punto del cielo galattico. Il profilo verticale
// è una gaussiana con una coda: il nocciolo della banda è stretto, ma un
// alone tenue arriva molto più in alto — e senza la coda la banda ha un
// bordo, che è la cosa che non deve avere.
//
// Il versore si può passare da fuori: chi costruisce il campo lo ha già,
// e quarantaseimila radici quadrate in meno si sentono.
function skyVLDensita(l, b, v) {
  if (!v) v = skyVLVersore(l, b);
  const piano = skyVLPiano(l);
  const semi = skyVLSemiSpessore(l);
  const u = (b - piano) / semi;
  const profilo = 0.82 * Math.exp(-u * u * 1.7) + 0.18 * Math.exp(-Math.abs(u) * 1.15);
  let d = skyVLLuceGiro(l) * profilo;

  const spicchio = ((Math.floor(l / SKY_VL_SPICCHIO) % SKY_VL_SPICCHI) + SKY_VL_SPICCHI) % SKY_VL_SPICCHI;
  const chiare = SKY_VL_CHIARE_SPICCHI[spicchio];
  for (let i = 0; i < chiare.length; i++) {
    const n = chiare[i];
    const x = skyVLDistanza(l, b, n.l, n.b) / n.r;
    if (x < 2.6) d += n.forza * Math.exp(-x * x);
  }

  // Fuori dalla banda non c'è più niente da raccontare, e quello che
  // viene dopo è la parte cara: la trama, la Fenditura e la ragnatela
  // sono dieci giri di rumore a testa. La soglia è tre millesimi del
  // massimo, cioè un posto in cui il sorteggio non metterebbe comunque
  // nemmeno un fiocco su mille — e sotto di lei cadono più della metà
  // delle celle del campo, che è più della metà del tempo che ci vuole a
  // costruirlo. Va **dopo** le nubi con un nome: una di loro, alta sopra
  // al piano, dev'essere ancora capace di accendere una cella che il solo
  // profilo verticale avrebbe spento.
  if (d < 0.004) return 0;

  // La trama: le nubi stellari che un nome non ce l'hanno. Quattro ottave
  // allargate, media uno — moltiplica, non somma, perché dove non c'è
  // banda non deve comparire niente dal niente. Da 0,30 a 1,70: la stessa
  // longitudine, a due gradi di distanza, può essere il doppio più chiara,
  // ed è così che si comporta davvero.
  d *= 0.30 + 1.40 * skyVLStira(
    skyVLTrama(v[0] * 5.5 + 1.7, v[1] * 5.5 + 6.1, v[2] * 5.5 - 4.4, 4, false), 2.8);

  return Math.max(0, d * skyVLPolvere(l, b, v, piano, semi));
}

// =====================================================================
// 4. IL CAMPO — la densità misurata una volta, e come si pescano i fiocchi
// =====================================================================
// Il sorteggio di prima era per accettazione-rifiuto: si tirava un punto a
// caso, si chiedeva la densità, e quasi sempre si buttava via. Con un
// campo frattale la densità costa dieci volte di più, e buttarne via
// cinquanta su sessanta non è più un affare.
//
// Adesso la densità si misura una volta sola su una griglia e da lì esce
// una somma cumulata: pescare un fiocco è una ricerca binaria, e il costo
// non dipende più da quanti fiocchi si vogliono. Che è quello che permette
// di passare da milleseicento a cinquemilaseicento senza pagarli.
const SKY_VL_CELLE_L = 480;              // 0,75° di longitudine per cella
const SKY_VL_CELLE_B = 96;               // 0,64° di latitudine
const SKY_VL_B_MAX = 30.7;               // oltre, la banda non arriva
let skyVLGriglia = null;

function skyVLCampo() {
  const nl = SKY_VL_CELLE_L, nb = SKY_VL_CELLE_B;
  const passoL = 360 / nl, passoB = 2 * SKY_VL_B_MAX / nb;
  const d = new Float32Array(nl * nb);
  const cdf = new Float64Array(nl * nb);
  let somma = 0;
  for (let j = 0; j < nb; j++) {
    const b = -SKY_VL_B_MAX + (j + 0.5) * passoB;
    // Il coseno è l'area vera della cella: senza, i fiocchi si
    // affollerebbero verso i poli galattici, che è dove non c'è niente
    const cosB = Math.cos(b * SKY_D2R);
    for (let i = 0; i < nl; i++) {
      const l = (i + 0.5) * passoL;
      const val = skyVLDensita(l, b, skyVLVersore(l, b));
      d[j * nl + i] = val;
      somma += val * cosB;
      cdf[j * nl + i] = somma;
    }
  }
  return { nl, nb, passoL, passoB, d, cdf, somma };
}

function skyVLPesca(campo, caso) {
  const bersaglio = caso() * campo.somma;
  let lo = 0, hi = campo.cdf.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (campo.cdf[m] < bersaglio) lo = m + 1; else hi = m;
  }
  const i = lo % campo.nl, j = (lo / campo.nl) | 0;
  return {
    i, j,
    l: (i + caso()) * campo.passoL,
    b: -SKY_VL_B_MAX + (j + caso()) * campo.passoB,
    d: campo.d[lo]
  };
}

// Su che scala, in gradi, la densità cambia da queste parti. È il numero
// che tiene i bordi della Fenditura netti: un fiocco largo cinque gradi
// messo a un grado dal buio ci sborda dentro e lo cancella, e la banda
// torna a essere una campitura. Qui invece il fiocco si stringe da sé
// dove il campo è ripido — grande sulle spalle lisce dell'anticentro,
// piccolo lungo le venature. È la stessa cosa che si vede in cielo:
// il dettaglio sta dove c'è la polvere.
function skyVLScala(campo, i, j) {
  const nl = campo.nl, nb = campo.nb;
  const q = (a, c) => campo.d[c * nl + ((a % nl) + nl) % nl];
  const jm = Math.max(0, j - 1), jp = Math.min(nb - 1, j + 1);
  const b = -SKY_VL_B_MAX + (j + 0.5) * campo.passoB;
  const dl = (q(i + 1, j) - q(i - 1, j)) / (2 * campo.passoL * Math.max(0.2, Math.cos(b * SKY_D2R)));
  const db = (q(i, jp) - q(i, jm)) / Math.max(1, jp - jm) / campo.passoB;
  return campo.d[j * nl + i] / (Math.hypot(dl, db) + 1e-3);
}

// =====================================================================
// 5. IL COLORE — sei famiglie di sfumature e l'elenco piatto delle tele
// =====================================================================
// A occhio nudo la Via Lattea è grigia — la visione notturna il colore non
// ce l'ha. Ma questa è una figura, e in una figura il colore può dire una
// cosa vera: verso il centro la luce attraversa migliaia di anni luce di
// polvere e arriva arrossata, verso l'anticentro sono le giovani stelle
// azzurre dei bracci esterni. Il passaggio fra i quattro toni non è netto
// (c'è un rimescolamento nel sorteggio), se no si vedrebbe la cucitura.
const SKY_VL_TINTE = [
  [255, 226, 178],   // 0 — il rigonfiamento centrale, dorato dalla polvere
  [248, 231, 208],   // 1 — i bracci interni
  [214, 223, 246],   // 2 — il grosso della banda, perla
  [186, 203, 250],   // 3 — i bracci esterni, verso l'anticentro
  [255, 152, 170],   // 4 — l'idrogeno acceso: Laguna, Nord America, Carena
  [176, 236, 224]    // 5 — l'ossigeno: il Velo del Cigno
];

// Una fotografia non ha fiocchi di un colore piatto: il cuore delle nubi
// stellari tende al bianco caldo, la polvere lascia ai margini una tinta
// più fredda e meno satura. Ogni famiglia ha quindi tre fermate (cuore,
// corpo e bordo). Non si ricavano schiarendo meccanicamente un solo RGB:
// sono scelte separatamente, così il Sagittario passa davvero dall'avorio
// all'ambra, mentre Cigno e anticentro sfumano dal perla all'azzurro.
// `SKY_VL_TINTE` resta il colore del corpo e continua a essere l'indice
// stabile usato dai fiocchi; questa tabella aggiunge profondità alle tele.
const SKY_VL_SFUMATURE = [
  [[255, 249, 226], [255, 226, 178], [151, 105, 91]],
  [[255, 250, 235], [248, 231, 208], [155, 137, 151]],
  [[252, 249, 255], [214, 223, 246], [119, 137, 188]],
  [[240, 246, 255], [186, 203, 250], [91, 112, 181]],
  [[255, 232, 220], [255, 152, 170], [137, 72, 126]],
  [[235, 255, 247], [176, 236, 224], [72, 130, 155]]
];

// Le tele, in un elenco piatto: ogni fiocco si porta dietro il numero
// della sua e il disegno non deve decidere niente.
const SKY_VL_VARIANTI = 6;
const SKY_VL_TELA_VELO = 0;
const SKY_VL_TELA_NUBE = SKY_VL_TINTE.length;
const SKY_VL_TELA_GRANO = SKY_VL_TELA_NUBE + SKY_VL_TINTE.length * SKY_VL_VARIANTI;
const SKY_VL_TELA_NEBULOSA = SKY_VL_TELA_GRANO + SKY_VL_TINTE.length;

function skyVLTinta(l, caso) {
  const t = skyVLDalCentro(l) / 180 * 3.6 + (caso() - 0.5) * 1.1;
  return Math.max(0, Math.min(3, Math.round(t)));
}

// =====================================================================
// 6. LE TELE — quattro forme, sei tinte, sei varianti di grana
// =====================================================================
// Quattro forme, sei tinte, e per le nubi sei varianti di grana: in tutto
// cinquantaquattro immaginette, dipinte una volta sola.
//
// La grana sta **dentro** all'immagine, ed è tutto il senso del pezzo: un
// disco sfumato timbrato duemila volte fa una campitura liscia comunque lo
// si sfumi, mentre duemila timbri granulosi, di misura e variante diversa,
// fanno una trama che non si ripete. Il costo a fotogramma è identico —
// una `drawImage` è una `drawImage`.
//
// Si dipinge una maschera in bianco e nero per forma e la si **tinge** con
// un `destination-in`, invece di ridipingere il rumore per ogni tinta:
// cinquantaquattro giri di ImageData sarebbero cinquanta millisecondi,
// nove sono otto.
function skyVLMaschera(lato, forma) {
  const tela = document.createElement('canvas');
  tela.width = tela.height = lato;
  const c = tela.getContext('2d');
  const img = c.createImageData(lato, lato);
  const dati = img.data;
  const m = (lato - 1) / 2;
  for (let y = 0; y < lato; y++) {
    for (let x = 0; x < lato; x++) {
      const u = (x - m) / m, w = (y - m) / m;
      const a = forma(u, w, Math.sqrt(u * u + w * w));
      const k = (y * lato + x) * 4;
      dati[k] = dati[k + 1] = dati[k + 2] = 255;
      dati[k + 3] = a > 0 ? (a >= 1 ? 255 : (a * 255) | 0) : 0;
    }
  }
  c.putImageData(img, 0, 0);
  return tela;
}

function skyVLTinge(maschera, sfumatura) {
  const lato = maschera.width;
  const tela = document.createElement('canvas');
  tela.width = tela.height = lato;
  const c = tela.getContext('2d');
  const rgb = colore => 'rgb(' + colore[0] + ',' + colore[1] + ',' + colore[2] + ')';
  // Il centro appena decentrato evita l'impressione di una serie di
  // bersagli concentrici quando molte tele si sovrappongono. Il bordo è
  // abbastanza scuro da dare profondità ma non diventa mai un contorno:
  // è comunque ritagliato dalla lunga coda alfa della maschera.
  const g = c.createRadialGradient(lato * 0.43, lato * 0.40, lato * 0.03,
    lato * 0.50, lato * 0.50, lato * 0.70);
  g.addColorStop(0, rgb(sfumatura[0]));
  g.addColorStop(0.42, rgb(sfumatura[1]));
  g.addColorStop(1, rgb(sfumatura[2]));
  c.fillStyle = g;
  c.fillRect(0, 0, lato, lato);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(maschera, 0, 0);
  return tela;
}

let skyVLTele = null;

function skyTeleViaLattea() {
  if (skyVLTele) return skyVLTele;

  // Il velo: liscio per scelta. È lo strato che tiene insieme la banda, e
  // una grana su un fiocco largo sei gradi si vedrebbe per quello che è —
  // una texture ingrandita.
  const velo = skyVLMaschera(80, (u, w, d) => d >= 1 ? 0 : 0.92 * Math.pow(1 - d, 2.4));

  // Le nubi. La grana è tre ottave di rumore moltiplicate per la
  // sfumatura, più una spruzzata di punti quasi pieni: quelli sono le
  // stelle che dentro alla nube si separano, e sono la ragione per cui una
  // nube stellare fotografata non è mai una macchia uniforme.
  const nubi = [];
  for (let vari = 0; vari < SKY_VL_VARIANTI; vari++) {
    const s = 13.7 * vari + 2.3;
    nubi.push(skyVLMaschera(64, (u, w, d) => {
      if (d >= 1) return 0;
      const sfuma = Math.pow(1 - d, 1.9);
      const n = skyVLStira(0.52 * skyVLRumore(u * 4.2 + s, w * 4.2 - s, s)
        + 0.30 * skyVLRumore(u * 9.5 + s, w * 9.5 + s, s + 3.1)
        + 0.18 * skyVLRumore(u * 20.0 - s, w * 20.0 + s, s + 7.7), 3.0);
      let a = sfuma * (0.15 + 1.70 * n);
      if (skyVLRumore(u * 13 + s, w * 13 - s, s + 13.3) > 0.90) a += 0.62 * sfuma;
      return Math.min(1, a);
    }));
  }

  // Il grano: quasi un punto, con appena l'alone che gli toglie lo
  // spigolo. Disegnato spesso a un pixel e mezzo, non deve avere forma —
  // deve avere luce.
  const cadeA = Math.exp(-3.6);
  const grano = skyVLMaschera(14, (u, w, d) =>
    d >= 1 ? 0 : (Math.exp(-d * d * 3.6) - cadeA) / (1 - cadeA));

  // I grumi di idrogeno: nocciolo acceso e alone largo, con un filo di
  // grana. È il profilo di una nebulosa a emissione fotografata, che ha
  // sempre un cuore molto più brillante del suo bordo.
  const nebulosa = skyVLMaschera(48, (u, w, d) => {
    if (d >= 1) return 0;
    const n = skyVLRumore(u * 5.1 + 71, w * 5.1 - 33, 91);
    return Math.min(1, (0.58 * Math.exp(-d * d * 9) + 0.42 * Math.pow(1 - d, 2.2)) * (0.6 + 0.8 * n));
  });

  const lista = [];
  SKY_VL_SFUMATURE.forEach(c => lista.push(skyVLTinge(velo, c)));
  SKY_VL_SFUMATURE.forEach(c => nubi.forEach(m => lista.push(skyVLTinge(m, c))));
  SKY_VL_SFUMATURE.forEach(c => lista.push(skyVLTinge(grano, c)));
  SKY_VL_SFUMATURE.forEach(c => lista.push(skyVLTinge(nebulosa, c)));
  skyVLTele = lista;
  return skyVLTele;
}

// =====================================================================
// 7. I FIOCCHI — come nasce uno, e come si tara la luce di uno strato
// =====================================================================
// `rt` è la tangente della semiampiezza, calcolata qui una volta: nel
// ciclo di disegno una tangente per fiocco sarebbe cinquemila tangenti a
// fotogramma, e il raggio in pixel è `2 · focale · rt · scalaLocale`.
function skyVLFioccoEq(raGradi, dec, r, luce, tela, strato) {
  const ra = raGradi * SKY_D2R, dr = dec * SKY_D2R, cd = Math.cos(dr);
  return {
    v: [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dr)],
    vh: [0, 0, 0], alt: -90,
    r, rt: Math.tan(Math.max(0.01, r) * 0.5 * SKY_D2R),
    luce, tela, strato
  };
}

function skyVLFiocco(l, b, r, luce, tela, strato) {
  const p = skyGalatticoAEquatoriale(((l % 360) + 360) % 360, b);
  return skyVLFioccoEq(p.ra * 15, p.dec, r, luce, tela, strato);
}

// Quanta luce, in tutto, deve fare uno strato. Non si tara la luce di un
// fiocco: si tara la **somma**, e da lì si riscala. È la sola difesa
// contro il difetto in cui si cade cambiando il numero dei fiocchi — la
// banda si accende o si spegne, e ci si mette a rincorrere una costante
// che non è il problema. Il conto è `Σ luce·r²`, che è il flusso a meno di
// un fattore uguale per tutti (l'integrale del profilo della sprite).
const SKY_VL_LUCE = 320;

function skyVLNormalizza(fiocchi, obiettivo) {
  let s = 0;
  for (let i = 0; i < fiocchi.length; i++) s += fiocchi[i].luce * fiocchi[i].r * fiocchi[i].r;
  if (s <= 0) return;
  const k = obiettivo / s;
  for (let i = 0; i < fiocchi.length; i++) fiocchi[i].luce *= k;
}

// Quanti fiocchi per strato. Non è una manopola di gusto, è una manopola
// di costo: a campo largo il disegno di questo file è un timbro per
// fiocco, e su una tela senza acceleratore un timbro costa qualche
// microsecondo comunque sia grande. Misurato in un browser vero, a 180° di
// campo: cinquemilaseicento fiocchi sono quattro millesimi di secondo, che
// su un telefono diventano una fetta seria del fotogramma. Questi numeri
// sono il punto in cui la banda è ricca e il conto sta in piedi.
const SKY_VL_QUANTI_VELO = 260;
const SKY_VL_QUANTE_NUBI = 1700;
const SKY_VL_QUANTI_GRANI = 3200;

// Come si divide la luce fra i tre strati della banda. Il corpo si prende
// la metà buona — è lui a raccontare la forma — il velo quasi un terzo
// perché senza di lui la banda si sgrana, e i grani il resto: bastano,
// perché sono minuscoli e concentratissimi, e alzarli oltre fa passare il
// brulichio da «campo di stelle» a «rumore digitale».
const SKY_VL_QUOTE = { velo: 0.30, nubi: 0.54, grani: 0.16 };

// =====================================================================
// 8. LE NUBI DI MAGELLANO
// =====================================================================
// Due galassie satelliti, e dall'emisfero australe sono la cosa più bella
// del cielo: due batuffoli staccati, grandi come un pugno teso, che a chi
// li vede la prima volta sembrano nuvole vere — finché non si accorge che
// non si muovono. Qui non c'erano affatto, ed era la mancanza più grossa
// di questa vista da quando il planetario si può spostare in Tasmania.
//
// Si sorteggiano nel piano tangente attorno al loro centro, in gradi di
// est e di nord, e da lì si passa a coordinate equatoriali: è il modo di
// dire una posizione e un'inclinazione senza doverle portare avanti e
// indietro fra due sistemi. `pa` è l'angolo di posizione della barra,
// contato dal nord verso est come si conta sempre.
const SKY_VL_MAGELLANO = [
  { nome: 'Grande Nube di Magellano', ra: 80.894, dec: -69.756,
    a: 3.1, b: 2.2, pa: 125, quanti: 320, barra: 0.42, luce: 5.0, alone: 3.4 },
  { nome: 'Piccola Nube di Magellano', ra: 13.187, dec: -72.829,
    a: 1.75, b: 0.95, pa: 45, quanti: 160, barra: 0.38, luce: 1.15, alone: 2.0 }
];

function skyVLGeneraMagellano(caso) {
  const fuori = [];
  SKY_VL_MAGELLANO.forEach(g => {
    const t = g.pa * SKY_D2R, st = Math.sin(t), ct = Math.cos(t);
    const miei = [];
    // L'alone che le tiene insieme: senza, da lontano sono una spruzzata
    // di puntini invece che un batuffolo
    miei.push(skyVLFioccoEq(g.ra, g.dec, g.alone, 1.2, SKY_VL_TELA_VELO + 2, 3));
    for (let i = 0; i < g.quanti; i++) {
      let x, y, rr;
      do {
        x = caso() * 2 - 1; y = caso() * 2 - 1; rr = x * x + y * y;
      } while (rr > 1 || caso() > Math.exp(-2.0 * rr));
      // La barra: quel terzo di stelle schiacciate sull'asse maggiore che
      // dà alla Grande Nube la sua forma da girino
      if (caso() < g.barra) y *= 0.26;
      const m = x * g.a, n = y * g.b;
      const est = m * st + n * ct, nord = m * ct - n * st;
      const r = 0.07 + 0.5 * Math.pow(caso(), 2.2);
      const grosso = r > 0.22;
      miei.push(skyVLFioccoEq(
        g.ra + est / Math.max(0.05, Math.cos(g.dec * SKY_D2R)), g.dec + nord,
        r, 0.35 + 1.3 * Math.pow(caso(), 1.6),
        grosso ? SKY_VL_TELA_NUBE + 2 * SKY_VL_VARIANTI + (i % SKY_VL_VARIANTI)
               : SKY_VL_TELA_GRANO + 2,
        3));
    }
    skyVLNormalizza(miei, g.luce);
    miei.forEach(f => fuori.push(f));
  });
  // La Tarantola, l'unica nebulosa di un'altra galassia che si veda a
  // occhio nudo: sta nella Grande Nube, un grado e mezzo dal suo centro
  fuori.push(skyVLFioccoEq(84.68, -69.10, 0.42, 0.22, SKY_VL_TELA_NEBULOSA + 4, 3));
  return fuori;
}

// =====================================================================
// 9. I GRUMI DI IDROGENO ACCESO
// =====================================================================
// Sono i pochi punti in cui quel grigio ha un colore vero, e sono anche i
// posti dove uno *va* a guardare: per questo stanno nello strato che non
// si spegne ingrandendo. Le misure sono quelle vere, e per questo la
// Nebulosa Gum è enorme e quasi invisibile mentre la Laguna è piccola e
// si vede.
const SKY_VL_NEBULOSE = [
  { nome: 'Laguna',              l: 6.0,   b: -1.2,  r: 0.55, luce: 1.00, tinta: 4 },
  { nome: 'Trifida',             l: 7.0,   b: -0.3,  r: 0.30, luce: 0.55, tinta: 4 },
  { nome: 'Omega',               l: 15.1,  b: -0.7,  r: 0.32, luce: 0.62, tinta: 4 },
  { nome: 'Aquila',              l: 17.0,  b: 0.8,   r: 0.30, luce: 0.42, tinta: 4 },
  { nome: 'Gamma Cygni',         l: 78.2,  b: 2.0,   r: 1.30, luce: 0.40, tinta: 4 },
  { nome: 'Velo del Cigno',      l: 73.3,  b: -7.6,  r: 1.40, luce: 0.26, tinta: 5 },
  { nome: 'Nord America',        l: 85.6,  b: -0.7,  r: 0.95, luce: 0.66, tinta: 4 },
  { nome: 'Cuore e Anima',       l: 134.5, b: 0.9,   r: 1.10, luce: 0.28, tinta: 4 },
  { nome: 'California',          l: 160.2, b: -12.4, r: 1.10, luce: 0.26, tinta: 4 },
  { nome: 'Rosetta',             l: 206.3, b: -2.1,  r: 0.62, luce: 0.34, tinta: 4 },
  { nome: 'Anello di Barnard',   l: 206.5, b: -17.5, r: 4.6,  luce: 0.09, tinta: 4 },
  { nome: 'Orione',              l: 209.0, b: -19.4, r: 0.52, luce: 0.90, tinta: 4 },
  { nome: 'Nebulosa Gum',        l: 258.0, b: -2.0,  r: 9.0,  luce: 0.05, tinta: 4 },
  { nome: 'Eta Carinae',         l: 287.7, b: -0.8,  r: 1.05, luce: 0.95, tinta: 4 },
  { nome: 'Lambda Centauri',     l: 294.5, b: -1.2,  r: 0.66, luce: 0.32, tinta: 4 }
];
const SKY_VL_NEB_LUCE = 0.09;

// =====================================================================
// 10. IL SORTEGGIO — i quattro strati, una volta sola
// =====================================================================
// Si fa una volta sola, ma **non all'avvio**: chi apre l'app per sapere
// che tempo fa stasera non deve pagarlo. Si fa la prima volta che il
// planetario chiede le nubi, dentro a `skyNubiDelCielo()`, e dal seme
// fisso — la Via Lattea di stasera dev'essere la stessa di ieri sera.
function skyGeneraViaLattea() {
  const caso = skyCaso(skySeme('via lattea v2'));
  const campo = skyVLCampo();
  const nubi = [];

  // 0 — il velo. Fiocchi larghi e lisci, che si stringono dove il campo è
  // ripido: è quello che tiene la Fenditura nera invece di velarla.
  const velo = [];
  for (let i = 0; i < SKY_VL_QUANTI_VELO; i++) {
    const p = skyVLPesca(campo, caso);
    const semi = skyVLSemiSpessore(p.l);
    const scala = skyVLScala(campo, p.i, p.j);
    const r = Math.min((2.0 + 3.8 * Math.pow(caso(), 1.3)) * (0.72 + 0.032 * semi),
      1.4 * scala + 1.6);
    // La luce di un fiocco **non** dipende da quanto è luminoso il cielo
    // lì: vedi la nota qui sotto, in fondo al sorteggio. Cala solo con la
    // misura, se no i pochi grandi si prenderebbero tutta la scena.
    velo.push(skyVLFiocco(p.l, p.b, r, 1 / (0.5 + r), SKY_VL_TELA_VELO + skyVLTinta(p.l, caso), 0));
  }
  skyVLNormalizza(velo, SKY_VL_LUCE * SKY_VL_QUOTE.velo);

  // 1 — le nubi. La luce si rimisura sul posto esatto invece di leggerla
  // dalla griglia: la griglia ha tre quarti di grado di passo, e il bordo
  // della Fenditura è più stretto di così. Le posizioni possono essere
  // approssimate, la luce no — è lei che si vede.
  const corpo = [];
  for (let i = 0; i < SKY_VL_QUANTE_NUBI; i++) {
    const p = skyVLPesca(campo, caso);
    const semi = skyVLSemiSpessore(p.l);
    const scala = skyVLScala(campo, p.i, p.j);
    const r = Math.min((0.42 + 2.2 * Math.pow(caso(), 2.0)) * (0.72 + 0.032 * semi),
      0.7 * scala + 0.3);
    // Il **rapporto** fra la densità qui e quella media della cella, non la
    // densità: la cella è larga tre quarti di grado e il bordo della
    // Fenditura è più stretto di così, quindi questo numero racconta la
    // struttura *dentro* alla cella — che il sorteggio, da solo, non può
    // vedere — e non ripete quella fuori, che il sorteggio ha già detto
    // mettendo i fiocchi dove vanno.
    const rapporto = Math.max(0.15, Math.min(2.4, skyVLDensita(p.l, p.b) / Math.max(1e-3, p.d)));
    const luce = rapporto / (0.6 + r);
    corpo.push(skyVLFiocco(p.l, p.b, r, luce,
      SKY_VL_TELA_NUBE + skyVLTinta(p.l, caso) * SKY_VL_VARIANTI + (i % SKY_VL_VARIANTI), 1));
  }
  skyVLNormalizza(corpo, SKY_VL_LUCE * SKY_VL_QUOTE.nubi);

  // 2 — i grani. Sono tutti quasi uguali di luce, e a cambiare è quanti ce
  // ne sono: è così che funziona un campo di stelle che l'occhio non
  // separa — la nube non è più *chiara*, è più *fitta*. Qualcuno più
  // brillante degli altri ci vuole, se no si legge come rumore digitale.
  const grani = [];
  for (let i = 0; i < SKY_VL_QUANTI_GRANI; i++) {
    const p = skyVLPesca(campo, caso);
    const r = 0.085 + 0.17 * Math.pow(caso(), 2.0);
    grani.push(skyVLFiocco(p.l, p.b, r, 0.35 + 1.5 * Math.pow(caso(), 2.4),
      SKY_VL_TELA_GRANO + skyVLTinta(p.l, caso), 2));
  }
  skyVLNormalizza(grani, SKY_VL_LUCE * SKY_VL_QUOTE.grani);

  // Perché la luce di un fiocco non dipende da quanto è luminosa la banda
  // lì — che è la cosa che verrebbe in mente per prima, e che è sbagliata.
  //
  // I fiocchi si pescano **già** dalla densità: dove la banda è il doppio
  // più chiara ce ne finisce il doppio. Se poi ognuno fosse anche il
  // doppio più luminoso, quello che si disegna andrebbe come il
  // **quadrato** della densità, e cinque volte diventerebbero venticinque.
  // Non è una sottigliezza: era il difetto che rendeva invisibile tutto il
  // tratto dal Cigno a Cassiopea, cioè metà della Via Lattea che si vede
  // d'estate dall'emisfero nord. Sullo schermo non si legge come un errore
  // di conto — si legge come «la Via Lattea è solo in Sagittario», che è
  // una frase che nessuno mette in dubbio guardando una figura.
  //
  // La densità entra una volta sola, e entra dal **dove**.

  velo.forEach(f => nubi.push(f));
  corpo.forEach(f => nubi.push(f));
  skyVLGeneraMagellano(caso).forEach(f => nubi.push(f));
  SKY_VL_NEBULOSE.forEach(n => nubi.push(
    skyVLFiocco(n.l, n.b, n.r, n.luce * SKY_VL_NEB_LUCE, SKY_VL_TELA_NEBULOSA + n.tinta, 3)));
  // I grani stanno in fondo di proposito: sono l'unico strato che su un
  // telefono si dirada, e diradare vuol dire saltare uno su tre — cosa che
  // si può fare con un modulo solo se lo strato è un tratto contiguo
  grani.forEach(f => nubi.push(f));

  return nubi;
}

// =====================================================================
// 11. NEL CIELO DI ADESSO
// =====================================================================

// Le nubi portate nel cielo di adesso. Sono cinquemilaseicento: gli oggetti si
// costruiscono una volta e a ogni aggiornamento si riscrivono soltanto il
// versore orizzontale e l'altezza, dentro agli stessi oggetti. Chi le
// calcola è catalogo.js quando il catalogo è caricato (stessa matrice
// delle stelle, quindi stessa precessione); qui c'è la strada di riserva
// per i primi secondi, quando il catalogo non c'è ancora.
let skyVLCielo = null;

function skyNubiDelCielo() {
  if (!skyVLCielo) {
    skyVLCielo = skyGeneraViaLattea();
    skyVLGriglia = null;                   // la griglia serviva solo al sorteggio
  }
  return skyVLCielo;
}

// Una matrice sola per tutte le nubi, come fa catalogo.js per le stelle:
// cinquemila e passa chiamate a Horizon() a ogni aggiornamento sarebbero il conto
// più caro della vista, e per un fondo sfocato non ha senso.
function skyPortaViaLatteaInCielo(t) {
  if (!sky.observer || typeof Astronomy === 'undefined') { sky.viaLattea = []; return; }
  let M;
  try {
    M = Astronomy.CombineRotation(
      Astronomy.Rotation_EQJ_EQD(t),
      Astronomy.Rotation_EQD_HOR(t, sky.observer)
    ).rot;
  } catch (e) {
    sky.viaLattea = [];                    // data fuori scala: si lascia stare
    return;
  }
  // Stessa avvertenza di catalogo.js: `rot` è memorizzata [sorgente][destinazione],
  // e la terna della libreria è (Nord, Ovest, Zenit) — Est = −Ovest.
  const nx = M[0][0], ny = M[1][0], nz = M[2][0];
  const ox = M[0][1], oy = M[1][1], oz = M[2][1];
  const zx = M[0][2], zy = M[1][2], zz = M[2][2];

  const nubi = skyNubiDelCielo();
  for (let i = 0; i < nubi.length; i++) {
    const n = nubi[i], x = n.v[0], y = n.v[1], z = n.v[2];
    const alto = zx * x + zy * y + zz * z;
    n.vh[0] = -(ox * x + oy * y + oz * z);
    n.vh[1] =   nx * x + ny * y + nz * z;
    n.vh[2] =   alto;
    n.alt = Math.asin(Math.max(-1, Math.min(1, alto))) * SKY_R2D;
  }
  sky.viaLattea = nubi;
}

// =====================================================================
// 12. IL DISEGNO — quanto se ne vede da qui, e come si timbra
// =====================================================================

// Quanto della Via Lattea arriva davvero all'occhio da qui. È la parte che
// per molto tempo mancava del tutto: la banda è la prima cosa che il cielo
// perde. Da un cielo di città non c'è, con la Luna piena alta nemmeno, e
// disegnarla lo stesso è la bugia più grossa che questa vista possa
// raccontare a chi la cerca poi fuori dalla finestra.
const SKY_VL_PER_CIELO = { 2: 1, 3: 0.88, 4: 0.70, 5: 0.52, 6: 0.30, 8: 0.12 };
// E la stessa domanda per Magellano e per i grumi di idrogeno, che sono
// un'altra cosa: la Grande Nube si vede anche da un cielo mediocre —
// è una macchia concentrata, non un velo largo mezzo cielo — e Orione la
// vedono anche dai balconi di città.
const SKY_VL_OGG_PER_CIELO = { 2: 1, 3: 0.95, 4: 0.86, 5: 0.72, 6: 0.55, 8: 0.32 };
// Il rubinetto generale. Uno vuol dire «la stessa luce di prima»: il
// bilancio qui sopra è tarato sul disegno vecchio, fiocco per fiocco. Un
// filo di più ci sta, perché la luce adesso non è più spalmata liscia —
// sta nella grana e nel contrasto, e a parità di flusso quella si legge
// più chiara.
const SKY_VL_ALFA = 1.45;

function skyForzaViaLattea(luna, oggetti) {
  // Atmosfera spenta: è una carta stellare, e su una carta la banda si
  // disegna per intero
  if (!sky.atmosfera) return 1;

  const scala = oggetti ? SKY_VL_OGG_PER_CIELO : SKY_VL_PER_CIELO;
  let k = oggetti ? 0.8 : 0.42;
  if (typeof cieloDiCasa === 'function') {
    try { k = scala[cieloDiCasa()] || k; } catch (e) { /* niente storage */ }
  }

  // La Luna: piena e alta cancella la banda come un lampione. Conta la
  // fase più che proporzionalmente (un primo quarto illumina un quarto di
  // quanto illumina la piena, non la metà) e conta quanto è alta.
  if (luna && luna.alt > -2) {
    const fase = typeof luna.frazione === 'number' ? luna.frazione : 1;
    const quanta = Math.pow(fase, 1.7) * Math.min(1, (luna.alt + 2) / 32);
    k *= 1 - (oggetti ? 0.62 : 0.88) * Math.max(0, quanta);
  }

  // Ingrandendo, quella che a occhio nudo è una nuvola diventa un campo di
  // stelle, e il catalogo qui sotto ce le mette davvero: la banda si fa da
  // parte invece di restare una macchia sfocata sopra le stelle. Gli
  // oggetti no: quelli ingrandendo si guardano meglio.
  const fov = sky.fov || 55;
  if (!oggetti && fov < 14) k *= Math.max(0.35, (fov - 1.2) / 14);

  return Math.max(0, k);
}

// Sotto questa misura in pixel un fiocco non si disegna: costerebbe una
// `drawImage` per niente. Una soglia per strato, perché un velo da due
// pixel è invisibile mentre un grano da due pixel *è* il disegno.
const SKY_VL_MIN_PX = [2.2, 0.85, 0.7, 0.55];
// E sotto questa si disegna comunque, ma alla misura minima e con la luce
// scalata come l'area che gli si è tolta: se no, mentre si allarga il
// campo, i grani si spengono uno per volta invece di fondersi nella banda
// — e quello che si vede è uno sfarfallio.
const SKY_VL_MIN_DISEGNO = 0.9;
// Il fiocco più largo che ci sia: la Nebulosa Gum, che è nove gradi di
// raggio. È il margine da lasciare al cono della vista, se no un oggetto
// che comincia appena fuori dal bordo si spegne di colpo entrando.
const SKY_VL_MARGINE_CONO = 10;
// Il campo visivo oltre il quale i grani cominciano a spegnersi (e
// ventisei gradi più in là non ce n'è più nessuno)
const SKY_VL_GRANI_FOV = 62;

function skyDisegnaViaLattea(ctx, base, focale, luna) {
  const nubi = sky.viaLattea;
  if (!nubi || !nubi.length) return;
  const velo = skyVelo();
  if (velo < 0.08) return;               // di giorno non c'è niente da mostrare

  const fBanda = skyForzaViaLattea(luna, false) * velo * SKY_VL_ALFA;
  const fOgg = skyForzaViaLattea(luna, true) * velo * SKY_VL_ALFA;
  if (fBanda < 0.002 && fOgg < 0.002) return;

  // I grani sono un dettaglio del primo piano. Allargando il campo un
  // puntino scende sotto il pixel, e quello che si vede non è più
  // brulichio: è rumore. Si spengono sopra gli ottanta gradi di campo — e
  // spegnendosi smettono anche di **costare**, che lì sono più della metà
  // dei timbri del fotogramma. Sopra gli ottantotto gradi non ce n'è più
  // nessuno, ed è dove un grano varrebbe comunque meno di un pixel.
  //
  // La luce che smettono di portare passa alle nubi, e non è pignoleria:
  // il bilancio di questo file è una somma fissa, e lasciarne cadere un
  // sesto vorrebbe dire una banda che si spegne mentre ci si allarga. Quel
  // difetto si vede benissimo e si capisce malissimo — sembra che il cielo
  // si scurisca da solo.
  const fov = sky.fov || 55;
  const svaniti = fov > SKY_VL_GRANI_FOV ? Math.max(0, 1 - (fov - SKY_VL_GRANI_FOV) / 26) : 1;
  const fGrani = fBanda * svaniti;
  const fNubi = fBanda * (1 + (SKY_VL_QUOTE.grani / SKY_VL_QUOTE.nubi) * (1 - svaniti));
  const forze = [fBanda, fNubi, fGrani, fOgg];

  // Sul telefono si dirada il solo strato dei grani — uno su tre, con il
  // triplo della luce ciascuno: la banda resta della stessa luminosità e
  // il riempimento cala di due terzi. Gli altri strati no: diradare il
  // velo vuol dire buchi, e diradare Magellano vuol dire spelacchiarla.
  const passi = sky.larghezza < 560 ? [1, 1, 3, 1] : [1, 1, 1, 1];
  const tele = skyTeleViaLattea();
  const L = sky.larghezza, H = sky.altezza;
  const cx = L / 2, cy = H / 2;

  // Il cono della vista, con dentro un margine largo quanto il fiocco più
  // grande. Accorgersi che un fiocco è dietro le spalle costa così **un
  // prodotto scalare** invece di una proiezione intera, e a campo stretto
  // sono nove fiocchi su dieci: la Via Lattea è cinquemila e passa oggetti, e
  // proiettarli tutti per scartarne il novanta per cento era il conto più
  // caro di questo file.
  const angoloCorner = 2 * Math.atan(Math.hypot(L, H) / (4 * focale));
  const dLimite = Math.max(SKY_D_MIN,
    Math.cos(Math.min(Math.PI, angoloCorner + SKY_VL_MARGINE_CONO * SKY_D2R)));

  // La proiezione srotolata, come in catalogo.js: `skyProietta` costruisce
  // un oggetto per chiamata, e cinquemila oggetti a fotogramma sono lavoro
  // per il raccoglitore di rifiuti, non per il disegno.
  const fx = base.f[0], fy = base.f[1], fz = base.f[2];
  const rx = base.r[0], ry = base.r[1], rz = base.r[2];
  const ux = base.u[0], uy = base.u[1], uz = base.u[2];

  ctx.save();
  // La Via Lattea è luce che si somma al cielo, non vernice che lo copre:
  // le stelle si devono vedere attraverso, ed è quello che fa `lighter`.
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < nubi.length; i++) {
    const n = nubi[i];
    if (n.alt < -8) continue;            // sotto l'orizzonte la copre il terreno
    const passo = passi[n.strato];
    if (passo > 1 && (i % passo)) continue;

    const vx = n.vh[0], vy = n.vh[1], vz = n.vh[2];
    const d = fx * vx + fy * vy + fz * vz;
    if (d < dLimite) continue;
    const den = (1 + d) * 0.5;
    const px = cx + focale * ((rx * vx + ry * vy + rz * vz) / den);
    const py = cy - focale * ((ux * vx + uy * vy + uz * vz) / den);

    let r = 2 * focale * n.rt * (2 / Math.max(0.01, 1 + d));
    if (r < SKY_VL_MIN_PX[n.strato]) continue;
    if (px + r < 0 || px - r > L || py + r < 0 || py - r > H) continue;

    let a = n.luce * forze[n.strato] * passo * skyEstinzione(n.alt);
    if (r < SKY_VL_MIN_DISEGNO) {
      const q = r / SKY_VL_MIN_DISEGNO;
      a *= q * q;
      r = SKY_VL_MIN_DISEGNO;
    }
    // Sotto questa opacità la tela non riceve più niente: il fondo ha
    // otto bit per canale, e 0,002 di un colore chiaro fa mezzo livello su
    // 255 — cioè zero. Tosarla più in alto però costa caro dove serve di
    // più: metà dei fiocchi del velo vive proprio lì, e sono loro a fare
    // l'alone che tiene insieme la banda.
    if (a < 0.0022) continue;

    ctx.globalAlpha = a < 0.6 ? a : 0.6;
    ctx.drawImage(tele[n.tela], px - r, py - r, r * 2, r * 2);
  }
  ctx.restore();
}
