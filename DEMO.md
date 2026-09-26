# Demo automatizzate

Apri la voce **Demo** del menu principale (`#btn-vista-demo`, vista `demo`,
`#vista-demo` in `index.html`). Prima era una linguetta delle Impostazioni, e
la Narrazione stava in Impostazioni → Osservazione: adesso tutto quello che
vale per le demo sta in quella pagina, in sei gruppi numerati — **Demo da
eseguire** (elenco, scheda, «Avvia demo», editor), **Presentazione** (schermo
intero, vista pulita), **Registrazione** (filmato e, subordinato, audio),
**Intro delle Demo** (logo e titolo prima della prima scena, qui sotto),
**Narrazione e audio** (la voce di `narrazione.js`, che vale anche per
Missione Cielo, e la musica delle eclissi) ed **Elementi del Planetario**. La
pagina è pensata
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

## L'intro comune

Prima della prima scena di **ogni** demo — predefinita, personale o importata —
c'è un'intro: sfondo nero, il logo al centro e un titolo sotto, per tre secondi
di serie. Non sta dentro ai tour: è una **fase del motore**
(`demo-motore.js`, `contesto.intro` → `Motore.inIntro`/`chiudiIntro`) che gira
sullo stesso orologio delle scene, quindi la pausa la ferma, Stop, Esc, un
errore o un salto (`vaiAScena`) la chiudono, Ricomincia la rifà. La prima scena
(e con lei la sua voce) si apre **solo quando l'intro è finita**, col suo
orologio a zero; il nero se ne va con una dissolvenza di 450 ms *dopo* che la
scena è già aperta sotto, così non si vede mai la pagina di prima. Il filmato
della demo comincia con la prima scena, non con l'intro. Se durante l'intro la
vista dell'app cambia sotto ai piedi, la persona se n'è andata e la demo si
ferma.

Disegno, preferenze e logo stanno in `demo-intro.js` (`window.AstroDemoIntro`):

- **Preferenze** in `astrocal_demo_intro_v1` (localStorage): `attiva`
  (di serie sì), `durataSec` (1–10 s a mezzi secondi, di serie 3), `titolo`
  (`null` = il titolo predefinito, che segue la lingua) e `mostraTitolo`.
  Come le altre opzioni delle demo **non** vanno nel backup: sono una scelta di
  presentazione di questo dispositivo.
- **Logo** in IndexedDB (`astrocal_demo_intro` → archivio `file` → chiave
  `logo`): si salva il **file così com'è**, senza ricompressione né
  ridimensionamento, quindi proporzioni, trasparenza e qualità restano quelle.
  Un file che non è un'immagine, supera 8 MB o non si decodifica viene
  rifiutato **prima** di toccare il logo in uso. Un logo salvato che all'avvio
  non si legge più torna da sé al logo predefinito delle demo (e si butta); se il nodo
  dell'immagine fallisce durante l'intro, ripiega sullo stesso predefinito.
  Senza IndexedDB il logo scelto vale fino alla chiusura dell'app, e la pagina
  lo dice.
- **Disegno**: un velo solo (`.demo-intro-schermo`, `z-index` 9990: sopra a
  tutto ma **sotto** ai comandi della demo, così Stop resta raggiungibile),
  appeso all'elemento a schermo intero se ce n'è uno e al body altrimenti — il
  pieno schermo della demo è quello del documento, quindi l'intro ci sta
  dentro e non ne esce. Nasce nero pieno nello stesso turno del clic, prima
  della richiesta di pieno schermo. Le misure sono in unità del contenitore
  (`cqw`, `cqh`): il riquadro 16:9 della pagina Demo è la stessa impaginazione
  in scala. Il logo non si deforma (`object-fit: contain`), il titolo va a capo
  equilibrato con un corpo scelto dalla lunghezza (`data-misura`: corto, medio,
  lungo) e non esce mai dallo schermo.
- **Movimento ridotto**: logo e titolo compaiono fermi, senza scala né
  scorrimento, e il nero se ne va senza dissolvenza; la durata resta quella.

Nel gruppo **Intro delle Demo** della pagina ci sono «Mostra intro», la durata,
la miniatura del logo con **Sostituisci logo** e **Ripristina logo
predefinito**, il campo **Titolo iniziale** con **Mostra titolo** e
**Ripristina titolo predefinito**, il riquadro dell'anteprima (si rifà a ogni
cambio) e **Guarda l'anteprima completa**, che recita l'intro a tutto schermo
senza avviare nessuna demo (si chiude da sola, con un clic o con Esc).

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
- **Registra anche l'audio.** È attiva di serie e vale solo insieme al filmato:
  senza filmato la casella è disabilitata e mostrata spenta, e la preferenza
  salvata torna quando il filmato si riaccende.
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
«solo sintesi» si scelgono nella pagina Demo, gruppo Narrazione e audio.

Il testo sta in una fascia di sottotitoli sua, `#demo-sottotitoli`, sorella
del pannello dei comandi e non dentro di lui: prima si ritirava insieme ai
comandi (sei secondi dopo il tocco) e sparivano a metà frase. La frase resta
finché la voce la dice e la sostituisce solo quella della scena dopo, nello
stesso nodo; la fascia è larga al massimo una sessantina di caratteri, in
basso sopra ai comandi, con un velo sfumato e l'ombra del testo invece di un
riquadro pieno.

## I comandi durante la demo

Il pannello `#demo-controlli` (Pausa/Riprendi, Ricomincia, Termina) esiste
solo mentre una demo è in corso: fuori è `hidden` e il CSS lo toglie dal
disegno (prima uno `display:flex` in linea batteva l'attributo e i tondi
restavano sulla pagina). Compare col tocco, col fuoco da tastiera o col
puntatore sopra, si ritira dopo sei secondi, e in pausa resta in vista. Il
tasto Pausa ha le due barre, diventa il triangolo di Riprendi con
`aria-pressed="true"`: prima l'icona sostituita perdeva la sua misura e non
si vedeva. Usare i comandi non ferma niente — solo Pausa ferma.

## La camera a mano

Trascinare (oltre sei pixel), pizzicare con due dita, la rotellina, il doppio
clic sulla scena, i tasti di zoom e direzione e i tasti della tastiera
prendono la camera per il resto della scena (`contesto.cediCamera()`, che
accende `c.cameraManuale`): le azioni della scena smettono di riscriverla,
mentre narrazione, orologio e animazioni continuano. Un tocco semplice invece
no: serve a mostrare i comandi. La scena successiva riprende la regia.

## Schermo intero fra le viste

Il pieno schermo nativo si chiede una volta sull'intero documento. Aprendo il
Sistema Solare (scene `transition` e `solar_system_3d`) `presentaSistema`
porta **subito**, nello stesso turno, la finestra dentro al riquadro del cielo
(`skySistemaModaliSchermoIntero`) e il guscio della 3D a schermo pieno col
ripiego CSS: prima questo lo faceva un MutationObserver un momento dopo, e il
browser poteva disegnare un fotogramma con la finestra fuori posto.

## La musica delle demo

Tutte le demo, sia quelle predefinite sia quelle personali create o importate
dall'utente, suonano al 30% la traccia scelta nel gruppo **Narrazione e audio**
della pagina Demo (`musicaDemoTraccia`, con `Encelado1` come valore iniziale
e fallback). Il toggle `musicaDemo` permette di spegnere del tutto la colonna
sonora. Le vecchie preferenze `musicaEclissi` e `musicaEclissiTraccia`
vengono migrate automaticamente.

`musicaDemoAvvia` in `app.js` mette in pausa il sottofondo della persona
(stesso elemento, traccia, volume e punto) e `musicaDemoFerma` lo rimette
com'era a fine demo, Stop, Esc o errore; se non suonava resta fermo. Il
selettore usa lo stesso catalogo `ASTRO_TRACCE_MUSICALI` della musica
dell'app, quindi una nuova traccia aggiunta al catalogo diventa disponibile
automaticamente anche per le demo.

## I cinque tour predefiniti

| Tour | Scene · durata | Cosa mostra |
| --- | --- | --- |
| **Eclisse solare totale 2026** (`eclisse_tour`) | 11 · 180 s | Reykjavík, dentro la fascia di totalità: l'attesa (il campo si stringe da 60° a 1,6° sul Sole); la **mappa del cono d'ombra** a tutto schermo, centrata sull'Islanda, con la penombra che si posa sul pianeta e arriva fino a Reykjavík (−134→−58,5 min dal massimo); il primo contatto e un'ora di falce (fino a +1,8); i grani di Baily e l'anello di diamanti, stringendo a 0,9°; la totalità, col campo che si riapre a 70° su Venere, Giove, Mercurio e Marte; di nuovo la mappa, stavolta **addosso all'ombra piena** che corre dall'Islanda alla costa nord della Spagna (+3,5→+42); volo; Sole, Luna e Terra in fila; la Terra da vicino con l'ombra che scivola oltre il bordo al tramonto (+44→+50); il ritorno a Reykjavík fino all'ultimo contatto (+62) e un congedo a campo largo che dà appuntamento al 2 agosto 2027. |
| **Eclisse lunare totale 2028** (`eclisse_lunare`) | 10 · 178 s | Sapporo nella notte di Capodanno: l'attesa (il campo si stringe da 55° a 8°), il primo morso (−125→−40 min), l'ultimo spicchio che si spegne e la Luna color rame (fino a +5), poi **dentro la totalità il campo si riapre a 40°** e tornano le stelle; volo; da fuori il cono d'ombra, la Luna che lo attraversa (−110→+130) e la Terra davanti al Sole attorno al massimo (la Terra vista dalla Luna, l'anello dei tramonti); di nuovo in cielo l'uscita dall'ombra (+30→+170) e un congedo a campo largo che dà appuntamento alla totale del 26 giugno 2029. |
| **Aurora boreale** (`aurora_boreale`) | 11 · 173 s | Il Sole vero, ingrandito dal planetario; poi il banco delle aurore a schermo intero: il vento di tutti i giorni, la nube che attraversa lo spazio, la magnetosfera prima e durante l'urto, la coda che si spezza, l'anello attorno al polo, il **taglio** coi colori alle loro quote (da Reykjavík, Kp 5); infine il cielo di **Helsinki** verso nord con Kp 5 simulato, e un congedo col campo che si allarga. |
| **Corteo dei pianeti** (`allineamento_pianeti`) | 10 · 173 s | Tucson al buio guardando a est (05:30); la fila inquadrata pianeta per pianeta; tre **primi piani a campo da telescopio** (0,25°): Giove con le bande, Venere gibbosa e Saturno con gli anelli, basso a ovest — cinque pianeti nello stesso cielo; di nuovo la fila e l'eclittica; volo; da fuori la camera scende dall'alto (80°) al piano (12°) e poi di taglio (3°) tenendo nel quadro Mercurio, Venere, Terra, Marte e Giove; in cielo l'alba che li spegne (fino alle 06:30). |
| **Passaggio della ISS** (`passaggio_iss`) | 6 · 104 s | Il prossimo passaggio calcolato dall'app (`calcolaPassaggiSatellite`) sopra il luogo del planetario, a capitoli: tutto l'arco inquadrato con la traccia; il culmine **inseguito a 0,25° di campo**, col modellino della stazione e le stelle che scorrono dietro; volo; la stessa orbita da fuori nello **stesso** intervallo di tempo; più di mezz'ora di orbita a campo largo (±15 min); il congedo, l'ultimo tratto dell'arco in cielo. |

Le posizioni sono sempre quelle di Astronomy Engine e SGP4: le scene si
legano all'**evento vero** (`event_window`, `satellite_pass`), cercato una
volta per racconto, e la regia muove solo camera, zoom e tempo.

### Le tre demo lunghe della v376

Eclisse di Luna, corteo dei pianeti e ISS hanno preso la stessa forma della
demo delle aurore: un racconto a capitoli, con la voce che dice quello che la
scena mostra in quel momento e un congedo che lascia un appuntamento. Le date
dei capitoli sono i contatti veri (Astronomy Engine per l'eclissi: parziale
±105 min, totalità ±36; per il corteo Mercurio e Giove passano i 5° alle
05:45 locali e il Sole sorge verso le 06:30). Nessuna delle tre ha MP3
registrati: la voce è la sintesi.

### L'eclisse di Sole della v377, e la mappa del cono d'ombra

La demo solare ha preso la forma delle altre tre, e in più **racconta la
stessa ombra da due parti**: da sotto nel planetario, dall'alto sulla mappa
del cono d'ombra (la finestra `modale-mappa` dell'eclissi, la stessa che si
apre dall'agenda). I contatti sono quelli veri visti da Reykjavík (primo
16:47:05, secondo 17:48:05, terzo 17:49:10, ultimo 18:47:28 UTC: 65 secondi di
totalità) e il racconto va sempre avanti nel tempo. Gli audio registrati della
versione di prima non tornano più col testo e sono usciti dal manifest: i file
restano in `audio/narrazione/demo/it/`, e finché non si registrano le undici
frasi nuove la voce è la sintesi.

La mappa è una **scena**, `eclipse_map`, con la sua azione, `shadow_map`
(sotto, «Sintassi»). A tenerla è `eclRegiaApri`/`eclRegiaPosa`/`eclRegiaChiudi`
in `app.js`, accanto al pieno schermo della mappa: la regia apre l'evento vero
(calcolando il mese se il calendario non ce l'ha), porta il guscio a tutto
schermo **col ripiego CSS** — il pieno schermo nativo, se c'è, è della demo, e
chiederlo per il guscio lo toglierebbe al documento — e a ogni passo dice
soltanto che minuto è e quanto da vicino guardare. Il resto lo fa la mappa di
sempre, e l'orologio resta uno solo: spostando la mappa si sposta il
planetario, e la scena dopo lo ritrova dove l'ombra l'ha lasciato. Tre cose
non sono dettagli. Col cielo a schermo intero il guscio si appende **dentro**
al riquadro del cielo (`_eclRipiegoSchermo`, come la 3D), se no il suo
`position: fixed` finirebbe sotto al planetario. Chiudendo la mappa si esce dal
pieno schermo nativo **solo se è del guscio** (`_eclEsciSchermoIntero`): prima
se ne usciva comunque, cioè chiudere la mappa a metà demo buttava fuori la demo.
E senza Leaflet (offline, o il CDN che non risponde) la scena non si ferma: la
stessa ombra si guarda dalla 3D, addosso alla Terra. Con la vista pulita della
mappa restano la carta, l'ombra e l'orologio in alto (`.ecl-regia` in
`style.css`); il lettore e i tasti se ne vanno. La **registrazione** delle
demo riprende una tela, e la mappa è Leaflet, cioè HTML: durante le scene di
mappa il filmato continua a riprendere il planetario che le sta dietro.

### Perché Helsinki e non Tromsø

Con Kp 5 alla mezzanotte magnetica Tromsø sta *sotto* l'ovale: l'aurora le
passa sopra la testa e a sud, e guardando a nord non si vede niente (era il
difetto della versione precedente, e la prova contava punti «nel quadro»
senza guardare i pixel). Da sessanta gradi l'ovale è davvero a nord. La prova
adesso misura il verde del cielo con l'aurora accesa e spenta.

### La demo delle aurore, come racconto

La versione lunga (v375) ha una struttura narrativa: il Sole come origine, il
vento solare, il viaggio della nube, lo scudo magnetico, la coda che si
spezza, l'anello attorno al polo, gli atomi che si accendono (il quadro
«taglio»), l'osservazione da terra e un congedo che lega la Terra al Sole. Ogni
frase dice quello che la scena mostra in quel momento. Le durate sono minime:
se la voce dura di più, il motore tiene la scena finché la frase non è finita
(`fineNarrazione`), senza tagliare né la voce né il testo. La data del Sole è
due giorni prima della notte dell'aurora, cioè il tempo di viaggio della nube.
Questa demo non ha MP3 registrati: la voce è la sintesi (Edge-TTS o quella
del dispositivo) finché qualcuno non li registra seguendo
`audio/narrazione/LEGGIMI.md`.

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
- `aurora_lesson { chapter: anello, from: 48, to: 56, orbit: 150 }` (solo in `didactic_view`;
  i capitoli sono `vento`, `scudo`, `scarica`, `anello` e `taglio` — il quinto è il
  disegno visto di lato, senza camera, con `place` fra i luoghi del banco,
  per esempio `reykjavik`, e `kp` fra 0 e 9)
- `satellite_pass { satellite: iss, before: 1, after: 1 }`; con `from`/`to` (frazioni fra 0 e 1
  della finestra, margini compresi) racconta un pezzo solo del passaggio, e con
  `track: 0.25` (gradi) nel planetario insegue la stazione a quel campo, chiedendo la
  direzione a SGP4 per l'istante di adesso
- `shadow_map { from: -134, to: -58.5, zoom_from: 2.4, zoom_to: 3, lat: 64, lon: -22 }` (solo in
  `eclipse_map`): i minuti dal massimo dell'eclisse di Sole, come `event_window`, ma a
  tenere il tempo è la mappa del cono d'ombra; con `zoom_from`/`zoom_to` (i livelli della
  carta, da 1 a 8) la mappa si tiene centrata sull'ombra, con `lat`/`lon` in più su quel
  punto; senza zoom resta sull'inquadratura d'insieme della fascia di totalità
- `narrate { id: 'demo.narr.eclisse_tour.1' }` oppure, in una demo personale,
  `narrate { text: 'Qui la Luna tocca il Sole.' }` (al massimo 400 caratteri;
  un `id` senza testo deve esistere nel dizionario)

Le scene sono `planetarium_view`, `transition`, `solar_system_3d`,
`didactic_view` ed `eclipse_map` (la mappa del cono d'ombra dell'eclisse di Sole
più vicina all'orologio del racconto). `AstroDemo.vaiAScena(i, frazione)` salta a una scena (lo usano
le prove per non aspettare un minuto a tour).

`set_fov` e `zoom_fov` accettano un campo fra 0,25° (il minimo del planetario, quello dei primi piani sui pianeti) e 160°. Con la vista pulita il mirino giallo non si disegna: la camera la tiene la regia, e nei primi piani starebbe proprio sopra al bersaglio. `frame_objects` calcola il
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
node scripts/prova-demo-pagina.js   # menu, pagina Demo, comandi, camera, schermo intero, musica
node scripts/prova-demo-intro.js    # intro comune (logo, titolo, durata, Stop/Esc/errore, telefono) e aurora lunga
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


## Link condivisibili

Nella pagina **Demo** il comando **Condividi link** crea un deep link che avvia
direttamente la demo quando il planetario è pronto.

- Le demo predefinite usano un frammento corto, per esempio
  `#demo=eclisse_tour`.
- Le demo personali includono nel frammento `#demo-script=...` il DSL già
  validato, codificato in Base64 URL-safe. In questo modo il destinatario non
  deve avere lo stesso `localStorage`; il frammento inoltre non viene inviato
  al server.
- All'apertura il contenuto viene validato di nuovo prima di essere eseguito.
  Se il browser non offre la condivisione nativa, il comando copia il link
  negli appunti e infine usa un prompt come ripiego.

Il deep link non cambia il formato `.astrodemo`: l'esportazione su file resta
utile per archiviare o modificare demo molto grandi.
