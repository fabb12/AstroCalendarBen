# Task Corrente

Niente in corso.

## Ultimo intervento completato

**La galleria non interrompe più i video ogni due secondi.** La sincronizzazione
periodica con la cartella ricostruiva tutti i lettori anche quando l'elenco non
era cambiato: revocava i Blob URL, azzerava buffer e posizione e faceva apparire
il filmato perennemente in caricamento.

Adesso `videoRenderGalleria()` calcola una firma stabile dell'elenco (origine,
id, nome, data, dimensione e tipo) e lascia DOM e URL intatti quando la cartella
contiene ancora gli stessi file. Se un video viene aggiunto, modificato o
eliminato, la firma cambia e la galleria continua ad aggiornarsi come prima.

La regressione è coperta da `scripts/prova-galleria.js`: inserisce un filmato
nell'archivio, aspetta oltre l'intervallo di sincronizzazione e verifica che il
lettore sia ancora lo stesso nodo, con lo stesso URL. Nell'ambiente di questo
intervento la prova browser non parte perché `playwright-core` non è installato
e il registry npm risponde 403; i controlli sintattici passano.

`CACHE_NAME` è a `astrocal-v272`.
