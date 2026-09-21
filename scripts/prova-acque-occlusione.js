'use strict';
// node scripts/prova-acque-occlusione.js
// Geometria sintetica: un dosso appena davanti al lago deve nasconderlo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'terreno.js'), 'utf8');
function funzione(nome) {
  const start = source.indexOf(`function ${nome}(`);
  assert.ok(start >= 0);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end + 2);
}
const codice = ['acqueVisibili', 'acqueDepressione', 'acqueTangenteVista',
  'acqueCorpoDiBanda'].map(funzione).join('\n');
function vista(dist, tan, vicino = 1000, lontano = 1100) {
  const context = vm.createContext({
    acque: { acceso: true, bande: [[[vicino, lontano, 0, 'Lago', 1]]] },
    terreno: { quando: 1 },
    terrenoDisponibile: () => true,
    acqueOcchio: () => 100,
    raggioAcque: () => 10,
    acqueQuoteDeiCorpi: () => new Map([[1, 0]]),
    acqueFrontiAcqua: () => ({ dist, tan }),
    ACQUE_DIREZIONI: 1, ACQUE_PASSO_AZ: 0.5,
    TERRENO_FRONTE_MARGINE: 0.85,
    TERRENO_RIFRAZIONE: 0.13, TERRENO_RAGGIO_KM: 6371,
    ACQUE_DEP_MAX_GRADI: 89, ACQUE_SOGLIA_SCARTO_M: 0.01,
    ACQUE_OCCLUSIONE_FINE_M: 10, ACQUE_TRATTO_MIN_M: 20
  });
  vm.runInContext(codice, context);
  return vm.runInContext('acqueVisibili()[0]', context);
}
// 950 m è davanti a tutta l'acqua (1000–1100 m), ma oltre 0.85 * 1100.
assert.equal(vista([950], [-0.01]), null, 'Il dosso a 950 m copre il lago');
assert.ok(vista([1200], [-0.01]), 'Un dosso dietro al lago non lo copre');
assert.ok(vista([950], [-0.2]), 'Terreno sotto la linea di vista lascia il lago visibile');
const divisa = vista([1050], [-0.01]);
assert.ok(divisa && divisa[0].lontano <= 1050,
  'Un promontorio dentro la banda lascia solo l’acqua davanti');
console.log('OK: dosso davanti, dosso dietro, terreno basso, occlusione parziale');
