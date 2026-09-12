# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 345 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362 (totale di adesso: 354).

## Lo stato delle prove

Verdi: `prova-missione.js --solo-motore` (144), `prova-missione-stati.js`,
`prova-missione-interattiva.js`, `prova-i18n.js`, `prova-lingua.js`,
`controlla-i18n.js --patto`, `controlla-collisioni.js`.

Rosse e **preesistenti**, verificate sull'albero pulito:

- `prova-missione.js`, due prove che dipendono dal cielo di stanotte — «un
  passaggio di stazione arriva fino alla tappa» e «le tappe rispettano davvero
  altezza e strumento» (Urano vuole il telescopio). 192 passate, 2 fallite.
- `verifica.html`, cinque prove: le quattro del §20 sull'acqua e una del §28
  (`la camera insegue cinquanta metri di strada con dolcezza`).

## Ultimo intervento completato

**La guida all'uso, e la linguetta delle Impostazioni che la apre.**

`guida.html`: una pagina sola, fuori dall'app, con tutte le funzioni spiegate
una per una — cos'è l'app, i sette passi del primo accesso, le sette viste, il
planetario a fondo, il paesaggio (terreno, rilievo, acque, aurore, Via Lattea,
costellazioni), aerei e transiti, Missione Cielo, il telescopio, gli otto
banchi della Didattica, impostazioni e backup, la tabella di cosa resta senza
rete, gesti e scorciatoie, i guasti e un glossario.

Tre decisioni che vale la pena avere scritte, perché sono tutte e tre scelte e
non ripieghi.

**Una pagina nostra e non un link a un servizio esterno.** Un indirizzo altrui
invecchia, non entra nella cache del service worker e la sera in cui serve —
al buio, senza campo, quando non ci si ricorda come si tara la bussola su un
astro — non si apre. `guida.html` sta in `ASSETS` di `sw.js` (e `CACHE_NAME` è
salito a `astrocal-v309`) e fra i file che il workflow pretende: un link dalle
impostazioni che dà 404 non fallisce, porta a una schermata bianca.

**Non carica `style.css`.** Là dentro ci sono novemila righe scritte per
un'interfaccia — griglie, pannelli, mappe — che con un documento da leggere
litigherebbero. Quello che serve è la tavolozza, e quella è **ricopiata** dal
blocco `:root`, con l'avvertimento in chiaro: è una copia, e il giorno che
diverge non lo dice nessuno. Il tema è solo scuro, come l'app.

**La linguetta non ha richiesto una riga di JavaScript.** `mostraTab` in
`inizializzaImpostazioni` scorre `[data-imp-tab]` e `[data-imp-pannello]` letti
dal documento: una linguetta nuova è markup più dizionari. Undici chiavi nuove
in `lingue/it.js` e `lingue/en.js`, infilate in ordine alfabetico come le altre.

La prova è `scripts/prova-guida.js`, e guarda le due cose che a occhio non si
giudicano: che ogni **ancoraggio** promesso dalle cinque scorciatoie esista
davvero dentro alla guida (chi rinomina una sezione là dentro rompe qui, in
silenzio), e la **geometria a 360 px** — le linguette sono diventate quattro e
la finestra su un telefono è stretta, mentre gli altri banchi girano a 900,
dove tutto ci sta comunque.

Resta da fare: **la guida è in italiano soltanto**, e il pannello lo dichiara
(`ui.guida-lingua-nota`). La versione inglese è lavoro a parte.
