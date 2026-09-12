# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 345 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362 (totale di adesso: 354).

## Lo stato delle prove

Verdi: `prova-missione.js --solo-motore` (144), `prova-missione-stati.js`,
`prova-missione-interattiva.js`, `prova-i18n.js`, `prova-lingua.js`,
`controlla-i18n.js --patto`, `controlla-collisioni.js`.

Rosse e **preesistenti**, verificate sull'albero pulito:

- `prova-missione.js`, due prove che dipendono dal cielo di stanotte — «un
  passaggio di stazione arriva fino alla tappa» e «le tappe rispettano davvero
  altezza e strumento» (Urano vuole il telescopio). 192 passate, 2 fallite.
- `verifica.html`, cinque prove: le quattro del §20 sull'acqua e una del §28
  (`la camera insegue cinquanta metri di strada con dolcezza`).

## Ultimo intervento completato

**La × del riquadro di Missione Cielo non finisce più la serata, e il riquadro
raccolto torna a essere un riquadro.**

Due cose in una segnalazione, ed erano due difetti di natura diversa.

### Il riquadro raccolto era una pillola vuota coi comandi appesi fuori

Il difetto vive **solo sotto i 600px**, cioè esattamente dove le prove non
guardavano mai: la metà nel browser di `prova-missione.js` gira a 900×900.

Raccolto, il riquadro non ha testo: tiene solo la maniglia, l'etichetta e la
chiusura, e tutt'e tre erano `position: absolute`. Un contenitore senza niente
nel flusso non ha un'altezza propria, quindi quella gliela doveva dare il
`min-height: 52px` scritto nella sua regola — e quel numero non arrivava mai,
perché `.missione-striscia.visibile` del blocco dei ≤600px lo rimette a zero,
ha la **stessa specificità** ed è scritto più in basso nello stesso foglio.

Misurato su 360×640, prima: pillola alta **venti pixel** — la sola imbottitura
— con dentro comandi alti trentotto, che le spuntavano sotto; e la ×, con la
larghezza di 280px scritta a mano, finiva **fuori dal bordo destro dello
schermo**, sopra alla colonna dei tasti della mappa.

La cura non è un `min-height` più convinto, che sarebbe la stessa scommessa
rifatta: i due comandi tornano **nel flusso** (`position: static`) e l'altezza
non si dichiara più affatto. Un'altezza che nasce dal contenuto non si può
azzerare per sbaglio. Stessa storia per la larghezza — `width: auto` con una
sponda sola fissata vuol dire «larga quanto il contenuto» — e da lì la pillola
misura 163×50 invece di 280×20, su tutti e tre gli schermi provati. Le due
classi del selettore (`.visibile.solo-voce`, che stanno sempre insieme) servono
a vincere a prescindere dall'ordine.

### La × finiva la missione

Di una × si dà dappertutto la stessa lettura — «via questa cosa dallo schermo»
— ed era l'unica che qui non valeva: chiudeva la serata, senza conferma, e una
serata chiusa per sbaglio non torna indietro.

Adesso la × fa quello che faceva il tasto «Nascondi, solo voce», che se ne va
con lei: due comandi per la stessa cosa, in tre centimetri appoggiati sopra al
cielo, erano anche i due che si contendevano la riga in cima. A finire la
missione c'è `missTastoTerminaStriscia`, un tasto con su scritto cosa fa.

Sta **nella riga in cima**, nel posto lasciato libero da quello sparito, e non
è una questione di gusto: in fondo, accanto a «Salta», sarebbe costato una riga
intera — trentotto pixel, misurati — e su un telefono da 320 quella riga
finisce sotto il bordo dello schermo, cioè il tasto ci sarebbe e non si
potrebbe premere. Con il posto riciclato il riquadro aperto è alto **esattamente
quanto prima** (351px a 320×568). È anche la compagnia giusta: in cima stanno i
comandi del *riquadro* (spostalo, chiudi la serata, raccoglilo), in fondo quelli
della *caccia* (segui il telefono, indizi, soluzione, salta).

Raccolto, la × non c'è affatto: il riquadro è già piccolo, e a riaprirlo pensa
«Mostra la guida». Vale anche per il riquadro della scoperta, che ha la stessa
coppia di comandi in cima.

Chiavi nuove: `missione.termina` nei due dizionari. `missione.soloVoce` resta,
e adesso è l'etichetta parlata della ×.

### Le prove

Quattro prove nuove nel §«il ponte col planetario» di `scripts/prova-missione.js`,
e per questa famiglia la finestra si **stringe a 360** e poi si rimette a 900:
il difetto sotto i 600px, a 900, non esiste. Si controlla che la × raccolga e
non termini, che raccolto i comandi stiano dentro al riquadro e il riquadro
dentro allo schermo, che «Mostra la guida» lo riapra e che il tasto che
termina ci sia, si legga e sia raggiungibile col dito. Con il conto di prima
sono rosse, col messaggio che descrive il difetto vero: «la maniglia esce sotto
al riquadro: 223 contro 191 (riquadro alto 12px, comando 38px)».

### Una prova rimasta indietro, e quello che nascondeva

`prova-missione-stati.js` era **rosso sull'albero pulito**, e da un pezzo: a
metà file chiedeva che durante la scoperta i nomi degli astri tornassero
accesi (`skyNomiVisibili() === true`), mentre la regola dice il contrario da
quando si è estesa alla scoperta — la ricerca è appena finita ma la missione
occupa ancora il planetario, e i nomi di tutto il cielo accesi mentre si legge
l'aneddoto del bersaglio appena trovato sono la risposta data un attimo troppo
tardi (vedi il commento sopra a `skyNomiVisibili` in `app.js`).

Quel file è uno **script lineare**, non una lista di prove: la prima `assert`
che salta lo interrompe, e si portava via tutto quello che le stava sotto — la
copertura dei due dizionari su tre gradini × cinque famiglie × tre varianti
compresa. Corretta la riga, il file gira intero e passa.
