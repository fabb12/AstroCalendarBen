/* Editor assistito: il testo passa sempre dal parser e dal registro dell'app. */
(function () {
  'use strict';
  const $ = id => document.getElementById('demo-' + id);
  const t = k => astroI18n.t('demo.' + k);
  const libreria = AstroDemo.libreria, editor = $('editor'), elenco = $('elenco');
  let selezionata = null, originale = '', nuova = false;
  const azioni = {
    timelapse: ['planetarium_view', 'timelapse { start: 18:00, end: 22:00 }'],
    highlight_object: ['planetarium_view', "highlight_object { name: 'Venus', scale: 5.0 }"],
    center_target: ['planetarium_view', "center_target { target: 'Venus' }"],
    orbit_object: ['solar_system_3d', "orbit_object { object: 'Earth-Moon', angle: 360, speed: slow }"],
    zoom_view: ['transition', 'zoom_view { type: geometric, final_target: solar_system_3d }']
  };
  const scena = (vista, azione) => '  scene ' + vista + ' {\n    duration: 10s;\n    action: ' + azione + ';\n  }\n';
  const snippets = {
    planetarium_view: scena(...azioni.center_target),
    transition: scena(...azioni.zoom_view),
    solar_system_3d: scena(...azioni.orbit_object),
    ...Object.fromEntries(Object.entries(azioni).map(([nome, dati]) => [nome, scena(...dati)]))
  };
  for (const nome of Object.keys(snippets)) $('snippet').add(new Option(nome, nome));
  const sporco = () => nuova || editor.value !== originale;
  const abbandona = () => !sporco() || window.confirm(t('scarta'));
  function esito(messaggio) { $('esito').textContent = messaggio; }
  function prova(fn) { try { return fn(); } catch (e) { esito(e.message); } }
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
    if (demo) {
      const bersagli = [...new Set(demo.scene.flatMap(s => s.azioni.flatMap(a =>
        [a.parametri.target, a.parametri.name, a.parametri.object].filter(Boolean))))];
      $('info').textContent = demo.id + ' · ' + demo.scene.length + ' ' + t('scene') +
        ' · ' + demo.scene.reduce((n, s) => n + s.durata, 0) / 1000 + ' s · ' +
        (solaLettura ? t('predefinita') : t('utente')) +
        (bersagli.length ? ' · ' + t('bersagli') + ': ' + bersagli.join(', ') : '');
    } else $('info').textContent = t('nonValido');
    return demo;
  }
  function carica(chiave) {
    const dati = libreria.elenco();
    selezionata = dati.find(d => d.chiave === chiave) || dati[0];
    elenco.replaceChildren();
    for (const d of dati) {
      let nome;
      try { nome = AstroDemoMotore.analizza(d.testo).id; } catch (_) { nome = d.chiave; }
      elenco.add(new Option(nome + ' · ' + t(d.solaLettura ? 'predefinita' : 'utente'), d.chiave));
    }
    elenco.value = selezionata.chiave;
    originale = editor.value = selezionata.testo; nuova = false; verifica();
  }
  function bozza(testo) {
    selezionata = null; nuova = true; originale = ''; elenco.value = '';
    editor.value = testo; verifica(); editor.focus(); esito(t('bozza'));
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
  $('duplica').addEventListener('click', () => bozza(editor.value));
  $('annulla').addEventListener('click', () => {
    if (abbandona()) prova(() => { carica(selezionata && selezionata.chiave); esito(''); });
  });
  $('salva').addEventListener('click', () => prova(() => {
    const chiave = libreria.salva(editor.value, selezionata && selezionata.chiave);
    carica(chiave); esito(t('salvato'));
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
    // Ignora parentesi dentro stringhe e commenti: trova la chiusura vera.
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
    const file = $('importa').files[0]; $('importa').value = '';
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error(t('troppoGrande'));
      const testo = await file.text();
      AstroDemo.valida(testo);
      if (abbandona()) bozza(testo);
    } catch (e) { esito(e.message); }
  });
  window.addEventListener('beforeunload', e => { if (sporco()) { e.preventDefault(); e.returnValue = ''; } });
  // Rivalida anche dopo un cambio di data/luogo e dopo il cambio lingua.
  const tabDemo = document.getElementById('imp-tab-btn-demo');
  tabDemo.addEventListener('click', verifica);
  tabDemo.addEventListener('focus', verifica);
  document.getElementById('btn-impostazioni').addEventListener('click', verifica);
  astroI18n.alCambio(() => {
    prova(() => {
      for (const d of libreria.elenco()) {
        const opzione = Array.from(elenco.options).find(o => o.value === d.chiave);
        if (!opzione) continue;
        let nome;
        try { nome = AstroDemoMotore.analizza(d.testo).id; } catch (_) { nome = d.chiave; }
        opzione.textContent = nome + ' · ' + t(d.solaLettura ? 'predefinita' : 'utente');
      }
    });
    verifica();
  });
  prova(() => carica());
})();
