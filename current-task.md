# Task Corrente

Niente in corso.

## Ultimo lavoro finito — la barra del terreno, il Lago di Como, gli spilli

Tre cose chieste insieme, e due delle tre erano guasti che una sessione
precedente credeva già chiusi. Vale la pena sapere **perché** non lo erano,
perché in tutt'e due i casi la correzione di prima era giusta e incompleta.

### 1. La barra di caricamento del terreno (§9-ter di `terreno.js`)

La percentuale c'era da un pezzo — `terreno.avanzamento`, scritta in
`terrenoTesto()` — ma finiva nella riga di stato del pannello
**Visualizzazione**, che all'apertura è chiuso: non la leggeva nessuno. Chi
apriva il planetario vedeva l'orizzonte finto per qualche secondo senza un
posto in cui guardare.

- `#terreno-progress` in `index.html`, dentro `#skymap-contenitore`, stili
  `.barra-terreno*`. In basso a sinistra sopra alla barra del tempo, quattro
  pixel di barra e una riga di testo, `pointer-events: none` (una spia, non un
  comando: un rettangolo che mangia i gesti per sei secondi all'apertura è il
  modo di far sembrare l'app bloccata mentre lavora).
- `TERRENO_FASI` sono **quattro**: quote (Open-Meteo), paesi, vette e acque
  (OpenStreetMap). I pesi non sono uguali — 0,55 / 0,10 / 0,10 / 0,25 — perché
  le quote sono venticinque richieste e i giri a OSM uno ciascuno; a pesi
  uguali la barra faceva tre quarti di strada nel primo secondo e poi stava
  ferma.
- Contano **solo le fasi che in questo giro girano davvero**
  (`terrenoBarra.fasi`): le vette nascono spente, un profilo può arrivare da
  `localStorage`. Contandole comunque la barra si fermava al 40% e ci restava.
- Il **tracciamento dei raggi** è agganciato anche lui: `acqueApplica` porta
  `acque.avanzamento` a 0,9 *prima* di chiamare `acqueTaglia`. Dura pochi
  millisecondi e quasi mai fa in tempo a comparire, ma il posto è quello
  giusto e ci resta.
- La muove `terrenoAggiornaPannello()`, che era già chiamata a ogni cambio di
  stato e a ogni richiesta di quote: nessun gancio nuovo da nessuna parte.

Provata anche nell'app vera (Chromium, servizi finti): 54% → 72% → 87% → 100%
→ si spegne, terreno completo, nessun errore di console.

### 2. Il Lago di Como (`acqueCuciAnelli`, §12)

`acquePuntoDentro` c'era già ed era giusta. Il guasto stava un passo prima:
**i laghi grandi in OSM sono relazioni**, con l'anello esterno spezzato in una
decina di vie (Como, Garda, Maggiore, Trasimeno), e `acqueLeggiElementi`
chiudeva ogni pezzo per conto suo e lo trattava da poligono. Due cose andavano
insieme:

- l'arco della riva orientale, chiuso su sé stesso, è una mezzaluna schiacciata
  che **non contiene il centro del lago**: `sommersi` restava vuoto e l'acqua
  sotto i piedi non si disegnava;
- la parità dei tagli si tiene per poligono (e deve: due laghi in fila sono due
  parità diverse), quindi l'ingresso trovato sulla riva di qua e l'uscita
  trovata sulla riva di là finivano in due conti separati e non si accoppiavano
  con nessuno — due mozziconi da duecento metri al posto della traversata.

Misurato su un ramo di lago sintetico, prima: **630 direzioni su 720
senz'acqua**, nessuna che partisse dai piedi. Dopo: zero e settecentoventi, e
identiche a quelle della stessa forma scritta come via chiusa — che è la prova
che tiene insieme le due strade.

La cucitura è quella di sempre (catene aperte, ogni arco si attacca a quella
che condivide un estremo, all'andata o al rovescio: Overpass non promette né
ordine né verso). Quello che non si chiude si chiude a forza: un anello
approssimato ha comunque **un dentro e una parità sola**.

In più, `acqueQuotaSuperficie` prendeva il minimo di **tutto** l'anello a
centocinquanta metri: un fosso lì accanto, più basso del lago, mandava l'occhio
sott'acqua — lo stesso errore col segno girato, e non si vede neanche quello.
Adesso il minimo si chiede ai campioni che cascano dentro alla banda che
comincia ai piedi, cioè allo specchio in cui si sta; quando nessuno ci casca (un
laghetto più stretto del primo anello) si torna al minimo dell'anello, che è
comunque un limite superiore onesto, e il caso si aggiusta da sé quando la
misura del punto arriva.

### 3. Gli spilli, per davvero (`terrenoTosaSpilliLarghi`, `terrenoLisciaAnelli`)

`terrenoTosaSpilli` confronta una direzione con le **due accanto**, e vicino
quelle due sono copie: la griglia è polare, quindi a centocinquanta metri due
direzioni distano sette metri e ottanta sul terreno e leggono la stessa cella
del modello (novanta metri). Là fuori una dozzina di direzioni di fila porta lo
stesso numero, e un capannone o un buco nel modello le alza tutte insieme — il
tetto non se ne accorge perché le vicine gli fanno da garanti. Provato: un dente
da otto gradi passava intero, e in montagna uno da sessanta.

Due filtri nuovi, agli angoli campione per campione e **prima** dell'accumulo
del massimo (l'ordine è metà del rimedio: filtrando dopo, in fondo alla riga la
finestra è larga zero direzioni e il dente dei centocinquanta metri è già stato
ricopiato lì):

- **tetto a mediana** su una finestra larga `TERRENO_TETTO_LARGO_CELLE` = **due**
  impronte di cella. Due e non una per aritmetica, non per taratura: la mediana
  dice la verità solo se il dente occupa meno di metà finestra. Da tre in su non
  cambia più niente.
- **passa-basso** a campana di Hann larga una impronta, per la scaletta —
  gruppi di direzioni uguali e poi un salto di tre gradi, cioè aliasing da
  campionamento radiale, e sullo schermo è la dentellatura.

La larghezza non è scelta a mano: è l'angolo che una cella occupa a quella
distanza (`terrenoPassiDiCella`). Trentun gradi a 150 m, quattro a 1,2 km,
**zero da quattro chilometri in su** — ed è quella la proprietà che conta,
perché le vette lontane, dove si appendono i nomi, escono da qui identiche a
come sono entrate (provato sui valori, non sulle soglie).

Misurato contro un orizzonte vero calcolato senza griglia, su un paesaggio di
costa e su uno alpino:

| | eccesso prima | eccesso dopo | rms prima | rms dopo |
|---|---|---|---|---|
| costa, tre celle sbagliate | 16,64° | 1,86° | 2,75° | 0,38° |
| alpi, due celle sbagliate | 60,00° | 4,61° | 15,19° | 1,38° |
| alpi, modello pulito | 7,84° | 3,32° | 2,57° | 1,28° |

Sul terreno **pulito** lo scarto quadratico medio scende: era la griglia a
sbagliare, non i filtri a impastare.

**Quello che non è stato fatto, e perché.** La richiesta chiedeva un
`Math.max(500, distanza)` nel denominatore di `terrenoAngolo`, o di scartare i
campioni sotto i 300–500 m. Non è stato fatto: tosare la distanza a cinquecento
metri vuol dire leggere i campioni di 150, 300, 500 e 800 metri a una distanza
che non è la loro, cioè appiattire il terreno vicino vero — una collina a
duecento metri copre davvero quindici gradi — e rompe l'invariante che il §9 di
`verifica.html` controlla da tempo («il limite minimo non morde nessun campione
della griglia»). `TERRENO_DISTANZA_MIN_M` resta a 50 m, che è metà cella e non
morde niente. La causa vera dei picchi non era l'asintoto della `atan2` (quello
era già stato chiuso): era la correlazione azimutale degli anelli vicini, ed è
quella che i due filtri tolgono.

**Il moltiplicatore verticale**: cercato, non c'è. Fra `terrenoAltezza(az)` e i
pixel non c'è nessun fattore di scala — la cresta in gradi va in
`skyVettore` → `skyProietta`, la stessa catena di ogni stella — e l'unico numero
che tocca l'altezza è il morso del rilievo fine (`SKY_RUVIDEZZA`), che sottrae e
non aggiunge mai, tosato contro la cresta vera di proposito in
`skyCresteDelleColonne`. È scritto in `CLAUDE.md` perché non lo cerchi più
nessuno.

### Come è stato verificato

`verifica.html` passa da **423 a 463 prove, tutte passate** (Chromium, con la
CDN di Astronomy Engine reindirizzata a una copia locale via `page.route` —
la pagina non va toccata). Le quaranta nuove stanno nel §9 (la barra), nel §15
(i due filtri, misurati contro un orizzonte calcolato senza griglia) e nel §20
(le relazioni cucite, e la superficie che non si fa spostare da un fosso).
Nessuna prova esistente è stata cambiata o allentata.

Nota per chi rilancia il banco: serve `serviceWorkers: 'block'` nel contesto
Playwright, se no il service worker intercetta le richieste finte e le prove
del terreno restano appese.
