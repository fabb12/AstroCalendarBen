// =====================================================================
// AstroCalendario per computer — il programma (processo principale)
// =====================================================================
//
// L'app è la stessa del sito: gli stessi file, servita da un server locale
// (`server.js`) dentro una finestra di Electron. Il programma aggiunge solo
// quello che un browser non dà, o dà male:
//
//   1. la finestra che si ricorda dove stava e quanto era grande;
//   2. i file salvati dall'app (backup, filmati, .ics, cartoline, storie) in
//      una cartella vera, con la finestra di sistema «Salva con nome»;
//   3. i permessi (posizione, fotocamera, microfono, notifiche, cartelle)
//      concessi una volta per tutte, solo all'app e a nessun altro sito;
//   4. la **cassaforte delle chiavi**: la chiave di ElevenLabs, il token di
//      GitHub, il collegamento di YouTube e le voci scelte vivono anche fuori
//      dai dati del browser, cifrate dal sistema operativo. Nel browser si
//      perdevano a ogni pulizia dei dati del sito — chi «svuota la cache»
//      per vedere l'aggiornamento li cancella insieme — e andavano rimessi a
//      mano. Qui `custode-chiavi.js` li rimette da solo;
//   5. gli aggiornamenti: a ogni avvio (una volta al giorno) si chiede alle
//      Release di GitHub se c'è un installatore più nuovo.
//
// Tutto il resto — il cielo, il meteo, gli aerei, lo Studio — è il codice
// del sito, e non sa di girare qui dentro.

'use strict';

const { app, BrowserWindow, Menu, Notification, dialog, ipcMain, net, safeStorage, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const server = require('./server');
const { creaTraduttore } = require('./testi');

const PACCHETTO = require('./package.json');
const CONFIG = PACCHETTO.astrocalDesktop || {};
const REPOSITORIO = CONFIG.repository || 'fabb12/AstroCalendarBen';
const SITO = CONFIG.sito || 'https://fabb12.github.io/AstroCalendarBen/';
const ID_APP = (PACCHETTO.build && PACCHETTO.build.appId) || 'it.astroben.astrocalendario';

// Le sole chiavi di `localStorage` che la cassaforte accetta: le stesse di
// `CUSTODE_CHIAVI` in `custode-chiavi.js`. Una pagina che chiedesse di
// custodire altro non viene ascoltata.
const CHIAVI_CUSTODITE = new Set([
  'astrocal_elevenlabs_v1',
  'astrocal_storie_repo_v1',
  'astrocal_youtube_v1',
  'astrocal_voci_cast_v1'
]);
const CHIAVE_VALORE_MAX = 256 * 1024;

const PERMESSI_AMMESSI = new Set([
  'geolocation', 'media', 'notifications', 'fullscreen', 'fileSystem',
  'clipboard-read', 'clipboard-sanitized-write', 'pointerLock',
  'window-management', 'speaker-selection', 'storage-access',
  'top-level-storage-access', 'persistent-storage'
]);

// La posizione. Dentro Electron il servizio di Google che Chrome usa per
// `navigator.geolocation` non ha la chiave e risponde 403: su Windows si
// chiede invece al servizio di localizzazione del sistema (Impostazioni →
// Privacy → Posizione). Se è spento, l'app fa come nel browser e ripiega
// sulla posizione dall'indirizzo IP o su quella scritta a mano.
if (process.platform === 'win32') app.commandLine.appendSwitch('enable-features', 'WinrtGeolocationImplementation');

// Google rifiuta l'accesso dai browser «incorporati» riconoscendoli dal nome
// nell'user agent: via `Electron/…` e il nome del programma, e la finestra
// di accesso di YouTube si apre come in Chrome.
app.userAgentFallback = String(app.userAgentFallback || '')
  .replace(/\s(Electron|astrocalendario[\w-]*)\/\S+/gi, '');

// Per le prove (`scripts/prova-desktop.js`): una cartella dati e una porta
// tutte loro, per non toccare quelle del programma vero se è aperto.
if (process.env.ASTROCAL_DATI) app.setPath('userData', path.resolve(process.env.ASTROCAL_DATI));
const PORTA = parseInt(process.env.ASTROCAL_PORTA, 10) || server.PORTA_PREFERITA;

// La lingua del sistema si sa solo dopo `ready`: fino ad allora l'italiano.
let t = creaTraduttore('it');
let finestraPrincipale = null;
let origine = '';
let impostazioni = null;

// ---------------------------------------------------------------------
// 1. Impostazioni del programma (userData/impostazioni-desktop.json)
// ---------------------------------------------------------------------

function fileImpostazioni() { return path.join(app.getPath('userData'), 'impostazioni-desktop.json'); }

function leggiImpostazioni() {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(fileImpostazioni(), 'utf8')) || {}; } catch (_) { d = {}; }
  return {
    cartella: typeof d.cartella === 'string' && d.cartella ? d.cartella : path.join(app.getPath('documents'), 'AstroCalendario'),
    chiedi: d.chiedi !== false,
    finestra: d.finestra && typeof d.finestra === 'object' ? d.finestra : null,
    ultimoControllo: Number(d.ultimoControllo) || 0,
    versioneAvviata: typeof d.versioneAvviata === 'string' ? d.versioneAvviata : ''
  };
}

function salvaImpostazioni() {
  try {
    fs.mkdirSync(path.dirname(fileImpostazioni()), { recursive: true });
    fs.writeFileSync(fileImpostazioni(), JSON.stringify(impostazioni, null, 2));
  } catch (e) { console.error('impostazioni non salvate:', e); }
}

// ---------------------------------------------------------------------
// 2. Dove sta l'app e che versione è
// ---------------------------------------------------------------------

// Installato: i file del sito sono in `resources/app-web` (electron-builder,
// `extraResources`). In sviluppo: `desktop/app-web` se `npm run prepara` è
// stato lanciato, se no direttamente la radice del repository.
function radiceApp() {
  const candidati = app.isPackaged
    ? [path.join(process.resourcesPath, 'app-web')]
    : [path.join(__dirname, 'app-web'), path.join(__dirname, '..')];
  return candidati.find(c => fs.existsSync(path.join(c, 'index.html'))) || candidati[0];
}

// La versione dell'app è quella del sito (`vN`, dal nome della cache del
// service worker): è il numero che l'utente vede nelle Impostazioni, ed è
// quello che le Release portano nel nome (`desktop-vN`).
function versioneApp(radice) {
  try {
    const m = /astrocal-v(\d+)/.exec(fs.readFileSync(path.join(radice, 'sw.js'), 'utf8'));
    if (m) return 'v' + m[1];
  } catch (_) { /* sotto, quella del pacchetto */ }
  const m = /^\d+\.(\d+)\./.exec(app.getVersion());
  return m ? 'v' + m[1] : app.getVersion();
}

const numeroVersione = v => { const m = /v(\d+)/.exec(String(v || '')); return m ? parseInt(m[1], 10) : 0; };

// ---------------------------------------------------------------------
// 3. La cassaforte delle chiavi (userData/chiavi.json)
// ---------------------------------------------------------------------
//
// Ogni valore è cifrato con `safeStorage` (DPAPI su Windows, il portachiavi
// su macOS e Linux): il file, copiato su un altro computer o letto da un
// altro utente, non dice niente. Dove il sistema non sa cifrare il valore
// resta in chiaro, segnato `chiaro: true` — come nel `localStorage` del
// browser, che non è cifrato nemmeno lui.

function fileChiavi() { return path.join(app.getPath('userData'), 'chiavi.json'); }

function leggiCassaforte() {
  let grezzo = {};
  try { grezzo = JSON.parse(fs.readFileSync(fileChiavi(), 'utf8')) || {}; } catch (_) { grezzo = {}; }
  const fuori = {};
  for (const [nome, voce] of Object.entries(grezzo)) {
    if (!CHIAVI_CUSTODITE.has(nome) || !voce || typeof voce.dato !== 'string') continue;
    try {
      const buf = Buffer.from(voce.dato, 'base64');
      fuori[nome] = voce.chiaro ? buf.toString('utf8') : safeStorage.decryptString(buf);
    } catch (e) {
      console.warn('chiave non leggibile, la si lascia:', nome, e && e.message);
    }
  }
  return fuori;
}

function scriviCassaforte(nome, valore) {
  if (!CHIAVI_CUSTODITE.has(nome)) return;
  if (valore != null && (typeof valore !== 'string' || valore.length > CHIAVE_VALORE_MAX)) return;
  let grezzo = {};
  try { grezzo = JSON.parse(fs.readFileSync(fileChiavi(), 'utf8')) || {}; } catch (_) { grezzo = {}; }
  if (valore == null) {
    delete grezzo[nome];
  } else {
    const cifra = safeStorage.isEncryptionAvailable();
    grezzo[nome] = cifra
      ? { dato: safeStorage.encryptString(valore).toString('base64') }
      : { dato: Buffer.from(valore, 'utf8').toString('base64'), chiaro: true };
  }
  try {
    fs.mkdirSync(path.dirname(fileChiavi()), { recursive: true });
    const tmp = fileChiavi() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(grezzo), { mode: 0o600 });
    fs.renameSync(tmp, fileChiavi());
  } catch (e) { console.error('cassaforte non scritta:', e); }
}

// Solo la pagina dell'app parla con la cassaforte: non una finestra di
// Google aperta per l'accesso, non un sito esterno.
const daNoi = evento => {
  try { return new URL(evento.senderFrame.url).origin === new URL(origine).origin; } catch (_) { return false; }
};

// ---------------------------------------------------------------------
// 4. I file salvati dall'app
// ---------------------------------------------------------------------

function nomeLibero(cartella, nome) {
  const est = path.extname(nome), base = path.basename(nome, est);
  let candidato = path.join(cartella, nome);
  for (let i = 2; fs.existsSync(candidato) && i < 1000; i++) candidato = path.join(cartella, `${base} (${i})${est}`);
  return candidato;
}

function preparaScaricamenti(ses) {
  ses.on('will-download', (_evento, elemento) => {
    const nome = elemento.getFilename() || 'astrocalendario';
    try { fs.mkdirSync(impostazioni.cartella, { recursive: true }); } catch (_) { /* la finestra di sistema sceglierà altrove */ }
    if (impostazioni.chiedi) {
      elemento.setSaveDialogOptions({ title: t('cartella.titolo'), defaultPath: path.join(impostazioni.cartella, nome) });
    } else {
      elemento.setSavePath(nomeLibero(impostazioni.cartella, nome));
    }
    elemento.once('done', (_e, stato) => {
      if (stato !== 'completed') return;
      const dove = elemento.getSavePath();
      if (!impostazioni.chiedi && Notification.isSupported()) {
        const n = new Notification({ title: t('salvato.titolo'), body: t('salvato.testo', { nome: path.basename(dove) }) });
        n.on('click', () => shell.showItemInFolder(dove));
        n.show();
      }
    });
  });
}

// ---------------------------------------------------------------------
// 5. Permessi e finestre nuove
// ---------------------------------------------------------------------

const stessaOrigine = url => { try { return new URL(url).origin === new URL(origine).origin; } catch (_) { return false; } };
const accessoGoogle = url => /^https:\/\/accounts\.google\.com\//i.test(String(url || ''));
const esterno = url => /^(https?:|mailto:)/i.test(String(url || ''));

function preparaPermessi(ses) {
  ses.setPermissionRequestHandler((wc, permesso, rispondi, dettagli) => {
    const da = (dettagli && (dettagli.requestingUrl || dettagli.securityOrigin)) || (wc && wc.getURL()) || '';
    rispondi(stessaOrigine(da) && PERMESSI_AMMESSI.has(permesso));
  });
  ses.setPermissionCheckHandler((_wc, permesso, da) => stessaOrigine(da) && PERMESSI_AMMESSI.has(permesso));
}

function opzioniPagina() {
  return {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    spellcheck: false,
    preload: path.join(__dirname, 'preload.js')
  };
}

// Ogni webContents — la finestra, la guida aperta in un'altra, il riquadro
// di Google — passa di qui. La regola è una: dentro l'app si resta nel
// programma, fuori si va nel browser di sistema. Unica eccezione l'accesso
// a Google, che deve restare figlio della pagina per restituirle il token.
app.on('web-contents-created', (_e, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    if (stessaOrigine(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#0b1020', webPreferences: opzioniPagina() } };
    }
    if (accessoGoogle(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520, height: 700, autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
        }
      };
    }
    if (esterno(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (evento, url) => {
    if (stessaOrigine(url)) return;
    // Il riquadro di accesso naviga fra le pagine di Google: lo si lascia.
    if (!stessaOrigine(wc.getURL()) && wc.getURL()) return;
    evento.preventDefault();
    if (esterno(url)) shell.openExternal(url);
  });
});

// ---------------------------------------------------------------------
// 6. Aggiornamenti (Release di GitHub, tag `desktop-vN`)
// ---------------------------------------------------------------------

async function cercaAggiornamenti() {
  const attuale = versioneApp(radiceApp());
  try {
    const risposta = await net.fetch(`https://api.github.com/repos/${REPOSITORIO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AstroCalendario-desktop' }
    });
    if (!risposta.ok) throw new Error('HTTP ' + risposta.status);
    const r = await risposta.json();
    const nuova = 'v' + numeroVersione(r.tag_name);
    if (numeroVersione(nuova) <= numeroVersione(attuale)) return { stato: 'ultima', versione: attuale };
    const estensione = process.platform === 'win32' ? '.exe' : process.platform === 'darwin' ? '.dmg' : '.AppImage';
    const pacco = (r.assets || []).find(a => String(a.name || '').endsWith(estensione));
    return { stato: 'nuova', versione: nuova, attuale, url: (pacco && pacco.browser_download_url) || r.html_url };
  } catch (e) {
    return { stato: 'errore', versione: attuale, errore: String(e && e.message || e) };
  }
}

const urlAggiornamentoValido = url => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com' && u.pathname.toLowerCase().startsWith('/' + REPOSITORIO.toLowerCase() + '/');
  } catch (_) { return false; }
};

async function proponiAggiornamento(esito, silenzioso) {
  if (!finestraPrincipale) return;
  if (esito.stato === 'nuova') {
    const { response } = await dialog.showMessageBox(finestraPrincipale, {
      type: 'info',
      buttons: [t('aggiornamento.scarica'), t('aggiornamento.dopo')],
      defaultId: 0, cancelId: 1,
      title: t('aggiornamento.titolo'),
      message: t('aggiornamento.testo', { nuova: esito.versione, attuale: esito.attuale }),
      detail: t('aggiornamento.dettaglio')
    });
    if (response === 0 && urlAggiornamentoValido(esito.url)) shell.openExternal(esito.url);
  } else if (!silenzioso) {
    await dialog.showMessageBox(finestraPrincipale, {
      type: esito.stato === 'errore' ? 'warning' : 'info',
      buttons: [t('ok')],
      message: esito.stato === 'errore'
        ? t('aggiornamento.errore', { errore: esito.errore })
        : t('aggiornamento.nessuno', { attuale: esito.versione })
    });
  }
}

function controlloAutomatico() {
  if (!app.isPackaged) return;
  if (Date.now() - impostazioni.ultimoControllo < 20 * 60 * 60 * 1000) return;
  setTimeout(async () => {
    const esito = await cercaAggiornamenti();
    if (esito.stato !== 'errore') { impostazioni.ultimoControllo = Date.now(); salvaImpostazioni(); }
    proponiAggiornamento(esito, true);
  }, 15000);
}

// ---------------------------------------------------------------------
// 7. Le porte per la pagina (preload.js)
// ---------------------------------------------------------------------

function infoDesktop() {
  return {
    versione: versioneApp(radiceApp()),
    versioneProgramma: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    piattaforma: process.platform,
    cartella: impostazioni.cartella,
    chiedi: impostazioni.chiedi,
    porta: (() => { try { return new URL(origine).port; } catch (_) { return ''; } })(),
    cassaforteCifrata: safeStorage.isEncryptionAvailable()
  };
}

function preparaPorte() {
  const solo = fn => async (evento, ...arg) => (daNoi(evento) ? fn(...arg) : null);
  ipcMain.handle('desktop:info', solo(() => infoDesktop()));
  ipcMain.handle('desktop:apri-cartella', solo(async () => {
    fs.mkdirSync(impostazioni.cartella, { recursive: true });
    return (await shell.openPath(impostazioni.cartella)) === '';
  }));
  ipcMain.handle('desktop:scegli-cartella', solo(async () => {
    const r = await dialog.showOpenDialog(finestraPrincipale, {
      title: t('cartella.titolo'), defaultPath: impostazioni.cartella, properties: ['openDirectory', 'createDirectory']
    });
    if (!r.canceled && r.filePaths && r.filePaths[0]) { impostazioni.cartella = r.filePaths[0]; salvaImpostazioni(); }
    return infoDesktop();
  }));
  ipcMain.handle('desktop:imposta-chiedi', solo(si => { impostazioni.chiedi = !!si; salvaImpostazioni(); return infoDesktop(); }));
  ipcMain.handle('desktop:cerca-aggiornamenti', solo(() => cercaAggiornamenti()));
  ipcMain.handle('desktop:apri-aggiornamento', solo(url => {
    if (!urlAggiornamentoValido(url)) return false;
    shell.openExternal(url);
    return true;
  }));
  ipcMain.on('chiavi:tutte', evento => { evento.returnValue = daNoi(evento) ? leggiCassaforte() : {}; });
  ipcMain.on('chiavi:scrivi', (evento, nome, valore) => { if (daNoi(evento)) scriviCassaforte(nome, valore); });
}

// ---------------------------------------------------------------------
// 8. Menu
// ---------------------------------------------------------------------

function preparaMenu() {
  const mac = process.platform === 'darwin';
  const modello = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.apriCartella'), click: () => { fs.mkdirSync(impostazioni.cartella, { recursive: true }); shell.openPath(impostazioni.cartella); } },
        { label: t('menu.cercaAggiornamenti'), click: async () => proponiAggiornamento(await cercaAggiornamenti(), false) },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit', label: t('menu.esci') }
      ]
    },
    { role: 'editMenu', label: t('menu.modifica') },
    {
      label: t('menu.vista'),
      submenu: [
        { role: 'reload', label: t('menu.ricarica') },
        { role: 'toggleDevTools', label: t('menu.strumenti') },
        { type: 'separator' },
        { role: 'resetZoom', label: t('menu.zoomNormale') },
        { role: 'zoomIn', label: t('menu.zoomPiu') },
        { role: 'zoomOut', label: t('menu.zoomMeno') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('menu.schermoIntero') }
      ]
    },
    { role: 'windowMenu', label: t('menu.finestra') },
    {
      label: t('menu.aiuto'),
      submenu: [
        { label: t('menu.guida'), click: () => apriFinestraApp(t.lingua === 'en' ? 'guida-en.html' : 'guida.html') },
        { label: t('menu.sito'), click: () => shell.openExternal(SITO) },
        { type: 'separator' },
        {
          label: t('menu.informazioni'),
          click: () => {
            const i = infoDesktop();
            dialog.showMessageBox(finestraPrincipale, {
              type: 'info', buttons: [t('ok')],
              message: t('informazioni.testo', { versione: i.versione }),
              detail: t('informazioni.dettaglio', { electron: i.electron, chromium: i.chromium, cartella: i.cartella })
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modello));
}

function apriFinestraApp(pagina) {
  const w = new BrowserWindow({ width: 1000, height: 800, autoHideMenuBar: true, backgroundColor: '#0b1020', webPreferences: opzioniPagina() });
  w.loadURL(origine + '/' + pagina);
}

// ---------------------------------------------------------------------
// 9. La finestra
// ---------------------------------------------------------------------

function creaFinestra() {
  const f = impostazioni.finestra || {};
  const w = new BrowserWindow({
    width: Number(f.width) || 1400,
    height: Number(f.height) || 900,
    x: Number.isFinite(f.x) ? f.x : undefined,
    y: Number.isFinite(f.y) ? f.y : undefined,
    minWidth: 360,
    minHeight: 480,
    show: false,
    backgroundColor: '#0b1020',
    title: 'AstroCalendario di Ben',
    icon: path.join(radiceApp(), 'icon-512.png'),
    webPreferences: opzioniPagina()
  });
  if (f.massimizzata) w.maximize();
  w.once('ready-to-show', () => w.show());
  const ricorda = () => {
    if (w.isDestroyed() || w.isMinimized() || w.isFullScreen()) return;
    const massimizzata = w.isMaximized();
    impostazioni.finestra = Object.assign({}, massimizzata ? impostazioni.finestra : w.getBounds(), { massimizzata });
  };
  w.on('resize', ricorda);
  w.on('move', ricorda);
  w.on('close', () => { ricorda(); salvaImpostazioni(); });
  w.on('closed', () => { if (finestraPrincipale === w) finestraPrincipale = null; });
  w.loadURL(origine + '/index.html');
  return w;
}

// ---------------------------------------------------------------------
// 10. Avvio
// ---------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  // Un'altra copia è già aperta: è lei che si mostra (`second-instance`).
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!finestraPrincipale) return;
    if (finestraPrincipale.isMinimized()) finestraPrincipale.restore();
    finestraPrincipale.focus();
  });

  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId(ID_APP);
    t = creaTraduttore(app.getPreferredSystemLanguages && app.getPreferredSystemLanguages()[0] || app.getLocale());
    impostazioni = leggiImpostazioni();
    const radice = radiceApp();
    let avviato;
    try {
      avviato = await server.avvia(radice, { porta: PORTA });
    } catch (e) {
      dialog.showErrorBox(t('avvio.errore'), String(e && e.message || e));
      app.quit();
      return;
    }
    origine = avviato.origine;
    app.on('before-quit', () => { try { avviato.server.close(); } catch (_) { /* già chiuso */ } });

    const ses = session.defaultSession;
    // Programma aggiornato: il service worker della versione di prima
    // servirebbe la sua copia dell'app finché non si accorge del nuovo
    // `sw.js`, e chiederebbe di «aggiornare» un'app appena aggiornata. Lo si
    // toglie, e con lui niente altro: `localStorage`, IndexedDB e la cache
    // dei modelli di Piper restano dove sono.
    const versione = versioneApp(radice);
    if (impostazioni.versioneAvviata && impostazioni.versioneAvviata !== versione) {
      try { await ses.clearStorageData({ storages: ['serviceworkers'] }); } catch (e) { console.warn('service worker non tolto:', e); }
    }
    impostazioni.versioneAvviata = versione;
    salvaImpostazioni();

    preparaPermessi(ses);
    preparaScaricamenti(ses);
    preparaPorte();
    preparaMenu();
    finestraPrincipale = creaFinestra();

    if (avviato.cambiata) {
      finestraPrincipale.once('ready-to-show', () => dialog.showMessageBox(finestraPrincipale, {
        type: 'warning', buttons: [t('ok')], title: t('porta.titolo'),
        message: t('porta.testo', { preferita: PORTA, porta: avviato.porta }),
        detail: t('porta.dettaglio')
      }));
    }
    controlloAutomatico();
  });

  app.on('window-all-closed', () => app.quit());
}
