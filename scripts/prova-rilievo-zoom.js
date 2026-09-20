#!/usr/bin/env node
'use strict';

// Regressioni del terreno a forte zoom, senza rete né dipendenze.
// Eseguire: node scripts/prova-rilievo-zoom.js
// Il contesto Canvas registra le chiamate e rifiuta coordinate non finite:
// non sostituisce una verifica visiva su un browser reale.
const fs = require('node:fs');
const path = require('node:path');
const radice = path.resolve(__dirname, '..');
const leggi = nome => fs.readFileSync(path.join(radice, nome), 'utf8');
const terrenoSorgente = leggi('terreno.js');
const rilievoSorgente = leggi('rilievo.js');
const appSorgente = leggi('app.js');
const funzioni = ["skyDirezione","skyArcoAcquaInVista","skyArcoOrizzonteInVista","skyCerchioOrizzonte","skyVettore","skyProietta","skyDot","skyCross","skyMescolaColore","skyRgba","skyAngoloDiRaggio","skyOrizzonteQuasiRetto"];
const geometria = funzioni.map(nome => {
  const inizio = appSorgente.indexOf('function ' + nome + '(');
  if (inizio < 0) throw new Error('Funzione mancante: ' + nome);
  return appSorgente.slice(inizio, appSorgente.indexOf('\n}', inizio) + 2);
}).join('\n');
const esegui = corpo => new Function(terrenoSorgente + '\n' + rilievoSorgente +
  '\n' + geometria + '\n' + corpo)();
const conti = esegui(String.raw`
const esiti = [];
function verifica(nome, f) { f(); esiti.push(nome); }
function vicino(a,b,e=1e-8) { if (Math.abs(a-b)>e || !Number.isFinite(a)) throw Error(a+' != '+b); }
function vero(v,m) { if (!v) throw Error(m); }
rilievo.quota = new Float64Array(RIL_AZIMUT * RIL_ANELLI);
for (let i=0;i<RIL_AZIMUT;i++) for(let k=0;k<RIL_ANELLI;k++) rilievo.quota[i*RIL_ANELLI+k]=10*i+20*k+3*i*k;
verifica('bilineare quattro nodi, non nearest', () => {
  vicino(rilCampionaMaglia(2.25,3.75),10*2.25+20*3.75+3*2.25*3.75);
});
verifica('nodi e ultimo anello esatti', () => {
  vicino(rilCampionaMaglia(4,RIL_ANELLI-1),rilievo.quota[4*RIL_ANELLI+RIL_ANELLI-1]);
  vicino(rilCampionaMaglia(4,-1),rilievo.quota[4*RIL_ANELLI]);
});
verifica('cucitura 360 gradi e indici negativi', () => {
  vicino(rilCampionaMaglia(-0.25,5),rilCampionaMaglia(719.75,5));
  vicino(rilCampionaMaglia(720.25,5),rilCampionaMaglia(0.25,5));
  const a=rilievo.quota[719*RIL_ANELLI+5], b=rilievo.quota[5];
  vicino(rilCampionaMaglia(719.5,5),(a+b)/2);
});
rilTabelleAnelli();
const riempi = (pendenza) => {
  const q=new Float64Array(RIL_AZIMUT*RIL_ANELLI);
  for(let i=0;i<RIL_AZIMUT;i++) for(let k=0;k<RIL_ANELLI;k++) {
    const az=i*RIL_PASSO_AZ*Math.PI/180,s=RIL_DIST[k];
    q[i*RIL_ANELLI+k]=100+pendenza*s*Math.sin(az)+0.2*s*Math.cos(az);
  }
  rilievo.quota=q;
};
riempi(0.3);
verifica('normali unitarie, piano inclinato e primo anello', () => {
  for(const i of [0,0.25,24,100.75,719.9]) for(const k of [0,20,60,105]) {
    const n=rilNormaleInterpolata(i,k);
    vicino(Math.hypot(...n.slice(0,3)),1,1e-10);
    vero(n[2]>0,'normale rivolta in basso');
    if(k>0) {
      const m=Math.hypot(0.3,0.2,1);
      vicino(n[0],-0.3/m,0.002); vicino(n[1],-0.2/m,0.002); vicino(n[2],1/m,0.002);
    }
  }
});
verifica('normali continue sui nodi e cucitura', () => {
  for(const i of [0,100,719,720]) {
    const a=Array.from(rilNormaleInterpolata(i-1e-6,60));
    const b=Array.from(rilNormaleInterpolata(i+1e-6,60));
    for(let j=0;j<3;j++) vicino(a[j],b[j],1e-5);
  }
});
verifica('cache delle normali invalidata con le nuove quote', () => {
  const a=rilNormaleInterpolata(0,60)[0]; riempi(-0.3);
  const b=rilNormaleInterpolata(0,60)[0];
  vero(a<0 && b>0,'normale della vecchia maglia');
});
const sky={larghezza:1920,altezza:1080};
const SKY_D2R=Math.PI/180;
const datiZoom=[];
verifica('LOD limitato in pixel a FOV 60,10,1,0.1,0.01', () => {
  for(const fov of [60,10,1,0.1,0.01]) {
    const f=sky.larghezza/(4*Math.tan(fov*SKY_D2R/4));
    const b={f:[0,1,0]}, arco={centro:0,mezzo:fov/2+6};
    const g=rilGrigliaInVista(b,f,arco);
    vero(g.nCol<=4096 && g.nCol>=2,'numero colonne');
    const px=g.passo*RIL_PASSO_AZ*f*SKY_D2R;
    vero(px<11,'colonna troppo larga: '+px);
    datiZoom.push({fov,colonne:g.nCol,passo:g.passo,pixel:px});
    const prima=g.i0*RIL_PASSO_AZ, ultima=(g.i0+(g.nCol-1)*g.passo)*RIL_PASSO_AZ;
    vero(prima<=-fov/2 && ultima>=fov/2,'copertura incompleta');
  }
});
verifica('budget non ripristina bande larghe con lo zoom', () => {
  rilBudgetFattore=8;
  const f=1e6, p=rilPassoColonne(f*SKY_D2R);
  vero(p*RIL_PASSO_AZ*f*SKY_D2R<11,'budget cancella LOD');
});
verifica('nadir: numero limitato senza troncare il giro', () => {
  const g=rilGrigliaInVista({f:[0,0,-1]},1e6,{centro:180,mezzo:180});
  vero(g.nCol<=4096,'budget nadir');
  vero((g.nCol-1)*g.passo*RIL_PASSO_AZ>=360,'nadir incompleto');
});
verifica('isteresi: vista ferma non oscilla', () => {
  rilBudgetFattore=1;
  for(const px of [10,100,1000,10000,100000,10]) {
    const p=rilPassoColonne(px);
    for(let j=0;j<30;j++) vicino(rilPassoColonne(px),p);
  }
});
return {esiti,datiZoom};
`);
for (const nome of conti.esiti) console.log('OK ' + nome);
const disegno = esegui(String.raw`
const sky={larghezza:1280,altezza:720,luceCielo:1,fov:60};
const SKY_D2R=Math.PI/180, SKY_R2D=180/Math.PI, SKY_D_MIN=-0.9995, SKY_FOSCHIA_KM=25, SKY_NADIR_SCHERMI=4;
const SKY_ORIZZONTE_RETTA_MIN=1.2e-3, SKY_ORIZZONTE_FRECCIA_PX=0.5;
function skyCampoDaObiettivo(){return false;}
rilControlla=()=>{}; rilPronto=()=>true; rilLuogo=()=>null;
rilScostamento=()=>null; rilOcchioOra=()=>501.7;
rilievo.occhio=501.7;
rilievo.quota=new Float64Array(RIL_AZIMUT*RIL_ANELLI);
rilievo.alt=new Float64Array(RIL_AZIMUT*RIL_ANELLI);
for(let i=0;i<RIL_AZIMUT;i++)for(let k=0;k<RIL_ANELLI;k++){
  const s=RIL_DIST[k],az=i*RIL_PASSO_AZ*SKY_D2R;
  const q=500 + 0.16*s*Math.sin(az) + 400*(Math.exp(-Math.pow((s-2500)/1500,2))-Math.exp(-Math.pow(2500/1500,2)))*(1+0.4*Math.cos(az*3));
  rilievo.quota[i*RIL_ANELLI+k]=q;
  rilievo.alt[i*RIL_ANELLI+k]=rilAngolo(q,rilievo.occhio,s);
}
const conti={moveTo:0,lineTo:0,stroke:0,fill:0};
const ctx={globalAlpha:1};
for(const name of ['beginPath','closePath','save','restore','clip','rect','moveTo','lineTo','stroke','fill']) {
  ctx[name]=(...args)=>{
    for(const v of args) if(typeof v==='number' && !Number.isFinite(v)) throw Error(name+': '+v);
    if(name in conti)conti[name]++;
  };
}
const risultati=[];
for(const fov of [180,60,10,1,0.25]) for(const alt of [0,-20,-85]){
 sky.fov=fov;
 const az=359.9, a=az*SKY_D2R, f=skyVettore(az,alt), r=[Math.cos(a),-Math.sin(a),0];
 const base={f,r,u:skyCross(r,f)}, focale=sky.altezza/(4*Math.tan(fov*SKY_D2R/4));
 rilBudgetFattore=1;
 const ok=rilDisegna(ctx,base,focale,{vicino:[80,100,60],lontano:[150,170,180]},{foschia:[180,190,210]});
 if(!ok || rilievo.ultimo.colonne>4096) throw Error('disegno fallito '+fov+'/'+alt);
 risultati.push({fov,alt,colonne:rilievo.ultimo.colonne,passo:rilievo.ultimo.passo,strisce:rilievo.ultimo.strisce});
}
return {conti,risultati};
`);
if (!(disegno.conti.stroke > 30)) throw new Error('Il test non ha disegnato il chiaroscuro');
for (const vista of disegno.risultati) {
  if (!(vista.strisce > 0)) throw new Error('Chiaroscuro assente: ' + JSON.stringify(vista));
  console.log('OK disegno FOV ' + vista.fov + ', altezza ' + vista.alt + ': ' + vista.colonne + ' colonne');
}
console.log(conti.esiti.length + ' verifiche numeriche e ' + disegno.risultati.length + ' viste superate.');
