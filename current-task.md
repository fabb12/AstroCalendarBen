# Niente in corso

Ultimo lavoro chiuso: riserve di rete per quote, meteo e traffico ADS-B (v361).

- Quote: fallback Terrarium a zoom 9, tre richieste simultanee, cache e pausa sui guasti.
- Meteo: pausa condivisa e persistente per host, Retry-After, deduplicazione,
  timeout e recupero delle nuvole salvate della stessa località.
- ADS-B: niente tentativi diretti senza CORS; proxy e ponti esistenti,
  saltando i servizi ancora in penale.
- Versione e data aggiornate in config.js e sw.js.
- Prove: node scripts/prova-riserve-rete.js; controllo sintassi dei file modificati.

Limite: le riserve dipendono comunque dalla rete; senza dati salvati e con
ogni fonte irraggiungibile si mostra indisponibilità. Non vengono inventate
previsioni o posizioni. Il banner PWA è gestito dal pulsante Installa.
