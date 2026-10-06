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
  if (prima === undefined) delete globalThis.astroI18n; else globalThis.astroI18n = prima;

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
  mondo = { dizionari, battute, personaggi, titoli, perId: new Map(battute.map(b => [b.id, b])) };
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
  const { battute, personaggi, perId } = carica();
  const { testo, manifest } = leggiManifest();
  const errori = [], avvisi = [];
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
    const id = m && `demo.narr.${m[1]}.${m[2]}`;
    const b = id && perId.get(id);
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
    const s = {};
    for (const l of LINGUE) {
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
        righe.push(`  ${l}: { file: '${v.file}', impronta: '${v.impronta}', firma: '${v.firma}' }${i < lingue.length - 1 ? ',' : ''}`);
      });
      righe.push('},', '');
    }
  }
  righe.push(FINE);
  const bloccoNuovo = righe.map(r => r ? '    ' + r : '').join('\n').trimStart();
  const bloccoAttuale = prima >= 0 && dopo > prima ? testo.slice(prima, dopo + FINE.length) : '';
  return { errori, avvisi, voci, stati, bloccoNuovo, bloccoAttuale, testo, prima, dopo,
    copione: scriviCopione(stati) };
}

// --- Il copione -------------------------------------------------------------

const secondi = x => (Math.round(x * 10) / 10).toLocaleString('it-IT') + ' s';

function scriviCopione(stati) {
  const { battute, personaggi, titoli } = carica();
  const conta = l => battute.filter(b => stati.get(b.id)[l].stato === 'pronta').length;
  const SEGNO = { pronta: 'pronta', manca: 'manca', 'da rifare': '**da rifare** (il testo è cambiato)', 'troppo lunga': '**troppo lunga**' };
  const o = [];
  o.push('# Il copione delle voci — Storie cosmiche', '');
  o.push('Lo scrive `node scripts/voci-storie.js`: non modificarlo a mano, si rifà a ogni giro.', '');
  o.push('Per dare una voce nuova a un personaggio: genera ogni sua battuta (ElevenLabs o altro),');
  o.push('salvala **col nome scritto qui** nella sua cartella e caricala. Se la carichi dalla pagina');
  o.push('di GitHub, il manifest e questo copione si aggiornano da soli (workflow «Voci delle storie»);');
  o.push('in locale lancia `node scripts/voci-storie.js`.');
  o.push('Istruzioni complete in `audio/narrazione/LEGGIMI.md`.', '');
  o.push(`Pronte: **${conta('it')}/${battute.length}** in italiano · **${conta('en')}/${battute.length}** in inglese.`, '');
  o.push('| Personaggio | Cartella | Battute | it | en |', '| --- | --- | --- | --- | --- |');
  for (const p of personaggi.values()) {
    const pronte = l => p.battute.filter(b => stati.get(b.id)[l].stato === 'pronta').length;
    o.push(`| ${p.nomi.it} | \`storie/${p.cartella}/\` | ${p.battute.length} | ${pronte('it')} | ${pronte('en')} |`);
  }
  o.push('');
  for (const p of personaggi.values()) {
    o.push(`## ${p.nomi.it}`, '');
    o.push(`Cartella: \`audio/narrazione/storie/${p.cartella}/<lingua>/\` · nel codice \`${p.id}\` · in inglese ${p.nomi.en}`, '');
    for (const l of LINGUE) {
      o.push(`### ${l === 'it' ? 'Italiano' : 'Inglese'} — \`storie/${p.cartella}/${l}/\``, '');
      for (const b of p.battute) {
        const s = stati.get(b.id)[l];
        const durata = s.v && s.v.durata != null ? ` · ${secondi(s.v.durata)}` : '';
        o.push(`- \`${b.base}.mp3\` — ${SEGNO[s.stato]}${durata} · ${titoli[b.storia]}, scena ${b.scena} (al massimo ${secondi(b.durata / 1000)})`);
        o.push(`  > ${normalizza(b.testi[l] || '—')}`);
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
  const daFare = p.battute.filter(b => rifai || stati.get(b.id)[lingua].stato !== 'pronta');
  if (!daFare.length) { console.log(`${p.nomi.it} [${lingua}]: tutte le battute sono pronte (--rifai per rifarle).`); return []; }
  const formato = config.formato || 'mp3_44100_128';
  const indirizzo = (process.env.ELEVENLABS_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
  const dir = path.join(RADICE, 'audio/narrazione', CARTELLA, p.cartella, lingua);
  fs.mkdirSync(dir, { recursive: true });
  for (const b of daFare) {
    const testo = normalizza(b.testi[lingua]);
    const meta = path.join(dir, b.base + '.mp3');
    console.log(`${prova ? '(prova) ' : ''}${path.relative(RADICE, meta)} ← «${testo.slice(0, 70)}${testo.length > 70 ? '…' : ''}»`);
    if (prova) continue;
    // La battuta di prima e quella dopo aiutano il tono a legarsi al dialogo
    const corpo = {
      text: testo,
      model_id: suo.modello || config.modello || 'eleven_multilingual_v2',
      voice_settings: Object.assign({}, config.impostazioni, suo.impostazioni),
      previous_text: b.prima ? normalizza(b.prima.testi[lingua]) : undefined,
      next_text: b.dopo ? normalizza(b.dopo.testi[lingua]) : undefined
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
  if (scrivi && !e.errori.length) {
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
  return Object.assign(e, { cambiaManifest, cambiaCopione });
}

function riassunto(e) {
  const { personaggi } = carica();
  for (const a of e.avvisi) console.log('  avviso   ' + a);
  for (const x of e.errori) console.log('  ERRORE   ' + x);
  console.log('');
  for (const p of personaggi.values()) {
    const quante = l => p.battute.filter(b => e.stati.get(b.id)[l].stato === 'pronta').length;
    console.log(`  ${p.nomi.it.padEnd(24)} storie/${p.cartella.padEnd(24)} it ${quante('it')}/${p.battute.length}  en ${quante('en')}/${p.battute.length}`);
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
      if (e.cambiaManifest || e.cambiaCopione) console.log('\n  ERRORE   ' + e.errori.slice(-1)[0]);
    } else if (!e.errori.length) {
      console.log(`\n${e.cambiaManifest ? 'Manifest aggiornato' : 'Manifest già a posto'} · ${e.cambiaCopione ? 'copione riscritto' : 'copione già a posto'} (${COPIONE}).`);
      if (e.cambiaManifest) console.log('Ricorda: CACHE_NAME in sw.js e la versione in config.js, se no chi ha l\'app installata non scarica le voci nuove.');
    }
    process.exit(e.errori.length ? 1 : 0);
  })().catch(err => { console.error('ERRORE: ' + err.message); process.exit(1); });
}

module.exports = { esamina, carica, impronta, durataMp3, cartellaDi, INIZIO, FINE };
