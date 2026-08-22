# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — la vista 3D: i comandi che sparivano, e le viste senza nome

Branch `claude/solar-system-3d-interface-cnjipg`. Tre segnalazioni, un difetto
grosso e due di leggibilità.

### 1. «Il tasto impostazioni non funziona» e «non vedo le viste»

Erano la stessa cosa, e non era il tasto: era il **pannello dell'orologio**.
`.sol-pannello-tempo` stava appeso in cima alla scena, largo da un bordo
all'altro e alto tre quarti di riquadro (`top: 10px`, `max-height: calc(100% -
86px)`). Aperto — e ci si apre toccando la data, che è la cosa più naturale da
fare — copriva **per intero** le due colonne di comandi: le tre viste a
sinistra e i cinque tondi a destra, ⚙ compreso. Misurato con `elementFromPoint`
nel browser vero: al centro del ⚙ rispondeva `skymap-data-vai`, cioè il tasto
**Vai** del campo della data. Uno tocca il ⚙, non succede niente di quello che
si aspetta, e la lettura è «non funziona».

E nella finestra **non a tutto schermo**, dove la scena è alta la metà, quello
stesso pannello arrivava a stamparsi anche sopra alla barra del tempo da cui
era stato chiamato — la terza segnalazione.

Adesso il pannello **cresce dalla barra verso l'alto** (`bottom:
var(--sol-fondo-scheda)`, la stessa misura su cui poggia la scheda, e quella la
barra la misura davvero) e si ferma centocinquanta pixel sotto il bordo di
sopra: quella fascia sono i comandi, e restano toccabili. Dove la scena è
troppo bassa perché ce ne stia tutto — telefono, finestra non a tutto schermo —
vince il pannello con un minimo di 180px, e a scorrere è il suo contenuto.

Da lì anche il `ResizeObserver` sulla barra: `sol.altaBarra` (quanto spazio
lasciano in fondo le scritte disegnate sulla scena) era misurata **una volta
sola** all'apertura, ma la barra cresce di una riga quando la slitta va a capo
e quando la lettura della velocità passa da «—» a «5 min/s» — due momenti che
non sono un ridimensionamento della finestra e che quindi nessuno raccontava.

Provato nel browser vero (Playwright + Chromium, Astronomy Engine servito da un
file e Tailwind da un CSS generato a parte, perché da qui i CDN sono chiusi) in
tre forme — telefono a tutto schermo, telefono in finestra, computer in
finestra: col pannello dell'orologio aperto, prima il ⚙ e tutt'e tre le viste
erano coperte in tutt'e tre; adesso in nessuna.

### 2. Le tre viste hanno il nome scritto

Erano tre tondi con la sola icona. Un segno senza parola, appoggiato su un
cielo nero, con un bordo che è un grigio azzurrino al 26% (`--bordo-forte`),
non è un comando discreto: è un comando che non c'è. Adesso sono tre pillole
con **Da qui**, **Tutto**, **Terra e Luna** scritti accanto al segno, in
colonna (una fila di tre parole in cima al disegno attraverserebbe lo schermo
proprio sopra a quello che si è venuti a vedere).

Con loro, la pelle di tutti i comandi appoggiati sulla scena: `--fondo-scena` e
`--bordo-scena`, dichiarati su `.sol-guscio`, più marcati dei fratelli che
stanno dentro ai pannelli — perché qui sotto non c'è il grigio di un pannello,
c'è il nero del vuoto.

### 3. Il pannellino del ⚙ si apre di fianco

Si apriva **in giù**, cioè sopra al − e al + dello zoom: si tocca un tasto e
spariscono i due che si conoscevano già. Adesso esce a sinistra della colonna,
dove c'è tutto il disegno, ha un titolo (**Come è disegnato**) perché un
pannellino aperto da un segno senza parole deve dire di cosa parla, e le due
fette dei segmenti sono larghe quanto la loro parola — con le fette uguali
«Ingrandite» sbordava dalla sua pillola. I due pannelli appoggiati sulla scena,
questo e l'orologio, si danno il cambio: aprirne uno chiude l'altro.
