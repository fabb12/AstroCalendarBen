/* narrazione.js — La voce che racconta, una sola per tutta l'app.
 *
 * Prima c'erano due voci che non si conoscevano: quella di Missione Cielo,
 * con il suo ponte Edge-TTS e il suo ripiego sulla sintesi del dispositivo,
 * e le demo automatizzate, che non ne avevano nessuna. Due voci separate
 * vuol dire due modi diversi di fermarsi, e il difetto che ne nasce è
 * sempre lo stesso: due frasi che si accavallano, o una frase della scena
 * di prima che continua sopra la scena dopo.
 *
 * Adesso tutto quello che l'app dice ad alta voce passa di qui, e ogni
 * contenuto ha quattro cose:
 *
 *   - un **ID stabile** — quasi sempre la chiave del dizionario da cui viene
 *     il testo (`demo.narr.eclisse_tour.1`, `missione.gioco.evviva.2`);
 *   - un **testo**, che è quello del dizionario nella lingua di adesso;
 *   - una **lingua**, che è quella dell'app;
 *   - un eventuale **audio registrato**, scritto nel manifest
 *     `audio/narrazione/manifest.js` (uno per lingua).
 *
 * E una sola scala di ripieghi, nell'ordine:
 *
 *   1. l'audio registrato, se il manifest ne ha uno per quell'ID e quella
 *      lingua, se il file c'è, si decodifica e il browser lo lascia suonare;
 *   2. la sintesi vocale che l'app aveva già — il ponte Edge-TTS se è
 *      configurato (`EDGE_TTS_API_URL`), poi la voce del dispositivo;
 *   3. nessuna voce: il testo resta a schermo il tempo di leggerlo, e il
 *      racconto va avanti. Una demo che si ferma perché il telefono è muto
 *      è peggio di una demo senza voce.
 *
 * Il manifest non ha bisogno di sapere dove, dentro una frase composta, sta
 * un pezzo registrato: `narrComponi` cerca nel testo da dire i testi del
 * dizionario che hanno un audio, e suona quelli dove li trova. È così che
 * Missione Cielo usa lo stesso sistema senza una riga per frase — un enigma
 * registrato si sente dal file anche dentro all'indizio che lo contiene.
 *
 * Prefisso `narr`. Si carica dopo `i18n.js` e prima di chi parla
 * (`missione-cielo.js`, `demo.js`). */
'use strict';

// =====================================================================
// 1. Le preferenze, e le costanti che non vale la pena cercare altrove
// =====================================================================

const CHIAVE_NARRAZIONE = 'astrocalendario_narrazione';
const NARR_PREDEFINITE = Object.freeze({ attiva: true, volume: 0.9, testo: true, soloTts: false });

// Un ponte Edge-TTS guasto non deve tenere in ostaggio il ripiego: quattro
// secondi e mezzo sono quelli che Missione Cielo usava già.
const NARR_EDGE_SCADENZA_MS = 4500;
// La voce del dispositivo, quando il browser la blocca (niente gesto, iOS
// che non ha ancora sentito un tocco), non dice di no: tace e basta. Se
// l'evento `start` non arriva entro questo tempo la si dà per muta.
const NARR_AVVIO_VOCE_MS = 3000;
// Un file che non comincia a suonare entro questo tempo è da buttare.
const NARR_AUDIO_CARICA_MS = 6000;
// Senza voce il testo resta a schermo quanto serve a leggerlo.
const NARR_PAROLE_AL_SECONDO = 2.6;
const NARR_TESTO_MIN_MS = 2500;
// Un pezzo registrato si cerca dentro a una frase solo se è abbastanza lungo
// da non essere un caso: «Evviva!» sta in mille frasi, un enigma no.
const NARR_BRANO_MIN = 12;
const NARR_ESTENSIONI = /\.(mp3|ogg|oga|opus|m4a|aac|wav|webm)$/i;
// Le voci di serie del ponte Edge-TTS per chi non ne chiede una sua.
const NARR_VOCI_EDGE = { it: 'it-IT-ElsaNeural', en: 'en-US-AriaNeural' };
// L'ordine giusto fra le voci del dispositivo lo dà il nome (vedi
// `narrScegliVoceLocale`): è l'unica cosa che le API espongano.
const NARR_VOCI_BUONE = /natural|neural|enhanced|premium|siri|wavenet|studio/i;
// Mezzo secondo di silenzio: serve a «sbloccare» l'elemento audio dentro a
// un gesto, perché su iOS un elemento che ha suonato una volta dentro a un
// tocco può suonare anche dopo, fuori.
const NARR_SILENZIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const narr = {
  preferenze: null,
  corrente: null,     // la narrazione in corso (vedi `narrParla`)
  sequenza: 0,        // cresce a ogni arresto: chi tiene un numero vecchio tace
  audio: null,        // un elemento solo, riusato: è quello che si sblocca
  urlOggetto: '',
  guasti: new Map(),  // url → 'mancante' | 'corrotto': non si riprova in questa sessione
  avvisati: new Set(),
  indici: new Map(),  // lingua → { firma, brani }
  vocePronta: false,
  ttsMuto: false,     // la voce del dispositivo non è partita: fino al prossimo gesto
  sbloccato: false,
  elTesto: null
};

function narrLeggiPreferenze() {
  try {
    const p = JSON.parse(localStorage.getItem(CHIAVE_NARRAZIONE) || 'null');
    if (p && typeof p === 'object') {
      const volume = Number(p.volume);
      return {
        attiva: p.attiva !== false,
        volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : NARR_PREDEFINITE.volume,
        testo: p.testo !== false,
        soloTts: p.soloTts === true
      };
    }
  } catch (_) { /* salvataggio illeggibile: si riparte dai valori di serie */ }
  return { ...NARR_PREDEFINITE };
}

function narrPreferenze() {
  if (!narr.preferenze) narr.preferenze = narrLeggiPreferenze();
  return narr.preferenze;
}

function narrImpostaPreferenze(nuove) {
  const prima = narrPreferenze();
  const p = { ...prima };
  if (nuove && typeof nuove === 'object') {
    if ('attiva' in nuove) p.attiva = !!nuove.attiva;
    if ('testo' in nuove) p.testo = !!nuove.testo;
    if ('soloTts' in nuove) p.soloTts = !!nuove.soloTts;
    if ('volume' in nuove && Number.isFinite(Number(nuove.volume)))
      p.volume = Math.max(0, Math.min(1, Number(nuove.volume)));
  }
  narr.preferenze = p;
  try { localStorage.setItem(CHIAVE_NARRAZIONE, JSON.stringify(p)); } catch (_) { /* niente storage */ }
  // Le preferenze valgono subito, anche a metà di una frase.
  if (!p.attiva && narr.corrente && !narr.corrente.r.forza) narrFerma();
  if (narr.audio) narr.audio.volume = p.volume;
  if (narr.corrente) narrMostraTesto(narr.corrente);
  narrAggiornaImpostazioni();
  return { ...p };
}

// =====================================================================
// 2. Il manifest degli audio registrati
// =====================================================================

function narrManifest() {
  const m = typeof window !== 'undefined' && window.ASTRO_NARRAZIONE_MANIFEST;
  return m && typeof m === 'object' && m.voci && typeof m.voci === 'object' ? m : { radice: '', voci: {} };
}

// Un percorso del manifest è relativo alla sua cartella, e non può uscirne:
// niente schemi, niente `..`, niente barra iniziale. Un file che non rispetta
// la regola non si suona — vale come mancante.
function narrPercorsoValido(p) {
  return typeof p === 'string' && NARR_ESTENSIONI.test(p) && !/^[a-z]+:|^\/|\\|(^|\/)\.\.(\/|$)/i.test(p);
}

function narrLingua() {
  let l = 'it';
  if (typeof astroI18n === 'object' && astroI18n) {
    if (typeof astroI18n.lingua === 'function') l = astroI18n.lingua();
    else if (typeof astroI18n.getLanguage === 'function') l = astroI18n.getLanguage();
  }
  return String(l || 'it').toLowerCase().split('-')[0] || 'it';
}

function narrVoceManifest(id, lingua) {
  if (!id) return null;
  const voce = narrManifest().voci[id];
  if (!voce) return null;
  const x = voce[lingua];
  if (!x) return null;
  const file = typeof x === 'string' ? x : x.file;
  if (!narrPercorsoValido(file)) return null;
  return { file, impronta: typeof x === 'object' ? x.impronta || '' : '', testo: typeof x === 'object' ? x.testo || '' : '' };
}

function narrUrlAudio(file) {
  const radice = String(narrManifest().radice || 'audio/narrazione/');
  return radice.replace(/\/?$/, '/') + file;
}

// Il testo come lo si confronta: spazi uniformati, niente trattini morbidi.
function narrNormalizza(s) {
  return String(s == null ? '' : s).replace(/­/g, '').replace(/\s+/g, ' ').trim();
}

/* L'impronta del testo da cui un audio è stato registrato (FNV-1a, otto
 * cifre esadecimali). Se il manifest la porta e il testo di adesso non torna,
 * l'audio è rimasto indietro rispetto al dizionario — e un audio che dice
 * un'altra frase da quella scritta sotto è peggio della sintesi. */
function narrImpronta(testo) {
  let h = 0x811c9dc5;
  const s = narrNormalizza(testo);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Il testo di una voce del manifest nella lingua data: quello scritto nel
// manifest, se c'è, se no quello del dizionario. Un testo con segnaposto
// (`{nome}`) non si può registrare una volta per tutte, e non conta.
function narrTestoDellaVoce(id, lingua, voce) {
  if (voce && voce.testo) return narrNormalizza(voce.testo);
  const diz = typeof window !== 'undefined' && window.ASTRO_DIZIONARI && window.ASTRO_DIZIONARI[lingua];
  const grezzo = diz && diz.messaggi && diz.messaggi[id];
  if (typeof grezzo !== 'string' || /\{\w+\}/.test(grezzo)) return '';
  return narrNormalizza(grezzo);
}

function narrAudioValido(voce, testo, id) {
  if (!voce) return false;
  if (voce.impronta && voce.impronta !== narrImpronta(testo)) {
    const chiave = id + '|' + voce.file;
    if (!narr.avvisati.has(chiave)) {
      narr.avvisati.add(chiave);
      console.warn('[narrazione] Audio non aggiornato al testo, uso la sintesi:', id, voce.file);
    }
    return false;
  }
  return !narr.guasti.has(narrUrlAudio(voce.file));
}

// L'indice dei brani registrati di una lingua, rifatto solo quando il
// manifest cambia (le prove lo cambiano sotto ai piedi).
function narrIndice(lingua) {
  const voci = narrManifest().voci;
  const chiavi = Object.keys(voci);
  const firma = chiavi.length + '|' + chiavi.join(',');
  const noto = narr.indici.get(lingua);
  if (noto && noto.firma === firma && noto.manifest === voci) return noto.brani;
  const brani = [];
  for (const id of chiavi) {
    const voce = narrVoceManifest(id, lingua);
    if (!voce) continue;
    const testo = narrTestoDellaVoce(id, lingua, voce);
    if (testo.length >= NARR_BRANO_MIN) brani.push({ id, testo, voce });
  }
  brani.sort((a, b) => b.testo.length - a.testo.length);
  narr.indici.set(lingua, { firma, manifest: voci, brani });
  return brani;
}

/* Da un testo, i pezzi da dire. Tre casi, dal più semplice:
 *
 *   - l'ID della richiesta ha un audio e il testo è quello registrato: un
 *     pezzo solo, dal file;
 *   - dentro al testo compaiono uno o più brani registrati: quelli dal file,
 *     il resto dalla sintesi;
 *   - niente: un pezzo solo, dalla sintesi.
 *
 * I pezzi di sintesi consecutivi restano insieme — una voce che riparte a
 * ogni virgola suona peggio di una che legge tutto d'un fiato. */
function narrComponi(id, testo, lingua, soloTts) {
  const intero = narrNormalizza(testo);
  if (!intero) return [];
  if (soloTts) return [{ testo: intero }];
  const diretta = narrVoceManifest(id, lingua);
  if (diretta && narrAudioValido(diretta, intero, id))
    return [{ testo: intero, audio: narrUrlAudio(diretta.file), id }];
  const brani = narrIndice(lingua);
  if (!brani.length) return [{ testo: intero }];
  const trovati = [];
  for (const b of brani) {
    let da = 0;
    for (;;) {
      const i = intero.indexOf(b.testo, da);
      if (i < 0) break;
      const fine = i + b.testo.length;
      if (!trovati.some(t => i < t.fine && fine > t.inizio) && narrAudioValido(b.voce, b.testo, b.id))
        trovati.push({ inizio: i, fine, brano: b });
      da = fine;
    }
  }
  if (!trovati.length) return [{ testo: intero }];
  trovati.sort((a, b) => a.inizio - b.inizio);
  const pezzi = [];
  let cursore = 0;
  for (const t of trovati) {
    const prima = intero.slice(cursore, t.inizio).trim();
    if (prima) pezzi.push({ testo: prima });
    pezzi.push({ testo: t.brano.testo, audio: narrUrlAudio(t.brano.voce.file), id: t.brano.id });
    cursore = t.fine;
  }
  const dopo = intero.slice(cursore).trim();
  if (dopo) pezzi.push({ testo: dopo });
  return pezzi;
}

// Quanti audio registrati ha una lingua: lo dice la riga delle Impostazioni.
function narrQuantiAudio(lingua) {
  const voci = narrManifest().voci;
  return Object.keys(voci).filter(id => narrVoceManifest(id, lingua)).length;
}

// =====================================================================
// 3. Il testo a schermo
// =====================================================================

function narrOspiteDiSerie() {
  const pieno = typeof document !== 'undefined' && document.fullscreenElement;
  return pieno && pieno !== document.documentElement ? pieno : document.body;
}

function narrMostraTesto(c) {
  if (typeof document === 'undefined') return;
  const vuole = !!(c && c.testo && narrPreferenze().testo && c.r.sottotitolo !== false);
  if (!vuole) { if (narr.elTesto) narr.elTesto.hidden = true; return; }
  let el = narr.elTesto;
  if (!el) {
    el = narr.elTesto = document.createElement('div');
    el.id = 'narrazione-testo';
    el.className = 'narrazione-testo';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
  }
  let ospite = null;
  try { ospite = typeof c.r.ospite === 'function' ? c.r.ospite() : null; } catch (_) { ospite = null; }
  const dentro = !!ospite;
  if (!ospite) ospite = narrOspiteDiSerie();
  if (ospite && el.parentElement !== ospite) {
    if (dentro) ospite.prepend(el); else ospite.append(el);
  }
  el.classList.toggle('in-ospite', dentro);
  el.classList.toggle('in-pausa', !!c.pausa);
  el.textContent = c.testo;
  el.lang = c.lingua;
  el.hidden = false;
}

function narrNascondiTesto() {
  if (narr.elTesto) narr.elTesto.hidden = true;
}

// =====================================================================
// 4. La macchina: parlare, fermarsi, aspettare
// =====================================================================

function narrVecchia(c) {
  return !c || c !== narr.corrente || c.seq !== narr.sequenza;
}

// Ogni attesa si registra sulla narrazione, e un arresto le sveglia tutte:
// nessuna promessa resta appesa a una frase che non c'è più.
function narrAttesa(c, fn) {
  return new Promise(risolvi => {
    let fatto = false;
    const chiudi = v => { if (!fatto) { fatto = true; c.attese.delete(sveglia); risolvi(v); } };
    const sveglia = () => chiudi('interrotta');
    c.attese.add(sveglia);
    fn(chiudi);
  });
}

function narrSveglia(c) {
  for (const f of [...c.attese]) f();
}

function narrAttendiRipresa(c) {
  if (!c.pausa || narrVecchia(c)) return Promise.resolve();
  return narrAttesa(c, fine => { c.allaRipresa = () => fine('ripresa'); });
}

function narrElementoAudio() {
  if (!narr.audio && typeof Audio !== 'undefined') {
    narr.audio = new Audio();
    narr.audio.preload = 'auto';
  }
  return narr.audio;
}

function narrLiberaAudio() {
  const a = narr.audio;
  if (a) {
    a.onended = a.onerror = a.onplaying = null;
    try { a.pause(); } catch (_) { /* niente */ }
    a.removeAttribute('src');
    try { a.load(); } catch (_) { /* niente */ }
  }
  if (narr.urlOggetto && typeof URL !== 'undefined') URL.revokeObjectURL(narr.urlOggetto);
  narr.urlOggetto = '';
}

/* Suona una sorgente sull'elemento condiviso. Risponde 'audio' a fine brano,
 * 'bloccato' se il browser non lascia suonare senza un gesto, 'corrotto' se
 * non si decodifica, 'interrotta' se nel frattempo qualcuno ha fermato. */
function narrSuona(c, sorgente) {
  const a = narrElementoAudio();
  if (!a) return Promise.resolve('corrotto');
  return narrAttesa(c, fine => {
    let partito = false;
    const scadenza = setTimeout(() => { if (!partito && !c.pausa) fine('corrotto'); }, NARR_AUDIO_CARICA_MS);
    const chiudi = v => { clearTimeout(scadenza); fine(v); };
    a.onended = () => chiudi('audio');
    a.onerror = () => chiudi('corrotto');
    a.onplaying = () => { partito = true; };
    a.volume = narrPreferenze().volume;
    a.src = sorgente;
    c.audioInCorso = true;
    const avvia = () => {
      if (narrVecchia(c)) return;
      let p;
      try { p = a.play(); } catch (e) { chiudi('corrotto'); return; }
      if (p && typeof p.catch === 'function') p.catch(e => {
        if (narrVecchia(c) || c.pausa) return;
        chiudi(e && e.name === 'NotAllowedError' ? 'bloccato' : 'corrotto');
      });
    };
    if (c.pausa) c.allaRipresaAudio = avvia; else avvia();
  }).then(v => { c.audioInCorso = false; return v; });
}

async function narrCaricaFile(url) {
  // Da `file://` una `fetch` è vietata: l'elemento audio invece il file lo
  // legge lo stesso, e si passa l'indirizzo così com'è.
  if (typeof location !== 'undefined' && location.protocol === 'file:') return url;
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { motivo: 'mancante' });
  const blob = await r.blob();
  // Un audio di sessanta byte non è un audio: è un'intestazione e basta, o
  // una pagina d'errore servita col tipo sbagliato.
  if (!blob.size || blob.size < 64 || /^text\//i.test(blob.type || ''))
    throw Object.assign(new Error('file vuoto o non audio'), { motivo: 'corrotto' });
  const oggetto = URL.createObjectURL(blob);
  return oggetto;
}

async function narrSuonaFile(c, url) {
  let sorgente;
  try {
    sorgente = await narrCaricaFile(url);
  } catch (e) {
    narr.guasti.set(url, e.motivo || 'mancante');
    console.warn('[narrazione] Audio non disponibile, uso la sintesi:', url, e.message);
    return 'errore';
  }
  if (narrVecchia(c)) { if (sorgente.startsWith('blob:')) URL.revokeObjectURL(sorgente); return 'interrotta'; }
  if (sorgente.startsWith('blob:')) narr.urlOggetto = sorgente;
  const esito = await narrSuona(c, sorgente);
  if (narr.urlOggetto === sorgente) { URL.revokeObjectURL(sorgente); narr.urlOggetto = ''; }
  if (esito === 'corrotto') {
    narr.guasti.set(url, 'corrotto');
    console.warn('[narrazione] Audio illeggibile, uso la sintesi:', url);
    return 'errore';
  }
  if (esito === 'bloccato') return 'errore';
  return esito;
}

/* Il ponte Edge-TTS, se c'è. Il contratto è quello di `EDGE-TTS.md`: POST
 * JSON, e in risposta l'audio o `{ url }` / `{ audio }`. Chi parla può
 * aggiungere al corpo la sua voce, il suo SSML e il suo stile (`r.edge`):
 * Missione Cielo lo fa, le demo usano la voce di serie. */
async function narrEdge(c, testo) {
  const endpoint = typeof window !== 'undefined' ? String(window.EDGE_TTS_API_URL || '').trim() : '';
  if (!endpoint || typeof fetch !== 'function' || typeof Audio === 'undefined') return '';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return '';
  const lingua = c.lingua;
  const tono = c.r.tono || {};
  let extra = {};
  try { extra = (typeof c.r.edge === 'function' && c.r.edge(testo, lingua)) || {}; } catch (_) { extra = {}; }
  const controllore = typeof AbortController !== 'undefined' ? new AbortController() : null;
  c.fermaRichiesta = () => { if (controllore) controllore.abort(); };
  let timer = null;
  const richiesta = (async () => {
    const risposta = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg, audio/*, application/json' },
      signal: controllore ? controllore.signal : undefined,
      body: JSON.stringify(Object.assign({
        text: testo,
        voice: NARR_VOCI_EDGE[lingua] || NARR_VOCI_EDGE.it,
        locale: lingua === 'en' ? 'en-US' : 'it-IT',
        rate: tono.ritmo || '0%', pitch: tono.tono || '0Hz',
        format: 'audio-24khz-48kbitrate-mono-mp3'
      }, extra))
    });
    if (!risposta.ok) throw new Error('Edge-TTS HTTP ' + risposta.status);
    const tipo = risposta.headers.get('content-type') || '';
    if (tipo.includes('application/json')) {
      const dato = await risposta.json();
      if (dato && dato.url) return String(dato.url);
      if (dato && dato.audio) return 'data:' + (dato.mime || 'audio/mpeg') + ';base64,' + dato.audio;
      return '';
    }
    const blob = await risposta.blob();
    return blob.size ? URL.createObjectURL(blob) : '';
  })();
  const scadenza = new Promise((_, rifiuta) => {
    timer = setTimeout(() => { if (controllore) controllore.abort(); rifiuta(new Error('Edge-TTS timeout')); },
      NARR_EDGE_SCADENZA_MS);
  });
  let sorgente = '';
  try {
    sorgente = await Promise.race([richiesta, scadenza]);
  } catch (e) {
    if (!narrVecchia(c)) console.warn('[narrazione] Edge-TTS non disponibile, uso la voce del dispositivo.', e.message);
    return '';
  } finally {
    clearTimeout(timer); c.fermaRichiesta = null;
  }
  if (narrVecchia(c)) { if (sorgente && sorgente.startsWith('blob:')) URL.revokeObjectURL(sorgente); return 'interrotta'; }
  if (!sorgente) return '';
  if (sorgente.startsWith('blob:')) narr.urlOggetto = sorgente;
  const esito = await narrSuona(c, sorgente);
  if (narr.urlOggetto === sorgente) { URL.revokeObjectURL(sorgente); narr.urlOggetto = ''; }
  return esito === 'audio' ? 'tts' : esito === 'interrotta' ? 'interrotta' : '';
}

/* La voce del dispositivo, che è il ripiego e non il ripiego cattivo: su un
 * telefono di oggi le voci migliori sono ottime. Si sceglie per **nome**
 * (`NARR_VOCI_BUONE`) — preferire `localService` vuol dire scegliere quasi
 * sempre la vecchia voce concatenativa del sistema. */
function narrScegliVoceLocale(lingua) {
  if (typeof speechSynthesis === 'undefined') return null;
  const voci = speechSynthesis.getVoices().filter(v =>
    String(v.lang || '').toLowerCase().startsWith(lingua));
  if (!voci.length) return null;
  const punti = v => (NARR_VOCI_BUONE.test(v.name || '') ? 4 : 0) +
    (v.default ? 1 : 0) + (v.localService ? 0 : 1);
  return voci.slice().sort((a, b) => punti(b) - punti(a))[0];
}

function narrVoceLocaleDisponibile() {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

/* Risponde 'tts' a fine frase, 'pausa' se l'ha fermata una pausa (la frase
 * si ridice da capo alla ripresa: `speechSynthesis.pause()` su Android non
 * esiste e altrove si inceppa), '' se la voce non c'è o non parte. */
function narrVoceLocale(c, testo) {
  if (!narrVoceLocaleDisponibile() || narr.ttsMuto) return Promise.resolve('');
  return narrAttesa(c, fine => {
    let partita = false;
    try { speechSynthesis.cancel(); } catch (_) { /* niente */ }
    const frase = new SpeechSynthesisUtterance(testo);
    const tono = c.r.tono || {};
    frase.lang = c.lingua === 'en' ? 'en-US' : c.lingua === 'it' ? 'it-IT' : c.lingua;
    const voce = narrScegliVoceLocale(c.lingua);
    if (voce) frase.voice = voce;
    const perc = parseFloat(tono.ritmo) || 0;
    const hz = parseFloat(tono.tono) || 0;
    frase.rate = Math.max(0.5, Math.min(1.6, 1 + perc / 100));
    frase.pitch = Math.max(0.4, Math.min(1.8, 1 + hz / 80));
    frase.volume = narrPreferenze().volume;
    const scadenza = setTimeout(() => {
      if (partita || narrVecchia(c) || c.pausa) return;
      // Tace senza dire di no: la si dà per muta fino al prossimo tocco.
      narr.ttsMuto = true;
      try { speechSynthesis.cancel(); } catch (_) { /* niente */ }
      fine('');
    }, NARR_AVVIO_VOCE_MS);
    frase.onstart = () => { partita = true; };
    frase.onend = () => { clearTimeout(scadenza); fine(c.fermataPerPausa ? 'pausa' : 'tts'); };
    frase.onerror = e => {
      clearTimeout(scadenza);
      if (c.fermataPerPausa) fine('pausa');
      else if (e && /interrupted|canceled/.test(e.error || '')) fine(narrVecchia(c) ? 'interrotta' : 'pausa');
      else {
        if (e && e.error === 'not-allowed') narr.ttsMuto = true;
        fine('');
      }
    };
    c.fermaVoce = () => { clearTimeout(scadenza); c.fermataPerPausa = true; try { speechSynthesis.cancel(); } catch (_) { /* niente */ } };
    c.fermataPerPausa = false;
    speechSynthesis.speak(frase);
  }).then(v => { c.fermaVoce = null; c.fermataPerPausa = false; return v; });
}

// Senza voce: il testo resta a schermo il tempo di leggerlo, e la pausa ferma
// anche quest'orologio.
function narrSoloTesto(c, testo) {
  const parole = String(testo).split(/\s+/).filter(Boolean).length;
  let resta = Math.max(NARR_TESTO_MIN_MS, parole / NARR_PAROLE_AL_SECONDO * 1000);
  return narrAttesa(c, fine => {
    let timer = null, dal = 0;
    const avvia = () => {
      dal = Date.now();
      timer = setTimeout(() => fine('testo'), resta);
    };
    c.fermaTesto = () => { clearTimeout(timer); resta = Math.max(0, resta - (Date.now() - dal)); };
    c.riprendiTesto = avvia;
    if (!c.pausa) avvia();
  }).then(v => { c.fermaTesto = c.riprendiTesto = null; return v; });
}

async function narrDiciPezzo(c, pezzo) {
  const p = narrPreferenze();
  if (pezzo.audio && !p.soloTts && !narr.guasti.has(pezzo.audio)) {
    c.fase = 'audio';
    const e = await narrSuonaFile(c, pezzo.audio);
    if (e === 'audio' || e === 'interrotta') return e;
    if (narrVecchia(c)) return 'interrotta';
    if (c.pausa) return 'pausa';
  }
  if (p.volume > 0) {
    c.fase = 'tts';
    const e = await narrEdge(c, pezzo.testo);
    if (e) return e;
    if (narrVecchia(c)) return 'interrotta';
    // Una pausa arrivata mentre si aspettava il ponte: la voce del
    // dispositivo non parte adesso, il pezzo si ridice alla ripresa.
    if (c.pausa) return 'pausa';
    const l = await narrVoceLocale(c, pezzo.testo);
    if (l) return l;
    if (narrVecchia(c)) return 'interrotta';
  }
  c.fase = 'testo';
  return narrSoloTesto(c, pezzo.testo);
}

const NARR_RANGO = { testo: 0, tts: 1, audio: 2 };

async function narrEsegui(c) {
  let esito = '';
  while (c.indice < c.pezzi.length) {
    await narrAttendiRipresa(c);
    if (narrVecchia(c)) return 'interrotta';
    const e = await narrDiciPezzo(c, c.pezzi[c.indice]);
    if (narrVecchia(c) || e === 'interrotta') return 'interrotta';
    if (e === 'pausa') continue;   // la frase si ridice da capo alla ripresa
    if (!esito || NARR_RANGO[e] > NARR_RANGO[esito]) esito = e;
    c.indice++;
  }
  c.fase = 'finita';
  if (typeof c.r.fine === 'function') { try { c.r.fine(esito); } catch (_) { /* niente */ } }
  return esito || 'testo';
}

function narrTestoDi(r) {
  if (typeof r.testo === 'function') { try { return String(r.testo() || ''); } catch (_) { return ''; } }
  if (typeof r.testo === 'string') return r.testo;
  if (r.id && typeof astroI18n === 'object' && astroI18n.esiste && astroI18n.esiste(r.id)) return astroI18n.t(r.id);
  return '';
}

/* Una richiesta di narrazione:
 *
 *   { canale: 'demo' | 'missione' | …,  chi parla (per fermarsi a vicenda)
 *     id: 'demo.narr.aurora_boreale.3',   l'ID stabile (chiave del dizionario)
 *     testo?: stringa | () => stringa,    se manca, il testo è quello dell'ID
 *     sottotitolo?: false,                se il testo è già a schermo altrove
 *     ospite?: () => Element,             dove appendere il testo
 *     tono?: { ritmo, tono },             per la sintesi
 *     edge?: (testo, lingua) => {…},      campi in più per il ponte Edge-TTS
 *     forza?: true }                      un gesto esplicito («Ascolta»):
 *                                         parla anche a narrazione spenta
 *
 * Risponde con una promessa: 'audio', 'tts' o 'testo' secondo cosa ha
 * funzionato (il migliore fra i pezzi), 'interrotta', 'spenta' o 'vuota'.
 * Una richiesta nuova ferma sempre quella di prima, di qualunque canale:
 * due voci insieme non esistono. */
function narrParla(r) {
  r = r || {};
  narrFerma();
  const p = narrPreferenze();
  if (!p.attiva && !r.forza) return Promise.resolve('spenta');
  const lingua = narrLingua();
  const testo = narrNormalizza(narrTestoDi(r));
  if (!testo) return Promise.resolve('vuota');
  const c = {
    r, seq: narr.sequenza, lingua, testo, indice: 0, fase: 'inizio',
    pezzi: narrComponi(r.id, testo, lingua, p.soloTts),
    pausa: false, pausaAuto: false, attese: new Set()
  };
  narr.corrente = c;
  narrMostraTesto(c);
  return narrEsegui(c);
}

// Ferma la narrazione. Con un canale, solo se è quel canale a parlare: la
// demo che chiude una scena non deve zittire una prova delle Impostazioni.
function narrFerma(canale) {
  const c = narr.corrente;
  if (canale && c && c.r.canale !== canale) return false;
  narr.sequenza++;
  narr.corrente = null;
  if (c) {
    if (c.fermaRichiesta) c.fermaRichiesta();
    if (c.fermaVoce || c.fase === 'tts') { try { speechSynthesis.cancel(); } catch (_) { /* niente */ } }
    narrSveglia(c);
  }
  narrLiberaAudio();
  narrNascondiTesto();
  return !!c;
}

function narrPausa(canale, auto) {
  const c = narr.corrente;
  if (!c || (canale && c.r.canale !== canale)) return false;
  if (c.pausa) { if (!auto) c.pausaAuto = false; return true; }
  c.pausa = true; c.pausaAuto = !!auto;
  if (c.audioInCorso && narr.audio) { try { narr.audio.pause(); } catch (_) { /* niente */ } }
  if (c.fermaVoce) c.fermaVoce();
  if (c.fermaTesto) c.fermaTesto();
  narrMostraTesto(c);
  return true;
}

function narrRiprendi(canale) {
  const c = narr.corrente;
  if (!c || (canale && c.r.canale !== canale) || !c.pausa) return false;
  c.pausa = false; c.pausaAuto = false;
  if (c.allaRipresaAudio) { const f = c.allaRipresaAudio; c.allaRipresaAudio = null; f(); }
  else if (c.audioInCorso && narr.audio) {
    const p = narr.audio.play();
    if (p && p.catch) p.catch(() => {});
  }
  if (c.riprendiTesto) c.riprendiTesto();
  if (c.allaRipresa) { const f = c.allaRipresa; c.allaRipresa = null; f(); }
  narrMostraTesto(c);
  return true;
}

// Il cambio lingua: una narrazione che viene da una chiave (o da una
// funzione) si ricompone nella lingua nuova e riparte da capo; una frase
// scritta a mano resta com'è — è già nella lingua di chi l'ha scritta.
function narrCambioLingua() {
  const c = narr.corrente;
  if (c && typeof c.r.testo !== 'string') {
    const r = c.r, inPausa = c.pausa;
    narrParla(r);
    if (inPausa) narrPausa(r.canale);
  }
  narrAggiornaImpostazioni();
}

// Il primo gesto dell'utente sblocca l'audio (iOS vuole che l'elemento abbia
// suonato una volta dentro a un tocco) e la voce del dispositivo. Ogni gesto,
// poi, rimette in gioco una voce che era stata data per muta.
function narrSblocca() {
  narr.ttsMuto = false;
  if (!narr.sbloccato) {
    const a = narrElementoAudio();
    if (a && !narr.corrente) {
      narr.sbloccato = true;
      try {
        a.muted = true; a.src = NARR_SILENZIO;
        const p = a.play();
        const libera = () => { a.muted = false; if (!narr.corrente) narrLiberaAudio(); };
        if (p && p.then) p.then(libera, libera); else libera();
      } catch (_) { a.muted = false; }
    }
  }
  if (!narr.vocePronta && narrVoceLocaleDisponibile()) {
    narr.vocePronta = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      if (!narr.corrente) speechSynthesis.speak(u);
    } catch (_) { /* niente */ }
  }
}

function narrStato() {
  const c = narr.corrente;
  return c ? {
    canale: c.r.canale || '', id: c.r.id || '', testo: c.testo, lingua: c.lingua, fase: c.fase,
    pausa: c.pausa, indice: c.indice, pezzi: c.pezzi.map(x => ({ testo: x.testo, audio: x.audio || '' }))
  } : null;
}

// =====================================================================
// 5. Le Impostazioni
// =====================================================================

function narrT(chiave, dati) {
  return typeof astroI18n === 'object' ? astroI18n.t('narrazione.' + chiave, dati) : chiave;
}

function narrAggiornaImpostazioni() {
  if (typeof document === 'undefined') return;
  const p = narrPreferenze();
  const $ = id => document.getElementById(id);
  const attiva = $('imp-narrazione-attiva'), volume = $('imp-narrazione-volume'),
    valore = $('imp-narrazione-volume-valore'), testo = $('imp-narrazione-testo'),
    solo = $('imp-narrazione-solo-tts'), stato = $('imp-narrazione-stato');
  if (attiva) attiva.checked = p.attiva;
  if (volume && document.activeElement !== volume) volume.value = String(Math.round(p.volume * 100));
  if (valore) valore.textContent = Math.round(p.volume * 100) + '%';
  if (testo) testo.checked = p.testo;
  if (solo) solo.checked = p.soloTts;
  for (const el of [volume, testo, solo]) if (el) el.disabled = !p.attiva;
  if (stato) {
    const lingua = narrLingua();
    const audio = narrQuantiAudio(lingua);
    const voce = String(window.EDGE_TTS_API_URL || '').trim() ? narrT('voceRemota')
      : narrVoceLocaleDisponibile() ? narrT('voceDispositivo') : narrT('voceAssente');
    stato.textContent = narrT('stato', { n: audio, voce });
  }
}

function narrCollegaImpostazioni() {
  const $ = id => document.getElementById(id);
  const attiva = $('imp-narrazione-attiva'), volume = $('imp-narrazione-volume'),
    testo = $('imp-narrazione-testo'), solo = $('imp-narrazione-solo-tts'), prova = $('imp-narrazione-prova');
  if (attiva) attiva.addEventListener('change', () => narrImpostaPreferenze({ attiva: attiva.checked }));
  if (volume) volume.addEventListener('input', () => narrImpostaPreferenze({ volume: Number(volume.value) / 100 }));
  if (testo) testo.addEventListener('change', () => narrImpostaPreferenze({ testo: testo.checked }));
  if (solo) solo.addEventListener('change', () => narrImpostaPreferenze({ soloTts: solo.checked }));
  if (prova) prova.addEventListener('click', () => {
    narrSblocca();
    narrParla({ canale: 'prova', id: 'narrazione.testoProva', forza: true });
  });
  narrAggiornaImpostazioni();
}

// =====================================================================
// 6. Avvio
// =====================================================================

if (typeof document !== 'undefined') {
  const gesto = () => narrSblocca();
  document.addEventListener('pointerdown', gesto, true);
  document.addEventListener('keydown', gesto, true);
  document.addEventListener('touchend', gesto, true);
  // Una scheda nascosta non parla. Chi è stato messo in pausa da qui riparte
  // da solo al ritorno; chi ha chiesto la pausa per conto suo (la demo, che
  // aspetta «Riprendi») resta fermo.
  document.addEventListener('visibilitychange', () => {
    const c = narr.corrente;
    if (!c) return;
    if (document.hidden) { if (!c.pausa) narrPausa(null, true); }
    else if (c.pausaAuto) narrRiprendi();
  });
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.addEventListener)
    speechSynthesis.addEventListener('voiceschanged', () => narrAggiornaImpostazioni());
  if (typeof astroI18n === 'object' && typeof astroI18n.alCambio === 'function') astroI18n.alCambio(narrCambioLingua);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', narrCollegaImpostazioni, { once: true });
  else narrCollegaImpostazioni();
}

const narrazione = {
  parla: narrParla,
  ferma: narrFerma,
  pausa: canale => narrPausa(canale, false),
  riprendi: narrRiprendi,
  stato: narrStato,
  sblocca: narrSblocca,
  preferenze: () => ({ ...narrPreferenze() }),
  impostaPreferenze: narrImpostaPreferenze,
  // Per le prove e per chi scrive il manifest.
  componi: (id, testo, lingua) => narrComponi(id, testo, lingua || narrLingua(), narrPreferenze().soloTts),
  impronta: narrImpronta,
  quantiAudio: lingua => narrQuantiAudio(lingua || narrLingua()),
  guasti: () => Object.fromEntries(narr.guasti),
  dimentica() { narr.guasti.clear(); narr.indici.clear(); narr.ttsMuto = false; },
  costanti: { CHIAVE_NARRAZIONE, NARR_PREDEFINITE, NARR_BRANO_MIN, NARR_EDGE_SCADENZA_MS, NARR_VOCI_EDGE }
};
if (typeof window !== 'undefined') window.narrazione = narrazione;
if (typeof module !== 'undefined' && module.exports) module.exports = narrazione;
