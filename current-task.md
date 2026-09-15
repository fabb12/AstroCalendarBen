# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 343 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni, gli avvisi del
planetario e le due righe di stato in fondo alla scena della vista 3D. Il
tetto è 352, che è il totale di adesso.

## Lo stato delle prove

Verdi: `prova-volo.js` (**nuova**, 32), `prova-sistema3d.js`,
`prova-stazioni.js`, `prova-guida.js`, `prova-lingua.js`, `prova-i18n.js`,
`prova-missione-stati.js`, `prova-missione.js --solo-motore` (158),
`controlla-i18n.js --patto`, `controlla-collisioni.js`.

Rosse e **preesistenti**, verificate sull'albero pulito prima di toccare
qualunque cosa (`git stash`, stesso conto: 222 passate, 1 fallita):

- `prova-missione.js`, una prova: «non copre la barra del tempo, e i comandi
  restano premibili (640×360)».
- `verifica.html`, cinque prove: le quattro del §20 sull'acqua e una del §28
  (`la camera insegue cinquanta metri di strada con dolcezza`). 1238 verdi.
- `prova-missione-interattiva.js` ha un punto che può diventare rosso a caso:
  il seme della missione è casuale, e quando la prima tappa capita essere un
  oggetto del cielo profondo la riga `point.selection.id` legge `undefined`.

## Ultimo intervento completato

**Il tasto Riascolta del riquadro informativo di Missione Cielo è diventato
un'icona.** Ora vive nella riga superiore accanto alla maniglia per spostare il
riquadro, invece di occupare spazio fra le azioni della caccia; conserva nome
accessibile e suggerimento in italiano o inglese. Aggiunta una prova di markup e
posizione. Cache **v328**.

Toccati: `app.js`, `missione-cielo.js`, `style.css`,
`scripts/prova-missione.js`, `sw.js`.

## Intervento precedente

**La voce di Missione Cielo non resta più appesa al ponte Edge-TTS.** La
richiesta remota adesso scade dopo 4,5 secondi, viene abortita e lascia partire
il ripiego Web Speech del dispositivo. Prima un endpoint raggiungibile ma
bloccato lasciava la Promise sospesa senza limite: non arrivava un errore e
quindi il ripiego, pur esistendo, non veniva mai chiamato. Cache **v325**.

Toccati: `missione-cielo.js`, `EDGE-TTS.md`, `sw.js`, `CLAUDE.md`.

## Intervento precedente (2)

**Il volo dal planetario al Sistema Solare** (§7.7-quinquies di `app.js`,
prefisso `solVolo`, prove in `scripts/prova-volo.js`).

Il passaggio fra le due viste era una pila di `<div>` animati in CSS: una
palla di gradienti radiali al posto della Terra, un arco sfocato al posto
dell'atmosfera e tre didascalie maiuscole che annunciavano le fasi. Aveva due
difetti che si sommavano — le fasi si notavano *perché c'era scritto quali
erano*, e i due capi non combaciavano, perché un foglio di stile non può
sapere da che posa il planetario stava guardando né quanto grande la scena
disegnerà la Terra.

Adesso è una tela sola, disegnata in JavaScript, e il movimento sta in **due
grandezze continue**: la quota in progressione geometrica (da mezzo chilometro
a novantamila) e l'angolo fra l'asse della camera e il centro della Terra. Il
disco del pianeta si ricava esatto da loro con la stessa algebra di
`skyCerchioOrizzonte`; il primo fotogramma è la **fotografia** della tela del
planetario, ancorata all'orizzonte del conto; l'ultimo ha la Terra della
misura e nel posto in cui la scena la metterà, disegnata dalla stessa
funzione della scena (scarto medio misurato: 0,01 livelli su 255 dentro al
disco). Dura 5,6 s e vola **solo** nel passaggio per cui esiste.

Due difetti veri trovati misurando, tutti e due invisibili a occhio:

- **Il segno della tangente.** Tosando l'angolo a `π/2 − ε` invece di tosare
  la tangente, l'esterno di un cerchio — che è come si scrive «sono per terra
  e la Terra è il pavimento» — diventava un disco da duecentotrentaduemila
  pixel, e il pianeta spariva. C'è il contro-esempio nel banco.
- **Il vuoto.** Tenendo fermo il beccheggio il pianeta scivola fuori dal
  quadro da sé (la depressione cresce con la quota) e restavano due secondi di
  schermo nero con quattro stelle — che non fallisce e si legge come «si è
  piantato». La coreografia si scrive adesso sullo schermo (dove si vuole il
  bordo vicino) e l'angolo si ricava.

Toccati: `app.js`, `index.html`, `style.css`, `missione-cielo.js` (passa
`{ senzaVolo: true }`), i due dizionari (sei chiavi delle didascalie tolte,
sparite con loro), `sw.js` (v320 → **v321**), `CLAUDE.md`.
