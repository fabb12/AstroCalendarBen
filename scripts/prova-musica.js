#!/usr/bin/env node
'use strict';

// Prova statica della curva del volume: protegge la zona silenziosa del
// cursore senza dover creare un AudioContext, non disponibile in Node.
const fs = require('fs');
const assert = require('assert');
const codice = fs.readFileSync('app.js', 'utf8');

assert.match(codice, /function musicaGuadagno\(\)\s*{\s*return musicaVolume \* musicaVolume;\s*}/,
  'il volume deve seguire una curva quadratica');
assert.match(codice, /audio\.volume = musicaGuadagno\(\);/,
  'le tracce locali devono usare la curva del volume');
// Il paesaggio sonoro generato è stato tolto: niente Web Audio, niente voce
// nel selettore, niente chiave nei dizionari.
assert.doesNotMatch(codice, /tipo: 'generata'|AudioContext\(\);\s*const volume/,
  'il paesaggio generato non deve più esistere');
for (const f of ['lingue/it.js', 'lingue/en.js'])
  assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /ui\.musica-generata/, f + ': chiave del paesaggio generato rimasta');
// La colonna sonora delle demo usa la stessa curva: 30% del cursore.
assert.match(codice, /audio\.volume = Math\.max\(0, Math\.min\(1, volumeCursore\)\) \*\* 2;/,
  'la musica delle demo segue la curva del cursore');

const guadagno = percentuale => (percentuale / 100) ** 2;
assert.strictEqual(guadagno(0), 0);
assert.strictEqual(guadagno(12), 0.0144);
assert.strictEqual(guadagno(100), 1);
assert.ok(guadagno(20) - guadagno(10) < guadagno(90) - guadagno(80),
  'i primi scatti devono essere più fini di quelli alti');

console.log('✓ volume musicale graduale: 8 controlli passati');
