# Niente in corso

Ultimo lavoro chiuso: **la fotografia dentro al filmato, seconda passata**.

La prima cura aveva tolto il sintomo e lasciato il difetto. Le due strade che
aveva messo — `fetch` e ricarico dell'immagine col CORS chiesto per nome —
chiedono tutt'e due la stessa cosa al server, cioè l'intestazione CORS, quindi
quando quella non c'è cadono insieme. E non c'è: le fotografie di Planespotters
stanno su `t.plnspttrs.net`, e come quel CDN è configurato non lo cambia nessuna
riprova. Nel filmato restava un vuoto in mezzo al riquadro, che è ancora un
sintomo che non sembra un errore — chi guarda non può sapere se la fotografia
manchi per la rete o perché quell'aereo una fotografia non ce l'ha.

Quello che è cambiato, in §7.6 di `app.js`:

- **La terza strada** (`skyRegFotoDaPonte`): i ponti CORS che gli aerei usano
  già per i loro dati, esportati da `aerei.js` invece di ricopiarne l'elenco.
  Si provano per ultimi e solo mentre si registra.
- **Il tipo dai byte** (`skyRegTipoImmagine`): un ponte il tipo non lo promette,
  un server in difficoltà lo dichiara sbagliato.
- **La grazia breve** (`SKY_REG_FOTO_SUBITO_MS`, `skyRegAppena`): il riquadro
  non aspetta più il giro intero, e quando la fotografia arriva l'impronta si
  sporca e il fotogramma dopo ne chiede uno nuovo.
- **Il buco che restava** (`skyRegContenutoInAlto`): `.fumetto-righe` è una
  griglia con l'altezza fissata, e una griglia così stira le sue righe.
- **La memoria** (`skyRegScordaFotoMancate`): fra due registrazioni si tengono
  le fotografie e si buttano i no.

`node scripts/prova-registrazione.js` — ventidue prove, tutte verdi. Rosso
preesistente e non toccato: `prova-lingua.js` conta «χ Per» come una frase
italiana (è la sigla di Perseo, e dipende da cosa c'è in cielo stanotte).
