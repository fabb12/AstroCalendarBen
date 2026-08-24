// Aerei nel Planetario — dati ADS-B in tempo reale.
//
// Il provider e tutto il trasporto stanno in AEREI_PROVIDER: per passare a un
// altro servizio basta sostituire questo oggetto prima di caricare il file.
// Disegno, geometria, cache e interfaccia non conoscono il formato OpenSky.
(function () {
  'use strict';

  const CACHE_MS = 10000;
  const INTERVALLO_MS = 15000;
  const ERRORE_ATTESA_MS = 60000;
  const PREVISIONE_MINUTI = 5;
  const SOGLIA_ALLINEAMENTO = 1;
  const TERRA_KM = 6371;

  const providerPredefinito = {
    nome: 'OpenSky Network',
    url(posizione, raggioKm) {
      const dLat = raggioKm / 111.32;
      const dLon = raggioKm / (111.32 * Math.max(.15, Math.cos(posizione.lat * Math.PI / 180)));
      const q = new URLSearchParams({
        lamin: (posizione.lat - dLat).toFixed(4), lamax: (posizione.lat + dLat).toFixed(4),
        lomin: (posizione.lon - dLon).toFixed(4), lomax: (posizione.lon + dLon).toFixed(4)
      });
      return `https://opensky-network.org/api/states/all?${q}`;
    },
    interpreta(risposta) {
      return (risposta.states || []).map(s => ({
        id: s[0], callsign: (s[1] || '').trim() || s[0].toUpperCase(),
        lon: s[5], lat: s[6], quotaM: s[7], aTerra: !!s[8],
        velocitaMs: s[9], direzione: s[10], salitaMs: s[11], ultimaLettura: s[4]
      })).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
    }
  };

  const stato = { aerei: [], timer: null, richiesta: null, controller: null, ultimoCentro: null,
    ultimoSuccesso: 0, prossimoTentativo: 0, errore: '', avviato: false, ricaricaDopo: false };

  function raggioKm() {
    return typeof raggioAerei === 'function' ? raggioAerei() : 100;
  }

  function radianti(g) { return g * Math.PI / 180; }
  function gradi(r) { return r * 180 / Math.PI; }
  function limita180(g) { return ((g + 540) % 360) - 180; }

  function distanzaDirezione(a, b) {
    const p1 = radianti(a.lat), p2 = radianti(b.lat);
    const dl = radianti(b.lon - a.lon);
    const x = Math.sin(dl) * Math.cos(p2);
    const y = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    const angolo = Math.atan2(Math.sqrt(x * x + y * y),
      Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl));
    return { km: TERRA_KM * angolo, az: (gradi(Math.atan2(x, y)) + 360) % 360 };
  }

  function posizioneFutura(aereo, secondi) {
    const distanza = Math.max(0, aereo.velocitaMs || 0) * secondi / 1000 / TERRA_KM;
    const rotta = radianti(Number.isFinite(aereo.direzione) ? aereo.direzione : 0);
    const lat1 = radianti(aereo.lat), lon1 = radianti(aereo.lon);
    const lat = Math.asin(Math.sin(lat1) * Math.cos(distanza) +
      Math.cos(lat1) * Math.sin(distanza) * Math.cos(rotta));
    const lon = lon1 + Math.atan2(Math.sin(rotta) * Math.sin(distanza) * Math.cos(lat1),
      Math.cos(distanza) - Math.sin(lat1) * Math.sin(lat));
    return { ...aereo, lat: gradi(lat), lon: limita180(gradi(lon)),
      quotaM: Math.max(0, (aereo.quotaM || 0) + (aereo.salitaMs || 0) * secondi) };
  }

  function coordinateCielo(aereo, osservatore) {
    const d = distanzaDirezione(osservatore, aereo);
    const quotaOsservatore = osservatore.quotaM || 0;
    const alt = gradi(Math.atan2((aereo.quotaM || 0) - quotaOsservatore,
      Math.max(.02, d.km * 1000))) - gradi(d.km / (2 * TERRA_KM));
    return { az: d.az, alt, distanzaKm: d.km };
  }

  function separazione(a, b) {
    const aa = radianti(a.alt), ab = radianti(b.alt);
    const cos = Math.sin(aa) * Math.sin(ab) + Math.cos(aa) * Math.cos(ab) *
      Math.cos(radianti(a.az - b.az));
    return gradi(Math.acos(Math.max(-1, Math.min(1, cos))));
  }

  function osservatore() {
    const p = typeof sky !== 'undefined' && sky.posizione;
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
    return { lat: p.lat, lon: p.lon, quotaM: p.altitudine || p.quota || 0 };
  }

  function arricchisci(aerei, obs) {
    return aerei.map(a => {
      const cielo = coordinateCielo(a, obs);
      const traiettoria = [];
      for (let minuti = 0; minuti <= PREVISIONE_MINUTI; minuti++) {
        const futuro = posizioneFutura(a, minuti * 60);
        traiettoria.push({ minuti, ...coordinateCielo(futuro, obs) });
      }
      return { ...a, ...cielo, traiettoria, allineamenti: [] };
    }).filter(a => a.distanzaKm <= raggioKm()).sort((a, b) => a.distanzaKm - b.distanzaKm);
  }

  function aggiornaAllineamenti() {
    if (typeof sky === 'undefined') return;
    const astri = (sky.oggetti || []).filter(o =>
      ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].includes(o.id));
    stato.aerei.forEach(a => {
      a.allineamenti = [];
      a.traiettoria.forEach(p => astri.forEach(astro => {
        const scarto = separazione(p, astro);
        if (scarto <= SOGLIA_ALLINEAMENTO) a.allineamenti.push({ nome: astro.nome || astro.id, minuti: p.minuti, scarto });
      }));
    });
  }

  function testoStato(testo, errore) {
    const el = document.getElementById('aerei-stato');
    if (el) { el.textContent = testo; el.dataset.errore = errore ? 'true' : 'false'; }
  }

  function render() {
    aggiornaAllineamenti();
    const box = document.getElementById('aerei-elenco');
    if (!box) return;
    if (!stato.aerei.length) { box.innerHTML = '<p class="etichetta-comando">Nessun aereo ADS-B rilevato nel raggio scelto.</p>'; return; }
    box.innerHTML = stato.aerei.map(a => {
      const all = a.allineamenti[0];
      return `<article class="aereo-riga"><strong>${sicuro(a.callsign)}</strong>` +
        `<p class="aereo-dati">${Math.round(a.quotaM || 0).toLocaleString('it-IT')} m · ` +
        `${Math.round((a.velocitaMs || 0) * 3.6)} km/h · ${Math.round(a.direzione || 0)}° · ` +
        `${a.distanzaKm.toFixed(1)} km</p>` +
        (all ? `<p class="aereo-allineamento">Possibile allineamento con ${sicuro(all.nome)} ` +
          `${all.minuti ? `fra ${all.minuti} min` : 'adesso'} (${all.scarto.toFixed(1)}°)</p>` : '') + '</article>';
    }).join('');
  }

  function sicuro(s) { const e = document.createElement('span'); e.textContent = String(s); return e.innerHTML; }

  async function carica(forza) {
    const obs = osservatore();
    if (!obs) { testoStato('Serve una posizione per cercare gli aerei.', true); return; }
    const ora = Date.now();
    if (!forza && (ora < stato.prossimoTentativo || ora - stato.ultimoSuccesso < CACHE_MS)) return;
    if (stato.richiesta) return stato.richiesta;
    testoStato('Aggiornamento ADS-B…');
    const provider = window.AEREI_PROVIDER || providerPredefinito;
    const controller = new AbortController();
    stato.controller = controller;
    const sveglia = setTimeout(() => controller.abort(), 10000);
    stato.richiesta = fetch(provider.url(obs, raggioKm()), { signal: controller.signal, cache: 'no-store' })
      .then(r => {
        if (r.status === 429) { const e = new Error('limite di richieste raggiunto'); e.rateLimit = true; throw e; }
        if (!r.ok) throw new Error(`risposta ${r.status}`);
        return r.json();
      }).then(dati => {
        stato.aerei = arricchisci(provider.interpreta(dati), obs);
        stato.ultimoCentro = obs; stato.ultimoSuccesso = Date.now(); stato.prossimoTentativo = 0; stato.errore = '';
        testoStato(`${stato.aerei.length} aerei · ${provider.nome} · aggiornato adesso`); render();
      }).catch(e => {
        if (e.name === 'AbortError' && stato.ricaricaDopo) return;
        stato.errore = e.message; stato.prossimoTentativo = Date.now() + ERRORE_ATTESA_MS;
        testoStato(`Dati ADS-B non disponibili (${e.name === 'AbortError' ? 'tempo scaduto' : e.message}). Riprovo fra un minuto.`, true);
      }).finally(() => {
        clearTimeout(sveglia); stato.richiesta = null; stato.controller = null;
        if (stato.ricaricaDopo) { stato.ricaricaDopo = false; carica(true); }
      });
    return stato.richiesta;
  }

  function aereiDisegna(ctx, base, focale) {
    if (!stato.aerei.length || typeof skyProietta !== 'function') return;
    aggiornaAllineamenti();
    ctx.save();
    stato.aerei.forEach(a => {
      const punti = a.traiettoria.map(t => skyProietta(skyVettore(t.az, t.alt), base, focale)).filter(p => p.davanti);
      if (!punti.length) return;
      ctx.strokeStyle = 'rgba(125,211,252,.72)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); punti.forEach((p, i) => i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)); ctx.stroke();
      const p = punti[0]; ctx.setLineDash([]); ctx.fillStyle = a.allineamenti.length ? '#fbbf24' : '#7dd3fc';
      ctx.beginPath(); ctx.moveTo(p.px, p.py - 7); ctx.lineTo(p.px + 6, p.py + 5); ctx.lineTo(p.px, p.py + 2); ctx.lineTo(p.px - 6, p.py + 5); ctx.closePath(); ctx.fill();
      ctx.font = '600 11px system-ui'; ctx.fillText(a.callsign, p.px + 9, p.py + 4);
    });
    ctx.restore();
  }

  function aereiAvvia() {
    if (stato.avviato) return;
    stato.avviato = true; carica(false);
    stato.timer = setInterval(() => { if (typeof sky !== 'undefined' && sky.aperto) carica(false); }, INTERVALLO_MS);
  }
  function aereiFerma() { clearInterval(stato.timer); stato.timer = null; stato.avviato = false; }

  // Il raggio delle Impostazioni cambia sia il rettangolo chiesto al provider
  // sia il filtro finale. La vecchia risposta non è quindi riutilizzabile.
  function aereiRaggioCambiato() {
    if (stato.controller) { stato.ricaricaDopo = stato.avviato; stato.controller.abort(); }
    stato.aerei = [];
    stato.ultimoSuccesso = 0;
    stato.prossimoTentativo = 0;
    render();
    if (stato.avviato && !stato.richiesta) carica(true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const aggiorna = document.getElementById('aerei-aggiorna');
    if (aggiorna) aggiorna.addEventListener('click', () => carica(true));
    const linguetta = document.querySelector('[data-vai-gruppo="aerei"]');
    if (linguetta) linguetta.addEventListener('click', () => { aereiAvvia(); render(); });
  });

  window.aereiAvvia = aereiAvvia;
  window.aereiFerma = aereiFerma;
  window.aereiDisegna = aereiDisegna;
  window.aereiRaggioCambiato = aereiRaggioCambiato;
  window.AereiADS_B = { distanzaDirezione, posizioneFutura, coordinateCielo, separazione, arricchisci, stato };
}());
