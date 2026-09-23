# Demo automatizzate

Apri **Impostazioni → Demo automatizzate**, seleziona una demo e premi
**Avvia demo selezionata**. La finestra si chiude per lasciare libero il cielo.
Pausa, Riprendi, Ricomincia e Termina demo restano disponibili nelle due viste.
Escape o un intervento fuori dai controlli interrompe la demo e restituisce
vista, orologio, camera, filtri, inseguimento e playback precedenti.
Cambiare scheda mette in pausa: la ripresa è esplicita.

## Libreria ed editor

Il tour `eclisse_tour` è di sola lettura. **Crea nuova** apre una bozza con
una prima scena valida; **Duplica** copia lo script nell'editor. Modifica il
nome dopo `define_demo`, le durate e i parametri, poi premi **Salva script**.
Le demo utente si modificano direttamente e si eliminano con conferma.
Le bozze rimangono disponibili chiudendo e riaprendo le Impostazioni.
Il selettore chiede conferma prima di scartare modifiche non salvate.

Gli snippet aggiungono una scena completa in fondo al tour, anche quando
contiene commenti e stringhe con parentesi. Sono disponibili le tre viste e
le cinque azioni principali con parametri validi. Il riepilogo mostra durata,
numero di scene e bersagli. Il parser segnala riga e colonna per gli errori
sintattici; la validazione dei comandi e degli orari blocca il salvataggio.
Gli orari civili vengono verificati nella data e nel luogo attualmente scelti,
compresi i buchi del cambio d'ora, e ricontrollati all'avvio e all'esecuzione.

**Esporta .astrodemo** scarica esattamente il testo dell'editor, se valido.
**Importa** accetta testo DSL (massimo 100 KB), lo valida subito e apre una
bozza da salvare esplicitamente: non sovrascrive demo omonime. Gli identificativi
di storage sono distinti dal nome DSL. Tutto resta su questo dispositivo nella
chiave `astrocal_demo_utente_v1` di localStorage; per trasferirlo usa i file.
Errori di quota, accesso o archivio corrotto vengono mostrati senza dichiarare
un salvataggio riuscito o sostituire silenziosamente i dati precedenti.

`demo-libreria.js` contiene la libreria con storage e validatore iniettati;
`demo-impostazioni.js` collega editor e import/export a `AstroDemo.valida` e
`AstroDemo.libreria`. Il parser e il motore puro non cambiano grammatica.

## Tour predefinito

- **10 secondi:** cielo del giorno e del luogo attualmente selezionati,
  dalle 18:00 alle 22:00 nel fuso del luogo, con Venere centrata ed evidenza
  visiva ×5. Il filtro sotto l'orizzonte è temporaneamente abilitato:
  non viene promessa la visibilità reale di Venere da ogni località.
- **5 secondi:** volo geometrico esistente dal planetario al Sistema Solare,
  controllato dal medesimo orologio della demo, anche in pausa.
- **15 secondi:** salto esplicitato all'eclisse del 12 agosto 2026.
  Astronomy Engine ne calcola il massimo a partire dal 1 agosto; le posizioni
  non vengono forzate. Il banco Terra–Luna mostra i coni d'ombra; la camera
  compie 360° con accelerazione e rallentamento graduali, centrando l'impronta
  dell'ombra lunare sulla Terra e mantenendo la coppia nel campo.

La preferenza di movimento ridotto conserva i tempi, sostituisce il volo
con la dissolvenza già presente e disattiva la rotazione automatica.
Le dimensioni del banco e la sua legenda restano quelle dell'app.
L'evidenza cambia il disegno, non la magnitudine astronomica.

## Sintassi

Non è YAML né JavaScript eseguibile: è un linguaggio di dati.
Il parser supporta commenti `//`, stringhe fra apici o doppi apici,
identificatori, numeri decimali anche negativi, orari HH:MM e durate in s/ms.
Una demo contiene scene sequenziali; tutte le azioni di una scena sono
simultanee e condividono la sua durata. I punti e virgola sono obbligatori.

```text
define_demo 'eclisse_tour' {
  scene planetarium_view {
    duration: 10s;
    action: timelapse { start: 18:00, end: 22:00 };
    action: highlight_object { name: 'Venus', scale: 5.0 };
    action: center_target { target: 'Venus' };
  }
  scene transition {
    duration: 5s;
    action: zoom_view { type: geometric, final_target: solar_system_3d };
  }
  scene solar_system_3d {
    duration: 15s;
    action: orbit_object { object: 'Earth-Moon', angle: 360, speed: slow };
    action: center { target: 'Eclipse Shadow' };
  }
}
```

`center` è alias di `center_target`.
`transition_to { target: solar_system_3d }` o
`transition_to { target: planetarium_view }` cambia vista direttamente.
`timelapse` attraversa la mezzanotte se l'orario finale precede quello iniziale.
Ore civili inesistenti per il cambio d'ora vengono rifiutate.
`highlight_object` accetta i sette pianeti visibili dalla Terra e scale 1–10.
`center_target` accetta anche Sun/Moon e il bersaglio speciale Eclipse Shadow.
`orbit_object` supporta Earth-Moon: angle stabilisce il giro, mentre la
durata della scena ne stabilisce la velocità; slow indica la rampa morbida.
`zoom_view` supporta la transizione geometric verso solar_system_3d.

Gli errori di sintassi riportano riga e colonna. Comandi, parametri e scene
sconosciuti vengono rifiutati prima di cambiare lo stato dell'app.
Gli errori durante l'esecuzione interrompono e ripristinano la sessione.

## Estensioni

`AstroDemo.avvia(testo)`, `pausa()`, `riprendi()`, `ferma()` sono le porte
pubbliche. `AstroDemo.script` contiene il tour predefinito.

```js
AstroDemo.registra('mia_azione', {
  verifica(parametri, scena) { /* rifiutare parametri non validi */ },
  crea(parametri, contesto, scena) {
    return {
      aggiorna(progresso) { /* 0..1, incluso l'ultimo fotogramma */ },
      chiudi() { /* liberare effetti temporanei anche su stop/errore */ }
    };
  }
});
```

Il nucleo `AstroDemoMotore` è indipendente da DOM e astronomia; il registro
può quindi collegare altre applicazioni. L'adattatore attuale conosce i nomi
di scena planetarium_view, transition e solar_system_3d.
Non esegue codice contenuto nello script e non carica risorse esterne.

## Verifica

`node scripts/prova-demo.js`: parser, azioni simultanee, tempi esatti,
pausa, recupero di fotogrammi tardivi, stop, errori e ripristino.
`node scripts/prova-demo-browser.js`: viste reali con Playwright e Astronomy
Engine locali, centraggio dell'ombra, pause nelle tre scene, chiusura durante
l'apertura differita, movimento ridotto e ripristino.
Il workflow Verifica Demo esegue entrambe le prove e conserva una schermata.
