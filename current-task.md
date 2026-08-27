# Task Corrente

Niente in corso.

## Ultimo intervento completato

Le nuvole del planetario hanno ora volumi interni morbidi racchiusi in una
sagoma continua, con zone dense e fredde e gobbe illuminate che danno
profondità senza tornare all'effetto «fila di batuffoli». La direzione del
riflesso è calcolata dalla posizione reale del Sole nel planetario: il lato
esposto si accende, quello opposto resta in ombra e al tramonto la luce assume
una tinta appena dorata. La forma resta deterministica e non trema fra i frame.
Gradienti e sfocature vengono rasterizzati una sola volta in sprite riutilizzabili:
nei frame successivi ciascun banco richiede una sola `drawImage`. Raggio e luce
sono quantizzati e la cache è limitata a 64 elementi e circa 32 MB, così CPU e
memoria restano prevedibili anche sui telefoni e durante lunghi spostamenti nel planetario. Per
evitare scatti all'apertura vengono creati al massimo due sprite per frame; nel
frattempo i banchi non ancora pronti usano una sagoma semplificata e leggera.

Cache PWA portata ad `astrocal-v209`.
