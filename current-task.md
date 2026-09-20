# Niente in corso

Ultimo lavoro chiuso: **i rettangoli verticali del rilievo allo zoom spinto** —
«ingrandendo, sui pendii compaiono delle bande verticali, e più ingrandisco più
si allargano».

Il conto sta in una riga, e vale la pena averlo in mente prima di cercare
altrove: la maglia di `rilievo.js` ha settecentoventi direzioni, cioè **mezzo
grado** l'una dall'altra, e il disegno campionava la maglia **solo sui suoi
nodi**. Una colonna si disegna perciò larga `mezzo grado × pixel per grado`: a
sessanta gradi di campo sono cinque pixel e non se ne accorge nessuno, a trenta
dieci, **a quattro gradi settantacinque**, a un quarto di grado milleduecento —
su un riquadro largo trecentosessanta. Il terreno smette di essere una
superficie e diventa una fila di rettangoli alti mezzo schermo, ognuno di un
colore solo; e siccome il tratto si tosa a `RIL_LARG_PX_MAX` (48 px), oltre
quella misura fra l'uno e l'altro si riapre il fondo della fetta — le bande
chiare alternate a quelle scure della fotografia della segnalazione.

`rilPassoColonne` non poteva farci niente: sa **saltare** colonne, e qui ne
servono di più, non di meno.

La cura è in tre pezzi.

**(1) La maglia si spezza** (`rilSottoColonne`, §9 di `rilievo.js`). Si
disegnano sotto-colonne in potenze di due finché quella disegnata sta sotto
`RIL_COL_PX` (dieci pixel — non un numero a occhio: è quanto misura oggi una
colonna a trenta gradi di campo, cioè una vista di cui nessuno si è mai
lamentato). L'isteresi è quella del passo e per lo stesso motivo: fra «spezza»
e «rimetti insieme» ci vuole una fascia morta, se no pizzicando il disegno
balla. Il budget può allargare la colonna su un dispositivo lento ma non oltre
`RIL_COL_PX_TETTO`, se no il rimedio si spegne proprio dove serve — e costa
poco lasciarglielo fare solo a metà, perché quello che pesa è la superficie
dipinta e non quante colonne la dipingono (è la lezione del lavoro
precedente: le strisce da 4.310 a 380 valevano 51 ms contro 33).

Quello che rende **lecito** spezzare: a un chilometro mezzo grado sono otto
metri e mezzo, cioè meno di una cella del modello del suolo (ventisette metri).
Fra due colonne vicine la quota è già interpolata dal raster, quindi leggerla a
un ottavo di colonna non inventa niente — disegna quello che il dato dice,
invece di arrotondarlo al nodo più vicino. Dentro alla camminata si mescolano i
due nodi che abbracciano la colonna: l'angolo, la quota, i due campioni della
derivata in azimut, quello all'indietro e **anche il disturbo del dithering** —
preso sul solo nodo di sinistra resterebbe costante per tutta la larghezza di
una colonna della maglia, cioè sarebbe lui a disegnare l'ultima banda rimasta.
A `sotto = 1` ogni riga è identica a com'era.

**(2) L'arco si tosa al cono** (`rilMezzoDelCono`, `RIL_ARCO_MARGINE`), e senza
questo il punto (1) sarebbe stato insostenibile. I due archi di `app.js`
aggiungono **sei gradi** di margine, che è la misura giusta per una vista da
sessanta gradi e a campo stretto non è un margine: è quasi tutto il lavoro —
guardando quattro gradi il cono è largo due e mezzo e l'arco ne concede otto e
mezzo, a un quarto di grado il cono è quindici centesimi e l'arco sempre sei,
cioè quaranta volte le colonne che si vedono. Il limite esatto c'è: la tela è
circoscritta da un cerchio di semiapertura `σ`, quindi una direzione che
finisce sullo schermo non si scosta in azimut più di `asin(sin σ / cos a)` — e
vale a qualunque quota, perché una cima e il fosso sotto di lei hanno lo stesso
azimut della colonna che li disegna.

**(3) La scelta delle colonne è uscita dal disegno** (`rilColonneDaDisegnare`),
così il banco può farle la domanda senza ricopiare il conto.

Misurato. Le colonne restano **ottantatré su un telefono e centotrenta su un
computer a qualunque ingrandimento** — meno di una vista da sessanta gradi — e
il costo per disegno a sessanta gradi scende appena (8,7 ms contro 9,8, per via
dell'arco più stretto), mentre a quattro gradi è 1,3 ms e a uno 2,0, cioè
ancora molto meno della vista larga. Nei pixel, su una scena sintetica a
quattro gradi: **otto bordi netti e un salto di 37 livelli su 255 prima, zero
bordi e 4,1 livelli adesso**; a un grado 34,6 → 6,5. A sessanta gradi il
disegno è **identico pixel per pixel**.

Prove. `node scripts/prova-verifica.js` — **1.307 verdi, 6 rosse, le stesse sei
prima e dopo** (tre sull'acqua rasente, una sulla camera che insegue, due sul
raggio fisso della realtà aumentata); le quindici nuove stanno nel §25,
§«I rettangoli verticali dello zoom spinto». `node scripts/prova-abitati.js` —
57 su 57. `node scripts/prova-rilievo-zoom.js` (nuovo, e in CI) — 18 su 18: è
il banco che guarda i **pixel**, col contro-esempio servito da una rotta di
Playwright, cioè lo stesso file con `RIL_SOTTO_MAX` portato a uno.
`scripts/prova-nel-browser.js` dà lo stesso esito di prima (si interrompe su
`solDisegnaVicino`, che non c'entra con questo lavoro).

**Quello che resta da fare.** Due cose viste misurando e lasciate dove stanno,
perché sono altre segnalazioni e non questa.

La prima: **alzando la camera più del semi-campo, il rilievo non si disegna
affatto**. `rilArcoInVista` chiede l'arco a `skyArcoOrizzonteInVista`, che
risponde `null` quando la riga dell'orizzonte esce dal cono, e ripiega su
`skyArcoAcquaInVista`, che risponde `null` quando il cono sta tutto sopra
l'orizzonte. A campo stretto quel caso è vicino: con quattro gradi di campo
basta alzare la vista di tre perché il terreno sparisca. Le montagne però
stanno **sopra** la riga dell'orizzonte, ed è proprio quando le si ingrandisce
che le si guarda dall'alto in basso.

La seconda: a un grado di campo resta un gradino di sei livelli e mezzo su 255
fra una corsa piatta e l'altra (a sessanta gradi ne vale dieci, quindi
ingrandendo si sta **meglio** di prima — ma le corse lì sono larghe ottanta
pixel invece di cinque, e un gradino largo si legge più di uno stretto). Non è
più la maglia: è la quantizzazione di sempre — quaranta livelli di chiaroscuro
e quarantotto bande di quota — su una superficie che a quell'ingrandimento è
liscia, e su cui né la granatura (340 e 95 metri) né il dithering hanno più una
scala che morda. Chi ci mette mano guardi lì, non nelle colonne.
