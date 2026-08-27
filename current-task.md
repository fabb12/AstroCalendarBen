# Task Corrente

Niente in corso.

## Ultimo intervento completato

Gli aerei ADS-B. Il recupero dei dati era inaffidabile — «a volte li carica, a
volte no» — e il sintomo era il peggiore possibile: un cielo senza triangoli è
identico a un cielo senza aerei, quindi nessuno poteva dire quale dei due
stesse vedendo. Le cause erano tre e sono state tolte tutte e tre: la **fila
indiana** delle porte (adesso corsa con affiancamento, `aerei.js` §3), la
**risposta che arriva e non è una risposta** (un 200 con dentro una pagina
d'errore letto come «zero aerei», §1) e la **memoria assente** su quale feed
funzioni da qui (adesso una pagella salvata, §2).

Con quelli: i **dati** nascono accesi e il **disegno** spento (due
interruttori, non uno), un battito da cinque secondi rinfresca la fotografia
quando invecchia, gli aerei sono colorati per **fascia di distanza** (rosso
entro 10 km, poi arancio, giallo, azzurro) e lo stato dei dati si legge in tre
forme — spia, riga parlante, avviso.

Nel planetario «Visualizzazione» e «Filtri» erano due nomi per la stessa
domanda: adesso sono un pannello solo con quattro schede (Schermo, Oggetti,
Cielo, Paesaggio), e la scheda scelta si ricorda.

Lungo la strada è venuto fuori che in `verifica.html` **dal §26 in giù non
girava niente**: `skyMescolaColore` mancava fra gli stub e l'eccezione, in uno
`<script>` unico, si portava via due sezioni intere. Rimessa a posto insieme a
`sky.luceCielo` e alla penale delle porte che le prove di Overpass si
passavano di mano. Il banco adesso fa 764 prove, tutte passate.

Cache PWA portata ad `astrocal-v205`.
