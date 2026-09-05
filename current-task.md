# Task Corrente

**In corso: finire la traduzione inglese di `app.js`.** Vedi «Cosa resta» in
fondo — sono le eclissi (la mappa dell'ombra, le eclissi di casa, quelle
lunari), le simulazioni e gli avvisi del planetario, per un totale di **355
stringhe** contate da `node scripts/controlla-i18n.js --lista --file app.js`.
Tutto il resto è fatto, provato e dentro al tetto.

## Ultimo intervento completato

**Il planetario si prende tutto lo schermo, e il tasto delle stazioni porta
davvero al passaggio.** Richiesta: «lo schermo del planetario deve occupare il
massimo spazio senza lasciare spazi vuoti soprattutto negli schermi piccoli,
mantenendo comunque il menu; e nella sezione Stasera, il tasto planetario delle
previsioni delle stazioni deve mostrare il tempo e la posizione giusta e
abilitare automaticamente il tracking».

### 1. La fascia nera sotto al cielo — `style.css`

La catena delle altezze del planetario è sei anelli (corpo → main → vista →
scena → riquadro → tela) e basta che **uno** sia alto quanto il suo contenuto
perché tutti quelli dopo perdano l'altezza definita: una `height: 100%` di
un'altezza che non c'è non vale niente, e nessuno lo dice. L'anello rotto era
`.vista-cielo`, una griglia con `align-content: start`. Misurato: su un
telefono da 360×640 il cielo era alto **383 px** dove ce n'erano 529 liberi —
centoquarantasei pixel di niente appena sopra alla barra della navigazione — e
su un tablet 872 su 1067. Adesso la riga si stira (`minmax(0, 1fr)`) e ogni
anello dichiara il suo `min-height: 0`. Il cielo passa a 526 px sul telefono,
730 su un 390×844, 1067 sul tablet: zero spazi vuoti, testata e menu al loro
posto. Di rimbalzo è tornata verde una prova di `prova-fumetto.js` a 360×640,
che sullo spazio in meno falliva.

Con lo spazio recuperato è saltato fuori l'angolo in basso a sinistra, dove da
quando l'avviso sta sul cielo se lo contendono in tre: l'avviso, la barra del
terreno e la carta dello spostamento. Le ultime due erano ancorate a un numero
scritto a mano (`--sopra-barra-tempo` più quaranta pixel), buono per un avviso
di una riga e non per uno di tre — e su un telefono sono quasi sempre di tre:
la barra finiva stampata dentro al riquadro ambra. L'altezza vera la scrive
adesso `skyMisuraAvviso` in `--alta-avviso-cielo`, e il CSS la somma.

### 2. «Vai al planetario» di una stazione — `app.js`

Quattro difetti, un tasto solo. Il grosso era l'**ordine**: l'orologio si
spostava *prima* di `cercaNelCielo`, e `mostraVista('cielo')`, arrivando da
un'altra vista, lo **azzera** di proposito — misurato, da Stasera si arrivava
sistematicamente sul cielo di adesso, cioè quasi sempre di giorno e senza
nessuna stazione. Poi: le posizioni non si rifacevano per l'ora nuova (una
stazione fa **un grado al secondo**), con «Segui il telefono» acceso nessun
centraggio valeva, e l'inseguimento non si accendeva — una stazione attraversa
il cielo in cinque minuti e centrata una volta scivola fuori mentre la si
guarda. I due tasti («Vai al planetario» e «Dov'è ora») sono adesso una
funzione sola, `skyPuntaStazione`, e cambia soltanto *quando*. Dentro c'è anche
la trappola di `Number(null)`, che vale **zero** e non NaN: chiedendo a
`Number.isFinite` se c'era un istante, «Dov'è ora» rispondeva di sì e portava
l'orologio al 1970.

Quattro chiavi nuove nei due dizionari (`stazione.*`): l'audit resta a 364.

### 3. Le prove

`scripts/prova-stazioni.js`, nuovo: apre l'app in un Chromium, mette i dati
orbitali a mano (Celestrak non si raggiunge dalle prove), prende un passaggio
vero dai conti dell'app e controlla che il tasto porti l'orologio sul culmine,
punti la mappa dove sarà la stazione **a quell'istante** (non adesso), accenda
l'inseguimento e lo tenga un minuto dopo, che «Dov'è ora» torni al tempo reale
e che con la bussola accesa la vista si sganci. Parte da **Stasera** di
proposito: provandolo col planetario già davanti la riga che azzerava
l'orologio non gira, e la prova diventerebbe cieca proprio sul difetto che deve
prendere. Sul codice di prima è rossa in nove punti.

`prova-nel-browser.js` e `prova-fumetto.js`: nessuna regressione (le poche
rosse sono le stesse di prima, misurate a parte sul codice pulito).

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
