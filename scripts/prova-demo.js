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
