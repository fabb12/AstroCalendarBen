// Una dichiarazione doppia di const o let a livello globale spegne
// l'intera pagina, e a occhio non si vede: i file sono grossi e nessuno
// li legge tutti. Questo controllo li mette in fila come fa index.html.
const fs = require('fs');
process.chdir(require('path').join(__dirname, '..'));

// L'elenco è quello di index.html, nello stesso ordine, più i cataloghi
// che catalogo.js si carica da sé. Va tenuto allineato: un file che manca
// da qui è un file di cui le collisioni non le controlla nessuno.
const file = ['app.js', 'telescopio.js', 'catalogo.js', 'costellazioni.js', 'via-lattea.js',
  'corpi-minori.js', 'pianifica.js', 'terreno.js', 'miglior-posto.js', 'rilievo.js',
  'meteo-astro.js', 'aurora-polare.js', 'config.js', 'aerei.js', 'eventi-extra.js',
  'ui-nuova.js', 'didattica.js', 'dati-stelle.js', 'dati-stelle-deboli.js',
  'dati-costellazioni.js', 'dati-profondo.js', 'dati-corpi-minori.js', 'dati-distanze.js'];

const visto = new Map();
const scontri = [];

file.forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  const re = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  const qui = new Set();
  while ((m = re.exec(src))) {
    // Solo quelle a inizio riga senza rientro: le altre stanno dentro a
    // un blocco e non toccano lo scope globale
    if (m.index !== src.lastIndexOf('\n', m.index) + 1) continue;
    qui.add(m[1]);
  }
  qui.forEach(n => {
    if (visto.has(n)) scontri.push(`${n.padEnd(28)} ${visto.get(n)}  e  ${f}`);
    else visto.set(n, f);
  });
});

console.log('nomi globali dichiarati in tutto:', visto.size);
if (scontri.length) {
  console.log(`\n${scontri.length} COLLISIONI:`);
  scontri.forEach(s => console.log('  ' + s));
  process.exit(1);
}
console.log('nessuna collisione fra i file');
