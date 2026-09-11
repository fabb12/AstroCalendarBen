# Missione Cielo: osservare, cercare, scoprire

Quando almeno un pianeta è visibile, compatibile con il percorso scelto e
nel settore di cielo indicato, la missione gli riserva una tappa. La Luna resta
un bersaglio distinto: non prende il posto del pianeta in questa regola. Fra i
pianeti disponibili viene scelto quello col punteggio migliore per quella
serata; le altre tappe continuano a seguire le normali regole di varietà.

“Preparami la serata” riutilizza `pianBersagli`, i cataloghi del planetario,
`altAzCorpo`, `altAzCoordinate`, l’orizzonte dichiarato/misurato e il sistema
esistente di orientamento. Non aggiunge un secondo planetario o un secondo
motore di effemeridi.

Il percorso è ricerca → indizi → tocco dell’oggetto → scoperta → osservazione
facoltativa → tappa successiva. Il tocco viene intercettato nell’hit test del
canvas prima della selezione normale, del fumetto e dell’atlante. Un oggetto
sbagliato aumenta l’aiuto; soltanto quello corretto registra `trovato`.
Le costellazioni si riconoscono toccando le linee della figura. L’hover non
conferma ritrovamenti. La mappa non può verificare che una persona abbia
guardato fisicamente il cielo: verifica la selezione nella scena corrente.

## Le due modalità, i contenuti e gli aiuti

- **Adulti:** identità nascosta ed enigmi difficili, con indizi di direzione, altezza,
  aspetto e riferimenti realmente visibili. Il nome compare alla scoperta
  o con una richiesta separata di aiuto avanzato.
- **Bambini:** enigmi più facili, domande semplici e alternanza di
  scienza, miti e storia umana, presentati esplicitamente come tali.

Ogni tocco dà subito un riscontro breve: corretto, errato oppure vicino al
bersaglio. Il riscontro scompare da solo e non sostituisce né allunga l’indizio
principale. Un errore non svela automaticamente un aiuto ulteriore.

Quando il bersaglio è corretto, entrambe le modalità raccontano sempre un
aneddoto, una leggenda o un fatto legato proprio all’astro; parole e domande
sono adattate all’età scelta.

Il nome resta nascosto in anteprima, riepilogo della missione in corso,
etichette del cielo e audio di ricerca. L'elenco degli astri è sospeso durante
la ricerca. Anche i nomi delle montagne vengono nascosti per tutta la modalità
di gioco nel planetario, scoperta compresa, senza cambiare la preferenza del
planetario; ricompaiono quando si esce dal cielo della missione. La guida
presenta tre indizi in tutto, ciascuno più preciso del precedente;
subito dopo il terzo compare “Mostra la soluzione”, che rivela il nome e centra
il bersaglio nel planetario senza completare la tappa.
Se nella preparazione è stata scelta la voce, ogni indizio viene letto quando
compare, anche navigando avanti e indietro fra quelli già ottenuti. Al tocco
del bersaglio corretto viene letto automaticamente anche il messaggio finale
di scoperta.
I riferimenti vicini vengono ricalcolati per l’istante attuale usando la
distanza sferica; la destra e l’alto del mirino usano la base della camera.

Ogni generazione ha un seme; oggetti e ordine variano entro i vincoli di
visibilità, difficoltà e strumento. Anche nella modalità sfida la difficoltà
resta intermedia, mentre per i bambini entrano soltanto bersagli facili. Gli
enigmi mescolano una traccia fantasiosa con un aspetto realmente osservabile
(colore, sagoma o disposizione), senza promettere i colori delle fotografie.
Le costellazioni del repertorio hanno due indovinelli propri, alternati fra
una missione e l’altra, così una figura già incontrata non si presenta sempre
con le stesse parole.
Le varianti di testo restano stabili nella sessione. La cronologia locale
evita gli oggetti delle ultime tre missioni quando ci sono alternative, ruota
racconti e domande per ciascun oggetto e non ripete la stessa domanda per due
astri della stessa famiglia nella medesima missione. Un cielo povero può
comunque riproporre bersagli già incontrati, invece di inventarne di invisibili.

## Tempo, posizione e ripresa

Fra le durate è disponibile anche **Tutta la notte**. Se la prima tappa
realmente osservabile cade più tardi dell'inizio della finestra, l'anteprima e
il planetario partono direttamente dall'orario della tappa, senza mostrare ore
di cielo precedente in cui il bersaglio non è ancora visibile.
Se durante una ricerca l'astro non è disponibile nell'istante mostrato, la
guida propone **Vai alle…**: il comando porta direttamente il planetario al
primo momento utile e sostituisce il vecchio invito ad abbandonare la serata.

Le posizioni vengono verificate anche agli orari assegnati, non soltanto al
massimo di altezza nella finestra. Per ogni bersaglio la magnitudine limite
del luogo viene corretta in base alla sua altezza. La pianificazione usa sempre
la massima quantità di stelle (cielo Bortle 2) e non mostra l'inquinamento
luminoso come parametro nell'anteprima o nei dettagli. Quando la missione entra
nel planetario accende per impostazione iniziale tutte le famiglie di astri e
mostra il catalogo stellare come da un cielo Bortle 2, senza cambiare il cielo
di casa salvato. Nella preparazione si scelgono invece una o più famiglie da
includere (Sistema solare, stelle, cielo profondo, costellazioni e stazioni);
la domanda sullo strumento di osservazione è stata rimossa.
Verso l'orizzonte la massa
d'aria abbassa il limite e schiarisce il fondo. Gli oggetti del cielo profondo
passano inoltre un controllo sulla brillanza superficiale e sul contrasto con
il fondo locale; da un cielo urbano troppo inquinato non vengono proposti,
neppure con un telescopio, mentre Luna, pianeti e stelle compatibili con la
magnitudine limite restano disponibili. La ricerca usa il tempo reale e torna al
luogo di casa dell’app. Un tocco a un’ora simulata, in un altro luogo, durante
il giorno (salvo la Luna) o su un bersaglio dietro l’orizzonte non vale come
ritrovamento. Se il bersaglio non è più disponibile, si può sostituire o
saltare senza assegnare un successo.

Gli eventi astratti del calendario e i corpi minori con coordinate campionate
restano nel pianificatore; le missioni interattive selezionano Luna, pianeti,
stelle, costellazioni e cielo profondo identificabili nel planetario.

Lo stato salvato passa alla versione 12; le vecchie missioni attive vengono
rigenerate, così ereditano subito i nuovi limiti di difficoltà. Il Diario precedente rimane leggibile. Le nuove osservazioni
sono salvate nella sessione e incluse nel Diario, insieme agli aiuti usati.
La fase di scoperta sopravvive a una ricarica senza saltare alla tappa seguente.

## Segui telefono

Una lettura valida con riferimento al Nord attiva automaticamente il controllo
esistente. Dopo una scelta manuale dell’utente non viene riattivato di continuo.
Assenza, perdita o rifiuto dei sensori lascia disponibile l’esplorazione con il
dito. Su iOS resta il consenso di sistema tramite il comando esistente: i
permessi di orientamento richiedono un gesto dell’utente.

Riferimenti tecnici: [Device Orientation, W3C](https://www.w3.org/TR/orientation-event/)
e [permesso di orientamento, MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static).
Il materiale sul colore e sulla temperatura stellare è coerente con
[Star Types, NASA](https://science.nasa.gov/universe/stars/types/).

## Verifica

```sh
npm install --no-save --package-lock=false playwright@1.58.2 astronomy-engine@2.1.19
npx playwright install chromium
node scripts/prova-missione.js --solo-motore
node scripts/prova-missione-stati.js
node scripts/prova-missione.js
node scripts/prova-missione-interattiva.js
node scripts/controlla-collisioni.js
```

`prova-missione-stati.js` usa le funzioni astronomiche reali con una posizione
e una notte controllate; copre anonimato, selezioni errate/corrette, orario,
luogo, orizzonte, persistenza, contenuti nelle due lingue e sensori simulati.
`prova-missione-interattiva.js` usa Chromium e tocchi sul canvas a dimensioni
telefoniche. Il workflow `Verifica Missione Cielo` esegue anche la regressione
del pannello, del Diario e della ripresa.

Prima del rilascio resta necessaria una prova su telefono fisico per accuratezza
della bussola, permesso iOS e orientamento in verticale/orizzontale.
