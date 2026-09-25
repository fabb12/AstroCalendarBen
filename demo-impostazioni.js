/* La pagina Demo: libreria, opzioni ed editor assistito. Il percorso normale
 * resta semplice, il DSL è avanzato. Prima stava in una linguetta delle
 * Impostazioni; adesso è una voce del menu principale (`vista-demo`). */
(function () {
  'use strict';
  const $ = id => document.getElementById('demo-' + id);
  const t = k => astroI18n.t('demo.' + k);
  const libreria = AstroDemo.libreria, editor = $('editor'), elenco = $('elenco');
  const avanzate = $('avanzate');
  let selezionata = null, originale = '', nuova = false;

  function nomeDemo(d) {
    if (d.solaLettura) return t('builtin.' + d.chiave + '.title');
    try { return AstroDemoMotore.analizza(d.testo).id; } catch (_) { return d.chiave; }
  }
  const testoOpzione = d => nomeDemo(d) + ' · ' + t(d.solaLettura ? 'predefinitaBreve' : 'utente');

  const azioni = {
    timelapse: ['planetarium_view', 'timelapse { start: 18:00, end: 22:00 }'],
    highlight_object: ['planetarium_view', "highlight_object { name: 'Venus', scale: 5.0 }"],
    center_target: ['planetarium_view', "center_target { target: 'Venus' }"],
    set_fov: ['planetarium_view', 'set_fov { degrees: 20 }'],
    frame_objects: ['planetarium_view', "frame_objects { names: 'Mercury,Venus,Mars,Jupiter' }"],
    orbit_object: ['solar_system_3d', "orbit_object { object: 'Earth-Moon', angle: 360, speed: slow }"],
    zoom_view: ['transition', 'zoom_view { type: geometric, final_target: solar_system_3d }'],
    zoom_fov: ['planetarium_view', 'zoom_fov { from: 40, to: 4 }'],
    event_window: ['solar_system_3d', 'event_window { event: lunar_eclipse, from: -120, to: 120 }'],
    camera_3d: ['solar_system_3d', "camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 60, elev_from: 4, elev_to: 20, zoom_from: 1, zoom_to: 1.5 }"],
    aurora_lesson: ['didactic_view', 'aurora_lesson { chapter: anello, from: 48, to: 56, orbit: 120 }'],
    satellite_pass: ['planetarium_view', 'satellite_pass { satellite: iss, before: 1, after: 1 }'],
    // La voce della scena: un ID del dizionario, oppure `text: '…'` scritto a mano.
    narrate: ['planetarium_view', "narrate { id: 'demo.narr.eclisse_tour.1' }"]
  };
  const scena = (vista, azione) => '  scene ' + vista + ' {\n    duration: 10s;\n    action: ' + azione + ';\n  }\n';
  const snippets = {
    planetarium_view: scena(...azioni.center_target),
    transition: scena(...azioni.zoom_view),
    solar_system_3d: scena(...azioni.orbit_object),
    didactic_view: scena(...azioni.aurora_lesson),
    ...Object.fromEntries(Object.entries(azioni).map(([nome, dati]) => [nome, scena(...dati)]))
  };
  for (const nome of Object.keys(snippets)) $('snippet').add(new Option(nome, nome));

  const sporco = () => nuova || editor.value !== originale;
  const abbandona = () => !sporco() || window.confirm(t('scarta'));
  function esito(messaggio) { $('esito').textContent = messaggio; }
  function prova(fn) { try { return fn(); } catch (e) { esito(e.message); } }

  function formatoData(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(astroI18n.locale(), {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'
      }).format(new Date(iso));
    } catch (_) { return iso; }
  }
  function metadatiDemo(demo) {
    let data = '', luogo = '', kp = null, fov = null;
    for (const scena of demo.scene) {
      for (const a of scena.azioni) {
        if (a.comando === 'set_date') data = a.parametri.iso;
        if (a.comando === 'set_location') luogo = a.parametri.name;
        if (a.comando === 'simulate_aurora') kp = a.parametri.kp;
        if (a.comando === 'set_fov') fov = a.parametri.degrees;
      }
    }
    return { data, luogo, kp, fov };
  }
  function aggiungiMeta(nome, valore) {
    if (!valore && valore !== 0) return;
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = nome; dd.textContent = valore;
    $('metadati').append(dt, dd);
  }
  function aggiornaScheda(demo, solaLettura) {
    if (!demo) {
      $('titolo').textContent = t('nonValido');
      $('descrizione').textContent = '';
      $('durata').textContent = '';
      $('badge').textContent = '';
      $('metadati').replaceChildren();
      return;
    }
    const durata = demo.scene.reduce((n, s) => n + s.durata, 0) / 1000;
    const meta = metadatiDemo(demo);
    $('titolo').textContent = selezionata ? nomeDemo(selezionata) : demo.id;
    $('descrizione').textContent = solaLettura && selezionata
      ? t('builtin.' + selezionata.chiave + '.description')
      : t('personaleDescrizione');
    $('badge').textContent = t(solaLettura ? 'predefinitaBreve' : 'personale');
    $('durata').textContent = durata + ' s · ' + demo.scene.length + ' ' + t('scene');
    $('metadati').replaceChildren();
    aggiungiMeta(t('metaData'), formatoData(meta.data));
    aggiungiMeta(t('metaLuogo'), meta.luogo);
    if (meta.kp !== null) aggiungiMeta(t('metaAurora'), t('kpSimulato').replace('{kp}', meta.kp));
    if (meta.fov !== null) aggiungiMeta(t('metaCampo'), meta.fov + '°');
  }

  function verifica() {
    let demo;
    try {
      demo = AstroDemo.valida(editor.value);
      $('validazione').textContent = t('valido');
      editor.setAttribute('aria-invalid', 'false');
    } catch (e) {
      $('validazione').textContent = e.message;
      editor.setAttribute('aria-invalid', 'true');
    }
    const solaLettura = !!(selezionata && selezionata.solaLettura);
    editor.readOnly = solaLettura;
    $('salva').disabled = solaLettura || !demo || !sporco();
    $('inserisci').disabled = solaLettura || !demo;
    $('elimina').disabled = !selezionata || solaLettura;
    $('avvia').disabled = !selezionata || sporco() || !demo;
    $('esporta').disabled = !demo;
    $('duplica').disabled = !demo;
    $('annulla').disabled = !sporco();
    $('modifica').hidden = !selezionata || solaLettura;
    $('duplica').textContent = t(solaLettura ? 'duplicaModifica' : 'duplica');

    if (demo) {
      const bersagli = [...new Set(demo.scene.flatMap(s => s.azioni.flatMap(a =>
        [a.parametri.target, a.parametri.name, a.parametri.object].filter(Boolean))))];
      const durata = demo.scene.reduce((n, s) => n + s.durata, 0) / 1000;
      $('info').textContent = demo.id + ' · ' + demo.scene.length + ' ' + t('scene') +
        ' · ' + durata + ' s' +
        (bersagli.length ? ' · ' + t('bersagli') + ': ' + bersagli.join(', ') : '');
    } else $('info').textContent = t('nonValido');
    aggiornaScheda(demo, solaLettura);
    return demo;
  }

  function carica(chiave, opzioni = {}) {
    const dati = libreria.elenco();
    selezionata = dati.find(d => d.chiave === chiave) || dati[0];
    elenco.replaceChildren();
    for (const d of dati) elenco.add(new Option(testoOpzione(d), d.chiave));
    elenco.value = selezionata.chiave;
    originale = editor.value = selezionata.testo; nuova = false;
    // Dopo un salvataggio si resta nell'editor: richiuderlo voleva dire
    // perdere di vista il testo appena scritto a ogni «Salva».
    avanzate.open = !!opzioni.apri;
    verifica();
  }
  function bozza(testo) {
    selezionata = null; nuova = true; originale = ''; elenco.value = '';
    editor.value = testo; avanzate.open = true; verifica(); editor.focus(); esito(t('bozza'));
  }

  elenco.addEventListener('change', () => {
    const chiave = elenco.value;
    if (abbandona()) prova(() => { carica(chiave); esito(''); });
    else elenco.value = selezionata ? selezionata.chiave : '';
  });
  editor.addEventListener('input', () => { verifica(); esito(''); });
  $('nuova').addEventListener('click', () => {
    if (abbandona()) bozza("define_demo 'nuova_demo' {\n" + snippets.planetarium_view + '}');
  });
  // La copia prende un nome suo: con lo stesso `define_demo` della
  // predefinita la bozza salvata compariva in elenco col nome tecnico di
  // quella, e le due non si distinguevano.
  function nomeCopia(testo) {
    let nomi;
    try { nomi = new Set(libreria.elenco().map(d => AstroDemoMotore.analizza(d.testo).id)); }
    catch (_) { nomi = new Set(); }
    return testo.replace(/^(\s*(?:\/\/[^\n]*\n\s*)*define_demo\s+)(?:'([^'\\]*)'|"([^"\\]*)"|([A-Za-z_][A-Za-z_0-9-]*))/,
      (tutto, prima, a, b, c) => {
        const base = (a || b || c) + '_copia';
        let nome = base;
        for (let n = 2; nomi.has(nome); n++) nome = base + '_' + n;
        return prima + "'" + nome + "'";
      });
  }
  $('duplica').addEventListener('click', () => bozza(nomeCopia(editor.value)));
  $('modifica').addEventListener('click', () => {
    avanzate.open = true; editor.focus();
  });
  $('annulla').addEventListener('click', () => {
    if (abbandona()) prova(() => { carica(selezionata && selezionata.chiave); esito(''); });
  });
  $('salva').addEventListener('click', () => prova(() => {
    const chiave = libreria.salva(editor.value, selezionata && selezionata.chiave);
    carica(chiave, { apri: true }); esito(t('salvato'));
  }));
  $('elimina').addEventListener('click', () => {
    if (selezionata && !selezionata.solaLettura && window.confirm(t('confermaElimina')))
      prova(() => { libreria.elimina(selezionata.chiave); carica(); esito(t('eliminato')); });
  });
  $('avvia').addEventListener('click', () => prova(() => {
    if (selezionata && !sporco()) { AstroDemo.avvia(selezionata.testo); esito(''); }
  }));
  $('inserisci').addEventListener('click', () => prova(() => {
    AstroDemo.valida(editor.value);
    const token = /\/\/[^\n]*|'(?:\\['\\]|[^'\\])*'|"(?:\\["\\]|[^"\\])*"|[{}]/g;
    let m, fine;
    while ((m = token.exec(editor.value))) if (m[0] === '}') fine = m.index;
    editor.setRangeText('\n' + snippets[$('snippet').value], fine, fine, 'select');
    verifica(); editor.focus();
  }));
  $('esporta').addEventListener('click', () => prova(() => {
    const demo = AstroDemo.valida(editor.value);
    const url = URL.createObjectURL(new Blob([editor.value], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url;
    a.download = (demo.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'demo') + '.astrodemo';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }));
  $('importa').addEventListener('change', async () => {
    const file = $('importa').files[0];
    $('file-nome').textContent = file ? file.name : '';
    $('importa').value = '';
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error(t('troppoGrande'));
      const testo = await file.text();
      AstroDemo.valida(testo);
      if (abbandona()) bozza(testo);
    } catch (e) { esito(e.message); }
  });

  // --- Le opzioni della demo ---------------------------------------------
  // Schermo intero, vista pulita, registrazione (con audio) e gli elementi
  // del planetario. Le scrive AstroDemo.impostaOpzioni, che le ricorda; qui
  // si leggono e si disegnano.
  const schermo = $('opz-schermo'), pulita = $('opz-vista-pulita');
  const registra = $('opz-registra'), audio = $('opz-registra-audio');
  const musica = $('opz-musica-eclissi'), musicaTraccia = $('opz-musica-traccia');
  const personali = $('livelli-personali'), griglia = $('livelli');
  const TRACCIA_MUSICA_PREDEFINITA = 'Encelado1';

  function tracceMusicaDemo() {
    const elenco = Array.isArray(window.ASTRO_TRACCE_MUSICALI) ? window.ASTRO_TRACCE_MUSICALI : [];
    const valide = elenco.filter(t => t && typeof t.id === 'string' && t.id && typeof t.nome === 'string' && t.nome);
    return valide.length ? valide : [{ id: TRACCIA_MUSICA_PREDEFINITA, nome: 'Encelado' }];
  }
  function popolaTracceMusica() {
    if (!musicaTraccia) return;
    const tracce = tracceMusicaDemo();
    const scelta = AstroDemo.opzioni.musicaDemoTraccia || TRACCIA_MUSICA_PREDEFINITA;
    musicaTraccia.replaceChildren(...tracce.map(t => new Option(t.nome, t.id)));
    musicaTraccia.value = tracce.some(t => t.id === scelta) ? scelta : tracce[0].id;
  }
  // «Registra anche l'audio» è figlia del filmato: senza video è spenta e
  // non si può toccare, perché una registrazione del solo audio non esiste.
  // La preferenza salvata però non si perde: riaccendendo il filmato la
  // casella torna com'era.
  function disegnaDipendenze() {
    const o = AstroDemo.opzioni;
    audio.disabled = !registra.checked;
    audio.checked = registra.checked && o.registraAudio !== false;
    const gruppo = document.getElementById('demo-opz-registra-audio-gruppo');
    if (gruppo) gruppo.classList.toggle('spenta', audio.disabled);
    griglia.classList.toggle('spenta', !personali.checked);
    const narr = document.getElementById('imp-narrazione-attiva');
    const figli = document.getElementById('demo-narrazione-figli');
    if (narr && figli) figli.classList.toggle('spenta', !narr.checked);
    const sceltaMusica = document.getElementById('demo-opz-musica-eclissi-scelta');
    if (musicaTraccia && musica) musicaTraccia.disabled = !musica.checked;
    if (sceltaMusica && musica) sceltaMusica.classList.toggle('spenta', !musica.checked);
  }
  function disegnaOpzioni() {
    const o = AstroDemo.opzioni;
    schermo.checked = o.schermoIntero;
    pulita.checked = o.vistaPulita !== false;
    registra.checked = o.registra;
    if (musica) musica.checked = o.musicaDemo !== false;
    popolaTracceMusica();
    personali.checked = !!o.livelli;
    const livelli = AstroDemo.livelli();
    griglia.replaceChildren(...livelli.map(l => {
      const etichetta = document.createElement('label');
      etichetta.className = 'demo-spunta demo-livello';
      const casella = document.createElement('input');
      casella.type = 'checkbox';
      casella.setAttribute('role', 'switch');
      casella.dataset.livello = l.id;
      casella.checked = o.livelli && typeof o.livelli[l.id] === 'boolean' ? o.livelli[l.id] : l.acceso;
      casella.disabled = !o.livelli;
      const nome = document.createElement('span');
      nome.textContent = l.nome;
      etichetta.append(casella, nome);
      return etichetta;
    }));
    disegnaDipendenze();
  }
  function sceltaLivelli() {
    return Object.fromEntries(Array.from(griglia.querySelectorAll('input[data-livello]'))
      .map(c => [c.dataset.livello, c.checked]));
  }
  schermo.addEventListener('change', () => AstroDemo.impostaOpzioni({ schermoIntero: schermo.checked }));
  pulita.addEventListener('change', () => AstroDemo.impostaOpzioni({ vistaPulita: pulita.checked }));
  registra.addEventListener('change', () => {
    AstroDemo.impostaOpzioni({ registra: registra.checked });
    disegnaDipendenze();
  });
  audio.addEventListener('change', () => {
    if (!audio.disabled) AstroDemo.impostaOpzioni({ registraAudio: audio.checked });
  });
  if (musica) musica.addEventListener('change', () => {
    AstroDemo.impostaOpzioni({ musicaDemo: musica.checked });
    disegnaDipendenze();
  });
  if (musicaTraccia) musicaTraccia.addEventListener('change', () => {
    AstroDemo.impostaOpzioni({ musicaDemoTraccia: musicaTraccia.value });
  });
  const narrAttiva = document.getElementById('imp-narrazione-attiva');
  if (narrAttiva) narrAttiva.addEventListener('change', disegnaDipendenze);
  personali.addEventListener('change', () => {
    AstroDemo.impostaOpzioni({ livelli: personali.checked ? sceltaLivelli() : null });
    disegnaOpzioni();
  });
  griglia.addEventListener('change', () => {
    if (personali.checked) AstroDemo.impostaOpzioni({ livelli: sceltaLivelli() });
  });
  // I dati orbitali della ISS servono alla sua demo, e si scaricano in
  // anticipo: il tasto Avvia non può aspettare la rete.
  function preparaDemo() {
    disegnaOpzioni();
    if (typeof satPrecaricaTle === 'function') satPrecaricaTle();
  }

  // --- L'intro comune -----------------------------------------------------
  // Mostrarla, per quanto, con quale logo e quale titolo. Le preferenze le
  // tiene `AstroDemoIntro` (demo-intro.js), che ridisegna chi si è messo in
  // ascolto: qui ci sono solo i comandi e il riquadro dell'anteprima, che si
  // rifà a ogni cambio — logo, titolo, sua visibilità, lingua.
  const Intro = window.AstroDemoIntro;
  if (Intro) prova(() => {
    const attiva = $('intro-attiva'), figli = $('intro-figli');
    const durata = $('intro-durata'), durataValore = $('intro-durata-valore');
    const titolo = $('intro-titolo'), mostraTitolo = $('intro-mostra-titolo');
    const file = $('intro-logo-file'), miniatura = $('intro-logo-miniatura'), statoLogo = $('intro-logo-stato');
    const riquadro = $('intro-anteprima');
    const ti = (k, d) => astroI18n.t('demo.intro.' + k, d);
    let messaggioLogo = null;
    const secondi = v => astroI18n.numero(v, Number.isInteger(v) ? 0 : 1);
    function disegnaStatoLogo() {
      const l = Intro.statoLogo();
      miniatura.onerror = () => { if (miniatura.getAttribute('src') !== Intro.LOGO_PREDEFINITO) miniatura.src = Intro.LOGO_PREDEFINITO; };
      if (miniatura.getAttribute('src') !== l.url) miniatura.src = l.url;
      statoLogo.classList.toggle('demo-intro-stato-errore', !!(messaggioLogo && messaggioLogo.errore) || l.stato === 'guasto');
      if (messaggioLogo) { statoLogo.textContent = messaggioLogo.testo; return; }
      statoLogo.textContent = l.stato === 'caricamento' ? ti('logoCaricamento')
        : l.stato === 'guasto' ? ti('logoGuasto')
          : l.stato === 'nonSalvato' ? ti('logoNonSalvato', { nome: l.nome || '—' })
            : l.personale ? ti('logoPersonale', { nome: l.nome || '—' }) : ti('logoPredefinito');
      $('intro-logo-ripristina').disabled = !l.personale;
    }
    function disegnaIntro() {
      const o = Intro.impostazioni();
      attiva.checked = o.attiva;
      figli.classList.toggle('spenta', !o.attiva);
      durata.value = String(o.durataSec);
      durataValore.textContent = ti('secondi', { n: secondi(o.durataSec) });
      // Il campo non si riscrive sotto alle dita di chi sta scrivendo.
      if (document.activeElement !== titolo) titolo.value = Intro.titoloCorrente();
      titolo.placeholder = Intro.titoloPredefinito();
      mostraTitolo.checked = o.mostraTitolo;
      titolo.disabled = !o.mostraTitolo;
      $('intro-titolo-ripristina').disabled = o.titolo === null;
      disegnaStatoLogo();
      Intro.disegnaRiquadro(riquadro);
    }
    attiva.addEventListener('change', () => Intro.imposta({ attiva: attiva.checked }));
    durata.addEventListener('input', () => Intro.imposta({ durataSec: Number(durata.value) }));
    titolo.addEventListener('input', () => Intro.imposta({ titolo: titolo.value }));
    mostraTitolo.addEventListener('change', () => Intro.imposta({ mostraTitolo: mostraTitolo.checked }));
    $('intro-titolo-ripristina').addEventListener('click', () => {
      titolo.blur(); Intro.ripristinaTitolo();
    });
    file.addEventListener('change', async () => {
      const scelto = file.files && file.files[0];
      file.value = '';
      if (!scelto) return;
      messaggioLogo = { testo: ti('logoCaricamento') }; disegnaStatoLogo();
      try { await Intro.sostituisciLogo(scelto); messaggioLogo = null; }
      catch (e) { messaggioLogo = { testo: e.message, errore: true }; }
      disegnaIntro();
    });
    $('intro-logo-ripristina').addEventListener('click', async () => {
      messaggioLogo = null;
      await Intro.ripristinaLogo();
      disegnaIntro();
    });
    $('intro-prova').addEventListener('click', () => Intro.anteprima());
    Intro.alCambio(() => prova(disegnaIntro));
    disegnaIntro();
    Intro.pronto.then(() => prova(disegnaIntro));
  });

  window.addEventListener('beforeunload', e => { if (sporco()) { e.preventDefault(); e.returnValue = ''; } });
  // La chiama `mostraVista('demo')` ogni volta che la pagina torna davanti.
  window.demoPaginaPrepara = () => { verifica(); preparaDemo(); };
  astroI18n.alCambio(() => {
    prova(disegnaOpzioni);
    prova(() => {
      for (const d of libreria.elenco()) {
        const opzione = Array.from(elenco.options).find(o => o.value === d.chiave);
        if (opzione) opzione.textContent = testoOpzione(d);
      }
    });
    verifica();
  });
  prova(() => carica());
  prova(disegnaOpzioni);
})();
