/* Tour in DSL: dati puri, condivisi da browser e prove Node. */
(function (radice) {
  'use strict';
  const predefiniti = [
    {
      chiave: 'eclisse_tour',
      testo: `define_demo 'eclisse_tour' {
  // Reykjavik è dentro la fascia di totalità del 12 agosto 2026: primo
  // contatto 16:47, totalità 17:48, ultimo contatto 18:47 (UTC = ora locale).
  scene planetarium_view {
    duration: 5s;
    action: set_location { lat: 64.1466, lon: -21.9426, name: 'Reykjavik', timezone: 'Atlantic/Reykjavik' };
    action: set_date { iso: '2026-08-12T16:40:00Z' };
    action: zoom_fov { from: 40, to: 1.6 };
    action: timelapse { start: 16:40, end: 16:47 };
    action: center_target { target: 'Sun' };
  }
  scene planetarium_view {
    // La Luna entra nel disco del Sole e lo copre: un'ora in dodici secondi.
    duration: 12s;
    action: set_fov { degrees: 1.6 };
    action: timelapse { start: 16:47, end: 17:48 };
    action: center_target { target: 'Sun' };
  }
  scene planetarium_view {
    duration: 5s;
    action: set_fov { degrees: 1.6 };
    action: timelapse { start: 17:48, end: 17:50 };
    action: center_target { target: 'Sun' };
  }
  scene transition {
    duration: 4s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Sole, Luna e Terra in fila: la camera gira per far vedere il cono.
    duration: 8s;
    action: event_window { event: solar_eclipse, from: -40, to: -20 };
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: -35, elev_from: 4, elev_to: 16, zoom_from: 1, zoom_to: 1.2 };
  }
  scene solar_system_3d {
    // Avvicinamento alla Terra: l'ombra della Luna corre sulla superficie.
    duration: 14s;
    action: event_window { event: solar_eclipse, from: -20, to: 45 };
    action: camera_3d { scene: earth_moon, focus: 'Earth', orbit: 70, elev_from: 16, elev_to: 38, zoom_from: 1.2, zoom_to: 5.5 };
  }
  scene planetarium_view {
    // Di nuovo da Reykjavik: la Luna esce dal disco, e il Sole torna intero.
    duration: 10s;
    action: set_fov { degrees: 1.6 };
    action: timelapse { start: 18:10, end: 18:52 };
    action: center_target { target: 'Sun' };
  }
}`
    },
    {
      chiave: 'eclisse_lunare',
      testo: `define_demo 'eclisse_lunare' {
  // Eclisse totale del 31 dicembre 2028 (massimo 16:52 UTC), vista da Sapporo
  // nella notte del 1 gennaio.
  scene planetarium_view {
    duration: 5s;
    action: set_location { lat: 43.0618, lon: 141.3545, name: 'Sapporo', timezone: 'Asia/Tokyo' };
    action: set_date { iso: '2028-12-31T14:40:00Z' };
    action: event_window { event: lunar_eclipse, from: -130, to: -110 };
    action: zoom_fov { from: 40, to: 3 };
    action: center_target { target: 'Moon' };
  }
  scene planetarium_view {
    // La Luna entra nell'ombra della Terra e si fa rossa.
    duration: 14s;
    action: set_fov { degrees: 3 };
    action: event_window { event: lunar_eclipse, from: -110, to: 5 };
    action: center_target { target: 'Moon' };
  }
  scene transition {
    duration: 4s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Da fuori: Sole, Terra e Luna in fila, e il cono d'ombra della Terra.
    duration: 8s;
    action: event_window { event: lunar_eclipse, from: -170, to: -110 };
    action: camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 40, elev_from: 3, elev_to: 18, zoom_from: 0.9, zoom_to: 1 };
  }
  scene solar_system_3d {
    // La Luna attraversa davvero il cono, e la camera le gira attorno.
    duration: 14s;
    action: event_window { event: lunar_eclipse, from: -110, to: 130 };
    action: camera_3d { scene: earth_moon, focus: 'Moon', orbit: 50, elev_from: 18, elev_to: 8, zoom_from: 1.6, zoom_to: 3.2 };
  }
  scene planetarium_view {
    // Di nuovo da Sapporo: la Luna esce dall'ombra.
    duration: 12s;
    action: set_fov { degrees: 3 };
    action: event_window { event: lunar_eclipse, from: 5, to: 170 };
    action: center_target { target: 'Moon' };
  }
}`
    },
    {
      chiave: 'aurora_boreale',
      testo: `define_demo 'aurora_boreale' {
  // Prima il perché, col banco delle aurore della Didattica; poi il cielo di
  // Helsinki con Kp 5 simulato: una simulazione didattica, non una previsione.
  // Helsinki e non Tromsø, di proposito: con Kp 5 a mezzanotte magnetica
  // Tromsø sta sotto l'ovale e l'aurora le passa sopra la testa e a sud; da
  // sessanta gradi di latitudine l'ovale è davvero a nord, alto sull'orizzonte.
  scene didactic_view {
    // Il Sole soffia, e parte una nube: due giorni di viaggio in sette secondi.
    duration: 7s;
    action: aurora_lesson { chapter: vento, from: 0, to: 44, orbit: 20, zoom_from: 1, zoom_to: 1.15 };
  }
  scene didactic_view {
    // La camera gira attorno alla Terra: il vento arriva da un lato solo.
    duration: 7s;
    action: aurora_lesson { chapter: scudo, from: 40, to: 46, orbit: 120, elev_from: 14, elev_to: 32 };
  }
  scene didactic_view {
    // Più vicino: lo scudo magnetico si schiaccia sotto la nube.
    duration: 6s;
    action: aurora_lesson { chapter: scudo, from: 46, to: 50, orbit: 20, zoom_from: 1.2, zoom_to: 2.3 };
  }
  scene didactic_view {
    // La coda si carica e si rompe: la scarica verso i poli.
    duration: 7s;
    action: aurora_lesson { chapter: scarica, from: 45.2, to: 52, orbit: 25, zoom_from: 1, zoom_to: 1.4 };
  }
  scene didactic_view {
    // L'anello attorno al polo, e la Terra che ci gira sotto.
    duration: 7s;
    action: aurora_lesson { chapter: anello, from: 48, to: 56, orbit: 150, elev_from: 40, elev_to: 64, zoom_from: 1, zoom_to: 1.25 };
  }
  scene planetarium_view {
    duration: 7s;
    action: set_location { lat: 60.1699, lon: 24.9384, name: 'Helsinki', timezone: 'Europe/Helsinki' };
    action: set_date { iso: '2027-01-15T19:00:00Z' };
    action: simulate_aurora { kp: 5 };
    action: zoom_fov { from: 60, to: 100 };
    action: point_view { az: 0, alt: 22 };
  }
  scene planetarium_view {
    duration: 12s;
    action: set_fov { degrees: 100 };
    action: timelapse { start: 21:00, end: 23:30 };
    action: point_view { az: 0, alt: 22 };
  }
}`
    },
    {
      chiave: 'allineamento_pianeti',
      testo: `define_demo 'allineamento_pianeti' {
  // Tucson, alba del 21 ottobre 2028: quattro pianeti nel cielo orientale.
  scene planetarium_view {
    duration: 8s;
    action: set_location { lat: 32.2226, lon: -110.9747, name: 'Tucson', timezone: 'America/Phoenix' };
    action: set_date { iso: '2028-10-21T12:45:00Z' };
    action: frame_objects { names: 'Mercury,Venus,Mars,Jupiter' };
    action: highlight_object { name: 'Mercury', scale: 3 };
    action: highlight_object { name: 'Venus', scale: 3 };
    action: highlight_object { name: 'Mars', scale: 3 };
    action: highlight_object { name: 'Jupiter', scale: 3 };
  }
  scene planetarium_view {
    duration: 10s;
    action: timelapse { start: 05:45, end: 06:05 };
    action: frame_objects { names: 'Mercury,Venus,Mars,Jupiter' };
    action: highlight_object { name: 'Mercury', scale: 3 };
    action: highlight_object { name: 'Venus', scale: 3 };
    action: highlight_object { name: 'Mars', scale: 3 };
    action: highlight_object { name: 'Jupiter', scale: 3 };
  }
  scene transition {
    duration: 4s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    // Da sopra il piano, poi di taglio: i pianeti sono su orbite diverse,
    // e la fila in cielo è solo la direzione in cui li vediamo dalla Terra.
    duration: 16s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Mercury,Venus,Earth,Mars,Jupiter', orbit: 70, elev_from: 80, elev_to: 12, zoom_from: 0.9, zoom_to: 1.15 };
  }
  scene planetarium_view {
    duration: 7s;
    action: timelapse { start: 06:05, end: 06:15 };
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
  // dall'app coi dati orbitali aggiornati: prima in cielo, poi da fuori,
  // nello stesso intervallo di tempo.
  scene planetarium_view {
    duration: 16s;
    action: satellite_pass { satellite: iss, before: 1, after: 1 };
  }
  scene transition {
    duration: 4s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    duration: 16s;
    action: satellite_pass { satellite: iss, before: 1, after: 1 };
    action: camera_3d { scene: system, focus: 'ISS', orbit: 80, elev_from: 15, elev_to: 45, zoom_from: 0.8, zoom_to: 1.3 };
  }
}`
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = predefiniti;
  else radice.AstroDemoPredefiniti = predefiniti;
})(typeof globalThis !== 'undefined' ? globalThis : this);
