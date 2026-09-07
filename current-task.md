# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 353 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

## Ultimo intervento completato

**Missione Cielo: narrazione naturale con Edge-TTS.**

La scelta vocale della missione ora prova prima un endpoint HTTP Edge-TTS
configurabile (`EDGE_TTS_API_URL`), con `it-IT-ElsaNeural` in italiano ed
`en-US-AriaNeural` in inglese. Il ponte può restituire audio binario, un URL o
base64; se manca o fallisce resta il ripiego Web Speech del dispositivo, così
la missione continua a parlare anche offline. Una risposta lenta viene
invalidata al cambio tappa e chiudere il pannello ferma ogni audio.

Il workflow Pages legge la variabile Actions `EDGE_TTS_API_URL`, ne pretende
un URL HTTPS e la inietta nel `config.js` pubblicato. Il contratto del ponte è
documentato in `EDGE-TTS.md`; nessun segreto va nella PWA statica.

Prove eseguite: motore Missione (47/47), patto i18n, collisioni globali,
controlli sintattici e `git diff --check`. Le prove browser complete non sono
partite perché in questo contenitore manca `playwright-core`.

## Intervento precedente

**Missione Cielo: la serata come percorso, non come elenco.**
Richiesta: «trasforma i dati che l'app ha già in una breve esperienza guidata —
dimmi quanto tempo hai, con cosa osservi e che esperienza desideri, e l'app
prepara una sequenza concreta di oggetti e ti accompagna a trovarli in cielo».

### 1. Il difetto, detto in una riga

La dashboard sapeva già dire **cosa** vale la pena guardare stanotte
(`migliorDiStanotte`: dieci righe ordinate per merito, ognuna coi suoi
motivi). È la risposta giusta a «cosa c'è», e non è la risposta a un'altra
domanda — quella che uno si fa in cortile con la giacca addosso: **ho venti
minuti, da dove comincio?**

Un elenco non risponde perché non ha un ordine di **esecuzione**. Dice che M13
vale 82 e Giove 79, e lascia a chi legge tre lavori: scegliere, mettere in fila
e trovare. Il primo si fa male al buio, il secondo non si fa affatto, il terzo
è quello che fa rientrare in casa.

### 2. La cura: un modulo nuovo, in due metà

`missione-cielo.js` (~2.100 righe, prefisso `miss`), caricato dopo
`eventi-extra.js` e prima di `ui-nuova.js`. Il file è diviso in due, e non è
un vezzo:

- **il motore (§2) è in funzioni pure**: riceve uno «scenario» — l'istante, i
  candidati già misurati, le tre scelte, le condizioni — e restituisce una
  missione, senza toccare né il documento né l'orologio né la rete;
- **il raccoglitore (§3)** è l'unico pezzo che va a chiedere al resto
  dell'app, e non ricalcola niente: i bersagli sono quelli di `pianBersagli`,
  le posizioni quelle di `altAzCorpo`/`altAzCoordinate`, il buio quello di
  `finestraBuio`, il terreno quello di `terrenoAltezza`.

Il taglio esiste per una ragione misurabile: il difetto tipico di questo pezzo
non è un pixel storto, è **una tappa impossibile che sullo schermo sembra
ragionevole**. Cinque righe con un nome, un'ora e una direzione sembrano
sensate comunque — anche se la terza sta sotto l'orizzonte. Quello si prende
solo con uno scenario di cui si conosce la verità, e per farlo ci vuole un
motore che non abbia bisogno di un browser.

### 3. Le regole che fanno di una lista una sequenza

Il punteggio è pesato dall'**esperienza scelta**: la stessa difficoltà vale
−14 punti per chi è coi bambini e +4 per chi ha chiesto una sfida. Poi vengono
tre regole che un ordinamento per merito non ha:

- la **varietà** (due per famiglia; la Luna e i pianeti sono una famiglia sola
  agli occhi di chi guarda);
- la **continuità** (girarsi di centottanta gradi al buio vuol dire perdere
  l'adattamento e il riferimento da cui si era partiti);
- la **progressione**, che vale più di tutte: la prima tappa non è la
  migliore, è **la più facile fra le buone**. Chi trova la prima cosa in venti
  secondi cerca la seconda con pazienza; chi non trova la prima, in venti
  secondi ha già deciso che l'app non funziona.

Le tappe si dicono a parole — direzione cardinale, «basso sull'orizzonte» /
«a metà cielo» / «molto in alto», e un riferimento luminoso da cui partire
misurato in **dita e pugni a braccio teso**. Ascensione retta e declinazione
non compaiono: sono le coordinate giuste per una montatura e quelle sbagliate
per un paio d'occhi.

### 4. I tre difetti trovati misurando, che a occhio non si vedevano

1. **`missScartoAzimut` misurava dalla parte lunga.** Valore assoluto preso
   *prima* di riportare la differenza dentro a [-180, +180]: fra 350° e 10°
   rispondeva centosessanta invece di venti, e ogni riferimento a cavallo del
   nord veniva scartato per «troppo lontano».
2. **Vega e la Lira nella stessa missione.** Non lo prende nessuna delle altre
   regole — sono due famiglie diverse per il tetto della varietà, e stando a
   pochi gradi la continuità le premia — ma sono due tappe su cinque per lo
   stesso pezzo di cielo: trovata Vega, la Lira è già lì. Ci pensa
   `missDoppione`, che vale anche per il riferimento («parti dalla Lira per
   trovare Vega» è un cerchio).
3. **«Inizia adesso» alle due del pomeriggio.** L'anteprima si costruisce per
   l'ora consigliata (il crepuscolo) e «adesso» vuol dire adesso: fra le due
   può esserci mezza giornata, e spostare gli orari e basta dava Vega a
   ottantatré gradi in pieno sole. Oltre venti minuti di scarto le tappe si
   scelgono da capo per l'istante vero di partenza.

E due cose viste solo negli scatti: la frase «Si comincia alle 18:57. e non
c'è Luna a dare fastidio» (una subordinata dopo un punto, quando il meteo non
è arrivato) e «1 minutes from Como, With the naked eye» — un plurale mancante
e un'etichetta da tasto finita in mezzo a una frase.

### 5. Quello che non si tocca

Il Diario resta uno solo: una missione ci entra come **una voce sola** con un
campo `missione` che le voci vecchie non hanno, e chi disegna guarda quel
campo per decidere. Il planetario resta uno solo: «Guidami» apre **quello**,
con l'orologio sulla tappa e la vista sul bersaglio, e ci appoggia sopra una
striscia con due tasti. Nessuna dipendenza nuova, nessun bundler, nessun
backend.

### 6. Provato

- `node scripts/prova-missione.js` — **74 prove, tutte verdi**: 42 sul motore
  senza browser (durata, strumento, orizzonte, ostacoli dichiarati, varietà,
  progressione, orari, cielo povero, assenze, persistenza, dati malformati) e
  32 in un Chromium vero (scheda, tre domande, generazione con dati veri,
  aiuto a tre gradini, sostituzione, ponte col planetario e ritorno, cambio
  lingua a missione aperta, conclusione, Diario, ripresa dopo un
  ricaricamento).
- `node scripts/controlla-i18n.js --patto`: **362**, invariato — il modulo
  nuovo ha **zero** stringhe cablate e la vista Stasera resta a zero.
- `node scripts/controlla-collisioni.js`, `node scripts/prova-lingua.js`,
  `node scripts/prova-stazioni.js`, `node scripts/prova-galleria.js`: verdi.
- `prova-i18n.js`, `prova-nel-browser.js`, `prova-verifica.js`,
  `prova-fumetto.js`, `prova-transiti.js`: **stesse identiche prove rosse di
  prima dell'intervento**, misurate sul commit di partenza. Nessuna
  regressione, e nessuna delle preesistenti mascherata.
- Scatti su 360×640, 640×360 e 1280×800, in italiano e in inglese: nessuna
  barra orizzontale, nessuno sbordo, testo mai sotto i 12,3 px, tasti a 44 px.
- `CACHE_NAME` portato a `astrocal-v282`.

### 7. Da sapere, se ci si torna

I 44 px dei tasti hanno richiesto una riga contro una regola generale
dell'app: sul telefono c'è un pavimento a 38 px per tutti i tasti
(`body button:not(…)` in `style.css`) che vince per specificità e schiacciava
il nostro minimo. Missione Cielo è stata aggiunta alla lista delle esclusioni
di quella regola, che è la stessa da cui erano già fuori i comandi del cielo —
e per la stessa ragione: si toccano al buio, in piedi, con la stessa mano che
tiene il telefono.
