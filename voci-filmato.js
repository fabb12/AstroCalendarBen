/* voci-filmato.js — Le voci che si sentono nel filmato (v478).
 *
 * Chi esportava una CosmoStoria su YouTube con le voci di sistema si
 * ritrovava un filmato senza voci. Non è un errore della registrazione: la
 * voce del dispositivo (Web Speech) esce dal sistema operativo, non passa
 * dalla pagina, e nessun browser la lascia registrare (`narrazione.js`, nota
 * a `narrFermaCatturaAudio`). Passano nel filmato solo i suoni che la pagina
 * suona da sé: i file registrati, le voci dello Studio, il ponte Edge-TTS.
 *
 * Allora, prima di registrare, le battute che andrebbero alla voce del
 * dispositivo si fanno diventare **file**, in due modi, nell'ordine scelto da
 * chi usa l'app:
 *
 *   1. ElevenLabs, con la chiave che lo Studio ha già: la voce scelta per il
 *      personaggio, se c'è, se no una delle voci dell'account del suo genere,
 *      una diversa per personaggio. Costa crediti, e prima lo si dice;
 *   2. Piper, la voce neurale che gira nel browser: gratis, senza chiave, il
 *      modello (una voce femminile e una maschile per lingua) si scarica la
 *      prima volta e resta nella cache del browser. Il tono del personaggio
 *      (`voce.tono` del profilo) alza o abbassa la voce senza cambiarne la
 *      velocità: il modello parla più lento e il file si suona più veloce.
 *
 * Le voci fatte restano in IndexedDB (`astrocal_voci_filmato`) e la volta
 * dopo non si rifanno: un secondo filmato della stessa storia non spende
 * crediti. Durante la registrazione la narrazione le suona al posto della
 * sintesi (`narrazione.vociFilmato`), e alla fine le si toglie.
 *
 * Il giro: «YouTube» → `ytRegistraEPubblica` → `vfilmPrimaDiRegistrare`, che
 * se non c'è niente da fare risponde subito e la storia parte come prima; se
 * no apre la finestra «Le voci del filmato», genera, e quando è tutto pronto
 * chiede un tocco su «Registra e pubblica» (lo schermo intero e l'audio
 * vogliono un gesto, e dopo un minuto di lavoro quello di prima è scaduto).
 *
 * Prefisso `vfilm`. Si carica dopo `storie-studio.js` e prima di
 * `youtube.js`. */
'use strict';

// =====================================================================
// 1. Le costanti
// =====================================================================

const VFILM_DB = 'astrocal_voci_filmato';
const VFILM_SCAFFALE = 'voci';
// Quante voci tenere: le più vecchie se ne vanno (una battuta pesa 30–100 kB)
const VFILM_MAX = 600;
const VFILM_ELEVEN = 'https://api.elevenlabs.io';
const VFILM_ELEVEN_FORMATO = 'mp3_44100_128';
// Piper: onnxruntime-web e il fonemizzatore (espeak-ng compilato in wasm) da
// jsdelivr, le voci da Hugging Face (la raccolta ufficiale, poi la copia di
// diffusionstudio). Una sola discussione: il wasm a più thread vorrebbe
// l'isolamento fra origini, che GitHub Pages non dà.
const VFILM_ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
const VFILM_FONEMI = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
const VFILM_MODELLI = [
  'https://huggingface.co/rhasspy/piper-voices/resolve/main/',
  'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/'
];
const VFILM_PIPER_VOCI = {
  it: { f: 'it/it_IT/paola/medium/it_IT-paola-medium', m: 'it/it_IT/riccardo/x_low/it_IT-riccardo-x_low' },
  en: { f: 'en/en_US/hfc_female/medium/en_US-hfc_female-medium', m: 'en/en_US/hfc_male/medium/en_US-hfc_male-medium' }
};
// Quanto si scarica la prima volta, in MB: il motore e una voce
const VFILM_PIPER_MB = { motore: 30, medium: 63, x_low: 21 };
const VFILM_CACHE_PIPER = 'astrocal-piper-v1';
// Un pezzo per il modello, al più: le frasi lunghe si spezzano ai punti
const VFILM_PEZZO_MAX = 280;
// Il tono del personaggio (`voce.tono`, in Hz come per la sintesi) diventa
// un fattore d'altezza; i bambini (+40 Hz) salgono di un terzo
const VFILM_ALTEZZA = { perHz: 1 / 120, min: 0.85, max: 1.35 };

const vfilm = {
  finestra: null,        // { el, stato, battute, motore, … } (vedi `vfilmApri`)
  urls: [],              // gli URL degli audio prestati alla narrazione
  piper: { fonemi: null, modelli: new Map() },
  vociEleven: null       // le voci dell'account ElevenLabs, chieste una volta
};

const vfilmT = (k, v) => (typeof astroI18n === 'object' && astroI18n && typeof astroI18n.t === 'function' ? astroI18n.t('vfilm.' + k, v) : k);
const vfilmLingua = () => {
  const l = typeof astroI18n === 'object' && astroI18n && typeof astroI18n.lingua === 'function' ? astroI18n.lingua() : 'it';
  return String(l || 'it').toLowerCase().split('-')[0] || 'it';
};

// =====================================================================
// 2. Le battute che andrebbero alla voce del dispositivo
// =====================================================================

/* Dal copione, i pezzi di testo che la narrazione direbbe con la sintesi:
 * quelli di `character_speak` e di `narrate` che non hanno un audio
 * (registrato, dello Studio, del manifest). `narrazione.componi` è la stessa
 * strada che farà la narrazione vera: un brano registrato dentro a una
 * frase resta suo, e si genera solo il resto. Ogni pezzo una volta, col
 * personaggio che lo dice. A narrazione spenta non parla nessuno. */
function vfilmBattute(testo) {
  if (typeof narrazione !== 'object' || typeof narrazione.componi !== 'function') return [];
  const pref = typeof narrazione.preferenze === 'function' ? narrazione.preferenze() : {};
  if (pref.attiva === false) return [];
  const demo = window.AstroDemo && typeof AstroDemo.valida === 'function' ? AstroDemo.valida(testo) : null;
  if (!demo) return [];
  const S = window.StorieCosmiche;
  const viste = new Map();
  for (const scena of demo.scene) for (const a of scena.azioni) {
    if (a.comando !== 'character_speak' && a.comando !== 'narrate') continue;
    const p = a.parametri || {};
    const frase = typeof p.text === 'string' ? p.text
      : p.id && typeof astroI18n === 'object' && astroI18n.esiste && astroI18n.esiste(p.id) ? astroI18n.t(p.id) : '';
    if (!frase) continue;
    const chi = a.comando === 'character_speak' && p.target ? (S && S.canonico ? S.canonico(p.target) : p.target) : '';
    for (const pezzo of narrazione.componi(p.id || '', frase)) {
      if (pezzo.audio || !pezzo.testo) continue;
      const k = chi + '|' + pezzo.testo;
      if (!viste.has(k)) viste.set(k, { chi, testo: pezzo.testo });
    }
  }
  return [...viste.values()];
}
// Chi è, per la voce: il genere e il tono del profilo (la voce narrante è lei)
function vfilmProfilo(chi) {
  const S = window.StorieCosmiche;
  const p = chi && S && typeof S.profilo === 'function' ? S.profilo(chi) : null;
  return { genere: p && p.genere === 'm' ? 'm' : 'f', tono: (p && p.voce) || {}, nome: p && S.nome ? S.nome(chi) : '' };
}
const vfilmCaratteri = battute => battute.reduce((n, b) => n + b.testo.length, 0);

// =====================================================================
// 3. Lo scaffale delle voci fatte
// =====================================================================

function vfilmDb(lavoro, modo = 'readonly') {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') { ko(new Error('IndexedDB')); return; }
    const r = indexedDB.open(VFILM_DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(VFILM_SCAFFALE)) r.result.createObjectStore(VFILM_SCAFFALE); };
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const db = r.result;
      let esito;
      try {
        const tr = db.transaction(VFILM_SCAFFALE, modo);
        esito = lavoro(tr.objectStore(VFILM_SCAFFALE));
        tr.oncomplete = () => { db.close(); ok(esito && 'result' in esito ? esito.result : esito); };
        tr.onerror = tr.onabort = () => { db.close(); ko(tr.error); };
      } catch (e) { db.close(); ko(e); }
    };
  });
}
// La chiave di una voce fatta: il motore, chi la dice, la lingua e il testo
const vfilmChiave = (motore, b, lingua) => [motore, b.chi || '-', lingua, typeof narrazione === 'object' && narrazione.impronta ? narrazione.impronta(b.testo) : b.testo].join('|');
const vfilmLeggi = k => vfilmDb(st => st.get(k)).catch(() => null);
async function vfilmScrivi(k, rec) {
  await vfilmDb(st => st.put(Object.assign({ quando: Date.now() }, rec), k), 'readwrite').catch(() => null);
  // le più vecchie se ne vanno
  const tutte = await vfilmDb(st => st.getAllKeys()).catch(() => []);
  if (!Array.isArray(tutte) || tutte.length <= VFILM_MAX) return;
  const vecchie = [];
  await vfilmDb(st => { const c = st.openCursor(); c.onsuccess = () => { const x = c.result; if (x) { vecchie.push([x.key, x.value && x.value.quando || 0]); x.continue(); } }; }).catch(() => null);
  vecchie.sort((a, b) => a[1] - b[1]);
  const via = vecchie.slice(0, vecchie.length - VFILM_MAX).map(x => x[0]);
  if (via.length) await vfilmDb(st => { for (const k of via) st.delete(k); }, 'readwrite').catch(() => null);
}
// Quante battute hanno già la loro voce, con un motore (per i crediti)
async function vfilmGiaFatte(motore, battute, lingua) {
  let n = 0, caratteri = 0;
  for (const b of battute) {
    const rec = await vfilmLeggi(vfilmChiave(motore, b, lingua));
    if (rec && rec.blob) { n++; caratteri += b.testo.length; }
  }
  return { n, caratteri };
}

// =====================================================================
// 4. ElevenLabs
// =====================================================================

// Le impostazioni dello Studio (chiave, modello, stabilità): senza chiave, niente
function vfilmElevenImpostazioni() {
  const S = window.StudioStorie;
  const imp = S && typeof S.elevenImpostazioni === 'function' ? S.elevenImpostazioni() : null;
  return imp && imp.chiave ? imp : null;
}
async function vfilmEleven(imp, metodo, percorso, corpo, audio) {
  const tt = k => (typeof astroI18n === 'object' ? astroI18n.t(k) : k);
  let r;
  try {
    r = await fetch(VFILM_ELEVEN + percorso, {
      method: metodo,
      headers: Object.assign({ 'xi-api-key': imp.chiave, accept: audio ? 'audio/mpeg' : 'application/json' }, corpo ? { 'content-type': 'application/json' } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined
    });
  } catch (_) { throw new Error(tt('studio.el.errRete')); }
  if (!r.ok) {
    let dettaglio = '';
    try { const j = await r.json(); const d = j && j.detail; dettaglio = typeof d === 'string' ? d : d && (d.message || d.status) ? String(d.message || d.status) : ''; } catch (_) { /* senza corpo */ }
    const coda = dettaglio ? ' (' + dettaglio + ')' : '';
    if (r.status === 401) throw new Error(tt('studio.el.errChiave') + coda);
    if (r.status === 402 || /quota|credit/i.test(dettaglio)) throw Object.assign(new Error(tt('studio.el.errCrediti') + coda), { crediti: true });
    if (r.status === 429) throw new Error(tt('studio.el.errTroppe'));
    throw new Error(astroI18n.t('studio.el.errRisposta', { stato: r.status, dettaglio: dettaglio || r.statusText || '' }));
  }
  return audio ? r.blob() : r.json();
}
// Le voci dell'account, col genere scritto nelle etichette
async function vfilmVociEleven(imp) {
  if (vfilm.vociEleven) return vfilm.vociEleven;
  const r = await vfilmEleven(imp, 'GET', '/v2/voices?page_size=100');
  vfilm.vociEleven = (r && Array.isArray(r.voices) ? r.voices : []).filter(v => v && /^[A-Za-z0-9]{10,40}$/.test(v.voice_id || '')).map(v => {
    const g = String((v.labels && v.labels.gender) || '').toLowerCase();
    return { id: v.voice_id, genere: g === 'male' ? 'm' : g === 'female' ? 'f' : '' };
  });
  return vfilm.vociEleven;
}
/* La voce di ognuno. Quella scelta nello Studio per il personaggio (della
 * storia che si registra, o l'ultima scelta), se c'è; se no una dell'account
 * del suo genere, la meno usata: due personaggi con la stessa voce non si
 * distinguono, ma una Luna con la voce d'uomo è peggio. Finite le voci del
 * genere si ricomincia dalla prima, a giro. */
function vfilmScegliVociEleven(battute, voci, voceDi) {
  const S = window.StudioStorie;
  const scelte = new Map(), usate = new Map();
  const valida = id => typeof id === 'string' && /^[A-Za-z0-9]{10,40}$/.test(id);
  const chi = [...new Set(battute.map(b => b.chi))];
  for (const id of chi) {
    let v = typeof voceDi === 'function' ? voceDi(id) : null;
    if (!v && S && typeof S.voceDi === 'function' && id) v = S.voceDi(null, id);
    const vid = v && (typeof v === 'string' ? v : v.id);
    if (valida(vid)) { scelte.set(id, vid); usate.set(vid, (usate.get(vid) || 0) + 1); }
  }
  for (const id of chi) {
    if (scelte.has(id)) continue;
    const g = vfilmProfilo(id).genere;
    const suoi = voci.filter(v => v.genere === g);
    const fra = suoi.length ? suoi : voci;
    if (!fra.length) continue;
    const meno = fra.reduce((a, v) => ((usate.get(v.id) || 0) < (usate.get(a.id) || 0) ? v : a), fra[0]);
    scelte.set(id, meno.id); usate.set(meno.id, (usate.get(meno.id) || 0) + 1);
  }
  return scelte;
}
async function vfilmElevenParla(imp, voce, testo) {
  const stabilita = imp.modello === 'eleven_v3' ? imp.stabilita : Math.max(0.3, Math.min(0.7, imp.stabilita));
  return vfilmEleven(imp, 'POST', `/v1/text-to-speech/${encodeURIComponent(voce)}?output_format=${VFILM_ELEVEN_FORMATO}`,
    { text: testo, model_id: imp.modello, voice_settings: { stability: stabilita, similarity_boost: 0.8 } }, true);
}

// =====================================================================
// 5. Piper, nel browser
// =====================================================================

function vfilmScript(src) {
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => ok(); s.onerror = () => ko(new Error(vfilmT('err.scarica', { file: src.split('/').pop() })));
    document.head.append(s);
  });
}
/* Un file grande, una volta sola: dalla cache del browser se c'è, se no
 * dalla rete col conto dei byte (per la barra) e poi nella cache. */
async function vfilmScarica(url, avanzamento) {
  let cache = null;
  try { cache = typeof caches !== 'undefined' ? await caches.open(VFILM_CACHE_PIPER) : null; } catch (_) { cache = null; }
  const salvato = cache ? await cache.match(url).catch(() => null) : null;
  if (salvato) return salvato.arrayBuffer();
  const r = await fetch(url);
  if (!r.ok) throw new Error(vfilmT('err.scarica', { file: url.split('/').pop() }) + ' (HTTP ' + r.status + ')');
  const totale = Number(r.headers.get('content-length')) || 0;
  let dati;
  if (r.body && r.body.getReader && avanzamento) {
    const lettore = r.body.getReader(), pezzi = [];
    let letti = 0;
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      pezzi.push(value); letti += value.length;
      avanzamento(letti, totale);
    }
    dati = new Uint8Array(letti);
    let o = 0;
    for (const p of pezzi) { dati.set(p, o); o += p.length; }
    dati = dati.buffer;
  } else dati = await r.arrayBuffer();
  if (cache) cache.put(url, new Response(dati.slice(0), { headers: { 'content-type': 'application/octet-stream' } })).catch(() => null);
  return dati;
}
// Il motore (onnxruntime e il fonemizzatore) e i modelli che servono
async function vfilmPiperPronto(modelli, avanzamento) {
  if (!window.ort) await vfilmScript(VFILM_ORT + 'ort.wasm.min.js');
  const ort = window.ort;
  if (!ort || !ort.InferenceSession) throw new Error(vfilmT('err.motore'));
  ort.env.wasm.wasmPaths = VFILM_ORT;
  ort.env.wasm.numThreads = 1;
  if (!vfilm.piper.fonemi) {
    if (typeof window.createPiperPhonemize !== 'function') await vfilmScript(VFILM_FONEMI + '.js');
    const wasm = await vfilmScarica(VFILM_FONEMI + '.wasm');
    const data = await vfilmScarica(VFILM_FONEMI + '.data', (l, t) => avanzamento && avanzamento('motore', l, t));
    vfilm.piper.fonemi = { wasm, data };
  }
  for (const m of modelli) {
    if (vfilm.piper.modelli.has(m)) continue;
    let ultimo = null;
    for (const base of VFILM_MODELLI) {
      try {
        const cfg = JSON.parse(new TextDecoder().decode(await vfilmScarica(base + m + '.onnx.json')));
        const onnx = await vfilmScarica(base + m + '.onnx', (l, t) => avanzamento && avanzamento(m, l, t));
        const sessione = await ort.InferenceSession.create(onnx, { executionProviders: ['wasm'] });
        vfilm.piper.modelli.set(m, { cfg, sessione });
        break;
      } catch (e) { ultimo = e; }
    }
    if (!vfilm.piper.modelli.has(m)) throw ultimo || new Error(vfilmT('err.motore'));
  }
}
/* Dal testo ai fonemi, con espeak-ng (il programma `piper_phonemize`): un
 * modulo nuovo a ogni frase, come fa Piper, ma col wasm e i dati già in
 * memoria, così non si scarica niente due volte. */
function vfilmFonemi(testo, voce) {
  const f = vfilm.piper.fonemi;
  return new Promise((ok, ko) => {
    let fatto = false;
    const timer = setTimeout(() => { if (!fatto) { fatto = true; ko(new Error(vfilmT('err.motore'))); } }, 20000);
    const fine = (err, ids) => { if (fatto) return; fatto = true; clearTimeout(timer); if (err) ko(err); else ok(ids); };
    window.createPiperPhonemize({
      print: riga => { try { const j = JSON.parse(riga); if (Array.isArray(j.phoneme_ids)) fine(null, j.phoneme_ids); } catch (_) { /* una riga che non è il risultato */ } },
      printErr: () => {},
      locateFile: u => (u.endsWith('.wasm') ? VFILM_FONEMI + '.wasm' : u.endsWith('.data') ? VFILM_FONEMI + '.data' : u),
      wasmBinary: f.wasm,
      getPreloadedPackage: () => f.data.slice(0)
    }).then(mod => {
      mod.callMain(['-l', voce, '--input', JSON.stringify([{ text: testo }]), '--espeak_data', '/espeak-ng-data']);
    }).catch(e => fine(e));
  });
}
// Le frasi di un testo, a pezzi che il modello regge
function vfilmPezzi(testo) {
  const frasi = String(testo).match(/[^.!?…;:]+[.!?…;:]*\s*/g) || [testo];
  const pezzi = [];
  let ora = '';
  for (const f of frasi) {
    if ((ora + f).length > VFILM_PEZZO_MAX && ora.trim()) { pezzi.push(ora.trim()); ora = ''; }
    ora += f;
  }
  if (ora.trim()) pezzi.push(ora.trim());
  return pezzi;
}
// Il tono del personaggio: l'altezza (dai Hz della sintesi) e la velocità
function vfilmTono(tono) {
  const hz = parseFloat(tono && tono.tono) || 0, perc = parseFloat(tono && tono.ritmo) || 0;
  return {
    altezza: Math.max(VFILM_ALTEZZA.min, Math.min(VFILM_ALTEZZA.max, 1 + hz * VFILM_ALTEZZA.perHz)),
    velocita: Math.max(0.75, Math.min(1.35, 1 + perc / 100))
  };
}
// Un WAV a 16 bit da campioni fra -1 e 1, alla frequenza data
function vfilmWav(campioni, frequenza) {
  const n = campioni.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const scrivi = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  scrivi(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); scrivi(8, 'WAVE'); scrivi(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, frequenza, true); v.setUint32(28, frequenza * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  scrivi(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, campioni[i] || 0)); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}
/* Una battuta con Piper. L'altezza senza cambiare la velocità: il modello
 * parla più lento di quanto la voce deve salire (`length_scale` × altezza) e
 * il file dichiara una frequenza più alta della stessa misura, così suona
 * più acuto e torna alla velocità giusta. Fra due frasi, un quinto di
 * secondo di silenzio. */
async function vfilmPiperParla(testo, modello, tono) {
  const ort = window.ort;
  const { cfg, sessione } = vfilm.piper.modelli.get(modello);
  const inf = cfg.inference || {};
  const { altezza, velocita } = vfilmTono(tono);
  const frequenza = (cfg.audio && cfg.audio.sample_rate) || 22050;
  const parti = [];
  for (const pezzo of vfilmPezzi(testo)) {
    const ids = await vfilmFonemi(pezzo, (cfg.espeak && cfg.espeak.voice) || (modello.startsWith('it') ? 'it' : 'en-us'));
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(x => BigInt(x))), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) * altezza / velocita, inf.noise_w ?? 0.8]), [3])
    };
    if ((cfg.num_speakers || 1) > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
    const uscita = await sessione.run(feeds);
    const dati = (uscita.output || Object.values(uscita)[0]).data;
    if (parti.length) parti.push(new Float32Array(Math.round(frequenza * altezza * 0.2)));
    parti.push(dati);
  }
  const tutti = new Float32Array(parti.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parti) { tutti.set(p, o); o += p.length; }
  return vfilmWav(tutti, Math.round(frequenza * altezza));
}
const vfilmModelloPiper = (chi, lingua) => (VFILM_PIPER_VOCI[lingua] || VFILM_PIPER_VOCI.en)[vfilmProfilo(chi).genere];
// Quanto si scaricherebbe adesso per le voci di queste battute (0 se è tutto qui)
function vfilmMbPiper(battute, lingua) {
  const modelli = [...new Set(battute.map(b => vfilmModelloPiper(b.chi, lingua)))].filter(m => !vfilm.piper.modelli.has(m));
  let mb = vfilm.piper.fonemi ? 0 : VFILM_PIPER_MB.motore;
  for (const m of modelli) mb += /x_low$/.test(m) ? VFILM_PIPER_MB.x_low : VFILM_PIPER_MB.medium;
  return mb;
}

// =====================================================================
// 6. Il lavoro: genera, metti da parte, presta alla narrazione
// =====================================================================

/* Genera le voci che mancano col motore scelto. `lavoro.fermato` lo ferma
 * fra una battuta e l'altra. Ritorna { fatte, errori } e lascia in
 * `lavoro.voci` testo → blob, per tutte quelle che ci sono. */
async function vfilmGenera(lavoro, motore, aggiorna) {
  const lingua = lavoro.lingua;
  const battute = lavoro.battute.filter(b => !lavoro.voci.has(b.testo));
  let imp = null, scelte = null;
  if (motore === 'eleven') {
    imp = vfilmElevenImpostazioni();
    if (!imp) throw new Error(vfilmT('err.senzaChiave'));
  }
  const errori = [];
  let fatte = 0;
  for (let i = 0; i < battute.length; i++) {
    if (lavoro.fermato) break;
    const b = battute[i];
    const k = vfilmChiave(motore, b, lingua);
    aggiorna({ fase: 'genera', i, totale: battute.length, chi: vfilmProfilo(b.chi).nome });
    try {
      let rec = await vfilmLeggi(k);
      let voce = '';
      if (motore === 'eleven') {
        if (!scelte) scelte = vfilmScegliVociEleven(lavoro.battute, await vfilmVociEleven(imp), lavoro.voceDi);
        voce = scelte.get(b.chi) || '';
        if (!voce) throw new Error(vfilmT('err.senzaVoci'));
      } else voce = vfilmModelloPiper(b.chi, lingua) + '|' + JSON.stringify(vfilmTono(vfilmProfilo(b.chi).tono));
      if (!rec || !rec.blob || rec.voce !== voce) {
        let blob;
        if (motore === 'eleven') blob = await vfilmElevenParla(imp, voce, b.testo);
        else {
          const modello = voce.split('|')[0];
          await vfilmPiperPronto([modello], (m, letti, tot) => aggiorna({ fase: 'scarica', i, totale: battute.length, letti, tot }));
          blob = await vfilmPiperParla(b.testo, modello, vfilmProfilo(b.chi).tono);
        }
        if (!blob || !blob.size) throw new Error(vfilmT('err.vuota'));
        rec = { blob, voce, testo: b.testo, motore };
        await vfilmScrivi(k, rec);
      }
      lavoro.voci.set(b.testo, rec.blob);
      fatte++;
    } catch (e) {
      errori.push({ battuta: b, messaggio: e && e.message || String(e) });
      // senza crediti, o senza chiave buona, le altre falliranno uguale
      if (motore === 'eleven' && (e.crediti || /401|chiave|key/i.test(e.message || ''))) break;
      if (motore === 'piper' && !vfilm.piper.modelli.size) break;
    }
  }
  return { fatte, errori };
}
// Presta le voci alla narrazione (per la registrazione), o le riprende
function vfilmPresta(voci) {
  vfilmRiprendi();
  const mappa = {};
  for (const [testo, blob] of voci) { const u = URL.createObjectURL(blob); vfilm.urls.push(u); mappa[testo] = u; }
  if (typeof narrazione === 'object' && narrazione.vociFilmato) narrazione.vociFilmato(mappa);
  return Object.keys(mappa).length;
}
function vfilmRiprendi() {
  if (typeof narrazione === 'object' && narrazione.vociFilmato) narrazione.vociFilmato(null);
  for (const u of vfilm.urls) { try { URL.revokeObjectURL(u); } catch (_) { /* niente */ } }
  vfilm.urls = [];
}

// =====================================================================
// 7. La finestra «Le voci del filmato»
// =====================================================================

function vfilmEl(tag, attr, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attr || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of figli.flat()) if (f !== null && f !== undefined && f !== false) el.append(f);
  return el;
}

/* Prima di registrare per YouTube. Risponde `false` se non c'è niente da
 * fare (nessuna battuta andrebbe alla voce del dispositivo): chi chiama
 * parte subito come prima. Se no apre la finestra e risponde `true`;
 * `parti()` partirà dal tocco su «Registra e pubblica». */
function vfilmPrimaDiRegistrare(testo, parti, opz = {}) {
  if (typeof document === 'undefined') return false;
  let battute;
  try { battute = vfilmBattute(testo); } catch (_) { return false; }
  if (!battute.length) { vfilmRiprendi(); return false; }
  vfilmChiudi();
  vfilm.finestra = {
    stato: 'scelta', parti, voceDi: opz.voceDi || null,
    lavoro: { battute, lingua: vfilmLingua(), voci: new Map(), voceDi: opz.voceDi || null, fermato: false },
    eleven: !!vfilmElevenImpostazioni(), gia: { eleven: null, piper: null }, avanzamento: null, esito: null, errore: ''
  };
  vfilmDisegna();
  // le voci già fatte una volta non costano niente: si dice quante sono
  const f = vfilm.finestra;
  Promise.all([vfilmGiaFatte('eleven', battute, f.lavoro.lingua), vfilmGiaFatte('piper', battute, f.lavoro.lingua)]).then(([e, p]) => {
    if (vfilm.finestra !== f) return;
    f.gia = { eleven: e, piper: p };
    if (f.stato === 'scelta') vfilmDisegna();
  });
  return true;
}
function vfilmChiudi() {
  const f = vfilm.finestra;
  if (!f) return;
  f.lavoro.fermato = true;
  if (f.el) f.el.remove();
  document.removeEventListener('keydown', vfilmTasti, true);
  vfilm.finestra = null;
}
function vfilmTasti(e) {
  if (e.key === 'Escape' && vfilm.finestra && vfilm.finestra.stato !== 'genera') { e.preventDefault(); vfilmChiudi(); }
}
async function vfilmScegli(motore) {
  const f = vfilm.finestra;
  if (!f) return;
  f.stato = 'genera'; f.motore = motore; f.errore = ''; f.avanzamento = { fase: 'genera', i: 0, totale: f.lavoro.battute.length };
  vfilmDisegna();
  let esito;
  try {
    esito = await vfilmGenera(f.lavoro, motore, a => { if (vfilm.finestra === f) { f.avanzamento = a; vfilmAggiornaBarra(); } });
  } catch (e) { esito = { fatte: 0, errori: [{ messaggio: e && e.message || String(e) }] }; }
  if (vfilm.finestra !== f) return;
  f.esito = esito; f.stato = 'pronta';
  vfilmDisegna();
}
function vfilmRegistra() {
  const f = vfilm.finestra;
  if (!f) return;
  const parti = f.parti, voci = f.lavoro.voci;
  vfilmChiudi();
  vfilmPresta(voci);
  // dentro al tocco: lo schermo intero e l'audio partono
  if (typeof narrazione === 'object' && narrazione.sbloccaContesto) { try { narrazione.sbloccaContesto(); } catch (_) { /* niente */ } }
  parti();
}
function vfilmAggiornaBarra() {
  const f = vfilm.finestra;
  if (!f || !f.el) return;
  const a = f.avanzamento || {};
  const barra = f.el.querySelector('.yt-barra'), testo = f.el.querySelector('.yt-barra-testo');
  if (!barra || !testo) return;
  if (a.fase === 'scarica') {
    const quota = a.tot ? a.letti / a.tot : 0;
    barra.value = Math.round(quota * 100);
    testo.textContent = vfilmT('scarico', { mb: Math.round((a.letti || 0) / 1048576), di: a.tot ? Math.round(a.tot / 1048576) : '?' });
  } else {
    barra.value = a.totale ? Math.round(a.i / a.totale * 100) : 0;
    testo.textContent = vfilmT(a.chi ? 'genero' : 'generoSenzaNome', { n: (a.i || 0) + 1, di: a.totale || 0, chi: a.chi || '' });
  }
}
function vfilmDisegna() {
  const f = vfilm.finestra;
  if (!f) return;
  const battute = f.lavoro.battute, caratteri = vfilmCaratteri(battute);
  const corpo = vfilmEl('div', { class: 'yt-corpo' });
  const tasto = (chiave, testo, nota, fai, primario) => vfilmEl('button', { type: 'button', class: 'yt-scelta vfilm-scelta' + (primario ? ' vfilm-consigliata' : ''), dataset: { vfilm: chiave }, onclick: fai },
    vfilmEl('span', {}, testo), nota ? vfilmEl('small', {}, nota) : null);
  if (f.stato === 'scelta') {
    corpo.append(vfilmEl('p', { class: 'yt-messaggio' }, vfilmT('spiega', { n: battute.length, caratteri })));
    const scelte = vfilmEl('div', { class: 'vfilm-scelte' });
    if (f.eleven) {
      const gia = f.gia.eleven, costo = Math.max(0, caratteri - (gia ? gia.caratteri : 0));
      scelte.append(tasto('eleven', vfilmT('eleven'), gia && gia.n ? vfilmT('elevenNotaGia', { caratteri: costo, gia: gia.n }) : vfilmT('elevenNota', { caratteri: costo }), () => vfilmScegli('eleven'), true));
    }
    const mb = vfilmMbPiper(battute, f.lavoro.lingua);
    scelte.append(tasto('piper', vfilmT('piper'), mb ? vfilmT('piperNota', { mb }) : vfilmT('piperNotaPronta'), () => vfilmScegli('piper'), !f.eleven));
    const edge = typeof window !== 'undefined' && String(window.EDGE_TTS_API_URL || '').trim();
    scelte.append(tasto('senza', vfilmT('senza'), vfilmT(edge ? 'senzaNotaEdge' : 'senzaNota'), () => { f.lavoro.voci.clear(); vfilmRegistraSubito(); }));
    corpo.append(scelte);
    if (!f.eleven) corpo.append(vfilmEl('p', { class: 'yt-nota' }, vfilmT('senzaChiave')));
    corpo.append(vfilmEl('div', { class: 'yt-tasti' }, vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vfilm: 'annulla' }, onclick: vfilmChiudi }, vfilmT('annulla'))));
  } else if (f.stato === 'genera') {
    corpo.append(vfilmEl('p', { class: 'yt-messaggio' }, vfilmT(f.motore === 'eleven' ? 'inCorsoEleven' : 'inCorsoPiper')));
    corpo.append(vfilmEl('div', { class: 'yt-avanzamento' },
      vfilmEl('progress', { class: 'yt-barra', max: '100', value: '0', 'aria-label': vfilmT('avanzamento') }),
      vfilmEl('span', { class: 'yt-barra-testo', 'aria-live': 'polite' }, '')));
    corpo.append(vfilmEl('div', { class: 'yt-tasti' }, vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vfilm: 'ferma' },
      onclick: () => { f.lavoro.fermato = true; } }, vfilmT('ferma'))));
  } else {
    const e = f.esito || { fatte: 0, errori: [] };
    const pronte = f.lavoro.voci.size, mancano = battute.length - pronte;
    corpo.append(vfilmEl('p', { class: 'yt-messaggio' + (mancano ? '' : ' ok'), role: 'status' },
      mancano ? vfilmT('parziale', { pronte, mancano }) : vfilmT('pronte', { n: pronte })));
    if (e.errori.length) corpo.append(vfilmEl('p', { class: 'yt-messaggio errore vfilm-errore' }, e.errori[0].messaggio));
    const tasti = vfilmEl('div', { class: 'yt-tasti' },
      vfilmEl('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { vfilm: 'registra' }, onclick: vfilmRegistra }, vfilmT('registra')));
    // con ElevenLabs a metà (i crediti finiti), le altre con Piper
    if (mancano && f.motore === 'eleven')
      tasti.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vfilm: 'altrePiper' }, onclick: () => vfilmScegli('piper') }, vfilmT('altrePiper')));
    else if (mancano)
      tasti.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vfilm: 'riprova' }, onclick: () => vfilmScegli(f.motore) }, vfilmT('riprova')));
    tasti.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vfilm: 'annulla' }, onclick: vfilmChiudi }, vfilmT('annulla')));
    corpo.append(tasti);
  }
  const finestra = vfilmEl('div', { class: 'yt-finestra vfilm-finestra' },
    vfilmEl('div', { class: 'yt-testa' },
      vfilmEl('h2', { id: 'vfilm-titolo' }, vfilmT('titolo')),
      vfilmEl('button', { type: 'button', class: 'yt-x', 'aria-label': vfilmT('annulla'), title: vfilmT('annulla'), disabled: f.stato === 'genera', onclick: vfilmChiudi },
        vfilmEl('span', { 'aria-hidden': 'true' }, '×'))),
    corpo);
  if (!f.el) {
    f.el = vfilmEl('div', { class: 'yt-velo', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vfilm-titolo', id: 'vfilm-finestra' });
    f.el.addEventListener('mousedown', e => { if (e.target === f.el && f.stato !== 'genera') vfilmChiudi(); });
    const fe = document.fullscreenElement;
    (fe && fe !== document.documentElement ? fe : document.body).append(f.el);
    document.addEventListener('keydown', vfilmTasti, true);
  }
  f.el.replaceChildren(finestra);
  if (f.stato === 'genera') vfilmAggiornaBarra();
  const primo = f.el.querySelector(f.stato === 'pronta' ? '[data-vfilm="registra"]' : '.vfilm-consigliata, [data-vfilm="ferma"]');
  if (primo) primo.focus();
}
// «Registra così»: niente da generare, si parte da questo tocco
function vfilmRegistraSubito() {
  const f = vfilm.finestra;
  if (!f) return;
  const parti = f.parti;
  vfilmChiudi();
  vfilmRiprendi();
  parti();
}

if (typeof window !== 'undefined') {
  window.vfilmPrimaDiRegistrare = vfilmPrimaDiRegistrare;
  window.vfilmRiprendi = vfilmRiprendi;
  window.VociFilmato = {
    battute: vfilmBattute, scegliVociEleven: vfilmScegliVociEleven, tono: vfilmTono, wav: vfilmWav, pezzi: vfilmPezzi,
    genera: vfilmGenera, presta: vfilmPresta, riprendi: vfilmRiprendi, chiave: vfilmChiave, piperPronto: vfilmPiperPronto,
    piperParla: vfilmPiperParla, fonemi: vfilmFonemi, modelloPiper: vfilmModelloPiper, mbPiper: vfilmMbPiper,
    stato: vfilm, VFILM_PIPER_VOCI, VFILM_MODELLI, VFILM_ORT, VFILM_FONEMI, VFILM_DB
  };
}
