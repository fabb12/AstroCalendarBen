# Missione Cielo: osservare, cercare, scoprire

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

## Contenuti e aiuti

- **Insegnami il cielo:** introduzione osservativa, spiegazione scientifica,
  curiosità legata al bersaglio e domanda di confronto.
- **Fammi una sfida:** identità nascosta, indizi di direzione, altezza,
  aspetto e riferimenti realmente visibili. Il nome compare alla scoperta
  o con una richiesta separata di aiuto avanzato.
- **Sono con bambini:** avventura breve, domande semplici e alternanza di
  scienza, miti e storia umana, presentati esplicitamente come tali.

Il nome resta nascosto in anteprima, riepilogo della missione in corso,
etichette del cielo e audio di ricerca. L’elenco degli astri è sospeso durante
la ricerca. “Guidami” aumenta la precisione senza selezionare o centrare il
bersaglio. “Rivela il nome” appare solo dopo tre aiuti e non completa la tappa.
I riferimenti vicini vengono ricalcolati per l’istante attuale usando la
distanza sferica; la destra e l’alto del mirino usano la base della camera.

Ogni generazione ha un seme; oggetti e ordine variano entro i vincoli di
visibilità, difficoltà e strumento. Le varianti di testo restano stabili
nella sessione. La cronologia locale evita gli oggetti della sessione appena
avviata quando ci sono alternative e ruota racconti e domande per ciascun
oggetto. Un cielo povero può comunque riproporre bersagli già incontrati.

## Tempo, posizione e ripresa

Le posizioni vengono verificate anche agli orari assegnati, non soltanto al
massimo di altezza nella finestra. La ricerca usa il tempo reale e torna al
luogo di casa dell’app. Un tocco a un’ora simulata, in un altro luogo, durante
il giorno (salvo la Luna) o su un bersaglio dietro l’orizzonte non vale come
ritrovamento. Se il bersaglio non è più disponibile, si può sostituire o
saltare senza assegnare un successo.

Gli eventi astratti del calendario e i corpi minori con coordinate campionate
restano nel pianificatore; le missioni interattive selezionano Luna, pianeti,
stelle, costellazioni e cielo profondo identificabili nel planetario.

Lo stato salvato passa alla versione 3; le vecchie missioni attive vengono
rigenerate. Il Diario precedente rimane leggibile. Le nuove osservazioni
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
