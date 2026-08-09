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

## Se il disegno risulta spostato, o troppo grande

L'entrata può essere un oggetto invece di una stringa. Tre manopole, in
ordine di fatica:

```js
Tau: { file: 'toro.png', margine: 1.35, sposta: [0.05, -0.10] }
```

| Campo | Cosa fa |
|---|---|
| `margine` | quanto il disegno deborda dalle stelle. `1` = i bordi del disegno toccano le stelle di bordo della figura; il valore di serie è `1.2`. |
| `sposta` | scosta il disegno, in frazioni del riquadro delle stelle: `[0.1, 0]` lo sposta di un decimo verso destra. |
| `forza` | quanto si vede, rispetto al normale (`1`). |
| `tinta` | `'originale'` per tenere i colori del disegno, o un colore CSS. |
| `sfondo` | `'bianco'` o `'trasparente'` per scavalcare il riconoscimento automatico. |

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

Con le tre ancore il riquadro automatico non viene nemmeno calcolato:
l'immagine ci si incolla sopra esattamente. Le coordinate delle stelle si
leggono in `dati-costellazioni.js` (sono i vertici delle spezzate della
figura); i pixel si leggono aprendo l'immagine in un qualsiasi editor.

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
