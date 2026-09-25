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
  const corpiSistema = [...corpi.filter(c => c !== 'Sun' && c !== 'Moon'), 'Earth'];
  const GRADI = Math.PI / 180;
  function istante(ms) {
    skyImpostaOffsetTempo((ms - Date.now()) / 1000, { fluido: true });
    sky.prossimoCalcolo = 0;
  }
  // La curva di tutte le camere della regia: parte e arriva ferma. Col
  // movimento ridotto la camera non viaggia affatto — sta già dove il
  // racconto la vuole — mentre il tempo astronomico continua a scorrere:
  // quello non è decorazione, è il fenomeno.
  const rampa = (c, u) => (c && c.ridotto) ? 1 : solVoloRampa(Math.max(0, Math.min(1, u)));
  const mescola = (a, b, k) => a + (b - a) * k;
  const mescolaZoom = (a, b, k) => a * Math.pow(b / a, k);

  // ------------------------------------------------------------------
  // Le viste. Ogni scena dichiara dove si svolge, e qui si apre quella
  // vista — con la sua presentazione a schermo intero quando la demo è
  // stata avviata così (`c.schermo`).
  // ------------------------------------------------------------------
  function presentaCielo(c) {
    if (c && c.schermo && !sky.schermoIntero) {
      skyEntraSchermoIntero({ soloRipiego: true });
      c.cieloImmersivo = true;
    }
  }
  function lasciaCielo(c) {
    if (c && c.cieloImmersivo && sky.schermoIntero) skyEsciSchermoIntero();
    if (c) c.cieloImmersivo = false;
  }
  function vista(v, c) {
    if (v === 'planetarium_view') {
      if (typeof didDemo !== 'undefined') didDemo.pieno(false);
      if (sol.aperto) chiudiSistemaSolare();
      if (vistaAttuale !== 'cielo') mostraVista('cielo', { conservaTempo: true });
      presentaCielo(c);
    } else if (v === 'solar_system_3d') {
      if (typeof didDemo !== 'undefined') didDemo.pieno(false);
      if (vistaAttuale !== 'cielo') mostraVista('cielo', { conservaTempo: true });
      presentaCielo(c);
      if (!sol.aperto) window.apriSistemaSolare({ senzaVolo: true, inquadra: () => {}, annullato: () => c.chiuso });
      if (c && c.schermo && typeof solEntraSchermoIntero === 'function' && !solSchermoIntero) solEntraSchermoIntero();
      solRidimensiona();
    } else if (v === 'didactic_view') {
      richiedi(typeof didDemo !== 'undefined', err('didatticaAssente'));
      if (sol.aperto) chiudiSistemaSolare();
      lasciaCielo(c);
      if (vistaAttuale !== 'didattica') mostraVista('didattica');
    } else throw new Error(err('vistaSconosciuta', { nome: v }));
    if (c && c.vistaPulita) applicaVistaPulita(c);
  }

  // ------------------------------------------------------------------
  // Gli eventi veri. Si cercano **a partire dall'orologio del racconto**,
  // prima o dopo: la demo non allinea artificialmente i corpi, trova il
  // momento in cui sono allineati davvero.
  // ------------------------------------------------------------------
  // L'eclisse di Sole più vicina. Con la data di partenza scritta nel
  // codice (1 agosto 2026) ogni demo personale che chiedeva l'ombra finiva
  // sull'eclisse del 2026, qualunque data avesse impostato prima. Le eclissi
  // di Sole capitano ogni sei mesi circa, quindi partendo da sette mesi
  // prima bastano due o tre passi per scavalcare.
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
  // La stessa domanda per la Luna, con la stessa regola.
  function lunareVicina(quando) {
    const ora = +quando;
    let evento = Astronomy.SearchLunarEclipse(new Date(ora - 210 * 86400000));
    let prima = null;
    for (let passi = 0; evento && passi < 8 && evento.peak.date.getTime() < ora; passi++) {
      prima = evento; evento = Astronomy.NextLunarEclipse(evento.peak);
    }
    if (!prima) return evento;
    if (!evento) return prima;
    return ora - prima.peak.date.getTime() <= evento.peak.date.getTime() - ora ? prima : evento;
  }
  // Il massimo di un evento, cercato una volta sola per racconto: le scene
  // successive (il planetario, poi la 3D, poi di nuovo il planetario)
  // parlano dello **stesso** evento, non ognuna del suo.
  function piccoEvento(c, tipo) {
    c.eventi = c.eventi || {};
    if (c.eventi[tipo]) return c.eventi[tipo];
    const evento = tipo === 'lunar_eclipse' ? lunareVicina(skyAdesso()) : eclisseVicina(skyAdesso());
    richiedi(evento && evento.peak && Number.isFinite(evento.peak.date.getTime()),
      err(tipo === 'lunar_eclipse' ? 'lunareAssente' : 'eclisseAssente'));
    c.eventi[tipo] = evento.peak.date.getTime();
    return c.eventi[tipo];
  }
  function eclisse(c) {
    if (c.eclisse) return;
    c.eclisse = piccoEvento(c, 'solar_eclipse'); istante(c.eclisse);
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

  // L'inquadratura più stretta che contiene un insieme di direzioni: il
  // minimo arco di azimut (il buco più largo fra due punti è quello che
  // resta fuori) e la fascia di altezze. Serve al corteo dei pianeti e
  // all'arco di un passaggio della ISS.
  function inquadraDirezioni(punti, minimo) {
    const az = punti.map(o => ((o.az % 360) + 360) % 360).sort((a, b) => a - b);
    let gapMax = -1, dopoGap = 0;
    for (let i = 0; i < az.length; i++) {
      const prossimo = i === az.length - 1 ? az[0] + 360 : az[i + 1];
      const gap = prossimo - az[i];
      if (gap > gapMax) { gapMax = gap; dopoGap = (i + 1) % az.length; }
    }
    const inizio = az[dopoGap], arco = 360 - gapMax;
    const centroAz = (inizio + arco / 2) % 360;
    const minAlt = Math.min(...punti.map(o => o.alt));
    const maxAlt = Math.max(...punti.map(o => o.alt));
    const centroAlt = Math.max(-65, Math.min(65, (minAlt + maxAlt) / 2));
    const campo = Math.max(minimo, Math.min(160, Math.max(arco * 1.25, (maxAlt - minAlt) * 1.5 + 18)));
    return { az: centroAz, alt: centroAlt, campo };
  }
  function puntaCamera(az, alt, campo, tieniBersaglio) {
    sky.inseguimento = false; sky.seguiTelefono = false;
    if (!tieniBersaglio) sky.target = null;
    sky.manuale.az = az; sky.manuale.alt = alt;
    if (typeof skyImpostaFov === 'function') skyImpostaFov(campo, { morbido: false });
    else { sky.fov = campo; sky.fovVoluto = campo; }
    if ('animazioneVista' in sky) sky.animazioneVista = null;
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
    crea(p, c) {
      sky.inseguimento = false; sky.target = null; sky.seguiTelefono = false;
      sky.manuale.az = p.az; sky.manuale.alt = p.alt;
      // Come il campo: finché la demo tiene la camera, la direzione resta
      // quella del racconto anche se un ridimensionamento la sposta.
      return { aggiorna() {
        if (c && c.cameraManuale) return;
        sky.manuale.az = p.az; sky.manuale.alt = p.alt;
      } };
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
  // Uno zoom che si stringe durante la scena: è il modo in cui il planetario
  // fa vedere «adesso guardiamo da vicino» senza dirlo.
  registro.zoom_fov = {
    verifica(p) {
      campi(p, ['from', 'to']);
      richiedi(numero(p.from, 0.5, 160) && numero(p.to, 0.5, 160), err('fov'));
    },
    crea(p, c) {
      const applica = u => {
        const campo = mescolaZoom(p.from, p.to, rampa(c, u));
        if (typeof skyImpostaFov === 'function') skyImpostaFov(campo, { morbido: false });
        else { sky.fov = campo; sky.fovVoluto = campo; }
        if ('animazioneVista' in sky) sky.animazioneVista = null;
      };
      applica(0);
      return { aggiorna(u) { if (!c || !c.cameraManuale) applica(u); } };
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
        const q = inquadraDirezioni(oggetti, 70);
        puntaCamera(q.az, q.alt, q.campo);
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
      if (vistaAttuale !== 'cielo') mostraVista('cielo', { conservaTempo: true });
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
        if (!c.ridotto) sol.az = inizio + p.angle * GRADI * solVoloRampa(u);
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

  // ------------------------------------------------------------------
  // La finestra di tempo attorno a un evento vero: da `from` a `to` minuti
  // dal suo massimo, per tutta la durata della scena. È quello che fa
  // muovere l'ombra della Luna sulla Terra nella vista 3D e la Luna dentro
  // al cono della Terra: il movimento che si vede è il cielo che cammina,
  // non una animazione disegnata sopra.
  // ------------------------------------------------------------------
  const EVENTI = ['solar_eclipse', 'lunar_eclipse'];
  registro.event_window = {
    verifica(p) {
      campi(p, ['event', 'from', 'to']);
      richiedi(EVENTI.includes(p.event), err('evento', { nome: p.event }));
      richiedi(numero(p.from, -720, 720) && numero(p.to, -720, 720) && p.to > p.from, err('finestra'));
    },
    crea(p, c) {
      const picco = piccoEvento(c, p.event);
      const aggiorna = u => istante(picco + (p.from + (p.to - p.from) * u) * 60000);
      aggiorna(0);
      return { aggiorna };
    }
  };

  // ------------------------------------------------------------------
  // La camera della vista 3D. Due scene, e sono quelle che l'app ha già:
  // `earth_moon` è il banco Terra e Luna (chilometri, coni d'ombra), e
  // `system` è il Sistema Solare d'insieme. Si dice su chi tenere il
  // centro, di quanto girarci attorno, da che altezza a che altezza e di
  // quanto avvicinarsi: le posizioni restano quelle calcolate, la regia
  // muove soltanto l'occhio.
  // ------------------------------------------------------------------
  const FUOCHI_VICINO = ['Earth', 'Moon', 'Earth-Moon', 'Eclipse Shadow'];
  const FUOCHI_SISTEMA = ['Sun', 'Earth', 'ISS'];
  function elencoCorpiSistema(v) {
    if (v === undefined) return [];
    richiedi(typeof v === 'string' && v.length <= 120, err('elenco'));
    const nomi = v.split(',').map(x => x.trim()).filter(Boolean);
    richiedi(nomi.length >= 1 && nomi.length <= 9 && nomi.every(n => corpiSistema.includes(n)), err('corpiSistema'));
    return nomi;
  }
  registro.camera_3d = {
    verifica(p) {
      campi(p, ['scene', 'focus', 'frame', 'orbit', 'elev_from', 'elev_to', 'zoom_from', 'zoom_to']);
      richiedi(p.scene === 'earth_moon' || p.scene === 'system', err('scena3d'));
      richiedi((p.scene === 'earth_moon' ? FUOCHI_VICINO : FUOCHI_SISTEMA).includes(p.focus),
        err('fuoco', { nome: p.focus }));
      richiedi(p.orbit === undefined || numero(p.orbit, -720, 720), err('angolo'));
      for (const k of ['elev_from', 'elev_to'])
        richiedi(p[k] === undefined || numero(p[k], -85, 85), err('elevazione'));
      for (const k of ['zoom_from', 'zoom_to'])
        richiedi(p[k] === undefined || numero(p[k], 0.1, 60), err('zoom3d'));
      elencoCorpiSistema(p.frame);
    },
    crea(p, c) {
      richiedi(sol.aperto, err('serve3d'));
      const vicino = p.scene === 'earth_moon';
      let base;
      if (vicino) {
        if (!sol.vicino) solEntraVicino(); else solInquadraVicino();
        base = sol.zoomVoluto;
      } else {
        if (sol.vicino) { sol.vicino = false; sol.quadro = 'terra'; }
        solLeggiPosizioni(skyAdesso());
        if (p.focus === 'Sun') {
          const nomi = elencoCorpiSistema(p.frame);
          const ua = Math.max(1.05, ...nomi.map(n => {
            const q = sol.pianeti.find(x => x.id === n);
            return q ? q.r : 1;
          }));
          solInquadraDaTerra({ ua: ua * 1.08 });
          sol.perno = null;
          // Il racconto è la disposizione dei pianeti: pianeti nani, comete
          // e sonde, coi loro nomi, qui sarebbero rumore. Tornano a fine demo.
          sol.mondiAccesi = false; sol.sondeAccese = false;
          base = sol.zoomVoluto;
        } else {
          sol.perno = 'Earth'; sol.quadro = 'terra';
          const iss = (sol.satelliti || []).find(s => s.id === 'iss');
          if (p.focus === 'ISS') richiedi(iss, err('tle'));
          const z = p.focus === 'ISS' ? solZoomOrbitaSatellite(iss) : solZoomSullaTerra();
          base = z || sol.zoomVoluto;
        }
      }
      const az0 = sol.az;
      const elev0 = sol.elevVoluta; // la vista 3D tiene l'elevazione in gradi
      const ea = p.elev_from !== undefined ? p.elev_from : elev0;
      const eb = p.elev_to !== undefined ? p.elev_to : ea;
      const za = p.zoom_from !== undefined ? p.zoom_from : 1;
      const zb = p.zoom_to !== undefined ? p.zoom_to : za;
      const giro = (p.orbit || 0) * GRADI;
      function centra() {
        if (!vicino) {
          if (p.focus === 'Sun') { sol.panX = 0; sol.panY = 0; }
          return; // Terra e ISS: il perno ricentra da sé a ogni fotogramma
        }
        const quando = skyAdesso();
        const g = solGeocentriche(quando);
        if (!g) return;
        if (p.focus === 'Earth-Moon') { solPanFraTerraELuna(sol.zoom, g); return; }
        let punto = [0, 0, 0];
        if (p.focus === 'Moon') punto = g.luna;
        if (p.focus === 'Eclipse Shadow') {
          const ombra = solOmbraLunareSuTerra(quando);
          if (ombra) punto = ombra.centro;
        }
        sol.panX = 0; sol.panY = 0; solMisura();
        const q = solVicPunto(punto);
        sol.panX = -(q.px - sol.cx); sol.panY = -(q.py - sol.cy);
      }
      function applica(u) {
        const k = rampa(c, u);
        sol.az = az0 + (c.ridotto ? 0 : giro * k);
        sol.elev = sol.elevVoluta = mescola(ea, eb, k);
        solImpostaZoom(base * mescolaZoom(za, zb, k));
        centra();
      }
      applica(0);
      return { aggiorna(u) { if (!c.cameraManuale) applica(u); } };
    }
  };

  // ------------------------------------------------------------------
  // Il banco delle aurore della Didattica, guidato dalla demo: il quadro
  // (vento, scudo, scarica, anello), il pezzo di storia da far scorrere
  // (in ore dall'eruzione) e la camera che gira attorno alla Terra. Sono
  // gli stessi disegni del banco: la regia sceglie solo cosa guardare, da
  // dove e quando.
  // ------------------------------------------------------------------
  const CAPITOLI = ['vento', 'scudo', 'scarica', 'anello'];
  registro.aurora_lesson = {
    verifica(p) {
      campi(p, ['chapter', 'from', 'to', 'orbit', 'elev_from', 'elev_to', 'zoom_from', 'zoom_to']);
      richiedi(CAPITOLI.includes(p.chapter), err('capitolo', { nome: p.chapter }));
      for (const k of ['from', 'to']) richiedi(p[k] === undefined || numero(p[k], 0, 60), err('oreStoria'));
      richiedi(p.orbit === undefined || numero(p.orbit, -720, 720), err('angolo'));
      for (const k of ['elev_from', 'elev_to'])
        richiedi(p[k] === undefined || numero(p[k], -84, 84), err('elevazione'));
      for (const k of ['zoom_from', 'zoom_to'])
        richiedi(p[k] === undefined || numero(p[k], 0.3, 6), err('zoom3d'));
    },
    crea(p, c) {
      richiedi(typeof didDemo !== 'undefined' && vistaAttuale === 'didattica', err('didatticaAssente'));
      richiedi(didDemo.apri('aurora'), err('didatticaAssente'));
      didDemo.quadro(p.chapter);
      didDemo.pieno(true);
      const posa = didDemo.posa(p.chapter);
      const da = p.from !== undefined ? p.from : posa.finestra[0];
      const a = p.to !== undefined ? p.to : posa.finestra[1];
      const ea = p.elev_from !== undefined ? p.elev_from : posa.elev;
      const eb = p.elev_to !== undefined ? p.elev_to : ea;
      const za = p.zoom_from !== undefined ? p.zoom_from : 1;
      const zb = p.zoom_to !== undefined ? p.zoom_to : za;
      const aggiorna = u => {
        const k = rampa(c, u);
        const passo = { quadro: p.chapter, t: mescola(da, a, u) };
        if (!c.cameraManuale) Object.assign(passo, {
          az: posa.az + (c.ridotto ? 0 : (p.orbit || 0) * k),
          elev: mescola(ea, eb, k), zoom: mescolaZoom(za, zb, k)
        });
        didDemo.aurora(passo);
      };
      aggiorna(0);
      return { aggiorna };
    }
  };

  // ------------------------------------------------------------------
  // Un passaggio vero di una stazione spaziale, calcolato dall'app coi
  // suoi dati orbitali e dal luogo che il planetario sta guardando. Il
  // passaggio si cerca una volta sola: il planetario e la vista 3D
  // raccontano lo **stesso** passaggio nello stesso intervallo di tempo.
  // ------------------------------------------------------------------
  function passaggio(c, id) {
    c.passaggi = c.passaggi || {};
    if (c.passaggi[id]) return c.passaggi[id];
    const sat = typeof satelliteDaId === 'function' && satelliteDaId(id);
    richiedi(sat && typeof satellite !== 'undefined' && satRecDi(sat), err('tle'));
    const luogo = skyLuogoDelCielo();
    const elenco = calcolaPassaggiSatellite(sat, luogo).filter(x => x.fine > new Date(+skyAdesso()));
    richiedi(elenco.length, err('passaggioAssente'));
    // Il primo passaggio visibile a occhio nudo; se nei prossimi giorni non
    // ce n'è, il più alto — che si vede comunque meglio nel disegno.
    const scelto = elenco.find(x => x.visibile) ||
      elenco.slice().sort((a, b) => b.elevazioneMax - a.elevazioneMax)[0];
    c.passaggi[id] = { sat, luogo, inizio: +scelto.inizio, fine: +scelto.fine, dati: scelto };
    return c.passaggi[id];
  }
  registro.satellite_pass = {
    verifica(p) {
      campi(p, ['satellite', 'before', 'after']);
      richiedi(p.satellite === 'iss' || p.satellite === 'tiangong', err('satellite', { nome: p.satellite }));
      for (const k of ['before', 'after']) richiedi(p[k] === undefined || numero(p[k], 0, 15), err('margine'));
    },
    crea(p, c, scena) {
      const pas = passaggio(c, p.satellite);
      const inizio = pas.inizio - (p.before || 0) * 60000;
      const fine = pas.fine + (p.after || 0) * 60000;
      const aggiorna = u => istante(inizio + (fine - inizio) * u);
      aggiorna(0);
      if (scena.vista === 'planetarium_view') {
        // Il cielo resta fermo e la stazione ci passa attraverso: una camera
        // che la insegue la farebbe sembrare immobile, con le stelle che
        // scorrono. L'arco si inquadra tutto, e la traccia dice da dove
        // arriva e dove va.
        sky.mostraSatelliti = true; sky.mostraTraccia = true; sky.mostraSottoOrizzonte = true;
        skyAggiornaTastiFiltri();
        const rec = satRecDi(pas.sat), gd = satOsservatoreGd(pas.luogo);
        const punti = [];
        for (let i = 0; i <= 16; i++) {
          const q = satAltAz(rec, new Date(pas.inizio + (pas.fine - pas.inizio) * i / 16), gd);
          if (q && q.alt > -1) punti.push({ az: q.az, alt: q.alt });
        }
        const q = punti.length >= 2 ? inquadraDirezioni(punti, 60) : { az: pas.dati.azCulmine, alt: 35, campo: 110 };
        puntaCamera(q.az, Math.max(8, q.alt), q.campo);
        skyAggiornaOggetti(true);
        // Il bersaglio serve alla traccia e al cerchio che lo segna, non alla
        // camera: niente `skyImpostaTarget`, che lo porterebbe al centro.
        sky.target = 'sat-' + p.satellite; sky.inseguimento = false; sky.centraQuandoPronto = null;
        const fermo = { az: q.az, alt: Math.max(8, q.alt), campo: q.campo };
        return { aggiorna(u) {
          aggiorna(u);
          if (!c.cameraManuale) puntaCamera(fermo.az, fermo.alt, fermo.campo, true);
        } };
      }
      return { aggiorna };
    }
  };

  // ------------------------------------------------------------------
  // La voce del racconto. Non è codice della demo: è la narrazione di
  // tutta l'app (`narrazione.js`), a cui la scena passa un ID stabile — la
  // chiave del dizionario — oppure, in una demo personale, un testo scritto
  // a mano. La voce vive quanto la scena: il cambio di scena, Stop, Esc e la
  // fine chiudono l'esecutore, e l'esecutore chiude la voce; pausa e ripresa
  // le passa il motore (`contesto.pausa`/`riprendi`). Così due frasi non si
  // accavallano mai, qualunque sia la strada da cui si esce.
  // ------------------------------------------------------------------
  registro.narrate = {
    verifica(p) {
      campi(p, ['id', 'text']);

      // La narrazione deve avere almeno un ID del dizionario oppure un testo diretto.
      richiedi(
          typeof p.id === 'string' || typeof p.text === 'string',
          err('narraVuota')
      );

      // Se la demo usa un testo scritto direttamente nel DSL, controlla che sia valido
      // e non eccessivamente lungo.
      if (typeof p.text === 'string') {
        richiedi(
            p.text.trim() && p.text.length <= 400,
            err('narraLunga')
        );
      } else {
        // Se invece usa un ID, quell'ID deve esistere nel dizionario i18n.
        richiedi(
            /^[\w.-]+$/.test(p.id) && astroI18n.esiste(p.id),
            err('narraId', { id: p.id })
        );
      }
    },

    crea(p) {
      // Se il sistema di narrazione non è disponibile, la scena continua comunque.
      if (typeof narrazione !== 'object') return {};

      // Avvia la narrazione e conserva la Promise restituita.
      // Questa Promise si risolve solo quando l'audio registrato, il TTS
      // oppure il fallback testuale hanno terminato.
      //
      // Il motore demo potrà quindi usare `fineNarrazione` per evitare
      // di chiudere la scena mentre la voce sta ancora parlando.
      const fineNarrazione = narrazione.parla({
        canale: 'demo',
        id: p.id || '',

        // Se `text` non è presente, narrazione.js recupera il testo
        // automaticamente dal dizionario tramite l'ID.
        testo: typeof p.text === 'string' ? p.text : undefined,

        // Mostra il testo della narrazione dentro al pannello della demo.
        ospite: () => pannello
      });

      // Se si entra in questa scena mentre la demo è già in pausa,
      // anche la nuova narrazione deve partire nello stesso stato.
      if (motore.stato === 'pausa') {
        narrazione.pausa('demo');
      }

      return {
        // Espone al motore la Promise della voce.
        // Il motore dovrà attendere sia la durata minima della scena
        // sia questa Promise prima di passare alla scena successiva.
        fineNarrazione,

        // Quando la scena viene chiusa manualmente, saltata o interrotta,
        // ferma subito anche l'audio/TTS relativo a questa demo.
        chiudi() {
          narrazione.ferma('demo');
        }
      };
    }
  };

  const motore = new AstroDemoMotore.Motore(registro, { avvisa: aggiornaPannello });
  let contesto = null, ultimoScript = script;
  const chiavi = ['modalitaTempo', 'istanteSimulatoMs', 'offsetTempoSec', 'luogoVista', 'target',
    'inseguimento', 'eventoInseguito', 'seguiTelefono', 'fov', 'fovVoluto', 'modalitaHover',
    'mostraPianeti', 'mostraSoleLuna', 'mostraSottoOrizzonte', 'mostraSatelliti', 'mostraTraccia',
    'passoTempoSec', 'playbackVerso', 'ancoraTempoSec', 'finestraTempoSec',
    // Il campo è definito sull'altezza del riquadro (`skyRidimensiona`):
    // conserviamo anche l'altezza a cui valeva, così eventuali resize durante
    // la demo non riscalano di nuovo il FOV quando si ripristina lo stato.
    'altezzaMisurata'];
  const VISTE_SCENA = ['planetarium_view', 'transition', 'solar_system_3d', 'didactic_view'];
  function valida(testo) {
    const demo = motore.prepara(testo);
    let quando = skyAdesso(), luogo = skyLuogoDelCielo();
    for (const scena of demo.scene) {
      richiedi(VISTE_SCENA.includes(scena.vista), err('scena', { nome: scena.vista }));
      for (const azione of scena.azioni) {
        if (azione.comando === 'set_location') luogo = luogoDemo(azione.parametri);
        if (azione.comando === 'set_date') quando = dataISO(azione.parametri);
        if (azione.comando === 'timelapse') quando = tempiCivili(azione.parametri, quando, luogo).fine;
        if (azione.comando === 'aurora_lesson') richiedi(scena.vista === 'didactic_view', err('soloDidattica'));
        if (azione.comando === 'camera_3d') richiedi(scena.vista === 'solar_system_3d', err('serve3d'));
      }
    }
    return demo;
  }

  // ------------------------------------------------------------------
  // Le opzioni della demo: schermo intero, vista pulita, registrazione (con
  // audio opzionale) e gli elementi del planetario. Le due opzioni nuove
  // nascono accese anche leggendo preferenze salvate prima che esistessero.
  // ------------------------------------------------------------------
  const CHIAVE_OPZIONI = 'astrocal_demo_opzioni_v1';
  function leggiOpzioni() {
    try {
      const o = JSON.parse(localStorage.getItem(CHIAVE_OPZIONI) || 'null');
      if (o && typeof o === 'object') return {
        schermoIntero: !!o.schermoIntero,
        registra: !!o.registra,
        vistaPulita: o.vistaPulita !== false,
        registraAudio: o.registraAudio !== false,
        livelli: o.livelli && typeof o.livelli === 'object' ? o.livelli : null
      };
    } catch (_) { /* salvataggio illeggibile: si riparte dai valori di serie */ }
    return { schermoIntero: false, registra: false, vistaPulita: true, registraAudio: true, livelli: null };
  }
  let opzioni = leggiOpzioni();
  function impostaOpzioni(nuove) {
    opzioni = Object.assign({}, opzioni, nuove);
    try { localStorage.setItem(CHIAVE_OPZIONI, JSON.stringify(opzioni)); } catch (_) { /* niente storage */ }
    return opzioni;
  }

  // Gli strati del planetario. L'elenco **non è inventato**: sono gli
  // interruttori che la scheda Visualizzazione ha già, con il loro stato e la
  // loro funzione di accensione — il nome si legge dal tasto stesso, quindi
  // segue la lingua. Solo la Via Lattea non ha un tasto, e ha una voce sua.
  const campoSky = (id, tasto, campo, extra) => ({
    id, tasto, leggi: () => !!sky[campo],
    scrivi(v) {
      sky[campo] = v;
      if (campo === 'atmosfera' && !v) sky.nuvole = false;
      if (campo === 'nuvole' && v) sky.atmosfera = true;
      if (extra) extra(v);
    }
  });
  const modulo = (id, tasto, leggi, alterna) => ({
    id, tasto,
    leggi() { try { return !!leggi(); } catch (_) { return false; } },
    disponibile() { try { leggi(); return typeof alterna() === 'function'; } catch (_) { return false; } },
    scrivi(v) { if (this.leggi() !== v) alterna()(); }
  });
  const LIVELLI = [
    campoSky('stelle', 'skymap-btn-stelle', 'mostraStelle'),
    campoSky('nomi', 'skymap-btn-etichette', 'mostraNomi'),
    campoSky('costellazioni', 'skymap-btn-costellazioni', 'mostraCostellazioni'),
    modulo('arte', 'skymap-btn-arte', () => cost.arte, () => window.costAlternaArte),
    campoSky('pianeti', 'skymap-btn-pianeti', 'mostraPianeti'),
    campoSky('soleLuna', 'skymap-btn-solelun', 'mostraSoleLuna'),
    campoSky('profondo', 'skymap-btn-deepsky', 'mostraProfondo'),
    campoSky('viaLattea', null, 'mostraViaLattea'),
    campoSky('corpiMinori', 'skymap-btn-corpiminori', 'mostraCorpiMinori'),
    campoSky('satelliti', 'skymap-btn-satelliti', 'mostraSatelliti'),
    modulo('aerei', 'skymap-btn-aerei', () => AereiADS_B.stato.visibile,
      () => v => aereiImpostaAccesi(!AereiADS_B.stato.visibile)),
    campoSky('griglia', 'skymap-btn-griglia', 'mostraGriglia'),
    campoSky('eclittica', 'skymap-btn-eclittica', 'mostraEclittica', () => { sky.eclittica.chiave = null; }),
    campoSky('traccia', 'skymap-btn-traccia', 'mostraTraccia', () => { sky.traccia.chiave = null; }),
    campoSky('eventi', 'skymap-btn-eventi', 'mostraEventi'),
    campoSky('sotto', 'skymap-btn-sotto', 'mostraSottoOrizzonte'),
    campoSky('atmosfera', 'skymap-btn-atmosfera', 'atmosfera'),
    campoSky('nuvole', 'skymap-btn-nuvole', 'nuvole'),
    modulo('aurora', 'skymap-btn-aurora', () => aur.acceso, () => aurAlterna),
    modulo('terreno', 'skymap-btn-terreno', () => terreno.acceso, () => terrenoAlterna),
    modulo('rilievo', 'skymap-btn-rilievo', () => rilievo.acceso, () => rilAlterna),
    modulo('citta', 'skymap-btn-citta', () => citta.acceso, () => cittaAlterna),
    modulo('cime', 'skymap-btn-cime', () => cime.acceso, () => cimeAlterna),
    modulo('acque', 'skymap-btn-acque', () => acque.acceso, () => acqueAlterna)
  ].filter(l => !l.disponibile || l.disponibile());
  function nomeLivello(l) {
    const b = l.tasto && document.getElementById(l.tasto);
    const testo = b && b.textContent.replace(/\s+/g, ' ').trim();
    return testo || t('livello.' + l.id);
  }
  function fotografaLivelli() { return Object.fromEntries(LIVELLI.map(l => [l.id, l.leggi()])); }
  function applicaLivelli(scelta) {
    if (!scelta) return;
    for (const l of LIVELLI) {
      if (typeof scelta[l.id] !== 'boolean' || l.leggi() === scelta[l.id]) continue;
      try { l.scrivi(scelta[l.id]); } catch (_) { /* un modulo assente non ferma gli altri */ }
    }
    skyAggiornaTastiFiltri();
    if (typeof aurAggiornaPannello === 'function') aurAggiornaPannello();
    skyAggiornaOggetti(true);
  }

  // La tela da riprendere quando la demo si registra: segue la scena.
  function telaInScena() {
    if (typeof solVolo !== 'undefined' && solVolo.attivo) {
      const volo = document.getElementById('sol-transizione-tela');
      if (volo && volo.width) return volo;
    }
    if (vistaAttuale === 'didattica' && typeof didDemo !== 'undefined') return didDemo.tela();
    if (sol.aperto && sol.canvas) return sol.canvas;
    return sky.canvas;
  }

  // La vista pulita non cambia lo stato dei comandi: marca soltanto il
  // contenitore della scena e lascia al CSS il compito di nascondere il
  // chrome. Togliendo le classi, pannelli e controlli ricompaiono esattamente
  // come erano prima anche dopo Stop, Esc o un errore.
  function radiceVistaPulita() {
    if (sol.aperto && typeof solGuscio === 'function') return solGuscio();
    if (vistaAttuale === 'didattica' && typeof didDemo !== 'undefined') {
      const tela = didDemo.tela();
      if (tela) return tela.closest('.did-pieno-ripiego') || tela.parentElement;
    }
    return document.getElementById('skymap-contenitore');
  }
  function applicaVistaPulita(c) {
    if (!c || !c.vistaPulita) return;
    const radice = radiceVistaPulita();
    if (radice) radice.classList.add('demo-scena-pulita');
  }
  function togliVistaPulita() {
    document.querySelectorAll('.demo-scena-pulita').forEach(el => el.classList.remove('demo-scena-pulita'));
  }

  function avvia(testo = script) {
    const demo = valida(testo);
    motore.ferma();
    richiedi(!sol.aperto && !sky.reg.attiva && !sky.reg.preparazione &&
      !(typeof missRicercaAttiva === 'function' && missRicercaAttiva()), t('occupato'));
    richiedi(typeof Astronomy !== 'undefined' && sky.observer, t('attendi'));
    ultimoScript = testo;
    const precedente = Object.fromEntries(chiavi.map(k => [k, sky[k]]));
    const manuale = { ...sky.manuale }, vistaPrima = vistaAttuale;
    const cameraSistema = Object.fromEntries(['az', 'elev', 'elevVoluta', 'zoom', 'zoomVoluto',
      'panX', 'panY', 'perno', 'vicino', 'quadro', 'scelto', 'mondiAccesi', 'sondeAccese'].map(k => [k, sol[k]]));
    const auroraPrima = { acceso: aur.acceso, kpSimulato: aur.kpSimulato };
    const didatticaPrima = typeof didDemo !== 'undefined' ? didDemo.fotografa() : null;
    const livelliPrima = fotografaLivelli();
    const schermoInteroPrima = sky.schermoIntero;
    const regPrima = { durataSec: sky.reg.durataSec, origine: sky.reg.origine };
    const modaleImpostazioni = document.getElementById('modale-impostazioni');
    const impostazioniNascostePrima = !!(modaleImpostazioni && modaleImpostazioni.classList.contains('hidden'));
    const comandiCielo = document.getElementById('cielo-comandi');
    const gruppoPrima = comandiCielo ? (comandiCielo.dataset.gruppoAttivo || '') : '';
    const c = { chiuso: false, eclisse: null, cameraManuale: false, schermo: !!opzioni.schermoIntero,
      vistaPulita: opzioni.vistaPulita !== false,
      ridotto: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      scena(scena) {
        // Ogni scena puo impostare la propria inquadratura iniziale. Dopo un
        // intervento della persona, pero, le animazioni della scena corrente
        // le cedono la camera mentre il racconto e il suo orologio proseguono.
        c.cameraManuale = false;
        if (scena.vista !== 'transition') vista(scena.vista, c);
      },
      cediCamera() {
        c.cameraManuale = true;
        sky.inseguimento = false;
      },
      // La voce segue l'orologio del racconto: ferma con la pausa (anche
      // quella che arriva nascondendo la scheda), di nuovo in marcia con la
      // ripresa.
      pausa() { if (typeof narrazione === 'object') narrazione.pausa('demo'); },
      riprendi() { if (typeof narrazione === 'object') narrazione.riprendi('demo'); },
      ripristina() {
        c.chiuso = true; contesto = null; evidenze.clear();
        if (typeof narrazione === 'object') narrazione.ferma('demo');
        document.body.classList.remove('demo-in-corso', 'demo-vista-pulita');
        togliVistaPulita();
        const registrava = sky.reg.attiva && sky.reg.sorgente;
        if (registrava) skyRegFerma();
        if (typeof narrazione === 'object' && typeof narrazione.fermaCatturaAudio === 'function')
          narrazione.fermaCatturaAudio('demo');
        c.flussoAudio = null;
        if (c.registrazione) cancelAnimationFrame(c.registrazione);
        solVolo.dopo = null; solVoloChiudi();
        if (sol.aperto) chiudiSistemaSolare();
        if (typeof didDemo !== 'undefined') didDemo.ripristina(didatticaPrima);
        Object.assign(sol, cameraSistema);
        lasciaCielo(c);
        if (vistaAttuale !== vistaPrima) mostraVista(vistaPrima, { conservaTempo: true });
        const luogoCambiato = sky.luogoVista !== precedente.luogoVista;
        skyImpostaPassoTempo(precedente.passoTempoSec);
        applicaLivelli(livelliPrima);
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
        // Anche il registratore normale chiude il gruppo comandi per lasciare
        // libero il cielo: nella Demo quel gesto non deve diventare stato.
        if (comandiCielo) skyMostraGruppo(gruppoPrima);
        // Ripristina lo stato iniziale se durante la demo si e' entrati
        // manualmente a schermo intero partendo dalla vista normale.
        if (!schermoInteroPrima && sky.schermoIntero) skyEsciSchermoIntero();
        // Il pieno schermo dell'intero documento l'ha chiesto la demo: lo
        // chiude lei, e solo se è ancora il suo.
        if (c.schermoNativo && document.fullscreenElement === document.documentElement && document.exitFullscreen)
          document.exitFullscreen().catch(() => {});
        sky.reg.sorgente = null;
        sky.reg.durataSec = regPrima.durataSec; sky.reg.origine = regPrima.origine;
        // Il filmato si mostra nel pannello del planetario: chi ha chiesto di
        // registrare trova lì il risultato, anche se era partito da un'altra vista.
        if (registrava && vistaAttuale !== 'cielo') mostraVista('cielo');
        if (modaleImpostazioni) modaleImpostazioni.classList.toggle('hidden', impostazioniNascostePrima);
        pannello.hidden = true;
      }
    };
    contesto = c;
    document.body.classList.add('demo-in-corso');
    document.body.classList.toggle('demo-vista-pulita', c.vistaPulita);
    // La finestra Impostazioni deve lasciare vedere il racconto, ma il suo
    // stato viene ricordato e ripristinato: la vista pulita non chiude né
    // pannelli né avvisi, li nasconde soltanto.
    if (modaleImpostazioni) modaleImpostazioni.classList.add('hidden');
    skyFermaPlayback(); skyFermaMovimenti(); sky.seguiTelefono = false; sky.modalitaHover = false;
    sky.eventoInseguito = null;
    applicaLivelli(opzioni.livelli);
    // Il pieno schermo vero si chiede qui, dentro al gesto che ha avviato la
    // demo, sull'intero documento: le tre viste del racconto se lo passano
    // col solo CSS, e il browser non ne esce a ogni cambio di scena.
    if (c.schermo && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      c.schermoNativo = true;
      try { document.documentElement.requestFullscreen().catch(() => { c.schermoNativo = false; }); }
      catch (_) { c.schermoNativo = false; }
    }
    motore.avvia(testo, c);
    if (motore.stato === 'attivo' && opzioni.registra) avviaRegistrazione(c, demo);
    aggiornaPannello();
  }

  // La registrazione resta quella del planetario; la Demo cambia soltanto
  // la tela sorgente e, quando richiesto, aggiunge l'unica traccia della
  // narrazione condivisa al MediaStream creato dal registratore esistente.
  function avviaRegistrazione(c, demo) {
    const totale = demo.scene.reduce((n, s) => n + s.durata, 0) / 1000;
    sky.reg.origine = 'planetario';
    sky.reg.sorgente = telaInScena;
    sky.reg.durataSec = totale + 3600;

    let flussoAudio = null;
    if (opzioni.registraAudio !== false && typeof narrazione === 'object' &&
        typeof narrazione.catturaAudio === 'function') {
      try { flussoAudio = narrazione.catturaAudio('demo'); } catch (_) { flussoAudio = null; }
    }
    c.flussoAudio = flussoAudio;

    // skyRegAvviaVideo crea il MediaStream internamente. Per non duplicare
    // quel registratore, durante il solo avvio intercettiamo captureStream
    // della sua tela e vi innestiamo la traccia audio.
    const proto = typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement.prototype : null;
    const originale = proto && proto.captureStream;
    let iniettata = null;
    const tracciaAudio = flussoAudio && typeof flussoAudio.getAudioTracks === 'function'
      ? flussoAudio.getAudioTracks().find(t => t.readyState !== 'ended') : null;
    // Con una traccia audio è preferibile lasciare che MediaRecorder scelga
    // entrambi i codec del contenitore, invece di forzare il solo codec video
    // usato dalle registrazioni mute del planetario.
    const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null;
    const supportaTipo = MR && typeof MR.isTypeSupported === 'function' ? MR.isTypeSupported : null;
    let supportaTipoDemo = null;
    if (tracciaAudio && supportaTipo) {
      supportaTipoDemo = function (mime) {
        if (/;\s*codecs=/i.test(mime || '')) return false;
        return supportaTipo.call(MR, mime);
      };
      try { MR.isTypeSupported = supportaTipoDemo; } catch (_) { supportaTipoDemo = null; }
    }
    if (proto && typeof originale === 'function' && tracciaAudio) {
      iniettata = function (...args) {
        const stream = originale.apply(this, args);
        if (this === sky.reg.tela && stream && typeof stream.addTrack === 'function') {
          const presenti = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
          if (!presenti.includes(tracciaAudio)) stream.addTrack(tracciaAudio);
        }
        return stream;
      };
      proto.captureStream = iniettata;
    }
    const ripristinaAgganci = () => {
      try {
        if (proto && iniettata && proto.captureStream === iniettata) proto.captureStream = originale;
      } catch (_) { /* il browser non espone un prototipo scrivibile */ }
      try {
        if (MR && supportaTipoDemo && MR.isTypeSupported === supportaTipoDemo) MR.isTypeSupported = supportaTipo;
      } catch (_) { /* idem per il metodo statico del registratore */ }
    };
    const chiudiAudioSeInutile = () => {
      if (typeof narrazione === 'object' && typeof narrazione.fermaCatturaAudio === 'function')
        narrazione.fermaCatturaAudio('demo');
      c.flussoAudio = null;
    };

    let partenza;
    try {
      partenza = skyRegAvvia();
      // skyRegAvvia è sincrono e chiude il pannello del cielo come fa una
      // registrazione manuale. La Demo conserva invece lo stato preesistente;
      // la vista pulita lo nasconde già senza mutarlo.
      if (comandiCielo) skyMostraGruppo(gruppoPrima);
    } catch (e) {
      chiudiAudioSeInutile();
      sky.reg.sorgente = null;
      skyAvviso('demo', t('errore') + ': ' + e.message, 10000);
      return;
    } finally {
      ripristinaAgganci();
    }
    Promise.resolve(partenza).then(() => {
      if (c.chiuso) {
        if (sky.reg.attiva) skyRegFerma();
        chiudiAudioSeInutile();
        return;
      }
      if (!sky.reg.attiva) { chiudiAudioSeInutile(); return; }
      aggiornaPannello();
      const giro = () => {
        if (c.chiuso || !sky.reg.attiva) return;
        skyRegAcquisisci();
        c.registrazione = requestAnimationFrame(giro);
      };
      c.registrazione = requestAnimationFrame(giro);
    }, e => {
      chiudiAudioSeInutile();
      sky.reg.sorgente = null;
      if (!c.chiuso) skyAvviso('demo', t('errore') + ': ' + (e && e.message ? e.message : e), 10000);
    });
  }

  const pannello = document.createElement('div');
  pannello.id = 'demo-controlli'; pannello.hidden = true;
  pannello.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10000;display:flex;gap:8px;align-items:center;padding:7px;background:rgba(8,15,28,.38);border:1px solid rgba(255,255,255,.16);border-radius:999px;box-sizing:border-box;box-shadow:0 8px 28px rgba(0,0,0,.2);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:opacity .18s ease,visibility .18s ease';
  let timerComandi = null;
  const icone = {
    pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>',
    riprendi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    riavvia: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.2 3.75L3 11V4h7L7.6 6.4A9 9 0 1 0 12 3z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>'
  };
  function nascondiComandi() {
    if (timerComandi) { clearTimeout(timerComandi); timerComandi = null; }
    pannello.style.opacity = '0'; pannello.style.visibility = 'hidden'; pannello.style.pointerEvents = 'none';
  }
  function mostraComandi() {
    if (!(motore.stato === 'attivo' || motore.stato === 'pausa')) return;
    pannello.style.opacity = '1'; pannello.style.visibility = 'visible'; pannello.style.pointerEvents = 'auto';
    if (timerComandi) clearTimeout(timerComandi);
    timerComandi = setTimeout(nascondiComandi, 6000);
  }
  function bottone(chiave, azione) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tasto-cielo';
    b.style.cssText = 'width:44px;height:44px;min-width:44px;padding:0;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#fff;box-shadow:none';
    b.innerHTML = icone[chiave]; b.setAttribute('aria-label', t(chiave)); b.setAttribute('title', t(chiave));
    b.querySelector('svg').style.cssText = 'width:22px;height:22px;fill:currentColor';
    b.addEventListener('click', e => { e.stopPropagation(); azione(); mostraComandi(); }); pannello.append(b); return b;
  }
  const pausa = bottone('pausa', () => motore.stato === 'pausa' ? motore.riprendi() : motore.pausa());
  const riavvia = bottone('riavvia', () => avviaSicuro(ultimoScript));
  const arresta = bottone('stop', () => motore.ferma());
  document.body.append(pannello);
  function aggiornaPannello() {
    const attivo = motore.stato === 'attivo' || motore.stato === 'pausa';
    if (attivo) {
      const pieno = document.querySelector('.did-pieno-ripiego');
      const genitore = sol.aperto ? solGuscio()
        : (pieno && vistaAttuale === 'didattica') ? pieno
          : (sky.schermoIntero ? document.getElementById('skymap-contenitore') : null) ||
            (document.fullscreenElement && document.fullscreenElement !== document.documentElement
              ? document.fullscreenElement : document.body);
      if (genitore && pannello.parentElement !== genitore) genitore.append(pannello);
      pannello.hidden = false;
      pausa.innerHTML = icone[motore.stato === 'pausa' ? 'riprendi' : 'pausa'];
      pausa.setAttribute('aria-label', t(motore.stato === 'pausa' ? 'riprendi' : 'pausa'));
      pausa.setAttribute('title', pausa.getAttribute('aria-label'));
      riavvia.setAttribute('aria-label', t('riavvia')); riavvia.setAttribute('title', t('riavvia'));
      arresta.setAttribute('aria-label', t('stop')); arresta.setAttribute('title', t('stop'));
      if (pannello.style.visibility !== 'visible') nascondiComandi();
    } else {
      if (pannello.parentElement !== document.body) document.body.append(pannello);
      pannello.hidden = true; nascondiComandi();
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
    if (!contesto) return;
    if (!pannello.contains(e.target)) {
      contesto.cediCamera();
      mostraComandi();
    }
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
  // Nel pieno schermo vero Esc non arriva alla pagina: lo consuma il
  // browser, che esce dal pieno schermo. Se a uscire è quello della demo,
  // la persona ha chiesto di smettere — e la demo si ferma e ripristina.
  document.addEventListener('fullscreenchange', () => {
    if (contesto && contesto.schermoNativo) {
      if (document.fullscreenElement === document.documentElement) contesto.nativoAttivo = true;
      else if (!document.fullscreenElement && contesto.nativoAttivo) { contesto.schermoNativo = false; motore.ferma(); }
    }
    aggiornaPannello();
  });
  // Se la preferenza cambia durante il tour, interrompi e ripristina subito.
  const movimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (movimento && movimento.addEventListener) movimento.addEventListener('change', () => {
    if (contesto) motore.ferma();
  });
  window.AstroDemo = {
    script, valida, libreria: AstroDemoLibreria.crea({
      getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v)
    }, predefiniti, valida), avvia, pausa: () => motore.pausa(), riprendi: () => motore.riprendi(),
    ferma: () => motore.ferma(), vaiAScena: (i, u) => motore.vaiAScena(i, u), evidenza: id => evidenze.get(id) || 1,
    get stato() { return motore.stato; },
    get scena() { return motore.indice; },
    // Gli avvisi di servizio tacciono soltanto nella vista pulita: spegnendo
    // l'opzione l'interfaccia resta deliberatamente utilizzabile e visibile.
    get silenzioso() { return !!(contesto && contesto.vistaPulita); },
    get opzioni() { return { ...opzioni, livelli: opzioni.livelli && { ...opzioni.livelli } }; },
    impostaOpzioni,
    livelli: () => LIVELLI.map(l => ({ id: l.id, nome: nomeLivello(l), acceso: l.leggi() })),
    registra(nome, comando) {
      richiedi(/^[a-z_]+$/.test(nome) && nome !== 'center' && !registro[nome], err('registraNome'));
      richiedi(comando && typeof comando.crea === 'function', err('registraCrea'));
      registro[nome] = comando;
    }
  };
})();
