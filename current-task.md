# Task Corrente

La scheda dell'oggetto nel planetario (il riquadro che si apre toccando un
astro sulla mappa): tre lamentele, tutte vere.

- **Si sovrapponeva agli altri pannelli su schermo piccolo.** Il pannello di
  un gruppo (Astri, Filtri…) e la scheda dell'oggetto stanno tutt'e due
  ancorati in fondo alla mappa, uno sopra `top:0`/sotto la barra del tempo e
  l'altro sopra la barra del tempo appoggiato a sinistra: su un telefono,
  aperti insieme, si scrivevano l'uno sopra l'altro. Capitava in due modi —
  si tocca un astro sulla mappa mentre "Astri" o "Filtri" sono aperti, o si
  apre un gruppo mentre la scheda è già a schermo. Sistemato rendendoli
  mutuamente esclusivi: `skyApriDettaglio()` ora chiama `skyMostraGruppo('')`
  prima di mostrarsi, e `skyMostraGruppo()` chiude la scheda
  (`skyChiudiDettaglio()`) quando un gruppo si apre. La selezione dell'astro
  non si perde — solo il riquadro dei dati si nasconde.
- **Troppe informazioni tutte insieme** — fino a dodici righe per un
  pianeta (tipo, costellazione, distanza, dimensioni, magnitudine,
  direzione, altezza, coordinate, eclittica, orari…). `skyRigheScheda()`
  adesso torna `{essenziali, dettagli}`: le prime (tipo, fase/magnitudine,
  direzione, altezza, sorge/tramonta) restano sempre in vista; le seconde
  (coordinate, distanza, dimensioni, temperatura, eclittica…) stanno dietro
  a un `<details>` "Altri dati", chiuso di default.
- **Nessuna immagine.** Aggiunta una miniatura vera in testa alla scheda
  (`skySchedaImmagineHtml()`): per Sole, Luna, pianeti e cielo profondo è la
  stessa faccia dipinta che il planetario disegna sulla mappa
  (`skyFacciaDi`/`skyFacciaProfondo`, già in cache), letta una volta come
  PNG e tenuta in `skySchedaImg` così non si ridipinge a ogni giro
  dell'orologio. Stelle, satelliti e comete restano con la sola icona: non
  hanno una faccia dipinta da mostrare.

CSS: `.scheda-testata` (la riga miniatura+titolo), `.scheda-img`,
`.dettagli-scheda` (il `<details>`) in style.css, sezione "SCHEDA
DELL'OGGETTO SULLA MAPPA".

Provato con Playwright/Chromium (senza rete: Astronomy Engine non carica in
sandbox, quindi verificato passando oggetti finti diretti a `skySchedaHtml`
invece che dal tocco vero sulla mappa — la logica che legge i dati è la
stessa). Confermato via screenshot: la miniatura di Marte si vede, "Altri
dati" si apre, aprire "Filtri" chiude la scheda e viceversa, `node --check
app.js` pulito. `CACHE_NAME` → `astrocal-v102`.

[x] Completato.
