# I disegni delle costellazioni

Qui dentro stanno i disegni fatti a mano che il planetario appoggia sopra le
stelle. Un file per figura. Il codice che li mette in cielo è la **sezione
5-bis** di `costellazioni.js`.

## Aggiungerne uno

Due passi.

**1. Metti il file in questa cartella.**

```
arte-costellazioni/leone.png
```

**2. Aggiungi una riga a `COST_IMMAGINI`, in `costellazioni.js` (§5-bis).**

```js
const COST_IMMAGINI = {
  Tau: 'toro.png',
  Leo: 'leone.png'        // ← la riga nuova
};
```

La sigla è quella IAU a tre lettere (`Tau`, `Leo`, `Ori`, `UMa`…): è la stessa
che sta in `dati-costellazioni.js`.

Fatto. Non c'è nient'altro da toccare: né `index.html`, né `sw.js`, né il
workflow di pubblicazione. Il disegno si appoggia da solo sulle stelle della
figura, e da lì in poi gira col cielo, si stira con la proiezione e si
ingrandisce con lo zoom esattamente come i disegni a curve.

## Com'è fatto un file che funziona

- **Formato**: PNG (o JPEG, o WebP). Il PNG è preferibile.
- **Misura**: da 800 a 2000 pixel sul lato lungo. Più grande non serve — a
  schermo una figura è larga qualche centinaio di pixel — e pesa e basta.
- **Inchiostro scuro su fondo bianco**: è il caso normale, ed è quello che
  esce da una tavoletta grafica o da una scansione. Il codice rovescia da sé
  la carta in trasparenza: quanto più un punto è scuro, tanto più diventa
  opaco, e il fondo bianco sparisce. Un PNG che ha già il fondo ritagliato
  (trasparente) viene riconosciuto e lasciato stare.
- **La figura al centro, e che riempia il foglio.** L'appoggio automatico
  presume questo. Il modo più sicuro di ottenerlo è disegnare **sopra a una
  schermata del planetario**, ricalcando le linee della costellazione: così
  il disegno nasce già nelle proporzioni giuste.
- **Colore**: quello che si vuole. In cielo il disegno viene ricolorato del
  viola dei disegni, perché immagine e curve devono sembrare la stessa cosa.
  Per tenere i colori originali si scrive `tinta: 'originale'` (sotto).

## Allineare il disegno alle stelle

L'entrata può essere un oggetto invece di una stringa, e porta cinque
manopole:

```js
Tau: { file: 'toro.png', margine: 1.35, scala: [1.1, 1],
       gira: -6, specchio: 'x', sposta: [0.05, -0.10] }
```

| Campo | Cosa fa |
|---|---|
| `margine` | quanto il disegno deborda dalle stelle. `1` = i bordi del disegno toccano le stelle di bordo della figura; di serie è `1.2`. |
| `scala` | ingrandimento in più. Un numero (`1.1`) ingrandisce tutto; una coppia (`[1.1, 1]`) stira su un asse solo. |
| `gira` | gradi **in senso orario**, come il «ruota a destra» di un editor di immagini. |
| `specchio` | `'x'` ribalta destra-sinistra, `'y'` sopra-sotto, `'xy'` tutt'e due. |
| `sposta` | scosta il disegno in frazioni del riquadro delle stelle: `[0.1, 0]` lo sposta di un decimo **verso destra**, `[0, 0.1]` di un decimo **verso il basso**. |
| `forza` | quanto si vede, rispetto al normale (`1`). |
| `tinta` | `'originale'` per tenere i colori del disegno, o un colore CSS. |
| `sfondo` | `'bianco'` o `'trasparente'` per scavalcare il riconoscimento automatico. |

**L'ordine conta**, e questo è quello in cui si applicano:

1. il disegno viene portato grande quanto le stelle, × `margine`
2. × `scala`
3. specchiato, se `specchio`
4. girato di `gira` gradi in senso orario
5. scostato di `sposta`

`gira` gira anche gli assi di `scala` (quindi `scala: [1.2, 1]` con
`gira: 90` stira in verticale), mentre `sposta` viene per ultimo e vuol
dire sempre «più a destra, più in basso» qualunque sia l'inclinazione del
disegno — così si corregge guardando lo schermo, senza rifare i conti.

## Trovare i numeri senza impazzire

Cambiare un numero, salvare, ricaricare, riaprire il planetario e
riinquadrare la figura è mezzo minuto per tentativo, e i tentativi sono
tanti. Non serve: **col planetario aperto sulla figura, dalla console del
browser**:

```js
costArteRegola('Tau', { gira: -6, scala: 1.1 })   // si vede subito
costArteRegola('Tau', { gira: -4 })               // ancora un po'
costArteMostra('Tau')                             // la riga da incollare
```

`costArteRegola` cambia l'entrata viva e il fotogramma dopo il disegno è
già lì. Quando torna, `costArteMostra` stampa l'entrata **come va scritta
in `COST_IMMAGINI`**, con dentro solo le manopole che sono state davvero
toccate:

```
  Tau: { file: 'toro.png', scala: 1.1, gira: -4 },
```

Si incolla e si è finito. (Se stampa la forma breve, `Tau: 'toro.png'`,
vuol dire che il disegno andava bene com'era.)

## Se si vuole la precisione al pixel

Si dichiarano **tre ancore**: tre stelle vere della figura, e dove stanno
nell'immagine. Ogni riga è `[ascensione retta in ore, declinazione in gradi,
pixel x, pixel y]`.

```js
Tau: {
  file: 'toro.png',
  ancore: [
    [5.4382, 28.6075,  190,   35],   // Elnath (beta Tauri)  → punta del corno
    [5.6274, 21.1425,   68,  218],   // zeta Tauri           → punta dell'altro corno
    [3.4528,  9.7327, 1105,  690]    // lambda Tauri         → la spalla
  ]
}
```

Con le tre ancore il riquadro automatico non viene nemmeno calcolato, e le
cinque manopole qui sopra vengono ignorate: dicono la stessa cosa in un
modo più scomodo. Tre punti fissano posizione, misura, rotazione,
stiramento e specchio tutti insieme — e li fissano *sulle stelle*, che è
meglio che fissarli rispetto a un riquadro.

Le coordinate delle stelle si leggono in `dati-costellazioni.js` (sono i
vertici delle spezzate della figura); i pixel si leggono aprendo
l'immagine in un qualsiasi editor.

È lo stesso modo in cui Stellarium ancora le sue illustrazioni — quindi chi
ha già tarato un'immagine per Stellarium può portarsi dietro i numeri.

## Se il file non c'è

Non succede niente. La richiesta fallisce una volta sola, non si riprova
più, e la figura torna al suo disegno a curve (quello della §2 di
`costellazioni.js`). È voluto: una riga scritta in `COST_IMMAGINI` prima di
aver caricato l'immagine non rompe il planetario a nessuno.

## Perché non stanno nel service worker

`sw.js` non li elenca fra gli `ASSETS`, ed è la stessa scelta dei
`dati-*.js`: sono immagini, e scaricarle tutte all'installazione a chi il
planetario non lo aprirà mai è spreco. La regola «tutto quello che viene da
questa stessa origine, conservalo» le mette in cache appena passano — da
quel momento ci sono anche in campo, senza rete.
