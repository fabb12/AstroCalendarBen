// =====================================================================
// COMETE E ASTEROIDI — elementi orbitali
// Astronomy Engine arriva fino a Plutone e si ferma: comete e asteroidi
// non li conosce. Vanno propagati per conto nostro dalle leggi di
// Keplero (il conto è in corpi-minori.js), e per farlo servono questi
// numeri.
// 
// Sono un dato osservativo, non una costante di natura: si aggiornano.
// Per un asteroide un'orbita di dieci anni fa va ancora benissimo; per
// una cometa appena scoperta no, e infatti le comete nuove non stanno
// qui — si aggiungono incollando gli elementi dell'MPC, che è
// esattamente il modo in cui arrivano nella vita vera.
// 
// Angoli in gradi, distanze in unità astronomiche, epoche in giorni
// giuliani. Riferiti all'eclittica e all'equinozio di J2000.
// 
// Fonte: ssystem_minor.ini di Stellarium (GPL), a monte Minor Planet
// Center e JPL. Ripreso il 2026-08-03.
//
// Generato da scripts/costruisci-dati.js — non si modifica a mano.
// Fonte: d3-celestial (BSD-3-Clause), a sua volta da Hipparcos, Yale Bright
// Star Catalog e NGC/IC riveduto: cataloghi pubblici, liberamente usabili.
// =====================================================================

const CORPI_MINORI = [
  {"nome":"Vesta","tipo":"asteroide","e":0.0901676,"i":7.14406,"nodo":103.70232,"peri":151.53712,"H":3.25,"G":0.15,"a":2.3615413,"M0":26.80968,"epoca":2461000.5},
  {"nome":"Cerere","tipo":"asteroide","e":0.0795763,"i":10.58789,"nodo":80.24963,"peri":73.29974,"H":3.34,"G":0.15,"a":2.7656157,"M0":231.53975,"epoca":2461000.5},
  {"nome":"Pallade","tipo":"asteroide","e":0.230643,"i":34.92833,"nodo":172.88859,"peri":310.9334,"H":4.11,"G":0.15,"a":2.7699258,"M0":211.52977,"epoca":2461000.5},
  {"nome":"Giunone","tipo":"asteroide","e":0.2558258,"i":12.98604,"nodo":169.81989,"peri":247.88367,"H":5.18,"G":0.15,"a":2.6708791,"M0":217.59095,"epoca":2461000.5},
  {"nome":"Eunomia","tipo":"asteroide","e":0.1877813,"i":11.76143,"nodo":292.88123,"peri":98.5072,"H":5.42,"G":0.15,"a":2.6421861,"M0":113.72578,"epoca":2461000.5},
  {"nome":"Ebe","tipo":"asteroide","e":0.2022301,"i":14.73615,"nodo":138.61473,"peri":239.69622,"H":5.61,"G":0.15,"a":2.4254693,"M0":352.56367,"epoca":2461000.5},
  {"nome":"Igea","tipo":"asteroide","e":0.1082238,"i":3.83294,"nodo":283.12164,"peri":312.60583,"H":5.64,"G":0.15,"a":3.1475914,"M0":216.69031,"epoca":2461000.5},
  {"nome":"Iride","tipo":"asteroide","e":0.2302133,"i":5.51881,"nodo":259.49459,"peri":145.48204,"H":5.67,"G":0.15,"a":2.386529,"M0":61.72502,"epoca":2461000.5},
  {"nome":"Anfitrite","tipo":"asteroide","e":0.0733503,"i":6.07744,"nodo":356.25475,"peri":61.90576,"H":5.97,"G":0.15,"a":2.5541211,"M0":145.10816,"epoca":2461000.5},
  {"nome":"Psiche","tipo":"asteroide","e":0.1343462,"i":3.09729,"nodo":150.00988,"peri":229.75341,"H":6.2,"G":0.15,"a":2.9233145,"M0":40.63883,"epoca":2461000.5},
  {"nome":"Meti","tipo":"asteroide","e":0.1225645,"i":5.57771,"nodo":68.86978,"peri":5.89591,"H":6.33,"G":0.15,"a":2.3865665,"M0":199.19648,"epoca":2461000.5},
  {"nome":"Melpomene","tipo":"asteroide","e":0.217962,"i":10.13086,"nodo":150.32895,"peri":228.05175,"H":6.35,"G":0.15,"a":2.295557,"M0":227.26386,"epoca":2461000.5},
  {"nome":"Irene","tipo":"asteroide","e":0.1626702,"i":9.12955,"nodo":86.00981,"peri":98.26521,"H":6.54,"G":0.15,"a":2.5878733,"M0":12.92605,"epoca":2461000.5},
  {"nome":"Massalia","tipo":"asteroide","e":0.1437636,"i":0.70925,"nodo":205.95442,"peri":257.23343,"H":6.54,"G":0.15,"a":2.4084078,"M0":29.99984,"epoca":2461000.5},
  {"nome":"Flora","tipo":"asteroide","e":0.1563337,"i":5.89033,"nodo":110.84339,"peri":285.42673,"H":6.61,"G":0.15,"a":2.2013072,"M0":198.90078,"epoca":2461000.5},
  {"nome":"Partenope","tipo":"asteroide","e":0.1004774,"i":4.63575,"nodo":125.46698,"peri":196.42014,"H":6.73,"G":0.15,"a":2.4531673,"M0":173.65693,"epoca":2461000.5},
  {"nome":"Egeria","tipo":"asteroide","e":0.084682,"i":16.52553,"nodo":43.17717,"peri":79.06456,"H":6.91,"G":0.15,"a":2.5762588,"M0":40.99101,"epoca":2461000.5},
  {"nome":"Ausonia","tipo":"asteroide","e":0.1281571,"i":5.77335,"nodo":337.68318,"peri":295.6215,"H":7.13,"G":0.15,"a":2.3945792,"M0":58.1081,"epoca":2461000.5},
  {"nome":"Victoria","tipo":"asteroide","e":0.2199307,"i":8.37403,"nodo":235.35286,"peri":69.54624,"H":7.29,"G":0.15,"a":2.3338396,"M0":76.93597,"epoca":2461000.5},
  {"nome":"Eugenia","tipo":"asteroide","e":0.0821724,"i":6.60564,"nodo":147.55501,"peri":87.29355,"H":7.76,"G":0.15,"a":2.7215823,"M0":206.55227,"epoca":2461000.5},
  {"nome":"Hale-Bopp","tipo":"cometa","e":0.9950817,"i":89.43015,"nodo":282.47085,"peri":130.58949,"H":-2,"G":4,"q":0.9141335,"tPerielio":2450539.6373},
  {"nome":"McNaught","tipo":"cometa","e":1.0000191,"i":77.83699,"nodo":267.41479,"peri":155.97496,"H":2,"G":4,"q":0.1707364,"tPerielio":2454113.29885},
  {"nome":"Ikeya-Seki","tipo":"cometa","e":0.999915,"i":141.8642,"nodo":346.9947,"peri":69.0486,"H":2.4,"G":2.1,"q":0.007786,"tPerielio":2439054.6837},
  {"nome":"123P/West-Hartley (2026)","tipo":"cometa","e":0.444827,"i":15.2815,"nodo":45.8615,"peri":103.8805,"H":4,"G":10,"q":2.158687,"tPerielio":2461305.4156},
  {"nome":"1P/Halley (1986)","tipo":"cometa","e":0.9672769,"i":162.24217,"nodo":58.86013,"peri":111.86566,"H":4.3,"G":4.9,"q":0.5871036,"tPerielio":2446470.95895},
  {"nome":"Bennett","tipo":"cometa","e":0.996193,"i":90.0437,"nodo":223.9589,"peri":354.151,"H":4.3,"G":3.6,"q":0.537606,"tPerielio":2440665.5446},
  {"nome":"Kirch (Great Comet of 1680)","tipo":"cometa","e":0.999986,"i":60.6771,"nodo":275.9317,"peri":350.6202,"H":4.4,"G":2.1,"q":0.006222,"tPerielio":2335019.9876},
  {"nome":"C/2026 C1 (Tsuchinshan)","tipo":"cometa","e":0.999932,"i":99.5847,"nodo":3.6205,"peri":310.7197,"H":4.4,"G":4,"q":1.152361,"tPerielio":2462082.4506},
  {"nome":"West","tipo":"cometa","e":0.999971,"i":43.07,"nodo":118.2313,"peri":358.419,"H":4.7,"G":3.2,"q":0.196626,"tPerielio":2442833.7216},
  {"nome":"10P/Tempel (2026)","tipo":"cometa","e":0.537447,"i":12.0273,"nodo":117.7976,"peri":195.4675,"H":5,"G":10,"q":1.417739,"tPerielio":2461254.6144},
  {"nome":"74P/Smirnova-Chernykh (2026)","tipo":"cometa","e":0.071978,"i":5.7962,"nodo":48.1058,"peri":57.8333,"H":5,"G":6,"q":4.835681,"tPerielio":2461078.9319},
  {"nome":"82P/Gehrels (2026)","tipo":"cometa","e":0.123714,"i":1.129,"nodo":239.2852,"peri":226.2931,"H":5,"G":8,"q":3.624137,"tPerielio":2461359.539},
  {"nome":"Hyakutake","tipo":"cometa","e":0.999899,"i":124.92275,"nodo":188.04523,"peri":130.17407,"H":5,"G":4,"q":0.2302292,"tPerielio":2450204.89407},
  {"nome":"14P/Wolf (2026)","tipo":"cometa","e":0.356435,"i":27.919,"nodo":202.0086,"peri":159.2075,"H":5.5,"G":12,"q":2.738523,"tPerielio":2461302.5435},
  {"nome":"78P/Gehrels (2026)","tipo":"cometa","e":0.462849,"i":6.2577,"nodo":210.4944,"peri":192.7974,"H":5.5,"G":8,"q":2.004488,"tPerielio":2461216.6048},
  {"nome":"Arend-Roland","tipo":"cometa","e":1.000168,"i":119.9493,"nodo":215.1596,"peri":308.7852,"H":5.7,"G":3.3,"q":0.316035,"tPerielio":2435936.5324},
  {"nome":"24P/Schaumasse (2026)","tipo":"cometa","e":0.708197,"i":11.5019,"nodo":78.2696,"peri":58.4873,"H":6.5,"G":14,"q":1.18401,"tPerielio":2461048.8417},
  {"nome":"NEOWISE","tipo":"cometa","e":0.999132,"i":128.9699,"nodo":61.0213,"peri":37.2926,"H":7.2,"G":4.7,"q":0.294934,"tPerielio":2459034.1265},
  {"nome":"C/2026 B3 (PANSTARRS)","tipo":"cometa","e":0.995105,"i":100.8339,"nodo":346.255,"peri":205.2221,"H":7.7,"G":4,"q":5.815038,"tPerielio":2461530.7311},
  {"nome":"149P/Mueller (2026)","tipo":"cometa","e":0.324393,"i":34.2713,"nodo":143.6939,"peri":30.0114,"H":8,"G":8,"q":2.793596,"tPerielio":2461389.9194},
  {"nome":"76P/West-Kohoutek-Ikemura (2026)","tipo":"cometa","e":0.539543,"i":30.4969,"nodo":84.1082,"peri":0.0208,"H":8,"G":12,"q":1.596773,"tPerielio":2461144.1364},
  {"nome":"NEAT","tipo":"cometa","e":0.9999018,"i":81.70606,"nodo":64.08843,"peri":152.16969,"H":8,"G":4,"q":0.0992582,"tPerielio":2452688.795747802},
  {"nome":"128P/Shoemaker-Holt (2026)","tipo":"cometa","e":0.32226,"i":4.3717,"nodo":214.3066,"peri":210.5695,"H":8.5,"G":4,"q":3.036792,"tPerielio":2461238.5668},
  {"nome":"161P/Hartley-IRAS (2026)","tipo":"cometa","e":0.83617,"i":95.7909,"nodo":1.4753,"peri":47.0691,"H":8.5,"G":6,"q":1.265156,"tPerielio":2461372.0111},
  {"nome":"493P/LONEOS (2026)","tipo":"cometa","e":0.468365,"i":24.1101,"nodo":1.0283,"peri":83.303,"H":8.5,"G":4,"q":3.822991,"tPerielio":2461054.7801},
  {"nome":"C/2026 H3 (Bok)","tipo":"cometa","e":1.003399,"i":142.5672,"nodo":352.4966,"peri":98.4926,"H":8.9,"G":4,"q":7.728232,"tPerielio":2461183.4745},
  {"nome":"C/2026 A3 (PANSTARRS)","tipo":"cometa","e":1.006559,"i":157.4225,"nodo":307.0008,"peri":238.6788,"H":9,"G":4,"q":4.818496,"tPerielio":2461676.1482},
  {"nome":"C/2026 H1 (PANSTARRS)","tipo":"cometa","e":1.000732,"i":115.5936,"nodo":178.7278,"peri":349.65,"H":9,"G":4,"q":6.083956,"tPerielio":2461204.9811},
  {"nome":"C/2026 L1 (PANSTARRS)","tipo":"cometa","e":0.993604,"i":67.2625,"nodo":130.5039,"peri":200.5916,"H":9.2,"G":4,"q":4.879451,"tPerielio":2461506.8737},
  {"nome":"510P/Boattini (2026)","tipo":"cometa","e":0.24767,"i":8.2269,"nodo":280.656,"peri":86.6878,"H":9.5,"G":4,"q":4.875271,"tPerielio":2461292.6529},
  {"nome":"69P/Taylor (2026)","tipo":"cometa","e":0.414636,"i":22.0613,"nodo":104.8053,"peri":343.5577,"H":9.5,"G":12,"q":2.270369,"tPerielio":2461356.9881},
  {"nome":"93P/Lovas (2026)","tipo":"cometa","e":0.613866,"i":12.2106,"nodo":339.5486,"peri":75.0481,"H":9.5,"G":6,"q":1.68839,"tPerielio":2461163.4555},
  {"nome":"Lemmon","tipo":"cometa","e":0.234701,"i":11.933,"nodo":337.3027,"peri":16.246,"H":9.5,"G":4,"q":3.337725,"tPerielio":2459146.4803},
  {"nome":"C/2026 B2 (Sun-Gao)","tipo":"cometa","e":0.997492,"i":59.5797,"nodo":234.6367,"peri":47.2984,"H":9.7,"G":4,"q":1.284242,"tPerielio":2461050.6153},
  {"nome":"509P/Catalina (2026)","tipo":"cometa","e":0.477842,"i":8.5952,"nodo":275.2045,"peri":180.0211,"H":10,"G":4,"q":3.692831,"tPerielio":2461118.828},
  {"nome":"512P/PANSTARRS (2026)","tipo":"cometa","e":0.157006,"i":12.5694,"nodo":73.7308,"peri":308.7336,"H":10,"G":4,"q":4.801518,"tPerielio":2461379.5833},
  {"nome":"C/2026 H2 (Leonard)","tipo":"cometa","e":1.002045,"i":148.6504,"nodo":5.4572,"peri":111.5436,"H":10.1,"G":4,"q":4.546463,"tPerielio":2461116.782},
  {"nome":"63P/Wild (2026)","tipo":"cometa","e":0.650727,"i":19.6197,"nodo":357.7379,"peri":168.7393,"H":10.5,"G":6,"q":1.97495,"tPerielio":2461227.6389},
  {"nome":"C/2026 A2 (Bok)","tipo":"cometa","e":0.997631,"i":82.3058,"nodo":206.5889,"peri":155.9361,"H":10.7,"G":4,"q":1.937833,"tPerielio":2461396.8542},
  {"nome":"131P/Mueller (2026)","tipo":"cometa","e":0.344621,"i":7.3622,"nodo":214.1317,"peri":179.287,"H":11,"G":4,"q":2.407844,"tPerielio":2461087.2626},
  {"nome":"88P/Howell (2026)","tipo":"cometa","e":0.563282,"i":4.3819,"nodo":56.6678,"peri":235.8613,"H":11,"G":6,"q":1.357755,"tPerielio":2461118.2586}
];
