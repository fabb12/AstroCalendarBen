# Task Corrente

Niente in corso.

## Ultimo intervento completato

Le richieste ADS-B non vanno più direttamente a OpenSky, che autorizza via CORS
soltanto la propria origine e veniva quindi sempre bloccato su GitHub Pages.
L'app prova in sequenza due reti ADS-B tramite due ponti CORS indipendenti,
mantenendo l'intervallo di cinque minuti e la possibilità di configurare un
proxy proprio. Rimossa inoltre l'istanza Overpass `overpass.osm.jp`, il cui
certificato non è valido per quel nome host, e portata la cache PWA a
`astrocal-v160`.
