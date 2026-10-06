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
  // Il Sistema Solare si apre in una finestra che, col cielo a schermo
  // intero, va a stare **dentro** al riquadro del cielo — ma ci va con un
  // MutationObserver, cioè un momento dopo, e il guscio della 3D prende lo
  // schermo col suo ripiego solo quando glielo si chiede. In mezzo il browser
  // può disegnare un fotogramma con la finestra fuori posto: era il
  // lampeggio del passaggio fra planetario e 3D. Qui si fa tutto nello
  // stesso turno, prima del disegno, e il pieno schermo nativo dell'intero
  // documento non viene mai toccato.
  function presentaSistema(c) {
    if (typeof skySistemaModaliSchermoIntero === 'function') skySistemaModaliSchermoIntero();
    if (c && c.schermo && typeof solEntraSchermoIntero === 'function' && !solSchermoIntero) solEntraSchermoIntero();
  }
  function lasciaCielo(c) {
    if (c && c.cieloImmersivo && sky.schermoIntero) skyEsciSchermoIntero();
    if (c) c.cieloImmersivo = false;
  }
  // La mappa del cono d'ombra (`eclipse_map`) non è una vista del menu: è
  // la finestra dell'eclissi, che la regia apre a tutto schermo sopra al
  // planetario. Ogni altra scena la chiude per prima.
  function lasciaMappa() {
    if (typeof eclRegiaAttiva === 'function' && eclRegiaAttiva()) eclRegiaChiudi();
  }
  function vista(v, c) {
    if (c) c.mappaRipiego = false;
    if (v !== 'eclipse_map') lasciaMappa();
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
      presentaSistema(c);
      solRidimensiona();
    } else if (v === 'eclipse_map') {
      if (typeof didDemo !== 'undefined') didDemo.pieno(false);
      if (sol.aperto) chiudiSistemaSolare();
      if (vistaAttuale !== 'cielo') mostraVista('cielo', { conservaTempo: true });
      presentaCielo(c);
      // L'eclisse è la stessa delle altre scene del racconto: il suo
      // massimo si cerca una volta sola (`piccoEvento`).
      // Senza Leaflet (offline, o il CDN che non risponde) la mappa non
      // c'è: il racconto non si interrompe per questo, e la stessa ombra la
      // si guarda dalla 3D, addosso alla Terra (`shadow_map` sa fare tutt'e
      // due le cose).
      const picco = piccoEvento(c, 'solar_eclipse');
      if (!(typeof eclRegiaApri === 'function' && eclRegiaApri(picco, skyLuogoDelCielo()))) {
        vista('solar_system_3d', c);
        c.mappaRipiego = true;
        return;
      }
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
  // I solstizi e gli equinozi: l'istante vero (`Astronomy.Seasons`) più
  // vicino all'orologio del racconto, prima o dopo, cercato nell'anno di
  // adesso e nei due accanto. Sono gli «eventi» della demo delle stagioni.
  const STAGIONI = { march_equinox: 'mar_equinox', june_solstice: 'jun_solstice',
    september_equinox: 'sep_equinox', december_solstice: 'dec_solstice' };
  function stagioneVicina(quando, tipo) {
    const ora = +quando, anno = new Date(ora).getUTCFullYear();
    let migliore = null;
    for (const a of [anno - 1, anno, anno + 1]) {
      let ms = NaN;
      try { ms = Astronomy.Seasons(a)[STAGIONI[tipo]].date.getTime(); } catch (_) { ms = NaN; }
      if (Number.isFinite(ms) && (migliore === null || Math.abs(ms - ora) < Math.abs(migliore - ora))) migliore = ms;
    }
    return migliore;
  }
  function piccoEvento(c, tipo) {
    c.eventi = c.eventi || {};
    if (c.eventi[tipo]) return c.eventi[tipo];
    if (STAGIONI[tipo]) {
      const ms = stagioneVicina(skyAdesso(), tipo);
      richiedi(Number.isFinite(ms), err('stagioneAssente'));
      c.eventi[tipo] = ms;
      return ms;
    }
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
  // `set_date` vuole un istante UTC scritto per intero (`iso`), oppure
  // `tonight: 'HH:MM'`: stasera a quell'ora civile nel luogo del cielo.
  // «Stasera» vuol dire il giorno in cui la demo si guarda, non quello in
  // cui è stata scritta: con una data fissa, una scena che dice «stasera»
  // mostrava il cielo e il cartello di un altro giorno.
  function dataDemo(p, luogo = skyLuogoDelCielo()) {
    if (p.tonight === undefined) return dataISO(p);
    campi(p, ['tonight']);
    const m = minuti(p.tonight);
    richiedi(luogo, err('luogoData'));
    const parti = partiDataDelLuogo(new Date(), luogo);
    const d = dataDalTempoDelLuogo({ year: parti.year, month: parti.month, day: parti.day,
      hour: Math.floor(m / 60), minute: m % 60, second: 0 }, luogo);
    richiedi(d, err('oraInesistente'));
    return d;
  }
  registro.set_date = {
    verifica(p) { if (p.tonight === undefined) dataISO(p); else { campi(p, ['tonight']); minuti(p.tonight); } },
    crea(p) { istante(+dataDemo(p)); }
  };
  // Un tratto di calendario, da una data all'altra, per tutta la durata della
  // scena: è il modo di far girare la Terra attorno al Sole in venti secondi.
  // `timelapse` sta dentro a un giorno civile e `event_window` dentro a
  // dodici ore da un evento; qui si va fino a tre anni.
  const DATE_RANGE_MAX_MS = 3 * 366 * 86400000;
  function intervalloDate(p) {
    campi(p, ['from', 'to']);
    const a = dataISO({ iso: p.from }), b = dataISO({ iso: p.to });
    richiedi(+b > +a && +b - +a <= DATE_RANGE_MAX_MS, err('intervalloDate'));
    return { a: +a, b: +b };
  }
  registro.date_range = {
    verifica: intervalloDate,
    crea(p) {
      const { a, b } = intervalloDate(p);
      const aggiorna = u => istante(a + (b - a) * u);
      aggiorna(0);
      return { aggiorna };
    }
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
    // Con `probe` la direzione è quella della sonda nell'istante in cui la
    // scena comincia (più `alt` gradi, se c'è): una direzione scritta a mano
    // vale per una sera sola, e «dove sta stasera» cambia di sera in sera.
    // Se la sonda è bassa, lo sguardo resta almeno a 15° perché si veda
    // anche l'orizzonte.
    verifica(p) {
      campi(p, ['az', 'alt', 'probe']);
      if (p.probe !== undefined) {
        richiedi(SONDE_VOYAGER.includes(p.probe), err('sonde'));
        richiedi(p.az === undefined && (p.alt === undefined || numero(p.alt, -45, 45)), err('direzione'));
        return;
      }
      richiedi(numero(p.az, 0, 360) && numero(p.alt, -90, 90), err('direzione'));
    },
    crea(p, c) {
      let az = p.az, alt = p.alt;
      if (p.probe !== undefined) {
        const s = typeof skySondaInCielo === 'function' ? skySondaInCielo(p.probe) : null;
        richiedi(s, err('sonde'));
        az = s.az; alt = Math.max(15, s.alt + (p.alt || 0));
      }
      sky.inseguimento = false; sky.target = null; sky.seguiTelefono = false;
      sky.manuale.az = az; sky.manuale.alt = alt;
      // Come il campo: finché la demo tiene la camera, la direzione resta
      // quella del racconto anche se un ridimensionamento la sposta.
      return { aggiorna() {
        if (c && c.cameraManuale) return;
        sky.manuale.az = az; sky.manuale.alt = alt;
      } };
    }
  };
  // La camera che accompagna un astro **solo in azimut**, tenendo ferma
  // l'altezza dello sguardo. `center_target` lo metterebbe al centro, e con
  // lui correrebbe via l'orizzonte: per far vedere quanto sale il Sole nelle
  // diverse stagioni serve l'opposto — il suolo fermo in basso e il Sole che
  // si alza e si abbassa sopra di lui, mentre la vista lo segue dall'alba al
  // tramonto. La direzione si chiede per l'istante di adesso, non a
  // `sky.oggetti`, che durante un timelapse resta indietro di un fotogramma.
  registro.track_azimuth = {
    verifica(p) {
      campi(p, ['target', 'alt']);
      richiedi(corpi.includes(p.target), err('bersaglio', { nome: p.target }));
      richiedi(numero(p.alt, -30, 85), err('direzione'));
    },
    crea(p, c) {
      sky.mostraSoleLuna = true; sky.mostraPianeti = true;
      const applica = () => {
        let q = null;
        try { q = altAzCorpo(p.target, skyAdesso(), sky.observer); } catch (_) { q = null; }
        if (!q) return;
        sky.inseguimento = false; sky.target = null; sky.seguiTelefono = false;
        sky.manuale.az = q.az; sky.manuale.alt = p.alt;
        if ('animazioneVista' in sky) sky.animazioneVista = null;
      };
      applica();
      return { aggiorna() { if (!c || !c.cameraManuale) applica(); } };
    }
  };
  registro.set_fov = {
    verifica(p) {
      campi(p, ['degrees']);
      richiedi(numero(p.degrees, 0.25, 160), err('fov'));
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
      richiedi(numero(p.from, 0.25, 160) && numero(p.to, 0.25, 160), err('fov'));
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
  // Il volo fra il planetario e la vista 3D, nei due versi. `solar_system_3d`
  // è il decollo (la salita dal cielo di casa fino addosso alla Terra);
  // `planetarium_view` (v404) è l'atterraggio, lo stesso volo percorso
  // all'indietro: parte dalla Terra della scala cosmica (o della 3D) alla
  // misura a cui la scena prima l'ha lasciata — `cosmic_scale { to: landing }`
  // — e finisce sulla fotografia del planetario, che la scena dopo riprende.
  registro.zoom_view = {
    verifica(p) {
      campi(p, ['type', 'final_target']);
      richiedi(p.type === 'geometric' && ['solar_system_3d', 'planetarium_view'].includes(p.final_target), err('transizione'));
    },
    crea(p, c) {
      if (p.final_target === 'planetarium_view') {
        if (!sol.aperto || typeof solAtterraNelPlanetario !== 'function' || typeof solPreparaAtterraggio !== 'function') {
          vista('planetarium_view', c);
          return {};
        }
        const camera = typeof cosm !== 'undefined' && cosm.attivo ? { az: cosm.az, elev: cosm.elev } : { az: sol.az, elev: sol.elev };
        if (typeof cosmRegia === 'function') cosmRegia(null);
        if (typeof cosmEsci === 'function') cosmEsci();
        solPreparaAtterraggio(camera);
        if (!solAtterraNelPlanetario({ manuale: true })) { vista('planetarium_view', c); return {}; }
        return {
          aggiorna(u) { solAtterraPasso(1 - (c && c.ridotto ? 1 : u)); },
          chiudi() { solVoloChiudi(); }
        };
      }
      lasciaMappa();
      if (vistaAttuale !== 'cielo') mostraVista('cielo', { conservaTempo: true });
      presentaCielo(c);
      window.apriSistemaSolare({
        voloManuale: true, annullato: () => c.chiuso,
        inquadra: () => {} // Il quadro successivo viene deciso dalla scena.
      });
      presentaSistema(c);
      // La vista pulita va spostata sul guscio della 3D **adesso**, non alla
      // scena dopo. Col cielo a schermo intero il guscio diventa figlio
      // diretto del riquadro del cielo, che è ancora marcato dalla scena di
      // prima: `.demo-scena-pulita > *` lo nascondeva, e restava visibile il
      // solo velo del volo. Mentre il velo sfumava, sotto non c'era la Terra
      // della scena ma la tela ferma del planetario — per un secondo e mezzo
      // ricompariva il cielo da cui si era appena decollati.
      applicaVistaPulita(c);
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
  const EVENTI = ['solar_eclipse', 'lunar_eclipse', 'march_equinox', 'june_solstice',
    'september_equinox', 'december_solstice'];
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
  const FUOCHI_SISTEMA = ['Sun', 'Earth', 'ISS', 'Voyager 1', 'Voyager 2', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  // Le sonde e i giganti sono i fuochi del racconto delle Voyager: la camera
  // ci gira attorno col perno (`sol.perno`), e da vicino — un flyby, il
  // modellino — lo zoom va molto oltre quello di una vista d'insieme.
  const FUOCHI_LONTANI = { 'Voyager 1': 'voyager1', 'Voyager 2': 'voyager2',
    Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune' };
  function elencoCorpiSistema(v) {
    if (v === undefined) return [];
    richiedi(typeof v === 'string' && v.length <= 120, err('elenco'));
    const nomi = v.split(',').map(x => x.trim()).filter(Boolean);
    richiedi(nomi.length >= 1 && nomi.length <= 9 && nomi.every(n => corpiSistema.includes(n)), err('corpiSistema'));
    return nomi;
  }
  // ------------------------------------------------------------------
  // La camera dei sorvoli (`frame_with`). Un flyby si capisce solo se nel
  // quadro ci sono insieme la sonda e il pianeta, ed è la sola cosa che una
  // camera fissa non può garantire: la distanza fra i due passa da milioni
  // di chilometri a qualche raggio del pianeta in poche ore. Allora la camera
  // si rifà a ogni fotogramma: il centro sta a metà fra la sonda e il bordo
  // lontano del pianeta, e lo zoom è quello che fa stare quel segmento in
  // poco più di un terzo del lato corto. Avvicinandosi, il pianeta cresce
  // sotto gli occhi e la curva della fionda gli gira attorno a grandezza
  // vera; allontanandosi, la camera arretra con lui. Con `auto` il corpo è
  // il più vicino, e fra due candidati il peso passa dall'uno all'altro con
  // continuità (l'inverso della sesta potenza della distanza): al cambio non
  // c'è nessun salto. Il moltiplicatore di `zoom_from`/`zoom_to` avvicina o
  // allontana da questa inquadratura, e avvicinando il centro scivola verso
  // la sonda, che così resta nel quadro anche quando il pianeta ne esce.
  // ------------------------------------------------------------------
  const SORVOLO_QUOTA = 0.32;   // dal centro al bordo dell'inquadratura, in lati corti
  const SORVOLO_ALZA = 0.04;    // il centro un po' più su: in basso ci sono i sottotitoli
  function inquadraSorvolo(p, idSonda, m) {
    solLeggiPosizioni(skyAdesso());
    const s = (sol.sonde || []).find(x => x.id === idSonda);
    if (!s || !s.pos) return;
    const P = s.pos;
    const candidati = (sol.pianeti || []).filter(b => p.frame_with === 'auto' || b.id === p.frame_with);
    const vicini = candidati.map(b => ({ b, d: Math.hypot(P.x - b.pos.x, P.y - b.pos.y, P.z - b.pos.z) }))
      .sort((x, y) => x.d - y.d).slice(0, p.frame_with === 'auto' ? 2 : 1);
    if (!vicini.length) return;
    sol.panX = 0; sol.panY = 0; solMisura();
    const ps = solProietta(solScena(P));
    const scala = Math.max(1e-12, sol.scala);
    let pesoTot = 0, logZ = 0, ox = 0, oy = 0;
    vicini.forEach(({ b, d }) => {
      const peso = 1 / Math.pow(Math.max(1e-12, d), 6);
      const pb = solProietta(solScena(b.pos));
      const dx = (pb.px - ps.px) / scala, dy = (pb.py - ps.py) / scala;
      const sep = Math.hypot(dx, dy);
      const rs = sol.misureVere ? (b.km || 0) / 2 / SOL_UA_KM / SOL_RIF_UA : (b.rDisegno || 4) / scala;
      const mezzo = Math.max((sep + rs) / 2 * 1.06, rs * 1.2, 1e-9);
      const ux = sep > 1e-15 ? dx / sep : 0, uy = sep > 1e-15 ? dy / sep : 0;
      logZ += peso * Math.log(SORVOLO_QUOTA / (0.44 * mezzo));
      ox += peso * ux * (sep + rs) / 2;
      oy += peso * uy * (sep + rs) / 2;
      pesoTot += peso;
    });
    logZ /= pesoTot; ox /= pesoTot; oy /= pesoTot;
    const verso = Math.min(1, 1 / Math.max(1e-6, m));
    solImpostaZoom(Math.exp(logZ) * m);
    sol.panX = 0; sol.panY = 0; solMisura();
    const q = solProietta(solScena(P));
    sol.panX = sol.cx - (q.px + ox * verso * sol.scala);
    sol.panY = sol.cy - SORVOLO_ALZA * Math.min(sol.L, sol.H) - (q.py + oy * verso * sol.scala);
  }
  // ------------------------------------------------------------------
  // La camera di gruppo (`keep`). Tiene nel quadro un elenco di corpi e di
  // sonde — la Terra e le due Voyager appena partite, le due sonde nella
  // corsa del sorpasso, le sonde con Giove davanti — e si rifà a ogni
  // fotogramma: il centro è il centro del rettangolo che li contiene, visto
  // dalla camera, e lo zoom quello che lo fa stare in `KEEP_QUOTA` del
  // riquadro. Le distanze cambiano mentre il tempo corre, e la camera le
  // insegue da sola: è la ripresa che segue l'azione invece di aspettarla.
  // `zoom_from`/`zoom_to` sono moltiplicatori di questa inquadratura.
  // ------------------------------------------------------------------
  const KEEP_QUOTA = 0.7;
  const KEEP_MARGINE_PX = 26;
  const FUOCHI_KEEP = ['Sun', 'Voyager 1', 'Voyager 2', ...corpiSistema];
  function elencoKeep(v) {
    richiedi(typeof v === 'string' && v.length <= 160, err('elenco'));
    const nomi = v.split(',').map(x => x.trim()).filter(Boolean);
    richiedi(nomi.length >= 1 && nomi.length <= 10 && nomi.every(n => FUOCHI_KEEP.includes(n)), err('corpiSistema'));
    return nomi;
  }
  function posizioneKeep(nome) {
    if (nome === 'Sun') return { x: 0, y: 0, z: 0 };
    if (FUOCHI_LONTANI[nome] && /^Voyager/.test(nome)) {
      const s = (sol.sonde || []).find(x => x.id === FUOCHI_LONTANI[nome]);
      return s && s.pos ? s.pos : null;
    }
    const b = (sol.pianeti || []).find(x => x.id === nome);
    return b ? b.pos : null;
  }
  function inquadraGruppo(nomi, m) {
    solLeggiPosizioni(skyAdesso());
    const assi = solAssiVista();
    const punti = nomi.map(posizioneKeep).filter(Boolean).map(p => solScena(p));
    if (!punti.length) return;
    const xs = punti.map(s => s.x * assi.destra[0] + s.y * assi.destra[1] + s.z * assi.destra[2]);
    const ys = punti.map(s => s.x * assi.alto[0] + s.y * assi.alto[1] + s.z * assi.alto[2]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const hx = Math.max(1e-12, (x1 - x0) / 2), hy = Math.max(1e-12, (y1 - y0) / 2);
    const scala = Math.min(Math.max(1, sol.L / 2 * KEEP_QUOTA - KEEP_MARGINE_PX) / hx,
      Math.max(1, sol.H / 2 * KEEP_QUOTA - KEEP_MARGINE_PX) / hy);
    solImpostaZoom(scala / (Math.min(sol.L, sol.H) * 0.44) * m);
    solMisura();
    const xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    sol.panX = -xc * sol.scala;
    sol.panY = yc * sol.scala - SORVOLO_ALZA * Math.min(sol.L, sol.H);
  }
  // Il punto della scena che sta al centro del quadro, ricavato dallo
  // spostamento: serve alle transizioni (`blend`) per partire da dove la
  // ripresa di prima aveva lasciato la camera.
  function centroDelQuadro() {
    solMisura();
    const assi = solAssiVista(), k = Math.max(1e-12, sol.scala);
    const a = -sol.panX / k, b = (sol.panY + SORVOLO_ALZA * Math.min(sol.L, sol.H)) / k;
    return [0, 1, 2].map(i => assi.destra[i] * a + assi.alto[i] * b);
  }
  function portaCentro(C) {
    solMisura();
    const assi = solAssiVista(), k = sol.scala;
    const dot = v => C[0] * v[0] + C[1] * v[1] + C[2] * v[2];
    sol.panX = -dot(assi.destra) * k;
    sol.panY = dot(assi.alto) * k - SORVOLO_ALZA * Math.min(sol.L, sol.H);
  }
  // Da dove si guarda un sorvolo. Con `flyby_tilt` la camera sta quasi sulla
  // normale al piano dell'iperbole — la curva della fionda si vede intera, non
  // di taglio — inclinata di tanti gradi verso il periasse; senza, guarda da
  // dietro la sonda, col Sole in alto: è la vista giusta per un viaggio lungo
  // fra più pianeti, dove nessun piano d'iperbole vale per tutta la scena.
  function vistaDelSorvolo(p, idSonda) {
    solLeggiPosizioni(skyAdesso());
    const s = (sol.sonde || []).find(x => x.id === idSonda);
    const ora = +skyAdesso();
    const v = typeof solViaggioVoyager === 'function' ? solViaggioVoyager(idSonda) : null;
    // `profile: show`: la camera guarda di traverso alla strada della sonda
    // rispetto al corpo, dalla parte del Sole. È la ripresa del lancio: la
    // sonda si stacca dal bordo del disco e sale dritta attraverso l'aria,
    // invece di venire verso chi guarda o allontanarsene — che è il modo in
    // cui l'uscita dall'atmosfera, vista di fronte, non si vedeva affatto.
    if (p.profile === 'show' && s && s.pos) {
      const corpo = (sol.pianeti || []).find(q => q.id === p.frame_with);
      if (corpo) {
        const d = solV.versore([s.pos.x - corpo.pos.x, s.pos.y - corpo.pos.y, s.pos.z - corpo.pos.z]);
        const sole = solV.versore([-corpo.pos.x, -corpo.pos.y, -corpo.pos.z]);
        let n = solV.meno(sole, solV.per(d, solV.punto(sole, d)));
        if (solV.lung(n) < 1e-6) n = solV.meno([0, 0, 1], solV.per(d, d[2]));
        n = solV.versore(n);
        return { az: Math.atan2(-n[0], -n[1]), elev: Math.asin(Math.max(-1, Math.min(1, n[2]))) / GRADI };
      }
    }
    if (p.flyby_tilt !== undefined && v) {
      const scelti = v.flyby.filter(f => p.frame_with === 'auto' || f.id === p.frame_with);
      const fb = scelti.sort((a, b) => Math.abs(a.ms - ora) - Math.abs(b.ms - ora))[0];
      if (fb) {
        // La normale dalla parte del Sole, e l'inclinazione verso di lui: così
        // il pianeta mostra la faccia del giorno invece del suo lato notte
        const pianeta = (sol.pianeti || []).find(q => q.id === fb.id);
        const sole = pianeta ? solV.versore([-pianeta.pos.x, -pianeta.pos.y, -pianeta.pos.z]) : [0, 0, 1];
        let n = solV.croce(fb.pHat, fb.qHat);
        if (solV.punto(n, sole) < 0) n = solV.per(n, -1);
        let verso = solV.meno(sole, solV.per(n, solV.punto(sole, n)));
        verso = solV.lung(verso) > 1e-6 ? solV.versore(verso) : fb.pHat;
        const a = p.flyby_tilt * GRADI;
        const d = solV.versore(solV.piu(solV.per(n, Math.cos(a)), solV.per(verso, Math.sin(a))));
        return { az: Math.atan2(-d[0], -d[1]), elev: Math.asin(Math.max(-1, Math.min(1, d[2]))) / GRADI };
      }
    }
    // Senza piano: dalla parte del Sole, così il pianeta che si avvicina
    // mostra la faccia illuminata e non il suo lato notte
    const pos = s && s.pos ? s.pos : { x: 1, y: 0 };
    return { az: Math.atan2(pos.x, pos.y), elev: 0 };
  }
  registro.camera_3d = {
    verifica(p) {
      campi(p, ['scene', 'focus', 'frame', 'orbit', 'elev_from', 'elev_to', 'zoom_from', 'zoom_to', 'sun_az', 'probe_az',
        'frame_with', 'flyby_tilt', 'zoom_start', 'keep', 'blend', 'profile']);
      richiedi(p.scene === 'earth_moon' || p.scene === 'system', err('scena3d'));
      richiedi((p.scene === 'earth_moon' ? FUOCHI_VICINO : FUOCHI_SISTEMA).includes(p.focus),
        err('fuoco', { nome: p.focus }));
      richiedi(p.orbit === undefined || numero(p.orbit, -720, 720), err('angolo'));
      for (const k of ['elev_from', 'elev_to'])
        richiedi(p[k] === undefined || numero(p[k], -85, 85), err('elevazione'));
      const zoomMax = FUOCHI_LONTANI[p.focus] ? 30000 : 60;
      for (const k of ['zoom_from', 'zoom_to'])
        richiedi(p[k] === undefined || numero(p[k], 0.1, zoomMax), err('zoom3d'));
      elencoCorpiSistema(p.frame);
      richiedi(p.sun_az === undefined || (p.scene === 'system' && p.focus === 'Earth' && numero(p.sun_az, -360, 360)),
        err('soleAz'));
      richiedi(p.probe_az === undefined || (/^Voyager/.test(p.focus || '') && numero(p.probe_az, -360, 360)),
        err('sondaAz'));
      richiedi(p.frame_with === undefined || (/^Voyager/.test(p.focus || '') && p.probe_az === undefined &&
        (p.frame_with === 'auto' || corpiSistema.includes(p.frame_with))), err('inquadraSonda'));
      richiedi(p.flyby_tilt === undefined || (p.frame_with !== undefined && p.frame_with !== 'Earth' &&
        numero(p.flyby_tilt, -85, 85)), err('inquadraSonda'));
      richiedi(p.zoom_start === undefined || numero(p.zoom_start, 0, 0.95), err('frazioneScena'));
      if (p.keep !== undefined) {
        richiedi(p.scene === 'system' && p.frame_with === undefined && p.probe_az === undefined, err('inquadraSonda'));
        elencoKeep(p.keep);
      }
      richiedi(p.blend === undefined || numero(p.blend, 0, 1), err('frazioneScena'));
      richiedi(p.profile === undefined || (MOSTRA.includes(p.profile) && p.frame_with !== undefined &&
        p.frame_with !== 'auto' && p.flyby_tilt === undefined), err('inquadraSonda'));
    },
    crea(p, c) {
      richiedi(sol.aperto, err('serve3d'));
      // La posa della ripresa di prima, per la transizione (`blend`)
      const prima = p.blend > 0 && !sol.vicino && p.scene === 'system'
        ? { zoom: sol.zoom, az: sol.az, elev: sol.elev, centro: centroDelQuadro() } : null;
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
        } else if (FUOCHI_LONTANI[p.focus]) {
          // Lo zoom di base mette il Sole sul bordo del quadro, visto dal
          // corpo: i moltiplicatori della scena partono da lì
          const id = FUOCHI_LONTANI[p.focus];
          const corpo = solCorpoDiId(id);
          richiedi(corpo, err('fuoco', { nome: p.focus }));
          sol.perno = id; sol.quadro = 'tutto'; sol.scelto = null;
          base = solZoomPer(Math.max(0.3, corpo.r || 1));
        } else {
          sol.perno = 'Earth'; sol.quadro = 'terra';
          // Come attorno al Sole: addosso alla Terra si racconta lei, e i
          // nomi di asteroidi e comete che passano dietro sarebbero rumore
          sol.mondiAccesi = false;
          const iss = (sol.satelliti || []).find(s => s.id === 'iss');
          if (p.focus === 'ISS') richiedi(iss, err('tle'));
          const z = p.focus === 'ISS' ? solZoomOrbitaSatellite(iss) : solZoomSullaTerra();
          base = z || sol.zoomVoluto;
        }
      }
      // `frame_with` è la camera dei sorvoli (vedi `inquadraSorvolo`): il
      // centro non è un corpo, lo calcola lei a ogni fotogramma
      const inquadra = p.frame_with !== undefined && !vicino;
      const idSonda = FUOCHI_LONTANI[p.focus];
      if (inquadra) {
        sol.perno = null;
        if (sol.grandTour) sol.grandTour.zoomLibero = true;
      }
      const gruppo = p.keep !== undefined && !vicino ? elencoKeep(p.keep) : null;
      if (gruppo) {
        sol.perno = null;
        if (sol.grandTour) sol.grandTour.zoomLibero = true;
      }
      const posaSorvolo = inquadra ? vistaDelSorvolo(p, idSonda) : null;
      const az0 = posaSorvolo ? posaSorvolo.az : sol.az;
      const elev0 = posaSorvolo ? posaSorvolo.elev : sol.elevVoluta; // la vista 3D tiene l'elevazione in gradi
      const ea = p.elev_from !== undefined ? p.elev_from : (inquadra ? 0 : elev0);
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
      // `sun_az` lega la camera al Sole invece che allo spazio: 0 vuol dire
      // «il Sole a sinistra della Terra, di fianco», 90 guardare la Terra
      // dalla parte del Sole (la faccia del giorno), −90 da quella della
      // notte. Si rifà a ogni fotogramma dalla posizione della Terra, così
      // mentre il tempo scorre la luce arriva sempre dallo stesso lato dello
      // schermo — ed è quello che rende confrontabili due solstizi.
      function azDiBase() {
        if (p.sun_az === undefined) return az0;
        solLeggiPosizioni(skyAdesso());
        const t = sol.terra;
        return t ? -Math.atan2(t.pos.y, t.pos.x) + p.sun_az * GRADI : az0;
      }
      // `probe_az` lega invece la camera alla sonda (solo coi fuochi Voyager):
      // la camera sta nella direzione cos(a)·y + sin(a)·z della terna della
      // sonda (`solTernaVoyager`) — 0 davanti al Disco d'Oro, 90 davanti
      // all'antenna, cioè dalla parte della Terra, −90 alle sue spalle — e da
      // lì `orbit` la fa girare e `elev_from`/`elev_to` si **sommano** alla
      // sua altezza sul piano. Serve perché la sonda è girata come la Terra
      // vuole, non come la camera vuole: la Voyager 1 sta trentacinque gradi
      // sopra il piano, e il fianco col disco guarda quasi in su.
      function posaSonda() {
        if (p.probe_az === undefined || typeof solTernaVoyager !== 'function') return null;
        solLeggiPosizioni(skyAdesso());
        const s = (sol.sonde || []).find(x => x.id === FUOCHI_LONTANI[p.focus]);
        if (!s) return null;
        const { Y, Z } = solTernaVoyager(s);
        const a = p.probe_az * GRADI;
        const d = [0, 1, 2].map(i => Y[i] * Math.cos(a) + Z[i] * Math.sin(a));
        // `verso` è (−sin az·cos e, −cos az·cos e, sin e): lo si allinea a d
        return { az: Math.atan2(-d[0], -d[1]), elev: Math.asin(Math.max(-1, Math.min(1, d[2]))) / GRADI };
      }
      const zs = p.zoom_start || 0;
      const pernoVoluto = sol.perno;
      // La transizione (`blend`): per la prima frazione della ripresa la
      // camera scivola dalla posa che la ripresa di prima le ha lasciato a
      // quella che questa vorrebbe — zoom in proporzione geometrica, azimut
      // per la via corta, il centro del quadro in linea retta nella scena.
      // Senza, fra due riprese della stessa scena ci sarebbe uno stacco.
      function applica(u) {
        applicaBersaglio(u);
        if (!prima) return;
        const w = rampa(c, u / p.blend);
        sol.perno = pernoVoluto;
        if (w >= 1) return;
        if (sol.perno) { solMisura(); solAggiornaPivot(); }
        const dopo = { zoom: sol.zoom, az: sol.az, elev: sol.elev, centro: centroDelQuadro() };
        sol.perno = null;
        const giroCorto = Math.atan2(Math.sin(dopo.az - prima.az), Math.cos(dopo.az - prima.az));
        sol.az = prima.az + giroCorto * w;
        sol.elev = sol.elevVoluta = mescola(prima.elev, dopo.elev, w);
        // Senza perno il tetto dello zoom sarebbe quello della vista d'insieme
        if (sol.grandTour) sol.grandTour.zoomLibero = true;
        solImpostaZoom(mescolaZoom(prima.zoom, dopo.zoom, w));
        // Il centro non va in linea retta: con lo zoom che cresce in
        // proporzione geometrica, a metà strada il bersaglio sarebbe fuori
        // dal quadro. Avvicinandosi è il **bersaglio** a scivolare verso il
        // centro a passo costante sullo schermo; allontanandosi è il punto di
        // partenza a lasciarlo a passo costante. Così la cosa che conta non
        // esce mai di scena.
        const s0 = prima.zoom, s1 = dopo.zoom, sw = sol.zoom;
        portaCentro([0, 1, 2].map(i => s1 >= s0
          ? dopo.centro[i] - (1 - w) * (dopo.centro[i] - prima.centro[i]) * s0 / sw
          : prima.centro[i] + w * (dopo.centro[i] - prima.centro[i]) * s1 / sw));
      }
      function applicaBersaglio(u) {
        const k = rampa(c, u);
        const kz = zs > 0 ? rampa(c, (u - zs) / (1 - zs)) : k;
        const posa = posaSonda();
        sol.az = (posa ? posa.az : azDiBase()) + (c.ridotto ? 0 : giro * k);
        if (gruppo) {
          sol.elev = sol.elevVoluta = Math.max(-85, Math.min(85, mescola(ea, eb, k)));
          inquadraGruppo(gruppo, mescolaZoom(za, zb, kz));
          return;
        }
        if (inquadra) {
          sol.elev = sol.elevVoluta = Math.max(-85, Math.min(85, elev0 + mescola(ea, eb, k)));
          inquadraSorvolo(p, idSonda, mescolaZoom(za, zb, kz));
          return;
        }
        sol.elev = sol.elevVoluta = Math.max(-85, Math.min(85, (posa ? posa.elev : 0) + mescola(ea, eb, k)));
        solImpostaZoom(base * mescolaZoom(za, zb, kz));
        centra();
      }
      applica(0);
      return {
        aggiorna(u) {
          if (!c.cameraManuale) { applica(u); return; }
          // Presa a mano, la camera dei sorvoli torna a girare attorno alla
          // sonda: senza un perno il dito la farebbe ruotare attorno al Sole
          if (inquadra && sol.perno !== idSonda) sol.perno = idSonda;
        }
      };
    }
  };

  // ------------------------------------------------------------------
  // Il banco delle aurore della Didattica, guidato dalla demo: il quadro
  // (vento, scudo, scarica, anello), il pezzo di storia da far scorrere
  // (in ore dall'eruzione) e la camera che gira attorno alla Terra. Sono
  // gli stessi disegni del banco: la regia sceglie solo cosa guardare, da
  // dove e quando.
  // ------------------------------------------------------------------
  // `taglio` è il quinto quadro del banco: la sezione della Terra vista di
  // lato, coi colori dell'aurora alle loro quote. Non ha una camera (è un
  // disegno piano); ha invece un luogo (`place`, uno di quelli del banco) e
  // un Kp (`kp`), e sono quelli che decidono cosa se ne vede da lì.
  const CAPITOLI = ['vento', 'scudo', 'scarica', 'anello', 'taglio'];
  registro.aurora_lesson = {
    verifica(p) {
      campi(p, ['chapter', 'from', 'to', 'orbit', 'elev_from', 'elev_to', 'zoom_from', 'zoom_to', 'place', 'kp']);
      richiedi(CAPITOLI.includes(p.chapter), err('capitolo', { nome: p.chapter }));
      richiedi(p.kp === undefined || numero(p.kp, 0, 9), err('kp'));
      richiedi(p.place === undefined || (typeof didDemo !== 'undefined' && typeof didDemo.luoghi === 'function'
        ? didDemo.luoghi().includes(p.place) : typeof p.place === 'string'), err('luogoBanco', { nome: p.place }));
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
      if (p.place !== undefined || p.kp !== undefined) didDemo.taglio(p.place, p.kp);
      const posa = didDemo.posa(p.chapter);
      const conCamera = Number.isFinite(posa.az) && Number.isFinite(posa.elev);
      const da = p.from !== undefined ? p.from : posa.finestra[0];
      const a = p.to !== undefined ? p.to : posa.finestra[1];
      const ea = p.elev_from !== undefined ? p.elev_from : posa.elev;
      const eb = p.elev_to !== undefined ? p.elev_to : ea;
      const za = p.zoom_from !== undefined ? p.zoom_from : 1;
      const zb = p.zoom_to !== undefined ? p.zoom_to : za;
      const aggiorna = u => {
        const k = rampa(c, u);
        const passo = { quadro: p.chapter, t: mescola(da, a, u) };
        if (conCamera && !c.cameraManuale) Object.assign(passo, {
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
  // `from` e `to` (frazioni fra 0 e 1 della finestra, margini compresi)
  // scelgono un pezzo del passaggio: così più scene raccontano lo stesso
  // passaggio a capitoli — l'arco intero, il culmine da vicino, il congedo —
  // senza che nessuna debba sapere a che ora cade. `track` insegue la
  // stazione con quel campo in gradi: è il solo modo di vederne il modellino
  // (a un grado scarso di campo la ISS è larga una decina di pixel), e lì le
  // stelle che scorrono dietro sono la cosa giusta da vedere, perché è
  // quello che si vede in un telescopio che la insegue.
  registro.satellite_pass = {
    verifica(p) {
      campi(p, ['satellite', 'before', 'after', 'from', 'to', 'track']);
      richiedi(p.satellite === 'iss' || p.satellite === 'tiangong', err('satellite', { nome: p.satellite }));
      for (const k of ['before', 'after']) richiedi(p[k] === undefined || numero(p[k], 0, 15), err('margine'));
      for (const k of ['from', 'to']) richiedi(p[k] === undefined || numero(p[k], 0, 1), err('frazionePassaggio'));
      richiedi((p.from === undefined ? 0 : p.from) < (p.to === undefined ? 1 : p.to), err('frazionePassaggio'));
      richiedi(p.track === undefined || numero(p.track, 0.25, 160), err('fov'));
    },
    crea(p, c, scena) {
      const pas = passaggio(c, p.satellite);
      const w0 = pas.inizio - (p.before || 0) * 60000;
      const w1 = pas.fine + (p.after || 0) * 60000;
      const inizio = w0 + (w1 - w0) * (p.from === undefined ? 0 : p.from);
      const fine = w0 + (w1 - w0) * (p.to === undefined ? 1 : p.to);
      const aggiorna = u => istante(inizio + (fine - inizio) * u);
      aggiorna(0);
      if (scena.vista === 'planetarium_view' && p.track !== undefined) {
        sky.mostraSatelliti = true; sky.mostraTraccia = true; sky.mostraSottoOrizzonte = true;
        skyAggiornaTastiFiltri();
        const rec = satRecDi(pas.sat), gd = satOsservatoreGd(pas.luogo);
        // La direzione si chiede a SGP4 per l'istante di adesso, non a
        // `sky.oggetti`: a un grado di campo anche un fotogramma di ritardo
        // porterebbe la stazione fuori dal quadro.
        const insegui = () => {
          const q = satAltAz(rec, skyAdesso(), gd);
          if (q) puntaCamera(q.az, q.alt, p.track, true);
        };
        insegui();
        skyAggiornaOggetti(true);
        sky.target = 'sat-' + p.satellite; sky.inseguimento = false; sky.centraQuandoPronto = null;
        return { aggiorna(u) {
          aggiorna(u);
          if (!c.cameraManuale) insegui();
        } };
      }
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
  // L'asse della Terra messo in evidenza nella vista 3D (solo nelle scene
  // `solar_system_3d`): l'asse vero coi due poli, la perpendicolare al piano
  // dell'orbita con l'angolo fra le due, l'equatore e — con `parallel` — il
  // parallelo di un luogo, caldo dove è giorno e freddo dove è notte. La
  // parte calda di quel cerchio è la durata del giorno a quella latitudine.
  // Il disegno è `solDisegnaAsseTerra` in app.js; qui si accende e si spegne.
  // ------------------------------------------------------------------
  registro.earth_axis = {
    verifica(p) {
      campi(p, ['parallel']);
      richiedi(p.parallel === undefined || numero(p.parallel, -89, 89), err('parallelo'));
    },
    crea(p) {
      sol.evidenziaAsse = { parallelo: p.parallel !== undefined ? p.parallel : null };
      return { chiudi() { sol.evidenziaAsse = null; } };
    }
  };

  // ------------------------------------------------------------------
  // Il viaggio delle Voyager (solo in `solar_system_3d`). Tiene il tempo da
  // una data all'altra — anche decenni: il Grand Tour dura dodici anni e la
  // fuga ne dura altri trentacinque — e accende nella vista 3D le scie del
  // viaggio vero, le date degli incontri e il modellino delle sonde, grande
  // quanto la regia vuole (`model_from`/`model_to`, frazioni del lato corto
  // dello schermo: non è una scala, a scala vera una sonda è invisibile).
  // `scale: real` passa a distanze e dimensioni reali, ed è quello che serve
  // da vicino a un pianeta: la curva del flyby attorno a un Giove della sua
  // misura vera. Va scritta **prima** di `camera_3d`, perché lo zoom di base
  // della camera si misura col metro delle distanze. Il disegno è
  // `solDisegnaGrandTour` in app.js; le posizioni sono `solPosizioneVoyager`.
  // ------------------------------------------------------------------
  const SONDE_VOYAGER = ['voyager1', 'voyager2'];
  const VIAGGIO_MAX_MS = 80 * 366 * 86400000;
  // Le date del viaggio accettano anche `now`, `now+365d`, `now-280d`: le
  // scene che raccontano dove sono le sonde «oggi» partono dal giorno in cui
  // la demo si guarda, arrotondato alla mezzanotte UTC.
  function dataViaggio(v) {
    const m = typeof v === 'string' && /^now(?:([+-])(\d{1,5})d)?$/.exec(v);
    if (!m) return dataISO({ iso: v });
    const oggi = new Date();
    const giorni = m[1] ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : 0;
    return new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate() + giorni));
  }
  function viaggioVoyager(p) {
    campi(p, ['from', 'to', 'probes', 'model_from', 'model_to', 'model_end', 'future', 'scale', 'milestones', 'ease',
      'home', 'gaze', 'record', 'proportion', 'trail', 'ease_rate', 'launch', 'race', 'model_start']);
    const a = dataViaggio(p.from), b = dataViaggio(p.to);
    richiedi(+b > +a && +b - +a <= VIAGGIO_MAX_MS && a.getUTCFullYear() >= 1977 && b.getUTCFullYear() <= 2100,
      err('viaggio'));
    const sonde = p.probes === undefined ? SONDE_VOYAGER.slice()
      : String(p.probes).split(',').map(x => x.trim()).filter(Boolean);
    richiedi(sonde.length >= 1 && sonde.every(s => SONDE_VOYAGER.includes(s)), err('sonde'));
    for (const k of ['model_from', 'model_to'])
      richiedi(p[k] === undefined || numero(p[k], 0, 6), err('modello'));
    richiedi(p.model_end === undefined || numero(p.model_end, 0.05, 1), err('frazioneScena'));
    richiedi(p.model_start === undefined || (numero(p.model_start, 0, 0.95) && p.model_start < (p.model_end || 1)),
      err('frazioneScena'));
    for (const k of ['future', 'milestones', 'home', 'gaze', 'record', 'launch', 'race'])
      richiedi(p[k] === undefined || MOSTRA.includes(p[k]), err('mostra', { nome: k }));
    richiedi(p.scale === undefined || p.scale === 'real' || p.scale === 'compressed', err('scala3d'));
    richiedi(p.ease === undefined || ['linear', 'smooth', 'flyby', 'log'].includes(p.ease), err('andatura'));
    richiedi(p.ease_rate === undefined || (p.ease === 'log' && numero(p.ease_rate, 2, 1e9)), err('andatura'));
    richiedi(p.proportion === undefined || p.proportion === 'bodies' || p.proportion === 'free', err('proporzione'));
    richiedi(p.trail === undefined || p.trail === 'sun' || p.trail === 'earth', err('scia'));
    return { a: +a, b: +b, sonde };
  }
  // L'orologio del viaggio. `linear` e `smooth` sono quelli di sempre; gli
  // altri due servono a vedere quello che in un tempo uniforme non si vede.
  // `log` parte dall'istante iniziale e accelera in progressione geometrica:
  // è il lancio, dove nelle prime ore la sonda si stacca dalla Terra e nei
  // giorni dopo si allontana di milioni di chilometri. `flyby` rallenta
  // attorno al massimo avvicinamento di ogni sorvolo della scena: un
  // passaggio ravvicinato dura un'ora su un viaggio di anni, e a passo
  // uniforme sarebbe un fotogramma. Attorno a ogni perielio il tempo scorre
  // con densità (|Δt| + T)^−1,3, con T il tempo che la sonda impiega a
  // percorrere un perielio: lontano dal pianeta i giorni volano, vicino i
  // minuti si allungano, e il passaggio dalla prima andatura alla seconda è
  // continuo. Il resto della scena va a passo costante.
  // `ease_rate` dice quanto è ripida la progressione di `log` (di serie
  // seicento): più è alto, più a lungo si resta sui primi minuti — il lancio
  // vuole vedere la sonda attraversare l'aria, che in questo modello dura
  // pochi secondi su un viaggio di giorni.
  function orologioDelViaggio(ease, a, b, sonde, rate) {
    if (ease === 'smooth') return u => a + (b - a) * rampa(null, u);
    if (ease === 'log') {
      const r = rate || 600;
      return u => a + (b - a) * (Math.pow(r, Math.max(0, Math.min(1, u))) - 1) / (r - 1);
    }
    if (ease !== 'flyby') return u => a + (b - a) * u;
    const giorno = 86400000, span = b - a;
    const nuclei = [];
    sonde.forEach(id => {
      const v = typeof solViaggioVoyager === 'function' ? solViaggioVoyager(id) : null;
      if (!v) return;
      v.flyby.forEach((fb, i) => {
        const inc = SOL_VIAGGI_VOYAGER[id].incontri[i];
        const rp = fb.perielioKm, vp = Math.sqrt(fb.vInfKms * fb.vInfKms + 2 * inc.mu / rp);
        const T = Math.max(600000, rp / vp * 1000);
        const W = span < 10 * giorno ? span * 0.6 : 40 * giorno;
        if (fb.ms < a - W || fb.ms > b + W) return;
        nuclei.push({ ms: fb.ms, T, W });
      });
    });
    if (!nuclei.length) return u => a + (b - a) * u;
    const nucleo = (n, t) => {
      const x = Math.abs(t - n.ms) / n.W;
      if (x >= 1) return 0;
      const q = 1 - x * x;
      return Math.pow(Math.abs(t - n.ms) + n.T, -1.3) * q * q;
    };
    // I campioni: uniformi sulla scena più una scala geometrica attorno a
    // ogni perielio, che è dove la densità cambia in fretta
    const tempi = [];
    for (let i = 0; i <= 800; i++) tempi.push(a + span * i / 800);
    nuclei.forEach(n => {
      for (let i = 0; i <= 260; i++) {
        const d = n.T * (Math.pow(n.W / n.T + 1, i / 260) - 1);
        tempi.push(n.ms - d, n.ms + d);
      }
    });
    const t = tempi.filter(x => x >= a && x <= b).sort((x, y) => x - y);
    // Il peso di ogni nucleo è normalizzato sul suo supporto intero: un
    // sorvolo che cade appena fuori dalla scena ne prende solo la sua parte
    const massa = n => { let m = 0; const passi = 2000; let prima = nucleo(n, n.ms);
      for (let i = 1; i <= passi; i++) {
        const d = n.T * (Math.pow(n.W / n.T + 1, i / passi) - 1), dPrima = n.T * (Math.pow(n.W / n.T + 1, (i - 1) / passi) - 1);
        const ora = nucleo(n, n.ms + d); m += (ora + prima) / 2 * (d - dPrima); prima = ora;
      }
      return 2 * m; };
    const quota = (span < 10 * giorno ? 0.88 : 0.62) / nuclei.length;
    nuclei.forEach(n => { n.peso = quota / Math.max(1e-30, massa(n)); });
    const base = (span < 10 * giorno ? 0.12 : 0.38) / span;
    const densita = x => nuclei.reduce((acc, n) => acc + n.peso * nucleo(n, x), base);
    const somma = [0];
    for (let i = 1; i < t.length; i++) somma.push(somma[i - 1] + (densita(t[i]) + densita(t[i - 1])) / 2 * (t[i] - t[i - 1]));
    const tot = somma[somma.length - 1] || 1;
    return u => {
      const y = Math.max(0, Math.min(1, u)) * tot;
      let lo = 0, hi = somma.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (somma[m] < y) lo = m; else hi = m; }
      const f = somma[hi] > somma[lo] ? (y - somma[lo]) / (somma[hi] - somma[lo]) : 0;
      return t[lo] + (t[hi] - t[lo]) * f;
    };
  }
  registro.voyager_journey = {
    verifica: viaggioVoyager,
    crea(p, c) {
      richiedi(sol.aperto, err('serve3d'));
      const { a, b, sonde } = viaggioVoyager(p);
      const reale = p.scale === 'real';
      sol.distanzeVere = reale; sol.misureVere = reale;
      sol.mondiAccesi = false; sol.sondeAccese = true;
      const ma = p.model_from !== undefined ? p.model_from : 0.03;
      const mb = p.model_to !== undefined ? p.model_to : ma;
      sol.grandTour = { sonde, futuro: p.future === 'show', incontri: p.milestones !== 'hide', misura: ma,
        casa: p.home === 'show', sguardo: p.gaze === 'show', disco: p.record === 'show', discoCentro: 0,
        proporzioni: p.proportion !== 'free', sciaTerra: p.trail === 'earth',
        atmosfera: p.launch === 'show', gara: p.race === 'show' };
      const tempo = orologioDelViaggio(p.ease, a, b, sonde, p.ease_rate);
      // `model_start`/`model_end`: in che tratto del viaggio il modellino
      // passa da `model_from` a `model_to` (prima e dopo resta fermo). Il
      // lancio lo tiene un segno finché la camera inquadra le due sonde
      // lontane, e lo fa crescere solo quando la camera va da lei.
      const fineModello = p.model_end || 1, inizioModello = p.model_start || 0;
      const aggiorna = u => {
        istante(tempo(u));
        if (!sol.grandTour) return;
        sol.sondeAccese = true;
        const km = rampa(c, (u - inizioModello) / (fineModello - inizioModello));
        // Grande in proporzione geometrica: la camera che si avvicina alla
        // sonda la vede crescere così, non a passo costante
        sol.grandTour.misura = ma > 0 && mb > 0 ? mescolaZoom(ma, mb, km) : mescola(ma, mb, km);
        if (sol.grandTour.disco) sol.grandTour.discoCentro = mb > ma ? km : 0;
      };
      aggiorna(0);
      return { aggiorna, chiudi() { sol.grandTour = null; } };
    }
  };

  // ------------------------------------------------------------------
  // Il Disco d'Oro com'è davvero (solo in `solar_system_3d`, con
  // `voyager_journey { record: show }`): la fotografia della copertina,
  // appoggiata accanto alla sonda, e un filo dorato dal disco del modellino
  // alla fotografia — è quello che lega l'oggetto vero al punto della sonda
  // in cui sta. Le candidate sono le immagini della NASA su Wikimedia
  // Commons (pubblico dominio), poi l'immagine di apertura della voce di
  // Wikipedia; se la rete non risponde, un'illustrazione delle stesse
  // incisioni disegnata qui, con scritto che è un'illustrazione. `at` è la
  // frazione della scena in cui la scheda compare.
  // ------------------------------------------------------------------
  const DISCO_FOTO = [
    'https://commons.wikimedia.org/wiki/Special:FilePath/The_Sounds_of_Earth_Record_Cover_-_GPN-2000-001978.jpg?width=480',
    'https://commons.wikimedia.org/wiki/Special:FilePath/The_Sounds_of_Earth_-_GPN-2000-001976.jpg?width=480'
  ];
  const DISCO_VOCE = 'https://en.wikipedia.org/api/rest_v1/page/summary/Voyager_Golden_Record';
  // Le incisioni della copertina, come nel modellino (`solDisegnaFacciaDisco`)
  const DISCO_SVG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220">' +
    '<defs><radialGradient id="o" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fbe7a1"/>' +
    '<stop offset=".55" stop-color="#d6a648"/><stop offset="1" stop-color="#8a6420"/></radialGradient></defs>' +
    '<rect x="-110" y="-110" width="220" height="220" fill="#0b1020"/>' +
    '<circle r="100" fill="url(#o)" stroke="#6b4a12" stroke-width="2"/>' +
    '<g fill="none" stroke="#5a3d0c" stroke-width="1.6" opacity=".8">' +
    '<circle cx="-42" cy="-38" r="26"/><circle cx="-42" cy="-38" r="18"/><circle cx="-42" cy="-38" r="10"/>' +
    '<path d="M-12 -66 L-50 -30"/><path d="M18 -48 l4.5 -7 4.5 14 4.5 -14 4.5 14 4.5 -14 4.5 14 4.5 -14 4.5 14 4.5 -14 4.5 14 4.5 -7"/>' +
    '<rect x="24" y="-34" width="36" height="26"/>' +
    Array.from({ length: 14 }, (_, i) => {
      const a = i * 2 * Math.PI / 14 + 0.3, l = 12 + 20 * ((i * 7) % 5) / 4;
      return `<path d="M-38 40 L${(-38 + l * Math.cos(a)).toFixed(1)} ${(40 + l * Math.sin(a)).toFixed(1)}"/>`;
    }).join('') +
    '<circle cx="32" cy="42" r="8"/><circle cx="58" cy="42" r="8"/><path d="M40 42 H50"/>' +
    '</g><circle r="4.5" fill="#3d2a08"/></svg>');
  let discoFotoTrovata = null;   // la prima candidata che ha risposto, per le scene dopo
  registro.golden_record = {
    verifica(p) {
      campi(p, ['at']);
      richiedi(p.at === undefined || numero(p.at, 0, 0.95), err('frazioneScena'));
    },
    crea(p) {
      richiedi(sol.aperto, err('serve3d'));
      const quando = p.at || 0;
      const scheda = document.createElement('figure');
      scheda.id = 'demo-immagine'; scheda.className = 'demo-immagine';
      scheda.setAttribute('role', 'note');
      const cornice = document.createElement('div'); cornice.className = 'demo-immagine-cornice';
      const img = document.createElement('img');
      img.alt = astroI18n.t('demo.disco.alt'); img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      const didascalia = document.createElement('figcaption');
      const titolo = document.createElement('span'); titolo.className = 'demo-immagine-titolo';
      const credito = document.createElement('span'); credito.className = 'demo-immagine-credito';
      titolo.textContent = astroI18n.t('demo.disco.didascalia');
      didascalia.append(titolo, credito);
      cornice.append(img); scheda.append(cornice, didascalia);
      const candidate = discoFotoTrovata ? [discoFotoTrovata] : DISCO_FOTO.slice();
      let chiusa = false, voceChiesta = false;
      const metti = (src, illustrazione) => {
        img.dataset.illustrazione = illustrazione ? '1' : '';
        credito.textContent = astroI18n.t(illustrazione ? 'demo.disco.illustrazione' : 'demo.disco.credito');
        img.src = src;
      };
      const prossima = () => {
        if (chiusa) return;
        if (candidate.length) { metti(candidate.shift(), false); return; }
        if (!voceChiesta) {
          voceChiesta = true;
          fetch(DISCO_VOCE).then(r => (r.ok ? r.json() : null)).then(d => {
            const src = d && ((d.thumbnail && d.thumbnail.source) || (d.originalimage && d.originalimage.source));
            if (src) candidate.push(src);
            prossima();
          }).catch(() => prossima());
          return;
        }
        metti(DISCO_SVG, true);
      };
      img.addEventListener('error', () => { if (img.dataset.illustrazione !== '1') prossima(); });
      img.addEventListener('load', () => {
        if (img.dataset.illustrazione !== '1' && !img.src.startsWith('data:')) discoFotoTrovata = img.src;
      });
      prossima();
      const genitore = genitoreDemo();
      if (genitore) genitore.append(scheda);
      const aggiorna = u => {
        const visibile = u >= quando;
        scheda.classList.toggle('visibile', visibile);
        const gt = sol.grandTour;
        if (!gt) return;
        gt.discoForza = Math.max(0, Math.min(1, (u - quando * 0.6) / 0.12));
        // Il capo del filo: il bordo sinistro della fotografia, in pixel
        // della tela della vista 3D
        if (visibile && sol.canvas) {
          const t = sol.canvas.getBoundingClientRect(), r = cornice.getBoundingClientRect();
          gt.discoFilo = r.width ? { x0: r.left - t.left, y0: r.top - t.top, x1: r.right - t.left, y1: r.bottom - t.top } : null;
        } else gt.discoFilo = null;
      };
      aggiorna(0);
      return {
        aggiorna,
        chiudi() {
          chiusa = true;
          scheda.remove();
          if (sol.grandTour) { sol.grandTour.discoFilo = null; }
        }
      };
    }
  };

  // Dove stanno le Voyager stasera, nel planetario: due mirini col nome,
  // la distanza e le ore di luce (`skyDisegnaSondeInCielo` in app.js).
  registro.probe_markers = {
    verifica(p) { campi(p, []); },
    crea() {
      sky.sondeInCielo = true;
      return { chiudi() { sky.sondeInCielo = false; } };
    }
  };

  // ------------------------------------------------------------------
  // La scala cosmica (solo in `solar_system_3d`): il quarto quadro della
  // vista 3D, oltre i pianeti, guidato dal racconto (`scala-cosmica.js`).
  // Tolta nella v401 insieme alle scene cosmiche della demo delle Voyager,
  // è tornata nella v402 per la demo «Dalla Terra all'universo», senza il
  // futuro delle sonde (che stanno sempre al posto di oggi).
  // `from`/`to` sono la scala d'inizio e di fine — un numero (metà del lato
  // corto dello schermo, in UA) o un nome: planets, kuiper, heliopause, oort,
  // local_cloud, local_bubble, orion_arm, milky_way, local_group, virgo,
  // laniakea, universe, o voyager (le sonde di oggi). La scala scorre in
  // progressione geometrica — ogni secondo moltiplica le distanze per lo
  // stesso fattore, ed è quello che fa sentire quante sono le decade —; con
  // `ease: stops` si ferma un istante su ogni struttura che incontra, e
  // quella che sta guardando si accende. `focus` accende una struttura per
  // tutta la scena; `zoom_start`/`zoom_end` dicono in che tratto della scena
  // si muove la scala; `center: sun` tiene il Sole in mezzo. La camera della
  // carta: `elev_from`/`elev_to` (90 = a picco, gradi) e `orbit` (quanti
  // gradi gira attorno alla normale in tutta la scena). L'orologio va a oggi.
  // ------------------------------------------------------------------
  const COSMO_FACILITA = ['smooth', 'linear', 'stops'];
  function scalaCosmica(v) {
    // Un numero di UA: dalla Terra (un decimillesimo, v412: lo Studio delle
    // storie divide il viaggio della camera fra i momenti) all'universo
    if (typeof v === 'number') { richiedi(numero(v, 1e-6, 1e17), err('scalaCosmica')); return Math.log10(v); }
    richiedi(typeof v === 'string' && typeof cosmLDi === 'function', err('scalaCosmica'));
    const L = cosmLDi(v);
    richiedi(Number.isFinite(L), err('scalaCosmica'));
    return L;
  }
  function strutturaCosmica(v) {
    richiedi(typeof v === 'string' && typeof cosmStrutture === 'function', err('scalaCosmica'));
    const s = cosmStrutture().find(x => x.demo === v || x.id === v);
    richiedi(!!s, err('scalaCosmica'));
    return s;
  }
  registro.cosmic_scale = {
    verifica(p) {
      campi(p, ['from', 'to', 'ease', 'focus', 'zoom_start', 'zoom_end', 'center', 'orbit', 'elev_from', 'elev_to']);
      if (p.center !== undefined) richiedi(p.center === 'sun', err('scalaCosmica'));
      scalaCosmica(p.from === undefined ? 'voyager' : p.from);
      scalaCosmica(p.to === undefined ? (p.from === undefined ? 'voyager' : p.from) : p.to);
      if (p.ease !== undefined) richiedi(COSMO_FACILITA.includes(p.ease), err('andaturaCosmica'));
      if (p.focus !== undefined) strutturaCosmica(p.focus);
      for (const k of ['zoom_start', 'zoom_end']) if (p[k] !== undefined) richiedi(numero(p[k], 0, 1), err('frazioneScena'));
      richiedi((p.zoom_start || 0) < (p.zoom_end === undefined ? 1 : p.zoom_end), err('frazioneScena'));
      richiedi(p.orbit === undefined || numero(p.orbit, -720, 720), err('angolo'));
      for (const k of ['elev_from', 'elev_to'])
        richiedi(p[k] === undefined || numero(p[k], 5, 90), err('elevazioneCosmica'));
    },
    crea(p, c) {
      richiedi(sol.aperto && typeof cosmRegia === 'function', err('serve3d'));
      const da = p.from === undefined ? 'voyager' : p.from;
      const La = scalaCosmica(da), Lb = scalaCosmica(p.to === undefined ? da : p.to);
      const zs = p.zoom_start || 0, ze = p.zoom_end === undefined ? 1 : p.zoom_end;
      const fuoco = p.focus !== undefined ? strutturaCosmica(p.focus).id : null;
      // La camera parte da dove l'ha lasciata la scena di prima, se la scala
      // cosmica era già aperta: due scene di fila sono un volo solo. Con
      // `from: arrival` (v404) la scena prima era la vista 3D addosso alla
      // Terra, e la carta ne prende la camera: lo stesso giro e la stessa
      // inclinazione, così il passaggio dall'una all'altra non si vede
      const aperta = typeof cosm !== 'undefined' && cosm.attivo;
      const daArrivo = da === 'arrival' && !aperta;
      const ea = p.elev_from === undefined
        ? (daArrivo ? Math.max(5, Math.min(90, sol.elev)) : (p.elev_to === undefined ? 90 : p.elev_to)) : p.elev_from;
      const eb = p.elev_to === undefined ? ea : p.elev_to;
      const giro = (p.orbit || 0) * GRADI;
      const azBase = aperta ? cosm.az : (daArrivo ? sol.az : 0);
      // L'istante della carta è quello del racconto, fermo per tutto il
      // viaggio: da quando la scala comincia dalla Terra (v404) un salto
      // d'orologio fra la vista 3D e la carta si vedrebbe — la Terra gira,
      // e il confine fra il giorno e la notte con lei
      const oggi = aperta && Number.isFinite(cosm.baseMs) ? cosm.baseMs : skyAdesso().getTime();
      // Le soste (`ease: stops`): le strutture che cadono fra le due scale,
      // in ordine di percorrenza; ogni tratto prende lo stesso tempo e parte
      // e arriva fermo
      const tappe = [La];
      if (p.ease === 'stops') {
        const dentro = cosmStrutture().map(x => x.L)
          .filter(L => (L - La) * (Lb - La) > 0 && Math.abs(L - La) < Math.abs(Lb - La) - 0.05 && Math.abs(L - La) > 0.05)
          .sort((x, y) => (Lb > La ? x - y : y - x));
        tappe.push(...dentro);
      }
      tappe.push(Lb);
      const scala = k => {
        if (p.ease === 'linear') return La + (Lb - La) * k;
        if (p.ease !== 'stops') return La + (Lb - La) * solVoloRampa(k);
        const n = tappe.length - 1, x = Math.min(n - 1e-9, k * n), i = Math.floor(x), f = x - i;
        return tappe[i] + (tappe[i + 1] - tappe[i]) * f * f * (3 - 2 * f);
      };
      const aggiorna = u => {
        const ridotto = !!(c && c.ridotto);
        const k = ridotto ? 1 : Math.max(0, Math.min(1, (u - zs) / (ze - zs)));
        const L = scala(k);
        let evidenza = fuoco;
        if (!evidenza && p.ease === 'stops' && typeof cosmStrutturaDellaScala === 'function') {
          const s = cosmStrutturaDellaScala(L);
          evidenza = s ? s.id : null;
        }
        const manuale = !!(c && c.cameraManuale);
        const r = ridotto ? 1 : solVoloRampa(Math.max(0, Math.min(1, u)));
        cosmRegia({ L, anni: 0, baseMs: oggi, evidenza, manuale,
          pan: manuale ? undefined : { x: 0, y: 0 }, centraSole: !manuale && p.center === 'sun',
          az: manuale ? undefined : azBase + giro * r, elev: manuale ? undefined : ea + (eb - ea) * r });
      };
      aggiorna(0);
      // Chiudendo si lascia la carta aperta per un istante: se la scena dopo
      // è ancora la scala cosmica, la riprende da qui (un volo solo); se no
      // si torna ai pianeti
      return { aggiorna, chiudi() {
        cosmRegia(null);
        setTimeout(() => { if (cosm.attivo && !cosm.regia && typeof cosmEsci === 'function') cosmEsci(); }, 0);
      } };
    }
  };

  // ------------------------------------------------------------------
  // Gli archi interi del Sole in uno o più giorni, nello stesso cielo (solo
  // nel planetario). `dates` sono giorni civili del luogo del cielo,
  // 'AAAA-MM-GG' separati da virgole, da uno a quattro. Il disegno è
  // `skyDisegnaArchiSole` in app.js.
  // ------------------------------------------------------------------
  function giorniDemo(v) {
    richiedi(typeof v === 'string' && v.length <= 60, err('giorni'));
    const giorni = v.split(',').map(x => x.trim()).filter(Boolean);
    richiedi(giorni.length >= 1 && giorni.length <= 4 && giorni.every(g => /^\d{4}-\d{2}-\d{2}$/.test(g) &&
      Number.isFinite(Date.parse(g + 'T00:00:00Z')) && new Date(g + 'T00:00:00Z').toISOString().slice(0, 10) === g),
    err('giorni'));
    return giorni;
  }
  registro.sun_paths = {
    verifica(p) { campi(p, ['dates']); giorniDemo(p.dates); },
    crea(p) {
      sky.mostraSoleLuna = true;
      sky.archiSole = { date: giorniDemo(p.dates) };
      return { chiudi() { sky.archiSole = null; } };
    }
  };

  // ------------------------------------------------------------------
  // Il cartello della data: che giorno è, scritto grande in cima allo
  // schermo per tutta la scena, e che segue l'orologio del racconto mentre
  // scorre. In una demo che salta fra giugno, dicembre e marzo la data non
  // può restare un parametro interno: è la prima cosa che chi guarda deve
  // sapere. Sopra c'è un'etichetta (`label`, una chiave del dizionario, o
  // `text` scritto a mano), sotto l'ora e il luogo (`time: hide` per
  // toglierli), e a richiesta due righe che il cielo non scrive da sé:
  // `sun: show` — alba, tramonto, durata del giorno e altezza del Sole a
  // mezzogiorno in quel luogo, in quel giorno — e `distance: show`, quanto
  // dista la Terra dal Sole in quell'istante.
  // ------------------------------------------------------------------
  const MOSTRA = ['show', 'hide'];
  registro.date_card = {
    verifica(p) {
      campi(p, ['label', 'text', 'date', 'time', 'place', 'sun', 'distance']);
      if (p.label !== undefined)
        richiedi(typeof p.label === 'string' && /^[\w.-]+$/.test(p.label) && astroI18n.esiste(p.label),
          err('etichetta', { id: p.label }));
      if (p.text !== undefined)
        richiedi(typeof p.text === 'string' && p.text.trim() && p.text.length <= 80, err('cartelloTesto'));
      for (const k of ['date', 'time', 'place', 'sun', 'distance'])
        richiedi(p[k] === undefined || MOSTRA.includes(p[k]), err('mostra', { nome: k }));
    },
    crea(p) {
      cartello.dataset.chiave = '';
      cartello.dataset.etichetta = p.label || '';
      cartello.dataset.testo = typeof p.text === 'string' ? p.text : '';
      // Di serie il cartello dice solo la sua scritta (v414): nelle storie la
      // data di una sera scelta per il cielo («Domenica 13 dicembre 2026»)
      // stava lì sopra a ogni scena senza dire niente a chi guarda. La data,
      // l'ora e il luogo si chiedono uno per uno, quando sono il racconto
      // (le stagioni, il viaggio delle Voyager).
      cartello.dataset.data = p.date === 'show' ? '1' : '';
      cartello.dataset.ora = p.time === 'show' ? '1' : '';
      cartello.dataset.luogo = p.place === 'show' ? '1' : '';
      cartello.dataset.sole = p.sun === 'show' ? '1' : '';
      cartello.dataset.distanza = p.distance === 'show' ? '1' : '';
      aggiornaCartello();
      cartello.hidden = false;
      return {
        aggiorna() { aggiornaCartello(); },
        chiudi() { cartello.hidden = true; }
      };
    }
  };

  // ------------------------------------------------------------------
  // L'ombra sulla mappa. Solo nelle scene `eclipse_map`: `from` e `to` sono
  // i minuti dal massimo, come in `event_window`, ma qui a tenere il tempo è
  // la mappa (e il planetario la segue: l'orologio è uno solo). Con
  // `zoom_from`/`zoom_to` — i livelli di zoom della carta, da 1 (il mondo)
  // a 8 — la mappa si tiene centrata sull'ombra e ci si avvicina o se ne
  // allontana; con `lat`/`lon` in più resta invece centrata lì (serve quando
  // da raccontare è una regione: la penombra che scende dal polo verso
  // l'Islanda); senza zoom resta sull'inquadratura d'insieme della fascia di
  // totalità. Il disegno dell'ombra costa qualche centinaio di posizioni di
  // Sole e Luna: si rifà a una dozzina di passi al secondo, non a sessanta,
  // che è anche il ritmo del filmato della mappa.
  // ------------------------------------------------------------------
  const PASSO_MAPPA_MS = 80;
  registro.shadow_map = {
    verifica(p) {
      campi(p, ['from', 'to', 'zoom_from', 'zoom_to', 'lat', 'lon']);
      richiedi(numero(p.from, -720, 720) && numero(p.to, -720, 720) && p.to > p.from, err('finestra'));
      const zoom = [p.zoom_from, p.zoom_to];
      richiedi(zoom.every(z => z === undefined) || zoom.every(z => numero(z, 1, 8)), err('zoomMappa'));
      const centro = [p.lat, p.lon];
      richiedi(centro.every(x => x === undefined) ||
        (numero(p.lat, -85, 85) && numero(p.lon, -180, 180) && p.zoom_from !== undefined), err('centroMappa'));
    },
    crea(p, c) {
      if (c.mappaRipiego) {
        const picco = piccoEvento(c, 'solar_eclipse');
        const tempo = u => istante(picco + (p.from + (p.to - p.from) * u) * 60000);
        tempo(0);
        const camera = registro.camera_3d.crea({ scene: 'earth_moon', focus: 'Eclipse Shadow', orbit: 25,
          elev_from: 22, elev_to: 30, zoom_from: 3, zoom_to: 4 }, c);
        return { aggiorna(u) { tempo(u); camera.aggiorna(u); } };
      }
      const conZoom = p.zoom_from !== undefined;
      const centro = p.lat !== undefined ? [p.lat, p.lon] : undefined;
      let ultimo = -Infinity, uUltimo = -1;
      // Un salto nel racconto (`vaiAScena`, o la scena che riparte) non
      // aspetta il passo: si posa subito, se no l'ultima posa andrebbe persa.
      const posa = (u, subito) => {
        const ora = performance.now();
        if (!subito && ora - ultimo < PASSO_MAPPA_MS && Math.abs(u - uUltimo) < 0.02) return;
        ultimo = ora; uUltimo = u;
        const minuti = p.from + (p.to - p.from) * u;
        const zoom = conZoom && !c.cameraManuale ? mescola(p.zoom_from, p.zoom_to, rampa(c, u)) : undefined;
        if (typeof eclRegiaPosa === 'function') eclRegiaPosa(minuti, zoom, centro);
      };
      posa(0, true);
      return { aggiorna: u => posa(u, u >= 0.999) };
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

        // Il testo della frase va nella fascia dei sottotitoli della demo.
        ospite: () => sottotitoli
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
    'passoTempoSec', 'playbackVerso', 'ancoraTempoSec', 'finestraTempoSec', 'archiSole', 'sondeInCielo',
    // Il campo è definito sull'altezza del riquadro (`skyRidimensiona`):
    // conserviamo anche l'altezza a cui valeva, così eventuali resize durante
    // la demo non riscalano di nuovo il FOV quando si ripristina lo stato.
    'altezzaMisurata'];
  const VISTE_SCENA = ['planetarium_view', 'transition', 'solar_system_3d', 'didactic_view', 'eclipse_map'];
  function valida(testo) {
    const demo = motore.prepara(testo);
    let quando = skyAdesso(), luogo = skyLuogoDelCielo();
    for (const scena of demo.scene) {
      richiedi(VISTE_SCENA.includes(scena.vista), err('scena', { nome: scena.vista }));
      for (const azione of scena.azioni) {
        if (azione.comando === 'set_location') luogo = luogoDemo(azione.parametri);
        if (azione.comando === 'set_date') quando = dataDemo(azione.parametri, luogo);
        if (azione.comando === 'timelapse') quando = tempiCivili(azione.parametri, quando, luogo).fine;
        if (azione.comando === 'aurora_lesson') richiedi(scena.vista === 'didactic_view', err('soloDidattica'));
        if (azione.comando === 'camera_3d') richiedi(scena.vista === 'solar_system_3d', err('serve3d'));
        if (azione.comando === 'voyager_journey') richiedi(scena.vista === 'solar_system_3d', err('serve3d'));
        if (azione.comando === 'golden_record') richiedi(scena.vista === 'solar_system_3d', err('serve3d'));
        if (azione.comando === 'cosmic_scale') richiedi(scena.vista === 'solar_system_3d', err('serve3d'));
        if (azione.comando === 'shadow_map') richiedi(scena.vista === 'eclipse_map', err('serveMappa'));
        if (azione.comando === 'earth_axis') richiedi(scena.vista === 'solar_system_3d', err('serve3dAsse'));
        if (azione.comando === 'sun_paths') richiedi(scena.vista === 'planetarium_view', err('serveCielo'));
        if (azione.comando === 'date_range') quando = new Date(azione.parametri.to);
      }
    }
    return demo;
  }

  // ------------------------------------------------------------------
  // Le opzioni della demo: schermo intero, vista pulita, registrazione (con
  // audio opzionale), musica di sottofondo e gli elementi del planetario.
  // Le preferenze aggiunte nel tempo hanno sempre un valore di ripiego per
  // restare compatibili con i salvataggi delle versioni precedenti.
  // ------------------------------------------------------------------
  const CHIAVE_OPZIONI = 'astrocal_demo_opzioni_v1';
  // Quanto restano a schermo i comandi (con la cronologia) dopo un tocco:
  // cinque secondi di serie, da due a trenta nella pagina Demo.
  const DURATA_COMANDI_SEC = 5, DURATA_COMANDI_MIN = 2, DURATA_COMANDI_MAX = 30;
  function durataComandiValida(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= DURATA_COMANDI_MIN && n <= DURATA_COMANDI_MAX ? n : DURATA_COMANDI_SEC;
  }
  function leggiOpzioni() {
    try {
      const o = JSON.parse(localStorage.getItem(CHIAVE_OPZIONI) || 'null');
      if (o && typeof o === 'object') return {
        // La prima visione deve sembrare una presentazione, non una pagina
        // dell'app: anche i salvataggi piu vecchi, privi di questa chiave,
        // ereditano quindi il pieno schermo. Un `false` esplicito continua a
        // rispettare la scelta di chi lo ha disattivato.
        schermoIntero: o.schermoIntero !== false,
        registra: !!o.registra,
        vistaPulita: o.vistaPulita !== false,
        registraAudio: o.registraAudio !== false,
        // Da settembre 2026 la colonna sonora vale per tutte le demo.
        // Le vecchie chiavi "musicaEclissi*" restano lette come migrazione:
        // chi aveva gia scelto toggle o traccia non perde la preferenza.
        musicaDemo: typeof o.musicaDemo === 'boolean' ? o.musicaDemo : o.musicaEclissi !== false,
        musicaDemoTraccia: typeof o.musicaDemoTraccia === 'string' && o.musicaDemoTraccia
          ? o.musicaDemoTraccia
          : (typeof o.musicaEclissiTraccia === 'string' && o.musicaEclissiTraccia
            ? o.musicaEclissiTraccia : 'Encelado1'),
        livelli: o.livelli && typeof o.livelli === 'object' ? o.livelli : null,
        durataComandiSec: durataComandiValida(o.durataComandiSec),
        // Le Storie cosmiche (v416): la camera che va vicino a chi parla e i
        // rumori dei botti. Accese di serie, come la musica.
        cameraStorie: o.cameraStorie !== false,
        effettiSonori: o.effettiSonori !== false,
        // Le scritte nelle Storie cosmiche (v423): i nomi degli astri, le
        // etichette e le didascalie delle viste. Spente di serie: una storia
        // per bambini si guarda con le facce, e i nomi accanto ai personaggi
        // si leggevano sopra ai loro volti. Solo un `true` le riaccende.
        scritteStorie: o.scritteStorie === true
      };
    } catch (_) { /* salvataggio illeggibile: si riparte dai valori di serie */ }
    return { schermoIntero: true, registra: false, vistaPulita: true, registraAudio: true,
      musicaDemo: true, musicaDemoTraccia: 'Encelado1', livelli: null, durataComandiSec: DURATA_COMANDI_SEC,
      cameraStorie: true, effettiSonori: true, scritteStorie: false };
  }
  let opzioni = leggiOpzioni();
  function impostaOpzioni(nuove) {
    const aggiornate = { ...nuove };
    // Compatibilita con integrazioni o salvataggi che usano ancora i nomi
    // precedenti: internamente da ora si usano solo le chiavi generali.
    if (!Object.prototype.hasOwnProperty.call(aggiornate, 'musicaDemo') &&
        Object.prototype.hasOwnProperty.call(aggiornate, 'musicaEclissi'))
      aggiornate.musicaDemo = aggiornate.musicaEclissi;
    if (!Object.prototype.hasOwnProperty.call(aggiornate, 'musicaDemoTraccia') &&
        Object.prototype.hasOwnProperty.call(aggiornate, 'musicaEclissiTraccia'))
      aggiornate.musicaDemoTraccia = aggiornate.musicaEclissiTraccia;
    delete aggiornate.musicaEclissi;
    delete aggiornate.musicaEclissiTraccia;
    if (Object.prototype.hasOwnProperty.call(aggiornate, 'durataComandiSec'))
      aggiornate.durataComandiSec = durataComandiValida(aggiornate.durataComandiSec);
    opzioni = Object.assign({}, opzioni, aggiornate);
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
    // La mappa ha la sua pulizia (`.ecl-regia` in style.css); il riquadro
    // del cielo, che la ospita a schermo intero, resta marcato com'era.
    if (typeof eclRegiaAttiva === 'function' && eclRegiaAttiva()) return document.getElementById('skymap-contenitore');
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

  // Ogni demo, predefinita o personale, usa la colonna sonora scelta nelle
  // impostazioni. La selezione e globale apposta: anche una demo creata in
  // futuro dall'editor passa da questo stesso punto di avvio.
  const MUSICA_DEMO = { tracciaPredefinita: 'Encelado1', volume: 0.3 };
  function tracciaMusicaDemo() {
    const preferita = opzioni.musicaDemoTraccia || MUSICA_DEMO.tracciaPredefinita;
    const tracce = Array.isArray(window.ASTRO_TRACCE_MUSICALI) ? window.ASTRO_TRACCE_MUSICALI : [];
    if (!tracce.length || tracce.some(t => t && t.id === preferita)) return preferita;
    const prima = tracce.find(t => t && typeof t.id === 'string' && t.id);
    return prima ? prima.id : MUSICA_DEMO.tracciaPredefinita;
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
      'panX', 'panY', 'perno', 'vicino', 'quadro', 'scelto', 'mondiAccesi', 'sondeAccese',
      'evidenziaAsse', 'grandTour', 'distanzeVere', 'misureVere'].map(k => [k, sol[k]]));
    const auroraPrima = { acceso: aur.acceso, kpSimulato: aur.kpSimulato };
    const didatticaPrima = typeof didDemo !== 'undefined' ? didDemo.fotografa() : null;
    const livelliPrima = fotografaLivelli();
    const schermoInteroPrima = sky.schermoIntero;
    const regPrima = { durataSec: sky.reg.durataSec, origine: sky.reg.origine };
    const modaleImpostazioni = document.getElementById('modale-impostazioni');
    const impostazioniNascostePrima = !!(modaleImpostazioni && modaleImpostazioni.classList.contains('hidden'));
    const comandiCielo = document.getElementById('cielo-comandi');
    const gruppoPrima = comandiCielo ? (comandiCielo.dataset.gruppoAttivo || '') : '';
    const c = { chiuso: false, eclisse: null, cameraManuale: false, schermo: !!opzioni.schermoIntero, gruppoPrima,
      vistaPulita: opzioni.vistaPulita !== false,
      // Una Storia cosmica è una demo con dei personaggi: lì, se l'opzione
      // non le chiede, le scritte delle viste tacciono (`senzaScritte`)
      senzaScritte: opzioni.scritteStorie !== true &&
        demo.scene.some(sc => sc.azioni.some(a => /^character_/.test(a.comando))),
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
        c.chiuso = true; contesto = null; evidenze.clear(); c.dopoIntro = null;
        // Nessun velo dell'intro può sopravvivere alla demo: Stop, Esc, un
        // errore o la fine lo tolgono subito, anche a metà dissolvenza.
        if (typeof AstroDemoIntro === 'object') AstroDemoIntro.rimuovi();
        if (typeof narrazione === 'object') narrazione.ferma('demo');
        // La colonna sonora se ne va per prima, e il sottofondo di prima
        // torna com'era: stessa traccia, stesso volume, suona se suonava.
        if (c.musica && typeof musicaDemoFerma === 'function') musicaDemoFerma();
        c.musica = null;
        document.body.classList.remove('demo-in-corso', 'demo-vista-pulita');
        togliVistaPulita();
        const registrava = sky.reg.attiva && sky.reg.sorgente;
        if (registrava) skyRegFerma();
        if (typeof narrazione === 'object' && typeof narrazione.fermaCatturaAudio === 'function')
          narrazione.fermaCatturaAudio('demo');
        c.flussoAudio = null;
        if (c.registrazione) cancelAnimationFrame(c.registrazione);
        solVolo.dopo = null; solVoloChiudi();
        lasciaMappa();
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
        // `skyMostraGruppo` è un interruttore: richiamarlo col gruppo già
        // aperto lo chiuderebbe. Si tocca solo se lo stato è diverso.
        if (comandiCielo && (comandiCielo.dataset.gruppoAttivo || '') !== gruppoPrima) skyMostraGruppo(gruppoPrima);
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
        cartello.hidden = true;
      }
    };
    contesto = c;
    // L'intro comune, se è accesa: il velo nero nasce qui, nello stesso turno
    // del clic e prima di chiedere il pieno schermo, così fra la pagina di
    // prima e il racconto non passa neanche un fotogramma dell'interfaccia.
    // La gira il motore (è una fase del suo orologio, prima della prima
    // scena); qui si aggiunge solo quello che sa la demo: se durante l'intro
    // la vista cambia sotto ai piedi, la persona se n'è andata, e la demo si
    // ferma invece di ripartire altrove.
    c.vistaIntro = vistaAttuale;
    if (typeof AstroDemoIntro === 'object') {
      const intro = AstroDemoIntro.crea({ controlla() {
        if (contesto === c && vistaAttuale !== c.vistaIntro)
          Promise.resolve().then(() => { if (contesto === c) motore.ferma(); });
      } });
      if (intro) {
        const fine = intro.fine;
        intro.fine = () => { fine(); if (c.dopoIntro) { const f = c.dopoIntro; c.dopoIntro = null; f(); } };
        c.intro = intro;
      }
    }
    document.body.classList.add('demo-in-corso');
    document.body.classList.toggle('demo-vista-pulita', c.vistaPulita);
    // La finestra Impostazioni deve lasciare vedere il racconto, ma il suo
    // stato viene ricordato e ripristinato: la vista pulita non chiude né
    // pannelli né avvisi, li nasconde soltanto.
    if (modaleImpostazioni) modaleImpostazioni.classList.add('hidden');
    skyFermaPlayback(); skyFermaMovimenti(); sky.seguiTelefono = false; sky.modalitaHover = false;
    sky.eventoInseguito = null;
    applicaLivelli(opzioni.livelli);
    // Senza scritte, anche i nomi del planetario e delle vette si spengono;
    // la fotografia dei livelli presa sopra li riaccende alla fine
    if (c.senzaScritte) applicaLivelli({ nomi: false, cime: false });
    // Il pieno schermo vero si chiede qui, dentro al gesto che ha avviato la
    // demo, sull'intero documento: le tre viste del racconto se lo passano
    // col solo CSS, e il browser non ne esce a ogni cambio di scena.
    if (c.schermo && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      c.schermoNativo = true;
      try { document.documentElement.requestFullscreen().catch(() => { c.schermoNativo = false; }); }
      catch (_) { c.schermoNativo = false; }
    }
    if (opzioni.musicaDemo !== false && typeof musicaDemoAvvia === 'function')
      c.musica = musicaDemoAvvia(tracciaMusicaDemo(), MUSICA_DEMO.volume);
    motore.avvia(testo, c);
    // Un errore nella prima scena chiude la demo dentro a `motore.avvia`, e
    // il ripristino ha già spento la musica; se il motore non è partito per
    // un'altra via, la si spegne comunque qui.
    if (motore.stato !== 'attivo' && c.musica && typeof musicaDemoFerma === 'function') {
      musicaDemoFerma(); c.musica = null;
    }
    // Senza filmato non esiste la registrazione del solo audio.
    // Il filmato è il racconto: comincia con la prima scena, quando il nero
    // dell'intro se ne va, e non riprende tre secondi di pagina coperta.
    if (motore.stato === 'attivo' && opzioni.registra) {
      if (motore.inIntro) c.dopoIntro = () => { if (contesto === c) avviaRegistrazione(c, demo); };
      else avviaRegistrazione(c, demo);
    }
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

    // `skyRegAvvia` è asincrona: prima di prendere il flusso della tela
    // aspetta che le schede aperte siano rasterizzate. Gli agganci vanno
    // quindi tolti **dopo** che è partita, non all'uscita da questa riga —
    // prima si toglievano subito, e la traccia della voce non entrava mai.
    // Per la stessa ragione il pannello si rimette a posto solo allora: è lì
    // che il registratore lo chiude.
    const rimettiGruppo = () => {
      const comandi = document.getElementById('cielo-comandi');
      if (comandi && (comandi.dataset.gruppoAttivo || '') !== (c.gruppoPrima || '')) skyMostraGruppo(c.gruppoPrima || '');
    };
    let partenza;
    try {
      partenza = skyRegAvvia();
    } catch (e) {
      ripristinaAgganci();
      chiudiAudioSeInutile();
      sky.reg.sorgente = null;
      skyAvviso('demo', t('errore') + ': ' + e.message, 10000);
      return;
    }
    Promise.resolve(partenza).then(() => {
      ripristinaAgganci();
      rimettiGruppo();
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
      ripristinaAgganci();
      chiudiAudioSeInutile();
      sky.reg.sorgente = null;
      if (!c.chiuso) skyAvviso('demo', t('errore') + ': ' + (e && e.message ? e.message : e), 10000);
    });
  }

  // ------------------------------------------------------------------
  // I comandi della demo e il testo della narrazione.
  //
  // Il pannello esiste **solo mentre una demo è in corso**: fuori resta
  // `hidden`, e il CSS (`.demo-controlli[hidden]`) lo toglie dal disegno —
  // prima uno `display:flex` scritto in linea batteva l'attributo, e i tre
  // tondi restavano a galleggiare sulla pagina anche senza demo.
  // Durante la demo si mostrano toccando lo schermo e si ritirano da soli
  // dopo sei secondi, ma **non** mentre il fuoco o il puntatore ci sono
  // sopra, e non in pausa (il tasto per riprendere deve restare lì).
  //
  // Il testo della narrazione sta in una fascia sua (`#demo-sottotitoli`),
  // sorella del pannello e non dentro di lui: quando i comandi si ritiravano
  // si portavano via anche la frase a metà, e dentro a una fila di tondi il
  // testo veniva stretto e tagliato. La frase resta a schermo finché la
  // voce la dice (la chiude solo `narrazione.ferma`, cioè la scena dopo, lo
  // Stop o la fine) e ogni frase nuova **sostituisce** quella di prima nello
  // stesso nodo: due scene non si sovrappongono mai.
  // ------------------------------------------------------------------
  const pannello = document.createElement('div');
  pannello.id = 'demo-controlli'; pannello.className = 'demo-controlli'; pannello.hidden = true;
  pannello.setAttribute('role', 'toolbar');
  const sottotitoli = document.createElement('div');
  sottotitoli.id = 'demo-sottotitoli'; sottotitoli.className = 'demo-sottotitoli'; sottotitoli.hidden = true;
  // Il cartello della data (`date_card`): quattro righe fisse, riscritte solo
  // quando il loro testo cambia davvero — durante un anno fatto scorrere in
  // venti secondi la data cambia a ogni fotogramma, l'etichetta mai.
  const cartello = document.createElement('div');
  cartello.id = 'demo-cartello'; cartello.className = 'demo-cartello'; cartello.hidden = true;
  cartello.setAttribute('role', 'note');
  const righeCartello = {};
  for (const nome of ['etichetta', 'data', 'ora', 'sole', 'giorno', 'distanza']) {
    const riga = document.createElement('div');
    riga.className = 'demo-cartello-' + nome;
    righeCartello[nome] = riga;
    cartello.append(riga);
  }
  function scriviRiga(nome, testo) {
    const riga = righeCartello[nome];
    if (riga.textContent !== testo) riga.textContent = testo;
    const vuota = !testo;
    if (riga.hidden !== vuota) riga.hidden = vuota;
  }
  // Alba, tramonto, durata del giorno e altezza del Sole a mezzogiorno per un
  // giorno civile del luogo: si calcolano una volta per giorno e per luogo,
  // non a ogni fotogramma (sono tre ricerche della libreria).
  let fattiSole = { chiave: null };
  function fattiDelSole(quando, luogo) {
    const parti = partiDataDelLuogo(quando, luogo);
    const obs = sky.observer;
    if (!obs) return null;
    const chiave = [parti.year, parti.month, parti.day, obs.latitude.toFixed(3), obs.longitude.toFixed(3)].join('|');
    if (fattiSole.chiave === chiave) return fattiSole;
    const giorno = { year: parti.year, month: parti.month, day: parti.day, minute: 0, second: 0 };
    const inizio = dataDalTempoDelLuogo({ ...giorno, hour: 0 }, luogo) || dataDalTempoDelLuogo({ ...giorno, hour: 1 }, luogo);
    const f = { chiave, alba: null, tramonto: null, altezza: null, sempre: null };
    try {
      const alba = Astronomy.SearchRiseSet('Sun', obs, +1, inizio, 1);
      const tramonto = Astronomy.SearchRiseSet('Sun', obs, -1, alba ? alba.date : inizio, 1);
      const culmine = Astronomy.SearchHourAngle('Sun', obs, 0, inizio);
      f.altezza = culmine && culmine.hor ? culmine.hor.altitude : null;
      if (alba && tramonto) { f.alba = alba.date; f.tramonto = tramonto.date; }
      else if (f.altezza !== null) {
        // Né alba né tramonto nel giorno: sole di mezzanotte o notte polare.
        // Lo dice l'altezza al culmine inferiore, dodici ore dopo quello
        // superiore.
        const sotto = Astronomy.SearchHourAngle('Sun', obs, 12, inizio);
        f.sempre = sotto && sotto.hor && sotto.hor.altitude > -0.833 ? 'giorno' : (f.altezza < -0.833 ? 'notte' : null);
      }
    } catch (_) { /* senza la libreria il cartello dice solo la data */ }
    fattiSole = f;
    return f;
  }
  function aggiornaCartello() {
    const quando = skyAdesso(), luogo = skyLuogoDelCielo();
    const d = cartello.dataset;
    const fuso = fusoDelLuogo(luogo).nome;
    const locale = localeData();
    scriviRiga('etichetta', d.testo || (d.etichetta ? astroI18n.t(d.etichetta) : ''));
    scriviRiga('data', d.data ? formattatoreData(locale, { timeZone: fuso, weekday: 'long', day: 'numeric',
      month: 'long', year: 'numeric' }).format(quando) : '');
    const nomeLuogo = d.luogo && luogo && luogo.nome ? luogo.nome : '';
    scriviRiga('ora', [d.ora ? oraDelLuogo(quando, luogo) : '', nomeLuogo].filter(Boolean).join(' · '));
    let sole = '', giorno = '';
    if (d.sole) {
      const f = fattiDelSole(quando, luogo);
      if (f && f.alba && f.tramonto) {
        const minuti = Math.round((+f.tramonto - +f.alba) / 60000);
        sole = t('cartello.alba', { ora: oraDelLuogo(f.alba, luogo) }) + ' · ' +
          t('cartello.tramonto', { ora: oraDelLuogo(f.tramonto, luogo) });
        giorno = t('cartello.giorno', { ore: Math.floor(minuti / 60), min: minuti % 60 });
      } else if (f && f.sempre) sole = t(f.sempre === 'giorno' ? 'cartello.sempreGiorno' : 'cartello.sempreNotte');
      if (f && f.altezza !== null)
        giorno = (giorno ? giorno + ' · ' : '') + t('cartello.mezzogiorno', { gradi: solNumero(f.altezza, 0) });
    }
    scriviRiga('sole', sole);
    scriviRiga('giorno', giorno);
    let distanza = '';
    if (d.distanza) {
      try {
        const km = Astronomy.HelioDistance('Earth', quando) * 149597870.7 / 1e6;
        distanza = t('cartello.distanza', { km: solNumero(km, 1) });
      } catch (_) { distanza = ''; }
    }
    scriviRiga('distanza', distanza);
    cartello.setAttribute('aria-label', t('cartello.nome'));
    const genitore = genitoreDemo();
    if (genitore && cartello.parentElement !== genitore) genitore.append(cartello);
  }
  let timerComandi = null;
  const icone = {
    pausa: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="5" width="3.6" height="14" rx="1"/><rect x="13.9" y="5" width="3.6" height="14" rx="1"/></svg>',
    riprendi: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    riavvia: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5a7 7 0 1 1-6.2 3.75L3 11V4h7L7.6 6.4A9 9 0 1 0 12 3z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/></svg>'
  };
  const inCorso = () => motore.stato === 'attivo' || motore.stato === 'pausa';
  const trattenuti = () => motore.stato === 'pausa' || pannello.matches(':hover') ||
    pannello.contains(document.activeElement);
  function nascondiComandi() {
    if (timerComandi) { clearTimeout(timerComandi); timerComandi = null; }
    pannello.classList.remove('visibile');
  }
  // Quanto restano a schermo: è un'opzione della pagina Demo
  // (`durataComandiSec`, cinque secondi di serie).
  function programmaRitiro() {
    if (timerComandi) clearTimeout(timerComandi);
    timerComandi = setTimeout(() => {
      timerComandi = null;
      if (trattenuti()) programmaRitiro(); else nascondiComandi();
    }, durataComandiValida(opzioni.durataComandiSec) * 1000);
  }
  function mostraComandi() {
    if (!inCorso()) return;
    pannello.classList.add('visibile');
    aggiornaCronologia();
    if (!cronoRaf) cronoRaf = requestAnimationFrame(giroCronologia);
    programmaRitiro();
  }
  function bottone(chiave, azione) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'demo-tasto';
    b.dataset.azione = chiave;
    b.innerHTML = icone[chiave]; b.setAttribute('aria-label', t(chiave)); b.setAttribute('title', t(chiave));
    b.addEventListener('click', e => { e.stopPropagation(); azione(); mostraComandi(); }); tastiDemo.append(b); return b;
  }
  // ------------------------------------------------------------------
  // La cronologia della demo, in cima ai comandi: una pista divisa in
  // scene, lunghe quanto durano, che si riempie col racconto; accanto la
  // scena e il tempo. Toccandola si salta lì (`motore.vaiAScena`, con la
  // frazione della scena): è il modo di rivedere un passaggio senza
  // ricominciare tutto. Si ridisegna solo mentre i comandi sono a schermo.
  // ------------------------------------------------------------------
  const cronologia = document.createElement('div');
  cronologia.className = 'demo-cronologia';
  const cronoTesta = document.createElement('div');
  cronoTesta.className = 'demo-cronologia-testa';
  const cronoScena = document.createElement('span'), cronoTempo = document.createElement('span');
  cronoScena.className = 'demo-cronologia-scena'; cronoTempo.className = 'demo-cronologia-tempo';
  cronoTesta.append(cronoScena, cronoTempo);
  const pista = document.createElement('div');
  pista.className = 'demo-cronologia-pista';
  pista.setAttribute('role', 'slider');
  pista.tabIndex = 0;
  cronologia.append(cronoTesta, pista);
  pannello.append(cronologia);
  let cronoChiave = '', cronoRaf = null;
  const minSec = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function durateScene() { return motore.demo ? motore.demo.scene.map(x => x.durata) : []; }
  function costruisciPista() {
    const durate = durateScene();
    const chiave = (motore.demo ? motore.demo.id : '') + '|' + durate.join(',');
    if (chiave === cronoChiave) return;
    cronoChiave = chiave;
    const tot = durate.reduce((a, b) => a + b, 0) || 1;
    pista.replaceChildren(...durate.map((d, i) => {
      const pezzo = document.createElement('span');
      pezzo.className = 'demo-cronologia-pezzo';
      pezzo.style.flexGrow = String(d / tot);
      pezzo.title = t('cronologiaVai', { n: i + 1 });
      const pieno = document.createElement('span');
      pieno.className = 'demo-cronologia-pieno';
      pezzo.append(pieno);
      return pezzo;
    }));
  }
  function aggiornaCronologia() {
    if (!inCorso() || !motore.demo) return;
    costruisciPista();
    const durate = durateScene(), tot = durate.reduce((a, b) => a + b, 0);
    const i = motore.inIntro ? 0 : Math.min(motore.indice || 0, durate.length - 1);
    const qui = motore.inIntro ? 0 : Math.min(durate[i], Math.max(0, motore.trascorso || 0));
    const fatto = durate.slice(0, i).reduce((a, b) => a + b, 0) + qui;
    Array.from(pista.children).forEach((pezzo, k) => {
      const f = k < i ? 1 : k > i ? 0 : qui / durate[i];
      pezzo.firstChild.style.transform = 'scaleX(' + f.toFixed(4) + ')';
      pezzo.classList.toggle('attuale', k === i);
    });
    cronoScena.textContent = t('cronologiaScena', { n: i + 1, totale: durate.length });
    cronoTempo.textContent = minSec(fatto) + ' / ' + minSec(tot);
    pista.setAttribute('aria-label', t('cronologia'));
    pista.setAttribute('aria-valuemin', '0');
    pista.setAttribute('aria-valuemax', String(Math.round(tot / 1000)));
    pista.setAttribute('aria-valuenow', String(Math.round(fatto / 1000)));
    pista.setAttribute('aria-valuetext', cronoScena.textContent + ', ' + cronoTempo.textContent);
  }
  function giroCronologia() {
    cronoRaf = null;
    if (!pannello.classList.contains('visibile') || !inCorso()) return;
    aggiornaCronologia();
    cronoRaf = requestAnimationFrame(giroCronologia);
  }
  // Salta al punto della pista: la frazione del tempo totale diventa una
  // scena e una frazione di scena. In pausa si riparte: chi sceglie un punto
  // vuole vederlo.
  function saltaA(frazione) {
    const durate = durateScene(), tot = durate.reduce((a, b) => a + b, 0);
    if (!tot) return;
    let resto = Math.max(0, Math.min(0.999, frazione)) * tot, i = 0;
    while (i < durate.length - 1 && resto >= durate[i]) { resto -= durate[i]; i++; }
    motore.vaiAScena(i, resto / durate[i]);
    if (motore.stato === 'pausa') motore.riprendi();
    aggiornaCronologia();
  }
  pista.addEventListener('click', e => {
    e.stopPropagation();
    const r = pista.getBoundingClientRect();
    if (r.width > 0) saltaA((e.clientX - r.left) / r.width);
    mostraComandi();
  });
  pista.addEventListener('keydown', e => {
    const durate = durateScene();
    if (!durate.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const i = motore.indice || 0;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? durate.length - 1 : i + (e.key === 'ArrowRight' ? 1 : -1);
    if (j >= 0 && j < durate.length) motore.vaiAScena(j, 0);
    aggiornaCronologia(); mostraComandi();
  });
  const tastiDemo = document.createElement('div');
  tastiDemo.className = 'demo-controlli-tasti';
  pannello.append(tastiDemo);
  const pausa = bottone('pausa', () => motore.stato === 'pausa' ? motore.riprendi() : motore.pausa());
  const riavvia = bottone('riavvia', () => avviaSicuro(ultimoScript));
  const arresta = bottone('stop', () => motore.ferma());
  // Il fuoco da tastiera li tiene in vista: Tab arriva ai tondi anche quando
  // sono ritirati, e si vedono appena ci si arriva.
  pannello.addEventListener('focusin', mostraComandi);
  pannello.addEventListener('pointerenter', mostraComandi);
  document.body.append(pannello, sottotitoli, cartello);
  function aggiornaEtichette() {
    const inPausa = motore.stato === 'pausa';
    pausa.innerHTML = icone[inPausa ? 'riprendi' : 'pausa'];
    pausa.dataset.azione = inPausa ? 'riprendi' : 'pausa';
    pausa.setAttribute('aria-label', t(inPausa ? 'riprendi' : 'pausa'));
    pausa.setAttribute('title', pausa.getAttribute('aria-label'));
    pausa.setAttribute('aria-pressed', inPausa ? 'true' : 'false');
    riavvia.setAttribute('aria-label', t('riavvia')); riavvia.setAttribute('title', t('riavvia'));
    arresta.setAttribute('aria-label', t('stop')); arresta.setAttribute('title', t('stop'));
    pannello.setAttribute('aria-label', t('comandi'));
    sottotitoli.setAttribute('aria-label', t('sottotitoli'));
  }
  // Dove stanno i pezzi della demo appoggiati sulla scena (comandi,
  // sottotitoli, cartello): dentro a chi è a schermo intero, se no il suo
  // pieno schermo li lascerebbe fuori.
  function genitoreDemo() {
    const pieno = document.querySelector('.did-pieno-ripiego');
    return sol.aperto ? solGuscio()
      : (pieno && vistaAttuale === 'didattica') ? pieno
        : (sky.schermoIntero ? document.getElementById('skymap-contenitore') : null) ||
          (document.fullscreenElement && document.fullscreenElement !== document.documentElement
            ? document.fullscreenElement : document.body);
  }
  function aggiornaPannello() {
    if (inCorso()) {
      const genitore = genitoreDemo();
      if (genitore && pannello.parentElement !== genitore) genitore.append(pannello);
      if (genitore && sottotitoli.parentElement !== genitore) genitore.append(sottotitoli);
      if (genitore && cartello.parentElement !== genitore) genitore.append(cartello);
      pannello.hidden = false;
      aggiornaEtichette();
      // In pausa i comandi restano in vista: il tasto per riprendere non
      // deve sparire proprio mentre serve.
      if (motore.stato === 'pausa') mostraComandi();
    } else {
      if (pannello.parentElement !== document.body) document.body.append(pannello);
      if (sottotitoli.parentElement !== document.body) document.body.append(sottotitoli);
      if (cartello.parentElement !== document.body) document.body.append(cartello);
      cartello.hidden = true;
      pannello.hidden = true; nascondiComandi();
      if (!sottotitoli.hidden) sottotitoli.hidden = true;
      if (motore.stato === 'errore') skyAvviso('demo', t('errore') + ': ' + motore.errore.message, 10000);
      if (motore.stato === 'completato') skyAvviso('demo', t('completato'), 7000);
    }
  }
  // La fascia dei sottotitoli c'è solo quando dentro c'è una frase: la
  // narrazione ci appende il suo nodo e lo nasconde a frase finita.
  if (typeof MutationObserver === 'function') new MutationObserver(() => {
    const frase = sottotitoli.querySelector('.narrazione-testo');
    const nascosta = !(inCorso() && frase && !frase.hidden && frase.textContent.trim());
    // Scrivere `hidden` anche con lo stesso valore è una mutazione, e questo
    // osservatore guarda proprio quell'attributo: senza il confronto si
    // risveglierebbe da sé all'infinito, a pagina bloccata.
    if (sottotitoli.hidden !== nascosta) sottotitoli.hidden = nascosta;
  }).observe(sottotitoli, { childList: true, subtree: true, attributes: true, characterData: true,
    attributeFilter: ['hidden'] });
  function avviaSicuro(testo) {
    try { avvia(testo); } catch (e) { skyAvviso('demo', t('errore') + ': ' + e.message, 10000); }
  }

  // ------------------------------------------------------------------
  // La camera a mano durante la demo. Un intervento della persona —
  // trascinare, pizzicare, girare la rotellina, un tasto di zoom o di
  // direzione — prende la camera per il resto della scena: le azioni
  // automatiche di quella scena smettono di riscriverla (`c.cameraManuale`),
  // mentre il racconto, la sua voce e il suo orologio continuano. Un
  // **tocco** semplice invece non la prende: serve a far comparire i
  // comandi, e prima bastava quello a fermare il carrello della regia.
  // Toccare i comandi della demo non cede niente e non ferma niente.
  // ------------------------------------------------------------------
  const SOGLIA_TRASCINA_PX = 6;
  const COMANDI_CAMERA = '.tasto-zoom-cielo, .comandi-mappa-cielo button, .comandi-mappa-sistema button, ' +
    '.sol-viste button, [data-sol-quadro], [data-verso], ' +
    '#skymap-btn-centra, #skymap-btn-campo, #skymap-btn-insegui, #sol-centra, #sol-reset';
  const scena = el => !!(el && el.closest && el.closest('canvas, #skymap-contenitore, #sol-guscio, .did-scena, .ecl-guscio-filmato'));
  const puntatori = new Map();
  function dellaDemo(el) {
    return pannello.contains(el) || sottotitoli.contains(el);
  }
  document.addEventListener('pointerdown', e => {
    if (!contesto || dellaDemo(e.target)) return;
    mostraComandi();
    if (e.target && e.target.closest && e.target.closest(COMANDI_CAMERA)) { contesto.cediCamera(); return; }
    if (!scena(e.target)) return;
    puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Due dita insieme sono sempre un pizzico, anche prima di muoversi.
    if (puntatori.size >= 2) contesto.cediCamera();
  }, true);
  document.addEventListener('pointermove', e => {
    const p = puntatori.get(e.pointerId);
    if (!contesto || !p) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) >= SOGLIA_TRASCINA_PX) contesto.cediCamera();
  }, true);
  const lascia = e => puntatori.delete(e.pointerId);
  document.addEventListener('pointerup', lascia, true);
  document.addEventListener('pointercancel', lascia, true);
  document.addEventListener('dblclick', e => { if (contesto && scena(e.target)) contesto.cediCamera(); }, true);
  // La rotellina e i tasti non passano da `pointerdown`: senza questi due
  // ascoltatori `set_fov` e `frame_objects` rimettevano il loro campo a ogni
  // fotogramma e lo zoom della persona veniva annullato subito.
  document.addEventListener('wheel', e => {
    if (contesto && !dellaDemo(e.target)) contesto.cediCamera();
  }, { capture: true, passive: true });
  document.addEventListener('keydown', e => {
    if (!contesto || e.key === 'Escape' || dellaDemo(e.target)) return;
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
    get inCorso() { return inCorso(); },
    get scena() { return motore.indice; },
    // Vero mentre gira l'intro comune, prima della prima scena.
    get intro() { return !!motore.inIntro; },
    // Gli avvisi di servizio tacciono soltanto nella vista pulita: spegnendo
    // l'opzione l'interfaccia resta deliberatamente utilizzabile e visibile.
    get silenzioso() { return !!(contesto && contesto.vistaPulita); },
    // Vero mentre gira una Storia cosmica con le scritte spente (l'opzione
    // `scritteStorie`, spenta di serie): le viste non scrivono nomi né
    // etichette sulla tela (`demoSenzaScritte` in app.js)
    get senzaScritte() { return !!(contesto && !contesto.chiuso && contesto.senzaScritte); },
    // Vero quando la persona ha preso la camera in mano per questa scena: la
    // regia delle Storie cosmiche le lascia il quadro.
    get cameraManuale() { return !!(contesto && contesto.cameraManuale); },
    get opzioni() {
      return {
        ...opzioni,
        // Alias in sola lettura per chi usa ancora l'API precedente.
        musicaEclissi: opzioni.musicaDemo,
        musicaEclissiTraccia: opzioni.musicaDemoTraccia,
        livelli: opzioni.livelli && { ...opzioni.livelli }
      };
    },
    impostaOpzioni,
    livelli: () => LIVELLI.map(l => ({ id: l.id, nome: nomeLivello(l), acceso: l.leggi() })),
    registra(nome, comando) {
      richiedi(/^[a-z_]+$/.test(nome) && nome !== 'center' && !registro[nome], err('registraNome'));
      richiedi(comando && typeof comando.crea === 'function', err('registraCrea'));
      registro[nome] = comando;
    }
  };
})();
