# Task Corrente

**In corso: finire la traduzione inglese di `app.js`.** Vedi «Cosa resta» in
fondo — sono le eclissi (la mappa dell'ombra, le eclissi di casa, quelle
lunari), le simulazioni e gli avvisi del planetario, per un totale di **355
stringhe** contate da `node scripts/controlla-i18n.js --lista --file app.js`.
Tutto il resto è fatto, provato e dentro al tetto.

## Ultimo intervento completato

**La Didattica e il Telescopio tradotti per intero, i mesi del calendario, il
Diario, i moduli del paesaggio e i nomi delle 88 costellazioni.** Richiesta:
«completa la traduzione in inglese, controlla bene la parte didattica e
telescopio, traduci ogni voce, controlla anche i mesi nel calendario».

### 1. I mesi del calendario — `app.js`

`NOMI_MESI` era già un array di getter su `Intl`, ma le dodici `<option>` del
selettore del mese si scrivevano **una volta sola** alla costruzione: dopo un
cambio lingua restavano «gennaio, febbraio…» dentro a un'interfaccia inglese.
Adesso c'è `riempiNomiMesi(selMese)`, chiamata da `inizializzaSelettoriMese()`
*e* da `sincronizzaSelettoriMese()` (che gira a ogni cambio lingua). È
**idempotente** — se il primo e l'ultimo nome sono già quelli giusti non tocca
niente — perché riscrivere l'`innerHTML` di un `<select>` mentre uno lo sta
usando gli porta via il fuoco.

FullCalendar invece i nomi dei mesi e dei giorni li scrive da sé, dal suo
`locale`: li rimette a posto `calendarioCambiaLingua()`, che era già lì.

### 2. `telescopio.js` — da zero a completo

~430 chiavi `tel.*`. Le tabelle passano dagli aiutanti di `app.js`
(`conNomeDaId`, `conTestiDaId`, `conNomeTradotto`): `TEL_CERCATORI`,
`TEL_TIPI`, `TEL_CIELI`, `TEL_PANNELLI`, `TEL_PASSI_COLLIMAZIONE`,
`TEL_FIGURE_TEST`, `TEL_FRAZIONI_CAMPO`, i tre metodi di puntamento. Convertiti
tutti e cinque i pannelli, l'allineamento per deriva, il radar push-to, i salti
di stella, i cerchi graduati, l'anteprima dell'oculare e ogni `fillText` delle
tele.

Due cose da sapere:

- **Il nome di un oculare non si salva più tradotto.** I preset scrivevano
  `nome: '20 mm Plössl (in dotazione)'` dentro a `localStorage`: quella frase
  restava italiana per sempre. Adesso il preset porta `dotazione: true` e il
  nome lo compone `telNomeOculare(oc)` al momento di scriverlo.
- **`conNomeDaId` saltava `id: 0`.** La verità semplice (`if (voce.id)`)
  lasciava non tradotta la prima voce di `TEL_FRAZIONI_CAMPO`, che parte da
  zero — un difetto su otto, invisibile. Adesso è `!= null`, in
  `conNomeDaId` e in `conTestiDaId`.
- **La guardia di `telCostruisciVista`** era `dataset.pronto`: la striscia
  delle cinque linguette non si riscriveva mai dopo il primo disegno. Adesso è
  `dataset.lingua`.

### 3. `didattica.js` — da zero a completo

~460 chiavi `did.*`, otto banchi. La scorciatoia si chiama **`testoDi`** e non
`t` né `tr`: tutt'e due quei nomi sono già presi da `const` locali in questo
file (`const t = didTela(...)`, `const t = Astronomy.MakeTime(...)`,
`const tr = fionda.traiettoria`), e una `const` che ombreggia una funzione nello
stesso blocco non dà un nome sbagliato — dà un ReferenceError da zona morta.

- `laboratorio(def)` traduce da sé `chip`/`occhiello`/`titolo`/`sommario` dei
  banchi (`did.lab.<id>.<campo>`), quindi nessuno degli otto deve saperlo.
- `CORPI` e `FIONDA_PIANETI` prendono il nome da `nomeCorpo(id)`, la tabella
  unica dell'applicazione: erano la settima e l'ottava copia, ed è così che la
  Didattica diceva «Marte» mentre l'agenda accanto diceva «Mars». `muTesto` è
  diventato un getter, perché «1,26687 × 10⁸» ha il separatore della lingua.
- Le quaranta tappe delle Voyager, i cinque quadri e le quattro notti del banco
  delle aurore passano da `testoDaChiave` in un ciclo.
- `MESI`/`MESI_BREVI` sono array di getter su `Intl` come in `app.js`; `num()`
  passa da `astroI18n.numero`.
- **`didRidisegnaPerLingua()`** (nuova, chiamata da `ridisegnaTuttoPerLingua`):
  il banco è composto tutto in JavaScript, quindi si rifà da capo. Rimette il
  banco che era aperto, chiude prima lo schermo intero e richiama `entra()`.
  `didCostruisci` adesso aggancia l'ascoltatore delle linguette una volta sola
  (`dataset.collegato`), se no ogni ridisegno ne appendeva un altro.
- **`verifica.html` carica `didattica.js` senza `app.js`**: gli aiutanti delle
  tabelle passano da tre wrapper guardati (`nomiDaId`, `nomiTabella`,
  `testiTabella`, `nomeDi`). Senza, un `ReferenceError` alla prima riga si
  portava via `window.didProve` e con lui i §12 e §17, in silenzio.

### 4. Il Diario, e i moduli del planetario

- **Diario** (`app.js` §15): le tre schede di riepilogo, l'elenco vuoto, i dieci
  traguardi (`traguardo.*` via `conNomeDaId`/`conTestiDaId`). Il traguardo delle
  quattro fasi cercava «Luna Piena» **dentro al titolo congelato** della voce:
  con l'app in inglese non scattava più, cioè si rimangiava un traguardo già
  preso. Adesso il diario salva anche la **chiave** dell'evento
  (`fase.2`, che non dipende dalla lingua) e per le voci vecchie c'è
  `diarioEDiFase`, che confronta con `astroI18n.tutteLeVersioni('fase.N.titolo')`
  — un'aggiunta al gestore (`i18n.js`), pensata per i testi *congelati* e non
  per comporne di nuovi.
- **`terreno.js`** (48 → 0): la riga di stato del paesaggio per intero — il
  profilo, le luci dei paesi, le vette, i laghi e i fiumi, e i guasti di
  Overpass. I nomi dei quattro tasti li legge adesso `terrenoEtichettaTasto`
  dalla **stessa chiave** che `index.html` porta con `data-i18n`, se no il nome
  di un tasto avrebbe due sorgenti.
- **`rilievo.js`**, **`aurora-polare.js`**, **`aerei.js`**,
  **`miglior-posto.js`** (81 in tutto → 0).
- **`costellazioni.js`** (20 → 0) e **i nomi delle 88 figure IAU**. I nomi
  stanno in `dati-costellazioni.js`, che è *generato*: si traducono in
  `costNomeFigura(sigla, ripiego)` con la sigla per chiave (`cost.nome.Ori`).
  La funzione è globale perché la legge anche `catalogo.js`, che scrive i nomi
  sopra le figure nel planetario — e lì il nome è diventato un **getter**,
  perché `cat.figure` si costruisce una volta sola all'apertura. L'ordine
  alfabetico dell'atlante usa il locale di adesso.

### 5. Le prove

`scripts/prova-lingua.js` non apriva la **Didattica** e apriva del Telescopio
il solo pannello «Strumento»: il conto di quella vista era un quinto della
vista. Adesso il ciclo apre gli otto banchi e i cinque pannelli e tiene il conto
**peggiore**. Da lì è saltato fuori che, siccome la sezione delle prestazioni
lascia aperti tutti i modali, la copertura misura anche l'atlante — che infatti
aveva ottantotto nomi italiani.

Risultati: `prova-i18n` verde, `prova-lingua` verde, audit 364 (era 621).

`scripts/i18n-tetto.json` scende a **364** e le viste a 0 tranne telescopio 4 e
didattica 1, che sono scritti nel campo `_residui` del file con il loro perché.

## Cosa resta

1. **`app.js`, 355 stringhe.** Sono in blocchi:
   - le **eclissi di Sole**: la mappa dell'ombra e i suoi comandi (§1-ter),
     il meteo dell'eclissi, la condivisione, «le eclissi di casa tua»
     (§1-quater);
   - le **eclissi di Luna** (§1-quinquies);
   - le **scene della simulazione** (§8);
   - gli **avvisi del planetario** (`skyAvviso`) e qualche riga sparsa.
   Si convertono come le altre: chiave, `astroI18n.t`, voce nei due dizionari.
2. **I nomi degli oggetti profondi** («M3 — Globulare dei Cani da Caccia»).
   Stanno in `SKY_PROFONDO` (`app.js`) e in `dati-profondo.js`, e sono **anche
   l'identificativo** con cui l'app li ritrova (`dso:<nome>`): tradurre il nome
   vuol dire cambiare l'identificativo, e con lui i link già condivisi e il
   ponte verso il catalogo grande di `catalogo.js`. Va fatto in un colpo solo,
   in tutt'e tre i posti: un id stabile separato dal nome mostrato.
