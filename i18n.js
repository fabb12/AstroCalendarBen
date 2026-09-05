/* Il gestore delle lingue.
 * =======================
 *
 * Quello di prima traduceva **il DOM**: a ogni cambio lingua camminava tutti i
 * nodi di testo del documento e su ognuno passava duecento espressioni
 * regolari, una per ogni voce di un glossario di frasi e di parole. Da lì
 * venivano tutti e due i difetti segnalati, e vale la pena scriverli perché
 * sono due facce della stessa scelta sbagliata.
 *
 * **Era lento.** Non per una riga da ottimizzare: per il conto. Il documento
 * ha qualche migliaio di nodi di testo, il glossario aveva duecento voci, e
 * ogni voce costruiva una `RegExp` nuova con le classi Unicode — quindi il
 * cambio lingua era mezzo milione di espressioni regolari compilate e
 * applicate, in un colpo, sul filo dell'interfaccia. E non finiva lì: un
 * `MutationObserver` sorvegliava `characterData` e gli attributi di tutto il
 * `body`, e questo è un planetario che riscrive pannelli e schede diverse
 * volte al secondo — ogni riscrittura rifaceva quel giro.
 *
 * **Era incompleto, e non poteva non esserlo.** Un dizionario di frasi
 * traduce le frasi che ci sono scritte dentro; qualunque altra resta com'era.
 * Le schede informative — la scheda di un astro, quella di un aereo, quella
 * di una stella — sono fatte di frasi intere composte al momento («è
 * circumpolare: non tramonta mai», «dentro l'ombra della Terra, invisibile»),
 * e nessuna di quelle stava nel dizionario: restavano in italiano. Peggio:
 * dove il glossario mordeva a metà usciva un misto delle due lingue, che è
 * l'unico esito peggiore del non tradurre affatto.
 *
 * Questo file rovescia il verso. Non si traduce il testo: si tiene **la
 * chiave**, e il testo è un dato che sta nel dizionario della lingua scelta.
 *
 *   1. I dizionari (`lingue/it.js`, `lingue/en.js`) sono in memoria all'avvio,
 *      caricati come i `dati-*.js`. Nessuna richiesta di rete, nessuna API di
 *      traduzione, nessun conto al momento del cambio.
 *   2. `t('chiave')` è una lettura da `Map`. Il cambio lingua **non guarda il
 *      documento**: scorre l'indice dei soli nodi che hanno una chiave, e
 *      avvisa chi si disegna da sé perché si ridisegni.
 *   3. Se una chiave manca, si ripiega sulla lingua base e si scrive in
 *      console **una volta sola** per chiave. L'interfaccia non si rompe mai:
 *      nel caso peggiore resta la frase italiana, che è leggibile.
 *
 * Il testo nuovo non si scrive più in nessun file dell'applicazione: si scrive
 * `astroI18n.t('chiave')` e la frase sta nei due dizionari. Chi se ne
 * dimentica lo scopre da `node scripts/controlla-i18n.js`, che conta le
 * stringhe italiane rimaste cablate e in CI non lascia crescere quel numero.
 */
(() => {
  'use strict';

  const LINGUA_BASE = 'it';           // la lingua in cui il progetto è scritto
  const CHIAVE_LINGUA = 'astrocal_lingua';
  const CHIAVE_PAESE = 'astrocal_paese_connessione';
  const PAESE_VALIDO_MS = 7 * 24 * 60 * 60 * 1000;

  // ====================================================================
  // 1. I dizionari — in memoria, una volta, all'avvio
  // ====================================================================
  //
  // `Map` e non un oggetto: la lettura è la stessa, ma una chiave non può
  // collidere con `constructor` o `toString` — e le chiavi qui arrivano da
  // file di dati, cioè da fuori.
  const dizionari = new Map();

  const CHIAVI = Object.freeze({
    cambio: 'lingua.cambio',
    titolo: 'app.titolo'
  });

  function normalizzaCodice(codice) {
    return String(codice || '').trim().toLowerCase();
  }

  /* Registra (o completa) una lingua. I messaggi si **fondono** con quelli già
   * presenti invece di sostituirli: così un dizionario si può spezzare in più
   * file — uno per il planetario, uno per la didattica — senza che l'ultimo
   * caricato cancelli i primi. */
  function registraLingua(codice, definizione = {}) {
    const codiceOk = normalizzaCodice(codice);
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(codiceOk)) {
      throw new TypeError(`Codice lingua non valido: ${codice}`);
    }
    const prima = dizionari.get(codiceOk);
    const voce = prima || {
      codice: codiceOk,
      locale: codiceOk,
      manifest: 'manifest.json',
      nome: codiceOk.toUpperCase(),
      messaggi: new Map(),
      legacy: new Map()
    };
    if (definizione.locale) voce.locale = definizione.locale;
    if (definizione.manifest) voce.manifest = definizione.manifest;
    if (definizione.nome) voce.nome = definizione.nome;
    // I messaggi arrivano come oggetto piatto (è la forma leggibile in un file
    // di dati) e vivono in una Map (è la forma veloce da leggere a runtime).
    for (const [chiave, valore] of Object.entries(definizione.messaggi || definizione.messages || {})) {
      voce.messaggi.set(chiave, valore);
    }
    // Il ponte per il testo non ancora convertito: **solo stringhe intere**,
    // niente frasi spezzate e niente parole singole. È la lezione del gestore
    // di prima — un glossario per parole non traduce, impasta.
    for (const [italiano, tradotto] of Object.entries(definizione.legacy || {})) {
      voce.legacy.set(italiano, tradotto);
    }
    dizionari.set(codiceOk, voce);
    if (pronto) aggiornaBottone();
    return voce;
  }

  /* I dizionari caricati come script (`window.ASTRO_DIZIONARI`) entrano qui.
   *
   * Perché file `.js` e non `.json`: questa applicazione si apre anche con un
   * doppio clic su `index.html`, e da `file://` una `fetch('en.json')` è
   * vietata dal browser — la lingua non arriverebbe proprio. Un `<script>` si
   * carica sempre, sta nella cache del service worker come tutto il resto, ed
   * è la stessa convenzione dei cataloghi di stelle (`dati-*.js`). Il
   * contenuto è comunque un oggetto piatto chiave→testo: passarlo a JSON è
   * copiarlo. */
  function assorbiDizionariGlobali() {
    const raccolta = (typeof window !== 'undefined' && window.ASTRO_DIZIONARI) || {};
    for (const [codice, definizione] of Object.entries(raccolta)) {
      try { registraLingua(codice, definizione); }
      catch (errore) { console.error(`[i18n] Dizionario "${codice}" scartato:`, errore.message); }
    }
  }

  // ====================================================================
  // 2. La lettura di un messaggio, e il ripiego
  // ====================================================================

  let lingua = LINGUA_BASE;
  let pronto = false;
  const mancanti = new Map();          // chiave → lingue in cui manca

  function dizionarioDi(codice) {
    return dizionari.get(codice) || dizionari.get(LINGUA_BASE) || null;
  }

  function segnalaMancante(chiave, codice) {
    const viste = mancanti.get(chiave);
    if (viste) { viste.add(codice); return; }          // già detto: non si ripete
    mancanti.set(chiave, new Set([codice]));
    // Una volta sola per chiave: un messaggio dentro a un ciclo di disegno
    // che gira sessanta volte al secondo riempirebbe la console e coprirebbe
    // proprio l'informazione che stiamo cercando di dare.
    console.warn(`[i18n] Manca la traduzione «${chiave}» per «${codice}».`);
  }

  /* Sceglie la forma singolare o plurale. Serve più di quanto sembri: i
   * conti alla rovescia dicono «fra 1 giorno» e «fra 3 giorni», e in inglese
   * «in 1 day» e «in 3 days» — con una stringa sola una delle due è sbagliata
   * in tutte le lingue. Le categorie le decide `Intl.PluralRules`, non noi. */
  const regolePlurale = new Map();
  function formaPlurale(valore, quanti, locale) {
    if (typeof valore === 'string') return valore;
    if (!valore || typeof valore !== 'object') return null;
    if (typeof quanti !== 'number' || !Number.isFinite(quanti)) {
      return valore.altri ?? valore.other ?? valore.uno ?? valore.one ?? null;
    }
    let regole = regolePlurale.get(locale);
    if (!regole) {
      try { regole = new Intl.PluralRules(locale); }
      catch (e) { regole = { select: (n) => (n === 1 ? 'one' : 'other') }; }
      regolePlurale.set(locale, regole);
    }
    const categoria = regole.select(Math.abs(quanti));
    const perCategoria = {
      zero: valore.zero, one: valore.uno ?? valore.one, two: valore.due ?? valore.two,
      few: valore.pochi ?? valore.few, many: valore.molti ?? valore.many,
      other: valore.altri ?? valore.other
    };
    return perCategoria[categoria] ?? perCategoria.other ?? perCategoria.one ?? null;
  }

  /* `{nome}` prende il valore passato; `{n}` è il numero e si scrive con il
   * separatore della lingua (mille virgola cinque in italiano, mille punto
   * cinque in inglese: è il genere di dettaglio che tradisce una traduzione
   * fatta a metà). Un segnaposto senza valore resta scritto com'è, così si
   * vede sullo schermo invece di diventare «undefined». */
  function interpola(modello, valori, locale) {
    return modello.replace(/\{([\w.-]+)\}/g, (intero, nome) => {
      if (!Object.prototype.hasOwnProperty.call(valori, nome)) return intero;
      const valore = valori[nome];
      if (typeof valore === 'number') return formattaNumero(valore, locale);
      return String(valore);
    });
  }

  /* La funzione che tutta l'applicazione chiama.
   *
   * Tre gradini di ripiego, e il terzo è quello che risponde alla direttiva:
   * lingua scelta → lingua base (l'italiano, che è la sorgente e c'è sempre) →
   * la chiave stessa. Non solleva mai e non restituisce mai vuoto: una scheda
   * con dentro una frase italiana è un difetto da correggere, una scheda vuota
   * è un'applicazione rotta. */
  function t(chiave, valori = {}) {
    const nome = String(chiave || '');
    if (!nome) return '';
    const attuale = dizionarioDi(lingua);
    let grezzo = attuale ? attuale.messaggi.get(nome) : undefined;
    let locale = attuale ? attuale.locale : LINGUA_BASE;

    if (grezzo === undefined) {
      segnalaMancante(nome, lingua);
      const base = dizionari.get(LINGUA_BASE);
      if (base && base !== attuale) {
        grezzo = base.messaggi.get(nome);
        // Il testo di ripiego è italiano: si formatta con le regole italiane,
        // se no si scrive un numero inglese dentro a una frase italiana.
        if (grezzo !== undefined) locale = base.locale;
      }
    }
    if (grezzo === undefined) return nome;

    const quanti = typeof valori.n === 'number' ? valori.n
      : typeof valori.count === 'number' ? valori.count : undefined;
    const modello = formaPlurale(grezzo, quanti, locale);
    if (modello == null) return nome;
    return interpola(modello, valori, locale);
  }

  /* Esiste davvero questa chiave? Serve a chi compone una scheda e vuole
   * saltare una riga intera quando la frase non c'è, invece di stamparne il
   * nome. */
  function esiste(chiave) {
    const attuale = dizionarioDi(lingua);
    if (attuale && attuale.messaggi.has(chiave)) return true;
    const base = dizionari.get(LINGUA_BASE);
    return !!(base && base.messaggi.has(chiave));
  }

  /* Il ponte per quello che non è ancora convertito: una stringa italiana
   * intera, cercata per intero. Nessuna espressione regolare, nessuna parola
   * dentro a una frase — se la frase non c'è nel ponte, resta italiana e
   * l'audit la conta. */
  function testoLegacy(italiano) {
    const attuale = dizionarioDi(lingua);
    if (!attuale || lingua === LINGUA_BASE) return italiano;
    const chiave = String(italiano).replace(/­/g, '').trim();
    if (!chiave) return italiano;
    const tradotto = attuale.legacy.get(chiave);
    if (tradotto === undefined) return italiano;
    // Gli spazi attorno si conservano: in un `<span> Chiudi </span>` toglierli
    // sposta il testo di due pixel, e si vede.
    return String(italiano).replace(chiave, tradotto);
  }

  // ====================================================================
  // 3. I formati che dipendono dalla lingua
  // ====================================================================
  //
  // Numeri, date e conti alla rovescia non stanno nel dizionario: sono
  // *regole*, non frasi. Tenerle qui vuol dire che una lingua nuova le prende
  // gratis da `Intl`, e che nessun modulo deve sapere che il separatore
  // decimale italiano è la virgola.

  const cacheNumeri = new Map();
  function formattaNumero(valore, locale = localeAttuale(), opzioni = null) {
    if (typeof valore !== 'number' || !Number.isFinite(valore)) return String(valore);
    const chiave = locale + '|' + (opzioni ? JSON.stringify(opzioni) : '');
    let formato = cacheNumeri.get(chiave);
    if (!formato) {
      try { formato = new Intl.NumberFormat(locale, opzioni || undefined); }
      catch (e) { formato = { format: (n) => String(n) }; }
      cacheNumeri.set(chiave, formato);
    }
    return formato.format(valore);
  }

  function numero(valore, decimali = null) {
    const opzioni = decimali == null ? null
      : { minimumFractionDigits: decimali, maximumFractionDigits: decimali };
    return formattaNumero(valore, localeAttuale(), opzioni);
  }

  const cacheDate = new Map();
  function formattaData(data, opzioni = { dateStyle: 'medium' }) {
    const quando = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(quando.getTime())) return '';
    const locale = localeAttuale();
    const chiave = locale + '|' + JSON.stringify(opzioni);
    let formato = cacheDate.get(chiave);
    if (!formato) {
      try { formato = new Intl.DateTimeFormat(locale, opzioni); }
      catch (e) { formato = { format: (d) => d.toISOString() }; }
      cacheDate.set(chiave, formato);
    }
    return formato.format(quando);
  }

  /* Il conto alla rovescia — «fra 3 giorni», «fra 2 h 15 min», «adesso».
   *
   * Era scritto sei volte in cinque file, ogni volta un po' diverso e ogni
   * volta in italiano cablato (`fra ${min} min`). Sei copie di una frase sono
   * sei posti in cui tradurla e cinque in cui dimenticarsene: adesso è una, e
   * le parole stanno nel dizionario come tutte le altre.
   *
   * La precisione si adatta alla distanza, che è la cosa che quelle sei copie
   * facevano bene: gli anni per un'eclissi del 2070, i secondi per un transito
   * che sta per cominciare. Sapere che mancano «due ore e quindici» è utile,
   * «due ore, quindici minuti e otto secondi» è una cifra da leggere per
   * niente. */
  function quantoManca(ms, opzioni = {}) {
    const { adesso = 'tempo.adesso', passato = 'tempo.passato', codaMs = 0, breve = false } = opzioni;
    const valore = Number(ms);
    if (!Number.isFinite(valore)) return '';
    if (valore <= 0) return valore > -codaMs ? t(adesso) : t(passato);

    const secondi = valore / 1000;
    const minuti = secondi / 60;
    const ore = minuti / 60;
    const giorni = ore / 24;

    /* Due registri, e non è una raffinatezza: `breve` scrive «fra 45 s» e la
     * forma lunga «fra 45 secondi». Sono due posti diversi dello schermo — il
     * primo è l'avviso di un transito appoggiato sul cielo, dove ci sono due
     * centimetri e il numero deve essere la cosa più grande; il secondo è una
     * scheda dell'agenda, dove una riga si legge come una frase. Unificarle
     * sembrava una pulizia e invece era una perdita: l'avviso si allungava.
     *
     * Sopra le ventiquattro ore i due registri coincidono — «fra 3 giorni» si
     * dice così in tutti e due — e per questo il ramo dei giorni è uno solo. */
    const p = breve ? 'tempo.breve' : 'tempo.fra';
    if (secondi < 5) return t('tempo.istanti');
    if (minuti < 1) return t(p + 'Secondi', { n: Math.round(secondi) });
    if (minuti < 60) {
      const m = Math.round(minuti);
      const s = Math.round(secondi) % 60;
      // I secondi si dicono solo sotto i dieci minuti: più in là sono rumore.
      return (m < 10 && s) ? t('tempo.fraMinutiSecondi', { n: m, s })
        : t(p + 'Minuti', { n: m });
    }
    if (ore < 24) {
      const h = Math.floor(ore);
      const m = Math.round(minuti % 60);
      return m ? t('tempo.fraOreMinuti', { n: h, m }) : t(p + 'Ore', { n: h });
    }
    if (giorni < 60) return t('tempo.fraGiorni', { n: Math.round(giorni) });
    if (giorni < 365) return t('tempo.fraMesi', { n: Math.round(giorni / 30.44) });
    const anni = Math.floor(giorni / 365.25);
    const mesi = Math.round((giorni - anni * 365.25) / 30.44);
    if (!mesi) return t('tempo.fraAnni', { n: anni });
    return t('tempo.fraAnniMesi', { n: anni, m: mesi });
  }

  /* Una durata senza verso — «3 g 4 h», «15 min» — e la stessa con il verso
   * («fra …» / «… fa»), che è quello che la barra del tempo scrive. */
  function durata(ms) {
    const totale = Math.abs(Math.round(Number(ms) || 0) / 1000);
    const g = Math.floor(totale / 86400);
    const h = Math.floor((totale % 86400) / 3600);
    const m = Math.floor((totale % 3600) / 60);
    const s = Math.floor(totale % 60);
    const pezzi = [];
    if (g) pezzi.push(t('tempo.unitaGiorni', { n: g }));
    if (h) pezzi.push(t('tempo.unitaOre', { n: h }));
    if (m) pezzi.push(t('tempo.unitaMinuti', { n: m }));
    if (s && !g && !h) pezzi.push(t('tempo.unitaSecondi', { n: s }));
    return pezzi.join(' ') || t('tempo.unitaSecondi', { n: 0 });
  }

  function scartoTempo(ms) {
    const valore = Number(ms) || 0;
    if (!valore) return t('tempo.adesso');
    return valore > 0 ? t('tempo.fra', { durata: durata(valore) })
      : t('tempo.fa', { durata: durata(valore) });
  }

  /* I punti cardinali. Non è una raffinatezza: in italiano l'ovest si scrive
   * «O» e in inglese «W», e un planetario che scrive «O» a un inglese gli sta
   * indicando l'est di nessuna lingua. Sedici sigle e otto nomi, dal
   * dizionario. */
  const PUNTI = ['n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse',
                 's', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw'];
  function siglaPunto(azimut) {
    const indice = Math.round(((Number(azimut) % 360) + 360) % 360 / 22.5) % 16;
    return t('punto.sigla.' + PUNTI[indice]);
  }
  function nomePunto(azimut) {
    const indice = Math.round(((Number(azimut) % 360) + 360) % 360 / 45) % 8;
    return t('punto.nome.' + PUNTI[indice * 2]);
  }

  // ====================================================================
  // 4. L'indice dei nodi con una chiave
  // ====================================================================
  //
  // Qui sta la differenza di prestazioni. Il cambio lingua non guarda il
  // documento: guarda questa lista, che contiene i soli elementi che hanno
  // dichiarato una chiave. Su questa applicazione sono qualche centinaio
  // contro qualche migliaio di nodi di testo, e per ognuno si fa una lettura
  // da Map invece di duecento espressioni regolari.

  const ATTRIBUTI_CHIAVE = Object.freeze({
    'data-i18n-title': 'title',
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-alt': 'alt',
    'data-i18n-value': 'value',
    'data-i18n-label': 'label',
    'data-i18n-content': 'content'
  });
  const SELETTORE = '[data-i18n],[data-i18n-html],[data-i18n-legacy],' +
    Object.keys(ATTRIBUTI_CHIAVE).map(a => `[${a}]`).join(',');

  // `Set` di elementi: un nodo indicizzato due volte non si duplica. I nodi
  // usciti dal documento si buttano quando li si incontra (riga sotto), che
  // costa meno di un `WeakRef` e in un'applicazione che riscrive pannelli
  // interi è lo stesso risultato.
  let indice = new Set();

  /* Scrive il testo tradotto **senza toccare i figli**.
   *
   * Metà dei bottoni di questa applicazione sono fatti così:
   *
   *     <button><svg>…</svg>Chiudi</button>
   *
   * e un `textContent = 'Close'` porterebbe via l'icona. Il rimedio ovvio —
   * avvolgere la parola in uno `<span>` — vorrebbe dire cambiare la struttura
   * di qualche centinaio di nodi sotto a trecentocinquanta kilobyte di CSS
   * scritto su quella struttura (`.tasto > svg + …`, i flex, i `:only-child`):
   * si aggiusterebbe la lingua e si romperebbe l'impaginazione.
   *
   * Quindi si sostituiscono i soli **nodi di testo figli diretti**: la
   * traduzione va nel primo che porta qualcosa, gli altri si svuotano. Gli
   * elementi figli non vengono nemmeno guardati — se hanno del testo loro,
   * hanno la loro chiave. */
  function scriviTesto(elemento, testo) {
    let primo = null;
    let altri = null;
    for (const nodo of elemento.childNodes) {
      if (nodo.nodeType !== 3) continue;                    // solo testo
      if (primo === null) { primo = nodo; continue; }
      if (nodo.nodeValue.trim()) (altri || (altri = [])).push(nodo);
    }
    // Nessun figlio elemento: la via veloce, ed è quella dei più.
    if (primo && !elemento.firstElementChild) {
      if (elemento.textContent !== testo) elemento.textContent = testo;
      return;
    }
    if (!primo) {
      // Nessun nodo di testo fra i figli diretti. Se l'elemento non ha nemmeno
      // figli elemento è semplicemente vuoto, e il testo si aggiunge.
      if (!elemento.firstElementChild) {
        elemento.appendChild(document.createTextNode(testo));
        return;
      }
      // Se invece ha figli elemento, il suo testo sta **dentro a uno di loro**
      // e la chiave è sul nodo sbagliato: aggiungerne uno in coda scriverebbe
      // la parola due volte. È capitato per davvero — le voci del menu, che
      // `inizializzaNavigazione` riscrive mettendo l'etichetta in uno `<span>`,
      // uscivano «StaseraTonight». Quindi non si aggiunge niente e si dice
      // dov'è il problema, una volta sola per chiave.
      const chiave = elemento.getAttribute('data-i18n') || '(senza chiave)';
      if (!avvisiNodo.has(chiave)) {
        avvisiNodo.add(chiave);
        console.warn(`[i18n] «${chiave}» sta su un elemento che non ha testo proprio ` +
          `(<${elemento.tagName.toLowerCase()}> con figli): spostala sul nodo che porta la parola.`);
      }
      return;
    }
    if (primo.nodeValue !== testo) primo.nodeValue = testo;
    if (altri) for (const nodo of altri) nodo.nodeValue = '';
  }

  function applicaVoce(elemento) {
    const chiave = elemento.getAttribute('data-i18n');
    if (chiave) scriviTesto(elemento, t(chiave, datiDi(elemento)));

    const chiaveHtml = elemento.getAttribute('data-i18n-html');
    if (chiaveHtml) {
      // Solo per le frasi che *contengono* markup nel dizionario (un
      // `<strong>` in mezzo). Sono nostre e stanno in un file del progetto.
      const html = t(chiaveHtml, datiDi(elemento));
      if (elemento.innerHTML !== html) elemento.innerHTML = html;
    }

    for (const [attributoChiave, attributo] of Object.entries(ATTRIBUTI_CHIAVE)) {
      const k = elemento.getAttribute(attributoChiave);
      if (!k) continue;
      const valore = t(k, datiDi(elemento));
      if (elemento.getAttribute(attributo) !== valore) elemento.setAttribute(attributo, valore);
    }

    // Il ponte: `data-i18n-legacy` marca un elemento il cui testo italiano è
    // ancora quello scritto in `index.html`. Si traduce per stringa intera e
    // si ricorda l'originale, così tornando all'italiano si rimette quello.
    if (elemento.hasAttribute('data-i18n-legacy')) applicaLegacy(elemento);
  }

  /* I valori dei segnaposto passati dall'HTML: `data-i18n-n="3"` finisce in
   * `{n}`. Serve alle poche etichette statiche che portano un numero. */
  function datiDi(elemento) {
    const dati = elemento.__i18nDati;
    if (dati) return dati;
    let raccolta = null;
    for (const attributo of elemento.attributes) {
      const m = /^data-i18n-v-(.+)$/.exec(attributo.name);
      if (m) (raccolta || (raccolta = {}))[m[1]] = attributo.value;
    }
    return (elemento.__i18nDati = raccolta || {});
  }

  const avvisiNodo = new Set();
  const originali = new WeakMap();
  function applicaLegacy(elemento) {
    for (const nodo of elemento.childNodes) {
      if (nodo.nodeType !== 3 || !nodo.nodeValue.trim()) continue;
      if (!originali.has(nodo)) originali.set(nodo, nodo.nodeValue);
      const partenza = originali.get(nodo);
      const testo = lingua === LINGUA_BASE ? partenza : testoLegacy(partenza);
      if (nodo.nodeValue !== testo) nodo.nodeValue = testo;
    }
  }

  /* Indicizza un sottoalbero e lo mette subito nella lingua giusta.
   *
   * È la funzione che un pannello chiama dopo essersi riscritto. Costa una
   * `querySelectorAll` nativa sul solo pezzo appena costruito — non sul
   * documento — e nient'altro. */
  function applica(radice = document.body) {
    if (!radice) return 0;
    let quanti = 0;
    if (radice.nodeType === 1 && radice.matches && radice.matches(SELETTORE)) {
      indice.add(radice); applicaVoce(radice); quanti++;
    }
    if (radice.querySelectorAll) {
      for (const elemento of radice.querySelectorAll(SELETTORE)) {
        indice.add(elemento); applicaVoce(elemento); quanti++;
      }
    }
    return quanti;
  }

  /* Il giro del cambio lingua: solo l'indice, e chi non è più nel documento
   * esce dall'indice invece di essere aggiornato per sempre a vuoto. */
  function riscriviIndice() {
    const morti = [];
    for (const elemento of indice) {
      if (!elemento.isConnected) { morti.push(elemento); continue; }
      applicaVoce(elemento);
    }
    for (const elemento of morti) indice.delete(elemento);
  }

  // ====================================================================
  // 5. La sorveglianza — solo i nodi nuovi, e a scaglioni
  // ====================================================================
  //
  // Quella di prima ascoltava `characterData` e `attributes` su tutto il
  // `body`: in un planetario che riscrive la barra del tempo a ogni secondo e
  // le schede a ogni fotogramma era un giro di traduzione continuo. Qui si
  // ascolta il solo `childList`, e di un sottoalbero nuovo si chiede al
  // browser (`querySelectorAll`, nativa) quali elementi portano una chiave.
  // Il lavoro si accumula e si fa in un microtask, così venti riscritture
  // nello stesso fotogramma costano un giro e non venti.

  let osservatore = null;
  let inArrivo = null;

  function svuotaCoda() {
    const nodi = inArrivo;
    inArrivo = null;
    if (!nodi) return;
    for (const nodo of nodi) {
      if (nodo.nodeType === 1 && nodo.isConnected) applica(nodo);
    }
  }

  function avviaSorveglianza() {
    if (osservatore || typeof MutationObserver !== 'function') return;
    osservatore = new MutationObserver((registri) => {
      for (const registro of registri) {
        for (const nodo of registro.addedNodes) {
          if (nodo.nodeType !== 1) continue;
          if (!inArrivo) { inArrivo = []; Promise.resolve().then(svuotaCoda); }
          inArrivo.push(nodo);
        }
      }
    });
    osservatore.observe(document.body, { childList: true, subtree: true });
  }

  // ====================================================================
  // 6. Chi si disegna da sé
  // ====================================================================
  //
  // Le schede informative, i pannelli e le tele non hanno nodi con una
  // chiave: si compongono in JavaScript a ogni aggiornamento. Per loro il
  // cambio lingua non è un testo da riscrivere, è un **ridisegno**, e questo è
  // l'elenco di chi vuole essere avvisato. Un'eccezione dentro a un ascoltatore
  // non deve fermare gli altri: il cambio lingua è un gesto solo, e chi lo fa
  // deve vedere l'interfaccia cambiare tutta, non fino al primo guasto.

  const ascoltatori = new Set();
  function alCambio(funzione) {
    if (typeof funzione === 'function') ascoltatori.add(funzione);
    return () => ascoltatori.delete(funzione);
  }

  function avvisaAscoltatori() {
    for (const funzione of ascoltatori) {
      try { funzione(lingua); }
      catch (errore) { console.error('[i18n] Un ascoltatore del cambio lingua è caduto:', errore); }
    }
    // L'evento resta per chi preferisce ascoltare il documento. Il nome è
    // quello di prima: era già usato, e cambiarlo spegnerebbe chi lo ascolta.
    try {
      document.dispatchEvent(new CustomEvent('astrocal:languagechange', { detail: { language: lingua, lingua } }));
    } catch (e) { /* i vecchi browser senza CustomEvent: il resto funziona */ }
  }

  // ====================================================================
  // 7. Il cambio lingua
  // ====================================================================

  function localeAttuale() {
    const voce = dizionarioDi(lingua);
    return voce ? voce.locale : LINGUA_BASE;
  }

  /* Istantaneo per costruzione: nessuna richiesta di rete, nessun conto sul
   * documento, nessuna espressione regolare. Tre passi — l'intestazione del
   * documento, l'indice delle chiavi, l'avviso a chi si ridisegna — e il più
   * caro dei tre è proporzionale al numero di etichette, non alla dimensione
   * della pagina. */
  function impostaLingua(prossima, { salva = false } = {}) {
    const richiesta = normalizzaCodice(prossima);
    const scelta = dizionari.has(richiesta) ? richiesta : LINGUA_BASE;
    const cambia = scelta !== lingua;
    lingua = scelta;
    const voce = dizionarioDi(lingua);

    const radice = document.documentElement;
    if (radice) {
      radice.lang = voce && voce.locale ? voce.locale : lingua;
      radice.dataset.language = lingua;
      radice.dataset.lingua = lingua;
    }
    document.title = t(CHIAVI.titolo);
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest && voce && voce.manifest) manifest.setAttribute('href', voce.manifest);

    riscriviIndice();
    aggiornaBottone();
    if (salva) { try { localStorage.setItem(CHIAVE_LINGUA, lingua); } catch (e) { /* modo privato */ } }
    if (cambia || !pronto) avvisaAscoltatori();
    return lingua;
  }

  // ====================================================================
  // 8. Il bottone
  // ====================================================================

  function aggiornaBottone() {
    const bottone = document.getElementById('btn-lingua');
    if (!bottone) return;
    const codici = [...dizionari.keys()];
    if (!codici.length) return;
    const prossima = codici[(codici.indexOf(lingua) + 1) % codici.length];
    const vocePros = dizionari.get(prossima);
    let nome = (vocePros && vocePros.nome) || prossima.toUpperCase();
    if (typeof Intl.DisplayNames === 'function') {
      try { nome = new Intl.DisplayNames([localeAttuale()], { type: 'language' }).of(prossima) || nome; }
      catch (e) { /* si tiene il nome del dizionario */ }
    }
    bottone.textContent = prossima.toUpperCase();
    const spiega = t(CHIAVI.cambio, { lingua: nome, language: nome });
    bottone.title = spiega;
    bottone.setAttribute('aria-label', spiega);
    bottone.dataset.nextLanguage = prossima;
    bottone.dataset.prossimaLingua = prossima;
  }

  function installaBottone() {
    const azioni = document.querySelector('.azioni-testata');
    if (!azioni || document.getElementById('btn-lingua')) return;
    const bottone = document.createElement('button');
    bottone.id = 'btn-lingua';
    bottone.type = 'button';
    bottone.className = 'selettore-lingua';
    bottone.addEventListener('click', () => {
      impostaLingua(bottone.dataset.prossimaLingua || bottone.dataset.nextLanguage, { salva: true });
    });
    azioni.appendChild(bottone);
    aggiornaBottone();
  }

  // ====================================================================
  // 9. Quale lingua, la prima volta
  // ====================================================================
  //
  // Questa parte era il secondo guasto di prestazioni, e non si vedeva
  // leggendo il codice del cambio lingua: alla prima apertura si **aspettava
  // la rete** (`await fetchCountry()`, sveglia a 3,5 s) prima di scegliere
  // una lingua. Fino a quel momento l'interfaccia restava in italiano — cioè
  // chi apriva l'app da Londra vedeva tre secondi e mezzo di italiano e poi
  // un cambio a scatto. Adesso si decide **subito** con quello che il browser
  // sa già dire, e il paese, se arriva, corregge dopo: quando non c'è ancora
  // nessuna preferenza salvata l'unica cosa che rischia di cambiare è
  // l'italiano di un italiano che viaggia, che è il caso più raro dei due.

  function paresembraItaliano() {
    try {
      const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (/^Europe\/(Rome|San_Marino|Vatican)$/.test(fuso)) return true;
    } catch (e) { /* niente Intl: si guardano le lingue */ }
    const lingue = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ''];
    return lingue.some(codice => /^it(?:-|$)/i.test(codice));
  }

  /* La lingua che il browser dichiara, se la conosciamo. È la scelta giusta
   * per costruzione: è la lingua in cui la persona ha messo il suo telefono. */
  function linguaDelBrowser() {
    const lingue = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ''];
    for (const codice of lingue) {
      const corto = normalizzaCodice(codice).split('-')[0];
      if (dizionari.has(corto)) return corto;
    }
    return paresembraItaliano() ? 'it' : 'en';
  }

  function paeseSalvato() {
    try {
      const cache = JSON.parse(localStorage.getItem(CHIAVE_PAESE) || 'null');
      if (cache && cache.code && Date.now() - cache.savedAt < PAESE_VALIDO_MS) return cache.code;
    } catch (e) { /* salvataggio illeggibile: si chiede di nuovo */ }
    return null;
  }

  /* Il paese dall'IP. Non è una traduzione e non blocca niente: parte quando
   * l'interfaccia è già in una lingua, e se risponde qualcosa di diverso
   * corregge. Nessun permesso di posizione viene chiesto. */
  async function chiediPaese() {
    const salvato = paeseSalvato();
    if (salvato) return salvato;
    const controllore = new AbortController();
    const sveglia = setTimeout(() => controllore.abort(), 3500);
    try {
      const risposta = await fetch('https://ipwho.is/', { signal: controllore.signal, cache: 'no-store' });
      if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
      const dati = await risposta.json();
      if (!dati.success || !dati.country_code) throw new Error('Paese non disponibile');
      const codice = String(dati.country_code).toUpperCase();
      try { localStorage.setItem(CHIAVE_PAESE, JSON.stringify({ code: codice, savedAt: Date.now() })); }
      catch (e) { /* modo privato */ }
      return codice;
    } finally { clearTimeout(sveglia); }
  }

  function preferenzaSalvata() {
    try { return localStorage.getItem(CHIAVE_LINGUA); }
    catch (e) { return null; }
  }

  /* I dizionari e la scelta della lingua: **subito**, non al `DOMContentLoaded`.
   *
   * È la differenza fra un `t('chiave')` che risponde e uno che restituisce il
   * nome della chiave, e si è vista in `verifica.html`: quella pagina esegue le
   * sue prove **mentre il documento si sta ancora leggendo**, cioè prima di
   * qualunque `DOMContentLoaded`, e i moduli che chiamavano `t()` là dentro si
   * ritrovavano un dizionario vuoto. Non c'è nessun motivo per cui leggere un
   * messaggio debba aspettare il documento: aspetta il documento solo ciò che
   * lo tocca (il bottone, l'indice, il sorvegliante), e sta in `avvia()`. */
  function preparaDizionari() {
    assorbiDizionariGlobali();
    if (!dizionari.size) {
      // Nessun dizionario caricato: l'applicazione resta in italiano e
      // funziona. Lo si dice, perché è quasi sempre un `<script>` dimenticato
      // in `index.html`.
      console.error('[i18n] Nessun dizionario: manca uno <script src="lingue/…js"> prima di i18n.js?');
      registraLingua(LINGUA_BASE, { locale: 'it-IT', nome: 'Italiano' });
    }
    const salvata = preferenzaSalvata();
    // Niente rete, niente attese: si sceglie con quello che si sa già.
    impostaLingua(salvata && dizionari.has(normalizzaCodice(salvata)) ? salvata : linguaDelBrowser());
  }

  function avvia() {
    installaBottone();
    avviaSorveglianza();
    applica(document.body);
    aggiornaBottone();
    pronto = true;

    // Il paese dall'IP corregge dopo, e solo se nessuno ha scelto a mano.
    if (preferenzaSalvata() || paeseSalvato()) return;
    chiediPaese()
      .then(paese => {
        if (preferenzaSalvata()) return;                 // ha scelto lui: non si tocca
        const voluta = paese === 'IT' ? 'it' : 'en';
        if (voluta !== lingua && dizionari.has(voluta)) impostaLingua(voluta);
      })
      .catch(errore => {
        console.info('[i18n] Paese non rilevabile, resta la lingua del browser.', errore.message);
      });
  }

  // ====================================================================
  // 10. L'interfaccia pubblica
  // ====================================================================

  const api = {
    // Il testo
    t,
    esiste,
    testo: testoLegacy,
    // La lingua
    setLanguage: impostaLingua,
    impostaLingua,
    getLanguage: () => lingua,
    lingua: () => lingua,
    getLocale: localeAttuale,
    locale: localeAttuale,
    getSupportedLanguages: () => [...dizionari.keys()],
    lingueDisponibili: () => [...dizionari.keys()],
    registerLocale: registraLingua,
    registraLingua,
    // Il DOM
    applica,
    applicaA: applica,
    // Il ridisegno
    alCambio,
    onChange: alCambio,
    // I formati
    numero,
    data: formattaData,
    quantoManca,
    durata,
    scartoTempo,
    siglaPunto,
    nomePunto,
    // L'audit, a runtime
    mancanti: () => [...mancanti].map(([chiave, lingue]) => ({ chiave, lingue: [...lingue] })),
    rapporto() {
      const elenco = api.mancanti();
      if (!elenco.length) { console.log('[i18n] Nessuna chiave mancante.'); return elenco; }
      console.warn(`[i18n] ${elenco.length} chiavi mancanti:`);
      for (const voce of elenco) console.warn(`  ${voce.chiave} → ${voce.lingue.join(', ')}`);
      return elenco;
    },
    // Per le prove
    _indice: () => indice.size
  };
  // `translate` era l'ingresso del traduttore a glossario. Non c'è più un
  // glossario, ma il nome resta agganciato al ponte per stringhe intere: chi
  // lo chiamava continua a funzionare, senza le espressioni regolari.
  api.translate = testoLegacy;

  window.astroI18n = api;
  // Alias corto: `i18n.t('chiave')` è la forma che si scrive di più.
  if (!window.i18n) window.i18n = api;

  // I messaggi sono leggibili da questa riga in poi. Il resto — il bottone,
  // l'indice dei nodi, il sorvegliante — vuole un documento, e aspetta.
  preparaDizionari();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia, { once: true });
  } else avvia();
})();
