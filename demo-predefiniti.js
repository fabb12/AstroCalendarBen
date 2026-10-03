/* Tour in DSL: dati puri, condivisi da browser e prove Node. */
(function (radice) {
  'use strict';
  const predefiniti = [
    {
      chiave: 'eclisse_tour',
      testo: `define_demo 'eclisse_tour' {
  // Eclisse totale del 12 agosto 2026 (massimo 17:45:47 UTC), vista da
  // Reykjavík, dentro la fascia di totalità. Contatti a Reykjavík (minuti dal
  // massimo): primo -58,7, secondo +2,3, terzo +3,4, ultimo +61,7 — la
  // totalità dura 65 secondi. Il racconto va avanti nel tempo: prima
  // l'attesa, poi l'ombra vista dall'alto sulla mappa del cono d'ombra, la
  // falce, la totalità, di nuovo la mappa con l'ombra che corre verso la
  // Spagna; poi lo spazio, dove il nastro si riavvolge una volta sola: il
  // cono arriva (-62 → -46) e l'ombra piena attraversa il globo intero, dal
  // primo tocco all'alba in Siberia all'ultimo al tramonto sulla Spagna
  // (-46 → +47), con la sua strada disegnata sotto. Poi il ritorno a
  // Reykjavík, dove il tempo riprende da +50.
  scene planetarium_view {
    // L'attesa: il cielo di un pomeriggio d'estate, poi dritti sul Sole.
    duration: 16s;
    action: narrate { id: 'demo.narr.eclisse_tour.1' };
    action: set_location { lat: 64.1466, lon: -21.9426, name: 'Reykjavik', timezone: 'Atlantic/Reykjavik' };
    action: set_date { iso: '2026-08-12T15:20:00Z' };
    action: zoom_fov { from: 60, to: 1.6 };
    action: timelapse { start: 15:20, end: 15:30 };
    action: center_target { target: 'Sun' };
  }

  scene eclipse_map {
    // Dall'alto: la penombra si posa sul pianeta e scivola fino a Reykjavík.
    duration: 20s;
    action: narrate { id: 'demo.narr.eclisse_tour.2' };
    action: shadow_map { from: -134, to: -58.5, zoom_from: 2.4, zoom_to: 3, lat: 64, lon: -22 };
  }

  scene planetarium_view {
    // Il primo contatto e un'ora di falce che si stringe.
    duration: 18s;
    action: narrate { id: 'demo.narr.eclisse_tour.3' };
    action: set_fov { degrees: 1.6 };
    action: event_window { event: solar_eclipse, from: -58.5, to: 1.8 };
    action: center_target { target: 'Sun' };
  }

  scene planetarium_view {
    // I grani di Baily, l'anello di diamanti e il secondo contatto.
    duration: 14s;
    action: narrate { id: 'demo.narr.eclisse_tour.4' };
    action: zoom_fov { from: 1.6, to: 0.9 };
    action: event_window { event: solar_eclipse, from: 1.8, to: 2.9 };
    action: center_target { target: 'Sun' };
  }

  scene planetarium_view {
    // Totalità: la corona, poi lo sguardo si allarga su Venere, Giove e il
    // tramonto tutto attorno all'orizzonte.
    duration: 16s;
    action: narrate { id: 'demo.narr.eclisse_tour.5' };
    action: zoom_fov { from: 0.9, to: 70 };
    action: event_window { event: solar_eclipse, from: 2.9, to: 3.3 };
    action: center_target { target: 'Sun' };
  }

  scene eclipse_map {
    // L'ombra piena lascia l'Islanda e corre sull'Atlantico verso la Spagna.
    duration: 22s;
    action: narrate { id: 'demo.narr.eclisse_tour.6' };
    action: shadow_map { from: 3.5, to: 42, zoom_from: 4.6, zoom_to: 4 };
  }

  scene transition {
    // Fuori, nello spazio.
    duration: 8s;
    action: narrate { id: 'demo.narr.eclisse_tour.7' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }

  scene solar_system_3d {
    // Il nastro si riavvolge: Sole, Luna e Terra in fila, e il cono d'ombra
    // della Luna che arriva sul pianeta — la punta tocca terra a -46 minuti.
    duration: 12s;
    action: narrate { id: 'demo.narr.eclisse_tour.8' };
    action: event_window { event: solar_eclipse, from: -62, to: -46.2 };
    action: camera_3d {
      scene: earth_moon,
      focus: 'Earth-Moon',
      orbit: 20,
      elev_from: 6,
      elev_to: 14,
      zoom_from: 1,
      zoom_to: 1.6
    };
  }

  scene solar_system_3d {
    // Addosso alla Terra, molto vicino: la macchia scura dell'ombra piena
    // dall'alba in Siberia al tramonto sulla Spagna, tutta, dall'inizio alla
    // fine (tocca terra a -46 minuti e la lascia a +47,5).
    duration: 22s;
    action: narrate { id: 'demo.narr.eclisse_tour.9' };
    action: event_window { event: solar_eclipse, from: -46, to: 47.3 };
    action: camera_3d {
      scene: earth_moon,
      focus: 'Earth',
      orbit: 70,
      elev_from: 72,
      elev_to: 62,
      zoom_from: 9,
      zoom_to: 14
    };
  }

  scene planetarium_view {
    // Di nuovo a Reykjavík: la falce si allarga fino all'ultimo contatto.
    duration: 18s;
    action: narrate { id: 'demo.narr.eclisse_tour.10' };
    action: set_fov { degrees: 1.6 };
    action: event_window { event: solar_eclipse, from: 50, to: 62 };
    action: center_target { target: 'Sun' };
  }

  scene planetarium_view {
    // Il congedo: il Sole intero sopra l'orizzonte islandese.
    duration: 14s;
    action: narrate { id: 'demo.narr.eclisse_tour.11' };
    action: zoom_fov { from: 1.6, to: 70 };
    action: event_window { event: solar_eclipse, from: 62, to: 68 };
    action: center_target { target: 'Sun' };
  }
}`
    },
    {
      chiave: 'eclisse_lunare',
      testo: `define_demo 'eclisse_lunare' {
  // Eclisse totale del 31 dicembre 2028 (massimo 16:52 UTC), vista da Sapporo
  // nella notte del 1 gennaio. Contatti (minuti dal massimo): penombra ±168,
  // parziale ±105, totalità ±36. La Luna sta fra 55° e 70° per tutto il
  // racconto: il cielo non ha niente davanti.
  // Dieci tempi: l'attesa, il morso, la totalità, le stelle che tornano;
  // poi da fuori il cono, il bersaglio centrato, la Terra vista dalla Luna;
  // e di nuovo a terra l'uscita e il congedo.
  scene planetarium_view {
    // L'attesa: il campo si stringe dalla notte di festa alla Luna piena.
    duration: 16s;
    action: narrate { id: 'demo.narr.eclisse_lunare.1' };
    action: set_location { lat: 43.0618, lon: 141.3545, name: 'Sapporo', timezone: 'Asia/Tokyo' };
    action: set_date { iso: '2028-12-31T14:07:00Z' };
    action: event_window { event: lunar_eclipse, from: -165, to: -125 };
    action: zoom_fov { from: 55, to: 8 };
    action: center_target { target: 'Moon' };
  }
  scene planetarium_view {
    // Il primo morso dell'ombra (contatto parziale a −105 min).
    duration: 20s;
    action: narrate { id: 'demo.narr.eclisse_lunare.2' };
    action: event_window { event: lunar_eclipse, from: -125, to: -40 };
    action: zoom_fov { from: 8, to: 3 };
    action: center_target { target: 'Moon' };
  }
  scene planetarium_view {
    // L'ultimo spicchio si spegne: totalità a −36 min, e la Luna si fa rame.
    duration: 20s;
    action: narrate { id: 'demo.narr.eclisse_lunare.3' };
    action: event_window { event: lunar_eclipse, from: -40, to: 5 };
    action: zoom_fov { from: 3, to: 1.2 };
    action: center_target { target: 'Moon' };
  }
  scene planetarium_view {
    // Dentro la totalità il campo si riapre: senza la Luna piena
    // abbagliante, attorno tornano le stelle.
    duration: 20s;
    action: narrate { id: 'demo.narr.eclisse_lunare.4' };
    action: event_window { event: lunar_eclipse, from: 5, to: 30 };
    action: zoom_fov { from: 1.2, to: 40 };
    action: center_target { target: 'Moon' };
  }
  scene transition {
    duration: 6s;
    action: narrate { id: 'demo.narr.eclisse_lunare.5' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Da fuori: Sole, Terra e Luna in fila, e il cono d'ombra della Terra.
    duration: 16s;
    action: narrate { id: 'demo.narr.eclisse_lunare.6' };
    action: event_window { event: lunar_eclipse, from: -170, to: -110 };
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 40, elev_from: 3, elev_to: 18, zoom_from: 0.9, zoom_to: 1 };
  }
  scene solar_system_3d {
    // La Luna attraversa davvero il cono, e la camera le gira attorno.
    duration: 22s;
    action: narrate { id: 'demo.narr.eclisse_lunare.7' };
    action: event_window { event: lunar_eclipse, from: -110, to: 130 };
    action: camera_3d { scene: earth_moon, focus: 'Moon', orbit: 50, elev_from: 18, elev_to: 8, zoom_from: 1.6, zoom_to: 3.2 };
  }
  scene solar_system_3d {
    // Attorno al massimo, con la Terra al centro: il disco nero davanti al
    // Sole che si vedrebbe dalla Luna, e l'anello dei tramonti.
    duration: 20s;
    action: narrate { id: 'demo.narr.eclisse_lunare.8' };
    action: event_window { event: lunar_eclipse, from: -12, to: 12 };
    action: camera_3d { scene: earth_moon, focus: 'Earth', orbit: -45, elev_from: 8, elev_to: 3, zoom_from: 1.2, zoom_to: 4 };
  }
  scene planetarium_view {
    // Di nuovo da Sapporo: il primo filo d'argento, e l'ombra che si ritira.
    duration: 20s;
    action: narrate { id: 'demo.narr.eclisse_lunare.9' };
    action: set_fov { degrees: 3 };
    action: event_window { event: lunar_eclipse, from: 30, to: 170 };
    action: center_target { target: 'Moon' };
  }
  scene planetarium_view {
    // Il congedo: la Luna intera, e il campo che si riapre sulla notte.
    duration: 18s;
    action: narrate { id: 'demo.narr.eclisse_lunare.10' };
    action: event_window { event: lunar_eclipse, from: 170, to: 200 };
    action: zoom_fov { from: 3, to: 60 };
    action: center_target { target: 'Moon' };
  }
}`
    },
    {
      chiave: 'aurora_boreale',
      testo: `define_demo 'aurora_boreale' {
  // Un racconto in quattro tempi: il Sole, il viaggio, lo scudo e la luce.
  // Prima il Sole vero, dal planetario; poi il perché, col banco delle
  // aurore della Didattica (vento, scudo, coda, anello, e il taglio coi
  // colori alle loro quote); infine il cielo di Helsinki con Kp 5 simulato:
  // una simulazione didattica, non una previsione.
  // Helsinki e non Tromsø, di proposito: con Kp 5 a mezzanotte magnetica
  // Tromsø sta sotto l'ovale e l'aurora le passa sopra la testa e a sud; da
  // sessanta gradi di latitudine l'ovale è davvero a nord, alto sull'orizzonte.
  // La data del Sole è due giorni prima della notte dell'aurora: è il tempo
  // di viaggio della nube che il banco racconta.
  scene planetarium_view {
    // Il Sole com'è: il campo si stringe fino al disco, granuli e corona.
    duration: 13s;
    action: narrate { id: 'demo.narr.aurora_boreale.1' };
    action: set_location { lat: 60.194, lon: 24.916, name: 'Helsinki', timezone: 'Europe/Helsinki' };
    action: set_date { iso: '2027-01-13T10:20:00Z' };
    action: zoom_fov { from: 50, to: 1.3 };
    action: center_target { target: 'Sun' };
  }
  scene didactic_view {
    // Il vento di tutti i giorni: prima che la nube parta davvero.
    duration: 17s;
    action: narrate { id: 'demo.narr.aurora_boreale.2' };
    action: aurora_lesson { chapter: vento, from: 0, to: 3, orbit: 10, zoom_from: 1, zoom_to: 1.08 };
  }
  scene didactic_view {
    // La nube attraversa lo spazio: quarantaquattro ore in sedici secondi.
    duration: 16s;
    action: narrate { id: 'demo.narr.aurora_boreale.3' };
    action: aurora_lesson { chapter: vento, from: 3, to: 44, orbit: 20, zoom_from: 1.08, zoom_to: 1.18 };
  }
  scene didactic_view {
    // La camera gira attorno alla Terra: la bolla magnetica prima dell'urto.
    duration: 15s;
    action: narrate { id: 'demo.narr.aurora_boreale.4' };
    action: aurora_lesson { chapter: scudo, from: 38, to: 44.5, orbit: 120, elev_from: 14, elev_to: 32 };
  }
  scene didactic_view {
    // Più vicino: lo scudo si schiaccia sotto la nube.
    duration: 14s;
    action: narrate { id: 'demo.narr.aurora_boreale.5' };
    action: aurora_lesson { chapter: scudo, from: 44.5, to: 50, orbit: 20, zoom_from: 1.2, zoom_to: 2.3 };
  }
  scene didactic_view {
    // Il lato della notte: la coda si carica e si rompe.
    duration: 15s;
    action: narrate { id: 'demo.narr.aurora_boreale.6' };
    action: aurora_lesson { chapter: scarica, from: 45.2, to: 52, orbit: 25, zoom_from: 1, zoom_to: 1.4 };
  }
  scene didactic_view {
    // L'anello attorno al polo, e la Terra che ci gira sotto.
    duration: 15s;
    action: narrate { id: 'demo.narr.aurora_boreale.7' };
    action: aurora_lesson { chapter: anello, from: 48, to: 56, orbit: 150, elev_from: 40, elev_to: 64, zoom_from: 1, zoom_to: 1.25 };
  }
  scene didactic_view {
    // Il taglio visto di lato, a scala vera: le quote e i loro colori.
    duration: 19s;
    action: narrate { id: 'demo.narr.aurora_boreale.8' };
    action: aurora_lesson { chapter: taglio, from: 50, to: 50, place: reykjavik, kp: 5 };
  }
  scene planetarium_view {
    // Di nuovo a terra: la notte dell'aurora, e lo sguardo verso nord.
    duration: 12s;
    action: narrate { id: 'demo.narr.aurora_boreale.9' };
    action: set_location { lat: 60.1699, lon: 24.9384, name: 'Helsinki', timezone: 'Europe/Helsinki' };
    action: set_date { iso: '2027-01-15T19:00:00Z' };
    action: simulate_aurora { kp: 5 };
    action: zoom_fov { from: 60, to: 100 };
    action: point_view { az: 0, alt: 22 };
  }
  scene planetarium_view {
    // Le ore migliori, attorno alla mezzanotte magnetica.
    duration: 18s;
    action: narrate { id: 'demo.narr.aurora_boreale.10' };
    action: set_fov { degrees: 100 };
    action: timelapse { start: 21:00, end: 23:00 };
    action: point_view { az: 0, alt: 22 };
  }
  scene planetarium_view {
    // Il congedo: il campo si allarga, e l'aurora resta in scena.
    duration: 19s;
    action: narrate { id: 'demo.narr.aurora_boreale.11' };
    action: zoom_fov { from: 100, to: 125 };
    action: timelapse { start: 23:00, end: 00:30 };
    action: point_view { az: 0, alt: 26 };
  }
}`
    },
    {
      chiave: 'allineamento_pianeti',
      testo: `define_demo 'allineamento_pianeti' {
  // Tucson, alba del 21 ottobre 2028: quattro pianeti nel cielo orientale,
  // e Saturno che tramonta a ovest. Alle 05:45 locali (12:45 UTC) Marte è a
  // 49°, Venere a 25°, Mercurio a 7°, Giove a 6°, Saturno a 20° dall'altra
  // parte del cielo; il Sole sorge verso le 06:30.
  // Dieci tempi: il buio, la fila, tre pianeti da vicino (Giove, Venere,
  // Saturno), la strada dell'eclittica; poi da fuori la pianta e il taglio
  // del Sistema Solare; e l'alba che li spegne.
  scene planetarium_view {
    // Il deserto al buio, guardando a est: la fila sta salendo.
    duration: 16s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.1' };
    action: set_location { lat: 32.2226, lon: -110.9747, name: 'Tucson', timezone: 'America/Phoenix' };
    action: set_date { iso: '2028-10-21T12:30:00Z' };
    action: timelapse { start: 05:30, end: 05:45 };
    action: zoom_fov { from: 130, to: 90 };
    action: point_view { az: 100, alt: 18 };
  }
  scene planetarium_view {
    // La fila, pianeta per pianeta.
    duration: 22s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.2' };
    action: timelapse { start: 05:45, end: 05:52 };
    action: frame_objects { names: 'Mercury,Venus,Mars,Jupiter' };
    action: highlight_object { name: 'Mercury', scale: 3 };
    action: highlight_object { name: 'Venus', scale: 3 };
    action: highlight_object { name: 'Mars', scale: 3 };
    action: highlight_object { name: 'Jupiter', scale: 3 };
  }
  scene planetarium_view {
    // Giove da vicino: le bande di nubi.
    duration: 17s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.3' };
    action: timelapse { start: 05:52, end: 05:54 };
    action: zoom_fov { from: 40, to: 0.25 };
    action: center_target { target: 'Jupiter' };
  }
  scene planetarium_view {
    // Venere da vicino: non è tonda, è gibbosa.
    duration: 16s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.4' };
    action: timelapse { start: 05:54, end: 05:56 };
    action: zoom_fov { from: 40, to: 0.25 };
    action: center_target { target: 'Venus' };
  }
  scene planetarium_view {
    // Mezzo giro: Saturno e i suoi anelli, bassi a ovest.
    duration: 17s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.5' };
    action: timelapse { start: 05:56, end: 05:58 };
    action: zoom_fov { from: 60, to: 0.25 };
    action: center_target { target: 'Saturn' };
  }
  scene planetarium_view {
    // Di nuovo la fila: la strada dell'eclittica, e il Sole che arriva.
    duration: 21s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.6' };
    action: timelapse { start: 05:58, end: 06:05 };
    action: frame_objects { names: 'Mercury,Venus,Mars,Jupiter' };
    action: highlight_object { name: 'Mercury', scale: 3 };
    action: highlight_object { name: 'Venus', scale: 3 };
    action: highlight_object { name: 'Mars', scale: 3 };
    action: highlight_object { name: 'Jupiter', scale: 3 };
  }
  scene transition {
    duration: 6s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.7' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Da sopra il piano: i pianeti sono su orbite diverse, e la fila in
    // cielo è solo la direzione in cui li vediamo dalla Terra.
    duration: 20s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.8' };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Mercury,Venus,Earth,Mars,Jupiter', orbit: 70, elev_from: 80, elev_to: 12, zoom_from: 0.9, zoom_to: 1.15 };
  }
  scene solar_system_3d {
    // Di taglio: il Sistema Solare è un disco sottile.
    duration: 18s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.9' };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Mercury,Venus,Earth,Mars,Jupiter', orbit: 50, elev_from: 12, elev_to: 3, zoom_from: 1.15, zoom_to: 1.2 };
  }
  scene planetarium_view {
    // L'alba: i pianeti si spengono uno a uno, Venere per ultima.
    duration: 20s;
    action: narrate { id: 'demo.narr.allineamento_pianeti.10' };
    action: timelapse { start: 06:05, end: 06:30 };
    action: frame_objects { names: 'Mercury,Venus,Mars,Jupiter' };
    action: highlight_object { name: 'Mercury', scale: 3 };
    action: highlight_object { name: 'Venus', scale: 3 };
    action: highlight_object { name: 'Mars', scale: 3 };
    action: highlight_object { name: 'Jupiter', scale: 3 };
  }
}`
    },
    {
      chiave: 'passaggio_iss',
      testo: `define_demo 'passaggio_iss' {
  // Il prossimo passaggio della ISS sopra il luogo del planetario, calcolato
  // dall'app coi dati orbitali aggiornati, raccontato a capitoli: l'arco
  // intero, il culmine inseguito da vicino (il modellino), lo stesso
  // intervallo da fuori, mezz'ora di orbita, e il congedo in cielo.
  scene planetarium_view {
    duration: 22s;
    action: narrate { id: 'demo.narr.passaggio_iss.1' };
    action: satellite_pass { satellite: iss, before: 1, after: 1 };
  }
  scene planetarium_view {
    // Il culmine, inseguito con un campo da telescopio.
    duration: 18s;
    action: narrate { id: 'demo.narr.passaggio_iss.2' };
    action: satellite_pass { satellite: iss, before: 1, after: 1, from: 0.4, to: 0.6, track: 0.25 };
  }
  scene transition {
    duration: 6s;
    action: narrate { id: 'demo.narr.passaggio_iss.3' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Lo stesso intervallo della prima scena, visto da fuori.
    duration: 20s;
    action: narrate { id: 'demo.narr.passaggio_iss.4' };
    action: satellite_pass { satellite: iss, before: 1, after: 1 };
    action: camera_3d { scene: system, focus: 'ISS', orbit: 80, elev_from: 15, elev_to: 45, zoom_from: 0.8, zoom_to: 1.3 };
  }
  scene solar_system_3d {
    // Più largo e più lungo: più di mezz'ora di orbita attorno al pianeta.
    duration: 20s;
    action: narrate { id: 'demo.narr.passaggio_iss.5' };
    action: satellite_pass { satellite: iss, before: 15, after: 15 };
    action: camera_3d { scene: system, focus: 'ISS', orbit: 140, elev_from: 45, elev_to: 25, zoom_from: 1.3, zoom_to: 0.5 };
  }
  scene planetarium_view {
    // Il congedo: l'ultimo tratto dell'arco, a campo largo.
    duration: 18s;
    action: narrate { id: 'demo.narr.passaggio_iss.6' };
    action: satellite_pass { satellite: iss, before: 1, after: 1, from: 0.6, to: 1 };
  }
}`
    },
    {
      chiave: 'solstizi_equinozi',
      testo: `define_demo 'solstizi_equinozi' {
  // Perché esistono le stagioni: non la distanza dal Sole, ma l'asse della
  // Terra inclinato di 23,4° che resta parallelo a sé stesso lungo l'orbita.
  // Un anno di riferimento solo, in ordine: solstizio di giugno 2027
  // (21 giugno, 14:11 UTC), solstizio di dicembre 2027 (22 dicembre, 02:42),
  // equinozio di marzo 2028 (20 marzo) ed equinozio di settembre 2028
  // (22 settembre). Gli istanti non sono scritti a mano: li cerca
  // event_window con Astronomy.Seasons, a partire dalla data della scena.
  // Il luogo è Roma (41,9° N): a mezzogiorno il Sole sta a 71,5° a giugno,
  // 48° agli equinozi e 24,7° a dicembre; il giorno dura 15 h 14 min,
  // circa 12 h e 9 h 09 min. Ogni scena apre il cartello con la sua data.
  scene planetarium_view {
    // La domanda: Roma a mezzogiorno del giorno più lungo.
    duration: 18s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.1' };
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { iso: '2027-06-21T09:40:00Z' };
    action: timelapse { start: 11:40, end: 12:20 };
    action: zoom_fov { from: 110, to: 70 };
    action: center_target { target: 'Sun' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.roma' };
  }
  scene transition {
    duration: 7s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.2' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // L'asse: la camera gira attorno alla Terra e finisce di fianco, dove
    // l'inclinazione rispetto alla perpendicolare all'orbita si legge intera.
    duration: 20s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.3' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.asse', time: hide };
    action: earth_axis { parallel: 41.9 };
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 70, orbit: -70, elev_from: 30, elev_to: 2, zoom_from: 0.8, zoom_to: 1.8 };
  }
  scene solar_system_3d {
    // Un anno intero con la camera ferma nello spazio: l'asse non cambia
    // direzione, e la distanza cambia appena (più vicini a gennaio). La
    // cornice di serie arriva fino a Saturno (SOL_ENTRATA_UA): lo zoom 2,3
    // la stringe sulla sola orbita della Terra.
    duration: 26s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.4' };
    action: date_range { from: '2027-06-21T12:00:00Z', to: '2028-06-20T12:00:00Z' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.anno', time: hide, distance: show };
    action: earth_axis {};
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 0, elev_from: 38, elev_to: 50, zoom_from: 2.3, zoom_to: 2.3 };
  }
  scene solar_system_3d {
    // Solstizio di giugno: Sole a sinistra, polo nord verso di lui; il
    // parallelo di Roma è quasi tutto al giorno.
    duration: 22s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.5' };
    action: set_date { iso: '2027-06-21T00:00:00Z' };
    action: event_window { event: june_solstice, from: -240, to: 240 };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.estate' };
    action: earth_axis { parallel: 41.9 };
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 0, orbit: 35, elev_from: 10, elev_to: 18, zoom_from: 1.6, zoom_to: 2.2 };
  }
  scene solar_system_3d {
    // Sei mesi di orbita: l'asse resta parallelo a sé stesso.
    duration: 12s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.6' };
    action: date_range { from: '2027-06-22T00:00:00Z', to: '2027-12-21T00:00:00Z' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.viaggio', time: hide, distance: show };
    action: earth_axis {};
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 0, elev_from: 50, elev_to: 36, zoom_from: 2.3, zoom_to: 2.3 };
  }
  scene solar_system_3d {
    // Solstizio di dicembre: la stessa camera, il Sole sempre a sinistra, e
    // il polo nord che adesso guarda dall'altra parte.
    duration: 22s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.7' };
    action: set_date { iso: '2027-12-21T00:00:00Z' };
    action: event_window { event: december_solstice, from: -240, to: 240 };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.inverno' };
    action: earth_axis { parallel: 41.9 };
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 0, orbit: 35, elev_from: 10, elev_to: 18, zoom_from: 1.6, zoom_to: 2.2 };
  }
  scene solar_system_3d {
    // Equinozio di marzo: la camera parte di fianco (l'asse pende verso di
    // noi) e gira fino a guardare dalla parte del Sole (l'asse pende di lato).
    duration: 20s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.8' };
    action: set_date { iso: '2028-03-20T00:00:00Z' };
    action: event_window { event: march_equinox, from: -240, to: 240 };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.primavera' };
    action: earth_axis { parallel: 41.9 };
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 0, orbit: 70, elev_from: 8, elev_to: 12, zoom_from: 1.8, zoom_to: 2 };
  }
  scene solar_system_3d {
    // Equinozio di settembre, dall'altra parte dell'orbita: il giro inverso.
    duration: 18s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.9' };
    action: set_date { iso: '2028-09-22T00:00:00Z' };
    action: event_window { event: september_equinox, from: -240, to: 240 };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.autunno' };
    action: earth_axis { parallel: 41.9 };
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 70, orbit: -70, elev_from: 12, elev_to: 8, zoom_from: 2, zoom_to: 1.8 };
  }
  scene planetarium_view {
    // Di nuovo a Roma, il 21 giugno: il Sole dall'alba al tramonto, con la
    // vista che lo segue in azimut e il suolo fermo in basso. Lo sguardo sta
    // a 18° e il campo a 125°: così l'orizzonte resta sopra ai sottotitoli e
    // il Sole di mezzogiorno (71,5°) resta dentro al riquadro.
    duration: 22s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.10' };
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { iso: '2027-06-21T02:30:00Z' };
    action: timelapse { start: 05:00, end: 21:30 };
    action: set_fov { degrees: 125 };
    action: track_azimuth { target: 'Sun', alt: 18 };
    action: sun_paths { dates: '2027-06-21' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.cieloEstate', sun: show };
  }
  scene planetarium_view {
    // Il 22 dicembre, stesso posto e stessa camera: l'arco basso e corto,
    // con quello di giugno ancora disegnato sopra.
    duration: 20s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.11' };
    action: set_date { iso: '2027-12-22T05:00:00Z' };
    action: timelapse { start: 07:00, end: 17:30 };
    action: set_fov { degrees: 125 };
    action: track_azimuth { target: 'Sun', alt: 18 };
    action: sun_paths { dates: '2027-06-21,2027-12-22' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.cieloInverno', sun: show };
  }
  scene planetarium_view {
    // L'equinozio di marzo: est esatto, ovest esatto, e l'arco nel mezzo.
    duration: 20s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.12' };
    action: set_date { iso: '2028-03-20T04:00:00Z' };
    action: timelapse { start: 06:00, end: 18:45 };
    action: set_fov { degrees: 125 };
    action: track_azimuth { target: 'Sun', alt: 18 };
    action: sun_paths { dates: '2027-06-21,2028-03-20,2027-12-22' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.cieloEquinozio', sun: show };
  }
  scene planetarium_view {
    // I tre archi insieme, a campo largo verso sud, attorno a mezzogiorno.
    duration: 18s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.13' };
    action: set_date { iso: '2028-03-20T11:10:00Z' };
    action: zoom_fov { from: 115, to: 150 };
    action: point_view { az: 180, alt: 34 };
    action: sun_paths { dates: '2027-06-21,2028-03-20,2027-12-22' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.confronto', time: hide };
  }
  scene planetarium_view {
    // Tromsø (69,6° N) al solstizio di giugno: a mezzanotte il Sole passa a
    // nord, circa tre gradi sopra l'orizzonte, e non tramonta.
    duration: 18s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.14' };
    action: set_location { lat: 69.6492, lon: 18.9553, name: 'Tromsø', timezone: 'Europe/Oslo' };
    action: set_date { iso: '2027-06-21T17:00:00Z' };
    action: timelapse { start: 20:00, end: 04:00 };
    action: set_fov { degrees: 115 };
    action: track_azimuth { target: 'Sun', alt: 14 };
    action: sun_paths { dates: '2027-06-21' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.tromso', sun: show };
  }
  scene transition {
    duration: 7s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.15' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Il riepilogo: un anno intero, con la camera che gira attorno al Sole.
    duration: 22s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.16' };
    action: date_range { from: '2027-06-21T12:00:00Z', to: '2028-06-20T12:00:00Z' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.riepilogo', time: hide };
    action: earth_axis {};
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 120, elev_from: 24, elev_to: 44, zoom_from: 2, zoom_to: 2.4 };
  }
}`
    },
    {
      chiave: 'voyager',
      testo: `define_demo 'voyager' {
  // Il viaggio delle due Voyager, raccontato come lo avrebbe raccontato Carl
  // Sagan: la fila dei giganti del 1977, i due lanci, Giove, Saturno e
  // Titano, i dodici anni di Voyager 2 fino a Nettuno, la forma a V della
  // fuga, il pallido puntino blu, il Disco d'Oro, e dove stanno stasera.
  // Le posizioni non sono disegnate a mano: sono le coniche raccordate di
  // app.js (\`solPosizioneVoyager\`), archi di Lambert fra le posizioni vere
  // dei pianeti nei giorni veri degli incontri, e iperboli di flyby vicino a
  // ogni pianeta. Il modellino tiene l'antenna puntata sulla Terra.
  // In ogni scena 3D \`voyager_journey\` viene prima di \`camera_3d\`: lo zoom
  // di base della camera si misura col metro delle distanze che lei sceglie.
  scene planetarium_view {
    // Cape Canaveral prima dell'alba: Venere, Marte e Giove a est.
    duration: 18s;
    action: narrate { id: 'demo.narr.voyager.1' };
    action: set_location { lat: 28.5236, lon: -80.6508, name: 'Cape Canaveral', timezone: 'America/New_York' };
    action: set_date { iso: '1977-08-20T08:30:00Z' };
    action: timelapse { start: 04:30, end: 05:40 };
    action: zoom_fov { from: 120, to: 75 };
    action: frame_objects { names: 'Venus,Mars,Jupiter' };
    action: date_card { label: 'demo.cartello.voyager.capo', time: hide };
  }
  scene transition {
    duration: 7s;
    action: narrate { id: 'demo.narr.voyager.2' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Il piano: le strade future tratteggiate, da un gigante all'altro.
    duration: 20s;
    action: narrate { id: 'demo.narr.voyager.3' };
    action: voyager_journey { from: '1977-08-20T15:00:00Z', to: '1977-09-06T12:00:00Z', future: show, model_from: 0 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn,Uranus,Neptune', orbit: 50, elev_from: 75, elev_to: 32, zoom_from: 0.95, zoom_to: 1.05 };
    action: date_card { label: 'demo.cartello.voyager.piano', time: hide };
  }
  scene solar_system_3d {
    // I due lanci, a distanze e dimensioni vere, in quattro riprese dentro
    // alla stessa frase (\`shot_from\`/\`shot_to\`). Prima Voyager 2, il 20
    // agosto: la camera guarda di traverso alla sua strada (\`profile\`), e
    // la sonda si stacca dal bordo della Terra e attraversa l'aria, che è
    // disegnata col suo nome (\`launch: show\`): quando ne esce, un anello
    // lo segna. Poi lo stacco al 5 settembre e la stessa ripresa per Voyager
    // 1. Poi la camera si allarga finché ci stanno tutte e due (\`keep\`):
    // la gemella è già a quattordici milioni di chilometri. Infine si stringe
    // sulla Voyager 1, finché il modellino mostra l'antenna rivolta a casa.
    // Le date cominciano dodici secondi prima che la sonda bucasse la
    // superficie nel modello (che la fa partire dal centro della Terra).
    duration: 24s;
    action: narrate { id: 'demo.narr.voyager.4' };
    action: voyager_journey { from: '1977-08-20T14:39:15Z', to: '1977-08-20T15:15:00Z', probes: 'voyager2', scale: real, ease: log, model_from: 0.12, trail: earth, milestones: hide, launch: show, shot_to: 0.15 };
    action: camera_3d { scene: system, focus: 'Voyager 2', frame_with: 'Earth', profile: show, orbit: 12, elev_from: 4, elev_to: 10, zoom_from: 1.15, zoom_to: 0.95, shot_to: 0.15 };
    action: voyager_journey { from: '1977-09-05T13:06:05Z', to: '1977-09-18T00:00:00Z', probes: 'voyager1,voyager2', scale: real, ease: log, ease_rate: 30000, model_from: 0.012, model_to: 0.17, model_start: 0.55, gaze: show, home: show, trail: earth, milestones: hide, launch: show, shot_from: 0.15 };
    action: camera_3d { scene: system, focus: 'Voyager 1', frame_with: 'Earth', profile: show, orbit: 12, elev_from: 4, elev_to: 10, zoom_from: 1.15, zoom_to: 0.95, shot_from: 0.15, shot_to: 0.4 };
    action: camera_3d { scene: system, focus: 'Voyager 1', keep: 'Earth,Voyager 1,Voyager 2', orbit: 26, elev_from: 34, elev_to: 24, blend: 0.45, shot_from: 0.4, shot_to: 0.62 };
    action: camera_3d { scene: system, focus: 'Voyager 1', frame_with: 'Earth', orbit: 24, elev_from: 22, elev_to: 12, zoom_from: 1, zoom_to: 60, zoom_start: 0.2, blend: 0.3, shot_from: 0.62 };
    action: date_card { label: 'demo.cartello.voyager.lancio2', time: hide, shot_to: 0.15 };
    action: date_card { label: 'demo.cartello.voyager.lancio', time: hide, shot_from: 0.15 };
  }
  scene solar_system_3d {
    // Diciotto mesi di salita verso Giove, in tre riprese legate fra loro
    // (\`blend\`): la salita vista dall'alto; la camera che scende sulle due
    // sonde per il sorpasso (\`race: show\`: i due archi della distanza dal
    // Sole, che si scambiano il 15 dicembre 1977, quando la voce lo dice);
    // e la camera che si riapre fino a tenere Giove davanti alle sonde.
    duration: 20s;
    action: narrate { id: 'demo.narr.voyager.5' };
    action: voyager_journey { from: '1977-09-18T00:00:00Z', to: '1977-12-04T00:00:00Z', future: show, model_from: 0.035, shot_to: 0.3 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth,Mars,Jupiter', orbit: 20, elev_from: 62, elev_to: 52, zoom_from: 1.05, zoom_to: 1.3, shot_to: 0.3 };
    action: voyager_journey { from: '1977-12-04T00:00:00Z', to: '1978-01-05T00:00:00Z', future: show, model_from: 0.05, model_to: 0.07, race: show, milestones: hide, shot_from: 0.3, shot_to: 0.68 };
    action: camera_3d { scene: system, focus: 'Voyager 1', keep: 'Voyager 1,Voyager 2', orbit: 18, elev_from: 78, elev_to: 66, zoom_from: 0.3, zoom_to: 0.4, blend: 0.4, shot_from: 0.3, shot_to: 0.68 };
    action: voyager_journey { from: '1978-01-05T00:00:00Z', to: '1979-03-01T00:00:00Z', future: show, model_from: 0.035, ease: smooth, shot_from: 0.68 };
    action: camera_3d { scene: system, focus: 'Voyager 1', keep: 'Voyager 1,Voyager 2,Jupiter', orbit: 16, elev_from: 40, elev_to: 34, blend: 0.5, shot_from: 0.68 };
    action: date_card { label: 'demo.cartello.voyager.salita', time: hide };
  }
  scene solar_system_3d {
    // Giove, a distanze e dimensioni vere: la curva della fionda. La camera
    // tiene insieme la sonda e il pianeta e si stringe con loro, guardando il
    // piano dell'iperbole quasi di fronte; il tempo rallenta al perielio.
    duration: 26s;
    action: narrate { id: 'demo.narr.voyager.6' };
    action: voyager_journey { from: '1979-03-04T12:00:00Z', to: '1979-03-06T12:00:00Z', probes: 'voyager1', scale: real, ease: flyby, future: show, model_from: 0.05, milestones: hide };
    action: camera_3d { scene: system, focus: 'Voyager 1', frame_with: 'Jupiter', flyby_tilt: 28, orbit: 30, elev_from: 4, elev_to: -6 };
    action: date_card { label: 'demo.cartello.voyager.giove', time: hide };
  }
  scene solar_system_3d {
    // Saturno e Titano: la fionda che la porta fuori dal piano.
    duration: 24s;
    action: narrate { id: 'demo.narr.voyager.7' };
    action: voyager_journey { from: '1980-11-12T06:00:00Z', to: '1980-11-13T18:00:00Z', probes: 'voyager1', scale: real, ease: flyby, future: show, model_from: 0.05, milestones: hide };
    action: camera_3d { scene: system, focus: 'Voyager 1', frame_with: 'Saturn', flyby_tilt: 32, orbit: -30, elev_from: 6, elev_to: -4 };
    action: date_card { label: 'demo.cartello.voyager.saturno', time: hide };
  }
  scene solar_system_3d {
    // Voyager 2 da sola: Saturno, Urano, Nettuno. La camera la segue e si
    // stringe su ogni gigante che sfiora — il tempo rallenta a ogni sorvolo
    // e torna a correre negli anni di mezzo — fino all'arrivo da Nettuno.
    duration: 28s;
    action: narrate { id: 'demo.narr.voyager.8' };
    action: voyager_journey { from: '1980-11-14T00:00:00Z', to: '1989-08-24T16:00:00Z', probes: 'voyager2', scale: real, future: show, model_from: 0.035, ease: flyby };
    action: camera_3d { scene: system, focus: 'Voyager 2', frame_with: 'auto', orbit: 50, elev_from: 30, elev_to: 18 };
    action: date_card { label: 'demo.cartello.voyager.giganti', time: hide };
  }
  scene solar_system_3d {
    // Nettuno e Tritone: il sorvolo più stretto del viaggio, cinquemila
    // chilometri sopra le nubi. A grandezza vera la sonda rasenta il disco.
    duration: 26s;
    action: narrate { id: 'demo.narr.voyager.9' };
    action: voyager_journey { from: '1989-08-24T16:00:00Z', to: '1989-08-25T16:00:00Z', probes: 'voyager2', scale: real, ease: flyby, future: show, model_from: 0.05, milestones: hide };
    action: camera_3d { scene: system, focus: 'Voyager 2', frame_with: 'Neptune', flyby_tilt: 24, orbit: 36, elev_from: 4, elev_to: -6 };
    action: date_card { label: 'demo.cartello.voyager.nettuno', time: hide };
  }
  scene solar_system_3d {
    // La V: una sopra il piano, una sotto; l'eliopausa nel 2012.
    duration: 22s;
    action: narrate { id: 'demo.narr.voyager.10' };
    action: voyager_journey { from: '1989-09-01T00:00:00Z', to: '2012-08-25T00:00:00Z', model_from: 0.035 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Neptune', orbit: 70, elev_from: 30, elev_to: 6, zoom_from: 0.95, zoom_to: 0.55 };
    action: date_card { label: 'demo.cartello.voyager.fuga', time: hide };
  }
  scene solar_system_3d {
    // Il pallido puntino blu: da quaranta unità astronomiche, verso casa.
    // È la scena più lunga di proposito: le parole di Sagan su quella
    // fotografia hanno bisogno di silenzio attorno, e tagliarle a metà
    // vorrebbe dire perdere proprio quelle.
    duration: 34s;
    action: narrate { id: 'demo.narr.voyager.11' };
    action: voyager_journey { from: '1990-02-13T00:00:00Z', to: '1990-02-15T00:00:00Z', probes: 'voyager1', model_from: 0.17, model_to: 0.22, home: show, gaze: show, proportion: free };
    action: camera_3d { scene: system, focus: 'Voyager 1', probe_az: -105, orbit: 25, elev_from: -4, elev_to: 4, zoom_from: 1.05, zoom_to: 0.95 };
    action: date_card { label: 'demo.cartello.voyager.puntino', time: hide };
  }
  scene solar_system_3d {
    // Il Disco d'Oro: la camera parte dalla sonda intera e si avvicina al
    // fianco dove il disco è montato, che resta al centro del quadro e si
    // accende; accanto compare la copertina vera, legata al disco da un filo.
    duration: 26s;
    action: narrate { id: 'demo.narr.voyager.12' };
    action: voyager_journey { from: 'now-280d', to: 'now', probes: 'voyager1', model_from: 0.42, model_to: 3.4, model_end: 0.5, milestones: hide, proportion: free, record: show };
    action: camera_3d { scene: system, focus: 'Voyager 1', probe_az: 22, orbit: -16, elev_from: 10, elev_to: 2, zoom_from: 40, zoom_to: 50 };
    action: golden_record { at: 0.3 };
    action: date_card { label: 'demo.cartello.voyager.disco', time: hide };
  }
  scene solar_system_3d {
    // Oggi: tutto il viaggio in un colpo d'occhio.
    duration: 20s;
    action: narrate { id: 'demo.narr.voyager.13' };
    action: voyager_journey { from: 'now', to: 'now+365d', model_from: 0.035 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Neptune', orbit: 60, elev_from: 14, elev_to: 32, zoom_from: 0.52, zoom_to: 0.6 };
    action: date_card { label: 'demo.cartello.voyager.oggi', time: hide };
  }
  scene planetarium_view {
    // Roma, stasera (il giorno in cui si guarda la demo): dove guardare.
    // Voyager 1 fra Ercole e l'Ofiuco, con la camera puntata su di lei.
    duration: 20s;
    action: narrate { id: 'demo.narr.voyager.14' };
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { tonight: '21:00' };
    action: probe_markers {};
    action: zoom_fov { from: 110, to: 30 };
    action: point_view { probe: 'voyager1' };
    action: date_card { label: 'demo.cartello.voyager.stasera', time: hide };
  }
  scene planetarium_view {
    // Il congedo: il campo si riapre sulla notte.
    duration: 20s;
    action: narrate { id: 'demo.narr.voyager.15' };
    action: probe_markers {};
    action: timelapse { start: 21:00, end: 21:45 };
    action: zoom_fov { from: 30, to: 125 };
    action: point_view { probe: 'voyager1', alt: -3 };
  }
}`
    },
    {
      chiave: 'universo',
      testo: `define_demo 'universo' {
  // Dalla Terra all'universo osservabile: quanto è grande, detto a passi.
  // Si parte dal cielo di stasera sopra casa (il luogo dell'app, nessun
  // set_location), si sale col volo del planetario fino addosso alla Terra,
  // e da lì la scala cosmica (\`cosmic_scale\`, scala-cosmica.js) — una
  // carta sola, alla misura vera, dalla Terra all'universo (v404) — si
  // allarga di decade in decade: la Luna, il Sole, i giganti, la bolla del
  // Sole e via fino all'universo osservabile; poi torna indietro in un fiato
  // fino alla Terra e atterra nel cielo di casa col volo all'indietro. Ogni
  // scena apre il cartello con la misura e il tempo della luce: è il metro
  // che rende confrontabili scale lontane venti ordini di grandezza. Le
  // scene cosmiche di fila sono un volo solo: la carta resta aperta fra
  // l'una e l'altra e la camera riparte da dove era.
  scene planetarium_view {
    // Il cielo di stasera, guardando in su: la cupola che sembra vicina.
    duration: 20s;
    action: narrate { id: 'demo.narr.universo.1' };
    action: set_date { tonight: '21:30' };
    action: timelapse { start: 21:30, end: 22:10 };
    action: zoom_fov { from: 70, to: 125 };
    action: point_view { az: 180, alt: 55 };
    action: date_card { label: 'demo.cartello.universo.casa', time: show };
  }
  scene transition {
    // Cento chilometri: l'aria finisce e il blu diventa nero.
    duration: 8s;
    action: narrate { id: 'demo.narr.universo.2' };
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // La Terra da vicino: coste, notte e luci delle città, l'aria di taglio.
    // Da qui (v404) il viaggio è una carta sola, alla misura vera: la scala
    // cosmica prende la Terra della vista 3D alla stessa misura e con la
    // stessa camera (\`from: arrival\`), e non la lascia più fino al ritorno.
    duration: 22s;
    action: narrate { id: 'demo.narr.universo.3' };
    action: cosmic_scale { from: 'arrival', to: 'earth', orbit: -40, elev_to: 24 };
    action: date_card { label: 'demo.cartello.universo.terra', time: hide };
  }
  scene solar_system_3d {
    // La camera si allontana dalla Terra finché nel quadro entra la Luna:
    // alla misura vera sono due granelli.
    duration: 22s;
    action: narrate { id: 'demo.narr.universo.4' };
    action: cosmic_scale { from: 'earth', to: 'earth_moon', orbit: 30, elev_from: 24, elev_to: 62 };
    action: date_card { label: 'demo.cartello.universo.luna', time: hide };
  }
  scene solar_system_3d {
    // Il Sole e i pianeti di roccia: la Terra lascia il centro al Sole.
    duration: 24s;
    action: narrate { id: 'demo.narr.universo.5' };
    action: cosmic_scale { from: 'earth_moon', to: 'inner_planets', orbit: 30, elev_from: 62, elev_to: 74 };
    action: date_card { label: 'demo.cartello.universo.sole', time: hide };
  }
  scene solar_system_3d {
    // I giganti, fino a Nettuno: il Sistema Solare che tutti conoscono.
    duration: 24s;
    action: narrate { id: 'demo.narr.universo.6' };
    action: cosmic_scale { from: 'inner_planets', to: 'planets', orbit: 30, elev_from: 74, elev_to: 70 };
    action: date_card { label: 'demo.cartello.universo.nettuno', time: hide };
  }
  scene solar_system_3d {
    // Oltre i pianeti: Kuiper e la bolla del Sole, con le Voyager di oggi.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.7' };
    action: cosmic_scale { from: 'planets', to: 'voyager', focus: 'heliopause', orbit: 20, elev_from: 70, elev_to: 58 };
    action: date_card { label: 'demo.cartello.universo.eliopausa', time: hide };
  }
  scene solar_system_3d {
    // La scala comincia a correre: la nube di Oort.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.8' };
    action: cosmic_scale { from: 'voyager', to: 'oort', focus: 'oort', center: 'sun', orbit: 25, elev_from: 58, elev_to: 70 };
    action: date_card { label: 'demo.cartello.universo.oort', time: hide };
  }
  scene solar_system_3d {
    // Le stelle vicine: Alfa Centauri, Sirio, la nube interstellare locale.
    duration: 24s;
    action: narrate { id: 'demo.narr.universo.9' };
    action: cosmic_scale { from: 'oort', to: 'local_cloud', focus: 'local_cloud', orbit: 20, elev_from: 70, elev_to: 80 };
    action: date_card { label: 'demo.cartello.universo.stelle', time: hide };
  }
  scene solar_system_3d {
    // La Bolla Locale e il braccio di Orione, con una sosta su ognuno.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.10' };
    action: cosmic_scale { from: 'local_cloud', to: 'orion_arm', ease: stops, orbit: 15, elev_from: 80, elev_to: 90 };
    action: date_card { label: 'demo.cartello.universo.orione', time: hide };
  }
  scene solar_system_3d {
    // La Via Lattea intera, prima a picco e poi un poco di sbieco.
    duration: 28s;
    action: narrate { id: 'demo.narr.universo.11' };
    action: cosmic_scale { from: 'orion_arm', to: 'milky_way', focus: 'milky_way', zoom_end: 0.6, orbit: 30, elev_from: 90, elev_to: 55 };
    action: date_card { label: 'demo.cartello.universo.galassia', time: hide };
  }
  scene solar_system_3d {
    // Fuori dalla galassia: Magellano, Andromeda, il Gruppo Locale.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.12' };
    action: cosmic_scale { from: 'milky_way', to: 'local_group', focus: 'local_group', orbit: 25, elev_from: 55, elev_to: 75 };
    action: date_card { label: 'demo.cartello.universo.andromeda', time: hide };
  }
  scene solar_system_3d {
    // La Vergine e Laniakea, con una sosta su ognuna.
    duration: 28s;
    action: narrate { id: 'demo.narr.universo.13' };
    action: cosmic_scale { from: 'local_group', to: 'laniakea', ease: stops, orbit: 20, elev_from: 75, elev_to: 85 };
    action: date_card { label: 'demo.cartello.universo.laniakea', time: hide };
  }
  scene solar_system_3d {
    // L'universo osservabile: la ragnatela, e il bordo oltre il quale la
    // luce non ha ancora avuto il tempo di arrivare.
    duration: 32s;
    action: narrate { id: 'demo.narr.universo.14' };
    action: cosmic_scale { from: 'laniakea', to: 'universe', focus: 'universe', zoom_end: 0.75, orbit: 25, elev_from: 85, elev_to: 70 };
    action: date_card { label: 'demo.cartello.universo.tutto', time: hide };
  }
  scene solar_system_3d {
    // Il ritorno in un fiato: venti decade in venti secondi, fino alla Terra
    // che riempie lo schermo (\`to: landing\`, la misura da cui parte
    // l'atterraggio).
    duration: 20s;
    action: narrate { id: 'demo.narr.universo.15' };
    action: cosmic_scale { from: 'universe', to: 'landing', ease: smooth, orbit: -40, elev_from: 70, elev_to: 90 };
    action: date_card { label: 'demo.cartello.universo.ritorno', time: hide };
  }
  scene transition {
    // L'atterraggio: il volo del decollo percorso all'indietro, attraverso
    // l'aria, fino al cielo di casa dov'era rimasto.
    duration: 6s;
    action: narrate { id: 'demo.narr.universo.16' };
    action: zoom_view { type: geometric, final_target: planetarium_view };
    action: date_card { label: 'demo.cartello.universo.ritornoCasa', time: hide };
  }
  scene planetarium_view {
    // Il congedo: di nuovo sotto il cielo di casa, nella stessa posa in cui
    // lo si era lasciato (è la fotografia su cui è atterrato il volo), e il
    // tempo riprende a scorrere.
    duration: 24s;
    action: narrate { id: 'demo.narr.universo.17' };
    action: set_date { tonight: '22:10' };
    action: timelapse { start: 22:10, end: 22:55 };
    action: zoom_fov { from: 125, to: 95 };
    action: point_view { az: 180, alt: 55 };
    action: date_card { label: 'demo.cartello.universo.ritornoCasa', time: show };
  }
}`
    },
    // ------------------------------------------------------------------
    // Le Storie cosmiche (storie-cosmiche.js, STORIE.md): gli astri hanno un
    // volto e una voce, e raccontano ai bambini un fenomeno vero. Le
    // posizioni, le fasi e le distanze sono quelle dell'app, cioè vere: la
    // storia sceglie la sera e la camera, non sposta niente.
    // ------------------------------------------------------------------
    {
      chiave: 'storia_luna',
      storia: true,
      cast: 'Moon,Earth,Sun',
      testo: `define_demo 'storia_luna' {
  // «La Luna ha perso un pezzo?» — l'episodio pilota. La sera vera è il 13
  // dicembre 2026 da Roma, alle 18:30: Luna crescente al 18%, alta 18° a
  // sud-ovest, il Sole già 19° sotto l'orizzonte. Poi la vista da fuori
  // (il banco Terra e Luna, a distanze vere) e undici giorni di orbita fino
  // alla Luna piena del 24 dicembre: le fasi che si vedono sono quelle vere.
  scene planetarium_view {
    duration: 9s;
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { iso: '2026-12-13T17:30:00Z' };
    action: center_target { target: 'Moon' };
    action: zoom_fov { from: 12, to: 2.6 };
    action: character_show { target: 'Moon', expression: 'worried' };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_luna.1' };
  }
  scene planetarium_view {
    duration: 9s;
    action: set_fov { degrees: 2.6 };
    action: center_target { target: 'Moon' };
    action: character_show { target: 'Moon', expression: 'sad' };
    action: character_blink { target: 'Moon', shot_from: 0.35 };
    action: character_expression { target: 'Moon', expression: 'worried', shot_from: 0.6 };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_luna.2' };
  }
  scene transition {
    duration: 6s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
    action: character_show { target: 'Earth', expression: 'happy' };
    action: character_speak { target: 'Earth', id: 'demo.narr.storia_luna.3' };
  }
  scene solar_system_3d {
    duration: 11s;
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 18, elev_from: 22, elev_to: 30 };
    action: character_show { target: 'Earth', expression: 'happy', look: 'Moon' };
    action: character_show { target: 'Moon', expression: 'worried', look: 'Earth' };
    action: character_speak { target: 'Earth', id: 'demo.narr.storia_luna.4' };
  }
  scene solar_system_3d {
    duration: 10s;
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 14, elev_from: 30, elev_to: 34 };
    action: character_show { target: 'Earth', expression: 'happy' };
    action: character_show { target: 'Moon', expression: 'surprised' };
    action: character_look_at { target: 'Moon', object: 'viewer' };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_luna.5' };
  }
  scene solar_system_3d {
    duration: 13s;
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 16, elev_from: 34, elev_to: 40 };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_show { target: 'Earth', expression: 'neutral', look: 'Sun' };
    action: character_show { target: 'Moon', expression: 'thinking' };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_luna.6' };
  }
  scene solar_system_3d {
    duration: 16s;
    // Undici giorni d'orbita vera: dalla falce alla Luna piena
    action: date_range { from: '2026-12-13T17:30:00Z', to: '2026-12-24T01:30:00Z' };
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 10, elev_from: 40, elev_to: 46 };
    action: character_show { target: 'Earth', expression: 'happy', look: 'Moon' };
    action: character_show { target: 'Moon', expression: 'surprised', look: 'Earth' };
    action: character_expression { target: 'Moon', expression: 'happy', shot_from: 0.7 };
    action: character_speak { target: 'Earth', id: 'demo.narr.storia_luna.7' };
  }
  scene planetarium_view {
    duration: 11s;
    action: set_date { iso: '2026-12-13T17:30:00Z' };
    action: set_fov { degrees: 2.6 };
    action: center_target { target: 'Moon' };
    action: character_show { target: 'Moon', expression: 'excited' };
    action: character_blink { target: 'Moon', shot_from: 0.5 };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_luna.8' };
  }
}`
    },
    {
      chiave: 'storia_giganti',
      storia: true,
      cast: 'Saturn,Jupiter,Sun',
      testo: `define_demo 'storia_giganti' {
  // Una storia d'esempio, corta, per chi vuole scriverne una: tutte le
  // azioni dei personaggi in quattro scene — volti, sguardi, battute, e dalla
  // v409 anche il viaggio fuori dall'orbita, la misura, le animazioni e gli
  // effetti speciali. Giove e Saturno sono nella vista
  // 3D alla loro posizione vera di oggi; nell'ultima scena passano tre anni
  // d'orbita vera, e Giove fa un quarto di giro mentre Saturno un decimo.
  scene solar_system_3d {
    duration: 11s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn', orbit: 12, elev_from: 52, elev_to: 58 };
    action: character_show { target: 'Saturn', expression: 'happy' };
    action: character_show { target: 'Jupiter', expression: 'neutral', look: 'Saturn' };
    // Il viaggio (v409): Saturno lascia la sua orbita e va a presentarsi
    action: character_move { target: 'Saturn', to: 'Jupiter', side: 'right', path: arc, shot_from: 0.35 };
    action: character_speak { target: 'Saturn', id: 'demo.narr.storia_giganti.1' };
  }
  scene solar_system_3d {
    duration: 11s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn', orbit: 10, elev_from: 58, elev_to: 62 };
    action: character_show { target: 'Saturn', expression: 'happy' };
    action: character_show { target: 'Jupiter', expression: 'excited' };
    action: character_expression { target: 'Saturn', expression: 'surprised', shot_from: 0.45 };
    // Giove si gonfia d'orgoglio, e l'onda d'urto fa sobbalzare Saturno
    action: character_scale { target: 'Jupiter', scale: 1.4, shot_to: 0.4 };
    action: character_animate { target: 'Jupiter', animation: pulse, times: 2, shot_from: 0.4, shot_to: 0.8 };
    action: effect { type: shockwave, target: 'Jupiter', shot_from: 0.45 };
    action: character_speak { target: 'Jupiter', id: 'demo.narr.storia_giganti.2' };
  }
  scene solar_system_3d {
    duration: 13s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn', orbit: 10, elev_from: 62, elev_to: 66 };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_show { target: 'Saturn', expression: 'neutral' };
    action: character_show { target: 'Jupiter', expression: 'thinking' };
    // Il Sole rimette ognuno al suo posto: Saturno torna sulla sua orbita
    action: effect { type: glow, target: 'Sun', duration: 4 };
    action: character_scale { target: 'Jupiter', scale: 1, shot_to: 0.4 };
    action: character_return { target: 'Saturn', path: hop, shot_to: 0.6 };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_giganti.3' };
  }
  scene solar_system_3d {
    duration: 12s;
    action: date_range { from: '2026-10-01T00:00:00Z', to: '2029-10-01T00:00:00Z' };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn', orbit: 8, elev_from: 66, elev_to: 70 };
    action: character_show { target: 'Saturn', expression: 'surprised', look: 'Jupiter' };
    action: character_show { target: 'Jupiter', expression: 'happy', look: 'Saturn' };
    action: character_blink { target: 'Jupiter', shot_from: 0.3 };
    action: character_expression { target: 'Saturn', expression: 'happy', shot_from: 0.55 };
    action: effect { type: sparkles, target: 'Jupiter', shot_from: 0.3 };
    action: character_animate { target: 'Jupiter', animation: dance, times: 2, shot_from: 0.6 };
    action: character_speak { target: 'Saturn', id: 'demo.narr.storia_giganti.4' };
  }
}`
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = predefiniti;
  else radice.AstroDemoPredefiniti = predefiniti;
})(typeof globalThis !== 'undefined' ? globalThis : this);
