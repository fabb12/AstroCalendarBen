# AstroCalendario di Ben — mappa del progetto

Guida tecnica ed essenziale per orientarsi nel codice.

---

## 1. Architettura dell'applicazione

PWA in italiano per osservazione astronomica amatoriale (senza backend o build).
- **Stack**: HTML5, CSS3, JavaScript vanilla (globali nello scope `window`). No framework, bundler o pacchetti installati.
- **Calcoli**: Eseguiti in locale via `Astronomy Engine` all'avvio.
- **Offline**: Supportato tramite Service Worker (`sw.js`) e `localStorage`.
- **Lingua**: Tutto il codice, i commenti e l'UI sono rigorosamente in italiano.

---

## 2. Elenco dei File e Moduli

| File | Righe | Contenuto e Responsabilità |
|---|---|---|
| `index.html` | ~1.845 | Struttura statica: viste dell'app, modali, layout responsive. |
| `app.js` | ~24.400 | Logica principale: calcoli astronomici, mappa eclissi, planetario, Sistema Solare 3D. |
| `telescopio.js` | ~5.535 | Vista Telescopio: puntamento, cerchi graduati, push-to, formule ottiche. |
| `catalogo.js` | ~980 | Gestione stelle (5044), costellazioni, oggetti profondi e matrici di rotazione. |
| `costellazioni.js` | ~2.700 | Disegni delle figure, nomi storici delle culture, atlante e distanze 3D. |
| `arte-costellazioni/` | | Immagini dei disegni a mano delle costellazioni. |
| `corpi-minori.js` | ~660 | Lune di Giove, propagazione kepleriana comete e asteroidi. |
| `pianifica.js` | ~500 | Calcolo curve d'altezza, bersagli osservativi e orizzonte locale. |
| `terreno.js` | ~1.230 | Calcolo del terreno (DEM Open-Meteo), luci e nomi delle vette (OSM/Overpass). |
| `meteo-astro.js` | ~515 | Calcolo seeing, trasparenza e previsioni per l'osservazione. |
| `aurora-polare.js` | ~1.015 | Modello geometrico dell'ovale aurorale, magnetosfera e scudo protettivo. |
| `eventi-extra.js` | ~720 | Eventi astronomici aggiuntivi (superlune, opposizioni, transiti, aurore). |
| `ui-nuova.js` | ~350 | Logica dell'interfaccia utente aggiuntiva. |
| `didattica.js` | ~6.100 | Laboratorio 3D: moto retrogrado, leggi di Keplero, fionda, lancio, aurore, costellazioni 3D, rifrazione. |
| `dati-*.js` | Vari | Data-files per stelle, stelle deboli, costellazioni, oggetti profondi, distanze e corpi minori. |
| `verifica.html` | ~905 | Suite di test locali per coordinate, orbite, geometrie e calcoli. |
| `scripts/costruisci-dati.js` | ~430 | Generatore dei file `dati-*.js` da fonti pubbliche. |
| `style.css` | ~7.130 | Foglio di stile: layout responsive, tema "Deep Space" e palette notte. |
| `sw.js` | ~170 | Service Worker per il caching. Richiede l'incremento di `CACHE_NAME` ad ogni rilascio. |

**Ordine di caricamento in `index.html`**:
`app.js` → `telescopio.js` → `catalogo.js` → `costellazioni.js` → `corpi-minori.js` → `pianifica.js` → `terreno.js` → `meteo-astro.js` → `aurora-polare.js` → `eventi-extra.js` → `ui-nuova.js` → `didattica.js`.

---

## 3. Librerie esterne (via CDN)

- `astronomy-engine@2.1.19` (`Astronomy`): Effemeridi, fasi, eclissi, coordinate locali.
- `fullcalendar@6.1.15`: Calendario per la vista Mese.
- `leaflet@1.9.4`: Mappe interattive (eclissi, scelta località).
- `satellite.js@5.0.0`: Propagazione SGP4 per passaggi ISS e Tiangong.
- `cdn.tailwindcss.com`: Utility CSS di base.

---

## 4. Servizi di rete e API (con fallback offline)

| Servizio / API | Uso | Fallback in caso di errore |
|---|---|---|
| Open-Meteo Forecast | Previsioni meteo orarie e astronomiche | Ultimi dati salvati in `localStorage` |
| Open-Meteo Elevation | Quota altimetrica per terreno 3D | Profilo orizzonte predefinito |
| Overpass OSM | Dati città limitrofe e vette montuose | Database locale `ECL_CITTA` / Orizzonte senza nomi |
| Open-Meteo Geocoding | Ricerca coordinate per nome città | Elenco offline locale |
| OpenTopoMap / Esri | Tessere mappa (rilievo/satellite) | Tessere standard OSM o grigie |
| CelesTrak TLE | Coordinate aggiornate satelliti ISS/Tiangong | Nessun passaggio calcolato |
| ipapi.co / get.geojs.io | Geolocalizzazione IP | Selezione manuale della città |
| BigDataCloud / Nominatim | Reverse geocoding (nome località da coordinate) | Capoluogo vicino da `ECL_CITTA` o coordinate |

---

## 5. Le Sette Viste dell'App

1. **Stasera**: Dashboard riassuntiva di meteo, visibilità Luna/pianeti, oggetti migliori e passaggi satelliti.
2. **Mese**: Calendario grafico degli eventi astronomici.
3. **Agenda**: Elenco dettagliato e schede degli eventi con visibilità e strumenti consigliati.
4. **Planetario** (`cielo`): Mappa del cielo interattiva con bussola, Realtà Aumentata (AR), zoom profondo, orbite ed eclissi.
5. **Telescopio**: Allineamento alla Polare, push-to tramite sensori, collimazione e test ottici.
6. **Diario**: Registro osservativo personale e traguardi raggiunti.
7. **Didattica**: Laboratorio interattivo 3D con 8 banchi di prova fisici e astronomici.

---

## 6. Mappa delle Funzionalità Chiave (`app.js`)

- **Calcolo Eventi**: `calcolaEventiAstronomi()` (~676), `aggiungiFasiLunari()`, `aggiungiEclissi*()`.
- **Eclissi Solari**: Calcolo ombra e oscuramento localizzato (~943), render mappa Leaflet (~1858).
- **Planetario (`sky`)**: Gestione orientamento (~7460), proiezione stereografica `skyProietta()` (~6799), disegno cielo `skyDisegna()` (~10271).
- **Sistema Solare 3D**: `apriSistemaSolare()` (~18672), disegno pianeti, orbite e fasce asteroidi/Kuiper.
- **Simulazioni**: `simScena*` (~15806) per riproduzione grafica dinamica degli eventi.
- **Meteo e Satelliti**: `indiceOsservabilita()` (~18248), propagazione TLE satelliti (~18472).

---

## 7. Mappa della Vista Telescopio (`telescopio.js`)

- **Ottica**: Formule di calcolo ingrandimenti e pupilla d'uscita (~243).
- **Allineamento**: Metodo della deriva e puntamento polare assistito (~685).
- **Push-to**: Algoritmo di puntamento basato su accelerometri e magnetometro (~1191).
- **Canvas**: Disegno radar, orologio polare e oculare simulato (~2095).

---

## 8. Variabili di Stato Globale principali

- `sky`: Stato del planetario (canvas, sensori, campo visivo, luogo di visualizzazione).
- `sol`: Parametri della vista 3D del Sistema Solare (assi telecamera, zoom, fasce asteroidi).
- `sim`: Stato della simulazione in corso.
- `tel`: Stato e profilo ottico del Telescopio.
- `cat`: Cache e matrici dei dati delle stelle e degli oggetti di cielo profondo.
- `cost`: Stato dei disegni delle costellazioni e dell'atlante.
- `terreno` / `citta` / `cime`: Dati geografici e geometrici del panorama locale dell'osservatore.
- `stato.lab`: Identifica il banco didattico attivo in `didattica.js`.

---

## 9. Convenzioni di Codice e Sviluppo

- **Nomi e Lingua**: Identificatori in camelCase in italiano (`calcolaEventiAstronomi`).
- **Prefissi dei Moduli**: `sky*` (planetario), `sol*` (3D Sistema Solare), `sim*` (simulazione), `tel*` (telescopio), `did*` (laboratorio), `cost*` (costellazioni).
- **Performance**: Renderizzare una sola volta le texture complesse (es. superfici pianeti) su canvas off-screen, poi usare `drawImage` nel loop di rendering.
- **Fallback**: Ogni chiamata di rete deve fallire silenziosamente o usare una risorsa locale/cache pregressa.
- **Commenti**: Brevi, focalizzati sul funzionamento tecnico del codice. No aneddoti o note personali.

---

## 10. Rilascio, Deploy e Testing

- **PWA Caching**: Incrementare la stringa `CACHE_NAME` in `sw.js` per forzare l'aggiornamento dei client.
- **Deploy**: Automatico tramite GitHub Actions (`pubblica.yml`) al push su `main`.
- **Suite di Test**: Eseguire `verifica.html` tramite un server locale per validare le formule fisiche, la precessione, la conformità delle costellazioni e la visibilità delle cime.

---

## 11. Tabella delle Mappature Funzionali

| Funzionalità da modificare | File / Funzione / Costante di riferimento | Note di Implementazione |
|---|---|---|
| Aggiunta categorie eventi | `app.js` -> `calcolaEventiAstronomi()` / `CATEGORIE` | Assicurare la gestione dell'evento in `creaEvento()`. |
| Calcolo visibilità corpi | `app.js` -> `skyIntervalloCalcolo()` / `skyAggiornaOggetti()` | Calcolo dinamico posizioni in base al FOV per ottimizzare fps. |
| Rendering del Planetario | `app.js` -> `skyDisegna()` | Chiama disegni stelle, figure, costellazioni e aurore. |
| Inseguimento bersaglio | `app.js` -> `skyCentraSu()` / `skyInsegui()` | Movimento fluido verso l'oggetto usando smorzamento esponenziale. |
| Proiezione stereografica | `app.js` -> `skyProietta()` / `skyDirezione()` | Formula srotolata in `catalogo.js` per massimizzare le performance. |
| Terreno e Crinali | `app.js` -> `skyDisegnaTerreno()` / `skyAltezzaOrizzonte()` | Integra DEM con orizzonte personalizzato e rumore procedurale per gli alberi. |
| Nomi e luci orizzonte | `app.js` -> `skyDisegnaNomiOrizzonte()` / `skyDisegnaAloniCitta()` | Evita collisioni etichette e usa scritte con alone. |
| Visualizzazione 3D pianeti | `app.js` -> `solDisegna()` / `solDisegnaCorpo()` | Disegna globo con asse di rotazione reale e fase calcolata. |
| Fasce asteroidali | `app.js` -> `solGeneraFasce()` / `solDisegnaFasce()` | Generazione basata su densità reali (Kirkwood, Kuiper). |
| Sensori di movimento | `app.js` -> `skyAvviaSensori()` / `skyRichiediSensori()` | Su iOS richiede l'attivazione esplicita durante un click handler. |
| Geolocalizzazione | `app.js` -> `trovaPosizioneAStrati()` | Cascata automatica di rilevamento: GPS -> IP Network -> Manuale. |
| Import coordinate Google Maps | `app.js` -> `luogoDaTesto()` | Espressioni regolari per estrarre coordinate da URL e stringhe di ricerca. |
| Zoom Didattica | `didattica.js` -> `didTela()` con opzione `lente` | Disegna con matrice di trasformazione mantenendo nitidi i testi. |
| Rotazione 3D Didattica | `didattica.js` -> `didTela()` con opzione `gira` | Proietta coordinate piane tramite moltiplicazione di matrice 2x2. |
| Calcolo Fionda Gravitazionale | `didattica.js` -> `fiondaIperbole()` / `fiondaCalcola()` | Calcoli orbitali precisi (perielio, velocità asintotica, deviazione). |
| Tracciamento sonde Voyager | `didattica.js` -> `voyStato()` / `VOY_FUGA` | Spline di Catmull-Rom con nodi definiti annualmente. |
| Disegni Costellazioni | `costellazioni.js` -> `COST_ARTE` / `COST_IMMAGINI` | Allineamento ad ancore stellari o regolazione via manopole di rotazione/scala. |
| Lune di Giove | `corpi-minori.js` -> `luneDiGiove()` | Calcolo delle orbite e degli eventi di transito/eclissi. |
| Comete e Asteroidi | `corpi-minori.js` -> `corpiMinoriVisibili()` | Propagatore kepleriano completo basato su parametri orbitali MPC. |
