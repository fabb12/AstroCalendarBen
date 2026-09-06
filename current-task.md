# Task Corrente

**In corso: finire la traduzione inglese di `app.js`.** Vedi «Cosa resta» in
fondo — sono le eclissi (la mappa dell'ombra, le eclissi di casa, quelle
lunari), le simulazioni e gli avvisi del planetario, per un totale di **355
stringhe** contate da `node scripts/controlla-i18n.js --lista --file app.js`.
Tutto il resto è fatto, provato e dentro al tetto.

## Ultimo intervento completato

**Il comando delle date di calendario e agenda si è ridotto a una riga.**
Richiesta: «nella sezione calendario e agenda comprimi in un unico comando la
gestione delle date tra singolo mese e intervallo di date; controllo
intelligente e comodo anche per schermo piccolo; lo scopo è dare più spazio
al contenuto di calendario e schede».

### 1. Il difetto, misurato

Sopra alla griglia c'erano **tre file di comandi impilate**: la barra di
FullCalendar (freccia, mese, freccia, oggi), la riga «Vai al mese» con la sua
tendina, il suo anno e i suoi due tasti, e la riga «Oppure un intervallo» con
altre due caselle data e altri due tasti. A 320 px andavano a capo cinque
volte: **346 pixel** di controlli su uno schermo alto 640, cioè più di metà
schermata prima di vedere una casella del calendario.

E dicevano tre volte la stessa cosa. Mese e intervallo **si escludono a
vicenda** — `impostaMeseSelezionato` spegne l'intervallo e
`impostaIntervalloSelezionato` spegne il mese — quindi tenere a schermo tutti e
due i modi di scegliere voleva dire chiedere ogni volta quale dei due stesse
comandando; e la barra di FullCalendar sfogliava gli stessi mesi del selettore
che le stava sotto.

### 2. La barra del periodo — `index.html`, `app.js` §1-quater, `style.css`

Quello che si guarda è **un periodo**, e un periodo per volta. A schermo resta
una riga: il **nome** di quel periodo («Settembre 2026», «6 set – 5 ott»,
«Prossimi eventi»), le due frecce per scorrerlo, il tondo di oggi. I campi
stanno in un foglio che si apre solo se lo si chiede, appoggiato **sopra** al
contenuto invece che spingerlo in giù — aprirlo non deve far saltare il
calendario — con due linguette, Mese e Intervallo.

`headerToolbar` di FullCalendar è passato a `false`: le sue regole di stile
restano dormienti, col perchè scritto accanto a `.fc .fc-toolbar-title`.

Misurato dopo, stessa sonda: **63 px** a 320 e a 390, **73** sul computer (da
139). Sul telefono sono 283 pixel restituiti alla griglia.

Tre cose non sono decorazione, e ognuna viene da una domanda vera:
- riaprendo il foglio con un intervallo acceso si riapre **sull'intervallo**:
  chi ce l'ha lo vuole ritoccare, non ricominciare da un mese;
- le frecce, con un intervallo acceso, lo spostano **di quanto è lungo** e non
  di un mese: chi guarda le due settimane di ferie vuole le due settimane dopo;
- le tre durate già pronte (7 giorni, 30, 3 mesi) esistono perchè altrimenti
  un intervallo costa due caselle data compilate a mano, che su un telefono
  sono due tastierini e un ripensamento.

Il nome si **abbrevia** sul telefono (`meseCorto`, e l'anno di un intervallo di
quest'anno non si scrive): a 320 px al nome restano centosedici pixel e
«Settembre 2026» ne chiede centoventisei — è la stessa scelta che faceva il
`titleFormat` della barra di FullCalendar. Da lì la riga in
`ridisegnaPerDispositivo`, se no chi allarga la finestra si tiene «Set 2026»
per sempre. La forma lunga sta nel `title` del tasto.

Trappola trovata misurando: lo stato del foglio si scrive `data-modo-periodo`
e **non** `data-periodo-modo`, che è già il nome dei due tasti delle linguette.
Da dentro la barra non fa danno — un `querySelectorAll` su un elemento non
restituisce l'elemento stesso — ma chi lo cerca **dal documento** si ritrova
fra le linguette anche tutta la barra: è esattamente quello che è successo alla
prova, che ne ha trovate tre invece di due.

Chiavi nuove nei due dizionari sotto `periodo.*`; zero stringhe italiane
cablate in più (`controlla-i18n.js` dà lo stesso identico elenco di prima —
il totale sforava già di due prima di questo lavoro, ed è roba d'altri).

### 3. Le prove

`prova-lingua.js`: tutto verde, calendario e agenda restano a **zero** frasi
italiane dopo il cambio lingua.

Una prova a parte (fuori dal repository) apre l'app a 320x640, 390x844 e
1280x900 e controlla che la barra sia una riga sola, che il nome ci stia per
intero senza puntini, che il foglio non esca dallo schermo, che le linguette si
diano il cambio, che le frecce scorrano il mese e l'intervallo, che Esc e un
tocco fuori chiudano, che le due viste restino allineate e che in inglese le
linguette e le durate siano tradotte. Tutto verde.

**Da rifare a mano**: in questo ambiente il CDN è chiuso, quindi FullCalendar
non si carica e `fullCalendarInstance` resta `null`. Le due cose che passano da
lui — che la griglia si muova con le frecce e che la fascia dell'intervallo si
disegni — sono state controllate sullo **stato** che le comanda, non sui pixel.
Vanno guardate con la rete aperta.

## Cosa resta

1. **`app.js`, 355 stringhe.** Sono in blocchi:
   - le **eclissi di Sole**: la mappa dell'ombra e i suoi comandi (§1-ter),
     il meteo dell'eclissi, la condivisione, «le eclissi di casa tua»
     (§1-quater);
   - le **eclissi di Luna** (§1-quinquies);
   - le **scene della simulazione** (§8);
   - gli **avvisi del planetario** (`skyAvviso`) e qualche riga sparsa.
   Si convertono come le altre: chiave, `astroI18n.t`, voce nei due dizionari.
2. **I nomi degli oggetti profondi** («M3 — Globulare dei Cani da Caccia»).
   Stanno in `SKY_PROFONDO` (`app.js`) e in `dati-profondo.js`, e sono **anche
   l'identificativo** con cui l'app li ritrova (`dso:<nome>`): tradurre il nome
   vuol dire cambiare l'identificativo, e con lui i link già condivisi e il
   ponte verso il catalogo grande di `catalogo.js`. Va fatto in un colpo solo,
   in tutt'e tre i posti: un id stabile separato dal nome mostrato.
