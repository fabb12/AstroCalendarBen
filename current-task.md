# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — montagne stabili durante gli spostamenti GPS

Quando il GPS segnala che il dispositivo è in viaggio, le ricerche Overpass
per i nomi delle montagne vengono accorpate: la cache locale resta immediata,
mentre una sola richiesta di rete parte 12 secondi dopo l'ultimo movimento.
La velocità arriva dal GPS quando disponibile e viene altrimenti stimata fra
due posizioni, così funziona anche nei browser che non espongono `coords.speed`.

Le vette già note vengono riproiettate dalla posizione corrente (nuovi azimut,
distanza e altezza apparente) senza scaricarle di nuovo. Superato il raggio di
validità, le vecchie etichette spariscono finché arrivano i dati del luogo
nuovo: durante un viaggio non restano quindi nomi di montagne del tratto
precedente appoggiati all'orizzonte corrente.

La cache PWA è stata portata ad `astrocal-v128`.
