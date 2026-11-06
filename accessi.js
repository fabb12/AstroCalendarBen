/* Gli accessi: gli account dell'app, su Supabase (`acc`).
 * =======================================================
 *
 * Il giro è quello di ogni servizio con iscrizione approvata:
 *
 *   1. chi arriva **crea un account** con nome, email e password;
 *   2. l'account nasce **in attesa**: si entra, ma si vede solo la pagina
 *      «la tua iscrizione aspetta l'approvazione»;
 *   3. l'**amministratore** apre «Gestisci utenti» e approva, rifiuta,
 *      sospende, elimina, nomina altri amministratori e sceglie, utente per
 *      utente, quali **sezioni** dell'app vede (Stasera, Calendario,
 *      Planetario, Telescopio, Didattica, Demo).
 *
 * Perché Supabase. La prima versione (v532) teneva gli account nel browser:
 * l'amministratore non poteva vedere chi si iscriveva da un altro telefono,
 * quindi l'approvazione non era possibile. Qui login, password e sessioni
 * sono di Supabase Auth; stato, ruolo e sezioni stanno nella tabella
 * `profili`, protetta da regole sul server (`supabase/accessi.sql`): un utente
 * legge solo il suo profilo e non lo può cambiare, quindi non si approva da
 * solo. Chi è amministratore lo decide l'email scritta nello script SQL, non
 * il codice dell'app, che è pubblico.
 *
 * Cosa resta dalla parte del browser: nascondere le sezioni non permesse è
 * un controllo dell'interfaccia (l'app non ha dati sul server da proteggere:
 * calcola tutto qui). È il livello giusto per «chi vede cosa», non per un
 * segreto.
 *
 * Senza rete: la sessione di Supabase vive in `localStorage` e il profilo
 * dell'ultimo accesso si tiene in `astrocal_profilo_v1`. Se all'avvio il
 * server non risponde, vale il profilo salvato (solo se approvato, solo per
 * lo stesso utente): l'app resta una PWA che si apre in un campo buio.
 *
 * Caricamento: dopo `i18n.js` e `accessi-config.js`, prima di `app.js`. La
 * classe `accessi-bloccato` nasconde subito la pagina; il velo si costruisce a
 * `DOMContentLoaded`, quando `icona()` di `app.js` esiste. Sotto
 * `navigator.webdriver` (le altre prove) il velo non si mostra: lo si apre
 * con `astroAccessi.mostra({ forza: true })`. Senza `accessi-config.js`
 * compilato l'app resta aperta, come prima degli account.
 */

(function () {
  'use strict';

  // ==== 1. Costanti =========================================================
  const CONFIG = window.ASTROCAL_ACCESSI || {};
  const CONFIGURATO = !!(CONFIG.url && CONFIG.chiave);
  const CHIAVE_PROFILO = 'astrocal_profilo_v1';
  const CHIAVE_SESSIONE_SB = 'astrocal-supabase-auth';
  const PASSWORD_MINIMA = 8;
  const ATTESA_RICONTROLLO = 30000;
  // Le sezioni dell'app, nell'ordine del menu. `btn` è la voce del menu.
  const SEZIONI = [
    { id: 'stasera',    btn: 'btn-vista-stasera' },
    { id: 'calendario', btn: 'btn-vista-gruppo-calendario' },
    { id: 'cielo',      btn: 'btn-vista-skymap' },
    { id: 'telescopio', btn: 'btn-vista-telescopio' },
    { id: 'didattica',  btn: 'btn-vista-didattica' },
    { id: 'demo',       btn: 'btn-vista-demo' }
  ];
  const VISTA_SEZIONE = { agenda: 'calendario', diario: 'calendario' };

  // I conti della v532 (account nel browser) non valgono più: si tolgono
  try { localStorage.removeItem('astrocal_account_v1'); localStorage.removeItem('astrocal_sessione_v1'); sessionStorage.removeItem('astrocal_sessione_v1'); } catch (_) { /* niente */ }

  const acc = {
    client: null,
    utente: null,     // l'utente di Supabase Auth
    profilo: null,    // la riga di `profili`
    inAttesa: 0,      // per l'amministratore: quanti aspettano
    ascoltatori: new Set(),
    timerAttesa: 0
  };

  const t = (chiave, valori) =>
    (typeof astroI18n === 'object' && astroI18n && typeof astroI18n.t === 'function')
      ? astroI18n.t(chiave, valori) : chiave;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (nome, d = 18) => (typeof icona === 'function' ? icona(nome, d) : '');
  const locale = () => (typeof astroI18n === 'object' && astroI18n.locale && astroI18n.locale()) || undefined;
  const dataBreve = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }); };
  const iniziali = p => {
    const base = (p && (p.nome || p.email) || '?').trim();
    const parti = base.split(/[\s@._-]+/).filter(Boolean);
    return ((parti[0] || '?')[0] + (parti[1] ? parti[1][0] : '')).toUpperCase();
  };
  const eAdmin = () => !!(acc.profilo && acc.profilo.ruolo === 'admin' && acc.profilo.stato === 'approvato');

  // Se la pagina parte con gli account, la si nasconde subito: il velo
  // arriva a DOMContentLoaded, ma il planetario non deve lampeggiare prima.
  const VELO_ATTIVO = CONFIGURATO && (!navigator.webdriver || !!CONFIG.forza);
  if (VELO_ATTIVO) document.documentElement.classList.add('accessi-bloccato');

  // ==== 2. Il client e il profilo ==========================================
  function client() {
    if (acc.client) return acc.client;
    if (!CONFIGURATO || !window.supabase || typeof window.supabase.createClient !== 'function') return null;
    acc.client = window.supabase.createClient(CONFIG.url, CONFIG.chiave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: CHIAVE_SESSIONE_SB }
    });
    return acc.client;
  }

  function profiloSalvato(id) {
    try {
      const p = JSON.parse(localStorage.getItem(CHIAVE_PROFILO) || 'null');
      return p && p.id === id ? p : null;
    } catch (_) { return null; }
  }
  function salvaProfilo(p) {
    try { if (p) localStorage.setItem(CHIAVE_PROFILO, JSON.stringify(p)); else localStorage.removeItem(CHIAVE_PROFILO); } catch (_) { /* niente */ }
  }

  // Legge il profilo dal server; senza rete, quello salvato.
  async function caricaProfilo() {
    const c = client();
    if (!c || !acc.utente) return null;
    const { data, error } = await c.from('profili').select('*').eq('id', acc.utente.id).maybeSingle();
    if (error) {
      const salvato = profiloSalvato(acc.utente.id);
      if (salvato) return salvato;
      throw error;
    }
    salvaProfilo(data);
    return data;
  }

  // Traduce gli errori di Supabase nelle frasi dell'app.
  function chiaveErrore(errore) {
    const m = String((errore && (errore.message || errore.error_description)) || errore || '').toLowerCase();
    const codice = errore && errore.code;
    if (codice === 'invalid_credentials' || m.includes('invalid login')) return 'accessi.err.credenziali';
    if (codice === 'email_not_confirmed' || m.includes('not confirmed')) return 'accessi.err.non-confermata';
    if (codice === 'user_already_exists' || m.includes('already registered') || m.includes('already exists')) return 'accessi.err.esiste';
    if (codice === 'weak_password' || m.includes('password should')) return 'accessi.err.password-debole';
    if (codice === 'over_request_rate_limit' || codice === 'over_email_send_rate_limit' || m.includes('rate limit') || m.includes('too many')) return 'accessi.err.troppi';
    if (codice === 'same_password' || m.includes('should be different')) return 'accessi.err.stessa-password';
    if (m.includes('fetch') || m.includes('network') || m.includes('failed to')) return 'accessi.err.rete';
    if (m.includes('email') && m.includes('invalid')) return 'accessi.err.email';
    return 'accessi.err.generico';
  }

  // ==== 3. Le regole dei campi =============================================
  const EMAIL_VALIDA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function controllaPassword(p) {
    p = String(p || '');
    if (p.length < PASSWORD_MINIMA) return 'accessi.err.password-corta';
    if (!/[A-Za-zÀ-ÿ]/.test(p) || !/[0-9]/.test(p)) return 'accessi.err.password-debole';
    return null;
  }
  // Da 0 a 4: lunghezza, maiuscole e minuscole, cifre, simboli
  function forzaPassword(p) {
    p = String(p || '');
    if (!p) return 0;
    let punti = 0;
    if (p.length >= PASSWORD_MINIMA) punti++;
    if (p.length >= 12) punti++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) punti++;
    if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) punti++;
    else if (/[0-9]/.test(p) && punti < 4) punti += 0.5;
    return Math.max(1, Math.min(4, Math.floor(punti)));
  }

  // ==== 4. Le azioni dell'utente ===========================================
  async function registra({ nome, email, password, conferma }) {
    const c = client();
    if (!c) return { errore: 'accessi.err.servizio' };
    nome = String(nome || '').trim();
    email = String(email || '').trim().toLowerCase();
    if (nome.length < 2 || nome.length > 60) return { errore: 'accessi.err.nome' };
    if (!EMAIL_VALIDA.test(email)) return { errore: 'accessi.err.email' };
    const errP = controllaPassword(password);
    if (errP) return { errore: errP };
    if (password !== conferma) return { errore: 'accessi.err.conferma' };
    const { data, error } = await c.auth.signUp({
      email, password,
      options: { data: { nome }, emailRedirectTo: indirizzoRitorno() }
    });
    if (error) return { errore: chiaveErrore(error) };
    // Con la conferma email accesa Supabase non apre la sessione; e se l'email
    // è già iscritta risponde un utente senza identità (per non dirlo a chi
    // prova gli indirizzi): lì diciamo comunque di guardare la posta.
    if (!data.session) return { ok: true, controllaPosta: true };
    return { ok: true };
  }

  async function accedi({ email, password }) {
    const c = client();
    if (!c) return { errore: 'accessi.err.servizio' };
    email = String(email || '').trim().toLowerCase();
    if (!EMAIL_VALIDA.test(email)) return { errore: 'accessi.err.email' };
    if (!password) return { errore: 'accessi.err.credenziali' };
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) return { errore: chiaveErrore(error) };
    return { ok: true };
  }

  async function recupera(email) {
    const c = client();
    if (!c) return { errore: 'accessi.err.servizio' };
    email = String(email || '').trim().toLowerCase();
    if (!EMAIL_VALIDA.test(email)) return { errore: 'accessi.err.email' };
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: indirizzoRitorno() });
    if (error) return { errore: chiaveErrore(error) };
    return { ok: true };
  }

  async function nuovaPassword(password, conferma) {
    const c = client();
    if (!c) return { errore: 'accessi.err.servizio' };
    const errP = controllaPassword(password);
    if (errP) return { errore: errP };
    if (password !== conferma) return { errore: 'accessi.err.conferma' };
    const { error } = await c.auth.updateUser({ password });
    if (error) return { errore: chiaveErrore(error) };
    return { ok: true };
  }

  async function esci() {
    const c = client();
    clearTimeout(acc.timerAttesa);
    salvaProfilo(null);
    if (c) { try { await c.auth.signOut(); } catch (_) { /* la sessione locale cade comunque */ } }
    acc.utente = null; acc.profilo = null;
    applica();
  }

  function indirizzoRitorno() {
    return location.origin + location.pathname;
  }

  // ==== 5. Le azioni dell'amministratore ===================================
  async function elencoUtenti() {
    const c = client();
    if (!c || !eAdmin()) return { errore: 'accessi.err.permesso' };
    const { data, error } = await c.from('profili').select('*').order('creato', { ascending: false });
    if (error) return { errore: chiaveErrore(error) };
    acc.inAttesa = (data || []).filter(p => p.stato === 'in_attesa').length;
    aggiornaTasto();
    return { ok: true, utenti: data || [] };
  }

  async function aggiornaUtente(id, cambi) {
    const c = client();
    if (!c || !eAdmin()) return { errore: 'accessi.err.permesso' };
    if (id === acc.profilo.id && (('stato' in cambi && cambi.stato !== 'approvato') || ('ruolo' in cambi && cambi.ruolo !== 'admin'))) {
      return { errore: 'accessi.err.se-stesso' };
    }
    const riga = Object.assign({}, cambi);
    if ('stato' in cambi) { riga.deciso_il = new Date().toISOString(); riga.deciso_da = acc.profilo.id; }
    const { data, error } = await c.from('profili').update(riga).eq('id', id).select().maybeSingle();
    if (error) return { errore: chiaveErrore(error) };
    if (!data) return { errore: 'accessi.err.permesso' };
    return { ok: true, profilo: data };
  }

  async function eliminaUtente(id) {
    const c = client();
    if (!c || !eAdmin()) return { errore: 'accessi.err.permesso' };
    if (id === acc.profilo.id) return { errore: 'accessi.err.se-stesso' };
    const { error } = await c.rpc('elimina_account', { utente: id });
    if (error) return { errore: chiaveErrore(error) };
    return { ok: true };
  }

  // ==== 6. Le sezioni permesse =============================================
  // Chiamata da `mostraVista` (app.js): una vista che l'utente non può vedere
  // non si apre. Durante una demo sì: il racconto passa per le pagine vere.
  function sezioniPermesse() {
    if (!VELO_ATTIVO || !acc.profilo) return SEZIONI.map(s => s.id);
    if (eAdmin()) return SEZIONI.map(s => s.id);
    return Array.isArray(acc.profilo.sezioni) ? acc.profilo.sezioni : [];
  }
  function vistaPermessa(nomeVista) {
    if (!VELO_ATTIVO) return true;
    if (typeof AstroDemo === 'object' && AstroDemo && AstroDemo.inCorso) return true;
    const sezione = VISTA_SEZIONE[nomeVista] || nomeVista;
    return sezioniPermesse().includes(sezione);
  }
  function primaVistaPermessa() {
    const permesse = sezioniPermesse();
    const s = SEZIONI.find(x => permesse.includes(x.id));
    return s ? s.id : null;
  }
  function applicaSezioni() {
    const permesse = sezioniPermesse();
    for (const s of SEZIONI) {
      const b = document.getElementById(s.btn);
      // non una classe: `mostraVista` riscrive `className` dei tasti del menu
      if (!b) continue;
      if (permesse.includes(s.id)) b.style.removeProperty('display');
      else b.style.setProperty('display', 'none', 'important');
    }
    if (typeof vistaAttuale === 'string' && typeof mostraVista === 'function' && !vistaPermessa(vistaAttuale)) {
      const prima = primaVistaPermessa();
      if (prima) { try { mostraVista(prima); } catch (e) { console.error('[accessi]', e); } }
    }
  }
  window.accessiVistaPermessa = vistaPermessa;
  window.accessiPrimaVistaPermessa = primaVistaPermessa;

  // ==== 7. Lo stato decide cosa si vede ====================================
  // Senza utente → il velo d'accesso. Con un utente non approvato → la pagina
  // dello stato (in attesa, rifiutato, sospeso). Approvato → l'app.
  function applica() {
    clearTimeout(acc.timerAttesa);
    const p = acc.profilo;
    if (!VELO_ATTIVO) { aggiornaTasto(); return; }
    if (!acc.utente) { mostraVelo('accedi'); }
    else if (!p) { mostraVelo('stato', { stato: 'senza-profilo' }); }
    else if (p.stato !== 'approvato') {
      mostraVelo('stato', { stato: p.stato });
      if (p.stato === 'in_attesa') acc.timerAttesa = setTimeout(ricontrolla, ATTESA_RICONTROLLO);
    } else if (!eAdmin() && !primaVistaPermessa()) {
      mostraVelo('stato', { stato: 'nessuna-sezione' });
    } else {
      chiudiVelo();
      document.documentElement.classList.remove('accessi-bloccato');
      applicaSezioni();
      if (eAdmin()) elencoUtenti().catch(() => {});
    }
    aggiornaTasto();
    for (const f of acc.ascoltatori) { try { f(statoPubblico()); } catch (e) { console.error('[accessi]', e); } }
  }

  async function ricontrolla() {
    try { acc.profilo = await caricaProfilo(); } catch (_) { /* resta com'era */ }
    applica();
  }

  async function dopoCambioSessione(sessione) {
    acc.utente = sessione ? sessione.user : null;
    if (!acc.utente) { acc.profilo = null; applica(); return; }
    try { acc.profilo = await caricaProfilo(); }
    catch (e) { acc.profilo = null; console.warn('[accessi] profilo non letto', e); }
    applica();
  }

  function statoPubblico() {
    if (!acc.utente) return null;
    const p = acc.profilo || {};
    return { id: acc.utente.id, email: acc.utente.email, nome: p.nome || '', ruolo: p.ruolo || 'utente', stato: p.stato || null, sezioni: sezioniPermesse() };
  }

  // ==== 8. Il velo d'accesso ===============================================
  function campo({ id, etichetta, tipo = 'text', icona: nomeIcona, auto, extra = '' }) {
    const occhio = tipo === 'password'
      ? `<button type="button" class="acc-occhio" data-occhio="${id}" aria-label="${esc(t('accessi.mostra-password'))}">${ic('occhio', 18)}</button>` : '';
    return `<label class="acc-campo" for="${id}">
      <span class="acc-etichetta">${esc(t(etichetta))}</span>
      <span class="acc-input-guscio${tipo === 'password' ? ' con-occhio' : ''}">
        <span class="acc-input-icona">${ic(nomeIcona, 18)}</span>
        <input id="${id}" name="${id}" type="${tipo}" class="acc-input" autocomplete="${auto}" ${extra}>
        ${occhio}
      </span>
    </label>`;
  }

  function htmlModuli() {
    return `
    <form class="acc-modulo" data-modo="accedi" novalidate>
      ${campo({ id: 'acc-email', etichetta: 'accessi.email', tipo: 'email', icona: 'posta', auto: 'username', extra: 'inputmode="email" autocapitalize="none" spellcheck="false" required' })}
      ${campo({ id: 'acc-password', etichetta: 'accessi.password', tipo: 'password', icona: 'lucchetto', auto: 'current-password', extra: 'required' })}
      <div class="acc-riga-fra"><button type="button" class="acc-link" data-vai="recupera">${esc(t('accessi.dimenticata'))}</button></div>
      <p class="acc-messaggio" role="alert" hidden></p>
      <button type="submit" class="acc-primario"><span class="acc-rotella" aria-hidden="true"></span><span>${esc(t('accessi.entra'))}</span></button>
      <p class="acc-cambio">${esc(t('accessi.nuovo-qui'))} <button type="button" class="acc-link" data-vai="registra">${esc(t('accessi.crea'))}</button></p>
    </form>

    <form class="acc-modulo" data-modo="registra" novalidate>
      ${campo({ id: 'acc-nuovo-nome', etichetta: 'accessi.nome', icona: 'persona', auto: 'name', extra: 'maxlength="60" required' })}
      ${campo({ id: 'acc-nuova-email', etichetta: 'accessi.email', tipo: 'email', icona: 'posta', auto: 'email', extra: 'inputmode="email" autocapitalize="none" spellcheck="false" required' })}
      ${campo({ id: 'acc-nuova-password', etichetta: 'accessi.password', tipo: 'password', icona: 'lucchetto', auto: 'new-password', extra: 'required' })}
      <div class="acc-forza" data-forza="0" aria-live="polite"><span></span><span></span><span></span><span></span><em></em></div>
      ${campo({ id: 'acc-conferma', etichetta: 'accessi.conferma', tipo: 'password', icona: 'lucchetto', auto: 'new-password', extra: 'required' })}
      <p class="acc-nota-campo">${esc(t('accessi.aiuto-password'))}</p>
      <p class="acc-messaggio" role="alert" hidden></p>
      <button type="submit" class="acc-primario"><span class="acc-rotella" aria-hidden="true"></span><span>${esc(t('accessi.crea-invia'))}</span></button>
      <p class="acc-nota-campo acc-centro">${esc(t('accessi.nota-approvazione'))}</p>
      <p class="acc-cambio">${esc(t('accessi.hai-account'))} <button type="button" class="acc-link" data-vai="accedi">${esc(t('accessi.accedi'))}</button></p>
    </form>

    <form class="acc-modulo" data-modo="recupera" novalidate>
      <p class="acc-testo">${esc(t('accessi.recupera-testo'))}</p>
      ${campo({ id: 'acc-recupera-email', etichetta: 'accessi.email', tipo: 'email', icona: 'posta', auto: 'email', extra: 'inputmode="email" autocapitalize="none" spellcheck="false" required' })}
      <p class="acc-messaggio" role="alert" hidden></p>
      <button type="submit" class="acc-primario"><span class="acc-rotella" aria-hidden="true"></span><span>${esc(t('accessi.recupera-invia'))}</span></button>
      <p class="acc-cambio"><button type="button" class="acc-link" data-vai="accedi">${esc(t('accessi.torna-accedi'))}</button></p>
    </form>

    <form class="acc-modulo" data-modo="nuova-password" novalidate>
      <p class="acc-testo">${esc(t('accessi.nuova-password-testo'))}</p>
      ${campo({ id: 'acc-np', etichetta: 'accessi.password-nuova', tipo: 'password', icona: 'lucchetto', auto: 'new-password', extra: 'required' })}
      ${campo({ id: 'acc-np-conferma', etichetta: 'accessi.conferma', tipo: 'password', icona: 'lucchetto', auto: 'new-password', extra: 'required' })}
      <p class="acc-messaggio" role="alert" hidden></p>
      <button type="submit" class="acc-primario"><span class="acc-rotella" aria-hidden="true"></span><span>${esc(t('accessi.salva-password'))}</span></button>
    </form>

    <div class="acc-modulo acc-stato" data-modo="stato"></div>`;
  }

  const TITOLI = {
    accedi: ['accessi.titolo-accedi', 'accessi.sottotitolo-accedi'],
    registra: ['accessi.titolo-registra', 'accessi.sottotitolo-registra'],
    recupera: ['accessi.titolo-recupera', 'accessi.sottotitolo-recupera'],
    'nuova-password': ['accessi.titolo-nuova-password', 'accessi.sottotitolo-nuova-password'],
    stato: ['', '']
  };

  function costruisciVelo() {
    const velo = document.createElement('div');
    velo.id = 'accessi-velo';
    velo.className = 'acc-velo';
    velo.setAttribute('role', 'dialog');
    velo.setAttribute('aria-modal', 'true');
    velo.setAttribute('aria-labelledby', 'acc-titolo');
    velo.innerHTML = `
      <div class="acc-cornice">
        <aside class="acc-vetrina" aria-hidden="true">
          <div class="acc-marchio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10.6" ry="3.6" transform="rotate(-24 12 12)"/></svg>
            <span>${esc(t('ui.astrocalendario-di-ben'))}</span>
          </div>
          <div class="acc-vetrina-testo">
            <h2>${esc(t('accessi.vetrina-titolo'))}</h2>
            <p>${esc(t('accessi.vetrina-testo'))}</p>
            <ul>
              <li>${ic('stella', 18)}<span>${esc(t('accessi.vetrina-1'))}</span></li>
              <li>${ic('telescopio', 18)}<span>${esc(t('accessi.vetrina-2'))}</span></li>
              <li>${ic('scudo', 18)}<span>${esc(t('accessi.vetrina-3'))}</span></li>
            </ul>
          </div>
          <p class="acc-vetrina-piede">© AstroCalendario di Ben</p>
        </aside>
        <section class="acc-scheda">
          <div class="acc-marchio acc-marchio-piccolo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10.6" ry="3.6" transform="rotate(-24 12 12)"/></svg>
            <span>${esc(t('ui.astrocalendario-di-ben'))}</span>
          </div>
          <header class="acc-intestazione">
            <h1 id="acc-titolo"></h1>
            <p id="acc-sottotitolo"></p>
          </header>
          ${htmlModuli()}
        </section>
      </div>`;

    // passaggi fra i moduli
    velo.addEventListener('click', e => {
      const vai = e.target.closest('[data-vai]');
      if (vai) { e.preventDefault(); scegli(velo, vai.dataset.vai); return; }
      const occhio = e.target.closest('[data-occhio]');
      if (occhio) {
        const input = velo.querySelector('#' + occhio.dataset.occhio);
        const visibile = input.type === 'password';
        input.type = visibile ? 'text' : 'password';
        occhio.innerHTML = ic(visibile ? 'occhioChiuso' : 'occhio', 18);
        occhio.setAttribute('aria-label', t(visibile ? 'accessi.nascondi-password' : 'accessi.mostra-password'));
      }
    });
    // la forza della password mentre la si scrive
    const np = velo.querySelector('#acc-nuova-password');
    np.addEventListener('input', () => {
      const f = forzaPassword(np.value);
      const barra = velo.querySelector('.acc-forza');
      barra.dataset.forza = np.value ? f : 0;
      barra.querySelector('em').textContent = np.value ? t('accessi.forza.' + f) : '';
    });

    const invia = (modo, lavoro) => {
      const modulo = velo.querySelector(`form[data-modo="${modo}"]`);
      modulo.addEventListener('submit', async e => {
        e.preventDefault();
        const tasto = modulo.querySelector('.acc-primario');
        if (tasto.disabled) return;
        tasto.disabled = true; tasto.classList.add('in-corso');
        messaggio(modulo, null);
        let esito;
        try { esito = await lavoro(modulo); }
        catch (err) { esito = { errore: chiaveErrore(err) }; }
        finally { tasto.disabled = false; tasto.classList.remove('in-corso'); }
        if (esito && esito.errore) messaggio(modulo, t(esito.errore), 'errore');
        else if (esito && esito.avviso) messaggio(modulo, t(esito.avviso), 'ok');
      });
    };
    const v = (m, id) => m.querySelector('#' + id).value;
    invia('accedi', m => accedi({ email: v(m, 'acc-email'), password: v(m, 'acc-password') }));
    invia('registra', async m => {
      const esito = await registra({ nome: v(m, 'acc-nuovo-nome'), email: v(m, 'acc-nuova-email'), password: v(m, 'acc-nuova-password'), conferma: v(m, 'acc-conferma') });
      if (esito.ok && esito.controllaPosta) mostraVelo('stato', { stato: 'controlla-posta', email: v(m, 'acc-nuova-email') });
      return esito;
    });
    invia('recupera', async m => {
      const esito = await recupera(v(m, 'acc-recupera-email'));
      return esito.ok ? { avviso: 'accessi.recupera-inviata' } : esito;
    });
    invia('nuova-password', async m => {
      const esito = await nuovaPassword(v(m, 'acc-np'), v(m, 'acc-np-conferma'));
      if (esito.ok) { acc.recupero = false; await dopoCambioSessione((await client().auth.getSession()).data.session); }
      return esito;
    });
    return velo;
  }

  function messaggio(modulo, testo, tipo) {
    const p = modulo.querySelector('.acc-messaggio');
    if (!p) return;
    p.textContent = testo || '';
    p.hidden = !testo;
    p.className = 'acc-messaggio' + (tipo ? ' ' + tipo : '');
  }

  function scegli(velo, modo, dati = {}) {
    velo.dataset.modo = modo;
    velo.querySelectorAll('.acc-modulo').forEach(m => { m.hidden = m.dataset.modo !== modo; });
    velo.querySelectorAll('.acc-messaggio').forEach(p => { p.hidden = true; });
    const [titolo, sotto] = TITOLI[modo] || TITOLI.accedi;
    const h = velo.querySelector('#acc-titolo');
    const s = velo.querySelector('#acc-sottotitolo');
    h.textContent = titolo ? t(titolo) : '';
    s.textContent = sotto ? t(sotto) : '';
    velo.querySelector('.acc-intestazione').hidden = modo === 'stato';
    // l'email scritta passa da un modulo all'altro
    const email = ['acc-email', 'acc-nuova-email', 'acc-recupera-email'].map(id => velo.querySelector('#' + id).value).find(Boolean);
    if (email) ['acc-email', 'acc-nuova-email', 'acc-recupera-email'].forEach(id => { const i = velo.querySelector('#' + id); if (!i.value) i.value = email; });
    if (modo === 'stato') disegnaStato(velo.querySelector('[data-modo="stato"]'), dati);
    const primo = velo.querySelector(`.acc-modulo[data-modo="${modo}"] input:not([type=hidden]), .acc-modulo[data-modo="${modo}"] button`);
    setTimeout(() => { if (primo && !('ontouchstart' in window)) primo.focus(); }, 30);
  }

  // La pagina dello stato: in attesa, rifiutato, sospeso, controlla la posta
  function disegnaStato(dove, { stato, email }) {
    const voci = {
      in_attesa: { icona: 'attesa', classe: 'attesa', titolo: 'accessi.stato.attesa-titolo', testo: 'accessi.stato.attesa-testo', ricontrolla: true },
      rifiutato: { icona: 'chiudi', classe: 'no', titolo: 'accessi.stato.rifiutato-titolo', testo: 'accessi.stato.rifiutato-testo' },
      sospeso: { icona: 'lucchetto', classe: 'no', titolo: 'accessi.stato.sospeso-titolo', testo: 'accessi.stato.sospeso-testo' },
      'nessuna-sezione': { icona: 'lucchetto', classe: 'attesa', titolo: 'accessi.stato.sezioni-titolo', testo: 'accessi.stato.sezioni-testo', ricontrolla: true },
      'senza-profilo': { icona: 'attesa', classe: 'attesa', titolo: 'accessi.stato.profilo-titolo', testo: 'accessi.stato.profilo-testo', ricontrolla: true },
      'controlla-posta': { icona: 'posta', classe: 'ok', titolo: 'accessi.stato.posta-titolo', testo: 'accessi.stato.posta-testo', torna: true }
    };
    const v = voci[stato] || voci.in_attesa;
    const chi = acc.utente ? (acc.profilo && acc.profilo.nome ? acc.profilo.nome + ' · ' : '') + acc.utente.email : (email || '');
    dove.innerHTML = `
      <div class="acc-stato-icona ${v.classe}">${ic(v.icona, 30)}</div>
      <h1 class="acc-stato-titolo" id="acc-titolo-stato">${esc(t(v.titolo))}</h1>
      <p class="acc-testo acc-centro">${esc(t(v.testo, { email: email || '' }))}</p>
      ${chi ? `<p class="acc-chi-stato">${ic('persona', 16)}<span>${esc(chi)}</span></p>` : ''}
      <p class="acc-messaggio" role="status" hidden></p>
      ${v.ricontrolla ? `<button type="button" class="acc-primario" data-azione="ricontrolla"><span class="acc-rotella" aria-hidden="true"></span><span>${esc(t('accessi.ricontrolla'))}</span></button>` : ''}
      ${v.torna ? `<button type="button" class="acc-primario" data-vai="accedi"><span>${esc(t('accessi.torna-accedi'))}</span></button>` : ''}
      ${acc.utente ? `<button type="button" class="acc-secondario" data-azione="esci">${ic('esci', 18)}<span>${esc(t('accessi.esci'))}</span></button>` : ''}`;
    const r = dove.querySelector('[data-azione="ricontrolla"]');
    if (r) r.addEventListener('click', async () => {
      r.disabled = true; r.classList.add('in-corso');
      const prima = acc.profilo && acc.profilo.stato;
      await ricontrolla();
      r.disabled = false; r.classList.remove('in-corso');
      if (acc.profilo && acc.profilo.stato === prima && document.getElementById('accessi-velo')) {
        const m = document.querySelector('#accessi-velo [data-modo="stato"] .acc-messaggio');
        if (m) { m.textContent = t('accessi.ancora-attesa'); m.hidden = false; m.className = 'acc-messaggio'; }
      }
    });
    const e = dove.querySelector('[data-azione="esci"]');
    if (e) e.addEventListener('click', () => esci());
  }

  function mostraVelo(modo, dati) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => mostraVelo(modo, dati), { once: true }); return; }
    document.documentElement.classList.add('accessi-bloccato');
    chiudiFinestre();
    let velo = document.getElementById('accessi-velo');
    if (!velo) { velo = costruisciVelo(); document.body.append(velo); }
    scegli(velo, modo || 'accedi', dati);
  }
  function chiudiVelo() {
    const velo = document.getElementById('accessi-velo');
    if (velo) velo.remove();
  }
  function chiudiFinestre() {
    ['accessi-account', 'accessi-gestione'].forEach(id => { const f = document.getElementById(id); if (f) f.remove(); });
  }

  // ==== 9. Il tasto Account =================================================
  function aggiornaTasto() {
    const tasto = document.getElementById('btn-account');
    if (!tasto) return;
    const visibile = VELO_ATTIVO && !!acc.utente && !!acc.profilo && acc.profilo.stato === 'approvato';
    tasto.classList.toggle('hidden', !visibile);
    if (!visibile) return;
    tasto.title = t('accessi.connesso-come', { nome: acc.profilo.nome || acc.utente.email });
    let bollo = tasto.querySelector('.acc-bollo');
    if (eAdmin() && acc.inAttesa > 0) {
      if (!bollo) { bollo = document.createElement('span'); bollo.className = 'acc-bollo'; tasto.append(bollo); }
      bollo.textContent = acc.inAttesa > 9 ? '9+' : String(acc.inAttesa);
      bollo.setAttribute('aria-label', t('accessi.in-attesa-n', { n: acc.inAttesa }));
    } else if (bollo) bollo.remove();
  }

  // Una finestra modale dell'app (account, gestione), chiusa da Esc o fuori
  function finestra(id, classe, html) {
    chiudiFinestre();
    const velo = document.createElement('div');
    velo.id = id;
    velo.className = 'acc-finestra-velo';
    velo.setAttribute('role', 'dialog');
    velo.setAttribute('aria-modal', 'true');
    velo.innerHTML = `<div class="acc-finestra ${classe}">${html}</div>`;
    const chiudi = () => { velo.remove(); document.removeEventListener('keydown', tasti, true); };
    const tasti = e => { if (e.key === 'Escape' && document.getElementById(id)) { e.preventDefault(); chiudi(); } };
    velo.addEventListener('mousedown', e => { if (e.target === velo) chiudi(); });
    velo.addEventListener('click', e => { if (e.target.closest('[data-chiudi]')) chiudi(); });
    document.addEventListener('keydown', tasti, true);
    document.body.append(velo);
    velo.chiudi = chiudi;
    return velo;
  }
  const testaFinestra = (titolo, icona) => `
    <header class="acc-finestra-testa">
      <h2>${ic(icona, 20)}<span>${esc(titolo)}</span></h2>
      <button type="button" class="acc-x" data-chiudi aria-label="${esc(t('ui.chiudi'))}">${ic('chiudi', 18)}</button>
    </header>`;

  function nomeSezione(id) { return t('accessi.sezione.' + id); }
  function badgeStato(stato) { return `<span class="acc-badge stato-${esc(stato)}">${esc(t('accessi.stato.' + stato))}</span>`; }

  function apriAccount() {
    if (!acc.utente || !acc.profilo) return;
    const p = acc.profilo;
    const sezioni = eAdmin() ? t('accessi.tutte-sezioni') : sezioniPermesse().map(nomeSezione).join(', ');
    const velo = finestra('accessi-account', 'acc-finestra-account', `
      ${testaFinestra(t('accessi.account'), 'persona')}
      <div class="acc-finestra-corpo">
        <div class="acc-profilo">
          <span class="acc-avatar grande">${esc(iniziali(p))}</span>
          <div>
            <p class="acc-profilo-nome">${esc(p.nome || p.email)}</p>
            <p class="acc-profilo-email">${esc(acc.utente.email)}</p>
            <p class="acc-profilo-ruolo">${eAdmin() ? `<span class="acc-badge ruolo-admin">${ic('scudo', 14)}${esc(t('accessi.ruolo-admin'))}</span>` : `<span class="acc-badge">${esc(t('accessi.ruolo-utente'))}</span>`}</p>
          </div>
        </div>
        <dl class="acc-dettagli">
          <dt>${esc(t('accessi.iscritto-il'))}</dt><dd>${esc(dataBreve(p.creato))}</dd>
          <dt>${esc(t('accessi.sezioni'))}</dt><dd>${esc(sezioni)}</dd>
        </dl>
        ${eAdmin() ? `<button type="button" class="acc-primario acc-largo" data-azione="gestisci">${ic('utenti', 18)}<span>${esc(t('accessi.gestisci'))}</span>${acc.inAttesa ? `<span class="acc-bollo dentro">${acc.inAttesa}</span>` : ''}</button>` : ''}
        <details class="acc-espandi">
          <summary>${ic('lucchetto', 16)}<span>${esc(t('accessi.cambia-password'))}</span></summary>
          <form class="acc-modulo" data-modo="cambia" novalidate>
            ${campo({ id: 'acc-cambia-nuova', etichetta: 'accessi.password-nuova', tipo: 'password', icona: 'lucchetto', auto: 'new-password' })}
            ${campo({ id: 'acc-cambia-conferma', etichetta: 'accessi.conferma', tipo: 'password', icona: 'lucchetto', auto: 'new-password' })}
            <p class="acc-messaggio" role="alert" hidden></p>
            <button type="submit" class="acc-primario"><span class="acc-rotella" aria-hidden="true"></span><span>${esc(t('accessi.salva-password'))}</span></button>
          </form>
        </details>
        <button type="button" class="acc-secondario acc-largo" id="accessi-esci">${ic('esci', 18)}<span>${esc(t('accessi.esci'))}</span></button>
      </div>`);
    velo.addEventListener('click', e => {
      const occhio = e.target.closest('[data-occhio]');
      if (occhio) { const i = velo.querySelector('#' + occhio.dataset.occhio); i.type = i.type === 'password' ? 'text' : 'password'; }
    });
    const g = velo.querySelector('[data-azione="gestisci"]');
    if (g) g.addEventListener('click', () => apriGestione());
    velo.querySelector('#accessi-esci').addEventListener('click', () => { velo.chiudi(); esci(); });
    const modulo = velo.querySelector('form[data-modo="cambia"]');
    modulo.addEventListener('submit', async e => {
      e.preventDefault();
      const tasto = modulo.querySelector('.acc-primario');
      tasto.disabled = true; tasto.classList.add('in-corso');
      const esito = await nuovaPassword(modulo.querySelector('#acc-cambia-nuova').value, modulo.querySelector('#acc-cambia-conferma').value)
        .catch(err => ({ errore: chiaveErrore(err) }));
      tasto.disabled = false; tasto.classList.remove('in-corso');
      if (esito.ok) { messaggio(modulo, t('accessi.password-cambiata'), 'ok'); modulo.reset(); }
      else messaggio(modulo, t(esito.errore), 'errore');
    });
  }

  // ==== 10. La gestione degli utenti (solo amministratore) =================
  async function apriGestione() {
    if (!eAdmin()) return;
    const stato = { filtro: 'in_attesa', cerca: '', utenti: [], aperto: null };
    const velo = finestra('accessi-gestione', 'acc-finestra-gestione', `
      ${testaFinestra(t('accessi.gestisci'), 'utenti')}
      <div class="acc-gestione-barra">
        <div class="acc-filtri" role="tablist">
          ${['in_attesa', 'approvato', 'sospeso', 'rifiutato', 'tutti'].map(f => `<button type="button" role="tab" class="acc-filtro" data-filtro="${f}">${esc(t('accessi.filtro.' + f))}<span class="acc-conta"></span></button>`).join('')}
        </div>
        <label class="acc-cerca">${ic('lista', 16)}<input type="search" placeholder="${esc(t('accessi.cerca'))}" aria-label="${esc(t('accessi.cerca'))}"></label>
      </div>
      <div class="acc-finestra-corpo acc-elenco" aria-live="polite"><p class="acc-vuoto">${esc(t('accessi.caricamento'))}</p></div>`);
    const elenco = velo.querySelector('.acc-elenco');

    const ridisegna = () => {
      for (const b of velo.querySelectorAll('.acc-filtro')) {
        const f = b.dataset.filtro;
        b.classList.toggle('attiva', f === stato.filtro);
        b.setAttribute('aria-selected', f === stato.filtro ? 'true' : 'false');
        const n = f === 'tutti' ? stato.utenti.length : stato.utenti.filter(u => u.stato === f).length;
        b.querySelector('.acc-conta').textContent = n ? String(n) : '';
      }
      const q = stato.cerca.trim().toLowerCase();
      const righe = stato.utenti
        .filter(u => stato.filtro === 'tutti' || u.stato === stato.filtro)
        .filter(u => !q || (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
      if (!righe.length) { elenco.innerHTML = `<p class="acc-vuoto">${esc(t(stato.filtro === 'in_attesa' && !q ? 'accessi.nessuno-attesa' : 'accessi.nessuno'))}</p>`; return; }
      elenco.innerHTML = righe.map(rigaUtente).join('');
    };

    const rigaUtente = u => {
      const io = u.id === acc.profilo.id;
      const aperto = stato.aperto === u.id;
      const sezioni = Array.isArray(u.sezioni) ? u.sezioni : [];
      const azioni = [];
      if (!io) {
        if (u.stato !== 'approvato') azioni.push(['approva', 'accessi.azione.approva', 'positivo']);
        if (u.stato === 'in_attesa') azioni.push(['rifiuta', 'accessi.azione.rifiuta', 'negativo']);
        if (u.stato === 'approvato') azioni.push(['sospendi', 'accessi.azione.sospendi', '']);
        azioni.push(u.ruolo === 'admin' ? ['togli-admin', 'accessi.azione.togli-admin', ''] : ['rendi-admin', 'accessi.azione.rendi-admin', '']);
        azioni.push(['elimina', 'accessi.azione.elimina', 'negativo']);
      }
      return `
      <article class="acc-utente${aperto ? ' aperto' : ''}" data-id="${esc(u.id)}">
        <button type="button" class="acc-utente-testa" data-azione="apri" aria-expanded="${aperto}">
          <span class="acc-avatar">${esc(iniziali(u))}</span>
          <span class="acc-utente-nomi">
            <span class="acc-utente-nome">${esc(u.nome || '—')}${io ? ` <em>(${esc(t('accessi.tu'))})</em>` : ''}</span>
            <span class="acc-utente-email">${esc(u.email)}</span>
          </span>
          <span class="acc-utente-meta">
            ${u.ruolo === 'admin' ? `<span class="acc-badge ruolo-admin">${ic('scudo', 13)}${esc(t('accessi.ruolo-admin'))}</span>` : ''}
            ${badgeStato(u.stato)}
            <span class="acc-utente-data">${esc(dataBreve(u.creato))}</span>
          </span>
        </button>
        ${u.stato === 'in_attesa' && !io && !aperto ? `
        <div class="acc-utente-rapide">
          <button type="button" class="acc-azione positivo" data-azione="approva">${esc(t('accessi.azione.approva'))}</button>
          <button type="button" class="acc-azione negativo" data-azione="rifiuta">${esc(t('accessi.azione.rifiuta'))}</button>
        </div>` : ''}
        ${aperto ? `
        <div class="acc-utente-dettaglio">
          <p class="acc-sotto-titolo">${esc(t('accessi.sezioni-visibili'))}</p>
          ${u.ruolo === 'admin' ? `<p class="acc-nota-campo">${esc(t('accessi.admin-tutte'))}</p>` : `
          <div class="acc-sezioni">
            ${SEZIONI.map(s => `<label class="acc-interruttore"><input type="checkbox" data-sezione="${s.id}" ${sezioni.includes(s.id) ? 'checked' : ''}><span class="acc-levetta" aria-hidden="true"></span><span>${esc(nomeSezione(s.id))}</span></label>`).join('')}
          </div>
          <div class="acc-sezioni-rapide">
            <button type="button" class="acc-link" data-azione="tutte">${esc(t('accessi.seleziona-tutte'))}</button>
            <button type="button" class="acc-link" data-azione="nessuna">${esc(t('accessi.seleziona-nessuna'))}</button>
          </div>`}
          ${azioni.length ? `<div class="acc-azioni">${azioni.map(([a, k, c]) => `<button type="button" class="acc-azione ${c}" data-azione="${a}">${esc(t(k))}</button>`).join('')}</div>` : `<p class="acc-nota-campo">${esc(t('accessi.se-stesso'))}</p>`}
          <p class="acc-messaggio" role="alert" hidden></p>
        </div>` : ''}
      </article>`;
    };

    const carica = async () => {
      const esito = await elencoUtenti();
      if (esito.errore) { elenco.innerHTML = `<p class="acc-vuoto errore">${esc(t(esito.errore))}</p>`; return; }
      stato.utenti = esito.utenti;
      if (stato.filtro === 'in_attesa' && !stato.utenti.some(u => u.stato === 'in_attesa')) stato.filtro = 'tutti';
      ridisegna();
    };

    const cambia = async (riga, id, cambi) => {
      riga.classList.add('in-corso');
      const esito = await aggiornaUtente(id, cambi).catch(err => ({ errore: chiaveErrore(err) }));
      riga.classList.remove('in-corso');
      if (esito.errore) { const m = riga.querySelector('.acc-messaggio'); if (m) { m.textContent = t(esito.errore); m.hidden = false; m.className = 'acc-messaggio errore'; } else window.alert(t(esito.errore)); return false; }
      const i = stato.utenti.findIndex(u => u.id === id);
      if (i >= 0) stato.utenti[i] = esito.profilo;
      acc.inAttesa = stato.utenti.filter(u => u.stato === 'in_attesa').length;
      aggiornaTasto();
      ridisegna();
      return true;
    };

    velo.querySelector('.acc-filtri').addEventListener('click', e => {
      const b = e.target.closest('[data-filtro]');
      if (!b) return;
      stato.filtro = b.dataset.filtro; stato.aperto = null; ridisegna();
    });
    velo.querySelector('.acc-cerca input').addEventListener('input', e => { stato.cerca = e.target.value; ridisegna(); });
    elenco.addEventListener('click', async e => {
      const b = e.target.closest('[data-azione]');
      const riga = e.target.closest('.acc-utente');
      if (!b || !riga) return;
      const id = riga.dataset.id;
      const u = stato.utenti.find(x => x.id === id);
      if (!u) return;
      switch (b.dataset.azione) {
        case 'apri': stato.aperto = stato.aperto === id ? null : id; ridisegna(); break;
        case 'approva': await cambia(riga, id, { stato: 'approvato' }); break;
        case 'rifiuta': await cambia(riga, id, { stato: 'rifiutato' }); break;
        case 'sospendi': await cambia(riga, id, { stato: 'sospeso' }); break;
        case 'rendi-admin':
          if (window.confirm(t('accessi.conferma-admin', { nome: u.nome || u.email }))) await cambia(riga, id, { ruolo: 'admin', stato: 'approvato' });
          break;
        case 'togli-admin': await cambia(riga, id, { ruolo: 'utente' }); break;
        case 'tutte': await cambia(riga, id, { sezioni: SEZIONI.map(s => s.id) }); break;
        case 'nessuna': await cambia(riga, id, { sezioni: [] }); break;
        case 'elimina': {
          if (!window.confirm(t('accessi.conferma-elimina', { nome: u.nome || u.email }))) break;
          riga.classList.add('in-corso');
          const esito = await eliminaUtente(id).catch(err => ({ errore: chiaveErrore(err) }));
          riga.classList.remove('in-corso');
          if (esito.errore) { window.alert(t(esito.errore)); break; }
          stato.utenti = stato.utenti.filter(x => x.id !== id);
          acc.inAttesa = stato.utenti.filter(x => x.stato === 'in_attesa').length;
          aggiornaTasto(); ridisegna();
          break;
        }
      }
    });
    elenco.addEventListener('change', async e => {
      const casella = e.target.closest('[data-sezione]');
      const riga = e.target.closest('.acc-utente');
      if (!casella || !riga) return;
      const scelte = [...riga.querySelectorAll('[data-sezione]')].filter(c => c.checked).map(c => c.dataset.sezione);
      await cambia(riga, riga.dataset.id, { sezioni: SEZIONI.map(s => s.id).filter(s => scelte.includes(s)) });
    });
    await carica();
  }

  // ==== 11. Avvio ==========================================================
  async function avvia() {
    const tasto = document.getElementById('btn-account');
    if (tasto && !tasto.dataset.accessiPronto) {
      tasto.dataset.accessiPronto = '1';
      tasto.addEventListener('click', apriAccount);
    }
    if (!VELO_ATTIVO) { aggiornaTasto(); return; }
    const c = client();
    if (!c) {
      // la libreria non è arrivata (prima apertura senza rete): si prova
      // con il profilo salvato, altrimenti si dice che il servizio manca
      mostraVelo('accedi');
      const v = document.querySelector('#accessi-velo form[data-modo="accedi"]');
      if (v) messaggio(v, t('accessi.err.servizio'), 'errore');
      return;
    }
    c.auth.onAuthStateChange((evento, sessione) => {
      if (evento === 'PASSWORD_RECOVERY') { acc.recupero = true; acc.utente = sessione && sessione.user; mostraVelo('nuova-password'); return; }
      if (acc.recupero) return;
      if (evento === 'INITIAL_SESSION') return; // ci pensa getSession qui sotto
      if (evento === 'TOKEN_REFRESHED' || evento === 'USER_UPDATED') { if (sessione) acc.utente = sessione.user; return; }
      // fuori dal giro del client di Supabase: dentro al suo callback non si
      // devono fare altre chiamate al client (si aspetterebbero a vicenda)
      setTimeout(() => dopoCambioSessione(sessione), 0);
    });
    let sessione = null;
    try { sessione = (await c.auth.getSession()).data.session; } catch (_) { /* senza sessione */ }
    if (acc.recupero) return;
    await dopoCambioSessione(sessione);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { avvia(); }, { once: true });
  else avvia();

  // al cambio lingua si rifà il velo (o la finestra) nella lingua nuova
  if (typeof astroI18n === 'object' && astroI18n && typeof astroI18n.alCambio === 'function') {
    astroI18n.alCambio(() => {
      const velo = document.getElementById('accessi-velo');
      if (velo) { const modo = velo.dataset.modo; velo.remove(); if (modo === 'stato') applica(); else mostraVelo(modo); }
      aggiornaTasto();
    });
  }

  window.astroAccessi = {
    get utente() { return statoPubblico(); },
    autenticato: () => !!(acc.utente && acc.profilo && acc.profilo.stato === 'approvato'),
    eAdmin,
    configurato: CONFIGURATO,
    registra, accedi, esci, recupera, nuovaPassword,
    elencoUtenti, aggiornaUtente, eliminaUtente,
    vistaPermessa, sezioniPermesse,
    mostra: (opzioni = {}) => { if (opzioni.forza || !acc.utente) mostraVelo(opzioni.modo || 'accedi', opzioni); },
    apriAccount, apriGestione,
    alCambio: f => { acc.ascoltatori.add(f); return () => acc.ascoltatori.delete(f); },
    SEZIONI: SEZIONI.map(s => s.id),
    CHIAVI: { profilo: CHIAVE_PROFILO, sessione: CHIAVE_SESSIONE_SB }
  };
})();
