# Niente in corso

Ultimo lavoro (v401): vista 3D e scala cosmica.

- Le Voyager nella 3D e nella scala cosmica stanno solo al posto di oggi (niente filo, scie, futuro, tacche); nome solo a certe scale (`solSondaDaNominare`, `COSM_SONDE_NOMI_L`).
- Tolti «Voyager oggi» dalla fila, Voyager 1 dalla riga, il tondo «Dalla Terra».
- Zoom indietro dalla 3D → scala cosmica (`solZoomVersoIlCosmo`), zoom avanti sotto `COSM_L_RIENTRO` → si torna a «Tutto».
- Scala cosmica girabile in 3D (`cosm.az`/`cosm.elev`, `cosmRuota`).
- Demo delle Voyager riportata alla v399 (15 scene); azione `cosmic_scale` tolta.
- Prove: `node scripts/prova-scala-cosmica.js` (verde), `prova-demo-voyager.js` (verde). In `prova-sistema3d.js` restano rosse le stesse di prima (stesso istante entrando/uscendo, lune a distanze vere, ReferenceError `SOL_LUNE`).
