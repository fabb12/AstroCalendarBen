# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 352 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

Restano rosse, ed erano rosse anche prima, due cose che non c'entrano con le
nuvole: una prova di `scripts/prova-i18n.js` (chiavi orfane, tutte `visione.*`
e `ui.*`) e quattro prove del §20 di `verifica.html` sull'acqua.

**E ne è saltata fuori una quinta, che era rossa da chissà quando e non si
vedeva**: «cinquanta metri di strada, invece, la camera li insegue con
dolcezza» (§28, `rilOcchioMeta`/`rilOcchioOra` in `rilievo.js`). Non è una
regressione di questo lavoro — è una prova che il `SKY_FOV_MAX` mancante
teneva nascosta insieme a tutta la sua sezione, vedi qui sotto.

## Ultimo intervento completato

**Le nuvole del planetario si muovono col vento, invece di tornare indietro
ogni ora.**

Lo spostamento era `vento · faseOra`, cioè un **dente di sega**: le nuvole
scorrevano per un'ora e allo scoccare della successiva tornavano di colpo al
punto di partenza. Da fermi capita una volta ogni sessanta minuti e non lo
nota nessuno; con la macchina del tempo in marcia è un sobbalzo al secondo, e
somiglia a un difetto del disegno invece che a una formula. E il soffitto dei
cieli coperti si riseminava dodici volte l'ora (`floor(faseOra · 12)` dentro
al seme): ogni cinque minuti tutte le sue macchie si teletrasportavano
insieme.

Quello che c'è adesso non è una finzione fatta meglio, è un'altra cosa:
**le nuvole stanno su un piano e il vento le porta**. Uno strato è un
lenzuolo orizzontale alla sua quota, un banco è un punto di quel lenzuolo, il
vento trasla il lenzuolo. Da lì viene da sé tutto quello che si riconosce
guardando in su per davvero — un banco spunta dall'orizzonte da cui tira il
vento, sale, **accelera** passando sopra la testa, rallenta scendendo
dall'altra parte e tramonta. Non è un effetto aggiunto: è la prospettiva,
`v/distanza`, e la distanza allo zenit è la sola quota mentre a otto gradi
sull'orizzonte è sette volte tanto. Una nuvola bassa attraversa il cielo in un
quarto d'ora scarso, misurato.

**I cirri corrono più dei cumuli, e di traverso.** Non per scelta grafica: il
vento cresce con la quota. La previsione dava già il vento a dieci metri e
quello a 250 hPa (la corrente a getto, chiesta per il seeing, che sta a una
decina di chilometri — proprio alla quota dei cirri); adesso si chiede anche
`wind_direction_250hPa`, ed è quel campo a dare la cosa che più di tutte dice
«questo cielo è vero».

**Il cammino è un integrale, non un prodotto.** `meteoNuvoleCammino` integra
la serie oraria col trapezio — che per un vento interpolato linearmente fra
un'ora e l'altra è esatto, non approssimato — e `meteoNuvoleSpostamento` ci
aggiunge il pezzo di ora cominciata: continuo allo scoccare per costruzione, e
con la memoria di dov'è stato (cambiare il vento di stanotte non sposta
all'indietro le nuvole di ieri).

**I banchi stanno su un reticolo solidale al vento**, non sono una manciata
sorteggiata e traslata: l'unica distribuzione che una traslazione non cambia è
quella uniforme sul piano, e traslando un insieme fisso il cielo si svuota da
un lato e si affolla dall'altro. Uniforme sul piano vuol dire pochi banchi
grandi sopra la testa e molti piccoli verso l'orizzonte — che a occhio sembra
uno squilibrio ed è invece la ragione per cui un cielo rotto è rotto allo
zenit e chiuso in fondo.

### Tre difetti trovati misurando, e nessuno dei tre si vedeva

- **Il costo.** Al primo tentativo il passo del reticolo era 1,45 e il raggio
  0,36 — sessanta banchi sullo schermo — e il conto in un browser vero è stato
  **24,7 ms per fotogramma** contro gli 0,07 di prima: trecentocinquanta volte
  tanto, non per il disegno ma perché la cache degli sprite sfondava il suo
  tetto in pixel e ricostruiva due sagome sfocate a ogni fotogramma. Adesso il
  bilancio è scritto in chiaro (passo 2,3, raggio 0,21, tetto di dieci banchi
  per strato, gradino di sprite massimo sceso da 144 a 96 pixel) e il costo è
  fra 0,18 e 0,33 ms. Di lì è nato `scripts/prova-nuvole.js`.
- **La pizzicata.** Restava il transitorio: zumando, ogni banco attraversa i
  gradini del raggio e la cache li ricostruiva tutti — venti millisecondi nel
  fotogramma peggiore. Adesso una tela già pronta della stessa nube con la
  stessa luce si **riscala** fra metà e il doppio invece di rifarsi (fra due
  raggi cambia la risoluzione, non il disegno), e il peggiore è 6,8 ms con 0,55
  di media.
- **`isFinite(null)` vale `true`.** `Number(null)` è zero, quindi la guardia
  del primo fotogramma del soffitto non guardava niente: si prendeva un `dt`
  di cinquant'anni tosato a un'ora e il soffitto partiva già spostato.

### E la trappola dello `<script>` unico, di nuovo

Aggiungendo il §33 è saltato fuori che **dal §26 in giù `verifica.html` non
girava più niente**: il §25 usa `SKY_FOV_MAX`, che sta in `app.js` e che
quella pagina non carica, e il `ReferenceError` si portava via §26, §27, §28,
§29, §30, §31 e §32 interi. Quattrocentocinquanta prove che non fallivano —
semplicemente non comparivano. Messi i due estremi del campo fra gli stub in
cima, la pagina è passata da **770 prove a 1.228**.

### La fusione con `main`, e un incontro

Mentre questo lavoro era in corso, **`main` ha corretto per conto suo gli
stessi due difetti** (PR #474 e dintorni): la frazione dell'ora è diventata
una fase assoluta (`oraMoto`) e il seme del soffitto ha smesso di cambiare
ogni cinque minuti. La diagnosi era la stessa, la cura più leggera — e il suo
stesso commento ammette il prezzo che quella cura chiede: per non
teletrasportare i banchi quando la direzione prevista ruota fra un'ora e
l'altra, il vento che trasporta la trama **resta congelato al primo campione**
della previsione. Qui invece il vento si integra, quindi può cambiare di ora
in ora come cambia davvero. Nel conflitto si è tenuta questa versione, che
contiene l'altra.

Due cose viste risolvendo, e nessuna delle due la segnalava git:

- **`main` aveva già bumpato `CACHE_NAME` a `astrocal-v304`**, lo stesso
  valore che avevo messo io. Git le ha fuse senza conflitto — le due righe
  erano identiche — ma i contenuti no: chi avesse già in cache la v304 di
  `main` si sarebbe tenuto i file vecchi. Siamo alla **v305**.
- **L'ancoraggio del cammino.** Il commento di `main` rivendicava una
  proprietà che qui mancava: una fase «comune anche a due previsioni
  scaricate in momenti diversi». È un caso vero — la previsione dedicata alle
  nuvole si chiede in UTC, quella della scheda Stasera in ora locale, e la
  seconda fa da ripiego alla prima. Ho provato ad ancorare il cammino alla
  mezzanotte UTC riempiendo col primo vento il pezzo mancante: **non
  funziona**, perché una serie in ora locale comincia *prima* di mezzanotte
  UTC e il pezzo da riempire diventa di ventidue ore invece di due — il
  rimedio sbagliava di diciannove chilometri, misurati. Quello che invece è
  vero, e adesso è provato, è che due previsioni che condividono le ore
  muovono le nuvole **allo stesso modo**, e a separarle è una costante e non
  una deriva: il campo si riassesta una volta quando arriva la previsione
  dedicata, e un cielo che si assesta all'apertura non lo nota nessuno.

### Lo stato del PR #475

Il ramo è allineato all'ultimo commit di `main` (`7e9c73d`, PR #477): due
fusioni, nessun conflitto rimasto, `mergeable_state` «unstable» — cioè
fondibile, con un check rosso.

**Il check «missione» è rosso su `main`, non per colpa di questo ramo**, e la
distinzione è verificata in locale con worktree staccati sui commit veri:

- `prova-missione-stati.js:180` (`skyNomiVisibili()` che risponde `false`) è
  **deterministico** ed è rosso da `4a3088b` «Nascondi i nomi dei monti
  durante il gioco» (PR #469), cioè dal commit che ha introdotto insieme la
  funzione e la prova. Verde a `eea6fd2`, rosso da lì in poi su ogni commit di
  `main`. Nessuna correzione da portare: su `main` non ne è stata fatta
  nessuna.
- `prova-missione-interattiva.js:174` («un tocco vicino al bersaglio viene
  riconosciuto come corretto») è **intermittente**: la missione si sorteggia a
  ogni giro e il bersaglio atteso cambia a ogni esecuzione. Misurata tre volte
  per commit, `cc20b61` fa verde-rosso-verde e `7e9c73d` tre verdi. È una
  prova che passa o no a seconda di quale missione le capita, e il difetto che
  nasconde è che con certi bersagli il tocco vicino non viene riconosciuto.

Tutt'e due stanno in `missione-cielo.js`, che questo ramo non tocca.
Rimetterle in piedi è un altro lavoro e merita un PR suo.

### Cosa è stato toccato

- `meteo-astro.js`: §2-bis riscritta in parte, §**2-ter** nuova (il movimento).
- `verifica.html`: §**33** nuova (36 prove), più lo stub di `SKY_FOV_MAX`.
- `scripts/prova-nuvole.js`: nuovo, il costo delle nuvole in un browser vero.
- `sw.js`: `CACHE_NAME` a `astrocal-v305` (la v304 l'aveva già usata `main`).
- `CLAUDE.md`: la mappa di tutto quanto sopra.
