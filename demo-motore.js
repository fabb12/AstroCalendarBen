/* Motore delle demo: parser dati, registro estensibile e un solo orologio.
 * Nessun eval dello script. Utilizzabile anche con require() nelle prove. */
(function (radice) {
  'use strict';
  function analizza(testo) {
    if (typeof testo !== 'string' || testo.length > 100000) throw new Error('Script non valido o troppo lungo');
    const regola = /\s+|\/\/[^\n]*|'(?:\\['\\]|[^'\\])*'|"(?:\\["\\]|[^"\\])*"|\d{1,2}:\d{2}(?!\d)|-?\d+(?:\.\d+)?(?:ms|s)?|[A-Za-z_][A-Za-z_0-9-]*|[{}:;,]/gy;
    const gettoni = []; let pos = 0;
    function errore(messaggio, indice = pos) {
      const prima = testo.slice(0, indice), righe = prima.split('\n');
      throw new SyntaxError(messaggio + ' (riga ' + righe.length + ', colonna ' + (righe[righe.length - 1].length + 1) + ')');
    }
    while (pos < testo.length) {
      regola.lastIndex = pos; const m = regola.exec(testo);
      if (!m) errore('Carattere inatteso');
      if (!/^\s|^\/\//.test(m[0])) gettoni.push({ valore: m[0], pos });
      pos = regola.lastIndex;
    }
    let i = 0;
    const guarda = () => gettoni[i] && gettoni[i].valore;
    function prendi(atteso) {
      const g = gettoni[i];
      if (!g || (atteso && g.valore !== atteso)) errore('Atteso ' + (atteso || 'valore'), g ? g.pos : testo.length);
      i++; return g.valore;
    }
    function nome() {
      const v = prendi();
      if (/^['"]/.test(v)) return v.slice(1, -1).replace(/\\(['"\\])/g, '$1');
      if (!/^[A-Za-z_][A-Za-z_0-9-]*$/.test(v)) errore('Nome non valido', gettoni[i - 1].pos);
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
        const campo = prendi(); prendi(':');
        if (campo === 'duration') {
          if (durata !== null) errore('Durata duplicata');
          const v = prendi(), m = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(v);
          if (!m) errore('Durata attesa in s o ms');
          durata = Number(m[1]) * (m[2] === 's' ? 1000 : 1);
          if (!(durata > 0 && durata <= 3600000)) errore('Durata fuori intervallo');
        } else if (campo === 'action') {
          let comando = nome(); if (comando === 'center') comando = 'center_target';
          prendi('{'); const parametri = Object.create(null);
          while (guarda() && guarda() !== '}') {
            const chiave = nome(); prendi(':');
            if (Object.hasOwn(parametri, chiave)) errore('Parametro duplicato: ' + chiave);
            parametri[chiave] = valore();
            if (guarda() !== '}') prendi(',');
          }
          prendi('}'); azioni.push({ comando, parametri });
        } else errore('Campo sconosciuto: ' + campo);
        prendi(';');
      }
      prendi('}');
      if (durata === null || !azioni.length) errore('Ogni scena richiede durata e azioni');
      scene.push({ vista, durata, azioni });
    }
    prendi('}');
    if (guarda()) errore('Testo dopo la demo', gettoni[i].pos);
    if (!scene.length) errore('Demo vuota');
    return { id, scene };
  }

  class Motore {
    constructor(registro, ambiente = {}) {
      this.registro = registro;
      this.ora = ambiente.ora || (() => performance.now());
      this.richiedi = ambiente.richiedi || (f => requestAnimationFrame(f));
      this.annulla = ambiente.annulla || (id => cancelAnimationFrame(id));
      this.avvisa = ambiente.avvisa || (() => {});
      this.stato = 'fermo'; this.raf = null; this.esecutori = [];
    }
    prepara(testo) {
      const demo = analizza(testo);
      for (const scena of demo.scene) for (const azione of scena.azioni) {
        const comando = this.registro[azione.comando];
        if (!comando || typeof comando.crea !== 'function') throw new Error('Comando sconosciuto: ' + azione.comando);
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
      const scena = this.demo.scene[this.indice]; this.esecutori = [];
      if (this.contesto.scena) this.contesto.scena(scena, this.indice);
      for (const a of scena.azioni) {
        const esecutore = this.registro[a.comando].crea(a.parametri, this.contesto, scena) || {};
        this.esecutori.push(esecutore);
      }
      this.aggiorna(0); this.avvisa(this);
    }
    aggiorna(progresso) {
      for (const e of this.esecutori) if (e.aggiorna) e.aggiorna(progresso);
    }
    esci() {
      const esecutori = this.esecutori; this.esecutori = [];
      let errore;
      for (const e of esecutori.reverse()) {
        try { if (e.chiudi) e.chiudi(); } catch (err) { errore = errore || err; }
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
        this.trascorso += Math.max(0, adesso - this.ultimo); this.ultimo = adesso;
        while (this.trascorso >= this.demo.scene[this.indice].durata) {
          const durata = this.demo.scene[this.indice].durata;
          this.aggiorna(1); this.esci(); this.trascorso -= durata; this.indice++;
          if (this.indice === this.demo.scene.length) { this.ferma('completato'); return; }
          this.entra();
        }
        this.aggiorna(this.trascorso / this.demo.scene[this.indice].durata);
        this.programma();
      } catch (e) { this.fallisci(e); }
    }
    pausa() {
      if (this.stato !== 'attivo') return;
      if (this.raf !== null) this.annulla(this.raf);
      this.raf = null;
      this.trascorso += Math.max(0, this.ora() - this.ultimo);
      this.stato = 'pausa'; this.avvisa(this);
    }
    riprendi() {
      if (this.stato !== 'pausa') return;
      this.ultimo = this.ora(); this.stato = 'attivo'; this.avvisa(this); this.programma();
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
  const api = { analizza, Motore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else radice.AstroDemoMotore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
