# Task Corrente

Niente in corso.

## Ultimo intervento completato

I nomi dei paesi e delle città che non comparivano più sull'orizzonte, con in
console un muro di errori di rete su OpenStreetMap.

### Cos'era davvero

Non era un bug di disegno e non era la posizione: era che **le porte a cui
bussare erano due, ed erano chiuse tutt'e due**. Nella segnalazione si
leggevano due guasti che non si somigliano per niente:

- `overpass-api.de` → `ERR_CONNECTION_TIMED_OUT`, cioè la connessione non si
  apriva nemmeno: non era il servizio a essere carico, era la strada per
  arrivarci;
- `overpass.kumi.systems` → *No 'Access-Control-Allow-Origin' header*, cioè
  rispondeva **senza intestazione CORS**, che dal browser è un no secco anche
  quando i dati ci sarebbero.

Con due sole istanze quello era un caso peggiore garantito, e sotto ci stavano
altri tre difetti che lo rendevano definitivo invece che passeggero.

### 1. Cinque porte al posto di due (`terreno.js`, `OVERPASS_ISTANZE`)

Aggiunte `overpass.private.coffee`, `overpass.osm.jp` e
`overpass.openstreetmap.fr`: pubbliche, senza chiave, planeta intero e
`Access-Control-Allow-Origin: *` — che qui è la condizione necessaria, perché
una pagina statica su GitHub Pages non ha un server proprio da mettere in
mezzo.

### 2. La scadenza è di tutta la corsa, non di ogni porta (`overpassChiedi`)

È la riga che rende **gratis** le istanze in più. Prima ogni tentativo si
prendeva la sveglia intera: con due porte e la query di ripiego dietro erano
già 4 × 30 s nel caso peggiore, e passando a cinque sarebbero diventati cinque
minuti di silenzio prima di dire «non ce l'ho fatta». Adesso `attesaMs` è il
budget di tutta la corsa, e c'è anche la rete di sicurezza per chi non ha
`AbortController`: una porta muta non lascia più la promessa appesa.

### 3. I paesi si arrendevano cinque secondi prima del server

`CITTA_ATTESA_MS` era **15 s** contro i `[timeout:20]` scritti nella loro
query. La regola («il client non deve mai arrendersi per primo, se no taglia
la richiesta mentre il server la sta ancora onorando e il colpevole sembra
lui») era rispettata dalle vette e dalle acque, e non dai paesi — cioè proprio
dall'unica delle tre di cui uno si accorge. Adesso 26 s.

### 4. La supplenza dei capoluoghi non è più definitiva

Con Overpass giù i paesi ripiegavano su `ECL_CITTA`, si segnavano `pronto`, e
**nessuno tornava più a chiedere quelli veri**: il primo minuto storto decideva
l'orizzonte per tutta la sessione. Da Como col raggio stretto a venti
chilometri, poi, dentro `ECL_CITTA` non c'è nulla — e l'orizzonte restava senza
un solo nome. Adesso: `citta.fonte === 'interno'` non vale come risposta, c'è
la query corta di ripiego che le altre due famiglie avevano già
(`cittaQueryVicina`), e il pannello dice che sta facendo la supplenza.

### 5. «Si riprova da sé fra qualche minuto» adesso è vero

Lo diceva il messaggio delle vette e non lo faceva nessuno: a rimettere in moto
le tre richieste era solo un cambio di luogo. C'è la scala
`OVERPASS_RIPROVE_MS` (45 s, 4 min, 15 min), contata **per posto**.

### 6. Il service worker non traveste più i guasti da 504

Overpass e i geocodificatori inversi passano senza intermediari. Il ripiego
generico trasformava un guasto di rete in un finto `504 Non disponibile senza
rete` — ed è quello che si leggeva in console mentre l'orizzonte restava senza
nomi — e soprattutto teneva viva la `fetch` delle istanze **perdenti**, che
`overpassChiedi` crede di abortire: l'esatto contrario di quello che la corsa
serve a ottenere.

### Prove

`verifica.html` §26, ventuno prove: le porte (quante, host diversi, https), la
disuguaglianza client/server su tutte e sei le query, la corsa (una porta che
cade lascia subito il posto, si prova ognuna una volta, la scadenza è di tutta
la corsa, un 429 vero si racconta meglio dell'abort arrivato dopo) e il marchio
`daRipiego`. Girate in Chromium con `terreno.js` caricato per davvero, insieme
a una prova a parte dell'intero giro dei paesi: guasto → supplenza → nessuna
ribussata → attesa passata → paesi veri → salvataggio.

File toccati: `terreno.js` (§ Overpass, § 10 le città vere, § 11 le cime, § 12
le acque), `sw.js` (`astrocal-v144`), `verifica.html` (§26), `CLAUDE.md`.
