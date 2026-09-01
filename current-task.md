# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Ripristinata l'acqua dei laghi nel Planetario 3D.** Il disegno delle acque
interne ora parte in un contesto canvas proprio, dopo aver chiuso quello del
rilievo: non può più ereditare il ritaglio della sagoma 3D che, soprattutto a
campo largo, lasciava al lago zero pixel disegnabili. L'opacità del paesaggio
viene passata esplicitamente, quindi resta invariata la dissolvenza allo zoom.

Incrementata anche la cache PWA a `astrocal-v244`, così i browser già installati
non mescolano il nuovo `app.js` con i moduli del paesaggio rimasti in cache.

## Intervento precedente

**La Via Lattea ridisegnata** (`via-lattea.js`, nuovo; §30 di
`verifica.html`). La richiesta era «rendila super realistica, bella e
affascinante».

Il pezzo era già una nuvola di milleseicento fiocchi tondi e non più una
riga ripassata, ma chi la Via Lattea l'ha vista da un posto buio la
riconosceva ancora per quello che era: una campitura sfumata con dentro
qualche gobba. Le mancavano tre cose, e sono le tre che si vedono per
prime — la **grana** (quella banda brulica, e una campitura liscia si
legge come vernice per quanto la si sfumi), le **venature di polvere**
coi bordi frastagliati, e **le cose che non sono la banda**: le Nubi di
Magellano, che dall'emisfero sud sono la cosa più bella del cielo e qui
non c'erano affatto, e i grumi di idrogeno acceso.

Adesso: quattro strati di fiocchi (velo, nubi granulose, grani, oggetti),
sorteggiati da un campo di densità **frattale**, stampati con sprite già
granulose — la grana sta dentro all'immagine che si ricopia, quindi a
fotogramma non costa niente. La Fenditura è una spina col bordo mosso dal
rumore invece che una fila di macchie tonde.

### Le tre cose che si sono imparate misurando

1. **Il rumore è timido**, e non si vede leggendo il codice: un fbm a
   quattro ottave sta fra 0,32 e 0,69, cioè modula del dieci per cento. È
   il motivo per cui la prima versione restava liscia. `skyVLStira` lo
   allarga attorno alla media e tosa; quello che esce dai bordi sono i
   vuoti e i grumi.
2. **La densità non va contata due volte.** I fiocchi si pescano già
   dalla densità: dandogli *anche* una luce proporzionale a quella, il
   disegno va come il quadrato — e cinque volte diventano venticinque.
   Era il difetto che rendeva invisibile tutto il tratto dal Cigno a
   Cassiopea, cioè metà della Via Lattea che si vede d'estate.
3. **Il costo non è il numero dei fiocchi, è il numero dei timbri.** Col
   cono della vista (un prodotto scalare al posto di una proiezione
   intera), la proiezione srotolata e i grani che si spengono a campo
   largo, cinquemilaseicento fiocchi costano meno dei milleseicento di
   prima: misurato in un browser senza acceleratore, 3,7 ms a 180° di
   campo contro 3,3, e 8,8 a 55° contro 9,0.

Il profilo della banda lungo il giro è stato tarato contro quello della
fotometria vera (scarto quadratico medio 0,6 ottave, contro 1,4 della
prima stesura).

### Il banco

1052 prove verdi (erano 969). Il §30 è l'unica sezione che carichi il
modulo **per davvero** invece di tenersene una copia, ed è il motivo per
cui il pezzo è uscito da `app.js`: ottocento righe di formule ricopiate
in `verifica.html` sarebbero state la copia peggiore del progetto. La
prova della periodicità ha fatto saltare fuori un difetto latente di
`skyVLDistanza`, che funzionava solo con le longitudini già normalizzate
(il `%` di JavaScript tiene il segno del dividendo).

Da sapere: `scripts/prova-verifica.js` e `scripts/prova-nel-browser.js`
vogliono `CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` se
il percorso di serie non esiste, e `npm install --no-save playwright-core
astronomy-engine`.
