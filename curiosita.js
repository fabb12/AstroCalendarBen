// =====================================================================
// LE CURIOSITÀ — quello che di un oggetto non si legge nei numeri
//
//     La scheda completa di un astro (il ⓘ del fumetto, §7.4 di
//     `app.js`) risponde benissimo a tre domande: dov'è, quanto è
//     luminoso, quando sorge. Non risponde alla quarta, che è quella per
//     cui uno ha toccato lo schermo: **e allora?**
//
//     «Ras Alhague, magnitudine 2,08, a 33° sopra l'orizzonte» è esatto e
//     non dice niente. «Il nome viene dall'arabo raʾs al-ḥayyah, la testa
//     del serpente, e infatti quella stella sta proprio sulla testa
//     dell'uomo che nella figura il serpente lo tiene in mano» è la stessa
//     stella, e adesso la si riconosce per sempre.
//
//     Il difetto tipico di un pezzo così non è un conto sbagliato: è una
//     frase **generica**. Una curiosità che vale per tutte le stelle non
//     vale per nessuna, e dopo tre oggetti si smette di leggere il
//     riquadro — che è peggio di non averlo affatto. Per questo qui non
//     c'è nessun ripiego per le stelle e per i pianeti: o si ha qualcosa
//     di vero da dire di *quell'* oggetto, o il riquadro non compare. Il
//     solo ripiego è la **specie** del cielo profondo, che è un elenco
//     chiuso di cinque parole e in cui la frase generica è invece
//     l'informazione giusta: di NGC 6633 non c'è niente da raccontare, di
//     cosa sia un ammasso aperto sì.
//
//     Il testo non sta qui: sta nei due dizionari, sotto `curiosita.*`,
//     come ogni altra frase che si legge sullo schermo. Qui c'è soltanto
//     la macchina che, dato un oggetto qualunque del planetario, trova la
//     sua chiave.
//
//     § 1. Lo stato e le costanti
//     § 2. Dallo slug alla chiave: la normalizzazione dei nomi
//     § 3. La catena: da un oggetto del planetario alla sua voce
//     § 4. Le varianti, e il tasto «un'altra»
//     § 5. Il blocco che si legge
// =====================================================================


// =====================================================================
// 1. LO STATO
//
//     Una sola cosa da ricordare: a che variante è arrivato ogni
//     racconto. Non si salva — sapere quale aneddoto si è già letto è una
//     cosa di questa sessione, non una preferenza — e **non può stare nel
//     documento**: la scheda del planetario si riscrive da capo una volta
//     al secondo (§7.4 di `app.js`), quindi qualunque stato appoggiato a
//     un nodo verrebbe buttato via al battito successivo.
// =====================================================================

const cur = {
  varianti: new Map()   // base della chiave → indice della variante mostrata
};

// Quante ne può avere una voce. Non è un tetto di gusto: è il numero di
// chiavi che `curQuante` va a cercare, e cercarne venti per ogni scheda
// sarebbe lavoro buttato. Chi ne scrive una sesta alzi questo numero.
const CUR_VARIANTI_MAX = 5;

// I nove corpi del Sistema Solare, dal loro identificativo di Astronomy
// Engine allo slug del dizionario. Si passa dall'**id** e non dal nome,
// che in inglese è un'altra parola: una tabella che leggesse «Mars»
// smetterebbe di riconoscere Marte appena si cambia lingua, e il sintomo
// sarebbe un riquadro che sparisce — cioè niente di visibile.
const CUR_CORPI = {
  Sun: 'sole', Moon: 'luna', Mercury: 'mercurio', Venus: 'venere',
  Mars: 'marte', Jupiter: 'giove', Saturn: 'saturno', Uranus: 'urano',
  Neptune: 'nettuno'
};

// Le cinque specie del cielo profondo, che sono anche l'unico ripiego di
// tutto questo file. Sono le stesse di `MISS_CATEGORIE_PROFONDO` in
// `missione-cielo.js`, e per la stessa ragione: il catalogo grande porta
// un `tipo` grezzo che è un elenco chiuso di cinque parole.
const CUR_SPECIE = new Set(['ammasso', 'globulare', 'nebulosa', 'planetaria', 'galassia']);


// =====================================================================
// 2. DALLO SLUG ALLA CHIAVE
//
//     Gli identificativi di questo file sono **derivati dai nomi** e non
//     scritti a mano, ed è una scelta con un prezzo e un vantaggio. Il
//     prezzo: una curiosità scritta per una stella che nel catalogo si
//     chiama in un altro modo non comparirà mai, e non lo dirà nessuno —
//     per questo c'è `scripts/prova-curiosita.js`, che confronta gli slug
//     del dizionario con i nomi veri del catalogo. Il vantaggio: non
//     esiste una terza tabella da tenere allineata alle altre due.
// =====================================================================

// Le lettere greche non sopravvivono a una normalizzazione Unicode: `ω`
// resta `ω`, e togliendo tutto ciò che non è una lettera latina «ω Cen»
// diventerebbe «cen», cioè lo stesso slug di «χ Cen». Si traslitterano
// prima, e allora «ω Cen» è `omega-cen` e si distingue.
const CUR_GRECHE = {
  'α': 'alfa', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
  'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
  'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'ο': 'omicron',
  'π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon',
  'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega'
};

/* Da un nome scritto per gli occhi a uno slug scritto per una chiave.
 *
 * Tre cose che non sono dettagli:
 *   - quello che sta fra parentesi si butta. Nel catalogo la prima stella
 *     del Centauro si chiama «Rigil Kentaurus (α Centauri)»: la parentesi
 *     è un chiarimento per chi legge, non parte del nome;
 *   - gli accenti se ne vanno, se no la stessa parola scritta in due modi
 *     darebbe due chiavi;
 *   - un trattino fra una lettera e una cifra si chiude. È la riga che
 *     tiene insieme «M31» e «M 31», che nel catalogo grande sono due voci
 *     della stessa cosa (§`catPreparaProfondo`) e devono raccontare la
 *     stessa storia.
 */
function curSlug(nome) {
  let s = String(nome == null ? '' : nome).replace(/\([^)]*\)/g, ' ');
  for (const g in CUR_GRECHE) s = s.split(g).join(' ' + CUR_GRECHE[g] + ' ');
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/([a-z])-(\d)/g, '$1$2');
}


// =====================================================================
// 3. LA CATENA
//
//     Da un oggetto del planetario — che può arrivare da sette posti
//     diversi, con sette forme diverse — all'elenco delle chiavi da
//     provare, dalla più specifica alla più generica. `curBase` prova e
//     restituisce la prima che esiste davvero.
// =====================================================================

/* Il nome di una stella, quando ce n'è uno vero.
 *
 * Una stella del catalogo senza nome proprio si chiama «Stella CAT 4211
 * di magnitudine 4,2 — Lira» (§`catSchedaStella`): è una descrizione, non
 * un nome, e slugarla darebbe una chiave che non esiste — che non fa
 * danno, ma fa lavoro. `senzaNome` lo dice già, e si crede a lui. */
function curNomeDiStella(o) {
  if (!o || o.senzaNome) return null;
  return typeof o.nome === 'string' && o.nome ? o.nome : null;
}

// La sigla di un oggetto del cielo profondo. Il catalogo grande ce l'ha
// scritta; i quattordici scritti a mano di `SKY_PROFONDO` no, e per loro
// è la prima parola del nome («M31 — Galassia di Andromeda»).
function curSiglaProfondo(o) {
  if (o && o.sigla) return o.sigla;
  if (o && typeof o.nome === 'string') return o.nome.split(' ')[0];
  return '';
}

/* Le chiavi da provare per questo oggetto, dalla più specifica in giù.
 *
 * Restituisce le **basi** (senza il numero della variante): chi le usa ci
 * appende `.1`, `.2`… È una funzione pura e non tocca il dizionario, così
 * la si può provare senza browser. */
function curCatena(o) {
  if (!o) return [];

  // Una costellazione: la sigla IAU di tre lettere, che è l'unico
  // identificativo di una figura che non cambi con la lingua.
  if (o.categoria === 'costellazione' && o.sigla) return ['figura.' + o.sigla.toLowerCase()];

  // Le stazioni spaziali: `iss`, `tiangong`. Sono astri come gli altri
  // per il planetario, e l'unica cosa costruita da noi che ci sia lassù.
  if (o.tipo === 'satellite' && o.satId) return ['astro.' + o.satId];

  // I nove del Sistema Solare, per identificativo.
  if (o.id && CUR_CORPI[o.id]) return ['astro.' + CUR_CORPI[o.id]];

  // Il cielo profondo: prima la sigla, poi la specie. È l'unico posto in
  // cui il ripiego esiste, ed è l'unico in cui una frase generica sia
  // davvero quello che si vuole leggere.
  if (o.categoria === 'profondo') {
    const chiavi = [];
    const sigla = curSlug(curSiglaProfondo(o));
    if (sigla) chiavi.push('profondo.' + sigla);
    if (CUR_SPECIE.has(o.tipo)) chiavi.push('specie.' + o.tipo);
    return chiavi;
  }

  // Comete e asteroidi. I pochi con un nome proprio sono il motivo per
  // cui uno ha aperto il planetario quella sera; per gli altri — le
  // periodiche con la sola sigla — vale il ripiego di specie, che qui è
  // quello che si vuole leggere davvero: di 88P/Howell non c'è niente da
  // raccontare, di cosa sia una cometa periodica sì.
  if (o.categoria === 'corpoMinore') {
    const chiavi = [];
    const s = curSlug(o.nome);
    if (s) chiavi.push('minore.' + s);
    const specie = o.sottotipo === 'cometa' || o.tipo === 'cometa' ? 'cometa' : 'asteroide';
    chiavi.push('specieMinore.' + specie);
    return chiavi;
  }

  // Le stelle, da qualunque delle tre porte arrivino: gli slot
  // `Star1…Star8`, un vertice di una figura disegnata, il fondo del
  // catalogo. Per tutte e tre l'identificativo è il nome proprio.
  if (o.tipo === 'stella' || o.categoria === 'figura' || o.categoria === 'stellaCatalogo') {
    const nome = curNomeDiStella(o);
    const s = nome ? curSlug(nome) : '';
    return s ? ['stella.' + s] : [];
  }

  return [];
}

// La prima base della catena che nel dizionario esiste per davvero, o
// `null` se non c'è niente da raccontare. Fuori da un browser — dove
// `astroI18n` non c'è — non si inventa niente e si risponde `null`: le
// prove del motore controllano `curCatena`, che è pura.
function curBase(o) {
  if (typeof astroI18n !== 'object' || typeof astroI18n.esiste !== 'function') return null;
  for (const base of curCatena(o)) {
    if (astroI18n.esiste('curiosita.' + base + '.1')) return base;
  }
  return null;
}


// =====================================================================
// 4. LE VARIANTI
//
//     Quante storie ha un oggetto non si dichiara: si **misura**, come in
//     `missione-cielo.js` e per la stessa ragione. Di Saturno si possono
//     raccontare tre cose che valgono la pena, di un ammasso aperto senza
//     nome una sola, e tre righe scritte per riempire una tabella si
//     riconoscono subito. Chi ne aggiunge una quarta non deve toccare
//     nessun contatore.
// =====================================================================

function curQuante(base) {
  if (typeof astroI18n !== 'object' || typeof astroI18n.esiste !== 'function') return 1;
  let n = 0;
  while (n < CUR_VARIANTI_MAX && astroI18n.esiste('curiosita.' + base + '.' + (n + 1))) n++;
  return Math.max(1, n);
}

function curIndice(base) {
  const quante = curQuante(base);
  return ((cur.varianti.get(base) || 0) % quante + quante) % quante;
}

function curTesto(base) {
  return astroI18n.t('curiosita.' + base + '.' + (curIndice(base) + 1));
}

/* «Raccontamene un'altra».
 *
 * Non ridisegna la scheda: riscrive il solo testo dei nodi che portano
 * questa base. Ridisegnarla vorrebbe dire, nel planetario, rifare
 * duecento righe di HTML per cambiare una frase, e nell'atlante buttare
 * via il disegno della figura e riportare lo scorrimento in cima —
 * cioè far saltare via dagli occhi proprio la riga che si stava
 * leggendo. Lo stato sta in `cur.varianti`, quindi il battito successivo
 * della scheda del cielo ricompone comunque la variante giusta. */
function curAltra(base) {
  cur.varianti.set(base, (cur.varianti.get(base) || 0) + 1);
  const testo = curTesto(base);
  document.querySelectorAll('[data-curiosita="' + base + '"]').forEach(nodo => {
    nodo.textContent = testo;
  });
}


// =====================================================================
// 5. IL BLOCCO CHE SI LEGGE
// =====================================================================

/* Il riquadro «Curiosità», o stringa vuota se non c'è niente da dire.
 *
 * Il testo va in `textContent` e non nell'HTML: queste frasi contengono
 * apostrofi, virgolette e nomi arabi traslitterati, e una di loro con
 * dentro un `<` sarebbe marcatura. Si scrive quindi il nodo vuoto e lo si
 * riempie subito dopo — `curRiempi`, chiamata da chi ha appena messo il
 * blocco nel documento. */
function curBloccoHtml(o) {
  const base = curBase(o);
  if (!base) return '';
  const quante = curQuante(base);
  const titolo = astroI18n.t('curiosita.titolo');
  const tasto = quante > 1
    ? `<button type="button" class="tasto-curiosita" onclick="curAltra('${base}')">` +
      `${astroI18n.t('curiosita.altra')}</button>`
    : '';
  return `<section class="curiosita-scheda">
    <h4 class="curiosita-titolo">${typeof icona === 'function' ? icona('quaderno', 15) : ''}${titolo}</h4>
    <p class="curiosita-testo" data-curiosita="${base}"></p>${tasto}</section>`;
}

/* Riempie i riquadri appena messi nel documento.
 *
 * Chi ha scritto l'HTML la chiama subito dopo averlo inserito. Sono
 * sempre uno o due nodi: cercarli col selettore costa meno che tenere in
 * giro un riferimento che al battito successivo non varrebbe più. */
function curRiempi(contenitore) {
  const dove = contenitore || document;
  dove.querySelectorAll('[data-curiosita]').forEach(nodo => {
    if (!nodo.dataset.curiosita) return;
    nodo.textContent = curTesto(nodo.dataset.curiosita);
  });
}

if (typeof window !== 'undefined') {
  window.curAltra = curAltra;
}

// Il motore, per le prove che girano senza browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { curSlug, curCatena, CUR_CORPI, CUR_SPECIE, CUR_VARIANTI_MAX };
}
