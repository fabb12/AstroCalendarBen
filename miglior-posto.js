// =====================================================================
// DOVE VEDERE UN EVENTO
//
// Cerca punti entro un raggio scelto e confronta la linea di vista verso
// l'astro con la forma del terreno. Non promette che una strada sia aperta:
// dà una shortlist astronomica, poi lascia verificare accesso e sicurezza.
// =====================================================================

const POSTO_CAMPIONI_AZ = 12;
const POSTO_ANELLI = [0.35, 0.68, 1];
let postoEvento = null;
let postoMappa = null;
let postoStrati = [];

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
    const u = new URL('https://api.open-meteo.com/v1/elevation');
    u.searchParams.set('latitude', pezzo.map(p => p.lat.toFixed(5)).join(','));
    u.searchParams.set('longitude', pezzo.map(p => p.lon.toFixed(5)).join(','));
    const risposta = await fetch(u.toString());
    if (!risposta.ok) throw new Error('quote del terreno non disponibili');
    const dati = await risposta.json();
    if (!Array.isArray(dati.elevation)) throw new Error('risposta delle quote incompleta');
    quote.push(...dati.elevation);
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

async function postoAnalizza(ev, centro, raggio) {
  const candidati = postoCandidati(centro, raggio);
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
    p.punteggio = p.margine * 8 + Math.min(18, p.quota / 100) - p.distanza * 0.18;
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
      .bindTooltip(`${i + 1}. ${Math.round(p.quota)} m · margine ${p.margine.toFixed(1)}°`).addTo(postoMappa);
    postoStrati.push(m);
    if (!i) {
      const fine = postoDestinazione(p.lat, p.lon, azAstro, Math.min(8, raggio / 2));
      postoStrati.push(L.polyline([[p.lat, p.lon], [fine.lat, fine.lon]], { color: '#fbbf24', dashArray: '6 5' }).addTo(postoMappa));
    }
  });
  postoMappa.fitBounds(L.latLngBounds([[centro.lat, centro.lon], ...risultati.slice(0, 5).map(p => [p.lat, p.lon])]).pad(0.25));
  setTimeout(() => postoMappa.invalidateSize(), 50);
}

function postoMostraRisultati(ev, centro, raggio, risultati) {
  const box = document.getElementById('posto-evento-risultati');
  box.innerHTML = risultati.slice(0, 5).map((p, i) => {
    const esito = p.margine > 5 ? 'Vista libera' : p.margine > 0 ? 'Visibile, margine ridotto' : 'Coperto dal terreno';
    const maps = `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    return `<article class="posto-risultato${i === 0 ? ' migliore' : ''}">
      <span class="posto-numero">${i + 1}</span><div><h3>${i === 0 ? 'Punto consigliato' : 'Alternativa'} · ${Math.round(p.quota)} m</h3>
      <p>${esito}: l'evento sarà a <b>${p.astro.alt.toFixed(1)}°</b>, il terreno arriva a circa <b>${p.cresta.toFixed(1)}°</b>. Distanza in linea d'aria ${p.distanza.toFixed(1)} km.</p>
      <div class="posto-azioni"><a href="${maps}" target="_blank" rel="noopener">Indicazioni stradali</a><button type="button" onclick="postoGuardaDaQui(${p.lat},${p.lon},'${ev.id}')">Planetario da qui</button></div></div>
    </article>`;
  }).join('');
  postoDisegnaMappa(centro, raggio, risultati, risultati[0].astro.az);
}

async function postoAvviaRicerca() {
  const stato = document.getElementById('posto-evento-stato');
  const tasto = document.getElementById('posto-evento-cerca');
  const raggio = Number(document.getElementById('posto-evento-raggio').value);
  const obs = osservatoreCorrente();
  if (!postoEvento || !obs) { stato.textContent = 'Imposta prima la tua posizione nelle Impostazioni.'; return; }
  stato.textContent = `Confronto 37 punti entro ${raggio} km e misuro le creste verso l'evento…`;
  tasto.disabled = true;
  try {
    const centro = { lat: obs.latitude, lon: obs.longitude };
    const risultati = await postoAnalizza(postoEvento, centro, raggio);
    postoMostraRisultati(postoEvento, centro, raggio, risultati);
    stato.textContent = `Ricerca completata: ${risultati.filter(p => p.margine > 0).length} punti hanno l'evento sopra il profilo del terreno.`;
  } catch (e) { stato.textContent = `Non riesco a leggere il terreno: ${e.message}. Riprova quando c'è rete.`; }
  finally { tasto.disabled = false; }
}

window.apriMigliorPosto = id => {
  postoEvento = eventiCalcolati.find(e => e.id === id);
  if (!postoEvento || typeof Astronomy === 'undefined') return;
  document.getElementById('posto-evento-titolo').textContent = `Dove vedere: ${postoEvento.titolo}`;
  document.getElementById('posto-evento-risultati').innerHTML = '';
  document.getElementById('posto-evento-stato').textContent = 'Scegli quanto lontano vuoi cercare, poi avvia il confronto.';
  document.getElementById('modale-posto-evento').classList.remove('hidden');
};

window.postoGuardaDaQui = (lat, lon, id) => {
  document.getElementById('modale-posto-evento').classList.add('hidden');
  if (typeof apriEventoNelPlanetario === 'function') apriEventoNelPlanetario(id);
  setTimeout(() => { if (typeof skyImpostaLuogoVista === 'function') skyImpostaLuogoVista(lat, lon, 'Punto consigliato'); }, 120);
};

document.addEventListener('DOMContentLoaded', () => {
  const r = document.getElementById('posto-evento-raggio');
  r.addEventListener('input', () => { document.getElementById('posto-evento-raggio-testo').textContent = `${r.value} km`; });
  document.getElementById('posto-evento-cerca').addEventListener('click', postoAvviaRicerca);
  document.getElementById('btn-chiudi-posto-evento').addEventListener('click', () => document.getElementById('modale-posto-evento').classList.add('hidden'));
});
