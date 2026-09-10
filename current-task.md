# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 352 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

Resta rossa, ed era rossa anche prima, una prova di `scripts/prova-i18n.js`:
undici chiavi orfane (`visione.*`, `ui.fotocamera`, `ui.vai-al-mese` e altre
due), tutte fuori da Missione Cielo.

## Ultimo intervento completato

**Missione Cielo: tre gradini di difficoltà, un repertorio di ottanta
bersagli, enigmi scritti per l'oggetto e un aneddoto come premio.**

I gradini erano due (adulti / bambini) e adesso sono tre — `bambini`,
`curiosi`, `sfida` — e non sono tre etichette sullo stesso comportamento:
cambiano insieme **cosa** si va a cercare (tetto della difficoltà 2, 3, 5) e
**quanto viene detto prima di cercarlo** (`MISS_GENEROSITA`: ai bambini
enigma, segno e direzione; ai curiosi enigma e segno; agli esperti il solo
enigma, e il segno arriva col primo indizio). Chi aveva salvato una delle
vecchie modalità finisce nel gradino di mezzo.

Il **repertorio** (§1-bis di `missione-cielo.js`) è la tabella degli ottanta
bersagli che hanno un nome proprio: la Luna e i sette pianeti, le otto stelle
del planetario, le ventitré figure che disegna, quaranta oggetti profondi e le
stazioni. Da ogni voce escono lo **slug** del dizionario, il **fascino** (che
entra nel punteggio accanto ad altezza e difficoltà) e la **catena di ripiego**
— nome proprio → specie di catalogo → famiglia — per cui anche la
centoquarantesima galassia senza nome ha qualcosa di vero da dire.

I testi: ottanta enigmi scritti per l'oggetto, cinque per la specie, quindici
per la famiglia, quarantacinque versioni per i bambini, ottantacinque segni
osservabili e centoquaranta aneddoti nuovi, in italiano e in inglese.
Trovato il bersaglio, la scoperta dà la specie, un **numero vero** (in che anno
è partita quella luce, quante Lune piene ci starebbero dentro, quanti minuti di
luce ci separano da quel pianeta — tutti calcolati, nessuno scritto a mano) e
un aneddoto, con «raccontamene un'altra» quando ce n'è più di uno.
L'anteprima non svela più i nomi: dice ora, genere e difficoltà, e chi vuole
sbirciare ha il suo tasto.

Lo stato passa alla versione 7 e la cache PWA a `astrocal-v293`.

**Prove.** `scripts/prova-missione.js` è a **110 verdi su 110** (77 motore + 33
browser), comprese le sezioni nuove sui tre gradini, sul repertorio e sul
confronto fra gli ottanta slug e i due dizionari. Verdi anche
`prova-missione-stati.js`, `prova-missione-interattiva.js`, `prova-lingua.js`,
il patto i18n (352 ≤ 362) e il controllo delle collisioni.

Rimettendo in piedi i tre banchi sono venute fuori quattro prove **stantie**,
tutte rosse da prima di questo lavoro: due cercavano `.missione-striscia-guida`
(che nel markup si chiama `.missione-striscia-indizio` — e nel foglio di stile
erano rimaste tre regole per quella classe, che è quello che rendeva la cosa
credibile), una faceva `Object.assign({id:'Star2'}, tappa)` e si riprendeva
l'`id` del bersaglio, una cliccava un tasto «rivela» che nessuna striscia ha
mai disegnato. Il comando morto e la sua voce di dizionario sono andati via col
resto.
