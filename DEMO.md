# Demo automatizzate

Apri **Impostazioni → Demo automatizzate**. La schermata principale è pensata
per avviare un tour senza conoscere il DSL: scegli una demo, leggi durata,
data/luogo ed effetto previsto e premi **Avvia demo**. L'editor non occupa più
la pagina principale: si trova in **Dettagli avanzati**.

Le demo incluse sono di sola lettura. **Duplica e modifica** crea una bozza
personale e apre direttamente l'editor; per le demo personali sono disponibili
anche **Modifica**, esportazione ed eliminazione. **Crea nuova demo** e
**Importa demo da file** restano azioni secondarie.

Durante la riproduzione sono disponibili Pausa, Riprendi, Ricomincia e Termina
demo; la barra dice titolo, scena («scena 1/2 · Planetario · 8 s») e stato.
La persona può muovere la camera e cambiare i filtri: l'intervento manuale —
dito, mouse, **rotellina** o tasti di navigazione (frecce, Pagina, +/−) —
prende la camera per la scena corrente senza fermare il racconto. Escape o
**Termina demo** interrompono il tour e ripristinano vista, data/ora, luogo,
camera, FOV, filtri, inseguimento, playback, Sistema Solare, aurora e fullscreen.
Cambiare scheda mette in pausa la demo.

La spiegazione per chi usa l'app sta nella guida, **capitolo 10** (`guida.html#demo`,
e in inglese `guida-en.html#demo`): va tenuta allineata a questo file quando si
aggiunge un'azione o si cambia una regola.

## Le opzioni della demo

Sotto il tasto **Avvia demo** (pieno, largo, col segno del play: è l'azione
principale della scheda) c'è il riquadro **Durante la demo**. Le scelte si
ricordano in `astrocal_demo_opzioni_v1` (localStorage) e valgono solo per il
racconto. `vistaPulita` e `registraAudio` valgono `true` anche quando si
leggono preferenze salvate prima che queste due chiavi esistessero:

- **Avvia a schermo intero.** Il pieno schermo vero si chiede *una volta*,
  dentro al gesto del clic, sull'intero documento; le tre viste (planetario,
  3D, banco delle aurore) se lo passano col solo CSS
  (`skyEntraSchermoIntero({ soloRipiego: true })`, `didPienoEntra(id,
  { soloRipiego: true })`, e la 3D che col cielo immersivo ripiega da sé). Per
  questo `skyEsciSchermoIntero` e `didPienoEsci` chiudono il pieno schermo
  nativo **solo se è il loro**. Esc nel pieno schermo vero lo consuma il
  browser: l'uscita dal pieno schermo della demo ferma la demo e ripristina.
- **Vista pulita durante la demo.** È attiva di serie. Non chiude né modifica
  pannelli, controlli o avvisi già presenti: marca temporaneamente il
  contenitore della scena e il CSS nasconde il chrome, lasciando visibili
  canvas/video, sottotitoli e il pannello essenziale
  Pausa/Riprendi/Ricomincia/Termina. Togliere le classi a fine demo ripristina
  quindi lo stato esatto anche dopo Stop, Esc o errore.
- **Registra un filmato della demo.** È la registrazione del planetario (§7.6
  di `app.js`) con una sorgente sostituibile, `sky.reg.sorgente`: la demo le
  passa la tela della scena in corso (cielo, volo, 3D o banco delle aurore) e
  guida l'acquisizione con un suo `requestAnimationFrame`. La durata la tiene
  la demo (la pausa non tronca il filmato); a fine racconto il filmato compare
  nel pannello del planetario, che per questo resta aperto.
- **Registra anche l'audio.** È attiva di serie e vale solo insieme al filmato.
  Il MediaRecorder esistente riceve una sola traccia dalla voce condivisa di
  `narrazione.js`: entrano gli MP3 registrati e l'Edge-TTS, perché passano
  entrambi dall'elemento audio condiviso. La `speechSynthesis` locale non
  espone il proprio segnale alle Web API: resta udibile alla persona ma non è
  registrabile in modo portabile. Stop, Esc, errore e fine scollegano la
  destinazione e fermano le tracce MediaStream.
- **Elementi del planetario da mostrare.** L'elenco non è inventato: sono gli
  interruttori della scheda Visualizzazione (stelle, nomi, costellazioni e
  loro disegni, pianeti, Sole e Luna, cielo profondo, Via Lattea, corpi minori,
  satelliti, aerei, reticolo, eclittica, traccia, eventi, sotto l'orizzonte,
  atmosfera, nuvole, aurora, terreno, rilievo, luci dei paesi, nomi dei monti,
  laghi e fiumi), col nome letto dal tasto stesso. Spenta la casella
  «Scegli per la demo» restano quelli attuali.

Con **Vista pulita** attiva `AstroDemo.silenzioso` è vero: `skyAvviso`
scarta gli avvisi di servizio (tranne il canale `demo`, che dice se il tour
si è rotto) e `body.demo-vista-pulita` nasconde avviso di transito, barra del
terreno, caricamento e chrome. Spegnendo l'opzione, invece, quei controlli
restano disponibili. Fine, Stop, Esc ed errore ripristinano tutto: livelli,
stato dell'interfaccia, schermo intero, registratore, stream audio, banco
didattico e camera 3D (anche mondi minori e sonde).

## La narrazione

Ogni scena dei tour predefiniti ha una frase detta a voce e scritta nel
pannello della demo: `action: narrate { id: 'demo.narr.<demo>.<scena>' };`,
con il testo nei due dizionari. La voce è quella di tutta l'app
(`narrazione.js`, vedi `NARRAZIONE.md`): audio registrato se c'è
(`audio/narrazione/demo/<lingua>/`), poi la sintesi, poi il solo testo. Segue
avvio, pausa (anche quella della scheda nascosta), ripresa, cambio scena,
Ricomincia, Termina demo, Esc, errore e fine senza mai accavallarsi: la voce
vive quanto la scena, e pausa e ripresa gliele passa il motore
(`contesto.pausa`/`riprendi`). Cambiando lingua a metà scena la frase si
ridice nella lingua nuova. Le frasi stanno nella durata della loro scena
(`node scripts/controlla-narrazione.js` lo controlla). Voce, volume, testo e
«solo sintesi» si scelgono in Impostazioni → Osservazione → Narrazione.

## I cinque tour predefiniti

| Tour | Scene · durata | Cosa mostra |
| --- | --- | --- |
| **Eclisse solare totale 2026** (`eclisse_tour`) | 7 · 114 s | Reykjavík: il campo si stringe da 40° a 1,6° sul Sole e la Luna lo attraversa (16:40→17:48, poi la totalità); volo; banco Terra–Luna con Sole, Luna e Terra in fila e la camera che gira; avvicinamento alla Terra (×5,5) con l'ombra che corre da −20 a +45 min dal massimo; di nuovo in cielo fino alle 18:52, a eclisse finita. |
| **Eclisse lunare totale 2028** (`eclisse_lunare`) | 6 · 57 s | Sapporo: la Luna entra nell'ombra e si arrossa (−110→+5 min); volo; da fuori il cono d'ombra e la Luna che lo attraversa (−170→+130 min) con la camera che le gira attorno; in cielo la Luna ne esce (+5→+170). |
| **Aurora boreale** (`aurora_boreale`) | 7 · 53 s | Il banco delle aurore della Didattica a schermo intero: vento e nube, la camera attorno alla Terra, lo scudo da vicino, la scarica, l'anello; poi il cielo di **Helsinki** verso nord con Kp 5 simulato. |
| **Corteo dei pianeti** (`allineamento_pianeti`) | 5 · 45 s | Tucson prima dell'alba: i quattro pianeti inquadrati; volo; da fuori la camera scende dall'alto (80°) al piano (12°) tenendo nel quadro Mercurio, Venere, Terra, Marte e Giove; di nuovo in cielo verso l'alba. |
| **Passaggio della ISS** (`passaggio_iss`) | 3 · 36 s | Il prossimo passaggio calcolato dall'app (`calcolaPassaggiSatellite`) sopra il luogo del planetario: tutto l'arco inquadrato con la traccia, poi la stessa orbita da fuori nello **stesso** intervallo di tempo. |

Le posizioni sono sempre quelle di Astronomy Engine e SGP4: le scene si
legano all'**evento vero** (`event_window`, `satellite_pass`), cercato una
volta per racconto, e la regia muove solo camera, zoom e tempo.

### Perché Helsinki e non Tromsø

Con Kp 5 alla mezzanotte magnetica Tromsø sta *sotto* l'ovale: l'aurora le
passa sopra la testa e a sud, e guardando a nord non si vede niente (era il
difetto della versione precedente, e la prova contava punti «nel quadro»
senza guardare i pixel). Da sessanta gradi l'ovale è davvero a nord. La prova
adesso misura il verde del cielo con l'aurora accesa e spenta.

## Libreria ed editor avanzato

Le demo utente sono persistite in `astrocal_demo_utente_v1` di localStorage.
L'editor mantiene:

- validazione live con riga e colonna;
- blocco del salvataggio per DSL o orari civili non validi;
- snippet di scene e azioni;
- duplicazione;
- importazione `.astrodemo`/`.txt` fino a 100 KB;
- esportazione del testo DSL;
- protezione delle demo built-in;
- conferma prima di scartare modifiche non salvate.

L'importazione valida il file prima di aprire la bozza e non sovrascrive
silenziosamente demo esistenti.

## Sintassi

Il DSL è un linguaggio di dati, non JavaScript eseguibile. Non usa `eval`.
Supporta commenti `//`, stringhe fra apici o doppi apici, identificatori,
numeri, orari HH:MM e durate in s/ms. Le azioni della stessa scena sono
simultanee; i punti e virgola sono obbligatori.

Azioni principali:

- `timelapse { start: 18:00, end: 22:00 }`
- `highlight_object { name: 'Venus', scale: 5 }`
- `center_target { target: 'Moon' }`
- `point_view { az: 0, alt: 25 }`
- `set_fov { degrees: 20 }` e `zoom_fov { from: 40, to: 2 }`
- `frame_objects { names: 'Mercury,Venus,Mars,Jupiter' }`
- `set_date { iso: '2028-12-31T15:45:00Z' }`
- `set_location { lat: 43.0618, lon: 141.3545, name: 'Sapporo', timezone: 'Asia/Tokyo' }`
- `simulate_aurora { kp: 5 }`
- `zoom_view { type: geometric, final_target: solar_system_3d }`
- `orbit_object { object: 'Earth-Moon', angle: 220, speed: slow }`
- `event_window { event: lunar_eclipse, from: -120, to: 120 }` (minuti dal massimo; anche `solar_eclipse`)
- `camera_3d { scene: earth_moon, focus: 'Earth', orbit: 70, elev_from: 16, elev_to: 38, zoom_from: 1.2, zoom_to: 5.5 }`
  (`scene: system` con `focus: 'Sun'` e `frame`, oppure `focus: 'Earth'`/`'ISS'`)
- `aurora_lesson { chapter: anello, from: 48, to: 56, orbit: 150 }` (solo in `didactic_view`)
- `satellite_pass { satellite: iss, before: 1, after: 1 }`
- `narrate { id: 'demo.narr.eclisse_tour.1' }` oppure, in una demo personale,
  `narrate { text: 'Qui la Luna tocca il Sole.' }` (al massimo 400 caratteri;
  un `id` senza testo deve esistere nel dizionario)

Le scene sono `planetarium_view`, `transition`, `solar_system_3d` e
`didactic_view`. `AstroDemo.vaiAScena(i, frazione)` salta a una scena (lo usano
le prove per non aspettare un minuto a tour).

`set_fov` accetta un campo fra 0,5° e 160°. `frame_objects` calcola il
minimo arco azimutale contenente da 2 a 8 corpi supportati e sceglie
automaticamente centro e campo, aggiornandoli durante il timelapse. Entrambe
cedono la camera appena la persona interviene. Il FOV faceva già parte dello
snapshot di ripristino di AstroDemo, quindi viene annullato correttamente a
fine tour o su Escape/Stop.

`center_target { target: 'Eclipse Shadow' }` e `orbit_object` cercano
l'eclisse di Sole **più vicina all'orologio della demo** (prima o dopo), non più
sempre quella del 12 agosto 2026: una demo personale con `set_date` nel 2027
arriva all'eclisse del 2 agosto 2027.

`center` resta alias di `center_target`.
`transition_to` cambia direttamente fra `planetarium_view` e
`solar_system_3d`. Gli orari civili sono validati nel luogo e nella data
raggiunti dallo script.

## Messaggi di validazione

Tutti i messaggi (motore, libreria, adattatore) stanno nei dizionari sotto
`demo.err.*`: in inglese l'editor risponde in inglese. Il motore e la libreria
restano puri — chiedono a `astroI18n` se c'è, e nelle prove Node ripiegano
sulla frase italiana. Riga e colonna indicano il gettone sbagliato: prima quasi
tutti gli errori di struttura cadevano sulla fine del testo.

## Movimento ridotto

Con `prefers-reduced-motion: reduce` il racconto conserva fenomeno, data,
luogo e tempo astronomico, ma le camere (`camera_3d`, `aurora_lesson`,
`zoom_fov`) non viaggiano: stanno già nella posa finale.

## Architettura

`demo-motore.js` resta puro, indipendente dal DOM e senza conoscenze
astronomiche. `demo.js` è l'adattatore verso il planetario e registra le
azioni. `demo-predefiniti.js` contiene soltanto i testi dei tour.
`demo-libreria.js` gestisce storage e protezioni; `demo-impostazioni.js`
gestisce la libreria semplice e l'editor avanzato.

## Correzioni della v368

- La rotellina e i tasti non passavano da `pointerdown`: `set_fov` e
  `frame_objects` riscrivevano il campo a ogni fotogramma e lo zoom della
  persona veniva annullato.
- Il ripristino riscriveva il FOV ma non l'altezza a cui valeva
  (`sky.altezzaMisurata`): uscendo dallo schermo intero il campo veniva
  riscalato e la demo non tornava al FOV iniziale (80° → 93°).
- `frame_objects` forzava il giro completo degli astri a ogni fotogramma, e
  con pianeti spenti dai filtri non inquadrava niente: adesso accende i filtri
  (ripristinati a fine demo) e forza il calcolo una volta sola.
- La barra della demo mostrava una frase valida solo per il tour dell'eclisse
  (e i nomi tecnici delle scene per gli altri): ora è titolo · scena · durata.
- «Duplica e modifica» dà alla copia un nome suo (`…_copia`), e «Salva» non
  richiude più l'editor.

## Correzioni della v369

- `--accento` era usato e mai dichiarato: la linguetta attiva delle
  Impostazioni e il tasto «Avvia demo» erano senza colore.
- L'icona delle Impostazioni è la rotellina classica.
- L'ombra dell'eclisse lunare ingrandita su un telefono: le fermate del
  gradiente si ricampionano sulla fetta di disco in vista
  (`skyOmbraGradiente`), lineare quando i cerchi dell'ombra sono rette a meno
  di un terzo di pixel. Prima la fetta cadeva fra due fermate su quarantanove
  e il centro del gradiente stava a decine di migliaia di pixel, che le GPU
  dei telefoni perdono.

## Correzioni della v370

- Le demo hanno una voce: la narrazione centrale (`narrazione.js`), condivisa
  con Missione Cielo, con una frase per ogni scena dei cinque tour.
- Il motore passa pausa e ripresa al contesto (`segnala`), così chi
  accompagna il racconto senza essere un fotogramma si ferma con lui.

## Verifica

Eseguire:

```bash
node scripts/prova-demo.js
node scripts/prova-narrazione.js
node scripts/controlla-narrazione.js
node scripts/prova-narrazione-browser.js
node scripts/prova-demo-browser.js
node scripts/prova-demo-regia.js
node scripts/prova-i18n.js
```

La prova browser avvia le demo dall'interfaccia, controlla astronomia,
inquadratura e ripristino e salva schermate in `work/demo-*.png`. `prova-demo-regia.js`
guarda ciò che la regia fa vedere — la Luna che scivola sul Sole e se ne va,
l'ombra che si sposta sulla Terra, la Luna dentro e fuori dal cono, il verde
dell'aurora a nord, i cinque pianeti nel quadro mentre la camera scende, la
ISS nello stesso intervallo nelle due viste — più opzioni, avvisi zitti,
schermo intero, registrazione, movimento ridotto e l'ombra ingrandita; le
schermate vanno in `work/regia-*.png`.
Il workflow **Verifica Demo** esegue le prove principali in pull request.
