// =====================================================================
// DOVE VEDERE UN EVENTO
//
// Cerca punti entro un raggio scelto e confronta la linea di vista verso
// l'astro con la forma del terreno. I punti non cadono piu' su una griglia
// astratta: vengono portati sulla strada carrabile pubblica piu' vicina usando
// OpenStreetMap, e quelli senza un accesso verificabile vengono scartati.
// =====================================================================

const POSTO_CAMPIONI_AZ = 12;
const POSTO_ANELLI = [0.35, 0.68, 1];
const POSTO_STRADA_MAX_M = 1200;
let postoEvento = null;
let postoMappa = null;
let postoStrati = [];

// La ricerca parte dal punto dal quale il planetario sta mostrando il cielo.
// Se l'utente ha usato "Vai qua", quel luogo di visita ha la precedenza sulla
// posizione principale dell'app: usare osservatoreCorrente() riportava invece
// la mappa al posto precedente proprio dopo uno spostamento nel planetario.
function postoCentroCorrente() {
  const luogo = typeof skyLuogoDelCielo === 'function' ? skyLuogoDelCielo() : null;
  if (luogo && isFinite(luogo.lat) && isFinite(luogo.lon)) {
    return { lat: Number(luogo.lat), lon: Number(luogo.lon) };
  }
  const obs = typeof osservatoreCorrente === 'function' ? osservatoreCorrente() : null;
  return obs ? { lat: obs.latitude, lon: obs.longitude } : null;
}

function postoDestinazione(lat, lon, az, km) {
  if (typeof terrenoPuntoA === 'function') return terrenoPuntoA(lat, lon, az, km);
  const r = 6371, a = az * Math.PI / 180, f1 = lat * Math.PI / 180;
  const l1 = lon * Math.PI / 180, d = km / r;
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(a));
  const l2 = l1 + Math.atan2(Math.sin(a) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return { lat: f2 * 180 / Math.PI, lon: ((l2 * 180 / Math.PI + 540) % 360) - 180 };
}

function postoPosizioneAstro(ev, punto) {
  const obs = new Astronomy.Observer(punto.lat, punto.lon, Number(punto.quota) || 0);
  if (ev.simul && typeof ev.simul.ra === 'number') return altAzCoordinate(ev.simul.ra, ev.simul.dec, ev.dataObj, obs);
  return altAzCorpoQualunque(ev.corpoCielo, ev.dataObj, obs);
}

async function postoQuote(punti) {
  const quote = [];
  for (let i = 0; i < punti.length; i += 100) {
    const pezzo = punti.slice(i, i + 100);
    // Il modulo del terreno ha gia' una coda che limita le raffiche, riprova
    // gli errori temporanei e passa da Open-Meteo a Open-Elevation e
    // OpenTopoData quando una fonte e' carica. Usare qui una fetch diretta
    // rendeva invece tutta la ricerca dipendente da una sola risposta: un 429
    // di Open-Meteo produceva subito «quote non disponibili», pur avendo due
    // fonti di riserva gia' caricate nell'app.
    if (typeof terrenoQuoteInsistendo !== 'function') {
      throw new Error('servizio delle quote non inizializzato');
    }
    const ricevute = await terrenoQuoteInsistendo(pezzo, 0);
    if (!Array.isArray(ricevute) || ricevute.length !== pezzo.length ||
        ricevute.some(q => typeof q !== 'number' || !isFinite(q))) {
      throw new Error('risposta delle quote incompleta');
    }
    quote.push(...ricevute);
  }
  return quote;
}

function postoCandidati(centro, raggio) {
  const a = [{ lat: centro.lat, lon: centro.lon, distanza: 0 }];
  POSTO_ANELLI.forEach(f => {
    for (let i = 0; i < POSTO_CAMPIONI_AZ; i++) {
      const km = raggio * f, p = postoDestinazione(centro.lat, centro.lon, i * 360 / POSTO_CAMPIONI_AZ, km);
      a.push({ ...p, distanza: km });
    }
  });
  return a;
}

// OpenStreetMap distingue l'accesso legale dal tipo di fondo. Per consigliare
// un punto servono entrambi: una strada privata asfaltata non va bene, e un
// sentiero pubblico non e' una strada raggiungibile in auto.
function postoStradaCarrabile(tags = {}) {
  const vietato = new Set(['private', 'no', 'customers', 'permit']);
  if (vietato.has(tags.access) || vietato.has(tags.vehicle) || vietato.has(tags.motor_vehicle) ||
      tags.ownership === 'private' || tags.service === 'driveway') return false;
  const tipi = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'footway',
    'pedestrian', 'path', 'cycleway', 'steps', 'bridleway', 'corridor', 'construction', 'proposed']);
  if (!tags.highway || tipi.has(tags.highway)) return false;
  if (tags.highway === 'track' && tags.motor_vehicle !== 'yes' &&
      !['paved', 'asphalt', 'concrete', 'compacted', 'fine_gravel'].includes(tags.surface)) return false;
  return true;
}

function postoDistanzaM(a, b) {
  const y = (b.lat - a.lat) * 111320;
  const x = (b.lon - a.lon) * 111320 * Math.cos((a.lat + b.lat) * Math.PI / 360);
  return Math.hypot(x, y);
}

function postoCoordinateValide(p) {
  return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) &&
    Number(p.lat) >= -90 && Number(p.lat) <= 90 &&
    Number(p.lon) >= -180 && Number(p.lon) <= 180;
}

function postoPuntoSuTratto(p, a, b) {
  // `out geom` di Overpass può lasciare un elemento null nella geometria
  // quando uno dei nodi della way non è disponibile. Non è un guasto di rete
  // e non deve interrompere tutta la ricerca tentando di leggere `a.lon`.
  if (!postoCoordinateValide(p) || !postoCoordinateValide(a) || !postoCoordinateValide(b)) return null;
  const k = Math.cos(p.lat * Math.PI / 180);
  const ax = (a.lon - p.lon) * k, ay = a.lat - p.lat;
  const bx = (b.lon - p.lon) * k, by = b.lat - p.lat;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

// URL ufficiale Maps URLs: senza `origin` Google usa la posizione corrente
// del telefono; `travelmode=driving` evita che ricordi l'ultimo mezzo scelto,
// mentre `dir_action=navigate` avvia la navigazione quando il punto di partenza
// è disponibile. La destinazione resta il punto esatto agganciato alla strada,
// nell'ordine richiesto da Google (latitudine, longitudine).
function postoLinkIndicazioni(p) {
  if (!postoCoordinateValide(p)) return null;
  const parametri = new URLSearchParams({
    api: '1',
    destination: `${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`,
    travelmode: 'driving',
    dir_action: 'navigate'
  });
  return `https://www.google.com/maps/dir/?${parametri.toString()}`;
}

async function postoAgganciaAlleStrade(candidati) {
  if (typeof overpassChiedi !== 'function') throw new Error('controllo delle strade non disponibile');
  const clausole = candidati.map(p =>
    `way(around:${POSTO_STRADA_MAX_M},${p.lat.toFixed(5)},${p.lon.toFixed(5)})["highway"];`).join('');
  const query = `[out:json][timeout:35];(${clausole});out tags geom;`;
  const elementi = await (typeof overpassInFila === 'function'
    ? overpassInFila(() => overpassChiedi(query, 45000))
    : overpassChiedi(query, 45000));
  const strade = elementi.filter(e => e && postoStradaCarrabile(e.tags) &&
    Array.isArray(e.geometry) && e.geometry.length > 1);

  return candidati.map(p => {
    let migliore = null, metri = Infinity, strada = null;
    strade.forEach(via => {
      for (let i = 1; i < via.geometry.length; i++) {
        const q = postoPuntoSuTratto(p, via.geometry[i - 1], via.geometry[i]);
        if (!q) continue;
        const d = postoDistanzaM(p, q);
        if (d < metri) { migliore = q; metri = d; strada = via; }
      }
    });
    if (!migliore || metri > POSTO_STRADA_MAX_M) return null;
    return { ...p, lat: migliore.lat, lon: migliore.lon, distanzaStrada: metri,
      strada: strada.tags.name || strada.tags.ref || 'strada pubblica', accessoVerificato: true };
  }).filter(Boolean);
}

async function postoAnalizza(ev, centro, raggio) {
  const candidati = await postoAgganciaAlleStrade(postoCandidati(centro, raggio));
  if (!candidati.length) throw new Error('non trovo strade pubbliche carrabili vicino ai punti esaminati');
  const q0 = await postoQuote(candidati);
  candidati.forEach((p, i) => { p.quota = q0[i]; p.astro = postoPosizioneAstro(ev, p); });

  // Quattro punti lungo lo sguardo bastano a scartare una cresta vicina e
  // una montagna lontana, senza trasformare una ricerca in centinaia di chiamate.
  const distanze = [0.5, 2, 6, 15];
  const raggi = [];
  candidati.forEach(p => distanze.forEach(km => raggi.push(postoDestinazione(p.lat, p.lon, p.astro.az, km))));
  const qr = await postoQuote(raggi);
  candidati.forEach((p, i) => {
    let cresta = -90;
    distanze.forEach((km, j) => {
      const dislivello = qr[i * distanze.length + j] - p.quota;
      cresta = Math.max(cresta, Math.atan2(dislivello, km * 1000) * 180 / Math.PI);
    });
    p.cresta = Math.max(0, cresta);
    p.margine = p.astro.alt - p.cresta;
    // Il margine libero domina; quota e viaggio servono solo a separare
    // punti simili. Una vetta alta dietro l'astro non può vincere perché alta.
    p.punteggio = p.margine * 8 + Math.min(18, p.quota / 100) - p.distanza * 0.18 - p.distanzaStrada / 300;
  });
  return candidati.sort((a, b) => b.punteggio - a.punteggio);
}

function postoDisegnaMappa(centro, raggio, risultati, azAstro) {
  const box = document.getElementById('posto-evento-mappa');
  if (!box || typeof L === 'undefined') { if (box) box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  if (!postoMappa) {
    postoMappa = L.map(box).setView([centro.lat, centro.lon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(postoMappa);
    if (typeof aggiungiControlloTemaMappa === 'function') {
      aggiungiControlloTemaMappa(postoMappa, box);
    }
  }
  postoStrati.forEach(s => postoMappa.removeLayer(s)); postoStrati = [];
  postoStrati.push(L.circle([centro.lat, centro.lon], { radius: raggio * 1000, color: '#60a5fa', fillOpacity: 0.03 }).addTo(postoMappa));
  risultati.slice(0, 5).forEach((p, i) => {
    const colore = p.margine > 5 ? '#34d399' : p.margine > 0 ? '#fbbf24' : '#f87171';
    const m = L.circleMarker([p.lat, p.lon], { radius: i ? 7 : 10, color: '#fff', weight: 2, fillColor: colore, fillOpacity: 0.95 })
      .bindTooltip(`${i + 1}. ${Math.round(p.quota)} m · ${p.strada} · margine ${p.margine.toFixed(1)}°`).addTo(postoMappa);
    postoStrati.push(m);
    if (!i) {
      const fine = postoDestinazione(p.lat, p.lon, azAstro, Math.min(8, raggio / 2));
      postoStrati.push(L.polyline([[p.lat, p.lon], [fine.lat, fine.lon]], { color: '#fbbf24', dashArray: '6 5' }).addTo(postoMappa));
    }
  });
  if (risultati.length) {
    postoMappa.fitBounds(L.latLngBounds([[centro.lat, centro.lon], ...risultati.slice(0, 5).map(p => [p.lat, p.lon])]).pad(0.25));
  } else postoMappa.setView([centro.lat, centro.lon], raggio <= 5 ? 12 : raggio <= 20 ? 10 : 9);
  requestAnimationFrame(() => requestAnimationFrame(() => postoMappa.invalidateSize({ pan: false })));
}

function postoMostraRisultati(ev, centro, raggio, risultati) {
  const box = document.getElementById('posto-evento-risultati');
  box.innerHTML = risultati.slice(0, 5).map((p, i) => {
    const esito = p.margine > 5 ? 'Vista libera' : p.margine > 0 ? 'Visibile, margine ridotto' : 'Coperto dal terreno';
    const nomeStrada = String(p.strada).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
    const maps = postoLinkIndicazioni(p);
    return `<article class="posto-risultato${i === 0 ? ' migliore' : ''}">
      <span class="posto-numero">${i + 1}</span><div><h3>${i === 0 ? 'Punto consigliato' : 'Alternativa'} · ${Math.round(p.quota)} m</h3>
      <p>${esito}: l'evento sarà a <b>${p.astro.alt.toFixed(1)}°</b>, il terreno arriva a circa <b>${p.cresta.toFixed(1)}°</b>. Distanza in linea d'aria ${p.distanza.toFixed(1)} km. Punto su <b>${nomeStrada}</b>, indicata da OpenStreetMap come carrabile e senza divieti di accesso privato.</p>
      <div class="posto-azioni"><a href="${maps}" target="_blank" rel="noopener">Indicazioni stradali con Google Maps</a><button type="button" onclick="postoGuardaDaQui(${p.lat},${p.lon},'${ev.id}')">Planetario da qui</button></div></div>
    </article>`;
  }).join('');
  postoDisegnaMappa(centro, raggio, risultati, risultati[0].astro.az);
}

async function postoAvviaRicerca() {
  const stato = document.getElementById('posto-evento-stato');
  const tasto = document.getElementById('posto-evento-cerca');
  const raggio = Number(document.getElementById('posto-evento-raggio').value);
  const centro = postoCentroCorrente();
  if (!postoEvento || !centro) { stato.textContent = 'Imposta prima la tua posizione nelle Impostazioni.'; return; }
  stato.textContent = `Cerco strade pubbliche carrabili, poi confronto il terreno entro ${raggio} km…`;
  tasto.disabled = true;
  try {
    const risultati = await postoAnalizza(postoEvento, centro, raggio);
    postoMostraRisultati(postoEvento, centro, raggio, risultati);
    stato.textContent = `Ricerca completata: ${risultati.filter(p => p.margine > 0).length} punti accessibili hanno l'evento sopra il profilo del terreno.`;
  } catch (e) { stato.textContent = `Non riesco a completare la ricerca: ${e.message}. Riprova quando c'è rete.`; }
  finally { tasto.disabled = false; }
}

window.apriMigliorPosto = id => {
  postoEvento = eventiCalcolati.find(e => e.id === id);
  if (!postoEvento || typeof Astronomy === 'undefined') return;
  document.getElementById('posto-evento-titolo').textContent = `Dove vedere: ${postoEvento.titolo}`;
  document.getElementById('posto-evento-risultati').innerHTML = '';
  document.getElementById('posto-evento-stato').textContent = 'Scegli quanto lontano vuoi cercare, poi avvia il confronto.';
  document.getElementById('modale-posto-evento').classList.remove('hidden');
  const centro = postoCentroCorrente();
  if (centro) postoDisegnaMappa(centro,
    Number(document.getElementById('posto-evento-raggio').value), [], 0);
};

window.postoGuardaDaQui = (lat, lon, id) => {
  document.getElementById('modale-posto-evento').classList.add('hidden');
  if (typeof apriEventoNelPlanetario === 'function') apriEventoNelPlanetario(id);
  setTimeout(() => { if (typeof skyImpostaLuogoVista === 'function') skyImpostaLuogoVista(lat, lon, 'Punto consigliato'); }, 120);
};

document.addEventListener('DOMContentLoaded', () => {
  const r = document.getElementById('posto-evento-raggio');
  r.addEventListener('input', () => {
    document.getElementById('posto-evento-raggio-testo').textContent = `${r.value} km`;
    const centro = postoCentroCorrente();
    if (postoMappa && centro) postoDisegnaMappa(centro, Number(r.value), [], 0);
  });
  document.getElementById('posto-evento-cerca').addEventListener('click', postoAvviaRicerca);
  document.getElementById('btn-chiudi-posto-evento').addEventListener('click', () => document.getElementById('modale-posto-evento').classList.add('hidden'));
});
