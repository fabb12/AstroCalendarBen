# Musica dell'app

Questa cartella contiene le tracce di sottofondo selezionabili nelle
**Impostazioni → Atmosfera**. L'app continua a offrire anche il paesaggio
sonoro generato, che non richiede un file audio.

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
