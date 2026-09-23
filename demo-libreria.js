/* Libreria di soli dati. Storage e validatore sono iniettati per le prove. */
(function (radice) {
  'use strict';
  const CHIAVE = 'astrocal_demo_utente_v1';
  function crea(storage, predefiniti, valida) {
    const base = predefiniti.map(d => ({ ...d, solaLettura: true }));
    function utenti() {
      const dati = JSON.parse(storage.getItem(CHIAVE) || '[]');
      if (!Array.isArray(dati) || dati.some(d => !d || typeof d.chiave !== 'string' ||
          !d.chiave.startsWith('utente-') || typeof d.testo !== 'string' || d.testo.length > 100000) ||
          new Set(dati.map(d => d.chiave)).size !== dati.length)
        throw new Error('Archivio demo non valido: esporta una copia dei dati prima di ripristinarlo.');
      return dati.map(d => ({ chiave: d.chiave, testo: d.testo, solaLettura: false }));
    }
    function elenco() { return [...base.map(d => ({ ...d })), ...utenti()]; }
    function salva(testo, chiave) {
      valida(testo);
      if (base.some(d => d.chiave === chiave)) throw new Error('Demo predefinita di sola lettura: duplicala.');
      const dati = utenti();
      if (chiave && !dati.some(d => d.chiave === chiave)) throw new Error('Demo utente non trovata.');
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
      if (base.some(d => d.chiave === chiave)) throw new Error('Demo predefinita di sola lettura.');
      const dati = utenti();
      if (!dati.some(d => d.chiave === chiave)) throw new Error('Demo utente non trovata.');
      storage.setItem(CHIAVE, JSON.stringify(dati.filter(d => d.chiave !== chiave)));
    }
    return { elenco, salva, elimina };
  }
  const api = { crea, CHIAVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else radice.AstroDemoLibreria = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
