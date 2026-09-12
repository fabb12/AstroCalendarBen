# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 345 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

`scripts/prova-i18n.js` e `scripts/prova-lingua.js` sono adesso **verdi tutt'e
due** (la prima era rossa, vedi sotto). In `verifica.html` restano **cinque**
prove rosse, tutte preesistenti e nessuna della realtà aumentata: le quattro
del §20 sull'acqua e una del §28 (`la camera insegue cinquanta metri di strada
con dolcezza`) che fino a ieri non si vedeva perché la sua sezione non girava
affatto. Verificato sull'albero pulito: le stesse cinque, 1187 prove contro le
1229 di adesso.

## Ultimo intervento completato

**La realtà aumentata guarda solo il cielo, e non più il terreno: sedici volte
più leggera, e con tre difetti d'aggancio in meno.**

La segnalazione era in tre parole — «troppo pesante» — più una richiesta
precisa: «elabora solo il cielo, non l'immagine sotto l'orizzonte». Aveva
ragione su tutta la linea, e la causa non era il riconoscimento.

**Si guardava il terreno.** Il rivelatore girava su tutto il fotogramma e solo
*dopo* chiedeva al cielo calcolato che cosa ci fosse da riconoscere. L'ordine
è ragionevole letto da fuori — prima guardo, poi riconosco — ed è quello
sbagliato, perché butta via l'informazione migliore che ci sia: il cielo
calcolato sa già dove sono la Luna, i pianeti e gli aerei, a meno dell'errore
che si sta misurando, e quell'errore ha un tetto dichiarato (il cancello
dell'associazione). Fuori dai cancelli non c'è niente di associabile: una
macchia trovata lì viene scartata comunque, dopo essere costata. E sotto la
linea dell'orizzonte non c'è **nessun** candidato d'assetto per costruzione,
mentre ci sono tetti, rami, finestre accese e fari — migliaia di picchi di
contrasto, tutti da centroidare e tutti da buttare.

Misurato in node, un giro del rivelatore (i rapporti valgono in un browser, i
millisecondi di un telefono sono qualche volta tanto):

|                                      | prima | dopo | dopo, agganciato |
|---|---|---|---|
| cielo e basta (mare, campagna al buio) | 18,5 | 6,2 | 3,0 ms |
| collina con qualche luce                | 31,8 | 6,1 | 2,9 ms |
| skyline di città                        | 53,5 | 6,0 | 2,9 ms |

Le due cose da leggere sono la colonna di sinistra, che **triplica** col
paesaggio, e le due di destra, che non si muovono. Adesso c'è una finestra per
candidato, larga quanto il cancello e tosata alla riga dell'orizzonte
(§4-bis): ad aggancio fatto sono ventinove pixel, l'uno per cento di quello
che si guardava; col telefono puntato per terra sono **zero** e non si legge un
pixel. Sopra o sotto l'orizzonte lo dice il segno della terza componente di
`skyDirezione` e non una copia della geometria del cerchio di
`skyCerchioOrizzonte`.

**Tre voci che non sembravano voci.** Lo scarto tipico si trovava *ordinando*
quattromila numeri con un comparatore: 1,42 ms, più del residuo, dei massimi
locali e della conversione della luminanza messi insieme, per un numero che
serve solo come scala di una soglia — adesso è un istogramma a due passate,
0,03 ms, a centesimi di per cento dalla mediana esatta. I dettagli del
paesaggio si cercavano *a tentoni* in tredici per tredici (2,1 ms) mentre dove
sono finiti lo dice il giroscopio: due pixel bastano, 0,28 ms. E si cercavano
*sempre*, anche con due astri in mano, dove pesano 0,35 e non possono
correggere più di quattro gradi.

**E tre difetti d'aggancio, tutti col sintomo «cerco riferimenti».**

- **Una Luna sfondata non si agganciava.** «La scatola del fondo deve essere
  molto più grande delle macchie» era scritto da sempre, e quando quella
  condizione cade non cade piano: misurato su un disco saturo con l'alone che
  sfuma, a raggio 9 il centro sbaglia di 2,6 px e a raggio 11 escono **quattro**
  macchie con la migliore sbagliata di 7,1 — e quattro copie della stessa
  macchia sono, per la regola dell'ambiguità, quattro riferimenti ambigui,
  cioè nessuno. Nove pixel sono tre gradi e mezzo: la Luna piena in una
  fotocamera di telefono ci arriva sempre. Il raggio adesso si **misura**
  (§4-ter) e tutti i dischi tornano una macchia sola col centro esatto a zero
  pixel. Con la retroazione che serve perché il rimedio abbia dove applicarsi:
  la taglia misurata dimensiona la finestra del giro dopo, se no a cancello
  stretto la finestra è più piccola dell'alone e la cornice da cui si misura
  il cielo *è* alone.
- **Una sorgente forte alzava la soglia dove non c'era.** σ era uno per tutte
  le finestre: con una Luna sfondata in quadro, una stellina a venti gradi da
  lei si perdeva. Adesso ogni finestra ha il suo pezzo di cielo e la sua
  soglia.
- **Il cancello stretto chiudeva fuori l'astro che serviva.** L'aggancio si può
  dichiarare sui soli riferimenti del paesaggio, che tengono la mira senza
  sapere dov'è il Nord: da lì il cancello degli astri si stringeva a due gradi
  comunque, e con la bussola sbagliata di quindici il motore si agganciava al
  tetto del palazzo di fronte e non poteva più trovare l'unica cosa che gli
  avrebbe raddrizzato il cielo. Adesso il cancello stretto vuole una misura
  d'astro recente.

**E adesso dice perché non aggancia**, distinguendo i due casi che dal di fuori
si somigliano: «stai inquadrando sotto l'orizzonte, alza il telefono» e «qui
non c'è niente da riconoscere, inquadra la Luna o un pianeta luminoso».
«Cerco riferimenti» sopra un cielo in cui non c'è niente da cercare è la frase
che fa aspettare invano.

**Due cose trovate per strada, che non c'entrano con la richiesta.**

`prova-i18n.js` era rossa da un pezzo per undici chiavi orfane, e la causa non
era il dizionario: `visione.js` **non era nell'elenco dei file** che il
controllore legge, quindi le sue otto chiavi risultavano orfane tutte insieme.
Aggiunto il file sono cadute tutte e otto; le quattro che restavano erano
invece dati morti veri (`ui.fotocamera`, `ui.oppure-un-intervallo`,
`ui.sovrapponi-il-cielo-all-immagine-della`, `ui.vai-al-mese`, rimasti dal
giorno in cui il tasto della fotocamera si è spostato sulla mappa e la barra
del periodo ha preso il posto dei due selettori) e sono andate via.

In `verifica.html` **dal §26 in giù non girava niente**, e per due righe sole:
il §25 usa `SKY_FOV_MAX`, che sta in `app.js` e che quella pagina non carica.
Il `ReferenceError` in uno `<script>` unico portava via §26, §27, §28 e §32
**interi**, in silenzio — la pagina passava da 1187 prove a poco più di
seicento e il verdetto restava «In corso…» invece di diventare rosso, quindi
nemmeno le prove della realtà aumentata che c'erano già giravano più. Le due
costanti stanno adesso fra gli stub in cima, con lo stesso avvertimento degli
altri: sono copie.

## Se ci si rimette mano

`node scripts/prova-i18n.js` (mezzo secondo) e la §32 di `verifica.html`
aperta da un server (`python3 -m http.server 8000`). Il numero da guardare
quando qualcuno dice che la realtà aumentata è pesante è `visStato()`:
`pixelGuardati` su `pixelTotali`. Se la frazione è alta le finestre non stanno
stringendo — cioè o non ci si è agganciati, o i candidati sono sparsi per tutto
il cielo, o una sorgente sfondata ha allargato la sua finestra per retroazione.
