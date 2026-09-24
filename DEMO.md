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
demo. La persona può muovere la camera e cambiare i filtri: l'intervento manuale
prende la camera per la scena corrente senza fermare il racconto. Escape o
**Termina demo** interrompono il tour e ripristinano vista, data/ora, luogo,
camera, FOV, filtri, inseguimento, playback, Sistema Solare, aurora e fullscreen.
Cambiare scheda mette in pausa la demo.

## I quattro tour predefiniti

| Tour | Scene · durata | Cosa mostra |
| --- | --- | --- |
| **Eclisse solare totale 2026** (`eclisse_tour`) | 3 · 30 s | Reykjavík, 12 agosto 2026. Il planetario parte con un campo di 4° centrato sul Sole e attraversa i minuti della totalità; poi vola al banco Terra–Luna e centra l'impronta reale dell'ombra sulla Terra. |
| **Eclisse lunare totale** (`eclisse_lunare`) | 2 · 24 s | Sapporo, notte fra 31 dicembre 2028 e 1 gennaio 2029. La Luna è centrata con campo 4°/2,5° e il timelapse 00:45–03:00 JST comprende il massimo reale delle 01:52. |
| **Aurora boreale** (`aurora_boreale`) | 2 · 20 s | Tromsø, 15 gennaio 2027. Campo largo 90° verso nord, ovale aurorale acceso con **Kp 5 simulato**, poi timelapse 21:00–23:30. È una simulazione didattica, non una previsione. |
| **Corteo dei pianeti** (`allineamento_pianeti`) | 2 · 22 s | Tucson, alba del 21 ottobre 2028. Campo 120° verso est con Mercurio, Venere, Marte e Giove evidenziati; il timelapse attraversa 05:45–06:10 MST senza spostare artificialmente i pianeti. |

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
- `set_date { iso: '2028-12-31T15:45:00Z' }`
- `set_location { lat: 43.0618, lon: 141.3545, name: 'Sapporo', timezone: 'Asia/Tokyo' }`
- `simulate_aurora { kp: 5 }`
- `zoom_view { type: geometric, final_target: solar_system_3d }`
- `orbit_object { object: 'Earth-Moon', angle: 220, speed: slow }`

`set_fov` accetta un campo fra 0,5° e 160°. Il FOV faceva già parte dello
snapshot di ripristino di AstroDemo, quindi anche questa azione viene annullata
correttamente a fine tour o su Escape/Stop.

`center` resta alias di `center_target`.
`transition_to` cambia direttamente fra `planetarium_view` e
`solar_system_3d`. Gli orari civili sono validati nel luogo e nella data
raggiunti dallo script.

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
