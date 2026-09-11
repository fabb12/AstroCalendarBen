# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 343 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

Restano rosse, ed erano rosse anche prima, due cose che non c'entrano con
Missione Cielo: una prova di `scripts/prova-i18n.js` (undici chiavi orfane,
tutte `visione.*` e `ui.*`) e quattro prove del §20 di `verifica.html`
sull'acqua, con la loro eccezione in console (`SKY_FOV_MAX is not defined`).

## Ultimo intervento completato

**Missione Cielo: i tre indizi diventano tre strofe dello stesso
indovinello, la serata finisce con una coppa, e la voce esulta.**

Tre segnalazioni in una, e la prima era la più precisa: «il primo indizio va
bene, il secondo e il terzo no».

**Il secondo e il terzo non erano sbagliati: cambiavano registro.** La
direzione era la direzione, la stella di riferimento era davvero lì. Ma dopo
un enigma in prima persona — «Ho mari in cui non è mai caduta una goccia» —
arrivava «Sempre verso nord-ovest: cerca a metà cielo. L'altezza si misura a
partire dall'orizzonte», cioè la voce di un navigatore satellitare. Il
narratore spariva alla seconda riga, e con lui il gioco: un indovinello che a
metà diventa un'istruzione ha già detto a chi ascolta che era finto. Non si
vede leggendo il codice — tutte e tre le righe, prese una per una, sono
sensate.

Adesso sono tre strofe della stessa voce, legate in due modi che si sommano.
**Dalla catena**: `missEnigmaSeguito` pesca con lo stesso nome proprio →
specie → famiglia dell'enigma, quindi chi ha ricevuto l'enigma proprio riceve
anche il seguito proprio e chi è sceso di un gradino ci resta per tutte e tre.
**Dalla variante**: `missVarianteEnigma` è una sola per le tre strofe — con
due indici scorrelati sarebbero tre indovinelli diversi sullo stesso oggetto,
che è quasi peggio di tre istruzioni — e tiene dentro l'eccezione delle figure
moderne, se no proprio per loro la prima riga e le altre due si sfaserebbero.
La geometria non è sparita: dentro a ogni strofa ci sono ancora la direzione,
la fascia di altezza e il riferimento misurato in dita e pugni a braccio teso,
più il punto cardinale **opposto** («dai le spalle a sud-est»), che al buio si
usa davvero. Sessantacinque frasi nuove per lingua, e nessuna nomina il
bersaglio.

**Due tappe della stessa famiglia dicevano la stessa riga.** È il difetto che
la cura ha creato, ed è saltato fuori guardando una missione vera: da quando
la seconda e la terza strofa scendono alla famiglia, il Cigno e Cassiopea —
due tappe su quattro, cielo di Como — dicevano tutt'e due «fra diecimila anni
sarò storta». A occhio non si legge come una coincidenza, si legge come un
copia-incolla, e col tetto della varietà a due per famiglia capitava una volta
su tre. `variantiIndizioUsate` fa per le strofe quello che si faceva già per
le domande. Vale anche per i bambini, che per questo hanno le varianti
numerate come gli adulti.

**Le coppe e i premi** (§7-bis, `CHIAVE_MISS_ALBO`). Sono due grandezze
diverse e tenerle separate è tutto il pezzo. La **coppa** è della serata — oro
a chi ha trovato tutto quasi da solo, argento a chi ha trovato tutto o quasi
con qualche indizio, bronzo a chi ha trovato qualcosa — e la soglia è in aiuti
**medi** per tappa trovata, non totali, se no la serata lunga è per forza
peggiore di quella corta. Non esiste la coppa di latta: chi non trova niente
non ha perso una gara, ha avuto una serata storta, e `missCoppaDiMissione`
risponde `null` — da lì tace anche la voce. Il **premio** è di sempre: non si
vince e non si perde, si sblocca e resta, e parla di cosa si è visto (cinque
pianeti diversi, dieci oggetti profondi, tre sere) e non di quanto si è stati
bravi. Quattordici premi, e quelli non presi si mostrano lo stesso nella
bacheca, spenti: un traguardo che non si sa che esiste non fa venire voglia di
niente. Quello che non si mostra è quanto manca — una barra di avanzamento
sotto le stelle è la cosa sbagliata. Il conto non si ricostruisce dal Diario
(una missione si conclude anche senza salvarla), quindi sta in `localStorage`
col suo numero di formato e va nel backup; `missAlboConMissione` è pura e a
scrivere è solo `missPremiaMissione`, che consegna una volta sola.

**La voce.** Era «M tredici. La sua luce è partita…», cioè un cartellino da
museo letto ad alta voce. La segnalazione lo diceva in chiaro — «quando vince
deve leggere: evviva, hai trovato, bravo» — ed è quello che fa una persona:
prima esulta, poi dice cosa hai trovato, poi racconta. Tre pezzi in
quest'ordine, e il primo (`gioco.evviva.*`) è la sola riga del modulo scritta
per essere sentita e non letta. Il nome si accentua: `missSsmlRisalta` mette
un `<break>` brevissimo davanti — il tempo in cui chi ascolta capisce che sta
per arrivare la risposta — e un `<emphasis level="strong">` sopra, e lo fa
**solo** nella scoperta, perché dentro a un indizio sarebbe la soluzione detta
a voce alta. La scoperta è salita da 1,35 a 1,7 di `styledegree` (2 coi
bambini), e la tabella dei toni ha una quinta riga, il **premio**, che è
`cheerful` e non `excited`: una coppa si consegna, e consegnarla urlando la fa
sembrare una presa in giro.

**E una prova che dal suo centro in giù non girava più.**
`scripts/prova-missione-stati.js` chiedeva che l'indice dell'indizio arrivasse
a tre: era rimasto indietro dal giorno in cui gli indizi da tre sono diventati
due. Quel file è uno script lineare, non una lista di prove — la prima
`assert` che salta lo interrompe — quindi metà del banco non veniva eseguita
affatto, in silenzio. Adesso il numero si legge da `MISS_INDIZI`; e appena è
ripartito è saltato fuori che al documento finto mancava `createElement` da
quando la scoperta accende i fuochi d'artificio.

Prove: `node scripts/prova-missione.js --solo-motore` (141 verdi) e con
Chromium (187), `prova-missione-stati.js`, `prova-missione-interattiva.js`,
`prova-lingua.js` e `controlla-collisioni.js` tutti verdi.
