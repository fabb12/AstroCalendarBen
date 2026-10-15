# Controllo degli accessi

Dalla v504 l'app può chiedere **nome utente e password** prima di aprirsi, dare
a ogni utente **solo le funzioni che gli spettano** e contare **come ognuno la
usa**. Si accende e si spegne con un parametro solo. Spento — ed è il caso di
serie — l'app è identica a prima.

Due pezzi:

| File | Cosa fa |
|---|---|
| `accessi.js` (prefisso `acc`) | Nell'app: la porta d'ingresso, la sessione salvata, i permessi, il conteggio dell'uso, «Il tuo account» e «Gestisci utenti» nelle Impostazioni (scheda Dati). |
| `worker-accessi.js` | Il server, su Deno Deploy con Deno KV: utenti, password, sessioni, statistiche. Non fa parte del sito pubblicato. |

---

## Accendere e spegnere

**Il parametro è `ACCESSI_ATTIVO`.**

- In produzione: GitHub → *Settings → Secrets and variables → Actions →
  Variables*, due variabili di repository:

  | Name | Value |
  |---|---|
  | `ACCESSI_ATTIVO` | `true` per accendere, `false` (o assente) per spegnere |
  | `ACCESSI_URL` | l'indirizzo del server, es. `https://astrocalendarben-accessi.deno.dev` (senza `/api/accessi`, senza `/` finale) |

  Poi *Actions → Pubblica il sito → Run workflow* (o un push su `main`). Il
  deploy scrive i due valori in `config.js`. Se `ACCESSI_ATTIVO` è acceso e
  `ACCESSI_URL` manca, il deploy **si ferma** con un errore: un'app chiusa per
  tutti non va online per sbaglio.

- In locale (o in una copia senza deploy): in `config.js`
  ```js
  window.ACCESSI_ATTIVO = true;
  window.ACCESSI_URL = 'https://astrocalendarben-accessi.deno.dev';
  ```

Spegnere riapre l'app a tutti; utenti e statistiche restano sul server, pronti
per la volta dopo.

---

## Il server, dall'inizio

1. Account gratuito su [dash.deno.com](https://dash.deno.com) (accesso con
   GitHub).
2. **New Project** → collega il repository, punto d'ingresso
   `worker-accessi.js` (o, per provare, un *Playground* con dentro il file).
   Deno KV è già incluso: niente da configurare.
3. Nelle *Settings → Environment Variables* del progetto:

   | Variabile | Valore |
   |---|---|
   | `ACCESSI_ADMIN_UTENTE` | il nome del primo amministratore, es. `ben` |
   | `ACCESSI_ADMIN_PASSWORD` | la sua password iniziale (almeno 8 caratteri) |
   | `ORIGINI_AMMESSE` | facoltativa: altri siti, oltre a `https://fabb12.github.io`, che possono usare il server (separati da virgola) |
   | `ACCESSI_DURATA_GIORNI` | facoltativa: dopo quanti giorni senza uso una sessione scade (di serie 30) |

4. Prova: `https://<progetto>.deno.dev/api/accessi/stato` deve rispondere
   `"pronto": true, "archivio": "deno-kv", "adminDaVariabili": true`.
5. Le due variabili di repository qui sopra, e il deploy.

Il primo amministratore si crea **solo se non esiste**: dopo, la sua password
si cambia dall'app (Impostazioni → Dati → Il tuo account → Cambia la password)
e la variabile non la sovrascrive più. Se la si dimentica, si mette in
`ACCESSI_ADMIN_UTENTE` un nome nuovo: al primo avvio nasce un amministratore
nuovo, che può reimpostare la password del vecchio.

`ACCESSI_MEMORIA=1` tiene tutto in memoria: **solo per le prove**, al riavvio
si perde ogni cosa. Senza Deno KV e senza quella variabile il server non fa
entrare nessuno (`"pronto": false`, 503), e l'app lo dice sulla porta.

---

## Utenti e funzioni

Da *Impostazioni → Dati → Il tuo account → Gestisci utenti* (solo per gli
amministratori):

- **Nuovo utente**: nome utente (3–64 caratteri, minuscole, cifre, `. _ - @`;
  non si cambia dopo), nome da mostrare, password, ruolo, attivo, note e le
  funzioni abilitate.
- **Modifica**: tutto tranne il nome utente. Una password nuova o l'account
  spento fanno uscire l'utente **da tutti i dispositivi**.
- **Chiudi le sessioni aperte**: fa uscire l'utente ovunque senza cambiargli
  niente.
- **Elimina l'utente**: con le sue statistiche. Non si può eliminare sé
  stessi, e serve sempre almeno un amministratore attivo.

Le funzioni (`ACC_FUNZIONI` in `accessi.js`):

| Id | Cosa apre |
|---|---|
| `vista:stasera` | Stasera |
| `vista:calendario` | Calendario: Mese, Agenda, Diario |
| `vista:cielo` | Planetario |
| `vista:telescopio` | Telescopio |
| `vista:didattica` | Didattica |
| `vista:demo` | Demo e CosmoStorie |
| `sistema3d` | Il Sistema Solare in 3D |
| `missione` | Missione Cielo |
| `youtube` | Pubblicare i filmati su YouTube |
| `eventi` | Aggiungere eventi propri |
| `*` | Tutte (anche quelle aggiunte in futuro) |

Gli amministratori hanno sempre tutto. Un utente senza nessuna sezione vede la
porta con «nessuna sezione abilitata» e il tasto Esci.

Una funzione negata si nega **due volte**: sparisce dall'interfaccia (una
regola CSS generata in `<style id="acc-regole">`, che vale anche per i tasti
disegnati dopo) e la funzione che la apre non parte (`accessiUsa('<id>')` in
`apriSistemaSolare`, `missApriPannello`, `ytApriPubblica`, nel modulo degli
eventi; `accessiFiltraVista` in `mostraVista`, che porta alla prima vista
permessa). Una demo in corso attraversa le viste come anteprime e non viene
fermata.

**Aggiungere una funzione**: una riga in `ACC_FUNZIONI` (id, eventuali `viste`,
selettori da nascondere), il nome nei due dizionari
(`acc.funzione.<id con _ al posto di :>`) e `accessiUsa('<id>')` dove si apre.

I cambi di funzioni arrivano all'utente alla verifica successiva della
sessione: all'apertura dell'app, tornando sulla scheda dopo dieci minuti, o
al primo invio delle statistiche respinto.

---

## La sessione

- Il server dà un gettone casuale (32 byte) e ne tiene solo l'impronta
  SHA-256. L'app lo salva in `localStorage` (`astrocal_accessi_sessione_v1`):
  **ricaricare la pagina, chiudere il browser, riavviare il telefono non fa
  uscire**. Il gettone non va nel backup.
- La sessione **scorre**: ogni verifica la allunga di 30 giorni
  (`ACCESSI_DURATA_GIORNI`). Chi usa l'app non rientra mai; chi sparisce per
  un mese sì.
- **Senza rete si resta dentro** fino alla scadenza salvata: l'app funziona
  offline, e la porta non deve chiuderla. Gli eventi delle statistiche
  aspettano.
- Un **401** del server (sessione revocata, utente spento, password cambiata)
  fa uscire subito, con «La sessione è scaduta o è stata chiusa».
- Niente cookie: app (github.io) e server (deno.dev) stanno su domini diversi,
  e i browser bloccano i cookie di terze parti.

## Password e tentativi

PBKDF2-SHA256, sale casuale, 100 000 giri (il massimo che WebCrypto concede su
tutte le piattaforme). Confronti a tempo costante; un nome che non esiste costa
lo stesso tempo di uno che esiste. Dopo 5 tentativi sbagliati su un utente (o
20 da uno stesso indirizzo) in 15 minuti, 15 minuti di pausa.

## Le statistiche

Cosa si conta, per utente e per giorno (`['stat', utente, giorno]` in Deno KV,
cancellati da soli dopo 400 giorni):

- **aperture** dell'app (ogni caricamento con una sessione) e **accessi** con
  password;
- **tempo per sezione**: solo con la pagina davanti agli occhi, e senza un
  gesto per mezz'ora il conto si ferma all'ultimo gesto (un telefono acceso sul
  comodino non fa ore di planetario);
- **funzioni usate** (vista 3D, Missione Cielo, YouTube, eventi, demo avviate)
  e **funzioni chieste ma non abilitate**;
- **dispositivo** (telefono, tablet, computer; app installata o browser),
  **lingua**, **ore del giorno**, ultima versione dell'app.

Non si contano posizioni, contenuti, testi scritti, indirizzi IP. Gli eventi
partono a pacchetti ogni minuto, quando la pagina si nasconde (con `keepalive`)
e al ritorno della rete; la coda (`astrocal_accessi_coda_v1`) tiene al più 400
eventi.

Nella scheda di un utente: tempo d'uso, giorni attivi, aperture, accessi, media
per giorno attivo, ultima attività, l'attività giorno per giorno, il tempo per
sezione, le funzioni usate e negate, le ore del giorno, i dispositivi, le
lingue, le sessioni aperte. Periodo: 7, 30, 90 o 365 giorni.

---

## Cosa protegge e cosa no

**Protegge**: chi entra nell'app e cosa ci vede; le password (mai nel browser,
mai in chiaro sul server); le sessioni (revocabili, a scadenza); i dati degli
utenti e le statistiche, che legge solo un amministratore.

**Non protegge i file del sito.** GitHub Pages serve file statici a chiunque:
chi conosce l'indirizzo può scaricare `app.js` e aprirlo senza la porta, o
togliere la porta dagli strumenti per sviluppatori. È il limite di un'app senza
backend, e nessun codice nel browser lo supera. Per nascondere anche i file
serve mettere l'accesso **davanti all'hosting** (Cloudflare Access, un server
proprio con autenticazione): il controllo descritto qui resta utile anche lì,
per le funzioni per utente e le statistiche.

---

## API del server

Tutte sotto `/api/accessi/`, JSON, gettone in `Authorization: Bearer …`
(o nel corpo, campo `gettone`, per gli invii con `keepalive`).

| Metodo e percorso | Chi | Cosa |
|---|---|---|
| `GET stato` | tutti | il server è pronto? quale archivio? |
| `POST entra` `{utente, password, dispositivo}` | tutti | `{gettone, scade, profilo}` |
| `GET sessione` | utente | verifica e allunga: `{scade, profilo}` |
| `POST esci` | utente | chiude questa sessione |
| `POST password` `{vecchia, nuova}` | utente | cambia la propria password |
| `POST eventi` `{eventi: [...]}` | utente | statistiche |
| `GET utenti?giorni=30` | admin | elenco con riassunto |
| `POST utenti` | admin | crea |
| `PATCH utenti/<id>` | admin | modifica (nome, ruolo, funzioni, attivo, note, password) |
| `DELETE utenti/<id>` | admin | elimina |
| `GET utenti/<id>/statistiche?giorni=30` | admin | statistiche e sessioni aperte |
| `DELETE utenti/<id>/sessioni` | admin | chiude tutte le sessioni |

Errori: `{ "errore": "credenziali" | "bloccato" | "disattivato" | "sessione" |
"permesso" | "esiste" | "utente" | "password" | "ultimoAdmin" | "sestesso" |
"origine" | "archivio" | ... }`, ognuno col suo messaggio nei dizionari
(`acc.errore.*`).

## Prova

```
node scripts/prova-accessi.js            # server e app nel browser
node scripts/prova-accessi.js --server   # solo il server
```

La prova chiama il server con l'archivio in memoria e un orologio che si
sposta, poi apre l'app vera in Chromium con lo stesso server dietro alle rotte
di Playwright (`FOTO=<cartella>` salva le schermate a 390 px).
