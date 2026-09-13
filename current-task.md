# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 343 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni, gli avvisi del
planetario e le due righe di stato in fondo alla scena della vista 3D. Il
tetto è 352, che è il totale di adesso.

## Lo stato delle prove

Verdi: `prova-missione.js` **intero** (223), `--solo-motore` (158),
`prova-missione-stati.js`, `prova-missione-interattiva.js`, `prova-i18n.js`,
`prova-lingua.js`, `prova-stazioni.js`, `prova-guida.js`,
`prova-sistema3d.js`, `controlla-i18n.js --patto`, `controlla-collisioni.js`.

Le due prove di `prova-missione.js` che erano rosse da tempo perché
dipendevano dal cielo di stanotte adesso sono verdi, e non per fortuna: «un
passaggio di stazione arriva fino alla tappa» accende il solo genere
«stazioni», così l'unico modo di non trovarlo è che la catena sia rotta — che
è la domanda; e «le tappe rispettano davvero altezza e strumento» pretende
l'altezza da chi in cielo ci sta, invece che da tutti (un mondo lontano non
ne ha una, e chiedergliela vorrebbe dire trasformare la prova dell'orizzonte
in una prova che un genere non esista).

Rosse e **preesistenti**, verificate sull'albero pulito:

- `verifica.html`, cinque prove: le quattro del §20 sull'acqua e una del §28
  (`la camera insegue cinquanta metri di strada con dolcezza`). 1238 verdi.
- `prova-missione-interattiva.js` ha un punto che può diventare rosso a caso:
  il seme della missione è casuale, e quando la prima tappa capita essere un
  oggetto del cielo profondo la riga `point.selection.id` legge `undefined`
  (per un `profondo` la selezione è `{categoria, dati}` e un `id` non ce
  l'ha). Non c'entra coi mondi lontani: visto una volta su cinque prima e
  dopo.

## Ultimo intervento completato

**Missione Cielo: i mondi lontani, e la tappa che si gioca nel Sistema
Solare in 3D.**

La richiesta era in due righe: «metti negli indovinelli anche gli oggetti
mostrati nel sistema solare 3d; quando è un indovinello di questo genere
mostra a tutto schermo il sistema solare 3d, e poi passa al planetario quando
tocca ad esso».

Sono **sedici bersagli** — i quattordici mondi minori di `SOL_MONDI` e le due
Voyager — cioè quello che la vista 3D disegna oltre ai pianeti. Le comete e i
tre satelliti artificiali che quella scena mostra restano fuori di proposito:
ci sono già come corpi minori e come stazioni, cioè in due generi che li
fanno cercare **in cielo**, dove si vedono davvero.

Il genere nuovo si chiama `lontani` (tipo `mondo3d`) ed è l'unico la cui
caccia non si fa col naso all'insù: Plutone è di quattordicesima magnitudine,
Sedna di ventunesima, una Voyager non è nemmeno un oggetto astronomico — e
tutti e sedici stanno lì, al loro posto vero, in un disegno. Da lì viene il
resto: quando tocca a una di loro si apre il Sistema Solare in 3D a tutto
schermo, e quando tocca a una tappa del cielo si torna al planetario. Il
cambio di schermo non è un tasto: è una conseguenza di che natura ha la
tappa, e a saperlo è un posto solo (`missPortaAllaTappa`).

Le cose che valeva la pena scrivere, e che non si sarebbero viste guardando
lo schermo:

**Le domande del cielo non si fanno a chi in cielo non sta.** Niente altezza,
niente ostacolo dichiarato, niente crepuscolo, niente settore di orizzonte:
restano il genere e la difficoltà. È la stessa eccezione dei passaggi di
stazione spinta fino in fondo, e ha lo stesso rischio noto — una famiglia che
salta i filtri normali può passare da un filtro che non c'è — per cui il
genere resta il primo controllo e non l'ultimo.

**L'altezza che manca vale quattordici punti e non zero.** Zero sarebbe stato
trenta punti di svantaggio fisso: con la temperatura dei curiosi un peso
venti volte più piccolo, cioè un genere che si accende e non produce quasi
mai una tappa. Trenta avrebbe voluto dire che i mondi lontani battono sempre
tutto il resto. Quattordici è quanto vale un bersaglio a quaranta gradi: né
privilegiato né penalizzato per una grandezza che lì non esiste.

**Il salto fra i due schermi si dichiara** (`MISS_SALTO_SCHERMO`, più caro di
mezzo giro di orizzonte). Da lì, senza che nessuna riga lo chieda, le tappe
della vista 3D si raggruppano invece di alternarsi al cielo — se no una
missione da quattro sarebbe stata cielo, disegno, cielo, disegno, cioè
quattro cambi di vista in venti minuti.

**Il bersaglio si inquadra senza nominarlo.** Con Sedna a ottantacinque unità
astronomiche la vista d'ingresso lo lascerebbe fuori dallo schermo, cioè una
tappa che non si può chiudere; ma allargare la cornice scegliendo il corpo
(`sol.scelto`) aprirebbe la sua scheda, cioè stamperebbe la soluzione. Da lì
l'opzione `ua` di `solInquadraDaTerra`, che è la stessa cornice chiesta senza
scegliere niente. Per la stessa ragione il tocco sulla scena non apre più la
scheda durante una caccia: scartare Eris avendone letto il nome è comunque
mezzo enigma regalato.

**La striscia della missione era disegnata appena fuori dallo schermo**, ed è
il difetto che ha richiesto di misurare invece di guardare. Vive dentro a
`#skymap-contenitore` e la finestra 3D a tutto schermo ci passa sopra, quindi
va traslocata nel suo guscio; lì però `top` resta scritto come
`calc(var(--zona-alta-cielo) + 4px)`, e quella variabile è dichiarata su
`.vista-cielo`. Un `calc` con dentro una variabile che non risolve è
**invalido**: `top` ripiega su `auto` e la striscia scivola al suo posto nel
flusso — misurato, `top: 900px` su un riquadro alto 900. La classe `visibile`
c'era, il testo c'era, la missione funzionava, e sullo schermo non compariva
niente.

**E chiudere la finestra a metà caccia non lascia più una caccia aperta nel
cielo.** Sotto alla 3D c'è il planetario, e proseguire lì sarebbe stato il
difetto peggiore del pezzo, muto: i nomi degli astri spariscono (è il modo
caccia), la bussola si attacca al telefono, e ogni tocco conta come «no, non
è questo» contro un bersaglio che in cielo non c'è e non ci sarà. Si torna al
pannello, e il tasto che riapre la tappa dice dove porta — «cerca nel
Sistema Solare» e non «cerca nel cielo».

Il dizionario è cresciuto di centoventidue voci per lingua: un enigma, un
segno osservabile e due aneddoti per ognuno dei sedici, più la famiglia
intera (enigmi, seguiti, domande, specie, zone del disegno, il cartellino di
una sonda). Le zone prendono il posto del punto cardinale — lassù non c'è un
sud — e sono le quattro che la scena rende evidenti: la fascia fra Marte e
Giove, il tratto fra i giganti, l'anello di Kuiper, il vuoto che viene dopo.

Le prove: un §«i mondi lontani» nel motore (tredici prove, mezzo secondo) e
uno nel browser che gira **su tre schermi** — 900×900, 360×640 e 640×360 —
perché la colonna dei comandi della scena è alta duecentosettanta pixel e su
un telefono girato non ci sta niente sotto di lei: lì qualcosa si deve
sovrapporre, e quello che la prova pretende è che a vincere siano i tasti. Un
indizio coperto a metà si scorre; uno zoom coperto a metà è una caccia che
non si può più fare.

## Interventi precedenti

**La vista 3D si inchiodava avvicinandosi a un pianeta: quello che esce
dallo schermo adesso non si disegna.**

La segnalazione era «avvicinandomi alla Terra rallenta tutto, la camera e i
movimenti», ed è di quelle che a occhio non si giudicano: nessun fotogramma è
sbagliato, la scena è al suo posto, solo che ne arriva uno al secondo invece
di sessanta — e chi guarda dà la colpa al telefono.

Il conto che spiega tutto sta in due righe. Girando attorno a un corpo lo zoom
arriva a venticinquemila (`SOL_ZOOM_MAX_CORPO`) e `sol.scala` sale con lui:
una unità astronomica diventa più di un milione di pixel, e l'orbita di Sedna
— cinquecento unità astronomiche — una polilinea lunga **dieci milioni di
pixel** di cui sullo schermo non cade nemmeno un punto. Un tratto pieno il
rasterizzatore lo scarta in fretta; un tratto **tratteggiato** no: deve
generare i trattini uno per uno lungo tutta la corsa, e sono milioni.

Misurato in un Chromium su una tela da telefono, con la telecamera addosso
alla Terra: il fotogramma passava da 63 a **1081 millisecondi**, e a farlo
erano quattordici ellissi di mondi minori che non si vedevano affatto. La
cura è `solTagliaSegmento` / `solPolilineaInVista` (§7.7 di `app.js`,
Liang–Barsky): ogni segmento si taglia al riquadro prima di entrare nel
tracciato, e quello che cade fuori non ci entra. Ci passano le orbite dei
mondi minori e dei pianeti, il pavimento, i nodi, i fili a piombo, il filo
delle sonde, la riga dello sguardo e il filo fra la Terra e la Luna.

Due ritocchi in più sul globo terrestre, che è quello che restava: il
riflesso del Sole sull'acqua e il velo d'aria si dipingevano su tutto il
quadrato del globo mentre le loro sfumature finiscono molto prima — un
cerchio e un anello al posto di due riempimenti pieni, sei volte e quattro
volte meno superficie, e **gli stessi pixel** (provato).

Numeri veri, fotogramma mediano su una tela da telefono (412×900 a 2,5×):

| scena | prima | dopo |
|---|---|---|
| vista d'insieme | 16,7 ms | 16,6 ms |
| Terra, zoom 1000 | 638 ms | 30 ms |
| Terra, zoom 6000 | 1106 ms | 26 ms |
| Terra, zoom 25000 | 166 ms | 22 ms |
| Marte, zoom 25000 | 146 ms | 21 ms |

Prove nel **§33** di `verifica.html` (quattordici, tutte verdi). Non misurano
il tempo — un banco di prova non è un cronometro — ma l'aritmetica da cui
quel tempo dipende: che quello che non si vede venga tagliato davvero, che il
pezzo tagliato stia sulla stessa retta e dentro al riquadro, che una curva
spezzata dal bordo non diventi una corda tirata da un capo all'altro dello
schermo, e che il filtro delle due passate (davanti al Sole e dietro) resti
quello di prima. `prova-sistema3d.js` resta verde, e il confronto pixel fra
prima e dopo dà zero differenze sulle orbite.

## Intervento precedente

**La vista 3D allargata: i mondi minori, le sonde, i satelliti — e una
ricerca che parla la lingua scelta.**

La scena aveva otto pianeti e la Luna, e tre cose le mancavano. I **mondi
minori**: la fascia di Kuiper era un pulviscolo anonimo, e i suoi abitanti con
un nome — Plutone, Eris, Makemake, Haumea, Gonggong, Quaoar, Sedna, Orco — non
c'erano, come non c'erano Cerere e i tre asteroidi che nell'Ottocento erano
considerati pianeti, né le comete che si vedono stasera. Le **Voyager**, che a
vederle si capisce una cosa che scritta non si capisce: non se ne vanno «verso
fuori» lungo il piano, se ne vanno una trentacinque gradi sopra e una
quarantotto sotto, ed è il racconto di due fionde. E **ISS, Tiangong e
Hubble**, che sono gli unici oggetti lassù costruiti da noi.

Tre scelte da conoscere prima di metterci mano. Gli asteroidi che
`dati-corpi-minori.js` conosce leggono gli elementi **da lì** e non se ne
portano una copia: due copie della stessa orbita divergono al primo
aggiornamento, e lo stesso corpo finirebbe in due posti diversi a seconda della
vista che lo disegna. La distanza dei satelliti dalla Terra è **esagerata**
come quella della Luna (a quattrocento chilometri stanno dentro al pallino
azzurro): quello che resta vero è la direzione, l'ordine delle quote e
l'inclinazione del piano — 51,6° per la ISS, 28,5° per Hubble, che è la cosa
che si vede. Le Voyager sono una **retta** da un'epoca dichiarata, e a
centocinquanta unità astronomiche è quasi esattamente quello che fanno.

La **ricerca** era l'altra metà, ed era rotta in inglese: i nomi venivano da
una tabella italiana scritta a mano e i suggerimenti da un `<datalist>` scritto
a mano nell'HTML, quindi si leggeva «Mars» sulla scena, si scriveva «Mars» nel
campo e la risposta era «elemento non trovato». Adesso i nomi vengono da dove
vengono per la tela (`nomeCorpo`, le chiavi `corpo.<id>`), i suggerimenti si
rifanno al cambio lingua, si accettano tutte le lingue e mezzo nome basta.
Con lei sono passate al dizionario la scheda del corpo scelto, i suoi tre
tasti e il formato dei numeri, che era cablato a `it-IT`: l'audit scende da 358
a 352.

Prove nuove in `scripts/prova-sistema3d.js` (52, tutte verdi), col
contro-esempio della conversione all'eclittica mancata: senza, l'anello della
ISS risulta inclinato di settanta gradi e mezzo invece di cinquantuno, e sullo
schermo è un anello perfettamente plausibile.

**Le etichette dei grafici, e il punto cieco che le nascondeva.**

I due dizionari erano già in parità (3.704 chiavi ciascuno, nessun segnaposto
incoerente, nessun residuo italiano nel file inglese), ma `controlla-i18n.js`
non ispezionava affatto `fillText`/`strokeText`: era nato per il **documento**
— `innerHTML`, `textContent`, `title` — mentre il planetario e gli otto banchi
della Didattica scrivono mezza interfaccia sulla tela, senza passare da nessun
nodo. Quelle parole non le aveva mai lette nessuno.

Diciannove etichette restavano quindi in italiano a lingua inglese, e il
sintomo non è un errore ma un'**incoerenza**: l'asse del grafico di Keplero
diceva «0.39 AU → 88 giorni», col numero già nel formato inglese e le parole
ancora in italiano, dentro a un banco per il resto tradotto. Chi guarda non lo
legge come un pezzo dimenticato — lo legge come una traduzione fatta male.

Tradotte: l'asse e la terza legge di Keplero (UA/AU, giorni e anni col plurale
di `Intl.PluralRules`, l'abbreviazione dell'anno), «l'altro fuoco: vuoto», le
due righe della fionda vista dal Sole, la «Terra» della finestra di lancio
(che adesso viene dal getter di `CORPI`), sei etichette del banco delle aurore
(vento solare, i due ovali, le ore magnetiche, il naso della magnetopausa,
«sotto l'orizzonte»), le tre del tramonto che si toccano col dito («sei qui»,
«gira così», «trascinami»), l'«eclittica» e l'«analemma» del planetario, il
«Sei qui» del globo in 3D, l'avviso della posizione disegnato sulla tela e la
firma «Da {luogo}» della cartolina. In più i due numeri scritti a mano con la
virgola italiana («8,4 km», «100 km») passano da `num()`, che è locale-aware.

La parte che dura è `analizzaTela()`: una **seconda passata** sugli stessi
file con una regola più severa — in un grafico una parola letterale è sospetta
per definizione, e si toglie solo ciò che parola non è (colori, parole chiave
del canvas, chiavi del dizionario, nomi dei corpi che la libreria vuole in
inglese, simboli delle unità, il marchio). Tre cose non sono dettagli: le
chiamate di disegno vanno a capo, quindi si bilanciano le parentesi invece di
leggere la riga; dentro a un template si guardano anche i letterali annidati
nelle `${…}`, ed è lì che stavano « giorni» e « anni»; e un letterale a destra
di un confronto (`stato === 'fallito'`) è uno stato e non una parola.

Il rilevatore è stato provato al contrario: rimettendo due etichette com'erano
le ritrova entrambe, e col codice corretto risponde zero. Il totale dell'audit
resta 353, cioè le tele non hanno alzato il conto di una riga.


**Il telescopio spaziale Hubble nel cielo e negli appuntamenti.**

Hubble è ora il terzo grande satellite seguito insieme a ISS e Tiangong: il
suo TLE Celestrak alimenta posizione, traccia, passaggi visibili, eventi,
ricerca del planetario, scheda fotografica, transiti davanti a Sole e Luna e
tappe di Missione Cielo. Sul planetario ha un modellino riconoscibile col tubo
e le due ali solari; il repertorio della missione gli dedica inoltre tre
curiosità in italiano e inglese. La guida e le prove che prima fissavano
l'elenco a due oggetti dichiarano adesso tutti e tre.

Le prove mirate sono `scripts/prova-stazioni.js` e
`scripts/prova-transiti.js`; richiedono Playwright, Astronomy Engine e
satellite.js installati localmente.

## Intervento di due giri fa

**Galleria: autorizzazione della cartella ricordata e video orizzontali a
schermo intero.**

Il permesso ottenuto dal selettore ora resta memorizzato per la sessione: il
timer di sincronizzazione non chiama più `queryPermission()` ogni due secondi
e un handle recuperato da IndexedDB viene verificato una volta sola. Ogni
lettore ha inoltre un comando «Schermo intero» che porta direttamente il video
nel fullscreen nativo, usa `webkitEnterFullscreen()` su iPhone e dispone di un
ripiego CSS chiudibile per i browser senza API.

La prova mirata è `node scripts/prova-galleria.js`; controlla anche che il
comando richieda il fullscreen al lettore e che le verifiche del permesso non
si moltiplichino durante la sincronizzazione.

## Intervento ancora precedente

**La guida all'uso, e la linguetta delle Impostazioni che la apre.**

`guida.html`: una pagina sola, fuori dall'app, con tutte le funzioni spiegate
una per una — cos'è l'app, i sette passi del primo accesso, le sette viste, il
planetario a fondo, il paesaggio (terreno, rilievo, acque, aurore, Via Lattea,
costellazioni), aerei e transiti, Missione Cielo, il telescopio, gli otto
banchi della Didattica, impostazioni e backup, la tabella di cosa resta senza
rete, gesti e scorciatoie, i guasti e un glossario.

Tre decisioni che vale la pena avere scritte, perché sono tutte e tre scelte e
non ripieghi.

**Una pagina nostra e non un link a un servizio esterno.** Un indirizzo altrui
invecchia, non entra nella cache del service worker e la sera in cui serve —
al buio, senza campo, quando non ci si ricorda come si tara la bussola su un
astro — non si apre. `guida.html` sta in `ASSETS` di `sw.js` (e `CACHE_NAME` è
salito a `astrocal-v309`) e fra i file che il workflow pretende: un link dalle
impostazioni che dà 404 non fallisce, porta a una schermata bianca.

**Non carica `style.css`.** Là dentro ci sono novemila righe scritte per
un'interfaccia — griglie, pannelli, mappe — che con un documento da leggere
litigherebbero. Quello che serve è la tavolozza, e quella è **ricopiata** dal
blocco `:root`, con l'avvertimento in chiaro: è una copia, e il giorno che
diverge non lo dice nessuno. Il tema è solo scuro, come l'app.

**La linguetta non ha richiesto una riga di JavaScript.** `mostraTab` in
`inizializzaImpostazioni` scorre `[data-imp-tab]` e `[data-imp-pannello]` letti
dal documento: una linguetta nuova è markup più dizionari. Undici chiavi nuove
in `lingue/it.js` e `lingue/en.js`, infilate in ordine alfabetico come le altre.

La prova è `scripts/prova-guida.js`, e guarda le due cose che a occhio non si
giudicano: che ogni **ancoraggio** promesso dalle cinque scorciatoie esista
davvero dentro alla guida (chi rinomina una sezione là dentro rompe qui, in
silenzio), e la **geometria a 360 px** — le linguette sono diventate quattro e
la finestra su un telefono è stretta, mentre gli altri banchi girano a 900,
dove tutto ci sta comunque.

Resta da fare: **la guida è in italiano soltanto**, e il pannello lo dichiara
(`ui.guida-lingua-nota`). La versione inglese è lavoro a parte.
