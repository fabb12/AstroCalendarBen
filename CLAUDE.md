# AstroCalendario di Ben — mappa del progetto

Guida sintetica per orientarsi nel codice.

## 1. Cos'è l'app
PWA offline-first in italiano per l'osservazione astronomica amatoriale.
- **Architettura:** HTML vanilla, CSS (Tailwind CDN + `style.css`), JS globale (scope `window`). Nessun framework o bundler.
- **Calcoli:** Eseguiti interamente nel browser tramite Astronomy Engine all'avvio.
- **Offline:** Gestito da Service Worker (`sw.js`) e `localStorage`.

## 2. Elenco dei File principali

| File | Descrizione |
|---|---|
| `index.html` | Struttura statica (viste, modali, layout). Nessuna logica. |
| `app.js` | Core dell'applicazione (avvio, calcolo eventi, skymap, coordinate, 3D). |
| `telescopio.js` | Vista Telescopio (allineamento polare, puntamento, formule ottiche). |
| `catalogo.js` | Gestione delle stelle (5044 stelle, 88 costellazioni, oggetti profondi). |
| `costellazioni.js` | Disegni e nomi storici delle costellazioni. |
| `corpi-minori.js` | Orbite e posizioni di comete, asteroidi e lune di Giove. |
| `pianifica.js` | Curve di altezza per l'osservazione e calcolo degli ostacoli. |
| `terreno.js` | Gestione del terreno reale (altimetria Open-Meteo, ostacoli, nomi vette). |
| `meteo-astro.js` | Previsioni meteo astronomiche (seeing, trasparenza). |
| `aurora-polare.js` | Simulazione e disegno dell'ovale aurorale. |
| `eventi-extra.js` | Calcolo eventi speciali (superlune, congiunzioni, transiti, aurore). |
| `ui-nuova.js` | Aggiornamenti dell'interfaccia utente. |
| `didattica.js` | Laboratorio didattico 3D (moto retrogrado, Keplero, fionde gravitazionali, lanci). |
| `dati-*.js` | Cataloghi astronomici (stelle, costellazioni, distanze, corpi minori). Caricati su richiesta. |
| `sw.js` | Service Worker per la cache offline. |
| `verifica.html` | Pagina dei test di validità e calcolo astronomico. |

**Ordine di caricamento in `index.html`:**
`app.js` -> `telescopio.js` -> `catalogo.js` -> `costellazioni.js` -> `corpi-minori.js` -> `pianifica.js` -> `terreno.js` -> `meteo-astro.js` -> `aurora-polare.js` -> `eventi-extra.js` -> `ui-nuova.js` -> `didattica.js`

**Principali ganci (`typeof` guard) in `app.js`:**
- `apriSkymap()`: carica cataloghi, comete, terreno, città, aurore.
- `skyDisegna()`: disegna stelle, costellazioni, arte, aurore.
- `calcolaEventiIntervallo()`: include eventi extra.
- `skyAltezzaOrizzonte()`: interpola terreno ed ostacoli.

## 3. Librerie esterne (da CDN)
- `astronomy-engine@2.1.19` (global `Astronomy`): Calcoli astronomici ed effemeridi.
- `fullcalendar@6.1.15`: Vista calendario mensile.
- `leaflet@1.9.4`: Mappe interattive per eclissi e luoghi.
- `satellite.js@5.0.0`: Propagazione TLE (ISS e Tiangong).
- `cdn.tailwindcss.com`: Struttura e layout responsive.

## 4. Servizi di rete (opzionali con fallback offline)
- **Open-Meteo:** Previsioni meteo orarie e altimetria del terreno.
- **Overpass API (OSM):** Dati su paesi limitrofi (inquinamento luminoso) e vette montuose.
- **CelesTrak:** TLE aggiornati per satelliti.
- **Reverse Geocoding (BigDataCloud, Nominatim):** Determinazione del nome del comune dalle coordinate.

## 5. Le sette viste
1. **Stasera:** Dashboard con meteo, Luna, oggetti consigliati e passaggi satellitari.
2. **Mese:** Calendario mensile degli eventi astronomici.
3. **Agenda:** Schede dettagliate degli eventi con visibilità e strumenti consigliati.
4. **Planetario (`cielo`):** Skymap 3D in tempo reale (sensori, realtà aumentata, zoom, facce reali degli astri, eclissi, aurore).
5. **Telescopio:** Allineamento polare, cerchi graduati e programma della serata.
6. **Diario:** Registro delle osservazioni e traguardi raggiunti.
7. **Didattica:** Laboratori interattivi 3D (leggi di Keplero, fionda gravitazionale, finestre di lancio, costellazioni 3D, rifrazione al tramonto).

## 6. Mappa delle funzioni chiave in `app.js`
- **Calcolo eventi:** `calcolaEventiAstronomi()`, `aggiungiFasiLunari()`, `aggiungiEclissi*()`.
- **Inizializzazione UI:** `inizializzaUI()`, `mostraVista()`, `inizializzaRicerca()`.
- **Sensori e Posizione:** `skyRichiediPosizione()`, `trovaPosizioneAStrati()`, `skyAvviaSensori()`.
- **Disegno planetario:** `skyAria()`, `skyDisegnaSfondo()`, `skyDisegnaTerreno()`, `skyDisegnaLuna()`, `skyDisegnaPianeta()`, `skyDisegnaSole()`.
- **Interazione ed Inseguimento:** `skyCentraSu()`, `skyInsegui()`, `skyInizializzaGesti()`, `skyCiclo()`.
- **Sistema Solare 3D:** `apriSistemaSolare()`, `solProietta()`, `solDisegna()`, `solInquadraDaTerra()`.
- **Lezione Eclittica:** `apriLezioneEclittica()`, `lezQuadro*()`.

## 7. Mappa di `telescopio.js` (prefisso `tel`)
- **Configurazione ottica:** `tel` (stato globale), calcolo ingrandimento, pupilla e magnitudine limite.
- **Allineamento:** Allineamento polare guidato tramite giroscopio o metodo della deriva.
- **Puntatori:** Push-to tramite sensori del telefono, cerchi graduati e salti di stella (star-hopping).

## 8. Stato globale dei moduli
- `sky` (`app.js`): Stato del planetario (canvas, sensori, fov, orologio, localizzazione).
- `sol` (`app.js`): Stato della vista Sistema Solare 3D (camera, orbite, fasce asteroidi/Kuiper).
- `sim` (`app.js`): Stato delle animazioni e simulazioni degli eventi.
- `tel` (`telescopio.js`): Configurazione dello strumento e puntamento.
- `cat` (`catalogo.js`): Coordinate correnti e magnitudini delle stelle.
- `cost` (`costellazioni.js`): Stato delle costellazioni, ancore e visualizzazione artistica.
- `terreno` / `cime` / `citta` (`terreno.js`): Altimetria locale, profili 3D delle montagne ed elenco luci dei paesi.
- `meteoAstro` / `aurora` (`meteo-astro.js`): Previsioni, seeing e indice Kp corrente.
- `stato` / `LABORATORI` (`didattica.js`): Stato del laboratorio didattico corrente.

## 9. Persistenza (`localStorage`)
Utilizza chiavi prefissate con `astrocalendario_` per impostazioni utente, posizione dell'app, diario delle osservazioni, profilo telescopio, orizzonte personalizzato e cataloghi di comete customizzate. Un backup JSON consente di esportare/importare l'intero set.

## 10. Convenzioni di sviluppo
- **Lingua:** Tutto in italiano (codice, commenti, variabili, UI). Non introdurre nomi in inglese.
- **Prefissi:** `sky*` (planetario), `sol*` (Sistema Solare 3D), `sim*` (simulazioni), `tel*` (telescopio), `_ecl*` (mappa eclissi), `did*` (didattica), `aur*` (aurore planetario), `cost*` (costellazioni).
- **Ottimizzazione:** Evitare il rendering pesante a ogni fotogramma. Utilizzare canvas off-screen per elementi statici (es. superfici dei pianeti, corona solare).
- **Stile:** Tailwind per il layout, `style.css` per il tema personalizzato ("Deep Space"). I breakpoint responsive devono coincidere tra JS (`PUNTI_ROTTURA`) e CSS.
- **Sicurezza e robustezza:** Ogni calcolo di eventi o servizio di rete deve essere protetto da `try/catch` per evitare blocchi dell'app in caso di dati parziali o offline.

## 11. Rilascio e Verifica
- **Build:** Nessuno. Il deploy su GitHub Pages avviene tramite workflow GitHub Actions (`.github/workflows/pubblica.yml`) che copia i file direttamente.
- **Versione Cache:** All'aggiornamento dei file statici, incrementare sempre `CACHE_NAME` in `sw.js` (es. `astrocal-v86`) per invalidare la cache dei client.
- **Banco di prova (`verifica.html`):** Suite di test locali eseguibili via web server (`python3 -m http.server 8000`). Controlla la precisione dei calcoli astronomici, coordinate stellari, geometria della fionda gravitazionale, visibilità orizzonte e integrità dei tracciati delle costellazioni.
- **Rigenerazione cataloghi:** Il file `scripts/costruisci-dati.js` genera i file `dati-*.js` combinando database pubblici come d3-celestial, Stellarium e HYG database.

## 12. Punti di ingresso per modifiche e debug

### Planetario e Coordinate
- **Nuovo evento astronomico:** Aggiungere in `calcolaEventiAstronomi()` (`app.js`) ed aggiornare `CATEGORIE` (`app.js`).
- **Proiezioni e FOV:** Gestiti da `skyProietta()` (proiezione stereografica conforme) e `skyImpostaFov()` (`app.js`). Sotto i 12° la Via Lattea si disattiva per mostrare le stelle del catalogo.
- **Eclisse di Sole:** Calcolata in `skyEclisseDiSole()`. La Luna viene spostata dinamicamente sul Sole tramite `skyPosaLunaEclissata()` per mantenere corretto il fattore di copertura grafica indipendentemente dallo zoom.
- **Sincronizzazione orologio:** `sky.offsetTempoSec` è l'orologio unico condiviso tra planetario, mappa dell'ombra ed il modulo 3D.

### Vista 3D (Sistema Solare)
- **Visualizzazione corpi celesti:** Gestito in `solDisegna()`. Per evitare sovrapposizioni visive di corpi retrostanti, il Sole e la Luna sono divisi in livelli di rendering e ordinati per profondità.
- **Interazione e gesture:** `solInizializzaGesti()` gestisce rotazioni della camera, zoom, pan con due dita e centratura dinamica (su Sole o Terra tramite `sol.centratoTerra`).

### Orizzonte e Terreno
- **Profilo altimetrico:** `skyAltezzaOrizzonte()` combina l'altimetria Copernicus DEM (`terreno.js`), gli ostacoli utente (`pianifica.js`) ed il dettaglio fittizio della vegetazione (`SKY_ALBERI`). Sul mare, la vegetazione non viene applicata.
- **Nomi delle montagne:** Dati caricati da Overpass in `cimeVisibili()`. Vengono visualizzate solo le vette non coperte dall'orizzonte locale calcolato.
- **Luci delle città:** Disegnate come cupole luminose sbiadite in `skyDisegnaAloniCitta()`, basate sulla legge di Walker in `cittaCarica()`.

### Didattica (Laboratorio)
- **Struttura dei banchi:** Ogni laboratorio implementa i metodi `costruisci()`, `collega()`, `passo(dt)` e `disegna()`. Gestito in modo che solo il laboratorio attivo a schermo esegua i calcoli.
- **Lente e Ingrandimento:** `didTela()` gestisce il resize nitido dei canvas ed un eventuale fattore di ingrandimento locale (`lente`) senza alterare i sistemi di coordinate interni dei banchi.
- **Fionda Gravitazionale:** Calcoli fisici dell'orbita iperbolica in `fiondaIperbole()`. La traiettoria integra numericamente l'equazione del moto (velocity-Verlet) con passo adattivo basato sulla distanza dal pianeta per garantire massima precisione al perielio.
