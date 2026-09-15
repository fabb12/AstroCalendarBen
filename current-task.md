# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 343 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni, gli avvisi del
planetario e le due righe di stato in fondo alla scena della vista 3D. Il
tetto è 352, che è il totale di adesso.

## Lo stato delle prove

Verdi: `prova-volo.js` (35), `prova-stazioni.js`, `prova-guida.js`,
`prova-lingua.js`, `prova-i18n.js`, `prova-missione-stati.js`,
`prova-missione-interattiva.js`, `prova-missione.js --solo-motore` (158),
`controlla-i18n.js --patto`, `controlla-collisioni.js`.

Rosse e **preesistenti**, verificate sull'albero pulito prima di toccare
qualunque cosa (`git stash`, stesso conto prima e dopo):

- `prova-missione.js`: 223 passate, **4 fallite** — le tre
  «la guida raccolta si sposta davvero nella 3D senza allargarsi» (900×900,
  360×640, 640×360) e «non copre la barra del tempo, e i comandi restano
  premibili (640×360)». Erano le stesse quattro prima di questo intervento.
- `prova-sistema3d.js`: **2 fallite** — «entrando nel Sistema Solare resta lo
  stesso istante» e «tornando al planetario resta lo stesso istante».
- `verifica.html`: le quattro del §20 sull'acqua e una del §28, non rieseguite
  in questa sessione (non è stato toccato niente di quei moduli).

Nota per chi rilancia le prove nel browser qui dentro: il Chromium di
Playwright sta in `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, quindi
va passato `CHROMIUM=...` — il valore di serie degli script punta a
`/opt/pw-browsers/chromium/...`, che in questo contenitore non esiste.

## Ultimo intervento completato

**La musica di sottofondo ora ha un catalogo di tracce locali.** La cartella
`musica/` contiene il registro `catalogo.js` e le istruzioni per aggiungere i
file audio. Nelle Impostazioni si sceglie fra il paesaggio generato e le tracce
registrate, si regola il volume e si ricordano entrambe le preferenze. Il
lettore riproduce i file in loop e mostra un errore leggibile se un file manca.

Cache **v335**.

Toccati: `app.js`, `index.html`, `style.css`, `musica/catalogo.js`,
`musica/LEGGIMI.md`, `lingue/it.js`, `lingue/en.js`, `sw.js`, `CLAUDE.md`.

## Intervento precedente

**Le lune dei pianeti nella vista 3D, e nella caccia di Missione Cielo.**
Quattro cose in una passata, tutte legate fra loro:

1. **`SOL_LUNE`** (§7.7-bis di `app.js`): diciassette lune principali — le due
   di Marte, le quattro di Galileo, cinque di Saturno, quattro di Urano,
   Tritone e Caronte — con anello, nome, scheda, tocco e ricerca. Le quattro
   di Giove hanno la posizione vera (`Astronomy.JupiterMoons`); per le altre
   sono veri raggio, periodo e piano (quello equatoriale del pianeta, da
   `solAsse`) e la fase è **dichiarata**, e la scheda lo dice. Si vedono
   quando il disco del loro pianeta supera `SOL_LUNE_MIN_PX`, e il loro
   `stacco` si rimappa fuori dagli anelli disegnati (`solStaccoLunaDi`): senza,
   le tre lune interne di Saturno finivano dentro al disegno degli anelli.
2. **Diciassette bersagli nuovi per il genere «mondi lontani»**, con enigma,
   segno e aneddoti in due lingue, difficoltà dichiarata e due indizi di
   famiglia loro — il posto nella fila e la durata del giro al posto delle
   unità astronomiche, che per una luna sarebbero quelle del suo pianeta.
   La cornice di quella tappa va sul **pianeta** (`solInquadraLune`).
3. **Gli indizi 2 e 3 rifatti**: la geometria va davanti e la strofa in coda
   (era il contrario, e la direzione arrivava a lettura già finita); i gradi
   sopra l'orizzonte si aggiungono alla fascia; il percorso dalla stella di
   riferimento è diventato due passi invece di un elenco.
4. **Il volo del planetario vale anche in Missione Cielo**: l'inquadratura del
   bersaglio si consegna ad `apriSistemaSolare({ inquadra })` e si apre alla
   fine del volo, invece di sostituirlo.

Nella stessa passata: durante una caccia nella vista 3D i **nomi** dei mondi
minori, delle sonde e delle lune non si scrivono più — erano la soluzione
stampata accanto al bersaglio.

Cache **v329**.

Toccati: `app.js`, `missione-cielo.js`, `lingue/it.js`, `lingue/en.js`,
`scripts/prova-missione.js`, `scripts/prova-volo.js`, `sw.js`, `CLAUDE.md`.

## Intervento ancora precedente

**Il tasto Riascolta del riquadro informativo di Missione Cielo è diventato
un'icona.** Ora vive nella riga superiore accanto alla maniglia per spostare il
riquadro, invece di occupare spazio fra le azioni della caccia; conserva nome
accessibile e suggerimento in italiano o inglese. Aggiunta una prova di markup e
posizione. Cache **v328**.
