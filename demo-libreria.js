/* Libreria di soli dati. Storage e validatore sono iniettati per le prove. */
(function (radice) {
  'use strict';
  const CHIAVE = 'astrocal_demo_utente_v1';
  // Stesso patto del motore: `demo.err.*` quando il gestore delle lingue
  // c'è, la frase italiana nelle prove Node.
  const RIPIEGHI = {
    archivio: 'Archivio demo non valido: esporta una copia dei dati prima di ripristinarlo.',
    solaLettura: 'Demo predefinita di sola lettura: duplicala.',
    nonTrovata: 'Demo utente non trovata.'
  };
  function messaggio(chiave) {
    const i18n = radice.astroI18n;
    if (i18n && typeof i18n.esiste === 'function' && i18n.esiste('demo.err.' + chiave))
      return i18n.t('demo.err.' + chiave);
    return RIPIEGHI[chiave];
  }
  function crea(storage, predefiniti, valida) {
    const base = predefiniti.map(d => ({ ...d, solaLettura: true }));
    function utenti() {
      const dati = JSON.parse(storage.getItem(CHIAVE) || '[]');
      if (!Array.isArray(dati) || dati.some(d => !d || typeof d.chiave !== 'string' ||
          !d.chiave.startsWith('utente-') || typeof d.testo !== 'string' || d.testo.length > 100000) ||
          new Set(dati.map(d => d.chiave)).size !== dati.length)
        throw new Error(messaggio('archivio'));
      return dati.map(d => ({ chiave: d.chiave, testo: d.testo, solaLettura: false }));
    }
    function elenco() { return [...base.map(d => ({ ...d })), ...utenti()]; }
    function salva(testo, chiave) {
      valida(testo);
      if (base.some(d => d.chiave === chiave)) throw new Error(messaggio('solaLettura'));
      const dati = utenti();
      if (chiave && !dati.some(d => d.chiave === chiave)) throw new Error(messaggio('nonTrovata'));
      if (!chiave) {
        do { chiave = 'utente-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
        while (dati.some(d => d.chiave === chiave));
        dati.push({ chiave, testo });
      } else dati.find(d => d.chiave === chiave).testo = testo;
      // Un errore di quota/accesso non deve apparire come un salvataggio riuscito.
      storage.setItem(CHIAVE, JSON.stringify(dati.map(d => ({ chiave: d.chiave, testo: d.testo }))));
      return chiave;
    }
    function elimina(chiave) {
      if (base.some(d => d.chiave === chiave)) throw new Error(messaggio('solaLettura'));
      const dati = utenti();
      if (!dati.some(d => d.chiave === chiave)) throw new Error(messaggio('nonTrovata'));
      storage.setItem(CHIAVE, JSON.stringify(dati.filter(d => d.chiave !== chiave)));
    }
    return { elenco, salva, elimina };
  }
  const api = { crea, CHIAVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else radice.AstroDemoLibreria = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
