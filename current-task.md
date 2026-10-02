# Niente in corso

Ultimo lavoro (v402): la demo «Dalla Terra all'universo» (`universo`, 16 scene, 380 s).

- Torna l'azione `cosmic_scale` in `demo.js` (senza il futuro delle sonde), con in più la camera della carta (`orbit`, `elev_from`/`elev_to`) scritta da `cosmRegia`.
- Due scene cosmiche di fila sono un volo solo: la chiusura lascia la carta aperta per un giro del browser.
- `camera_3d` con `focus: 'Earth'` spegne i mondi minori (come già col Sole).
- Prove: `node scripts/prova-demo-universo.js` (verde), `prova-demo-voyager`, `prova-demo-stagioni`, `prova-demo-regia`, `prova-scala-cosmica` verdi. In `prova-demo-browser.js` resta rossa, come prima, la prova «La demo lascia invariato lo stato dello schermo intero».
