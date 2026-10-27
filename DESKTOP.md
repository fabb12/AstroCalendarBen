# L'app per computer (Electron)

La stessa app del sito, dentro un programma per Windows. Non è un'app
diversa: sono gli stessi file, serviti da un piccolo server locale dentro una
finestra di Electron. Il programma aggiunge solo quello che il browser non
dà, o dà male, sul computer di casa.

## Perché

- **Le chiavi spariscono.** La chiave di ElevenLabs, il token di GitHub dello
  Studio, il collegamento di YouTube e le voci scelte per i personaggi stanno
  in `localStorage`, fuori dal backup apposta. L'app non le cancella mai, ma
  il browser sì: chi «svuota la cache» o cancella i dati del sito per vedere
  un aggiornamento le porta via tutte; Chrome, a disco quasi pieno, sfratta i
  siti che non hanno chiesto la memoria persistente; un indirizzo diverso
  (un'altra porta, un'anteprima) ha un `localStorage` tutto suo. Segnalato
  così (v529): «ogni volta che apro da PC e c'è un aggiornamento perdo i
  token di ElevenLabs, GitHub…».
- **I file.** Nel browser tutto finisce in «Download»; nel programma c'è una
  cartella dell'app (`Documenti\AstroCalendario`) e la finestra «Salva con
  nome» di Windows.
- **I permessi** (posizione, fotocamera, microfono, notifiche, cartelle) si
  concedono una volta per tutte, e solo all'app.

## Come è fatto

| File | Cosa fa |
|---|---|
| `desktop/main.js` | Il programma: finestra (si ricorda posizione e misura), menu, permessi, file scaricati, cassaforte delle chiavi, aggiornamenti. |
| `desktop/server.js` | Il server locale: `127.0.0.1` e `::1`, porta fissa **47231**, `Range` per l'audio, niente uscite dalla cartella. Non usa Electron. |
| `desktop/preload.js` | `window.astroDesktop`, l'unica cosa che la pagina vede del programma (`contextIsolation`, `sandbox`). |
| `desktop/testi.js` | Le frasi del menu e dei dialoghi, in italiano e in inglese (la pagina usa i suoi dizionari, il processo principale non li vede). |
| `desktop/prepara.js` | Copia il sito in `desktop/app-web/` e scrive in testa a `config.js` proxy ADS-B, Edge-TTS, ID client YouTube e build. |
| `desktop/costruisci.js` | `npm run dist`: prepara e chiama electron-builder con la versione del sito (vN → 1.N.0). |
| `custode-chiavi.js` | Nella pagina, prima di `app.js`: rimette le chiavi perse, ricopia quelle che cambiano. |
| `.github/workflows/desktop.yml` | Costruisce l'installatore su `windows-latest` e lo pubblica nella Release `desktop-vN`. |

### Perché un server su localhost

Da `file://` il service worker non si registra, le `fetch` dei file locali
sono vietate e l'origine è `null`. Uno schema proprio (`app://`) andrebbe bene
dentro la finestra, ma il proxy ADS-B (`worker-adsb.js`, `originePermessa`)
accetta solo il sito e `localhost`: con `app://` gli aerei avrebbero risposto
403. `http://localhost` è già ammesso, è un contesto sicuro, e Google lo
accetta come origine di un client OAuth.

La **porta è fissa** perché l'origine comprende la porta, e `localStorage` e
IndexedDB (diario, eventi, storie dello Studio) sono legati all'origine. Se un
altro programma la occupa si prova la successiva e lo si dice in un dialogo:
finché resta così i dati sembrano vuoti (le chiavi no: tornano dalla
cassaforte).

### La cassaforte delle chiavi

`userData/chiavi.json`, un valore per chiave cifrato con `safeStorage` (DPAPI
su Windows). Le chiavi ammesse sono **due elenchi che devono coincidere**:
`CUSTODE_CHIAVI` in `custode-chiavi.js` e `CHIAVI_CUSTODITE` in
`desktop/main.js` (la prova lo controlla). Chi aggiunge una credenziale
all'app la aggiunge a tutti e due.

Regole del custode (`custode-chiavi.js`):

- all'avvio, una chiave **assente** in `localStorage` torna dalla cassaforte
  (l'app non toglie mai quelle chiavi: assente vuol dire persa); una presente
  e diversa vince e si ricopia;
- ogni due secondi, e alla chiusura, ciò che è cambiato si ricopia — compreso
  «Dimentica», che scrive un valore vuoto e non viene «riportato in vita»;
- una chiave che sparisce a programma aperto si rimette subito.

Nel browser non c'è un posto fuori dal sito: il custode chiede almeno
`navigator.storage.persist()`, e solo quando una chiave ha davvero un segreto
dentro (lo Studio scrive le impostazioni del repository anche senza token).

### Aggiornamenti

Il workflow pubblica `AstroCalendario-Setup.exe` nella Release `desktop-vN`,
segnata «latest», e tiene le ultime cinque. Il tasto delle Impostazioni nel
browser punta a `releases/latest/download/AstroCalendario-Setup.exe`. Il
programma, installato, chiede una volta al giorno
`api.github.com/repos/…/releases/latest` e propone il download; l'installatore
NSIS sovrascrive il programma e lascia `userData` (diario, chiavi,
impostazioni: `deleteAppDataOnUninstall: false`).

Quando la versione cambia il programma toglie il service worker della
versione di prima (solo lui: non la cache dei modelli di Piper, non
`localStorage`), così non serve la copia vecchia e non propone di
«aggiornare» un'app appena aggiornata.

### Cosa resta diverso dal browser

- **Posizione**: su Windows la dà il servizio di localizzazione del sistema
  (`WinrtGeolocationImplementation`); se è spento, l'app ripiega come sempre
  sulla posizione dall'IP o su quella scritta a mano.
- **Dettatura dello Studio**: il riconoscimento vocale di Chrome non c'è in
  Electron; lo Studio lo dice e si scrive a mano.
- **YouTube**: chi usa un ID client OAuth suo aggiunga
  `http://localhost:47231` alle origini JavaScript autorizzate. L'user agent
  non dice «Electron», se no Google rifiuta l'accesso.
- **Firma**: l'installatore non è firmato, e SmartScreen lo segnala la prima
  volta («Ulteriori informazioni» → «Esegui comunque»).

## Lavorarci

```sh
cd desktop
npm install                 # Electron ed electron-builder
npm run avvia               # prepara app-web/ e apre il programma
npm start                   # apre il programma sui file del repository (senza prepara)
npm run dist                # l'installatore del sistema su cui sei (Windows → .exe)
node costruisci.js --linux --cartella   # solo il programma spacchettato, per provare la configurazione
```

Prove: `node scripts/prova-desktop.js --solo-node` (server, custode,
dizionari; gira anche nel workflow), `node scripts/prova-desktop.js` (più le
Impostazioni nel browser), `xvfb-run -a node scripts/prova-desktop.js
--electron` (più il programma vero: salva una chiave, chiude, cancella il
Local Storage, riapre e la ritrova). Le variabili `ASTROCAL_DATI` e
`ASTROCAL_PORTA` danno al programma una cartella dati e una porta sue.

Il workflow prende `ADSB_PROXY_URL`, `EDGE_TTS_API_URL` e `YOUTUBE_CLIENT_ID`
dalle stesse variabili di repository del deploy del sito.
