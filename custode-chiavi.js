/* =====================================================================
 * Il custode delle chiavi
 * =====================================================================
 *
 * La chiave di ElevenLabs, il token di GitHub dello Studio, il collegamento
 * di YouTube e le voci scelte per i personaggi stanno in `localStorage`,
 * fuori dal backup apposta (sono segreti, non dati da passare in giro). Il
 * difetto segnalato (v529): «ogni volta che apro da PC e c'è un
 * aggiornamento perdo i token di ElevenLabs, GitHub…». L'app non li
 * cancella mai — nessun `removeItem` né `clear` su quelle chiavi, e
 * l'aggiornamento del service worker tocca solo le sue cache — ma il browser
 * sì, e tutti insieme: chi per vedere la versione nuova «svuota la cache» o
 * cancella i dati del sito li porta via con lei; Chrome, a disco quasi
 * pieno, sfratta i siti che non hanno chiesto la memoria persistente; e
 * un'app aperta da un indirizzo diverso (un'altra porta, un'anteprima) ha
 * un `localStorage` tutto suo, vuoto.
 *
 * Due rimedi, uno per dove gira l'app:
 *
 *   - **nell'app per computer** (`desktop/`, Electron) le chiavi hanno una
 *     seconda casa fuori dai dati del browser: la cassaforte del programma,
 *     cifrata dal sistema operativo (`desktop/main.js` §3). Qui, prima che
 *     parta `app.js`, si rimette in `localStorage` ogni chiave che manca; e
 *     ogni chiave che cambia (scritta, «Dimentica») si ricopia di là;
 *   - **nel browser** non c'è un posto fuori dal sito in cui metterle: si
 *     chiede almeno la memoria persistente (`navigator.storage.persist`),
 *     che toglie lo sfratto. Solo quando una chiave c'è: a chi non ne ha non
 *     si chiede niente (Firefox lo domanda con un riquadro).
 *
 * Chi aggiunge una credenziale nuova la aggiunge a `CUSTODE_CHIAVI` **e** a
 * `CHIAVI_CUSTODITE` in `desktop/main.js`: la cassaforte non accetta nomi
 * che non conosce.
 *
 * Si carica prima di `app.js` (index.html) e non usa niente degli altri file.
 * Prova: `node scripts/prova-desktop.js`.
 */
(function () {
  'use strict';

  const CUSTODE_CHIAVI = [
    'astrocal_elevenlabs_v1',
    'astrocal_storie_repo_v1',
    'astrocal_youtube_v1',
    'astrocal_voci_cast_v1'
  ];
  const CUSTODE_GIRO_MS = 2000;

  let archivio = null;
  try { archivio = window.localStorage; } catch (_) { archivio = null; }
  const leggi = k => { try { return archivio ? archivio.getItem(k) : null; } catch (_) { return null; } };

  // C'è davvero qualcosa da custodire? Lo Studio scrive le impostazioni del
  // repository anche senza token (l'esito dell'ultimo giro), YouTube il
  // canale anche senza ID client: contano solo i campi segreti pieni, e per
  // le voci scelte un elenco non vuoto.
  const SEGRETI = ['chiave', 'token', 'clientId'];
  function pieno(v) {
    if (v === null || v === '') return false;
    let o;
    try { o = JSON.parse(v); } catch (_) { return true; }
    if (!o || typeof o !== 'object') return !!o;
    const segreti = SEGRETI.filter(c => c in o);
    if (segreti.length) return segreti.some(c => typeof o[c] === 'string' && o[c].trim() !== '');
    return Object.keys(o).length > 0;
  }

  const ponte = window.astroDesktop && window.astroDesktop.chiavi &&
    typeof window.astroDesktop.chiavi.tutte === 'function' ? window.astroDesktop.chiavi : null;
  const stato = { rimesse: [], ultime: Object.create(null), protetto: null };

  // --- 1. All'avvio: quello che manca torna dalla cassaforte ------------
  //
  // Una chiave assente (`null`) vuol dire che il browser l'ha persa: l'app
  // non la toglie mai, al più ci scrive un valore vuoto («Dimentica»), e
  // quello si ricopia com'è. Una chiave presente e diversa dalla cassaforte
  // è più nuova (scritta nella pagina prima dell'ultima copia, o la prima
  // volta che si apre il programma): vince lei.
  if (ponte && archivio) {
    let cassa = {};
    try { cassa = ponte.tutte() || {}; } catch (e) { console.warn('custode: cassaforte non letta', e); }
    for (const k of CUSTODE_CHIAVI) {
      const qui = leggi(k);
      if (qui === null && typeof cassa[k] === 'string') {
        try { archivio.setItem(k, cassa[k]); stato.rimesse.push(k); } catch (_) { /* pieno: resta la cassaforte */ }
      } else if (qui !== null && qui !== cassa[k]) {
        ponte.scrivi(k, qui);
      }
      stato.ultime[k] = leggi(k);
    }
    if (stato.rimesse.length) console.info('custode: chiavi rimesse dalla cassaforte', stato.rimesse);
  }

  // --- 2. Poi: ogni cambio si ricopia -----------------------------------
  //
  // Un giro ogni due secondi su quattro `getItem` è niente, e non chiede ai
  // moduli di avvisare: lo Studio, YouTube e le voci del filmato scrivono
  // come hanno sempre scritto. Alla chiusura (`pagehide`) un giro in più,
  // per non perdere quello scritto nell'ultimo istante.
  function controlla() {
    if (!archivio) return;
    for (const k of CUSTODE_CHIAVI) {
      const v = leggi(k);
      if (v === stato.ultime[k]) continue;
      stato.ultime[k] = v;
      if (ponte) {
        // `null` dopo una chiave che c'era: dati del sito cancellati a
        // programma aperto. Non si svuota la cassaforte; la si rimette.
        if (v === null) {
          const cassa = (() => { try { return ponte.tutte() || {}; } catch (_) { return {}; } })();
          if (typeof cassa[k] === 'string') {
            try { archivio.setItem(k, cassa[k]); stato.ultime[k] = cassa[k]; stato.rimesse.push(k); } catch (_) { /* resta in cassaforte */ }
          }
          continue;
        }
        ponte.scrivi(k, v);
      }
      if (pieno(v)) proteggi();
    }
  }

  // --- 3. Nel browser: la memoria persistente ---------------------------
  async function proteggi() {
    if (stato.protetto !== null) return stato.protetto;
    if (!CUSTODE_CHIAVI.some(k => pieno(leggi(k)))) return false;
    const s = navigator.storage;
    if (!s || typeof s.persist !== 'function') { stato.protetto = false; return false; }
    stato.protetto = true; // una domanda sola, anche se due giri si incrociano
    try {
      stato.protetto = (typeof s.persisted === 'function' && await s.persisted()) || await s.persist();
    } catch (_) { stato.protetto = false; }
    return stato.protetto;
  }

  if (archivio) {
    setInterval(controlla, CUSTODE_GIRO_MS);
    window.addEventListener('pagehide', controlla);
    document.addEventListener('visibilitychange', controlla);
    // Un'altra finestra dell'app (la guida no, ma un secondo index.html sì)
    window.addEventListener('storage', e => { if (!e.key || CUSTODE_CHIAVI.includes(e.key)) controlla(); });
    proteggi();
  }

  window.astroCustode = Object.freeze({
    CHIAVI: CUSTODE_CHIAVI.slice(),
    get rimesse() { return stato.rimesse.slice(); },
    get protetto() { return stato.protetto; },
    get cassaforte() { return !!ponte; },
    // Quante delle chiavi custodite hanno davvero un segreto dentro
    quante: () => CUSTODE_CHIAVI.filter(k => pieno(leggi(k))).length,
    controlla,
    proteggi
  });
})();
