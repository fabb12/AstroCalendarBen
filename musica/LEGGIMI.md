# Musica dell'app

Questa cartella contiene le tracce di sottofondo selezionabili nelle
**Impostazioni → Atmosfera**. Il paesaggio sonoro generato non esiste più:
ogni scelta del selettore è un file di questa cartella (una preferenza salvata
col vecchio valore `generata` torna alla traccia predefinita).

Le stesse tracce compaiono nel selettore della pagina **Demo → Narrazione e
audio** per scegliere la colonna sonora di tutte le demo, sia predefinite sia
create dall'utente, riprodotta al 30%. `Encelado1` («Encelado») resta il valore
iniziale e di ripiego per le
preferenze più vecchie: non rinominarne l'`id`.

## Aggiungere una traccia

1. Copia qui un file audio (preferibilmente `.mp3`, `.ogg` o `.m4a`).
2. Apri `catalogo.js` e aggiungi una voce a `ASTRO_TRACCE_MUSICALI`:

   ```js
   { id: 'notte-serena', nome: 'Notte serena', file: 'notte-serena.mp3' },
   ```

3. Usa un `id` unico e stabile: è il valore ricordato nelle preferenze del
   browser. `nome` è ciò che compare nel selettore e `file` è il nome del file
   presente in questa cartella.

Non inserire percorsi esterni o sottocartelle in `file`. Le tracce vengono
riprodotte in loop e rispettano il volume scelto. Verifica sempre di avere i
diritti per distribuire i file audio aggiunti al repository.

## Le canzoni delle CosmoStorie (`canzoni/`)

La sottocartella `canzoni/` contiene le canzoni che una CosmoStoria segue dal
principio alla fine (`story_music { sync: on }`, vedi `STORIE.md` §Le storie
cantate). **Non** vanno in `catalogo.js`: hanno la voce, e come colonna sonora
di tutte le demo in ciclo non hanno senso. Stanno qui e non in
`audio/storie-musica/` perché quella cartella è dello Studio, che a ogni
sincronizzazione ne toglie i file che nessuna sua storia usa.

- `pallido-punto-blu.mp3` — «Pallido puntino blu», il rap sulle parole di
  Carl Sagan per la storia `storia_puntino` (4'08", portato da chi usa l'app).
