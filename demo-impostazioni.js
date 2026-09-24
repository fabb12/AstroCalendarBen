/* Libreria e editor assistito: il percorso normale resta semplice, il DSL è avanzato. */
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
    satellite_pass: ['planetarium_view', 'satellite_pass { satellite: iss, before: 1, after: 1 }']
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
  // Schermo intero, registrazione e gli elementi del planetario. Le scrive
  // `AstroDemo.impostaOpzioni`, che le ricorda; qui si leggono e si
  // disegnano. Gli elementi si chiedono ad `AstroDemo.livelli()`, che li
  // ricava dagli interruttori veri del pannello Visualizzazione — nome
  // compreso, quindi nella lingua dell'app.
  const schermo = $('opz-schermo'), registra = $('opz-registra');
  const personali = $('livelli-personali'), griglia = $('livelli');
  function disegnaOpzioni() {
    const o = AstroDemo.opzioni;
    schermo.checked = o.schermoIntero;
    registra.checked = o.registra;
    personali.checked = !!o.livelli;
    const livelli = AstroDemo.livelli();
    griglia.replaceChildren(...livelli.map(l => {
      const etichetta = document.createElement('label');
      etichetta.className = 'demo-spunta demo-livello';
      const casella = document.createElement('input');
      casella.type = 'checkbox';
      casella.dataset.livello = l.id;
      casella.checked = o.livelli && typeof o.livelli[l.id] === 'boolean' ? o.livelli[l.id] : l.acceso;
      casella.disabled = !o.livelli;
      const nome = document.createElement('span');
      nome.textContent = l.nome;
      etichetta.append(casella, nome);
      return etichetta;
    }));
  }
  function sceltaLivelli() {
    return Object.fromEntries(Array.from(griglia.querySelectorAll('input[data-livello]'))
      .map(c => [c.dataset.livello, c.checked]));
  }
  schermo.addEventListener('change', () => AstroDemo.impostaOpzioni({ schermoIntero: schermo.checked }));
  registra.addEventListener('change', () => AstroDemo.impostaOpzioni({ registra: registra.checked }));
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

  window.addEventListener('beforeunload', e => { if (sporco()) { e.preventDefault(); e.returnValue = ''; } });
  const tabDemo = document.getElementById('imp-tab-btn-demo');
  tabDemo.addEventListener('click', () => { verifica(); preparaDemo(); });
  tabDemo.addEventListener('focus', verifica);
  document.getElementById('btn-impostazioni').addEventListener('click', () => { verifica(); preparaDemo(); });
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
