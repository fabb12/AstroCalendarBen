# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — «il terreno sembra vettoriale, e i nomi non compaiono»

Branch `claude/terrain-planetarium-visuals-1u7rxc`.

La segnalazione era in tre pezzi: il terreno sembra disegnato al computer
(piani separati da linee troppo evidenti, niente profondità), sotto
l'orizzonte c'è un'ampia campitura piatta e monocromatica, e non si vedono le
etichette delle cime né i nomi dei laghi e dei fiumi.

### Il banco di prova, prima di tutto

Da qui la rete verso Open-Meteo e Overpass è chiusa, quindi il terreno vero
non arriva e il difetto non si riproduce affatto. Il lavoro è cominciato
costruendo un **mondo finto ma coerente** e servendolo al browser vero
(Playwright + Chromium, `index.html` da un server locale, service worker
bloccato, Astronomy Engine servita da un file): la stessa funzione di quota
alimenta il DEM, i poligoni dei laghi e le vette di Overpass, così l'orizzonte
disegnato e le etichette parlano dello stesso posto. Osservatore su un balcone
di valle a 230 m, montagne a nord fino a 2.300, un lago a sud-ovest e un fiume
che gli passa accanto. Con quello in mano tutti e tre i difetti si vedono al
primo scatto.

### I nomi — dov'era, e non era dove sembrava

**Le cime funzionavano.** Provate a campo largo e stretto, di giorno e di
notte, su schermo grande e su telefono in verticale: dieci vette nominate su
dieci visibili, il triangolino attaccato al crinale. Se sullo schermo non
compaiono, il motivo sta a monte — l'interruttore «Nomi dei monti» spento, il
terreno non ancora arrivato (finché sta arrivando `cimeVisibili` non ne nomina
nessuna, di proposito), Overpass che non risponde, o nessuna vetta che spunti
sopra la prima cresta. La riga di stato `#skymap-terreno-nota` dice quale dei
quattro.

**I laghi e i fiumi no, ed era un difetto vero.** `skyNomiAcque` chiedeva che
la banda d'acqua fosse alta almeno quanto l'etichetta, e da quando l'etichetta
è di due righe quell'altezza è una trentina di pixel. Ma uno specchio d'acqua
guardato da riva è schiacciato per geometria. Misurato nel browser: il lago
occupava **420 pixel di larghezza e 11 di altezza**, e ne servivano 22. Non era
un caso limite: era sempre, e per passare quella prova bisognerebbe guardare il
lago da una cima. Adesso la larghezza resta l'unica prova che conta (un nome
più largo del lago è un nome appoggiato sul paesaggio) e l'altezza decide
soltanto *come*: due righe con la categoria se c'è posto, il solo nome se no.
Per un fiume la sottigliezza è la sua forma e non un difetto — le carte il nome
di un fiume lo scrivono lungo la riga da sempre — quindi lo spessore minimo non
gli si applica. E due contorni: il nome **scivola lungo lo specchio**
(`skyPostoSuAcqua`) se il centro è occupato, e le lettere dei punti cardinali
si **prenotano** il loro posto prima di tutti (`skyPrenotaCardinali`), perché
si disegnano dopo e passano sopra: «SO» finiva stampato in mezzo al lago,
esattamente dove sarebbe andato il suo nome.

### Il paesaggio — quattro cose

1. **Le dorsali non hanno più contorni.** Il riempimento di ogni striscia è un
   gradiente dal crinale al piede (`skyRiempimentoBanda`, `SKY_BANDA_FOSCHIA`):
   dentro a una striscia il bordo di sopra è più lontano di quello di sotto,
   quindi la prospettiva aerea vive già dentro a ogni banda e il passaggio a
   quella dietro non ha più nessun gradino da nascondere. Da lì il filo di luce
   fra i piani si è potuto **togliere** invece di ammorbidire: resta solo quello
   contro il cielo. Il cappello si fa in due passate a profondità diverse ed è
   schiarito verso la foschia di adesso e non verso il bianco.
2. **Il suolo sotto l'orizzonte.** Le fermate del gradiente erano scritte in
   frazioni della rampa, e la rampa va fino al nadir: nel riquadro ne cadeva il
   primo terzo, e il suolo passava da 122 a 86 livelli in tutta l'altezza dello
   schermo senza mai arrivare al colore del terreno vicino. Adesso sono scritte
   in **gradi di depressione** e dove cadano si misura proiettandole
   (`skyFermateSuolo`), con due leggi: la foschia se ne va in un terzo di grado
   (a un grado sotto l'orizzonte il terreno è a novanta metri, e novanta metri
   d'aria non velano niente) e la luce d'ambiente si spegne in decine di gradi
   (`SKY_SUOLO_NADIR_BUIO`). Di notte non si scurisce niente, che è giusto.
3. **La grana è a due scale, e di rumore vero.** Due tele con due semi
   diversi: la fine col fondo grigio in `overlay`, le chiazze **senza fondo**
   e in normale — perché l'overlay sotto la metà vale `2·base·velo` e sul
   terreno vicino, che adesso è scuro, non morde. La forma la dà
   `skyRumore2D` (ottave di rumore di valore, ripetibile per costruzione) con
   deformazione del dominio e posterizzazione morbida: vedi il ripasso qui
   sotto.
4. **La luce ha una direzione.** `skyLucePaesaggio` dice qual è l'astro che
   illumina (il Sole finché sta sopra ai −10°, se no la Luna), e la velatura si
   stende sul suolo e sulle creste: calda verso di lui, azzurra dall'altra
   parte. Il velo del paesaggio è stato ristretto da 25° a 10° e alleggerito,
   perché con un suolo che adesso ha il suo gradiente quella vernice grigia
   chiara sotto la riga dell'orizzonte si leggeva come un muro.

### Una cosa da non rifare

Il velo della luce, alla prima versione, camminava per azimut disegnando un
trapezio per passo. Non funziona: due riempimenti semitrasparenti che
condividono un lato vengono antialiasati ognuno per conto suo e sulla giunta
resta una **riga verticale**, ogni passo, per tutta l'altezza — una tenda a
righe. Sovrapporre i trapezi peggiora (le opacità si sommano e la riga diventa
chiarissima). La cura è non avere la giunta: una figura sola, e la variazione
con l'azimut la porta il gradiente, con le fermate **misurate** proiettando gli
azimut veri (`skyRampaLuce`). La discesa verso i piedi, che un gradiente
unidimensionale non può portare insieme all'azimut, la fanno sei passate
sovrapposte sempre più corte.

### Ripasso dopo la prima segnalazione

Due cose arrivate dal vero, sulla stessa passata:

- **`IndexSizeError: addColorStop … (1.0001) is outside the range`**, con lo
  schermo che smetteva di disegnarsi. Era mio, in `skyFermateSuolo`: tosavo
  nell'intervallo *dopo* aver spinto ogni fermata un pelo oltre la precedente,
  e con l'occhio esatto sulla riga dell'orizzonte (il caso `retta`) nove
  fermate su undici finiscono su 1, quindi la decima chiedeva 1,0001. Le due
  regole vanno nell'ordine opposto. Provato nel browser su settantadue
  inquadrature (altezza da −89° a +89°, campo da 1° a 179°): zero errori.
- **La grana**, rifatta perché sembrava fatta di bolle. Erano dischi sfumati
  sorteggiati e impilati: da lontano funzionavano, da vicino restavano dei
  cerchi. Adesso è rumore a più ottave ripetibile (`skyRumore2D`) con
  deformazione del dominio e posterizzazione morbida — le chiazze si stirano e
  hanno il bordo netto, come campi e boschi. Attenzione a non alzare la scala
  grande: si passa dalle bolle alla mimetica militare, e la prima prova l'ha
  fatto.
- Via anche le due righe `[Intervention] Blocked call to navigator.vibrate`
  della console: venivano da un `telVibra(0)` che spegneva un battito mai
  partito.

### Come è stato provato

- `verifica.html`: **576 prove passate**, comprese le 35 nuove del §22 (il
  colore del suolo depressione per depressione, la legge della luce, e i nomi
  dell'acqua col caso vero misurato — 420 × 11 pixel — che adesso passa e con
  la regola di prima non passava, e la tosatura delle fermate del gradiente
  che non deve uscire da [0, 1]).
- Nel browser vero, otto inquadrature (notte, giorno, campo largo, lago,
  tramonto, vista in giù, forte zoom, telefono in verticale) prima e dopo.
- Costo per fotogramma nella vista più cara (tramonto con terreno, acqua e
  nomi): **da 4,1 a 4,4 ms** di mediana.

`sw.js` a `astrocal-v123`.

### Quello che resta, e che non era nel compito

Alla riga dell'orizzonte c'è un salto di tono fra le dorsali (terreno vicino,
scuro) e il suolo appena sotto: viene dal fatto che il suolo si dipinge con un
gradiente che dipende dalla sola depressione, mentre le dorsali sanno la
distanza vera per ogni direzione. C'era già prima ed è molto meno marcato di
allora, ma per toglierlo del tutto il suolo dovrebbe essere dipinto per azimut
come il paesaggio.
