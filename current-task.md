# Task Corrente

Niente in corso.

## Ultimo intervento completato

Il feed ADS-B usa ora direttamente l'API geografica di OpenSky Network: niente
più ADSB.fi privo di CORS e niente proxy pubblici soggetti a 403/429. La query è
limitata al rettangolo attorno all'osservatore e viene ripetuta ogni cinque
minuti per rispettare la quota anonima; fra due letture l'app continua a
proiettare localmente le traiettorie. Aggiunto il relativo interprete e portata
la cache PWA a `astrocal-v159`.
