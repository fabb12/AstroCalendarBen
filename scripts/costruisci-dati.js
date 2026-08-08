// Converte i dati di d3-celestial (BSD-3-Clause; a monte Hipparcos/Yale BSC,
// di pubblico dominio) nel formato compatto dell'AstroCalendario.
// Si lancia una volta sola, a mano: i file prodotti finiscono nel repo.
//
//   node costruisci-dati.js /tmp/cel/package/data /home/user/AstroCalendarBen

const fs = require('fs');
const path = require('path');

const SORGENTE = process.argv[2];
const DESTINAZIONE = process.argv[3];

const leggi = n => JSON.parse(fs.readFileSync(path.join(SORGENTE, n), 'utf8'));

// d3-celestial dà la longitudine in gradi fra −180 e +180: l'ascensione retta
// in ore è quella riportata nel giro intero e divisa per quindici.
const raOre = lon => ((lon % 360) + 360) % 360 / 15;
const arr = (n, cifre) => Number(n.toFixed(cifre));

const INTESTAZIONE = (titolo, righe) => `// =====================================================================
// ${titolo}
${righe.map(r => '// ' + r).join('\n')}
//
// Generato da scripts/costruisci-dati.js — non si modifica a mano.
// Fonte: d3-celestial (BSD-3-Clause), a sua volta da Hipparcos, Yale Bright
// Star Catalog e NGC/IC riveduto: cataloghi pubblici, liberamente usabili.
// =====================================================================

`;

// Le stelle che in italiano si chiamano in un altro modo. Sono poche: la
// gran parte dei nomi è araba e non si traduce (Aldebaran, Betelgeuse,
// Altair), ma quelle che i libri italiani chiamano per nome nostro vanno
// dette come le dice chi guarda il cielo qui.
const NOMI_ITALIANI = {
  'Sirius': 'Sirio',
  'Polaris': 'Stella Polare',
  'Arcturus': 'Arturo',
  'Procyon': 'Procione',
  'Castor': 'Castore',
  'Pollux': 'Polluce',
  'Regulus': 'Regolo',
  'Canopus': 'Canopo',
  'Rigil Kentaurus': 'Rigil Kentaurus (α Centauri)',
  'Proxima Centauri': 'Prossima Centauri',
  'Cor Caroli': 'Cuore di Carlo',
  'Alcyone': 'Alcione',
  'Electra': 'Elettra',
  'Maia': 'Maia',
  'Merope': 'Merope',
  'Taygeta': 'Taigete',
  'Asterope': 'Asterope',
  'Celaeno': 'Celeno',
  'Atlas': 'Atlante',
  'Pleione': 'Pleione'
};

// ---------------------------------------------------------------------
// 1. LE STELLE
// ---------------------------------------------------------------------
// Cinquemila stelle non si scrivono come cinquemila oggetti: sarebbero due
// megabyte e mezzo di parentesi graffe. Stanno invece in un unico elenco
// piatto di numeri, quattro per stella — ascensione retta in ore,
// declinazione in gradi, magnitudine, indice di colore B−V — e chi legge fa
// i conti con l'indice. È il formato che pesa meno restando leggibile.
// Il taglio fra i due livelli. Sopra la sesta magnitudine c'è quello che
// un occhio vede; sotto, quello che serve solo a chi ha un cielo di
// montagna o sta ingrandendo forte.
const MAG_PRIMO_LIVELLO = 6.0;
const MAG_SECONDO_LIVELLO = 7.0;

function costruisciStelle() {
  const tutte = leggi('stars.8.json').features
    .filter(s => s.properties.mag <= MAG_SECONDO_LIVELLO);
  const nomi = leggi('starnames.json');

  // Le più luminose davanti: se il disegno deve fermarsi a metà elenco
  // (cielo di città, magnitudine limite bassa) si ferma sulle deboli.
  tutte.sort((a, b) => a.properties.mag - b.properties.mag);

  const stelle = tutte.filter(s => s.properties.mag <= MAG_PRIMO_LIVELLO);
  const deboli = tutte.filter(s => s.properties.mag > MAG_PRIMO_LIVELLO);

  const piatto = [];
  const conNome = [];

  stelle.forEach((s, indice) => {
    const [lon, lat] = s.geometry.coordinates;
    // Quattro decimali di ora sono 0,36 secondi d'arco: mezzo pixel al
    // massimo ingrandimento che l'app consente. Il quinto decimale
    // pesava quattro kilobyte e non lo vede nessuno.
    piatto.push(
      arr(raOre(lon), 4),
      arr(lat, 4),
      arr(s.properties.mag, 2),
      arr(parseFloat(s.properties.bv) || 0, 2)
    );

    // Il nome proprio è quello che la gente cerca ("Vega", non "HIP 91262").
    // Il nome proprio quando c'è, se no la lettera di Bayer.
    //
    // Bayer sì e Flamsteed no, ed è una scelta: «α» vuol dire "la più
    // luminosa della sua costellazione" e chi guarda il cielo lo impara
    // subito, mentre «29 Psc» è solo il numero d'ordine con cui un
    // catalogo del Settecento le ha elencate da ovest a est. Costerebbe
    // altri trenta kilobyte per non dire niente a nessuno, e per una
    // stella senza lettera «Stella di magnitudine 5,1 nei Pesci» è più
    // informativo del suo numero.
    const n = nomi[s.id];
    if (!n) return;
    const proprio = (n.name || '').trim();
    const bayer = (n.bayer || '').trim();
    if (proprio) conNome.push([indice, NOMI_ITALIANI[proprio] || proprio, n.c || '']);
    else if (bayer) conNome.push([indice, `${bayer} ${n.c || ''}`.trim(), n.c || '']);
  });

  // Otto stelle per riga: il file resta apribile in un editor senza che
  // la riga vada a capo per tremila caratteri.
  const inRighe = elenco => {
    const righe = [];
    for (let i = 0; i < elenco.length; i += 32) righe.push('  ' + elenco.slice(i, i + 32).join(','));
    return righe.join(',\n');
  };

  const testo = INTESTAZIONE(
    `CATALOGO STELLARE — ${stelle.length.toLocaleString('it')} stelle fino alla magnitudine ${MAG_PRIMO_LIVELLO.toFixed(1)}`, [
    'Tutte le stelle che un occhio abituato al buio vede da un cielo scuro.',
    'Quante se ne disegnano davvero non lo decide questo file ma il cielo di',
    'chi guarda: la scala di Bortle scelta nelle impostazioni taglia',
    'l\'elenco alla magnitudine che da lì si vede per davvero.',
    '',
    'Formato: un solo elenco piatto, quattro numeri per stella —',
    '  [ascensione retta in ore, declinazione in gradi, magnitudine, B−V]',
    'ordinato dalla più luminosa alla più debole. La stella di indice i sta',
    'quindi alle posizioni 4i, 4i+1, 4i+2, 4i+3.',
    '',
    'B−V è il colore: negativo azzurro (Rigel −0,03), positivo rosso',
    '(Betelgeuse +1,85). Serve a non dipingere un cielo tutto bianco.'
  ]) +
`const CATALOGO_STELLE = [\n${inRighe(piatto)}\n];\n\n` +
`// Le stelle che hanno un nome. [indice nel catalogo, nome, sigla della costellazione]\n` +
`const STELLE_NOMI = [\n${
  conNome.map(([i, n, c]) => `  [${i},${JSON.stringify(n)},${JSON.stringify(c)}]`).join(',\n')
}\n];\n\n` +
`// Quante stelle contiene il primo livello (l'elenco piatto ne ha quattro volte tanti numeri)\n` +
`const CATALOGO_STELLE_QUANTE = ${stelle.length};\n`;

  fs.writeFileSync(path.join(DESTINAZIONE, 'dati-stelle.js'), testo);

  // --- il secondo livello ---
  const piattoDeboli = [];
  deboli.forEach(s => {
    const [lon, lat] = s.geometry.coordinates;
    piattoDeboli.push(arr(raOre(lon), 4), arr(lat, 4),
                      arr(s.properties.mag, 2), arr(parseFloat(s.properties.bv) || 0, 2));
  });

  const testoDeboli = INTESTAZIONE(
    `CATALOGO STELLARE, SECONDO LIVELLO — altre ${deboli.length.toLocaleString('it')} stelle fino alla magnitudine ${MAG_SECONDO_LIVELLO.toFixed(1)}`, [
    'Queste stelle non le vede nessuno a occhio nudo da una città, e questo',
    'file infatti non si scarica quasi mai. Arriva solo a chi serve davvero:',
    'chi ha impostato un cielo di montagna, e chi sta ingrandendo tanto da',
    'guardare il cielo come attraverso un binocolo — perché in tutt\'e due i',
    'casi, senza, il cielo si svuota invece di riempirsi.',
    '',
    'Stesso formato del primo livello, e si accoda: la stella di indice i di',
    'questo file diventa la CATALOGO_STELLE_QUANTE + i del catalogo unito.',
    'Gli indici del primo livello non si spostano, e i nomi restano validi.'
  ]) +
`const CATALOGO_STELLE_DEBOLI = [\n${inRighe(piattoDeboli)}\n];\n\n` +
`const CATALOGO_STELLE_DEBOLI_QUANTE = ${deboli.length};\n`;

  fs.writeFileSync(path.join(DESTINAZIONE, 'dati-stelle-deboli.js'), testoDeboli);

  return {
    primoLivello: `${stelle.length} stelle, ${Math.round(testo.length / 1024)} KB`,
    secondoLivello: `${deboli.length} stelle, ${Math.round(testoDeboli.length / 1024)} KB`,
    nomi: conNome.length
  };
}

// ---------------------------------------------------------------------
// 2. LE COSTELLAZIONI
// ---------------------------------------------------------------------
// Le ottantotto figure ufficiali. Ogni figura è un pugno di spezzate: non
// un disegno chiuso, ma le linee che si tirano davvero col dito in cielo.
function costruisciCostellazioni() {
  const linee = leggi('constellations.lines.json').features;
  const nomi = leggi('constellations.json').features;

  const perSigla = {};
  nomi.forEach(c => { perSigla[c.id] = c.properties; });

  // Le tre parti in cui d3-celestial spezza il Serpente e la Nave Argo
  // tornano una figura sola: in cielo si vedono così.
  const voci = linee.map(f => {
    const p = perSigla[f.id] || {};
    const spezzate = f.geometry.coordinates.map(linea =>
      linea.map(([lon, lat]) => [arr(raOre(lon), 4), arr(lat, 4)])
    );
    return {
      sigla: f.id,
      nome: p.it || p.en || f.id,
      latino: p.la || '',
      rango: Number(p.rank || 3),
      spezzate
    };
  }).filter(v => v.spezzate.length);

  // Le più riconoscibili prima: se lo schermo è piccolo si disegnano quelle.
  voci.sort((a, b) => a.rango - b.rango || a.nome.localeCompare(b.nome));

  const testo = INTESTAZIONE('LE OTTANTOTTO COSTELLAZIONI', [
    'Le figure ufficiali dell\'Unione Astronomica Internazionale, con il nome',
    'italiano. Prima le più note (rango 1: Orione, l\'Orsa Maggiore, il',
    'Cigno), in fondo quelle che quasi nessuno sa additare.',
    '',
    'Ogni figura è un elenco di spezzate, e ogni spezzata un elenco di punti',
    '[ascensione retta in ore, declinazione in gradi]: le linee che si',
    'tirano col dito, non un poligono chiuso. Il Serpente ha due tronconi',
    'staccati perché in cielo è davvero così, tagliato in due da Ofiuco.'
  ]) +
`const COSTELLAZIONI_IAU = [\n${
  voci.map(v =>
    `  { sigla: ${JSON.stringify(v.sigla)}, nome: ${JSON.stringify(v.nome)}, latino: ${JSON.stringify(v.latino)}, rango: ${v.rango},\n` +
    `    spezzate: [${v.spezzate.map(s => '[' + s.map(p => `[${p[0]},${p[1]}]`).join(',') + ']').join(',')}] }`
  ).join(',\n')
}\n];\n`;

  fs.writeFileSync(path.join(DESTINAZIONE, 'dati-costellazioni.js'), testo);
  return { figure: voci.length, kb: Math.round(testo.length / 1024) };
}

// ---------------------------------------------------------------------
// 3. IL CIELO PROFONDO
// ---------------------------------------------------------------------
const TIPI = {
  gc:  { it: 'ammasso globulare', gruppo: 'globulare' },
  oc:  { it: 'ammasso aperto',    gruppo: 'ammasso' },
  pn:  { it: 'nebulosa planetaria', gruppo: 'planetaria' },
  snr: { it: 'resto di supernova', gruppo: 'nebulosa' },
  sfr: { it: 'nebulosa diffusa',   gruppo: 'nebulosa' },
  en:  { it: 'nebulosa a emissione', gruppo: 'nebulosa' },
  rn:  { it: 'nebulosa a riflessione', gruppo: 'nebulosa' },
  dn:  { it: 'nebulosa oscura',    gruppo: 'nebulosa' },
  s:   { it: 'galassia a spirale', gruppo: 'galassia' },
  e:   { it: 'galassia ellittica', gruppo: 'galassia' },
  i:   { it: 'galassia irregolare', gruppo: 'galassia' },
  g:   { it: 'galassia',           gruppo: 'galassia' },
  sd:  { it: 'nube stellare',      gruppo: 'ammasso' },
  pos: { it: 'gruppo di stelle',   gruppo: 'ammasso' },
  ast: { it: 'asterismo',          gruppo: 'ammasso' }
};

// I nomi comuni con cui questi oggetti si chiamano in italiano. Quelli che
// un nome italiano non ce l'hanno restano senza: meglio "M85 — galassia
// ellittica" che un "Whirlpool" in mezzo a una pagina tutta in italiano.
const NOMI_PROFONDO = {
  'M1': 'Nebulosa del Granchio',       'M8': 'Nebulosa Laguna',
  'M13': 'Grande Ammasso di Ercole',   'M16': 'Nebulosa Aquila',
  'M17': 'Nebulosa Omega',             'M20': 'Nebulosa Trifida',
  'M27': 'Nebulosa Manubrio',          'M31': 'Galassia di Andromeda',
  'M33': 'Galassia del Triangolo',     'M42': 'Nebulosa di Orione',
  'M43': 'Nebulosa di De Mairan',      'M44': 'Presepe',
  'M45': 'Pleiadi',                    'M51': 'Galassia Vortice',
  'M57': 'Nebulosa Anello',            'M63': 'Galassia Girasole',
  'M64': 'Galassia Occhio Nero',       'M76': 'Piccolo Manubrio',
  'M81': 'Galassia di Bode',           'M82': 'Galassia Sigaro',
  'M87': 'Galassia Vergine A',         'M97': 'Nebulosa Gufo',
  'M101': 'Galassia Girandola',        'M104': 'Galassia Sombrero',
  'M110': 'Compagna di Andromeda',     'M32': 'Compagna di Andromeda',
  'NGC 869': 'Doppio Ammasso del Perseo', 'NGC 884': 'Doppio Ammasso del Perseo',
  'NGC 7000': 'Nebulosa Nord America', 'NGC 253': 'Galassia dello Scultore',
  'NGC 5128': 'Centaurus A',           'NGC 6960': 'Nebulosa Velo',
  'NGC 6992': 'Nebulosa Velo',         'Mel 25': 'Iadi',
  'Mel 111': 'Chioma di Berenice',     'NGC 752': 'Ammasso di Andromeda',
  'IC 2391': 'Ammasso di Omicron Velorum', 'NGC 2451': 'Ammasso di Puppis',
  'Cr 399': 'Attaccapanni'
};

// "6x4" vuol dire sei primi per quattro; "13" vuol dire tredici tondi.
function misura(dim) {
  if (!dim) return null;
  const pezzi = String(dim).split('x').map(x => parseFloat(x)).filter(x => isFinite(x));
  if (!pezzi.length) return null;
  return { maggiore: pezzi[0], minore: pezzi.length > 1 ? pezzi[1] : pezzi[0] };
}

// La brillanza superficiale, in magnitudini per primo quadrato.
//
// La magnitudine da sola non dice se un oggetto si vede: somma tutta la sua
// luce in un numero, e una galassia di ottava magnitudine larga mezzo grado
// spalma quella luce su un'area cento volte maggiore di una planetaria
// della stessa magnitudine grande un primo. Quello che conta è quanta luce
// arriva per unità di cielo, perché è quella che si confronta col fondo
// notturno:
//
//   brillanza = magnitudine + 2,5 · log₁₀(area in primi quadrati)
//
// L'area è quella dell'ellisse (π/4 · asse maggiore · asse minore), non del
// rettangolo che la contiene: col rettangolo ogni oggetto risultava più
// debole di un quarto di magnitudine, e tanto bastava a spedire M31 fra
// quelli da telescopio — una galassia che si vede a occhio nudo da
// qualunque cielo decente.
//
// Con che strumento si veda **non è scritto qui**, ed è una scelta precisa:
// dipende dal cielo di chi guarda, e lo stesso M31 che dalla montagna si
// addita col dito, dal centro di Milano non esiste nemmeno col telescopio.
// Il conto lo fa `profondoStrumento()` in catalogo.js, con la scala di
// Bortle scelta nelle impostazioni.
function brillanzaDi(mag, m) {
  const area = m ? Math.max(0.2, Math.PI / 4 * m.maggiore * m.minore) : 3;
  return mag + 2.5 * Math.log10(area);
}

function costruisciProfondo() {
  const messier = leggi('messier.json').features;
  const luminosi = leggi('dsos.bright.json').features;

  const visti = new Set();
  const voci = [];

  const aggiungi = (f, daMessier) => {
    const p = f.properties;
    const sigla = (p.name || p.desig || f.id || '').trim();
    if (!sigla || visti.has(sigla)) return;
    visti.add(sigla);

    const tipo = TIPI[p.type] || { it: 'oggetto profondo', gruppo: 'nebulosa' };
    const m = misura(p.dim);
    // Qualche catalogo scrive la magnitudine come stringa, e chi non la
    // conosce la mette a 99: vale come "debole", non come numero.
    const magGrezza = parseFloat(p.mag);
    const mag = isFinite(magGrezza) && magGrezza < 30 ? magGrezza : 12;
    const [lon, lat] = f.geometry.coordinates;

    voci.push({
      sigla,
      // Il nome comune, ma solo se in italiano ce l'ha davvero
      alt: NOMI_PROFONDO[sigla] || NOMI_PROFONDO[(p.desig || '').trim()] || '',
      altro: (p.desig || '').trim(),      // l'altra sigla: "NGC 1952"
      ra: arr(raOre(lon), 5),
      dec: arr(lat, 4),
      mag: arr(mag, 1),
      tipo: tipo.gruppo,
      tipoTesto: tipo.it,
      assePrimi: m ? arr(m.maggiore, 1) : 6,
      asseMinore: m ? arr(m.minore, 1) : 6,
      brillanza: arr(brillanzaDi(mag, m), 1),
      messier: daMessier
    });
  };

  messier.forEach(f => aggiungi(f, true));
  luminosi.forEach(f => aggiungi(f, false));

  voci.sort((a, b) => a.mag - b.mag);

  const testo = INTESTAZIONE('IL CIELO PROFONDO — i 110 di Messier e i migliori NGC', [
    'Il catalogo di Charles Messier al completo, più gli oggetti luminosi',
    'che lui non mise in elenco (le Iadi, il Doppio Ammasso, la Nebulosa',
    'Nord America). Sono gli oggetti che si vedono davvero con un occhio,',
    'un binocolo o un telescopio da cortile: oltre non si va, e non serve.',
    '',
    'Nota su `brillanza`: è la magnitudine per primo quadrato, cioè quanta',
    'luce arriva per unità di cielo. Serve perché una galassia di ottava',
    'magnitudine larga mezzo grado è molto più dura di una planetaria della',
    'stessa magnitudine grande un primo: la stessa luce, spalmata su',
    'un\'area cento volte maggiore.',
    '',
    '`assePrimi` e `asseMinore` sono in primi d\'arco: servono a disegnarli',
    'grandi quanto sono davvero (la Luna piena misura circa 30′).',
    '',
    'Non c\'è nessun campo che dica «serve il binocolo», ed è una scelta',
    'precisa: quello dipende dal cielo di chi guarda, e lo stesso M31 che',
    'dalla montagna si addita col dito, dal centro di Milano non esiste',
    'nemmeno col telescopio. Il conto lo fa profondoStrumento() in',
    'catalogo.js, con la scala di Bortle scelta nelle impostazioni.'
  ]) +
`const CATALOGO_PROFONDO = [\n${
  voci.map(v =>
    `  { sigla: ${JSON.stringify(v.sigla)}, alt: ${JSON.stringify(v.alt)}, altro: ${JSON.stringify(v.altro)}, ` +
    `ra: ${v.ra}, dec: ${v.dec}, mag: ${v.mag}, tipo: ${JSON.stringify(v.tipo)}, tipoTesto: ${JSON.stringify(v.tipoTesto)}, ` +
    `assePrimi: ${v.assePrimi}, asseMinore: ${v.asseMinore}, brillanza: ${v.brillanza}, messier: ${v.messier} }`
  ).join(',\n')
}\n];\n`;

  fs.writeFileSync(path.join(DESTINAZIONE, 'dati-profondo.js'), testo);
  return { oggetti: voci.length, messier: voci.filter(v => v.messier).length, kb: Math.round(testo.length / 1024) };
}

// ---------------------------------------------------------------------
// 4. COMETE E ASTEROIDI
// ---------------------------------------------------------------------
// Astronomy Engine arriva fino a Plutone e si ferma: comete e asteroidi
// non li conosce, e non c'è modo di insegnarglieli. Vanno propagati per
// conto nostro dalle leggi di Keplero, e per farlo servono gli elementi
// orbitali — che sono un dato osservativo, si aggiornano, e nessuno può
// tirarli fuori dalla testa.
//
// Vengono da `ssystem_minor.ini` di Stellarium (GPL, dati a monte
// dell'MPC e del JPL), preso a mano e ridotto ai corpi che dalle nostre
// parti si vedono davvero. Il file dell'app dice sempre da quale
// versione arriva e a che epoca sono riferiti gli elementi: un'orbita
// vecchia di dieci anni per una cometa nuova non vale niente, e chi
// guarda ha il diritto di saperlo.
const ASTEROIDI_SCELTI = [
  // I quattro grandi, quelli che ogni tanto arrivano alla portata di un
  // binocolo, più la manciata che supera la nona magnitudine.
  'Ceres', 'Pallas', 'Juno', 'Vesta', 'Iris', 'Hebe', 'Flora', 'Metis',
  'Eunomia', 'Hygiea', 'Psyche', 'Melpomene', 'Massalia', 'Amphitrite',
  'Egeria', 'Irene', 'Eugenia', 'Parthenope', 'Victoria', 'Ausonia'
];

// Le comete si scelgono per luminosità, non per nome: una cometa famosa
// è famosa proprio perché è stata luminosa. Sotto l'undicesima
// magnitudine assoluta restano quelle che hanno fatto alzare la testa
// alla gente — Halley, Hale-Bopp, Hyakutake, NEOWISE — e quelle in giro
// adesso. Le altre sono macchioline da CCD, e in un'app che dice «esci a
// guardare» non ci fanno niente.
//
// Le comete appena scoperte non stanno qui e non ci staranno mai: fra
// una scoperta e un rilascio dell'app passano settimane, e una cometa
// nuova si vede per giorni. Quelle arrivano incollando gli elementi
// dell'MPC — che è esattamente il modo in cui arrivano nella vita vera.
const COMETE_MAG_MASSIMA = 11;

const NOMI_ASTEROIDI = {
  Ceres: 'Cerere', Pallas: 'Pallade', Juno: 'Giunone', Vesta: 'Vesta',
  Iris: 'Iride', Hebe: 'Ebe', Flora: 'Flora', Metis: 'Meti',
  Eunomia: 'Eunomia', Hygiea: 'Igea', Psyche: 'Psiche', Melpomene: 'Melpomene',
  Massalia: 'Massalia', Amphitrite: 'Anfitrite', Egeria: 'Egeria',
  Irene: 'Irene', Eugenia: 'Eugenia', Parthenope: 'Partenope',
  Victoria: 'Victoria', Ausonia: 'Ausonia'
};

function costruisciCorpiMinori(fileIni) {
  const testo = fs.readFileSync(fileIni, 'utf8');
  const blocchi = testo.split(/\n\[/).slice(1);

  const corpi = [];
  blocchi.forEach(grezzo => {
    const b = '[' + grezzo;
    const g = k => {
      const m = b.match(new RegExp('^' + k + '\\s*=\\s*(.+)$', 'm'));
      return m ? m[1].trim() : null;
    };
    const num = k => { const v = parseFloat(g(k)); return isFinite(v) ? v : null; };

    const tipo = g('type');
    const nome = g('name') || '';
    if (tipo !== 'asteroid' && tipo !== 'comet') return;

    const H = num('absolute_magnitude');
    const voluto = tipo === 'asteroid'
      ? ASTEROIDI_SCELTI.includes(nome)
      : (H !== null && H <= COMETE_MAG_MASSIMA);
    if (!voluto) return;

    const e = num('orbit_Eccentricity');
    const i = num('orbit_Inclination');
    const nodo = num('orbit_AscendingNode');
    const peri = num('orbit_ArgOfPericenter');
    const epoca = num('orbit_Epoch');
    if (e === null || i === null || nodo === null || peri === null) return;

    // Due modi di dire la stessa orbita. Gli asteroidi si danno con il
    // semiasse e l'anomalia media a un'epoca; le comete con la distanza
    // al perielio e l'istante in cui ci passano — perché per un'orbita
    // quasi parabolica il semiasse è enorme e mal determinato, mentre il
    // passaggio al perielio si misura benissimo.
    const semiasse = num('orbit_SemiMajorAxis');
    const perielioQ = num('orbit_PericenterDistance');
    const anomaliaMedia = num('orbit_MeanAnomaly');
    const alPerielio = num('orbit_TimeAtPericenter');

    const voce = {
      nome: NOMI_ASTEROIDI[nome] || nome,
      tipo: tipo === 'comet' ? 'cometa' : 'asteroide',
      e: arr(e, 7), i: arr(i, 5), nodo: arr(nodo, 5), peri: arr(peri, 5),
      H,
      G: num('slope_parameter')
    };

    if (semiasse !== null && anomaliaMedia !== null && epoca !== null) {
      voce.a = arr(semiasse, 7);
      voce.M0 = arr(anomaliaMedia, 5);
      voce.epoca = epoca;
    } else if (perielioQ !== null && alPerielio !== null) {
      voce.q = arr(perielioQ, 7);
      voce.tPerielio = alPerielio;
    } else {
      return;                       // elementi incompleti: si lascia perdere
    }

    corpi.push(voce);
  });

  corpi.sort((a, b) => (a.tipo === b.tipo ? (a.H || 99) - (b.H || 99) : a.tipo < b.tipo ? -1 : 1));

  const testoFile = INTESTAZIONE('COMETE E ASTEROIDI — elementi orbitali', [
    'Astronomy Engine arriva fino a Plutone e si ferma: comete e asteroidi',
    'non li conosce. Vanno propagati per conto nostro dalle leggi di',
    'Keplero (il conto è in corpi-minori.js), e per farlo servono questi',
    'numeri.',
    '',
    'Sono un dato osservativo, non una costante di natura: si aggiornano.',
    'Per un asteroide un\'orbita di dieci anni fa va ancora benissimo; per',
    'una cometa appena scoperta no, e infatti le comete nuove non stanno',
    'qui — si aggiungono incollando gli elementi dell\'MPC, che è',
    'esattamente il modo in cui arrivano nella vita vera.',
    '',
    'Angoli in gradi, distanze in unità astronomiche, epoche in giorni',
    'giuliani. Riferiti all\'eclittica e all\'equinozio di J2000.',
    '',
    'Fonte: ssystem_minor.ini di Stellarium (GPL), a monte Minor Planet',
    'Center e JPL. Ripreso il ' + new Date().toISOString().slice(0, 10) + '.'
  ]) +
`const CORPI_MINORI = [\n${
  corpi.map(c => '  ' + JSON.stringify(c)).join(',\n')
}\n];\n`;

  fs.writeFileSync(path.join(DESTINAZIONE, 'dati-corpi-minori.js'), testoFile);
  return {
    asteroidi: corpi.filter(c => c.tipo === 'asteroide').length,
    comete: corpi.filter(c => c.tipo === 'cometa').length,
    kb: Math.round(testoFile.length / 1024)
  };
}

console.log('stelle       ', costruisciStelle());
console.log('costellazioni', costruisciCostellazioni());
console.log('profondo     ', costruisciProfondo());
if (process.argv[4]) console.log('corpi minori ', costruisciCorpiMinori(process.argv[4]));

// ---------------------------------------------------------------------
// 4. LE DISTANZE — quanto è lontana ogni stella delle figure
//
//     Serve a una cosa sola, ma è una cosa che cambia il modo di guardare
//     il cielo: mettere le stelle di una costellazione nello spazio VERO,
//     ognuna alla sua distanza, e far vedere che la figura non esiste —
//     è un effetto di prospettiva che funziona da qui e da nessun altro
//     posto. Le tre stelle della cintura di Orione sembrano gemelle e
//     stanno a 1.260, 2.000 e 1.260 anni luce.
//
//     Il catalogo delle figure (dati-costellazioni.js) porta solo
//     ascensione retta e declinazione: la distanza non c'è, perché al
//     planetario non è mai servita. Qui si va a prenderla nel database
//     HYG, che mette insieme Hipparcos, Yale BSC e Gliese e per ogni
//     stella riporta la parallasse convertita in parsec.
//
//     L'accoppiamento è per posizione: le due sorgenti sono entrambe
//     J2000 e le coordinate coincidono alla terza cifra. Se una stella
//     non si trova, o la sua parallasse è troppo incerta perché HYG dia
//     una distanza (succede per le supergiganti lontane), la distanza
//     resta `null` e il disegno in 3D la mette alla distanza di catalogo
//     dicendo che è una stima.
// ---------------------------------------------------------------------

const PARSEC_IN_AL = 3.261564;

function costruisciDistanze(fileHyg) {
  const righe = fs.readFileSync(fileHyg, 'utf8').split('\n');
  const intestazione = righe[0].split(',').map(s => s.replace(/"/g, ''));
  const col = n => intestazione.indexOf(n);
  const iRa = col('ra'), iDec = col('dec'), iDist = col('dist'), iMag = col('mag'),
        iCi = col('ci'), iProper = col('proper'), iBayer = col('bayer'), iCon = col('con'),
        iSpect = col('spect');

  // Una riga CSV con virgolette: le stelle con nome proprio hanno campi
  // fra apici, e uno split secco sulle virgole li spezzerebbe in due
  const spezza = riga => {
    const fuori = [];
    let corrente = '', dentroApici = false;
    for (let i = 0; i < riga.length; i++) {
      const c = riga[i];
      if (c === '"') dentroApici = !dentroApici;
      else if (c === ',' && !dentroApici) { fuori.push(corrente); corrente = ''; }
      else corrente += c;
    }
    fuori.push(corrente);
    return fuori;
  };

  // Le stelle di HYG in una griglia grossolana, per non fare centomila
  // confronti per ogni vertice
  const griglia = new Map();
  const chiave = (ra, dec) => `${Math.round(ra * 4)}|${Math.round(dec)}`;
  const stelle = [];
  for (let i = 1; i < righe.length; i++) {
    if (!righe[i]) continue;
    const c = spezza(righe[i]);
    const ra = parseFloat(c[iRa]), dec = parseFloat(c[iDec]), mag = parseFloat(c[iMag]);
    if (!isFinite(ra) || !isFinite(dec) || !isFinite(mag) || mag > 7.2) continue;
    const dist = parseFloat(c[iDist]);
    const s = {
      ra, dec, mag,
      // 100000 parsec è il tappo che HYG mette quando la parallasse non
      // c'è o è minore del suo errore: non è una distanza, è un «non lo so»
      al: isFinite(dist) && dist > 0 && dist < 99999 ? dist * PARSEC_IN_AL : null,
      ci: isFinite(parseFloat(c[iCi])) ? parseFloat(c[iCi]) : null,
      nome: c[iProper] || '', bayer: c[iBayer] || '', con: c[iCon] || '',
      spett: (c[iSpect] || '').slice(0, 3)
    };
    const indice = stelle.push(s) - 1;
    // Anche le celle vicine: un vertice sul bordo di una cella deve
    // trovare la stella che sta appena di là
    for (let dr = -1; dr <= 1; dr++) for (let dd = -1; dd <= 1; dd++) {
      const k = `${Math.round(ra * 4) + dr}|${Math.round(dec) + dd}`;
      if (!griglia.has(k)) griglia.set(k, []);
      griglia.get(k).push(indice);
    }
  }

  const piuVicina = (ra, dec) => {
    const vicine = griglia.get(chiave(ra, dec)) || [];
    let migliore = null, minimo = Infinity;
    const cd = Math.cos(dec * Math.PI / 180);
    vicine.forEach(i => {
      const s = stelle[i];
      const d = Math.hypot((s.ra - ra) * 15 * cd, s.dec - dec);
      if (d < minimo) { minimo = d; migliore = s; }
    });
    return minimo < 0.05 ? migliore : null;
  };

  // I vertici delle figure si leggono da dati-costellazioni.js, non dalla
  // sorgente d3-celestial: le distanze devono corrispondere ESATTAMENTE
  // ai vertici che l'app disegna, cifra per cifra, perché è su quelli che
  // il banco in 3D andrà a cercarle. Passando dalla sorgente basterebbe
  // un arrotondamento diverso per non trovare più niente.
  const sorgenteFigure = fs.readFileSync(path.join(DESTINAZIONE, 'dati-costellazioni.js'), 'utf8');
  const ambiente = {};
  new Function('e', sorgenteFigure + '\ne.COSTELLAZIONI_IAU = COSTELLAZIONI_IAU;')(ambiente);
  const figure = ambiente.COSTELLAZIONI_IAU;

  const fuori = [];
  let trovate = 0, totale = 0, senzaDistanza = 0;
  const perSigla = {};

  figure.forEach(f => {
    const sigla = f.sigla;
    // Il Serpente è in due tronconi e compare due volte: le voci del
    // secondo si aggiungono a quelle del primo
    const visti = new Map();
    const voci = perSigla[sigla] || [];
    voci.forEach(v => visti.set(v[0] + ',' + v[1], true));
    (f.spezzate || []).forEach(linea => linea.forEach(p => {
      const ra = p[0], dec = p[1];
      const k = ra + ',' + dec;
      if (visti.has(k)) return;
      visti.set(k, true);
      totale++;
      const s = piuVicina(ra, dec);
      if (!s) { fuori.push(`${sigla} ${ra} ${dec}`); voci.push([ra, dec, null, null, null, '']); return; }
      trovate++;
      if (s.al === null) senzaDistanza++;
      // Il nome che ha senso scrivere: quello proprio se c'è, se no la
      // lettera di Bayer con la costellazione (Zeta Orionis)
      const nome = s.nome || (s.bayer ? s.bayer + ' ' + s.con : '');
      voci.push([ra, dec, s.al === null ? null : arr(s.al, 1), arr(s.mag, 2),
                 s.ci === null ? null : arr(s.ci, 3), nome]);
    }));
    perSigla[sigla] = voci;
  });

  const testoFile = INTESTAZIONE('LE DISTANZE DELLE STELLE DELLE FIGURE', [
    'Per ogni vertice delle ottantotto figure: ascensione retta e',
    'declinazione (le stesse di dati-costellazioni.js, così si',
    'riconoscono), la distanza in anni luce, la magnitudine, l\'indice di',
    'colore B−V e il nome se ne ha uno.',
    '',
    'Serve al banco «Le costellazioni non esistono»: mettere le stelle di',
    'una figura nello spazio vero, ognuna alla sua distanza, e allontanare',
    'l\'osservatore finché la figura si disfa. Da qui la cintura di Orione',
    'sono tre stelle uguali in fila; da mille anni luce di lato sono tre',
    'stelle che non hanno niente a che fare l\'una con l\'altra.',
    '',
    'Distanza `null` vuol dire che la parallasse non basta a saperla: HYG',
    'per quelle stelle non dà un numero, e non lo inventiamo nemmeno noi.',
    '',
    'Fonte: HYG Database v4.1 (CC BY-SA 4.0, astronexus/HYG-Database), a',
    'monte Hipparcos, Yale Bright Star Catalog e Gliese.',
    'Ripreso il ' + new Date().toISOString().slice(0, 10) + '.'
  ]) +
`const DISTANZE_FIGURE = {\n${
  Object.keys(perSigla).sort().map(s =>
    `  ${s}: [${perSigla[s].map(v => JSON.stringify(v)).join(',')}]`).join(',\n')
}\n};\n`;

  fs.writeFileSync(path.join(DESTINAZIONE, 'dati-distanze.js'), testoFile);
  return { vertici: totale, trovati: trovate, senzaDistanza,
           nonTrovati: fuori.length, kb: Math.round(testoFile.length / 1024) };
}

if (process.argv[5]) console.log('distanze     ', costruisciDistanze(process.argv[5]));
