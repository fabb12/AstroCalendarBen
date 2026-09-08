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
    candidati,
    scelte: Object.assign({ durata: 30, strumento: 'occhio', esperienza: 'stupore' }, scelte),
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
  assert.strictEqual(motore.chiaveRegistro('trova', 'stupore'), 'trova');
  assert.strictEqual(motore.chiaveRegistro('cielo.sereno', 'bambini'), 'cielo.sereno');
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
  const fila = motore.inOrario([], [subito], T0, 60, { esperienza: 'stupore' });
  assert.deepStrictEqual(fila.map(t => t.id), []);
  assert.ok(K.MISS_PREAVVISO_MIN >= 2);
});

prova('un evento oltre la fine della missione non entra', () => {
  const tardi = candidato('stazione:tardi', {
    tipo: 'stazione', aOrarioPreciso: true, quando: T0 + 90 * 60000
  });
  const fila = motore.inOrario([candidato('a')], [tardi], T0, 30, { esperienza: 'stupore' });
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
  const cadutaNebulosa = motore.punteggio(nebulosa, { esperienza: 'stupore' }, senza)
                       - motore.punteggio(nebulosa, { esperienza: 'stupore' }, conLuna);
  const cadutaPianeta = motore.punteggio(pianeta, { esperienza: 'stupore' }, senza)
                      - motore.punteggio(pianeta, { esperienza: 'stupore' }, conLuna);
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

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
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
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 900, height: 900 }
  });
  const pagina = await contesto.newPage();

  const errori = [];
  pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
  pagina.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });

  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
  // Niente rete vera: il meteo, i TLE e il terreno sono altre prove.
  await pagina.route('**api.open-meteo.com**', r => r.abort());
  await pagina.route('**celestrak.org**', r => r.abort());
  await pagina.route('**overpass**', r => r.abort());
  await pagina.route('**elevation-tiles-prod**', r => r.abort());

  await pagina.addInitScript(([pos]) => {
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

    const config = await pagina.evaluate(() => ({
      aperto: !document.getElementById('modale-missione').classList.contains('hidden'),
      gruppi: document.querySelectorAll('#missione-corpo .missione-gruppo').length,
      scelte: document.querySelectorAll('#missione-corpo [data-miss-scelta]').length,
      fuocoDentro: document.getElementById('modale-missione').contains(document.activeElement)
    }));
    prova('la finestra si apre con le tre domande e nient’altro', () => {
      assert.strictEqual(config.aperto, true);
      assert.strictEqual(config.gruppi, 3, `${config.gruppi} gruppi`);
      assert.strictEqual(config.scelte, 4 + 3 + 4);
    });
    prova('il fuoco entra nella finestra', () => assert.strictEqual(config.fuocoDentro, true));

    // Le tre scelte si cambiano davvero, e restano.
    await pagina.evaluate(() => {
      document.querySelector('[data-miss-scelta="durata"][data-miss-valore="60"]').click();
      document.querySelector('[data-miss-scelta="strumento"][data-miss-valore="binocolo"]').click();
      document.querySelector('[data-miss-scelta="esperienza"][data-miss-valore="imparare"]').click();
    });
    const ricordate = await pagina.evaluate(() =>
      JSON.parse(localStorage.getItem('astrocalendario_missione_scelte')));
    prova('le scelte si ricordano', () => {
      assert.deepStrictEqual(ricordate, { durata: 60, strumento: 'binocolo', esperienza: 'imparare' });
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

    sezione('la missione in corso');

    await pagina.evaluate(() => document.querySelector('[data-miss-azione="avvia"]').click());
    await pagina.waitForTimeout(400);

    const inCorso = await pagina.evaluate(() => ({
      vista: miss.vista,
      cielo: vistaAttuale,
      pannelloChiuso: document.getElementById('modale-missione').classList.contains('hidden'),
      striscia: !document.getElementById('missione-striscia').classList.contains('hidden'),
      guida: document.querySelector('.missione-striscia-guida').textContent,
      risposte: Array.from(document.querySelectorAll('[data-missione-striscia]')).map(b => b.dataset.missioneStriscia)
    }));
    prova('la tappa comincia nel planetario, senza una finestra sopra il cielo', () => {
      assert.strictEqual(inCorso.vista, 'inCorso');
      assert.strictEqual(inCorso.cielo, 'cielo');
      assert.strictEqual(inCorso.pannelloChiuso, true);
      assert.strictEqual(inCorso.striscia, true);
      assert.ok(inCorso.guida.length > 10, 'guida: ' + inCorso.guida);
      assert.deepStrictEqual(inCorso.risposte, ['trovato', 'aiuto', 'salta']);
    });

    const dopoTrovato = await pagina.evaluate(() => {
      const prima = miss.attiva.corrente;
      document.querySelector('[data-missione-striscia="trovato"]').click();
      return { prima, dopo: miss.attiva.corrente, esito: miss.attiva.tappe[prima].esito,
               tot: miss.attiva.tappe.length, cielo: vistaAttuale,
               pannelloChiuso: document.getElementById('modale-missione').classList.contains('hidden') };
    });
    prova('«L’ho trovato» segna la tappa e avanza', () => {
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
        document.querySelector('[data-missione-striscia="aiuto"]').click();
        esiti.push({
          livello: miss.attiva.tappe[miss.attiva.corrente].aiuto,
          guida: document.querySelector('.missione-striscia-guida').textContent,
          esito: miss.attiva.tappe[miss.attiva.corrente].esito
        });
      }
      return esiti;
    });
    prova('«Non lo trovo» aiuta e non segna niente come fallito', () => {
      assert.deepStrictEqual(aiuti.map(a => a.livello), [1, 2, 3]);
      assert.deepStrictEqual(aiuti.map(a => a.esito), [null, null, null]);
    });
    prova('e la guida resta visibile mentre si muove il cielo', () => {
      assert.ok(aiuti.every(a => a.guida.length > 10));
    });

    const sostituzione = await pagina.evaluate(() => {
      const tasto = document.querySelector('[data-miss-azione="sostituisci"]');
      if (!tasto) return { possibile: false };
      const prima = miss.attiva.tappe[miss.attiva.corrente].nome;
      const oraPrima = miss.attiva.tappe[miss.attiva.corrente].quando;
      tasto.click();
      const dopo = miss.attiva.tappe[miss.attiva.corrente];
      return { possibile: true, prima, dopo: dopo.nome, stessaOra: dopo.quando === oraPrima,
               tot: miss.attiva.tappe.length };
    });
    prova('sostituire una tappa non cambia la durata della missione', () => {
      if (!sostituzione.possibile) { console.log('              (nessuna alternativa stanotte)'); return; }
      assert.notStrictEqual(sostituzione.dopo, sostituzione.prima);
      assert.strictEqual(sostituzione.stessaOra, true);
    });

    sezione('il ponte col planetario');

    const alPlanetario = await pagina.evaluate(() => {
      const tasto = document.querySelector('[data-miss-azione="guidami"]');
      if (!tasto) return { puntabile: false };
      const bersaglio = miss.attiva.tappe[miss.attiva.corrente];
      tasto.click();
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
    prova('«Guidami» apre il planetario sul bersaglio', () => {
      if (!alPlanetario.puntabile) { console.log('              (tappa senza bersaglio puntabile)'); return; }
      assert.strictEqual(alPlanetario.vista, 'cielo');
      if (alPlanetario.idCielo) assert.strictEqual(alPlanetario.target, alPlanetario.idCielo);
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
        voce: voce ? voce[1] : null,
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
      assert.strictEqual(salvata.voce.missione.versione, 1);
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
        id: 'miss-prova', versione: 1, stato: 'inCorso',
        creata: Date.now(), partenza: Date.now(), avviata: Date.now(), corrente: 1,
        scelte: { durata: 30, strumento: 'occhio', esperienza: 'stupore' },
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
