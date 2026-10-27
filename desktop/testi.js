// =====================================================================
// AstroCalendario per computer — le frasi del programma
// =====================================================================
//
// Il menu e le finestre di dialogo del processo principale non vedono
// `astroI18n` (vive nella pagina): hanno un loro piccolo dizionario, nelle
// stesse due lingue dell'app. La lingua è quella del sistema operativo
// (`app.getLocale()`): l'italiano per chi ha il computer in italiano,
// l'inglese per tutti gli altri — la stessa regola del primo avvio dell'app.

'use strict';

const DIZIONARI = {
  it: {
    'menu.file': 'File',
    'menu.apriCartella': 'Apri la cartella dei salvataggi',
    'menu.cercaAggiornamenti': 'Cerca aggiornamenti…',
    'menu.esci': 'Esci',
    'menu.modifica': 'Modifica',
    'menu.vista': 'Vista',
    'menu.ricarica': 'Ricarica',
    'menu.strumenti': 'Strumenti per sviluppatori',
    'menu.zoomNormale': 'Dimensione normale',
    'menu.zoomPiu': 'Ingrandisci',
    'menu.zoomMeno': 'Rimpicciolisci',
    'menu.schermoIntero': 'Schermo intero',
    'menu.finestra': 'Finestra',
    'menu.aiuto': 'Aiuto',
    'menu.guida': 'Guida all\'uso',
    'menu.sito': 'Apri la versione web',
    'menu.informazioni': 'Informazioni su AstroCalendario',
    'aggiornamento.titolo': 'Aggiornamento disponibile',
    'aggiornamento.testo': 'È uscita la versione {nuova} dell\'app per computer (questa è la {attuale}).',
    'aggiornamento.dettaglio': 'Scarica il nuovo installatore e aprilo: aggiorna il programma lasciando al loro posto diario, eventi e impostazioni.',
    'aggiornamento.scarica': 'Scarica',
    'aggiornamento.dopo': 'Più tardi',
    'aggiornamento.nessuno': 'Hai già l\'ultima versione ({attuale}).',
    'aggiornamento.errore': 'Non sono riuscito a controllare gli aggiornamenti: {errore}',
    'informazioni.testo': 'AstroCalendario di Ben {versione}',
    'informazioni.dettaglio': 'App per computer · Electron {electron} · Chromium {chromium}\nCartella dei salvataggi: {cartella}\nSoftware libero, GNU GPL v3 o successiva.',
    'porta.titolo': 'Porta cambiata',
    'porta.testo': 'La porta {preferita} è occupata da un altro programma: l\'app si è aperta sulla {porta}.',
    'porta.dettaglio': 'Diario, eventi e impostazioni sono legati alla porta: finché l\'altro programma la tiene, qui li vedrai vuoti. Chiudi l\'altro programma e riapri l\'app per ritrovarli.',
    'salvato.titolo': 'File salvato',
    'salvato.testo': '{nome} — clic per aprire la cartella',
    'cartella.titolo': 'Dove salvare i file dell\'app',
    'avvio.errore': 'L\'app non è riuscita a partire',
    'ok': 'OK'
  },
  en: {
    'menu.file': 'File',
    'menu.apriCartella': 'Open the downloads folder',
    'menu.cercaAggiornamenti': 'Check for updates…',
    'menu.esci': 'Quit',
    'menu.modifica': 'Edit',
    'menu.vista': 'View',
    'menu.ricarica': 'Reload',
    'menu.strumenti': 'Developer tools',
    'menu.zoomNormale': 'Actual size',
    'menu.zoomPiu': 'Zoom in',
    'menu.zoomMeno': 'Zoom out',
    'menu.schermoIntero': 'Full screen',
    'menu.finestra': 'Window',
    'menu.aiuto': 'Help',
    'menu.guida': 'User guide',
    'menu.sito': 'Open the web version',
    'menu.informazioni': 'About AstroCalendario',
    'aggiornamento.titolo': 'Update available',
    'aggiornamento.testo': 'Version {nuova} of the desktop app is out (this one is {attuale}).',
    'aggiornamento.dettaglio': 'Download the new installer and open it: it updates the program and keeps your log, events and settings.',
    'aggiornamento.scarica': 'Download',
    'aggiornamento.dopo': 'Later',
    'aggiornamento.nessuno': 'You already have the latest version ({attuale}).',
    'aggiornamento.errore': 'Could not check for updates: {errore}',
    'informazioni.testo': 'AstroCalendario di Ben {versione}',
    'informazioni.dettaglio': 'Desktop app · Electron {electron} · Chromium {chromium}\nDownloads folder: {cartella}\nFree software, GNU GPL v3 or later.',
    'porta.titolo': 'Port changed',
    'porta.testo': 'Port {preferita} is taken by another program: the app opened on {porta}.',
    'porta.dettaglio': 'Your log, events and settings are tied to the port: while the other program holds it, they will look empty here. Close the other program and reopen the app to get them back.',
    'salvato.titolo': 'File saved',
    'salvato.testo': '{nome} — click to open the folder',
    'cartella.titolo': 'Where to save the app\'s files',
    'avvio.errore': 'The app could not start',
    'ok': 'OK'
  }
};

function creaTraduttore(locale) {
  const lingua = /^it\b/i.test(String(locale || '')) ? 'it' : 'en';
  const diz = DIZIONARI[lingua];
  const t = (chiave, valori) => String(diz[chiave] || DIZIONARI.it[chiave] || chiave)
    .replace(/\{(\w+)\}/g, (_, k) => (valori && valori[k] != null ? String(valori[k]) : ''));
  t.lingua = lingua;
  return t;
}

module.exports = { creaTraduttore, DIZIONARI };
