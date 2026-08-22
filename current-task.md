# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — planetario come apertura anche sul computer

Il Planetario è ora la vista predefinita anche aprendo `index.html` nel browser,
non soltanto avviando la PWA installata. I link espliciti a una vista o alla
scheda di un evento continuano ad avere precedenza.

Sopra i 1180 px il riquadro del cielo usa tutta la larghezza e quasi tutta
l'altezza disponibile della finestra, lasciando visibili testata e navigazione:
non entra quindi automaticamente in modalità schermo intero.

Accanto al nome del luogo, sia sulla mappa sia nel pannello Tempo e luogo,
compare alla stessa dimensione la quota del terreno appena è disponibile. Il
controllo delle coordinate impedisce di mostrare per errore la quota del luogo
precedente durante uno spostamento.

La cache PWA è stata portata ad `astrocal-v129`.
