# Proxy ADS-B stabile

GitHub Pages può servire solo file statici: non può aggiungere l'intestazione
`Access-Control-Allow-Origin` che manca ai feed ADS-B. I proxy CORS pubblici
non sono un ripiego affidabile (rispondono 401/408 e cambiano regole senza
preavviso) e non vengono interrogati dall'app.

Il file `worker-adsb.js` è quindi un piccolo Cloudflare Worker del progetto:
interroga quattro reti ADS-B indipendenti **dal server**, aggiunge il CORS e
mantiene la risposta per 20 secondi. Le affianca con timeout brevi, invece di
aspettare in serie una rete muta.

Perché è il percorso raccomandato, in una riga: senza Worker la scelta della
rete che funziona dipende dal browser, dalla rete di casa e dai filtri
anti-tracciamento di chi guarda — ed è esattamente la ragione per cui gli
aerei «a volte ci sono e a volte no».

---

## La procedura, dall'inizio alla fine

### 1. Il Worker su Cloudflare

Serve un account gratuito su [dash.cloudflare.com](https://dash.cloudflare.com).
**Non** bisogna spostare il dominio né creare un sito Cloudflare Pages: il sito
resta su GitHub Pages, Cloudflare fa solo da proxy.

Due strade, stesso risultato.

**Dal browser** (nessun Node, nessun npm da installare):

1. Workers & Pages → **Create** → **Create Worker** (o «Start with Hello World»);
2. nome: `astrocalendarben-adsb`;
3. **Deploy**, poi **Edit code**;
4. cancellare il codice di esempio e incollare **tutto** `worker-adsb.js`
   (è già scritto nel formato module, con `export default`);
5. **Deploy**.

**Da riga di comando**, se si ha Node: `npx wrangler deploy` nella radice del
repo — `wrangler.toml` è già configurato.

### 2. La prova che funziona

Cloudflare stampa un indirizzo tipo
`https://astrocalendarben-adsb.NOMEACCOUNT.workers.dev`. Aprire nel browser:

```
https://astrocalendarben-adsb.NOMEACCOUNT.workers.dev/api/adsb?lat=45.4642&lon=9.1900&dist=50
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
| `ADSB_PROXY_URL` | `https://astrocalendarben-adsb.NOMEACCOUNT.workers.dev` |

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
window.ADSB_PROXY_URL = "https://astrocalendarben-adsb.NOMEACCOUNT.workers.dev";
```

Il `config.js` del repository resta vuoto: la sostituzione avviene solo in
pubblicazione, quindi la copia locale resta portabile.

### 6. **Incrementare `CACHE_NAME` in `sw.js`**

Questo passo è quello che si dimentica, e il sintomo è il peggiore che ci sia:
sembra che la configurazione non abbia funzionato affatto. `config.js` sta in
`ASSETS` del service worker e la strategia è *cache-first*, quindi chi ha già
aperto il sito continua a ricevere il `config.js` **vecchio** — quello vuoto —
e l'app continua a provare i feed diretti come prima. Cambiare `CACHE_NAME`
(oggi `astrocal-v219`) è l'unico modo di far scadere quella copia.

---

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

- **Quota Cloudflare**: 100.000 richieste al giorno sul piano gratuito. Con un
  aggiornamento ogni 45 secondi a planetario aperto (`AGGIORNA_VISIBILE_MS`) e
  ogni 3 minuti a disegno spento, sono un paio di migliaia di richieste al
  giorno per utente: la quota non si sfiora.
- **La cache dentro al Worker**: il `cf: { cacheEverything, cacheTtl: 20 }` è
  con ogni probabilità ignorato su un dominio `*.workers.dev`, dove la cache
  di Cloudflare non è disponibile. Non è grave — ogni richiesta arriva
  direttamente al feed — e l'header `Cache-Control: max-age=20` che il Worker
  restituisce continua a valere per il browser.
