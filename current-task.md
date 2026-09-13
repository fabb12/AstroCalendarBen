# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 343 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni, gli avvisi del
planetario e le due righe di stato in fondo alla scena della vista 3D. Il
tetto è sceso a 352, che è il totale di adesso.

Le **scritte sulla tela** invece sono a zero, e adesso c'è chi le guarda: vedi
l'ultimo intervento qui sotto.

## Lo stato delle prove

Verdi: `prova-missione.js --solo-motore` (144), `prova-missione-stati.js`,
`prova-missione-interattiva.js`, `prova-i18n.js`, `prova-lingua.js`,
`prova-stazioni.js`, `prova-sistema3d.js` (52), `controlla-i18n.js --patto`,
`controlla-collisioni.js`.

Rosse e **preesistenti**, verificate sull'albero pulito:

- `prova-missione.js`, due prove che dipendono dal cielo di stanotte — «un
  passaggio di stazione arriva fino alla tappa» e «le tappe rispettano davvero
  altezza e strumento» (Urano vuole il telescopio). 192 passate, 2 fallite.
- `verifica.html`, cinque prove: le quattro del §20 sull'acqua e una del §28
  (`la camera insegue cinquanta metri di strada con dolcezza`).

## Ultimo intervento completato

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
