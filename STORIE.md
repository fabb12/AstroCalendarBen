# Storie cosmiche (a schermo: CosmoStorie)

Racconti per bambini in cui gli astri hanno un **volto** e una **voce** e
spiegano un fenomeno vero. Una Storia cosmica è una demo come le altre
(`DEMO.md`): stesso motore, stesso orologio, stessa voce. Il codice sta in
`storie-cosmiche.js` (prefisso `stor`), le storie in `demo-predefiniti.js`
(voci con `storia: true`), i testi nei due dizionari.

Si trovano nella pagina **Demo**, linguetta **Storie cosmiche** (v409; prima
era il gruppo 7 in fondo alla pagina): una scheda per storia (titolo, durata,
personaggi con la loro personalità, **Guarda la storia**, **Duplica e
modifica**), l'anteprima di un personaggio (scegli chi e con che espressione,
poi **Fallo parlare**: funziona anche offline e senza nessuna vista
astronomica), l'esempio del DSL e lo **Studio delle storie**
(`storie-studio.js`, §Lo Studio), che le crea senza scrivere codice. Le storie
compaiono anche nell'elenco generale delle demo. La linguetta scelta si
ricorda (`astrocal_demo_scheda_v1`); un link `?demo=` apre sempre la prima.

## Tre promesse

1. **Il cielo di partenza è vero.** Il modulo non calcola posizioni. I
   volti si appoggiano dove i renderer esistenti hanno appena
   disegnato l'astro: la ricevuta di `skyDisegnaAstro` e di
   `corpiMinoriDisegna` nel planetario (`storRicevuta`), i corpi già
   proiettati da `solDisegna` e da `solDisegnaVicino` nella vista 3D
   (`storDisegnaSistema`). Niente seconda proiezione. Una falce resta una
   falce (il volto ci sta sopra); un puntino porta, al suo posto, il **corpo
   disegnato** del personaggio (§I corpi, v411), e solo se lì non c'è spazio
   il corpo va accanto, con un filo e un anello che lo legano all'astro vero. La storia sceglie la sera, il luogo e la camera, come ogni
   demo; le fasi e le distanze sono quelle di quell'istante. **Dalla v409**,
   solo nella vista 3D e solo per chi è in scena, la storia può cambiare
   l'astro: lo fa crescere quanto basta a portare il volto addosso, lo fa
   viaggiare fuori dall'orbita, saltare o cambiare misura (§Il corpo nello
   spazio). Non è una seconda proiezione: l'app chiede al modulo dove mettere
   il corpo **prima** di proiettarlo, e da lì lo tratta come sempre.
2. **Un livello a parte.** Si disegna alla fine del fotogramma, sopra a
   tutto e prima della registrazione (quindi finisce anche nel filmato). Fuori
   da una scena che lo chiede non c'è nessun volto: `storRicevuta` e
   `storDisegnaCielo` escono alla prima riga, e una demo normale resta
   identica a prima.
3. **I personaggi sono dati.** Un personaggio è una riga di
   `STOR_PERSONAGGI` (o eredita da una famiglia di `STOR_FAMIGLIE`),
   un'espressione è una voce di `STOR_ESPRESSIONI`, una forma della bocca una
   voce di `STOR_BOCCHE`. Il disegno è uno solo e legge quelle tabelle.

## Gli agganci

| Dove | Cosa |
|---|---|
| `skyDisegnaAstro` (app.js) | dopo `skyRegistraDisco`: `storRicevuta(o.id, p.px, p.py, r, o)` |
| `corpiMinoriDisegna` (corpi-minori.js) | `storRicevuta('min:' + nome, …)` |
| fine di `skyDisegna` | `storDisegnaCielo(ctx)`, **prima** di `skyRegAcquisisci` |
| fine di `solDisegna` | `storDisegnaSistema(ctx, { corpi: ordinati, sole })` |
| fine di `solDisegnaVicino` | `storDisegnaSistema(ctx, { corpi: finti, sole: sol.soleVicinoSchermo })` |
| `solDisegna`, per ogni corpo, prima di `solAggiornaPivot` (v409) | `p.rDisegno = storRaggio3D(id, r)`, `p.scena = storScena3D(id, p.scena, r)` |
| `solDisegnaVicino`, sui due corpi finti (v409) | gli stessi due, poi di nuovo `solProietta` |
| `solScenaLuna`, `solScenaLunaPianeta` (v409) | `storScena3D('Moon' / id della luna, punto, raggio)` |
| `solRaggioLuna`, `solRaggioLunaPianeta`, `solRaggioSole` (v409) | `storRaggio3D(id, r)` |

Per l'occlusione nella 3D `sol.lunaSchermo`, `sol.luneSchermo` e
`sol.satSchermo` portano adesso anche la `vicinanza`, e
`solDisegnaSoleVicino` lascia `sol.soleVicinoSchermo`.

Un volto **non c'è** se l'astro è fuori schermo, dietro alla camera (non
disegnato), sotto l'orizzonte o dietro alla collina disegnata
(`skyAltezzaOrizzonte`), davanti al disco della Luna (che sta davanti a tutto
tranne le stazioni), eclissato (il Sole coperto oltre il 55%), dietro a un
disco più vicino nella 3D, nascosto con `character_hide`, o disegnato sotto il
mezzo pixel. Nella scala cosmica, nella Didattica e nella mappa del cono
d'ombra i personaggi non si disegnano (la validazione lo dice); nelle scene
`transition` possono parlare ma il volto non si vede.

## Aggiungere un personaggio

Una riga in `STOR_PERSONAGGI` (§1 di `storie-cosmiche.js`), con la chiave
uguale all'identificativo che l'app usa già per quell'oggetto:

```js
Callisto: { famiglia: 'luna', pelle: '#a8a29e', iride: '#44403c', sottotitolo: '#d6d3d1',
  espressione: 'thinking', voce: { ritmo: '-4%', tono: '6Hz' }, personalita: 'callisto' },
```

| Campo | Cosa | Di serie |
|---|---|---|
| `famiglia` | `stella`, `pianeta`, `luna`, `nano`, `asteroide`, `cometa`, `stazione`, `sonda`, `galassia`, `buco`, `persona` (v450) | dedotta dall'oggetto |
| `nome` | chiave del dizionario del nome | il nome che l'app gli dà già (`corpo.<id>`, `SOL_LUNE`, …) |
| `pelle` | colore del disco grafico e delle palpebre | il colore dell'app per quell'oggetto |
| `iride` | colore degli occhi | della famiglia |
| `sottotitolo` | colore del nome nel sottotitolo (su fondo scuro: va chiaro) | della famiglia |
| `guance` | colore del rossore | della famiglia |
| `genere` | `f` o `m`: i tratti di lei o di lui (§Lei e lui) | della famiglia |
| `sagoma` | il corpo disegnato (§I corpi): `stella`, `pianeta`, `luna`, `anelli`, `asteroide`, `cometa`, `voyager`, `iss`, `tiangong`, `hubble`, `galassia`, `gigante_rossa`, `nana_bianca`, `supernova`, `buco_nero`, `buco_bianco`, `sagan` (v450) | della famiglia |
| `cosmo` | il luogo della scala cosmica in cui vive, e **solo** lì (`idea`: in nessun posto, v414) | — |
| `luogo` | il suo luogo nella scala cosmica, per chi vive anche altrove (v414: Betelgeuse) | — |
| `decoro` | il disegno sul corpo di un pianeta: `bande`, `macchia`, `continenti`, `calotta`, `nubi`, `crateri` | — (le lune: crateri) |
| `baffi`, `barba` | solo lui: `manubrio`, `folti`, `spioventi`; `folta`, `onde`, `pizzetto`, `ispida` | — |
| `peli` | il colore di baffi, barba e sopracciglia folte | la pelle scurita |
| `labbra`, `trucco` | solo lei: il colore delle labbra e dell'ombretto | `#d9577b`; — |
| `scala` | quanto del disco occupa il volto (0,3–0,95 del raggio) | 0,78 |
| `dx`, `dy` | dove sta il volto rispetto al centro, in raggi | 0 |
| `occhi` | `{ r, distanza, alto }` in frazioni del volto | `{ 0.235, 0.35, -0.08 }` |
| `voce` | `{ ritmo, tono }` per la sintesi (es. `'-8%'`, `'12Hz'`) | della famiglia |
| `espressione` | quella di partenza | della famiglia |
| `personalita` | chiave `storie.personalita.<…>` | della famiglia |
| `alias` | altri nomi con cui l'app lo chiama in un'altra vista | — |
| `ospite` | non è un astro: sta in un posto dello schermo in ogni vista e non viaggia (v450, Carl Sagan: §Le storie cantate) | — |

La personalità va scritta in `storie.personalita.<…>` nei due dizionari (la
legge la pagina Demo). Un oggetto che l'app conosce e che nessuna riga nomina
(una luna di Urano, la sesta stella dell'elenco, una cometa del catalogo)
parla lo stesso, con la faccia della sua famiglia e i colori dell'app.

Gli identificativi accettati sono quelli dell'app: `Sun`, `Moon`, gli otto
pianeti (`Earth` compresa, che si vede solo nella 3D), `Star1…Star8`, le lune
di `SOL_LUNE` (`Io`, `Titan`, `Phobos`, …), i mondi di `SOL_MONDI` (`Ceres`,
`Pluto`, …, anche come `min:Cerere`), i corpi minori `min:<nome>`, le
stazioni (`iss`/`ISS`/`sat-iss`, `css`/`Tiangong`, `hubble`), le sonde
(`voyager1`/`Voyager 1`, `voyager2`). Lo stesso oggetto ha un nome solo in
tutte le viste (`storCanonico`).

## Occhi, bocca, espressioni

**Gli occhi** (v411): l'occhio è **l'apertura fra le due palpebre**
(`storAperturaOcchio`, funzione pura): la parte dell'ellisse che sta sotto
al bordo della palpebra di sopra e sopra a quello della palpebra di sotto,
due file di punti. Il bianco, l'iride e il contorno seguono quel bordo.
Fino alla v410 le palpebre erano due stesure del colore della pelle
appoggiate sull'occhio: sopra a un pianeta vero, di un altro colore,
sembravano un paio d'occhiali, e a occhio spalancato il tratto della
palpebra diventava una virgola scura in cima all'iride — da lontano una
**seconda pupilla** (e la crocetta accanto al riflesso grande ci metteva
del suo: tolta). La palpebra di sopra segue la curva del bulbo e si
inclina (`inclinaSu`: verso il naso la rabbia, verso fuori la tristezza);
quella di sotto si inarca all'insù (`arcoGiu`): gli occhi che sorridono
sono mezzelune, con una piega leggera sotto. Chiuso, l'occhio è una riga:
all'ingiù (il sonno, il battito) o ad arco all'insù (`felici`, la risata).
Iride a gradiente col colore del personaggio, pupilla (a stella
nell'entusiasmo, a cuore nell'amore), due riflessi (quattro negli occhi
lucidi della tristezza), contorno grosso sopra e sottile sotto, alone
chiaro sotto (un volto sulla parte in ombra di una falce resta leggibile). La
corsa dell'iride è tosata perché iride, pupilla e riflessi restino **sempre**
dentro l'ellisse dell'occhio. Lo sguardo va allo spettatore, a un oggetto
(`character_look_at`) o, mentre un altro parla, **a chi parla**. Le palpebre
battono da sole (fra 2,6 e 6 secondi, ogni tanto un doppio battito; più di
rado col movimento ridotto), con un generatore seminato per personaggio.

**Aggiungere un'espressione**: una voce in `STOR_ESPRESSIONI` con
`palpebraSu`, `palpebraGiu` (0 aperto, 1 chiuso), `pupilla` (scala),
`ciglio: { alza, inclina, curva, asimmetria }` (inclina > 0 alza l'estremo
verso il naso), `bocca` (una forma di `STOR_BOCCHE`), `curva` (+ sorriso, −
broncio), `guance`, `sguardo` (`null` o `{ x, y }`), `spostaBocca`, più le
manopole (tutte facoltative): `occhi` (quanto si allargano), `iride`,
`inclinaSu`, `arcoGiu`, `felici`, `lucidi`, `stelle` (pupille a stella),
`cuori` (pupille a cuore), `rosso` (la fronte che si arrossa), `testa`
(inclinazione in radianti), `rimbalzo`, `tremito`, `storta` (la bocca di traverso, > 0 alza l'angolo
di destra) e `segno` (il segno da fumetto); e le chiavi `storie.espressione.<nome>` (e
`storie.espressioneLei.<nome>`, la forma femminile che lo Studio usa per
lei) nei due dizionari, più `studio.parole.umore.<nome>`. Il DSL la accetta
da sé. Di serie ci sono `neutral`, `happy`, `laughing` (v411), `surprised`,
`worried`, `sad`, `thinking`, `excited`, `love` (v411), `angry` (v411),
`sleepy`, `annoyed` (v422: palpebre pesanti, occhiata di traverso, bocca
storta e lo sbuffo) e `bully` (v422: dall'alto in basso, un sopracciglio
su, il ghigno storto coi denti e il luccichio sul dente). Sono **esagerate di proposito**: un volto largo
settanta pixel, per dei bambini, si legge solo se dice una cosa sola e la
dice forte.

**Le forme della bocca** (`STOR_BOCCHE`): `chiusa`, `piccola`, `A`, `E`, `O`,
`sorriso` (aperto, coi denti di sopra), `grande`, `risata`, `triste` (col
labbro che trema), `ondulata`, `denti` (i denti stretti della rabbia), `ghigno` (i denti
all'insù del bullo, v422), con
mezza larghezza, apertura, rotondità, curvatura, `onda` (la bocca che trema)
e `denti`.

## Lei e lui (v411)

Ogni personaggio ha un `genere` (`f`, `m`), che segue il nome italiano e il
mito: la Luna, la Terra, Venere, Io, Europa, Callisto, le stazioni e le
Voyager sono lei; il Sole, Mercurio, Marte, Giove, Saturno, Urano, Nettuno,
Plutone, Ganimede, Titano e Hubble sono lui. Dei pianeti nani (v420) Cerere,
Eris, Haumea e Sedna sono lei, Makemake, Gonggong, Quaoar e Orco lui; ognuno
ha i suoi colori e la sua personalità, e tre un decoro (`cuore` di Plutone,
`sale` di Cerere, `macchia_scura` di Haumea). Una famiglia ha il suo di
serie (le lune e le comete lei, i pianeti e gli asteroidi lui).

- **Lei**: occhi un po' più grandi e alti, contorno di sopra più deciso,
  tre ciglia lunghe e arricciate all'angolo esterno e due piccole sotto,
  sopracciglia sottili e arcuate, le **labbra** (il labbro di sotto pieno,
  quello di sopra con l'arco di Cupido, e da aperta il contorno nel colore
  delle labbra), a Venere anche l'ombretto (`trucco`).
- **Lui**: occhi un po' più stretti, un ciglio corto, **sopracciglia folte**
  (nel colore dei `peli` se ha baffi o barba), il naso col bulbo, la bocca
  d'inchiostro; e a chi li ha baffi e barba (`disegnaBaffi`,
  `disegnaBarba`): il Sole i baffi folti arancioni, Giove la barba bianca
  da re degli dèi, Saturno i baffi a manubrio, Nettuno la barba a onde,
  Marte il pizzetto, Hubble i baffi grigi.

Un profilo scritto male non fa una Luna coi baffi: `storProfilo` toglie
baffi e barba a lei, labbra e ombretto a lui.

## I corpi (v411)

`storie-cosmiche.js` §6-quater, `disegnaCorpo`. Fino alla v410 un astro
troppo piccolo per portare il volto lo portava in un adesivo tondo, per
tutti: la Voyager parlava da un disco come se fosse un pianeta. Adesso il
personaggio ha **il suo corpo**, la `sagoma`:

| Sagoma | Il corpo | Dove sta il volto |
|---|---|---|
| `stella` | il disco con la corona di fiamme che gira | sul disco |
| `pianeta`, `luna` | il disco col suo `decoro` (le bande e la Grande Macchia di Giove, i continenti della Terra, la calotta di Marte, le nubi di Venere, la macchia di Nettuno, i crateri) | sul disco |
| `anelli` | Saturno: metà degli anelli dietro, metà davanti, sotto alla bocca | sul disco |
| `asteroide` | un sasso a patata, diverso per ognuno (`patata`, seminata dal nome), coi crateri | sul sasso |
| `cometa` | il nucleo, la chioma, la coda di polvere e quella degli ioni, dalla parte opposta al Sole (se si sa dov'è) | sul nucleo |
| `voyager` | la grande parabola, il corpo a dieci facce dorato, il magnetometro, i tre generatori, la piattaforma con la telecamera, un'antennina in testa | sulla parabola |
| `iss` | il traliccio, otto pannelli, i radiatori, il modulo centrale | sul modulo |
| `tiangong` | le due ali e il laboratorio a T | sul modulo |
| `hubble` | il tubo argentato col coperchio aperto, i due pannelli | sul tubo |
| `galassia` | i bracci a spirale punteggiati di stelle (v412) | sul nucleo |
| `gigante_rossa` | una stella che ribolle: il contorno che ondeggia, le celle chiare e scure, il velo di polvere attorno (v414) | sul corpo |
| `nana_bianca` | il disco bianco che splende azzurro, con le quattro punte di luce (v414) | sul disco |
| `supernova` | la nube azzurra coi filamenti rossi del Granchio, le onde d'urto, la stella di fuoco a punte e i due fasci della pulsar (v414) | sul cuore |
| `buco_nero` | l'ombra viola quasi nera, l'anello di luce, il disco di gas che gira (metà dietro, metà davanti come gli anelli di Saturno, più chiaro dal lato che viene verso di noi) e la luce piegata sopra all'ombra (v414) | sull'ombra |
| `buco_bianco` | il disco bianco col contorno **a tratteggio** (è un'idea), raggi e onde che corrono fuori (v414) | sul disco |
| `sagan` | Carl Sagan (v450): il busto con la giacca di velluto e il dolcevita rosso, la testa che è un disco-pianeta, i capelli a ciuffo | sulla testa |

`STOR_CORPI` dice per ognuna dove sta il volto (`storVoltoNelCorpo`) e
quanto il corpo esce dal suo raggio (`ingombro`: i pannelli, gli anelli, la
coda), che serve a non metterlo sopra a un altro personaggio.

**Dove si mette.** Nel planetario, con `size: auto`, un astro abbastanza
grande porta il volto da sé (la Luna ingrandita, il Sole); uno piccolo
porta il suo corpo **al suo posto**, centrato sull'astro: l'astro è lui.
Solo se lì il corpo non c'entra (il bordo dello schermo, un altro
personaggio troppo vicino) va accanto, col filo; `size: badge` lo mette
sempre accanto. Nella 3D l'app disegna le sonde come una crocetta e le
stazioni come un puntino: per le sagome che non sono un disco
(`STOR_SAGOME_FORMA`) il corpo lo disegna il modulo lì dove l'app ha messo
l'astro, e prende la luce del suo Sole come il volto. Le sonde e i mondi
minori che la scena ha spento si disegnano lo stesso se sono in scena
(`storInScena`, chiamata da `solDisegna`).

L'anteprima della pagina Demo e le figurine dello Studio
(`StorieCosmiche.ritratto`, un ritratto fermo su una tela piccola) usano lo
stesso corpo.

## La fisica dei personaggi (v430)

`storie-cosmiche.js` §1 (`STOR_FISICA`, `STOR_FISICA_FAMIGLIE`,
`STOR_FISICA_EMOZIONI`) e §6-sexies. Chi usa l'app ha chiesto che ogni
personaggio sia **il suo corpo celeste** e che il carattere venga dalla
fisica. Ogni personaggio ha:

| Cosa | Campo | Esempi |
|---|---|---|
| il corpo centrale | la `sagoma` (§I corpi) | — |
| la superficie vera | `superficie` e il `decoro` | crateri di Mercurio, nubi d'acido di Venere, oceani della Terra, deserto di Marte, bande di Giove |
| l'atmosfera | `atmosfera { colore, spessore, densita }` | nessuna per Mercurio e la Luna, densissima per Venere e Titano, la foschia azzurra di Plutone |
| gli anelli | `anelli { colore, rx, ry, giro, alfa }` | Urano coi suoi anelli **in piedi** (asse a 98°), Nettuno, quello tenue di Giove; Saturno li ha nella sagoma |
| le lune | `lune [{ nome, colore, r, d, periodo, piatto, giro, sasso }]` | la Luna della Terra, Phobos e Deimos (sassi), le quattro di Galileo in fila, Titano, Miranda e Titania, Tritone che gira **al contrario**, Caronte grande quasi metà di Plutone |
| l'avatar d'energia | `avatar` | `corona` (il Sole: raggi che pulsano), `magnetosfera` (Terra e Giove: aurore ai poli e linee del campo), `aura` (galassie e buchi) |
| la silhouette | tutto insieme | è quello che fa riconoscere una figurina di 48 pixel |
| il corpo che si muove | `passo`, `tremito`, `testa` | Mercurio respira e guarda in giro quasi al doppio e ha il nervoso addosso; Giove e Nettuno sono lenti; Urano tiene la testa piegata |
| il perché | `tratto` → `storie.fisica.<id>` | detto nella pagina Demo sotto alla personalità, e nel suggerimento delle figurine dello Studio |

**La personalità viene dalla fisica** (i testi `storie.personalita.*` sono
stati riscritti così): Mercurio è veloce, nervoso, impaziente (un anno di 88
giorni, nessuna atmosfera a proteggerlo); Venere elegante ma intensa e
«infernale» (460 gradi sotto le nubi d'acido); Marte ossessionato dall'idea
che gli umani ci possano vivere; Giove grande e protettivo (la sua gravità
devia comete e asteroidi); Saturno vanitoso e orgoglioso degli anelli; Urano
eccentrico e fuori dagli schemi (rotola coricato); Nettuno freddo, distante e
misterioso; Plutone insicuro da quando, nel 2006, l'hanno declassato.

**L'umore muove la fisica** (`storReazioneFisica`, funzione pura; la
reazione scivola verso quella voluta in `STOR_TAU_REAZIONE`, e col movimento
ridotto ci salta):

- **Le tempeste** crescono con la rabbia, ognuna la sua (`tempeste`):
  `vortici` attorno alla Grande Macchia Rossa e fulmini (Giove), `venti`
  bianchi che corrono e la macchia scura che si gonfia (Nettuno), `cicloni`
  (Terra), `fulmini` nelle nubi (Venere), `polvere` che vela il disco
  (Marte), l'`esagono` al polo (Saturno), i pennacchi dei `vulcani` (Io).
- **Il fuoco** delle stelle (v436, al posto delle prominenze): una corona
  di lingue di fiamma senza contorno, in tre stesure (fuori, arancio,
  giallo vivo), che si piegano e guizzano ognuna col suo passo; più alte e
  più svelte con la rabbia e l'entusiasmo (e parlando), e il fuoco di fuori
  si arrossa con l'atmosfera. Le disegna `disegnaFiamme`: per un corpo
  disegnato le chiama `disegnaCorpo` (al posto dei vecchi raggi a punta
  contornati), sull'astro vero la fisica (`opz.fuori`). Gli archi di plasma
  e la bolla dell'espulsione non ci sono più: da lontano erano fili staccati
  dal corpo.
- **L'atmosfera** si gonfia (`atmoK`) e cambia colore: rossa di rabbia,
  rosa d'amore, grigia e sottile di tristezza, che pulsa con la tempesta.
- **Le lune reagiscono**: si stringono al pianeta quando ha paura o è triste
  (e calano), saltano fuori per la sorpresa, tremano per la rabbia, ballano
  per la contentezza; il loro tempo (`pg.tempoLune`) corre più o meno svelto
  senza mai saltare all'indietro. Nella 3D le lune **vere** fanno lo stesso
  (`storLunaReagisce`, da `storScena3D`): una luna che non è un personaggio,
  attorno a un pianeta che lo è, si avvicina e trema attorno al pianeta
  com'è mostrato.
- **Gli anelli nella gestualità**: Saturno li alza e li apre quando è fiero o
  entusiasta (e luccicano: è vanitoso), li lascia cadere da triste, li fa
  vibrare da arrabbiato, li muove sulle parole quando parla.
- **L'avatar** si accende con l'emozione e la voce.

**Dove si disegna.** Due strati attorno al corpo, `dietro` (avatar,
atmosfera, prominenze, metà di dietro di anelli e orbite) e `davanti`
(tempeste sul disco, metà davanti), in `storDisegnaFisica`. Sul corpo
disegnato tutto; sull'astro vero col volto addosso lo strato di dietro solo
fuori dal disco (`clipFuoriDisco`) e le tempeste sotto al volto, con la sua
luce. Nella 3D le lune e gli anelli disegnati non ci sono (ci sono quelli
veri, che reagiscono). Il ritratto (figurine e anteprima) porta la fisica
ferma; `ingombroDi(profilo)` conta lune e anelli.

Aggiungere la fisica a un personaggio: una riga in `STOR_FISICA` con la sua
chiave e, se ha un perché da dire, `storie.fisica.<id>` nei due dizionari.

## La domanda al pubblico (v430)

Un episodio può chiudersi con una domanda a chi guarda. Il cartello è
l'azione `story_question` (§8): `text` (al più 200 caratteri), le scelte `a`
e `b` (al più 60, facoltative: una previsione può restare aperta), `kind`
(`who_is_right`, `probe`, `trust`, `explore`, `choice`, `prediction`,
`next_star`) e `from` (chi la pone). Sta in alto sotto al cartello «Sei
qui», con le due pillole A e B e l'invito «Rispondi nei commenti!», per tutta
la scena (`stor.domanda`, `storDisegnaDomanda`).

```
action: story_question { text: 'Chi ha ragione? Marte o Giove?', a: 'Marte', b: 'Giove', kind: who_is_right, from: 'Jupiter' };
action: character_speak { target: 'Jupiter', text: 'Chi ha ragione? Marte o Giove? Scrivilo nei commenti!' };
```

**Nello Studio** (`storie-studio.js` §4-bis) la domanda **nasce dagli
eventi** dell'episodio (`studioFattiEpisodio`: chi ha parlato e quanto, le
facce finali, i litigi — una risposta con «no», «sbagli», «invece» o con la
faccia dura —, le mete dei viaggi e chi non è tornato, le vesti, i luoghi
della carta, chi è stato nominato con la maiuscola), e ogni tipo ha un
punteggio:

| Tipo | Quando | Esempio |
|---|---|---|
| `ragione` | un litigio (3), o due facce opposte (2,2) | «Chi ha ragione? Terra o Sole?» |
| `sonda` | c'è una sonda: partita (3) o solo in scena (2,4) | «Dove dovrei andare adesso? Nube di Oort o Sole?» |
| `fiducia` | un bullo o un infastidito contro uno gentile (2,6) | «Di chi ti fideresti? …» |
| `esplora` | almeno due mete o luoghi (2,2) | «Quale oggetto celeste dovremmo esplorare? Giove o Saturno?» |
| `ab` | qualcuno è partito (1,8) | «E tu, al mio posto, che cosa avresti fatto?» Partire · Giove / Restare a casa |
| `previsione` | una veste (2,8), o un viaggio senza ritorno (2) | «Secondo te, alla fine della mia vita che cosa diventerò? Nana bianca o Buco nero?» |
| `protagonista` | qualcuno è stato zitto o solo nominato (2) | «Chi vuoi come protagonista del prossimo Short? …» |

**Non c'è sempre**: in automatico (`domanda.modo: 'auto'`) si fa solo se il
migliore arriva a `STUDIO_DOMANDA_SOGLIA` (2) e ci sono almeno due battute.
Chi scrive sceglie in «La domanda finale» (fra il copione e il controllo):
quando (solo se è adatta, sempre, mai), che tipo, chi la fa, oppure la scrive
a mano con le sue scelte («Modifica questa» copia lì la proposta). Sotto ai
campi c'è la domanda che la storia farà davvero. Il copione la mette in una
scena in più, ferma, con la camera dell'ultima, chi la pone che guarda chi
guarda con la faccia entusiasta e la dice («… Scrivilo nei commenti!»); non
nella prova di una scena sola. La battuta della domanda parla con la voce di
sintesi (non ha un numero di voce dello Studio). I nomi stanno nelle domande
come etichette («Terra o Sole?»), senza articoli, così le frasi tornano con
ogni astro.

## Nella scala cosmica (v412)

La scala cosmica (`scala-cosmica.js`, il quarto quadro della vista 3D) è un
ambiente delle storie: una scena `solar_system_3d` con `cosmic_scale`. Lì
`cosmDisegna`, alla fine del fotogramma, chiama `storDisegnaCosmo`
(`storie-cosmiche.js` §7-bis), e i personaggi stanno **al loro posto
vero** sulla carta (`cosmDove`): la Terra attorno al Sole, la Voyager 1 a
centosettanta unità astronomiche, una luna o una stazione col suo pianeta,
chi la carta non conosce col Sole. La promessa è la stessa del planetario:
allontanandosi, il Sole, la Terra e la Voyager diventano lo stesso puntino,
e i loro corpi si affollano accanto a lui, legati dai fili a quel pixel.
Una storia non può mentire su questo, e anzi ci costruisce sopra la sua
battuta migliore («Allora siamo un puntino…»). Vicino alla Terra, dove il
Sole e i pianeti hanno un disco vero (`cosmRaggioUA`), il volto ci va
sopra come altrove.

**I personaggi dell'universo.** La famiglia `galassia` (sagoma a spirale:
bracci logaritmici affusolati punteggiati di stelle, nucleo dorato col
volto) e quattro personaggi che vivono **solo** nella scala cosmica, al loro
luogo (`cosmo`): la **Via Lattea** (`milky_way`, al centro della Galassia),
**Andromeda** (`andromeda`), **Sirio** (`sirius`) e **Alfa Centauri**
(`alpha_centauri`). Mostrati fuori da una scena con `cosmic_scale`, la
validazione lo dice (`demo.err.soloCosmo`).

**I viaggi.** `character_move` va verso un altro personaggio o verso un
**luogo dell'universo** (`STOR_LUOGHI_COSMO`, `cosmLuogo`): le tappe della
scala per nome (`oort`, `heliopause`, `local_bubble`, `milky_way`,
`laniakea`, `universe`, …) e i paletti (`alpha_centauri`, `sirius`,
`orion_nebula`, `galactic_center`, `lmc`, `smc`, `andromeda`,
`triangulum`, `virgo_cluster`, `great_attractor`). Le tappe centrate sul
Sole non hanno un punto: andarci vuol dire arrivare al loro **bordo**, nella
direzione della Voyager 1. Fra due distanze lontane molti ordini di
grandezza la distanza cresce in progressione geometrica
(`storPuntoCosmo`), così su una carta logaritmica il viaggio scorre invece
di saltare in fondo; la forma del percorso (arco, saltelli, spirale…) è
sullo schermo (`storScarto2D`). Anche `look`/`character_look_at` e
`effect` accettano un luogo. Chi esce dal quadro resta sul bordo, con una
**freccia** verso dove sta davvero. Tornati nella 3D, un viaggio verso un
luogo dell'universo si dimentica (lì quel luogo non c'è).

```
scene solar_system_3d {
  duration: 12s;
  action: cosmic_scale { from: 'heliopause', to: 'oort' };
  action: character_show { target: 'voyager1', expression: 'excited' };
  action: character_show { target: 'Earth', look: 'voyager1' };
  action: character_move { target: 'voyager1', to: 'oort', path: arc };
  action: character_speak { target: 'voyager1', text: 'Vado verso la nube di Oort!' };
}
```

## Lo stile: la fiaba d'inchiostro (v408)

Un pennino indaco scuro (`INCHIOSTRO`, mai nero puro) a spessore variabile —
sopracciglia e ciglia sono tratti affusolati (`tracciaPennino`), il contorno
dell'occhio è grosso sopra e sottile sotto —, stesure piatte con un'ombra sola
a taglio netto. Sotto ogni tratto un alone color panna (`ALONE`; attorno
agli occhi solo il velo leggero `ALONE_TENUE`, che non fa gli occhiali). Fino
alla v416 dentro all'ombra c'era il retino a puntini dei fumetti stampati:
accanto agli occhioni faceva rumore, ed è uscito. Il disco
grafico è un **adesivo** (`disegnaAdesivo`): ombra piatta spostata, bordo
panna, riflesso a virgola; il filo che lo lega all'astro è tratteggiato e
scorre. L'anteprima della pagina Demo usa lo stesso adesivo su un cielo
d'inchiostro.

**Gli «occhioni di luna» (v417).** Su un disegno di riferimento chiesto da chi
usa l'app — una Luna piena con occhi grandi da cartone — tutti i volti sono
stati ridisegnati nello stesso stile:

- **gli occhi** sono più grandi (`occhi` di serie `{ r: 0.29, distanza: 0.4,
  alto: -0.08 }`, la Luna 0,31) e a **mandorla**: le due palpebre scendono e
  salgono verso gli angoli (`mandorla` in `storGeometria`), così gli angoli
  sono a punta e non c'è più l'ellisse tagliata che dava un occhio squadrato;
  da spalancati (la sorpresa) la mandorla si attenua, nel sorriso la
  palpebra di sotto non si alza agli angoli (resta la mezzaluna). La palpebra
  di sopra copre sempre un poco la cima dell'iride;
- **l'iride** quasi riempie l'occhio (0,78 della larghezza, al più 0,86): scura
  al centro, il suo colore, un anello chiaro al bordo coi fili, e l'ombra
  della palpebra che la scurisce dall'alto;
- **i riflessi**: una falce di luna e una stellina (sostituiti nella v418);
- **le ciglia**: la riga della palpebra di sopra è un tratto pieno che
  s'ingrossa verso fuori e per lei scappa in una **codina** all'insù
  (`rigaPalpebra`); per lei cinque ciglia arricciate a ventaglio sulla metà
  esterna, tre piccole sotto, e la piega della palpebra; per lui due corte;
- **sopracciglia** di lei sottili, alte e arcuate; **naso** di lei a goccia
  fatto d'ombra; un **neo** sotto all'occhio sinistro di lei; le **guance**
  hanno sempre le tre lineette sottili in diagonale;
- **il corpo**: un'ombra a falce dal bordo appena sfumato, i **crateri**
  piatti senza pennino (l'orlo chiaro, la conca in ombra; sulla Luna tutt'attorno
  al volto), il bordo panna fra due fili d'inchiostro.

**Gli occhi retrò (v418).** Su un secondo disegno di riferimento — la Luna
che guarda di lato, alla Betty Boop — gli occhi sono cambiati ancora:

- la **forma** la fanno le due palpebre (`angolo` in `storGeometria`): una
  cupola morbida sopra e una U sotto che si incontrano negli angoli, quello
  esterno a punta e quello verso il naso un poco più basso; l'occhio è più
  largo (`occhi` di serie `{ r: 0.33, distanza: 0.42, alto: -0.06 }`, la Luna
  0,345) e meno alto (`ry` 1,1 volte `rx` per lei);
- **l'iride** è un ovale piatto, alto, del suo colore, con una falce più scura
  in alto e il contorno d'inchiostro; occupa poco più di metà della larghezza
  (0,62), così può guardare di lato; la **pupilla** è un ovale nero che ne
  prende i tre quarti. Niente sfumature né fili;
- **i riflessi** sono un tondo grande in alto a destra e un puntino sotto (la
  falce di luna e la stellina della v417 sono uscite);
- **il bianco** è avorio; sopra all'occhio c'è un **ombretto lilla** piatto
  che sale verso l'angolo esterno (per lui appena accennato; il colore viene
  da `trucco`, se c'è); le **ciglia** di lei sono raccolte all'angolo esterno,
  cinque lunghe e arricciate sopra e tre sotto.

**Più chiari ed esagerati (v425).** Su un terzo disegno di riferimento — la
Luna piena sorridente, a contorni grossi — i tratti si leggono da lontano:

- **le espressioni** sono spinte più in là (`STOR_ESPRESSIONI`): sopracciglia
  che corrono di più (0,3 del volto per `alza`, 0,2/0,09 per `inclina`),
  sorpresa con occhi 1,4 e pupille piccole, rabbia e tristezza più inclinate,
  infastidito e bullo più storti; il volto di riposo (`neutral`) è un piccolo
  sorriso con le guance, non una riga. Gli occhi spalancati non si toccano mai
  (`rx` al più 0,9 della `distanza`), e le guance restano nel viso;
- **la bocca** è un terzo più grande e ha il contorno d'inchiostro pieno anche
  per lei (le labbra restano come colore);
- **gli occhi**: il bianco è bianco vero, l'iride scura in alto e luminosa in
  basso, il contorno di sotto è un tratto pieno, i riflessi più grandi (il
  puntino in basso a sinistra); per lei tre ciglia grosse sopra e una sotto,
  per tutti la riga della palpebra più spessa;
- **sopracciglia** di lei più spesse (0,062 del volto); **guance** ovali quasi
  piene, con le tre lineette solo nella contentezza piena (`guance` > 1,05);
  **niente naso né neo** per lei, come nel disegno.

**Le bocche che parlano con l'umore (v426).**

- **Si parla con la faccia dell'umore**: `storBoccaBersaglio(espr, forma)`
  (funzione pura, `StorieCosmiche.boccaBersaglio`) dà la bocca a cui tendere.
  A riposo è quella dell'espressione; sulle sillabe la larghezza sta a metà
  fra sillaba e umore, chi ha i denti (rabbia, ghigno) parla fra i denti e mai
  a O, chi trema (preoccupato, triste) trema anche parlando, chi sorride parla
  sorridendo. Fino alla v425 chi parlava aveva le cinque bocche del parlato e
  basta, e `mescolaBocca` perdeva i denti alla prima sillaba.
- **Le sillabe** sono più grandi (`STOR_BOCCHE.piccola|A|E|O`): chi parlava
  aveva la bocca più piccola di chi taceva. Il ritorno alla bocca di riposo,
  a fine frase o a un cambio d'umore, dura due fotogrammi
  (`STOR_TAU_BOCCA_CHIUDE`) invece di uno scatto.
- **Il disegno** (`disegnaBocca`, `bordiBocca`): il tratto è d'inchiostro pieno
  per tutti, le labbra di lei sono una velatura sotto alla riga (prima, chiusa
  e all'ingiù, era un grumo rosa); la bocca aperta è una «D» col fondo tondo,
  il labbro di sopra che trema con `onda`; la tristezza è una bocca aperta
  all'ingiù; i denti sono due file che seguono i bordi e si separano quando
  si parla, in un rettangolo dagli angoli tondi piegato all'ingiù (rabbia) o
  all'insù (ghigno). Sotto ai baffi la bocca scende (0,5 del volto invece di
  0,42), se no restava coperta.

Per guardarli tutti insieme basta una pagina con `storie-cosmiche.js` che
chiama `StorieCosmiche.ritratto(tela, id, espressione)` per ogni personaggio.

**I segni da fumetto** (§6-bis, `storDisegnaSegno`): scintille (happy,
excited), raggi della sorpresa, lacrima che scende (sad), goccia di sudore
(worried), bolle del pensiero (thinking), zeta del sonno (sleepy),
nuvolette dello sbuffo dall'angolo della bocca (annoyed), luccichio sul
dente del ghigno (bully, v422). Le zeta
sono tratti, non `fillText`: un segno, non una parola.

**Il corpo del volto** (`storPosa`, funzione pura): comparsa con un pop
elastico, respiro, rimbalzo della contentezza, tremito della paura, testa
inclinata, «boing» a ogni cambio d'espressione, schiacciamento sulle sillabe,
e occhiate brevi (saccadi) di chi sta fermo. Si muovono i tratti e l'adesivo,
mai l'astro. Col movimento ridotto non c'è niente di tutto questo.

## Come si muove la bocca

Solo la bocca di **chi parla** si muove, e solo mentre la voce suona davvero.
Chi parla lo dice `narrazione.voce()` (nuovo in `narrazione.js`), che porta il
`personaggio` della richiesta: `character_speak` chiama `narrazione.parla`
con `personaggio`, `chi: { nome, colore }` (il nome nel sottotitolo),
`sottotitolo: 'sempre'` e `testoSeSpenta: true`. Nessuna seconda pipeline: la
scala dei ripieghi (audio registrato → Edge-TTS → voce del dispositivo →
solo testo) è quella di sempre, e `narrazione.parla` ferma qualunque frase
prima di cominciare, quindi due voci insieme non esistono.

**Le voci registrate** (v418): ogni personaggio ha la sua cartella,
`audio/narrazione/storie/<nome>/<lingua>/`, con le battute che si chiamano
come la chiave (`storia_luna-1.mp3` per `demo.narr.storia_luna.1`).
`node scripts/voci-storie.js` legge le cartelle, scrive il blocco delle
storie nel manifest e `storie/COPIONE.md` (chi dice cosa, il nome del file,
lo stato); `--genera <nome>` le chiede a ElevenLabs. `storie/regia-voci.json`
(v419) dà il carattere di ogni voce e, per ogni battuta, l'emozione, come
dirla e il testo coi tag audio di ElevenLabs v3; tolti i tag deve tornare il
testo del dizionario, e lo script lo controlla. Chi parla lo sa dalle
storie stesse (`character_speak`), non dalla cartella. Cambiare voce a un
personaggio è cambiare i suoi file: niente codice. Tutto in
`audio/narrazione/LEGGIMI.md`.

`storBoccaDaSegnale(segnale, ritmo)` sceglie fra tre strade, nell'ordine:

1. **Ampiezza (Web Audio).** Per l'audio registrato e l'Edge-TTS, che passano
   dall'elemento audio condiviso. L'analizzatore si prepara dentro al gesto
   di avvio (`narrazione.preparaAnalisi()`, chiamata dal clic su «Avvia demo»,
   «Guarda la storia» o «Fallo parlare») e si collega solo a contesto in
   marcia: `createMediaElementSource` porta l'elemento nel grafo per sempre, e
   un grafo sospeso vorrebbe dire una voce muta. L'apertura segue il valore
   efficace (RMS); la vocale la dice il punto della frase (la posizione nel
   file sulla fila delle sillabe).
2. **Confini di parola del TTS.** La voce del dispositivo manda `onboundary`
   col carattere a cui è arrivata: la bocca va a quella parola, avanza col
   tempo dall'ultimo confine e non scavalca la fine della parola.
3. **Ritmo del testo.** La frase diventa una fila di sillabe (circa 0,19 s
   l'una, scalate sul `ritmo` della voce) e di pause — virgola 0,22 s, due
   punti 0,3, punto, ! e ? 0,42 — mappata sul tempo dall'inizio, o sulla
   frazione già letta quando c'è solo il testo. Dentro a una sillaba la bocca
   si apre e si chiude (mezza onda), sulla `a` fa la A, su `e`/`i` la E, su
   `o`/`u` la O; nelle pause è chiusa.

`parla` è falso in pausa, nell'attesa del ponte Edge-TTS, fra un pezzo e
l'altro e a frase finita: la bocca torna **subito** alla forma di riposo
dell'espressione, senza sfumare. Non è un lip-sync fonetico, ed è dichiarato:
è un movimento legato alla voce (alla sua ampiezza, alle sue parole, alla sua
punteggiatura), non un'animazione a caso.

## Le azioni del DSL

Tutte vivono nella **scena** in cui sono scritte: un personaggio compare con
`character_show` e se ne va a fine scena (se la scena dopo lo rimostra, resta
lo stesso — non rinasce e non riparte il battito — e prende l'espressione
della scena nuova). Le altre azioni vogliono il loro `character_show` nella
stessa scena. Con `shot_from` un'azione parte più avanti nella scena.

```
action: character_show { target: 'Saturn', expression: 'happy', look: 'Jupiter', size: auto };
action: character_expression { target: 'Saturn', expression: 'surprised', shot_from: 0.5 };
action: character_look_at { target: 'Saturn', object: 'Jupiter' };   // o 'viewer'
action: character_blink { target: 'Saturn', shot_from: 0.3 };
action: character_speak { target: 'Saturn', id: 'demo.narr.storia_giganti.1' };
action: character_speak { target: 'Saturn', text: 'Ciao! Sono Saturno.' };   // demo personali
action: character_hide { target: 'Saturn', shot_from: 0.9 };
```

| Azione | Parametri |
|---|---|
| `character_show` | `target`, `expression?`, `look?` (`viewer` o un oggetto), `size?` (`auto`, `disk`, `badge`, `real`), `at?` (v450, il posto di un ospite: `left`, `right`, `center`, `top`, `bottom`) |
| `character_expression` | `target`, `expression` |
| `character_look_at` | `target`, `object` (`viewer`/`camera` o un oggetto) |
| `character_blink` | `target` |
| `character_speak` | `target`, `id` (chiave del dizionario) **oppure** `text` (al più 400 caratteri) |
| `character_hide` | `target` |
| `character_move` (solo 3D) | `target`, `to` (un oggetto, o `orbit`, `center`, `left`, `right`, `top`, `bottom`), `side?` (`auto`, `left`, `right`, `above`, `below`, `front`, `behind`), `distance?` (0,3–6), `path?` (`arc`, `straight`, `hop`, `loop`, `spiral`, `zigzag`, `teleport`), `turns?` (0,5–8) |
| `character_return` (solo 3D) | `target`, `path?` |
| `character_animate` | `target`, `animation` (`jump`, `bounce`, `shake`, `nod`, `spin`, `pulse`, `dance`, `wobble`), `times?` (1–20), `strength?` (0,2–3) |
| `character_scale` | `target`, `scale` (0,2–6) |
| `character_become` (v414) | `target`, `shape` (`red_giant`, `white_dwarf`, `supernova`, `black_hole`, `self`) |
| `effect` | `type` (`explosion`, `shockwave`, `flash`, `sparkles`, `fireworks`, `smoke`, `hearts`, `lightning`, `shooting_star`, `glow`, `confetti`), `target?` (un oggetto) o `at?` (`center`, `left`, `right`, `top`, `bottom`), `size?` (0,2–5), `color?` (`'#rrggbb'`), `duration?` (secondi, 0,3–20) |
| `story_camera` (v416) | `mode` (`auto`, `wide`, `close`, dalla v431 `speaker`, `orbit`, dalla v452 `rhythm`), `target?` (con `close`, un personaggio in scena; con `orbit`, facoltativo), `zoom?` (1–4, il tetto del primo piano), `speed?` (v431, con `orbit`: gradi al secondo, −90–90, di serie 14) |
| `sound` (v416) | `type` (uno dei rumori di `STOR_SUONI`), `volume?` (0–2) |
| `story_question` (v430) | `text`, `a?`, `b?`, `kind?` (`who_is_right`, `probe`, `trust`, `explore`, `choice`, `prediction`, `next_star`), `from?` (chi la pone): §La domanda al pubblico |
| `story_music` (v440) | `src` (un file audio del sito, `audio/…` o `musica/…`, con un `?v=` facoltativo, oppure `off`), `volume?` (0–1, di serie 0,35): §La musica di sottofondo; dalla v450 `sync?` (`on`), `at?` (−30–3600), `loop?` (`off`), `bpm?` (30–240), `beat?`, `kick?` (0–3): §Le storie cantate; dalla v458 `sounds?` (`off`: con la canzone agganciata tacciono gli effetti sonori) |
| `character_sing` (v450) | `target`, `with?` (gli altri che cantano, separati da virgole), `id` **oppure** `text` (al più 240 caratteri), `words?` (v451: i tempi di ogni parola, `'0.00-0.21 0.21-0.35 - …'` in frazioni della ripresa), `voice?` (v452: l'intensità della voce, una cifra 0–9 ogni 40 ms della ripresa): il verso dura la sua ripresa |
| `story_photo` (v451) | `photo` (`pale_blue_dot`): la fotografia vera accanto alla scena, per la ripresa dell'azione |
| `story_title` (v450) | `id` o `text`, `sub_id?` o `subtitle?`: il titolo grande al centro, per la sua ripresa |

Dalla v416 `character_show`, `character_move`, `character_return`,
`character_animate`, `character_become` ed `effect` accettano anche
`sound` (`auto` di serie, `off`, o il nome di un rumore): §La regia e i rumori.

`size`: `auto` (di serie) nel planetario mette il volto sull'astro se c'è
posto e se no nell'adesivo; nella 3D **fa crescere l'astro** fino a portarlo.
`disk` lo mette sempre addosso, `badge` sempre nell'adesivo, `real` lascia
l'astro della sua misura vera (adesivo se è piccolo: era l'`auto` di prima
della v409).

Le azioni del corpo (`move`, `return`, `animate`, `scale`) durano la loro
**ripresa**: `shot_from`/`shot_to` dicono quando partono e quando arrivano (di
serie tutta la scena). Un viaggio finito resta dov'è — anche nelle scene dopo,
finché il personaggio è in scena — e segue la sua meta se lei si muove;
`character_return` lo rimette sull'orbita. `effect` non vuole un
`character_show` e non si taglia a fine scena: vive la sua durata.

`character_speak` vale come la narrazione della scena: la scena aspetta la
fine della battuta (`fineNarrazione`), come con `narrate`. **Una battuta per
scena**: due di fila nella stessa scena si fermerebbero a vicenda. Le voci
seguono pausa e ripresa della demo (una scena che si apre in pausa parla in
pausa), e un salto, un riavvio, Stop, Esc o un errore chiudono la scena e con
lei la voce e i personaggi; la promessa di una battuta interrotta non toglie
la parola a quella che le è subentrata (gettone in `storParla`) e non fa
ripartire niente (gettone di scena del motore).

**La validazione** avviene prima dell'avvio, con messaggi localizzati
(`demo.err.*`): personaggio sconosciuto, espressione sconosciuta (con
l'elenco delle ammesse), sguardo verso un oggetto sconosciuto, `size` non
valida, personaggio non mostrato nella scena, vista che non disegna
personaggi, parametro sconosciuto, battuta senza `id`/`text`, `id` che il
dizionario non conosce, testo troppo lungo.

Il registro si estende con `AstroDemo.registra` (`registraComandi`): il
motore non sa niente dei personaggi. L'editor offre gli snippet
`character_*` (pagina Demo → Dettagli avanzati).

## La vita delle stelle (v414)

Giganti rosse, supernove, nane bianche, buchi neri e bianchi. Cinque sagome
nuove (§I corpi), la famiglia `buco` (la pelle è un viola quasi nero, non
nero: i tratti d'inchiostro hanno l'alone color panna e così si leggono) e
cinque personaggi:

| Personaggio | Chi è | Dove sta |
|---|---|---|
| `Star7` (`Betelgeuse`) | la supergigante rossa nella spalla di Orione: lei, una vecchia diva | nel planetario sulla stella vera (è lo slot `Star7` di `SKY_STELLE`); nella scala cosmica al suo `luogo`, `betelgeuse`, a 548 anni luce |
| `supernova` | la supernova del 1054, oggi la nebulosa del Granchio con la sua pulsar: lei | solo nella scala cosmica, a `crab_nebula` (6500 anni luce) |
| `sirius_b` | Sirio B, la nana bianca, il «fratellino» di Sirio: lui | solo nella scala cosmica, con Sirio |
| `sgr_a` | Sagittario A*, il buco nero al centro della Via Lattea: lui, saggio, coi baffi spioventi | solo nella scala cosmica, a `galactic_center` |
| `white_hole` | il buco bianco: lui, allegro | da nessuna parte (`cosmo: 'idea'`) |

I due luoghi nuovi stanno in `COSM_LUOGHI_STORIE` (`scala-cosmica.js`), senza
un paletto disegnato sulla carta: un segno in più affollerebbe il quadro di
chi non sta guardando una storia.

**Il buco bianco non sta sulla carta.** Nessuno ne ha mai visto uno: esiste
nelle equazioni di Einstein. Una storia che lo mettesse in un punto della
carta vera direbbe una cosa falsa, quindi galleggia davanti alla carta, a
destra in alto, senza filo e senza freccia, e il suo corpo è disegnato a
tratteggio. Non viaggia e non si raggiunge (`demo.err.ideaFerma`); si può
guardare, e gli effetti lo trovano.

**Diventare un'altra cosa** (`character_become`, `STOR_VESTI`). Un
personaggio prende per un po' un altro corpo, col suo volto: il Sole coi suoi
baffi diventa una gigante rossa (gonfia fino a 1,8 volte), poi una nana
bianca (0,55). La veste arriva con le scintille e la «molla» del volto, e la
misura nuova ci arriva per tutta la ripresa (`shot_from`/`shot_to`). Resta
come un viaggio, anche nelle scene dopo, finché il personaggio è in scena o
finché `shape: self` non lo rimette com'era. Nel planetario e nella scala
cosmica un astro con la veste porta il corpo nuovo sopra di sé (non è più
l'astro che l'app ha disegnato); nella 3D il corpo si disegna dove l'app ha
messo l'astro, cresciuto o rimpicciolito.

**Il Sole fuori dal quadro** (v414). Appena partiti dalla Terra, nella scala
cosmica, il Sole è fuori dallo schermo ma largo migliaia di pixel: fino alla
v413 il suo volto andava sul bordo alla misura del disco vero, un occhio
gigante (succedeva anche nella «macchina del tempo»). Adesso chi è fuori dal
quadro porta sempre il suo corpo, con la freccia.

## Gli episodi

- **«La Luna ha perso un pezzo?»** (`storia_luna`, 85 s, otto scene). Roma,
  13 dicembre 2026, 18:30: Luna crescente al 18%, alta 18° a sud-ovest. La
  Luna, preoccupata, crede di aver perso un pezzo; la Terra la rassicura e la
  porta a guardarsi da fuori (banco Terra e Luna della 3D, distanze vere); il
  Sole spiega che illumina sempre metà di lei; undici giorni d'orbita vera,
  fino alla Luna piena del 24 dicembre, mostrano perché da qui la vediamo
  cambiare; la Luna passa da preoccupata a sorpresa a felice, e chiude di
  nuovo nel cielo di quella sera: «Sono sempre intera, anche quando sembro
  una fettina!».
- **«Giove e Saturno»** (`storia_giganti`, 47 s): la storia d'esempio, corta,
  che usa tutte le azioni. Da duplicare e modificare.
- **«Il cielo è una macchina del tempo»** (`storia_tempo`, 171 s, quattordici
  scene, v413). Un'idea sola, detta a passi: la luce è velocissima ma non
  istantanea, quindi **più si guarda lontano, più si guarda indietro**. Si
  parte sotto la stessa Luna del pilota (Roma, 13 dicembre 2026), si sale con
  il volo del planetario e poi la **scala cosmica** si allarga alla misura
  vera; la Luna fa da guida e fa le domande, e ogni astro risponde, al suo
  posto vero, con l'età della sua luce (il cartello la scrive): la Luna 1,3
  secondi, il Sole 8 minuti e 20 («se mi spegnessi adesso, ve ne
  accorgereste fra otto minuti»), la Voyager 1 quasi un giorno, Alfa
  Centauri 4 anni e 4 mesi, il centro della Via Lattea 26.000 anni («quando
  camminavano i mammut»), Andromeda 2,5 milioni («prima di voi esseri
  umani»), la luce più antica 13,8 miliardi. Il ritorno in un fiato fino
  alla Terra e l'atterraggio, e il congedo sotto la stessa Luna: «Il cielo è
  una vera macchina del tempo!». Senza audio registrato: parla con la voce
  di sintesi.
- **«Che fine fanno le stelle?»** (`storia_stelle`, 278 s, ventiquattro
  scene, v414). Roma, 13 dicembre 2026 alle 22: Betelgeuse è alta 41° a
  sud-est, la Luna è tramontata. Dalla spalla di Orione Betelgeuse chiama;
  il Sole ha quattro miliardi e mezzo di anni e si chiede che fine farà, e
  nella scala cosmica (con `center: sun`, così ogni luogo cade nel quadro) va a
  chiederlo: a Betelgeuse (supergigante rossa, «al posto del Sole arriverei
  oltre l'orbita di Marte», l'offuscamento del 2019-2020, la supernova entro
  centomila anni), alla supernova del 1054 (vista di giorno per ventitré
  giorni; la stella di neutroni grande come una città, trenta giri al
  secondo), a Sirio B (per esplodere serve una stella otto volte più pesante
  del Sole; una nana bianca pesa come il Sole ed è grande come la Terra, un
  cucchiaino pesa come due elefanti). Il Sole prova addosso il suo futuro —
  gigante rossa che inghiotte Mercurio e Venere, l'anello della nebulosa
  planetaria, la nana bianca — e torna sé stesso. Al centro della Galassia,
  Sagittario A*: quattro milioni di Soli, fotografato nel 2022, e «non sono un
  aspirapolvere» (un buco nero pesante come il Sole al suo posto non
  cambierebbe l'orbita della Terra). Poi il buco bianco, che ammette di
  essere un'idea. Il ritorno, l'atterraggio, e Betelgeuse sotto Orione: il
  ferro nel sangue e il calcio nelle ossa sono nati nelle stelle, «siamo
  tutti fatti di polvere di stelle». Voce di sintesi.
- **«Pallido puntino blu»** (`storia_puntino`, 248,5 s, diciassette scene,
  v450): la prima storia **cantata**, §Le storie cantate.

## Il corpo nello spazio (v409)

Prima i volti erano un adesivo appoggiato sul cielo vero. Chi scrive storie
ha chiesto il contrario: il personaggio è **l'astro stesso**, gli occhi e la
bocca stanno sul corpo 3D, e se la storia lo vuole l'astro vola dove serve.
`storie-cosmiche.js` §5-bis.

- **La misura** (`storRaggio3D`). Con `size: auto` l'astro cresce, con un
  pop elastico in 0,7 s, fino a un raggio di volto di `STOR_VOLTO_3D_PX`
  (27,5 px); un astro già grande non cresce. Poi la scala di
  `character_scale`, il battito di `pulse`, e il rimpicciolirsi del
  teletrasporto.
- **Il posto** (`storScena3D`). Un viaggio va da dove l'astro si trova
  (anche se era già spostato) a una meta: accanto a un altro astro, dal lato
  chiesto, alla distanza dei due raggi disegnati; o un posto dello schermo,
  alla propria profondità; o l'orbita vera. Il percorso aggiunge la sua forma
  sul piano dello schermo (`storPuntoViaggio`, funzione pura). Le animazioni
  `jump`, `dance`, `shake`, `nod` spostano l'astro vero; `spin`, `wobble` e
  lo schiacciamento girano e deformano il volto.
- **Pensato sullo schermo, fatto nello spazio.** La proiezione della 3D è
  ortogonale, quindi la terna dello schermo (`storAssiSchermo`: `ex` a
  destra, `su` in alto, `w` verso chi guarda) è una base ortonormale della
  scena e un pixel vale `1 / sol.scala`. Lo spostamento entra nella scena
  **prima** della proiezione: la profondità, le lune che seguono il loro
  pianeta, la fase, il nome e il dito che sceglie funzionano da sé, e la
  camera che segue un corpo lo segue anche in viaggio.
- **Il ritorno.** Quando la storia lascia un astro spostato o ingrandito, in
  0,75 s torna sull'orbita e alla misura veri (`storRitorno`), senza salti.
  Passando fra il sistema e il banco Terra e Luna le unità cambiano: si
  dimentica tutto e si riparte da dove ogni astro si trova (`storBanco3D`).
- **Il volto sulla sfera.** Nella 3D il volto è ritagliato sul disco
  dell'astro, scivola e si accorcia verso dove guarda (una testa che si gira)
  e prende **la luce del suo Sole**: si dipinge su una tela di passaggio e
  l'ombra, dal lato opposto al Sole e quanto vuole la fase vera, si stende
  solo sui tratti del volto (`conLuce`, `source-atop`). Si ferma a metà:
  un volto sulla notte di una falce deve restare leggibile.
- **Non si muove**: il Sole (è l'origine della scena), e niente nel
  planetario — lì le animazioni muovono il volto o l'adesivo, e
  `character_move` è un errore di validazione.

## Gli effetti speciali (v409)

`storie-cosmiche.js` §6-ter, `storDisegnaEffetto`. Nello stile dei volti:
stesure piatte e pennino d'inchiostro, e l'esplosione è il «KABOOM» a punte
dei fumetti (lampo, stella di fuoco, sassolini, onda d'urto, fumo), non una
palla realistica. Un effetto segue il suo astro mentre si muove, o sta in un
posto dello schermo; dura i millisecondi dell'orologio della storia (in
pausa si ferma), e le particelle escono da un dado seminato rifatto a ogni
fotogramma, quindi un salto indietro le ridisegna uguali. Il lampo
(`flash`) si accende una volta sola e i fulmini due, distanti: niente
sfarfallio. Col movimento ridotto ogni effetto è un alone che si accende e si
spegne. Aggiungere un effetto: una voce in `STOR_EFFETTI` (con la durata di
serie), un ramo in `storDisegnaEffetto`, `storie.effetto.<nome>` nei
dizionari.

## La regia e i rumori (v416)

Chi scrive storie ha chiesto una camera **viva**, per spiegare ai bambini le
dinamiche del cielo in modo giocoso: quando un personaggio parla la camera
gli va vicino e gli inquadra bene gli occhi, quando succede qualcosa va a
guardarlo, e ogni botto si sente. `storie-cosmiche.js` §7-ter e §7-quater.

**La lente** (`storLenteApri`/`storLenteChiudi`). Non è una seconda camera
astronomica: è una traslazione e una scala sul contesto della tela, che
`skyDisegna`, `solDisegna` (e `solDisegnaVicino`) e `cosmDisegna` aprono
all'inizio del fotogramma e chiudono subito dopo i volti, prima delle
scritte di servizio (la riga in basso della 3D, il righello e il racconto
del banco Terra e Luna, le letture e la riga della scala cosmica). Le camere
delle scene restano padrone di cosa si guarda; la regia sceglie il primo
piano. Una lente e non uno zoom vero perché nella 3D il volto ha già la sua
misura in pixel (uno zoom della scena non lo ingrandirebbe) e perché tutto
quello che si disegna è vettoriale: un volto a tre volte resta nitido. Le
tele dipinte una volta (le stelle, la Via Lattea) un po' si sgranano: per
questo il tetto è ×3,2 (`STOR_REGIA.zoomMax`). La finestra non esce mai
dalla tela (niente bordi vuoti), e le posizioni salvate per il dito e per le
prove (`ultimiDisegnati`, i corpi di `sol`) restano senza lente;
`StorieCosmiche.lenteSchermo(x, y)` dice dove un punto del disegno finisce
sullo schermo. I nomi dei corpi della 3D (`solEtichetta`) restano della loro
misura (`storLenteK`).

**Che cosa si inquadra** (`storRegiaInquadra`, funzione pura sullo stato),
in quest'ordine:

1. un effetto grosso appena cominciato (`STOR_REGIA.effetti`: l'esplosione,
   l'onda d'urto, i fuochi, il fulmine, i cuori, i coriandoli, la stella
   cadente), finché dura il suo momento;
2. il personaggio di `story_camera { mode: close, target }`;
3. chi parla: gli occhi vanno al 40% dell'altezza (sotto ci sono i
   sottotitoli) e il raggio del volto al 17% del lato corto. Se chi ascolta
   gli sta accanto e ci stanno tutti e due senza allontanarsi troppo, la
   camera li tiene insieme (il campo e controcampo dei cartoni: si vede lo
   sguardo che va da uno all'altro);
4. chi sta facendo qualcosa: un viaggio, un'animazione, una veste nuova
   (piano medio, che lo segue);
5. se no, largo: la camera della scena.

Finita una battuta il quadro resta ancora 0,9 s, poi si allarga. Il moto è
una **molla smorzata al punto giusto** (`molla`, ω = 4,4 rad/s) su zoom (in
logaritmo), centro e altezza degli occhi: arriva in un secondo, senza scatti
né rimbalzi, e passa da un personaggio all'altro con una carrellata. Si
ferma in pausa. **La scossa** (`storScossa`): esplosione, onda d'urto,
fulmine, fuochi e la veste `supernova` fanno tremare il quadro per meno di
un secondo (due seni sfasati che si spengono, con un 3,5% d'ingrandimento in
più perché il tremito non scopra i bordi).

**Tace** (dalla v434 non più col movimento ridotto, dove va solo più piano: §La camera che non sta mai ferma) quando la persona prende la camera
(`AstroDemo.cameraManuale`: fino alla scena dopo), con l'opzione «Storie
cosmiche: la camera va vicino a chi parla» spenta (`cameraStorie` nelle
opzioni delle demo), nell'anteprima della pagina e fuori dalle storie, e
nelle scene con `story_camera { mode: wide }`. `story_camera` vale per la
sua scena; la scena dopo torna `auto`.

**I rumori** (§7-quater, `storSuona`). Ogni effetto ha il rumore col suo
stesso nome, e i gesti hanno il loro: il «pop» di chi entra in scena la
prima volta, il boing di `jump`, `bounce` e del percorso `hop`, il fischio
dei viaggi, lo zap del teletrasporto, il giro di `spin`, il tremolio di
`shake` e `wobble`, il «ta-da» di `dance`, e per le vesti il gonfiarsi della
gigante rossa, il botto della supernova, il risucchio del buco nero, la
magia della nana bianca e del ritorno. In più `boing`, `whoosh`, `pop`,
`zap`, `magic`, `inflate`, `suck`, `wobble`, `spin`, `tada`, `ding`,
`drumroll`, `rumble` si suonano da soli col comando `sound`. Sono
**sintetizzati** con Web Audio (`RICETTE`: pochi oscillatori e un soffio di
rumore bianco filtrato ciascuno), niente file: l'app resta offline e il
suono è da cartone, come il disegno. Il contesto è quello della voce
(`narr.audioContesto`), e l'uscita passa da un compressore e arriva anche
alla presa del filmato (`narr.cattura`): un video registrato con l'audio ha
anche i botti. Sotto la voce di un personaggio i rumori si abbassano.
Tacciono con l'opzione «Storie cosmiche: effetti sonori» spenta
(`effettiSonori`), in pausa, fuori da una demo; lo stesso rumore non riparte
prima di un decimo di secondo (un salto di scena non fa una raffica), e Stop
o la fine della storia li sfumano (`storZittisci`). Aggiungere un rumore:
una ricetta in `RICETTE` e il nome in `STOR_SUONI`.

## L'aspetto da cartone, il corpo che parla e la camera viva (v427)

A schermo la sezione si chiama **CosmoStorie** (*CosmoStories*): sono
cambiati solo i testi dei dizionari, di `index.html` e delle guide; nel
codice i nomi restano `stor`, `storie.*`, `demo.scheda.storie`.

**Il cielo da cartone.** Mentre gira una storia (`AstroDemo.storia`, vero
per ogni demo con un'azione `character_*`, con o senza scritte;
`demoStoriaCinema()` in app.js) la 3D cambia aspetto, su un disegno di
riferimento chiesto da chi usa l'app (il Sole con l'alone rosa, il nastro
di sassi, il cielo viola):

- lo sfondo è `solSfondoStoria`: blu-viola sfumato senza bordi, nubi tenui,
  un pulviscolo fitto di stelle e qualche stella grande con l'alone, dipinto
  una volta su una tela fuori schermo (`SOL_CIELO_STORIA`, rifatta solo
  quando cambia la misura), più 46 stelle che scintillano. Si stende
  **prima** della lente della regia, con un poco di parallasse
  (`storLenteStato`), così non si sgrana in primo piano;
- il Sole ha un bagliore rosa-arancio largo (`solDisegnaAloneSole`);
- le fasce sono sassi grigi e tondi (`solDisegnaFasce`);
- tacciono tutte le righe della lezione: piano, orbite (anche di lune e
  stazioni), nodi, scie del Grand Tour, riga dello sguardo, fili a piombo,
  filo Terra–Luna, asse, bussola sera/mattina, scritte in basso; nel banco
  Terra e Luna raggi, piano, coni d'ombra, bersaglio, orbita, piombo,
  righello e racconto. Nel planetario si spengono i livelli `griglia`,
  `eclittica`, `traccia` ed `eventi` (se le opzioni della demo non li
  chiedono), e la fotografia dei livelli li riaccende alla fine.

**Il corpo di chi parla** (`storMotoParlato`, funzione pura). Chi parla
annuisce sulle sillabe, ondeggia, dondola la testa, si sporge verso chi
guarda e sottolinea le frasi con un saltello e lo schiacciamento
all'atterraggio, circa ogni 1,25 s (`STOR_COLPO_MS`, un poco diverso per
ognuno). `pg.energia` sale in un quarto di secondo e scende in mezzo, così
non ci sono scatti a inizio e fine battuta. Nella 3D lo spostamento muove
l'astro vero (`storScena3D`) e il corpo si gonfia appena sulle sillabe
(`storRaggio3D`); nel planetario muove il volto (`storPosa`, ultimo
argomento `corpoSiMuove`). Col movimento ridotto è fermo.

**La camera viva** (`STOR_REGIA`): lo zoom va un poco più lento del
carrello (`omegaZoom`), su una battuta la camera continua ad avvicinarsi
piano fino a +9% (`carrello`), in primo piano il quadro respira come una
camera a mano (`respiro`, sull'orologio della storia: in pausa si ferma),
passando fra due personaggi lontani si allarga a metà strada e si
riavvicina (`arco`), e chi parla guardando di lato va a un terzo del quadro
con lo spazio davanti allo sguardo (`terzi`).

## Lo stesso cielo dappertutto, e il cartello «Sei qui» (v429)

- **Il cielo da cartone in tutti gli ambienti.** Oltre alla 3D e al banco
  Terra e Luna, mentre gira una storia anche la **scala cosmica**
  (`cosmDisegna`) stende `solSfondoStoria` prima della lente, e tace la riga
  della scala, le letture e le orbite di pianeti e Luna. Nel **planetario**
  `skyDisegna` stende lo stesso cielo sotto a tutto (non con la fotocamera),
  e `skyDisegnaSfondo` ci mette sopra il colore vero trasparente quanto è
  buio (di giorno lo copre); le stelle vere sono quelle di un cielo di
  montagna (Bortle 2, `catMagnitudineVoluta`).
- **Il cartello del luogo** (`storDisegnaCartelloLuogo`, `StorieCosmiche.cartelloLuogo`;
  rifatto nella v430): solo il nome del luogo, piccolo e semitrasparente
  nell'angolo in alto a destra, per pochi secondi quando il luogo cambia
  (`STOR_CARTELLO`: entra in 0,4 s, resta 3,2 s, se ne va in 0,9 s). Nella
  v429 era un cartiglio grande con «Sei qui» sempre acceso, e chi guarda l'ha
  trovato troppo appariscente. Planetario: `storie.luogo.cielo`; 3D:
  `cosmo.pianeti.nome`; banco Terra e Luna: `cosmo.terraLuna.nome`; scala
  cosmica: `cosmo.<struttura>.nome` della struttura più vicina alla scala
  (`cosmStrutturaDellaScala`; fra due tappe resta l'ultima, `cosm.luogoStoria`).
  C'è anche con le scritte spente.
- **Il cielo si muove con la camera (v430).** Nella v427 il cielo da cartone
  era quasi fermo e, con le orbite spente, a chi guardava sembrava che la
  camera delle scene non si muovesse più (si muoveva: misurato fotogramma per
  fotogramma, uguale a prima). Ora `solSfondoStoria(ctx, L, H, cam)` ha due
  tele: il fondo con le nubi (parallasse leggera) e una piastrella di stelle
  senza cuciture che scorre con la camera — `solCameraCielo` dal giro e
  dall'altezza della 3D e della scala cosmica (dove sale anche attraversando
  le decadi), il puntamento `sky.manuale` del planetario — e si avvicina
  della metà dello zoom della lente della regia.

## Le orbite a richiesta e il Sole del banco più vero (v435)

- **Le orbite di chi è in scena** (v432) sono ancora più sottili (nastro di
  1,4 px, puntini di 1 px ogni 5, tutto più tenue) e **nascoste di serie**:
  si vedono solo con l'opzione «CosmoStorie: mostra le orbite» della pagina
  Demo (`orbiteStorie`, `demoOrbiteStorie()` in app.js, che
  `solTrattoStoria` chiede prima di disegnare). Chi guarda le storie le
  trovava ancora troppo presenti.
- **Il Sole del banco Terra e Luna** (`solDisegnaSoleVicino`) è più grande
  e più vero: 13 raggi terrestri invece di 6, a 1,36 orbite lunari invece di
  1,18 (il bordo vicino resta fuori dall'orbita della Luna), con lo
  scurimento al bordo, la granulazione fine, le macchie con la penombra, le
  facole, qualche protuberanza e la corona a pennacchi tenui, senza il
  contorno. È dipinto una volta su una tela fuori schermo
  (`solTelaSoleVicino`, rifatta solo quando il raggio cambia di gradino,
  al più `SOL_SOLE_TELA_MAX` px e poi ingrandita). Nelle storie in cui il
  Sole è un personaggio il suo corpo da cartone ci sta sopra come prima.

## La camera che non sta mai ferma (v434)

Chi scrive storie ha chiesto di nuovo che la camera «si muova, zoomi, sia
dinamica durante la riproduzione». Misurata fotogramma per fotogramma su
«Cosa è la gravità?» (la storia dello Studio sul repository) e su
`storia_luna`, la camera aveva tre modi veri di sembrare ferma:

- **col movimento ridotto era ferma davvero**, dal primo all'ultimo
  secondo: lente a 1, azimut costante. `prefers-reduced-motion` è acceso da
  «Effetti di animazione» spenti in Windows, da «Riduci movimento» in iOS e
  da «Rimuovi animazioni» in Android, e molti lo tengono così senza
  saperlo. Ora la regia non tace più (`regiaAccesa`): va più piano
  (`STOR_REGIA.ridottoMolla`, il giro a metà velocità) e senza scosse,
  respiro, arco, carrello e rollio; e in una CosmoStoria le camere delle
  scene viaggiano anche col movimento ridotto (`c.ridotto` è falso quando
  la demo è una storia, demo.js). Per fermare tutto resta l'opzione
  «Storie cosmiche: la camera va vicino a chi parla» (`cameraStorie`);
- **il giro della 3D andava avanti e indietro sul posto**: ogni
  `camera_3d` riparte dall'azimut di base della sua scena, e lo Studio
  scriveva `orbit: 8` per ogni battuta. Otto gradi, poi uno scatto indietro
  di otto. Ora `camera_3d` ha `orbit_from` (i gradi di giro da cui parte)
  e il copione dello Studio continua il giro da una battuta all'altra,
  `STUDIO_GIRO_AL_SECONDO` (4) gradi per ogni secondo di battuta (fra 6 e
  40), con l'elevazione che sale e scende fra `STUDIO_ELEV` (26°–62°)
  invece di tornare di colpo a 34°. La scena della domanda riparte da dove
  la camera è arrivata. Anche `storia_luna` e `storia_giganti` continuano il
  giro fra le scene della 3D. Misurato: la storia della gravità gira di
  165° in 42 s senza nessun passo indietro (prima 8° per battuta e ritorno);
- **fra due battute il quadro era fermo**: la lente tornava a 1 e restava.
  Ora il largo è il **piano d'insieme** (`storRegiaGruppo`, motivo
  `gruppo`): tiene tutti i personaggi disegnati, al più `gruppoMax` (1,35)
  volte, e gli si avvicina piano (`gruppoCarrello`, +12% in 10 s). Viene
  dopo i 0,9 s in cui il quadro tiene chi ha appena parlato. Misurato: la
  lente è oltre 1,05 il 96% del tempo della storia (prima si fermava a 1 fra
  ogni battuta e l'altra).

Prova: `prova-storie.js` («la camera non sta mai ferma…»).

## La regia che non si spegne più per sbaglio (v433)

Chi guarda le storie ha detto che lo zoom su chi parla «non funzionava
più». Nel browser di prova funzionava, ma c'erano tre modi veri in cui si
spegneva:

- **un gesto qualunque sulla camera** (un giro di rotellina, anche per
  scorrere la pagina, un trascinamento di sei pixel fatto cliccando, un
  tasto freccia) cedeva la camera fino alla scena dopo, e con lei la regia.
  Ora la regia tace solo mentre la persona muove la camera e riparte
  `STOR_REGIA.manoMs` (3,5 s) dopo l'ultimo gesto (`cameraInMano`,
  `AstroDemo.cameraManualeDa` in demo.js); le camere delle scene restano
  alla persona fino alla scena dopo, come prima. Il giro (`orbit`) si ferma
  e riparte con la stessa regola;
- **una voce che si rompe** (la sintesi del dispositivo che lancia un
  errore, un ponte che non risponde) faceva fallire subito la promessa di
  `narrazione.parla`, e `stor.parlante` si azzerava mentre il sottotitolo
  restava a schermo: niente zoom e bocca ferma. Ora `storChiParlaOra`
  chiede anche alla narrazione chi ha la parola nel canale delle demo; lo
  usano la regia e la bocca;
- **nel giro** chi parla non si avvicinava mai: ora la camera continua a
  girare e stringe su chi parla (`voltoStretto`), poi torna al giro largo.

In più le orbite delle storie sono più sottili (nastro di 3 px, puntini di
1,6 px ogni 6) e il segno da fumetto (le scintille) sfuma col volto quando
l'astro si gira di spalle. Prova: `prova-storie.js` («la regia riparte poco
dopo il gesto…»). Il volto girato è stato guardato nell'app a 0°, 45°, 90°,
135°, 180° e 270°: due occhi; uno intero e l'altro schiacciato sul bordo;
uno solo sul bordo; nessun tratto; nessun tratto; uno solo dall'altra parte.

## La pupilla da cartone (v437)

Dopo gli occhi tutti bianchi della v436 è tornata la pupilla, ma nello
stile del foglio: **un ovale pieno d'inchiostro**, un poco più alto che
largo, con un solo puntino di luce in alto; niente iride colorata, niente
anello. È più piccola dell'iride di prima (`pupilla × 0,72`) e corre più
lontano verso il bordo, così l'occhiata di lato si legge; la misura segue
l'espressione (minuscola nella sorpresa e nella paura, grande nella
tristezza). Il bianco, il contorno grosso, i cuori e le stelle restano
quelli della v436; lo scivolo dell'occhio intero verso lo sguardo è
ridotto a un accenno, perché adesso lo sguardo lo porta la pupilla.

## Gli occhi bianchi e il fuoco del Sole (v436)

Su un foglio di occhi da fumetto portato da chi usa l'app, gli occhi dei
personaggi sono **bianchi, senza iride, pupilla né riflessi**: l'umore lo
dicono la forma dell'apertura fra le palpebre, le palpebre storte, le
sopracciglia e la bocca. Il bianco ha soltanto l'ombra azzurrina della
palpebra di sopra; il contorno di sotto è grosso (`rx × 0,17`) come quello
del foglio, e l'occhio è un poco più piccolo (`× 0,86`), se no senza iride
faceva gli occhialoni. Lo sguardo resta: l'occhio intero scivola appena
verso dove guarda (`ctx.translate` in `disegnaOcchio`). Cuori e stelle
dell'amore e dell'entusiasmo restano, dentro al bianco. La geometria
(`iride`, `pupilla`, `luci`) è quella di prima, e le prove che la usano
(`pupillaDentro`) valgono ancora: semplicemente non si dipinge.

Il Sole (e ogni stella) ha perso gli archi delle prominenze e i raggi a
triangolo contornati d'inchiostro: al loro posto **il fuoco** (vedi «La
fisica dei personaggi»), sul modello del Sole sorridente dello stesso
foglio. La corona a raggi pallidi è più tenue.

## Le orbite di chi è in scena, il volto girato, la domanda facoltativa (v432)

- **Le orbite in stile cartone.** Nelle storie le righe della lezione
  tacciono (v427), ma chi guarda ha chiesto di vedere la strada di chi è in
  scena. Ora `solDisegna` disegna l'orbita dei pianeti e dei mondi minori in
  scena attorno al Sole (`solDisegnaOrbitaStoria`), `solDisegnaOrbitaLuna`
  quella della Luna attorno alla Terra, `solDisegnaLune` l'anello di una
  luna di un altro pianeta (`solDisegnaAnelloStoria`), e il banco Terra e
  Luna l'orbita della Luna (sopra al piano piena, sotto tenue). Lo stile è
  uno solo, `solTrattoStoria`: un nastro tenue del colore dell'astro
  schiarito (`solColoreStoria`) con sopra una fila di puntini tondi color
  crema, la metà dietro più tenue. Solo per chi è in scena (`storInScena`).
- **Il volto girato.** Quando la regia gira attorno (`orbit`, v431) il
  volto resta dov'era sulla sfera: `geom.yaw` = `regia.giro` nella 3D, nel
  banco e nella scala cosmica (non nel planetario, dove la camera non gira
  attorno, né col movimento ridotto). `storDisegnaVolto` mette ogni tratto
  alla sua longitudine (`storPosaSullaSfera`, pura): di lato un occhio solo
  e un pezzo dell'altro schiacciato sul bordo, da dietro nessun tratto, solo
  la nuca. Occhio e sopracciglio dello stesso lato vanno insieme; naso,
  bocca, barba e baffi con la bocca; vicino al bordo sfumano, e tutto è
  ritagliato sul disco.
- **I visi ritoccati**: iride un poco più grande (0,7 della larghezza
  dell'occhio, era 0,66), guance più tonde (0,86 × 0,54, erano 0,78 × 0,46),
  bocca un filo più stretta (1,2, era 1,3).
- **La domanda finale è facoltativa**: nello Studio la casella «Chiudi la
  storia con una domanda al pubblico» (`domanda.attiva`, spenta di serie;
  le copie salvate prima, che non hanno il campo, restano senza domanda).
  Accesa, valgono «Quando», «Che domanda» e «Chi la fa» come prima.
- **Il cartello del luogo** è più grande: 14–19 px (era 11–13,5).

Prove: `prova-storie.js` («il volto girato…», «la domanda finale…»).

## Il palco della 3D: prospettiva e nessuno sopra a un altro (v428)

`storPalco3D` (§7, chiamata da `storDisegnaSistema` prima dei volti), su
richiesta di chi guarda le storie:

- **la prospettiva**: la 3D è ortogonale e con `size: auto` tutti crescevano
  alla stessa misura di volto. Ora ognuno ha un fattore `pg.prosp`, come in
  una camera vera a `STOR_PALCO.camera` (1,8) volte il lato corto dello
  schermo: chi sta più avanti della profondità media dei personaggi
  (lungo `assi.w`) è più grande, chi sta dietro più piccolo, fra 0,62 e 1,6.
  Lo usa `storRaggio3D` (per `size: auto`) e la misura dei corpi disegnati
  di sonde e stazioni; scivola in circa 0,4 s;
- **nessuno copre un altro**: dal posto che ognuno avrebbe senza passi di
  lato, chi si tocca (contando gli anelli di Saturno, 2,3 raggi, e i corpi
  disegnati) si allontana a coppie per qualche giro; lo spostamento è il
  passo di lato `pg.scarto` (pixel dello schermo), a cui il personaggio
  scivola e che `storScena3D` mette nella scena prima della proiezione —
  così volto, profondità e lune lo seguono. Il Sole non si sposta: si scansa
  l'altro. Partendo sempre dal posto senza passi il risultato non oscilla, e
  torna a zero quando i due si allontanano da sé; uscendo di scena il
  personaggio torna sull'orbita anche dal passo di lato (`ultimoDelta`).

Nel planetario gli astri non si spostano: lì restano i dischi grafici
accanto (`storPostoDisco`), che già non si coprono.

**Chi sta davanti copre chi sta dietro (v438).** I volti si disegnano tutti
dopo i corpi della 3D, e prima nell'ordine d'entrata in scena: quando due
personaggi si sovrapponevano (durante lo scivolamento del palco, o un anello
di Saturno), il volto di chi stava dietro finiva sopra al disco di chi gli
passava davanti. Ora in `storDisegnaPersonaggi` i personaggi della 3D si
disegnano dal più lontano al più vicino (`vicinanza`), e a ognuno i dischi
più vicini alla camera che l'app ha disegnato (pianeti, Sole, Luna, lune,
stazioni: `storCoprentiDavanti`) tagliano via volto, corpo disegnato e
fisica (`ritagliaFuori`, un ritaglio `evenodd` per disco). L'adesivo accanto
col filo non si taglia: è un cartellino. Gli anelli veri di Saturno davanti
non tagliano (solo il disco). Prova in `prova-storie.js`.

**Chi trema non fa tremare il vicino (v439).** Il preoccupato fa `shake` (lo
Studio lo aggiunge di serie): il corpo va di qua e di là di un quarto di
raggio, sei volte al secondo. Il palco misurava il posto col tremito dentro e
a ogni fotogramma spingeva il vicino avanti e indietro con lui: tremavano tutti
e due, e la coppia ballava (nella prova, 392 pixel di avanti e indietro del
vicino in quattro secondi). Ora `storScena3D` lascia in `pg.oscilla` lo
spostamento dell'animazione e del parlato, `storRaggio3D` in `pg.kOscilla` il
loro gonfiarsi, e `storPalco3D` li toglie: il posto è quello da fermo. Per
tutta la durata di `shake` e `dance` chi si muove tiene in più l'aria del suo
movimento (`storAmpiezzaOscilla`), costante, così il vicino scivola via una
volta e resta fermo mentre l'altro trema senza toccarlo. Anche il tremito
del volto della paura va a otto colpi al secondo invece di diciassette, che a
sessanta fotogrammi saltavano a caso. Prova in `prova-storie.js`.

## Le stazioni in scena, e le scritte spente (v423)

**Le stazioni si vedono quando parlano.** Una storia che faceva parlare la
ISS (o Tiangong, o Hubble) nella 3D aveva la voce e non il corpo: la scena
grande disegna le stazioni solo con un TLE fresco, con le sonde accese e
con la Terra abbastanza grande per l'anello (`SOL_SAT_MIN_PX`), e il banco
Terra e Luna non le disegnava affatto. Ora:

- senza TLE (offline, o una storia ambientata lontano dal TLE) la stazione
  ha un'**orbita di riserva** (`solVersoreSatelliteRiserva`, `SOL_SAT_RISERVA`:
  inclinazione e quota vere, nodo fermo), marcata `riserva`, che si disegna
  solo per una storia che la ha in scena o per la camera puntata su di lei;
- una stazione in scena (`solSatDelRacconto`, cioè `storInScena`) si
  disegna anche con le sonde spente e con la Terra piccola (il pallino, senza
  anello), e a misure vere tiene almeno due pixel;
- il **banco Terra e Luna** ha le stazioni (`solSatellitiVicino`): attorno al
  globo disegnato, nella fila della profondità di Terra, Luna e Sole, con
  l'anello e il nome se c'è posto; fuori dalle storie seguono le sonde
  accese e il TLE. Quelle che parlano stanno ad almeno `SOL_SAT_STORIA_PX`
  dal bordo del globo sullo schermo e non si sovrappongono fra loro: a banco
  intero la Terra è un puntino e due corpi di settanta pixel la coprivano.
  Lasciano il posto in `sol.satSchermo`, che il modulo legge come nella
  scena grande.

**Le scritte spente.** L'opzione «Storie cosmiche: mostra nomi ed etichette»
della pagina Demo (`scritteStorie`, **spenta di serie**) decide se, mentre
gira una storia (una demo con almeno un'azione `character_*`), le viste
scrivono sulla tela. Spenta, `AstroDemo.senzaScritte` è vero e
`demoSenzaScritte()` (app.js) zittisce `solTesto`, `solEtichetta`, le
scritte dirette della 3D (bussola sera/mattina, «sei qui», «SOLE»),
`skyNomiVisibili`, `skyNomiCimeVisibili`, `skyScrittaConAlone`, le etichette
degli eventi e `cosmScritta` della scala cosmica; in più all'avvio si
spengono i livelli `nomi` e `cime`, che la fotografia dei livelli riaccende
alla fine. Restano i sottotitoli e il cartello della data, che sono della
storia. Prova: `node scripts/prova-stazioni-storie.js`.

```
action: story_camera { mode: close, target: 'Moon', zoom: 2.5 };
action: effect { type: explosion, target: 'Mars', sound: rumble };
action: character_animate { target: 'Jupiter', animation: jump, sound: off };
action: sound { type: drumroll, volume: 0.6, shot_from: 0.4 };
```

Nello Studio, in «Inquadratura e data», il menu **«Camera»** di ogni scena
(v431, prima era la casella «La camera va vicino a chi parla»): §La camera
scelta per ogni scena.

## La camera scelta per ogni scena: primo piano su chi parla e giro (v431)

Chi scrive storie ha chiesto una camera più dinamica: che zoomi su chi parla
e che, se serve, giri attorno al personaggio, scelta scena per scena.
`story_camera` ha due modi in più (`storie-cosmiche.js` §7-ter):

- **`speaker`**: sempre su chi parla, con un primo piano più stretto di
  `auto` (`STOR_REGIA.voltoStretto`, il raggio del volto al 22% del lato
  corto), senza campo e controcampo, e fra due battute resta su chi ha
  parlato per ultimo (`regia.ultimoParlante`) invece di allargarsi;
- **`orbit`**: la camera gira attorno a `target`, o se manca a chi parla, a
  chi c'era prima, al primo in scena; il volto è più piccolo
  (`giroVolto`, 13%) perché si deve vedere il mondo che gli gira dietro.
  `speed` in gradi al secondo (di serie 14, negativo nell'altro verso).
  **Nella 3D e nella scala cosmica il giro è vero**: `storRegiaGiro()` tiene
  un azimut in più sull'orologio della storia (prende e lascia la velocità
  in `giroAvvio` secondi, in pausa si ferma), e `solDisegna` (app.js) lo
  somma a `sol.az` e a `cosm.az`/`cosm.azVoluto` per il solo fotogramma
  (`solDisegnaFotogramma` è il disegno di prima). Così `camera_3d` e
  `cosmic_scale`, che riscrivono l'azimut a ogni fotogramma, restano padrone
  della loro posa; se durante il disegno qualcuno riscrive l'azimut vince
  lui. La lente tiene il personaggio al centro: girare attorno al perno e
  ricentrare su di lui è girare attorno a lui, perché la proiezione è
  ortogonale. Nel giro la molla del centro è più svelta (×2,2), se no il
  volto resterebbe indietro rispetto al mondo che gira. **Nel planetario**
  la camera sta per terra: il giro è il quadro che rolla piano
  (`giroRollio`, ±0,08 rad, ruotando attorno al punto dove la lente porta il
  soggetto: `regia.rot`, e `lenteSchermo` ne tiene conto) e scivola in
  cerchio attorno al personaggio (`giroCerchio`). Il giro si azzera quando
  la scena si chiude (il taglio di scena è lo stacco), si ferma dov'è con la
  camera presa a mano, e tace dove tace la regia (movimento ridotto,
  opzione `cameraStorie` spenta, anteprima).

Nello Studio il menu **«Camera»** della scena (`camera`: `auto`, `parla`,
`vicino`, `giro`, `ferma`; `studioRigaCamera`) e, per `vicino` e `giro`, il
menu **«Su chi»** (`cameraChi`: un personaggio in scena; vuoto vuol dire il
primo in scena per `vicino`, chi parla per `giro`). Le copie salvate prima
con la casella `cameraViva` spenta valgono `ferma`, e il menu tiene la
casella allineata. Prove: `prova-storie.js` («speaker resta stretto…, orbit
gira…», «la camera si sceglie per ogni scena»).

```
action: story_camera { mode: speaker };
action: story_camera { mode: orbit, target: 'Earth', speed: 20 };
```

## Lo Studio delle storie (v409, a figurine dalla v411)

`storie-studio.js` (prefisso `studio`), nella linguetta delle storie. Una
storia è un **progetto**: scopo, titolo, che cosa deve capire chi guarda,
personaggi, e **scene** (ambiente — Sistema Solare, un pianeta da vicino,
Terra e Luna, il cielo da casa —, inquadratura, giorno, giorni che passano,
chi è in scena) fatte di **momenti** (chi parla, la battuta, la faccia, la
durata) con le loro **azioni** (cambia faccia, guarda, vola verso, torna,
animazione, cambia misura, effetto, palpebre, esce; ognuna con il suo
«quando»: all'inizio, a metà, alla fine, per tutto il momento).

**L'interfaccia (v411).** Le scelte di tutti i giorni si fanno toccando un
volto o un bottone acceso/spento (`aria-pressed`), non aprendo un menu:

- in alto la barra: quale storia, «Nuova storia», **Guarda la storia**,
  «Salva nelle mie demo», e **Impostazioni** (dalla v449 un pannello a
  parte, vedi §Le impostazioni in un pannello a parte; prima il menu
  «Altro»);
- **1 · L'idea**: le storie pronte sono schede da toccare, con le figurine
  dei loro personaggi; sotto, titolo e scopo;
- **2 · Chi recita**: le figurine dei personaggi (col loro corpo e «lei» o
  «lui»), in tre gruppi — il Sole e i pianeti, le lune e i mondi piccoli,
  stazioni e sonde;
- **3 · Il copione**: ogni scena ha quattro bottoni per l'ambiente, le
  figurine di chi c'è, e «Inquadratura e data» chiusa (col riassunto su una
  riga). Ogni momento è una battuta a fumetto: le figurine di chi può
  parlare, la figurina grande con la faccia scelta accanto al fumetto, una
  fila di **facce da toccare** (undici volti di quel personaggio, coi nomi
  al femminile per lei), «Intanto» con le azioni come etichette (toccare
  apre i campi, × la toglie), le idee e un bottone per tipo d'azione. In
  fondo alla scena, **Scrivi a parole** (Invio applica a quella scena);
- **4 · Il controllo**: chiuso in una riga («tutto a posto» o «3 consigli
  per migliorarla»);
- **Diventa…** (v414) è un'azione come le altre: gigante rossa, nana bianca,
  supernova, buco nero o di nuovo com'era; a parole, «il Sole diventa una
  gigante rossa», «il Sole torna com'era» (la veste vince sulle parole del
  viaggio e della misura, che ne hanno in comune: «si gonfia», «torna»). Il
  modello **«Che cos'è un buco nero?»** (`buchi`): il Sole va a conoscere
  Sagittario A* e prova a diventare un buco nero («sei troppo leggero»), poi
  arriva il buco bianco, che è soltanto un'idea;
- **L'universo** (v412) è il quinto ambiente: la scena dice da quale tappa a
  quale va la camera («La camera va da… a…»), e il viaggio si divide fra i
  momenti con una curva morbida, così più battute di fila sono un volo solo
  (`studioViaggioCosmo`). Se in un momento qualcuno parte verso un luogo
  lontano, la camera di quel momento va a inquadrare la meta (le scale stanno
  in `STUDIO_TAPPE_COSMO` e `STUDIO_SEGNI_COSMO`, la stessa regola di
  `cosmLuogo`, per avere lo stesso copione anche senza la carta). Le mete,
  gli sguardi e gli effetti offrono i luoghi dell'universo; i personaggi
  dell'universo stanno solo nelle sue scene (`studioPresenti`). A metà di una
  scena dell'universo «Suggerisci il prossimo momento» scrive un **fatto
  vero** della tappa a cui la camera sta arrivando (`studio.fatto.*`: la luce
  del Sole in otto minuti e venti secondi, Andromeda vista com'era prima di
  noi, la luce più antica di 13,8 miliardi di anni);
- **La domanda finale** (v430), fra il copione e il controllo: quando, che
  tipo, chi la fa, o scritta a mano; §La domanda al pubblico.
- **5 · Guarda e salva**, di nuovo in fondo.
- **La data e il luogo a schermo** (v414): di serie non compaiono (il
  cartello `date_card` dice solo la sua scritta); in «Inquadratura e data» la
  casella «Mostra la data e il luogo» (`cartello` della scena) mette in ogni
  momento `date_card { date: show, time: show, place: show }`.

Le figurine sono dipinte una volta sola e tenute come immagini (`figurina`):
lo Studio ne mostra centinaia, e ridipingerle a ogni clic non serve.

- **Il copione** (`studioCopione`, funzione pura): un momento diventa una
  scena del DSL, perché il motore vuole una battuta per scena. La camera
  riprende da dove era (elevazioni continue), le facce si portano da un
  momento all'altro, i giorni che passano si dividono fra i momenti in
  proporzione alla durata (`date_range` senza buchi), la durata di serie è
  quella della battuta detta con calma più un respiro. Le azioni che la vista
  non sa fare (un viaggio nel planetario) si saltano, e il controllo lo dice.
- **I modelli per scopo** (`STUDIO_SCOPI`): libera, le fasi della Luna, i
  giganti, le stagioni, un viaggio fra i pianeti, un'avventura con effetti
  speciali e, nella scala cosmica (v412), «Quanto è grande l'universo?» (la
  Terra, la Voyager e la Via Lattea, dalla Luna all'universo osservabile:
  «siamo un puntino… ma un puntino che riesce a capirlo») e «Andromeda sta
  arrivando!» (lo scontro fra galassie in cui le stelle non si toccano:
  «due manciate di sabbia in uno stadio»). Ognuno è una storia intera, vera, che supera il suo stesso
  controllo; i testi (`studio.tpl.*`) si prendono nella lingua di adesso
  quando si sceglie il modello, e da lì sono di chi scrive.
- **Gli aiuti**: la faccia dalla battuta (`studioUmoreDalTesto`: parole
  dell'umore, poi punteggiatura), le idee per le azioni (dalle parole —
  «boom» → esplosione, «andiamo» → viaggio, «amici» → cuori — e dalla
  faccia), l'ambiente adatto a chi è in scena, il momento dopo (parla chi non
  ha appena parlato; la bozza presenta, risponde o ricorda lo scopo).
- **Scrivi a parole** (`studioCapisci` + `studioApplica`): una riga alla
  volta, «Marte vola verso Giove facendo un giro», «Giove dice: Benvenuto!»,
  «esplosione su Saturno», «la Luna è triste», «alla fine Saturno balla tre
  volte». Le parole chiave stanno nei dizionari (`studio.parole.*`, separate
  da virgole; con `*` in fondo sono radici) e valgono **tutte le lingue
  insieme**. Una battuta apre un momento nuovo, le azioni vanno nell'ultimo;
  chi viene nominato entra nel cast.
- **Il controllo dello scopo** (`studioConsigli`): titolo, scopo scritto,
  tutti parlano, si apre con una domanda, l'ultima battuta torna sullo
  scopo, battute sotto le 25 parole, durata fra 30 s e 4 minuti, nessun
  viaggio nel planetario, nessun momento vuoto, copione valido; e dalla v412
  le due cose che fanno ricordare una storia: **l'emozione** (qualcuno
  cambia faccia) e **la meraviglia** (un numero vero o un confronto:
  `studio.parole.meraviglia`).
- **Salvare**: i progetti in `astrocal_storie_progetti_v1` (esporta e
  importa in JSON, `studioRipulisci` tiene solo quello che il modello
  conosce); «Salva nelle mie demo» mette il copione nella libreria delle demo
  (`demoPaginaRicarica` rifà l'elenco senza buttare un testo che si sta
  scrivendo nell'editor). Né i progetti né le demo personali sono nel backup
  JSON dell'app.
- **Le voci delle storie dello Studio** (v421): «Salva nelle mie demo» e
  «Elimina» rifanno la fotografia delle battute delle storie salvate
  (`astrocal_storie_voci_v1`, `studioVociStoria`) e il file
  `audio/narrazione/storie/storie-studio.json` (`studioFileVoci`): scritto da
  solo nella cartella collegata (File System Access, la maniglia in
  IndexedDB `astrocal-studio-voci`) o scaricato da «Impostazioni →
  Questa storia → File delle voci». Ogni momento che parla ha un numero fisso (`voce`, col contatore
  `voceProssima`) e la storia un nome fisso (`voceChiave`, `studio_<titolo>`):
  le battute sono `studio.<nome>.<n>`, i file `<nome>-<n>.mp3`.
  `scripts/voci-storie.js` le mette in copione, regia (di partenza, dalla
  faccia) e manifest (col `testo`, perché la narrazione le riconosca dal
  testo: il copione le dice con `text`, non con un ID), e toglie le battute
  sparite con la loro regia e i loro audio. **Una voce per battuta**
  (v422): «Voce → Carica la voce» sotto al fumetto misura il file
  (`misuraDurata`), lo tiene in IndexedDB (scaffale `audio`, chiave
  `<progetto>|<numero>`), lo registra nella narrazione per testo
  (`narrazione.voceLocale`, che vince sul manifest) e mette in `audio` del
  momento durata e impronta del testo: `studioDurata` dà allora la voce più
  0,6 s (mai meno di una durata scritta a mano), e azioni e giorni, che sono
  frazioni della scena, restano a tempo. Con la cartella collegata
  l'audio si scrive anche in `storie/<personaggio>/<lingua>/`. Istruzioni in
  `audio/narrazione/LEGGIMI.md`; prova `scripts/prova-voci-studio.js`.
  **Registrata col microfono** (v441): accanto a «Carica la voce» c'è
  «Registra» (solo dove ci sono `MediaRecorder` e `getUserMedia`): lo stesso
  tasto diventa «Ferma (n s)» e la registrazione finita (webm, o m4a su
  Safari) fa la strada di un file caricato (`caricaVoce`). Una registrazione
  alla volta, al massimo `STUDIO_REGISTRA_MAX` (90) s; aprire un'altra
  storia o avviare la prova la ferma, e quella di una storia lasciata si
  butta (`registraDalMicrofono`, `fermaRegistrazione`).
- **Le storie sul repository** (v424, §6b di `storie-studio.js`): le storie
  salvate nelle demo stanno anche nel repository GitHub, in
  `storie-studio/storie.json` (`studioFileCondivise`), e ogni dispositivo le
  legge all'avvio dall'API dei contenuti (senza token, con
  `raw.githubusercontent.com` di riserva) e le mette fra progetti e demo
  (`libreria.metti`, la demo tiene la sua chiave). Scrivere vuole un token
  fine-grained («Contents: Read and write») in «Impostazioni → Sincronizza»
  (`astrocal_storie_repo_v1`, fuori dal backup). «Salva nelle mie demo»,
  «Elimina», «Sincronizza ora» e ogni audio caricato in una storia salvata
  fanno un giro: leggi, unisci (`studioUnisci`: vince `aggiornato` più
  recente; un'eliminazione lascia una lapide in `eliminati`,
  `astrocal_storie_eliminati_v1`), e un commit solo con API Git (blob,
  albero, commit, ramo; un ramo andato avanti fa riprovare) con le storie, il
  file delle voci e gli audio caricati, ognuno in
  `audio/narrazione/storie/<personaggio>/<lingua>/` (solo quelli che non ci
  sono già uguali, per SHA del blob; al massimo 40 MB per giro). Il workflow
  delle voci e la pubblicazione li mettono nel manifest: dopo il deploy
  suonano dappertutto. Le bozze mai salvate restano sul dispositivo.
  `studioRipulisci` tiene gli id di scene, momenti e azioni, perché la stessa
  storia riletta sia lo stesso file. Prova `scripts/prova-storie-repo.js`
  (due dispositivi e un GitHub finto).
- L'interfaccia si costruisce col DOM (mai `innerHTML`: i testi sono di chi
  scrive); i campi di testo aggiornano il modello senza ridisegnare, così il
  clic sul bottone accanto non si perde.

### La scena e il momento in linguette (v446)

Una scena aperta mostrava tutto insieme: i cinque ambienti, il cast, la
musica, le voci, l'inquadratura chiusa a metà; e ogni battuta chi parla,
tredici facce, la riga della voce, le azioni, le idee e tredici bottoni
«+ …». Con sei battute la scena era un muro. Ora (`disegnaScena`,
`disegnaMomento` in `storie-studio.js`):

- **la scena** ha in cima i tasti (prova, sposta, togli) e quattro
  linguette — *Dove*, *Chi c'è*, *Camera e data* (*Data* nell'universo),
  *Musica e voci* — ognuna col suo stato in piccolo; se ne apre una sola
  per scena (`schedeScena`, per progetto e scena), di serie nessuna.
  L'ambiente sta in *Dove*, col pianeta, il soggetto del planetario, il
  viaggio cosmico e «Suggerisci un posto»; le voci ElevenLabs della scena in
  *Musica e voci*;
- **i momenti** chiusi sono una riga sola (`apriMomento`): numero, volto con
  la faccia, nome, parole, e in piccolo faccia, «con la voce», quante azioni.
  Se ne apre uno per scena (`momentiAperti`); «Aggiungi momento» e
  «Suggerisci il prossimo» aprono quello nuovo;
- **il momento aperto** ha chi parla, il fumetto e tre linguette: *Faccia*,
  *Voce e durata* (la riga della voce e i secondi, prima in testa), *Cosa
  succede*. La linguetta aperta (`studio.schedaMomento`) vale per tutte le
  battute: chi sistema le facce una dopo l'altra la ritrova aperta;
- **i tipi di azione** stanno in quattro famiglie
  (`STUDIO_FAMIGLIE_AZIONI`): il volto, il movimento, la forma, effetti e
  suoni; un tipo nuovo che non è in nessuna finisce negli effetti.

Le prove che toccano lo Studio aprono prima la linguetta giusta
(`apriLinguetta`, `apriSchedaScena` in `prova-elevenlabs-studio.js`);
`prova-storie-sezioni.js` controlla linguette e momenti, desktop e telefono.

### L'idea e chi recita in linguette (v447)

Lo stesso stile anche per i passi 1 e 2 (`disegna`, `storie-studio.js`):
«L'idea» ha due linguette, *Storia pronta* (le schede delle idee) e *Titolo e
obiettivo*; una storia senza titolo la apre già sull'idea (`schedeIdea`, per
progetto, decisa una volta: scrivere il titolo non la richiude). «Chi recita»
mostra in cima chi è nella storia, piccolo e con la × (`studio-cast-chip`,
mai l'ultimo), poi una linguetta per famiglia con quanti sono scelti e i loro
volti, e una per le voci ElevenLabs (`schedeCast`); `apriScelta` su un
personaggio apre quella delle voci, perché la scelta si veda.

### Le schede delle storie pronte (v448)

Anche l'elenco della linguetta CosmoStorie (`storRiempiPagina`,
`storie-cosmiche.js`) prende lo stile dello Studio: ogni scheda ha titolo,
durata, i volti dei personaggi (`storFigurina`, dipinti una volta), tre righe
della trama e due linguette, *La trama* (la toglie dalle tre righe) e
*Personaggi (n)* (l'elenco coi caratteri e i perché, `hidden` di serie ma nel
DOM, che `prova-storie-browser.js` conta). Se ne apre una per scheda.

## «Vicino a un pianeta» che si distingue dal Sistema Solare (v442)

Nello Studio le due scene 3D sembravano la stessa cosa. «Vicino a un
pianeta» su Giove, Saturno, Urano o Nettuno scriveva `camera_3d { scene:
system, focus: 'Jupiter' }`, e per i fuochi lontani la base dello zoom mette
**il Sole sul bordo del quadro** visto dal pianeta: mezzo Sistema Solare col
pianeta al centro, i volti piccoli quanto nella scena «Il Sistema Solare».
Solo la Terra (`solZoomSullaTerra`) si avvicinava davvero.

Ora lo Studio aggiunge `close_up: show` (demo.js, `zoomAddossoA`): il
pianeta è grosso come la Terra quando ci si entra, col suo seguito di lune,
e la camera gli gira intorno; l'inquadratura della scena (lontano, normale,
vicino) moltiplica da lì. Misurato nel browser col modello «giganti»: Giove
con R 38–45 px nel Sistema Solare, R 94–129 px vicino a lui; Saturno con gli
anelli che riempiono il quadro. Nello Studio la scelta del pianeta sta
accanto all'ambiente (non più nei dettagli chiusi) e sotto ai bottoni una
riga dice che cosa si vedrà (`studio.ambienteNota.<ambiente>`,
`studio.qualePianeta`).

## La musica di sottofondo (v440)

Una storia può avere una **traccia per tutta la storia** e ogni scena può
tenerla, averne **una sua** o stare in **silenzio**. Nel copione è il comando
`story_music { src, volume }` (`storie-cosmiche.js` §8): la musica suona in
ciclo e **continua** finché un altro `story_music` non la cambia, quindi una
traccia che va da una scena all'altra non ricomincia (lo Studio la chiede solo
all'inizio delle scene in cui cambia), e una lasciata per un'altra riprende da
dove era. Mentre suona la colonna sonora generale delle demo resta in pausa
(`musicaDemoSospendi` in `app.js`); sotto la voce di un personaggio si abbassa
(`STOR_MUSICA_SOTTO_VOCE`, la vigilanza `musicaVigila` ogni 120 ms); con
«Musica nelle demo» spenta non suona; Stop, Esc, la fine o un errore la
spengono (`storMusicaFerma` dal ripristino di `demo.js`, e la vigilanza se la
demo non è più in corso). `src` è un file dello stesso sito (`audio/…` o
`musica/…`, niente `..`, niente indirizzi esterni) oppure `off`.

**Nello Studio** (§4-ter e §6 di `storie-studio.js`): la riga «Musica della
storia» in cima al copione e la riga «Musica» di ogni scena (`disegnaMusica`):
un menu (nessuna, quella della storia, il silenzio, le tracce dell'app di
`ASTRO_TRACCE_MUSICALI`, il file caricato), «Carica un file», «Ascolta», il
volume e «Togli la musica». Nel modello: `progetto.musica` e, per scena,
`musicaModo` (`storia`, `propria`, `silenzio`) e `musica`, con
`{ tipo: 'catalogo', id, volume }` o `{ tipo: 'file', nome, est, sha, durata,
volume }` (`studioPulisciMusica`). Un file caricato (al massimo 20 MB) fa la
**stessa strada delle voci**: resta in IndexedDB (`astrocal-studio-voci`,
scaffale `audio`, chiave `<progetto>|musica|<id della scena o «storia»>`),
suona subito su questo dispositivo col percorso che avrà sul sito
(`StorieCosmiche.musicaLocale`, che vince sul file pubblicato), e con la storia
salvata nelle demo va sul **repository nello stesso commit** delle storie e
delle voci (`fileDaScrivere`), in `audio/storie-musica/<id del
progetto>/storia.<est>` o `scena-<id della scena>.<est>` (`studioPercorsoMusica`).
Il copione lo chiede con `?v=` e i primi dieci caratteri dello SHA del blob
git: una traccia sostituita ha un indirizzo nuovo e la cache non fa sentire la
vecchia. Nello stesso giro si **tolgono** dal repository i file di
`audio/storie-musica/` che nessuna storia salvata usa più (una traccia
sostituita o tolta, una scena o una storia eliminata); un file caricato da un
altro dispositivo, che qui non c'è, resta, perché una storia lo vuole
(`studioMusicheVolute`). Dopo il deploy suona dappertutto. La cartella
collegata del «File delle voci» non riceve la musica: il file sta in
`audio/narrazione/storie/`, la musica fuori. Prova `scripts/prova-musica-storie.js`.

## Voci, suoni e musica con ElevenLabs (v444)

Lo Studio parla con le API di ElevenLabs direttamente dal browser (§6c di
`storie-studio.js`), senza passare dal terminale (`scripts/voci-storie.js
--genera`, che resta per le storie pronte).

- **La chiave**: Impostazioni → **ElevenLabs**. Si incolla la chiave API (su
  elevenlabs.io: Developers → API Keys), si sceglie il modello (Eleven v3,
  di serie, legge la faccia come tag di regia; Multilingual v2; Flash v2.5)
  e la recitazione (stabilità 0 / 0,5 / 1). «Salva e verifica» la prova
  chiedendo i crediti (`/v1/user/subscription`). Resta in questo browser
  (`astrocal_elevenlabs_v1`), **non** va nel backup né nel repository e parte
  solo nell'intestazione `xi-api-key` verso `api.elevenlabs.io`. Meglio una
  chiave solo per lo Studio, coi permessi giusti e un tetto di crediti.
- **Le voci dei personaggi** (passo 2, sotto il cast): una riga per
  personaggio con la voce scelta, «Anteprima», «Scegli la voce», «Genera le
  mancanti (n)», «Togli». «Scegli la voce» apre la ricerca: libreria pubblica
  di ElevenLabs (`/v1/shared-voices`) o «Le mie voci» (`/v2/voices`), in
  italiano e del genere del personaggio di serie (`profilo(id).genere`), con
  parole da cercare e «Altre voci». Per ogni voce: «Anteprima» (il campione
  di ElevenLabs, gratis), «Prova» (dice la prima battuta del personaggio,
  consuma crediti), «Questa». Una voce della libreria si aggiunge all'account
  (`/v1/voices/add/...`) perché l'API la possa usare. La scelta sta nel
  progetto (`voci`, va col repository) e diventa quella di serie per le
  storie nuove (`astrocal_storie_voci_pg_v1`).
- **Le battute**: accanto a «Carica la voce» e «Registra» c'è **«Genera»**
  (`generaVoce`): il testo va col tag della faccia del momento
  (`ELEVEN_TAG_UMORE`, gli stessi di `voci-storie.js`; un tag scritto a mano
  in testa alla battuta vince; coi modelli non v3 i tag si tolgono). Arriva
  una **proposta** che parte in ascolto: «Ascolta», «Usa questa», «Rifai»,
  «Scarta». «Usa questa» la passa a `caricaVoce`, la stessa strada di un
  file caricato (IndexedDB, narrazione, durata del momento, repository).
  «Genera le mancanti» fa tutte le battute del personaggio senza voce valida
  e sincronizza una volta sola alla fine.
- **I suoni**: un'azione nuova, **Suono** (`suono`), con il quando come le
  altre. È un rumore sintetizzato del motore (`STOR_SUONI`) o un file:
  caricato, o generato da una descrizione e una durata facoltativa
  (`/v1/sound-generation`), con la stessa proposta. Il file sta accanto alla
  musica, `audio/storie-musica/<progetto>/suono-<azione>.<est>`, e il copione
  lo chiede con `sound { src: 'audio/…?v=<sha>', volume, shot_from }`: il
  comando `sound` del motore accetta ora `src` oltre a `type`
  (`storSuonaFile`, suona dal blob locale finché il file non è pubblicato,
  tace con gli effetti sonori spenti, si ferma con lo Stop).
- **La musica**: sotto la musica della storia e di ogni scena, una
  descrizione e i secondi (10–300) e «Genera» (`/v1/music`); «Usa questa» la
  passa a `caricaMusica`.

Un lavoro alla volta (`lavoro`): il tasto dice «Genero…» e gli altri
aspettano. Gli errori (chiave, crediti, piano che non permette le voci della
libreria o la musica via API, troppe richieste) finiscono nella riga
dell'esito. Prove: `node scripts/prova-elevenlabs-studio.js` (nel browser,
con un ElevenLabs finto), `node scripts/prova-musica-storie.js` (il comando
`sound` con `src`, l'azione Suono sul repository, le funzioni pure).

### La voce per scena e la scelta che si apre sul posto (v445)

«Scegli la voce» sembrava non fare niente: dalla battuta il pannello si
apriva al passo 2, fuori vista, e ogni messaggio (anche gli errori di
ElevenLabs) finiva solo nella riga in cima allo Studio; se poi l'aggiunta
della voce della libreria all'account veniva rifiutata (chiave senza il
permesso Voices: scrittura, piano), la scelta spariva in silenzio.

- La scelta si apre **dove si preme** (`apriScelta(id, { luogo, scena,
  ambitoLibero })`): nella riga del personaggio al passo 2, nelle voci della
  scena, sotto la battuta. Da una battuta un menu dice se la voce vale per
  tutta la storia o solo per quella scena.
- I messaggi stanno accanto al tasto (`notifica`, `notaEl`, `studio.elMsg`).
- Un'aggiunta rifiutata non perde la scelta (`elevenAggiungi` dà
  `{ id, avviso }`): si tiene l'ID della libreria e si dice perché.
- **Voci in questa scena** (in ogni scena, con la chiave): chi parla lì, con
  la voce della storia o una sua (`scena.voci`), «Cambia solo qui», «Come
  nella storia», «Genera le mancanti» della scena. `studioVoceDi(p, id,
  scena)` sceglie scena → storia → di serie.
- Ogni audio generato ricorda la voce (`audio.voce`): se la voce del
  personaggio in quella scena cambia, la battuta è «da rifare»
  (`studioVoceDaRifare`), lo dice la riga della voce e «Genera le mancanti»
  la rifà.

### L'intonazione della battuta: la faccia mentre parla e il tono (v449)

A ElevenLabs (modello v3) andava come tag soltanto la faccia scelta **nel
momento** (`m.umore`). Una battuta lasciata «di serie», detta con la faccia
rimasta da un momento prima o cambiata da un'azione «Faccia» all'inizio
partiva senza tag e usciva piatta, mentre a schermo il volto rideva o
piangeva.

- `studioFacciaParlata(progetto, m)` fa lo stesso conto del copione: la
  faccia del momento, se no quella di un'azione «Faccia» sul personaggio
  all'inizio (o per tutto) il momento, se no l'ultima avuta prima nella
  storia (anche nelle scene prima, anche data da un'azione di un altro
  momento), se no quella di serie del profilo. `ELEVEN_TAG_UMORE` la
  traduce nel tag (`neutral` non ne ha).
- **Il tono** (`m.tono`, al massimo `STUDIO_TONI_MAX` = 2 fra
  `STUDIO_TONI`: whispers, shouts, sighs, gasps, laughs, crying, curious,
  sarcastic) si aggiunge dopo la faccia: `[sad] [whispers] Psst!`. Al
  terzo scelto esce il più vecchio. Ripulito in `studioRipulisci`.
- `studioTestoPerVoce(m, modello, progetto)`: i tag scritti a mano in testa
  alla battuta vincono ancora; senza v3 si manda il testo nudo.
- Nella linguetta **Voce e durata**, sotto «Genera», il riquadro
  **Intonazione** (`disegnaIntonazione`): l'emozione con la figurina e il
  suo tag, i bottoni del tono e il testo esatto che parte («Va a
  ElevenLabs: …»); col modello che non legge i tag lo dice. Nella
  linguetta «Faccia» una riga ricorda che la faccia è anche l'emozione
  della voce.
- L'audio generato ricorda i suoi tag (`m.audio.tag`, `studioFirmaTag`):
  se faccia o tono cambiano dopo, `studioTonoCambiato` lo segna «Generata
  con un'altra intonazione» e la battuta entra fra le mancanti. Gli audio
  caricati o registrati non hanno `tag` e non si toccano.

### Le impostazioni in un pannello a parte (v449)

«Altro» era un menu a tendina con dieci tasti uguali in fila (Duplica,
Esporta, Importa, copione, file delle voci, Repository GitHub, Sincronizza,
ElevenLabs, Elimina) e i pannelli del repository e della chiave si aprivano
sotto la barra senza dire dove si era. Ora il tasto **Impostazioni**
(ingranaggio, `data-fai="impostazioni"`) apre `#studio-impostazioni`
(`pannelloImpostazioni`), con tre linguette e lo stato in piccolo
(`STUDIO_SCHEDE_IMP`, `studio.impScheda`):

- **Questa storia**: «Portarla altrove» (Esporta, Importa, Duplica) e «Per
  chi scrive» (copione, file delle voci), ogni tasto con una riga che dice
  cosa fa; **Elimina** in fondo, a parte, sotto una linea.
- **Sincronizza**: a che punto è (collegato col token o solo lettura, con
  repository e ramo), «Sincronizza ora» e il collegamento (`pannelloRepo`).
- **ElevenLabs**: lo stato e la chiave (`pannelloEleven`).

«Collega ElevenLabs» al passo 2 (`elPannello`) e `repo` aprono il pannello
sulla loro linguetta e lo portano in vista (`apriImpostazioni`). Testi in
`studio.imp.*`. Prove: `prova-elevenlabs-studio.js` (13),
`prova-musica-storie.js` (12).

## Le storie cantate e gli ospiti (v450)

Chi usa l'app ha portato una canzone — «Pallido puntino blu», un rap di
4'08" sulle parole che Carl Sagan scrisse nel 1994 sulla fotografia della
Terra fatta dalla Voyager 1 il 14 febbraio 1990 — e ha chiesto una
CosmoStoria che la segua: i personaggi che la cantano, gli effetti speciali,
la camera che si muove come in un video rap, le Voyager, e Carl Sagan stesso
fra i personaggi, disegnato nello stile dei pianeti su un ritratto da cartone.

**La canzone agganciata** (`story_music { sync: on, at, loop: off }`, §8). Il
motore delle demo dice da quanto gira la storia (`Motore.tempoDemo`, esposto
come `AstroDemo.tempo`: le scene finite più quanto è passato in questa, fermo
in pausa). Ogni scena ripete `story_music` con `at`, il punto della canzone in
cui comincia: la canzone dove deve essere è `at` più il tempo passato dalla
scena (`storTempoCanzone`). Ogni 120 ms (`musicaAggancia`) la musica vera ci
viene riportata: prima di 0 aspetta ferma all'inizio (la prima scena ha
`at: -1.5`, un secondo e mezzo per caricare il file), in pausa si ferma con la
demo, finita tace; uno scarto grande (oltre `STOR_MUSICA_SCARTO`, 0,6 s: un
salto di scena, la scheda tornata davanti) è un salto, uno piccolo si
recupera con `playbackRate` fra 0,94 e 1,06, che non si sente. Il `play()` di
Chromium parte sempre circa 0,19 s in ritardo: misurato nel browser, dopo
l'aggancio lo scarto resta sotto i 70 ms all'avvio, dopo una pausa e dopo un
salto. Saltare richiede che il server accetti le richieste a intervalli
(`Range`), come GitHub Pages.

**Il canto** (`character_sing { target, with, id | text }`). La voce è nella
canzone: nessuno parla, si muovono le bocche. Un verso ha chi lo canta (il
primo e gli altri di `with`), il testo e il suo tempo, che è la ripresa
dell'azione (`shot_from`/`shot_to`) sull'orologio della demo — lo stesso a cui
è agganciata la musica, quindi parole, bocche e voce vanno insieme. Le bocche
di tutti i cantanti seguono la fila delle sillabe del verso stesa sulla sua
durata (`storBoccaDaSegnale` con `progresso`); chi canta nel coro guarda chi
guarda, gli altri guardano il primo. La regia inquadra il coro tutto insieme
(motivo `coro`, `storRegiaInquadra` 3-bis), il cantante solo come chi parla.

**Il karaoke** (`storDisegnaSovrimpressioni`, chiamata da
`storDisegnaCartelloLuogo`, cioè fuori dalla lente in tutte le viste). In
basso, in una pillola scura: i nomi di chi canta coi loro colori, poi il
verso su al più tre righe, la parte cantata dorata che brilla e quella da
cantare bianca e tenue, e sopra alla sillaba in corso salta un pallino
azzurro — il pallido puntino blu (`storPuntoDelCanto`, funzione pura). È
disegnato sulla tela: finisce anche nel filmato.

**Il titolo** (`story_title { id, sub_id }`): grande al centro, con un velo
scuro dietro perché si legga sopra ai personaggi; entra, resta e se ne va con
la sua ripresa, avvicinandosi appena.

**Il battito** (`story_music { bpm, beat, kick }`). `beat` è un primo della
battuta, in secondi della canzone (misurato: 87 bpm, `beat: 0.85`, un verso
per battuta). `storBattito` dice a che punto del colpo si è. Lo tengono:
la camera (`storLenteApri`: uno spintone in avanti a ogni colpo che si spegne
in un decimo di secondo, più forte sul primo della battuta, quanto dice
`kick`; solo ingrandisce, quindi non scopre i bordi), chi canta (i «colpi» di
`storMotoParlato` cadono sul battito) e tutti gli altri (un cenno schiacciato
e la testa a colpi alterni, `storPosa`). Col movimento ridotto la camera non
batte.

**Gli ospiti** (`ospite: true`, `storOspiti`). Carl Sagan non è un astro:
nessun renderer lascia la sua ricevuta. Sta in un posto dello schermo
(`character_show { at }`: `left` di serie, `right`, `center`, `top`,
`bottom`, `STOR_POSTI_OSPITE`), uguale nel planetario, nella 3D, nel banco
Terra e Luna e nella scala cosmica, col corpo intero e senza filo, e quando la
scena lo chiede altrove ci scivola. Si disegna per ultimo (davanti a tutti),
il palco della 3D gli fa posto come al Sole (fermo), e i corpi accanto lo
evitano. Non viaggia (`demo.err.ospiteFermo`), e nessuno viaggia verso di lui.

**Carl Sagan** (`sagan`, famiglia `persona`, sagoma `sagan`,
`disegnaSagan`): il busto con la giacca di velluto a coste e i revers, il
dolcevita rosso a coste fino al mento, la testa che è un disco-pianeta caldo
col taglio d'ombra e il bordo color panna, i capelli castani voluminosi degli
anni Settanta (la massa dietro e il caschetto davanti, due ciocche di punti
lisciate col contorno mosso: la riga di lato, il ciuffo che gira sulla
fronte, le basette che si aprono in fuori). Le sopracciglia folte, il sorriso
largo; attorno gli gira il pallido puntino blu (`STOR_FISICA.sagan.lune`) e,
quando canta, si accende l'aura. Si sceglie anche nello Studio (gruppo «Chi
racconta», `studio.ui.gruppo.narratori`), dove i viaggi per lui non vanno
nel copione, e nell'anteprima della pagina Demo.

**La storia** (`storia_puntino` in `demo-predefiniti.js`). I tempi dei
sessantotto versi sono stati **misurati sulla canzone**: il riconoscimento
del parlato parola per parola (Whisper small, in Node) e poi l'allineamento
col testo vero (programmazione dinamica con somiglianza delle parole); il
battito dalla cassa (87 bpm). Il copione è stato generato da quei numeri, con
le scene, le facce, gli effetti e le camere scritti a mano:

| Canzone | Scena |
|---|---|
| 0–18 s, intro parlata | la Voyager 1 il 14 febbraio 1990, a quaranta UA (`voyager_journey`), il titolo; Sagan la dice, la Voyager si stupisce, il lampo della fotografia |
| 18–44 s, prima strofa | il banco Terra e Luna: la base entra con un'onda d'urto; la Luna canta «ha riso, ha pianto, ha amato, ha tradito» cambiando faccia a ogni parola |
| 44–60 s, seconda strofa | il cielo di Roma, la Luna sopra ai tetti, i cuori, una stella cadente «sotto stelle avare» |
| 60–72 s | il Sole e la Terra: «sospeso in un raggio di sole» lo canta il Sole, la Terra rimpicciolisce |
| 72–96 s, ritornello | la scala cosmica esce fino all'eliopausa (le Voyager ai bordi con le frecce) e torna a casa: tutti cantano «pallido punto blu», i fuochi |
| 96–118 s, terza strofa | Marte (il dio della guerra) e Giove (il re degli dèi) si contendono la Terra: lampi, botti, il quadro che trema; poi «ma perché poi?» |
| 118–141 s, quarta strofa | Saturno si vanta, il Sole ride dell'idea di stare al centro; poi la scala cosmica fino alla nube di Oort, soli nel buio |
| 141–164 s, ritornello | i pianeti ballano e la camera gira; poi la Terra e la Luna coi fuochi e i cuori |
| 164–184 s, ponte parlato | Sagan da solo, Marte triste («non c'è altro posto dove migrare») |
| 184–208 s, ultima strofa | di nuovo la Voyager e la sua fotografia, poi dall'eliopausa a casa, tutti insieme, coriandoli |
| 208–247 s, outro | la Terra e la Luna, poi tutti canticchiano mentre la camera esce verso la bolla locale |

La canzone sta in `musica/canzoni/pallido-punto-blu.mp3`, **non** in
`audio/storie-musica/`: quella cartella è dello Studio, che a ogni
sincronizzazione ne toglie i file che nessuna sua storia usa. Non è nel
catalogo delle tracce (`musica/LEGGIMI.md`). Il testo inglese dei versi
(`storie.canzone.puntino.*` in `en.js`) è la traduzione, come dei sottotitoli:
la canzone resta in italiano.

Prove: `prova-storie.js`, gruppo «le storie cantate e gli ospiti (v450)»
(il coro con due bocche e la Luna zitta, il verso che tace a fine ripresa, il
karaoke che non torna indietro, la validazione, l'ospite in ogni vista e che
scivola, la storia che dura la canzone con ogni `at` giusto e i versi in
ordine). Guardata intera in Chromium, scena per scena.

### Le correzioni dopo la prima visione (v451)

Chi ha guardato «Pallido puntino blu» ha chiesto cinque cose.

- **«All'inizio trema tutto, troppo veloce».** Due cause. Il colpo di camera
  sul battito era uno spintone secco a ogni colpo, spento in un decimo di
  secondo: ottantasette scatti al minuto. Ora è una spinta morbida **una
  volta per battuta**, sul primo colpo (`spintaBattuta`, funzione pura:
  sale in 240 ms con una mezza onda, scende in mezzo secondo; 1,4% per
  `kick: 1`). E all'ingresso della base l'onda d'urto faceva la scossa del
  quadro a quasi dieci oscillazioni al secondo: la scossa di tutte le storie
  (`storLenteApri`) va ora a circa 4,5, uno scossone e non un ronzio, e nella
  storia al posto dell'onda d'urto c'è un bagliore. Anche il cenno a tempo dei
  personaggi è più lieve e senza scatto (una mezza onda per colpo). Prova:
  «la camera batte il tempo senza scatti».
- **Il labiale.** Un verso porta i tempi di ogni parola (`character_sing {
  words: '0.00-0.21 0.21-0.35 - …' }`, frazioni della ripresa, `-` per una
  parola che non si canta), misurati sulla canzone parola per parola
  (`storParoleDelCanto`, `storTempoNelCanto`): ogni parola stende le sue
  sillabe sul suo tempo, fra una parola e l'altra la bocca si chiude, e si
  canta con la bocca un poco più aperta di come si parla. Il karaoke segue
  gli stessi tempi. Senza `words`, o se i tempi non tornano col testo, vale la
  fila stesa sul verso come prima.
- **Gli occhi nel giro della camera.** Il volto girato della v432 seguiva
  tutto il giro della regia: nel giro lungo (centinaia di gradi in una scena)
  i personaggi finivano di spalle mentre cantavano. Ora il volto **rincorre**
  la camera con una molla lenta e al più di 0,42 rad (`storGiroVolto`): è una
  testa che si gira verso chi la riprende, e a camera ferma torna di fronte.
  E soprattutto i corpi **disegnati** piatti — Carl Sagan, le sonde, le
  stazioni, le vesti — non girano più il viso: su Sagan gli occhi scivolavano
  di lato sopra a un corpo fermo. Lì il volto guarda sempre in camera.
- **La fotografia vera.** `story_photo { photo: pale_blue_dot }` (§8,
  `STOR_FOTO`): quando si canta del puntino compare accanto alla scena la
  fotografia della Voyager 1 del 14 febbraio 1990 (NASA, pubblico dominio),
  chiesta dal browser a Wikimedia Commons, poi alla voce di Wikipedia; senza
  rete un'illustrazione disegnata, con scritto che è un'illustrazione. Lo
  stesso schema e lo stesso aspetto della copertina del Disco d'Oro
  (`.demo-immagine`, `.demo-immagine-foto` per non ritagliarla). Nella
  storia compare cinque volte: «Guardate ancora quel puntino», i due «Pallido
  punto blu», «in questa immagine distante», l'ultimo «pallido punto blu».
- **I comandi della demo** se ne vanno dopo cinque secondi (l'opzione
  `durataComandiSec`) **senza essere usati** (`demo.js`, `usaComandi`): fino
  alla v450 li trattenevano il mouse fermo sopra, il fuoco rimasto sul tasto
  appena cliccato (anche con la regola `:focus-within` di `style.css`, ora
  `:has(:focus-visible)`) e la pausa. Li trattiene solo il fuoco da tastiera;
  un movimento sopra, un clic o un tocco sulla scena li riportano. Prova:
  `prova-demo-browser.js` (che si ferma, come già nella v449, sullo stato
  dello schermo intero più avanti).

### La voce vera, la regia a ritmo, un Sagan più vero (v452)

Seconda visione, altre richieste: il sincronismo più realistico, la camera
più dinamica e coinvolgente, i personaggi e l'ambiente che rappresentino bene
quello che si dice, Carl Sagan più caratterizzato e realistico, e via il
sottotitolo del titolo («Una canzone per Carl Sagan e le Voyager»).

- **La voce separata.** La canzone è stata divisa in voce e base con Demucs
  (il modello HTDemucs a quattro tracce, dal pacchetto npm `demucs`, sulla
  CPU). Sulla sola voce: il riconoscimento delle parole rifatto (Whisper
  small), poi ogni inizio di parola agganciato all'**attacco** vero della
  voce entro ±0,12 s (376 parole su 425, di 6 centesimi in media); e
  l'**intensità** della voce nella banda del parlato, misurata 25 volte al
  secondo. Ogni verso la porta in `character_sing { voice: '2344249876…' }`
  (una cifra da 0 a 9 per campione, sulla ripresa del verso).
- **La bocca segue la voce vera** (`storVoceDelCanto`): si apre quanto la
  voce è forte in quel momento, si chiude sulle pause e fra le sillabe, si
  spalanca sulle note tenute; la vocale (A, E, O) la dà la sillaba della
  parola in corso. Le labbra anticipano il suono di 1,4 campioni (56 ms,
  `STOR_VOCE_ANTICIPO`), come nel parlato vero. Misurato nel browser: la
  correlazione fra apertura della bocca e intensità della voce è 0,91, col
  massimo a 4 centesimi d'anticipo (senza anticipo: 0,81 a 8 centesimi di
  ritardo). Senza `voice` restano le parole (`words`), poi la fila stesa.
- **La regia a ritmo** (`story_camera { mode: rhythm }`, `storRegiaRitmo`):
  a ogni battuta cambia inquadratura. Chi canta da solo: primo piano
  stretto, piano a due con chi gli sta più vicino, primo piano più largo,
  campo largo; il coro: tutti, poi un cantante per battuta, uno dopo
  l'altro. Ogni inquadratura col quadro inclinato di 2° da una parte o
  dall'altra (`ritmoRollio`, con lo zoom che basta a non scoprire gli
  angoli), il carrello che spinge avanti del 16% in una battuta
  (`ritmoCarrello`), e una molla quasi due volte più svelta fra l'una e
  l'altra (`ritmoSvelto`), come una frustata di camera. Nella storia: le
  strofe a ritmo, i ritornelli e il finale col giro della camera (fino a 32°
  al secondo), le camere 3D con giri, salite e zoom molto più ampi.
- **Il testo raccontato dalle immagini**: nell'intro la Terra compare come
  quel puntino che «può non sembrare di particolare interesse» (`size:
  real`, l'adesivo legato al pixel vero) e poi i cuori su «ma per noi è
  diverso»; la seconda strofa («ogni cacciatore…») è il cielo d'inverno di
  Roma con Orione, il cacciatore, e la canta Betelgeuse dalla sua spalla;
  nel ritornello la Terra rimpicciolisce sul «piccolissimo palco» e il fumo
  scende sul «buio cosmico»; scintille della vita nel ponte, cuori
  sull'«occuparci l'uno dell'altro», il bagliore sul «proteggere».
- **Carl Sagan** (`disegnaSagan`): la testa non è più un disco ma un ovale
  con la mascella, ancora nello stile dei pianeti (ombra spostata, bordo
  color panna, taglio d'ombra), con gli zigomi, il naso lungo con le narici,
  le pieghe del sorriso e le zampe di gallina, le orecchie sotto alle
  basette, i capelli che seguono la testa nuova; occhi più piccoli e umani
  con **l'iride castana** (`irideVera` nel profilo: l'anello col suo colore e
  le striature attorno a una pupilla più piccola) e niente ombretto; il naso
  generico dei volti di lui spento (`nasoProprio`).

Prove: `prova-storie.js` («la bocca segue la voce vera…», «la regia a ritmo
cambia inquadratura a ogni battuta…»).

### Lo schermo piccolo fermo, la foto una volta sola e la Terra indicata (v453)

Terza visione, sul telefono: lo sfondo tremava ancora troppo, e la fotografia
della Voyager tornava troppe volte senza dire dove fosse la Terra.

- **Perché tremava.** Misurato fotogramma per fotogramma, il tremolio non era
  il battito: erano tre cose che sullo schermo piccolo si sommavano. La regia
  a ritmo cambiava inquadratura **dentro** alla battuta (lo zoom pompava fra
  ×1,1 e ×2,2 più volte al secondo), la camera inseguiva le teste che
  ondeggiano a tempo, e lo sfondo stellato e la nebulosa della 3D si
  spostavano con lei. Adesso: la scelta della regia si tiene per tutta la
  battuta (`r.ritmoScelta`); il bersaglio della camera è il personaggio
  **senza** la sua oscillazione (`storOcchiDi` toglie `pg.oscilla`); sotto i
  520 px di lato corto (`STOR_SCHERMO_PICCOLO`) gli stacchi sono uno ogni due
  battute, niente rollio, zoom al più ×2,2; colpo di lente, carrello e molla
  svelta si riducono col lato corto (`storOsaRegia`, da 0,25 a 360 px a 1
  sopra gli 800); a ritmo restano solo gli effetti che sono il racconto
  (esplosione, fulmine, onda d'urto). In `app.js` (`solSfondoStoria`) la
  nebulosa si sposta con una tangente iperbolica (non esce mai dal suo
  margine) e sul telefono le stelle seguono la camera a metà. Le inversioni
  di direzione dello sfondo, sul telefono, sono scese da 1,1 a 0,4 al
  secondo.
- **La foto una volta sola**, nella prima scena, quando Sagan dice «guardate
  ancora quel puntino» (le altre quattro tolte dal copione).
- **La Terra indicata.** Quando la foto è arrivata, `storTerraNellaFoto`
  (rimpicciolita a 520 px, letta con `getImageData`) la passa a
  `storTrovaPuntino`: cerca il puntino più chiaro del suo intorno, **isolato**
  (l'anello attorno deve essere scuro, così un pezzo di raggio non vale),
  non rossastro (la Terra della foto è azzurrina), lontano dai bordi; e lo
  accetta solo se stacca di un quarto il secondo candidato, altrimenti si
  arrende. Se la foto non si può leggere (un server senza CORS: il secondo
  tentativo la carica senza `crossOrigin`) o la ricerca si arrende, vale il
  posto noto (`terraIllustrazione`, quello dell'illustrazione e della
  foto di Commons). Sopra la Terra un anello che pulsa con la scritta «Questa
  è la Terra» (`storie.foto.pale_blue_dot.terra`), poi la foto si ingrandisce
  ×3,4 **attorno al puntino** (`transform-origin` sulla Terra,
  `STOR_FOTO_TEMPI`): prima si vede dov'è nella foto intera, poi quanto è
  piccola da vicino. Sul telefono la scheda sta al centro, larga il 70%.

Prove: `prova-storie.js` («la Terra nella fotografia: il puntino chiaro e
isolato nel raggio di luce…», su un'immagine sintetica coi raggi e senza la
Terra). La fotografia vera non si è potuta vedere nel contenitore (niente
rete verso Wikimedia): si è vista l'illustrazione, col segno e l'ingrandimento.

### Il perno fermo, la freccia sulla Terra, il karaoke in vista e il ballo (v454)

Quarta visione, sul telefono.

- **Perché lo sfondo della prima scena tremava ancora.** Non era la regia:
  nella prima scena la camera gira attorno alla Voyager 1 (`sol.perno`), e
  il perno leggeva il punto della sonda **come è mostrato**, cioè col
  dondolio del canto e delle animazioni e col passo di lato del palco che
  la tiene lontana da Sagan (`storPalco3D`, la regola che non fa
  sovrapporre i personaggi). La camera inseguiva quel dondolio: la sonda
  restava inchiodata al centro e il Sole, i pianeti, le stelle e la
  nebulosa ballavano al posto suo. Misurato: lo spostamento della camera
  saltava di 20–30 px da un fotogramma all'altro, con decine di inversioni
  in 18 s; adesso zero. `storScena3D` ricorda il punto da fermo
  (`pg.fermo3D`, solo il viaggio di `character_move`), `storPuntoFermo3D`
  lo dà a `solPuntoPerno` in `app.js` se il punto è quello appena mostrato.
- **Meno scossoni dappertutto.** La scossa degli scoppi a metà ampiezza e
  più lenta (circa 2,5 al secondo), ridotta ancora col lato corto
  (`storOsaRegia`); il colpo di camera sul battito da 0,014 a 0,008.
- **La freccia sulla Terra.** Nella foto della Voyager, oltre all'anello,
  una freccia che arriva di sbieco dall'alto dal lato dove c'è posto
  (`.demo-foto-freccia`) e porta in cima «Questa è la Terra». L'anello
  pulsa in un `::before`, così la freccia non pulsa con lui. Sul telefono
  la scheda è un poco più piccola e più in alto, per non coprire il verso.
- **Il karaoke in vista.** Stava sul fondo della tela, che sul telefono è
  coperto dalla barra del browser, dalla navigazione e dai comandi della
  demo: i versi si vedevano tagliati. Ora sta all'altezza dei sottotitoli
  della narrazione (`storKaraokeRiserva`: la barra in basso più 86 px, 140
  coi comandi a schermo, convertiti in pixel della tela, e il valore
  scivola), su un fondo più scuro (0,8) e almeno a 19 px.
- **Il ballo.** Durante la canzone, finché c'è un battito, tutti ballano
  (`storMotoParlato`): il corpo va di qua e di là, un lato per colpo, la
  testa si inclina con lui, metà del coro a specchio, e chi non canta fa un
  passo in su a ogni colpo. Il palco e la camera tolgono lo spostamento
  (`pg.oscilla`, il perno fermo): balla il personaggio, non il cielo.

Prove: `prova-storie.js` (102, «il perno della camera sta sul personaggio
da fermo…»). `prova-storie-browser.js` (il nome nel sottotitolo
dell'episodio pilota), `prova-demo-pagina.js` (la camera a mano nel
planetario) e `prova-lingua.js` (i tempi del cambio lingua) falliscono
uguali sulla v453: da guardare a parte.

### Solo l'illustrazione della foto (v455)

Chi guarda la storia ha chiesto di togliere la fotografia vera: in
`STOR_FOTO.pale_blue_dot` le candidate e le voci di Wikipedia sono vuote,
nessuna richiesta parte verso Wikimedia e si vede sempre l'illustrazione,
con l'anello, la freccia e lo zoom sulla Terra (`terraIllustrazione`). La
didascalia di sotto dice «Illustrazione della fotografia della Voyager 1».
Prova: `prova-storie.js` (nessun indirizzo di Wikimedia nel modulo).

### Senza foto, più cupa, più Sagan (v456)

Chi guarda la storia ha chiesto di togliere anche l'illustrazione della foto,
di non esagerare con l'amore e l'entusiasmo (le parole della canzone sono
amare) e di far cantare di più Carl Sagan. Nel copione di `storia_puntino`:
nessun `story_photo` (il comando resta per le altre storie); via cuori,
fuochi, coriandoli, scintille e balli scritti; le espressioni `love`,
`excited`, `happy` diventano `sad`, `thinking`, `neutral` (Sagan resta
pensoso), il Sole non ride ma guarda storto; le camere in orbita girano al
più a 14. La Luna mima ancora «ha riso, ha pianto, ha amato, ha tradito».
Sagan guida 62 versi su 68, gli altri cantano con lui (`with`); restano
soli Marte (30, 34), Giove (31), Saturno (38), il Sole (39) e la Luna (9),
i versi che parlano di loro. Prova: `prova-storie.js` (nessuna foto, niente
festa, Sagan in almeno 60 versi).

### La bocca dritta di chi canta (v457)

Con Sagan pensoso per tutta la canzone, la bocca cantava di traverso: il
pensoso (`thinking`) ha `storta: 0.5` e `spostaBocca: 0.28`, e la bocca
spalancata si apriva storta e spostata di lato sotto ai baffi (lo stesso col
seccato, che in più sbuffava dalla bocca aperta). Ora in `storDisegnaPersonaggi`
chi canta tende a `storta: 0` e `spostaBocca: 0`, senza lo sbuffo; l'umore
resta negli occhi e nelle sopracciglia, e finito il verso la bocca torna
quella dell'espressione. Prova: `prova-storie.js` («Carl Sagan pensoso canta
con la bocca dritta»), guardato in Chromium (scena 14, prima e dopo).

### Le pupille che si muovono, le facce di Sagan, il coro e solo la musica (v458)

Chi guarda la storia ha chiesto quattro cose.

- **Le pupille di Sagan ferme.** Pensoso tutta la canzone, il suo sguardo
  era quello del pensoso (`sguardo: { x: 0.85, y: -0.75 }`), già fuori dal
  cerchio: le piccole occhiate a vuoto di sempre, sommate lì, venivano
  riportate sul bordo da `storGeometria` e l'iride restava inchiodata in
  alto a destra. Ora chi canta sceglie dove guardare a ogni frase
  (`storOcchiataCanto`, da 0,7 a 2,2 s, `STOR_OCCHIATE_CANTO_MS`): in camera,
  uno degli altri in scena, il punto dell'espressione a 0,62 (non fino al
  bordo) o di lato, dalla parte opposta all'ultima volta; le occhiate a
  vuoto ci si sommano sopra. Vale per tutti quelli che cantano, non per chi
  ha un `look` scritto.
- **Le facce.** Nel copione Sagan cambia espressione verso per verso
  (`character_expression` alla ripresa di ogni suo verso): pensoso,
  neutro, triste, preoccupato, sorpreso («Guardate ancora quel puntino»,
  «Pallido punto blu»), seccato (i traditori, la follia delle vanità),
  arrabbiato sui fiumi di sangue, assonnato sugli «oh» del congedo, e un
  solo sorriso su «occuparci l'uno dell'altro». Il tono resta quello della
  v456: niente cuori né feste.
- **Non solo il suo viso.** La regia teneva Sagan in primo piano quasi
  sempre: a ritmo, da solo, tre battute su quattro; nel giro, chi parla
  (cioè lui, il primo della fila) si stringeva per tutta la scena. Ora a
  ritmo il primo piano è una battuta su quattro (le altre: il piano a due,
  il campo largo, ancora il piano a due) e meno stretto (`volto`); nel giro
  chi canta da solo resta largo; fuori dal ritmo chi canta da solo alterna
  primo piano e tutti ogni 2,76 s (`cantoAlterna`).
- **Il coro.** Nei ritornelli (versi 22–29 e 46–53) e nei versi 64, 67 e
  68 cantano tutti quelli in scena (`with`). Un verso cantato da tre o più
  in vista è un **coro pieno** (`STOR_CORO_PIENO`, `storCoroInVista`): la
  camera li tiene tutti nel quadro, a ritmo (a battute alterne un poco più
  largo) e anche nel giro (`storInquadraGruppo`). Il coro a due resta uno
  per uno.
- **Solo la musica.** `story_music { sounds: off }` (§8) spegne gli effetti
  sonori finché la canzone è agganciata (`suoniAccesi` guarda
  `stor.canzone.zitti`) e zittisce quelli in corso; tutte le scene di
  «Pallido puntino blu» lo portano.

Prove: `prova-storie.js` (107: «il coro pieno resta tutto nel quadro…»,
«le pupille di chi canta si muovono…», «story_music { sounds: off }…»,
«Carl Sagan cambia faccia…»), `prova-storie-repo.js`, `prova-demo.js`,
`prova-musica-storie.js`, `controlla-i18n.js --patto`.

### Il discorso affiatato (v459)

Chi guarda le storie sentiva silenzi lunghi fra una battuta e l'altra: la
`duration` di una scena è scritta per la voce più lenta (la sintesi
italiana), e con la voce registrata, con l'inglese o con una voce svelta la
frase finiva secondi prima della scena. Ora in una CosmoStoria (una demo con
dei personaggi, `stringiVoce` nel contesto di `demo.js`) il motore
(`demo-motore.js`, `seguiVoce`, `durataScena`) chiude la scena **un quarto
di secondo dopo** che l'ultima voce ha taciuto, mai sotto i due secondi.
Restano aperte le scene che hanno ancora una battuta da cominciare (una
ripresa di `character_speak` o `narrate` più avanti, `Motore.VOCI`: prima
le loro voci non si aspettavano nemmeno) e quelle con un gesto scritto dopo
la battuta, che si vede per mezzo secondo prima di chiudere. Una voce spenta
(`spenta`, `vuota`) o interrotta non stringe niente; le scene senza voce, e
quindi le storie cantate, durano quanto è scritto; le demo che non sono
storie pure. Chiudendo prima, le azioni già partite arrivano al loro stato
finale e quelle non ancora cominciate non nascono (niente botto creato e
chiuso nello stesso istante). Misurato in Chromium su «La Luna ha perso un
pezzo?»: scene di 7,0 s invece di 10, 9,3 invece di 13, 11,7 invece di 16.

Prova: `prova-demo.js` («Storia: la scena chiude un attimo dopo la voce» e
le cinque accanto).

### Le facce giuste al momento giusto (v460)

Chi guarda «Pallido puntino blu» trovava Carl Sagan triste troppe volte: fra
le facce non c'era quella giusta per le sue parole, e la tristezza copriva
la meraviglia, la tenerezza, la malinconia. Cinque espressioni nuove in
`STOR_ESPRESSIONI` (con la fisica in `STOR_FISICA_EMOZIONI`, i nomi
`storie.espressione.*` e `storie.espressioneLei.*`, le parole dello Studio
`studio.parole.umore.*`, `STUDIO_UMORI`, le idee per le azioni e il tag di
ElevenLabs in `storie-studio.js` e `scripts/voci-storie.js`):

| Nome | Faccia | Dove la usa Sagan |
|---|---|---|
| `wonder` (meravigliato) | occhi grandi e lucidi, sopracciglia alte, sguardo in su, bocca socchiusa | il punto d'osservazione lontano, «Guardate ancora quel puntino», il piccolissimo palco, la vastità |
| `tender` (intenerito) | occhi a mezzaluna, sorriso dolce a bocca chiusa, testa inclinata | «È qui, è casa», coloro che amate, «Pallido punto blu», «occuparci l'uno dell'altro» |
| `determined` (deciso) | sguardo dritto, palpebre tese, sopracciglia basse e piatte, bocca ferma | «Proteggila», «dipende solo da noi», la responsabilità |
| `skeptical` (scettico) | un sopracciglio su, occhiata di lato, mezzo sorriso storto | «può non sembrare di particolare interesse», la posizione privilegiata |
| `wistful` (malinconico) | palpebre pesanti, sguardo lontano, sorriso amaro accennato, senza lacrima | le vite vissute, il granellino solitario, «l'unica casa», gli «oh» del congedo |

Triste (`sad`) resta soltanto su «tutto questo tormento» e «ma perché poi?»;
nelle scene della guerra Sagan, finché ascolta Marte e Giove, è preoccupato.
Guardate nel browser con l'anteprima (`StorieCosmiche.anteprima`): il
sorriso dell'intenerito era aperto come una risata ed è diventato a bocca
chiusa; il luccichio della meraviglia cadeva sulla bocca ed è stato tolto.

Prova: `prova-storie.js` («Carl Sagan cambia faccia…»: al più tre volte
triste, le cinque facce nuove usate e scritte nelle due lingue).

### Le lune davanti al volto, «Duplica e modifica» nello Studio, le storie in cantiere e le CosmoStorie (v461)

Tre richieste di chi usa l'app.

**Le lune passavano dietro alla faccia.** La metà davanti delle orbite (le
lune disegnate, la Terra che gira attorno a Carl Sagan, Caronte, la metà
davanti degli anelli sottili) stava nello strato `davanti` di
`storDisegnaFisica`, che si dipinge dopo il corpo ma **prima** del volto: la
luna che girava verso di noi spariva sotto occhi e bocca. Ora c'è un terzo
strato, `primo`, dipinto **dopo** il volto in tutti e tre i casi (il corpo
disegnato in `storDisegnaVolti`, l'astro vero del planetario, il ritratto di
`storRitratto`); `davanti` tiene solo le tempeste sul disco. La metà di
dietro resta dietro alla testa. Guardato nell'anteprima di Sagan: la Terra
passa sul mento, poi dietro.

**«Duplica e modifica» apre la copia nello Studio.** Prima portava al
copione DSL nella linguetta Demo. Ora `StudioStorie.apriDaStoria`
(`storie-studio.js` §3-bis) trasforma il copione in un progetto con
`studioDaCopione`: ogni scena del DSL è un momento, le scene di fila nello
stesso posto (cielo, Terra e Luna, un pianeta, Sistema Solare, scala
cosmica; una `transition` resta col gruppo di prima) sono una scena dello
Studio. Diventa modificabile quello che lo Studio sa scrivere: chi parla e
cosa dice (il testo dal dizionario), la faccia di chi parla (dalla sua
`character_show`), e le azioni di `STUDIO_DAL_DSL` (umore, sguardo,
occhiolino, uscita, viaggio, ritorno, animazione, misura, forma, effetto,
suono). Un'azione entra fra quelle dello Studio **solo se lo Studio la
riscrive uguale**: si compone con `righeAzione`, la si rilegge col motore e
si confronta la firma (`firmaAzione`); i tempi esatti (`shot_from`/`shot_to`)
restano in `azione.esatta` finché non si cambia il «quando». Tutto il resto
(camera, date, luogo, musica a tempo, versi cantati, cartelli, titoli,
`voyager_journey`, le `character_show` coi loro sguardi e posti) resta nel
momento come `m.copione.righe` — comandi già analizzati, mai testo da
incollare — e `studioCopione` li riscrive tali e quali (`studioRigaDsl`),
con la vista dell'originale e la durata al millesimo. Nel momento si vedono
sotto «Cosa succede → Dalla storia originale», e con × si tolgono. La
battuta registrata resta sua (`m.parla`, `character_speak { id }`) finché
chi parla e il testo non cambiano; cambiati, diventa testo, e solo allora
entra nel file delle voci. Prova: ognuna delle cinque storie pronte, portata
nello Studio e riscritta senza ritocchi, ha le stesse scene, viste, durate e
azioni (`prova-storie.js`).

**In cantiere e fra le CosmoStorie.** Un progetto ha `ufficiale`: spento, la
storia è in cantiere e sta solo nell'elenco dello Studio; «Metti fra le
CosmoStorie» la salva come demo e la mette fra le schede delle storie pronte
(`StudioStorie.ufficiali`, letta da `storieDisponibili`), con «Dallo Studio»
accanto al titolo e «Modifica nello Studio»; «Rimetti in cantiere» la toglie.
L'elenco dello Studio mostra le storie in cantiere (quella aperta sempre,
col segno «CosmoStoria» se è ufficiale). `ufficiale` e `origine` viaggiano
col progetto anche sul repository (§6b).

### Le espressioni dentro la frase e quattordici facce nuove (v462)

**Le espressioni di ElevenLabs nel punto esatto della frase.** Prima la
battuta partiva con l'emozione della faccia e al più due toni, tutti
all'inizio. Ora, nella linguetta «Voce e durata» (con la chiave ElevenLabs),
«Espressioni dentro la frase» ha quattro linguette — Emozioni (36), Come
parla (18), Risate, sospiri e suoni (18), Pause e ritmo (6),
`STUDIO_TAG_FRASE` — e un tasto per espressione mette `[tag]` **dove sta il
cursore** nella battuta (`inserisciTag`; il cursore si ricorda anche dopo
aver cliccato altrove, `studio.cursore`). Una scritta libera mette
qualunque altro tag di ElevenLabs (in inglese, `STUDIO_TAG_LIBERO`). Le
espressioni messe stanno in fila, ognuna con la sua ×, e «Togli tutte».

I tag vivono nel testo della battuta (`m.testo`, ora fino a 600 caratteri):
`testoGrezzo` li tiene (va a ElevenLabs, e l'impronta della voce generata
è su di lui: cambiare un tag chiede di rigenerarla), `testoDetto` li toglie
(`studioSenzaTag`: sottotitoli, karaoke, voce del dispositivo, conteggio
delle parole, durata). Un tag all'inizio della frase prende il posto
dell'emozione della faccia, come prima per i tag scritti a mano. Il file
delle voci porta anche `conTag`, e `scripts/voci-storie.js` lo mette nella
regia (con davanti l'emozione della faccia, se la frase non comincia già
con un tag). Coi modelli diversi da v3 i tag non partono.

**Quattordici facce nuove**, una per ogni emozione nuova che la voce sa
dire, perché il volto non contraddica la voce: orgoglioso (`proud`),
sollevato (`relieved`), speranzoso (`hopeful`), giocherellone (`playful`),
curioso (`curious`), confuso (`confused`), colpito (`impressed`),
spaventato (`scared`), in panico (`panicked`), imbarazzato (`embarrassed`),
deluso (`disappointed`), frustrato (`frustrated`), annoiato (`bored`),
misterioso (`mysterious`). Ognuna ha la sua fisica (`STOR_FISICA_EMOZIONI`),
il suo tag per ElevenLabs (`ELEVEN_TAG_UMORE`, `TAG_UMORE`), le parole che la
suggeriscono (`studio.parole.umore.*`), le idee d'azione e i nomi al
maschile e al femminile. Curioso e confuso hanno un segno nuovo, il punto di
domanda che dondola sopra la testa (`domanda`).

### «Pallido puntino blu» con le facce nuove (v463)

Le facce della v462 messe nella canzone, dove le parole le chiedono (25
cambi, il resto del copione com'era; il tono resta cupo, niente cuori):
la Terra speranzosa a «Ma per noi… è diverso»; Sagan confuso sulle
«ideologie, errori» e sulle «incomprensioni», deluso su «eroe e codardo,
traditore», «ma perché poi?» e «la follia delle vanità», speranzoso su
«ogni figlio speranzoso» e nel congedo, colpito sulla «vasta arena
cosmica» (nei due ritornelli) e sulla «dimostrazione più grande»,
misterioso sul «buio cosmico», frustrato sui «padroni per un solo momento»,
spaventato su «non c'è aiuto che arriva»; Betelgeuse orgogliosa del
«creatore e distruttore di civiltà»; Saturno orgoglioso delle sue
«ostentazioni» e poi imbarazzato; Marte imbarazzato e Giove confuso dopo le
guerre, Marte deluso quando non c'è altro posto dove migrare; la Voyager 1
curiosa all'inizio e orgogliosa della sua fotografia; le due Voyager
speranzose quando si parla di occuparci l'uno dell'altro. Prova:
`prova-storie.js` (la storia usa dieci facce nuove, Sagan almeno tre).

### Inserire scene e momenti in mezzo, e pubblicare su YouTube (v464)

Chi scrive ha chiesto due cose: mettere una scena (o una battuta) **fra le
altre**, e mandare la storia finita **dritta sul suo canale YouTube**.

**In mezzo, non solo in fondo.** Prima «Aggiungi scena» e «Aggiungi
momento» mettevano in coda, e per portare una scena al secondo posto in una
storia di diciassette servivano sedici «↑». Ora (`storie-studio.js`):

- prima di ogni scena c'è un **+ Scena qui** (`tastoInserisci`, `fai`
  `inserisciScena` con `data-valore` = il posto), e fra due momenti un
  **+ Momento qui** (`inserisciMomento`). In fondo restano «Aggiungi scena» e
  «Aggiungi momento»;
- `studioInserisciScena(p, i)`: la scena nuova prende ambiente,
  inquadratura e chi c'è da quella di sopra (in cima, da quella di sotto),
  e il suo primo momento lo scrive la bozza (`studioProssimoMomento(p, sc,
  0)`: col terzo argomento la bozza guarda la battuta **di sopra**, non
  l'ultima della scena, e in cima alla storia è l'«inizio»);
- `studioInserisciMomento(p, sc, k)`: un momento vuoto, e parla qualcuno che
  non ha detto né la battuta di sopra né quella di sotto (con due soli in
  scena, almeno non quella di sopra);
- scena o momento nuovi si aprono, vengono in vista e il cursore va nella
  battuta (`studio.inserito`, alla fine di `disegna`);
- il «+» è una riga tratteggiata quasi spenta, che si accende al passaggio
  o alla tastiera (`.studio-inserisci`; sui telefoni resta a metà); con un
  margine negativo non allunga il copione.

**YouTube** (`youtube.js`, prefisso `yt`, cappello in testa al file). L'app
non ha un server, quindi il collegamento è l'accesso di Google per le app
web: lo script di Google (`accounts.google.com/gsi/client`, scaricato solo
quando si vede un tasto che lo userà) apre la sua finestra, e all'app arriva
un gettone di un'ora, **solo in memoria**, per due cose: caricare video e
leggere il nome del canale. In `astrocal_youtube_v1` (fuori dal backup) ci
sono l'ID client scritto a mano, il canale, la visibilità di serie, «per i
bambini» e gli ultimi dieci pubblicati.

- **L'ID client OAuth** di un progetto Google Cloud (YouTube Data API v3
  accesa, l'indirizzo dell'app fra le origini autorizzate) non è un segreto:
  il deploy lo prende dalla variabile di repository `YOUTUBE_CLIENT_ID` e lo
  scrive in `config.js` (`pubblica.yml`); senza, il pannello lo chiede, coi
  cinque passi per farlo e la guida (`guida.html#youtube`).
- **Dove si collega**: Impostazioni → Dati → *Account YouTube*
  (`#imp-youtube-corpo`) e la quarta linguetta, **YouTube**, delle
  Impostazioni dello Studio (`STUDIO_SCHEDE_IMP`). Lo stesso pannello
  (`ytPannello`), ridisegnato dappertutto a ogni cambio (`ytRidisegna`, e
  l'evento `astrocal:youtube` per la riga delle linguette dello Studio).
- **Dove si pubblica**: il tasto *YouTube* nel pannello «Il tuo momento»
  (planetario e 3D, `skyRegYoutube`), nelle schede della Galleria e nelle
  schede delle CosmoStorie; in fondo allo Studio e nella sua linguetta
  YouTube **Registra e pubblica su YouTube**. Gli ultimi due girano la storia
  **registrandola** con `AstroDemo.avvia(testo, { registra: true })`: le
  opzioni «per una volta» (`demo.js`) valgono per quella corsa e tornano
  com'erano in `ripristina`, senza toccare quelle salvate. Il filmato arriva
  a `skyRegMostraEsito`, che chiama `ytDopoRegistrazione`: la finestra si
  apre da sola, col titolo della storia. Il titolo viaggia anche nei
  filmati fatti col tasto Registra delle demo: `demo.js` lo mette in
  `sky.reg.titolo`, `skyRegAvviaVideo` lo prende (e lo azzera) e lo passa
  all'esito.
- **La finestra** (`ytApriPubblica`, `#yt-finestra`, sopra anche alla
  Galleria): titolo (al più 100, senza `<` e `>` che YouTube rifiuta),
  descrizione, tag, visibilità (privato, non in elenco, pubblico), «per i
  bambini»; «Pubblica» parte dentro al tocco (la finestra di Google, se il
  gettone è scaduto, si apre solo lì). Il caricamento è quello a riprese:
  `ytApriSessione` (POST coi metadati, l'indirizzo della sessione in
  `Location`), `ytInvia` (un PUT solo con la barra), e se la rete cade
  `ytStatoSessione` chiede fin dove è arrivato (`308` e `Range`) e si riparte
  da lì, fino a `YT_TENTATIVI` volte. «Annulla» ferma; durante l'invio Esc e
  la × non chiudono. Alla fine: «Apri su YouTube», «Apri in YouTube Studio»,
  «Copia il link».
- **Gli errori** hanno un nome (`ytErroreDaRisposta`): quota del progetto
  finita, troppi caricamenti oggi, account senza canale, API spenta nel
  progetto, gettone scaduto (il collegamento va rifatto), permesso tolto,
  titolo/descrizione/tag rifiutati, finestra di Google bloccata o chiusa.
- **I due limiti di Google**, detti nel pannello e nella finestra: un
  progetto non verificato da YouTube carica i video **solo privati** (e la
  finestra lo dice se succede: `fattoPrivato`); la quota di un progetto basta
  per circa sei caricamenti al giorno, per tutti quelli che usano lo stesso
  ID client.

Prove: `prova-youtube.js` (nuova: un Google finto, il giro intero, la
ripresa dopo la rete caduta, quota, annulla, Studio, CosmoStorie, telefono,
inglese, scollega), `prova-storie.js` (112, una nuova per l'inserimento),
`prova-storie-sezioni.js` (i «+» nel browser, desktop e telefono),
`prova-elevenlabs-studio.js` (quattro linguette), `prova-demo.js`,
`prova-demo-pagina.js`, `prova-galleria.js`, `prova-registrazione.js`,
`prova-musica-storie.js`, `prova-storie-repo.js`, `prova-i18n.js`,
`prova-lingua.js`, `prova-guida.js`, `controlla-i18n.js --patto`.

### «Conosciuto» che non finisce più, e la prima frase delle scene chiuse (v465)

Chi ha guardato «Pallido puntino blu» ha scritto: su «che abbiamo mai
conosciuto» la storia non va a tempo, su «conosciuto» rallenta tutto, la
canzone passa all'altra strofa e il karaoke resta lì.

- **La causa.** I tempi dei versi vengono dal riconoscimento delle parole
  (Whisper), che **allunga l'ultima parola fino a dove ricomincia il
  parlato**. «Che abbiamo mai conosciuto» è cantato a cappella da 210,6 a
  212,0 s (a 212,0 entra tutta la base); il copione teneva «conosciuto» da
  211,5 a 222,2 s, e il verso durava dodici secondi invece di uno e mezzo.
  Misurato sulla canzone con l'energia del canale centrale (dove sta la
  voce) contro quella dei lati, a grana di 20 ms, e con la voce separata
  (`voice`) già nel copione: tutt'e due dicono dove la voce si ferma.
- **Gli altri uguali.** Cercati verso per verso confrontando la fine
  dell'ultima parola con la fine della voce: «L'unica casa…» (verso 65, la
  voce finisce a 208,85 s, il copione a 210,2) e «…è tutto quello che
  abbiamo avuto» due volte (versi 29 e 53, 3 s e 0,7 s di troppo). Ripresa,
  parole e `voice` tagliati dove la voce si ferma.
- **Il primo «Oh… oh… oh… oh…».** Fra 212,8 e 221 s la voce canta un
  «oh» che il testo non scriveva (lo spettro di quel tratto è quello degli
  altri due «oh», non quello del tratto solo strumentale): ora ha il suo
  verso (`storie.canzone.puntino.67` riusato, Carl Sagan con la Terra e la
  Luna). I versi sono 69, tre «oh» come nella canzone.
- **Prova** (`prova-storie.js`): «l'ultima parola di un verso non continua
  dopo la voce», al più 0,6 s oltre la fine della voce, e il verso al più
  1,2 s. Una canzone nuova misurata nello stesso modo la passa solo se i
  tempi sono stati ripuliti.
- **La scena chiusa dice la sua prima frase.** Nello Studio una scena chiusa
  diceva solo «Scena 3 · Il Sistema Solare (3D) · 1 momento»: in una storia
  duplicata da diciassette scene per ritrovarne una bisognava aprirle tutte.
  Ora sotto al titolo c'è chi parla per primo e cosa dice, su una riga
  tagliata coi puntini (intera al passaggio del mouse; da aperta sparisce,
  si leggono i momenti). `studioPrimaFrase(sc)` (funzione pura, anche
  `StudioStorie.primaFrase`): la battuta del primo momento che ne ha una,
  senza i tag di ElevenLabs; se no il primo verso cantato o la prima
  battuta rimasti fra i comandi dell'originale (`m.copione.righe`), il più
  presto nella ripresa. Testi `studio.ui.primaFraseChi` e
  `studio.ui.primaFrase`, `.studio-scena-frase` in `style.css`.

### Il filmato per YouTube: risoluzione piena, senza data e luogo, controllato prima (v466)

Chi preme **YouTube** (sulla scheda di una CosmoStoria o «Registra e
pubblica su YouTube» nello Studio: le due interfacce passano tutte e due da
`ytRegistraEPubblica`) ha chiesto tre cose.

- **La risoluzione massima.** Il registratore dei filmati (`app.js`, «Il
  tuo momento») tiene il lato lungo a 1080 px, la misura buona per le chat:
  un filmato per YouTube usciva a 1080 × 608. Ora `ytRegistraEPubblica`
  avvia la demo con `{ registra: true, perYoutube: true, schermoIntero:
  true }`; `demo.js` (`avviaRegistrazione`) accende `sky.reg.perYoutube` e
  la tela si misura con `skyRegMisuraTela(l, h, dpr, alta)`: i pixel veri
  dello schermo (CSS × `devicePixelRatio`), mai sotto 1920 di lato lungo
  (sotto YouTube lo tratta da 720p) e mai sopra 3840 (4K). Il flusso segue
  (`skyRegBitrate`: 0,2 bit per pixel, da 8 a 45 Mbit/s; i filmati normali
  restano a 6). Se il registratore rifiuta la misura grande, si riprova a
  1920 prima di arrendersi. Se il pieno schermo chiesto all'avvio non è
  ancora arrivato quando la registrazione parte (senza l'intro), la tela
  prende la misura dello schermo (`sky.reg.misura`), non quella della
  finestra di quel momento. Tutto torna com'era in `ripristina`.
- **Niente data e luogo in basso a sinistra.** Con `perYoutube` la firma
  (`skyRegFirma(ctx, L, H, { soloMarchio: true })`) lascia solo il nome
  dell'app in basso a destra: il titolo e la descrizione del video dicono
  già cos'è.
- **Il file controllato prima della finestra.** `ytApriPubblica` non apre
  più subito: `ytControllaVideo(blob)` apre il filmato in un `<video>` come
  farebbe un lettore. Sotto un kilobyte è vuoto; deve avere un'immagine e una
  durata (i webm del registratore non la scrivono: la si fa calcolare
  saltando in fondo). Se è guasto la finestra lo dice (`yt.controllo.*`),
  senza campi né «Pubblica», con «Scarica il filmato»; se è a posto la
  finestra ha l'**anteprima** del filmato (`.yt-anteprima`, un elemento solo
  per tutta la vita della finestra, che non riparte a ogni ridisegno) e la
  riga con nome, peso, misura e qualità (`1920 × 1080 (1080p)`) e durata.
  Se il browser non risponde entro 12 s la finestra si apre lo stesso,
  dicendo che non si è potuto controllare.
- **Le due finestre una sull'altra.** Alla fine della registrazione si apre
  anche il pannello «Il tuo momento» del planetario, col suo filmato in
  ciclo: sotto alla finestra di YouTube erano due filmati insieme. Ora
  quello sotto si ferma (`ytFermaAnteprimeSotto`) e resta lì, per scaricarlo
  o condividerlo dopo.

Prove: `prova-youtube.js` (12, 2 nuove: il file vuoto e quello rovinato; la
misura, il flusso, la firma senza data e luogo e una demo vera registrata
per YouTube), con un filmato vero registrato nella pagina al posto dei 2400
byte finti. Guardato in Chromium: dalla scheda di una CosmoStoria, 1920 ×
1080, fotogramma senza data e luogo.

### L'audio nel filmato per YouTube (v467)

«Quando registri per YouTube assicurati che registri anche la traccia
audio.» Il filmato aveva una traccia audio, ma **muta**: la presa
(`narrazione.catturaAudio`) prendeva solo l'elemento della voce, e la
canzone di «Pallido puntino blu» (`storMusica`), la musica e i suoni da file
delle storie e la colonna sonora della demo suonavano da elementi loro.
Misurato decodificando il file registrato: otto secondi a zero prima, la
canzone dopo.

- Ognuno di quegli elementi si dichiara a `narrazione.audioDelRacconto(el)`
  (`audioNelFilmato` in `storie-cosmiche.js`, `musicaDemoAvvia` in
  `app.js`); durante una cattura entra nel grafo Web Audio e nella stessa
  traccia della voce e dei rumori sintetizzati (`DEMO.md` §Registra anche
  l'audio). Fuori da una registrazione nulla cambia.
- Le corse per YouTube hanno l'audio sempre acceso (`registraAudio: true`
  in `ytRegistraEPubblica`, anche con l'opzione spenta), e il contesto audio
  si sblocca dentro al clic (`narrazione.sbloccaContesto`, in
  `AstroDemo.avvia`).
- La finestra dice «con l'audio» quando il file ha la traccia e ci è passato
  del suono; altrimenti avvisa (`yt.controllo.senzaAudio`, `yt.controllo.muto`:
  sotto −60 dB di picco, `YT_SOGLIA_MUTO`).
- Resta fuori la voce sintetica del dispositivo (`speechSynthesis`), che non
  espone il suo segnale: una storia narrata così ha il filmato muto nella
  voce, e la finestra lo dice se non c'è altro suono.

Prove: `prova-youtube.js` (14, 2 nuove: la canzone dentro al file, misurata
decodificandolo; gli avvisi della traccia assente e di quella muta).

## Accessibilità

- **Movimento ridotto**: niente comparsa sfumata, niente ondeggiare dei
  dischi grafici, espressioni e sguardo che cambiano di colpo invece di
  scivolare, battiti più radi, bocca meno ampia. La demo si ferma se la
  preferenza cambia a metà (come tutte le demo).
- I volti sono disegnati sulla tela: niente elementi nel documento che
  prendano tocchi o fuoco. La tela dell'anteprima ha `pointer-events: none`.
- Il sottotitolo porta il **nome scritto** di chi parla (`.narrazione-chi`),
  non solo il suo colore, ed è sempre a schermo nelle storie — anche a
  narrazione spenta (solo testo, nessuna voce).
- Nessun movimento rapido: il battito dura un quinto di secondo, lo sguardo
  scivola in un decimo, i dischi ondeggiano di un pixel.
- Col movimento ridotto (v409) i viaggi arrivano subito, le animazioni non
  ci sono, gli effetti sono un alone che si accende e si spegne.
- Le linguette della pagina Demo sono un `tablist` vero (frecce, Home, End).
- Le storie cantate (v450): il karaoke porta, come il sottotitolo, il **nome
  scritto** di chi canta; il verso resta a schermo per tutta la sua durata e
  la parte cantata si distingue anche per luminosità, non solo per colore.

## Prove

```
node scripts/prova-storie.js            # il motore, senza browser
node scripts/prova-storie-browser.js    # planetario, 3D, voce, filmato, telefono, inglese
node scripts/prova-storie-repo.js       # le storie dello Studio sul repository (v424)
node scripts/prova-musica-storie.js     # la musica di sottofondo, dal comando al repository (v440)
```

La prima: tutti i tipi di personaggio, pupille dentro agli occhi per ogni
espressione e sguardo, espressioni distinguibili, battito, le tre strade
della bocca, una voce sola e la promessa tardiva, pausa, occultamento (fuori
schermo, collina, Luna davanti, eclissi, profondità 3D), dischi grafici
dentro lo schermo e non sovrapposti, validazione con errori in due lingue, e
il motore delle demo vero con cambio scena, salto, riavvio, stop ed errore.
Dalla v409 anche: la terna dello schermo contro la proiezione, la crescita e
il ritorno della misura, un viaggio col motore vero (accanto alla meta, dal
lato e alla distanza giusti, e di nuovo sull'orbita), i percorsi, il
teletrasporto, le animazioni ferme agli estremi, ogni effetto disegnato e
scaduto, la validazione dei comandi nuovi, e lo Studio: ogni modello in due
lingue diventa un copione valido che supera il suo controllo, i giorni divisi
senza buchi, i comandi a parole in italiano e in inglese, gli aiuti, i
progetti rotti.
Dalla v411 anche: il corpo giusto per ogni famiglia (la sonda è una sonda,
l'asteroide un sasso, la cometa ha la coda) col volto dentro al corpo, il
corpo sull'astro e accanto solo quando lì non c'entra, lei e lui
(sopracciglia, labbra, baffi e barba, e nessuna Luna coi baffi), e l'occhio
come apertura fra le palpebre: bordi in ordine e dentro all'ellisse per
ogni espressione, la mezzaluna del sorriso, la palpebra inclinata della
rabbia e della tristezza, la riga ad arco della risata.
Dalla v414 anche: i personaggi nuovi col loro corpo, nome e posto (Betelgeuse
è `Star7`), ogni sagoma nuova disegnata a più istanti, `character_become`
col motore vero (la veste, la misura che arriva a 1,8 e a 0,55, il ritorno
con `self` che vale anche nella scena dopo), Betelgeuse al suo luogo nella
carta, il buco bianco che galleggia senza filo né freccia e non viaggia, il
Sole fuori quadro che non è un occhio gigante, e nello Studio «diventa», le
parole («si gonfia e diventa una gigante rossa» non è anche un «cambia
misura», «torna com'era» non è un ritorno sull'orbita) e il modello `buchi`.
Dalla v416 anche: la regia (chi parla in primo piano con gli occhi in alto al
centro e il volto grande, la finestra sempre dentro alla tela, la pausa dopo
la battuta e il ritorno largo, il dialogo con tutti e due nel quadro, il botto
inquadrato e il quadro che trema, `story_camera` con `close`, `wide` e il
tetto dello zoom, la camera presa a mano e l'opzione spenta, la pausa), ogni
ricetta dei rumori su un contesto audio finto (sorgenti che partono e si
fermano entro quattro secondi, volumi sotto 1, rampe esponenziali su valori
positivi), il silenzio con l'opzione spenta, in pausa e fuori da una demo, il
rumore che non fa la raffica, i comandi che suonano nell'ordine giusto
(pop, boing, explosion, zap, ding) e la casella dello Studio.
Dalla v430 anche: la fisica di ogni personaggio (Mercurio senza atmosfera e
nervoso, le quattro lune di Galileo, Urano coricato, Tritone al contrario,
Caronte), la reazione all'umore (tempeste, prominenze, atmosfera che arrossa,
lune che si stringono e saltano, anelli che si alzano), il disegno che
scivola e il tempo delle lune che non torna indietro, la Luna vera che si
stringe alla Terra impaurita nella 3D, la posa di Urano e di Mercurio,
`story_question` validato e disegnato, e nello Studio la domanda che nasce
dagli eventi (previsione per `buchi`, sonda per `universo`, ragione per
`avventura`, niente per una storia senza eventi), i modi, il tipo scelto,
quella scritta a mano, il salvataggio, e «Io sono…» che non è la luna.
`scripts/giro-storia.js` (`STORIA=storia_stelle`) fa girare «Che fine fanno le stelle?»
intera in un Chromium, con una schermata a metà di ogni scena.
La seconda, in un Chromium senza rete: la sezione della pagina Demo e
l'anteprima, il volto sulla Luna disegnata (stessa proiezione), l'ampiezza di
un WAV vero nel grafo Web Audio, i confini di una sintesi finta, il ritmo del
solo testo, pausa, fuori quadro, i pixel della tela e del fotogramma passato
al registratore, il dialogo nel banco Terra e Luna (chi ascolta guarda chi
parla), salto e stop, l'inglese, il telefono col movimento ridotto, e che le
demo di prima non abbiano volti. Dalla v416 anche la regia nella 3D vera (chi
parla ingrandito, con l'occhio nei pixel della tela e sopra ai sottotitoli,
il botto inquadrato, la camera presa col mouse che toglie la lente) e ogni
rumore reso da un `OfflineAudioContext`: suona, e non esagera.

## Limiti

- Il movimento della bocca non è fonetico: segue ampiezza, parole e
  punteggiatura, non i fonemi.
- La voce del dispositivo (`speechSynthesis`) non espone il segnale: lì la
  bocca segue i confini di parola, e dove il motore non li manda il ritmo
  stimato del testo, che può scostarsi dalla voce vera di qualche decimo.
- L'ampiezza si misura solo a contesto audio in marcia, cioè dopo un gesto: a
  demo avviata da un link senza tocchi la bocca usa le altre due strade.
- I volti non si disegnano nella Didattica e nella mappa del cono d'ombra, né
  sul velo del volo fra le viste. Nella scala cosmica sì (v412).
- La lente della regia ingrandisce anche le tele dipinte una volta (le
  stelle, la Via Lattea), che a ×3 si sgranano un poco; e nel planetario
  ingrandisce i nomi delle stelle e delle costellazioni (nella 3D no). Il
  dito, mentre la lente è chiusa su qualcuno, sceglie dove il disegno sta
  senza lente: ma toccare prende la camera, e la lente si toglie.
- I rumori sono sintetizzati: un'esplosione è un botto da cartone, non una
  registrazione. Senza Web Audio (o prima di un gesto) la storia è muta.
- Il buco bianco non ha un posto: non viaggia, non si raggiunge, e la sua
  misura non dice niente (è un'idea). Le vesti non sono un'evoluzione
  stellare calcolata: sono un costume, alla misura che la storia sceglie.
- Nella scala cosmica i personaggi non cambiano l'istante della carta: le
  galassie non si muovono e le Voyager stanno al posto di oggi. L'incontro di
  Andromeda con la Via Lattea, fra miliardi di anni, lo racconta un viaggio
  della storia, non la carta.
- La Terra nel planetario non è disegnata (ci si sta sopra): lì può parlare,
  ma il suo volto si vede solo nella 3D.
- Il Sole non viaggia (è l'origine della scena 3D); nel planetario nessuno
  viaggia. I viaggi nel banco Terra e Luna funzionano, ma passando dal
  sistema al banco ripartono da dove l'astro si trova.
- I comandi a parole sono parole chiave, non comprensione della lingua: una
  frase che non capiscono la dicono («Non ho capito») invece di indovinare.
