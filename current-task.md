# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Il cuneo di terra dopo un «vai qui», e la montagna che non sembra una
montagna** (`rilievo.js` §2, §8 e §8-bis). La segnalazione era «ogni tanto,
passando da una vetta all'altra con vai qui, la montagna non viene
rappresentata bene»: sullo schermo un paesaggio liscio senza rilievo, i nomi
delle vette appesi molto sotto la riga dell'orizzonte, e a volte il cuneo di
terra che sale fin quasi allo zenit — lo stesso «errore poligonale» che si
credeva curato.

Curato lo era, ma per metà. L'invariante di questo file — *sotto i piedi la
superficie sta alla quota della camera* — regge fra chi legge le due fonti
**nello stesso istante**, e `rilCarica` non lo fa: prende la quota
dell'occhio, *poi* scarica le tessere, poi costruisce. E le tessere sono le
uniche che sappiano dov'è il suolo in un posto in cui non si è mai stati:
appena arrivati, la griglia grossa è ancora quella di dov'eravamo, e di là
sa dire un campione ogni tre gradi e ogni tre chilometri.

Misurato sul banco, saltando fra due cime a undici chilometri: la camera
veniva posata **duecentocinquanta metri più in basso** del suolo vero,
`rilCostruisciMaglia` tosava la differenza a `RIL_SCARTO_MAX` (ed è giusto
che la tosi: uno scarto così non è un disaccordo fra due modelli del suolo),
e i centocinquanta che restavano erano camera sotto la superficie —
**cresta a 89,95° in tutte e settecentoventi le direzioni**.

Tre cause, e vanno insieme:

1. **L'occhio si legge adesso dopo le tessere** (e la chiave con lui). È la
   riga che rimette in piedi l'invariante: chiamando `rilOcchioMeta` lì, la
   camera e la maglia leggono per forza la stessa cosa.
2. **`rilScorda` azzera `ultimeTessere` e `scarto`.** Il freno di
   `RIL_TESSERE_MIN_MS` è lì per non ribussare a S3 per *lo stesso disco*
   mentre si cammina; applicato a un salto faceva costruire la maglia del
   posto nuovo **senza una tessera**, cioè dalla griglia grossa di quello
   vecchio traslata di undici chilometri — il paesaggio liscio della
   segnalazione. Lo `scarto` è la misura di quanto le tessere sbagliano
   *lì*, e altrove sposta un terreno che non c'entra.
3. **Il freno dei sessanta metri di `rilControlla` è del posto**, e si
   prendeva anche le altre due parti della chiave: la quota della camera e
   la versione della griglia. Da fermo su una cima quelle due sono le sole
   che cambino, la chiave risultava diversa e poi si usciva comunque — cioè
   la maglia sbagliata restava lì finché non ci si spostava di sessanta
   metri a piedi. È il punto in cui un difetto di qualche secondo diventava
   definitivo. Adesso il freno vale solo se anche l'occhio
   (`RIL_OCCHIO_RIFAI_MAGLIA_M`) e `rilievo.grigliaQuando` sono gli stessi.

### Il banco

969 prove verdi (erano 964). Le quattro nuove del §28 falliscono tutte sul
codice di prima, e il contro-esempio è scritto coi numeri: «camera a 477 m
sul suolo di 660, cresta 90,0°».

Da sapere: `scripts/prova-nel-browser.js` e `scripts/prova-verifica.js`
vogliono `CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` se il
percorso di serie non esiste, e la prima chiede la rete (senza, i suoi
«problemi» sono tutti richieste fallite).
