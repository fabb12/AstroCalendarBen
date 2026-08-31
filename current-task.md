# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Il cuneo di terra dopo «vai qui»** (`rilievo.js` §1, §6, §8 e §8-bis). La
segnalazione, con la fotografia: «quando uso la funzione vai qui a volte ho
questo errore poligonale» — un cuneo grigio che sale dall'orizzonte fin quasi
allo zenit, coi nomi dei paesi scritti sopra e il filo bianco del crinale che
gli gira attorno.

Non è un poligono sbagliato, ed è la prima cosa da sapere: è terreno disegnato
benissimo. Misurata sul banco, la cresta viene **ottantadue gradi in tutte e
settecentoventi le direzioni**, e sullo schermo quella è una calotta attorno
allo zenit ritagliata dall'arco che il rilievo sta disegnando — cioè un cuneo.
La causa sta tutta in una riga: **la camera era sotto la superficie che stava
disegnando**. Un occhio quattrocento metri più in basso del suolo lo vede
alzarsi come una parete, e a settanta metri di distanza quella parete è
ottantun gradi.

A metterla lì erano due regole scritte per chi cammina, applicate a un salto.

1. **La camera si incamminava invece di arrivare.** La quota dell'occhio
   insegue il suolo a quattro metri al secondo (`RIL_OCCHIO_V_MAX_M_S`), che è
   la salita di una strada di montagna e va benissimo camminando. Da un paese
   di pianura a una cima a seicento metri, però, sono **centosedici secondi**:
   misurato passo per passo, 82° appena arrivati, 80° dopo dieci secondi, 74°
   dopo un minuto, e il paesaggio giusto solo alla fine. Adesso `rilOcchioOra`
   guarda **il punto** e non la quota (`RIL_SALTO_OCCHIO_M`, 300 m, il doppio
   del passo più lungo che la posizione consegni davvero): oltre quello, da un
   fotogramma all'altro, non ci si è mossi — si è stati portati.

2. **La maglia del posto di prima restava disegnata**, traslata di decine di
   chilometri, per tutto il tempo in cui il terreno nuovo arrivava — che con un
   429 sono minuti. `rilScorda` c'era già, e un commento diceva che i cambi di
   luogo veri passavano di lì: non la chiamava nessuno. Adesso c'è
   `rilScordaSeAltrove` (`RIL_MAGLIA_VALIDA_M`, il disco delle tessere: fuori
   di lì, di qui, la maglia non ha più niente di fine da dire) e la si chiama
   **prima** della guardia su `terrenoDisponibile()`. È quello il punto: la
   finestra in cui la maglia vecchia restava sullo schermo era esattamente
   quella in cui il profilo grosso del posto nuovo non c'era ancora, e
   chiedendo prima di lui si usciva senza guardare.

Sotto le due c'era l'anello che mancava alla catena, ed è la parte che vale
per tutti e non solo per «vai qui»: `rilOcchioMeta` provava le tessere e poi
ripiegava su `terreno.quota` — la quota misurata **di un altro posto** —
saltando la griglia grossa, che di quel punto sa rispondere. Misurato: con la
maglia costruita venti chilometri più in là e le tessere che non arrivano, la
camera diceva 222 m dove il suolo sta a 664, e la cresta veniva novanta gradi
tondi. Adesso le fonti sono tre nello stesso ordine in cui le legge la maglia
(tessere → griglia grossa → quota misurata del centro), e da lì viene
l'invariante che tiene in piedi tutto: **sotto i piedi la superficie sta alla
quota della camera**, comunque siano andate le tessere. Con quella, non c'è
più nessun allineamento da fare sulla griglia dentro a `rilCostruisciMaglia`:
lo scarto che ci si vorrebbe togliere vale zero per costruzione.

Nella stessa passata è venuto fuori che il banco era **rosso su `main`** dal
30 agosto, e proprio qui: `rilLasciaSpazioCamera` — il raccordo che tiene il
primo lembo della maglia sotto i piedi — si applicava sempre, mentre serve
solo finché la camera sta più in basso del suolo su cui la maglia è stata
costruita. Fatto sempre, spianava il terreno vero sotto i settanta metri: su
un pendio al dieci per cento sono sei gradi a venticinque metri, ed era la
prova «traslando, ogni nodo dice il terreno visto dal punto nuovo» del §25 che
falliva senza che niente lo dicesse.

Le prove stanno nei §25 e §28 di `verifica.html` (927 in tutto, tutte verdi;
erano 916 con una rossa), e le nuove falliscono sul codice di prima — la
camera che resta a 201,6 m dove il suolo sta a 665,6, e l'orizzonte a 82°.
Il banco si può far girare senza browser a mano con Playwright: serve la
cartella da un server locale, Astronomy Engine da `node_modules` e le altre
librerie del CDN finte, come fa già `scripts/prova-nel-browser.js`.
