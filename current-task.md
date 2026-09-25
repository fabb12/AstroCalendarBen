# Niente in corso

Ultimo lavoro: Demo riorganizzata e menu raggruppato (v373).

- Menu a sei voci: Stasera, **Calendario** (Mese/Agenda/Diario in
  `#sottonav-calendario`, `GRUPPI_VISTE` in `app.js`), Planetario,
  Telescopio, Didattica, **Demo** (`#vista-demo`).
- La pagina Demo raccoglie tutto quello che stava in Impostazioni → Demo e
  la Narrazione di Impostazioni → Osservazione, in cinque gruppi.
- `demo.js`: comandi solo a demo in corso (`hidden` vince), icona
  Pausa/Riprendi, sottotitoli in `#demo-sottotitoli`, tocco ≠ presa della
  camera (trascina/pizzico/rotellina sì), pieno schermo senza lampeggi fra
  planetario e 3D, musica «Encelado» 30% nelle eclissi con ripristino
  (`musicaDemoAvvia`/`musicaDemoFerma` in `app.js`).
- Tolto il paesaggio sonoro generato.
- Corretti tre difetti preesistenti: la vista pulita toglieva i
  `pointer-events` alla tela (camera immobile), `skyMostraGruppo` usato
  come «apri» mentre è un interruttore (pannello chiuso a fine demo),
  e l'audio della registrazione mai iniettato (aggancio tolto prima del
  `captureStream` asincrono; in più una ReferenceError su `comandiCielo`).
- Prove: nuova `scripts/prova-demo-pagina.js` (19), aggiornate
  `prova-demo-browser`, `prova-demo-regia`, `prova-narrazione-browser`,
  `prova-guida`, `prova-musica`.
- Non provato su un telefono vero (pieno schermo nativo e gesti reali).
