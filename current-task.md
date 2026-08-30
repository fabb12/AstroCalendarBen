# Task Corrente

Niente in corso.

## Ultimo intervento completato

**I laghi che non si vedono stando a due passi da loro** (`terreno.js` §12,
`rilievo.js` §7). La segnalazione: «nel planetario, in prossimità del Lago di
Como, dovrei vedere l'acqua e non c'è nulla; e dove c'è, il profilo non è
giusto».

La causa non sta nei dati di OpenStreetMap e non sta nel disegno: sta in una
**geometria che è un pareggio**. Guardando un lago da un pendio che ci scende
dentro, la riva è il punto in cui il terreno arriva al livello dell'acqua —
quindi il suolo davanti alla riva e la superficie dietro di lei hanno la
**stessa depressione**. Il conto che decide se un lago si vede confrontava i
due angoli con un ventesimo di grado di franchigia, che a settecento metri
sono sessantacinque centimetri di quota: qualunque cosa di più grande — un
tetto, un albero, il normale disaccordo fra due modelli del suolo sullo stesso
pendio — taglia la riva. E siccome la cresta è un massimo che si **accumula**,
quello che viene tagliato resta tagliato per tutte le distanze successive.

Misurato sul banco (una scena tipo Como: osservatore a 296 m, ramo di lago a
199, ottocento metri di riva), con un modello del suolo sbagliato di otto
metri: settanta metri di arretramento mediano della riva, millecinquecento al
peggio, e una direzione su venti senz'acqua. Con quindici — cioè con un
condominio, che è quello che Copernicus si porta dentro in un paese —
centoquaranta metri e tre chilometri e mezzo.

Tre cure, e sono tutte geometria e non tarature.

1. **La franchigia si scrive in metri, non in gradi.** Un campione che sta al
   livello dell'acqua o sotto non può nasconderla mai: se è più vicino, lo
   stesso dislivello diviso una distanza minore fa una depressione maggiore,
   cioè sta sotto la linea di vista. Quello che taglia una riva è quindi solo
   terreno che si alza **sopra il piano del lago**, e di quanto debba alzarsi
   perché gli si creda è l'incertezza del modello: sei metri
   (`ACQUE_OCCLUSIONE_ABBASSA_M`, tosata a tre gradi per non spegnere il primo
   piano). Il confronto passa in **pendenza** (`acqueTangenteVista`), dove
   abbassare un campione di tanti metri è una divisione, e la cresta
   dell'acqua se la costruisce `acqueFrontiAcqua` — dal rilievo quando c'è,
   cioè dalla superficie che si sta davvero disegnando e coi suoi centosei
   anelli invece delle diciotto fette della griglia grossa.

2. **L'occhio è uno solo** (`acqueOcchio`). L'acqua si guardava con
   `terreno.quota`, che è la quota del *centro della griglia grossa*: resta
   indietro di chilometri muovendosi, e `acqueAllineaOcchio` la riscrive di
   colpo quando ci si accorge di stare sull'acqua. La cresta però veniva dalla
   maglia del rilievo, costruita con un'altra camera. Vicino ai piedi due
   metri di differenza sono decine di gradi.

3. **Il grembiule non risponde a questa domanda.** I dieci anelli del rilievo
   sotto i venticinque metri servono a *disegnare* il suolo sotto le scarpe:
   la loro quota è la lettura bilineare della cella di raster su cui si sta e
   informazione propria non ne portano. Ma a quindici centimetri un metro e
   sei di quota vale ottantacinque gradi, e quel valore si ricopia in tutti
   gli anelli del raggio — misurato sul banco, ottantanove gradi di cresta in
   tutte e settecentoventi le direzioni e **zero acqua** su trecentotrentacinque
   direzioni che ne avevano. `rilFrontiAcqua` comincia a camminare da
   `RIL_VICINO_M`.

Nella stessa passata, tre cose collegate:

- **La quota di uno specchio si chiede in tre gradini** (`acqueQuoteDeiCorpi`):
  i campioni della griglia che cascano dentro, poi quelli della maglia del
  rilievo — che negli specchi stretti (un fiume, l'acqua a duecento metri) ci
  arriva davvero — e solo alla fine quelli che lo abbracciano, che stanno sulla
  riva e quindi sopra l'acqua. Prima la maglia non c'era e il secondo gradino
  mancava. Che la maglia venga *dopo* la griglia è misurato e non ovvio: quella
  superficie è il modello delle tessere **traslato** per accordarsi alla griglia
  in un punto di terra ferma, mentre sull'acqua i due modelli vanno d'accordo
  benissimo — traslarla scentra il lago esattamente di quello scarto.

- **Un elenco in mano non si butta per una richiesta andata male.**
  `acqueVisibili` chiedeva `stato === 'pronto'`, quindi un ritaglio in corso
  mentre ci si muove o una riprova dopo un 429 spegnevano tutta l'acqua pur
  avendola buona da un istante prima. È la lezione di `terrenoDisponibile` e di
  `cimeVisibili`, che qui era rimasta da imparare.

- **Un'assenza che si spiega.** `acque.conto` tiene il conto di dove si sono
  perse le bande (fuori raggio, sopra l'occhio, coperte, troppo corte) e
  `acqueTesto` lo scrive: «l'acqua qui attorno c'è (N tratti), ma il terreno
  davanti la copre tutta» è un'altra cosa da «nessun lago entro venticinque
  chilometri», e sullo schermo le due erano la stessa immagine.

Misurato prima e dopo sulla stessa scena, col rilievo acceso (com'è di serie) e
un disaccordo di dodici metri fra i due modelli del suolo: dal 96,9% di lago
disegnato con centoquattro rive tagliate e tre direzioni vuote, al 100% senza
niente di tagliato. Col rilievo spento e tre metri di rumore: da 283 rive
tagliate a 19. Il conto costa 6,7 ms invece di 4,7 a ogni ricostruzione della
maglia (non a fotogramma): la camminata si ferma all'acqua più lontana di
quella direzione e legge le quote invece di ricalcolare settantaseimila
tangenti.

Quindici prove nuove nel §20 di `verifica.html` (in tutto 902 passate, 1
fallita — quella è del §28 e c'era già prima di questo lavoro: «e nel grembiule
sotto i piedi lo scarto resta comunque piccolo», 5,944°).

**Quello che non si è potuto fare**: verificare sul posto vero. Da qui la rete
verso Overpass e Open-Meteo è chiusa, quindi le misure sono su scene
sintetiche costruite come Como e non sui dati veri di Como. Se l'acqua ancora
non compare, adesso la riga di stato del pannello (o `acque.conto` dalla
console) dice **quale** dei tre casi è: non è arrivata, è sopra l'occhio, o il
terreno la copre.
