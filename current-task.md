# Niente in corso

Ultimo lavoro chiuso: **il terreno a campo largo, i gradoni e il budget del
fotogramma** — quattro segnalazioni che si sono rivelate quattro difetti
diversi, tutti nel disegno del rilievo.

Il banco di prova usato è nello scratchpad della sessione e non nel
repository: un Chromium vero con le tessere del rilievo e le quote generate
da una funzione (una cima a 2.511 m con le catene attorno, e una pianura),
così il paesaggio è noto e ripetibile. Tutti i numeri qui sotto vengono da
lì, letti sui pixel della tela.

**(1) La banda scura all'orizzonte** (`app.js`, `skyAriaSottoOrizzonte`). Da
una cima, fra la riga dell'orizzonte e il crinale restava un nastro verde
scuro: cielo (190, 215, 238), banda (61, 69, 57). Non era un colore
sbagliato: era che tutto ciò che sta sotto la riga veniva dipinto col
gradiente del suolo, scritto sulla legge «un grado sotto l'orizzonte è a
novanta metri» — falsa di tre ordini di grandezza da lassù. Sotto la riga,
da una cima, ci sono l'aria oltre il bordo del pianeta e la terra a cento
chilometri: tutt'e due sono il colore del cielo all'orizzonte.

**(2) Il rilievo a campo largo** (`rilievo.js`, `tracciaFetta` e
`rilTracciaSagoma`). Sopra i 125° il dettaglio era spento per non far
incrociare i poligoni delle fette. Adesso ogni fetta è una striscia spezzata
**dove il quadrilatero fra due colonne cambia verso**, quindi non si può
incrociare, e lo spegnimento è sparito. Strada provata e scartata: un
quadrilatero per colonna — corretta e quattro volte più cara, perché il
costo di un `fill()` sta nei sottotracciati e non nei vertici.

**(3) I gradoni** (`rilievo.js`, `rilRampaDelleQuote` e `rilLiscia`). Due
cause: le fasce di quota campionate a passo costante **di quota** su una
rampa che non è uniforme (il tratto roccia-neve vale metà della rampa in un
tredicesimo dell'asse: cinquanta livelli per gradino), e la griglia grossa
letta con una bilineare, che dentro a una cella ha pendenza costante e sul
bordo salta — e il chiaroscuro è una derivata. Adesso passo costante **di
colore** e curva a S. In più la scala delle larghezze, che cominciava
dall'uno e raddoppiava l'opacità sul confine fra due classi: trenta livelli
di filo chiaro verticale.

**(4) Il budget del fotogramma** (`rilievo.js`, `rilAggiornaBudget`). Si
misura quello che il disegno è costato e si diradano colonne, gradini della
scala e fasce di quota. Il costo vero sono le **chiamate di disegno**, non la
geometria. Con la CPU a un sesto: da trenta-quarantacinque millisecondi a
quattro-sei.

`node scripts/prova-verifica.js` — 1.262 verdi, 4 rosse, e sono le stesse
quattro che erano rosse prima (tre sull'acqua rasente, una sulla camera che
insegue). `node scripts/prova-abitati.js` — 56 su 56.
`node scripts/prova-nel-browser.js` dà le stesse quattro rosse di prima (due
sull'Esc, una sulla scheda dell'aereo, e i dodici fotogrammi al secondo che
in questo contenitore si misurano senza acceleratore grafico).
