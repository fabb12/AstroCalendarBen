# Licenza dell'AstroCalendario di Ben

Copyright © 2026 Fabio F. — AstroBen
Codice sorgente: <https://github.com/fabb12/AstroCalendarBen>
Canale YouTube: [@astroben2017](https://www.youtube.com/@astroben2017)

L'AstroCalendario di Ben è **software libero**. Questa pagina dice, in
italiano e in parole semplici, a quali condizioni lo si può usare, cambiare e
ridistribuire. Il testo che vale legalmente è quello delle licenze citate: la
GPL è in [`LICENSE`](LICENSE), la CC BY-SA 4.0 sul sito di Creative Commons.

## In breve

| Che cosa | Licenza |
|---|---|
| Il codice: tutti i file `.js`, `.html`, `.css`, `sw.js`, i manifest, `scripts/`, `worker-adsb.js` | **GNU GPL versione 3 o successiva** (`GPL-3.0-or-later`) |
| I testi e i disegni originali: la guida (`guida.html`, `guida-en.html`), le frasi dei dizionari (`lingue/`), le curiosità, le storie e le demo, i documenti `.md`, i disegni di `arte-costellazioni/` | GPL come sopra **e in più**, a scelta di chi li riusa, **Creative Commons Attribuzione – Condividi allo stesso modo 4.0** (`CC BY-SA 4.0`) |
| Il nome e il logo | **Non concessi** (vedi sotto) |
| La musica e le voci registrate (`musica/`, `audio/`) | **Non concessi** separatamente dall'app (vedi sotto) |
| Librerie, caratteri e dati di altri | Restano sotto la **loro** licenza (vedi sotto) |

## Il codice: GNU GPL v3 o successiva

Chiunque può, anche per scopi commerciali:

- **usare** l'app, per qualunque scopo;
- **studiare** come funziona e **modificarla**;
- **copiarla e ridistribuirla**, così com'è o modificata, anche a pagamento.

A queste condizioni:

1. **Stessa licenza.** Chi distribuisce l'app, o una versione modificata, o
   un programma che ne contiene una parte, deve farlo sotto la GPL v3 (o
   successiva). Non si può prendere questo codice e chiuderlo.
2. **Codice sorgente.** Chi distribuisce deve rendere disponibile il codice
   sorgente completo e corrispondente. Per un'app web come questa basta
   pubblicare i file così come vengono serviti, più un collegamento al
   repository da cui vengono.
3. **Avvisi.** Vanno conservati gli avvisi di copyright, di licenza e di
   assenza di garanzia, e allegata una copia della licenza (`LICENSE`).
4. **Modifiche dichiarate.** Una versione modificata deve dire chiaramente
   che è stata modificata, da chi e quando.
5. **Nessuna garanzia.** L'app è data «così com'è», senza alcuna garanzia e
   senza responsabilità dell'autore (sezioni 15 e 16 della GPL). In
   particolare: le previsioni del cielo, del meteo, dei transiti e dei
   passaggi sono calcoli e stime. **Non guardare mai il Sole** senza un
   filtro solare certificato, qualunque cosa dica l'app.

Chi usa l'app soltanto, senza ridistribuirla, non ha nessun obbligo.

## I testi e i disegni: anche CC BY-SA 4.0

La guida, le frasi, le curiosità, le storie e i disegni originali si possono
riusare anche fuori dal software (un articolo, una lezione, un video, un
cartellone), sotto la licenza
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.it). Le
condizioni sono:

- **Attribuzione**: citare «AstroCalendario di Ben, di Fabio F. (AstroBen)»
  con il collegamento al repository o al canale YouTube, indicare la licenza e
  dire se si è cambiato qualcosa;
- **Condividi allo stesso modo**: un'opera derivata va rilasciata sotto la
  stessa licenza.

## Il nome e il logo

I nomi **«AstroCalendario di Ben»**, **«Ben's AstroCalendar»** e
**«AstroBen»**, il canale YouTube **@astroben2017** e le immagini del logo
(`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
`apple-touch-icon.png`, `demo-logo-256.jpg`) **non** sono concessi in licenza,
come permette la sezione 7, lettera e), della GPL.

- Si possono usare per **parlare** dell'app e per dire da dove viene una
  versione derivata («basato sull'AstroCalendario di Ben»).
- Una versione **modificata** e pubblicata da altri deve avere un nome e un
  logo suoi, e non deve far credere di essere quella ufficiale né di essere
  approvata dall'autore.

## La musica e le voci

Le tracce di `musica/` (compresa `musica/canzoni/`) e le voci registrate di
`audio/` non sono rilasciate sotto licenza libera. Si possono ridistribuire
**solo insieme all'app**, come sua parte, e non da sole né in altre opere. Chi
ne vuole fare un altro uso chiede il permesso all'autore.

La canzone `musica/canzoni/pallido-punto-blu.mp3` usa le parole di Carl Sagan
(«Pale Blue Dot», 1994): i diritti su quel testo restano dei loro titolari.

## Le opere di altri

Queste parti non sono dell'autore e restano sotto la licenza di chi le ha
fatte. Sono tutte compatibili con la GPL v3.

| Parte | Autori | Licenza |
|---|---|---|
| Astronomy Engine 2.1.19 (da CDN) | Don Cross | MIT |
| FullCalendar 6.1.15 (da CDN) | Adam Shaw | MIT |
| Leaflet 1.9.4 (da CDN) | Volodymyr Agafonkin e collaboratori | BSD-2-Clause |
| satellite.js 5.0.0 (da CDN) | Shashwat Kandadai e collaboratori | MIT |
| Carattere Inter (`fonts/Inter.ttf`) | The Inter Project Authors | SIL OFL 1.1 (`fonts/LICENSE-Inter.txt`) |
| Carattere Space Grotesk (`fonts/SpaceGrotesk.ttf`) | The Space Grotesk Project Authors | SIL OFL 1.1 (`fonts/LICENSE-SpaceGrotesk.txt`) |
| Stelle, figure, cielo profondo (`dati-stelle*.js`, `dati-costellazioni.js`, `dati-profondo.js`) | d3-celestial (Olaf Frohn), da Hipparcos, Yale BSC, NGC/IC | BSD-3-Clause |
| Distanze delle stelle (`dati-distanze.js`) | HYG Database v4.1 (astronexus) | CC BY-SA 4.0 |
| Orbite di comete e asteroidi (`dati-corpi-minori.js`) | Stellarium, da Minor Planet Center e JPL | GPL |

L'app scarica poi, mentre funziona, dati e immagini da servizi esterni, che
non fanno parte di questo repository e restano sotto le loro condizioni:
mappe e luoghi di © OpenStreetMap e dei suoi collaboratori (ODbL), mappe di
OpenTopoMap (CC BY-SA) ed Esri, meteo di Open-Meteo (CC BY 4.0), orbite dei
satelliti di CelesTrak, indice Kp della NOAA, foto di Wikimedia Commons e della
NASA (con l'autore e la licenza scritti accanto a ognuna), voci di ElevenLabs
e Piper, aerei dalle reti ADS-B. Le attribuzioni richieste compaiono nell'app,
dove i dati si vedono.

## Contribuire

Chi propone una modifica (una pull request) accetta che venga rilasciata alle
stesse condizioni di questa pagina: GPL v3 o successiva per il codice, e anche
CC BY-SA 4.0 per testi e disegni.

## Come scriverlo in un file nuovo

In testa a un file di codice nuovo basta:

```js
// AstroCalendario di Ben — Copyright © 2026 Fabio F. (AstroBen)
// SPDX-License-Identifier: GPL-3.0-or-later
```

---

*This project is free software: you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version. Original texts and drawings are additionally available under
CC BY-SA 4.0. The names "AstroCalendario di Ben", "Ben's AstroCalendar",
"AstroBen" and the logo are not licensed (GPL §7(e)). Music and recorded
voices may be redistributed only as part of the app. It is distributed
WITHOUT ANY WARRANTY; see [`LICENSE`](LICENSE) for details.*
