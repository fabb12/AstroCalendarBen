# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 353 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto è sceso da 364 a 362 con l'intervento qui sotto.

## Ultimo intervento completato

**La realtà aumentata riconosce gli oggetti veri e ci si aggancia.**
Richiesta: «migliora la funzionalità realtà aumentata, mettila più in vista.
Quando è attivata implementa un sistema di tracciamento del target in modo da
allineare perfettamente, in automatico, le informazioni in sovraimpressione —
l'aereo dato ADS-B deve combaciare con l'aereo vero, idem per tutti gli altri
astri. Se muovo il cellulare l'elemento deve rimanere allineato all'oggetto
reale.»

### 1. Il difetto, e perché erano tre difetti

Nella fotografia allegata l'aereo disegnato stava qualche grado accanto
all'aereo vero. La geometria della realtà aumentata era già giusta — la
proiezione sopra il video è rettilinea come quella dell'obiettivo, il campo lo
detta l'obiettivo e non la preferenza — e quindi il residuo veniva da tre
cause di natura diversa, che è la ragione per cui un solo numero non le
poteva curare:

- **l'assetto**: la bussola sbaglia. Un grado nel migliore dei casi, venti con
  del ferro vicino. È un errore uguale per tutto il cielo;
- **l'obiettivo**: quanto riprenda la fotocamera il browser non lo dice (né
  `getSettings()` né `getCapabilities()` espongono il campo visivo). Si assume
  65° sul lato lungo; se l'obiettivo è un grandangolo da 78° il centro
  combacia lo stesso e i bordi no;
- **l'oggetto**: un aereo ADS-B non è dove il feed dice. La propagazione di una
  lettura vecchia di tre secondi, a 250 m/s, sono ottocento metri — che a
  cinque chilometri di distanza sono **nove gradi**. Ed è un errore di quel
  singolo aereo, non del cielo.

### 2. `visione.js` (~1.100 righe, prefisso `vis`)

Un modulo nuovo che stima tre cose invece di una, ognuna dal dato che la può
misurare. §3-§4 rilevano le macchie nel fotogramma **col segno** (di giorno un
aereo è una sagoma scura: chi cerca solo il chiaro non lo trova mai, e non lo
dice); §5-§6 le associano ai candidati con un cancello che si stringe man mano
che ci si fida; §7 risolve la rotazione che le fa combaciare tutte (Wahba
linearizzato e iterato, con λ piccolo e pesi ridiscendenti); §8 ricava la
focale vera dal rapporto fra due distanze; §9 tiene le ancore dei singoli
oggetti.

**La riga che risponde alla domanda del movimento**: quello che si misura non
è la posizione di un'etichetta ma una **rotazione del mondo**. La si misura da
fermi, dove l'immagine è nitida, e da lì la porta avanti il giroscopio — è la
divisione della navigazione inerziale, *il giroscopio dà il movimento, la vista
dà la mira*. Provato: dopo venticinque gradi di rotazione, **senza rimisurare
niente**, gli astri restano sulle loro macchie.

### 3. I quattro difetti trovati misurando

Nessuno dei quattro si vedeva sullo schermo, perché il sintomo di tutti è
**nessun aggancio**, che somiglia a «qui non c'è niente da riconoscere».

1. **λ della regolarizzazione a 0,02**: tirava la soluzione verso
   l'immobilità e la rotazione veniva il 16% più corta del vero (2,64° invece
   di 3,16°). Adesso è un milionesimo — regolarizza uguale e non tira niente.
2. **Gli aloni**: il fondo stimato a scatola fa sì che ogni macchia si scavi
   attorno un anello di segno opposto. Due sorgenti producevano **undici**
   macchie. Le toglie il segno.
3. **Il disco saturo**: la Luna ha in cima un pianoro dove ogni pixel è un
   massimo locale — quattro copie della stessa macchia, che per la regola
   dell'ambiguità sono quattro riferimenti ambigui, cioè nessuno. Si deducono
   dal risultato: due picchi che danno lo stesso centroide sono lo stesso
   oggetto.
4. **Il centroide tirato fuori dal centro**: al centro di un disco la scatola
   del fondo è quasi tutta disco, quindi lì il residuo si abbassa e il massimo
   casca su un anello — quattro pixel di schermo di errore **sistematico**,
   che il filtro non toglie perché non è rumore. Si ricentra la finestra, tre
   passate.

Più due di integrazione: la correzione applicata **due volte** alle ancore
degli aerei (che li portava via di tre gradi e mezzo), e il conto dei pixel
del fotogramma ridotto — duecento di larghezza su uno schermo di telefono sono
ottantottomila pixel e dieci millisecondi e mezzo per giro. Adesso il budget è
in pixel (30.000): 1,8 ms.

### 4. Il tasto, che era nascosto

Il comando stava nella scheda «Schermo» del pannello Visualizzazione — la
quarta linguetta del terzo pannello — e a cielo pieno schermo, cioè proprio
dove la realtà aumentata si vuole, i pannelli non si aprono affatto. Adesso è
il **primo della colonna dei comandi sulla mappa**, con la pillola `#ar-stato`
in alto a sinistra che dice a quanti riferimenti è agganciato e con che
scarto. I due tasti li tiene d'accordo `skyAggiornaTastiCamera()`.

### 5. Provato

- **§32 di `verifica.html`**, 44 prove, che carica `visione.js` per davvero e
  non una copia. Scena sintetica con errore noto, e il contro-esempio del
  segno girato — che non lascia le cose come stavano, le peggiora del doppio.
- Il motore intero in un Chromium vero, con un fotogramma finto: la Luna passa
  da 46 pixel di scarto a **0,4**, l'aereo a **0,47**, e dopo venticinque
  gradi di rotazione senza rimisurare resta a 0,44 (contro i 52 senza
  correzione).
- `node scripts/controlla-i18n.js --patto`: 362, dentro al tetto (che è stato
  abbassato a 362).

### 6. Quello che non è stato provato qui

`verifica.html` per intero e `scripts/prova-lingua.js` non girano in questo
ambiente: la CDN di `astronomy-engine` è irraggiungibile e la pagina si ferma
alla prima riga che la usa. Il §32 è stato fatto girare estraendone il blocco
— non usa Astronomy — ma **le altre sezioni non sono state rieseguite**, e chi
ha una rete aperta faccia una passata prima di fidarsi.
