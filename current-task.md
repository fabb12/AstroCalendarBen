# Task Corrente

**Niente in corso.**

L'ultimo lavoro chiuso: la camera del planetario che si muove a scatti su un
telefono lento. Il costo **medio** del fotogramma era già dentro al budget —
quello che si vedeva era la **coda**, cioè un fotogramma ogni tanto che
costava tre o quattro volte gli altri. Quattro cure, tutte misurate con la
CPU rallentata sei volte (che è più o meno un telefono di quattro anni fa) e
tutte senza toccare di una virgola quello che si vede:

1. **Le comete e gli asteroidi a scaglioni** (`corpi-minori.js` §5). Erano
   sessantuno corpi con Keplero dentro, rifatti tutti insieme allo scadere
   della cache: 88 ms in un fotogramma solo. E la cache, col playback acceso,
   non prendeva **mai** — la chiave era `sky.offsetTempoSec`, che cambia a
   ogni fotogramma. Adesso la chiave è l'istante mostrato con una tolleranza
   (`CORPI_ISTANTE_MS`) e il giro si fa a scaglioni (`CORPI_SCAGLIONE_MS`).
2. **Il giro degli astri a scaglioni** (`skyAggiornaOggetti`, `app.js` §7.2),
   in tre fasi: i corpi, la coda (satelliti, ombra della Terra, matrice del
   catalogo), i pannelli. `forza` continua a fare tutto in un colpo, perché
   chi lo chiede legge l'elenco nella riga dopo.
3. **I formattatori di data si tengono** (`formattatoreData` in `app.js` §10).
   `new Intl.DateTimeFormat(...)` veniva costruito a ogni ora scritta: 1,7 ms
   per giro della barra del tempo, due volte al secondo. È la stessa cache che
   `i18n.js` aveva già per conto suo.
4. **La bussola non riscrive l'SVG a campo fermo** (`skyAggiornaBussola`).

Misurato trascinando il cielo a CPU ×6: `skyDisegna` p50 da 16,0 a 12,4 ms,
p90 da 22,9 a 15,4, p99 da 41,8 a 34,8. Il costo medio del fotogramma a 180°
di campo da 26,9 a 21,5 ms, a 60° da 17,8 a 13,1, a 25° da 14,2 a 9,5.

Banco di prova nuovo: `scripts/prova-scaglioni.js` (13 prove, tutte verdi).
Confronta le due strade — a scaglioni e tutta in un colpo — cifra per cifra,
perché un elenco di astri sbagliato è un cielo perfettamente plausibile.

**Resta la leva più grossa, e ha un prezzo:** a CPU ×6 il nostro JavaScript è
ormai un quarto del fotogramma (12 ms su 48) e il resto è **rasterizzazione**
del canvas. Il buffer è il riquadro moltiplicato per il `devicePixelRatio`
(`skyRidimensiona`), quindi su un telefono con dpr 3 sono 3,4 milioni di
pixel riscritti più volte per fotogramma. Tosare il dpr a 2 dimezzerebbe quel
costo, ma è l'unica delle leve che si paghi in nitidezza — le scritte sul
cielo (nomi delle stelle, delle montagne, dei paesi) sono disegnate sulla
tela, non impaginate — quindi non è stata toccata: va decisa da chi guarda,
non da chi misura.

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 347 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js`. Il tetto è 347.

## Lo stato delle prove

Verdi: `prova-scaglioni.js` (13 su 13), `controlla-i18n.js --patto` (347 ≤ 347),
`prova-missione.js --solo-motore` (158 su 158).

`prova-verifica.js`: **1238 verdi, 5 rosse** — identiche prima e dopo
l'intervento (verificate con `git stash` sull'albero pulito): sono le cinque
dell'acqua e della camera che cammina, preesistenti.

`prova-nel-browser.js`: le stesse rosse di prima dell'intervento (la scheda
dell'aereo che non collassa, «il cielo gira fluido» che in headless misura
nove fotogrammi al secondo, e l'eccezione di `solTesto` che si porta via la
coda della prova). Verificate con `git stash`: stesso conto prima e dopo.
