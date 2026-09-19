# Task Corrente

**Niente in corso.**

L'ultimo lavoro chiuso: **quattro assenze, due nel filmato e due nella
galleria.** Hanno in comune il modo di non farsi vedere — un filmato di
stelle è bello comunque, e una galleria di schede tutte uguali è una galleria
plausibile: nessuna delle quattro fallisce, tutte e quattro semplicemente non
ci sono.

**La fotografia del riquadro non arrivava nel filmato**, e al suo posto
c'era l'icona dell'immagine rotta con scritto accanto «Foto dell'aereo
UAE3Q», più il nome del fotografo di una fotografia che non c'era. La
ragione: dentro all'SVG una fotografia **deve** essere un data URL — un
indirizzo esterno renderebbe insicura la tela e il MediaRecorder smetterebbe
di produrre dati — e il `catch` di prima si limitava a togliere il `src`, che
in una copia dove le altezze sono già scritte in pixel vuol dire esattamente
quel buco con l'icona dentro. Adesso le strade sono **due**, perché
falliscono per motivi diversi: la `fetch` (che non arriva col service worker
in mezzo, con una voce di cache opaca lasciata dall'`<img>`, o quando la
risposta arriva e non è un'immagine) e il ricarico dell'immagine col **CORS
chiesto per nome**, ricopiata su una tela di servizio — dove `toDataURL`
solleva se l'immagine non è leggibile, che è l'unico modo di saperlo senza
rischiare la tela del filmato. Se non si può fare niente, la fotografia se ne
va **col suo credito**. L'esito si tiene per indirizzo (`sky.reg.foto`):
l'impronta del riquadro cambia a ogni battito, quindi senza memoria la stessa
fotografia si andava a richiedere per tutta la registrazione. E
`skyRegPreparaSchedeVisibili` ha una **scadenza**: aspettarla serve, ma un
filmato che non comincia è peggio di uno che comincia con una scheda di solo
testo.

**Il nome del posto, in verticale, non si leggeva.** La firma era una riga
sola («data · luogo») con la data intera e il luogo accorciato con quello che
restava: su un fotogramma verticale di «Sasso Marconi, Bologna,
Emilia-Romagna» restava una stringa vuota. Adesso, quando insieme non ci
stanno, il luogo va **a capo** su un massimo di due righe intere. Nella
stessa passata la scelta fra mese per esteso e abbreviazione si **misura**:
era «un fotogramma più stretto di 520 pixel», e 520 non è la misura di niente
— il corpo del carattere viene dall'altezza.

**Quale sia il video di stanotte** lo dice adesso una pastiglia «Nuovo», che
se ne va premendo play (`CHIAVE_VIDEO_VISTI`). La chiave è il **nome** e non
l'`id` — lo stesso filmato ne ha due secondo da dove lo si legge — e si tiene
anche **da quando** si conta, se no il giorno in cui l'etichetta è nata una
galleria di venti filmati avrebbe detto venti volte «Nuovo», cioè niente.

**L'anteprima** non c'era perché `preload="metadata"` sul telefono non
dipinge nessun fotogramma (sul computer sì: misurato, `readyState` 4 da
solo). Adesso l'anteprima si **fa** — un fotogramma decodificato su una tela,
che diventa il `poster` — una per volta, e dove il fotogramma vero arriva il
poster non si vede mai.

Due prove: `scripts/prova-registrazione.js` (nuovo, 15 prove) e
`scripts/prova-galleria.js` (da 6 a 12), compresa quella con un filmato
**vero** registrato nella pagina col MediaRecorder, di cui si guardano i
pixel del poster — una tela mai dipinta è un'immagine perfetta sotto ogni
aspetto tranne quello che conta.

Nella stessa passata sei frasi della galleria sono passate ai dizionari
(l'elenco vuoto, i quattro tasti di ogni scheda, l'aria-label del ✕): il
ridisegno al cambio lingua le scriveva nel documento, e il tetto di
`scripts/i18n-tetto.json` scende da 347 a **346**.

`node scripts/prova-i18n.js`, `node scripts/prova-lingua.js`,
`node scripts/prova-fumetto.js` e `node scripts/prova-verifica.js` restano ai
loro rossi di prima, identici al ramo: due chiavi orfane della vista 3D, il
nome di un oggetto profondo che la sonda della lingua legge come italiano
(«h Per»), quattro prove del fumetto e cinque di `verifica.html`
sull'acqua e sulla camera.

`CACHE_NAME` è a `astrocal-v348`.
