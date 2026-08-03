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
| `index.html` | ~1.545 | Struttura statica: testata, 6 viste, 10 modali. Nessuna logica. |
| `app.js` | ~21.560 | Tutto tranne il telescopio e i moduli aggiunti dopo. |
| `telescopio.js` | ~5.535 | Vista Telescopio, isolata. ~136 funzioni, prefisso `tel`. |
| `catalogo.js` | ~980 | **Il catalogo del cielo**: 5.044 stelle, 88 costellazioni, 142 oggetti profondi, e il motore a matrice che li muove. Prefisso `cat`. |
| `corpi-minori.js` | ~660 | **Lune di Giove, comete e asteroidi**: `JupiterMoons` e propagazione kepleriana a mano. |
| `pianifica.js` | ~500 | **Pianificare la serata**: curva dell'altezza, migliori bersagli, profilo degli ostacoli. Prefisso `pian`/`orizzonte`. |
| `meteo-astro.js` | ~510 | **Meteo da astronomo**: seeing, trasparenza, griglia Clear Sky Chart, aurora. Prefisso `meteo`/`aurora`. |
| `eventi-extra.js` | ~435 | Superlune, opposizioni, splendore di Venere, transiti sul Sole, comete. |
| `ui-nuova.js` | ~350 | L'interfaccia di tutto quanto sopra. |
| `dati-stelle.js` | ~1.360 | 5.044 stelle fino alla mag 6,0 (147 KB). **Caricato su richiesta.** |
| `dati-stelle-deboli.js` | ~1.335 | Altre 10.500 fino alla mag 7,0 (267 KB). **Solo a chi serve** (Bortle ≤ 4 o forte zoom). |
| `dati-costellazioni.js` | ~195 | Le 88 figure IAU coi nomi italiani (24 KB). **Su richiesta.** |
| `dati-profondo.js` | ~170 | Messier completo + NGC luminosi, 142 oggetti (29 KB). **Su richiesta.** |
| `dati-corpi-minori.js` | ~85 | Elementi orbitali di 41 comete e 20 asteroidi (11 KB). **Su richiesta.** |
| `verifica.html` | ~360 | **Il banco di prova.** Si apre da un server e controlla i conti contro valori noti. Non fa parte della PWA. |
| `scripts/costruisci-dati.js` | ~430 | Genera i `dati-*.js` dalle fonti pubbliche. Si lancia a mano, non serve all'app. |
| `style.css` | ~4.915 | Tema "Deep Space" + impaginazione responsive. |
| `sw.js` | ~155 | Service worker. `CACHE_NAME` va incrementato a ogni rilascio (oggi `astrocal-v52`). |
| `manifest.json` | 33 | Manifesto PWA. |
| `icon-*.png`, `apple-touch-icon.png` | | Icone. |

**Ordine di caricamento** (è quello di `index.html`, e conta):

```
app.js → telescopio.js → catalogo.js → corpi-minori.js
       → pianifica.js → meteo-astro.js → eventi-extra.js → ui-nuova.js
```

Ogni file può usare quelli prima di lui; il contrario va sempre protetto con
`typeof x === 'function'`. I `dati-*.js` **non stanno in `index.html`**: se li
carica `catalogo.js` da sé alla prima apertura del planetario (`apriSkymap()`).

**I ganci dentro `app.js` sono cinque, e sono tutti guardati da un `typeof`:**

| Dove | Cosa fa |
|---|---|
| `apriSkymap()` | avvia `catCarica()` e `corpiMinoriCarica()` |
| `skyAggiornaCatalogo()` | se `catAggiornaPosizioni()` risponde, esce subito |
| `skyDisegna()` | chiama `catDisegnaStelle()` e `catDisegnaFigure()` |
| `skyElenco()` / `skyProfondoDiId()` | pescano anche da `catVociElenco()` e `corpiMinoriVociElenco()` |
| `calcolaEventiIntervallo()` | chiama `aggiungiEventiExtra()` |
| `costruisciStasera()` | chiama `aggiornaStaseraNuovo()` |
| `skyAggiornaScheda()` | appende `schedaExtraHtml()` e `disegnaSchedaExtra()` |

Se i moduli nuovi non ci sono, l'app resta esattamente quella di prima.

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
| **Stasera** (default) | Cosa si vede stanotte da qui, in quattro riquadri: **Stanotte** (buio, Luna, prossimo evento), **Che cielo avrai** (tutto il meteo: nuvole e seeing), **Cosa guardare** (tutti gli astri: migliori bersagli, pianeti, stazioni spaziali), **Prossimi appuntamenti**. |
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
| 6096–6751 | **7. Il planetario** — stato `sky`, algebra Est/Nord/Alto, filtro anti-tremolio bussola, limiti del campo visivo, campo visivo AR | `skyElenco()` (**6220**, che tiene dentro anche gli oggetti profondi), `skyVoceDiId()` (**6283**, l'astro *o* l'oggetto profondo che si chiama così), `sky` (**6295**), `sky.reg` (**6439**), `skyVettore()` (**6464**), `SKY_FOV_MIN` (**6650**)/`skyImpostaFov()` (**6667**), `skyProietta()` (**6799**) |
| 6752–7460 | **7.1** Posizione e sensori; **7.1-bis** posizione a tre strati (GPS → IP → a mano) | `skyRichiediPosizione()` (**7121**), `posizioneDallaRete()`, `trovaPosizioneAStrati()` (**7362**), declinazione magnetica (**6785**) |
| 7461–7711 | **7.1-ter** Il luogo da cui si guarda: il planetario può spostare l'occhio altrove senza toccare la posizione dell'app | `skyLuogoDelCielo()` (**7482**), `skyAggiornaOsservatore()` (**7498**), `skyImpostaLuogoVista()`, `skyTornaAlLuogoDiCasa()`, `skyInizializzaLuogoVista()` (**7614**) |
| 7712–8052 | **7.2** Posizioni degli astri (Sole, Luna, pianeti, stelle `Star1…Star8`); qui si calcolano anche l'ombra della Terra sulla Luna e l'apertura degli anelli di Saturno. Ogni quanto rifarle non è fisso: si adatta a quanto si è ingranditi (mezzo pixel di movimento del cielo), mentre i numeri scritti attorno alla mappa vanno più piano | `skyIntervalloCalcolo()` (**7749**), `SKY_UI_INTERVALLO` (**7747**), `skyAggiornaOggetti()` (**7756**), `skyOmbraDellaTerra()` (**7853**), `skyAssettoDiSaturno()` (**7893**) |
| 8053–8374 | **7.3 / 7.3.1** Disegno del cielo e aspetto dell'aria: colore del fondo per ora del giorno, foschia, aloni, Via Lattea | `skyAria()`, `skyDisegnaSfondo()` (**8142**), `skyDisegnaViaLattea()` |
| 8375–9874 | **7.3.2 La pelle degli astri** — le facce vere, dipinte una volta sola su tele fuori schermo: Luna coi mari, Sole con granulazione e corona, pianeti con bande e calotte, nebulose e galassie, profilo dell'orizzonte, eclissi | `skyPelle()` (**8433**), `SKY_FACCE` (**9066**), `skyFacciaDi()` (**9083**), `skyDisegnaGlobo()` (**9284**), `SKY_PROFILO` (**9381**), `skyDisegnaTerreno()` (**9525**), `skyDisegnaLuna()` (**9698**), `skyDisegnaPianeta()` (**9795**), `skyDisegnaSole()` (**9834**), `skyEclisseDiSole()` (**9896**) |
| 9875–10468 | **7.3 (seguito)** Misura degli astri (icona o disco vero), disegno di ogni astro, ciclo di disegno | `skyRaggio(o, focale)` (**9947**), `skyDisegnaAstro()` (**10008**), `skyDisegna()` (**10271**) |
| 10469–10607 | **7.3-bis** Traccia dell'oggetto osservato: la strada che percorre nelle ore attorno all'istante mostrato, con l'ora segnata di ora in ora | `skyCalcolaTraccia()` (**10501**), `skyDisegnaTraccia()`, `SKY_TRACCIA_ORE` (**10482**) |
| 10608–11026 | **7.3-ter** Eclittica: il cerchio del Sole in un anno, coi puntini dei mesi e il filo a piombo che misura quanto l'oggetto scelto sta sopra o sotto. Insieme a lei l'**analemma** (il Sole alla stessa ora ogni giorno per un anno) | `skyCalcolaEclittica()` (**10688**), `skyDisegnaEclittica()`, `skyScartoEclittica()`, `skyCalcolaAnalemma()` (**10877**) |
| 11027–12061 | **7.3-quater** La lezione dell'eclittica: sei quadri animati (Sistema Solare dall'alto → di taglio → il piano → la riga vista da qui → l'analemma → i nodi e le eclissi). Si apre dal tasto nella scheda del Sole | `LEZ_CAPITOLI` (**11059**), `lez`, `apriLezioneEclittica()`, `lezQuadroSistema/Cielo/Analemma/Nodi()`, `stagioneEclissiHtml()` (**12008**) |
| 12140–12690 | **7.4** Interfaccia del planetario e scheda dell'oggetto (si apre **solo** toccando l'oggetto sulla mappa), inseguimento. Qui anche l'**elenco degli astri**: diviso in cinque famiglie (Sole e Luna, pianeti, stelle, cielo profondo, stazioni), con la ricerca per nome appiccicata in cima, i tasti delle **categorie** e il filtro «Su ora» | `SKY_FAMIGLIE` (**12152**), `skyCostruisciCategorie()` (**12164**), `skyImpostaFamigliaAstri()` (**12178**), `skyCostruisciElenco()` (**12196**), `skyFiltraElenco()` (**12240**), `skyAggiornaStileElenco()`, `skyAlternaInseguimento()`, `skyInsegui()`, `skyAggiornaTastoInsegui()` (tiene d'accordo i due tasti: quello del pannello Navigazione e il bersaglio sulla mappa) |
| 12604–13087 | **7.4-bis** Eventi del calendario dentro il planetario: elenco (in corso, ore vicine, **prossimi 7 giorni**), chip e segni sulla mappa (radiante, anello sull'astro eclissato) | `skyEventiVicini()` (**12655**), `skyTastoMappaHtml()` (**12750**), `skyApriMappaEvento()` (**12765**), `skyAggiornaEventi()` (**12839**), `apriEventoNelPlanetario(id)` (**12928**) |
| 13088–13437 | **7.4-ter Movimenti morbidi** — perché il cielo non faccia scatti: inerzia del trascinamento (si lascia andare e si spegne da sé), zoom che ci scivola dentro invece di saltarci, spostamento verso un oggetto con partenza e arrivo lisci. Tutti smorzamenti esponenziali col `dt` del fotogramma, per comportarsi uguale a qualunque cadenza | `skyDeltaFotogramma()` (**13111**), `skyMuoviZoom()` (**13125**), `skyGradiAzPerPixel()` (**13167**), `skyRicordaTrascinamento()` (**13175**), `skyLanciaVista()` (**13192**), `skyScorriPerInerzia()` (**13205**), `skyFermaMovimenti()` (**13223**), `skyCentraSu()` (**13231**), `skyInsegui()`, `skyMuoviVista()` |
| 13438–14013 | **7.4-quater** Avvio della vista, ciclo di disegno, gesti (trascinamento, pizzico, tocco, rotellina) e collegamento di tutti i comandi | `skyAvvia()`, `skyCiclo()` (**13486**), `apriSkymap()`, `skyZoom()` (**13561**), `skyInizializzaGesti()` (**13574**), `inizializzaSkymap()` (**13740**) |
| 14014–14161 | **7.5** Schermo intero (dal pannello Visualizzazione, dal ⛶ sulla mappa, con Esc o col doppio clic) | `skyAlternaSchermoIntero()` (**14028**), `skyAggiornaTastiSchermo()` (**14108**) |
| 14162–14277 | **7.5-bis** Le finestre che si aprono sopra il cielo a schermo intero (Sistema Solare, lezione, mappa dell'ombra, simulazione): finché il cielo è a schermo intero vanno a stare **dentro** il suo riquadro, se no il pieno schermo vero non le disegna e il ripiego in CSS le copre. Alla chiusura tornano da dove erano venute | `skyGuscioSchermoIntero()` (**14220**), `skyOspitaModale()`, `skyRestituisciModale()`, `skySistemaModaliSchermoIntero()`, `skyRiportaModaliDalCielo()`, `skyInizializzaModaliSopraIlCielo()` |
| 14278–14369 | **7.5-ter** Il pannello del tempo **prestato** alla finestra del Sistema Solare: toccando la lettura della sua barra si apre lo stesso pannello del planetario — non una copia, proprio quel nodo, spostato lì finché serve. Da ospite tace ciò che lì non vorrebbe dire niente (`[data-solo-cielo]`: passo, playback, luogo) | `skySezioneTempo()` (**14314**), `solAlternaPannelloTempo()`, `solApriPannelloTempo()` (**14330**), `solChiudiPannelloTempo()`, `solPannelloTempoAperto()` |
| 14370–14801 | **7.6 Registrare un momento**: pochi secondi di cielo in un filmato (MediaRecorder, mp4 dove c'è, se no webm) da condividere o salvare. Il tasto sta sulla mappa, non in un pannello | `skyRegAvvia()` (**14532**), `skyRegComponi()`, `skyRegFirma()`, `skyRegFerma()`, `skyRegAggiornaComando()`, `skyRegCondividi()` |
| 14930–16160 | **7.7 Il Sistema Solare in 3D** — la stessa ora del planetario, ma guardata da fuori: posizioni vere in proiezione **ortogonale**, orbite campionate per un giro intero, filo a piombo sul piano dell'eclittica e la riga che unisce la Terra all'oggetto scelto. Si gira col dito (dall'alto → di taglio, nel verso del modellino: il dito porta con sé la scena), si sposta con due dita, si pizzica per avvicinarsi, si tocca un pianeta per sceglierlo. Tre metri si possono cambiare: distanze compresse o vere, altezza fuori dal piano vera o ×10, pallini ingranditi o in scala fra loro. Il tempo è quello del planetario, con la stessa barra | `SOL_PIANETI` (**14975**), `sol` (**15022**), `solProietta()` (**15085**), `solLeggiPosizioni()` (**15131**), `solCalcolaOrbite()` (**15160**), `solDisegna()` (**15425**), `solElongazione()` (**15495**), `solInMarcia()` (**15735**), `solCentra()` (**15878**), `solRipristinaVista()` (**15897**), `solInizializzaGesti()` (**15912**), `solAlternaSchermoIntero()` (**16073**), `apriSistemaSolare()` (**16159**) |
| 15806–17437 | **8. Simulazione dell'evento** — stato `sim` (**15829**), una scena per tipo | `simScenaEclissiLunare/Solare/FaseLunare/Stagioni/Sciame/Elongazione/Cielo` |
| 17438–17613 | **9. Congiunzioni e occultazioni** | |
| 17614–17647 | **10. La posizione usata da tutta l'app** | `luogoCorrente()` (**17624**) |
| 17648–18247 | **10-bis. Finestra della posizione** + ricerca città (locale, poi Open-Meteo) | `apriPosizione(forza)` (**17702**), `inizializzaPosizioneUI()` (**17953**) |
| 18248–18422 | **11. Meteo e indice di osservabilità** | `indiceOsservabilita(evento)` (**18349**) |
| 18423–18471 | **12. Strumento necessario** (occhio / binocolo / telescopio) | `STRUMENTI` (**18428**) |
| 18472–18869 | **13. Passaggi di ISS e Tiangong** (SGP4) | `SATELLITI` (**18483**) |
| 18870–19135 | **14. Vista "Stasera"** | `costruisciStasera()` (**18907**) |
| 19136–19337 | **15. Diario e traguardi** | `TRAGUARDI` (**19172**), `caricaDiario()` (**19148**) |
| 19338–19718 | **16. Condivisione (`?evento=`), export `.ics`, backup JSON** | `esportaBackup()` (**19577**), `urlEvento(id)` (**19341**) |
| 19719–19770 | **17. Consigli di astrofotografia** | `consigliFoto(evento)` (**19724**) |
| 19771–20677 | **18. Costellazioni e deep sky nel planetario**, macchina del tempo, **barra del tempo** (la riga sempre in vista in fondo alla mappa), playback, fotocamera AR | `SKY_COSTELLAZIONI` (**19778**), `SKY_PROFONDO` (**19911**, con le misure vere), `skyDisegnaProfondo()` (**20094**), `skyAggiornaTestoTempo()` (**20521**), `skyTestoBarraTempo()` (**20589**), `SKY_CASELLE_DATA` (**20723**)/`skyVaiAllaDataScritta()` (**20779**), `skyLimiteTempoSec()` (**20597**), `skyImpostaOffsetTempo()` (**20812**) |
| 20678–20795 | **19. Schede dell'agenda, arricchite** | `bloccoLocaleHtml()` (**20684**), `barraAzioniHtml()` (**20739**) |

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
| `sky` | `app.js:6295` | Planetario: canvas, posizione, sensori, fov, target, tempo, `eclisse` (l'eclissi di Sole in corso) e `ariaOra` (i colori dell'aria di questo istante). `sky.posizione` è la posizione dell'app; `sky.luogoVista` il luogo di sola visita del planetario (non salvato), e `sky.observer` nasce dal secondo se c'è, dalla prima se no. `sky.fov` è il campo disegnato adesso e `sky.fovVoluto` quello a cui sta andando; `sky.inerzia` è la corsa lasciata dal dito e `sky.animazioneVista` lo spostamento verso un oggetto (sezione 7.4-ter). `sky.famigliaAstri` è la categoria scelta nel pannello Astri e `sky.soloAstriVisibili` il filtro «Su ora»: tutt'e due filtrano l'*elenco*, non la mappa. |
| `sky.reg` | `app.js:6365` | Registrazione di un momento: durata, tela di montaggio, registratore, risultato. |
| `skyTele` | `app.js:8419` | Le facce già dipinte degli astri, una per taglia. Al massimo diciotto: oltre, se ne va la più vecchia. |
| `sol` | `app.js:15022` | Sistema Solare in 3D: telecamera (`az`, `elev`/`elevVoluta`, `zoom`/`zoomVoluto`, spostamento nella tela `panX`/`panY`), metro delle distanze (`distanzeVere`) e ingrandimento fuori dal piano (`esagera`), posizioni eliocentriche in UA (`pianeti`, `luna`), orbite campionate (`orbite`), pianeta scelto (`scelto`) e marcia del tempo (`marcia`, `velIndice`). L'istante non è suo: lo legge da `skyAdesso()` e lo sposta con `skyImpostaOffsetTempo()`; anche la marcia è condivisa — `solInMarcia()` mette insieme `sol.marcia` e il playback del planetario, che qui dentro continua a camminare. |
| `sim` | `app.js:15829` | Simulazione: canvas, scena, posizione nel tempo, velocità. |
| `tel` | `telescopio.js:168` | Telescopio: profilo, pannello, allineamento, push-to. |
| `cat` | `catalogo.js` | Il catalogo del cielo. `versoriJ2000` (fermi, calcolati una volta) e `versoriOra` (riscritti a ogni aggiornamento con una sola matrice), `magnitudini`, `famiglie` (il colore, già in bucket), `figure`, `profondo`. `stato` dice se i dati sono arrivati; `secondoLivello` se sono arrivate anche le stelle deboli. |
| `corpiMinori` | `corpi-minori.js` | `elenco` sono comete e asteroidi del file, `miei` quelli incollati a mano dall'utente. |
| `meteoAstro` | `meteo-astro.js` | Previsioni ora per ora con seeing e trasparenza già calcolati. |
| `aurora` | `meteo-astro.js` | Indice Kp attuale e previsto dal NOAA. |
| `orizzonteMio` | `pianifica.js` | I sedici settori del profilo degli ostacoli. |

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
| `CHIAVE_CIELO_CASA` | `astrocalendario_cielo_casa` (la scala di Bortle, in `catalogo.js`) |
| `CHIAVE_ORIZZONTE` | `astrocalendario_orizzonte` (i sedici settori degli ostacoli) |
| `CHIAVE_CORPI_MIEI` | `astrocalendario_corpi_minori_miei` (comete e asteroidi incollati a mano) |
| `CHIAVE_METEO_ASTRO` | `astrocalendario_meteo_astro` |
| `CHIAVE_AURORA` | `astrocalendario_aurora` |

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
- **Dopo ogni modifica ai file dell'app, incrementa `CACHE_NAME` in `sw.js`**
  (oggi `astrocal-v52`): senza questo, chi ha già installato la PWA continua a
  vedere la versione vecchia.
- Se aggiungi un file all'app, aggiungilo anche a `ASSETS` in `sw.js`. **I
  `dati-*.js` no**: restano fuori di proposito, e il service worker se li tiene
  da sé quando passano (regola «stessa origine»).

### Il banco di prova — `verifica.html`

Per la gran parte del codice la verifica resta quella di sempre: si apre l'app e
si guarda la vista toccata. Ma i conti astronomici non si controllano a occhio —
un segno sbagliato non si vede, e mezzo grado di errore sembra un problema di
bussola. Per quelli c'è `verifica.html`:

```
python3 -m http.server 8000     # poi apri localhost:8000/verifica.html
```

Trentatré controlli contro valori noti: le coordinate di catalogo delle stelle
famose, il motore del cielo contro `Astronomy.Horizon()`, il raggio orbitale
delle quattro lune di Giove, il propagatore di Keplero contro le posizioni vere
dei pianeti, l'eclissi del 2027, il transito di Mercurio del 2032. **Va aperto da
un server**: i cataloghi si caricano come `<script>` e `file://` non lo permette.

Se tocchi qualcosa in `catalogo.js` o `corpi-minori.js`, passa di lì prima di
chiudere.

### Rigenerare i cataloghi — `scripts/costruisci-dati.js`

I `dati-*.js` non si scrivono a mano. Si rifanno da fonti pubbliche:

```
node scripts/costruisci-dati.js <cartella-dati-d3-celestial> . <ssystem_minor.ini>
```

- stelle, costellazioni e cielo profondo vengono da
  [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3, a monte
  Hipparcos, Yale BSC e il catalogo di Messier);
- gli elementi orbitali di comete e asteroidi da `ssystem_minor.ini` di
  [Stellarium](https://github.com/Stellarium/stellarium) (GPL, a monte MPC e JPL).

Gli elementi orbitali **invecchiano**: per gli asteroidi vanno bene per anni, per
le comete no. Vale la pena riprenderli a ogni rilascio importante.

## 12. Dove guardare per…

| Richiesta | Punto di partenza |
|---|---|
| Nuovo tipo di evento astronomico | `calcolaEventiAstronomi()` `app.js:676` + una `aggiungi…()`, poi `CATEGORIE` `app.js:36` |
| Nuova scena della simulazione | `app.js:16044` (costruzione scena) e una `simScena*` |
| Qualcosa nel planetario | `sky` `app.js:6295`, disegno da `app.js:8054` |
| Eventi mostrati nel planetario | `SKY_EVENTI_FINESTRA_MIN`, `SKY_EVENTI_SETTIMANA_MS` + `skyAggiornaEventi()` (sezione 7.4-bis) |
| "Vedi nel planetario" (dalle schede dell'agenda e dall'elenco della settimana) | `apriEventoNelPlanetario(id)` (sezione 7.4-bis) |
| Registrare e condividere un momento | sezione 7.6: `skyRegAvvia()`, il montaggio in `skyRegComponi()`, la firma in `skyRegFirma()`; il tasto è `#skymap-btn-registra` **sulla mappa** (`.tasto-registra-cielo` dentro `.comandi-mappa-cielo`), la durata i chip `[data-durata-reg]` nel pannello Visualizzazione; stili `.tasto-registra-cielo`, `.tempo-reg`, `.pannello-clip` |
| Quanto si può ingrandire, e quanto grandi si disegnano gli astri | `SKY_FOV_MIN` / `SKY_FOV_MAX` e `skyImpostaFov()` (`app.js:6593`); la misura di ogni astro in `skyRaggio(o, focale)` (`app.js:9947`), che sceglie fra icona fissa e disco vero (diametro ÷ distanza) |
| Il cielo si muove a scatti (trascinamento, zoom, centratura) | sezione **7.4-ter**: `sky.fov` è il campo disegnato adesso e `sky.fovVoluto` quello a cui si sta andando (`skyImpostaFov(g, { morbido: true })` chiede il viaggio, `skyMuoviZoom()` lo fa); l'inerzia è `skyLanciaVista()` + `skyScorriPerInerzia()`, e si spegne sempre con `skyFermaMovimenti()`. Le costanti da girare: `SKY_TAU_ZOOM`, `SKY_TAU_INERZIA`, `SKY_INERZIA_MAX_SCHERMI` |
| Le stelle saltellano di un pixel una volta al secondo | `skyIntervalloCalcolo()` (`app.js:7749`): ogni quanto `skyAggiornaOggetti()` rifà le posizioni. Si adatta al campo (mezzo pixel di movimento del cielo), fra `SKY_CALCOLO_MIN_MS` e `SKY_CALCOLO_MAX_MS`. I numeri scritti attorno alla mappa vanno invece a `SKY_UI_INTERVALLO`, più piano |
| Il cielo resta indietro sotto il dito quando si guarda in alto | `skyGradiAzPerPixel()` (sezione 7.4-ter): un pixel vale più gradi di azimut quanto più si guarda in alto (fattore 1/cos, tosato a 4) |
| La faccia di un astro (mari della Luna, bande di Giove, calotte di Marte) | il pennello `skyDipingi*` nella sezione 7.3.2, registrato in `SKY_FACCE` (`app.js:9066`). Si dipinge in un mondo dove il disco ha raggio 1; le macchie si mettono con `skyMacchiaSfera(lon, lat, …)` (`app.js:8492`), che le schiaccia da sé verso il bordo |
| Un'eclissi di Sole (corona, morso, cielo che si spegne) | `skyEclisseDiSole()` (`app.js:9896`) calcola la copertura a ogni fotogramma in `sky.eclisse`; da lì dipendono `skyRaggioIcona()` (la Luna prende la misura giusta rispetto al Sole), la corona in `skyDisegnaSole()`, il bagliore in `skyDisegnaAloneSole()` e il colore del cielo in `skyAriaEclissata()` |
| Un'eclissi di Luna (il morso ramato) | `skyOmbraDellaTerra()` (`app.js:7853`, una volta al secondo) e `skyDisegnaOmbraLunare()` (`app.js:9751`) |
| Perché un astro non è trasparente | `skyColoreNotteAstro()` (`app.js:9253`): il lato in ombra si riempie del colore del cielo, tanto quanto il cielo è chiaro — di notte copre le stelle, di giorno sparisce. E `skyVeloAtmosferico()` (`app.js:9354`) smorza e arrossa invece di sbiadire |
| Il profilo dell'orizzonte (colline e alberi) | `SKY_PROFILO` (`app.js:9381`, calcolato una volta all'avvio), `skyAltezzaOrizzonte()` (`app.js:9410`) e `skyDisegnaProfiloOrizzonte()` (`app.js:9601`) |
| Puntare una nebulosa o una galassia dall'elenco | Nell'elenco degli astri stanno anche loro, con identificativo `dso:<nome>` (`skyElenco()`): chi li cerca passa da `skyVoceDiId()`, che li trova in `SKY_PROFONDO` e ne calcola azimut e altezza con `skyPosizioneProfondo()` (mezzo minuto di cache). Da lì funzionano come gli altri bersagli: centratura, freccia guida, inseguimento |
| Come si vedono nebulose, galassie e ammassi | `skyPennelloProfondo()` (`app.js:9094`) dipinge la nuvola, `skyDisegnaProfondo()` (`app.js:20094`) la mette in cielo grande quanto è davvero (`assePrimi`, `asseMinore`, `angoloPosizione` in `SKY_PROFONDO`) |
| Traccia dell'oggetto nel planetario | `skyCalcolaTraccia()` (sezione 7.3-bis), tasto `skymap-btn-traccia` nei Filtri |
| Eclittica e scarto di un astro da essa | `skyCalcolaEclittica()` (sezione 7.3-ter), tasto `skymap-btn-eclittica` nei Filtri; conversioni in `skyEquatorialiDiEclittica()` / `skyEclitticaDiEquatoriali()` |
| Analemma (l'otto del Sole) | `skyCalcolaAnalemma()` sulla mappa e `lezQuadroAnalemma()` nella lezione; l'equazione del tempo si ricava da `Astronomy.HourAngle` in `lezLeggiAnalemma()` |
| Il Sistema Solare visto da fuori (vista 3D) | sezione **7.7**: stato `sol`, `apriSistemaSolare()`. La geometria è tutta in tre funzioni — `solRaggio(ua)` (il metro: distanze vere o compresse), `solScena(v)` (dal vettore in UA al punto della scena, con l'altezza fuori dal piano ingrandita per ultima) e `solProietta(p)` (ortogonale, con la `vicinanza` che ordina chi sta davanti). Le posizioni vengono da `Astronomy.HelioVector` + `Astronomy.Ecliptic` in `solVettore()`; le orbite le campiona `solCalcolaOrbite()` seguendo il pianeta per un periodo intero. Markup in `modale-sistema`, stili `.sol-*` in `style.css` |
| I tasti che aprono la vista 3D | `#skymap-btn-sistema` in fondo al pannello **Astri** (collegato in `inizializzaSkymap()`), e «Vedilo dall'esterno» dentro `skySchedaHtml()` per il Sole e per ogni pianeta |
| Muovere la vista 3D (girarla, spostarla, avvicinarla, scegliere un pianeta) | `solInizializzaGesti()` (sezione 7.7): un dito gira (`sol.az`, `sol.elev`) **nel verso del modellino** — il dito porta con sé la scena, non l'occhio: `SOL_GIRO_PER_PIXEL` e `SOL_ELEV_PER_PIXEL`, entrambi col segno di `dx`/`dy` —, due dita insieme pizzicano *e* spostano (`solSposta()` → `sol.panX`/`sol.panY`, che `solProietta()` somma al centro), col mouse si sposta con Maiusc o col tasto destro (`sol.modoPan`), la rotella avvicina (morbida, verso `sol.zoomVoluto`), un tocco secco sceglie il pianeta più vicino con `solTocco()`. Il tasto ⌖ `#sol-centra` (o il tasto C) rimette la scena in mezzo con `solCentra()`. **Ogni volta che cambia il numero di dita, `riancora()` rifà i riferimenti del gesto**: senza, dopo un pizzico il dito rimasto veniva misurato dal punto in cui si era appoggiato prima, e la scena scattava di venti gradi. I tasti dei punti di vista non saltano: muovono `sol.elevVoluta` e `sol.zoomVoluto`, e ci si arriva scivolando dentro `solCiclo()` (`SOL_TAU_VISTA`, `SOL_TAU_ZOOM`) |
| Quanto sono grossi i pallini dei pianeti nella vista 3D | `solRaggioCorpo()` sceglie fra le due misure: il campo `raggio` di `SOL_PIANETI` (ingranditi, con `SOL_RAGGIO_SOLE` e `SOL_RAGGIO_LUNA`) e il diametro vero `km` × `SOL_PX_PER_KM` (in scala fra i corpi; il Sole no, sarebbe quattro volte il disegno, e `SOL_SOLE_MAX` lo tosa). Non sono in scala (a scala vera la Terra sarebbe un centesimo di pixel): sono misure da toccare col dito. Da lì dipendono da sé l'area sensibile di `solTocco()` e il posto dei nomi, che in `solDisegna()` partono da un elenco di zone occupate con dentro tutti i corpi — una scritta bianca sul disco del Sole non si leggerebbe |
| Rimettere a posto la vista 3D (ci si perde col pan) | `solRipristinaVista()` (sezione 7.7): riporta spostamento, giro e ingrandimento a `SOL_VISTA_INIZIALE`, scivolando come i tasti dei punti di vista. Il tasto è il ⟲ `#sol-reset` **appoggiato sulla scena** (`.comandi-mappa-sistema`), o il tasto R. `solCentra()` invece rimette solo lo spostamento (⌖ `#sol-centra` fra i comandi, tasto C, e i due tasti dell'inquadratura) |
| La vista 3D a tutto schermo | sezione **7.7-bis**: `solAlternaSchermoIntero()` manda a schermo intero il **guscio** `#sol-guscio`, non la finestra — dentro ci sono già la tela, la barra del tempo e il pannello del tempo, e con loro i quattro tasti sulla scena (⛶/✕, ⟲, −, +). Come per la mappa dell'ombra c'è il ripiego per chi non ha l'API Fullscreen sugli elementi (`solRipiegoSchermo()`: il guscio esce dal modale e si appende al body, con un segnaposto per il ritorno). `chiudiSistemaSolare()` esce dal pieno schermo **per primo**. Stili `.sol-guscio:fullscreen` / `.sol-schermo-pieno`, `body.sol-immersivo`, `.comandi-mappa-sistema`, `.tasto-mappa-sistema` |
| La barra del tempo della vista 3D | `#sol-tempo` in `index.html`: sono le classi della barra del planetario (`.barra-tempo`, `.tasto-barra-tempo`, `.lettura-barra-tempo`, `.slitta-tempo`), che vogliono solo `--tasto-tempo` — glielo dà `.sol-barra-tempo`. Il passo (`SOL_PASSI`) decide da solo tre cose: quanto saltano − e +, quanto copre la slitta e quanto corre il play (`SOL_PASSI_AL_SECONDO`). Stato e disegno in `solAggiornaBarra()`; mentre la slitta scorre il tempo si sposta `fluido`, e il conto pieno si fa al `change` |
| Quando si vede un pianeta ("la sera", "tutta la notte") | `solElongazione()` + `solQuandoSiVede()` (sezione 7.7): l'angolo Sole–Terra–pianeta e da che parte del Sole sta. È geometria del Sistema Solare, non dipende da dove sei; per gli orari veri della tua località restano `costruisciStasera()` e le schede dell'agenda |
| La lezione animata dell'eclittica | `LEZ_CAPITOLI` (i testi dei sei quadri) e `lez*` (sezione 7.3-quater); markup in `modale-lezione`, stili `.lez-*` in `style.css`; il tasto sta in `skySchedaHtml()`, solo per il Sole |
| "Perché proprio adesso" sotto un'eclissi | `stagioneEclissiHtml(data)` + `mostraStagioneEclissi(id, data)` (fine 7.3-quater): nodo lunare più vicino, latitudine della Luna, eclissi compagne. Appare in `#eclissi-stagione` (mappa dell'ombra), `#lunare-stagione` (eclissi lunare) e `#sim-eclittica` (simulazione) |
| Aprire la lezione a un quadro preciso | `apriLezioneEclittica('nodi')` — accetta il `tipo` del capitolo o il suo indice |
| Passo del tempo e finestra della slitta (sono un comando solo) | `SKY_FINESTRA_DEL_PASSO`, `skyImpostaPassoTempo()`, `skySpostaDiUnPasso()`; nel markup i chip `[data-passo-tempo]`, nel pannello Tempo |
| Scrivere una data a mano (gg/mm/aaaa e hh:mm:ss) | `SKY_CASELLE_DATA` + `skyDataDalleCaselle()` / `skyVaiAllaDataScritta()` (fine sezione 18): sei `<input type="number">` dentro a `#skymap-data` (nel pannello **Tempo e luogo**), più il tasto `#skymap-data-vai`. Le caselle stanno ferme finché una di loro ha il fuoco (`skyAggiornaCampoData()`); una data che non esiste — il 31 di febbraio, un anno fuori scala — non muove niente e le caselle tornano a dire l'istante mostrato. Stili `.campo-data`, `.casella-data`, `.sep-data` |
| Fin dove arriva il tempo (avanti e indietro) | `ANNO_MINIMO_NAVIGABILE` / `ANNO_MASSIMO_NAVIGABILE` (`app.js:37`, oggi **1600–3000**): sono gli stessi estremi del selettore del mese e della macchina del tempo. Da lì `skyLimiteTempoSec(verso)` ricava lo scarto massimo in secondi (cambia di giorno in giorno), `skyAlCapolineaDelTempo()` dice se si è arrivati al fermo e `skyTestoCapolinea()` come dirlo a chi guarda |
| Tempo condiviso fra planetario e vista 3D | Un orologio solo: `sky.offsetTempoSec`. La 3D lo legge con `solOffset()`/`skyAdesso()` e lo sposta con `skyImpostaOffsetTempo()`; mentre la finestra è aperta il ciclo del cielo è in pausa, quindi è `solCiclo()` a far camminare anche il **playback del planetario** (`skyAvanzaPlayback()`). Il play della barra della 3D guarda `solInMarcia()` e ferma tutto con `solFermaTempo()` |
| La barra del tempo (l'orologio sempre in vista sulla mappa) | `#cielo-tempo` in `index.html` (dentro `#skymap-contenitore`, dopo i pannelli): ⟲ `skymap-tempo-adesso`, lettura `skymap-tempo-quando` (che apre il pannello Tempo), `skymap-passo-meno`/`-piu`, slitta `skymap-tempo`, play `skymap-tempo-play`. Testo in `skyTestoBarraTempo()` / `skyScartoBreve()`, stato in `skyAggiornaTestoTempo()` e `skyAggiornaComandiPlayback()`; stili `.barra-tempo`, `.tasto-barra-tempo`, `.lettura-barra-tempo`, `.slitta-tempo` |
| Quanto spazio lascia la barra a chi le sta sopra (zoom, scheda dell'oggetto, pannelli) | le misure `--tasto-tempo`, `--alta-barra-tempo` e `--sopra-barra-tempo` su `.vista-cielo` in `style.css`: cambiarle basta, le usano `.cielo-chrome`, `.comandi-mappa-cielo`, `.pannello-dettaglio` e `#skymap-overlay`. Sotto i 520px di larghezza la slitta va a capo da sola (media query dedicata) |
| Tasto della mappa dell'ombra negli eventi del planetario | `skyTastoMappaHtml()` + `skyApriMappaEvento(id)` (sezione 7.4-bis) |
| Colori della mappa dell'eclissi (chiara/scura) | `ECL_TAVOLOZZE` + `_eclApplicaTemaMappa()`, e `#mappa-eclissi.mappa-chiara` in `style.css` |
| Il terminatore sulla mappa dell'ombra (dov'è giorno e dov'è notte) | `ECL_NOTTE_SOGLIE` (le tre altezze del Sole: tramonto, crepuscolo civile, notte astronomica) e `_eclFasciaDellaNotte()`, che per ogni meridiano dà il tratto al buio con una formula chiusa — **non** si può chiudere il poligono sul polo, perché vicino agli equinozi il polo non è al buio. Disegno in `_eclDisegnaNotte()`, colori in `ECL_TAVOLOZZE[...].notte`, livelli nel riquadro Leaflet `ecl-notte` (z-index 350: sopra le tessere, sotto i tracciati). Si accende e si spegne con `eclissiAlternaNotte()` (tasto ◐ `#btn-eclissi-notte` sulla mappa) |
| Mappa dell'eclissi a tutto schermo (comandi in sovrimpressione) | `_eclAlternaSchermoIntero()` e `.ecl-guscio-filmato:fullscreen` / `.ecl-schermo-pieno` in `style.css` |
| Bussola sbagliata / cielo storto | filtro anti-tremolio `app.js:6244`, declinazione `app.js:6785` |
| Posizione non rilevata | posizione a strati `trovaPosizioneAStrati()` `app.js:7362`, finestra `app.js:17648` |
| Una posizione scelta a mano che "non resta" | `POS_SCELTA_UTENTE` / `POS_FONTI_AUTOMATICHE` e il guardiano in cima a `skyImpostaPosizione()` (`app.js:7028`): GPS, rete e posizione riletta non scavalcano una scelta dell'utente. Solo una cascata con `{ forzato: true }` (tasto "Rileva di nuovo", tasto Posizione del planetario) può farlo |
| Guardare il cielo da un altro luogo (solo nel planetario) | sezione 7.1-ter: `sky.luogoVista`, `skyLuogoDelCielo()`, `skyAggiornaOsservatore()`; i comandi stanno nel pannello **Tempo e luogo** e sono due soli: la ricerca della città (`#skymap-luogo-cerca`) e `#skymap-luogo-casa` |
| I comandi appoggiati sulla mappa (colonna a destra) | in `index.html`, `.comandi-mappa-cielo`: `#skymap-btn-schermo-mappa` (⛶), `#skymap-btn-insegui-mappa` (bersaglio), la registrazione, i due dello zoom. Girati vanno in riga sopra la barra del tempo (media query landscape in `style.css`); stili `.tasto-schermo-cielo`, `.tasto-insegui-cielo`, `.tasto-registra-cielo`, `.tasto-zoom-cielo` |
| Schermo intero del planetario | `skyAlternaSchermoIntero()` (sezione 7.5); i tasti sono `#skymap-btn-schermo` (pannello Visualizzazione), `#skymap-btn-schermo-mappa` (⛶ sulla mappa, in cima alla colonna dei comandi, sopra la registrazione) e `#skymap-btn-esci` |
| Il pannello del tempo dentro la finestra del Sistema Solare | sezione **7.5-ter**: la lettura `#sol-quando` chiama `solAlternaPannelloTempo()`, che porta la `section[data-gruppo="tempo"]` dentro `#sol-tempo-corpo` e alla chiusura la rimette dov'era. **`chiudiSistemaSolare()` la restituisce per prima**, o resterebbe murata in un modale nascosto. Le righe che lì non servono sono marcate `data-solo-cielo` in `index.html`; stili `.sol-pannello-tempo` e `.gruppo-ospite` |
| Prestare un pezzo di pagina a un'altra finestra | `skyRicordaPosto(mappa, nodo)` / `skyRimettiAlSuoPosto(mappa, nodo)` (in cima alla 7.5-bis): si ricorda il padre **e** il fratello che veniva dopo. Li usano le finestre sopra al cielo (7.5-bis) e il pannello del tempo (7.5-ter), ognuno con la sua mappa |
| Cercare un astro per nome, per categoria, o vedere solo quelli su adesso | `skyFiltraElenco()` (sezione 7.4): campo `#skymap-astri-cerca` (ricerca morbida con `normalizzaTesto`, Invio sceglie il primo), tasti delle categorie `#skymap-astri-categorie` → `sky.famigliaAstri`, tasto `#skymap-astri-visibili` → `sky.soloAstriVisibili`. I tre filtri si sommano. Chi resta fuori lo dice `data-fuori="si"`, **non** una classe: `skyAggiornaStileElenco()` riscrive il `className` di ogni pillola a ogni giro. Stili `.cerca-astri` (appiccicata in cima), `.segmenti-categorie`, `.famiglia-astri`, `.titolo-famiglia`, `body .chip-astro` |
| Una finestra che non si vede col cielo a schermo intero | sezione **7.5-bis**: finché il planetario è a schermo intero le `.velo-modale` aperte vengono spostate dentro `#skymap-contenitore` (e riportate al loro posto alla chiusura). Nessuna `apri…()` è stata toccata: a guardare la classe `hidden` è un `MutationObserver` in `skyInizializzaModaliSopraIlCielo()`. Stile dell'ospite: `.modale-sopra-il-cielo` in `style.css` |
| Meteo o semaforo di osservabilità | `app.js:18248` |
| Calcoli ottici del telescopio | `telescopio.js:243` |
| Impaginazione su telefono | `PUNTI_ROTTURA` `app.js:211` + i `@media` di `style.css` |
| Nuova icona | `DISEGNI` `app.js:53` |
| Le stelle del cielo (quante, quali, di che colore) | `catalogo.js`: i dati in `dati-stelle.js` (mag ≤ 6) e `dati-stelle-deboli.js` (fino a 7, caricato solo se serve); il motore in `catAggiornaPosizioni()`, il disegno in `catDisegnaStelle()`. Quante se ne vedono lo decide `catMagnitudineLimite()`, che somma il cielo di casa (Bortle) e lo zoom |
| Il cielo è storto o specchiato dopo un tocco al catalogo | `catMatriceCielo()` in `catalogo.js`: `RotationMatrix.rot` è memorizzata `rot[sorgente][destinazione]`, cioè trasposta rispetto a come si scrive a mano, e la terna della libreria è (Nord, Ovest, Zenit) mentre `skyProietta` vuole (Est, Nord, Alto) |
| Un astro fuori posto di mezzo grado | quasi sempre è la precessione: `Astronomy.Horizon()` vuole coordinate **dell'equatore di oggi**, i cataloghi sono in J2000, e fra i due ballano 0,36°. Passando per `catMatriceCielo()` la correzione è obbligata |
| Le costellazioni (tutte e 88, i nomi italiani) | `dati-costellazioni.js` + `catDisegnaFigure()`. Quante se ne disegnano dipende dal campo: `rango` 1 a campo largo, fino a 3 ingrandendo |
| Messier e il cielo profondo | `dati-profondo.js` (142 oggetti). Il disegno resta `skyDisegnaProfondo()` in `app.js`, che riceve i dati da `catAggiornaPosizioni()`. Con che strumento si veda lo decide `profondoStrumento()` a partire dal Bortle, **non** è scritto nei dati |
| Il cielo di casa (scala di Bortle) | `cieloDiCasa()` / `impostaCieloDiCasa()` in `catalogo.js`, `CAT_CIELI`. È in sincrono col `profilo.cielo` del telescopio: cambiarlo di là o di qua è la stessa cosa |
| Il palazzo di fronte (ostacoli sull'orizzonte) | `orizzonteCarica()` / `orizzonteAltezza(az)` in `pianifica.js`: sedici settori, interpolati. Entra nella curva della notte e nella scelta dei bersagli |
| Toccare una stella qualsiasi e sapere cos'è | `catStellaNelPunto()` + `catSchedaStella()` in `catalogo.js`, agganciate in fondo a `skyOggettoNelPunto()` (`app.js`). Il fondo di stelle si cerca **per ultimo**, dopo pianeti, cielo profondo e corpi minori: cinquemila puntini vincerebbero su tutto |
| Il colore di una stella, e la sua temperatura | `catTemperaturaDaBV()` (formula di Ballesteros: col B−V del Sole restituisce 5.778 K) e `catClasseDaBV()`. La classe è **dedotta dal colore**, non di catalogo: per le giganti sbaglia di una lettera, e la scheda lo dice |
| Comete e asteroidi sulla mappa | `corpiMinoriVisibili()` (posizioni, cache di mezzo minuto) e `corpiMinoriDisegna()` in `corpi-minori.js`; tasto `#skymap-btn-corpiminori` nei Filtri, stato `sky.mostraCorpiMinori` |
| Le lune di Giove | `luneDiGiove()` in `corpi-minori.js` (posizioni, transiti, ombre, eclissi) e `disegnaLuneDiGiove()` in `ui-nuova.js`. Compaiono nella scheda di Giove |
| Comete e asteroidi | `corpi-minori.js`: `posizioneCorpoMinore()` è Keplero a mano (ellisse, parabola con Barker, iperbole), `corpoMinoreInCielo()` porta in cielo. Gli elementi stanno in `dati-corpi-minori.js`, e se ne possono incollare altri con `corpiMinoriLeggiIncollato()` |
| Una cometa nuova, appena scoperta | non si aggiunge al file: si incollano gli elementi dell'MPC. Il file dei dati contiene solo quelle stabili |
| La curva dell'altezza di stanotte | `pianCurvaNotturna()` + `pianDisegnaCurva()` in `pianifica.js`. Sta in fondo alla scheda dell'oggetto nel planetario |
| «Cosa guardo stanotte» | `migliorDiStanotte()` in `pianifica.js` e `aggiornaStaseraMigliori()` in `ui-nuova.js` |
| I riquadri della dashboard (quali sono, in che ordine, cosa tengono dentro) | `#vista-stasera` in `index.html`: quattro `div[data-blocco]` — `riepilogo`, `cielo`, `guardare`, `prossimi`. I due raggruppati (`cielo` e `guardare`) tengono le loro parti in `.parti-gruppo > .parte-gruppo`, separate da un filo e non da una cornice; il titolo di ognuna è `.titolo-parte` (`.testa-parte` se ha un tasto suo). Gli `id` che il JavaScript riempie non sono cambiati: spostare una parte vuol dire spostare il suo `<section>`, non toccare il codice |
| Come si dispongono i riquadri di Stasera su schermo largo | `.griglia-stasera` in `style.css` (sezione GRIGLIE): riga e colonna di ognuno sono scritte a mano da 900px in su — le due schede corte affiancate, quella lunga larga quanto la pagina con le parti in fila. Lasciandole scorrere da sole la griglia lascia buchi: non è una muratura, le righe le detta il riquadro più alto |
| Quanto spazio lascia la barra di navigazione in fondo | `--barra-inferiore` in `style.css`: `calc(61px + env(safe-area-inset-bottom))` sotto i 1180px, `calc(48px + env(...))` col telefono girato. È la misura vera della barra, tacca del pollice compresa — se si cambia il `min-height` di `.voce-menu` o il suo `padding`, va rifatta anche qui |
| Seeing, trasparenza, griglia oraria del meteo | `meteo-astro.js`: `meteoSeeing()` (viene dal vento a 250 hPa, la corrente a getto), `meteoTrasparenza()` (dagli aerosol), `meteoGrigliaHtml()` per la griglia stile Clear Sky Chart |
| Aurora | `caricaAurora()` + `auroraDaQui()` in `meteo-astro.js`: indice Kp dal NOAA, confronto con la **latitudine geomagnetica** (non quella geografica — per l'Italia il divario conta) |
| Superlune, opposizioni, transiti sul Sole | `eventi-extra.js`, agganciato da `calcolaEventiIntervallo()` |
