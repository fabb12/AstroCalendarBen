# Task Corrente

Niente in corso.

## Ultimo intervento completato

La **camera GPS durante il caricamento del rilievo** ora assorbe le grandi
correzioni di quota a non più di 4 m/s. Nel frattempo il solo grembiule
invisibile sotto i piedi viene raccordato alla quota corrente dell'occhio:
la camera non deve più saltare verso l'alto e non può finire dentro i
poligoni della montagna appena caricata. Il raccordo termina a 70 metri,
prima dell'inizio del terreno visibile, quindi non abbassa le montagne vere.
Cache PWA portata ad `astrocal-v228`.

## Intervento precedente

Gli **aerei ADS-B in macchina**: col GPS acceso non comparivano mai, e la
ragione non era la rete. Il centro del modulo è l'osservatore del planetario,
che si sposta a ogni passo del filtro dell'app — centocinquanta metri, cioè
**sei secondi** a novanta all'ora — e ognuno di quei passi faceva quattro cose
insieme: buttava la fotografia, azzerava il suo orologio, **abortiva la
richiesta in volo** e ne faceva partire un'altra. Sei secondi sono meno del
tempo che una porta ADS-B ci mette a rispondere. Misurato col modulo vero e
una porta che risponde in otto secondi, dieci chilometri di strada:
**67 richieste, 67 abortite, zero risposte, zero aerei**; adesso **4 richieste
(una corsa sola), una risposta, quattro aerei in cielo per tutto il viaggio**.

La cura sta in una cosa che si sapeva e non si usava: le posizioni degli aerei
sono **latitudini e longitudini**, e azimut, altezza e distanza si rifanno da
capo a ogni fotogramma. Muovendosi non diventano sbagliate: si aggiornano.

- `aerei.js` §**4-bis** (nuova): il centro non si confronta più per uguaglianza
  ma per **distanza**. Sotto `tolleranzaCentroKm()` (un quinto del raggio, fra
  1,5 e 12 km) non succede niente di niente; sopra si chiama `ricentraPresto()`,
  che **anticipa** il prossimo scarico senza mai scendere sotto
  `AEREI_MOTO_MIN_MS` (mezzo minuto) né scavalcare il freno degli errori; solo
  oltre `saltoCentroKm()` (mai meno di 25 km) si è altrove — un'altra città nel
  pannello Tempo e luogo — e allora sì, si butta. Il conto delle riprove non si
  azzera più a ogni fix: era il freno dei 429, tolto proprio a chi ne ha più
  bisogno.
- La **risposta che arriva mentre ci si muove** non si scarta più sul traguardo
  (era `chiaveCentro(obs) !== chiaveCentro(osservatore())`, cioè undici metri):
  adesso solo un salto la rende inutile.
- `unisciConLaMemoria()`: ogni lettura si **somma** alla precedente invece di
  sostituirla. Chi è stato visto da meno di `AEREI_MEMORIA_MS` (2 min) resta e
  continua a essere propagato, anche se il feed non l'ha riconfermato — le reti
  ADS-B sono fatte di riceventi volontari e due letture di fila hanno buchi
  diversi. Due minuti e non trenta: propagare mezz'ora un aereo che nessuno
  vede più non è tenerlo, è inventarlo.
- `aereiRaggioCambiato()` non svuota più: stringendo il raggio la risposta di
  prima **contiene** quella nuova e basta tagliarla, allargando ne è un pezzo
  giusto in attesa del resto. E non abortisce la richiesta in volo.
- `osservatoreDisegno()`: chi **disegna** usa il punto vivo di `terreno.js`
  §6-bis (centocinquanta metri non spostano una stella, ma un aereo a due
  chilometri di quattro gradi); chi **scarica** continua a usare `osservatore()`.
- Prove nuove nel §27 di `verifica.html` (22), col contro-esempio del confronto
  a quattro decimali. 849 in tutto, tutte passate.

Cache PWA portata ad `astrocal-v225`.
