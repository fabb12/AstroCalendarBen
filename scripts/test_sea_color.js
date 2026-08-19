const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// replace SKY_MARE_ACQUA
appJs = appJs.replace(
  'const SKY_MARE_ACQUA = { notte: [3, 6, 11], giorno: [11, 40, 55] };',
  'const SKY_MARE_ACQUA = { notte: [3, 6, 11], giorno: [20, 80, 130] };'
);

fs.writeFileSync('app.js', appJs);
console.log('Modified app.js');
