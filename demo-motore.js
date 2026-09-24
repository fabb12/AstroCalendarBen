/* Motore delle demo: parser dati, registro estensibile e un solo orologio.
 * Nessun eval dello script. Utilizzabile anche con require() nelle prove. */
(function (radice) {
  'use strict';
  // I messaggi d'errore si leggono nell'editor, quindi vanno nella lingua
  // dell'app: con il gestore delle lingue caricato si chiedono a lui
  // (`demo.err.*`), senza — nelle prove Node — resta la frase italiana.
  // Il motore resta puro: non conosce il documento, solo un dizionario
  // facoltativo trovato sull'oggetto globale.
  const RIPIEGHI = {
    scriptNonValido: 'Script non valido o troppo lungo',
    carattere: 'Carattere inatteso',
    atteso: 'Atteso {cosa}',
    attesoValore: 'Atteso un valore',
    nome: 'Nome non valido',
    durataDuplicata: 'Durata duplicata',
    durataFormato: 'Durata attesa in s o ms',
    durataIntervallo: 'Durata fuori intervallo',
    parametroDuplicato: 'Parametro duplicato: {nome}',
    campoSconosciuto: 'Campo sconosciuto: {nome}',
    scenaIncompleta: 'Ogni scena richiede durata e azioni',
    testoDopo: 'Testo dopo la demo',
    vuota: 'Demo vuota',
    comandoSconosciuto: 'Comando sconosciuto: {nome}',
    posizione: '{messaggio} (riga {riga}, colonna {colonna})'
  };
  function messaggio(chiave, dati = {}) {
    const i18n = radice.astroI18n;
    if (i18n && typeof i18n.esiste === 'function' && i18n.esiste('demo.err.' + chiave))
      return i18n.t('demo.err.' + chiave, dati);
    return (RIPIEGHI[chiave] || chiave).replace(/\{(\w+)\}/g, (m, k) => k in dati ? String(dati[k]) : m);
  }
  function analizza(testo) {
    if (typeof testo !== 'string' || testo.length > 100000) throw new Error(messaggio('scriptNonValido'));
    const regola = /\s+|\/\/[^\n]*|'(?:\\['\\]|[^'\\])*'|"(?:\\["\\]|[^"\\])*"|\d{1,2}:\d{2}(?!\d)|-?\d+(?:\.\d+)?(?:ms|s)?|[A-Za-z_][A-Za-z_0-9-]*|[{}:;,]/gy;
    const gettoni = []; let pos = 0, i = 0, scansione = true;
    // Senza indice esplicito l'errore cade sul gettone appena letto: durante
    // l'analisi `pos` vale già la fine del testo, e tutti gli errori di
    // struttura finivano sull'ultima riga invece che su quella sbagliata.
    function errore(chiave, dati, indice) {
      if (indice === undefined) {
        const g = scansione ? null : gettoni[Math.max(0, Math.min(i, gettoni.length) - 1)];
        indice = g ? g.pos : pos;
      }
      const prima = testo.slice(0, indice), righe = prima.split('\n');
      throw new SyntaxError(messaggio('posizione', {
        messaggio: messaggio(chiave, dati), riga: righe.length, colonna: righe[righe.length - 1].length + 1
      }));
    }
    while (pos < testo.length) {
      regola.lastIndex = pos; const m = regola.exec(testo);
      if (!m) errore('carattere');
      if (!/^\s|^\/\//.test(m[0])) gettoni.push({ valore: m[0], pos });
      pos = regola.lastIndex;
    }
    scansione = false;
    const guarda = () => gettoni[i] && gettoni[i].valore;
    function prendi(atteso) {
      const g = gettoni[i];
      if (!g || (atteso && g.valore !== atteso))
        errore(atteso ? 'atteso' : 'attesoValore', { cosa: atteso }, g ? g.pos : testo.length);
      i++; return g.valore;
    }
    function nome() {
      const v = prendi();
      if (/^['"]/.test(v)) return v.slice(1, -1).replace(/\\(['"\\])/g, '$1');
      if (!/^[A-Za-z_][A-Za-z_0-9-]*$/.test(v)) errore('nome', {}, gettoni[i - 1].pos);
      return v;
    }
    function valore() {
      const v = guarda();
      if (v && /^-?\d+(?:\.\d+)?$/.test(v)) { prendi(); return Number(v); }
      if (v && /^\d{1,2}:\d{2}$/.test(v)) { prendi(); return v; }
      return nome();
    }
    prendi('define_demo'); const id = nome(); prendi('{'); const scene = [];
    while (guarda() && guarda() !== '}') {
      prendi('scene'); const vista = nome(); prendi('{');
      let durata = null; const azioni = [];
      while (guarda() && guarda() !== '}') {
        const posCampo = gettoni[i] ? gettoni[i].pos : pos, campo = prendi(); prendi(':');
        if (campo === 'duration') {
          if (durata !== null) errore('durataDuplicata');
          const v = prendi(), m = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(v);
          if (!m) errore('durataFormato');
          durata = Number(m[1]) * (m[2] === 's' ? 1000 : 1);
          if (!(durata > 0 && durata <= 3600000)) errore('durataIntervallo');
        } else if (campo === 'action') {
          let comando = nome(); if (comando === 'center') comando = 'center_target';
          prendi('{'); const parametri = Object.create(null);
          while (guarda() && guarda() !== '}') {
            const chiave = nome(); prendi(':');
            if (Object.hasOwn(parametri, chiave)) errore('parametroDuplicato', { nome: chiave });
            parametri[chiave] = valore();
            if (guarda() !== '}') prendi(',');
          }
          prendi('}'); azioni.push({ comando, parametri });
        } else errore('campoSconosciuto', { nome: campo }, posCampo);
        prendi(';');
      }
      prendi('}');
      if (durata === null || !azioni.length) errore('scenaIncompleta');
      scene.push({ vista, durata, azioni });
    }
    prendi('}');
    if (guarda()) errore('testoDopo', {}, gettoni[i].pos);
    if (!scene.length) errore('vuota');
    return { id, scene };
  }

  class Motore {
    constructor(registro, ambiente = {}) {
      this.registro = registro;
      this.ora = ambiente.ora || (() => performance.now());
      this.richiedi = ambiente.richiedi || (f => requestAnimationFrame(f));
      this.annulla = ambiente.annulla || (id => cancelAnimationFrame(id));
      this.avvisa = ambiente.avvisa || (() => {});
      this.stato = 'fermo';
      this.raf = null;
      this.esecutori = [];

// Ogni scena ha un token diverso: serve a ignorare la conclusione tardiva
// di una narrazione appartenente a una scena che nel frattempo è stata
// saltata, fermata o sostituita.
      this.tokenScena = 0;

// `duration` è la durata minima della scena. Quando esiste una narrazione,
// la scena può restare aperta oltre quel tempo finché la voce non termina.
      this.narrazioneFinita = true;
      this.attesaFineNarrazione = false;
    }
    prepara(testo) {
      const demo = analizza(testo);
      for (const scena of demo.scene) for (const azione of scena.azioni) {
        const comando = this.registro[azione.comando];
        if (!comando || typeof comando.crea !== 'function') throw new Error(messaggio('comandoSconosciuto', { nome: azione.comando }));
        if (comando.verifica) comando.verifica(azione.parametri, scena);
      }
      return demo;
    }
    avvia(testo, contesto = {}) {
      const demo = this.prepara(testo); // Nessun effetto prima della validazione completa.
      this.ferma();
      this.demo = demo; this.contesto = contesto; this.indice = 0;
      this.trascorso = 0; this.ultimo = this.ora(); this.stato = 'attivo';
      try { this.entra(); this.programma(); } catch (e) { this.fallisci(e); }
    }
    entra() {
      const scena = this.demo.scene[this.indice];
      this.esecutori = [];

      // Token univoco della scena corrente. Le Promise delle scene precedenti
      // non devono poter far ripartire l'orologio dopo uno Stop o un salto.
      const token = ++this.tokenScena;

      this.narrazioneFinita = true;
      this.attesaFineNarrazione = false;

      if (this.contesto.scena)
        this.contesto.scena(scena, this.indice);

      for (const a of scena.azioni) {
        const esecutore =
            this.registro[a.comando].crea(a.parametri, this.contesto, scena) || {};

        this.esecutori.push(esecutore);
      }

      // Gli esecutori possono esporre una Promise `fineNarrazione`.
      // `duration` resta la durata minima: se la voce dura più della scena,
      // il motore aspetta la conclusione della voce prima di proseguire.
      const atteseNarrazione = this.esecutori
          .map(e => e.fineNarrazione)
          .filter(p => p && typeof p.then === 'function');

      if (atteseNarrazione.length) {
        this.narrazioneFinita = false;

        Promise.allSettled(atteseNarrazione).then(() => {
          // La scena potrebbe essere stata fermata o sostituita nel frattempo.
          if (this.tokenScena !== token) return;

          this.narrazioneFinita = true;

          // Se la durata minima era già terminata, non c'è più un RAF attivo:
          // riavvia l'orologio adesso, senza conteggiare come tempo di scena
          // i secondi trascorsi mentre aspettavamo soltanto la voce.
          if (this.attesaFineNarrazione && this.stato === 'attivo') {
            this.attesaFineNarrazione = false;
            this.ultimo = this.ora();
            this.programma();
          }
        });
      }

      this.aggiorna(0);
      this.avvisa(this);
    }
    aggiorna(progresso) {
      for (const e of this.esecutori) if (e.aggiorna) e.aggiorna(progresso);
    }
    esci() {
      // Invalida subito eventuali Promise ancora appartenenti alla scena
      // che stiamo chiudendo.
      this.tokenScena++;
      this.attesaFineNarrazione = false;

      const esecutori = this.esecutori;
      this.esecutori = [];

      let errore;

      for (const e of esecutori.reverse()) {
        try {
          if (e.chiudi) e.chiudi();
        } catch (err) {
          errore = errore || err;
        }
      }

      if (errore) throw errore;
    }
    programma() {
      if (this.stato === 'attivo') this.raf = this.richiedi(() => this.passo());
    }
    passo() {
      this.raf = null;

      if (this.stato !== 'attivo') return;

      try {
        const adesso = this.ora();

        this.trascorso += Math.max(0, adesso - this.ultimo);
        this.ultimo = adesso;

        while (this.trascorso >= this.demo.scene[this.indice].durata) {
          const durata = this.demo.scene[this.indice].durata;

          // La parte visiva della scena raggiunge comunque il suo stato finale.
          this.aggiorna(1);

          // `duration` è una durata minima.
          // Se l'audio/TTS della scena sta ancora parlando, non chiudere
          // gli esecutori e quindi non troncare la narrazione.
          if (!this.narrazioneFinita) {
            this.trascorso = durata;
            this.attesaFineNarrazione = true;

            // Non programmiamo altri fotogrammi inutili mentre aspettiamo
            // soltanto la fine della voce. La Promise della narrazione
            // richiamerà `programma()` quando avrà terminato.
            return;
          }

          // Durata minima terminata e narrazione conclusa:
          // ora la scena può essere chiusa normalmente.
          this.esci();

          this.trascorso -= durata;
          this.indice++;

          if (this.indice === this.demo.scene.length) {
            this.ferma('completato');
            return;
          }

          this.entra();
        }

        this.aggiorna(
            this.trascorso / this.demo.scene[this.indice].durata
        );

        this.programma();

      } catch (e) {
        this.fallisci(e);
      }
    }
    // Salta all'inizio di una scena: chiude quella in corso e apre l'altra
    // col suo orologio a zero. Le scene saltate non si eseguono — chi salta
    // in avanti deve essere già passato da quelle che preparano il luogo e
    // la data (le prove lo usano per non aspettare un minuto a tour).
    // `frazione` (0–1) porta anche l'orologio della scena a quel punto.
    vaiAScena(indice, frazione = 0) {
      if (!this.demo || (this.stato !== 'attivo' && this.stato !== 'pausa')) return;
      const i = Math.max(0, Math.min(this.demo.scene.length - 1, Math.floor(indice)));
      const u = Math.max(0, Math.min(0.999, Number(frazione) || 0));
      try {
        this.esci();
        this.indice = i; this.trascorso = 0; this.ultimo = this.ora();
        this.entra();
        if (u > 0) { this.trascorso = u * this.demo.scene[i].durata; this.aggiorna(u); }
      } catch (e) { this.fallisci(e); }
    }
    pausa() {
      if (this.stato !== 'attivo') return;
      if (this.raf !== null) this.annulla(this.raf);
      this.raf = null;
      this.trascorso += Math.max(0, this.ora() - this.ultimo);
      this.stato = 'pausa'; this.segnala('pausa'); this.avvisa(this);
    }
    riprendi() {
      if (this.stato !== 'pausa') return;

      this.ultimo = this.ora();
      this.stato = 'attivo';
      this.segnala('riprendi');
      this.avvisa(this);

      // Se la durata minima della scena è già terminata e stiamo aspettando
      // soltanto la fine della narrazione, non serve riavviare il RAF.
      // Sarà la Promise della voce a richiamare `programma()` quando terminerà.
      if (!this.attesaFineNarrazione) {
        this.programma();
      }
    }
    // Chi accompagna il racconto senza essere un fotogramma — la voce — deve
    // sapere quando l'orologio si ferma e quando riparte. Il contesto lo
    // riceve se vuole (`pausa`/`riprendi`); un suo guasto non ferma la demo.
    segnala(evento) {
      const f = this.contesto && this.contesto[evento];
      if (typeof f === 'function') { try { f.call(this.contesto); } catch (_) { /* la voce non ferma il racconto */ } }
    }
    ferma(stato = 'fermo') {
      if (this.raf !== null) this.annulla(this.raf);
      this.raf = null; this.stato = stato;
      let errore;
      try { this.esci(); } catch (e) { errore = e; }
      const contesto = this.contesto; this.contesto = null;
      try { if (contesto && contesto.ripristina) contesto.ripristina(); } catch (e) { errore = errore || e; }
      this.avvisa(this);
      if (errore) throw errore;
    }
    fallisci(errore) {
      this.errore = errore;
      try { this.ferma('errore'); } catch (_) { this.stato = 'errore'; this.avvisa(this); }
    }
  }
  const api = { analizza, Motore, messaggio };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else radice.AstroDemoMotore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
