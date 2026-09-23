/* Ponte fra gli script e le viste vere dell'app. I comandi si registrano
 * con verifica(parametri) e crea(parametri, contesto, scena): aggiorna/chiudi. */
(function () {
  'use strict';
  const predefiniti = AstroDemoPredefiniti;
  const script = predefiniti[0].testo;
  const registro = Object.create(null), evidenze = new Map();
  const t = chiave => astroI18n.t('demo.' + chiave);
  const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  function richiedi(ok, messaggio) { if (!ok) throw new Error(messaggio); }
  function campi(p, ammessi) {
    for (const k of Object.keys(p)) richiedi(ammessi.includes(k), 'Parametro sconosciuto: ' + k);
  }
  function minuti(v) {
    richiedi(typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v), 'Orario atteso HH:MM');
    const [h, m] = v.split(':').map(Number);
    richiedi(h < 24 && m < 60, 'Orario fuori intervallo'); return h * 60 + m;
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
    } else throw new Error('Vista sconosciuta: ' + v);
  }
  function eclisse(c) {
    if (c.eclisse) return;
    // Si trova un evento reale: la demo non allinea artificialmente i corpi.
    const evento = Astronomy.SearchGlobalSolarEclipse(new Date('2026-08-01T00:00:00Z'));
    richiedi(evento && evento.peak && Number.isFinite(evento.peak.date.getTime()), 'Eclisse non disponibile');
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
    richiedi(luogo && Number.isFinite(+quando), 'Luogo e data necessari per il timelapse');
    const parti = partiDataDelLuogo(quando, luogo);
    const a = minuti(p.start), b = minuti(p.end);
    const giorno = new Date(Date.UTC(parti.year, parti.month - 1, parti.day + (b < a ? 1 : 0)));
    const inizio = dataDalTempoDelLuogo({ ...parti, hour: Math.floor(a / 60), minute: a % 60, second: 0 }, luogo);
    const fine = dataDalTempoDelLuogo({ year: giorno.getUTCFullYear(), month: giorno.getUTCMonth() + 1,
      day: giorno.getUTCDate(), hour: Math.floor(b / 60), minute: b % 60, second: 0 }, luogo);
    richiedi(inizio && fine, 'Ora civile inesistente nel fuso del luogo');
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
    'Data UTC attesa YYYY-MM-DDTHH:MM:SSZ');
    return new Date(p.iso);
  }
  function luogoDemo(p) {
    campi(p, ['lat', 'lon', 'name', 'timezone']);
    richiedi(numero(p.lat, -90, 90) && numero(p.lon, -180, 180), 'Coordinate non valide');
    richiedi(typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 80, 'Nome del luogo non valido');
    richiedi(typeof p.timezone === 'string' && p.timezone.length <= 80, 'Fuso orario non valido');
    try { new Intl.DateTimeFormat('en', { timeZone: p.timezone }); }
    catch (_) { throw new Error('Fuso orario IANA non valido'); }
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
    verifica(p) { campi(p, ['kp']); richiedi(numero(p.kp, 0, 9), 'Kp deve essere fra 0 e 9'); },
    crea(p) {
      richiedi(typeof aurImpostaKpSimulato === 'function', 'Modulo aurore non disponibile');
      aurImpostaKpSimulato(p.kp);
    }
  };
  registro.point_view = {
    verifica(p) {
      campi(p, ['az', 'alt']);
      richiedi(numero(p.az, 0, 360) && numero(p.alt, -90, 90), 'Direzione non valida');
    },
    crea(p) {
      sky.inseguimento = false; sky.target = null; sky.seguiTelefono = false;
      sky.manuale.az = p.az; sky.manuale.alt = p.alt;
    }
  };
  registro.highlight_object = {
    verifica(p) {
      campi(p, ['name', 'scale']);
      richiedi(corpi.includes(p.name) && !['Sun', 'Moon'].includes(p.name), 'Pianeta non supportato: ' + p.name);
      richiedi(numero(p.scale, 1, 10), 'La scala deve essere fra 1 e 10');
    },
    crea(p) {
      evidenze.set(p.name, p.scale);
      return { chiudi: () => evidenze.delete(p.name) };
    }
  };
  registro.zoom_view = {
    verifica(p) {
      campi(p, ['type', 'final_target']);
      richiedi(p.type === 'geometric' && p.final_target === 'solar_system_3d', 'Transizione non supportata');
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
      richiedi(p.object === 'Earth-Moon', 'Orbita supportata: Earth-Moon');
      richiedi(numero(p.angle, -3600, 3600), 'Angolo non valido');
      richiedi(p.speed === undefined || p.speed === 'slow', 'Velocita supportata: slow');
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
      richiedi(corpi.includes(p.target) || p.target === 'Eclipse Shadow', 'Bersaglio non supportato: ' + p.target);
    },
    crea(p, c) {
      if (p.target === 'Eclipse Shadow') {
        eclisse(c);
        c.centroOmbra = true;
        // Con l'ombra al centro si allarga il campo per contenere anche la Luna.
        solImpostaZoom(sol.zoom * 0.5);
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
    verifica(p) { campi(p, ['target']); richiedi(['planetarium_view', 'solar_system_3d'].includes(p.target), 'Vista non supportata'); },
    crea(p, c) { vista(p.target, c); }
  };

  const motore = new AstroDemoMotore.Motore(registro, { avvisa: aggiornaPannello });
  let contesto = null, ultimoScript = script;
  const chiavi = ['modalitaTempo', 'istanteSimulatoMs', 'offsetTempoSec', 'luogoVista', 'target',
    'inseguimento', 'eventoInseguito', 'seguiTelefono', 'fov', 'fovVoluto', 'modalitaHover',
    'mostraPianeti', 'mostraSoleLuna', 'mostraSottoOrizzonte', 'passoTempoSec',
    'playbackVerso', 'ancoraTempoSec', 'finestraTempoSec'];
  function valida(testo) {
    const demo = motore.prepara(testo);
    let quando = skyAdesso(), luogo = skyLuogoDelCielo();
    for (const scena of demo.scene) {
      richiedi(['planetarium_view', 'transition', 'solar_system_3d'].includes(scena.vista), 'Scena non supportata: ' + scena.vista);
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
        // La demo entra da sola nel cielo immersivo, ma non deve chiudere uno
        // schermo intero che la persona aveva gia aperto prima di avviarla.
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
    // La richiesta resta nello stesso gesto del tasto «Avvia»: e' essenziale
    // per i browser che autorizzano il vero schermo intero soltanto durante
    // un'interazione. Su iPhone skyEntraSchermoIntero usa il ripiego CSS.
    if (motore.stato === 'attivo' && !sky.schermoIntero) skyEntraSchermoIntero();
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
  function aggiornaPannello() {
    if (typeof pannello === 'undefined') return;
    const attivo = motore.stato === 'attivo' || motore.stato === 'pausa';
    if (attivo) {
      const genitore = sol.aperto ? solGuscio() : (document.fullscreenElement || document.body);
      if (genitore && pannello.parentElement !== genitore) genitore.append(pannello);
      pannello.hidden = false;
      const scena = motore.demo.scene[motore.indice];
      messaggio.textContent = (ultimoScript === script ? t(scena.vista) : motore.demo.id + ' · ' + (motore.indice + 1) + '/' + motore.demo.scene.length +
        ' · ' + scena.vista + ' · ' + (scena.durata / 1000) + ' s') +
        (motore.stato === 'pausa' ? ' — ' + t('inPausa') : '');
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
      richiedi(/^[a-z_]+$/.test(nome) && nome !== 'center' && !registro[nome], 'Nome comando gia presente o non valido');
      richiedi(comando && typeof comando.crea === 'function', 'Comando senza crea');
      registro[nome] = comando;
    }
  };
})();
