# AstroCalendario di Ben — mappa del progetto

Guida per orientarsi nel codice **senza doverlo rileggere ogni volta**. Prima di
esplorare, cerca qui la sezione giusta: ogni voce ha il file e l'intervallo di
righe. Le righe sono indicative (±20 dopo qualche modifica): usale come punto di
atterraggio, poi conferma con una `grep` sul nome della funzione.

---

## 1. Cos'è l'app

PWA in italiano per l'osservazione astronomica amatoriale. Risponde a quattro
domande: *cosa succede in cielo*, *si vede da casa mia*, *dove devo guardare*,
*come lo punto col telescopio*.

- **Nessun backend, nessun build.** Si apre `index.html` e funziona.
- **Nessun framework, nessun bundler, nessun `package.json`, nessun test.**
  HTML + CSS + JavaScript vanilla, tutto globale, tutto nello scope `window`.
- Gli eventi astronomici **non arrivano da un server**: sono calcolati nel
  browser da Astronomy Engine all'avvio.
- Funziona **offline** (service worker + `localStorage`).
- Tutto — codice, commenti, identificatori, UI — è **in italiano**.

## 2. File

| File | Righe | Contenuto |
|---|---|---|
| `index.html` | ~880 | Struttura statica: testata, 6 viste, 8 modali. Nessuna logica. |
| `app.js` | ~11.900 | Tutto tranne il telescopio. ~410 funzioni globali. |
| `telescopio.js` | ~5.530 | Vista Telescopio, isolata. ~136 funzioni, prefisso `tel`. |
| `style.css` | ~2.930 | Tema "Deep Space" + impaginazione responsive. |
| `sw.js` | ~105 | Service worker. `CACHE_NAME` va incrementato a ogni rilascio. |
| `manifest.json` | 33 | Manifesto PWA. |
| `icon-*.png`, `apple-touch-icon.png` | | Icone. |

Ordine di caricamento: `app.js` poi `telescopio.js` (che quindi può usare `sky`,
`skyProietta`, `icona`, …; il contrario va protetto con `typeof x === 'function'`).

## 3. Librerie esterne (da CDN, nessuna installata)

| Libreria | Uso |
|---|---|
| `astronomy-engine@2.1.19` (globale `Astronomy`) | **Il cuore.** Effemeridi, fasi, eclissi, sorgere/tramonto, elongazioni. |
| `fullcalendar@6.1.15` | Griglia della vista Mese. |
| `leaflet@1.9.4` | Mappa di visibilità delle eclissi solari. |
| `satellite.js@5.0.0` | Propagazione SGP4 per ISS e Tiangong. |
| `cdn.tailwindcss.com` | Utility di struttura. I colori li ridefinisce `style.css`. |

## 4. Servizi di rete (tutti senza chiave API, tutti opzionali)

| Endpoint | Uso | Se non risponde |
|---|---|---|
| `api.open-meteo.com/v1/forecast` | Meteo orario, nuvolosità, rugiada | Ultimo valore da `localStorage` |
| `geocoding-api.open-meteo.com/v1/search` | Ricerca città | Elenco città locale (offline) |
| `celestrak.org/NORAD/elements/gp.php` | TLE dei satelliti | Niente passaggi |
| `ipapi.co` / `ipwho.is` / `get.geojs.io` | Posizione da IP (ripiego del GPS) | Si chiede a mano |

`sw.js` **esclude deliberatamente questi host dalla cache**: una risposta vecchia
racconterebbe il meteo di ieri o dove eri, non dove sei.

## 5. Le sei viste

Definite in `VISTE` (`app.js:3505`), commutate da `mostraVista(nome)`
(`app.js:3515`), che è anche il posto dove si **accendono e spengono** cicli di
disegno, sensori e fotocamera.

| Vista | Cosa fa |
|---|---|
| **Stasera** (default) | Cosa si vede stanotte da qui: astri, meteo, buio astronomico, passaggi ISS. |
| **Mese** | Calendario FullCalendar con gli eventi calcolati. |
| **Agenda** | Elenco di schede ricche: da qui si vede? con che cielo? con che strumento? |
| **Cielo** | Planetario in tempo reale: punta il telefono, oppure realtà aumentata con la fotocamera, macchina del tempo, playback. |
| **Telescopio** | Allineamento polare, puntamento, programma della serata, manutenzione. |
| **Diario** | Osservazioni registrate e traguardi. |

Modali (in `index.html`): `modale-aggiungi`, `modale-mappa` (eclissi),
`modale-simulazione`, `modale-diario`, `modale-posizione`, `modale-impostazioni`,
`modale-oculare`.

## 6. Mappa di `app.js`

| Righe | Sezione | Funzioni chiave |
|---|---|---|
| 1–45 | Stato globale e costanti | `eventiCalcolati`, `CATEGORIE`, `NOMI_MESI`, `mesiCalcolati` |
| 46–194 | `DISEGNI`: icone SVG inline (stile Lucide, `currentColor`) | `icona(nome, misura)` |
| 195–446 | **0. Il dispositivo** — telefono/tablet/computer decide *quanti* dati mostrare | `profiloDispositivo()`, `quanto(tel,tab,pc)`, `telefonoGirato()` |
| 447–572 | Avvio (`DOMContentLoaded`), navigazione | `creaEvento({...})` ← **ogni evento nasce qui** |
| 573–663 | Eventi di un periodo arbitrario (anche passato) | `calcolaEventiPeriodo()` |
| 664–920 | **1. Calcolo eventi** — fasi lunari, eclissi lunari e solari | `calcolaEventiAstronomi()`, `aggiungiFasiLunari()`, `aggiungiEclissi*()` |
| 921–1451 | **1-bis. Geometria di visibilità delle eclissi solari** | cono d'ombra, oscuramento per località |
| 1452–2596 | **1-ter. La mappa Leaflet**: tracciati, filmato, legenda, schema | `apriMappaEclissi(id)`, `_eclissiAggiornaTutto()` |
| 2597–2749 | Stagioni, sciami meteorici, elongazioni | `aggiungiStagioni()`, `aggiungiSciamiMeteorici()`, `aggiungiElongazioni()` |
| 2750–3018 | **1-bis. Eventi manuali** dell'utente + form | `caricaEventiManuali()`, `inizializzaFormAggiungi()` |
| 3019–3031 | **2.** `inizializzaUI()` |  |
| 3032–3176 | **1-quater.** Scelta del mese (1900–2100), calcolo su richiesta | `inizializzaSelettoriMese()` |
| 3177–3499 | **1-ter.** Ricerca "morbida" (senza accenti) e filtro categorie | `inizializzaRicerca()` |
| 3500–3572 | **3.** Viste e commutazione | `mostraVista()` |
| 3573–3617 | **4. Lettura vocale (TTS)** — parte solo da tasto o notifica | `ORIGINI_VOCE_AMMESSE` |
| 3618–3764 | **5. Notifiche e promemoria** | `inizializzaNotifiche()` |
| 3765–3814 | **6. Installazione PWA** | `inizializzaInstallazione()` |
| 3815–4361 | **7. Cielo in diretta** — stato `sky`, algebra Est/Nord/Alto, filtro anti-tremolio bussola, campo visivo AR | `sky` (**3938**), `skyProietta()`, `skyVettore()` |
| 4362–5057 | **7.1** Posizione e sensori; **7.1-bis** posizione a tre strati (GPS → IP → a mano) | `skyRichiediPosizione()`, `posizioneDallaRete()`, declinazione magnetica |
| 5058–5285 | **7.2** Posizioni degli astri (Sole, Luna, pianeti, stelle `Star1…Star8`) | |
| 5286–6266 | **7.3** Disegno del cielo: colore del fondo per ora del giorno, Via Lattea, aloni delle stelle | `skyDisegna()` |
| 6267–7254 | **7.4** Interfaccia della vista Cielo e scheda dell'oggetto | `inizializzaSkymap()` (**7075**) |
| 7255–7379 | **7.5** Schermo intero | |
| 7380–8688 | **8. Simulazione dell'evento** — stato `sim` (**7404**), una scena per tipo | `simScenaEclissiLunare/Solare/FaseLunare/Stagioni/Sciame/Elongazione/Cielo` |
| 8689–8864 | **9. Congiunzioni e occultazioni** | |
| 8865–8898 | **10. La posizione usata da tutta l'app** | `luogoCorrente()` |
| 8899–9491 | **10-bis. Finestra della posizione** + ricerca città (locale, poi Open-Meteo) | `apriPosizione(forza)`, `inizializzaPosizioneUI()` |
| 9492–9666 | **11. Meteo e indice di osservabilità** | `indiceOsservabilita(evento)` |
| 9667–9715 | **12. Strumento necessario** (occhio / binocolo / telescopio) | `STRUMENTI` |
| 9716–10113 | **13. Passaggi di ISS e Tiangong** (SGP4) | `SATELLITI` |
| 10114–10379 | **14. Vista "Stasera"** | `costruisciStasera()` |
| 10380–10581 | **15. Diario e traguardi** | `TRAGUARDI` (**10417**), `caricaDiario()` |
| 10582–10962 | **16. Condivisione (`?evento=`), export `.ics`, backup JSON** | `esportaBackup()`, `urlEvento(id)` |
| 10963–11014 | **17. Consigli di astrofotografia** | `consigliFoto(evento)` |
| 11015–11778 | **18. Costellazioni e deep sky**, macchina del tempo, playback, fotocamera AR | `SKY_COSTELLAZIONI` (**11023**), `skyImpostaOffsetTempo()` |
| 11779–11896 | **19. Schede dell'agenda arricchite** | `bloccoLocaleHtml()`, `barraAzioniHtml()` |

## 7. Mappa di `telescopio.js`

Tutto ha prefisso `tel`; stato unico in `tel` (`telescopio.js:168`).

| Righe | Sezione |
|---|---|
| 1–49 | Intestazione e chiavi di `localStorage` |
| 50–242 | **1. Profilo dello strumento**: apertura, focale, oculari, Barlow; telescopi preimpostati |
| 243–353 | Formule ottiche (ingrandimento, campo reale, pupilla d'uscita, magnitudine limite) |
| 354–475 | Coordinate: da J2000 alla data di oggi |
| 476–510 | Catalogo di stelle (riusa quello delle costellazioni di `app.js`) |
| 511–684 | Oggetti puntabili: pianeti, Luna, deep sky, con dimensione apparente e aspetto reale |
| 685–1190 | **2. Allineamento polare**: sensori come livella/goniometro/bussola, allineamento per deriva |
| 1191–1774 | **3. Puntare**: (a) cerchi graduati digitali, (b) salti di stella, (c) push-to col telefono sul tubo |
| 1775–1976 | **4. La serata**: programma ordinato, punto di rugiada (Magnus) |
| 1977–2026 | **5. Manutenzione**: collimazione guidata e test stellare |
| 2027–2094 | **6. Cosa vedrò davvero**: contrasto contro il fondo cielo |
| 2095–3225 | **7. I disegni** (canvas): orologio della Polare, bussola, bolla, goniometro, radar push-to, carta stellare, **oculare**, test stellare |
| 3226–5419 | **8. Pannelli della vista**: `strumento`, `allineamento`, `punta`, `serata`, `cura` |
| 5420–5533 | **9. Avvio e agganci** con il resto dell'app (`telDisegnaPoloSuCielo` disegna il polo celeste dentro la vista Cielo) |

## 8. Stato globale

| Nome | Dove | Cos'è |
|---|---|---|
| `eventiCalcolati` | `app.js:2` | L'elenco di tutti gli eventi. Fonte unica per calendario, agenda, stasera. |
| `impronteEventi` / `mesiCalcolati` | `app.js:16,24` | Anti-duplicazione quando si calcola un mese su richiesta. |
| `vistaAttuale` | `app.js:234` | Serve a chi ridisegna dopo un cambio di schermo. |
| `dispositivoAttuale` | `app.js:233` | `'telefono' \| 'tablet' \| 'computer'`, scritto anche su `<html data-dispositivo>`. |
| `sky` | `app.js:3938` | Vista Cielo: canvas, posizione, sensori, fov, target, tempo. |
| `sim` | `app.js:7404` | Simulazione: canvas, scena, posizione nel tempo, velocità. |
| `tel` | `telescopio.js:168` | Telescopio: profilo, pannello, allineamento, push-to. |

## 9. Persistenza (`localStorage`, tutte le chiavi)

| Costante | Chiave |
|---|---|
| `CHIAVE_EVENTI_MANUALI` | `astrocalendario_eventi_manuali` |
| `CHIAVE_NOTIFICHE_INVIATE` | `astrocalendario_notifiche_inviate` |
| `CHIAVE_SKY_POSIZIONE` | `astrocalendario_posizione` |
| `CHIAVE_SKY_BUSSOLA` | `astrocalendario_bussola_offset_v2` |
| `CHIAVE_SKY_CAMERA` | `astrocalendario_camera_campo` |
| `CHIAVE_METEO` | `astrocalendario_meteo` |
| `CHIAVE_DIARIO` | `astrocalendario_diario` |
| `CHIAVE_TEL_PROFILO` | `astrocalendario_telescopio_v1` |
| `CHIAVE_TEL_SESSIONE` | `astrocalendario_telescopio_sessione_v1` |

Il backup JSON (sezione 16) esporta e reimporta esattamente questo insieme.

## 10. Convenzioni

- **Tutto in italiano**: `calcolaEventiAstronomi`, `aggiungiFasiLunari`,
  `luogoCorrente`. Non introdurre nomi inglesi.
- **Prefissi**: `sky*` = vista Cielo, `sim*` = simulazione, `tel*` = telescopio,
  `_ecl*` = interni della mappa eclissi.
- **Commenti discorsivi**: spiegano *perché*, non *cosa*, spesso con l'aneddoto
  del caso reale che ha portato alla scelta. Mantieni questo registro.
- **Intestazioni di sezione**: blocco `// ====` numerato. Sono l'indice del file
  — se aggiungi una sezione, aggiungine una anche qui.
- **Nessuna emoji nell'interfaccia**: solo icone SVG da `DISEGNI` via `icona()`.
- **Ogni categoria di eventi è in un `try/catch`**: se una fallisce, le altre
  devono comunque comparire.
- **Ogni servizio di rete ha un ripiego** e non deve mai bloccare l'app.
- **Colori e struttura**: Tailwind per la struttura, `style.css` per la pelle.
  I punti di rottura sono duplicati (`PUNTI_ROTTURA` in `app.js:211` e
  `style.css`) — **vanno cambiati in entrambi i posti**.

## 11. Rilascio e verifica

- **Non c'è build.** Si modificano i file e si aprono nel browser.
- **Non ci sono test.** La verifica è aprire l'app e guardare la vista toccata.
- **Dopo ogni modifica ai file dell'app, incrementa `CACHE_NAME` in `sw.js`**
  (oggi `astrocal-v27`): senza questo, chi ha già installato la PWA continua a
  vedere la versione vecchia.
- Se aggiungi un file all'app, aggiungilo anche a `ASSETS` in `sw.js`.

## 12. Dove guardare per…

| Richiesta | Punto di partenza |
|---|---|
| Nuovo tipo di evento astronomico | `calcolaEventiAstronomi()` `app.js:669` + una `aggiungi…()`, poi `CATEGORIE` `app.js:36` |
| Nuova scena della simulazione | `app.js:7603` (costruzione scena) e una `simScena*` |
| Qualcosa nel planetario | `sky` `app.js:3938`, disegno da `app.js:5286` |
| Bussola sbagliata / cielo storto | filtro anti-tremolio `app.js:4072`, declinazione `app.js:4366` |
| Posizione non rilevata | posizione a strati `app.js:4811`, finestra `app.js:8899` |
| Meteo o semaforo di osservabilità | `app.js:9492` |
| Calcoli ottici del telescopio | `telescopio.js:243` |
| Impaginazione su telefono | `PUNTI_ROTTURA` `app.js:211` + `style.css:1537` e `style.css:2808` |
| Nuova icona | `DISEGNI` `app.js:53` |
