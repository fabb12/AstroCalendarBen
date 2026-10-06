#!/usr/bin/env node
/* Le voci registrate dei personaggi delle Storie cosmiche.
 *
 *   node scripts/voci-storie.js                  # legge le cartelle, aggiorna manifest e copione
 *   node scripts/voci-storie.js --controlla      # come sopra, ma non scrive: esce con 1 se c'è da fare
 *   node scripts/voci-storie.js --genera luna    # genera con ElevenLabs le battute che mancano alla Luna
 *        [--lingua en] [--rifai] [--prova]       #   --rifai le rifà tutte, --prova dice cosa farebbe
 *
 * L'idea è che cambiare la voce di un personaggio sia un lavoro di cartelle,
 * non di codice: ogni personaggio ha la sua, `audio/narrazione/storie/<nome>/<lingua>/`,
 * e dentro ci sono le sue battute con il nome che il copione gli dà
 * (`storia_luna-1.mp3`). Si genera la voce dove si vuole (ElevenLabs, un
 * microfono), si salva col nome giusto nella cartella giusta, e si lancia
 * questo script: scrive da solo le righe del manifest fra i due segnalibri
 * (`INIZIO`/`FINE` qui sotto), con l'impronta del testo, e riscrive
 * `COPIONE.md` — l'elenco, personaggio per personaggio, di cosa dice, come si
 * deve chiamare il file e se c'è già. Togliere una voce = togliere i file: quelle
 * battute tornano alla sintesi vocale.
 *
 * Chi parla lo dicono le storie stesse (`character_speak` in
 * `demo-predefiniti.js`): il copione si rifà da solo quando si aggiunge una
 * battuta o una storia, e il nome del file basta a sapere a quale battuta
 * appartiene — la cartella serve a chi lavora, non all'app.
 *
 * Le storie fatte nello **Studio delle storie** hanno le battute scritte da
 * chi le crea, non nei dizionari: lo Studio le mette in
 * `storie/storie-studio.json` (v421) a ogni «Salva» e «Elimina». Qui
 * diventano battute come le altre (`studio.<storia>.<n>`, file
 * `<storia>-<n>.mp3`, il testo scritto nel manifest perché la narrazione le
 * riconosca dal testo), con una regia di partenza presa dalla faccia del
 * momento; e quello che dal file è sparito si toglie: la regia, le righe
 * del manifest e gli audio `studio_*` che non sono più di nessuno.
 *
 * L'impronta: un file nuovo (o cambiato: lo dice la `firma`, l'impronta dei
 * suoi byte) si dà per registrato sul testo di adesso, perché è quello che il
 * copione mostrava. Un file che non è cambiato tiene l'impronta che aveva:
 * se intanto il testo della battuta è cambiato, la narrazione smette di
 * suonarlo e il copione lo segna «da rifare» — una voce che dice una frase
 * diversa da quella scritta sotto è peggio della sintesi. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const RADICE = path.resolve(__dirname, '..');
const MANIFEST = 'audio/narrazione/manifest.js';
const CARTELLA = 'storie';                       // dentro alla radice del manifest
const COPIONE = 'audio/narrazione/storie/COPIONE.md';
const CONFIG_ELEVEN = 'audio/narrazione/storie/voci-elevenlabs.json';
const REGIA = 'audio/narrazione/storie/regia-voci.json';
const STUDIO = 'audio/narrazione/storie/storie-studio.json';
const STUDIO_CHIAVE = /^studio_[a-z0-9_]{1,40}$/;   // la stessa di `STUDIO_VOCE_CHIAVE` (storie-studio.js)
// La faccia di un momento dello Studio → il tag audio di ElevenLabs v3 con
// cui comincia la sua battuta (la regia di partenza; poi si cambia a mano)
const TAG_UMORE = {
  happy: 'happy', surprised: 'surprised', worried: 'nervous', sad: 'sad', thinking: 'thoughtful',
  excited: 'excited', sleepy: 'sleepy', laughing: 'laughs', love: 'warmly', angry: 'angry',
  annoyed: 'annoyed', bully: 'mischievously'
};
const INIZIO = '// ── INIZIO STORIE COSMICHE: da qui a FINE lo scrive scripts/voci-storie.js, non toccare ──';
const FINE = '// ── FINE STORIE COSMICHE ──';
const ESTENSIONI = /\.(mp3|ogg|oga|opus|m4a|aac|wav|webm)$/i;
const LINGUE = ['it', 'en'];
// Il nome di un file di battuta: `storia_luna-1.mp3` (o l'ID intero,
// `demo.narr.storia_luna.1.mp3`, per chi copia la chiave dal dizionario).
const NOME_FILE = /^(?:demo\.narr\.)?([a-z][\w]*?)[-.](\d+)\.[a-z0-9]+$/i;

const leggi = f => fs.readFileSync(path.join(RADICE, f), 'utf8');

// --- Il mondo che serve: dizionari, storie, nomi dei personaggi ---------

function normalizza(s) { return String(s == null ? '' : s).replace(/­/g, '').replace(/\s+/g, ' ').trim(); }
// La stessa impronta di `narrImpronta` (FNV-1a sul testo normalizzato).
function impronta(testo) {
  let h = 0x811c9dc5;
  const s = normalizza(testo);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const firmaDi = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
// «Sagittario A*» → `sagittario-a`: la cartella di un personaggio è il suo
// nome italiano, che è quello che chi lavora ha in testa.
const cartellaDi = nome => normalizza(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'senza-nome';

let mondo = null;
let app = null;
const sorgenteApp = () => app || (app = leggi('app.js'));
function carica() {
  if (mondo) return mondo;
  const ctx = { window: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['lingue/it.js', 'lingue/en.js']) vm.runInContext(leggi(f), ctx);
  const dizionari = ctx.window.ASTRO_DIZIONARI;
  // Il modulo delle storie, per sapere chi è chi e come si chiama. Gli
  // basta un `astroI18n` finto che legge i dizionari veri.
  let lingua = 'it';
  const prima = globalThis.astroI18n;
  globalThis.astroI18n = {
    esiste: k => typeof dizionari[lingua].messaggi[k] === 'string',
    t: k => String(dizionari[lingua].messaggi[k] || k)
  };
  const S = require('../storie-cosmiche.js');
  const nomeDi = (id, l) => {
    lingua = l;
    const p = S.STOR_PERSONAGGI[id];
    if (p && p.nome && dizionari[l].messaggi[p.nome]) return dizionari[l].messaggi[p.nome];
    const diz = dizionari[l].messaggi['corpo.' + id] || dizionari[l].messaggi['storie.nome.' + id];
    if (diz) return diz;
    // Le sonde hanno il nome solo nelle tabelle di `app.js` (SOL_SONDE)
    const tabella = new RegExp(`id: '${id}', nome: '([^']+)'`).exec(sorgenteApp());
    return tabella ? tabella[1] : id;
  };
  const { analizza } = require('../demo-motore.js');
  const predefiniti = require('../demo-predefiniti.js');

  // Le battute, nell'ordine delle storie
  const battute = [];
  const personaggi = new Map();
  for (const d of predefiniti.filter(x => x.storia)) {
    const scene = analizza(d.testo).scene;
    const dellaStoria = [];
    scene.forEach((s, i) => {
      for (const a of s.azioni) {
        if (a.comando !== 'character_speak' || typeof a.parametri.id !== 'string') continue;
        const id = a.parametri.id;
        const m = /^demo\.narr\.([\w]+)\.(\d+)$/.exec(id);
        if (!m) continue;
        const chi = S.canonico(a.parametri.target);
        if (!personaggi.has(chi)) {
          const nomi = {};
          for (const l of LINGUE) nomi[l] = nomeDi(chi, l);
          personaggi.set(chi, { id: chi, nomi, cartella: cartellaDi(nomi.it), battute: [] });
        }
        const testi = {};
        for (const l of LINGUE) testi[l] = dizionari[l].messaggi[id];
        const b = { id, storia: d.chiave, n: Number(m[2]), scena: i + 1, durata: s.durata, chi, testi,
          base: `${m[1]}-${m[2]}` };
        battute.push(b); dellaStoria.push(b);
        personaggi.get(chi).battute.push(b);
      }
    });
    dellaStoria.forEach((b, i) => { b.prima = dellaStoria[i - 1] || null; b.dopo = dellaStoria[i + 1] || null; });
  }
  const titoli = {};
  for (const d of predefiniti.filter(x => x.storia))
    titoli[d.chiave] = String(dizionari.it.messaggi[`demo.builtin.${d.chiave}.title`] || d.chiave).replace(/^Storie cosmiche · /, '');
  for (const b of battute) b.lingue = LINGUE;

  // Le storie dello Studio, dal file che lo Studio scrive
  const erroriStudio = [];
  for (const st of leggiStudio(erroriStudio)) {
    titoli[st.chiave] = st.titolo || st.chiave;
    const dellaStoria = [];
    for (const x of st.battute) {
      const chi = S.canonico(x.chi);
      if (!S.STOR_PERSONAGGI[chi]) { erroriStudio.push(`${STUDIO}: ${st.chiave}, battuta ${x.n}: «${x.chi}» non è un personaggio`); continue; }
      if (!personaggi.has(chi)) {
        const nomi = {};
        for (const l of LINGUE) nomi[l] = nomeDi(chi, l);
        personaggi.set(chi, { id: chi, nomi, cartella: cartellaDi(nomi.it), battute: [] });
      }
      const b = { id: `studio.${st.chiave}.${x.n}`, storia: st.chiave, n: x.n, scena: x.scena, durata: x.durata, chi,
        testi: { [st.lingua]: x.testo }, lingue: [st.lingua], base: `${st.chiave}-${x.n}`, studio: true, umore: x.umore };
      battute.push(b); dellaStoria.push(b);
      personaggi.get(chi).battute.push(b);
    }
    dellaStoria.forEach((b, i) => { b.prima = dellaStoria[i - 1] || null; b.dopo = dellaStoria[i + 1] || null; });
  }
  if (prima === undefined) delete globalThis.astroI18n; else globalThis.astroI18n = prima;
  // Un personaggio rimasto senza battute (le sue erano tutte in una storia
  // dello Studio cancellata) non sta nel copione
  for (const [id, p] of personaggi) if (!p.battute.length) personaggi.delete(id);

  // La regia: il carattere di ogni voce e, per ogni battuta, l'emozione, come
  // dirla e il testo con i tag audio di ElevenLabs v3. Il file è facoltativo.
  const testoRegia = fs.existsSync(path.join(RADICE, REGIA)) ? leggi(REGIA) : '';
  const regia = testoRegia ? JSON.parse(testoRegia) : {};
  const regiaNuova = regiaDelloStudio(regia, battute, l => dizionari.it.messaggi['storie.espressione.' + l]);
  const testoRegiaNuovo = JSON.stringify(regiaNuova, null, 2) + '\n';
  mondo = { dizionari, battute, personaggi, titoli, regia: regiaNuova, erroriStudio,
    // `regiaDelloStudio` dà lo stesso oggetto se non c'è niente da cambiare:
    // il file scritto a mano non si riformatta per niente
    testoRegia: testoRegiaNuovo, cambiaRegia: regiaNuova !== regia,
    perId: new Map(battute.map(b => [b.id, b])), perBase: new Map(battute.map(b => [b.base, b])) };
  return mondo;
}

function leggiManifest() {
  const ctx = {};
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const testo = leggi(MANIFEST);
  vm.runInContext(testo, ctx);
  return { testo, manifest: ctx.ASTRO_NARRAZIONE_MANIFEST };
}

/* Il file dello Studio: le storie, ognuna con la lingua in cui è scritta e
 * le sue battute. I suoi errori sono errori del giro, che allora non scrive
 * niente: con un file rotto le battute dello Studio sembrerebbero sparite, e
 * i loro audio si cancellerebbero. */
function leggiStudio(errori) {
  if (!fs.existsSync(path.join(RADICE, STUDIO))) return [];
  let dati;
  try { dati = JSON.parse(leggi(STUDIO)); } catch (e) { errori.push(`${STUDIO}: non è JSON valido (${e.message})`); return []; }
  const storie = [], viste = new Set();
  for (const st of Array.isArray(dati && dati.storie) ? dati.storie : []) {
    if (!st || !STUDIO_CHIAVE.test(st.chiave)) { errori.push(`${STUDIO}: una storia ha un nome non valido («${st && st.chiave}»)`); continue; }
    if (viste.has(st.chiave)) { errori.push(`${STUDIO}: la storia ${st.chiave} c'è due volte`); continue; }
    viste.add(st.chiave);
    const lingua = LINGUE.includes(st.lingua) ? st.lingua : 'it';
    const numeri = new Set(), battute = [];
    for (const x of Array.isArray(st.battute) ? st.battute : []) {
      const n = x && Number(x.n);
      const testo = normalizza(x && x.testo);
      if (!Number.isInteger(n) || n < 1 || numeri.has(n)) { errori.push(`${STUDIO}: ${st.chiave}, numero di battuta non valido o doppio (${x && x.n})`); continue; }
      if (!testo || testo.length > 400) { errori.push(`${STUDIO}: ${st.chiave}, battuta ${n}: testo vuoto o più lungo di 400 caratteri`); continue; }
      numeri.add(n);
      battute.push({ n, chi: String(x.chi || ''), testo, umore: String(x.umore || ''),
        scena: Number(x.scena) || 0, durata: Math.max(1000, Number(x.durata) || 0) });
    }
    storie.push({ chiave: st.chiave, titolo: normalizza(st.titolo).slice(0, 120), lingua, battute });
  }
  return storie;
}

/* La regia delle battute dello Studio: a una battuta nuova (o il cui testo
 * è cambiato) la faccia del momento dà l'emozione e il tag di partenza; una
 * regia che torna ancora col testo resta com'è (chi l'ha ritoccata a mano
 * non la perde); quella delle battute che non ci sono più si toglie. Le
 * storie pronte non si toccano: la loro regia è scritta a mano. */
function regiaDelloStudio(regia, battute, nomeEmozione) {
  const vecchie = regia.battute || {};
  const dello = new Map(battute.filter(b => b.studio).map(b => [b.id, b]));
  const nuove = {};
  let cambia = false;
  for (const [id, r] of Object.entries(vecchie)) {
    if (/^studio\./.test(id) && !dello.has(id)) { cambia = true; continue; }
    nuove[id] = r;
  }
  for (const b of dello.values()) {
    const l = b.lingue[0];
    const r = nuove[b.id];
    const conTag = r && r.conTag && typeof r.conTag[l] === 'string' ? normalizza(r.conTag[l]) : '';
    if (conTag && senzaTag(conTag) === normalizza(b.testi[l])) continue;
    const tag = TAG_UMORE[b.umore];
    nuove[b.id] = {
      emozione: String(nomeEmozione(b.umore) || '').toLowerCase(),
      come: (r && r.come) || '',
      conTag: { [l]: (tag ? `[${tag}] ` : '') + normalizza(b.testi[l]) }
    };
    cambia = true;
  }
  if (!cambia) return regia;
  return Object.assign({}, regia, { battute: nuove });
}

// --- La regia delle battute -------------------------------------------
// `[excited] Ciao!` → `Ciao!`: tolti i tag deve restare il testo del dizionario,
// se no la regia è rimasta indietro e si usa il testo nudo (con un avviso).
const senzaTag = s => normalizza(String(s || '').replace(/\[[^\]]*\]/g, ' ')).replace(/\s+([,.;:!?…])/g, '$1');
function regiaDi(b, lingua) {
  const r = (carica().regia.battute || {})[b.id] || null;
  const conTag = r && r.conTag && typeof r.conTag[lingua] === 'string' ? normalizza(r.conTag[lingua]) : '';
  const valida = !!conTag && senzaTag(conTag) === normalizza(b.testi[lingua]);
  return { emozione: r ? r.emozione || '' : '', come: r ? r.come || '' : '', conTag: valida ? conTag : '', vecchia: !!conTag && !valida };
}

// --- La durata di un MP3, per avvisare se una battuta non sta nella scena --
// Basta il primo fotogramma (bitrate) e, per i VBR, l'intestazione Xing/Info
// col numero di fotogrammi. ElevenLabs dà MP3 a bitrate costante. Per gli
// altri formati la durata resta ignota e il controllo si salta.
const BITRATE_M1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATE_M2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const CAMPIONI = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function durataMp3(buf) {
  let i = 0;
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'ID3')
    i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  for (; i < buf.length - 4; i++) if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) break;
  if (i >= buf.length - 4) return null;
  const versione = (buf[i + 1] >> 3) & 3, strato = (buf[i + 1] >> 1) & 3;
  const kbps = (versione === 3 ? BITRATE_M1L3 : BITRATE_M2L3)[buf[i + 2] >> 4];
  const hz = (CAMPIONI[versione] || [])[(buf[i + 2] >> 2) & 3];
  if (strato !== 1 || !kbps || !hz) return null;
  const mono = (buf[i + 3] >> 6) === 3;
  const campioniPerFotogramma = versione === 3 ? 1152 : 576;
  const lato = versione === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
  const xing = i + 4 + lato;
  const tag = buf.toString('latin1', xing, xing + 4);
  if ((tag === 'Xing' || tag === 'Info') && (buf.readUInt32BE(xing + 4) & 1))
    return buf.readUInt32BE(xing + 8) * campioniPerFotogramma / hz;
  return (buf.length - i) * 8 / (kbps * 1000);
}

// --- Le cartelle ----------------------------------------------------------

function scansiona() {
  const { manifest } = leggiManifest();
  const base = path.join(RADICE, manifest.radice, CARTELLA);
  const trovati = [];
  if (!fs.existsSync(base)) return trovati;
  for (const cartella of fs.readdirSync(base).sort()) {
    const dir = path.join(base, cartella);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const lingua of fs.readdirSync(dir).sort()) {
      const sotto = path.join(dir, lingua);
      if (!fs.statSync(sotto).isDirectory()) continue;
      for (const nome of fs.readdirSync(sotto).sort()) {
        if (!ESTENSIONI.test(nome)) continue;
        const buf = fs.readFileSync(path.join(sotto, nome));
        trovati.push({ cartella, lingua, nome, file: `${CARTELLA}/${cartella}/${lingua}/${nome}`, buf });
      }
    }
  }
  return trovati;
}

/* Il cuore: dalle cartelle al blocco del manifest, con tutto quello che non
 * va. Non scrive niente; lo usa anche `controlla-narrazione.js`. */
function esamina({ fresche = new Set() } = {}) {
  const { battute, personaggi, perId, perBase, erroriStudio } = carica();
  const { testo, manifest } = leggiManifest();
  const errori = erroriStudio.slice(), avvisi = [];
  const orfane = [];                         // audio di battute dello Studio che non ci sono più
  const prima = testo.indexOf(INIZIO), dopo = testo.indexOf(FINE);
  if (prima < 0 || dopo < prima) errori.push(`${MANIFEST}: mancano i segnalibri «INIZIO/FINE STORIE COSMICHE»`);
  const vecchie = manifest.voci || {};
  // Una battuta delle storie scritta a mano fuori dal blocco lo scavalcherebbe
  for (const id of Object.keys(vecchie)) {
    if (!perId.has(id)) continue;
    const dentro = prima >= 0 && dopo > prima && testo.slice(prima, dopo).includes(`'${id}'`);
    if (!dentro) errori.push(`${id}: è nel manifest fuori dal blocco delle storie — toglila di lì, la scrive lo script`);
  }

  const voci = {};                           // id → lingua → { file, impronta, firma, durata }
  for (const f of scansiona()) {
    const m = NOME_FILE.exec(f.nome);
    const b = m && perBase.get(`${m[1]}-${m[2]}`);
    const id = b && b.id;
    // Una battuta dello Studio tolta dalla sua storia (o la storia intera):
    // il suo audio non è più di nessuno, e si cancella
    if (!b && m && STUDIO_CHIAVE.test(m[1])) { orfane.push(f.file); continue; }
    if (!b) { errori.push(`${f.file}: il nome non è una battuta del copione (atteso tipo «storia_luna-1.mp3»)`); continue; }
    if (!LINGUE.includes(f.lingua)) { errori.push(`${f.file}: «${f.lingua}» non è una lingua (it, en)`); continue; }
    const p = personaggi.get(b.chi);
    if (f.cartella !== p.cartella)
      avvisi.push(`${f.file}: la battuta è di ${p.nomi.it}, la cartella giusta è ${CARTELLA}/${p.cartella}/ (suona lo stesso)`);
    if (voci[id] && voci[id][f.lingua]) { errori.push(`${id} [${f.lingua}]: due file, ${voci[id][f.lingua].file} e ${f.file}`); continue; }
    const testoOra = b.testi[f.lingua];
    if (typeof testoOra !== 'string') { errori.push(`${f.file}: la battuta non ha testo in ${f.lingua}`); continue; }
    if (f.buf.length < 64) { errori.push(`${f.file}: troppo piccolo per essere un audio`); continue; }
    const firma = firmaDi(f.buf);
    const v = vecchie[id] && vecchie[id][f.lingua];
    let impr = impronta(testoOra);
    // Lo stesso file di prima tiene la sua impronta; una voce scritta a mano
    // senza firma (prima di questo script) anche, se il file non ha cambiato posto.
    // Quelle appena generate da `--genera` vengono dal testo di adesso per certo.
    const fresca = fresche.has(`${id}|${f.lingua}`);
    if (!fresca && v && typeof v === 'object' && v.impronta && (v.firma ? v.firma === firma : v.file === f.file)) impr = v.impronta;
    const durata = /\.mp3$/i.test(f.nome) ? durataMp3(f.buf) : null;
    (voci[id] = voci[id] || {})[f.lingua] = { file: f.file, impronta: impr, firma, durata };
  }

  // Lo stato di ogni battuta, per il copione e per gli avvisi
  const stati = new Map();
  for (const b of battute) {
    for (const l of b.lingue) {
      const r = regiaDi(b, l);
      if (r.vecchia) avvisi.push(`${b.id} [${l}]: in ${REGIA} il testo coi tag non torna più col dizionario — la regia è da riscrivere (intanto si usa il testo senza tag)`);
      else if (!r.conTag) avvisi.push(`${b.id} [${l}]: nessuna regia in ${REGIA}`);
    }
    const s = {};
    for (const l of LINGUE) {
      if (!b.lingue.includes(l)) { s[l] = { stato: 'non serve' }; continue; }
      const v = voci[b.id] && voci[b.id][l];
      if (!v) { s[l] = { stato: 'manca' }; continue; }
      const vecchia = v.impronta !== impronta(b.testi[l]);
      const lunga = v.durata != null && v.durata * 1000 > b.durata;
      s[l] = { stato: vecchia ? 'da rifare' : lunga ? 'troppo lunga' : 'pronta', v };
      if (vecchia) avvisi.push(`${v.file}: il testo della battuta è cambiato dopo la registrazione — non suona finché non la rifai`);
      if (lunga) avvisi.push(`${v.file}: dura ${v.durata.toFixed(1)} s ma la scena ${b.durata / 1000} s — la fine verrebbe tagliata`);
    }
    stati.set(b.id, s);
  }

  // Il blocco, nell'ordine del copione
  const righe = [INIZIO, ''];
  for (const p of personaggi.values()) {
    const sue = p.battute.filter(b => voci[b.id]);
    if (!sue.length) continue;
    righe.push(`// ${p.nomi.it} — ${CARTELLA}/${p.cartella}/`);
    for (const b of sue) {
      righe.push(`'${b.id}': {`);
      const lingue = LINGUE.filter(l => voci[b.id][l]);
      lingue.forEach((l, i) => {
        const v = voci[b.id][l];
        // Il testo dello Studio non è nel dizionario: lo porta il manifest,
        // e la narrazione riconosce la battuta da quello
        const suo = b.studio ? `, testo: ${JSON.stringify(normalizza(b.testi[l]))}` : '';
        righe.push(`  ${l}: { file: '${v.file}', impronta: '${v.impronta}', firma: '${v.firma}'${suo} }${i < lingue.length - 1 ? ',' : ''}`);
      });
      righe.push('},', '');
    }
  }
  righe.push(FINE);
  const bloccoNuovo = righe.map(r => r ? '    ' + r : '').join('\n').trimStart();
  const bloccoAttuale = prima >= 0 && dopo > prima ? testo.slice(prima, dopo + FINE.length) : '';
  if (carica().cambiaRegia) avvisi.push(`${REGIA}: la regia delle battute dello Studio va aggiornata (lo fa node scripts/voci-storie.js)`);
  for (const f of orfane) avvisi.push(`${f}: la sua battuta non è più in nessuna storia dello Studio — si cancella`);
  return { errori, avvisi, voci, stati, orfane, bloccoNuovo, bloccoAttuale, testo, prima, dopo,
    copione: scriviCopione(stati) };
}

// --- Il copione -------------------------------------------------------------

const secondi = x => (Math.round(x * 10) / 10).toLocaleString('it-IT') + ' s';

function scriviCopione(stati) {
  const { battute, personaggi, titoli } = carica();
  const conta = l => battute.filter(b => stati.get(b.id)[l].stato === 'pronta').length;
  const quante = l => battute.filter(b => b.lingue.includes(l)).length;
  const SEGNO = { pronta: 'pronta', manca: 'manca', 'da rifare': '**da rifare** (il testo è cambiato)', 'troppo lunga': '**troppo lunga**' };
  const o = [];
  o.push('# Il copione delle voci — Storie cosmiche', '');
  o.push('Lo scrive `node scripts/voci-storie.js`: non modificarlo a mano, si rifà a ogni giro.', '');
  o.push('Per dare una voce nuova a un personaggio: genera ogni sua battuta (ElevenLabs o altro),');
  o.push('salvala **col nome scritto qui** nella sua cartella e caricala. Se la carichi dalla pagina');
  o.push('di GitHub, il manifest e questo copione si aggiornano da soli (workflow «Voci delle storie»);');
  o.push('in locale lancia `node scripts/voci-storie.js`.');
  o.push('Istruzioni complete in `audio/narrazione/LEGGIMI.md`.', '');
  o.push('Le battute `studio.…` vengono dalle storie dello Studio (`storie/storie-studio.json`, lo scrive lo Studio:');
  o.push('Altro → File delle voci): se le togli lì, qui spariscono, con la loro regia e i loro audio.', '');
  o.push(`Pronte: **${conta('it')}/${quante('it')}** in italiano · **${conta('en')}/${quante('en')}** in inglese.`, '');
  o.push('| Personaggio | Cartella | Battute | it | en |', '| --- | --- | --- | --- | --- |');
  for (const p of personaggi.values()) {
    const pronte = l => `${p.battute.filter(b => stati.get(b.id)[l].stato === 'pronta').length}/${p.battute.filter(b => b.lingue.includes(l)).length}`;
    o.push(`| ${p.nomi.it} | \`storie/${p.cartella}/\` | ${p.battute.length} | ${pronte('it')} | ${pronte('en')} |`);
  }
  o.push('');
  for (const p of personaggi.values()) {
    o.push(`## ${p.nomi.it}`, '');
    o.push(`Cartella: \`audio/narrazione/storie/${p.cartella}/<lingua>/\` · nel codice \`${p.id}\` · in inglese ${p.nomi.en}`, '');
    const carattere = (carica().regia.personaggi || {})[p.cartella];
    if (carattere) o.push(`**La voce:** ${carattere}`, '');
    for (const l of LINGUE) {
      const sue = p.battute.filter(b => b.lingue.includes(l));
      if (!sue.length) continue;
      o.push(`### ${l === 'it' ? 'Italiano' : 'Inglese'} — \`storie/${p.cartella}/${l}/\``, '');
      for (const b of sue) {
        const s = stati.get(b.id)[l];
        const durata = s.v && s.v.durata != null ? ` · ${secondi(s.v.durata)}` : '';
        const dove = b.studio ? `Studio: ${titoli[b.storia]}` : titoli[b.storia];
        o.push(`- \`${b.base}.mp3\` — ${SEGNO[s.stato]}${durata} · ${dove}, scena ${b.scena} (al massimo ${secondi(b.durata / 1000)})`);
        const r = regiaDi(b, l);
        if (r.emozione || r.come) o.push(`  - **Emozione:** ${r.emozione || '—'} — ${r.come || ''}`);
        o.push(`  - **Testo:** ${normalizza(b.testi[l] || '—')}`);
        if (r.conTag) o.push(`  - **Da incollare su ElevenLabs v3:** \`${r.conTag}\``);
      }
      o.push('');
    }
  }
  return o.join('\n');
}

// --- ElevenLabs ---------------------------------------------------------------

function trovaPersonaggio(nome) {
  const { personaggi } = carica();
  const cerca = cartellaDi(nome);
  for (const p of personaggi.values())
    if (p.cartella === cerca || p.id.toLowerCase() === String(nome).toLowerCase() || cartellaDi(p.nomi.en) === cerca) return p;
  return null;
}

async function genera(nome, { lingua, rifai, prova }) {
  const p = trovaPersonaggio(nome);
  if (!p) throw new Error(`nessun personaggio «${nome}». Quelli delle storie: ${[...carica().personaggi.values()].map(x => x.cartella).join(', ')}`);
  const config = JSON.parse(leggi(CONFIG_ELEVEN));
  const suo = (config.personaggi || {})[p.cartella] || {};
  const voce = (suo.voce && typeof suo.voce === 'object' ? suo.voce[lingua] : suo.voce) || '';
  if (!voce) throw new Error(`manca l'ID della voce di ${p.nomi.it} in ${CONFIG_ELEVEN} (personaggi.${p.cartella}.voce)`);
  const chiave = process.env.ELEVENLABS_API_KEY;
  if (!chiave && !prova) throw new Error('manca ELEVENLABS_API_KEY nell\'ambiente (la chiave non va mai scritta nel repository)');
  const { stati } = esamina();
  const daFare = p.battute.filter(b => b.lingue.includes(lingua) && (rifai || stati.get(b.id)[lingua].stato !== 'pronta'));
  if (!daFare.length) { console.log(`${p.nomi.it} [${lingua}]: tutte le battute sono pronte (--rifai per rifarle).`); return []; }
  const formato = config.formato || 'mp3_44100_128';
  const indirizzo = (process.env.ELEVENLABS_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
  const dir = path.join(RADICE, 'audio/narrazione', CARTELLA, p.cartella, lingua);
  fs.mkdirSync(dir, { recursive: true });
  for (const b of daFare) {
    // Coi modelli v3 i tag ([excited], [whispers]) sono la regia; gli altri
    // modelli li leggerebbero ad alta voce, e lì va il testo nudo.
    const modello = suo.modello || config.modello || 'eleven_v3';
    const v3 = /^eleven_v3/.test(modello);
    const testo = (v3 && regiaDi(b, lingua).conTag) || normalizza(b.testi[lingua]);
    const meta = path.join(dir, b.base + '.mp3');
    console.log(`${prova ? '(prova) ' : ''}${path.relative(RADICE, meta)} ← «${testo.slice(0, 70)}${testo.length > 70 ? '…' : ''}»`);
    if (prova) continue;
    // La battuta di prima e quella dopo aiutano il tono a legarsi al dialogo
    // (solo fuori dal v3, che non le accetta: lì il tono lo danno i tag)
    const corpo = {
      text: testo,
      model_id: modello,
      voice_settings: Object.assign({}, config.impostazioni, suo.impostazioni),
      previous_text: !v3 && b.prima ? normalizza(b.prima.testi[lingua]) : undefined,
      next_text: !v3 && b.dopo ? normalizza(b.dopo.testi[lingua]) : undefined
    };
    const r = await fetch(`${indirizzo}/v1/text-to-speech/${encodeURIComponent(voce)}?output_format=${formato}`, {
      method: 'POST',
      headers: { 'xi-api-key': chiave, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify(corpo)
    });
    if (!r.ok) throw new Error(`ElevenLabs ha risposto ${r.status}: ${(await r.text()).slice(0, 300)}`);
    fs.writeFileSync(meta, Buffer.from(await r.arrayBuffer()));
    // Un vecchio file con un'altra estensione (`.wav` registrato a mano) farebbe doppione
    for (const f of fs.readdirSync(dir)) if (f !== b.base + '.mp3' && f.replace(ESTENSIONI, '') === b.base) fs.unlinkSync(path.join(dir, f));
  }
  return daFare.map(b => `${b.id}|${lingua}`);
}

// --- Il giro --------------------------------------------------------------

function aggiorna({ scrivi, fresche }) {
  const e = esamina({ fresche });
  const cambiaManifest = e.bloccoNuovo !== e.bloccoAttuale && e.prima >= 0;
  const copioneVero = path.join(RADICE, COPIONE);
  const cambiaCopione = !fs.existsSync(copioneVero) || fs.readFileSync(copioneVero, 'utf8') !== e.copione + '\n';
  const { cambiaRegia, testoRegia } = carica();
  if (scrivi && !e.errori.length) {
    if (cambiaRegia) fs.writeFileSync(path.join(RADICE, REGIA), testoRegia);
    // Gli audio delle battute dello Studio che non ci sono più
    for (const f of e.orfane) fs.unlinkSync(path.join(RADICE, 'audio/narrazione', f));
    if (cambiaManifest) fs.writeFileSync(path.join(RADICE, MANIFEST),
      e.testo.slice(0, e.prima) + e.bloccoNuovo + e.testo.slice(e.dopo + FINE.length));
    if (cambiaCopione) { fs.mkdirSync(path.dirname(copioneVero), { recursive: true }); fs.writeFileSync(copioneVero, e.copione + '\n'); }
    // Le cartelle vuote di ogni personaggio, con un `.gitkeep` perché git le
    // tenga: dalla pagina di GitHub si carica solo dentro a una cartella che c'è.
    for (const p of carica().personaggi.values()) for (const l of LINGUE) {
      const dir = path.join(RADICE, 'audio/narrazione', CARTELLA, p.cartella, l);
      fs.mkdirSync(dir, { recursive: true });
      if (!fs.readdirSync(dir).some(f => ESTENSIONI.test(f) || f === '.gitkeep')) fs.writeFileSync(path.join(dir, '.gitkeep'), '');
    }
  }
  return Object.assign(e, { cambiaManifest, cambiaCopione, cambiaRegia });
}

function riassunto(e) {
  const { personaggi } = carica();
  for (const a of e.avvisi) console.log('  avviso   ' + a);
  for (const x of e.errori) console.log('  ERRORE   ' + x);
  console.log('');
  for (const p of personaggi.values()) {
    const quante = l => `${p.battute.filter(b => e.stati.get(b.id)[l].stato === 'pronta').length}/${p.battute.filter(b => b.lingue.includes(l)).length}`;
    console.log(`  ${p.nomi.it.padEnd(24)} storie/${p.cartella.padEnd(24)} it ${quante('it')}  en ${quante('en')}`);
  }
}

if (require.main === module) {
  const arg = process.argv.slice(2);
  const valore = nome => { const i = arg.indexOf(nome); return i >= 0 ? arg[i + 1] : undefined; };
  (async () => {
    let fresche;
    if (arg.includes('--genera')) {
      const lingua = valore('--lingua') || 'it';
      if (!LINGUE.includes(lingua)) throw new Error(`lingua «${lingua}»: valgono ${LINGUE.join(', ')}`);
      const fatte = await genera(valore('--genera') || '', { lingua, rifai: arg.includes('--rifai'), prova: arg.includes('--prova') });
      if (arg.includes('--prova')) return;
      console.log(`\n${fatte.length} battute generate.`);
      fresche = new Set(fatte);
      mondo = null;
    }
    const controlla = arg.includes('--controlla');
    const e = aggiorna({ scrivi: !controlla, fresche });
    riassunto(e);
    if (controlla) {
      if (e.cambiaManifest) e.errori.push('il manifest non corrisponde alle cartelle: lancia node scripts/voci-storie.js');
      if (e.cambiaCopione) e.errori.push('COPIONE.md non è aggiornato: lancia node scripts/voci-storie.js');
      if (e.cambiaRegia) e.errori.push(`${REGIA} non è aggiornata alle storie dello Studio: lancia node scripts/voci-storie.js`);
      if (e.orfane.length) e.errori.push('ci sono audio di battute dello Studio che non esistono più: lancia node scripts/voci-storie.js');
      if (e.cambiaManifest || e.cambiaCopione || e.cambiaRegia || e.orfane.length) console.log('\n  ERRORE   ' + e.errori.slice(-1)[0]);
    } else if (!e.errori.length) {
      console.log(`\n${e.cambiaManifest ? 'Manifest aggiornato' : 'Manifest già a posto'} · ${e.cambiaCopione ? 'copione riscritto' : 'copione già a posto'} (${COPIONE})` +
        `${e.cambiaRegia ? ' · regia dello Studio aggiornata' : ''}${e.orfane.length ? ` · ${e.orfane.length} audio dello Studio cancellati` : ''}.`);
      if (e.cambiaManifest) console.log('Ricorda: CACHE_NAME in sw.js e la versione in config.js, se no chi ha l\'app installata non scarica le voci nuove.');
    }
    process.exit(e.errori.length ? 1 : 0);
  })().catch(err => { console.error('ERRORE: ' + err.message); process.exit(1); });
}

module.exports = { esamina, carica, impronta, durataMp3, cartellaDi, senzaTag, regiaDi, INIZIO, FINE };
