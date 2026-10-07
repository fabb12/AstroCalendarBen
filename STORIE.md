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
| `famiglia` | `stella`, `pianeta`, `luna`, `nano`, `asteroide`, `cometa`, `stazione`, `sonda`, `galassia`, `buco` | dedotta dall'oggetto |
| `nome` | chiave del dizionario del nome | il nome che l'app gli dà già (`corpo.<id>`, `SOL_LUNE`, …) |
| `pelle` | colore del disco grafico e delle palpebre | il colore dell'app per quell'oggetto |
| `iride` | colore degli occhi | della famiglia |
| `sottotitolo` | colore del nome nel sottotitolo (su fondo scuro: va chiaro) | della famiglia |
| `guance` | colore del rossore | della famiglia |
| `genere` | `f` o `m`: i tratti di lei o di lui (§Lei e lui) | della famiglia |
| `sagoma` | il corpo disegnato (§I corpi): `stella`, `pianeta`, `luna`, `anelli`, `asteroide`, `cometa`, `voyager`, `iss`, `tiangong`, `hubble`, `galassia`, `gigante_rossa`, `nana_bianca`, `supernova`, `buco_nero`, `buco_bianco` | della famiglia |
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
- **Le prominenze** delle stelle: archi di plasma dal bordo, di più e più
  alti con la rabbia e l'entusiasmo (e parlando); oltre una certa rabbia,
  un'espulsione di massa che parte e si allarga.
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
| `character_show` | `target`, `expression?`, `look?` (`viewer` o un oggetto), `size?` (`auto`, `disk`, `badge`, `real`) |
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
| `story_camera` (v416) | `mode` (`auto`, `wide`, `close`), `target?` (con `close`, un personaggio in scena), `zoom?` (1–4, il tetto del primo piano) |
| `sound` (v416) | `type` (uno dei rumori di `STOR_SUONI`), `volume?` (0–2) |
| `story_question` (v430) | `text`, `a?`, `b?`, `kind?` (`who_is_right`, `probe`, `trust`, `explore`, `choice`, `prediction`, `next_star`), `from?` (chi la pone): §La domanda al pubblico |

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

**Tace** col movimento ridotto, quando la persona prende la camera
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
- **Il cartello del luogo** (`storDisegnaCartelloLuogo`, `StorieCosmiche.cartelloLuogo`):
  un cartiglio d'inchiostro in alto al centro, fuori dalla lente, con «Sei
  qui» piccolo in oro e il nome del luogo grande, due stelline ai lati e un
  pop quando il luogo cambia. Planetario: `storie.luogo.cielo`; 3D:
  `cosmo.pianeti.nome`; banco Terra e Luna: `cosmo.terraLuna.nome`; scala
  cosmica: `cosmo.<struttura>.nome` della struttura più vicina alla scala
  (`cosmStrutturaDellaScala`; fra due tappe resta l'ultima, `cosm.luogoStoria`),
  quindi in volo si leggono le tappe una dopo l'altra (Eliopausa, Nube di
  Oort, Gruppo Locale…). C'è anche con le scritte spente; sotto i 640 px di
  larghezza scende sotto al cartello della data.

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

Nello Studio, in «Inquadratura e data», la casella **«La camera va vicino a
chi parla»** (`cameraViva` della scena, accesa di serie): spenta, la scena
porta `story_camera { mode: wide }`.

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
  «Salva nelle mie demo», e il resto (duplica, esporta, importa, copione,
  elimina) in «Altro»;
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
  IndexedDB `astrocal-studio-voci`) o scaricato da «Altro → File delle
  voci». Ogni momento che parla ha un numero fisso (`voce`, col contatore
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
- **Le storie sul repository** (v424, §6b di `storie-studio.js`): le storie
  salvate nelle demo stanno anche nel repository GitHub, in
  `storie-studio/storie.json` (`studioFileCondivise`), e ogni dispositivo le
  legge all'avvio dall'API dei contenuti (senza token, con
  `raw.githubusercontent.com` di riserva) e le mette fra progetti e demo
  (`libreria.metti`, la demo tiene la sua chiave). Scrivere vuole un token
  fine-grained («Contents: Read and write») in «Altro → Repository GitHub»
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

## Prove

```
node scripts/prova-storie.js            # il motore, senza browser
node scripts/prova-storie-browser.js    # planetario, 3D, voce, filmato, telefono, inglese
node scripts/prova-storie-repo.js       # le storie dello Studio sul repository (v424)
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
