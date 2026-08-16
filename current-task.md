# Task Corrente

Il mare nel planetario: dove `terreno.js` dice che c'è acqua, adesso c'è una
**superficie** invece di una velatura blu.

**Com'era.** `terreno.js` sapeva da mesi che a ponente di Genova c'è mare e non
prato, e il planetario lo diceva con un velo azzurro steso sotto la linea
dell'orizzonte, che si spegneva venticinque gradi più giù. Era un'etichetta:
chi apre il planetario in riva al mare non ha bisogno che gli si dica che da
quella parte c'è il mare — lo sa — vuole ritrovarcelo.

**Cosa c'è adesso**, nel blocco `// --- Il mare ---` di `app.js` §7.3.2
(prefisso `skyMare`), chiamato da `skyDisegnaTerreno` fra la grana e il profilo
delle creste:

- **La prospettiva vera.** `skyMareDepressione(s, h)` e la sua inversa
  `skyMareDistanza(dep, h)`: Terra tonda, rifrazione di `terreno.js`. Da lì
  viene tutto. Dalla battigia l'orizzonte è a 4,8 km e **il 98% di quella
  distanza sta nel primo grado sotto la riga**; da una scogliera a 300 m è a
  66 km e il primo grado ne contiene molto meno. La compressione enorme non è
  un effetto: è la geometria, e si vede.
- **Il colore da Fresnel** (`skyMareColore`): di striscio l'acqua è uno
  specchio e riflette il cielo, a picco è una finestra sul blu-verde cupo. Da
  qui viene gratis il mare che si accende di arancione al tramonto, senza che
  ci sia una riga che parli di tramonti.
- **Le onde** (`SKY_MARE_ONDE`, `skyMareOnda`, `skyMareCreste`): quattro
  componenti in coordinate metriche vere attorno a chi guarda, con la
  dispersione dell'acqua profonda (`ω = √(gk)`, le lunghe corrono più delle
  corte). Lontano sono righe di luce sulle punte, vicino diventano campiture —
  il tratto è spesso quanto la fascia è alta sullo schermo.
- **La strada di luce** (`skyMareLuccichio`, `skyMareStrada`): non è dipinta.
  La faccia d'onda che rimanda l'astro nell'occhio ha per normale `n ∝ s − d`,
  e da quanto è inclinata esce la probabilità di trovarne una così. Le due
  forme che tutti riconoscono vengono da sé: astro basso → colonna fino
  all'orizzonte, astro alto → chiazza ai piedi.

**Le tre cose che sono costate di più**, tutte e tre invisibili a occhio:

1. `skyMareDistanza(skyMareDip(h), h)` tornava **infinito** dalla battigia —
   l'arcocoseno di un numero che in doppia precisione vale esattamente uno — e
   il mare non si disegnava per niente. Da lì `skyMareOrizzonte(h) = R·δ`.
2. Il corpo dell'acqua costava **quattro millisecondi**: cinquantacinque
   `createLinearGradient` a fotogramma. Misurato allargando il passo, il costo
   scendeva col numero dei riempimenti e non con la superficie: non erano i
   pixel, erano le chiamate. Adesso il gradiente è uno solo per fotogramma
   (forma radiale attorno al cerchio dell'orizzonte, come fa già il suolo) e
   l'opacità la mette `globalAlpha`. Il mare costa 0,3–0,5 ms.
3. Alla riva la campitura si spezza per livello di opacità, e i pezzi lunghi
   una colonna sola venivano saltati: al posto della sfumatura di costa
   restava una **riga verticale netta**.

Toccati anche: `skyDisegnaVeloPaesaggio` (il mare non ci passa più, resta la
sola montagna) e `col.fondo` di `skyDisegnaProfiloOrizzonte`, moltiplicato per
`(1 − col.mare)` — se no da una scogliera le fette di distanza dell'acqua
venivano disegnate come terreno, cioè venti gradi di terrazze.

**Provato** con Playwright/Chromium a 900×700 su un terreno finto costruito con
la vera pipeline di `terreno.js` (mare da 200° a 340°, colline per il resto):
battigia di giorno, al tramonto e a 120° di campo, Luna bassa sul mare, notte
senza astri, scogliera a 300 m, monte a 1400 m, costa mista. Nessun errore in
console. Controllato che **entroterra e terreno spento diano un fotogramma
identico** con e senza il modulo, cioè che chi non ha mare non veda alcuna
differenza. Nuovo §19 in `verifica.html` (30 prove: distanza dell'orizzonte
contro la regola dei naviganti, invertibilità, compressione, Fresnel, la
geometria del luccichio con la faccia d'onda a metà dell'altezza dell'astro,
dispersione delle onde, filtro anti-tremolio): **tutte e 357 le prove della
pagina passano**. `node --check app.js` pulito. `CACHE_NAME` → `astrocal-v104`.

[x] Completato.
