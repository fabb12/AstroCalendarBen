# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Il fumetto dell'oggetto**, al posto del pannello dei dati nel planetario.

### Cosa c'era, e perché non bastava

Toccando un oggetto sulla mappa si apriva `.pannello-dettaglio`: un rettangolo
inchiodato nell'angolo alto a sinistra, con dentro venti righe. Funzionava, e
aveva il difetto che hanno tutti i pannelli appoggiati a una mappa — **non
dice a cosa si riferisce**. Toccando un triangolo in mezzo a otto triangoli la
scheda compariva dall'altra parte dello schermo, e restava da capire quale dei
tanti si fosse preso. E su un telefono si prendeva mezzo cielo proprio nel
momento in cui lo si stava guardando.

### Cosa c'è adesso

Un fumetto, che risponde a tutt'e due le cose con la stessa forma: sta
**attaccato** all'oggetto — la coda lo indica e lo segue mentre il cielo
scorre sotto al dito — e dice **poche righe**, quelle che si leggono in un
colpo d'occhio.

- **per un aereo**: da dove viene e dove va, quanto è alto e quanto corre, che
  aeroplano è, quanto è lontano e da che parte;
- **per un astro**: cos'è, da che parte e quanto in alto, la fase, la
  magnitudine.

I venti numeri non sono spariti: stanno dietro al **ⓘ**, che apre la scheda
completa di prima; la freccia `‹` riporta al fumetto, il `✕` chiude tutto.
Esc fa la stessa scala, un gradino per volta.

### Le tre cose che non si vedono, e che sono il lavoro vero

**Dove si posa.** Sopra all'oggetto quando c'è posto (è il verso naturale: il
dito che l'ha toccato sta sotto e non deve coprire quello che ha appena
aperto), tosato dentro al riquadro con la coda che scorre lungo il bordo per
continuare a indicarlo, e fuori dalle due fasce che il cielo ha già occupato —
la bussola in cima, la barra del tempo in fondo. Quando neanche la coda ci
arriva, a unirli resta un **filo**, che è un elemento a parte apposta: dentro
al fumetto `contain: paint` lo taglierebbe al bordo.

**Uno schermo piccolo.** Non si stringe di corpo — è l'errore che si fa
sempre, e dà un fumetto che ci sta e non si legge — si stringe di larghezza e
**perde righe**: su un 640×360 fra le due fasce restano novantasei pixel
misurati, e un fumetto da quattro righe ne misura centotrentadue. Per questo
ogni categoria ordina le sue righe dalla più importante alla meno. Se anche
così non ci sta, a cedere è la fascia di sopra: delle due, quella che non si
può coprire è la barra del tempo, che è l'orologio.

**Il costo.** `getBoundingClientRect` forza il calcolo dell'impaginazione, e
chiamarla a ogni fotogramma dopo aver scritto `left`/`top` è il botta-e-
risposta che mette in ginocchio un ciclo di disegno. La misura si tiene e si
rifà solo quando può essere cambiata — anche per un numero: «9.750 m» →
«10.100 m» cambia la larghezza, e con lei il posto giusto della coda. Una
lettura in trenta fotogrammi invece di trenta.

Due cose trovate misurando, e scritte in chiaro nei commenti: le misure vanno
arrotondate **per eccesso** (`offsetHeight` perde i decimi, e quei decimi
erano il pixel con cui il fumetto scavalcava la barra del tempo — 132 contro
132,4), e il tetto di sopra non deve avere un margine in più, che allentava un
vincolo non stretto e faceva salire il fumetto sopra alla bussola per niente.

### Il resto

Il filmato registrato ridisegna anche il fumetto (`skyRegDisegnaRiquadro`): è
HTML sopra al canvas, e un canvas registra solo sé stesso — senza, nella clip
si vedrebbe il cerchio azzurro attorno a un aereo e nessuna riga che dica
quale sia. `DISEGNI` ha un'icona `aereo` (prima era un glifo Unicode, e in
mezzo alle icone a contorno di tutta l'app si riconosceva subito per quello
che era). `aerei.js` espone `aereiFumettoDati` e `aereiRottaOra`: la partenza
della richiesta dell'itinerario e la scrittura del risultato sono adesso due
cose separate, perché il fumetto un riquadro in cui aspettare non ce l'ha.

Prove in `scripts/prova-fumetto.js`, su tre schermi (360×640, 640×360,
1280×800): 72 controlli, tutti verdi. `prova-nel-browser.js` non è
peggiorato — i suoi tre rossi sono gli stessi che dà su `main`.
`CACHE_NAME` → `astrocal-v255`.
