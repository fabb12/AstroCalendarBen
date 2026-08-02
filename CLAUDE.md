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
| `index.html` | ~1.375 | Struttura statica: testata, 6 viste, 10 modali. Nessuna logica. |
| `app.js` | ~20.470 | Tutto tranne il telescopio. |
| `telescopio.js` | ~5.535 | Vista Telescopio, isolata. ~136 funzioni, prefisso `tel`. |
| `style.css` | ~4.390 | Tema "Deep Space" + impaginazione responsive. |
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

Definite in `VISTE` (`app.js:5749`), commutate da `mostraVista(nome)`
(`app.js:5759`), che è anche il posto dove si **accendono e spengono** cicli di
disegno, sensori e fotocamera.

Il **nome logico** di una vista non è la sua etichetta. La vista `cielo` si
chiama **Planetario** sullo schermo — e `planetario` è la parola usata in tutti
i testi — ma resta `cielo` nel codice, nelle classi CSS (`vista-cielo`,
`tasto-cielo`) e nei link già condivisi (`?vista=cielo`).

| Vista | Cosa fa |
|---|---|
| **Stasera** (default) | Cosa si vede stanotte da qui: astri, meteo, buio astronomico, passaggi ISS. |
| **Mese** | Calendario FullCalendar con gli eventi calcolati. |
| **Agenda** | Elenco di schede ricche: da qui si vede? con che cielo? con che strumento? |
| **Planetario** (nel codice `cielo`) | Il cielo in tempo reale: punta il telefono, oppure realtà aumentata con la fotocamera, macchina del tempo, playback, zoom fino a un quarto di grado (Luna e pianeti a grandezza vera, **con la loro faccia**: mari, bande, anelli, calotte), eclissi con corona e ombra della Terra, orizzonte con le colline, registrazione di un filmato da condividere, e il **Sistema Solare visto da fuori in 3D** — la stessa ora, ma guardata da lontano, per capire perché i pianeti stanno proprio lì. Nel pannello **Tempo e luogo** si può anche spostare il punto di vista in un'altra città: vale solo qui, la posizione dell'app non si tocca. |
| **Telescopio** | Allineamento polare, puntamento, programma della serata, manutenzione. |
| **Diario** | Osservazioni registrate e traguardi. |

Modali (in `index.html`): `modale-aggiungi`, `modale-mappa` (eclissi),
`modale-simulazione`, `modale-lezione` (che cos'è l'eclittica),
`modale-sistema` (il Sistema Solare in 3D), `modale-diario`, `modale-posizione`,
`modale-impostazioni`, `modale-oculare`.

## 6. Mappa di `app.js`

| Righe | Sezione | Funzioni chiave |
|---|---|---|
| 1–52 | Stato globale e costanti | `eventiCalcolati` (**2**), `CATEGORIE` (**36**), `NOMI_MESI`, `mesiCalcolati` |
| 53–194 | `DISEGNI`: icone SVG inline (stile Lucide, `currentColor`) | `icona(nome, misura)` (**162**) |
| 195–449 | **0. Il dispositivo** — telefono/tablet/computer decide *quanti* dati mostrare | `profiloDispositivo()`, `quanto(tel,tab,pc)`, `telefonoGirato()` |
| 450–580 | Avvio (`DOMContentLoaded`), navigazione | `creaEvento({...})` (**552**) ← **ogni evento nasce qui** |
| 581–671 | Eventi di un periodo arbitrario (anche passato) | `calcolaEventiIntervallo()` (**588**) |
| 672–942 | **1. Calcolo eventi** — fasi lunari, eclissi lunari e solari | `calcolaEventiAstronomi()` (**676**), `aggiungiFasiLunari()`, `aggiungiEclissi*()` |
| 943–1857 | **1-bis. Geometria di visibilità delle eclissi solari** | cono d'ombra, oscuramento per località |
| 1858–2936 | **1-ter. La mappa Leaflet**: tracciati, filmato, legenda, schema, terminatore (giorno/notte), schermo intero della mappa | `apriMappaEclissi(id)`, `_eclissiAggiornaTutto()`, `_eclDisegnaNotte()`, `_eclAlternaSchermoIntero()` (**4602**) |
| 2937–3174 | **1-ter-bis.** Il cielo sarà sereno? (meteo dell'eclissi) | |
| 3175–3264 | **1-ter-ter.** Portarsela dietro (condividere l'eclissi) | |
| 3265–3506 | **1-quater.** Le eclissi di casa tua | |
| 3507–4832 | **1-quinquies.** Le eclissi lunari | |
| 4833–4985 | Stagioni, sciami meteorici, elongazioni | `aggiungiStagioni()` (**4833**), `aggiungiSciamiMeteorici()` (**4869**), `aggiungiElongazioni()` |
| 4986–5254 | **1-bis. Eventi manuali** dell'utente + form | `caricaEventiManuali()` (**4990**), `inizializzaFormAggiungi()` (**5150**) |
| 5255–5267 | **2.** `inizializzaUI()` | |
| 5268–5412 | **1-quater.** Scelta del mese (1900–2100), calcolo su richiesta | `inizializzaSelettoriMese()` (**5274**) |
| 5413–5741 | **1-ter.** Ricerca "morbida" (senza accenti) e filtro categorie | `inizializzaRicerca()` (**5522**) |
| 5742–5817 | **3.** Viste e commutazione | `VISTE` (**5749**), `mostraVista()` (**5759**) |
| 5818–5862 | **4. Lettura vocale (TTS)** — parte solo da tasto o notifica | `ORIGINI_VOCE_AMMESSE` (**5823**) |
| 5863–6045 | **5. Notifiche e promemoria** | `inizializzaNotifiche()` (**6011**) |
| 6046–6095 | **6. Installazione PWA** | `inizializzaInstallazione()` (**6050**) |
| 6096–6747 | **7. Il planetario** — stato `sky`, algebra Est/Nord/Alto, filtro anti-tremolio bussola, limiti del campo visivo, campo visivo AR | `sky` (**6221**), `sky.reg` (**6361**), `skyVettore()` (**6386**), `SKY_FOV_MIN` (**6572**)/`skyImpostaFov()` (**6589**), `skyProietta()` (**6721**) |
| 6748–7456 | **7.1** Posizione e sensori; **7.1-bis** posizione a tre strati (GPS → IP → a mano) | `skyRichiediPosizione()` (**7117**), `posizioneDallaRete()`, `trovaPosizioneAStrati()` (**7358**), declinazione magnetica (**6781**) |
| 7457–7707 | **7.1-ter** Il luogo da cui si guarda: il planetario può spostare l'occhio altrove senza toccare la posizione dell'app | `skyLuogoDelCielo()` (**7478**), `skyAggiornaOsservatore()` (**7494**), `skyImpostaLuogoVista()`, `skyTornaAlLuogoDiCasa()`, `skyInizializzaLuogoVista()` (**7610**) |
| 7708–8048 | **7.2** Posizioni degli astri (Sole, Luna, pianeti, stelle `Star1…Star8`); qui si calcolano anche l'ombra della Terra sulla Luna e l'apertura degli anelli di Saturno. Ogni quanto rifarle non è fisso: si adatta a quanto si è ingranditi (mezzo pixel di movimento del cielo), mentre i numeri scritti attorno alla mappa vanno più piano | `skyIntervalloCalcolo()` (**7745**), `SKY_UI_INTERVALLO` (**7743**), `skyAggiornaOggetti()` (**7752**), `skyOmbraDellaTerra()` (**7849**), `skyAssettoDiSaturno()` (**7889**) |
| 8049–8370 | **7.3 / 7.3.1** Disegno del cielo e aspetto dell'aria: colore del fondo per ora del giorno, foschia, aloni, Via Lattea | `skyAria()`, `skyDisegnaSfondo()` (**8138**), `skyDisegnaViaLattea()` |
| 8371–9870 | **7.3.2 La pelle degli astri** — le facce vere, dipinte una volta sola su tele fuori schermo: Luna coi mari, Sole con granulazione e corona, pianeti con bande e calotte, nebulose e galassie, profilo dell'orizzonte, eclissi | `skyPelle()` (**8429**), `SKY_FACCE` (**9062**), `skyFacciaDi()` (**9079**), `skyDisegnaGlobo()` (**9280**), `SKY_PROFILO` (**9377**), `skyDisegnaTerreno()` (**9521**), `skyDisegnaLuna()` (**9694**), `skyDisegnaPianeta()` (**9791**), `skyDisegnaSole()` (**9830**), `skyEclisseDiSole()` (**9892**) |
| 9871–10464 | **7.3 (seguito)** Misura degli astri (icona o disco vero), disegno di ogni astro, ciclo di disegno | `skyRaggio(o, focale)` (**9943**), `skyDisegnaAstro()` (**10004**), `skyDisegna()` (**10267**) |
| 10465–10603 | **7.3-bis** Traccia dell'oggetto osservato: la strada che percorre nelle ore attorno all'istante mostrato, con l'ora segnata di ora in ora | `skyCalcolaTraccia()` (**10497**), `skyDisegnaTraccia()`, `SKY_TRACCIA_ORE` (**10478**) |
| 10604–11022 | **7.3-ter** Eclittica: il cerchio del Sole in un anno, coi puntini dei mesi e il filo a piombo che misura quanto l'oggetto scelto sta sopra o sotto. Insieme a lei l'**analemma** (il Sole alla stessa ora ogni giorno per un anno) | `skyCalcolaEclittica()` (**10684**), `skyDisegnaEclittica()`, `skyScartoEclittica()`, `skyCalcolaAnalemma()` (**10873**) |
| 11023–12057 | **7.3-quater** La lezione dell'eclittica: sei quadri animati (Sistema Solare dall'alto → di taglio → il piano → la riga vista da qui → l'analemma → i nodi e le eclissi). Si apre dal tasto nella scheda del Sole | `LEZ_CAPITOLI` (**11055**), `lez`, `apriLezioneEclittica()`, `lezQuadroSistema/Cielo/Analemma/Nodi()`, `stagioneEclissiHtml()` (**12004**) |
| 12058–12533 | **7.4** Interfaccia del planetario e scheda dell'oggetto (si apre **solo** toccando l'oggetto sulla mappa), inseguimento | `skyAlternaInseguimento()`, `skyInsegui()`, `skyAggiornaTastoInsegui()` (tiene d'accordo i due tasti: quello del pannello Navigazione e il bersaglio sulla mappa) |
| 12534–13017 | **7.4-bis** Eventi del calendario dentro il planetario: elenco (in corso, ore vicine, **prossimi 7 giorni**), chip e segni sulla mappa (radiante, anello sull'astro eclissato) | `skyEventiVicini()` (**12585**), `skyTastoMappaHtml()` (**12680**), `skyApriMappaEvento()` (**12695**), `skyAggiornaEventi()` (**12769**), `apriEventoNelPlanetario(id)` (**12858**) |
| 13018–13367 | **7.4-ter Movimenti morbidi** — perché il cielo non faccia scatti: inerzia del trascinamento (si lascia andare e si spegne da sé), zoom che ci scivola dentro invece di saltarci, spostamento verso un oggetto con partenza e arrivo lisci. Tutti smorzamenti esponenziali col `dt` del fotogramma, per comportarsi uguale a qualunque cadenza | `skyDeltaFotogramma()` (**13041**), `skyMuoviZoom()` (**13055**), `skyGradiAzPerPixel()` (**13097**), `skyRicordaTrascinamento()` (**13105**), `skyLanciaVista()` (**13122**), `skyScorriPerInerzia()` (**13135**), `skyFermaMovimenti()` (**13153**), `skyCentraSu()` (**13161**), `skyInsegui()`, `skyMuoviVista()` |
| 13368–13913 | **7.4-quater** Avvio della vista, ciclo di disegno, gesti (trascinamento, pizzico, tocco, rotellina) e collegamento di tutti i comandi | `skyAvvia()`, `skyCiclo()` (**13416**), `apriSkymap()`, `skyZoom()` (**13491**), `skyInizializzaGesti()` (**13504**), `inizializzaSkymap()` (**13670**) |
| 13914–14052 | **7.5** Schermo intero (dal pannello Visualizzazione, dal ⛶ sulla mappa, con Esc o col doppio clic) | `skyAlternaSchermoIntero()` (**13928**), `skyAggiornaTastiSchermo()` (**14002**) |
| 14053–14494 | **7.6 Registrare un momento**: pochi secondi di cielo in un filmato (MediaRecorder, mp4 dove c'è, se no webm) da condividere o salvare. Il tasto sta sulla mappa, non in un pannello | `skyRegAvvia()` (**14225**), `skyRegComponi()`, `skyRegFirma()`, `skyRegFerma()`, `skyRegAggiornaComando()`, `skyRegCondividi()` |
| 14495–15493 | **7.7 Il Sistema Solare in 3D** — la stessa ora del planetario, ma guardata da fuori: posizioni vere in proiezione **ortogonale**, orbite campionate per un giro intero, filo a piombo sul piano dell'eclittica e la riga che unisce la Terra all'oggetto scelto. Si gira col dito (dall'alto → di taglio), si pizzica per avvicinarsi, si tocca un pianeta per sceglierlo; il tempo che si muove qui è quello del planetario | `SOL_PIANETI` (**14533**), `sol` (**14562**), `solProietta()` (**14615**), `solLeggiPosizioni()` (**14654**), `solCalcolaOrbite()` (**14682**), `solDisegna()` (**14947**), `solElongazione()` (**15017**), `solInizializzaGesti()` (**15275**), `apriSistemaSolare()` (**15354**) |
| 15494–17111 | **8. Simulazione dell'evento** — stato `sim` (**15517**), una scena per tipo | `simScenaEclissiLunare/Solare/FaseLunare/Stagioni/Sciame/Elongazione/Cielo` |
| 17112–17287 | **9. Congiunzioni e occultazioni** | |
| 17288–17321 | **10. La posizione usata da tutta l'app** | `luogoCorrente()` (**17298**) |
| 17322–17921 | **10-bis. Finestra della posizione** + ricerca città (locale, poi Open-Meteo) | `apriPosizione(forza)` (**17376**), `inizializzaPosizioneUI()` (**17627**) |
| 17922–18096 | **11. Meteo e indice di osservabilità** | `indiceOsservabilita(evento)` (**18023**) |
| 18097–18145 | **12. Strumento necessario** (occhio / binocolo / telescopio) | `STRUMENTI` (**18102**) |
| 18146–18543 | **13. Passaggi di ISS e Tiangong** (SGP4) | `SATELLITI` (**18157**) |
| 18544–18809 | **14. Vista "Stasera"** | `costruisciStasera()` (**18581**) |
| 18810–19011 | **15. Diario e traguardi** | `TRAGUARDI` (**18846**), `caricaDiario()` (**18822**) |
| 19012–19392 | **16. Condivisione (`?evento=`), export `.ics`, backup JSON** | `esportaBackup()` (**19251**), `urlEvento(id)` (**19015**) |
| 19393–19444 | **17. Consigli di astrofotografia** | `consigliFoto(evento)` (**19398**) |
| 19445–20351 | **18. Costellazioni e deep sky nel planetario**, macchina del tempo, **barra del tempo** (la riga sempre in vista in fondo alla mappa), playback, fotocamera AR | `SKY_COSTELLAZIONI` (**19452**), `SKY_PROFONDO` (**19585**, con le misure vere), `skyDisegnaProfondo()` (**19768**), `skyAggiornaTestoTempo()` (**19874**), `skyTestoBarraTempo()` (**19942**), `skyImpostaOffsetTempo()` (**19991**) |
| 20352–20469 | **19. Schede dell'agenda, arricchite** | `bloccoLocaleHtml()` (**20358**), `barraAzioniHtml()` (**20413**) |

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
| 5420–5533 | **9. Avvio e agganci** con il resto dell'app (`telDisegnaPoloSuCielo` disegna il polo celeste dentro il planetario) |

## 8. Stato globale

| Nome | Dove | Cos'è |
|---|---|---|
| `eventiCalcolati` | `app.js:2` | L'elenco di tutti gli eventi. Fonte unica per calendario, agenda, stasera. |
| `impronteEventi` / `mesiCalcolati` | `app.js:16,24` | Anti-duplicazione quando si calcola un mese su richiesta. |
| `vistaAttuale` | `app.js:234` | Serve a chi ridisegna dopo un cambio di schermo. |
| `dispositivoAttuale` | `app.js:233` | `'telefono' \| 'tablet' \| 'computer'`, scritto anche su `<html data-dispositivo>`. |
| `sky` | `app.js:6221` | Planetario: canvas, posizione, sensori, fov, target, tempo, `eclisse` (l'eclissi di Sole in corso) e `ariaOra` (i colori dell'aria di questo istante). `sky.posizione` è la posizione dell'app; `sky.luogoVista` il luogo di sola visita del planetario (non salvato), e `sky.observer` nasce dal secondo se c'è, dalla prima se no. `sky.fov` è il campo disegnato adesso e `sky.fovVoluto` quello a cui sta andando; `sky.inerzia` è la corsa lasciata dal dito e `sky.animazioneVista` lo spostamento verso un oggetto (sezione 7.4-ter). |
| `sky.reg` | `app.js:6361` | Registrazione di un momento: durata, tela di montaggio, registratore, risultato. |
| `skyTele` | `app.js:8415` | Le facce già dipinte degli astri, una per taglia. Al massimo diciotto: oltre, se ne va la più vecchia. |
| `sol` | `app.js:14562` | Sistema Solare in 3D: telecamera (`az`, `elev`/`elevVoluta`, `zoom`/`zoomVoluto`), metro delle distanze (`distanzeVere`) e ingrandimento fuori dal piano (`esagera`), posizioni eliocentriche in UA (`pianeti`, `luna`), orbite campionate (`orbite`), pianeta scelto (`scelto`) e marcia del tempo (`marcia`, `velIndice`). L'istante non è suo: lo legge da `skyAdesso()` e lo sposta con `skyImpostaOffsetTempo()`. |
| `sim` | `app.js:15517` | Simulazione: canvas, scena, posizione nel tempo, velocità. |
| `tel` | `telescopio.js:168` | Telescopio: profilo, pannello, allineamento, push-to. |

## 9. Persistenza (`localStorage`, tutte le chiavi)

| Costante | Chiave |
|---|---|
| `CHIAVE_EVENTI_MANUALI` | `astrocalendario_eventi_manuali` |
| `CHIAVE_NOTIFICHE_INVIATE` | `astrocalendario_notifiche_inviate` |
| `CHIAVE_SKY_POSIZIONE` | `astrocalendario_posizione` (la posizione dell'app: quella delle Impostazioni. Il luogo di sola visita del planetario **non** si salva) |
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
- **Prefissi**: `sky*` = planetario (la vista si chiama ancora `cielo` nel
  codice), `skyDipingi*` = pennelli delle facce degli astri (si chiamano una
  volta sola, dentro `skyPelle`), `skyReg*` = registrazione di un momento,
  `sol*` = il Sistema Solare in 3D, `sim*` = simulazione, `tel*` = telescopio,
  `_ecl*` = interni della mappa eclissi, `lez*` = la lezione animata
  dell'eclittica.
- **Niente disegno pesante a ogni fotogramma**: tutto ciò che è complicato e
  non cambia (i mari della Luna, le bande di Giove, la corona, le nebulose)
  si dipinge una volta sola su una tela fuori schermo e poi si ricopia. Il
  ciclo del planetario deve restare sotto il millisecondo per fotogramma.
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
  (oggi `astrocal-v42`): senza questo, chi ha già installato la PWA continua a
  vedere la versione vecchia.
- Se aggiungi un file all'app, aggiungilo anche a `ASSETS` in `sw.js`.

## 12. Dove guardare per…

| Richiesta | Punto di partenza |
|---|---|
| Nuovo tipo di evento astronomico | `calcolaEventiAstronomi()` `app.js:676` + una `aggiungi…()`, poi `CATEGORIE` `app.js:36` |
| Nuova scena della simulazione | `app.js:15718` (costruzione scena) e una `simScena*` |
| Qualcosa nel planetario | `sky` `app.js:6221`, disegno da `app.js:8050` |
| Eventi mostrati nel planetario | `SKY_EVENTI_FINESTRA_MIN`, `SKY_EVENTI_SETTIMANA_MS` + `skyAggiornaEventi()` (sezione 7.4-bis) |
| "Vedi nel planetario" (dalle schede dell'agenda e dall'elenco della settimana) | `apriEventoNelPlanetario(id)` (sezione 7.4-bis) |
| Registrare e condividere un momento | sezione 7.6: `skyRegAvvia()`, il montaggio in `skyRegComponi()`, la firma in `skyRegFirma()`; il tasto è `#skymap-btn-registra` **sulla mappa** (`.tasto-registra-cielo` dentro `.comandi-mappa-cielo`), la durata i chip `[data-durata-reg]` nel pannello Visualizzazione; stili `.tasto-registra-cielo`, `.tempo-reg`, `.pannello-clip` |
| Quanto si può ingrandire, e quanto grandi si disegnano gli astri | `SKY_FOV_MIN` / `SKY_FOV_MAX` e `skyImpostaFov()` (`app.js:6589`); la misura di ogni astro in `skyRaggio(o, focale)` (`app.js:9943`), che sceglie fra icona fissa e disco vero (diametro ÷ distanza) |
| Il cielo si muove a scatti (trascinamento, zoom, centratura) | sezione **7.4-ter**: `sky.fov` è il campo disegnato adesso e `sky.fovVoluto` quello a cui si sta andando (`skyImpostaFov(g, { morbido: true })` chiede il viaggio, `skyMuoviZoom()` lo fa); l'inerzia è `skyLanciaVista()` + `skyScorriPerInerzia()`, e si spegne sempre con `skyFermaMovimenti()`. Le costanti da girare: `SKY_TAU_ZOOM`, `SKY_TAU_INERZIA`, `SKY_INERZIA_MAX_SCHERMI` |
| Le stelle saltellano di un pixel una volta al secondo | `skyIntervalloCalcolo()` (`app.js:7745`): ogni quanto `skyAggiornaOggetti()` rifà le posizioni. Si adatta al campo (mezzo pixel di movimento del cielo), fra `SKY_CALCOLO_MIN_MS` e `SKY_CALCOLO_MAX_MS`. I numeri scritti attorno alla mappa vanno invece a `SKY_UI_INTERVALLO`, più piano |
| Il cielo resta indietro sotto il dito quando si guarda in alto | `skyGradiAzPerPixel()` (sezione 7.4-ter): un pixel vale più gradi di azimut quanto più si guarda in alto (fattore 1/cos, tosato a 4) |
| La faccia di un astro (mari della Luna, bande di Giove, calotte di Marte) | il pennello `skyDipingi*` nella sezione 7.3.2, registrato in `SKY_FACCE` (`app.js:9062`). Si dipinge in un mondo dove il disco ha raggio 1; le macchie si mettono con `skyMacchiaSfera(lon, lat, …)` (`app.js:8488`), che le schiaccia da sé verso il bordo |
| Un'eclissi di Sole (corona, morso, cielo che si spegne) | `skyEclisseDiSole()` (`app.js:9892`) calcola la copertura a ogni fotogramma in `sky.eclisse`; da lì dipendono `skyRaggioIcona()` (la Luna prende la misura giusta rispetto al Sole), la corona in `skyDisegnaSole()`, il bagliore in `skyDisegnaAloneSole()` e il colore del cielo in `skyAriaEclissata()` |
| Un'eclissi di Luna (il morso ramato) | `skyOmbraDellaTerra()` (`app.js:7849`, una volta al secondo) e `skyDisegnaOmbraLunare()` (`app.js:9747`) |
| Perché un astro non è trasparente | `skyColoreNotteAstro()` (`app.js:9249`): il lato in ombra si riempie del colore del cielo, tanto quanto il cielo è chiaro — di notte copre le stelle, di giorno sparisce. E `skyVeloAtmosferico()` (`app.js:9350`) smorza e arrossa invece di sbiadire |
| Il profilo dell'orizzonte (colline e alberi) | `SKY_PROFILO` (`app.js:9377`, calcolato una volta all'avvio), `skyAltezzaOrizzonte()` (`app.js:9406`) e `skyDisegnaProfiloOrizzonte()` (`app.js:9597`) |
| Come si vedono nebulose, galassie e ammassi | `skyPennelloProfondo()` (`app.js:9090`) dipinge la nuvola, `skyDisegnaProfondo()` (`app.js:19768`) la mette in cielo grande quanto è davvero (`assePrimi`, `asseMinore`, `angoloPosizione` in `SKY_PROFONDO`) |
| Traccia dell'oggetto nel planetario | `skyCalcolaTraccia()` (sezione 7.3-bis), tasto `skymap-btn-traccia` nei Filtri |
| Eclittica e scarto di un astro da essa | `skyCalcolaEclittica()` (sezione 7.3-ter), tasto `skymap-btn-eclittica` nei Filtri; conversioni in `skyEquatorialiDiEclittica()` / `skyEclitticaDiEquatoriali()` |
| Analemma (l'otto del Sole) | `skyCalcolaAnalemma()` sulla mappa e `lezQuadroAnalemma()` nella lezione; l'equazione del tempo si ricava da `Astronomy.HourAngle` in `lezLeggiAnalemma()` |
| Il Sistema Solare visto da fuori (vista 3D) | sezione **7.7**: stato `sol`, `apriSistemaSolare()`. La geometria è tutta in tre funzioni — `solRaggio(ua)` (il metro: distanze vere o compresse), `solScena(v)` (dal vettore in UA al punto della scena, con l'altezza fuori dal piano ingrandita per ultima) e `solProietta(p)` (ortogonale, con la `vicinanza` che ordina chi sta davanti). Le posizioni vengono da `Astronomy.HelioVector` + `Astronomy.Ecliptic` in `solVettore()`; le orbite le campiona `solCalcolaOrbite()` seguendo il pianeta per un periodo intero. Markup in `modale-sistema`, stili `.sol-*` in `style.css` |
| I tasti che aprono la vista 3D | `#skymap-btn-sistema` in fondo al pannello **Astri** (collegato in `inizializzaSkymap()`), e «Vedilo dall'esterno» dentro `skySchedaHtml()` per il Sole e per ogni pianeta |
| Muovere la vista 3D (girarla, avvicinarla, scegliere un pianeta) | `solInizializzaGesti()` (sezione 7.7): un dito gira (`sol.az`, `sol.elev`), due pizzicano, la rotella avvicina (morbida, verso `sol.zoomVoluto`), un tocco secco sceglie il pianeta più vicino con `solTocco()`. **Ogni volta che cambia il numero di dita, `riancora()` rifà i riferimenti del gesto**: senza, dopo un pizzico il dito rimasto veniva misurato dal punto in cui si era appoggiato prima, e la scena scattava di venti gradi. I tasti dei punti di vista non saltano: muovono `sol.elevVoluta` e `sol.zoomVoluto`, e ci si arriva scivolando dentro `solCiclo()` (`SOL_TAU_VISTA`, `SOL_TAU_ZOOM`) |
| Quanto sono grossi i pallini dei pianeti nella vista 3D | il campo `raggio` di ogni voce di `SOL_PIANETI`, più `SOL_RAGGIO_SOLE` e `SOL_RAGGIO_LUNA`. Non sono in scala (a scala vera la Terra sarebbe un centesimo di pixel): sono misure da toccare col dito. Da lì dipendono da sé l'area sensibile di `solTocco()` e il posto dei nomi, che in `solDisegna()` partono da un elenco di zone occupate con dentro tutti i corpi — una scritta bianca sul disco del Sole non si leggerebbe |
| Quando si vede un pianeta ("la sera", "tutta la notte") | `solElongazione()` + `solQuandoSiVede()` (sezione 7.7): l'angolo Sole–Terra–pianeta e da che parte del Sole sta. È geometria del Sistema Solare, non dipende da dove sei; per gli orari veri della tua località restano `costruisciStasera()` e le schede dell'agenda |
| La lezione animata dell'eclittica | `LEZ_CAPITOLI` (i testi dei sei quadri) e `lez*` (sezione 7.3-quater); markup in `modale-lezione`, stili `.lez-*` in `style.css`; il tasto sta in `skySchedaHtml()`, solo per il Sole |
| "Perché proprio adesso" sotto un'eclissi | `stagioneEclissiHtml(data)` + `mostraStagioneEclissi(id, data)` (fine 7.3-quater): nodo lunare più vicino, latitudine della Luna, eclissi compagne. Appare in `#eclissi-stagione` (mappa dell'ombra), `#lunare-stagione` (eclissi lunare) e `#sim-eclittica` (simulazione) |
| Aprire la lezione a un quadro preciso | `apriLezioneEclittica('nodi')` — accetta il `tipo` del capitolo o il suo indice |
| Passo del tempo e finestra della slitta (sono un comando solo) | `SKY_FINESTRA_DEL_PASSO`, `skyImpostaPassoTempo()`, `skySpostaDiUnPasso()`; nel markup i chip `[data-passo-tempo]`, nel pannello Tempo |
| La barra del tempo (l'orologio sempre in vista sulla mappa) | `#cielo-tempo` in `index.html` (dentro `#skymap-contenitore`, dopo i pannelli): ⟲ `skymap-tempo-adesso`, lettura `skymap-tempo-quando` (che apre il pannello Tempo), `skymap-passo-meno`/`-piu`, slitta `skymap-tempo`, play `skymap-tempo-play`. Testo in `skyTestoBarraTempo()` / `skyScartoBreve()`, stato in `skyAggiornaTestoTempo()` e `skyAggiornaComandiPlayback()`; stili `.barra-tempo`, `.tasto-barra-tempo`, `.lettura-barra-tempo`, `.slitta-tempo` |
| Quanto spazio lascia la barra a chi le sta sopra (zoom, scheda dell'oggetto, pannelli) | le misure `--tasto-tempo`, `--alta-barra-tempo` e `--sopra-barra-tempo` su `.vista-cielo` in `style.css`: cambiarle basta, le usano `.cielo-chrome`, `.comandi-mappa-cielo`, `.pannello-dettaglio` e `#skymap-overlay`. Sotto i 520px di larghezza la slitta va a capo da sola (media query dedicata) |
| Tasto della mappa dell'ombra negli eventi del planetario | `skyTastoMappaHtml()` + `skyApriMappaEvento(id)` (sezione 7.4-bis) |
| Colori della mappa dell'eclissi (chiara/scura) | `ECL_TAVOLOZZE` + `_eclApplicaTemaMappa()`, e `#mappa-eclissi.mappa-chiara` in `style.css` |
| Il terminatore sulla mappa dell'ombra (dov'è giorno e dov'è notte) | `ECL_NOTTE_SOGLIE` (le tre altezze del Sole: tramonto, crepuscolo civile, notte astronomica) e `_eclFasciaDellaNotte()`, che per ogni meridiano dà il tratto al buio con una formula chiusa — **non** si può chiudere il poligono sul polo, perché vicino agli equinozi il polo non è al buio. Disegno in `_eclDisegnaNotte()`, colori in `ECL_TAVOLOZZE[...].notte`, livelli nel riquadro Leaflet `ecl-notte` (z-index 350: sopra le tessere, sotto i tracciati). Si accende e si spegne con `eclissiAlternaNotte()` (tasto ◐ `#btn-eclissi-notte` sulla mappa) |
| Mappa dell'eclissi a tutto schermo (comandi in sovrimpressione) | `_eclAlternaSchermoIntero()` e `.ecl-guscio-filmato:fullscreen` / `.ecl-schermo-pieno` in `style.css` |
| Bussola sbagliata / cielo storto | filtro anti-tremolio `app.js:6244`, declinazione `app.js:6781` |
| Posizione non rilevata | posizione a strati `trovaPosizioneAStrati()` `app.js:7358`, finestra `app.js:17322` |
| Una posizione scelta a mano che "non resta" | `POS_SCELTA_UTENTE` / `POS_FONTI_AUTOMATICHE` e il guardiano in cima a `skyImpostaPosizione()` (`app.js:7024`): GPS, rete e posizione riletta non scavalcano una scelta dell'utente. Solo una cascata con `{ forzato: true }` (tasto "Rileva di nuovo", tasto Posizione del planetario) può farlo |
| Guardare il cielo da un altro luogo (solo nel planetario) | sezione 7.1-ter: `sky.luogoVista`, `skyLuogoDelCielo()`, `skyAggiornaOsservatore()`; i comandi stanno nel pannello **Tempo e luogo** e sono due soli: la ricerca della città (`#skymap-luogo-cerca`) e `#skymap-luogo-casa` |
| I comandi appoggiati sulla mappa (colonna a destra) | in `index.html`, `.comandi-mappa-cielo`: `#skymap-btn-schermo-mappa` (⛶), `#skymap-btn-insegui-mappa` (bersaglio), la registrazione, i due dello zoom. Girati vanno in riga sopra la barra del tempo (media query landscape in `style.css`); stili `.tasto-schermo-cielo`, `.tasto-insegui-cielo`, `.tasto-registra-cielo`, `.tasto-zoom-cielo` |
| Schermo intero del planetario | `skyAlternaSchermoIntero()` (sezione 7.5); i tasti sono `#skymap-btn-schermo` (pannello Visualizzazione), `#skymap-btn-schermo-mappa` (⛶ sulla mappa, in cima alla colonna dei comandi, sopra la registrazione) e `#skymap-btn-esci` |
| Meteo o semaforo di osservabilità | `app.js:17922` |
| Calcoli ottici del telescopio | `telescopio.js:243` |
| Impaginazione su telefono | `PUNTI_ROTTURA` `app.js:211` + i `@media` di `style.css` |
| Nuova icona | `DISEGNI` `app.js:53` |
