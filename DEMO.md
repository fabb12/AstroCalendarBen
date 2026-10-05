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
racconto. `schermoIntero`, `vistaPulita` e `registraAudio` valgono `true` anche
quando si leggono preferenze salvate prima che queste chiavi esistessero. Per
una prima visione pulita, la narrazione parte a voce ma col testo a schermo
spento (si può riaccendere nel gruppo **Narrazione e audio**):

- **Avvia a schermo intero.** È attivo di serie. Il pieno schermo vero si chiede *una volta*,
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
puntatore sopra, si ritira dopo **`durataComandiSec`** secondi (cinque di
serie, da due a trenta: il cursore «Comandi a schermo dopo un tocco» del
gruppo Presentazione della pagina Demo, salvato in `astrocal_demo_opzioni_v1`),
e in pausa resta in vista.

Sopra ai tondi c'è la **cronologia** (v399): una pista divisa in scene, ognuna
larga quanto dura, che si riempie col racconto, con «Scena n di N» e il tempo
fatto sul totale. Toccandola si salta in quel punto (`motore.vaiAScena` con la
frazione di scena; in pausa si riparte); da tastiera le frecce passano alla
scena prima o dopo. Si ridisegna solo mentre i comandi sono a schermo, e coi
comandi visibili la fascia dei sottotitoli sale sopra al pannello. Il
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

## Gli otto tour predefiniti, e le Storie cosmiche

| Tour | Scene · durata | Cosa mostra |
| --- | --- | --- |
| **Eclisse solare totale 2026** (`eclisse_tour`) | 11 · 180 s | Reykjavík, dentro la fascia di totalità: l'attesa (il campo si stringe da 60° a 1,6° sul Sole); la **mappa del cono d'ombra** a tutto schermo, centrata sull'Islanda, con la penombra che si posa sul pianeta e arriva fino a Reykjavík (−134→−58,5 min dal massimo); il primo contatto e un'ora di falce (fino a +1,8); i grani di Baily e l'anello di diamanti, stringendo a 0,9°; la totalità, col campo che si riapre a 70° su Venere, Giove, Mercurio e Marte; di nuovo la mappa, stavolta **addosso all'ombra piena** che corre dall'Islanda alla costa nord della Spagna (+3,5→+42); volo; Sole, Luna e Terra in fila; la Terra da vicino con l'ombra che scivola oltre il bordo al tramonto (+44→+50); il ritorno a Reykjavík fino all'ultimo contatto (+62) e un congedo a campo largo che dà appuntamento al 2 agosto 2027. |
| **Eclisse lunare totale 2028** (`eclisse_lunare`) | 10 · 178 s | Sapporo nella notte di Capodanno: l'attesa (il campo si stringe da 55° a 8°), il primo morso (−125→−40 min), l'ultimo spicchio che si spegne e la Luna color rame (fino a +5), poi **dentro la totalità il campo si riapre a 40°** e tornano le stelle; volo; da fuori il cono d'ombra, la Luna che lo attraversa (−110→+130) e la Terra davanti al Sole attorno al massimo (la Terra vista dalla Luna, l'anello dei tramonti); di nuovo in cielo l'uscita dall'ombra (+30→+170) e un congedo a campo largo che dà appuntamento alla totale del 26 giugno 2029. |
| **Aurora boreale** (`aurora_boreale`) | 11 · 173 s | Il Sole vero, ingrandito dal planetario; poi il banco delle aurore a schermo intero: il vento di tutti i giorni, la nube che attraversa lo spazio, la magnetosfera prima e durante l'urto, la coda che si spezza, l'anello attorno al polo, il **taglio** coi colori alle loro quote (da Reykjavík, Kp 5); infine il cielo di **Helsinki** verso nord con Kp 5 simulato, e un congedo col campo che si allarga. |
| **Corteo dei pianeti** (`allineamento_pianeti`) | 10 · 173 s | Tucson al buio guardando a est (05:30); la fila inquadrata pianeta per pianeta; tre **primi piani a campo da telescopio** (0,25°): Giove con le bande, Venere gibbosa e Saturno con gli anelli, basso a ovest — cinque pianeti nello stesso cielo; di nuovo la fila e l'eclittica; volo; da fuori la camera scende dall'alto (80°) al piano (12°) e poi di taglio (3°) tenendo nel quadro Mercurio, Venere, Terra, Marte e Giove; in cielo l'alba che li spegne (fino alle 06:30). |
| **Solstizi ed equinozi** (`solstizi_equinozi`) | 16 · 292 s | Perché esistono le stagioni, detto con la geometria. Roma a mezzogiorno del 21 giugno 2027 e la domanda (non è la distanza); volo; la Terra da vicino con l'**asse in evidenza** (`earth_axis`) e la camera che finisce di fianco, dove i 23,4° sulla perpendicolare all'orbita si leggono interi; un anno intero con la camera ferma (`date_range`): l'asse non cambia direzione e il cartello dice la distanza, minima a gennaio; il solstizio di giugno col Sole a sinistra (`sun_az: 0`), il polo nord verso di lui e il parallelo di Roma quasi tutto al giorno; sei mesi di orbita; il solstizio di dicembre con la **stessa** camera e il polo dall'altra parte; i due equinozi (marzo e settembre 2028), con la camera che gira fino a mostrare l'asse che pende di lato; di nuovo a Roma, il Sole seguito in azimut dall'alba al tramonto (`track_azimuth`) a giugno, dicembre e marzo, con gli archi interi dei giorni già visti (`sun_paths`) e i tre a confronto; il sole di mezzanotte a Tromsø; il riepilogo in 3D. Ogni scena apre il **cartello della data** (`date_card`), con alba, tramonto, durata del giorno e Sole a mezzogiorno nelle scene del planetario. |
| **Voyager · il viaggio verso le stelle** (`voyager`) | 15 · 335 s | Il viaggio delle due Voyager raccontato alla maniera di Carl Sagan. Cape Canaveral prima dell'alba del 20 agosto 1977 (Venere, Marte e Giove a est); volo; il progetto del Grand Tour con le strade future tratteggiate; il lancio da vicino a **dimensioni vere** (la Terra grande, la sonda un segno che se ne stacca, poi la camera la raggiunge e compare il **modellino** con l'antenna rivolta verso casa); diciotto mesi di salita verso Giove; i flyby di **Giove** (5 marzo 1979) e **Saturno** (12 novembre 1980) a **distanze e dimensioni vere**, con la camera che tiene insieme sonda e pianeta e il tempo che rallenta al perielio; i dodici anni di Voyager 2 fino a Nettuno, con la camera che la segue e si stringe sui sorvoli di **Saturno** (1981) e **Urano** (1986); il flyby di **Nettuno** (25 agosto 1989); la forma a V della fuga fino all'eliopausa del 2012; il **pallido puntino blu** (14 febbraio 1990) con la Terra cerchiata; il **Disco d'Oro**, con la camera che arriva sul fianco della sonda e la **fotografia vera** della copertina accanto (`golden_record`); il viaggio intero oggi; e il cielo di Roma del 15 ottobre 2026 coi **mirini** che dicono dove sono le due sonde (`probe_markers`). |
| **Dalla Terra all'universo** (`universo`) | 17 · 386 s | Quanto è grande l'universo, a passi. Il cielo di stasera sopra casa (il luogo dell'app, guardando in su); il volo oltre l'aria fino addosso alla Terra; poi la **scala cosmica** (`cosmic_scale`) in tredici scene di fila che sono un volo solo, alla misura vera: la Terra da vicino; la camera che si allontana finché entra la Luna; il Sole coi pianeti di roccia; i giganti fino a Nettuno; Kuiper e l'eliopausa con le Voyager di oggi, la nube di Oort, le stelle vicine, la Bolla Locale e il braccio di Orione (con le soste), la Via Lattea che si inclina, Andromeda e il Gruppo Locale, la Vergine e Laniakea (con le soste), l'universo osservabile; il ritorno in venti secondi fino alla Terra; l'atterraggio (`zoom_view` verso `planetarium_view`); e il congedo sotto il cielo di casa. Ogni scena apre il cartello con la misura e il tempo della luce. |
| **Passaggio della ISS** (`passaggio_iss`) | 6 · 104 s | Il prossimo passaggio calcolato dall'app (`calcolaPassaggiSatellite`) sopra il luogo del planetario, a capitoli: tutto l'arco inquadrato con la traccia; il culmine **inseguito a 0,25° di campo**, col modellino della stazione e le stelle che scorrono dietro; volo; la stessa orbita da fuori nello **stesso** intervallo di tempo; più di mezz'ora di orbita a campo largo (±15 min); il congedo, l'ultimo tratto dell'arco in cielo. |
| **Storie cosmiche · La Luna ha perso un pezzo?** (`storia_luna`) | 8 · 85 s | L'episodio pilota delle **Storie cosmiche** (`STORIE.md`): la Luna a falce del 13 dicembre 2026 da Roma, con un volto e una voce, crede di aver perso un pezzo; la Terra la porta a guardarsi da fuori (banco Terra e Luna), il Sole spiega che illumina sempre metà di lei, undici giorni d'orbita vera fino alla Luna piena, e il ritorno sotto il cielo di quella sera. |
| **Storie cosmiche · Giove e Saturno** (`storia_giganti`) | 4 · 47 s | La storia d'esempio che usa tutte le azioni dei personaggi (`character_*`), da duplicare e modificare. |

Le posizioni sono sempre quelle di Astronomy Engine e SGP4: le scene si
legano all'**evento vero** (`event_window`, `satellite_pass`), cercato una
volta per racconto, e la regia muove solo camera, zoom e tempo.

### Dalla Terra all'universo (v402)

La domanda è una sola — quanto è grande — e la risposta non si può dare con
un numero: quindici ordini di grandezza non si immaginano. Si danno quindi
**tre metri insieme**, e la demo li tiene in tutte le scene. La carta che si
allarga a passi di logaritmo (ogni pochi secondi tutto dieci volte più
lontano: è il ritmo a far sentire quante sono le decade); il **cartello**, che
dice la misura e quanto impiega la luce ad attraversarla (1,3 secondi, 8
minuti, 4 ore, 17 ore, 4,4 anni, 100.000 anni, 93 miliardi); e la voce, che
traduce ogni scala in una cosa umana (la buccia della mela, il granello di
sabbia con Nettuno a trecentocinquanta metri, i settantamila anni dall'uscita
dall'Africa, Carlo Magno, i primi dinosauri, le prime pietre scheggiate).

Le scene cosmiche sono nove **di fila**, e devono essere un volo solo: la
chiusura di `cosmic_scale` non esce dalla carta ma lascia passare un giro del
browser (`setTimeout` 0), e se nel frattempo la scena dopo non l'ha ripresa
torna ai pianeti. La camera della carta riparte dall'azimut a cui la scena di
prima l'ha lasciata. La prova è `scripts/prova-demo-universo.js`: che ogni
scena cominci dalla misura a cui finiva la precedente, che la scala non torni
mai indietro durante l'andata, che la struttura accesa sia quella nominata, e
che terminando la 3D e la carta se ne vadano. Schermate in `work/universo-*.png`.

Nelle scene addosso alla Terra (`camera_3d` con `focus: 'Earth'`) i mondi
minori si spengono, come già attorno al Sole: i nomi di Vesta e di due comete
accanto al pianeta erano rumore. Tornano a fine demo con la fotografia.

**Dalla v404 il viaggio è una carta sola.** La scala cosmica comincia dalla
Terra (quattro tappe in più: `earth`, `earth_moon`, `inner_planets`,
`planets`), e le quattro scene che prima erano `camera_3d` — la Terra, la
Luna, il Sole coi pianeti di roccia, i giganti — sono adesso `cosmic_scale`:
fra il decollo e l'atterraggio non c'è più nessun cambio di disegno, e il
passaggio dalla 3D compressa alla carta alla misura vera non si vede più a
metà racconto. Ci sono due raccordi. All'andata la prima scena cosmica parte
da `from: arrival`, cioè dalla scala a cui la Terra della carta è grande quanto
quella che il volo del decollo ha lasciato nella vista 3D, e ne prende la
camera (giro e inclinazione): è la stessa Terra, disegnata dalla stessa
funzione (`solDisegnaTerraVera`). Al ritorno l'ultima scena cosmica finisce a
`to: landing` — la Terra al 42% del lato corto, la misura del primo fotogramma
dell'atterraggio — e una scena `transition` con
`zoom_view { final_target: planetarium_view }` fa il volo del decollo
all'indietro (`solAtterraNelPlanetario({ manuale: true })` +
`solAtterraPasso(u)`), fino alla fotografia del cielo di casa. Il congedo
riprende quel cielo nella stessa posa (22:10, campo 125°, sud a 55°): è la
fotografia su cui il volo atterra, e un campo diverso sarebbe uno scatto.
L'orologio della carta, poi, non salta più a «oggi» entrando nella scala: è
quello del racconto, fermo per tutto il viaggio (`baseMs`), perché alla scala
della Terra un salto di ore si vede — il confine fra il giorno e la notte gira
con lei. Diciassette scene, 386 secondi.

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

### L'eclisse di Sole della v383: i continenti, l'ombra dall'inizio, la voce

Tre ritocchi alla stessa demo, ognuno per una cosa che si vedeva.

**I continenti sulla mappa.** Durante le due scene `eclipse_map` la carta
restava grigia: si vedevano l'ombra e i tracciati, e sotto niente. La regia
rifaceva la vista a ogni passo con `setView(…, { animate: false })`, e in
Leaflet 1.9.4 un `setView` che cambia lo zoom passa da `_resetView`, cioè da
`viewprereset`, che fa **buttare tutte le tessere** (`GridLayer._invalidateAll`)
e chiederle da capo. Con la rete vera — qualche centinaio di millisecondi per
tessera — nessuna faceva in tempo ad arrivare prima del passo dopo: misurato
con quattrocento millisecondi di ritardo, 293 richieste e zero tessere a
schermo. Adesso la regia sposta la carta come fa un pizzico
(`_eclRegiaSposta` in `app.js`: `_move` + `_moveEnd`), che le tessere già
arrivate le tiene. Le prove di prima non lo prendevano perché servivano le
tessere istantanee: `prova-demo-regia.js` adesso le serve **lente** e conta
quelle caricate mentre la scena corre (0/35 col codice di prima).

**L'ombra dallo spazio, tutta.** Le due scene della 3D riavvolgono il tempo
una volta sola: la prima (12 s, -62 → -46,2) mostra il cono che arriva, la
seconda (22 s, -46 → +47,3) sta addosso alla Terra — zoom ×9 → ×14, camera alta
sopra il polo — e segue l'ombra piena dal primo tocco all'alba in Siberia
all'ultimo al tramonto sulla Spagna. Sul globo la macchia della totalità vera
è larga quattro pixel, quindi `solDisegnaOmbraDellaLuna` le mette un segno di
misura minima con un alone ambra, e sotto disegna la **strada della
totalità** (`solStradaTotalita`/`solDisegnaStradaTotalita`: piena dove è già
passata, tratteggiata dove deve arrivare), campionata in coordinate
geografiche perché la Terra gira sotto l'ombra. Il totale resta 180 s.

**La voce.** Le undici frasi raccontano quello che si sente, non solo quello
che si vede: la luce che diventa metallica, il vento dell'eclissi, il freddo,
gli uccelli che tacciono, le bande d'ombra, il grido e il silenzio della
totalità, l'alba accelerata del ritorno. Nessun audio registrato: parla la
sintesi.

### La demo delle stagioni della v382

È la sola demo che non racconta un evento raro ma una cosa che capita ogni
anno, e il suo difetto tipico sarebbe stato invisibile: un asse inclinato
dalla parte sbagliata al solstizio di giugno è un disegno perfettamente
convincente, solo che racconta l'inverno. Per questo gli istanti non sono
scritti a mano ma trovati da `event_window` con `Astronomy.Seasons`
(`june_solstice`, `december_solstice`, `march_equinox`, `september_equinox`:
l'istante vero più vicino all'orologio del racconto, e ogni scena che ne usa
uno si porta avanti la sua `set_date` perché la ricerca parta dall'anno
giusto), e la prova `scripts/prova-demo-stagioni.js` guarda la geometria
invece dei pixel: asse·Sole ≈ +sen 23,4° a giugno, −sen 23,4° a dicembre,
≈ 0 agli equinozi; la direzione dell'asse identica lungo un anno; la
distanza minore a gennaio che a luglio; a Roma 15 h 14 min di giorno a
giugno, 9 h a dicembre, 12 h all'equinozio, con il Sole a 72°, 25° e 48°; a
Tromsø il Sole di giugno che non tramonta; e che Stop rimetta tutto com'era.

Cinque pezzi nuovi, tutti piccoli e tutti ripristinati dallo stesso
fotografo di sempre (`avvia` in `demo.js`):

- **`date_card`** — il cartello della data, `#demo-cartello`, sorella dei
  comandi e dei sottotitoli e appesa allo stesso genitore
  (`genitoreDemo()`), così vale anche a schermo intero. Sta **in alto a
  sinistra**: al centro copriva il Sole di mezzogiorno, che la camera tiene
  sopra al centro dello schermo; su un telefono in verticale si stringe a
  metà schermo meno un margine per lo stesso motivo. Righe riscritte solo
  quando il testo cambia; alba, tramonto e culmine si cercano una volta per
  giorno civile e per luogo (`fattiDelSole`), col sole di mezzanotte e la
  notte polare dichiarati. Con la vista pulita resta visibile (regola in
  `style.css`). La chiudono la fine della scena, Stop, Esc e l'errore.
- **`date_range`** — il calendario da una data UTC all'altra (fino a tre
  anni) per tutta la scena.
- **`earth_axis`** — `sol.evidenziaAsse`, disegnato da
  `solDisegnaAsseTerra` in `app.js` (§7.7): l'asse vero (`RotationAxis`,
  lo stesso con cui girano le coste) coi poli, la perpendicolare all'orbita
  con l'angolo **vero** scritto accanto, l'equatore, il parallelo del luogo
  giallo al giorno e blu alla notte (la frazione gialla è la durata del
  giorno), il punto subsolare e tre raggi dal Sole. Con l'asse acceso si
  tacciono le orbite delle stazioni e le frecce sera/mattina, che accanto
  all'asse si leggerebbero come altre direzioni. Fa parte della fotografia
  della camera 3D.
- **`sun_paths`** — `sky.archiSole`, disegnato da `skyDisegnaArchiSole`
  (§7.3-bis): l'arco intero del Sole di uno o più giorni civili del luogo,
  alba e tramonto segnati sull'orizzonte, data e altezza al culmine; il
  colore viene dalla declinazione del Sole, non dall'ordine. Fa parte
  della fotografia del planetario (`chiavi`).
- **`track_azimuth`** — la camera segue un astro solo in azimut e tiene
  ferma l'altezza, così il suolo resta in basso e si vede quanto il Sole
  sale. Con 18° di sguardo e 125° di campo l'orizzonte resta sopra ai
  sottotitoli e il Sole di giugno (71,5°) dentro al riquadro.
- e un parametro: **`sun_az`** di `camera_3d` (solo `scene: system`,
  `focus: 'Earth'`) lega la camera al Sole invece che allo spazio e si
  rifà a ogni fotogramma — è quello che rende confrontabili i due solstizi.

Nessuna frase ha un MP3 registrato: parla la sintesi.

### La demo delle Voyager della v393

Il difetto tipico qui sarebbe stato invisibile: una scia colorata che parte
dalla Terra e si allontana è bella comunque, anche se passa a dieci unità
astronomiche da Giove il giorno in cui doveva sfiorarlo. Per questo le
traiettorie non sono disegnate: sono **coniche raccordate** calcolate in
`app.js` (§7.7-bis, blocco «Il Grand Tour»). Fra un incontro e l'altro un arco
di Keplero risolto col problema di Lambert (`solLambert`, variabile
universale) fra le posizioni vere dei pianeti nei giorni pubblicati degli
incontri; vicino a ogni pianeta l'iperbole del flyby (`solFlyby`), costruita
dai due asintoti che gli archi portano con sé; in fondo l'arco che sbocca
sulla retta di `SOL_SONDE` all'epoca in cui quella tabella vale. I perielii che
ne escono tornano coi pubblicati entro il 10% (Voyager 1 a Giove 338.000 km
contro 348.900, Voyager 2 a Nettuno 27.000 contro 29.200), e nel 2012 la
Voyager 1 risulta a 119 UA: è il controllo aritmetico di
`scripts/prova-demo-voyager.js`. Lo stesso modello vale anche fuori dalla demo:
guardando la vista 3D a una data prima del 2026 le sonde adesso stanno sul
loro viaggio vero invece che sulla retta tirata all'indietro.

Il **modellino** (`solModelloVoyager`, `solDisegnaModelloVoyager`) è fatto
di facce e aste in metri — antenna parabolica da 3,66 m, corpo decagonale, i
tre RTG con le alette, il braccio della scienza con la piattaforma delle
telecamere, il magnetometro da 13 m, le antenne a V da 10 m e il Disco d'Oro
sul fianco — dipinto col pittore e illuminato dal Sole più una luce di
riempimento. Non è in scala (una sonda di quattro metri è invisibile) ma è
**orientato come la sonda vera**: l'antenna punta sempre la Terra
(`solTernaVoyager`).

Tre azioni nuove, tutte ripristinate dalla fotografia di `avvia`:

- **`voyager_journey`** (solo `solar_system_3d`): il tempo da `from` a `to`
  (fino a ottant'anni, `ease: smooth` per partire e arrivare fermi), le scie
  (`future: show` per le strade che restano), gli anni degli incontri
  (`milestones`), la Terra cerchiata (`home: show`), la misura del modellino
  (`model_from`/`model_to`, frazione del lato corto) e il metro
  (`scale: real` = distanze e dimensioni vere, per i flyby). Va **prima** di
  `camera_3d`. Le date accettano anche `now`, `now+365d`, `now-280d` (v396):
  le scene «oggi» partono dal giorno in cui si guarda la demo.
- **`camera_3d`** accetta i fuochi `'Voyager 1'`, `'Voyager 2'`, `'Jupiter'`,
  `'Saturn'`, `'Uranus'`, `'Neptune'` (perno sul corpo, zoom fino a 30000) e,
  con le sonde, **`probe_az`**: la camera si mette nella direzione
  cos(a)·y + sin(a)·z della terna della sonda (0 davanti al Disco d'Oro, 90
  davanti all'antenna) e `elev_from`/`elev_to` si sommano alla sua altezza.
- **`golden_record`** (solo `solar_system_3d`, con `voyager_journey { record: show }`,
  v397): la scheda con la fotografia vera della copertina del Disco d'Oro,
  appoggiata a destra della scena da `at` (frazione della scena), e un filo
  dorato che la lega al disco del modellino. Vedi «I sorvoli e il Disco d'Oro».
- **`probe_markers`** (planetario): i mirini delle due sonde nel cielo, con la
  distanza e le ore di luce (`skyDisegnaSondeInCielo`); sotto l'orizzonte non
  si disegnano.

### I sorvoli e il Disco d'Oro (v397)

La segnalazione era in tre righe: nei flyby la camera restava lontana e il
pianeta era una pallina (a Nettuno ventidue pixel di raggio: lo zoom era
tosato a 25.000, e a distanze vere ne servono più di centomila); il Disco
d'Oro era un cerchietto di trenta pixel su un fianco; e al lancio il
modellino era largo quanto mezza Terra. **Nessun testo è cambiato**: le
frasi hanno l'audio registrato, e si è rifatta solo la regia.

- **La camera dei sorvoli** — `camera_3d { focus: 'Voyager N', frame_with: … }`
  (`inquadraSorvolo` in `demo.js`). A ogni fotogramma il centro sta a metà
  fra la sonda e il bordo lontano del pianeta, e lo zoom fa stare quel
  segmento nel 32% del lato corto: avvicinandosi il pianeta cresce sotto gli
  occhi, a grandezza vera, e la curva della fionda gli gira attorno. Con
  `frame_with: 'auto'` il corpo è il più vicino, con un peso continuo fra i
  due candidati (al cambio non c'è salto): è la scena di Voyager 2 fra
  Saturno, Urano e Nettuno. `flyby_tilt` mette la camera quasi sulla normale
  al piano dell'iperbole, dalla parte del Sole (la faccia del giorno), e
  inclinata di tanti gradi verso di lui. `zoom_from`/`zoom_to` diventano
  moltiplicatori di questa inquadratura; `zoom_start` rimanda la spinta a una
  frazione della scena, e spingendo il centro scivola sulla sonda. Il tetto
  dello zoom nel racconto è `SOL_ZOOM_MAX_TOUR` (`sol.grandTour.zoomLibero`).
- **Il tempo dei sorvoli** — `voyager_journey { ease: flyby }`
  (`orologioDelViaggio`): attorno a ogni perielio il tempo scorre con densità
  (|Δt| + T)^−1,3, con T il tempo che la sonda impiega a percorrere un
  perielio. Lontano i giorni volano, vicino i minuti si allungano. `ease:
  log` è il lancio: il tempo cresce in progressione geometrica dall'istante
  iniziale. `trail: earth` disegna la scia vista dalla Terra (nel riferimento
  del Sole la sonda partirebbe da dove la Terra era un'ora fa).
- **Le proporzioni** (`solTettoModelloVoyager` in `app.js`). Il modellino
  non è in scala, ma accanto a un corpo con un disco vero non può sembrare
  più grande di lui: con un pianeta (o la Terra, o il Sole) nel quadro scende
  al 5% del suo raggio, e sotto i dieci pixel diventa un **segno** — un punto
  con un anello che pulsa (`solDisegnaSegnoSonda`). I pesi sono continui:
  quando la Terra esce dal quadro la sonda cresce piano, come se la camera le
  si avvicinasse. `proportion: free` lo spegne (il puntino blu, il Disco
  d'Oro: lì il corpo sullo sfondo è lontano). `gaze: show` tira il filo
  tratteggiato dalla sonda alla Terra, che è dove punta l'antenna.
- **Il Disco d'Oro** — `voyager_journey { record: show, model_end: 0.5 }` e
  `golden_record { at: 0.3 }`. Il modellino cresce (fino a 3,4 volte il lato
  corto) e il centro del quadro scivola dalla sonda al disco
  (`gt.discoCentro`, letto da `solAggiornaPivot`); il disco si dipinge per
  ultimo, in luce piena, con le incisioni vere della copertina ridotte
  all'osso (`solDisegnaFacciaDisco`: il disco con la puntina, la forma
  d'onda, la mappa delle pulsar, l'idrogeno) e un alone che pulsa
  (`solDisegnaEvidenzaDisco`). La fotografia viene da Wikimedia Commons
  (immagini NASA, pubblico dominio; `Special:FilePath`, così non serve
  l'impronta md5 del nome), poi dall'immagine di apertura della voce di
  Wikipedia; senza rete resta un'illustrazione delle stesse incisioni, e la
  didascalia lo dice.

Prove in `scripts/prova-demo-voyager.js`, §2-bis: al perielio di ognuno dei
cinque sorvoli mostrati il pianeta è grande nel quadro, la sonda ci sta dentro
ed è molto più piccola del disco; al lancio la sonda è piccola accanto alla
Terra; la scheda del disco compare col suo filo e se ne va con la demo.

**Stasera vuol dire stasera (v396).** Le ultime scene avevano la data scritta
a mano (15 ottobre 2026): guardando la demo un altro giorno, «stasera»
mostrava il cielo e il cartello di quel giorno lì. Adesso la scena del
planetario usa `set_date { tonight: '21:00' }` (le 21 di oggi, ora civile del
luogo del cielo), e `point_view { probe: 'voyager1' }` punta la camera sulla
sonda (`skySondaInCielo` in app.js), perché la sua direzione cambia di sera
in sera. Dalla frase è sparito «verso ovest», che vale solo in autunno.

Nessuna frase ha un MP3 registrato: parla la sintesi.

**Le citazioni (v394, sfoltite nella v395).** Il racconto porta dentro tre
frasi famose, brevi e sempre attribuite, e solo tre di proposito: il cuore del
*Pallido puntino blu* — «è qui, è casa, siamo noi» e il dovere di custodire
l'unica casa che abbiamo (11) —, il messaggio di Jimmy Carter inciso nel Disco
d'Oro (12) e i «vagabondi» di *Cosmos* nel congedo (15). Una citazione per
scena, in apertura e in mezzo, diventa un'antologia e toglie peso a quelle che
contano. La scena del puntino dura 34 secondi e il congedo 20: le citazioni
vogliono silenzio attorno, e `controlla-narrazione.js` misura le parole contro
la durata.

### Le riprese del lancio e del sorpasso (v399)

Due segnalazioni, e nessun testo né audio cambiato: **le durate delle scene
sono quelle di prima**, e dentro alle due scene toccate le riprese sono
tarate sulla frase registrata.

- **Le riprese dentro a una scena** — `shot_from`/`shot_to` su qualunque
  azione (`demo-motore.js`): l'azione vive solo in quella frazione della
  scena, riceve il progresso **della ripresa**, nasce quando la scena ci
  arriva (così una camera parte da dove la precedente l'ha lasciata) e si
  chiude con la scena. Il parser le toglie dai parametri: nessun comando le
  deve conoscere.
- **La camera** — `camera_3d` ha tre parametri nuovi: `keep` (un elenco di
  corpi e sonde da tenere nel quadro a ogni fotogramma, `inquadraGruppo`),
  `blend` (la frazione della ripresa in cui la camera scivola dalla posa
  della ripresa di prima: zoom geometrico, azimut per la via corta, e il
  centro che si muove in modo che il bersaglio non esca mai dal quadro) e
  `profile: show` (con `frame_with`: si guarda di traverso alla strada della
  sonda rispetto al corpo, dalla parte del Sole).
- **Il lancio** (scena 4, 24 s): Voyager 2 il 20 agosto, poi lo stacco al 5
  settembre per Voyager 1 (quando la voce lo dice), poi la camera si allarga
  sulle due sonde e infine si stringe sul modellino con l'antenna verso casa.
  `voyager_journey { launch: show }` disegna l'aria come un alone col suo
  nome e, quando la sonda passa i cento chilometri, un anello e la scritta
  «… fuori dall'atmosfera» (`solDisegnaUscitaAtmosfera`). `ease_rate` regola
  la progressione di `ease: log`; `model_start` tiene il modellino un segno
  fino a quella frazione del viaggio.
- **Il sorpasso** (scena 5, 20 s): la salita dall'alto, poi la camera che
  scende sulle due sonde e, con `race: show` (`solDisegnaGaraVoyager`), gli
  archi della distanza dal Sole e il cartello «Sorpasso!» il 15 dicembre 1977
  — il giorno lo trova `solSorpassoVoyager` sulle posizioni del viaggio, ed è
  quello dei libri; nella scena cade a 8,7 s, sulla parola «sorpassa». Poi la
  camera si riapre fino a Giove. Il sorpasso avviene davvero nella fascia
  degli asteroidi, come dice la voce, non vicino a Giove.

Prove nel §2-ter di `scripts/prova-demo-voyager.js` e nelle riprese di
`scripts/prova-demo.js`.

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

- `character_show { target: 'Moon', expression: 'worried', look: 'Earth', size: auto }`,
  `character_expression`, `character_look_at { object: … }`, `character_blink`,
  `character_speak { id: … }` (o `text: …`) e `character_hide`: i **personaggi**
  delle Storie cosmiche, validi nella scena in cui compaiono. Tutto in `STORIE.md`.

- `timelapse { start: 18:00, end: 22:00 }`
- `highlight_object { name: 'Venus', scale: 5 }`
- `center_target { target: 'Moon' }`
- `point_view { az: 0, alt: 25 }` oppure `point_view { probe: 'voyager1', alt: -3 }` (verso la sonda, `alt` in più)
- `set_fov { degrees: 20 }` e `zoom_fov { from: 40, to: 2 }`
- `frame_objects { names: 'Mercury,Venus,Mars,Jupiter' }`
- `set_date { iso: '2028-12-31T15:45:00Z' }` oppure `set_date { tonight: '21:00' }` (oggi, ora civile del luogo)
- `set_location { lat: 43.0618, lon: 141.3545, name: 'Sapporo', timezone: 'Asia/Tokyo' }`
- `simulate_aurora { kp: 5 }`
- `zoom_view { type: geometric, final_target: solar_system_3d }` (il decollo), o
  `final_target: planetarium_view` (l'atterraggio dalla Terra al cielo di casa, v404); in una scena `transition`
- `orbit_object { object: 'Earth-Moon', angle: 220, speed: slow }`
- `event_window { event: lunar_eclipse, from: -120, to: 120 }` (minuti dal massimo; anche `solar_eclipse`,
  e i quattro istanti delle stagioni `march_equinox`, `june_solstice`, `september_equinox`,
  `december_solstice`, cercati con `Astronomy.Seasons` vicino all'orologio del racconto)
- `date_range { from: '2027-06-21T12:00:00Z', to: '2028-06-20T12:00:00Z' }` (il calendario da una data
  UTC all'altra, fino a tre anni)
- `date_card { label: 'demo.cartello.solstizi_equinozi.estate', time: show, sun: show, distance: hide }`
  (il cartello della data; al posto di `label` si può scrivere `text: '…'`, al massimo 80 caratteri)
- `earth_axis { parallel: 41.9 }` (solo in `solar_system_3d`: l'asse della Terra e, facoltativo, il
  parallelo di un luogo)
- `sun_paths { dates: '2027-06-21,2027-12-22' }` (solo in `planetarium_view`: da uno a quattro archi
  diurni del Sole)
- `track_azimuth { target: 'Sun', alt: 18 }` (la camera segue l'astro in azimut a un'altezza fissa)
- `camera_3d { scene: earth_moon, focus: 'Earth', orbit: 70, elev_from: 16, elev_to: 38, zoom_from: 1.2, zoom_to: 5.5 }`
  (`scene: system` con `focus: 'Sun'` e `frame`, oppure `focus: 'Earth'`/`'ISS'`; con `focus: 'Earth'`
  anche `sun_az`, l'angolo della camera attorno alla Terra misurato dalla direzione del Sole: 0 = Sole
  a sinistra, 90 = dalla parte del giorno, −90 dalla parte della notte)
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
- `cosmic_scale { from: 'planets', to: 'oort', ease: stops, focus: 'oort', center: sun, orbit: 20, elev_from: 70, elev_to: 90 }`
  (solo in `solar_system_3d`: la scala cosmica da una misura all'altra — un numero di UA o un nome fra
  `earth`, `earth_moon`, `inner_planets`, `planets`, `kuiper`, `heliopause`, `voyager`, `oort`,
  `local_cloud`, `local_bubble`, `orion_arm`, `milky_way`, `local_group`, `virgo`, `laniakea`,
  `universe`, più i due raccordi `arrival` (la Terra alla misura e con la camera a cui l'ha lasciata
  la vista 3D) e `landing` (la Terra da cui parte l'atterraggio, v404) —; `stops` si ferma su ogni struttura
  che incontra, `zoom_start`/`zoom_end` dicono in che tratto della scena si muove, `orbit` e
  `elev_from`/`elev_to` (5…90, 90 = a picco) muovono la camera della carta. Tolta nella v401, tornata
  nella v402 senza il futuro delle sonde; un numero di UA va da un milionesimo a 1e17, v412). Le
  Storie cosmiche ci mettono i loro personaggi, al loro posto vero (`STORIE.md`, §Nella scala cosmica)
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
node scripts/prova-demo-voyager.js  # le Voyager: coniche raccordate, scene, modellino, ripristino
                                    # (VOYAGER_TUTTE=1 per tre schermate a scena; VOYAGER_L/VOYAGER_H per la finestra)
node scripts/prova-demo-stagioni.js # solstizi ed equinozi: asse, date, archi, durate del giorno, ripristino
                                    # (STAGIONI_TELEFONO=1 per rifarla su 360×640)
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
