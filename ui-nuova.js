// =====================================================================
// L'INTERFACCIA DELLE COSE NUOVE
//
// I moduli aggiunti (il catalogo del cielo, i corpi minori, la
// pianificazione, il meteo da astronomo) sanno calcolare, ma da soli non
// si vedono. Qui c'è il pezzo che li porta sullo schermo:
//
//   — nella vista Stasera: la griglia del meteo da astronomo, la finestra
//     migliore delle prossime notti, l'eventuale avviso di aurora e
//     l'elenco dei migliori bersagli;
//   — nelle Impostazioni: il cielo di casa (la scala di Bortle) e il
//     profilo degli ostacoli;
//   — nel planetario: le lune di Giove e la curva della notte dentro la
//     scheda dell'oggetto.
//
// Sta in un file a parte per la stessa ragione per cui ci stanno gli
// altri: app.js ha ventunmila righe, e ogni cosa nuova che ci si
// aggiunge dentro la rende più difficile da dividere domani.
//
// Ordine di caricamento: per ultimo, dopo tutti gli altri.
// =====================================================================


// =====================================================================
// 1. STASERA — il meteo da astronomo e i migliori bersagli
// =====================================================================

function aggiornaStaseraMeteoAstro() {
  const griglia = document.getElementById('meteo-astro-griglia');
  const finestra = document.getElementById('meteo-astro-finestra');
  if (!griglia) return;

  // Senza previsioni la griglia resta vuota: a dirlo basta la riga della
  // finestra migliore, subito sopra. Da quando le due parti del riquadro
  // sono una sola, i due messaggi di "dati non ancora arrivati" finivano
  // uno sotto l'altro a dire la stessa cosa con parole diverse.
  // Trenta ore erano trenta su qualunque schermo, e la tabella si allargava
  // lo stesso fino a riempire il riquadro: le caselle restano larghe venti
  // pixel (gliel'ho scritto io) e tutto lo spazio avanzato se lo prendeva
  // la colonna dei nomi, che su un monitor diventava una fascia vuota da
  // seicento pixel con il grafico schiacciato a destra. La larghezza in più
  // va spesa in ore, non in vuoto: due giorni e mezzo di previsioni dove ci
  // stanno, trenta ore sul telefono. Il massimo è 72 — tanto ne chiediamo
  // (METEO_ASTRO_GIORNI), e oltre i tre giorni non varrebbero niente.
  const quante = typeof quanto === 'function' ? quanto(30, 44, 60) : 30;
  const pronto = !!(meteoAstro && meteoAstro.ore && meteoAstro.ore.length);
  griglia.innerHTML = pronto ? meteoGrigliaHtml(quante) : '';

  if (finestra) {
    const f = meteoFinestraMigliore();
    if (!f) {
      finestra.textContent = meteoAstro
        ? 'Non riesco a giudicare le prossime notti.'
        : 'Sto scaricando le previsioni…';
      finestra.dataset.esito = 'niente';
    } else {
      finestra.textContent = f.niente ? f.testo : `Finestra migliore: ${f.testo}.`;
      finestra.dataset.esito = f.niente ? 'no' : f.voto >= 75 ? 'ottima' : 'discreta';
    }
  }
}

function aggiornaAvvisoAurora() {
  const box = document.getElementById('meteo-astro-aurora');
  if (!box) return;
  const a = auroraDaQui();
  // Sotto la soglia `auroraDaQui` non restituisce nessun testo, ed è
  // voluto: un avviso che dice «no» ogni sera dell'anno è rumore, e dopo
  // due settimane non lo legge più nessuno — compresa la sera buona.
  if (!a || !a.testo) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.dataset.livello = a.livello;
  box.textContent = a.testo;
  // «Guarda a nord» è un'istruzione che presuppone di sapere già cosa
  // cercare. Il planetario adesso l'aurora la disegna dov'è davvero — e
  // soprattutto sa dire quanto se ne affaccerebbe da qui sopra
  // l'orizzonte: è la differenza fra uscire e non uscire.
  if (typeof aurGuardaInCielo === 'function') {
    const tasto = document.createElement('button');
    tasto.type = 'button';
    tasto.className = 'tasto-planetario';
    tasto.textContent = 'Vedila nel planetario';
    tasto.addEventListener('click', () => aurGuardaInCielo());
    box.appendChild(document.createElement('br'));
    box.appendChild(tasto);
  }
}

// Che cos'è, in due parole, quello che si sta leggendo.
//   Da quando i pianeti non hanno più un elenco tutto loro, in questa lista
//   "Saturno" e "M57" stanno sulla stessa riga: senza un'etichetta, chi non
//   riconosce la sigla non sa se sta guardando un pianeta, una galassia o
//   una cometa — e sono tre serate diverse.
function tipoDelBersaglio(m) {
  if (m.tipo === 'pianeta') return 'pianeta';
  if (m.tipo === 'luna') return '';                    // "Luna" si dice già da sé
  if (m.tipo === 'corpoMinore') return m.dato && m.dato.tipo === 'cometa' ? 'cometa' : 'asteroide';
  if (m.tipo === 'profondo' && m.dato) {
    const che = m.dato.tipoTesto || m.dato.tipo || '';
    // Il nome di catalogo di un oggetto senza nome proprio finisce già col
    // suo tipo — "M39 — ammasso aperto" — e l'etichetta accanto sarebbe la
    // terza volta che si legge la stessa cosa nella stessa riga. Si mette
    // solo a chi il nome proprio ce l'ha: "M110 — Compagna di Andromeda"
    // non dice che è una galassia.
    return che && !m.nome.toLowerCase().includes(che.toLowerCase()) ? che : '';
  }
  return '';
}

function aggiornaStaseraMigliori() {
  const box = document.getElementById('stasera-migliori');
  const sotto = document.getElementById('migliori-sottotitolo');
  if (!box) return;

  if (!osservatoreCorrente()) {
    box.innerHTML = '<p class="text-slate-400 text-sm">Serve la posizione per sapere cosa hai sopra la testa.</p>' +
      '<button type="button" onclick="apriPosizione(true)" class="mt-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-700 hover:bg-blue-600 text-slate-100 transition-colors">Dimmi dove sono</button>';
    if (sotto) sotto.textContent = '';
    return;
  }

  const notte = pianComEStanotte();
  if (sotto) sotto.textContent = notte ? notte.testo.charAt(0).toUpperCase() + notte.testo.slice(1) + '.' : '';

  // Dieci bersagli erano dieci ovunque: sul telefono sono quattro schermate
  // di elenco dentro a un riquadro che ne ha altri due sotto, e il decimo
  // della lista non lo raggiunge nessuno. `quanto()` è la stessa misura che
  // usa il resto dell'app per gli elenchi lunghi. Sul telefono uno in più
  // di prima: questo elenco adesso è l'unico, e deve tenerci dentro anche i
  // pianeti, che avevano il loro. Sul monitor restano dieci — allungarlo
  // ancora voleva dire una colonna di asteroidi di ottava magnitudine sotto
  // ai primi cinque che valgono la serata.
  const migliori = migliorDiStanotte(typeof quanto === 'function' ? quanto(6, 8, 10) : 10);
  if (!migliori.length) {
    box.innerHTML = '<p class="text-slate-400 text-sm">Stanotte non c\'è niente che salga abbastanza da qui.</p>';
    return;
  }

  box.innerHTML = migliori.map(m => {
    const strumento = m.strumento && typeof STRUMENTI !== 'undefined' && STRUMENTI[m.strumento]
      ? `<span class="segno-strumento">${icona(STRUMENTI[m.strumento].disegno, 14)} ${STRUMENTI[m.strumento].nome}</span>` : '';
    const colore = m.punti >= 75 ? '#7fb069' : m.punti >= 50 ? '#eab54a' : '#e2685c';
    const che = tipoDelBersaglio(m);
    // Il tasto che porta al cielo: `cercaNelCielo` apre il planetario e ci
    // punta il bersaglio, e l'identificativo giusto — pianeta, oggetto
    // profondo o cometa — se lo porta dietro la voce (`idCielo`).
    const alCielo = m.idCielo
      ? `<button type="button" class="tasto-planetario" onclick="cercaNelCielo('${m.idCielo.replace(/'/g, "\\'")}')"
           title="Aprilo nel planetario, con la mappa puntata su di lui">${icona('bersaglio', 14)} Planetario</button>`
      : '';
    return `<div class="riga-migliore">
      <div class="riga-migliore-testa">
        <span class="pallino-voto" style="background:${colore}" title="${m.punti} su 100"></span>
        <strong class="nome-migliore">${m.nome}</strong>
        ${che ? `<span class="tipo-migliore">${che}</span>` : ''}
        <span class="ora-migliore">verso le ${oraBreve(m.quando)}, a ${Math.round(m.altezza)}°</span>
      </div>
      <p class="motivi-migliore">${m.motivi.join(' · ')}</p>
      <div class="piede-migliore">${strumento}${alCielo}</div>
    </div>`;
  }).join('');
}

// Tutto il blocco di Stasera che riguarda le cose nuove. Si chiama
// quando la vista si apre e quando cambiano posizione o previsioni.
function aggiornaStaseraNuovo() {
  try { aggiornaStaseraMigliori(); } catch (e) { console.warn('migliori di stanotte:', e); }
  try { aggiornaStaseraMeteoAstro(); } catch (e) { console.warn('meteo da astronomo:', e); }
  try { aggiornaAvvisoAurora(); } catch (e) { console.warn('aurora:', e); }
}


// =====================================================================
// 2. IMPOSTAZIONI — il cielo di casa e gli ostacoli
// =====================================================================

function costruisciSceltaCielo() {
  const box = document.getElementById('imp-cielo-scelta');
  const nota = document.getElementById('imp-cielo-nota');
  if (!box || typeof CAT_CIELI === 'undefined') return;

  const attuale = cieloDiCasa();
  // Dal più scuro al più chiaro: è l'ordine in cui la scala ha senso
  const ordine = [2, 3, 4, 5, 6, 8];

  box.innerHTML = ordine.map(b => {
    const c = CAT_CIELI[b];
    return `<button type="button" class="tasto-cielo-casa${b === attuale ? ' attiva' : ''}" ` +
      `data-bortle="${b}" aria-pressed="${b === attuale}" ` +
      `title="Bortle ${b}: si arriva a vedere fino alla magnitudine ${c.magLimite}">${c.nome}</button>`;
  }).join('');

  box.querySelectorAll('[data-bortle]').forEach(t => {
    t.addEventListener('click', () => {
      impostaCieloDiCasa(parseInt(t.dataset.bortle, 10));
      costruisciSceltaCielo();
      // I bersagli di stanotte cambiano: quello che si vedeva da un cielo
      // di montagna può sparire da uno di città
      aggiornaStaseraNuovo();
    });
  });

  if (nota) {
    const c = CAT_CIELI[attuale];
    const quante = catPronto()
      ? (() => { let q = 0; for (let i = 0; i < cat.quante; i++) if (cat.magnitudini[i] <= c.magLimite) q++; return q; })()
      : null;
    nota.textContent = `Scala di Bortle ${attuale}: a occhio nudo si arriva alla magnitudine ${c.magLimite}` +
      (quante ? `, cioè circa ${quante.toLocaleString('it')} stelle in tutto il cielo.` : '.');
  }
}

function costruisciOrizzonte() {
  const box = document.getElementById('imp-orizzonte');
  if (!box || typeof orizzonteCarica !== 'function') return;

  const valori = orizzonteCarica();
  box.innerHTML = ORIZZONTE_NOMI.map((nome, i) => `
    <label class="casella-orizzonte">
      <span class="dir-orizzonte">${nome}</span>
      <input type="number" min="0" max="80" step="1" inputmode="numeric"
             value="${Math.round(valori[i])}" data-settore="${i}"
             aria-label="Altezza degli ostacoli verso ${nome}, in gradi">
    </label>`).join('');

  const salva = () => {
    const nuovi = Array.from(box.querySelectorAll('[data-settore]'))
      .sort((a, b) => a.dataset.settore - b.dataset.settore)
      .map(i => Number(i.value) || 0);
    orizzonteSalva(nuovi);
    aggiornaStaseraNuovo();
  };
  box.querySelectorAll('[data-settore]').forEach(i => i.addEventListener('change', salva));

  const azzera = document.getElementById('imp-orizzonte-azzera');
  if (azzera && !azzera.dataset.collegato) {
    azzera.dataset.collegato = 'si';
    azzera.addEventListener('click', () => {
      orizzonteSalva(new Array(ORIZZONTE_SETTORI).fill(0));
      costruisciOrizzonte();
      aggiornaStaseraNuovo();
    });
  }
}


// Fin dove cercare montagne, luci e acqua — su una mappa.
//
// Erano tre slitte, ed erano tre numeri chiesti al buio: «ottanta
// chilometri» non vuol dire niente finché non si sa cosa ci sta dentro, e
// da un posto qualunque nessuno lo sa. Dalla pianura padana ottanta
// chilometri arrivano alle Alpi e sono pochi; in mezzo all'Appennino ne
// bastano venti e il resto è il versante di fronte. Chi apriva le
// Impostazioni doveva quindi indovinare, cambiare, tornare nel planetario,
// guardare, e ricominciare.
//
// La domanda però è geografica, e su una carta si risponde da sé: al centro
// c'è dove sei, e i tre cerchi sono esattamente i tre raggi di ricerca.
// Si trascina il bordo di un cerchio, o si tocca il punto fin dove si vuole
// arrivare, e il numero viene dietro invece di venire prima.
//
// Sono i **cerchi veri**, e su questo non si bara: dentro a ognuno c'è
// scritto anche l'anello interno che le richieste usano davvero — le
// frazioni e i villaggi si cercano solo entro `CITTA_RAGGIO_PAESI_KM`, le
// vette senza filtro di quota solo entro `CIME_RAGGIO_VICINE_KM` — e
// accanto al nome c'è quanto si è trovato e quanto di quello il planetario
// sta disegnando adesso. Quel secondo numero è la coerenza fatta vedere: un
// raggio da centocinquanta chilometri che porta quaranta vette di cui zero
// visibili non è un raggio da allargare, è un raggio da stringere.
//
// La slitta resta, sotto la mappa, per il raggio scelto: serve al numero
// esatto, a chi naviga con la tastiera e a chi la mappa non ce l'ha (senza
// Leaflet, o senza una posizione).
//
// Cambiare un raggio butta via l'elenco salvato e ne chiede uno nuovo
// (`raggiImposta` in terreno.js): è una richiesta di rete, quindi si fa
// quando il dito si stacca — al `change` della slitta, al `dragend` della
// maniglia — e non a ogni pixel dello scorrere.

// Le tre famiglie, coi colori con cui il planetario le scrive
// sull'orizzonte (§ `SKY_NOMI_ORIZZONTE`): il cerchio grigio-azzurro è
// quello dei nomi grigio-azzurri, e non c'è una seconda tavolozza da tenere
// d'accordo con la prima.
const RAGGI_VOCI = [
  {
    quale: 'cime', nome: 'Montagne', tinta: '#c4d8f4',
    aiuto: 'Fin dove cercare le vette con un nome. Più largo vuol dire più nomi, ma anche montagne che stanno dietro ad altre montagne.',
    // L'anello interno: dentro si prende tutto quello che ha un nome, fuori
    // solo quello che è abbastanza alto da vedersi da lontano.
    dentro: () => (typeof CIME_RAGGIO_VICINE_KM === 'number'
      ? Math.min(CIME_RAGGIO_VICINE_KM, raggioCime()) : null),
    dentroChe: () => 'ci sono tutte le vette con un nome',
    fuoriChe: () => `solo quelle sopra i ${Math.round(Math.min(
      typeof CIME_QUOTA_LONTANE_M === 'number' ? CIME_QUOTA_LONTANE_M : 1500,
      raggioCime() * 12))} m`,
    stato: () => (typeof cime !== 'undefined') ? cime.stato : null,
    trovate: () => (typeof cime !== 'undefined' && cime.elenco) ? cime.elenco.length : null,
    inVista: () => (typeof cimeVisibili === 'function') ? cimeVisibili().length : null,
    unita: ['vetta', 'vette'],
    spento: () => typeof cime !== 'undefined' && !cime.acceso
  },
  {
    quale: 'citta', nome: 'Luci dei paesi', tinta: '#fdc784',
    aiuto: 'Fin dove cercare i paesi che illuminano l\'orizzonte. Una città grande si vede da lontano, un paese no.',
    dentro: () => (typeof CITTA_RAGGIO_PAESI_KM === 'number'
      ? Math.min(CITTA_RAGGIO_PAESI_KM, raggioCitta()) : null),
    dentroChe: () => 'ci sono anche frazioni e villaggi',
    fuoriChe: () => 'solo città e paesi',
    stato: () => (typeof citta !== 'undefined') ? citta.stato : null,
    trovate: () => (typeof citta !== 'undefined' && citta.elenco) ? citta.elenco.length : null,
    inVista: () => (typeof cittaVicine === 'function') ? cittaVicine().length : null,
    unita: ['paese', 'paesi'],
    spento: () => typeof citta !== 'undefined' && !citta.acceso
  },
  {
    quale: 'acque', nome: 'Laghi e fiumi', tinta: '#92bad6',
    aiuto: 'Fin dove cercare l\'acqua. Più in là di così un lago è sotto l\'orizzonte, o è una riga di due pixel.',
    dentro: () => null,
    stato: () => (typeof acque !== 'undefined') ? acque.stato : null,
    trovate: () => (typeof acque !== 'undefined') ? (acque.quanti || 0) : null,
    inVista: () => (typeof acqueDaDisegnare === 'function') ? acqueDaDisegnare().length : null,
    unita: ['specchio d\'acqua', 'specchi d\'acqua'],
    spento: () => typeof acque !== 'undefined' && !acque.acceso
  }
];

// Quanto si vede attorno al cerchio più largo, quando la mappa si inquadra
// da sé: un cerchio che tocca i bordi sembra tagliato.
const RAGGI_MAPPA_MARGINE = 0.18;

const raggiPannello = {
  costruito: false,
  mappa: null,        // la mappa Leaflet, costruita alla prima apertura
  strato: null,       // il tileLayer
  cerchi: {},         // un L.circle per famiglia
  anelli: {},         // l'anello interno, dove c'è
  maniglia: null,     // il pallino che si trascina, solo sul raggio scelto
  casa: null,         // il puntino di dove sei
  centro: null,       // { lat, lon } su cui è disegnato adesso
  scelto: 'cime',     // quale raggio stanno regolando le mani
  trascinando: false,
  // L'inquadratura è rinviata finché il riquadro non ha una misura vera. La
  // mappa nasce dentro a un modale chiuso **dentro** a una linguetta
  // nascosta, cioè larga zero: un `fitBounds` lì dentro non sceglie uno
  // zoom sbagliato, ne sceglie uno impossibile, e quando il pannello si
  // apre resta quello.
  daInquadrare: true,
  occhio: null        // ResizeObserver: la mappa nasce dentro a un pannello nascosto
};

function raggiVoce(quale) {
  return RAGGI_VOCI.find(v => v.quale === quale) || RAGGI_VOCI[0];
}

function raggiValore(quale) {
  if (quale === 'cime') return raggioCime();
  if (quale === 'acque') return raggioAcque();
  return raggioCitta();
}

// Dove sta il centro dei cerchi: **lo stesso punto da cui il planetario
// guarda**. `terrenoLuogo()` mette in fila il luogo di sola visita del
// planetario e poi la posizione dell'app, ed è la stessa funzione che
// decide dove andare a cercare vette e paesi: chiedere qui la posizione
// per conto nostro vorrebbe dire disegnare dei cerchi centrati su un
// posto e scaricarne i dati di un altro.
function raggiCentro() {
  if (typeof terrenoLuogo === 'function') {
    const l = terrenoLuogo();
    if (l && isFinite(l.lat) && isFinite(l.lon)) return { lat: l.lat, lon: l.lon };
  }
  if (typeof luogoCorrente === 'function') {
    const l = luogoCorrente();
    if (l && isFinite(l.lat) && isFinite(l.lon)) return { lat: l.lat, lon: l.lon };
  }
  return null;
}

function raggiConta(n, unita) {
  if (n === null || n === undefined) return '';
  return `${n} ${n === 1 ? unita[0] : unita[1]}`;
}

// La riga sotto al nome: quanto si è trovato dentro a quel cerchio, e
// quanto di quello il planetario sta disegnando **adesso**.
//
// Il secondo numero è il motivo per cui questa riga esiste. Un raggio da
// centocinquanta chilometri che porta quaranta vette di cui zero in vista
// non è un raggio da allargare — è un raggio da stringere, e senza quel
// numero non c'è modo di saperlo se non tornando nel planetario a
// guardare. Zero e zero però vogliono dire cose diverse a seconda di dove
// si è arrivati: «qui attorno non c'è niente» è una risposta, «sto ancora
// cercando» no, e dirle con la stessa frase è il modo di far credere che
// un elenco vuoto sia definitivo.
function raggiRiga(v) {
  if (v.spento()) return 'spenti';
  const stato = v.stato ? v.stato() : null;
  if (stato === 'in-corso') return 'sto cercando…';
  if (stato === 'fallito') return 'non sono riuscito a cercare';
  const trovate = v.trovate ? v.trovate() : null;
  if (trovate === null) return '';
  if (stato !== 'pronto') return 'apri il planetario per cercare';
  if (!trovate) return 'niente qui attorno';
  const viste = v.inVista ? v.inVista() : null;
  return raggiConta(trovate, v.unita) + (viste === null ? '' : ` · ${viste} in vista`);
}

// L'impaginato, scritto una volta sola. Rifarlo a ogni cambiamento
// vorrebbe dire buttare via la mappa Leaflet insieme al resto — e
// ricostruirla a ogni scatto della slitta è mezzo secondo di tessere
// grigie. Da qui in poi si aggiornano i numeri e i cerchi, non il markup.
function raggiPannelloCostruisci(box) {
  box.innerHTML = `
    <div class="raggi-mappa-guscio">
      <div id="imp-raggi-mappa" class="raggi-mappa"></div>
      <p id="imp-raggi-assente" class="raggi-assente hidden"></p>
    </div>
    <div class="raggi-legenda" role="radiogroup" aria-label="Quale raggio stai regolando">
      ${RAGGI_VOCI.map(v => `
        <button type="button" class="voce-raggio" data-raggio-scelto="${v.quale}"
                role="radio" aria-checked="false" title="${v.aiuto}">
          <span class="pastiglia-raggio" style="--tinta:${v.tinta}"></span>
          <span class="voce-raggio-testo">
            <span class="nome-raggio">${v.nome}</span>
            <span class="conta-raggio" data-conta="${v.quale}"></span>
          </span>
          <span class="misura-raggio" data-misura="${v.quale}"></span>
        </button>`).join('')}
    </div>
    <label class="riga-raggio riga-slitta">
      <span class="nome-raggio" id="imp-raggi-etichetta"></span>
      <input type="range" id="imp-raggi-slitta" aria-label="Raggio di ricerca">
      <span class="misura-raggio" id="imp-raggi-slitta-misura"></span>
    </label>
    <p class="raggi-spiega" id="imp-raggi-spiega"></p>
    <label class="riga-raggio riga-interruttore">
      <input type="checkbox" id="imp-nomi-monti">
      <span>Scrivi i nomi delle montagne sull'orizzonte</span>
    </label>
    <label class="riga-raggio riga-interruttore">
      <input type="checkbox" id="imp-acque">
      <span>Disegna i laghi e i fiumi</span>
    </label>`;

  box.querySelectorAll('[data-raggio-scelto]').forEach(t => {
    t.addEventListener('click', () => raggiScegli(t.dataset.raggioScelto));
  });

  const slitta = document.getElementById('imp-raggi-slitta');
  if (slitta) {
    // Mentre la slitta scorre si muovono solo il numero e il cerchio: il
    // resto costa una richiesta a OpenStreetMap, e non si fa a ogni pixel.
    slitta.addEventListener('input', () => {
      raggiMostraProva(raggiPannello.scelto, Number(slitta.value));
    });
    slitta.addEventListener('change', () => {
      raggiApplica(raggiPannello.scelto, Number(slitta.value));
    });
  }

  const spunta = document.getElementById('imp-nomi-monti');
  if (spunta) spunta.addEventListener('change', () => {
    // Lo stesso interruttore del tasto «Nomi dei monti» nel planetario:
    // uno solo dei due deve esistere davvero, e quello è `cimeAlterna`.
    if (typeof cimeAlterna === 'function' && spunta.checked !== cime.acceso) cimeAlterna();
    costruisciRaggiOrizzonte();
  });

  const spuntaAcque = document.getElementById('imp-acque');
  if (spuntaAcque) spuntaAcque.addEventListener('change', () => {
    if (typeof acqueAlterna === 'function' && spuntaAcque.checked !== acque.acceso) acqueAlterna();
    costruisciRaggiOrizzonte();
  });

  raggiPannello.costruito = true;
}

// La mappa, costruita alla prima apertura del pannello. Senza Leaflet o
// senza una posizione non si costruisce affatto e restano la legenda e la
// slitta, che da sole fanno tutto quello che facevano prima.
function raggiMappaCostruisci() {
  const riquadro = document.getElementById('imp-raggi-mappa');
  const assente = document.getElementById('imp-raggi-assente');
  if (!riquadro || raggiPannello.mappa) return;
  // Finché il pannello non è a schermo non si costruisce niente, ed è una
  // questione di banda e non di pulizia: `costruisciRaggiOrizzonte` la
  // chiamano anche i due tasti del planetario («Nomi dei monti», «Laghi e
  // fiumi»), e costruire lì una mappa vorrebbe dire scaricare una ventina
  // di tessere per una finestra che nessuno ha aperto. A richiamarla
  // quando la linguetta «Planetario» delle Impostazioni compare davvero ci
  // pensa `mostraTab` (app.js, `inizializzaImpostazioni`).
  if (!riquadro.offsetParent && riquadro.getClientRects().length === 0) return;
  const centro = raggiCentro();
  const perche = (typeof L === 'undefined')
    ? 'La mappa non si è caricata (serve la rete la prima volta). I raggi si regolano con la slitta qui sotto.'
    : (!centro ? 'Non so ancora dove sei: scegli una posizione e la mappa comparirà. Intanto i raggi si regolano con la slitta.' : null);
  if (perche) {
    riquadro.classList.add('hidden');
    if (assente) { assente.textContent = perche; assente.classList.remove('hidden'); }
    return;
  }
  riquadro.classList.remove('hidden');
  if (assente) assente.classList.add('hidden');

  raggiPannello.mappa = L.map('imp-raggi-mappa', {
    zoomControl: true, attributionControl: true,
    scrollWheelZoom: true, touchZoom: true, tap: true,
    minZoom: 4, maxZoom: 14
  }).setView([centro.lat, centro.lon], 9);

  const fondo = (typeof LUOGO_SFONDI !== 'undefined' && LUOGO_SFONDI.strade)
    ? LUOGO_SFONDI.strade
    : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', nativo: 19, attribuzione: '&copy; OpenStreetMap' };
  raggiPannello.strato = L.tileLayer(fondo.url, {
    maxZoom: 14, maxNativeZoom: Math.min(14, fondo.nativo), attribution: fondo.attribuzione
  }).addTo(raggiPannello.mappa);

  // Toccare la mappa vuol dire «fin lì»: la distanza dal centro è il raggio,
  // e il cerchio scelto ci va. È il gesto per cui questa mappa esiste — non
  // si sceglie un numero, si indica un posto.
  raggiPannello.mappa.on('click', e => {
    if (raggiPannello.trascinando) return;
    const c = raggiPannello.centro;
    if (!c || typeof terrenoDistanzaKm !== 'function') return;
    raggiApplica(raggiPannello.scelto, terrenoDistanzaKm(c.lat, c.lon, e.latlng.lat, e.latlng.lng));
  });

  // La mappa nasce dentro a un pannello nascosto (la linguetta «Planetario»
  // delle Impostazioni), quindi alta zero: senza una rimisurata resta grigia
  // per metà. Stessa cura di `luogoMappaCostruisci`.
  if (typeof ResizeObserver === 'function') {
    raggiPannello.occhio = new ResizeObserver(() => {
      if (!raggiPannello.mappa) return;
      raggiPannello.mappa.invalidateSize();
      // Appena il riquadro ha una misura vera, l'inquadratura che si era
      // dovuta rinviare si fa qui.
      raggiMappaDisegna();
    });
    raggiPannello.occhio.observe(riquadro);
  }
}

// Il pallino da trascinare, sul bordo del cerchio scelto. Sta a est perché
// da qualche parte doveva stare, e a est il cerchio non finisce mai sotto
// alla legenda.
function raggiMappaManiglia(km) {
  const c = raggiPannello.centro;
  if (!raggiPannello.mappa || !c || typeof terrenoPuntoA !== 'function') return;
  const p = terrenoPuntoA(c.lat, c.lon, 90, km);
  if (raggiPannello.maniglia) { raggiPannello.maniglia.setLatLng([p.lat, p.lon]); return; }

  raggiPannello.maniglia = L.marker([p.lat, p.lon], {
    draggable: true, keyboard: false, zIndexOffset: 500,
    icon: L.divIcon({ className: 'maniglia-raggio', iconSize: [22, 22], iconAnchor: [11, 11] })
  }).addTo(raggiPannello.mappa);

  raggiPannello.maniglia.on('dragstart', () => { raggiPannello.trascinando = true; });
  raggiPannello.maniglia.on('drag', e => {
    const q = raggiPannello.centro;
    if (!q || typeof terrenoDistanzaKm !== 'function') return;
    const ll = e.target.getLatLng();
    raggiMostraProva(raggiPannello.scelto, terrenoDistanzaKm(q.lat, q.lon, ll.lat, ll.lng));
  });
  raggiPannello.maniglia.on('dragend', e => {
    const q = raggiPannello.centro;
    // Il turno si chiude sempre, anche se il conto non si può fare: lasciato
    // acceso, il tocco successivo sulla mappa verrebbe scambiato per la coda
    // di un trascinamento e non farebbe niente.
    raggiPannello.trascinando = false;
    if (!q || typeof terrenoDistanzaKm !== 'function') return;
    const ll = e.target.getLatLng();
    raggiApplica(raggiPannello.scelto, terrenoDistanzaKm(q.lat, q.lon, ll.lat, ll.lng));
  });
}

// I tre cerchi e i loro anelli interni. `prova` è il raggio che il dito sta
// dettando in questo istante: si disegna quello, ma non si salva niente.
function raggiMappaDisegna(prova) {
  const mappa = raggiPannello.mappa;
  if (!mappa) return;
  const centro = raggiCentro();
  if (!centro) return;
  const spostato = !raggiPannello.centro ||
    (typeof terrenoDistanzaKm === 'function' &&
      terrenoDistanzaKm(raggiPannello.centro.lat, raggiPannello.centro.lon, centro.lat, centro.lon) > 0.3);
  raggiPannello.centro = centro;

  if (!raggiPannello.casa) {
    raggiPannello.casa = L.circleMarker([centro.lat, centro.lon], {
      radius: 5, color: '#0f172a', weight: 2, fillColor: '#fef08a', fillOpacity: 1
    }).addTo(mappa);
    raggiPannello.casa.bindTooltip('Da qui guardi il cielo', { direction: 'top' });
  } else if (spostato) {
    raggiPannello.casa.setLatLng([centro.lat, centro.lon]);
  }

  let piuLargo = 0;
  for (const v of RAGGI_VOCI) {
    const scelto = v.quale === raggiPannello.scelto;
    const km = (scelto && prova !== undefined && prova !== null) ? prova : raggiValore(v.quale);
    piuLargo = Math.max(piuLargo, km);
    const stile = {
      color: v.tinta, weight: scelto ? 2.6 : 1.4, opacity: v.spento() ? 0.35 : 0.95,
      // Riempire tutt'e tre vorrebbe dire tre veli sovrapposti al centro e
      // niente ai bordi, cioè il contrario di quello che si vuole leggere.
      // Si riempie solo quello che si sta regolando.
      fillColor: v.tinta, fillOpacity: scelto ? 0.1 : 0,
      dashArray: v.spento() ? '4 5' : null, interactive: false
    };
    if (raggiPannello.cerchi[v.quale]) {
      raggiPannello.cerchi[v.quale].setLatLng([centro.lat, centro.lon]);
      raggiPannello.cerchi[v.quale].setRadius(km * 1000);
      raggiPannello.cerchi[v.quale].setStyle(stile);
    } else {
      raggiPannello.cerchi[v.quale] = L.circle([centro.lat, centro.lon], km * 1000, stile).addTo(mappa);
    }

    // L'anello interno, dove la richiesta ne ha uno: è la parte di verità
    // che una slitta sola non poteva dire.
    const dentro = v.dentro ? v.dentro() : null;
    const anello = raggiPannello.anelli[v.quale];
    if (dentro && dentro < km - 0.5) {
      const s = {
        color: v.tinta, weight: 1, opacity: 0.5, dashArray: '2 4',
        fill: false, interactive: false
      };
      if (anello) { anello.setLatLng([centro.lat, centro.lon]); anello.setRadius(dentro * 1000); anello.setStyle(s); }
      else raggiPannello.anelli[v.quale] = L.circle([centro.lat, centro.lon], dentro * 1000, s).addTo(mappa);
    } else if (anello) {
      mappa.removeLayer(anello);
      raggiPannello.anelli[v.quale] = null;
    }
  }

  raggiMappaManiglia((prova !== undefined && prova !== null) ? prova : raggiValore(raggiPannello.scelto));

  // Ci si inquadra da sé quando serve e non a ogni giro: chi si è
  // avvicinato per vedere dove cade il bordo non deve ritrovarsi
  // allontanato al primo aggiornamento. Serve alla prima apertura, quando
  // ci si sposta e quando il cerchio più largo esce dallo schermo.
  const grande = raggiPannello.cerchi[RAGGI_VOCI.reduce(
    (a, b) => (raggiValore(a.quale) >= raggiValore(b.quale) ? a : b)).quale];
  if (spostato) raggiPannello.daInquadrare = true;
  const misura = mappa.getSize();
  if (!grande || misura.x < 40 || misura.y < 40) return;
  if (raggiPannello.daInquadrare || !mappa.getBounds().contains(grande.getBounds())) {
    mappa.fitBounds(grande.getBounds().pad(RAGGI_MAPPA_MARGINE), { animate: false });
    raggiPannello.daInquadrare = false;
  }
}

// Il raggio che si sta regolando adesso.
function raggiScegli(quale) {
  if (!RAGGI_VOCI.some(v => v.quale === quale)) return;
  raggiPannello.scelto = quale;
  costruisciRaggiOrizzonte();
}

// Il dito sta dettando un raggio: si muovono il numero e il cerchio, e
// nient'altro. Nessuna richiesta di rete finché il dito non si stacca.
function raggiMostraProva(quale, km) {
  const l = RAGGI_LIMITI[quale];
  const v = Math.max(l.min, Math.min(l.max, Math.round(Number(km) / l.passo) * l.passo));
  const misura = document.querySelector(`[data-misura="${quale}"]`);
  if (misura) misura.textContent = `${v} km`;
  const suSlitta = document.getElementById('imp-raggi-slitta-misura');
  if (suSlitta && quale === raggiPannello.scelto) suSlitta.textContent = `${v} km`;
  const slitta = document.getElementById('imp-raggi-slitta');
  if (slitta && quale === raggiPannello.scelto && Number(slitta.value) !== v) slitta.value = String(v);
  raggiMappaDisegna(v);
}

// Il dito si è staccato: adesso sì che si salva e si riscarica.
function raggiApplica(quale, km) {
  if (typeof raggiImposta !== 'function') return;
  raggiImposta(quale, km);
  costruisciRaggiOrizzonte();
}

function costruisciRaggiOrizzonte() {
  const box = document.getElementById('imp-raggi');
  if (!box || typeof RAGGI_LIMITI === 'undefined') return;
  if (!raggiPannello.costruito) raggiPannelloCostruisci(box);
  raggiMappaCostruisci();

  const scelta = raggiVoce(raggiPannello.scelto);

  for (const v of RAGGI_VOCI) {
    const km = raggiValore(v.quale);
    const tasto = box.querySelector(`[data-raggio-scelto="${v.quale}"]`);
    if (tasto) {
      const attivo = v.quale === raggiPannello.scelto;
      tasto.classList.toggle('attiva', attivo);
      tasto.classList.toggle('spenta', !!v.spento());
      tasto.setAttribute('aria-checked', attivo ? 'true' : 'false');
    }
    const misura = box.querySelector(`[data-misura="${v.quale}"]`);
    if (misura) misura.textContent = `${km} km`;
    const conta = box.querySelector(`[data-conta="${v.quale}"]`);
    if (conta) conta.textContent = raggiRiga(v);
  }

  const l = RAGGI_LIMITI[scelta.quale];
  const valore = raggiValore(scelta.quale);
  const slitta = document.getElementById('imp-raggi-slitta');
  if (slitta) {
    slitta.min = l.min; slitta.max = l.max; slitta.step = l.passo;
    slitta.value = String(valore);
    slitta.setAttribute('aria-label', `Raggio di ricerca: ${scelta.nome}`);
  }
  const etichetta = document.getElementById('imp-raggi-etichetta');
  if (etichetta) etichetta.textContent = scelta.nome;
  const suSlitta = document.getElementById('imp-raggi-slitta-misura');
  if (suSlitta) suSlitta.textContent = `${valore} km`;

  const spiega = document.getElementById('imp-raggi-spiega');
  if (spiega) {
    const dentro = scelta.dentro ? scelta.dentro() : null;
    spiega.textContent = scelta.aiuto +
      (dentro && dentro < valore - 0.5
        ? ` Entro ${Math.round(dentro)} km ${scelta.dentroChe()}; oltre, ${scelta.fuoriChe()} — è l'anello tratteggiato.`
        : '');
  }

  const spunta = document.getElementById('imp-nomi-monti');
  if (spunta) spunta.checked = typeof cime !== 'undefined' && cime.acceso;
  const spuntaAcque = document.getElementById('imp-acque');
  if (spuntaAcque) spuntaAcque.checked = typeof acque !== 'undefined' && acque.acceso;

  raggiMappaDisegna();
  // Il pannello può essere appena tornato in vista (linguetta «Planetario»,
  // o la finestra riaperta): una mappa Leaflet misurata mentre era nascosta
  // ha le tessere della misura di prima.
  if (raggiPannello.mappa) setTimeout(() => raggiPannello.mappa.invalidateSize(), 60);

  const nota = document.getElementById('imp-raggi-nota');
  if (nota) {
    nota.textContent = (typeof cime !== 'undefined' && cime.acceso)
      ? 'Montagne, paesi e acque si scaricano da OpenStreetMap la prima volta che apri il planetario da un posto nuovo, e poi restano anche senza rete.'
      : 'I nomi delle montagne sono spenti: l\'orizzonte resta la forma del terreno, senza scritte. Si accendono anche dal pannello Visualizzazione del planetario.';
  }
}


// =====================================================================
// 3. PLANETARIO — le lune di Giove e la curva della notte
//
//     Tutt'e due vanno nella scheda che si apre toccando un oggetto sulla
//     mappa. La scheda la costruisce `skySchedaHtml()` in app.js: qui non
//     la si tocca, le si aggiunge un pezzo dopo, quando è già a schermo.
// =====================================================================

// Il disegnino delle lune di Giove: Giove al centro e i quattro puntini
// alle distanze vere, in scala. È l'immagine che si vede nell'oculare, e
// serve a riconoscere quale luna è quale — che a occhio sono identiche.
function disegnaLuneDiGiove(canvas, data) {
  if (!canvas || typeof luneDiGiove !== 'function') return;
  const lune = luneDiGiove(data || skyAdesso());
  if (!lune) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const L = canvas.clientWidth || 300, A = canvas.clientHeight || 68;
  canvas.width = L * dpr; canvas.height = A * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, L, A);

  // Callisto arriva a 26 raggi di Giove: la scala si prende da lì, con un
  // margine, così sta tutto dentro qualunque sia la configurazione.
  const massimo = 28;
  const scala = (L / 2 - 10) / massimo;
  const cx = L / 2, cy = A / 2;

  // L'orbita di ognuna, come una riga d'ombra: dà il senso della distanza
  ctx.strokeStyle = 'rgba(148,163,184,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, cy); ctx.lineTo(L - 10, cy); ctx.stroke();

  // Giove
  const rGiove = Math.max(4, scala);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.ellipse(cx, cy, rGiove, rGiove * 0.94, 0, 0, Math.PI * 2); ctx.fill();
  // le due bande, che sono quello che si vede davvero
  ctx.strokeStyle = 'rgba(180,120,60,0.75)';
  ctx.lineWidth = Math.max(1, rGiove * 0.22);
  [-0.35, 0.35].forEach(y => {
    ctx.beginPath();
    ctx.moveTo(cx - rGiove * 0.85, cy + rGiove * y);
    ctx.lineTo(cx + rGiove * 0.85, cy + rGiove * y);
    ctx.stroke();
  });

  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  lune.forEach(l => {
    const x = cx + l.x * scala, y = cy - l.y * scala;

    if (l.ombraSuGiove && l.ombraX !== null) {
      ctx.fillStyle = 'rgba(20,12,4,0.9)';
      ctx.beginPath();
      ctx.arc(cx + l.ombraX * scala, cy - l.ombraY * scala, Math.max(1.4, rGiove * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }

    // Occultata o eclissata non si disegna: non c'è. È l'informazione
    // più utile del disegno — «stasera se ne vedono tre».
    if (l.occultata || l.eclissata) return;

    ctx.globalAlpha = l.transito ? 0.55 : 1;
    ctx.fillStyle = l.colore;
    ctx.beginPath(); ctx.arc(x, y, l.transito ? 1.6 : 2.6, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#cbd5e1';
    ctx.textBaseline = l.y >= 0 ? 'bottom' : 'top';
    ctx.fillText(l.nome[0], x, l.y >= 0 ? y - 4 : y + 4);
    ctx.globalAlpha = 1;
  });
}

// Il pezzo che si attacca in fondo alla scheda dell'oggetto
function schedaExtraHtml(voce) {
  if (!voce) return '';
  const pezzi = [];

  if (voce.id === 'Jupiter' && typeof luneDiGioveRacconto === 'function') {
    const r = luneDiGioveRacconto(skyAdesso());
    if (r) {
      pezzi.push(`<div class="scheda-extra" data-extra="giove">
        <h4>Le lune di Giove</h4>
        <canvas id="scheda-lune-giove" class="tela-lune"></canvas>
        <p class="fila-lune">${r.fila}</p>
        ${r.fatti.length ? `<p class="fatti-lune">Adesso: ${r.fatti.join('; ')}.</p>` : ''}
        <p class="nota-lune">Cambiano disposizione di ora in ora: guardale a inizio e a fine serata, o usa la macchina del tempo qui sotto.</p>
      </div>`);
    }
  }

  // La curva della notte: per qualunque oggetto che abbia una posizione
  if (typeof pianCurvaNotturna === 'function') {
    pezzi.push(`<div class="scheda-extra" data-extra="curva">
      <h4>Stanotte</h4>
      <canvas id="scheda-curva-notte" class="tela-curva"></canvas>
      <p class="racconto-curva" id="scheda-curva-testo"></p>
    </div>`);
  }

  return pezzi.join('');
}

// Dopo che l'HTML è a schermo, i canvas vanno disegnati: prima non
// esistono e non hanno misura.
function disegnaSchedaExtra(voce) {
  const tela = document.getElementById('scheda-lune-giove');
  if (tela) { try { disegnaLuneDiGiove(tela, skyAdesso()); } catch (e) { /* niente lune */ } }

  const curva = document.getElementById('scheda-curva-notte');
  if (!curva || !voce) return;
  try {
    const bersaglio = voce.ra !== undefined && voce.dec !== undefined
      ? { ra: voce.ra, dec: voce.dec }
      : voce.id;
    const c = pianCurvaNotturna(bersaglio, skyAdesso());
    pianDisegnaCurva(curva, c, voce.nome);
    const testo = document.getElementById('scheda-curva-testo');
    if (testo) testo.textContent = pianRaccontoCurva(c);
  } catch (e) { /* niente curva */ }
}


// =====================================================================
// 4. ACCENDERE TUTTO
// =====================================================================

function inizializzaNuoveFunzioni() {
  // Le previsioni da astronomo partono con calma: non sono la prima cosa
  // che serve, e chiederle subito rallenta l'apertura.
  setTimeout(() => {
    if (typeof caricaMeteoAstro === 'function') {
      caricaMeteoAstro().then(() => aggiornaStaseraMeteoAstro()).catch(() => {});
    }
    if (typeof caricaAurora === 'function') {
      caricaAurora().then(() => {
        aggiornaAvvisoAurora();
        // La previsione del Kp arriva a eventi già calcolati: le notti che
        // vale la pena segnare entrano in calendario adesso, non prima.
        if (typeof aggiornaEventiAurora === 'function') aggiornaEventiAurora();
      }).catch(() => {});
    }
  }, 1200);

  // Il tasto sta in cima al riquadro "Che cielo avrai", che tiene dentro
  // tutt'e due i meteo: le nuvole ora per ora (Open-Meteo, `costruisciStaseraMeteo`)
  // e il meteo da astronomo con l'aurora. Prima ne ricaricava solo metà, e
  // premendolo le nuvole restavano quelle di un'ora fa dieci centimetri più
  // su: adesso rifà quello che il riquadro mostra.
  const aggiorna = document.getElementById('btn-meteo-astro-aggiorna');
  if (aggiorna) {
    aggiorna.addEventListener('click', () => {
      aggiorna.disabled = true;
      // `caricaMeteo(true)`, non (false): il ripiego dalla cache è quello che
      // serve all'apertura della vista, ma qui l'ha chiesto qualcuno che ha
      // premuto un tasto, e vuole i dati di adesso.
      Promise.all([caricaMeteoAstro(true), caricaAurora(true), caricaMeteo(true).catch(() => null)])
        .then(() => {
          aggiornaStaseraMeteoAstro();
          aggiornaAvvisoAurora();
          if (typeof aggiornaEventiAurora === 'function') aggiornaEventiAurora();
          return costruisciStaseraMeteo();
        })
        .catch(() => {})
        .finally(() => { aggiorna.disabled = false; });
    });
  }

  // Le impostazioni si costruiscono all'apertura della finestra: prima
  // il catalogo potrebbe non essere ancora arrivato, e la nota sotto la
  // scala di Bortle direbbe un numero in meno.
  const apri = document.getElementById('btn-impostazioni');
  if (apri) apri.addEventListener('click', () => {
    costruisciSceltaCielo();
    costruisciOrizzonte();
    costruisciRaggiOrizzonte();
  });

  aggiornaStaseraNuovo();
}

// L'aggancio all'avvio. `DOMContentLoaded` è già passato quando questo
// file viene eseguito solo se è stato messo prima di app.js: siccome sta
// dopo, tocca guardare lo stato del documento.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inizializzaNuoveFunzioni);
} else {
  inizializzaNuoveFunzioni();
}
