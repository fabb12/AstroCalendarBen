// Server del controllo degli accessi di AstroCalendarBen (v504).
//
// PERCHE' UN SERVER. L'app e' un sito statico su GitHub Pages: tutto quello
// che sta nel browser lo puo' leggere e cambiare chi lo usa. Un elenco di
// utenti e password scritto in `config.js` sarebbe una porta disegnata sul
// muro: si legge il file, si trova la password. Qui invece le password, le
// sessioni, i permessi e le statistiche stanno **dal server**, in un archivio
// che il browser non vede: l'app chiede, il server decide. E' lo stesso
// ragionamento del proxy ADS-B (`worker-adsb.js`): l'unico posto in cui un
// segreto puo' stare senza finire nel browser di chiunque apra il sito.
//
// Cosa NON fa, detto chiaro (e ripetuto in ACCESSI.md): i file dell'app restano
// pubblici su Pages. Il server decide chi entra *nell'app* e cosa ci vede;
// non puo' impedire a chi conosce l'indirizzo di scaricare `app.js`. Per
// nascondere anche i file serve un hosting con l'accesso davanti (Cloudflare
// Access, un server proprio).
//
// --- Dove gira -----------------------------------------------------------
// Su **Deno Deploy**, come il proxy ADS-B, con **Deno KV** come archivio (sta
// nella piattaforma, gratis, niente da configurare). Le variabili:
//
//   ACCESSI_ADMIN_UTENTE    nome del primo amministratore (creato se manca)
//   ACCESSI_ADMIN_PASSWORD  la sua password iniziale (almeno 8 caratteri)
//   ORIGINI_AMMESSE         siti in piu' che possono chiamare (virgole)
//   ACCESSI_DURATA_GIORNI   quanto dura una sessione inattiva (di serie 30)
//   ACCESSI_MEMORIA         "1" = archivio in memoria: SOLO per le prove,
//                           si perde tutto al riavvio
//
// Senza Deno KV e senza ACCESSI_MEMORIA il server non fa entrare nessuno e lo
// dice (`/api/accessi/stato`): meglio una porta chiusa con un cartello che
// una porta che si apre e dimentica chi e' entrato.
//
// --- Le scelte -----------------------------------------------------------
// - Password con PBKDF2-SHA256, sale casuale, 100 000 giri: e' quello che
//   WebCrypto offre su tutte le piattaforme (Cloudflare non va oltre i
//   100 000), e sta nel tempo di CPU concesso a una richiesta di Deno Deploy.
// - Sessioni opache: il gettone e' casuale (32 byte), il server ne tiene solo
//   l'impronta SHA-256. Chi legge l'archivio non trova gettoni da usare, e una
//   sessione si revoca cancellando una chiave. Niente cookie: app e server
//   stanno su domini diversi, e i browser bloccano i cookie di terze parti.
// - La sessione scorre: ogni verifica la allunga di ACCESSI_DURATA_GIORNI.
//   Un utente che usa l'app non deve mai rientrare; uno che sparisce per un
//   mese si.
// - Tentativi sbagliati: 5 per utente o 20 per indirizzo in 15 minuti, poi 15
//   minuti di pausa. Un utente che non esiste costa lo stesso tempo di uno
//   che esiste (si calcola comunque un PBKDF2), cosi' non si indovinano i
//   nomi dal cronometro.
// - Statistiche aggregate per giorno, non un registro di ogni gesto: quanto
//   si e' usata l'app, quali sezioni, quali funzioni, da che dispositivo.
//   I giorni si cancellano da soli dopo 400 giorni.
//
// Prova: `node scripts/prova-accessi.js` (questo file con l'archivio in
// memoria, e l'app vera nel browser che ci parla).

const VERSIONE_SERVIZIO = 1;
const ITERAZIONI_PBKDF2 = 100000;
const DURATA_GIORNI_SERIE = 30;
const TENTATIVI_UTENTE = 5;
const TENTATIVI_INDIRIZZO = 20;
const FINESTRA_TENTATIVI_MS = 15 * 60 * 1000;
const STATISTICHE_GIORNI_MS = 400 * 86400000;
const EVENTI_MAX_PER_INVIO = 300;
const CORPO_MAX_BYTE = 64 * 1024;
const LOTTI_MS = 30 * 86400000;
const RUOLI = ['utente', 'admin'];
const UTENTE_VALIDO = /^[a-z0-9][a-z0-9._@-]{2,63}$/;
const FUNZIONE_VALIDA = /^(\*|[a-z0-9][a-z0-9:_-]{0,39})$/;
const NOME_STAT_VALIDO = /^[a-z0-9][a-z0-9:_.-]{0,39}$/;
const GIORNO_VALIDO = /^\d{4}-\d{2}-\d{2}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

const ORIGINI_SERIE = ['https://fabb12.github.io'];

// =====================================================================
// 1. L'ambiente (Deno o l'oggetto passato dalle prove)
// =====================================================================

const CHIAVI_AMBIENTE = ['ACCESSI_ADMIN_UTENTE', 'ACCESSI_ADMIN_PASSWORD', 'ORIGINI_AMMESSE',
  'ACCESSI_DURATA_GIORNI', 'ACCESSI_MEMORIA'];

function leggiAmbiente(env) {
  const dentro = {};
  for (const chiave of CHIAVI_AMBIENTE) {
    let valore = (env && typeof env === 'object') ? env[chiave] : undefined;
    if (valore === undefined && typeof Deno !== 'undefined' && Deno.env) {
      try { valore = Deno.env.get(chiave); } catch (_) { /* permesso negato */ }
    }
    if (valore !== undefined) dentro[chiave] = String(valore);
  }
  return dentro;
}

// =====================================================================
// 2. L'archivio: Deno KV, o la memoria per le prove
// =====================================================================
// Tutte e due rispondono alle stesse cinque domande. `aggiorna` legge, passa
// il valore a una funzione e riscrive solo se nel frattempo nessuno l'ha
// cambiato (il `versionstamp` di Deno KV): due schede che mandano statistiche
// nello stesso istante non si cancellano i conti a vicenda.

function archivioDenoKv(kv) {
  return {
    tipo: 'deno-kv',
    async leggi(chiave) { return (await kv.get(chiave)).value ?? null; },
    async scrivi(chiave, valore, scadeMs) {
      await kv.set(chiave, valore, scadeMs ? { expireIn: scadeMs } : undefined);
    },
    async cancella(chiave) { await kv.delete(chiave); },
    async elenca(prefisso, da, a) {
      const selettore = (da || a)
        ? { start: prefisso.concat(da ? [da] : []), end: prefisso.concat([a || '￿']) }
        : { prefix: prefisso };
      if (da && !a) selettore.end = prefisso.concat(['￿']);
      if (!da && a) selettore.start = prefisso.concat(['']);
      const fuori = [];
      for await (const voce of kv.list(selettore)) fuori.push({ chiave: voce.key, valore: voce.value });
      return fuori;
    },
    async creaSeManca(chiave, valore, scadeMs) {
      const esito = await kv.atomic().check({ key: chiave, versionstamp: null })
        .set(chiave, valore, scadeMs ? { expireIn: scadeMs } : undefined).commit();
      return esito.ok;
    },
    async aggiorna(chiave, cambia, scadeMs) {
      for (let giro = 0; giro < 8; giro++) {
        const prima = await kv.get(chiave);
        const dopo = cambia(prima.value ?? null);
        if (dopo === undefined) return prima.value ?? null;
        const esito = await kv.atomic().check(prima)
          .set(chiave, dopo, scadeMs ? { expireIn: scadeMs } : undefined).commit();
        if (esito.ok) return dopo;
      }
      throw new Error('archivio conteso');
    }
  };
}

function archivioMemoria() {
  const dati = new Map();
  const ora = () => Date.now();
  const vivo = (voce) => voce && (!voce.scade || voce.scade > ora());
  const testo = (chiave) => JSON.stringify(chiave);
  const confronta = (a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return a.length - b.length;
  };
  return {
    tipo: 'memoria',
    async leggi(chiave) { const v = dati.get(testo(chiave)); return vivo(v) ? structuredClone(v.valore) : null; },
    async scrivi(chiave, valore, scadeMs) {
      dati.set(testo(chiave), { chiave, valore: structuredClone(valore), scade: scadeMs ? ora() + scadeMs : 0 });
    },
    async cancella(chiave) { dati.delete(testo(chiave)); },
    async elenca(prefisso, da, a) {
      const fuori = [];
      for (const v of dati.values()) {
        if (!vivo(v) || v.chiave.length <= prefisso.length) continue;
        if (prefisso.some((p, i) => v.chiave[i] !== p)) continue;
        const resto = v.chiave[prefisso.length];
        if (da && resto < da) continue;
        if (a && resto >= a) continue;
        fuori.push({ chiave: v.chiave, valore: structuredClone(v.valore) });
      }
      return fuori.sort((x, y) => confronta(x.chiave, y.chiave));
    },
    async creaSeManca(chiave, valore, scadeMs) {
      if (vivo(dati.get(testo(chiave)))) return false;
      dati.set(testo(chiave), { chiave, valore: structuredClone(valore), scade: scadeMs ? ora() + scadeMs : 0 });
      return true;
    },
    async aggiorna(chiave, cambia, scadeMs) {
      const v = dati.get(testo(chiave));
      const dopo = cambia(vivo(v) ? structuredClone(v.valore) : null);
      if (dopo === undefined) return vivo(v) ? v.valore : null;
      dati.set(testo(chiave), { chiave, valore: structuredClone(dopo), scade: scadeMs ? ora() + scadeMs : 0 });
      return dopo;
    }
  };
}

// =====================================================================
// 3. Crittografia: password, gettoni, confronti
// =====================================================================

const codifica = new TextEncoder();

function base64url(byte) {
  let s = '';
  for (const b of byte) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function casuale(n) {
  const byte = new Uint8Array(n);
  crypto.getRandomValues(byte);
  return byte;
}

async function impronta(testo) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', codifica.encode(testo))));
}

async function derivaPassword(password, sale, giri) {
  const chiave = await crypto.subtle.importKey('raw', codifica.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: codifica.encode(sale), iterations: giri }, chiave, 256);
  return base64url(new Uint8Array(bit));
}

// Confronto a tempo costante: la lunghezza delle impronte e' sempre la
// stessa, e il ciclo non si ferma alla prima differenza.
function uguali(a, b) {
  a = String(a); b = String(b);
  let diverso = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diverso |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diverso === 0;
}

async function nuovaPassword(password) {
  const sale = base64url(casuale(16));
  return { sale, giri: ITERAZIONI_PBKDF2, hash: await derivaPassword(password, sale, ITERAZIONI_PBKDF2) };
}

// Un'impronta finta per gli utenti che non esistono (vedi in testa)
const SALE_FINTO = 'sale-per-chi-non-esiste';

// =====================================================================
// 4. Validazioni
// =====================================================================

function nomeUtente(x) {
  const s = String(x || '').trim().toLowerCase();
  return UTENTE_VALIDO.test(s) ? s : '';
}

function passwordValida(p) {
  return typeof p === 'string' && p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX;
}

function elencoFunzioni(x) {
  if (!Array.isArray(x)) return null;
  const fuori = [];
  for (const f of x) {
    const s = String(f || '').trim().toLowerCase();
    if (FUNZIONE_VALIDA.test(s) && !fuori.includes(s)) fuori.push(s);
    if (fuori.length >= 64) break;
  }
  return fuori;
}

function testoBreve(x, max) {
  return String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

// Quello che l'app vede di un utente: mai sale e impronta.
function profilo(u) {
  return {
    utente: u.id, nome: u.nome || u.id, ruolo: u.ruolo,
    funzioni: u.ruolo === 'admin' ? ['*'] : (u.funzioni || []),
    attivo: u.attivo !== false
  };
}

function schedaAdmin(u) {
  return Object.assign(profilo(u), {
    funzioni: u.funzioni || [], creato: u.creato || 0, modificato: u.modificato || 0,
    ultimoAccesso: u.ultimoAccesso || 0, note: u.note || ''
  });
}

// =====================================================================
// 5. Il servizio
// =====================================================================

function creaServizio(opzioni = {}) {
  const orologio = opzioni.ora || (() => Date.now());
  let archivioPronto = opzioni.archivio ? Promise.resolve(opzioni.archivio) : null;
  let avviato = null;

  async function archivio(env) {
    if (!archivioPronto) {
      archivioPronto = (async () => {
        if (typeof Deno !== 'undefined' && typeof Deno.openKv === 'function') {
          try { return archivioDenoKv(await Deno.openKv()); } catch (_) { /* KV non disponibile */ }
        }
        if (env.ACCESSI_MEMORIA === '1') return archivioMemoria();
        return null;
      })();
    }
    return archivioPronto;
  }

  // Il primo amministratore, dalle variabili d'ambiente: si crea solo se non
  // c'e'. Dopo, la password si cambia dall'app e la variabile non la
  // sovrascrive (altrimenti ogni riavvio rimetterebbe quella vecchia).
  async function avvia(env, db) {
    if (avviato) return avviato;
    avviato = (async () => {
      const id = nomeUtente(env.ACCESSI_ADMIN_UTENTE);
      const password = env.ACCESSI_ADMIN_PASSWORD;
      if (!id || !passwordValida(password)) return;
      if (await db.leggi(['utente', id])) return;
      const p = await nuovaPassword(password);
      await db.scrivi(['utente', id], {
        id, nome: id, ruolo: 'admin', funzioni: ['*'], attivo: true,
        sale: p.sale, giri: p.giri, hash: p.hash, creato: orologio(), modificato: orologio()
      });
    })().catch(errore => { avviato = null; throw errore; });
    return avviato;
  }

  function durataMs(env) {
    const g = Number(env.ACCESSI_DURATA_GIORNI);
    return (Number.isFinite(g) && g >= 1 && g <= 365 ? g : DURATA_GIORNI_SERIE) * 86400000;
  }

  // --- CORS ---------------------------------------------------------------
  function originePermessa(origine, env) {
    if (!origine) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return true;
    const extra = String(env.ORIGINI_AMMESSE || '').split(',').map(s => s.trim()).filter(Boolean);
    return ORIGINI_SERIE.concat(extra).includes(origine);
  }

  function intestazioni(richiesta, env) {
    const origine = richiesta.headers.get('Origin');
    const h = {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '600',
      'Cache-Control': 'no-store',
      'Vary': 'Origin'
    };
    if (origine && originePermessa(origine, env)) h['Access-Control-Allow-Origin'] = origine;
    return h;
  }

  // --- Sessioni -----------------------------------------------------------
  function gettoneDa(richiesta, corpo) {
    const a = richiesta.headers.get('Authorization') || '';
    if (/^Bearer\s+/i.test(a)) return a.replace(/^Bearer\s+/i, '').trim();
    // L'invio delle statistiche alla chiusura della pagina va con
    // `keepalive` e `text/plain`, senza intestazioni speciali: il gettone
    // viaggia nel corpo.
    return corpo && typeof corpo.gettone === 'string' ? corpo.gettone : '';
  }

  async function sessione(db, gettone, env, allunga) {
    if (!gettone || gettone.length > 100) return null;
    const chiave = ['sessione', await impronta(gettone)];
    const s = await db.leggi(chiave);
    if (!s || s.scade <= orologio()) return null;
    const u = await db.leggi(['utente', s.utente]);
    if (!u || u.attivo === false) { await db.cancella(chiave); return null; }
    if (allunga) {
      s.scade = orologio() + durataMs(env);
      s.ultimoUso = orologio();
      await db.scrivi(chiave, s, durataMs(env));
    }
    return { s, u, chiave };
  }

  async function revocaTutte(db, id) {
    for (const v of await db.elenca(['sessioni_utente', id])) {
      await db.cancella(['sessione', v.chiave[2]]);
      await db.cancella(v.chiave);
    }
  }

  // --- Tentativi ----------------------------------------------------------
  async function bloccato(db, chiave, limite) {
    const t = await db.leggi(['tentativi'].concat(chiave));
    return !!(t && t.n >= limite && orologio() - t.primo < FINESTRA_TENTATIVI_MS);
  }

  async function segnaFallito(db, chiave) {
    await db.aggiorna(['tentativi'].concat(chiave), t => {
      if (!t || orologio() - t.primo >= FINESTRA_TENTATIVI_MS) return { n: 1, primo: orologio() };
      return { n: t.n + 1, primo: t.primo };
    }, FINESTRA_TENTATIVI_MS);
  }

  // --- Statistiche --------------------------------------------------------
  // Un giorno di un utente: un oggetto piccolo (poche decine di chiavi), che
  // si somma evento per evento.
  function sommaEvento(giorno, e) {
    const conta = (mappa, nome, quanto) => {
      if (!NOME_STAT_VALIDO.test(nome)) return;
      if (!(nome in mappa) && Object.keys(mappa).length >= 60) return;
      mappa[nome] = (mappa[nome] || 0) + quanto;
    };
    const ora = Number(e.ora);
    if (Number.isFinite(ora) && ora >= 0 && ora <= 23) giorno.ore[ora] = (giorno.ore[ora] || 0) + 1;
    switch (e.tipo) {
      case 'avvio':
        giorno.avvii++;
        if (e.dispositivo) conta(giorno.dispositivi, String(e.dispositivo), 1);
        if (e.lingua) conta(giorno.lingue, String(e.lingua), 1);
        if (e.versione) giorno.versione = testoBreve(e.versione, 20);
        break;
      case 'vista': {
        const s = Math.max(0, Math.min(6 * 3600, Math.round(Number(e.secondi) || 0)));
        const nome = String(e.nome || '');
        if (!NOME_STAT_VALIDO.test(nome)) break;
        if (!giorno.viste[nome]) {
          if (Object.keys(giorno.viste).length >= 30) break;
          giorno.viste[nome] = { aperture: 0, secondi: 0 };
        }
        giorno.viste[nome].secondi += s;
        if (e.apertura) giorno.viste[nome].aperture++;
        giorno.secondi += s;
        break;
      }
      case 'azione':
        conta(giorno.azioni, String(e.nome || ''), 1);
        break;
      case 'negato':
        conta(giorno.negati, String(e.nome || ''), 1);
        break;
    }
  }

  function giornoVuoto(data) {
    return { giorno: data, accessi: 0, avvii: 0, secondi: 0, viste: {}, azioni: {}, negati: {},
      dispositivi: {}, lingue: {}, ore: {}, versione: '', ultimo: 0 };
  }

  async function registraAccesso(db, id) {
    const oggi = new Date(orologio()).toISOString().slice(0, 10);
    await db.aggiorna(['stat', id, oggi], g => {
      g = g || giornoVuoto(oggi);
      g.accessi++;
      g.ultimo = orologio();
      return g;
    }, STATISTICHE_GIORNI_MS);
  }

  async function registraEventi(db, id, eventi) {
    const perGiorno = new Map();
    for (const e of eventi.slice(0, EVENTI_MAX_PER_INVIO)) {
      if (!e || typeof e !== 'object') continue;
      const giorno = GIORNO_VALIDO.test(e.giorno || '') ? e.giorno : new Date(orologio()).toISOString().slice(0, 10);
      // Un giorno nel futuro o di oltre un anno fa e' un orologio sbagliato
      const t = Date.parse(giorno + 'T12:00:00Z');
      if (!Number.isFinite(t) || t > orologio() + 2 * 86400000 || t < orologio() - 366 * 86400000) continue;
      if (!perGiorno.has(giorno)) perGiorno.set(giorno, []);
      perGiorno.get(giorno).push(e);
    }
    let contati = 0;
    for (const [giorno, lista] of perGiorno) {
      await db.aggiorna(['stat', id, giorno], g => {
        g = g || giornoVuoto(giorno);
        for (const e of lista) sommaEvento(g, e);
        g.ultimo = orologio();
        return g;
      }, STATISTICHE_GIORNI_MS);
      contati += lista.length;
    }
    return contati;
  }

  async function statistiche(db, id, giorni) {
    const da = new Date(orologio() - (giorni - 1) * 86400000).toISOString().slice(0, 10);
    // Fino a dopodomani: il giorno lo scrive il telefono, nel suo fuso
    const a = new Date(orologio() + 2 * 86400000).toISOString().slice(0, 10);
    const elenco = (await db.elenca(['stat', id], da, a)).map(v => v.valore);
    const totale = giornoVuoto('');
    delete totale.giorno; delete totale.versione;
    const somma = (a, b) => { for (const k of Object.keys(b)) a[k] = (a[k] || 0) + b[k]; };
    for (const g of elenco) {
      totale.accessi += g.accessi; totale.avvii += g.avvii; totale.secondi += g.secondi;
      for (const [nome, v] of Object.entries(g.viste)) {
        totale.viste[nome] = totale.viste[nome] || { aperture: 0, secondi: 0 };
        totale.viste[nome].aperture += v.aperture; totale.viste[nome].secondi += v.secondi;
      }
      somma(totale.azioni, g.azioni); somma(totale.negati, g.negati || {});
      somma(totale.dispositivi, g.dispositivi); somma(totale.lingue, g.lingue); somma(totale.ore, g.ore || {});
      totale.ultimo = Math.max(totale.ultimo, g.ultimo || 0);
    }
    return {
      giorni, giorniAttivi: elenco.filter(g => g.avvii || g.accessi || g.secondi).length,
      totale,
      perGiorno: elenco.map(g => ({ giorno: g.giorno, secondi: g.secondi, avvii: g.avvii, accessi: g.accessi })),
      versione: elenco.length ? elenco[elenco.length - 1].versione : ''
    };
  }

  async function adminRimasti(db, tranne) {
    return (await db.elenca(['utente'])).filter(v => v.valore.ruolo === 'admin' && v.valore.attivo !== false && v.valore.id !== tranne).length;
  }

  // --- Le risposte --------------------------------------------------------
  async function gestisci(richiesta, envPiattaforma, info) {
    const env = leggiAmbiente(envPiattaforma);
    const h = intestazioni(richiesta, env);
    const json = (dati, stato = 200) => new Response(JSON.stringify(dati), {
      status: stato, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, h)
    });
    const errore = (codice, stato, extra) => json(Object.assign({ errore: codice }, extra || {}), stato);

    if (!originePermessa(richiesta.headers.get('Origin'), env)) return errore('origine', 403);
    if (richiesta.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    const url = new URL(richiesta.url);
    const via = url.pathname.replace(/\/+$/, '');
    if (via === '' || via === '/') {
      return json({ servizio: 'controllo accessi di AstroCalendarBen', versione: VERSIONE_SERVIZIO,
        percorsi: ['/api/accessi/stato', '/api/accessi/entra', '/api/accessi/sessione', '/api/accessi/esci'] });
    }
    if (!via.startsWith('/api/accessi/')) return errore('percorso', 404);

    const db = await archivio(env);
    if (via === '/api/accessi/stato') {
      return json({ servizio: 'accessi', versione: VERSIONE_SERVIZIO, pronto: !!db,
        archivio: db ? db.tipo : 'nessuno',
        adminDaVariabili: !!(nomeUtente(env.ACCESSI_ADMIN_UTENTE) && passwordValida(env.ACCESSI_ADMIN_PASSWORD)) });
    }
    if (!db) return errore('archivio', 503);
    try { await avvia(env, db); } catch (_) { return errore('archivio', 503); }

    let corpo = null;
    if (richiesta.method === 'POST' || richiesta.method === 'PATCH') {
      const testo = await richiesta.text();
      if (testo.length > CORPO_MAX_BYTE) return errore('troppo', 413);
      try { corpo = testo ? JSON.parse(testo) : {}; } catch (_) { return errore('corpo', 400); }
      if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return errore('corpo', 400);
    }

    // --- Entrare ---
    if (via === '/api/accessi/entra' && richiesta.method === 'POST') {
      const id = nomeUtente(corpo.utente);
      const password = typeof corpo.password === 'string' ? corpo.password : '';
      const indirizzo = (info && info.remoteAddr && info.remoteAddr.hostname) ||
        (richiesta.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'ignoto';
      const chiaveIndirizzo = ['indirizzo', indirizzo];
      const chiaveUtente = ['utente', id || '?'];
      if (await bloccato(db, chiaveIndirizzo, TENTATIVI_INDIRIZZO) || (id && await bloccato(db, chiaveUtente, TENTATIVI_UTENTE))) {
        return errore('bloccato', 429, { minuti: Math.round(FINESTRA_TENTATIVI_MS / 60000) });
      }
      const u = id ? await db.leggi(['utente', id]) : null;
      const giusto = u
        ? uguali(await derivaPassword(password, u.sale, u.giri || ITERAZIONI_PBKDF2), u.hash)
        : (await derivaPassword(password, SALE_FINTO, ITERAZIONI_PBKDF2), false);
      if (!giusto || password.length > PASSWORD_MAX) {
        await segnaFallito(db, chiaveIndirizzo);
        if (id) await segnaFallito(db, chiaveUtente);
        return errore('credenziali', 401);
      }
      if (u.attivo === false) return errore('disattivato', 403);
      await db.cancella(['tentativi'].concat(chiaveUtente));
      const gettone = base64url(casuale(32));
      const imp = await impronta(gettone);
      const scade = orologio() + durataMs(env);
      await db.scrivi(['sessione', imp], {
        utente: id, creata: orologio(), scade, ultimoUso: orologio(),
        dispositivo: testoBreve(corpo.dispositivo, 80)
      }, durataMs(env));
      await db.scrivi(['sessioni_utente', id, imp], true, durataMs(env));
      await db.aggiorna(['utente', id], v => v ? Object.assign(v, { ultimoAccesso: orologio() }) : undefined);
      await registraAccesso(db, id);
      return json({ gettone, scade, profilo: profilo(u) });
    }

    // Da qui in poi serve una sessione
    const chi = await sessione(db, gettoneDa(richiesta, corpo), env, via === '/api/accessi/sessione');
    if (!chi) return errore('sessione', 401);
    const io = chi.u;

    if (via === '/api/accessi/sessione' && richiesta.method === 'GET') {
      return json({ scade: chi.s.scade, profilo: profilo(io) });
    }
    if (via === '/api/accessi/esci' && richiesta.method === 'POST') {
      await db.cancella(chi.chiave);
      await db.cancella(['sessioni_utente', io.id, chi.chiave[1]]);
      return json({ ok: true });
    }
    if (via === '/api/accessi/eventi' && richiesta.method === 'POST') {
      const eventi = Array.isArray(corpo.eventi) ? corpo.eventi : [];
      // Ogni pacchetto ha il suo nome, e un pacchetto già contato non si
      // riconta. Succede davvero: quello mandato con `keepalive` mentre la
      // pagina si chiude arriva qui, ma alla pagina torna un errore, e lei lo
      // rimanda all'apertura dopo. Misurato nella prova: tre «YouTube negato»
      // per due tocchi.
      const lotto = typeof corpo.lotto === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(corpo.lotto) ? corpo.lotto : '';
      if (lotto && !(await db.creaSeManca(['lotto', io.id, lotto], orologio(), LOTTI_MS))) {
        return json({ ok: true, contati: 0, doppio: true });
      }
      return json({ ok: true, contati: await registraEventi(db, io.id, eventi) });
    }
    if (via === '/api/accessi/password' && richiesta.method === 'POST') {
      const giusta = uguali(await derivaPassword(String(corpo.vecchia || ''), io.sale, io.giri || ITERAZIONI_PBKDF2), io.hash);
      if (!giusta) return errore('credenziali', 401);
      if (!passwordValida(corpo.nuova)) return errore('password', 400, { min: PASSWORD_MIN });
      const p = await nuovaPassword(corpo.nuova);
      await db.aggiorna(['utente', io.id], v => Object.assign(v, p, { modificato: orologio() }));
      return json({ ok: true });
    }

    // --- Amministrazione ---
    if (!via.startsWith('/api/accessi/utenti')) return errore('percorso', 404);
    if (io.ruolo !== 'admin') return errore('permesso', 403);
    const pezzi = via.split('/').slice(3); // ['utenti', id?, 'statistiche'|'sessioni'?]
    const bersaglio = pezzi[1] ? nomeUtente(decodeURIComponent(pezzi[1])) : '';

    if (pezzi.length === 1 && richiesta.method === 'GET') {
      const giorni = Math.max(1, Math.min(365, Number(url.searchParams.get('giorni')) || 30));
      const utenti = [];
      for (const v of await db.elenca(['utente'])) {
        const s = await statistiche(db, v.valore.id, giorni);
        utenti.push(Object.assign(schedaAdmin(v.valore), {
          riassunto: { giorniAttivi: s.giorniAttivi, secondi: s.totale.secondi, avvii: s.totale.avvii,
            accessi: s.totale.accessi, ultimo: s.totale.ultimo }
        }));
      }
      return json({ utenti, giorni });
    }
    if (pezzi.length === 1 && richiesta.method === 'POST') {
      const id = nomeUtente(corpo.utente);
      if (!id) return errore('utente', 400);
      if (!passwordValida(corpo.password)) return errore('password', 400, { min: PASSWORD_MIN });
      if (await db.leggi(['utente', id])) return errore('esiste', 409);
      const funzioni = elencoFunzioni(corpo.funzioni) || [];
      const p = await nuovaPassword(corpo.password);
      const u = { id, nome: testoBreve(corpo.nome, 80) || id, ruolo: RUOLI.includes(corpo.ruolo) ? corpo.ruolo : 'utente',
        funzioni, attivo: corpo.attivo !== false, note: testoBreve(corpo.note, 300),
        sale: p.sale, giri: p.giri, hash: p.hash, creato: orologio(), modificato: orologio() };
      await db.scrivi(['utente', id], u);
      return json({ utente: schedaAdmin(u) }, 201);
    }
    if (!bersaglio) return errore('utente', 400);
    const u = await db.leggi(['utente', bersaglio]);
    if (!u) return errore('nessuno', 404);

    if (pezzi.length === 2 && richiesta.method === 'PATCH') {
      const cambi = {};
      if ('nome' in corpo) cambi.nome = testoBreve(corpo.nome, 80) || u.id;
      if ('note' in corpo) cambi.note = testoBreve(corpo.note, 300);
      if ('funzioni' in corpo) {
        const f = elencoFunzioni(corpo.funzioni);
        if (!f) return errore('funzioni', 400);
        cambi.funzioni = f;
      }
      if ('ruolo' in corpo) {
        if (!RUOLI.includes(corpo.ruolo)) return errore('ruolo', 400);
        cambi.ruolo = corpo.ruolo;
      }
      if ('attivo' in corpo) cambi.attivo = corpo.attivo !== false;
      // Non si resta senza amministratori: ne serve sempre uno attivo
      const perdeAdmin = u.ruolo === 'admin' && u.attivo !== false &&
        ((cambi.ruolo && cambi.ruolo !== 'admin') || cambi.attivo === false);
      if (perdeAdmin && await adminRimasti(db, u.id) === 0) return errore('ultimoAdmin', 409);
      if ('password' in corpo && corpo.password) {
        if (!passwordValida(corpo.password)) return errore('password', 400, { min: PASSWORD_MIN });
        Object.assign(cambi, await nuovaPassword(corpo.password));
      }
      const nuovo = await db.aggiorna(['utente', u.id], v => Object.assign(v, cambi, { modificato: orologio() }));
      // Una password nuova o un utente spento: fuori da tutti i dispositivi
      if (cambi.hash || cambi.attivo === false) await revocaTutte(db, u.id);
      return json({ utente: schedaAdmin(nuovo) });
    }
    if (pezzi.length === 2 && richiesta.method === 'DELETE') {
      if (u.id === io.id) return errore('sestesso', 409);
      if (u.ruolo === 'admin' && await adminRimasti(db, u.id) === 0) return errore('ultimoAdmin', 409);
      await revocaTutte(db, u.id);
      for (const v of await db.elenca(['stat', u.id])) await db.cancella(v.chiave);
      await db.cancella(['utente', u.id]);
      return json({ ok: true });
    }
    if (pezzi.length === 3 && pezzi[2] === 'statistiche' && richiesta.method === 'GET') {
      const giorni = Math.max(1, Math.min(365, Number(url.searchParams.get('giorni')) || 30));
      const sessioni = [];
      for (const v of await db.elenca(['sessioni_utente', u.id])) {
        const s = await db.leggi(['sessione', v.chiave[2]]);
        if (s && s.scade > orologio()) sessioni.push({ creata: s.creata, ultimoUso: s.ultimoUso, dispositivo: s.dispositivo || '' });
      }
      return json({ utente: schedaAdmin(u), statistiche: await statistiche(db, u.id, giorni), sessioni });
    }
    if (pezzi.length === 3 && pezzi[2] === 'sessioni' && richiesta.method === 'DELETE') {
      await revocaTutte(db, u.id);
      return json({ ok: true });
    }
    return errore('percorso', 404);
  }

  return {
    async fetch(richiesta, env, info) {
      try { return await gestisci(richiesta, env, info); }
      catch (_) {
        return new Response(JSON.stringify({ errore: 'interno' }), { status: 500,
          headers: Object.assign({ 'Content-Type': 'application/json' }, intestazioni(richiesta, leggiAmbiente(env))) });
      }
    }
  };
}

const servizio = creaServizio();
export default servizio;
export { creaServizio, archivioMemoria };

// Deno Deploy: come in `worker-adsb.js`, si avvia anche a mano. `info` porta
// l'indirizzo di chi chiama, che serve a contare i tentativi sbagliati.
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  try { Deno.serve((richiesta, info) => servizio.fetch(richiesta, undefined, info)); }
  catch (_) { /* la piattaforma sta gia' usando l'export */ }
}
