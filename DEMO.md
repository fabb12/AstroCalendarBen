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

## I quattro tour predefiniti

| Tour | Scene · durata | Cosa mostra |
| --- | --- | --- |
| **Eclisse solare totale 2026** (`eclisse_tour`) | 3 · 30 s | Reykjavík, 12 agosto 2026. Il planetario parte con un campo di 4° centrato sul Sole e attraversa i minuti della totalità; poi vola al banco Terra–Luna e centra l'impronta reale dell'ombra sulla Terra. |
| **Eclisse lunare totale** (`eclisse_lunare`) | 2 · 24 s | Sapporo, notte fra 31 dicembre 2028 e 1 gennaio 2029. La Luna è centrata con campo 4°/2,5° e il timelapse 00:45–03:00 JST comprende il massimo reale delle 01:52. |
| **Aurora boreale** (`aurora_boreale`) | 2 · 20 s | Tromsø, 15 gennaio 2027. Campo largo 90° verso nord, ovale aurorale acceso con **Kp 5 simulato**, poi timelapse 21:00–23:30. È una simulazione didattica, non una previsione. |
| **Corteo dei pianeti** (`allineamento_pianeti`) | 2 · 22 s | Tucson, alba del 21 ottobre 2028. La camera calcola automaticamente il minimo arco di cielo che contiene Mercurio, Venere, Marte e Giove, li evidenzia e li mantiene nel quadro durante il timelapse 05:45–06:10 MST. |

Le posizioni astronomiche sono sempre quelle calcolate dall'app/Astronomy
Engine. Data e luogo usati dal tour sono temporanei e non cambiano la posizione
principale dell'utente.

### Eclisse solare

La prima scena imposta Reykjavík e il 12 agosto 2026, stringe il campo a 4° e
centra il Sole mentre il tempo attraversa 17:47–17:50 UTC. La seconda scena usa
il volo geometrico già esistente verso il Sistema Solare. La terza scena cerca
il massimo reale con `Astronomy.SearchGlobalSolarEclipse`, entra nel banco
Terra–Luna, ruota lentamente la camera (se il movimento ridotto non è attivo) e
mantiene al centro `solOmbraLunareSuTerra(...).centro`.

### Eclisse lunare

Il tour usa una vera eclisse totale del 31 dicembre 2028. Il renderer del
planetario possiede già il disegno dell'ombra lunare; il tour non applica una
tinta rossa fissa o un effetto scollegato dall'astronomia. La modifica importante
è l'inquadratura: la Luna non resta un punto in un campo largo, ma viene centrata
e ingrandita fino a 2,5° durante il timelapse.

### Aurora

`simulate_aurora` usa il renderer reale di `aurora-polare.js`, ma il Kp è
dichiaratamente simulato. La demo sceglie una località boreale, punta la camera
verso nord e mantiene un campo largo affinché l'ovale sia leggibile.

### Corteo dei pianeti

I quattro pianeti non vengono riallineati dal tour. Data, luogo e campo largo
sono scelti perché siano realmente sopra l'orizzonte e leggibili nella stessa
zona del cielo; `highlight_object` aumenta soltanto l'evidenza grafica.

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
- `set_fov { degrees: 20 }`
- `frame_objects { names: 'Mercury,Venus,Mars,Jupiter' }`
- `set_date { iso: '2028-12-31T15:45:00Z' }`
- `set_location { lat: 43.0618, lon: 141.3545, name: 'Sapporo', timezone: 'Asia/Tokyo' }`
- `simulate_aurora { kp: 5 }`
- `zoom_view { type: geometric, final_target: solar_system_3d }`
- `orbit_object { object: 'Earth-Moon', angle: 220, speed: slow }`

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
luogo e inquadratura, ma evita la rotazione decorativa del banco Terra–Luna e
usa il comportamento ridotto già previsto dalle transizioni.

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

## Verifica

Eseguire:

```bash
node scripts/prova-demo.js
node scripts/prova-demo-browser.js
node scripts/prova-i18n.js
```

La prova browser avvia le demo dall'interfaccia, controlla astronomia,
inquadratura e ripristino e salva schermate in `work/demo-*.png`.
Il workflow **Verifica Demo** esegue le prove principali in pull request.
