// =====================================================================
// AstroCalendario - Laboratorio Didattico di Meccanica Celeste
// Codice vanilla JS per simulazioni ed esperimenti interattivi
// =====================================================================

(function() {
  // Stato globale del modulo didattica
  const state = {
    active: false,
    raf: null,

    // 1. Moto Retrogrado
    retro: {
      play: true,
      planet: 'Mars',
      angle: 180, // Angolo della Terra in gradi
      linee: true,
      traces: [], // [{x, y}] per tracciare la linea geocentrica
      lastTs: 0
    },

    // 2. Fionda Gravitazionale
    fionda: {
      activeTab: 'sim', // 'sim' o 'voyager'
      // Simulatore interattivo
      sim: {
        planet: { x: 400, y: 120, r: 24, vx: -1.2, mass: 8000 }, // Giove
        probe: { x: 500, y: 240, vx: -4, vy: -5, active: false, path: [] },
        initDist: 40,
        initVel: 6,
        launched: false,
        ended: false,
        lastTs: 0
      },
      // Voyager
      voyager: {
        play: false,
        anno: 1977, // Da 1977 a 1989
        lastTs: 0,
        pathVoy1: [],
        pathVoy2: []
      }
    },

    // 3. Allineamenti
    align: {
      results: []
    },

    // 4. Finestre di Lancio
    lancio: {
      dest: 'Marte',
      offset: 0, // offset in giorni
      probe: null, // {x, y, vx, vy, path, t}
      firing: false,
      ended: false,
      resultText: "Trascina la slitta e premi 'Lancia Sonda' per iniziare!",
      t: 0
    }
  };

  // Esponiamo le funzioni di avvio e spegnimento nel contesto globale
  window.didatticaAvvia = function() {
    if (state.active) return;
    state.active = true;

    // Inizializziamo i controlli DOM la prima volta
    initDOM();

    // Avviamo il ciclo di disegno
    state.lastTs = performance.now();
    state.raf = requestAnimationFrame(cicloDidattica);
  };

  window.didatticaSpegni = function() {
    state.active = false;
    if (state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = null;
    }
  };

  // --- Inizializzazione controlli DOM ----------------------------------------
  let domInited = false;
  function initDOM() {
    if (domInited) return;
    domInited = true;

    // 1. Moto Retrogrado
    const retroPlay = document.getElementById('did-retro-btn-play');
    if (retroPlay) {
      retroPlay.addEventListener('click', () => {
        state.retro.play = !state.retro.play;
        retroPlay.textContent = state.retro.play ? 'Pausa' : 'Avvia';
      });
    }
    const retroReset = document.getElementById('did-retro-btn-reset');
    if (retroReset) {
      retroReset.addEventListener('click', () => {
        state.retro.traces = [];
      });
    }
    const retroPianeta = document.getElementById('did-retro-pianeta');
    if (retroPianeta) {
      retroPianeta.addEventListener('change', (e) => {
        state.retro.planet = e.target.value;
        state.retro.traces = [];
      });
    }
    const retroTempo = document.getElementById('did-retro-tempo');
    if (retroTempo) {
      retroTempo.addEventListener('input', (e) => {
        state.retro.angle = Number(e.target.value);
        state.retro.play = false;
        if (retroPlay) retroPlay.textContent = 'Avvia';
        updateRetroLabel();
      });
    }
    const retroLinee = document.getElementById('did-retro-linee');
    if (retroLinee) {
      retroLinee.addEventListener('change', (e) => {
        state.retro.linee = e.target.checked;
      });
    }

    // 2. Fionda Gravitazionale (Tabs)
    const tabSim = document.getElementById('did-fionda-tab-sim');
    const tabVoyager = document.getElementById('did-fionda-tab-voyager');
    const contSim = document.getElementById('did-fionda-cont-sim');
    const contVoyager = document.getElementById('did-fionda-cont-voyager');

    if (tabSim && tabVoyager) {
      tabSim.addEventListener('click', () => {
        state.fionda.activeTab = 'sim';
        tabSim.className = 'px-4 py-2 text-xs font-bold border-b-2 border-blue-500 text-blue-400';
        tabVoyager.className = 'px-4 py-2 text-xs font-bold text-slate-400 hover:text-white border-b-2 border-transparent';
        if (contSim) contSim.classList.remove('hidden');
        if (contVoyager) contVoyager.classList.add('hidden');
      });
      tabVoyager.addEventListener('click', () => {
        state.fionda.activeTab = 'voyager';
        tabVoyager.className = 'px-4 py-2 text-xs font-bold border-b-2 border-blue-500 text-blue-400';
        tabSim.className = 'px-4 py-2 text-xs font-bold text-slate-400 hover:text-white border-b-2 border-transparent';
        if (contVoyager) contVoyager.classList.remove('hidden');
        if (contSim) contSim.classList.add('hidden');
      });
    }

    // Fionda Simulatore Controlli
    const fiondaDist = document.getElementById('did-fionda-dist');
    const fiondaDistVal = document.getElementById('did-fionda-dist-val');
    if (fiondaDist && fiondaDistVal) {
      fiondaDist.addEventListener('input', (e) => {
        state.fionda.sim.initDist = Number(e.target.value);
        fiondaDistVal.textContent = e.target.value + ' px';
        resetFiondaSim();
      });
    }
    const fiondaVel = document.getElementById('did-fionda-vel');
    const fiondaVelVal = document.getElementById('did-fionda-vel-val');
    if (fiondaVel && fiondaVelVal) {
      fiondaVel.addEventListener('input', (e) => {
        state.fionda.sim.initVel = Number(e.target.value);
        fiondaVelVal.textContent = e.target.value + ' km/s';
        resetFiondaSim();
      });
    }
    const fiondaLancia = document.getElementById('did-fionda-btn-lancia');
    if (fiondaLancia) {
      fiondaLancia.addEventListener('click', () => {
        lanciaSondaFionda();
      });
    }
    const fiondaReset = document.getElementById('did-fionda-btn-reset');
    if (fiondaReset) {
      fiondaReset.addEventListener('click', () => {
        resetFiondaSim();
      });
    }

    // Fionda Voyager Controlli
    const voyPlay = document.getElementById('did-voyager-btn-play');
    if (voyPlay) {
      voyPlay.addEventListener('click', () => {
        state.fionda.voyager.play = !state.fionda.voyager.play;
        voyPlay.textContent = state.fionda.voyager.play ? 'Pausa' : 'Avvia Viaggio';
      });
    }
    const voyTempo = document.getElementById('did-voyager-tempo');
    if (voyTempo) {
      voyTempo.addEventListener('input', (e) => {
        state.fionda.voyager.anno = Number(e.target.value);
        state.fionda.voyager.play = false;
        if (voyPlay) voyPlay.textContent = 'Avvia Viaggio';
        updateVoyagerLabel();
      });
    }

    // 3. Allineamenti Controlli
    const alignCerca = document.getElementById('did-align-btn-cerca');
    if (alignCerca) {
      alignCerca.addEventListener('click', () => {
        calcolaAllineamenti();
      });
    }

    // 4. Finestre di Lancio Controlli
    const lancioDest = document.getElementById('did-lancio-dest');
    if (lancioDest) {
      lancioDest.addEventListener('change', (e) => {
        state.lancio.dest = e.target.value;
        resetLancioSim();
      });
    }
    const lancioOffset = document.getElementById('did-lancio-offset');
    const lancioOffsetVal = document.getElementById('did-lancio-offset-val');
    if (lancioOffset && lancioOffsetVal) {
      lancioOffset.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.lancio.offset = val;
        if (val === 0) {
          lancioOffsetVal.textContent = "0 giorni (Perfetto)";
          lancioOffsetVal.className = "font-mono font-bold text-green-400";
        } else if (val > 0) {
          lancioOffsetVal.textContent = `+${val} giorni (In ritardo)`;
          lancioOffsetVal.className = "font-mono font-bold text-yellow-500";
        } else {
          lancioOffsetVal.textContent = `${val} giorni (In anticipo)`;
          lancioOffsetVal.className = "font-mono font-bold text-blue-400";
        }
        resetLancioSim();
      });
    }
    const lancioBtnFire = document.getElementById('did-lancio-btn-fire');
    if (lancioBtnFire) {
      lancioBtnFire.addEventListener('click', () => {
        lanciaSondaHohmann();
      });
    }
  }

  function updateRetroLabel() {
    const lbl = document.getElementById('did-retro-tempo-val');
    if (lbl) lbl.textContent = Math.round((state.retro.angle / 360) * 100) + '%';
  }

  function updateVoyagerLabel() {
    const lbl = document.getElementById('did-voyager-anno-val');
    if (lbl) lbl.textContent = state.fionda.voyager.anno.toFixed(1);
    const slider = document.getElementById('did-voyager-tempo');
    if (slider) slider.value = state.fionda.voyager.anno;
  }

  // --- Ciclo Didattica principale (Animazione) ------------------------------
  function cicloDidattica(ts) {
    if (!state.active) return;
    const dt = Math.min(100, ts - state.lastTs) / 1000;
    state.lastTs = ts;

    // 1. Aggiorna e disegna Moto Retrogrado
    aggiornaRetrogrado(dt);
    disegnaRetrogrado();

    // 2. Aggiorna e disegna Fionda Gravitazionale
    if (state.fionda.activeTab === 'sim') {
      aggiornaFiondaSim(dt);
      disegnaFiondaSim();
    } else {
      aggiornaVoyager(dt);
      disegnaVoyager();
    }

    // 4. Aggiorna e disegna Finestre di Lancio
    aggiornaLancio(dt);
    disegnaLancio();

    state.raf = requestAnimationFrame(cicloDidattica);
  }

  // --- 1. MOTO RETROGRADO LOGICA ---------------------------------------------
  function aggiornaRetrogrado(dt) {
    if (!state.retro.play) return;

    // La Terra compie un giro completo. Incrementiamo l'angolo
    state.retro.angle = (state.retro.angle + dt * 12) % 360;

    // Aggiorna lo slider del tempo graficamente
    const slider = document.getElementById('did-retro-tempo');
    if (slider) slider.value = Math.round(state.retro.angle);
    updateRetroLabel();
  }

  function disegnaRetrogrado() {
    const cElio = document.getElementById('did-retro-canvas-elio');
    const cGeo = document.getElementById('did-retro-canvas-geo');
    if (!cElio || !cGeo) return;

    const ctxElio = cElio.getContext('2d');
    const ctxGeo = cGeo.getContext('2d');
    if (!ctxElio || !ctxGeo) return;

    // Assicuriamoci che i canvas abbiano le giuste dimensioni interne
    const L = 300, H = 300;
    if (cElio.width !== L) { cElio.width = L; cElio.height = H; }
    if (cGeo.width !== L) { cGeo.width = L; cGeo.height = H; }

    const cx = L / 2, cy = H / 2;

    // Parametri delle orbite
    const rSole = 12;
    const rTerra = 55;

    let rPianeta, ratio, colorPianeta, nomePianeta;
    if (state.retro.planet === 'Mars') {
      rPianeta = 95;
      ratio = 1 / 1.88;
      colorPianeta = '#f87171';
      nomePianeta = 'Marte';
    } else if (state.retro.planet === 'Jupiter') {
      rPianeta = 125;
      ratio = 1 / 4.0; // Velocizzato visivamente rispetto a 11.8 per mostrare il loop
      colorPianeta = '#fb923c';
      nomePianeta = 'Giove';
    } else {
      rPianeta = 145;
      ratio = 1 / 6.0; // Velocizzato visivamente rispetto a 29.4
      colorPianeta = '#fef08a';
      nomePianeta = 'Saturno';
    }

    const rad1 = state.retro.angle * Math.PI / 180;
    const rad2 = (state.retro.angle * ratio) * Math.PI / 180;

    // Calcolo posizioni
    const tX = cx + rTerra * Math.cos(rad1);
    const tY = cy + rTerra * Math.sin(rad1);
    const pX = cx + rPianeta * Math.cos(rad2);
    const pY = cy + rPianeta * Math.sin(rad2);

    // --- DISEGNO ELIOCENTRICO ---
    ctxElio.clearRect(0, 0, L, H);
    // Sfondo spazio scuro
    ctxElio.fillStyle = '#0b0f19';
    ctxElio.fillRect(0, 0, L, H);

    // Orbite
    ctxElio.strokeStyle = 'rgba(255,255,255,0.08)';
    ctxElio.lineWidth = 1;
    ctxElio.beginPath(); ctxElio.arc(cx, cy, rTerra, 0, Math.PI*2); ctxElio.stroke();
    ctxElio.beginPath(); ctxElio.arc(cx, cy, rPianeta, 0, Math.PI*2); ctxElio.stroke();

    // Sole
    ctxElio.fillStyle = '#eab308';
    ctxElio.beginPath(); ctxElio.arc(cx, cy, rSole, 0, Math.PI*2); ctxElio.fill();

    // Linea di vista ed estensione
    const dx = pX - tX;
    const dy = pY - tY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const ndx = dx / dist;
    const ndy = dy / dist;

    if (state.retro.linee) {
      ctxElio.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctxElio.lineWidth = 1.2;
      ctxElio.setLineDash([4, 4]);
      ctxElio.beginPath();
      ctxElio.moveTo(tX, tY);
      ctxElio.lineTo(tX + ndx * 240, tY + ndy * 240);
      ctxElio.stroke();
      ctxElio.setLineDash([]);
    }

    // Terra
    ctxElio.fillStyle = '#3b82f6';
    ctxElio.beginPath(); ctxElio.arc(tX, tY, 5, 0, Math.PI*2); ctxElio.fill();
    ctxElio.fillStyle = '#ffffff';
    ctxElio.font = '10px sans-serif';
    ctxElio.fillText('Terra', tX + 8, tY + 3);

    // Pianeta
    ctxElio.fillStyle = colorPianeta;
    ctxElio.beginPath(); ctxElio.arc(pX, pY, 6, 0, Math.PI*2); ctxElio.fill();
    ctxElio.fillText(nomePianeta, pX + 8, pY + 3);

    // --- DISEGNO GEOCENTRICO ---
    ctxGeo.clearRect(0, 0, L, H);
    ctxGeo.fillStyle = '#0b0f19';
    ctxGeo.fillRect(0, 0, L, H);

    // Cerchio delle stelle fisse di sfondo
    const rStelle = 120;
    ctxGeo.strokeStyle = 'rgba(255,255,255,0.05)';
    ctxGeo.lineWidth = 1;
    ctxGeo.beginPath(); ctxGeo.arc(cx, cy, rStelle, 0, Math.PI*2); ctxGeo.stroke();

    // Disegniamo alcune costellazioni/stelle fisse di sfondo per riferimento visivo
    ctxGeo.fillStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < 12; i++) {
      const sRad = i * Math.PI / 6;
      const sX = cx + rStelle * Math.cos(sRad);
      const sY = cy + rStelle * Math.sin(sRad);
      ctxGeo.beginPath(); ctxGeo.arc(sX, sY, 2, 0, Math.PI*2); ctxGeo.fill();
      // Nomi segni zodiacali fittizi
      ctxGeo.fillStyle = 'rgba(255,255,255,0.15)';
      ctxGeo.font = '8px font-mono';
      ctxGeo.fillText('*', sX - 2, sY - 5);
      ctxGeo.fillStyle = 'rgba(255,255,255,0.2)';
    }

    // Calcolo angolo apparente geocentrico
    const appAngle = Math.atan2(dy, dx);
    const traceX = cx + rStelle * Math.cos(appAngle);
    const traceY = cy + rStelle * Math.sin(appAngle) + 20 * Math.sin(rad1 - rad2); // Aggiungiamo un'inclinazione fittizia per creare il cappio 2D invece di una linea retta avanti/indietro!

    // Memorizza traccia
    if (state.retro.play) {
      state.retro.traces.push({ x: traceX, y: traceY });
      if (state.retro.traces.length > 500) state.retro.traces.shift();
    }

    // Disegna la traccia passata del pianeta (il cappio!)
    if (state.retro.traces.length > 1) {
      ctxGeo.strokeStyle = colorPianeta + 'cc';
      ctxGeo.lineWidth = 2;
      ctxGeo.beginPath();
      ctxGeo.moveTo(state.retro.traces[0].x, state.retro.traces[0].y);
      for (let i = 1; i < state.retro.traces.length; i++) {
        ctxGeo.lineTo(state.retro.traces[i].x, state.retro.traces[i].y);
      }
      ctxGeo.stroke();
    }

    // Linea di collegamento Terra-Pianeta proiettata nel cielo geocentrico
    if (state.retro.linee) {
      ctxGeo.strokeStyle = 'rgba(59, 130, 246, 0.25)';
      ctxGeo.lineWidth = 1;
      ctxGeo.beginPath();
      ctxGeo.moveTo(cx, cy);
      ctxGeo.lineTo(traceX, traceY);
      ctxGeo.stroke();
    }

    // La Terra fissa al centro per la vista geocentrica
    ctxGeo.fillStyle = '#3b82f6';
    ctxGeo.beginPath(); ctxGeo.arc(cx, cy, 6, 0, Math.PI*2); ctxGeo.fill();
    ctxGeo.fillStyle = '#ffffff';
    ctxGeo.font = '10px sans-serif';
    ctxGeo.fillText('Terra (osservatore)', cx - 45, cy - 12);

    // Il pianeta proiettato
    ctxGeo.fillStyle = colorPianeta;
    ctxGeo.beginPath(); ctxGeo.arc(traceX, traceY, 6, 0, Math.PI*2); ctxGeo.fill();
    ctxGeo.fillText(nomePianeta, traceX + 8, traceY + 3);
  }

  // --- 2. FIONDA GRAVITAZIONALE LOGICA ---------------------------------------
  function lanciaSondaFionda() {
    const sim = state.fionda.sim;
    sim.planet.x = 450;
    sim.probe.x = 100;
    sim.probe.y = 280;

    // Velocità iniziale sonda basata sui controlli
    sim.probe.vx = sim.initVel * 0.7;
    sim.probe.vy = -sim.initVel * 1.0; // Spinta verso l'alto

    // Regolazione parametro d'impatto (offset y)
    sim.probe.y = 120 + sim.initDist;
    sim.probe.vy = -sim.initVel * 0.9;
    sim.probe.vx = sim.initVel * 1.1;

    sim.probe.active = true;
    sim.probe.path = [];
    sim.launched = true;
    sim.ended = false;
  }

  function resetFiondaSim() {
    const sim = state.fionda.sim;
    sim.planet.x = 400;
    sim.probe.active = false;
    sim.probe.path = [];
    sim.launched = false;
    sim.ended = false;

    const vTxt = document.getElementById('did-fionda-sonda-vel');
    const gTxt = document.getElementById('did-fionda-sonda-gain');
    if (vTxt) vTxt.textContent = "—";
    if (gTxt) gTxt.textContent = "—";
  }

  function aggiornaFiondaSim(dt) {
    const sim = state.fionda.sim;

    // Aggiorna posizione Giove (da destra a sinistra)
    sim.planet.x += sim.planet.vx;
    if (sim.planet.x < -50) sim.planet.x = 500;

    if (!sim.probe.active) return;

    // Integrazione fisica
    const dx = sim.planet.x - sim.probe.x;
    const dy = sim.planet.y - sim.probe.y;
    const r2 = dx*dx + dy*dy;
    const r = Math.sqrt(r2);

    if (r < sim.planet.r) {
      // Collisione con il pianeta!
      sim.probe.active = false;
      sim.ended = true;
      const vTxt = document.getElementById('did-fionda-sonda-vel');
      if (vTxt) vTxt.textContent = "Schiantata!";
      return;
    }

    // Forza gravitazionale fittizia
    const f = sim.planet.mass / (r2 + 100); // addolcimento
    const ax = f * (dx / r);
    const ay = f * (dy / r);

    sim.probe.vx += ax * dt * 60;
    sim.probe.vy += ay * dt * 60;

    sim.probe.x += sim.probe.vx * dt * 60;
    sim.probe.y += sim.probe.vy * dt * 60;

    // Memorizza percorso
    sim.probe.path.push({ x: sim.probe.x, y: sim.probe.y });

    // Se esce dallo schermo finisce la corsa
    if (sim.probe.x < -20 || sim.probe.x > 520 || sim.probe.y < -20 || sim.probe.y > 320) {
      sim.probe.active = false;
      sim.ended = true;
    }

    // Aggiorna indicatori live
    const vel = Math.sqrt(sim.probe.vx * sim.probe.vx + sim.probe.vy * sim.probe.vy);
    const gain = vel - sim.initVel;
    const vTxt = document.getElementById('did-fionda-sonda-vel');
    const gTxt = document.getElementById('did-fionda-sonda-gain');
    if (vTxt) vTxt.textContent = vel.toFixed(2) + " km/s";
    if (gTxt) {
      gTxt.textContent = (gain >= 0 ? "+" : "") + gain.toFixed(2) + " km/s";
      gTxt.className = gain >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold";
    }
  }

  function disegnaFiondaSim() {
    const c = document.getElementById('did-fionda-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const L = 500, H = 250;
    if (c.width !== L) { c.width = L; c.height = H; }

    ctx.clearRect(0, 0, L, H);
    // Sfondo spaziale scuro
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, L, H);

    // Orbita di Giove (linea fittizia orizzontale)
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, state.fionda.sim.planet.y);
    ctx.lineTo(L, state.fionda.sim.planet.y);
    ctx.stroke();

    // Disegna la traccia della sonda
    const sim = state.fionda.sim;
    if (sim.probe.path.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sim.probe.path[0].x, sim.probe.path[0].y);
      for (let i = 1; i < sim.probe.path.length; i++) {
        ctx.lineTo(sim.probe.path[i].x, sim.probe.path[i].y);
      }
      ctx.stroke();
    }

    // Disegna Giove
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(sim.planet.x, sim.planet.y, sim.planet.r, 0, Math.PI*2);
    ctx.fill();
    // Bande di Giove fittizie
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(sim.planet.x - sim.planet.r, sim.planet.y - 6, sim.planet.r*2, 3);
    ctx.fillRect(sim.planet.x - sim.planet.r, sim.planet.y + 4, sim.planet.r*2, 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.fillText('Giove', sim.planet.x - 15, sim.planet.y + 35);

    // Disegna la sonda
    if (sim.probe.active) {
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(sim.probe.x, sim.probe.y, 4, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // --- Voyager 1 & 2 Grand Tour ----------------------------------------------
  function aggiornaVoyager(dt) {
    const voy = state.fionda.voyager;
    if (!voy.play) return;

    voy.anno += dt * 1.5; // avanzamento anni simulati
    if (voy.anno > 1990) {
      voy.anno = 1977;
      voy.pathVoy1 = [];
      voy.pathVoy2 = [];
    }
    updateVoyagerLabel();
  }

  function disegnaVoyager() {
    const c = document.getElementById('did-voyager-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const L = 500, H = 250;
    if (c.width !== L) { c.width = L; c.height = H; }

    ctx.clearRect(0, 0, L, H);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, L, H);

    const cx = L / 2, cy = H / 2;

    // Disegna Sole
    ctx.fillStyle = '#eab308';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();

    // Orbite dei giganti (Giove, Saturno, Urano, Nettuno)
    const orbite = [
      { r: 40, nome: 'Giove', color: '#fb923c' },
      { r: 75, nome: 'Saturno', color: '#fef08a' },
      { r: 115, nome: 'Urano', color: '#a5f3fc' },
      { r: 160, nome: 'Nettuno', color: '#38bdf8' }
    ];

    orbite.forEach(o => {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, o.r, 0, Math.PI*2);
      ctx.stroke();
    });

    const t = state.fionda.voyager.anno;

    // Calcolo posizioni pianeti fittizie per rappresentare il celebre allineamento
    // Jupiter, Saturn, Uranus, Neptune nel 1977-1989
    const getPlanetPos = (idx, r) => {
      // Configurate per allinearsi verso destra/alto negli anni '80
      let baseAngle = 0.2 + idx * 0.35; // allineamento stretto
      // Velocità orbitale fittizia
      let angSpeed = 0.1 / (idx + 1);
      let angle = baseAngle + angSpeed * (t - 1977);
      return {
        x: cx + r * Math.cos(angle),
        y: cy - r * Math.sin(angle)
      };
    };

    const jPos = getPlanetPos(0, 40);
    const sPos = getPlanetPos(1, 75);
    const uPos = getPlanetPos(2, 115);
    const nPos = getPlanetPos(3, 160);

    // Disegniamo i pianeti
    const drawP = (pos, col, name) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '8px sans-serif';
      ctx.fillText(name, pos.x + 6, pos.y + 3);
    };

    drawP(jPos, '#f97316', 'Giove');
    drawP(sPos, '#eab308', 'Saturno');
    drawP(uPos, '#06b6d4', 'Urano');
    drawP(nPos, '#0284c7', 'Nettuno');

    // Calcola traiettoria Voyager 1 (Terra -> Jupiter -> Saturn -> Out)
    // Usiamo spline o interpolazioni per riprodurre il volo storico
    const getVoy1Pos = (yr) => {
      if (yr < 1977.7) { // Lancio e crociera interna
        const p = (yr - 1977) / 0.7;
        return { x: cx + p * (jPos.x - cx), y: cy + p * (jPos.y - cy), v: 14 + p*2 };
      } else if (yr < 1979.2) { // Incontro Giove (Marzo 1979)
        const p = (yr - 1977.7) / 1.5;
        // Deviazione fionda
        const v = 16 + 25 * Math.sin(p * Math.PI);
        const interX = jPos.x + 8 * Math.cos(p*Math.PI*1.5 - 0.5);
        const interY = jPos.y - 8 * Math.sin(p*Math.PI*1.5 - 0.5);
        return { x: interX, y: interY, v: v };
      } else if (yr < 1980.9) { // Viaggio verso Saturno (Incontro Nov 1980)
        const p = (yr - 1979.2) / 1.7;
        const v = 15 + p * 3;
        return { x: jPos.x + p * (sPos.x - jPos.x), y: jPos.y + p * (sPos.y - jPos.y), v: v };
      } else { // Fionda Saturno ed uscita
        const p = (yr - 1980.9) / 9.1;
        const interX = sPos.x + p * 60 + 6 * Math.cos(p * 2);
        const interY = sPos.y - p * 60 - 6 * Math.sin(p * 2);
        return { x: interX, y: interY, v: 18 + 15 * Math.exp(-p*3) };
      }
    };

    // Voyager 2 (Terra -> Giove -> Saturno -> Urano -> Nettuno)
    const getVoy2Pos = (yr) => {
      if (yr < 1979.5) { // Incontro Giove (Luglio 1979)
        const p = (yr - 1977) / 2.5;
        const v = 14 + 18 * Math.sin(p * Math.PI);
        return { x: cx + p * (jPos.x - cx), y: cy + p * (jPos.y - cy), v: v };
      } else if (yr < 1981.6) { // Verso Saturno (Incontro Agosto 1981)
        const p = (yr - 1979.5) / 2.1;
        const v = 15 + 16 * Math.sin(p * Math.PI);
        return { x: jPos.x + p * (sPos.x - jPos.x), y: jPos.y + p * (sPos.y - jPos.y), v: v };
      } else if (yr < 1986.1) { // Verso Urano (Gennaio 1986)
        const p = (yr - 1981.6) / 4.5;
        const v = 14 + 12 * Math.sin(p * Math.PI);
        return { x: sPos.x + p * (uPos.x - sPos.x), y: sPos.y + p * (uPos.y - sPos.y), v: v };
      } else if (yr < 1989.6) { // Verso Nettuno (Agosto 1989)
        const p = (yr - 1986.1) / 3.5;
        const v = 13 + 14 * Math.sin(p * Math.PI);
        return { x: uPos.x + p * (nPos.x - uPos.x), y: uPos.y + p * (nPos.y - uPos.y), v: v };
      } else { // Oltre Nettuno
        const p = (yr - 1989.6) / 0.4;
        return { x: nPos.x + p * 20, y: nPos.y + p * 20, v: 16 };
      }
    };

    const v1 = getVoy1Pos(t);
    const v2 = getVoy2Pos(t);

    // Salviamo tracce
    if (state.fionda.voyager.play) {
      state.fionda.voyager.pathVoy1.push({ x: v1.x, y: v1.y });
      state.fionda.voyager.pathVoy2.push({ x: v2.x, y: v2.y });
      if (state.fionda.voyager.pathVoy1.length > 300) {
        state.fionda.voyager.pathVoy1.shift();
        state.fionda.voyager.pathVoy2.shift();
      }
    }

    // Disegna tracce
    const drawTrace = (path, color) => {
      if (path.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    };

    drawTrace(state.fionda.voyager.pathVoy1, 'rgba(59, 130, 246, 0.4)');
    drawTrace(state.fionda.voyager.pathVoy2, 'rgba(34, 197, 94, 0.4)');

    // Disegna sonde
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath(); ctx.arc(v1.x, v1.y, 3, 0, Math.PI*2); ctx.fill();
    ctx.font = '8px sans-serif';
    ctx.fillText('Voyager 1', v1.x + 5, v1.y - 3);

    ctx.fillStyle = '#4ade80';
    ctx.beginPath(); ctx.arc(v2.x, v2.y, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillText('Voyager 2', v2.x + 5, v2.y + 6);

    // Aggiorna indicatore velocità
    const v1Text = document.getElementById('did-voy1-vel');
    const v2Text = document.getElementById('did-voy2-vel');
    if (v1Text) v1Text.textContent = v1.v.toFixed(1) + " km/s";
    if (v2Text) v2Text.textContent = v2.v.toFixed(1) + " km/s";
  }

  // --- 3. DETECTOR DI ALLINEAMENTI LOGICA ------------------------------------
  function calcolaAllineamenti() {
    const lista = document.getElementById('did-align-lista');
    if (!lista) return;

    lista.innerHTML = '<p class="text-blue-400 text-center py-8 font-semibold">Ricerca astronomica in corso...</p>';

    // Recuperiamo i pianeti selezionati
    const pianetiCheck = [
      { id: 'Mercury', checked: document.getElementById('did-align-mercurio').checked, nome: 'Mercurio' },
      { id: 'Venus', checked: document.getElementById('did-align-venere').checked, nome: 'Venere' },
      { id: 'Earth', checked: document.getElementById('did-align-terra').checked, nome: 'Terra' },
      { id: 'Mars', checked: document.getElementById('did-align-marte').checked, nome: 'Marte' },
      { id: 'Jupiter', checked: document.getElementById('did-align-giove').checked, nome: 'Giove' },
      { id: 'Saturn', checked: document.getElementById('did-align-saturno').checked, nome: 'Saturno' },
      { id: 'Uranus', checked: document.getElementById('did-align-urano').checked, nome: 'Urano' },
      { id: 'Neptune', checked: document.getElementById('did-align-nettuno').checked, nome: 'Nettuno' }
    ].filter(p => p.checked);

    if (pianetiCheck.length < 2) {
      lista.innerHTML = '<p class="text-red-400 text-center py-8">Seleziona almeno 2 pianeti per trovare allineamenti!</p>';
      return;
    }

    const anniCerca = Number(document.getElementById('did-align-periodo').value);

    // Eseguiamo una scansione sui prossimi anni step-by-step
    // Per velocizzare l'esecuzione, campioniamo i giorni e cerchiamo i minimi locali
    const risultati = [];
    const oggi = new Date();
    const giornoMs = 86400000;

    // Per allineamento heliocentrico: deviazione angolare minima tra i pianeti
    // Per congiunzione geocentrica: distanza angolare vista dalla Terra
    let stepGiorni = 12; // risoluzione scansione
    let maxPassi = (anniCerca * 365) / stepGiorni;

    for (let passo = 0; passo < maxPassi; passo++) {
      const dataCorrente = new Date(oggi.getTime() + passo * stepGiorni * giornoMs);

      try {
        const time = Astronomy.MakeTime(dataCorrente);

        // Calcoliamo le posizioni eliocentriche
        const posizioni = pianetiCheck.map(p => {
          const vec = Astronomy.Ecliptic(Astronomy.HelioVector(p.id, time)).vec;
          const ang = Math.atan2(vec.y, vec.x) * 180 / Math.PI;
          return { id: p.id, nome: p.nome, ang: (ang + 360) % 360, vec };
        });

        // 1. Allineamento Eliocentrico (visti dal Sole)
        // Calcoliamo la dispersione massima degli angoli
        let angoli = posizioni.map(p => p.ang).sort((a,b) => a-b);
        let minDiff = 360;
        // Poiché gli angoli girano su 360, dobbiamo trovare la minima estensione che li contiene tutti
        for (let i = 0; i < angoli.length; i++) {
          let diff;
          if (i === angoli.length - 1) {
            diff = (angoli[i] - angoli[0]);
          } else {
            diff = (angoli[i] - angoli[i+1] + 360) % 360;
          }
          let spread = 360 - diff;
          if (spread < minDiff) minDiff = spread;
        }

        if (minDiff < 14) { // Soglia di allineamento tollerabile (es. 14 gradi)
          risultati.push({
            tipo: 'elio',
            scarto: minDiff,
            data: dataCorrente,
            pianeti: posizioni.map(p => p.nome).join(', ')
          });
        }

        // 2. Congiunzioni geocentriche (se abbiamo Terra e almeno altri due pianeti)
        const haTerra = pianetiCheck.some(p => p.id === 'Earth');
        if (haTerra && posizioni.length >= 3) {
          // Calcoliamo le direzioni apparenti geocentriche relative alla Terra
          const terraPos = posizioni.find(p => p.id === 'Earth').vec;
          const altriGeo = posizioni.filter(p => p.id !== 'Earth').map(p => {
            const dx = p.vec.x - terraPos.x;
            const dy = p.vec.y - terraPos.y;
            const dz = p.vec.z - terraPos.z;
            const appLong = Math.atan2(dy, dx) * 180 / Math.PI;
            return { nome: p.nome, long: (appLong + 360) % 360 };
          });

          // Controlliamo il divario angolare tra i pianeti visti dalla Terra
          let geoAngoli = altriGeo.map(p => p.long).sort((a,b) => a-b);
          let geoSpread = geoAngoli[geoAngoli.length - 1] - geoAngoli[0];
          if (geoSpread < 4.0) { // Molto vicini nel cielo terrestre
            risultati.push({
              tipo: 'congiunzione',
              scarto: geoSpread,
              data: dataCorrente,
              pianeti: altriGeo.map(p => p.nome).join(' e ')
            });
          }
        }
      } catch (err) {
        // Ignora date fuori catalogo o errori Astronomy Engine
      }
    }

    // Filtriamo i risultati duplicati vicini prendendo solo il giorno di massimo allineamento (minimo scarto)
    const filtrati = [];
    risultati.sort((a,b) => a.data - b.data);

    let gruppo = [];
    for (let r of risultati) {
      if (gruppo.length === 0) {
        gruppo.push(r);
      } else {
        const diffGiorni = (r.data - gruppo[0].data) / giornoMs;
        if (diffGiorni < 35) { // vicini nel tempo (stesso allineamento)
          gruppo.push(r);
        } else {
          // chiudiamo il gruppo prendendo il migliore
          gruppo.sort((a,b) => a.scarto - b.scarto);
          filtrati.push(gruppo[0]);
          gruppo = [r];
        }
      }
    }
    if (gruppo.length > 0) {
      gruppo.sort((a,b) => a.scarto - b.scarto);
      filtrati.push(gruppo[0]);
    }

    // Disegniamo la lista dei risultati
    if (filtrati.length === 0) {
      lista.innerHTML = '<p class="text-slate-400 text-center py-8">Nessun allineamento stretto trovato in questo periodo con questi pianeti.</p>';
      return;
    }

    // Ordiniamo e limitiamo a 15 risultati
    const finali = filtrati.slice(0, 15);

    lista.innerHTML = finali.map((r, idx) => {
      const dataTxt = r.data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
      const idBottone = `btn-align-goto-${idx}`;

      const icon = r.tipo === 'elio'
        ? `<span class="px-1.5 py-0.5 rounded text-[9px] bg-yellow-500/20 text-yellow-300 font-bold">ELI</span>`
        : `<span class="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-bold">CONG</span>`;

      const descr = r.tipo === 'elio'
        ? `Allineamento eliocentrico (Sole) di: <strong class="text-white">${r.pianeti}</strong>`
        : `Congiunzione spettacolare (Terra) di: <strong class="text-white">${r.pianeti}</strong>`;

      // Memorizziamo la data nel dataset del bottone per gestirla
      setTimeout(() => {
        const btn = document.getElementById(idBottone);
        if (btn) {
          btn.addEventListener('click', () => {
            // Imposta orologio dell'app
            const secOffset = (r.data.getTime() - Date.now()) / 1000;
            skyImpostaOffsetTempo(secOffset);

            // Apri modale del sistema 3D
            apriSistemaSolare();
          });
        }
      }, 50);

      return `
        <div class="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
          <div class="space-y-0.5 pr-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${icon}
              <span class="font-mono text-slate-300 font-bold">${dataTxt}</span>
              <span class="text-[10px] text-slate-400">(Scarto: ${r.scarto.toFixed(1)}°)</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-normal">${descr}</p>
          </div>
          <button id="${idBottone}" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold flex items-center gap-1 transition-colors shrink-0">
            Vedi 3D
          </button>
        </div>
      `;
    }).join('');
  }

  // --- 4. FINESTRE DI LANCIO LOGICA ------------------------------------------
  function resetLancioSim() {
    const l = state.lancio;
    l.probe = null;
    l.firing = false;
    l.ended = false;
    l.t = 0;

    const ris = document.getElementById('did-lancio-risultato');
    if (ris) {
      ris.textContent = "Trascina la slitta per cambiare la data di lancio e premi 'Lancia Sonda'!";
      ris.className = "absolute top-2 left-2 right-2 bg-slate-900/95 backdrop-blur p-2 rounded text-xs border border-slate-700 text-center font-semibold text-slate-300";
    }
  }

  function lanciaSondaHohmann() {
    const l = state.lancio;
    l.firing = true;
    l.ended = false;
    l.t = 0;

    // Inizializza la sonda
    // Posizione iniziale della Terra
    const rTerra = 60;
    // Angolo iniziale ideale di lancio Hohmann per Marte, Venere, Giove
    // Per Marte: Terra parte a 0, Marte a ~44 gradi davanti
    // Per Venere: Terra parte a 0, Venere a ~-54 gradi dietro (orbita interna)
    // Sulla slitta l'utente cambia l'offset di partenza della Terra rispetto a questa configurazione ideale

    let radTerra, radPianeta;

    if (l.dest === 'Marte') {
      radTerra = 0; // Terra parte sul lato destro
      // L'offset dell'utente sposta la Terra rispetto alla posizione di allineamento ideale
      radTerra += (l.offset * Math.PI / 180) * 0.8;
      radPianeta = 44 * Math.PI / 180; // Posizione ideale Marte
    } else if (l.dest === 'Venere') {
      radTerra = 0;
      radTerra += (l.offset * Math.PI / 180) * 0.8;
      radPianeta = -54 * Math.PI / 180; // Posizione ideale Venere
    } else { // Giove
      radTerra = 0;
      radTerra += (l.offset * Math.PI / 180) * 0.8;
      radPianeta = 72 * Math.PI / 180; // Posizione ideale Giove
    }

    l.probe = {
      x: 150 + rTerra * Math.cos(radTerra),
      y: 150 + rTerra * Math.sin(radTerra),
      angle: radTerra,
      path: [],
      success: false
    };

    const ris = document.getElementById('did-lancio-risultato');
    if (ris) {
      ris.textContent = "Sonda in volo! In viaggio lungo l'orbita di trasferimento di Hohmann...";
      ris.className = "absolute top-2 left-2 right-2 bg-blue-900/90 backdrop-blur p-2 rounded text-xs border border-blue-700 text-center font-semibold text-white";
    }
  }

  function aggiornaLancio(dt) {
    const l = state.lancio;
    if (!l.firing || !l.probe) return;

    l.t += dt * 1.5; // avanzamento volo della sonda

    // Posizioni dei pianeti durante il volo
    let rPianeta, periodRatio;
    if (l.dest === 'Marte') {
      rPianeta = 95;
      periodRatio = 1 / 1.88;
    } else if (l.dest === 'Venere') {
      rPianeta = 43;
      periodRatio = 1 / 0.615;
    } else {
      rPianeta = 135;
      periodRatio = 1 / 11.86;
    }

    // Integrazione orbitale fittizia per disegnare l'orbita ellittica di Hohmann
    // La sonda si muove dal raggio della Terra al raggio del pianeta
    const rTerra = 60;
    const tHohmann = 1.0; // tempo di volo standard normalizzato
    const progress = Math.min(1.0, l.t / tHohmann);

    // Orbita ellittica di trasferimento: raggio varia da rTerra a rPianeta
    const rCurrent = rTerra + (rPianeta - rTerra) * Math.sin(progress * Math.PI / 2);
    // Angolo della sonda: compie esattamente 180 gradi di volo lungo l'ellisse
    const sweep = progress * Math.PI;
    const probeAngle = l.probe.angle + (l.dest === 'Venere' ? -sweep : sweep);

    l.probe.x = 150 + rCurrent * Math.cos(probeAngle);
    l.probe.y = 150 + rCurrent * Math.sin(probeAngle);
    l.probe.path.push({ x: l.probe.x, y: l.probe.y });

    if (progress >= 1.0) {
      // Arrivo! Controlliamo se il pianeta è vicino alla sonda
      // Angolo finale del pianeta
      let finalPlanetAngle;
      let idealStartAngle = (l.dest === 'Marte') ? (44 * Math.PI / 180) : (l.dest === 'Venere' ? -54 * Math.PI / 180 : 72 * Math.PI / 180);

      // Posizione reale del pianeta alla fine del volo:
      // angoloIniziale + velocitàOrbitale * tempoVolo
      // se l'offset era 0, l'angolo coincide esattamente con l'arrivo della sonda
      const sweepPlanet = sweep * periodRatio;
      finalPlanetAngle = idealStartAngle + (l.dest === 'Venere' ? -sweepPlanet : sweepPlanet);

      // Applichiamo l'offset iniziale (se l'utente lancia fuori finestra, il pianeta non è al posto giusto)
      const offsetRad = (l.offset * Math.PI / 180) * periodRatio;
      finalPlanetAngle += offsetRad;

      const pX = 150 + rPianeta * Math.cos(finalPlanetAngle);
      const pY = 150 + rPianeta * Math.sin(finalPlanetAngle);

      const dist = Math.sqrt((l.probe.x - pX)*(l.probe.x - pX) + (l.probe.y - pY)*(l.probe.y - pY));

      l.firing = false;
      l.ended = true;

      const ris = document.getElementById('did-lancio-risultato');
      if (dist < 12) { // Soglia di intercettazione
        l.probe.success = true;
        if (ris) {
          ris.textContent = `PERFETTO! Bersaglio centrato! La sonda ha intercettato ${l.dest} con successo!`;
          ris.className = "absolute top-2 left-2 right-2 bg-green-900/95 backdrop-blur p-2 rounded text-xs border border-green-600 text-center font-bold text-white shadow";
        }
      } else {
        l.probe.success = false;
        const giorniSbaglio = Math.round(l.offset);
        let msg = `MANCATO! La sonda ha raggiunto l'orbita di ${l.dest}, ma il pianeta era `;
        if (giorniSbaglio > 0) {
          msg += `già passato da ${giorniSbaglio} giorni.`;
        } else {
          msg += `ancora indietro (lancio in anticipo di ${Math.abs(giorniSbaglio)} giorni).`;
        }
        if (ris) {
          ris.textContent = msg;
          ris.className = "absolute top-2 left-2 right-2 bg-red-950/95 backdrop-blur p-2 rounded text-xs border border-red-700 text-center font-semibold text-red-300 shadow";
        }
      }
    }
  }

  function disegnaLancio() {
    const c = document.getElementById('did-lancio-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const L = 300, H = 300;
    if (c.width !== L) { c.width = L; c.height = H; }

    ctx.clearRect(0, 0, L, H);
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, L, H);

    const cx = L / 2, cy = H / 2;

    // Disegna Sole
    ctx.fillStyle = '#eab308';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();

    // Orbite Terra e Destinazione
    const rTerra = 60;
    let rPianeta, colorPianeta;
    if (state.lancio.dest === 'Marte') {
      rPianeta = 95;
      colorPianeta = '#f87171';
    } else if (state.lancio.dest === 'Venere') {
      rPianeta = 43;
      colorPianeta = '#60a5fa'; // Venere azzurro/blu
    } else {
      rPianeta = 135;
      colorPianeta = '#fb923c';
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, rTerra, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rPianeta, 0, Math.PI*2); ctx.stroke();

    // Calcolo angoli correnti per i pianeti
    // Tempo normalizzato fittizio per l'animazione di sfondo se non in volo, o sincronizzato col volo
    const flightTime = state.lancio.firing ? state.lancio.t : 0;
    let periodRatio = (state.lancio.dest === 'Marte') ? 1/1.88 : (state.lancio.dest === 'Venere' ? 1/0.615 : 1/11.86);

    // Terra
    let angTerra = state.lancio.firing ? state.lancio.probe.angle : 0;
    angTerra += flightTime * Math.PI; // Terra si muove durante il volo
    const tX = cx + rTerra * Math.cos(angTerra);
    const tY = cy + rTerra * Math.sin(angTerra);

    // Disegna Terra
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(tX, tY, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px sans-serif';
    ctx.fillText('Terra', tX + 7, tY + 3);

    // Destinazione
    let idealStartAngle = (state.lancio.dest === 'Marte') ? (44 * Math.PI / 180) : (state.lancio.dest === 'Venere' ? -54 * Math.PI / 180 : 72 * Math.PI / 180);
    let angPianeta = idealStartAngle + (state.lancio.offset * Math.PI / 180) * periodRatio;
    angPianeta += flightTime * Math.PI * periodRatio; // il pianeta si muove più lentamente

    const pX = cx + rPianeta * Math.cos(angPianeta);
    const pY = cy + rPianeta * Math.sin(angPianeta);

    // Disegna Pianeta
    ctx.fillStyle = colorPianeta;
    ctx.beginPath(); ctx.arc(pX, pY, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.lancio.dest, pX + 7, pY + 3);

    // Se la sonda è in volo o ha terminato, la disegniamo
    const l = state.lancio;
    if (l.probe) {
      // Disegniamo la scia
      if (l.probe.path.length > 0) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(l.probe.path[0].x, l.probe.path[0].y);
        for (let i = 1; i < l.probe.path.length; i++) {
          ctx.lineTo(l.probe.path[i].x, l.probe.path[i].y);
        }
        ctx.stroke();
      }

      // Disegna corpo della sonda
      ctx.fillStyle = l.ended ? (l.probe.success ? '#22c55e' : '#ef4444') : '#f43f5e';
      ctx.beginPath();
      ctx.arc(l.probe.x, l.probe.y, 4, 0, Math.PI*2);
      ctx.fill();
    }
  }

})();
