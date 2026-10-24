/* Libreria di soli dati. Storage e validatore sono iniettati per le prove. */
(function (radice) {
  'use strict';
  const CHIAVE = 'astrocal_demo_utente_v1';
  // Stesso patto del motore: `demo.err.*` quando il gestore delle lingue
  // c'è, la frase italiana nelle prove Node.
  const RIPIEGHI = {
    archivio: 'Archivio demo non valido: esporta una copia dei dati prima di ripristinarlo.',
    solaLettura: 'Demo predefinita di sola lettura: duplicala.',
    nonTrovata: 'Demo utente non trovata.',
    spazio: 'Spazio del browser esaurito: la demo non è stata salvata. Elimina qualche demo o storia che non usi più e riprova.'
  };
  function messaggio(chiave) {
    const i18n = radice.astroI18n;
    if (i18n && typeof i18n.esiste === 'function' && i18n.esiste('demo.err.' + chiave))
      return i18n.t('demo.err.' + chiave);
    return RIPIEGHI[chiave];
  }
  /* La compressione dei copioni (v518). Le demo dell'utente stavano in
   * `localStorage` come JSON in chiaro, e ogni storia dello Studio ci mette
   * il suo copione (fino a centomila caratteri): con una ventina di storie
   * la chiave da sola si mangiava i cinque mega che il browser concede a
   * tutta l'app, insieme a progetti, terreno e paesi, e «Salva» finiva con
   * «Setting the value of 'astrocal_demo_utente_v1' exceeded the quota».
   * Un copione è fatto di poche parole ripetute (`action:`, `scene`,
   * `duration:`…): un LZ78 alla maniera di lz-string, a 15 bit per carattere
   * (tutti fra U+0020 e U+801F, quindi niente surrogati spaiati che il
   * browser rifiuti), lo riduce a un quinto-un decimo. Il salvataggio vecchio,
   * in chiaro, si legge ancora: si riscrive compresso alla prima modifica. */
  const PREFISSO_LZ = 'lz1:';
  function comprimi(testo) {
    const dizionario = new Map(), daCreare = new Set(), uscita = [];
    let w = '', allarga = 2, prossimo = 3, bit = 2, valore = 0, posto = 0;
    function scrivi(v, n) {
      for (let i = 0; i < n; i++) {
        valore = (valore << 1) | (v & 1); v >>= 1;
        if (posto === 14) { uscita.push(String.fromCharCode(valore + 32)); valore = 0; posto = 0; } else posto++;
      }
    }
    function cresci() { if (--allarga === 0) { allarga = 2 ** bit; bit++; } }
    function emetti(p) {
      if (daCreare.has(p)) {
        const c = p.charCodeAt(0);
        if (c < 256) { scrivi(0, bit); scrivi(c, 8); } else { scrivi(1, bit); scrivi(c, 16); }
        cresci(); daCreare.delete(p);
      } else scrivi(dizionario.get(p), bit);
      cresci();
    }
    for (let i = 0; i < testo.length; i++) {
      const c = testo.charAt(i);
      if (!dizionario.has(c)) { dizionario.set(c, prossimo++); daCreare.add(c); }
      const wc = w + c;
      if (dizionario.has(wc)) w = wc;
      else { emetti(w); dizionario.set(wc, prossimo++); w = c; }
    }
    if (w !== '') emetti(w);
    scrivi(2, bit);
    for (;;) {
      valore <<= 1;
      if (posto === 14) { uscita.push(String.fromCharCode(valore + 32)); break; } else posto++;
    }
    return uscita.join('') + ' ';
  }
  function decomprimi(s) {
    const diz = [0, 1, 2], risultato = [];
    let allarga = 4, prossimo = 4, bit = 3, w = '', indice = 1;
    let dato = s.charCodeAt(0) - 32, posto = 16384;
    function leggi(n) {
      let v = 0;
      for (let p = 0; p < n; p++) {
        if (dato & posto) v |= 1 << p;
        posto >>= 1;
        if (posto === 0) { posto = 16384; dato = s.charCodeAt(indice++) - 32; }
      }
      return v;
    }
    const primo = leggi(2);
    if (primo === 2) return '';
    if (primo > 2) throw new Error(messaggio('archivio'));
    w = String.fromCharCode(leggi(primo === 0 ? 8 : 16));
    diz[3] = w; risultato.push(w);
    for (;;) {
      if (indice > s.length) throw new Error(messaggio('archivio'));
      let c = leggi(bit);
      if (c === 2) return risultato.join('');
      if (c < 2) { diz[prossimo++] = String.fromCharCode(leggi(c === 0 ? 8 : 16)); c = prossimo - 1; if (--allarga === 0) { allarga = 2 ** bit; bit++; } }
      let voce;
      if (c < prossimo && diz[c] !== undefined) voce = diz[c];
      else if (c === prossimo) voce = w + w.charAt(0);
      else throw new Error(messaggio('archivio'));
      risultato.push(voce);
      diz[prossimo++] = w + voce.charAt(0);
      w = voce;
      if (--allarga === 0) { allarga = 2 ** bit; bit++; }
    }
  }
  function eQuota(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message || '')));
  }
  function crea(storage, predefiniti, valida) {
    const base = predefiniti.map(d => ({ ...d, solaLettura: true }));
    // `elenco` si chiama spesso (le schede delle CosmoStorie, le voci del
    // filmato) e «Salva» riscrive tutto l'archivio: ogni copione si
    // comprime e si decomprime una volta sola, non a ogni chiamata
    const compressi = new Map(), chiari = new Map();
    function leggiGrezzo() {
      return daGrezzo(storage.getItem(CHIAVE), z => {
        if (!chiari.has(z)) { const t = decomprimi(z); chiari.set(z, t); compressi.set(t, z); }
        return chiari.get(z);
      });
    }
    /* Scrive l'archivio compresso. Se il browser dice che lo spazio è finito,
     * chiede a chi ha creato la libreria (`storage.libera`, in demo.js) di
     * buttare una memoria di comodo che si rifà da sola — il terreno, i paesi,
     * il meteo — e riprova; finite quelle, un messaggio che si capisce al
     * posto dell'eccezione grezza del browser. Un errore di quota/accesso non
     * deve apparire come un salvataggio riuscito. */
    function scrivi(dati) {
      const valore = PREFISSO_LZ + JSON.stringify(dati.map(d => {
        if (!compressi.has(d.testo)) { const z = comprimi(d.testo); compressi.set(d.testo, z); chiari.set(z, d.testo); }
        return { chiave: d.chiave, z: compressi.get(d.testo) };
      }));
      for (let giri = 0; ; giri++) {
        try { storage.setItem(CHIAVE, valore); return; }
        catch (e) {
          if (!eQuota(e)) throw e;
          const liberato = giri < 50 && typeof storage.libera === 'function' && storage.libera(CHIAVE);
          if (!liberato) throw new Error(messaggio('spazio'));
        }
      }
    }
    function utenti() {
      const dati = leggiGrezzo();
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
      scrivi(dati);
      return chiave;
    }
    function elimina(chiave) {
      if (base.some(d => d.chiave === chiave)) throw new Error(messaggio('solaLettura'));
      const dati = utenti();
      if (!dati.some(d => d.chiave === chiave)) throw new Error(messaggio('nonTrovata'));
      scrivi(dati.filter(d => d.chiave !== chiave));
    }
    // Una demo arrivata da un altro dispositivo (le storie dello Studio sul
    // repository, storie-studio.js §6b): tiene la sua chiave, così lo stesso
    // progetto indica la stessa demo dappertutto, e la crea se non c'è.
    function metti(chiave, testo) {
      valida(testo);
      if (typeof chiave !== 'string' || !chiave.startsWith('utente-') || base.some(d => d.chiave === chiave))
        throw new Error(messaggio('solaLettura'));
      const dati = utenti();
      const c = dati.find(d => d.chiave === chiave);
      if (c) c.testo = testo; else dati.push({ chiave, testo });
      scrivi(dati);
      return chiave;
    }
    return { elenco, salva, elimina, metti };
  }
  /* Dal valore salvato all'elenco in chiaro. Due formati: il JSON di prima
   * (`[{chiave, testo}]`) e, dalla v518, `lz1:` seguito da `[{chiave, z}]`,
   * col copione compresso voce per voce (così «Salva» ricomprime solo la demo
   * cambiata). Quello che non torna si lascia a `utenti`, che lo rifiuta. */
  function daGrezzo(grezzo, apri) {
    if (!grezzo) return [];
    if (!grezzo.startsWith(PREFISSO_LZ)) return JSON.parse(grezzo);
    const dati = JSON.parse(grezzo.slice(PREFISSO_LZ.length));
    if (!Array.isArray(dati)) return dati;
    return dati.map(d => d && typeof d.z === 'string' ? { chiave: d.chiave, testo: apri(d.z) } : d);
  }
  // `leggi` per le prove e per chi guarda la chiave da fuori: il contenuto
  // in chiaro, qualunque sia il formato in cui è salvato
  const leggi = grezzo => daGrezzo(grezzo, decomprimi);
  const api = { crea, CHIAVE, comprimi, decomprimi, leggi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else radice.AstroDemoLibreria = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
