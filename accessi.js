/* Gli accessi: gli account dell'app (`acc`).
 * ==========================================
 *
 * All'apertura l'app chiede di entrare con un account: si può accedere con
 * nome utente e password, oppure crearne uno nuovo. È il giro che si trova in
 * ogni applicazione, e lo si è fatto nello stesso modo:
 *
 *   - **la password non si conserva mai**: si conserva la sua impronta
 *     PBKDF2-SHA256 (Web Crypto) con un sale casuale per ogni account e
 *     150 000 iterazioni, e al login si rifà il conto e si confronta;
 *   - **la sessione** è un gettone casuale scritto nell'account e accanto a
 *     lui: con «Ricordami» dura 30 giorni (`localStorage`), senza dura finché
 *     resta aperta la scheda (`sessionStorage`), e scade comunque dopo 12 ore;
 *   - **i tentativi sbagliati** si contano: dopo 5 di fila l'account si ferma
 *     per 30 secondi, poi per il doppio, e così via fino a un quarto d'ora;
 *   - il messaggio d'errore del login è lo stesso per un nome che non esiste
 *     e per una password sbagliata, così non dice quali nomi ci sono;
 *   - il primo account creato è l'**amministratore** (`ruolo: 'admin'`): lo si
 *     scrive perché chi verrà dopo possa dare permessi diversi, oggi non
 *     cambia nulla.
 *
 * Il limite va detto chiaro: l'app non ha un server (CLAUDE.md §1), quindi gli
 * account vivono in questo browser, su questo dispositivo. Il controllo tiene
 * fuori chi usa l'app normalmente, non chi apre gli strumenti per
 * sviluppatori. Per account condivisi fra dispositivi servirebbe un servizio
 * di autenticazione vero; le funzioni qui sotto (`registra`, `accedi`,
 * `esci`) sono il punto in cui lo si attaccherebbe.
 *
 * Si carica dopo `i18n.js` e prima di `app.js`: il velo deve coprire la pagina
 * prima che il planetario cominci a disegnarsi. Al browser guidato delle prove
 * (`navigator.webdriver`) il velo non si mostra, come la proposta della
 * presentazione (demo-impostazioni.js): coprirebbe i tasti che le prove
 * toccano. Lì si apre con `astroAccessi.mostra({ forza: true })`.
 */

(function () {
  'use strict';

  // ==== 1. Costanti e memoria ================================================
  const CHIAVE_ACCOUNT = 'astrocal_account_v1';
  const CHIAVE_SESSIONE = 'astrocal_sessione_v1';
  const ITERAZIONI = 150000;
  const DURATA_RICORDAMI = 30 * 24 * 3600 * 1000;
  const DURATA_SCHEDA = 12 * 3600 * 1000;
  const TENTATIVI_PRIMA_DEL_BLOCCO = 5;
  const BLOCCO_BASE = 30 * 1000;
  const BLOCCO_MASSIMO = 15 * 60 * 1000;
  const NOME_VALIDO = /^[A-Za-z0-9._-]{3,32}$/;
  const PASSWORD_MINIMA = 8;

  const acc = { utente: null, ascoltatori: new Set() };

  const t = (chiave, valori) =>
    (typeof astroI18n === 'object' && astroI18n && typeof astroI18n.t === 'function')
      ? astroI18n.t(chiave, valori) : chiave;

  function leggiAccount() {
    try {
      const v = JSON.parse(localStorage.getItem(CHIAVE_ACCOUNT) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }
  function scriviAccount(elenco) {
    localStorage.setItem(CHIAVE_ACCOUNT, JSON.stringify(elenco));
  }
  const chiaveNome = nome => String(nome || '').trim().toLowerCase();
  const trova = (elenco, nome) => elenco.find(a => a.chiave === chiaveNome(nome));

  // ==== 2. Le impronte delle password ========================================
  const inBase64 = byte => btoa(String.fromCharCode(...new Uint8Array(byte)));
  const daBase64 = testo => Uint8Array.from(atob(testo), c => c.charCodeAt(0));
  const casuale = n => crypto.getRandomValues(new Uint8Array(n));

  function cifraturaDisponibile() {
    return typeof crypto === 'object' && crypto && crypto.subtle && typeof crypto.subtle.importKey === 'function';
  }

  async function impronta(password, sale, iterazioni) {
    const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: iterazioni }, chiave, 256);
    return inBase64(bit);
  }

  // Confronto a tempo costante: non si esce al primo carattere diverso.
  function uguali(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diverso = 0;
    for (let i = 0; i < a.length; i++) diverso |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diverso === 0;
  }

  // Un login con un nome che non esiste fa lo stesso conto di uno vero:
  // dalla durata non si capisce quali nomi ci sono.
  const SALE_FINTO = casuale(16);

  // ==== 3. Le regole =========================================================
  function controllaNome(nome) {
    if (!NOME_VALIDO.test(String(nome || '').trim())) return 'accessi.err.nome';
    return null;
  }
  function controllaPassword(password, nome) {
    const p = String(password || '');
    if (p.length < PASSWORD_MINIMA) return 'accessi.err.password-corta';
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'accessi.err.password-debole';
    if (nome && p.toLowerCase().includes(chiaveNome(nome))) return 'accessi.err.password-nome';
    return null;
  }

  // ==== 4. Le sessioni =======================================================
  function leggiSessione() {
    for (const memoria of [sessionStorage, localStorage]) {
      try {
        const s = JSON.parse(memoria.getItem(CHIAVE_SESSIONE) || 'null');
        if (s && s.chiave && s.gettone) return s;
      } catch (_) { /* memoria non disponibile */ }
    }
    return null;
  }
  function cancellaSessione() {
    for (const memoria of [sessionStorage, localStorage]) {
      try { memoria.removeItem(CHIAVE_SESSIONE); } catch (_) { /* niente da togliere */ }
    }
  }
  function apriSessione(elenco, account, ricordami) {
    const gettone = inBase64(casuale(24));
    const scade = Date.now() + (ricordami ? DURATA_RICORDAMI : DURATA_SCHEDA);
    account.sessioni = (account.sessioni || []).filter(s => s.scade > Date.now()).slice(-4);
    account.sessioni.push({ gettone, scade });
    account.ultimoAccesso = new Date().toISOString();
    scriviAccount(elenco);
    cancellaSessione();
    (ricordami ? localStorage : sessionStorage).setItem(CHIAVE_SESSIONE, JSON.stringify({ chiave: account.chiave, gettone, scade }));
    impostaUtente(account);
  }
  // La sessione vale solo se il suo gettone è ancora scritto nell'account:
  // cambiando la password o uscendo si tolgono i gettoni e la sessione cade.
  function riprendiSessione() {
    const s = leggiSessione();
    if (!s || !(s.scade > Date.now())) { cancellaSessione(); return false; }
    const account = trova(leggiAccount(), s.chiave);
    const valida = account && (account.sessioni || []).some(x => x.scade > Date.now() && uguali(x.gettone, s.gettone));
    if (!valida) { cancellaSessione(); return false; }
    impostaUtente(account);
    return true;
  }
  function impostaUtente(account) {
    acc.utente = account ? { nome: account.nome, ruolo: account.ruolo, creato: account.creato } : null;
    document.documentElement.classList.toggle('accessi-bloccato', !acc.utente);
    aggiornaTasto();
    for (const f of acc.ascoltatori) { try { f(acc.utente); } catch (e) { console.error('[accessi]', e); } }
  }

  // ==== 5. Registrazione, accesso, uscita ===================================
  async function registra(nome, password, conferma, ricordami) {
    if (!cifraturaDisponibile()) return { errore: 'accessi.err.cifratura' };
    nome = String(nome || '').trim();
    const errNome = controllaNome(nome);
    if (errNome) return { errore: errNome };
    const errPassword = controllaPassword(password, nome);
    if (errPassword) return { errore: errPassword };
    if (password !== conferma) return { errore: 'accessi.err.conferma' };
    const elenco = leggiAccount();
    if (trova(elenco, nome)) return { errore: 'accessi.err.esiste' };
    const sale = casuale(16);
    const account = {
      nome, chiave: chiaveNome(nome),
      sale: inBase64(sale), iterazioni: ITERAZIONI,
      impronta: await impronta(password, sale, ITERAZIONI),
      ruolo: elenco.length ? 'utente' : 'admin',
      creato: new Date().toISOString(),
      falliti: 0, bloccatoFino: 0, sessioni: []
    };
    elenco.push(account);
    try { apriSessione(elenco, account, ricordami); }
    catch (_) { return { errore: 'accessi.err.memoria' }; }
    return { ok: true };
  }

  async function accedi(nome, password, ricordami) {
    if (!cifraturaDisponibile()) return { errore: 'accessi.err.cifratura' };
    const elenco = leggiAccount();
    const account = trova(elenco, nome);
    if (account && account.bloccatoFino > Date.now()) {
      return { errore: 'accessi.err.bloccato', valori: { s: Math.ceil((account.bloccatoFino - Date.now()) / 1000) } };
    }
    const sale = account ? daBase64(account.sale) : SALE_FINTO;
    const calcolata = await impronta(String(password || ''), sale, account ? account.iterazioni : ITERAZIONI);
    if (!account || !uguali(calcolata, account.impronta)) {
      if (account) {
        account.falliti = (account.falliti || 0) + 1;
        if (account.falliti >= TENTATIVI_PRIMA_DEL_BLOCCO) {
          const giri = account.falliti - TENTATIVI_PRIMA_DEL_BLOCCO;
          account.bloccatoFino = Date.now() + Math.min(BLOCCO_MASSIMO, BLOCCO_BASE * 2 ** giri);
        }
        try { scriviAccount(elenco); } catch (_) { /* il conto resta per questa volta */ }
      }
      return { errore: 'accessi.err.credenziali' };
    }
    account.falliti = 0; account.bloccatoFino = 0;
    try { apriSessione(elenco, account, ricordami); }
    catch (_) { return { errore: 'accessi.err.memoria' }; }
    return { ok: true };
  }

  function esci() {
    const s = leggiSessione();
    if (s) {
      const elenco = leggiAccount();
      const account = trova(elenco, s.chiave);
      if (account) {
        account.sessioni = (account.sessioni || []).filter(x => x.gettone !== s.gettone);
        try { scriviAccount(elenco); } catch (_) { /* la sessione cade comunque */ }
      }
    }
    cancellaSessione();
    impostaUtente(null);
    mostraVelo('accedi');
  }

  async function cambiaPassword(attuale, nuova, conferma) {
    if (!acc.utente) return { errore: 'accessi.err.credenziali' };
    const elenco = leggiAccount();
    const account = trova(elenco, acc.utente.nome);
    if (!account) return { errore: 'accessi.err.credenziali' };
    const prima = await impronta(String(attuale || ''), daBase64(account.sale), account.iterazioni);
    if (!uguali(prima, account.impronta)) return { errore: 'accessi.err.attuale' };
    const errPassword = controllaPassword(nuova, account.nome);
    if (errPassword) return { errore: errPassword };
    if (nuova !== conferma) return { errore: 'accessi.err.conferma' };
    const sale = casuale(16);
    account.sale = inBase64(sale);
    account.iterazioni = ITERAZIONI;
    account.impronta = await impronta(nuova, sale, ITERAZIONI);
    // le altre sessioni (altre schede, «Ricordami» di prima) cadono
    const s = leggiSessione();
    account.sessioni = (account.sessioni || []).filter(x => s && x.gettone === s.gettone);
    try { scriviAccount(elenco); } catch (_) { return { errore: 'accessi.err.memoria' }; }
    return { ok: true };
  }

  async function eliminaAccount(password) {
    if (!acc.utente) return { errore: 'accessi.err.credenziali' };
    const elenco = leggiAccount();
    const account = trova(elenco, acc.utente.nome);
    if (!account) return { errore: 'accessi.err.credenziali' };
    const prova = await impronta(String(password || ''), daBase64(account.sale), account.iterazioni);
    if (!uguali(prova, account.impronta)) return { errore: 'accessi.err.attuale' };
    const resto = elenco.filter(a => a !== account);
    // se se ne va l'amministratore, il ruolo passa al più anziano rimasto
    if (account.ruolo === 'admin' && resto.length && !resto.some(a => a.ruolo === 'admin')) resto[0].ruolo = 'admin';
    try { scriviAccount(resto); } catch (_) { return { errore: 'accessi.err.memoria' }; }
    cancellaSessione();
    impostaUtente(null);
    mostraVelo(resto.length ? 'accedi' : 'registra');
    return { ok: true };
  }

  // ==== 6. Il velo d'accesso =================================================
  function nodo(tag, attributi, ...figli) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attributi || {})) {
      if (v === false || v == null) continue;
      n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...figli.filter(f => f != null));
    return n;
  }
  function campo(id, chiaveEtichetta, attributi) {
    const input = nodo('input', Object.assign({ id, class: 'accessi-input' }, attributi));
    return nodo('label', { class: 'accessi-campo', for: id },
      nodo('span', { 'data-i18n': chiaveEtichetta }, t(chiaveEtichetta)), input);
  }
  function scriviErrore(dove, esito) {
    dove.textContent = esito && esito.errore ? t(esito.errore, esito.valori) : '';
    dove.hidden = !dove.textContent;
  }
  async function conAttesa(tasto, lavoro) {
    tasto.disabled = true;
    tasto.setAttribute('aria-busy', 'true');
    try { return await lavoro(); }
    finally { tasto.disabled = false; tasto.removeAttribute('aria-busy'); }
  }

  function costruisciVelo() {
    const vecchio = document.getElementById('accessi-velo');
    if (vecchio) vecchio.remove();

    const linguettaAccedi = nodo('button', { type: 'button', role: 'tab', class: 'accessi-linguetta', 'data-modo': 'accedi', 'data-i18n': 'accessi.accedi' }, t('accessi.accedi'));
    const linguettaRegistra = nodo('button', { type: 'button', role: 'tab', class: 'accessi-linguetta', 'data-modo': 'registra', 'data-i18n': 'accessi.crea' }, t('accessi.crea'));

    // --- Accedi ---
    const erroreAccedi = nodo('p', { class: 'accessi-errore', role: 'alert', hidden: true });
    const tastoAccedi = nodo('button', { type: 'submit', class: 'tasto-cielo tasto-primario accessi-invia', 'data-i18n': 'accessi.entra' }, t('accessi.entra'));
    const moduloAccedi = nodo('form', { class: 'accessi-modulo', 'data-modo': 'accedi', novalidate: true },
      campo('accessi-nome', 'accessi.nome', { type: 'text', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true }),
      campo('accessi-password', 'accessi.password', { type: 'password', name: 'password', autocomplete: 'current-password', required: true }),
      nodo('label', { class: 'accessi-ricordami' }, nodo('input', { type: 'checkbox', id: 'accessi-ricordami', checked: true }), nodo('span', { 'data-i18n': 'accessi.ricordami' }, t('accessi.ricordami'))),
      erroreAccedi, tastoAccedi);
    moduloAccedi.addEventListener('submit', async e => {
      e.preventDefault();
      const esito = await conAttesa(tastoAccedi, () => accedi(
        moduloAccedi.querySelector('#accessi-nome').value,
        moduloAccedi.querySelector('#accessi-password').value,
        moduloAccedi.querySelector('#accessi-ricordami').checked));
      scriviErrore(erroreAccedi, esito);
      if (esito.ok) chiudiVelo();
      else moduloAccedi.querySelector('#accessi-password').select();
    });

    // --- Crea account ---
    const erroreRegistra = nodo('p', { class: 'accessi-errore', role: 'alert', hidden: true });
    const tastoRegistra = nodo('button', { type: 'submit', class: 'tasto-cielo tasto-primario accessi-invia', 'data-i18n': 'accessi.crea-invia' }, t('accessi.crea-invia'));
    const moduloRegistra = nodo('form', { class: 'accessi-modulo', 'data-modo': 'registra', novalidate: true },
      campo('accessi-nuovo-nome', 'accessi.nome', { type: 'text', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true, maxlength: 32 }),
      nodo('p', { class: 'accessi-aiuto', 'data-i18n': 'accessi.aiuto-nome' }, t('accessi.aiuto-nome')),
      campo('accessi-nuova-password', 'accessi.password', { type: 'password', name: 'new-password', autocomplete: 'new-password', required: true }),
      nodo('p', { class: 'accessi-aiuto', 'data-i18n': 'accessi.aiuto-password' }, t('accessi.aiuto-password')),
      campo('accessi-conferma', 'accessi.conferma', { type: 'password', name: 'confirm-password', autocomplete: 'new-password', required: true }),
      nodo('label', { class: 'accessi-ricordami' }, nodo('input', { type: 'checkbox', id: 'accessi-ricordami-nuovo', checked: true }), nodo('span', { 'data-i18n': 'accessi.ricordami' }, t('accessi.ricordami'))),
      erroreRegistra, tastoRegistra);
    moduloRegistra.addEventListener('submit', async e => {
      e.preventDefault();
      const esito = await conAttesa(tastoRegistra, () => registra(
        moduloRegistra.querySelector('#accessi-nuovo-nome').value,
        moduloRegistra.querySelector('#accessi-nuova-password').value,
        moduloRegistra.querySelector('#accessi-conferma').value,
        moduloRegistra.querySelector('#accessi-ricordami-nuovo').checked));
      scriviErrore(erroreRegistra, esito);
      if (esito.ok) chiudiVelo();
    });

    const finestra = nodo('div', { class: 'yt-finestra accessi-finestra' },
      nodo('div', { class: 'accessi-testa' },
        nodo('h2', { id: 'accessi-titolo', 'data-i18n': 'ui.astrocalendario-di-ben' }, t('ui.astrocalendario-di-ben')),
        nodo('p', { class: 'accessi-sottotitolo', id: 'accessi-sottotitolo' })),
      nodo('div', { class: 'accessi-linguette', role: 'tablist' }, linguettaAccedi, linguettaRegistra),
      nodo('div', { class: 'yt-corpo' }, moduloAccedi, moduloRegistra),
      nodo('p', { class: 'accessi-nota', 'data-i18n': 'accessi.nota-locale' }, t('accessi.nota-locale')));
    const velo = nodo('div', { id: 'accessi-velo', class: 'yt-velo accessi-velo', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'accessi-titolo' }, finestra);

    const scegli = modo => {
      velo.dataset.modo = modo;
      for (const l of [linguettaAccedi, linguettaRegistra]) {
        const attiva = l.dataset.modo === modo;
        l.classList.toggle('attiva', attiva);
        l.setAttribute('aria-selected', attiva ? 'true' : 'false');
      }
      moduloAccedi.hidden = modo !== 'accedi';
      moduloRegistra.hidden = modo !== 'registra';
      const sotto = velo.querySelector('#accessi-sottotitolo');
      const chiave = modo === 'accedi' ? 'accessi.sottotitolo-accedi' : (leggiAccount().length ? 'accessi.sottotitolo-crea' : 'accessi.sottotitolo-primo');
      sotto.setAttribute('data-i18n', chiave);
      sotto.textContent = t(chiave);
      scriviErrore(erroreAccedi, null); scriviErrore(erroreRegistra, null);
      const primo = (modo === 'accedi' ? moduloAccedi : moduloRegistra).querySelector('input');
      setTimeout(() => primo && primo.focus(), 0);
    };
    linguettaAccedi.addEventListener('click', () => scegli('accedi'));
    linguettaRegistra.addEventListener('click', () => scegli('registra'));
    velo.scegli = scegli;
    // Il velo non si chiude con Esc né toccando fuori: è la porta dell'app.
    return velo;
  }

  function mostraVelo(modo) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => mostraVelo(modo), { once: true });
      return;
    }
    document.documentElement.classList.add('accessi-bloccato');
    const velo = costruisciVelo();
    document.body.append(velo);
    velo.scegli(modo || (leggiAccount().length ? 'accedi' : 'registra'));
  }
  function chiudiVelo() {
    const velo = document.getElementById('accessi-velo');
    if (velo) velo.remove();
  }

  // ==== 7. Il tasto Account e la sua finestra ================================
  function aggiornaTasto() {
    const tasto = document.getElementById('btn-account');
    if (!tasto) return;
    tasto.classList.toggle('hidden', !acc.utente);
    if (acc.utente) tasto.title = t('accessi.connesso-come', { nome: acc.utente.nome });
  }

  function apriFinestraAccount() {
    if (!acc.utente || document.getElementById('accessi-account')) return;
    const chiudi = () => { velo.remove(); document.removeEventListener('keydown', tasti, true); };
    const tasti = e => { if (e.key === 'Escape') { e.preventDefault(); chiudi(); } };

    const x = nodo('button', { type: 'button', class: 'yt-x', 'aria-label': t('ui.chiudi'), 'data-i18n-aria-label': 'ui.chiudi' }, '×');
    x.addEventListener('click', chiudi);

    const quando = acc.utente.creato ? new Date(acc.utente.creato) : null;
    const dataCreato = quando && !isNaN(quando)
      ? quando.toLocaleDateString((typeof astroI18n === 'object' && astroI18n.locale && astroI18n.locale()) || undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const ruolo = t(acc.utente.ruolo === 'admin' ? 'accessi.ruolo-admin' : 'accessi.ruolo-utente');

    // cambio password
    const errore = nodo('p', { class: 'accessi-errore', role: 'alert', hidden: true });
    const fatto = nodo('p', { class: 'accessi-fatto', role: 'status', hidden: true });
    const tastoCambia = nodo('button', { type: 'submit', class: 'tasto-cielo tasto-primario' }, t('accessi.cambia-invia'));
    const modulo = nodo('form', { class: 'accessi-modulo', novalidate: true },
      nodo('input', { type: 'text', name: 'username', autocomplete: 'username', value: acc.utente.nome, hidden: true }),
      campo('accessi-attuale', 'accessi.password-attuale', { type: 'password', autocomplete: 'current-password' }),
      campo('accessi-cambia-nuova', 'accessi.password-nuova', { type: 'password', autocomplete: 'new-password' }),
      campo('accessi-cambia-conferma', 'accessi.conferma', { type: 'password', autocomplete: 'new-password' }),
      errore, fatto, tastoCambia);
    modulo.addEventListener('submit', async e => {
      e.preventDefault();
      const esito = await conAttesa(tastoCambia, () => cambiaPassword(
        modulo.querySelector('#accessi-attuale').value,
        modulo.querySelector('#accessi-cambia-nuova').value,
        modulo.querySelector('#accessi-cambia-conferma').value));
      scriviErrore(errore, esito);
      fatto.hidden = !esito.ok;
      fatto.textContent = esito.ok ? t('accessi.password-cambiata') : '';
      if (esito.ok) modulo.querySelectorAll('input[type=password]').forEach(i => { i.value = ''; });
    });

    const tastoEsci = nodo('button', { type: 'button', class: 'tasto-cielo', id: 'accessi-esci' }, t('accessi.esci'));
    tastoEsci.addEventListener('click', () => { chiudi(); esci(); });

    const tastoElimina = nodo('button', { type: 'button', class: 'tasto-cielo accessi-pericolo' }, t('accessi.elimina'));
    tastoElimina.addEventListener('click', async () => {
      if (!window.confirm(t('accessi.elimina-conferma', { nome: acc.utente.nome }))) return;
      const password = window.prompt(t('accessi.elimina-password'));
      if (password == null) return;
      const esito = await eliminaAccount(password);
      if (esito.ok) chiudi(); else scriviErrore(errore, esito);
    });

    const finestra = nodo('div', { class: 'yt-finestra accessi-finestra' },
      nodo('div', { class: 'yt-testa' }, nodo('h2', { id: 'accessi-account-titolo' }, t('accessi.account')), x),
      nodo('div', { class: 'yt-corpo' },
        nodo('p', { class: 'accessi-chi' }, nodo('strong', {}, acc.utente.nome), ' · ', ruolo),
        dataCreato ? nodo('p', { class: 'yt-file' }, t('accessi.creato-il', { data: dataCreato })) : null,
        nodo('h3', { class: 'accessi-sezione' }, t('accessi.cambia-password')),
        modulo,
        nodo('div', { class: 'accessi-tasti' }, tastoEsci, tastoElimina)));
    const velo = nodo('div', { id: 'accessi-account', class: 'yt-velo accessi-velo-account', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'accessi-account-titolo' }, finestra);
    velo.addEventListener('mousedown', e => { if (e.target === velo) chiudi(); });
    document.body.append(velo);
    document.addEventListener('keydown', tasti, true);
    tastoEsci.focus();
  }

  // ==== 8. Avvio =============================================================
  function avvia() {
    const tasto = document.getElementById('btn-account');
    if (tasto && !tasto.dataset.accessiPronto) {
      tasto.dataset.accessiPronto = '1';
      tasto.addEventListener('click', apriFinestraAccount);
    }
    if (riprendiSessione()) return;
    if (navigator.webdriver) { aggiornaTasto(); return; }
    mostraVelo();
  }
  if (document.readyState === 'loading') {
    // gli script stanno in fondo al body: il velo si può già appendere, il
    // tasto della testata c'è; DOMContentLoaded solo per sicurezza
    if (document.body) avvia(); else document.addEventListener('DOMContentLoaded', avvia, { once: true });
  } else avvia();

  // Le frasi del velo seguono la lingua anche se cambiata da sotto
  if (typeof astroI18n === 'object' && astroI18n && typeof astroI18n.alCambio === 'function') {
    astroI18n.alCambio(() => {
      const velo = document.getElementById('accessi-velo');
      if (velo && velo.scegli) {
        const sotto = velo.querySelector('#accessi-sottotitolo');
        if (sotto) sotto.textContent = t(sotto.getAttribute('data-i18n'));
      }
      aggiornaTasto();
    });
  }

  window.astroAccessi = {
    get utente() { return acc.utente ? Object.assign({}, acc.utente) : null; },
    autenticato: () => !!acc.utente,
    registra, accedi, esci, cambiaPassword, eliminaAccount,
    mostra: (opzioni = {}) => { if (!acc.utente || opzioni.forza) mostraVelo(opzioni.modo); },
    apriAccount: apriFinestraAccount,
    alCambio: f => { acc.ascoltatori.add(f); return () => acc.ascoltatori.delete(f); },
    CHIAVI: { account: CHIAVE_ACCOUNT, sessione: CHIAVE_SESSIONE }
  };
})();
