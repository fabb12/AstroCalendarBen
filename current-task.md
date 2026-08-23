# Task Corrente

## In corso — il rilievo del terreno (`rilievo.js`), secondo tentativo

Richiesta: che il planetario disegni la **conformazione** vera del terreno,
come nello screenshot di PeakFinder allegato dall'utente (Como, 45,868 N
9,109 E), con colori e texture nuovi, i nomi delle cime precisi, e senza
l'artefatto del mirino all'orizzonte.

Il primo tentativo (commit `e30a63e`, annullato da `2bd73f2`) aveva la parte
dei **dati** giusta e il **disegno** sbagliato. Qui i dati sono ripresi tali e
quali; il disegno è rifatto da capo.

### Cosa è già in `main` (ramo `claude/planetario-terreno-3d-ih84eg`)

`1eaa494` — l'artefatto del mirino all'orizzonte. Due difetti alla soglia fra i
due modi di `skyCerchioOrizzonte`: la soglia fissa (freccia del cerchio di tre
pixel su un riquadro da computer, adesso mezzo pixel e adattiva) e la rampa del
gradiente del suolo ancorata al centro del riquadro invece che alla riga
dell'orizzonte. Misurato: 11.353 pixel che cambiavano fra due fotogrammi contro
i 6.400 di un passo qualunque, adesso 6.033.

**Correzione a quel messaggio di commit**: dei due, a far scattare il disegno
era **solo** la soglia. `skyFermateSuolo` in quel momento era codice morto —
definita e non chiamata da nessuno — quindi correggerla non cambiava un pixel.
È tornata in servizio dopo (vedi sotto).

### Il disegno nuovo

Una **camminata sola per raggio**: dai piedi verso l'orizzonte, tenendo il
massimo dell'angolo visto finora. Un campione si vede se supera quel massimo —
rimozione dei punti nascosti, esatta. Da quella camminata escono insieme
l'ombreggiatura, la sagoma, i contorni interni e `fronte`. Da lì, per
costruzione: la riga del crinale non può staccarsi dal crinale, e non c'è
nessun LOD sugli anelli da far ballare (era lo sfarfallio del primo tentativo).

L'ombreggiatura si disegna a **strisce verticali larghe una colonna**,
raggruppate per livello: un `fill()` per livello. Misurato: quattordicimila
facce costano 2,6 ms con `rect()` e 43 ms con quadrilateri obliqui.

### I difetti trovati misurando, in ordine

1. **Pettine.** Un tratto per colonna dà righe equidistanti anche sul piano.
2. **Lastra.** Legandolo alla piega ma misurandola fra colonne contigue, a 300 m
   la derivata seconda vale zero per costruzione (un decimo di cella).
3. **Mosaico.** Stessa cosa nella direzione radiale, più pochi livelli di
   chiaroscuro, più il fatto che una cella proiettata è un quadrilatero storto.
4. **Lastra pallida sotto l'orizzonte.** `skyGradienteTerreno` aveva due sole
   fermate e lo schermo ne conteneva il primo quarto: `skyFermateSuolo` è
   tornata in servizio con una legge a due esponenziali.
5. **Isteresi al contrario** nel passo delle colonne: le due soglie si
   scavalcavano, 26 cambi in 240 fotogrammi.

### Dove sono i numeri

`rilievo.ultimo` a ogni fotogramma (colonne, strisce, chiamate, ms): 1-3 ms nel
banco headless. `sky.cimeScritte` per i nomi delle vette.

### Cosa resta da guardare

- Oltre i 5 km lo sfondo è ancora la griglia a 3°: liscio.
- Restano deboli artefatti rettangolari in una fascia del primo piano.
- Le vette a nord da Como restano nascoste, ed è **giusto**: il DEM dà +27 m in
  25 m, cioè il fianco sopra la città.
