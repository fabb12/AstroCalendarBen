# Task Corrente

La scheda dell'oggetto nel planetario, girando il telefono in orizzontale:
si sovrapponeva alla fascia dei comandi in cima (le linguette dei gruppi e,
sotto, la riga con la bussola e le letture di puntamento).

**La causa.** `.pannello-dettaglio` (la scheda) è ancorata al fondo della
mappa (`bottom`) e cresce verso l'alto fino a un `max-height`. In
orizzontale quel tetto era `calc(100% - 74px - var(--alta-barra-tempo))` —
un "74px" scritto a occhio che contava solo la riga delle linguette e si
dimenticava che sotto di lei c'è un'**altra** riga intera (`.cielo-letture`:
altezza/campo, stato della posizione, e la bussola di 64px). La riga vera è
alta circa il doppio di quel numero, e con la mappa già bassa di suo (il
cielo girato di lato su un telefono comprime `--altezza-cielo` a poche
centinaia di pixel) la scheda aveva margine per crescere fin dentro alla
bussola.

**La soluzione.** Niente più un numero indovinato: `--zona-alta-cielo`
(definita su `.vista-cielo`, insieme a `--alta-barra-tempo`) è la misura
vera dell'intera fascia in cima — margine + riga delle linguette + distacco
+ riga della bussola — 132px di norma, 112px nella variante compatta sotto i
620px di larghezza (dove pillole e bussola sono già più piccole di loro).
Le tre regole che fissano il `max-height` della scheda (quella di base, la
variante da telefono stretto, quella orizzontale) usano tutte
`calc(100% - var(--zona-alta-cielo) - var(--sopra-barra-tempo))` come tetto
— da solo nella regola orizzontale, dentro un `min(...)` insieme al vecchio
`62%`/`420px`/`54%` nelle altre due, dove raramente stringe ma non fa mai
male averlo. Sopra la bussola non ci arriva più, in nessuna combinazione di
larghezza e altezza.

Provato con Playwright/Chromium a 844×390 e 667×375 (orizzontale, dito
grosso): la scheda con "Altri dati" aperto resta staccata dalla bussola di
2px esatti, mai sovrapposta, e su schermi molto bassi si stringe (fino a
scorrere dentro se stessa) invece di scrivere sopra ai comandi. Verificato
anche che verticale e desktop restano identici a prima (la clausola in più
nel `min()` non li tocca mai). `node --check app.js` pulito (nessuna
modifica JS in questo giro, solo CSS). `CACHE_NAME` → `astrocal-v103`.

[x] Completato.
