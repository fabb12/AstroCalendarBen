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

## 1. La conformazione del terreno, come su PeakFinder — fatto

Griglia da 48×12 a **120×18**; l'orizzonte disegnato a piani veri (una banda
per fetta di distanza, a strisce, con il filo di luce solo sui crinali veri);
il panorama che prosegue **sotto** la linea dell'orizzonte, che da una cima
era una campitura nera; i nomi delle vette agganciati alla punta **disegnata**
e non alla quota di catalogo. Dettagli in `CLAUDE.md` (§12, le voci «I piani
della veduta», «Il panorama sotto la linea dell'orizzonte», «Il filo di luce
su ogni crinale», «Il nome di una montagna attaccato alla sua punta»).

## 2. «Non riesce mai a scaricare la forma del terreno» — fatto

Il guasto è stato **riprodotto**, non dedotto: Chromium headless che apre
`index.html` con un finto Open-Meteo pilotabile. Con **una sola** richiesta su
venticinque che risponde 429, il vecchio codice buttava via anche le altre
ventiquattro, non riprovava mai, e scriveva «non sono riuscito a scaricare la
forma del terreno» senza dire perché. Con venticinque richieste anche un 2% di
guasto per richiesta dà quasi il 45% di probabilità che almeno una vada storta:
ecco il «mai».

- [x] **Sveglia su ogni richiesta** (`TERRENO_TIMEOUT_MS`, 15 s). Senza, una
      richiesta che non torna più lasciava lo stato «in-corso» per sempre: la
      riga diceva «sto misurando…» e non finiva mai.
- [x] **Tre tentativi con attese crescenti** (`terrenoQuoteInsistendo`), e
      `terrenoRiprovabile` distingue un 429 da un 400.
- [x] **Una richiesta che cade non trascina le altre**: ognuna ha il suo
      `catch`, e le direzioni che mancano si stimano dalle vicine
      (`terrenoRiempiVuoti`, interpolazione **circolare**).
- [x] **Due giri**: prima una direzione ogni tre (8 richieste) e si **disegna
      subito**, poi le altre ottanta. Misurato: primo orizzonte vero a ~0,3 s,
      completo a ~2,5 s. Se il secondo giro cade del tutto, resta il primo.
- [x] **Si adatta al limite del servizio** (`terrenoDirezioniPerVolta`): un
      400/413/414 su una richiesta di sole coordinate vuol dire «sono troppe»,
      e riprovarla identica dà lo stesso errore all'infinito. Si dimezza finché
      passa e la misura trovata vale per tutte le successive. È la difesa
      contro l'ipotesi che non ho potuto verificare da qui — il limite vero di
      Open-Meteo per richiesta, perché **da questo ambiente l'API è bloccata
      dal proxy**.
- [x] **Si dice perché** (`terrenoMotivoGuaio`): 429, codice, timeout o
      «non c'è rete» sono quattro cose diverse e chiedono quattro reazioni
      diverse.
- [x] **Tre tentativi automatici** (20 s, 90 s, 5 min) e poi basta; il tasto
      del pannello riprova subito e azzera il conto.
- [x] **Il service worker tiene le quote del suolo** (`/v1/elevation`): sono
      l'unica cosa di open-meteo che non invecchia, e così riprovare ripaga
      solo il pezzo che manca invece di rifare tutto.
- [x] `CACHE_NAME` → `astrocal-v94`, `CLAUDE.md` aggiornata.

### Come è stato verificato

`verifica.html`: **231 prove passate** (otto nuove sul riempimento dei buchi,
sull'impacchettamento delle richieste e sulla scelta di riprovare).

Con il finto Open-Meteo, ogni modo di rompersi finisce col terreno disegnato:

| che succede | prima | adesso |
|---|---|---|
| tutto bene | ok (25 richieste) | ok |
| un 429 su una richiesta | **niente terreno** | ok, 120/120 |
| sei richieste rotte per sempre | **niente terreno** | ok, 115/120 stimate le altre |
| tutto il giro fine cade | **niente terreno** | ok, 40/120 (il giro grosso) |
| una richiesta appesa 40 s | **appeso per sempre** | ok in 15 s, 120/120 |
| il servizio accetta max 40 coordinate | **niente terreno** | ok, si dimezza da solo |
| il servizio accetta una direzione per volta | **niente terreno** | ok, 133 richieste |
| rete giù del tutto | «non sono riuscito» | detto perché, e tre tentativi |
| tutto 429 | «non sono riuscito» | detto perché (429), sei richieste in tutto |

La logica del service worker è stata provata **a parte** (`self` finto), perché
in questo ambiente Playwright non intercetta le richieste che partono da dentro
un service worker: quote non in cache → rete e messe in cache; quote già in
cache → **zero** richieste di rete; rete giù → 504, che l'app sa riprovare;
meteo → rete e **non** messo in cache, cioè la regola di sempre è intatta.

### Cosa resta da guardare in campo

L'API vera non è raggiungibile da qui (`EGRESS_BLOCKED`), quindi il limite di
coordinate per richiesta di Open-Meteo non è stato confermato: il codice se lo
trova da sé, ma se in campo la riga di stato dovesse dire ancora qualcosa,
adesso **dice anche il codice**, ed è quello il pezzo che serve per capire.
