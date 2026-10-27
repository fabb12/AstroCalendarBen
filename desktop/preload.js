// =====================================================================
// AstroCalendario per computer — il ponte fra la pagina e il programma
// =====================================================================
//
// La pagina non vede Node né Electron (`contextIsolation`, `sandbox`): vede
// solo `window.astroDesktop`, con poche porte strette. Il resto dell'app non
// sa di girare in un programma: chi vuole saperlo guarda se `astroDesktop`
// c'è (`ui-nuova.js`, sezione «App per computer»; `custode-chiavi.js`).
//
// Il programma non tocca il `localStorage` dell'app dal processo principale:
// la cassaforte delle chiavi tiene una copia, e a decidere quando rimetterla
// è la pagina (`custode-chiavi.js`), che sa quali chiavi sono sue.

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astroDesktop', {
  desktop: true,
  piattaforma: process.platform,
  // { versione, versioneProgramma, electron, chromium, piattaforma,
  //   cartella, chiedi, porta, cassaforteCifrata }
  info: () => ipcRenderer.invoke('desktop:info'),
  apriCartella: () => ipcRenderer.invoke('desktop:apri-cartella'),
  scegliCartella: () => ipcRenderer.invoke('desktop:scegli-cartella'),
  impostaChiedi: si => ipcRenderer.invoke('desktop:imposta-chiedi', !!si),
  // { stato: 'nuova' | 'ultima' | 'errore', versione, url, errore }
  cercaAggiornamenti: () => ipcRenderer.invoke('desktop:cerca-aggiornamenti'),
  apriAggiornamento: url => ipcRenderer.invoke('desktop:apri-aggiornamento', String(url || '')),
  // La cassaforte delle chiavi. `tutte` è sincrona apposta: la pagina la
  // chiede prima che parta app.js, e nessun modulo deve vedere un
  // `localStorage` senza la chiave che il custode sta per rimettere.
  chiavi: {
    tutte: () => ipcRenderer.sendSync('chiavi:tutte'),
    scrivi: (nome, valore) => ipcRenderer.send('chiavi:scrivi', String(nome), valore == null ? null : String(valore))
  }
});
