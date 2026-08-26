# Proxy ADS-B stabile

GitHub Pages può servire solo file statici: non può aggiungere l'intestazione
`Access-Control-Allow-Origin` che manca ai feed ADS-B. I proxy CORS pubblici
sono mantenuti come ripiego, ma non possono offrire affidabilità prevedibile.

Il file `worker-adsb.js` è quindi un piccolo Cloudflare Worker del progetto:
interroga tre reti ADS-B indipendenti dal server, aggiunge il CORS e mantiene
la risposta per 20 secondi. Per attivarlo:

1. eseguire `npx wrangler deploy` con un account Cloudflare;
2. in GitHub aprire **Settings → Secrets and variables → Actions → Variables**;
3. creare `ADSB_PROXY_URL` con l'URL HTTPS stampato da Wrangler, senza `/` finale;
4. rilanciare **Pubblica il sito**.

Il workflow scrive l'URL in `config.js` soltanto nell'artefatto pubblicato: non
servono credenziali nel browser e la configurazione locale resta portabile.
