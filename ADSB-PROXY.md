# Proxy ADS-B stabile

GitHub Pages può servire solo file statici: non può aggiungere l'intestazione
`Access-Control-Allow-Origin` che manca ai feed ADS-B. L'app prova tredici
porte — cinque reti dirette e sei ponti CORS pubblici, in corsa e non in fila
indiana (`aerei.js` §1–§3) — ma sono tutti prestiti: servizi gratuiti, senza
contratto, che smettono a turno. **Sono capaci di essere chiusi tutti insieme.**

È successo davvero, e in una sera sola, per tre motivi diversi:

- le quattro reti dirette hanno risposto **senza CORS**
  (`has been blocked by CORS policy` in console);
- `corsproxy.io` ha risposto **401**: ha cominciato a pretendere una chiave e
  un'origine registrata, quindi da un sito pubblico non funziona più — per
  questo non sta più nell'elenco;
- `allorigins` ha risposto **408**: in piedi, ma sotto carico.

Il sintomo è il peggiore che ci sia, perché un cielo senza triangoli è
identico a un cielo senza aerei. Il pannello adesso lo dice a parole
(«nessuna porta ADS-B raggiungibile da qui») invece di lasciare in console un
`Failed to fetch`, che è la stessa frase con cui il browser racconta un cavo
staccato.

La cura non è un ponte in più: è una porta **propria**.

## Il Worker del progetto

`worker-adsb.js` è un piccolo Cloudflare Worker: interroga quattro reti ADS-B
dal server — dove il CORS non esiste — aggiunge l'intestazione e conserva la
fotografia per 20 secondi. Il piano gratuito di Cloudflare dà centomila
richieste al giorno, cioè molto più di quanto un planetario possa consumare.

```
npx wrangler deploy
```

Wrangler stampa un indirizzo del tipo `https://astrocalendarben-adsb.<tuo>.workers.dev`.
Da lì ci sono due strade, e la prima non richiede di ripubblicare niente.

### 1. Incollarlo nel pannello (vale subito, su questo dispositivo)

Planetario → **Aerei ADS-B** → **Proxy ADS-B proprio** → incolla l'indirizzo →
**Usa**.

Resta salvato in `localStorage` (`astrocalendario_adsb_proxy`), vince su
`config.js` e viene provato **prima** di tutte le altre porte. È la strada di
chi si ritrova il cielo senza aerei stasera, e di chi al deploy del sito non ha
accesso.

Nello stesso campo va bene anche **qualunque altro ponte CORS**, scritto come
modello con `{url}` al posto dell'indirizzo da chiamare:

```
https://mio-ponte.example/?target={url}
```

### 2. Metterlo nel deploy (vale per tutti)

1. in GitHub aprire **Settings → Secrets and variables → Actions → Variables**;
2. creare `ADSB_PROXY_URL` con l'URL HTTPS stampato da Wrangler, senza `/` finale;
3. rilanciare **Pubblica il sito**.

Il workflow scrive l'URL in `config.js` soltanto nell'artefatto pubblicato: non
servono credenziali nel browser e la configurazione locale resta portabile.

## Dettagli che evitano una mezz'ora persa

- L'indirizzo si può incollare **con o senza** la rotta `/api/adsb`: l'app la
  aggiunge se manca e non la raddoppia se c'è già. Il Worker, dal canto suo,
  risponde anche sulla radice, così incollare quello che Wrangler stampa
  funziona e basta.
- Il Worker rimanda in `X-Feed-ADSB` quale delle quattro reti ha risposto:
  `curl -sI "https://…workers.dev/api/adsb?lat=45.81&lon=9.03&dist=27"`.
- Se un feed risponde 200 con dentro una pagina d'errore, il Worker **non** la
  passa: la riconosce e prova la rete dopo. È la stessa cernita che `aerei.js`
  §1 fa dal lato browser, e serve perché una pagina d'errore letta come JSON
  diventa un allegro «zero aerei».
- Scrivere il proxy nel pannello **azzera la pagella delle porte**
  (`astrocalendario_adsb_salute`): le penali di prima parlano delle porte di
  prima, e tenerle vorrebbe dire far cominciare la porta nuova dal fondo della
  fila che ha appena reso inutile.
- `sw.js` deve lasciar passare il proxy senza mettersi in mezzo, se no
  traveste il guasto in un finto `504`. Lo riconosce dalla forma della
  richiesta — `.workers.dev`, oppure la rotta `/api/adsb` su qualunque host —
  perché un service worker `localStorage` non lo può leggere. Un ponte proprio
  con un'altra forma funziona lo stesso: perde solo la traduzione onesta del
  guasto.
