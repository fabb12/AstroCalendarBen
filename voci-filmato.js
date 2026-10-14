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
  // v482: la faccia che ognuno ha quando parla (per la regia della voce): quella
  // di `character_show` o di un `character_expression` all'inizio della scena
  const facce = new Map();
  for (const scena of demo.scene) for (const a of scena.azioni) {
    const pp = a.parametri || {};
    if ((a.comando === 'character_show' || a.comando === 'character_expression') && pp.target && pp.expression &&
      (a.comando === 'character_show' || !(a.ripresa && a.ripresa.da > 0.1)))
      facce.set(S && S.canonico ? S.canonico(pp.target) : pp.target, pp.expression);
    if (a.comando !== 'character_speak' && a.comando !== 'narrate') continue;
    const p = a.parametri || {};
    const frase = typeof p.text === 'string' ? p.text
      : p.id && typeof astroI18n === 'object' && astroI18n.esiste && astroI18n.esiste(p.id) ? astroI18n.t(p.id) : '';
    if (!frase) continue;
    const chi = a.comando === 'character_speak' && p.target ? (S && S.canonico ? S.canonico(p.target) : p.target) : '';
    const pezzi = narrazione.componi(p.id || '', frase);
    for (const pezzo of pezzi) {
      if (pezzo.audio || !pezzo.testo) continue;
      const k = chi + '|' + pezzo.testo;
      // `id` solo se il pezzo è la battuta intera (la regia è per battuta)
      if (!viste.has(k)) viste.set(k, { chi, testo: pezzo.testo, id: pezzi.length === 1 ? p.id || '' : '', faccia: facce.get(chi) || '' });
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
  // (v487: per ultime le voci delle CosmoStorie, che la storia suona sempre)
  await vfilmDb(st => { const c = st.openCursor(); c.onsuccess = () => { const x = c.result; if (x) { vecchie.push([x.key, (x.value && x.value.quando || 0) + (x.value && x.value.sempre ? 1e13 : 0)]); x.continue(); } }; }).catch(() => null);
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
    // v482: la voce scelta da sola col tasto della CosmoStoria (§8)
    if (!v && id) v = vfilmCastDi(id, vfilmLingua());
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

// =====================================================================
// 8. Le voci di una CosmoStoria con un tocco (v482)
// =====================================================================

/* Chi usa l'app voleva, sulla scheda di una CosmoStoria, **un tasto solo**
 * che generi con ElevenLabs tutte le voci della storia, scegliendo da sé la
 * voce giusta per ogni personaggio. Prima bisognava duplicarla nello Studio
 * e scegliere le voci a mano, personaggio per personaggio.
 *
 *   1. **Il casting** (`vfilmCasting`): per ogni personaggio che parla, la voce
 *      scelta prima (nello Studio, o da questo stesso tasto) se c'è; se no si
 *      cerca nella libreria pubblica di ElevenLabs (`/v1/shared-voices`)
 *      nella lingua di chi guarda, del genere e dell'età del personaggio, e
 *      le voci trovate si danno un voto (`vfilmVotoVoce`, funzione pura) con
 *      le parole che dicono il suo carattere: quelle scritte qui
 *      (`VFILM_CARATTERI`: Cooper ha la voce calda e un po' roca, TARS
 *      asciutta e ironica, Gargantua profondissima) o ricavate dal profilo
 *      (bambini, anziani, robot, buchi neri) e dalla regia delle voci delle
 *      storie (`regia-voci.json`, il carattere scritto in italiano). Due
 *      personaggi della stessa storia non hanno mai la stessa voce. La
 *      vincitrice si aggiunge all'account (l'API la vuole lì) e si ricorda
 *      (`astrocal_voci_cast_v1`, per lingua), con le altre candidate: «Un'altra
 *      voce» passa alla seconda e rifà solo le battute di quel personaggio.
 *   2. **La regia**: ogni battuta parte col suo testo coi tag di ElevenLabs v3
 *      (`regia-voci.json`, `conTag` nella lingua giusta) se il testo è ancora
 *      quello del dizionario; se no col tag della faccia che il personaggio
 *      ha in scena (gli stessi `ELEVEN_TAG_UMORE` dello Studio). Con un
 *      modello che non legge i tag, il testo nudo.
 *   3. **Le voci restano** nello scaffale del filmato (§3), con `sempre`: la
 *      narrazione le suona ogni volta che la storia gira
 *      (`narrazione.vociStorie`), e un filmato per YouTube le trova già fatte.
 *
 * Costa crediti: la finestra lo dice prima di cominciare (le battute e i
 * caratteri), e «Ferma» si ferma dopo la battuta in corso. */
const VFILM_CHIAVE_CAST = 'astrocal_voci_cast_v1';
const VFILM_REGIA = 'audio/narrazione/storie/regia-voci.json';
const VFILM_CANDIDATE = 6;
// Il carattere della voce dei personaggi che lo chiedono: l'età (quella di
// ElevenLabs: young, middle_aged, old) e le parole da cercare, la prima più
// importante. Gli altri lo ricavano dal profilo (`vfilmCarattere`).
const VFILM_CARATTERI = {
  cooper: { eta: 'middle_aged', parole: ['warm', 'raspy', 'deep', 'calm', 'confident'] },
  brand: { eta: 'young', parole: ['clear', 'warm', 'confident', 'emotional'] },
  romilly: { eta: 'middle_aged', parole: ['gentle', 'soft', 'calm', 'british'] },
  doyle: { eta: 'middle_aged', parole: ['gruff', 'firm', 'deep'] },
  mann: { eta: 'middle_aged', parole: ['smooth', 'charming', 'calm'] },
  murph: { eta: 'young', parole: ['emotional', 'warm', 'clear', 'soft'] },
  // v486, «Interstellar · Parte 2»: Murph bambina e anziana, e Loro (una
  // voce calma e ampia, che viene da lontano)
  murph_bambina: { eta: 'young', parole: ['child', 'kid', 'girl', 'bright', 'energetic'] },
  murph_anziana: { eta: 'old', parole: ['warm', 'soft', 'gentle', 'grandmother', 'calm'] },
  loro: { eta: 'middle_aged', parole: ['ethereal', 'calm', 'soothing', 'dreamy', 'mysterious'] },
  tars: { eta: 'middle_aged', parole: ['dry', 'deadpan', 'robotic', 'calm', 'deep'] },
  case: { eta: 'middle_aged', parole: ['calm', 'neutral', 'flat', 'robotic'] },
  gargantua: { eta: 'old', parole: ['deep', 'slow', 'mysterious', 'dark', 'resonant'] },
  miller_planet: { eta: 'middle_aged', parole: ['soft', 'calm', 'mysterious', 'breathy'] },
  mann_planet: { eta: 'old', parole: ['cold', 'deep', 'slow', 'whisper'] },
  einstein: { eta: 'old', parole: ['warm', 'playful', 'raspy', 'grandfather'] },
  astro_ben: { eta: 'young', parole: ['child', 'kid', 'boy', 'cheerful', 'energetic'] },
  zaira: { eta: 'young', parole: ['child', 'kid', 'girl', 'cheerful', 'bright'] },
  sagan: { eta: 'middle_aged', parole: ['warm', 'calm', 'storyteller', 'narration'] },
  hawking: { eta: 'old', parole: ['calm', 'witty', 'slow', 'robotic'] }
};
// Le parole del carattere scritto in italiano (regia-voci.json) → quelle da
// cercare fra le voci di ElevenLabs, che sono descritte in inglese
const VFILM_PAROLE_IT = [
  [/profond/, 'deep'], [/cald/, 'warm'], [/roc/, 'raspy'], [/bambin|ragazzin/, 'child'], [/anzian|vecchi|nonn/, 'old'],
  [/metallic|robot/, 'robotic'], [/chiar|luminos|limpid/, 'bright'], [/dolc|morbid|gentil/, 'soft'], [/misterios/, 'mysterious'],
  [/ironic|scherzos|giocos/, 'playful'], [/calm|tranquill|lent/, 'calm'], [/svelt|rapid|vivac|energic/, 'energetic'],
  [/sussurr/, 'whisper'], [/rassicurant|patient/, 'soothing'], [/sognant|ampia/, 'dreamy'], [/teatral|enfatic/, 'theatrical']
];
const vfilmRegia = { dati: null, promessa: null };
const vfilmCercate = new Map();       // la ricerca nella libreria, per non rifarla

function vfilmArchivio() { try { return window.localStorage || null; } catch (_) { return null; } }
function vfilmCastTutto() {
  try { const d = JSON.parse((vfilmArchivio() && vfilmArchivio().getItem(VFILM_CHIAVE_CAST)) || '{}'); return d && typeof d === 'object' ? d : {}; }
  catch (_) { return {}; }
}
const vfilmIdValido = id => typeof id === 'string' && /^[A-Za-z0-9]{8,40}$/.test(id);
// La voce scelta per un personaggio in una lingua: { id, nome, anteprima, genere, candidate }
function vfilmCastDi(id, lingua) {
  const v = ((vfilmCastTutto()[lingua] || {})[id]) || null;
  return v && vfilmIdValido(v.id) ? v : null;
}
function vfilmCastSalva(id, lingua, voce) {
  const tutto = vfilmCastTutto();
  tutto[lingua] = Object.assign({}, tutto[lingua]);
  if (voce) tutto[lingua][id] = voce; else delete tutto[lingua][id];
  try { const a = vfilmArchivio(); if (a) a.setItem(VFILM_CHIAVE_CAST, JSON.stringify(tutto)); } catch (_) { /* resta per questa volta */ }
}

/* Il carattere di una voce: le righe di `VFILM_CARATTERI`, se no quello che
 * il profilo dice (bambini, anziani, robot, buchi neri, stelle, il tono
 * della sintesi), più le parole del carattere scritto nella regia. Funzione
 * pura del profilo e del testo. */
function vfilmCarattere(id, profilo, descrizione) {
  const fisso = VFILM_CARATTERI[id];
  const p = profilo || {};
  const f = p.figura || {};
  let eta = '', parole = [];
  if (fisso) { eta = fisso.eta || ''; parole = fisso.parole.slice(); }
  else {
    if (f.bambino) { eta = 'young'; parole.push('child', 'kid', 'cheerful'); }
    else if (f.segni && f.segni.rughe) eta = 'old';
    if (p.famiglia === 'robot') parole.push('robotic', 'calm');
    if (p.famiglia === 'buco') { eta = eta || 'old'; parole.push('deep', 'slow', 'mysterious'); }
    if (p.famiglia === 'stella') parole.push('warm', 'bright');
    if (p.famiglia === 'galassia') parole.push('dreamy', 'soft');
    const hz = parseFloat(p.voce && p.voce.tono) || 0;
    if (hz <= -12) parole.push('deep');
    if (hz >= 30 && !f.bambino) parole.push('young');
  }
  const d = String(descrizione || '').toLowerCase();
  for (const [re, parola] of VFILM_PAROLE_IT) if (re.test(d) && !parole.includes(parola)) parole.push(parola);
  if (!parole.length) parole.push('warm', 'friendly');
  return { genere: p.genere === 'f' ? 'f' : 'm', eta, parole: parole.slice(0, 6) };
}
/* Il voto di una voce della libreria per un carattere (funzione pura): l'età
 * giusta, le parole trovate nella sua descrizione (la prima vale di più),
 * l'uso da racconto o da personaggio, la lingua, e un poco quanto è usata. */
function vfilmVotoVoce(v, carattere, lingua) {
  if (!v) return -Infinity;
  const et = v.labels && typeof v.labels === 'object' ? Object.values(v.labels).join(' ') : '';
  const testo = [v.name, v.description, v.descriptive, v.accent, v.use_case, v.category, et].filter(Boolean).join(' ').toLowerCase();
  let voto = 0;
  const eta = String(v.age || (v.labels && v.labels.age) || '').toLowerCase().replace(/\s+/g, '_');
  if (carattere.eta && eta === carattere.eta) voto += 4;
  else if (carattere.eta && eta && ((carattere.eta === 'old') !== (eta === 'old'))) voto -= 1.5;
  carattere.parole.forEach((parola, i) => { if (testo.includes(parola)) voto += i === 0 ? 3 : 2; });
  if (/narrat|character|animation|audiobook|storytell|video_?game/.test(testo)) voto += 2;
  const lingue = [v.language].concat((v.verified_languages || []).map(x => x && x.language));
  if (lingue.includes(lingua)) voto += 1.5;
  const genere = String(v.gender || (v.labels && v.labels.gender) || '').toLowerCase();
  if (genere && genere !== (carattere.genere === 'f' ? 'female' : 'male')) voto -= 10;
  voto += Math.min(2, Math.log10(1 + (Number(v.cloned_by_count) || 0)) / 2);
  return voto;
}
// La regia scritta delle voci (una volta sola; senza rete, niente)
async function vfilmLeggiRegia() {
  if (vfilmRegia.dati) return vfilmRegia.dati;
  if (!vfilmRegia.promessa) vfilmRegia.promessa = fetch(VFILM_REGIA).then(r => (r.ok ? r.json() : null)).catch(() => null);
  vfilmRegia.dati = (await vfilmRegia.promessa) || { personaggi: {}, battute: {} };
  return vfilmRegia.dati;
}
// La cartella (e la chiave della regia) di un personaggio: il nome italiano
const vfilmCartella = nome => String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function vfilmNomeItaliano(id) {
  const S = window.StorieCosmiche;
  const p = S && S.profilo ? S.profilo(id) : null;
  const diz = window.ASTRO_DIZIONARI && window.ASTRO_DIZIONARI.it && window.ASTRO_DIZIONARI.it.messaggi;
  return (p && p.nome && diz && diz[p.nome]) || (S && S.nome ? S.nome(id) : id);
}
/* Il testo che parte per una battuta: quello coi tag della regia, se è
 * ancora la stessa battuta; se no col tag della faccia. Coi modelli che non
 * leggono i tag, il testo nudo. Funzione pura (la regia si passa). */
function vfilmTestoConRegia(b, lingua, regia, modello) {
  if (modello && modello !== 'eleven_v3') return b.testo;
  const r = b.id && regia && regia.battute && regia.battute[b.id];
  const conTag = r && r.conTag && r.conTag[lingua];
  const nudo = x => String(x || '').replace(/\[[^\]]*\]\s*/g, '').replace(/\s+/g, ' ').trim();
  if (conTag && nudo(conTag) === nudo(b.testo)) return conTag;
  const S = window.StudioStorie;
  const tabella = (S && S.ELEVEN_TAG_UMORE) || {};
  const tag = b.faccia && tabella[b.faccia];
  return tag ? '[' + tag + '] ' + b.testo : b.testo;
}
// Una ricerca nella libreria pubblica, tenuta a mente
async function vfilmCercaLibreria(imp, q) {
  const k = q.toString();
  if (vfilmCercate.has(k)) return vfilmCercate.get(k);
  const r = await vfilmEleven(imp, 'GET', '/v1/shared-voices?' + k);
  const voci = (r && Array.isArray(r.voices) ? r.voices : []).filter(v => v && vfilmIdValido(v.voice_id));
  vfilmCercate.set(k, voci);
  return voci;
}
/* Le candidate per un carattere, la migliore prima. La libreria nella lingua
 * di chi guarda (genere ed età, poi la prima parola, poi solo il genere); se
 * la libreria non si può usare (il piano, la chiave), le voci dell'account. */
async function vfilmCandidate(imp, carattere, lingua, gia) {
  const base = () => { const q = new URLSearchParams({ page_size: '40', language: lingua, gender: carattere.genere === 'f' ? 'female' : 'male' }); return q; };
  const trovate = new Map();
  const aggiungi = voci => { for (const v of voci) if (!trovate.has(v.voice_id)) trovate.set(v.voice_id, v); };
  let libreria = true;
  try {
    const q1 = base(); if (carattere.eta) q1.set('age', carattere.eta);
    aggiungi(await vfilmCercaLibreria(imp, q1));
    const q2 = base(); q2.set('search', carattere.parole[0]);
    aggiungi(await vfilmCercaLibreria(imp, q2));
    if (trovate.size < 5) aggiungi(await vfilmCercaLibreria(imp, base()));
  } catch (e) {
    if (/401|chiave|key/i.test(e.message || '') || e.crediti) throw e;
    libreria = false;
  }
  let voci = [...trovate.values()];
  if (!voci.length || !libreria) {
    const mie = await vfilmEleven(imp, 'GET', '/v2/voices?page_size=100').catch(() => null);
    voci = voci.concat((mie && Array.isArray(mie.voices) ? mie.voices : []).filter(v => v && vfilmIdValido(v.voice_id)));
  }
  return voci
    .map(v => ({ v, voto: vfilmVotoVoce(v, carattere, lingua) - (gia.has(v.voice_id) ? 100 : 0) }))
    .sort((a, b) => b.voto - a.voto)
    .slice(0, VFILM_CANDIDATE)
    .map(({ v }) => ({
      id: v.voice_id, nome: String(v.name || '').slice(0, 80), proprietario: typeof v.public_owner_id === 'string' ? v.public_owner_id : '',
      anteprima: String(v.preview_url || ''), genere: carattere.genere,
      descrizione: String(v.description || v.descriptive || '').slice(0, 120)
    }));
}
/* Una voce della libreria va messa nell'account perché l'API la faccia
 * parlare. Già presente, o rifiutata (il piano): si prova con l'ID com'è. */
async function vfilmAggiungiVoce(imp, c) {
  if (!c.proprietario) return c.id;
  try {
    const r = await vfilmEleven(imp, 'POST', `/v1/voices/add/${encodeURIComponent(c.proprietario)}/${encodeURIComponent(c.id)}`, { new_name: c.nome || c.id });
    return r && vfilmIdValido(r.voice_id) ? r.voice_id : c.id;
  } catch (e) { return c.id; }
}
/* Il casting di una storia: per ogni personaggio che parla, la voce. Quella
 * già scelta (Studio, o questo tasto) resta; le altre si cercano, senza
 * ripetere una voce già data a un altro personaggio della storia. */
async function vfilmCasting(lavoro, aggiorna) {
  const imp = vfilmElevenImpostazioni();
  if (!imp) throw new Error(vfilmT('err.senzaChiave'));
  const regia = await vfilmLeggiRegia();
  const S = window.StorieCosmiche, St = window.StudioStorie;
  const chi = [...new Set(lavoro.battute.map(b => b.chi).filter(Boolean))];
  const gia = new Set();
  const cast = new Map();
  for (const id of chi) {
    const studio = St && typeof St.voceDi === 'function' ? St.voceDi(null, id) : null;
    const mia = vfilmCastDi(id, lavoro.lingua);
    // (lo Studio conosce anche le voci di questo tasto: se è la stessa, è del cast)
    const v = studio && vfilmIdValido(studio.id) && !(mia && mia.id === studio.id) ? Object.assign({ fonte: 'studio' }, studio)
      : mia ? Object.assign({ fonte: 'cast' }, mia) : null;
    if (v) { cast.set(id, v); gia.add(v.id); }
  }
  let i = 0;
  for (const id of chi) {
    if (lavoro.fermato) break;
    aggiorna({ fase: 'cast', i: i++, totale: chi.length, chi: vfilmProfilo(id).nome });
    if (cast.has(id)) continue;
    const profilo = S && S.profilo ? S.profilo(id) : null;
    const descr = regia && regia.personaggi ? regia.personaggi[vfilmCartella(vfilmNomeItaliano(id))] : '';
    const carattere = vfilmCarattere(id, profilo, descr);
    const candidate = await vfilmCandidate(imp, carattere, lavoro.lingua, gia);
    if (!candidate.length) continue;
    const scelta = candidate[0];
    const voce = { id: await vfilmAggiungiVoce(imp, scelta), nome: scelta.nome, anteprima: scelta.anteprima, genere: scelta.genere,
      libreria: scelta.id, candidate: candidate.map(c => ({ id: c.id, nome: c.nome, proprietario: c.proprietario, anteprima: c.anteprima, descrizione: c.descrizione })) };
    vfilmCastSalva(id, lavoro.lingua, voce);
    cast.set(id, Object.assign({ fonte: 'cast' }, voce));
    gia.add(voce.id);
  }
  lavoro.cast = cast;
  return cast;
}
// «Un'altra voce»: la candidata dopo, che nessun altro della storia ha già
async function vfilmAltraVoce(lavoro, id) {
  const imp = vfilmElevenImpostazioni();
  if (!imp) throw new Error(vfilmT('err.senzaChiave'));
  const ora = lavoro.cast.get(id) || vfilmCastDi(id, lavoro.lingua);
  let candidate = (ora && ora.candidate) || [];
  if (!candidate.length) {
    const S = window.StorieCosmiche;
    candidate = await vfilmCandidate(imp, vfilmCarattere(id, S && S.profilo ? S.profilo(id) : null, ''), lavoro.lingua, new Set());
  }
  const altri = new Set([...lavoro.cast.entries()].filter(([k]) => k !== id).map(([, v]) => v.id));
  const da = Math.max(-1, candidate.findIndex(c => c.id === (ora && (ora.libreria || ora.id))));
  let scelta = null;
  for (let k = 1; k < candidate.length && !scelta; k++) { const c = candidate[(da + k) % candidate.length]; if (!altri.has(c.id)) scelta = c; }
  // le candidate di prima sono tutte già prese: si cerca di nuovo, senza quelle
  if (!scelta) {
    const S = window.StorieCosmiche;
    const usate = new Set([...altri, ora && (ora.libreria || ora.id)]);
    candidate = await vfilmCandidate(imp, vfilmCarattere(id, S && S.profilo ? S.profilo(id) : null, ''), lavoro.lingua, usate);
    scelta = candidate.find(c => !usate.has(c.id)) || null;
  }
  if (!scelta) return null;
  const voce = { id: await vfilmAggiungiVoce(imp, scelta), nome: scelta.nome, anteprima: scelta.anteprima, genere: vfilmProfilo(id).genere,
    libreria: scelta.id, candidate };
  vfilmCastSalva(id, lavoro.lingua, voce);
  lavoro.cast.set(id, Object.assign({ fonte: 'cast' }, voce));
  return voce;
}
/* Genera le battute della storia con le voci del casting. Quelle già fatte
 * con la stessa voce e lo stesso testo non si rifanno (e non costano). */
async function vfilmGeneraStoria(lavoro, aggiorna, soloChi) {
  const imp = vfilmElevenImpostazioni();
  if (!imp) throw new Error(vfilmT('err.senzaChiave'));
  const regia = await vfilmLeggiRegia();
  const battute = lavoro.battute.filter(b => !soloChi || b.chi === soloChi);
  const errori = [];
  lavoro.fatte = [];
  let fatte = 0, spesi = 0;
  for (let i = 0; i < battute.length; i++) {
    if (lavoro.fermato) break;
    const b = battute[i];
    const voce = lavoro.cast.get(b.chi);
    aggiorna({ fase: 'genera', i, totale: battute.length, chi: vfilmProfilo(b.chi).nome });
    if (!voce) { errori.push({ battuta: b, messaggio: vfilmT('err.senzaVoci') }); continue; }
    const inviato = vfilmTestoConRegia(b, lavoro.lingua, regia, imp.modello);
    const k = vfilmChiave('eleven', b, lavoro.lingua);
    try {
      let rec = await vfilmLeggi(k);
      if (!rec || !rec.blob || rec.voce !== voce.id || (rec.inviato && rec.inviato !== inviato)) {
        const blob = await vfilmElevenParla(imp, voce.id, inviato);
        if (!blob || !blob.size) throw new Error(vfilmT('err.vuota'));
        rec = { blob, voce: voce.id, testo: b.testo, motore: 'eleven', inviato };
        spesi += inviato.length;
      }
      // v483: con la battuta (`id`, `chi`) la voce sa dove andare sul
      // repository; una voce rifatta (un blob nuovo) è di nuovo da mandare
      await vfilmScrivi(k, Object.assign({}, rec, { sempre: true, storia: lavoro.chiave, lingua: lavoro.lingua, id: b.id || '', chi: b.chi || '' }));
      lavoro.fatte.push({ chi: b.chi, testo: b.testo, blob: rec.blob, voce: voce.id });
      lavoro.voci.set(b.testo, rec.blob);
      fatte++;
    } catch (e) {
      errori.push({ battuta: b, messaggio: e && e.message || String(e) });
      if (e.crediti || /401|chiave|key/i.test(e.message || '')) break;
    }
  }
  await vfilmCaricaVociStorie();
  return { fatte, errori, spesi };
}
// Le voci delle CosmoStorie nella lingua di adesso, prestate alla narrazione
const vfilmUrlStorie = [];
async function vfilmCaricaVociStorie() {
  if (typeof narrazione !== 'object' || typeof narrazione.vociStorie !== 'function') return 0;
  const lingua = vfilmLingua(), mappa = {};
  const rec = [];
  await vfilmDb(st => { const c = st.openCursor(); c.onsuccess = () => { const x = c.result; if (x) { if (x.value && x.value.sempre && x.value.lingua === lingua && x.value.blob) rec.push(x.value); x.continue(); } }; }).catch(() => null);
  for (const u of vfilmUrlStorie.splice(0)) { try { URL.revokeObjectURL(u); } catch (_) { /* niente */ } }
  for (const r of rec) { const u = URL.createObjectURL(r.blob); vfilmUrlStorie.push(u); mappa[r.testo] = u; }
  return narrazione.vociStorie(mappa);
}
/* v483: le voci delle CosmoStorie sul repository. Prima restavano solo in
 * questo browser, e dagli altri dispositivi la storia parlava con la voce di
 * sistema. Lo Studio le manda col suo giro (`storie-studio.js` §6b): qui si
 * dice quali sono da mandare (fatte, con una battuta del copione, non ancora
 * mandate), si segnano quelle mandate e si ricordano quelle tolte, perché
 * vadano via anche dal repository. */
const VFILM_CHIAVE_TOLTE = 'astrocal_voci_cosmo_tolte_v1';
async function vfilmTutteSempre() {
  const fuori = [];
  await vfilmDb(st => { const c = st.openCursor(); c.onsuccess = () => { const x = c.result; if (x) { if (x.value && x.value.sempre) fuori.push({ chiave: x.key, rec: x.value }); x.continue(); } }; }).catch(() => null);
  return vfilmRiparaVecchie(fuori);
}
/* v487: le voci fatte prima della v483 ritrovano la loro battuta. Chi usa
 * l'app aveva fatto con «Voci ElevenLabs», sullo smartphone, le voci di
 * «Interstellar 1» e salvato la storia: sul PC parlava la voce di sistema, e
 * sul repository non c'era nessun audio. Quelle voci erano della v482, che
 * nel record non scriveva la battuta (`id`, `chi`): per `vfilmPerRepo` non
 * avevano un posto, e restavano in quel browser per sempre. La battuta si
 * ritrova: chi la dice sta nella chiave del record (`eleven|cooper|it|…`), e
 * l'`id` è quello della battuta di una CosmoStoria pronta con lo stesso
 * testo, detto dallo stesso personaggio, nella lingua del record (anche se
 * la voce era stata fatta dalla scheda di una copia dello Studio: il testo è
 * lo stesso, e la narrazione la riconosce dal testo dappertutto). Una voce
 * riparata è `riparata`: va sul repository solo se lì quella battuta non ha
 * già una voce, magari rifatta da un altro dispositivo (`storie-studio.js`). */
function vfilmIndicePronte() {
  const indice = new Map();
  const lib = window.AstroDemo && AstroDemo.libreria;
  let pronte = [];
  try { pronte = lib ? lib.elenco().filter(d => d.storia && !/^utente-/.test(d.chiave || '')) : []; } catch (_) { pronte = []; }
  const S = window.StorieCosmiche;
  const impronta = t => typeof narrazione === 'object' && narrazione.impronta ? narrazione.impronta(t) : String(t || '').replace(/\s+/g, ' ').trim();
  const lingue = typeof astroI18n === 'object' && typeof astroI18n.lingueDisponibili === 'function' ? astroI18n.lingueDisponibili() : [vfilmLingua()];
  for (const d of pronte) {
    let demo = null;
    try { demo = window.AstroDemoMotore && AstroDemoMotore.analizza ? AstroDemoMotore.analizza(d.testo) : null; } catch (_) { demo = null; }
    if (!demo) continue;
    for (const scena of demo.scene) for (const a of scena.azioni) {
      const p = a.parametri || {};
      if (a.comando !== 'character_speak' || !p.target || !/^demo\.narr\.[a-z][\w]*\.\d+$/.test(p.id || '')) continue;
      const chi = S && S.canonico ? S.canonico(p.target) : p.target;
      for (const l of lingue) {
        const frase = vfilmFraseIn(p.id, l);
        if (frase) indice.set([l, chi, impronta(frase)].join('|'), p.id);
      }
    }
  }
  return { indice, impronta };
}
// Una frase del dizionario in una lingua (anche diversa da quella di adesso)
function vfilmFraseIn(id, lingua) {
  const diz = window.ASTRO_DIZIONARI && window.ASTRO_DIZIONARI[lingua];
  const m = diz && diz.messaggi && diz.messaggi[id];
  if (typeof m === 'string') return m;
  return lingua === vfilmLingua() && typeof astroI18n === 'object' && astroI18n.esiste && astroI18n.esiste(id) ? astroI18n.t(id) : '';
}
async function vfilmRiparaVecchie(tutte) {
  const da = tutte.filter(x => x.rec && x.rec.blob && !x.rec.suRepo && !x.rec.senzaPosto && (!x.rec.id || !x.rec.chi));
  if (!da.length) return tutte;
  const { indice, impronta } = vfilmIndicePronte();
  if (!indice.size) return tutte;           // la libreria non c'è ancora: al prossimo giro
  const nuovi = [];
  for (const x of da) {
    const parti = String(x.chiave).split('|');
    const chi = x.rec.chi || (parti[1] && parti[1] !== '-' ? parti[1] : '');
    const id = x.rec.id || (chi ? indice.get([x.rec.lingua, chi, impronta(x.rec.testo)].join('|')) : '');
    // senza una battuta pronta con quel testo non c'è un posto: si ricorda,
    // per non cercarlo a ogni giro (la voce resta e suona qui come prima)
    x.rec = id && chi ? Object.assign({}, x.rec, { id, chi, riparata: true }) : Object.assign({}, x.rec, { senzaPosto: true });
    nuovi.push(x);
  }
  await vfilmDb(st => { for (const x of nuovi) st.put(x.rec, x.chiave); }, 'readwrite').catch(() => null);
  return tutte;
}
const vfilmPerRepo = rec => !!(rec && rec.blob && rec.sempre && /^demo\.narr\.[a-z][\w]*\.\d+$/.test(rec.id || '') && rec.chi && !rec.suRepo);
async function vfilmVociPerRepository() {
  return (await vfilmTutteSempre()).filter(x => vfilmPerRepo(x.rec))
    .map(x => ({ chiave: x.chiave, id: x.rec.id, chi: x.rec.chi, lingua: x.rec.lingua, blob: x.rec.blob, storia: x.rec.storia, riparata: !!x.rec.riparata }));
}
async function vfilmVociInAttesa() { return (await vfilmTutteSempre()).filter(x => vfilmPerRepo(x.rec)).length + vfilmTolte().length; }
/* Dopo «Voci ElevenLabs»: le voci partono subito verso il repository, se
 * c'è il token. Una storia dello Studio le prende fra le sue battute (e le
 * manda col suo giro); una CosmoStoria pronta le manda nelle cartelle dei
 * personaggi. Senza token restano qui, e la finestra lo dice. */
async function vfilmSalvaSulRepository(lavoro, st) {
  const St = window.StudioStorie;
  if (!St || typeof St.sincronizza !== 'function') return { stato: 'senza' };
  const imp = typeof St.repoImpostazioni === 'function' ? St.repoImpostazioni() : null;
  // (le storie dello Studio messe fra le CosmoStorie hanno il loro progetto)
  if (st && st.progetto) {
    if (typeof St.vociDallaScheda !== 'function') return { stato: 'senza' };
    const r = await St.vociDallaScheda(st.chiave, lavoro.fatte || []);
    if (!imp || !imp.token) return { stato: 'senzaToken' };
    return { stato: 'fatto', testo: r.scritto || '' };
  }
  if (!imp || !imp.token) return { stato: 'senzaToken' };
  const titolo = typeof astroI18n === 'object' && astroI18n.esiste && astroI18n.esiste('demo.builtin.' + lavoro.chiave + '.title')
    ? astroI18n.t('demo.builtin.' + lavoro.chiave + '.title') : lavoro.chiave;
  return { stato: 'fatto', testo: await St.sincronizza({ spingi: true, titolo: 'voci di ' + titolo }), pronta: true };
}
// `fatte`: [{ chiave, percorso, sha }], appena scritte (o già uguali) sul repository
async function vfilmSegnaSulRepository(fatte) {
  for (const f of fatte || []) {
    const rec = await vfilmLeggi(f.chiave);
    if (!rec || !rec.blob) continue;
    await vfilmDb(st => st.put(Object.assign({}, rec, { suRepo: { percorso: f.percorso, sha: f.sha } }), f.chiave), 'readwrite').catch(() => null);
  }
}
function vfilmTolte() {
  try { const d = JSON.parse((vfilmArchivio() && vfilmArchivio().getItem(VFILM_CHIAVE_TOLTE)) || '[]'); return Array.isArray(d) ? d.filter(x => x && typeof x.percorso === 'string' && /^[0-9a-f]{40}$/.test(x.sha || '')) : []; }
  catch (_) { return []; }
}
function vfilmSalvaTolte(elenco) {
  try { const a = vfilmArchivio(); if (a) a.setItem(VFILM_CHIAVE_TOLTE, JSON.stringify(elenco.slice(-500))); } catch (_) { /* al prossimo «Togli» */ }
}
function vfilmDimenticaTolte(percorsi) {
  const via = new Set(percorsi || []);
  vfilmSalvaTolte(vfilmTolte().filter(x => !via.has(x.percorso)));
}
// «Togli queste voci»: la storia torna alle voci di prima
async function vfilmTogliVociStoria(chiave) {
  const via = [];
  const tolte = vfilmTolte();
  await vfilmDb(st => { const c = st.openCursor(); c.onsuccess = () => { const x = c.result; if (x) { if (x.value && x.value.sempre && x.value.storia === chiave) { via.push(x.key); if (x.value.suRepo) tolte.push(x.value.suRepo); } x.continue(); } }; }).catch(() => null);
  vfilmSalvaTolte(tolte);
  if (via.length) await vfilmDb(st => { for (const k of via) st.delete(k); }, 'readwrite').catch(() => null);
  await vfilmCaricaVociStorie();
  return via.length;
}
// Quante battute di una storia hanno già la loro voce «sempre»
async function vfilmVociDellaStoria(chiave, lingua) {
  let n = 0;
  await vfilmDb(st => { const c = st.openCursor(); c.onsuccess = () => { const x = c.result; if (x) { if (x.value && x.value.sempre && x.value.storia === chiave && x.value.lingua === lingua) n++; x.continue(); } }; }).catch(() => null);
  return n;
}

// =====================================================================
// 9. La finestra «Le voci della storia»
// =====================================================================

const vcast = { finestra: null, ascolto: null };
/* Il tasto della scheda: apre la finestra e parte subito (il casting non
 * costa crediti, le battute sì, e la finestra dice quante e quanti
 * caratteri). Senza la chiave dice dove metterla. */
function vfilmVociStoria(st, opz = {}) {
  if (typeof document === 'undefined' || !st || !st.testo) return false;
  vfilmChiudiStoria();
  let battute = [];
  try { battute = vfilmBattute(st.testo); } catch (_) { battute = []; }
  const f = vcast.finestra = {
    st, stato: vfilmElevenImpostazioni() ? 'cast' : 'chiave', errore: '', esito: null, avanzamento: null,
    lavoro: { chiave: st.chiave, battute, lingua: vfilmLingua(), voci: new Map(), cast: new Map(), fermato: false }
  };
  vfilmDisegnaStoria();
  if (f.stato === 'cast' && opz.parti !== false) vfilmAvviaStoria();
  return true;
}
async function vfilmAvviaStoria(soloChi) {
  const f = vcast.finestra;
  if (!f) return;
  f.lavoro.fermato = false; f.errore = ''; f.esito = null;
  const aggiorna = a => { if (vcast.finestra === f) { f.avanzamento = a; vfilmAggiornaBarraStoria(); } };
  try {
    if (!soloChi) {
      f.stato = 'cast'; vfilmDisegnaStoria();
      await vfilmCasting(f.lavoro, aggiorna);
      if (vcast.finestra !== f) return;
    }
    f.stato = 'genera'; vfilmDisegnaStoria();
    f.esito = await vfilmGeneraStoria(f.lavoro, aggiorna, soloChi);
  } catch (e) { f.errore = e && e.message || String(e); }
  if (vcast.finestra !== f) return;
  f.stato = 'pronta';
  // v483: e subito sul repository, perché si sentano dagli altri dispositivi
  f.repo = f.lavoro.fatte && f.lavoro.fatte.length ? { stato: 'invio' } : f.repo || null;
  vfilmDisegnaStoria();
  if (!f.repo || f.repo.stato !== 'invio') return;
  try { f.repo = await vfilmSalvaSulRepository(f.lavoro, f.st); }
  catch (e) { f.repo = { stato: 'fatto', testo: e && e.message || String(e) }; }
  if (vcast.finestra === f && f.stato === 'pronta') vfilmDisegnaStoria();
}
// La riga del repository sotto l'esito, con il tasto per collegarlo
function vfilmRigaRepo(f) {
  const r = f.repo;
  if (!r || r.stato === 'senza') return null;
  if (r.stato === 'invio') return vfilmEl('p', { class: 'yt-messaggio vcast-repo', role: 'status' }, vfilmT('storia.repoInCorso'));
  if (r.stato === 'senzaToken') return vfilmEl('div', { class: 'vcast-repo' },
    vfilmEl('p', { class: 'yt-messaggio', role: 'status' }, vfilmT('storia.repoSenzaToken')),
    vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vcast: 'collega' }, onclick: () => {
      vfilmChiudiStoria();
      const St = window.StudioStorie;
      if (St && typeof St.apriImpostazioni === 'function') St.apriImpostazioni('repo');
    } }, vfilmT('storia.repoCollega')));
  return vfilmEl('p', { class: 'yt-messaggio vcast-repo', role: 'status' }, (r.testo || '') + (r.pronta ? ' ' + vfilmT('storia.repoDopo') : ''));
}
function vfilmChiudiStoria() {
  const f = vcast.finestra;
  if (!f) return;
  f.lavoro.fermato = true;
  if (vcast.ascolto) { try { vcast.ascolto.pause(); } catch (_) { /* niente */ } vcast.ascolto = null; }
  if (f.el) f.el.remove();
  document.removeEventListener('keydown', vfilmTastiStoria, true);
  vcast.finestra = null;
}
function vfilmTastiStoria(e) {
  const f = vcast.finestra;
  if (e.key === 'Escape' && f && f.stato !== 'genera' && f.stato !== 'cast') { e.preventDefault(); vfilmChiudiStoria(); }
}
function vfilmAggiornaBarraStoria() {
  const f = vcast.finestra;
  if (!f || !f.el) return;
  const a = f.avanzamento || {};
  const barra = f.el.querySelector('.yt-barra'), testo = f.el.querySelector('.yt-barra-testo');
  if (!barra || !testo) return;
  barra.value = a.totale ? Math.round(a.i / a.totale * 100) : 0;
  testo.textContent = vfilmT(a.fase === 'cast' ? 'storia.scelgo' : 'genero', { n: (a.i || 0) + 1, di: a.totale || 0, chi: a.chi || '' });
}
function vfilmDisegnaStoria() {
  const f = vcast.finestra;
  if (!f) return;
  const S = window.StorieCosmiche;
  const battute = f.lavoro.battute, caratteri = vfilmCaratteri(battute);
  const corpo = vfilmEl('div', { class: 'yt-corpo' });
  const titolo = f.st.titolo || (typeof astroI18n === 'object' ? astroI18n.t('demo.builtin.' + f.st.chiave + '.title') : f.st.chiave);
  corpo.append(vfilmEl('p', { class: 'yt-file' }, titolo));
  if (f.stato === 'chiave') {
    corpo.append(vfilmEl('p', { class: 'yt-messaggio' }, vfilmT('storia.senzaChiave')));
    corpo.append(vfilmEl('div', { class: 'yt-tasti' },
      vfilmEl('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { vcast: 'chiave' }, onclick: () => {
        vfilmChiudiStoria();
        const St = window.StudioStorie;
        if (St && typeof St.apriImpostazioni === 'function') St.apriImpostazioni('el');
      } }, vfilmT('storia.apriChiave')),
      vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vcast: 'annulla' }, onclick: vfilmChiudiStoria }, vfilmT('annulla'))));
  } else {
    if (!battute.length) corpo.append(vfilmEl('p', { class: 'yt-messaggio' }, vfilmT('storia.nessuna')));
    else corpo.append(vfilmEl('p', { class: 'yt-messaggio' }, vfilmT('storia.spiega', { n: battute.length, caratteri })));
    // chi parla, con la sua voce
    const chi = [...new Set(battute.map(b => b.chi).filter(Boolean))];
    const elenco = vfilmEl('ul', { class: 'vcast-elenco' });
    for (const id of chi) {
      const v = f.lavoro.cast.get(id);
      const sue = battute.filter(b => b.chi === id).length;
      const riga = vfilmEl('li', { class: 'vcast-riga', dataset: { vcastChi: id } });
      if (S && typeof S.figurina === 'function') { const img = S.figurina(id, 30); if (img) riga.append(img); }
      riga.append(vfilmEl('span', { class: 'vcast-nome' }, vfilmEl('strong', {}, vfilmProfilo(id).nome),
        vfilmEl('small', {}, v ? vfilmT(v.fonte === 'studio' ? 'storia.voceStudio' : 'storia.voce', { voce: v.nome || v.id, n: sue }) : vfilmT('storia.daScegliere', { n: sue }))));
      if (v && v.anteprima) riga.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo vcast-tasto', dataset: { vcast: 'ascolta' }, onclick: () => {
        if (vcast.ascolto) { try { vcast.ascolto.pause(); } catch (_) { /* niente */ } }
        try { vcast.ascolto = new Audio(v.anteprima); vcast.ascolto.play().catch(() => null); } catch (_) { /* niente */ }
      } }, vfilmT('storia.ascolta')));
      if (v && f.stato === 'pronta' && v.fonte !== 'studio') riga.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo vcast-tasto', dataset: { vcast: 'altra' }, onclick: async () => {
        f.stato = 'genera'; f.errore = ''; vfilmDisegnaStoria();
        try { if (!await vfilmAltraVoce(f.lavoro, id)) f.errore = vfilmT('storia.nessunaAltra'); }
        catch (e) { f.errore = e.message; }
        if (vcast.finestra !== f) return;
        if (f.errore) { f.stato = 'pronta'; vfilmDisegnaStoria(); return; }
        vfilmAvviaStoria(id);
      } }, vfilmT('storia.altra')));
      elenco.append(riga);
    }
    corpo.append(elenco);
    if (f.stato === 'cast' || f.stato === 'genera') {
      corpo.append(vfilmEl('div', { class: 'yt-avanzamento' },
        vfilmEl('progress', { class: 'yt-barra', max: '100', value: '0', 'aria-label': vfilmT('avanzamento') }),
        vfilmEl('span', { class: 'yt-barra-testo', 'aria-live': 'polite' }, '')));
      corpo.append(vfilmEl('div', { class: 'yt-tasti' }, vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vcast: 'ferma' },
        onclick: () => { f.lavoro.fermato = true; } }, vfilmT('ferma'))));
    } else {
      const e = f.esito || { fatte: 0, errori: [], spesi: 0 };
      const mancano = Math.max(0, battute.length - e.fatte);
      if (f.esito) corpo.append(vfilmEl('p', { class: 'yt-messaggio' + (mancano ? '' : ' ok'), role: 'status' },
        mancano ? vfilmT('storia.parziale', { pronte: e.fatte, mancano }) : vfilmT('storia.pronte', { n: e.fatte, caratteri: e.spesi })));
      const rigaRepo = vfilmRigaRepo(f);
      if (rigaRepo) corpo.append(rigaRepo);
      const errore = f.errore || (e.errori.length ? e.errori[0].messaggio : '');
      if (errore) corpo.append(vfilmEl('p', { class: 'yt-messaggio errore vfilm-errore' }, errore));
      const tasti = vfilmEl('div', { class: 'yt-tasti' });
      if (e.fatte && window.AstroDemo && typeof AstroDemo.avvia === 'function')
        tasti.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { vcast: 'guarda' }, onclick: () => {
          const testo = f.st.testo; vfilmChiudiStoria();
          if (typeof narrazione === 'object' && narrazione.sbloccaContesto) { try { narrazione.sbloccaContesto(); } catch (_) { /* niente */ } }
          try { AstroDemo.avvia(testo); } catch (_) { /* la scheda dirà */ }
        } }, vfilmT('storia.guarda')));
      if (mancano || f.errore) tasti.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vcast: 'riprova' }, onclick: () => vfilmAvviaStoria() }, vfilmT('riprova')));
      tasti.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vcast: 'togli' }, onclick: async () => {
        await vfilmTogliVociStoria(f.st.chiave); f.esito = null; f.errore = ''; f.repo = null; f.lavoro.voci.clear();
        // v483: e via anche dal repository, se erano andate là
        const St = window.StudioStorie;
        if (St && typeof St.repoImpostazioni === 'function' && St.repoImpostazioni().token && vfilmTolte().length) St.sincronizza({ spingi: true, titolo: 'voci tolte' }).catch(() => null);
        if (vcast.finestra === f) { f.stato = 'pronta'; vfilmDisegnaStoria(); const m = f.el && f.el.querySelector('.yt-file'); if (m) m.textContent = vfilmT('storia.tolte'); }
      } }, vfilmT('storia.togli')));
      tasti.append(vfilmEl('button', { type: 'button', class: 'tasto-cielo', dataset: { vcast: 'chiudi' }, onclick: vfilmChiudiStoria }, vfilmT('storia.chiudi')));
      corpo.append(tasti);
    }
  }
  const occupata = f.stato === 'genera' || f.stato === 'cast';
  const finestra = vfilmEl('div', { class: 'yt-finestra vfilm-finestra vcast-finestra' },
    vfilmEl('div', { class: 'yt-testa' },
      vfilmEl('h2', { id: 'vcast-titolo' }, vfilmT('storia.titolo')),
      vfilmEl('button', { type: 'button', class: 'yt-x', 'aria-label': vfilmT('annulla'), title: vfilmT('annulla'), disabled: occupata, onclick: vfilmChiudiStoria },
        vfilmEl('span', { 'aria-hidden': 'true' }, '×'))),
    corpo);
  if (!f.el) {
    f.el = vfilmEl('div', { class: 'yt-velo', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vcast-titolo', id: 'vcast-finestra' });
    f.el.addEventListener('mousedown', e => { if (e.target === f.el && f.stato !== 'genera' && f.stato !== 'cast') vfilmChiudiStoria(); });
    document.body.append(f.el);
    document.addEventListener('keydown', vfilmTastiStoria, true);
  }
  f.el.replaceChildren(finestra);
  if (occupata) vfilmAggiornaBarraStoria();
  const primo = f.el.querySelector(occupata ? '[data-vcast="ferma"]' : '[data-vcast="guarda"], [data-vcast="chiave"], [data-vcast="chiudi"]');
  if (primo) primo.focus();
}
// All'avvio e al cambio di lingua le voci delle CosmoStorie tornano in narrazione
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const carica = () => { vfilmCaricaVociStorie().catch(() => null); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(carica, 400));
  else setTimeout(carica, 400);
  if (typeof astroI18n === 'object' && astroI18n && typeof astroI18n.alCambio === 'function') astroI18n.alCambio(carica);
}

if (typeof window !== 'undefined') {
  window.vfilmPrimaDiRegistrare = vfilmPrimaDiRegistrare;
  window.vfilmRiprendi = vfilmRiprendi;
  window.VociFilmato = {
    battute: vfilmBattute, scegliVociEleven: vfilmScegliVociEleven, tono: vfilmTono, wav: vfilmWav, pezzi: vfilmPezzi,
    genera: vfilmGenera, presta: vfilmPresta, riprendi: vfilmRiprendi, chiave: vfilmChiave, piperPronto: vfilmPiperPronto,
    piperParla: vfilmPiperParla, fonemi: vfilmFonemi, modelloPiper: vfilmModelloPiper, mbPiper: vfilmMbPiper,
    stato: vfilm, VFILM_PIPER_VOCI, VFILM_MODELLI, VFILM_ORT, VFILM_FONEMI, VFILM_DB,
    // v483: le voci delle CosmoStorie sul repository
    vociPerRepository: vfilmVociPerRepository, vociInAttesa: vfilmVociInAttesa, segnaSulRepository: vfilmSegnaSulRepository,
    tolteDalRepository: vfilmTolte, dimenticaTolte: vfilmDimenticaTolte, salvaSulRepository: vfilmSalvaSulRepository, VFILM_CHIAVE_TOLTE,
    // v482: le voci di una CosmoStoria con un tocco (§8–9)
    vociStoria: vfilmVociStoria, casting: vfilmCasting, carattere: vfilmCarattere, votoVoce: vfilmVotoVoce, testoConRegia: vfilmTestoConRegia,
    altraVoce: vfilmAltraVoce, generaStoria: vfilmGeneraStoria, caricaVociStorie: vfilmCaricaVociStorie, togliVociStoria: vfilmTogliVociStoria,
    vociDellaStoria: vfilmVociDellaStoria, castDi: vfilmCastDi, cartella: vfilmCartella, chiudiStoria: vfilmChiudiStoria, statoStoria: vcast,
    VFILM_CARATTERI, VFILM_CHIAVE_CAST
  };
  window.vfilmVociStoria = vfilmVociStoria;
}
