# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 343 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

Resta rossa, ed era rossa anche prima, una prova di `scripts/prova-i18n.js`:
undici chiavi orfane (`visione.*`, `ui.fotocamera`, `ui.vai-al-mese` e altre
due), tutte fuori da Missione Cielo.

## Ultimo intervento completato

**Missione Cielo: i generi scelti entrano davvero nella caccia, e «un'altra
missione» fa vedere un'altra missione.**

La segnalazione era doppia — «se seleziono pianeti, costellazioni, stazioni
non vengono incluse» e «mostra sempre più o meno gli stessi elementi» — e le
cause erano cinque, tutte della stessa famiglia: **il filtro funzionava, il
mucchio che filtrava no**. Un filtro vale quanto vale il cielo su cui lavora,
e quel cielo era molto più piccolo di quanto sembrasse. Misurato da Como il 7
settembre, con tutte le scelte di serie: novantasette candidati raccolti,
**diciassette ammessi** — un pianeta, quattro stelle, quattro oggetti
profondi, otto figure — per quattro tappe. Non si sceglieva: si raschiava.

**Le stazioni non potevano comparire, mai.**
`missCandidatiAOrarioPreciso` c'era da sempre, era giusta, e **non la chiamava
nessuno**: `missScenario` raccoglieva il solo cielo fisso. Si accendeva la
casella «stazioni», si generava, e usciva la missione di qualcun altro o il
vuoto — che è il guasto peggiore che questo pannello possa avere, perché una
casella che non fa niente è indistinguibile da un cielo che non offre niente.
Sotto c'era un secondo strato, che sarebbe rimasto anche chiamandola: la
rimisurazione degli orari chiedeva ad `altAzCorpo` dove stia «sat-iss», che
non è un corpo della libreria, e il `catch` restituisce altezza −90. Il
raccoglitore trovava il passaggio e il primo riallineamento se lo mangiava, in
silenzio. Adesso un passaggio non si rimisura affatto — quella posizione l'ha
già calcolata `app.js` con SGP4, ed è quella del culmine — e col ramo cade
anche il crepuscolo, che per una stazione è esattamente il momento buono.

**Le stelle erano otto e le figure ventitré.** Gli otto slot `Star1…Star8` del
planetario e le figure che il planetario *disegna*: numeri giusti per un
disegno, sbagliati per una caccia. Tolto chi sta sotto l'orizzonte restavano
quattro stelle e otto figure. Adesso entrano le **stelle nominate del
catalogo** (`catVociElenco()`) e le **ottantotto figure IAU**
(`missFigureDelCielo`: le due tabelle si sommano, e dove il planetario ha la
figura si tengono i suoi dati, che portano la magnitudine vera e la maniglia).
Sessantuno stelle e diciannove figure ammesse invece di quattro e otto. Sono
tornate dentro anche le **comete**, che il genere «pianeti» dichiara e un
filtro di `missScenario` buttava via; e i cataloghi si chiedono aprendo la
finestra (`catCarica` in `missApriPannello`), perché a caricarli era solo
`apriSkymap()` — chi arrivava dalla dashboard senza essere mai passato dal
planetario accendeva «galassie» e riceveva il vuoto.

**Una tappa che non si può chiudere.** Il primo tentativo di allargare le
stelle pescava i vertici nominati delle figure, che nome e magnitudine ce
l'hanno. Misurato nel browser: di sessantuno bersagli così, **venti non si
potevano trovare** — toccandoli sulla mappa `catStellaNelPunto` non
riconosceva niente e la risposta cadeva sulla figura, cioè «no, non è questo».
In mezzo c'è la precessione: quelle coordinate sono J2000, il planetario le
disegna portate all'equatore di oggi e la missione le misura con
`altAzCoordinate`, che le prende per buone — **0,4 gradi**, invisibili in
cielo e tredici pixel sullo schermo, cioè più della finestra con cui si decide
di aver colpito una stella. Le stelle del catalogo sono invece lo stesso dato
che il planetario disegna e interroga, e `missSelezioneCorretta` per loro
confronta l'**indice** e non le coordinate: sessanta su sessantuno riconosciute
toccandole dove sono disegnate (la sessantunesima sta sotto l'etichetta del
nome della sua costellazione, che per scelta vince sempre). È il difetto
peggiore di tutta questa famiglia, perché chi non trova dà la colpa a sé.

**Il prezzo di aprire quella porta**, ed è il pezzo che a occhio non si vede
per quello che è: il terzo enigma generico delle figure dice «sono più antica
di ogni libro, sono servita a sapere quando seminare». Vero per le quarantotto
di Tolomeo, **falso** per la Macchina Pneumatica, che Lacaille ha messo in
cielo nel Settecento. Finché entravano solo le ventitré disegnate la domanda
non si poneva. `missFiguraAntica` legge il gruppo da `costellazioni.js` e chi
non è antica pesca due varianti invece di tre.

**E il pianeta che non cambiava mai.** Il posto riservato a un pianeta era un
obbligo, e la sera normale sopra l'orizzonte ce n'è uno: con un pool da un
elemento il sorteggio non sorteggia niente, e la penale dei recenti non poteva
morderlo. Quattro nomi nuovi e sempre Saturno. Adesso la riserva salta il
pianeta appena visto quando il resto del cielo basta; e per la stessa ragione
cede anche il **tetto della varietà** quando sotto di lui restano solo
bersagli già visti e fuori c'è ancora roba nuova — una famiglia rappresentata
tre volte si nota molto meno di una tappa che non cambia mai. Con «un'altra
missione» il tasto ricorda adesso **tre** anteprime e non l'ultima soltanto:
ricordarne una sola non è un ricambio, è un'altalena fra due liste.

E le penali sono diventate **due**, perché sono due frasi diverse. «L'ho visto
ieri sera» resta un piuttosto-no da trenta punti; «ho appena premuto un'altra
missione» è un no da settanta (`MISS_PENALE_RECENTE`, `MISS_PENALE_RIFIUTATO`).
Trenta punti bastano contro un bersaglio come tutti gli altri e non bastano
contro uno che il punteggio mette trenta punti sopra a tutti — che è il caso
normale quando in cielo c'è un pianeta solo. Non è però un'esclusione: se sono
penalizzati tutti la penale è una costante e sparisce dentro l'esponenziale,
cioè la missione si ripete invece di restituire il vuoto.

I numeri, misurati con cinque anteprime di fila: il bersaglio più ricorrente
era in **cinque su cinque** in tutti e sei i giri di prova, adesso al massimo
in quattro; i bersagli diversi passano da 9–12 a 13–15.

### Le prove aggiunte

`scripts/prova-missione.js` passa da 147 a 161. Nel motore: la stazione che
non si rimisura (e il crepuscolo che non la spegne), il pianeta scartato che
smette di essere in tutte le missioni, la figura moderna che non racconta la
bugia, e l'elenco vuoto delle figure senza cataloghi. Nella catena intera: che
ogni genere abbia **più bersagli di quante tappe ne servano** (si sceglie, non
si raschia), che un passaggio di stazione arrivi fino alla tappa, e il gesto
vero — «un'altra missione» premuto cinque volte, con il conto di quante volte
torna il bersaglio che torna di più. Tutte rosse sul codice di prima.

Restano rosse, ed erano rosse anche prima, `scripts/prova-fumetto.js` (quattro
prove sul codice di partenza, tre adesso: la fotografia di ripiego delle
stazioni e la fascia della barra del tempo) e il **cricchetto** di
`scripts/prova-lingua.js`, che chiede di abbassare il tetto della vista
Telescopio da 4 a 2 — cioè si lamenta di un miglioramento, e si riproduce
identico col file di Missione Cielo messo da parte. Nessuna delle due tocca
questo lavoro.

### Una prova che sperava invece di controllare

`scripts/prova-missione-interattiva.js` falliva due volte su nove, e non per
colpa del codice: `tapObject` sposta la vista di ventidue gradi e tocca dove
il bersaglio finisce, ma poco sopra la prova ha trascinato la striscia della
missione in mezzo al cielo — se il bersaglio le casca sotto, il clic lo prende
lei e la tappa resta in ricerca, che è il comportamento **giusto** dell'app.
Non falliva quasi mai perché dipende da dove sta il bersaglio di stanotte, e
il cielo più largo ha cominciato a pescarne di alti. Adesso il punto si cerca
(`document.elementFromPoint` su una scala di scostamenti) e si **dichiara**:
`sullaMappa`. Otto giri di fila verdi.
