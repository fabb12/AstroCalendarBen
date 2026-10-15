/* Il controllo degli accessi (v504). Prefisso `acc`.
 *
 * Si accende e si spegne con **un parametro**, `window.ACCESSI_ATTIVO` in
 * `config.js` (il deploy lo scrive dalla variabile di repository dello stesso
 * nome), e parla col server `worker-accessi.js` all'indirizzo
 * `window.ACCESSI_URL`. Spento — ed è il caso di serie — questo file non fa
 * niente: ogni funzione risponde «sì» e l'app è quella di prima, prove
 * comprese. Acceso:
 *
 *   - chi non ha una sessione vede solo la porta d'ingresso (nome e
 *     password) davanti a tutto il resto;
 *   - la sessione sta in `localStorage` (`astrocal_accessi_sessione_v1`,
 *     fuori dal backup): ricaricare la pagina, chiudere il browser o restare
 *     senza rete **non** fa uscire nessuno. Il server la allunga a ogni
 *     verifica (trenta giorni di inattività, di serie) e la può revocare: un
 *     utente spento o con la password cambiata esce alla verifica successiva
 *     (all'apertura, al ritorno sulla scheda dopo dieci minuti, al primo
 *     invio delle statistiche);
 *   - ogni utente ha le sue **funzioni**: le sezioni del menu e qualche
 *     funzione a sé (vista 3D, Missione Cielo, YouTube). Quelle che non ha
 *     spariscono dall'interfaccia (una regola CSS generata, che vale anche
 *     per i tasti disegnati dopo) e sono negate anche nel codice
 *     (`accessiUsa`, `accessiFiltraVista`): un tasto rimasto in una scheda non
 *     apre lo stesso la funzione;
 *   - l'uso dell'app si conta per utente: aperture, tempo passato in ogni
 *     sezione (solo con la pagina davanti agli occhi, e non oltre mezz'ora
 *     senza un gesto), funzioni usate e negate, dispositivo, lingua, ore del
 *     giorno. Gli eventi aspettano in una coda (`astrocal_accessi_coda_v1`) e
 *     partono a pacchetti ogni minuto e quando la pagina si nasconde; senza
 *     rete restano lì e partono dopo;
 *   - gli amministratori hanno «Gestisci utenti» nelle Impostazioni (Dati):
 *     creare, modificare, spegnere ed eliminare utenti, scegliere le loro
 *     funzioni, reimpostare la password, chiudere le loro sessioni, leggere
 *     le statistiche.
 *
 * Il limite, detto onestamente: questo è un sito statico, e la porta sta nel
 * browser di chi la apre. Fa entrare chi deve e fa vedere a ognuno quello che
 * gli spetta, e chi decide è il server; ma i file dell'app restano scaricabili
 * da chi conosce l'indirizzo. ACCESSI.md, «Cosa protegge e cosa no».
 *
 * Prova: `node scripts/prova-accessi.js`.
 */
'use strict';

// ====================================================================
// 1. Costanti, catalogo delle funzioni e stato
// ====================================================================

const ACC_CHIAVE_SESSIONE = 'astrocal_accessi_sessione_v1';
const ACC_CHIAVE_CODA = 'astrocal_accessi_coda_v1';
const ACC_CODA_MAX = 400;
const ACC_INVIO_MS = 60 * 1000;
const ACC_VERIFICA_MS = 10 * 60 * 1000;
const ACC_INATTIVO_MS = 30 * 60 * 1000;
const ACC_ATTESA_RETE_MS = 12000;
const ACC_PASSWORD_MIN = 8;

// Le funzioni che si danno a un utente. `viste` sono i nomi di `VISTE` in
// `app.js` che la funzione apre; `nascondi` i selettori che spariscono quando
// manca. Una funzione nuova si aggiunge qui (con il suo nome nei dizionari,
// `acc.funzione.<id>`) e con `accessiUsa('<id>')` nel punto in cui si apre.
const ACC_FUNZIONI = [
  { id: 'vista:stasera', viste: ['stasera'], nascondi: ['#btn-vista-stasera'] },
  { id: 'vista:calendario', viste: ['calendario', 'agenda', 'diario'], nascondi: ['#btn-vista-gruppo-calendario', '#sottonav-calendario'] },
  { id: 'vista:cielo', viste: ['cielo'], nascondi: ['#btn-vista-skymap'] },
  { id: 'vista:telescopio', viste: ['telescopio'], nascondi: ['#btn-vista-telescopio'] },
  { id: 'vista:didattica', viste: ['didattica'], nascondi: ['#btn-vista-didattica'] },
  { id: 'vista:demo', viste: ['demo'], nascondi: ['#btn-vista-demo'] },
  { id: 'sistema3d', nascondi: ['#skymap-btn-sistema', '[onclick^="apriSistemaSolare"]'] },
  { id: 'missione', nascondi: ['[data-blocco="missione"]', '#missione-striscia', '[data-missione]'] },
  { id: 'youtube', nascondi: ['#imp-youtube', '.tasto-youtube'] },
  { id: 'eventi', nascondi: ['#btn-aggiungi'] }
];

const acc = {
  attivo: false,
  url: '',
  sessione: null,        // { gettone, scade, profilo, verificata }
  coda: [],              // gli eventi non ancora messi in un pacchetto
  lotti: [],             // i pacchetti pronti: { id, eventi }, partono in ordine
  inVolo: false,
  vista: null,           // { nome, dal, aperta } il pezzo di tempo che si sta contando
  ultimoGesto: Date.now(),
  timerInvio: 0,
  admin: { utenti: [], giorni: 30, scheda: 'elenco', scelto: '', messaggio: '', tipo: '' },
  messaggioPorta: '',
  fuocoPrima: null
};

const accT = (k, dati) => (typeof astroI18n === 'object' && astroI18n.t) ? astroI18n.t('acc.' + k, dati) : k;

// ====================================================================
// 2. Il parametro e la sessione salvata
// ====================================================================

function accLeggiParametro() {
  const v = window.ACCESSI_ATTIVO;
  acc.attivo = v === true || v === 1 || /^(true|1|si|sì|on)$/i.test(String(v == null ? '' : v).trim());
  acc.url = String(window.ACCESSI_URL || '').trim().replace(/\/+$/, '');
}

function accLeggiSessione() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(ACC_CHIAVE_SESSIONE) || 'null'); } catch (_) { s = null; }
  if (!s || typeof s !== 'object' || typeof s.gettone !== 'string' || !s.gettone) return null;
  if (!(Number(s.scade) > Date.now())) return null;
  const p = s.profilo && typeof s.profilo === 'object' ? s.profilo : {};
  return {
    gettone: s.gettone, scade: Number(s.scade), verificata: Number(s.verificata) || 0,
    profilo: {
      utente: String(p.utente || ''), nome: String(p.nome || p.utente || ''),
      ruolo: p.ruolo === 'admin' ? 'admin' : 'utente',
      funzioni: Array.isArray(p.funzioni) ? p.funzioni.map(String) : []
    }
  };
}

function accSalvaSessione(s) {
  acc.sessione = s;
  try {
    if (s) localStorage.setItem(ACC_CHIAVE_SESSIONE, JSON.stringify(s));
    else localStorage.removeItem(ACC_CHIAVE_SESSIONE);
  } catch (_) { /* memoria piena o bloccata: la sessione vale finché la pagina è aperta */ }
}

function accLeggiCoda() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(ACC_CHIAVE_CODA) || 'null'); } catch (_) { c = null; }
  const eventi = (x) => Array.isArray(x) ? x.filter(e => e && typeof e === 'object') : [];
  acc.coda = c && typeof c === 'object' ? eventi(c.coda).slice(-ACC_CODA_MAX) : [];
  acc.lotti = c && Array.isArray(c.lotti)
    ? c.lotti.filter(l => l && typeof l.id === 'string' && Array.isArray(l.eventi)).map(l => ({ id: l.id, eventi: eventi(l.eventi) })).slice(-20)
    : [];
}

function accSalvaCoda() {
  try { localStorage.setItem(ACC_CHIAVE_CODA, JSON.stringify({ coda: acc.coda.slice(-ACC_CODA_MAX), lotti: acc.lotti.slice(-20) })); } catch (_) { /* resta in memoria */ }
}

function accNuovoId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

// ====================================================================
// 3. I permessi
// ====================================================================

function accessiAttivo() { return acc.attivo; }

function accessiPuo(id) {
  if (!acc.attivo) return true;
  const s = acc.sessione;
  if (!s) return false;
  if (s.profilo.ruolo === 'admin') return true;
  const f = s.profilo.funzioni;
  return f.includes('*') || f.includes(id);
}

function accVistaPermessa(nome) {
  const voce = ACC_FUNZIONI.find(f => f.viste && f.viste.includes(nome));
  return !voce || accessiPuo(voce.id);
}

function accPrimaVistaPermessa() {
  const ordine = (typeof VISTE !== 'undefined' && Array.isArray(VISTE)) ? VISTE.map(v => v.nome)
    : ['stasera', 'calendario', 'agenda', 'diario', 'cielo', 'telescopio', 'didattica', 'demo'];
  // Il planetario per primo: è la pagina di serie dell'app
  return ['cielo'].concat(ordine).find(accVistaPermessa) || null;
}

// Da `mostraVista`: la vista chiesta, o la prima permessa. Senza sessione la
// porta copre tutto e non si sposta niente; una demo in corso attraversa le
// viste come anteprime, e non si ferma a metà.
function accessiFiltraVista(nome) {
  if (!acc.attivo || !acc.sessione) return nome;
  if (typeof AstroDemo === 'object' && AstroDemo && AstroDemo.inCorso) return nome;
  if (accVistaPermessa(nome)) return nome;
  accRegistra({ tipo: 'negato', nome: 'vista:' + nome });
  return accPrimaVistaPermessa();
}

// Da chi apre una funzione: «sì» la conta fra quelle usate, «no» lo dice a
// chi ha toccato e la conta fra quelle negate.
function accessiUsa(id) {
  if (!acc.attivo) return true;
  if (accessiPuo(id)) { accRegistra({ tipo: 'azione', nome: id }); return true; }
  accRegistra({ tipo: 'negato', nome: id });
  accAvviso(accT('negata', { funzione: accNomeFunzione(id) }));
  return false;
}

// Un gesto da contare che non ha permessi (una demo avviata, una storia)
function accessiTraccia(nome) {
  if (acc.attivo && acc.sessione) accRegistra({ tipo: 'azione', nome });
}

function accNomeFunzione(id) {
  return accT('funzione.' + String(id).replace(/:/g, '_'));
}

// Quello che manca sparisce: una regola sola, scritta in un <style>, così
// vale anche per i tasti che le schede disegnano più tardi.
function accApplicaRegole() {
  let foglio = document.getElementById('acc-regole');
  if (!foglio) {
    foglio = document.createElement('style');
    foglio.id = 'acc-regole';
    document.head.appendChild(foglio);
  }
  const via = acc.attivo && acc.sessione
    ? ACC_FUNZIONI.filter(f => !accessiPuo(f.id)).flatMap(f => f.nascondi || []) : [];
  foglio.textContent = via.length ? via.join(',\n') + ' { display: none !important; }' : '';
  document.documentElement.classList.toggle('acc-admin', !!(acc.sessione && acc.sessione.profilo.ruolo === 'admin'));
}

// ====================================================================
// 4. La rete
// ====================================================================

async function accChiedi(percorso, { metodo = 'GET', corpo = null, gettone = true, keepalive = false } = {}) {
  if (!acc.url) throw Object.assign(new Error('configurazione'), { codice: 'configurazione' });
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ACC_ATTESA_RETE_MS) : 0;
  const testa = {};
  if (corpo) testa['Content-Type'] = keepalive ? 'text/plain' : 'application/json';
  if (gettone && acc.sessione && !keepalive) testa.Authorization = 'Bearer ' + acc.sessione.gettone;
  let risposta;
  try {
    risposta = await fetch(acc.url + '/api/accessi/' + percorso, {
      method: metodo, headers: testa, body: corpo ? JSON.stringify(corpo) : undefined,
      cache: 'no-store', keepalive, signal: ctrl ? ctrl.signal : undefined
    });
  } catch (_) {
    throw Object.assign(new Error('rete'), { codice: 'rete' });
  } finally { if (timer) clearTimeout(timer); }
  let dati = null;
  try { dati = await risposta.json(); } catch (_) { dati = null; }
  if (!risposta.ok) {
    const codice = (dati && dati.errore) || ('http' + risposta.status);
    throw Object.assign(new Error(codice), { codice, stato: risposta.status, dati });
  }
  return dati || {};
}

function accMessaggioErrore(e) {
  const codice = e && e.codice ? e.codice : 'rete';
  const noti = ['credenziali', 'bloccato', 'disattivato', 'rete', 'configurazione', 'archivio', 'sessione',
    'permesso', 'esiste', 'utente', 'password', 'ultimoAdmin', 'sestesso', 'origine', 'nessuno'];
  const dati = Object.assign({ min: ACC_PASSWORD_MIN, minuti: 15 }, (e && e.dati) || {});
  return accT('errore.' + (noti.includes(codice) ? codice : 'generico'), dati);
}

// ====================================================================
// 5. La porta d'ingresso
// ====================================================================

// La porta non sta in `index.html`: la si costruisce qui, e solo col
// controllo acceso. Spento, nel documento non c'è nemmeno un nodo in più da
// tradurre al cambio lingua (`prova-lingua.js` misura la riscrittura del
// testo, e dodici nodi nascosti si vedevano). I campi hanno i nomi e gli
// `autocomplete` che i gestori di password riconoscono.
function accCostruisciPorta() {
  let porta = document.getElementById('acc-porta');
  if (porta) return porta;
  const pw = accEl('input', { id: 'acc-password', name: 'password', class: 'acc-campo', type: 'password', autocomplete: 'current-password', required: true });
  porta = accEl('div', { id: 'acc-porta', class: 'acc-porta hidden', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'acc-porta-titolo' },
    accEl('form', { id: 'acc-porta-modulo', class: 'acc-porta-scheda', novalidate: true },
      accEl('span', { class: 'acc-porta-marchio', 'aria-hidden': 'true' }),
      accEl('p', { class: 'acc-porta-sovratitolo', 'data-acc': 'porta.sovratitolo' }),
      accEl('h2', { id: 'acc-porta-titolo', class: 'acc-porta-titolo', 'data-acc': 'porta.titolo' }),
      accEl('p', { class: 'acc-porta-testo', 'data-acc': 'porta.testo' }),
      accEl('label', { class: 'acc-etichetta', for: 'acc-utente', 'data-acc': 'campo.utente' }),
      accEl('input', { id: 'acc-utente', name: 'username', class: 'acc-campo', type: 'text', autocomplete: 'username',
        autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', required: true }),
      accEl('label', { class: 'acc-etichetta', for: 'acc-password', 'data-acc': 'porta.password' }),
      accEl('div', { class: 'acc-campo-password' }, pw,
        accEl('button', { id: 'acc-mostra-password', type: 'button', class: 'acc-mostra', 'aria-pressed': 'false', 'aria-controls': 'acc-password', 'data-acc': 'porta.mostra' })),
      accEl('p', { id: 'acc-porta-messaggio', class: 'acc-porta-messaggio hidden', role: 'alert' }),
      accEl('button', { id: 'acc-entra', type: 'submit', class: 'acc-entra', 'data-acc': 'porta.entra' }),
      accEl('button', { id: 'acc-porta-esci', type: 'button', class: 'acc-porta-esci hidden', 'data-acc': 'esci' }),
      accEl('p', { class: 'acc-porta-nota', 'data-acc': 'porta.nota' })));
  // Il marchio dell'app, lo stesso della testata
  porta.querySelector('.acc-porta-marchio').innerHTML =
    '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10.6" ry="3.6" transform="rotate(-24 12 12)"/></svg>';
  porta.querySelector('form').addEventListener('submit', accEntra);
  const mostra = porta.querySelector('#acc-mostra-password');
  mostra.addEventListener('click', () => {
    const vedi = pw.type === 'password';
    pw.type = vedi ? 'text' : 'password';
    mostra.setAttribute('aria-pressed', vedi ? 'true' : 'false');
    mostra.textContent = accT(vedi ? 'porta.nascondi' : 'porta.mostra');
  });
  const esci = porta.querySelector('#acc-porta-esci');
  esci.addEventListener('click', () => { esci.classList.add('hidden'); accessiEsci(); });
  document.body.insertBefore(porta, document.body.firstChild);
  accTraduciPorta();
  return porta;
}

function accTraduciPorta() {
  const porta = document.getElementById('acc-porta');
  if (!porta) return;
  porta.querySelectorAll('[data-acc]').forEach(n => { n.textContent = accT(n.dataset.acc); });
  const pw = document.getElementById('acc-password');
  const mostra = document.getElementById('acc-mostra-password');
  if (pw && mostra) mostra.textContent = accT(pw.type === 'password' ? 'porta.mostra' : 'porta.nascondi');
}

function accMostraPorta(messaggio) {
  const porta = accCostruisciPorta();
  if (!porta) return;
  acc.messaggioPorta = messaggio || '';
  const testo = document.getElementById('acc-porta-messaggio');
  if (testo) { testo.textContent = acc.messaggioPorta; testo.classList.toggle('hidden', !acc.messaggioPorta); }
  const config = !acc.url;
  const modulo = document.getElementById('acc-porta-modulo');
  if (modulo) modulo.classList.toggle('acc-senza-server', config);
  if (config && testo) { testo.textContent = accT('errore.configurazione'); testo.classList.remove('hidden'); }
  porta.classList.remove('hidden');
  document.documentElement.classList.add('acc-chiuso');
  // Quello che sta dietro non si raggiunge con la tastiera né col lettore
  // di schermo: la porta è l'unica cosa che c'è.
  [...document.body.children].forEach(n => {
    if (n !== porta && n.tagName !== 'SCRIPT' && !n.hasAttribute('inert')) { n.setAttribute('inert', ''); n.dataset.accInerte = '1'; }
  });
  const campo = document.getElementById(document.getElementById('acc-utente') && document.getElementById('acc-utente').value ? 'acc-password' : 'acc-utente');
  if (campo && document.readyState !== 'loading') setTimeout(() => { try { campo.focus(); } catch (_) {} }, 30);
}

function accNascondiPorta() {
  const porta = document.getElementById('acc-porta');
  if (porta) porta.classList.add('hidden');
  document.documentElement.classList.remove('acc-chiuso');
  document.querySelectorAll('[data-acc-inerte]').forEach(n => { n.removeAttribute('inert'); delete n.dataset.accInerte; });
}

async function accEntra(evento) {
  if (evento) evento.preventDefault();
  const utente = document.getElementById('acc-utente');
  const password = document.getElementById('acc-password');
  const tasto = document.getElementById('acc-entra');
  const nome = utente ? utente.value.trim().toLowerCase() : '';
  const segreto = password ? password.value : '';
  if (!nome || !segreto) { accMostraPorta(accT('errore.vuoti')); return; }
  if (tasto) { tasto.disabled = true; tasto.textContent = accT('porta.entro'); }
  try {
    const r = await accChiedi('entra', { metodo: 'POST', gettone: false,
      corpo: { utente: nome, password: segreto, dispositivo: accDispositivo() } });
    if (password) password.value = '';
    accSalvaSessione({ gettone: r.gettone, scade: r.scade, profilo: r.profilo, verificata: Date.now() });
    accAmmesso(true);
  } catch (e) {
    if (password) { password.value = ''; }
    accMostraPorta(accMessaggioErrore(e));
  } finally {
    if (tasto) { tasto.disabled = false; tasto.textContent = accT('porta.entra'); }
  }
}

// Dentro: via la porta, le regole del profilo, la vista giusta, il conto.
function accAmmesso(appenaEntrato) {
  accNascondiPorta();
  accApplicaRegole();
  if (!accPrimaVistaPermessa()) {
    accMostraPorta(accT('nessunaSezione'));
    const esci = document.getElementById('acc-porta-esci');
    if (esci) esci.classList.remove('hidden');
    return;
  }
  const esci = document.getElementById('acc-porta-esci');
  if (esci) esci.classList.add('hidden');
  if (typeof mostraVista === 'function' && typeof vistaAttuale !== 'undefined') {
    const voluta = appenaEntrato && typeof leggiUltimaVista === 'function' ? leggiUltimaVista() : vistaAttuale;
    const giusta = accessiFiltraVista(voluta);
    if (giusta && (appenaEntrato || giusta !== vistaAttuale)) mostraVista(giusta);
  }
  accDisegnaAccount();
  if (appenaEntrato) {
    accRegistra({ tipo: 'avvio', dispositivo: accDispositivo(), lingua: accLingua(), versione: accVersione() });
    // `mostraVista` qui sopra ha già fatto partire il conto della vista
    if (!acc.vista) accIniziaVista(typeof vistaAttuale !== 'undefined' ? vistaAttuale : '', true);
    accInvia();
  }
}

async function accessiEsci(messaggio) {
  accChiudiVista();
  if (acc.sessione) {
    await accInvia().catch(() => {});
    const s = acc.sessione;
    accChiedi('esci', { metodo: 'POST' }).catch(() => { /* la sessione la chiude comunque la scadenza */ });
    if (acc.sessione === s) accSalvaSessione(null);
  }
  acc.coda = [];
  acc.lotti = [];
  accSalvaCoda();
  accChiudiAdmin();
  accApplicaRegole();
  accDisegnaAccount();
  const imp = document.getElementById('modale-impostazioni');
  if (imp) imp.classList.add('hidden');
  accMostraPorta(messaggio || '');
}

// La sessione rimandata dal server: il profilo può essere cambiato
// (funzioni nuove, ruolo), e un 401 vuol dire fuori.
async function accVerifica() {
  if (!acc.attivo || !acc.sessione) return;
  try {
    const r = await accChiedi('sessione');
    if (!acc.sessione) return;
    accSalvaSessione(Object.assign({}, acc.sessione, { scade: r.scade, profilo: r.profilo, verificata: Date.now() }));
    accAmmesso(false);
  } catch (e) {
    // Solo un 401 è «la sessione non vale più». Un 403 (sito non ammesso dal
    // server) o un 5xx sono guasti di configurazione o del server, e chi è
    // dentro ci resta; senza rete pure: la sessione salvata vale fino alla
    // scadenza.
    if (e.stato === 401) accSessioneFinita();
  }
}

function accSessioneFinita() {
  accSalvaSessione(null);
  accessiEsci(accT('errore.sessione'));
}

// ====================================================================
// 6. Le statistiche
// ====================================================================

function accGiorno(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

function accDispositivo() {
  let tipo = '';
  try { if (typeof profiloDispositivo === 'function') tipo = profiloDispositivo(); } catch (_) { tipo = ''; }
  if (!tipo) {
    const ua = navigator.userAgent || '';
    tipo = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'telefono' : 'computer';
  }
  let app = false;
  try { app = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (_) { app = false; }
  return tipo + (app ? ':app' : '');
}

function accLingua() {
  return typeof astroI18n === 'object' && astroI18n.lingua ? astroI18n.lingua() : (document.documentElement.lang || 'it');
}

function accVersione() {
  return (window.ASTROCAL_BUILD && window.ASTROCAL_BUILD.version) || '';
}

function accRegistra(evento) {
  if (!acc.attivo || !acc.sessione) return;
  const ora = new Date();
  acc.coda.push(Object.assign({ giorno: accGiorno(ora), ora: ora.getHours() }, evento));
  if (acc.coda.length > ACC_CODA_MAX) acc.coda.splice(0, acc.coda.length - ACC_CODA_MAX);
  accSalvaCoda();
}

// Il tempo in una sezione si conta a pezzi: da quando la si apre (o la
// pagina torna davanti) a quando si cambia, la pagina si nasconde o passa
// il minuto dell'invio. Senza un gesto per mezz'ora il pezzo si chiude
// all'ultimo gesto: un telefono dimenticato acceso sul comodino non fa ore
// di planetario.
function accIniziaVista(nome, apertura) {
  if (!acc.attivo || !acc.sessione || !nome) { acc.vista = null; return; }
  acc.vista = { nome, dal: Date.now(), apertura: !!apertura };
}

function accChiudiVista() {
  const v = acc.vista;
  acc.vista = null;
  if (!v || !acc.sessione) return;
  const fine = Math.min(Date.now(), acc.ultimoGesto + ACC_INATTIVO_MS);
  const secondi = Math.max(0, Math.round((fine - v.dal) / 1000));
  if (secondi > 0 || v.apertura) accRegistra({ tipo: 'vista', nome: v.nome, secondi, apertura: v.apertura });
}

function accessiVistaAperta(nome) {
  if (!acc.attivo || !acc.sessione) return;
  if (acc.vista && acc.vista.nome === nome) return;
  accChiudiVista();
  if (document.visibilityState !== 'hidden') accIniziaVista(nome, true);
}

// Gli eventi uguali di fila si fondono prima di partire: il server li
// somma lo stesso, e un pacchetto piccolo parte anche dalla rete del rifugio.
function accCompatta(eventi) {
  const fuori = [];
  for (const e of eventi) {
    const u = fuori[fuori.length - 1];
    if (u && e.tipo === 'vista' && u.tipo === 'vista' && u.nome === e.nome && u.giorno === e.giorno && !e.apertura) {
      u.secondi += e.secondi;
      continue;
    }
    fuori.push(Object.assign({}, e));
  }
  return fuori;
}

// Gli eventi partono a pacchetti col loro nome (`lotto`): un pacchetto che
// non ha avuto risposta resta e riparte **con lo stesso nome**, e il server
// non conta due volte un nome già visto. Così né la rete che cade né la
// pagina che si chiude a metà invio perdono o raddoppiano qualcosa.
async function accInvia({ chiusura = false } = {}) {
  if (!acc.attivo || !acc.sessione || !acc.url || acc.inVolo) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (acc.coda.length) {
    acc.lotti.push({ id: accNuovoId(), eventi: accCompatta(acc.coda) });
    acc.coda = [];
    accSalvaCoda();
  }
  acc.inVolo = true;
  try {
    while (acc.lotti.length && acc.sessione) {
      const lotto = acc.lotti[0];
      try {
        await accChiedi('eventi', { metodo: 'POST', keepalive: chiusura,
          corpo: Object.assign({ lotto: lotto.id, eventi: lotto.eventi }, chiusura ? { gettone: acc.sessione.gettone } : {}) });
      } catch (e) {
        if (e.stato === 401) { acc.inVolo = false; accSessioneFinita(); return; }
        // Un pacchetto che il server rifiuta per com'è fatto non migliora
        // riprovando: si butta. Il resto (rete, 5xx) aspetta il prossimo giro.
        if (e.stato !== 400 && e.stato !== 413) return;
      }
      if (acc.lotti[0] === lotto) acc.lotti.shift();
      accSalvaCoda();
      if (chiusura) return;
    }
  } finally { acc.inVolo = false; }
}

function accCollegaConteggio() {
  const gesto = () => { acc.ultimoGesto = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => window.addEventListener(t, gesto, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => {
    if (!acc.sessione) return;
    if (document.visibilityState === 'hidden') {
      accChiudiVista();
      accInvia({ chiusura: true });
    } else {
      acc.ultimoGesto = Date.now();
      accIniziaVista(typeof vistaAttuale !== 'undefined' ? vistaAttuale : '', false);
      if (Date.now() - (acc.sessione.verificata || 0) > ACC_VERIFICA_MS) accVerifica();
    }
  });
  window.addEventListener('pagehide', () => { accChiudiVista(); accInvia({ chiusura: true }); });
  window.addEventListener('online', () => accInvia());
  clearInterval(acc.timerInvio);
  acc.timerInvio = setInterval(() => {
    if (!acc.sessione || document.visibilityState === 'hidden') return;
    // Il pezzo di tempo in corso si chiude e riparte, così un browser che
    // muore non si porta via più di un minuto
    if (acc.vista) { const nome = acc.vista.nome; accChiudiVista(); accIniziaVista(nome, false); }
    accInvia();
  }, ACC_INVIO_MS);
}

// ====================================================================
// 7. Piccoli aiuti per disegnare
// ====================================================================

function accEl(tag, attributi, ...figli) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'testo') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of figli.flat()) if (f != null && f !== false) n.append(f.nodeType ? f : String(f));
  return n;
}

function accAvviso(testo) {
  let box = document.getElementById('acc-avviso');
  if (!box) {
    box = accEl('div', { id: 'acc-avviso', class: 'acc-avviso', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(box);
  }
  box.textContent = testo;
  box.classList.add('visibile');
  clearTimeout(acc.timerAvviso);
  acc.timerAvviso = setTimeout(() => box.classList.remove('visibile'), 4200);
}

function accDurata(secondi) {
  return typeof astroI18n === 'object' && astroI18n.durata ? astroI18n.durata((Number(secondi) || 0) * 1000) : Math.round(secondi) + ' s';
}

function accData(ms, conOra = true) {
  if (!ms) return accT('mai');
  return typeof astroI18n === 'object' && astroI18n.data
    ? astroI18n.data(ms, conOra ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
    : new Date(ms).toLocaleString();
}

function accNomeVista(nome) {
  return accT('vista.' + nome);
}

// ====================================================================
// 8. Il proprio account (Impostazioni → Dati)
// ====================================================================

function accDisegnaAccount() {
  const sezione = document.getElementById('imp-account');
  const box = document.getElementById('imp-account-corpo');
  if (!sezione || !box) return;
  sezione.classList.toggle('hidden', !acc.attivo);
  if (!acc.attivo) return;
  const s = acc.sessione;
  if (!s) { box.replaceChildren(); return; }
  const p = s.profilo;
  const tutte = p.ruolo === 'admin' || p.funzioni.includes('*');
  const funzioni = tutte ? [accT('tutteLeFunzioni')] : ACC_FUNZIONI.filter(f => p.funzioni.includes(f.id)).map(f => accNomeFunzione(f.id));
  const messaggio = accEl('p', { class: 'acc-messaggio', role: 'status', 'aria-live': 'polite' });
  const vecchia = accEl('input', { type: 'password', class: 'acc-campo', id: 'acc-pw-vecchia', autocomplete: 'current-password' });
  const nuova = accEl('input', { type: 'password', class: 'acc-campo', id: 'acc-pw-nuova', autocomplete: 'new-password', minlength: ACC_PASSWORD_MIN });
  const cambia = accEl('details', { class: 'acc-cambia' },
    accEl('summary', { testo: accT('cambiaPassword') }),
    accEl('form', { class: 'acc-modulo-piccolo', onsubmit: async (e) => {
      e.preventDefault();
      messaggio.className = 'acc-messaggio';
      if (nuova.value.length < ACC_PASSWORD_MIN) { messaggio.textContent = accT('errore.password', { min: ACC_PASSWORD_MIN }); messaggio.classList.add('errore'); return; }
      try {
        await accChiedi('password', { metodo: 'POST', corpo: { vecchia: vecchia.value, nuova: nuova.value } });
        vecchia.value = ''; nuova.value = '';
        messaggio.textContent = accT('passwordCambiata'); messaggio.classList.add('ok');
      } catch (err) {
        messaggio.textContent = accMessaggioErrore(err); messaggio.classList.add('errore');
      }
    } },
    accEl('label', { class: 'acc-etichetta', for: vecchia.id, testo: accT('passwordAttuale') }), vecchia,
    accEl('label', { class: 'acc-etichetta', for: nuova.id, testo: accT('passwordNuova', { min: ACC_PASSWORD_MIN }) }), nuova,
    accEl('button', { type: 'submit', class: 'tasto-cielo', testo: accT('salvaPassword') })));
  box.replaceChildren(accEl('div', { class: 'acc-account' },
    accEl('p', { class: 'acc-chi' },
      accEl('span', { class: 'acc-avatar', 'aria-hidden': 'true', testo: (p.nome || p.utente || '?').slice(0, 1).toUpperCase() }),
      accEl('span', {}, accEl('strong', { testo: p.nome || p.utente }), accEl('small', { testo: p.utente + ' · ' + accT('ruolo.' + p.ruolo) }))),
    accEl('p', { class: 'acc-nota', testo: accT('leTueFunzioni') + ' ' + funzioni.join(', ') }),
    accEl('div', { class: 'acc-tasti' },
      p.ruolo === 'admin' ? accEl('button', { type: 'button', class: 'tasto-cielo tasto-primario', id: 'acc-btn-gestisci', testo: accT('gestisciUtenti'), onclick: () => accApriAdmin() }) : null,
      accEl('button', { type: 'button', class: 'tasto-cielo', id: 'acc-btn-esci', testo: accT('esci'), onclick: () => accessiEsci() })),
    cambia, messaggio));
}

// ====================================================================
// 9. Gestisci utenti (solo amministratori)
// ====================================================================

function accApriAdmin() {
  const modale = document.getElementById('modale-accessi');
  if (!modale || !acc.sessione || acc.sessione.profilo.ruolo !== 'admin') return;
  acc.fuocoPrima = document.activeElement;
  modale.classList.remove('hidden');
  acc.admin.scheda = 'elenco';
  acc.admin.messaggio = '';
  accDisegnaAdmin();
  accCaricaUtenti();
}

function accChiudiAdmin() {
  const modale = document.getElementById('modale-accessi');
  if (!modale || modale.classList.contains('hidden')) return;
  modale.classList.add('hidden');
  if (acc.fuocoPrima && acc.fuocoPrima.focus) try { acc.fuocoPrima.focus(); } catch (_) {}
}

async function accCaricaUtenti() {
  acc.admin.caricamento = true;
  accDisegnaAdmin();
  try {
    const r = await accChiedi('utenti?giorni=' + acc.admin.giorni);
    acc.admin.utenti = r.utenti || [];
  } catch (e) {
    if (e.stato === 401) { accSessioneFinita(); return; }
    acc.admin.messaggio = accMessaggioErrore(e); acc.admin.tipo = 'errore';
  }
  acc.admin.caricamento = false;
  accDisegnaAdmin();
}

function accDisegnaAdmin() {
  const box = document.getElementById('acc-admin-corpo');
  if (!box) return;
  const a = acc.admin;
  const pezzi = [];
  if (a.scheda === 'elenco') pezzi.push(accDisegnaElenco());
  else if (a.scheda === 'modifica') pezzi.push(accDisegnaModulo());
  else if (a.scheda === 'statistiche') pezzi.push(accDisegnaStatistiche());
  pezzi.unshift(accEl('p', { class: 'acc-messaggio' + (a.tipo ? ' ' + a.tipo : ''), role: 'status', 'aria-live': 'polite', testo: a.messaggio }));
  box.replaceChildren(...pezzi);
}

function accDisegnaElenco() {
  const a = acc.admin;
  const periodo = accEl('select', { class: 'acc-campo acc-periodo', 'aria-label': accT('periodo'), onchange: (e) => { a.giorni = Number(e.target.value); accCaricaUtenti(); } },
    [7, 30, 90, 365].map(g => accEl('option', { value: g, selected: g === a.giorni, testo: accT('ultimiGiorni', { n: g }) })));
  const testa = accEl('div', { class: 'acc-barra' },
    accEl('button', { type: 'button', class: 'tasto-cielo tasto-primario', id: 'acc-btn-nuovo', testo: accT('nuovoUtente'),
      onclick: () => { a.scheda = 'modifica'; a.scelto = ''; a.messaggio = ''; accDisegnaAdmin(); } }),
    accEl('label', { class: 'acc-etichetta-riga' }, accT('periodo'), periodo),
    accEl('button', { type: 'button', class: 'tasto-cielo', testo: accT('aggiorna'), onclick: () => { a.messaggio = ''; accCaricaUtenti(); } }));
  if (a.caricamento && !a.utenti.length) return accEl('div', {}, testa, accEl('p', { class: 'acc-nota', testo: accT('caricamento') }));
  const righe = a.utenti.map(u => {
    const r = u.riassunto || {};
    return accEl('tr', { 'data-utente': u.utente, class: u.attivo ? '' : 'acc-spento' },
      accEl('th', { scope: 'row' }, accEl('strong', { testo: u.nome }), accEl('small', { testo: u.utente })),
      accEl('td', { 'data-etichetta': accT('colonna.ruolo') }, accEl('span', { class: 'acc-ruolo acc-ruolo-' + u.ruolo, testo: accT('ruolo.' + u.ruolo) }),
        u.attivo ? null : accEl('span', { class: 'acc-ruolo acc-ruolo-spento', testo: accT('disattivato') })),
      accEl('td', { 'data-etichetta': accT('colonna.ultimo') , testo: accData(r.ultimo || u.ultimoAccesso) }),
      accEl('td', { 'data-etichetta': accT('colonna.giorni'), class: 'acc-num', testo: String(r.giorniAttivi || 0) }),
      accEl('td', { 'data-etichetta': accT('colonna.tempo'), class: 'acc-num', testo: accDurata(r.secondi || 0) }),
      accEl('td', { 'data-etichetta': accT('colonna.aperture'), class: 'acc-num', testo: String(r.avvii || 0) }),
      accEl('td', { class: 'acc-azioni-riga' },
        accEl('button', { type: 'button', class: 'tasto-cielo acc-tasto-piccolo', 'data-azione': 'statistiche', testo: accT('statistiche'),
          onclick: () => accApriStatistiche(u.utente) }),
        accEl('button', { type: 'button', class: 'tasto-cielo acc-tasto-piccolo', 'data-azione': 'modifica', testo: accT('modifica'),
          onclick: () => { a.scheda = 'modifica'; a.scelto = u.utente; a.messaggio = ''; accDisegnaAdmin(); } })));
  });
  const tabella = accEl('div', { class: 'acc-tabella-box' }, accEl('table', { class: 'acc-tabella' },
    accEl('thead', {}, accEl('tr', {},
      ['utente', 'ruolo', 'ultimo', 'giorni', 'tempo', 'aperture'].map(c => accEl('th', { scope: 'col', testo: accT('colonna.' + c) })),
      accEl('th', { scope: 'col' }, accEl('span', { class: 'sr-only', testo: accT('colonna.azioni') })))),
    accEl('tbody', {}, righe)));
  return accEl('div', { class: 'acc-elenco' }, testa, tabella,
    a.utenti.length ? null : accEl('p', { class: 'acc-nota', testo: accT('nessunUtente') }));
}

function accDisegnaModulo() {
  const a = acc.admin;
  const u = a.utenti.find(x => x.utente === a.scelto) || null;
  const nuovo = !u;
  const io = acc.sessione ? acc.sessione.profilo.utente : '';
  const id = accEl('input', { class: 'acc-campo', id: 'acc-f-utente', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
    required: true, pattern: '[a-z0-9][a-z0-9._@\\-]{2,63}', value: u ? u.utente : '', disabled: !nuovo });
  const nome = accEl('input', { class: 'acc-campo', id: 'acc-f-nome', autocomplete: 'off', maxlength: 80, value: u ? u.nome : '' });
  const pw = accEl('input', { class: 'acc-campo', id: 'acc-f-password', type: 'password', autocomplete: 'new-password', minlength: ACC_PASSWORD_MIN, required: nuovo });
  const ruolo = accEl('select', { class: 'acc-campo', id: 'acc-f-ruolo' },
    ['utente', 'admin'].map(r => accEl('option', { value: r, selected: (u ? u.ruolo : 'utente') === r, testo: accT('ruolo.' + r) })));
  const attivo = accEl('input', { type: 'checkbox', id: 'acc-f-attivo', checked: u ? u.attivo : true });
  const note = accEl('textarea', { class: 'acc-campo', id: 'acc-f-note', rows: 2, maxlength: 300 });
  note.value = u ? u.note || '' : '';
  const funzioniUtente = u ? u.funzioni : ACC_FUNZIONI.filter(f => f.viste).map(f => f.id);
  const tutte = accEl('input', { type: 'checkbox', id: 'acc-f-tutte', checked: funzioniUtente.includes('*') });
  const spunte = ACC_FUNZIONI.map(f => accEl('label', { class: 'acc-spunta' },
    accEl('input', { type: 'checkbox', name: 'funzione', value: f.id, checked: funzioniUtente.includes('*') || funzioniUtente.includes(f.id) }),
    ' ', accNomeFunzione(f.id)));
  const griglia = accEl('fieldset', { class: 'acc-funzioni' },
    accEl('legend', { testo: accT('funzioni') }),
    accEl('label', { class: 'acc-spunta acc-spunta-tutte' }, tutte, ' ', accT('tutteLeFunzioni')),
    accEl('div', { class: 'acc-funzioni-griglia' }, spunte),
    accEl('p', { class: 'acc-nota', testo: accT('funzioniNota') }));
  const aggiornaSpunte = () => {
    const admin = ruolo.value === 'admin';
    griglia.disabled = admin;
    griglia.classList.toggle('acc-tutte', tutte.checked || admin);
  };
  tutte.addEventListener('change', aggiornaSpunte);
  ruolo.addEventListener('change', aggiornaSpunte);
  aggiornaSpunte();

  const salva = async (e) => {
    e.preventDefault();
    const scelte = tutte.checked ? ['*'] : [...griglia.querySelectorAll('input[name="funzione"]:checked')].map(c => c.value);
    const corpo = { nome: nome.value.trim(), ruolo: ruolo.value, attivo: attivo.checked, funzioni: scelte, note: note.value };
    if (pw.value) {
      if (pw.value.length < ACC_PASSWORD_MIN) { a.messaggio = accT('errore.password', { min: ACC_PASSWORD_MIN }); a.tipo = 'errore'; accDisegnaAdmin(); return; }
      corpo.password = pw.value;
    }
    try {
      if (nuovo) {
        corpo.utente = id.value.trim().toLowerCase();
        if (!corpo.password) { a.messaggio = accT('errore.password', { min: ACC_PASSWORD_MIN }); a.tipo = 'errore'; accDisegnaAdmin(); return; }
        await accChiedi('utenti', { metodo: 'POST', corpo });
        a.messaggio = accT('creato', { utente: corpo.utente });
      } else {
        await accChiedi('utenti/' + encodeURIComponent(u.utente), { metodo: 'PATCH', corpo });
        a.messaggio = accT('salvato', { utente: u.utente });
      }
      a.tipo = 'ok';
      a.scheda = 'elenco';
      // Chi ha cambiato sé stesso rilegge il proprio profilo
      if (!nuovo && u.utente === io) accVerifica();
      await accCaricaUtenti();
    } catch (err) {
      if (err.stato === 401) { accSessioneFinita(); return; }
      a.messaggio = accMessaggioErrore(err); a.tipo = 'errore'; accDisegnaAdmin();
    }
  };

  const azioniPericolose = nuovo ? null : accEl('div', { class: 'acc-tasti acc-pericolo' },
    accEl('button', { type: 'button', class: 'tasto-cielo', 'data-azione': 'revoca', testo: accT('chiudiSessioni'), onclick: async () => {
      if (!confirm(accT('chiudiSessioniConferma', { utente: u.utente }))) return;
      try {
        await accChiedi('utenti/' + encodeURIComponent(u.utente) + '/sessioni', { metodo: 'DELETE' });
        a.messaggio = accT('sessioniChiuse', { utente: u.utente }); a.tipo = 'ok';
        if (u.utente === io) { accSessioneFinita(); return; }
      } catch (err) { a.messaggio = accMessaggioErrore(err); a.tipo = 'errore'; }
      accDisegnaAdmin();
    } }),
    u.utente === io ? null : accEl('button', { type: 'button', class: 'tasto-cielo acc-tasto-rosso', 'data-azione': 'elimina', testo: accT('elimina'), onclick: async () => {
      if (!confirm(accT('eliminaConferma', { utente: u.utente }))) return;
      try {
        await accChiedi('utenti/' + encodeURIComponent(u.utente), { metodo: 'DELETE' });
        a.messaggio = accT('eliminato', { utente: u.utente }); a.tipo = 'ok'; a.scheda = 'elenco';
        await accCaricaUtenti();
        return;
      } catch (err) { a.messaggio = accMessaggioErrore(err); a.tipo = 'errore'; }
      accDisegnaAdmin();
    } }));

  return accEl('form', { class: 'acc-modulo', id: 'acc-modulo-utente', onsubmit: salva, novalidate: true },
    accEl('h3', { class: 'acc-titolo', testo: nuovo ? accT('nuovoUtente') : accT('modificaUtente', { utente: u.utente }) }),
    accEl('div', { class: 'acc-campi' },
      accEl('label', { class: 'acc-etichetta', for: id.id, testo: accT('campo.utente') }), id,
      accEl('small', { class: 'acc-aiuto', testo: accT('campo.utenteAiuto') }),
      accEl('label', { class: 'acc-etichetta', for: nome.id, testo: accT('campo.nome') }), nome,
      accEl('label', { class: 'acc-etichetta', for: pw.id, testo: nuovo ? accT('campo.password', { min: ACC_PASSWORD_MIN }) : accT('campo.passwordNuova', { min: ACC_PASSWORD_MIN }) }), pw,
      accEl('label', { class: 'acc-etichetta', for: ruolo.id, testo: accT('campo.ruolo') }), ruolo,
      accEl('label', { class: 'acc-spunta' }, attivo, ' ', accT('campo.attivo')),
      accEl('label', { class: 'acc-etichetta', for: note.id, testo: accT('campo.note') }), note),
    griglia,
    accEl('div', { class: 'acc-tasti' },
      accEl('button', { type: 'submit', class: 'tasto-cielo tasto-primario', id: 'acc-btn-salva', testo: nuovo ? accT('crea') : accT('salva') }),
      accEl('button', { type: 'button', class: 'tasto-cielo', testo: accT('annulla'), onclick: () => { a.scheda = 'elenco'; a.messaggio = ''; accDisegnaAdmin(); } })),
    azioniPericolose);
}

async function accApriStatistiche(id) {
  const a = acc.admin;
  a.scheda = 'statistiche'; a.scelto = id; a.dati = null; a.messaggio = '';
  accDisegnaAdmin();
  try {
    a.dati = await accChiedi('utenti/' + encodeURIComponent(id) + '/statistiche?giorni=' + a.giorni);
  } catch (e) {
    if (e.stato === 401) { accSessioneFinita(); return; }
    a.messaggio = accMessaggioErrore(e); a.tipo = 'errore';
  }
  if (a.scheda === 'statistiche' && a.scelto === id) accDisegnaAdmin();
}

// Una barra orizzontale: etichetta, barra in proporzione al massimo, valore
function accBarre(voci, formatta) {
  const max = Math.max(1, ...voci.map(v => v.valore));
  return accEl('ul', { class: 'acc-barre' }, voci.map(v => accEl('li', {},
    accEl('span', { class: 'acc-barra-nome', testo: v.nome }),
    accEl('span', { class: 'acc-barra-binario', 'aria-hidden': 'true' },
      accEl('span', { class: 'acc-barra-piena', style: 'width:' + Math.max(2, Math.round(v.valore / max * 100)) + '%' })),
    accEl('span', { class: 'acc-barra-valore', testo: formatta(v.valore, v) }))));
}

function accDisegnaStatistiche() {
  const a = acc.admin;
  const indietro = accEl('button', { type: 'button', class: 'tasto-cielo', testo: accT('indietro'), onclick: () => { a.scheda = 'elenco'; a.messaggio = ''; accDisegnaAdmin(); } });
  if (!a.dati) return accEl('div', {}, accEl('div', { class: 'acc-barra' }, indietro), accEl('p', { class: 'acc-nota', testo: a.messaggio ? '' : accT('caricamento') }));
  const { utente: u, statistiche: s, sessioni } = a.dati;
  const t = s.totale;
  const cifre = [
    [accT('cifra.tempo'), accDurata(t.secondi)],
    [accT('cifra.giorniAttivi'), accT('cifra.diGiorni', { n: s.giorniAttivi, di: s.giorni })],
    [accT('cifra.aperture'), String(t.avvii)],
    [accT('cifra.accessi'), String(t.accessi)],
    [accT('cifra.media'), accDurata(s.giorniAttivi ? t.secondi / s.giorniAttivi : 0)],
    [accT('cifra.ultimo'), accData(t.ultimo || u.ultimoAccesso)]
  ];
  const sezioni = Object.entries(t.viste).sort((x, y) => y[1].secondi - x[1].secondi)
    .map(([nome, v]) => ({ nome: accNomeVista(nome), valore: v.secondi, aperture: v.aperture }));
  const azioni = Object.entries(t.azioni).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([nome, n]) => ({ nome: accNomeAzione(nome), valore: n }));
  const negati = Object.entries(t.negati || {}).sort((x, y) => y[1] - x[1]).map(([nome, n]) => ({ nome: accNomeAzione(nome), valore: n }));
  const dispositivi = Object.entries(t.dispositivi).sort((x, y) => y[1] - x[1]).map(([nome, n]) => ({ nome: accNomeDispositivo(nome), valore: n }));
  const lingue = Object.entries(t.lingue).sort((x, y) => y[1] - x[1]).map(([nome, n]) => ({ nome: nome.toUpperCase(), valore: n }));

  // L'attività giorno per giorno: una colonna per giorno del periodo
  const perGiorno = new Map(s.perGiorno.map(g => [g.giorno, g]));
  const giorni = [];
  const oggi = new Date();
  for (let i = Math.min(s.giorni, 90) - 1; i >= 0; i--) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - i);
    const chiave = accGiorno(d);
    const g = perGiorno.get(chiave) || perGiorno.get(d.toISOString().slice(0, 10));
    giorni.push({ chiave, secondi: g ? g.secondi : 0, avvii: g ? g.avvii : 0 });
  }
  const maxG = Math.max(1, ...giorni.map(g => g.secondi));
  const colonne = accEl('div', { class: 'acc-giorni', role: 'img', 'aria-label': accT('attivitaGiorni') },
    giorni.map(g => accEl('span', { class: 'acc-giorno' + (g.secondi || g.avvii ? ' attivo' : ''),
      title: accData(new Date(g.chiave + 'T12:00:00').getTime(), false) + ' · ' + accDurata(g.secondi),
      style: 'height:' + (g.secondi ? Math.max(8, Math.round(g.secondi / maxG * 100)) : (g.avvii ? 6 : 2)) + '%' })));

  const ore = accEl('div', { class: 'acc-ore', role: 'img', 'aria-label': accT('orePreferite') },
    Array.from({ length: 24 }, (_, h) => {
      const n = (t.ore || {})[h] || 0;
      const max = Math.max(1, ...Object.values(t.ore || {}));
      return accEl('span', { class: 'acc-ora', title: String(h).padStart(2, '0') + ':00 · ' + n, style: 'opacity:' + (n ? 0.25 + 0.75 * n / max : 0.08) });
    }));

  const blocco = (titolo, contenuto) => contenuto ? accEl('section', { class: 'acc-blocco' }, accEl('h4', { testo: titolo }), contenuto) : null;
  return accEl('div', { class: 'acc-statistiche', 'data-utente': u.utente },
    accEl('div', { class: 'acc-barra' }, indietro,
      accEl('h3', { class: 'acc-titolo' }, u.nome, ' ', accEl('small', { testo: '· ' + u.utente + ' · ' + accT('ultimiGiorni', { n: s.giorni }) }))),
    accEl('dl', { class: 'acc-cifre' }, cifre.map(([k, v]) => accEl('div', {}, accEl('dt', { testo: k }), accEl('dd', { testo: v })))),
    blocco(accT('attivitaGiorni'), colonne),
    blocco(accT('tempoSezioni'), sezioni.length ? accBarre(sezioni, (v, x) => accDurata(v) + ' · ' + accT('volte', { n: x.aperture })) : accEl('p', { class: 'acc-nota', testo: accT('nessunDato') })),
    blocco(accT('funzioniUsate'), azioni.length ? accBarre(azioni, v => accT('volte', { n: v })) : accEl('p', { class: 'acc-nota', testo: accT('nessunDato') })),
    negati.length ? blocco(accT('funzioniNegate'), accBarre(negati, v => accT('volte', { n: v }))) : null,
    blocco(accT('orePreferite'), ore),
    accEl('div', { class: 'acc-due' },
      blocco(accT('dispositivi'), dispositivi.length ? accBarre(dispositivi, v => accT('volte', { n: v })) : accEl('p', { class: 'acc-nota', testo: accT('nessunDato') })),
      blocco(accT('lingue'), lingue.length ? accBarre(lingue, v => accT('volte', { n: v })) : accEl('p', { class: 'acc-nota', testo: accT('nessunDato') }))),
    blocco(accT('sessioniAperte', { n: sessioni.length }), sessioni.length ? accEl('ul', { class: 'acc-sessioni' },
      sessioni.map(x => accEl('li', {}, accEl('strong', { testo: x.dispositivo || '—' }), ' ',
        accEl('small', { testo: accT('sessioneDal', { da: accData(x.creata), uso: accData(x.ultimoUso) }) })))) : accEl('p', { class: 'acc-nota', testo: accT('nessunaSessione') })),
    s.versione ? accEl('p', { class: 'acc-nota', testo: accT('versioneUsata', { v: s.versione }) }) : null);
}

function accNomeAzione(nome) {
  if (nome.startsWith('vista:')) return accNomeVista(nome.slice(6));
  const chiave = 'acc.funzione.' + nome.replace(/:/g, '_');
  if (typeof astroI18n === 'object' && astroI18n.esiste && astroI18n.esiste(chiave)) return astroI18n.t(chiave);
  const chiave2 = 'acc.azione.' + nome.replace(/:/g, '_');
  if (typeof astroI18n === 'object' && astroI18n.esiste && astroI18n.esiste(chiave2)) return astroI18n.t(chiave2);
  return nome;
}

function accNomeDispositivo(nome) {
  const [tipo, app] = nome.split(':');
  return accT('dispositivo.' + tipo) + (app ? ' · ' + accT('dispositivo.app') : '');
}

// ====================================================================
// 10. L'avvio
// ====================================================================

function accCollegaPagina() {
  const modale = document.getElementById('modale-accessi');
  const chiudi = document.getElementById('btn-chiudi-accessi');
  if (chiudi) chiudi.addEventListener('click', accChiudiAdmin);
  if (modale) modale.addEventListener('click', (e) => { if (e.target === modale) accChiudiAdmin(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modale && !modale.classList.contains('hidden')) accChiudiAdmin(); });
  // Le scritte disegnate qui si rifanno nella lingua nuova
  if (typeof astroI18n === 'object' && astroI18n.alCambio) astroI18n.alCambio(() => {
    accTraduciPorta();
    accDisegnaAccount();
    if (modale && !modale.classList.contains('hidden')) accDisegnaAdmin();
  });
  accDisegnaAccount();
  // La porta aperta mentre la pagina si leggeva: il cursore nel primo campo
  if (!acc.sessione) accMostraPorta(acc.messaggioPorta);
  if (acc.sessione) {
    accRegistra({ tipo: 'avvio', dispositivo: accDispositivo(), lingua: accLingua(), versione: accVersione() });
    // Il conto della vista lo fa partire `mostraVista` dell'avvio di app.js,
    // che viene *dopo* di qui: un ascoltatore su `document` precede quelli su
    // `window`. Partire qui voleva dire contare a «Stasera» (il valore di
    // serie di `vistaAttuale`) i secondi dell'avvio. Misurato nella prova.
    setTimeout(() => { if (!acc.vista && acc.sessione) accIniziaVista(typeof vistaAttuale !== 'undefined' ? vistaAttuale : '', true); }, 0);
    accVerifica();
    setTimeout(() => accInvia(), 3000);
  }
  accCollegaConteggio();
}

(function accAvvia() {
  accLeggiParametro();
  if (!acc.attivo) return;
  document.documentElement.classList.add('acc-attivo');
  acc.sessione = accLeggiSessione();
  if (acc.sessione) accLeggiCoda();
  // Subito, mentre la pagina si legge ancora: chi non ha una sessione non
  // deve vedere l'app nemmeno per un istante.
  if (acc.sessione) accApplicaRegole();
  else accMostraPorta('');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', accCollegaPagina, { once: true });
  else accCollegaPagina();
})();

// Per le prove e per chi guarda dalla console
window.AstroAccessi = {
  attivo: accessiAttivo, puo: accessiPuo, usa: accessiUsa, esci: accessiEsci, verifica: accVerifica,
  invia: accInvia, funzioni: () => ACC_FUNZIONI.map(f => f.id),
  stato: () => ({ attivo: acc.attivo, url: acc.url, sessione: acc.sessione ? { profilo: acc.sessione.profilo, scade: acc.sessione.scade } : null,
    coda: acc.coda.length + acc.lotti.reduce((n, l) => n + l.eventi.length, 0), vista: acc.vista ? acc.vista.nome : null })
};
