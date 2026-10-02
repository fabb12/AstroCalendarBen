# Storie cosmiche

Racconti per bambini in cui gli astri hanno un **volto** e una **voce** e
spiegano un fenomeno vero. Una Storia cosmica è una demo come le altre
(`DEMO.md`): stesso motore, stesso orologio, stessa voce. Il codice sta in
`storie-cosmiche.js` (prefisso `stor`), le storie in `demo-predefiniti.js`
(voci con `storia: true`), i testi nei due dizionari.

Si trovano nella pagina **Demo**, gruppo **7 · Storie cosmiche**: una scheda
per storia (titolo, durata, personaggi con la loro personalità, **Guarda la
storia**, **Duplica e modifica**), l'anteprima di un personaggio (scegli chi e
con che espressione, poi **Fallo parlare**: funziona anche offline e senza
nessuna vista astronomica) e l'esempio del DSL. Le storie compaiono anche
nell'elenco generale delle demo.

## Tre promesse

1. **Il cielo resta vero.** Il modulo non calcola posizioni e non sposta
   niente. I volti si appoggiano dove i renderer esistenti hanno appena
   disegnato l'astro: la ricevuta di `skyDisegnaAstro` e di
   `corpiMinoriDisegna` nel planetario (`storRicevuta`), i corpi già
   proiettati da `solDisegna` e da `solDisegnaVicino` nella vista 3D
   (`storDisegnaSistema`). Niente seconda proiezione. Una falce resta una
   falce (il volto ci sta sopra), un puntino resta un puntino (il volto sta in
   un **disco grafico** accanto, con un filo e un anello che lo legano
   all'astro vero). La storia sceglie la sera, il luogo e la camera, come ogni
   demo; le fasi e le distanze sono quelle di quell'istante.
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
| `forma` | `disco` o `riquadro` (il supporto quando il volto sta fuori) | `disco`; `riquadro` per stazioni e sonde |
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

**Gli occhi**: bianco con un filo d'azzurro in basso, iride a gradiente col
colore del personaggio, pupilla, due riflessi, palpebra di sopra e di sotto
(pelle scurita), riga delle ciglia sul bordo, contorno scuro con un alone
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
broncio), `guance`, `sguardo` (`null` o `{ x, y }`), `spostaBocca`; e le
chiavi `storie.espressione.<nome>` nei due dizionari. Il DSL la accetta da
sé. Di serie ci sono `neutral`, `happy`, `surprised`, `worried`, `sad`,
`thinking`.

**Le forme della bocca** (`STOR_BOCCHE`): `chiusa`, `piccola`, `A`, `E`, `O`,
`sorriso`, `triste`, con mezza larghezza, apertura, rotondità e curvatura.

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
| `character_show` | `target`, `expression?`, `look?` (`viewer` o un oggetto), `size?` (`auto`, `disk`, `badge`) |
| `character_expression` | `target`, `expression` |
| `character_look_at` | `target`, `object` (`viewer`/`camera` o un oggetto) |
| `character_blink` | `target` |
| `character_speak` | `target`, `id` (chiave del dizionario) **oppure** `text` (al più 400 caratteri) |
| `character_hide` | `target` |

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
