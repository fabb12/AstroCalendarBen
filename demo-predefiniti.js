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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.roma', date: show, time: show, place: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.asse', date: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.anno', date: show, distance: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.estate', date: show, time: show, place: show };
    action: earth_axis { parallel: 41.9 };
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 0, orbit: 35, elev_from: 10, elev_to: 18, zoom_from: 1.6, zoom_to: 2.2 };
  }
  scene solar_system_3d {
    // Sei mesi di orbita: l'asse resta parallelo a sé stesso.
    duration: 12s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.6' };
    action: date_range { from: '2027-06-22T00:00:00Z', to: '2027-12-21T00:00:00Z' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.viaggio', date: show, distance: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.inverno', date: show, time: show, place: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.primavera', date: show, time: show, place: show };
    action: earth_axis { parallel: 41.9 };
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 0, orbit: 70, elev_from: 8, elev_to: 12, zoom_from: 1.8, zoom_to: 2 };
  }
  scene solar_system_3d {
    // Equinozio di settembre, dall'altra parte dell'orbita: il giro inverso.
    duration: 18s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.9' };
    action: set_date { iso: '2028-09-22T00:00:00Z' };
    action: event_window { event: september_equinox, from: -240, to: 240 };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.autunno', date: show, time: show, place: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.cieloEstate', date: show, time: show, place: show, sun: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.cieloInverno', date: show, time: show, place: show, sun: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.cieloEquinozio', date: show, time: show, place: show, sun: show };
  }
  scene planetarium_view {
    // I tre archi insieme, a campo largo verso sud, attorno a mezzogiorno.
    duration: 18s;
    action: narrate { id: 'demo.narr.solstizi_equinozi.13' };
    action: set_date { iso: '2028-03-20T11:10:00Z' };
    action: zoom_fov { from: 115, to: 150 };
    action: point_view { az: 180, alt: 34 };
    action: sun_paths { dates: '2027-06-21,2028-03-20,2027-12-22' };
    action: date_card { label: 'demo.cartello.solstizi_equinozi.confronto', date: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.tromso', date: show, time: show, place: show, sun: show };
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
    action: date_card { label: 'demo.cartello.solstizi_equinozi.riepilogo', date: show };
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
    action: date_card { label: 'demo.cartello.voyager.capo', date: show };
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
    action: date_card { label: 'demo.cartello.voyager.piano', date: show };
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
    action: date_card { label: 'demo.cartello.voyager.lancio2', date: show, shot_to: 0.15 };
    action: date_card { label: 'demo.cartello.voyager.lancio', date: show, shot_from: 0.15 };
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
    action: date_card { label: 'demo.cartello.voyager.salita', date: show };
  }
  scene solar_system_3d {
    // Giove, a distanze e dimensioni vere: la curva della fionda. La camera
    // tiene insieme la sonda e il pianeta e si stringe con loro, guardando il
    // piano dell'iperbole quasi di fronte; il tempo rallenta al perielio.
    duration: 26s;
    action: narrate { id: 'demo.narr.voyager.6' };
    action: voyager_journey { from: '1979-03-04T12:00:00Z', to: '1979-03-06T12:00:00Z', probes: 'voyager1', scale: real, ease: flyby, future: show, model_from: 0.05, milestones: hide };
    action: camera_3d { scene: system, focus: 'Voyager 1', frame_with: 'Jupiter', flyby_tilt: 28, orbit: 30, elev_from: 4, elev_to: -6 };
    action: date_card { label: 'demo.cartello.voyager.giove', date: show };
  }
  scene solar_system_3d {
    // Saturno e Titano: la fionda che la porta fuori dal piano.
    duration: 24s;
    action: narrate { id: 'demo.narr.voyager.7' };
    action: voyager_journey { from: '1980-11-12T06:00:00Z', to: '1980-11-13T18:00:00Z', probes: 'voyager1', scale: real, ease: flyby, future: show, model_from: 0.05, milestones: hide };
    action: camera_3d { scene: system, focus: 'Voyager 1', frame_with: 'Saturn', flyby_tilt: 32, orbit: -30, elev_from: 6, elev_to: -4 };
    action: date_card { label: 'demo.cartello.voyager.saturno', date: show };
  }
  scene solar_system_3d {
    // Voyager 2 da sola: Saturno, Urano, Nettuno. La camera la segue e si
    // stringe su ogni gigante che sfiora — il tempo rallenta a ogni sorvolo
    // e torna a correre negli anni di mezzo — fino all'arrivo da Nettuno.
    duration: 28s;
    action: narrate { id: 'demo.narr.voyager.8' };
    action: voyager_journey { from: '1980-11-14T00:00:00Z', to: '1989-08-24T16:00:00Z', probes: 'voyager2', scale: real, future: show, model_from: 0.035, ease: flyby };
    action: camera_3d { scene: system, focus: 'Voyager 2', frame_with: 'auto', orbit: 50, elev_from: 30, elev_to: 18 };
    action: date_card { label: 'demo.cartello.voyager.giganti', date: show };
  }
  scene solar_system_3d {
    // Nettuno e Tritone: il sorvolo più stretto del viaggio, cinquemila
    // chilometri sopra le nubi. A grandezza vera la sonda rasenta il disco.
    duration: 26s;
    action: narrate { id: 'demo.narr.voyager.9' };
    action: voyager_journey { from: '1989-08-24T16:00:00Z', to: '1989-08-25T16:00:00Z', probes: 'voyager2', scale: real, ease: flyby, future: show, model_from: 0.05, milestones: hide };
    action: camera_3d { scene: system, focus: 'Voyager 2', frame_with: 'Neptune', flyby_tilt: 24, orbit: 36, elev_from: 4, elev_to: -6 };
    action: date_card { label: 'demo.cartello.voyager.nettuno', date: show };
  }
  scene solar_system_3d {
    // La V: una sopra il piano, una sotto; l'eliopausa nel 2012.
    duration: 22s;
    action: narrate { id: 'demo.narr.voyager.10' };
    action: voyager_journey { from: '1989-09-01T00:00:00Z', to: '2012-08-25T00:00:00Z', model_from: 0.035 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Neptune', orbit: 70, elev_from: 30, elev_to: 6, zoom_from: 0.95, zoom_to: 0.55 };
    action: date_card { label: 'demo.cartello.voyager.fuga', date: show };
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
    action: date_card { label: 'demo.cartello.voyager.puntino', date: show };
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
    action: date_card { label: 'demo.cartello.voyager.disco', date: show };
  }
  scene solar_system_3d {
    // Oggi: tutto il viaggio in un colpo d'occhio.
    duration: 20s;
    action: narrate { id: 'demo.narr.voyager.13' };
    action: voyager_journey { from: 'now', to: 'now+365d', model_from: 0.035 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Neptune', orbit: 60, elev_from: 14, elev_to: 32, zoom_from: 0.52, zoom_to: 0.6 };
    action: date_card { label: 'demo.cartello.voyager.oggi', date: show };
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
    action: date_card { label: 'demo.cartello.voyager.stasera', date: show };
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
    action: date_card { label: 'demo.cartello.universo.casa', time: show, place: show };
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
    action: date_card { label: 'demo.cartello.universo.terra' };
  }
  scene solar_system_3d {
    // La camera si allontana dalla Terra finché nel quadro entra la Luna:
    // alla misura vera sono due granelli.
    duration: 22s;
    action: narrate { id: 'demo.narr.universo.4' };
    action: cosmic_scale { from: 'earth', to: 'earth_moon', orbit: 30, elev_from: 24, elev_to: 62 };
    action: date_card { label: 'demo.cartello.universo.luna' };
  }
  scene solar_system_3d {
    // Il Sole e i pianeti di roccia: la Terra lascia il centro al Sole.
    duration: 24s;
    action: narrate { id: 'demo.narr.universo.5' };
    action: cosmic_scale { from: 'earth_moon', to: 'inner_planets', orbit: 30, elev_from: 62, elev_to: 74 };
    action: date_card { label: 'demo.cartello.universo.sole' };
  }
  scene solar_system_3d {
    // I giganti, fino a Nettuno: il Sistema Solare che tutti conoscono.
    duration: 24s;
    action: narrate { id: 'demo.narr.universo.6' };
    action: cosmic_scale { from: 'inner_planets', to: 'planets', orbit: 30, elev_from: 74, elev_to: 70 };
    action: date_card { label: 'demo.cartello.universo.nettuno' };
  }
  scene solar_system_3d {
    // Oltre i pianeti: Kuiper e la bolla del Sole, con le Voyager di oggi.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.7' };
    action: cosmic_scale { from: 'planets', to: 'voyager', focus: 'heliopause', orbit: 20, elev_from: 70, elev_to: 58 };
    action: date_card { label: 'demo.cartello.universo.eliopausa' };
  }
  scene solar_system_3d {
    // La scala comincia a correre: la nube di Oort.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.8' };
    action: cosmic_scale { from: 'voyager', to: 'oort', focus: 'oort', center: 'sun', orbit: 25, elev_from: 58, elev_to: 70 };
    action: date_card { label: 'demo.cartello.universo.oort' };
  }
  scene solar_system_3d {
    // Le stelle vicine: Alfa Centauri, Sirio, la nube interstellare locale.
    duration: 24s;
    action: narrate { id: 'demo.narr.universo.9' };
    action: cosmic_scale { from: 'oort', to: 'local_cloud', focus: 'local_cloud', orbit: 20, elev_from: 70, elev_to: 80 };
    action: date_card { label: 'demo.cartello.universo.stelle' };
  }
  scene solar_system_3d {
    // La Bolla Locale e il braccio di Orione, con una sosta su ognuno.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.10' };
    action: cosmic_scale { from: 'local_cloud', to: 'orion_arm', ease: stops, orbit: 15, elev_from: 80, elev_to: 90 };
    action: date_card { label: 'demo.cartello.universo.orione' };
  }
  scene solar_system_3d {
    // La Via Lattea intera, prima a picco e poi un poco di sbieco.
    duration: 28s;
    action: narrate { id: 'demo.narr.universo.11' };
    action: cosmic_scale { from: 'orion_arm', to: 'milky_way', focus: 'milky_way', zoom_end: 0.6, orbit: 30, elev_from: 90, elev_to: 55 };
    action: date_card { label: 'demo.cartello.universo.galassia' };
  }
  scene solar_system_3d {
    // Fuori dalla galassia: Magellano, Andromeda, il Gruppo Locale.
    duration: 26s;
    action: narrate { id: 'demo.narr.universo.12' };
    action: cosmic_scale { from: 'milky_way', to: 'local_group', focus: 'local_group', orbit: 25, elev_from: 55, elev_to: 75 };
    action: date_card { label: 'demo.cartello.universo.andromeda' };
  }
  scene solar_system_3d {
    // La Vergine e Laniakea, con una sosta su ognuna.
    duration: 28s;
    action: narrate { id: 'demo.narr.universo.13' };
    action: cosmic_scale { from: 'local_group', to: 'laniakea', ease: stops, orbit: 20, elev_from: 75, elev_to: 85 };
    action: date_card { label: 'demo.cartello.universo.laniakea' };
  }
  scene solar_system_3d {
    // L'universo osservabile: la ragnatela, e il bordo oltre il quale la
    // luce non ha ancora avuto il tempo di arrivare.
    duration: 32s;
    action: narrate { id: 'demo.narr.universo.14' };
    action: cosmic_scale { from: 'laniakea', to: 'universe', focus: 'universe', zoom_end: 0.75, orbit: 25, elev_from: 85, elev_to: 70 };
    action: date_card { label: 'demo.cartello.universo.tutto' };
  }
  scene solar_system_3d {
    // Il ritorno in un fiato: venti decade in venti secondi, fino alla Terra
    // che riempie lo schermo (\`to: landing\`, la misura da cui parte
    // l'atterraggio).
    duration: 20s;
    action: narrate { id: 'demo.narr.universo.15' };
    action: cosmic_scale { from: 'universe', to: 'landing', ease: smooth, orbit: -40, elev_from: 70, elev_to: 90 };
    action: date_card { label: 'demo.cartello.universo.ritorno' };
  }
  scene transition {
    // L'atterraggio: il volo del decollo percorso all'indietro, attraverso
    // l'aria, fino al cielo di casa dov'era rimasto.
    duration: 6s;
    action: narrate { id: 'demo.narr.universo.16' };
    action: zoom_view { type: geometric, final_target: planetarium_view };
    action: date_card { label: 'demo.cartello.universo.ritornoCasa' };
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
    action: date_card { label: 'demo.cartello.universo.ritornoCasa', time: show, place: show };
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
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 14, orbit_from: 18, elev_from: 30, elev_to: 34 };
    action: character_show { target: 'Earth', expression: 'happy' };
    action: character_show { target: 'Moon', expression: 'surprised' };
    action: character_look_at { target: 'Moon', object: 'viewer' };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_luna.5' };
  }
  scene solar_system_3d {
    duration: 13s;
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 16, orbit_from: 32, elev_from: 34, elev_to: 40 };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_show { target: 'Earth', expression: 'neutral', look: 'Sun' };
    action: character_show { target: 'Moon', expression: 'thinking' };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_luna.6' };
  }
  scene solar_system_3d {
    duration: 16s;
    // Undici giorni d'orbita vera: dalla falce alla Luna piena
    action: date_range { from: '2026-12-13T17:30:00Z', to: '2026-12-24T01:30:00Z' };
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 10, orbit_from: 48, elev_from: 40, elev_to: 46 };
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
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn', orbit: 10, orbit_from: 12, elev_from: 58, elev_to: 62 };
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
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn', orbit: 10, orbit_from: 22, elev_from: 62, elev_to: 66 };
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
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Jupiter,Saturn', orbit: 8, orbit_from: 32, elev_from: 66, elev_to: 70 };
    action: character_show { target: 'Saturn', expression: 'surprised', look: 'Jupiter' };
    action: character_show { target: 'Jupiter', expression: 'happy', look: 'Saturn' };
    action: character_blink { target: 'Jupiter', shot_from: 0.3 };
    action: character_expression { target: 'Saturn', expression: 'happy', shot_from: 0.55 };
    action: effect { type: sparkles, target: 'Jupiter', shot_from: 0.3 };
    action: character_animate { target: 'Jupiter', animation: dance, times: 2, shot_from: 0.6 };
    action: character_speak { target: 'Saturn', id: 'demo.narr.storia_giganti.4' };
  }
}`
    },
    {
      chiave: 'storia_tempo',
      storia: true,
      cast: 'Moon,Sun,voyager1,alpha_centauri,milky_way,andromeda',
      testo: `define_demo 'storia_tempo' {
  // «Il cielo è una macchina del tempo» (v412). Un'idea sola, detta a
  // passi: la luce è velocissima ma non istantanea, quindi più si guarda
  // lontano più si guarda indietro. La Luna fa da guida e fa le domande; ogni
  // astro risponde con quanto è vecchia la sua luce, mentre la scala cosmica
  // si allarga alla misura vera e i personaggi stanno al loro posto vero:
  // 1,3 secondi la Luna, 8 minuti e 20 il Sole, quasi un giorno la Voyager,
  // 4 anni e 4 mesi Alfa Centauri, 26.000 anni il centro della Galassia
  // (l'era dei mammut), 2,5 milioni Andromeda (prima di noi), 13,8 miliardi
  // la luce più antica. Si parte e si torna nella stessa sera vera, la Luna
  // crescente del 13 dicembre 2026 da Roma (quella dell'episodio pilota).
  scene planetarium_view {
    duration: 9s;
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { iso: '2026-12-13T17:30:00Z' };
    action: center_target { target: 'Moon' };
    action: zoom_fov { from: 40, to: 6 };
    action: character_show { target: 'Moon', expression: 'thinking' };
    action: character_expression { target: 'Moon', expression: 'surprised', shot_from: 0.5 };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_tempo.1' };
  }
  scene planetarium_view {
    duration: 12s;
    action: set_fov { degrees: 6 };
    action: center_target { target: 'Moon' };
    action: date_card { label: 'demo.cartello.storia_tempo.luna' };
    action: character_show { target: 'Moon', expression: 'excited' };
    action: effect { type: sparkles, target: 'Moon', shot_from: 0.4 };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_tempo.2' };
  }
  scene transition {
    duration: 8s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
    action: character_show { target: 'Moon', expression: 'happy' };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_tempo.3' };
  }
  scene solar_system_3d {
    // Dalla Terra della vista 3D alla carta, e fuori fino al Sole
    duration: 13s;
    action: cosmic_scale { from: 'arrival', to: 'inner_planets', orbit: 20, elev_to: 62 };
    action: date_card { label: 'demo.cartello.storia_tempo.sole' };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_show { target: 'Moon', expression: 'surprised', look: 'Sun' };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_tempo.4' };
  }
  scene solar_system_3d {
    duration: 12s;
    action: cosmic_scale { from: 'inner_planets', to: 'inner_planets', orbit: 12, elev_from: 62, elev_to: 66 };
    action: character_show { target: 'Sun', expression: 'laughing' };
    action: character_show { target: 'Moon', expression: 'worried', look: 'Sun' };
    action: character_expression { target: 'Moon', expression: 'happy', shot_from: 0.75 };
    action: effect { type: flash, at: center, shot_from: 0.2 };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_tempo.5' };
  }
  scene solar_system_3d {
    // Oltre i pianeti, fino alla Voyager di oggi
    duration: 14s;
    action: cosmic_scale { from: 'inner_planets', to: 'voyager', orbit: 18, elev_from: 66, elev_to: 72 };
    action: date_card { label: 'demo.cartello.storia_tempo.voyager' };
    action: character_show { target: 'voyager1', expression: 'excited' };
    action: character_show { target: 'Moon', expression: 'surprised', look: 'voyager1' };
    action: effect { type: shockwave, target: 'voyager1', shot_from: 0.3 };
    action: character_speak { target: 'voyager1', id: 'demo.narr.storia_tempo.6' };
  }
  scene solar_system_3d {
    // Le stelle vicine: Alfa Centauri a 4,37 anni luce
    duration: 14s;
    action: cosmic_scale { from: 'voyager', to: 'local_cloud', orbit: 18, elev_from: 72, elev_to: 78 };
    action: date_card { label: 'demo.cartello.storia_tempo.alfa' };
    action: character_show { target: 'alpha_centauri', expression: 'happy' };
    action: character_show { target: 'Moon', expression: 'thinking', look: 'alpha_centauri' };
    action: character_speak { target: 'alpha_centauri', id: 'demo.narr.storia_tempo.7' };
  }
  scene solar_system_3d {
    // La Galassia intera: la luce del suo centro ha 26.000 anni
    duration: 16s;
    action: cosmic_scale { from: 'local_cloud', to: 'milky_way', orbit: 25, elev_from: 78, elev_to: 60 };
    action: date_card { label: 'demo.cartello.storia_tempo.centro' };
    action: character_show { target: 'milky_way', expression: 'thinking' };
    action: character_show { target: 'Moon', expression: 'surprised', look: 'milky_way' };
    action: effect { type: glow, target: 'galactic_center', shot_from: 0.3, duration: 6 };
    action: character_speak { target: 'milky_way', id: 'demo.narr.storia_tempo.8' };
  }
  scene solar_system_3d {
    // Fuori dalla Galassia: Andromeda, a 2,5 milioni di anni luce
    duration: 15s;
    action: cosmic_scale { from: 'milky_way', to: 'local_group', orbit: 20, elev_from: 60, elev_to: 72 };
    action: date_card { label: 'demo.cartello.storia_tempo.andromeda' };
    action: character_show { target: 'andromeda', expression: 'love' };
    action: character_show { target: 'milky_way', expression: 'happy', look: 'andromeda' };
    action: effect { type: hearts, target: 'andromeda', shot_from: 0.4 };
    action: character_speak { target: 'andromeda', id: 'demo.narr.storia_tempo.9' };
  }
  scene solar_system_3d {
    // La domanda: la Luna (un puntino con tutti noi) ha capito il gioco
    duration: 12s;
    action: cosmic_scale { from: 'local_group', to: 'laniakea', orbit: 20, elev_from: 72, elev_to: 80 };
    action: character_show { target: 'Moon', expression: 'excited' };
    action: character_show { target: 'milky_way', expression: 'happy', look: 'Moon' };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_tempo.10' };
  }
  scene solar_system_3d {
    // Il bordo dell'universo osservabile: la luce più antica
    duration: 15s;
    action: cosmic_scale { from: 'laniakea', to: 'universe', zoom_end: 0.8, orbit: 20, elev_from: 80, elev_to: 70 };
    action: date_card { label: 'demo.cartello.storia_tempo.universo' };
    action: character_show { target: 'milky_way', expression: 'surprised' };
    action: character_show { target: 'Moon', expression: 'surprised', look: 'milky_way' };
    action: effect { type: fireworks, at: center, shot_from: 0.55 };
    action: character_speak { target: 'milky_way', id: 'demo.narr.storia_tempo.11' };
  }
  scene solar_system_3d {
    // Il ritorno in un fiato, fino alla Terra che riempie lo schermo
    duration: 12s;
    action: cosmic_scale { from: 'universe', to: 'landing', ease: smooth, orbit: -40, elev_from: 70, elev_to: 90 };
    action: character_show { target: 'Moon', expression: 'laughing' };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_tempo.12' };
  }
  scene transition {
    duration: 6s;
    action: zoom_view { type: geometric, final_target: planetarium_view };
    action: character_show { target: 'Moon', expression: 'happy' };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_tempo.13' };
  }
  scene planetarium_view {
    // Di nuovo sotto la stessa Luna: adesso si sa che cosa si sta guardando
    duration: 13s;
    action: set_date { iso: '2026-12-13T17:30:00Z' };
    action: center_target { target: 'Moon' };
    action: zoom_fov { from: 20, to: 6 };
    action: date_card { label: 'demo.cartello.storia_tempo.casa', time: show, place: show };
    action: character_show { target: 'Moon', expression: 'love' };
    action: effect { type: sparkles, target: 'Moon', shot_from: 0.6 };
    action: character_speak { target: 'Moon', id: 'demo.narr.storia_tempo.14' };
  }
}`
    },
    {
      chiave: 'storia_stelle',
      storia: true,
      cast: 'Star7,Sun,Earth,supernova,sirius_b,sirius,sgr_a,white_hole',
      testo: `define_demo 'storia_stelle' {
  // «Che fine fanno le stelle?» (v414). Il Sole ha quattro miliardi e mezzo
  // di anni e si chiede che cosa gli succederà; va a chiederlo a chi lo sa,
  // ognuno al suo posto vero nella scala cosmica: Betelgeuse, la
  // supergigante rossa (548 anni luce, l'offuscamento del 2019-2020, la
  // supernova entro centomila anni), la supernova del 1054 che oggi è la
  // nebulosa del Granchio (6500 anni luce, la pulsar di 20 km che gira trenta
  // volte al secondo), Sirio B, la nana bianca (massa di un Sole, misura della
  // Terra), Sagittario A* (quattro milioni di Soli, fotografato nel 2022) e il
  // buco bianco, che dice da sé di essere soltanto un'idea. Il Sole prova
  // addosso il suo futuro (gigante rossa, poi nana bianca: è troppo leggero
  // per esplodere). Si parte e si torna sotto Orione, la sera del 13 dicembre
  // 2026 da Roma, con Betelgeuse alta 41° a sud-est e la Luna già tramontata.
  scene planetarium_view {
    duration: 11s;
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { iso: '2026-12-13T21:00:00Z' };
    action: point_view { az: 126, alt: 34 };
    action: zoom_fov { from: 70, to: 34 };
    action: character_show { target: 'Star7', expression: 'happy' };
    action: character_expression { target: 'Star7', expression: 'laughing', shot_from: 0.6 };
    action: effect { type: sparkles, target: 'Star7', shot_from: 0.3 };
    action: character_speak { target: 'Star7', id: 'demo.narr.storia_stelle.1' };
  }
  scene planetarium_view {
    duration: 10s;
    action: set_fov { degrees: 34 };
    action: point_view { az: 126, alt: 34 };
    action: date_card { label: 'demo.cartello.storia_stelle.betelgeuse' };
    action: character_show { target: 'Star7', expression: 'thinking' };
    action: character_expression { target: 'Star7', expression: 'excited', shot_from: 0.65 };
    action: character_speak { target: 'Star7', id: 'demo.narr.storia_stelle.2' };
  }
  scene transition {
    duration: 7s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
    action: character_show { target: 'Star7', expression: 'excited' };
    action: character_speak { target: 'Star7', id: 'demo.narr.storia_stelle.3' };
  }
  scene solar_system_3d {
    // Il Sole e la Terra, alle distanze vere
    duration: 12s;
    action: cosmic_scale { from: 'arrival', to: 'inner_planets', orbit: 20, elev_to: 62 };
    action: date_card { label: 'demo.cartello.storia_stelle.sole' };
    action: character_show { target: 'Sun', expression: 'worried' };
    action: character_show { target: 'Earth', expression: 'surprised', look: 'Sun' };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_stelle.4' };
  }
  scene solar_system_3d {
    duration: 9s;
    action: cosmic_scale { from: 'inner_planets', to: 'inner_planets', orbit: 10, elev_from: 62, elev_to: 66 };
    action: character_show { target: 'Sun', expression: 'sad', look: 'Earth' };
    action: character_show { target: 'Earth', expression: 'thinking' };
    action: character_expression { target: 'Earth', expression: 'excited', shot_from: 0.5 };
    action: character_speak { target: 'Earth', id: 'demo.narr.storia_stelle.5' };
  }
  scene solar_system_3d {
    // Fuori, fino a Betelgeuse: 548 anni luce
    duration: 14s;
    action: cosmic_scale { from: 'inner_planets', to: 63000000, center: sun, orbit: 20, elev_from: 66, elev_to: 74 };
    action: date_card { label: 'demo.cartello.storia_stelle.gigante' };
    action: character_show { target: 'Star7', expression: 'happy' };
    action: character_show { target: 'Sun', expression: 'surprised', look: 'Star7' };
    action: character_animate { target: 'Star7', animation: pulse, times: 2, shot_from: 0.5 };
    action: character_speak { target: 'Star7', id: 'demo.narr.storia_stelle.6' };
  }
  scene solar_system_3d {
    duration: 13s;
    action: cosmic_scale { from: 63000000, to: 63000000, center: sun, orbit: 12, elev_from: 74, elev_to: 76 };
    action: character_show { target: 'Star7', expression: 'surprised' };
    action: character_show { target: 'Sun', expression: 'worried', look: 'Star7' };
    action: character_animate { target: 'Star7', animation: shake, times: 3, shot_from: 0.55 };
    action: character_expression { target: 'Star7', expression: 'excited', shot_from: 0.55 };
    action: character_speak { target: 'Star7', id: 'demo.narr.storia_stelle.7' };
  }
  scene solar_system_3d {
    // La supernova del 1054: oggi la nebulosa del Granchio, a 6500 anni luce
    duration: 14s;
    action: cosmic_scale { from: 63000000, to: 570000000, center: sun, orbit: 18, elev_from: 76, elev_to: 70 };
    action: date_card { label: 'demo.cartello.storia_stelle.supernova' };
    action: character_show { target: 'supernova', expression: 'laughing' };
    action: character_show { target: 'Sun', expression: 'surprised', look: 'supernova' };
    action: effect { type: explosion, target: 'supernova', size: 1.6, shot_from: 0.25 };
    action: character_speak { target: 'supernova', id: 'demo.narr.storia_stelle.8' };
  }
  scene solar_system_3d {
    duration: 13s;
    action: cosmic_scale { from: 570000000, to: 570000000, center: sun, orbit: 10, elev_from: 70, elev_to: 68 };
    action: date_card { label: 'demo.cartello.storia_stelle.pulsar' };
    action: character_show { target: 'supernova', expression: 'excited' };
    action: character_show { target: 'Sun', expression: 'surprised', look: 'supernova' };
    action: character_animate { target: 'supernova', animation: spin, times: 3, shot_from: 0.35 };
    action: character_speak { target: 'supernova', id: 'demo.narr.storia_stelle.9' };
  }
  scene solar_system_3d {
    // Di nuovo vicino a casa: la paura del Sole
    duration: 9s;
    action: cosmic_scale { from: 570000000, to: 1000000, center: sun, orbit: -95, elev_from: 68, elev_to: 72 };
    action: character_show { target: 'Sun', expression: 'worried' };
    action: character_animate { target: 'Sun', animation: shake, times: 4, strength: 0.6, shot_from: 0.4 };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_stelle.10' };
  }
  scene solar_system_3d {
    // Sirio B, la nana bianca, accanto a Sirio, a 8,6 anni luce
    duration: 13s;
    action: cosmic_scale { from: 1000000, to: 1000000, center: sun, orbit: 10, elev_from: 72, elev_to: 74 };
    action: date_card { label: 'demo.cartello.storia_stelle.nana' };
    action: character_show { target: 'sirius_b', expression: 'happy' };
    action: character_show { target: 'sirius', expression: 'happy', look: 'sirius_b' };
    action: character_show { target: 'Sun', expression: 'surprised', look: 'sirius_b' };
    action: character_animate { target: 'sirius_b', animation: bounce, times: 2, shot_from: 0.2 };
    action: character_speak { target: 'sirius_b', id: 'demo.narr.storia_stelle.11' };
  }
  scene solar_system_3d {
    duration: 11s;
    action: cosmic_scale { from: 1000000, to: 1000000, center: sun, orbit: 8, elev_from: 74, elev_to: 75 };
    action: character_show { target: 'sirius_b', expression: 'laughing' };
    action: character_show { target: 'sirius', expression: 'happy', look: 'sirius_b' };
    action: character_show { target: 'Sun', expression: 'happy', look: 'sirius_b' };
    action: effect { type: sparkles, target: 'sirius_b', shot_from: 0.3 };
    action: character_speak { target: 'sirius_b', id: 'demo.narr.storia_stelle.12' };
  }
  scene solar_system_3d {
    // Il Sole prova addosso il suo futuro: prima gigante rossa…
    duration: 14s;
    action: cosmic_scale { from: 1000000, to: 'inner_planets', zoom_end: 0.35, orbit: 20, elev_from: 75, elev_to: 64 };
    action: date_card { label: 'demo.cartello.storia_stelle.futuro' };
    action: character_show { target: 'Sun', expression: 'surprised' };
    action: character_show { target: 'Earth', expression: 'surprised', look: 'Sun' };
    action: character_become { target: 'Sun', shape: red_giant, shot_from: 0.3, shot_to: 0.8 };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_stelle.13' };
  }
  scene solar_system_3d {
    // …poi la nebulosa planetaria, e il cuore che resta: una nana bianca
    duration: 14s;
    action: cosmic_scale { from: 'inner_planets', to: 'inner_planets', orbit: 12, elev_from: 64, elev_to: 66 };
    action: character_show { target: 'Sun', expression: 'thinking' };
    action: character_show { target: 'Earth', expression: 'surprised', look: 'Sun' };
    action: effect { type: shockwave, target: 'Sun', size: 2.6, color: '#5eead4', duration: 5, shot_from: 0.15 };
    action: character_become { target: 'Sun', shape: white_dwarf, shot_from: 0.25, shot_to: 0.7 };
    action: character_expression { target: 'Sun', expression: 'happy', shot_from: 0.7 };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_stelle.14' };
  }
  scene solar_system_3d {
    // Di nuovo sé stesso, e via verso il centro della Galassia
    duration: 14s;
    action: cosmic_scale { from: 'inner_planets', to: 'milky_way', orbit: 25, elev_from: 66, elev_to: 58 };
    action: character_show { target: 'Sun', expression: 'thinking' };
    action: character_become { target: 'Sun', shape: self, shot_from: 0, shot_to: 0.2 };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_stelle.15' };
  }
  scene solar_system_3d {
    // Sagittario A*, il buco nero al centro della Via Lattea
    duration: 15s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 12, elev_from: 58, elev_to: 62 };
    action: date_card { label: 'demo.cartello.storia_stelle.buco_nero' };
    action: character_show { target: 'sgr_a', expression: 'thinking' };
    action: character_show { target: 'Sun', expression: 'surprised', look: 'sgr_a' };
    action: effect { type: glow, target: 'sgr_a', duration: 6, shot_from: 0.1 };
    action: character_expression { target: 'sgr_a', expression: 'happy', shot_from: 0.6 };
    action: character_speak { target: 'sgr_a', id: 'demo.narr.storia_stelle.16' };
  }
  scene solar_system_3d {
    duration: 10s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 8, elev_from: 62, elev_to: 64 };
    action: date_card { label: 'demo.cartello.storia_stelle.foto' };
    action: character_show { target: 'sgr_a', expression: 'neutral' };
    action: character_show { target: 'Sun', expression: 'worried', look: 'sgr_a' };
    action: character_speak { target: 'sgr_a', id: 'demo.narr.storia_stelle.17' };
  }
  scene solar_system_3d {
    duration: 12s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 8, elev_from: 64, elev_to: 66 };
    action: character_show { target: 'sgr_a', expression: 'laughing' };
    action: character_show { target: 'Sun', expression: 'happy', look: 'sgr_a' };
    action: character_animate { target: 'sgr_a', animation: nod, times: 2, shot_from: 0.2 };
    action: character_speak { target: 'sgr_a', id: 'demo.narr.storia_stelle.18' };
  }
  scene solar_system_3d {
    // Il buco bianco: non sta sulla carta, galleggia davanti
    duration: 11s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 8, elev_from: 66, elev_to: 66 };
    action: character_show { target: 'white_hole', expression: 'excited' };
    action: character_show { target: 'sgr_a', expression: 'surprised', look: 'white_hole' };
    action: effect { type: flash, target: 'white_hole', shot_from: 0.05 };
    action: effect { type: sparkles, target: 'white_hole', shot_from: 0.1 };
    action: character_speak { target: 'white_hole', id: 'demo.narr.storia_stelle.19' };
  }
  scene solar_system_3d {
    duration: 7s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 5, elev_from: 66, elev_to: 66 };
    action: character_show { target: 'white_hole', expression: 'happy', look: 'sgr_a' };
    action: character_show { target: 'sgr_a', expression: 'thinking', look: 'white_hole' };
    action: character_speak { target: 'sgr_a', id: 'demo.narr.storia_stelle.20' };
  }
  scene solar_system_3d {
    duration: 12s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 6, elev_from: 66, elev_to: 64 };
    action: date_card { label: 'demo.cartello.storia_stelle.buco_bianco' };
    action: character_show { target: 'white_hole', expression: 'thinking' };
    action: character_show { target: 'sgr_a', expression: 'thinking', look: 'white_hole' };
    action: character_expression { target: 'white_hole', expression: 'laughing', shot_from: 0.7 };
    action: character_speak { target: 'white_hole', id: 'demo.narr.storia_stelle.21' };
  }
  scene solar_system_3d {
    // Il ritorno in un fiato, fino alla Terra che riempie lo schermo
    duration: 13s;
    action: cosmic_scale { from: 'milky_way', to: 'landing', ease: smooth, orbit: -40, elev_from: 64, elev_to: 90 };
    action: character_show { target: 'supernova', expression: 'love' };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_speak { target: 'supernova', id: 'demo.narr.storia_stelle.22' };
  }
  scene transition {
    duration: 6s;
    action: zoom_view { type: geometric, final_target: planetarium_view };
    action: character_show { target: 'Star7', expression: 'happy' };
    action: character_speak { target: 'Star7', id: 'demo.narr.storia_stelle.23' };
  }
  scene planetarium_view {
    // Di nuovo sotto Orione: adesso si sa di che cosa è fatto chi guarda
    duration: 14s;
    action: set_date { iso: '2026-12-13T21:00:00Z' };
    action: point_view { az: 126, alt: 34 };
    action: zoom_fov { from: 50, to: 34 };
    action: date_card { label: 'demo.cartello.storia_stelle.casa', time: show, place: show };
    action: character_show { target: 'Star7', expression: 'love' };
    action: effect { type: sparkles, target: 'Star7', shot_from: 0.55 };
    action: character_speak { target: 'Star7', id: 'demo.narr.storia_stelle.24' };
  }
}`
    },
    {
      chiave: 'storia_puntino',
      storia: true,
      cast: 'sagan,Earth,voyager1,voyager2,Moon,Sun,Mars,Jupiter,Saturn,Venus',
      testo: `define_demo 'storia_puntino' {
  // «Pallido puntino blu» (v450): una CosmoStoria che segue una canzone.
  // La canzone (musica/canzoni/pallido-punto-blu.mp3, 4'08")
  // è un rap sulle parole che Carl Sagan scrisse nel 1994 sulla fotografia
  // della Terra fatta dalla Voyager 1 il 14 febbraio 1990, da sei miliardi
  // di chilometri. La cantano Carl Sagan (un ospite: sta in un posto dello
  // schermo in ogni vista), la Terra, la Luna, le due Voyager, il Sole e i
  // pianeti, verso per verso (\`character_sing\`); il karaoke colora le
  // parole cantate. Ogni scena ripete \`story_music\` col punto della
  // canzone in cui comincia (\`at\`): la musica è agganciata al tempo della
  // demo (\`sync: on\`), e chi salta a una scena la trova al punto giusto.
  // Il battito (87 bpm, un verso per battuta) lo tengono la camera e i
  // personaggi. I tempi dei versi sono stati misurati sulla canzone
  // (riconoscimento del parlato parola per parola, poi allineato al testo).
  // Questo copione è generato: i numeri vengono da lì.
  // v462: le facce nuove dove le parole le chiedono: la speranza («ogni
  // figlio speranzoso», il congedo), la delusione («ma perché poi?», la
  // follia delle vanità), l'imbarazzo di Marte e Saturno, l'orgoglio di
  // Saturno e della Voyager, la confusione delle incomprensioni, il
  // mistero del buio cosmico, la paura di chi non ha aiuto.
  // v456: niente fotografia, niente cuori, fuochi, coriandoli né balli: il
  // tono segue le parole, che sono amare. Carl Sagan canta quasi tutti i
  // versi, gli altri con lui; restano soli Marte, Giove, Saturno, il Sole e
  // la Luna nei versi che parlano di loro.
  // v458: Carl Sagan cambia faccia verso per verso (pensoso, triste,
  // preoccupato, sorpreso, seccato, arrabbiato sui fiumi di sangue, un
  // sorriso solo su «occuparci l'uno dell'altro»), nei ritornelli cantano
  // tutti quelli in scena, e niente effetti sonori: solo la canzone.
  // v460: la tristezza solo dove le parole la chiedono (il tormento, «ma
  // perché poi?»); per il resto le facce nuove: la meraviglia davanti al
  // cosmo, la tenerezza per la casa, la decisione su «proteggila», lo
  // scetticismo sulla posizione privilegiata, la malinconia del buio.
  // v465: «conosciuto» finiva dopo dieci secondi invece che a 212 s (il
  // riconoscimento allungava l'ultima parola fino al «Oh… oh…» che segue),
  // e con lui «casa», «avuto» due volte: tagliati dove la voce si ferma. E il
  // primo «Oh… oh… oh… oh…» (212,8-221 s), che il testo non scrive ma la
  // canzone canta, ha il suo verso.
  scene solar_system_3d {
    // L'intro parlata: la Voyager 1 il 14 febbraio 1990, a quaranta unità astronomiche, si gira verso casa.
    duration: 19.5s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: -1.5 };
    action: story_camera { mode: auto };
    action: voyager_journey { from: '1990-02-13T00:00:00Z', to: '1990-02-15T00:00:00Z', probes: 'voyager1', model_from: 0.17, model_to: 0.22, home: show, gaze: show, proportion: free };
    action: camera_3d { scene: system, focus: 'Voyager 1', probe_az: -105, orbit: 34, elev_from: -10, elev_to: 10, zoom_from: 1.5, zoom_to: 0.85 };
    action: story_title { id: 'storie.titolo.puntino', shot_to: 0.36 };
    action: character_show { target: 'Earth', expression: 'sad', size: real, shot_from: 0.4564 };
    action: character_expression { target: 'Earth', expression: 'hopeful', shot_from: 0.6974 };
    action: character_show { target: 'voyager1', expression: 'thinking' };
    action: character_show { target: 'sagan', expression: 'thinking', at: left };
    action: effect { type: glow, target: 'voyager1', duration: 6, shot_from: 0.2 };
    action: character_expression { target: 'voyager1', expression: 'curious', shot_from: 0.62 };
    action: effect { type: flash, target: 'voyager1', sound: off, shot_from: 0.66 };
    action: character_expression { target: 'voyager1', expression: 'sad', shot_from: 0.82 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.1867 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.1', words: '.000-.056 .056-.128 .139-.274 .659-.704 .693-.743 .715-.966', voice: '4552034142001543100122000000000000000000000000000000000243115325453344424401343542210000000', shot_from: 0.1867, shot_to: 0.3703 };
    action: character_expression { target: 'sagan', expression: 'skeptical', shot_from: 0.4605 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.2', words: '.000-.057 .007-.129 .114-.186 .193-.279 .300-.421 .443-.529 .557-.757 .779-.957', voice: '48677600453453554421144765404115651034156646663420115647636421352000000', shot_from: 0.4605, shot_to: 0.6041 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.6964 };
    action: character_sing { target: 'sagan', with: 'voyager1', id: 'storie.canzone.puntino.3', words: '.000-.051 .028-.117 .108-.196 .804-.836 .836-.972', voice: '511564103543331100000110001201000011111002421111110121222232122113424222243233322146424535776565555101111111', shot_from: 0.6964, shot_to: 0.9159 };
  }
  scene solar_system_3d {
    // Prima strofa: la Terra e la Luna da vicino, la base del rap entra.
    duration: 26s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 18, bpm: 87, beat: 0.85 };
    action: story_camera { mode: rhythm };
    action: camera_3d { scene: earth_moon, focus: 'Earth', orbit: 70, elev_from: 8, elev_to: 42 };
    action: effect { type: smoke, target: 'Earth', size: 0.6, shot_from: 0.9462 };
    action: character_show { target: 'Earth', expression: 'neutral' };
    action: character_show { target: 'Moon', expression: 'neutral', look: 'Earth' };
    action: character_show { target: 'sagan', expression: 'thinking', at: left };
    action: effect { type: glow, target: 'Earth', duration: 3, shot_from: 0.1596 };
    action: character_expression { target: 'Earth', expression: 'sad', shot_from: 0.3654 };
    action: character_expression { target: 'Earth', expression: 'neutral', shot_from: 0.5 };
    action: character_expression { target: 'Moon', expression: 'thinking', shot_from: 0.5808 };
    action: character_expression { target: 'Moon', expression: 'laughing', shot_from: 0.6827 };
    action: character_expression { target: 'Moon', expression: 'sad', shot_from: 0.7096 };
    action: character_expression { target: 'Moon', expression: 'love', shot_from: 0.7346 };
    action: character_expression { target: 'Moon', expression: 'angry', shot_from: 0.7615 };
    action: character_animate { target: 'Moon', animation: shake, times: 2, shot_from: 0.7615, shot_to: 0.7923 };
    action: character_expression { target: 'Moon', expression: 'neutral', shot_from: 0.8077 };
    action: character_expression { target: 'Earth', expression: 'thinking', shot_from: 0.8885 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.1546 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.4', words: '.000-.313 .322-.426 .391-.522 .539-.687 .696-.948', voice: '58761487137531476778203740123101465536667887741655555200000', shot_from: 0.1546, shot_to: 0.2431 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.2662 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.5', words: '.000-.054 .000-.154 .163-.254 .272-.309 .427-.554 .500-.654 .663-.709 .663-.863 .809-.945', voice: '22455675055886165015872353047777400037777610255442000034', shot_from: 0.2662, shot_to: 0.3508 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.3685 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.6', words: '.000-.061 .000-.164 .175-.329 .350-.556 .608-.721 .680-.763 .680-1.000', voice: '2544662025501310043046765777777326885277861661331', shot_from: 0.3685, shot_to: 0.4431 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.44 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.7', words: '.000-.121 .103-.213 .190-.299 .299-.483 .506-.558 .552-.644 .650-.736 .713-.966', voice: '3310251016763351277103665254334566116401310057636720253018500044440011222223304730234315', shot_from: 0.44, shot_to: 0.5738 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.58 };
    action: character_sing { target: 'sagan', with: 'Moon', id: 'storie.canzone.puntino.8', words: '.000-.197 .164-.279 .279-.443 .418-.525 .508-.640 .656-.713 .713-1.000', voice: '23446720016766421788876721651016841788856511330003542024200234', shot_from: 0.58, shot_to: 0.6738 };
    action: character_sing { target: 'Moon', id: 'storie.canzone.puntino.9', words: '.000-.084 .143-.331 .351-.381 .351-.539 .526-.565 .578-.734 .747-.777 .747-.961', voice: '234424987666544334126679500469987420166569843888888604740178950354444303510133', shot_from: 0.6708, shot_to: 0.7892 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.7931 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.10', words: '.000-.256 .264-.384 .352-.512 .488-.544 .488-.608 .624-.680 .688-.760 .752-1.000', voice: '442015751561176337401487764750130154001430376667667754124300642', shot_from: 0.7931, shot_to: 0.8892 };
    action: character_expression { target: 'sagan', expression: 'confused', shot_from: 0.8862 };
    action: character_sing { target: 'sagan', with: 'Earth,Moon', id: 'storie.canzone.puntino.11', words: '.000-.201 .180-.361 .347-.493 .535-.785 .785-.959', voice: '6421699717820455566414300357663552154017766673034444577448766777778665210', shot_from: 0.8862, shot_to: 0.9969 };
  }
  scene planetarium_view {
    // Seconda strofa, flow veloce: il cielo di Roma d'inverno e Orione, il cacciatore; Betelgeuse dalla sua spalla canta le vite che quel cielo l'hanno guardato.
    duration: 16.55s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 44, bpm: 87, beat: 0.85 };
    action: story_camera { mode: rhythm };
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { iso: '2026-12-13T21:00:00Z' };
    action: point_view { az: 126, alt: 34 };
    action: zoom_fov { from: 75, to: 32 };
    action: character_show { target: 'Star7', expression: 'thinking' };
    action: character_show { target: 'sagan', expression: 'neutral', at: left };
    action: effect { type: glow, target: 'Star7', duration: 3, shot_from: 0.006 };
    action: character_expression { target: 'Star7', expression: 'bully', shot_from: 0.1752 };
    action: character_expression { target: 'Star7', expression: 'proud', shot_from: 0.3323 };
    action: effect { type: explosion, at: right, size: 0.6, shot_from: 0.3988 };
    action: character_expression { target: 'Star7', expression: 'sad', shot_from: 0.6707 };
    action: effect { type: shooting_star, at: top, shot_from: 0.8822 };
    action: character_expression { target: 'Star7', expression: 'surprised', shot_from: 0.8882 };
    action: character_expression { target: 'sagan', expression: 'neutral', shot_from: 0.0097 };
    action: character_sing { target: 'sagan', with: 'Star7', id: 'storie.canzone.puntino.12', words: '.000-.094 .051-.453 .521-.624 .641-.948', voice: '750488301671167667762012106865677776117777436203666667755555', shot_from: 0.0097, shot_to: 0.1511 };
    action: character_expression { target: 'sagan', expression: 'disappointed', shot_from: 0.174 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.13', words: '.000-.080 .080-.208 .208-.264 .272-.480 .560-.672 .696-.952', voice: '6767666667750376168775563127636776346104877244015666777635665786', shot_from: 0.174, shot_to: 0.3251 };
    action: character_expression { target: 'sagan', expression: 'thinking', shot_from: 0.3384 };
    action: character_sing { target: 'sagan', with: 'Star7', id: 'storie.canzone.puntino.14', words: '.000-.071 .097-.230 .239-.274 .327-.575 .549-.681 .699-.947', voice: '378711566667316400264004666763164001564575104877764300001', shot_from: 0.3384, shot_to: 0.4749 };
    action: character_expression { target: 'sagan', expression: 'neutral', shot_from: 0.5148 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.15', words: '.000-.071 .087-.118 .087-.134 .087-.299 .402-.449 .433-.646 .614-.748 .740-.953', voice: '76750266127677776345643530257652676467415710267676410144455541666', shot_from: 0.5148, shot_to: 0.6683 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.6743 };
    action: character_sing { target: 'sagan', with: 'Star7', id: 'storie.canzone.puntino.16', words: '.000-.124 .149-.223 .223-.513 .570-.703 .703-.885 .885-.918 .885-.951', voice: '6301564015764576646565556316756653564676634730177666146555445', shot_from: 0.6743, shot_to: 0.8205 };
    action: character_expression { target: 'sagan', expression: 'hopeful', shot_from: 0.8411 };
    action: character_sing { target: 'sagan', with: 'Star7', id: 'storie.canzone.puntino.17', words: '.000-.107 .069-.222 .199-.497 .520-.605 .589-.712 .727-.972', voice: '630015656720057777510045515500561055001776678615766666655545542257', shot_from: 0.8411, shot_to: 0.999 };
  }
  scene solar_system_3d {
    // La Terra si allontana fino a diventare un granello in un raggio di Sole.
    duration: 11.75s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 60.55, bpm: 87, beat: 0.85 };
    action: story_camera { mode: rhythm };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 30, elev_from: 40, elev_to: 10, zoom_from: 2.4, zoom_to: 0.95 };
    action: character_show { target: 'Earth', expression: 'thinking' };
    action: character_show { target: 'Sun', expression: 'neutral' };
    action: character_show { target: 'sagan', expression: 'thinking', at: left };
    action: character_expression { target: 'Earth', expression: 'surprised', shot_from: 0.2426 };
    action: effect { type: glow, target: 'Sun', duration: 5, shot_from: 0.4723 };
    action: character_look_at { target: 'Earth', object: 'Sun', shot_from: 0.4809 };
    action: character_expression { target: 'Earth', expression: 'sad', shot_from: 0.7021 };
    action: character_scale { target: 'Earth', scale: 0.55, shot_from: 0.7106 };
    action: character_expression { target: 'sagan', expression: 'thinking', shot_from: 0.0094 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.18', words: '.000-.081 .081-.211 .219-.252 .284-.545 .553-.683 .634-.789 .772-.951', voice: '66100576206502840287105556776577676100287776665666666763000000', shot_from: 0.0094, shot_to: 0.2187 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.2477 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.19', words: '.000-.211 .203-.268 .268-.309 .268-.528 - .569-.683 .675-.951', voice: '74001553163027667877566655720576623776776765304777767754445544', shot_from: 0.2477, shot_to: 0.457 };
    action: character_expression { target: 'sagan', expression: 'determined', shot_from: 0.4791 };
    action: character_sing { target: 'sagan', with: 'Sun', id: 'storie.canzone.puntino.20', words: '.000-.183 .141-.225 .233-.296 .324-.387 .366-.507 .514-.570 .669-.887 .908-.958', voice: '661005765156666667776115626610166556672045677103763068302766566656530566', shot_from: 0.4791, shot_to: 0.7209 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.714 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.21', words: '.000-.047 .000-.208 .235-.289 .342-.376 - .403-.450 .456-.577 .591-.658 .631-.799 .812-.960', voice: '5663036666655774017766567686104410461015776457226400257666652553000000000000', shot_from: 0.714, shot_to: 0.9677 };
  }
  scene solar_system_3d {
    // Primo ritornello: la camera esce nella scala cosmica, l'arena è vasta, la Terra un granello.
    duration: 11.05s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 72.3, bpm: 87, beat: 0.85 };
    action: story_camera { mode: orbit, speed: 14 };
    action: cosmic_scale { from: 'inner_planets', to: 'heliopause', ease: smooth };
    action: character_show { target: 'Earth', expression: 'thinking' };
    action: character_show { target: 'Sun', expression: 'neutral' };
    action: character_show { target: 'voyager1', expression: 'thinking' };
    action: character_show { target: 'voyager2', expression: 'thinking' };
    action: character_show { target: 'sagan', expression: 'wonder', at: top };
    action: character_scale { target: 'Earth', scale: 0.6, shot_from: 0.0271, shot_to: 0.2443 };
    action: character_scale { target: 'Earth', scale: 1, shot_from: 0.7511, shot_to: 0.9231 };
    action: effect { type: smoke, at: center, size: 1.4, shot_from: 0.7602 };
    action: character_expression { target: 'Earth', expression: 'surprised', shot_from: 0.543 };
    action: character_expression { target: 'Earth', expression: 'neutral', shot_from: 0.7511 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.0253 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.22', words: '.000-.049 .000-.176 .176-.218 .247-.317 .317-.838 .838-.958', voice: '588886668888753103666520004777778667730016888657751388887777641048873010', shot_from: 0.0253, shot_to: 0.2824 };
    action: character_expression { target: 'sagan', expression: 'impressed', shot_from: 0.3077 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.23', words: '.000-.099 .144-.261 .288-.532 .532-.820 .847-.946', voice: '66567763788741004888788877888887688623787765224763389987', shot_from: 0.3077, shot_to: 0.5086 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.5394 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.24', words: '.000-.139 .092-.695 .713-.945', voice: '4544788767765676566555766630003788888877752598777778876', shot_from: 0.5394, shot_to: 0.7348 };
    action: character_expression { target: 'sagan', expression: 'mysterious', shot_from: 0.7475 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.25', words: '.000-.119 .127-.271 .254-.593 .559-.788 .763-.949', voice: '667885348854773588426741475116830456678413788863115763368777', shot_from: 0.7475, shot_to: 0.9611 };
  }
  scene solar_system_3d {
    // La camera torna a casa: pallido punto blu, cantato da tutti.
    duration: 13.15s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 83.35, bpm: 87, beat: 0.85 };
    action: story_camera { mode: rhythm };
    action: cosmic_scale { from: 'heliopause', to: 'earth_moon', ease: smooth };
    action: character_show { target: 'Earth', expression: 'sad' };
    action: character_show { target: 'Sun', expression: 'neutral' };
    action: character_show { target: 'voyager1', expression: 'sad' };
    action: character_show { target: 'voyager2', expression: 'neutral' };
    action: character_show { target: 'sagan', expression: 'tender', at: left };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.26', words: '.000-.452 .503-.669 .592-.924', voice: '8767723677510254420266156565322899998867', shot_from: 0, shot_to: 0.1194 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.124 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.27', words: '.000-.274 .280-.338 .331-.459 .459-.605 .586-.784 .771-.962', voice: '6788898679974699888864686479623898777656755898876314788887766677521116777765368', shot_from: 0.124, shot_to: 0.3627 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.3871 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.28', words: '.000-.343 .407-.528 .639-1.000', voice: '8997667548776100344411672376663003788887656789875325899', shot_from: 0.3871, shot_to: 0.5513 };
    action: character_expression { target: 'sagan', expression: 'determined', shot_from: 0.5452 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.29', words: '.000-.286 - .292-.387 .401-.523 .523-.604 .572-.760 .774-.843 .823-.978', voice: '89998522488889887653148203520164004786677157889850058888578525566653003300', shot_from: 0.5452, shot_to: 0.7691 };
  }
  scene solar_system_3d {
    // Terza strofa, rap duro: Marte, il dio della guerra, e Giove, il re degli dèi, si contendono la Terra.
    duration: 10.92s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 96.5, bpm: 87, beat: 0.85, kick: 1.6 };
    action: story_camera { mode: rhythm };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth,Mars,Jupiter', orbit: 30, elev_from: 60, elev_to: 32, zoom_from: 0.8, zoom_to: 1.2 };
    action: character_show { target: 'Mars', expression: 'angry' };
    action: character_show { target: 'Jupiter', expression: 'bully' };
    action: character_show { target: 'Earth', expression: 'worried' };
    action: character_show { target: 'sagan', expression: 'worried', at: right };
    action: effect { type: glow, target: 'Mars', color: '#dc2626', duration: 4, shot_from: 0.0458 };
    action: character_move { target: 'Mars', to: 'Earth', side: left, path: zigzag, shot_from: 0.2839, shot_to: 0.5037 };
    action: character_move { target: 'Jupiter', to: 'Earth', side: right, path: arc, shot_from: 0.3022, shot_to: 0.5403 };
    action: effect { type: lightning, target: 'Jupiter', shot_from: 0.4762 };
    action: character_animate { target: 'Earth', animation: shake, times: 3, shot_from: 0.7326, shot_to: 0.9615 };
    action: character_sing { target: 'Mars', id: 'storie.canzone.puntino.30', words: '.000-.158 .084-.211 .179-.368 .337-.516 .547-.674 .726-.937', voice: '6730551036553451240006866337566400178874242001110', shot_from: 0.0531, shot_to: 0.2271 };
    action: character_sing { target: 'Jupiter', id: 'storie.canzone.puntino.31', words: '.000-.181 .209-.419 .400-.457 .400-.638 .705-.981', voice: '75024765666777775651057667004766565038521566851520574', shot_from: 0.2894, shot_to: 0.4817 };
    action: character_expression { target: 'sagan', expression: 'frustrated', shot_from: 0.4744 };
    action: character_sing { target: 'sagan', with: 'Mars,Jupiter', id: 'storie.canzone.puntino.32', words: '.000-.112 .074-.366 .380-.560 .522-.619 .657-.716 .664-.888 .925-1.000', voice: '57400454475104877776127401666565520466554100476667536434777520430145', shot_from: 0.4744, shot_to: 0.7198 };
    action: character_expression { target: 'sagan', expression: 'sad', shot_from: 0.7125 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.33', words: '.000-.091 .176-.206 .176-.373 .366-.408 .366-.472 .500-.599 - .669-.803 .803-.923 .923-.958', voice: '145530366873377211487666614610254202765564035103721575100550486446777763', shot_from: 0.7125, shot_to: 0.9725 };
  }
  scene solar_system_3d {
    // Fratello contro fratello: lampi, botti e il quadro che trema; poi la domanda: ma perché?
    duration: 10.88s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 107.42, bpm: 87, beat: 0.85, kick: 1.8 };
    action: story_camera { mode: rhythm };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth,Mars,Jupiter', orbit: 30, orbit_from: 30, elev_from: 32, elev_to: 14, zoom_from: 1.2, zoom_to: 0.9 };
    action: character_show { target: 'Mars', expression: 'angry' };
    action: character_show { target: 'Jupiter', expression: 'angry' };
    action: character_show { target: 'Earth', expression: 'worried' };
    action: character_show { target: 'sagan', expression: 'worried', at: right };
    action: effect { type: explosion, target: 'Mars', shot_from: 0.0074 };
    action: effect { type: lightning, target: 'Mars', shot_from: 0.2463 };
    action: effect { type: lightning, target: 'Jupiter', shot_from: 0.3474 };
    action: character_animate { target: 'Mars', animation: shake, times: 4, shot_from: 0.2371, shot_to: 0.4761 };
    action: character_animate { target: 'Jupiter', animation: shake, times: 4, shot_from: 0.2371, shot_to: 0.4761 };
    action: character_expression { target: 'Earth', expression: 'sad', shot_from: 0.4853 };
    action: effect { type: smoke, target: 'Earth', shot_from: 0.4945 };
    action: character_expression { target: 'Mars', expression: 'embarrassed', shot_from: 0.7426 };
    action: character_expression { target: 'Jupiter', expression: 'confused', shot_from: 0.7426 };
    action: character_return { target: 'Mars', path: arc, shot_from: 0.7518, shot_to: 0.9908 };
    action: character_return { target: 'Jupiter', path: arc, shot_from: 0.7518, shot_to: 0.9908 };
    action: character_sing { target: 'Mars', id: 'storie.canzone.puntino.34', words: '.000-.083 .250-.386 .386-.462 .439-.508 .500-.583 .591-.697 .697-.962', voice: '7626740178403530172004876465177657876536678765889876202661025555783', shot_from: 0, shot_to: 0.2426 };
    action: character_expression { target: 'sagan', expression: 'angry', shot_from: 0.2353 };
    action: character_sing { target: 'sagan', with: 'Mars,Jupiter', id: 'storie.canzone.puntino.35', words: '.000-.159 .159-.383 .392-.514 - .561-.804 .813-.925 .878-.944', voice: '7834861027100476423106740178713776577227751156128832798', shot_from: 0.2353, shot_to: 0.432 };
    action: character_expression { target: 'sagan', expression: 'confused', shot_from: 0.489 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.36', words: '.000-.177 .128-.362 .347-.440 .475-.695 .667-.801 .801-.957', voice: '886357224742367766410465675415651277420167654612887568876777521224544687', shot_from: 0.489, shot_to: 0.7482 };
    action: character_expression { target: 'sagan', expression: 'disappointed', shot_from: 0.7574 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.37', words: '.000-.068 .076-.274 .258-.319 .319-.601 - .570-.783 .783-.890 .928-.989', voice: '4753587566665245145101357625610243046687840188876502671017776666779', shot_from: 0.7574, shot_to: 0.999 };
  }
  scene solar_system_3d {
    // Quarta strofa, lenta: Saturno si vanta, il Sole guarda storto l'idea che noi siamo al centro.
    duration: 10.85s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 118.3, bpm: 87, beat: 0.85, kick: 0.7 };
    action: story_camera { mode: orbit, speed: 10 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth,Saturn', orbit: 10, elev_from: 30, elev_to: 50 };
    action: character_show { target: 'Saturn', expression: 'proud' };
    action: character_show { target: 'Sun', expression: 'thinking' };
    action: character_show { target: 'Earth', expression: 'thinking' };
    action: character_show { target: 'sagan', expression: 'thinking', at: left };
    action: character_expression { target: 'Sun', expression: 'annoyed', shot_from: 0.2673 };
    action: character_expression { target: 'Saturn', expression: 'surprised', shot_from: 0.2765 };
    action: character_expression { target: 'Saturn', expression: 'embarrassed', shot_from: 0.5069 };
    action: character_sing { target: 'Saturn', id: 'storie.canzone.puntino.38', words: '.000-.052 .074-.170 .207-.400 .504-.644 .644-.711 .711-.956', voice: '88720587337851582016888776488864537977874117871371003766668778887874', shot_from: 0.0111, shot_to: 0.2599 };
    action: character_sing { target: 'Sun', id: 'storie.canzone.puntino.39', words: '.000-.273 .258-.379 .333-.462 .477-.583 .591-.651 - .651-.750 .735-.780 .735-.833 .864-.954', voice: '7766773027767685056000698457100278876305765898876986766668876667798', shot_from: 0.2654, shot_to: 0.5088 };
    action: character_expression { target: 'sagan', expression: 'skeptical', shot_from: 0.5198 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.40', words: '.000-.066 .074-.347 .364-.678 .645-.950', voice: '48611610038767771277317765640026989328637767876667327889610164', shot_from: 0.5198, shot_to: 0.7429 };
    action: character_expression { target: 'sagan', expression: 'thinking', shot_from: 0.7742 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.41', words: '.000-.131 .082-.262 .303-.451 .492-.574 .566-.705 .722-.861 .853-1.000', voice: '78300686353004620038776772372058301820145651573540005888720036', shot_from: 0.7742, shot_to: 0.999 };
  }
  scene solar_system_3d {
    // Soli nel buio: la camera si allontana fino alla nube di Oort, la Voyager guarda avanti.
    duration: 11.85s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 129.15, bpm: 87, beat: 0.85, kick: 0.6 };
    action: story_camera { mode: rhythm };
    action: cosmic_scale { from: 'earth_moon', to: 'oort', ease: smooth };
    action: character_show { target: 'Earth', expression: 'sad' };
    action: character_show { target: 'voyager1', expression: 'thinking', look: 'oort' };
    action: character_show { target: 'sagan', expression: 'wistful', at: right };
    action: character_expression { target: 'Earth', expression: 'thinking', shot_from: 0.6793 };
    action: effect { type: glow, target: 'Earth', duration: 4, shot_from: 0.6793 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.42', words: '.000-.102 .127-.249 .200-.380 .347-.469 .420-.714 .681-.820 .771-.951', voice: '65478202850069747774064003877750038876886696203555676776575267', shot_from: 0, shot_to: 0.2068 };
    action: character_expression { target: 'sagan', expression: 'scared', shot_from: 0.2017 };
    action: character_sing { target: 'sagan', with: 'voyager1', id: 'storie.canzone.puntino.43', words: '.000-.076 .076-.118 .187-.250 .222-.333 .299-.556 - .660-.695 .660-.750 .708-.778 .708-1.000', voice: '4673138734651371378777766553876100233443014750028503888766656357625623786', shot_from: 0.2017, shot_to: 0.4447 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.438 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.44', words: '.000-.180 .173-.244 .244-.381 .475-.511 .539-.676 .669-.777 .791-1.000', voice: '78667657730057100456784016888853035100660036100571583001510499888200487', shot_from: 0.438, shot_to: 0.6726 };
    action: character_expression { target: 'sagan', expression: 'determined', shot_from: 0.6658 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.45', words: '.000-.147 .162-.192 - .213-.258 .248-.446 .446-.502 .481-.593 .613-.689 .704-.745 .709-1.000', voice: '4875671004766676667504511688875476266410387677459856887788631466659853877673018999865200000000015556', shot_from: 0.6658, shot_to: 0.999 };
  }
  scene solar_system_3d {
    // Secondo ritornello: i pianeti ascoltano, la camera gira piano.
    duration: 10.9s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 141, bpm: 87, beat: 0.85, kick: 1.3 };
    action: story_camera { mode: orbit, speed: 14 };
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Venus,Earth,Mars,Jupiter', orbit: 24, elev_from: 40, elev_to: 58 };
    action: character_show { target: 'Earth', expression: 'thinking' };
    action: character_show { target: 'Venus', expression: 'neutral' };
    action: character_show { target: 'Mars', expression: 'neutral' };
    action: character_show { target: 'Jupiter', expression: 'neutral' };
    action: character_show { target: 'Sun', expression: 'thinking' };
    action: character_show { target: 'sagan', expression: 'wonder', at: right };
    action: effect { type: glow, target: 'Sun', duration: 5, shot_from: 0.2936 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.033 };
    action: character_sing { target: 'sagan', with: 'Earth,Venus,Mars,Jupiter,Sun', id: 'storie.canzone.puntino.46', words: '.000-.086 .060-.146 .179-.209 .179-.212 .238-.596 .629-.967', voice: '79623787787414840036877755200026656861038999862048877630167777643211048885455', shot_from: 0.033, shot_to: 0.3101 };
    action: character_expression { target: 'sagan', expression: 'impressed', shot_from: 0.3028 };
    action: character_sing { target: 'sagan', with: 'Earth,Venus,Mars,Jupiter,Sun', id: 'storie.canzone.puntino.47', words: '.000-.083 .052-.188 .195-.376 .391-.504 .451-.955', voice: '4556998788521588889999987676316997521158723899864203667765421213766', shot_from: 0.3028, shot_to: 0.5468 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.556 };
    action: character_sing { target: 'sagan', with: 'Earth,Venus,Mars,Jupiter,Sun', id: 'storie.canzone.puntino.48', words: '.000-.068 .000-.476 .505-.942', voice: '58977887787777510378888885542028998899999878888754227', shot_from: 0.556, shot_to: 0.745 };
    action: character_expression { target: 'sagan', expression: 'mysterious', shot_from: 0.7743 };
    action: character_sing { target: 'sagan', with: 'Earth,Venus,Mars,Jupiter,Sun', id: 'storie.canzone.puntino.49', words: '.000-.079 .065-.166 .286-.506 .498-.670 .637-.988', voice: '45558999769857985489743762487767887765169998631378737998775579', shot_from: 0.7743, shot_to: 0.999 };
  }
  scene solar_system_3d {
    // Pallido punto blu, ancora: la Terra e la Luna da vicino.
    duration: 11.7s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 151.9, bpm: 87, beat: 0.85, kick: 1.3 };
    action: story_camera { mode: rhythm };
    action: camera_3d { scene: earth_moon, focus: 'Earth', orbit: -60, elev_from: 40, elev_to: 10 };
    action: character_show { target: 'Earth', expression: 'sad' };
    action: character_show { target: 'Moon', expression: 'neutral' };
    action: character_show { target: 'sagan', expression: 'tender', at: left };
    action: character_expression { target: 'Moon', expression: 'sad', shot_from: 0.6496 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.0034 };
    action: character_sing { target: 'sagan', with: 'Earth,Moon', id: 'storie.canzone.puntino.50', words: '.000-.513 .527-.698 .619-.921', voice: '997787589876201455315843898753104999997', shot_from: 0.0034, shot_to: 0.1333 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.1761 };
    action: character_sing { target: 'sagan', with: 'Earth,Moon', id: 'storie.canzone.puntino.51', words: '.000-.272 .272-.335 .323-.443 .443-.595 .595-.778 .766-.962', voice: '76789976998569999999857965997599998988888779999863169988999777776443368888743899', shot_from: 0.1761, shot_to: 0.4462 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.4872 };
    action: character_sing { target: 'sagan', with: 'Earth,Moon', id: 'storie.canzone.puntino.52', words: '.000-.395 .420-.593 .543-.926', voice: '88469888511244531784588764203999986578999', shot_from: 0.4872, shot_to: 0.6256 };
    action: character_expression { target: 'sagan', expression: 'determined', shot_from: 0.6462 };
    action: character_sing { target: 'sagan', with: 'Earth,Moon', id: 'storie.canzone.puntino.53', words: '.000-.183 - .347-.387 .408-.523 .543-.612 .577-.761 .781-.855 .835-.982', voice: '79998422486789999743228502630067124787558627888610168998558722445551037500', shot_from: 0.6462, shot_to: 0.8978 };
  }
  scene solar_system_3d {
    // Il ponte, parlato, con l'orchestra che cresce: non c'è un altro posto dove andare.
    duration: 20.65s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 163.6, bpm: 87, beat: 0.85, kick: 0.35 };
    action: story_camera { mode: auto };
    action: camera_3d { scene: system, focus: 'Earth', orbit: 40, elev_from: 8, elev_to: 46, zoom_from: 0.75, zoom_to: 1.35 };
    action: character_show { target: 'Earth', expression: 'neutral' };
    action: character_show { target: 'Mars', expression: 'thinking' };
    action: character_show { target: 'sagan', expression: 'wonder', at: left };
    action: effect { type: glow, target: 'Earth', duration: 5, shot_from: 0.0242 };
    action: character_expression { target: 'Mars', expression: 'disappointed', shot_from: 0.4068 };
    action: character_animate { target: 'Mars', animation: nod, times: 2, shot_from: 0.4116, shot_to: 0.5327 };
    action: character_expression { target: 'Earth', expression: 'sad', shot_from: 0.6053 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.0174 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.54', words: '.000-.091 .086-.162 .187-.217 .187-.328 .339-.414 .394-.540 .525-.626 .636-.692 .707-.833 .818-.894 .914-.970', voice: '5511798657876766631333312640355313510343344203320440230016542113532200310156553324400100001200000000', shot_from: 0.0174, shot_to: 0.2092 };
    action: character_expression { target: 'sagan', expression: 'worried', shot_from: 0.2809 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.55', words: '.000-.045 .020-.089 .085-.167 .187-.280 - .390-.463 .451-.565 .569-.715 - .805-.878 .890-.976', voice: '4214578861146104765221022000000000000000000000002100220253430346764210100000000000000000000000000003202310100346654432100000', shot_from: 0.2809, shot_to: 0.5191 };
    action: character_expression { target: 'sagan', expression: 'determined', shot_from: 0.6073 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.56', words: '.000-.030 .026-.056 .026-.094 .097-.135 .135-.165 .387-.427 .441-.471 .441-.481 .487-.553 .825-.862 .845-.948 .951-.983', voice: '3541146850244652145542100000000000000000000000000000000000000000000151037424245412411447643100000000000000000000000000000000000000000000000000015304431003421777774101442000000', shot_from: 0.6073, shot_to: 0.9453 };
  }
  scene solar_system_3d {
    // Ultima strofa: di nuovo la Voyager 1, lontana.
    duration: 11s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 184.25, bpm: 87, beat: 0.85, kick: 1.4 };
    action: story_camera { mode: rhythm };
    action: voyager_journey { from: '1990-02-13T00:00:00Z', to: '1990-02-15T00:00:00Z', probes: 'voyager1', model_from: 0.17, model_to: 0.22, home: show, gaze: show, proportion: free };
    action: camera_3d { scene: system, focus: 'Voyager 1', probe_az: -80, orbit: -40, elev_from: 14, elev_to: -8, zoom_from: 0.8, zoom_to: 1.3 };
    action: character_show { target: 'voyager1', expression: 'thinking' };
    action: character_show { target: 'sagan', expression: 'thinking', at: left };
    action: character_expression { target: 'voyager1', expression: 'proud', shot_from: 0.2591 };
    action: effect { type: flash, target: 'voyager1', shot_from: 0.75 };
    action: character_expression { target: 'voyager1', expression: 'sad', shot_from: 0.7591 };
    action: character_expression { target: 'sagan', expression: 'thinking', shot_from: 0.0191 };
    action: character_sing { target: 'sagan', with: 'voyager1', id: 'storie.canzone.puntino.57', words: '.000-.292 .331-.361 .331-.592 .615-.669 .669-.731 .692-.954', voice: '672003654354234466653354105878301003675487328777875014766764003314', shot_from: 0.0191, shot_to: 0.2555 };
    action: character_expression { target: 'sagan', expression: 'impressed', shot_from: 0.2555 };
    action: character_sing { target: 'sagan', with: 'voyager1', id: 'storie.canzone.puntino.58', words: '.000-.102 .094-.181 .197-.512 .535-.630 .630-.716 .677-.764 .827-.953', voice: '4752346403434641027510046656614513887642634976227314776657402452', shot_from: 0.2555, shot_to: 0.4864 };
    action: character_expression { target: 'sagan', expression: 'disappointed', shot_from: 0.4936 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.59', words: '.000-.152 .117-.276 .235-.379 .345-.483 .462-.662 .697-.765 .765-.917 .910-.959', voice: '57558501463233661463364005876551048643577655510120047300660068777667764137', shot_from: 0.4936, shot_to: 0.7573 };
    action: character_expression { target: 'sagan', expression: 'wonder', shot_from: 0.7555 };
    action: character_sing { target: 'sagan', with: 'voyager1', id: 'storie.canzone.puntino.60', words: '.000-.062 .070-.140 .140-.383 .414-.562 .539-.672 .680-.789 .883-.953', voice: '66102842477773455477213100497611642760034101771034431000178757767', shot_from: 0.7555, shot_to: 0.9882 };
  }
  scene solar_system_3d {
    // Il crescendo: dalla nube di Oort a casa, tutti insieme.
    duration: 12.35s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 195.25, bpm: 87, beat: 0.85, kick: 1.6 };
    action: story_camera { mode: orbit, speed: 14 };
    action: cosmic_scale { from: 'heliopause', to: 'earth_moon', ease: smooth };
    action: character_show { target: 'Earth', expression: 'neutral' };
    action: character_show { target: 'Sun', expression: 'neutral' };
    action: character_show { target: 'voyager1', expression: 'hopeful' };
    action: character_show { target: 'voyager2', expression: 'hopeful' };
    action: character_show { target: 'sagan', expression: 'determined', at: top };
    action: character_expression { target: 'Earth', expression: 'sad', shot_from: 0.4413 };
    action: effect { type: glow, target: 'Earth', duration: 3, shot_from: 0.4494 };
    action: character_expression { target: 'sagan', expression: 'determined', shot_from: 0.0073 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.61', words: '.000-.304 .272-.464 .496-.760 .736-.888 .904-.976', voice: '550047636555477767676620016510175036435401881157402797655632561', shot_from: 0.0073, shot_to: 0.2097 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.2032 };
    action: character_sing { target: 'sagan', with: 'voyager1,voyager2', id: 'storie.canzone.puntino.62', words: '.000-.080 .106-.265 .291-.358 .338-.411 - .563-.669 .675-.762 .722-.993', voice: '56104511676302464565546632743587640176415514510241048305753168766556214620550', shot_from: 0.2032, shot_to: 0.4478 };
    action: character_expression { target: 'sagan', expression: 'determined', shot_from: 0.4413 };
    action: character_sing { target: 'sagan', with: 'Sun,Earth', id: 'storie.canzone.puntino.63', words: '.000-.132 .118-.312 .347-.377 .354-.583 .590-.708 .722-.792 .826-.875 .896-.958', voice: '5500573027612877665003640488612477761042003710165410575772015554346775100', shot_from: 0.4413, shot_to: 0.6745 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.6777 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.64', words: '.000-.040 .057-.194 .212-.286 .252-.389 - .503-.692 .697-.754 .732-.789 .794-.852 .852-.966', voice: '6875365165001566401750456520000000000000000023313116641444313622651013443331000000000000', shot_from: 0.6777, shot_to: 0.9611 };
  }
  scene solar_system_3d {
    // L'outro: la voce profonda, il battito che si spegne, la Terra e la Luna.
    duration: 16.4s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 207.6, bpm: 87, beat: 0.85, kick: 0.4 };
    action: story_camera { mode: orbit, speed: 12 };
    action: camera_3d { scene: earth_moon, focus: 'Earth', orbit: 60, elev_from: 30, elev_to: 6 };
    action: character_show { target: 'Earth', expression: 'sad' };
    action: character_show { target: 'Moon', expression: 'sad', look: 'Earth' };
    action: character_show { target: 'sagan', expression: 'wistful', at: right };
    action: effect { type: glow, target: 'Earth', duration: 8, shot_from: 0.0244 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.0232 };
    action: character_sing { target: 'sagan', id: 'storie.canzone.puntino.65', words: '.000-.375 .397-.961', voice: '23322156205565421120000', shot_from: 0.0232, shot_to: 0.0784 };
    action: character_expression { target: 'sagan', expression: 'tender', shot_from: 0.1854 };
    action: character_sing { target: 'sagan', with: 'Earth', id: 'storie.canzone.puntino.66', words: '.000-.117 .125-.508 .537-.633 .633-.965', voice: '5773046653443476630655456676634320', shot_from: 0.1854, shot_to: 0.2682 };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.3193 };
    action: character_sing { target: 'sagan', with: 'Earth,Moon', id: 'storie.canzone.puntino.67', voice: '011211232210332333223322123333333333211334444445554565666554443445444444443322332232222222222222234433433333544444445555666666666665566664355666555544555555555544545555555554444555565567777765556666644332110', shot_from: 0.3193, shot_to: 0.8233 };
  }
  scene solar_system_3d {
    // Il congedo: tutti canticchiano mentre la camera esce dalla Terra verso la bolla locale.
    duration: 23s;
    action: story_music { src: 'musica/canzoni/pallido-punto-blu.mp3', volume: 0.95, sync: on, loop: off, sounds: off, at: 224, bpm: 87, beat: 0.85, kick: 0.3 };
    action: story_camera { mode: orbit, speed: 10 };
    action: cosmic_scale { from: 'earth', to: 'local_bubble', ease: smooth };
    action: character_show { target: 'Earth', expression: 'sad' };
    action: character_show { target: 'Sun', expression: 'neutral' };
    action: character_show { target: 'voyager1', expression: 'neutral' };
    action: character_show { target: 'voyager2', expression: 'neutral' };
    action: character_show { target: 'sagan', expression: 'wistful', at: top };
    action: character_expression { target: 'sagan', expression: 'wistful', shot_from: 0.0104 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.67', voice: '433443444344453454544444444445544554556666677776666666777777666766666555656665665665555666666665555666665456676777777777766666666667667776655667765777776676666767777667777776667877877877767765543332100000000000000', shot_from: 0.0104, shot_to: 0.3791 };
    action: character_expression { target: 'sagan', expression: 'hopeful', shot_from: 0.4435 };
    action: character_sing { target: 'sagan', with: 'Earth,Sun,voyager1,voyager2', id: 'storie.canzone.puntino.68', voice: '0000000000034455566566666666666676667667666466666776777677776888888889999998889999999999888898878878888888888888788887887888888888888999998999888889998988888888888888888988888878798888888886788888888898999899999999988888888877677', shot_from: 0.4435, shot_to: 0.84 };
  }
}`
    },
    {
      chiave: 'storia_einstein',
      storia: true,
      cast: 'einstein,astro_ben,Sun,Earth,Mercury,iss,cristoforetti,sgr_a,gargantua,hawking',
      testo: `define_demo 'storia_einstein' {
  // «Einstein e il tempo elastico» (v469). Astro Ben, il bambino
  // astronauta, ha visto «Interstellar» e chiede ad Albert Einstein se è vero
  // che un'ora può valere sette anni. Einstein glielo spiega a passi, con
  // l'effetto spacetime (il telo che sprofonda): la gravità come curva
  // (il Sole, la Terra, la frase di Wheeler), le prove (Mercurio, 43″ al
  // secolo; l'eclissi del 1919), il tempo che rallenta vicino a una massa
  // (la domanda a chi guarda: montagna o mare?, il GPS, i millesimi di
  // Samantha Cristoforetti sulla Stazione), poi il buco nero vero al centro
  // della Galassia (Sagittario A*, orizzonte degli eventi, il tempo che si
  // ferma visto da fuori), Gargantua del film (Kip Thorne, il pianeta di
  // Miller, Cooper e Murph), LIGO 2015 e la foto del 2022, e un saluto di
  // Stephen Hawking. Si parte e si torna nel cielo di Roma la sera del 16
  // ottobre 2026, verso il Sagittario, dove sta il centro della Galassia.
  scene planetarium_view {
    // Il cielo di Roma, verso il Sagittario: là in basso, oltre le stelle,
    // c'è il buco nero al centro della Galassia che si andrà a trovare
    duration: 17s;
    action: set_location { lat: 41.9028, lon: 12.4964, name: 'Roma', timezone: 'Europe/Rome' };
    action: set_date { iso: '2026-10-16T18:45:00Z' };
    action: point_view { az: 218, alt: 16 };
    action: zoom_fov { from: 75, to: 48 };
    action: story_title { id: 'storie.titolo.einstein', shot_to: 0.3 };
    action: character_show { target: 'einstein', expression: 'thinking', at: left };
    action: character_show { target: 'astro_ben', expression: 'excited', at: right, look: 'einstein' };
    action: character_animate { target: 'astro_ben', animation: jump, times: 2, shot_from: 0.3 };
    action: character_look_at { target: 'einstein', object: 'astro_ben' };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.1', shot_from: 0.3 };
  }
  scene planetarium_view {
    duration: 14s;
    action: set_fov { degrees: 48 };
    action: point_view { az: 218, alt: 16 };
    action: character_show { target: 'einstein', expression: 'playful', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'curious', at: right, look: 'einstein' };
    action: character_expression { target: 'einstein', expression: 'wonder', shot_from: 0.55 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.2' };
  }
  scene transition {
    duration: 18s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
    action: date_card { label: 'demo.cartello.storia_einstein.relativita' };
    action: character_show { target: 'einstein', expression: 'thinking', at: left };
    action: character_show { target: 'astro_ben', expression: 'surprised', at: right, look: 'einstein' };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.3' };
  }
  scene solar_system_3d {
    // Il telo elastico: la griglia sprofonda attorno al Sole e una biglia
    // (la Terra) ci gira dentro, seguendo la curva
    duration: 19s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 40, elev_from: 34, elev_to: 48, zoom_from: 1.6, zoom_to: 2.1 };
    action: character_show { target: 'einstein', expression: 'happy', at: left, look: 'Sun' };
    action: character_show { target: 'astro_ben', expression: 'curious', at: right, look: 'Sun' };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_show { target: 'Earth', expression: 'happy', look: 'Sun' };
    action: effect { type: spacetime, target: 'Sun', duration: 18, shot_from: 0.12 };
    action: character_expression { target: 'astro_ben', expression: 'wonder', shot_from: 0.6 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.4' };
  }
  scene solar_system_3d {
    duration: 7s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 10, orbit_from: 40, elev_from: 48, elev_to: 46, zoom_from: 2.1, zoom_to: 2.15 };
    action: character_show { target: 'einstein', expression: 'happy', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'excited', at: right };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_show { target: 'Earth', expression: 'laughing', look: 'Sun' };
    action: character_animate { target: 'astro_ben', animation: bounce, times: 2 };
    action: effect { type: sparkles, target: 'Earth', shot_from: 0.1 };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.5' };
  }
  scene solar_system_3d {
    duration: 16s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 20, orbit_from: 50, elev_from: 46, elev_to: 40, zoom_from: 2.15, zoom_to: 2.2 };
    action: character_show { target: 'einstein', expression: 'laughing', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'happy', at: right, look: 'einstein' };
    action: character_show { target: 'Sun', expression: 'happy' };
    action: character_show { target: 'Earth', expression: 'happy', look: 'Sun' };
    action: character_expression { target: 'einstein', expression: 'proud', shot_from: 0.35 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.6' };
  }
  scene solar_system_3d {
    duration: 20s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Mercury', orbit: 60, elev_from: 30, elev_to: 55, zoom_from: 1.4, zoom_to: 2 };
    action: date_card { label: 'demo.cartello.storia_einstein.mercurio' };
    action: character_show { target: 'einstein', expression: 'proud', at: left, look: 'Mercury' };
    action: character_show { target: 'Mercury', expression: 'surprised', look: 'einstein' };
    action: character_show { target: 'Sun', expression: 'thinking', look: 'Mercury' };
    action: effect { type: spacetime, target: 'Sun', size: 0.8, duration: 16, shot_from: 0.3 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.7' };
  }
  scene solar_system_3d {
    duration: 13s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Mercury', orbit: 25, orbit_from: 60, elev_from: 55, elev_to: 50, zoom_from: 2, zoom_to: 2.2 };
    action: character_show { target: 'einstein', expression: 'laughing', at: left, look: 'Mercury' };
    action: character_show { target: 'Mercury', expression: 'relieved' };
    action: character_show { target: 'Sun', expression: 'happy', look: 'Mercury' };
    action: character_animate { target: 'Mercury', animation: dance, times: 2, shot_from: 0.2 };
    action: effect { type: confetti, target: 'Mercury', shot_from: 0.15 };
    action: character_speak { target: 'Mercury', id: 'demo.narr.storia_einstein.8' };
  }
  scene solar_system_3d {
    duration: 17s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 30, elev_from: 20, elev_to: 14, zoom_from: 2.4, zoom_to: 3 };
    action: date_card { label: 'demo.cartello.storia_einstein.eclissi' };
    action: character_show { target: 'einstein', expression: 'determined', at: left, look: 'Sun' };
    action: character_show { target: 'Sun', expression: 'surprised' };
    action: effect { type: glow, target: 'Sun', duration: 10, shot_from: 0.1 };
    action: effect { type: shooting_star, at: right, shot_from: 0.4 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.9' };
  }
  scene solar_system_3d {
    duration: 7s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth', orbit: 15, orbit_from: 30, elev_from: 14, elev_to: 12, zoom_from: 3, zoom_to: 3.2 };
    action: character_show { target: 'einstein', expression: 'happy', at: left, look: 'Sun' };
    action: character_show { target: 'Sun', expression: 'excited' };
    action: character_animate { target: 'Sun', animation: pulse, times: 2, shot_from: 0.1 };
    action: effect { type: sparkles, target: 'Sun', shot_from: 0.1 };
    action: character_speak { target: 'Sun', id: 'demo.narr.storia_einstein.10' };
  }
  scene solar_system_3d {
    duration: 14s;
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 70, orbit: -25, elev_from: 20, elev_to: 12, zoom_from: 1.2, zoom_to: 1.7 };
    action: character_show { target: 'einstein', expression: 'mysterious', at: left, look: 'viewer' };
    action: character_show { target: 'astro_ben', expression: 'surprised', at: right, look: 'einstein' };
    action: character_show { target: 'Earth', expression: 'surprised' };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.11' };
  }
  scene solar_system_3d {
    duration: 5s;
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 70, orbit: -15, orbit_from: -25, elev_from: 12, elev_to: 10, zoom_from: 1.7, zoom_to: 1.8 };
    action: character_show { target: 'einstein', expression: 'mysterious', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'curious', at: right, look: 'einstein' };
    action: character_show { target: 'Earth', expression: 'curious' };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.12' };
  }
  scene solar_system_3d {
    // La domanda a chi guarda: montagna o mare?
    duration: 17s;
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 70, orbit: -20, orbit_from: -40, elev_from: 10, elev_to: 16, zoom_from: 1.8, zoom_to: 2.1 };
    action: character_show { target: 'einstein', expression: 'playful', at: left, look: 'viewer' };
    action: character_show { target: 'astro_ben', expression: 'thinking', at: right };
    action: character_show { target: 'Earth', expression: 'thinking' };
    action: effect { type: sparkles, target: 'einstein', shot_from: 0.1 };
    action: character_expression { target: 'astro_ben', expression: 'curious', shot_from: 0.8 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.13' };
  }
  scene solar_system_3d {
    duration: 11s;
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 70, orbit: 20, orbit_from: -8, elev_from: 16, elev_to: 22, zoom_from: 2.1, zoom_to: 1.9 };
    action: character_show { target: 'einstein', expression: 'impressed', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'excited', at: right };
    action: character_show { target: 'Earth', expression: 'happy' };
    action: effect { type: spacetime, target: 'Earth', size: 0.6, color: '#93c5fd', duration: 12, shot_from: 0.2 };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.14' };
  }
  scene solar_system_3d {
    duration: 17s;
    action: camera_3d { scene: system, focus: 'Earth', sun_az: 70, orbit: 20, orbit_from: 12, elev_from: 22, elev_to: 26, zoom_from: 1.9, zoom_to: 1.6 };
    action: date_card { label: 'demo.cartello.storia_einstein.gps' };
    action: character_show { target: 'einstein', expression: 'proud', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'impressed', at: right, look: 'einstein' };
    action: character_show { target: 'Earth', expression: 'happy' };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.15' };
  }
  scene solar_system_3d {
    // Sulla Stazione: corre a 7,7 km/s e il suo tempo va un poco più piano
    // (lassù la velocità conta più della gravità, che è appena più debole)
    duration: 8s;
    action: camera_3d { scene: system, focus: 'ISS', orbit: 25, elev_from: 15, elev_to: 22, zoom_from: 0.8, zoom_to: 0.95 };
    action: character_show { target: 'astro_ben', expression: 'curious', at: left, look: 'cristoforetti' };
    action: character_show { target: 'cristoforetti', expression: 'happy', at: right, look: 'astro_ben' };
    action: character_show { target: 'iss', expression: 'happy' };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.16' };
  }
  scene solar_system_3d {
    duration: 15s;
    action: camera_3d { scene: system, focus: 'ISS', orbit: 30, orbit_from: 25, elev_from: 22, elev_to: 32, zoom_from: 0.95, zoom_to: 1.1 };
    action: character_show { target: 'astro_ben', expression: 'surprised', at: left, look: 'cristoforetti' };
    action: character_show { target: 'cristoforetti', expression: 'playful', at: right, look: 'viewer' };
    action: character_show { target: 'iss', expression: 'excited' };
    action: character_animate { target: 'iss', animation: spin, times: 1, shot_from: 0.3 };
    action: character_speak { target: 'cristoforetti', id: 'demo.narr.storia_einstein.17' };
  }
  scene solar_system_3d {
    duration: 8s;
    action: camera_3d { scene: system, focus: 'ISS', orbit: 25, orbit_from: 55, elev_from: 32, elev_to: 40, zoom_from: 1.1, zoom_to: 1.2 };
    action: character_show { target: 'astro_ben', expression: 'laughing', at: left };
    action: character_show { target: 'cristoforetti', expression: 'laughing', at: right, look: 'astro_ben' };
    action: character_show { target: 'iss', expression: 'laughing' };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.18' };
  }
  scene solar_system_3d {
    // Dalla Terra al centro della Galassia, alla misura vera
    duration: 18s;
    action: cosmic_scale { from: 'arrival', to: 'milky_way', orbit: 25, elev_from: 40, elev_to: 60 };
    action: character_show { target: 'einstein', expression: 'mysterious', at: left };
    action: character_show { target: 'astro_ben', expression: 'scared', at: right, look: 'einstein' };
    action: character_expression { target: 'astro_ben', expression: 'excited', shot_from: 0.7 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.19' };
  }
  scene solar_system_3d {
    // Il pozzo senza fondo: lo stesso telo, molto più profondo
    duration: 13s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 12, elev_from: 60, elev_to: 64 };
    action: date_card { label: 'demo.cartello.storia_einstein.buco' };
    action: character_show { target: 'einstein', expression: 'wonder', at: left, look: 'sgr_a' };
    action: character_show { target: 'astro_ben', expression: 'surprised', at: right, look: 'sgr_a' };
    action: character_show { target: 'sgr_a', expression: 'happy' };
    action: effect { type: spacetime, target: 'sgr_a', size: 1.6, color: '#c4b5fd', duration: 20, shot_from: 0.05 };
    action: character_speak { target: 'sgr_a', id: 'demo.narr.storia_einstein.20' };
  }
  scene solar_system_3d {
    duration: 16s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 8, elev_from: 64, elev_to: 66 };
    action: character_show { target: 'einstein', expression: 'thinking', at: left, look: 'sgr_a' };
    action: character_show { target: 'astro_ben', expression: 'worried', at: right, look: 'sgr_a' };
    action: character_show { target: 'sgr_a', expression: 'mysterious' };
    action: effect { type: glow, target: 'sgr_a', color: '#fb923c', duration: 6, shot_from: 0.3 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.21' };
  }
  scene solar_system_3d {
    duration: 5s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 5, elev_from: 66, elev_to: 67 };
    action: character_show { target: 'einstein', expression: 'mysterious', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'curious', at: right, look: 'einstein' };
    action: character_show { target: 'sgr_a', expression: 'thinking' };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.22' };
  }
  scene solar_system_3d {
    duration: 19s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 8, elev_from: 67, elev_to: 68 };
    action: character_show { target: 'einstein', expression: 'mysterious', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'scared', at: right, look: 'sgr_a' };
    action: character_show { target: 'sgr_a', expression: 'thinking' };
    action: effect { type: spacetime, target: 'sgr_a', size: 1.8, color: '#c4b5fd', duration: 14, shot_from: 0.1 };
    action: character_animate { target: 'astro_ben', animation: shake, times: 2, strength: 0.6, shot_from: 0.6 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.23' };
  }
  scene solar_system_3d {
    // Gargantua è un'idea (il film): galleggia davanti alla carta
    duration: 20s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 8, elev_from: 68, elev_to: 68 };
    action: date_card { label: 'demo.cartello.storia_einstein.interstellar' };
    action: character_show { target: 'einstein', expression: 'excited', at: left, look: 'gargantua' };
    action: character_show { target: 'gargantua', expression: 'mysterious' };
    action: effect { type: flash, target: 'gargantua', shot_from: 0.03 };
    action: effect { type: glow, target: 'gargantua', color: '#fde68a', duration: 10, shot_from: 0.1 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.24' };
  }
  scene solar_system_3d {
    duration: 11s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 5, elev_from: 68, elev_to: 67 };
    action: character_show { target: 'einstein', expression: 'impressed', at: left, look: 'gargantua' };
    action: character_show { target: 'gargantua', expression: 'playful', look: 'einstein' };
    action: character_animate { target: 'gargantua', animation: spin, times: 2, shot_from: 0.4 };
    action: character_speak { target: 'gargantua', id: 'demo.narr.storia_einstein.25' };
  }
  scene solar_system_3d {
    duration: 17s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 6, elev_from: 67, elev_to: 66 };
    action: character_show { target: 'einstein', expression: 'wistful', at: left, look: 'gargantua' };
    action: character_show { target: 'astro_ben', expression: 'sad', at: bottom, look: 'einstein' };
    action: character_show { target: 'gargantua', expression: 'mysterious' };
    action: effect { type: spacetime, target: 'gargantua', size: 1.4, color: '#fde68a', duration: 20, shot_from: 0.05 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.26' };
  }
  scene solar_system_3d {
    duration: 6s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 4, elev_from: 66, elev_to: 66 };
    action: character_show { target: 'einstein', expression: 'tender', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'wonder', at: bottom };
    action: character_show { target: 'gargantua', expression: 'mysterious' };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.27' };
  }
  scene solar_system_3d {
    duration: 22s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 6, elev_from: 66, elev_to: 64 };
    action: character_show { target: 'einstein', expression: 'laughing', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'laughing', at: bottom };
    action: character_show { target: 'gargantua', expression: 'playful' };
    action: character_expression { target: 'einstein', expression: 'playful', shot_from: 0.6 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.28' };
  }
  scene solar_system_3d {
    duration: 18s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 10, elev_from: 64, elev_to: 61 };
    action: date_card { label: 'demo.cartello.storia_einstein.ligo' };
    action: character_show { target: 'einstein', expression: 'proud', at: left, look: 'sgr_a' };
    action: character_show { target: 'astro_ben', expression: 'impressed', at: right, look: 'einstein' };
    action: character_show { target: 'sgr_a', expression: 'happy' };
    action: effect { type: shockwave, target: 'sgr_a', size: 2, color: '#c4b5fd', shot_from: 0.25 };
    action: effect { type: shockwave, target: 'sgr_a', size: 2.6, color: '#a5b4fc', shot_from: 0.4 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.29' };
  }
  scene solar_system_3d {
    duration: 10s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 6, elev_from: 61, elev_to: 60 };
    action: character_show { target: 'einstein', expression: 'happy', at: left, look: 'sgr_a' };
    action: character_show { target: 'astro_ben', expression: 'laughing', at: right, look: 'sgr_a' };
    action: character_show { target: 'sgr_a', expression: 'proud' };
    action: effect { type: flash, at: center, shot_from: 0.1 };
    action: character_speak { target: 'sgr_a', id: 'demo.narr.storia_einstein.30' };
  }
  scene solar_system_3d {
    // Un saluto di Stephen Hawking: la radiazione dei buchi neri (1974)
    duration: 16s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 8, elev_from: 60, elev_to: 62 };
    action: character_show { target: 'einstein', expression: 'surprised', at: left, look: 'hawking' };
    action: character_show { target: 'hawking', expression: 'playful', at: right, look: 'einstein' };
    action: character_show { target: 'sgr_a', expression: 'surprised', look: 'hawking' };
    action: effect { type: glow, target: 'sgr_a', color: '#a78bfa', duration: 8, shot_from: 0.4 };
    action: character_speak { target: 'hawking', id: 'demo.narr.storia_einstein.31' };
  }
  scene solar_system_3d {
    duration: 9s;
    action: cosmic_scale { from: 'milky_way', to: 'milky_way', orbit: 5, elev_from: 62, elev_to: 63 };
    action: character_show { target: 'einstein', expression: 'laughing', at: left, look: 'hawking' };
    action: character_show { target: 'hawking', expression: 'happy', at: right, look: 'einstein' };
    action: character_show { target: 'sgr_a', expression: 'happy' };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.32' };
  }
  scene solar_system_3d {
    // Il ritorno in un fiato, fino alla Terra che riempie lo schermo
    duration: 9s;
    action: cosmic_scale { from: 'milky_way', to: 'landing', ease: smooth, orbit: -40, elev_from: 63, elev_to: 90 };
    action: character_show { target: 'einstein', expression: 'happy', at: left };
    action: character_show { target: 'astro_ben', expression: 'excited', at: right };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.33' };
  }
  scene transition {
    duration: 9s;
    action: zoom_view { type: geometric, final_target: planetarium_view };
    action: character_show { target: 'einstein', expression: 'tender', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'happy', at: right };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.34' };
  }
  scene planetarium_view {
    // Di nuovo sotto lo stesso cielo, e una risposta da Einstein
    duration: 6s;
    action: set_date { iso: '2026-10-16T18:45:00Z' };
    action: point_view { az: 218, alt: 16 };
    action: zoom_fov { from: 60, to: 48 };
    action: date_card { label: 'demo.cartello.storia_einstein.casa', time: show, place: show };
    action: character_show { target: 'einstein', expression: 'playful', at: left, look: 'astro_ben' };
    action: character_show { target: 'astro_ben', expression: 'curious', at: right, look: 'einstein' };
    action: character_speak { target: 'astro_ben', id: 'demo.narr.storia_einstein.35' };
  }
  scene planetarium_view {
    duration: 8s;
    action: set_fov { degrees: 48 };
    action: point_view { az: 218, alt: 16 };
    action: character_show { target: 'einstein', expression: 'laughing', at: left, look: 'viewer' };
    action: character_show { target: 'astro_ben', expression: 'laughing', at: right, look: 'einstein' };
    action: effect { type: fireworks, at: center, shot_from: 0.2 };
    action: character_animate { target: 'astro_ben', animation: jump, times: 2, shot_from: 0.3 };
    action: character_speak { target: 'einstein', id: 'demo.narr.storia_einstein.36' };
  }
}`
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = predefiniti;
  else radice.AstroDemoPredefiniti = predefiniti;
})(typeof globalThis !== 'undefined' ? globalThis : this);
