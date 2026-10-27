// =====================================================================
// AstroCalendario per computer — costruisce l'installatore
// =====================================================================
//
// `npm run dist` (dentro `desktop/`): prepara i file dell'app e chiama
// electron-builder con la versione del sito (vN → 1.N.0), così il numero
// nell'installatore, nelle Impostazioni e nel nome della Release è lo
// stesso senza toccare `package.json` a mano.
//
// Senza argomenti costruisce per il sistema su cui gira (su Windows
// l'installatore NSIS `dist/AstroCalendario-Setup.exe`); `--win`, `--linux`,
// `--mac` lo scelgono. Per Windows serve Windows (o wine): il workflow
// `.github/workflows/desktop.yml` lo fa su `windows-latest`. `--cartella`
// costruisce solo il programma spacchettato (`dist/*-unpacked`), senza
// installatore: è la prova veloce che la configurazione porta tutto.

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const { versioneSito, versionePacchetto } = require('./prepara');

execFileSync(process.execPath, [path.join(__dirname, 'prepara.js')], { stdio: 'inherit' });

const builder = require('electron-builder');
const versione = versionePacchetto(versioneSito());
const piattaforme = [];
if (process.argv.includes('--win')) piattaforme.push(builder.Platform.WINDOWS);
if (process.argv.includes('--linux')) piattaforme.push(builder.Platform.LINUX);
if (process.argv.includes('--mac')) piattaforme.push(builder.Platform.MAC);

builder.build({
  targets: process.argv.includes('--cartella')
    ? builder.createTargets(piattaforme.length ? piattaforme : [builder.Platform.current()], 'dir')
    : piattaforme.length ? builder.createTargets(piattaforme) : undefined,
  projectDir: __dirname,
  // Mai pubblicare da qui: le Release le fa il workflow con `gh`.
  publish: 'never',
  config: { extraMetadata: { version: versione } }
}).then(file => {
  console.log(`Costruito ${versione}:\n  ` + file.join('\n  '));
}).catch(err => {
  console.error(err);
  process.exit(1);
});
