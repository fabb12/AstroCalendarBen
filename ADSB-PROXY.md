# Proxy ADS-B stabile

GitHub Pages può servire solo file statici: non può aggiungere l'intestazione
`Access-Control-Allow-Origin` che manca ai feed ADS-B. I proxy CORS pubblici
sì, ma sono di terzi e cambiano regole senza preavviso: l'app li interroga
come **ultimo** gradino, e il giorno in cui cadono insieme — è successo, vedi
«Quando cadono anche i ponti» in fondo — restano l'unica cosa fra il sito e un
cielo senza aerei.

Il file `worker-adsb.js` è quindi il proxy del progetto: interroga cinque
fonti ADS-B indipendenti **dal server**, aggiunge il CORS e mantiene la
risposta per 20 secondi. Le affianca con timeout brevi, invece di aspettare in
serie una rete muta. Gira uguale su Deno Deploy e su Cloudflare Workers, ma
**il posto giusto è Deno**: il perché è misurato, ed è la tabella di «Su
Cloudflare non funziona, su Deno sì».

Perché è il percorso raccomandato, in una riga: senza Worker la scelta della
rete che funziona dipende dal browser, dalla rete di casa e dai filtri
anti-tracciamento di chi guarda — ed è esattamente la ragione per cui gli
aerei «a volte ci sono e a volte no».

---

## La procedura, dall'inizio alla fine

### 1. Il proxy su Deno Deploy

Serve un account gratuito su [dash.deno.com](https://dash.deno.com), accesso
con GitHub, niente carta di credito. **Non** bisogna spostare il dominio: il
sito resta su GitHub Pages, Deno fa solo da proxy.

Due strade, stesso risultato.

**Dal browser** (nessun Node, nessun npm da installare):

1. **New Playground**;
2. cancellare il codice di esempio e incollare **tutto** `worker-adsb.js`
   (è già scritto nel formato module, con `export default`);
3. **Save & Deploy**.

**Per la versione definitiva**: New Project → collega il repository, punto di
ingresso `worker-adsb.js`. Così si aggiorna da solo a ogni push.

> **Su Cloudflare no**, e non è una preferenza: da un Worker tutte e cinque le
> fonti rifiutano l'IP condiviso (403, 429, 403, 403, e OpenSky che non
> risponde affatto), mentre dalla stessa ora su Deno tre rispondono. Il file
> gira lì lo stesso — `wrangler.toml` è ancora nel repo e `npx wrangler
> deploy` funziona — ma è un vicolo cieco, e il pannello degli aerei resterà
> vuoto identico a prima. La tabella è più sotto.

### 2. La prova che funziona

Deno stampa un indirizzo tipo
`https://astrocalendarben-adsb.deno.dev`. Aprire nel browser:

```
https://astrocalendarben-adsb.deno.dev/api/adsb?lat=45.4642&lon=9.1900&dist=50
```

- un JSON con `{"ac": [...]}` o `{"aircraft": [...]}` → **funziona**;
- `{"error":"feed ADS-B temporaneamente non disponibili"}` → il Worker è a
  posto, ma in quel momento nessuno dei quattro feed ha risposto: riprovare;
- `Not found` → manca `/api/adsb` nell'indirizzo, l'unico percorso che accetta;
- `{"error":"origine non ammessa"}` → si sta chiamando da un sito che non è
  nell'elenco: vedi «Chi può bussare» qui sotto.

`dist` è in **miglia nautiche**, non in chilometri: è l'unità che quei feed
vogliono, e `aerei.js` converte già (`raggioKm / 1.852`).

### 3. La variabile su GitHub

In **Settings → Secrets and variables → Actions → Variables → New repository
variable**:

| Name | Value |
|---|---|
| `ADSB_PROXY_URL` | `https://astrocalendarben-adsb.deno.dev` |

Senza virgolette, **senza `/api/adsb`** (lo aggiunge l'app) e senza `/` finale.
Una *variable*, non un *secret*: l'indirizzo finisce comunque nel browser di
chi apre il sito, e un secret servirebbe solo a nasconderlo a chi legge il
repository. Il nome deve essere esatto, perché il workflow legge
`${{ vars.ADSB_PROXY_URL }}`.

### 4. La sorgente di Pages

**Settings → Pages → Build and deployment → Source: «GitHub Actions»**. Va
fatto una volta sola. Con «Deploy from a branch» a pubblicare resta la
pipeline implicita di GitHub, che non esegue questo workflow e quindi non
scrive mai `ADSB_PROXY_URL` in `config.js`.

### 5. Ripubblicare

Actions → **Pubblica il sito** → **Run workflow** → `main`. Il workflow scrive
nell'artefatto pubblicato:

```js
window.ADSB_PROXY_URL = "https://astrocalendarben-adsb.deno.dev";
```

Il `config.js` del repository resta vuoto: la sostituzione avviene solo in
pubblicazione, quindi la copia locale resta portabile.

### 6. **Incrementare `CACHE_NAME` in `sw.js`**

Questo passo è quello che si dimentica, e il sintomo è il peggiore che ci sia:
sembra che la configurazione non abbia funzionato affatto. `config.js` sta in
`ASSETS` del service worker e la strategia è *cache-first*, quindi chi ha già
aperto il sito continua a ricevere il `config.js` **vecchio** — quello vuoto —
e l'app continua a provare i feed diretti come prima. Cambiare `CACHE_NAME`
(vedi la prima riga di `sw.js`) è l'unico modo di far scadere quella copia.

---

## Prima di tutto: serve davvero un proxy?

Sì, ed è il browser a imporlo. Misurato dall'origine del sito pubblicato,
**nessuna delle quattro reti manda `Access-Control-Allow-Origin`**: gli
endpoint sono vivi (aperti in una scheda restituiscono i dati) ma il browser
rifiuta la risposta prima di consegnarla al codice. Non è intermittente e non
si aggira lato client.

L'app ha quindi tre gradini, e il primo che risponde vince:

1. **Il proxy proprio** (`ADSB_PROXY_URL`) — il più solido: risponde sempre,
   con i limiti che decidi tu. Va distribuito una volta, vedi sotto.
2. **Le quattro reti dirette** — falliranno per CORS, ma costano trenta
   millisecondi e restano in lista nel caso una cambi politica.
3. **I ponti CORS pubblici** (`PONTI_CORS` in `aerei.js`) — servizi di terzi
   che leggono l'indirizzo dal loro server e rimandano la risposta col CORS
   aperto. **Non richiedono nessuna configurazione**: il sito funziona appena
   pubblicato. Il prezzo è che hanno limiti loro e possono sparire senza
   avvisare, ed è per questo che sono più di uno e nessuna rete dipende da un
   ponte solo.

Chi vuole che gli aerei ci siano sempre configura il punto 1. Chi vuole solo
aprire il sito si affida al punto 3 — sapendo che è un prestito, non una
garanzia: vedi qui sotto.

## Quando cadono anche i ponti

È successo, ed è il motivo per cui il punto 1 non è un lusso. In una stessa
sessione, dal sito pubblicato:

| ponte | risposta | che genere di guasto |
|---|---|---|
| `corsproxy.io` | **HTTP 401** | **permanente**: chiede una chiave e un'origine registrata. Non torna da solo — infatti è stato tolto da `PONTI_CORS` |
| `api.allorigins.win` | risposta **senza `Access-Control-Allow-Origin`** | passeggero: il servizio risponde, ma con una pagina d'errore del suo front-end, che l'intestazione non ce l'ha |
| `api.codetabs.com` | risposta **senza `Access-Control-Allow-Origin`** | passeggero, tipicamente il suo limite di richieste |

Con tutti e tre giù e nessun `ADSB_PROXY_URL`, l'app non ha **nessuna** strada:
le quattro reti dirette non si leggono da un browser per definizione. Il
pannello lo dice per esteso (la fase `proxyMancante` di `aerei.js`) e in
console compare `[aerei] Nessun proxy proprio configurato` — che è la riga da
cercare quando gli aerei non arrivano mai.

## Su Cloudflare non funziona, su Deno sì — ed è tutto qui

La stessa identica quarantina di righe, la stessa ora, le stesse fonti:

| | dal browser (IP di casa) | da Cloudflare Workers | da Deno Deploy |
|---|---|---|---|
| ADSB.fi | nessun header CORS | 403 | **200, 22 aerei, 32 ms** |
| adsb.lol | nessun header CORS | 429 | **200, 21 aerei, 115 ms** |
| Airplanes.live | nessun header CORS | 403 «scrivici» | 403 «scrivici» |
| adsb.one | nessun header CORS | 403 | 403 |
| OpenSky | 200, ma CORS legato al loro dominio | **nessuna risposta** (15 s) | **200 in 189 ms** |

Non era il codice, non erano le credenziali, non era OpenSky: era l'indirizzo
IP. Un Cloudflare Worker non ne ha uno proprio — ne divide un pugno con
migliaia di altri — e questi servizi si difendono guardando lì. Da Deno la
stessa richiesta passa senza che nulla cambi nel file.

**La conclusione pratica: il proxy va distribuito su Deno Deploy, non su
Cloudflare.** `worker-adsb.js` gira su entrambi — è scritto in Web standard,
`export default { fetch }` con Request e Response — e il nome è rimasto quello
per non rompere i riferimenti, ma il posto giusto è Deno.

Le credenziali OpenSky non sono nemmeno necessarie per partire: da Deno due
reti di comunità rispondono da sole, e OpenSky risponde 200 anche senza. Restano
consigliate come **terza fonte**, per non dipendere da chi può cambiare
politica domani.

### Distribuirlo su Deno Deploy

1. [dash.deno.com](https://dash.deno.com), accesso con GitHub (gratuito, niente carta).
2. **New Playground** per provare in trenta secondi: incolla `worker-adsb.js`,
   Save & Deploy. Per la versione definitiva conviene **New Project → collega
   il repository** con `worker-adsb.js` come punto di ingresso, così si
   aggiorna da solo a ogni push.
3. Aprendo l'indirizzo nudo, la radice si presenta e stampa il link della
   diagnostica già pronto. Il campo `piattaforma` deve dire `Deno`.
4. Facoltativo ma consigliato: **Settings → Environment Variables**,
   `OPENSKY_CLIENT_ID` e `OPENSKY_CLIENT_SECRET`.
5. Metti quell'indirizzo in `ADSB_PROXY_URL` fra le *Variables* del repository
   e rilancia **Pubblica il sito**.

## OpenSky, cioè la fonte che funziona davvero

Le quattro reti di comunità (`ADSB.fi`, `adsb.lol`, `Airplanes.live`,
`adsb.one`) **non servono questa app da nessuna delle due strade**, ed è una
misura, non un'impressione:

| | dal browser (IP di casa) | dal Worker (IP Cloudflare) |
|---|---|---|
| ADSB.fi | nessun header CORS | HTTP 403 |
| adsb.lol | nessun header CORS | HTTP 429 |
| Airplanes.live | nessun header CORS | HTTP 403 |
| adsb.one | nessun header CORS | HTTP 403 |

Gli endpoint sono vivi — aperti in una scheda restituiscono i dati — ma non
mandano `Access-Control-Allow-Origin`, quindi il browser non può leggerli; e
dal Worker rifiutano l'indirizzo, perché un Worker non ha un IP proprio e ne
divide un pugno con migliaia di altri. Il 429 per una richiesta sola è la
firma di una quota consumata da qualcun altro sullo stesso indirizzo.

**OpenSky Network** non ha nessuno dei due problemi: ha un'API ufficiale per
uso non commerciale con credenziali proprie, quindi l'identità è l'account e
non l'indirizzo da cui si esce. Ed è la ragione vera per cui questo Worker
esiste: è l'unico posto in cui una credenziale può stare senza finire nel
browser di chiunque apra il sito.

### Come si configura

1. Registrati su [opensky-network.org](https://opensky-network.org) (account
   gratuito, uso non commerciale).
2. Nel tuo profilo crea un **API client**: ottieni un `client_id` e un
   `client_secret`.
3. Nel pannello Cloudflare, pagina del Worker → **Settings → Variables and
   Secrets** → aggiungi due **Secret** (non variabili in chiaro):

   | Nome | Valore |
   |---|---|
   | `OPENSKY_CLIENT_ID` | il client id |
   | `OPENSKY_CLIENT_SECRET` | il client secret |

4. Ridistribuisci il Worker (o aspetta la build successiva).

Per gli account che usano ancora l'autenticazione di base valgono in
alternativa `OPENSKY_USER` e `OPENSKY_PASS`. Senza nessuna delle due coppie
OpenSky non entra nella corsa e il Worker si comporta come prima.

### Secret, non Variable — e non e' un dettaglio

Nella pagina delle impostazioni del Worker ci sono **due sezioni dal nome
quasi uguale**, e solo una delle due serve:

| Sezione | Quando esiste | Il Worker la legge? |
|---|---|---|
| **Runtime variables and secrets** (in cima) | mentre il Worker gira | **si'** |
| **Builds → Variables and secrets** | solo durante `npx wrangler deploy` | no |

E dentro alla prima, il **tipo** conta. Con il Worker collegato al repository,
ogni push su `main` rilancia `npx wrangler deploy`, che riallinea le
associazioni del Worker a quelle dichiarate in `wrangler.toml` — dove di
`[vars]` non ce n'e' nessuna. Le voci di tipo **Variable** aggiunte a mano dal
pannello rischiano quindi di sparire alla distribuzione successiva; i
**Secret**, che sono cifrati e vivono fuori dalla configurazione, restano.

Il sintomo e' insidioso perche' non somiglia a un guasto: la diagnostica torna
a dire `"openSky": "nessuna credenziale configurata"` e OpenSky sparisce
dall'elenco delle fonti — come se non lo si fosse mai configurato. Se capita
dopo un merge, e' quasi certamente questo.

Non metterle mai in `wrangler.toml`: quel file sta nel repository, ed e'
pubblico.

Verifica con `/api/diagnostica`: il campo `openSky` dice se le credenziali
sono state viste, e `funzionanti` deve contenere `OpenSky`.

### I conti

OpenSky concede agli utenti registrati un budget giornaliero di richieste, e
una richiesta con un riquadro piccolo è la più economica che ci sia. Con
l'aggiornamento ogni 45 secondi a planetario aperto e ogni 3 minuti a disegno
spento si resta largamente dentro, perché l'app interroga solo mentre è
aperta. Il token OAuth2 dura mezz'ora e il Worker se lo tiene: non si paga una
richiesta di autenticazione per ogni fotografia.

---

## Quando risponde «feed ADS-B temporaneamente non disponibili»

Il 503 adesso porta con sé i dettagli, uno per feed:

```json
{"error":"feed ADS-B temporaneamente non disponibili",
 "dettagli":[{"feed":"ADSB.fi","guasto":"HTTP 429"}, ...]}
```

Se serve la fotografia completa c'è **`/api/diagnostica`**, che interroga
tutti e quattro invece di correre e aspetta ognuno fino in fondo:

```
https://IL-TUO-PROXY.deno.dev/api/diagnostica?lat=45.4642&lon=9.1900&dist=50
```

Restituisce per ogni feed il codice HTTP, i millisecondi, il numero di aerei
se ha risposto, e i primi 200 caratteri del corpo quando ha risposto male —
che è quasi sempre dove sta scritta la cosa che serve («rate limited», «api
key required», una pagina di manutenzione). `funzionanti` è l'elenco corto di
chi ha risposto bene.

Esiste perché «nessun feed disponibile» è la stessa frase per quattro guasti
che si riparano in quattro modi diversi: un servizio spento (si aspetta), un
429 (si aspetta di più, o si cambia porta), uno schema cambiato (va aggiornato
l'interprete) e un endpoint ritirato (va sostituito il feed). Senza i dettagli
si va a tentoni.

## Chi può bussare

Un Worker che rimanda indietro qualunque `Origin` è un proxy ADS-B gratuito
per chiunque ne trovi l'indirizzo: la quota Cloudflare e i limiti dei quattro
feed li paga chi l'ha distribuito, e il giorno in cui una rete mette in
castigo quell'indirizzo il cielo si svuota per il sito vero.

L'elenco delle origini ammesse sta in chiaro in cima a `worker-adsb.js`
(`ORIGINI_AMMESSE`) e si allarga senza toccare il codice con la variabile
d'ambiente `ORIGINI_AMMESSE` del Worker (Cloudflare → Settings → Variables),
nomi separati da virgola.

Due permessi non sono una svista: le richieste **senza** `Origin` passano
(sono quelle della barra degli indirizzi e di `curl`, cioè l'unico modo di
provare il Worker appena distribuito — e non sono richieste cross-site, che è
l'unica cosa da cui il CORS difenda), e `localhost` passa a qualunque porta,
se no lo sviluppo in locale non vedrebbe mai un aereo.

Chi pubblica il sito su un altro dominio deve quindi aggiungerlo lì, oppure si
ritroverà un 403 al posto degli aerei.

---

## Cosa succede se il Worker non c'è

La sua assenza **non** spegne il modulo: il workflow pubblica ugualmente (con
un avviso) e il browser prova in parallelo le quattro reti dirette. Almeno una
espone quasi sempre il CORS, e la pagella salvata in `localStorage` ricorda
quale ha funzionato da qui. È un ripiego onesto ma meno affidabile, perché
quelle politiche cambiano senza preavviso e GitHub Pages non può correggerle.

## Cose da sapere sui limiti

- **Quota**: sia Deno Deploy sia Cloudflare hanno piani gratuiti molto larghi
  (centinaia di migliaia di richieste al giorno). Con un aggiornamento ogni 45
  secondi a planetario aperto (`AGGIORNA_VISIBILE_MS`) e ogni 3 minuti a
  disegno spento, sono un paio di migliaia di richieste al giorno per utente:
  la quota non si sfiora.
- **La cache dentro al Worker**: il `cf: { cacheEverything, cacheTtl: 20 }` è
  con ogni probabilità ignorato su un dominio `*.workers.dev`, dove la cache
  di Cloudflare non è disponibile. Non è grave — ogni richiesta arriva
  direttamente al feed — e l'header `Cache-Control: max-age=20` che il Worker
  restituisce continua a valere per il browser.
