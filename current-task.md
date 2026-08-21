# Task Corrente

L'eclissi di Luna nel planetario — **fatto**, niente in sospeso.

Branch `claude/lunar-eclipse-planetarium-5a2vox`.

## Cos'era

«Controlla l'eclissi di Luna nel planetario, mi sembra sbagliato soprattutto
quando mi avvicino alla Luna. Aggiungi anche le sfumature realistiche sulla
Luna dovute all'atmosfera della Terra.»

Prima cosa: **la geometria era giusta e non è stata toccata.** Vale la pena
scriverlo, perché è il primo posto in cui si va a guardare. `gamma`, `umbra`,
`penombra` e `rL` sono quattro angoli **geocentrici** — il conto va fatto dal
centro della Terra, la parallasse lunare vale un grado, cioè quanto tutta
l'ombra — e il loro rapporto è una distanza in raggi lunari: moltiplicata per
il raggio disegnato dà i pixel giusti a qualunque campo, anche quando la Luna
è disegnata più grande del vero dall'icona dei quattordici pixel. Controllata
contro Astronomy Engine, che le eclissi di Luna le cerca per conto suo: su
otto eclissi di fila tornano il verdetto, la frazione di disco dentro l'ombra
(al millesimo) e le semidurate (al quarto di minuto).

Sbagliato era il **disegno**, e per questo si vedeva ingrandendo: a campo
largo la Luna è quattordici pixel e le due rampe di prima non si leggevano;
avvicinandosi diventavano tutta l'immagine.

## Cosa c'era di sbagliato (tre cose, `app.js` §7.3.2)

1. **La penombra era una rampa lineare.** Un punto nella penombra non è al
   buio: vede ancora una parte del disco del Sole, e la frazione che ne vede
   è l'area comune fra due cerchi — lo stesso conto di un'eclissi di Sole
   (`skyCoperturaDischi`) fatto dall'altra parte. La rampa lineare grigiava
   metà Luna un'ora prima del tempo, e all'orlo dell'ombra piena si fermava a
   un terzo invece che a zero: fra le due restava un **anello scuro**.
2. **Dentro l'ombra piena il gradiente andava al rovescio.** Rosso acceso al
   centro `rgb(150,52,30)` e grigio scuro sull'orlo `rgb(96,60,62)`. In cielo
   è l'esatto contrario: l'orlo è la parte **più chiara** dell'ombra — è la
   luce che ha rasentato solo l'alta atmosfera — e il cuore è il più cupo,
   perché lì arrivano solo i raggi che hanno attraversato tutto lo spessore
   d'aria. Un'eclissi al rovescio, che a occhio resta comunque credibile.
3. **Mancava il turchese.** I raggi che arrivano sull'orlo passano a
   trenta-quaranta chilometri di quota, dove c'è l'**ozono**: la banda di
   Chappuis si mangia il rosso e lascia passare il blu. È la fascia azzurrina
   che si vede in ogni fotografia di totale, ed è la risposta alla richiesta
   delle «sfumature dovute all'atmosfera della Terra».

E una quarta, fuori dall'ombra: **il bagliore**. L'alone attorno alla Luna si
spegneva con la frazione illuminata, che per un'eclissi di Luna è il numero
sbagliato — la Luna è piena, quindi la frazione vale uno, e attorno a un disco
ramato restava il bagliore di un plenilunio. È la cosa che si nota per prima,
prima ancora del colore.

## Com'è adesso

Blocco `// --- L'eclissi di Luna` in `app.js` §7.3.2:

- `SKY_ECL_TONI` — i toni dall'orlo (profondità 0) all'asse (1). La `luce`
  non è fotometria: una totale è diecimila volte più debole di una Luna
  piena, e disegnata così sarebbe un disco nero. È la scala compressa
  dell'occhio, che si adatta — dall'orlo al cuore resta un fattore tre. Il **colore** invece è quello vero.
- `SKY_ECL_OMBRA_LUCE` (0,44) — quanto resta della faccia sull'orlo
  dell'ombra piena. È il punto in cui le due metà si incontrano, e la
  continuità è provata a 0,08 livelli su 255. **Era 0,72 nel primo giro, ed
  è stato il difetto della riga qui sotto.**
- `SKY_ECL_PENOMBRA_ESPONENTE` (1,5) — la penombra come la vede l'occhio:
  col 10% di Sole coperto non si è ancora perso un decimo di luce (91%), poi
  cala in fretta (64% a metà penombra, dove il Sole è coperto per metà).
- `skyEclisseColore(s, rho)` — le due metà: dentro l'ombra i toni, fuori la
  luce che resta del disco solare, col turchese che sfuma mentre il Sole
  torna a scoprirsi (se no fuori dall'ombra piena restava un anello).
- `skyEclisseFermate(s)` — 49 fermate del gradiente, **non equidistanti**:
  22 stanno nel 12% del raggio a cavallo dell'orlo, dove in pochi primi
  d'arco si passa dal turchese al rame. In scala del raggio dell'ombra e non
  dello schermo, quindi valgono a ogni ingrandimento; una memoria a un posto
  solo le rifà quando la geometria cambia, cioè qualche volta al minuto.
- `skyEclisseLuceLuna(s)` — la media della faccia pesata come la vede
  l'occhio, calcolata con lo stesso `skyEclisseColore` del disegno. Finisce
  in `ombraTerra.luce` e la legge il bagliore: in totalità scende al 17%, in
  un'eclissi di sola penombra resta al 70%.

## Il secondo giro: «zummando molto vicino l'ombra scompare»

Segnalato dopo il primo commit. Prima cosa, perché è quella che ha risolto
il dubbio: **il disegno è invariante di scala e non sparisce**. Provato in
due modi. Su tela vera (`@napi-rs/canvas`), `skyDisegnaOmbraLunare` chiamata
con raggi da 14 a 20.000 pixel dà lo stesso identico colore nello stesso
punto della Luna, senza eccezioni. E nell'**app vera** in Chromium — servita
da un server locale, con Astronomy Engine copiato in casa perché il CDN qui
non passa — pilotata da `skyImpostaFov`/`skyCentraSu` e leggendo i pixel
della tela: da 40° a 0,25° di campo `ombraTerra` c'è sempre e il colore
campionato a metà raggio non cambia di un livello.

A sparire non era l'ombra: era il **gradino**. `SKY_ECL_OMBRA_LUCE` l'avevo
messo a 0,72 per non avere una totalità troppo cupa, e quel numero non è la
cupezza della totalità — è quanto la Luna si scurisce **attraversando
l'orlo**. Con 0,72 il passaggio vale un terzo, e a campo pieno si legge
lo stesso perché accanto c'è tutto il resto dell'ombra; ingrandendo, sotto
gli occhi resta **solo** la fascia attorno all'orlo, che dell'ombra è la
parte più chiara, e un terzo di dimming lì non è più un'ombra: è una Luna
un po' velata. Misurato nell'app: sui pixel della Luna il minimo passava da
18 (codice vecchio) a 30–63 (mio primo giro), cioè l'ombra si schiariva del
triplo proprio dove si va a guardare quando si ingrandisce.

Le due manopole fanno due cose diverse, e questo è il punto da ricordare:
`SKY_ECL_OMBRA_LUCE` è il **gradino** (quanto si vede *che* un'ombra c'è),
la curva `luce` di `SKY_ECL_TONI` è il rilievo **dentro** l'ombra (quanto si
vede *com'è fatta*). Alzando la prima per aggiustare la seconda si perde il
gradino. Adesso: gradino basso (0,44 — passando l'orlo la Luna perde più di
metà della luce) e curva piatta (1,00 → 0,60, un fattore tre dall'orlo al
cuore), col resto del contrasto affidato al **colore**, che è quello vero.

## Le prove

**§21 di `verifica.html`**, 19 prove, tutte passate. Come per il §8, il §18 e
il §19 le formule sono una **copia**: quella pagina non carica `app.js`.
Ricopiando va ricopiato tutto il blocco, `ECL_TONI` e le due costanti
comprese.

Sono di due famiglie. La geometria contro Astronomy Engine (verdetto,
oscuramento, semidurate su otto eclissi di fila, più le magnitudini umbrali
del 2025 e del 2026 contro i valori pubblicati). Il profilo per quello che
deve promettere: nessun anello scuro su 600 campioni, l'orlo più chiaro del
cuore, il blu che batte il rosso sull'orlo e il rosso che batte il blu di tre
volte un decimo più dentro, l'incontro senza gradino fra ombra e penombra, il
bianco pieno fuori dalla penombra, e il bagliore che se ne va in totalità ma
resta in una di sola penombra.

Le tre prove aggiunte dopo la segnalazione dello zoom: che **passando l'orlo
dell'ombra la Luna perda più di metà della luce** (è quella che tiene fermo
il gradino), che col 10% di Sole coperto non ne abbia ancora perso un decimo,
e che a metà penombra sia velata ma non in ombra.

## Cosa NON è stato toccato

- La geometria di `skyOmbraDellaTerra` (§7.2): è giusta, provata.
- La simulazione dell'evento (§8) e la vista «Le eclissi lunari» (§1-quinquies):
  hanno un disegno loro, e la richiesta era sul planetario.
- Il banco Terra e Luna della vista 3D (§7.7-quater): lì i coni d'ombra sono
  già a scala vera e li guarda il §18.
