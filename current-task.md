# Task Corrente

Niente in corso.

## Ultimo intervento completato

**La traduzione inglese del contenuto degli eventi, la ricerca in inglese, e il
tasto della registrazione che diventava «NaN».** Segnalazione: «non tutte le
parti sono tradotte, soprattutto le schede dei vari eventi e la ricerca degli
eventi che ovviamente deve essere in inglese; inoltre c'è un bug: quando passo a
en il tasto di registrazione passa a nan e lampeggia».

### 1. Il tasto della registrazione — `app.js` §7.6

Una riga sola, ed è il difetto più corto e più visibile dei tre. Il ridisegno
del cambio lingua (`ridisegnaTuttoPerLingua`, in `ui-nuova.js`) chiama
`skyRegAggiornaComando()` **senza argomento** per riscriverne il titolo, che è
una frase del dizionario. Dentro, però:

```js
const inCorso = restano !== null;      // undefined !== null → vero
…
tempo.textContent = `${Math.max(0, restano).toFixed(1)} s`;   // «NaN s»
```

Quindi cambiare lingua **accendeva** il tasto — la classe `in-corso` è il
quadrato che pulsa — e gli scriveva accanto il conto alla rovescia di una
registrazione che non era mai cominciata.

Due cure, e la seconda è quella che chiude la strada anche agli altri:

1. senza argomento la funzione **deduce lo stato da `sky.reg`**, che lo sa già
   (`attiva`, `durataSec`, `avvio`): chi chiede solo di riscrivere le parole non
   ha nessun motivo di dover dire anche a che punto è la registrazione;
2. `inCorso` è `Number.isFinite(restano)` e non `restano !== null`, così nessun
   `undefined` e nessun `NaN` arrivati da un'altra parte possono più accenderlo.

### 2. Il contenuto degli eventi

Era il grosso. Le fasi lunari erano già passate alle chiavi; **tutte le altre
famiglie** scrivevano il loro testo in italiano dentro alla chiamata a
`creaEvento`, e un evento nasce una volta e vive finché l'app è aperta — quindi
quella frase restava italiana anche dopo il cambio lingua. Misurato prima:
**1.564 frasi italiane** nell'agenda con l'interfaccia in inglese.

Convertite: eclissi di Luna e di Sole, equinozi e solstizi, sciami meteorici,
elongazioni, congiunzioni e occultazioni (`app.js`); superlune e microlune,
opposizioni, congiunzioni col Sole, splendore di Venere, transiti sul Sole,
comete, aurore previste e stagione delle aurore (`eventi-extra.js`).

Il meccanismo nuovo è **la funzione**: `creaEvento` accettava già una `chiave`,
che va bene per un testo fisso e non basta per una frase che porta dentro un
numero («Marte dista 0,58 unità astronomiche», «il disco misura 33,5 primi
d'arco»). Adesso `titolo`, `spiegazione` e `programma` accettano anche una
funzione: i numeri restano chiusi lì dentro, trovati una volta sola, e a rifarsi
è la sola frase attorno. Il risultato si tiene (`defRisolta`) con la lingua e
`generazioneTesti` per chiave — la ricerca legge titolo e spiegazione di *tutti*
gli eventi a ogni tasto premuto.

Da lì è venuta gratis la **ricerca**, che è la seconda metà della segnalazione:
`getEventiFiltrati()` confronta `ev.titolo` e `ev.spiegazione`, e da quando sono
getter cercare «eclipse» trova le eclissi senza che la ricerca sappia niente di
lingue. Prima non trovava niente, ed è il sintomo peggiore dei due: un elenco
vuoto somiglia a «stasera non c'è niente».

E i **nomi dei pianeti**, che erano sei copie (`SKY_CORPI`, `CONG_CORPI`,
`SOL_PIANETI`, `LEZ_PIANETI`, la tabella della lezione, `PIAN_NOMI_PIANETI` in
`pianifica.js`). Adesso sono una: `nomeCorpo(id)` con la chiave `corpo.<id>`, e
le tabelle ci passano attraverso `conNomeDaId(elenco, 'corpo.')`. Con sei copie
la dashboard diceva «Marte» mentre l'agenda diceva «Mars».

Nella stessa passata: la cornice dell'agenda (i messaggi «nessun evento», i
badge degli eventi manuali, le etichette dei consigli di scatto), i motivi
dell'indice di osservabilità, il riquadro «Stanotte» della dashboard con i nomi
delle fasi lunari, la griglia del mese di FullCalendar (`calendarioCambiaLingua`)
e le cinque frasi della bussola.

E la **data** della scheda, che è il residuo che nessun conto vedeva. Il locale
di `Intl` era cablato a `it-IT`, e sulle ore non si notava — con
`hourCycle: 'h23'` le 07:51 si scrivono uguali in tutte e due le lingue — mentre
sulla data intera sì: «4 settembre 2026 alle ore 07:51» sotto al titolo di ogni
scheda inglese. La sonda di `prova-lingua.js` non poteva prenderla, perché quella
frase non contiene nessuna parola italiana funzionale: adesso il locale lo dà
`localeData()`, `dataTesto` è un getter come il titolo, e la prova guarda i nomi
dei mesi.

### 3. Dove siamo adesso

`node scripts/prova-lingua.js`, viste aperte dopo il cambio lingua:

| vista | prima | adesso |
|---|---|---|
| Stasera | 10 | **0** |
| Mese | 0 | **0** |
| Agenda | 1.564 | **0** |
| Diario | 6 | 6 |
| Telescopio | 14 | 13 |

Gli attributi (`title`, `aria-label`, `placeholder`) rimasti italiani sono
passati da 1 a 0. I tetti di `scripts/i18n-tetto.json` sono stati abbassati di
conseguenza: quelle tre viste a zero sono un cricchetto, e non devono risalire.

Restano il **Diario**, il **Telescopio** e la **Didattica**, che non sono mai
stati convertiti e non lo sono adesso.

### Una cosa da sapere prima di rimetterci mano

La sonda di `prova-lingua.js` cerca parole funzionali italiane, e tre di
quelle — `come`, `per`, `non` — esistono anche in inglese. Finché l'agenda era
italiana non faceva danno; da quando è tradotta lo faceva tutto: «Moon and Venus
**come** within 29 arcminutes» veniva contata come frase italiana, e il conto
della vista si fermava a 26 invece che a zero — un numero che per giunta dipende
da quante congiunzioni cadono nel mese in cui la prova gira. Accanto a `SPIA_IT`
c'è adesso `SPIA_EN`, e una sola parola che in italiano non esiste basta a
scartare il colpo.

### Le prove

- `node scripts/prova-i18n.js` — verde, e comprende le due che legano HTML,
  codice e dizionario (ogni chiave citata esiste, nessuna chiave orfana).
- `node scripts/prova-lingua.js` — verde, con due sezioni nuove: **«il contenuto
  degli eventi, e la ricerca»** (ogni famiglia ha il suo titolo nelle due lingue,
  nessun titolo resta italiano, «eclipse» trova 200 eventi e «eclissi» zero) e
  **«il tasto della registrazione non si accende al cambio lingua»**. Quest'ultima
  è stata provata contro il codice di prima: dice «lampeggia» e «NaN s», cioè
  esattamente le due parole della segnalazione.
- `node scripts/controlla-i18n.js --patto` — dentro al tetto (621).
- I due dizionari hanno lo stesso numero di chiavi: **1.101** (erano 893).

Non toccate, e già rosse prima di questo lavoro: `scripts/prova-fumetto.js`
(«resta fuori dalla bussola e dalla barra del tempo», su tutte e tre le
finestre) e `scripts/prova-nel-browser.js` (un'eccezione dentro a
`solDisegnaVicino`). Provate su `main` e falliscono uguale.

`CACHE_NAME` è a `astrocal-v272`.
