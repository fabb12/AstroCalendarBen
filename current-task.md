# Compito in corso

Questo file non è documentazione del progetto (quella è `CLAUDE.md`): è
l'appunto di **cosa si sta facendo adesso**. Serve a chi riprende una sessione
— umano o Claude — per non dover rileggere la chat né riesplorare il codice da
zero solo per capire a che punto si era rimasti. Non fa build, non viene
pubblicato (`pubblica.yml` lo esclude come CLAUDE.md), e non ha una struttura
fissa: basta che dica *cosa*, *a che punto* e *cosa manca*.

**Convenzione**: a inizio di un compito nuovo si riscrive da capo (non si
accumula la storia — quella sta nei commit). A compito finito e pubblicato si
lascia una riga sola: «Niente in corso». Le spunte `[x]`/`[]` sono lo stato,
non un verbale.

---

## «Il servizio delle quote è sovraccarico (429)» — fatto

Aprendo il planetario, spesso l'orizzonte restava quello disegnato e sotto
c'era scritto: *«Non sono riuscito a prendere la forma del terreno: il
servizio delle quote è sovraccarico (429)»*. Era il messaggio più frequente
di tutta l'app.

Le difese c'erano già — riprovare tre volte, non far cadere le altre
richieste, dire il perché — ma erano tutte dentro alla stessa idea: *insistere
con lo stesso servizio, allo stesso ritmo, ricominciando da capo*. E quella è
esattamente l'idea che un 429 sta contestando. Adesso ce ne sono quattro
nuove, tutte in §4 di `terreno.js`.

- [x] **Il rubinetto** (`terrenoInFila`, `terrenoRubinetto`, `terrenoFrena`,
      `terrenoScorre`). Quattro richieste partivano nello stesso istante:
      una raffica. Adesso ogni fonte ha una coda sola che le spazia e conta
      quante ne sono in volo; a ogni no il passo raddoppia e una richiesta si
      toglie dal volo, a ogni fila di sì si riapre piano. Un 429 rallenta
      **tutte** le richieste di quella fonte — prima le altre venti
      continuavano a bussare mentre la prima aspettava.
- [x] **Tre porte invece di una** (`TERRENO_FONTI`). Open-Meteo,
      OpenTopoData, Open-Elevation: stesse colline, modelli e host diversi,
      niente chiave per nessuno. `terrenoQuoteInsistendo` le gira tutte, e
      quella che risponde diventa quella di adesso anche per le richieste
      successive: la fonte satura si paga una volta sola, non ventiquattro.
      Nel service worker i due host nuovi sono trattati come le quote di
      casa: tenuti in cache, e fuori dal ripiego che serve `index.html`.
- [x] **Quello che arriva si tiene** (`avute`, `terrenoDaRiprendere`,
      `terrenoRichieste(lat, lon, sapute)`). Il giro grosso si salva appena
      arriva, con dentro *quali* direzioni sono misurate davvero; il
      tentativo dopo riprende da lì e chiede solo il buco. È la garanzia
      vera: i tentativi si sommano invece di ripetersi, e un tentativo che
      guadagna direzioni riazzera il conto delle riprove — finché si avanza
      si continua. Le riprove automatiche sono passate da tre a cinque
      (20 s → mezz'ora), che adesso sono cinque morsi allo stesso buco.
- [x] **La quota di casa non ferma più tutto** (`terrenoQuotaDaVicino`). Era
      una richiesta sola e veniva per prima: un 429 su di lei e l'orizzonte
      non partiva nemmeno. Se non arriva si prende la mediana dell'anello di
      campioni a centocinquanta metri — stesso suolo, e i tetti e i fossi non
      la spostano — e il profilo si segna `quotaStimata` per farsi completare.

Contorno: `TERRENO_PAUSA_MAX_MS` (mezzo minuto: oltre, conviene cambiare
porta invece di aspettare), attese fra i tentativi più lunghe e con un
pizzico di caso dentro, e la riga di stato che dice «via OpenTopoData»
quando è la seconda fonte a rispondere.

Provato con un banco a parte (servizio finto): con Open-Meteo che risponde
sempre 429 il terreno arriva **intero** sprecando tre richieste; con tutte e
tre le fonti che rifiutano una risposta su due arriva intero lo stesso; con
il servizio che chiude dopo tre richieste il tentativo dopo ne chiede 22
invece di 24 e completa. Nel repo restano le prove del §9 di `verifica.html`
(17 nuove).

Da fare prima di dire che è finita: **aprire l'app in un browser vero** e
guardare l'orizzonte del proprio posto — qui non si è potuto, la rete di
questa sessione non lascia passare né open-meteo né gli altri due host.
