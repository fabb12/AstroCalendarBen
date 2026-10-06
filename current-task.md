# Niente in corso

Ultimo lavoro (v416): la regia e i rumori delle Storie cosmiche (`STORIE.md`, §La regia e i rumori).

- `storie-cosmiche.js` §7-ter: una lente sulla tela (`storLenteApri`/`storLenteChiudi`, aperta da `skyDisegna`, `solDisegna`, `solDisegnaVicino`, `cosmDisegna` e chiusa dopo i volti) che va vicino a chi parla con gli occhi al 40% dell'altezza, tiene insieme chi dialoga, va a guardare i botti con la scossa, segue chi si muove; molla smorzata, tetto ×3,2, finestra sempre dentro alla tela. Comando `story_camera { mode: auto|wide|close, target, zoom }`.
- §7-quater: 24 rumori sintetizzati con Web Audio (`RICETTE`, `STOR_SUONI`), sul contesto della voce e nella presa del filmato; ogni effetto e ogni gesto ha il suo (`sound` sui comandi: `auto`, `off`, un nome), comando `sound { type, volume }`.
- Opzioni delle demo `cameraStorie` ed `effettiSonori` (pagina Demo, opzioni, sotto la musica); `AstroDemo.cameraManuale`. Studio: casella «La camera va vicino a chi parla» (`cameraViva`).
- I nomi della 3D restano della loro misura sotto la lente (`storLenteK` in `solEtichetta`); nel banco Terra e Luna righello e racconto dopo la lente; nella scala cosmica letture e riga dopo i volti.
- Prove: `prova-storie.js` (72), `prova-storie-browser.js` (79), `prova-demo.js`, `controlla-i18n.js --patto` (342, invariato) e le altre elencate nel messaggio del commit.
