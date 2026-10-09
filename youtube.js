/* YouTube: i filmati dell'app sul proprio canale (v464). Prefisso `yt`.
 *
 * Chi registra una CosmoStoria, una demo o un minuto di planetario si
 * trovava in mano un `.webm` da scaricare e poi caricare a mano su YouTube,
 * passando dal computer. Qui il filmato va dritto sul canale di chi usa
 * l'app: si collega l'account una volta (Impostazioni → Dati → Account
 * YouTube, o la linguetta YouTube delle Impostazioni dello Studio), e da lì
 * ogni filmato ha il suo tasto «YouTube» — nel pannello «Il tuo momento»,
 * nelle schede della Galleria, nelle schede delle CosmoStorie e in fondo
 * allo Studio («Registra e pubblica»), che gira la storia registrandola e a
 * fine corsa apre da solo la finestra di pubblicazione.
 *
 * **Niente server, quindi niente password e niente segreti.** L'app non ha
 * un backend, e il solo modo onesto di parlare con YouTube dal browser è
 * l'accesso di Google per le applicazioni web: lo script di Google
 * (`accounts.google.com/gsi/client`, caricato soltanto quando serve) apre la
 * sua finestra, chi usa l'app sceglie l'account e dice sì, e all'app arriva
 * un gettone che vale un'ora e soltanto per due cose — caricare video e
 * leggere il nome del canale. Il gettone sta **solo in memoria**: non va in
 * `localStorage`, non va nel backup, non va sul repository. Dopo un'ora, o
 * dopo un ricaricamento, il primo «Pubblica» ne chiede un altro: se il
 * permesso c'è già, la finestra di Google si apre e si chiude da sola.
 * In `localStorage` (`astrocal_youtube_v1`, fuori dal backup) restano solo
 * l'ID client scritto a mano, il nome del canale, le preferenze e gli ultimi
 * video pubblicati.
 *
 * **L'ID client.** Google vuole sapere quale progetto chiede il permesso:
 * è l'«ID client OAuth» di un progetto Google Cloud con la YouTube Data API
 * v3 accesa e l'indirizzo dell'app fra le origini autorizzate. Non è un
 * segreto. Chi pubblica l'app lo mette nella variabile di repository
 * `YOUTUBE_CLIENT_ID` (il deploy lo scrive in `config.js`); chi usa una
 * copia senza lo incolla nelle Impostazioni. I passi stanno nella guida
 * (`guida.html#youtube`) e, in breve, nel pannello.
 *
 * **Il caricamento** è quello «a riprese» di YouTube: una richiesta apre la
 * sessione coi dati del video (titolo, descrizione, tag, visibilità, se è
 * pensato per i bambini), poi il file parte con un `PUT` solo, seguito da una
 * barra. Se la rete cade a metà (un telefono che cambia cella), si chiede a
 * YouTube fin dove è arrivato e si riparte da lì, fino a `YT_TENTATIVI`
 * volte con pause crescenti. «Annulla» ferma tutto.
 *
 * **Due limiti di Google da sapere**, e il pannello li dice:
 *   - un progetto Google non ancora verificato da YouTube carica i video
 *     solo come **privati** (è una regola di YouTube per tutte le app nuove):
 *     si rendono pubblici a mano da YouTube Studio;
 *   - ogni progetto ha una quota di 10 000 unità al giorno e un caricamento
 *     ne costa circa 1 600: sei video al giorno, per tutti quelli che usano
 *     lo stesso ID client. Finita la quota, l'errore lo dice com'è.
 *
 * Prova: `node scripts/prova-youtube.js` (nel browser, con un Google finto).
 */
'use strict';

// ====================================================================
// 1. Costanti e stato
// ====================================================================

const YT_CHIAVE = 'astrocal_youtube_v1';
const YT_SCOPO_CARICA = 'https://www.googleapis.com/auth/youtube.upload';
const YT_SCOPO_LEGGI = 'https://www.googleapis.com/auth/youtube.readonly';
const YT_GIS_URL = 'https://accounts.google.com/gsi/client';
const YT_URL_CARICA = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const YT_URL_CANALE = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
const YT_PRIVACY = ['private', 'unlisted', 'public'];
// I limiti di YouTube: oltre, la richiesta torna indietro con un 400
const YT_TITOLO_MAX = 100;
const YT_DESCRIZIONE_MAX = 5000;
const YT_TAG_MAX = 480;
// «Scienza e tecnologia»: la categoria in cui YouTube mette l'astronomia
const YT_CATEGORIA = '28';
const YT_PUBBLICATI_MAX = 10;
const YT_TENTATIVI = 6;
const YT_GIS_ATTESA_MS = 15000;
// La forma di un ID client OAuth di Google: numero del progetto, trattino,
// codice, e il dominio fisso. Uno sbagliato lo si dice subito, prima che
// Google risponda con una pagina d'errore dentro la sua finestra.
const YT_CLIENT_VALIDO = /^[0-9]{5,}-[a-z0-9]{8,}\.apps\.googleusercontent\.com$/i;
// La registrazione chiesta da «Registra e pubblica» apre la finestra solo se
// arriva entro questo tempo: una storia lunga più di tre ore non esiste, e un
// filmato fatto a mano il giorno dopo non è quello.
const YT_DOPO_MAX_MS = 3 * 3600 * 1000;
// v465: il filmato si controlla prima di aprire la finestra. Meno di un
// kilobyte è un registratore che non ha scritto niente; il resto lo dice il
// browser aprendolo (immagine, durata). Oltre YT_CONTROLLO_MS senza risposta
// non lo si dichiara guasto: si apre la finestra dicendo che non si è potuto
// controllare, e chi pubblica lo guarda nell'anteprima.
const YT_FILE_MIN = 1024;
const YT_CONTROLLO_MS = 12000;

const yt = {
  token: '', scade: 0,     // il gettone di Google, solo in memoria
  gis: null,               // la promessa del caricamento dello script di Google
  client: null, clientPer: '',
  attesa: null,            // { ok, ko } della richiesta di gettone in corso
  lavoro: null,            // il caricamento in corso
  pannelli: new Set(),     // dove `ytPannello` ha disegnato
  conta: 0,                // per gli `id` dei campi, unici anche con due pannelli
  messaggio: '', tipoMessaggio: '',
  finestra: null,          // la finestra di pubblicazione aperta
  dopo: null,              // «Registra e pubblica»: la registrazione attesa
  controllo: null          // v465: il controllo del filmato in corso (l'ultimo vince)
};

const ytT = (k, dati) => (typeof astroI18n === 'object' && astroI18n.t) ? astroI18n.t('yt.' + k, dati) : k;

// ====================================================================
// 2. Le impostazioni (localStorage, fuori dal backup)
// ====================================================================

function ytImpostazioni() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(YT_CHIAVE) || 'null'); } catch (_) { o = null; }
  if (!o || typeof o !== 'object') o = {};
  const testo = (x, max) => typeof x === 'string' ? x.slice(0, max) : '';
  const c = o.canale && typeof o.canale === 'object' ? o.canale : null;
  return {
    clientId: testo(o.clientId, 200).trim(),
    collegato: o.collegato === true,
    canale: c && typeof c.id === 'string' && c.id ? {
      id: testo(c.id, 80), titolo: testo(c.titolo, 200),
      // solo un indirizzo https di Google: è un'immagine messa nella pagina
      miniatura: /^https:\/\/[a-z0-9.-]*(ggpht|googleusercontent|ytimg)\.com\//i.test(c.miniatura || '') ? c.miniatura : ''
    } : null,
    privacy: YT_PRIVACY.includes(o.privacy) ? o.privacy : 'private',
    bambini: o.bambini === true,
    pubblicati: (Array.isArray(o.pubblicati) ? o.pubblicati : [])
      .filter(v => v && /^[A-Za-z0-9_-]{6,20}$/.test(v.id || ''))
      .map(v => ({ id: v.id, titolo: testo(v.titolo, YT_TITOLO_MAX), quando: Number(v.quando) || 0, privacy: YT_PRIVACY.includes(v.privacy) ? v.privacy : 'private' }))
      .slice(0, YT_PUBBLICATI_MAX)
  };
}

function ytSalvaImpostazioni(campi) {
  try {
    localStorage.setItem(YT_CHIAVE, JSON.stringify(Object.assign(ytImpostazioni(), campi)));
    return true;
  } catch (_) { return false; }
}

// Quello scritto a mano vince su quello del deploy: chi lo incolla ha un
// motivo (il suo progetto, la sua quota)
function ytClientId() {
  return ytImpostazioni().clientId || String((typeof window !== 'undefined' && window.YOUTUBE_CLIENT_ID) || '').trim();
}
const ytClientDelDeploy = () => !!String((typeof window !== 'undefined' && window.YOUTUBE_CLIENT_ID) || '').trim();
const ytCollegato = () => ytImpostazioni().collegato;
const ytGettoneValido = () => !!yt.token && Date.now() < yt.scade - 60000;

// ====================================================================
// 3. Gli errori, con un nome per ognuno
// ====================================================================

function ytErrore(codice, dettaglio) {
  const e = new Error(codice);
  e.codice = codice;
  e.dettaglio = dettaglio || '';
  return e;
}

// La risposta d'errore di Google ha `error.errors[0].reason`: è lì che sta
// la differenza fra «quota finita», «niente canale» e «gettone scaduto»
function ytErroreDaRisposta(stato, json) {
  const err = json && json.error && typeof json.error === 'object' ? json.error : {};
  const motivo = (Array.isArray(err.errors) && err.errors[0] && err.errors[0].reason) || '';
  const msg = String(err.message || '');
  let codice = 'servizio';
  if (stato === 401) codice = 'scaduto';
  else if (motivo === 'quotaExceeded' || motivo === 'dailyLimitExceeded' || motivo === 'rateLimitExceeded') codice = 'quota';
  else if (motivo === 'uploadLimitExceeded') codice = 'limite';
  else if (motivo === 'youtubeSignupRequired' || motivo === 'channelNotFound') codice = 'senzaCanale';
  else if (motivo === 'accessNotConfigured' || /has not been used|is disabled/i.test(msg)) codice = 'api';
  else if (motivo === 'insufficientPermissions' || motivo === 'forbidden' || /scope/i.test(msg)) codice = 'permessi';
  else if (motivo === 'invalidTitle') codice = 'titolo';
  else if (motivo === 'invalidDescription') codice = 'descrizione';
  else if (motivo === 'invalidTags') codice = 'tag';
  return ytErrore(codice, (msg ? msg + ' ' : '') + '(' + stato + (motivo ? ', ' + motivo : '') + ')');
}

function ytTestoErrore(e) {
  const codice = e && e.codice ? e.codice : 'servizio';
  const dettaglio = (e && (e.dettaglio || (e.codice ? '' : e.message))) || '';
  return ytT('errore.' + codice, { dettaglio });
}

// ====================================================================
// 4. L'accesso di Google: lo script, il gettone, il canale
// ====================================================================

function ytCaricaGoogle() {
  const g = typeof window !== 'undefined' && window.google && window.google.accounts && window.google.accounts.oauth2;
  if (g) return Promise.resolve(g);
  if (yt.gis) return yt.gis;
  yt.gis = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = YT_GIS_URL;
    s.async = true;
    const timer = setTimeout(() => ko(ytErrore('google')), YT_GIS_ATTESA_MS);
    s.onload = () => {
      clearTimeout(timer);
      const o = window.google && window.google.accounts && window.google.accounts.oauth2;
      if (o) ok(o); else ko(ytErrore('google'));
    };
    s.onerror = () => { clearTimeout(timer); ko(ytErrore('google')); };
    document.head.appendChild(s);
  });
  yt.gis.catch(() => { yt.gis = null; });
  return yt.gis;
}

// Lo script di Google si scarica in anticipo, appena si vede un tasto che
// lo userà: la sua finestra si apre solo dentro al tocco che la chiede, e un
// tocco che deve prima aspettare la rete non è più un tocco per il browser
function ytPreparaGoogle() {
  if (!YT_CLIENT_VALIDO.test(ytClientId())) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  ytCaricaGoogle().catch(() => { /* lo si dirà al tocco */ });
}

function ytChiediGettone(consenso) {
  const id = ytClientId();
  if (!YT_CLIENT_VALIDO.test(id)) return Promise.reject(ytErrore('client'));
  const chiedi = oauth => new Promise((ok, ko) => {
    if (!yt.client || yt.clientPer !== id) {
      yt.client = oauth.initTokenClient({
        client_id: id,
        scope: YT_SCOPO_CARICA + ' ' + YT_SCOPO_LEGGI,
        callback: r => {
          const a = yt.attesa;
          yt.attesa = null;
          if (!a) return;
          if (r && r.error) { a.ko(ytErrore(r.error === 'access_denied' ? 'negato' : 'servizio', r.error_description || r.error)); return; }
          // Google lascia togliere la spunta a un permesso: senza quello
          // del caricamento il gettone non serve a niente
          const tutti = typeof oauth.hasGrantedAllScopes === 'function' ? oauth.hasGrantedAllScopes(r, YT_SCOPO_CARICA) : true;
          if (!r || !r.access_token || !tutti) { a.ko(ytErrore('permessi')); return; }
          yt.token = r.access_token;
          yt.scade = Date.now() + (Number(r.expires_in) || 3600) * 1000;
          a.ok(yt.token);
        },
        error_callback: e => {
          const a = yt.attesa;
          yt.attesa = null;
          if (a) a.ko(ytErrore(e && e.type === 'popup_failed_to_open' ? 'popup' : 'chiuso'));
        }
      });
      yt.clientPer = id;
    }
    if (yt.attesa) yt.attesa.ko(ytErrore('chiuso'));
    yt.attesa = { ok, ko };
    try { yt.client.requestAccessToken({ prompt: consenso ? 'consent' : '' }); }
    catch (e) { yt.attesa = null; ko(ytErrore('google', e && e.message)); }
  });
  const g = window.google && window.google.accounts && window.google.accounts.oauth2;
  return g ? chiedi(g) : ytCaricaGoogle().then(chiedi);
}

const ytGettone = () => ytGettoneValido() ? Promise.resolve(yt.token) : ytChiediGettone(false);

async function ytLeggiCanale(token) {
  const r = await fetch(YT_URL_CANALE, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw ytErroreDaRisposta(r.status, j);
  const c = Array.isArray(j.items) ? j.items[0] : null;
  if (!c || !c.id) throw ytErrore('senzaCanale');
  const sn = c.snippet || {}, mini = sn.thumbnails && (sn.thumbnails.default || sn.thumbnails.medium);
  return { id: String(c.id), titolo: String(sn.title || ''), miniatura: mini && mini.url ? String(mini.url) : '' };
}

// Collegare: la finestra di Google col consenso, poi il nome del canale.
// Un account Google senza canale non può caricare: lo si dice qui, non al
// primo video.
async function ytCollega() {
  ytMessaggio(ytT('collego'), '');
  try {
    const token = await ytChiediGettone(true);
    let canale = null;
    try { canale = await ytLeggiCanale(token); }
    catch (e) { if (e.codice === 'senzaCanale' || e.codice === 'api') throw e; }
    ytSalvaImpostazioni({ collegato: true, canale });
    ytMessaggio(canale ? ytT('collegatoA', { canale: canale.titolo }) : ytT('collegato'), 'ok');
    return true;
  } catch (e) {
    ytMessaggio(ytTestoErrore(e), 'errore');
    return false;
  } finally { ytRidisegna(); }
}

function ytScollega() {
  const token = yt.token;
  yt.token = ''; yt.scade = 0;
  if (token) {
    try { window.google.accounts.oauth2.revoke(token, () => {}); } catch (_) { /* basta dimenticarlo */ }
  }
  ytSalvaImpostazioni({ collegato: false, canale: null });
  ytMessaggio(ytT('scollegato'), '');
  ytRidisegna();
}

// ====================================================================
// 5. Il caricamento a riprese
// ====================================================================

const ytSenzaParentesi = s => String(s || '').replace(/[<>]/g, '');

// I dati del video come li vuole YouTube, già dentro ai suoi limiti
function ytMetadati(campi) {
  const lingua = typeof astroI18n === 'object' && astroI18n.lingua ? astroI18n.lingua() : 'it';
  const titolo = ytSenzaParentesi(campi.titolo).replace(/\s+/g, ' ').trim().slice(0, YT_TITOLO_MAX) || ytT('titoloSerie');
  const tag = [];
  let lunghezza = 0;
  for (const x of String(campi.tag || '').split(',')) {
    const v = ytSenzaParentesi(x).replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!v || tag.includes(v)) continue;
    if (lunghezza + v.length + 1 > YT_TAG_MAX) break;
    tag.push(v);
    lunghezza += v.length + 1;
  }
  return {
    snippet: {
      title: titolo,
      description: ytSenzaParentesi(campi.descrizione).slice(0, YT_DESCRIZIONE_MAX),
      tags: tag,
      categoryId: YT_CATEGORIA,
      defaultLanguage: lingua,
      defaultAudioLanguage: lingua
    },
    status: {
      privacyStatus: YT_PRIVACY.includes(campi.privacy) ? campi.privacy : 'private',
      selfDeclaredMadeForKids: !!campi.bambini,
      embeddable: true
    }
  };
}

async function ytApriSessione(token, video, meta) {
  const r = await fetch(YT_URL_CARICA, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(video.blob.size),
      'X-Upload-Content-Type': video.tipo
    },
    body: JSON.stringify(meta)
  });
  if (!r.ok) throw ytErroreDaRisposta(r.status, await r.json().catch(() => ({})));
  const sessione = r.headers.get('Location');
  if (!sessione) throw ytErrore('sessione');
  return sessione;
}

// Un pezzo di file, da `da` alla fine. Risolve con il video finito, oppure
// con `{ interrotto: true }` quando la rete o YouTube (5xx) si sono fermati
// a metà: lì si riprende. Gli altri errori sono veri e si dicono.
function ytInvia(sessione, token, video, da, lavoro, avanzamento) {
  return new Promise((ok, ko) => {
    const xhr = new XMLHttpRequest();
    lavoro.xhr = xhr;
    xhr.open('PUT', sessione);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', video.tipo);
    const totale = video.blob.size;
    if (da > 0) xhr.setRequestHeader('Content-Range', `bytes ${da}-${totale - 1}/${totale}`);
    xhr.upload.onprogress = e => { if (e.lengthComputable && totale) avanzamento((da + e.loaded) / totale); };
    xhr.onload = () => {
      lavoro.xhr = null;
      let j = {};
      try { j = JSON.parse(xhr.responseText || '{}'); } catch (_) { j = {}; }
      if (xhr.status === 200 || xhr.status === 201) { ok({ fatto: j }); return; }
      if (xhr.status === 308 || xhr.status >= 500) { ok({ interrotto: true }); return; }
      ko(ytErroreDaRisposta(xhr.status, j));
    };
    xhr.onerror = xhr.ontimeout = () => { lavoro.xhr = null; ok({ interrotto: true }); };
    xhr.onabort = () => { lavoro.xhr = null; ko(ytErrore('annullato')); };
    xhr.send(da > 0 ? video.blob.slice(da) : video.blob);
  });
}

// Fin dove è arrivato YouTube: un `PUT` vuoto con `bytes */totale`. Se
// l'intestazione `Range` non si legge, si ricomincia da capo: è più lento,
// non sbagliato.
async function ytStatoSessione(sessione, token, totale) {
  try {
    const r = await fetch(sessione, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Range': `bytes */${totale}` } });
    if (r.status === 200 || r.status === 201) return { fatto: await r.json().catch(() => ({})) };
    const m = /bytes=0-(\d+)/.exec(r.headers.get('Range') || '');
    return { da: m ? Number(m[1]) + 1 : 0 };
  } catch (_) { return { da: 0 }; }
}

const ytAspetta = ms => new Promise(ok => setTimeout(ok, ms));

// Il caricamento intero. `video` = { blob, tipo }, `campi` quelli della
// finestra. Risolve con l'ID del video su YouTube.
async function ytPubblica(video, campi, avanzamento) {
  const lavoro = { annullato: false, xhr: null };
  yt.lavoro = lavoro;
  const fine = j => {
    const id = j && j.id ? String(j.id) : '';
    if (!id) throw ytErrore('servizio', JSON.stringify(j).slice(0, 120));
    const imp = ytImpostazioni();
    imp.pubblicati.unshift({ id, titolo: (j.snippet && j.snippet.title) || campi.titolo || '', quando: Date.now(),
      privacy: (j.status && j.status.privacyStatus) || campi.privacy });
    ytSalvaImpostazioni({ pubblicati: imp.pubblicati.slice(0, YT_PUBBLICATI_MAX), privacy: campi.privacy, bambini: !!campi.bambini });
    return { id, privacy: (j.status && j.status.privacyStatus) || campi.privacy };
  };
  try {
    let token = await ytGettone();
    const v = { blob: video.blob, tipo: video.tipo || video.blob.type || 'video/webm' };
    let sessione;
    try { sessione = await ytApriSessione(token, v, ytMetadati(campi)); }
    catch (e) {
      // un gettone che Google non riconosce più: uno nuovo, una volta sola
      if (e.codice !== 'scaduto') throw e;
      yt.token = ''; yt.scade = 0;
      token = await ytChiediGettone(false);
      sessione = await ytApriSessione(token, v, ytMetadati(campi));
    }
    let da = 0;
    for (let prova = 0; prova <= YT_TENTATIVI; prova++) {
      if (lavoro.annullato) throw ytErrore('annullato');
      const esito = await ytInvia(sessione, token, v, da, lavoro, avanzamento);
      if (esito.fatto) { avanzamento(1); return fine(esito.fatto); }
      if (prova === YT_TENTATIVI) break;
      avanzamento(da / v.blob.size, true);
      await ytAspetta(Math.min(16000, 1000 * 2 ** prova));
      if (lavoro.annullato) throw ytErrore('annullato');
      const stato = await ytStatoSessione(sessione, token, v.blob.size);
      if (stato.fatto) { avanzamento(1); return fine(stato.fatto); }
      da = Math.max(0, Math.min(v.blob.size - 1, stato.da || 0));
    }
    throw ytErrore('rete');
  } catch (e) {
    if (e && e.codice === 'scaduto') { yt.token = ''; yt.scade = 0; }
    throw e;
  } finally {
    if (yt.lavoro === lavoro) yt.lavoro = null;
  }
}

function ytAnnulla() {
  const l = yt.lavoro;
  if (!l) return;
  l.annullato = true;
  if (l.xhr) { try { l.xhr.abort(); } catch (_) { /* già chiuso */ } }
}

// ====================================================================
// 6. Il pannello del collegamento (Impostazioni e Studio)
// ====================================================================

// Un elemento del DOM coi suoi attributi: mai `innerHTML` coi testi, che
// qui sono anche di chi usa l'app (il titolo del canale, dei video)
function ytEl(tag, attributi, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of figli.flat()) if (f !== null && f !== undefined && f !== false) el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return el;
}
// Le icone dell'app (`icona` in app.js) sono SVG fissi, scritti da noi
function ytIcona(nome, misura) {
  const s = ytEl('span', { class: 'yt-icona', 'aria-hidden': 'true' });
  if (typeof icona === 'function') s.innerHTML = icona(nome, misura || 18);
  return s;
}

function ytMessaggio(testo, tipo) {
  yt.messaggio = testo || '';
  yt.tipoMessaggio = tipo || '';
}

function ytTestoVisibilita(p) { return ytT('privacy.' + p); }

function ytDisegnaPannello(box) {
  const imp = ytImpostazioni();
  const id = ytClientId();
  const valido = YT_CLIENT_VALIDO.test(id);
  const collegato = imp.collegato;
  const pezzi = [];
  // A che punto è
  pezzi.push(ytEl('p', { class: 'yt-stato' + (collegato ? ' ok' : '') },
    collegato && imp.canale && imp.canale.miniatura ? ytEl('img', { class: 'yt-miniatura', src: imp.canale.miniatura, alt: '', width: '28', height: '28', referrerpolicy: 'no-referrer' }) : null,
    ytEl('span', {}, collegato
      ? (imp.canale ? ytT('statoCanale', { canale: imp.canale.titolo }) : ytT('statoCollegato'))
      : ytT('statoNo'))));
  // L'ID client: solo se il deploy non l'ha messo, o se qualcuno l'ha scritto a mano
  if (!ytClientDelDeploy() || imp.clientId) {
    const n = ++yt.conta;
    const campo = ytEl('input', { type: 'text', class: 'yt-campo', id: 'yt-client-' + n, value: imp.clientId, spellcheck: 'false',
      autocomplete: 'off', placeholder: '123456789012-abc….apps.googleusercontent.com', 'aria-describedby': 'yt-client-aiuto-' + n });
    // `change` arriva anche col fuoco che se ne va mentre il pannello si
    // ridisegna (il campo esce dalla pagina): ridisegnare lì dentro vorrebbe
    // dire togliere nodi già tolti. Si fa al giro dopo.
    campo.addEventListener('change', () => setTimeout(() => {
      const v = campo.value.trim();
      if (v && !YT_CLIENT_VALIDO.test(v)) { ytMessaggio(ytT('errore.client'), 'errore'); ytRidisegna(); return; }
      // un altro progetto: il gettone di prima non vale più
      yt.token = ''; yt.scade = 0; yt.client = null;
      ytSalvaImpostazioni({ clientId: v, collegato: false, canale: null });
      ytMessaggio(v ? ytT('clientSalvato') : '', v ? 'ok' : '');
      ytRidisegna();
    }, 0));
    const passi = ytEl('ol', { class: 'yt-passi' });
    for (let n = 1; n <= 5; n++) passi.append(ytEl('li', {}, ytT('passo' + n, { origine: location.origin })));
    pezzi.push(ytEl('label', { class: 'yt-etichetta', for: campo.id }, ytT('clientEtichetta')), campo,
      ytEl('small', { class: 'yt-aiuto', id: 'yt-client-aiuto-' + n }, ytT('clientAiuto')),
      ytEl('details', { class: 'yt-come' }, ytEl('summary', {}, ytT('comeSiFa')), passi,
        ytEl('a', { href: 'guida.html#youtube', target: '_blank', rel: 'noopener' }, ytT('guida'))));
  }
  // I tasti
  const tasti = ytEl('div', { class: 'yt-tasti' });
  const collega = ytEl('button', { type: 'button', class: 'tasto-cielo' + (collegato ? '' : ' tasto-primario'), dataset: { yt: 'collega' }, disabled: !valido },
    ytIcona('pubblica', 16), ' ', ytT(collegato ? 'ricollega' : 'collega'));
  collega.addEventListener('pointerenter', ytPreparaGoogle);
  collega.addEventListener('focus', ytPreparaGoogle);
  collega.addEventListener('click', () => { ytCollega(); });
  tasti.append(collega);
  if (collegato) {
    tasti.append(ytEl('button', { type: 'button', class: 'tasto-cielo', dataset: { yt: 'scollega' }, onclick: ytScollega }, ytT('scollega')));
  }
  pezzi.push(tasti);
  // Le preferenze dei video nuovi
  const vis = ytEl('select', { class: 'yt-campo yt-visibilita', 'aria-label': ytT('visibilitaSerie') });
  for (const p of YT_PRIVACY) vis.append(new Option(ytTestoVisibilita(p), p, false, p === imp.privacy));
  vis.addEventListener('change', () => ytSalvaImpostazioni({ privacy: vis.value }));
  const bambini = ytEl('input', { type: 'checkbox', checked: imp.bambini });
  bambini.addEventListener('change', () => ytSalvaImpostazioni({ bambini: bambini.checked }));
  pezzi.push(ytEl('div', { class: 'yt-preferenze' },
    ytEl('label', { class: 'yt-etichetta' }, ytT('visibilitaSerie'), vis),
    ytEl('label', { class: 'yt-spunta' }, bambini, ' ', ytT('bambini'))));
  // Il messaggio dell'ultimo gesto
  pezzi.push(ytEl('p', { class: 'yt-messaggio' + (yt.tipoMessaggio ? ' ' + yt.tipoMessaggio : ''), role: 'status', 'aria-live': 'polite' }, yt.messaggio));
  // Gli ultimi video pubblicati da qui
  if (imp.pubblicati.length) {
    const lista = ytEl('ul', { class: 'yt-pubblicati' });
    const loc = typeof astroI18n === 'object' && astroI18n.locale ? astroI18n.locale() : 'it-IT';
    for (const v of imp.pubblicati) {
      let quando = '';
      try { quando = new Date(v.quando).toLocaleDateString(loc); } catch (_) { quando = ''; }
      lista.append(ytEl('li', {}, ytEl('a', { href: 'https://youtu.be/' + v.id, target: '_blank', rel: 'noopener' }, v.titolo || v.id),
        ytEl('small', {}, ' · ' + quando + ' · ' + ytTestoVisibilita(v.privacy))));
    }
    pezzi.push(ytEl('h5', { class: 'yt-sottotitolo' }, ytT('ultimi')), lista);
  }
  // Che cosa vede l'app, come si toglie, e il limite dei progetti nuovi
  pezzi.push(ytEl('p', { class: 'yt-nota' }, ytT('notaPrivacy'), ' ',
    ytEl('a', { href: 'https://myaccount.google.com/permissions', target: '_blank', rel: 'noopener' }, ytT('togliAccesso'))),
  ytEl('p', { class: 'yt-nota' }, ytT('notaPrivati')));
  box.replaceChildren(ytEl('div', { class: 'yt-pannello' }, pezzi));
}

// Disegna (e ridisegna, a ogni cambio) il pannello dentro a `box`
function ytPannello(box) {
  if (!box) return;
  yt.pannelli.add(box);
  ytDisegnaPannello(box);
}

function ytRidisegna() {
  for (const box of [...yt.pannelli]) {
    if (!box.isConnected) { yt.pannelli.delete(box); continue; }
    ytDisegnaPannello(box);
  }
  if (yt.finestra) ytDisegnaFinestra();
  // lo Studio rifà la sua linguetta, che dice «collegato» o no
  try { window.dispatchEvent(new CustomEvent('astrocal:youtube')); } catch (_) { /* vecchi browser */ }
}

// ====================================================================
// 7. La finestra di pubblicazione
// ====================================================================

const ytPeso = n => {
  const mb = n / (1024 * 1024);
  const fmt = (x, c) => typeof astroI18n === 'object' && astroI18n.locale
    ? x.toLocaleString(astroI18n.locale(), { maximumFractionDigits: c }) : x.toFixed(c);
  return mb >= 1 ? fmt(mb, 1) + ' MB' : fmt(Math.max(1, Math.round(n / 1024)), 0) + ' kB';
};

/* Il controllo del filmato (v465). Chi preme YouTube vuole essere sicuro
 * che quello che parte sia il filmato giusto e intero: prima la finestra si
 * apriva su qualsiasi cosa il registratore avesse lasciato, anche un file
 * vuoto o rotto, e lo si scopriva su YouTube («elaborazione non riuscita»).
 * Qui il browser lo apre come lo aprirebbe un lettore: deve avere
 * un'immagine (larghezza e altezza) e una durata. I webm del registratore
 * non scrivono la durata: la si fa calcolare saltando in fondo. Risolve con
 * { ok, motivo, durata, larghezza, altezza, avviso }. */
function ytControllaVideo(blob) {
  return new Promise(fine => {
    if (!blob || !(blob.size >= YT_FILE_MIN)) { fine({ ok: false, motivo: 'vuoto' }); return; }
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      fine({ ok: true, durata: 0, larghezza: 0, altezza: 0, avviso: 'nonControllato' }); return;
    }
    const v = document.createElement('video');
    const url = URL.createObjectURL(blob);
    let finito = false;
    const chiudi = esito => {
      if (finito) return;
      finito = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      try { v.load(); } catch (_) { /* niente */ }
      URL.revokeObjectURL(url);
      fine(esito);
    };
    const misura = () => {
      if (!Number.isFinite(v.duration)) return false;
      if (!(v.videoWidth > 0 && v.videoHeight > 0)) chiudi({ ok: false, motivo: 'senzaImmagine' });
      else if (!(v.duration > 0.2)) chiudi({ ok: false, motivo: 'troppoCorto' });
      else chiudi({ ok: true, durata: v.duration, larghezza: v.videoWidth, altezza: v.videoHeight });
      return true;
    };
    const timer = setTimeout(() => chiudi({ ok: true, durata: 0, larghezza: v.videoWidth || 0, altezza: v.videoHeight || 0, avviso: 'nonControllato' }), YT_CONTROLLO_MS);
    v.muted = true;
    v.preload = 'metadata';
    v.playsInline = true;
    v.addEventListener('loadedmetadata', () => {
      if (misura()) return;
      v.addEventListener('durationchange', misura);
      v.addEventListener('timeupdate', misura);
      try { v.currentTime = 1e7; } catch (_) { /* il browser non salta: aspetta il tempo massimo */ }
    }, { once: true });
    v.addEventListener('error', () => chiudi({ ok: false, motivo: 'illeggibile' }), { once: true });
    v.src = url;
  });
}

// «4:08», «1:02:05»
function ytDurata(s) {
  const n = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(n / 3600), m = Math.floor(n / 60) % 60, ss = String(n % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
// La qualità con cui YouTube lo mostrerà: dal lato corto
function ytQualita(l, a) {
  const corto = Math.min(l, a);
  return corto >= 2160 ? '4K' : corto >= 1440 ? '1440p' : corto >= 1080 ? '1080p' : corto >= 720 ? '720p' : corto + 'p';
}

// I filmati dei pannelli «Il tuo momento» girano in ciclo sotto alla
// finestra: con l'anteprima di qui sarebbero due filmati insieme, uno
// coperto. Si fermano finché la finestra è aperta.
function ytFermaAnteprimeSotto() {
  if (typeof document === 'undefined') return;
  for (const v of document.querySelectorAll('[id$="-clip-anteprima"] video')) { try { v.pause(); } catch (_) { /* niente */ } }
}

// `video` = { blob, nome, tipo, titolo, origine }. Il titolo proposto è
// quello della storia registrata, se c'è; la descrizione dice da dove viene.
// v465: prima si controlla il filmato (`ytControllaVideo`), poi si apre la
// finestra, con l'anteprima da guardare prima di pubblicare; se il file è
// guasto la finestra lo dice e non lo pubblica.
function ytApriPubblica(video) {
  if (!video || !video.blob || typeof document === 'undefined') return false;
  if (yt.finestra) ytChiudiFinestra(true);
  const turno = yt.controllo = { ritorno: document.activeElement };
  ytPreparaGoogle();
  ytControllaVideo(video.blob).then(esame => {
    if (yt.controllo !== turno) return;
    yt.controllo = null;
    ytMostraPubblica(video, esame, turno.ritorno);
  });
  return true;
}

function ytMostraPubblica(video, esame, ritorno) {
  if (yt.finestra) ytChiudiFinestra(true);
  const imp = ytImpostazioni();
  const titolo = String(video.titolo || '').trim();
  yt.finestra = {
    video: { blob: video.blob, nome: String(video.nome || 'video.webm'), tipo: video.tipo || video.blob.type || 'video/webm' },
    esame: esame || { ok: true },
    url: URL.createObjectURL(video.blob),
    anteprima: null,
    campi: {
      titolo: (titolo || ytT('titoloSerie')).slice(0, YT_TITOLO_MAX),
      descrizione: ytT('descrizioneSerie', { titolo: titolo || ytT('titoloSerie') }),
      tag: ytT('tagSerie'),
      privacy: imp.privacy,
      bambini: imp.bambini
    },
    stato: esame && esame.ok === false ? 'guasto' : 'pronto', quota: 0, esito: '', tipoEsito: '', risultato: null,
    ritorno: ritorno || document.activeElement, el: null
  };
  ytFermaAnteprimeSotto();
  ytDisegnaFinestra();
  const primo = yt.finestra.el.querySelector('[data-yt-campo="titolo"], [data-yt="collega"], [data-yt="chiudi"]');
  if (primo) { try { primo.focus({ preventScroll: true }); } catch (_) { primo.focus(); } }
  return true;
}

function ytChiudiFinestra(forza) {
  const f = yt.finestra;
  if (!f) return;
  if (f.stato === 'invio' && !forza) return;
  if (f.stato === 'invio') ytAnnulla();
  yt.finestra = null;
  if (f.anteprima) { try { f.anteprima.pause(); } catch (_) { /* niente */ } f.anteprima.removeAttribute('src'); }
  if (f.url) URL.revokeObjectURL(f.url);
  if (f.el) f.el.remove();
  document.removeEventListener('keydown', ytTastiFinestra, true);
  if (f.ritorno && f.ritorno.isConnected && f.ritorno.focus) { try { f.ritorno.focus({ preventScroll: true }); } catch (_) { /* niente */ } }
}

function ytTastiFinestra(e) {
  const f = yt.finestra;
  if (!f || !f.el) return;
  if (e.key === 'Escape' && f.stato !== 'invio') { e.preventDefault(); e.stopPropagation(); ytChiudiFinestra(); return; }
  // il fuoco gira dentro alla finestra (è modale)
  if (e.key === 'Tab') {
    const tutti = [...f.el.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')]
      .filter(x => x.offsetParent !== null);
    if (!tutti.length) return;
    const primo = tutti[0], ultimo = tutti[tutti.length - 1];
    if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  }
}

function ytAggiornaBarra(quota, ripresa) {
  const f = yt.finestra;
  if (!f) return;
  f.quota = Math.max(0, Math.min(1, quota || 0));
  if (!f.el) return;
  const barra = f.el.querySelector('.yt-barra');
  const testo = f.el.querySelector('.yt-barra-testo');
  const pc = Math.round(f.quota * 100);
  if (barra) barra.value = pc;
  if (testo) testo.textContent = ripresa ? ytT('riprendo', { n: pc }) : ytT('carico', { n: pc });
}

async function ytAvviaPubblicazione() {
  const f = yt.finestra;
  if (!f || f.stato === 'invio') return;
  f.stato = 'invio'; f.quota = 0; f.esito = ''; f.tipoEsito = '';
  ytDisegnaFinestra();
  try {
    const r = await ytPubblica(f.video, f.campi, ytAggiornaBarra);
    if (yt.finestra !== f) return;
    f.stato = 'fatto'; f.risultato = r;
    f.esito = r.privacy === 'private' && f.campi.privacy !== 'private' ? ytT('fattoPrivato') : ytT('fatto');
    f.tipoEsito = 'ok';
  } catch (e) {
    if (yt.finestra !== f) return;
    f.stato = 'pronto';
    f.esito = ytTestoErrore(e);
    f.tipoEsito = e && e.codice === 'annullato' ? '' : 'errore';
    // un gettone negato o scaduto: il collegamento va rifatto
    if (e && (e.codice === 'scaduto' || e.codice === 'permessi')) ytSalvaImpostazioni({ collegato: false });
  }
  ytDisegnaFinestra();
  ytRidisegna();
}

function ytDisegnaFinestra() {
  const f = yt.finestra;
  if (!f) return;
  const imp = ytImpostazioni();
  const valido = YT_CLIENT_VALIDO.test(ytClientId());
  const invio = f.stato === 'invio', fatto = f.stato === 'fatto', guasto = f.stato === 'guasto';
  // Dove sta il fuoco, per rimetterlo dopo il ridisegno
  const attivo = f.el && f.el.contains(document.activeElement) ? document.activeElement : null;
  const fuoco = attivo ? (attivo.dataset.ytCampo ? 'c:' + attivo.dataset.ytCampo : attivo.dataset.yt ? 'b:' + attivo.dataset.yt + ':' + (attivo.dataset.valore || '') : '') : '';

  const corpo = ytEl('div', { class: 'yt-corpo' });
  // v465: il filmato da guardare prima di pubblicarlo, con la misura e la
  // durata che il file dice davvero. Un elemento solo per tutta la vita della
  // finestra: ridisegnando (una scelta di visibilità, la lingua) non riparte
  const es = f.esame || {};
  if (!guasto) {
    if (!f.anteprima) {
      f.anteprima = ytEl('video', { class: 'yt-anteprima', controls: true, playsinline: true, preload: 'metadata', src: f.url });
    }
    f.anteprima.setAttribute('aria-label', ytT('anteprima'));
    corpo.append(f.anteprima);
  }
  const dettagli = [f.video.nome, ytPeso(f.video.blob.size)];
  if (es.larghezza > 0 && es.altezza > 0) dettagli.push(`${es.larghezza} × ${es.altezza} (${ytQualita(es.larghezza, es.altezza)})`);
  if (es.durata > 0) dettagli.push(ytDurata(es.durata));
  corpo.append(ytEl('p', { class: 'yt-file' }, dettagli.join(' · ')));
  if (es.avviso) corpo.append(ytEl('p', { class: 'yt-nota' }, ytT('controllo.' + es.avviso)));
  if (guasto) {
    corpo.append(ytEl('p', { class: 'yt-messaggio errore', role: 'alert' }, ytT('controllo.' + (es.motivo || 'illeggibile'))));
  } else if (!imp.collegato) {
    // Non ancora collegato: il collegamento si fa da qui, senza uscire
    const box = ytEl('div', { class: 'yt-collega-qui' });
    corpo.append(box);
    ytDisegnaPannello(box);
  } else {
    corpo.append(ytEl('p', { class: 'yt-canale' },
      imp.canale && imp.canale.miniatura ? ytEl('img', { class: 'yt-miniatura', src: imp.canale.miniatura, alt: '', width: '28', height: '28', referrerpolicy: 'no-referrer' }) : null,
      ytEl('span', {}, imp.canale ? ytT('sulCanale', { canale: imp.canale.titolo }) : ytT('statoCollegato'))));
  }
  if (!fatto && !guasto) {
    const titolo = ytEl('input', { type: 'text', class: 'yt-campo', id: 'yt-f-titolo', maxlength: String(YT_TITOLO_MAX), value: f.campi.titolo, dataset: { ytCampo: 'titolo' }, disabled: invio });
    const conta = ytEl('small', { class: 'yt-conta' }, `${f.campi.titolo.length}/${YT_TITOLO_MAX}`);
    titolo.addEventListener('input', () => { f.campi.titolo = titolo.value; conta.textContent = `${titolo.value.length}/${YT_TITOLO_MAX}`; });
    const descr = ytEl('textarea', { class: 'yt-campo', id: 'yt-f-descr', rows: '4', maxlength: String(YT_DESCRIZIONE_MAX), dataset: { ytCampo: 'descrizione' }, disabled: invio });
    descr.value = f.campi.descrizione;
    descr.addEventListener('input', () => { f.campi.descrizione = descr.value; });
    const tag = ytEl('input', { type: 'text', class: 'yt-campo', id: 'yt-f-tag', value: f.campi.tag, dataset: { ytCampo: 'tag' }, disabled: invio });
    tag.addEventListener('input', () => { f.campi.tag = tag.value; });
    const vis = ytEl('div', { class: 'yt-scelte', role: 'group', 'aria-label': ytT('visibilita') });
    for (const p of YT_PRIVACY) {
      vis.append(ytEl('button', { type: 'button', class: 'yt-scelta', 'aria-pressed': String(f.campi.privacy === p), dataset: { yt: 'privacy', valore: p }, disabled: invio,
        onclick: () => { f.campi.privacy = p; ytDisegnaFinestra(); } },
        ytEl('strong', {}, ytTestoVisibilita(p)), ytEl('small', {}, ytT('privacyAiuto.' + p))));
    }
    const bambini = ytEl('input', { type: 'checkbox', checked: f.campi.bambini, dataset: { ytCampo: 'bambini' }, disabled: invio });
    bambini.addEventListener('change', () => { f.campi.bambini = bambini.checked; });
    corpo.append(
      ytEl('label', { class: 'yt-etichetta', for: 'yt-f-titolo' }, ytT('titolo'), conta), titolo,
      ytEl('label', { class: 'yt-etichetta', for: 'yt-f-descr' }, ytT('descrizione')), descr,
      ytEl('label', { class: 'yt-etichetta', for: 'yt-f-tag' }, ytT('tag')), tag,
      ytEl('span', { class: 'yt-etichetta' }, ytT('visibilita')), vis,
      ytEl('label', { class: 'yt-spunta' }, bambini, ' ', ytT('bambini')),
      ytEl('p', { class: 'yt-nota' }, ytT('notaPrivati')));
  }
  if (invio) {
    corpo.append(ytEl('div', { class: 'yt-avanzamento' },
      ytEl('progress', { class: 'yt-barra', max: '100', value: String(Math.round(f.quota * 100)), 'aria-label': ytT('avanzamento') }),
      ytEl('span', { class: 'yt-barra-testo', 'aria-live': 'polite' }, ytT('carico', { n: Math.round(f.quota * 100) }))));
  }
  if (f.esito) corpo.append(ytEl('p', { class: 'yt-messaggio' + (f.tipoEsito ? ' ' + f.tipoEsito : ''), role: 'status' }, f.esito));
  const azioni = ytEl('div', { class: 'yt-azioni' });
  if (fatto) {
    const link = 'https://youtu.be/' + f.risultato.id;
    azioni.append(
      ytEl('a', { class: 'tasto-cielo tasto-primario', href: link, target: '_blank', rel: 'noopener', dataset: { yt: 'apri' } }, ytT('apri')),
      ytEl('a', { class: 'tasto-cielo', href: 'https://studio.youtube.com/video/' + f.risultato.id + '/edit', target: '_blank', rel: 'noopener' }, ytT('studio')),
      ytEl('button', { type: 'button', class: 'tasto-cielo', dataset: { yt: 'copia' }, onclick: async (e) => {
        const b = e.currentTarget;
        try { await navigator.clipboard.writeText(link); b.textContent = ytT('copiato'); }
        catch (_) { b.textContent = link; }
      } }, ytT('copia')),
      ytEl('button', { type: 'button', class: 'tasto-cielo', dataset: { yt: 'chiudi' }, onclick: () => ytChiudiFinestra() }, ytT('chiudi')));
  } else if (invio) {
    azioni.append(ytEl('button', { type: 'button', class: 'tasto-cielo', dataset: { yt: 'annulla' }, onclick: ytAnnulla }, ytT('annulla')));
  } else if (guasto) {
    // Il file guasto non parte: lo si può ancora scaricare per guardarlo
    azioni.append(
      ytEl('a', { class: 'tasto-cielo', href: f.url, download: f.video.nome, dataset: { yt: 'scarica' } }, ytT('scarica')),
      ytEl('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { yt: 'chiudi' }, onclick: () => ytChiudiFinestra() }, ytT('chiudi')));
  } else {
    azioni.append(
      ytEl('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { yt: 'pubblica' }, disabled: !imp.collegato || !valido,
        onpointerenter: ytPreparaGoogle, onclick: ytAvviaPubblicazione }, ytIcona('pubblica', 16), ' ', ytT('pubblica')),
      ytEl('button', { type: 'button', class: 'tasto-cielo', dataset: { yt: 'chiudi' }, onclick: () => ytChiudiFinestra() }, ytT('chiudi')));
  }
  corpo.append(azioni);

  const finestra = ytEl('div', { class: 'yt-finestra' },
    ytEl('div', { class: 'yt-testa' },
      ytEl('h2', { id: 'yt-finestra-titolo' }, ytIcona('pubblica', 20), ' ', ytT('titoloFinestra')),
      ytEl('button', { type: 'button', class: 'yt-x', dataset: { yt: 'x' }, 'aria-label': ytT('chiudi'), title: ytT('chiudi'), disabled: invio, onclick: () => ytChiudiFinestra() },
        ytEl('span', { 'aria-hidden': 'true' }, '×'))),
    corpo);
  if (!f.el) {
    f.el = ytEl('div', { class: 'yt-velo', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'yt-finestra-titolo', id: 'yt-finestra' });
    // un tocco sul velo, fuori dalla finestra, la chiude (non durante l'invio)
    f.el.addEventListener('mousedown', e => { if (e.target === f.el) ytChiudiFinestra(); });
    const fe = document.fullscreenElement;
    (fe && fe !== document.documentElement ? fe : document.body).append(f.el);
    document.addEventListener('keydown', ytTastiFinestra, true);
  }
  f.el.replaceChildren(finestra);
  if (fuoco) {
    const [cosa, a, b] = fuoco.split(':');
    const el = cosa === 'c' ? f.el.querySelector(`[data-yt-campo="${a}"]`)
      : f.el.querySelector(`[data-yt="${a}"]${b ? `[data-valore="${b}"]` : ''}`);
    if (el && !el.disabled) el.focus();
    else if (invio) { const an = f.el.querySelector('[data-yt="annulla"]'); if (an) an.focus(); }
  } else if (fatto) {
    const ap = f.el.querySelector('[data-yt="apri"]');
    if (ap) ap.focus();
  }
}

// ====================================================================
// 8. «Registra e pubblica»: una storia che finisce dritta su YouTube
// ====================================================================

// Gira il copione registrandolo (solo per questa volta: l'opzione delle
// demo resta com'era) e, quando il filmato è pronto, apre la finestra di
// pubblicazione col titolo della storia. Il filmato arriva al pannello del
// planetario (`skyRegMostraEsito`), che chiama `ytDopoRegistrazione`.
function ytRegistraEPubblica(testo, titolo) {
  const demo = typeof window !== 'undefined' ? window.AstroDemo : null;
  if (!demo || typeof demo.avvia !== 'function') return false;
  yt.dopo = { titolo: String(titolo || ''), scade: Date.now() + YT_DOPO_MAX_MS };
  ytPreparaGoogle();
  // v465: per YouTube il filmato è a risoluzione piena e senza data e luogo
  // (`perYoutube`, in `skyRegPreparaTela` e `skyRegFirma`), e la storia a
  // tutto schermo, perché la tela prende la misura della finestra
  try { demo.avvia(testo, { registra: true, perYoutube: true, schermoIntero: true }); }
  catch (e) { yt.dopo = null; throw e; }
  if (!demo.inCorso) yt.dopo = null;
  return !!yt.dopo;
}

function ytDopoRegistrazione(esito) {
  const d = yt.dopo;
  yt.dopo = null;
  // Un filmato senza titolo non viene da una demo (`demo.js` glielo mette
  // sempre): è una registrazione fatta a mano, dopo una storia fermata
  // prima che il registratore partisse. Non è quello da pubblicare.
  if (!d || !esito || !esito.blob || !esito.titolo || Date.now() > d.scade) return false;
  return ytApriPubblica({ blob: esito.blob, nome: esito.nome, tipo: esito.tipo, titolo: d.titolo || esito.titolo });
}

// ====================================================================
// 9. L'avvio
// ====================================================================

if (typeof document !== 'undefined') {
  const avvia = () => {
    ytPannello(document.getElementById('imp-youtube-corpo'));
    // Il pannello delle Impostazioni nasce nascosto: lo script di Google si
    // prepara quando si apre la sua linguetta, non all'avvio dell'app
    const dati = document.getElementById('imp-tab-btn-dati');
    if (dati) dati.addEventListener('click', ytPreparaGoogle);
    if (typeof astroI18n === 'object' && typeof astroI18n.alCambio === 'function') astroI18n.alCambio(ytRidisegna);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia, { once: true });
  else avvia();
}
