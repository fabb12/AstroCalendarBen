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
| `index.html` | ~1.270 | Struttura statica: testata, 6 viste, 9 modali. Nessuna logica. |
| `app.js` | ~19.240 | Tutto tranne il telescopio. |
| `telescopio.js` | ~5.530 | Vista Telescopio, isolata. ~136 funzioni, prefisso `tel`. |
| `style.css` | ~4.190 | Tema "Deep Space" + impaginazione responsive. |
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

Definite in `VISTE` (`app.js:5534`), commutate da `mostraVista(nome)`
(`app.js:5544`), che è anche il posto dove si **accendono e spengono** cicli di
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
| **Planetario** (nel codice `cielo`) | Il cielo in tempo reale: punta il telefono, oppure realtà aumentata con la fotocamera, macchina del tempo, playback, zoom fino a un quarto di grado (Luna e pianeti a grandezza vera, **con la loro faccia**: mari, bande, anelli, calotte), eclissi con corona e ombra della Terra, orizzonte con le colline, registrazione di un filmato da condividere. Nel pannello **Tempo e luogo** si può anche spostare il punto di vista in un'altra città: vale solo qui, la posizione dell'app non si tocca. |
| **Telescopio** | Allineamento polare, puntamento, programma della serata, manutenzione. |
| **Diario** | Osservazioni registrate e traguardi. |

Modali (in `index.html`): `modale-aggiungi`, `modale-mappa` (eclissi),
`modale-simulazione`, `modale-lezione` (che cos'è l'eclittica), `modale-diario`,
`modale-posizione`, `modale-impostazioni`, `modale-oculare`.

## 6. Mappa di `app.js`

| Righe | Sezione | Funzioni chiave |
|---|---|---|
| 1–52 | Stato globale e costanti | `eventiCalcolati` (**2**), `CATEGORIE` (**36**), `NOMI_MESI`, `mesiCalcolati` |
| 53–194 | `DISEGNI`: icone SVG inline (stile Lucide, `currentColor`) | `icona(nome, misura)` (**162**) |
| 195–449 | **0. Il dispositivo** — telefono/tablet/computer decide *quanti* dati mostrare | `profiloDispositivo()`, `quanto(tel,tab,pc)`, `telefonoGirato()` |
| 450–579 | Avvio (`DOMContentLoaded`), navigazione | `creaEvento({...})` (**551**) ← **ogni evento nasce qui** |
| 580–670 | Eventi di un periodo arbitrario (anche passato) | `calcolaEventiIntervallo()` (**587**) |
| 671–941 | **1. Calcolo eventi** — fasi lunari, eclissi lunari e solari | `calcolaEventiAstronomi()` (**675**), `aggiungiFasiLunari()`, `aggiungiEclissi*()` |
| 942–1832 | **1-bis. Geometria di visibilità delle eclissi solari** | cono d'ombra, oscuramento per località |
| 1833–2742 | **1-ter. La mappa Leaflet**: tracciati, filmato, legenda, schema, schermo intero della mappa | `apriMappaEclissi(id)`, `_eclissiAggiornaTutto()`, `_eclAlternaSchermoIntero()` |
| 2743–2980 | **1-ter-bis.** Il cielo sarà sereno? (meteo dell'eclissi) | |
| 2981–3070 | **1-ter-ter.** Portarsela dietro (condividere l'eclissi) | |
| 3071–3312 | **1-quater.** Le eclissi di casa tua | |
| 3313–4617 | **1-quinquies.** Le eclissi lunari | |
| 4618–4770 | Stagioni, sciami meteorici, elongazioni | `aggiungiStagioni()` (**4618**), `aggiungiSciamiMeteorici()` (**4654**), `aggiungiElongazioni()` |
| 4771–5039 | **1-bis. Eventi manuali** dell'utente + form | `caricaEventiManuali()` (**4775**), `inizializzaFormAggiungi()` (**4935**) |
| 5040–5052 | **2.** `inizializzaUI()` | |
| 5053–5197 | **1-quater.** Scelta del mese (1900–2100), calcolo su richiesta | `inizializzaSelettoriMese()` (**5059**) |
| 5198–5526 | **1-ter.** Ricerca "morbida" (senza accenti) e filtro categorie | `inizializzaRicerca()` (**5307**) |
| 5527–5602 | **3.** Viste e commutazione | `VISTE` (**5534**), `mostraVista()` (**5544**) |
| 5603–5647 | **4. Lettura vocale (TTS)** — parte solo da tasto o notifica | `ORIGINI_VOCE_AMMESSE` (**5608**) |
| 5648–5830 | **5. Notifiche e promemoria** | `inizializzaNotifiche()` (**5796**) |
| 5831–5880 | **6. Installazione PWA** | `inizializzaInstallazione()` (**5835**) |
| 5881–6532 | **7. Il planetario** — stato `sky`, algebra Est/Nord/Alto, filtro anti-tremolio bussola, limiti del campo visivo, campo visivo AR | `sky` (**6006**), `sky.reg` (**6146**), `skyVettore()` (**6171**), `SKY_FOV_MIN` (**6357**)/`skyImpostaFov()` (**6374**), `skyProietta()` (**6506**) |
| 6533–7241 | **7.1** Posizione e sensori; **7.1-bis** posizione a tre strati (GPS → IP → a mano) | `skyRichiediPosizione()` (**6902**), `posizioneDallaRete()`, `trovaPosizioneAStrati()` (**7143**), declinazione magnetica (**6556**) |
| 7242–7492 | **7.1-ter** Il luogo da cui si guarda: il planetario può spostare l'occhio altrove senza toccare la posizione dell'app | `skyLuogoDelCielo()` (**7263**), `skyAggiornaOsservatore()` (**7279**), `skyImpostaLuogoVista()`, `skyTornaAlLuogoDiCasa()`, `skyInizializzaLuogoVista()` (**7395**) |
| 7493–7833 | **7.2** Posizioni degli astri (Sole, Luna, pianeti, stelle `Star1…Star8`); qui si calcolano anche l'ombra della Terra sulla Luna e l'apertura degli anelli di Saturno. Ogni quanto rifarle non è fisso: si adatta a quanto si è ingranditi (mezzo pixel di movimento del cielo), mentre i numeri scritti attorno alla mappa vanno più piano | `skyIntervalloCalcolo()` (**7530**), `SKY_UI_INTERVALLO` (**7528**), `skyAggiornaOggetti()` (**7537**), `skyOmbraDellaTerra()` (**7634**), `skyAssettoDiSaturno()` (**7674**) |
| 7834–8155 | **7.3 / 7.3.1** Disegno del cielo e aspetto dell'aria: colore del fondo per ora del giorno, foschia, aloni, Via Lattea | `skyAria()`, `skyDisegnaSfondo()`, `skyDisegnaViaLattea()` |
| 8156–9807 | **7.3.2 La pelle degli astri** — le facce vere, dipinte una volta sola su tele fuori schermo: Luna coi mari, Sole con granulazione e corona, pianeti con bande e calotte, nebulose e galassie, profilo dell'orizzonte, eclissi | `skyPelle()` (**8214**), `SKY_FACCE` (**8847**), `skyFacciaDi()` (**8864**), `skyDisegnaGlobo()` (**9065**), `SKY_PROFILO` (**9162**), `skyDisegnaTerreno()` (**9306**), `skyDisegnaLuna()` (**9479**), `skyDisegnaPianeta()` (**9576**), `skyDisegnaSole()` (**9615**), `skyEclisseDiSole()` (**9677**) |
| 9808–10249 | **7.3 (seguito)** Misura degli astri (icona o disco vero), disegno di ogni astro, ciclo di disegno | `skyRaggio(o, focale)` (**9739**), `skyDisegnaAstro()` (**9789**), `skyDisegna()` (**10052**) |
| 10250–10388 | **7.3-bis** Traccia dell'oggetto osservato: la strada che percorre nelle ore attorno all'istante mostrato, con l'ora segnata di ora in ora | `skyCalcolaTraccia()` (**10282**), `skyDisegnaTraccia()`, `SKY_TRACCIA_ORE` |
| 10389–10807 | **7.3-ter** Eclittica: il cerchio del Sole in un anno, coi puntini dei mesi e il filo a piombo che misura quanto l'oggetto scelto sta sopra o sotto. Insieme a lei l'**analemma** (il Sole alla stessa ora ogni giorno per un anno) | `skyCalcolaEclittica()` (**10469**), `skyDisegnaEclittica()`, `skyScartoEclittica()`, `skyCalcolaAnalemma()` |
| 10808–11842 | **7.3-quater** La lezione dell'eclittica: sei quadri animati (Sistema Solare dall'alto → di taglio → il piano → la riga vista da qui → l'analemma → i nodi e le eclissi). Si apre dal tasto nella scheda del Sole | `LEZ_CAPITOLI` (**10840**), `lez`, `apriLezioneEclittica()`, `lezQuadroSistema/Cielo/Analemma/Nodi()` |
| 11843–12307 | **7.4** Interfaccia del planetario e scheda dell'oggetto (si apre **solo** toccando l'oggetto sulla mappa), inseguimento | `skyAlternaInseguimento()`, `skyInsegui()`, `skyAggiornaTastoInsegui()` (tiene d'accordo i due tasti: quello del pannello Navigazione e il bersaglio sulla mappa) |
| 12308–12791 | **7.4-bis** Eventi del calendario dentro il planetario: elenco (in corso, ore vicine, **prossimi 7 giorni**), chip e segni sulla mappa (radiante, anello sull'astro eclissato) | `skyEventiVicini()` (**12359**), `skyAggiornaEventi()`, `apriEventoNelPlanetario(id)` |
| 12792–13141 | **7.4-ter Movimenti morbidi** — perché il cielo non faccia scatti: inerzia del trascinamento (si lascia andare e si spegne da sé), zoom che ci scivola dentro invece di saltarci, spostamento verso un oggetto con partenza e arrivo lisci. Tutti smorzamenti esponenziali col `dt` del fotogramma, per comportarsi uguale a qualunque cadenza | `skyDeltaFotogramma()` (**12815**), `skyMuoviZoom()` (**12829**), `skyGradiAzPerPixel()` (**12871**), `skyRicordaTrascinamento()` (**12879**), `skyLanciaVista()` (**12896**), `skyScorriPerInerzia()` (**12909**), `skyFermaMovimenti()` (**12927**), `skyCentraSu()` (**12935**), `skyInsegui()`, `skyMuoviVista()` |
| 13142–13684 | **7.4-quater** Avvio della vista, ciclo di disegno, gesti (trascinamento, pizzico, tocco, rotellina) e collegamento di tutti i comandi | `skyAvvia()`, `skyCiclo()` (**13190**), `apriSkymap()`, `skyZoom()` (**13265**), `skyInizializzaGesti()` (**13278**), `inizializzaSkymap()` (**13444**) |
| 13685–13818 | **7.5** Schermo intero (dal pannello Visualizzazione, dal ⛶ sulla mappa, con Esc o col doppio clic) | `skyAlternaSchermoIntero()` (**13699**), `skyAggiornaTastiSchermo()` (**13773**) |
| 13819–14260 | **7.6 Registrare un momento**: pochi secondi di cielo in un filmato (MediaRecorder, mp4 dove c'è, se no webm) da condividere o salvare. Il tasto sta sulla mappa, non in un pannello | `skyRegAvvia()`, `skyRegComponi()`, `skyRegFirma()`, `skyRegFerma()`, `skyRegAggiornaComando()`, `skyRegCondividi()` |
| 14261–15878 | **8. Simulazione dell'evento** — stato `sim` (**14284**), una scena per tipo | `simScenaEclissiLunare/Solare/FaseLunare/Stagioni/Sciame/Elongazione/Cielo` |
| 15879–16054 | **9. Congiunzioni e occultazioni** | |
| 16055–16088 | **10. La posizione usata da tutta l'app** | `luogoCorrente()` (**16065**) |
| 16089–16688 | **10-bis. Finestra della posizione** + ricerca città (locale, poi Open-Meteo) | `apriPosizione(forza)` (**16132**), `inizializzaPosizioneUI()` (**16394**) |
| 16689–16863 | **11. Meteo e indice di osservabilità** | `indiceOsservabilita(evento)` (**16779**) |
| 16864–16912 | **12. Strumento necessario** (occhio / binocolo / telescopio) | `STRUMENTI` (**16869**) |
| 16913–17310 | **13. Passaggi di ISS e Tiangong** (SGP4) | `SATELLITI` (**16924**) |
| 17311–17576 | **14. Vista "Stasera"** | `costruisciStasera()` (**17556**) |
| 17577–17778 | **15. Diario e traguardi** | `TRAGUARDI` (**17613**), `caricaDiario()` (**17589**) |
| 17779–18159 | **16. Condivisione (`?evento=`), export `.ics`, backup JSON** | `esportaBackup()` (**18018**), `urlEvento(id)` (**17771**) |
| 18160–18211 | **17. Consigli di astrofotografia** | `consigliFoto(evento)` (**18154**) |
| 18212–19118 | **18. Costellazioni e deep sky nel planetario**, macchina del tempo, **barra del tempo** (la riga sempre in vista in fondo alla mappa), playback, fotocamera AR | `SKY_COSTELLAZIONI` (**18219**), `SKY_PROFONDO` (**18341**, con le misure vere), `skyDisegnaProfondo()` (**18535**), `skyAggiornaTestoTempo()` (**18641**), `skyTestoBarraTempo()` (**18709**), `skyImpostaOffsetTempo()` (**18758**), `skyAttivaFotocamera()` |
| 19119–19236 | **19. Schede dell'agenda arricchite** | `bloccoLocaleHtml()` (**19125**), `barraAzioniHtml()` (**19180**) |

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
| `sky` | `app.js:6006` | Planetario: canvas, posizione, sensori, fov, target, tempo, `eclisse` (l'eclissi di Sole in corso) e `ariaOra` (i colori dell'aria di questo istante). `sky.posizione` è la posizione dell'app; `sky.luogoVista` il luogo di sola visita del planetario (non salvato), e `sky.observer` nasce dal secondo se c'è, dalla prima se no. `sky.fov` è il campo disegnato adesso e `sky.fovVoluto` quello a cui sta andando; `sky.inerzia` è la corsa lasciata dal dito e `sky.animazioneVista` lo spostamento verso un oggetto (sezione 7.4-ter). |
| `sky.reg` | `app.js:6146` | Registrazione di un momento: durata, tela di montaggio, registratore, risultato. |
| `skyTele` | `app.js:8200` | Le facce già dipinte degli astri, una per taglia. Al massimo diciotto: oltre, se ne va la più vecchia. |
| `sim` | `app.js:14284` | Simulazione: canvas, scena, posizione nel tempo, velocità. |
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
  `sim*` = simulazione, `tel*` = telescopio, `_ecl*` = interni della mappa
  eclissi, `lez*` = la lezione animata dell'eclittica.
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
  (oggi `astrocal-v39`): senza questo, chi ha già installato la PWA continua a
  vedere la versione vecchia.
- Se aggiungi un file all'app, aggiungilo anche a `ASSETS` in `sw.js`.

## 12. Dove guardare per…

| Richiesta | Punto di partenza |
|---|---|
| Nuovo tipo di evento astronomico | `calcolaEventiAstronomi()` `app.js:675` + una `aggiungi…()`, poi `CATEGORIE` `app.js:36` |
| Nuova scena della simulazione | `app.js:14473` (costruzione scena) e una `simScena*` |
| Qualcosa nel planetario | `sky` `app.js:6006`, disegno da `app.js:7845` |
| Eventi mostrati nel planetario | `SKY_EVENTI_FINESTRA_MIN`, `SKY_EVENTI_SETTIMANA_MS` + `skyAggiornaEventi()` (sezione 7.4-bis) |
| "Vedi nel planetario" (dalle schede dell'agenda e dall'elenco della settimana) | `apriEventoNelPlanetario(id)` (sezione 7.4-bis) |
| Registrare e condividere un momento | sezione 7.6: `skyRegAvvia()`, il montaggio in `skyRegComponi()`, la firma in `skyRegFirma()`; il tasto è `#skymap-btn-registra` **sulla mappa** (`.tasto-registra-cielo` dentro `.comandi-mappa-cielo`), la durata i chip `[data-durata-reg]` nel pannello Visualizzazione; stili `.tasto-registra-cielo`, `.tempo-reg`, `.pannello-clip` |
| Quanto si può ingrandire, e quanto grandi si disegnano gli astri | `SKY_FOV_MIN` / `SKY_FOV_MAX` e `skyImpostaFov()` (`app.js:6374`); la misura di ogni astro in `skyRaggio(o, focale)` (`app.js:9739`), che sceglie fra icona fissa e disco vero (diametro ÷ distanza) |
| Il cielo si muove a scatti (trascinamento, zoom, centratura) | sezione **7.4-ter**: `sky.fov` è il campo disegnato adesso e `sky.fovVoluto` quello a cui si sta andando (`skyImpostaFov(g, { morbido: true })` chiede il viaggio, `skyMuoviZoom()` lo fa); l'inerzia è `skyLanciaVista()` + `skyScorriPerInerzia()`, e si spegne sempre con `skyFermaMovimenti()`. Le costanti da girare: `SKY_TAU_ZOOM`, `SKY_TAU_INERZIA`, `SKY_INERZIA_MAX_SCHERMI` |
| Le stelle saltellano di un pixel una volta al secondo | `skyIntervalloCalcolo()` (`app.js:7530`): ogni quanto `skyAggiornaOggetti()` rifà le posizioni. Si adatta al campo (mezzo pixel di movimento del cielo), fra `SKY_CALCOLO_MIN_MS` e `SKY_CALCOLO_MAX_MS`. I numeri scritti attorno alla mappa vanno invece a `SKY_UI_INTERVALLO`, più piano |
| Il cielo resta indietro sotto il dito quando si guarda in alto | `skyGradiAzPerPixel()` (sezione 7.4-ter): un pixel vale più gradi di azimut quanto più si guarda in alto (fattore 1/cos, tosato a 4) |
| La faccia di un astro (mari della Luna, bande di Giove, calotte di Marte) | il pennello `skyDipingi*` nella sezione 7.3.2, registrato in `SKY_FACCE` (`app.js:8847`). Si dipinge in un mondo dove il disco ha raggio 1; le macchie si mettono con `skyMacchiaSfera(lon, lat, …)` (`app.js:8284`), che le schiaccia da sé verso il bordo |
| Un'eclissi di Sole (corona, morso, cielo che si spegne) | `skyEclisseDiSole()` (`app.js:9677`) calcola la copertura a ogni fotogramma in `sky.eclisse`; da lì dipendono `skyRaggioIcona()` (la Luna prende la misura giusta rispetto al Sole), la corona in `skyDisegnaSole()`, il bagliore in `skyDisegnaAloneSole()` e il colore del cielo in `skyAriaEclissata()` |
| Un'eclissi di Luna (il morso ramato) | `skyOmbraDellaTerra()` (`app.js:7645`, una volta al secondo) e `skyDisegnaOmbraLunare()` (`app.js:9532`) |
| Perché un astro non è trasparente | `skyColoreNotteAstro()` (`app.js:9034`): il lato in ombra si riempie del colore del cielo, tanto quanto il cielo è chiaro — di notte copre le stelle, di giorno sparisce. E `skyVeloAtmosferico()` (`app.js:9135`) smorza e arrossa invece di sbiadire |
| Il profilo dell'orizzonte (colline e alberi) | `SKY_PROFILO` (`app.js:9173`, calcolato una volta all'avvio), `skyAltezzaOrizzonte()` (`app.js:9191`) e `skyDisegnaProfiloOrizzonte()` (`app.js:9382`) |
| Come si vedono nebulose, galassie e ammassi | `skyPennelloProfondo()` (`app.js:8875`) dipinge la nuvola, `skyDisegnaProfondo()` (`app.js:18535`) la mette in cielo grande quanto è davvero (`assePrimi`, `asseMinore`, `angoloPosizione` in `SKY_PROFONDO`) |
| Traccia dell'oggetto nel planetario | `skyCalcolaTraccia()` (sezione 7.3-bis), tasto `skymap-btn-traccia` nei Filtri |
| Eclittica e scarto di un astro da essa | `skyCalcolaEclittica()` (sezione 7.3-ter), tasto `skymap-btn-eclittica` nei Filtri; conversioni in `skyEquatorialiDiEclittica()` / `skyEclitticaDiEquatoriali()` |
| Analemma (l'otto del Sole) | `skyCalcolaAnalemma()` sulla mappa e `lezQuadroAnalemma()` nella lezione; l'equazione del tempo si ricava da `Astronomy.HourAngle` in `lezLeggiAnalemma()` |
| La lezione animata dell'eclittica | `LEZ_CAPITOLI` (i testi dei sei quadri) e `lez*` (sezione 7.3-quater); markup in `modale-lezione`, stili `.lez-*` in `style.css`; il tasto sta in `skySchedaHtml()`, solo per il Sole |
| "Perché proprio adesso" sotto un'eclissi | `stagioneEclissiHtml(data)` + `mostraStagioneEclissi(id, data)` (fine 7.3-quater): nodo lunare più vicino, latitudine della Luna, eclissi compagne. Appare in `#eclissi-stagione` (mappa dell'ombra), `#lunare-stagione` (eclissi lunare) e `#sim-eclittica` (simulazione) |
| Aprire la lezione a un quadro preciso | `apriLezioneEclittica('nodi')` — accetta il `tipo` del capitolo o il suo indice |
| Passo del tempo e finestra della slitta (sono un comando solo) | `SKY_FINESTRA_DEL_PASSO`, `skyImpostaPassoTempo()`, `skySpostaDiUnPasso()`; nel markup i chip `[data-passo-tempo]`, nel pannello Tempo |
| La barra del tempo (l'orologio sempre in vista sulla mappa) | `#cielo-tempo` in `index.html` (dentro `#skymap-contenitore`, dopo i pannelli): ⟲ `skymap-tempo-adesso`, lettura `skymap-tempo-quando` (che apre il pannello Tempo), `skymap-passo-meno`/`-piu`, slitta `skymap-tempo`, play `skymap-tempo-play`. Testo in `skyTestoBarraTempo()` / `skyScartoBreve()`, stato in `skyAggiornaTestoTempo()` e `skyAggiornaComandiPlayback()`; stili `.barra-tempo`, `.tasto-barra-tempo`, `.lettura-barra-tempo`, `.slitta-tempo` |
| Quanto spazio lascia la barra a chi le sta sopra (zoom, scheda dell'oggetto, pannelli) | le misure `--tasto-tempo`, `--alta-barra-tempo` e `--sopra-barra-tempo` su `.vista-cielo` in `style.css`: cambiarle basta, le usano `.cielo-chrome`, `.comandi-mappa-cielo`, `.pannello-dettaglio` e `#skymap-overlay`. Sotto i 520px di larghezza la slitta va a capo da sola (media query dedicata) |
| Tasto della mappa dell'ombra negli eventi del planetario | `skyTastoMappaHtml()` + `skyApriMappaEvento(id)` (sezione 7.4-bis) |
| Colori della mappa dell'eclissi (chiara/scura) | `ECL_TAVOLOZZE` + `_eclApplicaTemaMappa()`, e `#mappa-eclissi.mappa-chiara` in `style.css` |
| Mappa dell'eclissi a tutto schermo (comandi in sovrimpressione) | `_eclAlternaSchermoIntero()` e `.ecl-guscio-filmato:fullscreen` / `.ecl-schermo-pieno` in `style.css` |
| Bussola sbagliata / cielo storto | filtro anti-tremolio `app.js:6204`, declinazione `app.js:6536` |
| Posizione non rilevata | posizione a strati `trovaPosizioneAStrati()` `app.js:7143`, finestra `app.js:16078` |
| Una posizione scelta a mano che "non resta" | `POS_SCELTA_UTENTE` / `POS_FONTI_AUTOMATICHE` e il guardiano in cima a `skyImpostaPosizione()` (`app.js:6809`): GPS, rete e posizione riletta non scavalcano una scelta dell'utente. Solo una cascata con `{ forzato: true }` (tasto "Rileva di nuovo", tasto Posizione del planetario) può farlo |
| Guardare il cielo da un altro luogo (solo nel planetario) | sezione 7.1-ter: `sky.luogoVista`, `skyLuogoDelCielo()`, `skyAggiornaOsservatore()`; i comandi stanno nel pannello **Tempo e luogo** e sono due soli: la ricerca della città (`#skymap-luogo-cerca`) e `#skymap-luogo-casa` |
| I comandi appoggiati sulla mappa (colonna a destra) | in `index.html`, `.comandi-mappa-cielo`: `#skymap-btn-schermo-mappa` (⛶), `#skymap-btn-insegui-mappa` (bersaglio), la registrazione, i due dello zoom. Girati vanno in riga sopra la barra del tempo (media query landscape in `style.css`); stili `.tasto-schermo-cielo`, `.tasto-insegui-cielo`, `.tasto-registra-cielo`, `.tasto-zoom-cielo` |
| Schermo intero del planetario | `skyAlternaSchermoIntero()` (sezione 7.5); i tasti sono `#skymap-btn-schermo` (pannello Visualizzazione), `#skymap-btn-schermo-mappa` (⛶ sulla mappa, in cima alla colonna dei comandi, sopra la registrazione) e `#skymap-btn-esci` |
| Meteo o semaforo di osservabilità | `app.js:16678` |
| Calcoli ottici del telescopio | `telescopio.js:243` |
| Impaginazione su telefono | `PUNTI_ROTTURA` `app.js:211` + i `@media` di `style.css` |
| Nuova icona | `DISEGNI` `app.js:53` |
