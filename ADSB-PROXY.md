# Proxy ADS-B stabile

GitHub Pages può servire solo file statici: non può aggiungere l'intestazione
`Access-Control-Allow-Origin` che manca ai feed ADS-B. I proxy CORS pubblici
non sono un ripiego affidabile e non vengono interrogati dall'app.

Il file `worker-adsb.js` è quindi un piccolo Cloudflare Worker del progetto:
interroga quattro reti ADS-B indipendenti dal server, aggiunge il CORS e mantiene
la risposta per 20 secondi. Le affianca con timeout brevi, invece di aspettare
in serie una rete muta. Per attivarlo:

1. eseguire `npx wrangler deploy` con un account Cloudflare;
2. in GitHub aprire **Settings → Secrets and variables → Actions → Variables**;
3. creare `ADSB_PROXY_URL` con l'URL HTTPS stampato da Wrangler, senza `/` finale;
4. rilanciare **Pubblica il sito**.

Il workflow scrive l'URL in `config.js` soltanto nell'artefatto pubblicato: non
servono credenziali nel browser e la configurazione locale resta portabile.

Il Worker non è un miglioramento facoltativo in produzione: i feed diretti non
espongono CORS a GitHub Pages e sono usati soltanto in sviluppo locale. Se la
variabile manca, il workflow ora ferma la pubblicazione invece di mettere
online un'app che tenta richieste destinate a essere bloccate dal browser. I
proxy CORS pubblici non vengono usati perché rispondono con 401/408 e possono
cambiare regole senza preavviso.
