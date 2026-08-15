# Task Corrente

Girare il telefono in orizzontale: la scena che si sta guardando si prende
tutto lo schermo, e rimettendolo dritto lo restituisce.

C'era già un abbozzo (`entraPienoSchermoSeServe`), e non funzionava per tre
motivi distinti — tutti verificati a schermo prima di toccare il codice:

- **Non si tornava mai indietro.** Si entrava a schermo intero girando il
  telefono e non si usciva rimettendolo dritto: si restava col planetario
  incollato al viewport e la barra di navigazione nascosta, in verticale.
  È questa la cosa che si vedeva come «la rotazione è rotta».
- **Col Sistema Solare 3D aperto andava a schermo intero il cielo**, che è
  la finestra *sotto*: l'ordine di precedenza era rovesciato.
- **La Didattica non faceva niente.** `didEntraSchermoIntero` cercava l'`id`
  del `<figure class="did-scena">` — che un id non ce l'ha, ce l'ha la tela
  dentro — e lo passava col cancelletto davanti a una `getElementById`.
  Falliva in silenzio.

Adesso c'è **§0-bis di `app.js`**: una tabella (`SCENE_DEL_GIRO`) di chi può
prendersi lo schermo in ordine di precedenza — 3D, planetario, Didattica —
e `pienoSchermoDelGiro()`, che agisce solo sul cambio di verso, apre solo se
non c'è già qualcosa di pieno, e chiude **solo quello che ha aperto lui**
(chi era entrato a mano col ⛶ non viene buttato fuori da una rotazione).
Vale solo per `telefonoGirato()`: su tablet e computer non succede niente.

Nella Didattica sceglie `didScenaDaGirare()`: fra le tele impaginate adesso
prende la principale (`pieno: true` → `l.principale`), a pari merito la
prima della pagina. E il ⛶ ce l'hanno tutte le scene con la lente, non più
le sole sei in 3D.

Una cosa da non dimenticare: **una rotazione non è un gesto dell'utente**,
quindi su un telefono vero `requestFullscreen` viene rifiutata e a lavorare
è sempre il ripiego in CSS delle tre scene. Provato apposta, forzando il
rifiuto: tutti e tre coprono lo schermo e tornano al loro posto.

Provato in Chromium (390×780 ↔ 780×390, con tocco): planetario, 3D, tutti e
otto i banchi e ognuno dei loro quadri, il ripiego in CSS, la scelta a mano
che la rotazione non disfa, e il tablet in orizzontale che resta com'era.
Nessun errore di pagina. `CACHE_NAME` → `astrocal-v101`.

[x] Completato.
