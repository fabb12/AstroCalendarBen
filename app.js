const eventiAstro = [
  {
    id: "eclissi-tot-2026",
    titolo: "Eclissi Solare Totale",
    data: "12 Agosto 2026 - 17:30",
    visibilita: "Spagna, Islanda, Nord Italia (parziale)",
    spiegazione: "La Luna si allinea perfettamente tra la Terra e il Sole, oscurando il disco solare e rivelando la corona.",
    programma: {
      cosaPortare: "Occhialini certificati ISO 12312-2, treppiede, giacca a vento.",
      doveVederlo: "Luogo elevato, lontano dall'inquinamento luminoso.",
      comeVederlo: "Usa sempre i filtri solari prima della fase di totalità."
    }
  },
  {
    id: "perseidi-2026",
    titolo: "Sciame Meteorico delle Perseidi",
    data: "12-13 Agosto 2026 - Notte",
    visibilita: "Emisfero Nord (Ottima visibilità)",
    spiegazione: "La Terra attraversa i detriti lasciati dalla cometa Swift-Tuttle, creando spettacolari 'stelle cadenti'.",
    programma: {
      cosaPortare: "Sdraio, coperta pesante, thermos con bevanda calda.",
      doveVederlo: "Montagna o campagna, lontano dalle luci cittadine.",
      comeVederlo: "Sdraiati a pancia in su, guarda verso Nord-Est e aspetta che gli occhi si abituino al buio (15 min)."
    }
  }
];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registrato!', reg))
      .catch(err => console.error('Errore Service Worker:', err));
  });
}

const container = document.getElementById('eventi-container');

eventiAstro.forEach(evento => {
  const card = document.createElement('article');
  card.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 card-hover";
  card.innerHTML = `
    <div class="flex justify-between items-start mb-4">
      <div>
        <h2 class="text-2xl font-bold text-white">${evento.titolo}</h2>
        <p class="text-blue-400 text-sm font-semibold mt-1">📅 ${evento.data}</p>
      </div>
      <button onclick="leggiEvento('${evento.id}')" class="p-3 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors" title="Ascolta le info">
        🔊
      </button>
    </div>
    
    <div class="space-y-3 text-slate-300">
      <p><strong>🌍 Visibilità:</strong> ${evento.visibilita}</p>
      <p><strong>✨ Cosa succede:</strong> ${evento.spiegazione}</p>
      
      <div class="bg-slate-900 p-4 rounded-xl mt-4 text-sm border border-slate-700">
        <h3 class="font-bold text-white mb-2">🎒 Programma di Osservazione</h3>
        <ul class="space-y-2">
          <li><span class="text-blue-400">Cosa portare:</span> ${evento.programma.cosaPortare}</li>
          <li><span class="text-blue-400">Dove:</span> ${evento.programma.doveVederlo}</li>
          <li><span class="text-blue-400">Come:</span> ${evento.programma.comeVederlo}</li>
        </ul>
      </div>
    </div>
  `;
  container.appendChild(card);
});

window.leggiEvento = (id) => {
  const evento = eventiAstro.find(e => e.id === id);
  if (!evento) return;

  window.speechSynthesis.cancel();
  
  const testo = `
    Evento: ${evento.titolo}. 
    Data: ${evento.data}.
    Spiegazione: ${evento.spiegazione}. 
    Programma. 
    Cosa portare: ${evento.programma.cosaPortare}. 
    Dove vederlo: ${evento.programma.doveVederlo}. 
    Come vederlo: ${evento.programma.comeVederlo}.
  `;

  const sintesi = new SpeechSynthesisUtterance(testo);
  sintesi.lang = 'it-IT';
  sintesi.rate = 0.9;
  
  window.speechSynthesis.speak(sintesi);
};

document.getElementById('btn-notifiche').addEventListener('click', async () => {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    new Notification('AstroCal Pronto!', {
      body: 'Riceverai avvisi per i prossimi eventi celesti.',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/512px-NASA_logo.svg.png'
    });
  } else {
    alert("Permesso per le notifiche negato.");
  }
});
