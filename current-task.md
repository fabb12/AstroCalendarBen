# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Il gestore delle lingue**, rifatto da capo: chiavi al posto di un traduttore
di frasi. Nasce da due segnalazioni — «il cambio verso l'inglese è molto lento»
e «molte parti restano in italiano, soprattutto le schede informative» — che
sono due facce della stessa scelta sbagliata.

### Com'era

Il gestore di prima traduceva **il DOM**. A ogni cambio lingua camminava tutti
i nodi di testo del documento e su ognuno passava duecento espressioni regolari
prese da un glossario di frasi e di parole. Nessun file dell'applicazione usava
una chiave: `data-i18n` compariva **zero volte** in `index.html` e
`astroI18n.t()` zero volte nel codice.

- **Era lento** per il conto, non per una riga: qualche migliaio di nodi per
  duecento voci, ognuna con una `RegExp` nuova, in un colpo sul filo
  dell'interfaccia. E un `MutationObserver` su `characterData` e sugli
  attributi di tutto il `body` rifaceva quel giro a ogni pannello riscritto —
  che in un planetario sono diverse volte al secondo.
- **Alla prima apertura si aspettava la rete**: `await` su `ipwho.is` con una
  sveglia da 3,5 s *prima* di scegliere una lingua. Chi apriva l'app da Londra
  vedeva tre secondi e mezzo di italiano e poi un cambio a scatto.
- **Era incompleto, e non poteva non esserlo.** Un dizionario di frasi traduce
  le frasi che ci sono scritte dentro; le schede informative sono fatte di
  frasi composte al momento («è circumpolare: non tramonta mai», «disco
  illuminato al 87%») e non stanno in nessun elenco. Dove il glossario mordeva
  a metà usciva un misto delle due lingue, che è l'unico esito peggiore del non
  tradurre affatto.

### Com'è adesso

1. **I dizionari sono in memoria** (`lingue/it.js`, `lingue/en.js`, 893 voci
   in parità), assorbiti appena `i18n.js` viene eseguito e **non** al
   `DOMContentLoaded` — `verifica.html` gira mentre il documento si sta ancora
   leggendo, e `t()` deve rispondere anche a lei. Nessuna richiesta di rete,
   nessuna API di traduzione.
2. **Il cambio lingua non guarda il documento**: scorre l'indice dei soli nodi
   che portano una chiave (**464 contro 45.000** nodi di testo) e avvisa chi si
   disegna da sé. Misurato con tutte le finestre aperte: **34 ms in tutto, di
   cui 7 di riscrittura del testo**; il resto è il ridisegno delle viste, che
   costa quanto costa aprirle.
3. **La lingua si sceglie subito**, con quello che il browser sa già dire; il
   paese dall'IP corregge dopo, in silenzio, e solo se nessuno ha scelto a mano.
4. **Il ripiego** è lingua scelta → italiano (la sorgente) → nome della chiave,
   con un avviso in console **una volta sola per chiave** e
   `astroI18n.rapporto()` per l'elenco.

### Cosa dicono i numeri

- **`index.html`: 397 stringhe cablate → 0.** Le 472 chiavi sono state generate
  e poi tradotte a mano.
- **Il planetario, dopo un cambio lingua: 0 frasi italiane a schermo e 0
  attributi** (erano migliaia).
- L'audit statico: **1175 → 636**. Quello che resta è quasi tutto il
  *contenuto* degli eventi dell'agenda e tre viste, elencati qui sotto.
- `verifica.html`: **1138 verdi, 5 rosse** — identico al commit di partenza
  (le cinque sono le stesse dell'acqua e del rilievo).
- `prova-nel-browser.js`: 4 rosse come alla partenza. `prova-fumetto.js`: da 5
  a **3** (due passavano a caso, ora la lingua è fissata).

### I pezzi nuovi

- `i18n.js` riscritto; `lingue/it.js` e `lingue/en.js`.
- `ui-nuova.js` §«Il ridisegno al cambio lingua»: chi si compone in JavaScript
  va **ridisegnato**, non riscritto. Si ridisegna quello che è a schermo; le
  altre viste si segnano in debito e lo pagano in `mostraVista`.
- `creaEvento` accetta `chiave`: titolo, spiegazione e programma diventano
  getter e si risolvono quando l'agenda li legge. Un evento nasce una volta e
  vive per sempre — scrivergli dentro la frase voleva dire un'agenda che non
  cambia più lingua.
- `conNomeTradotto()`: le tabelle lette in venti posti (`CATEGORIE`,
  `STRUMENTI`, `COST_FILTRI`, `POS_ETICHETTE`, `NOMI_MESI`, `LEZ_CAPITOLI`) non
  si convertono chiamante per chiamante — si converte quello che i chiamanti
  leggono.
- **Sei conti alla rovescia** scritti in cinque file diventano uno
  (`astroI18n.quantoManca`), in due registri: lungo per l'agenda, corto per
  l'avviso di un transito, che ha due centimetri di schermo. Unificarli in uno
  solo sembrava una pulizia ed era una perdita.
- `scripts/controlla-i18n.js` (l'audit), `scripts/prova-lingua.js` (47 prove in
  un browser), `scripts/prova-i18n.js` riscritto (31 prove senza browser),
  `scripts/i18n-tetto.json` (il cricchetto).

### Cosa resta, e dov'è scritto

I tetti stanno in `scripts/i18n-tetto.json` e scendono, non risalgono:

| dove | frasi | cosa manca |
|---|---|---|
| agenda | ~1.560 | il **contenuto degli eventi** che non è ancora passato alle chiavi: congiunzioni, sciami meteorici, stagioni, eclissi, opposizioni. Le fasi lunari sono fatte, ed erano metà dell'agenda |
| telescopio | 14 | `telescopio.js`, ~100 stringhe |
| stasera | 10 | due righe di riepilogo del meteo |
| diario | 6 | `costruisciDiario` e i traguardi |
| — | — | `didattica.js` (~56): non ha un ingresso per ridisegnarsi, va aggiunto insieme alle sue chiavi |

### L'unione con main

`main` era andato avanti di nove PR, e tre toccavano proprio quello che questo
lavoro aveva riscritto: il playback (la riga «Marcia» del pannello Tempo e i
tasti di pausa sono stati **tolti**, il playback è un Play/Stop solo nella
barra), lo scarto della barra del tempo (una funzione nuova,
`skyScartoBarraTesto`, con le sue sigle) e la galleria video (un blocco nuovo di
markup). I conflitti erano tre file.

- **`i18n.js`**: main aveva aggiunto delle voci al glossario, che qui non esiste
  più. Le sue quattro stringhe nuove sono diventate chiavi come tutte le altre.
- **`index.html`**: si è preso l'HTML di main e ci si è rimessa l'iniezione
  delle chiavi da capo. Le chiavi nascono dallo slug della frase italiana,
  quindi quelle del testo non toccato sono venute identiche: **sei nuove** (la
  galleria, e il titolo della lettura della barra che main ha riscritto) e
  **quindici sparite** insieme agli elementi del playback.
- **`sw.js`**: solo il `CACHE_NAME`, portato a v270.

Da quelle quindici chiavi sparite sono nate le **due prove che legano i tre
posti** in cui una chiave vive (l'HTML, il codice, il dizionario): ogni chiave
citata esiste, e nessuna è orfana. Non si rompeva niente — sullo schermo
compariva il nome della chiave, che è leggibile e per questo passa inosservato.

Dopo l'unione i banchi dicono gli stessi numeri di `main`: `verifica.html`
1138/5, `prova-nel-browser` 4 rosse, `prova-fumetto` 0. Il cambio lingua è anche
**sceso a 34 ms** — main ha tolto dei comandi, e sono nodi in meno da riscrivere.

### Tre difetti trovati misurando, e vale la pena ricordarli

- **La chiave va sul nodo che porta la parola.** `inizializzaNavigazione`
  sposta l'etichetta di un bottone dentro a uno `<span>`: la `data-i18n`
  rimasta sul bottone faceva scrivere la parola **due volte**
  («StaseraTonight»). Adesso la chiave segue la parola, e il gestore rifiuta di
  aggiungere testo a un elemento che ha figli e nessun testo proprio.
- **`verifica.html` non caricava `i18n.js`**, e fa girare `terreno.js`,
  `catalogo.js`, `costellazioni.js` e `aerei.js` per davvero: la prima
  `astroI18n.t()` era un `ReferenceError`, e in una pagina di `<script>` unici
  quello non fa fallire una prova — porta via tutte le sezioni successive. Da
  1138 prove a **10**, in silenzio. È la trappola scritta in tre punti di
  `CLAUDE.md`, arrivata dalla lingua.
- **In italiano quattro cifre non portano il separatore** (5800, non 5.800),
  in inglese sì (5,800): è CLDR, `Intl` la applica, e il dizionario diceva
  «5.800» a mano — due modi di scrivere lo stesso numero nella stessa riga
  della scheda di una stella.
