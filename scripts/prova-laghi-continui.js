'use strict';
// node scripts/prova-laghi-continui.js
function provaLaghi(sources) {
  let checks = 0;
  const ok = (value, message) => { if (!value) throw new Error(message); checks++; };
  const extract = (source, name) => {
    const start = source.indexOf('function ' + name + '(');
    const end = source.indexOf('\n}\n', start);
    if (start < 0 || end < 0) throw new Error(name);
    return source.slice(start, end + 2);
  };
  const load = (source, names, env) => new Function(...Object.keys(env),
    names.map(n => extract(source, n)).join('\n') +
    ';return {' + names.join(',') + '};')(...Object.values(env));
  const band = (near, far, body = 1) => ({
    vicino: near, lontano: far, corpo: body, tipo: 0
  });
  const { skyAcqueStrisce } = load(sources.app, ['skyAcqueStrisce'],
    { ACQUE_PASSO_AZ: 0.5, ACQUE_DIREZIONI: 720, SKY_ACQUA_SALTO: 1 });
  const views = Array(720).fill(null);
  views[0] = [band(100, 150)];
  views[1] = [band(200, 250)];
  views[2] = [band(300, 350)];
  const arc = { centro: 0.5, mezzo: 0.5 };
  ok(skyAcqueStrisce(views, arc).length === 1, 'Riva obliqua continua');
  views[1] = [band(110, 120), band(140, 160)];
  ok(skyAcqueStrisce(views, arc).length > 1, 'Promontorio non scavalcato');
  views[1] = [band(100, 150, 2)];
  ok(skyAcqueStrisce(views, arc).length === 3, 'Laghi distinti separati');
  views.fill(null);
  views[719] = [band(100, 200)];
  views[0] = [band(120, 220)];
  ok(skyAcqueStrisce(views, {centro: 359.75, mezzo: 0.25}).length === 1,
    'Continuita attraverso il nord');

  const dist = [100, 200, 300, 400, 500, 600];
  const relief = { quota: new Float64Array(12), occhio: 100 };
  const { rilFrontiAcqua } = load(sources.rilievo, ['rilFrontiAcqua'], {
    rilPronto: () => true, rilievo: relief, RIL_ANELLI: 6,
    rilAnelloDi: () => 5, rilFrontiAcquaBuf: null, RIL_DIST: dist,
    RIL_PASSO_AZ: 180, RIL_AZIMUT: 2, RIL_VICINO_M: 25,
    TERRENO_RIFRAZIONE: 0.13, TERRENO_RAGGIO_KM: 6371
  });
  relief.quota[2] = relief.quota[8] = 200;
  let lake = rilFrontiAcqua(0, 6, 3, 500, 150, 10, 6, true);
  ok(lake.tan[2] === lake.tan[1], 'DEM interno non taglia il lago');
  let river = rilFrontiAcqua(0, 6, 3, 500, 150, 10, 6, false);
  ok(river.tan[2] > 0, 'Occlusione dei fiumi conservata');
  relief.quota[0] = relief.quota[6] = 200;
  lake = rilFrontiAcqua(0, 6, 3, 500, 150, 10, 6, true);
  ok(lake.tan[2] > 0, 'Dosso prima del lago resta opaco');
  relief.quota.fill(0);
  relief.quota[2] = relief.quota[8] = 200;
  lake = rilFrontiAcqua(0, 6, 3, 600, 400, 10, 6, true);
  ok(lake.tan[4] > 0, 'Isola prima della seconda banda resta opaca');

  const dirs = 720;
  const names = ['acqueStessoPunto', 'acqueCuciAnelli', 'acqueLeggiElementi',
    'acquePuntiEriquadro', 'acquePuntoDentro', 'acqueIndiceAz',
    'acqueTagliVuoti', 'acqueTagliaUno', 'acqueBandeDaTagli'];
  const geo = load(sources.terreno, names, {
    ACQUE_DIREZIONI: dirs, ACQUE_PASSO_AZ: 0.5, ACQUE_AREA_MIN: 1,
    ACQUE_SENI: Array.from({length: dirs}, (_, i) => Math.sin(i * Math.PI / 360)),
    ACQUE_COSENI: Array.from({length: dirs}, (_, i) => Math.cos(i * Math.PI / 360))
  });
  const square = (x0, y0, x1, y1) => [
    [x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]
  ].map(([lon,lat]) => ({lon:lon/111320,lat:lat/111320}));
  const traces = geo.acqueLeggiElementi([{type:'relation',tags:{natural:'water'},
    members: [
      {role:'outer',geometry:square(-500,100,500,1000)},
      {role:'inner',geometry:square(-100,400,100,600)}
    ]}]);
  ok(traces.length === 1 && traces[0].buchi.length === 1, 'Isola associata al lago');
  const cuts = geo.acqueTagliVuoti(2000);
  geo.acqueTagliaUno(traces[0], 0, cuts, 0, 0, 2000);
  const bands = geo.acqueBandeDaTagli(cuts)[0];
  ok(bands.length === 2 && Math.abs(bands[0][1]-400)<2 &&
    Math.abs(bands[1][0]-600)<2, 'Profilo esclude l isola');
  const fromIsland = geo.acqueTagliVuoti(2000);
  geo.acqueTagliaUno(traces[0], 0, fromIsland, 500/111320, 0, 2000);
  ok(!fromIsland.sommersi.has(0), 'Osservatore sull isola non sommerso');
  const fromWater = geo.acqueTagliVuoti(2000);
  geo.acqueTagliaUno(traces[0], 0, fromWater, 200/111320, 0, 2000);
  ok(fromWater.sommersi.has(0), 'Osservatore nel lago sommerso');
  return checks;
}
const fs = require('node:fs');
const path = require('node:path');
const sources = Object.fromEntries(['app','terreno','rilievo'].map(name =>
  [name, fs.readFileSync(path.join(__dirname, '..', name + '.js'), 'utf8')]));
console.log('OK: ' + provaLaghi(sources) + ' verifiche laghi continui');
