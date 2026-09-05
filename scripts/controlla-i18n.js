#!/usr/bin/env node
/* L'audit delle stringhe italiane cablate nell'interfaccia.
 *
 * Perché serve uno strumento invece di una `grep`: in questo progetto
 * l'italiano è **anche** la lingua dei commenti, dei nomi delle funzioni e
 * delle chiavi di `localStorage`, e sono tutti e tre legittimi. Quello che non
 * è legittimo è una frase italiana che finisce **sullo schermo**, e per
 * distinguerla da tutte le altre bisogna guardare dove sta: dentro a un
 * `innerHTML`, a un `textContent`, a un `title`, a un `<li>` di un template, a
 * un `alert`. Una `grep` sull'italiano risponde ventimila volte e non serve a
 * niente; questa risponde solo dove c'è del lavoro da fare.
 *
 *   node scripts/controlla-i18n.js            # il rapporto
 *   node scripts/controlla-i18n.js --lista    # ogni riga, per lavorarci
 *   node scripts/controlla-i18n.js --file app.js
 *   node scripts/controlla-i18n.js --patto    # esce 1 se si è peggiorato
 *
 * L'ultima forma è quella che serve in CI: il numero di stringhe cablate
 * **non deve crescere**. Il tetto sta in `scripts/i18n-tetto.json`, e chi lo
 * abbassa lavorando fa bene ad aggiornarlo.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// I file che disegnano l'interfaccia. `dati-*.js` no: sono cataloghi di
// stelle, e i nomi propri delle costellazioni non si traducono a mano.
const FILE_UI = [
  'app.js', 'ui-nuova.js', 'telescopio.js', 'didattica.js', 'aerei.js',
  'transiti.js', 'pianifica.js', 'meteo-astro.js', 'terreno.js', 'rilievo.js',
  'catalogo.js', 'costellazioni.js', 'corpi-minori.js', 'aurora-polare.js',
  'eventi-extra.js', 'miglior-posto.js', 'via-lattea.js'
];

// Le parole che dicono «questa è una frase italiana e non un identificatore».
// Sono funzionali di proposito (articoli, preposizioni, ausiliari): un nome di
// variabile italiano non le contiene quasi mai, una frase sì sempre.
const SPIA = /(?:^|[\s>(«"'])(?:il|lo|la|le|gli|un|una|uno|del|della|dello|dei|degli|delle|dal|dalla|nel|nella|nei|sul|sulla|con|per|non|che|come|dove|quando|perché|perche|più|piu|meno|molto|tutto|tutti|tutte|questa|questo|queste|questi|quello|quella|sono|essere|hai|abbiamo|c'è|c'e|ci|si|se|ma|però|pero|anche|ancora|già|gia|solo|senza|sopra|sotto|prima|dopo|verso|fino|tra|fra|oppure|invece|mentre|quindi|allora)(?=$|[\s.,;:!?»"')<])/i;

// Gli accenti e i digrammi che l'inglese non usa: bastano da soli.
const ACCENTO = /[àèéìòùÀÈÉÌÒÙ]|\b(?:gli|gn[aeiou]|sci[aeou])/;

// Dove una stringa finisce sullo schermo. Sono i contesti, non le stringhe:
// è la differenza fra questo strumento e una grep.
const CONTESTI = [
  { nome: 'innerHTML', re: /\.innerHTML\s*(?:\+)?=/ },
  { nome: 'textContent', re: /\.textContent\s*(?:\+)?=/ },
  { nome: 'insertAdjacentHTML', re: /insertAdjacentHTML/ },
  { nome: 'attributo', re: /setAttribute\(\s*['"](?:title|placeholder|aria-label|alt|value)['"]/ },
  { nome: 'title/alt', re: /\.(?:title|placeholder|alt|ariaLabel)\s*=/ },
  { nome: 'avviso', re: /\b(?:alert|confirm|prompt|skyAvviso|avvisa|mostraAvviso)\s*\(/ },
  { nome: 'html', re: /<(?:li|p|div|span|button|h[1-6]|td|th|strong|em|small|label|option|summary)\b/ },
  { nome: 'ritorno-testo', re: /\breturn\s+[`'"]/ }
];

// Le funzioni che *sono* interfaccia per contratto: qualunque stringa dentro
// di loro esce sullo schermo, anche senza un innerHTML nella stessa riga.
//
// L'elenco è cresciuto misurando: la prima versione guardava solo i nomi che
// finiscono in `Html`, `Scheda`, `Testo` e compagnia, e si perdeva
// `aggiornaStaseraMeteoAstro` (che scrive «Sto scaricando le previsioni…») e
// `pianMotivi` (che scrive «sale fino a 58°») — cioè due frasi che stanno in
// mezzo alla prima schermata. Un audit che non le conta dice di aver finito
// quando non è vero, ed è il modo in cui una traduzione resta a metà.
const FUNZIONI_UI = new RegExp('function\\s+\\w*(?:' + [
  // chi compone del testo
  'Scheda', 'Html', 'Testo', 'Etichetta', 'Titolo', 'Nota', 'Avviso', 'Messaggio',
  'Riga', 'Righe', 'Voce', 'Voci', 'Consiglio', 'Racconto', 'Verdetto',
  'Descrizione', 'Spiegazione', 'Tooltip', 'Fumetto', 'Legenda', 'Stato',
  'Pannello', 'Motivi', 'Nome', 'Nomi', 'Frase', 'Riassunto', 'Sommario',
  // chi lo mette sullo schermo
  'aggiorna', 'costruisci', 'mostra', 'scrivi', 'disegnaNomi', 'apri', 'popola',
  'rinfresca', 'componi'
].join('|') + ')\\w*\\s*\\(', 'i');

const IGNORA = [
  /^\s*\/\//, /^\s*\*/, /^\s*\/\*/,            // commenti
  /console\.(?:log|warn|error|info|debug)/,     // diagnostica, non interfaccia
  /localStorage|sessionStorage/,                 // chiavi di salvataggio
  /astrocal_|astrocalendario_/,                  // idem
  /^\s*(?:import|export|require)\b/,
  /data-i18n/, /astroI18n|i18n\.t\(/            // già tradotto
];

function stringheDi(riga) {
  // I letterali: apici, doppi apici e template. Dentro a un template si
  // guarda il testo fra i `${…}`, che è quello che si legge sullo schermo.
  const trovate = [];
  const re = /`((?:[^`\\]|\\.)*)`|'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(riga))) {
    const grezza = m[1] ?? m[2] ?? m[3] ?? '';
    for (const pezzo of grezza.split(/\$\{[^}]*\}/)) {
      const testo = pezzo.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim();
      if (testo) trovate.push(testo);
    }
  }
  return trovate;
}

function italiana(testo) {
  if (testo.length < 4) return false;                    // sigle, unità
  if (!/[a-zà-ù]{3}/i.test(testo)) return false;          // numeri, simboli
  if (/^[\w.\-/#:]+$/.test(testo)) return false;          // id, classi, url
  if (/^https?:|^\.\/|\.(?:js|css|json|png|svg|html)$/i.test(testo)) return false;
  return SPIA.test(testo) || ACCENTO.test(testo);
}

function analizza(file) {
  const righe = fs.readFileSync(file, 'utf8').split('\n');
  const esiti = [];
  let funzioneUi = false;
  let graffe = 0;

  righe.forEach((riga, i) => {
    if (FUNZIONI_UI.test(riga)) { funzioneUi = true; graffe = 0; }
    if (funzioneUi) {
      graffe += (riga.match(/\{/g) || []).length - (riga.match(/\}/g) || []).length;
      if (graffe <= 0 && i > 0 && /\}/.test(riga)) funzioneUi = false;
    }
    if (IGNORA.some(re => re.test(riga))) return;
    const contesto = CONTESTI.find(c => c.re.test(riga));
    if (!contesto && !funzioneUi) return;
    for (const testo of stringheDi(riga)) {
      if (!italiana(testo)) continue;
      esiti.push({ file, riga: i + 1, contesto: contesto ? contesto.nome : 'funzione-ui', testo });
    }
  });
  return esiti;
}

/* L'HTML si legge **a tag**, con lo stack degli elementi aperti.
 *
 * Due tentativi buttati, e vale la pena scriverli perché sono lo stesso
 * errore da due lati. Il primo tagliava riga per riga su `<[^>]*>`: su un
 * `<button>` scritto su tre righe (qui è la norma) i suoi attributi
 * risultavano «testo fra i tag», e ogni `title="…"` si contava due volte. Il
 * secondo, tag per tag, sapeva riconoscere gli attributi ma non sapeva **di
 * chi** fosse un testo: contava come cablate anche le frasi il cui elemento
 * aveva già la sua `data-i18n`, cioè il lavoro appena fatto.
 *
 * Un testo appartiene all'elemento che lo contiene, e per saperlo bisogna
 * tenere il conto di quelli aperti. Lo stack costa dieci righe ed è la
 * differenza fra un numero e un numero di cui fidarsi.
 */
const HTML_VUOTI = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'use',
  'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'area', 'base',
  'col', 'embed', 'param', 'track', 'wbr', 'stop']);
const HTML_SALTA = new Set(['script', 'style', 'title', 'svg', 'path', 'circle', 'rect',
  'line', 'polygon', 'polyline', 'ellipse', 'g', 'defs', 'use', 'stop', 'linearGradient',
  'radialGradient', 'filter', 'feGaussianBlur', 'text', 'tspan', 'canvas', 'code', 'cite']);

function analizzaHtml(file) {
  const sorgente = fs.readFileSync(file, 'utf8');
  const esiti = [];
  const spegni = (m) => m.replace(/[^\n]/g, ' ');   // via il contenuto, restano le righe
  const testo = sorgente
    .replace(/<script[\s\S]*?<\/script>/gi, spegni)
    .replace(/<style[\s\S]*?<\/style>/gi, spegni)
    .replace(/<!--[\s\S]*?-->/g, spegni);

  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g;
  const stack = [];
  let posizione = 0, riga = 1, dentroSvg = 0, m;
  const avanza = (fino) => {
    for (let i = posizione; i < fino; i++) if (testo[i] === '\n') riga++;
    posizione = fino;
  };

  while ((m = re.exec(testo))) {
    const grezzo = testo.slice(posizione, m.index);
    const rigaTesto = riga;
    avanza(m.index);
    // Il testo appartiene all'elemento in cima allo stack.
    const genitore = stack[stack.length - 1];
    if (grezzo.trim() && !dentroSvg && genitore &&
        !HTML_SALTA.has(genitore.nome) && !/data-i18n/.test(genitore.attributi)) {
      for (const pezzo of grezzo.split('\n')) {
        const t = pezzo.replace(/&[a-z]+;|&#\d+;/gi, ' ').trim();
        if (t && italiana(t)) esiti.push({ file, riga: rigaTesto, contesto: 'testo-html', testo: t });
      }
    }
    const chiusura = m[1], nome = m[2].toLowerCase(), attributi = m[3] || '', auto = !!m[4];
    const rigaTag = riga;
    avanza(m.index + m[0].length);
    if (chiusura) {
      if (nome === 'svg' && dentroSvg) dentroSvg--;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].nome === nome) { stack.length = i; break; }
      }
      continue;
    }
    if (nome === 'svg') dentroSvg++;
    if (!auto && !HTML_VUOTI.has(nome)) stack.push({ nome, attributi });
    if (/data-i18n/.test(attributi)) continue;
    for (const a of attributi.matchAll(/\b(title|placeholder|aria-label|alt)\s*=\s*"([^"]*)"/g)) {
      const t = a[2].trim();
      if (t && italiana(t)) esiti.push({ file, riga: rigaTag, contesto: 'attributo-html', testo: t });
    }
  }
  return esiti;
}

const argomenti = process.argv.slice(2);
const soloFile = argomenti.includes('--file') ? argomenti[argomenti.indexOf('--file') + 1] : null;
const lista = argomenti.includes('--lista');
const patto = argomenti.includes('--patto');

const radice = path.resolve(__dirname, '..');
process.chdir(radice);

let tutti = [];
const bersagli = soloFile ? [soloFile] : [...FILE_UI, 'index.html'];
for (const file of bersagli) {
  if (!fs.existsSync(file)) continue;
  tutti = tutti.concat(file.endsWith('.html') ? analizzaHtml(file) : analizza(file));
}

const perFile = new Map();
for (const e of tutti) perFile.set(e.file, (perFile.get(e.file) || 0) + 1);

if (lista) {
  for (const e of tutti) console.log(`${e.file}:${e.riga}  [${e.contesto}]  ${e.testo.slice(0, 110)}`);
  console.log('');
}

console.log('Stringhe italiane cablate nell\'interfaccia');
console.log('==========================================');
for (const [file, n] of [...perFile].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${file}`);
}
console.log(`  ${String(tutti.length).padStart(5)}  TOTALE`);

if (patto) {
  const dove = 'scripts/i18n-tetto.json';
  const tetto = fs.existsSync(dove) ? JSON.parse(fs.readFileSync(dove, 'utf8')) : { totale: Infinity };
  if (tutti.length > tetto.totale) {
    console.error(`\n✗ Peggiorato: ${tutti.length} cablate, il tetto è ${tetto.totale}.`);
    console.error('  Usa le chiavi del gestore (astroI18n.t) per il testo nuovo.');
    process.exit(1);
  }
  console.log(`\n✓ Dentro al tetto (${tutti.length} ≤ ${tetto.totale}).`);
}
