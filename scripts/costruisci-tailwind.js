#!/usr/bin/env node
// Genera `tailwind.css` — le sole utility che l'app usa davvero.
//
// Perché esiste, in una riga: `cdn.tailwindcss.com` è il **compilatore**,
// non il foglio di stile. È mezzo megabyte di JavaScript che a ogni
// caricamento legge tutto il DOM, ricava le classi che ci trova e scrive un
// `<style>`; poi resta in ascolto e rifà il lavoro a ogni mutazione. Nella
// console lo dice da sé — «cdn.tailwindcss.com should not be used in
// production» — e non è un capriccio: costa una richiesta a un CDN prima che
// si veda qualcosa, ricompila il CSS su ogni telefono a ogni apertura, e
// senza rete, la primissima volta, l'app resterebbe senza impaginazione.
//
// Le classi però non cambiano da sole: cambiano quando le cambiamo noi. Si
// compilano quindi **una volta**, qui, e il risultato si mette nel
// repository — esattamente come i `dati-*.js` di `costruisci-dati.js`. L'app
// resta senza build: si apre `index.html` e funziona.
//
//     npm install tailwindcss@3      (una volta sola)
//     node scripts/costruisci-tailwind.js
//
// Da rilanciare quando si aggiunge una classe Tailwind nuova a `index.html`
// o a uno degli script — se ci si dimentica, quella classe semplicemente non
// fa niente. È il modo peggiore di accorgersene, quindi in coda lo script
// scrive quante utility ha trovato: se il numero non si muove dopo aver
// aggiunto una classe, la classe non è stata vista.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RADICE = path.join(__dirname, '..');
const USCITA = path.join(RADICE, 'tailwind.css');

// Dove cercare le classi: la pagina e tutti gli script dell'app. I `dati-*.js`
// no — sono cataloghi di numeri, e scandirli costa secondi per niente.
const SORGENTI = [
  'index.html',
  ...fs.readdirSync(RADICE)
    .filter(f => f.endsWith('.js'))
    .filter(f => !f.startsWith('dati-') && !f.startsWith('_'))
    .filter(f => !['sw.js', 'worker-adsb.js', 'config.js'].includes(f))
].map(f => path.join(RADICE, f));

const config = path.join(__dirname, '.tailwind-config.js');
fs.writeFileSync(config,
  'module.exports = ' + JSON.stringify({
    content: SORGENTI,
    theme: { extend: {} },
    corePlugins: { preflight: true }
  }, null, 2) + ';\n');

const ingresso = path.join(__dirname, '.tailwind-in.css');
fs.writeFileSync(ingresso, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');

const cli = path.join(RADICE, 'node_modules', '.bin', 'tailwindcss');
if (!fs.existsSync(cli)) {
  console.error('Manca il compilatore. Prima: npm install tailwindcss@3');
  process.exit(1);
}

const grezzo = path.join(__dirname, '.tailwind-out.css');
execFileSync(cli, ['-c', config, '-i', ingresso, '-o', grezzo], { stdio: 'inherit' });

const TESTA = `/* ---------------------------------------------------------------------
 * tailwind.css — GENERATO, non si modifica a mano.
 *
 * Lo scrive \`scripts/costruisci-tailwind.js\` compilando le sole utility che
 * \`index.html\` e gli script usano davvero. Prende il posto di
 * \`cdn.tailwindcss.com\`, che quel lavoro lo rifaceva nel browser a ogni
 * apertura — e che nella console lo diceva a ogni apertura.
 *
 * Va caricato **prima** di \`style.css\`: la struttura la dà Tailwind, la
 * pelle la dà style.css, e per ridefinire un colore style.css deve venire
 * dopo (§10 di CLAUDE.md).
 *
 * Se una classe nuova non fa niente, il primo posto da guardare è questo
 * file: probabilmente non è stato rigenerato.
 * ------------------------------------------------------------------- */
`;

fs.writeFileSync(USCITA, TESTA + fs.readFileSync(grezzo, 'utf8'));
for (const t of [config, ingresso, grezzo]) fs.unlinkSync(t);

const css = fs.readFileSync(USCITA, 'utf8');
const regole = (css.match(/\{/g) || []).length;
console.log(`tailwind.css: ${Math.round(css.length / 1024)} KB, ${regole} regole, da ${SORGENTI.length} sorgenti.`);
