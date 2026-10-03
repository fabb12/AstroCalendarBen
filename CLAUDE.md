# AstroCalendario di Ben — mappa del progetto

Mappa **corta**, da leggere a ogni sessione. Il dettaglio — righe di `app.js`
sezione per sezione, stato globale campo per campo, la storia di ogni prova e
la grande tabella «Dove guardare per…» con i difetti già trovati e curati — sta
in **`MAPPA-DETTAGLIATA.md`**: non va letta tutta, ci si cerca con `grep` il
nome di una funzione, di un sintomo o di una prova. Prima di inseguire un
difetto, cercalo lì: quasi sempre qualcuno l'ha già visto.

**Prima di tutto, `current-task.md`** (radice, non pubblicato): se non dice
«Niente in corso» è lì che sta scritto a che punto è l'ultimo lavoro. Chi lascia
un compito a metà lo aggiorna; chi ne comincia uno nuovo lo riscrive.

**Versione obbligatoria a ogni modifica.** Incrementa di uno `CACHE_NAME` in
`sw.js` e porta `window.ASTROCAL_BUILD.version` in `config.js` alla stessa
`vN`; aggiorna `builtAt` con la data UTC (il deploy la sostituisce). Se i due
numeri non coincidono, la modifica non è completa.

## 1. Cos'è l'app

PWA in italiano per l'osservazione astronomica amatoriale: *cosa succede in
cielo*, *si vede da casa mia*, *dove guardo*, *come lo punto col telescopio*.

- **Nessun backend, nessun build, nessun framework, nessun `package.json`.**
  HTML + CSS + JavaScript vanilla, tutto globale. Si apre `index.html`.
- Gli eventi sono calcolati nel browser da Astronomy Engine.
- Funziona **offline** (service worker + `localStorage`).
- Tutto — codice, commenti, identificatori — è **in italiano**; il testo a
  schermo passa dai dizionari (§10).

## 2. File

| File | Contenuto (prefisso) |
|---|---|
| `index.html` | Struttura statica: testata, viste, modali. Nessuna logica. |
| `app.js` (~41k righe) | Tutto il resto: eventi, planetario (`sky`), vista 3D (`sol`), simulazione (`sim`), meteo, diario, eclissi (`_ecl`). Mappa sezione per sezione in MAPPA-DETTAGLIATA §6. |
| `telescopio.js` | Vista Telescopio (`tel`). |
| `catalogo.js` | Stelle, costellazioni, cielo profondo e motore a matrice (`cat`). |
| `via-lattea.js` | La Via Lattea a fiocchi frattali, Magellano, nebulose (`skyVL`). |
| `costellazioni.js` + `arte-costellazioni/` | Disegni delle figure, nomi delle altre culture, atlante (`cost`). |
| `curiosita.js` | Le curiosità delle schede (`cur`); il testo sta in `curiosita.*` nei dizionari. |
| `scala-cosmica.js` | La scala cosmica, quarto quadro della 3D (`cosm`). |
| `corpi-minori.js` | Lune di Giove, comete, asteroidi (`corpiMinori`). |
| `pianifica.js` | Curva della notte, migliori bersagli, ostacoli (`pian`/`orizzonte`). |
| `miglior-posto.js` | Dove osservare un evento (`posto`). |
| `terreno.js` | Terreno vero, paesi, vette, laghi e fiumi, raggi, GPS in movimento (`terreno`, `citta`, `cime`, `acque`, `raggi`). |
| `rilievo.js` | Il rilievo a tessere raster, colore delle quote, velo dell'aria (`ril`). |
| `meteo-astro.js` | Seeing, trasparenza, Kp e aurora (`meteo`/`aurora`). |
| `aurora-polare.js` | L'ovale aurorale nel planetario (`aur`). |
| `aerei.js` | Aerei ADS-B: aggregatore multi-fonte, fusione, circuito (`aerei`). |
| `transiti.js` | Aerei/stazioni davanti a Sole e Luna (`tran`). |
| `visione.js` | Motore di vista della realtà aumentata (`vis`). |
| `inseguimento.js` | Inseguimento a rilevazioni degli aerei, anche worker (`ins`). |
| `eventi-extra.js` | Superlune, opposizioni, transiti sul Sole, comete, aurore. |
| `missione-cielo.js` | Missione Cielo, la serata come caccia (`miss`). Vedi `MISSIONE-CIELO.md`. |
| `ui-nuova.js` | Interfaccia dei moduli sopra, e `ridisegnaTuttoPerLingua`. |
| `i18n.js`, `lingue/it.js`, `lingue/en.js` | Gestore delle lingue e dizionari. Vedi `I18N.md`. |
| `didattica.js` | Gli otto banchi del laboratorio (`did`, `aurL`, `spa`, `tram`, …). |
| `narrazione.js` + `audio/narrazione/` | La voce di demo e Missione Cielo (`narr`). Vedi `NARRAZIONE.md`. |
| `demo-motore.js`, `demo-intro.js`, `demo-libreria.js`, `demo-predefiniti.js`, `demo.js`, `demo-impostazioni.js` | Le demo automatizzate. Vedi `DEMO.md`. |
| `storie-cosmiche.js` | Le Storie cosmiche: volti degli astri in stile «fiaba d'inchiostro» (`stor`). Vedi `STORIE.md`. |
| `config.js` | URL dei ponti ADS-B/Edge-TTS e `ASTROCAL_BUILD`. |
| `worker-adsb.js` | Proxy ADS-B (Deno Deploy), non fa parte della PWA. Vedi `ADSB-PROXY.md`. |
| `dati-*.js` | Cataloghi caricati su richiesta (non in `index.html` né in `ASSETS`). |
| `guida.html`, `guida-en.html` | La guida all'uso (stessi `id` nelle due lingue). |
| `verifica.html` | Il banco di prova dei conti (si apre da un server). |
| `style.css`, `tailwind.css` | Pelle; `tailwind.css` è **generato** (`scripts/costruisci-tailwind.js`) e va caricato prima. |
| `sw.js` | Service worker, `CACHE_NAME`, `ASSETS`. |
| `.github/workflows/pubblica.yml` | Deploy su GitHub Pages (copia, controlla, pubblica). |

**Ordine di caricamento** (quello di `index.html`, e conta): dizionari →
`i18n.js` → manifest e `narrazione.js` → `app.js` → `telescopio.js` →
`catalogo.js` → `costellazioni.js` → `curiosita.js` → `via-lattea.js` →
`scala-cosmica.js` → `corpi-minori.js` → `pianifica.js` → `terreno.js` →
`rilievo.js` → `meteo-astro.js` → `aurora-polare.js` → `config.js` →
`aerei.js` → `transiti.js` → `visione.js` → `inseguimento.js` →
`eventi-extra.js` → `missione-cielo.js` → `ui-nuova.js` → `didattica.js` →
demo (motore, intro, libreria, predefiniti, `demo.js`) → `storie-cosmiche.js`
→ `demo-impostazioni.js`.

Ogni file usa quelli prima di lui; il contrario si protegge **sempre** con
`typeof x === 'function'`. I ganci dentro `app.js` (in `apriSkymap`,
`skyDisegna`, `skyCiclo`, `skyBase`, `solDisegna`, `skyAltezzaOrizzonte`, …)
sono tutti dietro a un `typeof`: senza i moduli, l'app resta quella di prima.
Elenco completo in MAPPA-DETTAGLIATA §2.

## 3. Librerie (da CDN)

`astronomy-engine@2.1.19` (il cuore), `fullcalendar@6.1.15`, `leaflet@1.9.4`,
`satellite.js@5.0.0`. Tailwind non c'è più: è compilato in `tailwind.css`.

## 4. Rete

Servizi tutti senza chiave e tutti con un ripiego: Open-Meteo (meteo, quote,
geocoding), Open-Elevation/OpenTopoData (quote di riserva), tessere Terrarium
su S3 (rilievo), quattro istanze Overpass (paesi, vette, acque), CelesTrak
(TLE), NOAA (Kp), geolocalizzazione da IP, BigDataCloud/Nominatim (nome del
luogo), ADS-B (proxy proprio, poi ponti pubblici). `sw.js` non mette in cache
questi host, tranne le quote del suolo. Tabella con i ripieghi in
MAPPA-DETTAGLIATA §4.

Regole da non rompere:
- `meteoFetch` in `app.js` serializza per host, deduplica gli URL e conserva
  la pausa su 429/503 anche dopo il reload: fuso, meteo, meteo astronomico e
  nuvole passano da lì. **Non aggiungere fetch dirette** a quei servizi.
- `terrenoQuoteRaster` (`terreno.js`) è la riserva quando le API a punti sono
  esaurite; se manca anche lei, si resta col profilo salvato, senza inventare.
- In `aerei.js` il motore chiede a `FontiAerei.acquisisci` e non conosce le
  porte; i feed diretti senza CORS non si tentano di serie
  (`ADSB_PROVA_DIRETTI`); niente `no-cors`. L'aggiornamento automatico nasce
  spento (`stato.auto`). Prove: `node scripts/prova-adsb.js`,
  `node scripts/prova-riserve-rete.js`.

## 5. Le viste

`VISTE` e `mostraVista(nome)` in `app.js` (che accende e spegne cicli, sensori
e fotocamera). Menu: **Stasera**, **Calendario** (Mese, Agenda, Diario come
sottosezioni, `GRUPPI_VISTE`), **Planetario** (nel codice `cielo`),
**Telescopio**, **Didattica**, **Demo**. Il planetario ha quattro pannelli:
Tempo, Eventi, Visualizzazione (schede Direzione, Schermo, Oggetti, Cielo,
Paesaggio) e Astri. La vista 3D del Sistema Solare è `modale-sistema` (`sol`),
con la scala cosmica come quarto quadro. Dettagli in MAPPA-DETTAGLIATA §5.

## 6. Stato e persistenza

Stati principali: `eventiCalcolati`, `sky`, `sol`, `sim`, `tel`, `cat`,
`terreno`, `rilievo`, `acque`, `citta`, `cime`, `aur`, `tran`, `miss`, `narr`,
`stor`. Chiavi di `localStorage` in MAPPA-DETTAGLIATA §9: il backup JSON
esporta quelle che sono preferenze e dati dell'utente, **non** le pagelle di
rete né le memorie di comodo.

## 10. Convenzioni

- **Tutto in italiano** nel codice: nomi, commenti, chiavi.
- **Nessuna frase da leggere nel codice**: `astroI18n.t('chiave')` o
  `data-i18n`, e la frase nei due dizionari. Vale anche per le scritte sulla
  tela. Controllo: `node scripts/controlla-i18n.js`.
- **Prefissi** per modulo (vedi la tabella dei file).
- **Niente disegno pesante a ogni fotogramma**: ciò che è complesso e fermo si
  dipinge una volta su una tela fuori schermo. Lavori lunghi a scaglioni.
- **Commenti discorsivi**: spiegano *perché*, col caso reale che ha portato
  alla scelta. Intestazioni di sezione `// ====` numerate.
- **Nessuna emoji nell'interfaccia**: icone SVG da `DISEGNI` via `icona()`.
- Ogni categoria di eventi in un `try/catch`; ogni servizio di rete ha un
  ripiego e non blocca l'app.
- Tailwind per la struttura, `style.css` per la pelle. I punti di rottura sono
  in `PUNTI_ROTTURA` (`app.js`) **e** in `style.css`: si cambiano insieme.

## 11. Rilascio e verifica

- Niente build: si modifica e si apre nel browser (`python3 -m http.server`).
- Versione: vedi in cima. File nuovo dell'app → aggiungilo ad `ASSETS` in
  `sw.js` (non i `dati-*.js` né le immagini di `arte-costellazioni/`).
- Classe Tailwind nuova → `node scripts/costruisci-tailwind.js`.
- Testo nuovo → `node scripts/controlla-i18n.js --patto` e
  `node scripts/prova-lingua.js`.
- Deploy: ogni push su `main` pubblica su Pages (sorgente «GitHub Actions»). Se
  una modifica unita non compare online, guarda prima la scheda Actions.

Le prove nel browser vogliono `npm install playwright-core astronomy-engine
satellite.js@5.0.0` (Chromium è in `/opt/pw-browsers`). Quale prova lanciare:

| Se tocchi… | Lancia |
|---|---|
| conti astronomici, catalogo, terreno, rilievo, acqua, Via Lattea, aurora, bussola, AR, transiti, aerei (geometria) | `verifica.html` da un server |
| Storie cosmiche | `node scripts/prova-storie.js`, `node scripts/prova-storie-browser.js` |
| narrazione | `prova-narrazione.js`, `controlla-narrazione.js`, `prova-narrazione-browser.js` |
| demo | `prova-demo.js`, `prova-demo-browser.js`, `prova-demo-regia.js`, `prova-demo-pagina.js` (e le `prova-demo-*` del tour toccato) |
| Missione Cielo | `prova-missione.js` (`--solo-motore` per le regole), `prova-missione-stati.js`, `prova-missione-interattiva.js` |
| lingue | `prova-i18n.js`, `prova-lingua.js`, `controlla-i18n.js` |
| giro degli astri / corpi minori a scaglioni | `prova-scaglioni.js` |
| fumetto dell'oggetto | `prova-fumetto.js` |
| registrazione / galleria | `prova-registrazione.js`, `prova-galleria.js` |
| abitati | `prova-abitati.js` |
| rilievo a campo stretto | `prova-rilievo-zoom.js` |
| curiosità | `prova-curiosita.js` |
| transiti, stazioni | `prova-transiti.js`, `prova-stazioni.js` |
| 3D: mondi minori, sonde, satelliti, ricerca | `prova-sistema3d.js` |
| volo planetario ↔ 3D, zoom di passaggio | `prova-volo.js`, `prova-passaggio-zoom.js` |
| scala cosmica | `prova-scala-cosmica.js` |
| AR: etichette e allineamento a mano | `prova-ar-calibrazione.js`, `prova-ar-browser.js` |
| inseguimento aerei | `prova-inseguimento.js` |
| aerei: trasporto e aggregatore | `prova-adsb.js`, `prova-riserve-rete.js` |
| guida | `prova-guida.js` |

Perché ognuna esiste e le sue trappole (rotte di Playwright, `<script>` unici
di `verifica.html` che si portano via le sezioni dopo un errore, copie di
funzioni che divergono): MAPPA-DETTAGLIATA §11.

Cataloghi: si rigenerano con `scripts/costruisci-dati.js` (fonti in
MAPPA-DETTAGLIATA §11, «Rigenerare i cataloghi»).

## 12. Dove guardare

Per un sintomo o una funzionalità precisa, `grep` in MAPPA-DETTAGLIATA §12 (la
tabella «Dove guardare per…»), poi nei documenti dei moduli: `STORIE.md`,
`DEMO.md`, `NARRAZIONE.md`, `I18N.md`, `MISSIONE-CIELO.md`, `ADSB-PROXY.md`,
`EDGE-TTS.md`.
