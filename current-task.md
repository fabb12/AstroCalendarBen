# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Le fotografie delle stazioni spaziali nel fumetto del planetario**, che non
comparivano. Segnalazione: «non vedo ancora foto delle stazioni spaziali nel
fumetto». Il «ancora» conta: la funzione era già stata scritta e sembrava a
posto — c'era il dato in `SATELLITI`, c'era il pezzo che lo mette nel fumetto
(`skyFumettoDatiAstro`) e nella scheda (`skySchedaImmagineHtml`), c'era il CSS
(`.fumetto-foto`), e c'era pure una prova verde in `scripts/prova-fumetto.js`.

### Cos'era

Gli indirizzi delle immagini erano **costruiti bene e puntavano al nulla**.
Wikimedia mette un file in `thumb/<a>/<ab>/<Nome>/<larghezza>px-<Nome>`, dove
`<a>` e `<ab>` sono i primi caratteri dell'md5 del nome: quei caratteri
tornavano (rifatto il conto in locale, cifra per cifra). Ma i **nomi dei file
non esistono su Commons**:

- `International_Space_Station_as_seen_from_SpaceX_Crew-2.jpg` — non c'è;
- `Chinese_Space_Station.jpg` — non c'è (ci sono `Chinese Tiangong Space
  Station.jpg` e `Chinese Space Station - front.jpg`, che sono altri file).

Cioè: un indirizzo plausibile a occhio, con l'hash giusto, che dà 404. E un
`<img>` che si prende un 404 **non fa rumore**: non solleva niente, non scrive
niente che parli del fumetto, lascia una cornice alta zero. Sullo schermo è
identico a «per le stazioni la fotografia non c'è» — che è la ragione per cui
è durato, e per cui la segnalazione è arrivata due volte.

E la prova non poteva prenderlo: serviva un'immagine sostitutiva a
**qualunque** indirizzo di `upload.wikimedia.org`, quindi un nome inventato e
uno buono erano la stessa cosa.

### Com'è adesso — §13-bis di `app.js`

1. **Gli indirizzi giusti**, e sono **due per stazione** e non uno: per la ISS
   i due scatti del sorvolo Crew-2 (NASA, pubblico dominio), per Tiangong lo
   scatto al telescopio di Shujianyang, intero e ritagliato (CC BY-SA 4.0 —
   la didascalia adesso nomina l'autore, come la licenza chiede).
2. **`satFotoGuasta`** sull'`onerror` di tutt'e due i posti che la mostrano: un
   nome sbagliato costa la candidata dopo, non la fotografia. `satFotoScelta`
   ricorda quale ha caricato, se no ogni ridisegno (due volte al secondo) si
   ricomprerebbe i suoi 404.
3. **Il soccorso**: finite le candidate, si chiede a Wikipedia qual è
   l'immagine di apertura della voce (`fotoVoce`) — l'unica fonte che resti
   giusta il giorno in cui su Commons un file viene rinominato.
4. E se non arriva niente, la cornice si **toglie**: meglio un fumetto di sole
   righe che un riquadro vuoto con dentro un'icona rotta.

`CACHE_NAME` è a `astrocal-v271`.

### Le prove

`scripts/prova-fumetto.js`, e ci sono tre cose nuove che vale la pena sapere.

- **La prova che il difetto vero l'avrebbe preso, senza rete**: il percorso di
  un file su Wikimedia è l'md5 del suo nome, quindi un indirizzo che non torna
  con quella regola non esiste da nessuna parte. Fin qui si guardava solo che
  ci fosse la parola «thumb».
- **Il finto server ubbidisce a un regime** che le prove gli cambiano sotto ai
  piedi: una candidata rotta (→ si passa alla riserva), poi tutte (→ arriva il
  soccorso di Wikipedia), poi anche quello (→ nessuna cornice vuota).
- **`PROVA_RETE=1 node scripts/prova-fumetto.js`**: una passata a parte che va
  a bussare davvero agli indirizzi. È la sola che possa dire se il file su
  Commons c'è — **e in questa sessione non si è potuta eseguire**, perché il
  proxy di rete dell'ambiente blocca `upload.wikimedia.org` (403 sul CONNECT,
  non un 404 di Commons). Da fare al primo giro su una rete vera.

Nella stessa passata è saltato fuori che **metà di `prova-fumetto.js` non
girava più**: il finto satellite che la prova delle stazioni infilava in
`sky.oggetti` non aveva il campo `colore`, e al primo `skyDisegna` successivo
`skyDisegnaAstro` moriva su `addColorStop('undefinedaa')`. Da lì in giù —
l'aereo, la geometria, la coda, i tasti, il costo della misura — non veniva
eseguito niente, in silenzio. Adesso l'oggetto porta il suo colore e viene
tolto da `sky.oggetti` a fine prova.

### Cosa resta rosso, e non è di questo lavoro

Con la prova che torna a girare tutta, viene fuori una cosa che era nascosta
dietro a quel crollo: **`resta fuori dalla bussola e dalla barra del tempo`
fallisce, e riguarda il fumetto di un aereo**, non le stazioni.

- Su un telefono girato (640×360) il fumetto di un aereo è alto 248 px mentre
  fra le due fasce ce ne sono 120: si posa a y=11 e arriva a 259, cioè **copre
  la barra del tempo**, che è l'orologio. Il commento in `skyPosizionaFumetto`
  dice l'opposto («delle due, quella che non si può coprire è la barra del
  tempo»), quindi è un difetto vero e non una scelta.
- Su 360×640 lo stesso, su 1280×800 è invece mezzo pixel di arrotondamento.

Non l'ho toccato: nasce dalla decisione — scritta e voluta — che il fumetto di
un aereo **non perde righe** e semmai scorre, e rimetterlo a posto vuol dire
tarare l'altezza massima contro le due fasce (CSS `.fumetto-cielo.fumetto-aereo`
+ il tetto in `skyPosizionaFumetto`), cioè un lavoro sul fumetto degli aerei
che con le fotografie delle stazioni non c'entra. È il prossimo da prendere.

Restano rosse, identiche a prima di questo lavoro e non toccate da qui, anche
cinque prove di `verifica.html` (acque e rilievo) e quattro di
`prova-nel-browser.js`.
