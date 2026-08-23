# Task Corrente

Niente in corso.

## Ultimo intervento completato

I nomi dei paesi e delle montagne che non comparivano nel planetario, e i
raggi di ricerca che adesso si scelgono su una mappa.

### 1. Perché i nomi non comparivano (ed era colpa dei 429 sulle quote)

`terrenoCaricaPaesaggio()` appendeva le tre richieste a Overpass — paesi,
vette, acque — alla **promessa di `terrenoCarica`**: partivano solo quando
tutte e ventiquattro le richieste delle quote avevano finito, bene o male. Con
Open-Meteo che risponde 429 quelle ventiquattro diventano fino a centoventi
tentativi passati per un rubinetto che frena a ogni no, cioè minuti — e in
quei minuti sull'orizzonte non compariva **nessun nome**, mentre in console si
vedevano solo dei 429 che parlavano di un altro host.

Sono due servizi diversi, su host diversi, con rubinetti diversi: l'unica
ragione per metterli in fila indiana era la banda del primo fotogramma, e a
quella basta il `requestIdleCallback`. Misurato con un servizio delle quote che
non risponde mai (Chromium, servizi finti): prima partiva solo il giro della
cache locale (`citta/cache`, `cime/cache`, `acque/cache`), adesso partono anche
le tre richieste di rete.

### 2. Perché comparivano e sparivano da soli

`cimeVisibili` tace finché il terreno **sta arrivando** — dare l'elenco intero
e poi rimangiarsene metà è peggio — ma «sta arrivando» era `stato ===
'in-corso'`, e le riprese automatiche (20 s, 90 s, 5 min, 15 min, mezz'ora)
rimettono lo stato lì. Quindi: primo tentativo fallito → i nomi compaiono →
venti secondi dopo spariscono → poi tornano, per quasi un'ora. Adesso c'è
`terreno.arreso`: aspettare in silenzio ha senso finché non si sa ancora
niente, non quando si sa già che qui il terreno non arriva.

### 3. `[Intervention] Blocked call to navigator.vibrate`

Non era un guasto e non era del planetario: `telFermaTubo` chiama
`telVibra(0)`, e all'avvio ci passa comunque perché `mostraVista` chiude le
viste che non sono a schermo. Non si annulla una vibrazione che non è mai
cominciata (`telVibrando`).

### 4. I raggi di ricerca su una mappa

Erano tre slitte, cioè tre numeri chiesti al buio: «ottanta chilometri» non
vuol dire niente finché non si sa cosa ci sta dentro. Adesso il pannello
(Impostazioni → Planetario) è una carta col centro sul luogo da cui il
planetario guarda (`terrenoLuogo()`, la stessa funzione che decide dove
cercare) e tre cerchi colorati come i nomi che scrivono sull'orizzonte. Si
trascina la maniglia sul bordo del cerchio scelto, o si tocca il punto fin dove
si vuole arrivare.

La coerenza col planetario è fatta vedere in due modi: l'**anello
tratteggiato** dentro a due dei tre cerchi è l'anello vero delle richieste
(`CITTA_RAGGIO_PAESI_KM`, `CIME_RAGGIO_VICINE_KM`), e la riga sotto a ogni nome
dice quanto si è trovato **e quanto di quello il planetario sta disegnando
adesso** — un raggio da centocinquanta chilometri con quaranta vette di cui
zero in vista è un raggio da stringere. La slitta resta sotto la mappa, per il
numero esatto e per chi la mappa non ce l'ha.

Provato in Chromium con un Leaflet finto: costruzione, slitta (input muove solo
il numero, change salva), tocco sulla mappa, cambio di famiglia, trascinamento
della maniglia, anelli interni, e le cinque risposte della riga del conteggio.

File toccati: `terreno.js` (`terrenoCaricaPaesaggio`, `terrenoInArrivo`,
`terreno.arreso`), `telescopio.js` (`telVibra`), `ui-nuova.js` (§2, blocco
`raggi*` riscritto), `app.js` (`mostraTab` delle Impostazioni), `index.html`,
`style.css`, `sw.js` (`astrocal-v143`), `CLAUDE.md`.
