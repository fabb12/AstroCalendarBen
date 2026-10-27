// =====================================================================
// AstroCalendario per computer — prepara i file dell'app
// =====================================================================
//
// Copia il sito in `desktop/app-web/` (quello che l'installatore mette in
// `resources/app-web`), con le stesse esclusioni del deploy su Pages
// (`.github/workflows/pubblica.yml`) più gli strumenti che servono solo a
// chi sviluppa, e scrive in testa a `config.js` i valori che sul sito mette
// il deploy: il proxy ADS-B, il ponte Edge-TTS, l'ID client di YouTube e i
// dati della build. Si leggono dalle stesse variabili d'ambiente; vuote,
// l'app usa i suoi ripieghi, come una copia aperta in locale.
//
// Prepara anche l'icona per electron-builder (`risorse/icon.png`).
//
//   node desktop/prepara.js          → desktop/app-web/
//   node desktop/prepara.js --versione   stampa solo la versione (es. 1.528.0)

'use strict';

const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const DESTINAZIONE = path.join(__dirname, 'app-web');

// Nomi esclusi in qualunque cartella, e percorsi esclusi dalla radice.
const MAI = new Set(['.git', '.github', 'node_modules', '.DS_Store', 'Thumbs.db']);
const FUORI = new Set([
  'desktop', 'scripts', 'work', '_sito',
  'worker-adsb.js', 'wrangler.toml', 'start.sh', 'server.log', 'server.pid',
  'package.json', 'package-lock.json', '.gitignore',
  'CLAUDE.md', 'MAPPA-DETTAGLIATA.md', 'current-task.md', 'ADSB-PROXY.md', 'EDGE-TTS.md',
  'Idee_da_implementare.txt', 'test_ui.html', 'verifica.html'
]);

function versioneSito() {
  const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
  const m = /const CACHE_NAME = 'astrocal-v(\d+)/.exec(sw);
  if (!m) throw new Error('non trovo CACHE_NAME in sw.js');
  return parseInt(m[1], 10);
}

// electron-builder vuole un numero semver: la vN del sito diventa 1.N.0
const versionePacchetto = n => `1.${n}.0`;

function copia() {
  fs.rmSync(DESTINAZIONE, { recursive: true, force: true });
  fs.mkdirSync(DESTINAZIONE, { recursive: true });
  // Voce per voce dalla radice: `cpSync` della radice intera rifiuta di
  // copiare una cartella dentro sé stessa (`desktop/app-web` è lì sotto).
  for (const voce of fs.readdirSync(RADICE)) {
    if (MAI.has(voce) || FUORI.has(voce)) continue;
    fs.cpSync(path.join(RADICE, voce), path.join(DESTINAZIONE, voce), {
      recursive: true,
      filter: sorgente => !path.relative(RADICE, sorgente).split(path.sep).some(p => MAI.has(p))
    });
  }
}

function scriviConfig(n) {
  const file = path.join(DESTINAZIONE, 'config.js');
  const originale = fs.readFileSync(file, 'utf8');
  const env = process.env;
  const https = (nome) => {
    const v = String(env[nome] || '').trim();
    if (v && !/^https:\/\//.test(v)) throw new Error(`${nome} deve iniziare con https://`);
    return v;
  };
  const build = {
    version: 'v' + n,
    build: String(env.GITHUB_RUN_NUMBER || ''),
    commit: String(env.GITHUB_SHA || '').slice(0, 7),
    builtAt: new Date().toISOString()
  };
  // In testa: `config.js` assegna con `window.X = window.X || …`, quindi i
  // valori scritti qui vincono e il resto del file resta com'è.
  const testa = [
    '// Scritto da desktop/prepara.js per l\'app per computer.',
    `window.ADSB_PROXY_URL = ${JSON.stringify(https('ADSB_PROXY_URL'))};`,
    `window.EDGE_TTS_API_URL = ${JSON.stringify(https('EDGE_TTS_API_URL'))};`,
    `window.YOUTUBE_CLIENT_ID = ${JSON.stringify(String(env.YOUTUBE_CLIENT_ID || '').trim())};`,
    `window.ASTROCAL_BUILD = Object.freeze(${JSON.stringify(build)});`,
    ''
  ].join('\n');
  fs.writeFileSync(file, testa + originale);
  if (!env.ADSB_PROXY_URL) console.warn('Attenzione: manca ADSB_PROXY_URL, gli aerei useranno i ponti di riserva.');
}

function icona() {
  const cartella = path.join(__dirname, 'risorse');
  fs.mkdirSync(cartella, { recursive: true });
  fs.copyFileSync(path.join(RADICE, 'icon-512.png'), path.join(cartella, 'icon.png'));
}

if (require.main === module) {
  const n = versioneSito();
  if (process.argv.includes('--versione')) {
    process.stdout.write(versionePacchetto(n) + '\n');
  } else {
    copia();
    scriviConfig(n);
    icona();
    console.log(`App v${n} pronta in ${path.relative(RADICE, DESTINAZIONE)}/ (pacchetto ${versionePacchetto(n)})`);
  }
}

module.exports = { versioneSito, versionePacchetto, RADICE, DESTINAZIONE, FUORI };
