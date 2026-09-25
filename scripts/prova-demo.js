'use strict';
const { analizza, Motore } = require('../demo-motore.js');
const predefiniti = require('../demo-predefiniti.js');
let verifiche = 0;
function ok(condizione, messaggio) { if (!condizione) throw new Error(messaggio); verifiche++; }
function rifiuta(fn, messaggio) { let errore; try { fn(); } catch (e) { errore = e; } ok(!!errore, messaggio); return errore; }
const testo = "// Commento\n define_demo 'eclisse_tour' {\n" +
  "scene planetarium_view { duration: 10s; action: timelapse { start: 18:00, end: 22:00 }; action: highlight_object { name: 'Venus', scale: 5.0 }; }\n" +
  "scene transition { duration: 5s; action: zoom_view { type: geometric, final_target: solar_system_3d }; }\n" +
  "scene solar_system_3d { duration: 15s; action: orbit_object { object: 'Earth-Moon', angle: 360, speed: slow }; action: center { target: 'Eclipse Shadow' }; }}";
const ast = analizza(testo);
ok(predefiniti.length >= 4, 'Almeno quattro tour predefiniti');
ok(new Set(predefiniti.map(d => d.chiave)).size === predefiniti.length, 'Identificativi built-in univoci');
for (const d of predefiniti) {
  const demo = analizza(d.testo);
  ok(demo.id === d.chiave && demo.scene.length >= 2 &&
    demo.scene.every(s => s.durata > 0 && s.azioni.length), 'Script built-in valido: ' + d.chiave);
}
ok(ast.id === 'eclisse_tour' && ast.scene.length === 3, 'Tre scene e nome');
ok(ast.scene.map(s => s.durata).join() === '10000,5000,15000', 'Durate esatte');
ok(ast.scene[0].azioni[0].parametri.start === '18:00', 'Orario non confuso con numero');
ok(ast.scene[2].azioni[1].comando === 'center_target', 'Alias center');
ok(ast.scene[0].azioni[1].parametri.scale === 5, 'Decimale');
ok(analizza("define_demo x { scene y { duration: 0.5s; action: x { text: 'a // b' }; }}").scene[0].durata === 500, 'Commenti dentro stringhe');
for (const errato of [
  testo + 'evil()', testo.replace('10s', '0s'), testo.replace('10s', '-5s'),
  testo.replace('10s', '10'), testo.replace('10s;', '10s; duration: 2s;'),
  testo.replace("name: 'Venus'", "name: 'Venus', name: 'Mars'"),
  testo.slice(0, -1), "define_demo x {}", testo.replace('scale: 5.0', 'scale: alert(1)')
]) rifiuta(() => analizza(errato), 'Rifiuta script malformato');
ok(/riga \d+, colonna \d+/.test(rifiuta(() => analizza('!'), 'Posizione errore').message), 'Diagnostica posizionale');
// L'errore cade sulla riga sbagliata, non sulla fine del testo.
ok(/\(riga 3,/.test(rifiuta(() => analizza("define_demo x {\n scene y {\n  foo: 1;\n  duration: 1s;\n }\n}"),
  'Campo sconosciuto').message), 'Campo sconosciuto sulla sua riga');
ok(/\(riga 4,/.test(rifiuta(() => analizza("define_demo x {\n scene y {\n  duration: 1s;\n  duration: 2s;\n }\n}"),
  'Durata duplicata').message), 'Durata duplicata sulla sua riga');

let tempo = 0, prossimoId = 0, richieste = new Map(), eventi = [], ripristini = 0;
const registro = Object.create(null);
for (const nome of ['timelapse', 'highlight_object', 'zoom_view', 'orbit_object', 'center_target'])
  registro[nome] = { crea: () => ({ aggiorna: u => eventi.push([nome, u]), chiudi: () => eventi.push([nome, 'chiudi']) }) };
const motore = new Motore(registro, {
  ora: () => tempo,
  richiedi: f => { const id = ++prossimoId; richieste.set(id, f); return id; },
  annulla: id => richieste.delete(id)
});
function passo(ms) {
  tempo += ms; const lavori = [...richieste.values()]; richieste.clear(); lavori.forEach(f => f());
}
const contesto = () => ({ ripristina: () => ripristini++ });
motore.avvia(testo, contesto());
ok(eventi.some(e => e[0] === 'timelapse' && e[1] === 0) &&
  eventi.some(e => e[0] === 'highlight_object' && e[1] === 0), 'Azioni simultanee');
passo(5000);
ok(eventi.some(e => e[0] === 'timelapse' && e[1] === 0.5), 'Mezzo timelapse');
motore.pausa(); const quanti = eventi.length;
passo(60000); ok(eventi.length === quanti && richieste.size === 0, 'Pausa senza fotogrammi residui');
motore.riprendi(); passo(5000);
ok(motore.indice === 1 && eventi.some(e => e[0] === 'timelapse' && e[1] === 1), 'Fine esatta a 10s');
passo(5000); ok(motore.indice === 2, 'Terza scena a 15s');
passo(15000);
ok(motore.stato === 'completato' && richieste.size === 0 && ripristini === 1, 'Fine e ripristino a 30s');
motore.ferma(); ok(ripristini === 1, 'Ripristino una volta sola');
motore.avvia(testo, contesto()); passo(37000);
ok(motore.stato === 'completato' && ripristini === 2, 'Fotogramma tardivo attraversa tutte le scene');
motore.avvia(testo, contesto()); passo(3000); motore.ferma();
ok(richieste.size === 0 && ripristini === 3, 'Stop cancella il fotogramma');
rifiuta(() => motore.avvia(testo.replace('timelapse', 'ignoto'), contesto()), 'Comando ignoto respinto prima degli effetti');
ok(ripristini === 3, 'Nessun effetto per script invalido');
// Il salto di scena chiude quella in corso e apre l'altra dall'inizio.
motore.avvia(testo, contesto()); passo(2000); eventi.length = 0;
motore.vaiAScena(2);
ok(motore.indice === 2 && eventi.some(e => e[0] === 'timelapse' && e[1] === 'chiudi') &&
  eventi.some(e => e[0] === 'orbit_object' && e[1] === 0), 'Salto di scena');
passo(15000); ok(motore.stato === 'completato' && ripristini === 4, 'Il salto conserva la fine');
registro.timelapse.crea = () => ({ aggiorna() { throw new Error('guasto controllato'); } });
motore.avvia(testo, contesto());
ok(motore.stato === 'errore' && ripristini === 5 && richieste.size === 0, 'Guasto ripristina e termina');
// La voce segue l'orologio: il motore passa pausa e ripresa al contesto, e un
// contesto che si rompe lì non ferma il racconto.
registro.timelapse.crea = () => ({ aggiorna: u => eventi.push(['timelapse', u]) });
const voce = [];
motore.avvia(testo, { ripristina: () => ripristini++, pausa: () => voce.push('pausa'), riprendi: () => voce.push('riprendi') });
passo(1000); motore.pausa(); motore.pausa(); motore.riprendi(); motore.riprendi();
ok(voce.join() === 'pausa,riprendi', 'Pausa e ripresa arrivano al contesto una volta sola');
motore.ferma();
motore.avvia(testo, { ripristina: () => ripristini++, pausa() { throw new Error('voce rotta'); } });
motore.pausa();
ok(motore.stato === 'pausa', 'Una voce che si rompe non ferma la demo');
motore.riprendi(); passo(1000); ok(motore.stato === 'attivo', 'E la demo riparte');
motore.ferma();
// L'intro comune: è del motore, gira sul suo orologio e sta prima della
// prima scena. Le domande sono quelle che a occhio non si giudicano: la
// prima scena parte davvero dopo, col suo orologio a zero; la pausa la
// ferma; Stop, un errore e un salto la chiudono una volta sola.
function introFinta(durata) {
  const i = { durata, passi: [], fine: 0, chiudi: 0 };
  i.aggiorna = u => i.passi.push(u);
  i.fine = () => { i.finita = (i.finita || 0) + 1; i.scenaAllaFine = motore.indice; i.eventiAllaFine = eventi.length; };
  i.chiudi = () => { i.chiusa = (i.chiusa || 0) + 1; };
  return i;
}
registro.timelapse.crea = () => ({ aggiorna: u => eventi.push(['timelapse', u]), chiudi: () => eventi.push(['timelapse', 'chiudi']) });
{
  eventi.length = 0;
  const intro = introFinta(3000);
  motore.avvia(testo, { ripristina: () => ripristini++, intro });
  ok(motore.inIntro && intro.passi[0] === 0 && !eventi.length, 'Intro: nessuna scena prima della fine dell’intro');
  passo(1500);
  ok(motore.inIntro && Math.abs(intro.passi[intro.passi.length - 1] - 0.5) < 1e-9 && !eventi.length, 'Intro a metà');
  motore.pausa(); passo(60000);
  ok(motore.inIntro && !eventi.length && richieste.size === 0, 'Intro in pausa: il tempo non passa');
  motore.riprendi(); passo(1499);
  ok(motore.inIntro && !eventi.length, 'Intro: tre secondi, non uno di meno');
  passo(1);
  ok(!motore.inIntro && intro.finita === 1 && intro.scenaAllaFine === 0 && intro.eventiAllaFine > 0 && !intro.chiusa,
    'Intro finita: la prima scena è già aperta quando il nero se ne va');
  ok(eventi.some(e => e[0] === 'timelapse' && e[1] === 0) && motore.trascorso === 0, 'La prima scena parte da zero');
  passo(5000);
  ok(eventi.some(e => e[0] === 'timelapse' && e[1] === 0.5), 'Prima scena scandita dal suo orologio');
  passo(25000);
  ok(motore.stato === 'completato' && intro.finita === 1 && !intro.chiusa, 'Intro: una fine sola');
}
{
  // Un fotogramma tardivo che scavalca l'intro non porta avanzi dentro alla scena.
  eventi.length = 0;
  const intro = introFinta(3000);
  motore.avvia(testo, { ripristina: () => ripristini++, intro });
  passo(8000);
  ok(intro.finita === 1 && motore.indice === 0 && motore.trascorso === 0, 'Fotogramma lungo: la scena riparte da zero');
  motore.ferma();
  ok(!intro.chiusa, 'Stop dopo l’intro: niente da chiudere');
}
{
  const intro = introFinta(3000);
  const primi = ripristini;
  motore.avvia(testo, { ripristina: () => ripristini++, intro }); passo(1000); motore.ferma();
  ok(intro.chiusa === 1 && !intro.finita && ripristini === primi + 1 && richieste.size === 0, 'Stop durante l’intro la chiude');
  motore.ferma(); ok(intro.chiusa === 1, 'E la chiude una volta sola');
}
{
  eventi.length = 0;
  const intro = introFinta(3000);
  motore.avvia(testo, { ripristina: () => ripristini++, intro }); passo(500);
  motore.vaiAScena(1);
  ok(intro.chiusa === 1 && !motore.inIntro && motore.indice === 1, 'Un salto durante l’intro la chiude');
  motore.ferma();
}
{
  const intro = introFinta(0);
  eventi.length = 0;
  motore.avvia(testo, { ripristina: () => ripristini++, intro });
  ok(!motore.inIntro && eventi.some(e => e[0] === 'timelapse' && e[1] === 0) && !intro.passi.length,
    'Intro di durata zero: si parte dalla prima scena');
  motore.ferma();
}
{
  // Un guasto della prima scena, all'uscita dall'intro, chiude tutto.
  const intro = introFinta(1000);
  registro.timelapse.crea = () => ({ aggiorna() { throw new Error('guasto controllato'); } });
  motore.avvia(testo, { ripristina: () => ripristini++, intro }); passo(1000);
  ok(motore.stato === 'errore' && intro.chiusa === 1 && !intro.finita && richieste.size === 0,
    'Errore alla prima scena dopo l’intro: intro chiusa, demo ferma');
  registro.timelapse.crea = () => ({ aggiorna: u => eventi.push(['timelapse', u]) });
}
// Ogni scena dei tour predefiniti ha la sua narrazione, con un ID stabile che
// dice di quale demo e di quale scena è: il dizionario la trova da lì.
for (const d of predefiniti) {
  const demo = analizza(d.testo);
  demo.scene.forEach((s, i) => {
    const narra = s.azioni.filter(a => a.comando === 'narrate');
    ok(narra.length === 1 && narra[0].parametri.id === 'demo.narr.' + d.chiave + '.' + (i + 1),
      'Narrazione della scena ' + (i + 1) + ' di ' + d.chiave);
  });
}
console.log('Demo: ' + verifiche + ' verifiche superate');

// Archivio indipendente dal DOM: protezioni, persistenza e scritture atomiche.
const { crea, CHIAVE } = require('../demo-libreria.js');
const memoria = new Map();
const storage = { getItem: k => memoria.get(k) || null, setItem: (k, v) => memoria.set(k, v) };
const libreria = crea(storage, predefiniti, analizza);
rifiuta(() => libreria.salva(testo, 'eclisse_tour'), 'Built-in non sovrascrivibile');
rifiuta(() => libreria.elimina('eclisse_tour'), 'Built-in non eliminabile');
const chiave = libreria.salva(testo);
ok(libreria.elenco().length === predefiniti.length + 1, 'Duplicazione crea uno script utente');
const riaperta = crea(storage, predefiniti, analizza);
ok(riaperta.elenco().find(d => d.chiave === chiave).testo === testo, 'Persistenza dopo riapertura');
const cambiato = testo.replace('10s;', '11s;');
riaperta.salva(cambiato, chiave);
ok(libreria.elenco().find(d => d.chiave === chiave).testo === cambiato, 'Modifica persistente');
rifiuta(() => libreria.salva('non valido', chiave), 'Validazione prima della scrittura');
ok(libreria.elenco().find(d => d.chiave === chiave).testo === cambiato, 'Errore non distrugge la versione precedente');
const senzaSpazio = crea({ getItem: storage.getItem, setItem() { throw new Error('QuotaExceededError'); } }, [], analizza);
rifiuta(() => senzaSpazio.salva(testo), 'Quota esaurita segnalata');
ok(libreria.elenco().length === predefiniti.length + 1, 'Errore storage non crea script fantasma');
riaperta.elimina(chiave);
ok(libreria.elenco().length === predefiniti.length, 'Eliminazione persistente');
memoria.set(CHIAVE, '{corrotto');
rifiuta(() => libreria.salva(testo), 'Archivio corrotto non sovrascritto');
ok(memoria.get(CHIAVE) === '{corrotto', 'Archivio corrotto conservato');
console.log('Demo e libreria: ' + verifiche + ' verifiche superate');
