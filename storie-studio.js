/* storie-studio.js — Lo Studio delle Storie cosmiche: gli strumenti per
 * crearle senza scrivere il DSL.
 *
 * Una storia, qui, è un **progetto** fatto di cose che chi scrive pensa
 * davvero: uno scopo (che cosa deve capire chi guarda), dei personaggi,
 * delle scene (dove siamo, quando, chi c'è) e dentro a ogni scena dei
 * **momenti** — chi parla, che cosa dice, con che faccia — con le azioni che
 * accadono intanto: un astro che vola verso un altro, uno che salta, un botto.
 * Il copione (il DSL delle demo, `DEMO.md`, `STORIE.md`) lo scrive lo Studio,
 * un momento per scena perché il motore vuole **una battuta per scena**.
 *
 * Quattro aiuti, perché il foglio bianco è la parte difficile:
 *   - i **modelli per scopo** (`STUDIO_SCOPI`): le fasi della Luna, i
 *     giganti, le stagioni, un viaggio, un'avventura — una storia intera da
 *     cambiare, non da riempire;
 *   - i **suggerimenti**: l'ambiente adatto ai personaggi in scena, la
 *     faccia giusta per una frase, le azioni che stanno bene con quella
 *     faccia e quelle parole, il prossimo momento (chi parla e una bozza);
 *   - i **comandi a parole**: «Marte vola verso Giove facendo un giro»,
 *     «Giove dice: Benvenuto!», «esplosione su Saturno» (`studioCapisci`);
 *   - il **controllo dello scopo** (`studioConsigli`): tutti parlano? la
 *     prima battuta apre una domanda, l'ultima la chiude? le frasi sono da
 *     bambini? il copione è valido?
 *
 * I progetti stanno in `localStorage` (`astrocal_storie_progetti_v1`); «Salva
 * nelle mie demo» mette il copione nella libreria delle demo, dove si può
 * anche esportare. Lo Studio vive nella linguetta «Storie cosmiche» della
 * pagina Demo (§8, `studioSchede`). Tutti i testi nei dizionari (`studio.*`).
 *
 * Prefisso `studio`. Si carica dopo `storie-cosmiche.js` e
 * `demo-impostazioni.js`; nelle prove Node (`scripts/prova-storie.js`) si
 * usano le funzioni pure di §2–§5. */
(function (radice) {
  'use strict';

  // ===================================================================
  // 1. Gli strumenti di base
  // ===================================================================

  const CHIAVE = 'astrocal_storie_progetti_v1';
  const S = () => radice.StorieCosmiche || {};
  const haI18n = () => !!(radice.astroI18n && typeof radice.astroI18n.t === 'function');
  const t = (k, d) => {
    if (!haI18n()) return k;
    if (typeof radice.astroI18n.esiste === 'function' && !radice.astroI18n.esiste(k)) return '';
    return radice.astroI18n.t(k, d);
  };
  const nuovoId = p => p + Math.random().toString(36).slice(2, 9);
  const copia = o => JSON.parse(JSON.stringify(o));
  // I corpi che la camera 3D sa inquadrare attorno al Sole, e quelli che
  // sa tenere al centro da vicino (demo.js, `corpiSistema` e `FUOCHI_SISTEMA`)
  const STUDIO_INQUADRABILI = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const STUDIO_FUOCHI_3D = ['Earth', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const STUDIO_FUOCHI_CIELO = ['Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const STUDIO_AMBIENTI = ['sistema', 'pianeta', 'terra_luna', 'cielo', 'cosmo'];
  /* La scala cosmica (v412, scala-cosmica.js): le tappe a cui la camera può
   * andare, con la scala a cui ognuna si inquadra (il logaritmo di metà del
   * lato corto, in UA: `Math.log10(vista)` di `COSM_STRUTTURE`), e i luoghi
   * dell'universo verso cui un personaggio può viaggiare, con la loro
   * distanza vera (anni luce) da cui si ricava la scala che li inquadra (la
   * stessa regola di `cosmLuogo`). Tenuti qui, e non letti dalla carta,
   * perché il copione esca uguale anche senza la scala cosmica caricata (le
   * prove Node). */
  const STUDIO_AL = 63241.077, STUDIO_KM_UA = 149597870.7;
  const STUDIO_TAPPE_COSMO = {
    earth: Math.log10(6371 / STUDIO_KM_UA * 2.3), earth_moon: Math.log10(384400 / STUDIO_KM_UA * 1.32),
    inner_planets: Math.log10(1.95), planets: Math.log10(37), kuiper: Math.log10(64), heliopause: Math.log10(230),
    oort: Math.log10(128000), local_cloud: Math.log10(28 * STUDIO_AL), local_bubble: Math.log10(700 * STUDIO_AL),
    orion_arm: Math.log10(6500 * STUDIO_AL), milky_way: Math.log10(62000 * STUDIO_AL), local_group: Math.log10(6.2e6 * STUDIO_AL),
    virgo: Math.log10(72e6 * STUDIO_AL), laniakea: Math.log10(330e6 * STUDIO_AL), universe: Math.log10(56e9 * STUDIO_AL)
  };
  const STUDIO_SEGNI_COSMO = {
    alpha_centauri: 4.37, sirius: 8.6, orion_nebula: 1344, galactic_center: 26000, lmc: 160000, smc: 200000,
    andromeda: 2.54e6, triangulum: 2.73e6, virgo_cluster: 54e6, great_attractor: 250e6,
    // v414: i due luoghi delle storie sulle stelle (`COSM_LUOGHI_STORIE`)
    betelgeuse: 548, crab_nebula: 6500
  };
  // I nomi a schermo: quelli della scala cosmica (`cosmo.*` nei dizionari)
  const STUDIO_NOMI_TAPPE = {
    earth: 'terra', earth_moon: 'terraLuna', inner_planets: 'pianetiInterni', planets: 'pianeti', kuiper: 'kuiper',
    heliopause: 'eliopausa', oort: 'oort', local_cloud: 'mezzoLocale', local_bubble: 'bollaLocale', orion_arm: 'braccioOrione',
    milky_way: 'viaLattea', local_group: 'gruppoLocale', virgo: 'vergine', laniakea: 'laniakea', universe: 'universo'
  };
  const STUDIO_NOMI_SEGNI = {
    alpha_centauri: 'alfaCen', sirius: 'sirio', orion_nebula: 'orione', galactic_center: 'centro', lmc: 'gnm', smc: 'pnm',
    andromeda: 'm31', triangulum: 'm33', virgo_cluster: 'ammassoVergine', great_attractor: 'grandeAttrattore',
    betelgeuse: 'betelgeuse', crab_nebula: 'granchio'
  };
  const luogoCosmo = v => typeof v === 'string' && (v in STUDIO_TAPPE_COSMO || v in STUDIO_SEGNI_COSMO);
  // La scala che inquadra un luogo (o un personaggio dell'universo, al suo luogo)
  function studioLCosmo(v) {
    const prof = S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[v];
    if (prof && (prof.cosmo || prof.luogo)) v = prof.cosmo || prof.luogo;
    if (v in STUDIO_TAPPE_COSMO) return STUDIO_TAPPE_COSMO[v];
    if (v in STUDIO_SEGNI_COSMO) return Math.log10(Math.max(STUDIO_SEGNI_COSMO[v] * 1.7, 6) * STUDIO_AL);
    return null;
  }
  function nomeLuogo(v) {
    if (v in STUDIO_NOMI_TAPPE) return t('cosmo.' + STUDIO_NOMI_TAPPE[v] + '.nome') || v;
    if (v in STUDIO_NOMI_SEGNI) return t('cosmo.etichetta.' + STUDIO_NOMI_SEGNI[v]) || v;
    return v;
  }
  // La tappa più vicina a una scala: è di lei che parla un fatto
  function studioTappaVicina(L) {
    let meglio = 'planets', d = Infinity;
    for (const [k, v] of Object.entries(STUDIO_TAPPE_COSMO)) if (Math.abs(v - L) < d) { d = Math.abs(v - L); meglio = k; }
    return meglio;
  }
  // Chi vive solo nella scala cosmica (la Via Lattea, Andromeda, Sirio…)
  const soloCosmo = id => !!(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id] && S().STOR_PERSONAGGI[id].cosmo);
  // v450: un ospite (Carl Sagan) sta in un posto dello schermo in ogni vista e
  // non viaggia: i viaggi e i ritorni per lui non vanno nel copione
  const ospite = id => !!(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id] && S().STOR_PERSONAGGI[id].ospite);
  const STUDIO_ZOOM = { lontano: 0.75, normale: 1, vicino: 1.7 };
  // La camera della 3D nel copione (v434): quanti gradi gira per ogni secondo
  // di battuta, e fra che elevazioni sale e scende
  const STUDIO_GIRO_AL_SECONDO = 4;
  const STUDIO_ELEV = [26, 62];
  const STUDIO_FOV = { lontano: 60, normale: 18, vicino: 3 };
  const STUDIO_QUANDO = ['inizio', 'meta', 'fine', 'tutto'];
  /* v449: il tono di una battuta, oltre alla faccia: come la dice. Sono tag
   * audio del modello v3 di ElevenLabs, che si sommano a quello della faccia
   * (`[happy] [whispers] Psst!`). Al massimo due: di più il modello li
   * mescola e la battuta esce confusa. */
  const STUDIO_TONI = ['whispers', 'shouts', 'sighs', 'gasps', 'laughs', 'crying', 'curious', 'sarcastic'];
  const STUDIO_TONI_MAX = 2;
  const STUDIO_TIPI = ['umore', 'guarda', 'muovi', 'torna', 'anima', 'scala', 'diventa', 'effetto', 'suono', 'occhiolino', 'nascondi'];
  // Che cosa può diventare un personaggio (v414, `character_become`): le
  // vesti di `STOR_VESTI`, tenute qui per lo stesso motivo delle tappe
  const STUDIO_FORME = ['red_giant', 'white_dwarf', 'supernova', 'black_hole', 'self'];
  // Il nome che le battute di una storia dello Studio hanno nei file delle
  // voci (`studio_la_luna-3.mp3`): lo stesso controllo di `scripts/voci-storie.js`
  const STUDIO_VOCE_CHIAVE = /^studio_[a-z0-9_]{1,40}$/;
  const STUDIO_PAROLE_BAMBINI = 25;     // oltre, una battuta è lunga per un bambino
  const STUDIO_DURATA_IDEALE = [30, 240];

  // ===================================================================
  // 2. Il modello: progetto, scena, momento, azione
  // ===================================================================

  function studioNuovaAzione(tipo, campi = {}) {
    const base = { id: nuovoId('a'), tipo, chi: '', quando: 'inizio' };
    const di = {
      umore: { umore: 'happy' }, guarda: { oggetto: 'viewer' },
      muovi: { verso: '', lato: 'auto', percorso: 'arc', quando: 'tutto' }, torna: { percorso: 'arc', quando: 'tutto' },
      anima: { animazione: 'jump', volte: 0 }, scala: { scala: 1.6, quando: 'inizio' }, diventa: { forma: 'red_giant', quando: 'tutto' },
      effetto: { effetto: 'sparkles', dove: '', grandezza: 1, colore: '' }, occhiolino: {}, nascondi: { quando: 'fine' },
      // v444: un suono, sintetizzato (`STOR_SUONI`) o da file (generato con
      // ElevenLabs o caricato); `richiesta` è la descrizione per ElevenLabs
      suono: { chi: '', fonte: 'sintesi', suono: 'tada', volume: 1, file: null, richiesta: '', secondi: 0 }
    }[tipo] || {};
    return Object.assign(base, di, campi);
  }
  function studioNuovoMomento(campi = {}) {
    // v461: `copione` e `parla` li ha solo un momento nato da una CosmoStoria
    // pronta (`studioDaCopione`): i comandi che lo Studio non sa scrivere,
    // tali e quali, e la battuta registrata dell'originale
    return Object.assign({ id: nuovoId('m'), chi: '', testo: '', umore: '', tono: [], durata: 0, voce: 0, audio: null, azioni: [], copione: null, parla: null }, campi);
  }
  /* La camera di una scena (v431): automatica (va da chi parla e dai botti),
   * sempre stretta su chi parla, su un personaggio solo, che gira attorno a
   * un personaggio (o a chi parla), o ferma sulla camera della scena. Prima
   * c'era solo la casella `cameraViva`: spenta vuol dire ancora «ferma». */
  const STUDIO_CAMERE = ['auto', 'parla', 'vicino', 'giro', 'ferma'];
  function studioCameraDi(sc) {
    const c = sc && STUDIO_CAMERE.includes(sc.camera) ? sc.camera : 'auto';
    return c === 'auto' && sc && sc.cameraViva === false ? 'ferma' : c;
  }
  // La riga `story_camera` della scena, o niente se la regia è quella di serie
  function studioRigaCamera(sc, presenti) {
    const modo = studioCameraDi(sc);
    const chi = sc.cameraChi && presenti.includes(sc.cameraChi) ? sc.cameraChi : '';
    if (modo === 'ferma') return 'story_camera { mode: wide }';
    if (modo === 'parla') return 'story_camera { mode: speaker }';
    if (modo === 'vicino') {
      const su = chi || presenti[0];
      return su ? `story_camera { mode: close, target: ${virgolette(su)} }` : null;
    }
    if (modo === 'giro') return chi ? `story_camera { mode: orbit, target: ${virgolette(chi)} }` : 'story_camera { mode: orbit }';
    return null;
  }
  function studioNuovaScena(campi = {}) {
    return Object.assign({
      id: nuovoId('s'), ambiente: 'sistema', fuoco: 'Jupiter', zoom: 'normale',
      data: '', ora: '21:00', giorni: 0, cartello: false, cameraViva: true, camera: 'auto', cameraChi: '', cosmoDa: 'planets', cosmoA: 'milky_way', presenti: [], momenti: [studioNuovoMomento()],
      // v440: la musica di sottofondo della scena (§4-ter): quella della
      // storia, una sua, o il silenzio
      musicaModo: 'storia', musica: null,
      // v445: le voci ElevenLabs cambiate solo per questa scena (§6c)
      voci: {}
    }, campi);
  }
  function studioNuovoProgetto(campi = {}) {
    return Object.assign({
      v: 1, id: nuovoId('p'), titolo: '', scopo: 'libera', obiettivo: '',
      // v461: `ufficiale` la mette fra le CosmoStorie (le altre sono in
      // cantiere, solo nello Studio); `origine` la storia pronta da cui viene
      ufficiale: false, origine: '',
      cast: ['Moon', 'Earth'], scene: [studioNuovaScena({ ambiente: 'terra_luna' })], demoChiave: null,
      voceChiave: null, voceProssima: 1, aggiornato: 0, lingua: '',
      // v440: la musica di sottofondo di tutta la storia (§4-ter)
      musica: null,
      // v444: la voce ElevenLabs di ogni personaggio (§6c), `id` → { id, nome, anteprima, genere }
      voci: {},
      // v430: la domanda finale al pubblico (§4-bis). Dalla v432 è
      // facoltativa: spenta di serie, la accende chi scrive la storia
      domanda: studioNuovaDomanda()
    }, campi);
  }
  function studioNuovaDomanda(campi = {}) {
    return Object.assign({ attiva: false, modo: 'auto', tipo: 'auto', testo: '', a: '', b: '', chi: '' }, campi);
  }
  /* Una musica di sottofondo (v440): una traccia dell'app (`catalogo`, il
   * suo id in `ASTRO_TRACCE_MUSICALI`) o un file caricato nello Studio
   * (`file`: nome, estensione, SHA del blob git, durata), col suo volume. */
  const STUDIO_MUSICA_VOLUME = 0.35;
  const STUDIO_MUSICA_MODI = ['storia', 'propria', 'silenzio'];
  const STUDIO_MUSICA_EST = /^(mp3|wav|ogg|oga|opus|m4a|aac|webm)$/;
  function studioPulisciMusica(m) {
    if (!m || typeof m !== 'object') return null;
    const v = Number(m.volume);
    const volume = Number.isFinite(v) && m.volume !== null && m.volume !== '' ? Math.max(0.05, Math.min(1, v)) : STUDIO_MUSICA_VOLUME;
    if (m.tipo === 'catalogo' && typeof m.id === 'string' && /^[\w-]{1,40}$/.test(m.id)) return { tipo: 'catalogo', id: m.id, volume };
    if (m.tipo === 'file' && STUDIO_MUSICA_EST.test(m.est) && /^[0-9a-f]{8,40}$/.test(m.sha))
      return { tipo: 'file', nome: typeof m.nome === 'string' ? m.nome.slice(0, 80) : '', est: m.est, sha: m.sha,
        durata: Math.max(0, Math.min(36e5, Math.round(Number(m.durata) || 0))), volume };
    return null;
  }
  /* Il suono di un'azione (v444): sintetizzato (uno di `STOR_SUONI`) o da
   * file, col file descritto come una musica (nome, estensione, SHA, durata). */
  function studioPulisciSuono(a) {
    const file = a.file && typeof a.file === 'object' ? studioPulisciMusica(Object.assign({}, a.file, { tipo: 'file' })) : null;
    const v = Number(a.volume);
    return {
      fonte: a.fonte === 'file' && file ? 'file' : 'sintesi',
      suono: typeof a.suono === 'string' && /^[a-z_]{2,20}$/.test(a.suono) ? a.suono : 'tada',
      volume: Number.isFinite(v) && a.volume !== null && a.volume !== '' ? Math.max(0.1, Math.min(2, v)) : 1,
      file: file ? { nome: file.nome, est: file.est, sha: file.sha, durata: file.durata } : null,
      richiesta: typeof a.richiesta === 'string' ? a.richiesta.slice(0, 300) : '',
      secondi: Number.isFinite(Number(a.secondi)) ? Math.max(0, Math.min(30, Number(a.secondi))) : 0
    };
  }
  /* Le voci ElevenLabs dei personaggi (v444, §6c): l'ID della voce, il suo
   * nome e l'indirizzo dell'anteprima che ElevenLabs dà con la voce. */
  const STUDIO_VOCE_ID = /^[A-Za-z0-9]{8,40}$/;
  function studioPulisciVoce(v) {
    if (!v || typeof v !== 'object' || !STUDIO_VOCE_ID.test(v.id || '')) return null;
    return {
      id: v.id, nome: typeof v.nome === 'string' ? v.nome.slice(0, 80) : '',
      anteprima: typeof v.anteprima === 'string' && /^https:\/\/[\w.-]+\/[^\s"'<>]{1,500}$/.test(v.anteprima) ? v.anteprima : '',
      genere: v.genere === 'f' || v.genere === 'm' ? v.genere : ''
    };
  }
  function studioPulisciVoci(voci) {
    const fuori = {};
    if (!voci || typeof voci !== 'object') return fuori;
    for (const [id, v] of Object.entries(voci).slice(0, 40)) {
      const pulita = /^[\w :.-]{1,40}$/.test(id) ? studioPulisciVoce(v) : null;
      if (pulita) fuori[id] = pulita;
    }
    return fuori;
  }
  // Chi è davvero in scena: quelli scelti, o tutto il cast; mai qualcuno
  // che non è più nel cast.
  function studioPresenti(progetto, scena) {
    // la Via Lattea e Andromeda stanno solo nella scala cosmica
    const qui = id => progetto.cast.includes(id) && (scena.ambiente === 'cosmo' || !soloCosmo(id));
    const scelti = (scena.presenti || []).filter(qui);
    return scelti.length ? scelti : progetto.cast.filter(qui);
  }
  /* I comandi dell'originale tenuti in un momento (v461): come li dà
   * `AstroDemoMotore.analizza`, cioè nome, parametri e ripresa, mai testo
   * DSL da incollare (una riga con dentro `} scene …` romperebbe il
   * copione). Si riscrivono con `studioRigaDsl`. */
  const STUDIO_VISTE_COPIONE = /^[a-z_0-9]{2,40}$/;
  function studioPulisciRiga(r) {
    if (!r || typeof r !== 'object' || typeof r.comando !== 'string' || !/^[a-z_0-9]{2,40}$/.test(r.comando)) return null;
    const parametri = {};
    for (const [k, v] of Object.entries(r.parametri && typeof r.parametri === 'object' ? r.parametri : {}).slice(0, 30)) {
      if (!/^[a-z_0-9]{1,30}$/.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) parametri[k] = v;
      else if (typeof v === 'string' && v.length <= 2000) parametri[k] = v;
    }
    const riga = { comando: r.comando, parametri };
    const e = studioPulisciEsatta(r.ripresa);
    if (e) riga.ripresa = { da: e.da, a: e.a };
    return riga;
  }
  function studioPulisciCopione(c) {
    if (!c || typeof c !== 'object' || !STUDIO_VISTE_COPIONE.test(c.vista || '')) return null;
    return { vista: c.vista, righe: (Array.isArray(c.righe) ? c.righe : []).slice(0, 80).map(studioPulisciRiga).filter(Boolean) };
  }
  function studioPulisciParla(x) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !/^[\w.-]{1,80}$/.test(x.id)) return null;
    return { id: x.id, chi: typeof x.chi === 'string' ? x.chi.slice(0, 40) : '', testo: typeof x.testo === 'string' ? x.testo.slice(0, 400) : '' };
  }
  // La ripresa esatta dell'originale (`shot_from`/`shot_to`), che vale
  // finché chi scrive non cambia il «quando» dell'azione
  function studioPulisciEsatta(e) {
    if (!e || typeof e !== 'object') return null;
    const da = Number(e.da), a = Number(e.a);
    if (!(Number.isFinite(da) && Number.isFinite(a) && da >= 0 && a <= 1 && da < a)) return null;
    return Object.assign({ da, a }, STUDIO_QUANDO.includes(e.quando) ? { quando: e.quando } : {});
  }
  // Un progetto letto da un file o dall'archivio: si tiene solo quello che
  // il modello conosce, coi tipi giusti. Un file rotto non rompe lo Studio.
  function studioRipulisci(p) {
    if (!p || typeof p !== 'object') throw new Error(t('studio.err.file') || 'file');
    const testo = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
    const tra = (v, ammessi, di) => ammessi.includes(v) ? v : di;
    const numero = (v, a, b, di) => Number.isFinite(Number(v)) ? Math.max(a, Math.min(b, Number(v))) : di;
    // v424: scene, momenti e azioni tengono il loro id, perché la stessa
    // storia letta due volte (dal repository, da un altro dispositivo) sia
    // lo stesso file e non un commit nuovo a ogni giro
    const idDi = (v, pre) => typeof v === 'string' && /^[a-z][a-z0-9]{1,15}$/.test(v) ? v : nuovoId(pre);
    const ids = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && /^[\w :.-]{1,40}$/.test(x)).slice(0, 24) : [];
    const pulito = studioNuovoProgetto({
      id: typeof p.id === 'string' ? p.id.slice(0, 30) : nuovoId('p'),
      titolo: testo(p.titolo, 120), scopo: tra(p.scopo, Object.keys(STUDIO_SCOPI), 'libera'),
      obiettivo: testo(p.obiettivo, 300), cast: ids(p.cast),
      ufficiale: p.ufficiale === true, origine: typeof p.origine === 'string' && /^[\w-]{1,60}$/.test(p.origine) ? p.origine : '',
      demoChiave: typeof p.demoChiave === 'string' && p.demoChiave.startsWith('utente-') ? p.demoChiave : null,
      voceChiave: typeof p.voceChiave === 'string' && STUDIO_VOCE_CHIAVE.test(p.voceChiave) ? p.voceChiave : null,
      voceProssima: Math.floor(numero(p.voceProssima, 1, 100000, 1)),
      musica: studioPulisciMusica(p.musica),
      voci: studioPulisciVoci(p.voci),
      // v424: quando è stato toccato l'ultima volta (chi vince fra due
      // dispositivi) e la lingua delle sue battute nel file delle voci
      aggiornato: Math.floor(numero(p.aggiornato, 0, 1e13, 0)), lingua: p.lingua === 'en' || p.lingua === 'it' ? p.lingua : '',
      domanda: studioNuovaDomanda(p.domanda && typeof p.domanda === 'object' ? {
        // (le copie di prima della v432 non hanno `attiva`: restano senza domanda)
        attiva: p.domanda.attiva === true,
        modo: tra(p.domanda.modo, ['auto', 'sempre', 'mai'], 'auto'),
        tipo: tra(p.domanda.tipo, ['auto', 'ragione', 'sonda', 'fiducia', 'esplora', 'ab', 'previsione', 'protagonista'], 'auto'),
        testo: testo(p.domanda.testo, 200), a: testo(p.domanda.a, 60), b: testo(p.domanda.b, 60), chi: testo(p.domanda.chi, 40)
      } : {})
    });
    pulito.scene = (Array.isArray(p.scene) ? p.scene : []).slice(0, 40).map(sc => studioNuovaScena({
      id: idDi(sc && sc.id, 's'), ambiente: tra(sc && sc.ambiente, STUDIO_AMBIENTI, 'sistema'), fuoco: testo(sc && sc.fuoco, 40) || 'Jupiter',
      zoom: tra(sc && sc.zoom, Object.keys(STUDIO_ZOOM), 'normale'),
      data: /^\d{4}-\d{2}-\d{2}$/.test(sc && sc.data) ? sc.data : '', ora: /^\d{2}:\d{2}$/.test(sc && sc.ora) ? sc.ora : '21:00',
      giorni: numero(sc && sc.giorni, 0, 1000, 0), cartello: !!(sc && sc.cartello), cameraViva: !(sc && sc.cameraViva === false), presenti: ids(sc && sc.presenti),
      camera: tra(sc && sc.camera, STUDIO_CAMERE, sc && sc.cameraViva === false ? 'ferma' : 'auto'), cameraChi: testo(sc && sc.cameraChi, 40),
      cosmoDa: tra(sc && sc.cosmoDa, Object.keys(STUDIO_TAPPE_COSMO), 'planets'), cosmoA: tra(sc && sc.cosmoA, Object.keys(STUDIO_TAPPE_COSMO), 'milky_way'),
      musicaModo: tra(sc && sc.musicaModo, STUDIO_MUSICA_MODI, 'storia'), musica: studioPulisciMusica(sc && sc.musica),
      voci: studioPulisciVoci(sc && sc.voci),
      momenti: (Array.isArray(sc && sc.momenti) ? sc.momenti : []).slice(0, 60).map(m => studioNuovoMomento({
        id: idDi(m && m.id, 'm'), chi: testo(m && m.chi, 40), testo: testo(m && m.testo, 400), umore: testo(m && m.umore, 20),
        // v449: come dice la battuta (sussurra, grida…), tag di ElevenLabs v3
        tono: [...new Set((Array.isArray(m && m.tono) ? m.tono : []).filter(x => STUDIO_TONI.includes(x)))].slice(0, STUDIO_TONI_MAX),
        durata: numero(m && m.durata, 0, 120, 0), voce: Math.floor(numero(m && m.voce, 0, 100000, 0)),
        copione: studioPulisciCopione(m && m.copione), parla: studioPulisciParla(m && m.parla),
        audio: m && m.audio && Number(m.audio.durata) > 0 && /^[0-9a-f]{8}$/.test(m.audio.impronta)
          ? Object.assign({ durata: numero(m.audio.durata, 1, 120000, 1), impronta: m.audio.impronta, nome: testo(m.audio.nome, 80) },
            // v445: la voce ElevenLabs con cui è stato generato (per dire quando è da rifare)
            STUDIO_VOCE_ID.test(m.audio.voce || '') ? { voce: m.audio.voce } : {},
            // v449: i tag d'intonazione con cui è stato generato
            typeof m.audio.tag === 'string' && m.audio.tag.length <= 160 ? { tag: m.audio.tag } : {}) : null,
        azioni: (Array.isArray(m && m.azioni) ? m.azioni : []).slice(0, 30)
          .filter(a => a && STUDIO_TIPI.includes(a.tipo))
          .map(a => studioNuovaAzione(a.tipo, {
            id: idDi(a.id, 'a'), chi: testo(a.chi, 40), quando: tra(a.quando, STUDIO_QUANDO, 'inizio'),
            umore: testo(a.umore, 20) || undefined, oggetto: testo(a.oggetto, 40) || undefined,
            verso: testo(a.verso, 40), lato: tra(a.lato, ['auto', 'left', 'right', 'above', 'below', 'front', 'behind'], 'auto'),
            percorso: testo(a.percorso, 20) || 'arc', animazione: testo(a.animazione, 20) || 'jump',
            volte: numero(a.volte, 0, 20, 0), scala: numero(a.scala, 0.2, 6, 1.6), forma: tra(a.forma, STUDIO_FORME, 'red_giant'),
            effetto: testo(a.effetto, 20) || 'sparkles', dove: testo(a.dove, 40),
            grandezza: numero(a.grandezza, 0.2, 5, 1), colore: /^#[0-9a-f]{6}$/i.test(a.colore || '') ? a.colore : '',
            esatta: studioPulisciEsatta(a.esatta),
            ...(a.tipo === 'suono' ? studioPulisciSuono(a) : {})
          }))
      }))
    }));
    if (!pulito.scene.length) pulito.scene.push(studioNuovaScena());
    return pulito;
  }

  // ===================================================================
  // 3. I modelli per scopo
  // ===================================================================

  /* Ogni modello è una storia intera, corta, che funziona così com'è e che
   * insegna una cosa vera; i testi sono nei dizionari
   * (`studio.tpl.<scopo>.<n>`), presi nella lingua di adesso quando si
   * sceglie il modello — da lì in poi sono di chi scrive. `a` sono le
   * azioni del momento, nella forma di `studioNuovaAzione`. */
  const M = (chi, n, umore, a = []) => ({ chi, n, umore, a });
  const STUDIO_SCOPI = {
    libera: { cast: ['Moon', 'Earth'], scene: [
      { ambiente: 'terra_luna', momenti: [M('Moon', 1, 'happy', [['anima', { chi: 'Moon', animazione: 'jump' }]])] }
    ] },
    fasi: { cast: ['Moon', 'Earth', 'Sun'], scene: [
      { ambiente: 'cielo', fuoco: 'Moon', zoom: 'vicino', data: '2026-12-13', ora: '18:30', presenti: ['Moon'], momenti: [
        M('Moon', 1, 'worried', [['anima', { chi: 'Moon', animazione: 'shake' }]])
      ] },
      { ambiente: 'terra_luna', momenti: [
        M('Earth', 2, 'happy', [['guarda', { chi: 'Moon', oggetto: 'Earth' }]]),
        M('Sun', 3, 'happy', [['effetto', { effetto: 'glow', dove: 'Sun' }]])
      ] },
      { ambiente: 'terra_luna', giorni: 11, data: '2026-12-13', ora: '18:30', momenti: [
        M('Moon', 4, 'surprised', [['umore', { chi: 'Moon', umore: 'happy', quando: 'fine' }]]),
        M('Moon', 5, 'excited', [['anima', { chi: 'Moon', animazione: 'jump' }], ['effetto', { effetto: 'sparkles', dove: 'Moon', quando: 'meta' }]])
      ] }
    ] },
    giganti: { cast: ['Jupiter', 'Saturn', 'Sun'], scene: [
      { ambiente: 'sistema', presenti: ['Jupiter', 'Saturn'], momenti: [
        M('Jupiter', 1, 'excited', [['scala', { chi: 'Jupiter', scala: 1.5 }], ['anima', { chi: 'Jupiter', animazione: 'pulse', quando: 'meta' }]]),
        M('Saturn', 2, 'happy', [['anima', { chi: 'Saturn', animazione: 'wobble' }]])
      ] },
      { ambiente: 'sistema', presenti: ['Jupiter', 'Saturn'], momenti: [
        M('Jupiter', 3, 'thinking', [['muovi', { chi: 'Saturn', verso: 'Jupiter', percorso: 'arc' }]]),
        M('Saturn', 4, 'surprised', [['effetto', { effetto: 'shockwave', dove: 'Jupiter', quando: 'meta' }]])
      ] },
      { ambiente: 'sistema', giorni: 1000, momenti: [
        M('Sun', 5, 'happy', [['torna', { chi: 'Saturn' }], ['scala', { chi: 'Jupiter', scala: 1 }]])
      ] }
    ] },
    stagioni: { cast: ['Earth', 'Sun'], scene: [
      { ambiente: 'pianeta', fuoco: 'Earth', presenti: ['Earth'], momenti: [
        M('Earth', 1, 'thinking', [['anima', { chi: 'Earth', animazione: 'nod' }]])
      ] },
      { ambiente: 'sistema', momenti: [
        M('Sun', 2, 'happy', [['effetto', { effetto: 'glow', dove: 'Sun' }]]),
        M('Earth', 3, 'surprised', [['effetto', { effetto: 'sparkles', dove: 'Earth', quando: 'fine' }]])
      ] },
      { ambiente: 'sistema', giorni: 182, data: '2027-06-21', ora: '12:00', momenti: [
        M('Earth', 4, 'happy', [['anima', { chi: 'Earth', animazione: 'dance', quando: 'fine' }]])
      ] }
    ] },
    viaggio: { cast: ['Mars', 'Jupiter', 'Saturn'], scene: [
      { ambiente: 'sistema', momenti: [
        M('Mars', 1, 'excited', [['anima', { chi: 'Mars', animazione: 'jump' }]]),
        M('Mars', 2, 'happy', [['muovi', { chi: 'Mars', verso: 'Jupiter', percorso: 'arc' }]]),
        M('Jupiter', 3, 'happy', [['anima', { chi: 'Jupiter', animazione: 'nod' }]]),
        M('Mars', 4, 'excited', [['muovi', { chi: 'Mars', verso: 'Saturn', percorso: 'loop' }]]),
        M('Saturn', 5, 'happy', [['effetto', { effetto: 'confetti', dove: 'Saturn' }]]),
        M('Mars', 6, 'happy', [['torna', { chi: 'Mars', percorso: 'hop' }]])
      ] }
    ] },
    avventura: { cast: ['Mars', 'Jupiter'], scene: [
      { ambiente: 'sistema', presenti: ['Mars', 'Jupiter'], zoom: 'vicino', momenti: [
        M('Mars', 1, 'excited', [['muovi', { chi: 'Mars', verso: 'Jupiter', percorso: 'straight' }]]),
        M('Jupiter', 2, 'surprised', [['effetto', { effetto: 'explosion', dove: 'Jupiter', quando: 'meta' }], ['anima', { chi: 'Mars', animazione: 'shake', quando: 'meta' }]]),
        M('Mars', 3, 'worried', [['effetto', { effetto: 'smoke', dove: 'Mars' }]]),
        M('Jupiter', 4, 'happy', [['effetto', { effetto: 'fireworks', dove: 'Jupiter', quando: 'meta' }]]),
        M('Mars', 5, 'happy', [['torna', { chi: 'Mars' }], ['effetto', { effetto: 'hearts', dove: 'Jupiter', quando: 'meta' }]])
      ] }
    ] },
    /* Nella scala cosmica (v412). La camera si allontana di scena in scena,
     * alla misura vera, e i personaggi stanno dove stanno davvero: la Voyager
     * fuori dal quadro dei pianeti, poi un puntino col Sole e la Terra, poi
     * niente rispetto alla Via Lattea. La storia è costruita su quello che la
     * carta mostra, e non dice niente che la carta smentisca. */
    universo: { cast: ['Earth', 'voyager1', 'milky_way'], scene: [
      { ambiente: 'cosmo', da: 'earth_moon', a: 'planets', presenti: ['Earth', 'voyager1'], momenti: [
        M('Earth', 1, 'thinking', [['guarda', { chi: 'Earth', oggetto: 'voyager1' }]]),
        M('voyager1', 2, 'excited', [['anima', { chi: 'voyager1', animazione: 'bounce' }]])
      ] },
      { ambiente: 'cosmo', da: 'heliopause', a: 'oort', presenti: ['Earth', 'voyager1'], momenti: [
        M('voyager1', 3, 'happy', [['effetto', { effetto: 'shockwave', dove: 'voyager1', quando: 'meta' }]]),
        M('Earth', 4, 'surprised', []),
        M('voyager1', 5, 'laughing', [['muovi', { chi: 'voyager1', verso: 'oort', percorso: 'arc' }]])
      ] },
      { ambiente: 'cosmo', da: 'local_bubble', a: 'milky_way', momenti: [
        M('milky_way', 6, 'happy', [['effetto', { effetto: 'sparkles', dove: 'milky_way', quando: 'meta' }]]),
        M('Earth', 7, 'worried', [['anima', { chi: 'Earth', animazione: 'shake' }]]),
        M('milky_way', 8, 'laughing', [['torna', { chi: 'voyager1' }]])
      ] },
      { ambiente: 'cosmo', da: 'local_group', a: 'universe', momenti: [
        M('milky_way', 9, 'thinking', []),
        M('Earth', 10, 'love', [['effetto', { effetto: 'hearts', dove: 'Earth', quando: 'meta' }]])
      ] }
    ] },
    andromeda: { cast: ['milky_way', 'andromeda', 'Sun'], scene: [
      { ambiente: 'cosmo', da: 'milky_way', a: 'local_group', presenti: ['milky_way', 'andromeda'], momenti: [
        M('milky_way', 1, 'surprised', [['guarda', { chi: 'milky_way', oggetto: 'andromeda' }]]),
        M('andromeda', 2, 'love', [['effetto', { effetto: 'hearts', dove: 'andromeda', quando: 'meta' }]]),
        M('milky_way', 3, 'worried', [['anima', { chi: 'milky_way', animazione: 'shake' }]])
      ] },
      { ambiente: 'cosmo', da: 'local_group', a: 'local_group', momenti: [
        M('Sun', 4, 'laughing', [['anima', { chi: 'Sun', animazione: 'jump' }]]),
        M('andromeda', 5, 'happy', [['muovi', { chi: 'andromeda', verso: 'milky_way', percorso: 'spiral' }]]),
        M('milky_way', 6, 'love', [['effetto', { effetto: 'fireworks', dove: 'milky_way', quando: 'meta' }]])
      ] }
    ] },
    /* Buchi neri e buchi bianchi (v414). Il Sole prova a fare il buco nero
     * (`diventa`), e Sagittario A* gli spiega che è troppo leggero; il buco
     * bianco, che non ha un posto sulla carta, ammette di essere un'idea. */
    buchi: { cast: ['Sun', 'sgr_a', 'white_hole'], scene: [
      { ambiente: 'cosmo', da: 'inner_planets', a: 'local_bubble', presenti: ['Sun'], momenti: [
        M('Sun', 1, 'thinking', [['anima', { chi: 'Sun', animazione: 'wobble', quando: 'meta' }]])
      ] },
      { ambiente: 'cosmo', da: 'orion_arm', a: 'milky_way', presenti: ['Sun', 'sgr_a'], momenti: [
        M('sgr_a', 2, 'happy', [['effetto', { effetto: 'glow', dove: 'sgr_a', quando: 'meta' }]]),
        M('Sun', 3, 'excited', [['diventa', { chi: 'Sun', forma: 'black_hole' }]]),
        M('sgr_a', 4, 'laughing', [['diventa', { chi: 'Sun', forma: 'self', quando: 'fine' }]])
      ] },
      { ambiente: 'cosmo', da: 'milky_way', a: 'milky_way', presenti: ['sgr_a', 'white_hole'], momenti: [
        M('white_hole', 5, 'excited', [['effetto', { effetto: 'flash', dove: 'center' }]]),
        M('sgr_a', 6, 'surprised', [['guarda', { chi: 'sgr_a', oggetto: 'white_hole' }]]),
        M('white_hole', 7, 'thinking', [['umore', { chi: 'white_hole', umore: 'laughing', quando: 'fine' }]])
      ] }
    ] }
  };

  function studioDaModello(scopo) {
    const m = STUDIO_SCOPI[scopo] || STUDIO_SCOPI.libera;
    const chiave = STUDIO_SCOPI[scopo] ? scopo : 'libera';
    const p = studioNuovoProgetto({
      scopo: chiave, titolo: t('studio.scopo.' + chiave + '.titolo'), obiettivo: t('studio.scopo.' + chiave + '.obiettivo'),
      cast: m.cast.slice()
    });
    p.scene = m.scene.map(sc => studioNuovaScena({
      ambiente: sc.ambiente, fuoco: sc.fuoco || (sc.ambiente === 'cielo' ? 'Moon' : 'Jupiter'), zoom: sc.zoom || 'normale',
      cosmoDa: sc.da || 'planets', cosmoA: sc.a || 'milky_way',
      data: sc.data || '', ora: sc.ora || '21:00', giorni: sc.giorni || 0, presenti: (sc.presenti || []).slice(),
      momenti: sc.momenti.map(x => studioNuovoMomento({
        chi: x.chi, umore: x.umore, testo: t('studio.tpl.' + chiave + '.' + x.n),
        azioni: x.a.map(([tipo, campi]) => studioNuovaAzione(tipo, Object.assign({ chi: x.chi }, campi)))
      }))
    }));
    return p;
  }

  // ===================================================================
  // 4. Il copione: dal progetto al DSL
  // ===================================================================

  const virgolette = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const unaRiga = s => String(s || '').replace(/\s+/g, ' ').trim();
  // La riga di una data locale (giorno e ora scritti da chi crea) in UTC,
  // come la vuole `set_date`
  function isoDi(data, ora, piuGiorni = 0) {
    const giorno = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : new Date().toISOString().slice(0, 10);
    const d = new Date(giorno + 'T' + (/^\d{2}:\d{2}$/.test(ora) ? ora : '21:00') + ':00');
    if (!Number.isFinite(+d)) return null;
    return new Date(+d + piuGiorni * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  // Quanto dura un momento: la sua battuta detta con calma, più un respiro.
  // La scena aspetta comunque la fine della voce: questo è il minimo.
  /* La voce caricata a mano (v422): il momento dura quanto lei più un
   * respiro, così la scena dopo non la taglia e non resta un silenzio
   * lungo. Le azioni del momento (un viaggio, un salto) e i giorni che
   * passano sono frazioni della scena: si stringono o si allungano con lei,
   * e restano a tempo con la voce. Una durata scritta a mano più lunga
   * vince (chi vuole una pausa dopo la battuta); più corta no, taglierebbe. */
  const STUDIO_RESPIRO = 0.6;
  // La stessa impronta della narrazione (`narrImpronta`, FNV-1a sul testo
  // normalizzato): dice se la voce è stata caricata per il testo di adesso
  function studioImpronta(testo) {
    let x = 0x811c9dc5;
    const s = String(testo == null ? '' : testo).replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return x.toString(16).padStart(8, '0');
  }
  const testoDetto = m => unaRiga(m && m.testo).slice(0, 400);
  function studioVoceValida(m) {
    return !!(m && m.audio && m.audio.durata > 0 && testoDetto(m) && m.audio.impronta === studioImpronta(testoDetto(m)));
  }
  function studioDurata(momento) {
    if (studioVoceValida(momento))
      return Math.max(3, Math.ceil(momento.audio.durata / 1000 + STUDIO_RESPIRO), momento.durata > 0 ? Math.round(momento.durata) : 0);
    // v461: un momento preso da una storia pronta dura quanto la sua scena,
    // al millesimo (una storia cantata va a tempo con la canzone)
    if (momento.durata > 0) return momento.copione ? Math.round(momento.durata * 1000) / 1000 : Math.round(momento.durata);
    const testo = unaRiga(momento.testo);
    const viaggi = (momento.azioni || []).some(a => a.tipo === 'muovi' || a.tipo === 'torna');
    if (!testo) return viaggi ? 6 : 4;
    const ritmo = typeof S().ritmo === 'function' ? S().ritmo(testo).totale : testo.split(/\s+/).length * 0.42;
    return Math.max(viaggi ? 6 : 4, Math.ceil(ritmo * 1.12 + 1.6));
  }
  // La frazione di scena di un'azione: le azioni che durano (un viaggio, un
  // salto, una crescita) prendono un tratto, quelle istantanee un punto.
  const TRATTI = { inizio: [0, 0.45], meta: [0.3, 0.75], fine: [0.6, 1], tutto: [0, 1] };
  const PUNTI = { inizio: 0, meta: 0.45, fine: 0.75, tutto: 0 };
  function ripresa(azione, durevole) {
    const q = azione.quando || 'inizio';
    // v461: l'azione presa da una storia pronta tiene i suoi tempi esatti
    const e = azione.esatta;
    if (e && e.quando === q) return (e.da > 0 ? ', shot_from: ' + e.da : '') + (e.a < 1 ? ', shot_to: ' + e.a : '');
    if (durevole) {
      const [a, b] = TRATTI[q] || TRATTI.inizio;
      return (a > 0 ? ', shot_from: ' + a : '') + (b < 1 ? ', shot_to: ' + b : '');
    }
    const a = PUNTI[q] || 0;
    return a > 0 ? ', shot_from: ' + a : '';
  }
  function numeroDsl(n) { return String(Math.round(n * 100) / 100); }
  // Un comando tenuto dall'originale (v461) di nuovo in DSL; i numeri senza
  // la notazione esponenziale, che il DSL non legge
  function studioRigaDsl(r) {
    const num = v => /e/i.test(String(v)) ? v.toFixed(20).replace(/\.?0+$/, '') : String(v);
    const parti = Object.entries(r.parametri || {}).map(([k, v]) => k + ': ' + (typeof v === 'number' ? num(v) : virgolette(v)));
    if (r.ripresa) {
      if (r.ripresa.da > 0) parti.push('shot_from: ' + num(r.ripresa.da));
      if (r.ripresa.a < 1) parti.push('shot_to: ' + num(r.ripresa.a));
    }
    return r.comando + ' { ' + parti.join(', ') + ' }';
  }

  // Le righe di una sola azione, o '' se in questa vista non si può fare
  function righeAzione(az, vista, presenti, cosmo, pid) {
    const chi = az.chi;
    const inScena = id => presenti.includes(id);
    const tre = vista === 'solar_system_3d';
    switch (az.tipo) {
      case 'umore':
        if (!inScena(chi) || !az.umore) return '';
        return `character_expression { target: ${virgolette(chi)}, expression: ${virgolette(az.umore)}${ripresa(az, false)} }`;
      case 'guarda':
        if (!inScena(chi)) return '';
        if (!cosmo && luogoCosmo(az.oggetto) && !S().STOR_PERSONAGGI?.[az.oggetto]) return '';
        return `character_look_at { target: ${virgolette(chi)}, object: ${virgolette(az.oggetto || 'viewer')}${ripresa(az, false)} }`;
      case 'occhiolino':
        if (!inScena(chi)) return '';
        return `character_blink { target: ${virgolette(chi)}${ripresa(az, false)} }`;
      case 'nascondi':
        if (!inScena(chi)) return '';
        return `character_hide { target: ${virgolette(chi)}${ripresa(az, false)} }`;
      case 'muovi':
        if (!tre || !inScena(chi) || !az.verso || az.verso === chi || ospite(chi) || ospite(az.verso)) return '';
        // nella scala cosmica le mete sono i luoghi dell'universo e gli altri
        // personaggi; fuori, i luoghi dell'universo non esistono
        if (!cosmo && luogoCosmo(az.verso) && !S().STOR_PERSONAGGI?.[az.verso]) return '';
        if (cosmo && ['center', 'left', 'right', 'top', 'bottom'].includes(az.verso)) return '';
        return `character_move { target: ${virgolette(chi)}, to: ${virgolette(az.verso)}` +
          (az.lato && az.lato !== 'auto' ? `, side: ${az.lato}` : '') +
          (az.percorso ? `, path: ${az.percorso}` : '') + ripresa(az, true) + ' }';
      case 'torna':
        if (!tre || !inScena(chi) || ospite(chi)) return '';
        return `character_return { target: ${virgolette(chi)}${az.percorso ? ', path: ' + az.percorso : ''}${ripresa(az, true)} }`;
      case 'anima':
        if (!inScena(chi) || !az.animazione) return '';
        return `character_animate { target: ${virgolette(chi)}, animation: ${az.animazione}` +
          (az.volte > 0 ? ', times: ' + Math.round(az.volte) : '') + ripresa(az, true) + ' }';
      case 'scala':
        if (!inScena(chi)) return '';
        return `character_scale { target: ${virgolette(chi)}, scale: ${numeroDsl(az.scala || 1)}${ripresa(az, true)} }`;
      case 'diventa':
        if (!inScena(chi) || !STUDIO_FORME.includes(az.forma)) return '';
        return `character_become { target: ${virgolette(chi)}, shape: ${az.forma}${ripresa(az, true)} }`;
      case 'effetto': {
        if (!az.effetto) return '';
        const luoghi = ['center', 'left', 'right', 'top', 'bottom'];
        const dove = az.dove || chi || '';
        if (!cosmo && luogoCosmo(dove) && !S().STOR_PERSONAGGI?.[dove]) return '';
        const posto = !dove ? '' : luoghi.includes(dove) ? `, at: ${dove}` : `, target: ${virgolette(dove)}`;
        return `effect { type: ${az.effetto}${posto}` + (az.grandezza && az.grandezza !== 1 ? ', size: ' + numeroDsl(az.grandezza) : '') +
          (az.colore ? `, color: ${virgolette(az.colore)}` : '') + ripresa(az, false) + ' }';
      }
      case 'suono': {
        // v444: il file sta accanto alla musica della storia (§4-ter), col
        // pezzo di SHA che cambia l'indirizzo quando cambia il file
        const vol = az.volume && az.volume !== 1 ? ', volume: ' + numeroDsl(az.volume) : '';
        if (az.fonte === 'file' && az.file && pid)
          return `sound { src: ${virgolette(studioPercorsoMusica(pid, 'suono-' + az.id, az.file) + '?v=' + az.file.sha.slice(0, 10))}${vol}${ripresa(az, false)} }`;
        const sintesi = S().STOR_SUONI || [];
        return sintesi.includes(az.suono) ? `sound { type: ${az.suono}${vol}${ripresa(az, false)} }` : '';
      }
    }
    return '';
  }

  /* Il copione intero (o di una scena sola, per provarla). Ogni momento
   * diventa una scena del DSL: la camera riprende da dove era rimasta (le
   * elevazioni continuano), le facce dei personaggi si portano dietro da un
   * momento all'altro, i giorni che passano si dividono fra i momenti della
   * scena in proporzione alla loro durata. Le azioni che la vista non sa
   * fare (un viaggio nel planetario) si saltano: lo dice il controllo. */
  function studioCopione(progetto, opz = {}) {
    const righe = [];
    const titolo = unaRiga(progetto.titolo) || t('studio.senzaTitolo') || 'storia';
    righe.push(`define_demo ${virgolette(titolo.slice(0, 80))} {`);
    righe.push('  // ' + (t('studio.copione.fatto') || 'Studio delle storie'));
    if (unaRiga(progetto.obiettivo)) righe.push('  // ' + unaRiga(progetto.obiettivo).slice(0, 200));
    const umori = new Map();
    for (const id of progetto.cast) umori.set(id, (S().profilo ? S().profilo(id).espressione : '') || 'neutral');
    /* La camera della 3D va avanti per tutta la storia (v434): il giro
     * continua da una battuta all'altra (`orbit_from`, il giro già fatto) e
     * l'elevazione sale e scende fra due quote invece di tornare di colpo a
     * 34° arrivata in alto. Prima ogni battuta ripartiva dall'azimut di base
     * e girava di 8°, qualunque fosse la sua durata: in una storia di
     * battute corte la camera faceva un passettino e tornava indietro, e
     * chi guardava la vedeva ferma. Ora gira `STUDIO_GIRO_AL_SECONDO` gradi
     * per ogni secondo della battuta, che in una storia di un minuto è un
     * mezzo giro attorno alla scena. */
    let elev = 34, verso = 1, giro = 0, prima = true;
    const elevazione = durata => {
      const da = elev;
      let a = elev + verso * Math.max(2, Math.min(8, durata * 0.9));
      if (a >= STUDIO_ELEV[1] || a <= STUDIO_ELEV[0]) { a = Math.max(STUDIO_ELEV[0], Math.min(STUDIO_ELEV[1], a)); verso = -verso; }
      elev = Math.round(a);
      return [Math.round(da), elev];
    };
    const giroDi = durata => {
      const da = giro;
      const passo = Math.round(Math.max(6, Math.min(40, durata * STUDIO_GIRO_AL_SECONDO)));
      giro = (giro + passo) % 360;
      return [da, passo];
    };
    // Dove eravamo alla fine: la vista, la camera, chi era in scena (per la domanda)
    let fine = null;
    // La musica che suona (§4-ter): all'inizio, niente
    let musicaOra = 'off';
    const scene = progetto.scene.map((sc, i) => ({ sc, i })).filter(x => opz.scena === undefined || x.i === opz.scena);
    for (const { sc } of scene) {
      const presenti = studioPresenti(progetto, sc);
      const vista = sc.ambiente === 'cielo' ? 'planetarium_view' : 'solar_system_3d';
      const momenti = sc.momenti.length ? sc.momenti : [studioNuovoMomento()];
      const durate = momenti.map(studioDurata);
      const totale = durate.reduce((a, b) => a + b, 0) || 1;
      const cosmo = sc.ambiente === 'cosmo' ? studioViaggioCosmo(sc, momenti, durate) : null;
      let trascorso = 0;
      if (opz.scena === undefined && !prima) righe.push('');
      momenti.forEach((m, k) => {
        const az = [];
        // v461: un momento preso da una storia pronta ha la sua vista, la sua
        // camera e i suoi personaggi, quelli dell'originale (`m.copione`)
        const cp = m.copione;
        const visti = new Set(cp ? cp.righe.filter(r => r.comando === 'character_show').map(r => r.parametri.target) : []);
        const presentiM = cp ? [...new Set(presenti.concat([...visti], m.chi && progetto.cast.includes(m.chi) ? [m.chi] : []))] : presenti;
        const vistaM = cp ? cp.vista : vista;
        const cosmoM = cp ? cp.righe.some(r => r.comando === 'cosmic_scale') : !!cosmo;
        // Il quando: all'inizio della scena, o un pezzo del tempo che scorre
        if (sc.giorni > 0 && !cosmo) {
          const da = isoDi(sc.data, sc.ora, sc.giorni * trascorso / totale);
          const a = isoDi(sc.data, sc.ora, sc.giorni * (trascorso + durate[k]) / totale);
          if (da && a && da !== a) az.push(`date_range { from: ${virgolette(da)}, to: ${virgolette(a)} }`);
        } else if (k === 0 && sc.data) {
          const iso = isoDi(sc.data, sc.ora);
          if (iso) az.push(`set_date { iso: ${virgolette(iso)} }`);
        }
        trascorso += durate[k];
        // La musica della scena, solo se cambia (§4-ter)
        if (k === 0) {
          const mu = studioMusicaSrc(progetto, sc);
          const chiave = mu.src === 'off' ? 'off' : mu.src + '|' + numeroDsl(mu.volume);
          if (chiave !== musicaOra) { az.unshift(rigaMusica(mu)); musicaOra = chiave; }
        }
        // La data e il luogo a schermo (v414): solo se chi scrive li chiede
        if (sc.cartello) az.push('date_card { date: show, time: show, place: show }');
        // La regia (v416, scelta per scena dalla v431): di serie la camera va
        // vicino a chi parla e ai botti; se no quella che la scena ha scelto
        const rigaCamera = studioRigaCamera(sc, presenti);
        if (rigaCamera) az.push(rigaCamera);
        // La camera (quella dell'originale sta fra le sue righe)
        if (cp) {
          // niente: la camera, le date e la musica dell'originale sono sotto
        } else if (cosmo) {
          const [La, Lb] = cosmo[k];
          if (k === 0 && elev < 60) elev = 62;   // la carta si guarda un po' dall'alto
          az.push(`cosmic_scale { from: ${numeroUA(La)}, to: ${numeroUA(Lb)}, orbit: 14, elev_from: ${elev}, elev_to: ${Math.min(80, elev + 3)} }`);
          elev = Math.min(80, elev + 3) >= 80 ? 62 : Math.min(80, elev + 3);
        } else if (vista === 'planetarium_view') {
          const fuoco = STUDIO_FUOCHI_CIELO.includes(sc.fuoco) ? sc.fuoco : (presenti.find(id => STUDIO_FUOCHI_CIELO.includes(id)) || 'Moon');
          az.push(`center_target { target: ${virgolette(fuoco)} }`);
          az.push(`set_fov { degrees: ${STUDIO_FOV[sc.zoom] || 18} }`);
        } else {
          const z = STUDIO_ZOOM[sc.zoom] || 1;
          const [e1, e2] = elevazione(durate[k]);
          const [g0, passo] = giroDi(durate[k]);
          const zoom = z !== 1 ? `, zoom_from: ${z}, zoom_to: ${z}` : '';
          const giroRiga = `orbit: ${passo}${g0 ? ', orbit_from: ' + g0 : ''}, elev_from: ${e1}, elev_to: ${e2}`;
          if (sc.ambiente === 'terra_luna') {
            az.push(`camera_3d { scene: earth_moon, focus: 'Earth-Moon', ${giroRiga}${zoom} }`);
          } else if (sc.ambiente === 'pianeta') {
            const fuoco = STUDIO_FUOCHI_3D.includes(sc.fuoco) ? sc.fuoco : 'Jupiter';
            // Addosso al pianeta (v442): sui giganti la base di serie era mezzo
            // Sistema Solare col pianeta al centro, quasi uguale alla scena
            // «Sistema Solare»; la Terra ha già da sé lo zoom da vicino
            const vicino = fuoco !== 'Earth' ? ', close_up: show' : '';
            az.push(`camera_3d { scene: system, focus: ${virgolette(fuoco)}, ${giroRiga}${zoom}${vicino} }`);
          } else {
            let quadro = presenti.map(id => id === 'Moon' ? 'Earth' : id).filter(id => STUDIO_INQUADRABILI.includes(id));
            // I viaggi verso un pianeta fuori dal cast: anche lui nel quadro
            for (const a of m.azioni || []) if (a.tipo === 'muovi' && STUDIO_INQUADRABILI.includes(a.verso)) quadro.push(a.verso);
            quadro = [...new Set(quadro)];
            if (!quadro.length) quadro = ['Earth', 'Mars', 'Jupiter'];
            az.push(`camera_3d { scene: system, focus: 'Sun', frame: ${virgolette(quadro.join(','))}, ${giroRiga}${zoom} }`);
          }
        }
        // I personaggi: chi parla con la faccia del momento, gli altri con
        // quella che avevano
        const parla = m.chi && presentiM.includes(m.chi) && unaRiga(m.testo);
        if (m.chi && m.umore) umori.set(m.chi, m.umore);
        if (cp) {
          // Le righe dell'originale, nel loro ordine; chi parla con la faccia
          // che gli ha dato chi scrive
          for (const r of cp.righe) {
            let riga = r;
            if (r.comando === 'character_show' && r.parametri.target === m.chi && m.umore)
              riga = Object.assign({}, r, { parametri: Object.assign({}, r.parametri, { expression: m.umore }) });
            if ((riga.comando === 'character_show' || riga.comando === 'character_expression') && typeof riga.parametri.expression === 'string')
              umori.set(riga.parametri.target, riga.parametri.expression);
            az.push(studioRigaDsl(riga));
          }
          if (parla && !visti.has(m.chi) && !(m.parla && m.parla.chi === m.chi)) az.push(`character_show { target: ${virgolette(m.chi)}, expression: ${virgolette(umori.get(m.chi) || 'neutral')} }`);
        } else for (const id of presenti) {
          const espr = umori.get(id) || 'neutral';
          az.push(`character_show { target: ${virgolette(id)}, expression: ${virgolette(espr)} }`);
        }
        for (const a of m.azioni || []) {
          const riga = righeAzione(a, vistaM, presentiM, cosmoM, progetto.id);
          if (riga) az.push(riga);
          if (a.tipo === 'umore' && a.chi && a.umore) umori.set(a.chi, a.umore);
        }
        // La battuta dell'originale, finché resta quella, con la sua voce
        // registrata (`id`); cambiata, diventa testo
        const pa = m.parla;
        if (parla && pa && pa.chi === m.chi && unaRiga(pa.testo) === unaRiga(m.testo))
          az.push(`character_speak { target: ${virgolette(m.chi)}, id: ${virgolette(pa.id)} }`);
        else if (parla) az.push(`character_speak { target: ${virgolette(m.chi)}, text: ${virgolette(unaRiga(m.testo).slice(0, 400))} }`);
        righe.push(`  scene ${vistaM} {`);
        righe.push(cp ? `    duration: ${Math.round(durate[k] * 1000)}ms;` : `    duration: ${durate[k]}s;`);
        for (const a of az) righe.push(`    action: ${a};`);
        righe.push('  }');
        prima = false;
        fine = { vista: vistaM, presenti: presentiM, cosmo: cosmoM, sc,
          camera: az.filter(a => /^(camera_3d|cosmic_scale|center_target|set_fov|story_camera)\b/.test(a))
            .map(a => a.replace(/, shot_(from|to): [\d.]+/g, ''))
            .map(a => a.startsWith('cosmic_scale') && cosmo ? a.replace(/from: [^,]+/, 'from: ' + numeroUA(cosmo[k][1])) : a)
            // La domanda riparte da dove la camera è arrivata, e gira ancora un poco
            .map(a => a.startsWith('camera_3d') ? a.replace(/orbit: [^,]+(, orbit_from: [^,]+)?, elev_from: [^,]+, elev_to: [^,} ]+/,
              `orbit: 10${giro ? ', orbit_from: ' + giro : ''}, elev_from: ${elev}, elev_to: ${elev}`) : a) };
      });
    }
    // La domanda al pubblico (v430, §4-bis): una scena in più, ferma, con il
    // cartello e chi la pone che la dice. Solo nel copione intero.
    const domanda = opz.scena === undefined && fine ? studioDomandaFinale(progetto) : null;
    if (domanda) {
      const qui = id => progetto.cast.includes(id) && (fine.sc.ambiente === 'cosmo' || !soloCosmo(id));
      const presenti = fine.presenti.slice();
      let chi = qui(domanda.chi) ? domanda.chi : presenti[0];
      if (chi && !presenti.includes(chi)) presenti.push(chi);
      const detta = t('studio.domanda.detta', { domanda: domanda.testo }) || domanda.testo;
      const durata = studioDurata(studioNuovoMomento({ testo: detta })) + 3;
      righe.push('');
      righe.push(`  scene ${fine.vista} {`);
      righe.push(`    duration: ${durata}s;`);
      for (const a of fine.camera) righe.push(`    action: ${a};`);
      for (const id of presenti) {
        const espr = id === chi ? 'excited' : umori.get(id) || 'neutral';
        righe.push(`    action: character_show { target: ${virgolette(id)}, expression: ${virgolette(espr)} };`);
      }
      if (chi) righe.push(`    action: character_look_at { target: ${virgolette(chi)}, object: 'viewer' };`);
      righe.push(`    action: story_question { text: ${virgolette(domanda.testo)}` + (domanda.a ? `, a: ${virgolette(domanda.a)}` : '') +
        (domanda.b ? `, b: ${virgolette(domanda.b)}` : '') + `, kind: ${domanda.kind}` + (chi ? `, from: ${virgolette(chi)}` : '') + ' };');
      if (chi) righe.push(`    action: character_speak { target: ${virgolette(chi)}, text: ${virgolette(detta.slice(0, 400))} };`);
      righe.push('  }');
    }
    righe.push('}');
    return righe.join('\n');
  }
  /* Il viaggio della camera in una scena della scala cosmica: da una tappa
   * all'altra, diviso fra i momenti in proporzione alla loro durata con una
   * curva morbida (parte piano e arriva piano), così più momenti di fila
   * sono un volo solo. Se in un momento un personaggio parte verso un luogo
   * dell'universo, la camera di quel momento va a inquadrare la meta: chi
   * viaggia verso Andromeda non deve uscire dal quadro. Restituisce, per
   * ogni momento, la scala d'inizio e di fine. */
  function studioViaggioCosmo(sc, momenti, durate) {
    const La = STUDIO_TAPPE_COSMO[sc.cosmoDa] ?? STUDIO_TAPPE_COSMO.planets;
    const Lb = STUDIO_TAPPE_COSMO[sc.cosmoA] ?? La;
    const totale = durate.reduce((a, b) => a + b, 0) || 1;
    const liscio = u => u * u * (3 - 2 * u);
    let fatto = 0, prima = La;
    return momenti.map((m, k) => {
      fatto += durate[k];
      let fine = La + (Lb - La) * liscio(fatto / totale);
      const viaggio = (m.azioni || []).find(a => a.tipo === 'muovi' && studioLCosmo(a.verso) !== null);
      if (viaggio) fine = studioLCosmo(viaggio.verso);
      const coppia = [prima, fine];
      prima = fine;
      return coppia;
    });
  }
  // Una scala come numero di UA per `cosmic_scale` (metà del lato corto),
  // con quattro cifre buone e senza notazione esponenziale
  function numeroUA(L) {
    const v = Number(Math.pow(10, L).toPrecision(4));
    return v >= 1e-6 ? String(v) : '0.000001';
  }

  // ===================================================================
  // 3-bis. Da una CosmoStoria pronta a un progetto dello Studio (v461)
  // ===================================================================

  /* «Duplica e modifica» su una CosmoStoria pronta portava al copione DSL
   * nella linguetta Demo: chi usa l'app voleva invece ritrovarla **nello
   * Studio**, con tutto quello che c'era già (le battute, le facce, le
   * azioni, la camera, la musica), da ritoccare e salvare. Qui il copione
   * torna progetto: ogni scena del DSL diventa un momento, le scene di fila
   * nello stesso posto (il cielo, la Terra e la Luna, un pianeta, il Sistema
   * Solare, la scala cosmica) diventano una scena dello Studio.
   *
   * Quello che lo Studio sa scrivere diventa modificabile: chi parla e cosa
   * dice, la sua faccia, le azioni (umore, sguardo, viaggio, salto, misura,
   * effetto…). Un'azione entra fra quelle dello Studio solo se lo Studio la
   * riscrive **uguale** (si prova: `righeAzione` e il motore che rilegge);
   * se no resta com'era fra i comandi dell'originale (`m.copione.righe`),
   * con la camera, le date, la musica a tempo, i versi cantati, le
   * fotografie: si vedono nel momento e si possono togliere, e il copione
   * li rimette tali e quali. Così la storia duplicata, senza ritocchi, è la
   * stessa storia. La battuta registrata resta sua (`m.parla`) finché il
   * testo non cambia. */
  const STUDIO_DAL_DSL = {
    character_expression: { chiavi: ['target', 'expression'], fai: p => ({ tipo: 'umore', chi: p.target, umore: p.expression }) },
    character_look_at: { chiavi: ['target', 'object'], fai: p => ({ tipo: 'guarda', chi: p.target, oggetto: p.object }) },
    character_blink: { chiavi: ['target'], fai: p => ({ tipo: 'occhiolino', chi: p.target }) },
    character_hide: { chiavi: ['target'], fai: p => ({ tipo: 'nascondi', chi: p.target }) },
    character_move: { chiavi: ['target', 'to', 'side', 'path'], fai: p => ({ tipo: 'muovi', chi: p.target, verso: p.to, lato: p.side || 'auto', percorso: p.path || 'arc' }) },
    character_return: { chiavi: ['target', 'path'], fai: p => ({ tipo: 'torna', chi: p.target, percorso: p.path || 'arc' }) },
    character_animate: { chiavi: ['target', 'animation', 'times'], fai: p => ({ tipo: 'anima', chi: p.target, animazione: p.animation, volte: p.times || 0 }) },
    character_scale: { chiavi: ['target', 'scale'], fai: p => ({ tipo: 'scala', chi: p.target, scala: p.scale }) },
    character_become: { chiavi: ['target', 'shape'], fai: p => ({ tipo: 'diventa', chi: p.target, forma: p.shape }) },
    effect: { chiavi: ['type', 'target', 'at', 'size', 'color'],
      fai: p => ({ tipo: 'effetto', chi: '', effetto: p.type, dove: p.at || p.target || '', grandezza: p.size || 1, colore: p.color || '' }) },
    sound: { chiavi: ['type', 'volume'], fai: p => ({ tipo: 'suono', fonte: 'sintesi', suono: p.type, volume: p.volume || 1 }) }
  };
  const STUDIO_DUREVOLI = ['muovi', 'torna', 'anima', 'scala', 'diventa'];
  // Un'azione del motore in una forma da confrontare (l'ordine dei parametri
  // e le virgolette non contano)
  function firmaAzione(a) {
    const par = Object.keys(a.parametri).sort().map(k => k + '=' + String(a.parametri[k]));
    const r = a.ripresa || { da: 0, a: 1 };
    return a.comando + '|' + par.join('|') + '|' + r.da + '-' + r.a;
  }
  function rileggiAzione(riga) {
    const M = radice.AstroDemoMotore;
    if (!M || typeof M.analizza !== 'function' || !riga) return null;
    try { return M.analizza(`define_demo 'x' {\n scene x {\n duration: 1s;\n action: ${riga};\n }\n}`).scene[0].azioni[0]; }
    catch (_) { return null; }
  }
  // L'azione dello Studio che riscrive `a` uguale, o null
  function azioneDalDsl(a, vista, presenti, cosmo) {
    const regola = STUDIO_DAL_DSL[a.comando];
    if (!regola || Object.keys(a.parametri).some(k => !regola.chiavi.includes(k))) return null;
    if (a.comando === 'effect' && a.parametri.target && a.parametri.at) return null;
    const campi = regola.fai(a.parametri);
    const durevole = STUDIO_DUREVOLI.includes(campi.tipo);
    const r = a.ripresa || { da: 0, a: 1 };
    // il «quando» più vicino, e i tempi esatti dell'originale
    const quando = STUDIO_QUANDO.reduce((meglio, q) => {
      const d = durevole ? Math.abs(TRATTI[q][0] - r.da) + Math.abs(TRATTI[q][1] - r.a) : Math.abs(PUNTI[q] - r.da) + (q === 'tutto' ? 0.01 : 0);
      return d < meglio.d ? { q, d } : meglio;
    }, { q: 'inizio', d: Infinity }).q;
    // passata dalla pulizia di un progetto letto, perché si provi quella che resterà
    const grezza = studioNuovaAzione(campi.tipo, Object.assign(campi, { quando, esatta: { da: r.da, a: r.a, quando } }));
    let az;
    try { az = studioRipulisci({ cast: [], scene: [{ momenti: [{ azioni: [grezza] }] }] }).scene[0].momenti[0].azioni[0]; } catch (_) { return null; }
    if (!az) return null;
    const rifatta = rileggiAzione(righeAzione(az, vista, presenti, cosmo, ''));
    return rifatta && firmaAzione(rifatta) === firmaAzione(a) ? az : null;
  }
  function ambienteDsl(sc) {
    if (sc.vista === 'planetarium_view') return 'cielo';
    if (sc.vista !== 'solar_system_3d') return null;
    if (sc.azioni.some(a => a.comando === 'cosmic_scale')) return 'cosmo';
    const cam = sc.azioni.find(a => a.comando === 'camera_3d');
    if (!cam) return null;
    if (cam.parametri.scene === 'earth_moon') return 'terra_luna';
    const f = cam.parametri.focus;
    return f && f !== 'Sun' && STUDIO_FUOCHI_3D.includes(f) ? 'pianeta' : 'sistema';
  }
  function studioDaCopione(testo, opz = {}) {
    const M = radice.AstroDemoMotore;
    if (!M || typeof M.analizza !== 'function') throw new Error(t('studio.err.file') || 'motore');
    const dsl = M.analizza(testo);
    const castBase = String(opz.cast || '').split(',').map(x => x.trim()).filter(Boolean);
    const cast = [...castBase];
    const aggiungi = id => { if (typeof id === 'string' && /^[\w :.-]{1,40}$/.test(id) && !cast.includes(id) && cast.length < 24) cast.push(id); };
    for (const sc of dsl.scene) for (const a of sc.azioni)
      if (a.comando === 'character_show' || a.comando === 'character_speak' || a.comando === 'character_sing') aggiungi(a.parametri.target);
    const scene = [];
    let gruppo = null;
    for (const sc of dsl.scene) {
      const amb = ambienteDsl(sc);
      if (!gruppo || (amb && amb !== gruppo.ambiente && gruppo.momenti.length) || gruppo.momenti.length >= 60) {
        if (scene.length >= 40) break;
        gruppo = studioNuovaScena({ ambiente: amb || 'sistema', presenti: [], momenti: [] });
        scene.push(gruppo);
      }
      if (amb && !gruppo.momenti.length) gruppo.ambiente = amb;
      const fuoco = sc.azioni.find(a => a.comando === 'center_target') || sc.azioni.find(a => a.comando === 'camera_3d');
      const f = fuoco && (fuoco.parametri.target || fuoco.parametri.focus);
      if (gruppo.ambiente === 'cielo' && STUDIO_FUOCHI_CIELO.includes(f)) gruppo.fuoco = f;
      if (gruppo.ambiente === 'pianeta' && STUDIO_FUOCHI_3D.includes(f)) gruppo.fuoco = f;
      // In scena: chi è mostrato e chi parla
      const qui = [];
      for (const a of sc.azioni) if ((a.comando === 'character_show' || a.comando === 'character_speak') && cast.includes(a.parametri.target) && !qui.includes(a.parametri.target)) qui.push(a.parametri.target);
      for (const id of qui) if (!gruppo.presenti.includes(id)) gruppo.presenti.push(id);
      const m = studioNuovoMomento({ durata: Math.min(120, sc.durata / 1000) });
      const righe = [];
      const cosmo = sc.azioni.some(a => a.comando === 'cosmic_scale');
      for (const a of sc.azioni) {
        const chiavi = Object.keys(a.parametri);
        // La battuta (una per momento): chi, cosa, e la voce registrata
        if (a.comando === 'character_speak' && !m.chi && !a.ripresa && cast.includes(a.parametri.target) &&
            chiavi.every(k => ['target', 'id', 'text'].includes(k)) && (a.parametri.id || a.parametri.text) && !(a.parametri.id && a.parametri.text)) {
          m.chi = a.parametri.target;
          if (a.parametri.id) {
            const detto = t(a.parametri.id);
            m.testo = String(detto && detto !== a.parametri.id ? detto : a.parametri.id).slice(0, 400);
            m.parla = { id: String(a.parametri.id).slice(0, 80), chi: m.chi, testo: m.testo };
            if (!/^[\w.-]{1,80}$/.test(m.parla.id)) { m.chi = ''; m.testo = ''; m.parla = null; righe.push(a); }
          } else m.testo = String(a.parametri.text).slice(0, 400);
          continue;
        }
        const az = m.azioni.length < 30 ? azioneDalDsl(a, sc.vista, qui, cosmo) : null;
        if (az) m.azioni.push(az);
        else righe.push(a);
      }
      // La faccia di chi parla: quella con cui l'originale lo mostra
      const mostra = m.chi && righe.find(a => a.comando === 'character_show' && a.parametri.target === m.chi);
      if (mostra && typeof mostra.parametri.expression === 'string') m.umore = mostra.parametri.expression.slice(0, 20);
      m.copione = studioPulisciCopione({ vista: sc.vista, righe: righe.slice(0, 80).map(a => ({ comando: a.comando, parametri: a.parametri, ripresa: a.ripresa })) });
      gruppo.momenti.push(m);
    }
    const p = studioNuovoProgetto({
      titolo: unaRiga(opz.titolo || dsl.id).slice(0, 120), obiettivo: unaRiga(opz.obiettivo || '').slice(0, 300),
      cast: cast.length ? cast : ['Moon'], scene, origine: typeof opz.chiave === 'string' && /^[\w-]{1,60}$/.test(opz.chiave) ? opz.chiave : '',
      aggiornato: Date.now()
    });
    for (const sc of p.scene) if (!sc.presenti.length) sc.presenti = p.cast.slice(0, 1);
    return studioRipulisci(p);
  }

  // ===================================================================
  // 4-ter. La musica di sottofondo (v440)
  // ===================================================================

  /* Una storia può avere una traccia per tutta la storia, e ogni scena
   * quella della storia, una sua o il silenzio. Il copione lo dice con
   * `story_music` all'inizio di ogni scena dello Studio in cui la musica
   * cambia: una traccia che continua non si richiede, e così suona senza
   * ricominciare da capo (STORIE.md, «La musica»).
   *
   * I file caricati stanno sul sito in `audio/storie-musica/<storia>/`,
   * `storia.<est>` e `scena-<id della scena>.<est>`: l'id del progetto e
   * quello della scena non cambiano, quindi il percorso è lo stesso su ogni
   * dispositivo. Il `?v=` è un pezzo dello SHA del file: una traccia
   * sostituita ha un indirizzo nuovo, e la cache non fa sentire la vecchia. */
  const STUDIO_MUSICA_CARTELLA = 'audio/storie-musica';
  const cartellaMusica = pid => STUDIO_MUSICA_CARTELLA + '/' + (String(pid || '').replace(/[^\w-]/g, '').slice(0, 30) || 'storia');
  // `sid`: niente per la storia, l'id della scena, o `suono-<id dell'azione>`
  // per un suono da file (v444), che vive nella stessa cartella
  function studioPercorsoMusica(pid, sid, mu) {
    const posto = !sid ? 'storia' : /^suono-/.test(sid) ? sid : 'scena-' + sid;
    return cartellaMusica(pid) + '/' + posto + '.' + mu.est;
  }
  // La traccia che suona in una scena (o in tutta la storia, senza scena),
  // come la vuole il copione: `{ src, volume }`, `{ src: 'off' }`, o null
  // se la musica non si sa trovare (una traccia tolta dal catalogo)
  function studioMusicaSrc(progetto, sc) {
    let mu = progetto.musica, sid = '';
    if (sc && sc.musicaModo === 'silenzio') return { src: 'off' };
    if (sc && sc.musicaModo === 'propria' && sc.musica) { mu = sc.musica; sid = sc.id; }
    if (!mu) return { src: 'off' };
    if (mu.tipo === 'file') return { src: studioPercorsoMusica(progetto.id, sid, mu) + '?v=' + mu.sha.slice(0, 10), volume: mu.volume };
    const tracce = Array.isArray(radice.ASTRO_TRACCE_MUSICALI) ? radice.ASTRO_TRACCE_MUSICALI : [];
    const tr = tracce.find(x => x && x.id === mu.id && typeof x.file === 'string');
    return tr ? { src: 'musica/' + encodeURIComponent(tr.file), volume: mu.volume } : { src: 'off' };
  }
  function rigaMusica(m) {
    return m.src === 'off' ? 'story_music { src: off }' : `story_music { src: ${virgolette(m.src)}, volume: ${numeroDsl(m.volume)} }`;
  }

  function studioDurataTotale(progetto) {
    return progetto.scene.reduce((n, sc) => n + sc.momenti.reduce((m, x) => m + studioDurata(x), 0), 0);
  }

  // ===================================================================
  // 4-bis. La domanda finale al pubblico (v430)
  // ===================================================================

  /* Un episodio può chiudersi con una domanda a chi guarda — «Chi ha
   * ragione?», «Dove dovrebbe andare la sonda?», «Di chi ti fideresti?»,
   * «Quale oggetto celeste dovremmo esplorare?», una scelta fra A e B, una
   * previsione, il protagonista del prossimo Short. Non c'è sempre: nasce
   * **da quello che è successo** nell'episodio (chi ha litigato, chi è
   * partito e per dove, chi è diventato un'altra cosa, chi è rimasto zitto),
   * e quando non è successo niente che valga una domanda la storia finisce
   * senza. Chi scrive può chiederla sempre, mai, sceglierne il tipo o
   * scriverla a mano.
   *
   * `studioDomandaFinale` è una funzione pura: legge gli eventi
   * (`studioFattiEpisodio`), dà un punteggio a ogni tipo e tiene il
   * migliore; sotto `STUDIO_DOMANDA_SOGLIA`, in modo automatico, non c'è
   * domanda. Il copione la mette in una scena in più, dopo l'ultima, con il
   * cartello `story_question` e chi la pone che la dice. */
  const STUDIO_TIPI_DOMANDA = ['ragione', 'sonda', 'fiducia', 'esplora', 'ab', 'previsione', 'protagonista'];
  const STUDIO_MODI_DOMANDA = ['auto', 'sempre', 'mai'];
  const STUDIO_KIND_DOMANDA = { ragione: 'who_is_right', sonda: 'probe', fiducia: 'trust', esplora: 'explore', ab: 'choice',
    previsione: 'prediction', protagonista: 'next_star' };
  const STUDIO_DOMANDA_SOGLIA = 2;
  const UMORI_DURI = ['angry', 'annoyed', 'bully'];
  const UMORI_GENTILI = ['happy', 'love', 'excited', 'laughing', 'thinking', 'neutral'];
  const POSTI_SCHERMO = ['center', 'left', 'right', 'top', 'bottom', 'orbit', 'viewer'];
  // Le vesti che vengono dopo una veste, per la previsione: la vita vera
  // delle stelle (una gigante rossa come il Sole diventa una nana bianca;
  // una stella molto più pesante esplode e può lasciare un buco nero)
  const STUDIO_DOPO_VESTE = { red_giant: ['white_dwarf', 'supernova'], supernova: ['black_hole', 'white_dwarf'],
    white_dwarf: ['white_dwarf', 'black_hole'], black_hole: ['white_dwarf', 'black_hole'] };
  const nomeQualunque = id => !id ? '' : luogoCosmo(id) && !(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id]) ? nomeLuogo(id)
    : S().nome ? S().nome(id) : id;
  const eSonda = id => !!(S().profilo && S().profilo(id).famiglia === 'sonda');
  const eMacchina = id => !!(S().profilo && ['sonda', 'stazione'].includes(S().profilo(id).famiglia));

  // Quello che è successo nell'episodio, in ordine. Funzione pura.
  function studioFattiEpisodio(progetto) {
    const f = { battute: [], parlato: new Map(), umori: new Map(), mete: [], viaggi: new Map(), vesti: [], presenti: new Set(),
      litigi: [], nominati: [], luoghi: [], partenze: [] };
    const tutti = Object.keys(S().STOR_PERSONAGGI || {});
    let prima = null;
    for (const sc of progetto.scene) {
      studioPresenti(progetto, sc).forEach(id => f.presenti.add(id));
      if (sc.ambiente === 'cosmo' && sc.cosmoA && !f.luoghi.includes(sc.cosmoA)) f.luoghi.push(sc.cosmoA);
      for (const m of sc.momenti) {
        const testo = unaRiga(m.testo);
        if (m.chi && testo) {
          const umore = m.umore || studioUmoreDalTesto(testo) || '';
          const b = { chi: m.chi, testo, umore };
          f.battute.push(b);
          f.parlato.set(m.chi, (f.parlato.get(m.chi) || 0) + 1);
          if (umore) f.umori.set(m.chi, umore);
          // Un litigio: chi risponde a un altro con un «no», un «sbagli»,
          // un «invece», o con la faccia dura
          if (prima && prima.chi !== m.chi && (trova(normalizza(testo), 'disaccordo') || UMORI_DURI.includes(umore)))
            f.litigi.push([prima.chi, m.chi]);
          // Chi è nominato: con la maiuscola, perché «io» non è Io e «sole»
          // in «sole parole» non è il Sole (la normalizzazione tiene le posizioni)
          // (e «Io sono…» a inizio frase non è la luna: `studio.parole.pronomi`)
          const norm = normalizza(testo);
          for (const n of personaggiNelTesto(norm, tutti)) {
            const iniziale = testo.charAt(n.pos);
            if (parole('pronomi').includes(norm.slice(n.pos, n.fine))) continue;
            if (n.id !== m.chi && iniziale !== iniziale.toLowerCase() && !f.nominati.includes(n.id)) f.nominati.push(n.id);
          }
          prima = b;
        }
        for (const a of m.azioni || []) {
          if (a.tipo === 'umore' && a.chi && a.umore) f.umori.set(a.chi, a.umore);
          if (a.tipo === 'muovi' && a.chi && a.verso && !POSTI_SCHERMO.includes(a.verso)) {
            if (!f.mete.includes(a.verso)) f.mete.push(a.verso);
            f.viaggi.delete(a.chi); f.viaggi.set(a.chi, a.verso);
            f.partenze.push([a.chi, a.verso]);
          }
          if (a.tipo === 'torna' && a.chi) f.viaggi.delete(a.chi);
          if (a.tipo === 'diventa' && a.chi) f.vesti.push({ chi: a.chi, forma: a.forma });
        }
      }
    }
    return f;
  }

  // I candidati, uno per tipo (o null), col loro punteggio
  function candidatiDomanda(progetto, f) {
    const c = {};
    const parlanti = [...f.parlato.keys()];
    const protagonista = parlanti.slice().sort((a, b) => f.parlato.get(b) - f.parlato.get(a))[0] || progetto.cast[0] || '';
    const terzo = coppia => [...f.presenti].find(id => !coppia.includes(id) && f.parlato.has(id)) || coppia[1];
    const voce = (tipo, punteggio, dati, chi, a, b) => ({ tipo, punteggio, dati, chi: chi || protagonista, a: a || '', b: b || '' });
    // Chi ha ragione: l'ultimo litigio, o due che chiudono con facce opposte
    const litigio = f.litigi[f.litigi.length - 1];
    const duri = parlanti.filter(id => UMORI_DURI.includes(f.umori.get(id)));
    const gentili = parlanti.filter(id => UMORI_GENTILI.includes(f.umori.get(id)) || !f.umori.get(id));
    const coppiaUmori = duri.length && gentili.find(id => id !== duri[0]) ? [duri[0], gentili.find(id => id !== duri[0])] : null;
    const coppiaRagione = litigio || coppiaUmori;
    if (coppiaRagione) {
      const [x, y] = coppiaRagione;
      c.ragione = voce('ragione', litigio ? 3 : 2.2, { a: nomeQualunque(x), b: nomeQualunque(y) }, terzo(coppiaRagione), nomeQualunque(x), nomeQualunque(y));
    }
    // Dove dovrebbe andare la sonda: le mete viste e chi è stato nominato
    const sonda = [...f.presenti].find(eSonda) || progetto.cast.find(eSonda);
    if (sonda) {
      const mete = [...new Set(f.mete.concat(f.nominati, [...f.presenti]))]
        .filter(id => id !== sonda && !eMacchina(id) && !POSTI_SCHERMO.includes(id));
      const riserva = ['Jupiter', 'Saturn', 'Neptune', 'Mars', 'Pluto'].filter(id => !mete.includes(id));
      const [a, b] = mete.concat(riserva);
      c.sonda = voce('sonda', f.viaggi.has(sonda) || f.mete.length ? 3 : 2.4,
        { sonda: nomeQualunque(sonda), a: nomeQualunque(a), b: nomeQualunque(b) }, sonda, nomeQualunque(a), nomeQualunque(b));
    }
    // Di chi ti fideresti: un bullo (o un infastidito) contro uno gentile
    const bullo = parlanti.find(id => ['bully', 'annoyed'].includes(f.umori.get(id)));
    const buono = bullo && gentili.find(id => id !== bullo);
    if (bullo && buono) c.fiducia = voce('fiducia', 2.6, { a: nomeQualunque(buono), b: nomeQualunque(bullo) }, terzo([buono, bullo]),
      nomeQualunque(buono), nomeQualunque(bullo));
    else if (parlanti.length >= 2 && f.litigi.length) {
      const [x, y] = f.litigi[f.litigi.length - 1];
      c.fiducia = voce('fiducia', 1.6, { a: nomeQualunque(x), b: nomeQualunque(y) }, terzo([x, y]), nomeQualunque(x), nomeQualunque(y));
    }
    // Quale oggetto celeste esplorare: dove si è andati, i luoghi della carta,
    // chi è stato nominato
    const oggetti = [...new Set(f.mete.concat(f.luoghi, f.nominati))].filter(id => !eMacchina(id));
    const esplorabili = oggetti.length >= 2 ? oggetti : [...new Set(oggetti.concat([...f.presenti].filter(id => !eMacchina(id))))];
    if (esplorabili.length >= 2) {
      const [a, b] = esplorabili.slice(-2);
      c.esplora = voce('esplora', oggetti.length >= 2 ? 2.2 : 1.4, { a: nomeQualunque(a), b: nomeQualunque(b) }, protagonista,
        nomeQualunque(a), nomeQualunque(b));
    }
    // A o B: chi è partito avrebbe potuto restare
    const [viaggiatore, meta] = [...f.viaggi.entries()].pop() || [];
    const ultimoViaggio = viaggiatore ? [viaggiatore, meta] : null;
    const partenza = ultimoViaggio || f.partenze[f.partenze.length - 1];
    if (partenza) {
      const [chi, dove] = partenza;
      const a = t('studio.domanda.scelta.vai', { meta: nomeQualunque(dove) }), b = t('studio.domanda.scelta.resta');
      c.ab = voce('ab', 1.8, { chi: nomeQualunque(chi), meta: nomeQualunque(dove) }, chi, a, b);
    }
    // La previsione: dopo una veste, che cosa viene; dopo un viaggio senza
    // ritorno, se tornerà a casa
    const veste = f.vesti.filter(v => v.forma !== 'self').pop();
    if (veste && STUDIO_DOPO_VESTE[veste.forma]) {
      const [x, y] = STUDIO_DOPO_VESTE[veste.forma].map(v => t('storie.veste.' + v));   // la fine della sua vita
      c.previsione = voce('previsione', 2.8, { chi: nomeQualunque(veste.chi), a: x, b: y }, veste.chi, x, y);
    } else if (ultimoViaggio) {
      const a = t('studio.domanda.scelta.torna'), b = t('studio.domanda.scelta.restaLa', { meta: nomeQualunque(ultimoViaggio[1]) });
      c.previsione = voce('previsione', 2, { chi: nomeQualunque(ultimoViaggio[0]), a, b }, ultimoViaggio[0], a, b);
      c.previsione.variante = 'Viaggio';
    }
    // Il protagonista del prossimo Short: chi è stato zitto, chi è stato
    // nominato senza esserci, poi chi ha parlato meno
    const zitti = [...f.presenti].filter(id => !f.parlato.has(id) && id !== protagonista);
    const fuori = f.nominati.filter(id => !f.presenti.has(id) && S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id]);
    const pochi = parlanti.filter(id => id !== protagonista).sort((a, b) => f.parlato.get(a) - f.parlato.get(b));
    const nuovi = [...new Set(zitti.concat(fuori, pochi))];
    if (nuovi.length >= 2) {
      const [a, b] = nuovi;
      c.protagonista = voce('protagonista', zitti.length || fuori.length ? 2 : 1, { a: nomeQualunque(a), b: nomeQualunque(b) }, protagonista,
        nomeQualunque(a), nomeQualunque(b));
    }
    return c;
  }

  /* La domanda di un progetto, o null. `{ tipo, kind, testo, a, b, chi,
   * punteggio, scritta }`: `scritta` quando l'ha scritta chi crea la storia. */
  function studioDomandaFinale(progetto) {
    const d = progetto.domanda || {};
    const modo = STUDIO_MODI_DOMANDA.includes(d.modo) ? d.modo : 'auto';
    // v432: la domanda è facoltativa, e c'è solo se chi scrive la accende
    if (d.attiva !== true || modo === 'mai') return null;
    const f = studioFattiEpisodio(progetto);
    const protagonista = [...f.parlato.keys()].sort((a, b) => f.parlato.get(b) - f.parlato.get(a))[0] || progetto.cast[0] || '';
    // Scritta a mano: vince sempre, con le scelte scritte accanto
    if (unaRiga(d.testo)) {
      const tipo = STUDIO_TIPI_DOMANDA.includes(d.tipo) ? d.tipo : 'ab';
      return { tipo, kind: STUDIO_KIND_DOMANDA[tipo], testo: unaRiga(d.testo).slice(0, 200), a: unaRiga(d.a).slice(0, 60),
        b: unaRiga(d.b).slice(0, 60), chi: progetto.cast.includes(d.chi) ? d.chi : protagonista, punteggio: Infinity, scritta: true };
    }
    if (f.battute.length < 2 && modo === 'auto') return null;
    const c = candidatiDomanda(progetto, f);
    let scelto = null;
    if (STUDIO_TIPI_DOMANDA.includes(d.tipo)) scelto = c[d.tipo] || null;
    else for (const tipo of STUDIO_TIPI_DOMANDA) if (c[tipo] && (!scelto || c[tipo].punteggio > scelto.punteggio)) scelto = c[tipo];
    if (!scelto || (modo === 'auto' && scelto.punteggio < STUDIO_DOMANDA_SOGLIA)) return null;
    const testo = t('studio.domanda.tpl.' + scelto.tipo + (scelto.variante || ''), scelto.dati);
    if (!testo) return null;
    return { tipo: scelto.tipo, kind: STUDIO_KIND_DOMANDA[scelto.tipo], testo: testo.slice(0, 200), a: scelto.a.slice(0, 60),
      b: scelto.b.slice(0, 60), chi: scelto.chi || protagonista, punteggio: scelto.punteggio, scritta: false };
  }

  // ===================================================================
  // 5. Gli aiuti: suggerimenti, comandi a parole, controllo dello scopo
  // ===================================================================

  // Le parole chiave stanno nei dizionari, separate da virgole; si usano
  // **tutte le lingue insieme**, così chi scrive in inglese con l'app in
  // italiano viene capito lo stesso.
  function normalizza(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
  }
  function dizionari() {
    const d = radice.ASTRO_DIZIONARI || (radice.window && radice.window.ASTRO_DIZIONARI) || {};
    return Object.values(d).filter(x => x && x.messaggi);
  }
  const cacheParole = new Map();
  function parole(chiave) {
    if (cacheParole.has(chiave)) return cacheParole.get(chiave);
    const tutte = new Set();
    for (const d of dizionari()) {
      const v = d.messaggi['studio.parole.' + chiave];
      if (typeof v === 'string') v.split(',').map(x => normalizza(x).trim()).filter(Boolean).forEach(x => tutte.add(x));
    }
    const elenco = [...tutte].sort((a, b) => b.length - a.length);
    cacheParole.set(chiave, elenco);
    return elenco;
  }
  /* La prima parola dell'elenco che compare nel testo, con la sua
   * posizione. Una voce che finisce con `*` è una radice («esplo*» prende
   * esplode, esplosione, explosion); le altre sono parole intere — «va»
   * non deve trovarsi dentro a «vanitosa». */
  function trova(testo, chiave) {
    let meglio = null;
    for (const voce of parole(chiave)) {
      const radiceSola = voce.endsWith('*');
      const p = radiceSola ? voce.slice(0, -1) : voce;
      if (!p) continue;
      const re = new RegExp('(^|[^a-z])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (radiceSola ? '' : '(?![a-z])'));
      const m = re.exec(testo);
      const pos = m ? m.index + m[1].length : -1;
      // a pari posizione vince la più lunga: «oh no» prima di «oh»
      if (m && (!meglio || pos < meglio.pos || (pos === meglio.pos && p.length > meglio.parola.length))) meglio = { parola: p, pos };
    }
    return meglio;
  }

  // I luoghi dell'universo che si possono nominare a parole (quelli che sono
  // anche personaggi — la Via Lattea, Andromeda, Sirio — si trovano per nome)
  const STUDIO_POSTI_PAROLE = ['oort', 'kuiper', 'heliopause', 'galactic_center', 'orion_nebula', 'lmc', 'smc', 'triangulum',
    'virgo_cluster', 'great_attractor', 'laniakea', 'universe', 'local_group', 'local_bubble', 'orion_arm', 'local_cloud',
    'inner_planets', 'planets'];
  const STUDIO_UMORI = ['laughing', 'love', 'angry', 'bully', 'annoyed', 'happy', 'excited', 'surprised', 'worried', 'sad', 'thinking', 'sleepy',
    'wonder', 'tender', 'determined', 'skeptical', 'wistful', 'neutral'];
  /* La faccia giusta per una frase: le parole dell'umore prima, poi la
   * punteggiatura. Non è un'analisi del sentimento, ed è dichiarato: è un
   * suggerimento da accettare o cambiare. */
  function studioUmoreDalTesto(testo) {
    const s = normalizza(testo);
    if (!s.trim()) return null;
    let meglio = null;
    for (const u of STUDIO_UMORI) {
      const x = trova(s, 'umore.' + u);
      if (x && (!meglio || x.pos < meglio.pos || (x.pos === meglio.pos && x.parola.length > meglio.lun)))
        meglio = { umore: u, pos: x.pos, lun: x.parola.length };
    }
    if (meglio) return meglio.umore;
    const esclamativi = (s.match(/!/g) || []).length;
    if (/\?/.test(s)) return 'thinking';
    if (esclamativi >= 2) return 'excited';
    if (esclamativi === 1) return 'happy';
    return 'neutral';
  }

  /* Le idee per le azioni di un momento: dalle parole della battuta (un
   * «boom» chiede un'esplosione, «andiamo» un viaggio) e dalla faccia. Al
   * più sei, senza doppioni, e mai una che il momento ha già. */
  function studioIdeeAzioni(progetto, scena, momento) {
    const s = normalizza(momento.testo);
    const chi = momento.chi || studioPresenti(progetto, scena)[0] || '';
    const altri = studioPresenti(progetto, scena).filter(id => id !== chi);
    const idee = [];
    const metti = (tipo, campi) => idee.push(studioNuovaAzione(tipo, Object.assign({ chi }, campi)));
    const tre = scena.ambiente !== 'cielo';
    const effetti = { esplosione: 'explosion', festa: 'fireworks', amore: 'hearts', fulmine: 'lightning', luce: 'glow',
      cadente: 'shooting_star', fumo: 'smoke', urto: 'shockwave', scintille: 'sparkles', coriandoli: 'confetti', lampo: 'flash' };
    for (const [chiave, effetto] of Object.entries(effetti))
      if (trova(s, 'effetto.' + chiave)) metti('effetto', { effetto, dove: effetto === 'flash' ? 'center' : chi, quando: 'meta' });
    // Nell'universo, un luogo nominato è una meta: «andiamo fino alla nube di Oort»
    if (scena.ambiente === 'cosmo') {
      const posto = STUDIO_POSTI_PAROLE.find(k => trova(s, 'posto.' + k));
      if (posto) metti('muovi', { verso: posto, percorso: 'arc' });
    }
    if (tre && altri.length && trova(s, 'muovi')) metti('muovi', { verso: altri[0], percorso: 'arc' });
    if (tre && trova(s, 'torna')) metti('torna', {});
    if (trova(s, 'grande')) metti('scala', { scala: 1.8 });
    if (trova(s, 'piccolo')) metti('scala', { scala: 0.6 });
    if (trova(s, 'saluto')) metti('anima', { animazione: 'nod' });
    const umore = momento.umore || studioUmoreDalTesto(momento.testo) || '';
    const perUmore = {
      happy: [['anima', { animazione: 'jump' }], ['effetto', { effetto: 'sparkles' }]],
      excited: [['anima', { animazione: 'dance' }], ['effetto', { effetto: 'confetti' }]],
      surprised: [['anima', { animazione: 'wobble' }], ['effetto', { effetto: 'shockwave' }]],
      worried: [['anima', { animazione: 'shake' }]],
      sad: [['scala', { scala: 0.8 }]],
      thinking: [['anima', { animazione: 'nod' }]],
      sleepy: [['anima', { animazione: 'wobble' }]],
      laughing: [['anima', { animazione: 'bounce' }], ['effetto', { effetto: 'confetti' }]],
      love: [['effetto', { effetto: 'hearts' }], ['anima', { animazione: 'pulse' }]],
      angry: [['anima', { animazione: 'shake' }], ['effetto', { effetto: 'smoke' }]],
      annoyed: [['anima', { animazione: 'shake' }]],
      bully: [['scala', { scala: 1.3 }], ['anima', { animazione: 'pulse' }]],
      wonder: [['effetto', { effetto: 'glow' }]],
      tender: [['anima', { animazione: 'pulse' }]],
      determined: [['anima', { animazione: 'nod' }]],
      skeptical: [['anima', { animazione: 'wobble' }]],
      wistful: [['scala', { scala: 0.9 }]]
    }[umore] || [];
    for (const [tipo, campi] of perUmore) metti(tipo, Object.assign({ dove: tipo === 'effetto' ? chi : '' }, campi));
    if (altri.length) metti('guarda', { oggetto: altri[0] });
    const firma = a => [a.tipo, a.chi, a.animazione, a.effetto, a.verso, a.scala].join('|');
    const gia = new Set((momento.azioni || []).map(firma));
    const viste = new Set();
    return idee.filter(a => { const f = firma(a); if (gia.has(f) || viste.has(f)) return false; viste.add(f); return true; }).slice(0, 6);
  }

  // L'ambiente adatto a chi è in scena
  function studioAmbientePer(presenti) {
    const p = presenti || [];
    if (p.some(soloCosmo)) return { ambiente: 'cosmo' };
    if (p.length && p.every(id => id === 'Moon' || id === 'Earth' || id === 'Sun') && p.includes('Moon')) return { ambiente: 'terra_luna' };
    if (p.some(id => /^Star\d/.test(id))) return { ambiente: 'cielo', fuoco: p.find(id => STUDIO_FUOCHI_CIELO.includes(id)) || 'Moon' };
    const pianeti = p.filter(id => STUDIO_INQUADRABILI.includes(id));
    if (pianeti.length === 1 && STUDIO_FUOCHI_3D.includes(pianeti[0])) return { ambiente: 'pianeta', fuoco: pianeti[0] };
    return { ambiente: 'sistema' };
  }

  /* Il momento dopo: parla qualcuno che non ha appena parlato (a turno fra
   * chi è in scena), con una bozza adatta al punto della storia — il
   * principio presenta e domanda, il mezzo risponde, la fine ricorda lo
   * scopo. */
  function studioProssimoMomento(progetto, scena) {
    const presenti = studioPresenti(progetto, scena);
    const tutti = progetto.scene.flatMap(sc => sc.momenti);
    const ultimo = [...scena.momenti].reverse().find(m => m.chi) || [...tutti].reverse().find(m => m.chi);
    const parlati = new Set(tutti.filter(m => m.chi && m.testo).map(m => m.chi));
    let chi = presenti.find(id => !parlati.has(id) && (!ultimo || id !== ultimo.chi)) ||
      presenti.find(id => !ultimo || id !== ultimo.chi) || presenti[0] || '';
    const nome = chi && S().nome ? S().nome(chi) : chi;
    const altro = ultimo && ultimo.chi && ultimo.chi !== chi && S().nome ? S().nome(ultimo.chi) : '';
    const posto = tutti.length;
    const fase = posto <= 1 ? 'inizio' : (progetto.scene.indexOf(scena) === progetto.scene.length - 1 && posto >= 3 ? 'fine' : 'mezzo');
    // Nella scala cosmica, a metà storia, la bozza è un fatto vero della
    // tappa a cui la camera sta arrivando: è la carta a suggerire che cosa dire
    let fatto = '';
    if (scena.ambiente === 'cosmo' && fase === 'mezzo') {
      const n = scena.momenti.length + 1;
      const durate = scena.momenti.map(studioDurata).concat(6);
      const tappe = studioViaggioCosmo(scena, scena.momenti.concat(studioNuovoMomento()), durate);
      fatto = t('studio.fatto.' + studioTappaVicina(tappe[n - 1][1]));
    }
    const testo = fatto || (fase === 'fine' && unaRiga(progetto.obiettivo)
      ? t('studio.bozza.scopo', { obiettivo: unaRiga(progetto.obiettivo) })
      : t('studio.bozza.' + fase + (altro ? 'Altro' : ''), { nome, altro }));
    const umore = studioUmoreDalTesto(testo) || '';
    return studioNuovoMomento({ chi, testo, umore: fase === 'inizio' ? 'happy' : umore });
  }

  // I nomi con cui si può chiamare un personaggio, in tutte le lingue
  function nomiDi(id) {
    const nomi = new Set([normalizza(id)]);
    for (const d of dizionari()) {
      for (const k of ['corpo.' + id, 'studio.alias.' + id]) {
        const v = d.messaggi[k];
        if (typeof v === 'string') v.split(',').forEach(x => { const n = normalizza(x).trim(); if (n) nomi.add(n); });
      }
    }
    if (S().nome) nomi.add(normalizza(S().nome(id)));
    const p = S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id];
    if (p && p.alias) p.alias.forEach(a => nomi.add(normalizza(a)));
    return [...nomi].filter(n => n.length >= 2);
  }
  function personaggiNelTesto(s, candidati) {
    const trovati = [];
    for (const id of candidati) {
      for (const n of nomiDi(id)) {
        const re = new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])');
        const m = re.exec(s);
        if (m) { trovati.push({ id, pos: m.index + m[1].length, fine: m.index + m[1].length + n.length }); break; }
      }
    }
    return trovati.sort((a, b) => a.pos - b.pos);
  }

  /* I comandi a parole. Una riga (o una frase) alla volta:
   *   «Giove: Benvenuto!» / «Giove dice: Benvenuto!»   → un momento nuovo
   *   «Marte vola verso Giove facendo un giro»         → un viaggio (loop)
   *   «Marte torna a casa», «Saturno salta tre volte»,
   *   «Giove diventa grande», «la Luna è triste»,
   *   «esplosione su Saturno», «Luna guarda la Terra», «alla fine …»
   * Restituisce le operazioni capite e le frasi non capite: è
   * `studioApplica` a metterle nel progetto. Funzione pura. */
  function studioCapisci(testo, progetto) {
    const candidati = [...new Set(progetto.cast.concat(Object.keys((S().STOR_PERSONAGGI) || {})))];
    const ops = [], nonCapite = [];
    const righe = String(testo || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
    for (const riga of righe) {
      // Una battuta: il nome, poi «dice» o i due punti, poi le parole
      const nr = normalizza(riga);
      const chiDice = personaggiNelTesto(nr, candidati)[0];
      const dice = trova(nr, 'dice');
      const duePunti = riga.indexOf(':');
      if (chiDice && ((duePunti > 0 && normalizza(riga.slice(0, duePunti)).trim().length <= chiDice.fine + 12 &&
          chiDice.pos < duePunti) || (dice && dice.pos >= chiDice.fine && dice.pos - chiDice.fine < 6))) {
        let resto = duePunti > 0 && chiDice.pos < duePunti ? riga.slice(duePunti + 1) : riga.slice(dice.pos + dice.parola.length);
        resto = resto.replace(/^[\s:,]+/, '').replace(/^["«“']+|["»”']+$/g, '').trim();
        if (resto) { ops.push({ op: 'battuta', chi: chiDice.id, testo: resto.slice(0, 400), umore: studioUmoreDalTesto(resto) }); continue; }
      }
      const frasi = riga.split(/(?<=[.;!?])\s+|\s+(?:e poi|poi|then|and then)\s+/i).map(x => x.trim()).filter(Boolean);
      for (const frase of frasi) {
        const s = normalizza(frase);
        const chi = personaggiNelTesto(s, candidati);
        const soggetto = chi[0] ? chi[0].id : '';
        const oggetto = chi[1] ? chi[1].id : '';
        const quando = trova(s, 'quando.fine') ? 'fine' : trova(s, 'quando.meta') ? 'meta' : trova(s, 'quando.inizio') ? 'inizio' : null;
        const numero = (() => {
          const m = /(\d+)\s*(?:volt|times|giri|turns)/.exec(s);
          if (m) return Number(m[1]);
          for (const [n, k] of [[2, 'due'], [3, 'tre'], [4, 'quattro'], [5, 'cinque']]) if (trova(s, 'numero.' + k)) return n;
          return 0;
        })();
        let capita = false;
        const azione = (tipo, campi) => { ops.push({ op: 'azione', azione: studioNuovaAzione(tipo, Object.assign({ chi: soggetto }, campi, quando ? { quando } : {})) }); capita = true; };
        // Gli effetti per primi: «Marte esplode» è un botto, non un viaggio
        const effetti = { esplosione: 'explosion', urto: 'shockwave', lampo: 'flash', scintille: 'sparkles', festa: 'fireworks',
          fumo: 'smoke', amore: 'hearts', fulmine: 'lightning', cadente: 'shooting_star', luce: 'glow', coriandoli: 'confetti' };
        for (const [chiave, effetto] of Object.entries(effetti)) {
          if (trova(s, 'effetto.' + chiave)) {
            const sopra = oggetto || soggetto;
            azione('effetto', { effetto, dove: effetto === 'flash' ? 'center' : (sopra || 'center'), quando: quando || 'inizio' });
            break;
          }
        }
        if (soggetto) {
          const percorso = trova(s, 'percorso.loop') ? 'loop' : trova(s, 'percorso.hop') ? 'hop' : trova(s, 'percorso.spiral') ? 'spiral' :
            trova(s, 'percorso.zigzag') ? 'zigzag' : trova(s, 'percorso.teleport') ? 'teleport' : trova(s, 'percorso.straight') ? 'straight' : 'arc';
          const luogo = trova(s, 'luogo.center') ? 'center' : trova(s, 'luogo.left') ? 'left' : trova(s, 'luogo.right') ? 'right' :
            trova(s, 'luogo.top') ? 'top' : trova(s, 'luogo.bottom') ? 'bottom' : '';
          // I luoghi dell'universo: «Voyager va verso la nube di Oort»
          let posto = '', piuPresto = Infinity;
          for (const k of STUDIO_POSTI_PAROLE) { const x = trova(s, 'posto.' + k); if (x && x.pos < piuPresto) { piuPresto = x.pos; posto = k; } }
          // «Il Sole diventa una gigante rossa», «il Sole torna com'era»
          // (v414): la veste vince sul viaggio e sulla misura, che hanno
          // parole in comune («si gonfia», «torna»)
          const forma = STUDIO_FORME.find(f => trova(s, 'veste.' + f));
          if (forma) azione('diventa', { forma, quando: quando || 'tutto' });
          else if (trova(s, 'torna')) azione('torna', { percorso: percorso === 'arc' ? 'arc' : percorso, quando: quando || 'tutto' });
          else if (trova(s, 'muovi') && (oggetto || posto || luogo)) azione('muovi', { verso: oggetto || posto || luogo, percorso, quando: quando || 'tutto' });
          for (const a of ['jump', 'bounce', 'shake', 'nod', 'spin', 'pulse', 'dance', 'wobble'])
            if (trova(s, 'anima.' + a)) { azione('anima', { animazione: a, volte: numero }); break; }
          if (forma) { /* la misura la porta la veste */ }
          else if (trova(s, 'grande')) azione('scala', { scala: 1.8 });
          else if (trova(s, 'piccolo')) azione('scala', { scala: 0.55 });
          else if (trova(s, 'normale')) azione('scala', { scala: 1 });
          if (trova(s, 'guarda')) azione('guarda', { oggetto: oggetto || 'viewer' });
          if (trova(s, 'occhiolino')) azione('occhiolino', {});
          if (trova(s, 'nascondi')) azione('nascondi', {});
          for (const u of STUDIO_UMORI) if (trova(s, 'umore.' + u)) { azione('umore', { umore: u }); break; }
        }
        if (!capita) nonCapite.push(frase);
      }
    }
    return { ops, nonCapite };
  }
  // Mette nel progetto quello che `studioCapisci` ha capito: una battuta
  // apre un momento nuovo, le azioni vanno nell'ultimo momento.
  function studioApplica(progetto, indiceScena, ops) {
    const scena = progetto.scene[indiceScena] || progetto.scene[progetto.scene.length - 1];
    if (!scena) return [];
    const fatte = [];
    let momento = scena.momenti[scena.momenti.length - 1];
    for (const o of ops) {
      const chi = o.op === 'battuta' ? o.chi : o.azione.chi;
      if (chi && !progetto.cast.includes(chi)) progetto.cast.push(chi);
      if (chi && scena.presenti.length && !scena.presenti.includes(chi)) scena.presenti.push(chi);
      if (o.op === 'battuta') {
        if (momento && !momento.testo && !momento.chi) Object.assign(momento, { chi: o.chi, testo: o.testo, umore: o.umore || '' });
        else { momento = studioNuovoMomento({ chi: o.chi, testo: o.testo, umore: o.umore || '' }); scena.momenti.push(momento); }
      } else {
        if (!momento) { momento = studioNuovoMomento(); scena.momenti.push(momento); }
        if (o.azione.tipo === 'muovi' && o.azione.verso && !['center', 'left', 'right', 'top', 'bottom'].includes(o.azione.verso) &&
            !progetto.cast.includes(o.azione.verso)) progetto.cast.push(o.azione.verso);
        momento.azioni.push(o.azione);
      }
      fatte.push(o);
    }
    return fatte;
  }

  // La frase che descrive un'azione, per la lista di «Ho capito» e per le idee
  function studioDescriviAzione(a) {
    const nome = id => !id ? '' : ['center', 'left', 'right', 'top', 'bottom', 'viewer'].includes(id) ? t('studio.luogo.' + id)
      : luogoCosmo(id) && !(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id]) ? nomeLuogo(id) : (S().nome ? S().nome(id) : id);
    const dati = {
      chi: nome(a.chi), verso: nome(a.verso), oggetto: nome(a.oggetto), dove: nome(a.dove || a.chi),
      umore: t('storie.espressione.' + a.umore), animazione: t('storie.animazione.' + a.animazione), forma: t('storie.veste.' + a.forma),
      percorso: t('storie.percorso.' + a.percorso), effetto: t('storie.effetto.' + a.effetto),
      suono: a.fonte === 'file' ? (a.file && a.file.nome) || t('studio.suono.generato') : t('studio.suono.nome.' + a.suono) || a.suono,
      scala: (() => { try { return new Intl.NumberFormat(haI18n() && radice.astroI18n.locale ? radice.astroI18n.locale() : 'it-IT').format(a.scala); } catch (_) { return String(a.scala); } })()
    };
    return t('studio.descrivi.' + a.tipo, dati);
  }

  /* Il controllo dello scopo: le cose che fanno funzionare una storia per
   * bambini, una per riga, con ✓ o con il consiglio. `valida` è il
   * validatore delle demo (se c'è): il copione deve anche partire. */
  function studioConsigli(progetto, valida) {
    const c = [];
    const metti = (ok, chiave, dati) => c.push({ ok, chiave, testo: t('studio.consiglio.' + chiave + (ok ? '.ok' : ''), dati) });
    const momenti = progetto.scene.flatMap(sc => sc.momenti.map(m => ({ m, sc })));
    const battute = momenti.filter(x => x.m.chi && unaRiga(x.m.testo));
    metti(!!unaRiga(progetto.titolo), 'titolo');
    metti(!!unaRiga(progetto.obiettivo), 'obiettivo');
    const muti = progetto.cast.filter(id => !battute.some(x => x.m.chi === id));
    metti(!muti.length && progetto.cast.length > 0, 'tutti', { nomi: muti.map(id => S().nome ? S().nome(id) : id).join(', ') });
    const prime = battute.slice(0, 2).map(x => x.m.testo).join(' ');
    metti(/\?/.test(prime), 'domanda');
    const parole = s => normalizza(s).split(/[^a-z0-9]+/).filter(w => w.length >= 5);
    const chiave = new Set(parole(progetto.obiettivo));
    const ultima = battute.length ? battute[battute.length - 1].m.testo : '';
    metti(!chiave.size || parole(ultima).some(w => chiave.has(w) || [...chiave].some(k => k.slice(0, 5) === w.slice(0, 5))), 'chiusura');
    const lunghe = battute.filter(x => unaRiga(x.m.testo).split(' ').length > STUDIO_PAROLE_BAMBINI);
    metti(!lunghe.length, 'brevi', { n: lunghe.length, max: STUDIO_PAROLE_BAMBINI });
    const durata = studioDurataTotale(progetto);
    metti(durata >= STUDIO_DURATA_IDEALE[0] && durata <= STUDIO_DURATA_IDEALE[1], 'durata',
      { n: durata, min: STUDIO_DURATA_IDEALE[0], max: STUDIO_DURATA_IDEALE[1] });
    const impossibili = momenti.filter(x => x.sc.ambiente === 'cielo' && x.m.azioni.some(a => a.tipo === 'muovi' || a.tipo === 'torna'));
    metti(!impossibili.length, 'viaggi', { n: impossibili.length });
    const vuote = momenti.filter(x => !unaRiga(x.m.testo) && !x.m.azioni.length);
    metti(!vuote.length, 'vuoti', { n: vuote.length });
    /* Le due cose che fanno ricordare una storia (v412). L'emozione: qualcuno
     * cambia faccia — si parte preoccupati, sorpresi, curiosi e si arriva
     * contenti; una storia con una faccia sola è un elenco. La meraviglia:
     * almeno un numero vero o un confronto («più grande della Terra», «due
     * milioni e mezzo di anni luce»), che è quello che un bambino racconta a
     * cena. Sono controlli a parole, dichiarati: suggerimenti, non giudizi. */
    const facce = new Set();
    for (const { m } of momenti) {
      if (m.umore) facce.add(m.umore);
      for (const a of m.azioni || []) if (a.tipo === 'umore' && a.umore) facce.add(a.umore);
    }
    metti(facce.size >= 2, 'emozione');
    const meraviglia = battute.some(x => /\d/.test(x.m.testo) || trova(normalizza(x.m.testo), 'meraviglia'));
    metti(meraviglia, 'meraviglia');
    if (typeof valida === 'function') {
      let errore = '';
      try { valida(studioCopione(progetto)); } catch (e) { errore = e.message; }
      metti(!errore, 'copione', { errore });
    }
    return c;
  }

  // ===================================================================
  // 6. L'archivio dei progetti
  // ===================================================================

  function archivio() {
    try { return radice.localStorage || null; } catch (_) { return null; }
  }
  function studioCaricaTutti() {
    const a = archivio();
    if (!a) return [];
    try {
      const dati = JSON.parse(a.getItem(CHIAVE) || '[]');
      return Array.isArray(dati) ? dati.map(p => { try { return studioRipulisci(p); } catch (_) { return null; } }).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function studioSalvaTutti(progetti) {
    const a = archivio();
    if (!a) return false;
    try { a.setItem(CHIAVE, JSON.stringify(progetti)); return true; } catch (_) { return false; }
  }

  /* Il file delle voci (v421). Le battute delle storie scritte qui non stanno
   * nei dizionari: sono testo di chi scrive, e vivono solo in questo browser.
   * Chi voleva dar loro una voce registrata non trovava le battute nel
   * copione delle voci (`audio/narrazione/storie/COPIONE.md`), e cancellare
   * una scena lasciava lì la regia e l'audio di prima. Adesso ogni «Salva
   * nelle mie demo» e ogni «Elimina» rifanno la fotografia delle storie
   * salvate (`astrocal_storie_voci_v1`), e da lì `storie-studio.json`, che va
   * in `audio/narrazione/storie/`: `scripts/voci-storie.js` (anche dal
   * workflow, quando il file arriva su GitHub) aggiunge al copione, alla
   * regia e al manifest le battute nuove e toglie quelle che non ci sono più,
   * con i loro audio.
   *
   * Ogni battuta ha un numero che non cambia (`voce` del momento), dato la
   * prima volta che si salva: togliere una scena non rinumera le altre, e i
   * loro audio restano giusti. Il file dice **tutte** le storie salvate in
   * questo browser: quello che non c'è più si cancella. */
  const CHIAVE_VOCI = 'astrocal_storie_voci_v1';
  const FILE_VOCI = 'storie-studio.json';
  function studioChiaveVoci(titolo, prese) {
    const radiceNome = 'studio_' + (unaRiga(titolo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30).replace(/_+$/, '') || 'storia');
    let chiave = radiceNome, n = 2;
    while (prese.has(chiave)) chiave = radiceNome + '_' + n++;
    return chiave;
  }
  /* Le battute di un progetto come le dice il copione (`studioCopione`):
   * una per momento, solo se chi parla è in scena e ha qualcosa da dire, con
   * la scena del DSL in cui cade (un momento è una scena) e la sua durata.
   * Dà il numero ai momenti che non l'hanno e il nome alla storia, quindi
   * cambia il progetto: va salvato dopo. `prese` sono i nomi delle altre
   * storie, perché due storie con lo stesso titolo non si mescolino. */
  function studioVociStoria(progetto, lingua, prese = new Set()) {
    if (!progetto.voceChiave || prese.has(progetto.voceChiave)) progetto.voceChiave = studioChiaveVoci(progetto.titolo, prese);
    const usati = new Set();
    for (const sc of progetto.scene) for (const m of sc.momenti) {
      if (m.voce > 0 && !usati.has(m.voce)) usati.add(m.voce);
      else m.voce = 0;
    }
    let prossima = Math.max(progetto.voceProssima || 1, ...[...usati].map(n => n + 1));
    const battute = [];
    let scena = 0;
    for (const sc of progetto.scene) {
      const presenti = studioPresenti(progetto, sc);
      const momenti = sc.momenti.length ? sc.momenti : [studioNuovoMomento()];
      for (const m of momenti) {
        scena++;
        const testo = unaRiga(m.testo).slice(0, 400);
        if (!m.chi || !presenti.includes(m.chi) || !testo) continue;
        // v461: la battuta di una storia pronta rimasta quella ha già la sua voce
        if (m.parla && m.parla.chi === m.chi && unaRiga(m.parla.testo) === testo) continue;
        if (!m.voce) m.voce = prossima++;
        battute.push({ n: m.voce, chi: m.chi, testo, umore: m.umore || '', scena, durata: Math.round(studioDurata(m) * 1000) });
      }
    }
    progetto.voceProssima = prossima;
    return {
      chiave: progetto.voceChiave, progetto: progetto.id, titolo: unaRiga(progetto.titolo).slice(0, 120),
      lingua: lingua === 'en' ? 'en' : 'it', battute
    };
  }
  function studioVociCarica() {
    const a = archivio();
    try {
      const dati = JSON.parse((a && a.getItem(CHIAVE_VOCI)) || '{}');
      return dati && typeof dati === 'object' && !Array.isArray(dati) ? dati : {};
    } catch (_) { return {}; }
  }
  function studioVociSalva(fotografie) {
    const a = archivio();
    try { if (a) a.setItem(CHIAVE_VOCI, JSON.stringify(fotografie)); } catch (_) { /* resta quella di prima */ }
  }
  // Il contenuto di `storie-studio.json`, nell'ordine dei nomi (un file che
  // non cambia se le storie non cambiano: niente commit inutili)
  function studioFileVoci(fotografie) {
    const storie = Object.values(fotografie).filter(f => f && STUDIO_VOCE_CHIAVE.test(f.chiave) && Array.isArray(f.battute))
      .sort((a, b) => a.chiave < b.chiave ? -1 : a.chiave > b.chiave ? 1 : 0)
      .map(f => ({ chiave: f.chiave, titolo: f.titolo, lingua: f.lingua, battute: f.battute }));
    return JSON.stringify({
      _leggimi: 'Le battute delle storie fatte nello Studio delle storie, scritto dallo Studio (Impostazioni → Questa storia → File delle voci). ' +
        'Va in audio/narrazione/storie/: scripts/voci-storie.js le mette nel copione, nella regia e nel manifest, e toglie quelle che non ci sono più, audio compresi. Non modificarlo a mano.',
      v: 1, storie
    }, null, 2) + '\n';
  }
  const linguaStudio = () => {
    const l = haI18n() && typeof radice.astroI18n.lingua === 'function' ? radice.astroI18n.lingua() : 'it';
    return String(l || 'it').toLowerCase().startsWith('en') ? 'en' : 'it';
  };

  /* Dove scriverlo. Sui browser che lo sanno fare (Chrome, Edge) si sceglie
   * una volta la cartella del progetto, e da lì ogni salvataggio riscrive il
   * file da solo: la cartella si ricorda in IndexedDB (una maniglia di
   * cartella non entra in `localStorage`). Altrove, e quando la cartella non
   * è collegata, il bottone scarica il file. */
  const DB_VOCI = 'astrocal-studio-voci';
  // Due scaffali: la maniglia della cartella e (v422) gli audio caricati a
  // mano per le battute, `<progetto>|<numero della battuta>` → { blob, … }
  function dbVoci(fai2, scaffale = 'maniglie') {
    return new Promise((si, no) => {
      if (typeof indexedDB === 'undefined') { no(new Error('indexedDB')); return; }
      let r;
      try { r = indexedDB.open(DB_VOCI, 2); } catch (e) { no(e); return; }
      r.onupgradeneeded = () => {
        for (const n of ['maniglie', 'audio']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n);
      };
      r.onerror = () => no(r.error || new Error('indexedDB'));
      r.onsuccess = () => {
        const db = r.result;
        let tx, q;
        // Una maniglia che non si può copiare (`put`) lancia qui dentro, fuori
        // dalla promessa: senza questo, chi aspetta aspetterebbe per sempre
        try { tx = db.transaction(scaffale, 'readwrite'); q = fai2(tx.objectStore(scaffale)); }
        catch (e) { db.close(); no(e); return; }
        tx.oncomplete = () => { db.close(); si(q && q.result); };
        tx.onerror = () => { db.close(); no(tx.error || new Error('indexedDB')); };
      };
    });
  }
  const cartellaSalvata = () => dbVoci(s => s.get('cartella')).catch(() => null);
  // Chi sceglie la radice del progetto (o `audio/`, o `narrazione/`) arriva
  // lo stesso a `audio/narrazione/storie/`
  async function cartellaDelleVoci(scelta) {
    const scendi = async (dir, nomi) => {
      let d = dir;
      for (const n of nomi) d = await d.getDirectoryHandle(n);
      return d;
    };
    for (const strada of [['audio', 'narrazione', 'storie'], ['narrazione', 'storie'], ['storie']]) {
      try { return await scendi(scelta, strada); } catch (_) { /* la prossima */ }
    }
    return scelta;
  }
  function scaricaVoci(testo) {
    const blob = new Blob([testo], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: FILE_VOCI });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  /* Scrive il file. `chiedi`: dal bottone, si può aprire la scelta della
   * cartella (o scaricare); dopo un salvataggio, solo se la cartella è già
   * collegata. Restituisce come è andata: 'scritto', 'scaricato', 'nessuna'. */
  async function studioScriviVoci(chiedi) {
    const testo = studioFileVoci(studioVociCarica());
    const sa = typeof radice.showDirectoryPicker === 'function';
    let cartella = sa ? await cartellaSalvata() : null;
    if (cartella) {
      let permesso = 'denied';
      try {
        permesso = await cartella.queryPermission({ mode: 'readwrite' });
        if (permesso !== 'granted') permesso = await cartella.requestPermission({ mode: 'readwrite' });
      } catch (_) { permesso = 'denied'; }
      if (permesso !== 'granted') cartella = null;
    }
    if (!cartella && chiedi && sa) {
      try {
        const scelta = await radice.showDirectoryPicker({ id: 'astrocal-voci', mode: 'readwrite' });
        cartella = await cartellaDelleVoci(scelta);
        await dbVoci(s => s.put(cartella, 'cartella')).catch(() => null);
      } catch (e) {
        if (e && e.name === 'AbortError') return 'annullato';
        cartella = null;
      }
    }
    if (cartella) {
      const scriviFile = async (dir, nome, dati) => {
        const f = await dir.getFileHandle(nome, { create: true });
        const w = await f.createWritable();
        await w.write(dati);
        await w.close();
      };
      await scriviFile(cartella, FILE_VOCI, testo);
      // Le voci caricate nello Studio, ognuna nella cartella del suo
      // personaggio e col nome del copione: dopo il commit suonano per tutti
      for (const v of await vociDaScrivere()) {
        try {
          let dir = cartella;
          for (const n of [v.cartella, v.lingua]) dir = await dir.getDirectoryHandle(n, { create: true });
          await scriviFile(dir, v.nome, v.blob);
        } catch (_) { /* una voce che non si scrive non ferma le altre */ }
      }
      return 'scritto';
    }
    if (chiedi) { scaricaVoci(testo); return 'scaricato'; }
    return 'nessuna';
  }
  // Le fotografie da rifare dopo un salvataggio o una cancellazione, e il file
  function aggiornaVoci({ salvata, tolta, chiedi }) {
    const foto = studioVociCarica();
    for (const [k, f] of Object.entries(foto)) {
      const id = f && f.progetto;
      if (!f || (tolta && id === tolta) || (salvata && id === salvata.id)) delete foto[k];
    }
    if (salvata) {
      const prese = new Set(Object.keys(foto));
      for (const altro of studio.progetti) if (altro.id !== salvata.id && altro.voceChiave) prese.add(altro.voceChiave);
      salvata.lingua = linguaStudio();
      const f = studioVociStoria(salvata, salvata.lingua, prese);
      foto[f.chiave] = f;
    }
    studioVociSalva(foto);
    const storie = Object.keys(foto).length;
    const battute = Object.values(foto).reduce((n, f) => n + f.battute.length, 0);
    return studioScriviVoci(chiedi).then(come => {
      if (come === 'scritto') return t('studio.voci.scritto', { storie, battute });
      if (come === 'scaricato') return t('studio.voci.scaricato', { storie, battute });
      return '';
    }).catch(e => t('studio.voci.errore', { errore: e && e.message || String(e) }));
  }

  /* Le voci caricate a mano (v422). Per ogni battuta si può caricare il suo
   * file audio: resta in questo browser (IndexedDB, scaffale `audio`), suona
   * al posto della sintesi (`narrazione.voceLocale`, riconosciuta dal
   * testo: vale anche per la storia salvata nelle demo) e la durata del
   * momento la segue (`studioDurata`). Con la cartella del progetto
   * collegata, «File delle voci» la scrive anche nel progetto, nella
   * cartella del personaggio e col nome del copione. */
  const STUDIO_AUDIO_MAX = 10 * 1024 * 1024;
  const STUDIO_ESTENSIONI = /\.(mp3|wav|ogg|oga|opus|m4a|aac|webm)$/i;
  const vociCaricate = new Map();         // `<progetto>|<n>` → { url, testo }
  const chiaveAudio = (pid, n) => pid + '|' + n;
  function registraVoce(k, testo, url) {
    const prima = vociCaricate.get(k);
    const narr = radice.narrazione;
    if (prima) {
      if (narr && narr.voceLocale) narr.voceLocale(prima.testo, '');
      if (prima.url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(prima.url);
      vociCaricate.delete(k);
    }
    if (url) {
      vociCaricate.set(k, { url, testo });
      if (narr && narr.voceLocale) narr.voceLocale(testo, url);
    }
  }
  // Tutti i record dello scaffale, con la loro chiave
  function tutteLeVoci() {
    const trovate = [];
    return dbVoci(st => {
      const c = st.openCursor();
      c.onsuccess = () => { const x = c.result; if (x) { trovate.push({ chiave: x.key, rec: x.value }); x.continue(); } };
      return null;
    }, 'audio').then(() => trovate, () => []);
  }
  // La durata vera del file: dall'elemento audio, o decodificandolo (un
  // webm registrato dal telefono dice «Infinity» all'elemento)
  function misuraDurata(blob) {
    return new Promise(si => {
      let finito = false;
      const fine = v => { if (!finito) { finito = true; si(v > 0 && Number.isFinite(v) ? Math.round(v * 1000) : 0); } };
      const decodifica = () => {
        const C = radice.AudioContext || radice.webkitAudioContext;
        if (!C || !blob.arrayBuffer) { fine(0); return; }
        const ctx = new C();
        blob.arrayBuffer().then(b => ctx.decodeAudioData(b)).then(a => fine(a.duration), () => fine(0))
          .finally(() => { try { ctx.close(); } catch (_) { /* niente */ } });
      };
      if (typeof Audio === 'undefined') { decodifica(); return; }
      const a = new Audio();
      const url = URL.createObjectURL(blob);
      a.preload = 'metadata';
      a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(url); if (Number.isFinite(d) && d > 0) fine(d); else decodifica(); };
      a.onerror = () => { URL.revokeObjectURL(url); decodifica(); };
      setTimeout(() => { if (!finito) decodifica(); }, 6000);
      a.src = url;
    });
  }
  // `sincronizza`: falso quando chi chiama manda tutto insieme alla fine
  // (le battute generate a raffica con ElevenLabs, §6c). Vero se la voce è entrata.
  async function caricaVoce(dove, file, { sincronizza = true, voce = '', tag } = {}) {
    const p = studio.progetto, m = leggi(dove);
    if (!m || !file) return false;
    if (file.size > STUDIO_AUDIO_MAX) { esito(t('studio.voce.troppoGrande')); return false; }
    if (!/^audio\//.test(file.type || '') && !STUDIO_ESTENSIONI.test(file.name || '')) { esito(t('studio.voce.nonAudio')); return false; }
    const testo = testoDetto(m);
    if (!m.chi || !testo) { esito(t('studio.voce.primaIlTesto')); return false; }
    const durata = await misuraDurata(file);
    if (!durata) { esito(t('studio.voce.nonAudio')); return false; }
    if (!m.voce) {
      const usati = p.scene.flatMap(sc => sc.momenti.map(x => x.voce || 0));
      m.voce = Math.max(p.voceProssima || 1, ...usati.map(n => n + 1));
      p.voceProssima = m.voce + 1;
    }
    const k = chiaveAudio(p.id, m.voce);
    try { await dbVoci(st => st.put({ blob: file, nome: file.name || '', tipo: file.type || '', durata, testo }, k), 'audio'); }
    catch (e) { esito(t('studio.voci.errore', { errore: e && e.message || String(e) })); return false; }
    registraVoce(k, testo, URL.createObjectURL(file));
    m.audio = { durata, impronta: studioImpronta(testo), nome: String(file.name || '').slice(0, 80) };
    if (STUDIO_VOCE_ID.test(voce || '')) m.audio.voce = voce;
    if (typeof tag === 'string') m.audio.tag = tag.slice(0, 160);
    salvaPresto();
    disegna();
    const caricata = t('studio.voce.caricata', { secondi: secondiDi(durata), durata: studioDurata(m) });
    esito(caricata);
    if (!sincronizza) return true;
    // v424: l'audio va subito anche sul repository (§6b), nella cartella del
    // personaggio, perché suoni dagli altri dispositivi; una storia mai
    // salvata ce lo manda al primo «Salva nelle mie demo»
    if (!condivisa(p)) { esito(caricata + ' ' + t('studio.repo.audioDopo')); return true; }
    if (!studioRepoImpostazioni().token) { esito(caricata + ' ' + t('studio.repo.senzaToken')); return true; }
    esito(caricata + ' ' + t('studio.repo.inCorso'));
    const msg = await aggiornaVoci({ salvata: p, chiedi: false });
    salvaPresto();
    esito(caricata + ' ' + (msg ? msg + ' ' : '') + await studioSincronizza({ spingi: true, titolo: p.titolo }));
    return true;
  }
  /* La voce registrata col microfono (v441). Chi scrive una storia spesso
   * non ha un file pronto: vuole dire la battuta lì, al telefono o al
   * computer. «Registra» apre il microfono (MediaRecorder), lo stesso tasto
   * diventa «Ferma» col tempo che passa, e la registrazione finita fa la
   * stessa strada di un file caricato (`caricaVoce`): misurata, tenuta in
   * IndexedDB, mandata sul repository. Una registrazione sola alla volta;
   * dopo `STUDIO_REGISTRA_MAX` secondi si ferma da sola (un momento non
   * dura più di 120 s, e il file resta sotto i 10 MB). Il nome dà
   * l'estensione: Chrome e Firefox registrano in webm, Safari in mp4. */
  const STUDIO_REGISTRA_MAX = 90;
  let registrazione = null;               // { dove, rec, flusso, inizio, timer }
  const puoRegistrare = () => !!(radice.MediaRecorder && radice.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  function tastoRegistra(dove) {
    return studio.radice && [...studio.radice.querySelectorAll('[data-fai="registraVoce"]')].find(b => b.dataset.dove === dove);
  }
  function aggiornaTastoRegistra() {
    if (!registrazione) return;
    const b = tastoRegistra(registrazione.dove);
    if (b) b.textContent = t('studio.voce.ferma', { secondi: Math.floor((Date.now() - registrazione.inizio) / 1000) });
  }
  async function registraDalMicrofono(dove) {
    if (registrazione) { const era = registrazione.dove; fermaRegistrazione(); if (era === dove) return; }
    const m = leggi(dove);
    if (!m) return;
    if (!m.chi || !testoDetto(m)) { esito(t('studio.voce.primaIlTesto')); return; }
    if (!puoRegistrare()) { esito(t('studio.voce.senzaMicrofono')); return; }
    let flusso;
    try { flusso = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { esito(t('studio.voce.microfonoNegato', { errore: e && (e.name || e.message) || String(e) })); return; }
    const tipi = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    const tipo = radice.MediaRecorder.isTypeSupported ? tipi.find(x => radice.MediaRecorder.isTypeSupported(x)) : '';
    let rec;
    try { rec = tipo ? new radice.MediaRecorder(flusso, { mimeType: tipo }) : new radice.MediaRecorder(flusso); }
    catch (e) { flusso.getTracks().forEach(x => x.stop()); esito(t('studio.voce.microfonoNegato', { errore: e && e.message || String(e) })); return; }
    const pezzi = [], suo = studio.progetto;
    rec.ondataavailable = e => { if (e.data && e.data.size) pezzi.push(e.data); };
    rec.onstop = () => {
      flusso.getTracks().forEach(x => x.stop());
      const tipoVero = (rec.mimeType || tipo || 'audio/webm').split(';')[0];
      const est = /mp4|m4a|aac/.test(tipoVero) ? 'm4a' : /ogg/.test(tipoVero) ? 'ogg' : 'webm';
      const blob = new Blob(pezzi, { type: tipoVero });
      // aperta un'altra storia nel frattempo: `dove` ora indicherebbe un'altra battuta
      if (studio.progetto !== suo) return;
      if (!blob.size) { esito(t('studio.voce.registrazioneVuota')); return; }
      const file = typeof File === 'function' ? new File([blob], 'registrazione.' + est, { type: tipoVero }) : Object.assign(blob, { name: 'registrazione.' + est });
      caricaVoce(dove, file);
    };
    registrazione = { dove, rec, flusso, inizio: Date.now(), timer: setInterval(() => {
      if (registrazione && Date.now() - registrazione.inizio >= STUDIO_REGISTRA_MAX * 1000) fermaRegistrazione();
      else aggiornaTastoRegistra();
    }, 250) };
    rec.start();
    disegna();
    esito(t('studio.voce.inRegistrazione', { massimo: STUDIO_REGISTRA_MAX }));
  }
  function fermaRegistrazione() {
    const r = registrazione;
    if (!r) return;
    registrazione = null;
    clearInterval(r.timer);
    try { if (r.rec.state !== 'inactive') r.rec.stop(); else r.flusso.getTracks().forEach(x => x.stop()); }
    catch (_) { r.flusso.getTracks().forEach(x => x.stop()); }
    disegna();
  }
  function togliVoce(m) {
    if (!m || !m.voce) { if (m) m.audio = null; return; }
    const k = chiaveAudio(studio.progetto.id, m.voce);
    registraVoce(k, '', '');
    dbVoci(st => st.delete(k), 'audio').catch(() => null);
    m.audio = null;
  }
  let anteprima = null;
  function ascoltaVoce(m) {
    const v = m && m.voce && vociCaricate.get(chiaveAudio(studio.progetto.id, m.voce));
    if (anteprima) { try { anteprima.pause(); } catch (_) { /* niente */ } }
    if (!v || typeof Audio === 'undefined') return;
    anteprima = new Audio(v.url);
    anteprima.play().catch(() => null);
  }
  const secondiDi = ms => (Math.round(ms / 100) / 10).toLocaleString(linguaStudio() === 'en' ? 'en' : 'it');
  /* All'avvio: le voci di tutte le storie tornano a suonare; quelle di
   * momenti o storie che non ci sono più si buttano (lo spazio del browser
   * non è infinito). */
  async function studioRiprendiVoci() {
    const vive = new Map();
    for (const p of studio.progetti) for (const sc of p.scene) for (const m of sc.momenti) if (m.voce && m.audio) vive.set(chiaveAudio(p.id, m.voce), m);
    // v440: e le musiche, se la storia dice ancora di avere quel file
    const musiche = new Map([...studioMusicheVolute(studio.progetti)].map(([percorso, v]) => [v.chiave, Object.assign({ percorso }, v)]));
    for (const { chiave, rec } of await tutteLeVoci()) {
      if (eMusica(chiave)) {
        const v = musiche.get(chiave);
        if (!v || !rec || !rec.blob || rec.sha !== v.sha) { dbVoci(st => st.delete(chiave), 'audio').catch(() => null); continue; }
        registraMusica(chiave, v.percorso, URL.createObjectURL(rec.blob));
        continue;
      }
      if (!vive.has(chiave) || !rec || !rec.blob) { dbVoci(st => st.delete(chiave), 'audio').catch(() => null); continue; }
      registraVoce(chiave, rec.testo, URL.createObjectURL(rec.blob));
    }
  }
  // Una storia duplicata si porta dietro le sue voci
  async function copiaVoci(da, a) {
    for (const { chiave, rec } of await tutteLeVoci()) {
      if (!String(chiave).startsWith(da + '|')) continue;
      const k = a + chiave.slice(da.length);
      await dbVoci(st => st.put(rec, k), 'audio').catch(() => null);
      if (eMusica(chiave)) { if (rec.est) registraMusica(k, studioPercorsoMusica(a, rec.sid || '', { est: rec.est }), URL.createObjectURL(rec.blob)); }
      else registraVoce(k, rec.testo, URL.createObjectURL(rec.blob));
    }
  }
  function cancellaVoci(pid) {
    tutteLeVoci().then(tutte => {
      for (const { chiave } of tutte) if (String(chiave).startsWith(pid + '|')) {
        if (eMusica(chiave)) registraMusica(chiave, '', ''); else registraVoce(chiave, '', '');
        dbVoci(st => st.delete(chiave), 'audio').catch(() => null);
      }
    });
  }
  // Il nome italiano di un personaggio, da cui la sua cartella delle voci:
  // la stessa strada di `nomeDi` in scripts/voci-storie.js
  function cartellaPersonaggio(id) {
    const diz = (radice.ASTRO_DIZIONARI && radice.ASTRO_DIZIONARI.it && radice.ASTRO_DIZIONARI.it.messaggi) || {};
    const pg = (S().STOR_PERSONAGGI || {})[id] || {};
    const nomeIt = (pg.nome && diz[pg.nome]) || diz['corpo.' + id] || diz['storie.nome.' + id] || nome(id);
    return String(nomeIt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'senza-nome';
  }
  // Le voci da mettere nel progetto: solo delle storie del file, e solo
  // se il testo della battuta è ancora quello per cui sono state caricate
  async function vociDaScrivere() {
    const foto = studioVociCarica();
    const tutte = new Map((await tutteLeVoci()).map(x => [x.chiave, x.rec]));
    const fuori = [];
    for (const f of Object.values(foto)) for (const b of f.battute || []) {
      const rec = tutte.get(chiaveAudio(f.progetto, b.n));
      if (!rec || !rec.blob || unaRiga(rec.testo) !== unaRiga(b.testo)) continue;
      const est = (STUDIO_ESTENSIONI.exec(rec.nome || '') || [, /wav/.test(rec.tipo) ? 'wav' : /ogg/.test(rec.tipo) ? 'ogg' : /mp4|m4a|aac/.test(rec.tipo) ? 'm4a' : /webm/.test(rec.tipo) ? 'webm' : 'mp3'])[1].toLowerCase();
      fuori.push({ cartella: cartellaPersonaggio(b.chi), lingua: f.lingua, nome: `${f.chiave}-${b.n}.${est}`, blob: rec.blob });
    }
    return fuori;
  }

  /* La musica di sottofondo caricata a mano (v440, §4-ter). Come le voci:
   * il file resta in questo browser (IndexedDB, scaffale `audio`, chiave
   * `<progetto>|musica|<scena o «storia»>`), suona subito su questo
   * dispositivo col percorso che avrà sul sito (`StorieCosmiche.musicaLocale`)
   * e parte verso il repository con la storia salvata (§6b), dove dopo il
   * deploy suona dappertutto. */
  const STUDIO_MUSICA_MAX = 20 * 1024 * 1024;
  const musicheCaricate = new Map();      // chiave → { url, percorso }
  const chiaveMusica = (pid, sid) => pid + '|musica|' + (sid || 'storia');
  const eMusica = k => String(k).includes('|musica|');
  function registraMusica(k, percorso, url) {
    const prima = musicheCaricate.get(k);
    const stor = S();
    if (prima) {
      if (stor.musicaLocale) stor.musicaLocale(prima.percorso, '');
      if (prima.url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(prima.url);
      musicheCaricate.delete(k);
    }
    if (url) {
      musicheCaricate.set(k, { url, percorso });
      if (stor.musicaLocale) stor.musicaLocale(percorso, url);
    }
  }
  // Dove sta la musica di cui parla un campo dello Studio: `storia` (tutta
  // la storia) o `scene.<i>`
  function musicaDi(dove) {
    const p = studio.progetto;
    if (dove === 'storia') return { tiene: p, sid: '', mu: p.musica };
    const sc = leggi(dove);
    return sc ? { tiene: sc, sid: sc.id, mu: sc.musica } : null;
  }
  // Uno SHA per dire se il file è cambiato: quello del blob git, se il
  // browser sa calcolarlo (serve una pagina sicura), se no un'impronta
  async function improntaFile(file) {
    const byte = new Uint8Array(await file.arrayBuffer());
    try { if (radice.crypto && radice.crypto.subtle) return await shaBlob(byte); } catch (_) { /* sotto, l'impronta */ }
    let x = 0x811c9dc5;
    for (let i = 0; i < byte.length; i += Math.max(1, Math.floor(byte.length / 65536))) { x ^= byte[i]; x = Math.imul(x, 0x01000193) >>> 0; }
    return (x.toString(16).padStart(8, '0') + byte.length.toString(16)).slice(0, 40);
  }
  async function caricaMusica(dove, file) {
    const p = studio.progetto, di = musicaDi(dove);
    if (!di || !file) return;
    if (file.size > STUDIO_MUSICA_MAX) { esito(t('studio.musica.troppoGrande')); return; }
    if (!/^audio\//.test(file.type || '') && !STUDIO_ESTENSIONI.test(file.name || '')) { esito(t('studio.voce.nonAudio')); return; }
    const durata = await misuraDurata(file);
    if (!durata) { esito(t('studio.voce.nonAudio')); return; }
    const est = (STUDIO_ESTENSIONI.exec(file.name || '') || [, /wav/.test(file.type) ? 'wav' : /ogg/.test(file.type) ? 'ogg' : /mp4|m4a|aac/.test(file.type) ? 'm4a' : /webm/.test(file.type) ? 'webm' : 'mp3'])[1].toLowerCase();
    let sha;
    try { sha = await improntaFile(file); } catch (e) { esito(t('studio.voci.errore', { errore: e && e.message || String(e) })); return; }
    const k = chiaveMusica(p.id, di.sid);
    try { await dbVoci(st => st.put({ blob: file, nome: file.name || '', tipo: file.type || '', durata, musica: true, est, sha, sid: di.sid }, k), 'audio'); }
    catch (e) { esito(t('studio.voci.errore', { errore: e && e.message || String(e) })); return; }
    const mu = { tipo: 'file', nome: String(file.name || '').slice(0, 80), est, sha, durata, volume: di.mu ? di.mu.volume : STUDIO_MUSICA_VOLUME };
    di.tiene.musica = mu;
    if (di.sid) di.tiene.musicaModo = 'propria';
    registraMusica(k, studioPercorsoMusica(p.id, di.sid, mu), URL.createObjectURL(file));
    salvaPresto();
    disegna();
    const caricata = t('studio.musica.caricata', { nome: mu.nome || est, secondi: secondiDi(durata) });
    esito(caricata);
    // Sul repository subito, come una voce, se la storia è già salvata
    if (!condivisa(p)) { esito(caricata + ' ' + t('studio.repo.audioDopo')); return; }
    if (!studioRepoImpostazioni().token) { esito(caricata + ' ' + t('studio.repo.senzaToken')); return; }
    esito(caricata + ' ' + t('studio.repo.inCorso'));
    salvaPresto();
    esito(caricata + ' ' + await studioSincronizza({ spingi: true, titolo: p.titolo }));
  }
  function togliMusica(dove) {
    const p = studio.progetto, di = musicaDi(dove);
    if (!di) return;
    const k = chiaveMusica(p.id, di.sid);
    registraMusica(k, '', '');
    dbVoci(st => st.delete(k), 'audio').catch(() => null);
    di.tiene.musica = null;
    if (di.sid) di.tiene.musicaModo = 'storia';
  }
  // Ascoltare la traccia scelta nello Studio, senza guardare la storia
  let ascoltoMusica = null;
  function fermaAscoltoMusica() {
    if (ascoltoMusica) { try { ascoltoMusica.audio.pause(); } catch (_) { /* niente */ } }
    ascoltoMusica = null;
  }
  function ascoltaMusica(dove) {
    const era = ascoltoMusica && ascoltoMusica.dove;
    fermaAscoltoMusica();
    if (era === dove || typeof Audio === 'undefined') return;
    const di = musicaDi(dove);
    if (!di || !di.mu) return;
    const p = studio.progetto;
    const locale = di.mu.tipo === 'file' && musicheCaricate.get(chiaveMusica(p.id, di.sid));
    const m = studioMusicaSrc(p, di.sid ? Object.assign({}, di.tiene, { musicaModo: 'propria' }) : null);
    const url = locale ? locale.url : m.src !== 'off' ? m.src : '';
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = di.mu.volume;
    ascoltoMusica = { dove, audio };
    audio.addEventListener('ended', () => { if (ascoltoMusica && ascoltoMusica.audio === audio) { ascoltoMusica = null; disegna(); } });
    audio.play().catch(() => { ascoltoMusica = null; esito(t('studio.musica.nonSuona')); disegna(); });
  }
  // Le musiche che le storie dicono di avere, con dove vanno sul sito:
  // `percorso` → { chiave, sha }
  function studioMusicheVolute(progetti) {
    const fuori = new Map();
    for (const p of progetti) {
      const metti = (mu, sid) => { if (mu && mu.tipo === 'file') fuori.set(studioPercorsoMusica(p.id, sid, mu), { chiave: chiaveMusica(p.id, sid), sha: mu.sha, pid: p.id }); };
      metti(p.musica, '');
      for (const sc of p.scene) if (sc.musicaModo === 'propria') metti(sc.musica, sc.id);
      // v444: i suoni da file delle azioni, nella stessa cartella
      for (const sc of p.scene) for (const m of sc.momenti) for (const a of m.azioni || [])
        if (a.tipo === 'suono' && a.fonte === 'file' && a.file) metti(Object.assign({ tipo: 'file' }, a.file), 'suono-' + a.id);
    }
    return fuori;
  }

  // ===================================================================
  // 6b. Le storie sul repository (v424)
  // ===================================================================

  /* Una storia scritta sul computer non si vedeva dal telefono: progetti,
   * demo e voci vivevano solo nel browser che li aveva fatti. Adesso le
   * storie **salvate** («Salva nelle mie demo») stanno anche nel repository
   * GitHub del sito, in `storie-studio/storie.json`, e ogni dispositivo che
   * apre l'app le legge da lì e le mette fra le sue (progetto e demo).
   *
   * Leggere non chiede niente: il repository è pubblico, e l'API dei
   * contenuti risponde subito (la pubblicazione su Pages ci mette qualche
   * minuto, e il file pubblicato starebbe nella cache del service worker).
   * Scrivere vuole un token di GitHub (fine-grained, «Contents: Read and
   * write» su questo solo repository) scritto una volta in «Impostazioni →
   * Sincronizza»: resta in questo browser e non entra nel backup.
   *
   * Un salvataggio è **un commit solo** (API Git: blob, albero, commit,
   * ramo) con tre cose: le storie, il file delle voci
   * (`audio/narrazione/storie/storie-studio.json`, §6, che fa partire il
   * workflow delle voci) e gli audio caricati a mano nelle battute. Prima di
   * scrivere si rilegge e si unisce: fra due dispositivi vince la versione
   * toccata per ultima di ogni storia (`aggiornato`), e una storia eliminata
   * lascia una lapide (`eliminati`) perché non torni dall'altro. Se nel
   * frattempo qualcun altro ha scritto, il ramo rifiuta e si riprova. */
  const CHIAVE_REPO = 'astrocal_storie_repo_v1';
  const CHIAVE_ELIMINATI = 'astrocal_storie_eliminati_v1';
  const FILE_CONDIVISE = 'storie-studio/storie.json';
  const PERCORSO_VOCI = 'audio/narrazione/storie/' + FILE_VOCI;
  const REPO_DI_SERIE = 'fabb12/AstroCalendarBen';
  const REPO_VALIDO = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
  const RAMO_VALIDO = /^[\w./-]{1,100}$/;
  const STUDIO_REPO_AUDIO_MAX = 40 * 1024 * 1024;

  // Il repository di questo sito: quello scritto in config.js, o quello che
  // dice l'indirizzo di Pages (`<proprietario>.github.io/<repository>/`)
  function studioRepoDiSerie(luogo) {
    if (typeof radice.STORIE_REPO === 'string' && REPO_VALIDO.test(radice.STORIE_REPO)) return radice.STORIE_REPO;
    const m = luogo && /^([\w-]+)\.github\.io$/i.exec(luogo.hostname || '');
    const pezzo = luogo && String(luogo.pathname || '').split('/').filter(Boolean)[0];
    if (m && pezzo && REPO_VALIDO.test(m[1] + '/' + pezzo)) return m[1] + '/' + pezzo;
    return REPO_DI_SERIE;
  }
  function studioRepoImpostazioni() {
    let salvate = {};
    try { salvate = JSON.parse((archivio() && archivio().getItem(CHIAVE_REPO)) || '{}') || {}; } catch (_) { salvate = {}; }
    return {
      repo: REPO_VALIDO.test(salvate.repo || '') ? salvate.repo : studioRepoDiSerie(radice.location),
      ramo: RAMO_VALIDO.test(salvate.ramo || '') ? salvate.ramo : 'main',
      token: typeof salvate.token === 'string' ? salvate.token.trim() : ''
    };
  }
  function studioRepoSalvaImpostazioni(imp) {
    const a = archivio();
    try { if (a) a.setItem(CHIAVE_REPO, JSON.stringify({ repo: imp.repo, ramo: imp.ramo, token: imp.token || '' })); return true; }
    catch (_) { return false; }
  }
  function eliminatiCarica() {
    try {
      const d = JSON.parse((archivio() && archivio().getItem(CHIAVE_ELIMINATI)) || '{}');
      return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
    } catch (_) { return {}; }
  }
  function eliminatiSalva(e) {
    try { if (archivio()) archivio().setItem(CHIAVE_ELIMINATI, JSON.stringify(e)); } catch (_) { /* resta la lapide di prima */ }
  }
  // Le lapidi, pulite: un id e un istante
  function lapidi(e) {
    const fuori = {};
    if (e && typeof e === 'object' && !Array.isArray(e))
      for (const [id, q] of Object.entries(e)) if (/^[\w-]{1,30}$/.test(id) && Number.isFinite(Number(q)) && Number(q) > 0) fuori[id] = Math.floor(Number(q));
    return fuori;
  }
  // Quali storie vanno sul repository: quelle salvate nelle demo
  const condivisa = p => !!(p && p.demoChiave);

  // Il contenuto di `storie-studio/storie.json`, in un ordine fisso (lo
  // stesso file per le stesse storie: niente commit inutili)
  function studioFileCondivise(progetti, eliminati) {
    const storie = progetti.filter(condivisa).map(copia).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const e = lapidi(eliminati), ordinati = {};
    for (const k of Object.keys(e).sort()) ordinati[k] = e[k];
    return JSON.stringify({
      _leggimi: 'Le storie salvate nello Studio delle storie, scritte dall\'app (Studio → Impostazioni → Sincronizza) e lette da ogni dispositivo. Non modificarlo a mano.',
      v: 1, storie, eliminati: ordinati
    }, null, 2) + '\n';
  }
  // E il contrario: un file rotto vale come vuoto, una storia rotta si salta
  function studioLeggiCondivise(testo) {
    let d = null;
    try { d = JSON.parse(testo); } catch (_) { d = null; }
    if (!d || typeof d !== 'object') return { progetti: [], eliminati: {} };
    const progetti = (Array.isArray(d.storie) ? d.storie : [])
      .map(p => { try { return studioRipulisci(p); } catch (_) { return null; } })
      .filter(p => p && p.demoChiave);
    return { progetti, eliminati: lapidi(d.eliminati) };
  }
  /* L'unione di quello che c'è qui con quello del repository. Di ogni
   * storia vince la versione toccata per ultima; una lapide più recente
   * dell'ultima modifica la toglie. Le bozze mai salvate (senza demo) non
   * si toccano. `arrivati`: storie nuove o più fresche dal repository;
   * `tolti`: storie di qui eliminate altrove. */
  function studioUnisci(locali, eliminatiLocali, remoto) {
    const eliminati = lapidi(eliminatiLocali);
    for (const [id, q] of Object.entries(lapidi(remoto && remoto.eliminati))) eliminati[id] = Math.max(eliminati[id] || 0, q);
    const progetti = locali.slice();
    const arrivati = [], tolti = [];
    for (const r of (remoto && remoto.progetti) || []) {
      if ((eliminati[r.id] || 0) >= (r.aggiornato || 0)) continue;
      const i = progetti.findIndex(p => p.id === r.id);
      if (i < 0) { progetti.push(r); arrivati.push(r); }
      else if ((r.aggiornato || 0) > (progetti[i].aggiornato || 0)) { progetti[i] = r; arrivati.push(r); }
    }
    for (let i = progetti.length - 1; i >= 0; i--) {
      const p = progetti[i];
      if (condivisa(p) && eliminati[p.id] && (p.aggiornato || 0) <= eliminati[p.id]) { tolti.push(p); progetti.splice(i, 1); }
    }
    return { progetti, eliminati, arrivati, tolti };
  }

  // Lo SHA di un blob come lo calcola git, per non ricaricare un audio
  // che sul repository c'è già uguale
  async function shaBlob(byte) {
    const testa = new TextEncoder().encode('blob ' + byte.length + '\0');
    const tutto = new Uint8Array(testa.length + byte.length);
    tutto.set(testa); tutto.set(byte, testa.length);
    const h2 = new Uint8Array(await crypto.subtle.digest('SHA-1', tutto));
    return Array.from(h2, b => b.toString(16).padStart(2, '0')).join('');
  }
  function base64Di(byte) {
    let s = '';
    for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode.apply(null, byte.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const percorsoUrl = percorso => percorso.split('/').map(encodeURIComponent).join('/');

  // Una chiamata all'API di GitHub. `null` per un 404 (il file non c'è
  // ancora), un errore con lo stato per il resto.
  async function gh(imp, metodo, percorso, corpo, accetta) {
    const intest = { Accept: accetta || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (imp.token) intest.Authorization = 'Bearer ' + imp.token;
    if (corpo !== undefined) intest['Content-Type'] = 'application/json';
    const r = await fetch('https://api.github.com/repos/' + imp.repo + percorso, {
      method: metodo, headers: intest, cache: 'no-store', body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
    if (r.status === 404) return null;
    if (!r.ok) {
      let dett = '';
      try { dett = (await r.json()).message || ''; } catch (_) { /* senza spiegazione */ }
      const e = new Error((r.status === 401 ? t('studio.repo.errToken') : r.status === 403 ? t('studio.repo.errPermesso') : '') || ('GitHub ' + r.status + (dett ? ': ' + dett : '')));
      e.stato = r.status;
      throw e;
    }
    return accetta === 'application/vnd.github.raw+json' ? r.text() : r.json();
  }
  const leggiFile = (imp, percorso) => gh(imp, 'GET', '/contents/' + percorsoUrl(percorso) + '?ref=' + encodeURIComponent(imp.ramo), undefined, 'application/vnd.github.raw+json');

  // Il repository, letto: dall'API (fresca), e se non risponde (limite di
  // richieste senza token) dal file grezzo
  async function leggiRemoto(imp) {
    try {
      const testo = await leggiFile(imp, FILE_CONDIVISE);
      return testo === null ? { progetti: [], eliminati: {} } : studioLeggiCondivise(testo);
    } catch (e) {
      if (imp.token) throw e;
      const r = await fetch('https://raw.githubusercontent.com/' + imp.repo + '/' + percorsoUrl(imp.ramo) + '/' + FILE_CONDIVISE + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.status === 404) return { progetti: [], eliminati: {} };
      if (!r.ok) throw e;
      return studioLeggiCondivise(await r.text());
    }
  }

  // Quello che arriva entra nello Studio e nella libreria delle demo
  function applicaUnione(u) {
    const lib = radice.AstroDemo && radice.AstroDemo.libreria;
    const foto = studioVociCarica();
    const togliFoto = id => { for (const [k, f] of Object.entries(foto)) if (!f || f.progetto === id) delete foto[k]; };
    // La demo di una storia eliminata altrove resta, come resta sul
    // dispositivo che l'ha eliminata (§7, «Elimina» toglie solo il progetto)
    for (const p of u.tolti) {
      cancellaVoci(p.id);
      togliFoto(p.id);
    }
    for (const p of u.arrivati) {
      try {
        if (lib && typeof lib.metti === 'function') lib.metti(p.demoChiave, studioCopione(p));
      } catch (_) { /* un copione che il motore di qui non accetta: resta il progetto */ }
      togliFoto(p.id);
      const prese = new Set(Object.keys(foto));
      const f = studioVociStoria(p, p.lingua || linguaStudio(), prese);
      foto[f.chiave] = f;
    }
    studioVociSalva(foto);
    studio.progetti = u.progetti;
    studioSalvaTutti(studio.progetti);
    eliminatiSalva(u.eliminati);
    if (studio.progetto) {
      const ora = studio.progetti.find(p => p.id === studio.progetto.id);
      if (ora) studio.progetto = ora;
      else if (u.tolti.some(p => p.id === studio.progetto.id)) studio.progetto = studio.progetti[0] || studioNuovoProgetto();
    }
    if (u.arrivati.length || u.tolti.length) {
      if (typeof radice.demoPaginaRicarica === 'function') { try { radice.demoPaginaRicarica(); } catch (_) { /* la pagina Demo si rifà quando si apre */ } }
      disegna();
    }
  }

  // Un commit solo con tutti i file cambiati; `false` se il ramo nel
  // frattempo è andato avanti (si riprova da capo)
  async function scriviCommit(imp, file, messaggio) {
    const ref = await gh(imp, 'GET', '/git/ref/heads/' + percorsoUrl(imp.ramo));
    if (!ref) throw new Error(t('studio.repo.errRamo', { ramo: imp.ramo }));
    const base = await gh(imp, 'GET', '/git/commits/' + ref.object.sha);
    const albero = [];
    for (const f of file) {
      // v440: un file da togliere (una musica che nessuna storia usa più)
      if (f.togli) { albero.push({ path: f.percorso, mode: '100644', type: 'blob', sha: null }); continue; }
      const blob = await gh(imp, 'POST', '/git/blobs', f.testo !== undefined
        ? { content: f.testo, encoding: 'utf-8' } : { content: base64Di(f.byte), encoding: 'base64' });
      albero.push({ path: f.percorso, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const nuovo = await gh(imp, 'POST', '/git/trees', { base_tree: base.tree.sha, tree: albero });
    const commit = await gh(imp, 'POST', '/git/commits', { message: messaggio, tree: nuovo.sha, parents: [ref.object.sha] });
    try { await gh(imp, 'PATCH', '/git/refs/heads/' + percorsoUrl(imp.ramo), { sha: commit.sha, force: false }); }
    catch (e) { if (e.stato === 422 || e.stato === 409) return false; throw e; }
    return true;
  }

  // I file da scrivere: solo quelli che sul repository non sono già così
  async function fileDaScrivere(imp) {
    const fuori = [];
    const storie = studioFileCondivise(studio.progetti, eliminatiCarica());
    if (await leggiFile(imp, FILE_CONDIVISE) !== storie) fuori.push({ percorso: FILE_CONDIVISE, testo: storie });
    const voci = studioFileVoci(studioVociCarica());
    if (await leggiFile(imp, PERCORSO_VOCI) !== voci) fuori.push({ percorso: PERCORSO_VOCI, testo: voci });
    const cartelle = new Map();
    let peso = 0;
    for (const v of await vociDaScrivere()) {
      const dir = 'audio/narrazione/storie/' + v.cartella + '/' + v.lingua;
      if (!cartelle.has(dir)) {
        let elenco = null;
        try { elenco = await gh(imp, 'GET', '/contents/' + percorsoUrl(dir) + '?ref=' + encodeURIComponent(imp.ramo)); } catch (_) { elenco = null; }
        cartelle.set(dir, new Map((Array.isArray(elenco) ? elenco : []).map(x => [x.name, x.sha])));
      }
      const byte = new Uint8Array(await v.blob.arrayBuffer());
      if (cartelle.get(dir).get(v.nome) === await shaBlob(byte)) continue;
      if ((peso += byte.length) > STUDIO_REPO_AUDIO_MAX) break;   // il resto al prossimo salvataggio
      fuori.push({ percorso: dir + '/' + v.nome, byte });
    }
    /* v440: le musiche di sottofondo (§4-ter). Si scrivono quelle caricate
     * qui che sul repository non ci sono uguali, e si tolgono quelle che
     * nessuna storia salvata usa più (una traccia sostituita, una scena o una
     * storia eliminata). Una musica caricata da un altro dispositivo non è
     * qui, ma una storia la vuole: resta. */
    const volute = studioMusicheVolute(studio.progetti.filter(condivisa));
    const sulRepo = new Map();
    const elenca = async percorso => {
      try { const x = await gh(imp, 'GET', '/contents/' + percorsoUrl(percorso) + '?ref=' + encodeURIComponent(imp.ramo)); return Array.isArray(x) ? x : []; }
      catch (_) { return null; }
    };
    const cartelleMusica = await elenca(STUDIO_MUSICA_CARTELLA);
    let elencoCompleto = cartelleMusica !== null;
    for (const c of cartelleMusica || []) {
      if (c.type !== 'dir') continue;
      const dentro = await elenca(c.path);
      if (dentro === null) { elencoCompleto = false; continue; }
      for (const f of dentro) if (f.type === 'file') sulRepo.set(f.path, f.sha);
    }
    if (elencoCompleto) for (const percorso of sulRepo.keys()) if (!volute.has(percorso)) fuori.push({ percorso, togli: true });
    const registrate = new Map((await tutteLeVoci()).filter(x => eMusica(x.chiave)).map(x => [x.chiave, x.rec]));
    for (const [percorso, v] of volute) {
      const rec = registrate.get(v.chiave);
      if (!rec || !rec.blob || rec.sha !== v.sha || sulRepo.get(percorso) === v.sha) continue;
      const byte = new Uint8Array(await rec.blob.arrayBuffer());
      if (sulRepo.get(percorso) === await shaBlob(byte)) continue;
      if ((peso += byte.length) > STUDIO_REPO_AUDIO_MAX) break;
      fuori.push({ percorso, byte });
    }
    return fuori;
  }

  /* Il giro intero: leggi, unisci, e (`spingi`, con un token) scrivi.
   * Restituisce la frase per chi guarda. Uno alla volta: un salvataggio che
   * arriva durante un giro aspetta la fine e ne fa uno suo. */
  let giroInCorso = Promise.resolve();
  function studioSincronizza({ spingi = false, titolo = '' } = {}) {
    const giro = giroInCorso.then(() => sincronizzaOra(spingi, titolo));
    giroInCorso = giro.catch(() => null);
    return giro;
  }
  async function sincronizzaOra(spingi, titolo) {
    if (typeof fetch !== 'function') return '';
    const imp = studioRepoImpostazioni();
    // Senza l'interfaccia (le prove Node) l'archivio non è ancora stato letto
    if (!studio.radice) studio.progetti = studioCaricaTutti();
    try {
      for (let prova = 0; prova < 3; prova++) {
        const u = studioUnisci(studio.progetti, eliminatiCarica(), await leggiRemoto(imp));
        applicaUnione(u);
        const arrivo = u.arrivati.length || u.tolti.length ? t('studio.repo.arrivate', { n: u.arrivati.length, tolte: u.tolti.length }) + ' ' : '';
        if (!spingi) return arrivo;
        if (!imp.token) return arrivo + t('studio.repo.senzaToken');
        const file = await fileDaScrivere(imp);
        if (!file.length) return arrivo + t('studio.repo.giaAPosto');
        const msg = 'Storie dello Studio: ' + (unaRiga(titolo) || 'aggiornamento').slice(0, 72);
        if (await scriviCommit(imp, file, msg)) return arrivo + t('studio.repo.scritto', { file: file.length, repo: imp.repo });
      }
      return t('studio.repo.errOccupato');
    } catch (e) {
      return t('studio.repo.errore', { errore: e && e.message || String(e) });
    }
  }

  /* Il suono di un'azione caricato o generato (v444): come la musica, il
   * file resta in questo browser (IndexedDB, chiave
   * `<progetto>|musica|suono-<azione>`), suona subito col percorso che avrà
   * sul sito e parte verso il repository con la storia salvata. */
  const STUDIO_SUONO_MAX = 10 * 1024 * 1024;
  async function caricaSuono(dove, file) {
    const p = studio.progetto, az = leggi(dove);
    if (!az || az.tipo !== 'suono' || !file) return false;
    if (file.size > STUDIO_SUONO_MAX) { esito(t('studio.voce.troppoGrande')); return false; }
    if (!/^audio\//.test(file.type || '') && !STUDIO_ESTENSIONI.test(file.name || '')) { esito(t('studio.voce.nonAudio')); return false; }
    const durata = await misuraDurata(file);
    if (!durata) { esito(t('studio.voce.nonAudio')); return false; }
    const est = (STUDIO_ESTENSIONI.exec(file.name || '') || [, /wav/.test(file.type) ? 'wav' : /ogg/.test(file.type) ? 'ogg' : /mp4|m4a|aac/.test(file.type) ? 'm4a' : /webm/.test(file.type) ? 'webm' : 'mp3'])[1].toLowerCase();
    let sha;
    try { sha = await improntaFile(file); } catch (e) { esito(t('studio.voci.errore', { errore: e && e.message || String(e) })); return false; }
    const sid = 'suono-' + az.id, k = chiaveMusica(p.id, sid);
    try { await dbVoci(st => st.put({ blob: file, nome: file.name || '', tipo: file.type || '', durata, musica: true, est, sha, sid }, k), 'audio'); }
    catch (e) { esito(t('studio.voci.errore', { errore: e && e.message || String(e) })); return false; }
    az.file = { nome: String(file.name || '').slice(0, 80), est, sha, durata };
    az.fonte = 'file';
    registraMusica(k, studioPercorsoMusica(p.id, sid, az.file), URL.createObjectURL(file));
    salvaPresto();
    disegna();
    const caricato = t('studio.suono.caricato', { nome: az.file.nome || est, secondi: secondiDi(durata) });
    esito(caricato);
    if (!condivisa(p)) { esito(caricato + ' ' + t('studio.repo.audioDopo')); return true; }
    if (!studioRepoImpostazioni().token) { esito(caricato + ' ' + t('studio.repo.senzaToken')); return true; }
    esito(caricato + ' ' + t('studio.repo.inCorso'));
    esito(caricato + ' ' + await studioSincronizza({ spingi: true, titolo: p.titolo }));
    return true;
  }
  function togliSuono(az) {
    if (!az || az.tipo !== 'suono') return;
    const k = chiaveMusica(studio.progetto.id, 'suono-' + az.id);
    registraMusica(k, '', '');
    dbVoci(st => st.delete(k), 'audio').catch(() => null);
    az.file = null; az.fonte = 'sintesi';
  }
  // Ascoltare il suono di un'azione: il file, o il rumore sintetizzato
  function ascoltaSuono(az) {
    if (!az) return;
    if (az.fonte === 'file' && az.file) {
      const v = musicheCaricate.get(chiaveMusica(studio.progetto.id, 'suono-' + az.id));
      const url = v ? v.url : studioPercorsoMusica(studio.progetto.id, 'suono-' + az.id, az.file) + '?v=' + az.file.sha.slice(0, 10);
      suonaAnteprima(url, Math.min(1, (az.volume || 1) * 0.8));
      return;
    }
    if (S().suona) S().suona(az.suono, { forza: true, volume: az.volume });
  }

  // ===================================================================
  // 6c. ElevenLabs: voci dei personaggi, suoni e musica (v444)
  // ===================================================================

  /* Chi scrive una storia vuole dare a ogni personaggio una voce vera, senza
   * passare dalla pagina di ElevenLabs a copiare e incollare battuta per
   * battuta (lo faceva `scripts/voci-storie.js --genera`, dal terminale).
   * Adesso lo Studio parla con le API di ElevenLabs dal browser:
   *
   *   - la **chiave** si scrive una volta (Impostazioni → ElevenLabs) e resta in
   *     questo browser, come il token di GitHub: non entra nel backup, non
   *     va nel repository e parte solo verso api.elevenlabs.io;
   *   - per ogni **personaggio** si sceglie la voce: dalla libreria pubblica
   *     di ElevenLabs (in italiano, maschile o femminile secondo il genere
   *     del personaggio) o fra le voci del proprio account, ascoltando prima
   *     l'anteprima che ElevenLabs dà con ogni voce, o la sua prima battuta
   *     detta da quella voce. La scelta sta nel progetto (`voci`) e diventa
   *     quella di serie per le storie nuove (`astrocal_storie_voci_pg_v1`);
   *   - per ogni **battuta** «Genera» chiede l'audio con la voce del
   *     personaggio e la faccia del momento come tag di regia del modello v3
   *     ([excited], [whispers]…, gli stessi di `voci-storie.js`); la proposta
   *     si ascolta, e solo «Usa questa» la mette alla battuta, per la stessa
   *     strada di un file caricato (`caricaVoce`): IndexedDB, narrazione,
   *     repository. «Genera le battute mancanti» le fa tutte di fila;
   *   - un'azione **Suono** si genera da una descrizione (effetti sonori), la
   *     **musica** della storia o di una scena da una descrizione e una
   *     durata; anche lì prima la proposta, poi «Usa questa».
   *
   * Ogni errore di ElevenLabs (chiave, crediti, piano che non permette le voci
   * della libreria o la musica via API) arriva a chi scrive com'è, nella
   * riga dell'esito: lo Studio non si blocca e il resto funziona. */
  const CHIAVE_ELEVEN = 'astrocal_elevenlabs_v1';
  const CHIAVE_VOCI_PG = 'astrocal_storie_voci_pg_v1';
  const ELEVEN_URL = 'https://api.elevenlabs.io';
  const ELEVEN_MODELLI = ['eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5'];
  const ELEVEN_STABILITA = [0, 0.5, 1];
  const ELEVEN_FORMATO = 'mp3_44100_128';
  // La faccia di un momento → il tag audio del modello v3 (gli stessi di
  // `TAG_UMORE` in scripts/voci-storie.js)
  const ELEVEN_TAG_UMORE = {
    happy: 'happy', surprised: 'surprised', worried: 'nervous', sad: 'sad', thinking: 'thoughtful',
    excited: 'excited', sleepy: 'sleepy', laughing: 'laughs', love: 'warmly', angry: 'angry',
    annoyed: 'annoyed', bully: 'mischievously',
    wonder: 'in awe', tender: 'tenderly', determined: 'determined', skeptical: 'skeptical', wistful: 'wistfully'
  };
  function studioElevenImpostazioni() {
    const a = archivio();
    let d = {};
    try { d = JSON.parse((a && a.getItem(CHIAVE_ELEVEN)) || '{}') || {}; } catch (_) { d = {}; }
    return {
      chiave: typeof d.chiave === 'string' ? d.chiave.trim().slice(0, 200) : '',
      modello: ELEVEN_MODELLI.includes(d.modello) ? d.modello : 'eleven_v3',
      stabilita: ELEVEN_STABILITA.includes(d.stabilita) ? d.stabilita : 0.5
    };
  }
  function studioElevenSalva(imp) {
    const a = archivio();
    try { if (a) a.setItem(CHIAVE_ELEVEN, JSON.stringify(imp)); return !!a; } catch (_) { return false; }
  }
  // Le voci scelte per l'ultima storia, di serie per le nuove
  function vociDiSerie() {
    try { return studioPulisciVoci(JSON.parse((archivio() && archivio().getItem(CHIAVE_VOCI_PG)) || '{}')); } catch (_) { return {}; }
  }
  /* La voce di un personaggio in una scena (v445): quella cambiata solo per
   * la scena, se c'è, se no quella della storia, se no quella di serie. */
  function studioVoceDi(progetto, id, scena) {
    return (scena && scena.voci && scena.voci[id]) || (progetto && progetto.voci && progetto.voci[id]) || vociDiSerie()[id] || null;
  }
  // La scena di un campo `scene.<i>…`
  const scenaDi = dove => studio.progetto.scene[Number(String(dove).split('.')[1])] || null;
  // Una battuta generata con una voce che non è più la sua è da rifare
  function studioVoceDaRifare(progetto, scena, m) {
    if (!m || !m.chi || !testoDetto(m)) return false;
    if (!studioVoceValida(m)) return true;
    const v = studioVoceDi(progetto, m.chi, scena);
    return !!(v && m.audio.voce && m.audio.voce !== v.id) || studioTonoCambiato(progetto, m);
  }
  // v449: generata da ElevenLabs con un'intonazione che non è più quella
  // (faccia o tono cambiati dopo). Gli audio caricati o registrati non
  // hanno `tag` e non si toccano.
  function studioTonoCambiato(progetto, m) {
    return !!(m && m.audio && m.audio.voce && typeof m.audio.tag === 'string' &&
      m.audio.tag !== studioFirmaTag(studioTestoPerVoce(m, studioElevenImpostazioni().modello, progetto)));
  }
  // `scena`: la voce vale solo lì (v445); senza, per tutta la storia
  function scegliVocePersonaggio(id, voce, scena) {
    const p = studio.progetto;
    const pulita = voce ? studioPulisciVoce(voce) : null;
    if (scena) {
      scena.voci = Object.assign({}, scena.voci);
      if (pulita) scena.voci[id] = pulita; else delete scena.voci[id];
      salvaPresto();
      return;
    }
    p.voci = Object.assign({}, p.voci);
    const serie = vociDiSerie();
    if (pulita) { p.voci[id] = pulita; serie[id] = pulita; } else { delete p.voci[id]; delete serie[id]; }
    try { archivio() && archivio().setItem(CHIAVE_VOCI_PG, JSON.stringify(serie)); } catch (_) { /* resta nel progetto */ }
    salvaPresto();
  }
  /* La faccia che il personaggio ha **mentre dice** la battuta (v449).
   * Prima a ElevenLabs andava solo la faccia scelta nel momento: una
   * battuta lasciata «di serie», o detta con la faccia rimasta da un
   * momento prima, o cambiata da un'azione «Faccia» all'inizio, partiva
   * senza tag e usciva piatta, mentre a schermo il volto rideva o
   * piangeva. Qui si fa lo stesso conto del copione (`studioCopione`): la
   * faccia del momento, se no quella data da un'azione all'inizio, se no
   * l'ultima avuta nella storia, se no quella di serie del personaggio. */
  function studioFacciaParlata(progetto, m) {
    if (!m || !m.chi) return m && m.umore || '';
    if (m.umore) return m.umore;
    const subito = (m.azioni || []).find(a => a && a.tipo === 'umore' && a.chi === m.chi && a.umore && (a.quando === 'inizio' || a.quando === 'tutto'));
    if (subito) return subito.umore;
    const diSerie = (S().profilo ? S().profilo(m.chi).espressione : '') || 'neutral';
    let faccia = diSerie;
    for (const sc of (progetto && progetto.scene) || []) {
      for (const x of sc.momenti || []) {
        if (x === m || x.id === m.id) return faccia;
        if (x.chi === m.chi && x.umore) faccia = x.umore;
        for (const a of x.azioni || []) if (a && a.tipo === 'umore' && a.chi === m.chi && a.umore) faccia = a.umore;
      }
    }
    return diSerie;
  }
  // I tag d'intonazione di una battuta: la faccia, poi il tono (v449)
  function studioTagVoce(progetto, m) {
    const tag = [];
    const f = ELEVEN_TAG_UMORE[studioFacciaParlata(progetto, m)];
    if (f) tag.push(f);
    for (const x of (m && m.tono) || []) if (STUDIO_TONI.includes(x) && !tag.includes(x)) tag.push(x);
    return tag;
  }
  // I tag in testa a un testo inviato: `[happy] [whispers]`
  const studioFirmaTag = testo => ((String(testo || '').match(/^(?:\[[^\]]{1,30}\]\s*)+/) || [''])[0]).replace(/\s+/g, ' ').trim();
  /* Il testo che va a ElevenLabs: col modello v3 la faccia che il
   * personaggio ha mentre parla e il tono della battuta diventano i tag di
   * regia all'inizio (se la battuta non ne ha già di suoi, scritti a mano:
   * quelli vincono); gli altri modelli i tag li leggerebbero ad alta voce,
   * e lì va il testo nudo. `progetto`: la storia, per la faccia rimasta da
   * prima (di serie quella aperta nello Studio). */
  function studioTestoPerVoce(m, modello, progetto) {
    const testo = testoDetto(m);
    if (!/^eleven_v3/.test(modello || '')) return testo.replace(/\[[^\]]{1,30}\]\s*/g, '').trim();
    if (/^\[[^\]]{1,30}\]/.test(testo)) return testo;
    const p = progetto !== undefined ? progetto : studio.progetto;
    const tag = studioTagVoce(p, m);
    return tag.length ? tag.map(x => `[${x}]`).join(' ') + ' ' + testo : testo;
  }
  // Una voce di ElevenLabs (dell'account o della libreria) nella forma dello
  // Studio. `lingua`: la lingua dell'anteprima da preferire.
  function studioVoceDaEleven(v, lingua) {
    if (!v || typeof v !== 'object' || !STUDIO_VOCE_ID.test(v.voice_id || '')) return null;
    const et = v.labels && typeof v.labels === 'object' ? v.labels : {};
    const verificate = Array.isArray(v.verified_languages) ? v.verified_languages : [];
    const sua = verificate.find(x => x && x.language === lingua && x.preview_url);
    const genere = String(v.gender || et.gender || '').toLowerCase();
    return {
      id: v.voice_id, nome: String(v.name || '').slice(0, 80),
      proprietario: typeof v.public_owner_id === 'string' ? v.public_owner_id : '',
      genere: genere === 'female' ? 'f' : genere === 'male' ? 'm' : '',
      accento: String(v.accent || et.accent || (sua && sua.accent) || '').slice(0, 40),
      eta: String(v.age || et.age || '').replace(/_/g, ' ').slice(0, 30),
      lingue: [...new Set([v.language, et.language].concat(verificate.map(x => x && x.language)).filter(x => typeof x === 'string' && x))],
      descrizione: String(v.description || et.description || v.descriptive || '').slice(0, 160),
      anteprima: String((sua && sua.preview_url) || v.preview_url || ''),
      mia: !v.public_owner_id || v.category === 'cloned' || v.category === 'generated'
    };
  }
  // Le voci dell'account che vanno bene: lingua e genere scelti
  function studioFiltraVoci(voci, { lingua = '', genere = '', cerca = '' } = {}) {
    const q = unaRiga(cerca).toLowerCase();
    return voci.filter(v => v && (!lingua || !v.lingue.length || v.lingue.includes(lingua)) && (!genere || !v.genere || v.genere === genere) &&
      (!q || (v.nome + ' ' + v.descrizione + ' ' + v.accento).toLowerCase().includes(q)));
  }

  /* Una chiamata. `audio`: la risposta è un file (un Blob), se no JSON.
   * Gli errori diventano frasi: chiave, crediti, piano, troppe richieste. */
  async function eleven(metodo, percorso, corpo, { audio = false, chiave } = {}) {
    const k = chiave !== undefined ? chiave : studioElevenImpostazioni().chiave;
    if (!k) throw new Error(t('studio.el.errSenzaChiave'));
    let r;
    try {
      r = await fetch(ELEVEN_URL + percorso, {
        method: metodo,
        headers: Object.assign({ 'xi-api-key': k, accept: audio ? 'audio/mpeg' : 'application/json' }, corpo ? { 'content-type': 'application/json' } : {}),
        body: corpo ? JSON.stringify(corpo) : undefined
      });
    } catch (e) { throw new Error(t('studio.el.errRete')); }
    if (!r.ok) {
      let dettaglio = '';
      try {
        const j = await r.json();
        const d = j && j.detail;
        dettaglio = typeof d === 'string' ? d : d && (d.message || d.status) ? String(d.message || d.status) : JSON.stringify(j).slice(0, 200);
      } catch (_) { /* senza corpo */ }
      if (r.status === 401) throw new Error(t('studio.el.errChiave') + (dettaglio ? ' (' + dettaglio + ')' : ''));
      if (r.status === 402 || /quota|credit/i.test(dettaglio)) throw new Error(t('studio.el.errCrediti') + (dettaglio ? ' (' + dettaglio + ')' : ''));
      if (r.status === 429) throw new Error(t('studio.el.errTroppe'));
      throw new Error(t('studio.el.errRisposta', { stato: r.status, dettaglio: dettaglio || r.statusText || '' }));
    }
    return audio ? r.blob() : r.json();
  }
  const fileDa = (blob, nome) => typeof File === 'function' ? new File([blob], nome, { type: blob.type || 'audio/mpeg' }) : Object.assign(blob, { name: nome });
  function impostazioniVoce(imp) {
    return { stability: imp.modello === 'eleven_v3' ? imp.stabilita : Math.max(0.3, Math.min(0.7, imp.stabilita)), similarity_boost: 0.8 };
  }
  async function elevenParla(voceId, testo, imp) {
    const blob = await eleven('POST', `/v1/text-to-speech/${encodeURIComponent(voceId)}?output_format=${ELEVEN_FORMATO}`,
      { text: testo, model_id: imp.modello, voice_settings: impostazioniVoce(imp) }, { audio: true });
    return fileDa(blob, 'elevenlabs.mp3');
  }
  // I crediti: dicono anche se la chiave funziona
  async function elevenCrediti(chiave) {
    const s = await eleven('GET', '/v1/user/subscription', null, { chiave });
    return { usati: Number(s.character_count) || 0, limite: Number(s.character_limit) || 0, piano: String(s.tier || '') };
  }
  // Le voci: quelle dell'account (tutte, si filtrano qui) o una pagina della libreria
  async function elevenVoci(c) {
    if (c.fonte === 'mie') {
      if (!c.tutteMie) {
        const tutte = [];
        let token = '';
        for (let giro = 0; giro < 5; giro++) {
          const r = await eleven('GET', '/v2/voices?page_size=100' + (token ? '&next_page_token=' + encodeURIComponent(token) : ''));
          tutte.push(...(r.voices || []));
          if (!r.has_more || !r.next_page_token) break;
          token = r.next_page_token;
        }
        c.tutteMie = tutte;
      }
      return { voci: studioFiltraVoci(c.tutteMie.map(v => studioVoceDaEleven(v, c.lingua)).filter(Boolean),
        { lingua: c.lingua, genere: c.genere, cerca: c.cerca }), ancora: false };
    }
    const q = new URLSearchParams({ page_size: '24', page: String(c.pagina || 0) });
    if (c.lingua) q.set('language', c.lingua);
    if (c.genere) q.set('gender', c.genere === 'f' ? 'female' : 'male');
    if (unaRiga(c.cerca)) q.set('search', unaRiga(c.cerca));
    const r = await eleven('GET', '/v1/shared-voices?' + q.toString());
    return { voci: (r.voices || []).map(v => studioVoceDaEleven(v, c.lingua)).filter(Boolean), ancora: !!r.has_more };
  }
  /* Una voce della libreria, per parlare via API, deve stare fra le voci
   * dell'account: si aggiunge. Se c'è già (o il piano non lo permette),
   * si prova con l'ID com'è: l'errore vero, se c'è, lo dirà la sintesi. */
  /* v445: un rifiuto (chiave senza il permesso Voices: scrittura, piano,
   * voce già presente) non deve far sparire la scelta, come succedeva: si
   * tiene l'ID della libreria e si dice perché, nel pannello. */
  const aggiunte = new Map();             // id della libreria → id nell'account
  async function elevenAggiungi(v) {
    if (!v.proprietario) return { id: v.id };
    if (aggiunte.has(v.id)) return { id: aggiunte.get(v.id) };
    try {
      const r = await eleven('POST', `/v1/voices/add/${encodeURIComponent(v.proprietario)}/${encodeURIComponent(v.id)}`, { new_name: v.nome || v.id });
      const id = r && STUDIO_VOCE_ID.test(r.voice_id || '') ? r.voice_id : v.id;
      aggiunte.set(v.id, id);
      return { id };
    } catch (e) {
      if (/already|exist/i.test(e.message)) { aggiunte.set(v.id, v.id); return { id: v.id }; }
      return { id: v.id, avviso: e.message };
    }
  }

  // Le proposte: audio generati e non ancora usati, `voce|<momento>`,
  // `musica|<storia o scena>`, `suono|<azione>` → { file, url }
  const proposte = new Map();
  let elInCorso = null;                   // la chiave della proposta in lavorazione
  function mettiProposta(k, file) {
    togliProposta(k);
    proposte.set(k, { file, url: URL.createObjectURL(file), voce: file.voce || '', tag: file.tag });
  }
  function togliProposta(k) {
    const x = proposte.get(k);
    if (x) { try { URL.revokeObjectURL(x.url); } catch (_) { /* niente */ } proposte.delete(k); }
  }
  let ascoltoEl = null;
  function suonaAnteprima(url, volume) {
    if (ascoltoEl) { try { ascoltoEl.pause(); } catch (_) { /* niente */ } }
    if (anteprima) { try { anteprima.pause(); } catch (_) { /* niente */ } }
    ascoltoEl = null;
    if (!url || typeof Audio === 'undefined') return;
    ascoltoEl = new Audio(url);
    if (volume !== undefined) ascoltoEl.volume = Math.max(0, Math.min(1, volume));
    ascoltoEl.play().catch(() => esito(t('studio.el.nonSuona')));
  }
  /* I messaggi di ElevenLabs stanno dove si è premuto (v445): prima
   * finivano soltanto nella riga in cima allo Studio, e chi lavorava su una
   * battuta in fondo alla pagina non vedeva né «sto generando» né l'errore,
   * e pensava che il tasto non facesse niente. `luogo` è la chiave del
   * posto (`voce|<momento>`, `pg|<personaggio>`, `scelta`…). */
  function notifica(luogo, testo, errore) {
    studio.elMsg = testo ? { luogo, testo, errore: !!errore } : null;
    esito(testo);
  }
  function notaEl(luogo) {
    const m = studio.elMsg;
    if (!m || m.luogo !== luogo) return null;
    return h('small', { class: 'studio-el-nota' + (m.errore ? ' errore' : ''), role: m.errore ? 'alert' : 'status' }, m.testo);
  }
  // Un lavoro con ElevenLabs alla volta: il tasto dice che sta lavorando
  async function lavoro(k, fai2, luogo = k) {
    if (elInCorso) { notifica(luogo, t('studio.el.attendi'), true); disegna(); return null; }
    elInCorso = k;
    disegna();
    try { return await fai2(); }
    catch (e) { notifica(luogo, t('studio.el.errore', { errore: e && e.message || String(e) }), true); return null; }
    finally { elInCorso = null; disegna(); }
  }
  // La chiave di una proposta di musica: la storia o la scena
  const chiaveMusicaEl = dove => 'musica|' + (dove === 'storia' ? 'storia' : (leggi(dove) || {}).id);

  // «Genera» di una battuta: la proposta, che parte subito in ascolto
  async function generaVoce(dove) {
    const p = studio.progetto, m = leggi(dove), sc = scenaDi(dove);
    if (!m) return;
    const k = 'voce|' + m.id;
    if (!m.chi || !testoDetto(m)) { notifica(k, t('studio.voce.primaIlTesto'), true); disegna(); return; }
    const voce = studioVoceDi(p, m.chi, sc);
    // senza voce: la scelta si apre qui, sotto la battuta
    if (!voce) { apriScelta(m.chi, { luogo: k, scena: sc && sc.id, ambitoLibero: true }); return; }
    const imp = studioElevenImpostazioni();
    // v449: con la faccia che ha mentre parla e il tono della battuta
    const testo = studioTestoPerVoce(m, imp.modello, p);
    const file = await lavoro(k, () => { notifica(k, t('studio.el.generoVoce', { nome: nome(m.chi) })); return elevenParla(voce.id, testo, imp); });
    if (!file) return;
    mettiProposta(k, Object.assign(file, { voce: voce.id, tag: studioFirmaTag(testo) }));
    notifica(k, t('studio.el.propostaPronta'));
    disegna();
    suonaAnteprima(proposte.get(k).url);
  }
  // «Genera le battute mancanti» di un personaggio: senza proposta, dritte
  // alle battute; il repository una volta sola alla fine
  // `scena`: solo le battute di quella scena (v445). Ogni battuta con la
  // voce che ha nella sua scena; anche quelle generate con un'altra voce.
  async function generaMancanti(id, scena) {
    const p = studio.progetto, luogo = scena ? 'sc|' + scena.id + '|' + id : 'pg|' + id;
    const imp = studioElevenImpostazioni();
    const dove = [];
    p.scene.forEach((sc, i) => { if (!scena || sc === scena) sc.momenti.forEach((m, k) => { if (m.chi === id && studioVoceDaRifare(p, sc, m)) dove.push(`scene.${i}.momenti.${k}`); }); });
    if (!dove.length) { notifica(luogo, t('studio.el.nienteDaFare', { nome: nome(id) })); disegna(); return; }
    const senza = dove.find(d => !studioVoceDi(p, id, scenaDi(d)));
    if (senza) { apriScelta(id, { luogo, scena: scena && scena.id }); return; }
    let fatte = 0;
    await lavoro(luogo, async () => {
      for (const d of dove) {
        if (studio.progetto !== p) break;
        notifica(luogo, t('studio.el.generoN', { nome: nome(id), n: fatte + 1, totale: dove.length }));
        const voce = studioVoceDi(p, id, scenaDi(d));
        const testo = studioTestoPerVoce(leggi(d), imp.modello, p);
        const file = await elevenParla(voce.id, testo, imp);
        if (await caricaVoce(d, file, { sincronizza: false, voce: voce.id, tag: studioFirmaTag(testo) })) fatte++;
      }
    });
    if (!fatte) return;
    const finito = t('studio.el.generate', { n: fatte, nome: nome(id) });
    notifica(luogo, finito);
    disegna();
    if (!condivisa(p) || !studioRepoImpostazioni().token) { esito(finito + ' ' + t(condivisa(p) ? 'studio.repo.senzaToken' : 'studio.repo.audioDopo')); return; }
    esito(finito + ' ' + t('studio.repo.inCorso'));
    const msg = await aggiornaVoci({ salvata: p, chiedi: false });
    salvaPresto();
    esito(finito + ' ' + (msg ? msg + ' ' : '') + await studioSincronizza({ spingi: true, titolo: p.titolo }));
  }
  // Un effetto sonoro da una descrizione (da 0,5 a 30 s; senza durata la sceglie ElevenLabs)
  async function generaSuono(dove) {
    const az = leggi(dove);
    if (!az || az.tipo !== 'suono') return;
    const richiesta = unaRiga(az.richiesta);
    const k = 'suono|' + az.id;
    if (!richiesta) { notifica(k, t('studio.el.primaLaDescrizione'), true); disegna(); return; }
    const file = await lavoro(k, async () => {
      notifica(k, t('studio.el.generoSuono'));
      const corpo = { text: richiesta, prompt_influence: 0.4 };
      if (az.secondi > 0) corpo.duration_seconds = Math.max(0.5, Math.min(30, Number(az.secondi)));
      return fileDa(await eleven('POST', `/v1/sound-generation?output_format=${ELEVEN_FORMATO}`, corpo, { audio: true }), 'suono-elevenlabs.mp3');
    });
    if (!file) return;
    mettiProposta(k, file);
    notifica(k, t('studio.el.propostaPronta'));
    disegna();
    suonaAnteprima(proposte.get(k).url);
  }
  // La musica di sottofondo da una descrizione e una durata (da 10 s a 5 minuti)
  const richiesteMusica = new Map();      // chiave della proposta → { testo, secondi }
  function richiestaMusica(k) {
    if (!richiesteMusica.has(k)) {
      const p = studio.progetto;
      const tema = unaRiga(p.titolo) || unaRiga(p.obiettivo);
      richiesteMusica.set(k, { testo: t('studio.el.musicaDiSerie', { tema: tema || t('studio.el.musicaTema') }), secondi: 60 });
    }
    return richiesteMusica.get(k);
  }
  async function generaMusica(dove) {
    const k = chiaveMusicaEl(dove);
    const r = richiestaMusica(k);
    if (!unaRiga(r.testo)) { notifica(k, t('studio.el.primaLaDescrizione'), true); disegna(); return; }
    const file = await lavoro(k, async () => {
      notifica(k, t('studio.el.generoMusica'));
      const ms = Math.round(Math.max(10, Math.min(300, Number(r.secondi) || 60)) * 1000);
      return fileDa(await eleven('POST', `/v1/music?output_format=${ELEVEN_FORMATO}`, { prompt: unaRiga(r.testo), music_length_ms: ms }, { audio: true }), 'musica-elevenlabs.mp3');
    });
    if (!file) return;
    mettiProposta(k, file);
    notifica(k, t('studio.el.propostaPronta'));
    disegna();
    suonaAnteprima(proposte.get(k).url, 0.6);
  }
  // «Usa questa»: la proposta prende la strada di un file caricato
  async function usaProposta(tipo, dove) {
    const x = tipo === 'voce' ? leggi(dove) : tipo === 'suono' ? leggi(dove) : null;
    const k = tipo === 'musica' ? chiaveMusicaEl(dove) : x ? tipo + '|' + x.id : '';
    const pr = proposte.get(k);
    if (!pr) return;
    if (ascoltoEl) { try { ascoltoEl.pause(); } catch (_) { /* niente */ } }
    studio.elMsg = null;
    const ok = tipo === 'voce' ? await caricaVoce(dove, pr.file, { voce: pr.voce, tag: pr.tag }) : tipo === 'suono' ? await caricaSuono(dove, pr.file) : await caricaMusica(dove, pr.file);
    if (ok !== false) togliProposta(k);
    disegna();
  }

  /* La scelta della voce di un personaggio: un pannello sotto la sua riga,
   * coi filtri (libreria o voci mie, lingua, genere, parole) e l'elenco. */
  /* v445: la scelta si apre **dove si è premuto** — nella riga del
   * personaggio (passo 2), nelle voci della scena, sotto la battuta — e non
   * più soltanto al passo 2, dove da una battuta in fondo alla pagina non
   * la si vedeva aprire. `scena`: l'id della scena se la voce vale solo lì;
   * `ambitoLibero`: chi sceglie decide (da una battuta) se vale per tutta
   * la storia o solo per quella scena. */
  function apriScelta(id, { luogo = 'pg|' + id, scena = '', ambitoLibero = false } = {}) {
    // v447: la scelta del passo 2 sta nella linguetta delle voci, che si apre
    if (luogo.startsWith('pg|') && studio.progetto) schedeCast.set(studio.progetto.id, 'voci');
    const prof = S().profilo ? S().profilo(id) : {};
    const p = studio.progetto;
    studio.elScelta = { pg: id, luogo, scena: scena || '', ambito: ambitoLibero && !(p.voci && p.voci[id]) ? '' : scena || '', ambitoLibero,
      fonte: 'libreria', lingua: linguaStudio() === 'en' ? 'en' : 'it', genere: prof.genere === 'f' ? 'f' : 'm',
      cerca: '', pagina: 0, voci: [], ancora: false, caricando: false, errore: '', nota: '', tutteMie: null };
    studio.elMsg = null;
    disegna();
    cercaVoci();
    // e si porta in vista: su un telefono il pannello può nascere sotto il bordo
    const pannello = studio.radice && studio.radice.querySelector('.studio-el-scelta');
    if (pannello && pannello.scrollIntoView) { try { pannello.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) { /* vecchi browser */ } }
  }
  async function cercaVoci(altre) {
    const c = studio.elScelta;
    if (!c) return;
    if (!studioElevenImpostazioni().chiave) { c.errore = t('studio.el.errSenzaChiave'); disegna(); return; }
    c.caricando = true; c.errore = '';
    if (!altre) { c.pagina = 0; c.voci = []; }
    disegna();
    try {
      const r = await elevenVoci(c);
      if (studio.elScelta !== c) return;
      c.voci = altre ? c.voci.concat(r.voci.filter(v => !c.voci.some(x => x.id === v.id))) : r.voci;
      c.ancora = r.ancora;
    } catch (e) { if (studio.elScelta === c) c.errore = e.message; }
    if (studio.elScelta === c) { c.caricando = false; disegna(); }
  }
  // La prima battuta del personaggio (o una frase di prova), detta da una voce
  async function provaVoce(v) {
    const c = studio.elScelta, p = studio.progetto;
    if (!c) return;
    const m = p.scene.flatMap(sc => sc.momenti).find(x => x.chi === c.pg && testoDetto(x)) ||
      studioNuovoMomento({ chi: c.pg, testo: t('studio.el.fraseProva', { nome: nome(c.pg) }), umore: 'happy' });
    const imp = studioElevenImpostazioni();
    const file = await lavoro('prova|' + v.id, async () => {
      c.nota = t('studio.el.generoProva', { voce: v.nome }); c.errore = '';
      esito(c.nota);
      const a = await elevenAggiungi(v);
      return elevenParla(a.id, studioTestoPerVoce(m, imp.modello, p), imp);
    }, 'scelta');
    if (studio.elScelta === c) { c.nota = file ? t('studio.el.provaPronta', { voce: v.nome }) : ''; c.errore = file ? '' : (studio.elMsg && studio.elMsg.testo) || ''; }
    disegna();
    if (!file) return;
    mettiProposta('prova', file);
    esito(t('studio.el.provaPronta', { voce: v.nome }));
    suonaAnteprima(proposte.get('prova').url);
  }
  async function scegliVoce(v) {
    const c = studio.elScelta;
    if (!c) return;
    const a = await lavoro('scegli|' + v.id, () => elevenAggiungi(v), 'scelta');
    if (!a || studio.elScelta !== c) return;
    const sc = c.ambito ? studio.progetto.scene.find(x => x.id === c.ambito) : null;
    scegliVocePersonaggio(c.pg, { id: a.id, nome: v.nome, anteprima: v.anteprima, genere: v.genere }, sc);
    const detto = t(sc ? 'studio.el.voceSceltaScena' : 'studio.el.voceScelta', { voce: v.nome, nome: nome(c.pg), n: sc ? studio.progetto.scene.indexOf(sc) + 1 : '' }) +
      (a.avviso ? ' ' + t('studio.el.avvisoAggiungi', { errore: a.avviso }) : '');
    studio.elScelta = null;
    notifica(c.luogo, detto, !!a.avviso);
    disegna();
  }

  // ===================================================================
  // 7. L'interfaccia
  // ===================================================================

  /* Un elemento in una riga: `h('button', { class: 'x', onclick }, testo)`.
   * Si costruisce tutto col DOM, mai con innerHTML: i testi vengono da chi
   * scrive la storia, e così restano testo. */
  function h(tag, attributi, ...figli) {
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
  function selettore(campo, valore, opzioni, extra = {}) {
    const s = h('select', Object.assign({ dataset: { campo } }, extra));
    for (const [v, testo] of opzioni) s.append(new Option(testo, v));
    s.value = valore === undefined || valore === null ? '' : valore;
    return s;
  }
  const nome = id => S().nome ? S().nome(id) : id;

  /* Le figurine: il ritratto di un personaggio con una faccia, dipinto una
   * volta sola (`StorieCosmiche.ritratto`) e tenuto come immagine. Lo
   * Studio ne mostra tante — il cast, chi parla, le facce da scegliere — e
   * ridipingerle a ogni ridisegno vorrebbe dire centinaia di volti per un
   * clic. */
  const figurine = new Map();
  function figurina(id, espressione, px, classe) {
    const chiave = id + '|' + (espressione || '') + '|' + px;
    let url = figurine.get(chiave);
    if (url === undefined) {
      url = '';
      try {
        const tela = document.createElement('canvas');
        if (S().ritratto && S().ritratto(tela, id, espressione, { larghezza: px, altezza: px, palco: false, misura: px <= 40 ? 0.54 : 0.44 })) url = tela.toDataURL('image/png');
      } catch (_) { url = ''; }
      figurine.set(chiave, url);
    }
    const prof = S().profilo ? S().profilo(id) : {};
    return url ? h('img', { class: 'studio-figurina ' + (classe || ''), src: url, width: String(px), height: String(px), alt: '' })
      : h('span', { class: 'studio-figurina studio-pallino ' + (classe || ''), style: 'background:' + (prof.pelle || '#cbd5e1'), 'aria-hidden': 'true' });
  }
  // Un'icona disegnata dell'app (DISEGNI, app.js): un SVG fisso, non testo
  // di chi scrive, quindi qui `innerHTML` è sicuro
  function iconaSvg(id, px) {
    const f = typeof radice.icona === 'function' ? radice.icona : (typeof icona === 'function' ? icona : null);
    if (!f) return null;
    const t2 = document.createElement('template');
    t2.innerHTML = f(id, px || 18);
    return t2.content.firstElementChild;
  }

  const studio = {
    progetti: [], progetto: null, radice: null, capito: null, capitoScena: -1, esito: '', copioneAperto: false,
    salvaTimer: 0, aperta: null, schedaMomento: '',
    // v449: il pannello delle impostazioni e la sua linguetta aperta
    impAperto: false, impScheda: 'storia',
    // v444: il pannello della chiave ElevenLabs e la scelta della voce aperta (§6c)
    elScelta: null, elCrediti: '', elMsg: null
  };

  // `tocca`: è una modifica (e non solo un'apertura), quindi il progetto
  // diventa il più recente fra i dispositivi (§6b)
  function salvaPresto(tocca = true) {
    if (tocca && studio.progetto) studio.progetto.aggiornato = Date.now();
    clearTimeout(studio.salvaTimer);
    studio.salvaTimer = setTimeout(() => {
      const i = studio.progetti.findIndex(p => p.id === studio.progetto.id);
      if (i >= 0) studio.progetti[i] = studio.progetto; else studio.progetti.unshift(studio.progetto);
      studioSalvaTutti(studio.progetti);
    }, 250);
  }

  // Un campo è un percorso nel progetto: `scene.0.momenti.2.testo`
  function leggi(percorso) { return percorso.split('.').reduce((o, k) => o == null ? o : o[k], studio.progetto); }
  function scrivi(percorso, valore) {
    const parti = percorso.split('.'), ultimo = parti.pop();
    const o = parti.reduce((x, k) => x == null ? x : x[k], studio.progetto);
    if (o) o[ultimo] = valore;
  }

  function opzioniPersonaggi(elenco, conNessuno) {
    const o = elenco.map(id => [id, nome(id)]);
    if (conNessuno) o.unshift(['', t('studio.nessuno')]);
    return o;
  }
  const opzioniUmori = conVuoto => (conVuoto ? [['', '—']] : []).concat(Object.keys(S().STOR_ESPRESSIONI || {}).map(k => [k, t('storie.espressione.' + k) || k]));
  const opzioniQuando = () => STUDIO_QUANDO.map(q => [q, t('studio.quando.' + q)]);
  // Un bottone che si accende e si spegne (una scelta fra tante)
  const scelta = (acceso, attr, ...figli) => h('button', Object.assign({ type: 'button', 'aria-pressed': String(!!acceso) }, attr), ...figli);

  // L'editor di un'azione: solo i campi del suo tipo, in una riga
  function disegnaAzione(az, base, presenti, scena) {
    const riga = h('div', { class: 'studio-azione' });
    const p = base + '.';
    if (az.tipo === 'suono') return disegnaSuono(az, base, riga);
    if (az.tipo !== 'effetto' || az.chi) riga.append(selettore(p + 'chi', az.chi, opzioniPersonaggi(presenti, az.tipo === 'effetto'), { 'aria-label': t('studio.chi') }));
    const tre = scena.ambiente !== 'cielo';
    const cosmo = scena.ambiente === 'cosmo';
    const altri = studio.progetto.cast.concat(['Sun', 'Moon', 'Earth', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'])
      .filter((x, i, a) => a.indexOf(x) === i && (cosmo || !soloCosmo(x)));
    // Nell'universo le mete sono i suoi luoghi; altrove, i posti dello schermo
    const luoghi = cosmo ? Object.keys(STUDIO_SEGNI_COSMO).concat(Object.keys(STUDIO_TAPPE_COSMO))
      .filter(x => !(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[x])) : ['center', 'left', 'right', 'top', 'bottom'];
    const nomeDi = l => cosmo ? nomeLuogo(l) : t('studio.luogo.' + l);
    if (az.tipo === 'umore') riga.append(selettore(p + 'umore', az.umore, opzioniUmori(false), { 'aria-label': t('storie.espressioneEtichetta') }));
    if (az.tipo === 'guarda') riga.append(selettore(p + 'oggetto', az.oggetto, [['viewer', t('studio.luogo.viewer')]].concat(opzioniPersonaggi(altri.filter(x => x !== az.chi)),
      cosmo ? luoghi.map(l => [l, nomeDi(l)]) : []), { 'aria-label': t('studio.verso') }));
    if (az.tipo === 'muovi') {
      riga.append(selettore(p + 'verso', az.verso, [['', t('studio.scegli')]].concat(opzioniPersonaggi(altri.filter(x => x !== az.chi)), luoghi.map(l => [l, nomeDi(l)])), { 'aria-label': t('studio.verso') }));
      riga.append(selettore(p + 'percorso', az.percorso, (S().STOR_PERCORSI || []).map(x => [x, t('storie.percorso.' + x)]), { 'aria-label': t('studio.percorso') }));
      if (az.verso && !luoghi.includes(az.verso) && !cosmo)
        riga.append(selettore(p + 'lato', az.lato, (S().STOR_LATI || []).map(x => [x, t('studio.lato.' + x)]), { 'aria-label': t('studio.lato') }));
    }
    if (az.tipo === 'torna') riga.append(selettore(p + 'percorso', az.percorso, (S().STOR_PERCORSI || []).map(x => [x, t('storie.percorso.' + x)]), { 'aria-label': t('studio.percorso') }));
    if (az.tipo === 'anima') {
      riga.append(selettore(p + 'animazione', az.animazione, (S().STOR_ANIMAZIONI || []).map(x => [x, t('storie.animazione.' + x)]), { 'aria-label': t('studio.animazione') }));
      riga.append(selettore(p + 'volte', String(az.volte || 0), [['0', t('studio.volteAuto')], ...[1, 2, 3, 4, 5, 6].map(n => [String(n), t('studio.volte', { n })])], { 'aria-label': t('studio.quanteVolte') }));
    }
    if (az.tipo === 'diventa') riga.append(selettore(p + 'forma', az.forma, STUDIO_FORME.map(x => [x, t('storie.veste.' + x)]), { 'aria-label': t('studio.forma') }));
    if (az.tipo === 'scala') riga.append(selettore(p + 'scala', String(az.scala), [['0.4', t('studio.scala.minuscolo')], ['0.7', t('studio.scala.piccolo')], ['1', t('studio.scala.normale')], ['1.6', t('studio.scala.grande')], ['2.5', t('studio.scala.enorme')]], { 'aria-label': t('studio.misura') }));
    if (az.tipo === 'effetto') {
      riga.append(selettore(p + 'effetto', az.effetto, Object.keys(S().STOR_EFFETTI || {}).map(x => [x, t('storie.effetto.' + x)]), { 'aria-label': t('studio.effetto') }));
      riga.append(selettore(p + 'dove', az.dove, [['', t('studio.suChi')]].concat(opzioniPersonaggi(altri), luoghi.map(l => [l, nomeDi(l)])), { 'aria-label': t('studio.dove') }));
      riga.append(selettore(p + 'grandezza', String(az.grandezza || 1), [['0.6', t('studio.scala.piccolo')], ['1', t('studio.scala.normale')], ['1.8', t('studio.scala.grande')], ['3', t('studio.scala.enorme')]], { 'aria-label': t('studio.misura') }));
      riga.append(h('input', { type: 'color', value: az.colore || '#ffd23f', dataset: { campo: p + 'colore' }, 'aria-label': t('studio.colore'), class: 'studio-colore' }));
    }
    riga.append(selettore(p + 'quando', az.quando, opzioniQuando(), { 'aria-label': t('studio.quando') }));
    if (!tre && (az.tipo === 'muovi' || az.tipo === 'torna')) riga.append(h('span', { class: 'studio-avviso' }, t('studio.soloIn3d')));
    riga.append(h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'apriAzione', dove: '' } }, t('studio.ui.fatto')));
    return riga;
  }

  /* Un momento è una battuta del copione, come in un fumetto: la figurina
   * di chi parla con la sua faccia, il fumetto con le parole, e sotto tre
   * linguette — la faccia, la voce col tempo, quello che succede intanto —
   * di cui se ne apre una alla volta (v446). Prima stava tutto aperto: chi
   * parla, tredici facce, la voce, le azioni e tredici bottoni per
   * aggiungerne, per ogni battuta; una scena di sei battute era un muro.
   * Ora un momento chiuso è una riga sola (numero, volto, parole, quante
   * azioni e se ha la voce) e se ne apre uno alla volta per scena. */
  const momentiAperti = new Map();
  const chiaveScena = sc => studio.progetto.id + '|' + sc.id;
  // La linguetta aperta vale per tutte le battute: chi sistema le facce una
  // dopo l'altra la ritrova aperta passando alla battuta seguente
  const STUDIO_SCHEDE_MOMENTO = ['faccia', 'voce', 'azioni'];
  /* I tipi di azione in quattro famiglie, invece di una fila di tredici
   * bottoni: il volto, il movimento, la forma, effetti e suoni. Un tipo
   * nuovo che non è in nessuna finisce fra gli effetti. */
  const STUDIO_FAMIGLIE_AZIONI = { volto: ['umore', 'guarda', 'occhiolino'], moto: ['muovi', 'torna', 'nascondi'], forma: ['anima', 'scala', 'diventa'], effetti: ['effetto', 'suono'] };
  function famiglieAzioni() {
    const f = Object.fromEntries(Object.entries(STUDIO_FAMIGLIE_AZIONI).map(([k, v]) => [k, v.filter(x => STUDIO_TIPI.includes(x))]));
    for (const tipo of STUDIO_TIPI) if (!Object.values(f).some(v => v.includes(tipo))) f.effetti.push(tipo);
    return f;
  }
  // Una linguetta: il nome, e sotto in piccolo com'è adesso
  function linguetta(acceso, dati, testo, stato, extra) {
    return h('button', Object.assign({ type: 'button', class: 'studio-linguetta', 'aria-expanded': String(!!acceso), dataset: dati }, extra || {}),
      h('span', { class: 'studio-linguetta-nome' }, testo), stato ? h('small', {}, h('span', { class: 'studio-linguetta-stato' }, stato)) : null);
  }
  function nomeFaccia(id, e) {
    const lei = id && S().profilo && S().profilo(id).genere === 'f';
    return (lei && t('storie.espressioneLei.' + e)) || t('storie.espressione.' + e) || e;
  }

  function disegnaMomento(m, i, k, scena) {
    const base = `scene.${i}.momenti.${k}`;
    const presenti = studioPresenti(studio.progetto, scena);
    const aperto = momentiAperti.get(chiaveScena(scena)) === m.id;
    const box = h('article', { class: 'studio-momento' + (aperto ? ' aperto' : ''), 'aria-label': t('studio.momento', { n: k + 1 }) });
    const umore = m.umore || (m.chi && S().profilo ? S().profilo(m.chi).espressione : 'neutral');
    const nAzioni = (m.azioni || []).length;
    const strumenti = h('div', { class: 'studio-strumenti' },
      h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'su', dove: base }, 'aria-label': t('studio.su'), title: t('studio.su') }, '↑'),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'giu', dove: base }, 'aria-label': t('studio.giu'), title: t('studio.giu') }, '↓'),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini studio-x', dataset: { fai: 'togliMomento', dove: base }, 'aria-label': t('studio.togli'), title: t('studio.togli') }, '×'));
    // La riga del momento: chiuso dice tutto in breve, aperto è la sua maniglia
    const parole = unaRiga(m.testo);
    const segni = [];
    if (m.chi && m.umore) segni.push(nomeFaccia(m.chi, m.umore));
    if (m.audio) segni.push(t('studio.ui.conVoce'));
    if (nAzioni) segni.push(t('studio.ui.nAzioni', { n: nAzioni }));
    if (m.copione && m.copione.righe.length) segni.push(t('studio.originale.n', { n: m.copione.righe.length }));
    const riga = h('button', { type: 'button', class: 'studio-momento-riga', dataset: { fai: 'apriMomento', dove: base }, 'aria-expanded': String(aperto),
      title: t(aperto ? 'studio.ui.chiudiMomento' : 'studio.ui.apriMomento') },
      h('span', { class: 'studio-numero' }, String(k + 1)),
      aperto ? h('span', { class: 'studio-momento-titolo' }, t('studio.momento', { n: k + 1 }))
        : [m.chi ? figurina(m.chi, umore, 28) : null,
          h('span', { class: 'studio-momento-sunto' },
            h('strong', {}, m.chi ? nome(m.chi) : t('studio.ui.soloAzioniSunto')),
            m.chi ? h('span', { class: 'studio-momento-parole' + (parole ? '' : ' vuote') }, parole ? '«' + parole + '»' : t('studio.ui.senzaParole')) : null),
          segni.length ? h('small', { class: 'studio-momento-segni' }, segni.join(' · ')) : null]);
    box.append(h('div', { class: 'studio-momento-testa' }, riga, strumenti));
    if (!aperto) return box;

    // Chi parla: le figurine di chi è in scena (e «nessuno», per un momento di sole azioni)
    const chi = h('div', { class: 'studio-chi', role: 'group', 'aria-label': t('studio.chiParla') },
      h('span', { class: 'studio-etichetta' }, t('studio.chiParla')));
    for (const id of presenti) {
      chi.append(scelta(m.chi === id, { class: 'studio-chi-tasto', dataset: { fai: 'chi', dove: base, id }, title: nome(id) },
        figurina(id, m.chi === id ? umore : '', 30), h('span', {}, nome(id))));
    }
    chi.append(scelta(!m.chi, { class: 'studio-chi-tasto studio-nessuno', dataset: { fai: 'chi', dove: base, id: '' } }, t('studio.ui.soloAzioni')));
    box.append(chi);
    // Il fumetto: la figurina grande e le parole
    if (m.chi) {
      const testo = h('textarea', { rows: '2', maxlength: '400', dataset: { campo: base + '.testo' }, placeholder: t('studio.testoAiuto', { nome: nome(m.chi) }), 'aria-label': t('studio.battuta') });
      testo.value = m.testo || '';
      const n = parole ? parole.split(' ').length : 0;
      box.append(h('div', { class: 'studio-fumetto' },
        figurina(m.chi, umore, 64, 'studio-chi-grande'),
        h('div', { class: 'studio-nuvola' }, testo,
          h('span', { class: 'studio-contatore' + (n > STUDIO_PAROLE_BAMBINI ? ' troppo' : '') }, t('studio.parole', { n })))));
    }
    // Le linguette: una sola aperta alla volta, o nessuna
    const schede = m.chi ? STUDIO_SCHEDE_MOMENTO : STUDIO_SCHEDE_MOMENTO.filter(s => s !== 'faccia');
    const aperta = schede.includes(studio.schedaMomento) ? studio.schedaMomento : '';
    const statoVoce = [m.audio ? t('studio.ui.voceSecondi', { secondi: secondiDi(m.audio.durata) }) : (m.chi ? t('studio.ui.senzaVoce') : ''),
      t('studio.ui.dura', { n: studioDurata(m) })].filter(Boolean).join(' · ');
    const stato = {
      faccia: nomeFaccia(m.chi, umore) + (m.umore ? '' : ' · ' + t('studio.ui.diSerie')),
      voce: statoVoce,
      azioni: [nAzioni ? t('studio.ui.nAzioni', { n: nAzioni }) : t('studio.ui.nienteAzioni'),
        m.copione && m.copione.righe.length ? t('studio.originale.n', { n: m.copione.righe.length }) : ''].filter(Boolean).join(' · ')
    };
    const fila = h('div', { class: 'studio-linguette', role: 'group', 'aria-label': t('studio.momento', { n: k + 1 }) });
    for (const s of schede) fila.append(linguetta(aperta === s, { fai: 'schedaMomento', dove: base, valore: s }, t('studio.ui.scheda.' + s), stato[s]));
    box.append(fila);
    const pannello = h('div', { class: 'studio-pannello' });
    if (aperta === 'faccia') {
      // v449: la faccia è anche l'intonazione della voce generata
      if (studioElevenImpostazioni().chiave) pannello.append(h('p', { class: 'demo-opzioni-nota' }, t('studio.el.facciaTono')));
      // Le facce: un volto per espressione, del personaggio che parla
      const facce = h('div', { class: 'studio-facce', role: 'group', 'aria-label': t('storie.espressioneEtichetta') });
      for (const e of Object.keys(S().STOR_ESPRESSIONI || {})) {
        // «Sorpresa» per la Luna, «Sorpreso» per Marte
        const nomeE = nomeFaccia(m.chi, e);
        facce.append(scelta(umore === e && !!m.umore, { class: 'studio-faccia', dataset: { fai: 'umore', dove: base, valore: e }, title: nomeE, 'aria-label': nomeE },
          figurina(m.chi, e, 34), h('span', {}, nomeE)));
      }
      facce.append(h('button', { type: 'button', class: 'studio-idea', dataset: { fai: 'umoreDalTesto', dove: base }, title: t('studio.umoreDalTesto') }, t('studio.ui.dalTesto')));
      pannello.append(facce);
    } else if (aperta === 'voce') {
      if (m.chi) pannello.append(disegnaVoce(m, base));
      if (m.chi && studioElevenImpostazioni().chiave) pannello.append(disegnaIntonazione(m, base));
      pannello.append(h('label', { class: 'studio-secondi' }, h('span', {}, t('studio.ui.quantoDura')),
        h('input', { type: 'number', min: '0', max: '120', step: m.copione ? 'any' : '1', value: String(m.durata || ''), placeholder: t('studio.auto'), dataset: { campo: base + '.durata', numero: '1' } }),
        h('small', {}, t('studio.ui.durataNota'))));
    } else if (aperta === 'azioni') {
      // Intanto: le azioni come etichette; quella aperta mostra i suoi campi
      const intanto = h('div', { class: 'studio-intanto' });
      if (!nAzioni) intanto.append(h('small', { class: 'studio-voce-stato' }, t('studio.ui.nienteAzioniAiuto')));
      (m.azioni || []).forEach((az, j) => {
        const dove = `${base}.azioni.${j}`;
        const apertaAz = studio.aperta === az.id;
        intanto.append(h('span', { class: 'studio-azione-chip' + (apertaAz ? ' aperta' : '') },
          h('button', { type: 'button', class: 'studio-azione-testo', dataset: { fai: 'apriAzione', dove: az.id }, 'aria-expanded': String(apertaAz) },
            studioDescriviAzione(az), h('small', {}, ' · ' + t('studio.quando.' + az.quando))),
          h('button', { type: 'button', class: 'studio-azione-x', dataset: { fai: 'togliAzione', dove }, 'aria-label': t('studio.togli'), title: t('studio.togli') }, '×')));
        if (apertaAz) intanto.append(disegnaAzione(az, dove, presenti, scena));
      });
      pannello.append(intanto);
      // v461: i comandi della storia pronta che lo Studio non sa scrivere
      // (la camera, le date, la musica, i versi…): restano come sono, e
      // chi non li vuole li toglie
      if (m.copione && m.copione.righe.length) {
        const orig = h('div', { class: 'studio-intanto studio-originale', role: 'group', 'aria-label': t('studio.originale.titolo') },
          h('span', { class: 'studio-etichetta' }, t('studio.originale.titolo')),
          h('small', { class: 'studio-voce-stato' }, t('studio.originale.aiuto')));
        m.copione.righe.forEach((r, j) => {
          const bersaglio = r.parametri.target ? ' · ' + nome(r.parametri.target) : '';
          orig.append(h('span', { class: 'studio-azione-chip' },
            h('span', { class: 'studio-azione-testo', title: studioRigaDsl(r) }, (t('studio.originale.comando.' + r.comando) || r.comando) + bersaglio),
            h('button', { type: 'button', class: 'studio-azione-x', dataset: { fai: 'togliRiga', dove: base, valore: String(j) }, 'aria-label': t('studio.togli'), title: t('studio.togli') }, '×')));
        });
        pannello.append(orig);
      }
      // Le idee adatte a parole e faccia
      const idee = studioIdeeAzioni(studio.progetto, scena, m);
      if (idee.length) {
        const fi = h('div', { class: 'studio-idee', role: 'group', 'aria-label': t('studio.idee') }, h('span', { class: 'studio-etichetta' }, t('studio.idee')));
        idee.forEach((a, j) => fi.append(h('button', { type: 'button', class: 'studio-idea', dataset: { fai: 'idea', dove: base, idea: String(j) } }, '+ ' + studioDescriviAzione(a))));
        pannello.append(fi);
      }
      // Aggiungi: un bottone per tipo, in quattro famiglie
      const aggiungi = h('div', { class: 'studio-aggiungi', role: 'group', 'aria-label': t('studio.ui.aggiungi') },
        h('span', { class: 'studio-etichetta' }, t('studio.ui.aggiungi')));
      for (const [fam, tipi] of Object.entries(famiglieAzioni())) {
        const vere = tipi.filter(tipo => !(scena.ambiente === 'cielo' && (tipo === 'muovi' || tipo === 'torna')));
        if (!vere.length) continue;
        aggiungi.append(h('div', { class: 'studio-famiglia', role: 'group', 'aria-label': t('studio.ui.famiglia.' + fam) },
          h('span', { class: 'studio-famiglia-nome' }, t('studio.ui.famiglia.' + fam)),
          vere.map(tipo => h('button', { type: 'button', class: 'studio-tipo', dataset: { fai: 'aggiungiTipo', dove: base, tipo } }, '+ ' + t('studio.tipo.' + tipo)))));
      }
      pannello.append(aggiungi);
    }
    if (aperta) box.append(pannello);
    return box;
  }

  // La voce della battuta: carica un file, ascoltalo, toglilo. Accanto, quanto
  // dura e quanto dura il momento per lei; o l'avviso se il testo è cambiato.
  function disegnaVoce(m, base) {
    const id = 'studio-voce-' + base.replace(/\./g, '-');
    const riga = h('div', { class: 'studio-voce', role: 'group', 'aria-label': t('studio.voce.titolo') },
      h('span', { class: 'studio-etichetta' }, t('studio.voce.titolo')),
      h('label', { class: 'tasto-cielo studio-mini-testo', for: id, title: t('studio.voce.aiuto') }, m.audio ? t('studio.voce.cambia') : t('studio.voce.carica')),
      h('input', { id, class: 'demo-file-nascosto', type: 'file', accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.opus,.webm', dataset: { voce: base } }));
    // v441: o registrata qui col microfono; il tasto diventa «Ferma» mentre registra
    if (puoRegistrare()) {
      const qui = registrazione && registrazione.dove === base;
      riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo' + (qui ? ' studio-registra-attivo' : ''), title: t('studio.voce.registraAiuto'),
        'aria-pressed': qui ? 'true' : 'false', dataset: { fai: 'registraVoce', dove: base } },
        qui ? t('studio.voce.ferma', { secondi: Math.floor((Date.now() - registrazione.inizio) / 1000) }) : t('studio.voce.registra')));
    }
    // v444: o generata con ElevenLabs, con la voce scelta per il personaggio
    const el = studioElevenImpostazioni().chiave;
    const voce = el && m.chi ? studioVoceDi(studio.progetto, m.chi, scenaDi(base)) : null;
    if (el && m.chi) {
      riga.append(tastoLavoro('voce|' + m.id, { fai: 'elGeneraVoce', dove: base },
        voce ? t('studio.el.generaCon', { voce: voce.nome || voce.id }) : t('studio.el.scegliPrima'),
        voce ? t('studio.el.generaAiuto', { voce: voce.nome, testo: studioTestoPerVoce(m, studioElevenImpostazioni().modello, studio.progetto) }) : ''));
    }
    if (m.audio) {
      const valida = studioVoceValida(m);
      riga.append(
        h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'ascoltaVoce', dove: base } }, t('studio.voce.ascolta')),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'togliVoce', dove: base } }, t('studio.voce.togli')),
        h('small', { class: 'studio-voce-stato' + (valida ? '' : ' troppo') }, valida
          ? t('studio.voce.pronta', { secondi: secondiDi(m.audio.durata), durata: studioDurata(m) })
          : t('studio.voce.vecchia')));
    }
    // v445: generata con una voce che non è più quella del personaggio qui
    if (m.audio && voce && m.audio.voce && m.audio.voce !== voce.id && studioVoceValida(m))
      riga.append(h('small', { class: 'studio-voce-stato troppo' }, t('studio.el.altraVoce')));
    // v449: o con un'intonazione che non è più quella (faccia o tono cambiati)
    else if (m.audio && studioVoceValida(m) && studioTonoCambiato(studio.progetto, m))
      riga.append(h('small', { class: 'studio-voce-stato troppo' }, t('studio.el.altroTono')));
    const pr = rigaProposta('voce|' + m.id, 'voce', base, 'elGeneraVoce');
    if (pr) riga.append(pr);
    const nota = notaEl('voce|' + m.id);
    if (nota) riga.append(nota);
    // la scelta della voce, aperta da questa battuta
    if (studio.elScelta && studio.elScelta.luogo === 'voce|' + m.id) riga.append(disegnaScelta(studio.elScelta));
    return riga;
  }

  /* L'intonazione della battuta per ElevenLabs (v449): la faccia che il
   * personaggio ha mentre parla (si cambia nella linguetta «Faccia»), il
   * tono scelto qui (al massimo due) e, sotto, il testo esatto che parte,
   * coi tag. Prima il testo inviato stava solo nel suggerimento del tasto
   * «Genera», e chi scriveva non sapeva con che emozione sarebbe uscita. */
  function disegnaIntonazione(m, base) {
    const p = studio.progetto, imp = studioElevenImpostazioni();
    const faccia = studioFacciaParlata(p, m);
    const tagFaccia = ELEVEN_TAG_UMORE[faccia];
    const blocco = h('div', { class: 'studio-intonazione', role: 'group', 'aria-label': t('studio.el.intonazione') },
      h('span', { class: 'studio-etichetta' }, t('studio.el.intonazione')));
    blocco.append(h('div', { class: 'studio-tono-faccia' },
      figurina(m.chi, faccia, 26),
      h('span', {}, t('studio.el.tonoFaccia', { faccia: nomeFaccia(m.chi, faccia) }),
        h('small', {}, ' · ' + (tagFaccia ? '[' + tagFaccia + ']' : t('studio.el.senzaTag')) + (m.umore ? '' : ' · ' + t('studio.el.facciaDaPrima'))))));
    const toni = h('div', { class: 'studio-toni', role: 'group', 'aria-label': t('studio.el.tono') },
      h('small', { class: 'studio-tono-titolo' }, t('studio.el.tono', { n: STUDIO_TONI_MAX })));
    const scelti = m.tono || [];
    for (const x of STUDIO_TONI)
      toni.append(scelta(scelti.includes(x), { class: 'studio-tono', dataset: { fai: 'tono', dove: base, valore: x }, title: '[' + x + ']' }, t('studio.el.toni.' + x)));
    blocco.append(toni);
    const v3 = /^eleven_v3/.test(imp.modello);
    blocco.append(v3
      ? h('small', { class: 'studio-tono-invio' }, t('studio.el.testoInviato'), ' ', h('code', {}, studioTestoPerVoce(m, imp.modello, p)))
      : h('small', { class: 'studio-voce-stato troppo' }, t('studio.el.tonoSoloV3')));
    return blocco;
  }

  /* Le voci di una scena (v445): chi parla in questa scena, con la voce
   * della storia o una sua solo per qui. «Cambia solo qui» apre la scelta
   * nella scena; «Come nella storia» toglie quella della scena. */
  function disegnaVociScena(sc, base) {
    const p = studio.progetto;
    if (!studioElevenImpostazioni().chiave) return null;
    const parlano = [...new Set(sc.momenti.filter(m => m.chi && testoDetto(m)).map(m => m.chi))].filter(id => p.cast.includes(id));
    if (!parlano.length) return null;
    const blocco = h('div', { class: 'studio-voci-scena', role: 'group', 'aria-label': t('studio.el.vociScena') },
      h('span', { class: 'studio-etichetta' }, t('studio.el.vociScena')));
    for (const id of parlano) {
      const luogo = 'sc|' + sc.id + '|' + id;
      const sua = sc.voci && sc.voci[id];
      const voce = studioVoceDi(p, id, sc);
      const mancano = sc.momenti.filter(m => m.chi === id && studioVoceDaRifare(p, sc, m)).length;
      const riga = h('div', { class: 'studio-voce-pg studio-voce-scena' },
        figurina(id, '', 26),
        h('span', { class: 'studio-voce-pg-nome' }, h('strong', {}, nome(id))),
        h('span', { class: 'studio-voce-pg-scelta' + (voce ? '' : ' vuota') },
          voce ? t(sua ? 'studio.el.soloQui' : 'studio.el.dellaStoria', { voce: voce.nome || voce.id }) : t('studio.el.nessunaVoce')));
      if (voce && voce.anteprima) riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elAscoltaPg', id, dove: base } }, t('studio.el.anteprima')));
      riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elScegliScena', id, dove: base },
        'aria-expanded': String(!!(studio.elScelta && studio.elScelta.luogo === luogo)) }, t(voce ? 'studio.el.cambiaQui' : 'studio.el.scegliQui')));
      if (sua) riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elTornaStoria', id, dove: base } }, t('studio.el.comeStoria')));
      if (voce && mancano) riga.append(tastoLavoro(luogo, { fai: 'elMancantiScena', id, dove: base }, t('studio.el.mancanti', { n: mancano })));
      blocco.append(riga);
      const nota = notaEl(luogo);
      if (nota) blocco.append(nota);
      if (studio.elScelta && studio.elScelta.luogo === luogo) blocco.append(disegnaScelta(studio.elScelta));
    }
    return blocco;
  }

  /* I pezzi dell'interfaccia di ElevenLabs (v444, §6c). Un tasto che
   * lavora: mentre ElevenLabs risponde dice «Genero…» ed è spento. */
  function tastoLavoro(k, dati, testo, titolo) {
    const qui = elInCorso === k;
    return h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo studio-el-tasto', dataset: dati, title: titolo || null,
      disabled: !!elInCorso, 'aria-busy': qui ? 'true' : null }, qui ? t('studio.el.inCorso') : testo);
  }
  // La proposta: ascoltala, usala, rifalla, scartala
  function rigaProposta(k, tipo, dove, rifai) {
    if (!proposte.has(k)) return null;
    return h('span', { class: 'studio-el-proposta', role: 'group', 'aria-label': t('studio.el.proposta') },
      h('small', { class: 'studio-etichetta' }, t('studio.el.proposta')),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elAscoltaProposta', dove: k } }, t('studio.voce.ascolta')),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo studio-el-usa', dataset: { fai: 'elUsa', dove, valore: tipo } }, t('studio.el.usa')),
      tastoLavoro('rifai|' + k, { fai: rifai, dove }, t('studio.el.rifai')),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elScarta', dove: k } }, t('studio.el.scarta')));
  }
  // L'azione «Suono»: sintetizzato o da file, il volume, e la richiesta a ElevenLabs
  function disegnaSuono(az, base, riga) {
    const p = base + '.';
    const opzioni = (S().STOR_SUONI || []).map(x => ['sint:' + x, t('studio.suono.nome.' + x) || x]);
    if (az.file) opzioni.unshift(['file', t('studio.musica.file', { nome: az.file.nome || az.file.est })]);
    riga.append(selettore('', az.fonte === 'file' && az.file ? 'file' : 'sint:' + az.suono, opzioni, { dataset: { suonoScelta: base }, 'aria-label': t('studio.tipo.suono') }));
    riga.append(selettore(p + 'volume', String(az.volume || 1), [['0.5', t('studio.suono.piano')], ['1', t('studio.suono.normale')], ['1.6', t('studio.suono.forte')]], { 'aria-label': t('studio.musica.volume') }));
    riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'ascoltaSuono', dove: base } }, t('studio.voce.ascolta')));
    const id = 'studio-suono-' + base.replace(/\./g, '-');
    riga.append(h('label', { class: 'tasto-cielo studio-mini-testo', for: id, title: t('studio.suono.aiuto') }, t('studio.musica.carica')),
      h('input', { id, class: 'demo-file-nascosto', type: 'file', accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.opus,.webm', dataset: { suono: base } }));
    if (az.file) riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'togliSuono', dove: base } }, t('studio.suono.togli')));
    riga.append(selettore(p + 'quando', az.quando, opzioniQuando(), { 'aria-label': t('studio.quando') }));
    // ElevenLabs: una descrizione e (facoltativa) la durata
    if (studioElevenImpostazioni().chiave) {
      const descr = h('input', { type: 'text', maxlength: '300', value: az.richiesta || '', dataset: { campo: p + 'richiesta' },
        placeholder: t('studio.el.suonoAiuto'), 'aria-label': t('studio.el.suonoDescrizione'), class: 'studio-el-richiesta' });
      const genera = h('div', { class: 'studio-el-riga' },
        h('span', { class: 'studio-etichetta' }, t('studio.el.conEleven')), descr,
        h('label', { class: 'studio-secondi' }, h('span', {}, t('studio.durata')),
          h('input', { type: 'number', min: '0', max: '30', step: '0.5', value: az.secondi ? String(az.secondi) : '', placeholder: t('studio.auto'), dataset: { campo: p + 'secondi', numero: '1' } })),
        tastoLavoro('suono|' + az.id, { fai: 'elSuono', dove: base }, t('studio.el.genera')));
      const pr = rigaProposta('suono|' + az.id, 'suono', base, 'elSuono');
      if (pr) genera.append(pr);
      riga.append(genera);
    } else riga.append(h('small', { class: 'demo-opzioni-nota' }, t('studio.el.suonoSenzaChiave')));
    riga.append(h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'apriAzione', dove: '' } }, t('studio.ui.fatto')));
    return riga;
  }
  // La musica generata: descrizione, durata, «Genera» e la proposta
  function disegnaMusicaEleven(dove) {
    if (!studioElevenImpostazioni().chiave) return null;
    const k = chiaveMusicaEl(dove);
    const r = richiestaMusica(k);
    const riga = h('div', { class: 'studio-el-riga' },
      h('span', { class: 'studio-etichetta' }, t('studio.el.conEleven')),
      h('input', { type: 'text', maxlength: '400', value: r.testo, class: 'studio-el-richiesta', dataset: { elMusica: dove, elCampo: 'testo' },
        placeholder: t('studio.el.musicaAiuto'), 'aria-label': t('studio.el.musicaDescrizione') }),
      h('label', { class: 'studio-secondi' }, h('span', {}, t('studio.el.secondi')),
        h('input', { type: 'number', min: '10', max: '300', step: '5', value: String(r.secondi), dataset: { elMusica: dove, elCampo: 'secondi' } })),
      tastoLavoro(k, { fai: 'elMusica', dove }, t('studio.el.genera')));
    const pr = rigaProposta(k, 'musica', dove, 'elMusica');
    if (pr) riga.append(pr);
    return riga;
  }
  // Il pannello della chiave (Impostazioni → ElevenLabs)
  function pannelloEleven() {
    const imp = studioElevenImpostazioni();
    return h('div', { id: 'studio-eleven', class: 'studio-repo' },
      h('p', { class: 'demo-opzioni-nota' }, t('studio.el.aiuto')),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.el.chiave')),
        h('input', { id: 'studio-el-chiave', type: 'password', value: imp.chiave, autocomplete: 'off', placeholder: 'sk_…' })),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.el.chiaveAiuto')),
      h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.el.modello')),
          selettore('', imp.modello, ELEVEN_MODELLI.map(x => [x, t('studio.el.modelli.' + x)]), { id: 'studio-el-modello' })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.el.stabilita')),
          selettore('', String(imp.stabilita), ELEVEN_STABILITA.map(x => [String(x), t('studio.el.stabilitaN.' + String(x).replace('.', '_'))]), { id: 'studio-el-stabilita' }))),
      studio.elCrediti ? h('p', { class: 'demo-opzioni-nota', role: 'status' }, studio.elCrediti) : null,
      h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'elSalva' } }, t('studio.el.salva')),
        imp.chiave ? h('button', { type: 'button', class: 'tasto-cielo studio-pericolo', dataset: { fai: 'elDimentica' } }, t('studio.el.dimentica')) : null));
  }
  /* Le voci dei personaggi (passo 2): una riga per chi è nel cast, con la
   * voce scelta, l'anteprima, «Scegli la voce» e «Genera le battute
   * mancanti»; sotto la riga aperta, il pannello della scelta. */
  function disegnaVociPersonaggi(p) {
    const chiave = !!studioElevenImpostazioni().chiave;
    const blocco = h('div', { class: 'studio-voci-pg', id: 'studio-voci-pg' },
      h('h5', { class: 'studio-gruppo-titolo' }, t('studio.el.vociTitolo')),
      h('p', { class: 'demo-opzioni-nota' }, chiave ? t('studio.el.vociAiuto') : t('studio.el.vociSenzaChiave')));
    if (!chiave) {
      blocco.append(h('div', { class: 'demo-azioni' }, h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'elPannello' } }, t('studio.el.collega'))));
      return blocco;
    }
    for (const id of p.cast) {
      const prof = S().profilo ? S().profilo(id) : {};
      const voce = studioVoceDi(p, id);
      const battute = p.scene.flatMap(sc => sc.momenti).filter(m => m.chi === id && testoDetto(m));
      const mancano = p.scene.reduce((n, sc) => n + sc.momenti.filter(m => m.chi === id && studioVoceDaRifare(p, sc, m)).length, 0);
      const scenaDiversa = p.scene.filter(sc => sc.voci && sc.voci[id]).length;
      const riga = h('div', { class: 'studio-voce-pg' },
        figurina(id, '', 36),
        h('span', { class: 'studio-voce-pg-nome' }, h('strong', {}, nome(id)),
          h('small', {}, ' · ' + t('studio.ui.genere.' + (prof.genere === 'f' ? 'f' : 'm')) + ' · ' + t('studio.el.battute', { n: battute.length, mancano }))),
        h('span', { class: 'studio-voce-pg-scelta' + (voce ? '' : ' vuota') }, voce ? voce.nome || voce.id : t('studio.el.nessunaVoce'),
          scenaDiversa ? h('small', {}, ' · ' + t('studio.el.inScene', { n: scenaDiversa })) : null));
      if (voce && voce.anteprima) riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elAscoltaPg', id } }, t('studio.el.anteprima')));
      riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elScegli', id },
        'aria-expanded': String(!!(studio.elScelta && studio.elScelta.luogo === 'pg|' + id)) }, voce ? t('studio.el.cambia') : t('studio.el.scegli')));
      if (voce && mancano) riga.append(tastoLavoro('pg|' + id, { fai: 'elMancanti', id }, t('studio.el.mancanti', { n: mancano })));
      if (voce) riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elTogliVoce', id } }, t('studio.el.togliVoce')));
      blocco.append(riga);
      const nota = notaEl('pg|' + id);
      if (nota) blocco.append(nota);
      if (studio.elScelta && studio.elScelta.luogo === 'pg|' + id) blocco.append(disegnaScelta(studio.elScelta));
    }
    return blocco;
  }
  function disegnaScelta(c) {
    const filtri = h('div', { class: 'studio-riga studio-el-filtri' },
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.el.fonte')),
        selettore('', c.fonte, [['libreria', t('studio.el.libreria')], ['mie', t('studio.el.mie')]], { dataset: { elFiltro: 'fonte' } })),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.el.lingua')),
        selettore('', c.lingua, [['it', t('studio.el.lingue.it')], ['en', t('studio.el.lingue.en')], ['', t('studio.el.lingue.tutte')]], { dataset: { elFiltro: 'lingua' } })),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.el.genere')),
        selettore('', c.genere, [['m', t('studio.el.maschile')], ['f', t('studio.el.femminile')], ['', t('studio.el.tutti')]], { dataset: { elFiltro: 'genere' } })),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.el.cerca')),
        h('input', { type: 'search', value: c.cerca, dataset: { elCerca: '1' }, placeholder: t('studio.el.cercaAiuto') })),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'elCerca' } }, t('studio.el.cercaTasto')),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'elChiudi' } }, t('studio.el.chiudi')));
    const elenco = h('ul', { class: 'studio-el-voci', 'aria-busy': c.caricando ? 'true' : 'false' });
    c.voci.forEach((v, i) => {
      const dettagli = [v.genere ? t(v.genere === 'f' ? 'studio.el.femminile' : 'studio.el.maschile') : '', v.eta, v.accento,
        v.lingue.length ? v.lingue.join(', ') : ''].filter(Boolean).join(' · ');
      elenco.append(h('li', { class: 'studio-el-voce' },
        h('span', { class: 'studio-el-voce-testo' }, h('strong', {}, v.nome), h('small', {}, dettagli), v.descrizione ? h('small', { class: 'studio-el-descr' }, v.descrizione) : null),
        h('span', { class: 'studio-el-voce-tasti' },
          v.anteprima ? h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'elAnteprima', dove: String(i) } }, t('studio.el.anteprima')) : null,
          tastoLavoro('prova|' + v.id, { fai: 'elProva', dove: String(i) }, t('studio.el.prova'), t('studio.el.provaAiuto')),
          tastoLavoro('scegli|' + v.id, { fai: 'elScegliVoce', dove: String(i) }, t('studio.el.questa')))));
    });
    const scena = c.scena ? studio.progetto.scene.findIndex(x => x.id === c.scena) : -1;
    // Per chi vale: da una battuta si sceglie; dalla scena vale lì, dal passo 2 per tutta la storia
    const ambito = c.ambitoLibero && scena >= 0
      ? h('label', { class: 'storie-campo studio-el-ambito' }, h('span', {}, t('studio.el.valePer')),
        selettore('', c.ambito, [['', t('studio.el.valeStoria')], [c.scena, t('studio.el.valeScena', { n: scena + 1 })]], { dataset: { elAmbito: '1' } }))
      : h('p', { class: 'demo-opzioni-nota' }, c.ambito && scena >= 0 ? t('studio.el.valeScenaNota', { n: scena + 1 }) : t('studio.el.valeStoriaNota'));
    return h('div', { class: 'studio-el-scelta', role: 'region', 'aria-label': t('studio.el.sceltaPer', { nome: nome(c.pg) }) },
      h('p', { class: 'demo-opzioni-nota' }, t('studio.el.sceltaPer', { nome: nome(c.pg) }) + ' ' + t('studio.el.sceltaAiuto')),
      ambito,
      filtri,
      c.errore ? h('p', { class: 'studio-avviso', role: 'alert' }, c.errore) : null,
      c.nota ? h('p', { class: 'studio-el-nota', role: 'status' }, c.nota) : null,
      c.caricando ? h('p', { class: 'demo-opzioni-nota' }, t('studio.el.carico')) : !c.voci.length && !c.errore ? h('p', { class: 'demo-opzioni-nota' }, t('studio.el.nessunaTrovata')) : null,
      elenco,
      c.ancora && !c.caricando ? h('div', { class: 'demo-azioni' }, h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'elAltre' } }, t('studio.el.altre'))) : null);
  }

  /* La musica di sottofondo (v440, §4-ter): per tutta la storia (`storia`)
   * o per una scena (`scene.<i>`). Un menu (nessuna, quella della storia, il
   * silenzio, le tracce dell'app, il file caricato), «Carica un file»,
   * «Ascolta», il volume e «Togli». */
  function disegnaMusica(dove) {
    const p = studio.progetto, di = musicaDi(dove);
    if (!di) return null;
    const scena = !!di.sid, sc = scena ? di.tiene : null;
    const id = 'studio-musica-' + dove.replace(/\./g, '-');
    const tracce = (Array.isArray(radice.ASTRO_TRACCE_MUSICALI) ? radice.ASTRO_TRACCE_MUSICALI : [])
      .filter(x => x && typeof x.id === 'string' && typeof x.file === 'string');
    const opzioni = scena
      ? [['storia', p.musica ? t('studio.musica.dellaStoria') : t('studio.musica.dellaStoriaNessuna')], ['silenzio', t('studio.musica.silenzio')]]
      : [['', t('studio.musica.nessuna')]];
    for (const tr of tracce) opzioni.push(['cat:' + tr.id, t('studio.musica.traccia', { nome: String(tr.nome || tr.id).replace(/_/g, ' ') })]);
    if (di.mu && di.mu.tipo === 'file') opzioni.push(['file', t('studio.musica.file', { nome: di.mu.nome || di.mu.est })]);
    let valore = '';
    if (scena && sc.musicaModo !== 'propria') valore = sc.musicaModo;
    else if (di.mu) valore = di.mu.tipo === 'file' ? 'file' : 'cat:' + di.mu.id;
    else valore = scena ? 'storia' : '';
    const propria = di.mu && (!scena || sc.musicaModo === 'propria');
    const riga = h('div', { class: 'studio-voce studio-musica', role: 'group', 'aria-label': t(scena ? 'studio.musica.scena' : 'studio.musica.titolo') },
      h('span', { class: 'studio-etichetta' }, t(scena ? 'studio.musica.scena' : 'studio.musica.titolo')),
      selettore('', valore, opzioni, { dataset: { musicaScelta: dove }, 'aria-label': t(scena ? 'studio.musica.scena' : 'studio.musica.titolo') }),
      h('label', { class: 'tasto-cielo studio-mini-testo', for: id, title: t('studio.musica.aiuto') }, t('studio.musica.carica')),
      h('input', { id, class: 'demo-file-nascosto', type: 'file', accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.opus,.webm', dataset: { musica: dove } }));
    if (propria) {
      const inAscolto = ascoltoMusica && ascoltoMusica.dove === dove;
      riga.append(
        h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'ascoltaMusica', dove }, 'aria-pressed': String(!!inAscolto) },
          t(inAscolto ? 'studio.musica.ferma' : 'studio.voce.ascolta')),
        h('label', { class: 'storie-campo studio-musica-volume' }, h('span', {}, t('studio.musica.volume')),
          h('input', { type: 'range', min: '5', max: '100', step: '5', value: String(Math.round(di.mu.volume * 100)), dataset: { musicaVolume: dove } })),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'togliMusica', dove } }, t('studio.musica.togli')));
      if (di.mu.tipo === 'file' && di.mu.durata) riga.append(h('small', { class: 'studio-voce-stato' }, t('studio.musica.durata', { secondi: secondiDi(di.mu.durata) })));
    }
    // v444: o generata con ElevenLabs da una descrizione (non per una scena in silenzio)
    if (!scena || sc.musicaModo !== 'silenzio') { const el = disegnaMusicaEleven(dove); if (el) riga.append(el); }
    return riga;
  }
  const sceneAperte = new Set();
  /* La scena aperta (v446): in cima il titolo coi tasti (prova, sposta,
   * togli), poi quattro linguette che dicono com'è la scena — dove, chi
   * c'è, camera e data, musica e voci — e se ne apre una sola alla volta;
   * sotto, i momenti. Prima era tutto aperto insieme: cinque ambienti, il
   * cast, la musica, le voci e l'inquadratura prima ancora della prima
   * battuta. Si chiudono tutte di serie: il riassunto basta quasi sempre. */
  const schedeScena = new Map();
  // v447: le linguette dei passi 1 e 2, per progetto
  const schedeIdea = new Map(), schedeCast = new Map();
  const STUDIO_SCHEDE_SCENA = ['dove', 'chi', 'camera', 'suoni'];

  function disegnaScena(sc, i) {
    const base = `scene.${i}`;
    const presenti = studioPresenti(studio.progetto, sc);
    const chiave = studio.progetto.id + '|' + sc.id;
    const cosmo = sc.ambiente === 'cosmo';
    const card = h('div', { class: 'studio-scena-corpo' });
    const sezione = h('details', { class: 'studio-scena', open: sceneAperte.has(chiave), dataset: { scenaChiave: chiave } },
      h('summary', { class: 'studio-scena-riassunto' },
        h('span', { class: 'studio-scena-titolo' }, t('studio.scena', { n: i + 1 })),
        h('small', {}, t('studio.ambiente.' + sc.ambiente) + ' · ' + t('studio.ui.nMomenti', { n: sc.momenti.length }))), card);
    card.append(h('div', { class: 'studio-scena-testa' },
      h('div', { class: 'studio-strumenti' },
        h('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { fai: 'provaScena', dove: base }, 'data-storia-prova': '' }, iconaSvg('gioca', 16), ' ', t('studio.provaScena')),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'su', dove: base }, 'aria-label': t('studio.su'), title: t('studio.su') }, '↑'),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'giu', dove: base }, 'aria-label': t('studio.giu'), title: t('studio.giu') }, '↓'),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini studio-x', dataset: { fai: 'togliScena', dove: base }, 'aria-label': t('studio.togli'), title: t('studio.togli') }, '×'))));

    // Le linguette, ognuna con lo stato in piccolo
    const aperta = schedeScena.get(chiave) || '';
    const dove = t('studio.ambiente.' + sc.ambiente) + (sc.ambiente === 'pianeta' && STUDIO_FUOCHI_3D.includes(sc.fuoco) ? ' · ' + nome(sc.fuoco)
      : sc.ambiente === 'cielo' && sc.fuoco ? ' · ' + nome(sc.fuoco) : '');
    const volti = h('span', { class: 'studio-linguetta-volti', 'aria-hidden': 'true' }, presenti.slice(0, 5).map(id => figurina(id, '', 20)),
      presenti.length > 5 ? h('small', {}, '+' + (presenti.length - 5)) : null);
    const musica = sc.musicaModo === 'silenzio' ? t('studio.musica.silenzio')
      : sc.musicaModo === 'propria' && sc.musica ? t('studio.ui.musicaSua')
        : studio.progetto.musica ? t('studio.ui.musicaStoria') : t('studio.ui.musicaNessuna');
    const fila = h('div', { class: 'studio-linguette studio-linguette-scena', role: 'group', 'aria-label': t('studio.scena', { n: i + 1 }) });
    const stato = { dove, chi: t('studio.ui.nInScena', { n: presenti.length }), camera: riassuntoScena(sc), suoni: musica };
    for (const s of STUDIO_SCHEDE_SCENA) {
      const nomeS = s === 'camera' && cosmo ? t('studio.ui.data') : t('studio.ui.scheda.' + s);
      const l = linguetta(aperta === s, { fai: 'schedaScena', dove: base, valore: s }, nomeS, stato[s]);
      if (s === 'chi') l.querySelector('small').prepend(volti);
      fila.append(l);
    }
    card.append(fila);
    const pannello = h('div', { class: 'studio-pannello' });
    if (aperta === 'dove') {
      // Dove siamo: un bottone per ambiente
      const ambienti = h('div', { class: 'studio-ambienti', role: 'group', 'aria-label': t('studio.ambiente') });
      for (const a of STUDIO_AMBIENTI)
        ambienti.append(scelta(sc.ambiente === a, { class: 'studio-ambiente', dataset: { fai: 'ambiente', dove: base, valore: a } }, t('studio.ambiente.' + a)));
      // Quale pianeta (v442): accanto all'ambiente, perché è lui a fare la
      // differenza fra «Vicino a un pianeta» e il Sistema Solare intero
      const quale = sc.ambiente === 'pianeta' ? h('label', { class: 'storie-campo' }, h('span', {}, t('studio.qualePianeta')),
        selettore(base + '.fuoco', STUDIO_FUOCHI_3D.includes(sc.fuoco) ? sc.fuoco : STUDIO_FUOCHI_3D[0], STUDIO_FUOCHI_3D.map(f => [f, nome(f)]))) : null;
      const cielo = sc.ambiente === 'cielo' ? h('label', { class: 'storie-campo' }, h('span', {}, t('studio.fuoco')),
        selettore(base + '.fuoco', STUDIO_FUOCHI_CIELO.includes(sc.fuoco) ? sc.fuoco : STUDIO_FUOCHI_CIELO[0], STUDIO_FUOCHI_CIELO.map(f => [f, nome(f)]))) : null;
      pannello.append(ambienti, h('small', { class: 'studio-viaggio-nota studio-ambiente-nota' }, t('studio.ambienteNota.' + sc.ambiente)));
      if (quale || cielo) pannello.append(quale || cielo);
      // Nell'universo: da quale tappa a quale va la camera, in tutta la scena
      if (cosmo) {
        const tappe = Object.keys(STUDIO_TAPPE_COSMO).map(k => [k, nomeLuogo(k)]);
        pannello.append(h('div', { class: 'studio-viaggio' },
          h('span', { class: 'studio-etichetta' }, t('studio.ui.viaggio')),
          h('label', { class: 'storie-campo' }, h('span', {}, t('studio.ui.da')), selettore(base + '.cosmoDa', sc.cosmoDa, tappe)),
          h('span', { class: 'studio-freccia', 'aria-hidden': 'true' }, '→'),
          h('label', { class: 'storie-campo' }, h('span', {}, t('studio.ui.a')), selettore(base + '.cosmoA', sc.cosmoA, tappe)),
          h('small', { class: 'studio-viaggio-nota' }, t('studio.ui.viaggioNota'))));
      }
      pannello.append(h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'ambienteAdatto', dove: base } }, t('studio.ambienteAdatto'))));
    } else if (aperta === 'chi') {
      // Chi c'è: le figurine del cast, da accendere e spegnere
      const chips = h('div', { class: 'studio-chips', role: 'group', 'aria-label': t('studio.inScena') });
      for (const id of studio.progetto.cast) {
        const acceso = presenti.includes(id);
        chips.append(scelta(acceso, { class: 'studio-chip', dataset: { fai: 'presente', dove: base, id } }, figurina(id, '', 22), nome(id)));
      }
      pannello.append(h('small', { class: 'studio-viaggio-nota' }, t('studio.ui.inScenaNota')), chips);
    } else if (aperta === 'camera') {
      pannello.append(h('div', { class: 'studio-riga' },
        cosmo ? null : h('label', { class: 'storie-campo' }, h('span', {}, t('studio.inquadratura')),
          selettore(base + '.zoom', sc.zoom, Object.keys(STUDIO_ZOOM).map(z => [z, t('studio.zoom.' + z)]))),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.camera')),
          selettore(base + '.camera', studioCameraDi(sc), STUDIO_CAMERE.map(c => [c, t('studio.camera.' + c)]))),
        (studioCameraDi(sc) === 'vicino' || studioCameraDi(sc) === 'giro') ? h('label', { class: 'storie-campo' }, h('span', {}, t('studio.cameraChi')),
          selettore(base + '.cameraChi', presenti.includes(sc.cameraChi) ? sc.cameraChi : '',
            (studioCameraDi(sc) === 'giro' ? [['', t('studio.cameraChi.parla')]] : [['', t('studio.cameraChi.primo')]])
              .concat(presenti.map(id => [id, nome(id)])))) : null),
        h('div', { class: 'studio-riga' },
          h('label', { class: 'storie-campo' }, h('span', {}, t('studio.giorno')), h('input', { type: 'date', value: sc.data, dataset: { campo: base + '.data' } })),
          h('label', { class: 'storie-campo studio-corto' }, h('span', {}, t('studio.ora')), h('input', { type: 'time', value: sc.ora, dataset: { campo: base + '.ora' } })),
          cosmo ? null : h('label', { class: 'storie-campo studio-corto' }, h('span', {}, t('studio.giorni')),
            h('input', { type: 'number', min: '0', max: '1000', step: '1', value: String(sc.giorni || 0), dataset: { campo: base + '.giorni', numero: '1' } })),
          h('label', { class: 'storie-campo studio-spunta' }, h('input', { type: 'checkbox', checked: !!sc.cartello, dataset: { campo: base + '.cartello' } }),
            h('span', {}, t('studio.mostraCartello')))));
    } else if (aperta === 'suoni') {
      const mu = disegnaMusica(base);
      if (mu) pannello.append(mu);
      // v445: le voci ElevenLabs di chi parla qui, anche diverse da quelle della storia
      const vociScena = disegnaVociScena(sc, base);
      if (vociScena) pannello.append(vociScena);
    }
    if (aperta) card.append(pannello);

    // I momenti, uno dopo l'altro
    card.append(h('h5', { class: 'studio-gruppo-titolo studio-momenti-titolo' }, t('studio.ui.momenti', { n: sc.momenti.length }),
      h('small', { class: 'studio-conta' }, ' · ' + t('studio.ui.momentiAiuto'))));
    const momenti = h('div', { class: 'studio-momenti' });
    sc.momenti.forEach((m, k) => momenti.append(disegnaMomento(m, i, k, sc)));
    card.append(momenti);
    // In fondo alla scena: una battuta nuova, il suggerimento, e «scrivi a parole»
    const parole = h('input', { type: 'text', class: 'studio-parole', dataset: { parole: base }, placeholder: t(cosmo ? 'studio.ui.paroleAiutoCosmo' : 'studio.paroleAiuto'), 'aria-label': t('studio.passo4'),
      value: studio.paroleResto && studio.paroleResto.dove === base ? studio.paroleResto.testo : undefined });
    const capito = h('ul', { class: 'studio-capito', 'aria-live': 'polite' });
    if (studio.capito && studio.capitoScena === i) {
      for (const o of studio.capito.ops) capito.append(h('li', { class: 'ok' }, o.op === 'battuta' ? t('studio.capitoBattuta', { chi: nome(o.chi), testo: o.testo }) : studioDescriviAzione(o.azione)));
      for (const f of studio.capito.nonCapite) capito.append(h('li', { class: 'no' }, t('studio.nonCapito', { frase: f })));
    }
    card.append(h('div', { class: 'studio-piede' },
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovoMomento', dove: base } }, '+ ' + t('studio.aggiungiMomento')),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'prossimoMomento', dove: base } }, t('studio.prossimoMomento'))),
      h('div', { class: 'studio-a-parole' },
        h('span', { class: 'studio-etichetta' }, t('studio.passo4')), parole,
        h('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { fai: 'capisci', dove: base } }, t('studio.fallo'))),
      capito);
    return sezione;
  }
  // «Normale · 13 dic 2026, 18:30 · 11 giorni»: la riga della scena chiusa
  function riassuntoScena(sc) {
    const pezzi = sc.ambiente === 'cosmo' ? [] : [t('studio.zoom.' + sc.zoom)];
    if (sc.data) {
      try {
        const loc = haI18n() && radice.astroI18n.locale ? radice.astroI18n.locale() : 'it-IT';
        pezzi.push(new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(sc.data + 'T12:00:00')) + ', ' + sc.ora);
      } catch (_) { pezzi.push(sc.data); }
    } else pezzi.push(t('studio.ui.oggi'));
    if (sc.giorni > 0 && sc.ambiente !== 'cosmo') pezzi.push(t('studio.ui.giorniPassano', { n: sc.giorni }));
    if (sc.cartello) pezzi.push(t('studio.ui.conCartello'));
    const camera = studioCameraDi(sc);
    if (camera !== 'auto') pezzi.push(t('studio.ui.camera.' + camera));
    return pezzi.join(' · ');
  }

  // Le impostazioni del repository (§6b): dove, quale ramo, il token
  function pannelloRepo() {
    const imp = studioRepoImpostazioni();
    return h('div', { id: 'studio-repo', class: 'studio-repo' },
      h('p', { class: 'demo-opzioni-nota' }, t('studio.repo.aiuto')),
      h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.repo.repository')),
          h('input', { id: 'studio-repo-nome', type: 'text', value: imp.repo, autocomplete: 'off', spellcheck: 'false' })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.repo.ramo')),
          h('input', { id: 'studio-repo-ramo', type: 'text', value: imp.ramo, autocomplete: 'off', spellcheck: 'false' }))),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.repo.token')),
        h('input', { id: 'studio-repo-token', type: 'password', value: imp.token, autocomplete: 'off', placeholder: 'github_pat_…' })),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.repo.tokenAiuto')),
      h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'repoSalva' } }, t('studio.repo.salva')),
        imp.token ? h('button', { type: 'button', class: 'tasto-cielo studio-pericolo', dataset: { fai: 'repoDimentica' } }, t('studio.repo.dimentica')) : null));
  }

  /* Le impostazioni dello Studio (v449), in un pannello a parte sotto la
   * barra. Prima stavano in «Altro», un menu a tendina con dieci tasti
   * uguali in fila — Duplica, Esporta, Importa, il copione, il file delle
   * voci, il repository, Sincronizza, ElevenLabs, Elimina — e chi cercava
   * «come porto la storia sull'altro computer» non capiva quale premere.
   * Ora sono tre linguette, ognuna con lo stato in piccolo: **Questa
   * storia** (i file: esporta, importa, duplica, copione, voci; in fondo,
   * a parte, elimina), **Sincronizza** (il repository: a che punto è,
   * «Sincronizza ora», le chiavi) ed **ElevenLabs** (la chiave, il modello,
   * i crediti). Ogni tasto ha accanto una riga che dice cosa fa. */
  const STUDIO_SCHEDE_IMP = ['storia', 'repo', 'el'];
  function apriImpostazioni(scheda) {
    studio.impAperto = true;
    studio.impScheda = STUDIO_SCHEDE_IMP.includes(scheda) ? scheda : studio.impScheda;
    disegna();
    const pannello = studio.radice && studio.radice.querySelector('#studio-impostazioni');
    if (pannello && pannello.scrollIntoView) { try { pannello.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) { /* vecchi browser */ } }
  }
  function voceImp(tasto, testo, extra) {
    return h('div', { class: 'studio-imp-voce' }, tasto, h('small', {}, testo), extra || null);
  }
  function pannelloImpostazioni(p) {
    const repo = studioRepoImpostazioni(), el = studioElevenImpostazioni();
    const scheda = STUDIO_SCHEDE_IMP.includes(studio.impScheda) ? studio.impScheda : 'storia';
    const stato = {
      storia: unaRiga(p.titolo) || t('studio.senzaTitolo'),
      repo: repo.token ? t('studio.imp.repoScrive') : t('studio.imp.repoLegge'),
      el: el.chiave ? t('studio.imp.elCollegato') : t('studio.imp.elDaCollegare')
    };
    const fila = h('div', { class: 'studio-linguette studio-linguette-imp', role: 'group', 'aria-label': t('studio.imp.titolo') });
    for (const x of STUDIO_SCHEDE_IMP) fila.append(linguetta(scheda === x, { fai: 'impScheda', valore: x }, t('studio.imp.scheda.' + x), stato[x]));
    const corpo = h('div', { class: 'studio-pannello studio-imp-corpo' });
    if (scheda === 'storia') {
      corpo.append(
        h('h5', { class: 'studio-gruppo-titolo' }, t('studio.imp.file')),
        voceImp(h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'esporta' } }, iconaSvg('scarica', 16), ' ', t('studio.esporta')), t('studio.imp.esportaAiuto')),
        voceImp(h('label', { class: 'tasto-cielo demo-importa-tasto', for: 'studio-importa' }, t('studio.importa')), t('studio.imp.importaAiuto'),
          h('input', { id: 'studio-importa', class: 'demo-file-nascosto', type: 'file', accept: '.json,application/json' })),
        voceImp(h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'duplica' } }, t('studio.duplica')), t('studio.imp.duplicaAiuto')),
        h('h5', { class: 'studio-gruppo-titolo' }, t('studio.imp.perChiScrive')),
        voceImp(h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'copione' }, 'aria-expanded': String(studio.copioneAperto), 'aria-controls': 'studio-copione' },
          t(studio.copioneAperto ? 'studio.imp.nascondiCopione' : 'studio.mostraCopione')), t('studio.imp.copioneAiuto')),
        voceImp(h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'fileVoci' } }, t('studio.voci.file')), t('studio.voci.aiuto')),
        h('div', { class: 'studio-imp-pericolo' },
          voceImp(h('button', { type: 'button', class: 'tasto-cielo studio-pericolo', dataset: { fai: 'elimina' } }, t('studio.elimina')), t('studio.imp.eliminaAiuto'))));
    } else if (scheda === 'repo') {
      corpo.append(
        h('p', { class: 'studio-imp-stato' + (repo.token ? ' ok' : '') }, repo.token
          ? t('studio.imp.repoStatoScrive', { repo: repo.repo, ramo: repo.ramo })
          : t('studio.imp.repoStatoLegge', { repo: repo.repo, ramo: repo.ramo })),
        voceImp(h('button', { type: 'button', class: 'tasto-cielo studio-imp-principale', dataset: { fai: 'sincronizza' } }, t('studio.repo.sincronizza')),
          repo.token ? t('studio.imp.sincronizzaAiuto') : t('studio.imp.sincronizzaSoloLegge')),
        h('h5', { class: 'studio-gruppo-titolo' }, t('studio.imp.collegamento')),
        pannelloRepo());
    } else {
      corpo.append(
        h('p', { class: 'studio-imp-stato' + (el.chiave ? ' ok' : '') }, el.chiave
          ? t('studio.imp.elStato', { modello: t('studio.el.modelli.' + el.modello) })
          : t('studio.imp.elStatoSenza')),
        pannelloEleven());
    }
    return h('section', { id: 'studio-impostazioni', class: 'studio-impostazioni', 'aria-label': t('studio.imp.titolo') },
      h('div', { class: 'studio-imp-testa' },
        h('h4', { class: 'storie-sottotitolo' }, iconaSvg('ingranaggio', 18), ' ', t('studio.imp.titolo')),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini studio-x', dataset: { fai: 'impostazioni' }, 'aria-label': t('studio.imp.chiudi'), title: t('studio.imp.chiudi') }, '×')),
      fila, corpo);
  }

  function disegna() {
    const r = studio.radice;
    if (!r || !studio.progetto) return;
    // Conserva le aperture quando una scelta ridisegna i campi; le scene
    // nuove restano chiuse e il riordino segue l'identità della scena.
    for (const el of r.querySelectorAll('.studio-scena[data-scena-chiave]')) {
      if (el.open) sceneAperte.add(el.dataset.scenaChiave);
      else sceneAperte.delete(el.dataset.scenaChiave);
    }
    const attivo = document.activeElement;
    const fuoco = attivo && r.contains(attivo) ? (attivo.dataset.campo || attivo.dataset.parole && 'parole|' + attivo.dataset.parole ||
      attivo.dataset.fai && attivo.dataset.fai + '|' + attivo.dataset.dove + '|' + (attivo.dataset.id || attivo.dataset.valore || attivo.dataset.tipo || '')) : null;
    const p = studio.progetto;
    const pezzi = [];
    // La barra: quale storia, una nuova, guarda e salva; il resto nelle Impostazioni
    // v461: nell'elenco le storie in cantiere; quelle messe fra le
    // CosmoStorie stanno là, e qui solo quando le si apre
    const inCantiere = studio.progetti.filter(x => !x.ufficiale);
    const elenco = selettore('', p.id, inCantiere.map(x => [x.id, x.titolo || t('studio.senzaTitolo')]), { id: 'studio-progetti', 'aria-label': t('studio.progetti') });
    if (!inCantiere.some(x => x.id === p.id))
      elenco.prepend(new Option((p.titolo || t('studio.senzaTitolo')) + (p.ufficiale ? ' · ' + t('studio.ufficiale.segno') : ''), p.id));
    elenco.value = p.id;
    // v449: «Altro» era un menu a tendina con dieci tasti alla rinfusa
    // (file, repository, ElevenLabs, elimina); ora è un pannello a parte
    const impostazioni = h('button', { type: 'button', class: 'tasto-cielo studio-imp-tasto', dataset: { fai: 'impostazioni' },
      'aria-expanded': String(!!studio.impAperto), 'aria-controls': 'studio-impostazioni' }, iconaSvg('ingranaggio', 16), ' ', t('studio.imp.titolo'));
    pezzi.push(h('div', { class: 'studio-blocco studio-barra' },
      h('label', { class: 'storie-campo studio-barra-scelta' }, h('span', {}, t('studio.progetti')), elenco),
      h('div', { class: 'studio-barra-tasti' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovo' } }, '+ ' + t('studio.nuovo')),
        h('button', { type: 'button', class: 'demo-avvia-principale storia-avvia', dataset: { fai: 'guarda' }, 'data-storia-prova': '' }, iconaSvg('gioca', 18), ' ', t('studio.guarda')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'salvaDemo' } }, t('studio.salvaDemo')),
        tastoUfficiale(p),
        impostazioni),
      p.ufficiale ? h('p', { class: 'demo-opzioni-nota' }, t('studio.ufficiale.nota')) : null,
      h('p', { id: 'studio-esito', class: 'demo-opzioni-nota', role: 'status', 'aria-live': 'polite' }, studio.esito),
      studio.impAperto ? pannelloImpostazioni(p) : null,
      h('pre', { id: 'studio-copione', class: 'storie-codice', tabindex: '0', hidden: !studio.copioneAperto })));
    // 1. L'idea (v447): due linguette, l'idea pronta e il titolo con
    // l'obiettivo, ognuna con lo stato in piccolo. Prima stavano sempre
    // aperte sette schede grandi e i due campi, anche a storia già avviata.
    // Una storia senza titolo apre l'idea (è da lì che si comincia).
    if (!schedeIdea.has(p.id)) schedeIdea.set(p.id, p.titolo ? '' : 'idea');
    const apertaIdea = schedeIdea.get(p.id);
    const filaIdea = h('div', { class: 'studio-linguette studio-linguette-passo', role: 'group', 'aria-label': t('studio.passo1') },
      linguetta(apertaIdea === 'idea', { fai: 'schedaPasso', dove: 'idea', valore: 'idea' }, t('studio.ui.scheda.idea'),
        STUDIO_SCOPI[p.scopo] ? t('studio.scopo.' + p.scopo + '.nome') : ''),
      linguetta(apertaIdea === 'titolo', { fai: 'schedaPasso', dove: 'idea', valore: 'titolo' }, t('studio.ui.scheda.titolo'),
        unaRiga(p.titolo) || t('studio.senzaTitolo')));
    const pannelloIdea = h('div', { class: 'studio-pannello' });
    if (apertaIdea === 'idea') {
      const idee = h('div', { class: 'studio-idee-pronte', role: 'group', 'aria-label': t('studio.passo1') });
      for (const k of Object.keys(STUDIO_SCOPI)) {
        const cast = STUDIO_SCOPI[k].cast;
        idee.append(scelta(p.scopo === k, { class: 'studio-idea-pronta', dataset: { fai: 'modello', valore: k } },
          h('span', { class: 'studio-idea-volti', 'aria-hidden': 'true' }, cast.slice(0, 3).map(id => figurina(id, '', 30))),
          h('strong', {}, t('studio.scopo.' + k + '.nome')),
          h('small', {}, t('studio.scopo.' + k + '.descrizione'))));
      }
      pannelloIdea.append(h('p', { class: 'demo-opzioni-nota' }, t('studio.passo1Aiuto')), idee);
    } else if (apertaIdea === 'titolo') {
      const obiettivo = h('textarea', { rows: '2', maxlength: '300', dataset: { campo: 'obiettivo' }, placeholder: t('studio.obiettivoAiuto') });
      obiettivo.value = p.obiettivo || '';
      pannelloIdea.append(h('div', { class: 'studio-riga studio-titoli' },
        h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.titolo')),
          h('input', { type: 'text', maxlength: '120', value: p.titolo, dataset: { campo: 'titolo' }, placeholder: t('studio.titoloAiuto') })),
        h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.obiettivo')), obiettivo)));
    }
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo1')),
      filaIdea, apertaIdea ? pannelloIdea : null));

    // 2. Chi recita (v447): in cima chi è già nella storia, piccolo e con
    // la × per toglierlo; sotto una linguetta per famiglia (coi volti
    // scelti e quanti sono) e una per le voci ElevenLabs. Prima erano
    // quaranta schede aperte in quattro gruppi, e le voci sotto a tutte.
    const gruppi = { narratori: [], pianeti: [], lune: [], macchine: [], universo: [] };
    for (const id of Object.keys(S().STOR_PERSONAGGI || {})) {
      const f = S().profilo ? S().profilo(id).famiglia : 'pianeta';
      (f === 'persona' ? gruppi.narratori : soloCosmo(id) ? gruppi.universo : f === 'stazione' || f === 'sonda' ? gruppi.macchine : f === 'luna' || f === 'nano' ? gruppi.lune : gruppi.pianeti).push(id);
    }
    const nella = h('div', { class: 'studio-chips studio-nel-cast', role: 'group', 'aria-label': t('studio.ui.nellaStoria') },
      h('span', { class: 'studio-etichetta' }, t('studio.ui.nellaStoria')));
    for (const id of p.cast) {
      nella.append(h('span', { class: 'studio-azione-chip studio-cast-chip' },
        h('span', { class: 'studio-cast-chip-nome' }, figurina(id, '', 22), nome(id)),
        p.cast.length > 1 ? h('button', { type: 'button', class: 'studio-azione-x', dataset: { fai: 'cast', id }, 'aria-label': t('studio.ui.togliDallaStoria', { nome: nome(id) }), title: t('studio.ui.togliDallaStoria', { nome: nome(id) }) }, '×') : null));
    }
    if (!schedeCast.has(p.id)) schedeCast.set(p.id, '');
    const apertaCast = schedeCast.get(p.id);
    const filaCast = h('div', { class: 'studio-linguette studio-linguette-passo', role: 'group', 'aria-label': t('studio.passo2') });
    for (const [g, ids] of Object.entries(gruppi)) {
      if (!ids.length) continue;
      const scelti = ids.filter(id => p.cast.includes(id));
      const l = linguetta(apertaCast === g, { fai: 'schedaPasso', dove: 'cast', valore: g }, t('studio.ui.gruppo.' + g),
        scelti.length ? t('studio.ui.sceltiDi', { n: scelti.length, tot: ids.length }) : t('studio.ui.nessunoDi', { tot: ids.length }));
      if (scelti.length) l.querySelector('small').prepend(h('span', { class: 'studio-linguetta-volti', 'aria-hidden': 'true' },
        scelti.slice(0, 4).map(id => figurina(id, '', 20)), scelti.length > 4 ? h('small', {}, '+' + (scelti.length - 4)) : null));
      filaCast.append(l);
    }
    const conChiave = !!studioElevenImpostazioni().chiave;
    const conVoce = p.cast.filter(id => studioVoceDi(p, id)).length;
    filaCast.append(linguetta(apertaCast === 'voci', { fai: 'schedaPasso', dove: 'cast', valore: 'voci' }, t('studio.el.vociTitolo'),
      conChiave ? t('studio.ui.conLaVoce', { n: conVoce, tot: p.cast.length }) : t('studio.ui.elSpento')));
    const pannelloCast = h('div', { class: 'studio-pannello' });
    if (apertaCast === 'voci') pannelloCast.append(disegnaVociPersonaggi(p));
    else if (gruppi[apertaCast]) {
      const fila = h('div', { class: 'studio-cast' });
      for (const id of gruppi[apertaCast]) {
        const prof = S().profilo ? S().profilo(id) : {};
        fila.append(scelta(p.cast.includes(id), { class: 'studio-personaggio', dataset: { fai: 'cast', id } },
          figurina(id, '', 48),
          h('span', { class: 'studio-personaggio-testo' },
            h('strong', { style: 'color:' + (prof.sottotitolo || '#fff') }, nome(id),
              h('small', { class: 'studio-genere' }, ' · ' + t('studio.ui.genere.' + (prof.genere === 'f' ? 'f' : 'm')))),
            h('small', { title: S().tratto ? S().tratto(id) : '' }, S().personalita ? S().personalita(id) : ''))));
      }
      pannelloCast.append(h('p', { class: 'demo-opzioni-nota' }, t('studio.passo2Aiuto')), fila);
    }
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo2'), h('small', { class: 'studio-conta' }, ' · ' + t('studio.ui.nelCast', { n: p.cast.length }))),
      nella, filaCast, apertaCast ? pannelloCast : null));
    // 3. Il copione: le scene
    const scene = h('div', { class: 'studio-scene' });
    p.scene.forEach((sc, i) => scene.append(disegnaScena(sc, i)));
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo3')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo3Aiuto')),
      disegnaMusica('storia'),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.musica.nota')),
      scene,
      h('div', { class: 'demo-azioni' }, h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovaScena' } }, '+ ' + t('studio.aggiungiScena')))));
    // La domanda finale al pubblico (v430, §4-bis): quando, che tipo, e chi
    // vuole la scrive a mano; sotto, la domanda che la storia farà davvero
    pezzi.push(disegnaDomanda(p));
    // 4. Il controllo, chiuso in una riga quando è tutto a posto
    const consigli = h('ul', { class: 'studio-consigli', id: 'studio-consigli' });
    pezzi.push(h('details', { class: 'studio-blocco studio-controllo', id: 'studio-controllo' },
      h('summary', {}, h('span', { class: 'storie-sottotitolo' }, t('studio.passo5')), h('span', { class: 'studio-controllo-esito', id: 'studio-controllo-esito' })),
      consigli));
    // 5. Guarda e salva, anche in fondo
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo6')),
      h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'demo-avvia-principale storia-avvia', dataset: { fai: 'guarda' }, 'data-storia-prova': '' }, iconaSvg('gioca', 18), ' ', t('studio.guarda')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'salvaDemo' } }, t('studio.salvaDemo')),
        tastoUfficiale(p))));
    r.replaceChildren(...pezzi);
    aggiornaVivi();
    if (fuoco) {
      const [fai, dove, extra] = fuoco.split('|');
      let el = null;
      if (fai === 'parole') el = r.querySelector(`[data-parole="${CSS.escape(dove)}"]`);
      else if (dove !== undefined) {
        const tutti = Array.from(r.querySelectorAll(`[data-fai="${CSS.escape(fai)}"]`)).filter(x => (x.dataset.dove || 'undefined') === dove);
        el = tutti.find(x => (x.dataset.id || x.dataset.valore || x.dataset.tipo || '') === extra) || tutti[0] || null;
      } else el = r.querySelector(`[data-campo="${CSS.escape(fuoco)}"]`);
      if (el) el.focus();
    }
  }
  // Fra le CosmoStorie, o di nuovo in cantiere (v461)
  function tastoUfficiale(p) {
    return p.ufficiale
      ? h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'ritira' }, title: t('studio.ufficiale.ritiraAiuto') }, t('studio.ufficiale.ritira'))
      : h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'pubblica' }, title: t('studio.ufficiale.pubblicaAiuto') }, t('studio.ufficiale.pubblica'));
  }
  function disegnaDomanda(p) {
    const d = p.domanda || (p.domanda = studioNuovaDomanda());
    const modi = STUDIO_MODI_DOMANDA.map(m => [m, t('studio.domanda.modo.' + m)]);
    const tipi = ['auto'].concat(STUDIO_TIPI_DOMANDA).map(k => [k, t('studio.domanda.tipo.' + k)]);
    const accesa = d.attiva === true;
    const spunta = h('label', { class: 'storie-campo studio-spunta' },
      h('input', { type: 'checkbox', checked: accesa, dataset: { campo: 'domanda.attiva' } }),
      h('span', {}, t('studio.domanda.attiva')));
    if (!accesa) {
      return h('div', { class: 'studio-blocco studio-domanda' },
        h('h4', { class: 'storie-sottotitolo' }, t('studio.domanda.titolo')),
        h('p', { class: 'demo-opzioni-nota' }, t('studio.domanda.aiuto')),
        spunta,
        h('p', { class: 'studio-domanda-anteprima', id: 'studio-domanda-anteprima', role: 'status', 'aria-live': 'polite' }));
    }
    const campi = [
      spunta,
      h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.modo')), selettore('domanda.modo', d.modo, modi)),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.tipo')), selettore('domanda.tipo', d.tipo, tipi, { disabled: d.modo === 'mai' })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.chi')),
          selettore('domanda.chi', d.chi, [['', t('studio.domanda.chiAuto')]].concat(opzioniPersonaggi(p.cast)), { disabled: d.modo === 'mai' })))
    ];
    if (d.modo !== 'mai') {
      campi.push(h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.domanda.scrivi')),
          h('input', { type: 'text', maxlength: '200', value: d.testo, dataset: { campo: 'domanda.testo' }, placeholder: t('studio.domanda.scriviAiuto') })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.a')),
          h('input', { type: 'text', maxlength: '60', value: d.a, dataset: { campo: 'domanda.a' } })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.b')),
          h('input', { type: 'text', maxlength: '60', value: d.b, dataset: { campo: 'domanda.b' } }))));
      campi.push(h('div', { class: 'demo-azioni' },
        unaRiga(d.testo)
          ? h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'domandaTogli' } }, t('studio.domanda.togli'))
          : h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'domandaUsa' } }, t('studio.domanda.usa'))));
    }
    return h('div', { class: 'studio-blocco studio-domanda' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.domanda.titolo')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.domanda.aiuto')),
      ...campi,
      h('p', { class: 'studio-domanda-anteprima', id: 'studio-domanda-anteprima', role: 'status', 'aria-live': 'polite' }));
  }
  // La domanda che la storia farà, a parole, sotto ai campi
  function anteprimaDomanda(el, p) {
    const d = studioDomandaFinale(p);
    if (!d) { el.replaceChildren(t(!p.domanda || p.domanda.attiva !== true || p.domanda.modo === 'mai' ? 'studio.domanda.spenta' : 'studio.domanda.nessuna')); return; }
    const scelte = [d.a, d.b].filter(Boolean);
    el.replaceChildren(t('studio.domanda.sara'), ' ',
      h('strong', {}, (d.chi ? nome(d.chi) + ': ' : '') + '«' + d.testo + '»'),
      scelte.length ? h('span', { class: 'studio-domanda-scelte' }, ' ', scelte.map((x, i) => (i ? 'B' : 'A') + ' · ' + x).join('   ')) : null);
  }
  // Quello che cambia a ogni lettera: il controllo, il copione, i contatori
  function aggiornaVivi() {
    const r = studio.radice;
    if (!r) return;
    const anteprima = r.querySelector('#studio-domanda-anteprima');
    if (anteprima) anteprimaDomanda(anteprima, studio.progetto);
    const lista = r.querySelector('#studio-consigli');
    if (lista) {
      const valida = radice.AstroDemo && typeof radice.AstroDemo.valida === 'function' ? radice.AstroDemo.valida : null;
      const consigli = studioConsigli(studio.progetto, valida);
      lista.replaceChildren(...consigli.map(c => h('li', { class: c.ok ? 'ok' : 'no' }, h('span', { class: 'studio-segno', 'aria-hidden': 'true' }, c.ok ? '✓' : '!'), c.testo)));
      lista.append(h('li', { class: 'info' }, t('studio.durataTotale', { n: studioDurataTotale(studio.progetto) })));
      const da = consigli.filter(c => !c.ok).length;
      const esitoEl = r.querySelector('#studio-controllo-esito');
      if (esitoEl) {
        esitoEl.textContent = da ? t('studio.ui.consigli', { n: da }) : t('studio.ui.tuttoBene');
        esitoEl.classList.toggle('no', da > 0);
      }
    }
    const pre = r.querySelector('#studio-copione');
    if (pre && !pre.hidden) pre.textContent = studioCopione(studio.progetto);
  }
  function esito(msg) {
    studio.esito = msg || '';
    const el = studio.radice && studio.radice.querySelector('#studio-esito');
    if (el) el.textContent = studio.esito;
  }

  function avvia(testo) {
    if (registrazione) fermaRegistrazione();
    // l'ascolto di prova di una musica non si sovrappone alla storia
    if (ascoltoMusica) fermaAscoltoMusica();
    try {
      if (radice.StorieCosmiche && radice.StorieCosmiche.chiudiAnteprima) radice.StorieCosmiche.chiudiAnteprima();
      radice.AstroDemo.avvia(testo);
      esito('');
    } catch (e) { esito(e.message); }
  }
  function apri(progetto) {
    for (const k of [...proposte.keys()]) togliProposta(k);
    studio.elScelta = null; studio.elMsg = null;
    if (registrazione) fermaRegistrazione();
    studio.progetto = progetto;
    studio.capito = null; studio.capitoScena = -1; studio.esito = ''; studio.aperta = null;
    salvaPresto(false);
    disegna();
  }

  // Le operazioni dei bottoni
  function fai(nomeOp, dove, el) {
    const p = studio.progetto;
    const contenitore = percorso => { const parti = percorso.split('.'); const i = Number(parti.pop()); return { lista: leggi(parti.join('.')), i }; };
    switch (nomeOp) {
      case 'nuovo': apri(studioNuovoProgetto()); return;
      // La domanda proposta dalla storia diventa testo da modificare; e si
      // torna a quella della storia svuotando i campi
      case 'domandaUsa': {
        const d = studioDomandaFinale(Object.assign({}, p, { domanda: Object.assign({}, p.domanda, { attiva: true, modo: 'sempre', testo: '' }) }));
        if (d) Object.assign(p.domanda, { testo: d.testo, a: d.a, b: d.b, chi: d.chi, tipo: d.tipo });
        salvaPresto(); disegna(); return;
      }
      case 'domandaTogli': Object.assign(p.domanda, { testo: '', a: '', b: '' }); salvaPresto(); disegna(); return;
      case 'duplica': { const c = copia(p); c.id = nuovoId('p'); c.ufficiale = false; c.titolo = t('studio.copiaDi', { titolo: p.titolo || t('studio.senzaTitolo') }); c.demoChiave = null; c.voceChiave = null; copiaVoci(p.id, c.id); apri(c); return; }
      case 'elimina':
        if (!radice.confirm || radice.confirm(t('studio.confermaElimina'))) {
          studio.progetti = studio.progetti.filter(x => x.id !== p.id);
          studioSalvaTutti(studio.progetti);
          if (p.ufficiale) aggiornaCosmoStorie();
          // Una lapide, perché dagli altri dispositivi non torni (§6b)
          if (condivisa(p)) { const e = eliminatiCarica(); e[p.id] = Math.max(Date.now(), (p.aggiornato || 0) + 1); eliminatiSalva(e); }
          apri(studio.progetti[0] || studioNuovoProgetto());
          cancellaVoci(p.id);
          // Le sue battute escono dal file delle voci (se la cartella è
          // collegata) e la storia dal repository
          aggiornaVoci({ tolta: p.id, chiedi: false })
            .then(msg => condivisa(p) ? studioSincronizza({ spingi: true, titolo: p.titolo }).then(r2 => (msg ? msg + ' ' : '') + r2) : msg)
            .then(msg => { if (msg || p.demoChiave) esito(msg || t('studio.voci.ricorda')); });
        }
        return;
      case 'fileVoci':
        // Le storie salvate prima del file delle voci entrano la prima volta
        if (p.demoChiave && !Object.values(studioVociCarica()).some(f => f && f.progetto === p.id)) {
          aggiornaVoci({ salvata: p, chiedi: true }).then(msg => { salvaPresto(); esito(msg); });
        } else aggiornaVoci({ chiedi: true }).then(msg => esito(msg));
        return;
      case 'esporta': {
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: (unaRiga(p.titolo) || 'storia').replace(/[^\w-]+/g, '_').slice(0, 40) + '.storia.json' });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        return;
      }
      case 'modello': {
        const scopo = el.dataset.valore;
        if (!STUDIO_SCOPI[scopo]) return;
        const vuoto = !p.scene.some(sc => sc.momenti.some(m => unaRiga(m.testo)));
        if (vuoto || !radice.confirm || radice.confirm(t('studio.confermaModello'))) {
          const nuovo = studioDaModello(scopo);
          nuovo.id = p.id; nuovo.demoChiave = p.demoChiave; nuovo.aggiornato = Date.now();
          apri(nuovo);
        }
        return;
      }
      case 'cast': {
        const id = el.dataset.id;
        if (!p.cast.includes(id)) p.cast.push(id);
        else if (p.cast.length > 1) p.cast = p.cast.filter(x => x !== id);
        break;
      }
      case 'presente': {
        const sc = leggi(dove);
        let lista = studioPresenti(p, sc);
        const id = el.dataset.id;
        lista = lista.includes(id) ? lista.filter(x => x !== id) : lista.concat(id);
        // Almeno uno in scena: togliere l'ultimo li rimetterebbe tutti
        if (lista.length) sc.presenti = lista;
        break;
      }
      case 'ambiente': {
        const sc = leggi(dove);
        sc.ambiente = el.dataset.valore;
        if (sc.ambiente === 'cielo' && !STUDIO_FUOCHI_CIELO.includes(sc.fuoco)) sc.fuoco = studioPresenti(p, sc).find(id => STUDIO_FUOCHI_CIELO.includes(id)) || 'Moon';
        if (sc.ambiente === 'pianeta' && !STUDIO_FUOCHI_3D.includes(sc.fuoco)) sc.fuoco = studioPresenti(p, sc).find(id => STUDIO_FUOCHI_3D.includes(id)) || 'Jupiter';
        break;
      }
      case 'chi': {
        const m = leggi(dove);
        m.chi = el.dataset.id || '';
        break;
      }
      case 'umore': {
        const m = leggi(dove);
        m.umore = m.umore === el.dataset.valore ? '' : el.dataset.valore;
        break;
      }
      // v449: il tono della battuta; il terzo scelto fa uscire il più vecchio
      case 'tono': {
        const m = leggi(dove), x = el.dataset.valore;
        if (!STUDIO_TONI.includes(x)) return;
        const tono = (m.tono || []).filter(y => STUDIO_TONI.includes(y));
        m.tono = tono.includes(x) ? tono.filter(y => y !== x) : tono.concat(x).slice(-STUDIO_TONI_MAX);
        break;
      }
      case 'aggiungiTipo': {
        const m = leggi(dove);
        const sc = p.scene[Number(dove.split('.')[1])];
        const az = studioNuovaAzione(el.dataset.tipo, { chi: el.dataset.tipo === 'suono' ? '' : m.chi || studioPresenti(p, sc)[0] || '' });
        if (az.tipo === 'muovi') az.verso = studioPresenti(p, sc).find(id => id !== az.chi) || '';
        m.azioni.push(az);
        studio.aperta = az.id;
        break;
      }
      case 'apriAzione': studio.aperta = dove && studio.aperta !== dove ? dove : null; break;
      // v446: un momento aperto per scena, una linguetta aperta per momento e per scena
      case 'apriMomento': {
        const m = leggi(dove), sc = p.scene[Number(dove.split('.')[1])];
        const k = chiaveScena(sc);
        if (momentiAperti.get(k) === m.id) momentiAperti.delete(k); else momentiAperti.set(k, m.id);
        disegna(); return;
      }
      case 'schedaMomento': studio.schedaMomento = studio.schedaMomento === el.dataset.valore ? '' : el.dataset.valore; disegna(); return;
      case 'schedaPasso': {
        const m = el.dataset.dove === 'idea' ? schedeIdea : schedeCast;
        m.set(p.id, m.get(p.id) === el.dataset.valore ? '' : el.dataset.valore);
        disegna(); return;
      }
      case 'schedaScena': {
        const k = chiaveScena(leggi(dove));
        if (schedeScena.get(k) === el.dataset.valore) schedeScena.delete(k); else schedeScena.set(k, el.dataset.valore);
        disegna(); return;
      }
      case 'nuovaScena': {
        const ultima = p.scene[p.scene.length - 1];
        p.scene.push(studioNuovaScena(ultima ? { ambiente: ultima.ambiente, fuoco: ultima.fuoco, zoom: ultima.zoom, presenti: ultima.presenti.slice(), momenti: [] } : {}));
        const nuova = p.scene[p.scene.length - 1];
        nuova.momenti.push(studioProssimoMomento(p, nuova));
        break;
      }
      case 'togliScena': { const { lista, i } = contenitore(dove); if (lista.length > 1) lista.splice(i, 1); break; }
      case 'nuovoMomento': {
        const sc = leggi(dove);
        const ultimo = sc.momenti[sc.momenti.length - 1];
        const presenti = studioPresenti(p, sc);
        // parla di serie chi non ha appena parlato
        const chi = presenti.find(id => !ultimo || id !== ultimo.chi) || presenti[0] || '';
        sc.momenti.push(studioNuovoMomento({ chi }));
        // il momento nuovo si apre, pronto per scrivere
        momentiAperti.set(chiaveScena(sc), sc.momenti[sc.momenti.length - 1].id);
        break;
      }
      case 'prossimoMomento': { const sc = leggi(dove); sc.momenti.push(studioProssimoMomento(p, sc)); momentiAperti.set(chiaveScena(sc), sc.momenti[sc.momenti.length - 1].id); break; }
      case 'togliMomento': { const { lista, i } = contenitore(dove); lista.splice(i, 1); if (!lista.length) lista.push(studioNuovoMomento()); break; }
      case 'togliAzione': {
        const { lista, i } = contenitore(dove);
        // un suono da file se ne va anche dal browser (v444)
        if (lista[i] && lista[i].tipo === 'suono' && lista[i].file) togliSuono(lista[i]);
        lista.splice(i, 1);
        break;
      }
      case 'su': case 'giu': {
        const { lista, i } = contenitore(dove);
        const j = nomeOp === 'su' ? i - 1 : i + 1;
        if (j >= 0 && j < lista.length) [lista[i], lista[j]] = [lista[j], lista[i]];
        break;
      }
      // v449: le impostazioni in un pannello a parte (Storia, Sincronizza, ElevenLabs)
      case 'impostazioni': studio.impAperto = !studio.impAperto; studio.elCrediti = ''; disegna(); return;
      case 'impScheda': studio.impScheda = el.dataset.valore; studio.elCrediti = ''; disegna(); return;
      case 'repo': apriImpostazioni('repo'); return;
      case 'repoSalva': case 'repoDimentica': {
        const val = id => { const x = studio.radice.querySelector('#' + id); return x ? x.value.trim() : ''; };
        const imp = { repo: val('studio-repo-nome'), ramo: val('studio-repo-ramo') || 'main', token: nomeOp === 'repoDimentica' ? '' : val('studio-repo-token') };
        if (!REPO_VALIDO.test(imp.repo) || !RAMO_VALIDO.test(imp.ramo)) { esito(t('studio.repo.errNome')); return; }
        if (!studioRepoSalvaImpostazioni(imp)) { esito(t('studio.repo.errore', { errore: 'localStorage' })); return; }
        disegna();
        if (nomeOp === 'repoDimentica') { esito(t('studio.repo.dimenticato')); return; }
        esito(t('studio.repo.inCorso'));
        studioSincronizza({ spingi: !!imp.token, titolo: '' }).then(msg => esito(msg || t('studio.repo.giaAPosto')));
        return;
      }
      case 'sincronizza':
        esito(t('studio.repo.inCorso'));
        studioSincronizza({ spingi: true, titolo: p.titolo }).then(msg => esito(msg || t('studio.repo.giaAPosto')));
        return;
      case 'ascoltaVoce': ascoltaVoce(leggi(dove)); return;
      // v444: ElevenLabs (§6c)
      case 'elPannello': studio.elCrediti = ''; apriImpostazioni('el'); return;
      case 'elSalva': case 'elDimentica': {
        const val = id => { const x = studio.radice.querySelector('#' + id); return x ? x.value.trim() : ''; };
        const imp = { chiave: nomeOp === 'elDimentica' ? '' : val('studio-el-chiave'), modello: val('studio-el-modello') || 'eleven_v3', stabilita: Number(val('studio-el-stabilita')) };
        if (!ELEVEN_STABILITA.includes(imp.stabilita)) imp.stabilita = 0.5;
        if (!studioElevenSalva(imp)) { esito(t('studio.el.errore', { errore: 'localStorage' })); return; }
        if (nomeOp === 'elDimentica') { studio.elCrediti = ''; studio.elScelta = null; disegna(); esito(t('studio.el.dimenticata')); return; }
        if (!imp.chiave) { disegna(); return; }
        studio.elCrediti = t('studio.el.verifico');
        disegna();
        elevenCrediti(imp.chiave).then(c => {
          studio.elCrediti = t('studio.el.crediti', { restano: Math.max(0, c.limite - c.usati).toLocaleString(), limite: c.limite.toLocaleString(), piano: c.piano || '—' });
          esito(t('studio.el.salvata'));
        }, e => { studio.elCrediti = e.message; }).then(() => disegna());
        return;
      }
      case 'elScegli': { const id = el.dataset.id; if (studio.elScelta && studio.elScelta.luogo === 'pg|' + id) { studio.elScelta = null; disegna(); } else apriScelta(id); return; }
      // v445: la voce di un personaggio solo per una scena
      case 'elScegliScena': {
        const sc = leggi(dove), id = el.dataset.id, luogo = 'sc|' + sc.id + '|' + id;
        if (studio.elScelta && studio.elScelta.luogo === luogo) { studio.elScelta = null; disegna(); } else apriScelta(id, { luogo, scena: sc.id });
        return;
      }
      case 'elTornaStoria': { const sc = leggi(dove); scegliVocePersonaggio(el.dataset.id, null, sc); studio.elMsg = null; disegna(); return; }
      case 'elMancantiScena': generaMancanti(el.dataset.id, leggi(dove)); return;
      case 'elChiudi': studio.elScelta = null; disegna(); return;
      case 'elCerca': {
        const c = studio.elScelta, campo = studio.radice.querySelector('[data-el-cerca]');
        if (c) { c.cerca = campo ? campo.value : ''; c.tutteMie = c.fonte === 'mie' ? c.tutteMie : null; cercaVoci(); }
        return;
      }
      case 'elAltre': if (studio.elScelta) { studio.elScelta.pagina++; cercaVoci(true); } return;
      case 'elAnteprima': { const v = studio.elScelta && studio.elScelta.voci[Number(dove)]; if (v) suonaAnteprima(v.anteprima); return; }
      case 'elProva': { const v = studio.elScelta && studio.elScelta.voci[Number(dove)]; if (v) provaVoce(v); return; }
      case 'elScegliVoce': { const v = studio.elScelta && studio.elScelta.voci[Number(dove)]; if (v) scegliVoce(v); return; }
      case 'elAscoltaPg': { const v = studioVoceDi(p, el.dataset.id, dove ? leggi(dove) : null); if (v && v.anteprima) suonaAnteprima(v.anteprima); return; }
      case 'elTogliVoce': scegliVocePersonaggio(el.dataset.id, null); disegna(); return;
      case 'elMancanti': generaMancanti(el.dataset.id); return;
      case 'elGeneraVoce': generaVoce(dove); return;
      case 'elSuono': generaSuono(dove); return;
      case 'elMusica': generaMusica(dove); return;
      case 'elAscoltaProposta': { const x = proposte.get(dove); if (x) suonaAnteprima(x.url, dove.startsWith('musica|') ? 0.6 : undefined); return; }
      case 'elUsa': usaProposta(el.dataset.valore, dove); return;
      case 'elScarta': togliProposta(dove); disegna(); return;
      case 'ascoltaSuono': ascoltaSuono(leggi(dove)); return;
      case 'togliSuono': togliSuono(leggi(dove)); break;
      case 'registraVoce': registraDalMicrofono(dove); return;
      case 'ascoltaMusica': ascoltaMusica(dove); disegna(); return;
      case 'togliMusica': if (ascoltoMusica && ascoltoMusica.dove === dove) fermaAscoltoMusica(); togliMusica(dove); break;
      case 'togliVoce': togliVoce(leggi(dove)); break;
      case 'umoreDalTesto': { const m = leggi(dove); const u = studioUmoreDalTesto(m.testo); if (u) m.umore = u; break; }
      case 'idea': {
        const m = leggi(dove);
        const parti = dove.split('.');
        const sc = p.scene[Number(parti[1])];
        const idea = studioIdeeAzioni(p, sc, m)[Number(el.dataset.idea)];
        if (idea) m.azioni.push(idea);
        break;
      }
      case 'ambienteAdatto': {
        const sc = leggi(dove);
        Object.assign(sc, studioAmbientePer(studioPresenti(p, sc)));
        break;
      }
      case 'provaScena': avvia(studioCopione(p, { scena: Number(dove.split('.')[1]) })); return;
      case 'guarda': avvia(studioCopione(p)); return;
      case 'copione': studio.copioneAperto = !studio.copioneAperto; break;
      case 'capisci': {
        const campo = studio.radice.querySelector(`[data-parole="${CSS.escape(dove)}"]`);
        const testo = campo ? campo.value : '';
        const i = Number(dove.split('.')[1]) || 0;
        studio.capitoScena = i;
        studio.capito = studioCapisci(testo, p);
        studioApplica(p, i, studio.capito.ops);
        // Quello che non ha capito resta scritto, da correggere
        studio.paroleResto = studio.capito.ops.length ? null : { dove, testo };
        break;
      }
      case 'togliRiga': {
        const m = leggi(dove);
        if (m && m.copione) m.copione.righe.splice(Number(el.dataset.valore), 1);
        break;
      }
      // v461: la storia va fra le CosmoStorie (salvata come demo, perché la
      // scheda la faccia partire), o torna in cantiere
      case 'pubblica':
        p.ufficiale = true;
        if (!salvaDemo(p, t('studio.ufficiale.pubblicata'))) p.ufficiale = false;
        aggiornaCosmoStorie();
        break;
      case 'ritira':
        p.ufficiale = false;
        studio.esito = t('studio.ufficiale.ritirata');
        salvaDemo(p, studio.esito);
        aggiornaCosmoStorie();
        break;
      case 'salvaDemo':
        salvaDemo(p, t(p.ufficiale ? 'studio.ufficiale.aggiornata' : 'studio.salvata'));
        aggiornaCosmoStorie();
        break;
      default: return;
    }
    salvaPresto();
    disegna();
  }

  /* Salva la storia come demo (nella libreria, nel file delle voci e sul
   * repository). Restituisce false se non si è potuto: allora `studio.esito`
   * dice perché. `ok` è il messaggio di quando va bene. */
  function salvaDemo(p, ok) {
    try {
      const lib = radice.AstroDemo.libreria;
      const testo = studioCopione(p);
      let chiave = p.demoChiave;
      try { chiave = lib.salva(testo, chiave || undefined); }
      catch (e) { if (chiave) chiave = lib.salva(testo); else throw e; }   // la demo era stata cancellata
      p.demoChiave = chiave;
      if (typeof radice.demoPaginaRicarica === 'function') radice.demoPaginaRicarica(chiave);
      studio.esito = ok;
      // Le battute nel file delle voci: numeri e nome della storia
      // entrano nel progetto, che si salva subito sotto
      const salvato = studio.esito;
      // Poi sul repository, perché si veda dagli altri dispositivi (§6b):
      // il progetto deve essere già nell'archivio quando il giro lo legge
      aggiornaVoci({ salvata: p, chiedi: false })
        .then(msg => {
          const i = studio.progetti.findIndex(x => x.id === p.id);
          if (i >= 0) studio.progetti[i] = p; else studio.progetti.unshift(p);
          studioSalvaTutti(studio.progetti);
          aggiornaCosmoStorie();
          const prima = salvato + ' ' + (msg || (studioRepoImpostazioni().token ? '' : t('studio.voci.ricorda')));
          esito(prima + ' ' + t('studio.repo.inCorso'));
          return studioSincronizza({ spingi: true, titolo: p.titolo }).then(r2 => esito(prima + ' ' + r2));
        });
      return true;
    } catch (e) { studio.esito = e.message; return false; }
  }
  // Le schede delle CosmoStorie (storie-cosmiche.js) si rifanno quando una
  // storia dello Studio entra, esce o cambia
  function aggiornaCosmoStorie() {
    const s = radice.StorieCosmiche;
    if (s && typeof s.riempiPagina === 'function') { try { s.riempiPagina(); } catch (_) { /* la pagina resta com'era */ } }
  }
  /* Le storie dello Studio messe fra le CosmoStorie: per le schede della
   * pagina, col copione salvato (o quello di adesso, se non c'è più). */
  function studioUfficiali() {
    const lib = radice.AstroDemo && radice.AstroDemo.libreria;
    let demo = [];
    try { demo = lib ? lib.elenco() : []; } catch (_) { demo = []; }
    return studio.progetti.filter(p => p.ufficiale).map(p => {
      const d = p.demoChiave && demo.find(x => x.chiave === p.demoChiave);
      let testo = d ? d.testo : '';
      if (!testo) { try { testo = studioCopione(p); } catch (_) { testo = ''; } }
      return { chiave: p.demoChiave || p.id, progetto: p.id, titolo: unaRiga(p.titolo) || t('studio.senzaTitolo'),
        descrizione: unaRiga(p.obiettivo), cast: p.cast.join(','), testo, storia: true };
    }).filter(x => x.testo);
  }
  // Apre nello Studio un progetto, e lo porta in vista
  function mostraNelloStudio() {
    if (typeof radice.demoMostraScheda === 'function') radice.demoMostraScheda('demo-scheda-storie');
    disegna();
    if (studio.radice && studio.radice.scrollIntoView) studio.radice.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function studioApriProgetto(id) {
    const p = studio.progetti.find(x => x.id === id);
    if (!p) return false;
    apri(p);
    mostraNelloStudio();
    return true;
  }
  /* «Duplica e modifica» di una CosmoStoria (v461): la copia nello Studio,
   * con tutto quello che c'era, pronta da ritoccare e salvare. */
  function studioApriDaStoria(st) {
    if (!st || typeof st.testo !== 'string') return false;
    const p = studioDaCopione(st.testo, { chiave: st.chiave, cast: st.cast, titolo: st.titolo, obiettivo: st.descrizione });
    // «CosmoStorie · Giove e Saturno» diventa «Copia di Giove e Saturno»
    const titolo = p.titolo.replace(/^Cosmo\w{0,12}\s*·\s*/, '') || p.titolo;
    p.titolo = (t('studio.copiaDi', { titolo }) || titolo).slice(0, 120);
    // la prima scena aperta, perché si veda subito che dentro c'è tutto
    if (p.scene[0]) sceneAperte.add(p.id + '|' + p.scene[0].id);
    apri(p);
    const tenuti = p.scene.reduce((n, sc) => n + sc.momenti.reduce((k, m) => k + (m.copione ? m.copione.righe.length : 0), 0), 0);
    esito(t('studio.daStoria.pronta', { n: tenuti }));
    mostraNelloStudio();
    return true;
  }

  // Una scelta del menu della musica: la traccia dell'app, quella della
  // storia, il silenzio, nessuna. Un file caricato che non si usa più se ne
  // va (dal browser subito, dal repository al prossimo salvataggio)
  function sceltaMusica(dove, valore) {
    const di = musicaDi(dove);
    if (!di) return;
    if (ascoltoMusica && ascoltoMusica.dove === dove) fermaAscoltoMusica();
    const volume = di.mu ? di.mu.volume : STUDIO_MUSICA_VOLUME;
    if (valore === 'storia' || valore === 'silenzio') {
      if (di.mu && di.mu.tipo === 'file') togliMusica(dove);
      di.tiene.musicaModo = valore;
    }
    else if (valore === 'file') { if (di.sid) di.tiene.musicaModo = 'propria'; }
    else if (valore.startsWith('cat:')) {
      if (di.mu && di.mu.tipo === 'file') togliMusica(dove);
      di.tiene.musica = { tipo: 'catalogo', id: valore.slice(4), volume };
      if (di.sid) di.tiene.musicaModo = 'propria';
    } else if (!valore && !di.sid) togliMusica(dove);
    salvaPresto();
    disegna();
  }

  function collega(r) {
    r.addEventListener('click', e => {
      const b = e.target.closest('[data-fai]');
      if (b && r.contains(b)) fai(b.dataset.fai, b.dataset.dove, b);
    });
    // «Scrivi a parole»: Invio è come «Fallo!»
    r.addEventListener('keydown', e => {
      const el = e.target;
      if (e.key === 'Enter' && el.dataset && el.dataset.parole && el.value.trim()) { e.preventDefault(); fai('capisci', el.dataset.parole, el); }
      if (e.key === 'Enter' && el.dataset && el.dataset.elCerca) { e.preventDefault(); fai('elCerca', '', el); }
    });
    r.addEventListener('input', e => {
      const el = e.target;
      // v444: la descrizione e la durata della musica da generare
      if (el.dataset && el.dataset.elMusica) {
        const x = richiestaMusica(chiaveMusicaEl(el.dataset.elMusica));
        if (el.dataset.elCampo === 'secondi') x.secondi = Math.max(10, Math.min(300, Number(el.value) || 60)); else x.testo = el.value.slice(0, 400);
        return;
      }
      if (!el.dataset || !el.dataset.campo || el.tagName === 'SELECT') return;
      if (el.type === 'checkbox' || el.type === 'date' || el.type === 'time' || el.type === 'color') return;
      let v = el.value;
      if (el.dataset.numero) v = Math.max(0, Number(v) || 0);
      scrivi(el.dataset.campo, v);
      salvaPresto();
      // Il contatore delle parole senza ridisegnare (il cursore resta dov'è)
      if (/\.testo$/.test(el.dataset.campo)) {
        const c = el.parentElement && el.parentElement.querySelector('.studio-contatore');
        const n = unaRiga(el.value) ? unaRiga(el.value).split(' ').length : 0;
        if (c) { c.textContent = t('studio.parole', { n }); c.classList.toggle('troppo', n > STUDIO_PAROLE_BAMBINI); }
      }
      aggiornaVivi();
    });
    r.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'studio-progetti') {
        const scelto = studio.progetti.find(x => x.id === el.value);
        if (scelto) apri(scelto);
        return;
      }
      // La voce di una battuta: un file audio, misurato e tenuto nel browser
      if (el.dataset && el.dataset.voce) {
        const file = el.files && el.files[0];
        if (file) caricaVoce(el.dataset.voce, file).finally(() => { el.value = ''; });
        return;
      }
      // La musica di sottofondo (v440): un file, una scelta del menu, il volume
      if (el.dataset && el.dataset.musica) {
        const file = el.files && el.files[0];
        if (file) caricaMusica(el.dataset.musica, file).finally(() => { el.value = ''; });
        return;
      }
      if (el.dataset && el.dataset.musicaScelta) { sceltaMusica(el.dataset.musicaScelta, el.value); return; }
      // v444: il suono di un'azione (un file, o la scelta del menu) e i filtri delle voci
      if (el.dataset && el.dataset.suono) {
        const file = el.files && el.files[0];
        if (file) caricaSuono(el.dataset.suono, file).finally(() => { el.value = ''; });
        return;
      }
      if (el.dataset && el.dataset.suonoScelta) {
        const az = leggi(el.dataset.suonoScelta);
        if (az) {
          if (el.value === 'file') az.fonte = az.file ? 'file' : 'sintesi';
          else if (el.value.startsWith('sint:')) { az.fonte = 'sintesi'; az.suono = el.value.slice(5); }
          salvaPresto(); disegna();
        }
        return;
      }
      if (el.dataset && el.dataset.elAmbito) { if (studio.elScelta) studio.elScelta.ambito = el.value; return; }
      if (el.dataset && el.dataset.elFiltro) {
        const c = studio.elScelta;
        if (c) {
          c[el.dataset.elFiltro] = el.value;
          const campo = studio.radice.querySelector('[data-el-cerca]');
          c.cerca = campo ? campo.value : c.cerca;
          cercaVoci();
        }
        return;
      }
      if (el.dataset && (el.dataset.elMusica || el.dataset.elCerca)) return;
      if (el.dataset && el.dataset.musicaVolume) {
        const di = musicaDi(el.dataset.musicaVolume);
        if (di && di.mu) {
          di.mu.volume = Math.max(0.05, Math.min(1, (Number(el.value) || 35) / 100));
          if (ascoltoMusica && ascoltoMusica.dove === el.dataset.musicaVolume) ascoltoMusica.audio.volume = di.mu.volume;
          salvaPresto(); aggiornaVivi();
        }
        return;
      }
      if (el.id === 'studio-importa') {
        const file = el.files && el.files[0];
        if (!file) return;
        file.text().then(testo => {
          const p = studioRipulisci(JSON.parse(testo));
          p.id = nuovoId('p'); p.demoChiave = null;
          apri(p);
        }).catch(() => esito(t('studio.err.file'))).finally(() => { el.value = ''; });
        return;
      }
      if (el.dataset.campo) {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.dataset.numero) v = Math.max(0, Number(v) || 0);
        if (/\.(volte|scala|grandezza|volume)$/.test(el.dataset.campo)) v = Number(v) || 0;
        scrivi(el.dataset.campo, v);
        // La camera scelta dal menu decide anche la vecchia casella, che le
        // copie salvate prima della v431 leggono ancora
        if (/\.camera$/.test(el.dataset.campo)) {
          const sc = leggi(el.dataset.campo.replace(/\.camera$/, ''));
          if (sc) sc.cameraViva = v !== 'ferma';
        }
        salvaPresto();
        // Solo una scelta cambia i campi da mostrare. Ridisegnare dopo un
        // campo di testo o di numero vorrebbe dire rifare la pagina proprio
        // mentre il dito sta premendo il bottone accanto: il clic si perde.
        // La data e l'ora cambiano soltanto il riassunto della scena.
        if (el.tagName === 'SELECT' || el.dataset.campo === 'domanda.attiva') disegna();
        else {
          aggiornaVivi();
          const det = el.closest('.studio-dettagli');
          const sc = det && leggi(el.dataset.campo.split('.').slice(0, 2).join('.'));
          const piccolo = det && det.querySelector('summary small');
          if (sc && piccolo) piccolo.textContent = ' · ' + riassuntoScena(sc);
        }
      }
    });
  }

  // ===================================================================
  // 8. Le due linguette della pagina Demo
  // ===================================================================

  /* La pagina Demo era una colonna sola di sette gruppi: le storie stavano
   * in fondo, dopo le impostazioni dell'audio. Adesso sono una linguetta a
   * parte, «Storie cosmiche», con le storie pronte, l'anteprima e lo Studio.
   * La scelta si ricorda (per questo dispositivo). */
  const CHIAVE_SCHEDA = 'astrocal_demo_scheda_v1';
  function studioSchede() {
    const barra = document.getElementById('demo-schede');
    if (!barra) return;
    const schede = Array.from(barra.querySelectorAll('[role="tab"]'));
    const mostra = (id, fuoco) => {
      for (const s of schede) {
        const acceso = s.id === id;
        s.setAttribute('aria-selected', String(acceso));
        s.tabIndex = acceso ? 0 : -1;
        s.classList.toggle('attiva', acceso);
        const pannello = document.getElementById(s.getAttribute('aria-controls'));
        if (pannello) pannello.hidden = !acceso;
      }
      try { radice.localStorage.setItem(CHIAVE_SCHEDA, id); } catch (_) { /* senza memoria si riparte dalla prima */ }
      if (fuoco) document.getElementById(id).focus();
      if (id === 'demo-scheda-storie' && studio.radice && !studio.radice.childElementCount) disegna();
    };
    barra.addEventListener('click', e => { const s = e.target.closest('[role="tab"]'); if (s) mostra(s.id, false); });
    barra.addEventListener('keydown', e => {
      const i = schede.indexOf(document.activeElement);
      if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % schede.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + schede.length) % schede.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = schede.length - 1;
      if (j !== null) { e.preventDefault(); mostra(schede[j].id, true); }
    });
    let iniziale = 'demo-scheda-demo';
    try { const v = radice.localStorage.getItem(CHIAVE_SCHEDA); if (schede.some(s => s.id === v)) iniziale = v; } catch (_) { /* di serie */ }
    // Chi arriva da un link di una demo vuole la prima linguetta
    if (/[?#&]demo=/.test(String(radice.location && radice.location.href))) iniziale = 'demo-scheda-demo';
    mostra(iniziale, false);
    radice.demoMostraScheda = id => mostra(id, false);
  }

  function studioAvvia() {
    if (typeof document === 'undefined') return;
    studioSchede();
    const r = document.getElementById('studio-radice');
    if (!r) return;
    studio.radice = r;
    studio.progetti = studioCaricaTutti();
    studio.progetto = studio.progetti[0] || studioDaModello('fasi');
    collega(r);
    disegna();
    // le storie dello Studio messe fra le CosmoStorie (v461)
    aggiornaCosmoStorie();
    studioRiprendiVoci().catch(() => null);
    // Le storie salvate dagli altri dispositivi (§6b), in silenzio se non
    // arriva niente: senza rete resta quello che c'è qui
    studioSincronizza({ spingi: false }).then(msg => { aggiornaCosmoStorie(); if (msg && !studio.esito) esito(msg); }).catch(() => null);
    if (haI18n() && typeof radice.astroI18n.alCambio === 'function') radice.astroI18n.alCambio(() => { cacheParole.clear(); disegna(); });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', studioAvvia, { once: true });
    else studioAvvia();
  }

  // ===================================================================
  // 9. Fuori
  // ===================================================================

  const api = {
    STUDIO_SCOPI, STUDIO_AMBIENTI, STUDIO_TIPI, CHIAVE,
    nuovoProgetto: studioNuovoProgetto, nuovaScena: studioNuovaScena, nuovoMomento: studioNuovoMomento, nuovaAzione: studioNuovaAzione,
    daModello: studioDaModello, copione: studioCopione, daCopione: studioDaCopione, rigaDsl: studioRigaDsl, durata: studioDurata, durataTotale: studioDurataTotale,
    umoreDalTesto: studioUmoreDalTesto, ideeAzioni: studioIdeeAzioni, ambientePer: studioAmbientePer,
    prossimoMomento: studioProssimoMomento, capisci: studioCapisci, applica: studioApplica, consigli: studioConsigli,
    descriviAzione: studioDescriviAzione, ripulisci: studioRipulisci, presenti: studioPresenti,
    unisci: studioUnisci, fileCondivise: studioFileCondivise, leggiCondivise: studioLeggiCondivise, repoDiSerie: studioRepoDiSerie,
    sincronizza: studioSincronizza, FILE_CONDIVISE,
    domandaFinale: studioDomandaFinale, fattiEpisodio: studioFattiEpisodio, nuovaDomanda: studioNuovaDomanda,
    STUDIO_TIPI_DOMANDA, STUDIO_MODI_DOMANDA, STUDIO_KIND_DOMANDA,
    vociStoria: studioVociStoria, impronta: studioImpronta, voceValida: studioVoceValida, fileVoci: studioFileVoci, chiaveVoci: studioChiaveVoci, CHIAVE_VOCI,
    // v440: la musica di sottofondo (§4-ter)
    musicaSrc: studioMusicaSrc, percorsoMusica: studioPercorsoMusica, musicheVolute: studioMusicheVolute, pulisciMusica: studioPulisciMusica,
    caricaMusica, togliMusica, sceltaMusica, riprendiVoci: studioRiprendiVoci, STUDIO_MUSICA_CARTELLA,
    // v444: ElevenLabs (§6c) e i suoni da file
    testoPerVoce: studioTestoPerVoce, facciaParlata: studioFacciaParlata, tagVoce: studioTagVoce, firmaTag: studioFirmaTag, tonoCambiato: studioTonoCambiato, STUDIO_TONI,
    voceDaEleven: studioVoceDaEleven, filtraVoci: studioFiltraVoci, voceDi: studioVoceDi, voceDaRifare: studioVoceDaRifare,
    pulisciVoci: studioPulisciVoci, pulisciSuono: studioPulisciSuono, elevenImpostazioni: studioElevenImpostazioni,
    caricaSuono, ELEVEN_TAG_UMORE, CHIAVE_ELEVEN,
    ufficiali: studioUfficiali, apriProgetto: studioApriProgetto, apriDaStoria: studioApriDaStoria,
    apri: p => { studio.progetto = p; if (!studio.progetti.some(x => x.id === p.id)) studio.progetti.unshift(p); },
    get progetto() { return studio.progetto; }, ridisegna: () => disegna()
  };
  radice.StudioStorie = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
