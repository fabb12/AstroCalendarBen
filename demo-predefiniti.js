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
  // totalità dura 65 secondi. Il racconto va sempre avanti nel tempo: prima
  // l'attesa, poi l'ombra vista dall'alto sulla mappa del cono d'ombra, la
  // falce, la totalità, di nuovo la mappa con l'ombra che corre verso la
  // Spagna, lo spazio, e il ritorno a Reykjavík.
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
    // Sole, Luna e Terra in fila, con il cono d'ombra della Luna.
    duration: 16s;
    action: narrate { id: 'demo.narr.eclisse_tour.8' };
    action: event_window { event: solar_eclipse, from: 42, to: 44 };
    action: camera_3d {
      scene: earth_moon,
      focus: 'Earth-Moon',
      orbit: -35,
      elev_from: 4,
      elev_to: 16,
      zoom_from: 1,
      zoom_to: 1.2
    };
  }

  scene solar_system_3d {
    // Addosso alla Terra: sopra la Spagna, al tramonto, l'ombra scivola oltre il bordo del pianeta.
    duration: 18s;
    action: narrate { id: 'demo.narr.eclisse_tour.9' };
    action: event_window { event: solar_eclipse, from: 44, to: 50 };
    action: camera_3d {
      scene: earth_moon,
      focus: 'Earth',
      orbit: 70,
      elev_from: 16,
      elev_to: 38,
      zoom_from: 1.2,
      zoom_to: 5.5
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
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = predefiniti;
  else radice.AstroDemoPredefiniti = predefiniti;
})(typeof globalThis !== 'undefined' ? globalThis : this);
