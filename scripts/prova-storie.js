/* Le Storie cosmiche, il motore: senza browser, mezzo secondo.
 *
 *   node scripts/prova-storie.js
 *
 * Un volto disegnato male è un volto disegnato comunque: una pupilla che
 * esce dall'occhio di mezzo pixel, una bocca che si muove per il personaggio
 * sbagliato, una palpebra che resta a metà dopo una pausa, un personaggio
 * della scena di prima che resta sul cielo dopo un salto. Nessuno, guardando
 * lo schermo, dice «questa promessa è arrivata tardi»: dice «carino, un po'
 * strano». Qui il giudice sono i numeri — la geometria del volto, il segnale
 * della voce, il motore delle demo con un orologio finto — e una tela finta
 * che annota invece di dipingere. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

// --- Il mondo finto: l'orologio, le tabelle dell'app, la voce ----------
let adesso = 1000;
Object.defineProperty(globalThis, 'performance', { value: { now: () => adesso }, configurable: true, writable: true });
globalThis.SKY_ASTRI = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
  .map(id => ({ id })).concat([1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ id: 'Star' + i, nome: 'Stella ' + i })));
globalThis.SOL_LUNE = [{ id: 'Phobos', nome: 'Phobos', colore: '#b8a99a' }, { id: 'Io', nome: 'Io', colore: '#fde68a' },
  { id: 'Titan', nome: 'Titano', colore: '#e8b96a' }, { id: 'Triton', nome: 'Tritone', colore: '#dbeafe' }];
globalThis.SOL_MONDI = [{ id: 'Ceres', nome: 'Cerere', famiglia: 'nano', colore: '#d6d9de', idCielo: 'min:Cerere' },
  { id: 'Vesta', nome: 'Vesta', famiglia: 'asteroide', colore: '#cbd5e1', idCielo: 'min:Vesta' },
  { id: 'Pluto', nome: 'Plutone', famiglia: 'nano' }];
globalThis.SOL_SONDE = [{ id: 'voyager1', nome: 'Voyager 1' }, { id: 'voyager2', nome: 'Voyager 2' }];
globalThis.SATELLITI = [{ id: 'iss', nome: 'ISS' }, { id: 'css', nome: 'Tiangong' }, { id: 'hubble', nome: 'Hubble' }];
globalThis.corpiMinori = { stato: 'pronto', elenco: [{ nome: 'Cerere', tipo: 'asteroide' }, { nome: '12P/Pons-Brooks', tipo: 'cometa' }], miei: [] };

// La voce finta: annota chi parla, risolve quando le si dice, e risponde a
// `voce()` con quello che la prova le mette in mano.
const voce = { segnale: { parla: false }, richieste: [], fermate: [], pause: [], risolutori: [] };
globalThis.narrazione = {
  parla(r) {
    voce.richieste.push(r);
    return new Promise(ok => voce.risolutori.push(ok));
  },
  ferma(canale) { voce.fermate.push(canale || '*'); return true; },
  pausa(canale) { voce.pause.push(canale); return true; },
  voce: () => voce.segnale
};
globalThis.AstroDemo = { stato: 'attivo', inCorso: true };

// I dizionari veri, per gli errori localizzati e per i testi delle storie
const ctxDiz = { window: {} }; ctxDiz.globalThis = ctxDiz; vm.createContext(ctxDiz);
const RADICE = path.resolve(__dirname, '..');
for (const f of ['lingue/it.js', 'lingue/en.js']) vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), ctxDiz);
const DIZ = ctxDiz.window.ASTRO_DIZIONARI;
let lingua = 'it';
globalThis.astroI18n = {
  esiste: k => typeof DIZ[lingua].messaggi[k] === 'string',
  t: (k, d = {}) => String(DIZ[lingua].messaggi[k] || k).replace(/\{(\w+)\}/g, (m, x) => x in d ? String(d[x]) : m)
};

const S = require('../storie-cosmiche.js');
const { Motore, analizza } = require('../demo-motore.js');
const predefiniti = require('../demo-predefiniti.js');

// Una tela finta: ogni metodo esiste e non fa niente, i gradienti anche
function telaFinta(L = 800, H = 600) {
  const chiamate = [];
  const gradiente = { addColorStop() {} };
  const ctx = new Proxy({ canvas: { width: L, height: H }, globalAlpha: 1 }, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradiente;
      return (...a) => { chiamate.push(k); return undefined; };
    },
    set(o, k, v) { o[k] = v; return true; }
  });
  return { ctx, chiamate };
}
const avanza = ms => { adesso += ms; };

let passate = 0, fallite = 0;
const prove = [];
function prova(nome, fn) { prove.push({ nome, fn }); }
function gruppo(nome) { prove.push({ gruppo: nome }); }

// =====================================================================
gruppo('i personaggi e le famiglie');

prova('ogni personaggio dichiarato ha nome, colori, voce, espressione e misure', () => {
  for (const id of Object.keys(S.STOR_PERSONAGGI)) {
    const p = S.profilo(id);
    assert.ok(p.pelle && p.iride && p.sottotitolo, id + ': colori');
    assert.ok(S.STOR_ESPRESSIONI[p.espressione], id + ': espressione iniziale');
    assert.ok(p.voce && 'ritmo' in p.voce && 'tono' in p.voce, id + ': voce');
    assert.ok(p.scala > 0.3 && p.scala <= 0.95, id + ': scala');
    assert.ok(p.occhi.r > 0.1 && p.occhi.r < 0.35, id + ': occhi');
    assert.ok(S.nome(id).length > 0, id + ': nome');
  }
});
prova('i dieci corpi principali, le lune, comete, asteroidi, stelle, stazioni e sonde sono supportati', () => {
  const attesi = {
    Sun: 'stella', Mercury: 'pianeta', Venus: 'pianeta', Earth: 'pianeta', Moon: 'luna', Mars: 'pianeta',
    Jupiter: 'pianeta', Saturn: 'pianeta', Uranus: 'pianeta', Neptune: 'pianeta',
    Io: 'luna', Titan: 'luna', Phobos: 'luna', Triton: 'luna', Star3: 'stella', 'min:Cerere': 'nano',
    'min:12P/Pons-Brooks': 'cometa', Vesta: 'asteroide', Pluto: 'nano', 'sat-iss': 'stazione', ISS: 'stazione',
    Tiangong: 'stazione', hubble: 'stazione', voyager1: 'sonda', 'Voyager 2': 'sonda'
  };
  for (const [id, famiglia] of Object.entries(attesi)) {
    assert.ok(S.noto(S.canonico(id)), id + ' è un oggetto noto');
    assert.equal(S.profilo(id).famiglia, famiglia, id + ' → ' + famiglia);
  }
});
prova('un personaggio non dichiarato prende la faccia della sua famiglia, coi colori dell\'app', () => {
  const p = S.profilo('Phobos');
  assert.equal(p.famiglia, 'luna');
  assert.equal(p.pelle, '#b8a99a');
  assert.equal(S.nome('Phobos'), 'Phobos');
});
prova('lo stesso oggetto ha un nome solo in tutte le viste', () => {
  assert.equal(S.canonico('sat-iss'), 'iss');
  assert.equal(S.canonico('ISS'), 'iss');
  assert.equal(S.canonico('min:Cerere'), 'Ceres');
  assert.equal(S.canonico('Voyager 1'), 'voyager1');
});
prova('un oggetto che l\'app non conosce non è un personaggio', () => {
  assert.equal(S.noto('Pandora'), false);
  assert.equal(S.noto('Star99'), false);
  assert.equal(S.noto('min:'), false);
});

// =====================================================================
gruppo('la geometria del volto');

const BASE_ST = (espr = 'neutral', extra = {}) => Object.assign({
  espr: S.parametriEspressione(espr), sguardo: { x: 0, y: 0 }, battito: 0, bocca: Object.assign({}, S.STOR_BOCCHE.chiusa)
}, extra);

prova('le pupille restano dentro agli occhi: tutte le espressioni, tutti gli sguardi, tutti i personaggi', () => {
  let casi = 0;
  for (const id of ['Sun', 'Moon', 'Jupiter', 'iss', 'Star1']) {
    const p = S.profilo(id);
    for (const espr of Object.keys(S.STOR_ESPRESSIONI)) {
      for (let a = 0; a < 16; a++) for (const m of [0, 0.5, 1, 1.6]) {
        const g = S.geometria(400, 300, 60, p, BASE_ST(espr, { sguardo: { x: Math.cos(a) * m, y: Math.sin(a) * m } }));
        for (const occ of g.occhi) {
          assert.ok(S.pupillaDentro(occ), `${id} ${espr} angolo ${a} ${m}`);
          // anche l'iride, e i due riflessi dentro all'iride
          const iride = { cx: occ.cx, cy: occ.cy, rx: occ.rx, ry: occ.ry, pupilla: occ.iride };
          assert.ok(S.pupillaDentro(iride), 'iride dentro');
          for (const l of occ.luci) assert.ok(Math.hypot(l.x - occ.iride.x, l.y - occ.iride.y) + l.r <= occ.iride.r + 1e-9, 'riflesso dentro');
          casi++;
        }
      }
    }
  }
  assert.ok(casi > 3000);
});
prova('gli occhi sono grandi e proporzionati al volto', () => {
  for (const R of [24, 60, 200]) {
    const g = S.geometria(0, 0, R, S.profilo('Moon'), BASE_ST());
    assert.ok(g.occhi[0].rx / R > 0.2, 'occhio grande');
    assert.ok(g.occhi[1].cx - g.occhi[0].cx < 2 * R * 0.8, 'dentro al volto');
    assert.ok(Math.abs(g.occhi[0].rx / R - g.occhi[0].rx / R) < 1e-12);
  }
  const piccolo = S.geometria(0, 0, 24, S.profilo('Moon'), BASE_ST()), grande = S.geometria(0, 0, 96, S.profilo('Moon'), BASE_ST());
  assert.ok(Math.abs(grande.occhi[0].rx / piccolo.occhi[0].rx - 4) < 1e-9, 'scala col volto');
});
prova('lo sguardo va dove si guarda: verso destra, verso un altro personaggio, verso lo spettatore', () => {
  const p = S.profilo('Saturn');
  const dritto = S.geometria(0, 0, 50, p, BASE_ST());
  const destra = S.geometria(0, 0, 50, p, BASE_ST('neutral', { sguardo: S.sguardoVerso(0, 0, 50, { x: 500, y: 0 }) }));
  const su = S.geometria(0, 0, 50, p, BASE_ST('neutral', { sguardo: S.sguardoVerso(0, 0, 50, { x: 0, y: -500 }) }));
  assert.ok(destra.occhi[0].pupilla.x > dritto.occhi[0].pupilla.x + 1, 'a destra');
  assert.ok(su.occhi[0].pupilla.y < dritto.occhi[0].pupilla.y - 1, 'in su');
  assert.equal(dritto.occhi[0].pupilla.x, dritto.occhi[0].cx, 'lo spettatore: dritto');
  assert.deepEqual(S.sguardoVerso(0, 0, 50, null), { x: 0, y: 0 });
});
prova('le espressioni si distinguono per sopracciglia, palpebre, pupille e bocca', () => {
  const p = S.profilo('Moon');
  const g = e => S.geometria(0, 0, 50, p, BASE_ST(e));
  const n = g('neutral'), w = g('worried'), h = g('happy'), su = g('surprised'), sa = g('sad'), th = g('thinking');
  // preoccupata: l'estremo interno del sopracciglio sale (y più piccola)
  const interno = c => c.y1, esterno = c => c.y2;
  assert.ok(interno(w.cigli[0]) < interno(n.cigli[0]) - 2, 'preoccupata: interno su');
  assert.ok(interno(w.cigli[0]) < esterno(w.cigli[0]), 'preoccupata: inclinato');
  assert.ok(su.cigli[0].y1 < n.cigli[0].y1 - 4 && su.cigli[0].y2 < n.cigli[0].y2 - 4, 'sorpresa: tutto su');
  assert.ok(su.occhi[0].pupilla.r < n.occhi[0].pupilla.r, 'sorpresa: pupille strette');
  assert.ok(su.occhi[0].bordoSu <= n.occhi[0].bordoSu, 'sorpresa: occhi spalancati');
  assert.ok(sa.occhi[0].bordoSu > n.occhi[0].bordoSu + 3, 'triste: palpebre basse');
  assert.ok(S.parametriEspressione('happy').curva > 0.3 && S.parametriEspressione('sad').curva < -0.3, 'sorriso e broncio');
  assert.ok(h.guance.length === 2 && h.guance[0].alfa > n.guance[0].alfa, 'felice: guance');
  assert.ok(Math.abs(th.cigli[0].y1 - th.cigli[1].y1) > 1, 'pensierosa: sopracciglia asimmetriche');
  assert.ok(S.parametriEspressione('thinking').sguardo.y < 0, 'pensierosa: guarda in su');
});
prova('il battito chiude e riapre le palpebre, e un occhio chiuso è chiuso davvero', () => {
  const D = S.STOR_BATTITO_DURATA;
  assert.equal(S.chiusuraBattito(0), 0);
  assert.equal(S.chiusuraBattito(-5), 0);
  assert.equal(S.chiusuraBattito(D + 1), 0);
  let massimo = 0;
  for (let t = 0; t <= D; t += 5) massimo = Math.max(massimo, S.chiusuraBattito(t));
  assert.equal(massimo, 1);
  const g = S.geometria(0, 0, 50, S.profilo('Moon'), BASE_ST('happy', { battito: 1 }));
  for (const occ of g.occhi) assert.ok(occ.chiusura > 0.985 && occ.bordoGiu - occ.bordoSu < 0.5, 'chiuso');
  assert.ok(D >= 150 && D <= 260, 'un battito dura un quinto di secondo, non di più');
});

// =====================================================================
gruppo('la bocca e la voce');

prova('il ritmo del testo: le sillabe aprono, le pause sulla punteggiatura chiudono', () => {
  const r = S.ritmo('Ciao, Luna. Come stai?');
  assert.ok(r.totale > 1 && r.totale < 4);
  const virgola = r.segmenti.find(s => s.tipo === 'pausa' && !s.breve);
  assert.ok(virgola && virgola.fine - virgola.inizio >= 0.2, 'la virgola è una pausa vera');
  assert.equal(S.formaAlTempo(r, (virgola.inizio + virgola.fine) / 2).forma, 'chiusa');
  const sillaba = r.segmenti.find(s => s.tipo === 'sillaba' && s.vocale === 'a');
  const meta = S.formaAlTempo(r, (sillaba.inizio + sillaba.fine) / 2);
  assert.equal(meta.forma, 'A', 'sulla «a» la bocca fa la A');
  assert.equal(S.formaAlTempo(r, r.totale + 1).forma, 'chiusa', 'finita la frase, chiusa');
  // le tre vocali danno tre forme
  const forme = new Set(r.segmenti.filter(s => s.tipo === 'sillaba').map(s => S.formaAlTempo(r, (s.inizio + s.fine) / 2).forma));
  assert.ok(forme.has('A') && forme.has('O') && forme.has('E'), [...forme].join());
});
prova('la bocca non si muove a caso: lo stesso istante dà la stessa forma', () => {
  const r = S.ritmo('Sono sempre intera, anche quando sembro una fettina!');
  for (let t = 0; t < r.totale; t += 0.07) assert.deepEqual(S.formaAlTempo(r, t), S.formaAlTempo(r, t));
});
prova('primo segnale: l\'ampiezza dell\'audio (Web Audio) apre la bocca quanto la voce è forte', () => {
  const r = S.ritmo('Aaa');
  const piano = S.boccaDaSegnale({ parla: true, livello: 0.005, progresso: 0.5, testo: 'Aaa' }, r);
  const forte = S.boccaDaSegnale({ parla: true, livello: 0.2, progresso: 0.5, testo: 'Aaa' }, r);
  assert.equal(piano.via, 'ampiezza'); assert.equal(piano.forma, 'chiusa');
  assert.equal(forte.via, 'ampiezza'); assert.ok(forte.apertura > 0.9 && forte.forma === 'A');
});
prova('secondo segnale: i confini di parola del TTS portano la bocca alla parola giusta', () => {
  const testo = 'uno due tre quattro';
  const r = S.ritmo(testo);
  const quattro = testo.indexOf('quattro');
  const b = S.boccaDaSegnale({ parla: true, testo, confine: { carattere: quattro, lunghezza: 7, da: 30 } }, r);
  assert.equal(b.via, 'confini');
  // e non scavalca la fine della parola anche se il confine dopo tarda
  const tardi = S.boccaDaSegnale({ parla: true, testo, confine: { carattere: 0, lunghezza: 3, da: 5000 } }, r);
  assert.ok(S.tempoDelCarattere(r, 0) <= r.totale);
  assert.ok(['chiusa', 'piccola', 'A', 'E', 'O'].includes(tardi.forma));
});
prova('terzo segnale: senza audio né confini, il ritmo sulla durata (e la fila ricomincia se la voce è più lenta)', () => {
  const testo = 'Ma è vero! Da qui sono tutta rotonda.';
  const r = S.ritmo(testo);
  const b = S.boccaDaSegnale({ parla: true, testo, tempo: 600 }, r);
  assert.equal(b.via, 'ritmo');
  const oltre = S.boccaDaSegnale({ parla: true, testo, tempo: (r.totale + 0.3) * 1000 }, r);
  const ricomincia = S.boccaDaSegnale({ parla: true, testo, tempo: 300 }, r);
  assert.equal(oltre.forma, ricomincia.forma, 'ricomincia');
  assert.ok(Math.abs(oltre.apertura - ricomincia.apertura) < 1e-6, 'ricomincia');
  const prog = S.boccaDaSegnale({ parla: true, testo, progresso: 0.5 }, r);
  assert.deepEqual({ forma: prog.forma, apertura: prog.apertura }, (({ forma, apertura }) => ({ forma, apertura }))(S.formaAlTempo(r, 0.5 * r.totale)));
});
prova('la bocca si chiude subito quando la voce non parla, è in pausa o è finita', () => {
  for (const s of [null, { parla: false }, { parla: true, pausa: true, tempo: 400, testo: 'aaa' }])
    assert.deepEqual(S.boccaDaSegnale(s), { forma: 'chiusa', apertura: 0, via: 'muta' });
});

// --- Il disegno con la voce finta ------------------------------------
function scena(personaggi) {
  S.sgombra();
  for (const [id, opz] of Object.entries(personaggi)) S.mostra(id, opz);
}
const corpo = (id, px, py, r, extra) => Object.assign({ id, px, py, r }, extra);

prova('mentre un personaggio parla si muove solo la sua bocca, e gli altri lo guardano', () => {
  scena({ Earth: {}, Moon: { espressione: 'worried' } });
  const { ctx } = telaFinta();
  const { fine } = S.parla('Moon', { id: 'demo.narr.storia_luna.1' });
  assert.equal(S.parlante, 'Moon');
  const testo = DIZ.it.messaggi['demo.narr.storia_luna.1'];
  let mossa = 0, altraMossa = 0, sguardoVerso = 0;
  for (let k = 0; k < 60; k++) {
    voce.segnale = { parla: true, personaggio: 'Moon', testo, tempo: k * 60 };
    avanza(16);
    const d = S.disegnaPersonaggi(ctx, 'prova', [corpo('Earth', 200, 300, 80), corpo('Moon', 600, 300, 60)], 800, 600);
    const luna = d.find(x => x.id === 'Moon'), terra = d.find(x => x.id === 'Earth');
    if (luna.apertura > 0.1) mossa++;
    if (terra.apertura > 0 || !['chiusa', 'sorriso'].includes(terra.forma)) altraMossa++;
    if (terra.sguardo.x > 0.2) sguardoVerso++;
    assert.ok(luna.parla && !terra.parla);
  }
  assert.ok(mossa > 15, 'la bocca della Luna si apre spesso: ' + mossa);
  assert.equal(altraMossa, 0, 'quella della Terra mai');
  assert.ok(sguardoVerso > 40, 'la Terra guarda la Luna mentre parla');
  // Fine della voce: chiusa nel fotogramma stesso
  voce.segnale = { parla: false };
  avanza(16);
  const d = S.disegnaPersonaggi(ctx, 'prova', [corpo('Earth', 200, 300, 80), corpo('Moon', 600, 300, 60)], 800, 600);
  assert.equal(d.find(x => x.id === 'Moon').apertura, 0);
  assert.notEqual(d.find(x => x.id === 'Moon').forma, 'A');
  void fine;
});
prova('una voce sola alla volta: la promessa tardiva della prima battuta non toglie la parola alla seconda', async () => {
  scena({ Earth: {}, Moon: {} });
  voce.risolutori.length = 0;
  S.parla('Moon', { testo: 'Prima' });
  S.parla('Earth', { testo: 'Seconda' });
  assert.equal(S.parlante, 'Earth');
  voce.risolutori[0]('interrotta');      // la prima arriva tardi
  await Promise.resolve(); await Promise.resolve();
  assert.equal(S.parlante, 'Earth', 'la seconda parla ancora');
  voce.risolutori[1]('testo');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(S.parlante, null);
  // e la bocca della prima non si muove nemmeno se la voce dice ancora il suo nome
  voce.segnale = { parla: true, personaggio: 'Moon', testo: 'aaa', tempo: 100 };
  const d = S.disegnaPersonaggi(telaFinta().ctx, 'prova', [corpo('Earth', 200, 300, 80), corpo('Moon', 600, 300, 60)], 800, 600);
  assert.ok(d.every(x => !x.parla));
});
prova('cambiando lingua a metà battuta il personaggio non perde la parola', async () => {
  scena({ Moon: {} });
  voce.risolutori.length = 0;
  S.parla('Moon', { id: 'demo.narr.storia_luna.1' });
  globalThis.narrazione.stato = () => ({ canale: 'demo' });   // la frase riparte nella lingua nuova
  voce.segnale = { parla: true, personaggio: 'Moon', testo: 'x', tempo: 10 };
  voce.risolutori[0]('interrotta');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(S.parlante, 'Moon');
  delete globalThis.narrazione.stato;
  voce.segnale = { parla: false };
});
prova('il sottotitolo porta il nome del personaggio e il suo colore, sempre', () => {
  voce.richieste.length = 0;
  S.parla('Saturn', { testo: 'Ciao' });
  const r = voce.richieste[0];
  assert.equal(r.personaggio, 'Saturn');
  assert.equal(r.chi.nome, S.nome('Saturn'));
  assert.equal(r.chi.colore, S.profilo('Saturn').sottotitolo);
  assert.equal(r.sottotitolo, 'sempre');
  assert.equal(r.testoSeSpenta, true);
  assert.equal(r.canale, 'demo');
});

prova('le palpebre battono da sole, e in pausa l\'orologio della storia si ferma', () => {
  scena({ Moon: {} });
  const { ctx } = telaFinta();
  voce.segnale = { parla: false };
  const corpi = [corpo('Moon', 400, 300, 80)];
  let battiti = 0, prima = 0;
  for (let k = 0; k < 900; k++) {        // 15 s a 60 fotogrammi
    avanza(16.7);
    const d = S.disegnaPersonaggi(ctx, 'prova', corpi, 800, 600)[0];
    if (d.battito > 0.95 && prima <= 0.95) battiti++;
    prima = d.battito;
  }
  assert.ok(battiti >= 2 && battiti <= 8, 'battiti naturali in 15 s: ' + battiti);
  globalThis.AstroDemo.stato = 'pausa';
  const orologio = S.stato.orologio;
  for (let k = 0; k < 300; k++) { avanza(16.7); S.disegnaPersonaggi(ctx, 'prova', corpi, 800, 600); }
  assert.equal(S.stato.orologio, orologio, 'fermo in pausa');
  globalThis.AstroDemo.stato = 'attivo';
  avanza(16.7); S.disegnaPersonaggi(ctx, 'prova', corpi, 800, 600);
  assert.ok(S.stato.orologio > orologio, 'riparte con la ripresa');
});
prova('character_blink chiude gli occhi subito', () => {
  scena({ Moon: {} });
  const { ctx } = telaFinta();
  avanza(16); S.disegnaPersonaggi(ctx, 'prova', [corpo('Moon', 400, 300, 80)], 800, 600);
  S.batti('Moon');
  let max = 0;
  for (let k = 0; k < 14; k++) { avanza(16); max = Math.max(max, S.disegnaPersonaggi(ctx, 'prova', [corpo('Moon', 400, 300, 80)], 800, 600)[0].battito); }
  assert.ok(max > 0.95);
});

// =====================================================================
gruppo('quando il volto non c\'è, e quando sta in un disco grafico');

prova('fuori schermo, occultato, troppo piccolo, nascosto, non disegnato: niente volto', () => {
  scena({ Jupiter: {}, Saturn: {}, Mars: {}, Venus: {}, Mercury: {} });
  S.nascondi('Mercury');
  const d = S.disegnaPersonaggi(telaFinta().ctx, 'prova', [
    corpo('Jupiter', -20, 300, 40), corpo('Saturn', 300, 300, 40, { nascosto: true }),
    corpo('Mars', 300, 300, 0.2), corpo('Mercury', 400, 200, 30)
  ], 800, 600);
  assert.equal(d.length, 0, d.map(x => x.id).join());
});
prova('un oggetto piccolo ha il suo corpo disegnato sopra di sé; accanto, col filo, solo se lì non c\'è posto o con size: badge', () => {
  scena({ Jupiter: {} });
  const d = S.disegnaPersonaggi(telaFinta().ctx, 'prova', [corpo('Jupiter', 400, 300, 3)], 800, 600)[0];
  assert.equal(d.addosso, false);
  assert.equal(d.astro.r, 3, 'il corpo non cresce');
  assert.equal(d.corpo, 'pianeta', 'il corpo è quello del pianeta');
  assert.ok(d.centrato && d.x === 400 && Math.abs(d.y - 300) < 2, 'il corpo sta sull\'astro (v411)');
  // con size: badge (e vicino al bordo) va accanto, legato da un filo
  scena({ Jupiter: { misura: 'badge' } });
  const b = S.disegnaPersonaggi(telaFinta().ctx, 'prova', [corpo('Jupiter', 400, 300, 3)], 800, 600)[0];
  assert.ok(!b.centrato && Math.hypot(b.x - 400, b.y - 300) > b.R, 'il disco sta accanto, non sopra');
  assert.ok(b.x - b.R >= 0 && b.x + b.R <= 800 && b.y - b.R >= 0 && b.y + b.R <= 600, 'dentro lo schermo');
  scena({ Jupiter: {} });
  const bordo = S.disegnaPersonaggi(telaFinta().ctx, 'prova', [corpo('Jupiter', 795, 300, 3)], 800, 600)[0];
  assert.ok(!bordo.centrato && bordo.x + bordo.R <= 800, 'al bordo dello schermo va accanto');
  scena({ Jupiter: {} });
  const grande = S.disegnaPersonaggi(telaFinta().ctx, 'prova', [corpo('Jupiter', 400, 300, 120)], 800, 600)[0];
  assert.equal(grande.addosso, true);
  assert.equal(grande.corpo, null, 'un astro grande porta il volto da sé');
  assert.ok(Math.abs(grande.R - 120 * S.profilo('Jupiter').scala) < 1e-9, 'proporzionato al disco');
});
prova('ogni famiglia ha il corpo giusto: la sonda è una sonda, l\'asteroide un sasso, la cometa ha la coda', () => {
  const attesi = { voyager1: 'voyager', 'Voyager 2': 'voyager', iss: 'iss', Tiangong: 'tiangong', hubble: 'hubble', Vesta: 'asteroide',
    'min:12P/Pons-Brooks': 'cometa', Saturn: 'anelli', Jupiter: 'pianeta', Moon: 'luna', Sun: 'stella', Pluto: 'luna' };
  for (const [id, sagoma] of Object.entries(attesi)) assert.equal(S.profilo(id).sagoma, sagoma, id);
  // il volto sta dentro al suo corpo: sulla parabola, sul modulo, sul sasso
  for (const sagoma of S.STOR_SAGOME) {
    const v = S.voltoNelCorpo(sagoma, 0, 0, 50);
    assert.ok(Math.hypot(v.cx, v.cy) + v.R <= 50 * 1.01, sagoma + ': il volto non esce dal corpo');
    assert.ok(v.R >= 50 * 0.55, sagoma + ': il volto resta leggibile');
  }
  // nella 3D una sonda (che l'app disegna come una crocetta) ha il corpo disegnato
  scena({ voyager1: {} });
  const d = S.disegnaPersonaggi(telaFinta().ctx, 'sistema', [corpo('voyager1', 400, 300, 4)], 800, 600)[0];
  assert.equal(d.corpo, 'voyager');
  assert.equal(d.addosso, true, 'il corpo sta dove l\'app ha messo la sonda');
  assert.ok(d.R * S.STOR_CORPI.voyager.volto[2] >= S.STOR_VOLTO_MIN_PX, 'il volto è leggibile');
});
prova('lei e lui: ciglia, sopracciglia, labbra, baffi e barba', () => {
  const lei = ['Moon', 'Earth', 'Venus', 'Io', 'Europa', 'Callisto', 'iss'], lui = ['Sun', 'Mars', 'Jupiter', 'Saturn', 'Neptune', 'Mercury', 'hubble'];
  for (const id of lei) assert.equal(S.profilo(id).genere, 'f', id);
  for (const id of lui) assert.equal(S.profilo(id).genere, 'm', id);
  const g = id => S.geometria(0, 0, 50, S.profilo(id), BASE_ST());
  assert.ok(g('Mars').cigli[0].spessore > g('Moon').cigli[0].spessore * 1.6, 'lui ha le sopracciglia folte');
  assert.ok(S.profilo('Moon').labbra && !S.profilo('Mars').labbra, 'le labbra sono di lei');
  assert.ok(S.profilo('Jupiter').barba && S.profilo('Saturn').baffi, 'Giove ha la barba, Saturno i baffi');
  // un profilo scritto male non fa una Luna coi baffi
  S.STOR_PERSONAGGI.Prova = { famiglia: 'luna', genere: 'f', baffi: 'folti' };
  assert.equal(S.profilo('Prova').baffi, null);
  delete S.STOR_PERSONAGGI.Prova;
});
prova('gli occhi sono l\'apertura fra le palpebre: niente seconda pupilla, mezzelune nel sorriso, una riga a occhi chiusi', () => {
  const p = S.profilo('Moon');
  const g = (e, extra) => S.geometria(0, 0, 60, p, BASE_ST(e, extra));
  for (const e of Object.keys(S.STOR_ESPRESSIONI)) {
    for (const occ of g(e).occhi) {
      if (!occ.apertura) { assert.ok(S.STOR_ESPRESSIONI[e].felici, e + ': chiuso solo se ride'); continue; }
      // il bordo di sopra sta sempre sopra a quello di sotto, e l'apertura sta nell'ellisse
      occ.apertura.sopra.forEach(([x, y], i) => {
        assert.ok(y <= occ.apertura.sotto[i][1] + 1e-6, e + ': bordi in ordine');
        assert.ok(((x - occ.cx) / occ.rx) ** 2 + ((y - occ.cy) / occ.ry) ** 2 <= 1 + 1e-6, e + ': dentro l\'occhio');
      });
    }
  }
  // il sorriso: la palpebra di sotto sale di più al centro che ai lati (la mezzaluna)
  const h = g('happy').occhi[0];
  assert.ok(h.palpebraGiu(0) < h.palpebraGiu(0.8) - 2, 'felice: mezzaluna');
  // la rabbia abbassa la palpebra verso il naso, la tristezza verso fuori
  const a = g('angry').occhi[1], s = g('sad').occhi[1];   // occhio destro: il naso è a sinistra (u < 0)
  assert.ok(a.palpebraSu(-0.6) > a.palpebraSu(0.6), 'arrabbiato: giù verso il naso');
  assert.ok(s.palpebraSu(0.6) > s.palpebraSu(-0.6), 'triste: giù verso fuori');
  // a occhi chiusi non c'è apertura, e ridendo la riga è all'insù
  assert.equal(g('neutral', { battito: 1 }).occhi[0].apertura, null);
  assert.ok(g('laughing').occhi[0].felici && !g('laughing').occhi[0].apertura, 'la risata chiude gli occhi ad arco');
});
prova('due dischi grafici non si sovrappongono, e restano dentro anche ai bordi', () => {
  scena({ Earth: {}, Moon: {} });
  const d = S.disegnaPersonaggi(telaFinta().ctx, 'prova', [corpo('Earth', 790, 10, 3), corpo('Moon', 785, 15, 2)], 800, 600);
  assert.equal(d.length, 2);
  for (const x of d) assert.ok(x.x - x.R >= 0 && x.x + x.R <= 800 && x.y - x.R >= 0 && x.y + x.R <= 600, 'dentro');
  assert.ok(Math.hypot(d[0].x - d[1].x, d[0].y - d[1].y) >= d[0].R + d[1].R, 'separati');
});
prova('planetario: sotto l\'orizzonte, dietro la collina, dietro la Luna, il Sole eclissato', () => {
  globalThis.sky = { larghezza: 800, altezza: 600, eclisse: { attiva: true, copertura: 0.8 }, camera: null };
  globalThis.skyAltezzaOrizzonte = () => 10;
  scena({ Venus: {}, Mars: {}, Jupiter: {}, Moon: {}, Sun: {}, Saturn: {} });
  const fai = () => {
    globalThis.storRicevuta('Moon', 400, 300, 60, { az: 100, alt: 40, tipo: 'luna' });
    globalThis.storRicevuta('Venus', 410, 300, 3, { az: 100, alt: 40, tipo: 'pianeta' });     // dietro la Luna
    globalThis.storRicevuta('Mars', 100, 300, 3, { az: 50, alt: -2, tipo: 'pianeta' });      // sotto l'orizzonte
    globalThis.storRicevuta('Jupiter', 600, 300, 3, { az: 200, alt: 6, tipo: 'pianeta' });   // dietro la collina
    globalThis.storRicevuta('Sun', 300, 100, 30, { az: 10, alt: 30, tipo: 'sole' });          // eclissato
    globalThis.storRicevuta('Saturn', 700, 150, 3, { az: 260, alt: 30, tipo: 'pianeta' });   // visibile
    return globalThis.storDisegnaCielo(telaFinta().ctx).map(x => x.id).sort();
  };
  assert.deepEqual(fai(), ['Moon', 'Saturn']);
  globalThis.sky.eclisse = null;
  assert.deepEqual(fai(), ['Moon', 'Saturn', 'Sun']);
  delete globalThis.sky; delete globalThis.skyAltezzaOrizzonte;
});
prova('vista 3D: chi ha davanti un disco più vicino è occultato; la Luna dietro la Terra non ha volto', () => {
  globalThis.sol = { L: 800, H: 600, vicino: false, altaBarra: 0, lunaSchermo: { px: 405, py: 300, r: 6, vicinanza: -1 }, luneSchermo: [], satSchermo: [] };
  scena({ Earth: {}, Moon: {}, Jupiter: {} });
  const d = globalThis.storDisegnaSistema(telaFinta().ctx, {
    corpi: [{ id: 'Earth', schermo: { px: 400, py: 300, vicinanza: 0 }, rDisegno: 40 },
      { id: 'Jupiter', schermo: { px: 600, py: 300, vicinanza: 2 }, rDisegno: 10 }],
    sole: { px: 100, py: 300, r: 20, vicinanza: -0.5 }
  });
  assert.deepEqual(d.map(x => x.id).sort(), ['Earth', 'Jupiter']);
  globalThis.sol.lunaSchermo.vicinanza = 1;  // ora davanti
  assert.ok(globalThis.storDisegnaSistema(telaFinta().ctx, {
    corpi: [{ id: 'Earth', schermo: { px: 400, py: 300, vicinanza: 0 }, rDisegno: 40 }]
  }).some(x => x.id === 'Moon'));
  delete globalThis.sol;
});

// =====================================================================
gruppo('i comandi del DSL, col motore delle demo');

const registro = Object.create(null);
for (const [k, c] of Object.entries(S.comandi)) registro[k] = c;
for (const k of ['set_date', 'center_target', 'zoom_fov', 'set_fov', 'camera_3d', 'zoom_view', 'set_location', 'date_range'])
  registro[k] = { crea: () => ({}) };
let tempo = 0, prossimo = 0;
const raf = new Map();
const motore = new Motore(registro, { ora: () => tempo, richiedi: f => { const id = ++prossimo; raf.set(id, f); return id; }, annulla: id => raf.delete(id) });
function passo(ms) { tempo += ms; const f = [...raf.values()]; raf.clear(); f.forEach(x => x()); }
const demo = (...scene) => `define_demo 'prova' {\n${scene.join('\n')}\n}`;
const sc = (vista, ...azioni) => `scene ${vista} { duration: 2s; ${azioni.map(a => 'action: ' + a + ';').join(' ')} }`;

prova('le storie predefinite si validano e usano solo personaggi ed espressioni noti', () => {
  const storie = predefiniti.filter(d => d.storia);
  assert.ok(storie.length >= 2);
  for (const d of storie) {
    const prep = motore.prepara(d.testo);
    const totale = prep.scene.reduce((n, s) => n + s.durata, 0);
    if (d.chiave === 'storia_luna') assert.ok(totale >= 60000 && totale <= 90000, 'il pilota dura fra 60 e 90 s: ' + totale);
    for (const s of prep.scene) assert.equal(s.azioni.filter(a => a.comando === 'character_speak').length, 1, 'una battuta per scena');
  }
});
prova('validazione: errori localizzati per bersaglio, espressione, sguardo, misura, scena e parametri', () => {
  const casi = [
    [sc('planetarium_view', "character_show { target: 'Pandora' }"), /Personaggio sconosciuto: Pandora/],
    [sc('planetarium_view', "character_show { target: 'Moon', expression: 'furious' }"), /Espressione sconosciuta: furious \(ammesse: neutral/],
    [sc('planetarium_view', "character_show { target: 'Moon', look: 'Pandora' }"), /Non so dove guardare/],
    [sc('planetarium_view', "character_show { target: 'Moon', size: 'huge' }"), /size vuole auto, disk o badge/],
    [sc('planetarium_view', "character_speak { target: 'Moon', text: 'ciao' }"), /deve comparire in questa scena/],
    [sc('didactic_view', "character_show { target: 'Moon' }"), /solo nel planetario e nella vista 3D/],
    [sc('planetarium_view', "character_show { target: 'Moon', color: 'red' }"), /Parametro sconosciuto: color/],
    [sc('planetarium_view', "character_show { target: 'Moon' }", "character_speak { target: 'Moon' }"), /vuole un id o un testo/],
    [sc('planetarium_view', "character_show { target: 'Moon' }", "character_speak { target: 'Moon', id: 'demo.narr.non.esiste' }"), /Narrazione sconosciuta/],
    [sc('planetarium_view', "character_show { target: 'Moon' }", `character_speak { target: 'Moon', text: '${'a'.repeat(401)}' }`), /troppo lungo/],
    [sc('planetarium_view', "character_show { target: 'Moon' }", "character_look_at { target: 'Moon' }"), /Non so dove guardare/]
  ];
  for (const [scena, atteso] of casi) assert.throws(() => motore.prepara(demo(scena)), atteso, scena);
  lingua = 'en';
  assert.throws(() => motore.prepara(demo(sc('planetarium_view', "character_show { target: 'Pandora' }"))), /Unknown character: Pandora/);
  lingua = 'it';
  // e tutto quello che c'è di buono passa
  motore.prepara(demo(sc('solar_system_3d', "character_show { target: 'ISS', expression: 'happy', look: 'Earth', size: 'badge' }",
    "character_show { target: 'Earth' }", "character_expression { target: 'ISS', expression: 'thinking', shot_from: 0.5 }",
    "character_look_at { target: 'Earth', object: 'viewer' }", "character_blink { target: 'Earth' }",
    "character_speak { target: 'ISS', text: 'Ciao dalla stazione!' }", "character_hide { target: 'Earth', shot_from: 0.9 }")));
});
prova('nessun effetto prima della validazione completa', () => {
  S.sgombra(); voce.richieste.length = 0;
  assert.throws(() => motore.avvia(demo(sc('planetarium_view', "character_show { target: 'Moon' }", "character_speak { target: 'Moon', text: 'a' }"),
    sc('planetarium_view', "character_show { target: 'Pandora' }")), {}));
  assert.equal(S.attivi, 0); assert.equal(voce.richieste.length, 0);
});
prova('cambio scena: chi non c\'è più se ne va, chi resta non rinasce; salto, riavvio e stop ripuliscono', async () => {
  S.sgombra(); voce.fermate.length = 0;
  const testo = demo(
    sc('planetarium_view', "character_show { target: 'Moon', expression: 'worried' }", "character_show { target: 'Earth' }",
      "character_speak { target: 'Moon', text: 'Uno' }"),
    sc('solar_system_3d', "character_show { target: 'Moon', expression: 'happy' }", "character_speak { target: 'Moon', text: 'Due' }"),
    sc('planetarium_view', "character_show { target: 'Sun' }", "character_speak { target: 'Sun', text: 'Tre' }"));
  motore.avvia(testo, { ripristina() {} });
  assert.deepEqual([...S.stato.personaggi.keys()].sort(), ['Earth', 'Moon']);
  const lunaPrima = S.stato.personaggi.get('Moon');
  voce.risolutori.forEach(r => r('testo')); voce.risolutori.length = 0;
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  passo(10); passo(2100);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(motore.indice, 1);
  assert.deepEqual([...S.stato.personaggi.keys()], ['Moon'], 'la Terra se n\'è andata');
  assert.equal(S.stato.personaggi.get('Moon'), lunaPrima, 'la Luna è la stessa, non rinata');
  assert.equal(S.stato.personaggi.get('Moon').espressione, 'happy', 'ma con la faccia della scena nuova');
  assert.ok(voce.fermate.includes('demo'), 'la voce della scena chiusa si è fermata');
  motore.vaiAScena(2);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual([...S.stato.personaggi.keys()], ['Sun'], 'salto: solo i personaggi della scena d\'arrivo');
  motore.vaiAScena(0);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual([...S.stato.personaggi.keys()].sort(), ['Earth', 'Moon'], 'riavvio');
  motore.ferma();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(S.attivi, 0, 'stop: nessun volto');
  assert.equal(S.parlante, null);
});
prova('errore a metà scena: tutto ripulito', async () => {
  S.sgombra();
  registro.esplode = { crea() { throw new Error('boom'); } };
  motore.avvia(demo(sc('planetarium_view', "character_show { target: 'Moon' }", "character_speak { target: 'Moon', text: 'x' }", 'esplode {}')), { ripristina() {} });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(motore.stato, 'errore');
  assert.equal(S.attivi, 0);
  delete registro.esplode;
});
prova('pausa e ripresa: una scena che si apre in pausa parla in pausa, la promessa tardiva non riapre niente', async () => {
  S.sgombra(); voce.pause.length = 0; voce.risolutori.length = 0;
  motore.avvia(demo(sc('planetarium_view', "character_show { target: 'Moon' }", "character_speak { target: 'Moon', text: 'Uno' }"),
    sc('planetarium_view', "character_show { target: 'Moon' }", "character_speak { target: 'Moon', text: 'Due' }")), { ripristina() {} });
  motore.pausa(); globalThis.AstroDemo.stato = 'pausa';
  motore.vaiAScena(1);
  assert.ok(voce.pause.includes('demo'), 'la battuta della scena aperta in pausa è in pausa');
  const vecchia = voce.risolutori[0];
  vecchia('interrotta');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(motore.stato, 'pausa', 'la promessa della scena saltata non fa ripartire niente');
  assert.equal(S.parlante, 'Moon', 'e non toglie la parola alla battuta di adesso');
  globalThis.AstroDemo.stato = 'attivo'; motore.riprendi();
  motore.ferma();
  await Promise.resolve();
});

// =====================================================================
gruppo('il corpo nello spazio: crescita, viaggi, animazioni (v409)');

// La camera finta della vista 3D: la proiezione è quella di `solProietta`
const SOL_FINTO = () => ({ L: 800, H: 600, cx: 400, cy: 300, panX: 0, panY: 0, az: 0.7, elev: 35, scala: 100,
  vicino: false, altaBarra: 0, luneSchermo: [], satSchermo: [] });
function proietta(p, s = globalThis.sol) {
  const a = s.az, e = s.elev * Math.PI / 180;
  const xr = p.x * Math.cos(a) - p.y * Math.sin(a), yr = p.x * Math.sin(a) + p.y * Math.cos(a);
  return { px: s.cx + s.panX + xr * s.scala, py: s.cy + s.panY - (yr * Math.sin(e) + p.z * Math.cos(e)) * s.scala, vicinanza: p.z * Math.sin(e) - yr * Math.cos(e) };
}
// L'orologio della storia avanza solo disegnando, a passi di al più 100 ms
function scorri(ms) {
  for (let fatto = 0; fatto < ms; fatto += 50) { avanza(50); S.disegnaPersonaggi(telaFinta().ctx, 'sistema', [], 800, 600); }
}
const MARTE = { x: 1.2, y: -0.4, z: 0.05 }, GIOVE = { x: -2, y: 1.5, z: -0.1 };

prova('la terna dello schermo è quella della proiezione: un passo a destra è un pixel a destra', () => {
  globalThis.sol = SOL_FINTO();
  const assi = S.assiSchermo(globalThis.sol);
  const o = proietta({ x: 0, y: 0, z: 0 });
  const dx = proietta(assi.ex), su = proietta(assi.su), w = proietta(assi.w);
  assert.ok(Math.abs(dx.px - o.px - 100) < 1e-9 && Math.abs(dx.py - o.py) < 1e-9, 'ex → destra');
  assert.ok(Math.abs(su.py - o.py + 100) < 1e-9 && Math.abs(su.px - o.px) < 1e-9, 'su → in alto');
  assert.ok(Math.abs(w.px - o.px) < 1e-9 && Math.abs(w.py - o.py) < 1e-9 && Math.abs(w.vicinanza - 1) < 1e-9, 'w → verso chi guarda');
  delete globalThis.sol;
});
prova('nella 3D l\'astro cresce quanto basta a portare il volto addosso; con size: real resta com\'è; uscito di scena torna', () => {
  globalThis.sol = SOL_FINTO();
  scena({ Mars: {} });
  assert.equal(S.raggio3D('Mars', 3), 3, 'al primo istante non è ancora cresciuto');
  scorri(900);
  const r = S.raggio3D('Mars', 3);
  assert.ok(r * S.profilo('Mars').scala >= S.STOR_VOLTO_MIN_PX, 'il volto ci sta: ' + r);
  const d = S.disegnaPersonaggi(telaFinta().ctx, 'sistema', [corpo('Mars', 400, 300, r)], 800, 600)[0];
  assert.equal(d.addosso, true, 'il volto è sull\'astro, non in un adesivo');
  assert.ok(Math.abs(S.raggio3D('Mars', 60) - 60) < 1e-9, 'un astro già grande non cresce');
  scena({ Mars: { misura: 'real' } });
  scorri(900);
  assert.equal(S.raggio3D('Mars', 3), 3, 'real: la misura vera');
  scena({ Mars: {} }); scorri(900); S.raggio3D('Mars', 3);
  S.sgombra();
  assert.ok(S.raggio3D('Mars', 3) > 3, 'appena uscito scivola indietro, non salta');
  avanza(800);
  assert.equal(S.raggio3D('Mars', 3), 3, 'e poi è tornato della sua misura');
  assert.equal(S.scena3D('Jupiter', GIOVE, 5), GIOVE, 'senza personaggi la posizione passa intatta');
  delete globalThis.sol;
});
prova('character_move porta l\'astro accanto alla meta, sullo schermo e nello spazio; character_return lo rimette sull\'orbita', async () => {
  S.sgombra();
  globalThis.sol = SOL_FINTO();
  motore.avvia(demo(
    sc('solar_system_3d', "character_show { target: 'Mars', size: 'real' }", "character_show { target: 'Jupiter', size: 'real' }",
      "character_move { target: 'Mars', to: 'Jupiter', side: 'right', path: loop }"),
    sc('solar_system_3d', "character_show { target: 'Mars', size: 'real' }", "character_show { target: 'Jupiter', size: 'real' }",
      "character_return { target: 'Mars', path: hop }")), { ripristina() {} });
  const fotogramma = () => { S.scena3D('Jupiter', GIOVE, 20); return S.scena3D('Mars', MARTE, 10); };
  const partenza = fotogramma();
  assert.deepEqual(partenza, MARTE, 'a u = 0 è ancora sull\'orbita');
  passo(10); passo(1000);
  const aMeta = fotogramma();
  assert.ok(Math.hypot(aMeta.x - MARTE.x, aMeta.y - MARTE.y) > 0.1, 'a metà è in viaggio');
  // in fondo alla prima scena Marte è accanto a Giove, a destra, alla distanza dei due raggi
  passo(989);
  const arrivo = fotogramma();
  const g = proietta(GIOVE), m = proietta(arrivo);
  assert.ok(m.px > g.px + 20, 'a destra di Giove: ' + (m.px - g.px));
  assert.ok(Math.abs(m.py - g.py) < 1, 'alla stessa altezza');
  assert.ok(Math.abs(Math.hypot(m.px - g.px, m.py - g.py) - ((20 + 10) * 1.3 + 8)) < 1, 'alla distanza dei due raggi: ' + Math.hypot(m.px - g.px, m.py - g.py));
  passo(12);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(motore.indice, 1, 'seconda scena');
  const ripartenza = fotogramma();
  assert.ok(Math.hypot(ripartenza.x - arrivo.x, ripartenza.y - arrivo.y) < 0.03, 'il ritorno parte da dove era arrivato: ' +
    Math.hypot(ripartenza.x - arrivo.x, ripartenza.y - arrivo.y));
  passo(10); passo(2100);
  const casa = fotogramma();
  assert.ok(Math.hypot(casa.x - MARTE.x, casa.y - MARTE.y, casa.z - MARTE.z) < 1e-9, 'tornato sulla sua orbita');
  motore.ferma(); await Promise.resolve(); await Promise.resolve();
  delete globalThis.sol;
});
prova('i percorsi partono e arrivano dove devono; il teletrasporto fa sparire e ricomparire', () => {
  globalThis.sol = SOL_FINTO();
  const assi = S.assiSchermo(globalThis.sol);
  const A = { x: 1, y: 0, z: 0 }, D = { x: -1, y: 2, z: 0.3 };
  for (const p of S.STOR_PERCORSI) {
    const da = S.puntoViaggio(p, A, D, 0, assi, 0), a = S.puntoViaggio(p, A, D, 1, assi, 0);
    assert.ok(Math.hypot(da.x - A.x, da.y - A.y, da.z - A.z) < 1e-9, p + ' parte da A');
    assert.ok(Math.hypot(a.x - D.x, a.y - D.y, a.z - D.z) < 1e-9, p + ' arriva in D');
  }
  const arco = S.puntoViaggio('arc', A, D, 0.5, assi), dritto = S.puntoViaggio('straight', A, D, 0.5, assi);
  assert.ok(proietta(arco).py < proietta(dritto).py - 5, 'l\'arco curva verso l\'alto');
  scena({ Mars: { misura: 'real' } });
  S.stato.personaggi.get('Mars').moto = { verso: 'orbit', percorso: 'teleport', u: 0.5, A: null };
  assert.ok(S.raggio3D('Mars', 10) < 1, 'a metà teletrasporto è sparito');
  S.stato.personaggi.get('Mars').moto.u = 0.95;
  assert.ok(S.raggio3D('Mars', 10) > 8, 'e poi ricompare');
  S.sgombra();
  delete globalThis.sol;
});
prova('le animazioni sono ferme all\'inizio e alla fine, e si muovono in mezzo', () => {
  for (const a of S.STOR_ANIMAZIONI) {
    for (const u of [0, 1]) {
      const o = S.animazioneAl(a, u, 2, 1);
      assert.deepEqual([o.dx, o.dy, o.k, o.giro, o.sx, o.sy], [0, 0, 1, 0, 1, 1], a + ' ferma a ' + u);
    }
    let mosso = false;
    for (let u = 0.05; u < 1; u += 0.1) {
      const o = S.animazioneAl(a, u, 2, 1);
      if (Math.abs(o.dx) + Math.abs(o.dy) + Math.abs(o.k - 1) + Math.abs(o.giro) + Math.abs(o.sx - 1) > 0.02) mosso = true;
    }
    assert.ok(mosso, a + ' si muove');
  }
  assert.ok(S.animazioneAl('jump', 0.25, 2, 1).dy < -1, 'il salto va in su');
});
prova('character_animate sposta l\'astro vero nella 3D; character_scale cambia la sua misura e la tiene', async () => {
  S.sgombra();
  globalThis.sol = SOL_FINTO();
  motore.avvia(demo(sc('solar_system_3d', "character_show { target: 'Mars', size: 'real' }",
    "character_animate { target: 'Mars', animation: jump, times: 1 }", "character_scale { target: 'Mars', scale: 2, shot_to: 0.5 }")), { ripristina() {} });
  passo(10); passo(500);
  const r = S.raggio3D('Mars', 10);
  const su = proietta(S.scena3D('Mars', MARTE, 10)).py, giu = proietta(MARTE).py;
  assert.ok(su < giu - 5, 'il salto alza l\'astro vero: ' + (giu - su));
  passo(600);
  assert.ok(Math.abs(S.raggio3D('Mars', 10) - 20) < 1e-6 && r < 20, 'la scala arriva a 2 e ci resta');
  motore.ferma(); await Promise.resolve(); await Promise.resolve();
  delete globalThis.sol;
});

// =====================================================================
gruppo('gli effetti speciali (v409)');

prova('ogni effetto si disegna, segue il suo astro, e se ne va finito il suo tempo', () => {
  S.sgombra();
  for (const tipo of Object.keys(S.STOR_EFFETTI)) S.effetto(tipo, { target: 'Jupiter' });
  S.effetto('flash', {});
  assert.equal(S.effetti.length, Object.keys(S.STOR_EFFETTI).length + 1);
  for (let k = 0; k < 8; k++) {
    avanza(100);
    const tela = telaFinta();
    S.disegnaPersonaggi(tela.ctx, 'sistema', [corpo('Jupiter', 300, 200, 18)], 800, 600);
    assert.ok(tela.chiamate.length > 20, 'si disegna qualcosa');
  }
  for (let k = 0; k < 40; k++) { avanza(100); S.disegnaPersonaggi(telaFinta().ctx, 'sistema', [], 800, 600); }
  assert.equal(S.effetti.length, 0, 'finiti, se ne sono andati');
});
prova('il comando effect si valida e crea il suo effetto anche senza personaggi', async () => {
  S.sgombra();
  motore.avvia(demo(sc('planetarium_view', "effect { type: explosion, target: 'Jupiter', size: 1.5, color: '#ff8800' }",
    "effect { type: confetti, at: top, shot_from: 0.5 }")), { ripristina() {} });
  assert.deepEqual(S.effetti.map(e => e.tipo), ['explosion']);
  passo(10); passo(1100);
  assert.deepEqual(S.effetti.map(e => e.tipo).sort(), ['confetti', 'explosion']);
  motore.ferma(); await Promise.resolve(); await Promise.resolve();
});
prova('validazione dei comandi nuovi: vista, valori ammessi, numeri, colori, mete', () => {
  const casi = [
    [sc('planetarium_view', "character_show { target: 'Mars' }", "character_move { target: 'Mars', to: 'Jupiter' }"), /solo nella vista 3D/],
    [sc('solar_system_3d', "character_show { target: 'Mars' }", "character_move { target: 'Mars', to: 'Pandora' }"), /Non so dove andare: Pandora/],
    [sc('solar_system_3d', "character_show { target: 'Mars' }", "character_move { target: 'Mars', to: 'Mars' }"), /verso sé stesso/],
    [sc('solar_system_3d', "character_show { target: 'Mars' }", "character_move { target: 'Mars', to: 'center', path: wobbly }"), /path sconosciuto: wobbly/],
    [sc('solar_system_3d', "character_show { target: 'Mars' }", "character_move { target: 'Mars', to: 'Sun', distance: 99 }"), /distance vuole un numero fra 0.3 e 6/],
    [sc('solar_system_3d', "character_move { target: 'Mars', to: 'Sun' }"), /deve comparire in questa scena/],
    [sc('solar_system_3d', "character_show { target: 'Mars' }", "character_animate { target: 'Mars', animation: fly }"), /animation sconosciuto: fly/],
    [sc('solar_system_3d', "character_show { target: 'Mars' }", "character_scale { target: 'Mars', scale: 40 }"), /scale vuole un numero/],
    [sc('solar_system_3d', "effect { type: nuke }"), /type sconosciuto: nuke/],
    [sc('solar_system_3d', "effect { type: smoke, color: 'red' }"), /Colore non valido/],
    [sc('didactic_view', "effect { type: smoke }"), /solo nel planetario e nella vista 3D/]
  ];
  for (const [scena, atteso] of casi) assert.throws(() => motore.prepara(demo(scena)), atteso, scena);
  lingua = 'en';
  assert.throws(() => motore.prepara(demo(casi[0][0])), /only works in the 3D view/);
  lingua = 'it';
  motore.prepara(demo(sc('solar_system_3d', "character_show { target: 'Moon', size: 'real' }", "character_show { target: 'Earth' }",
    "character_move { target: 'Moon', to: 'Earth', side: 'above', distance: 2, path: spiral, turns: 2, shot_to: 0.6 }",
    "character_return { target: 'Moon', path: teleport, shot_from: 0.6 }", "character_animate { target: 'Earth', animation: dance, times: 3, strength: 1.5 }",
    "character_scale { target: 'Earth', scale: 1.5 }", "effect { type: hearts, target: 'Earth', duration: 2.5 }")));
});

// =====================================================================
gruppo('lo Studio delle storie (v409)');

const St = require('../storie-studio.js');
globalThis.ASTRO_DIZIONARI = DIZ;

prova('ogni modello diventa un copione valido, che supera il suo stesso controllo', () => {
  for (const scopo of Object.keys(St.STUDIO_SCOPI)) {
    for (const l of ['it', 'en']) {
      lingua = l;
      const p = St.daModello(scopo);
      const prep = motore.prepara(St.copione(p));
      for (const s of prep.scene) assert.ok(s.azioni.filter(a => a.comando === 'character_speak').length <= 1, scopo + ': una battuta per scena');
      const no = St.consigli(p, testo => motore.prepara(testo)).filter(c => !c.ok).map(c => c.chiave);
      if (scopo !== 'libera') assert.deepEqual(no, [], `${scopo} (${l}): ${no.join(', ')}`);
      for (const c of St.consigli(p)) assert.ok(c.testo && !/studio\./.test(c.testo), 'consiglio tradotto: ' + c.chiave);
    }
  }
  lingua = 'it';
});
prova('il copione di una scena sola, i giorni che passano e i viaggi saltati dove non si può', () => {
  const p = St.daModello('fasi');
  const una = motore.prepara(St.copione(p, { scena: 2 }));
  assert.equal(una.scene.length, 2);
  const range = una.scene.map(s => s.azioni.find(a => a.comando === 'date_range').parametri);
  assert.equal(range[0].to, range[1].from, 'i giorni si dividono fra i momenti senza buchi');
  assert.equal(Math.round((Date.parse(range[1].to) - Date.parse(range[0].from)) / 86400000), 11);
  p.scene[0].momenti[0].azioni.push(St.nuovaAzione('muovi', { chi: 'Moon', verso: 'Earth' }));
  assert.ok(!/character_move/.test(St.copione(p, { scena: 0 })), 'nel planetario niente viaggi');
  assert.ok(St.consigli(p).some(c => c.chiave === 'viaggi' && !c.ok), 'e il controllo lo dice');
});
prova('i comandi a parole, in italiano e in inglese', () => {
  const p = St.daModello('viaggio');
  const r = St.capisci("Marte vola verso Giove facendo un giro\nGiove dice: Benvenuto, Marte!\nfuochi d'artificio su Saturno\nla Luna è triste\nalla fine Saturno balla tre volte\nMarte torna a casa saltando\nbla bla", p);
  const sintesi = r.ops.map(o => o.op === 'battuta' ? ['battuta', o.chi, o.testo] : [o.azione.tipo, o.azione.chi, o.azione.verso || o.azione.effetto || o.azione.animazione || o.azione.umore || o.azione.percorso]);
  assert.deepEqual(sintesi, [['muovi', 'Mars', 'Jupiter'], ['battuta', 'Jupiter', 'Benvenuto, Marte!'], ['effetto', 'Saturn', 'fireworks'],
    ['umore', 'Moon', 'sad'], ['anima', 'Saturn', 'dance'], ['torna', 'Mars', 'hop']]);
  assert.equal(r.ops[0].azione.percorso, 'loop');
  assert.equal(r.ops[4].azione.quando, 'fine'); assert.equal(r.ops[4].azione.volte, 3);
  assert.deepEqual(r.nonCapite, ['bla bla']);
  const prima = p.scene[0].momenti.length;
  St.applica(p, 0, r.ops);
  assert.equal(p.scene[0].momenti.length, prima + 1, 'la battuta apre un momento nuovo');
  assert.ok(p.cast.includes('Moon'), 'chi è nominato entra nel cast');
  assert.ok(motore.prepara(St.copione(p)), 'e il copione resta valido');
  const en = St.capisci('Mars flies to Jupiter in a spiral\nJupiter says: Welcome!\nexplosion on Saturn', p);
  assert.deepEqual(en.ops.map(o => o.op === 'battuta' ? o.testo : o.azione.tipo + ':' + (o.azione.percorso || o.azione.effetto)), ['muovi:spiral', 'Welcome!', 'effetto:explosion']);
});
prova('gli aiuti: la faccia dal testo, le idee per le azioni, l\'ambiente, il momento dopo', () => {
  assert.equal(St.umoreDalTesto('Oh no! Mi manca un pezzo!'), 'worried');
  assert.equal(St.umoreDalTesto('Che bello, evviva!'), 'excited');
  assert.equal(St.umoreDalTesto('Perché gira?'), 'thinking');
  assert.equal(St.umoreDalTesto('I am so sad'), 'sad');
  const p = St.daModello('avventura');
  const idee = St.ideeAzioni(p, p.scene[0], St.nuovoMomento({ chi: 'Jupiter', testo: 'Boom! Andiamo a festeggiare, amici!' }));
  const tipi = idee.map(a => a.tipo + ':' + (a.effetto || a.animazione || a.verso || ''));
  assert.ok(tipi.includes('effetto:explosion') && tipi.includes('muovi:Mars') && tipi.includes('effetto:hearts'), tipi.join());
  assert.ok(idee.length <= 6);
  assert.deepEqual(St.ambientePer(['Moon', 'Earth']), { ambiente: 'terra_luna' });
  assert.deepEqual(St.ambientePer(['Saturn']), { ambiente: 'pianeta', fuoco: 'Saturn' });
  assert.equal(St.ambientePer(['Mars', 'Venus']).ambiente, 'sistema');
  const dopo = St.prossimoMomento(p, p.scene[0]);
  assert.ok(dopo.chi && dopo.chi !== p.scene[0].momenti[p.scene[0].momenti.length - 1].chi, 'parla qualcun altro');
  assert.ok(dopo.testo.length > 5);
});
prova('un progetto rotto o estraneo non rompe lo Studio', () => {
  const p = St.ripulisci({ titolo: 42, cast: ['Moon', '<script>', 7], scene: [{ ambiente: 'marte', momenti: [{ testo: 'x'.repeat(900), azioni: [{ tipo: 'boh' }, { tipo: 'effetto', colore: 'rosso' }] }] }] });
  assert.equal(p.titolo, '');
  assert.deepEqual(p.cast, ['Moon']);
  assert.equal(p.scene[0].ambiente, 'sistema');
  assert.equal(p.scene[0].momenti[0].testo.length, 400);
  assert.deepEqual(p.scene[0].momenti[0].azioni.map(a => a.tipo), ['effetto']);
  assert.equal(p.scene[0].momenti[0].azioni[0].colore, '');
  assert.throws(() => St.ripulisci(null));
  assert.ok(motore.prepara(St.copione(St.ripulisci({ scene: [] }))));
  assert.ok(/\\'/.test(St.copione(St.nuovoProgetto({ titolo: "L'avventura" }))), 'gli apostrofi si proteggono');
});
prova('ogni testo dello Studio e dei comandi nuovi esiste in tutte e due le lingue', () => {
  const sorgente = fs.readFileSync(path.join(RADICE, 'storie-studio.js'), 'utf8');
  const chiavi = new Set();
  for (const m of sorgente.matchAll(/'((?:studio|storie)\.[\w.]+)'/g)) if (!/\.$/.test(m[1])) chiavi.add(m[1]);
  for (const k of S.STOR_PERCORSI) chiavi.add('storie.percorso.' + k);
  for (const k of S.STOR_ANIMAZIONI) chiavi.add('storie.animazione.' + k);
  for (const k of Object.keys(S.STOR_EFFETTI)) chiavi.add('storie.effetto.' + k);
  for (const k of St.STUDIO_TIPI) { chiavi.add('studio.tipo.' + k); chiavi.add('studio.descrivi.' + k); }
  for (const k of St.STUDIO_AMBIENTI) chiavi.add('studio.ambiente.' + k);
  for (const k of ['solo3d', 'destinazioneIgnota', 'versoSeStesso', 'valoreIgnoto', 'numeroFuori', 'coloreNonValido']) chiavi.add('demo.err.' + k);
  for (const scopo of Object.keys(St.STUDIO_SCOPI)) for (const c of ['nome', 'titolo', 'obiettivo', 'descrizione']) chiavi.add(`studio.scopo.${scopo}.${c}`);
  // una voce col plurale è un oggetto { uno, altri }
  const testo = v => typeof v === 'string' || !!(v && typeof v.altri === 'string' && typeof v.uno === 'string');
  for (const k of chiavi) for (const l of ['it', 'en']) assert.ok(testo(DIZ[l].messaggi[k]), `${k} manca in ${l}`);
  const it = Object.keys(DIZ.it.messaggi).filter(k => /^studio\./.test(k)), en = Object.keys(DIZ.en.messaggi).filter(k => /^studio\./.test(k));
  assert.deepEqual(it.sort(), en.sort(), 'le due lingue hanno le stesse chiavi dello Studio');
});

// =====================================================================
gruppo('italiano e inglese');

prova('ogni testo delle storie e dei comandi esiste in tutte e due le lingue', () => {
  const chiavi = new Set();
  for (const d of predefiniti.filter(x => x.storia)) {
    chiavi.add('demo.builtin.' + d.chiave + '.title'); chiavi.add('demo.builtin.' + d.chiave + '.description');
    for (const s of analizza(d.testo).scene) for (const a of s.azioni) if (a.parametri.id) chiavi.add(a.parametri.id);
  }
  const sorgente = fs.readFileSync(path.join(RADICE, 'storie-cosmiche.js'), 'utf8');
  for (const m of sorgente.matchAll(/'(storie\.[\w.]+)'/g)) if (!/\.$/.test(m[1])) chiavi.add(m[1]);
  for (const k of Object.keys(S.STOR_ESPRESSIONI)) chiavi.add('storie.espressione.' + k);
  for (const id of Object.keys(S.STOR_PERSONAGGI)) chiavi.add('storie.personalita.' + S.profilo(id).personalita);
  for (const f of Object.keys(S.STOR_FAMIGLIE)) chiavi.add('storie.personalita.' + S.STOR_FAMIGLIE[f].personalita);
  for (const k of ['personaggioIgnoto', 'espressioneIgnota', 'sguardoIgnoto', 'personaggioNonInScena', 'personaggioVista', 'personaggioMisura'])
    chiavi.add('demo.err.' + k);
  for (const k of chiavi) for (const l of ['it', 'en'])
    assert.equal(typeof DIZ[l].messaggi[k], 'string', `${k} manca in ${l}`);
  assert.ok(chiavi.size > 40, 'chiavi controllate: ' + chiavi.size);
});
prova('il pilota dice le battute del soggetto, e chiude con quella giusta', () => {
  const t = k => DIZ.it.messaggi[k];
  assert.match(t('demo.narr.storia_luna.1'), /pezzo/);
  assert.match(t('demo.narr.storia_luna.8'), /Sono sempre intera, anche quando sembro una fettina!/);
  assert.match(DIZ.en.messaggi['demo.narr.storia_luna.8'], /always whole/);
});

// =====================================================================
(async () => {
  for (const p of prove) {
    if (p.gruppo) { console.log('\n— ' + p.gruppo + ' —'); continue; }
    try { await p.fn(); passate++; console.log('  ok        ' + p.nome); }
    catch (e) { fallite++; console.log('  FALLITA   ' + p.nome + '\n            ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n            ')); }
  }
  console.log(`\n${passate} passate, ${fallite} fallite (storie cosmiche)`);
  process.exitCode = fallite ? 1 : 0;
})();
