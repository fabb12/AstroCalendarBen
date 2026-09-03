# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Gli aerei ADS-B non arrivavano mai da un PC, ed erano cadute tutte e tre le
strade insieme.** La causa radice non è nel codice: il sito pubblicato ha
`window.ADSB_PROXY_URL = ''` (la variabile di repository non è impostata,
il workflow lo dice solo con un `::warning::`), quindi restavano le quattro
reti dirette — che da un browser non si leggono mai — e i ponti CORS
pubblici, che nella stessa sessione hanno risposto: `corsproxy.io` **401**
(chiede una chiave: guasto permanente), `allorigins` e `codetabs` senza
`Access-Control-Allow-Origin`. Nessuna strada, e il pannello lo diceva già
per esteso con la fase `proxyMancante`.

Fatto qui, che è la parte che sta nel repository:

1. **`sw.js`**: i due ponti passano ora **senza il service worker in mezzo**,
   come già facevano le reti dirette. Il ripiego generico trasformava il loro
   guasto in un `504` sintetico — un numero che nessun server aveva mandato,
   che finiva nella pagella delle porte e nel pannello — e soprattutto teneva
   viva la `fetch` di un ponte che la corsa aveva già abortito, consumando
   fino in fondo la quota di un servizio pubblico. È la stessa cura già data
   a Overpass. `CACHE_NAME` a `astrocal-v251`.
2. **`aerei.js`**: tolto `corsproxy.io` da `PONTI_CORS`. Un 401 a ogni
   richiesta non è un ripiego, è un ritardo: la pagella lo mandava in fondo
   ma un posto in corsa lo occupava. Restano due ponti, con gli abbinamenti
   rifatti perché nessuna rete dipenda da un ponte solo.
3. **`ADSB-PROXY.md`**: la procedura ora comincia da **Deno Deploy**. Prima i
   passi 1-6 portavano su Cloudflare e solo molto più in basso una tabella
   diceva che da un Worker tutte e cinque le fonti rifiutano l'IP condiviso —
   chi seguiva il documento in ordine distribuiva il proxy e restava senza
   aerei lo stesso. Aggiunta la sezione «Quando cadono anche i ponti».

**Quello che resta da fare, e non è codice**: distribuire `worker-adsb.js` su
Deno Deploy e mettere l'indirizzo in `ADSB_PROXY_URL` (Settings → Secrets and
variables → Actions → **Variables**), poi rilanciare *Pubblica il sito*.
Finché quella variabile non c'è, gli aerei dipendono da due servizi di terzi
che oggi sono giù.

Banco: 1050 prove verdi, 5 rosse — le stesse cinque di prima dell'intervento
(acque e rilievo, §20/§25/§28), non toccate da qui.

## Intervento precedente

**Il Lago di Como torna visibile anche dietro le rive urbane.** L'occlusione
dell'acqua ora assorbe il normale disaccordo verticale fra i due modelli del
rilievo: tetti, lungolago e pendio dentro la stessa cella non vengono più
scambiati per una diga che copre l'intero lago. Le pareti vere continuano a
nascondere l'acqua grazie al limite angolare della franchigia.

La prova del paesaggio include ora una riva urbana alta diciotto metri e la
cache PWA passa a `astrocal-v245`.

## Intervento precedente

**Ripristinata l'acqua dei laghi nel Planetario 3D.** Il disegno delle acque
interne ora parte in un contesto canvas proprio, dopo aver chiuso quello del
rilievo: non può più ereditare il ritaglio della sagoma 3D che, soprattutto a
campo largo, lasciava al lago zero pixel disegnabili. L'opacità del paesaggio
viene passata esplicitamente, quindi resta invariata la dissolvenza allo zoom.

Incrementata anche la cache PWA a `astrocal-v244`, così i browser già installati
non mescolano il nuovo `app.js` con i moduli del paesaggio rimasti in cache.
