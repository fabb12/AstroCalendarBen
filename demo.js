/* Ponte fra gli script e le viste vere dell'app. I comandi si registrano
 * con verifica(parametri) e crea(parametri, contesto, scena): aggiorna/chiudi. */
(function () {
  'use strict';
  const predefiniti = AstroDemoPredefiniti;
  const script = predefiniti[0].testo;
  const registro = Object.create(null), evidenze = new Map();
  const t = (chiave, dati) => astroI18n.t('demo.' + chiave, dati);
  // I messaggi di validazione finiscono nell'editor: vanno nella lingua dell'app.
  const err = (chiave, dati) => t('err.' + chiave, dati);
  const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  function richiedi(ok, messaggio) { if (!ok) throw new Error(messaggio); }
  function campi(p, ammessi) {
    for (const k of Object.keys(p)) richiedi(ammessi.includes(k), err('parametroSconosciuto', { nome: k }));
  }
  function minuti(v) {
    richiedi(typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v), err('orario'));
    const [h, m] = v.split(':').map(Number);
    richiedi(h < 24 && m < 60, err('orarioIntervallo')); return h * 60 + m;
  }
  const corpi = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  function istante(ms) {
    skyImpostaOffsetTempo((ms - Date.now()) / 1000, { fluido: true });
    sky.prossimoCalcolo = 0;
  }
  function vista(v, c) {
    if (v === 'planetarium_view') {
      if (sol.aperto) chiudiSistemaSolare();
      mostraVista('cielo');
    } else if (v === 'solar_system_3d') {
      if (!sol.aperto) window.apriSistemaSolare({ senzaVolo: true, inquadra: () => {}, annullato: () => c.chiuso });
      solRidimensiona();
    } else throw new Error(err('vistaSconosciuta', { nome: v }));
  }
  // L'eclisse di Sole più vicina all'istante della demo, prima o dopo. Si
  // cerca un evento reale — la demo non allinea artificialmente i corpi — e
  // la si cerca **a partire dall'orologio del racconto**: con la data di
  // partenza scritta nel codice (1 agosto 2026) ogni demo personale che
  // chiedeva l'ombra finiva sull'eclisse del 2026, qualunque data avesse
  // impostato prima. Le eclissi di Sole capitano ogni sei mesi circa, quindi
  // partendo da sette mesi prima bastano due o tre passi per scavalcare.
  function eclisseVicina(quando) {
    const ora = +quando;
    let evento = Astronomy.SearchGlobalSolarEclipse(new Date(ora - 210 * 86400000));
    let prima = null;
    for (let passi = 0; evento && passi < 6 && evento.peak.date.getTime() < ora; passi++) {
      prima = evento; evento = Astronomy.NextGlobalSolarEclipse(evento.peak);
    }
    if (!prima) return evento;
    if (!evento) return prima;
    return ora - prima.peak.date.getTime() <= evento.peak.date.getTime() - ora ? prima : evento;
  }
  function eclisse(c) {
    if (c.eclisse) return;
    const evento = eclisseVicina(skyAdesso());
    richiedi(evento && evento.peak && Number.isFinite(evento.peak.date.getTime()), err('eclisseAssente'));
    c.eclisse = evento.peak.date.getTime(); istante(c.eclisse);
    solEntraVicino(); c.azIniziale = sol.az;
  }

  function centraSistema(c) {
    const g = solGeocentriche(skyAdesso());
    if (!g) return;
    if (c.centroOmbra) {
      const ombra = solOmbraLunareSuTerra(skyAdesso());
      if (ombra) {
        sol.panX = 0; sol.panY = 0; solMisura();
        const punto = solVicPunto(ombra.centro);
        sol.panX = -(punto.px - sol.cx); sol.panY = -(punto.py - sol.cy);
        return;
      }
    }
    solPanFraTerraELuna(sol.zoom, g);
  }

  function tempiCivili(p, quando = skyAdesso(), luogo = skyLuogoDelCielo()) {
    richiedi(luogo && Number.isFinite(+quando), err('luogoData'));
    const parti = partiDataDelLuogo(quando, luogo);
    const a = minuti(p.start), b = minuti(p.end);
    const giorno = new Date(Date.UTC(parti.year, parti.month - 1, parti.day + (b < a ? 1 : 0)));
    const inizio = dataDalTempoDelLuogo({ ...parti, hour: Math.floor(a / 60), minute: a % 60, second: 0 }, luogo);
    const fine = dataDalTempoDelLuogo({ year: giorno.getUTCFullYear(), month: giorno.getUTCMonth() + 1,
      day: giorno.getUTCDate(), hour: Math.floor(b / 60), minute: b % 60, second: 0 }, luogo);
    richiedi(inizio && fine, err('oraInesistente'));
    return { inizio, fine };
  }

  registro.timelapse = {
    verifica(p) { campi(p, ['start', 'end']); minuti(p.start); minuti(p.end); },
    crea(p) {
      const { inizio, fine } = tempiCivili(p);
      return { aggiorna: u => istante(+inizio + (+fine - +inizio) * u) };
    }
  };
  function dataISO(p) {
    campi(p, ['iso']);
    richiedi(typeof p.iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p.iso) &&
      Number.isFinite(Date.parse(p.iso)) && new Date(p.iso).toISOString() === p.iso.replace('Z', '.000Z'),
    err('dataUtc'));
    return new Date(p.iso);
  }
  function luogoDemo(p) {
    campi(p, ['lat', 'lon', 'name', 'timezone']);
    richiedi(numero(p.lat, -90, 90) && numero(p.lon, -180, 180), err('coordinate'));
    richiedi(typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 80, err('nomeLuogo'));
    richiedi(typeof p.timezone === 'string' && p.timezone.length <= 80, err('fuso'));
    try { new Intl.DateTimeFormat('en', { timeZone: p.timezone }); }
    catch (_) { throw new Error(err('fusoIana')); }
    return { lat: p.lat, lon: p.lon, nome: p.name, fuso: p.timezone, abbreviazioneFuso: '' };
  }
  registro.set_date = {
    verifica: dataISO,
    crea(p) { istante(+dataISO(p)); }
  };
  registro.set_location = {
    verifica: luogoDemo,
    crea(p) { sky.luogoVista = luogoDemo(p); skyAggiornaOsservatore(); }
  };
  registro.simulate_aurora = {
    verifica(p) { campi(p, ['kp']); richiedi(numero(p.kp, 0, 9), err('kp')); },
    crea(p) {
      richiedi(typeof aurImpostaKpSimulato === 'function', err('auroreAssenti'));
      aurImpostaKpSimulato(p.kp);
    }
  };
  registro.point_view = {
    verifica(p) {
      campi(p, ['az', 'alt']);
      richiedi(numero(p.az, 0, 360) && numero(p.alt, -90, 90), err('direzione'));
    },
    crea(p) {
      sky.inseguimento = false; sky.target = null; sky.seguiTelefono = false;
      sky.manuale.az = p.az; sky.manuale.alt = p.alt;
    }
  };
  registro.set_fov = {
    verifica(p) {
      campi(p, ['degrees']);
      richiedi(numero(p.degrees, 0.5, 160), err('fov'));
    },
    crea(p, c) {
      // Fullscreen e resize possono ricalcolare il campo subito dopo l'avvio.
      // Finché la demo possiede la camera, ribadiamo il FOV ad ogni fotogramma;
      // appena la persona interviene, cediCamera() lascia invece libero lo zoom.
      const applica = () => {
        if (typeof skyImpostaFov === 'function') skyImpostaFov(p.degrees, { morbido: false });
        else { sky.fov = p.degrees; sky.fovVoluto = p.degrees; }
        if ('animazioneVista' in sky) sky.animazioneVista = null;
      };
      applica();
      return { aggiorna() { if (!c || !c.cameraManuale) applica(); } };
    }
  };
  registro.frame_objects = {
    verifica(p) {
      campi(p, ['names']);
      richiedi(typeof p.names === 'string' && p.names.length > 0 && p.names.length <= 120,
        err('elenco'));
      const nomi = p.names.split(',').map(x => x.trim()).filter(Boolean);
      richiedi(nomi.length >= 2 && nomi.length <= 8 && nomi.every(n => corpi.includes(n)),
        err('corpiFrame'));
    },
    crea(p, c) {
      const nomi = p.names.split(',').map(x => x.trim()).filter(Boolean);
      // Un corpo spento dai filtri non è in `sky.oggetti`, e l'inquadratura
      // non partirebbe mai. I filtri tornano come erano a fine demo.
      sky.mostraPianeti = true; sky.mostraSoleLuna = true; sky.mostraSottoOrizzonte = true;
      // Il conto forzato si fa una volta sola: durante il timelapse il ciclo
      // del planetario rifà già le posizioni (`istante` azzera
      // `prossimoCalcolo`), e forzarlo di nuovo a ogni fotogramma voleva dire
      // pagare il giro degli astri due volte, tutto in un fotogramma solo.
      skyAggiornaOggetti(true);
      const applica = () => {
        const oggetti = nomi.map(nome => sky.oggetti.find(o => o.id === nome)).filter(Boolean);
        if (oggetti.length !== nomi.length) return;
        const az = oggetti.map(o => ((o.az % 360) + 360) % 360).sort((a, b) => a - b);
        let gapMax = -1, dopoGap = 0;
        for (let i = 0; i < az.length; i++) {
          const prossimo = i === az.length - 1 ? az[0] + 360 : az[i + 1];
          const gap = prossimo - az[i];
          if (gap > gapMax) { gapMax = gap; dopoGap = (i + 1) % az.length; }
        }
        const inizio = az[dopoGap], arco = 360 - gapMax;
        const centroAz = (inizio + arco / 2) % 360;
        const minAlt = Math.min(...oggetti.map(o => o.alt));
        const maxAlt = Math.max(...oggetti.map(o => o.alt));
        const centroAlt = Math.max(-65, Math.min(65, (minAlt + maxAlt) / 2));
        const campo = Math.max(70, Math.min(160, Math.max(arco * 1.25, (maxAlt - minAlt) * 1.5 + 18)));
        sky.inseguimento = false; sky.target = null; sky.seguiTelefono = false;
        sky.manuale.az = centroAz; sky.manuale.alt = centroAlt;
        if (typeof skyImpostaFov === 'function') skyImpostaFov(campo, { morbido: false });
        else { sky.fov = campo; sky.fovVoluto = campo; }
        if ('animazioneVista' in sky) sky.animazioneVista = null;
      };
      applica();
      return { aggiorna() { if (!c || !c.cameraManuale) applica(); } };
    }
  };
  registro.highlight_object = {
    verifica(p) {
      campi(p, ['name', 'scale']);
      richiedi(corpi.includes(p.name) && !['Sun', 'Moon'].includes(p.name), err('pianeta', { nome: p.name }));
      richiedi(numero(p.scale, 1, 10), err('scala'));
    },
    crea(p) {
      evidenze.set(p.name, p.scale);
      return { chiudi: () => evidenze.delete(p.name) };
    }
  };
  registro.zoom_view = {
    verifica(p) {
      campi(p, ['type', 'final_target']);
      richiedi(p.type === 'geometric' && p.final_target === 'solar_system_3d', err('transizione'));
    },
    crea(p, c) {
      window.apriSistemaSolare({
        voloManuale: true, annullato: () => c.chiuso,
        inquadra: () => {} // Il quadro successivo viene deciso dalla scena.
      });
      return {
        aggiorna(u) {
          if (!solVolo.attivo) return;
          solVoloDisegna(u);
          const ponte = document.getElementById('sol-transizione');
          if (ponte) ponte.style.opacity = String(1 - solVoloRampa((u - SOL_VOLO_APRI) / (1 - SOL_VOLO_APRI)));
        },
        chiudi() { solVolo.dopo = null; solVoloChiudi(); }
      };
    }
  };
  registro.orbit_object = {
    verifica(p) {
      campi(p, ['object', 'angle', 'speed']);
      richiedi(p.object === 'Earth-Moon', err('orbita'));
      richiedi(numero(p.angle, -3600, 3600), err('angolo'));
      richiedi(p.speed === undefined || p.speed === 'slow', err('velocita'));
    },
    crea(p, c) {
      eclisse(c); const inizio = sol.az;
      return { aggiorna(u) {
        if (c.cameraManuale) return;
        if (!c.ridotto) sol.az = inizio + p.angle * Math.PI / 180 * solVoloRampa(u);
        // Il punto medio segue la rotazione: il sistema non scappa dal quadro.
        centraSistema(c);
      } };
    }
  };
  registro.center_target = {
    verifica(p) {
      campi(p, ['target']);
      richiedi(corpi.includes(p.target) || p.target === 'Eclipse Shadow', err('bersaglio', { nome: p.target }));
    },
    crea(p, c) {
      if (p.target === 'Eclipse Shadow') {
        eclisse(c);
        c.centroOmbra = true;
        // Nel Sistema Solare 3D il "FOV" percepito e' governato da sol.zoom:
        // stringiamo l'inquadratura sulla Terra invece di allargarla fino alla
        // Luna, cosi' il disco terrestre e l'ombra restano leggibili mentre la
        // camera compie l'arco orbitale della scena.
        solImpostaZoom(sol.zoom * 2.4);
        return { aggiorna() {
          if (!c.cameraManuale) centraSistema(c);
        } };
      }
      sky.target = p.target; sky.inseguimento = true;
      sky.mostraPianeti = true; sky.mostraSoleLuna = true; sky.mostraSottoOrizzonte = true;
      skyAggiornaOggetti(true); skyInsegui();
      return { aggiorna: () => { if (!c.cameraManuale) skyInsegui(); }, chiudi: () => { sky.inseguimento = false; } };
    }
  };
  registro.transition_to = {
    verifica(p) { campi(p, ['target']); richiedi(['planetarium_view', 'solar_system_3d'].includes(p.target), err('vistaSconosciuta', { nome: p.target })); },
    crea(p, c) { vista(p.target, c); }
  };

  const motore = new AstroDemoMotore.Motore(registro, { avvisa: aggiornaPannello });
  let contesto = null, ultimoScript = script;
  const chiavi = ['modalitaTempo', 'istanteSimulatoMs', 'offsetTempoSec', 'luogoVista', 'target',
    'inseguimento', 'eventoInseguito', 'seguiTelefono', 'fov', 'fovVoluto', 'modalitaHover',
    'mostraPianeti', 'mostraSoleLuna', 'mostraSottoOrizzonte', 'passoTempoSec',
    'playbackVerso', 'ancoraTempoSec', 'finestraTempoSec',
    // Il campo è definito sull'altezza del riquadro (`skyRidimensiona`):
    // conserviamo anche l'altezza a cui valeva, così eventuali resize durante
    // la demo non riscalano di nuovo il FOV quando si ripristina lo stato.
    'altezzaMisurata'];
  function valida(testo) {
    const demo = motore.prepara(testo);
    let quando = skyAdesso(), luogo = skyLuogoDelCielo();
    for (const scena of demo.scene) {
      richiedi(['planetarium_view', 'transition', 'solar_system_3d'].includes(scena.vista), err('scena', { nome: scena.vista }));
      for (const azione of scena.azioni) {
        if (azione.comando === 'set_location') luogo = luogoDemo(azione.parametri);
        if (azione.comando === 'set_date') quando = dataISO(azione.parametri);
        if (azione.comando === 'timelapse') quando = tempiCivili(azione.parametri, quando, luogo).fine;
      }
    }
    return demo;
  }
  function avvia(testo = script) {
    valida(testo);
    motore.ferma();
    richiedi(!sol.aperto && !sky.reg.attiva &&
      !(typeof missRicercaAttiva === 'function' && missRicercaAttiva()), t('occupato'));
    richiedi(typeof Astronomy !== 'undefined' && sky.observer, t('attendi'));
    ultimoScript = testo;
    const precedente = Object.fromEntries(chiavi.map(k => [k, sky[k]]));
    const manuale = { ...sky.manuale }, vistaPrima = vistaAttuale;
    const cameraSistema = Object.fromEntries(['az', 'elev', 'elevVoluta', 'zoom', 'zoomVoluto',
      'panX', 'panY', 'perno', 'vicino', 'quadro', 'scelto'].map(k => [k, sol[k]]));
    const auroraPrima = { acceso: aur.acceso, kpSimulato: aur.kpSimulato };
    const schermoInteroPrima = sky.schermoIntero;
    const c = { chiuso: false, eclisse: null, cameraManuale: false,
      ridotto: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      scena(scena) {
        // Ogni scena puo impostare la propria inquadratura iniziale. Dopo un
        // intervento della persona, pero, le animazioni della scena corrente
        // le cedono la camera mentre il racconto e il suo orologio proseguono.
        c.cameraManuale = false;
        if (scena.vista === 'planetarium_view') vista('planetarium_view', c);
        if (scena.vista === 'solar_system_3d') {
          vista('solar_system_3d', c);

        }
      },
      cediCamera() {
        c.cameraManuale = true;
        sky.inseguimento = false;
      },
      ripristina() {
        c.chiuso = true; contesto = null; evidenze.clear();
        solVolo.dopo = null; solVoloChiudi();
        if (sol.aperto) chiudiSistemaSolare();
        Object.assign(sol, cameraSistema);
        if (vistaAttuale !== vistaPrima) mostraVista(vistaPrima);
        const luogoCambiato = sky.luogoVista !== precedente.luogoVista;
        skyImpostaPassoTempo(precedente.passoTempoSec);
        Object.assign(sky, precedente); Object.assign(sky.manuale, manuale);
        if (luogoCambiato) skyAggiornaOsservatore();
        aur.acceso = auroraPrima.acceso;
        aurImpostaKpSimulato(auroraPrima.kpSimulato);
        aur.acceso = auroraPrima.acceso;
        aurAggiornaPannello();
        skyFermaMovimenti(); sky.prossimoCalcolo = 0;
        skyAggiornaOggetti(true); skyAggiornaTestoTempo(); skyAggiornaSlittaTempo();
        sky.playbackUltimo = 0; skyAggiornaComandiPlayback();
        skyAggiornaTastoInsegui(); skyAggiornaTastiFiltri();
        // Ripristina lo stato iniziale se durante la demo si e' entrati
        // manualmente a schermo intero partendo dalla vista normale.
        if (!schermoInteroPrima && sky.schermoIntero) skyEsciSchermoIntero();
        pannello.hidden = true;
      }
    };
    contesto = c;
    // Il racconto lascia libero il cielo e chiude i pannelli aperti.
    document.getElementById('modale-impostazioni').classList.add('hidden');
    skyMostraGruppo('');
    skyFermaPlayback(); skyFermaMovimenti(); sky.seguiTelefono = false; sky.modalitaHover = false;
    sky.eventoInseguito = null;
    motore.avvia(testo, c);
    aggiornaPannello();
  }

  const pannello = document.createElement('div');
  pannello.id = 'demo-controlli'; pannello.hidden = true;
  pannello.style.cssText = 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:10000;background:#101b30;color:#f1f5f9;padding:12px;border:1px solid #64748b;border-radius:14px;width:min(92vw,560px);box-sizing:border-box;box-shadow:0 8px 30px #0008';
  const messaggio = document.createElement('p'); messaggio.setAttribute('role', 'status');
  messaggio.style.cssText = 'margin:0 0 8px;font-size:14px';
  pannello.append(messaggio);
  function bottone(chiave, azione) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tasto-cielo';
    b.textContent = t(chiave); b.addEventListener('click', azione); pannello.append(b); return b;
  }
  const pausa = bottone('pausa', () => motore.stato === 'pausa' ? motore.riprendi() : motore.pausa());
  const riavvia = bottone('riavvia', () => avviaSicuro(ultimoScript));
  const arresta = bottone('stop', () => motore.ferma());
  document.body.append(pannello);
  function titoloDemo(id) {
    return predefiniti.some(d => d.chiave === id) ? t('builtin.' + id + '.title') : id;
  }
  function aggiornaPannello() {
    const attivo = motore.stato === 'attivo' || motore.stato === 'pausa';
    if (attivo) {
      const genitore = sol.aperto ? solGuscio() : (document.fullscreenElement || document.body);
      if (genitore && pannello.parentElement !== genitore) genitore.append(pannello);
      pannello.hidden = false;
      // Una riga sola, uguale per tutte le demo: prima la frase descrittiva
      // valeva solo per la prima predefinita (e parlava di Reykjavík), le
      // altre tre mostravano i nomi tecnici delle scene.
      const scena = motore.demo.scene[motore.indice];
      messaggio.textContent = titoloDemo(motore.demo.id) + ' — ' + t('scenaDi', {
        n: motore.indice + 1, tot: motore.demo.scene.length,
        vista: t('vista.' + scena.vista), secondi: scena.durata / 1000
      }) + (motore.stato === 'pausa' ? ' — ' + t('inPausa') : '');
      pausa.textContent = t(motore.stato === 'pausa' ? 'riprendi' : 'pausa');
      riavvia.textContent = t('riavvia'); arresta.textContent = t('stop');
    } else {
      pannello.hidden = true;
      if (motore.stato === 'errore') skyAvviso('demo', t('errore') + ': ' + motore.errore.message, 10000);
      if (motore.stato === 'completato') skyAvviso('demo', t('completato'), 7000);
    }
  }
  function avviaSicuro(testo) {
    try { avvia(testo); } catch (e) { skyAvviso('demo', t('errore') + ': ' + e.message, 10000); }
  }
  // I comandi restano utilizzabili durante il racconto. Un intervento cede
  // la camera alla persona per la scena corrente, senza fermarne il tempo;
  // filtri, menu e altri controlli continuano quindi a funzionare normalmente.
  document.addEventListener('pointerdown', e => {
    if (contesto && !pannello.contains(e.target)) contesto.cediCamera();
  }, true);
  // La rotellina e i tasti non passano da `pointerdown`: senza questi due
  // ascoltatori `set_fov` e `frame_objects` rimettevano il loro campo a ogni
  // fotogramma e lo zoom della persona veniva annullato subito.
  document.addEventListener('wheel', () => { if (contesto) contesto.cediCamera(); },
    { capture: true, passive: true });
  document.addEventListener('keydown', e => {
    if (!contesto || e.key === 'Escape' || pannello.contains(e.target)) return;
    const campo = e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (!campo && /^(Arrow|Page|Home$|End$|[+\-=]$)/.test(e.key)) contesto.cediCamera();
  }, true);
  document.addEventListener('keydown', e => {
    if (contesto && e.key === 'Escape') { motore.ferma(); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  // Il tempo non salta scene quando la scheda rimane nascosta.
  document.addEventListener('visibilitychange', () => { if (document.hidden) motore.pausa(); });
  document.addEventListener('fullscreenchange', aggiornaPannello);
  // Se la preferenza cambia durante il tour, interrompi e ripristina subito.
  const movimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (movimento && movimento.addEventListener) movimento.addEventListener('change', () => {
    if (contesto) motore.ferma();
  });
  window.AstroDemo = {
    script, valida, libreria: AstroDemoLibreria.crea({
      getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v)
    }, predefiniti, valida), avvia, pausa: () => motore.pausa(), riprendi: () => motore.riprendi(),
    ferma: () => motore.ferma(), evidenza: id => evidenze.get(id) || 1,
    get stato() { return motore.stato; },
    registra(nome, comando) {
      richiedi(/^[a-z_]+$/.test(nome) && nome !== 'center' && !registro[nome], err('registraNome'));
      richiedi(comando && typeof comando.crea === 'function', err('registraCrea'));
      registro[nome] = comando;
    }
  };
})();
