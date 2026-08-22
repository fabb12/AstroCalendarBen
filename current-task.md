# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — la distanza dei paesi sull'orizzonte

Richiesta: far vedere «in modo semplice e immediato» quanto è lontano ogni
paese nominato sull'orizzonte del planetario.

### Il ragionamento

Un nome sull'orizzonte risponde a metà della domanda. «Rimini» dice cos'è quel
chiarore a sud-est; non dice se sono sei chilometri o quaranta, che è il numero
da cui dipende tutto il resto — se conviene spostarsi di mezz'ora per
lasciarselo dietro, o se è la cupola con cui bisogna convivere.

Scrivere la distanza accanto a ogni nome sarebbe finita lì, ma **sette numeri
appesi al crinale sono sette numeri da leggere uno per uno**, e nessuno lo fa:
a colpo d'occhio non si vuole la misura, si vuole *l'ordine* — chi sta davanti
e chi sta in fondo. E l'ordine lo racconta l'aria.

Da lì la decisione che tiene insieme tutto il resto: **non si inventa nessuna
scala nuova**. Il disegno dell'orizzonte una legge della foschia ce l'ha già
(`SKY_FOSCHIA_KM`, e le diciotto fette di `skyPianiOrizzonte` che ne escono),
e il nome di un paese si vela **esattamente quanto la fetta di terreno alla sua
distanza**. `skyLontananzaCitta` è la stessa riga, e il §23 di `verifica.html`
controlla che le due non divergano di una cifra. Se divergessero si vedrebbe,
e si vedrebbe come un difetto: un nome nitido appoggiato a una montagna
sbiadita è un'etichetta incollata sul paesaggio, non un paese che sta là in
fondo.

### Cosa c'è adesso — `app.js`, blocco «Quanto è lontano quel paese»

Da quel numero solo (`skyProspettivaCitta`) escono **insieme** tutti i segnali
della distanza: il corpo del carattere (14 → 10 px), l'opacità (1 → 0,4), lo
spessore del filo di richiamo (1,5 → 0,55 px) e **l'ombra scura**, che se ne va
molto prima del nome — un nome lontano non è un nome piccolo, è un nome *senza
ombra*, ed è lì che sta quasi tutto il contrasto netto di un'etichetta.

La tinta scivola verso la foschia di adesso, ma **pesata sulla sua luminosità**:
di giorno la foschia è chiara e il nome lontano si scolora verso il
grigio-azzurro (che è quello che si vede in fondo a una valle), di notte è
quasi nera e mescolarcisi vorrebbe dire **cancellare** il nome invece di
allontanarlo. Il contro-esempio è nelle prove: senza quel peso, di notte
l'ambra finisce a un grigio da 141 livelli.

Il **numero** resta, ma smette di essere il soggetto: `Bologna · 9 km`, due
punti più piccolo, peso normale, il 62% dell'opacità del nome, intero e mai
zero. E non su tutti insieme: su quello che il **mirino** sta indicando — che è
il modo in cui la domanda viene fatta davvero — e su tutti sotto i 40° di
campo. Il paese indicato torna leggibile (`SKY_CITTA_INDICATO_VELO`) ma **non**
cambia corpo né tinta: dov'è non cambia perché lo si sta guardando.

Il posto lo prenota **il più vicino per primo**. Chi entra in scena lo decide
l'importanza (la lista arriva da `terreno.js` ordinata per forza, cioè abitanti
diviso distanza al quadrato); chi sta *davanti* lo decide la distanza, e sono
due domande diverse. Il disegno va poi dal fondo verso di qui, così a passare
sopra è quello davanti. Quanti se ne nominano lo dice `skyCittaMaxNomi()`:
sette a grandangolo, fino a dodici ingrandendo.

I colori dei paesi in `SKY_NOMI_ORIZZONTE` sono diventati **numerici** (era
l'unico modo di mescolarli alla foschia); cime e acque restano stringhe.

Una trappola su cui si è già inciampato una volta, scritta anche in
funzione: il tetto dei nomi si conta sui paesi **in vista**, non sui primi
della lista. Guardando a sud, i primi sette per importanza possono stare tutti
alle spalle, e tagliare lì vuol dire un orizzonte senza un nome pur avendo
mezza provincia davanti. Il ciclo scorre finché non ne ha raccolti abbastanza,
che è quello che faceva da sempre.

### Com'è stato provato

- **§23 di `verifica.html`**, 24 prove nuove (la pagina non carica `app.js`: le
  formule sono una copia, come per il §19 e il §21).
- Un **banco a parte** che fa girare la `skyNomiCitta` **vera**, estratta da
  `app.js`, sotto un finto contesto 2D che registra cosa le viene chiesto di
  disegnare: chi vince il posto fra un paese vicino e una città lontana sullo
  stesso azimut, l'ordine dal fondo verso di qui, il numero solo su quello
  indicato, il tetto dei nomi, e i casi limite (lista vuota, paese fuori campo,
  `sky.ariaOra` non ancora calcolata, pieno giorno).
- Il disegno vero su un canvas di Chromium, di notte e di giorno, con cinque
  paesi da 3 a 58 km.

**Quello che NON è stato provato**: l'app intera in un browser. In questo
ambiente la rete verso le CDN è chiusa dalla policy, Astronomy Engine non si
carica e `verifica.html` si ferma da sola al §2 — per lo stesso motivo. Vale la
pena riaprire il planetario vero su un orizzonte con dei paesi prima di
considerare chiusa la cosa.
