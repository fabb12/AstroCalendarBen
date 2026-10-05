# Niente in corso

Ultimo lavoro (v410): il sistema delle notifiche (`app.js` §5, `sw.js` `notificationclick`). La campanella ora accende e spegne i promemoria (scelta separata dal permesso), le notifiche passano dal service worker e arrivano come notifiche di sistema anche su Android, la voce non parte più con i promemoria, più eventi insieme diventano una notifica sola.

Prima (v409): le Storie cosmiche diventano uno strumento per crearle (`STORIE.md`).

- Pagina Demo a due linguette: «Demo» e «Storie cosmiche» (`storie-studio.js`, `studioSchede`).
- Lo Studio delle storie (`storie-studio.js`): scopo con modelli, personaggi, scene e momenti, azioni, idee, comandi a parole, controllo dello scopo, prova, salvataggio fra le demo.
- Nella 3D il volto sta sull'astro (che cresce, gira la testa, prende la luce del Sole); gli astri possono viaggiare fuori dall'orbita e tornare (`character_move`, `character_return`), animarsi e cambiare misura (`character_animate`, `character_scale`); effetti speciali (`effect`). Ganci in `app.js` prima della proiezione (`storScena3D`, `storRaggio3D`).
- Prove: `prova-storie.js` (50), `prova-storie-browser.js` (57), `prova-demo-pagina.js`. Due verifiche della prova nel browser sono state adattate all'audio registrato aggiunto dal commit «Aggiunto nuova narrazione».
- Già rotte prima di questo lavoro (non toccate): `prova-narrazione.js` (5 fallite) e `prova-demo-browser.js` («La demo lascia invariato lo stato dello schermo intero»).
