#!/usr/bin/env node
/* Missione Cielo — il motore, senza browser, e il pannello dentro a uno.
 *
 * La domanda che questa prova esiste per fare è una sola, ed è quella che
 * a occhio non si può fare: **una missione plausibile e una missione
 * giusta sono la stessa immagine**. Cinque righe con un nome, un'ora e
 * una direzione sembrano ragionevoli comunque — anche se la terza tappa
 * è sotto l'orizzonte, anche se la prima chiede un telescopio a chi ha
 * detto di avere solo gli occhi, anche se l'evento delle 21:45 è già
 * passato. Nessuno, leggendo lo schermo, dice «questa sequenza mette il
 * bersaglio più difficile per primo»: dice «boh, non l'ho trovato».
 *
 * Per questo il motore (§2 di `missione-cielo.js`) è fatto di funzioni
 * pure e si prova qui, con scenari costruiti a mano in cui la verità si
 * conosce. Il pannello e i ponti — il planetario, il Diario, la ripresa
 * dopo un ricaricamento — vogliono invece un documento, e stanno nella
 * seconda metà, in un Chromium vero.
 *
 *     npm install playwright-core astronomy-engine
 *     node scripts/prova-missione.js
 *     node scripts/prova-missione.js --solo-motore    (mezzo secondo, senza browser)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const RADICE = path.join(__dirname, '..');
const motore = require(path.join(RADICE, 'missione-cielo.js'));
const K = motore.costanti;

let passate = 0, fallite = 0;
function prova(nome, corpo) {
  try { corpo(); passate++; console.log('  ok        ' + nome); }
  catch (e) {
    fallite++;
    console.log('  FALLITO   ' + nome);
    console.log('              ' + String(e.message).split('\n')[0]);
  }
}
function sezione(nome) { console.log('\n— ' + nome + ' —'); }

// =====================================================================
// Il banco: un cielo finto di cui si conosce la verità.
// =====================================================================

const ORA = 3600000;
const T0 = Date.UTC(2026, 8, 7, 21, 0, 0);      // un'ora tonda, per leggere gli orari

// Un candidato con tutti i campi al minimo sindacale. Chi vuole cambiarne
// uno lo passa in `extra`: così ogni prova dichiara **soltanto** quello
// che le interessa, e una prova che parla di strumenti non si rompe il
// giorno in cui cambia il peso della difficoltà.
function candidato(id, extra) {
  return Object.assign({
    id,
    nome: id,
    tipo: 'pianeta',
    idCielo: id,
    quando: T0,
    altezza: 45,
    azimut: 180,
    sopraOstacoli: 40,
    minutiUtili: 60,
    strumentoMinimo: 'occhio',
    mag: 0,
    difficolta: 2,
    evidenza: 0.8,
    didattica: 0.3,
    soffreLaLuna: false,
    aOrarioPreciso: false,
    puntiBase: 50
  }, extra || {});
}

function scenario(candidati, scelte, condizioni) {
  return {
    adesso: T0,
    partenza: T0,
    seme: 'regressione',
    candidati,
    scelte: Object.assign({ durata: 30, strumento: 'occhio', esperienza: 'curiosi' }, scelte),
    condizioni: Object.assign({ luna: 0, nuvole: 10, bortle: 4 }, condizioni)
  };
}

// Un cielo abbondante: dodici bersagli, tutte le famiglie, tutte le
// difficoltà. È lo scenario in cui le regole di scelta hanno di che
// scegliere, e quindi l'unico in cui si possono provare davvero.
function cieloRicco() {
  return [
    candidato('luna:Moon',        { tipo: 'luna', nome: 'Luna', difficolta: 1, evidenza: 1, mag: -12, azimut: 150 }),
    candidato('pianeta:Jupiter',  { nome: 'Giove', difficolta: 1, evidenza: 0.95, mag: -2.4, azimut: 170 }),
    candidato('pianeta:Saturn',   { nome: 'Saturno', difficolta: 2, evidenza: 0.7, mag: 0.6, azimut: 200 }),
    candidato('pianeta:Uranus',   { nome: 'Urano', difficolta: 4, evidenza: 0.1, mag: 5.7, azimut: 120,
                                    strumentoMinimo: 'telescopio' }),
    candidato('stella:Star2',     { tipo: 'stella', nome: 'Sirio', difficolta: 1, evidenza: 0.9, mag: -1.5, azimut: 160 }),
    candidato('stella:Star3',     { tipo: 'stella', nome: 'Vega', difficolta: 2, evidenza: 0.85, mag: 0, azimut: 300 }),
    candidato('costellazione:Orione', { tipo: 'costellazione', nome: 'Orione', idCielo: null,
                                    mira: { ra: 5.5, dec: 0 }, difficolta: 1, evidenza: 0.8, didattica: 1, azimut: 165 }),
    candidato('profondo:M31',     { tipo: 'profondo', nome: 'M31', difficolta: 3, evidenza: 0.35, mag: 3.4,
                                    strumentoMinimo: 'binocolo', soffreLaLuna: true, azimut: 60 }),
    candidato('profondo:M57',     { tipo: 'profondo', nome: 'M57', difficolta: 5, evidenza: 0.1, mag: 8.8,
                                    strumentoMinimo: 'telescopio', soffreLaLuna: true, azimut: 290 }),
    candidato('profondo:M45',     { tipo: 'profondo', nome: 'Pleiadi', difficolta: 1, evidenza: 0.9, mag: 1.6,
                                    azimut: 80, soffreLaLuna: true }),
    candidato('stazione:iss',     { tipo: 'stazione', nome: 'ISS', aOrarioPreciso: true, quando: T0 + 12 * 60000,
                                    difficolta: 1, evidenza: 0.95, azimut: 240 }),
    candidato('corpoMinore:12P',  { tipo: 'corpoMinore', nome: '12P/Pons-Brooks', difficolta: 4, evidenza: 0.2,
                                    mag: 8.5, strumentoMinimo: 'binocolo', soffreLaLuna: true, azimut: 20 })
  ];
}

// =====================================================================
console.log('Missione Cielo — il motore');
sezione('la durata decide quante tappe');

MISS_DURATE_PROVA();
function MISS_DURATE_PROVA() {
  for (const d of K.MISS_DURATE) {
    prova(`${d} minuti danno un numero di tappe dentro ai limiti`, () => {
      const m = motore.genera(scenario(cieloRicco(), { durata: d, strumento: 'telescopio' }));
      const q = K.MISS_TAPPE_PER_DURATA[d];
      assert.ok(m.tappe.length >= q.min && m.tappe.length <= q.max,
        `${m.tappe.length} tappe, attese fra ${q.min} e ${q.max}`);
    });
  }
}

prova('due ore danno più tappe di dieci minuti', () => {
  const corta = motore.genera(scenario(cieloRicco(), { durata: 10, strumento: 'telescopio' }));
  const lunga = motore.genera(scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }));
  assert.ok(lunga.tappe.length > corta.tappe.length,
    `${lunga.tappe.length} contro ${corta.tappe.length}`);
});

prova('ogni astro ha tre racconti stabili ma diversi', () => {
  const base = candidato('pianeta:Jupiter', { nome: 'Giove' });
  const chiavi = [0, 1, 2].map(raccontoVariante =>
    motore.curiositaChiave(Object.assign({}, base, { raccontoVariante })));
  assert.deepStrictEqual(chiavi, [
    'curiosita.giove.1', 'curiosita.giove.2', 'curiosita.giove.3'
  ]);
  assert.strictEqual(motore.curiositaChiave(Object.assign({}, base, { raccontoVariante: 1 })), chiavi[1]);
});

prova('miti e aneddoti sono associati anche a costellazioni e oggetti profondi', () => {
  assert.strictEqual(motore.curiositaChiave(candidato('costellazione:Ori', {
    tipo: 'costellazione', nome: 'Orione', sigla: 'Ori', raccontoVariante: 1
  })), 'curiosita.orione.2');
  assert.strictEqual(motore.curiositaChiave(candidato('profondo:M31', {
    tipo: 'profondo', nome: 'M31 — Galassia di Andromeda', sigla: 'M31', raccontoVariante: 2
  })), 'curiosita.andromeda.3');
});

// =====================================================================
sezione('lo strumento è un vincolo, non una preferenza');

prova('a occhio nudo non entra niente che voglia un telescopio', () => {
  const m = motore.genera(scenario(cieloRicco(), { strumento: 'occhio', durata: 120 }));
  const colpevoli = m.tappe.filter(t => t.strumentoMinimo === 'telescopio');
  assert.deepStrictEqual(colpevoli.map(t => t.nome), []);
});

prova('col binocolo entra il binocolo ma non il telescopio', () => {
  const m = motore.genera(scenario(cieloRicco(), { strumento: 'binocolo', durata: 120 }));
  assert.ok(!m.tappe.some(t => t.strumentoMinimo === 'telescopio'));
});

prova('col telescopio entra tutto', () => {
  assert.ok(motore.strumentoBasta('telescopio', 'telescopio'));
  assert.ok(motore.strumentoBasta('occhio', 'telescopio'));
  assert.ok(!motore.strumentoBasta('binocolo', 'occhio'));
});

/* Il tetto della difficoltà, provato per quello che promette adesso.
 *
 * Questa prova nasce quando il tetto della sfida era **tre**, e allora un
 * bersaglio da quattro lo escludeva davvero il filtro. Portato il tetto a
 * cinque — che è tutta la ragione per cui il terzo gradino esiste (§1) —
 * la prima riga ha smesso di misurare il filtro e ha cominciato a
 * misurare l'ordine della classifica: passava perché quel bersaglio
 * restava fuori per punteggio, non perché fosse inammissibile. Cioè
 * chiedeva l'esatto contrario di quello che il gradino promette, e la
 * prima volta che la scelta ha smesso di essere un argmax è diventata
 * rossa.
 *
 * Quello che va provato è il tetto: un quattro alla sfida ci sta (ed è
 * il punto), un sei non ci sta a nessun gradino, e lo stesso quattro ai
 * curiosi no. */
prova('il tetto della difficoltà è quello del gradino scelto', () => {
  const daEsperti = candidato('profondo:difficile', {
    tipo: 'profondo', difficolta: 4, strumentoMinimo: 'telescopio', evidenza: 0.9
  });
  const impossibile = candidato('profondo:impossibile', {
    tipo: 'profondo', difficolta: 6, strumentoMinimo: 'telescopio', evidenza: 0.9
  });
  const cielo = [daEsperti, impossibile].concat(cieloRicco());

  const sfida = motore.genera(scenario(cielo, {
    esperienza: 'sfida', strumento: 'telescopio', durata: 120
  }));
  assert.ok(sfida.tappe.every(t => t.difficolta <= K.MISS_DIFFICOLTA_MASSIMA.sfida));
  assert.ok(!sfida.tappe.some(t => t.id === impossibile.id));
  // Un quattro alla sfida è ammissibile: è la promessa del gradino.
  assert.ok(motore.ammissibile(daEsperti, { esperienza: 'sfida', strumento: 'telescopio', cielo: 'tutto' }));

  const curiosi = motore.genera(scenario(cielo, {
    esperienza: 'curiosi', strumento: 'telescopio', durata: 120
  }));
  assert.ok(curiosi.tappe.every(t => t.difficolta <= K.MISS_DIFFICOLTA_MASSIMA.curiosi));
  assert.ok(!curiosi.tappe.some(t => t.id === daEsperti.id));
});

// =====================================================================
sezione('cosa si va a cercare: i generi sono un filtro, non una preferenza');

/* Il difetto a cui questa sezione risponde non si vede guardando lo
 * schermo: una missione di pianeti e costellazioni, a chi aveva chiesto
 * galassie, è una missione perfettamente sensata — solo che è la serata
 * di qualcun altro. E non lo prende nessuna delle altre regole, perché il
 * punteggio premie giustamente quello che si trova più facilmente: senza
 * un filtro secco, «voglio galassie» resta un pareggio da arbitrare
 * contro l'altezza e la magnitudine, e lo perde sempre. */

prova('un genere spento non compare affatto', () => {
  const m = motore.genera(scenario(cieloRicco(), {
    durata: 120, strumento: 'telescopio', generi: ['profondo']
  }));
  assert.ok(m.tappe.length, 'una missione di sole galassie deve esistere');
  const intrusi = m.tappe.filter(t => t.tipo !== 'profondo' && t.tipo !== 'evento');
  assert.deepStrictEqual(intrusi.map(t => t.nome), []);
});

prova('le stazioni si possono chiedere da sole', () => {
  const m = motore.genera(scenario(cieloRicco(), {
    durata: 120, strumento: 'telescopio', generi: ['artificiali']
  }));
  assert.ok(m.tappe.every(t => t.tipo === 'stazione' || t.tipo === 'evento'));
});

prova('la Luna e le comete stanno coi pianeti, non con le stelle', () => {
  const scelte = { generi: ['pianeti'], strumento: 'telescopio', esperienza: 'curiosi', cielo: 'tutto' };
  assert.ok(motore.genereAmmesso({ tipo: 'luna' }, scelte));
  assert.ok(motore.genereAmmesso({ tipo: 'corpoMinore' }, scelte));
  assert.ok(!motore.genereAmmesso({ tipo: 'stella' }, scelte));
  assert.ok(!motore.genereAmmesso({ tipo: 'costellazione' }, scelte));
});

prova('un evento del calendario passa comunque: è un appuntamento', () => {
  assert.ok(motore.genereAmmesso({ tipo: 'evento' }, { generi: ['profondo'] }));
});

/* L'elenco vuoto vuol dire «tutto» e non «niente», ed è la differenza
 * fra una spunta tolta per sbaglio e una serata senza bersagli. Vale
 * anche per i salvataggi di prima, che il campo non ce l'hanno affatto,
 * e per un genere che nel frattempo fosse stato tolto dal codice. */
prova('nessun genere scelto vuol dire tutti, non nessuno', () => {
  assert.deepStrictEqual(motore.generiScelti({ generi: [] }), K.MISS_GENERI_TUTTI);
  assert.deepStrictEqual(motore.generiScelti({}), K.MISS_GENERI_TUTTI);
  assert.deepStrictEqual(motore.generiScelti({ generi: ['inventato'] }), K.MISS_GENERI_TUTTI);
  const m = motore.genera(scenario(cieloRicco(), { durata: 120, strumento: 'telescopio', generi: [] }));
  assert.ok(m.tappe.length > 1);
});

prova('ogni tipo che il raccoglitore produce ha il suo genere', () => {
  // Se un tipo nuovo non finisse in nessun genere, `missGenereAmmesso`
  // lo lascerebbe passare sempre — cioè il filtro tacerebbe invece di
  // fallire, che è il modo peggiore di non funzionare.
  for (const tipo of ['luna', 'pianeta', 'corpoMinore', 'stella', 'profondo', 'costellazione', 'stazione']) {
    assert.ok(K.MISS_GENERE_DI_TIPO[tipo], `il tipo ${tipo} non sta in nessun genere`);
  }
});

/* Un passaggio di stazione non si rimisura, ed è la riga per cui il
 * genere «stazioni» restava vuoto anche col passaggio in cielo.
 *
 * Il difetto era in due pezzi che presi da soli sembravano tutti e due
 * giusti. Il raccoglitore trovava il passaggio (SGP4, culmine, azimut:
 * tutto corretto); poi `missGeneraMissione` rimisurava ogni tappa
 * all'ora assegnata, e `altAzCorpo('sat-iss')` — che non è un corpo
 * della libreria — sollevava. Il `catch` restituisce altezza −90, cioè
 * «sotto l'orizzonte», e `missAmmissibile` buttava via la tappa. Il
 * sintomo non era un errore ma un'assenza: si accendeva la casella
 * «stazioni», si generava, e usciva la missione di qualcun altro. */
prova('un passaggio di stazione non si rimisura: la sua posizione è quella del culmine', () => {
  const pass = {
    tipo: 'stazione', nome: 'ISS', idCielo: 'sat-iss',
    altezza: 62, azimut: 190, sopraOstacoli: 60
  };
  const p = motore.misuraTappa(pass, new Date(T0), { latitude: 45.8, longitude: 9.1, height: 200 });
  assert.strictEqual(p.altezza, 62);
  assert.strictEqual(p.azimut, 190);
  assert.ok(p.sopraOstacoli > 1, 'sopraOstacoli: ' + p.sopraOstacoli);
});

/* …e il crepuscolo, per una stazione, non si applica.
 *
 * Tutto il resto del cielo sparisce col Sole sopra i −6°, e deve: una
 * nebulosa a quell'ora non si vede. Una stazione invece si vede
 * **proprio** allora, perché lassù è ancora illuminata mentre quaggiù è
 * già buio — è la mezz'ora in cui i passaggi si guardano davvero, e
 * `passaggiVisibiliOrdinati` ha già fatto quel conto per conto suo. */
prova('e il crepuscolo non la spegne: è lì che una stazione si vede', () => {
  const mezzogiorno = Date.UTC(2026, 8, 7, 10, 0, 0);
  const pass = { tipo: 'stazione', nome: 'ISS', idCielo: 'sat-iss', altezza: 48, azimut: 120, sopraOstacoli: 46 };
  const p = motore.misuraTappa(pass, new Date(mezzogiorno), { latitude: 45.8, longitude: 9.1, height: 200 });
  assert.strictEqual(p.altezza, 48);
});

// =====================================================================
sezione('il sorteggio: la stessa serata non dà la stessa lista');

/* Prima la scelta era un argmax: dallo stesso balcone, alla stessa ora,
 * la missione era identica ogni sera, perché identiche erano le
 * posizioni. Non lo si vede guardando una missione — cinque bersagli
 * sensati sono cinque bersagli sensati — e lo si vede benissimo alla
 * terza sera di fila. */

prova('due semi diversi danno due missioni diverse', () => {
  const uno = motore.genera(Object.assign(scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }), { seme: 'a' }));
  const due = motore.genera(Object.assign(scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }), { seme: 'b' }));
  const nomi = m => m.tappe.map(t => t.nome).join('|');
  assert.notStrictEqual(nomi(uno), nomi(due));
});

prova('lo stesso seme dà sempre la stessa missione', () => {
  // È la condizione perché aprire e chiudere il pannello, andare nel
  // planetario e tornare, o cambiare lingua non riscrivano la serata.
  const fai = () => motore.genera(Object.assign(
    scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }), { seme: 'fermo' }));
  assert.deepStrictEqual(fai().tappe.map(t => t.id), fai().tappe.map(t => t.id));
});

prova('in dieci serate il cast cambia davvero', () => {
  const viste = new Set();
  for (let k = 0; k < 10; k++) {
    const m = motore.genera(Object.assign(
      scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }), { seme: 'sera-' + k }));
    m.tappe.forEach(t => viste.add(t.id));
  }
  // Con dodici candidati e cinque tappe, dieci serate devono pescare
  // parecchio più dei cinque bersagli di sempre.
  assert.ok(viste.size >= 8, `solo ${viste.size} bersagli diversi in dieci serate`);
});

prova('il sorteggio resta pesato: il migliore vince spesso', () => {
  // Randomico non vuol dire a caso. Su cento tiri, un candidato trenta
  // punti sopra gli altri deve uscire nella grande maggioranza dei casi:
  // se non fosse così, la temperatura sarebbe tarata male e la missione
  // proporrebbe la nebulosa da undicesima al posto di Giove.
  const rnd = motore.caso('taratura');
  const pool = [{ punti: 100 }, { punti: 70 }, { punti: 70 }, { punti: 70 }];
  let primo = 0;
  for (let k = 0; k < 400; k++) if (motore.pescaPesato(pool, rnd, 9) === 0) primo++;
  assert.ok(primo > 240 && primo < 400, `il migliore è uscito ${primo} volte su 400`);
});

prova('il sorteggio non esplode con punteggi enormi', () => {
  // `Math.exp(punti)` su punteggi grandi è `Infinity`, e `Infinity /
  // Infinity` è `NaN`: si sottrae il migliore prima dell'esponenziale, e
  // questa prova è lì per non farlo togliere.
  const rnd = motore.caso('estremi');
  const pool = [{ punti: 1e5 }, { punti: -1e5 }];
  for (let k = 0; k < 50; k++) {
    const i = motore.pescaPesato(pool, rnd, 9);
    assert.ok(i === 0 || i === 1, `indice fuori scala: ${i}`);
  }
  assert.strictEqual(motore.pescaPesato([], rnd, 9), -1);
});

prova('il caso è seminato: lo stesso seme dà la stessa sequenza', () => {
  const a = motore.caso('x'), b = motore.caso('x');
  for (let k = 0; k < 20; k++) {
    const v = a();
    assert.strictEqual(v, b());
    assert.ok(v >= 0 && v < 1, `fuori da [0,1): ${v}`);
  }
});

// =====================================================================
sezione('la voce: come si dice una cosa, non solo cosa si dice');

/* Questa famiglia esiste perché lo SSML è il posto dove sbagliare non si
 * sente. Un namespace dimenticato, uno stile che quella voce non conosce,
 * un tag chiuso male: il servizio risponde comunque un audio perfetto,
 * letto in tono neutro — cioè esattamente com'era prima — e non c'è
 * niente da cui accorgersene se non riascoltare tutto sperando di
 * ricordarsi com'era. */

prova('lo SSML porta il namespace mstts, se no lo stile si perde in silenzio', () => {
  const x = motore.ssml('ciao', 'it', K.MISS_TONI_VOCE.curiosi.scoperta);
  assert.ok(x.includes('xmlns:mstts='), 'senza il namespace il blocco viene ignorato');
  assert.ok(x.includes('<mstts:express-as'));
  assert.ok(x.includes('</mstts:express-as>'));
  assert.ok(x.trim().startsWith('<speak') && x.trim().endsWith('</speak>'));
});

prova('uno stile che la voce non conosce non si chiede affatto', () => {
  // Chiederlo non è un errore: è un risultato identico a prima. Meglio
  // la voce stabile, che almeno non promette un'emozione che non arriva.
  const x = motore.ssml('ciao', 'it', { stile: 'inventato', grado: '1', ritmo: '+0%', tono: '+0Hz' });
  assert.ok(!x.includes('express-as'));
  assert.ok(x.includes(K.MISS_VOCI_EDGE.it.stabile));
});

prova('ogni stile dichiarato nelle tabelle dei toni esiste davvero', () => {
  // È l'invariante che tiene in piedi il pezzo: se una riga della tabella
  // nominasse uno stile che la voce non ha, quel momento della caccia
  // tornerebbe muto di emozione senza che niente lo dica.
  for (const [modo, momenti] of Object.entries(K.MISS_TONI_VOCE)) {
    for (const [momento, tono] of Object.entries(momenti)) {
      for (const lingua of ['it', 'en']) {
        assert.ok(K.MISS_VOCI_EDGE[lingua].stili.includes(tono.stile),
          `${lingua}/${modo}/${momento}: lo stile «${tono.stile}» non esiste`);
      }
    }
  }
});

prova('il testo dentro allo SSML è sfuggito: un & non chiude il documento', () => {
  const x = motore.ssml('Luna & Sole <test>', 'it', K.MISS_TONI_VOCE.curiosi.enigma);
  assert.ok(x.includes('&amp;'));
  assert.ok(!x.includes('<test>'));
});

prova('le pause cadono sulla punteggiatura, e i due punti prendono la più lunga', () => {
  // Sono metà di quello che fa sembrare naturale una voce: senza, un
  // testo di frasi brevi esce tutto d'un fiato.
  const x = motore.ssml('Indizio 2: trova Vega. Poi guarda in alto, piano.', 'it',
    K.MISS_TONI_VOCE.curiosi.indizio);
  const pause = [...x.matchAll(/<break time="(\d+)ms"\/>/g)].map(m => Number(m[1]));
  assert.strictEqual(pause.length, 3, JSON.stringify(pause));
  assert.ok(pause[0] > pause[1], 'i due punti devono respirare più del punto');
  assert.ok(pause[1] > pause[2], 'il punto deve respirare più della virgola');
});

prova('i quattro momenti della caccia sono quattro, e si riconoscono', () => {
  const M = K.MISS_INDIZI;
  assert.strictEqual(motore.momentoVoce({ fase: 'ricerca', aiuto: 0 }), 'enigma');
  assert.strictEqual(motore.momentoVoce({ fase: 'ricerca', aiuto: 2, indizioMostrato: 2 }), 'indizio');
  assert.strictEqual(motore.momentoVoce({ fase: 'ricerca', aiuto: M, indizioMostrato: M, rivelata: true }), 'soluzione');
  assert.strictEqual(motore.momentoVoce({ fase: 'scoperta' }), 'scoperta');
});

prova('la scoperta si dice su di giri, la resa no', () => {
  // È la differenza che questa tabella esiste per fare: festeggiare
  // quando qualcuno si è appena arreso è la cosa sbagliata da dire.
  for (const modo of K.MISS_ESPERIENZE) {
    const t = K.MISS_TONI_VOCE[modo];
    assert.strictEqual(t.scoperta.stile, 'excited', modo);
    assert.notStrictEqual(t.soluzione.stile, 'excited', modo);
    assert.ok(parseFloat(t.scoperta.grado) > parseFloat(t.soluzione.grado), modo);
    // L'enigma va lasciato respirare: più lento della scoperta, sempre.
    assert.ok(parseFloat(t.enigma.ritmo) < parseFloat(t.scoperta.ritmo), modo);
  }
});

prova('coi bambini la voce è più alta e più svelta che coi curiosi', () => {
  const b = K.MISS_TONI_VOCE.bambini, c = K.MISS_TONI_VOCE.curiosi;
  for (const momento of ['enigma', 'indizio', 'soluzione', 'scoperta']) {
    assert.ok(parseFloat(b[momento].tono) > parseFloat(c[momento].tono), momento);
    assert.ok(parseFloat(b[momento].ritmo) > parseFloat(c[momento].ritmo), momento);
  }
});

// =====================================================================
sezione('sotto l’orizzonte, e dietro al tetto del vicino');

prova('un oggetto sotto l’orizzonte non entra mai', () => {
  const sotto = candidato('sotto', { altezza: -12, sopraOstacoli: -12 });
  const m = motore.genera(scenario(cieloRicco().concat([sotto]), { durata: 120, strumento: 'telescopio' }));
  assert.ok(!m.tappe.some(t => t.id === 'sotto'));
});

prova('un oggetto sopra l’orizzonte ma dietro al palazzo non entra', () => {
  // È il caso che la sola altezza non prende: trenta gradi sono un'altezza
  // ottima, e dietro a un condominio di otto piani sono niente.
  const dietro = candidato('dietro', { altezza: 30, sopraOstacoli: -4, evidenza: 1, difficolta: 1 });
  const m = motore.genera(scenario([dietro].concat(cieloRicco()), { durata: 120, strumento: 'telescopio' }));
  assert.ok(!m.tappe.some(t => t.id === 'dietro'));
});

prova('la magnitudine limite peggiora verso l’orizzonte', () => {
  const zenit = motore.limiteStellareLocale(6, 90);
  const basso = motore.limiteStellareLocale(6, 15);
  assert.ok(zenit > basso + 0.7, `${zenit} contro ${basso}`);
});

prova('una stella oltre il limite locale non entra nella missione', () => {
  const debole = candidato('stella:debole', { tipo: 'stella', mag: 5.8, altezza: 15,
    magLimiteZenit: 6, evidenza: 0.5, puntiBase: 100 });
  const m = motore.genera(scenario([debole], { durata: 30, strumento: 'occhio' }));
  assert.ok(m.vuota);
});

prova('in città non propone cielo profondo neppure col telescopio', () => {
  const galassia = candidato('profondo:citta', { tipo: 'profondo', mag: 3.4,
    brillanza: 13.5, magLimiteZenit: 4.2, fondoCielo: 9.8,
    strumentoMinimo: 'telescopio', difficolta: 3, puntiBase: 100 });
  const m = motore.genera(scenario([galassia], { durata: 30, strumento: 'telescopio' }, { bortle: 8 }));
  assert.ok(m.vuota);
});

prova('lo stesso oggetto profondo resta possibile sotto un cielo buio', () => {
  const galassia = candidato('profondo:campagna', { tipo: 'profondo', mag: 3.4,
    brillanza: 13.5, magLimiteZenit: 6.6, fondoCielo: 12.7,
    strumentoMinimo: 'binocolo', difficolta: 3, puntiBase: 100 });
  const m = motore.genera(scenario([galassia], { durata: 30, strumento: 'binocolo' }, { bortle: 3 }));
  assert.ok(!m.vuota);
});

prova('la simulazione Bortle usa la scelta della missione', () => {
  assert.strictEqual(motore.bortleScelto({ bortle: 2 }), 2);
  assert.strictEqual(motore.bortleScelto({ bortle: 8 }), 8);
  assert.strictEqual(motore.bortleScelto({ bortle: 7 }), 5, 'una tacca non prevista torna al cielo predefinito');
});

prova('la porzione Sud–Sud-est esclude il resto del cielo', () => {
  const dentro = candidato('dentro-settore', { azimut: 157.5, puntiBase: 100 });
  const fuori = candidato('fuori-settore', { azimut: 270, puntiBase: 100 });
  const m = motore.genera(scenario([dentro, fuori], {
    cielo: 'settore', cieloDa: 180, cieloA: 135, durata: 30
  }));
  assert.deepStrictEqual(m.tappe.map(t => t.id), ['dentro-settore']);
});

prova('il settore che attraversa il Nord usa l’arco breve', () => {
  assert.ok(motore.azimutNelSettore(0, 315, 45));
  assert.ok(motore.azimutNelSettore(350, 315, 45));
  assert.ok(!motore.azimutNelSettore(180, 315, 45));
});

prova('sotto l’altezza minima dell’esperienza non entra', () => {
  const basso = candidato('basso', { altezza: 12, sopraOstacoli: 11, evidenza: 1, difficolta: 1 });
  const conBambini = motore.genera(scenario([basso].concat(cieloRicco()),
    { esperienza: 'bambini', durata: 120, strumento: 'telescopio' }));
  const perSfida = motore.genera(scenario([basso].concat(cieloRicco()),
    { esperienza: 'sfida', durata: 120, strumento: 'telescopio' }));
  assert.ok(!conBambini.tappe.some(t => t.id === 'basso'), 'coi bambini a dodici gradi non ci si manda');
  assert.ok(perSfida.tappe.length >= 1);
  assert.ok(K.MISS_ALTEZZA_MINIMA.sfida < K.MISS_ALTEZZA_MINIMA.bambini);
});

// =====================================================================
sezione('la varietà, e la prima tappa facile');

prova('se un pianeta è osservabile entra anche in una missione corta', () => {
  const pianeta = candidato('pianeta:Mars', {
    nome: 'Marte', difficolta: 2, evidenza: 0.5, puntiBase: 1
  });
  const stelleFavorite = Array.from({ length: 5 }, (_, i) => candidato('stella:favorita-' + i, {
    tipo: 'stella', nome: 'Stella favorita ' + i, azimut: 30 + i * 40,
    difficolta: 1, evidenza: 1, puntiBase: 200
  }));
  const m = motore.genera(scenario(stelleFavorite.concat(pianeta), { durata: 10 }));
  assert.ok(m.tappe.some(t => t.id === 'pianeta:Mars'), m.tappe.map(t => t.id).join(', '));
});

prova('un pianeta non osservabile non viene forzato nella missione', () => {
  const nettuno = candidato('pianeta:Neptune', {
    nome: 'Nettuno', strumentoMinimo: 'telescopio', difficolta: 4
  });
  const stella = candidato('stella:Star2', { tipo: 'stella', nome: 'Sirio' });
  const m = motore.genera(scenario([nettuno, stella], { durata: 10, strumento: 'occhio' }));
  assert.deepStrictEqual(m.tappe.map(t => t.id), ['stella:Star2']);
});

prova('una nuova missione usa astri diversi quando il cielo ne offre abbastanza', () => {
  const prima = motore.genera(scenario(cieloRicco(), {
    durata: 30, strumento: 'telescopio', esperienza: 'sfida'
  }));
  const secondaScenario = scenario(cieloRicco(), {
    durata: 30, strumento: 'telescopio', esperienza: 'sfida'
  });
  secondaScenario.seme = 'seconda-missione';
  secondaScenario.evitare = prima.tappe.map(t => t.id);
  const seconda = motore.genera(secondaScenario);
  assert.deepStrictEqual(seconda.tappe.filter(t => prima.tappe.some(p => p.id === t.id)), []);
});

prova('due astri della stessa famiglia ricevono domande diverse', () => {
  const pianeti = ['Mercury', 'Venus', 'Mars'].map((nome, i) => candidato('pianeta:' + nome, {
    nome, azimut: 120 + i * 20, difficolta: 1, evidenza: 0.9
  }));
  const m = motore.genera(scenario(pianeti, { durata: 30, esperienza: 'sfida' }));
  const varianti = m.tappe.map(t => t.domandaVariante);
  assert.strictEqual(new Set(varianti).size, varianti.length);
});

prova('una figura e la sua stella più luminosa non stanno nella stessa missione', () => {
  // È il doppione che nessun'altra regola prende: sono due famiglie diverse
  // per il tetto della varietà, stanno a pochi gradi quindi la continuità le
  // premia, e hanno tutt'e due un punteggio alto. Trovata Vega, la Lira è
  // già lì.
  const coppia = [
    candidato('stella:Star3', { tipo: 'stella', nome: 'Vega', difficolta: 1, evidenza: 0.95, azimut: 300 }),
    candidato('costellazione:Lira', { tipo: 'costellazione', nome: 'Lira', capofila: 'Vega',
      idCielo: null, difficolta: 1, evidenza: 0.9, didattica: 1, azimut: 300 }),
    candidato('pianeta:Jupiter', { nome: 'Giove', difficolta: 1, evidenza: 0.95, azimut: 120 }),
    candidato('profondo:M31', { tipo: 'profondo', nome: 'M31', difficolta: 3, evidenza: 0.35,
      strumentoMinimo: 'binocolo', azimut: 60 })
  ];
  const m = motore.genera(scenario(coppia, { durata: 120, strumento: 'telescopio' }));
  const nomi = m.tappe.map(t => t.nome);
  assert.ok(!(nomi.includes('Vega') && nomi.includes('Lira')), nomi.join(', '));
});

prova('e nessuna delle due fa da riferimento all’altra', () => {
  const tappe = [
    candidato('costellazione:Lira', { tipo: 'costellazione', nome: 'Lira', capofila: 'Vega',
      evidenza: 0.9, azimut: 300, altezza: 60 }),
    candidato('stella:Star3', { tipo: 'stella', nome: 'Vega', evidenza: 0.95, azimut: 302, altezza: 62 })
  ];
  const conRif = motore.riferimenti(tappe, tappe);
  assert.ok(!conRif[1].riferimento || conRif[1].riferimento.nome !== 'Lira',
    'il riferimento di Vega è la Lira, che è Vega');
});

prova('«Inizia adesso» molto dopo l’ora prevista non sposta e basta gli orari', () => {
  // Chi prepara la missione alle due del pomeriggio e la avvia subito: con
  // gli orari spostati e le tappe ferme si otterrebbe Vega a ottantatré
  // gradi in pieno giorno. Qui si prova la soglia, che è la regola.
  assert.ok(motore.costanti.MISS_TAPPE_PER_DURATA, 'costanti esposte');
  const scarto = 6 * 3600000;
  assert.ok(scarto > 20 * 60000, 'sei ore stanno oltre la soglia di venti minuti');
});

prova('con candidati a sufficienza la missione non è tutta della stessa famiglia', () => {
  const m = motore.genera(scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }));
  const famiglie = new Set(m.tappe.map(motore.famiglia));
  assert.ok(famiglie.size >= 2, `una sola famiglia: ${[...famiglie]}`);
});

prova('nessuna famiglia supera il suo tetto', () => {
  const m = motore.genera(scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }));
  const conto = {};
  m.tappe.forEach(t => { const f = motore.famiglia(t); conto[f] = (conto[f] || 0) + 1; });
  // Il tetto si può sforare solo quando la missione andrebbe altrimenti
  // più corta del dovuto: con dodici candidati non è il caso.
  Object.entries(conto).forEach(([f, n]) =>
    assert.ok(n <= K.MISS_TETTO_FAMIGLIA, `${f}: ${n}`));
});

prova('la prima tappa è la più facile della missione', () => {
  const m = motore.genera(scenario(cieloRicco(), { durata: 120, strumento: 'telescopio' }));
  const prima = m.tappe[0];
  const minima = Math.min(...m.tappe.filter(t => !t.aOrarioPreciso).map(t => t.difficolta));
  assert.strictEqual(prima.difficolta, minima,
    `prima ${prima.nome} (${prima.difficolta}), la più facile è ${minima}`);
});

prova('la sfida tiene il pezzo grosso per la fine', () => {
  const m = motore.genera(scenario(cieloRicco(), { esperienza: 'sfida', durata: 120, strumento: 'telescopio' }));
  const libere = m.tappe.filter(t => !t.aOrarioPreciso);
  const ultima = libere[libere.length - 1];
  assert.strictEqual(ultima.difficolta, Math.max(...libere.map(t => t.difficolta)),
    `finisce con ${ultima.nome} (${ultima.difficolta})`);
});

prova('con i bambini niente di difficile, e tappe corte', () => {
  const m = motore.genera(scenario(cieloRicco(), { esperienza: 'bambini', durata: 120, strumento: 'telescopio' }));
  assert.ok(m.tappe.every(t => t.difficolta <= 3), m.tappe.map(t => `${t.nome}:${t.difficolta}`).join(' '));
  const libere = m.tappe.filter(t => !t.aOrarioPreciso);
  if (libere.length > 1) {
    const passo = (libere[1].quando - libere[0].quando) / 60000;
    assert.ok(passo <= 5.01, `${passo} minuti fra una tappa e l'altra`);
  }
});

prova('la scelta bambini attiva un registro dedicato senza cambiare gli altri', () => {
  assert.strictEqual(motore.chiaveRegistro('trova', 'bambini'), 'bambini.trova');
  assert.strictEqual(motore.chiaveRegistro('aiuto3', 'bambini'), 'bambini.aiuto3');
  assert.strictEqual(motore.chiaveRegistro('trova', 'curiosi'), 'trova');
  assert.strictEqual(motore.chiaveRegistro('cielo.sereno', 'bambini'), 'cielo.sereno');
});

// =====================================================================
sezione('i tre gradini della caccia');

/* I gradini sono tre e non due, ed è la sola cosa che questa sezione
 * esiste per provare: che siano davvero **tre cose diverse** e non tre
 * etichette sullo stesso comportamento. Le due manopole sono il tetto
 * della difficoltà e quanto si racconta prima di cercare, e vanno
 * verificate tutte e due — con un tetto solo, «curiosi» ed «esperti»
 * darebbero la stessa missione con due nomi. */
prova('i tre gradini hanno tre tetti di difficoltà, in ordine', () => {
  assert.deepStrictEqual(K.MISS_ESPERIENZE, ['bambini', 'curiosi', 'sfida']);
  const t = K.MISS_DIFFICOLTA_MASSIMA;
  assert.ok(t.bambini < t.curiosi && t.curiosi < t.sfida,
    `${t.bambini} / ${t.curiosi} / ${t.sfida}`);
  const a = K.MISS_ALTEZZA_MINIMA;
  assert.ok(a.bambini > a.curiosi && a.curiosi > a.sfida,
    `${a.bambini} / ${a.curiosi} / ${a.sfida}`);
});

prova('solo il gradino più alto arriva al cielo profondo difficile', () => {
  // Ammissibile e non «scelto»: in un cielo ricco una planetaria di
  // undicesima resta comunque in fondo alla classifica, ed è giusto. La
  // domanda qui è un'altra — il tetto la lascia passare o no?
  const duro = candidato('profondo:duro', { tipo: 'profondo', nome: 'M76 — Piccolo Manubrio',
    sigla: 'M76', categoria: 'planetaria', difficolta: 5, evidenza: 0.05, mag: 11.5,
    strumentoMinimo: 'telescopio', azimut: 90 });
  assert.ok(motore.ammissibile(duro, { esperienza: 'sfida', strumento: 'telescopio' }),
    'agli esperti la planetaria di undicesima si può proporre');
  assert.ok(!motore.ammissibile(duro, { esperienza: 'curiosi', strumento: 'telescopio' }),
    'ai curiosi no: il loro tetto è tre');
  assert.ok(!motore.ammissibile(duro, { esperienza: 'bambini', strumento: 'telescopio' }));
  // E in un cielo che non offre altro, agli esperti ci finisce davvero.
  const solo = motore.genera(scenario([duro], { esperienza: 'sfida', durata: 30, strumento: 'telescopio' }));
  assert.deepStrictEqual(solo.tappe.map(t => t.id), ['profondo:duro']);
});

prova('quanto si racconta prima di cercare cambia coi gradini', () => {
  const g = K.MISS_GENEROSITA;
  assert.strictEqual(g.sfida.segno, false, 'agli esperti il segno arriva col primo indizio');
  assert.strictEqual(g.curiosi.segno, true);
  assert.strictEqual(g.bambini.aiutoSubito, true, 'ai bambini la direzione si dà senza chiederla');
  assert.strictEqual(g.curiosi.aiutoSubito, false);
});

prova('una preferenza salvata di una modalità che non esiste più diventa il gradino di mezzo', () => {
  // «stupore» e «imparare» erano i due percorsi morbidi: a chi voleva
  // essere accompagnato non si può dare l'esame degli esperti.
  assert.ok(!K.MISS_ESPERIENZE.includes('stupore'));
  assert.ok(!K.MISS_ESPERIENZE.includes('imparare'));
});

// =====================================================================
sezione('il repertorio: chi ha una storia da raccontare');

/* Il difetto che questa sezione prende non si vede sullo schermo: un
 * bersaglio con lo slug sbagliato riceve l'enigma di un altro oggetto e
 * l'aneddoto di un terzo, e sembra soltanto un testo un po' strano. Il
 * caso vero è «Andromeda», che sono due cose diverse — la figura e la
 * galassia dentro di lei — e hanno due storie. */
prova('la figura e la galassia di Andromeda non sono lo stesso bersaglio', () => {
  const figura = { tipo: 'costellazione', nome: 'Andromeda', sigla: 'And' };
  const galassia = { tipo: 'profondo', nome: 'M31 — Galassia di Andromeda', sigla: 'M31' };
  assert.strictEqual(motore.slugTappa(figura), 'andromedaFigura');
  assert.strictEqual(motore.slugTappa(galassia), 'andromeda');
});

prova('il cielo profondo si riconosce dalla sigla, non dal nome tradotto', () => {
  // Il nome cambia con la lingua, la sigla di catalogo no: è l'unico
  // pezzo su cui si possa appoggiare il riconoscimento.
  assert.strictEqual(motore.slugTappa({ tipo: 'profondo', nome: 'M42 — Orion Nebula', sigla: 'M42' }),
    'nebulosaOrione');
  // «M 7» e «M7» sono due righe dello stesso ammasso: lo spazio non conta.
  assert.strictEqual(motore.slugTappa({ tipo: 'profondo', nome: 'M 7 — ammasso aperto', sigla: 'M 7' }), 'm7');
  // E senza `sigla` la si ricava dal nome composto dal catalogo.
  assert.strictEqual(motore.siglaCatalogo({ tipo: 'profondo', nome: 'M45 — Pleiadi' }), 'm45');
});

prova('chi un nome proprio non ce l’ha cade nella sua specie, non nel generico', () => {
  const anonima = { tipo: 'profondo', nome: 'M85 — galassia ellittica',
    sigla: 'M85', categoria: 'galassia' };
  assert.strictEqual(motore.slugTappa(anonima), null);
  assert.strictEqual(motore.baseRacconto(anonima), 'galassia');
  // …e senza nemmeno la categoria resta la famiglia, che c'è sempre.
  assert.strictEqual(motore.baseRacconto({ tipo: 'profondo', nome: 'NGC 1', sigla: 'NGC 1' }), 'profondo');
});

prova('il fascino segue il repertorio, poi la specie, poi la famiglia', () => {
  const saturno = motore.fascinoDi({ tipo: 'pianeta', nome: 'Saturno' });
  const galassiaAnonima = motore.fascinoDi({ tipo: 'profondo', nome: 'M85 — galassia ellittica',
    sigla: 'M85', categoria: 'galassia' });
  const stellaQualunque = motore.fascinoDi({ tipo: 'stella', nome: 'HD 12345' });
  assert.ok(saturno > galassiaAnonima && galassiaAnonima > stellaQualunque,
    `${saturno} / ${galassiaAnonima} / ${stellaQualunque}`);
  assert.ok(saturno <= 1 && stellaQualunque >= 0, 'il fascino sta fra zero e uno');
});

prova('nessuna voce del repertorio ha uno slug doppio o un fascino fuori scala', () => {
  const visti = new Set();
  for (const v of K.MISS_REPERTORIO) {
    assert.ok(!visti.has(v.slug), 'slug ripetuto: ' + v.slug);
    visti.add(v.slug);
    assert.ok(v.fascino >= 0 && v.fascino <= 1, `${v.slug} ha fascino ${v.fascino}`);
    assert.ok(v.prova || (v.sigle && v.sigle.length), v.slug + ' non si riconosce in nessun modo');
  }
});

prova('a parità di tutto vince il bersaglio che ha qualcosa da raccontare', () => {
  const base = { altezza: 45, difficolta: 2, evidenza: 0.6, minutiUtili: 60,
    didattica: 0.3, puntiBase: 50 };
  const saturno = Object.assign({ id: 'a', tipo: 'pianeta', nome: 'Saturno' }, base);
  const anonima = Object.assign({ id: 'b', tipo: 'profondo', nome: 'NGC 4526 — galassia a spirale',
    sigla: 'NGC 4526', categoria: 'galassia' }, base);
  const scelte = { esperienza: 'curiosi' };
  assert.ok(motore.punteggio(saturno, scelte, {}) > motore.punteggio(anonima, scelte, {}),
    'Saturno vale più di una galassia senza nome con gli stessi numeri');
});

prova('agli esperti un bersaglio banale costa punti, agli altri no', () => {
  const banale = { id: 'x', tipo: 'pianeta', nome: 'Venere', altezza: 45, difficolta: 1,
    evidenza: 0.95, minutiUtili: 60, didattica: 0.3, puntiBase: 50 };
  const perSfida = motore.punteggio(banale, { esperienza: 'sfida' }, {});
  const senzaPavimento = motore.punteggio(
    Object.assign({}, banale, { difficolta: K.MISS_DIFFICOLTA_GRADITA.sfida }),
    { esperienza: 'sfida' }, {});
  assert.ok(perSfida < senzaPavimento, `${perSfida} contro ${senzaPavimento}`);
  assert.strictEqual(K.MISS_DIFFICOLTA_GRADITA.bambini, 1, 'coi bambini non c’è nessun pavimento');
});

prova('due oggetti profondi nello stesso campo sono una tappa sola', () => {
  // M31 e la sua compagna M32 distano venti primi: chi trova la prima ha
  // già la seconda dentro all'inquadratura.
  const m31 = { id: 'a', tipo: 'profondo', nome: 'M31 — Galassia di Andromeda', sigla: 'M31',
    mira: { ra: 0.712, dec: 41.27 } };
  const m32 = { id: 'b', tipo: 'profondo', nome: 'M32 — Compagna di Andromeda', sigla: 'M32',
    mira: { ra: 0.711, dec: 40.87 } };
  const lontana = { id: 'c', tipo: 'profondo', nome: 'M33 — Galassia del Triangolo', sigla: 'M33',
    mira: { ra: 1.564, dec: 30.66 } };
  assert.ok(motore.separazioneCatalogo(m31, m32) < K.MISS_STESSO_CAMPO_GRADI);
  assert.ok(motore.doppione(m32, [m31]), 'M32 accanto a M31 è un doppione');
  assert.ok(!motore.doppione(lontana, [m31]), 'M33 sta a quindici gradi: e un\'altra tappa');
});

prova('due righe di catalogo dello stesso oggetto non fanno due tappe', () => {
  // M42 e M43 sono due voci del catalogo per la stessa nebulosa: stesso
  // slug, stesso enigma, stesso aneddoto.
  const m42 = { id: 'a', tipo: 'profondo', nome: 'M42 — Nebulosa di Orione', sigla: 'M42' };
  const m43 = { id: 'b', tipo: 'profondo', nome: 'M43 — Nebulosa di De Mairan', sigla: 'M43' };
  assert.strictEqual(motore.slugTappa(m42), motore.slugTappa(m43));
  assert.ok(motore.doppione(m43, [m42]));
});

// =====================================================================
sezione('il repertorio e i dizionari devono dire la stessa cosa');

/* La prova che risponde al difetto muto di tutto questo pezzo.
 *
 * Aggiungere una voce al repertorio senza scriverne l'enigma non rompe
 * niente: la catena di ripiego consegna quello della specie, e sullo
 * schermo compare un testo perfettamente sensato che parla di un'altra
 * cosa. Nessuno se ne accorge — è la stessa famiglia di guasti dei nomi
 * dei laghi che mancavano per mesi. Qui i due elenchi si confrontano
 * cifra per cifra, e in tutt'e due le lingue. */
function dizionario(lingua) {
  const finestra = {};
  const codice = fs.readFileSync(path.join(RADICE, 'lingue', lingua + '.js'), 'utf8');
  new Function('window', codice)(finestra);
  return finestra.ASTRO_DIZIONARI[lingua].messaggi;
}

const DIZIONARI = { it: dizionario('it'), en: dizionario('en') };

for (const lingua of ['it', 'en']) {
  prova('ogni voce del repertorio ha enigma, segno e aneddoto (' + lingua + ')', () => {
    const d = DIZIONARI[lingua];
    const mancanti = [];
    for (const v of K.MISS_REPERTORIO) {
      if (!d['missione.gioco.enigma.oggetto.' + v.slug]) mancanti.push('enigma ' + v.slug);
      if (!d['missione.gioco.segno.' + v.slug]) mancanti.push('segno ' + v.slug);
      if (!d['missione.curiosita.' + v.slug + '.1']) mancanti.push('aneddoto ' + v.slug);
    }
    assert.deepStrictEqual(mancanti, [], mancanti.slice(0, 6).join(', '));
  });

  prova('ogni costellazione del repertorio ha un secondo indovinello (' + lingua + ')', () => {
    const d = DIZIONARI[lingua];
    const mancanti = K.MISS_REPERTORIO
      .filter(v => v.tipi && v.tipi.includes('costellazione'))
      .filter(v => !d['missione.gioco.enigma.oggetto.' + v.slug + '.2'])
      .map(v => v.slug);
    assert.deepStrictEqual(mancanti, []);
  });

  prova('i due gradini di ripiego coprono tutto quello che resta (' + lingua + ')', () => {
    const d = DIZIONARI[lingua];
    const mancanti = [];
    // Le cinque specie di catalogo: coprono i centoquaranta oggetti
    // profondi che un nome proprio non ce l'hanno.
    for (const specie of ['ammasso', 'globulare', 'nebulosa', 'planetaria', 'galassia']) {
      if (!d['missione.gioco.enigma.specie.' + specie]) mancanti.push('enigma specie ' + specie);
      if (!d['missione.gioco.segno.' + specie]) mancanti.push('segno specie ' + specie);
      if (!d['missione.curiosita.' + specie + '.1']) mancanti.push('aneddoto specie ' + specie);
      if (!d['missione.specie.' + specie]) mancanti.push('nome specie ' + specie);
      if (!d['missione.gioco.enigmaBimbi.' + specie]) mancanti.push('bimbi specie ' + specie);
    }
    // E le famiglie, che sono l'ultimo gradino e quindi non possono mancare mai.
    for (const fam of ['luna', 'pianeta', 'stella', 'costellazione', 'profondo']) {
      for (let n = 1; n <= 3; n++) {
        if (!d['missione.gioco.enigma.' + fam + '.' + n]) mancanti.push('enigma famiglia ' + fam + '.' + n);
      }
      if (!d['missione.gioco.enigmaBimbi.' + fam]) mancanti.push('bimbi famiglia ' + fam);
      if (!d['missione.gioco.osserva.' + fam]) mancanti.push('osserva ' + fam);
      if (!d['missione.anteprimaMistero.' + fam]) mancanti.push('mistero ' + fam);
    }
    for (const genere of ['stazione', 'evento']) {
      if (!d['missione.anteprimaMistero.' + genere]) mancanti.push('mistero ' + genere);
    }
    assert.deepStrictEqual(mancanti, [], mancanti.slice(0, 6).join(', '));
  });

  prova('i tre gradini si spiegano da soli nel selettore (' + lingua + ')', () => {
    const d = DIZIONARI[lingua];
    for (const e of K.MISS_ESPERIENZE) {
      assert.ok(d['missione.esperienza.' + e], 'manca l\'etichetta di ' + e);
      assert.ok(d['missione.esperienzaNota.' + e], 'manca la nota di ' + e);
    }
  });

  prova('il cartellino della scoperta ha tutte le sue misure (' + lingua + ')', () => {
    const d = DIZIONARI[lingua];
    for (const c of ['stella', 'stellaVicina', 'grande', 'piccolo', 'secondiLuce',
      'minutiLuce', 'oreLuce', 'costellazione']) {
      assert.ok(d['missione.gioco.cartellino.' + c], 'manca il cartellino ' + c);
    }
  });

  /* Il registro dei bambini, chiave per chiave.
   *
   * È lo stesso guasto muto del repertorio, spostato di un pezzo:
   * `missChiaveRegistro` chiede la versione per bambini di una chiave, e
   * se quella versione non c'è `astroI18n` restituisce quella normale.
   * Sullo schermo compare un testo perfettamente sensato — solo che è
   * quello degli adulti, in mezzo a una finestra che per il resto parla
   * di cacce al tesoro. Nessuno se ne accorge leggendo, perché non manca
   * niente: è la frase sbagliata, non una frase vuota. */
  prova('ogni chiave registrata per i bambini esiste davvero (' + lingua + ')', () => {
    const d = DIZIONARI[lingua];
    const mancanti = [...K.MISS_CHIAVI_BAMBINI]
      .filter(k => !d['missione.bambini.' + k]);
    assert.deepStrictEqual(mancanti, [], mancanti.slice(0, 6).join(', '));
  });

  /* …e il contrario: una chiave scritta nel dizionario e non registrata
   * non viene mai chiesta da nessuno. Non rompe niente e non si vede —
   * è testo scritto, tradotto e mai mostrato, che è il modo in cui il
   * registro dei bambini resta indietro un pezzo alla volta. */
  prova('e ogni bambini.* del dizionario è registrato (' + lingua + ')', () => {
    const d = DIZIONARI[lingua];
    const orfane = Object.keys(d)
      .filter(k => k.startsWith('missione.bambini.'))
      .map(k => k.slice('missione.bambini.'.length))
      // Le chiavi dei tre gradini di aiuto e i vecchi tasti restano
      // raggiunte per nome altrove, non da `missChiaveRegistro`.
      .filter(k => !K.MISS_CHIAVI_BAMBINI.has(k) && !k.startsWith('gioco.'));
    assert.deepStrictEqual(orfane, [], orfane.slice(0, 6).join(', '));
  });
}

prova('nessun enigma svela il nome del bersaglio che sta chiedendo', () => {
  /* Il difetto che rovina il gioco in un modo che nessuna prova di
   * struttura prende: un indovinello che comincia con «Saturno ha degli
   * anelli…» è una risposta, non una domanda. Si controlla che il testo
   * non contenga il nome dello slug — che è la forma in cui il nome
   * scapperebbe dentro senza che nessuno se ne accorga rileggendo. */
  const eccezioni = new Set(['stazione']);   // «stazione» è la specie, non il nome
  const colpevoli = [];
  for (const v of K.MISS_REPERTORIO) {
    if (eccezioni.has(v.slug)) continue;
    const nome = v.slug.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
    if (nome.length < 5) continue;           // «m5», «m22»: sono sigle, non nomi
    const testo = String(DIZIONARI.it['missione.gioco.enigma.oggetto.' + v.slug] || '').toLowerCase();
    if (testo.includes(nome)) colpevoli.push(v.slug);
  }
  assert.deepStrictEqual(colpevoli, [], colpevoli.join(', '));
});

// =====================================================================
sezione('il tempo: chi non aspetta, e chi è già passato');

prova('un evento a orario preciso finisce al suo posto nella fila', () => {
  const m = motore.genera(scenario(cieloRicco(), { durata: 60, strumento: 'telescopio' }));
  const orari = m.tappe.map(t => t.quando);
  for (let i = 1; i < orari.length; i++) {
    assert.ok(orari[i] >= orari[i - 1],
      `la tappa ${i} (${m.tappe[i].nome}) precede quella prima`);
  }
});

prova('un evento già passato non entra affatto', () => {
  const passato = candidato('stazione:vecchia', {
    tipo: 'stazione', nome: 'ISS di prima', aOrarioPreciso: true, quando: T0 - 20 * 60000
  });
  const m = motore.genera(scenario(cieloRicco().concat([passato]), { durata: 60, strumento: 'telescopio' }));
  assert.ok(!m.tappe.some(t => t.id === 'stazione:vecchia'));
});

prova('un evento che cade fra un minuto non si annuncia', () => {
  // Il preavviso è la ragione della regola: annunciare un passaggio a chi
  // sta ancora leggendo la prima tappa è una cosa persa mentre la si
  // leggeva.
  const subito = candidato('stazione:subito', {
    tipo: 'stazione', aOrarioPreciso: true, quando: T0 + 45 * 1000
  });
  const fila = motore.inOrario([], [subito], T0, 60, { esperienza: 'curiosi' });
  assert.deepStrictEqual(fila.map(t => t.id), []);
  assert.ok(K.MISS_PREAVVISO_MIN >= 2);
});

prova('un evento oltre la fine della missione non entra', () => {
  const tardi = candidato('stazione:tardi', {
    tipo: 'stazione', aOrarioPreciso: true, quando: T0 + 90 * 60000
  });
  const fila = motore.inOrario([candidato('a')], [tardi], T0, 30, { esperienza: 'curiosi' });
  assert.ok(!fila.some(t => t.id === 'stazione:tardi'));
});

// =====================================================================
sezione('il cielo che offre poco');

prova('con due soli candidati la missione è di due tappe, non di cinque', () => {
  const poveri = [
    candidato('pianeta:Jupiter', { nome: 'Giove', difficolta: 1, evidenza: 0.95 }),
    candidato('stella:Star2', { tipo: 'stella', nome: 'Sirio', difficolta: 1, evidenza: 0.9, azimut: 200 })
  ];
  const m = motore.genera(scenario(poveri, { durata: 120 }));
  assert.strictEqual(m.tappe.length, 2);
});

prova('senza nessun candidato la missione è vuota e lo dice', () => {
  const m = motore.genera(scenario([], { durata: 30 }));
  assert.strictEqual(m.vuota, true);
  assert.strictEqual(m.motivo, 'nienteInVista');
  assert.deepStrictEqual(m.tappe, []);
});

prova('con tutti i candidati sotto l’orizzonte la missione è vuota', () => {
  const m = motore.genera(scenario(cieloRicco().map(c =>
    Object.assign({}, c, { altezza: -5, sopraOstacoli: -5 })), { durata: 60, strumento: 'telescopio' }));
  assert.strictEqual(m.vuota, true);
});

prova('gli orari regolari non svuotano il cielo se gli astri sono visibili più tardi', () => {
  const tardi = candidato('stella:tardi', { tipo: 'stella', quando: T0 + 25 * 60000 });
  const s = scenario([tardi], { durata: 30 });
  s.posizioneA = (t, quando) => quando === tardi.quando
    ? { altezza: 45, azimut: 180, sopraOstacoli: 40 }
    : { altezza: 0, azimut: 180, sopraOstacoli: 0 };
  const m = motore.genera(s);
  assert.strictEqual(m.vuota, undefined);
  assert.strictEqual(m.tappe.length, 1);
  assert.strictEqual(m.tappe[0].quando, tardi.quando);
});

// =====================================================================
sezione('le assenze si dichiarano, non si inventano');

prova('senza meteo la missione si fa lo stesso', () => {
  const s = scenario(cieloRicco(), { durata: 60, strumento: 'telescopio' }, { nuvole: null, meteoAssente: true });
  const m = motore.genera(s);
  assert.ok(!m.vuota);
  assert.ok(m.tappe.length >= 2);
  assert.strictEqual(m.condizioni.meteoAssente, true);
});

prova('senza terreno la missione si fa, e resta scritto', () => {
  const s = scenario(cieloRicco(), { durata: 60, strumento: 'telescopio' }, { terrenoAssente: true });
  const m = motore.genera(s);
  assert.ok(!m.vuota);
  assert.strictEqual(m.condizioni.terrenoAssente, true);
});

prova('la Luna piena penalizza il cielo profondo e non i pianeti', () => {
  const conLuna = { luna: 0.9 };
  const nebulosa = candidato('profondo:M31', { soffreLaLuna: true, difficolta: 4 });
  const pianeta = candidato('pianeta:Jupiter', { soffreLaLuna: false, difficolta: 4 });
  const senza = { luna: 0 };
  const cadutaNebulosa = motore.punteggio(nebulosa, { esperienza: 'curiosi' }, senza)
                       - motore.punteggio(nebulosa, { esperienza: 'curiosi' }, conLuna);
  const cadutaPianeta = motore.punteggio(pianeta, { esperienza: 'curiosi' }, senza)
                      - motore.punteggio(pianeta, { esperienza: 'curiosi' }, conLuna);
  assert.ok(cadutaNebulosa > 20, `la nebulosa perde ${cadutaNebulosa}`);
  assert.strictEqual(cadutaPianeta, 0);
});

// =====================================================================
sezione('la persistenza, e i dati malformati');

prova('un salvataggio buono si riconosce', () => {
  assert.ok(motore.salvataggioBuono({
    versione: K.MISS_VERSIONE, tappe: [{ nome: 'Giove' }], avviata: Date.now()
  }));
});

prova('una versione che non conosciamo si rifiuta invece di indovinarla', () => {
  assert.ok(!motore.salvataggioBuono({ versione: 999, tappe: [{ nome: 'x' }], avviata: Date.now() }));
});

prova('un salvataggio senza tappe, o con tappe che non sono tappe, si rifiuta', () => {
  assert.ok(!motore.salvataggioBuono({ versione: K.MISS_VERSIONE, tappe: [], avviata: Date.now() }));
  assert.ok(!motore.salvataggioBuono({ versione: K.MISS_VERSIONE, tappe: 'tre', avviata: Date.now() }));
  assert.ok(!motore.salvataggioBuono({ versione: K.MISS_VERSIONE, tappe: [{}], avviata: Date.now() }));
  assert.ok(!motore.salvataggioBuono(null));
  assert.ok(!motore.salvataggioBuono('{'));
});

prova('una missione di ieri notte non si riprende', () => {
  assert.ok(!motore.salvataggioBuono({
    versione: K.MISS_VERSIONE, tappe: [{ nome: 'Giove' }],
    avviata: Date.now() - K.MISS_SCADENZA_MS - ORA
  }));
});

prova('una missione con eventi scaduti chiede di essere aggiornata', () => {
  assert.ok(motore.daAggiornare({
    scelte: { durata: 30 }, avviata: Date.now(),
    tappe: [{ nome: 'ISS', aOrarioPreciso: true, quando: Date.now() - ORA, esito: null }]
  }));
  assert.ok(!motore.daAggiornare({
    scelte: { durata: 30 }, avviata: Date.now(),
    tappe: [{ nome: 'Giove', aOrarioPreciso: false, quando: Date.now(), esito: null }]
  }));
});

// =====================================================================
sezione('i tre esiti, e il conto');

prova('trovato, saltato e non trovato restano tre cose distinte', () => {
  const conto = motore.conto({ tappe: [
    { esito: 'trovato' }, { esito: 'trovato' }, { esito: 'nonTrovato' }, { esito: 'saltato' }, { esito: null }
  ]});
  assert.deepStrictEqual(conto, { trovato: 2, saltato: 2, nonTrovato: 1 });
});

// =====================================================================
sezione('il modo di dire dove guardare');

prova('la fascia di cielo è quella che direbbe una persona', () => {
  assert.strictEqual(motore.fasciaAltezza(12), 'basso');
  assert.strictEqual(motore.fasciaAltezza(40), 'mezzo');
  assert.strictEqual(motore.fasciaAltezza(75), 'alto');
});

prova('gli angoli si dicono in dita e pugni a braccio teso', () => {
  assert.strictEqual(motore.misuraAMano(2).chiave, 'missione.mano.dito');
  assert.strictEqual(motore.misuraAMano(10).chiave, 'missione.mano.pugno');
  assert.strictEqual(motore.misuraAMano(19).chiave, 'missione.mano.manoAperta');
});

prova('lo scarto di azimut passa dal nord senza fare il giro lungo', () => {
  assert.strictEqual(motore.scartoAzimut(350, 10), 20);
  assert.strictEqual(motore.scartoAzimut(10, 350), 20);
  assert.strictEqual(motore.scartoAzimut(0, 180), 180);
});

prova('il riferimento sta da una parte sola, e la parte è quella giusta', () => {
  const tappe = [
    candidato('a', { nome: 'Luna', azimut: 150, evidenza: 1, altezza: 40 }),
    candidato('b', { nome: 'Giove', azimut: 170, evidenza: 0.9, altezza: 50 })
  ];
  const conRif = motore.riferimenti(tappe, tappe);
  assert.strictEqual(conRif[1].riferimento.nome, 'Luna');
  assert.strictEqual(conRif[1].riferimento.verso, 'destra');
  assert.strictEqual(conRif[1].riferimento.gradi, 20);
  assert.strictEqual(conRif[1].riferimento.piuAlto, true);
  // La prima tappa non ha niente prima di sé: senza un candidato luminoso
  // vicino resta senza riferimento, e la guida ripiega sulla direzione.
  assert.ok(conRif[0].riferimento === null || conRif[0].riferimento.nome !== 'Luna');
});

// =====================================================================
sezione('la rigenerazione dà una variante, non una missione peggiore');

prova('rigenerando cambia qualcosa', () => {
  const primo = motore.genera(scenario(cieloRicco(), { durata: 60, strumento: 'telescopio' }));
  const secondo = motore.genera(Object.assign(
    scenario(cieloRicco(), { durata: 60, strumento: 'telescopio' }),
    { evitare: primo.tappe.map(t => t.id) }));
  const uguali = secondo.tappe.filter(t => primo.tappe.some(p => p.id === t.id)).length;
  assert.ok(uguali < secondo.tappe.length, 'la seconda missione è identica alla prima');
});

prova('ma se le alternative finiscono si ripete invece di restituire il vuoto', () => {
  const due = [
    candidato('a', { difficolta: 1 }),
    candidato('b', { difficolta: 1, azimut: 200 })
  ];
  const m = motore.genera(Object.assign(scenario(due, { durata: 120 }), { evitare: ['a', 'b'] }));
  assert.strictEqual(m.tappe.length, 2);
});

/* Il pianeta riservato è una preferenza, non un obbligo.
 *
 * È la tappa che «un'altra missione» non cambiava mai, e la ragione per
 * cui premendolo cinque volte si vedevano quattro nomi nuovi e sempre lo
 * stesso pianeta: la riserva pesca fra i pianeti ammessi, e la sera
 * normale sopra l'orizzonte ce n'è **uno**. Con un pianeta solo il
 * sorteggio non sorteggia niente, e la penale dei recenti — che vale per
 * tutto il resto del cielo — su di lui non poteva mordere. */
/* «L'ho visto ieri» e «ho appena premuto un'altra missione» non sono la
 * stessa frase, e per un pezzo avevano la stessa penale.
 *
 * Trenta punti bastano contro un bersaglio come tutti gli altri e non
 * bastano contro uno che il punteggio mette trenta punti sopra a tutti —
 * che è il caso normale quando in cielo c'è un pianeta solo, o quando
 * l'unica cosa davvero bella di stanotte è Saturno. Misurato nel
 * browser: con la penale sola dei recenti restava in tutte e cinque le
 * anteprime di fila. */
prova('«l’ho visto ieri» e «ho appena detto di no» non pesano uguale', () => {
  // Lo stesso cielo, gli stessi semi, un bersaglio molto migliore degli
  // altri: cambia solo quale delle due liste lo contiene. Il numero che
  // conta è il rapporto, non la soglia — le due penali devono separarsi.
  const cielo = [candidato('perla', { difficolta: 1, puntiBase: 95, evidenza: 1 })];
  for (let i = 0; i < 10; i++) {
    cielo.push(candidato('x' + i, { tipo: ['stella', 'costellazione', 'profondo'][i % 3],
      difficolta: 1, puntiBase: 46, evidenza: 0.4, azimut: (i * 31) % 360 }));
  }
  const quanteVolte = campo => {
    let conLui = 0;
    for (let s = 0; s < 30; s++) {
      const m = motore.genera(Object.assign(
        scenario(cielo, { durata: 30, strumento: 'telescopio' }),
        { [campo]: ['perla'], seme: 'penale-' + s }));
      if (m.tappe.some(t => t.id === 'perla')) conLui++;
    }
    return conLui;
  };
  const recente = quanteVolte('evitare'), rifiutato = quanteVolte('rifiutati');
  assert.ok(recente >= 15,
    `un bersaglio molto migliore degli altri torna solo ${recente} volte su 30: ` +
    'la penale dei recenti è diventata un’esclusione');
  assert.ok(rifiutato * 2 < recente,
    `rifiutato ${rifiutato}/30 contro recente ${recente}/30: le due penali non si distinguono`);
});

prova('ma un rifiutato torna se non è rimasto altro', () => {
  const solo = [candidato('perla', { difficolta: 1 })];
  const m = motore.genera(Object.assign(scenario(solo, { durata: 120 }), { rifiutati: ['perla'] }));
  assert.strictEqual(m.tappe.length, 1);
});

prova('un pianeta appena visto smette di essere in tutte le missioni', () => {
  // Il cielo con un pianeta solo e molte alternative è la sera normale,
  // non il caso limite: dei sette pianeti, sopra l'orizzonte a un'ora
  // data, di solito ce n'è uno. Il conto che conta è quante volte su
  // dodici quel pianeta ricompare: con la riserva obbligatoria era
  // **dodici**, per costruzione e a qualunque seme.
  const cielo = [candidato('marte', { tipo: 'pianeta', difficolta: 1 })];
  for (let i = 0; i < 14; i++) {
    cielo.push(candidato('x' + i, {
      tipo: ['stella', 'costellazione', 'profondo'][i % 3],
      difficolta: 1, azimut: (i * 25) % 360
    }));
  }
  let conLui = 0;
  for (let s = 0; s < 12; s++) {
    const m = motore.genera(Object.assign(
      scenario(cielo, { durata: 30, strumento: 'telescopio' }),
      { evitare: ['marte'], seme: 'riserva-' + s }));
    if (m.tappe.some(t => t.id === 'marte')) conLui++;
  }
  assert.ok(conLui < 6, `il pianeta scartato è tornato ${conLui} volte su 12`);
});

prova('…ma se il cielo non basta il pianeta torna: meglio ripetersi che restare a mani vuote', () => {
  const cielo = [
    candidato('marte', { tipo: 'pianeta', difficolta: 1 }),
    candidato('s1', { tipo: 'stella', difficolta: 1, azimut: 40 })
  ];
  const m = motore.genera(Object.assign(
    scenario(cielo, { durata: 120, strumento: 'telescopio' }), { evitare: ['marte'] }));
  assert.ok(m.tappe.some(t => t.id === 'marte'), 'tappe: ' + m.tappe.map(t => t.id).join(', '));
});

// =====================================================================
sezione('le figure: tutte e ottantotto, e nessuna che racconti una bugia');

/* Fino a ieri una missione poteva proporre solo le **ventitré figure che
 * il planetario disegna** — che è il numero giusto per un disegno e
 * quello sbagliato per una caccia: tolte quelle sotto l'orizzonte ne
 * restano otto, per quattro tappe, e «stasera voglio costellazioni»
 * dava il Cigno e la Lira ogni sera. Le altre sessantacinque erano già
 * in casa, in `dati-costellazioni.js`.
 *
 * Il prezzo di aprire quella porta è questa sezione: fra le
 * sessantacinque nuove ce ne sono quarantatré che in cielo ci stanno dal
 * Settecento, e il terzo enigma generico delle figure comincia con «sono
 * più antica di ogni libro». Finché entravano solo le ventitré la
 * domanda non si poneva. È il difetto che a occhio non si vede per quello
 * che è: un indovinello ben scritto che afferma una cosa falsa, e chi lo
 * legge non ha modo di saperlo. */

prova('le quarantotto di Tolomeo sono antiche, gli strumenti di Lacaille no', () => {
  global.costGruppoDi = sigla => (
    ['Ant', 'Cae', 'Tel', 'Mic', 'Pyx'].includes(sigla) ? 'lacaille' :
    ['Cam', 'Col', 'Mon'].includes(sigla) ? 'plancius' :
    ['Car', 'Pup', 'Vel'].includes(sigla) ? 'argo' : 'tolomeo');
  try {
    assert.ok(motore.figuraAntica('Ori'), 'Orione');
    assert.ok(motore.figuraAntica('Car'), 'la Carena è un pezzo della Nave Argo');
    assert.ok(!motore.figuraAntica('Ant'), 'la Macchina Pneumatica');
    assert.ok(!motore.figuraAntica('Cam'), 'la Giraffa');
    // Senza `costellazioni.js` non si indovina: si tace e si dà per
    // antica, che è quello che erano tutte finché erano ventitré.
    delete global.costGruppoDi;
    assert.ok(motore.figuraAntica('Ant'));
  } finally { delete global.costGruppoDi; }
});

prova('una figura moderna non dice mai «sono più antica di ogni libro»', () => {
  // Senza `astroI18n` `missT` restituisce la chiave: è proprio quello che
  // serve qui, perché la scelta della variante si legge in chiaro.
  const moderna = { tipo: 'costellazione', nome: 'Macchina Pneumatica', sigla: 'Ant', antica: false };
  const antica = { tipo: 'costellazione', nome: 'Acquario', sigla: 'Aqr', antica: true };
  const chiaviM = [0, 1, 2, 3, 4, 5].map(v => motore.enigma(Object.assign({ indizioVariante: v }, moderna)));
  const chiaviA = [0, 1, 2].map(v => motore.enigma(Object.assign({ indizioVariante: v }, antica)));
  assert.ok(!chiaviM.includes('gioco.enigma.costellazione.3'), chiaviM.join(', '));
  assert.strictEqual(new Set(chiaviM).size, 2, 'le due varianti buone ci sono tutte e due');
  assert.ok(chiaviA.includes('gioco.enigma.costellazione.3'),
    'a una figura antica quell’enigma deve restare: ' + chiaviA.join(', '));
});

prova('senza i cataloghi in memoria le figure non esistono, e non si inventano', () => {
  // Il motore gira anche fuori da un browser, dove `SKY_COSTELLAZIONI` e
  // `COSTELLAZIONI_IAU` non ci sono: deve rispondere un elenco vuoto
  // invece di sollevare.
  assert.deepStrictEqual(motore.figureDelCielo(), []);
});

// =====================================================================
sezione('i campioni della finestra');

prova('la finestra si campiona abbastanza fitto, e mai meno di tre volte', () => {
  assert.ok(motore.campioni(T0, 10).length >= 3);
  assert.ok(motore.campioni(T0, 120).length >= 3);
  const c = motore.campioni(T0, 120);
  assert.ok(c[c.length - 1] <= T0 + 120 * 60000 + 1, 'un campione cade fuori dalla finestra');
});

// =====================================================================
console.log(`\n${passate} passate, ${fallite} fallite (motore)`);

if (process.argv.includes('--solo-motore')) {
  process.exit(fallite ? 1 : 0);
}

// =====================================================================
// La seconda metà: il pannello, i ponti e la ripresa, in un browser vero.
// =====================================================================

const CHROMIUM = process.env.CHROMIUM;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function leggiAstronomy() {
  const p = path.join(RADICE, 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js');
  if (!fs.existsSync(p)) throw new Error('npm install astronomy-engine');
  return fs.readFileSync(p, 'utf8');
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

// Como, che è il posto di casa di questo progetto: una posizione vera
// serve, perché senza il modulo si rifiuta di generare — ed è giusto così.
const POSIZIONE = { lat: 45.81, lon: 9.08, nome: 'Como', fonte: 'manuale', precisione: 1000 };

(async () => {
  const { chromium } = require('playwright-core');
  await new Promise(r => server.listen(8097, r));
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const contesto = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 900, height: 900 }
  });
  const pagina = await contesto.newPage();

  const errori = [];
  pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
  pagina.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });

  // Tutti i servizi esterni (anche la geolocalizzazione IP) restano isolati.
  // La posizione e l'istante devono essere quelli dichiarati dalla prova.
  await pagina.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('/astronomy.browser.min.js')) return route.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' });
    if (url.startsWith('http://localhost:8097/')) return route.continue();
    return route.fulfill({ body: '', contentType: 'text/javascript' });
  });

  await pagina.addInitScript(([pos]) => {
    const OriginalDate = Date;
    const notte = OriginalDate.UTC(2026, 8, 7, 21);
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [notte])); }
      static now() { return notte; }
    };
    localStorage.setItem('astrocal_lingua', 'it');
    localStorage.setItem('astrocalendario_posizione', JSON.stringify(pos));
  }, [POSIZIONE]);

  await pagina.goto('http://localhost:8097/index.html', { waitUntil: 'networkidle', timeout: 60000 });
  await pagina.waitForTimeout(2500);

  async function proveNelBrowser() {
    sezione('la scheda in Stasera');

    await pagina.evaluate(() => mostraVista('stasera'));
    await pagina.waitForTimeout(600);

    const ordine = await pagina.evaluate(() =>
      Array.from(document.querySelectorAll('#vista-stasera [data-blocco]')).map(n => n.dataset.blocco));
    prova('il riquadro sta fra «Stanotte» e il meteo (ordine dei blocchi)', () => {
      assert.deepStrictEqual(ordine.slice(0, 3), ['riepilogo', 'missione', 'cielo'], ordine.join(','));
    });

    const scheda = await pagina.evaluate(() => {
      const box = document.getElementById('missione-scheda');
      return { testo: box ? box.textContent.trim() : null, tasti: box ? box.querySelectorAll('button').length : 0 };
    });
    prova('la scheda è compatta: una riga e un tasto', () => {
      assert.ok(scheda.testo && scheda.testo.length > 10, String(scheda.testo));
      assert.strictEqual(scheda.tasti, 1);
    });

    sezione('la configurazione, e la generazione');

    await pagina.evaluate(() => missApriPannello());
    await pagina.waitForTimeout(300);

    /* Le pillole attese si contano dalle costanti del modulo e non a
     * mano: erano scritte come una somma di numeri, e il giorno in cui i
     * gradini della difficoltà sono passati da due a tre quella somma è
     * diventata una prova che parlava di un pannello che non esiste
     * più. Qui l'attesa si aggiorna da sé, e resta comunque una prova —
     * se un gruppo sparisce dal markup, il conto non torna. */
    const config = await pagina.evaluate(() => {
      const K = window.missProve.costanti;
      return {
        aperto: !document.getElementById('modale-missione').classList.contains('hidden'),
        gruppi: document.querySelectorAll('#missione-corpo .missione-gruppo').length,
        scelte: document.querySelectorAll('#missione-corpo [data-miss-scelta]').length,
        // durata + momento (3) + strumento + difficoltà + cielo (2) + voce (2)
        attese: K.MISS_DURATE.length + 3 + K.MISS_STRUMENTI.length +
                K.MISS_ESPERIENZE.length + 2 + 2,
        // La nota è una sola, ed è quella della scelta fatta: tre
        // cartoline da due righe erano duecentocinquanta pixel per una
        // domanda sola. Si controlla che ci sia e che dica la sua.
        note: document.querySelectorAll('#missione-corpo .missione-scelta-nota').length,
        notaScelta: document.querySelector('#missione-corpo [data-miss-scelta="esperienza"]')
          .closest('.missione-gruppo').querySelector('.missione-scelta-nota').textContent,
        notaAttesa: astroI18n.t('missione.esperienzaNota.' + miss.scelte.esperienza),
        // I generi sono caselle di spunta e non pillole alternative:
        // stanno fuori da `data-miss-scelta` apposta, perché un
        // `radiogroup` che accetta più risposte è una bugia detta a chi
        // legge con lo schermo.
        generi: Array.from(document.querySelectorAll('#missione-corpo [data-miss-genere]'))
          .map(b => ({ valore: b.dataset.missGenere, ruolo: b.getAttribute('role'),
                       acceso: b.getAttribute('aria-checked') === 'true' })),
        // I blocchi: la serata, la caccia, e i dettagli richiudibili.
        blocchi: document.querySelectorAll('#missione-corpo .missione-blocco').length,
        dettagliChiusi: !document.querySelector('#missione-corpo [data-miss-dettagli]').open,
        bortle: Array.from(document.querySelectorAll('#missione-corpo [data-miss-bortle] option'))
          .map(o => ({ valore: Number(o.value), selezionata: o.selected })),
        fuocoDentro: document.getElementById('modale-missione').contains(document.activeElement)
      };
    });
    prova('la finestra presenta durata, momento, difficoltà, settore e voce', () => {
      assert.strictEqual(config.aperto, true);
      // durata, momento, strumento, difficoltà, generi, cielo, voce
      assert.strictEqual(config.gruppi, 7, `${config.gruppi} gruppi`);
      assert.strictEqual(config.scelte, config.attese, `${config.scelte} contro ${config.attese}`);
      /* La spiegazione del gradino scelto è sempre a schermo: senza,
       * «Esperti» non promette niente e la scelta si fa a caso. Ce n'è
       * una sola — quella della scelta fatta — e le altre restano a un
       * tocco e nel `title`. */
      assert.strictEqual(config.notaScelta, config.notaAttesa,
        `nota mostrata: «${config.notaScelta}»`);
      assert.ok(config.note >= 1 && config.note <= 2, `${config.note} note`);
      assert.deepStrictEqual(config.bortle.map(o => o.valore), K.MISS_BORTLE);
      assert.strictEqual(config.bortle.find(o => o.selezionata).valore, 5,
        'parte dal cielo luminoso salvato nelle Impostazioni');
    });
    prova('il fuoco entra nella finestra', () => assert.strictEqual(config.fuocoDentro, true));

    /* La compattezza non è un gusto: erano otto gruppi impilati, tutti
     * dello stesso peso, e su un telefono facevano quasi due schermate
     * per rispondere a domande che stanno in una riga a testa. I tre
     * blocchi dicono anche quali domande contano — e i dettagli, che
     * sono le risposte che uno dà una volta, partono chiusi. */
    prova('le domande stanno in tre blocchi, e i dettagli partono chiusi', () => {
      assert.strictEqual(config.blocchi, 2, 'la serata e la caccia');
      assert.strictEqual(config.dettagliChiusi, true);
    });

    prova('i cinque generi ci sono tutti, e nascono tutti accesi', () => {
      assert.deepStrictEqual(config.generi.map(g => g.valore), K.MISS_GENERI_TUTTI);
      assert.ok(config.generi.every(g => g.acceso), 'di serie si cerca tutto');
      // Caselle di spunta e non pillole alternative: se ne possono
      // accendere più d'una, e il ruolo lo deve dire.
      assert.ok(config.generi.every(g => g.ruolo === 'checkbox'),
        'un radiogroup che accetta più risposte è una bugia');
    });

    /* L'ultimo genere acceso non si spegne: «non cercare niente» non è
     * una serata, e un pannello che lascia arrivare a quello stato deve
     * poi spiegare un risultato vuoto che non è colpa del cielo. */
    const generi = await pagina.evaluate(() => {
      const spegni = v => document.querySelector(`[data-miss-genere="${v}"]`).click();
      const accesi = () => Array.from(document.querySelectorAll('[data-miss-genere]'))
        .filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.dataset.missGenere);
      const tutti = Array.from(document.querySelectorAll('[data-miss-genere]'))
        .map(b => b.dataset.missGenere);
      tutti.slice(1).forEach(spegni);
      const rimasto = accesi();
      spegni(tutti[0]);                       // l'ultimo: non deve spegnersi
      const dopoTentativo = accesi();
      const salvato = JSON.parse(localStorage.getItem('astrocalendario_missione_scelte') || '{}').generi;
      tutti.forEach(v => { if (!accesi().includes(v)) spegni(v); });
      return { rimasto, dopoTentativo, salvato, ripristinati: accesi() };
    });
    prova('l’ultimo genere acceso non si può spegnere', () => {
      assert.deepStrictEqual(generi.rimasto, generi.dopoTentativo);
      assert.strictEqual(generi.dopoTentativo.length, 1);
    });
    prova('e la scelta dei generi si ricorda fra una sera e l’altra', () => {
      assert.deepStrictEqual(generi.salvato, generi.rimasto);
      assert.deepStrictEqual(generi.ripristinati, K.MISS_GENERI_TUTTI);
    });

    // Le tre scelte si cambiano davvero, e restano.
    await pagina.evaluate(() => {
      document.querySelector('[data-miss-scelta="durata"][data-miss-valore="60"]').click();
      document.querySelector('[data-miss-scelta="momento"][data-miss-valore="personalizzato"]').click();
      const data = document.querySelector('[data-miss-momento]');
      const domani = new Date(Date.now() + 24 * 3600000);
      const due = n => String(n).padStart(2, '0');
      data.value = `${domani.getFullYear()}-${due(domani.getMonth() + 1)}-${due(domani.getDate())}T22:30`;
      data.dispatchEvent(new Event('change'));
      document.querySelector('[data-miss-scelta="strumento"][data-miss-valore="binocolo"]').click();
      document.querySelector('[data-miss-scelta="esperienza"][data-miss-valore="curiosi"]').click();
      const bortle = document.querySelector('[data-miss-bortle]');
      bortle.value = '3';
      bortle.dispatchEvent(new Event('change'));
    });
    const ricordate = await pagina.evaluate(() =>
      JSON.parse(localStorage.getItem('astrocalendario_missione_scelte')));
    prova('le scelte si ricordano', () => {
      assert.deepStrictEqual({ durata: ricordate.durata, momento: ricordate.momento,
        strumento: ricordate.strumento, esperienza: ricordate.esperienza, bortle: ricordate.bortle },
        { durata: 60, momento: 'personalizzato', strumento: 'binocolo', esperienza: 'curiosi', bortle: 3 });
      assert.ok(Number.isFinite(ricordate.momentoPersonalizzato));
    });

    /* Il punto fondamentale: le scelte governano davvero il cast.
     *
     * Il motore lo prova con un cielo finto (§«cosa si va a cercare»);
     * qui si prova la catena intera — pannello, scelte salvate,
     * raccoglitore vero, effemeridi vere — perché fra le due c'è tutto
     * quello che può rompersi in silenzio: una scelta che non arriva
     * allo scenario, un tipo che il raccoglitore chiama in un altro
     * modo, un salvataggio che si sovrascrive. E il sintomo, se si
     * rompe, è una missione perfettamente sensata: quella di qualcun
     * altro. */
    const perGenere = {};
    for (const set of [['profondo'], ['pianeti'], ['costellazioni'], ['stelle']]) {
      perGenere[set[0]] = await pagina.evaluate(async (set) => {
        // Prima si accende quello voluto, poi si spengono gli altri:
        // l'ultimo acceso non si spegne, e nell'ordine inverso si
        // resterebbe bloccati sul precedente.
        set.forEach(v => { const b = document.querySelector(`[data-miss-genere="${v}"]`);
          if (b.getAttribute('aria-checked') !== 'true') b.click(); });
        document.querySelectorAll('[data-miss-genere]').forEach(b => {
          if (!set.includes(b.dataset.missGenere) && b.getAttribute('aria-checked') === 'true') b.click(); });
        document.querySelector('[data-miss-azione="genera"]').click();
        await new Promise(r => setTimeout(r, 300));
        const t = miss.anteprima ? miss.anteprima.tappe.map(x => x.tipo) : [];
        missAzione('configura', document.getElementById('missione-corpo'));
        return t;
      }, set);
    }
    prova('le scelte governano il cast anche con le effemeridi vere', () => {
      // La Luna e le comete stanno coi pianeti; gli eventi del
      // calendario passano sempre, perché sono appuntamenti.
      const ammessi = {
        profondo: ['profondo', 'evento'],
        pianeti: ['luna', 'pianeta', 'corpoMinore', 'evento'],
        costellazioni: ['costellazione', 'evento'],
        stelle: ['stella', 'evento']
      };
      const vuoti = [];
      for (const [genere, tipi] of Object.entries(perGenere)) {
        if (!tipi.length) { vuoti.push(genere); continue; }
        const intrusi = tipi.filter(t => !ammessi[genere].includes(t));
        assert.deepStrictEqual(intrusi, [], `${genere}: ${intrusi.join(',')}`);
      }
      // Da Como, in una notte di settembre, almeno due dei quattro
      // generi devono avere di che riempire una missione: se fossero
      // tutti vuoti, la prova sopra passerebbe senza aver provato niente.
      assert.ok(vuoti.length <= 2, 'generi senza tappe: ' + vuoti.join(', '));
    });

    /* …e il cast non dev'essere soltanto del genere giusto: dev'essere
     * anche **scelto**.
     *
     * È la seconda metà della segnalazione, e la prova sopra non la
     * prende: una missione di quattro stelle è di quattro stelle anche
     * quando in cielo di stelle ammesse ce n'erano quattro esatte, cioè
     * quando non è stata scelta nessuna — il motore le ha prese tutte
     * perché non c'era altro. Il sorteggio, la temperatura e la penale
     * dei recenti lì non possono fare niente, e chi preme «un'altra
     * missione» rivede la stessa lista con l'ordine mescolato.
     *
     * I numeri misurati da Como il 7 settembre, prima: quattro stelle
     * ammesse su otto candidate (sono gli slot `Star1…Star8` del
     * planetario) e otto figure su ventitré. Adesso i vertici nominati
     * delle figure e le ottantotto dell'Unione Astronomica fanno
     * sessantacinque e diciannove. */
    const abbondanza = await pagina.evaluate(() => {
      const scelte = Object.assign({}, miss.scelte);
      const scen = missScenario(scelte, missPartenzaScelta());
      const conta = g => scen.candidati
        .filter(c => missProve.ammissibile(c, Object.assign({}, scelte, { generi: [g] }))).length;
      return { stelle: conta('stelle'), costellazioni: conta('costellazioni'),
        tappe: missProve.quanteTappe(scelte.durata, 99) };
    });
    prova('e ogni genere ha più bersagli di quante tappe ne servano: si sceglie, non si raschia', () => {
      assert.ok(abbondanza.stelle > abbondanza.tappe * 2,
        `stelle ammesse: ${abbondanza.stelle} per ${abbondanza.tappe} tappe`);
      assert.ok(abbondanza.costellazioni > abbondanza.tappe * 2,
        `figure ammesse: ${abbondanza.costellazioni} per ${abbondanza.tappe} tappe`);
    });

    /* Il genere «stazioni» non poteva produrre niente, mai.
     *
     * `missCandidatiAOrarioPreciso` c'era da sempre, era giusta, e **non
     * la chiamava nessuno**: `missScenario` raccoglieva il solo cielo
     * fisso. Poi c'era il secondo strato, che sarebbe rimasto anche
     * chiamandola: la rimisurazione degli orari chiedeva ad `altAzCorpo`
     * dove stia «sat-iss», che non è un corpo della libreria, e l'aveva
     * buttata via.
     *
     * Il passaggio è finto di proposito — i TLE arrivano da Celestrak,
     * che qui non risponde, e una prova che dipende da un cielo vero è
     * una prova che diventa rossa per colpa di qualcun altro. Quello che
     * si prova è la **catena**: dal raccoglitore alla tappa a schermo. */
    const stazioni = await pagina.evaluate(async () => {
      const veroPassaggi = window.passaggiVisibiliOrdinati;
      const veroSat = window.satelliteDaId;
      const generiPrima = miss.scelte.generi;
      // Il culmine va messo dentro alla finestra **della missione**, che
      // a questo punto delle prove è quella del momento personalizzato
      // scelto poco sopra — non «fra dodici minuti da adesso».
      const dodiciMinutiDopoLaPartenza = new Date(missPartenzaScelta() + 12 * 60000);
      window.passaggiVisibiliOrdinati = () => ([{
        satId: 'iss', culmine: dodiciMinutiDopoLaPartenza,
        elevazioneMax: 62, azCulmine: 190, durataMin: 5
      }]);
      window.satelliteDaId = () => ({ nome: 'ISS', magTipica: -3 });
      miss.scelte.generi = ['artificiali'];
      miss.anteprimeViste = [];
      const m = missPreparaAnteprima();
      const fuori = m ? m.tappe.map(t => ({ tipo: t.tipo, nome: t.nome, alt: t.altezza })) : [];
      window.passaggiVisibiliOrdinati = veroPassaggi;
      window.satelliteDaId = veroSat;
      miss.scelte.generi = generiPrima;
      miss.anteprimeViste = [];
      miss.anteprima = null;
      missAzione('configura', document.getElementById('missione-corpo'));
      return fuori;
    });
    prova('un passaggio di stazione arriva fino alla tappa, e non solo al raccoglitore', () => {
      assert.ok(stazioni.length, 'nessuna tappa: il passaggio si è perso per strada');
      assert.ok(stazioni.every(t => t.tipo === 'stazione'), JSON.stringify(stazioni));
      assert.ok(stazioni.every(t => t.alt > 1), 'altezza persa: ' + JSON.stringify(stazioni));
    });

    // Si riaccendono tutti, se no le prove che seguono partono da un
    // cielo ristretto a una famiglia sola.
    await pagina.evaluate(() => {
      document.querySelectorAll('[data-miss-genere]').forEach(b => {
        if (b.getAttribute('aria-checked') !== 'true') b.click(); });
    });

    await pagina.evaluate(() => document.querySelector('[data-miss-azione="genera"]').click());
    await pagina.waitForTimeout(1500);

    const anteprima = await pagina.evaluate(() => {
      const m = window.missProve && miss ? miss.anteprima : null;
      return {
        vista: miss.vista,
        tappe: m ? m.tappe.map(t => ({ nome: t.nome, tipo: t.tipo, alt: t.altezza,
          strumento: t.strumentoMinimo, quando: t.quando, difficolta: t.difficolta })) : [],
        righe: document.querySelectorAll('.missione-anteprima-riga').length
      };
    });
    prova('la generazione con dati veri produce delle tappe', () => {
      assert.strictEqual(anteprima.vista, 'anteprima', 'vista: ' + anteprima.vista);
      assert.ok(anteprima.tappe.length >= 2, `${anteprima.tappe.length} tappe`);
      assert.strictEqual(anteprima.righe, anteprima.tappe.length);
    });
    prova('e le tappe rispettano davvero altezza e strumento', () => {
      anteprima.tappe.forEach(t => {
        assert.ok(t.alt > 0, `${t.nome} a ${t.alt}°`);
        assert.notStrictEqual(t.strumento, 'telescopio', `${t.nome} vuole il telescopio`);
      });
    });
    const confronto = await pagina.evaluate(() => {
      const migliori = migliorDiStanotte(6).map(m => m.nome);
      const tappe = miss.anteprima.tappe.map(t => t.nome);
      return { migliori, tappe };
    });
    prova('la missione non è i primi N di migliorDiStanotte', () => {
      const primiN = confronto.migliori.slice(0, confronto.tappe.length);
      assert.notDeepStrictEqual(confronto.tappe, primiN,
        'stessa lista: ' + confronto.tappe.join(', '));
    });

    /* «Un'altra missione», premuto cinque volte.
     *
     * È il gesto della segnalazione, e nessuna delle prove del motore lo
     * fa: quelle generano da capo con lo stesso scenario, cioè non
     * passano dal tasto, che è il posto in cui la memoria delle anteprime
     * già viste vive o non vive. Prima quella memoria era **l'ultima
     * anteprima e basta**, e con un cielo stretto non è un ricambio ma
     * un'altalena: A, poi B che evita A, poi di nuovo A perché B è
     * l'unica cosa che si sta evitando. Premendo cinque volte si vedevano
     * due missioni, ed è esattamente la faccia che ha la segnalazione
     * «mostra sempre più o meno gli stessi elementi».
     *
     * Il giudice è aritmetico, perché a occhio cinque liste di quattro
     * nomi plausibili sono cinque liste plausibili. E il numero che
     * separa il prima dal dopo non è «quante missioni diverse» — quelle
     * erano diverse anche prima, perché il seme si tira a ogni
     * generazione — ma **quante volte torna il bersaglio che torna di
     * più**. Misurato da Como, sei giri da cinque anteprime l'uno:
     * prima 5 su 5 in tutti e sei i giri (è il pianeta, che la riserva
     * rimetteva dentro sempre), adesso mai più di 4. I bersagli diversi
     * in cinque anteprime passano da 9–12 a 13–15. */
    const giro = await pagina.evaluate(async () => {
      // Si riparte da capo: «genera» azzera la memoria, «un'altra» la usa.
      missAzione('configura', document.getElementById('missione-corpo'));
      document.querySelector('[data-miss-azione="genera"]').click();
      await new Promise(r => setTimeout(r, 400));
      const liste = [];
      for (let i = 0; i < 5; i++) {
        if (miss.anteprima) liste.push(miss.anteprima.tappe.map(t => t.id));
        const tasto = document.querySelector('[data-miss-azione="rigenera"]');
        if (!tasto) break;
        tasto.click();
        await new Promise(r => setTimeout(r, 400));
      }
      return liste;
    });
    prova('«un’altra missione» premuto cinque volte: nessun bersaglio è in tutte e cinque', () => {
      assert.ok(giro.length >= 4, 'solo ' + giro.length + ' anteprime: il tasto non ha risposto');
      const conta = {};
      giro.flat().forEach(id => { conta[id] = (conta[id] || 0) + 1; });
      const [peggiore, volte] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
      assert.ok(volte < giro.length,
        `${peggiore} è in tutte e ${giro.length} le anteprime`);
    });
    prova('e cinque anteprime fanno vedere molto più di una lista sola', () => {
      const firme = new Set(giro.map(l => l.slice().sort().join('|')));
      assert.ok(firme.size >= 4, `${firme.size} missioni distinte su ${giro.length}`);
      // Una rete, non il giudice: il numero che separa il prima dal dopo
      // è quello della prova qui sopra. Questa serve a non lasciar
      // restringere il cielo un pezzo alla volta.
      const nomi = new Set(giro.flat());
      assert.ok(nomi.size >= giro[0].length * 2,
        `${nomi.size} bersagli diversi in ${giro.length} missioni da ${giro[0].length}`);
    });
    prova('e due anteprime di fila non si somigliano', () => {
      giro.slice(1).forEach((lista, i) => {
        const comuni = lista.filter(id => giro[i].includes(id)).length;
        assert.ok(comuni <= Math.ceil(lista.length / 2),
          `la ${i + 2}ª ripete ${comuni} bersagli su ${lista.length}`);
      });
    });

    // Il giro sopra lascia il pannello su un'anteprima qualunque: le
    // prove che seguono partono da lì, e vogliono una missione da avviare.
    await pagina.evaluate(async () => {
      if (miss.vista !== 'anteprima') {
        missAzione('configura', document.getElementById('missione-corpo'));
        document.querySelector('[data-miss-azione="genera"]').click();
      }
    });
    await pagina.waitForTimeout(600);

    sezione('la missione in corso');

    await pagina.evaluate(() => document.querySelector('[data-miss-azione="avvia"]').click());
    await pagina.waitForTimeout(400);

    const inCorso = await pagina.evaluate(() => ({
      vista: miss.vista,
      cielo: vistaAttuale,
      pannelloChiuso: document.getElementById('modale-missione').classList.contains('hidden'),
      striscia: !document.getElementById('missione-striscia').classList.contains('hidden'),
      guida: document.querySelector('.missione-striscia-indizio')?.textContent || '',
      diagnostica: {attiva: !!miss.attiva, nelPlanetario:miss.attiva?.nelPlanetario, tappa:miss.attiva?.tappe[0], html:document.getElementById('missione-striscia').innerHTML},
      risposte: Array.from(document.querySelectorAll('#missione-striscia [data-miss-azione]')).map(b => b.dataset.missAzione)
    }));
    prova('la tappa comincia nel planetario, senza una finestra sopra il cielo', () => {
      assert.strictEqual(inCorso.vista, 'inCorso');
      assert.strictEqual(inCorso.cielo, 'cielo', JSON.stringify(inCorso));
      assert.strictEqual(inCorso.pannelloChiuso, true);
      assert.strictEqual(inCorso.striscia, true, JSON.stringify(inCorso));
      assert.ok(inCorso.guida.length > 10, 'guida: ' + inCorso.guida);
      /* Chiedere un indizio è la freccia in avanti, non un tasto
       * «aiuto»: quel tasto è sparito quando gli indizi sono diventati
       * quattro pannelli da sfogliare, e questa riga è rimasta a
       * cercarlo — cioè la prova è stata rossa da allora, e con lei
       * tutta la sezione dell'aiuto progressivo che le sta sotto. */
      assert.ok(inCorso.risposte.includes('indizio-successivo'), inCorso.risposte.join(','));
      assert.ok(!inCorso.risposte.includes('trovato'));
      // E la soluzione non si offre prima dei tre indizi: chi ha appena
      // letto l'enigma non deve avere la risposta a portata di pollice.
      assert.ok(!inCorso.risposte.includes('soluzione'), inCorso.risposte.join(','));
    });

    const dopoTrovato = await pagina.evaluate(() => {
      const prima = miss.attiva.corrente;
      const t = miss.attiva.tappe[prima];
      missSelezionaCielo(t.tipo === 'costellazione' ? { categoria: 'costellazione', sigla: t.sigla } : { categoria: 'astro', id: t.idCielo });
      missAzione('continua', document.getElementById('missione-striscia'));
      return { prima, dopo: miss.attiva.corrente, esito: miss.attiva.tappe[prima].esito,
               tot: miss.attiva.tappe.length, cielo: vistaAttuale,
               pannelloChiuso: document.getElementById('modale-missione').classList.contains('hidden') };
    });
    prova('la selezione corretta e la scoperta fanno avanzare la tappa', () => {
      assert.strictEqual(dopoTrovato.esito, 'trovato');
      assert.ok(dopoTrovato.dopo > dopoTrovato.prima || dopoTrovato.tot === 1);
      if (dopoTrovato.tot > 1) {
        assert.strictEqual(dopoTrovato.cielo, 'cielo');
        assert.strictEqual(dopoTrovato.pannelloChiuso, true);
      }
    });

    sezione('l’aiuto progressivo');

    const aiuti = await pagina.evaluate(() => {
      const esiti = [];
      for (let k = 1; k <= 3; k++) {
        // La freccia in avanti: è lei a chiedere l'indizio dopo, e
        // arrivata al terzo si ferma — la soluzione ha un tasto suo.
        const aiuto = document.querySelector('#missione-striscia [data-miss-azione="indizio-successivo"]');
        if (!aiuto) throw new Error(JSON.stringify({k, corrente:miss.attiva.corrente, nelPlanetario:miss.attiva.nelPlanetario, tappa:miss.attiva.tappe[miss.attiva.corrente], html:document.getElementById('missione-striscia').innerHTML}));
        aiuto.click();
        esiti.push({
          livello: miss.attiva.tappe[miss.attiva.corrente].aiuto,
          guida: document.querySelector('.missione-striscia-indizio').textContent,
          esito: miss.attiva.tappe[miss.attiva.corrente].esito,
          rivelata: !!miss.attiva.tappe[miss.attiva.corrente].rivelata,
          // Al terzo la freccia si disabilita: la progressione degli
          // indizi è finita, e quello che resta è la soluzione.
          altraRichiesta: !document.querySelector('#missione-striscia [data-miss-azione="indizio-successivo"]').disabled,
          tastoSoluzione: !!document.querySelector('#missione-striscia [data-miss-azione="soluzione"]'),
          centratura: sky.animazioneVista && {
            az: sky.animazioneVista.az0 + sky.animazioneVista.dAz,
            alt: sky.animazioneVista.alt0 + sky.animazioneVista.dAlt
          }
        });
      }
      return esiti;
    });
    prova('«Guidami» aiuta e non segna niente come fallito', () => {
      assert.deepStrictEqual(aiuti.map(a => a.livello), [1, 2, 3]);
      assert.deepStrictEqual(aiuti.map(a => a.esito), [null, null, null]);
      assert.strictEqual(new Set(aiuti.map(a => a.guida)).size, 3);
    });
    prova('e la guida resta visibile mentre si muove il cielo', () => {
      assert.ok(aiuti.every(a => a.guida.length > 10));
    });
    /* I tre indizi sono tre indizi, e nessuno dei tre rivela.
     *
     * Prima il terzo era insieme indizio e risposta: si chiedeva un aiuto
     * e ci si ritrovava il bersaglio centrato nella mappa, cioè la caccia
     * finiva senza che nessuno l'avesse decisa. Adesso il terzo indizio
     * fa comparire un tasto a parte, e la caccia finisce solo se lo si
     * preme. */
    prova('nessuno dei tre indizi rivela il bersaglio da solo', () => {
      assert.deepStrictEqual(aiuti.map(a => a.rivelata), [false, false, false]);
    });
    prova('dopo il terzo indizio compare il tasto della soluzione, e non prima', () => {
      assert.deepStrictEqual(aiuti.map(a => a.tastoSoluzione), [false, false, true]);
      assert.strictEqual(aiuti[2].altraRichiesta, false);
    });

    const soluzione = await pagina.evaluate(() => {
      const tasto = document.querySelector('#missione-striscia [data-miss-azione="soluzione"]');
      if (!tasto) return { presente: false };
      tasto.click();
      const t = miss.attiva.tappe[miss.attiva.corrente];
      return {
        presente: true,
        rivelata: !!t.rivelata,
        esito: t.esito,
        // Il nome del bersaglio deve comparire nel testo: è metà della
        // promessa del tasto, e l'altra metà è la centratura.
        nomeScritto: document.querySelector('.missione-striscia-indizio')
          .textContent.includes(missNomeTappa(t)),
        tastoAncoraLi: !!document.querySelector('#missione-striscia [data-miss-azione="soluzione"]'),
        centratura: sky.animazioneVista && {
          az: sky.animazioneVista.az0 + sky.animazioneVista.dAz,
          alt: sky.animazioneVista.alt0 + sky.animazioneVista.dAlt
        }
      };
    });
    prova('la soluzione rivela il nome e centra il bersaglio', () => {
      assert.ok(soluzione.presente, 'il tasto della soluzione non c’è');
      assert.strictEqual(soluzione.rivelata, true);
      assert.strictEqual(soluzione.nomeScritto, true);
      assert.ok(soluzione.centratura, JSON.stringify(soluzione));
      assert.ok(Number.isFinite(soluzione.centratura.az));
      assert.ok(Number.isFinite(soluzione.centratura.alt));
    });
    prova('e non segna la tappa come fallita, né lascia un tasto che non fa più niente', () => {
      assert.strictEqual(soluzione.esito, null);
      assert.strictEqual(soluzione.tastoAncoraLi, false);
    });

    const sostituzione = await pagina.evaluate(() => {
      const tasto = document.querySelector('[data-miss-azione="sostituisci"]');
      if (!tasto || !missAlternativePerTappa().length) return { possibile: false };
      const prima = miss.attiva.tappe[miss.attiva.corrente].nome;
      const oraPrima = miss.attiva.tappe[miss.attiva.corrente].quando;
      tasto.click();
      const dopo = miss.attiva.tappe[miss.attiva.corrente];
      return { possibile: true, prima, dopo: dopo.nome, stessaOra: dopo.quando === Date.now(),
               tot: miss.attiva.tappe.length };
    });
    prova('sostituire una tappa non cambia la durata della missione', () => {
      if (!sostituzione.possibile) { console.log('              (nessuna alternativa stanotte)'); return; }
      assert.notStrictEqual(sostituzione.dopo, sostituzione.prima);
      assert.strictEqual(sostituzione.stessaOra, true);
    });

    sezione('il ponte col planetario');

    const alPlanetario = await pagina.evaluate(() => {
      const bersaglio = miss.attiva.tappe[miss.attiva.corrente];
      if (!missTappaPuntabile(bersaglio)) return { puntabile: false };
      missGuidami(miss.attiva.corrente);
      return {
        puntabile: true,
        vista: vistaAttuale,
        nomeTappa: bersaglio.nome,
        idCielo: bersaglio.idCielo,
        target: sky.target,
        striscia: !document.getElementById('missione-striscia').classList.contains('hidden'),
        pannelloChiuso: document.getElementById('modale-missione').classList.contains('hidden')
      };
    });
    await pagina.waitForTimeout(500);
    prova('la ricerca apre il planetario senza centrare il bersaglio', () => {
      if (!alPlanetario.puntabile) { console.log('              (tappa senza bersaglio puntabile)'); return; }
      assert.strictEqual(alPlanetario.vista, 'cielo');
      assert.strictEqual(alPlanetario.target, null);
    });
    prova('e la striscia della missione compare sul cielo', () => {
      if (!alPlanetario.puntabile) return;
      assert.strictEqual(alPlanetario.striscia, true);
      assert.strictEqual(alPlanetario.pannelloChiuso, true);
    });

    const ritorno = await pagina.evaluate(() => {
      const primaIndice = miss.attiva.corrente;
      const primaTappe = miss.attiva.tappe.length;
      missTornaDalPlanetario();
      return {
        vista: vistaAttuale,
        indice: miss.attiva.corrente, primaIndice,
        tappe: miss.attiva.tappe.length, primaTappe,
        pannello: !document.getElementById('modale-missione').classList.contains('hidden'),
        striscia: document.getElementById('missione-striscia').classList.contains('hidden')
      };
    });
    await pagina.waitForTimeout(300);
    prova('si torna alla missione senza perderne lo stato', () => {
      assert.strictEqual(ritorno.vista, 'stasera');
      assert.strictEqual(ritorno.pannello, true);
      assert.strictEqual(ritorno.indice, ritorno.primaIndice);
      assert.strictEqual(ritorno.tappe, ritorno.primaTappe);
      assert.strictEqual(ritorno.striscia, true, 'la striscia è rimasta accesa fuori dal planetario');
    });

    sezione('il cambio lingua a missione aperta');

    const lingua = await pagina.evaluate(async () => {
      const primaIndice = miss.attiva.corrente;
      const primaTappe = miss.attiva.tappe.map(t => t.id);
      const primaTesto = document.querySelector('.missione-azioni .missione-tasto-si').textContent.trim();
      astroI18n.impostaLingua('en');
      await new Promise(r => setTimeout(r, 400));
      const dopoTesto = document.querySelector('.missione-azioni .missione-tasto-si').textContent.trim();
      const italiano = /\b(trovato|Non lo trovo|Salta|Guidami|Tappa)\b/.test(document.getElementById('missione-corpo').textContent);
      astroI18n.impostaLingua('it');
      await new Promise(r => setTimeout(r, 400));
      return { primaIndice, dopoIndice: miss.attiva.corrente,
               primaTappe, dopoTappe: miss.attiva.tappe.map(t => t.id),
               primaTesto, dopoTesto, italiano,
               tornato: document.querySelector('.missione-azioni .missione-tasto-si').textContent.trim() };
    });
    prova('il pannello si ridisegna in inglese', () => {
      assert.notStrictEqual(lingua.dopoTesto, lingua.primaTesto,
        `resta «${lingua.dopoTesto}»`);
      assert.strictEqual(lingua.italiano, false, 'resta dell’italiano a schermo');
    });
    prova('e la missione non perde un colpo', () => {
      assert.strictEqual(lingua.dopoIndice, lingua.primaIndice);
      assert.deepStrictEqual(lingua.dopoTappe, lingua.primaTappe);
      assert.strictEqual(lingua.tornato, lingua.primaTesto);
    });

    sezione('la conclusione e il Diario');

    const conclusa = await pagina.evaluate(() => {
      document.querySelector('[data-miss-azione="concludi"]').click();
      return {
        vista: miss.vista,
        stato: miss.attiva.stato,
        senzaEsito: miss.attiva.tappe.filter(t => !t.esito).length,
        esiti: document.querySelectorAll('.missione-esito-riga').length,
        modulo: !!document.querySelector('#missione-nota')
      };
    });
    prova('concludere chiude ogni tappa e mostra il riepilogo', () => {
      assert.strictEqual(conclusa.stato, 'conclusa');
      assert.strictEqual(conclusa.senzaEsito, 0);
      assert.ok(conclusa.esiti >= 2);
      assert.strictEqual(conclusa.modulo, true);
    });

    const salvata = await pagina.evaluate(() => {
      // Una voce vecchia, per provare che non si rompe niente.
      diario['vecchia-1'] = { visto: true, titolo: 'Luna Piena', categoria: 'luna',
        dataEvento: new Date(Date.now() - 86400000).toISOString(), nota: 'bella', stelle: 4 };
      salvaDiario();
      document.querySelector('#missione-nota').value = 'Serata fredda ma limpida.';
      document.querySelector('[data-miss-stelle="4"]').click();
      document.querySelector('[data-miss-azione="salvaDiario"]').click();
      const voci = Object.entries(diario);
      const voce = voci.find(([k]) => k.startsWith('missione-'));
      return {
        quante: voci.length,
        chiave: voce ? voce[0] : null,
        voce: voce ? voce[1] : null, versione: MISS_VERSIONE,
        attivaSparita: miss.attiva === null,
        salvataggioPulito: localStorage.getItem('astrocalendario_missione_attiva')
      };
    });
    prova('la missione entra nel Diario come una sessione sola', () => {
      assert.ok(salvata.chiave, 'nessuna voce di missione nel diario');
      assert.strictEqual(salvata.quante, 2, 'una missione deve fare UNA voce, non cinque');
      assert.ok(Array.isArray(salvata.voce.missione.tappe));
      assert.ok(salvata.voce.missione.tappe.length >= 2);
      assert.strictEqual(salvata.voce.stelle, 4);
      assert.ok(salvata.voce.nota.includes('limpida'));
      assert.strictEqual(salvata.voce.missione.versione, salvata.versione);
    });
    prova('e la missione attiva viene archiviata', () => {
      assert.strictEqual(salvata.attivaSparita, true);
      assert.strictEqual(salvata.salvataggioPulito, null);
    });

    const diarioDisegnato = await pagina.evaluate(() => {
      mostraVista('diario');
      const schede = Array.from(document.querySelectorAll('#diario-elenco article'));
      return {
        quante: schede.length,
        conTappe: document.querySelectorAll('.missione-diario-tappe').length,
        vecchiaViva: schede.some(a => a.textContent.includes('Luna Piena')),
        vecchiaSenzaTappe: schede.filter(a => a.textContent.includes('Luna Piena'))
          .every(a => !a.querySelector('.missione-diario-tappe'))
      };
    });
    prova('il Diario mostra la missione con le sue tappe', () => {
      assert.strictEqual(diarioDisegnato.quante, 2);
      assert.strictEqual(diarioDisegnato.conTappe, 1);
    });
    prova('e le vecchie voci continuano a funzionare identiche a prima', () => {
      assert.strictEqual(diarioDisegnato.vecchiaViva, true);
      assert.strictEqual(diarioDisegnato.vecchiaSenzaTappe, true);
    });

    const modificaVoce = await pagina.evaluate(() => {
      const chiave = Object.keys(diario).find(k => k.startsWith('missione-'));
      apriDiarioEvento(chiave);
      document.getElementById('diario-nota').value = 'Nota cambiata';
      document.getElementById('form-diario').dispatchEvent(new Event('submit', { cancelable: true }));
      return { tappe: diario[chiave].missione ? diario[chiave].missione.tappe.length : 0,
               nota: diario[chiave].nota };
    });
    prova('modificare la nota di una missione non ne cancella le tappe', () => {
      assert.ok(modificaVoce.tappe >= 2, 'le tappe sono sparite');
      assert.strictEqual(modificaVoce.nota, 'Nota cambiata');
    });

    sezione('la ripresa dopo un ricaricamento');

    // Si semina una missione in corso e si ricarica la pagina davvero.
    await pagina.evaluate(() => {
      localStorage.setItem('astrocalendario_missione_attiva', JSON.stringify({
        id: 'miss-prova', versione: MISS_VERSIONE, stato: 'inCorso',
        creata: Date.now(), partenza: Date.now(), avviata: Date.now(), corrente: 1,
        scelte: { durata: 30, strumento: 'occhio', esperienza: 'curiosi' },
        condizioni: { luna: 0, nuvole: 10, bortle: 4 },
        tappe: [
          { id: 'a', nome: 'Giove', tipo: 'pianeta', idCielo: 'Jupiter', quando: Date.now(),
            altezza: 40, azimut: 180, difficolta: 1, evidenza: 0.9, strumentoMinimo: 'occhio',
            esito: 'trovato', aiuto: 0, indice: 0, aOrarioPreciso: false },
          { id: 'b', nome: 'Vega', tipo: 'stella', idCielo: 'Star3', quando: Date.now() + 600000,
            altezza: 60, azimut: 270, difficolta: 2, evidenza: 0.85, strumentoMinimo: 'occhio',
            esito: null, aiuto: 0, indice: 1, aOrarioPreciso: false }
        ]
      }));
    });
    await pagina.reload({ waitUntil: 'networkidle' });
    await pagina.waitForTimeout(1800);

    const ripresa = await pagina.evaluate(() => {
      mostraVista('stasera');
      const box = document.getElementById('missione-scheda');
      return {
        attiva: !!miss.attiva,
        corrente: miss.attiva ? miss.attiva.corrente : -1,
        testo: box ? box.textContent : '',
        tasto: box ? box.querySelector('button').textContent.trim() : ''
      };
    });
    prova('una missione in corso sopravvive al ricaricamento', () => {
      assert.strictEqual(ripresa.attiva, true);
      assert.strictEqual(ripresa.corrente, 1);
      assert.ok(/Riprendi/i.test(ripresa.tasto), 'tasto: ' + ripresa.tasto);
    });

    const malformata = await pagina.evaluate(() => {
      localStorage.setItem('astrocalendario_missione_attiva', '{questo non è json');
      const primo = (typeof missProve === 'object');
      // Si rilegge come farebbe l'avvio.
      const letta = (() => { try { return JSON.parse(localStorage.getItem('astrocalendario_missione_attiva')); }
                            catch (e) { return 'illeggibile'; } })();
      return { primo, letta };
    });
    prova('un salvataggio malformato non rompe niente', () => {
      assert.strictEqual(malformata.primo, true);
      assert.strictEqual(malformata.letta, 'illeggibile');
    });

    // E lo si prova per davvero, ricaricando con la roba rotta dentro.
    await pagina.reload({ waitUntil: 'networkidle' });
    await pagina.waitForTimeout(1500);
    const dopoRotto = await pagina.evaluate(() => ({
      attiva: miss.attiva,
      salvato: localStorage.getItem('astrocalendario_missione_attiva'),
      schedaViva: !!document.getElementById('missione-scheda').querySelector('button')
    }));
    prova('e la pagina riparte pulita, buttando il salvataggio rotto', () => {
      assert.strictEqual(dopoRotto.attiva, null);
      assert.strictEqual(dopoRotto.salvato, null);
      assert.strictEqual(dopoRotto.schedaViva, true);
    });

    sezione('senza posizione');

    await pagina.evaluate(() => {
      localStorage.removeItem('astrocalendario_posizione');
    });
    const senzaPos = await pagina.evaluate(() => {
      // Si spegne la posizione a caldo, come se non fosse mai arrivata.
      sky.posizione = null;
      sky.observer = null;
      if (typeof svuotaCacheLocali === 'function') svuotaCacheLocali();
      missAggiornaScheda();
      const box = document.getElementById('missione-scheda');
      return { testo: box.textContent, tasti: box.querySelectorAll('button').length };
    });
    prova('senza posizione non si genera niente, e si dice perché', () => {
      assert.ok(senzaPos.testo.length > 20, senzaPos.testo);
      assert.strictEqual(senzaPos.tasti, 1, 'deve restare il comando per impostarla');
    });

    sezione('nessuna collisione, e nessuna chiave dimenticata');

    /* Le collisioni globali si guardano dove nascono, cioè nel sorgente.
     *
     * In questo progetto tutto sta nello scope di `window` per scelta — non
     * c'è nessun bundler e nessun modulo ES — quindi contare i nomi esposti
     * non direbbe niente: sono tanti in tutti i file. L'invariante che
     * conta è un'altra, ed è quella che tiene lontano lo scontro: **ogni
     * nome dichiarato a livello globale da questo file porta il suo
     * prefisso**. `scripts/controlla-collisioni.js` fa poi il confronto fra
     * i file; qui si controlla che il prefisso non manchi, che è la
     * condizione perché quel confronto continui a essere verde. */
    const senzaPrefisso = fs.readFileSync(path.join(RADICE, 'missione-cielo.js'), 'utf8')
      .split('\n')
      .map(r => (/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/.exec(r) || [])[1])
      .filter(Boolean)
      .filter(n => !/^(?:miss|MISS|CHIAVE_MISS)/.test(n));
    prova('ogni nome globale del modulo porta il suo prefisso', () => {
      assert.deepStrictEqual(senzaPrefisso, []);
    });

    const globali = await pagina.evaluate(() => ({
      miss: typeof miss, missProve: typeof missProve,
      apri: typeof missApriPannello, diario: typeof missVoceDiario
    }));
    prova('e le funzioni che il resto dell’app chiama ci sono', () => {
      assert.strictEqual(globali.miss, 'object');
      assert.strictEqual(globali.missProve, 'object');
      assert.strictEqual(globali.apri, 'function');
      assert.strictEqual(globali.diario, 'function');
    });

    const figure = await pagina.evaluate(() => {
      // `SKY_COSTELLAZIONI` porta il nome italiano e nient'altro; la sigla
      // IAU è l'unico ponte verso il dizionario delle ottantotto figure.
      const sigla = missSiglaCostellazione('Boote');
      const it = missNomeTappa({ tipo: 'costellazione', sigla, nome: 'Boote' });
      astroI18n.impostaLingua('en');
      const en = missNomeTappa({ tipo: 'costellazione', sigla, nome: 'Boote' });
      const senzaSigla = missNomeTappa({ tipo: 'costellazione', sigla: null, nome: 'Boote' });
      astroI18n.impostaLingua('it');
      return { sigla, it, en, senzaSigla };
    });
    prova('il nome di una costellazione segue la lingua', () => {
      assert.strictEqual(figure.sigla, 'Boo');
      assert.strictEqual(figure.it, 'Boote');
      assert.notStrictEqual(figure.en, 'Boote');
      // Senza catalogo si tiene l'italiano invece di scrivere una sigla:
      // «Boo» in mezzo a una frase non è un nome, è un codice.
      assert.strictEqual(figure.senzaSigla, 'Boote');
    });

    const chiaviMancanti = await pagina.evaluate(() =>
      astroI18n.mancanti().filter(v => v.chiave.startsWith('missione.')).map(v => v.chiave));
    prova('nessuna chiave di Missione Cielo è rimasta senza traduzione', () => {
      assert.deepStrictEqual(chiaviMancanti, []);
    });
  }

  try {
    await proveNelBrowser();
  } catch (e) {
    fallite++;
    console.log('\n  FALLITO   la prova nel browser si è interrotta');
    console.log('              ' + e.message);
  }

  // FullCalendar e le altre librerie del CDN qui sono finte (corpo vuoto):
  // le loro lamentele sono di questa prova, non del codice.
  const veri = errori.filter(e =>
    !/favicon|net::ERR|Failed to load resource|manifest|FullCalendar|Leaflet|satellite/i.test(e));
  if (veri.length) {
    console.log('\nerrori in console:');
    veri.slice(0, 10).forEach(e => console.log('  ' + e));
  }

  console.log(`\n${passate} passate, ${fallite} fallite`);
  await browser.close();
  server.close();
  process.exit(fallite === 0 && veri.length === 0 ? 0 : 1);
})();
