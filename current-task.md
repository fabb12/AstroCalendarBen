# Task Corrente

Due cose, e la seconda è nuova: l'acqua del mare più vera, e **i laghi e i
fiumi**, che prima non c'erano affatto.

## 1. Il mare che fa il vento vero

Fin qui la ruvidezza e la direzione delle onde erano due numeri scritti nel
codice: un mare uguale a Genova e a Trieste, uguale con la bonaccia e con la
libecciata. Ma il vento l'app ce l'ha già — è la stessa previsione oraria che
dice il seeing — e adesso da lì viene tutto (`skyMareStato`, `skyMareOggi`):

- **la ruvidezza** con Cox e Munk (`σ² = 0,003 + 0,0051·W`): tre gradi col
  solo mare lungo, tredici con dieci metri al secondo;
- **la lunghezza dell'onda** con Pierson e Moskowitz (`T ≈ 0,78·W`,
  `λ = gT²/2π`): venti metri a cinque, quasi cento a dieci;
- **la direzione**, che è quella del vento girata di mezzo giro;
- **le creste bianche** da sette metri al secondo in su — che è la cosa che
  a occhio dice «oggi tira» molto prima dell'altezza delle onde.

A `meteo-astro.js` è stato aggiunto `wind_direction_10m` (due righe). Senza
previsione si torna a una brezza da ponente di cinque metri al secondo, che
è il mare che c'era scritto prima.

Poi **l'aureola** (`SKY_MARE_AUREOLA`), che era il buco più grosso: attorno
al Sole il cielo è molto più chiaro per una trentina di gradi, ed è la
ragione per cui guardando verso il tramonto *tutto* il mare si accende e non
solo la striscia sotto all'astro. Fin qui c'era il solo riflesso speculare e
attorno l'acqua restava del suo blu medio. È la stessa geometria della strada
di luce con una gaussiana più larga; a distinguerle è **quanto si sommano**:
la strada è il Sole (non si smorza con Fresnel — anche il due per cento
riflesso a picco resta accecante), l'aureola è cielo e si vede quanto Fresnel
la lascia vedere, cioè tanto all'orizzonte e quasi niente ai piedi.

## 2. I laghi e i fiumi

Il mare questo file lo sapeva già trovare da sé: una direzione in cui il
suolo dà zero per sessanta chilometri è acqua. Un lago no — il Garda sta a
sessantacinque metri, un laghetto alpino a duemila, e per il modello del
suolo sono terreno pianeggiante. Quindi si chiedono a OpenStreetMap, che è
già la fonte dei paesi e delle vette e ha il pregio di sapere **la forma**.

**`terreno.js` §12** (prefisso `acque`): `acqueDaOverpass` chiede i poligoni
dei laghi (vie *e relazioni* — il Garda è una relazione) e le linee dei
corsi d'acqua; `acqueTaglia` tira un raggio ogni mezzo grado e segna dove
taglia i bordi — solo contro i lati che quel raggio può incontrare, se no
sono milioni di prove; `acqueBandeDaTagli` ne fa gli intervalli di distanza.
È pura geometria, e per questo si salva così com'è. `acqueVisibili` ci mette
sopra il terreno: quota dell'acqua, occlusione, e sotto la linea
dell'orizzonte.

**`app.js`**, blocco `// --- I laghi e i fiumi ---`: `skyAcqueStrisce` lega
fra loro le bande di colonne vicine (uno specchio = un poligono, non un
riempimento per mezzo grado) e `skyAcquaStriscia` lo disegna con le **stesse**
funzioni del mare — Fresnel per il colore, il campo d'onda per la tessitura,
la bisettrice per il riflesso — ma con un'acqua più liscia (mezzo sigma per
un lago, un quarto per un fiume: su tre chilometri di fetch il vento ha molto
meno spazio) e più verde. Sotto il pixel e mezzo la striscia non si riempie,
si traccia: è il caso normale di ogni fiume, che da lontano è una riga.

Tasto **Laghi e fiumi** nel pannello Visualizzazione, raggio (25 km di serie)
e interruttore nelle Impostazioni, chiave `astrocalendario_acque` nel backup.

### Le tre cose che sono costate di più, tutte invisibili a occhio

1. **L'occlusione con la cresta tosata a zero.** `terrenoCrestaDavanti`
   risponde a «quanto *copre* il terreno» e tosa i negativi. Ma l'acqua sta
   sotto la linea dell'orizzonte per definizione: confrontata con uno zero
   risultava nascosta **sempre**, e di laghi non se ne vedeva mai nessuno.
   Serve la cresta grezza (`acqueCrestaGrezza`), quella che scende sotto lo
   zero — la stessa che disegna la conca davanti a chi guarda da una cima.
2. **L'ordine di disegno.** Il mare va *prima* del profilo delle creste (a
   nasconderlo è un promontorio davanti); i laghi *dopo*, perché stanno
   dentro al paesaggio e il disegno a fette di distanza dipinge la conca come
   terreno pieno. Passando prima, il lago finiva sotto la collina che gli sta
   dietro.
3. **La quota del lago.** Si legge dalla griglia grezza (`terreno.quote`,
   tenuta apposta: `fronti` è il massimo accumulato e da lì non si torna
   indietro) prendendo il **minimo** dei campioni dentro allo specchio. Con
   quello più vicino, un campione che pesca sulla riva alzava il lago di
   qualche metro — a due chilometri un decimo di grado, cioè un lago che
   galleggia sopra alla sua conca.

E una di disegno: la strada di luce su un lago, disegnata a tratti per riga,
veniva fuori come una pila di mattoni. Adesso è a bande con il gradiente
lungo di loro, come sul mare, e i bordi si spengono da sé.

## Provato

Playwright/Chromium, terreno e acque finti fatti passare per le **vere**
pipeline (`terrenoMonta`/`terrenoApplica`, `acqueLeggiElementi`/`acqueApplica`):
lago dal versante al tramonto, lago di notte con la Luna bassa, fiume in
pianura e dal poggio, e un caso senza acqua — che non disegna niente e costa
zero. Riprovate tutte le otto scene del mare, e ricontrollato che
**entroterra e terreno spento diano un fotogramma identico** con e senza i
moduli dell'acqua. Nessun errore in console.

`verifica.html`: nuovo **§19-bis** (il mare che fa il vento: Cox e Munk,
Pierson e Moskowitz, il mezzo giro fra «da dove viene» e «dove vanno», la
soglia della schiuma) e **§20**, che a differenza del mare prova le funzioni
**vere** — `terreno.js` è caricato in quella pagina: raggio al centro di un
lago tondo, corda che si accorcia verso il bordo, gradi d'orizzonte occupati,
due laghi in fila, fiume di traverso e di sbieco, quota come minimo, cresta
grezza contro cresta tosata, lago dietro alla montagna, lago più alto
dell'occhio. **Tutte e 391 le prove della pagina passano.**

`node --check` pulito su `app.js`, `terreno.js`, `ui-nuova.js`,
`meteo-astro.js`. `CACHE_NAME` → `astrocal-v105`.

[x] Completato.
