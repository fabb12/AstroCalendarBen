/* Tour in DSL: dati puri, condivisi da browser e prove Node. */
(function (radice) {
  'use strict';
  const predefiniti = [
    {
      chiave: 'eclisse_tour',
      testo: `define_demo 'eclisse_tour' {
  scene planetarium_view {
    duration: 10s;
    action: timelapse { start: 18:00, end: 22:00 };
    action: highlight_object { name: 'Venus', scale: 5.0 };
    action: center_target { target: 'Venus' };
  }
  scene transition {
    duration: 5s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    duration: 15s;
    action: orbit_object { object: 'Earth-Moon', angle: 360, speed: slow };
    action: center { target: 'Eclipse Shadow' };
  }
}`
    },
    {
      chiave: 'eclisse_lunare',
      testo: `define_demo 'eclisse_lunare' {
  // Eclisse totale del 31 dicembre 2028, vista da Sapporo all'alba del 1 gennaio.
  scene planetarium_view {
    duration: 8s;
    action: set_location { lat: 43.0618, lon: 141.3545, name: 'Sapporo', timezone: 'Asia/Tokyo' };
    action: set_date { iso: '2028-12-31T15:45:00Z' };
    action: center_target { target: 'Moon' };
  }
  scene planetarium_view {
    duration: 16s;
    action: timelapse { start: 00:45, end: 03:00 };
    action: center_target { target: 'Moon' };
  }
}`
    },
    {
      chiave: 'aurora_boreale',
      testo: `define_demo 'aurora_boreale' {
  // Notte polare a Tromsø: Kp 5 è una simulazione, non una previsione.
  scene planetarium_view {
    duration: 8s;
    action: set_location { lat: 69.6492, lon: 18.9553, name: 'Tromsø', timezone: 'Europe/Oslo' };
    action: set_date { iso: '2027-01-15T20:00:00Z' };
    action: simulate_aurora { kp: 5 };
    action: point_view { az: 0, alt: 25 };
  }
  scene planetarium_view {
    duration: 12s;
    action: timelapse { start: 21:00, end: 23:30 };
    action: point_view { az: 0, alt: 25 };
  }
}`
    },
    {
      chiave: 'allineamento_pianeti',
      testo: `define_demo 'allineamento_pianeti' {
  // Tucson, alba del 21 ottobre 2028: quattro pianeti nel cielo a est.
  scene planetarium_view {
    duration: 8s;
    action: set_location { lat: 32.2226, lon: -110.9747, name: 'Tucson', timezone: 'America/Phoenix' };
    action: set_date { iso: '2028-10-21T12:45:00Z' };
    action: point_view { az: 102, alt: 29 };
    action: highlight_object { name: 'Mercury', scale: 3 };
    action: highlight_object { name: 'Venus', scale: 3 };
    action: highlight_object { name: 'Mars', scale: 3 };
    action: highlight_object { name: 'Jupiter', scale: 3 };
  }
  scene planetarium_view {
    duration: 14s;
    action: timelapse { start: 05:45, end: 06:10 };
    action: point_view { az: 102, alt: 29 };
    action: highlight_object { name: 'Mercury', scale: 3 };
    action: highlight_object { name: 'Venus', scale: 3 };
    action: highlight_object { name: 'Mars', scale: 3 };
    action: highlight_object { name: 'Jupiter', scale: 3 };
  }
}`
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = predefiniti;
  else radice.AstroDemoPredefiniti = predefiniti;
})(typeof globalThis !== 'undefined' ? globalThis : this);
