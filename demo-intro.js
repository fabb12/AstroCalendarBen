/* L'intro comune delle demo: qualche secondo di nero col logo e un titolo,
 * prima della prima scena. È una cosa sola per tutte le demo — predefinite,
 * personali, importate — e sta qui invece che dentro a ogni tour: il motore
 * (`demo-motore.js`) la riceve dal contesto come fase che precede la prima
 * scena, e `demo.js` si limita a chiederla a questo modulo.
 *
 * Tre cose vivono qui.
 *  1. Le **preferenze** (mostrarla, quanto dura, il titolo e se mostrarlo),
 *     in `localStorage`, con un valore di ripiego per ognuna.
 *  2. Il **logo**. Quello predefinito è il logo dedicato delle demo; quello personale
 *     si salva così com'è arrivato — il file, non una copia ricompressa —
 *     in IndexedDB, che è il solo posto in cui un'immagine di qualche
 *     megabyte stia senza passare per un data URL. Proporzioni, trasparenza
 *     e qualità restano quelle del file perché il file è quello.
 *  3. Il **disegno**: un velo nero con dentro logo e titolo, lo stesso nodo
 *     per l'intro vera, per l'anteprima nel riquadro della pagina Demo e per
 *     l'anteprima completa. Le misure sono scritte in unità del contenitore
 *     (`cqw`, `cqh`), quindi il riquadro piccolo è la stessa impaginazione
 *     dello schermo intero in scala, e non una sua imitazione.
 *
 * Prefisso dei nomi: `intro`. Oggetto esportato: `window.AstroDemoIntro`. */
(function () {
  'use strict';
  const CHIAVE = 'astrocal_demo_intro_v1';
  const LOGO_PREDEFINITO = 'demo-logo-256.jpg';
  const DURATA = { predefinita: 3, min: 1, max: 10, passo: 0.5 };
  const TITOLO_MAX = 120;
  // Un logo non ha bisogno di otto megabyte; ma rifiutare un PNG pesante
  // perché «troppo grande» sarebbe un modo di rovinarne la qualità, che è
  // proprio quello che la richiesta chiede di non fare.
  const LOGO_MAX_BYTE = 8 * 1024 * 1024;
  const DB_NOME = 'astrocal_demo_intro', DB_ARCHIVIO = 'file', DB_CHIAVE = 'logo';
  // Quanto dura la sparizione del nero, a prima scena già aperta sotto.
  const USCITA_MS = 450;
  const t = (chiave, dati) => (typeof astroI18n === 'object' ? astroI18n.t('demo.intro.' + chiave, dati) : chiave);

  // ------------------------------------------------------------------
  // 1. Le preferenze
  // ------------------------------------------------------------------
  function normalizza(o) {
    // `Number(null)` vale zero, non NaN: senza guardare il tipo un
    // salvataggio che non c'è diventerebbe un'intro di un secondo.
    const d = o && (typeof o.durataSec === 'number' || typeof o.durataSec === 'string') && o.durataSec !== ''
      ? Number(o.durataSec) : NaN;
    const durataSec = Number.isFinite(d)
      ? Math.min(DURATA.max, Math.max(DURATA.min, Math.round(d / DURATA.passo) * DURATA.passo))
      : DURATA.predefinita;
    return {
      attiva: !(o && o.attiva === false),
      durataSec,
      // `null` vuol dire «il titolo predefinito», che segue la lingua: un
      // titolo scritto a mano no, resta com'è stato scritto.
      titolo: o && typeof o.titolo === 'string' ? o.titolo.slice(0, TITOLO_MAX) : null,
      mostraTitolo: !(o && o.mostraTitolo === false)
    };
  }
  let preferenze = (() => {
    try { return normalizza(JSON.parse(localStorage.getItem(CHIAVE) || 'null')); }
    catch (_) { return normalizza(null); }
  })();
  const ascoltatori = new Set();
  function avvisa() { for (const f of ascoltatori) { try { f(); } catch (_) { /* un disegno rotto non ferma gli altri */ } } }
  function imposta(nuove) {
    preferenze = normalizza(Object.assign({}, preferenze, nuove));
    try { localStorage.setItem(CHIAVE, JSON.stringify(preferenze)); } catch (_) { /* niente storage: vale per la sessione */ }
    avvisa();
    return impostazioni();
  }
  function impostazioni() { return Object.assign({}, preferenze); }
  const titoloPredefinito = () => t('titoloPredefinito');
  function titoloCorrente() {
    return preferenze.titolo === null ? titoloPredefinito() : preferenze.titolo;
  }
  function titoloDaMostrare() {
    return preferenze.mostraTitolo ? titoloCorrente().trim() : '';
  }

  // ------------------------------------------------------------------
  // 2. Il logo
  // ------------------------------------------------------------------
  const logo = {
    url: LOGO_PREDEFINITO,   // quello da disegnare adesso
    personale: false,        // se è quello scelto dalla persona
    nome: '',                // il nome del file scelto
    oggetto: null,           // l'object URL da revocare quando cambia
    stato: 'predefinito',    // predefinito | personale | caricamento | guasto | nonSalvato
    persistente: true        // false se IndexedDB non c'è: vale per la sessione
  };
  function apriDb() {
    return new Promise((ok, no) => {
      if (typeof indexedDB === 'undefined') { no(new Error('indexedDB')); return; }
      let r;
      try { r = indexedDB.open(DB_NOME, 1); } catch (e) { no(e); return; }
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(DB_ARCHIVIO)) r.result.createObjectStore(DB_ARCHIVIO); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error || new Error('indexedDB'));
      r.onblocked = () => no(new Error('indexedDB bloccato'));
    });
  }
  async function operaDb(modo, fa) {
    const db = await apriDb();
    try {
      return await new Promise((ok, no) => {
        const tx = db.transaction(DB_ARCHIVIO, modo), archivio = tx.objectStore(DB_ARCHIVIO);
        let risultato;
        const r = fa(archivio);
        if (r) r.onsuccess = () => { risultato = r.result; };
        tx.oncomplete = () => ok(risultato);
        tx.onerror = () => no(tx.error || new Error('indexedDB'));
        tx.onabort = () => no(tx.error || new Error('indexedDB'));
      });
    } finally { db.close(); }
  }
  // Un'immagine si giudica decodificandola: il tipo dichiarato non basta
  // (un file rinominato in .png lo dichiara lo stesso), e un file troncato
  // si scopre solo così. Si risponde con le misure naturali.
  function decodifica(url) {
    return new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => (img.naturalWidth > 0 && img.naturalHeight > 0) ? ok({ l: img.naturalWidth, h: img.naturalHeight })
        : no(new Error('vuota'));
      img.onerror = () => no(new Error('illeggibile'));
      img.src = url;
    });
  }
  function usaPredefinito(stato = 'predefinito') {
    if (logo.oggetto) { try { URL.revokeObjectURL(logo.oggetto); } catch (_) { /* niente */ } }
    Object.assign(logo, { url: LOGO_PREDEFINITO, personale: false, nome: '', oggetto: null, stato });
  }
  async function usaBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    try { await decodifica(url); }
    catch (e) { URL.revokeObjectURL(url); throw e; }
    if (logo.oggetto) { try { URL.revokeObjectURL(logo.oggetto); } catch (_) { /* niente */ } }
    Object.assign(logo, { url, personale: true, nome: nome || '', oggetto: url, stato: 'personale' });
  }
  // Letto una volta all'avvio. Un logo salvato che non si decodifica più —
  // un archivio rovinato, un file che il browser non sa più leggere — si
  // butta: tenerlo vorrebbe dire rifiutarlo a ogni apertura per sempre.
  const pronto = (async () => {
    logo.stato = 'caricamento';
    let voce;
    try { voce = await operaDb('readonly', a => a.get(DB_CHIAVE)); }
    catch (_) { usaPredefinito(); avvisa(); return; }
    if (!voce || !(voce.blob instanceof Blob)) { usaPredefinito(); avvisa(); return; }
    try { await usaBlob(voce.blob, voce.nome); }
    catch (_) {
      usaPredefinito('guasto');
      try { await operaDb('readwrite', a => a.delete(DB_CHIAVE)); } catch (_) { /* resterà da buttare la prossima volta */ }
    }
    avvisa();
  })();

  // Sostituisce il logo. Tutto quello che può andare storto si controlla
  // **prima** di toccare quello di adesso: un file sbagliato non deve
  // lasciare la persona senza logo.
  async function sostituisciLogo(file) {
    // Se la lettura d'avvio è ancora in corso, finisce prima: se no potrebbe
    // rimettere il logo di prima sopra a quello appena scelto.
    await pronto.catch(() => {});
    if (!(file instanceof Blob)) throw new Error(t('logoNessunFile'));
    if (file.type && !/^image\//.test(file.type)) throw new Error(t('logoNonImmagine'));
    if (file.size > LOGO_MAX_BYTE) throw new Error(t('logoTroppoGrande', { mb: Math.round(LOGO_MAX_BYTE / 1048576) }));
    if (!file.size) throw new Error(t('logoIllegibile'));
    const prova = URL.createObjectURL(file);
    try { await decodifica(prova); }
    catch (_) { throw new Error(t('logoIllegibile')); }
    finally { URL.revokeObjectURL(prova); }
    // Si salva il file così com'è arrivato: nessuna ricompressione, nessun
    // ridimensionamento, trasparenza intatta.
    const nome = typeof file.name === 'string' ? file.name.slice(0, 120) : '';
    let persistente = true;
    try { await operaDb('readwrite', a => a.put({ blob: file, nome, tipo: file.type || '', quando: Date.now() }, DB_CHIAVE)); }
    catch (_) { persistente = false; }
    await usaBlob(file, nome);
    logo.persistente = persistente;
    if (!persistente) logo.stato = 'nonSalvato';
    avvisa();
    return statoLogo();
  }
  async function ripristinaLogo() {
    await pronto.catch(() => {});
    try { await operaDb('readwrite', a => a.delete(DB_CHIAVE)); } catch (_) { /* niente archivio: niente da togliere */ }
    usaPredefinito();
    logo.persistente = true;
    avvisa();
    return statoLogo();
  }
  function statoLogo() {
    return { url: logo.url, personale: logo.personale, nome: logo.nome, stato: logo.stato, predefinito: LOGO_PREDEFINITO };
  }

  // ------------------------------------------------------------------
  // 3. Il disegno
  // ------------------------------------------------------------------
  // Il titolo si impagina da sé (a capo equilibrato, corpo che scende col
  // riquadro), ma un titolo di cento caratteri e uno di dieci non possono
  // avere lo stesso corpo: la lunghezza sceglie la scala, e il resto lo fa
  // il CSS.
  function misuraTitolo(testo) {
    const n = [...testo].length;
    return n <= 24 ? 'corto' : n <= 60 ? 'medio' : 'lungo';
  }
  // Riempie un velo (quello dell'intro o quello dell'anteprima) con lo
  // stato di adesso. Se il logo personale non si carica, torna da sé a
  // quello predefinito: la persona non deve mai vedere l'icona rotta.
  function riempi(velo) {
    let contenuto = velo.querySelector('.demo-intro-contenuto');
    if (!contenuto) {
      contenuto = document.createElement('div');
      contenuto.className = 'demo-intro-contenuto';
      const img = document.createElement('img');
      img.className = 'demo-intro-logo'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
      const titolo = document.createElement('p');
      titolo.className = 'demo-intro-titolo';
      contenuto.append(img, titolo);
      velo.append(contenuto);
    }
    const img = contenuto.querySelector('.demo-intro-logo');
    img.onerror = () => {
      if (img.getAttribute('src') !== LOGO_PREDEFINITO) img.setAttribute('src', LOGO_PREDEFINITO);
      else img.hidden = true;
    };
    img.hidden = false;
    if (img.getAttribute('src') !== logo.url) img.setAttribute('src', logo.url);
    const testo = titoloDaMostrare();
    const titolo = contenuto.querySelector('.demo-intro-titolo');
    titolo.textContent = testo;
    titolo.hidden = !testo;
    titolo.dataset.misura = misuraTitolo(testo);
    velo.classList.toggle('senza-titolo', !testo);
    velo.setAttribute('aria-label', testo || t('etichetta'));
    return velo;
  }
  function creaVelo(classe) {
    const velo = document.createElement('div');
    velo.className = 'demo-intro ' + classe;
    velo.setAttribute('role', 'img');
    return riempi(velo);
  }
  const ridotto = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Dove attaccare il velo: dentro all'elemento a schermo intero se ce n'è
  // uno (il top layer copre tutto il resto), se no al body. Il pieno
  // schermo della demo è quello del documento intero, e lì il body basta.
  function ospite() {
    const fe = document.fullscreenElement;
    return fe && fe !== document.documentElement ? fe : document.body;
  }
  const liscia = x => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  // La coreografia, in millisecondi veri e non in frazioni: un'intro di
  // dieci secondi non deve comparire in tre secondi e mezzo. Il nero c'è
  // dal primo istante — è quello che copre la pagina di prima, e a schermo
  // intero è quello che evita il lampo dell'interfaccia —; il logo sale per
  // primo, il titolo lo segue di un soffio, e tutti e due tornano nel nero
  // prima che il nero se ne vada.
  function coreografia(velo, tMs, durataMs, statico) {
    const contenuto = velo.querySelector('.demo-intro-contenuto');
    if (!contenuto) return;
    const logoEl = contenuto.querySelector('.demo-intro-logo'), titolo = contenuto.querySelector('.demo-intro-titolo');
    if (statico) {
      logoEl.style.opacity = titolo.style.opacity = '1';
      logoEl.style.transform = titolo.style.transform = 'none';
      return;
    }
    const D = Math.max(1, durataMs);
    const entrata = Math.min(800, D * 0.3), uscita = Math.min(650, D * 0.22), inizio = Math.min(180, D * 0.06);
    const fuori = liscia((tMs - (D - uscita)) / uscita);
    const dentroLogo = liscia((tMs - inizio) / entrata);
    const dentroTitolo = liscia((tMs - inizio - Math.min(220, D * 0.08)) / entrata);
    logoEl.style.opacity = String(dentroLogo * (1 - fuori));
    logoEl.style.transform = `scale(${(0.955 + 0.045 * dentroLogo).toFixed(4)})`;
    titolo.style.opacity = String(dentroTitolo * (1 - fuori));
    titolo.style.transform = `translateY(${((1 - dentroTitolo) * 0.6).toFixed(3)}em)`;
  }

  // L'intro della demo in corso: un velo solo, e al più uno.
  let corrente = null;
  function rimuovi() {
    const v = corrente;
    corrente = null;
    if (!v) return;
    if (v.timer) clearTimeout(v.timer);
    v.el.remove();
  }
  // L'oggetto che il motore riceve dal contesto. Il velo nasce subito,
  // nero pieno, nello stesso turno del clic che avvia la demo.
  function crea(opz = {}) {
    if (!preferenze.attiva) return null;
    rimuovi();
    const durataMs = preferenze.durataSec * 1000;
    const statico = ridotto();
    const el = creaVelo('demo-intro-schermo');
    el.dataset.fase = 'dentro';
    el.classList.toggle('demo-intro-statica', statico);
    ospite().append(el);
    const v = { el, timer: null };
    corrente = v;
    coreografia(el, 0, durataMs, statico);
    return {
      durata: durataMs,
      aggiorna(u) {
        if (corrente !== v) return;
        const casa = ospite();
        if (el.parentNode !== casa) casa.append(el);
        coreografia(el, u * durataMs, durataMs, statico);
        if (opz.controlla) opz.controlla();
      },
      // La prima scena è già aperta sotto: il nero se ne va con una
      // dissolvenza breve (nessuna col movimento ridotto) e il nodo sparisce.
      fine() {
        if (corrente !== v) return;
        el.dataset.fase = 'esce';
        if (statico) { rimuovi(); return; }
        v.timer = setTimeout(() => { if (corrente === v) rimuovi(); }, USCITA_MS + 80);
      },
      chiudi() { if (corrente === v) rimuovi(); }
    };
  }

  // L'anteprima completa: la stessa intro, su tutto lo schermo, senza demo.
  // Si chiude da sé, con un clic, con Esc.
  let anteprimaViva = null;
  function chiudiAnteprima() {
    const a = anteprimaViva;
    anteprimaViva = null;
    if (!a) return;
    cancelAnimationFrame(a.raf); clearTimeout(a.timer);
    document.removeEventListener('keydown', a.tasto, true);
    a.el.remove();
    if (a.fuoco && typeof a.fuoco.focus === 'function') { try { a.fuoco.focus({ preventScroll: true }); } catch (_) { /* niente */ } }
  }
  function anteprima() {
    chiudiAnteprima();
    const durataMs = preferenze.durataSec * 1000, statico = ridotto();
    const el = creaVelo('demo-intro-schermo demo-intro-anteprima-completa');
    el.dataset.fase = 'dentro';
    el.classList.toggle('demo-intro-statica', statico);
    el.tabIndex = -1;
    const a = { el, raf: 0, timer: 0, fuoco: document.activeElement, inizio: performance.now() };
    a.tasto = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); chiudiAnteprima(); } };
    el.addEventListener('click', chiudiAnteprima);
    document.addEventListener('keydown', a.tasto, true);
    ospite().append(el);
    try { el.focus({ preventScroll: true }); } catch (_) { /* niente */ }
    anteprimaViva = a;
    const passo = () => {
      if (anteprimaViva !== a) return;
      const tMs = performance.now() - a.inizio;
      coreografia(el, tMs, durataMs, statico);
      if (tMs < durataMs) { a.raf = requestAnimationFrame(passo); return; }
      el.dataset.fase = 'esce';
      a.timer = setTimeout(chiudiAnteprima, statico ? 0 : USCITA_MS + 80);
    };
    passo();
    return el;
  }

  // Il riquadro fermo della pagina Demo: logo e titolo nella posa di mezzo
  // dell'intro, cioè come si vedono quando si vedono meglio.
  function disegnaRiquadro(riquadro) {
    if (!riquadro) return;
    riquadro.classList.add('demo-intro', 'demo-intro-riquadro');
    riquadro.setAttribute('role', 'img');
    riempi(riquadro);
    coreografia(riquadro, 0, 1, true);
  }

  // Il titolo predefinito segue la lingua: si ridisegna chi lo mostra.
  if (typeof astroI18n === 'object' && typeof astroI18n.alCambio === 'function') astroI18n.alCambio(avvisa);

  window.AstroDemoIntro = {
    DURATA, TITOLO_MAX, LOGO_PREDEFINITO, LOGO_MAX_BYTE, CHIAVE,
    impostazioni, imposta, titoloPredefinito, titoloCorrente, titoloDaMostrare,
    ripristinaTitolo: () => imposta({ titolo: null }),
    sostituisciLogo, ripristinaLogo, statoLogo, pronto,
    crea, rimuovi, anteprima, chiudiAnteprima, disegnaRiquadro,
    get attiva() { return !!corrente; },
    alCambio(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); }
  };
})();
