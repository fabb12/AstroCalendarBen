# Task Corrente

Niente in corso.

## Ultimo intervento completato

Due segnalazioni che arrivavano insieme, nella stessa console: le righe rosse
del caricamento del terreno, e le «strisce» sul paesaggio che si spostano
muovendo la camera. Sono tre cose diverse e stanno in tre file.

### 1. `cdn.tailwindcss.com should not be used in production`

Quel CDN non serviva un foglio di stile: serviva il **compilatore**. Mezzo
megabyte di JavaScript che a ogni apertura legge tutto il DOM, ricava le classi
che ci trova, scrive un `<style>` e poi resta in ascolto per rifare il lavoro a
ogni mutazione. Costava una richiesta a un CDN prima che si vedesse qualcosa e
ricompilava il CSS su ogni telefono a ogni apertura; e per una PWA c'era di
peggio — essendo uno script classico `no-cors`, era l'unica libreria che il
service worker **non poteva mettere in cache**, cioè proprio quella da cui
dipendeva l'impaginazione era l'unica che offline non c'era.

Le classi però non cambiano da sole. `scripts/costruisci-tailwind.js` le
compila una volta (Tailwind 3, la stessa versione del play CDN) e il risultato
sta in `tailwind.css`, nel repository, come i `dati-*.js`: **29 KB al posto di
mezzo megabyte**, e l'app resta senza build. Il `<link>` va dove stava lo
`<script>`, cioè **prima** di `style.css`, che è l'ordine da cui dipende il
patto «Tailwind la struttura, style.css la pelle» (§10). `sw.js` lo mette in
ASSETS, il workflow di pubblicazione controlla che ci sia (un `tailwind.css`
che manca non è una funzione spenta, è tutta l'impaginazione che se ne va) e
`CACHE_NAME` passa a `astrocal-v252`.

Da ricordare: **aggiungendo una classe Tailwind nuova va rilanciato lo
script**, se no quella classe semplicemente non fa niente.

### 2. Venti righe `429` identiche sullo stesso indirizzo

Il punto da avere in mente prima di cercare altrove: una `fetch` che fallisce la
riga in console la scrive **il browser**, e da JavaScript non si può zittire.
L'unico modo di non averla è non fare quella richiesta.

E niente la fermava. Il rubinetto sapeva rallentare (§4 di `terreno.js`) e la
rotazione sapeva cambiare porta, ma tutt'e due dimenticavano ogni cosa a fine
corsa: la stessa scoperta si ricomprava cinque volte per richiesta, poi a ogni
ripresa automatica di `TERRENO_RIPROVE_MS`, poi a ogni ricarica della pagina.
Misurato con tutti e tre i servizi che rispondono 429: **150 richieste
rifiutate** per sapere una cosa che il primo aveva detto alla prima.

Adesso c'è una pagella salvata (`CHIAVE_QUOTE_SALUTE`), che è la stessa cosa che
gli aerei ADS-B tengono da un pezzo e per la stessa ragione. Una porta che
risponde 429 **due volte di fila** finisce in castigo e da lì si salta senza
provarci; il castigo sopravvive alla ricarica. Due e non uno perché un 429
isolato può essere una raffica partita un attimo prima che il rubinetto si
stringesse, e un sì in mezzo azzera il conto — una fonte che risponde una volta
su due funziona piano, e le riserve vanno dieci volte più lente di lei (è la
misura che aveva fissato `TERRENO_NO_PER_CAMBIARE`, e resta valida). Se sono
chiuse **tutte**, non si bussa affatto e la riga di stato dice fra quanto si
riprova, invece di lasciare la coda appesa.

Misurato dopo, sullo stesso banco: **6 richieste**, poi **0**, poi **0** anche
ricaricando la pagina. E le strade buone non si sono mosse — tutto funzionante
25 richieste come prima, Open-Meteo chiusa 27 invece di 30, una richiesta su
quattro storta 33 come prima e nello stesso tempo.

### 3. I lampi radiali sul terreno

A occhio sembrano un dato sbagliato — una cresta impazzita, un settore di maglia
storto — e non lo sono affatto: sono **il fondo che si vede fra due colonne**.
Un buco largo mezzo pixel là dove il tratto non arriva a toccare quello accanto,
con sotto il fondo della fetta, che è più chiaro del terreno ombreggiato: un
filo chiaro lungo quanto la corsa di livello che lo affianca, cioè mezzo
schermo. Le cause sono due, misurate con un banco di disegno headless.

**(a) La larghezza di una colonna era un numero solo.** `focale · Δaz` è la
distanza fra due meridiani *al centro della vista*; ai bordi la stereografica
stira (`2/(1+d)`) e verso il nadir i meridiani convergono (`cos(alt)`). Il
rapporto fra la larghezza vera e quella disegnata va da 0,30 a 1,52 in un
riquadro da cento gradi, e arriva a 2,4 a centoventicinque — il pixel che si
aggiungeva non bastava. Ecco perché si vedevano solo a campo largo, solo verso i
bordi, e si spostavano appena si muoveva la camera: il posto in cui la
stereografica stira di più si sposta con lei. Il numero giusto la camminata ce
l'ha già (`ca / den`); una `stroke()` però ha una larghezza per tracciato, e
allora si quantizza in sette classi (`RIL_LARGHEZZE`) e ogni corsa finisce in
quella **appena più larga**.

**(b) Una corsa è una corda, il meridiano è un arco.** Le corse si rompono a
quote diverse in ogni colonna, quindi le corde di due colonne contigue sono
diverse e si aprono a ventaglio. Si chiude la corsa quando la freccia supera un
terzo di pixel (`RIL_CORDA_FRECCIA`), e non a una lunghezza fissa: le colonne
vicine al centro della vista sono dritte e non hanno niente da spezzare.

In coda, l'ancoraggio del capofila (`i0`) a un multiplo di `passo`, che è la
stessa cura già data all'acqua in `skyAcqueStrisce`.

Il costo non si muove: a sessanta gradi 11,1 → 11,7 ms sul banco headless (che
disegna via software, quindi sono millisecondi generosi).

## Il banco

1075 prove verdi, 5 rosse — **le stesse cinque di prima** (acque e rilievo,
§20/§25/§28), non toccate da qui. Nuove: §25 per i lampi radiali (con i due
contro-esempi del conto di prima) e §9 per la pagella delle porte.

`scripts/prova-nel-browser.js` non riporta errori in console. Due prove sue
fallivano già prima (Esc su due finestre). La terza — «il cielo gira fluido» —
è passata da 22 a 8 fotogrammi al secondo, e **non è una regressione**: quel
banco stubbava il CDN di Tailwind con una risposta vuota, quindi misurava una
pagina senza impaginazione. Provato: lo stesso codice di prima, servito con
`tailwind.css` vero, dà 9. La soglia di quella prova andrà rivista, perché
adesso misura una cosa diversa da quella che misurava.

## Intervento precedente

**Gli aerei ADS-B non arrivavano mai da un PC, ed erano cadute tutte e tre le
strade insieme.** La causa radice non è nel codice: il sito pubblicato ha
`window.ADSB_PROXY_URL = ''`, quindi restavano le quattro reti dirette — che da
un browser non si leggono mai — e i ponti CORS pubblici, che nella stessa
sessione hanno risposto 401 e senza `Access-Control-Allow-Origin`.

**Quello che resta da fare, e non è codice**: distribuire `worker-adsb.js` su
Deno Deploy e mettere l'indirizzo in `ADSB_PROXY_URL` (Settings → Secrets and
variables → Actions → **Variables**), poi rilanciare *Pubblica il sito*.
Finché quella variabile non c'è, gli aerei dipendono da due servizi di terzi
che oggi sono giù.
