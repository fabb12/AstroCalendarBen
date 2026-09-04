/* Internationalisation for the client-only application.
 *
 * Legacy views still emit Italian source copy, so the DOM translator below
 * keeps them working. New UI must use astroI18n.t(messageKey, values): keyed
 * messages make missing translations visible and let another locale be added
 * without changing application modules.
 */
(() => {
  'use strict';

  const STORAGE_LANGUAGE = 'astrocal_lingua';
  const STORAGE_COUNTRY = 'astrocal_paese_connessione';
  const COUNTRY_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  const localeDefinitions = new Map();
  const MESSAGE_KEYS = Object.freeze({
    languageSwitch: 'language.switch',
    appTitle: 'app.title'
  });

  function registerLocale(code, definition) {
    const normalised = String(code || '').trim().toLowerCase();
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(normalised)) {
      throw new TypeError(`Invalid locale code: ${code}`);
    }
    const previous = localeDefinitions.get(normalised) || {};
    localeDefinitions.set(normalised, {
      locale: definition.locale || previous.locale || normalised,
      manifest: definition.manifest || previous.manifest || 'manifest.json',
      messages: { ...(previous.messages || {}), ...(definition.messages || {}) },
      exact: definition.exact || previous.exact || new Map(),
      fragments: definition.fragments || previous.fragments || [],
      glossaryEntries: definition.glossaryEntries || previous.glossaryEntries || [],
      glossary: definition.glossary || previous.glossary || new Map()
    });
  }

  const exact = new Map(Object.entries({
    'AstroCalendario di Ben': "Ben's AstroCalendar",
    'Il cielo di stanotte, da casa tua': 'Tonight’s sky, from your home',
    'Prepariamo il planetario': 'Preparing the planetarium',
    'Siamo un modo per il cosmo di conoscere se stesso.': 'We are a way for the cosmos to know itself.',
    'Allineamento delle stelle in corso…': 'Aligning the stars…',
    'Stasera': 'Tonight', 'Mese': 'Month', 'Agenda': 'Agenda', 'Planetario': 'Planetarium',
    'Telescopio': 'Telescope', 'Diario': 'Logbook', 'Didattica': 'Learning lab',
    'Aggiungi evento': 'Add event', 'Galleria': 'Gallery', "Installa l'app": 'Install app',
    'Avvisami': 'Notify me', 'Impostazioni': 'Settings', 'Pulisci': 'Clear',
    'Con cosa guardi:': 'What are you observing with?', 'Stanotte': 'Tonight',
    'Imposta la tua posizione': 'Set your location', 'Che cielo avrai': 'Your sky conditions',
    'Aggiorna': 'Refresh', 'Cosa guardare': 'What to observe', 'Pianeti': 'Planets',
    'Stazioni spaziali': 'Space stations', 'Prossimi appuntamenti': 'Coming up',
    'Chiudi': 'Close', 'Salva': 'Save', 'Annulla': 'Cancel', 'Elimina': 'Delete',
    'Indietro': 'Back', 'Avanti': 'Next', 'Oggi': 'Today', 'Ora': 'Now',
    'Filtri': 'Filters', 'Tutti': 'All', 'Tutte': 'All', 'Cerca': 'Search',
    'Posizione': 'Location', 'La tua posizione': 'Your location', 'Data': 'Date',
    'Ora locale': 'Local time', 'Nome': 'Name', 'Titolo': 'Title', 'Note': 'Notes',
    'Dettagli': 'Details', 'Visibile': 'Visible', 'Non visibile': 'Not visible',
    'Nessun risultato': 'No results', 'Caricamento…': 'Loading…', 'Caricamento...': 'Loading...',
    'Sto scaricando le previsioni…': 'Downloading the forecast…',
    'Non riesco a giudicare le prossime notti.': 'Unable to assess the next few nights.',
    'Dimmi dove sono': 'Use my location', 'Vedila nel planetario': 'View it in the planetarium',
    'Galleria video': 'Video gallery', 'Scegli cartella': 'Choose folder',
    'Atlante delle costellazioni': 'Constellation atlas',
    'Tutte le costellazioni': 'All constellations',
    'Fasi Lunari': 'Moon phases', 'Eclissi': 'Eclipses', 'Stagioni': 'Seasons',
    'Sciami Meteorici': 'Meteor showers', 'Congiunzioni': 'Conjunctions',
    'Aurore': 'Auroras', 'Personali': 'Personal', 'Sole': 'Sun', 'Luna': 'Moon',
    'Mercurio': 'Mercury', 'Venere': 'Venus', 'Marte': 'Mars', 'Giove': 'Jupiter',
    'Saturno': 'Saturn', 'Urano': 'Uranus', 'Nettuno': 'Neptune', 'Terra': 'Earth',
    'Gennaio': 'January', 'Febbraio': 'February', 'Marzo': 'March', 'Aprile': 'April',
    'Maggio': 'May', 'Giugno': 'June', 'Luglio': 'July', 'Agosto': 'August',
    'Settembre': 'September', 'Ottobre': 'October', 'Novembre': 'November', 'Dicembre': 'December',
    'lunedì': 'Monday', 'martedì': 'Tuesday', 'mercoledì': 'Wednesday', 'giovedì': 'Thursday',
    'venerdì': 'Friday', 'sabato': 'Saturday', 'domenica': 'Sunday',
    'Lunedì': 'Monday', 'Martedì': 'Tuesday', 'Mercoledì': 'Wednesday', 'Giovedì': 'Thursday',
    'Venerdì': 'Friday', 'Sabato': 'Saturday', 'Domenica': 'Sunday'
  }));

  // Ordered, reusable fragments cover live sentences assembled by the modules.
  const fragments = [
    ['Cerca: eclissi, luna piena, perseidi, venere…', 'Search: eclipse, full moon, Perseids, Venus…'],
    ['Cerca: Orione, Crux, Matariki…', 'Search: Orion, Crux, Matariki…'],
    ['Le registrazioni salvate con AstroCalendario, disponibili anche senza rete', 'Recordings saved with AstroCalendar, also available offline'],
    ['Aprendo la galleria verrà creata la cartella “astrocalben”.', 'Opening the gallery will create the “astrocalben” folder.'],
    ['Tutte e ottantotto: la figura, il disegno, i nomi delle altre culture', 'All eighty-eight: their shapes, artwork, and names in other cultures'],
    ['Serve la posizione per sapere cosa hai sopra la testa.', 'Your location is needed to show what is overhead.'],
    ["Stanotte non c'è niente che salga abbastanza da qui.", 'Nothing rises high enough from here tonight.'],
    ['Finestra migliore:', 'Best window:'], ['verso le', 'around'], ['a occhio nudo', 'with the naked eye'],
    ['nel planetario', 'in the planetarium'], ['Aprilo', 'Open it'], ['con la mappa puntata su di lui', 'with the map pointing at it'],
    ['Scegli il luogo da cui stai osservando', 'Choose where you are observing from'],
    ['Cosa si vede stanotte da casa tua', 'What is visible tonight from your home'],
    ["Il planetario: punta il telefono verso il cielo e vedi cosa c'è", 'Planetarium: point your phone at the sky to see what is there'],
    ['Allineamento, puntamento e scaletta per il tuo telescopio', 'Alignment, aiming, and observing plan for your telescope'],
    ['Le tue osservazioni e i traguardi raggiunti', 'Your observations and achievements'],
    ['Laboratorio didattico e simulazioni interattive della meccanica celeste', 'Learning lab and interactive celestial-mechanics simulations'],
    ['Aggiungi un evento tuo', 'Add your own event'], ['Rivedi i video registrati', 'Review recorded videos'],
    ["Installa l'app sul dispositivo", 'Install the app on this device'], ['Avvisami prima di un evento', 'Notify me before an event'],
    ['Posizione, backup e calendario', 'Location, backup, and calendar'], ['Pulisci ricerca', 'Clear search'],
    ['Chiudi la finestra', 'Close the window'], ['Chiudi la galleria', 'Close the gallery'],
    ['Cerca una costellazione', 'Search for a constellation'],
    ['prossime notti', 'next few nights'], ['prossimi giorni', 'next few days'], ['prossimi eventi', 'upcoming events'],
    ['luna piena', 'full moon'], ['luna nuova', 'new moon'], ['primo quarto', 'first quarter'], ['ultimo quarto', 'last quarter'],
    ['sorge alle', 'rises at'], ['tramonta alle', 'sets at'], ['culmina alle', 'culminates at'],
    ['altezza', 'altitude'], ['azimut', 'azimuth'], ['magnitudine', 'magnitude'], ['distanza', 'distance'],
    ['nuvolosità', 'cloud cover'], ['Nuvole', 'Clouds'], ['Vento', 'Wind'], ['Umidità', 'Humidity'],
    ['Previsioni', 'Forecast'], ['Cielo sereno', 'Clear sky'], ['Non disponibile', 'Unavailable'],
    ['Nessun evento', 'No events'], ['Nessuna osservazione', 'No observations'], ['nessun risultato', 'no results'],
    ['Aggiungi', 'Add'], ['Modifica', 'Edit'], ['Conferma', 'Confirm'], ['Continua', 'Continue'],
    ['Attiva', 'Enable'], ['Disattiva', 'Disable'], ['Permetti', 'Allow'], ['Riprova', 'Try again'],
    ['giorni', 'days'], ['giorno', 'day'], ['ore', 'hours'], ['ora', 'hour'], ['minuti', 'minutes'], ['minuto', 'minute'],
    ['anni', 'years'], ['anno', 'year'], ['gradi', 'degrees'], ['da qui', 'from here'], ['questa notte', 'tonight'],
    ['Ottima', 'Excellent'], ['Buona', 'Good'], ['Discreta', 'Fair'], ['Scarsa', 'Poor'],
    ['pianeta', 'planet'], ['galassia', 'galaxy'], ['nebulosa', 'nebula'], ['asteroide', 'asteroid'], ['cometa', 'comet'],
    ['ammasso aperto', 'open cluster'], ['ammasso globulare', 'globular cluster'], ['stella doppia', 'double star']
  ].sort((a, b) => b[0].length - a[0].length);

  // Short UI copy is often assembled at runtime (including notes, captions and
  // explanations).  These expressions are deliberately applied after the
  // sentence-level catalogue above, so newly composed copy is translated too.
  const glossaryEntries = Object.entries({
    'Perché succede': 'Why it happens', 'Dove e quando vederla': 'Where and when to see it',
    'Trova il posto migliore': 'Find the best place', "Mappa dell'ombra": 'Shadow map',
    'Vedi nel planetario': 'View in the planetarium', 'Leggi ad alta voce': 'Read aloud',
    'A tutto schermo': 'Full screen', 'Torna ad adesso': 'Return to now',
    'Posizione attuale': 'Current location', 'Aggiorna adesso': 'Refresh now',
    'Aggiornamento automatico': 'Automatic refresh', 'Mostra in cielo': 'Show in the sky',
    'Segui il telefono': 'Follow the phone', 'Torna al planetario': 'Back to the planetarium',
    'Distanze vere': 'True distances', 'Misure vere': 'True sizes',
    'Sistema Solare': 'Solar System', 'Via Lattea': 'Milky Way', 'profondo cielo': 'deep sky',
    'stella cadente': 'shooting star', 'stelle cadenti': 'shooting stars',
    'costellazione': 'constellation', 'costellazioni': 'constellations',
    'eclissi solare': 'solar eclipse', 'eclissi lunare': 'lunar eclipse', 'eclissi': 'eclipse',
    'fase lunare': 'moon phase', 'fasi lunari': 'moon phases',
    'equinozio': 'equinox', 'solstizio': 'solstice', 'orbita': 'orbit', 'ombra': 'shadow',
    'osservazione': 'observation', 'osservazioni': 'observations', 'evento': 'event', 'eventi': 'events',
    'spiegazione': 'explanation', 'descrizione': 'description', 'suggerimento': 'tip',
    'Direzione': 'Direction', 'Schermo': 'Display', 'Oggetti': 'Objects', 'Cielo': 'Sky',
    'Paesaggio': 'Landscape', 'Bussola': 'Compass', 'Giorno': 'Day', 'Ore': 'Hours',
    'Secondi': 'Seconds', 'Inizio': 'Start', 'Fine': 'End', 'Massimo': 'Maximum',
    'Pausa': 'Pause', 'Avvia': 'Start', 'Ascolta': 'Listen', 'Guarda': 'Look',
    'Condividi': 'Share', 'Rifai': 'Redo', 'Esci': 'Exit', 'Incolla': 'Paste',
    'Compresse': 'Compressed', 'Ingrandite': 'Enlarged', 'Reali': 'Real',
    'Allontanati': 'Zoom out', 'Avvicinati': 'Zoom in', 'Ingrandisci': 'Zoom in', 'Riduci': 'Zoom out',
    'Latitudine': 'Latitude', 'Longitudine': 'Longitude', 'Altitudine': 'Altitude',
    'Nord': 'North', 'Sud': 'South', 'Est': 'East', 'Ovest': 'West',
    'sera': 'evening', 'mattino': 'morning', 'notte': 'night', 'tempo reale': 'real time',
    'tempo': 'time', 'velocità': 'speed', 'distanze': 'distances', 'dimensioni': 'sizes',
    'luminosità': 'brightness', 'visibilità': 'visibility', 'temperatura': 'temperature',
    'copertura nuvolosa': 'cloud cover', 'orizzonte': 'horizon', 'rilievo': 'terrain',
    'città': 'city', 'paese': 'town', 'coordinate': 'coordinates', 'mappa': 'map',
    'fotocamera': 'camera', 'reticolo': 'grid', 'satelliti': 'satellites', 'aerei': 'aircraft',
    'stelle': 'stars', 'astro': 'celestial object', 'pianeti': 'planets',
    'punto scelto': 'selected point', 'oggetto scelto': 'selected object',
    'data scritta': 'entered date', 'momento': 'moment', 'istante': 'instant',
    'apri': 'open', 'chiudi': 'close', 'mostra': 'show', 'nascondi': 'hide',
    'scegli': 'choose', 'cerca': 'search', 'trova': 'find', 'scarica': 'download',
    'registra': 'record', 'ferma': 'stop', 'rallenta': 'slow down', 'accelera': 'speed up',
    'attiva': 'enable', 'disattiva': 'disable', 'aggiungi': 'add', 'modifica': 'edit',
    'salva': 'save', 'elimina': 'delete', 'indietro': 'back', 'avanti': 'forward',
    'selezionato': 'selected', 'disponibile': 'available', 'necessaria': 'required',
    'necessario': 'required', 'possibile': 'possible', 'automatico': 'automatic',
    'attuale': 'current', 'prossima': 'next', 'prossimo': 'next', 'precedente': 'previous',
    'qui': 'here', 'adesso': 'now', 'oggi': 'today', 'stanotte': 'tonight',
    'domani': 'tomorrow', 'durante': 'during', 'prima': 'before', 'dopo': 'after',
    'sopra': 'above', 'sotto': 'below', 'vicino': 'near', 'lontano': 'far',
    'molto': 'very', 'circa': 'about', 'fino a': 'up to', 'ogni': 'every',
    'nessuno': 'none', 'nessuna': 'none', 'tutto': 'all', 'tutti': 'all',
    'tocca': 'tap', 'premi': 'press', 'trascina': 'drag', 'scrivi': 'enter',
    'puoi': 'you can', 'serve': 'is needed', 'usa': 'use', 'scegliere': 'choose',
    'con': 'with', 'senza': 'without', 'per': 'for', 'dal': 'from', 'dalla': 'from',
    'dove': 'where', 'quando': 'when', 'come': 'how', 'perché': 'why'
  }).sort((a, b) => b[0].length - a[0].length);
  const glossary = new Map(glossaryEntries);

  registerLocale('it', {
    locale: 'it-IT',
    manifest: 'manifest.json',
    messages: {
      [MESSAGE_KEYS.languageSwitch]: 'Passa a {language}',
      [MESSAGE_KEYS.appTitle]: 'AstroCalendario di Ben'
    }
  });
  registerLocale('en', {
    locale: 'en-GB',
    manifest: 'manifest-en.json',
    messages: {
      [MESSAGE_KEYS.languageSwitch]: 'Switch to {language}',
      [MESSAGE_KEYS.appTitle]: "Ben's AstroCalendar"
    },
    exact, fragments, glossaryEntries, glossary
  });

  let language = 'it';
  let observer;
  let applying = false;
  const originals = new WeakMap();
  const translated = new WeakMap();
  const attributeState = new WeakMap();
  const TRANSLATABLE_ATTRIBUTES = [
    'title', 'placeholder', 'aria-label', 'data-tooltip', 'data-label',
    'data-i18n', 'data-i18n-title', 'data-i18n-placeholder', 'data-i18n-aria-label'
  ];
  const KEYED_ATTRIBUTES = Object.freeze({
    'data-i18n-title': 'title',
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-aria-label': 'aria-label'
  });

  function translateText(value) {
    const definition = localeDefinitions.get(language);
    if (!definition || language === 'it') return value;
    const paddingStart = value.match(/^\s*/)[0];
    const paddingEnd = value.match(/\s*$/)[0];
    let text = value.slice(paddingStart.length, value.length - paddingEnd.length);
    if (!text) return value;
    const lookup = text.replace(/\u00ad/g, '');
    if (definition.exact.has(lookup)) return paddingStart + definition.exact.get(lookup) + paddingEnd;
    if (definition.glossary.has(lookup)) return paddingStart + definition.glossary.get(lookup) + paddingEnd;
    for (const [source, translatedText] of definition.fragments) text = replacePhrase(text, source, translatedText);
    for (const [source, translatedText] of definition.glossaryEntries) text = replacePhrase(text, source, translatedText);
    return paddingStart + text + paddingEnd;
  }

  function message(key, values = {}) {
    const definition = localeDefinitions.get(language) || localeDefinitions.get('it');
    const template = definition.messages[key];
    if (template == null) {
      console.warn(`[i18n] Missing message: ${key} (${language})`);
      return key;
    }
    return template.replace(/\{([\w.-]+)\}/g, (token, name) => (
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token
    ));
  }

  function replacePhrase(text, source, translation) {
    const expression = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(source)})(?=$|[^\\p{L}])`, 'giu');
    return text.replace(expression, (_, prefix, match) => prefix + matchCase(translation, match));
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function matchCase(translation, source) {
    if (source === source.toUpperCase()) return translation.toUpperCase();
    if (/^\p{Lu}/u.test(source)) return translation[0].toUpperCase() + translation.slice(1);
    return translation;
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.nodeValue.trim() || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement?.tagName || '')) return;
      const current = node.nodeValue;
      const previouslyTranslated = translated.get(node);
      if (language === 'en') {
        if (current !== previouslyTranslated) originals.set(node, current);
        const result = translateText(originals.get(node) ?? current);
        if (result !== current) { node.nodeValue = result; translated.set(node, result); }
      } else if (originals.has(node) && current === previouslyTranslated) {
        node.nodeValue = originals.get(node);
        translated.delete(node);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.hasAttribute('data-i18n')) {
      const result = message(node.getAttribute('data-i18n'));
      if (node.textContent !== result) node.textContent = result;
      return;
    }
    for (const [keyAttribute, targetAttribute] of Object.entries(KEYED_ATTRIBUTES)) {
      if (!node.hasAttribute(keyAttribute)) continue;
      const result = message(node.getAttribute(keyAttribute));
      if (node.getAttribute(targetAttribute) !== result) node.setAttribute(targetAttribute, result);
    }
    const states = attributeState.get(node) || {};
    for (const attr of TRANSLATABLE_ATTRIBUTES) {
      if (!node.hasAttribute(attr)) continue;
      const current = node.getAttribute(attr);
      const state = states[attr] || {};
      if (language === 'en') {
        if (current !== state.translated) state.original = current;
        state.translated = translateText(state.original ?? current);
        if (current !== state.translated) node.setAttribute(attr, state.translated);
      } else if (state.original != null && current === state.translated) {
        node.setAttribute(attr, state.original);
        delete states[attr];
      }
    }
    attributeState.set(node, states);
    for (const child of node.childNodes) translateNode(child);
  }

  function refreshButton() {
    const button = document.getElementById('btn-lingua');
    if (!button) return;
    const codes = [...localeDefinitions.keys()];
    const next = codes[(codes.indexOf(language) + 1) % codes.length];
    const displayNames = typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames([localeDefinitions.get(language).locale], { type: 'language' })
      : null;
    button.textContent = next.toUpperCase();
    button.title = message(MESSAGE_KEYS.languageSwitch, {
      language: displayNames?.of(next) || next.toUpperCase()
    });
    button.setAttribute('aria-label', button.title);
    button.dataset.nextLanguage = next;
  }

  function setLanguage(next, { persist = false } = {}) {
    const requested = String(next || '').toLowerCase();
    language = localeDefinitions.has(requested) ? requested : 'it';
    const definition = localeDefinitions.get(language);
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    document.title = message(MESSAGE_KEYS.appTitle);
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = definition.manifest;
    applying = true;
    translateNode(document.body);
    applying = false;
    refreshButton();
    if (persist) localStorage.setItem(STORAGE_LANGUAGE, language);
    document.dispatchEvent(new CustomEvent('astrocal:languagechange', { detail: { language } }));
  }

  function connectionLooksItalian() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return /^Europe\/(Rome|San_Marino|Vatican)$/.test(zone) || (navigator.languages || []).some(code => /^it(?:-|$)/i.test(code));
  }

  async function fetchCountry() {
    const cached = JSON.parse(localStorage.getItem(STORAGE_COUNTRY) || 'null');
    if (cached?.code && Date.now() - cached.savedAt < COUNTRY_MAX_AGE) return cached.code;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      // Country is inferred from the public IP, not GPS: no location permission
      // is requested. ipwho.is supports browser CORS and HTTPS.
      const response = await fetch('https://ipwho.is/', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success || !data.country_code) throw new Error('Country unavailable');
      const code = String(data.country_code).toUpperCase();
      localStorage.setItem(STORAGE_COUNTRY, JSON.stringify({ code, savedAt: Date.now() }));
      return code;
    } finally { clearTimeout(timer); }
  }

  function installButton() {
    const actions = document.querySelector('.azioni-testata');
    if (!actions || document.getElementById('btn-lingua')) return;
    const button = document.createElement('button');
    button.id = 'btn-lingua';
    button.type = 'button';
    button.className = 'selettore-lingua';
    button.addEventListener('click', () => setLanguage(button.dataset.nextLanguage, { persist: true }));
    actions.appendChild(button);
    refreshButton();
  }

  function addLocale(code, definition) {
    registerLocale(code, definition);
    refreshButton();
  }

  async function initialise() {
    installButton();
    observer = new MutationObserver(records => {
      if (applying) return;
      applying = true;
      for (const record of records) {
        if (record.type === 'characterData') translateNode(record.target);
        if (record.type === 'attributes') translateNode(record.target);
        for (const node of record.addedNodes) translateNode(node);
      }
      applying = false;
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    });

    const preference = localStorage.getItem(STORAGE_LANGUAGE);
    if (localeDefinitions.has(preference)) return setLanguage(preference);
    try {
      const country = await fetchCountry();
      setLanguage(country === 'IT' ? 'it' : 'en');
    } catch (error) {
      console.info('Country detection unavailable; using browser locale.', error.message);
      setLanguage(connectionLooksItalian() ? 'it' : 'en');
    }
  }

  window.astroI18n = {
    setLanguage,
    registerLocale: addLocale,
    t: message,
    getLanguage: () => language,
    getLocale: () => localeDefinitions.get(language).locale,
    getSupportedLanguages: () => [...localeDefinitions.keys()],
    translate: translateText
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
