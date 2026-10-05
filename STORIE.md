# Storie cosmiche

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
| `famiglia` | `stella`, `pianeta`, `luna`, `nano`, `asteroide`, `cometa`, `stazione`, `sonda` | dedotta dall'oggetto |
| `nome` | chiave del dizionario del nome | il nome che l'app gli dà già (`corpo.<id>`, `SOL_LUNE`, …) |
| `pelle` | colore del disco grafico e delle palpebre | il colore dell'app per quell'oggetto |
| `iride` | colore degli occhi | della famiglia |
| `sottotitolo` | colore del nome nel sottotitolo (su fondo scuro: va chiaro) | della famiglia |
| `guance` | colore del rossore | della famiglia |
| `genere` | `f` o `m`: i tratti di lei o di lui (§Lei e lui) | della famiglia |
| `sagoma` | il corpo disegnato (§I corpi): `stella`, `pianeta`, `luna`, `anelli`, `asteroide`, `cometa`, `voyager`, `iss`, `tiangong`, `hubble` | della famiglia |
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
(inclinazione in radianti), `rimbalzo`, `tremito` e `segno` (il segno da
fumetto); e le chiavi `storie.espressione.<nome>` (e
`storie.espressioneLei.<nome>`, la forma femminile che lo Studio usa per
lei) nei due dizionari, più `studio.parole.umore.<nome>`. Il DSL la accetta
da sé. Di serie ci sono `neutral`, `happy`, `laughing` (v411), `surprised`,
`worried`, `sad`, `thinking`, `excited`, `love` (v411), `angry` (v411) e
`sleepy`. Sono **esagerate di proposito**: un volto largo
settanta pixel, per dei bambini, si legge solo se dice una cosa sola e la
dice forte.

**Le forme della bocca** (`STOR_BOCCHE`): `chiusa`, `piccola`, `A`, `E`, `O`,
`sorriso` (aperto, coi denti di sopra), `grande`, `risata`, `triste` (col
labbro che trema), `ondulata`, `denti` (i denti stretti della rabbia), con
mezza larghezza, apertura, rotondità, curvatura, `onda` (la bocca che trema)
e `denti`.

## Lei e lui (v411)

Ogni personaggio ha un `genere` (`f`, `m`), che segue il nome italiano e il
mito: la Luna, la Terra, Venere, Io, Europa, Callisto, le stazioni e le
Voyager sono lei; il Sole, Mercurio, Marte, Giove, Saturno, Urano, Nettuno,
Plutone, Ganimede, Titano e Hubble sono lui. Una famiglia ha il suo di
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

## Lo stile: la fiaba d'inchiostro (v408)

Un pennino indaco scuro (`INCHIOSTRO`, mai nero puro) a spessore variabile —
sopracciglia e ciglia sono tratti affusolati (`tracciaPennino`), il contorno
dell'occhio è grosso sopra e sottile sotto —, stesure piatte con un'ombra sola
a taglio netto e, dentro all'ombra degli adesivi, il **retino** a puntini dei
fumetti stampati. Sotto ogni tratto un alone color panna (`ALONE`). Il disco
grafico è un **adesivo** (`disegnaAdesivo`): ombra piatta spostata, bordo
panna, riflesso a virgola; il filo che lo lega all'astro è tratteggiato e
scorre. L'anteprima della pagina Demo usa lo stesso adesivo su un cielo
d'inchiostro.

**I segni da fumetto** (§6-bis, `storDisegnaSegno`): scintille (happy,
excited), raggi della sorpresa, lacrima che scende (sad), goccia di sudore
(worried), bolle del pensiero (thinking), zeta del sonno (sleepy). Le zeta
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
| `effect` | `type` (`explosion`, `shockwave`, `flash`, `sparkles`, `fireworks`, `smoke`, `hearts`, `lightning`, `shooting_star`, `glow`, `confetti`), `target?` (un oggetto) o `at?` (`center`, `left`, `right`, `top`, `bottom`), `size?` (0,2–5), `color?` (`'#rrggbb'`), `duration?` (secondi, 0,3–20) |

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
- **5 · Guarda e salva**, di nuovo in fondo.

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
  speciali. Ognuno è una storia intera, vera, che supera il suo stesso
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
  viaggio nel planetario, nessun momento vuoto, copione valido.
- **Salvare**: i progetti in `astrocal_storie_progetti_v1` (esporta e
  importa in JSON, `studioRipulisci` tiene solo quello che il modello
  conosce); «Salva nelle mie demo» mette il copione nella libreria delle demo
  (`demoPaginaRicarica` rifà l'elenco senza buttare un testo che si sta
  scrivendo nell'editor). Né i progetti né le demo personali sono nel backup
  JSON dell'app.
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
La seconda, in un Chromium senza rete: la sezione della pagina Demo e
l'anteprima, il volto sulla Luna disegnata (stessa proiezione), l'ampiezza di
un WAV vero nel grafo Web Audio, i confini di una sintesi finta, il ritmo del
solo testo, pausa, fuori quadro, i pixel della tela e del fotogramma passato
al registratore, il dialogo nel banco Terra e Luna (chi ascolta guarda chi
parla), salto e stop, l'inglese, il telefono col movimento ridotto, e che le
demo di prima non abbiano volti.

## Limiti

- Il movimento della bocca non è fonetico: segue ampiezza, parole e
  punteggiatura, non i fonemi.
- La voce del dispositivo (`speechSynthesis`) non espone il segnale: lì la
  bocca segue i confini di parola, e dove il motore non li manda il ritmo
  stimato del testo, che può scostarsi dalla voce vera di qualche decimo.
- L'ampiezza si misura solo a contesto audio in marcia, cioè dopo un gesto: a
  demo avviata da un link senza tocchi la bocca usa le altre due strade.
- I volti non si disegnano nella scala cosmica, nella Didattica e nella mappa
  del cono d'ombra, né sul velo del volo fra le viste.
- La Terra nel planetario non è disegnata (ci si sta sopra): lì può parlare,
  ma il suo volto si vede solo nella 3D.
- Il Sole non viaggia (è l'origine della scena 3D); nel planetario nessuno
  viaggia. I viaggi nel banco Terra e Luna funzionano, ma passando dal
  sistema al banco ripartono da dove l'astro si trova.
- I comandi a parole sono parole chiave, non comprensione della lingua: una
  frase che non capiscono la dicono («Non ho capito») invece di indovinare.
