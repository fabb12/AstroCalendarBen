# Task Corrente

Niente in corso.

## Ultimo intervento completato

**La bussola** (`app.js` §7.1-quinquies, nuova). La segnalazione: «i punti
cardinali sono imprecisi, come se il magnetometro a un certo punto
impazzisse — eppure Google Maps, sullo stesso telefono, è preciso».

Sono vere tutt'e due le cose, e il magnetometro non c'entra: c'entra **la
posa**. Una bussola di sistema (`CLHeading` su iOS, il canale «heading» di
Android) misura la direzione del bordo superiore del telefono **proiettato
sull'orizzonte**, e quella proiezione è lunga `|cos β|`. Chi guarda una mappa
il telefono lo tiene quasi piatto: la proiezione è lunga quanto il telefono e
la risposta è ottima. Chi guarda il cielo lo punta in su: la proiezione si
accorcia e verso lo zenit si annulla. Misurato nel §29: mezzo grado di errore
d'assetto vale **mezzo grado in piano e trenta gradi col telefono ritto**. La
stessa cosa capita alla terna alpha/beta/gamma, che a β = 90° perde un grado
di libertà — due terne con alpha lontane quaranta gradi descrivono lo stesso
identico assetto — ed è la posa normale di un planetario.

Tre cure, in ordine di quanto pesano.

1. **Il quaternione al posto degli angoli di Eulero.** Dove c'è
   (`AbsoluteOrientationSensor`, Android/Chrome) si legge direttamente la
   fusione del sistema — lo stesso `TYPE_ROTATION_VECTOR` che usa Maps —
   senza il giro per gli angoli: gravità e campo insieme determinano
   l'assetto completo, e pose degeneri non ce ne sono. `skyAvviaSensoreAssetto()`,
   `skyMatriceDaQuaternione()`.
2. **Il ponte del giroscopio.** Dove il quaternione non c'è (iOS: niente
   Generic Sensor API, e `webkitCompassHeading` è proprio la bussola che si
   accorcia) si misura lo scarto fra l'assetto stabile del giroscopio e il
   Nord magnetico **mentre il telefono è in una posa in cui la bussola è
   affidabile**, e lo si tiene: da lì in poi il Nord lo porta il giroscopio.
   Il peso di ogni correzione è il **quadrato** della bontà della posa
   (`skyPonteAggiorna`), quindi una lettura presa col telefono ritto conta
   ventitré volte meno di una presa in piano invece di contare uguale. Si
   legge anche `webkitCompassAccuracy`, che iOS dichiara e che nessuno
   guardava.
3. **La taratura su un astro** (`skyTaraSuAstro`, tasto «Tara su un astro» in
   «Bussola e posizione»). Le prime due tolgono l'errore della geometria, non
   quello del ferro: una custodia con la calamita o il cruscotto dell'auto
   spostano il campo di gradi, e nessun software li può indovinare — Maps, lì,
   chiede l'otto in aria e spera. Ma un planetario ha un riferimento che una
   mappa non ha: **sa dov'è il Sole**. Si punta la Luna, il Sole, un pianeta o
   una stella luminosa e si tocca il tasto: la correzione diventa **esatta per
   costruzione**. Quale astro sia lo dice l'altezza (±8°, la dà la gravità e
   non sbaglia mai), non l'azimut (±60°, che è proprio l'errore che stiamo
   cercando). Dopo, il ponte rallenta di più di venti volte, se no il
   magnetometro se la rimangerebbe in pochi secondi.

Nella stessa passata, tre cose collegate:

- **Il cielo non gira più di colpo «a un certo punto».** `deviceorientation`
  (relativo su Android, alpha da un punto qualunque) subentrava a
  `deviceorientationabsolute` dopo tre secondi di silenzio, e quel cambio
  della guardia girava tutto insieme. Adesso non si sostituiscono: il
  relativo è la metà stabile del ponte.
- **La bussola disturbata si dice.** Il disaccordo fra magnetometro e
  giroscopio è la sola misura di quanto stia mentendo: sopra i 12° il
  quadrante si smorza (`data-modo="dubbia"`) e l'avviso compare al massimo
  una volta ogni due minuti — mezzo secondo di ferro non lo fa scattare, due
  secondi sì.
- **Il push-to del telescopio** (`telMatriceTelefono`) usa la stessa matrice
  del planetario: prima rifaceva i conti dagli angoli di Eulero e si
  ritrovava una bussola peggiore di quella che gli stava accanto, con
  l'aggravante che lì i gradi si pagano in oculari mancati.

**§29 di `verifica.html`**, nuovo: 35 prove, tutte passate. Le due strade
dell'assetto che devono dare la stessa matrice, il contro-esempio della posa
(i trenta gradi contro il mezzo grado), l'invariante del ponte, il
contro-esempio del disturbo (settanta gradi col vecchio «comanda l'ultima
lettura», otto col ponte), il World Magnetic Model contro il calcolatore del
NOAA in sei posti del mondo — cento righe di ricorsione di Legendre mai
provate prima, e il **verso** della declinazione, che sbagliato raddoppia
l'errore invece di toglierlo — e la taratura sull'astro. Suite intera: 888
prove, l'unica rossa è quella del grembiule del rilievo (§25), che falliva
già prima di questo lavoro.

Cache PWA portata ad `astrocal-v229`.
