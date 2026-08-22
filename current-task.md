# Task Corrente

## In corso — il rilievo del terreno in 3D (`rilievo.js`)

Richiesta: che il planetario disegni la **conformazione** vera del terreno —
le valli che scendono, il solco del fiume, i fianchi — invece della sola
sagoma a piani, come nello screenshot di PeakFinder che l'utente ha allegato
(Como, 45,868 N 9,109 E, guardando a sud-ovest).

### Il ragionamento

Il profilo a bande di `skyDisegnaProfiloOrizzonte` legge `terreno.fronti`, che
è un **massimo accumulato**. Un massimo non scende: la conca davanti, il
fianco che cala, il taglio del fiume in quel numero non ci sono più — se li è
mangiati il massimo del bordo. È la ragione per cui quel disegno viene a
ritagli di carta impilati, e non è un difetto del disegno: è la forma del
dato.

Quindi una **superficie** al posto di una sagoma: una maglia polare centrata
sull'occhio (720 direzioni × 106 anelli), di cui si conosce la quota in ogni
nodo, disegnata dagli anelli lontani verso i vicini. In una parametrizzazione
per (azimut, distanza) *a partire dall'occhio*, l'ordine degli anelli **è**
l'ordine di profondità: il pittore basta, niente z-buffer.

E le quote non si possono più chiedere a punti — per un fiume ne servono
decine di migliaia, cioè centinaia di richieste, cioè il 429 di §4
moltiplicato per dieci. Si prendono a **tessere raster**: AWS Terrain Tiles,
formato terrarium, un PNG in cui ogni pixel è una quota. Nessuna chiave, CORS
aperto (senza il quale il canvas si contamina e i pixel non si leggono),
65.536 quote in una richiesta sola, 27 m di passo a zoom 12.

### Cosa c'è adesso

`rilievo.js` (~1.150 righe, prefisso `ril`): tessere, maglia, creste,
disegno. Gli agganci sono tre e tutti guardati da un `typeof`:
`skyDisegnaTerreno` prova `rilDisegna` prima del profilo a bande (e quando
disegna lui saltano anche la velatura del paesaggio e quella della luce, che
dicevano con la vernice quello che adesso dice la forma); `terrenoAltezza` /
`terrenoFronteA` / `terrenoFrontiA` preferiscono la maglia; `terrenoCarica`
la innesca. Tasto `#skymap-btn-rilievo`, interruttore in `raggi.rilievo`.

### I cinque difetti trovati misurando, e cosa erano

Tutti e cinque si vedevano come «terreno sbagliato» e nei numeri erano conti
sensati. Stanno scritti per esteso nei commenti, e le prove sono nel §24 di
`verifica.html`.

1. **La parete dal niente.** La griglia grossa estrapolata all'indietro: gli
   anelli fra 25 e 150 m leggevano la quota misurata a 150 m e la
   appoggiavano a 50. Orizzonte a sud-ovest: 60°, cioè il tetto.
2. **I due riferimenti che litigano.** Tessere (SRTM 30 m) e griglia
   (Copernicus 90 m) sullo stesso punto non danno lo stesso metro, e l'occhio
   viene da una sola delle due. Quindici metri di scarto a venticinque metri
   di distanza sono trentun gradi. Si allineano al punto in cui si sta.
3. **Il buco ai piedi.** La maglia partiva dai 25 m, cioè si fermava a 12°
   sotto l'orizzonte: sotto restava il gradiente del suolo, di un altro
   colore. Da lì il **grembiule**, dieci anelli fino a 15 cm dalle scarpe.
4. **Il reticolo di righe chiare.** Cuciture fra poligoni confinanti: due
   antialiasing che non fanno un pieno. Si ripassa il contorno col proprio
   colore.
5. **Il chiaroscuro piatto.** Le due sorgenti sommate e scalate invece che
   pesate: i coseni veri (0,3–0,95) finivano compressi in metà tavolozza. E
   al tramonto il Sole radente non illuminava niente — adesso l'azimut è
   quello vero ma l'altezza non scende sotto i 35°, che è la regola delle
   carte panoramiche.

### Cosa resta da fare

- Oltre i 6 km (il raggio delle tessere) lo sfondo è ancora la griglia a 3°:
  liscio. Alzarlo vorrebbe dire un secondo livello di tessere (z=9), cioè
  raddoppiare il peso scaricato — vedi il commento in cima a `rilievo.js`.
- Il costo misurato è 4-5 ms per fotogramma in software rendering
  (`rilievo.ultimo` lo dice). Su GPU vera è molto meno, ma vale la pena
  rimisurarlo su un telefono.
