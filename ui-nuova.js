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

  griglia.innerHTML = meteoGrigliaHtml(30);

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
}

function aggiornaStaseraMigliori() {
  const box = document.getElementById('stasera-migliori');
  const sotto = document.getElementById('migliori-sottotitolo');
  if (!box) return;

  if (!osservatoreCorrente()) {
    box.innerHTML = '<p class="text-slate-400 text-sm">Serve la posizione per sapere cosa hai sopra la testa.</p>';
    if (sotto) sotto.textContent = '';
    return;
  }

  const notte = pianComEStanotte();
  if (sotto) sotto.textContent = notte ? notte.testo.charAt(0).toUpperCase() + notte.testo.slice(1) + '.' : '';

  // Dieci bersagli erano dieci ovunque: sul telefono sono quattro schermate
  // di elenco dentro a un riquadro che ne ha altri due sotto, e il decimo
  // della lista non lo raggiunge nessuno. `quanto()` è la stessa misura che
  // usa il resto dell'app per gli elenchi lunghi.
  const migliori = migliorDiStanotte(typeof quanto === 'function' ? quanto(5, 8, 10) : 10);
  if (!migliori.length) {
    box.innerHTML = '<p class="text-slate-400 text-sm">Stanotte non c\'è niente che salga abbastanza da qui.</p>';
    return;
  }

  box.innerHTML = migliori.map(m => {
    const strumento = m.strumento && typeof STRUMENTI !== 'undefined' && STRUMENTI[m.strumento]
      ? `<span class="segno-strumento">${icona(STRUMENTI[m.strumento].disegno, 14)} ${STRUMENTI[m.strumento].nome}</span>` : '';
    const colore = m.punti >= 75 ? '#7fb069' : m.punti >= 50 ? '#eab54a' : '#e2685c';
    return `<div class="riga-migliore">
      <div class="riga-migliore-testa">
        <span class="pallino-voto" style="background:${colore}" title="${m.punti} su 100"></span>
        <strong class="nome-migliore">${m.nome}</strong>
        <span class="ora-migliore">verso le ${oraBreve(m.quando)}, a ${Math.round(m.altezza)}°</span>
      </div>
      <p class="motivi-migliore">${m.motivi.join(' · ')}</p>
      ${strumento}
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
      caricaAurora().then(() => aggiornaAvvisoAurora()).catch(() => {});
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
