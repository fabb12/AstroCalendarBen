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
assert.match(codice, /0\.045 \* \(musicaGuadagno\(\) \/ 0\.35\)/,
  'anche il paesaggio generato deve usare la curva del volume');

const guadagno = percentuale => (percentuale / 100) ** 2;
assert.strictEqual(guadagno(0), 0);
assert.strictEqual(guadagno(12), 0.0144);
assert.strictEqual(guadagno(100), 1);
assert.ok(guadagno(20) - guadagno(10) < guadagno(90) - guadagno(80),
  'i primi scatti devono essere più fini di quelli alti');

console.log('✓ volume musicale graduale: 5 controlli passati');
